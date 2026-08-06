window.WEDEN_CONFIG = Object.freeze({
    liffId: '2010878499-ibrTU601',
    functionsRegion: 'asia-east1',
    eventSchedule: Object.freeze({
        votingOpensAt: '2026-08-14T20:30:00+08:00',
        votingClosesAt: '2026-08-14T22:00:00+08:00',
        awardsAt: '2026-08-14T22:00:00+08:00',
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

    function scheduleRow(time, title, subtitle, description, isLast) {
        return `
            <div class="flex gap-6">
                <div class="flex flex-col items-center w-16 shrink-0 font-black text-fuchsia-300 text-xs">
                    <span class="rounded-full bg-fuchsia-500/20 border border-fuchsia-500/40 px-3 py-1.5">${time}</span>
                    ${isLast ? '' : '<div class="w-px h-full bg-gradient-to-b from-fuchsia-500/50 to-transparent mt-3"></div>'}
                </div>
                <div class="text-[15px] text-white/90 ${isLast ? '' : 'pb-2'}">
                    <strong class="text-white text-lg block mb-1">${title}</strong>
                    <span class="text-fuchsia-200/50 text-[10px] uppercase tracking-wider block mb-2">${subtitle}</span>
                    <p class="text-white/60 text-sm leading-relaxed">${description}</p>
                </div>
            </div>`;
    }

    function renderSchedule() {
        const landingTitle = [...document.querySelectorAll('strong')]
            .find((element) => element.textContent.trim() === '軌道對接：報到迎賓');
        const scheduleCard = landingTitle?.closest('.rounded-\\[32px\\]');
        if (!scheduleCard || scheduleCard.dataset.scheduleVersion === '2026-08-05') return;

        scheduleCard.dataset.scheduleVersion = '2026-08-05';
        scheduleCard.innerHTML = [
            scheduleRow('20:00', '軌道對接：報到迎賓', 'Orbital Docking: Check-in & Welcome', '完成報到、領取識別物資，與其他冒險者自由交流。', false),
            scheduleRow('20:30', '能量補充：食物與狂歡', 'Fueling Station: Feast & Revelry', '主食與酒水開放，同步開啟最佳服裝投票。', false),
            scheduleRow('21:30', '致詞切蛋糕', 'Toast & Cake', '集合致詞、切蛋糕並拍攝全體合照；最佳服裝投票持續進行。', false),
            scheduleRow('22:00', '榮耀時刻：最佳服裝獎', 'Moment of Glory: Best Costume Awards', '22:00 截止投票並立即開票，公布結果、頒發獎項並拍攝得獎者合照。', false),
            scheduleRow('22:20', '秘境探索：暗夜時刻', 'Secret Realm: After Dark', '正式流程結束，基地進入自由探索與暗夜時刻。', true)
        ].join('');
    }

    document.addEventListener('DOMContentLoaded', () => {
        renderSchedule();
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
            window.openIdentityCardModal?.(session.identity, {
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

        async function startLineLoginFromStableEntry(...args) {
            const liffId = String(window.WEDEN_CONFIG?.liffId || '');
            const isInLiffClient = window.liff?.isInClient?.() === true;

            if (liffId && !isInLiffClient) {
                sessionStorage.setItem(RETURN_PENDING_KEY, '1');
                window.closeAuthModal?.();
                window.location.assign(`https://liff.line.me/${encodeURIComponent(liffId)}`);
                return;
            }

            return originalStartLineLogin.apply(this, args);
        }

        startLineLoginFromStableEntry.__wedenWrapped = true;
        window.startLineLogin = startLineLoginFromStableEntry;
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
