// UI: HUD, tårnmenu med tooltip og game over-skærm (HTML-elementer omkring canvas).
import { CONFIG } from './config.js';
import { drawTowerShape, towerDescription } from './towers.js';
import { GameMap } from './map.js';

const el = (id) => document.getElementById(id);

export class UI {
  constructor({
    onStartWave, onRetry, onSelectTower, onSelectMode, onSelectMap, onMapBack, onMenu, onSell, onClosePanel,
    onSpawnEnemy, onToggleMusic, onToggleSfx,
  }) {
    this.lives = el('lives');
    this.money = el('money');
    this.wave = el('wave');
    this.startBtn = el('startWave');
    this.modeBadge = el('modeBadge');
    this.startMenu = el('startMenu');
    this.mapMenu = el('mapMenu');
    this.mapName = el('mapName');
    this.gameOver = el('gameOver');
    this.gameOverText = el('gameOverText');
    this.tooltip = el('tooltip');
    this.mode = 'normal'; // den tilstand, der spilles – bruges til tooltips

    this.startBtn.addEventListener('click', onStartWave);
    el('retry').addEventListener('click', onRetry);
    el('playAgain').addEventListener('click', onRetry);
    el('victoryMenu').addEventListener('click', onMenu);
    this.victory = el('victory');
    el('toMenu').addEventListener('click', onMenu);
    el('menuBtn').addEventListener('click', onMenu);

    this.panel = el('towerPanel');
    el('tpSell').addEventListener('click', onSell);
    el('tpClose').addEventListener('click', onClosePanel);
    el('mapBack').addEventListener('click', onMapBack);
    el('musicBtn').addEventListener('click', onToggleMusic);
    el('sfxBtn').addEventListener('click', onToggleSfx);

    this.buildModeButtons(onSelectMode);
    this.buildMapCards(onSelectMap);
    this.buildSpawnBar(onSpawnEnemy);
    this.buildTowerMenu(onSelectTower);
  }

  // Vis om musik og lydeffekter er slået til eller fra
  setAudioButtons(musicOn, sfxOn) {
    const m = el('musicBtn');
    const s = el('sfxBtn');
    m.classList.toggle('off', !musicOn);
    s.classList.toggle('off', !sfxOn);
    m.title = musicOn ? 'Musik: til (klik for at slå fra)' : 'Musik: fra (klik for at slå til)';
    s.title = sfxOn ? 'Lydeffekter: til (klik for at slå fra)' : 'Lydeffekter: fra (klik for at slå til)';
    m.setAttribute('aria-pressed', String(musicOn));
    s.setAttribute('aria-pressed', String(sfxOn));
  }

  // Vis panelet for et valgt tårn over (eller under) tårnet.
  // canvas bruges til at omregne tårnets position til skærm-pixels.
  showTowerPanel(tower, canvas) {
    el('tpName').textContent = tower.displayName;
    el('tpInfo').textContent = describeTower(tower);
    el('tpSellValue').textContent = tower.sellValue;
    const p = this.panel;
    p.classList.remove('hidden');

    const k = canvas.getBoundingClientRect().width / canvas.width; // CSS-skalering
    const half = (tower.size * CONFIG.tileSize) / 2;
    const w = p.offsetWidth;
    const h = p.offsetHeight;
    const boardW = canvas.width * k;
    let left = tower.x * k - w / 2;
    left = Math.min(Math.max(4, left), boardW - w - 4);
    let top = (tower.y - half) * k - h - 8;          // over tårnet …
    if (top < 4) top = (tower.y + half) * k + 8;     // … eller under, hvis der ikke er plads
    p.style.left = `${left}px`;
    p.style.top = `${top}px`;
  }

  hideTowerPanel() {
    this.panel.classList.add('hidden');
  }

