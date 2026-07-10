// ============================================
// TOWER DEFENSE GAME - FIXED VERSION
// ============================================

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Responsive canvas sizing
const GRID_SIZE = 40;
const COLS = 20;
const ROWS = 20;
canvas.width = COLS * GRID_SIZE;
canvas.height = ROWS * GRID_SIZE;

// ============================================
// GAME STATE
// ============================================
const state = {
    gold: 200,
    lives: 20,
    wave: 1,
    kills: 0,
    selectedTower: 'arrow',
    towers: [],
    enemies: [],
    projectiles: [],
    particles: [],
    gameOver: false,
    waveActive: false,
    enemiesToSpawn: 0,
    enemiesSpawned: 0,
    spawnTimer: 0,
    spawnDelay: 30, // frames between enemy spawns
};

// ============================================
// MAP DATA (0=path, 1=buildable, 2=start, 3=end)
// ============================================
const mapData = [
    1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
    2,0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
    1,1,1,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
    1,1,1,0,0,0,0,0,0,1,1,1,1,1,1,1,1,1,1,1,
    1,1,1,1,1,1,1,1,0,1,1,1,1,1,1,1,1,1,1,1,
    1,1,1,1,1,1,1,1,0,0,0,0,0,0,1,1,1,1,1,1,
    1,1,1,1,1,1,1,1,1,1,1,1,1,0,1,1,1,1,1,1,
    1,1,1,1,1,1,1,1,1,1,1,1,1,0,1,1,1,1,1,1,
    1,1,1,1,1,0,0,0,0,0,0,0,0,0,1,1,1,1,1,1,
    1,1,1,1,1,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
    1,1,1,1,1,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
    1,1,1,1,1,0,0,0,0,0,0,1,1,1,1,1,1,1,1,1,
    1,1,1,1,1,1,1,1,1,1,0,1,1,1,1,1,1,1,1,1,
    1,1,1,1,1,1,1,1,1,1,0,0,0,0,0,0,0,1,1,1,
    1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,1,1,1,
    1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,1,1,1,
    1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,1,1,1,
    1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,1,1,1,
    1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,3,1,1,
    1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
];

const startPos = { col: 0, row: 1 };
const endPos = { col: 17, row: 18 };

// ============================================
// TOWER DEFINITIONS
// ============================================
const towerDefs = {
    arrow: {
        name: 'Arrow Tower',
        cost: 50,
        damage: 15,
        range: 120,
        fireRate: 30,
        color: '#4ade80',
        projectileColor: '#a3e635',
        projectileSpeed: 8,
        splash: 0,
    },
    cannon: {
        name: 'Cannon Tower',
        cost: 100,
        damage: 40,
        range: 100,
        fireRate: 60,
        color: '#f97316',
        projectileColor: '#fdba74',
        projectileSpeed: 5,
        splash: 40,
    },
    ice: {
        name: 'Ice Tower',
        cost: 75,
        damage: 8,
        range: 100,
        fireRate: 40,
        color: '#67e8f9',
        projectileColor: '#cffafe',
        projectileSpeed: 6,
        splash: 0,
        slow: 0.5,
        slowDuration: 60,
    },
    lightning: {
        name: 'Lightning Tower',
        cost: 150,
        damage: 25,
        range: 130,
        fireRate: 45,
        color: '#c084fc',
        projectileColor: '#e9d5ff',
        projectileSpeed: 12,
        chain: 2,
    },
};

// ============================================
// PATHFINDING (A* Algorithm)
// ============================================
function getWaypoints() {
    const visited = new Set();
    const queue = [{ col: startPos.col, row: startPos.row, path: [] }];
    
    while (queue.length > 0) {
        const { col, row, path: currentPath } = queue.shift();
        const key = `${col},${row}`;
        
        if (visited.has(key)) continue;
        visited.add(key);
        
        const newPath = [...currentPath, { col, row }];
        
        if (col === endPos.col && row === endPos.row) {
            return newPath;
        }
        
        const neighbors = [
            { col: col + 1, row },
            { col: col - 1, row },
            { col, row: row + 1 },
            { col, row: row - 1 },
        ];
        
        for (const neighbor of neighbors) {
            const idx = neighbor.row * COLS + neighbor.col;
            if (neighbor.col >= 0 && neighbor.col < COLS && 
                neighbor.row >= 0 && neighbor.row < ROWS &&
                (mapData[idx] === 0 || mapData[idx] === 3)) {
                queue.push({ ...neighbor, path: newPath });
            }
        }
    }
    return [];
}

