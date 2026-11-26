// Shared Constants, Character Definitions, Stage Metadata, Boss Specs & Geometry Helpers
window.SR = window.SR || {};

(function (SR) {
  const GAME_VERSION = 'v1.0.0';
  const VIEW_W = 1200;
  const VIEW_H = 680;

  let entityIdSeq = 1;
  function nextEntityId() {
    return entityIdSeq++;
  }
  function resetEntityIds() {
    entityIdSeq = 1;
  }

  function aabb(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  function clamp(v, min, max) {
    return v < min ? min : (v > max ? max : v);
  }

  function hexToRgb(hex) {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  function lerpColor(hexA, hexB, t) {
    const a = hexToRgb(hexA);
    const b = hexToRgb(hexB);
    const r = Math.round(a[0] + (b[0] - a[0]) * t);
    const g = Math.round(a[1] + (b[1] - a[1]) * t);
    const bl = Math.round(a[2] + (b[2] - a[2]) * t);
    return `rgb(${r},${g},${bl})`;
  }

  function roundRect(ctx, x, y, w, h, r) {
    const rr = Math.min(r, w * 0.5, h * 0.5);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }

  function hash01(n) {
    const s = Math.sin(n * 127.1 + 311.7) * 43758.5453123;
    return s - Math.floor(s);
  }

  // Balanced Playable Characters (Left = Luna Beginner, Middle = Pip Intermediate, Right = Lyra Advanced)
  const CHAR_DEFS = {
    blade: {
      id: 'blade',
      name: 'Lyra',
      role: 'Star Blade',
      maxHp: 6,
      speed: 358,
      jumpVel: -725,
      doubleJumpVel: -670,
      gravity: 1560,
      slideSpeed: 620,
      slideDuration: 0.52,
      attackCooldown: 0.23,
      skillCooldown: 3.3,
      skillMaxCharges: 2,
      ultimateCooldown: 30.0,
      primaryColor: '#8be4ff',
      secondaryColor: '#fff0b3',
      accentColor: '#ff9fd6',
      actionIcons: { b: '⚔️', s: '🗡️', sName: 'Blade Surge', u: '☄️', uName: 'Starfall' }
    },
    gun: {
      id: 'gun',
      name: 'Pip',
      role: 'Prism Gun',
      maxHp: 6,
      speed: 342,
      jumpVel: -665,
      doubleJumpVel: -615,
      gravity: 1550,
      slideSpeed: 595,
      slideDuration: 0.50,
      attackCooldown: 0.195,
      skillCooldown: 3.5,
      skillMaxCharges: 2,
      ultimateCooldown: 30.0,
      primaryColor: '#ffbfa0',
      secondaryColor: '#ffe58f',
      accentColor: '#ff96ce',
      actionIcons: { b: '🔫', s: '🌟', sName: 'Gold Volley', u: '☄️', uName: 'Solar Nova' }
    },
    magic: {
      id: 'magic',
      name: 'Luna',
      role: 'Dream Magic',
      maxHp: 6,
      speed: 335,
      jumpVel: -635,
      doubleJumpVel: -605,
      gravity: 1340,
      slideSpeed: 565,
      slideDuration: 0.52,
      attackCooldown: 0.27,
      skillCooldown: 3.8,
      skillMaxCharges: 2,
      ultimateCooldown: 30.0,
      primaryColor: '#d1a8ff',
      secondaryColor: '#9cf5e3',
      accentColor: '#ffaae0',
      actionIcons: { b: '🔥', s: '❄️', sName: 'Ice Volley', u: '⚡', uName: 'Thunderbolt' }
    }
  };

  // 5 Progressive Stages (Each stage has 1 Animal/Creature Mid-Boss + 1 Human Final Boss)
  const MAPS = [
    {
      index: 0, id: 'meadow', name: 'Dreamlight Meadow', zh: '夢光草原',
      difficulty: 1, stars: '★☆☆☆☆',
      midBossTitle: 'Celes-Bunny Golem · 露晶兔守護偶',
      bossTitle: 'Grandma Lin · 巷口阿嬤',
      themeColor: '#ff9fd6', enemyHpScale: 1.0, enemySpeedScale: 1.0
    },
    {
      index: 1, id: 'cloudspire', name: 'Whispering Cloudspire', zh: '雲穹秘境',
      difficulty: 2, stars: '★★☆☆☆',
      midBossTitle: 'Nyxia, Dream-Moth · 幻夢彩蝶',
      bossTitle: 'Coach Chad · 熱血體育生',
      themeColor: '#98e8ff', enemyHpScale: 1.18, enemySpeedScale: 1.07
    },
    {
      index: 2, id: 'duskwoods', name: 'Velvet Dusk Woods', zh: '暮櫻幻林',
      difficulty: 3, stars: '★★★☆☆',
      midBossTitle: 'Zephyra, Owl-Seraph · 天光羽翼',
      bossTitle: 'Victor, Day-Trade Wolf · 當沖股神',
      themeColor: '#d49cff', enemyHpScale: 1.36, enemySpeedScale: 1.14
    },
    {
      index: 3, id: 'frostmoon', name: 'Frostmoon Citadel', zh: '寒月冰城',
      difficulty: 4, stars: '★★★★☆',
      midBossTitle: 'Frost-Bunny Golem · 寒霜兔巨偶',
      bossTitle: 'Kevin, 3AM Engineer · 爆肝工程師',
      themeColor: '#a2f6ff', enemyHpScale: 1.56, enemySpeedScale: 1.2
    },
    {
      index: 4, id: 'hell', name: 'Crimson Dream-Hell', zh: '緋紅夢獄',
      difficulty: 5, stars: '★★★★★',
      midBossTitle: 'Malakor, Abyssal Dragon · 深淵焰龍',
      bossTitle: 'Mika · 水手服女高中生',
      themeColor: '#ff6e96', enemyHpScale: 1.82, enemySpeedScale: 1.26
    }
  ];

  // Animal / Fantasy Creature Boss Specs (Balanced - 2x HP)
  const BOSS_SPECS = {
    nyxia: { hp: 1560, score: 3200, spd: 1.02, p1: '#ff9fd6', p2: '#ffe58f', meteors: 4, minions: ['slime', 'wisp'], wakeText: '✦ STARLIGHT AWAKENING ✦' },
    zephyra: { hp: 1760, score: 3800, spd: 1.10, p1: '#8ceeff', p2: '#ffe999', meteors: 4, minions: ['wisp', 'bomber'], wakeText: '✦ TEMPEST SERAPH ✦' },
    morpheus: { hp: 1920, score: 4400, spd: 1.14, p1: '#d29eff', p2: '#ff9fd6', meteors: 5, minions: ['shadow_dasher', 'wisp'], wakeText: '✦ MIDNIGHT CHIME ✦' },
    glaciella: { hp: 2100, score: 5000, spd: 1.18, p1: '#a2f6ff', p2: '#d9c2ff', meteors: 5, minions: ['prism_turret', 'knight'], wakeText: '✦ SHATTERED MOON ✦' },
    malakor: { hp: 2480, score: 6800, spd: 1.22, p1: '#ff6e96', p2: '#ffcf6b', meteors: 5, minions: ['shadow_dasher', 'prism_turret'], wakeText: '✦ ECLIPSE CATACLYSM ✦' }
  };

  // Human Final Boss Specs (Progressive S1 -> S5 escalation, 2x HP, tuned projectile density)
  const HUMAN_BOSS_SPECS = {
    human_grandma: { hp: 1800, score: 3000, spd: 1.04, wakeText: '✦ 阿嬤真正生氣囉！！ ✦', color: '#ffbae0' },
    human_athlete: { hp: 2040, score: 3600, spd: 1.10, wakeText: '✦ 全力錦標賽模式！！ ✦', color: '#ffe58f' },
    human_trader: { hp: 2280, score: 4200, spd: 1.16, wakeText: '✦ ALL-IN 漲停鎖死！！ ✦', color: '#ff6b78' },
    human_engineer: { hp: 2520, score: 4800, spd: 1.21, wakeText: '✦ PRODUCTION DOWN！！ ✦', color: '#9cf5e3' },
    human_jk: { hp: 2760, score: 6200, spd: 1.26, wakeText: '✦ 放學全力社團特訓＋快炒爆發！！ ✦', color: '#ff9fd6' }
  };

  // Leaderboard API Endpoint (Cloudflare Workers + KV).
  // Leave empty ('') for offline/local-only High Scores mode; set your deployed Worker URL
  // (e.g. 'https://starlight-reverie-lb.<your-subdomain>.workers.dev') to enable the Global Leaderboard!
  const LEADERBOARD_API_URL = 'https://starlight-reverie-lb.muskyhuang.workers.dev';

  SR.GAME_VERSION = GAME_VERSION;
  SR.VIEW_W = VIEW_W;
  SR.VIEW_H = VIEW_H;
  SR.LEADERBOARD_API_URL = LEADERBOARD_API_URL;
  SR.nextEntityId = nextEntityId;
  SR.resetEntityIds = resetEntityIds;
  SR.aabb = aabb;
  SR.clamp = clamp;
  SR.hexToRgb = hexToRgb;
  SR.lerpColor = lerpColor;
  SR.roundRect = roundRect;
  SR.hash01 = hash01;
  SR.CHAR_DEFS = CHAR_DEFS;
  SR.MAPS = MAPS;
  SR.BOSS_SPECS = BOSS_SPECS;
  SR.HUMAN_BOSS_SPECS = HUMAN_BOSS_SPECS;
})(window.SR);
