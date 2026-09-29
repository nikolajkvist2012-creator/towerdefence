// Hovedfil: spiltilstand, game loop og musestyring.
import { CONFIG } from './config.js';
import { GameMap, pixelToCell, key } from './map.js';
import { Enemy } from './enemies.js';
import { Tower, canMerge, computeStats } from './towers.js';
import { buildWave, hpMultiplierFor } from './waves.js';
import { Effects } from './effects.js';
import { UI } from './ui.js';
import { sound } from './audio.js';

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
canvas.width = CONFIG.cols * CONFIG.tileSize;
canvas.height = CONFIG.rows * CONFIG.tileSize;

let map = new GameMap('grass'); // den bane, der spilles (vises også bag menuerne)
let state;                  // al spiltilstand, nulstilles ved "Prøv igen"
let pendingMode = 'normal'; // valgt tilstand, mens man vælger bane
let hoverCell = null;       // feltet musen står over
let selectedType = 'basic'; // tårntypen, der bygges ved klik
let selectedTower = null;   // tårnet, hvis panel er åbent (til salg)

function newState(mode, mapId) {
  const rules = CONFIG.maps[mapId];
  return {
    mode,                                            // 'normal' eller 'test'
    mapId,                                           // fx 'lava'
    infiniteMoney: CONFIG.modes[mode].infiniteMoney, // TEST: alt er gratis
    enemySpeedMultiplier: rules.enemySpeedMultiplier ?? 1,
    towerRangeMultiplier: rules.towerRangeMultiplier ?? 1,
    lives: CONFIG.startLives,
    money: rules.startMoney ?? CONFIG.startMoney,
    spawnCount: 0,       // tæller fjender, så de skiftes mellem stierne
    wave: 0,
    waveActive: false,
    gameOver: false,
    won: false,          // sat, når sidste bølge er klaret
    enemies: [],
    towers: [],
    projectiles: [],
    effects: new Effects(),
    occupied: new Map(), // "c,r" → tårn på feltet
    spawnQueue: [],      // fjender der mangler at blive sendt ind i denne bølge
    spawnTimer: 0,
  };
}

const ui = new UI({
  onStartWave: startWave,
  onRetry: () => {
    startGame(state.mode, state.mapId); // samme tilstand og bane igen
    ui.hideGameOver();
  },
  // Startmenu: først tilstand, derefter bane
  onSelectMode: (mode) => {
    pendingMode = mode;
    ui.showMapMenu();
  },
  onSelectMap: (mapId) => {
    startGame(pendingMode, mapId);
    ui.hideMapMenu();
  },
  onMapBack: () => ui.showStartMenu(),
  onMenu: () => {
    state = null; // spillet står stille, indtil man vælger en tilstand
    closePanel();
    ui.showStartMenu();
    sound.playMusic('menu');
  },
  onToggleMusic: () => ui.setAudioButtons(sound.toggleMusic(), sound.sfxOn),
  onToggleSfx: () => ui.setAudioButtons(sound.musicOn, sound.toggleSfx()),
  onSpawnEnemy: (type) => {
    // Kun i TEST, og kun mens spillet kører
    // Samme liv som fjenderne i den bølge, man er nået til (fx dobbelt fra bølge 7)
    if (state && state.mode === 'test' && !state.gameOver && !state.won) {
      spawnEnemy(type, hpMultiplierFor(type, state.wave));
    }
  },
  onSell: () => sellTower(selectedTower),
  onClosePanel: () => closePanel(),
  onSelectTower: (type) => {
    selectedType = type;
    ui.setSelectedTower(type);
  },
});
ui.setSelectedTower(selectedType);
ui.setAudioButtons(sound.musicOn, sound.sfxOn);
sound.playMusic('menu'); // starter, så snart man klikker første gang

function startGame(mode, mapId) {
  map = new GameMap(mapId);
  state = newState(mode, mapId);
  closePanel();
  sound.playMusic(mapId); // hver bane har sin egen melodi
}

