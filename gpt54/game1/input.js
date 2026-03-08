(() => {
  const MoonDew = (window.MoonDew = window.MoonDew || {});

  class InputController {
    constructor(canvas) {
      this.canvas = canvas;
      this.pointer = {
        x: canvas.width * 0.5,
        y: canvas.height * 0.5,
        inside: false,
        moved: false,
      };
      this.isDown = false;
      this.justPressed = false;
      this.justReleased = false;
      this.holdDuration = 0;
      this.releasedHoldDuration = 0;
      this.lastRelease = { x: 0, y: 0 };
      this.keysDown = new Set();
      this.keysPressed = new Set();
      this.keysReleased = new Set();
      this.lastPointerDelta = { x: 0, y: 0 };

      this.boundMove = (event) => this.onPointerMove(event);
      this.boundDown = (event) => this.onPointerDown(event);
      this.boundUp = (event) => this.onPointerUp(event);
      this.boundKeyDown = (event) => this.onKeyDown(event);
      this.boundKeyUp = (event) => this.onKeyUp(event);

      this.attach();
    }

    attach() {
      this.canvas.addEventListener("pointermove", this.boundMove);
      this.canvas.addEventListener("pointerdown", this.boundDown);
      window.addEventListener("pointerup", this.boundUp);
      window.addEventListener("pointercancel", this.boundUp);
      this.canvas.addEventListener("pointerenter", this.boundMove);
      this.canvas.addEventListener("pointerleave", () => {
        this.pointer.inside = false;
      });
      this.canvas.addEventListener("contextmenu", (event) => event.preventDefault());
      window.addEventListener("keydown", this.boundKeyDown);
      window.addEventListener("keyup", this.boundKeyUp);
    }

    destroy() {
      this.canvas.removeEventListener("pointermove", this.boundMove);
      this.canvas.removeEventListener("pointerdown", this.boundDown);
      window.removeEventListener("pointerup", this.boundUp);
      window.removeEventListener("pointercancel", this.boundUp);
      window.removeEventListener("keydown", this.boundKeyDown);
      window.removeEventListener("keyup", this.boundKeyUp);
    }

    update(dt) {
      if (this.isDown) {
        this.holdDuration += dt;
      }
    }

    endFrame() {
      this.justPressed = false;
      this.justReleased = false;
      this.releasedHoldDuration = 0;
      this.lastPointerDelta.x = 0;
      this.lastPointerDelta.y = 0;
      this.keysPressed.clear();
      this.keysReleased.clear();
      this.pointer.moved = false;
    }

    wasPressed(code) {
      return this.keysPressed.has(code);
    }

    wasReleased(code) {
      return this.keysReleased.has(code);
    }

    onPointerMove(event) {
      const rect = this.canvas.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width) * this.canvas.width;
      const y = ((event.clientY - rect.top) / rect.height) * this.canvas.height;
      this.lastPointerDelta.x = x - this.pointer.x;
      this.lastPointerDelta.y = y - this.pointer.y;
      this.pointer.x = x;
      this.pointer.y = y;
      this.pointer.inside = x >= 0 && y >= 0 && x <= this.canvas.width && y <= this.canvas.height;
      this.pointer.moved = true;
    }

    onPointerDown(event) {
      this.canvas.setPointerCapture?.(event.pointerId);
      this.onPointerMove(event);
      this.isDown = true;
      this.justPressed = true;
      this.holdDuration = 0;
    }

    onPointerUp(event) {
      if (!this.isDown) {
        return;
      }
      this.justReleased = true;
      this.isDown = false;
      this.releasedHoldDuration = this.holdDuration;
      this.holdDuration = 0;

      if (event && typeof event.clientX === "number") {
        const rect = this.canvas.getBoundingClientRect();
        this.lastRelease.x = ((event.clientX - rect.left) / rect.width) * this.canvas.width;
        this.lastRelease.y = ((event.clientY - rect.top) / rect.height) * this.canvas.height;
      } else {
        this.lastRelease.x = this.pointer.x;
        this.lastRelease.y = this.pointer.y;
      }
    }

    onKeyDown(event) {
      if (!this.keysDown.has(event.code)) {
        this.keysPressed.add(event.code);
      }
      this.keysDown.add(event.code);
    }

    onKeyUp(event) {
      this.keysDown.delete(event.code);
      this.keysReleased.add(event.code);
    }
  }

  MoonDew.InputController = InputController;
})();
