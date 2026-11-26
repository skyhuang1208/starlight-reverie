// 5 Progressive Wide-Plain Handcrafted Maps (15,600px each)
// Gentle <= 46px upward height steps (unobstructed single-jump flow), wide dodging plains,
// generous one-way aerial bars, middle-of-platform auto-grounded enemies (26 ground + 13 flying = 39),
// 5 scarce 小頭目, and 2 roomy 1,280px Boss Arenas per stage (Mid Creature Boss -> Final Human Boss).
window.SR = window.SR || {};

(function (SR) {
  function buildComplexMap(cfg, stageIndex) {
    const solids = [{ x: -60, y: 0, w: 60, h: 720, kind: 'wall' }];
    const bars = [];
    const movingPlatforms = [];
    const pickups = [];
    const enemySpawns = [];
    const props = [];
    const checkpoints = [];

    const kMain = cfg.mainKind;
    const kPlat = cfg.platKind;
    const kBasin = cfg.basinKind;
    const kSanc = cfg.sancKind;
    const b1 = cfg.barStyle1;
    const b2 = cfg.barStyle2;
    const b3 = cfg.barStyle3;
    const p = cfg.pool;

    // Subtle per-stage height rhythm offset (-6..+6px) while keeping all upward steps <= 46px
    const vOff = [-4, 4, -6, 2, -2][stageIndex] || 0;
    const cloudSpdMult = 1 + stageIndex * 0.05;

    const addStarRow = (x, y, n, step = 48) => {
      for (let i = 0; i < n; i++) pickups.push({ x: x + i * step, y, kind: 'star' });
    };

    const findSupportingSolid = (x) => {
      let best = null;
      for (const s of solids) {
        if (s.kind === 'wall' || s.kind === 'arch') continue;
        if (x >= s.x && x <= s.x + s.w) {
          if (!best || s.y < best.y) best = s;
        }
      }
      return best;
    };

    // Auto-grounded middle-of-platform enemy placement: keeps patrol safely inside platform edges & away from arches!
    const addGroundEnemy = (type, x, maxHalfSpan = 175) => {
      const arch = (SR.ENEMY_ARCHETYPES && SR.ENEMY_ARCHETYPES[type]) || { w: 40, h: 44 };
      const sol = findSupportingSolid(x);
      const surfY = sol ? sol.y : 560;
      const leftBound = sol ? Math.max(0, sol.x) : 0;
      const edgePad = sol && sol.w >= 360 ? 80 : 24;
      let pMin = sol ? Math.max(leftBound + edgePad, x - maxHalfSpan) : x - maxHalfSpan;
      let pMax = sol ? Math.min(sol.x + sol.w - edgePad, x + maxHalfSpan) : x + maxHalfSpan;
      for (const s of solids) {
        if (s.kind !== 'arch') continue;
        if (x < s.x) pMax = Math.min(pMax, s.x - 60);
        else if (x > s.x + s.w) pMin = Math.max(pMin, s.x + s.w + 60);
      }
      const safeX = SR.clamp(x - arch.w * 0.5, pMin, Math.max(pMin, pMax - arch.w));
      enemySpawns.push({
        type,
        x: Math.round(safeX),
        y: Math.round(surfY - arch.h),
        patrolMin: Math.round(pMin),
        patrolMax: Math.round(pMax)
      });
    };

    const addFlyingEnemy = (type, x, y, halfSpan = 220) => {
      enemySpawns.push({
        type,
        x: Math.round(x),
        y: Math.round(y),
        homeY: Math.round(y),
        patrolMin: Math.round(x - halfSpan),
        patrolMax: Math.round(x + halfSpan)
      });
    };

    // ===== SECTION 1: WIDE OPENING PLAIN, SPACIOUS ARCH & STEPPED TERRACES (0 - 3120) =====
    solids.push({ x: -80, y: 560, w: 1620, h: 190, kind: kMain });
    solids.push({ x: 760, y: 460, w: 180, h: 64, kind: 'arch', hint: '▼ SLIDE' }); // 36px slide clearance, 100px total height
    bars.push({ x: 420, y: 465, w: 230, style: b1 });
    bars.push({ x: 1080, y: 465, w: 230, style: b1 });
    addStarRow(795, 542, 3);
    addStarRow(475, 430, 3);

    const s1Step = 520 + vOff;
    const s1Crest = 476 + vOff;
    solids.push({ x: 1540, y: s1Step, w: 680, h: 234, kind: kPlat }); // Δ <= 46px upward
    solids.push({ x: 2220, y: s1Crest, w: 900, h: 278, kind: kPlat }); // Δ 44px upward
    bars.push({ x: 1760, y: s1Step - 96, w: 240, style: b2 });
    bars.push({ x: 2550, y: s1Crest - 98, w: 240, style: b2 });
    addStarRow(1820, s1Step - 130, 2);
    pickups.push({ x: 2670, y: s1Crest - 132, kind: 'heart' });

    // ===== SECTION 2: GREAT BASIN PLAIN #1 & SMOOTH EXIT TERRACE (3120 - 6160) =====
    solids.push({ x: 3120, y: 520, w: 660, h: 230, kind: kBasin });
    movingPlatforms.push({ x: 3560, y: 410, w: 185, startX: 3480, endX: 3920, startY: 410, endY: 400, speed: 0.78 * cloudSpdMult, phase: 0 });

    solids.push({ x: 3780, y: 572, w: 1860, h: 178, kind: kBasin }); // 1,860px wide flat plain!
    solids.push({ x: 5640, y: 530, w: 520, h: 220, kind: kPlat });   // Δ 42px smooth exit step
    bars.push({ x: 4020, y: 472, w: 240, style: b2 });
    bars.push({ x: 4440, y: 386, w: 250, style: b2 });
    bars.push({ x: 4860, y: 472, w: 240, style: b2 });
    bars.push({ x: 5260, y: 402, w: 240, style: b2 });
    addStarRow(4500, 352, 3);
    pickups.push({ x: 5380, y: 368, kind: 'heart' });

    // ===== SECTION 3: CHECKPOINT 1 & ROOMY MID-BOSS ARENA (6160 - 7860) =====
    solids.push({ x: 6160, y: 530, w: 420, h: 220, kind: kSanc });
    checkpoints.push({ id: 'cp1', x: 6280, y: 530, label: 'Challenger Gate', activated: false });
    pickups.push({ x: 6390, y: 500, kind: 'heart' });

    solids.push({ x: 6580, y: 575, w: 1280, h: 180, kind: kSanc });
    bars.push({ x: 6760, y: 475, w: 220, style: b3 });
    bars.push({ x: 7110, y: 390, w: 230, style: b3 });
    bars.push({ x: 7470, y: 475, w: 220, style: b3 });

    // ===== SECTION 4: CHECKPOINT 2, SANCTUARY PLAIN, ARCH #2 & DESCENT (7860 - 11420) =====
    const s4Crest = 490 + vOff;
    solids.push({ x: 7860, y: 530, w: 860, h: 220, kind: kPlat }); // Δ 45px upward from arena
    checkpoints.push({ id: 'cp2', x: 7990, y: 530, label: 'Midway Crest', activated: false });
    pickups.push({ x: 8100, y: 500, kind: 'heart' });

    solids.push({ x: 8720, y: s4Crest, w: 1320, h: 264, kind: kPlat }); // Δ <= 46px upward
    solids.push({ x: 9290, y: s4Crest - 100, w: 180, h: 64, kind: 'arch', hint: '▼ SLIDE' });
    solids.push({ x: 10040, y: 530, w: 1380, h: 220, kind: kPlat });

    bars.push({ x: 8960, y: s4Crest - 96, w: 230, style: b2 });
    bars.push({ x: 9540, y: s4Crest - 96, w: 230, style: b2 });
    bars.push({ x: 10280, y: 432, w: 230, style: b2 });
    bars.push({ x: 10940, y: 432, w: 230, style: b2 });
    movingPlatforms.push({ x: 10600, y: 358, w: 185, startX: 10460, endX: 10900, startY: 358, endY: 346, speed: 0.80 * cloudSpdMult, phase: 0.6 });
    addStarRow(9325, s4Crest - 18, 2);
    pickups.push({ x: 9425, y: s4Crest - 18, kind: 'heart' });

    // ===== SECTION 5: GREAT BASIN PLAIN #2 & SMOOTH EXIT TERRACE (11420 - 13720) =====
    solids.push({ x: 11420, y: 572, w: 1780, h: 178, kind: kBasin });
    solids.push({ x: 13200, y: 530, w: 520, h: 220, kind: kPlat }); // Δ 42px smooth exit step
    bars.push({ x: 11640, y: 472, w: 240, style: b2 });
    bars.push({ x: 12040, y: 386, w: 250, style: b2 });
    bars.push({ x: 12460, y: 472, w: 240, style: b2 });
    bars.push({ x: 12840, y: 402, w: 240, style: b2 });
    addStarRow(12100, 352, 3);
    pickups.push({ x: 12960, y: 368, kind: 'heart' });

    // ===== SECTION 6: CHECKPOINT 3, VANGUARD & ROOMY FINAL BOSS SANCTUARY (13720 - 15620) =====
    solids.push({ x: 13720, y: 530, w: 620, h: 220, kind: kSanc });
    checkpoints.push({ id: 'cp3', x: 13840, y: 530, label: 'Sanctuary Gate', activated: false });
    pickups.push({ x: 13930, y: 500, kind: 'heart' });
    pickups.push({ x: 13980, y: 500, kind: 'heart' });
    bars.push({ x: 14030, y: 432, w: 220, style: b3 });

    solids.push({ x: 14340, y: 575, w: 1280, h: 180, kind: kSanc });
    solids.push({ x: 15600, y: 0, w: 80, h: 720, kind: 'wall' });
    bars.push({ x: 14520, y: 475, w: 220, style: b3 });
    bars.push({ x: 14870, y: 390, w: 230, style: b3 });
    bars.push({ x: 15230, y: 475, w: 220, style: b3 });

    // ===== AUTO-GROUNDED MIDDLE-OF-PLATFORM ENEMY ROSTER: 26 GROUND + 13 FLYING = 39 TOTAL =====
    // Section 1: 6 ground + 3 flying
    addGroundEnemy(p[0], 460, 165);
    addGroundEnemy(p[1], 1240, 165);
    addGroundEnemy(p[2], 1880, 175);
    addGroundEnemy(p[0], 2480, 145);
    addGroundEnemy(p[3], 2680, 145);
    addGroundEnemy(p[1], 2880, 145);
    addFlyingEnemy('wisp', 900, 290, 160);
    addFlyingEnemy('bomber', 1880, 248, 280);
    addFlyingEnemy('wisp', 2680, 290, 160);

    // Section 2: 7 ground (incl. 小頭目 #1 Shiba Samurai) + 3 flying
    addGroundEnemy(p[2], 3450, 170);
    addGroundEnemy(p[0], 4140, 165);
    addGroundEnemy(p[1], 4400, 165);
    addGroundEnemy('shiba_samurai', 4660, 195);
    addGroundEnemy(p[3], 5020, 165);
    addGroundEnemy(p[2], 5320, 165);
    addGroundEnemy(p[0], 5900, 150);
    addFlyingEnemy('wisp', 4280, 310, 170);
    addFlyingEnemy('bomber', 4740, 248, 340);
    addFlyingEnemy('wisp', 5420, 305, 160);

    // Section 4: 6 ground (incl. 小頭目 #2 Corgi Skater & 小頭目 #3 Stuff-Throwing Cat) + 3 flying
    addGroundEnemy(p[1], 8420, 175);
    addGroundEnemy('corgi_skater', 8990, 175);
    addGroundEnemy(p[2], 9750, 175);
    addGroundEnemy(p[0], 10340, 175);
    addGroundEnemy('cat_thrower', 10720, 185);
    addGroundEnemy(p[3], 11080, 175);
    addFlyingEnemy('wisp', 9120, 290, 170);
    addFlyingEnemy('bomber', 10500, 248, 320);
    addFlyingEnemy('wisp', 11150, 290, 170);

    // Section 5: 6 ground (incl. 小頭目 #4 Delivery Scooter) + 3 flying
    addGroundEnemy(p[0], 11720, 165);
    addGroundEnemy(p[2], 12020, 165);
    addGroundEnemy('delivery_scooter', 12360, 195);
    addGroundEnemy(p[3], 12720, 165);
    addGroundEnemy(p[1], 12960, 155);
    addGroundEnemy(p[0], 13460, 150);
    addFlyingEnemy('wisp', 11880, 305, 170);
    addFlyingEnemy('bomber', 12440, 248, 340);
    addFlyingEnemy('wisp', 13050, 305, 160);

    // Section 6 Vanguard: 1 ground (小頭目 #5 Shiba Samurai) + 1 flying
    addGroundEnemy('shiba_samurai', 14130, 130);
    addFlyingEnemy('wisp', 14150, 300, 120);

    // Rich Decorative Props auto-grounded to terrain surfaces
    const propKind = cfg.propKind;
    [160, 620, 1380, 2060, 2960, 3300, 4260, 5500, 7960, 8820, 9900, 11260, 11880, 13340].forEach((px, idx) => {
      const sol = findSupportingSolid(px);
      const py = sol ? sol.y : 560;
      if (propKind === 'tree') {
        props.push({ kind: idx % 3 === 1 ? 'lantern' : 'tree', x: px, y: py, scale: 0.92 + (idx % 3) * 0.12, hue: ['pink', 'mint', 'lavender'][idx % 3] });
      } else {
        props.push({ kind: idx % 3 === 1 ? 'lantern' : propKind, x: px, y: py, h: 100 + (idx % 3) * 16 });
      }
    });
    // Sanctuary Arches in BOTH Boss Arenas
    [6680, 7220, 7760, 14460, 14980, 15500].forEach((ax) => {
      props.push({ kind: 'sanctuaryArch', x: ax, y: 575 });
    });

    // Exactly 2 Roomy 1,280px Boss Arenas per Stage: Mid = Animal/Creature Boss, Final = Human Boss
    const bossArenas = {
      midboss: {
        id: 'midboss',
        bossClass: cfg.midBossClass,
        bossKind: cfg.midBossKind,
        variant: cfg.midBossVariant || 'dewdrop',
        triggerX: 6740,
        minX: 6600,
        maxX: 7840,
        spawnX: 7540,
        spawnY: cfg.midBossClass === 'golem' ? 489 : 310, // Grounded flush on y=575 (575-86=489)
        defeated: false,
        active: false,
        name: cfg.midBossName
      },
      finalboss: {
        id: 'finalboss',
        bossClass: 'human',
        bossKind: cfg.humanBossKind,
        triggerX: 14500,
        minX: 14360,
        maxX: 15580,
        spawnX: 15260,
        spawnY: 501, // Grounded flush on y=575 (575-74=501)
        defeated: false,
        active: false,
        name: cfg.humanBossName
      }
    };

    return {
      width: 15600,
      height: 680,
      spawn: { x: 90, y: 560 },
      territories: cfg.territories,
      solids,
      bars,
      movingPlatforms,
      basinMist: { x: 3780, y: 558, w: 1860, h: 22, style: cfg.mistStyle },
      basinMist2: { x: 11420, y: 558, w: 1780, h: 22, style: cfg.mistStyle },
      checkpoints,
      pickups: pickups.map((pk, idx) => ({ ...pk, id: idx, collected: false, bobPhase: idx * 0.65 })),
      enemySpawns,
      bossArenas,
      props
    };
  }

  const MAP_CONFIGS = [
    {
      mainKind: 'ground', platKind: 'plateau', basinKind: 'basin', sancKind: 'sanctuary',
      barStyle1: 'meadow', barStyle2: 'crystal', barStyle3: 'star',
      propKind: 'tree', mistStyle: 'moon',
      pool: ['slime', 'knight', 'slime', 'knight'],
      midBossClass: 'golem', midBossKind: 'golem', midBossVariant: 'dewdrop',
      midBossName: 'Celes-Bunny Golem · 露晶兔守護偶',
      humanBossKind: 'human_grandma', humanBossName: 'Grandma Lin, Neighborhood Legend · 巷口阿嬤',
      territories: [
        { id: 'meadow', name: 'Pastel Meadow', sub: '花夢草原 · 寬闊平原與結晶拱門', startX: 0, endX: 3120, skyTop: '#4c3575', skyMid: '#9a68b2', skyBot: '#ffd2d7', hillFar: '#7d5aa6', hillNear: '#a884d4', groundTop: '#8fe6cb', groundBody: '#5d478a', accent: '#ffbae0' },
        { id: 'plateau', name: 'Skyglass Plateau', sub: '雲璃高原 · 浮雲與柴犬武士', startX: 3120, endX: 6580, skyTop: '#313d7c', skyMid: '#7482cc', skyBot: '#f8d8c4', hillFar: '#5a6cb5', hillNear: '#8b9ee0', groundTop: '#b7f3ff', groundBody: '#4c5794', accent: '#ffe599' },
        { id: 'bunny_glade', name: 'Dewdrop Bunny Shrine', sub: '露晶兔聖壇 · 守護偶考驗', startX: 6580, endX: 11420, skyTop: '#263a70', skyMid: '#5a7fc2', skyBot: '#b8f2eb', hillFar: '#40609c', hillNear: '#6994d4', groundTop: '#9cf5e3', groundBody: '#364d85', accent: '#ffe594' },
        { id: 'basin', name: 'Moonlit Basin', sub: '月露深谷 · 幽光盆地', startX: 11420, endX: 14340, skyTop: '#1b2654', skyMid: '#375888', skyBot: '#8fd7d4', hillFar: '#2c4875', hillNear: '#47769b', groundTop: '#8ff2e1', groundBody: '#2b3e68', accent: '#a2fff0' },
        { id: 'sanctuary', name: 'Alleyway Dream Plaza', sub: '夢境巷口 · 巷口阿嬤的領地', startX: 14340, endX: 15700, skyTop: '#331d59', skyMid: '#7d449c', skyBot: '#ffb8d4', hillFar: '#592e78', hillNear: '#8c53b0', groundTop: '#ffc8e6', groundBody: '#422566', accent: '#ffe494' }
      ]
    },
    {
      mainKind: 'plateau', platKind: 'plateau', basinKind: 'basin', sancKind: 'sanctuary',
      barStyle1: 'crystal', barStyle2: 'moon', barStyle3: 'star',
      propKind: 'crystalPillar', mistStyle: 'cloud',
      pool: ['slime', 'prism_turret', 'knight', 'prism_turret'],
      midBossClass: 'creature', midBossKind: 'nyxia',
      midBossName: 'Nyxia, Dream-Moth Queen · 幻夢彩蝶',
      humanBossKind: 'human_athlete', humanBossName: 'Coach Chad, Varsity Ace · 熱血體育生',
      territories: [
        { id: 'skybridge', name: 'Skyglass Bridge', sub: '雲端長橋 · 高空橫桿', startX: 0, endX: 3780, skyTop: '#244b85', skyMid: '#68a6db', skyBot: '#fce2c7', hillFar: '#4c7cc2', hillNear: '#7cb1e8', groundTop: '#d4f9ff', groundBody: '#476ba8', accent: '#ffe99c' },
        { id: 'moth_spire', name: 'Dream-Moth Spire', sub: '彩蝶雲塔 · 幻夢彩蝶', startX: 3780, endX: 8720, skyTop: '#293778', skyMid: '#606cc4', skyBot: '#f5b8da', hillFar: '#4954a6', hillNear: '#7482d6', groundTop: '#b4f6ef', groundBody: '#3d4c91', accent: '#9ff6ff' },
        { id: 'tempest_basin', name: 'Tempest Cloud Basin', sub: '流雲盆地 · 稜鏡大軍', startX: 8720, endX: 14340, skyTop: '#20336e', skyMid: '#516db8', skyBot: '#ffd2d9', hillFar: '#3a4f96', hillNear: '#6380cc', groundTop: '#c4f8ff', groundBody: '#364682', accent: '#ffe594' },
        { id: 'aerie', name: 'Skyline Court', sub: '雲端球場 · 熱血體育生主場', startX: 14340, endX: 15700, skyTop: '#1f2559', skyMid: '#584da8', skyBot: '#ffcaa6', hillFar: '#3d3985', hillNear: '#695ec2', groundTop: '#fff0b8', groundBody: '#3d3a7a', accent: '#ffe694' }
      ]
    },
    {
      mainKind: 'ground', platKind: 'plateau', basinKind: 'basin', sancKind: 'sanctuary',
      barStyle1: 'meadow', barStyle2: 'moon', barStyle3: 'star',
      propKind: 'tree', mistStyle: 'dusk',
      pool: ['slime', 'shadow_dasher', 'knight', 'prism_turret'],
      midBossClass: 'creature', midBossKind: 'zephyra',
      midBossName: 'Zephyra, Skylight Owl-Seraph · 天光羽翼',
      humanBossKind: 'human_trader', humanBossName: 'Victor, Day-Trade Wolf · 當沖股神',
      territories: [
        { id: 'sakura_grove', name: 'Velvet Sakura Grove', sub: '暮櫻幻林 · 暗影巡行', startX: 0, endX: 3780, skyTop: '#2b1347', skyMid: '#6e2e78', skyBot: '#f29bc0', hillFar: '#4f1e63', hillNear: '#7d378a', groundTop: '#ffb8e4', groundBody: '#3d1e57', accent: '#ffe594' },
        { id: 'seraph_canopy', name: 'Owl-Seraph Canopy', sub: '羽翼林冠 · 天光羽翼', startX: 3780, endX: 8720, skyTop: '#1e1040', skyMid: '#4c2675', skyBot: '#c788e0', hillFar: '#371b61', hillNear: '#603294', groundTop: '#d7b8ff', groundBody: '#2f1a54', accent: '#ff9fd6' },
        { id: 'hollow_basin', name: 'Twilight Mushroom Basin', sub: '幽蕈盆地 · 迷霧伏擊', startX: 8720, endX: 14340, skyTop: '#1a113b', skyMid: '#44246e', skyBot: '#a973d6', hillFar: '#311a57', hillNear: '#58318c', groundTop: '#a3f5dc', groundBody: '#2b1c52', accent: '#d9a8ff' },
        { id: 'trading_floor', name: 'Twilight Trading Floor', sub: '暮光交易大廳 · 當沖股神的K線戰場', startX: 14340, endX: 15700, skyTop: '#12102e', skyMid: '#2a1b54', skyBot: '#8f477e', hillFar: '#211545', hillNear: '#3d256e', groundTop: '#ffe39c', groundBody: '#221740', accent: '#7ef7b8' }
      ]
    },
    {
      mainKind: 'plateau', platKind: 'plateau', basinKind: 'basin', sancKind: 'sanctuary',
      barStyle1: 'crystal', barStyle2: 'moon', barStyle3: 'star',
      propKind: 'crystalPillar', mistStyle: 'frost',
      pool: ['knight', 'prism_turret', 'shadow_dasher', 'knight'],
      midBossClass: 'golem', midBossKind: 'golem', midBossVariant: 'frost',
      midBossName: 'Frost-Bunny Golem · 寒霜兔巨偶',
      humanBossKind: 'human_engineer', humanBossName: 'Kevin, 3AM Senior Engineer · 爆肝工程師',
      territories: [
        { id: 'ramparts', name: 'Aurora Ramparts', sub: '極光城壁 · 寒冰高台', startX: 0, endX: 3780, skyTop: '#10224a', skyMid: '#265c8c', skyBot: '#a6f0f0', hillFar: '#1e4675', hillNear: '#3b79ab', groundTop: '#d6fcff', groundBody: '#274c7d', accent: '#9cf5ff' },
        { id: 'glacier_court', name: 'Frost-Bunny Bastion', sub: '寒霜兔堡壘 · 冰偶守護', startX: 3780, endX: 8720, skyTop: '#0d1a3d', skyMid: '#23427a', skyBot: '#86c6e8', hillFar: '#1a3263', hillNear: '#335c96', groundTop: '#b8f4ff', groundBody: '#203866', accent: '#d6b8ff' },
        { id: 'ice_basin', name: 'Frozen Mirror Basin', sub: '冰鏡深谷 · 寒霜大軍', startX: 8720, endX: 14340, skyTop: '#0d1a3d', skyMid: '#23427a', skyBot: '#86c6e8', hillFar: '#1a3263', hillNear: '#335c96', groundTop: '#b8f4ff', groundBody: '#203866', accent: '#d6b8ff' },
        { id: 'server_room', name: 'Sub-Zero Server Hall', sub: '極寒機房 · 爆肝工程師凌晨三點加班區', startX: 14340, endX: 15700, skyTop: '#0b1e36', skyMid: '#1b4766', skyBot: '#7ef7c8', hillFar: '#143852', hillNear: '#266180', groundTop: '#a8ffd8', groundBody: '#1b3854', accent: '#8ef7c8' }
      ]
    },
    {
      mainKind: 'hell', platKind: 'hell', basinKind: 'hell', sancKind: 'hell',
      barStyle1: 'hell', barStyle2: 'hell', barStyle3: 'hell',
      propKind: 'hellSpire', mistStyle: 'lava',
      pool: ['slime', 'shadow_dasher', 'prism_turret', 'knight'],
      midBossClass: 'creature', midBossKind: 'malakor',
      midBossName: 'Malakor, Abyssal Dragon · 深淵焰龍',
      humanBossKind: 'human_jk', humanBossName: 'Mika, High School Club Captain · 水手服女高中生',
      territories: [
        { id: 'ember_gate', name: 'Crimson Dream-Hell', sub: '緋紅夢獄 · 黑曜焦土', startX: 0, endX: 3780, skyTop: '#1e0818', skyMid: '#591636', skyBot: '#d9546c', hillFar: '#3d0e28', hillNear: '#6e1c42', groundTop: '#ff8ea8', groundBody: '#2e1022', accent: '#ffcf70' },
        { id: 'dragon_pit', name: 'Abyssal Dragon Crater', sub: '深淵焰龍穴 · 墜星龍影', startX: 3780, endX: 8720, skyTop: '#120414', skyMid: '#420d36', skyBot: '#cc3f78', hillFar: '#2b0829', hillNear: '#571347', groundTop: '#ff7db4', groundBody: '#240b24', accent: '#ffe484' },
        { id: 'magma_basin', name: 'Magma Starlight Basin', sub: '煉星熔盆 · 深淵精銳', startX: 8720, endX: 14340, skyTop: '#170612', skyMid: '#4f1224', skyBot: '#e8684d', hillFar: '#360b1c', hillNear: '#69192b', groundTop: '#ffaa70', groundBody: '#290d1a', accent: '#ffe07d' },
        { id: 'jk_gym', name: 'After-School Hell Gym', sub: '放學煉獄社辦 · 水手服女高中生美佳', startX: 14340, endX: 15700, skyTop: '#240514', skyMid: '#69122c', skyBot: '#f06c58', hillFar: '#470c22', hillNear: '#7d1b33', groundTop: '#ff9e78', groundBody: '#330c1c', accent: '#ffe07d' }
      ]
    }
  ];

  function createLevel(mapIndex = 0) {
    const idx = SR.clamp(mapIndex, 0, SR.MAPS.length - 1);
    const meta = SR.MAPS[idx];
    const lvl = buildComplexMap(MAP_CONFIGS[idx], idx);
    lvl.meta = meta;
    lvl.mapIndex = idx;
    lvl.getTerritoryAt = function (x) {
      for (const t of this.territories) {
        if (x >= t.startX && x < t.endX) return t;
      }
      return this.territories[this.territories.length - 1];
    };
    return lvl;
  }

  SR.createLevel = createLevel;
})(window.SR);
