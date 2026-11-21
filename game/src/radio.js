// In-car radio: three stations, all synthesized live with WebAudio — no
// audio files, no network. A tiny step sequencer plays a bass line and a
// lead line per station; Q cycles stations, and the HUD shows what is playing.
import { RADIO_STATIONS } from './config.js';

const MINOR = [0, 2, 3, 5, 7, 8, 10];
const MAJOR = [0, 2, 4, 5, 7, 9, 11];
// 16-step patterns: scale degree, or -1 for a rest. Bass sits an octave down.
const PATTERNS = {
  bayfm: {
    bass: [0, -1, -1, 0, -1, -1, 3, -1, 0, -1, -1, 0, -1, 5, -1, -1],
    lead: [7, -1, 5, -1, 7, -1, 10, -1, 7, -1, 8, -1, 5, -1, 3, -1],
  },
  neon: {
    bass: [0, 0, -1, 0, -1, 0, 3, -1, 0, 0, -1, 0, 5, -1, 3, -1],
    lead: [10, -1, 7, 10, -1, 12, -1, 10, 7, -1, 5, 7, -1, 10, -1, 12],
  },
  palmtree: {
    bass: [0, -1, 0, -1, 4, -1, 0, -1, 0, -1, 5, -1, 4, -1, 0, -1],
    lead: [4, -1, -1, 7, -1, -1, 9, -1, 7, -1, -1, 4, -1, 2, -1, -1],
  },
};

// Frequency of a scale degree above a root note, at an octave multiplier.
function freqOf(root, scale, degree, octave) {
  const semis = scale[((degree % scale.length) + scale.length) % scale.length] + 12 * Math.floor(degree / scale.length);
  return root * Math.pow(2, semis / 12) * octave;
}

export function createRadio(world) {
  let stationIndex = 0;
  let timer = null;
  let step = 0;
  let nextTime = 0;

  function station() { return RADIO_STATIONS[stationIndex]; }

  function playNote(freq, at, dur, type, vol) {
    const ctx = world.audio.context();
    const master = world.audio.masterGain();
    if (!ctx || !master || world.audio.isMuted()) return;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, at);
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(vol, at + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    o.connect(g);
    g.connect(master);
    o.start(at);
    o.stop(at + dur + 0.05);
  }

  // Schedule every step that falls inside the next quarter-second window.
  function scheduler() {
    const ctx = world.audio.context();
    if (!ctx) return;
    const st = station();
    const scale = st.mode === 'major' ? MAJOR : MINOR;
    const stepDur = 60 / st.bpm / 4;
    while (nextTime < ctx.currentTime + 0.25) {
      const pat = PATTERNS[st.id];
      const bassDeg = pat.bass[step % 16];
      const leadDeg = pat.lead[step % 16];
      if (bassDeg >= 0) playNote(freqOf(st.root, scale, bassDeg, 0.5), nextTime, stepDur * 1.8, 'triangle', 0.16);
      if (leadDeg >= 0) playNote(freqOf(st.root, scale, leadDeg, 2), nextTime, stepDur * 0.9, 'square', 0.045);
      if (step % 4 === 0) playNote(1800, nextTime, 0.03, 'sine', 0.02); // ticking hat
      nextTime += stepDur;
      step += 1;
    }
  }

  const api = {
    current() { return station(); },
    label() { const st = station(); return `${st.name} — ${st.tag}`; },
    start() {
      world.audio.unlock();
      const ctx = world.audio.context();
      if (!ctx) return;
      if (timer) return;
      nextTime = ctx.currentTime + 0.1;
      step = 0;
      timer = setInterval(scheduler, 90);
      world.hud.setRadio(this.label());
    },
    stop() {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
      world.hud.setRadio('Radio off — press Q');
    },
    next() {
      stationIndex = (stationIndex + 1) % RADIO_STATIONS.length;
      step = 0;
      const ctx = world.audio.context();
      if (ctx) nextTime = ctx.currentTime + 0.05;
      if (!timer) this.start();
      else world.hud.setRadio(this.label());
      world.toast(`♪ ${this.label()}`);
      world.audio.blip();
    },
    setMuted(m) {
      if (m) {
        if (timer) {
          clearInterval(timer);
          timer = null;
        }
      } else if (!timer) {
        this.start();
      }
    },
  };
  return api;
}