const waypoints = getWaypoints();

// ============================================
// CLASSES
// ============================================

class Tower {
    constructor(col, row, type) {
        this.col = col;
        this.row = row;
        this.x = col * GRID_SIZE + GRID_SIZE / 2;
        this.y = row * GRID_SIZE + GRID_SIZE / 2;
        this.type = type;
        this.def = towerDefs[type];
        this.fireCooldown = 0;
        this.target = null;
        this.level = 1;
        this.angle = 0;
    }

    update(enemies) {
        if (this.fireCooldown > 0) this.fireCooldown--;

        this.target = null;
        let closestDist = Infinity;
        
        for (const enemy of enemies) {
            const dx = enemy.x - this.x;
            const dy = enemy.y - this.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            if (dist <= this.def.range && dist < closestDist) {
                closestDist = dist;
                this.target = enemy;
            }
        }

        if (this.target) {
            this.angle = Math.atan2(
                this.target.y - this.y,
                this.target.x - this.x
            );
            
            if (this.fireCooldown <= 0) {
                this.fire(this.target);
                this.fireCooldown = this.def.fireRate;
            }
        }
    }

    fire(enemy) {
        const dmg = this.def.damage * (1 + (this.level - 1) * 0.5);
        
        state.projectiles.push(new Projectile(
            this.x, this.y, enemy,
            dmg, this.def.projectileSpeed,
            this.def.projectileColor,
            this.type
        ));
    }

    draw(ctx) {
        // Draw base
        ctx.fillStyle = this.def.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, GRID_SIZE * 0.35, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // Draw barrel
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);
        ctx.fillStyle = '#fff';
        ctx.fillRect(GRID_SIZE * 0.15, -3, GRID_SIZE * 0.3, 6);
        ctx.restore();
        
        // Level indicator
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(this.level, this.x, this.y - GRID_SIZE * 0.4);
        
        // Draw range when hovering/selected
        if (this === state.selectedTowerForUpgrade) {
            ctx.strokeStyle = 'rgba(255,255,255,0.3)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.def.range, 0, Math.PI * 2);
            ctx.stroke();
        }
    }
}

class Enemy {
    constructor(wave) {
        this.waypointIndex = 0;
        this.pos = { ...waypoints[0] };
        this.x = this.pos.col * GRID_SIZE + GRID_SIZE / 2;
        this.y = this.pos.row * GRID_SIZE + GRID_SIZE / 2;
        this.speed = 1.2 + wave * 0.15;
        this.maxHp = 30 + wave * 15;
        this.hp = this.maxHp;
        this.size = GRID_SIZE * 0.3;
        this.slowAmount = 1;
        this.slowTimer = 0;
        this.reward = 10 + wave * 2;
        this.alive = true;
    }

    update() {
        if (!this.alive) return;
        
        if (this.slowTimer > 0) {
            this.slowTimer--;
            if (this.slowTimer <= 0) this.slowAmount = 1;
        }

        const currentSpeed = this.speed * this.slowAmount;
        
        if (this.waypointIndex < waypoints.length - 1) {
            const target = waypoints[this.waypointIndex + 1];
            const tx = target.col * GRID_SIZE + GRID_SIZE / 2;
            const ty = target.row * GRID_SIZE + GRID_SIZE / 2;
            
            const dx = tx - this.x;
            const dy = ty - this.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            if (dist < currentSpeed) {
                this.waypointIndex++;
                this.x = tx;
                this.y = ty;
            } else {
                this.x += (dx / dist) * currentSpeed;
                this.y += (dy / dist) * currentSpeed;
            }
        }
    }

    takeDamage(amount) {
        if (!this.alive) return false;
        this.hp -= amount;
        
        // Spawn hit particles
        for (let i = 0; i < 5; i++) {
            state.particles.push(new Particle(
                this.x, this.y,
                (Math.random() - 0.5) * 3,
                (Math.random() - 0.5) * 3,
                '#ff6b6b', 15
            ));
        }
        
        if (this.hp <= 0) {
            this.alive = false;
            state.gold += this.reward;
            state.kills++;
            updateUI();
            return true;
        }
        return false;
    }

    applySlow(amount, duration) {
        this.slowAmount = amount;
        this.slowTimer = duration;
    }

