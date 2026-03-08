const UI = {
    screens: document.querySelectorAll('.screen'),
    score: document.getElementById('score'),
    finalScore: document.getElementById('final-score'),
    wave: document.getElementById('wave'),
    combo: document.getElementById('combo-display'),
    container: document.getElementById('game-container')
};

function showScreen(id) {
    UI.screens.forEach(s => s.classList.remove('active'));
    if (id) document.getElementById(id).classList.add('active');
}

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const bgCanvas = document.getElementById('backgroundCanvas');
const bgCtx = bgCanvas.getContext('2d', { alpha: false });
const debrisCanvas = document.getElementById('debrisCanvas');
const debrisCtx = debrisCanvas.getContext('2d', { alpha: true });

let cw, ch;

// Game State
let state = 'MENU'; // MENU, PLAYING, GAMEOVER
let score = 0;
let wave = 1;
let lastTime = 0;
let shakeTime = 0;
let shakeMagnitude = 0;
let lastComboTimer = 0;
let comboMultiplier = 1;

let player;
let enemies = [];
let bullets = [];
let particles = [];
let debris = [];

const input = {
    keys: {},
    mouse: { x: 0, y: 0, down: false }
};

window.addEventListener('keydown', e => input.keys[e.key.toLowerCase()] = true);
window.addEventListener('keyup', e => input.keys[e.key.toLowerCase()] = false);
window.addEventListener('mousemove', e => {
    const rect = canvas.getBoundingClientRect();
    input.mouse.x = e.clientX - rect.left;
    input.mouse.y = e.clientY - rect.top;
});
window.addEventListener('mousedown', e => {
    if (e.button === 0) input.mouse.down = true;
});
window.addEventListener('mouseup', e => {
    if (e.button === 0) input.mouse.down = false;
});

document.getElementById('start-btn').addEventListener('click', startGame);
document.getElementById('restart-btn').addEventListener('click', startGame);

function resize() {
    cw = UI.container.clientWidth;
    ch = UI.container.clientHeight;
    bgCanvas.width = cw; bgCanvas.height = ch;
    debrisCanvas.width = cw; debrisCanvas.height = ch;
    canvas.width = cw; canvas.height = ch;
    generateVelvet();
}

window.addEventListener('resize', () => {
    if (state === 'MENU') resize();
});

function generateVelvet() {
    // Deep realistic texture for velvet
    const grad = bgCtx.createLinearGradient(0, 0, cw, ch);
    grad.addColorStop(0, '#112214'); // Very dark green
    grad.addColorStop(1, '#1e3822'); // Medium dark green
    bgCtx.fillStyle = grad;
    bgCtx.fillRect(0, 0, cw, ch);
    
    // Noise to simulate fabric
    const imgData = bgCtx.getImageData(0, 0, cw, ch);
    const data = imgData.data;
    for(let i=0; i<data.length; i+=4) {
        const noise = (Math.random() - 0.5) * 15;
        data[i] = Math.min(255, Math.max(0, data[i] + noise));
        data[i+1] = Math.min(255, Math.max(0, data[i+1] + noise));
        data[i+2] = Math.min(255, Math.max(0, data[i+2] + noise));
    }
    bgCtx.putImageData(imgData, 0, 0);
}

function dist(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
}

function screenShake(time, magnitude) {
    if (shakeTime > 0 && shakeMagnitude > magnitude) return; // Don't override bigger shake
    shakeTime = time;
    shakeMagnitude = magnitude;
}

// CLASSES

class Player {
    constructor() {
        this.x = cw / 2;
        this.y = ch / 2;
        this.vx = 0;
        this.vy = 0;
        this.r = 24; // Thicker brass piece
        this.speed = 1200; 
        this.friction = 0.82;
        this.hp = 100;
        this.maxHp = 100;
        this.shootCooldown = 0;
        this.invincibleTimer = 0;
    }
    
