export function lerp(start, end, amt) {
    return (1 - amt) * start + amt * end;
}

export function distSq(x1, y1, x2, y2) {
    return (x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1);
}

export function dist(x1, y1, x2, y2) {
    return Math.sqrt(distSq(x1, y1, x2, y2));
}

// Vector math
export class Vec2 {
    constructor(x = 0, y = 0) {
        this.x = x;
        this.y = y;
    }
    
    add(v) {
        this.x += v.x;
        this.y += v.y;
        return this;
    }
    
    sub(v) {
        this.x -= v.x;
        this.y -= v.y;
        return this;
    }
    
    mult(n) {
        this.x *= n;
        this.y *= n;
        return this;
    }
    
    magSq() {
        return this.x * this.x + this.y * this.y;
    }
    
    mag() {
        return Math.sqrt(this.magSq());
    }
    
    normalize() {
        let m = this.mag();
        if (m > 0) {
            this.mult(1 / m);
        }
        return this;
    }
    
    copy() {
        return new Vec2(this.x, this.y);
    }
}
