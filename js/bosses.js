// Bosses Module: Buffed, Powerful Multi-Directional Ranged Attacks & Fast Long-Range Dashes!
// - MidBoss (Celes/Frost Bunny Golems)
// - StageBoss (Nyxia, Zephyra, Malakor)
// - HumanBoss: Grandma Lin · Coach Chad · Victor (Stock Trader!) · Kevin (3AM Engineer) · Mika (Super-Buffed High School Girl!)
window.SR = window.SR || {};

(function (SR) {
  // Exact ballistic launch solver: fires projectile from (sx, sy) to hit (tx, ty) in `flightTime` seconds under `gravity`!
  function solveBallistic(sx, sy, tx, ty, gravity, flightTime) {
    const t = Math.max(0.22, flightTime);
    const vx = (tx - sx) / t;
    const vy = (ty - sy - 0.5 * gravity * t * t) / t;
    return { vx, vy };
  }

  // ==================== SHARED BASE BOSS ====================
  class BaseBoss {
    constructor(arena, opts) {
      this.id = SR.nextEntityId();
      this.isBoss = true;
      this.arena = arena;
      this.name = arena.name;
      this.w = opts.w;
      this.h = opts.h;
      this.x = arena.spawnX;
      this.y = arena.spawnY;
      this.vx = 0;
      this.vy = 0;
      this.facing = -1;
      this.hp = opts.hp;
      this.maxHp = opts.hp;
      this.score = opts.score;
      this.phaseThreshold = opts.phaseThreshold ?? 0.55;
      this.phase = 1;
      this.state = opts.initialState || 'idle';
      this.stateTimer = opts.initialTimer ?? 0.75;
      this.patternIndex = 0;
      this.animTime = 0;
      this.hitFlash = 0;
      this.dead = false;
      this.onGround = false;
    }

    get cx() { return this.x + this.w * 0.5; }
    get cy() { return this.y + this.h * 0.5; }

    getHitBurstColors() { return ['#ffe794', '#ff9fd6', '#ffffff']; }
    getPhase2RingColor() { return '#ffe58f'; }
    getPhase2Text() { return 'PHASE II!'; }
    onDeathCleanup() {}

    isAtArenaEdge(margin = 16) {
      return (this.facing > 0 && this.x + this.w >= this.arena.maxX - margin) ||
        (this.facing < 0 && this.x <= this.arena.minX + margin);
    }

    spawnShockwaves(game, color, speed = 380, r = 15, life = 1.75, y = null) {
      const waveY = y !== null ? y : (this.y + this.h - 14);
      [-1, 1].forEach((dir) => {
        game.enemyProjectiles.push({
          kind: 'wave', x: this.cx + dir * 20, y: waveY,
          vx: dir * speed, vy: 0, r, life, color, deflectable: false
        });
      });
    }

    clearSummonedMinions(game) {
      if (!game || !game.enemies) return;
      for (const e of game.enemies) {
        if (e.isBossSummon && !e.dead) {
          e.dead = true;
          SR.particles.spawnRing(e.cx, e.cy, '#ffe894', 44, 0.3);
          SR.particles.spawnBurst(e.cx, e.cy, ['#ffe894', '#9cf5e3', '#ffffff'], 10, {
            speedMin: 40, speedMax: 160, size: 3.8, shape: 'star'
          });
        }
      }
    }

    takeDamage(dmg, hitFromX, isHeavy, game) {
      if (this.dead) return;
      const finalDmg = (game && game.cheats && game.cheats.onePunch) ? 9999 : dmg;
      this.hp -= finalDmg;
      this.hitFlash = 0.12;
      SR.audio.hit(isHeavy);
      SR.particles.spawnBurst(this.cx, this.cy, this.getHitBurstColors(), 9, {
        speedMin: 60, speedMax: 210, size: 4, shape: 'star'
      });
      SR.particles.spawnText(this.cx, this.y - 12, `${finalDmg}`, isHeavy ? '#ffe68f' : '#ffffff', isHeavy ? 1.2 : 1);

      if (this.hp <= this.maxHp * this.phaseThreshold && this.phase === 1) {
        this.phase = 2;
        game.addShake(5);
        SR.audio.bossAlert();
        SR.particles.spawnRing(this.cx, this.cy, this.getPhase2RingColor(), 175, 0.5);
        SR.particles.spawnText(this.cx, this.y - 32, this.getPhase2Text(), '#ffe68f', 1.38);
      }

      if (this.hp <= 0) {
        this.dead = true;
        this.onDeathCleanup(game);
        game.onBossDefeated(this);
      }
    }

    moveArenaBody(dt, level, floating = false, margin = 10) {
      if (this.dropBarTimer > 0) this.dropBarTimer -= dt;
      if (!floating) {
        this.vy = Math.min(880, this.vy + 1450 * dt);
      }
      this.x += this.vx * dt;
      this.x = SR.clamp(this.x, this.arena.minX + margin, this.arena.maxX - this.w - margin);
      const prevBottom = this.y + this.h;
      this.y += this.vy * dt;
      this.onGround = false;
      if (!floating) {
        for (const s of level.solids) {
          if (SR.aabb(this, s) && this.vy >= 0) {
            this.y = s.y - this.h;
            this.vy = 0;
            this.onGround = true;
          }
        }
        if (this.canUseBars && !this.onGround && this.vy >= 0 && (!this.dropBarTimer || this.dropBarTimer <= 0)) {
          for (const bar of level.bars) {
            if (this.x + this.w > bar.x + 6 && this.x < bar.x + bar.w - 6) {
              if (prevBottom <= bar.y + 14 && this.y + this.h >= bar.y) {
                this.y = bar.y - this.h;
                this.vy = 0;
                this.onGround = true;
                break;
              }
            }
          }
        }
      }
    }
  }

  // ==================== MID-BOSS: BUFFED BUNNY GOLEMS ====================
  class MidBoss extends BaseBoss {
    constructor(arena) {
      const variant = arena.variant || 'dewdrop';
      const baseHp = variant === 'pyro' ? 1640 : (variant === 'frost' ? 1360 : 1080);
      const baseScore = variant === 'pyro' ? 5500 : (variant === 'frost' ? 4200 : 2500);
      super(arena, {
        w: 80, h: 86, hp: baseHp,
        score: baseScore,
        phaseThreshold: 0.55, initialState: 'idle', initialTimer: 0.72
      });
      this.type = 'midboss';
      this.variant = variant;
      this.shotsLeft = 0;
      this.shotTick = 0;
    }

    getHitBurstColors() { return ['#9cf5e3', '#ffe794', '#ffffff']; }
    getPhase2RingColor() { return this.variant === 'pyro' ? '#ff8866' : '#9cf5e3'; }

    update(dt, player, level, game) {
      this.animTime += dt;
      if (this.hitFlash > 0) this.hitFlash -= dt;
      this.stateTimer -= dt;
      const tierMult = this.variant === 'pyro' ? 1.16 : (this.variant === 'frost' ? 1.06 : 0.96);
      const speedMult = (this.phase === 2 ? 1.16 : 1.0) * tierMult;
      const projCol = this.variant === 'pyro' ? '#ff8c66' : (this.variant === 'frost' ? '#a6f4ff' : '#9bf5e4');

      if (this.state === 'idle') {
        this.facing = player.cx >= this.cx ? 1 : -1;
        this.vx *= 0.85;
        if (this.stateTimer <= 0) {
          const patterns = ['orbit_volley', 'dash_windup', 'stomp_windup'];
          this.state = patterns[this.patternIndex % patterns.length];
          this.patternIndex++;
          if (this.state === 'stomp_windup') this.stateTimer = 0.52 / speedMult;
          if (this.state === 'orbit_volley') {
            this.stateTimer = 1.45 / speedMult;
            this.shotsLeft = this.phase === 2 ? 4 : 3;
            this.shotTick = 0.25;
          }
          if (this.state === 'dash_windup') this.stateTimer = 0.55 / speedMult;
        }
      } else if (this.state === 'stomp_windup') {
        this.vx = 0;
        if (this.stateTimer <= 0) {
          this.state = 'stomp_air';
          const dir = player.cx >= this.cx ? 1 : -1;
          this.facing = dir;
          this.vx = dir * Math.min(440, Math.abs(player.cx - this.cx) * 1.28);
          this.vy = -630;
          this.stateTimer = 1.4;
        }
      } else if (this.state === 'stomp_air') {
        if ((this.onGround && this.vy >= 0) || this.stateTimer <= 0) {
          game.addShake(5);
          SR.audio.hit(true);
          SR.particles.spawnRing(this.cx, this.y + this.h, projCol, 105, 0.35);
          this.spawnShockwaves(game, projCol, this.phase === 2 ? 400 : 340, 16, 1.8);
          // Multi-directional crystal/frost shards erupting upward on slam!
          const shardCnt = this.phase === 2 ? 4 : 3;
          for (let i = 0; i < shardCnt; i++) {
            const ang = -Math.PI * 0.2 - (Math.PI * 0.6) * (i / Math.max(1, shardCnt - 1));
            game.enemyProjectiles.push({
              kind: 'orb', x: this.cx, y: this.y + 12,
              vx: Math.cos(ang) * 300, vy: Math.sin(ang) * 350,
              gravity: 560, r: 9.5, life: 2.1, color: projCol, deflectable: true
            });
          }
          this.state = 'idle';
          this.stateTimer = 1.05 / speedMult;
          this.vx = 0;
        }
      } else if (this.state === 'orbit_volley') {
        const targetY = 455 + Math.sin(this.animTime * 4) * 16;
        this.vy = (targetY - this.y) * 4;
        this.vx = ((this.arena.minX + this.arena.maxX) * 0.5 - this.cx) * 1.4;
        this.shotTick -= dt;
        if (this.shotTick <= 0 && this.shotsLeft > 0) {
          this.shotsLeft--;
          this.shotTick = this.phase === 2 ? 0.30 : 0.38;
          const ang = Math.atan2(player.cy - this.cy, player.cx - this.cx);
          // Balanced 3-4 way orb fan!
          const fan = this.phase === 2 ? [-0.42, -0.14, 0.14, 0.42] : [-0.28, 0, 0.28];
          fan.forEach((off) => {
            game.enemyProjectiles.push({
              kind: 'orb', x: this.cx + Math.cos(ang + off) * 32, y: this.cy + Math.sin(ang + off) * 32,
              vx: Math.cos(ang + off) * 345, vy: Math.sin(ang + off) * 345,
              r: 10, life: 2.5, color: projCol, deflectable: true
            });
          });
          SR.audio.shoot(false);
        }
        if (this.stateTimer <= 0) {
          this.state = 'idle';
          this.stateTimer = 1.05 / speedMult;
        }
      } else if (this.state === 'dash_windup') {
        this.facing = player.cx >= this.cx ? 1 : -1;
        this.vx = 0;
        if (this.stateTimer <= 0) {
          // Fast Long-Range Arena Dash!
          this.state = 'dash';
          this.stateTimer = 1.05;
          this.vx = this.facing * (this.phase === 2 ? 730 : 630);
          SR.audio.slide();
        }
      } else if (this.state === 'dash') {
        if (Math.random() < 0.14) {
          game.enemyProjectiles.push({
            kind: 'orb', x: this.cx, y: this.cy,
            vx: -this.facing * 115, vy: -230, gravity: 560, r: 8.5, life: 1.5, color: projCol, deflectable: true
          });
        }
        if (this.isAtArenaEdge(14) || this.stateTimer <= 0) {
          this.state = 'idle';
          this.stateTimer = 1.05 / speedMult;
          this.vx = 0;
        }
      }

      this.moveArenaBody(dt, level, this.state === 'orbit_volley', 8);
    }
  }

  // ==================== BUFFED CREATURE STAGE BOSSES (Nyxia, Zephyra, Malakor) ====================
  class StageBoss extends BaseBoss {
    constructor(arena) {
      const bossKind = arena.bossKind || 'nyxia';
      const spec = SR.BOSS_SPECS[bossKind] || SR.BOSS_SPECS.nyxia;
      super(arena, {
        w: bossKind === 'malakor' ? 88 : 74,
        h: bossKind === 'malakor' ? 102 : 88,
        hp: spec.hp, score: spec.score,
        phaseThreshold: 0.55, initialState: 'float_idle', initialTimer: 0.75
      });
      this.type = 'finalboss';
      this.bossKind = bossKind;
      this.spec = spec;
      this.targetX = arena.spawnX;
      this.targetY = 300;
      this.meteors = [];
      this.spiralTick = 0;
      this.spiralAngle = 0;
      this.trailTick = 0;
    }

    getHitBurstColors() { return [this.spec.p1, this.spec.p2, '#ffffff']; }
    getPhase2RingColor() { return this.spec.p2; }
    getPhase2Text() { return this.spec.wakeText; }
    onDeathCleanup(game) {
      this.meteors = [];
      this.clearSummonedMinions(game);
    }

    update(dt, player, level, game) {
      this.animTime += dt;
      if (this.hitFlash > 0) this.hitFlash -= dt;
      this.stateTimer -= dt;
      const spd = (this.phase === 2 ? 1.18 : 1.0) * this.spec.spd;

      for (let i = this.meteors.length - 1; i >= 0; i--) {
        const m = this.meteors[i];
        m.warnTimer -= dt;
        if (m.warnTimer <= 0 && !m.fired) {
          m.fired = true;
          game.enemyProjectiles.push({
            kind: 'meteor', x: m.x, y: 40, vx: 0, vy: 700, r: 18, life: 1.4,
            color: this.spec.p2, deflectable: false
          });
        }
        if (m.warnTimer < -0.35) this.meteors.splice(i, 1);
      }

      if (this.state === 'float_idle') {
        this.facing = player.cx >= this.cx ? 1 : -1;
        this.x += (this.targetX - this.x) * Math.min(1, dt * 3.8);
        this.y += (this.targetY + Math.sin(this.animTime * 3.2) * 16 - this.y) * Math.min(1, dt * 3.8);

        if (this.stateTimer <= 0) {
          const seq = this.phase === 2
            ? ['fan_prep', 'sweep_prep', 'meteor_rain', 'spiral_storm', 'summon']
            : ['fan_prep', 'sweep_prep', 'spiral_storm', 'meteor_rain'];
          const next = seq[this.patternIndex % seq.length];
          this.patternIndex++;

          if (next === 'fan_prep') {
            const perches = [
              { x: this.arena.minX + 115, y: 275 },
              { x: (this.arena.minX + this.arena.maxX) * 0.5 - this.w * 0.5, y: 240 },
              { x: this.arena.maxX - 190, y: 275 }
            ];
            const pick = perches[this.patternIndex % perches.length];
            SR.particles.spawnRing(this.cx, this.cy, this.spec.p1, 60, 0.3);
            this.x = pick.x; this.y = pick.y;
            this.targetX = pick.x; this.targetY = pick.y;
            SR.particles.spawnRing(this.cx, this.cy, this.spec.p2, 75, 0.35);
            this.state = 'fan_prep';
            this.stateTimer = 0.52 / spd;
          } else if (next === 'sweep_prep') {
            const onLeft = player.cx > (this.arena.minX + this.arena.maxX) * 0.5;
            this.x = onLeft ? this.arena.minX + 35 : this.arena.maxX - this.w - 35;
            this.y = 468;
            this.facing = onLeft ? 1 : -1;
            SR.particles.spawnRing(this.cx, this.cy, this.spec.p1, 75, 0.32);
            this.state = 'sweep_prep';
            this.stateTimer = 0.55 / spd;
          } else if (next === 'spiral_storm') {
            this.targetX = (this.arena.minX + this.arena.maxX) * 0.5 - this.w * 0.5;
            this.targetY = 260;
            this.state = 'spiral_storm';
            this.stateTimer = this.phase === 2 ? 1.45 : 1.15;
            this.spiralTick = 0.25;
            this.spiralAngle = 0;
          } else if (next === 'meteor_rain') {
            this.targetX = (this.arena.minX + this.arena.maxX) * 0.5 - this.w * 0.5;
            this.targetY = 215;
            this.state = 'meteor_rain';
            this.stateTimer = 1.55;
            this.meteors = [];
            const cnt = this.phase === 2 ? this.spec.meteors + 1 : this.spec.meteors;
            const span = this.arena.maxX - this.arena.minX - 120;
            for (let i = 0; i < cnt; i++) {
              const mx = this.arena.minX + 60 + (span / Math.max(1, cnt - 1)) * i + (Math.random() - 0.5) * 40;
              this.meteors.push({ x: mx, warnTimer: 0.88 + i * 0.09, fired: false });
            }
            SR.audio.bossAlert();
          } else if (next === 'summon') {
            this.state = 'summon';
            this.stateTimer = 0.75;
            this.targetX = (this.arena.minX + this.arena.maxX) * 0.5 - this.w * 0.5;
            this.targetY = 265;
            SR.particles.spawnText(this.cx, this.y - 24, '召喚!', '#ffe894', 1.15);
          }
        }
      } else if (this.state === 'fan_prep') {
        this.facing = player.cx >= this.cx ? 1 : -1;
        if (this.stateTimer <= 0) {
          // Balanced Dual-Speed Petal Fan!
          const count = this.phase === 2 ? (this.bossKind === 'malakor' ? 8 : 7) : 5;
          const baseAng = Math.atan2(player.cy - this.cy, player.cx - this.cx);
          const spread = this.phase === 2 ? 1.55 : 1.20;
          for (let i = 0; i < count; i++) {
            const ang = baseAng - spread * 0.5 + (spread / (count - 1)) * i;
            const pSpd = (i % 2 === 0 ? 355 : 285) * (this.phase === 2 ? 1.08 : 1.0);
            game.enemyProjectiles.push({
              kind: 'petal', x: this.cx, y: this.cy,
              vx: Math.cos(ang) * pSpd, vy: Math.sin(ang) * pSpd,
              r: 10, life: 2.9, color: i % 2 === 0 ? this.spec.p1 : this.spec.p2, deflectable: true
            });
          }
          SR.audio.castMagic();
          this.state = 'float_idle';
          this.stateTimer = 1.05 / spd;
        }
      } else if (this.state === 'spiral_storm') {
        this.x += (this.targetX - this.x) * Math.min(1, dt * 4);
        this.y += (this.targetY - this.y) * Math.min(1, dt * 4);
        this.spiralTick -= dt;
        if (this.spiralTick <= 0) {
          this.spiralTick = this.phase === 2 ? 0.33 : 0.42;
          const arms = this.bossKind === 'malakor' ? 6 : 4;
          this.spiralAngle += 0.36;
          for (let i = 0; i < arms; i++) {
            const ang = this.spiralAngle + (Math.PI * 2 * i) / arms;
            game.enemyProjectiles.push({
              kind: 'orb', x: this.cx, y: this.cy,
              vx: Math.cos(ang) * 260, vy: Math.sin(ang) * 260,
              r: 9, life: 2.8, color: i % 2 === 0 ? this.spec.p1 : this.spec.p2, deflectable: true
            });
          }
          SR.audio.shoot(false);
        }
        if (this.stateTimer <= 0) {
          this.state = 'float_idle';
          this.stateTimer = 1.05 / spd;
        }
      } else if (this.state === 'sweep_prep') {
        if (this.stateTimer <= 0) {
          // Fast Long-Range Full-Arena Sweep!
          this.state = 'sweep';
          this.stateTimer = 1.35;
          this.vx = this.facing * (this.phase === 2 ? 820 : 720);
          this.trailTick = 0.16;
          this.sweepOrbParity = 0;
          SR.audio.slide();
        }
      } else if (this.state === 'sweep') {
        this.x += this.vx * dt;
        this.trailTick -= dt;
        if (this.trailTick <= 0) {
          this.trailTick = this.phase === 2 ? 0.20 : 0.26;
          const dirY = (this.sweepOrbParity++ % 2 === 0) ? -1 : 1;
          game.enemyProjectiles.push({
            kind: 'orb', x: this.cx, y: this.cy,
            vx: -this.facing * 80, vy: dirY * 185, r: 8.5, life: 1.6, color: this.spec.p1, deflectable: true
          });
        }
        if (this.isAtArenaEdge(24) || this.stateTimer <= 0) {
          this.spawnShockwaves(game, this.spec.p1, 385, 16, 1.8, 558);
          this.vx = 0;
          this.targetX = this.x;
          this.targetY = 275;
          this.state = 'float_idle';
          this.stateTimer = 1.05 / spd;
        }
      } else if (this.state === 'meteor_rain') {
        this.x += (this.targetX - this.x) * Math.min(1, dt * 4);
        this.y += (this.targetY - this.y) * Math.min(1, dt * 4);
        if (this.stateTimer <= 0) {
          this.state = 'float_idle';
          this.stateTimer = 1.08 / spd;
        }
      } else if (this.state === 'summon') {
        this.x += (this.targetX - this.x) * Math.min(1, dt * 4);
        this.y += (this.targetY - this.y) * Math.min(1, dt * 4);
        if (this.stateTimer <= 0) {
          const activeMinions = game.enemies.filter((e) => !e.dead && e.isBossSummon).length;
          const aliveElite = game.enemies.some((e) => !e.dead && e.isBossSummon && e.isElite);
          if (activeMinions < 2 && !aliveElite) {
            const eliteMap = { nyxia: 'cat_thrower', zephyra: 'corgi_skater', malakor: 'shiba_samurai' };
            const eliteType = eliteMap[this.bossKind] || 'delivery_scooter';
            const leftX = this.arena.minX + 160;
            const rightX = this.arena.maxX - 210;
            [
              { type: this.spec.minions[0], x: leftX, ringCol: this.spec.p1 },
              { type: eliteType, x: rightX, ringCol: '#ffe58f' }
            ].forEach((cfg) => {
              const minion = new SR.Enemy({
                type: cfg.type, x: cfg.x, y: 525, homeY: 525,
                patrolMin: this.arena.minX + 24, patrolMax: this.arena.maxX - 24
              }, level.meta);
              minion.x = SR.clamp(cfg.x, this.arena.minX + 24, this.arena.maxX - minion.w - 24);
              minion.y = minion.flying ? 310 : (575 - minion.h);
              minion.homeY = minion.y;
              minion.hp = Math.max(24, Math.round(minion.hp * 0.65));
              minion.maxHp = minion.hp;
              minion.isBossSummon = true;
              game.enemies.push(minion);
              SR.particles.spawnRing(minion.cx, minion.cy, minion.isElite ? '#ffe58f' : cfg.ringCol, minion.isElite ? 64 : 48, 0.35);
              if (minion.isElite) {
                SR.particles.spawnText(minion.cx, minion.y - 22, `★ ${minion.displayName} 增援！`, '#ffe894', 1.05);
              }
            });
            SR.audio.castMagic();
          }
          this.state = 'float_idle';
          this.stateTimer = 1.10 / spd;
        }
      }
    }
  }

  const HUMAN_SUMMON_CD = {
    human_grandma: { p1: 23.0, p2: 19.0 },
    human_athlete: { p1: 22.0, p2: 18.0 },
    human_trader: { p1: 23.0, p2: 19.5 },
    human_engineer: { p1: 22.0, p2: 18.5 },
    human_jk: { p1: 21.0, p2: 18.0 }
  };

  // ==================== 5 SUPER-CHARGED HUMAN FINAL BOSSES ====================
  class HumanBoss extends BaseBoss {
    constructor(arena) {
      const bossKind = arena.bossKind || 'human_grandma';
      const spec = SR.HUMAN_BOSS_SPECS[bossKind] || SR.HUMAN_BOSS_SPECS.human_grandma;
      super(arena, {
        w: 56, h: 74, hp: spec.hp, score: spec.score,
        phaseThreshold: 0.55, initialState: 'idle', initialTimer: 0.72
      });
      this.isHumanBoss = true;
      this.type = 'humanboss';
      this.bossKind = bossKind;
      this.spec = spec;

      // Character-specific animation & barrage states
      this.sportMode = 'idle'; // athlete: sport modes; jk: 'sneeze'|'workout'|'cooking'|'idle'; trader: 'bull'|'crash'|'idle'
      this.swingAnim = 0;
      this.pushingWheelchair = false;
      this.typingAnim = 0;
      this.meteors = []; // Sky-falling warning pillars (Engineer errors, Trader stock crashes, Mika sneeze/cooking rain!)
      this.barrageLeft = 0;
      this.barrageTick = 0;
      this.trailTick = 0;
      this.summonCooldown = 9.5;
      this.summonCount = 0;
      this.pendingSummonSpots = [];
      this.canUseBars = true;
      this.moveStrafeDir = -1;
      this.moveStrafeTimer = 0.65;
      this.leapCd = 1.4;
      this.dropBarTimer = 0;
    }

    getHitBurstColors() { return [this.spec.color, '#ffe894', '#ffffff']; }
    getPhase2Text() { return this.spec.wakeText; }

    onDeathCleanup(game) {
      this.meteors = [];
      this.pendingSummonSpots = [];
      this.clearSummonedMinions(game);
    }

    canSummon(game) {
      if (this.summonCooldown > 0 || !game || !game.enemies) return false;
      let aliveMinions = 0;
      let aliveElite = false;
      for (const e of game.enemies) {
        if (!e.dead && e.isBossSummon) {
          aliveMinions++;
          if (e.isElite) aliveElite = true;
        }
      }
      return aliveMinions <= 1 && !aliveElite;
    }

    getArenaFloorY(level) {
      const midX = (this.arena.minX + this.arena.maxX) * 0.5;
      let bestY = this.arena.spawnY + this.h;
      for (const s of level.solids) {
        if (s.kind === 'wall' || s.kind === 'arch') continue;
        if (midX >= s.x && midX <= s.x + s.w) {
          bestY = s.y;
          break;
        }
      }
      return bestY;
    }

    beginSummonSkill(player, level) {
      const cfg = HUMAN_SUMMON_CONFIG[this.bossKind] || HUMAN_SUMMON_CONFIG.human_engineer;
      const floorY = this.getArenaFloorY(level);
      const minX = this.arena.minX + 72;
      const maxX = this.arena.maxX - 72;
      const span = maxX - minX;
      const slots = [0.18, 0.50, 0.82].map((f) => {
        let sx = minX + span * f;
        // Nudge away if directly overlapping the player so summons never cheap-shot on spawn!
        if (Math.abs(sx - player.cx) < 88) {
          sx = SR.clamp(sx + (sx >= player.cx ? 96 : -96), minX, maxX);
        }
        return sx;
      });
      const eliteType = cfg.elites[this.summonCount % cfg.elites.length];
      this.pendingSummonSpots = [
        { type: cfg.soldiers[0], x: slots[0], floorY, isElite: false },
        { type: eliteType,       x: slots[1], floorY, isElite: true },
        { type: cfg.soldiers[1], x: slots[2], floorY, isElite: false }
      ];
      this.state = 'summon_prep';
      this.stateTimer = 0.72;
      this.vx = 0;
      SR.audio.bossAlert();
      SR.particles.spawnRing(this.cx, this.cy, '#ffe894', 110, 0.42);
      SR.particles.spawnText(this.cx, this.y - 26, cfg.callout, '#ffe894', 1.18);
      for (const sp of this.pendingSummonSpots) {
        SR.particles.spawnRing(sp.x, sp.floorY - 24, sp.isElite ? '#ffe58f' : '#9cf5e3', sp.isElite ? 64 : 42, 0.55);
      }
    }

    spawnReinforcements(level, game) {
      const minX = this.arena.minX + 24;
      const maxX = this.arena.maxX - 24;
      for (const sp of this.pendingSummonSpots) {
        const probe = new SR.Enemy({
          type: sp.type,
          x: sp.x - 22,
          y: sp.floorY - 48,
          patrolMin: minX,
          patrolMax: maxX
        }, level.meta);
        probe.x = SR.clamp(sp.x - probe.w * 0.5, minX, maxX - probe.w);
        probe.y = probe.flying ? Math.max(185, sp.floorY - 155) : (sp.floorY - probe.h);
        probe.homeY = probe.y;
        probe.hp = Math.max(24, Math.round(probe.hp * 0.68));
        probe.maxHp = probe.hp;
        probe.isBossSummon = true;
        game.enemies.push(probe);

        SR.particles.spawnRing(probe.cx, probe.cy, probe.isElite ? '#ffe58f' : '#c8a8ff', probe.isElite ? 72 : 44, 0.34);
        SR.particles.spawnBurst(probe.cx, probe.cy, probe.isElite ? ['#ffe58f', '#ff9fd6', '#ffffff'] : ['#9cf5e3', '#ffffff'], probe.isElite ? 14 : 8, {
          speedMin: 50, speedMax: 175, size: 4, shape: 'star'
        });
        if (probe.isElite) {
          SR.particles.spawnText(probe.cx, probe.y - 22, `★ ${probe.displayName} 增援！`, '#ffe894', 1.05);
        }
      }
      this.pendingSummonSpots = [];
      this.summonCount++;
      const cdSpec = HUMAN_SUMMON_CD[this.bossKind] || HUMAN_SUMMON_CD.human_engineer;
      this.summonCooldown = this.phase === 2 ? cdSpec.p2 : cdSpec.p1;
      SR.audio.castMagic();
    }

    queueSkyDrops(count, kind, labels, colors, warnBase = 0.72, speedY = 540, extraProps = null, targetX = null) {
      const minX = this.arena.minX + 52;
      const maxX = this.arena.maxX - 52;
      const span = maxX - minX;
      const xs = [];
      for (let i = 0; i < count; i++) {
        let mx = minX + (span / Math.max(1, count - 1)) * i + (Math.random() - 0.5) * 44;
        if (targetX !== null && i === 0) {
          mx = SR.clamp(targetX + (Math.random() - 0.5) * 28, minX, maxX);
        } else if (targetX !== null && count >= 5 && i === 1) {
          const offset = (this.patternIndex % 2 === 0 ? 1 : -1) * 72;
          mx = SR.clamp(targetX + offset, minX, maxX);
        }
        xs.push(mx);
      }
      for (let i = 0; i < xs.length; i++) {
        this.meteors.push({
          x: xs[i],
          warnTimer: warnBase + i * 0.075,
          fired: false,
          dropKind: kind,
          label: labels ? labels[i % labels.length] : null,
          color: colors ? colors[i % colors.length] : '#ffe58f',
          vy: speedY,
          extra: extraProps ? extraProps(i) : null
        });
      }
    }

    updateActiveMobility(dt, player, level, spd) {
      this.facing = player.cx >= this.cx ? 1 : -1;
      const dx = player.cx - this.cx;
      const dy = player.cy - this.cy;
      const moveSpd = (185 + (this.phase === 2 ? 35 : 0)) * spd;

      this.moveStrafeTimer -= dt;
      if (this.moveStrafeTimer <= 0) {
        this.moveStrafeDir = -this.moveStrafeDir;
        this.moveStrafeTimer = 0.45 + Math.random() * 0.40;
      }

      if (this.onGround && this.leapCd <= 0 && dy < -65) {
        this.vy = player.cy < 430 ? -680 : -580;
        this.vx = SR.clamp(dx * 1.45, -360, 360);
        this.onGround = false;
        this.leapCd = 2.1 / spd;
        if (SR.audio.jump) SR.audio.jump(false);
        SR.particles.spawnRing(this.cx, this.y + this.h, this.spec.color || '#ffe58f', 34, 0.25);
        return;
      }

      if (this.onGround && this.y + this.h < 560 && dy > 65) {
        this.dropBarTimer = 0.30;
        this.onGround = false;
        this.vy = 90;
        return;
      }

      if (Math.abs(dx) > 240) {
        this.vx = Math.sign(dx) * moveSpd;
      } else if (Math.abs(dx) < 110) {
        this.vx = -Math.sign(dx || this.facing) * moveSpd * 0.9;
      } else {
        this.vx = this.moveStrafeDir * moveSpd;
      }
      if (this.x < this.arena.minX + 60) {
        this.vx = Math.abs(moveSpd);
        this.moveStrafeDir = 1;
      } else if (this.x + this.w > this.arena.maxX - 60) {
        this.vx = -Math.abs(moveSpd);
        this.moveStrafeDir = -1;
      }
    }

    update(dt, player, level, game) {
      this.animTime += dt;
      if (this.hitFlash > 0) this.hitFlash -= dt;
      if (this.swingAnim > 0) this.swingAnim -= dt;
      if (this.typingAnim > 0) this.typingAnim -= dt;
      if (this.summonCooldown > 0) this.summonCooldown -= dt;
      if (this.leapCd > 0) this.leapCd -= dt;
      this.stateTimer -= dt;
      const spd = (this.phase === 2 ? 1.10 : 1.0) * this.spec.spd;

      // Unified sky-drop rain system (Engineer Error Rain, Stock Trader Market Crash, Mika Sneeze Rain & Cooking Food Rain!)
      for (let i = this.meteors.length - 1; i >= 0; i--) {
        const m = this.meteors[i];
        m.warnTimer -= dt;
        if (m.warnTimer <= 0 && !m.fired) {
          m.fired = true;
          const proj = {
            kind: m.dropKind || 'error_drop',
            x: m.x,
            y: 36,
            vx: (Math.random() - 0.5) * 45,
            vy: m.vy || 560,
            r: m.dropKind === 'stock_crash' ? 18 : 15,
            life: 1.75,
            color: m.color || '#8ef7c8',
            label: m.label || '',
            deflectable: m.dropKind === 'sky_food' || m.dropKind === 'sky_sneeze' || m.dropKind === 'sky_sport'
          };
          if (m.extra) Object.assign(proj, m.extra);
          game.enemyProjectiles.push(proj);
        }
        if (m.warnTimer < -0.35) this.meteors.splice(i, 1);
      }

      // Shared Human Boss Summon Reinforcements Skill (3 soldiers + 1 小頭目!)
      if (this.state === 'idle' && this.stateTimer <= 0 && this.canSummon(game)) {
        this.beginSummonSkill(player, level);
        this.moveArenaBody(dt, level, false);
        return;
      }
      if (this.state === 'summon_prep') {
        this.facing = player.cx >= this.cx ? 1 : -1;
        this.vx = 0;
        if (Math.random() < 0.45) {
          for (const sp of this.pendingSummonSpots) {
            SR.particles.spawnBurst(sp.x, sp.floorY - 12, sp.isElite ? ['#ffe58f', '#ff9fd6'] : ['#9cf5e3', '#ffffff'], 1, {
              speedMin: 20, speedMax: 85, upward: 75, size: 3.2, shape: 'star'
            });
          }
        }
        if (this.stateTimer <= 0) {
          this.spawnReinforcements(level, game);
          this.state = 'idle';
          this.stateTimer = 1.15 / spd;
        }
        this.moveArenaBody(dt, level, false);
        return;
      }

      const fn = HUMAN_BOSS_AI[this.bossKind] || HUMAN_BOSS_AI.human_engineer;
      fn.call(this, dt, player, level, game, spd);
    }
  }

  const HUMAN_SUMMON_CONFIG = {
    human_grandma: {
      callout: '召喚!',
      soldiers: ['slime', 'knight', 'wisp'],
      elites: ['delivery_scooter', 'corgi_skater']
    },
    human_athlete: {
      callout: '召喚!',
      soldiers: ['knight', 'shadow_dasher', 'bomber'],
      elites: ['corgi_skater', 'shiba_samurai']
    },
    human_trader: {
      callout: '召喚!',
      soldiers: ['prism_turret', 'shadow_dasher', 'wisp'],
      elites: ['cat_thrower', 'delivery_scooter']
    },
    human_engineer: {
      callout: '召喚!',
      soldiers: ['prism_turret', 'knight', 'bomber'],
      elites: ['shiba_samurai', 'cat_thrower']
    },
    human_jk: {
      callout: '召喚!',
      soldiers: ['shadow_dasher', 'knight', 'wisp'],
      elites: ['shiba_samurai', 'cat_thrower', 'corgi_skater', 'delivery_scooter']
    }
  };

  const HUMAN_BOSS_AI = {
    // ==================== 1) 老奶奶 (Grandma Lin — Throw + Dash + Sky Grocery Rain!) ====================
    human_grandma(dt, player, level, game, spd) {
      if (this.state === 'idle') {
        this.pushingWheelchair = false;
        this.updateActiveMobility(dt, player, level, spd);
        if (this.stateTimer <= 0) {
          const seq = ['scold_prep', 'wheelchair_prep', 'market_rain_prep', 'cane_prep'];
          this.state = seq[this.patternIndex % seq.length];
          this.patternIndex++;
          if (this.state === 'scold_prep') {
            this.stateTimer = 0.48 / spd;
            SR.particles.spawnText(this.cx, this.y - 22, '唉唷你這孩子快穿外套！', '#ffe694', 1.05);
          } else if (this.state === 'cane_prep') {
            this.stateTimer = 0.46 / spd;
            SR.particles.spawnText(this.cx, this.y - 22, '拐杖飛燕衝！', '#ff9fd6', 1.05);
          } else if (this.state === 'wheelchair_prep') {
            this.pushingWheelchair = true;
            this.stateTimer = 0.56 / spd;
            SR.particles.spawnText(this.cx, this.y - 22, '渦輪輪椅借過喔！！', '#9cf5e3', 1.18);
          } else if (this.state === 'market_rain_prep') {
            this.stateTimer = 1.25;
            const cnt = this.phase === 2 ? 10 : 8;
            this.queueSkyDrops(
              cnt, 'sky_food', null, ['#ff9fd6', '#ffe58f', '#9cf5e3'], 0.80, 445,
              (idx) => ({ foodType: ['rice_bowl', 'pork_belly', 'pork_knuckle', 'cabbage', 'dumpling', 'red_envelope'][idx % 6] }),
              player.cx
            );
            SR.audio.bossAlert();
            SR.particles.spawnText(this.cx, this.y - 22, '阿嬤辦桌特價雨！！', '#ffe58f', 1.16);
          }
        }
      } else if (this.state === 'market_rain_prep') {
        this.facing = player.cx >= this.cx ? 1 : -1;
        this.vx *= 0.88;
        if (this.stateTimer <= 0) {
          const foods = ['rice_bowl', 'pork_belly', 'pork_knuckle'];
          const count = this.phase === 2 ? 6 : 4;
          const baseAng = Math.atan2(player.cy - this.cy, player.cx - this.cx);
          for (let i = 0; i < count; i++) {
            const ang = baseAng + (i - (count - 1) * 0.5) * 0.21;
            const spdShot = this.phase === 2 ? 430 : 380;
            game.enemyProjectiles.push({
              kind: 'delivery_food', foodType: foods[i % foods.length],
              x: this.cx + this.facing * 20, y: this.cy - 10,
              vx: Math.cos(ang) * spdShot, vy: Math.sin(ang) * spdShot,
              r: 11.5, life: 2.3, color: '#ffe58f', deflectable: true
            });
          }
          this.state = 'idle';
          this.stateTimer = 0.98 / spd;
        }
      } else if (this.state === 'scold_prep') {
        this.facing = player.cx >= this.cx ? 1 : -1;
        this.vx = 0;
        if (this.stateTimer <= 0) {
          // Denser 5-8 Homing Scold Bubble Fan!
          const words = ['不穿外套!', '太晚睡!', '去吃飯!', '滑手機!', '念你喔!', '快喝水!', '多吃菜!'];
          const count = this.phase === 2 ? 8 : 5;
          const base = this.facing > 0 ? -0.25 : Math.PI + 0.25;
          for (let i = 0; i < count; i++) {
            const ang = base + (i - (count - 1) * 0.5) * 0.25;
            game.enemyProjectiles.push({
              kind: 'scold', x: this.cx + this.facing * 24, y: this.cy - 12,
              vx: Math.cos(ang) * 255, vy: Math.sin(ang) * 255 - 40,
              homingPlayer: true, homingTurn: 2.75, homingSpeed: this.phase === 2 ? 260 : 230,
              label: words[(this.patternIndex + i) % words.length],
              r: 13, life: 3.0, color: '#ff9fd6', deflectable: true
            });
          }
          SR.audio.castMagic();
          this.state = 'idle';
          this.stateTimer = 1.00 / spd;
        }
      } else if (this.state === 'cane_prep') {
        this.facing = player.cx >= this.cx ? 1 : -1;
        this.vx = 0;
        if (this.stateTimer <= 0) {
          // Fast Long-Range Cane Dash + Grandma comfort dishes!
          this.state = 'cane_dash';
          this.stateTimer = 1.1;
          this.trailTick = 0.18;
          this.vx = this.facing * (this.phase === 2 ? 690 : 600);
          this.vy = -220;
          SR.audio.slide();
        }
      } else if (this.state === 'cane_dash') {
        this.trailTick -= dt;
        if (this.trailTick <= 0) {
          this.trailTick = this.phase === 2 ? 0.23 : 0.32;
          const foods = ['rice_bowl', 'pork_belly', 'pork_knuckle'];
          game.enemyProjectiles.push({
            kind: 'delivery_food',
            foodType: foods[Math.floor(Math.random() * foods.length)],
            x: this.cx, y: this.y + 8,
            vx: -this.facing * 125, vy: -360, gravity: 780, bounces: 1,
            r: 11, life: 2.2, color: '#ff9fd6', deflectable: true
          });
        }
        if (this.isAtArenaEdge(16) || this.stateTimer <= 0) {
          const floorY = this.getArenaFloorY(level);
          this.spawnShockwaves(game, '#ff9fd6', 350, 15, 1.6, floorY - 14);
          this.vx = 0;
          this.state = 'idle';
          this.stateTimer = 0.98 / spd;
        }
      } else if (this.state === 'wheelchair_prep') {
        this.pushingWheelchair = true;
        this.facing = player.cx >= this.cx ? 1 : -1;
        this.vx = 0;
        if (this.stateTimer <= 0) {
          // Ultra-Fast Full-Arena Turbo Wheelchair Charge!
          this.state = 'wheelchair_dash';
          this.stateTimer = 1.4;
          this.trailTick = 0.14;
          this.vx = this.facing * (this.phase === 2 ? 780 : 680);
          SR.audio.slide();
        }
      } else if (this.state === 'wheelchair_dash') {
        this.pushingWheelchair = true;
        this.trailTick -= dt;
        if (this.trailTick <= 0) {
          this.trailTick = this.phase === 2 ? 0.14 : 0.19;
          // Flings hearty Grandma home-cooking dishes (白飯 / 五花肉 / 滷豬腳 — NO boba!)
          const grandmaDishes = ['rice_bowl', 'pork_belly', 'pork_knuckle'];
          game.enemyProjectiles.push({
            kind: 'delivery_food',
            foodType: grandmaDishes[(this.patternIndex + Math.floor(this.animTime * 10)) % grandmaDishes.length],
            x: this.cx, y: this.y + 8,
            vx: -this.facing * 135, vy: -390, gravity: 780, bounces: 1,
            r: 11.5, life: 2.3, color: '#ffe58f', deflectable: true
          });
        }
        if (this.isAtArenaEdge(16) || this.stateTimer <= 0) {
          this.vx = 0;
          this.pushingWheelchair = false;
          this.state = 'idle';
          this.stateTimer = 0.98 / spd;
        }
      }
      this.moveArenaBody(dt, level, false);
    },

    // ==================== 2) 熱血體育生 (Coach Chad — Throw + Dash + Sky Sports Ball Rain!) ====================
    human_athlete(dt, player, level, game, spd) {
      if (this.state === 'idle') {
        this.sportMode = 'idle';
        this.updateActiveMobility(dt, player, level, spd);
        if (this.stateTimer <= 0) {
          const seq = ['badminton_jump', 'sky_serve_prep', 'tennis_prep', 'basketball_prep', 'sprint_prep'];
          this.state = seq[this.patternIndex % seq.length];
          this.patternIndex++;
          if (this.state === 'badminton_jump') {
            this.sportMode = 'badminton';
            this.vy = -610;
            this.vx = this.facing * 145;
            this.stateTimer = 0.42;
            SR.audio.jump(true);
            SR.particles.spawnText(this.cx, this.y - 22, '連環羽球殺球！！', '#ffffff', 1.1);
          } else if (this.state === 'sky_serve_prep') {
            this.sportMode = 'basketball';
            this.stateTimer = 1.25;
            this.swingAnim = 0.4;
            const cnt = this.phase === 2 ? 10 : 8;
            this.queueSkyDrops(
              cnt, 'sky_sport', null, ['#ff964f', '#c4ff6b', '#ffffff'], 0.78, 490,
              (idx) => ({ sportBall: ['basketball', 'tennis', 'shuttlecock', 'volleyball'][idx % 4] }),
              player.cx
            );
            SR.audio.bossAlert();
            SR.particles.spawnText(this.cx, this.y - 22, '高空魔球發球雨！！', '#ffe58f', 1.16);
          } else if (this.state === 'tennis_prep') {
            this.sportMode = 'tennis';
            this.stateTimer = 0.48 / spd;
            SR.particles.spawnText(this.cx, this.y - 22, '網球重砲齊發！', '#b8ff78', 1.1);
          } else if (this.state === 'basketball_prep') {
            this.sportMode = 'basketball';
            this.stateTimer = 0.48 / spd;
            SR.particles.spawnText(this.cx, this.y - 22, '全場三分雨！！', '#ffaa66', 1.1);
          } else if (this.state === 'sprint_prep') {
            this.sportMode = 'sprint';
            this.stateTimer = 0.50 / spd;
            SR.particles.spawnText(this.cx, this.y - 22, '超音速百米衝刺！！', '#ffe58f', 1.15);
          }
        }
      } else if (this.state === 'sky_serve_prep') {
        this.facing = player.cx >= this.cx ? 1 : -1;
        this.vx *= 0.88;
        if (this.stateTimer <= 0) {
          const count = this.phase === 2 ? 6 : 4;
          const baseAng = Math.atan2(player.cy - this.cy, player.cx - this.cx);
          for (let i = 0; i < count; i++) {
            const ang = baseAng + (i - (count - 1) * 0.5) * 0.21;
            const spdShot = this.phase === 2 ? 465 : 415;
            game.enemyProjectiles.push({
              kind: 'tennis', x: this.cx + this.facing * 22, y: this.cy - 6,
              vx: Math.cos(ang) * spdShot, vy: Math.sin(ang) * spdShot,
              r: 9.5, life: 2.2, color: '#c4ff6b', deflectable: true
            });
          }
          SR.audio.shoot(true);
          this.state = 'idle';
          this.stateTimer = 0.98 / spd;
        }
      } else if (this.state === 'badminton_jump') {
        this.facing = player.cx >= this.cx ? 1 : -1;
        if (this.stateTimer <= 0) {
          this.swingAnim = 0.35;
          const baseAng = Math.atan2(player.cy - this.cy, player.cx - this.cx);
          const count = this.phase === 2 ? 10 : 8;
          for (let i = 0; i < count; i++) {
            const ang = baseAng + (i - (count - 1) * 0.5) * 0.18;
            const s = (i % 2 === 0 ? 465 : 385) * (this.phase === 2 ? 1.07 : 1.0);
            game.enemyProjectiles.push({
              kind: 'shuttlecock', x: this.cx + this.facing * 20, y: this.cy - 10,
              vx: Math.cos(ang) * s, vy: Math.sin(ang) * s,
              r: 9, life: 2.2, color: '#ffffff', deflectable: true
            });
          }
          SR.audio.slash(2);
          this.state = 'idle';
          this.stateTimer = 0.98 / spd;
        }
      } else if (this.state === 'tennis_prep') {
        this.facing = player.cx >= this.cx ? 1 : -1;
        this.vx = 0;
        if (this.stateTimer <= 0) {
          this.swingAnim = 0.35;
          const count = this.phase === 2 ? 9 : 6;
          const baseAng = Math.atan2(player.cy - this.cy, player.cx - this.cx);
          for (let i = 0; i < count; i++) {
            const ang = baseAng + (i - (count - 1) * 0.5) * 0.16;
            game.enemyProjectiles.push({
              kind: 'tennis', x: this.cx + this.facing * 24, y: this.cy - 4,
              vx: Math.cos(ang) * (this.phase === 2 ? 505 : 445),
              vy: Math.sin(ang) * (this.phase === 2 ? 505 : 445),
              r: 9.5, life: 2.3, color: '#c4ff6b', deflectable: true
            });
          }
          SR.audio.shoot(true);
          this.state = 'idle';
          this.stateTimer = 0.98 / spd;
        }
      } else if (this.state === 'basketball_prep') {
        this.facing = player.cx >= this.cx ? 1 : -1;
        this.vx = 0;
        if (this.stateTimer <= 0) {
          this.swingAnim = 0.35;
          this.vy = -300;
          const count = this.phase === 2 ? 7 : 5;
          for (let i = 0; i < count; i++) {
            const speedX = (130 + i * 76) * this.facing;
            game.enemyProjectiles.push({
              kind: 'basketball', x: this.cx + this.facing * 18, y: this.cy - 18,
              vx: speedX, vy: -345 - i * 36, gravity: 820, bounces: 2,
              r: 13.5, life: 3.1, color: '#ff964f', deflectable: true
            });
          }
          SR.audio.jump(false);
          this.state = 'idle';
          this.stateTimer = 1.00 / spd;
        }
      } else if (this.state === 'sprint_prep') {
        this.facing = player.cx >= this.cx ? 1 : -1;
        this.vx = 0;
        if (this.stateTimer <= 0) {
          // Ultra-Fast Long-Range 100m Sprint Dash!
          this.state = 'sprint_dash';
          this.stateTimer = 1.3;
          this.trailTick = 0.15;
          this.vx = this.facing * (this.phase === 2 ? 800 : 710);
          SR.audio.slide();
        }
      } else if (this.state === 'sprint_dash') {
        this.trailTick -= dt;
        if (this.trailTick <= 0) {
          this.trailTick = this.phase === 2 ? 0.15 : 0.19;
          game.enemyProjectiles.push({
            kind: 'tennis', x: this.cx, y: this.cy - 6,
            vx: -this.facing * 110, vy: -320, gravity: 560,
            r: 9, life: 1.9, color: '#c4ff6b', deflectable: true
          });
        }
        if (this.isAtArenaEdge(16) || this.stateTimer <= 0) {
          const floorY = this.getArenaFloorY(level);
          this.spawnShockwaves(game, '#ffe58f', this.phase === 2 ? 380 : 330, 15, 1.55, floorY - 14);
          this.vx = 0;
          this.state = 'idle';
          this.stateTimer = 0.98 / spd;
        }
      }
      this.moveArenaBody(dt, level, false);
    },

    // ==================== 3) NEW BOSS: 當沖股神 (Victor, Day-Trading Wolf — Replaces Sadako!) ====================
    // Skills:
    //  1. K-Line Candlestick Barrage (multi-directional Red & Green K-bars!)
    //  2. Limit-Down Market Crash (giant crashing -10% / 跌停 arrows falling from sky + sell bolts!)
    //  3. Bull-Run Breakout Dash (ultra-fast long-range full-arena dash trailing upward green/red K-bars!)
    //  4. Short-Squeeze Tracking Orders (homing BUY/SELL/ALL-IN order tickets from multiple angles!)
    human_trader(dt, player, level, game, spd) {
      if (this.state === 'idle') {
        this.sportMode = 'idle';
        this.updateActiveMobility(dt, player, level, spd);
        if (this.stateTimer <= 0) {
          const seq = ['kline_prep', 'bull_dash_prep', 'crash_prep', 'orders_prep'];
          this.state = seq[this.patternIndex % seq.length];
          this.patternIndex++;
          if (this.state === 'kline_prep') {
            this.sportMode = 'kline';
            this.stateTimer = 0.56 / spd;
            if (SR.audio.stockBell) SR.audio.stockBell();
            SR.particles.spawnText(this.cx, this.y - 24, 'K線多空雙殺！！', '#ff6b78', 1.12);
          } else if (this.state === 'crash_prep') {
            this.sportMode = 'crash';
            this.stateTimer = 1.45;
            const cnt = this.phase === 2 ? 9 : 7;
            this.queueSkyDrops(cnt, 'stock_crash', ['-10%', '跌停!', 'MARGIN', '斷頭!', '-9.9%', '崩盤!'], ['#52f29b', '#ff6b78'], 0.88, 570, null, player.cx);
            SR.audio.bossAlert();
            SR.particles.spawnText(this.cx, this.y - 24, '大盤崩盤・跌停瀑布！！', '#52f29b', 1.18);
          } else if (this.state === 'bull_dash_prep') {
            this.sportMode = 'bull';
            this.stateTimer = 0.60 / spd;
            SR.particles.spawnText(this.cx, this.y - 24, '漲停鎖死・暴力突破！！', '#ffe58f', 1.15);
          } else if (this.state === 'orders_prep') {
            this.sportMode = 'orders';
            this.stateTimer = 0.58 / spd;
            if (SR.audio.stockBell) SR.audio.stockBell();
            SR.particles.spawnText(this.cx, this.y - 24, 'ALL-IN 軋空委託單！', '#9cf5e3', 1.1);
          }
        }
      } else if (this.state === 'kline_prep') {
        this.facing = player.cx >= this.cx ? 1 : -1;
        this.vx = 0;
        if (this.stateTimer <= 0) {
          // Denser 8-10 Red & Green K-Line Candlesticks fan!
          this.swingAnim = 0.35;
          const count = this.phase === 2 ? 10 : 8;
          const baseAng = Math.atan2(player.cy - this.cy, player.cx - this.cx);
          const spread = this.phase === 2 ? 1.80 : 1.45;
          for (let i = 0; i < count; i++) {
            const ang = baseAng - spread * 0.5 + (spread / (count - 1)) * i;
            const isBull = i % 2 === 0;
            const pSpd = (isBull ? 390 : 325) * (this.phase === 2 ? 1.06 : 1.0);
            game.enemyProjectiles.push({
              kind: 'candlestick',
              bull: isBull,
              x: this.cx + this.facing * 20,
              y: this.cy - 10,
              vx: Math.cos(ang) * pSpd,
              vy: Math.sin(ang) * pSpd,
              r: 11,
              life: 2.5,
              color: isBull ? '#ff5c74' : '#4df29c',
              deflectable: true
            });
          }
          SR.audio.shoot(true);
          this.state = 'idle';
          this.stateTimer = 1.24 / spd;
        }
      } else if (this.state === 'crash_prep') {
        this.facing = player.cx >= this.cx ? 1 : -1;
        this.vx *= 0.88;
        if (this.stateTimer <= 0) {
          // Sweeps 5-7 aimed sell-off candlesticks!
          const count = this.phase === 2 ? 7 : 5;
          const baseAng = Math.atan2(player.cy - this.cy, player.cx - this.cx);
          for (let i = 0; i < count; i++) {
            const ang = baseAng + (i - (count - 1) * 0.5) * 0.17;
            game.enemyProjectiles.push({
              kind: 'candlestick', bull: false, x: this.cx, y: this.cy,
              vx: Math.cos(ang) * 405, vy: Math.sin(ang) * 405,
              r: 11, life: 2.2, color: '#4df29c', deflectable: true
            });
          }
          this.state = 'idle';
          this.stateTimer = 1.22 / spd;
        }
      } else if (this.state === 'bull_dash_prep') {
        this.facing = player.cx >= this.cx ? 1 : -1;
        this.vx = 0;
        if (this.stateTimer <= 0) {
          // Ultra-Fast Full-Arena Bull-Run Breakout Dash!
          this.state = 'bull_dash';
          this.stateTimer = 1.35;
          this.trailTick = 0.15;
          this.vx = this.facing * (this.phase === 2 ? 720 : 640);
          SR.audio.slide();
        }
      } else if (this.state === 'bull_dash') {
        this.trailTick -= dt;
        if (this.trailTick <= 0) {
          this.trailTick = this.phase === 2 ? 0.15 : 0.20;
          // Launches rising red/gold breakout candlesticks upward as he surges across the arena!
          game.enemyProjectiles.push({
            kind: 'candlestick', bull: true, x: this.cx, y: this.cy - 10,
            vx: -this.facing * 95, vy: -300, gravity: 480,
            r: 10.5, life: 2.0, color: '#ff5c74', deflectable: true
          });
        }
        if (this.isAtArenaEdge(16) || this.stateTimer <= 0) {
          this.vx = 0;
          this.state = 'idle';
          this.stateTimer = 1.22 / spd;
        }
      } else if (this.state === 'orders_prep') {
        this.facing = player.cx >= this.cx ? 1 : -1;
        this.vx = 0;
        if (this.stateTimer <= 0) {
          const labels = ['BUY!', 'SELL!', 'ALL-IN', '+10%', 'SHORT', 'CALL!'];
          const count = this.phase === 2 ? 7 : 5;
          for (let i = 0; i < count; i++) {
            const ang = (this.facing > 0 ? -0.4 : Math.PI + 0.4) + (i - (count - 1) * 0.5) * 0.27;
            const isBuy = i % 2 === 0;
            game.enemyProjectiles.push({
              kind: 'stock_order',
              x: this.cx + this.facing * 20, y: this.cy - 14,
              vx: Math.cos(ang) * 240, vy: Math.sin(ang) * 240 - 60,
              homingPlayer: true, homingTurn: 2.15, homingSpeed: this.phase === 2 ? 235 : 210,
              label: labels[(this.patternIndex + i) % labels.length],
              r: 12, life: 2.5, color: isBuy ? '#ff7088' : '#52f29b', deflectable: true
            });
          }
          SR.audio.castMagic();
          this.state = 'idle';
          this.stateTimer = 1.24 / spd;
        }
      }
      this.moveArenaBody(dt, level, false);
    },

    // ==================== 4) 爆肝工程師 (Kevin, 3AM Senior Engineer — Buffed + API/LLM Errors!) ====================
    human_engineer(dt, player, level, game, spd) {
      if (this.state === 'idle') {
        this.updateActiveMobility(dt, player, level, spd);
        if (this.stateTimer <= 0) {
          const seq = ['type_codes', 'coffee_prep', 'stack_overflow', 'type_codes'];
          this.state = seq[this.patternIndex % seq.length];
          this.patternIndex++;
          if (this.state === 'type_codes') {
            this.typingAnim = 1.1;
            this.stateTimer = 0.48 / spd;
            const devCalls = ['git push -f --all!!', '429 Too Many Requests!!', 'Not Enough Tokens!!'];
            SR.particles.spawnText(this.cx, this.y - 22, devCalls[this.patternIndex % devCalls.length], '#9cf5e3', 1.08);
          } else if (this.state === 'stack_overflow') {
            this.typingAnim = 1.0;
            this.stateTimer = 1.35;
            const cnt = this.phase === 2 ? 9 : 7;
            const dropLabels = ['404 Not Found', '429', 'Not Enough Tokens', '500', 'NULL', 'NaN', 'OOM', 'SEGFAULT', 'BUG!'];
            this.queueSkyDrops(cnt, 'error_drop', dropLabels, ['#8ef7c8', '#ff88a8'], 0.88, 575, null, player.cx);
            SR.audio.bossAlert();
            const errCalls = ['STACK OVERFLOW!!', '404 Not Found!!', '429 Too Many Requests!!'];
            SR.particles.spawnText(this.cx, this.y - 22, errCalls[this.patternIndex % errCalls.length], '#ff88a8', 1.18);
          } else if (this.state === 'coffee_prep') {
            this.stateTimer = 0.50 / spd;
            SR.particles.spawnText(this.cx, this.y - 22, '三倍濃縮咖啡衝刺！！', '#ffe58f', 1.1);
          }
        }
      } else if (this.state === 'type_codes') {
        this.facing = player.cx >= this.cx ? 1 : -1;
        this.vx = 0;
        if (this.stateTimer <= 0) {
          const snippets = ['{ }', '01', '404', '429', 'NULL', 'NaN', 'No Tokens', 'ERR', '=>', '!='];
          const count = this.phase === 2 ? 8 : 5;
          for (let i = 0; i < count; i++) {
            const ang = (this.facing > 0 ? -0.35 : Math.PI + 0.35) + (i - (count - 1) * 0.5) * 0.26;
            game.enemyProjectiles.push({
              kind: 'code', x: this.cx + this.facing * 24, y: this.cy - 10,
              vx: Math.cos(ang) * 260, vy: Math.sin(ang) * 260 - 55,
              homingPlayer: true, homingTurn: 2.15, homingSpeed: this.phase === 2 ? 245 : 220,
              label: snippets[(this.patternIndex + i) % snippets.length],
              r: 12, life: 2.55, color: '#7ef7b8', deflectable: true
            });
          }
          SR.audio.castMagic();
          this.state = 'idle';
          this.stateTimer = 1.20 / spd;
        }
      } else if (this.state === 'stack_overflow') {
        this.facing = player.cx >= this.cx ? 1 : -1;
        this.vx *= 0.88;
        if (this.stateTimer <= 0) {
          // Fires an aimed fan of API/Runtime error bolts to pressure alongside the sky drops!
          const errBolts = ['404', '429', '500', 'No Tokens', 'ERR', 'NULL', 'NaN'];
          const count = this.phase === 2 ? 8 : 5;
          const baseAng = Math.atan2(player.cy - this.cy, player.cx - this.cx);
          for (let i = 0; i < count; i++) {
            const ang = baseAng + (i - (count - 1) * 0.5) * 0.18;
            const pSpd = this.phase === 2 ? 395 : 350;
            game.enemyProjectiles.push({
              kind: 'code', x: this.cx + this.facing * 20, y: this.cy - 8,
              vx: Math.cos(ang) * pSpd, vy: Math.sin(ang) * pSpd,
              label: errBolts[(this.patternIndex + i) % errBolts.length],
              r: 11.5, life: 2.4, color: i % 2 === 0 ? '#ff88a8' : '#8ef7c8', deflectable: true
            });
          }
          SR.audio.shoot(true);
          this.state = 'idle';
          this.stateTimer = 1.20 / spd;
        }
      } else if (this.state === 'coffee_prep') {
        this.facing = player.cx >= this.cx ? 1 : -1;
        this.vx = 0;
        if (this.stateTimer <= 0) {
          // Fast Long-Range Caffeinated Dash + 4-5 bouncing hot coffee mugs!
          this.state = 'coffee_dash';
          this.stateTimer = 1.3;
          this.trailTick = 0.15;
          this.vx = this.facing * (this.phase === 2 ? 700 : 610);
          const mugVxs = this.phase === 2 ? [-320, -160, 0, 160, 320] : [-270, -90, 90, 270];
          mugVxs.forEach((mvx) => {
            game.enemyProjectiles.push({
              kind: 'boba', x: this.cx, y: this.y + 10,
              vx: mvx, vy: -385, gravity: 780, bounces: 2,
              r: 10.5, life: 2.4, color: '#d49a6a', deflectable: true
            });
          });
          SR.audio.slide();
        }
      } else if (this.state === 'coffee_dash') {
        this.trailTick -= dt;
        if (this.trailTick <= 0) {
          this.trailTick = this.phase === 2 ? 0.17 : 0.23;
          game.enemyProjectiles.push({
            kind: 'boba', x: this.cx, y: this.y + 8,
            vx: -this.facing * 115, vy: -350, gravity: 780, bounces: 1,
            r: 10, life: 2.1, color: '#d49a6a', deflectable: true
          });
        }
        if (this.isAtArenaEdge(16) || this.stateTimer <= 0) {
          const floorY = this.getArenaFloorY(level);
          this.spawnShockwaves(game, '#8ef7c8', this.phase === 2 ? 400 : 345, 15, 1.65, floorY - 14);
          this.vx = 0;
          this.state = 'idle';
          this.stateTimer = 1.20 / spd;
        }
      }
      this.moveArenaBody(dt, level, false);
    },

    // ==================== 5) SUPER-BUFFED 水手服女高中生 (Mika, Stage 5 Final Boss!) ====================
    // 4 Signature Skills:
    //  1. MEGA SNEEZE STORM: Multi-directional 9–13 item blast (gusts, tissues, masks, pencils, erasers) + Sky-Falling Sneeze Rain!
    //  2. BALLISTIC DUMBBELL BARRAGE: Flexes dumbbells -> crazy-fast rapid-fire dumbbells aimed on exact ballistic arcs at player!
    //  3. WOK-TOSS COOKING: Flaming Chinese Wok toss -> multi-directional sizzling 炒飯 + Sky-Falling Food Rain (炒飯/煎蛋/蝦仁/包子)!
    //  4. ULTRA-FAST LONG-RANGE WORKOUT DASH: Full-arena sprint + shockwave!
    human_jk(dt, player, level, game, spd) {
      if (this.state === 'idle') {
        this.sportMode = 'idle';
        this.updateActiveMobility(dt, player, level, spd);
        if (this.stateTimer <= 0) {
          const seq = ['sneeze_prep', 'dumbbell_prep', 'cooking_prep', 'workout_dash_prep'];
          this.state = seq[this.patternIndex % seq.length];
          this.patternIndex++;
          if (this.state === 'sneeze_prep') {
            this.sportMode = 'sneeze';
            this.stateTimer = 0.52 / spd;
            SR.particles.spawnText(this.cx, this.y - 24, '哈…哈…超強噴嚏要來了！！', '#b8f3ff', 1.12);
          } else if (this.state === 'dumbbell_prep') {
            this.sportMode = 'workout';
            this.stateTimer = 0.50 / spd;
            this.barrageLeft = this.phase === 2 ? 8 : 6;
            this.barrageTick = 0;
            SR.particles.spawnText(this.cx, this.y - 24, '啞鈴連發特訓！！', '#ff9fd6', 1.15);
          } else if (this.state === 'cooking_prep') {
            this.sportMode = 'cooking';
            this.stateTimer = 0.64 / spd;
            if (SR.audio.wokSizzle) SR.audio.wokSizzle();
            SR.particles.spawnText(this.cx, this.y - 24, '家政課・麻辣鴛鴦火鍋！！', '#ff8870', 1.18);
          } else if (this.state === 'workout_dash_prep') {
            this.sportMode = 'workout';
            this.stateTimer = 0.52 / spd;
            SR.particles.spawnText(this.cx, this.y - 24, '全場全力衝刺！！', '#ff9fd6', 1.15);
          }
        }
      } else if (this.state === 'sneeze_prep') {
        this.facing = player.cx >= this.cx ? 1 : -1;
        this.vx = 0;
        if (this.stateTimer <= 0) {
          // 1) Denser Multi-Directional Sneeze Blast (9-12 items)
          this.swingAnim = 0.4;
          this.vx = -this.facing * 150;
          if (SR.audio.sneeze) SR.audio.sneeze(); else SR.audio.slash(3);
          SR.particles.spawnText(this.cx + this.facing * 26, this.y - 28, '超級哈啾！！！', '#ffffff', 1.45);
          SR.particles.spawnBurst(this.cx + this.facing * 24, this.cy - 14, ['#d8fbff', '#ffffff', '#ffbae0', '#ffe58f'], 24, {
            angle: this.facing > 0 ? 0 : Math.PI, spread: 1.6, speedMin: 110, speedMax: 300, size: 5, gravity: 0
          });

          const sneezeKinds = ['sneeze', 'tissue', 'mask', 'eraser', 'pencil'];
          const count = this.phase === 2 ? 12 : 9;
          const baseAng = Math.atan2(player.cy - (this.cy - 14), player.cx - this.cx);
          const spread = this.phase === 2 ? 2.35 : 1.95;
          for (let i = 0; i < count; i++) {
            const ang = baseAng - spread * 0.5 + (spread / (count - 1)) * i;
            const sk = sneezeKinds[i % sneezeKinds.length];
            const pSpd = (sk === 'sneeze' ? 385 : sk === 'pencil' ? 365 : 290) * (this.phase === 2 ? 1.05 : 1.0);
            game.enemyProjectiles.push({
              kind: sk,
              x: this.cx + this.facing * 24, y: this.cy - 14,
              vx: Math.cos(ang) * pSpd, vy: Math.sin(ang) * pSpd,
              r: sk === 'tissue' || sk === 'mask' ? 12 : 10,
              life: 2.5,
              color: sk === 'sneeze' ? '#b8f4ff' : (sk === 'pencil' ? '#ffe58f' : '#ffffff'),
              deflectable: true
            });
          }

          // 2) ITEMS FALLING FROM THE SKY (targeted at player's x + across arena!)
          const skyCnt = this.phase === 2 ? 8 : 6;
          this.queueSkyDrops(
            skyCnt, 'sky_sneeze', null, ['#d8fbff', '#ffffff', '#ffbae0'], 0.86, 435,
            (idx) => ({ itemType: ['tissue', 'mask', 'eraser', 'pencil'][idx % 4] }),
            player.cx
          );

          this.state = 'idle';
          this.stateTimer = 1.26 / spd;
        }
      } else if (this.state === 'dumbbell_prep') {
        this.facing = player.cx >= this.cx ? 1 : -1;
        this.vx = 0;
        if (this.stateTimer <= 0) {
          this.state = 'dumbbell_barrage';
          this.barrageTick = 0;
        }
      } else if (this.state === 'dumbbell_barrage') {
        // Ballistic Dumbbells aimed cleanly with brisk cadence!
        this.facing = player.cx >= this.cx ? 1 : -1;
        this.vx = 0;
        this.barrageTick -= dt;
        if (this.barrageTick <= 0 && this.barrageLeft > 0) {
          this.barrageLeft--;
          this.barrageTick = this.phase === 2 ? 0.16 : 0.21;
          this.swingAnim = 0.22;
          const sx = this.cx + this.facing * 18;
          const sy = this.cy - 22;
          const g = 1150;
          const dist = Math.hypot(player.cx - sx, player.cy - sy);
          const flightT = SR.clamp(dist / 900, 0.38, 0.62);
          const leadX = player.cx + (player.vx || 0) * flightT * 0.22;
          const vel = solveBallistic(sx, sy, leadX, player.cy, g, flightT);

          game.enemyProjectiles.push({
            kind: 'dumbbell',
            x: sx, y: sy,
            vx: SR.clamp(vel.vx, -860, 860),
            vy: SR.clamp(vel.vy, -760, 420),
            gravity: g,
            bounces: 0,
            r: 13,
            life: 2.2,
            color: '#ff7eb6',
            deflectable: true
          });
          SR.audio.shoot(true);
        }
        if (this.barrageLeft <= 0 && this.barrageTick <= 0) {
          this.state = 'idle';
          this.stateTimer = 1.28 / spd;
        }
      } else if (this.state === 'cooking_prep') {
        // BUBBLING HOTPOT ANIMATION with rising broth steam & spicy sparks!
        this.facing = player.cx >= this.cx ? 1 : -1;
        this.vx = 0;
        if (Math.random() < 0.55) {
          SR.particles.spawnBurst(this.cx + this.facing * 26, this.cy - 22, ['#ff6e78', '#ffe58f', '#ffffff'], 2, {
            speedMin: 35, speedMax: 120, upward: 85, size: 3.8, shape: 'circle'
          });
        }
        if (this.stateTimer <= 0) {
          // 1) HURL STEAMING HOTPOT & HOTPOT INGREDIENTS IN MULTIPLE DIRECTIONS!
          this.swingAnim = 0.4;
          if (SR.audio.wokSizzle) SR.audio.wokSizzle();
          SR.particles.spawnText(this.cx + this.facing * 20, this.y - 26, '滾燙火鍋上桌！！', '#ff8870', 1.32);

          const hotpotItems = ['hotpot_pot', 'meat_slice', 'fishball', 'tofu_cube', 'enoki', 'shrimp'];
          const count = this.phase === 2 ? 9 : 7;
          for (let i = 0; i < count; i++) {
            const frac = (i / (count - 1)) - 0.5;
            const aimX = (player.cx - this.cx) * (0.95 + frac * 0.75);
            const vx = SR.clamp(aimX + this.facing * 140, -640, 640);
            const vy = -440 - (i % 3) * 95;
            const item = i === 0 || i === Math.floor(count / 2) ? 'hotpot_pot' : hotpotItems[i % hotpotItems.length];
            game.enemyProjectiles.push({
              kind: 'delivery_food',
              foodType: item,
              x: this.cx + this.facing * 22,
              y: this.cy - 16,
              vx, vy,
              gravity: 760,
              bounces: 0,
              r: item === 'hotpot_pot' ? 14 : 12,
              life: 2.8,
              color: '#ff8870',
              deflectable: true
            });
          }

          // 2) HOTPOT INGREDIENTS RAINING FROM THE SKY (targeted at player's x + across arena!)
          const foodRainCnt = this.phase === 2 ? 8 : 6;
          this.queueSkyDrops(
            foodRainCnt, 'sky_food', null, ['#ff8870', '#ffe07d', '#ffffff'], 0.86, 445,
            (idx) => ({ foodType: hotpotItems[idx % hotpotItems.length] }),
            player.cx
          );

          this.state = 'idle';
          this.stateTimer = 1.28 / spd;
        }
      } else if (this.state === 'workout_dash_prep') {
        this.facing = player.cx >= this.cx ? 1 : -1;
        this.vx = 0;
        if (this.stateTimer <= 0) {
          // Ultra-Fast Long-Range Full-Arena Workout Dash!
          this.state = 'workout_dash';
          this.stateTimer = 1.3;
          this.trailTick = 0.15;
          this.swingAnim = 1.1;
          this.vx = this.facing * (this.phase === 2 ? 710 : 620);
          SR.audio.slide();
        }
      } else if (this.state === 'workout_dash') {
        this.trailTick -= dt;
        if (this.trailTick <= 0) {
          this.trailTick = this.phase === 2 ? 0.18 : 0.24;
          game.enemyProjectiles.push({
            kind: 'dumbbell', x: this.cx, y: this.cy - 8,
            vx: -this.facing * 105, vy: -330, gravity: 720, bounces: 0,
            r: 12, life: 1.9, color: '#ff7eb6', deflectable: true
          });
        }
        if (Math.random() < 0.5) {
          SR.particles.spawnBurst(this.cx, this.cy, ['#ff9fd6', '#ffe58f'], 2, {
            speedMin: 40, speedMax: 120, size: 3, shape: 'star'
          });
        }
        if (this.isAtArenaEdge(16) || this.stateTimer <= 0) {
          SR.particles.spawnRing(this.cx + this.facing * 24, this.cy, '#ff9fd6', 84, 0.3);
          if (Math.hypot(player.cx - (this.cx + this.facing * 24), player.cy - this.cy) < 78) {
            player.takeDamage(1, this.facing, game, false, 'dash');
          }
          const floorY = this.getArenaFloorY(level);
          this.spawnShockwaves(game, '#ff9fd6', this.phase === 2 ? 360 : 315, 15, 1.65, floorY - 14);
          this.vx = 0;
          this.state = 'idle';
          this.stateTimer = 1.26 / spd;
        }
      }
      this.moveArenaBody(dt, level, false);
    }
  };

  SR.BaseBoss = BaseBoss;
  SR.MidBoss = MidBoss;
  SR.FinalBoss = StageBoss;
  SR.HumanBoss = HumanBoss;
})(window.SR);
