const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const overlay = document.getElementById("overlay");
const finalScoreLabel = document.getElementById("final-score");
const restartButton = document.getElementById("restart-button");

const TAU = Math.PI * 2;
const LIGHT = { x: -0.7, y: -0.95 };
const COLORS = {
  brass: "#c49b49",
  brassDark: "#6e4a18",
  steel: "#d4d8df",
  steelDark: "#616c77",
  ember: "#ff9f34",
  emberBright: "#ffe59a",
  rust: "#7f4b35",
  rustDark: "#3c2318",
  cloth: "#1f6650",
  clothShade: "#0a2f24",
  wood: "#6c321f",
  woodDark: "#35170f",
  ivory: "#f4e1b8",
  blood: "#a84e3a",
};

const state = {
  width: 0,
  height: 0,
  dpr: Math.min(window.devicePixelRatio || 1, 2),
  arena: { left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 },
  lastTime: performance.now(),
  player: null,
  bullets: [],
  enemies: [],
  particles: [],
  debris: [],
  skidMarks: [],
  wave: 0,
  waveQueue: 0,
  spawnTimer: 0,
  nextWaveTimer: 1.2,
  score: 0,
  scoreDisplay: 0,
  gameOver: false,
  banner: "",
  bannerTimer: 0,
  shake: 0,
  time: 0,
  enemyId: 0,
  bulletId: 0,
  hintTimer: 7,
  clothBuffer: null,
};

const input = {
  keys: new Set(),
  mouseX: 0,
  mouseY: 0,
  mouseDown: false,
  everMoved: false,
  everShot: false,
};

function makeBuffer(width, height) {
  if (typeof OffscreenCanvas === "function") {
    return new OffscreenCanvas(width, height);
  }
  const buffer = document.createElement("canvas");
  buffer.width = width;
  buffer.height = height;
  return buffer;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function rand(min, max) {
  return min + Math.random() * (max - min);
}

function randInt(min, max) {
  return Math.floor(rand(min, max + 1));
}

function length(x, y) {
  return Math.hypot(x, y);
}

function normalize(x, y, fallbackX = 1, fallbackY = 0) {
  const mag = Math.hypot(x, y);
  if (mag < 1e-6) {
    return { x: fallbackX, y: fallbackY };
  }
  return { x: x / mag, y: y / mag };
}

function segmentCircleHit(x1, y1, x2, y2, cx, cy, radius) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const fx = x1 - cx;
  const fy = y1 - cy;
  const a = dx * dx + dy * dy;
  const b = 2 * (fx * dx + fy * dy);
  const c = fx * fx + fy * fy - radius * radius;
  const disc = b * b - 4 * a * c;

  if (disc < 0 || a < 1e-8) {
    return null;
  }

  const root = Math.sqrt(disc);
  const t1 = (-b - root) / (2 * a);
  const t2 = (-b + root) / (2 * a);
  let t = Number.POSITIVE_INFINITY;

  if (t1 >= 0 && t1 <= 1) {
    t = t1;
  } else if (t2 >= 0 && t2 <= 1) {
    t = t2;
  }

  if (!Number.isFinite(t)) {
    return null;
  }

  const x = x1 + dx * t;
  const y = y1 + dy * t;
  const normal = normalize(x - cx, y - cy);
  return { t, x, y, normal };
}

function segmentArenaHit(x1, y1, x2, y2, radius) {
  const bounds = {
    left: state.arena.left + radius,
    right: state.arena.right - radius,
    top: state.arena.top + radius,
    bottom: state.arena.bottom - radius,
  };

  const dx = x2 - x1;
  const dy = y2 - y1;
  let best = null;

  if (dx < 0 && x2 < bounds.left) {
    const t = (bounds.left - x1) / dx;
    const y = y1 + dy * t;
    if (t >= 0 && t <= 1 && y >= bounds.top && y <= bounds.bottom) {
      best = { t, x: bounds.left, y, normal: { x: 1, y: 0 } };
    }
  }

  if (dx > 0 && x2 > bounds.right) {
    const t = (bounds.right - x1) / dx;
    const y = y1 + dy * t;
    if (t >= 0 && t <= 1 && y >= bounds.top && y <= bounds.bottom && (!best || t < best.t)) {
      best = { t, x: bounds.right, y, normal: { x: -1, y: 0 } };
    }
  }

  if (dy < 0 && y2 < bounds.top) {
    const t = (bounds.top - y1) / dy;
    const x = x1 + dx * t;
    if (t >= 0 && t <= 1 && x >= bounds.left && x <= bounds.right && (!best || t < best.t)) {
      best = { t, x, y: bounds.top, normal: { x: 0, y: 1 } };
    }
  }

  if (dy > 0 && y2 > bounds.bottom) {
    const t = (bounds.bottom - y1) / dy;
    const x = x1 + dx * t;
    if (t >= 0 && t <= 1 && x >= bounds.left && x <= bounds.right && (!best || t < best.t)) {
      best = { t, x, y: bounds.bottom, normal: { x: 0, y: -1 } };
    }
  }

  return best;
}

function bindInput() {
  window.addEventListener("keydown", (event) => {
    input.keys.add(event.code);
    if (event.code === "KeyR" && state.gameOver) {
      restart();
    }
    if (["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowLeft", "ArrowDown", "ArrowRight", "Space"].includes(event.code)) {
      event.preventDefault();
    }
  });

  window.addEventListener("keyup", (event) => {
    input.keys.delete(event.code);
  });

  const setMouse = (event) => {
    const rect = canvas.getBoundingClientRect();
    input.mouseX = ((event.clientX - rect.left) / rect.width) * state.width;
    input.mouseY = ((event.clientY - rect.top) / rect.height) * state.height;
  };

  window.addEventListener("mousemove", (event) => {
    setMouse(event);
    input.everMoved = true;
  });

  window.addEventListener("mousedown", (event) => {
    if (event.button !== 0) {
      return;
    }
    setMouse(event);
    input.mouseDown = true;
  });

  window.addEventListener("mouseup", (event) => {
    if (event.button === 0) {
      input.mouseDown = false;
    }
  });

  window.addEventListener("blur", () => {
    input.mouseDown = false;
    input.keys.clear();
  });

  canvas.addEventListener("contextmenu", (event) => event.preventDefault());
}

