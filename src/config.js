// Alle balancetal samlet ét sted, så de er nemme at justere.

export const CONFIG = {
  // Bane / grid
  cols: 20,
  rows: 12,
  tileSize: 40, // pixels pr. felt → canvas bliver 800×480

  // Spiller
  startLives: 20,
  startMoney: 100, // bruges, hvis en bane ikke selv angiver startpenge

  // Baner. Udseende og stier står i map.js; her står reglerne og tallene.
  //  enemySpeedMultiplier: fjendernes fart ganges med dette (1.15 = 15 % hurtigere)
  //  towerRangeMultiplier: tårnenes rækkevidde ganges med dette (0.85 = 15 % kortere)
  //  Sværere baner giver flere startpenge, så alle baner føles cirka lige svære.
  maps: {
    grass: {
      name: 'Græs',
      description: 'Den klassiske bane. Ingen særregler.',
      startMoney: 100,
    },
    lava: {
      name: 'Lava',
      description: 'Man kan ikke bygge på lava. Fjender er 15 % hurtigere.',
      startMoney: 150,
      enemySpeedMultiplier: 1.15,
    },
    ice: {
      name: 'Is',
      description: 'Glat is: fjender glider 25 % hurtigere, men stien er lang.',
      startMoney: 100,
      enemySpeedMultiplier: 1.25,
    },
    water: {
      name: 'Vand',
      description: 'Byg kun på øerne. Stien går over broer.',
      startMoney: 120,
    },
    desert: {
      name: 'Ørken',
      description: 'Sandstorm: tårne har 15 % kortere rækkevidde. Kaktusser blokerer.',
      startMoney: 150,
      towerRangeMultiplier: 0.85,
    },
    rocks: {
      name: 'To stier',
      description: 'Klippebane: fjenderne kommer fra to sider på skift.',
      startMoney: 150,
    },
  },

  // Spiltilstande, man vælger i startmenuen
  //  startMoney: erstatter banens startpenge (udeladt = banens egne)
  //  enemyHpMultiplier: alle fjenders liv ganges med dette – også bosserne (Metal og Kerne)
  //  towerIncome: erstatter tårnenes 'income' (penge pr. klaret bølge)
  //  waves: ekstra bølgeregler oven på CONFIG.waves – totalWaves erstatter,
  //         counts/mixedIn/bosses lægges til (se kommentarerne ved CONFIG.waves)
  modes: {
    normal: {
      name: 'Normal',
      description: 'Det almindelige spil.',
      infiniteMoney: false,
    },
    test: {
      name: 'TEST',
      description: 'Uendelige penge – til at afprøve tårne.',
      infiniteMoney: true,
    },
    hardcore: {
      name: 'Hardcore',
      description: 'Alle fjender har dobbelt liv. Start med 500 penge. 25 bølger.',
      infiniteMoney: false,
      startMoney: 500,
      enemyHpMultiplier: 2,
      towerIncome: { farm: 50, factory: 225 },
      waves: {
        totalWaves: 25,
        counts: [
          { from: 16, to: 20, count: 24 }, // dobbelt så mange som i bølge 15
          { from: 21, to: 25, count: 16 }, // + 3 Metal og 1 Kerne = 20 fjender
        ],
        mixedIn: [
          { from: 20, to: 20, types: ['metal', 'metal'] },
          { from: 21, to: 25, types: ['metal', 'metal', 'metal', 'core'] },
        ],
        bosses: [{ wave: 25, type: 'redCore', delayBefore: 2.5 }], // slutbossen
      },
    },
  },

  // Tårne. Rækkefølgen her er også rækkefølgen i tårnmenuen.
  //  attack: 'projectile' = skyder en kugle, 'chain' = lyn der springer,
  //          'hitscan' = rammer med det samme (sniper)
  //  targeting: 'nearest' | 'first' | 'last' | 'strongest'
  //  element: 'lightning' | 'poison' – fjender kan være immune over for et element
  //  {income} i en beskrivelse erstattes med tårnets indkomst i den valgte tilstand
  towers: {
    basic: {
      name: 'Basis',
      description: 'Billigt allround-tårn med middel skade og rækkevidde.',
      cost: 50,
      attack: 'projectile',
      targeting: 'nearest',
      damage: 20,
      range: 110,           // rækkevidde i pixels
      fireRate: 1.5,        // skud pr. sekund
      projectileSpeed: 420, // pixels pr. sekund
      color: '#4fa3ff',
    },
    lightning: {
      name: 'Lyn',
      description: 'Lyn der springer videre til op til 3 fjender i nærheden. Det eneste tårn, der kan skade gule fjender.',
      cost: 85,
      attack: 'chain',
      element: 'lightning',
      targeting: 'nearest',
      damage: 25,           // skade på første fjende (falder pr. spring)
      range: 105,
      fireRate: 0.9,
      chainCount: 3,        // antal spring efter første fjende
      chainRange: 80,       // maks. afstand mellem spring (ca. 2 felter)
      chainFalloff: 0.25,   // skaden falder 25 % pr. spring
      boltDuration: 0.18,   // sekunder lynet er synligt
      color: '#ffe14d',
    },
    sniper: {
      name: 'Sniper',
      description: 'Enorm rækkevidde og skade, men skyder langsomt. Sigter efter fjenden med mest liv.',
      cost: 125,
      attack: 'hitscan',
      targeting: 'strongest',
      damage: 40,
      range: 220,
      fireRate: 0.3,
      tracerDuration: 0.12,
      color: '#b58cff',
    },
    poison: {
      name: 'Gift',
      description: 'Giftkugler der skader over tid. Det eneste tårn, der kan skade grønne fjender.',
      cost: 60,
      attack: 'projectile',
      element: 'poison',
      targeting: 'first',   // gå efter den forreste, så giften når at virke
      damage: 15,           // direkte skade når kuglen rammer
      range: 100,
      fireRate: 1.0,
      projectileSpeed: 300,
      poisonDamage: 10,     // samlet giftskade over hele varigheden
      poisonDuration: 3,    // sekunder
      color: '#5fd13a',
    },
    farm: {
      name: 'Farm',
      description: 'Skyder ikke, men giver {income} penge, hver gang en bølge er klaret.',
      cost: 200,
      attack: null,         // angriber ikke
      range: 0,
      income: 30,           // penge pr. klaret bølge
      color: '#f2b53a',
    },
    factory: {
      name: 'Factory',
      description: 'Giver {income} penge, hver gang en bølge er klaret.',
      buildable: false,     // kan ikke købes i menuen – laves af 4 Farm + 1 Farm
      cost: 0,
      attack: null,
      range: 0,
      income: 135,          // penge pr. klaret bølge
      color: '#f2b53a',
    },
  },

  // Særlige opskrifter for store tårne: 4 tårne af typen [firkant] + [lagt ovenpå] = nyt tårn.
  // Opskrifter gælder før de almindelige effekter i mergeEffects.
  mergeRecipes: {
    farm: { farm: 'factory' },
  },

  // Salg: man får denne andel af alt, hvad tårnet har kostet (0.7 = 70 %)
  sellRefund: 0.7,

  // Store tårne: byg 4 ens tårne i en 2×2-firkant, og klik med et andet tårn ovenpå.
  // Det store tårn skyder som grundtypen og får effekten fra tårnet, der blev lagt ovenpå.
  // Man betaler prisen for det tårn, der lægges ovenpå.
  merge: {
    damageMultiplier: 4,  // skaden fra alle 4 tårne samlet i ét
    rangeMultiplier: 1.3, // lidt længere rækkevidde
  },

  // Effekten hvert tårn giver, når det lægges oven på en 2×2-firkant.
  // Farm er med vilje ikke med – den kan hverken være grundtype eller effekt.
  mergeEffects: {
    basic:     { name: 'Hurtig', description: '50 % hurtigere skud', fireRateMultiplier: 1.5 },
    lightning: { name: 'Lyn', description: 'Træf springer videre til 2 fjender mere, og tårnet kan skade gule',
                 chainCount: 2, chainRange: 80, chainFalloff: 0.25 },
    sniper:    { name: 'Sniper', description: '60 % længere rækkevidde og 50 % mere skade',
                 rangeMultiplier: 1.6, damageMultiplier: 1.5 },
    poison:    { name: 'Gift', description: 'Træf forgifter (10 skade over 3 sek.), og tårnet kan skade grønne',
                 poisonDamage: 10, poisonDuration: 3 },
  },

  // Gift tæller skade i små ryk; tallet her er sekunder mellem hvert ryk
  poisonTickInterval: 0.5,

  // Fjender
  //  immune: liste af elementer, fjenden ikke tager skade af (se tårnenes 'element')
  //  onlyHurtBy: fjenden kan KUN skades af tårne, der har et af disse elementer i sig
  //              (som grundtype eller som effekt på et stort tårn)
  //  firstWave: den første bølge, hvor fjendetypen dukker op
  enemies: {
    normal: {
      name: 'Rød',
      hp: 50,
      speed: 60,  // pixels pr. sekund
      reward: 8,  // penge pr. drab
      radius: 11,
      color: '#e8554e',
      immune: [],
      firstWave: 1,
    },
    yellow: {
      name: 'Gul',
      hp: 50,
      speed: 60,
      reward: 10,
      radius: 11,
      color: '#ffd23f',
      onlyHurtBy: ['lightning'], // KUN tårne med Lyn i sig (lille Lyn eller stort tårn med Lyn) kan skade den
      firstWave: 3,
    },
    green: {
      name: 'Grøn',
      hp: 50,
      speed: 60,
      reward: 10,
      radius: 11,
      color: '#3fbf5a',
      onlyHurtBy: ['poison'],    // KUN tårne med Gift i sig (lille Gift eller stort tårn med Gift) kan skade den
      firstWave: 5,
    },
    metal: {
      name: 'Metal',
      hp: 2500,
      speed: 30,             // halvt så hurtig som de andre
      reward: 100,
      radius: 20,            // dobbelt så stor
      color: '#aab3bf',
      immune: ['lightning'], // lyn preller af på metal
      boss: true,            // kommer kun som boss (se waves.bosses), ikke i det almindelige mix
      loseOnEscape: true,    // slipper den ud af banen, taber man med det samme
      transformsInto: 'core', // når den dør, knuses skallen, og Kernen fortsætter samme sted
    },
    core: {
      name: 'Kerne',
      hp: 3000,
      speed: 12,             // super langsom (Metal er 30, almindelige fjender 60)
      reward: 100,
      radius: 20,
      color: '#3fa9ff',
      immune: [],            // alle tårne kan skade den – også Lyn
      boss: true,
      loseOnEscape: true,
      // Heling: når den ikke har taget skade (heller ikke gift) i 'interval' sekunder,
      // får den 'amount' liv – og igen hvert 'interval' sekund, indtil den bliver ramt
      regen: { amount: 100, interval: 2 },
      // Farverne i glødet (den blå Kerne og den Røde Kerne tegnes ens, bare i hver sin farve)
      glow: { light: '#e6f6ff', dark: '#0d4f99', shadow: '#5cc2ff', rim: '200, 235, 255' },
    },
    redCore: {
      name: 'Rød Kerne',
      hp: 10000,
      ignoreModeHp: true,    // 10000 liv i alt – Hardcore fordobler det ikke
      speed: 12,
      reward: 700,
      radius: 20,
      color: '#e8413a',
      immune: [],
      boss: true,            // Hardcore-slutboss i bølge 25
      loseOnEscape: true,
      regen: { amount: 100, interval: 2 },
      glow: { light: '#ffe6e3', dark: '#8f1410', shadow: '#ff5c4d', rim: '255, 210, 205' },
    },
  },

  // Bølger
  //  counts: antal almindelige fjender i hver bølge
  //  mixedIn: bosser, der fordeles med lige stor afstand ind imellem de almindelige fjender
  //  bosses: bosser, der kommer til sidst i en bestemt bølge (efter en lille pause)
  waves: {
    totalWaves: 15,     // klarer man den sidste bølge, har man vundet
    counts: [
      { from: 1, to: 5, count: 5 },
      { from: 6, to: 10, count: 7 },
      { from: 11, to: 15, count: 12 },
    ],
    bosses: [{ wave: 15, type: 'metal', delayBefore: 2.5 }], // Metal kommer til sidst i bølge 15
    hpGrowth: 1,        // fjendernes liv ganges med dette for hver bølge (1 = samme liv i alle bølger)
    // Fra denne bølge får de almindelige fjender (ikke bosser) ganget deres liv op
    hpBoost: { fromWave: 7, multiplier: 2 }, // bølge 7-15: dobbelt liv (50 → 100)
    spawnInterval: 0.9, // sekunder mellem hver fjende
  },

  maxDeltaTime: 0.05, // loft over dt, så spillet ikke "hopper", hvis fanen har været i baggrunden
};
