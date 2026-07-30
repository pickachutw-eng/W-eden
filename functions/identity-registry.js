'use strict';

const SERIAL_PREFIX = 'WEDEN-260814';

class AllocationError extends Error {
    constructor(code, message) {
        super(message);
        this.name = 'AllocationError';
        this.code = code;
    }
}

function normalizePositiveInteger(value, fallback) {
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function allocateIdentity(currentRegistry, uid) {
    if (!uid) throw new AllocationError('invalid-argument', '缺少登入身分。');

    const current = currentRegistry && typeof currentRegistry === 'object'
        ? currentRegistry
        : {};
    const config = {
        registrationOpen: current.config?.registrationOpen !== false
    };
    const byUid = { ...(current.byUid || {}) };
    const reservations = { ...(current.reservations || {}) };
    const existingId = byUid[uid];

    if (existingId) {
        return {
            id: existingId,
            created: false,
            registry: { ...current, config, byUid, reservations }
        };
    }
    if (!config.registrationOpen) {
        throw new AllocationError('failed-precondition', '目前未開放建立新身分。');
    }

    let nextNumber = normalizePositiveInteger(current.nextNumber, 1);
    let id = `${SERIAL_PREFIX}${String(nextNumber).padStart(3, '0')}`;
    while (reservations[id]) {
        nextNumber += 1;
        id = `${SERIAL_PREFIX}${String(nextNumber).padStart(3, '0')}`;
    }

    byUid[uid] = id;
    reservations[id] = {
        uid,
        number: nextNumber,
        reservedAt: Date.now()
    };

    return {
        id,
        created: true,
        registry: {
            ...current,
            config,
            nextNumber: nextNumber + 1,
            byUid,
            reservations
        }
    };
}

module.exports = {
    AllocationError,
    SERIAL_PREFIX,
    allocateIdentity
};
