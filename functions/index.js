'use strict';

const { initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getDatabase } = require('firebase-admin/database');
const { defineString } = require('firebase-functions/params');
const { HttpsError, onCall } = require('firebase-functions/v2/https');
const { setGlobalOptions } = require('firebase-functions/v2/options');
const { AllocationError, allocateIdentity } = require('./identity-registry');
const {
    buildLeaderboard,
    getVotingPhase,
    getVotingWindow
} = require('./costume-voting');
const { InstagramValidationError, normalizeInstagramUsername } = require('./instagram');

initializeApp();
setGlobalOptions({ region: 'asia-east1', maxInstances: 10 });

const LINE_CHANNEL_ID = defineString('LINE_CHANNEL_ID', { default: '2010878499' });
const DEFAULT_SECTOR_ID = 'sec-forest';
const VOTING_TEST_MODE = process.env.COSTUME_VOTING_TEST_MODE === 'true';
const ACTIVE_VOTING_WINDOW = getVotingWindow(VOTING_TEST_MODE);
const VOTING_DATA_ROOT = VOTING_TEST_MODE ? 'costumeVotingTest' : 'costumeVoting';

function requireText(value, fieldName, maxLength) {
    const text = String(value || '').trim();
    if (!text) throw new HttpsError('invalid-argument', `${fieldName}不可空白。`);
    if (text.length > maxLength) {
        throw new HttpsError('invalid-argument', `${fieldName}不可超過 ${maxLength} 個字元。`);
    }
    return text;
}

function normalizeSkill(value) {
    const skill = Number(value);
    if (!Number.isFinite(skill) || skill < 0 || skill > 1) {
        throw new HttpsError('invalid-argument', '能量光譜必須介於 0 與 1 之間。');
    }
    return Math.round(skill * 10) / 10;
}

function normalizeIdentityId(value, fieldName) {
    const id = requireText(value, fieldName, 40);
    if (!/^WEDEN-260814\d{3,}$/.test(id)) {
        throw new HttpsError('invalid-argument', `${fieldName}格式無效。`);
    }
    return id;
}

function normalizeInstagram(value) {
    try {
        return normalizeInstagramUsername(value);
    } catch (error) {
        if (error instanceof InstagramValidationError) {
            throw new HttpsError('invalid-argument', error.message);
        }
        throw error;
    }
}

async function verifyLineIdToken(idToken) {
    const params = new URLSearchParams({
        id_token: idToken,
        client_id: LINE_CHANNEL_ID.value()
    });
    const response = await fetch('https://api.line.me/oauth2/v2.1/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params
    });
    const result = await response.json();

    if (!response.ok || !result.sub) {
        console.error('LINE token verification failed', {
            status: response.status,
            error: result.error,
            errorDescription: result.error_description
        });
        throw new HttpsError('unauthenticated', 'LINE 登入憑證無效或已過期。');
    }
    return result;
}

async function getIdentityIdForUid(db, uid) {
    const bindingSnapshot = await db.ref(`lineBindings/${uid}`).get();
    if (bindingSnapshot.exists()) return bindingSnapshot.val();
    const registrySnapshot = await db.ref(`identityRegistry/byUid/${uid}`).get();
    return registrySnapshot.val() || null;
}

async function ensureDefaultSector(db, identity) {
    if (!identity?.id || identity.currentSector) return identity;

    const assignedAt = Date.now();
    const updatedIdentity = {
        ...identity,
        currentSector: DEFAULT_SECTOR_ID,
        currentSectorUpdatedAt: assignedAt
    };
    await db.ref().update({
        [`users/${identity.id}/currentSector`]: DEFAULT_SECTOR_ID,
        [`users/${identity.id}/currentSectorUpdatedAt`]: assignedAt,
        [`sectorOccupancy/${DEFAULT_SECTOR_ID}/${identity.id}`]: {
            id: identity.id,
            name: identity.name || '',
            animal: identity.animal || '',
            timestamp: assignedAt
        }
    });
    return updatedIdentity;
}

async function buildVotingState(db, voterId, now = Date.now()) {
    const [votesSnapshot, usersSnapshot] = await Promise.all([
        db.ref(`${VOTING_DATA_ROOT}/votesByVoter`).get(),
        db.ref('users').get()
    ]);
    const votesByVoter = votesSnapshot.val() || {};
    const users = usersSnapshot.val() || {};
    const phase = getVotingPhase(now, ACTIVE_VOTING_WINDOW);
    const ranking = phase === 'upcoming'
        ? { totalVotes: 0, leaderboard: [] }
        : buildLeaderboard(votesByVoter, users);

    return {
        phase,
        opensAt: ACTIVE_VOTING_WINDOW.opensAt,
        closesAt: ACTIVE_VOTING_WINDOW.closesAt,
        testMode: VOTING_TEST_MODE,
        serverTime: now,
        totalVotes: ranking.totalVotes,
        leaderboard: ranking.leaderboard,
        currentVoteCandidateId: votesByVoter[voterId]?.candidateId || null
    };
}

exports.lineLogin = onCall({ cors: true }, async (request) => {
    const idToken = String(request.data?.idToken || '');
    if (!idToken) throw new HttpsError('invalid-argument', '缺少 LINE ID Token。');

    const lineIdentity = await verifyLineIdToken(idToken);
    const uid = `line_${lineIdentity.sub}`;
    const customToken = await getAuth().createCustomToken(uid, { provider: 'line' });

    return {
        customToken,
        profile: {
            displayName: lineIdentity.name || '',
            pictureUrl: lineIdentity.picture || ''
        }
    };
});