function resize() {
  state.dpr = Math.min(window.devicePixelRatio || 1, 2);
  state.width = window.innerWidth;
  state.height = window.innerHeight;
  canvas.width = Math.round(state.width * state.dpr);
  canvas.height = Math.round(state.height * state.dpr);
  canvas.style.width = `${state.width}px`;
  canvas.style.height = `${state.height}px`;
  ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);

  const rail = clamp(Math.min(state.width, state.height) * 0.08, 44, 86);
  state.arena.left = rail;
  state.arena.top = rail;
  state.arena.right = state.width - rail;
  state.arena.bottom = state.height - rail;
  state.arena.width = state.arena.right - state.arena.left;
  state.arena.height = state.arena.bottom - state.arena.top;

  state.clothBuffer = buildClothTexture(Math.max(1, Math.floor(state.arena.width)), Math.max(1, Math.floor(state.arena.height)));

  if (state.player) {
    state.player.x = clamp(state.player.x, state.arena.left + state.player.radius, state.arena.right - state.player.radius);
    state.player.y = clamp(state.player.y, state.arena.top + state.player.radius, state.arena.bottom - state.player.radius);
  }
}

function buildClothTexture(width, height) {
  const buffer = makeBuffer(width, height);
  const c = buffer.getContext("2d");
  const gradient = c.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, "#2c715a");
  gradient.addColorStop(0.52, COLORS.cloth);
  gradient.addColorStop(1, COLORS.clothShade);
  c.fillStyle = gradient;
  c.fillRect(0, 0, width, height);

  const image = c.getImageData(0, 0, width, height);
  const { data } = image;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4;
      const noise = (Math.random() - 0.5) * 20;
      const nap = Math.sin(x * 0.046 + y * 0.013) * 6 + Math.cos(y * 0.082) * 4;
      data[i] = clamp(data[i] + noise - 5, 0, 255);
      data[i + 1] = clamp(data[i + 1] + noise + nap, 0, 255);
      data[i + 2] = clamp(data[i + 2] + noise - 8, 0, 255);
      data[i + 3] = 255;
    }
  }

  c.putImageData(image, 0, 0);

  c.save();
  c.globalAlpha = 0.06;
  c.strokeStyle = "#d6f0d8";
  for (let y = 0; y < height; y += 7) {
    c.beginPath();
    c.moveTo(0, y + 0.5);
    c.lineTo(width, y + 0.5);
    c.stroke();
  }
  c.restore();

  const vignette = c.createRadialGradient(width * 0.5, height * 0.45, Math.min(width, height) * 0.12, width * 0.5, height * 0.5, Math.max(width, height) * 0.72);
  vignette.addColorStop(0, "rgba(255,255,255,0)");
  vignette.addColorStop(1, "rgba(0,0,0,0.38)");
  c.fillStyle = vignette;
  c.fillRect(0, 0, width, height);

  return buffer;
}

function createPlayer() {
  return {
    x: state.width * 0.5,
    y: state.height * 0.5,
    vx: 0,
    vy: 0,
    radius: 24,
    maxHp: 100,
    hp: 100,
    fireCooldown: 0,
    hitTimer: 0,
    facing: 0,
    smoke: 0,
    lastVx: 0,
    lastVy: 0,
  };
}

function restart() {
  state.player = createPlayer();
  state.bullets = [];
  state.enemies = [];
  state.particles = [];
  state.debris = [];
  state.skidMarks = [];
  state.wave = 0;
  state.waveQueue = 0;
  state.spawnTimer = 0;
  state.nextWaveTimer = 0.8;
  state.score = 0;
  state.scoreDisplay = 0;
  state.gameOver = false;
  state.banner = "";
  state.bannerTimer = 0;
  state.shake = 0;
  state.time = 0;
  state.enemyId = 0;
  state.bulletId = 0;
  state.hintTimer = 7;
  overlay.classList.add("hidden");
  finalScoreLabel.textContent = "Счет: 0";
  resize();
}

function clampPlayerToArena() {
  const player = state.player;
  player.x = clamp(player.x, state.arena.left + player.radius, state.arena.right - player.radius);
  player.y = clamp(player.y, state.arena.top + player.radius, state.arena.bottom - player.radius);
}

function showGameOver() {
  state.gameOver = true;
  finalScoreLabel.textContent = `Счет: ${Math.floor(state.score)}`;
  overlay.classList.remove("hidden");
}

function startWave() {
  state.wave += 1;
  state.waveQueue = 4 + state.wave * 2 + Math.floor(state.wave * 0.75);
  state.spawnTimer = 0.16;
  state.banner = `Волна ${state.wave}`;
  state.bannerTimer = 2.6;
}

function getMoveVector() {
  const up = input.keys.has("KeyW") || input.keys.has("ArrowUp");
  const down = input.keys.has("KeyS") || input.keys.has("ArrowDown");
  const left = input.keys.has("KeyA") || input.keys.has("ArrowLeft");
  const right = input.keys.has("KeyD") || input.keys.has("ArrowRight");
  const x = (right ? 1 : 0) - (left ? 1 : 0);
  const y = (down ? 1 : 0) - (up ? 1 : 0);
  return normalize(x, y, 0, 0);
}

