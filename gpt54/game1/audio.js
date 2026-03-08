(() => {
  const MoonDew = (window.MoonDew = window.MoonDew || {});
  const { clamp, randomRange } = MoonDew.math;

  class AudioManager {
    constructor() {
      this.context = null;
      this.master = null;
      this.music = null;
      this.started = false;
      this.levelHue = 0.5;
      this.dryness = 0;
      this.energy = 0.2;
      this.lastPulseTime = 0;
    }

    ensureStarted() {
      if (this.started) {
        if (this.context.state === "suspended") {
          this.context.resume().catch(() => {});
        }
        return;
      }

      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) {
        return;
      }

      this.context = new AudioContextClass();
      this.master = this.context.createGain();
      this.master.gain.value = 0.18;
      this.master.connect(this.context.destination);

      this.music = this.createMusicBus();
      this.music.output.connect(this.master);
      this.started = true;
    }

    createMusicBus() {
      const ctx = this.context;
      const output = ctx.createGain();
      output.gain.value = 1;

      const drone = ctx.createOscillator();
      drone.type = "triangle";
      drone.frequency.value = 167;

      const droneGain = ctx.createGain();
      droneGain.gain.value = 0.06;

      const shimmer = ctx.createOscillator();
      shimmer.type = "sine";
      shimmer.frequency.value = 332;

      const shimmerGain = ctx.createGain();
      shimmerGain.gain.value = 0.018;

      const lfo = ctx.createOscillator();
      lfo.type = "sine";
      lfo.frequency.value = 0.12;

      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 24;

      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 980;
      filter.Q.value = 0.7;

      lfo.connect(lfoGain);
      lfoGain.connect(shimmer.frequency);

      drone.connect(droneGain);
      shimmer.connect(shimmerGain);
      droneGain.connect(filter);
      shimmerGain.connect(filter);
      filter.connect(output);

      drone.start();
      shimmer.start();
      lfo.start();

      return {
        output,
        drone,
        droneGain,
        shimmer,
        shimmerGain,
        filter,
      };
    }

    setLevel(level) {
      if (!this.started) {
        return;
      }

      const signature = (level.index - 1) * 2;
      const baseFreq = 148 * Math.pow(2, signature / 12);
      this.music.drone.frequency.setTargetAtTime(baseFreq, this.context.currentTime, 0.3);
      this.music.shimmer.frequency.setTargetAtTime(baseFreq * 2, this.context.currentTime, 0.35);
    }

    update(dt, state) {
      if (!this.started) {
        return;
      }

      this.dryness = clamp(state.dryness || 0, 0, 1);
      this.energy = clamp(state.energy || 0, 0, 1);

      const now = this.context.currentTime;
      const filterTarget = 620 + this.energy * 700 - this.dryness * 170;
      const droneTarget = 0.05 + this.energy * 0.05 - this.dryness * 0.018;
      const shimmerTarget = 0.012 + this.energy * 0.038;

      this.music.filter.frequency.setTargetAtTime(filterTarget, now, 0.45);
      this.music.droneGain.gain.setTargetAtTime(droneTarget, now, 0.42);
      this.music.shimmerGain.gain.setTargetAtTime(shimmerTarget, now, 0.46);

      this.lastPulseTime -= dt;
      if (state.progressPulse && this.lastPulseTime <= 0) {
        this.playBell(0.12, 660 + state.progressPulse * 240, 0.16, "triangle");
        this.lastPulseTime = 0.12;
      }
    }

    playDash(strength) {
      if (!this.started) {
        return;
      }
      this.playBell(0.08, 240 + strength * 120, 0.18, "triangle");
      this.playNoise(0.035, 0.06 + strength * 0.04, 820);
    }

    playBud() {
      if (!this.started) {
        return;
      }
      this.playBell(0.09, 520 + randomRange(-18, 24), 0.18, "sine");
      this.playBell(0.13, 780 + randomRange(-18, 24), 0.1, "triangle");
    }

    playWither() {
      if (!this.started) {
        return;
      }
      this.playBell(0.14, 210, 0.07, "sawtooth");
      this.playNoise(0.06, 0.05, 280);
    }

    playBasin() {
      if (!this.started) {
        return;
      }
      this.playBell(0.18, 430, 0.18, "triangle");
      this.playBell(0.24, 645, 0.12, "sine");
    }

    playMoonDrop() {
      if (!this.started) {
        return;
      }
      this.playBell(0.1, 930, 0.13, "sine");
    }

    playReset() {
      if (!this.started) {
        return;
      }
      this.playBell(0.08, 290, 0.08, "triangle");
      this.playNoise(0.06, 0.04, 360);
    }

    playVictory() {
      if (!this.started) {
        return;
      }
      this.playBell(0.28, 523, 0.18, "sine");
      this.playBell(0.42, 784, 0.16, "triangle");
      this.playBell(0.62, 1046, 0.12, "sine");
    }

    playBell(delay, frequency, volume, type) {
      const ctx = this.context;
      const now = ctx.currentTime + delay;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = type || "sine";
      osc.frequency.setValueAtTime(frequency, now);
      osc.frequency.exponentialRampToValueAtTime(frequency * 0.995, now + 0.5);

      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(volume, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.2);

      osc.connect(gain);
      gain.connect(this.master);
      osc.start(now);
      osc.stop(now + 1.4);
    }

    playNoise(delay, volume, cutoff) {
      const ctx = this.context;
      const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.25), ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let index = 0; index < data.length; index += 1) {
        data[index] = (Math.random() * 2 - 1) * (1 - index / data.length);
      }

      const source = ctx.createBufferSource();
      source.buffer = buffer;

      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = cutoff;

      const gain = ctx.createGain();
      const now = ctx.currentTime + delay;
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(volume, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);

      source.connect(filter);
      filter.connect(gain);
      gain.connect(this.master);
      source.start(now);
      source.stop(now + 0.22);
    }
  }

  MoonDew.AudioManager = AudioManager;
})();