// Tårne får banens rækkevidde-regel (fx sandstorm)
function makeTower(type, c, r, opts = {}) {
  return new Tower(type, c, r, { ...opts, rangeMultiplier: state.towerRangeMultiplier });
}

// Send én fjende ind på banen. Med flere stier skiftes fjenderne til at tage hver sin.
function spawnEnemy(type, hpMultiplier = 1) {
  const path = map.paths[state.spawnCount % map.paths.length];
  state.spawnCount++;
  state.enemies.push(new Enemy(type, path, hpMultiplier, state.enemySpeedMultiplier));
}

function startWave() {
  if (!state || state.waveActive || state.gameOver || state.won) return;
  state.wave++;
  state.spawnQueue = buildWave(state.wave);
  state.spawnTimer = 0;
  state.waveActive = true;
}

// ---------- Opdatering ----------

function update(dt) {
  state.effects.update(dt);
  if (state.gameOver || state.won) return;

  // Send fjender ind én ad gangen
  if (state.spawnQueue.length > 0) {
    state.spawnTimer -= dt;
    if (state.spawnTimer <= 0) {
      const next = state.spawnQueue.shift();
      spawnEnemy(next.type, next.hpMultiplier);
      state.spawnTimer = next.delay;
    }
  }

  for (const e of state.enemies) e.update(dt, state.effects);
  for (const t of state.towers) t.update(dt, state.enemies, state.projectiles, state.effects);
  for (const p of state.projectiles) p.update(dt, state.enemies, state.effects);

  // Håndter døde fjender: belønning eller mistet liv
  let reason = '';
  const transformed = []; // fx Metal, der er blevet til Kerne
  for (const e of state.enemies) {
    if (e.alive) continue;
    if (e.reachedEnd) {
      state.lives--;
      sound.sfx('lifeLost');
      if (e.loseOnEscape) {           // fx Metal-bossen: så har man tabt
        state.lives = 0;
        reason = `${CONFIG.enemies[e.type].name} slap igennem! `;
      }
    } else {
      state.money += e.reward;
      if (e.transformsInto) {         // skallen knuses, og den næste fjende fortsætter
        sound.sfx('shatter');
        sound.sfx('coreAppear');
        transformed.push(e.transform());
        state.effects.addBurst(e.x, e.y, '#aab3bf', 16);
        const tx = Math.min(Math.max(e.x, 40), canvas.width - 40); // hold teksten inde på banen
        state.effects.addText(tx, Math.max(e.y - e.radius - 14, 20), `${CONFIG.enemies[e.transformsInto].name}!`, '#8fd3ff', 18, 1.2);
      } else {
        sound.sfx('enemyDie');
      }
    }
  }
  state.enemies = state.enemies.filter((e) => e.alive).concat(transformed);
  state.projectiles = state.projectiles.filter((p) => p.alive);

  // Hurtigere, mere intens musik, så længe en boss er på banen
  sound.setIntense(state.enemies.some((e) => e.boss));

  if (state.lives <= 0) {
    state.lives = 0;
    state.gameOver = true;
    state.waveActive = false;
    closePanel();
    ui.showGameOver(state.wave, reason);
    sound.playMusic('menu');
    return;
  }

  // Bølgen er slut, når alle er sendt ind og ingen er tilbage på banen
  if (state.waveActive && state.spawnQueue.length === 0 && state.enemies.length === 0) {
    state.waveActive = false;
    payFarmIncome();
    // Sidste bølge klaret → sejr
    if (state.wave >= CONFIG.waves.totalWaves) {
      state.won = true;
      closePanel();
      ui.showVictory(state);
      sound.playMusic('menu');
    }
  }
}

