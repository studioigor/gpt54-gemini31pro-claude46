import { Input } from './input.js';
import { Player, Bud, Shadow } from './entities.js';
import { Level } from './level.js';
import { ParticleSystem } from './particles.js';

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

let lastTime = 0;
let gameState = 'menu'; // menu, playing, victory, defeat

let player;
let currentLevel;
let levelIndex = 0;

const ui = {
    menu: document.getElementById('main-menu'),
    hud: document.getElementById('hud'),
    victory: document.getElementById('victory-screen'),
    defeat: document.getElementById('defeat-screen'),
    progressFill: document.getElementById('progress-fill'),
    lightIndicator: document.getElementById('light-indicator')
};

const btnStart = document.getElementById('btn-start');
const btnRestart = document.getElementById('btn-restart');
const btnRetry = document.getElementById('btn-retry');

btnStart.addEventListener('click', () => startGame(0));
btnRestart.addEventListener('click', () => startGame(0));
btnRetry.addEventListener('click', () => startGame(levelIndex));

function switchUI(state) {
    Object.values(ui).forEach(el => {
        if (el.classList) el.classList.remove('active');
    });

    if (state === 'menu') ui.menu.classList.add('active');
    if (state === 'playing') ui.hud.classList.add('active');
    if (state === 'victory') ui.victory.classList.add('active');
    if (state === 'defeat') ui.defeat.classList.add('active');
}

function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

Input.init(canvas);

function startGame(lIdx) {
    levelIndex = lIdx;
    currentLevel = new Level(levelIndex, canvas.width, canvas.height);
    player = new Player(currentLevel.startPos.x, currentLevel.startPos.y);
    ParticleSystem.particles = [];
    gameState = 'playing';
    switchUI('playing');
    lastTime = performance.now();
    requestAnimationFrame(gameLoop);
}

function updateDefeat() {
    gameState = 'defeat';
    switchUI('defeat');
}

function updateVictory() {
    gameState = 'victory';
    switchUI('victory');
}

function gameLoop(time) {
    if (gameState !== 'playing') return;

    let dt = (time - lastTime) / 1000;
    lastTime = time;
    if (dt > 0.1) dt = 0.1; // cap detla time

    update(dt);
    draw(ctx);
    Input.update(); // Reset input frame state

    requestAnimationFrame(gameLoop);
}

function update(dt) {
    player.update(dt);
    currentLevel.update(dt, player);
    ParticleSystem.update(dt);

    // Update HUD
    let progress = currentLevel.getProgress();
    ui.progressFill.style.width = `${progress * 100}%`;
    ui.lightIndicator.innerText = `Свет: ${Math.floor(player.light)}%`;

    // Check Victory
    if (progress >= 1.0) {
        // Unlock main bud
        if (currentLevel.mainBud.state === 'sleeping') {
            currentLevel.mainBud.state = 'alive';
            ParticleSystem.emit(currentLevel.mainBud.pos.x, currentLevel.mainBud.pos.y, 50, {
                speedRange: [50, 200],
                lifeRange: [1, 2],
                sizeRange: [3, 6],
                color: [252, 238, 167]
            });
        }
    }

    // Actually win when touching the activated main flower
    if (currentLevel.mainBud.state === 'alive') {
        let diff = currentLevel.mainBud.pos.copy().sub(player.pos);
        if (diff.mag() < currentLevel.mainBud.radius + player.radius) {
            updateVictory();
        }
    }

    // Check Defeat
    if (player.light <= 0) {
        updateDefeat();
    }
}

function draw(ctx) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#111a19';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Render logic
    currentLevel.draw(ctx);
    player.draw(ctx);
    ParticleSystem.draw(ctx);

    // Draw ambient darkness multiplier? No, let's keep it simple.
}

switchUI('menu');
