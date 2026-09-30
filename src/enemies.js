// Fjender: følger stiens waypoints, kan tage skade og kan være forgiftet.
import { CONFIG } from './config.js';

const POISON_TEXT_COLOR = '#7dff5a';

// Heltal vises som de er; ellers én decimal med dansk komma (fx "1,7")
function formatDamage(n) {
  const rounded = Math.round(n * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1).replace('.', ',');
}

export class Enemy {
  // speedMultiplier kommer fra banen (fx Lava: 1.15)
  constructor(type, waypoints, hpMultiplier = 1, speedMultiplier = 1) {
    const def = CONFIG.enemies[type];
    this.type = type;
    this.hpMultiplier = hpMultiplier; // gives videre, hvis fjenden bliver til en anden (Metal → Kerne)
    this.maxHp = Math.round(def.hp * hpMultiplier);
    this.hp = this.maxHp;
    this.speed = def.speed * speedMultiplier;
    this.reward = def.reward;
    this.radius = def.radius;
    this.color = def.color;
    this.immune = new Set(def.immune ?? []);         // fx Metal: 'lightning'
    this.onlyHurtBy = new Set(def.onlyHurtBy ?? []); // fx Gul: kun 'lightning'
    this.boss = !!def.boss;
    this.loseOnEscape = !!def.loseOnEscape; // slipper den ud, taber man med det samme
    this.transformsInto = def.transformsInto ?? null; // fx Metal → Kerne, når den dør
    this.regen = def.regen ?? null;                   // fx Kerne: heler, når den ikke bliver ramt
    this.glow = def.glow ?? null;                     // Kerne og Rød Kerne: farverne i glødet
    this.regenTimer = this.regen ? this.regen.interval : 0;
    this.healFlash = 0;                               // kort grønt glimt, når den heler

    this.waypoints = waypoints;
    this.nextWp = 1; // indeks på det waypoint, fjenden går mod
    this.x = waypoints[0].x;
    this.y = waypoints[0].y;
    this.distance = 0; // hvor langt fjenden er nået (bruges til sigte-mål "første"/"sidste")

    this.poison = null; // { dps, remaining, tick } når fjenden er forgiftet

    this.alive = true;
    this.reachedEnd = false;
  }

  update(dt, effects) {
    this.updatePoison(dt, effects);
    if (!this.alive) return;
    this.updateRegen(dt, effects);

    let move = this.speed * dt;
    // Gå mod næste waypoint; hvis vi når det, fortsæt med resten af bevægelsen
    while (move > 0 && this.nextWp < this.waypoints.length) {
      const t = this.waypoints[this.nextWp];
      const dx = t.x - this.x;
      const dy = t.y - this.y;
      const d = Math.hypot(dx, dy);
      if (d <= move) {
        this.x = t.x;
        this.y = t.y;
        this.distance += d;
        move -= d;
        this.nextWp++;
      } else {
        this.x += (dx / d) * move;
        this.y += (dy / d) * move;
        this.distance += move;
        move = 0;
      }
    }
    if (this.nextWp >= this.waypoints.length) {
      this.reachedEnd = true;
      this.alive = false;
    }
  }

  // Er fjenden immun over for dette element? (null/undefined = intet element → aldrig immun)
  isImmune(element) {
    return !!element && this.immune.has(element);
  }

  // Heling: tæl ned, så længe fjenden ikke bliver ramt; ved 0 → +liv og start forfra
  updateRegen(dt, effects) {
    if (this.healFlash > 0) this.healFlash -= dt;
    if (!this.regen) return;
    this.regenTimer -= dt;
    if (this.regenTimer > 0) return;
    this.regenTimer += this.regen.interval;
    const healed = Math.min(this.regen.amount, this.maxHp - this.hp);
    if (healed <= 0) return; // allerede fuldt liv
    this.hp += healed;
    this.healFlash = 0.35;
    effects.addText(this.x, this.y - this.radius - 14, `+${Math.round(healed)}`, '#6dff7a', 18, 1.1);
  }

  takeDamage(amount) {
    if (!this.alive) return;
    if (this.regen) this.regenTimer = this.regen.interval; // ramt → helingen starter forfra
    this.hp -= amount;
    if (this.hp <= 0) {
      this.hp = 0;
      this.alive = false;
    }
  }

  // Forgift fjenden. Rammes den igen, nulstilles varigheden (giften stabler ikke).
  applyPoison(dps, duration) {
    if (this.isImmune('poison')) return;
    if (this.poison) {
      this.poison.remaining = duration;
      this.poison.dps = Math.max(this.poison.dps, dps);
    } else {
      this.poison = { dps, remaining: duration, tick: CONFIG.poisonTickInterval };
    }
  }

  // Giften giver skade i små ryk og viser et grønt tal for hvert ryk
  updatePoison(dt, effects) {
    const p = this.poison;
    if (!p) return;
    const interval = CONFIG.poisonTickInterval;
    p.remaining -= dt;
    p.tick -= dt;
    while (p.tick <= 0 && this.alive) {
      p.tick += interval;
      const dmg = p.dps * interval;
      this.takeDamage(dmg);
      effects.addText(this.x, this.y - this.radius - 2, formatDamage(dmg), POISON_TEXT_COLOR);
    }
    if (p.remaining <= 0) this.poison = null;
  }

  // Lav den fjende, denne bliver til, når den dør (fx Metal → Kerne).
  // Den nye fortsætter fra præcis samme sted på stien og får samme liv-gange (fx Hardcore: dobbelt).
  transform() {
    const next = new Enemy(this.transformsInto, this.waypoints, this.hpMultiplier, this.speed / CONFIG.enemies[this.type].speed);
    next.x = this.x;
    next.y = this.y;
    next.nextWp = this.nextWp;
    next.distance = this.distance;
    return next;
  }

