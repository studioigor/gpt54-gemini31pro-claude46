(() => {
  const MoonDew = (window.MoonDew = window.MoonDew || {});
  const { clamp } = MoonDew.math;

  class GameEngine {
    constructor(options) {
      this.canvas = options.canvas;
      this.levels = MoonDew.levelData;
      this.renderer = new MoonDew.Renderer(this.canvas);
      this.input = new MoonDew.InputController(this.canvas);
      this.particles = new MoonDew.ParticleSystem();
      this.audio = new MoonDew.AudioManager();
      this.ui = new MoonDew.UIManager(options.uiRoot);
      this.progressKey = "moon-dew-garden-progress-v1";
      this.progress = this.loadProgress();
      this.scene = null;
      this.time = 0;
      this.lastFrameTime = 0;

      this.canvas.addEventListener("pointerdown", () => {
        this.audio.ensureStarted();
      });
      window.addEventListener("resize", () => this.resize());
      this.resize();
    }

    start() {
      this.changeScene(new MoonDew.scenes.MenuScene(this));
      requestAnimationFrame((time) => this.frame(time));
    }

    frame(timestamp) {
      if (!this.lastFrameTime) {
        this.lastFrameTime = timestamp;
      }
      const dt = clamp((timestamp - this.lastFrameTime) / 1000, 0.001, 0.05);
      this.lastFrameTime = timestamp;
      this.time += dt;

      this.resize();
      this.input.update(dt);
      this.ui.update(dt);

      if (this.scene && this.scene.update) {
        this.scene.update(dt);
      }

      this.particles.update(dt);
      this.audio.update(dt, this.scene?.getAudioState?.() || {});

      if (this.scene && this.scene.render) {
        this.scene.render(this.renderer);
      }

      this.input.endFrame();
      requestAnimationFrame((time) => this.frame(time));
    }

    resize() {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const rect = this.canvas.getBoundingClientRect();
      const width = Math.max(1, Math.round(rect.width * dpr));
      const height = Math.max(1, Math.round(rect.height * dpr));
      if (this.canvas.width !== width || this.canvas.height !== height) {
        this.canvas.width = width;
        this.canvas.height = height;
      }
    }

    changeScene(scene) {
      if (this.scene && this.scene.exit) {
        this.scene.exit();
      }
      this.scene = scene;
      if (this.scene && this.scene.enter) {
        this.scene.enter();
      }
    }

    goMenu() {
      this.changeScene(new MoonDew.scenes.MenuScene(this));
    }

    goMap() {
      this.changeScene(new MoonDew.scenes.MapScene(this));
    }

    goFinale() {
      this.changeScene(new MoonDew.scenes.FinaleScene(this));
    }

    startLevel(levelId) {
      this.changeScene(new MoonDew.scenes.LevelScene(this, levelId));
    }

    startSuggestedLevel() {
      if (Object.keys(this.progress.completed).length >= this.levels.length) {
        this.goFinale();
        return;
      }
      const candidate = this.levels.find(
        (level) => level.index <= this.progress.unlocked && !this.progress.completed[level.id]
      );
      this.startLevel(candidate ? candidate.id : this.levels[Math.max(0, this.progress.unlocked - 1)].id);
    }

    getLevel(levelId) {
      return this.levels.find((level) => level.id === levelId);
    }

    getNextLevel(levelId) {
      const index = this.levels.findIndex((level) => level.id === levelId);
      return index >= 0 ? this.levels[index + 1] || null : null;
    }

    markLevelComplete(levelId, result) {
      const level = this.getLevel(levelId);
      if (!level) {
        return;
      }

      this.progress.completed[levelId] = true;
      this.progress.bestTimes[levelId] = Math.min(
        this.progress.bestTimes[levelId] || Number.POSITIVE_INFINITY,
        result.time
      );
      this.progress.moonDrops[levelId] = Math.max(this.progress.moonDrops[levelId] || 0, result.moonDrops);
      this.progress.unlocked = Math.max(this.progress.unlocked, Math.min(this.levels.length, level.index + 1));
      this.saveProgress();
    }

    clearTransient() {
      this.particles.items.length = 0;
      this.ui.setPauseHandler(null);
    }

    resetProgress() {
      this.progress = {
        unlocked: 1,
        completed: {},
        bestTimes: {},
        moonDrops: {},
      };
      this.saveProgress();
    }

    loadProgress() {
      try {
        const raw = window.localStorage.getItem(this.progressKey);
        if (!raw) {
          return {
            unlocked: 1,
            completed: {},
            bestTimes: {},
            moonDrops: {},
          };
        }
        const parsed = JSON.parse(raw);
        return {
          unlocked: clamp(parsed.unlocked || 1, 1, this.levels.length),
          completed: parsed.completed || {},
          bestTimes: parsed.bestTimes || {},
          moonDrops: parsed.moonDrops || {},
        };
      } catch (error) {
        return {
          unlocked: 1,
          completed: {},
          bestTimes: {},
          moonDrops: {},
        };
      }
    }

    saveProgress() {
      try {
        window.localStorage.setItem(this.progressKey, JSON.stringify(this.progress));
      } catch (error) {
        // Ignore persistence failures.
      }
    }
  }

  MoonDew.GameEngine = GameEngine;
})();
