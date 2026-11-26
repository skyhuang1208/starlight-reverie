// 5 Progressive 2x-Length Handcrafted Maps (~12,440px each)
// Smoothed vertical height profile (ground y=450..585, max adjacent step <= 65px),
// engaging optional aerial bar/cloud routes (y >= 320, zero HUD overlap),
// auto-grounded enemies with exact 2/3 ground (26) vs 1/3 flying (13) ratio,
// 5 scarce 小頭目, and exactly 2 bosses per stage (Mid Animal Boss -> Final Human Boss).
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

    // Subtle per-stage height rhythm offset (-6..+6px) for variety while preserving smooth steps
    const vOff = [-4, 4, -6, 2, -2][stageIndex] || 0;
    const cloudSpdMult = 1 + stageIndex * 0.05;

    const addStarRow = (x, y, n, step = 45) => {
      for (let i = 0; i < n; i++) pickups.push({ x: x + i * step, y, kind: 'star' });
    };

    // Helper: find supporting floor solid at worldX
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

    // Auto-grounded enemy placement: clamps patrol strictly inside supporting solid (zero floating/cliff drops!)
    const addGroundEnemy = (type, x, maxHalfSpan = 190) => {
      const arch = (SR.ENEMY_ARCHETYPES && SR.ENEMY_ARCHETYPES[type]) || { w: 40, h: 44 };
      const sol = findSupportingSolid(x);
      const surfY = sol ? sol.y : 560;
      const pMin = sol ? Math.max(sol.x + 12, x - maxHalfSpan) : x - maxHalfSpan;
      const pMax = sol ? Math.min(sol.x + sol.w - 12, x + maxHalfSpan) : x + maxHalfSpan;
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

    // ===== SECTION 1: SMOOTH OPENING, SLIDE ARCHES & STEPPED CREST (0 - 2380) =====
    solids.push({ x: -80, y: 560, w: 1220, h: 190, kind: kMain });
    solids.push({ x: 310, y: 515, w: 170, h: 65, kind: kPlat }); // Δ45px gentle step (anchored into ground)
    solids.push({ x: 640, y: 444, w: 210, h: 80, kind: 'arch', hint: '▼ SLIDE' }); // 36px clearance above 560
    bars.push({ x: 410, y: 430, w: 165, style: b1 });
    bars.push({ x: 650, y: 370, w: 185, style: b1 });
    bars.push({ x: 915, y: 465, w: 165, style: b1 });
    addStarRow(690, 542, 3);
    addStarRow(450, 395, 3);

    // Gentle stepped climb + split high/low canyon with stepped exit
    const s1Step1 = 510 + vOff;
    const s1Crest = 460 + vOff;
    solids.push({ x: 1140, y: s1Step1, w: 340, h: 240, kind: kPlat }); // Δ50px
    solids.push({ x: 1480, y: s1Crest, w: 360, h: 290, kind: kPlat }); // Δ50px
    solids.push({ x: 1560, y: s1Crest - 116, w: 185, h: 80, kind: 'arch', hint: '▼ SLIDE' }); // exact 36px clearance
    solids.push({ x: 1840, y: 575, w: 540, h: 170, kind: kBasin });
    solids.push({ x: 2210, y: 518, w: 170, h: 80, kind: kPlat }); // Δ57px exit terrace (anchored flush)
    bars.push({ x: 1210, y: s1Step1 - 95, w: 165, style: b2 });
    bars.push({ x: 1895, y: 485, w: 145, style: b2 });
    bars.push({ x: 2105, y: 425, w: 145, style: b2 });
    movingPlatforms.push({ x: 1920, y: 380, w: 140, startX: 1885, endX: 2180, startY: 380, endY: 360, speed: 0.85 * cloudSpdMult, phase: 0 });
    addStarRow(1605, s1Crest - 18, 2);
    pickups.push({ x: 1695, y: s1Crest - 18, kind: 'heart' });

    // ===== SECTION 2: HIGH CREST PLATEAU & GENTLE BASIN #1 (2380 - 4600) =====
    const s2Crest = 460 + vOff; // Δ58px up from 518 exit terrace!
    solids.push({ x: 2380, y: s2Crest, w: 680, h: 290, kind: kPlat });
    bars.push({ x: 2490, y: s2Crest - 100, w: 175, style: b2 });
    bars.push({ x: 2770, y: s2Crest - 100, w: 175, style: b2 });
    addStarRow(2530, s2Crest - 135, 3);

    // Smooth descending terraces into Basin #1 (y=585) with raised islets & exit step
    solids.push({ x: 3060, y: 515, w: 220, h: 235, kind: kBasin });
    solids.push({ x: 3280, y: 555, w: 200, h: 195, kind: kBasin });
    solids.push({ x: 3480, y: 585, w: 1120, h: 165, kind: kBasin });
    solids.push({ x: 3740, y: 535, w: 180, h: 72, kind: kBasin });
    solids.push({ x: 4140, y: 530, w: 190, h: 77, kind: kBasin });
    solids.push({ x: 4445, y: 545, w: 155, h: 62, kind: kPlat }); // Δ40px step up toward CP1 (525)!
    bars.push({ x: 3555, y: 470, w: 180, style: b2 });
    bars.push({ x: 3825, y: 395, w: 185, style: b2 });
    bars.push({ x: 4080, y: 455, w: 175, style: b2 });
    bars.push({ x: 4310, y: 395, w: 175, style: b2 });
    movingPlatforms.push({ x: 3420, y: 390, w: 135, startX: 3340, endX: 3640, startY: 390, endY: 390, speed: 0.9 * cloudSpdMult, phase: 1.0 });
    addStarRow(3870, 360, 3);
    pickups.push({ x: 4390, y: 360, kind: 'heart' });

    // ===== SECTION 3: CHECKPOINT 1 & ANIMAL MID-BOSS ARENA (4600 - 6280) =====
    solids.push({ x: 4600, y: 525, w: 460, h: 225, kind: kSanc });
    checkpoints.push({ id: 'cp1', x: 4720, y: 525, label: 'Challenger Gate', activated: false });
    pickups.push({ x: 4820, y: 495, kind: 'heart' });

    solids.push({ x: 5060, y: 575, w: 1220, h: 180, kind: kSanc });
    bars.push({ x: 5220, y: 475, w: 175, style: b3 });
    bars.push({ x: 5570, y: 390, w: 190, style: b3 });
    bars.push({ x: 5930, y: 475, w: 175, style: b3 });

    // ===== SECTION 4: POST-MID-BOSS SMOOTH ASCENT & TWIN-TIER CANYON (6280 - 8820) =====
    const s4Mid = 468 + vOff;
    const s4Crest = 450 + vOff;
    solids.push({ x: 6280, y: 520, w: 420, h: 230, kind: kPlat }); // Δ55px from 575 arena!
    checkpoints.push({ id: 'cp2', x: 6410, y: 520, label: 'Midway Crest', activated: false });
    pickups.push({ x: 6510, y: 490, kind: 'heart' });

    solids.push({ x: 6700, y: s4Mid, w: 380, h: 282, kind: kPlat }); // Δ52px
    solids.push({ x: 6790, y: s4Mid - 116, w: 185, h: 80, kind: 'arch', hint: '▼ SLIDE' });
    solids.push({ x: 7080, y: 575, w: 680, h: 175, kind: kBasin });
    solids.push({ x: 7575, y: 525, w: 185, h: 72, kind: kPlat }); // Δ50px exit step out of canyon!
    solids.push({ x: 7760, y: 480 + vOff, w: 440, h: 270, kind: kPlat }); // Δ45px
    solids.push({ x: 8200, y: s4Crest, w: 620, h: 300, kind: kPlat }); // Δ30px
    solids.push({ x: 8390, y: s4Crest - 116, w: 190, h: 80, kind: 'arch', hint: '▼ SLIDE' });

    bars.push({ x: 6590, y: 410, w: 155, style: b2 });
    bars.push({ x: 7140, y: 480, w: 165, style: b2 });
    bars.push({ x: 7360, y: 405, w: 175, style: b2 });
    bars.push({ x: 7555, y: 465, w: 165, style: b2 });
    bars.push({ x: 7860, y: 385, w: 175, style: b2 });
    bars.push({ x: 8620, y: 355, w: 155, style: b2 });
    movingPlatforms.push({ x: 7220, y: 355, w: 140, startX: 7120, endX: 7560, startY: 355, endY: 340, speed: 0.92 * cloudSpdMult, phase: 0.4 });
    addStarRow(6835, s4Mid - 18, 3);
    addStarRow(8435, s4Crest - 18, 2);
    pickups.push({ x: 8530, y: s4Crest - 18, kind: 'heart' });

    // ===== SECTION 5: SECOND GENTLE BASIN GAUNTLET (8820 - 10560) =====
    solids.push({ x: 8820, y: 515, w: 220, h: 235, kind: kBasin });
    solids.push({ x: 9040, y: 585, w: 1520, h: 165, kind: kBasin });
    solids.push({ x: 9360, y: 535, w: 190, h: 72, kind: kBasin });
    solids.push({ x: 9880, y: 530, w: 210, h: 77, kind: kBasin });
    solids.push({ x: 10405, y: 545, w: 155, h: 62, kind: kPlat }); // Δ40px exit step toward CP3 (520)!
    bars.push({ x: 9120, y: 475, w: 185, style: b2 });
    bars.push({ x: 9420, y: 400, w: 190, style: b2 });
    bars.push({ x: 9700, y: 460, w: 175, style: b2 });
    bars.push({ x: 10020, y: 395, w: 185, style: b2 });
    bars.push({ x: 10265, y: 465, w: 175, style: b2 });
    movingPlatforms.push({ x: 9660, y: 345, w: 140, startX: 9540, endX: 9960, startY: 345, endY: 345, speed: 1.0 * cloudSpdMult, phase: 1.8 });
    addStarRow(9465, 365, 3);
    pickups.push({ x: 10095, y: 360, kind: 'heart' });

    // ===== SECTION 6: CHECKPOINT 3, VANGUARD & HUMAN FINAL BOSS SANCTUARY (10560 - 12460) =====
    solids.push({ x: 10560, y: 520, w: 620, h: 230, kind: kSanc });
    checkpoints.push({ id: 'cp3', x: 10680, y: 520, label: 'Sanctuary Gate', activated: false });
    pickups.push({ x: 10770, y: 490, kind: 'heart' });
    pickups.push({ x: 10820, y: 490, kind: 'heart' });
    bars.push({ x: 10880, y: 425, w: 170, style: b3 });

    solids.push({ x: 11180, y: 575, w: 1280, h: 180, kind: kSanc });
    solids.push({ x: 12440, y: 0, w: 80, h: 720, kind: 'wall' });
    bars.push({ x: 11340, y: 475, w: 180, style: b3 });
    bars.push({ x: 11710, y: 390, w: 195, style: b3 });
    bars.push({ x: 12080, y: 475, w: 180, style: b3 });

    // ===== AUTO-GROUNDED ENEMY ROSTER: EXACT 2/3 GROUND (26) vs 1/3 FLYING (13) = 39 TOTAL =====
    // Section 1: 6 ground + 3 flying
    addGroundEnemy(p[0], 545, 90);
    addGroundEnemy(p[1], 975, 130);
    addGroundEnemy(p[2], 1305, 145);
    addGroundEnemy(p[0], 1765, 130);
    addGroundEnemy(p[3], 2015, 155);
    addGroundEnemy(p[1], 2285, 70);
    addFlyingEnemy('wisp', 745, 295, 140);
    addFlyingEnemy('bomber', 1350, 248, 280);
    addFlyingEnemy('wisp', 2190, 295, 150);

    // Section 2: 7 ground (incl. 小頭目 #1 Shiba Samurai) + 3 flying
    addGroundEnemy(p[0], 2560, 160);
    addGroundEnemy('shiba_samurai', 2840, 220);
    addGroundEnemy(p[2], 3165, 90);
    addGroundEnemy(p[1], 3615, 115);
    addGroundEnemy(p[3], 4025, 100);
    addGroundEnemy(p[2], 4235, 80);
    addGroundEnemy(p[0], 4385, 60);
    addFlyingEnemy('wisp', 3710, 315, 160);
    addFlyingEnemy('bomber', 3970, 245, 360);
    addFlyingEnemy('wisp', 4420, 305, 140);

    // Section 4: 7 ground (incl. 小頭目 #2 Corgi Skater & 小頭目 #3 Stuff-Throwing Cat) + 3 flying
    addGroundEnemy(p[1], 6600, 110);
    addGroundEnemy(p[2], 7000, 120);
    addGroundEnemy(p[0], 7210, 120);
    addGroundEnemy('corgi_skater', 7430, 210);
    addGroundEnemy(p[3], 7950, 175);
    addGroundEnemy(p[1], 8310, 85);
    addGroundEnemy('cat_thrower', 8670, 195);
    addFlyingEnemy('wisp', 7345, 290, 160);
    addFlyingEnemy('bomber', 7580, 245, 300);
    addFlyingEnemy('wisp', 8065, 285, 160);

    // Section 5: 5 ground (incl. 小頭目 #4 Delivery Scooter) + 3 flying
    addGroundEnemy(p[0], 8930, 90);
    addGroundEnemy(p[2], 9215, 130);
    addGroundEnemy(p[3], 9690, 155);
    addGroundEnemy(p[1], 9985, 90);
    addGroundEnemy('delivery_scooter', 10240, 165);
    addFlyingEnemy('wisp', 9380, 310, 160);
    addFlyingEnemy('bomber', 9780, 248, 380);
    addFlyingEnemy('wisp', 10325, 305, 150);

    // Section 6 Vanguard: 1 ground (小頭目 #5 Shiba Samurai) + 1 flying
    addGroundEnemy('shiba_samurai', 10995, 165);
    addFlyingEnemy('wisp', 11045, 305, 120);

    // Rich Decorative Props auto-grounded to terrain surfaces
    const propKind = cfg.propKind;
    [150, 560, 1040, 1420, 2450, 2960, 3550, 4410, 6340, 6990, 7820, 8740, 9120, 10360].forEach((px, idx) => {
      const sol = findSupportingSolid(px);
      const py = sol ? sol.y : 560;
      if (propKind === 'tree') {
        props.push({ kind: idx % 3 === 1 ? 'lantern' : 'tree', x: px, y: py, scale: 0.92 + (idx % 3) * 0.12, hue: ['pink', 'mint', 'lavender'][idx % 3] });
      } else {
        props.push({ kind: idx % 3 === 1 ? 'lantern' : propKind, x: px, y: py, h: 100 + (idx % 3) * 16 });
      }
    });
    // Sanctuary Arches in BOTH Boss Arenas
    [5160, 5660, 6160, 11300, 11800, 12300].forEach((ax) => {
      props.push({ kind: 'sanctuaryArch', x: ax, y: 575 });
    });

    // Exactly 2 Boss Arenas per Stage: Mid = Animal/Creature Boss, Final = Human Boss
    const bossArenas = {
      midboss: {
        id: 'midboss',
        bossClass: cfg.midBossClass,
        bossKind: cfg.midBossKind,
        variant: cfg.midBossVariant || 'dewdrop',
        triggerX: 5210,
        minX: 5080,
        maxX: 6260,
        spawnX: 5980,
        spawnY: cfg.midBossClass === 'golem' ? 489 : 310, // Grounded flush on y=575 (575-86=489)
        defeated: false,
        active: false,
        name: cfg.midBossName
      },
      finalboss: {
        id: 'finalboss',
        bossClass: 'human',
        bossKind: cfg.humanBossKind,
        triggerX: 11330,
        minX: 11200,
        maxX: 12420,
        spawnX: 12100,
        spawnY: 501, // Grounded flush on y=575 (575-74=501)
        defeated: false,
        active: false,
        name: cfg.humanBossName
      }
    };

    return {
      width: 12440,
      height: 680,
      spawn: { x: 90, y: 560 },
      territories: cfg.territories,
      solids,
      bars,
      movingPlatforms,
      basinMist: { x: 3480, y: 570, w: 1120, h: 22, style: cfg.mistStyle },
      basinMist2: { x: 9040, y: 570, w: 1520, h: 22, style: cfg.mistStyle },
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
        { id: 'meadow', name: 'Pastel Meadow', sub: '花夢草原 · 橫桿與結晶拱門', startX: 0, endX: 2380, skyTop: '#4c3575', skyMid: '#9a68b2', skyBot: '#ffd2d7', hillFar: '#7d5aa6', hillNear: '#a884d4', groundTop: '#8fe6cb', groundBody: '#5d478a', accent: '#ffbae0' },
        { id: 'plateau', name: 'Skyglass Plateau', sub: '雲璃高原 · 浮雲與柴犬武士', startX: 2380, endX: 5060, skyTop: '#313d7c', skyMid: '#7482cc', skyBot: '#f8d8c4', hillFar: '#5a6cb5', hillNear: '#8b9ee0', groundTop: '#b7f3ff', groundBody: '#4c5794', accent: '#ffe599' },
        { id: 'bunny_glade', name: 'Dewdrop Bunny Shrine', sub: '露晶兔聖壇 · 守護偶考驗', startX: 5060, endX: 8820, skyTop: '#263a70', skyMid: '#5a7fc2', skyBot: '#b8f2eb', hillFar: '#40609c', hillNear: '#6994d4', groundTop: '#9cf5e3', groundBody: '#364d85', accent: '#ffe594' },
        { id: 'basin', name: 'Moonlit Basin', sub: '月露深谷 · 幽光盆地', startX: 8820, endX: 11180, skyTop: '#1b2654', skyMid: '#375888', skyBot: '#8fd7d4', hillFar: '#2c4875', hillNear: '#47769b', groundTop: '#8ff2e1', groundBody: '#2b3e68', accent: '#a2fff0' },
        { id: 'sanctuary', name: 'Alleyway Dream Plaza', sub: '夢境巷口 · 巷口阿嬤的領地', startX: 11180, endX: 12500, skyTop: '#331d59', skyMid: '#7d449c', skyBot: '#ffb8d4', hillFar: '#592e78', hillNear: '#8c53b0', groundTop: '#ffc8e6', groundBody: '#422566', accent: '#ffe494' }
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
        { id: 'skybridge', name: 'Skyglass Bridge', sub: '雲端長橋 · 高空橫桿', startX: 0, endX: 3060, skyTop: '#244b85', skyMid: '#68a6db', skyBot: '#fce2c7', hillFar: '#4c7cc2', hillNear: '#7cb1e8', groundTop: '#d4f9ff', groundBody: '#476ba8', accent: '#ffe99c' },
        { id: 'moth_spire', name: 'Dream-Moth Spire', sub: '彩蝶雲塔 · 幻夢彩蝶', startX: 3060, endX: 6700, skyTop: '#293778', skyMid: '#606cc4', skyBot: '#f5b8da', hillFar: '#4954a6', hillNear: '#7482d6', groundTop: '#b4f6ef', groundBody: '#3d4c91', accent: '#9ff6ff' },
        { id: 'tempest_basin', name: 'Tempest Cloud Basin', sub: '流雲盆地 · 稜鏡大軍', startX: 6700, endX: 11180, skyTop: '#20336e', skyMid: '#516db8', skyBot: '#ffd2d9', hillFar: '#3a4f96', hillNear: '#6380cc', groundTop: '#c4f8ff', groundBody: '#364682', accent: '#ffe594' },
        { id: 'aerie', name: 'Skyline Court', sub: '雲端球場 · 熱血體育生主場', startX: 11180, endX: 12500, skyTop: '#1f2559', skyMid: '#584da8', skyBot: '#ffcaa6', hillFar: '#3d3985', hillNear: '#695ec2', groundTop: '#fff0b8', groundBody: '#3d3a7a', accent: '#ffe694' }
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
        { id: 'sakura_grove', name: 'Velvet Sakura Grove', sub: '暮櫻幻林 · 暗影巡行', startX: 0, endX: 3480, skyTop: '#2b1347', skyMid: '#6e2e78', skyBot: '#f29bc0', hillFar: '#4f1e63', hillNear: '#7d378a', groundTop: '#ffb8e4', groundBody: '#3d1e57', accent: '#ffe594' },
        { id: 'seraph_canopy', name: 'Owl-Seraph Canopy', sub: '羽翼林冠 · 天光羽翼', startX: 3480, endX: 7080, skyTop: '#1e1040', skyMid: '#4c2675', skyBot: '#c788e0', hillFar: '#371b61', hillNear: '#603294', groundTop: '#d7b8ff', groundBody: '#2f1a54', accent: '#ff9fd6' },
        { id: 'hollow_basin', name: 'Twilight Mushroom Basin', sub: '幽蕈盆地 · 迷霧伏擊', startX: 7080, endX: 11180, skyTop: '#1a113b', skyMid: '#44246e', skyBot: '#a973d6', hillFar: '#311a57', hillNear: '#58318c', groundTop: '#a3f5dc', groundBody: '#2b1c52', accent: '#d9a8ff' },
        { id: 'trading_floor', name: 'Twilight Trading Floor', sub: '暮光交易大廳 · 當沖股神的K線戰場', startX: 11180, endX: 12500, skyTop: '#12102e', skyMid: '#2a1b54', skyBot: '#8f477e', hillFar: '#211545', hillNear: '#3d256e', groundTop: '#ffe39c', groundBody: '#221740', accent: '#7ef7b8' }
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
        { id: 'ramparts', name: 'Aurora Ramparts', sub: '極光城壁 · 寒冰高台', startX: 0, endX: 3480, skyTop: '#10224a', skyMid: '#265c8c', skyBot: '#a6f0f0', hillFar: '#1e4675', hillNear: '#3b79ab', groundTop: '#d6fcff', groundBody: '#274c7d', accent: '#9cf5ff' },
        { id: 'glacier_court', name: 'Frost-Bunny Bastion', sub: '寒霜兔堡壘 · 冰偶守護', startX: 3480, endX: 7080, skyTop: '#0d1a3d', skyMid: '#23427a', skyBot: '#86c6e8', hillFar: '#1a3263', hillNear: '#335c96', groundTop: '#b8f4ff', groundBody: '#203866', accent: '#d6b8ff' },
        { id: 'ice_basin', name: 'Frozen Mirror Basin', sub: '冰鏡深谷 · 寒霜大軍', startX: 7080, endX: 11180, skyTop: '#0d1a3d', skyMid: '#23427a', skyBot: '#86c6e8', hillFar: '#1a3263', hillNear: '#335c96', groundTop: '#b8f4ff', groundBody: '#203866', accent: '#d6b8ff' },
        { id: 'server_room', name: 'Sub-Zero Server Hall', sub: '極寒機房 · 爆肝工程師凌晨三點加班區', startX: 11180, endX: 12500, skyTop: '#0b1e36', skyMid: '#1b4766', skyBot: '#7ef7c8', hillFar: '#143852', hillNear: '#266180', groundTop: '#a8ffd8', groundBody: '#1b3854', accent: '#8ef7c8' }
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
        { id: 'ember_gate', name: 'Crimson Dream-Hell', sub: '緋紅夢獄 · 黑曜焦土', startX: 0, endX: 3480, skyTop: '#1e0818', skyMid: '#591636', skyBot: '#d9546c', hillFar: '#3d0e28', hillNear: '#6e1c42', groundTop: '#ff8ea8', groundBody: '#2e1022', accent: '#ffcf70' },
        { id: 'dragon_pit', name: 'Abyssal Dragon Crater', sub: '深淵焰龍穴 · 墜星龍影', startX: 3480, endX: 7080, skyTop: '#120414', skyMid: '#420d36', skyBot: '#cc3f78', hillFar: '#2b0829', hillNear: '#571347', groundTop: '#ff7db4', groundBody: '#240b24', accent: '#ffe484' },
        { id: 'magma_basin', name: 'Magma Starlight Basin', sub: '煉星熔盆 · 深淵精銳', startX: 7080, endX: 11180, skyTop: '#170612', skyMid: '#4f1224', skyBot: '#e8684d', hillFar: '#360b1c', hillNear: '#69192b', groundTop: '#ffaa70', groundBody: '#290d1a', accent: '#ffe07d' },
        { id: 'jk_gym', name: 'After-School Hell Gym', sub: '放學煉獄社辦 · 水手服女高中生美佳', startX: 11180, endX: 12500, skyTop: '#240514', skyMid: '#69122c', skyBot: '#f06c58', hillFar: '#470c22', hillNear: '#7d1b33', groundTop: '#ff9e78', groundBody: '#330c1c', accent: '#ffe07d' }
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