function spawnEnemy() {
  const edge = randInt(0, 3);
  const padding = 22;
  let x = 0;
  let y = 0;

  if (edge === 0) {
    x = rand(state.arena.left + padding, state.arena.right - padding);
    y = state.arena.top + padding;
  } else if (edge === 1) {
    x = state.arena.right - padding;
    y = rand(state.arena.top + padding, state.arena.bottom - padding);
  } else if (edge === 2) {
    x = rand(state.arena.left + padding, state.arena.right - padding);
    y = state.arena.bottom - padding;
  } else {
    x = state.arena.left + padding;
    y = rand(state.arena.top + padding, state.arena.bottom - padding);
  }

  const type = Math.random() < 0.32 ? "spider" : "gear";
  const radius = type === "gear" ? rand(18, 24) : rand(15, 20);
  const hp = type === "gear" ? 15 + state.wave * 2.2 : 10 + state.wave * 1.7;
  const speed = type === "gear" ? 52 + state.wave * 5.8 : 78 + state.wave * 6.2;

  state.enemies.push({
    id: ++state.enemyId,
    type,
    x,
    y,
    vx: 0,
    vy: 0,
    radius,
    maxHp: hp,
    hp,
    speed,
    rotation: rand(0, TAU),
    spin: rand(-3, 3),
    flash: 0,
    attackCooldown: rand(0.1, 0.5),
    alpha: 0,
  });
}

function shoot() {
  const player = state.player;
  if (!player || player.fireCooldown > 0 || state.gameOver) {
    return;
  }

  const aim = normalize(input.mouseX - player.x, input.mouseY - player.y, 1, 0);
  const muzzleX = player.x + aim.x * (player.radius + 10);
  const muzzleY = player.y + aim.y * (player.radius + 10);
  const speed = 960;

  state.bullets.push({
    id: ++state.bulletId,
    x: muzzleX,
    y: muzzleY,
    vx: aim.x * speed,
    vy: aim.y * speed,
    radius: 5,
    life: 1.9,
    bounces: 0,
    baseDamage: 12,
    hot: false,
    chain: 0,
    hits: new Set(),
  });

  player.vx -= aim.x * 155;
  player.vy -= aim.y * 155;
  player.fireCooldown = 0.22;
  player.smoke = 0.24;
  state.shake = Math.min(12, state.shake + 2.4);
  input.everShot = true;

  for (let i = 0; i < 4; i += 1) {
    const spread = rand(-0.35, 0.35);
    const dir = normalize(aim.x + spread * 0.2, aim.y + spread * 0.2, aim.x, aim.y);
    state.particles.push({
      type: "smoke",
      x: muzzleX,
      y: muzzleY,
      vx: dir.x * rand(30, 75),
      vy: dir.y * rand(30, 75),
      life: rand(0.28, 0.6),
      maxLife: 0.6,
      size: rand(8, 14),
      color: "rgba(204, 185, 165, 0.35)",
    });
  }
}

function damagePlayer(amount, sourceX, sourceY) {
  const player = state.player;
  if (player.hitTimer > 0 || state.gameOver) {
    return;
  }

  player.hp = Math.max(0, player.hp - amount);
  player.hitTimer = 0.7;
  const push = normalize(player.x - sourceX, player.y - sourceY, 0, -1);
  player.vx += push.x * 220;
  player.vy += push.y * 220;
  state.shake = Math.min(18, state.shake + 7);

  for (let i = 0; i < 14; i += 1) {
    const dir = normalize(push.x + rand(-0.8, 0.8), push.y + rand(-0.8, 0.8));
    state.particles.push({
      type: "spark",
      x: player.x,
      y: player.y,
      vx: dir.x * rand(140, 260),
      vy: dir.y * rand(120, 240),
      life: rand(0.18, 0.42),
      maxLife: 0.42,
      size: rand(8, 18),
      color: Math.random() < 0.5 ? COLORS.ember : COLORS.blood,
    });
  }

  if (player.hp <= 0) {
    showGameOver();
  }
}

function createImpactSparks(x, y, normalX, normalY, hot = false) {
  const count = hot ? 16 : 10;
  for (let i = 0; i < count; i += 1) {
    const dir = normalize(normalX + rand(-0.9, 0.9), normalY + rand(-0.9, 0.9), normalX, normalY);
    state.particles.push({
      type: "spark",
      x,
      y,
      vx: dir.x * rand(100, hot ? 340 : 220),
      vy: dir.y * rand(100, hot ? 340 : 220),
      life: rand(0.18, 0.44),
      maxLife: 0.44,
      size: rand(8, 16),
      color: hot ? (Math.random() < 0.5 ? COLORS.emberBright : COLORS.ember) : "#dad7cf",
    });
  }
}

function createDeathBurst(enemy, bullet) {
  const pieces = randInt(3, 5);

  for (let i = 0; i < pieces; i += 1) {
    const angle = rand(0, TAU);
    const speed = rand(90, 240);
    state.debris.push({
      type: Math.random() < 0.5 ? "gear" : "spring",
      x: enemy.x,
      y: enemy.y,
      vx: Math.cos(angle) * speed + enemy.vx * 0.3,
      vy: Math.sin(angle) * speed + enemy.vy * 0.3,
      radius: rand(4, 8),
      rotation: rand(0, TAU),
      vr: rand(-6, 6),
      life: 999,
      settle: false,
      tint: Math.random() < 0.4 ? "#7d6d61" : "#5e3c2b",
    });
  }

  for (let i = 0; i < 18; i += 1) {
    const dir = normalize(rand(-1, 1), rand(-1, 1), 1, 0);
    state.particles.push({
      type: "spark",
      x: enemy.x,
      y: enemy.y,
      vx: dir.x * rand(110, bullet.hot ? 340 : 210),
      vy: dir.y * rand(110, bullet.hot ? 340 : 210),
      life: rand(0.22, 0.5),
      maxLife: 0.5,
      size: rand(8, 18),
      color: bullet.hot ? COLORS.ember : "#b6ac9f",
    });
  }
}

