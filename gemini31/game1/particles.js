import { Vec2 } from './math.js';

export const ParticleSystem = {
    particles: [],

    update(dt) {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            let p = this.particles[i];
            p.pos.add(p.vel.copy().mult(dt));
            p.life -= dt;
            p.alpha = p.life / p.maxLife;

            if (p.life <= 0) {
                this.particles.splice(i, 1);
            }
        }
    },

    draw(ctx) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (let p of this.particles) {
            ctx.beginPath();
            ctx.arc(p.pos.x, p.pos.y, p.size * p.alpha, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(${p.r}, ${p.g}, ${p.b}, ${p.alpha * 0.8})`;
            ctx.fill();
        }
        ctx.restore();
    },

    emit(x, y, count, config) {
        for (let i = 0; i < count; i++) {
            let angle = Math.random() * Math.PI * 2;
            let speed = (Math.random() * config.speedRange[1]) + config.speedRange[0];
            let life = (Math.random() * config.lifeRange[1]) + config.lifeRange[0];

            this.particles.push({
                pos: new Vec2(x, y),
                vel: new Vec2(Math.cos(angle) * speed, Math.sin(angle) * speed),
                life: life,
                maxLife: life,
                size: (Math.random() * config.sizeRange[1]) + config.sizeRange[0],
                r: config.color[0],
                g: config.color[1],
                b: config.color[2],
                alpha: 1
            });
        }
    }
};