// Hver Farm udbetaler penge, når en bølge er klaret, og viser "+30" over sig
function payFarmIncome() {
  for (const t of state.towers) {
    if (!t.def.income) continue;
    state.money += t.def.income;
    state.effects.addText(t.x, t.y - CONFIG.tileSize * t.size * 0.5, `+${t.def.income}`, '#ffd257', 22, 1.4);
    sound.sfx('coin'); // spilles kun én gang, selv med mange Farme
  }
}

// ---------- Tegning ----------

function draw(time) {
  map.draw(ctx, time);
  for (const t of state.towers) t.draw(ctx);
  for (const e of state.enemies) e.draw(ctx);
  for (const p of state.projectiles) p.draw(ctx);
  state.effects.draw(ctx);
  map.drawOverlay(ctx, time); // fx sandstorm
  drawSelected();
  drawHover(); // til sidst, så omrids og skilte ligger ovenpå
}

// Musen over en 2×2-firkant der kan samles: vis det store tårns omrids og rækkevidde.
// Musen over et tårn: vis dets rækkevidde (og navn, hvis det er stort).
// Musen over et tomt felt: vis om man kan bygge, og det valgte tårns rækkevidde.
function drawHover() {
  if (!hoverCell || state.gameOver || state.won || !map.inBounds(hoverCell.c, hoverCell.r)) return;
  const { c, r } = hoverCell;
  const s = CONFIG.tileSize;

  const tower = state.occupied.get(key(c, r));
  if (tower) {
    const block = findMergeBlock(c, r);
    if (block) {
      // Forhåndsvisning af det store tårn
      const cx = (block.c + 1) * s;
      const cy = (block.r + 1) * s;
      const ok = canAfford(selectedType);
      ctx.strokeStyle = ok ? CONFIG.towers[selectedType].color : 'rgba(220, 40, 40, 0.9)';
      ctx.lineWidth = 3;
      ctx.setLineDash([6, 4]);
      ctx.strokeRect(block.c * s + 1.5, block.r * s + 1.5, s * 2 - 3, s * 2 - 3);
      ctx.setLineDash([]);
      const { type, modifier } = block.result;
      const preview = computeStats(CONFIG.towers[type], modifier, state.towerRangeMultiplier);
      drawRange(cx, cy, preview.range);
      const cost = CONFIG.towers[selectedType].cost;
      const text = modifier
        ? `${CONFIG.towers[type].name} + ${CONFIG.towers[modifier].name}: ${CONFIG.mergeEffects[modifier].description} (${cost})`
        : `${CONFIG.towers[type].name}: ${CONFIG.towers[type].description} (${cost})`;
      drawLabel(cx, block.r * s - 6, text);
      return;
    }
    drawRange(tower.x, tower.y, tower.range);
    if (tower.size > 1) drawLabel(tower.x, tower.y - (tower.size * s) / 2 - 6, tower.displayName);
    return;
  }

  const ok = canBuild(c, r);
  ctx.fillStyle = ok ? map.ui.hoverOk : 'rgba(220, 40, 40, 0.35)';
  ctx.fillRect(c * s, r * s, s, s);
  if (map.canBuildOn(c, r)) {
    drawRange(c * s + s / 2, r * s + s / 2, CONFIG.towers[selectedType].range * state.towerRangeMultiplier);
  }
}

// Det valgte tårn (med åbent panel) får en hvid ramme og vist sin rækkevidde
function drawSelected() {
  const t = selectedTower;
  if (!t) return;
  const s = CONFIG.tileSize * t.size;
  drawRange(t.x, t.y, t.range);
  ctx.strokeStyle = map.theme.dark ? '#1c2027' : '#ffffff';
  ctx.lineWidth = 2;
  ctx.strokeRect(t.x - s / 2 + 1, t.y - s / 2 + 1, s - 2, s - 2);
}

