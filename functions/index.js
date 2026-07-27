'use strict';

const { initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getDatabase } = require('firebase-admin/database');
const { defineString } = require('firebase-functions/params');
const { HttpsError, onCall } = require('firebase-functions/v2/https');
const { setGlobalOptions } = require('firebase-functions/v2/options');
const { AllocationError, allocateIdentity } = require('./identity-registry');

initializeApp();
setGlobalOptions({ region: 'asia-east1', maxInstances: 10 });

const LINE_CHANNEL_ID = defineString('LINE_CHANNEL_ID');

function requireText(value, fieldName, maxLength) {
    const text = String(value || '').trim();
    if (!text) throw new HttpsError('invalid-argument', `${fieldName}不可空白。`);
    if (text.length > maxLength) {
        throw new HttpsError('invalid-argument', `${fieldName}不可超過 ${maxLength} 個字元。`);
    }
    return text;
}

function optionalText(value, fieldName, maxLength) {
    const text = String(value || '').trim();
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
    const bindingSnapshot = await db.ref(`lineBindings/${uid}`).get();
    const registrySnapshot = bindingSnapshot.exists()
        ? null
        : await db.ref(`identityRegistry/byUid/${uid}`).get();
    const id = bindingSnapshot.val() || registrySnapshot?.val();
    if (!id) return { identity: null };

    const identitySnapshot = await db.ref(`users/${id}`).get();
    return { identity: identitySnapshot.val() || null };
});

exports.saveIdentity = onCall({ cors: true }, async (request) => {
    if (!request.auth?.uid) throw new HttpsError('unauthenticated', '請先使用 LINE 登入。');

    const profile = {
        name: requireText(request.data?.name, '識別名稱', 40),
        animal: requireText(request.data?.animal, '動物形態', 40),
        IG: optionalText(request.data?.IG, 'Instagram', 80),
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
    const identity = {
        id,
        ...profile,
        timestamp: existing.timestamp || Date.now(),
        currentSector: existing.currentSector || null,
        currentSectorUpdatedAt: existing.currentSectorUpdatedAt || null,
        updatedAt: Date.now()
    };

    await db.ref().update({
        [`lineBindings/${uid}`]: id,
        [`users/${id}`]: identity
    });

    return { identity, created: allocation.created };
});
