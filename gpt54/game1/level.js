(() => {
  const MoonDew = (window.MoonDew = window.MoonDew || {});
  const {
    clamp,
    damp,
    distance,
    distanceToSegment,
    ellipseFalloff,
    pointInEllipse,
    randomRange,
  } = MoonDew.math;
  const { Player, Bud, Link, WaterPool, Basin, MoonDrop, ShadowEntity } = MoonDew.entities;

  class LevelSession {
    constructor(level, systems) {
      this.level = level;
      this.input = systems.input;
      this.audio = systems.audio;
      this.particles = systems.particles;
      this.time = 0;
      this.progress = 0;
      this.progressPulse = 0;
      this.respawnCooldown = 0;
      this.flash = 0;
      this.openGates = new Set();

      this.player = new Player(level.start.x, level.start.y);
      this.player.setCheckpoint(level.start.x, level.start.y);

      this.buds = level.buds.map((bud) => new Bud(bud));
      this.budById = Object.fromEntries(this.buds.map((bud) => [bud.id, bud]));
      this.links = level.links.map((link) => new Link(link));
      this.waters = level.waters.map((water) => new WaterPool(water));
      this.basins = (level.basins || []).map((basin) => new Basin(basin));
      this.moonDrops = (level.moonDrops || []).map((drop) => new MoonDrop(drop));
      this.shadow = level.shadow ? new ShadowEntity(level.shadow) : null;

      this.flower = {
        x: level.flower.x,
        y: level.flower.y,
        radius: level.flower.radius,
        open: 0,
        pulse: randomRange(0, Math.PI * 2),
        ready: false,
      };

      this.stats = {
        awakenedUnique: 0,
        withered: 0,
        revived: 0,
        moonDrops: 0,
      };

      this.totalWeight = this.buds.reduce((sum, bud) => sum + bud.weight, 0);
      this.victory = false;
      this.victoryTimer = 0;
    }

    update(dt, pointerWorld) {
      this.time += dt;
      this.progressPulse = 0;
      this.flash = Math.max(0, this.flash - dt * 1.8);
      this.respawnCooldown = Math.max(0, this.respawnCooldown - dt);
      this.flower.pulse += dt;

      this.player.update(dt, this, pointerWorld);

      if (this.shadow) {
        this.shadow.update(dt, this);
      }

      for (const water of this.waters) {
        water.update(dt, this);
      }

      for (const basin of this.basins) {
        basin.update(dt, this);
      }

      for (const link of this.links) {
        link.update(dt, this);
      }

      for (const bud of this.buds) {
        bud.update(dt, this);
        if (bud.isAlive() && Math.random() < dt * 0.9) {
          this.particles.spawnMoth(
            bud.x + randomRange(-12, 12),
            bud.y + randomRange(-8, 10)
          );
        }
      }

      for (const drop of this.moonDrops) {
        drop.update(dt, this);
      }

      this.progress = this.totalWeight
        ? this.buds.reduce((sum, bud) => sum + bud.getProgress() * bud.weight, 0) / this.totalWeight
        : 0;

      const flowerTarget = clamp(
        (this.progress - this.level.victoryThreshold + 0.18) / 0.22,
        0,
        1
      );
      this.flower.open = damp(this.flower.open, flowerTarget, 2.2, dt);
      this.flower.ready = this.progress >= this.level.victoryThreshold;

      if (
        this.flower.ready &&
        !this.victory &&
        distance(this.player.pos, this.flower) < this.flower.radius * 0.58
      ) {
        this.victory = true;
        this.victoryTimer = 0;
        this.audio.playVictory();
        this.particles.burst({
          x: this.flower.x,
          y: this.flower.y,
          count: 42,
          speedMin: 44,
          speedMax: 136,
          lifeMin: 0.7,
          lifeMax: 1.8,
          sizeMin: 2,
          sizeMax: 6.4,
          color: this.level.palette.blossomGlow,
          glow: 24,
        });
      }

      if (this.victory) {
        this.victoryTimer += dt;
      }

      if (this.player.light <= 0 && this.respawnCooldown <= 0 && !this.victory) {
        this.respawn();
      }
    }

    respawn() {
      this.player.restoreAtCheckpoint();
      this.flash = 1;
      this.respawnCooldown = 1;
      this.audio.playReset();
      this.particles.burst({
        x: this.player.pos.x,
        y: this.player.pos.y,
        count: 18,
        speedMin: 20,
        speedMax: 90,
        lifeMin: 0.35,
        lifeMax: 0.8,
        sizeMin: 1.5,
        sizeMax: 4.4,
        color: this.level.palette.waterGlow,
        glow: 16,
      });
    }

    onBudActivated(bud, wasAliveBefore) {
      if (!wasAliveBefore) {
        this.stats.awakenedUnique += 1;
      } else {
        this.stats.revived += 1;
      }

      this.progressPulse = Math.max(this.progressPulse, 0.6 + bud.weight * 0.12);
      if (bud.checkpoint) {
        this.player.setCheckpoint(bud.x, bud.y);
      }

      this.audio.playBud();
      this.particles.burst({
        x: bud.x,
        y: bud.y,
        count: 16,
        speedMin: 26,
        speedMax: 118,
        lifeMin: 0.35,
        lifeMax: 1.2,
        sizeMin: 1.4,
        sizeMax: 4.8,
        color: this.level.palette.blossomGlow,
        glow: 18,
      });
    }

    onBudWithered(bud) {
      this.stats.withered += 1;
      this.particles.burst({
        x: bud.x,
        y: bud.y,
        count: 10,
        speedMin: 14,
        speedMax: 70,
        lifeMin: 0.28,
        lifeMax: 0.9,
        sizeMin: 1,
        sizeMax: 3.8,
        color: "rgba(193, 158, 135, 0.66)",
        glow: 6,
      });
    }

    onMoonDropCollected(drop) {
      this.stats.moonDrops += 1;
      this.audio.playMoonDrop();
      this.particles.burst({
        x: drop.x,
        y: drop.y,
        count: 12,
        speedMin: 26,
        speedMax: 84,
        lifeMin: 0.3,
        lifeMax: 0.9,
        sizeMin: 1.2,
        sizeMax: 3.8,
        color: this.level.palette.accent,
        glow: 14,
      });
    }

    getResult() {
      const aliveCount = this.buds.filter((bud) => bud.isAlive()).length;
      return {
        levelId: this.level.id,
        time: this.time,
        aliveCount,
        totalBuds: this.buds.length,
        moonDrops: this.stats.moonDrops,
        totalMoonDrops: this.moonDrops.length,
        awakenedUnique: this.stats.awakenedUnique,
        revived: this.stats.revived,
      };
    }

    isGateOpen(gate) {
      return this.openGates.has(gate);
    }

    openGate(gate) {
      if (!gate) {
        return;
      }
      this.openGates.add(gate);
    }

    getTrailEnergyAt(target, radius) {
      let value = 0;
      for (const point of this.player.trail) {
        const reach = radius + (point.width || 12) * 0.5;
        const dist = distance(point, target);
        if (dist < reach) {
          const strength = clamp(1 - dist / reach, 0, 1) * (point.life / point.maxLife);
          value = Math.max(value, strength);
        }
      }
      return value;
    }

    getTrailEnergyInEllipse(ellipse) {
      let value = 0;
      for (const point of this.player.trail) {
        if (pointInEllipse(point, ellipse)) {
          value = Math.max(value, point.life / point.maxLife);
        }
      }
      return value;
    }

    getTrailAlongSegment(a, b, radius) {
      let value = 0;
      for (const point of this.player.trail) {
        const dist = distanceToSegment(point, a, b);
        if (dist < radius) {
          value = Math.max(value, clamp(1 - dist / radius, 0, 1) * (point.life / point.maxLife));
        }
      }
      return value;
    }

    getNetworkCharge(budId) {
      let signal = 0;
      for (const link of this.links) {
        if (!link.isUnlocked(this) || link.flow < 0.06) {
          continue;
        }
        let otherBud = null;
        if (link.from === budId) {
          otherBud = this.budById[link.to];
        } else if (link.to === budId) {
          otherBud = this.budById[link.from];
        }
        if (otherBud && otherBud.isAlive()) {
          signal = Math.max(signal, link.flow * link.getTransmission());
        }
      }
      return signal;
    }

    getWaterInfluenceAt(target) {
      let value = 0;
      for (const water of this.waters) {
        if (water.isUnlocked(this) && pointInEllipse(target, water)) {
          value = Math.max(value, water.brightness * 0.95);
        }
      }
      return value;
    }

    getWaterAlongSegment(a, b) {
      const mid = { x: (a.x + b.x) * 0.5, y: (a.y + b.y) * 0.5 };
      let value = 0;
      for (const water of this.waters) {
        if (!water.isUnlocked(this)) {
          continue;
        }
        const influence = ellipseFalloff(mid, water);
        value = Math.max(value, influence * water.brightness);
      }
      return value;
    }

    getAmbientLifeAt(target) {
      let value = this.getWaterInfluenceAt(target) * 0.38;

      for (const bud of this.buds) {
        if (!bud.isAlive()) {
          continue;
        }
        const dist = distance(target, bud);
        if (dist < 92) {
          value += clamp(1 - dist / 92, 0, 1) * 0.26;
        }
      }

      return value;
    }

    getShadowInfluence(target) {
      return this.shadow ? this.shadow.getInfluence(target) : 0;
    }

    getWindAt(point) {
      const wind = this.level.wind;
      if (!wind) {
        return { x: 0, y: 0 };
      }
      const sway = Math.sin(this.time * 1.2 + point.x * 0.012 + point.y * 0.008) * wind.sway;
      return {
        x: wind.x + sway * 18,
        y: wind.y + Math.cos(this.time * 0.9 + point.y * 0.01) * wind.sway * 10,
      };
    }

    sampleSurface(point) {
      let wet = 0;
      let insideWater = false;
      let webSlow = 0;

      for (const water of this.waters) {
        if (!water.isUnlocked(this)) {
          continue;
        }
        if (pointInEllipse(point, water)) {
          insideWater = true;
          wet += 0.48 + water.brightness * 0.72;
        }
      }

      for (const bud of this.buds) {
        if (!bud.isAlive()) {
          continue;
        }
        const dist = distance(point, bud);
        if (dist < 98) {
          wet += clamp(1 - dist / 98, 0, 1) * 0.28;
        }
      }

      for (const link of this.links) {
        if (!link.isUnlocked(this) || link.flow < 0.12) {
          continue;
        }
        const a = this.budById[link.from];
        const b = this.budById[link.to];
        const reach = link.type === "water" ? 28 : 22;
        const dist = distanceToSegment(point, a, b);
        if (dist < reach) {
          const intensity = clamp(1 - dist / reach, 0, 1);
          const typeBoost = link.type === "water" ? 0.38 : link.type === "branch" ? 0.26 : 0.22;
          wet += intensity * typeBoost * link.flow;
        }
      }

      for (const zone of this.level.dryZones || []) {
        wet -= ellipseFalloff(point, zone) * zone.intensity;
      }

      for (const web of this.level.webs || []) {
        webSlow = Math.max(webSlow, ellipseFalloff(point, web) * (web.slow || 0.4));
      }

      const shadow = this.getShadowInfluence(point);
      wet -= shadow * 0.58;

      const recover = Math.max(0, wet) * 0.18 + (insideWater ? 0.05 : 0);
      const drain = 0.038 + Math.max(0, -wet) * 0.18 + shadow * 0.18 + webSlow * 0.04;
      const speed = clamp(0.74 + wet * 0.54 - webSlow * 0.36, 0.48, 1.46);

      return {
        wet,
        recover,
        drain,
        speed,
        webSlow,
        insideWater,
      };
    }

    getAudioState() {
      return {
        dryness: clamp(1 - this.progress * 0.72 - this.player.light * 0.34, 0, 1),
        energy: clamp(this.player.light * 0.78 + this.progress * 0.32, 0, 1),
        progressPulse: this.progressPulse,
      };
    }
  }

  MoonDew.LevelSession = LevelSession;
})();
