// Kortvarige visuelle effekter: lyn, sniper-streger og svævende tal.

export class Effects {
  constructor() {
    this.items = [];
  }

  // Takket lyn gennem en række punkter
  addLightning(points, color, duration) {
    const path = jaggedPath(points);
    this.items.push({ kind: 'lightning', path, color, life: duration, maxLife: duration });
  }

  // Tynd, hurtig streg fra tårn til mål
  addTracer(x1, y1, x2, y2, color, duration) {
    this.items.push({ kind: 'tracer', x1, y1, x2, y2, color, life: duration, maxLife: duration });
  }

  // Tal der svæver op og forsvinder. size = skriftstørrelse i pixels, life = sekunder
  addText(x, y, text, color, size = 12, life = 0.7) {
    this.items.push({ kind: 'text', x: x + (Math.random() * 8 - 4), y, text, color, size, life, maxLife: life });
  }

  // Stumper der flyver ud til alle sider (fx når Metal-skallen knuses)
  addBurst(x, y, color, count = 14) {
    const life = 0.8;
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + Math.random() * 0.4;
      const speed = 60 + Math.random() * 90;
      this.items.push({
        kind: 'shard', x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed,
        rot: Math.random() * Math.PI, size: 3 + Math.random() * 4, color, life, maxLife: life,
      });
    }
  }

  update(dt) {
    for (const it of this.items) {
      it.life -= dt;
      if (it.kind === 'text') it.y -= 30 * dt;
      if (it.kind === 'shard') {
        it.x += it.vx * dt;
        it.y += it.vy * dt;
        it.vx *= 0.94; // bremser lidt op
        it.vy *= 0.94;
        it.rot += dt * 8;
      }
    }
    this.items = this.items.filter((it) => it.life > 0);
  }

  draw(ctx) {
    for (const it of this.items) {
      const a = it.life / it.maxLife; // 1 → 0, bruges til at fade ud
      ctx.save();
      ctx.globalAlpha = a;

      if (it.kind === 'lightning') {
        // Bred, lysende glød og en tynd hvid kerne
        ctx.lineJoin = 'round';
        ctx.shadowColor = it.color;
        ctx.shadowBlur = 12;
        ctx.strokeStyle = it.color;
        ctx.lineWidth = 4;
        strokePath(ctx, it.path);
        ctx.shadowBlur = 0;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        strokePath(ctx, it.path);
      } else if (it.kind === 'tracer') {
        ctx.strokeStyle = it.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(it.x1, it.y1);
        ctx.lineTo(it.x2, it.y2);
        ctx.stroke();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(it.x2, it.y2, 4 * a + 1, 0, Math.PI * 2);
        ctx.fill();
      } else if (it.kind === 'shard') {
        ctx.translate(it.x, it.y);
        ctx.rotate(it.rot);
        ctx.fillStyle = it.color;
        ctx.fillRect(-it.size / 2, -it.size / 2, it.size, it.size * 0.6);
      } else if (it.kind === 'text') {
        ctx.font = `bold ${it.size}px system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.lineWidth = Math.max(3, it.size / 4);
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.strokeText(it.text, it.x, it.y);
        ctx.fillStyle = it.color;
        ctx.fillText(it.text, it.x, it.y);
      }
      ctx.restore();
    }
  }
}

// Del hver linje op i små stykker og forskyd dem tilfældigt på tværs → takket lyn
function jaggedPath(points) {
  const out = [points[0]];
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    const steps = Math.max(2, Math.round(len / 12));
    const nx = -(b.y - a.y) / (len || 1); // vinkelret retning
    const ny = (b.x - a.x) / (len || 1);
    for (let s = 1; s < steps; s++) {
      const t = s / steps;
      const off = (Math.random() * 2 - 1) * 7;
      out.push({ x: a.x + (b.x - a.x) * t + nx * off, y: a.y + (b.y - a.y) * t + ny * off });
    }
    out.push(b);
  }
  return out;
}

function strokePath(ctx, path) {
  ctx.beginPath();
  path.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
  ctx.stroke();
}