function awardScore(bullet) {
  let gain = 10;

  if (bullet.bounces >= 2) {
    gain = 150;
  } else if (bullet.bounces === 1) {
    gain = 50;
  }

  if (bullet.chain > 1) {
    gain *= 1 + 0.45 * (bullet.chain - 1);
  }

  state.score += gain;
}

function updatePlayer(dt) {
  const player = state.player;
  const move = getMoveVector();
  const accel = 860;
  const drag = 4.8;
  const maxSpeed = 290;

  player.lastVx = player.vx;
  player.lastVy = player.vy;

  player.vx += move.x * accel * dt;
  player.vy += move.y * accel * dt;

  player.vx *= Math.exp(-drag * dt);
  player.vy *= Math.exp(-drag * dt);

  const speed = length(player.vx, player.vy);
  if (speed > maxSpeed) {
    const factor = maxSpeed / speed;
    player.vx *= factor;
    player.vy *= factor;
  }

  player.x += player.vx * dt;
  player.y += player.vy * dt;

  const minX = state.arena.left + player.radius;
  const maxX = state.arena.right - player.radius;
  const minY = state.arena.top + player.radius;
  const maxY = state.arena.bottom - player.radius;

  if (player.x < minX) {
    player.x = minX;
    player.vx *= -0.24;
  } else if (player.x > maxX) {
    player.x = maxX;
    player.vx *= -0.24;
  }

  if (player.y < minY) {
    player.y = minY;
    player.vy *= -0.24;
  } else if (player.y > maxY) {
    player.y = maxY;
    player.vy *= -0.24;
  }

  player.fireCooldown = Math.max(0, player.fireCooldown - dt);
  player.hitTimer = Math.max(0, player.hitTimer - dt);
  player.smoke = Math.max(0, player.smoke - dt);
  player.facing = Math.atan2(input.mouseY - player.y, input.mouseX - player.x);

  const turn = length(player.vx - player.lastVx, player.vy - player.lastVy);
  if (turn > 36 && speed > 110) {
    state.skidMarks.push({
      x1: player.x - player.vx * 0.016,
      y1: player.y - player.vy * 0.016,
      x2: player.x,
      y2: player.y,
      life: 4.8,
      maxLife: 4.8,
    });
  }

  if (input.mouseDown) {
    shoot();
  }
}

function handleEnemyDeath(enemy, bullet) {
  enemy.dead = true;
  bullet.chain += 1;
  awardScore(bullet);
  createDeathBurst(enemy, bullet);
}

function handleBulletEnemyHit(bullet, enemy, hit) {
  bullet.hits.add(enemy.id);
  enemy.hp -= bullet.baseDamage * (1 + bullet.bounces);
  enemy.flash = 0.12;
  const impactNormal = normalize(bullet.vx, bullet.vy);
  enemy.vx += impactNormal.x * 110;
  enemy.vy += impactNormal.y * 110;
  createImpactSparks(hit.x, hit.y, impactNormal.x, impactNormal.y, bullet.hot);

  if (enemy.hp <= 0) {
    handleEnemyDeath(enemy, bullet);
  }

  if (!bullet.hot) {
    bullet.dead = true;
  } else {
    bullet.vx *= 1.02;
    bullet.vy *= 1.02;
  }
}

function reflectBullet(bullet, normal) {
  const dot = bullet.vx * normal.x + bullet.vy * normal.y;
  bullet.vx -= 2 * dot * normal.x;
  bullet.vy -= 2 * dot * normal.y;
  bullet.bounces += 1;
  bullet.hot = true;
  state.shake = Math.min(16, state.shake + 1.2);
}

function updateBullet(bullet, dt) {
  let remaining = dt;
  let iterations = 0;

  while (remaining > 0 && iterations < 6 && !bullet.dead) {
    iterations += 1;
    const nextX = bullet.x + bullet.vx * remaining;
    const nextY = bullet.y + bullet.vy * remaining;
    let best = null;

    const wallHit = segmentArenaHit(bullet.x, bullet.y, nextX, nextY, bullet.radius);
    if (wallHit) {
      best = { type: "wall", ...wallHit };
    }

    for (const enemy of state.enemies) {
      if (enemy.dead || bullet.hits.has(enemy.id)) {
        continue;
      }
      const hit = segmentCircleHit(bullet.x, bullet.y, nextX, nextY, enemy.x, enemy.y, enemy.radius + bullet.radius);
      if (hit && (!best || hit.t < best.t)) {
        best = { type: "enemy", enemy, ...hit };
      }
    }

    if (!best) {
      bullet.x = nextX;
      bullet.y = nextY;
      break;
    }

    const consumed = remaining * best.t;
    bullet.x += bullet.vx * consumed;
    bullet.y += bullet.vy * consumed;
    remaining *= 1 - best.t;

    if (best.type === "wall") {
      createImpactSparks(best.x, best.y, best.normal.x, best.normal.y, true);
      reflectBullet(bullet, best.normal);
      bullet.x += best.normal.x * 0.6;
      bullet.y += best.normal.y * 0.6;
    } else if (best.type === "enemy") {
      handleBulletEnemyHit(bullet, best.enemy, best);
      bullet.x += normalize(bullet.vx, bullet.vy).x * 0.2;
      bullet.y += normalize(bullet.vx, bullet.vy).y * 0.2;
    }

    if (bullet.bounces > 4) {
      bullet.dead = true;
    }

    if (remaining < 1e-4) {
      break;
    }
  }

  bullet.life -= dt;
  if (bullet.life <= 0) {
    bullet.dead = true;
  }
}