    draw(ctx) {
        if (!this.alive) return;
        
        const hpPercent = this.hp / this.maxHp;
        
        // Enemy body
        ctx.fillStyle = this.slowAmount < 1 ? '#67e8f9' : '#ef4444';
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        
        // Eyes
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(this.x - 5, this.y - 5, 4, 0, Math.PI * 2);
        ctx.arc(this.x + 5, this.y - 5, 4, 0, Math.PI * 2);
        ctx.fill();
        
        // HP bar
        const barWidth = GRID_SIZE * 0.5;
        const barHeight = 4;
        ctx.fillStyle = '#333';
        ctx.fillRect(this.x - barWidth/2, this.y - this.size - 12, barWidth, barHeight);
        ctx.fillStyle = hpPercent > 0.5 ? '#4ade80' : hpPercent > 0.25 ? '#fbbf24' : '#ef4444';
        ctx.fillRect(this.x - barWidth/2, this.y - this.size - 12, barWidth * hpPercent, barHeight);
    }

    reachedEnd() {
        return this.waypointIndex >= waypoints.length - 1;
    }
}

class Projectile {
    constructor(x, y, target, damage, speed, color, type) {
        this.x = x;
        this.y = y;
        this.target = target;
        this.damage = damage;
        this.speed = speed;
        this.color = color;
        this.type = type;
        this.active = true;
    }

    update() {
        if (!this.active) return;
        if (!this.target || !this.target.alive) {
            this.active = false;
            return;
        }

        const dx = this.target.x - this.x;
        const dy = this.target.y - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < this.speed) {
            this.hit();
        } else {
            this.x += (dx / dist) * this.speed;
            this.y += (dy / dist) * this.speed;
        }
    }

    hit() {
        if (!this.active) return;
        this.active = false;
        
        if (!this.target || !this.target.alive) return;
        
        const killed = this.target.takeDamage(this.damage);

        const def = towerDefs[this.type];
        
        // Slow effect
        if (def.slow && this.target.alive) {
            this.target.applySlow(def.slow, def.slowDuration);
        }
        
        // Splash damage
        if (def.splash > 0) {
            for (const enemy of state.enemies) {
                if (!enemy.alive || enemy === this.target) continue;
                const dx = enemy.x - this.target.x;
                const dy = enemy.y - this.target.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist <= def.splash) {
                    enemy.takeDamage(this.damage * 0.5);
                }
            }
            // Splash particles
            for (let i = 0; i < 10; i++) {
                state.particles.push(new Particle(
                    this.target.x, this.target.y,
                    (Math.random() - 0.5) * 5,
                    (Math.random() - 0.5) * 5,
                    '#f97316', 20
                ));
            }
        }
        
        // Chain lightning
        if (def.chain) {
            let lastTarget = this.target;
            for (let c = 0; c < def.chain; c++) {
                let closestEnemy = null;
                let closestDist = 100;
                for (const enemy of state.enemies) {
                    if (!enemy.alive || enemy === lastTarget) continue;
                    const dx = enemy.x - lastTarget.x;
                    const dy = enemy.y - lastTarget.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < closestDist) {
                        closestDist = dist;
                        closestEnemy = enemy;
                    }
                }
                if (closestEnemy) {
                    closestEnemy.takeDamage(this.damage * 0.6);
                    lastTarget = closestEnemy;
                } else break;
            }
        }
    }

    draw(ctx) {
        if (!this.active) return;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, 4, 0, Math.PI * 2);
        ctx.fill();
    }
}

class Particle {
    constructor(x, y, vx, vy, color, life) {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.color = color;
        this.life = life;
        this.maxLife = life;
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.life--;
        return this.life <= 0;
    }