function drawRange(x, y, range) {
  if (!range) return; // tårne uden rækkevidde (Farm)
  ctx.beginPath();
  ctx.arc(x, y, range, 0, Math.PI * 2);
  ctx.fillStyle = map.ui.rangeFill;
  ctx.fill();
  ctx.strokeStyle = map.ui.rangeStroke;
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

// Lille tekstskilt over banen (holdes inden for canvas)
function drawLabel(x, y, text) {
  ctx.font = 'bold 13px system-ui, sans-serif';
  const w = ctx.measureText(text).width + 12;
  const left = Math.min(Math.max(2, x - w / 2), canvas.width - w - 2);
  const top = Math.max(2, y - 20);
  ctx.fillStyle = 'rgba(17, 20, 26, 0.9)';
  ctx.fillRect(left, top, w, 20);
  ctx.fillStyle = '#e9edf3';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, left + 6, top + 10);
  ctx.textBaseline = 'alphabetic';
}

// ---------- Byg og saml tårne ----------

function canAfford(type) {
  return state.infiniteMoney || state.money >= CONFIG.towers[type].cost;
}

function canBuild(c, r) {
  return map.canBuildOn(c, r) // ikke sti, lava, vand eller kaktus
    && !state.occupied.has(key(c, r))
    && canAfford(selectedType);
}

// Hvad bliver 4 tårne af typen blockType + det valgte tårn til?
// Returnerer { type, modifier } for det store tårn, eller null hvis de ikke kan samles.
function mergeResult(blockType) {
  // Særlige opskrifter først (fx 4 Farm + Farm = Factory)
  const recipe = CONFIG.mergeRecipes[blockType]?.[selectedType];
  if (recipe) return { type: recipe, modifier: null };
  // Ellers: stort tårn af grundtypen med det valgte tårns effekt.
  // Effekten skal komme fra en ANDEN type – ellers ville et klik på fx 4 Basis
  // med Basis valgt samle dem ved et uheld, når man bare vil åbne salgspanelet
  if (canMerge(blockType) && canMerge(selectedType) && blockType !== selectedType) {
    return { type: blockType, modifier: selectedType };
  }
  return null;
}

// Find en 2×2-firkant af 4 ens, små tårne, som feltet (c, r) er en del af,
// og som kan samles med det valgte tårn.
// Returnerer { c, r, type, result } (c, r = øverste venstre felt).
function findMergeBlock(c, r) {
  const clicked = state.occupied.get(key(c, r));
  if (!clicked || clicked.size !== 1) return null;
  const result = mergeResult(clicked.type);
  if (!result) return null;

  // Prøv de 4 firkanter, feltet kan ligge i
  for (const [dc, dr] of [[0, 0], [-1, 0], [0, -1], [-1, -1]]) {
    const c0 = c + dc;
    const r0 = r + dr;
    let ok = true;
    for (const [x, y] of [[c0, r0], [c0 + 1, r0], [c0, r0 + 1], [c0 + 1, r0 + 1]]) {
      const t = state.occupied.get(key(x, y));
      if (!t || t.size !== 1 || t.type !== clicked.type) { ok = false; break; }
    }
    if (ok) return { c: c0, r: r0, type: clicked.type, result };
  }
  return null;
}

// Erstat de 4 små tårne med ét stort tårn (med effekt, eller en opskrift som Factory)
function mergeTowers(block) {
  if (!canAfford(selectedType)) {
    sound.sfx('denied'); // ikke råd
    return;
  }
  sound.sfx('merge');
  const cells = [[block.c, block.r], [block.c + 1, block.r], [block.c, block.r + 1], [block.c + 1, block.r + 1]];
  const old = new Set(cells.map(([x, y]) => state.occupied.get(key(x, y))));
  // Det store tårn "husker" alt, der er betalt for de 4 tårne + effekten
  let totalCost = CONFIG.towers[selectedType].cost;
  for (const t of old) totalCost += t.totalCost;
  const { type, modifier } = block.result;
  const big = makeTower(type, block.c, block.r, { size: 2, modifier, totalCost });
  state.towers = state.towers.filter((t) => !old.has(t));
  state.towers.push(big);
  for (const [x, y] of cells) state.occupied.set(key(x, y), big);
  if (!state.infiniteMoney) state.money -= CONFIG.towers[selectedType].cost;
  state.effects.addText(big.x, big.y - CONFIG.tileSize, big.displayName, '#ffffff', 16, 1.4);
}