function updateEnemies(dt) {
  const player = state.player;

  for (let i = 0; i < state.enemies.length; i += 1) {
    const enemy = state.enemies[i];
    enemy.flash = Math.max(0, enemy.flash - dt);
    enemy.attackCooldown = Math.max(0, enemy.attackCooldown - dt);
    enemy.alpha = Math.min(1, enemy.alpha + dt * 2.5);

    const toPlayer = normalize(player.x - enemy.x, player.y - enemy.y, 1, 0);
    let steerX = toPlayer.x;
    let steerY = toPlayer.y;

    for (let j = 0; j < state.enemies.length; j += 1) {
      if (i === j) {
        continue;
      }

      const other = state.enemies[j];
      if (other.dead) {
        continue;
      }

      const dx = enemy.x - other.x;
      const dy = enemy.y - other.y;
      const dist = Math.hypot(dx, dy);
      const minDist = enemy.radius + other.radius + 12;

      if (dist > 0 && dist < minDist) {
        const repel = (minDist - dist) / minDist;
        steerX += (dx / dist) * repel * 1.8;
        steerY += (dy / dist) * repel * 1.8;
      }
    }

    const dir = normalize(steerX, steerY, toPlayer.x, toPlayer.y);
    enemy.vx += dir.x * enemy.speed * 2.2 * dt;
    enemy.vy += dir.y * enemy.speed * 2.2 * dt;
    enemy.vx *= Math.exp(-3.4 * dt);
    enemy.vy *= Math.exp(-3.4 * dt);

    const topSpeed = enemy.type === "gear" ? enemy.speed : enemy.speed * 1.12;
    const spd = length(enemy.vx, enemy.vy);
    if (spd > topSpeed) {
      enemy.vx *= topSpeed / spd;
      enemy.vy *= topSpeed / spd;
    }

    enemy.x += enemy.vx * dt;
    enemy.y += enemy.vy * dt;
    enemy.rotation += (enemy.spin + spd * 0.012) * dt;

    const left = state.arena.left + enemy.radius;
    const right = state.arena.right - enemy.radius;
    const top = state.arena.top + enemy.radius;
    const bottom = state.arena.bottom - enemy.radius;

    if (enemy.x < left) {
      enemy.x = left;
      enemy.vx *= -0.25;
    } else if (enemy.x > right) {
      enemy.x = right;
      enemy.vx *= -0.25;
    }

    if (enemy.y < top) {
      enemy.y = top;
      enemy.vy *= -0.25;
    } else if (enemy.y > bottom) {
      enemy.y = bottom;
      enemy.vy *= -0.25;
    }

    const dx = player.x - enemy.x;
    const dy = player.y - enemy.y;
    const dist = Math.hypot(dx, dy);
    const overlap = player.radius + enemy.radius - dist;

    if (overlap > 0) {
      const normal = normalize(dx, dy, 1, 0);
      enemy.x -= normal.x * overlap * 0.46;
      enemy.y -= normal.y * overlap * 0.46;
      player.x += normal.x * overlap * 0.54;
      player.y += normal.y * overlap * 0.54;

      if (enemy.attackCooldown <= 0) {
        damagePlayer(enemy.type === "gear" ? 12 : 9, enemy.x, enemy.y);
        enemy.attackCooldown = enemy.type === "gear" ? 0.9 : 0.65;
      }
    }
  }

  clampPlayerToArena();
  state.enemies = state.enemies.filter((enemy) => !enemy.dead);
}

function updateDebris(dt) {
  for (const piece of state.debris) {
    if (piece.settle) {
      continue;
    }

    piece.x += piece.vx * dt;
    piece.y += piece.vy * dt;
    piece.rotation += piece.vr * dt;
    piece.vx *= Math.exp(-2.8 * dt);
    piece.vy *= Math.exp(-2.8 * dt);
    piece.vr *= Math.exp(-3.4 * dt);

    const left = state.arena.left + piece.radius;
    const right = state.arena.right - piece.radius;
    const top = state.arena.top + piece.radius;
    const bottom = state.arena.bottom - piece.radius;

    if (piece.x < left) {
      piece.x = left;
      piece.vx *= -0.4;
    } else if (piece.x > right) {
      piece.x = right;
      piece.vx *= -0.4;
    }

    if (piece.y < top) {
      piece.y = top;
      piece.vy *= -0.4;
    } else if (piece.y > bottom) {
      piece.y = bottom;
      piece.vy *= -0.4;
    }

    if (length(piece.vx, piece.vy) < 8 && Math.abs(piece.vr) < 0.3) {
      piece.settle = true;
    }
  }
}

function updateParticles(dt) {
  for (const particle of state.particles) {
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
    particle.life -= dt;

    if (particle.type === "spark") {
      particle.vx *= Math.exp(-7 * dt);
      particle.vy *= Math.exp(-7 * dt);
    } else {
      particle.vx *= Math.exp(-2.2 * dt);
      particle.vy *= Math.exp(-2.2 * dt);
      particle.vy -= 16 * dt;
    }
  }

  for (const mark of state.skidMarks) {
    mark.life -= dt;
  }

  state.particles = state.particles.filter((particle) => particle.life > 0);
  state.skidMarks = state.skidMarks.filter((mark) => mark.life > 0);
}

