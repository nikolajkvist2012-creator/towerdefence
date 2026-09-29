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
  },

  // Tårne. Rækkefølgen her er også rækkefølgen i tårnmenuen.
  //  attack: 'projectile' = skyder en kugle, 'chain' = lyn der springer,
  //          'hitscan' = rammer med det samme (sniper)
  //  targeting: 'nearest' | 'first' | 'last' | 'strongest'
  //  element: 'lightning' | 'poison' – fjender kan være immune over for et element
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
      description: 'Skyder ikke, men giver 30 penge, hver gang en bølge er klaret.',
      cost: 200,
      attack: null,         // angriber ikke
      range: 0,
      income: 30,           // penge pr. klaret bølge
      color: '#f2b53a',
    },
    factory: {
      name: 'Factory',
      description: 'Giver 135 penge, hver gang en bølge er klaret.',
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
      boss: true,            // kommer kun som boss (se waves.boss), ikke i det almindelige mix
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
    },
  },

  // Bølger
  waves: {
    totalWaves: 15,     // klarer man den sidste bølge, har man vundet
    // Antal almindelige fjender i hver bølge
    counts: [
      { from: 1, to: 5, count: 5 },
      { from: 6, to: 10, count: 7 },
      { from: 11, to: 15, count: 12 },
    ],
    boss: { wave: 15, type: 'metal', delayBefore: 2.5 }, // bossen kommer til sidst i bølge 15
    hpGrowth: 1,        // fjendernes liv ganges med dette for hver bølge (1 = samme liv i alle bølger)
    // Fra denne bølge får de almindelige fjender (ikke bosser) ganget deres liv op
    hpBoost: { fromWave: 7, multiplier: 2 }, // bølge 7-15: dobbelt liv (50 → 100)
    spawnInterval: 0.9, // sekunder mellem hver fjende
  },

  maxDeltaTime: 0.05, // loft over dt, så spillet ikke "hopper", hvis fanen har været i baggrunden
};
