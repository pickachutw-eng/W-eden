window.WEDEN_CONFIG = Object.freeze({
    liffId: '2010878499-ibrTU601',
    functionsRegion: 'asia-east1',
    eventSchedule: Object.freeze({
        votingOpensAt: '2026-08-14T20:30:00+08:00',
        votingClosesAt: '2026-08-14T22:00:00+08:00',
        awardsAt: '2026-08-14T22:00:00+08:00',
        galaxyPicnicTransformsAt: '2026-08-14T22:00:00+08:00',
        darkRoomAt: '2026-08-14T22:20:00+08:00'
    })
});

(function installEventSchedule() {
    const votingTextReplacements = new Map([
        ['距離 22:15 截止', '距離 22:00 截止'],
        ['2026/8/14 22:15', '2026/8/14 22:00'],
        ['2026/8/14 20:30 開放投票，22:15 截止。', '2026/8/14 20:30 開放投票，22:00 截止並立即開票。'],
        ['2026/8/14 20:30–22:15', '2026/8/14 20:30–22:00'],
        ['最佳服裝投票已於 22:15 結束。', '最佳服裝投票已於 22:00 結束。']
    ]);

    function replaceVotingText(root) {
        if (!root) return;
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        let node;
        while ((node = walker.nextNode())) {
            const replacement = votingTextReplacements.get(node.nodeValue.trim());
            if (replacement) node.nodeValue = node.nodeValue.replace(node.nodeValue.trim(), replacement);
        }
    }

    document.addEventListener('DOMContentLoaded', () => {
        replaceVotingText(document.body);

        const observer = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === Node.TEXT_NODE) {
                        const replacement = votingTextReplacements.get(node.nodeValue.trim());
                        if (replacement) node.nodeValue = replacement;
                    } else if (node.nodeType === Node.ELEMENT_NODE) {
                        replaceVotingText(node);
                    }
                });
                if (mutation.type === 'characterData') {
                    const replacement = votingTextReplacements.get(mutation.target.nodeValue.trim());
                    if (replacement) mutation.target.nodeValue = replacement;
                }
            }
        });
        observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    });
})();

(function installLineLoginRecovery() {
    const RETURN_PENDING_KEY = 'weden_line_login_return_pending';
    const CALLBACK_KEYS = [
        'code',
        'state',
        'friendship_status_changed',
        'error',
        'error_description',
        'liffClientId',
        'liffRedirectUri',
        'liff.state',
        'liff.referrer'
    ];
    const initialUrl = new URL(window.location.href);
    let callbackReturnPending = CALLBACK_KEYS.some((key) => initialUrl.searchParams.has(key));
    let resumePromise = null;
    let lastResumeAt = 0;

    function hasPendingReturn() {
        return callbackReturnPending || sessionStorage.getItem(RETURN_PENDING_KEY) === '1';
    }

    function revealRecoveredIdentity(session) {
        if (!session?.lineLoggedIn) return;
        callbackReturnPending = false;
        sessionStorage.removeItem(RETURN_PENDING_KEY);

        if (session.identity?.id) {
            window.jumpToBaseImmediately?.();
            const openExperience = window.openPostLoginExperience || window.openIdentityCardModal;
            openExperience?.(session.identity, {
                greeting: `歡迎回來，${session.identity.name || '冒險者'}。基地已恢復你的身分。`
            });
            return;
        }

        window.jumpToBaseImmediately?.();
        window.openAuthModal?.();
    }

    async function resumeLineSession(forceLineExchange = false) {
        if (document.visibilityState === 'hidden') return null;
        if (typeof window.initializeLineSession !== 'function') return null;
        if (resumePromise) return resumePromise;

        const now = Date.now();
        if (!forceLineExchange && now - lastResumeAt < 1200) return null;
        lastResumeAt = now;

        resumePromise = window.initializeLineSession({ forceLineExchange })
            .then((session) => {
                revealRecoveredIdentity(session);
                return session;
            })
            .catch((error) => {
                console.error('LINE session resume failed:', error);
                return null;
            })
            .finally(() => {
                resumePromise = null;
            });

        return resumePromise;
    }

    function installLoginEntryWrapper() {
        const originalStartLineLogin = window.startLineLogin;
        if (typeof originalStartLineLogin !== 'function' || originalStartLineLogin.__wedenWrapped) return;

        async function startLineLoginWithRecovery(...args) {
            sessionStorage.setItem(RETURN_PENDING_KEY, '1');
            const result = await originalStartLineLogin.apply(this, args);

            // If no redirect was needed and LINE is already authenticated, the normal
            // login flow has completed in this page. Do not leave a stale recovery flag.
            if (window.liff?.isLoggedIn?.()) {
                sessionStorage.removeItem(RETURN_PENDING_KEY);
            }
            return result;
        }

        startLineLoginWithRecovery.__wedenWrapped = true;
        window.startLineLogin = startLineLoginWithRecovery;
    }

    window.addEventListener('load', () => {
        installLoginEntryWrapper();

        if (hasPendingReturn()) {
            window.setTimeout(async () => {
                await resumeLineSession(false);
                if (hasPendingReturn()) {
                    await resumeLineSession(true);
                }
            }, 0);
        }
    });

    window.addEventListener('pageshow', (event) => {
        if (event.persisted || hasPendingReturn()) {
            window.setTimeout(() => resumeLineSession(hasPendingReturn()), 0);
        }
    });

    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && hasPendingReturn()) {
            window.setTimeout(() => resumeLineSession(true), 0);
        }
    });
})();

(function loadWedenAudioSystem() {
    if (document.querySelector('script[data-weden-audio]')) return;
    const script = document.createElement('script');
    script.src = 'audio-system.js';
    script.defer = true;
    script.dataset.wedenAudio = 'phase-one';
    document.head.appendChild(script);
})();
