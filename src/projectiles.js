// Projektiler: flyver mod deres mål og kalder onHit, når de rammer.

export class Projectile {
  // opts: { speed, color, radius, outline, onHit(target, enemies, effects) }
  constructor(x, y, target, opts) {
    this.x = x;
    this.y = y;
    this.target = target;
    this.speed = opts.speed;
    this.color = opts.color;
    this.radius = opts.radius ?? 4;
    this.outline = opts.outline ?? null;
    this.onHit = opts.onHit; // tårnet bestemmer, hvad et træf gør (skade, gift, lyn …)
    // Husk målets sidste position, hvis målet dør undervejs
    this.tx = target.x;
    this.ty = target.y;
    this.alive = true;
  }

  update(dt, enemies, effects) {
    if (this.target.alive) {
      this.tx = this.target.x;
      this.ty = this.target.y;
    }
    const dx = this.tx - this.x;
    const dy = this.ty - this.y;
    const d = Math.hypot(dx, dy);
    const step = this.speed * dt;

    if (d <= step) {
      // Træf – men kun effekt, hvis målet stadig lever
      if (this.target.alive) this.onHit(this.target, enemies, effects);
      this.alive = false;
    } else {
      this.x += (dx / d) * step;
      this.y += (dy / d) * step;
    }
  }

  draw(ctx) {
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fillStyle = this.color;
    ctx.fill();
    if (this.outline) {
      ctx.strokeStyle = this.outline;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }
}