  // Én knap pr. spiltilstand i config.js
  buildModeButtons(onSelectMode) {
    const box = el('modeButtons');
    for (const [mode, def] of Object.entries(CONFIG.modes)) {
      const btn = document.createElement('button');
      btn.className = `mode-btn ${mode}`;
      const name = document.createElement('strong');
      name.textContent = def.name;
      const desc = document.createElement('span');
      desc.textContent = def.description;
      btn.append(name, desc);
      btn.addEventListener('click', () => onSelectMode(mode));
      box.append(btn);
    }
  }

  // Ét kort pr. bane i config.js, med et lille billede af banen
  buildMapCards(onSelectMap) {
    const box = el('mapCards');
    this.mapMoney = {}; // bane-id → "Startpenge"-teksten, som afhænger af tilstanden
    for (const [id, def] of Object.entries(CONFIG.maps)) {
      const card = document.createElement('button');
      card.className = 'map-card';

      const preview = document.createElement('canvas');
      preview.width = CONFIG.cols * CONFIG.tileSize;
      preview.height = CONFIG.rows * CONFIG.tileSize;
      const map = new GameMap(id);
      const pctx = preview.getContext('2d');
      map.draw(pctx, 0);
      map.drawOverlay(pctx, 0);

      const name = document.createElement('strong');
      name.textContent = def.name;
      const desc = document.createElement('span');
      desc.className = 'map-desc';
      desc.textContent = def.description;
      const money = document.createElement('span');
      money.className = 'map-money';
      this.mapMoney[id] = money;

      card.append(preview, name, desc, money);
      card.addEventListener('click', () => onSelectMap(id));
      box.append(card);
    }
  }

  // TEST: én knap pr. fjendetype i config.js, der sender én fjende ind med det samme
  buildSpawnBar(onSpawnEnemy) {
    this.spawnBar = el('spawnBar');
    for (const [type, def] of Object.entries(CONFIG.enemies)) {
      const btn = document.createElement('button');
      btn.className = 'spawn-btn';
      btn.style.setProperty('--enemy-color', def.color);
      const dot = document.createElement('span');
      dot.className = 'spawn-dot';
      const name = document.createElement('span');
      name.textContent = def.name;
      btn.append(dot, name);
      btn.title = `${def.name}: ${def.hp} liv`;
      btn.addEventListener('click', () => onSpawnEnemy(type));
      this.spawnBar.append(btn);
    }
  }

  showStartMenu() {
    this.gameOver.classList.add('hidden');
    this.victory.classList.add('hidden');
    this.spawnBar.classList.add('hidden');
    this.mapMenu.classList.add('hidden');
    this.startMenu.classList.remove('hidden');
  }

  // Startpengene på kortene: tilstandens egne (fx Hardcore: 500) eller banens
  showMapMenu(mode) {
    for (const [id, node] of Object.entries(this.mapMoney)) {
      const money = CONFIG.modes[mode].startMoney ?? CONFIG.maps[id].startMoney ?? CONFIG.startMoney;
      node.textContent = `Startpenge: ${money}`;
    }
    this.startMenu.classList.add('hidden');
    this.mapMenu.classList.remove('hidden');
    this.mapMenu.scrollTop = 0;
  }

  hideMapMenu() {
    this.mapMenu.classList.add('hidden');
  }

  hideStartMenu() {
    this.startMenu.classList.add('hidden');
  }

  // Lav én knap pr. tårntype i config.js
  buildTowerMenu(onSelectTower) {
    const menu = el('towerMenu');
    this.towerButtons = {};

    for (const [type, def] of Object.entries(CONFIG.towers)) {
      if (def.buildable === false) continue; // fx Factory, der kun laves ved at samle tårne
      const btn = document.createElement('button');
      btn.className = 'tower-btn';
      btn.style.setProperty('--tower-color', def.color);

      // Lille ikon tegnet med samme kode som tårnet på banen
      const icon = document.createElement('canvas');
      icon.width = icon.height = 40;
      drawTowerShape(icon.getContext('2d'), type, 20, 20, -Math.PI / 4, 40);

      const name = document.createElement('span');
      name.className = 'tower-name';
      name.textContent = def.name;
      const cost = document.createElement('span');
      cost.className = 'tower-cost';
      cost.textContent = def.cost;
      const text = document.createElement('span');
      text.className = 'tower-text';
      text.append(name, cost);

      btn.append(icon, text);
      btn.addEventListener('click', () => onSelectTower(type));
      btn.addEventListener('mouseenter', () => this.showTooltip(btn, type));
      btn.addEventListener('mouseleave', () => this.hideTooltip());

      menu.append(btn);
      this.towerButtons[type] = btn;
    }
  }