    update(dt) {
        if (this.invincibleTimer > 0) this.invincibleTimer -= dt;

        let ax = 0, ay = 0;
        if (input.keys['w']) ay -= 1;
        if (input.keys['s']) ay += 1;
        if (input.keys['a']) ax -= 1;
        if (input.keys['d']) ax += 1;
        
        let mag = Math.hypot(ax, ay);
        if (mag > 0) {
            ax /= mag; ay /= mag;
        }
        
        this.vx += ax * this.speed * dt;
        this.vy += ay * this.speed * dt;
        
        // Skid marks on high speeds
        const speed = Math.hypot(this.vx, this.vy);
        if (speed > 350 && Math.random() > 0.4) {
            debrisCtx.fillStyle = 'rgba(0,0,0,0.06)';
            debrisCtx.beginPath();
            debrisCtx.arc(this.x, this.y, this.r * 0.7, 0, Math.PI*2);
            debrisCtx.fill();
        }
        
        this.vx *= this.friction;
        this.vy *= this.friction;
        
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        
        // Walls
        if (this.x < this.r) { this.x = this.r; this.vx *= -0.8; screenShake(0.05, 2); }
        if (this.x > cw - this.r) { this.x = cw - this.r; this.vx *= -0.8; screenShake(0.05, 2); }
        if (this.y < this.r) { this.y = this.r; this.vy *= -0.8; screenShake(0.05, 2); }
        if (this.y > ch - this.r) { this.y = ch - this.r; this.vy *= -0.8; screenShake(0.05, 2); }
        
        // Shoot
        if (this.shootCooldown > 0) this.shootCooldown -= dt;
        if (input.mouse.down && this.shootCooldown <= 0) {
            this.shoot();
        }
    }
    
    shoot() {
        this.shootCooldown = 0.4;
        let angle = Math.atan2(input.mouse.y - this.y, input.mouse.x - this.x);
        
        let bx = this.x + Math.cos(angle) * (this.r + 8);
        let by = this.y + Math.sin(angle) * (this.r + 8);
        bullets.push(new Bullet(bx, by, angle));
        
        // Recoil
        this.vx -= Math.cos(angle) * 350;
        this.vy -= Math.sin(angle) * 350;
        
        screenShake(0.1, 5);
        
        // Smoke
        for(let i=0; i<4; i++) {
            particles.push(new Particle(bx, by, angle + (Math.random()-0.5)*0.8, 40 + Math.random()*80, 'rgba(180,180,180,0.5)', 0.4));
        }
    }
    
    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        
        // Flash if hit
        let isFlashing = this.invincibleTimer > 0 && Math.floor(this.invincibleTimer * 20) % 2 === 0;

        // Shadow
        ctx.shadowColor = 'rgba(0,0,0,0.85)';
        ctx.shadowBlur = 15;
        ctx.shadowOffsetX = 6;
        ctx.shadowOffsetY = 6;
        
        // Materials (Brass)
        const grad = ctx.createRadialGradient(-this.r*0.3, -this.r*0.3, this.r*0.1, 0, 0, this.r);
        grad.addColorStop(0, isFlashing ? '#ffffff' : '#fcf5c7'); 
        grad.addColorStop(0.3, isFlashing ? '#ffa8a8' : '#d4af37'); 
        grad.addColorStop(1, isFlashing ? '#8a0a0a' : '#59440c');
        
        ctx.beginPath();
        ctx.arc(0, 0, this.r, 0, Math.PI*2);
        ctx.fillStyle = grad;
        ctx.fill();
        
        // Inner groove
        ctx.shadowColor = 'transparent';
        ctx.beginPath();
        ctx.arc(0, 0, this.r * 0.55, 0, Math.PI*2);
        ctx.strokeStyle = '#413008';
        ctx.lineWidth = 3;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(0, 0, this.r * 0.2, 0, Math.PI*2);
        ctx.fillStyle = '#413008';
        ctx.fill();
        
