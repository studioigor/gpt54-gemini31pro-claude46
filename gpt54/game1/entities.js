(() => {
  const MoonDew = (window.MoonDew = window.MoonDew || {});
  const {
    clamp,
    damp,
    distance,
    distanceToSegment,
    ellipseFalloff,
    length,
    normalize,
    pointInEllipse,
    randomRange,
    sub,
  } = MoonDew.math;

  class Player {
    constructor(x, y) {
      this.pos = { x, y };
      this.vel = { x: 0, y: 0 };
      this.radius = 11;
      this.light = 0.78;
      this.maxTrailPoints = 140;
      this.trail = [];
      this.trailTimer = 0;
      this.checkpoint = { x, y };
      this.aura = 1;
      this.dashFlash = 0;
    }

    update(dt, session, pointerWorld) {
      const input = session.input;
      const surface = session.sampleSurface(this.pos);
      const target = pointerWorld || this.pos;
      const toTarget = sub(target, this.pos);
      const targetDistance = length(toTarget);
      const targetDir = targetDistance > 0.001 ? normalize(toTarget) : { x: 0, y: 0 };
      const pull = clamp(targetDistance / 170, 0, 1);
      const accel = 120 + pull * 760;

      if (input.pointer.inside || input.isDown) {
        this.vel.x += targetDir.x * accel * dt * surface.speed;
        this.vel.y += targetDir.y * accel * dt * surface.speed;
      }

      if (session.level.wind) {
        const wind = session.getWindAt(this.pos);
        this.vel.x += wind.x * dt;
        this.vel.y += wind.y * dt;
      }

      if (input.justReleased) {
        const charge = clamp((input.releasedHoldDuration - 0.08) / 0.9, 0, 1);
        if (charge > 0) {
          let dashDir = targetDistance > 8 ? targetDir : normalize(this.vel);
          if (length(dashDir) < 0.0001) {
            dashDir = { x: 1, y: 0 };
          }
          let dashForce = 190 + charge * 320;
          dashForce *= 1 - surface.webSlow * 0.48;
          this.vel.x += dashDir.x * dashForce;
          this.vel.y += dashDir.y * dashForce;
          this.dashFlash = 1;
          session.audio.playDash(charge);
          session.particles.burst({
            x: this.pos.x,
            y: this.pos.y,
            count: 8 + Math.round(charge * 12),
            speedMin: 26,
            speedMax: 120,
            lifeMin: 0.24,
            lifeMax: 0.7,
            sizeMin: 1.5,
            sizeMax: 3.8,
            glow: 16,
            color: session.level.palette.waterGlow,
          });
        }
      }

      const damping = surface.insideWater ? 2.1 : 3.7;
      const drag = Math.exp(-damping * dt);
      this.vel.x *= drag;
      this.vel.y *= drag;

      if (surface.webSlow > 0) {
        const webDrag = Math.exp(-surface.webSlow * 7.2 * dt);
        this.vel.x *= webDrag;
        this.vel.y *= webDrag;
      }

      this.pos.x += this.vel.x * dt;
      this.pos.y += this.vel.y * dt;

      const margin = 26;
      if (this.pos.x < margin) {
        this.pos.x = margin;
        this.vel.x *= -0.2;
      }
      if (this.pos.y < margin) {
        this.pos.y = margin;
        this.vel.y *= -0.2;
      }
      if (this.pos.x > session.level.world.width - margin) {
        this.pos.x = session.level.world.width - margin;
        this.vel.x *= -0.2;
      }
      if (this.pos.y > session.level.world.height - margin) {
        this.pos.y = session.level.world.height - margin;
        this.vel.y *= -0.2;
      }

      this.trailTimer -= dt;
      if (input.isDown) {
        const lastPoint = this.trail[this.trail.length - 1];
        const shouldAddPoint =
          !lastPoint ||
          distance(lastPoint, this.pos) > 12 ||
          this.trailTimer <= 0;

        if (shouldAddPoint) {
          this.trail.push({
            x: this.pos.x,
            y: this.pos.y,
            life: 0.72,
            maxLife: 0.72,
            width: 15 + this.light * 10,
          });
          this.trailTimer = 0.02;
          if (this.trail.length > this.maxTrailPoints) {
            this.trail.splice(0, this.trail.length - this.maxTrailPoints);
          }
          if (Math.random() < 0.45) {
            session.particles.spawnTrail(this.pos.x, this.pos.y, session.level.palette.waterGlow);
          }
        }
      }

      for (let index = this.trail.length - 1; index >= 0; index -= 1) {
        this.trail[index].life -= dt;
        if (this.trail[index].life <= 0) {
          this.trail.splice(index, 1);
        }
      }

      const lightDelta = surface.recover - surface.drain - (input.isDown ? 0.014 : 0);
      this.light = clamp(this.light + lightDelta * dt, 0, 1);
      this.aura = damp(this.aura, 0.65 + this.light * 0.55, 5, dt);
      this.dashFlash = Math.max(0, this.dashFlash - dt * 3.2);
    }

    setCheckpoint(x, y) {
      this.checkpoint.x = x;
      this.checkpoint.y = y;
    }

    restoreAtCheckpoint() {
      this.pos.x = this.checkpoint.x;
      this.pos.y = this.checkpoint.y;
      this.vel.x = 0;
      this.vel.y = 0;
      this.light = 0.78;
      this.trail.length = 0;
      this.dashFlash = 1;
    }

    draw(renderer, session) {
      renderer.drawPlayer(this, session);
    }
  }

  class Bud {
    constructor(data) {
      this.id = data.id;
      this.x = data.x;
      this.y = data.y;
      this.radius = data.radius;
      this.checkpoint = Boolean(data.checkpoint);
      this.weight = data.weight || 1;
      this.gate = data.gate || null;
      this.state = "sleeping";
      this.charge = 0;
      this.vitality = 0;
      this.open = 0;
      this.pulse = randomRange(0, Math.PI * 2);
      this.everAlive = false;
      this.justActivated = false;
    }

    isAlive() {
      return this.state === "alive";
    }

    isUnlocked(session) {
      return !this.gate || session.isGateOpen(this.gate);
    }

    getProgress() {
      if (this.state === "alive") {
        return 0.82 + this.vitality * 0.18;
      }
      if (this.state === "withering") {
        return 0.18 + this.vitality * 0.42;
      }
      return this.charge * 0.15;
    }

    activate(session) {
      const wasAlive = this.everAlive;
      this.state = "alive";
      this.vitality = 1;
      this.charge = 0.48;
      this.open = 1;
      this.everAlive = true;
      this.justActivated = true;
      session.onBudActivated(this, wasAlive);
    }

    sleep(session) {
      if (this.everAlive) {
        session.onBudWithered(this);
      }
      this.state = "sleeping";
      this.charge = 0;
      this.vitality = 0;
    }

    update(dt, session) {
      this.justActivated = false;
      this.pulse += dt * (0.8 + this.weight * 0.05);

      if (!this.isUnlocked(session) && !this.isAlive()) {
        this.charge = Math.max(0, this.charge - dt * 0.28);
        this.open = damp(this.open, 0, 5, dt);
        return;
      }

      const trailCharge = session.getTrailEnergyAt(this, this.radius + 26) * 1.2;
      const networkCharge = session.getNetworkCharge(this.id);
      const waterCharge = session.getWaterInfluenceAt(this) * 0.5;
      const localMoisture = session.getAmbientLifeAt(this);
      const shadow = session.getShadowInfluence(this);
      const source = trailCharge + networkCharge + waterCharge;

      if (this.state === "sleeping" || this.state === "withering") {
        this.charge = clamp(this.charge + source * dt * 1.1 - dt * 0.12, 0, 1.2);
        if (this.charge >= 1) {
          this.activate(session);
        }
      }

      if (this.state === "alive") {
        const vitalityDelta = localMoisture * 0.14 + source * 0.18 - 0.05 - shadow * 0.42;
        this.vitality = clamp(this.vitality + vitalityDelta * dt, 0, 1);
        if (this.vitality <= 0.16) {
          this.state = "withering";
          this.charge = 0.24;
          session.audio.playWither();
        }
      } else if (this.state === "withering") {
        this.vitality = clamp(this.vitality - dt * (0.08 + shadow * 0.14) + source * dt * 0.16, 0, 1);
        if (source > 0.7 && this.vitality > 0.2) {
          this.activate(session);
        } else if (this.vitality <= 0.01) {
          this.sleep(session);
        }
      }

      const targetOpen = this.isAlive() ? 1 : this.charge * 0.32;
      this.open = damp(this.open, targetOpen, 7, dt);
    }

    draw(renderer, session) {
      renderer.drawBud(this, session);
    }
  }

  class Link {
    constructor(data) {
      this.from = data.from;
      this.to = data.to;
      this.type = data.type || "leaf";
      this.gate = data.gate || null;
      this.flow = 0;
      this.dryness = 0;
    }

    isUnlocked(session) {
      return !this.gate || session.isGateOpen(this.gate);
    }

    getTransmission() {
      if (this.type === "water") {
        return 0.74;
      }
      if (this.type === "branch") {
        return 0.6;
      }
      if (this.type === "bridge") {
        return 0.56;
      }
      return 0.5;
    }

    update(dt, session) {
      const budA = session.budById[this.from];
      const budB = session.budById[this.to];
      const unlocked = this.isUnlocked(session);
      const sourceActive = unlocked && (budA.isAlive() || budB.isAlive());
      const targetFlow = sourceActive ? 1 : 0;
      const smoothing = this.type === "water" ? 4.6 : this.type === "bridge" ? 3 : 3.6;
      this.flow = damp(this.flow, targetFlow, smoothing, dt);

      const midPoint = { x: (budA.x + budB.x) * 0.5, y: (budA.y + budB.y) * 0.5 };
      const shadow = session.getShadowInfluence(midPoint);
      this.dryness = damp(this.dryness, shadow, 3.2, dt);

      if (!unlocked || this.flow < 0.04) {
        return;
      }

      const trailAlong = session.getTrailAlongSegment(budA, budB, 22);
      const transmission = this.getTransmission() * (1 - this.dryness * 0.42);
      const bridgeBoost = this.type === "bridge" ? 0.08 + trailAlong * 0.28 : 0;
      const waterBoost = this.type === "water" ? session.getWaterAlongSegment(budA, budB) * 0.24 : 0;
      const signal = (transmission + bridgeBoost + waterBoost) * this.flow;

      if (budA.isAlive() && !budB.isAlive()) {
        budB.charge = clamp(budB.charge + signal * dt, 0, 1.2);
      }
      if (budB.isAlive() && !budA.isAlive()) {
        budA.charge = clamp(budA.charge + signal * dt, 0, 1.2);
      }
    }

    draw(renderer, session) {
      renderer.drawLink(this, session);
    }
  }

  class WaterPool {
    constructor(data) {
      this.id = data.id;
      this.x = data.x;
      this.y = data.y;
      this.rx = data.rx;
      this.ry = data.ry;
      this.gate = data.gate || null;
      this.startOpen = Boolean(data.startOpen);
      this.brightness = this.startOpen ? 0.14 : 0;
      this.ripple = randomRange(0, Math.PI * 2);
    }

    isUnlocked(session) {
      return this.startOpen || !this.gate || session.isGateOpen(this.gate);
    }

    contains(point) {
      return pointInEllipse(point, this);
    }

    update(dt, session) {
      const unlocked = this.isUnlocked(session);
      if (!unlocked) {
        this.brightness = damp(this.brightness, 0, 5, dt);
        return;
      }

      const playerInside = this.contains(session.player.pos);
      const trailTouch = session.getTrailEnergyInEllipse(this);
      let aliveInside = 0;

      for (const bud of session.buds) {
        if (bud.isAlive() && this.contains(bud)) {
          aliveInside += 1;
        }
      }

      const targetBrightness = clamp(
        0.08 + aliveInside * 0.16 + trailTouch * 0.4 + (playerInside ? 0.32 : 0),
        0,
        1
      );

      this.brightness = damp(this.brightness, targetBrightness, 3.8, dt);
      this.ripple += dt * (0.6 + this.brightness * 1.8);
    }

    draw(renderer, session) {
      renderer.drawWater(this, session);
    }
  }

  class Basin {
    constructor(data) {
      this.id = data.id;
      this.x = data.x;
      this.y = data.y;
      this.radius = data.radius;
      this.required = data.required || 1.6;
      this.gate = data.gate;
      this.fill = 0;
      this.completed = false;
    }

    update(dt, session) {
      if (this.completed) {
        return;
      }

      const trail = session.getTrailEnergyAt(this, this.radius + 18);
      const playerDistance = distance(session.player.pos, this);
      const playerFactor = playerDistance < this.radius + 18 ? 0.38 : 0;
      this.fill = clamp(this.fill + (trail + playerFactor) * dt * 0.85 - dt * 0.02, 0, this.required);

      if (this.fill >= this.required) {
        this.completed = true;
        session.openGate(this.gate);
        session.player.setCheckpoint(this.x, this.y);
        session.audio.playBasin();
        session.particles.burst({
          x: this.x,
          y: this.y,
          count: 26,
          speedMin: 38,
          speedMax: 128,
          lifeMin: 0.5,
          lifeMax: 1.3,
          sizeMin: 2,
          sizeMax: 5.2,
          color: session.level.palette.waterGlow,
          glow: 18,
        });
      }
    }

    draw(renderer, session) {
      renderer.drawBasin(this, session);
    }
  }

  class MoonDrop {
    constructor(data) {
      this.x = data.x;
      this.y = data.y;
      this.radius = 11;
      this.collected = false;
      this.spin = randomRange(0, Math.PI * 2);
    }

    update(dt, session) {
      this.spin += dt * 1.7;
      if (this.collected) {
        return;
      }

      if (distance(session.player.pos, this) < this.radius + session.player.radius + 6) {
        this.collected = true;
        session.onMoonDropCollected(this);
      }
    }

    draw(renderer, session) {
      renderer.drawMoonDrop(this, session);
    }
  }

  class ShadowEntity {
    constructor(data) {
      this.nodes = data.nodes.slice();
      this.speed = data.speed || 82;
      this.radius = data.radius || 92;
      this.pos = { x: this.nodes[0].x, y: this.nodes[0].y };
      this.routeIndex = 1;
      this.lurePoint = null;
      this.lureTimer = 0;
      this.retargetCooldown = 0;
      this.pulse = randomRange(0, Math.PI * 2);
    }

    update(dt, session) {
      this.pulse += dt;
      this.retargetCooldown -= dt;
      if (session.input.isDown && this.retargetCooldown <= 0 && session.player.trail.length) {
        const point = session.player.trail[session.player.trail.length - 1];
        if (distance(this.pos, point) < 280) {
          this.lurePoint = { x: point.x, y: point.y };
          this.lureTimer = 1.15;
          this.retargetCooldown = 0.42;
        }
      }

      let target = this.nodes[this.routeIndex];
      if (this.lurePoint && this.lureTimer > 0) {
        target = this.lurePoint;
        this.lureTimer -= dt;
      } else {
        this.lurePoint = null;
      }

      const offset = sub(target, this.pos);
      const dist = length(offset);
      if (dist > 0.001) {
        const dir = normalize(offset);
        const step = Math.min(dist, this.speed * dt);
        this.pos.x += dir.x * step;
        this.pos.y += dir.y * step;
      }

      if (this.lurePoint) {
        if (distance(this.pos, this.lurePoint) < 8 || this.lureTimer <= 0) {
          this.lurePoint = null;
          this.lureTimer = 0;
        }
      } else if (distance(this.pos, target) < 8) {
        this.routeIndex = (this.routeIndex + 1) % this.nodes.length;
      }
    }

    getInfluence(point) {
      const value = clamp(1 - distance(this.pos, point) / this.radius, 0, 1);
      return value * value;
    }

    draw(renderer, session) {
      renderer.drawShadow(this, session);
    }
  }

  MoonDew.entities = {
    Player,
    Bud,
    Link,
    WaterPool,
    Basin,
    MoonDrop,
    ShadowEntity,
  };
})();
