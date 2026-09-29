// Bølger: bestemmer hvilke fjender der kommer i hver bølge (tallene står i config.js).
import { CONFIG } from './config.js';

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
// I boss-bølgen kommer bossen til sidst.
export function buildWave(waveNumber) {
  const w = CONFIG.waves;
  const range = w.counts.find((r) => waveNumber >= r.from && waveNumber <= r.to);
  const count = range ? range.count : w.counts[w.counts.length - 1].count;
  const types = Object.keys(CONFIG.enemies)
    .filter((t) => !CONFIG.enemies[t].boss && CONFIG.enemies[t].firstWave <= waveNumber);

  // delay = sekunder fra denne fjende sendes ind, til den næste kommer
  const list = [];
  for (let i = 0; i < count; i++) {
    const type = types[i % types.length];
    list.push({ type, hpMultiplier: hpMultiplierFor(type, waveNumber), delay: w.spawnInterval });
  }

  if (w.boss && waveNumber === w.boss.wave) {
    if (list.length > 0) list[list.length - 1].delay = w.boss.delayBefore; // lille pause før bossen
    list.push({ type: w.boss.type, hpMultiplier: hpMultiplierFor(w.boss.type, waveNumber), delay: w.spawnInterval });
  }
  return list;
}