function update(dt) {
  state.time += dt;
  state.shake = Math.max(0, state.shake - dt * 16);
  state.bannerTimer = Math.max(0, state.bannerTimer - dt);
  state.hintTimer = Math.max(0, state.hintTimer - dt);
  state.scoreDisplay = lerp(state.scoreDisplay, state.score, 1 - Math.exp(-8 * dt));

  if (!state.gameOver) {
    updatePlayer(dt);

    for (const bullet of state.bullets) {
      updateBullet(bullet, dt);
    }
    state.bullets = state.bullets.filter((bullet) => !bullet.dead);

    updateEnemies(dt);
    updateDebris(dt);
    updateParticles(dt);

    if (state.waveQueue > 0) {
      state.spawnTimer -= dt;
      if (state.spawnTimer <= 0) {
        spawnEnemy();
        state.waveQueue -= 1;
        state.spawnTimer = Math.max(0.14, 0.5 - state.wave * 0.03);
      }
    } else if (state.enemies.length === 0) {
      state.nextWaveTimer -= dt;
      if (state.nextWaveTimer <= 0) {
        startWave();
        state.nextWaveTimer = 1.8;
      }
    }
  } else {
    updateDebris(dt);
    updateParticles(dt);
  }
}

function drawShadow(x, y, radius, alpha = 0.36) {
  ctx.save();
  ctx.fillStyle = `rgba(0, 0, 0, ${alpha})`;
  ctx.shadowColor = "rgba(0, 0, 0, 0.28)";
  ctx.shadowBlur = radius * 0.9;
  ctx.beginPath();
  ctx.ellipse(x + 9, y + radius * 0.7, radius * 0.95, radius * 0.58, 0.08, 0, TAU);
  ctx.fill();
  ctx.restore();
}

function drawArena() {
  ctx.fillStyle = "#160c0a";
  ctx.fillRect(0, 0, state.width, state.height);

  const rail = state.arena.left;
  const outerGradient = ctx.createLinearGradient(0, 0, state.width, state.height);
  outerGradient.addColorStop(0, "#7e4128");
  outerGradient.addColorStop(0.45, COLORS.wood);
  outerGradient.addColorStop(1, COLORS.woodDark);
  ctx.fillStyle = outerGradient;
  ctx.fillRect(rail * 0.34, rail * 0.34, state.width - rail * 0.68, state.height - rail * 0.68);

  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.45)";
  ctx.shadowBlur = 40;
  ctx.strokeStyle = "rgba(18, 7, 4, 0.75)";
  ctx.lineWidth = clamp(rail * 0.3, 12, 26);
  ctx.strokeRect(state.arena.left - ctx.lineWidth * 0.5, state.arena.top - ctx.lineWidth * 0.5, state.arena.width + ctx.lineWidth, state.arena.height + ctx.lineWidth);
  ctx.restore();

  ctx.drawImage(state.clothBuffer, state.arena.left, state.arena.top, state.arena.width, state.arena.height);

  const innerGlow = ctx.createLinearGradient(state.arena.left, state.arena.top, state.arena.right, state.arena.bottom);
  innerGlow.addColorStop(0, "rgba(255,255,255,0.13)");
  innerGlow.addColorStop(0.3, "rgba(255,255,255,0)");
  innerGlow.addColorStop(1, "rgba(0,0,0,0.24)");
  ctx.fillStyle = innerGlow;
  ctx.fillRect(state.arena.left, state.arena.top, state.arena.width, state.arena.height);

  ctx.strokeStyle = "rgba(255, 241, 198, 0.14)";
  ctx.lineWidth = 2;
  ctx.strokeRect(state.arena.left + 1, state.arena.top + 1, state.arena.width - 2, state.arena.height - 2);
}

function drawSkidMarks() {
  ctx.save();
  ctx.lineCap = "round";
  for (const mark of state.skidMarks) {
    const alpha = (mark.life / mark.maxLife) * 0.18;
    ctx.strokeStyle = `rgba(22, 13, 10, ${alpha})`;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(mark.x1, mark.y1);
    ctx.lineTo(mark.x2, mark.y2);
    ctx.stroke();
  }
  ctx.restore();
}

