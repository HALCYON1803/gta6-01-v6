// Every sound in Sunset Bay is synthesized with WebAudio — no audio
// files, no network requests. The radio stations in radio.js mix into
// the same master gain node created here.
export function createAudio() {
  let ctx = null;
  let master = null;
  let muted = false;
  let engineOsc = null;
  let engineGain = null;
  let sirenTimer = null;
  let sirenOn = false;

  // Lazily build the context on first use: browsers only allow audio
  // after a user gesture, so creating it at load time would stay suspended.
  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
    } catch (_) { return false; }
    return true;
  }

  // One short oscillator blip, optionally sliding down in pitch.
  function playTone(freq, dur, type, vol, slideTo) {
    if (!ensure() || muted) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    g.gain.setValueAtTime(vol || 0.2, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g);
    g.connect(master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  // Filtered white-noise burst: gunshots, crashes, explosions.
  function playNoise(dur, vol, lowFreq) {
    if (!ensure() || muted) return;
    const t = ctx.currentTime;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = lowFreq || 1800;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol || 0.35, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(filter);
    filter.connect(g);
    g.connect(master);
    src.start(t);
  }

  const api = {
    unlock() { if (ensure() && ctx.state === 'suspended') ctx.resume(); },
    context() { ensure(); return ctx; },
    masterGain() { ensure(); return master; },
    isMuted() { return muted; },
    setMuted(m) {
      muted = m;
      if (master) master.gain.value = m ? 0 : 0.5;
      if (m) api.stopSiren();
    },
    shoot() { playNoise(0.16, 0.5, 2600); playTone(180, 0.1, 'square', 0.18, 60); },
    reload() {
      playTone(500, 0.07, 'square', 0.12);
      setTimeout(() => playTone(700, 0.07, 'square', 0.12), 120);
    },
    click() { playTone(880, 0.05, 'sine', 0.15); },
    blip() { playTone(1200, 0.06, 'sine', 0.14); },
    chime() {
      playTone(660, 0.14, 'sine', 0.22);
      setTimeout(() => playTone(990, 0.2, 'sine', 0.22), 140);
    },
    missionDone() {
      [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => playTone(f, 0.22, 'triangle', 0.25), i * 130));
    },
    explosion() { playNoise(0.7, 0.7, 500); playTone(70, 0.6, 'sine', 0.4, 30); },
    crash() { playNoise(0.25, 0.4, 900); },
    horn() { playTone(370, 0.25, 'square', 0.12); playTone(466, 0.25, 'square', 0.1); },
    cash() {
      playTone(1320, 0.09, 'sine', 0.2);
      setTimeout(() => playTone(1760, 0.12, 'sine', 0.2), 90);
    },
    startEngine(speed01) {
      if (!ensure() || muted) return;
      if (!engineOsc) {
        engineOsc = ctx.createOscillator();
        engineOsc.type = 'sawtooth';
        engineGain = ctx.createGain();
        engineGain.gain.value = 0;
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 700;
        engineOsc.connect(filter);
        filter.connect(engineGain);
        engineGain.connect(master);
        engineOsc.start();
      }
      const s = Math.max(0, Math.min(1, speed01 || 0));
      engineOsc.frequency.setValueAtTime(55 + s * 140, ctx.currentTime);
      engineGain.gain.setTargetAtTime(0.02 + s * 0.05, ctx.currentTime, 0.1);
    },
    stopEngine() {
      if (engineGain) engineGain.gain.setTargetAtTime(0, ctx.currentTime, 0.1);
    },
    startSiren() {
      if (sirenOn || !ensure()) return;
      sirenOn = true;
      let high = false;
      sirenTimer = setInterval(() => {
        if (muted) return;
        high = !high;
        playTone(high ? 950 : 700, 0.34, 'sine', 0.07);
      }, 360);
    },
    stopSiren() {
      sirenOn = false;
      if (sirenTimer) {
        clearInterval(sirenTimer);
        sirenTimer = null;
      }
    },
  };
  return api;
}