// ---------- Salg ----------

function openPanel(tower) {
  selectedTower = tower;
  ui.showTowerPanel(tower, canvas);
}

function closePanel() {
  selectedTower = null;
  ui.hideTowerPanel();
}

// Fjern tårnet og giv en del af pengene tilbage
function sellTower(tower) {
  if (!tower || !state) return;
  const value = tower.sellValue;
  state.towers = state.towers.filter((t) => t !== tower);
  for (const [x, y] of tower.cells) state.occupied.delete(key(x, y));
  state.money += value;
  sound.sfx('sell');
  state.effects.addText(tower.x, tower.y - CONFIG.tileSize * tower.size * 0.5, `+${value}`, '#ffd257', 20, 1.2);
  closePanel();
}

// ---------- Mus ----------

// Omregn museposition til canvas-pixels (canvas kan være skaleret med CSS)
function mouseCell(ev) {
  const rect = canvas.getBoundingClientRect();
  const x = (ev.clientX - rect.left) * (canvas.width / rect.width);
  const y = (ev.clientY - rect.top) * (canvas.height / rect.height);
  return pixelToCell(x, y);
}

canvas.addEventListener('mousemove', (ev) => { hoverCell = mouseCell(ev); });
canvas.addEventListener('mouseleave', () => { hoverCell = null; });
canvas.addEventListener('click', (ev) => {
  if (!state || state.gameOver || state.won) return;
  const { c, r } = mouseCell(ev);
  // Klik på en 2×2-firkant af ens tårne → saml dem til ét stort tårn
  const block = findMergeBlock(c, r);
  if (block) {
    closePanel();
    mergeTowers(block);
    return;
  }
  // Klik på et tårn → åbn salgspanelet (klik igen for at lukke)
  const existing = state.occupied.get(key(c, r));
  if (existing) {
    if (existing === selectedTower) closePanel();
    else openPanel(existing);
    return;
  }
  closePanel(); // klik et andet sted lukker panelet
  if (!canBuild(c, r)) {
    // Ledigt felt, men ikke råd → "bonk". (Klik på sti/lava o.l. er bare stille.)
    if (map.canBuildOn(c, r) && !state.occupied.has(key(c, r))) sound.sfx('denied');
    return;
  }
  sound.sfx('build');
  const tower = makeTower(selectedType, c, r);
  state.towers.push(tower);
  state.occupied.set(key(c, r), tower);
  if (!state.infiniteMoney) state.money -= tower.def.cost;
});

// Højreklik på et tårn åbner altid salgspanelet (også når et venstreklik ville samle tårne)
canvas.addEventListener('contextmenu', (ev) => {
  ev.preventDefault();
  if (!state || state.gameOver || state.won) return;
  const { c, r } = mouseCell(ev);
  const tower = state.occupied.get(key(c, r));
  if (tower) openPanel(tower);
  else closePanel();
});

// Esc lukker panelet
window.addEventListener('keydown', (ev) => {
  if (ev.key === 'Escape') closePanel();
});

// ---------- Game loop ----------

let lastTime = performance.now();
function loop(now) {
  const dt = Math.min((now - lastTime) / 1000, CONFIG.maxDeltaTime);
  lastTime = now;
  const time = now / 1000; // til animation af lava, vand og sandstorm
  if (state) {
    update(dt);
    draw(time);
    ui.update(state);
  } else {
    map.draw(ctx, time); // kun banen bag menuerne
    map.drawOverlay(ctx, time);
  }
  requestAnimationFrame(loop);
}

// Spillet starter i startmenuen; state oprettes, når man vælger tilstand
state = null;
requestAnimationFrame(loop);