        // HP Bar Arc
        const hpPercent = this.hp / this.maxHp;
        ctx.beginPath();
        ctx.arc(0, 0, this.r + 8, -Math.PI, -Math.PI + Math.PI*2 * hpPercent);
        ctx.strokeStyle = hpPercent > 0.3 ? '#82b74b' : '#c62828';
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.stroke();
        
        ctx.restore();
    }
}

class Enemy {
    constructor(x, y, level) {
        this.x = x;
        this.y = y;
        this.vx = 0;
        this.vy = 0;
        this.r = 16 + Math.random() * 6; // Gear size
        this.hp = 20 + level * 8;
        this.speed = 120 + level * 10;
        this.angle = 0;
        this.teeth = 6 + Math.floor(Math.random()*4);
        
        // Pre-render gear into offscreen canvas for performance if needed, but doing it real-time offers gradient rotation
    }
    
    update(dt) {
        let sepX = 0, sepY = 0;
        for (let other of enemies) {
            if (other === this) continue;
            let d = dist(this, other);
            if (d < this.r + other.r + 5) {
                sepX += (this.x - other.x) / d;
                sepY += (this.y - other.y) / d;
            }
        }
        
        let targetAngle = Math.atan2(player.y - this.y, player.x - this.x);
        
        let ax = Math.cos(targetAngle) + sepX * 2.0;
        let ay = Math.sin(targetAngle) + sepY * 2.0;
        
        let mag = Math.hypot(ax, ay);
        if (mag > 0) {
            this.vx += (ax/mag) * this.speed * dt * 4;
            this.vy += (ay/mag) * this.speed * dt * 4;
        }
        
        this.vx *= 0.9; 
        this.vy *= 0.9;
        
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        
        // Rotation based on movement speed
        this.angle += Math.hypot(this.vx, this.vy) * 0.004 * (this.vx > 0 ? 1 : -1);
        
        // Collision with player
        if (player.invincibleTimer <= 0 && dist(this, player) < this.r + player.r) {
            player.hp -= 15;
            player.invincibleTimer = 0.5;
            
            player.vx += Math.cos(targetAngle) * 500;
            player.vy += Math.sin(targetAngle) * 500;
            screenShake(0.3, 10);
            
            spawnSparks(this.x, this.y, targetAngle, 10, '#ffbb00');
            
            this.vx -= Math.cos(targetAngle) * 400;
            this.vy -= Math.sin(targetAngle) * 400;
            this.hp -= 5;
        }
    }
    
    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);
        
        ctx.shadowColor = 'rgba(0,0,0,0.8)';
        ctx.shadowBlur = 10;
        ctx.shadowOffsetX = 4;
        ctx.shadowOffsetY = 4;
        
        const grad = ctx.createRadialGradient(-this.r*0.2, -this.r*0.2, 0, 0, 0, this.r);
        
        if (this.hp < 15) {
            grad.addColorStop(0, '#5e3818'); 
            grad.addColorStop(1, '#2c1507');
        } else {
            grad.addColorStop(0, '#6c7075'); 
            grad.addColorStop(0.7, '#383a3d'); 
            grad.addColorStop(1, '#1b1c1e');
        }
        
        // Gear path
        ctx.beginPath();
        for(let i=0; i<this.teeth * 2; i++) {
            let a = (i * Math.PI) / this.teeth;
            let rad = i % 2 === 0 ? this.r : this.r - 5;
            let xx = Math.cos(a) * rad;
            let yy = Math.sin(a) * rad;
            if(i===0) ctx.moveTo(xx, yy);
            else ctx.lineTo(xx, yy);
        }
        ctx.closePath();
        
        ctx.fillStyle = grad;
        ctx.fill();
        ctx.strokeStyle = '#050505';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        
        // Hole
        ctx.shadowColor = 'transparent';
        ctx.beginPath();
        ctx.arc(0, 0, this.r * 0.35, 0, Math.PI*2);
        ctx.fillStyle = '#050505';
        ctx.fill();
        
        ctx.restore();
    }
}

