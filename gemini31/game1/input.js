export const Input = {
    x: window.innerWidth / 2,
    y: window.innerHeight / 2,
    isDown: false,
    justPressed: false,
    justReleased: false,

    init(canvas) {
        const updatePos = (e) => {
            const rect = canvas.getBoundingClientRect();
            if (e.touches && e.touches.length > 0) {
                this.x = e.touches[0].clientX - rect.left;
                this.y = e.touches[0].clientY - rect.top;
            } else if (e.clientX !== undefined) {
                this.x = e.clientX - rect.left;
                this.y = e.clientY - rect.top;
            }
        };

        const onDown = (e) => {
            if (!this.isDown) this.justPressed = true;
            this.isDown = true;
            updatePos(e);
        };

        const onUp = (e) => {
            if (this.isDown) this.justReleased = true;
            this.isDown = false;
        };

        window.addEventListener('mousedown', onDown);
        window.addEventListener('mousemove', updatePos);
        window.addEventListener('mouseup', onUp);

        window.addEventListener('touchstart', onDown, { passive: false });
        window.addEventListener('touchmove', (e) => {
            e.preventDefault(); // Prevent scrolling on touch
            updatePos(e);
        }, { passive: false });
        window.addEventListener('touchend', onUp);
    },

    update() {
        this.justPressed = false;
        this.justReleased = false;
    }
};