    draw(ctx) {
        const alpha = this.life / this.maxLife;
        ctx.fillStyle = this.color;
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.arc(this.x, this.y, 3 * alpha, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
    }
}

// ============================================
// WAVE SYSTEM (FIXED)
// ============================================
function startWave() {
    // 🔥 FIX: Only block if wave is currently active (enemies still spawning or alive)
    if (state.waveActive) {
        console.log('Wave already in progress!');
        return false;
    }
    
    if (state.gameOver) return false;
    
    state.waveActive = true;
    const numEnemies = 5 + state.wave * 3;
    state.enemiesToSpawn = numEnemies;
    state.enemiesSpawned = 0;
    state.spawnTimer = 0;
    
    console.log(`🌊 Starting Wave ${state.wave} with ${numEnemies} enemies!`);
    document.getElementById('start-wave-btn').textContent = `WAVE ${state.wave}...`;
    document.getElementById('start-wave-btn').style.opacity = '0.6';
    
    return true;
}

function updateWaveSpawning() {
    if (!state.waveActive) return;
    
    // Still enemies to spawn
    if (state.enemiesSpawned < state.enemiesToSpawn) {
        state.spawnTimer++;
        
        if (state.spawnTimer >= state.spawnDelay) {
            state.spawnTimer = 0;
            state.enemies.push(new Enemy(state.wave));
            state.enemiesSpawned++;
            console.log(`Spawned enemy ${state.enemiesSpawned}/${state.enemiesToSpawn}`);
        }
    }
    
    // Check if wave is fully complete
    if (state.enemiesSpawned >= state.enemiesToSpawn && 
        state.enemies.length === 0) {
        completeWave();
    }
}

function completeWave() {
    state.waveActive = false;
    state.wave++;
    const bonus = 50 + state.wave * 25;
    state.gold += bonus;
    
    console.log(`✅ Wave ${state.wave - 1} complete! Bonus: ${bonus} gold`);
    
    document.getElementById('start-wave-btn').textContent = 'SEND WAVE';
    document.getElementById('start-wave-btn').style.opacity = '1';
    updateUI();
}

// ============================================
// GAME FUNCTIONS
// ============================================

function placeTower(col, row) {
    const idx = row * COLS + col;
    if (mapData[idx] !== 1) {
        console.log("Can't build on path!");
        return false;
    }
    
    // Check if tower already exists there
    const exists = state.towers.some(t => t.col === col && t.row === row);
    if (exists) {
        console.log("Tower already here!");
        return false;
    }
    
    const def = towerDefs[state.selectedTower];
    if (state.gold < def.cost) {
        console.log(`Not enough gold! Need ${def.cost}, have ${state.gold}`);
        return false;
    }
    
    state.gold -= def.cost;
    state.towers.push(new Tower(col, row, state.selectedTower));
    console.log(`Built ${def.name} at (${col}, ${row})`);
    updateUI();
    return true;
}

function upgradeTower(tower) {
    const cost = Math.floor(towerDefs[tower.type].cost * tower.level * 1.5);
    if (state.gold >= cost && tower.level < 5) {
        state.gold -= cost;
        tower.level++;
        console.log(`Upgraded tower to level ${tower.level}! Cost: ${cost}`);
        updateUI();
    } else if (tower.level >= 5) {
        console.log("Tower is max level!");
    } else {
        console.log(`Not enough gold! Need ${cost}, have ${state.gold}`);
    }
}

// ============================================
// INPUT HANDLING
// ============================================
state.selectedTowerForUpgrade = null;

function getCanvasCoords(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    let clientX, clientY;
    if (e.touches && e.touches.length > 0) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
    } else if (e.changedTouches && e.changedTouches.length > 0) {
        clientX = e.changedTouches[0].clientX;
        clientY = e.changedTouches[0].clientY;
    } else {
        clientX = e.clientX;
        clientY = e.clientY;
    }
    
    return {
        x: (clientX - rect.left) * scaleX,
        y: (clientY - rect.top) * scaleY,
    };
}

function handleCanvasClick(e) {
    if (state.gameOver) return;
    
    const { x, y } = getCanvasCoords(e);
    const col = Math.floor(x / GRID_SIZE);
    const row = Math.floor(y / GRID_SIZE);
    
    // Check if clicking on existing tower to upgrade
    const clickedTower = state.towers.find(t => t.col === col && t.row === row);
    if (clickedTower) {
        upgradeTower(clickedTower);
        state.selectedTowerForUpgrade = clickedTower;
        setTimeout(() => { state.selectedTowerForUpgrade = null; }, 1000);
        return;
    }
    
    // Otherwise try to place new tower
    placeTower(col, row);
    state.selectedTowerForUpgrade = null;
}

canvas.addEventListener('click', handleCanvasClick);
canvas.addEventListener('touchend', (e) => {
    e.preventDefault();
    handleCanvasClick(e);
});

// Tower selection buttons
document.querySelectorAll('.tower-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.tower-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        state.selectedTower = btn.dataset.tower;
        console.log(`Selected: ${towerDefs[state.selectedTower].name}`);
    });
    
    btn.addEventListener('touchstart', (e) => {
        e.stopPropagation();
    });
});

// Wave button
const waveBtn = document.getElementById('start-wave-btn');
waveBtn.addEventListener('click', startWave);
waveBtn.addEventListener('touchstart', (e) => {
    e.stopPropagation();
    startWave();
});

