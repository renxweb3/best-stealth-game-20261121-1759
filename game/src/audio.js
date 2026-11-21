// Shadow Courier — procedural WebAudio effects. No audio files: every sound
// is a few oscillators shaped in code, so the game ships silent on disk.
export function createAudio() {
  let ctx = null;
  let muted = false;

  function ensure() {
    if (ctx) return ctx;
    try {
      const AC = window.AudioContext ?? window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    } catch {
      return null;
    }
    return ctx;
  }

  function tone(freq, dur, type, gain, when = 0, slideTo = 0) {
    if (muted) return;
    const ac = ensure();
    if (!ac) return;
    try {
      const t0 = ac.currentTime + when;
      const osc = ac.createOscillator();
      const amp = ac.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t0);
      if (slideTo > 0) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
      amp.gain.setValueAtTime(0.0001, t0);
      amp.gain.exponentialRampToValueAtTime(gain, t0 + 0.015);
      amp.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(amp);
      amp.connect(ac.destination);
      osc.start(t0);
      osc.stop(t0 + dur + 0.05);
    } catch {
      // Audio is decoration; a failure here must never stop the game.
    }
  }

  function resume() {
    const ac = ensure();
    if (ac && ac.state === 'suspended') ac.resume().catch(() => {});
  }

  return {
    resume,
    pickup() {
      tone(880, 0.09, 'sine', 0.16);
      tone(1318, 0.12, 'sine', 0.14, 0.07);
    },
    spotted() {
      tone(220, 0.28, 'sawtooth', 0.18, 0, 110);
      tone(233, 0.28, 'sawtooth', 0.14, 0, 116);
    },
    caught() {
      tone(392, 0.5, 'square', 0.14, 0, 98);
      tone(196, 0.6, 'sawtooth', 0.12, 0.08, 65);
    },
    clear() {
      tone(523, 0.12, 'sine', 0.15);
      tone(659, 0.12, 'sine', 0.15, 0.1);
      tone(784, 0.2, 'sine', 0.15, 0.2);
    },
    win() {
      const notes = [523, 659, 784, 1046, 1318];
      notes.forEach((n, i) => tone(n, 0.22, 'triangle', 0.16, i * 0.11));
    },
    toggleMute() {
      muted = !muted;
      return muted;
    },
    isMuted() {
      return muted;
    },
  };
}
