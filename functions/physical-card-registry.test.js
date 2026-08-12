'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
    GUEST_CARD_HASH_ASSIGNMENTS,
    assignPhysicalCard,
    assignPhysicalCardByDisplayNameHash,
    hashLineDisplayName,
    normalizeLineDisplayName
} = require('./physical-card-registry');

function hashForPgId(pgId) {
    return GUEST_CARD_HASH_ASSIGNMENTS.find((assignment) => assignment.pgId === pgId)?.lineDisplayNameHash;
}

test('maps a matching hashed LINE name to its prewritten room key', () => {
    const result = assignPhysicalCardByDisplayNameHash(null, 'line_guest', hashForPgId('PG-002'), 1234);

    assert.equal(result.pgId, 'PG-002');
    assert.equal(result.created, true);
    assert.deepEqual(result.registry.byUid.line_guest, {
        pgId: 'PG-002',
        lineDisplayNameHash: hashForPgId('PG-002'),
        linkedAt: 1234
    });
    assert.equal(result.registry.byPgId['PG-002'], 'line_guest');
});

test('keeps the same PG number after the LINE display name changes', () => {
    const first = assignPhysicalCardByDisplayNameHash(null, 'line_guest', hashForPgId('PG-002'), 1234);
    const second = assignPhysicalCard(first.registry, 'line_guest', 'changed display name', 5678);

    assert.equal(second.pgId, 'PG-002');
    assert.equal(second.created, false);
    assert.equal(second.registry.byUid.line_guest.linkedAt, 1234);
});

test('normalizes compatible Unicode and surrounding whitespace before hashing', () => {
    const original = 'Ａｎｏｎｙｍｏｕｓ';
    const normalizedVariant = `  ${original.normalize('NFKC')}  `;

    assert.equal(normalizeLineDisplayName(normalizedVariant), normalizeLineDisplayName(original));
    assert.equal(hashLineDisplayName(normalizedVariant), hashLineDisplayName(original));
});

test('does not allocate a physical card to a name outside the guest list', () => {
    const result = assignPhysicalCard(null, 'line_unknown', 'unlisted guest');

    assert.equal(result.pgId, null);
    assert.equal(result.created, false);
    assert.deepEqual(result.registry.byUid, {});
});

test('prevents a second LINE account from claiming the same physical card', () => {
    const displayNameHash = hashForPgId('PG-002');
    const first = assignPhysicalCardByDisplayNameHash(null, 'line_guest', displayNameHash);

    assert.throws(
        () => assignPhysicalCardByDisplayNameHash(first.registry, 'line_other', displayNameHash),
        /PG-002 已由另一個 LINE 身分認領/
    );
});

test('contains 41 unique hashed display names and PG numbers', () => {
    assert.equal(GUEST_CARD_HASH_ASSIGNMENTS.length, 41);
    assert.equal(new Set(GUEST_CARD_HASH_ASSIGNMENTS.map(({ pgId }) => pgId)).size, 41);
    assert.equal(
        new Set(GUEST_CARD_HASH_ASSIGNMENTS.map(({ lineDisplayNameHash }) => lineDisplayNameHash)).size,
        41
    );
    assert.equal(
        GUEST_CARD_HASH_ASSIGNMENTS.every(({ lineDisplayNameHash }) => /^[0-9a-f]{64}$/.test(lineDisplayNameHash)),
        true
    );
});
