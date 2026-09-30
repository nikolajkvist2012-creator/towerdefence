// Bølger: bestemmer hvilke fjender der kommer i hver bølge (tallene står i config.js).
import { CONFIG } from './config.js';

// Bølgereglerne for en tilstand: CONFIG.waves plus tilstandens egne (fx Hardcore: 25 bølger).
// Tilstandens counts står først, så de vinder, hvis de dækker samme bølge.
export function waveRules(mode) {
  const w = CONFIG.waves;
  const m = CONFIG.modes[mode]?.waves ?? {};
  return {
    ...w,
    totalWaves: m.totalWaves ?? w.totalWaves,
    counts: [...(m.counts ?? []), ...w.counts],
    mixedIn: [...(w.mixedIn ?? []), ...(m.mixedIn ?? [])],
    bosses: [...w.bosses, ...(m.bosses ?? [])],
  };
}

// Hvor meget skal en fjendetypes liv ganges med i en given bølge?
// Almindelige fjender får hpBoost fra en bestemt bølge (fx dobbelt liv fra bølge 7); bosser gør ikke.
export function hpMultiplierFor(type, waveNumber) {
  const w = CONFIG.waves;
  let mult = Math.pow(w.hpGrowth, Math.max(0, waveNumber - 1));
  if (!CONFIG.enemies[type].boss && w.hpBoost && waveNumber >= w.hpBoost.fromWave) {
    mult *= w.hpBoost.multiplier;
  }
  return mult;
}

// Returnerer en liste af fjender, der skal sendes ind i den givne bølge.
// Almindelige fjender skiftes på skift (rød, gul, grøn, rød …), når de er låst op (firstWave).
// Bosser fra mixedIn fordeles med lige stor afstand ind imellem; bosser fra bosses kommer til sidst.
export function buildWave(waveNumber, mode) {
  const w = waveRules(mode);
  const inWave = (r) => waveNumber >= r.from && waveNumber <= r.to;
  const range = w.counts.find(inWave);
  const count = range ? range.count : w.counts[w.counts.length - 1].count;
  const types = Object.keys(CONFIG.enemies)
    .filter((t) => !CONFIG.enemies[t].boss && CONFIG.enemies[t].firstWave <= waveNumber);

  // Pladserne i køen, hvor de indblandede bosser skal stå (fx bølge 20: nr. 8 og 17 af 26)
  const specials = w.mixedIn.filter(inWave).flatMap((r) => r.types);
  const total = count + specials.length;
  const specialAt = new Map();
  specials.forEach((type, i) => specialAt.set(Math.floor(((i + 1) * total) / (specials.length + 1)), type));

  // delay = sekunder fra denne fjende sendes ind, til den næste kommer
  const list = [];
  let n = 0; // antal almindelige fjender indtil nu
  for (let i = 0; i < total; i++) {
    const type = specialAt.get(i) ?? types[n++ % types.length];
    list.push({ type, hpMultiplier: hpMultiplierFor(type, waveNumber), delay: w.spawnInterval });
  }

  for (const boss of w.bosses.filter((b) => b.wave === waveNumber)) {
    if (list.length > 0) list[list.length - 1].delay = boss.delayBefore; // lille pause før bossen
    list.push({ type: boss.type, hpMultiplier: hpMultiplierFor(boss.type, waveNumber), delay: w.spawnInterval });
  }
  return list;
}
