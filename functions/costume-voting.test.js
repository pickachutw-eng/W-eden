'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
    VOTING_OPENS_AT,
    VOTING_CLOSES_AT,
    buildLeaderboard,
    getVotingPhase
} = require('./costume-voting');

const users = {
    alice: { id: 'alice', name: '愛麗絲', animal: '狐狸' },
    bob: { id: 'bob', name: '鮑伯', animal: '熊' },
    carol: { id: 'carol', name: '卡蘿', animal: '貓' }
};

test('uses the Taipei event voting window', () => {
    assert.equal(VOTING_OPENS_AT, Date.parse('2026-08-14T12:30:00Z'));
    assert.equal(VOTING_CLOSES_AT, Date.parse('2026-08-14T14:15:00Z'));
    assert.equal(getVotingPhase(VOTING_OPENS_AT - 1), 'upcoming');
    assert.equal(getVotingPhase(VOTING_OPENS_AT), 'open');
    assert.equal(getVotingPhase(VOTING_CLOSES_AT - 1), 'open');
    assert.equal(getVotingPhase(VOTING_CLOSES_AT), 'closed');
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
