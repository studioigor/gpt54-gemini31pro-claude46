'use strict';

// ============================================================
//  САД ЛУННОЙ РОСЫ  —  Garden of Moonlit Dew
// ============================================================

// -------------------- CONFIGURATION -------------------------
const W = 1000, H = 700;                 // virtual game size
const BUD_R = 14, PLAYER_R = 7;
const ACTIVATE_RANGE = 42;
const TRAIL_MAX = 60;
const SHADOW_DMG = 0.12;                 // energy drain / sec on shadow
const DRY_DMG = 0.06;
const WATER_HEAL = 0.18;
const BUD_HEAL = 0.04;
const DASH_IMPULSE = 320;
const PLAYER_ACCEL = 1400;
const PLAYER_DRAG = 4.2;
const CHAIN_SPEED = 160;                 // px/sec along connection

// -------------------- PALETTE -------------------------------
const C = {
    bgDeep:   '#060e1f', bgMid: '#0c1a33',
    dryBase:  '#7a6b5e', dryStem: '#6b5b4a', dryLeaf: '#5c5c42',
    aliveEmerald: '#2e8b57', aliveTeal: '#1b6b5a',
    moonlight: '#f0ebd8',
    playerCore: '#ffffff', playerGlow: '#a0d4ff', trailGlow: '#7bc4ff',
    shadowDark: '#0a0204', shadowEdge: '#2a1218',
    waterDeep: '#12304e', waterLight: '#3a7ab5', waterShimmer: '#8ac4ff',
    uiText: '#d4c9b0', uiDim: '#6a6050',
    petalRose: '#d4527b', petalAmber: '#daa520', petalViolet: '#8b6faf',
    petalBlue: '#5a8fc4', petalWhite: '#f0e8d8',
    alive1: '#3dbd6f', alive2: '#58c4a0',
};

// -------------------- MATH ----------------------------------
const lerp  = (a,b,t) => a + (b - a) * t;
const clamp = (v,lo,hi) => v < lo ? lo : v > hi ? hi : v;
const ease  = t => t < .5 ? 2*t*t : -1+(4-2*t)*t;
const easeOut = t => 1 - (1-t)*(1-t);
const dist  = (a,b) => Math.hypot(a.x-b.x, a.y-b.y);
const rnd   = (lo=0,hi=1) => lo + Math.random()*(hi-lo);
const rndInt = (lo,hi) => Math.floor(rnd(lo,hi+1));
const TAU = Math.PI * 2;
const v2 = (x=0,y=0) => ({x,y});
const v2add = (a,b) => ({x:a.x+b.x, y:a.y+b.y});
const v2sub = (a,b) => ({x:a.x-b.x, y:a.y-b.y});
const v2mul = (a,s) => ({x:a.x*s, y:a.y*s});
const v2len = a => Math.hypot(a.x, a.y);
const v2norm = a => { const l=v2len(a)||1; return {x:a.x/l,y:a.y/l}; };
const v2lerp = (a,b,t) => ({x:lerp(a.x,b.x,t), y:lerp(a.y,b.y,t)});

function bezierPoint(p0,p1,p2,t) {
    const u=1-t;
    return { x: u*u*p0.x + 2*u*t*p1.x + t*t*p2.x,
             y: u*u*p0.y + 2*u*t*p1.y + t*t*p2.y };
}

// Simple seeded noise for textures
function simpleNoise(x,y) {
    let n = Math.sin(x*127.1+y*311.7)*43758.5453;
    return n - Math.floor(n);
}

// -------------------- AUDIO ---------------------------------
let audioCtx = null;
let masterGain = null;
let musicGain = null;
let sfxGain = null;
let musicOscs = [];
let ambientStarted = false;

function initAudio() {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = audioCtx.createGain();
    masterGain.gain.value = 0.5;
    masterGain.connect(audioCtx.destination);
    musicGain = audioCtx.createGain();
    musicGain.gain.value = 0.25;
    musicGain.connect(masterGain);
    sfxGain = audioCtx.createGain();
    sfxGain.gain.value = 0.6;
    sfxGain.connect(masterGain);
}

function ensureAudio() {
    if (!audioCtx) initAudio();
    if (audioCtx.state === 'suspended') audioCtx.resume();
}

function playTone(freq, dur, type='sine', vol=0.3, detune=0) {
    if (!audioCtx) return;
    const t = audioCtx.currentTime;
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = type;
    o.frequency.value = freq;
    o.detune.value = detune;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g);
    g.connect(sfxGain);
    o.start(t);
    o.stop(t + dur + 0.05);
}

function sfxBudAwaken(pitch=0) {
    const base = 600 + pitch * 80;
    playTone(base, 0.5, 'sine', 0.2);
    playTone(base * 1.5, 0.4, 'sine', 0.1, 5);
    playTone(base * 2, 0.3, 'triangle', 0.06, -3);
}

function sfxChain() {
    playTone(900 + rnd(-50,50), 0.15, 'sine', 0.08);
}

function sfxSplash() {
    if (!audioCtx) return;
    const t = audioCtx.currentTime;
    const buf = audioCtx.createBuffer(1, audioCtx.sampleRate * 0.15, audioCtx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random()*2-1) * (1 - i/d.length);
    const src = audioCtx.createBufferSource();
    src.buffer = buf;
    const filt = audioCtx.createBiquadFilter();
    filt.type = 'bandpass'; filt.frequency.value = 2000; filt.Q.value = 1.5;
    const g = audioCtx.createGain();
    g.gain.setValueAtTime(0.15, t);
    g.gain.exponentialRampToValueAtTime(0.001, t+0.15);
    src.connect(filt); filt.connect(g); g.connect(sfxGain);
    src.start(t); src.stop(t+0.2);
}

function sfxVictory() {
    const notes = [523, 659, 784, 1047];
    notes.forEach((f,i) => {
        setTimeout(() => playTone(f, 1.2 - i*0.15, 'sine', 0.18 - i*0.03), i * 150);
    });
}

function sfxDash() {
    playTone(1200, 0.1, 'sine', 0.1);
    playTone(800, 0.15, 'triangle', 0.06);
}

function startAmbient() {
    if (ambientStarted || !audioCtx) return;
    ambientStarted = true;
    const t = audioCtx.currentTime;
    // Low drone
    const o1 = audioCtx.createOscillator();
    o1.type = 'sine'; o1.frequency.value = 65;
    const g1 = audioCtx.createGain(); g1.gain.value = 0.06;
    o1.connect(g1); g1.connect(musicGain); o1.start(t);
    // Higher pad
    const o2 = audioCtx.createOscillator();
    o2.type = 'sine'; o2.frequency.value = 196;
    const g2 = audioCtx.createGain(); g2.gain.value = 0.03;
    o2.connect(g2); g2.connect(musicGain); o2.start(t);
    // Slow LFO on pad
    const lfo = audioCtx.createOscillator();
    lfo.type = 'sine'; lfo.frequency.value = 0.15;
    const lfoG = audioCtx.createGain(); lfoG.gain.value = 0.02;
    lfo.connect(lfoG); lfoG.connect(g2.gain); lfo.start(t);
    musicOscs.push(o1,o2,lfo);
}

// -------------------- INPUT ---------------------------------
const input = {
    mx: W/2, my: H/2, down: false,
    wasDown: false, holdTime: 0,
    clicked: false, dashReady: false,
    rawX: 0, rawY: 0,
};

function initInput(canvas) {
    function pos(e) {
        const r = canvas.getBoundingClientRect();
        const sx = W / r.width, sy = H / r.height;
        const cx = (e.clientX - r.left) * sx;
        const cy = (e.clientY - r.top) * sy;
        input.mx = clamp(cx, 0, W);
        input.my = clamp(cy, 0, H);
    }
    canvas.addEventListener('mousemove', pos);
    canvas.addEventListener('mousedown', e => { pos(e); input.down = true; input.clicked = true; ensureAudio(); });
    canvas.addEventListener('mouseup', e => { pos(e); input.down = false; });
    canvas.addEventListener('touchstart', e => {
        e.preventDefault();
        const t = e.touches[0];
        const r = canvas.getBoundingClientRect();
        input.mx = (t.clientX - r.left) * (W/r.width);
        input.my = (t.clientY - r.top) * (H/r.height);
        input.down = true; input.clicked = true; ensureAudio();
    }, {passive:false});
    canvas.addEventListener('touchmove', e => {
        e.preventDefault();
        const t = e.touches[0];
        const r = canvas.getBoundingClientRect();
        input.mx = (t.clientX - r.left) * (W/r.width);
        input.my = (t.clientY - r.top) * (H/r.height);
    }, {passive:false});
    canvas.addEventListener('touchend', e => { e.preventDefault(); input.down = false; }, {passive:false});
}

function updateInput(dt) {
    if (input.down) {
        input.holdTime += dt;
    } else {
        if (input.wasDown && input.holdTime > 0.15) {
            input.dashReady = true;
        }
        input.holdTime = 0;
    }
    input.wasDown = input.down;
}

// -------------------- PARTICLES -----------------------------
const MAX_PARTICLES = 600;
const particles = [];

