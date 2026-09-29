// Banerne: grid, stier, terræn (lava, vand, kaktusser) og tegning.
// Reglerne for hver bane (startpenge, fart, rækkevidde) står i config.js under maps.
import { CONFIG } from './config.js';

const { cols, rows, tileSize: TS } = CONFIG;

// Hver bane:
//  paths:          én eller flere stier; hver sti er en liste af knækpunkter [kolonne, række]
//  defaultTerrain: terræn på alle felter, der ikke er nævnt i terrain (fx 'water')
//  terrain:        firkanter af terræn: [type, kolonne, række, bredde, højde]
//                  'lava', 'water' og 'cactus' kan man ikke bygge på; 'land' kan man
//  theme:          farver
export const MAP_LAYOUTS = {
  grass: {
    paths: [[[0, 2], [5, 2], [5, 8], [10, 8], [10, 3], [15, 3], [15, 9], [19, 9]]],
    theme: { ground: ['#5d9b4a', '#57934a'], path: '#d9c28f', pathLine: 'rgba(120, 95, 50, 0.35)' },
  },

  lava: {
    paths: [[[0, 5], [4, 5], [4, 1], [9, 1], [9, 10], [14, 10], [14, 4], [19, 4]]],
    terrain: [
      ['lava', 0, 0, 3, 2], ['lava', 6, 3, 2, 3], ['lava', 11, 1, 2, 2],
      ['lava', 16, 7, 3, 2], ['lava', 1, 9, 2, 2], ['lava', 11, 6, 2, 2],
    ],
    theme: { ground: ['#3b2b27', '#35261f'], path: '#6b5a52', pathLine: 'rgba(255, 120, 40, 0.4)' },
  },

  ice: {
    // Lang, snoet sti frem og tilbage over banen
    paths: [[[0, 1], [17, 1], [17, 4], [2, 4], [2, 7], [17, 7], [17, 10], [19, 10]]],
    theme: {
      ground: ['#eaf2f8', '#e0eaf3'], path: '#a8d8f5', pathLine: 'rgba(255, 255, 255, 0.9)',
      dark: true, // lys bane → mørke streger for rækkevidde og markering
    },
  },

  water: {
    paths: [[[0, 6], [6, 6], [6, 2], [13, 2], [13, 9], [19, 9]]],
    defaultTerrain: 'water',
    terrain: [
      ['land', 0, 3, 5, 3], ['land', 0, 7, 5, 3], ['land', 7, 3, 5, 4], ['land', 3, 0, 9, 2],
      ['land', 14, 3, 4, 5], ['land', 8, 8, 4, 3], ['land', 14, 10, 5, 2],
    ],
    theme: { ground: ['#86c166', '#7fb95f'], path: '#d9c28f', pathLine: 'rgba(120, 95, 50, 0.35)' },
  },

  desert: {
    paths: [[[0, 9], [3, 9], [3, 3], [8, 3], [8, 8], [12, 8], [12, 2], [17, 2], [17, 6], [19, 6]]],
    terrain: [
      ['cactus', 1, 2, 1, 1], ['cactus', 6, 6, 1, 1], ['cactus', 10, 5, 1, 1],
      ['cactus', 15, 9, 1, 1], ['cactus', 19, 1, 1, 1], ['cactus', 5, 11, 1, 1],
    ],
    sandstorm: true,
    theme: { ground: ['#e6cf94', '#dfc68a'], path: '#c9a86a', pathLine: 'rgba(120, 80, 30, 0.35)', dark: true },
  },

  rocks: {
    // To stier, der mødes på midten
    paths: [
      [[0, 1], [7, 1], [7, 5], [12, 5], [12, 8], [19, 8]],
      [[0, 10], [4, 10], [4, 5], [7, 5], [12, 5], [12, 8], [19, 8]],
    ],
    theme: { ground: ['#70747b', '#6a6e75'], path: '#a39884', pathLine: 'rgba(40, 35, 30, 0.35)' },
  },
};

const BLOCKING = new Set(['lava', 'water', 'cactus']);