class Bullet {
    constructor(x, y, angle) {
        this.x = x;
        this.y = y;
        this.speed = 1500;
        this.vx = Math.cos(angle) * this.speed;
        this.vy = Math.sin(angle) * this.speed;
        this.r = 6;
        this.bounces = 0;
        this.maxBounces = 4;
        this.baseDamage = 20;
        this.dead = false;
        this.hitEnemies = new Set();
    }
    
    update(dt) {
        let steps = 4;
        let stepTime = dt / steps;
        
        for(let s=0; s<steps; s++) {
            this.x += this.vx * stepTime;
            this.y += this.vy * stepTime;
            
            let bounced = false;
            let nX = 1, nY = 1;

            if (this.x < this.r) { this.x = this.r; this.vx *= -1; bounced = true; nX = 1; nY = 0; }
            else if (this.x > cw - this.r) { this.x = cw - this.r; this.vx *= -1; bounced = true; nX = -1; nY = 0; }
            if (this.y < this.r) { this.y = this.r; this.vy *= -1; bounced = true; nX = 0; nY = 1; }
            else if (this.y > ch - this.r) { this.y = ch - this.r; this.vy *= -1; bounced = true; nX = 0; nY = -1;}
            
            if (bounced) {
                this.bounces++;
                this.hitEnemies.clear(); 
                
                screenShake(0.05, this.bounces * 2);

                // Ricochet sparks geometry (bounce opposite inward)
                let reflectAngle = Math.atan2(this.vy, this.vx);
                spawnSparks(this.x, this.y, reflectAngle, 10 + this.bounces*2, '#ffcc00');

                if (this.bounces > this.maxBounces) {
                    this.dead = true;
                    break;
                }
            }
            
            for (let e of enemies) {
                if (!this.hitEnemies.has(e) && dist(this, e) < this.r + e.r) {
                    this.hitEnemies.add(e);
                    
                    let mult = this.bounces === 0 ? 1 : Math.pow(3, this.bounces);
                    let dmg = this.baseDamage * mult;
                    
                    e.hp -= dmg;
                    e.vx += this.vx * 0.15;
                    e.vy += this.vy * 0.15;
                    
                    spawnSparks(this.x, this.y, Math.atan2(this.vy, this.vx) + Math.PI, 8 + this.bounces*2, this.bounces > 0 ? '#ff6b35' : '#ccc');
                    
                    if (e.hp <= 0 && !e.dead) {
                        e.dead = true;
                        handleEnemyDeath(e, this);
                    }
                    
                    if (this.bounces === 0) {
                        // Direct hit does not pierce
                        this.dead = true;
                    } else {
                        // Hook: Heated bullet pierces!
                        screenShake(0.05, 3);
                    }
                }
            }
            if(this.dead) break;
        }
    }
    
    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        
        ctx.shadowColor = this.bounces > 0 ? '#ff3300' : 'rgba(0,0,0,0.5)';
        ctx.shadowBlur = this.bounces > 0 ? 12 + this.bounces*3 : 5;
        
        ctx.beginPath();
        ctx.arc(0, 0, this.r, 0, Math.PI*2);
        
        if (this.bounces === 0) {
            ctx.fillStyle = '#dbdbdb'; 
        } else if (this.bounces === 1) {
            ctx.fillStyle = '#ffb347'; 
        } else if (this.bounces === 2) {
            ctx.fillStyle = '#ff4500'; 
        } else {
            ctx.fillStyle = '#ffffff'; 
            ctx.shadowColor = '#ffaa00';
            ctx.shadowBlur = 20;
        }
        
        ctx.fill();
        ctx.restore();
    }
}