  setMode(mode) {
    this.mode = mode;
  }

  setSelectedTower(type) {
    for (const [t, btn] of Object.entries(this.towerButtons)) {
      btn.classList.toggle('selected', t === type);
    }
  }

  showTooltip(btn, type) {
    const def = CONFIG.towers[type];
    const t = this.tooltip;
    t.replaceChildren();
    const title = document.createElement('strong');
    title.textContent = def.name;
    const cost = document.createElement('span');
    cost.className = 'tt-cost';
    cost.textContent = `${def.cost} penge`;
    const desc = document.createElement('p');
    desc.textContent = towerDescription(type, this.mode);
    t.append(title, cost, desc);
    t.classList.remove('hidden');

    // Placer tooltip over knappen, men hold den inden for vinduet
    const r = btn.getBoundingClientRect();
    const w = t.offsetWidth;
    const left = Math.min(Math.max(8, r.left + r.width / 2 - w / 2), window.innerWidth - w - 8);
    t.style.left = `${left}px`;
    t.style.top = `${r.top - t.offsetHeight - 8}px`;
  }

  hideTooltip() {
    this.tooltip.classList.add('hidden');
  }

  // Opdater tallene i HUD'en – kaldes hver frame, men rører kun DOM'en ved ændringer
  update(state) {
    setText(this.lives, state.lives);
    setText(this.money, state.infiniteMoney ? '∞' : state.money);
    setText(this.wave, `${state.wave} / ${state.totalWaves}`);
    this.modeBadge.classList.toggle('hidden', state.mode !== 'test');
    this.spawnBar.classList.toggle('hidden', state.mode !== 'test');
    setText(this.mapName, CONFIG.maps[state.mapId].name);
    const busy = state.waveActive || state.gameOver || state.won;
    this.startBtn.disabled = busy;
    setText(this.startBtn, state.waveActive ? 'Bølge i gang…' : 'Start bølge');

    // Nedtonede tårnknapper, man ikke har råd til
    for (const [type, btn] of Object.entries(this.towerButtons)) {
      const tooExpensive = !state.infiniteMoney && state.money < CONFIG.towers[type].cost;
      btn.classList.toggle('too-expensive', tooExpensive);
    }
  }

  // reason: valgfri forklaring, fx når metal-bossen slipper igennem
  showGameOver(wave, reason = '') {
    this.gameOverText.textContent = `${reason}Du nåede bølge ${wave}.`;
    this.gameOver.classList.remove('hidden');
  }

  hideGameOver() {
    this.gameOver.classList.add('hidden');
    this.victory.classList.add('hidden');
  }

  showVictory(state) {
    el('victoryText').textContent =
      `Du klarede alle ${state.totalWaves} bølger på ${CONFIG.maps[state.mapId].name}-banen ` +
      `med ${state.lives} liv tilbage.`;
    this.victory.classList.remove('hidden');
  }
}

// Kort beskrivelse af tårnets tal til panelet
function describeTower(tower) {
  const st = tower.stats;
  if (!st.attack) return `Giver ${st.income} penge pr. klaret bølge.`;
  const parts = [`Skade ${Math.round(st.damage)}`, `Rækkevidde ${Math.round(st.range)}`];
  if (st.chainCount) parts.push(`${st.chainCount} spring`);
  if (st.poisonDamage) parts.push(`Gift ${st.poisonDamage}`);
  return parts.join(' · ');
}

function setText(node, value) {
  const s = String(value);
  if (node.textContent !== s) node.textContent = s;
}
