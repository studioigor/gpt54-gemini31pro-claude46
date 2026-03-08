(() => {
  const MoonDew = (window.MoonDew = window.MoonDew || {});
  const {
    TAU,
    clamp,
    distance,
    easeInOutSine,
    lerp,
    pointInEllipse,
    randomRange,
  } = MoonDew.math;

  class Renderer {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext("2d");
      this.paperPattern = this.createPaperPattern();
      this.stars = this.createStars();
      this.frontLeaves = this.createFrontLeaves();
    }

    createPaperPattern() {
      const paper = document.createElement("canvas");
      paper.width = 220;
      paper.height = 220;
      const ctx = paper.getContext("2d");

      ctx.fillStyle = "rgba(255, 250, 240, 0.035)";
      ctx.fillRect(0, 0, paper.width, paper.height);

      for (let index = 0; index < 1000; index += 1) {
        const x = Math.random() * paper.width;
        const y = Math.random() * paper.height;
        const alpha = Math.random() * 0.08;
        ctx.fillStyle = `rgba(110, 94, 70, ${alpha})`;
        ctx.fillRect(x, y, 1, 1);
      }

      for (let index = 0; index < 90; index += 1) {
        ctx.strokeStyle = `rgba(125, 105, 84, ${Math.random() * 0.03})`;
        ctx.beginPath();
        ctx.moveTo(Math.random() * paper.width, Math.random() * paper.height);
        ctx.lineTo(Math.random() * paper.width, Math.random() * paper.height);
        ctx.stroke();
      }

      return this.ctx.createPattern(paper, "repeat");
    }

    createStars() {
      const stars = [];
      for (let index = 0; index < 120; index += 1) {
        stars.push({
          x: Math.random(),
          y: Math.random() * 0.75,
          size: randomRange(0.6, 2.2),
          speed: randomRange(0.2, 0.9),
        });
      }
      return stars;
    }

    createFrontLeaves() {
      const leaves = [];
      for (let index = 0; index < 8; index += 1) {
        leaves.push({
          x: Math.random(),
          y: Math.random(),
          scale: randomRange(120, 240),
          rotate: randomRange(-0.9, 0.9),
          alpha: randomRange(0.05, 0.12),
        });
      }
      return leaves;
    }

    getViewport(world, camera) {
      const width = this.canvas.width;
      const height = this.canvas.height;
      const zoom = camera?.zoom || 1;
      const viewWidth = world.width / zoom;
      const viewHeight = world.height / zoom;
      const scale = Math.min(width / viewWidth, height / viewHeight);
      const drawWidth = viewWidth * scale;
      const drawHeight = viewHeight * scale;
      const offsetX = (width - drawWidth) * 0.5;
      const offsetY = (height - drawHeight) * 0.5;
      const maxX = Math.max(0, world.width - viewWidth);
      const maxY = Math.max(0, world.height - viewHeight);
      const x = clamp((camera?.x || world.width * 0.5) - viewWidth * 0.5, 0, maxX);
      const y = clamp((camera?.y || world.height * 0.5) - viewHeight * 0.5, 0, maxY);

      return {
        scale,
        offsetX,
        offsetY,
        x,
        y,
        viewWidth,
        viewHeight,
        zoom,
      };
    }

    screenToWorld(screenX, screenY, world, camera) {
      const view = this.getViewport(world, camera);
      return {
        x: (screenX - view.offsetX) / view.scale + view.x,
        y: (screenY - view.offsetY) / view.scale + view.y,
      };
    }

    beginBackground(palette, time) {
      const ctx = this.ctx;
      const width = this.canvas.width;
      const height = this.canvas.height;

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, width, height);

      const gradient = ctx.createLinearGradient(0, 0, 0, height);
      gradient.addColorStop(0, palette.skyTop);
      gradient.addColorStop(1, palette.skyBottom);
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);

      const moon = ctx.createRadialGradient(width * 0.78, height * 0.18, 10, width * 0.78, height * 0.18, height * 0.34);
      moon.addColorStop(0, "rgba(246, 243, 233, 0.18)");
      moon.addColorStop(1, "rgba(246, 243, 233, 0)");
      ctx.fillStyle = moon;
      ctx.fillRect(0, 0, width, height);

      for (const star of this.stars) {
        const twinkle = 0.4 + Math.sin(time * star.speed + star.x * 18) * 0.35;
        ctx.globalAlpha = twinkle;
        ctx.fillStyle = palette.starlight || "rgba(255,255,255,0.8)";
        ctx.beginPath();
        ctx.arc(star.x * width, star.y * height, star.size, 0, TAU);
        ctx.fill();
      }

      ctx.globalAlpha = 1;
    }

    applyWorldTransform(view) {
      this.ctx.setTransform(
        view.scale,
        0,
        0,
        view.scale,
        view.offsetX - view.x * view.scale,
        view.offsetY - view.y * view.scale
      );
    }

    renderMenu(levels, progress, time) {
      const lastLevel = levels[Math.max(0, Math.min(levels.length - 1, (progress.unlocked || 1) - 1))];
      this.beginBackground(lastLevel.palette, time);
      this.renderGardenSilhouette(lastLevel.palette, time, (progress.unlocked || 1) / levels.length, 0.18);
      this.applyPaperOverlay();
    }

    renderMap(levels, progress, time) {
      const palette = levels[Math.max(0, (progress.unlocked || 1) - 1)].palette;
      this.beginBackground(palette, time);
      this.renderGardenSilhouette(palette, time, this.getCompletionRatio(levels, progress), 0.3);
      this.drawMapGlow(levels, progress, time);
      this.applyPaperOverlay();
    }

    renderResult(level, progress, time) {
      this.beginBackground(level.palette, time);
      this.renderGardenSilhouette(level.palette, time, this.getCompletionRatio([level], { completed: { [level.id]: true } }), 0.26);
      this.applyPaperOverlay();
    }

    renderFinale(levels, progress, time) {
      const palette = levels[levels.length - 1].palette;
      this.beginBackground(palette, time);
      this.renderGardenSilhouette(palette, time, 1, 0.42);
      const ctx = this.ctx;
      const width = this.canvas.width;
      const height = this.canvas.height;
      const glow = ctx.createRadialGradient(width * 0.5, height * 0.72, 0, width * 0.5, height * 0.72, height * 0.42);
      glow.addColorStop(0, "rgba(181, 236, 230, 0.2)");
      glow.addColorStop(1, "rgba(181, 236, 230, 0)");
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, width, height);
      this.applyPaperOverlay();
    }

    renderGardenSilhouette(palette, time, bloom, extraGlow) {
      const ctx = this.ctx;
      const width = this.canvas.width;
      const height = this.canvas.height;

      const floor = ctx.createLinearGradient(0, height * 0.48, 0, height);
      floor.addColorStop(0, "rgba(8, 18, 20, 0)");
      floor.addColorStop(1, "rgba(8, 18, 20, 0.7)");
      ctx.fillStyle = floor;
      ctx.fillRect(0, 0, width, height);

      ctx.save();
      ctx.translate(width * 0.5, height * 0.68);
      ctx.fillStyle = "rgba(11, 23, 24, 0.58)";
      for (let index = 0; index < 9; index += 1) {
        const x = -width * 0.38 + index * width * 0.095;
        const h = 90 + Math.sin(index * 0.8 + time * 0.4) * 10 + index * 6;
        this.drawLeafShape(ctx, x, 0, h * 0.3, h, -0.4 + index * 0.08, "rgba(8, 18, 20, 0.58)");
      }
      ctx.restore();

      ctx.save();
      ctx.globalAlpha = 0.42 + bloom * 0.28;
      const glow = ctx.createRadialGradient(width * 0.5, height * 0.62, 0, width * 0.5, height * 0.62, height * 0.36);
      glow.addColorStop(0, `rgba(171, 230, 221, ${0.14 + bloom * 0.16 + extraGlow})`);
      glow.addColorStop(1, "rgba(171, 230, 221, 0)");
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, width, height);
      ctx.restore();

      ctx.save();
      ctx.translate(width * 0.5, height * 0.72);
      ctx.strokeStyle = `rgba(194, 223, 214, ${0.1 + bloom * 0.18})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(width * 0.02, -120, width * 0.16, -210);
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(-width * 0.04, -100, -width * 0.15, -180);
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(width * 0.08, -52, width * 0.26, -86);
      ctx.stroke();
      ctx.restore();

      ctx.fillStyle = `rgba(179, 229, 222, ${0.08 + bloom * 0.2})`;
      ctx.beginPath();
      ctx.arc(width * 0.5, height * 0.72, 16 + bloom * 10, 0, TAU);
      ctx.fill();
    }

    drawMapGlow(levels, progress, time) {
      const ctx = this.ctx;
      const width = this.canvas.width;
      const height = this.canvas.height;
      ctx.save();
      ctx.translate(width * 0.18, height * 0.28);
      for (const level of levels) {
        if (!progress.completed[level.id]) {
          continue;
        }
        const x = (level.map.x / 100) * width * 0.62;
        const y = (level.map.y / 100) * height * 0.4;
        const pulse = 0.5 + Math.sin(time * 1.2 + level.index) * 0.18;
        ctx.fillStyle = `rgba(171, 231, 220, ${0.16 + pulse * 0.12})`;
        ctx.beginPath();
        ctx.arc(x, y, 16 + pulse * 8, 0, TAU);
        ctx.fill();
      }
      ctx.restore();
    }

    getCompletionRatio(levels, progress) {
      if (!levels.length) {
        return 0;
      }
      let completed = 0;
      for (const level of levels) {
        if (progress.completed[level.id]) {
          completed += 1;
        }
      }
      return completed / levels.length;
    }

    renderLevel(session, camera, paused) {
      const level = session.level;
      const palette = level.palette;
      const ctx = this.ctx;
      const view = this.getViewport(level.world, camera);

      this.beginBackground(palette, session.time);
      this.applyWorldTransform(view);
      this.drawWorldBackdrop(level, palette, camera, session.time);
      this.drawDryZones(level, palette);
      this.drawWebs(level);

      for (const water of session.waters) {
        water.draw(this, session);
      }

      for (const link of session.links) {
        link.draw(this, session);
      }

      for (const basin of session.basins) {
        basin.draw(this, session);
      }

      this.drawFlower(session);

      for (const drop of session.moonDrops) {
        drop.draw(this, session);
      }

      for (const bud of session.buds) {
        bud.draw(this, session);
      }

      this.drawTrail(session.player.trail, palette);
      this.drawParticles(session.particles.items);

      if (session.shadow) {
        session.shadow.draw(this, session);
      }

      session.player.draw(this, session);
      this.drawForegroundLeaves(level, session.time);

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      this.drawFrameGlow(palette, session.flash);
      if (paused) {
        ctx.fillStyle = "rgba(8, 16, 17, 0.28)";
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      }
      this.applyPaperOverlay();
    }

    drawWorldBackdrop(level, palette, camera, time) {
      const ctx = this.ctx;
      const world = level.world;

      const floorGradient = ctx.createLinearGradient(0, 0, 0, world.height);
      floorGradient.addColorStop(0, "rgba(17, 34, 37, 0.06)");
      floorGradient.addColorStop(1, "rgba(8, 16, 17, 0.24)");
      ctx.fillStyle = floorGradient;
      ctx.fillRect(0, 0, world.width, world.height);

      for (const blob of level.backdrops || []) {
        ctx.save();
        const shiftX = ((camera.x || world.width * 0.5) - world.width * 0.5) * blob.depth * 0.18;
        const shiftY = ((camera.y || world.height * 0.5) - world.height * 0.5) * blob.depth * 0.12;
        ctx.translate(blob.x - shiftX, blob.y - shiftY);
        ctx.rotate(Math.sin(time * 0.08 + blob.x * 0.01) * 0.08);
        ctx.fillStyle = blob.color;
        ctx.beginPath();
        ctx.ellipse(0, 0, blob.rx, blob.ry, 0, 0, TAU);
        ctx.fill();
        ctx.restore();
      }

      ctx.save();
      ctx.globalAlpha = 0.28;
      for (let index = 0; index < 7; index += 1) {
        const x = 120 + index * 132 + Math.sin(time * 0.15 + index * 1.3) * 8;
        this.drawLeafShape(
          ctx,
          x,
          world.height - 72,
          38 + index * 3,
          160 + Math.sin(index * 0.8) * 12,
          -0.5 + index * 0.12,
          palette.leaf
        );
      }
      ctx.restore();
    }

    drawDryZones(level, palette) {
      const ctx = this.ctx;
      for (const zone of level.dryZones || []) {
        ctx.save();
        ctx.translate(zone.x, zone.y);
        ctx.fillStyle = palette.shadow;
        ctx.globalAlpha = 0.24;
        ctx.beginPath();
        ctx.ellipse(0, 0, zone.rx, zone.ry, 0, 0, TAU);
        ctx.fill();
        ctx.globalAlpha = 0.36;
        ctx.strokeStyle = palette.dryEdge;
        ctx.lineWidth = 2;
        ctx.setLineDash([8, 7]);
        ctx.beginPath();
        ctx.ellipse(0, 0, zone.rx * 0.76, zone.ry * 0.76, 0, 0, TAU);
        ctx.stroke();
        ctx.restore();
      }
      ctx.setLineDash([]);
    }

    drawWebs(level) {
      const ctx = this.ctx;
      for (const web of level.webs || []) {
        ctx.save();
        ctx.translate(web.x, web.y);
        ctx.strokeStyle = "rgba(216, 226, 227, 0.18)";
        ctx.lineWidth = 1.3;
        for (let ring = 0; ring < 4; ring += 1) {
          ctx.beginPath();
          ctx.ellipse(0, 0, web.rx * (1 - ring * 0.18), web.ry * (1 - ring * 0.18), 0, 0, TAU);
          ctx.stroke();
        }
        for (let spoke = 0; spoke < 8; spoke += 1) {
          const angle = (spoke / 8) * TAU;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(Math.cos(angle) * web.rx, Math.sin(angle) * web.ry);
          ctx.stroke();
        }
        ctx.restore();
      }
    }

    drawLeafShape(ctx, x, y, rx, ry, rotation, color) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rotation);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(0, -ry);
      ctx.bezierCurveTo(rx, -ry * 0.5, rx, ry * 0.6, 0, ry);
      ctx.bezierCurveTo(-rx, ry * 0.6, -rx, -ry * 0.5, 0, -ry);
      ctx.fill();
      ctx.restore();
    }

    drawLink(link, session) {
      const ctx = this.ctx;
      const a = session.budById[link.from];
      const b = session.budById[link.to];
      const midX = (a.x + b.x) * 0.5;
      const midY = (a.y + b.y) * 0.5 - 18;
      const baseColor =
        link.type === "water"
          ? "rgba(87, 148, 162, 0.26)"
          : link.type === "branch"
            ? "rgba(116, 104, 92, 0.34)"
            : "rgba(117, 125, 96, 0.26)";

      ctx.save();
      ctx.lineCap = "round";
      ctx.strokeStyle = baseColor;
      ctx.lineWidth = link.type === "branch" ? 8 : 6;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.quadraticCurveTo(midX, midY, b.x, b.y);
      ctx.stroke();

      if (link.flow > 0.02) {
        ctx.shadowBlur = 18;
        ctx.shadowColor = session.level.palette.wetGlow;
        ctx.strokeStyle =
          link.type === "water"
            ? `rgba(180, 240, 246, ${0.18 + link.flow * 0.45})`
            : `rgba(170, 224, 198, ${0.14 + link.flow * 0.4})`;
        ctx.lineWidth = link.type === "branch" ? 4 : 3.4;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.quadraticCurveTo(midX, midY, b.x, b.y);
        ctx.stroke();
      }
      ctx.restore();
    }

    drawWater(water, session) {
      const ctx = this.ctx;
      const palette = session.level.palette;
      ctx.save();
      ctx.translate(water.x, water.y);

      ctx.fillStyle = palette.water;
      ctx.beginPath();
      ctx.ellipse(0, 0, water.rx, water.ry, 0, 0, TAU);
      ctx.fill();

      ctx.globalAlpha = 0.22 + water.brightness * 0.22;
      ctx.fillStyle = palette.waterGlow;
      for (let ring = 0; ring < 3; ring += 1) {
        ctx.beginPath();
        ctx.ellipse(
          Math.sin(water.ripple + ring) * 12,
          Math.cos(water.ripple * 0.6 + ring) * 8,
          water.rx * (0.72 - ring * 0.12),
          water.ry * (0.62 - ring * 0.12),
          0,
          0,
          TAU
        );
        ctx.fill();
      }

      ctx.globalAlpha = 0.85;
      ctx.strokeStyle = "rgba(233, 250, 255, 0.28)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(0, 0, water.rx * 0.86, water.ry * 0.72, 0, 0, TAU);
      ctx.stroke();

      ctx.fillStyle = `rgba(255, 255, 255, ${0.08 + water.brightness * 0.14})`;
      ctx.beginPath();
      ctx.ellipse(-water.rx * 0.18, -water.ry * 0.24, water.rx * 0.34, water.ry * 0.22, -0.2, 0, TAU);
      ctx.fill();
      ctx.restore();
    }

    drawBasin(basin, session) {
      const ctx = this.ctx;
      const palette = session.level.palette;
      ctx.save();
      ctx.translate(basin.x, basin.y);
      ctx.fillStyle = "rgba(81, 76, 71, 0.45)";
      ctx.beginPath();
      ctx.arc(0, 0, basin.radius + 8, 0, TAU);
      ctx.fill();

      ctx.fillStyle = "rgba(22, 42, 45, 0.82)";
      ctx.beginPath();
      ctx.arc(0, 0, basin.radius, 0, TAU);
      ctx.fill();

      const amount = basin.completed ? 1 : basin.fill / basin.required;
      ctx.fillStyle = palette.waterGlow;
      ctx.globalAlpha = 0.18 + amount * 0.4;
      ctx.beginPath();
      ctx.arc(0, 0, basin.radius * amount, 0, TAU);
      ctx.fill();

      ctx.globalAlpha = 1;
      ctx.strokeStyle = amount > 0.9 ? palette.accent : "rgba(224, 213, 188, 0.25)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, basin.radius + 3, -Math.PI * 0.5, -Math.PI * 0.5 + amount * TAU);
      ctx.stroke();
      ctx.restore();
    }

    drawFlower(session) {
      const ctx = this.ctx;
      const flower = session.flower;
      const palette = session.level.palette;
      const bloom = clamp(flower.open, 0, 1);

      ctx.save();
      ctx.translate(flower.x, flower.y);
      const petalCount = 10;
      for (let index = 0; index < petalCount; index += 1) {
        const angle = (index / petalCount) * TAU + Math.sin(session.time * 0.3 + index) * 0.03;
        const spread = 0.32 + bloom * 0.44;
        ctx.save();
        ctx.rotate(angle);
        ctx.fillStyle = `rgba(230, 215, 199, ${0.16 + bloom * 0.58})`;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.bezierCurveTo(
          flower.radius * 0.28,
          -flower.radius * spread,
          flower.radius * 0.48,
          -flower.radius * (0.24 + bloom * 0.46),
          0,
          -flower.radius * (0.38 + bloom * 0.38)
        );
        ctx.bezierCurveTo(
          -flower.radius * 0.48,
          -flower.radius * (0.24 + bloom * 0.46),
          -flower.radius * 0.28,
          -flower.radius * spread,
          0,
          0
        );
        ctx.fill();
        ctx.restore();
      }

      ctx.shadowBlur = 26;
      ctx.shadowColor = palette.blossomGlow;
      ctx.fillStyle = `rgba(255, 243, 203, ${0.14 + bloom * 0.62})`;
      ctx.beginPath();
      ctx.arc(0, 0, flower.radius * (0.24 + bloom * 0.18), 0, TAU);
      ctx.fill();

      ctx.shadowBlur = 0;
      ctx.fillStyle = `rgba(255, 233, 171, ${flower.ready ? 0.92 : 0.28 + bloom * 0.22})`;
      ctx.beginPath();
      ctx.arc(0, 0, flower.radius * 0.13, 0, TAU);
      ctx.fill();
      ctx.restore();
    }

    drawMoonDrop(drop, session) {
      if (drop.collected) {
        return;
      }
      const ctx = this.ctx;
      const palette = session.level.palette;
      const pulse = 0.75 + Math.sin(drop.spin) * 0.22;
      ctx.save();
      ctx.translate(drop.x, drop.y);
      ctx.rotate(Math.sin(drop.spin * 0.7) * 0.2);
      ctx.shadowBlur = 16;
      ctx.shadowColor = palette.accent;
      ctx.fillStyle = `rgba(245, 214, 135, ${0.6 + pulse * 0.28})`;
      ctx.beginPath();
      ctx.moveTo(0, -drop.radius * 1.05);
      ctx.bezierCurveTo(drop.radius * 0.8, -drop.radius * 0.5, drop.radius * 0.9, drop.radius * 0.7, 0, drop.radius * 1.1);
      ctx.bezierCurveTo(-drop.radius * 0.9, drop.radius * 0.7, -drop.radius * 0.8, -drop.radius * 0.5, 0, -drop.radius * 1.05);
      ctx.fill();
      ctx.restore();
    }

    drawBud(bud, session) {
      const ctx = this.ctx;
      const palette = session.level.palette;
      const alive = bud.isAlive();
      const open = bud.open;
      const pulse = 0.45 + Math.sin(bud.pulse * 2) * 0.08;

      ctx.save();
      ctx.translate(bud.x, bud.y);
      if (!bud.isUnlocked(session) && !alive) {
        ctx.fillStyle = "rgba(96, 84, 75, 0.35)";
        ctx.beginPath();
        ctx.arc(0, 0, bud.radius, 0, TAU);
        ctx.fill();
        ctx.restore();
        return;
      }

      ctx.shadowBlur = alive ? 18 : 10;
      ctx.shadowColor = alive ? palette.blossomGlow : "rgba(255, 255, 255, 0.08)";
      ctx.fillStyle = alive ? `rgba(222, 204, 194, ${0.5 + bud.vitality * 0.38})` : "rgba(171, 156, 147, 0.38)";
      for (let index = 0; index < 6; index += 1) {
        const angle = (index / 6) * TAU + open * 0.24;
        const length = bud.radius * (0.34 + open * 0.46);
        const width = bud.radius * 0.34;
        ctx.save();
        ctx.rotate(angle);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.bezierCurveTo(width, -length * 0.42, width, -length * 0.88, 0, -length);
        ctx.bezierCurveTo(-width, -length * 0.88, -width, -length * 0.42, 0, 0);
        ctx.fill();
        ctx.restore();
      }

      ctx.shadowBlur = alive ? 24 : 0;
      ctx.shadowColor = palette.wetGlow;
      ctx.fillStyle = alive
        ? `rgba(255, 238, 172, ${0.34 + bud.vitality * 0.5})`
        : `rgba(195, 187, 177, ${0.18 + bud.charge * 0.18})`;
      ctx.beginPath();
      ctx.arc(0, 0, bud.radius * (0.22 + pulse * 0.1), 0, TAU);
      ctx.fill();

      if (!alive) {
        ctx.strokeStyle = `rgba(208, 232, 224, ${0.08 + pulse * 0.14})`;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.arc(0, 0, bud.radius + 8 + pulse * 4, 0, TAU);
        ctx.stroke();
      }
      ctx.restore();
    }

    drawTrail(trail, palette) {
      if (trail.length < 2) {
        return;
      }
      const ctx = this.ctx;
      ctx.save();
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = palette.wetGlow;
      ctx.shadowBlur = 24;
      ctx.shadowColor = palette.wetGlow;
      ctx.globalAlpha = 0.42;
      for (let index = 1; index < trail.length; index += 1) {
        const a = trail[index - 1];
        const b = trail[index];
        const alpha = Math.min(a.life / a.maxLife, b.life / b.maxLife);
        ctx.globalAlpha = 0.18 + alpha * 0.44;
        ctx.lineWidth = Math.min(a.width, b.width) * 0.5;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
      ctx.restore();
    }

    drawParticles(items) {
      const ctx = this.ctx;
      ctx.save();
      for (const particle of items) {
        const alpha = particle.alpha * (particle.life / particle.maxLife);
        ctx.globalAlpha = alpha;
        ctx.save();
        ctx.translate(particle.x, particle.y);
        ctx.rotate(particle.rotation);
        ctx.shadowBlur = particle.glow;
        ctx.shadowColor = particle.color;
        ctx.fillStyle = particle.color;

        if (particle.type === "moth") {
          ctx.beginPath();
          ctx.ellipse(-particle.size * 0.32, 0, particle.size * 0.64, particle.size * 0.36, -0.3, 0, TAU);
          ctx.ellipse(particle.size * 0.32, 0, particle.size * 0.64, particle.size * 0.36, 0.3, 0, TAU);
          ctx.fill();
        } else {
          ctx.beginPath();
          ctx.arc(0, 0, particle.size, 0, TAU);
          ctx.fill();
        }
        ctx.restore();
      }
      ctx.restore();
    }

    drawShadow(shadow, session) {
      const ctx = this.ctx;
      const radius = shadow.radius;
      ctx.save();
      const gradient = ctx.createRadialGradient(shadow.pos.x, shadow.pos.y, radius * 0.1, shadow.pos.x, shadow.pos.y, radius);
      gradient.addColorStop(0, session.level.palette.deepShadow);
      gradient.addColorStop(0.64, session.level.palette.shadow);
      gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(shadow.pos.x, shadow.pos.y, radius, 0, TAU);
      ctx.fill();

      ctx.globalAlpha = 0.22;
      ctx.fillStyle = "rgba(205, 171, 150, 0.16)";
      for (let index = 0; index < 9; index += 1) {
        const angle = (index / 9) * TAU + shadow.pulse * 0.4;
        ctx.beginPath();
        ctx.arc(
          shadow.pos.x + Math.cos(angle) * (radius * 0.2 + index * 5),
          shadow.pos.y + Math.sin(angle) * (radius * 0.18 + index * 4),
          5 + index * 0.6,
          0,
          TAU
        );
        ctx.fill();
      }
      ctx.restore();
    }

    drawPlayer(player, session) {
      const ctx = this.ctx;
      const palette = session.level.palette;
      ctx.save();
      ctx.translate(player.pos.x, player.pos.y);
      ctx.shadowBlur = 26 + player.dashFlash * 14;
      ctx.shadowColor = palette.wetGlow;
      ctx.fillStyle = `rgba(176, 236, 255, ${0.22 + player.light * 0.18})`;
      ctx.beginPath();
      ctx.arc(0, 0, player.radius * (1.7 + player.dashFlash * 0.4), 0, TAU);
      ctx.fill();

      const body = ctx.createRadialGradient(-3, -4, 1, 0, 0, player.radius * 1.3);
      body.addColorStop(0, "rgba(255, 255, 255, 0.96)");
      body.addColorStop(0.3, "rgba(203, 241, 255, 0.9)");
      body.addColorStop(1, "rgba(104, 166, 196, 0.38)");
      ctx.fillStyle = body;
      ctx.beginPath();
      ctx.arc(0, 0, player.radius * (0.95 + player.dashFlash * 0.08), 0, TAU);
      ctx.fill();

      ctx.shadowBlur = 0;
      ctx.fillStyle = `rgba(255, 244, 210, ${0.4 + player.light * 0.34})`;
      ctx.beginPath();
      ctx.arc(0, 0, player.radius * 0.34, 0, TAU);
      ctx.fill();
      ctx.restore();
    }

    drawForegroundLeaves(level, time) {
      const ctx = this.ctx;
      ctx.save();
      ctx.globalAlpha = 0.6;
      for (const leaf of this.frontLeaves) {
        const x = leaf.x * level.world.width;
        const y = leaf.y * level.world.height * 0.7;
        this.drawLeafShape(
          ctx,
          x + Math.sin(time * 0.16 + leaf.x * 8) * 12,
          y,
          leaf.scale * 0.22,
          leaf.scale,
          leaf.rotate + Math.sin(time * 0.1 + leaf.y * 6) * 0.08,
          `rgba(4, 10, 11, ${leaf.alpha})`
        );
      }
      ctx.restore();
    }

    drawFrameGlow(palette, flash) {
      const ctx = this.ctx;
      const width = this.canvas.width;
      const height = this.canvas.height;
      const vignette = ctx.createRadialGradient(width * 0.5, height * 0.52, height * 0.18, width * 0.5, height * 0.52, height * 0.76);
      vignette.addColorStop(0, "rgba(0, 0, 0, 0)");
      vignette.addColorStop(1, "rgba(0, 0, 0, 0.24)");
      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, width, height);

      const border = ctx.createLinearGradient(0, 0, width, height);
      border.addColorStop(0, "rgba(238, 230, 210, 0.09)");
      border.addColorStop(1, "rgba(238, 230, 210, 0.02)");
      ctx.strokeStyle = border;
      ctx.lineWidth = 2;
      ctx.strokeRect(14, 14, width - 28, height - 28);

      if (flash > 0.01) {
        ctx.fillStyle = `rgba(180, 232, 242, ${flash * 0.18})`;
        ctx.fillRect(0, 0, width, height);
      }

      const bloom = ctx.createRadialGradient(width * 0.5, height * 0.18, 0, width * 0.5, height * 0.18, height * 0.4);
      bloom.addColorStop(0, "rgba(255, 244, 220, 0.06)");
      bloom.addColorStop(1, "rgba(255, 244, 220, 0)");
      ctx.fillStyle = bloom;
      ctx.fillRect(0, 0, width, height);
    }

    applyPaperOverlay() {
      const ctx = this.ctx;
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = 0.28;
      ctx.fillStyle = this.paperPattern;
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      ctx.restore();
    }
  }

  MoonDew.Renderer = Renderer;
})();
