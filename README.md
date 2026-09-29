# Tower Defense

Et tower defense-spil i browseren, lavet med HTML5 Canvas og vanilla JavaScript (ES-moduler). Der er ingen frameworks og intet build-step.

## Sådan starter du spillet

ES-moduler kan ikke indlæses direkte fra en fil (`file://`), så spillet skal køre gennem en lokal server. Åbn en terminal i denne mappe, og vælg én af mulighederne:

```bash
python -m http.server 8000
```

eller

```bash
npx serve
```

Åbn derefter den adresse, serveren skriver, fx <http://localhost:8000>.

## Sådan spiller du

- Vælg **Normal** eller **TEST** (uendelige penge), og vælg derefter en bane: Græs, Lava, Is, Vand, Ørken eller To stier. Hver bane har sin egen særregel.

- Klik på et ledigt græsfelt for at bygge et tårn. Du kan ikke bygge på stien.
- Tryk på **Start bølge** for at sende fjenderne ind.
- Du mister et liv, hver gang en fjende når ud i højre side. Når du har 0 liv, er spillet slut.
- Klarer du alle 15 bølger, har du vundet. I bølge 15 kommer Metal-bossen (245 liv, immun over for lyn) – slipper den igennem, taber du med det samme.
- Du får penge for hver fjende, du dræber.

## Filer

| Fil | Indhold |
|---|---|
| `src/config.js` | Alle balancetal: priser, skade, liv, fart osv. |
| `src/main.js` | Game loop og musestyring |
| `src/map.js` | Bane, sti og grid |
| `src/enemies.js` | Fjender og deres bevægelse |
| `src/towers.js` | Tårne, sigte og skud |
| `src/projectiles.js` | Projektiler |
| `src/waves.js` | Bølger |
| `src/ui.js` | HUD, knapper og menuer |