function drawDebrisPiece(piece) {
  ctx.save();
  ctx.translate(piece.x, piece.y);
  ctx.rotate(piece.rotation);
  ctx.globalAlpha = piece.settle ? 0.82 : 1;
  ctx.strokeStyle = piece.tint;
  ctx.fillStyle = piece.tint;
  ctx.lineWidth = 1.5;

  if (piece.type === "gear") {
    const teeth = 8;
    ctx.beginPath();
    for (let i = 0; i < teeth * 2; i += 1) {
      const angle = (i / (teeth * 2)) * TAU;
      const radius = i % 2 === 0 ? piece.radius : piece.radius * 0.72;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.closePath();
    ctx.stroke();
  } else {
    ctx.beginPath();
    for (let i = 0; i < 5; i += 1) {
      const x = (i - 2) * (piece.radius * 0.46);
      const y = Math.sin(i * 1.4) * piece.radius * 0.55;
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();
  }

  ctx.restore();
}

function drawDebris() {
  for (const piece of state.debris) {
    drawDebrisPiece(piece);
  }
}

function metalGradient(x, y, radius, base, dark, hotness = 0) {
  const gradient = ctx.createRadialGradient(
    x + LIGHT.x * radius * 0.38,
    y + LIGHT.y * radius * 0.38,
    radius * 0.12,
    x,
    y,
    radius
  );

  if (hotness > 0) {
    gradient.addColorStop(0, lerpColor("#fff2cb", COLORS.emberBright, hotness));
    gradient.addColorStop(0.45, lerpColor(base, COLORS.ember, hotness));
    gradient.addColorStop(1, lerpColor(dark, "#51200a", hotness));
  } else {
    gradient.addColorStop(0, "#fff7d7");
    gradient.addColorStop(0.45, base);
    gradient.addColorStop(1, dark);
  }

  return gradient;
}

function lerpColor(a, b, t) {
  const ax = parseInt(a.slice(1), 16);
  const bx = parseInt(b.slice(1), 16);
  const ar = (ax >> 16) & 255;
  const ag = (ax >> 8) & 255;
  const ab = ax & 255;
  const br = (bx >> 16) & 255;
  const bg = (bx >> 8) & 255;
  const bb = bx & 255;
  const r = Math.round(lerp(ar, br, t));
  const g = Math.round(lerp(ag, bg, t));
  const blue = Math.round(lerp(ab, bb, t));
  return `rgb(${r}, ${g}, ${blue})`;
}

function drawPlayer() {
  const player = state.player;
  const hot = clamp(player.smoke * 4, 0, 1);
  drawShadow(player.x, player.y, player.radius + 3, 0.34);

  ctx.save();
  ctx.translate(player.x, player.y);
  ctx.rotate(player.facing);

  ctx.fillStyle = metalGradient(0, 0, player.radius, COLORS.brass, COLORS.brassDark, hot * 0.2);
  ctx.beginPath();
  ctx.arc(0, 0, player.radius, 0, TAU);
  ctx.fill();

  ctx.strokeStyle = "rgba(255, 238, 196, 0.42)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, player.radius - 4, 0, TAU);
  ctx.stroke();

  ctx.fillStyle = "#3d2313";
  ctx.fillRect(player.radius * 0.18, -6, player.radius * 0.95, 12);

  const barrelGlow = ctx.createLinearGradient(player.radius * 0.18, -6, player.radius * 1.1, 6);
  barrelGlow.addColorStop(0, "#57321c");
  barrelGlow.addColorStop(1, hot > 0 ? "#da6c24" : "#23120d");
  ctx.fillStyle = barrelGlow;
  ctx.fillRect(player.radius * 0.18, -4.2, player.radius * 0.9, 8.4);

  ctx.restore();

  const hpRatio = player.hp / player.maxHp;
  ctx.save();
  ctx.strokeStyle = "rgba(0, 0, 0, 0.42)";
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(player.x, player.y, player.radius + 9, -Math.PI * 0.68, Math.PI * 0.68);
  ctx.stroke();
  ctx.strokeStyle = hpRatio > 0.4 ? "#f5d581" : "#e36a4c";
  ctx.beginPath();
  ctx.arc(player.x, player.y, player.radius + 9, -Math.PI * 0.68, -Math.PI * 0.68 + Math.PI * 1.36 * hpRatio);
  ctx.stroke();
  ctx.restore();

  if (player.hitTimer > 0) {
    ctx.save();
    ctx.globalAlpha = player.hitTimer * 0.4;
    ctx.fillStyle = "#f5c78c";
    ctx.beginPath();
    ctx.arc(player.x, player.y, player.radius + 4, 0, TAU);
    ctx.fill();
    ctx.restore();
  }
}

function pathGear(radius, teeth) {
  ctx.beginPath();
  for (let i = 0; i < teeth * 2; i += 1) {
    const angle = (i / (teeth * 2)) * TAU;
    const r = i % 2 === 0 ? radius : radius * 0.72;
    const x = Math.cos(angle) * r;
    const y = Math.sin(angle) * r;
    if (i === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  }
  ctx.closePath();
}

function drawGearEnemy(enemy) {
  ctx.save();
  ctx.translate(enemy.x, enemy.y);
  drawShadow(0, 0, enemy.radius, 0.28);
  ctx.globalAlpha = enemy.alpha;
  ctx.rotate(enemy.rotation);

  ctx.fillStyle = metalGradient(0, 0, enemy.radius, COLORS.rust, COLORS.rustDark, 0);
  pathGear(enemy.radius, 10);
  ctx.fill();

  ctx.strokeStyle = enemy.flash > 0 ? "#f6d89c" : "rgba(255, 230, 182, 0.15)";
  ctx.lineWidth = 1.5;
  pathGear(enemy.radius, 10);
  ctx.stroke();

  ctx.fillStyle = "#2a1913";
  ctx.beginPath();
  ctx.arc(0, 0, enemy.radius * 0.42, 0, TAU);
  ctx.fill();
  ctx.restore();
}

function drawSpiderEnemy(enemy) {
  ctx.save();
  ctx.translate(enemy.x, enemy.y);
  drawShadow(0, 0, enemy.radius, 0.22);
  ctx.globalAlpha = enemy.alpha;
  ctx.rotate(enemy.rotation * 0.45);

  ctx.strokeStyle = enemy.flash > 0 ? "#f4ddb2" : "#4b2b20";
  ctx.lineWidth = 2.2;
  for (let side = -1; side <= 1; side += 2) {
    for (let i = 0; i < 4; i += 1) {
      const spread = -0.85 + i * 0.55;
      ctx.beginPath();
      ctx.moveTo(side * enemy.radius * 0.28, spread * enemy.radius * 0.32);
      ctx.lineTo(side * enemy.radius * 0.85, spread * enemy.radius * 0.66);
      ctx.lineTo(side * enemy.radius * 1.18, spread * enemy.radius * 0.38 + Math.sin(state.time * 8 + i) * 2);
      ctx.stroke();
    }
  }

  ctx.fillStyle = metalGradient(0, 0, enemy.radius * 0.82, "#8c5b45", "#321c16", 0);
  ctx.beginPath();
  ctx.arc(0, 0, enemy.radius * 0.82, 0, TAU);
  ctx.fill();

  ctx.fillStyle = "#24130f";
  ctx.beginPath();
  ctx.arc(0, 0, enemy.radius * 0.35, 0, TAU);
  ctx.fill();
  ctx.restore();
}

function drawEnemies() {
  for (const enemy of state.enemies) {
    if (enemy.type === "gear") {
      drawGearEnemy(enemy);
    } else {
      drawSpiderEnemy(enemy);
    }
  }
}

function drawBullets() {
  for (const bullet of state.bullets) {
    const angle = Math.atan2(bullet.vy, bullet.vx);
    const trail = bullet.hot ? 18 : 10;
    const trailAlpha = bullet.hot ? 0.4 : 0.18;

    ctx.save();
    ctx.strokeStyle = bullet.hot ? `rgba(255, 157, 55, ${trailAlpha})` : `rgba(255, 255, 255, ${trailAlpha})`;
    ctx.lineWidth = bullet.radius * (bullet.hot ? 1.2 : 1);
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(bullet.x, bullet.y);
    ctx.lineTo(bullet.x - Math.cos(angle) * trail, bullet.y - Math.sin(angle) * trail);
    ctx.stroke();
    ctx.restore();

    drawShadow(bullet.x, bullet.y, bullet.radius + 1, 0.16);
    ctx.fillStyle = bullet.hot
      ? metalGradient(bullet.x, bullet.y, bullet.radius + 1.2, COLORS.ember, "#5a260b", 1)
      : metalGradient(bullet.x, bullet.y, bullet.radius + 1, COLORS.steel, COLORS.steelDark, 0);
    ctx.beginPath();
    ctx.arc(bullet.x, bullet.y, bullet.radius, 0, TAU);
    ctx.fill();
  }
}

function drawParticles() {
  ctx.save();
  ctx.lineCap = "round";
  for (const particle of state.particles) {
    const alpha = clamp(particle.life / particle.maxLife, 0, 1);
    if (particle.type === "spark") {
      const dir = normalize(particle.vx, particle.vy, 1, 0);
      ctx.strokeStyle = colorWithAlpha(particle.color, alpha * 0.95);
      ctx.lineWidth = Math.max(1.2, particle.size * 0.08);
      ctx.beginPath();
      ctx.moveTo(particle.x, particle.y);
      ctx.lineTo(particle.x - dir.x * particle.size, particle.y - dir.y * particle.size);
      ctx.stroke();
    } else {
      ctx.fillStyle = colorWithAlpha(particle.color, alpha * 0.8);
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.size * alpha, 0, TAU);
      ctx.fill();
    }
  }
  ctx.restore();
}

function colorWithAlpha(color, alpha) {
  if (color.startsWith("rgba")) {
    return color.replace(/[\d.]+\)$/u, `${alpha})`);
  }
  if (color.startsWith("rgb(")) {
    return color.replace("rgb(", "rgba(").replace(")", `, ${alpha})`);
  }
  if (color.startsWith("#")) {
    const value = parseInt(color.slice(1), 16);
    const r = (value >> 16) & 255;
    const g = (value >> 8) & 255;
    const b = value & 255;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  return color;
}

function drawHud() {
  ctx.save();
  ctx.fillStyle = "rgba(9, 6, 5, 0.42)";
  ctx.fillRect(22, 20, 190, 76);
  ctx.fillRect(state.width - 196, 20, 174, 64);

  ctx.fillStyle = COLORS.ivory;
  ctx.font = '600 28px "Iowan Old Style", "Baskerville", serif';
  ctx.fillText(`${Math.floor(state.scoreDisplay)}`, 34, 54);
  ctx.font = '500 14px "Iowan Old Style", "Baskerville", serif';
  ctx.fillStyle = "rgba(244, 225, 184, 0.78)";
  ctx.fillText("счет", 36, 76);

  ctx.fillStyle = COLORS.ivory;
  ctx.font = '600 24px "Iowan Old Style", "Baskerville", serif';
  ctx.fillText(`Волна ${state.wave}`, state.width - 176, 52);
  ctx.font = '500 13px "Iowan Old Style", "Baskerville", serif';
  ctx.fillStyle = "rgba(244, 225, 184, 0.76)";
  ctx.fillText(`${state.enemies.length} механизмов на столе`, state.width - 176, 73);

  if (state.bannerTimer > 0) {
    const alpha = Math.sin((state.bannerTimer / 2.6) * Math.PI);
    ctx.globalAlpha = alpha;
    ctx.textAlign = "center";
    ctx.fillStyle = COLORS.ivory;
    ctx.font = '600 42px "Iowan Old Style", "Baskerville", serif';
    ctx.fillText(state.banner, state.width * 0.5, 78);
    ctx.font = '500 15px "Iowan Old Style", "Baskerville", serif';
    ctx.fillStyle = "rgba(244, 225, 184, 0.78)";
    ctx.fillText("Удар от борта раскаляет шарик", state.width * 0.5, 104);
    ctx.textAlign = "start";
  }

  if (!input.everMoved || !input.everShot) {
    const alpha = clamp(state.hintTimer / 7, 0, 1);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = "rgba(8, 6, 5, 0.48)";
    const boxWidth = Math.min(380, state.width - 40);
    ctx.fillRect(22, state.height - 104, boxWidth, 68);
    ctx.fillStyle = COLORS.ivory;
    ctx.font = '500 16px "Iowan Old Style", "Baskerville", serif';
    ctx.fillText("WASD - ходьба", 36, state.height - 72);
    ctx.fillText("Мышь - прицел, ЛКМ - выстрел, R - рестарт", 36, state.height - 48);
  }

  ctx.restore();
}

function render() {
  ctx.save();
  if (state.shake > 0) {
    ctx.translate(rand(-state.shake, state.shake), rand(-state.shake, state.shake));
  }

  drawArena();
  drawSkidMarks();
  drawDebris();
  drawEnemies();
  drawPlayer();
  drawBullets();
  drawParticles();
  ctx.restore();
  drawHud();
}

function frame(now) {
  const dt = Math.min(0.033, (now - state.lastTime) / 1000 || 0.016);
  state.lastTime = now;
  update(dt);
  render();
  requestAnimationFrame(frame);
}

restartButton.addEventListener("click", restart);
window.addEventListener("resize", resize);

bindInput();
restart();
startWave();
requestAnimationFrame(frame);