class Particle {
    constructor(x, y, angle, speed, color, life=0.5) {
        this.x = x;
        this.y = y;
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;
        this.color = color;
        this.life = life;
        this.maxLife = life;
    }
    update(dt) {
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.vx *= 0.88;
        this.vy *= 0.88;
        this.life -= dt;
    }
    draw(ctx) {
        ctx.globalAlpha = Math.max(0, this.life / this.maxLife);
        ctx.fillStyle = this.color;
        ctx.beginPath();
        // Elongate sparks slightly using velocity vector? Let's just draw lines for sparks, circles for smoke.
        if (this.color.includes('rgba')) {
            ctx.arc(this.x, this.y, 3, 0, Math.PI*2);
            ctx.fill();
        } else {
            ctx.lineWidth = 2;
            ctx.strokeStyle = this.color;
            ctx.beginPath();
            ctx.moveTo(this.x, this.y);
            ctx.lineTo(this.x - this.vx * 0.05, this.y - this.vy * 0.05); // Trail
            ctx.stroke();
        }
        ctx.globalAlpha = 1;
    }
}

class DebrisObj {
    constructor(x, y, vx, vy) {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.angle = Math.random() * Math.PI * 2;
        this.vr = (Math.random() - 0.5) * 15;
        this.r = 3 + Math.random() * 6;
        this.isSpring = Math.random() > 0.8;
        this.dead = false;
        this.settleTime = 0.5 + Math.random() * 1.5;
    }
    update(dt) {
        if(this.dead) return;
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.angle += this.vr * dt;
        
        this.vx *= 0.94;
        this.vy *= 0.94;
        this.vr *= 0.94;
        
        this.settleTime -= dt;
        
        if (this.x < this.r || this.x > cw - this.r) this.vx *= -0.7;
        if (this.y < this.r || this.y > ch - this.r) this.vy *= -0.7;
        
        if (this.settleTime <= 0) {
            this.dead = true;
            this.draw(debrisCtx, true);
        }
    }
    draw(ctx, isSettled = false) {
        if(this.dead && !isSettled) return;
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);
        
        ctx.shadowColor = 'rgba(0,0,0,0.6)';
        ctx.shadowBlur = 5;
        ctx.shadowOffsetX = 3;
        ctx.shadowOffsetY = 3;
        
        ctx.strokeStyle = '#2a2a2a';
        ctx.lineWidth = 1.5;
        
        if (this.isSpring) {
            ctx.beginPath();
            ctx.moveTo(-this.r, 0);
            for(let i=-this.r; i<=this.r; i+=this.r/2.5) {
                ctx.lineTo(i, (i%2!==0?1:-1) * this.r/2);
            }
            ctx.stroke();
        } else {
            ctx.fillStyle = '#4a4a4a';
            ctx.beginPath();
            for(let i=0; i<5; i++) {
                let a = (i * Math.PI * 2) / 5;
                let rad = i%2===0 ? this.r : this.r*0.4;
                if(i===0) ctx.moveTo(Math.cos(a)*rad, Math.sin(a)*rad);
                else ctx.lineTo(Math.cos(a)*rad, Math.sin(a)*rad);
            }
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
        }
        
        ctx.restore();
    }
}

function spawnSparks(x, y, baseAngle, count, color) {
    for(let i=0; i<count; i++) {
        let angle = baseAngle + (Math.random() - 0.5) * 1.2;
        let speed = 150 + Math.random() * 400;
        particles.push(new Particle(x, y, angle, speed, color, 0.2 + Math.random()*0.3));
    }
}

function spawnDebris(x, y) {
    let count = 4 + Math.floor(Math.random()*6);
    for(let i=0; i<count; i++) {
        let angle = Math.random() * Math.PI * 2;
        let speed = 80 + Math.random() * 250;
        debris.push(new DebrisObj(x, y, Math.cos(angle)*speed, Math.sin(angle)*speed));
    }
}

