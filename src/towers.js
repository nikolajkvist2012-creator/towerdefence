// Tårne: vælger et mål inden for rækkevidde og angriber (kugle, lyn eller sniper-skud).
// Et tårn kan være lille (1×1) eller stort (2×2, lavet af 4 ens tårne + en effekt).
import { CONFIG } from './config.js';
import { Projectile } from './projectiles.js';
import { sound } from './audio.js';

export class Tower {
  // opts.size: 1 eller 2 felter; opts.modifier: tårntypen hvis effekt det store tårn har
  // opts.rangeMultiplier: fra banen (fx Ørken: 0.85)
  // opts.income: fra tilstanden (fx Hardcore: Farm 50) – udeladt = config-værdien
  constructor(type, c, r, opts = {}) {
    const def = CONFIG.towers[type];
    this.type = type;
    this.def = def;
    this.c = c; // øverste venstre felt
    this.r = r;
    this.size = opts.size ?? 1;
    this.modifier = opts.modifier ?? null;
    this.stats = computeStats(def, this.modifier, opts.rangeMultiplier ?? 1);
    if (opts.income !== undefined) this.stats.income = opts.income;
    // Alle elementer tårnet har i sig: grundtypens + effektens (fx Basis + Lyn → lyn)
    this.elements = new Set(
      [def.element, this.modifier && CONFIG.towers[this.modifier].element].filter(Boolean),
    );
    this.totalCost = opts.totalCost ?? def.cost; // alt der er betalt for tårnet (bruges ved salg)

    const s = CONFIG.tileSize;
    this.x = c * s + (this.size * s) / 2; // midten af tårnets felter
    this.y = r * s + (this.size * s) / 2;
    this.cooldown = 0;
    this.angle = -Math.PI / 2;           // løbets retning (peger op fra start)
    this.targeting = this.stats.targeting; // kan ændres senere (fase 4)
  }

  get range() {
    return this.stats.range;
  }

  // Felterne tårnet dækker
  get cells() {
    const out = [];
    for (let dc = 0; dc < this.size; dc++) {
      for (let dr = 0; dr < this.size; dr++) out.push([this.c + dc, this.r + dr]);
    }
    return out;
  }

  // Fx "Basis + Gift" for store tårne
  get displayName() {
    return this.modifier ? `${this.def.name} + ${CONFIG.towers[this.modifier].name}` : this.def.name;
  }

  // Kan dette tårn overhovedet skade fjenden?
  //  - fjender der er immune over for grundtypens element (fx Metal mod Lyn) kan ikke
  //  - fjender med onlyHurtBy (fx Gul) kan kun, hvis tårnet har et af de elementer i sig
  canHurt(enemy) {
    if (enemy.isImmune(this.stats.element)) return false;
    if (enemy.onlyHurtBy.size > 0) {
      return [...enemy.onlyHurtBy].some((el) => this.elements.has(el));
    }
    return true;
  }

  get sellValue() {
    return Math.floor(this.totalCost * CONFIG.sellRefund);
  }

  update(dt, enemies, projectiles, effects) {
    if (!this.stats.attack) return; // fx Farm, som ikke skyder
    this.cooldown -= dt;

    const target = pickTarget(this, enemies);
    if (!target) return;

    this.angle = Math.atan2(target.y - this.y, target.x - this.x);
    if (this.cooldown > 0) return;
    this.cooldown = 1 / this.stats.fireRate;
    sound.shot(this.type, this.size); // hver tårntype har sin egen skudlyd

    switch (this.stats.attack) {
      case 'projectile': this.fireProjectile(target, projectiles); break;
      case 'chain':      this.hitAndChain(target, enemies, effects, [{ x: this.x, y: this.y }]); break;
      case 'hitscan':    this.fireHitscan(target, enemies, effects); break;
    }
  }

  // Basis og Gift: en kugle der flyver mod målet; træffet håndteres af hitAndChain
  fireProjectile(target, projectiles) {
    const st = this.stats;
    const modColor = this.modifier ? CONFIG.towers[this.modifier].color : null;
    projectiles.push(new Projectile(this.x, this.y, target, {
      speed: st.projectileSpeed,
      color: this.def.color,
      radius: (st.poisonDamage ? 5 : 4) * (this.size === 2 ? 1.4 : 1),
      outline: modColor ?? (st.poisonDamage ? '#1d4d12' : null),
      onHit: (t, enemies, effects) => this.hitAndChain(t, enemies, effects, []),
    }));
  }

