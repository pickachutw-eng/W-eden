'use strict';

const VOTING_OPENS_AT = Date.parse('2026-08-14T20:30:00+08:00');
const VOTING_CLOSES_AT = Date.parse('2026-08-14T22:15:00+08:00');

function getVotingPhase(now = Date.now()) {
    if (now < VOTING_OPENS_AT) return 'upcoming';
    if (now < VOTING_CLOSES_AT) return 'open';
    return 'closed';
}

function buildLeaderboard(votesByVoter, users) {
    const tallies = new Map();

    Object.entries(votesByVoter || {}).forEach(([voterId, vote]) => {
        const candidateId = String(vote?.candidateId || '');
        if (!candidateId || candidateId === voterId || !users?.[candidateId]?.id) return;
        tallies.set(candidateId, (tallies.get(candidateId) || 0) + 1);
    });

    const totalVotes = [...tallies.values()].reduce((sum, count) => sum + count, 0);
    const ranked = [...tallies.entries()]
        .map(([candidateId, votes]) => ({
            candidateId,
            name: users[candidateId].name || 'UNKNOWN',
            animal: users[candidateId].animal || 'UNKNOWN',
            votes
        }))
        .sort((a, b) => (
            b.votes - a.votes
            || a.name.localeCompare(b.name, 'zh-Hant')
            || a.candidateId.localeCompare(b.candidateId)
        ));

    let previousVotes = null;
    let currentRank = 0;
    const leaderboard = ranked.map((entry, index) => {
        if (entry.votes !== previousVotes) currentRank = index + 1;
        previousVotes = entry.votes;
        return {
            candidateId: entry.candidateId,
            name: entry.name,
            animal: entry.animal,
            rank: currentRank,
            percentage: totalVotes ? Math.round((entry.votes / totalVotes) * 1000) / 10 : 0
        };
    }).filter((entry) => entry.rank <= 5);

    return { totalVotes, leaderboard };
}

module.exports = {
    VOTING_OPENS_AT,
    VOTING_CLOSES_AT,
    buildLeaderboard,
    getVotingPhase
};