// ============================================
// UI UPDATE
// ============================================
function updateUI() {
    document.getElementById('lives').textContent = state.lives;
    document.getElementById('gold').textContent = state.gold;
    document.getElementById('wave').textContent = state.wave;
    document.getElementById('kills').textContent = state.kills;
}

// ============================================
// GAME LOOP
// ============================================
function update() {
    if (state.gameOver) return;
    
    // Handle wave spawning
    updateWaveSpawning();
    
    // Update towers
    for (const tower of state.towers) {
        tower.update(state.enemies);
    }
    
    // Update projectiles
    for (const proj of state.projectiles) {
        proj.update();
    }
    state.projectiles = state.projectiles.filter(p => p.active);
    
    // Update enemies
    for (const enemy of state.enemies) {
        enemy.update();
        
        if (enemy.reachedEnd()) {
            state.lives--;
            enemy.alive = false;
            console.log(`Enemy reached end! Lives: ${state.lives}`);
            updateUI();
            
            if (state.lives <= 0) {
                state.gameOver = true;
                console.log("💀 GAME OVER!");
            }
        }
    }
    
    // Remove dead enemies
    state.enemies = state.enemies.filter(e => e.alive);
    
    // Update particles
    state.particles = state.particles.filter(p => !p.update());
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw grid
    for (let row = 0; row < ROWS; row++) {
        for (let col = 0; col < COLS; col++) {
            const idx = row * COLS + col;
            const x = col * GRID_SIZE;
            const y = row * GRID_SIZE;
            
            switch (mapData[idx]) {
                case 0:
                    ctx.fillStyle = '#d4a574'; // Path
                    break;
                case 1:
                    ctx.fillStyle = '#2d5a27'; // Grass
                    break;
                case 2:
                    ctx.fillStyle = '#4ade80'; // Start
                    break;
                case 3:
                    ctx.fillStyle = '#ef4444'; // End
                    break;
            }
            
            ctx.fillRect(x, y, GRID_SIZE, GRID_SIZE);
            ctx.strokeStyle = 'rgba(0,0,0,0.15)';
            ctx.strokeRect(x, y, GRID_SIZE, GRID_SIZE);
        }
    }
    
    // Draw particles
    for (const particle of state.particles) {
        particle.draw(ctx);
    }
    
    // Draw towers
    for (const tower of state.towers) {
        tower.draw(ctx);
    }
    
    // Draw enemies
    for (const enemy of state.enemies) {
        enemy.draw(ctx);
    }
    
    // Draw projectiles
    for (const proj of state.projectiles) {
        proj.draw(ctx);
    }
    
    // Wave progress indicator
    if (state.waveActive && state.enemiesToSpawn > 0) {
        const progress = state.enemiesSpawned / state.enemiesToSpawn;
        ctx.fillStyle = 'rgba(255,255,255,0.1)';
        ctx.fillRect(10, canvas.height - 30, canvas.width - 20, 20);
        ctx.fillStyle = '#e94560';
        ctx.fillRect(10, canvas.height - 30, (canvas.width - 20) * progress, 20);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(
            `Wave ${state.wave}: ${state.enemiesSpawned}/${state.enemiesToSpawn} spawned | ${state.enemies.length} alive`,
            canvas.width / 2, canvas.height - 15
        );
    }
    
    // Game over screen
    if (state.gameOver) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        ctx.fillStyle = '#e94560';
        ctx.font = 'bold 48px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('GAME OVER', canvas.width / 2, canvas.height / 2 - 30);
        
        ctx.fillStyle = '#fff';
        ctx.font = '24px Arial';
        ctx.fillText(`Survived ${state.wave - 1} waves`, canvas.width / 2, canvas.height / 2 + 20);
        ctx.fillText(`Killed ${state.kills} enemies`, canvas.width / 2, canvas.height / 2 + 55);
        ctx.fillText('🔄 Refresh to play again', canvas.width / 2, canvas.height / 2 + 95);
    }
}

function gameLoop() {
    update();
    draw();
    requestAnimationFrame(gameLoop);
}

// ============================================
// START GAME
// ============================================
updateUI();
gameLoop();

console.log('🏰 Tower Defense - FIXED VERSION');
console.log('📱 Works on desktop & mobile');
console.log('🎯 Click/tap green grass to place towers');
console.log('💡 Click existing towers to upgrade them');
console.log('🌊 Press SEND WAVE to start each wave');
console.log('🔄 Waves can be sent repeatedly now!');
