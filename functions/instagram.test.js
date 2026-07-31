'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
    InstagramValidationError,
    normalizeInstagramUsername
} = require('./instagram');

test('allows an empty optional Instagram username', () => {
    assert.equal(normalizeInstagramUsername(''), '');
    assert.equal(normalizeInstagramUsername(null), '');
});

test('normalizes an @username to a lowercase username', () => {
    assert.equal(normalizeInstagramUsername('  @W_Eden.Party  '), 'w_eden.party');
});

test('rejects URLs and unsupported characters', () => {
    assert.throws(
        () => normalizeInstagramUsername('https://instagram.com/w_eden'),
        InstagramValidationError
    );
    assert.throws(
        () => normalizeInstagramUsername('w-eden'),
        InstagramValidationError
    );
});

test('rejects Instagram usernames longer than 30 characters', () => {
    assert.throws(
        () => normalizeInstagramUsername('a'.repeat(31)),
        InstagramValidationError
    );
});