export class GameMap {
  constructor(id = 'grass') {
    const layout = MAP_LAYOUTS[id];
    this.id = id;
    this.layout = layout;
    this.theme = layout.theme;

    // Terræn pr. felt ("c,r" → type)
    this.terrain = new Map();
    if (layout.defaultTerrain) {
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) this.terrain.set(key(c, r), layout.defaultTerrain);
      }
    }
    for (const [kind, c0, r0, w, h] of layout.terrain ?? []) {
      for (let c = c0; c < c0 + w; c++) {
        for (let r = r0; r < r0 + h; r++) this.terrain.set(key(c, r), kind);
      }
    }

    // Stier: felter + waypoints i pixels
    this.pathCells = new Set();
    this.paths = layout.paths.map((points) => {
      for (let i = 0; i < points.length - 1; i++) {
        let [c, r] = points[i];
        const [c2, r2] = points[i + 1];
        this.pathCells.add(key(c, r));
        while (c !== c2 || r !== r2) {
          c += Math.sign(c2 - c);
          r += Math.sign(r2 - r);
          this.pathCells.add(key(c, r));
        }
      }
      // Første og sidste waypoint ligger lige uden for skærmen, så fjender glider ind og ud
      const wps = points.map(([c, r]) => cellCenter(c, r));
      const first = wps[0];
      const last = wps[wps.length - 1];
      const dirIn = edgeDirection(points[0]);
      const dirOut = edgeDirection(points[points.length - 1]);
      wps.unshift({ x: first.x + dirIn.x * TS, y: first.y + dirIn.y * TS });
      wps.push({ x: last.x + dirOut.x * TS, y: last.y + dirOut.y * TS });
      return wps;
    });
  }

  isPath(c, r) {
    return this.pathCells.has(key(c, r));
  }

  terrainAt(c, r) {
    return this.terrain.get(key(c, r)) ?? null;
  }

  inBounds(c, r) {
    return c >= 0 && c < cols && r >= 0 && r < rows;
  }

  // Kan man bygge et tårn her? (ikke sti, lava, vand eller kaktus)
  canBuildOn(c, r) {
    return this.inBounds(c, r) && !this.isPath(c, r) && !BLOCKING.has(this.terrainAt(c, r));
  }

  // Farver til rækkevidde-cirkel og byggemarkering (mørke på lyse baner)
  get ui() {
    return this.theme.dark
      ? { rangeFill: 'rgba(20, 40, 70, 0.10)', rangeStroke: 'rgba(20, 40, 70, 0.65)', hoverOk: 'rgba(20, 60, 120, 0.25)' }
      : { rangeFill: 'rgba(255, 255, 255, 0.08)', rangeStroke: 'rgba(255, 255, 255, 0.55)', hoverOk: 'rgba(255, 255, 255, 0.3)' };
  }

  // t = tid i sekunder (til animation af lava og vand)
  draw(ctx, t = 0) {
    const th = this.theme;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = c * TS;
        const y = r * TS;
        const kind = this.terrainAt(c, r);

        if (this.isPath(c, r)) {
          if (kind === 'water') {
            drawWater(ctx, x, y, c, r, t);
            drawBridge(ctx, x, y, this.bridgeIsHorizontal(c, r));
          } else {
            ctx.fillStyle = th.path;
            ctx.fillRect(x, y, TS, TS);
            if (this.id === 'ice') drawIceShine(ctx, x, y);
          }
          continue;
        }

        if (kind === 'lava') { drawLava(ctx, x, y, c, r, t); continue; }
        if (kind === 'water') { drawWater(ctx, x, y, c, r, t); continue; }

        // Almindelig jord i et let skakternet, så felterne er nemme at se
        ctx.fillStyle = th.ground[(c + r) % 2];
        ctx.fillRect(x, y, TS, TS);
        if (kind === 'cactus') drawCactus(ctx, x, y);
        if (this.id === 'rocks') drawPebbles(ctx, x, y, c, r);
      }
    }

    // Stiplet midterlinje viser stiernes retning
    ctx.strokeStyle = th.pathLine;
    ctx.lineWidth = 4;
    ctx.setLineDash([8, 10]);
    for (const wps of this.paths) {
      ctx.beginPath();
      wps.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
      ctx.stroke();
    }
    ctx.setLineDash([]);
  }

  // Tegnes oven på alt andet (fx sandstorm i ørkenen)
  drawOverlay(ctx, t = 0) {
    if (!this.layout.sandstorm) return;
    const w = cols * TS;
    const h = rows * TS;
    ctx.strokeStyle = 'rgba(235, 205, 140, 0.45)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < 40; i++) {
      const speed = 140 + (i % 5) * 30;
      const x = ((i * 97 + t * speed) % (w + 120)) - 60;
      const y = (i * 53) % h + Math.sin(t * 1.5 + i) * 12;
      ctx.moveTo(x, y);
      ctx.lineTo(x + 18 + (i % 3) * 8, y + 2);
    }
    ctx.stroke();
  }

  // En bro ligger vandret, hvis stien fortsætter til venstre eller højre
  bridgeIsHorizontal(c, r) {
    return this.isPath(c - 1, r) || this.isPath(c + 1, r);
  }
}

