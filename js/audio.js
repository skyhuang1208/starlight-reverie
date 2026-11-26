// Procedural Dreamy Fantasy Synth Engine (5 Unique Map Themes + Intense Boss Music + Rate-Limited Smooth SFX)
window.SR = window.SR || {};

(function (SR) {
  const BGM_THEMES = {
    meadow: {
      tempoMs: 185,
      leadWave: 'triangle', arpWave: 'sine', bassWave: 'triangle',
      leadVol: 0.068, arpVol: 0.036, bassVol: 0.055, shimmer: true,
      lead: [698.46, 0, 783.99, 880.0, 1046.5, 0, 987.77, 880.0, 783.99, 0, 698.46, 659.25, 587.33, 659.25, 783.99, 0],
      arp:  [349.23, 440.0, 523.25, 659.25, 392.0, 493.88, 587.33, 783.99, 329.63, 440.0, 523.25, 659.25, 293.66, 392.0, 493.88, 587.33],
      bass: [174.61, 0, 0, 174.61, 196.0, 0, 0, 196.0, 164.81, 0, 0, 164.81, 146.83, 0, 196.0, 0]
    },
    cloudspire: {
      tempoMs: 170,
      leadWave: 'sine', arpWave: 'triangle', bassWave: 'sine',
      leadVol: 0.072, arpVol: 0.038, bassVol: 0.06, shimmer: true,
      lead: [783.99, 880.0, 987.77, 1174.66, 0, 987.77, 1174.66, 1318.51, 1174.66, 987.77, 880.0, 783.99, 880.0, 987.77, 783.99, 0],
      arp:  [392.0, 493.88, 587.33, 783.99, 329.63, 493.88, 659.25, 783.99, 261.63, 392.0, 523.25, 659.25, 293.66, 440.0, 587.33, 739.99],
      bass: [196.0, 0, 196.0, 0, 164.81, 0, 164.81, 0, 130.81, 0, 130.81, 0, 146.83, 0, 146.83, 0]
    },
    duskwoods: {
      tempoMs: 180,
      leadWave: 'triangle', arpWave: 'sine', bassWave: 'triangle',
      leadVol: 0.068, arpVol: 0.04, bassVol: 0.06, shimmer: true,
      lead: [587.33, 0, 698.46, 880.0, 987.77, 880.0, 698.46, 659.25, 587.33, 659.25, 698.46, 0, 880.0, 783.99, 659.25, 0],
      arp:  [293.66, 349.23, 440.0, 587.33, 246.94, 349.23, 493.88, 587.33, 261.63, 329.63, 392.0, 523.25, 220.0, 329.63, 440.0, 523.25],
      bass: [146.83, 0, 0, 146.83, 123.47, 0, 0, 123.47, 130.81, 0, 0, 130.81, 110.0, 0, 164.81, 0]
    },
    frostmoon: {
      tempoMs: 162,
      leadWave: 'sine', arpWave: 'sine', bassWave: 'triangle',
      leadVol: 0.07, arpVol: 0.044, bassVol: 0.058, shimmer: true,
      lead: [659.25, 783.99, 987.77, 1318.51, 1174.66, 987.77, 783.99, 739.99, 659.25, 739.99, 783.99, 987.77, 932.33, 739.99, 659.25, 0],
      arp:  [329.63, 392.0, 493.88, 659.25, 293.66, 392.0, 587.33, 783.99, 261.63, 329.63, 493.88, 659.25, 246.94, 369.99, 493.88, 739.99],
      bass: [164.81, 0, 164.81, 0, 146.83, 0, 146.83, 0, 130.81, 0, 130.81, 0, 123.47, 0, 185.0, 0]
    },
    hell: {
      tempoMs: 150,
      leadWave: 'triangle', arpWave: 'triangle', bassWave: 'sawtooth',
      leadVol: 0.072, arpVol: 0.036, bassVol: 0.042, shimmer: false, pulsePerc: true,
      lead: [523.25, 622.25, 783.99, 830.61, 783.99, 622.25, 587.33, 493.88, 523.25, 783.99, 987.77, 1046.5, 987.77, 830.61, 783.99, 0],
      arp:  [261.63, 311.13, 392.0, 523.25, 207.65, 311.13, 415.3, 523.25, 196.0, 293.66, 392.0, 493.88, 246.94, 311.13, 392.0, 587.33],
      bass: [130.81, 130.81, 0, 130.81, 103.83, 103.83, 0, 103.83, 98.0, 98.0, 0, 123.47, 130.81, 0, 98.0, 0]
    },
    boss: {
      tempoMs: 132,
      leadWave: 'triangle', arpWave: 'sine', bassWave: 'sawtooth',
      leadVol: 0.082, arpVol: 0.042, bassVol: 0.048, shimmer: false, pulsePerc: true,
      lead: [659.25, 0, 783.99, 880.0, 987.77, 880.0, 783.99, 659.25, 622.25, 659.25, 783.99, 987.77, 1046.5, 987.77, 880.0, 783.99],
      arp:  [329.63, 440.0, 493.88, 659.25, 329.63, 440.0, 523.25, 659.25, 293.66, 392.0, 493.88, 587.33, 311.13, 392.0, 493.88, 622.25],
      bass: [164.81, 164.81, 0, 164.81, 146.83, 146.83, 0, 146.83, 130.81, 130.81, 0, 130.81, 123.47, 123.47, 146.83, 155.56]
    },
    hell_boss: {
      tempoMs: 118,
      leadWave: 'triangle', arpWave: 'triangle', bassWave: 'sawtooth',
      leadVol: 0.086, arpVol: 0.044, bassVol: 0.052, shimmer: false, pulsePerc: true,
      lead: [523.25, 622.25, 783.99, 1046.5, 987.77, 830.61, 783.99, 622.25, 587.33, 622.25, 783.99, 987.77, 1244.51, 1046.5, 987.77, 783.99],
      arp:  [261.63, 311.13, 392.0, 523.25, 246.94, 311.13, 392.0, 493.88, 207.65, 261.63, 311.13, 415.3, 196.0, 293.66, 392.0, 493.88],
      bass: [130.81, 130.81, 130.81, 0, 123.47, 123.47, 123.47, 0, 103.83, 103.83, 103.83, 0, 98.0, 98.0, 116.54, 123.47]
    }
  };

  class AudioEngine {
    constructor() {
      this.ctx = null;
      this.muted = false;
      this.master = null;
      this.compressor = null;
      this.bgmTimer = null;
      this.bgmStep = 0;
      this.bgmMode = 'meadow';
      this.sfxLastPlayed = Object.create(null);
    }

    init() {
      if (this.ctx) {
        if (this.ctx.state === 'suspended') {
          this.ctx.resume().catch(() => {});
        }
        return;
      }
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.34;

      // Soft dynamics compressor keeps multi-hit combat & BGM lush without harsh clipping!
      if (this.ctx.createDynamicsCompressor) {
        this.compressor = this.ctx.createDynamicsCompressor();
        this.compressor.threshold.value = -16;
        this.compressor.knee.value = 18;
        this.compressor.ratio.value = 6;
        this.compressor.attack.value = 0.004;
        this.compressor.release.value = 0.14;
        this.master.connect(this.compressor);
        this.compressor.connect(this.ctx.destination);
      } else {
        this.master.connect(this.ctx.destination);
      }
    }

    // Per-SFX rate limiter prevents harsh waveform stacking on multi-hit shotgun/cyclone frames
    canPlaySfx(key, minGapMs = 45) {
      const now = performance.now();
      const prev = this.sfxLastPlayed[key] || 0;
      if (now - prev < minGapMs) return false;
      this.sfxLastPlayed[key] = now;
      return true;
    }

    toggleMute() {
      this.muted = !this.muted;
      if (this.master && this.ctx) {
        this.master.gain.setTargetAtTime(this.muted ? 0 : 0.34, this.ctx.currentTime, 0.04);
      }
      return this.muted;
    }

    playTone(freq, duration, type = 'sine', vol = 0.25, slideTo = null, delay = 0) {
      if (this.muted || !this.ctx || !this.master || !freq) return;
      const now = this.ctx.currentTime + delay;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, now);
      if (slideTo) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), now + duration);
      }
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(vol, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

      osc.connect(gain);
      gain.connect(this.master);
      osc.start(now);
      osc.stop(now + duration + 0.02);
    }

    playFilteredTone(freq, duration, type = 'sawtooth', vol = 0.06, cutoff = 520) {
      if (this.muted || !this.ctx || !this.master || !freq) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const filter = this.ctx.createBiquadFilter();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, now);
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(cutoff, now);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(vol, now + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.master);
      osc.start(now);
      osc.stop(now + duration + 0.02);
    }

    playNoise(duration, vol = 0.14, highpass = 1200) {
      if (this.muted || !this.ctx || !this.master) return;
      const bufferSize = Math.max(64, Math.floor(this.ctx.sampleRate * duration));
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
      }
      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.value = highpass;

      const gain = this.ctx.createGain();
      const now = this.ctx.currentTime;
      gain.gain.setValueAtTime(vol, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.master);
      noise.start(now);
    }

    // ==================== SFX LIBRARY ====================
    jump(isDouble = false) {
      this.init();
      if (isDouble) {
        this.playTone(540, 0.16, 'triangle', 0.18, 920);
        this.playTone(810, 0.14, 'sine', 0.14, 1240, 0.04);
      } else {
        this.playTone(350, 0.14, 'sine', 0.2, 650);
      }
    }

    land() {
      if (!this.canPlaySfx('land', 90)) return;
      this.init();
      this.playTone(135, 0.08, 'sine', 0.09, 68);
    }

    slide() {
      if (!this.canPlaySfx('slide', 70)) return;
      this.init();
      this.playNoise(0.16, 0.13, 1800);
      this.playTone(460, 0.14, 'triangle', 0.11, 230);
    }

    slash(combo = 1) {
      if (!this.canPlaySfx('slash', 55)) return;
      this.init();
      const base = 520 + combo * 110;
      this.playNoise(0.11, 0.15, 2200);
      this.playTone(base, 0.13, 'triangle', 0.17, base * 0.45);
      if (combo >= 3) {
        this.playTone(980, 0.22, 'sine', 0.15, 1480, 0.03);
      }
    }

    katanaGlint() {
      if (!this.canPlaySfx('glint', 120)) return;
      this.init();
      this.playTone(1480, 0.22, 'sine', 0.14, 2240);
      this.playTone(2217, 0.18, 'triangle', 0.09, 2637, 0.05);
    }

    sneeze() {
      if (!this.canPlaySfx('sneeze', 150)) return;
      this.init();
      this.playNoise(0.22, 0.2, 1600);
      this.playTone(760, 0.14, 'triangle', 0.16, 260);
      this.playTone(420, 0.18, 'sine', 0.11, 180, 0.04);
    }

    bark() {
      if (!this.canPlaySfx('bark', 120)) return;
      this.init();
      this.playTone(420, 0.09, 'sawtooth', 0.14, 620);
      this.playTone(540, 0.12, 'triangle', 0.15, 220, 0.04);
      this.playNoise(0.08, 0.11, 1400);
    }

    wokSizzle() {
      if (!this.canPlaySfx('wok', 140)) return;
      this.init();
      this.playNoise(0.28, 0.16, 2600);
      this.playTone(620, 0.09, 'triangle', 0.14, 980);
      this.playTone(840, 0.11, 'sine', 0.12, 1180, 0.08);
    }

    stockBell() {
      if (!this.canPlaySfx('bell', 150)) return;
      this.init();
      this.playTone(1046.5, 0.26, 'sine', 0.16);
      this.playTone(1567.98, 0.3, 'triangle', 0.12, null, 0.05);
      this.playTone(2093.0, 0.28, 'sine', 0.09, null, 0.1);
    }

    bounce() {
      if (!this.canPlaySfx('bounce', 80)) return;
      this.init();
      this.playTone(240, 0.09, 'sine', 0.11, 410);
    }

    shoot(heavy = false) {
      if (!this.canPlaySfx('shoot', 50)) return;
      this.init();
      if (heavy) {
        this.playTone(940, 0.18, 'triangle', 0.2, 360);
        this.playTone(1360, 0.16, 'sine', 0.14, 680, 0.02);
      } else {
        this.playTone(860, 0.09, 'sine', 0.14, 500);
      }
    }

    castMagic() {
      if (!this.canPlaySfx('magic', 60)) return;
      this.init();
      this.playTone(660, 0.18, 'sine', 0.14, 990);
      this.playTone(880, 0.2, 'triangle', 0.12, 1320, 0.04);
    }

    special() {
      this.init();
      [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((n, i) => {
        this.playTone(n, 0.26, 'sine', 0.15, n * 1.04, i * 0.042);
      });
    }

    ultimate() {
      this.init();
      [392.0, 523.25, 659.25, 783.99, 1046.5, 1318.5, 1567.98].forEach((n, i) => {
        this.playTone(n, 0.52, 'triangle', 0.15, n * 1.02, i * 0.045);
        this.playTone(n * 0.5, 0.56, 'sine', 0.11, null, i * 0.045);
      });
      this.playNoise(0.26, 0.13, 1600);
    }

    hit(heavy = false) {
      if (!this.canPlaySfx('hit', 48)) return;
      this.init();
      this.playTone(heavy ? 185 : 265, 0.1, 'triangle', heavy ? 0.15 : 0.11, 82);
      this.playNoise(0.055, 0.09, 1100);
    }

    deflect() {
      if (!this.canPlaySfx('deflect', 60)) return;
      this.init();
      this.playTone(1046, 0.15, 'sine', 0.18, 1568);
      this.playTone(1318, 0.12, 'triangle', 0.12, 1760, 0.03);
    }

    enemyDefeat() {
      if (!this.canPlaySfx('defeat', 60)) return;
      this.init();
      this.playTone(440, 0.12, 'triangle', 0.15, 660);
      this.playTone(660, 0.16, 'sine', 0.14, 988, 0.05);
    }

    playerHurt() {
      if (!this.canPlaySfx('hurt', 120)) return;
      this.init();
      this.playTone(260, 0.22, 'sawtooth', 0.12, 110);
      this.playTone(200, 0.24, 'triangle', 0.13, 90, 0.06);
    }

    pickup(isHeart = false) {
      if (!this.canPlaySfx('pickup', 40)) return;
      this.init();
      if (isHeart) {
        this.playTone(587.3, 0.14, 'sine', 0.17);
        this.playTone(783.9, 0.16, 'sine', 0.17, null, 0.07);
        this.playTone(1046.5, 0.24, 'sine', 0.17, null, 0.14);
      } else {
        this.playTone(880, 0.1, 'sine', 0.13);
        this.playTone(1174.6, 0.14, 'sine', 0.12, null, 0.05);
      }
    }

    checkpoint() {
      this.init();
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
        this.playTone(f, 0.3, 'sine', 0.15, null, i * 0.07);
      });
    }

    bossAlert() {
      this.init();
      this.playTone(329.6, 0.24, 'triangle', 0.17, 293.6);
      this.playTone(246.9, 0.34, 'triangle', 0.14, 185, 0.14);
      this.playTone(493.88, 0.28, 'sine', 0.11, 369.99, 0.2);
    }

    lightningCharge() {
      this.init();
      this.playTone(280, 0.45, 'sine', 0.1, 820);
      this.playTone(560, 0.48, 'triangle', 0.085, 1340, 0.38);
    }

    lightningStrike() {
      this.init();
      this.playNoise(0.26, 0.2, 650);
      this.playTone(190, 0.3, 'sawtooth', 0.12, 52);
      this.playTone(880, 0.12, 'triangle', 0.11, 220);
    }

    cyclone() {
      this.init();
      for (let i = 0; i < 4; i++) {
        this.playNoise(0.1, 0.11, 2400);
        this.playTone(580 + i * 120, 0.14, 'triangle', 0.13, 940 + i * 90, i * 0.13);
      }
    }

    victory() {
      this.init();
      const fanfare = [523.25, 659.25, 783.99, 1046.5, 987.77, 1046.5, 1318.5];
      fanfare.forEach((f, i) => {
        this.playTone(f, 0.38, 'sine', 0.17, null, i * 0.095);
        this.playTone(f * 0.5, 0.38, 'triangle', 0.1, null, i * 0.095);
      });
    }

    startBgm(mode = 'meadow') {
      this.init();
      const nextMode = BGM_THEMES[mode] ? mode : 'meadow';
      if (this.bgmTimer && this.bgmMode === nextMode) return;
      this.stopBgm();
      this.bgmMode = nextMode;
      this.bgmStep = 0;

      const theme = BGM_THEMES[this.bgmMode];
      this.bgmTimer = setInterval(() => {
        if (this.muted || !this.ctx || this.ctx.state !== 'running') return;
        const t = BGM_THEMES[this.bgmMode];
        const idx = this.bgmStep % t.lead.length;

        const leadFreq = t.lead[idx];
        if (leadFreq) {
          this.playTone(leadFreq, t.tempoMs * 0.0017, t.leadWave, t.leadVol);
          if (t.shimmer && idx % 4 === 0) {
            this.playTone(leadFreq * 2, t.tempoMs * 0.0012, 'sine', t.leadVol * 0.28);
          }
        }

        const arpFreq = t.arp[idx];
        if (arpFreq) {
          this.playTone(arpFreq, t.tempoMs * 0.0014, t.arpWave, t.arpVol);
        }

        const bassFreq = t.bass[idx];
        if (bassFreq) {
          if (t.bassWave === 'sawtooth') {
            this.playFilteredTone(bassFreq, t.tempoMs * 0.0016, 'sawtooth', t.bassVol, 420);
          } else {
            this.playTone(bassFreq, t.tempoMs * 0.0018, t.bassWave, t.bassVol);
          }
        }

        if (t.pulsePerc) {
          if (idx % 4 === 0) {
            this.playTone(115, 0.11, 'sine', 0.075, 48);
          } else if (idx % 2 === 1) {
            this.playNoise(0.035, 0.032, 5200);
          }
        } else if (idx % 4 === 2) {
          this.playNoise(0.03, 0.018, 6500);
        }

        this.bgmStep++;
      }, theme.tempoMs);
    }

    setBgmMode(mode) {
      const nextMode = BGM_THEMES[mode] ? mode : 'meadow';
      if (this.bgmMode !== nextMode || !this.bgmTimer) {
        this.startBgm(nextMode);
      }
    }

    stopBgm() {
      if (this.bgmTimer) {
        clearInterval(this.bgmTimer);
        this.bgmTimer = null;
      }
    }
  }

  SR.BGM_THEMES = BGM_THEMES;
  SR.audio = new AudioEngine();
})(window.SR);
