(function installWedenAudio() {
    'use strict';

    const PREF_KEY = 'weden_audio_enabled_v1';
    const MASTER = 0.72;
    const BASE_LEVEL = 0.24;
    const ZONE_LEVEL = 0.19;
    const zones = new Set(['sec-forest', 'sec-supply', 'sec-station', 'sec-swamp']);

    let enabled = localStorage.getItem(PREF_KEY) !== '0';
    let unlocked = false;
    let currentZone = null;
    let ctx = null;
    let master = null;
    let base = null;
    const zoneBuses = {};
    let resultPlayed = false;
    let swampPlayed = false;

    function ramp(param, value, duration = 0.5) {
        if (!ctx || !param) return;
        const now = ctx.currentTime;
        param.cancelScheduledValues(now);
        param.setValueAtTime(param.value, now);
        param.linearRampToValueAtTime(value, now + duration);
    }

    function oscillator(dest, frequency, gain, type = 'sine', detune = 0) {
        const osc = ctx.createOscillator();
        const amp = ctx.createGain();
        osc.type = type;
        osc.frequency.value = frequency;
        osc.detune.value = detune;
        amp.gain.value = gain;
        osc.connect(amp);
        amp.connect(dest);
        osc.start();
        return osc;
    }

    function lfo(targetGain, frequency, depth, offset) {
        const osc = ctx.createOscillator();
        const depthGain = ctx.createGain();
        const bias = ctx.createConstantSource();
        osc.frequency.value = frequency;
        depthGain.gain.value = depth;
        bias.offset.value = offset;
        targetGain.gain.value = 0;
        osc.connect(depthGain);
        depthGain.connect(targetGain.gain);
        bias.connect(targetGain.gain);
        osc.start();
        bias.start();
    }

    function bus() {
        const node = ctx.createGain();
        node.gain.value = 0;
        node.connect(master);
        return node;
    }

    function buildAmbience() {
        base = bus();
        const pad = ctx.createGain();
        pad.connect(base);
        oscillator(pad, 55, 0.34);
        oscillator(pad, 82.5, 0.20);
        oscillator(pad, 110, 0.10);
        oscillator(pad, 165, 0.035, 'triangle');
        lfo(pad, 0.065, 0.08, 0.32);

        const forest = bus();
        zoneBuses['sec-forest'] = forest;
        const forestPad = ctx.createGain();
        forestPad.connect(forest);
        oscillator(forestPad, 220, 0.16);
        oscillator(forestPad, 330, 0.09, 'triangle', -4);
        oscillator(forestPad, 880, 0.012);
        lfo(forestPad, 0.08, 0.06, 0.20);

        const supply = bus();
        zoneBuses['sec-supply'] = supply;
        const supplyPad = ctx.createGain();
        supplyPad.connect(supply);
        oscillator(supplyPad, 110, 0.13);
        oscillator(supplyPad, 220, 0.045, 'triangle');
        lfo(supplyPad, 0.5, 0.055, 0.08);

        const station = bus();
        zoneBuses['sec-station'] = station;
        const darkPad = ctx.createGain();
        darkPad.connect(station);
        oscillator(darkPad, 41.25, 0.30);
        oscillator(darkPad, 61.875, 0.17, 'sine', 3);
        oscillator(darkPad, 123.75, 0.035, 'triangle');
        lfo(darkPad, 0.05, 0.08, 0.25);

        const swamp = bus();
        zoneBuses['sec-swamp'] = swamp;
        const swampPad = ctx.createGain();
        swampPad.connect(swamp);
        const a = oscillator(swampPad, 49.5, 0.23);
        const b = oscillator(swampPad, 74.25, 0.15, 'sine', 7);
        oscillator(swampPad, 148.5, 0.035, 'triangle');
        lfo(swampPad, 0.12, 0.065, 0.21);
        const detuneOsc = ctx.createOscillator();
        const detuneGain = ctx.createGain();
        detuneOsc.frequency.value = 0.09;
        detuneGain.gain.value = 6;
        detuneOsc.connect(detuneGain);
        detuneGain.connect(a.detune);
        detuneGain.connect(b.detune);
        detuneOsc.start();
    }

    function ensureContext() {
        if (ctx) return ctx;
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) return null;
        ctx = new AudioContextClass();
        master = ctx.createGain();
        master.gain.value = 0;
        master.connect(ctx.destination);
        buildAmbience();
        window.setInterval(playZoneDetail, 4200);
        return ctx;
    }

    function applyMix() {
        if (!unlocked || !ensureContext()) return;
        const audible = enabled && document.visibilityState !== 'hidden';
        ramp(master.gain, audible ? MASTER : 0, 0.35);
        ramp(base.gain, audible ? BASE_LEVEL : 0, 0.7);
        Object.entries(zoneBuses).forEach(([id, node]) => {
            ramp(node.gain, audible && id === currentZone ? ZONE_LEVEL : 0, 0.8);
        });
        if (audible && ctx.state === 'suspended') void ctx.resume().catch(() => {});
    }

    function tone(frequency, endFrequency, duration, gain, start = 0, type = 'sine') {
        if (!ctx || !master) return;
        const when = ctx.currentTime + start;
        const osc = ctx.createOscillator();
        const amp = ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(Math.max(20, frequency), when);
        if (endFrequency) osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFrequency), when + duration);
        amp.gain.setValueAtTime(0.0001, when);
        amp.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), when + Math.min(0.03, duration / 4));
        amp.gain.exponentialRampToValueAtTime(0.0001, when + duration);
        osc.connect(amp);
        amp.connect(master);
        osc.start(when);
        osc.stop(when + duration + 0.05);
    }

    function sfx(name) {
        if (!enabled || !unlocked || document.visibilityState === 'hidden' || !ensureContext()) return;
        if (ctx.state === 'suspended') void ctx.resume().catch(() => {});

        if (name === 'map') {
            tone(760, 1450, 0.16, 0.10, 0, 'triangle');
            tone(170, 190, 0.13, 0.05);
        } else if (name === 'identity') {
            tone(660, 680, 0.48, 0.07);
            tone(990, 1010, 0.42, 0.045, 0.06);
            tone(1320, 1350, 0.34, 0.025, 0.12);
        } else if (name === 'vote') {
            tone(260, 1180, 0.52, 0.09, 0, 'sawtooth');
            tone(1200, 1210, 0.22, 0.045, 0.46);
            tone(1600, 1610, 0.20, 0.035, 0.56);
            tone(2000, 2010, 0.17, 0.025, 0.65);
        } else if (name === 'swamp') {
            tone(46, 58, 1.15, 0.16);
            tone(180, 920, 1.8, 0.07, 0.15, 'triangle');
            tone(220, 620, 0.28, 0.05, 1.55);
            tone(280, 760, 0.25, 0.045, 1.82);
            tone(340, 900, 0.23, 0.035, 2.06);
        } else if (name === 'results') {
            [330, 440, 550, 660].forEach((f, i) => {
                tone(f, f * 1.01, 0.70, 0.065 - i * 0.006, i * 0.23);
                tone(f * 2, f * 2.01, 0.42, 0.020, i * 0.23, 'triangle');
            });
        }
    }

    function playZoneDetail() {
        if (!enabled || !unlocked || !currentZone || document.visibilityState === 'hidden') return;
        if (currentZone === 'sec-forest') {
            tone(900, 1280, 0.25, 0.008);
            tone(1280, 1040, 0.22, 0.006, 0.15);
        } else if (currentZone === 'sec-supply') {
            tone(1320, 1340, 0.30, 0.010);
            tone(1760, 1780, 0.24, 0.006, 0.02);
        } else if (currentZone === 'sec-station') {
            tone(520, 570, 0.85, 0.010);
        } else if (currentZone === 'sec-swamp') {
            tone(180, 520, 0.28, 0.012);
            tone(240, 700, 0.24, 0.008, 0.14);
        }
    }

    function setZone(id) {
        currentZone = zones.has(id) ? id : null;
        applyMix();
    }

    function updateToggle() {
        const button = document.getElementById('weden-audio-toggle');
        if (!button) return;
        button.setAttribute('aria-pressed', String(enabled));
        button.setAttribute('aria-label', enabled ? '關閉 W-EDEN 聲音' : '開啟 W-EDEN 聲音');
        button.title = enabled ? '關閉聲音' : '開啟聲音';
        button.innerHTML = `<i data-lucide="${enabled ? 'volume-2' : 'volume-x'}" class="h-4 w-4"></i>`;
        window.initIcons?.();
    }

    function installToggle() {
        if (document.getElementById('weden-audio-toggle')) return;
        const button = document.createElement('button');
        button.id = 'weden-audio-toggle';
        button.type = 'button';
        button.className = 'ml-3 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-[#120d22]/70 text-white/70 backdrop-blur-xl shadow-[0_0_18px_rgba(192,132,252,0.14)] transition-all hover:border-fuchsia-300/30 hover:bg-fuchsia-500/15 hover:text-fuchsia-100 active:scale-95';
        button.addEventListener('click', (event) => {
            event.stopPropagation();
            unlocked = true;
            ensureContext();
            enabled = !enabled;
            localStorage.setItem(PREF_KEY, enabled ? '1' : '0');
            updateToggle();
            applyMix();
        });
        const headerRow = document.querySelector('header .mx-auto.flex');
        if (headerRow) {
            headerRow.appendChild(button);
        } else {
            document.body.appendChild(button);
        }
        updateToggle();
    }

    function unlockFromGesture(event) {
        if (event.target?.closest?.('#weden-audio-toggle') || unlocked) return;
        unlocked = true;
        ensureContext();
        if (ctx?.state === 'suspended') void ctx.resume().catch(() => {});
        applyMix();
    }

    function wrap(name, factory) {
        const original = window[name];
        if (typeof original !== 'function' || original.__wedenAudioWrapped) return;
        const wrapped = factory(original);
        wrapped.__wedenAudioWrapped = true;
        window[name] = wrapped;
    }

    function installHooks() {
        wrap('openSector', (original) => function (sectorId, ...args) {
            sfx('map');
            const lockedSwamp = sectorId === 'sec-swamp' && typeof window.isSwampUnlocked === 'function' && !window.isSwampUnlocked();
            setZone(lockedSwamp ? null : sectorId);
            return original.call(this, sectorId, ...args);
        });
        wrap('openLockedSwampSector', (original) => function (...args) {
            sfx('map');
            setZone(null);
            return original.apply(this, args);
        });
        wrap('closeModal', (original) => function (...args) {
            setZone(null);
            return original.apply(this, args);
        });
        wrap('openIdentityCardModal', (original) => function (...args) {
            const value = original.apply(this, args);
            sfx('identity');
            return value;
        });
        wrap('openAuthModal', (original) => function (...args) {
            const value = original.apply(this, args);
            const card = document.getElementById('id-card-container');
            if (card && !card.classList.contains('hidden')) sfx('identity');
            return value;
        });
        wrap('submitCostumeVote', (original) => async function (candidate, ...args) {
            const value = await original.call(this, candidate, ...args);
            const message = document.getElementById('identity-vote-message')?.textContent || '';
            if (candidate?.id && message.includes('已投給')) sfx('vote');
            return value;
        });
        wrap('showSwampUnlockNotice', (original) => function (...args) {
            const value = original.apply(this, args);
            if (!swampPlayed) {
                swampPlayed = true;
                sfx('swamp');
            }
            return value;
        });
        wrap('renderVotingState', (original) => function (...args) {
            const value = original.apply(this, args);
            const title = document.getElementById('voting-panel-title')?.textContent || '';
            const isResult = title.includes('開票結果') || title.includes('測試結果');
            if (isResult && !resultPlayed) {
                resultPlayed = true;
                sfx('results');
            } else if (!isResult) {
                resultPlayed = false;
            }
            return value;
        });
    }

    function boot() {
        installToggle();
        installHooks();
        document.addEventListener('pointerdown', unlockFromGesture, { passive: true, once: true });
        document.addEventListener('keydown', unlockFromGesture, { once: true });
        document.addEventListener('visibilitychange', applyMix);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot, { once: true });
    } else {
        boot();
    }
})();