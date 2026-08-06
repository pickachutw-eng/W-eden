'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
    VOTING_OPENS_AT,
    VOTING_CLOSES_AT,
    TEST_VOTING_OPENS_AT,
    TEST_VOTING_CLOSES_AT,
    buildLeaderboard,
    getVotingPhase,
    getVotingWindow
} = require('./costume-voting');

const users = {
    alice: { id: 'alice', name: '愛麗絲', animal: '狐狸' },
    bob: { id: 'bob', name: '鮑伯', animal: '熊' },
    carol: { id: 'carol', name: '卡蘿', animal: '貓' }
};

test('uses the Taipei event voting window', () => {
    assert.equal(VOTING_OPENS_AT, Date.parse('2026-08-14T12:30:00Z'));
    assert.equal(VOTING_CLOSES_AT, Date.parse('2026-08-14T14:00:00Z'));
    assert.equal(getVotingPhase(VOTING_OPENS_AT - 1), 'upcoming');
    assert.equal(getVotingPhase(VOTING_OPENS_AT), 'open');
    assert.equal(getVotingPhase(VOTING_CLOSES_AT - 1), 'open');
    assert.equal(getVotingPhase(VOTING_CLOSES_AT), 'closed');
});

test('uses a separate temporary window in test mode', () => {
    const window = getVotingWindow(true);
    assert.equal(window.opensAt, TEST_VOTING_OPENS_AT);
    assert.equal(window.closesAt, TEST_VOTING_CLOSES_AT);
    assert.equal(getVotingPhase(TEST_VOTING_OPENS_AT, window), 'open');
    assert.equal(getVotingPhase(TEST_VOTING_CLOSES_AT, window), 'closed');
    assert.equal(getVotingWindow(false).opensAt, VOTING_OPENS_AT);
    assert.equal(getVotingWindow(false).closesAt, VOTING_CLOSES_AT);
});

test('builds percentages using all valid votes as the denominator', () => {
    const result = buildLeaderboard({
        voter1: { candidateId: 'alice' },
        voter2: { candidateId: 'alice' },
        voter3: { candidateId: 'bob' }
    }, users);

    assert.equal(result.totalVotes, 3);
    assert.deepEqual(result.leaderboard, [
        { candidateId: 'alice', name: '愛麗絲', animal: '狐狸', rank: 1, percentage: 66.7 },
        { candidateId: 'bob', name: '鮑伯', animal: '熊', rank: 2, percentage: 33.3 }
    ]);
});

test('shows tied candidates at the same rank', () => {
    const result = buildLeaderboard({
        voter1: { candidateId: 'alice' },
        voter2: { candidateId: 'bob' },
        voter3: { candidateId: 'carol' }
    }, users);

    assert.deepEqual(result.leaderboard.map((entry) => entry.rank), [1, 1, 1]);
});

test('ignores self votes and candidates without a current identity', () => {
    const result = buildLeaderboard({
        alice: { candidateId: 'alice' },
        voter2: { candidateId: 'missing' },
        voter3: { candidateId: 'bob' }
    }, users);

    assert.equal(result.totalVotes, 1);
    assert.equal(result.leaderboard[0].candidateId, 'bob');
});