  draw(ctx) {
    if (this.type === 'metal') {
      this.drawMetal(ctx);
      return;
    }
    if (this.glow) { // Kerne og Rød Kerne
      this.drawCore(ctx);
      return;
    }
    ctx.save();
    if (this.poison) {
      // Grønt skær om forgiftede fjender
      ctx.shadowColor = '#5dff3a';
      ctx.shadowBlur = 14;
    }
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fillStyle = this.color;
    ctx.fill();
    ctx.restore();

    if (this.poison) {
      ctx.fillStyle = 'rgba(95, 209, 58, 0.45)';
      ctx.fill();
      ctx.strokeStyle = '#7dff5a';
      ctx.lineWidth = 2;
    } else {
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.45)';
      ctx.lineWidth = 2;
    }
    ctx.stroke();
    this.drawImmunityIcon(ctx);
  }

  // Metal-bossen: skinnende sølvkugle med nitter, lyn-symbol og livsbjælke
  drawMetal(ctx) {
    const R = this.radius;
    const g = ctx.createRadialGradient(this.x - R * 0.4, this.y - R * 0.4, R * 0.1, this.x, this.y, R);
    g.addColorStop(0, '#f4f7fb');
    g.addColorStop(0.5, this.color);
    g.addColorStop(1, '#5d6570');
    ctx.save();
    if (this.poison) {
      ctx.shadowColor = '#5dff3a';
      ctx.shadowBlur = 14;
    }
    ctx.beginPath();
    ctx.arc(this.x, this.y, R, 0, Math.PI * 2);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.restore();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = this.poison ? '#7dff5a' : '#3f454e';
    ctx.stroke();
    // Nitter hele vejen rundt
    ctx.fillStyle = '#5d6570';
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(this.x + Math.cos(a) * R * 0.78, this.y + Math.sin(a) * R * 0.78, 1.8, 0, Math.PI * 2);
      ctx.fill();
    }
    this.drawImmunityIcon(ctx);
    this.drawBossBar(ctx);
  }

  // Kernen: pulserende, glødende kugle (blå eller rød – farverne står i config.js under 'glow')
  drawCore(ctx) {
    const R = this.radius;
    const c = this.glow;
    const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 180);
    const g = ctx.createRadialGradient(this.x, this.y, R * 0.1, this.x, this.y, R);
    g.addColorStop(0, c.light);
    g.addColorStop(0.45, this.color);
    g.addColorStop(1, c.dark);
    ctx.save();
    ctx.shadowColor = this.poison ? '#5dff3a' : c.shadow;
    ctx.shadowBlur = 12 + pulse * 12;
    ctx.beginPath();
    ctx.arc(this.x, this.y, R, 0, Math.PI * 2);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.restore();
    ctx.lineWidth = 2;
    ctx.strokeStyle = this.poison ? '#7dff5a' : `rgba(${c.rim}, ${0.5 + pulse * 0.5})`;
    ctx.stroke();
    if (this.healFlash > 0) {
      // Grønt glimt, når den heler
      ctx.fillStyle = `rgba(109, 255, 122, ${(this.healFlash / 0.35) * 0.55})`;
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#6dff7a';
      ctx.stroke();
    }
    this.drawBossBar(ctx);
  }

  // Livsbjælke over bosser
  drawBossBar(ctx) {
    const R = this.radius;
    const w = R * 2.2;
    const x = this.x - w / 2;
    const y = this.y - R - 10;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(x - 1, y - 1, w + 2, 7);
    ctx.fillStyle = '#e8554e';
    ctx.fillRect(x, y, w * (this.hp / this.maxHp), 5);
  }

  // Lille mørkt symbol inde i fjenden:
  //  - lyn/dråbe alene   = kan KUN skades af Lyn/Gift (onlyHurtBy)
  //  - med streg over    = immun over for Lyn/Gift (immune)
  drawImmunityIcon(ctx) {
    const onlyEl = [...this.onlyHurtBy][0];
    const immuneEl = [...this.immune][0];
    const element = onlyEl ?? immuneEl;
    if (!element) return;
    const s = this.radius;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.beginPath();
    if (element === 'lightning') {
      // Lyn-symbol
      ctx.moveTo(s * 0.15, -s * 0.65);
      ctx.lineTo(-s * 0.35, s * 0.1);
      ctx.lineTo(0, s * 0.1);
      ctx.lineTo(-s * 0.15, s * 0.65);
      ctx.lineTo(s * 0.35, -s * 0.12);
      ctx.lineTo(0, -s * 0.12);
      ctx.closePath();
    } else if (element === 'poison') {
      // Dråbe-symbol
      ctx.moveTo(0, -s * 0.6);
      ctx.quadraticCurveTo(s * 0.45, 0, s * 0.3, s * 0.3);
      ctx.arc(0, s * 0.25, s * 0.3, 0.2, Math.PI - 0.2);
      ctx.quadraticCurveTo(-s * 0.45, 0, 0, -s * 0.6);
    }
    ctx.fill();
    if (!onlyEl) {
      // Immun: streg på tværs af symbolet
      ctx.strokeStyle = '#c0392b';
      ctx.lineWidth = Math.max(2, s * 0.14);
      ctx.beginPath();
      ctx.moveTo(-s * 0.55, s * 0.55);
      ctx.lineTo(s * 0.55, -s * 0.55);
      ctx.stroke();
    }
    ctx.restore();
  }
}
