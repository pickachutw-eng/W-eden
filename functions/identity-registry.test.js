'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { allocateIdentity } = require('./identity-registry');

test('allocates the first W-EDEN event serial', () => {
    const result = allocateIdentity(null, 'line_user_a');
    assert.equal(result.id, 'WEDEN-260814001');
    assert.equal(result.registry.nextNumber, 2);
});

test('returns the same serial for the same LINE account', () => {
    const first = allocateIdentity(null, 'line_user_a');
    const second = allocateIdentity(first.registry, 'line_user_a');
    assert.equal(second.id, first.id);
    assert.equal(second.created, false);
    assert.equal(second.registry.nextNumber, 2);
});

test('allocates consecutive unique serials', () => {
    const first = allocateIdentity(null, 'line_user_a');
    const second = allocateIdentity(first.registry, 'line_user_b');
    assert.equal(second.id, 'WEDEN-260814002');
    assert.notEqual(second.id, first.id);
});

test('respects registrationOpen and maxGuests', () => {
    assert.throws(
        () => allocateIdentity({ config: { registrationOpen: false } }, 'line_user_a'),
        /未開放/
    );

    const registry = {
        config: { registrationOpen: true, maxGuests: 1 },
        nextNumber: 2,
        byUid: { line_user_a: 'WEDEN-260814001' },
        reservations: { 'WEDEN-260814001': { uid: 'line_user_a', number: 1 } }
    };
    assert.throws(() => allocateIdentity(registry, 'line_user_b'), /名額已滿/);
});