// ---------- Tegning af terræn ----------

function drawLava(ctx, x, y, c, r, t) {
  ctx.fillStyle = '#e8480f';
  ctx.fillRect(x, y, TS, TS);
  // Pulserende glød
  const glow = 0.25 + 0.2 * Math.sin(t * 2 + c * 0.9 + r * 1.3);
  ctx.fillStyle = `rgba(255, 190, 60, ${glow})`;
  ctx.fillRect(x, y, TS, TS);
  // En boble, der vokser og forsvinder
  const phase = (t * 0.6 + rand(c, r)) % 1;
  ctx.beginPath();
  ctx.arc(x + 8 + rand(r, c) * 24, y + 8 + rand(c + 3, r) * 24, 2 + phase * 5, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(255, 230, 120, ${0.8 * (1 - phase)})`;
  ctx.fill();
}

function drawWater(ctx, x, y, c, r, t) {
  ctx.fillStyle = (c + r) % 2 === 0 ? '#2e7bbf' : '#2a74b4';
  ctx.fillRect(x, y, TS, TS);
  // Små bølger, der bevæger sig
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
  ctx.lineWidth = 2;
  const off = Math.sin(t * 1.5 + c * 0.8 + r * 0.5) * 4;
  ctx.beginPath();
  ctx.moveTo(x + 6, y + 16 + off);
  ctx.quadraticCurveTo(x + 13, y + 11 + off, x + 20, y + 16 + off);
  ctx.moveTo(x + 18, y + 30 - off);
  ctx.quadraticCurveTo(x + 25, y + 25 - off, x + 32, y + 30 - off);
  ctx.stroke();
}

function drawBridge(ctx, x, y, horizontal) {
  ctx.fillStyle = '#9b6b3d';
  if (horizontal) ctx.fillRect(x, y + 5, TS, TS - 10);
  else ctx.fillRect(x + 5, y, TS - 10, TS);
  // Planker
  ctx.strokeStyle = '#6e4a28';
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 1; i < 5; i++) {
    const p = (i * TS) / 5;
    if (horizontal) { ctx.moveTo(x + p, y + 5); ctx.lineTo(x + p, y + TS - 5); }
    else { ctx.moveTo(x + 5, y + p); ctx.lineTo(x + TS - 5, y + p); }
  }
  ctx.stroke();
}

function drawIceShine(ctx, x, y) {
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x + 8, y + 26);
  ctx.lineTo(x + 18, y + 16);
  ctx.moveTo(x + 22, y + 32);
  ctx.lineTo(x + 30, y + 24);
  ctx.stroke();
}

function drawCactus(ctx, x, y) {
  ctx.fillStyle = '#3f8f3a';
  ctx.beginPath();
  ctx.roundRect(x + 16, y + 7, 8, 28, 4);   // stamme
  ctx.roundRect(x + 7, y + 14, 6, 12, 3);   // venstre arm
  ctx.roundRect(x + 27, y + 11, 6, 12, 3);  // højre arm
  ctx.fill();
  ctx.fillRect(x + 10, y + 22, 8, 4);
  ctx.fillRect(x + 23, y + 19, 7, 4);
}

function drawPebbles(ctx, x, y, c, r) {
  if (rand(c, r) > 0.35) return;
  ctx.fillStyle = 'rgba(40, 42, 48, 0.35)';
  ctx.beginPath();
  ctx.ellipse(x + 10 + rand(r, c) * 20, y + 12 + rand(c + 7, r) * 16, 5, 3.5, 0, 0, Math.PI * 2);
  ctx.fill();
}

// ---------- Hjælpefunktioner ----------

export function key(c, r) {
  return `${c},${r}`;
}

export function cellCenter(c, r) {
  return { x: c * TS + TS / 2, y: r * TS + TS / 2 };
}

export function pixelToCell(x, y) {
  return { c: Math.floor(x / TS), r: Math.floor(y / TS) };
}

// Hvilken vej ud af banen peger et kant-felt? (bruges til at lade fjender gå ind/ud af skærmen)
function edgeDirection([c, r]) {
  if (c === 0) return { x: -1, y: 0 };
  if (c === cols - 1) return { x: 1, y: 0 };
  if (r === 0) return { x: 0, y: -1 };
  return { x: 0, y: 1 };
}

// Fast "tilfældigt" tal mellem 0 og 1 for et felt (samme hver gang)
function rand(a, b) {
  const s = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453;
  return s - Math.floor(s);
}
