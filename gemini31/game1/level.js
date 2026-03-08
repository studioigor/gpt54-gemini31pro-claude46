import { Bud, Shadow } from './entities.js';
import { Vec2 } from './math.js';

export const levelData = [
    {
        name: "Уровень 1",
        playerStart: { x: 100, y: 100 },
        buds: [
            { x: 300, y: 300 },
            { x: 500, y: 250 },
            { x: 600, y: 450 },
            { x: 400, y: 600 }
        ],
        mainBud: { x: 800, y: 400 },
        shadow: { x: 500, y: 100 }
    }
];

export class Level {
    constructor(dataIndex, width, height) {
        let data = levelData[dataIndex];
        this.width = width;
        this.height = height;
        this.buds = [];
        this.shadows = [];

        // Load buds
        for (let b of data.buds) {
            let rx = (b.x / 1000) * width;
            let ry = (b.y / 1000) * height; // normalize to 1000x1000 pseudo-space
            this.buds.push(new Bud(rx, ry, false));
        }

        let mx = (data.mainBud.x / 1000) * width;
        let my = (data.mainBud.y / 1000) * height;
        this.mainBud = new Bud(mx, my, true);

        // Load shadow
        let sx = (data.shadow.x / 1000) * width;
        let sy = (data.shadow.y / 1000) * height;
        this.shadows.push(new Shadow(sx, sy));

        // Start pos scaled
        this.startPos = new Vec2((data.playerStart.x / 1000) * width, (data.playerStart.y / 1000) * height);
    }

    update(dt, player) {
        for (let b of this.buds) {
            b.update(dt, player, this.shadows[0]);
        }
        for (let s of this.shadows) {
            s.update(dt);
        }
        this.mainBud.update(dt, player, this.shadows[0]);
    }

    draw(ctx) {
        // Shadow first
        for (let s of this.shadows) {
            s.draw(ctx);
        }

        // Draw connections (vines/stems between buds logic)
        ctx.beginPath();
        ctx.strokeStyle = '#344e41';
        ctx.lineWidth = 4;
        let p1 = this.buds[0];
        let p2 = this.buds[1];
        // Draw simple generic paths here if wanted

        for (let b of this.buds) {
            b.draw(ctx);
        }
        this.mainBud.draw(ctx);
    }

    getProgress() {
        let alive = 0;
        for (let b of this.buds) {
            if (b.state === 'alive') alive++;
        }
        return alive / this.buds.length;
    }
}
