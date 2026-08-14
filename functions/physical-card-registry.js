'use strict';

const { createHash } = require('node:crypto');

// Only one-way hashes are committed because this repository is public.
const GUEST_CARD_HASH_ASSIGNMENTS = Object.freeze([
    ['efaac5f53024b9602c31810df03f7418cd47da91aefbff1e383105abbd13602d', 'PG-001'],
    ['efc7565081bae11c2da2f47b297b8638a79c5b2af4bbd818afb7e4ce5ad0694f', 'PG-002'],
    ['7efa869d0364eea0cd0106a2ef4d1ae9eaec58fe62928c3f1af8fa8da9204ea0', 'PG-003'],
    ['98f91730233772760a21c09249214cfa8c9d6eb01fc66bf498287b5f1acda2ea', 'PG-004'],
    ['73b972d71b0aec48bed3fe7ef7cecc472d07ed7437bd07c485f95622bf7728ea', 'PG-005'],
    ['a88f95210d2212cc6f17e6dee3179fc0595bcf0d4fb5af269f8c4b9edf808932', 'PG-006'],
    ['9924c012f682b0fd20f6159f5ff61bfdfa7c3ef655cfee55bb92154815236b8f', 'PG-007'],
    ['574c1ccd04bda398a07e5b1425abc3cd78eab0c3973dc84107cdad4b747794f6', 'PG-008'],
    ['2148f60f4f002fcbaaaff4145be3b6f5d3b3baf7b8e9f693331a7bb3067d4f52', 'PG-009'],
    ['99e364cf31917a54651b48b238e648ccb54dbfc4ad4192163d7f147f75b4c2f4', 'PG-010'],
    ['356a980bbe0627c60afab498604c6a547819b433476dab6a6cb92c22aa4f9f5b', 'PG-011'],
    ['92144691b274d13c0312cb84a14873d187a5675681766ff89486f93708c468d2', 'PG-012'],
    ['d718dca73e64f89e2781d259884383ba0ba747fae2dd352732d8738b4559c260', 'PG-013'],
    ['35c51271f945271b3640b972acd0153c4652a9294d17cf69f64b4ea13c22f6c3', 'PG-014'],
    ['0e23211e5bcff21a374b37ca81dbf64c21f37bbe5f2d3d515ba053060f7f4226', 'PG-015'],
    ['1a2eb9171b1feb4c793bd6527ff91d71604f252f42d4b1a8bd23ec4e8121d973', 'PG-016'],
    ['dd7f1f28064a1084ce05c0bfa6d453d5967beb1b3b3d22ff46fb444bf5df8914', 'PG-017'],
    ['ca66a852a9e96c40f4cce7972d994914909b646b2564e8d25dd4003656b3dd63', 'PG-018'],
    ['08cf51fe8f3e7b9c9b08f6ae4803831975d480e39bc806ed7c8120fd66d8086d', 'PG-019'],
    ['ce2db86200e6024b0f007d89c1beb391ae22289d40c5a0768ee3d4f02e78eddf', 'PG-020'],
    ['88b2c6f4833c526d616808c5911b99cd12f579e908079819a353cbf0ec63c36b', 'PG-021'],
    ['fbc5d8a7fe982810c69e5cf659d1d62fdaca596ae4210ba2bfd14f4acf1eeb9f', 'PG-022'],
    ['0c9ab8c55d678ea513149008ce0ca19990aabc50f6bde84189031dad16079780', 'PG-023'],
    ['35c263527a6eddd4246ae9b4da0b72aa79a05dc359a3a0159a8cb1e4b0d8d409', 'PG-024'],
    ['9d20916075878a28a94b7562a3e6161cf2b432fca1c7087cc08a8d81a5215e6d', 'PG-025'],
    ['7ba7d16ac6eaa54ebfd924e4aa1d0b1f1d106eb49596c976f4147f4db8e1b39b', 'PG-026'],
    ['86b4c4510b01eed5f8477e4a22f72f2b0bf68a4a294fe5ff8ab0ceedffbec67d', 'PG-027'],
    ['9d3e816c33156849a4ebc0a03e932efff26885aa37aa443f75ed445dced64a46', 'PG-028'],
    ['777e88b51092d314e2b6b9e523fc4dc2f3281c52df171e5a3343ba4bbae44c5b', 'PG-029'],
    ['9d5de73de2cf0325c46f3f1cb7cf712d0aebc7f34eb901dbd5dd510c5268b71e', 'PG-030'],
    ['2b78bd42a2348f9d9961c248e97200367c3ad36157ad0a918acc434605b48d5a', 'PG-031'],
    ['b7955394ce94daf6bb3047b66507b5e0531a1b1eb528b5c597234028859bf968', 'PG-032'],
    ['961b2fc0609279e249561fa1151874473bb022a487dbe0dfb184159ae87f503c', 'PG-033'],
    ['bd007bca8ee1f1d31869cba66d31d9047437517ff3a82d369f7639ffe9155fd6', 'PG-034'],
    ['80f2aed3c618c423ddf05a2891229fba44942d907173152442cf6591441ed6dc', 'PG-035'],
    ['c9c76e7fbf362151ac8ca4dc4b9ec3f14bf2f4fe94edf0a1ba47149d76af5420', 'PG-036'],
    ['e2a363856620e110d0d49b4b5ecb071e76ae65c1819f9e23ee2b3c8f385f94d9', 'PG-037'],
    ['038a5e851e76a45a5548e61ae17456454992f386274c7eb6d4d96ba7bbcaa2c1', 'PG-038'],
    ['c1feea1d5d9a49a367561aab206e9e80f647ada75e5522c13dcb2b953d9a7a00', 'PG-039'],
    ['3f5565b5991e9989011f755975cde8b7eafda343598d0da516780b6beb411e2c', 'PG-040'],
    ['d8b86e8d0a0372f1acab40a19e99babdd0c1128ae1622f87b150c327a6c66944', 'PG-041']
].map(([lineDisplayNameHash, pgId]) => Object.freeze({ lineDisplayNameHash, pgId })));