exports.getMyIdentity = onCall({ cors: true }, async (request) => {
    if (!request.auth?.uid) throw new HttpsError('unauthenticated', '請先使用 LINE 登入。');

    const db = getDatabase();
    const uid = request.auth.uid;
    const id = await getIdentityIdForUid(db, uid);
    if (!id) return { identity: null };

    const identitySnapshot = await db.ref(`users/${id}`).get();
    const identity = await ensureDefaultSector(db, identitySnapshot.val() || null);
    return { identity };
});

exports.saveIdentity = onCall({ cors: true }, async (request) => {
    if (!request.auth?.uid) throw new HttpsError('unauthenticated', '請先使用 LINE 登入。');

    const profile = {
        name: requireText(request.data?.name, '識別名稱', 40),
        animal: requireText(request.data?.animal, '動物形態', 40),
        IG: normalizeInstagram(request.data?.IG),
        skill: normalizeSkill(request.data?.skill)
    };
    const db = getDatabase();
    const uid = request.auth.uid;
    const registryRef = db.ref('identityRegistry');
    let allocation = null;
    let allocationError = null;

    const transaction = await registryRef.transaction((current) => {
        allocationError = null;
        try {
            allocation = allocateIdentity(current, uid);
            return allocation.registry;
        } catch (error) {
            allocationError = error;
            return undefined;
        }
    }, undefined, false);

    if (!transaction.committed || !allocation?.id) {
        if (allocationError instanceof AllocationError) {
            throw new HttpsError(allocationError.code, allocationError.message);
        }
        throw new HttpsError('aborted', '目前無法配發 WEDEN 流水號，請稍後再試。');
    }

    const id = allocation.id;
    const existingSnapshot = await db.ref(`users/${id}`).get();
    const existing = existingSnapshot.val() || {};
    const currentSector = existing.currentSector || DEFAULT_SECTOR_ID;
    const sectorUpdatedAt = existing.currentSectorUpdatedAt || Date.now();
    const identity = {
        id,
        ...profile,
        timestamp: existing.timestamp || Date.now(),
        currentSector,
        currentSectorUpdatedAt: sectorUpdatedAt,
        updatedAt: Date.now()
    };

    const updates = {
        [`lineBindings/${uid}`]: id,
        [`users/${id}`]: identity,
        [`sectorOccupancy/${currentSector}/${id}`]: {
            id,
            name: identity.name,
            animal: identity.animal,
            timestamp: sectorUpdatedAt
        }
    };

    await db.ref().update(updates);

    return { identity, created: allocation.created };
});

exports.getCostumeVotingState = onCall({ cors: true }, async (request) => {
    if (!request.auth?.uid) throw new HttpsError('unauthenticated', '請先使用 LINE 登入。');

    const db = getDatabase();
    const voterId = await getIdentityIdForUid(db, request.auth.uid);
    if (!voterId) throw new HttpsError('failed-precondition', '請先建立 W-EDEN 身分。');

    return buildVotingState(db, voterId);
});

exports.castCostumeVote = onCall({ cors: true }, async (request) => {
    if (!request.auth?.uid) throw new HttpsError('unauthenticated', '請先使用 LINE 登入。');

    const now = Date.now();
    const phase = getVotingPhase(now, ACTIVE_VOTING_WINDOW);
    if (phase === 'upcoming') {
        throw new HttpsError(
            'failed-precondition',
            VOTING_TEST_MODE ? '最佳服裝投票測試尚未開放。' : '最佳服裝投票將於 20:30 開放。'
        );
    }
    if (phase === 'closed') {
        throw new HttpsError(
            'failed-precondition',
            VOTING_TEST_MODE ? '本輪最佳服裝投票測試已結束。' : '最佳服裝投票已於 22:15 結束。'
        );
    }

    const candidateId = normalizeIdentityId(request.data?.candidateId, '候選人');
    const db = getDatabase();
    const voterId = await getIdentityIdForUid(db, request.auth.uid);
    if (!voterId) throw new HttpsError('failed-precondition', '請先建立 W-EDEN 身分。');
    if (candidateId === voterId) {
        throw new HttpsError('invalid-argument', '不能投票給自己。');
    }

    const [voterSnapshot, candidateSnapshot] = await Promise.all([
        db.ref(`users/${voterId}`).get(),
        db.ref(`users/${candidateId}`).get()
    ]);
    if (!voterSnapshot.exists()) throw new HttpsError('failed-precondition', '找不到你的 W-EDEN 身分。');
    if (!candidateSnapshot.exists()) throw new HttpsError('not-found', '找不到這位冒險者。');

    const voteRef = db.ref(`${VOTING_DATA_ROOT}/votesByVoter/${voterId}`);
    const previousSnapshot = await voteRef.get();
    const previousCandidateId = previousSnapshot.val()?.candidateId || null;
    await voteRef.set({
        candidateId,
        updatedAt: now
    });

    return {
        ...(await buildVotingState(db, voterId, now)),
        previousCandidateId,
        changed: Boolean(previousCandidateId && previousCandidateId !== candidateId)
    };
});
