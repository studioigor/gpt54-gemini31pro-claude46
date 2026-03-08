(() => {
  const MoonDew = (window.MoonDew = window.MoonDew || {});
  const { damp } = MoonDew.math;

  class BaseScene {
    constructor(game) {
      this.game = game;
    }

    enter() {}

    exit() {}

    update() {}

    render() {}

    getAudioState() {
      return {
        dryness: 0.55,
        energy: 0.24,
        progressPulse: 0,
      };
    }
  }

  class MenuScene extends BaseScene {
    enter() {
      this.game.clearTransient();
      this.game.ui.showMenu(this.game.progress, {
        onStart: () => {
          this.game.audio.ensureStarted();
          this.game.startSuggestedLevel();
        },
        onMap: () => {
          this.game.audio.ensureStarted();
          this.game.goMap();
        },
      });
    }

    render(renderer) {
      renderer.renderMenu(this.game.levels, this.game.progress, this.game.time);
    }
  }

  class MapScene extends BaseScene {
    enter() {
      this.game.clearTransient();
      this.game.ui.showMap(this.game.levels, this.game.progress, {
        onSelect: (levelId) => {
          this.game.audio.ensureStarted();
          this.game.startLevel(levelId);
        },
        onBack: () => {
          this.game.goMenu();
        },
      });
    }

    render(renderer) {
      renderer.renderMap(this.game.levels, this.game.progress, this.game.time);
    }

    getAudioState() {
      return {
        dryness: 0.42,
        energy: 0.34,
        progressPulse: 0,
      };
    }
  }

  class LevelScene extends BaseScene {
    constructor(game, levelId) {
      super(game);
      this.level = this.game.getLevel(levelId);
      this.session = null;
      this.camera = {
        x: this.level.start.x,
        y: this.level.start.y,
        zoom: 1.07,
      };
      this.paused = false;
      this.completeHandled = false;
    }

    enter() {
      this.game.clearTransient();
      this.session = new MoonDew.LevelSession(this.level, {
        input: this.game.input,
        audio: this.game.audio,
        particles: this.game.particles,
      });
      this.game.audio.ensureStarted();
      this.game.audio.setLevel(this.level);
      this.game.ui.hideScreen();
      this.game.ui.showHud();
      this.game.ui.setPauseHandler(() => this.togglePause());
      this.game.ui.showToast(this.level.hint, 2.5);
    }

    exit() {
      this.game.ui.hideScreen();
      this.game.ui.hideHud();
    }

    togglePause() {
      this.paused = !this.paused;
      if (this.paused) {
        this.game.ui.showPause(this.level, {
          onResume: () => {
            this.paused = false;
            this.game.ui.hideScreen();
          },
          onRestart: () => {
            this.game.startLevel(this.level.id);
          },
          onMap: () => {
            this.game.goMap();
          },
        });
      } else {
        this.game.ui.hideScreen();
      }
    }

    update(dt) {
      if (this.game.input.wasPressed("Escape")) {
        this.togglePause();
      }
      if (this.game.input.wasPressed("KeyR")) {
        this.game.startLevel(this.level.id);
        return;
      }

      const targetZoom = 1.06 + Math.sin(this.game.time * 0.14) * 0.01;
      this.camera.zoom = damp(this.camera.zoom, targetZoom, 3, dt);

      if (!this.paused) {
        const pointerWorld = this.game.renderer.screenToWorld(
          this.game.input.pointer.x,
          this.game.input.pointer.y,
          this.level.world,
          this.camera
        );
        this.session.update(dt, pointerWorld);

        this.camera.x = damp(
          this.camera.x,
          this.session.player.pos.x + Math.sin(this.game.time * 0.3) * 14,
          2.4,
          dt
        );
        this.camera.y = damp(
          this.camera.y,
          this.session.player.pos.y - 36 + Math.cos(this.game.time * 0.34) * 10,
          2.4,
          dt
        );

        if (this.session.victory && this.session.victoryTimer > 1.65 && !this.completeHandled) {
          this.completeHandled = true;
          const result = this.session.getResult();
          this.game.markLevelComplete(this.level.id, result);
          this.game.changeScene(new ResultScene(this.game, this.level.id, result));
          return;
        }
      }

      this.game.ui.updateHud({
        title: this.level.title,
        subtitle: this.level.biome,
        progress: this.session.progress,
        light: this.session.player.light,
        moonDrops: this.session.stats.moonDrops,
        totalMoonDrops: this.session.moonDrops.length,
        pauseVisible: true,
      });
    }

    render(renderer) {
      renderer.renderLevel(this.session, this.camera, this.paused);
    }

    getAudioState() {
      return this.session ? this.session.getAudioState() : super.getAudioState();
    }
  }

  class ResultScene extends BaseScene {
    constructor(game, levelId, result) {
      super(game);
      this.level = this.game.getLevel(levelId);
      this.result = result;
    }

    enter() {
      this.game.clearTransient();
      const nextLevel = this.game.getNextLevel(this.level.id);
      this.game.ui.showResult(this.level, this.result, Boolean(nextLevel), {
        onNext: () => {
          if (nextLevel) {
            this.game.startLevel(nextLevel.id);
          } else {
            this.game.goFinale();
          }
        },
        onReplay: () => {
          this.game.startLevel(this.level.id);
        },
        onMap: () => {
          this.game.goMap();
        },
      });
      this.game.ui.hideHud();
    }

    render(renderer) {
      renderer.renderResult(this.level, this.game.progress, this.game.time);
    }

    getAudioState() {
      return {
        dryness: 0.18,
        energy: 0.7,
        progressPulse: 0,
      };
    }
  }

  class FinaleScene extends BaseScene {
    enter() {
      this.game.clearTransient();
      this.game.ui.showFinale(this.game.progress, {
        onReplayAll: () => {
          this.game.resetProgress();
          this.game.goMap();
        },
        onMap: () => {
          this.game.goMap();
        },
      });
    }

    render(renderer) {
      renderer.renderFinale(this.game.levels, this.game.progress, this.game.time);
    }

    getAudioState() {
      return {
        dryness: 0.04,
        energy: 0.92,
        progressPulse: 0,
      };
    }
  }

  MoonDew.scenes = {
    MenuScene,
    MapScene,
    LevelScene,
    ResultScene,
    FinaleScene,
  };
})();