function handleEnemyDeath(e, b) {
    let pts = 10;
    if (b.bounces === 1) pts = 50;
    else if (b.bounces >= 2) pts = 150;
    
    if (lastComboTimer > 0) {
        comboMultiplier++;
    } else {
        comboMultiplier = 1;
    }
    pts *= comboMultiplier;
    lastComboTimer = 2.0; 
    
    score += pts;
    UI.score.innerText = score;
    
    if (comboMultiplier > 1) {
        UI.combo.innerText = `x${comboMultiplier} Combo!`;
        UI.combo.classList.add('active');
        UI.combo.style.transform = `scale(${1 + Math.min(comboMultiplier*0.1, 0.5)})`;
    }
    
    spawnDebris(e.x, e.y);
    screenShake(0.15, 6);
    
    // Play sound visually via a big flash/smoke effect where it died
    spawnSparks(e.x, e.y, 0, 15, '#aaaaaa');
    for(let i=0; i<3; i++) {
        particles.push(new Particle(e.x, e.y, Math.random()*Math.PI*2, 30+Math.random()*50, 'rgba(50,50,50,0.6)', 0.6));
    }
}

function spawnWave() {
    wave++;
    UI.wave.innerText = `Wave ${wave}`;
    let count = Math.floor(wave * 1.8) + 4;
    let spawnDist = Math.max(cw, ch) / 2 + 100;
    
    for(let i=0; i<count; i++) {
        let a = Math.random() * Math.PI * 2;
        enemies.push(new Enemy(cw/2 + Math.cos(a)*spawnDist, ch/2 + Math.sin(a)*spawnDist, wave));
    }
}

function startGame() {
    resize();
    showScreen(null);
    state = 'PLAYING';
    score = 0;
    wave = 0;
    comboMultiplier = 1;
    lastComboTimer = 0;
    UI.combo.classList.remove('active');
    
    UI.score.innerText = score;
    UI.wave.innerText = `Wave 1`;
    
    player = new Player();
    enemies = [];
    bullets = [];
    particles = [];
    debris = [];
    debrisCtx.clearRect(0,0,cw,ch);
    
    spawnWave();
    lastTime = performance.now();
    requestAnimationFrame(loop);
}

function loop(time) {
    if (state !== 'PLAYING') return;
    requestAnimationFrame(loop);
    
    let dt = (time - lastTime) / 1000;
    if(dt > 0.1) dt = 0.1;
    lastTime = time;
    
    // Combo decay
    if (lastComboTimer > 0) {
        lastComboTimer -= dt;
        if (lastComboTimer <= 0) {
            UI.combo.classList.remove('active');
            comboMultiplier = 1;
        }
    }
    
    player.update(dt);
    if(player.hp <= 0) {
        state = 'GAMEOVER';
        UI.finalScore.innerText = score;
        showScreen('game-over');
        screenShake(0,0);
        UI.container.style.transform = `translate(0px, 0px)`;
        return;
    }
    
    bullets.forEach(b => b.update(dt));
    bullets = bullets.filter(b => !b.dead);
    
    enemies.forEach(e => e.update(dt));
    enemies = enemies.filter(e => !e.dead);
    
    if (enemies.length === 0) spawnWave();
    
    particles.forEach(p => p.update(dt));
    particles = particles.filter(p => p.life > 0);
    
    debris.forEach(d => d.update(dt));
    debris = debris.filter(d => !d.dead);
    
    // Draw
    ctx.clearRect(0, 0, cw, ch);
    
    // Screen shake
    ctx.save();
    if (shakeTime > 0) {
        shakeTime -= dt;
        let sx = (Math.random() - 0.5) * shakeMagnitude;
        let sy = (Math.random() - 0.5) * shakeMagnitude;
        UI.container.style.transform = `translate(${sx}px, ${sy}px)`;
    } else {
        UI.container.style.transform = `translate(0px, 0px)`;
    }
    
    debris.forEach(d => d.draw(ctx));
    player.draw(ctx);
    enemies.forEach(e => e.draw(ctx));
    bullets.forEach(b => b.draw(ctx));
    particles.forEach(p => p.draw(ctx));
    
    ctx.restore();
}

resize();