  // Sniper: rammer med det samme og tegner en kort streg fra løbets spids
  fireHitscan(target, enemies, effects) {
    const muzzle = CONFIG.tileSize * 0.62 * this.size;
    effects.addTracer(
      this.x + Math.cos(this.angle) * muzzle, this.y + Math.sin(this.angle) * muzzle,
      target.x, target.y, this.def.color, this.stats.tracerDuration,
    );
    this.hitAndChain(target, enemies, effects, []);
  }

  // Ram målet, og spring evt. videre (lyn) til nærmeste nye fjende med faldende skade.
  // points = hvor lynet starter (tårnet for Lyn-tårne; ellers fra målet selv)
  hitAndChain(target, enemies, effects, points) {
    const st = this.stats;
    let damage = st.damage;
    this.applyHit(target, damage);

    const chainCount = st.chainCount ?? 0;
    if (chainCount === 0 && points.length === 0) return;

    points.push({ x: target.x, y: target.y });
    const hit = new Set([target]);
    let current = target;
    for (let i = 0; i < chainCount; i++) {
      damage *= 1 - st.chainFalloff;
      let next = null;
      let best = st.chainRange;
      for (const e of enemies) {
        // Lynet springer uden om fjender, der er immune over for lyn (fx Metal),
        // og fjender tårnet slet ikke kan skade (fx Grøn, hvis tårnet ikke har Gift i sig)
        if (!e.alive || hit.has(e) || e.isImmune('lightning') || !this.canHurt(e)) continue;
        const dist = Math.hypot(e.x - current.x, e.y - current.y);
        if (dist <= best) {
          best = dist;
          next = e;
        }
      }
      if (!next) break;
      hit.add(next);
      points.push({ x: next.x, y: next.y });
      this.applyHit(next, damage);
      current = next;
    }
    if (points.length > 1) {
      const bolt = CONFIG.towers.lightning;
      effects.addLightning(points, bolt.color, bolt.boltDuration);
    }
  }

  // Skade + evt. gift på én fjende.
  // Kan tårnet ikke skade fjenden (immun, eller fx Gul uden Lyn i tårnet), sker der ingenting.
  // Gift-effekten stoppes af fjendens egen immunitet (se Enemy.applyPoison).
  applyHit(enemy, damage) {
    const st = this.stats;
    if (!this.canHurt(enemy)) return;
    enemy.takeDamage(damage);
    if (st.poisonDamage && enemy.alive) {
      // Samlet giftskade fordeles jævnt over varigheden
      enemy.applyPoison(st.poisonDamage / st.poisonDuration, st.poisonDuration);
    }
  }

  draw(ctx) {
    const s = CONFIG.tileSize * this.size;
    if (this.modifier) {
      // Stort tårn: farvet ramme i effektens farve + lille effekt-ikon i hjørnet
      const modColor = CONFIG.towers[this.modifier].color;
      ctx.fillStyle = '#2b303b';
      ctx.fillRect(this.x - s / 2 + 2, this.y - s / 2 + 2, s - 4, s - 4);
      ctx.strokeStyle = modColor;
      ctx.lineWidth = 3;
      ctx.strokeRect(this.x - s / 2 + 3, this.y - s / 2 + 3, s - 6, s - 6);
    }
    drawTowerShape(ctx, this.type, this.x, this.y, this.angle, s);
    if (this.modifier) {
      const t = CONFIG.tileSize;
      const bx = this.x + s / 2 - t * 0.38;
      const by = this.y - s / 2 + t * 0.38;
      ctx.beginPath();
      ctx.arc(bx, by, t * 0.3, 0, Math.PI * 2);
      ctx.fillStyle = '#1c2027';
      ctx.fill();
      drawTowerShape(ctx, this.modifier, bx, by, -Math.PI / 4, t * 0.55);
    }
  }
}

// Beregn et tårns tal ud fra config, plus bonusser hvis det er et stort tårn med effekt.
// rangeMultiplier kommer fra banen (fx sandstorm i Ørkenen).
export function computeStats(def, modifier, rangeMultiplier = 1) {
  const st = { ...def };
  st.range *= rangeMultiplier;
  if (!modifier) return st;

  const m = CONFIG.merge;
  const fx = CONFIG.mergeEffects[modifier];
  st.damage *= m.damageMultiplier * (fx.damageMultiplier ?? 1);
  st.range *= m.rangeMultiplier * (fx.rangeMultiplier ?? 1);
  st.fireRate *= fx.fireRateMultiplier ?? 1;
  if (fx.poisonDamage) {
    st.poisonDamage = (st.poisonDamage ?? 0) + fx.poisonDamage;
    st.poisonDuration = st.poisonDuration ?? fx.poisonDuration;
  }
  if (fx.chainCount) {
    st.chainCount = (st.chainCount ?? 0) + fx.chainCount;
    st.chainRange = st.chainRange ?? fx.chainRange;
    st.chainFalloff = st.chainFalloff ?? fx.chainFalloff;
  }
  return st;
}

