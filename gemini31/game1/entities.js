import { Vec2, distSq, lerp } from './math.js';
import { ParticleSystem } from './particles.js';
import { Input } from './input.js';

export class Player {
    constructor(x, y) {
        this.pos = new Vec2(x, y);
        this.vel = new Vec2(0, 0);
        this.radius = 8;
        this.light = 100;
        this.maxLight = 100;
        this.trail = [];
        this.trailLength = 40;

        this.dashCooldown = 0;
        this.isDashing = false;
        this.dashVel = new Vec2();
    }

    update(dt) {
        // Move towards input
        let target = new Vec2(Input.x, Input.y);
        let diff = target.copy().sub(this.pos);
        let dist = diff.mag();

        // Dash logic
        if (this.dashCooldown > 0) this.dashCooldown -= dt;

        if (Input.justReleased && this.trail.length > 5 && this.dashCooldown <= 0) {
            this.isDashing = true;
            this.dashCooldown = 1.0;
            let rushDir = diff.copy().normalize();
            this.dashVel = rushDir.mult(600);

            ParticleSystem.emit(this.pos.x, this.pos.y, 20, {
                speedRange: [100, 300],
                lifeRange: [0.3, 0.6],
                sizeRange: [2, 5],
                color: [252, 238, 167]
            });
        }

        if (this.isDashing) {
            this.vel = this.dashVel.copy();
            this.dashVel.mult(0.9); // friction
            if (this.dashVel.mag() < 50) this.isDashing = false;
        } else {
            // Normal movement
            if (dist > 5) {
                let speed = Math.min(dist * 5, 200); // max speed 200
                this.vel = diff.normalize().mult(speed);
            } else {
                this.vel.mult(0.8); // friction
            }
        }

        this.pos.add(this.vel.copy().mult(dt));

        // Trail recording
        if (Input.isDown || this.isDashing) {
            this.trail.unshift(this.pos.copy());
            if (this.trail.length > this.trailLength) {
                this.trail.pop();
            }
        } else {
            // Shrink trail if released
            if (this.trail.length > 0) {
                this.trail.pop();
            }
        }

        // Loose light passively slowly
        this.light -= dt * 2;
        if (this.light < 0) this.light = 0;
    }

    draw(ctx) {
        // Draw trail
        if (this.trail.length > 1) {
            ctx.beginPath();
            ctx.moveTo(this.trail[0].x, this.trail[0].y);
            for (let i = 1; i < this.trail.length; i++) {
                ctx.lineTo(this.trail[i].x, this.trail[i].y);
            }
            ctx.strokeStyle = `rgba(252, 238, 167, 0.6)`;
            ctx.lineWidth = 12;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.shadowColor = '#fceea7';
            ctx.shadowBlur = 10;
            ctx.stroke();
            ctx.shadowBlur = 0;
        }

        // Draw player
        ctx.beginPath();
        ctx.arc(this.pos.x, this.pos.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = '#fceea7';
        ctx.shadowColor = '#fceea7';
        ctx.shadowBlur = 15;
        ctx.fill();
        ctx.shadowBlur = 0;

        // Inner core
        ctx.beginPath();
        ctx.arc(this.pos.x, this.pos.y, this.radius * 0.5, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
    }
}

export class Bud {
    constructor(x, y, isMain = false) {
        this.pos = new Vec2(x, y);
        this.state = 'sleeping'; // sleeping, alive, dying
        this.life = 0; // 0 to 1
        this.radius = isMain ? 30 : 15;
        this.isMain = isMain;
    }

    update(dt, player, shadow) {
        if (this.state === 'sleeping' && !this.isMain) {
            // Check collision with player trail
            let awakened = false;
            for (let tp of player.trail) {
                if (distSq(this.pos.x, this.pos.y, tp.x, tp.y) < (this.radius * 2) ** 2) {
                    awakened = true;
                    break;
                }
            }

            if (awakened) {
                this.state = 'alive';
                ParticleSystem.emit(this.pos.x, this.pos.y, 15, {
                    speedRange: [20, 80],
                    lifeRange: [0.5, 1.0],
                    sizeRange: [1, 4],
                    color: [164, 206, 170]
                });
                player.light = Math.min(player.maxLight, player.light + 20); // heal
            }
        }

        if (this.state === 'alive') {
            this.life = Math.min(1, this.life + dt * 2);

            // Getting dried by shadow
            if (shadow && distSq(this.pos.x, this.pos.y, shadow.pos.x, shadow.pos.y) < shadow.radius ** 2) {
                this.state = 'dying';
            }
        } else if (this.state === 'dying') {
            this.life = Math.max(0, this.life - dt * 0.5);
            if (this.life <= 0) {
                this.state = 'sleeping'; // Reset
            }
        } else if (this.state === 'sleeping') {
            this.life = 0;
        }
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.pos.x, this.pos.y);

        if (this.state === 'alive') {
            ctx.shadowColor = '#a4ceaa';
            ctx.shadowBlur = 20 * this.life;
        }

        let color = lerpColor([120, 110, 100], [164, 206, 170], this.life);

        ctx.fillStyle = `rgb(${color[0]}, ${color[1]}, ${color[2]})`;

        // Draw flower shape
        ctx.beginPath();
        let numPetals = this.isMain ? 8 : 5;
        let pRadius = this.radius * (0.5 + 0.5 * this.life);
        for (let i = 0; i < numPetals; i++) {
            let angle = (i / numPetals) * Math.PI * 2;
            let px = Math.cos(angle) * pRadius;
            let py = Math.sin(angle) * pRadius;
            ctx.moveTo(0, 0);
            ctx.quadraticCurveTo(px + pRadius, py - pRadius, pRadius * 1.5 * Math.cos(angle), pRadius * 1.5 * Math.sin(angle));
            ctx.quadraticCurveTo(px - pRadius, py + pRadius, 0, 0);
        }
        ctx.fill();

        // Core
        ctx.beginPath();
        ctx.arc(0, 0, this.radius * 0.3, 0, Math.PI * 2);
        ctx.fillStyle = this.state === 'alive' ? '#fceea7' : '#555';
        ctx.fill();

        ctx.restore();
    }
}

export class Shadow {
    constructor(x, y) {
        this.pos = new Vec2(x, y);
        this.radius = 1;
        this.maxRadius = 300;
        this.speed = 20;
    }

    update(dt) {
        if (this.radius < this.maxRadius) {
            this.radius += this.speed * dt;
        }
    }

    draw(ctx) {
        let grad = ctx.createRadialGradient(this.pos.x, this.pos.y, 0, this.pos.x, this.pos.y, this.radius);
        grad.addColorStop(0, "rgba(20, 10, 10, 0.7)");
        grad.addColorStop(0.5, "rgba(40, 30, 20, 0.4)");
        grad.addColorStop(1, "rgba(0, 0, 0, 0)");

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(this.pos.x, this.pos.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
    }
}

// Helper to lerp colors
function lerpColor(c1, c2, t) {
    return [
        Math.floor(lerp(c1[0], c2[0], t)),
        Math.floor(lerp(c1[1], c2[1], t)),
        Math.floor(lerp(c1[2], c2[2], t))
    ];
}