class PhysicalCardAssignmentError extends Error {
    constructor(code, message) {
        super(message);
        this.name = 'PhysicalCardAssignmentError';
        this.code = code;
    }
}

function normalizeLineDisplayName(value) {
    return String(value || '')
        .normalize('NFKC')
        .trim()
        .replace(/\s+/gu, ' ');
}

function hashLineDisplayName(value) {
    return createHash('sha256')
        .update(normalizeLineDisplayName(value))
        .digest('hex');
}

const assignmentsByDisplayNameHash = new Map();
for (const assignment of GUEST_CARD_HASH_ASSIGNMENTS) {
    if (assignmentsByDisplayNameHash.has(assignment.lineDisplayNameHash)) {
        throw new Error(`LINE 顯示名稱雜湊重複：${assignment.lineDisplayNameHash}`);
    }
    assignmentsByDisplayNameHash.set(assignment.lineDisplayNameHash, assignment);
}

const CORRECTED_CARD_PAIR = new Set(['PG-024', 'PG-025']);

function replaceAssignmentPgId(assignment, pgId, fallbackDisplayNameHash, now) {
    if (assignment && typeof assignment === 'object') {
        return { ...assignment, pgId };
    }

    return {
        pgId,
        ...(fallbackDisplayNameHash ? { lineDisplayNameHash: fallbackDisplayNameHash } : {}),
        linkedAt: now
    };
}

function findPhysicalCardByLineDisplayName(displayName) {
    return assignmentsByDisplayNameHash.get(hashLineDisplayName(displayName)) || null;
}

function assignPhysicalCardByDisplayNameHash(currentRegistry, uid, displayNameHash, now = Date.now()) {
    if (!uid) {
        throw new PhysicalCardAssignmentError('invalid-argument', '缺少 LINE 登入身分。');
    }

    const current = currentRegistry && typeof currentRegistry === 'object'
        ? currentRegistry
        : {};
    const byUid = { ...(current.byUid || {}) };
    const byPgId = { ...(current.byPgId || {}) };
    const matchedCard = assignmentsByDisplayNameHash.get(displayNameHash);
    const existingAssignment = byUid[uid];
    const existingPgId = typeof existingAssignment === 'string'
        ? existingAssignment
        : existingAssignment?.pgId;

    if (existingPgId) {
        const shouldCorrectReversedPair = matchedCard
            && matchedCard.pgId !== existingPgId
            && CORRECTED_CARD_PAIR.has(matchedCard.pgId)
            && CORRECTED_CARD_PAIR.has(existingPgId);

        if (shouldCorrectReversedPair) {
            const targetOwnerUid = byPgId[matchedCard.pgId];
            if (targetOwnerUid && targetOwnerUid !== uid) {
                byUid[targetOwnerUid] = replaceAssignmentPgId(
                    byUid[targetOwnerUid],
                    existingPgId,
                    null,
                    now
                );
                byPgId[existingPgId] = targetOwnerUid;
            } else {
                delete byPgId[existingPgId];
            }

            byUid[uid] = replaceAssignmentPgId(
                existingAssignment,
                matchedCard.pgId,
                matchedCard.lineDisplayNameHash,
                now
            );
            byPgId[matchedCard.pgId] = uid;

            return {
                pgId: matchedCard.pgId,
                created: false,
                corrected: true,
                registry: { ...current, byUid, byPgId }
            };
        }

        return {
            pgId: existingPgId,
            created: false,
            registry: { ...current, byUid, byPgId }
        };
    }

    if (!matchedCard) {
        return {
            pgId: null,
            created: false,
            registry: { ...current, byUid, byPgId }
        };
    }

    const ownerUid = byPgId[matchedCard.pgId];
    if (ownerUid && ownerUid !== uid) {
        throw new PhysicalCardAssignmentError(
            'already-exists',
            `${matchedCard.pgId} 已由另一個 LINE 身分認領，請聯絡指揮艙。`
        );
    }

    byUid[uid] = {
        pgId: matchedCard.pgId,
        lineDisplayNameHash: matchedCard.lineDisplayNameHash,
        linkedAt: now
    };
    byPgId[matchedCard.pgId] = uid;

    return {
        pgId: matchedCard.pgId,
        created: true,
        registry: { ...current, byUid, byPgId }
    };
}

function assignPhysicalCard(currentRegistry, uid, displayName, now = Date.now()) {
    return assignPhysicalCardByDisplayNameHash(
        currentRegistry,
        uid,
        hashLineDisplayName(displayName),
        now
    );
}

module.exports = {
    GUEST_CARD_HASH_ASSIGNMENTS,
    PhysicalCardAssignmentError,
    assignPhysicalCard,
    assignPhysicalCardByDisplayNameHash,
    findPhysicalCardByLineDisplayName,
    hashLineDisplayName,
    normalizeLineDisplayName
};