// Penge pr. klaret bølge for en tårntype – tilstanden kan ændre det (fx Hardcore: Farm 50)
export function incomeFor(type, mode) {
  return CONFIG.modes[mode]?.towerIncome?.[type] ?? CONFIG.towers[type].income;
}

// Tårnets beskrivelse med den rigtige indkomst sat ind i stedet for {income}
export function towerDescription(type, mode) {
  return CONFIG.towers[type].description.replace('{income}', incomeFor(type, mode));
}

// Kan denne tårntype indgå i et stort tårn? (Farm kan ikke)
export function canMerge(type) {
  return type in CONFIG.mergeEffects;
}

// Vælg mål ud fra tårnets sigte-indstilling. Højeste score vinder.
function pickTarget(tower, enemies) {
  let target = null;
  let bestScore = -Infinity;
  for (const e of enemies) {
    if (!e.alive) continue;
    if (!tower.canHurt(e)) continue; // spild ikke skud på fjender, tårnet ikke kan skade
    const dist = Math.hypot(e.x - tower.x, e.y - tower.y);
    if (dist > tower.range) continue;
    let score;
    switch (tower.targeting) {
      case 'first':     score = e.distance; break;   // længst fremme på stien
      case 'last':      score = -e.distance; break;  // længst tilbage
      case 'strongest': score = e.hp; break;         // mest liv tilbage
      default:          score = -dist;               // nærmeste
    }
    if (score > bestScore) {
      bestScore = score;
      target = e;
    }
  }
  return target;
}

