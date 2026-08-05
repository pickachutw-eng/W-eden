'use strict';

const INSTAGRAM_USERNAME_PATTERN = /^[A-Za-z0-9._]{1,30}$/;

class InstagramValidationError extends Error {}

function normalizeInstagramUsername(value) {
    let username = String(value || '').trim();
    if (!username) return '';

    if (username.startsWith('@')) {
        username = username.slice(1).trim();
    }

    if (!INSTAGRAM_USERNAME_PATTERN.test(username)) {
        throw new InstagramValidationError('Instagram 帳號請只輸入 1–30 位英文字母、數字、句點或底線，不要貼網址。');
    }

    return username.toLowerCase();
}

module.exports = {
    InstagramValidationError,
    normalizeInstagramUsername
};