function spawnParticle(x, y, vx, vy, life, r, color, type='default') {
    if (particles.length >= MAX_PARTICLES) {
        const idx = particles.findIndex(p => p.life <= 0);
        if (idx >= 0) particles.splice(idx, 1);
        else return;
    }
    particles.push({x,y,vx,vy,life,maxLife:life,r,color,type,alpha:1});
}

function updateParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.life -= dt;
        p.alpha = clamp(p.life / p.maxLife, 0, 1);
        if (p.type === 'pollen') { p.vx += rnd(-20,20)*dt; p.vy -= 15*dt; }
        if (p.type === 'dust') { p.vx *= 0.98; p.vy *= 0.98; }
        if (p.life <= 0) { particles.splice(i, 1); }
    }
}

function drawParticles(ctx) {
    for (const p of particles) {
        ctx.globalAlpha = p.alpha * 0.8;
        if (p.type === 'glow') {
            const g = ctx.createRadialGradient(p.x,p.y,0, p.x,p.y,p.r);
            g.addColorStop(0, p.color);
            g.addColorStop(1, 'transparent');
            ctx.fillStyle = g;
            ctx.fillRect(p.x-p.r, p.y-p.r, p.r*2, p.r*2);
        } else {
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r * p.alpha, 0, TAU);
            ctx.fill();
        }
    }
    ctx.globalAlpha = 1;
}

function burstParticles(x, y, count, color, speed=60, life=0.8, r=2.5, type='default') {
    for (let i = 0; i < count; i++) {
        const a = rnd(0, TAU);
        const s = rnd(speed*0.3, speed);
        spawnParticle(x, y, Math.cos(a)*s, Math.sin(a)*s, rnd(life*0.5,life), rnd(r*0.5,r), color, type);
    }
}

// -------------------- PLAYER --------------------------------
const player = {
    x: 500, y: 600,
    vx: 0, vy: 0,
    energy: 1.0,
    trail: [],
    alive: true,
    pulseT: 0,
    dashCooldown: 0,
};

function resetPlayer(x, y) {
    player.x = x; player.y = y;
    player.vx = 0; player.vy = 0;
    player.energy = 1.0;
    player.trail = [];
    player.alive = true;
    player.dashCooldown = 0;
}

function updatePlayer(dt, level) {
    player.pulseT += dt;
    player.dashCooldown = Math.max(0, player.dashCooldown - dt);

    // Move toward cursor
    const dx = input.mx - player.x;
    const dy = input.my - player.y;
    const d = Math.hypot(dx, dy);
    if (d > 2) {
        const nx = dx/d, ny = dy/d;
        const accel = Math.min(d * 3, PLAYER_ACCEL);
        player.vx += nx * accel * dt;
        player.vy += ny * accel * dt;
    }
    // Drag
    player.vx *= Math.exp(-PLAYER_DRAG * dt);
    player.vy *= Math.exp(-PLAYER_DRAG * dt);

    // Dash on release
    if (input.dashReady && player.dashCooldown <= 0) {
        input.dashReady = false;
        const speed = v2len({x:player.vx, y:player.vy});
        if (speed > 10) {
            const dir = v2norm({x:player.vx, y:player.vy});
            player.vx += dir.x * DASH_IMPULSE;
            player.vy += dir.y * DASH_IMPULSE;
            player.dashCooldown = 0.3;
            burstParticles(player.x, player.y, 8, C.playerGlow, 100, 0.4, 3, 'glow');
            sfxDash();
        }
    }

    player.x += player.vx * dt;
    player.y += player.vy * dt;
    // Bounds
    player.x = clamp(player.x, 10, W - 10);
    player.y = clamp(player.y, 10, H - 10);

    // Trail
    if (input.down) {
        player.trail.push({x: player.x, y: player.y, life: 1.5});
    }
    for (let i = player.trail.length - 1; i >= 0; i--) {
        player.trail[i].life -= dt;
        if (player.trail[i].life <= 0) player.trail.splice(i, 1);
    }
    if (player.trail.length > TRAIL_MAX) player.trail.splice(0, player.trail.length - TRAIL_MAX);

    // Energy
    let onWater = false, nearBud = false;
    if (level) {
        for (const w of level.waterAreas) {
            const dx2 = (player.x - w.x) / w.rx;
            const dy2 = (player.y - w.y) / w.ry;
            if (dx2*dx2 + dy2*dy2 < 1) { onWater = true; break; }
        }
        for (const b of level.buds) {
            if (b.state === 'alive' && dist(player, b) < 60) { nearBud = true; break; }
        }
        const inShadow = level.shadow && dist(player, level.shadow) < level.shadow.radius;
        const inDry = !onWater && !nearBud;

        if (inShadow) player.energy -= SHADOW_DMG * dt;
        else if (onWater) player.energy += WATER_HEAL * dt;
        else if (nearBud) player.energy += BUD_HEAL * dt;
        else player.energy -= DRY_DMG * dt;
        player.energy = clamp(player.energy, 0, 1);

        // Respawn if depleted
        if (player.energy <= 0) {
            let respawn = level.playerStart;
            for (const b of level.buds) {
                if (b.state === 'alive') { respawn = b; break; }
            }
            player.x = respawn.x;
            player.y = respawn.y + 30;
            player.vx = 0; player.vy = 0;
            player.energy = 0.5;
            player.trail = [];
            burstParticles(player.x, player.y, 12, C.moonlight, 40, 0.6, 2);
        }
    }

    // Ambient particles
    if (Math.random() < 0.3) {
        spawnParticle(player.x + rnd(-4,4), player.y + rnd(-4,4),
            rnd(-8,8), rnd(-15,-5), rnd(0.3,0.7), rnd(1,2.5),
            onWater ? C.waterShimmer : C.playerGlow, 'glow');
    }
}