// Tegn et tårn. Bruges på banen, som ikon i tårnmenuen og som effekt-ikon på store tårne.
// s = tårnets størrelse i pixels; angle = løbets retning
export function drawTowerShape(ctx, type, x, y, angle, s) {
  const color = CONFIG.towers[type].color;
  const dark = '#20242c';
  const base = '#3a3f4b';
  ctx.save();
  ctx.translate(x, y);

  switch (type) {
    case 'basic': {
      // Firkantet sokkel, rundt tårn, kort løb
      ctx.fillStyle = base;
      ctx.fillRect(-s * 0.4, -s * 0.4, s * 0.8, s * 0.8);
      ctx.save();
      ctx.rotate(angle);
      ctx.fillStyle = dark;
      ctx.fillRect(0, -s * 0.075, s * 0.45, s * 0.15);
      ctx.restore();
      circle(ctx, 0, 0, s * 0.25, color);
      break;
    }

    case 'lightning': {
      // Sekskantet sokkel med en gul lynspole og et lyn-symbol
      polygon(ctx, 6, s * 0.42, Math.PI / 6, base);
      circle(ctx, 0, 0, s * 0.27, '#2b2a1a');
      ctx.strokeStyle = color;
      ctx.lineWidth = s * 0.06;
      ctx.beginPath();
      ctx.arc(0, 0, s * 0.27, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(s * 0.04, -s * 0.2);
      ctx.lineTo(-s * 0.1, s * 0.03);
      ctx.lineTo(s * 0.0, s * 0.03);
      ctx.lineTo(-s * 0.05, s * 0.2);
      ctx.lineTo(s * 0.11, -s * 0.04);
      ctx.lineTo(s * 0.01, -s * 0.04);
      ctx.closePath();
      ctx.fill();
      break;
    }

    case 'sniper': {
      // Rombe-sokkel og en slank krop med et langt, tyndt løb
      polygon(ctx, 4, s * 0.42, 0, base);
      ctx.save();
      ctx.rotate(angle);
      ctx.fillStyle = dark;
      ctx.fillRect(0, -s * 0.0375, s * 0.62, s * 0.075);         // langt løb
      ctx.fillRect(s * 0.56, -s * 0.0625, s * 0.06, s * 0.125);  // mundingen
      ctx.fillStyle = color;
      roundRect(ctx, -s * 0.2, -s * 0.09, s * 0.4, s * 0.18, s * 0.075); // slank krop
      ctx.fillStyle = '#e6dcff';
      ctx.fillRect(-s * 0.02, -s * 0.15, s * 0.14, s * 0.06);    // kikkertsigte
      ctx.restore();
      break;
    }

    case 'poison': {
      // Rund sokkel, grøn giftbeholder med bobler og et kort, bredt løb
      circle(ctx, 0, 0, s * 0.42, base);
      ctx.save();
      ctx.rotate(angle);
      ctx.fillStyle = dark;
      ctx.fillRect(0, -s * 0.11, s * 0.38, s * 0.22);
      ctx.restore();
      circle(ctx, 0, 0, s * 0.26, color);
      circle(ctx, -s * 0.08, -s * 0.07, s * 0.06, '#b8ff9c');
      circle(ctx, s * 0.08, s * 0.05, s * 0.045, '#b8ff9c');
      circle(ctx, -s * 0.02, s * 0.11, s * 0.03, '#b8ff9c');
      break;
    }

    case 'farm': {
      // Mark med afgrøderækker, en lille rød lade og en guldmønt
      ctx.fillStyle = '#8a6a3c';
      ctx.fillRect(-s * 0.42, -s * 0.42, s * 0.84, s * 0.84);
      ctx.fillStyle = '#a7d05a';
      for (let i = 0; i < 4; i++) {
        ctx.fillRect(-s * 0.36, -s * 0.34 + i * s * 0.2, s * 0.72, s * 0.07);
      }
      // Lade
      ctx.fillStyle = '#c8433a';
      ctx.fillRect(-s * 0.3, -s * 0.02, s * 0.36, s * 0.3);
      ctx.fillStyle = '#7e2620';
      ctx.beginPath();
      ctx.moveTo(-s * 0.35, 0);
      ctx.lineTo(-s * 0.12, -s * 0.2);
      ctx.lineTo(s * 0.11, 0);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#f3e3c0';
      ctx.fillRect(-s * 0.16, s * 0.1, s * 0.08, s * 0.18); // dør
      // Guldmønt
      circle(ctx, s * 0.22, -s * 0.2, s * 0.13, color);
      ctx.fillStyle = '#9a6a10';
      ctx.font = `bold ${Math.round(s * 0.16)}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('$', s * 0.22, -s * 0.195);
      break;
    }

    case 'factory': {
      // Grå fabrik med savtakket tag, skorsten med røg, gule vinduer og en stor guldmønt
      ctx.fillStyle = '#4a4f5c';
      ctx.fillRect(-s * 0.44, -s * 0.44, s * 0.88, s * 0.88); // grund
      // Skorsten + røg
      ctx.fillStyle = '#7a3b32';
      ctx.fillRect(s * 0.18, -s * 0.4, s * 0.1, s * 0.3);
      circle(ctx, s * 0.25, -s * 0.43, s * 0.05, 'rgba(220, 225, 235, 0.8)');
      circle(ctx, s * 0.33, -s * 0.47, s * 0.04, 'rgba(220, 225, 235, 0.6)');
      // Bygning med savtakket tag
      ctx.fillStyle = '#8b93a3';
      ctx.beginPath();
      ctx.moveTo(-s * 0.38, s * 0.36);
      ctx.lineTo(-s * 0.38, -s * 0.08);
      for (let i = 0; i < 3; i++) {
        const x0 = -s * 0.38 + i * s * 0.25;
        ctx.lineTo(x0 + s * 0.25, -s * 0.24);
        ctx.lineTo(x0 + s * 0.25, -s * 0.08);
      }
      ctx.lineTo(s * 0.37, s * 0.36);
      ctx.closePath();
      ctx.fill();
      // Vinduer
      ctx.fillStyle = '#ffd257';
      for (let i = 0; i < 3; i++) {
        ctx.fillRect(-s * 0.32 + i * s * 0.25, s * 0.0, s * 0.12, s * 0.1);
      }
      // Port
      ctx.fillStyle = '#3a3f4b';
      ctx.fillRect(-s * 0.08, s * 0.18, s * 0.16, s * 0.18);
      // Guldmønt
      circle(ctx, -s * 0.28, -s * 0.3, s * 0.11, color);
      ctx.fillStyle = '#9a6a10';
      ctx.font = `bold ${Math.round(s * 0.14)}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('$', -s * 0.28, -s * 0.295);
      break;
    }
  }
  ctx.restore();
}

function circle(ctx, x, y, r, fill) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
}

function polygon(ctx, sides, r, rotation, fill) {
  ctx.beginPath();
  for (let i = 0; i < sides; i++) {
    const a = rotation + (i / sides) * Math.PI * 2;
    const px = Math.cos(a) * r;
    const py = Math.sin(a) * r;
    i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
}
