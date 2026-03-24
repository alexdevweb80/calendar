// ──────────────────────────────────────────────
// Chronos Sound System — Web Audio API
// ──────────────────────────────────────────────
const ChronosSounds = (() => {
    let audioCtx = null;

    function getContext() {
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
        return audioCtx;
    }

    // ── Son de validation (publication d'evenement) ──
    // Accord ascendant lumineux, style cyberpunk
    function playValidation() {
        const ctx = getContext();
        const now = ctx.currentTime;

        const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
        notes.forEach((freq, i) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            const filter = ctx.createBiquadFilter();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, now);

            filter.type = 'highpass';
            filter.frequency.setValueAtTime(200, now);

            gain.gain.setValueAtTime(0, now + i * 0.08);
            gain.gain.linearRampToValueAtTime(0.18, now + i * 0.08 + 0.03);
            gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.35);

            osc.connect(filter);
            filter.connect(gain);
            gain.connect(ctx.destination);

            osc.start(now + i * 0.08);
            osc.stop(now + i * 0.08 + 0.4);
        });

        // Shimmer harmonique
        const shimmer = ctx.createOscillator();
        const shimGain = ctx.createGain();
        shimmer.type = 'triangle';
        shimmer.frequency.setValueAtTime(2093, now + 0.24);
        shimGain.gain.setValueAtTime(0, now + 0.24);
        shimGain.gain.linearRampToValueAtTime(0.06, now + 0.3);
        shimGain.gain.exponentialRampToValueAtTime(0.001, now + 0.7);
        shimmer.connect(shimGain);
        shimGain.connect(ctx.destination);
        shimmer.start(now + 0.24);
        shimmer.stop(now + 0.8);
    }

    // ── Son de connexion (login) ──
    // Ton chaleureux accueillant, style "bienvenue"
    function playLogin() {
        const ctx = getContext();
        const now = ctx.currentTime;

        // Accord majeur chaud + sweep
        const freqs = [261.63, 329.63, 392.00]; // C4, E4, G4
        freqs.forEach((freq, i) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = i === 0 ? 'sine' : 'triangle';
            osc.frequency.setValueAtTime(freq * 0.98, now);
            osc.frequency.linearRampToValueAtTime(freq, now + 0.1);

            gain.gain.setValueAtTime(0, now);
            gain.gain.linearRampToValueAtTime(0.15, now + 0.05);
            gain.gain.setValueAtTime(0.15, now + 0.2);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.start(now);
            osc.stop(now + 0.85);
        });

        // Sweep ascendant subtil
        const sweep = ctx.createOscillator();
        const sweepGain = ctx.createGain();
        sweep.type = 'sine';
        sweep.frequency.setValueAtTime(200, now);
        sweep.frequency.exponentialRampToValueAtTime(800, now + 0.3);
        sweepGain.gain.setValueAtTime(0.05, now);
        sweepGain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
        sweep.connect(sweepGain);
        sweepGain.connect(ctx.destination);
        sweep.start(now);
        sweep.stop(now + 0.5);
    }

    // ── Son de notification ──
    // Ping court et net, style alerte
    function playNotification() {
        const ctx = getContext();
        const now = ctx.currentTime;

        // Double ping
        [0, 0.12].forEach((offset, i) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(i === 0 ? 880 : 1108.73, now + offset); // A5, C#6

            gain.gain.setValueAtTime(0, now + offset);
            gain.gain.linearRampToValueAtTime(0.2, now + offset + 0.01);
            gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.25);

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.start(now + offset);
            osc.stop(now + offset + 0.3);
        });
    }

    return {
        playValidation,
        playLogin,
        playNotification
    };
})();