function drawPlayer(ctx) {
    // Trail
    const tLen = player.trail.length;
    for (let i = 0; i < tLen; i++) {
        const t = player.trail[i];
        const a = (t.life / 1.5) * 0.5 * (i / tLen);
        ctx.globalAlpha = a;
        const r = 4 * (t.life / 1.5);
        const grad = ctx.createRadialGradient(t.x, t.y, 0, t.x, t.y, r + 3);
        grad.addColorStop(0, C.trailGlow);
        grad.addColorStop(1, 'transparent');
        ctx.fillStyle = grad;
        ctx.fillRect(t.x - r - 3, t.y - r - 3, (r+3)*2, (r+3)*2);
    }
    ctx.globalAlpha = 1;

    const pulse = 1 + Math.sin(player.pulseT * 3) * 0.08;
    const eR = PLAYER_R * pulse;
    const glow = eR * (2 + player.energy * 2);

    // Outer glow
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const g1 = ctx.createRadialGradient(player.x, player.y, 0, player.x, player.y, glow);
    g1.addColorStop(0, `rgba(160,212,255,${0.25 * player.energy})`);
    g1.addColorStop(1, 'transparent');
    ctx.fillStyle = g1;
    ctx.fillRect(player.x - glow, player.y - glow, glow*2, glow*2);
    ctx.restore();

    // Core
    const g2 = ctx.createRadialGradient(player.x, player.y, 0, player.x, player.y, eR);
    g2.addColorStop(0, C.playerCore);
    g2.addColorStop(0.4, C.playerGlow);
    g2.addColorStop(1, 'rgba(160,212,255,0)');
    ctx.fillStyle = g2;
    ctx.beginPath();
    ctx.arc(player.x, player.y, eR + 2, 0, TAU);
    ctx.fill();

    // Bright center
    ctx.fillStyle = C.playerCore;
    ctx.globalAlpha = 0.8 + player.energy * 0.2;
    ctx.beginPath();
    ctx.arc(player.x, player.y, eR * 0.4, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
}

// -------------------- BUD -----------------------------------
function createBud(x, y, colorKey, index) {
    return {
        x, y, index,
        state: 'sleeping',   // sleeping, awakening, alive, wilting
        stateT: 0,
        colorKey,
        color: C['petal' + colorKey.charAt(0).toUpperCase() + colorKey.slice(1)] || C.petalRose,
        connections: [],
        pulseT: rnd(0, TAU),
        petalAngles: Array.from({length: 6}, (_,i) => i * TAU/6 + rnd(-0.15, 0.15)),
    };
}

function updateBud(bud, dt) {
    bud.pulseT += dt;
    bud.stateT += dt;
    if (bud.state === 'awakening' && bud.stateT > 1.2) {
        bud.state = 'alive';
        bud.stateT = 0;
        burstParticles(bud.x, bud.y, 15, bud.color, 50, 1, 3, 'pollen');
        burstParticles(bud.x, bud.y, 8, C.moonlight, 70, 0.6, 2, 'glow');
    }
    if (bud.state === 'alive' && Math.random() < 0.02) {
        spawnParticle(bud.x + rnd(-8,8), bud.y - 5, rnd(-3,3), rnd(-12,-4),
            rnd(1.5,3), rnd(1,2), bud.color, 'pollen');
    }
}

function awakenBud(bud, level) {
    if (bud.state !== 'sleeping') return;
    bud.state = 'awakening';
    bud.stateT = 0;
    sfxBudAwaken(bud.index % 5);
    // Propagate along connections after delay
    for (const conn of bud.connections) {
        if (conn.state === 'dry') {
            conn.state = 'activating';
            conn.progress = 0;
            conn.sourceIdx = bud.index;
        }
    }
}

function drawBud(ctx, bud) {
    const { x, y, state, stateT, color, petalAngles, pulseT } = bud;

    if (state === 'sleeping') {
        // Closed bud - grey, slightly pulsing
        const pulse = 1 + Math.sin(pulseT * 1.5) * 0.06;
        const s = BUD_R * pulse;
        ctx.save();
        ctx.translate(x, y);
        // Subtle attraction glow
        ctx.globalAlpha = 0.15 + Math.sin(pulseT * 2) * 0.05;
        const gg = ctx.createRadialGradient(0,0,0, 0,0,s*2.5);
        gg.addColorStop(0, C.moonlight);
        gg.addColorStop(1, 'transparent');
        ctx.fillStyle = gg;
        ctx.fillRect(-s*2.5,-s*2.5,s*5,s*5);
        ctx.globalAlpha = 1;
        // Closed petals
        for (let i = 0; i < 5; i++) {
            const a = petalAngles[i];
            ctx.save();
            ctx.rotate(a);
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.bezierCurveTo(s*0.3, -s*0.4, s*0.25, -s*0.85, 0, -s);
            ctx.bezierCurveTo(-s*0.25, -s*0.85, -s*0.3, -s*0.4, 0, 0);
            ctx.fillStyle = C.dryBase;
            ctx.fill();
            ctx.strokeStyle = C.dryStem;
            ctx.lineWidth = 0.5;
            ctx.stroke();
            ctx.restore();
        }
        // Center dot
        ctx.fillStyle = C.dryStem;
        ctx.beginPath();
        ctx.arc(0, 0, 3, 0, TAU);
        ctx.fill();
        ctx.restore();
    }
    else if (state === 'awakening') {
        const t = clamp(stateT / 1.2, 0, 1);
        const openAmt = easeOut(t);
        const s = BUD_R * (1 + openAmt * 0.3);
        ctx.save();
        ctx.translate(x, y);
        // Growing glow
        ctx.globalAlpha = openAmt * 0.4;
        const gg = ctx.createRadialGradient(0,0,0, 0,0,s*3);
        gg.addColorStop(0, color);
        gg.addColorStop(1, 'transparent');
        ctx.fillStyle = gg;
        ctx.fillRect(-s*3,-s*3,s*6,s*6);
        ctx.globalAlpha = 1;
        // Opening petals
        for (let i = 0; i < 6; i++) {
            const a = petalAngles[i] + (i%2===0 ? 1 : -1) * openAmt * 0.3;
            const spread = openAmt * 0.4;
            ctx.save();
            ctx.rotate(a);
            ctx.beginPath();
            ctx.moveTo(0, 0);
            const w = s * (0.3 + spread * 0.3);
            ctx.bezierCurveTo(w, -s*0.3, w, -s*0.8, 0, -s*(1+spread*0.2));
            ctx.bezierCurveTo(-w, -s*0.8, -w, -s*0.3, 0, 0);
            const c = lerpColor(C.dryBase, color, openAmt);
            ctx.fillStyle = c;
            ctx.fill();
            ctx.restore();
        }
        // Inner glow
        ctx.globalAlpha = openAmt;
        ctx.fillStyle = C.moonlight;
        ctx.beginPath();
        ctx.arc(0, 0, 3 + openAmt * 2, 0, TAU);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.restore();
    }
    else if (state === 'alive') {
        const s = BUD_R * 1.3;
        const breathe = 1 + Math.sin(pulseT * 2) * 0.04;
        ctx.save();
        ctx.translate(x, y);
        ctx.scale(breathe, breathe);
        // Halo glow
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        ctx.globalAlpha = 0.3;
        const gg = ctx.createRadialGradient(0,0,0, 0,0,s*3);
        gg.addColorStop(0, color);
        gg.addColorStop(0.5, color + '44');
        gg.addColorStop(1, 'transparent');
        ctx.fillStyle = gg;
        ctx.fillRect(-s*3,-s*3,s*6,s*6);
        ctx.restore();
        // Full petals
        for (let i = 0; i < 6; i++) {
            const a = petalAngles[i] + Math.sin(pulseT + i) * 0.05;
            ctx.save();
            ctx.rotate(a);
            ctx.beginPath();
            ctx.moveTo(0, 0);
            const w = s * 0.5;
            ctx.bezierCurveTo(w, -s*0.25, w*1.1, -s*0.7, 0, -s*1.15);
            ctx.bezierCurveTo(-w*1.1, -s*0.7, -w, -s*0.25, 0, 0);
            ctx.fillStyle = color;
            ctx.fill();
            // Petal highlight
            ctx.globalAlpha = 0.3;
            ctx.beginPath();
            ctx.moveTo(0, -2);
            ctx.bezierCurveTo(w*0.3, -s*0.3, w*0.3, -s*0.5, 0, -s*0.8);
            ctx.bezierCurveTo(-w*0.3, -s*0.5, -w*0.3, -s*0.3, 0, -2);
            ctx.fillStyle = C.moonlight;
            ctx.fill();
            ctx.globalAlpha = 1;
            ctx.restore();
        }
        // Center
        const cg = ctx.createRadialGradient(0,0,0, 0,0,5);
        cg.addColorStop(0, C.moonlight);
        cg.addColorStop(0.5, C.petalAmber);
        cg.addColorStop(1, color);
        ctx.fillStyle = cg;
        ctx.beginPath();
        ctx.arc(0, 0, 5, 0, TAU);
        ctx.fill();
        ctx.restore();
    }
}

// -------------------- CONNECTION ----------------------------
function createConnection(budA, budB, buds) {
    const a = buds[budA], b = buds[budB];
    const mid = v2lerp(a, b, 0.5);
    // Offset midpoint for curve
    const dx = b.x - a.x, dy = b.y - a.y;
    const nx = -dy, ny = dx;
    const off = rnd(-0.15, 0.15);
    const ctrl = { x: mid.x + nx * off, y: mid.y + ny * off };
    const conn = {
        a: budA, b: budB, ctrl,
        state: 'dry',   // dry, activating, alive
        progress: 0,
        sourceIdx: budA,
    };
    buds[budA].connections.push(conn);
    buds[budB].connections.push(conn);
    return conn;
}

function updateConnection(conn, dt, buds, level) {
    if (conn.state === 'activating') {
        conn.progress += (CHAIN_SPEED / dist(buds[conn.a], buds[conn.b])) * dt;
        if (conn.progress >= 1) {
            conn.state = 'alive';
            conn.progress = 1;
            sfxChain();
            // Awaken target bud
            const target = conn.sourceIdx === conn.a ? conn.b : conn.a;
            awakenBud(buds[target], level);
        }
        // Particles along connection
        if (Math.random() < 0.4) {
            const t = conn.progress;
            const p = bezierPoint(buds[conn.a], conn.ctrl, buds[conn.b], t);
            spawnParticle(p.x, p.y, rnd(-10,10), rnd(-10,10), 0.4, 2, C.alive1, 'glow');
        }
    }
}

function drawConnection(ctx, conn, buds) {
    const a = buds[conn.a], b = buds[conn.b];
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.quadraticCurveTo(conn.ctrl.x, conn.ctrl.y, b.x, b.y);

    if (conn.state === 'dry') {
        ctx.strokeStyle = C.dryStem;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        ctx.globalAlpha = 0.4;
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;
    }
    else if (conn.state === 'activating') {
        // Background line
        ctx.strokeStyle = C.dryStem;
        ctx.lineWidth = 1.5;
        ctx.globalAlpha = 0.3;
        ctx.stroke();
        // Active portion
        ctx.globalAlpha = 1;
        ctx.beginPath();
        const steps = 20;
        const tMax = conn.progress;
        for (let i = 0; i <= steps * tMax; i++) {
            const t = i / steps;
            const p = bezierPoint(a, conn.ctrl, b, t);
            if (i === 0) ctx.moveTo(p.x, p.y);
            else ctx.lineTo(p.x, p.y);
        }
        ctx.strokeStyle = C.alive1;
        ctx.lineWidth = 2.5;
        ctx.shadowBlur = 8;
        ctx.shadowColor = C.alive1;
        ctx.stroke();
        ctx.shadowBlur = 0;
        // Bright tip
        const tip = bezierPoint(a, conn.ctrl, b, tMax);
        const tg = ctx.createRadialGradient(tip.x, tip.y, 0, tip.x, tip.y, 8);
        tg.addColorStop(0, C.moonlight);
        tg.addColorStop(1, 'transparent');
        ctx.fillStyle = tg;
        ctx.fillRect(tip.x-8, tip.y-8, 16, 16);
    }
    else {  // alive
        ctx.strokeStyle = C.alive2;
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.7;
        ctx.shadowBlur = 4;
        ctx.shadowColor = C.alive1;
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;
    }
}

// -------------------- WATER AREA ----------------------------
function createWater(x, y, rx, ry) {
    return { x, y, rx, ry, ripples: [], shimmerT: 0 };
}

function updateWater(water, dt) {
    water.shimmerT += dt;
    // Random ripples
    if (Math.random() < 0.03) {
        water.ripples.push({ x: water.x + rnd(-water.rx*0.7, water.rx*0.7),
            y: water.y + rnd(-water.ry*0.5, water.ry*0.5), t: 0, maxR: rnd(10,25) });
    }
    for (let i = water.ripples.length - 1; i >= 0; i--) {
        water.ripples[i].t += dt;
        if (water.ripples[i].t > 1.5) water.ripples.splice(i, 1);
    }
    // Player ripple
    const dx = (player.x - water.x) / water.rx;
    const dy = (player.y - water.y) / water.ry;
    if (dx*dx + dy*dy < 1 && Math.random() < 0.1) {
        water.ripples.push({ x: player.x, y: player.y, t: 0, maxR: 12 });
    }
}

function drawWater(ctx, water) {
    ctx.save();
    // Main water body
    const wg = ctx.createRadialGradient(water.x, water.y, 0,
        water.x, water.y, Math.max(water.rx, water.ry));
    wg.addColorStop(0, C.waterLight + '60');
    wg.addColorStop(0.6, C.waterDeep + '50');
    wg.addColorStop(1, 'transparent');
    ctx.fillStyle = wg;
    ctx.beginPath();
    ctx.ellipse(water.x, water.y, water.rx, water.ry, 0, 0, TAU);
    ctx.fill();

    // Ripples
    for (const r of water.ripples) {
        const t = r.t / 1.5;
        const radius = r.maxR * easeOut(t);
        ctx.globalAlpha = (1 - t) * 0.3;
        ctx.strokeStyle = C.waterShimmer;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(r.x, r.y, radius, 0, TAU);
        ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // Shimmer/sparkle
    const sCount = 5;
    for (let i = 0; i < sCount; i++) {
        const angle = water.shimmerT * 0.3 + i * TAU / sCount;
        const sx = water.x + Math.cos(angle) * water.rx * 0.5;
        const sy = water.y + Math.sin(angle) * water.ry * 0.3;
        const flicker = 0.3 + Math.sin(water.shimmerT * 4 + i * 2) * 0.3;
        ctx.globalAlpha = flicker;
        ctx.fillStyle = C.waterShimmer;
        ctx.beginPath();
        ctx.arc(sx, sy, 1.5, 0, TAU);
        ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Moon reflection
    ctx.globalAlpha = 0.08 + Math.sin(water.shimmerT) * 0.03;
    ctx.fillStyle = C.moonlight;
    ctx.beginPath();
    ctx.ellipse(water.x + 10, water.y - 5, 15, 8, 0.2, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;

    ctx.restore();
}

// -------------------- SHADOW --------------------------------
function createShadow(x, y, speed) {
    return { x, y, speed, radius: 20, maxRadius: 220, targetX: 500, targetY: 400, active: true };
}

function updateShadow(shadow, dt, level) {
    if (!shadow || !shadow.active) return;
    // Slowly expand
    shadow.radius = Math.min(shadow.radius + shadow.speed * dt * 0.4, shadow.maxRadius);
    // Slowly move toward garden center
    const dx = shadow.targetX - shadow.x;
    const dy = shadow.targetY - shadow.y;
    const d = Math.hypot(dx, dy);
    if (d > 5) {
        shadow.x += (dx/d) * shadow.speed * dt * 0.3;
        shadow.y += (dy/d) * shadow.speed * dt * 0.3;
    }
    // Dust particles at edge
    if (Math.random() < 0.15) {
        const a = rnd(0, TAU);
        const r = shadow.radius * rnd(0.8, 1.1);
        spawnParticle(
            shadow.x + Math.cos(a) * r,
            shadow.y + Math.sin(a) * r,
            rnd(-8,8), rnd(-8,8), rnd(0.5,1.2), rnd(1,3),
            C.shadowEdge, 'dust'
        );
    }
    // Wilt nearby alive buds
    if (level) {
        for (const bud of level.buds) {
            if (bud.state === 'alive' && dist(bud, shadow) < shadow.radius * 0.8) {
                bud.state = 'wilting';
                bud.stateT = 0;
            }
        }
    }
}

function drawShadow(ctx, shadow) {
    if (!shadow || !shadow.active) return;
    ctx.save();
    // Create irregular edge using multiple offset circles
    const sg = ctx.createRadialGradient(shadow.x, shadow.y, shadow.radius * 0.2,
        shadow.x, shadow.y, shadow.radius);
    sg.addColorStop(0, 'rgba(10,2,4,0.5)');
    sg.addColorStop(0.5, 'rgba(10,2,4,0.3)');
    sg.addColorStop(0.8, 'rgba(42,18,24,0.15)');
    sg.addColorStop(1, 'transparent');
    ctx.fillStyle = sg;
    // Draw as slightly irregular shape
    ctx.beginPath();
    const segs = 24;
    for (let i = 0; i < segs; i++) {
        const a = (i / segs) * TAU;
        const r = shadow.radius * (0.85 + simpleNoise(i * 7.3, shadow.radius * 0.1) * 0.3);
        const px = shadow.x + Math.cos(a) * r;
        const py = shadow.y + Math.sin(a) * r;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
}

// -------------------- CENTRAL FLOWER ------------------------
function createCentralFlower(x, y) {
    return {
        x, y,
        openAmount: 0,      // 0 = closed, 1 = fully open
        targetOpen: 0,
        state: 'closed',     // closed, opening, open
        stateT: 0,
        pulseT: 0,
        petalCount: 10,
        petalAngles: Array.from({length: 10}, (_,i) => i * TAU/10),
    };
}

function updateCentralFlower(flower, dt, progress) {
    flower.pulseT += dt;
    flower.stateT += dt;
    // Open based on progress
    if (flower.state === 'closed' && progress >= 0.75) {
        flower.state = 'opening';
        flower.stateT = 0;
    }
    if (flower.state === 'opening') {
        flower.targetOpen = clamp((progress - 0.5) / 0.5, 0, 1);
        flower.openAmount = lerp(flower.openAmount, flower.targetOpen, dt * 1.5);
        if (flower.openAmount > 0.95) {
            flower.state = 'open';
            flower.openAmount = 1;
        }
    }
    if (flower.state !== 'closed' && Math.random() < 0.05 * flower.openAmount) {
        const a = rnd(0, TAU);
        spawnParticle(flower.x + Math.cos(a)*10, flower.y + Math.sin(a)*10,
            Math.cos(a)*15, Math.sin(a)*15 - 10,
            rnd(1,2), rnd(2,4), C.petalAmber, 'pollen');
    }
}

function drawCentralFlower(ctx, flower) {
    const { x, y, openAmount, state, pulseT, petalAngles } = flower;
    const R = 25;
    ctx.save();
    ctx.translate(x, y);

    // Big glow
    if (openAmount > 0) {
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        const glowR = R * (3 + openAmount * 4);
        ctx.globalAlpha = openAmount * 0.25;
        const gg = ctx.createRadialGradient(0,0,0, 0,0,glowR);
        gg.addColorStop(0, C.petalAmber);
        gg.addColorStop(0.3, C.petalAmber + '44');
        gg.addColorStop(1, 'transparent');
        ctx.fillStyle = gg;
        ctx.fillRect(-glowR, -glowR, glowR*2, glowR*2);
        ctx.restore();
    }

    if (state === 'closed') {
        // Closed large bud
        const pulse = 1 + Math.sin(pulseT * 1.2) * 0.03;
        ctx.scale(pulse, pulse);
        for (let i = 0; i < 8; i++) {
            const a = petalAngles[i];
            ctx.save();
            ctx.rotate(a);
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.bezierCurveTo(R*0.25, -R*0.3, R*0.2, -R*0.7, 0, -R);
            ctx.bezierCurveTo(-R*0.2, -R*0.7, -R*0.25, -R*0.3, 0, 0);
            ctx.fillStyle = '#5a5040';
            ctx.fill();
            ctx.strokeStyle = '#4a4030';
            ctx.lineWidth = 0.5;
            ctx.stroke();
            ctx.restore();
        }
        // Hint glow
        ctx.globalAlpha = 0.15 + Math.sin(pulseT * 2) * 0.08;
        const hg = ctx.createRadialGradient(0,0,0, 0,0,R*1.5);
        hg.addColorStop(0, C.petalAmber);
        hg.addColorStop(1, 'transparent');
        ctx.fillStyle = hg;
        ctx.fillRect(-R*1.5,-R*1.5,R*3,R*3);
        ctx.globalAlpha = 1;
    } else {
        // Opening/open petals
        const s = R * (1 + openAmount * 0.4);
        const breathe = 1 + Math.sin(pulseT * 1.5) * 0.02 * openAmount;
        ctx.scale(breathe, breathe);

        // Outer petals (larger, lighter)
        for (let i = 0; i < petalAngles.length; i++) {
            const a = petalAngles[i] + Math.sin(pulseT * 0.8 + i) * 0.03 * openAmount;
            const spread = openAmount * 0.5;
            ctx.save();
            ctx.rotate(a);
            const w = s * (0.35 + spread * 0.25);
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.bezierCurveTo(w, -s*0.2, w*1.2, -s*0.65, 0, -s*(1.1+spread*0.3));
            ctx.bezierCurveTo(-w*1.2, -s*0.65, -w, -s*0.2, 0, 0);
            const petalColor = i % 2 === 0 ? C.petalAmber : '#c4943a';
            ctx.fillStyle = petalColor;
            ctx.fill();
            // Highlight
            ctx.globalAlpha = 0.25;
            ctx.beginPath();
            ctx.moveTo(0, -3);
            ctx.bezierCurveTo(w*0.2, -s*0.3, w*0.15, -s*0.6, 0, -s*0.9);
            ctx.bezierCurveTo(-w*0.15, -s*0.6, -w*0.2, -s*0.3, 0, -3);
            ctx.fillStyle = C.moonlight;
            ctx.fill();
            ctx.globalAlpha = 1;
            ctx.restore();
        }
        // Center
        const cg = ctx.createRadialGradient(0,0,0, 0,0,8);
        cg.addColorStop(0, C.moonlight);
        cg.addColorStop(0.4, C.petalAmber);
        cg.addColorStop(1, '#8a6a20');
        ctx.fillStyle = cg;
        ctx.beginPath();
        ctx.arc(0, 0, 8 * (0.5 + openAmount * 0.5), 0, TAU);
        ctx.fill();
    }
    ctx.restore();
}

// -------------------- MOTH ----------------------------------
function createMoth(x, y) {
    return {
        x, y, angle: rnd(0, TAU), speed: rnd(15, 30),
        wobbleT: rnd(0, 10), wingT: 0,
        targetBud: null, wanderAngle: rnd(0, TAU),
    };
}

function updateMoth(moth, dt, buds) {
    moth.wobbleT += dt;
    moth.wingT += dt * 12;

    // Find nearest alive bud
    let nearest = null, nearDist = 200;
    for (const b of buds) {
        if (b.state === 'alive') {
            const d = dist(moth, b);
            if (d < nearDist) { nearest = b; nearDist = d; }
        }
    }
    if (nearest) {
        const dx = nearest.x - moth.x, dy = nearest.y - moth.y;
        const target = Math.atan2(dy, dx);
        moth.angle = lerpAngle(moth.angle, target, dt * 2);
        moth.speed = lerp(moth.speed, 35, dt);
    } else {
        moth.wanderAngle += rnd(-1, 1) * dt;
        moth.angle = lerpAngle(moth.angle, moth.wanderAngle, dt);
        moth.speed = lerp(moth.speed, 18, dt);
    }
    moth.x += Math.cos(moth.angle) * moth.speed * dt + Math.sin(moth.wobbleT * 3) * 8 * dt;
    moth.y += Math.sin(moth.angle) * moth.speed * dt + Math.cos(moth.wobbleT * 2.5) * 6 * dt;
    // Wrap around
    if (moth.x < -20) moth.x = W + 20;
    if (moth.x > W + 20) moth.x = -20;
    if (moth.y < -20) moth.y = H + 20;
    if (moth.y > H + 20) moth.y = -20;
}

function drawMoth(ctx, moth) {
    ctx.save();
    ctx.translate(moth.x, moth.y);
    ctx.rotate(moth.angle + Math.PI/2);
    const wingFlap = Math.sin(moth.wingT) * 0.5;
    // Wings
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = C.moonlight;
    // Left wing
    ctx.save();
    ctx.rotate(-0.3 + wingFlap);
    ctx.beginPath();
    ctx.ellipse(-2, -2, 5, 3, -0.3, 0, TAU);
    ctx.fill();
    ctx.restore();
    // Right wing
    ctx.save();
    ctx.rotate(0.3 - wingFlap);
    ctx.beginPath();
    ctx.ellipse(2, -2, 5, 3, 0.3, 0, TAU);
    ctx.fill();
    ctx.restore();
    // Body
    ctx.globalAlpha = 0.7;
    ctx.fillStyle = '#c8c0a8';
    ctx.beginPath();
    ctx.ellipse(0, 0, 1.5, 4, 0, 0, TAU);
    ctx.fill();
    // Glow
    ctx.globalAlpha = 0.15;
    const mg = ctx.createRadialGradient(0,0,0, 0,0,12);
    mg.addColorStop(0, C.moonlight);
    mg.addColorStop(1, 'transparent');
    ctx.fillStyle = mg;
    ctx.fillRect(-12,-12,24,24);
    ctx.globalAlpha = 1;
    ctx.restore();
}

function lerpAngle(a, b, t) {
    let diff = b - a;
    while (diff > Math.PI) diff -= TAU;
    while (diff < -Math.PI) diff += TAU;
    return a + diff * t;
}

// -------------------- COLOR HELPERS -------------------------
function hexToRgb(hex) {
    const r = parseInt(hex.slice(1,3),16);
    const g = parseInt(hex.slice(3,5),16);
    const b = parseInt(hex.slice(5,7),16);
    return [r,g,b];
}

function rgbToHex(r,g,b) {
    return '#' + [r,g,b].map(v => clamp(Math.round(v),0,255).toString(16).padStart(2,'0')).join('');
}

function lerpColor(c1, c2, t) {
    const [r1,g1,b1] = hexToRgb(c1);
    const [r2,g2,b2] = hexToRgb(c2);
    return rgbToHex(lerp(r1,r2,t), lerp(g1,g2,t), lerp(b1,b2,t));
}

// -------------------- LEVEL DATA ----------------------------
const LEVELS = [
    {
        name: 'Тихая клумба',
        playerStart: { x: 500, y: 600 },
        buds: [
            { x: 250, y: 500, color: 'rose' },
            { x: 400, y: 440, color: 'amber' },
            { x: 560, y: 420, color: 'violet' },
            { x: 710, y: 470, color: 'rose' },
            { x: 280, y: 320, color: 'blue' },
            { x: 440, y: 270, color: 'amber' },
            { x: 600, y: 290, color: 'violet' },
            { x: 740, y: 360, color: 'rose' },
        ],
        connections: [
            [0,1],[1,2],[2,3],[0,4],[1,5],[2,6],[3,7],[4,5],[5,6],[6,7],
        ],
        centralFlower: { x: 500, y: 120 },
        centralConnections: [5, 6],
        waterAreas: [
            { x: 460, y: 360, rx: 85, ry: 55 },
        ],
        shadow: { x: 850, y: 80, speed: 14 },
        moths: [
            { x: 100, y: 200 },
            { x: 700, y: 150 },
            { x: 300, y: 100 },
        ],
    },
];

// -------------------- LEVEL INSTANCE ------------------------
function loadLevel(idx) {
    const data = LEVELS[idx];
    const buds = data.buds.map((b,i) => createBud(b.x, b.y, b.color, i));
    const connections = data.connections.map(([a,b]) => createConnection(a, b, buds));
    // Central flower connections
    const cf = createCentralFlower(data.centralFlower.x, data.centralFlower.y);
    const centralConns = data.centralConnections.map(i => {
        const conn = {
            a: i, b: -1, ctrl: v2lerp(buds[i], cf, 0.5),
            state: 'dry', progress: 0, sourceIdx: i, isCentral: true,
        };
        // Offset ctrl
        conn.ctrl.x += rnd(-20, 20);
        conn.ctrl.y += rnd(-10, 10);
        buds[i].connections.push(conn);
        return conn;
    });
    const waterAreas = data.waterAreas.map(w => createWater(w.x, w.y, w.rx, w.ry));
    const shadow = data.shadow ? createShadow(data.shadow.x, data.shadow.y, data.shadow.speed) : null;
    const moths = (data.moths || []).map(m => createMoth(m.x, m.y));

    return {
        name: data.name,
        buds, connections, centralConns,
        centralFlower: cf,
        waterAreas, shadow, moths,
        playerStart: { ...data.playerStart },
        progress: 0,
        completed: false,
        completedT: 0,
        time: 0,
    };
}

// -------------------- BACKGROUND RENDERER -------------------
let bgCanvas = null;
let paperCanvas = null;

function renderBackground() {
    bgCanvas = document.createElement('canvas');
    bgCanvas.width = W; bgCanvas.height = H;
    const ctx = bgCanvas.getContext('2d');

    // Sky gradient
    const skyG = ctx.createLinearGradient(0, 0, 0, H);
    skyG.addColorStop(0, '#060e1f');
    skyG.addColorStop(0.4, '#0c1a33');
    skyG.addColorStop(0.7, '#101820');
    skyG.addColorStop(1, '#0a1210');
    ctx.fillStyle = skyG;
    ctx.fillRect(0, 0, W, H);

    // Stars
    for (let i = 0; i < 80; i++) {
        const sx = rnd(0, W), sy = rnd(0, H * 0.6);
        const sr = rnd(0.3, 1.5);
        ctx.globalAlpha = rnd(0.2, 0.7);
        ctx.fillStyle = C.moonlight;
        ctx.beginPath();
        ctx.arc(sx, sy, sr, 0, TAU);
        ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Moon
    const moonX = 820, moonY = 80, moonR = 35;
    const moonG = ctx.createRadialGradient(moonX-5, moonY-5, 0, moonX, moonY, moonR * 2);
    moonG.addColorStop(0, '#f5f0d8');
    moonG.addColorStop(0.3, '#e8e0c8');
    moonG.addColorStop(0.5, 'rgba(240,235,216,0.15)');
    moonG.addColorStop(1, 'transparent');
    ctx.fillStyle = moonG;
    ctx.fillRect(moonX - moonR*2, moonY - moonR*2, moonR*4, moonR*4);
    ctx.fillStyle = '#f0ebd8';
    ctx.beginPath();
    ctx.arc(moonX, moonY, moonR, 0, TAU);
    ctx.fill();
    // Moon craters (subtle)
    ctx.globalAlpha = 0.1;
    ctx.fillStyle = '#c8c0a0';
    ctx.beginPath(); ctx.arc(moonX-8, moonY-5, 6, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(moonX+10, moonY+8, 4, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(moonX+3, moonY-12, 3, 0, TAU); ctx.fill();
    ctx.globalAlpha = 1;

    // Ground shapes - garden beds
    drawGardenGround(ctx);

    // Decorative background leaves and stems
    drawDecoLeaves(ctx);

    // Vignette
    const vg = ctx.createRadialGradient(W/2, H/2, W*0.25, W/2, H/2, W*0.7);
    vg.addColorStop(0, 'transparent');
    vg.addColorStop(1, 'rgba(0,0,0,0.5)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, W, H);
}

function drawGardenGround(ctx) {
    // Earth/garden bed shapes
    ctx.save();
    // Main garden area
    ctx.fillStyle = '#0e1612';
    ctx.beginPath();
    ctx.moveTo(50, H);
    ctx.bezierCurveTo(100, H*0.55, 300, H*0.35, 500, H*0.3);
    ctx.bezierCurveTo(700, H*0.35, 900, H*0.55, 950, H);
    ctx.lineTo(50, H);
    ctx.fill();

    // Stone path suggestions
    ctx.fillStyle = '#161e1a';
    for (let i = 0; i < 12; i++) {
        const sx = 200 + rnd(-50,400);
        const sy = H * 0.5 + rnd(0, H * 0.35);
        ctx.globalAlpha = 0.3;
        ctx.beginPath();
        ctx.ellipse(sx, sy, rnd(15,30), rnd(10,18), rnd(-0.3,0.3), 0, TAU);
        ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Moss patches
    for (let i = 0; i < 8; i++) {
        const mx = rnd(80, W-80);
        const my = rnd(H*0.4, H*0.9);
        ctx.globalAlpha = 0.15;
        ctx.fillStyle = '#1a2e20';
        ctx.beginPath();
        ctx.ellipse(mx, my, rnd(20,50), rnd(15,35), rnd(0,1), 0, TAU);
        ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
}

function drawDecoLeaves(ctx) {
    ctx.save();
    ctx.globalAlpha = 0.12;
    // Faded background leaves
    for (let i = 0; i < 15; i++) {
        const lx = rnd(30, W-30);
        const ly = rnd(H*0.2, H*0.85);
        const la = rnd(0, TAU);
        const ls = rnd(15, 35);
        ctx.save();
        ctx.translate(lx, ly);
        ctx.rotate(la);
        ctx.fillStyle = C.dryLeaf;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.bezierCurveTo(ls*0.4, -ls*0.2, ls*0.3, -ls*0.7, 0, -ls);
        ctx.bezierCurveTo(-ls*0.3, -ls*0.7, -ls*0.4, -ls*0.2, 0, 0);
        ctx.fill();
        // Leaf vein
        ctx.strokeStyle = C.dryStem;
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(0, -ls * 0.85);
        ctx.stroke();
        ctx.restore();
    }
    // Background stems/branches
    ctx.strokeStyle = '#2a2418';
    ctx.lineWidth = 2;
    for (let i = 0; i < 5; i++) {
        const sx = rnd(50, W-50);
        const sy = H * 0.9;
        const ey = rnd(H*0.2, H*0.5);
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.bezierCurveTo(sx + rnd(-60,60), sy - (sy-ey)*0.3,
            sx + rnd(-80,80), sy - (sy-ey)*0.7, sx + rnd(-40,40), ey);
        ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
}

function renderPaperTexture() {
    paperCanvas = document.createElement('canvas');
    paperCanvas.width = W; paperCanvas.height = H;
    const ctx = paperCanvas.getContext('2d');
    const imageData = ctx.createImageData(W, H);
    const d = imageData.data;
    for (let i = 0; i < d.length; i += 4) {
        const px = (i/4) % W;
        const py = Math.floor((i/4) / W);
        const n = simpleNoise(px * 0.5, py * 0.5);
        const v = n > 0.5 ? 255 : 0;
        d[i] = v; d[i+1] = v; d[i+2] = v;
        d[i+3] = n > 0.48 && n < 0.52 ? 8 : 3;
    }
    ctx.putImageData(imageData, 0, 0);
}

// -------------------- SCENE MANAGEMENT ----------------------
let currentScene = 'menu';
let sceneData = {};
let fadeAlpha = 1;
let fadeDir = -1;   // -1 = fading in, 1 = fading out
let fadeCallback = null;
let gameTime = 0;

function fadeToScene(scene, callback) {
    fadeDir = 1;
    fadeCallback = () => {
        currentScene = scene;
        fadeDir = -1;
        if (callback) callback();
    };
}

function updateFade(dt) {
    if (fadeDir !== 0) {
        fadeAlpha += fadeDir * dt * 2.5;
        if (fadeDir === 1 && fadeAlpha >= 1) {
            fadeAlpha = 1;
            fadeDir = 0;
            if (fadeCallback) { fadeCallback(); fadeCallback = null; fadeDir = -1; }
        }
        if (fadeDir === -1 && fadeAlpha <= 0) {
            fadeAlpha = 0;
            fadeDir = 0;
        }
    }
}

// -------------------- MENU SCENE ----------------------------
let menuT = 0;
const menuStars = Array.from({length:40}, () => ({
    x: rnd(0,W), y: rnd(0,H*0.5), r: rnd(0.5,2), speed: rnd(0.1,0.4)
}));

function updateMenu(dt) {
    menuT += dt;
    for (const s of menuStars) {
        s.y += s.speed * dt * 3;
        if (s.y > H*0.5) { s.y = 0; s.x = rnd(0,W); }
    }
    if (input.clicked) {
        // Check start button area
        const bx = W/2, by = H * 0.62;
        if (Math.abs(input.mx - bx) < 100 && Math.abs(input.my - by) < 30) {
            input.clicked = false;
            ensureAudio();
            startAmbient();
            playTone(440, 0.3, 'sine', 0.15);
            fadeToScene('game', () => {
                sceneData.level = loadLevel(0);
                resetPlayer(sceneData.level.playerStart.x, sceneData.level.playerStart.y);
            });
            return;
        }
    }
    input.clicked = false;
}

function drawMenu(ctx) {
    // Background
    ctx.fillStyle = C.bgDeep;
    ctx.fillRect(0, 0, W, H);

    // Stars
    for (const s of menuStars) {
        ctx.globalAlpha = 0.3 + Math.sin(menuT * 2 + s.x) * 0.2;
        ctx.fillStyle = C.moonlight;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, TAU);
        ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Moon
    const moonY = 130 + Math.sin(menuT * 0.5) * 5;
    const moonG = ctx.createRadialGradient(W/2, moonY, 0, W/2, moonY, 120);
    moonG.addColorStop(0, 'rgba(240,235,216,0.3)');
    moonG.addColorStop(0.3, 'rgba(240,235,216,0.08)');
    moonG.addColorStop(1, 'transparent');
    ctx.fillStyle = moonG;
    ctx.fillRect(W/2-120, moonY-120, 240, 240);
    ctx.fillStyle = C.moonlight;
    ctx.beginPath();
    ctx.arc(W/2, moonY, 25, 0, TAU);
    ctx.fill();

    // Small decorative plant silhouettes
    ctx.globalAlpha = 0.15;
    drawMenuPlant(ctx, 150, H, 180);
    drawMenuPlant(ctx, W-150, H, 160);
    drawMenuPlant(ctx, 400, H, 120);
    drawMenuPlant(ctx, W-350, H, 140);
    ctx.globalAlpha = 1;

    // Title
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Title shadow
    ctx.shadowBlur = 30;
    ctx.shadowColor = C.petalAmber;
    ctx.fillStyle = C.moonlight;
    ctx.font = 'bold 46px "Georgia", "Times New Roman", serif';
    ctx.fillText('Сад Лунной Росы', W/2, H * 0.35);
    ctx.shadowBlur = 0;

    // Subtitle
    ctx.globalAlpha = 0.5;
    ctx.font = 'italic 18px "Georgia", "Times New Roman", serif';
    ctx.fillStyle = C.uiText;
    ctx.fillText('Garden of Moonlit Dew', W/2, H * 0.35 + 40);
    ctx.globalAlpha = 1;

    // Start button
    const bx = W/2, by = H * 0.62;
    const hover = Math.abs(input.mx - bx) < 100 && Math.abs(input.my - by) < 30;
    const btnAlpha = hover ? 1 : 0.7 + Math.sin(menuT * 2) * 0.15;
    ctx.globalAlpha = btnAlpha;

    // Button shape (leaf-like)
    ctx.beginPath();
    ctx.moveTo(bx - 90, by);
    ctx.bezierCurveTo(bx - 90, by - 22, bx - 40, by - 28, bx, by - 28);
    ctx.bezierCurveTo(bx + 40, by - 28, bx + 90, by - 22, bx + 90, by);
    ctx.bezierCurveTo(bx + 90, by + 22, bx + 40, by + 28, bx, by + 28);
    ctx.bezierCurveTo(bx - 40, by + 28, bx - 90, by + 22, bx - 90, by);
    ctx.fillStyle = hover ? '#2a4a35' : '#1a3025';
    ctx.fill();
    ctx.strokeStyle = C.alive1;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = C.moonlight;
    ctx.font = '22px "Georgia", "Times New Roman", serif';
    ctx.fillText('Начать', bx, by + 1);
    ctx.globalAlpha = 1;

    // Hint
    ctx.globalAlpha = 0.3;
    ctx.font = '13px "Georgia", "Times New Roman", serif';
    ctx.fillStyle = C.uiDim;
    ctx.fillText('Управление мышью или касанием', W/2, H * 0.78);
    ctx.fillText('Удерживайте для следа росы, отпустите для рывка', W/2, H * 0.78 + 20);
    ctx.globalAlpha = 1;

    ctx.restore();

    // Vignette
    const vg = ctx.createRadialGradient(W/2, H/2, W*0.2, W/2, H/2, W*0.65);
    vg.addColorStop(0, 'transparent');
    vg.addColorStop(1, 'rgba(0,0,0,0.6)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, W, H);
}

function drawMenuPlant(ctx, x, baseY, h) {
    ctx.save();
    ctx.strokeStyle = '#2a3a28';
    ctx.fillStyle = '#1a2a18';
    ctx.lineWidth = 2;
    // Stem
    ctx.beginPath();
    ctx.moveTo(x, baseY);
    ctx.bezierCurveTo(x + rnd(-10,10), baseY - h*0.3, x + rnd(-15,15), baseY - h*0.7, x + rnd(-5,5), baseY - h);
    ctx.stroke();
    // Leaves
    for (let i = 0; i < 4; i++) {
        const ly = baseY - h * (0.3 + i * 0.18);
        const side = i % 2 === 0 ? 1 : -1;
        ctx.beginPath();
        ctx.moveTo(x, ly);
        ctx.bezierCurveTo(x + side*20, ly - 8, x + side*25, ly - 20, x + side*8, ly - 25);
        ctx.bezierCurveTo(x + side*3, ly - 15, x, ly - 5, x, ly);
        ctx.fill();
    }
    ctx.restore();
}

// -------------------- GAME SCENE ----------------------------
function updateGame(dt) {
    const level = sceneData.level;
    if (!level) return;

    level.time += dt;
    gameTime += dt;
    updateInput(dt);
    updatePlayer(dt, level);

    // Check player activation of buds
    for (const bud of level.buds) {
        if (bud.state === 'sleeping') {
            // Direct touch activation
            if (dist(player, bud) < ACTIVATE_RANGE) {
                if (input.down || player.trail.length > 3) {
                    awakenBud(bud, level);
                }
            }
            // Trail activation
            for (const tp of player.trail) {
                if (dist(tp, bud) < ACTIVATE_RANGE * 0.7 && tp.life > 0.5) {
                    awakenBud(bud, level);
                    break;
                }
            }
        }
        updateBud(bud, dt);
    }

    // Update connections
    for (const conn of level.connections) {
        updateConnection(conn, dt, level.buds, level);
    }
    for (const conn of level.centralConns) {
        if (conn.state === 'dry') {
            const srcBud = level.buds[conn.a];
            if (srcBud.state === 'alive') {
                conn.state = 'activating';
                conn.progress = 0;
            }
        }
        if (conn.state === 'activating') {
            const srcBud = level.buds[conn.a];
            const target = level.centralFlower;
            conn.progress += (CHAIN_SPEED / dist(srcBud, target)) * dt;
            if (conn.progress >= 1) {
                conn.state = 'alive';
                sfxChain();
            }
            if (Math.random() < 0.3) {
                const t = conn.progress;
                const p = bezierPoint(srcBud, conn.ctrl, target, t);
                spawnParticle(p.x, p.y, rnd(-8,8), rnd(-8,8), 0.3, 2, C.petalAmber, 'glow');
            }
        }
    }

    // Update water
    for (const w of level.waterAreas) updateWater(w, dt);

    // Update shadow
    updateShadow(level.shadow, dt, level);

    // Update moths
    for (const m of level.moths) updateMoth(m, dt, level.buds);

    // Update particles
    updateParticles(dt);

    // Calculate progress
    const aliveBuds = level.buds.filter(b => b.state === 'alive' || b.state === 'awakening').length;
    level.progress = aliveBuds / level.buds.length;

    // Update central flower
    updateCentralFlower(level.centralFlower, dt, level.progress);

    // Victory check: touch open central flower
    if (level.centralFlower.state === 'open' && !level.completed) {
        if (dist(player, level.centralFlower) < 35) {
            level.completed = true;
            level.completedT = 0;
            sfxVictory();
            burstParticles(level.centralFlower.x, level.centralFlower.y, 40, C.petalAmber, 80, 2, 4, 'pollen');
            burstParticles(level.centralFlower.x, level.centralFlower.y, 25, C.moonlight, 120, 1.5, 3, 'glow');
        }
    }

    if (level.completed) {
        level.completedT += dt;
        if (level.completedT > 3) {
            fadeToScene('results');
        }
    }

    // Check pause button
    if (input.clicked && input.mx > W - 50 && input.my < 50) {
        // Simple pause toggle could go here
    }
    input.clicked = false;
}

function drawGame(ctx) {
    const level = sceneData.level;
    if (!level) return;

    // Background
    if (bgCanvas) ctx.drawImage(bgCanvas, 0, 0);

    // Water areas (behind other objects)
    for (const w of level.waterAreas) drawWater(ctx, w);

    // Shadow
    drawShadow(ctx, level.shadow);

    // Connections
    for (const conn of level.connections) drawConnection(ctx, conn, level.buds);
    // Central connections
    for (const conn of level.centralConns) {
        const src = level.buds[conn.a];
        const tgt = level.centralFlower;
        ctx.beginPath();
        ctx.moveTo(src.x, src.y);
        ctx.quadraticCurveTo(conn.ctrl.x, conn.ctrl.y, tgt.x, tgt.y);
        if (conn.state === 'dry') {
            ctx.strokeStyle = C.dryStem;
            ctx.lineWidth = 1.5;
            ctx.setLineDash([4,4]);
            ctx.globalAlpha = 0.3;
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.globalAlpha = 1;
        } else if (conn.state === 'activating') {
            ctx.strokeStyle = C.dryStem;
            ctx.lineWidth = 1.5;
            ctx.globalAlpha = 0.3;
            ctx.stroke();
            ctx.globalAlpha = 1;
            // Active portion
            ctx.beginPath();
            for (let i = 0; i <= 20 * conn.progress; i++) {
                const t = i / 20;
                const p = bezierPoint(src, conn.ctrl, tgt, t);
                if (i === 0) ctx.moveTo(p.x, p.y);
                else ctx.lineTo(p.x, p.y);
            }
            ctx.strokeStyle = C.petalAmber;
            ctx.lineWidth = 2.5;
            ctx.shadowBlur = 8;
            ctx.shadowColor = C.petalAmber;
            ctx.stroke();
            ctx.shadowBlur = 0;
        } else {
            ctx.strokeStyle = C.petalAmber + '88';
            ctx.lineWidth = 2;
            ctx.shadowBlur = 4;
            ctx.shadowColor = C.petalAmber;
            ctx.stroke();
            ctx.shadowBlur = 0;
        }
    }

    // Buds
    for (const bud of level.buds) drawBud(ctx, bud);

    // Central flower
    drawCentralFlower(ctx, level.centralFlower);

    // Moths
    for (const m of level.moths) drawMoth(ctx, m);

    // Player
    drawPlayer(ctx);

    // Particles on top
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    drawParticles(ctx);
    ctx.restore();

    // Paper texture overlay
    if (paperCanvas) {
        ctx.globalAlpha = 0.4;
        ctx.drawImage(paperCanvas, 0, 0);
        ctx.globalAlpha = 1;
    }

    // HUD
    drawHUD(ctx, level);

    // Victory overlay
    if (level.completed) {
        const t = clamp(level.completedT / 2, 0, 1);
        ctx.globalAlpha = t * 0.3;
        ctx.fillStyle = C.petalAmber;
        ctx.fillRect(0, 0, W, H);
        ctx.globalAlpha = 1;

        if (level.completedT > 1) {
            ctx.save();
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.shadowBlur = 20;
            ctx.shadowColor = C.petalAmber;
            ctx.fillStyle = C.moonlight;
            ctx.font = 'bold 36px "Georgia", "Times New Roman", serif';
            ctx.globalAlpha = clamp((level.completedT - 1) / 1, 0, 1);
            ctx.fillText('Сад пробудился', W/2, H/2);
            ctx.shadowBlur = 0;
            ctx.restore();
        }
    }
}

function drawHUD(ctx, level) {
    // Progress indicator - branch with drops
    ctx.save();
    const hx = W/2, hy = 25;
    const hw = 200;
    // Branch
    ctx.strokeStyle = C.dryStem;
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.6;
    ctx.beginPath();
    ctx.moveTo(hx - hw, hy);
    ctx.bezierCurveTo(hx - hw*0.5, hy - 5, hx + hw*0.5, hy + 5, hx + hw, hy);
    ctx.stroke();
    // Drops for each bud
    const budCount = level.buds.length;
    for (let i = 0; i < budCount; i++) {
        const t = (i + 0.5) / budCount;
        const dx = hx - hw + t * hw * 2;
        const dy = hy + Math.sin(t * Math.PI) * 3;
        const bud = level.buds[i];
        const alive = bud.state === 'alive' || bud.state === 'awakening';
        ctx.globalAlpha = alive ? 0.9 : 0.3;
        ctx.fillStyle = alive ? bud.color : C.dryBase;
        // Drop shape
        ctx.beginPath();
        ctx.moveTo(dx, dy - 6);
        ctx.bezierCurveTo(dx + 4, dy - 2, dx + 4, dy + 3, dx, dy + 5);
        ctx.bezierCurveTo(dx - 4, dy + 3, dx - 4, dy - 2, dx, dy - 6);
        ctx.fill();
        if (alive) {
            ctx.fillStyle = C.moonlight;
            ctx.globalAlpha = 0.5;
            ctx.beginPath();
            ctx.arc(dx - 1, dy - 1, 1.5, 0, TAU);
            ctx.fill();
        }
    }

    // Player energy indicator (bottom left)
    ctx.globalAlpha = 0.6;
    const ex = 35, ey = H - 35;
    const eRadius = 12;
    // Background circle
    ctx.strokeStyle = C.uiDim;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(ex, ey, eRadius, 0, TAU);
    ctx.stroke();
    // Energy arc
    ctx.strokeStyle = player.energy > 0.3 ? C.playerGlow : '#ff6666';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(ex, ey, eRadius, -Math.PI/2, -Math.PI/2 + player.energy * TAU);
    ctx.stroke();
    // Center glow
    const eg = ctx.createRadialGradient(ex, ey, 0, ex, ey, eRadius * 0.6);
    eg.addColorStop(0, player.energy > 0.3 ? C.playerGlow : '#ff6666');
    eg.addColorStop(1, 'transparent');
    ctx.globalAlpha = 0.3 * player.energy;
    ctx.fillStyle = eg;
    ctx.fillRect(ex-eRadius, ey-eRadius, eRadius*2, eRadius*2);

    ctx.globalAlpha = 1;
    ctx.restore();

    // Custom cursor
    ctx.save();
    ctx.globalAlpha = 0.4;
    ctx.strokeStyle = C.moonlight;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(input.mx, input.my, 8, 0, TAU);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(input.mx, input.my, 1.5, 0, TAU);
    ctx.fillStyle = C.moonlight;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.restore();
}

// -------------------- RESULTS SCENE -------------------------
let resultsT = 0;

function updateResults(dt) {
    resultsT += dt;
    updateParticles(dt);
    if (input.clicked && resultsT > 1.5) {
        // Check continue button
        const bx = W/2, by = H * 0.72;
        if (Math.abs(input.mx - bx) < 100 && Math.abs(input.my - by) < 30) {
            input.clicked = false;
            fadeToScene('menu', () => { resultsT = 0; });
            return;
        }
    }
    input.clicked = false;

    // Ambient particles
    if (Math.random() < 0.15) {
        spawnParticle(rnd(0,W), H + 5, rnd(-5,5), rnd(-30,-15), rnd(2,4), rnd(1,3),
            [C.petalRose, C.petalAmber, C.petalViolet][rndInt(0,2)], 'pollen');
    }
}

function drawResults(ctx) {
    // Beautiful background
    ctx.fillStyle = C.bgDeep;
    ctx.fillRect(0, 0, W, H);

    // Gradient overlay
    const bg = ctx.createRadialGradient(W/2, H*0.3, 0, W/2, H*0.3, 400);
    bg.addColorStop(0, 'rgba(218,165,32,0.08)');
    bg.addColorStop(1, 'transparent');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // Floating particles
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    drawParticles(ctx);
    ctx.restore();

    // Content
    const fadeIn = clamp(resultsT / 1.5, 0, 1);
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.globalAlpha = fadeIn;

    // Title
    ctx.shadowBlur = 25;
    ctx.shadowColor = C.petalAmber;
    ctx.fillStyle = C.moonlight;
    ctx.font = 'bold 38px "Georgia", "Times New Roman", serif';
    ctx.fillText('Сад пробудился', W/2, H * 0.25);
    ctx.shadowBlur = 0;

    // Stats
    const level = sceneData.level;
    ctx.font = '20px "Georgia", "Times New Roman", serif';
    ctx.fillStyle = C.uiText;
    if (level) {
        const mins = Math.floor(level.time / 60);
        const secs = Math.floor(level.time % 60);
        ctx.fillText(`Время: ${mins}:${secs.toString().padStart(2,'0')}`, W/2, H * 0.42);
        const alive = level.buds.filter(b => b.state === 'alive').length;
        ctx.fillText(`Цветы пробуждены: ${alive} / ${level.buds.length}`, W/2, H * 0.50);
    }

    // Decorative flower
    ctx.globalAlpha = fadeIn * 0.4;
    for (let i = 0; i < 8; i++) {
        const a = i * TAU / 8 + resultsT * 0.1;
        ctx.save();
        ctx.translate(W/2, H * 0.25 - 60);
        ctx.rotate(a);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.bezierCurveTo(8, -15, 6, -30, 0, -40);
        ctx.bezierCurveTo(-6, -30, -8, -15, 0, 0);
        ctx.fillStyle = C.petalAmber;
        ctx.fill();
        ctx.restore();
    }
    ctx.globalAlpha = fadeIn;

    // Continue button
    if (resultsT > 1.5) {
        const bx = W/2, by = H * 0.72;
        const hover = Math.abs(input.mx - bx) < 100 && Math.abs(input.my - by) < 30;
        ctx.beginPath();
        ctx.moveTo(bx - 80, by);
        ctx.bezierCurveTo(bx - 80, by - 20, bx - 35, by - 25, bx, by - 25);
        ctx.bezierCurveTo(bx + 35, by - 25, bx + 80, by - 20, bx + 80, by);
        ctx.bezierCurveTo(bx + 80, by + 20, bx + 35, by + 25, bx, by + 25);
        ctx.bezierCurveTo(bx - 35, by + 25, bx - 80, by + 20, bx - 80, by);
        ctx.fillStyle = hover ? '#2a4a35' : '#1a3025';
        ctx.fill();
        ctx.strokeStyle = C.alive1;
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.fillStyle = C.moonlight;
        ctx.font = '20px "Georgia", "Times New Roman", serif';
        ctx.fillText('В сад', bx, by + 1);
    }

    ctx.restore();

    // Custom cursor
    ctx.save();
    ctx.globalAlpha = 0.4;
    ctx.strokeStyle = C.moonlight;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(input.mx, input.my, 8, 0, TAU);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.restore();

    // Vignette
    const vg = ctx.createRadialGradient(W/2, H/2, W*0.2, W/2, H/2, W*0.6);
    vg.addColorStop(0, 'transparent');
    vg.addColorStop(1, 'rgba(0,0,0,0.6)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, W, H);
}

// -------------------- MAIN ENGINE ---------------------------
let canvas, ctx;
let lastTime = 0;
let initialized = false;

function init() {
    canvas = document.getElementById('game');
    // Set canvas resolution
    function resize() {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const rect = canvas.getBoundingClientRect();
        canvas.width = W * dpr;
        canvas.height = H * dpr;
        ctx = canvas.getContext('2d');
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    window.addEventListener('resize', resize);

    initInput(canvas);
    renderBackground();
    renderPaperTexture();

    initialized = true;
    requestAnimationFrame(gameLoop);
}

function gameLoop(timestamp) {
    if (!initialized) return;
    const dt = Math.min((timestamp - lastTime) / 1000, 0.05);
    lastTime = timestamp;

    // Update
    updateFade(dt);
    switch (currentScene) {
        case 'menu': updateMenu(dt); break;
        case 'game': updateGame(dt); break;
        case 'results': updateResults(dt); break;
    }

    // Render
    ctx.clearRect(0, 0, W, H);
    switch (currentScene) {
        case 'menu': drawMenu(ctx); break;
        case 'game': drawGame(ctx); break;
        case 'results': drawResults(ctx); break;
    }

    // Fade overlay
    if (fadeAlpha > 0) {
        ctx.globalAlpha = fadeAlpha;
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, W, H);
        ctx.globalAlpha = 1;
    }

    requestAnimationFrame(gameLoop);
}

// -------------------- START ---------------------------------
window.addEventListener('load', init);
