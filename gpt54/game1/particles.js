(() => {
  const MoonDew = (window.MoonDew = window.MoonDew || {});
  const { randomRange, TAU, damp } = MoonDew.math;

  class ParticleSystem {
    constructor() {
      this.items = [];
    }

    update(dt) {
      for (let index = this.items.length - 1; index >= 0; index -= 1) {
        const particle = this.items[index];
        particle.life -= dt;
        if (particle.life <= 0) {
          this.items.splice(index, 1);
          continue;
        }

        particle.x += particle.vx * dt;
        particle.y += particle.vy * dt;
        particle.vx *= Math.exp(-particle.drag * dt);
        particle.vy *= Math.exp(-particle.drag * dt);
        particle.vy += particle.gravity * dt;
        particle.size = damp(particle.size, particle.targetSize, particle.sizeSmoothing, dt);
        particle.rotation += particle.spin * dt;
      }
    }

    spawn(type, options) {
      this.items.push({
        type,
        x: options.x,
        y: options.y,
        vx: options.vx || 0,
        vy: options.vy || 0,
        gravity: options.gravity || 0,
        life: options.life || 1,
        maxLife: options.life || 1,
        size: options.size || 6,
        targetSize: options.targetSize || options.size || 6,
        sizeSmoothing: options.sizeSmoothing || 4,
        drag: options.drag || 3,
        rotation: options.rotation || 0,
        spin: options.spin || 0,
        alpha: options.alpha == null ? 1 : options.alpha,
        color: options.color || "rgba(255,255,255,0.8)",
        glow: options.glow || 0,
      });
    }

    burst(options = {}) {
      const count = options.count || 12;
      for (let index = 0; index < count; index += 1) {
        const angle = randomRange(0, TAU);
        const speed = randomRange(options.speedMin || 24, options.speedMax || 92);
        this.spawn(options.type || "dew", {
          x: options.x,
          y: options.y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - randomRange(0, 20),
          gravity: options.gravity || 8,
          life: randomRange(options.lifeMin || 0.45, options.lifeMax || 1.1),
          size: randomRange(options.sizeMin || 2, options.sizeMax || 6),
          targetSize: randomRange(options.targetSizeMin || 0.5, options.targetSizeMax || 3.5),
          drag: options.drag || 2.4,
          spin: randomRange(-2.4, 2.4),
          color: options.color,
          alpha: options.alpha,
          glow: options.glow || 8,
        });
      }
    }

    spawnTrail(x, y, color) {
      this.spawn("trail", {
        x,
        y,
        vx: randomRange(-6, 6),
        vy: randomRange(-12, 6),
        gravity: -2,
        life: randomRange(0.24, 0.48),
        size: randomRange(2, 5),
        targetSize: 0.2,
        drag: 4,
        color,
        alpha: 0.88,
        glow: 12,
      });
    }

    spawnMoth(x, y) {
      this.spawn("moth", {
        x,
        y,
        vx: randomRange(-12, 12),
        vy: randomRange(-16, 8),
        gravity: -1,
        life: randomRange(1.8, 3.2),
        size: randomRange(3, 6),
        targetSize: randomRange(2, 4),
        drag: 1.2,
        spin: randomRange(-1.6, 1.6),
        color: "rgba(255, 240, 198, 0.82)",
        alpha: 0.85,
        glow: 10,
      });
    }
  }

  MoonDew.ParticleSystem = ParticleSystem;
})();
