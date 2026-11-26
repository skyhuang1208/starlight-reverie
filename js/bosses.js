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
      if (!floating) {
        this.vy = Math.min(880, this.vy + 1450 * dt);
      }
      this.x += this.vx * dt;
      this.x = SR.clamp(this.x, this.arena.minX + margin, this.arena.maxX - this.w - margin);
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
      }
    }
  }

  // ==================== MID-BOSS: BUFFED BUNNY GOLEMS ====================
  class MidBoss extends BaseBoss {
    constructor(arena) {
      const variant = arena.variant || 'dewdrop';
      const baseHp = variant === 'pyro' ? 820 : (variant === 'frost' ? 680 : 540);
      super(arena, {
        w: 80, h: 86, hp: baseHp,
        score: variant === 'pyro' ? 2200 : 1500,
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
      const tierMult = this.variant === 'pyro' ? 1.28 : (this.variant === 'frost' ? 1.16 : 1.06);
      const speedMult = (this.phase === 2 ? 1.25 : 1.0) * tierMult;
      const projCol = this.variant === 'pyro' ? '#ff8c66' : (this.variant === 'frost' ? '#a6f4ff' : '#9bf5e4');

      if (this.state === 'idle') {
        this.facing = player.cx >= this.cx ? 1 : -1;
        this.vx *= 0.85;
        if (this.stateTimer <= 0) {
          const patterns = ['orbit_volley', 'dash_windup', 'stomp_windup'];
          this.state = patterns[this.patternIndex % patterns.length];
          this.patternIndex++;
          if (this.state === 'stomp_windup') this.stateTimer = 0.48 / speedMult;
          if (this.state === 'orbit_volley') {
            this.stateTimer = 1.45 / speedMult;
            this.shotsLeft = this.phase === 2 ? 6 : 4;
            this.shotTick = 0.2;
          }
          if (this.state === 'dash_windup') this.stateTimer = 0.5 / speedMult;
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
        if (this.onGround && this.vy >= 0) {
          game.addShake(5);
          SR.audio.hit(true);
          SR.particles.spawnRing(this.cx, this.y + this.h, projCol, 105, 0.35);
          [-1, 1].forEach((dir) => {
            game.enemyProjectiles.push({
              kind: 'wave', x: this.cx + dir * 24, y: this.y + this.h - 14,
              vx: dir * (this.phase === 2 ? 440 : 365), vy: 0, r: 16, life: 1.9, color: projCol, deflectable: false
            });
          });
          // Multi-directional crystal/frost shards erupting upward on slam!
          const shardCnt = this.phase === 2 ? 6 : 4;
          for (let i = 0; i < shardCnt; i++) {
            const ang = -Math.PI * 0.15 - (Math.PI * 0.7) * (i / (shardCnt - 1));
            game.enemyProjectiles.push({
              kind: 'orb', x: this.cx, y: this.y + 12,
              vx: Math.cos(ang) * 320, vy: Math.sin(ang) * 380,
              gravity: 560, r: 9.5, life: 2.2, color: projCol, deflectable: true
            });
          }
          this.state = 'idle';
          this.stateTimer = 0.78 / speedMult;
          this.vx = 0;
        }
      } else if (this.state === 'orbit_volley') {
        const targetY = 455 + Math.sin(this.animTime * 4) * 16;
        this.vy = (targetY - this.y) * 4;
        this.vx = ((this.arena.minX + this.arena.maxX) * 0.5 - this.cx) * 1.4;
        this.shotTick -= dt;
        if (this.shotTick <= 0 && this.shotsLeft > 0) {
          this.shotsLeft--;
          this.shotTick = this.phase === 2 ? 0.2 : 0.28;
          const ang = Math.atan2(player.cy - this.cy, player.cx - this.cx);
          // Multi-directional 3–5 way orb fan!
          const fan = this.phase === 2 ? [-0.46, -0.23, 0, 0.23, 0.46] : [-0.3, 0, 0.3];
          fan.forEach((off) => {
            game.enemyProjectiles.push({
              kind: 'orb', x: this.cx + Math.cos(ang + off) * 32, y: this.cy + Math.sin(ang + off) * 32,
              vx: Math.cos(ang + off) * 365, vy: Math.sin(ang + off) * 365,
              r: 10, life: 2.6, color: projCol, deflectable: true
            });
          });
          SR.audio.shoot(false);
        }
        if (this.stateTimer <= 0) {
          this.state = 'idle';
          this.stateTimer = 0.72 / speedMult;
        }
      } else if (this.state === 'dash_windup') {
        this.facing = player.cx >= this.cx ? 1 : -1;
        this.vx = 0;
        if (this.stateTimer <= 0) {
          // Fast Long-Range Arena Dash!
          this.state = 'dash';
          this.stateTimer = 1.05;
          this.vx = this.facing * (this.phase === 2 ? 760 : 650);
          SR.audio.slide();
        }
      } else if (this.state === 'dash') {
        if (Math.random() < 0.28) {
          game.enemyProjectiles.push({
            kind: 'orb', x: this.cx, y: this.cy,
            vx: -this.facing * 120, vy: -240, gravity: 560, r: 8.5, life: 1.5, color: projCol, deflectable: true
          });
        }
        const hitEdge = (this.facing > 0 && this.x + this.w >= this.arena.maxX - 14) ||
          (this.facing < 0 && this.x <= this.arena.minX + 14);
        if (hitEdge || this.stateTimer <= 0) {
          this.state = 'idle';
          this.stateTimer = 0.78 / speedMult;
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
    onDeathCleanup() { this.meteors = []; }

    update(dt, player, level, game) {
      this.animTime += dt;
      if (this.hitFlash > 0) this.hitFlash -= dt;
      this.stateTimer -= dt;
      const spd = (this.phase === 2 ? 1.28 : 1.0) * this.spec.spd;

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
            this.stateTimer = this.phase === 2 ? 1.75 : 1.3;
            this.spiralTick = 0.2;
            this.spiralAngle = 0;
          } else if (next === 'meteor_rain') {
            this.targetX = (this.arena.minX + this.arena.maxX) * 0.5 - this.w * 0.5;
            this.targetY = 215;
            this.state = 'meteor_rain';
            this.stateTimer = 1.55;
            this.meteors = [];
            const cnt = this.phase === 2 ? this.spec.meteors + 2 : this.spec.meteors;
            const span = this.arena.maxX - this.arena.minX - 120;
            for (let i = 0; i < cnt; i++) {
              const mx = this.arena.minX + 60 + (span / (cnt - 1)) * i + (Math.random() - 0.5) * 40;
              this.meteors.push({ x: mx, warnTimer: 0.78 + i * 0.08, fired: false });
            }
            SR.audio.bossAlert();
          } else if (next === 'summon') {
            this.state = 'summon';
            this.stateTimer = 0.75;
            this.targetX = (this.arena.minX + this.arena.maxX) * 0.5 - this.w * 0.5;
            this.targetY = 265;
          }
        }
      } else if (this.state === 'fan_prep') {
        this.facing = player.cx >= this.cx ? 1 : -1;
        if (this.stateTimer <= 0) {
          // Wide Multi-Directional Dual-Speed Petal Fan!
          const count = this.phase === 2 ? (this.bossKind === 'malakor' ? 11 : 9) : 7;
          const baseAng = Math.atan2(player.cy - this.cy, player.cx - this.cx);
          const spread = this.phase === 2 ? 1.75 : 1.35;
          for (let i = 0; i < count; i++) {
            const ang = baseAng - spread * 0.5 + (spread / (count - 1)) * i;
            const pSpd = (i % 2 === 0 ? 375 : 300) * (this.phase === 2 ? 1.12 : 1.0);
            game.enemyProjectiles.push({
              kind: 'petal', x: this.cx, y: this.cy,
              vx: Math.cos(ang) * pSpd, vy: Math.sin(ang) * pSpd,
              r: 10, life: 3.1, color: i % 2 === 0 ? this.spec.p1 : this.spec.p2, deflectable: true
            });
          }
          SR.audio.castMagic();
          this.state = 'float_idle';
          this.stateTimer = 0.78 / spd;
        }
      } else if (this.state === 'spiral_storm') {
        this.x += (this.targetX - this.x) * Math.min(1, dt * 4);
        this.y += (this.targetY - this.y) * Math.min(1, dt * 4);
        this.spiralTick -= dt;
        if (this.spiralTick <= 0) {
          this.spiralTick = this.phase === 2 ? 0.21 : 0.29;
          const arms = this.bossKind === 'malakor' ? 8 : 6;
          this.spiralAngle += 0.36;
          for (let i = 0; i < arms; i++) {
            const ang = this.spiralAngle + (Math.PI * 2 * i) / arms;
            game.enemyProjectiles.push({
              kind: 'orb', x: this.cx, y: this.cy,
              vx: Math.cos(ang) * 295, vy: Math.sin(ang) * 295,
              r: 9, life: 2.9, color: i % 2 === 0 ? this.spec.p1 : this.spec.p2, deflectable: true
            });
          }
          SR.audio.shoot(false);
        }
        if (this.stateTimer <= 0) {
          this.state = 'float_idle';
          this.stateTimer = 0.76 / spd;
        }
      } else if (this.state === 'sweep_prep') {
        if (this.stateTimer <= 0) {
          // Ultra-Fast Long-Range Full-Arena Sweep!
          this.state = 'sweep';
          this.stateTimer = 1.35;
          this.vx = this.facing * (this.phase === 2 ? 860 : 750);
          this.trailTick = 0.1;
          SR.audio.slide();
        }
      } else if (this.state === 'sweep') {
        this.x += this.vx * dt;
        this.trailTick -= dt;
        if (this.trailTick <= 0) {
          this.trailTick = this.phase === 2 ? 0.11 : 0.16;
          [-1, 1].forEach((dirY) => {
            game.enemyProjectiles.push({
              kind: 'orb', x: this.cx, y: this.cy,
              vx: -this.facing * 80, vy: dirY * 185, r: 8.5, life: 1.6, color: this.spec.p1, deflectable: true
            });
          });
        }
        const hitEdge = (this.facing > 0 && this.x + this.w >= this.arena.maxX - 24) ||
          (this.facing < 0 && this.x <= this.arena.minX + 24);
        if (hitEdge || this.stateTimer <= 0) {
          [-1, 1].forEach((dir) => {
            game.enemyProjectiles.push({
              kind: 'wave', x: this.cx, y: 558, vx: dir * 410, vy: 0,
              r: 16, life: 1.8, color: this.spec.p1, deflectable: false
            });
          });
          this.vx = 0;
          this.targetX = this.x;
          this.targetY = 275;
          this.state = 'float_idle';
          this.stateTimer = 0.75 / spd;
        }
      } else if (this.state === 'meteor_rain') {
        this.x += (this.targetX - this.x) * Math.min(1, dt * 4);
        this.y += (this.targetY - this.y) * Math.min(1, dt * 4);
        if (this.stateTimer <= 0) {
          this.state = 'float_idle';
          this.stateTimer = 0.78;
        }
      } else if (this.state === 'summon') {
        this.x += (this.targetX - this.x) * Math.min(1, dt * 4);
        this.y += (this.targetY - this.y) * Math.min(1, dt * 4);
        if (this.stateTimer <= 0) {
          const activeMinions = game.enemies.filter((e) => !e.dead && !e.isBoss).length;
          if (activeMinions < 2) {
            const leftX = this.arena.minX + 160;
            const rightX = this.arena.maxX - 210;
            const m0 = this.spec.minions[0];
            const m1 = this.spec.minions[1];
            game.enemies.push(new SR.Enemy({ type: m0, x: leftX, y: m0 === 'wisp' || m0 === 'bomber' ? 310 : 525, homeY: 310, patrolMin: this.arena.minX + 30, patrolMax: this.arena.maxX - 30 }, level.meta));
            game.enemies.push(new SR.Enemy({ type: m1, x: rightX, y: m1 === 'wisp' || m1 === 'bomber' ? 310 : 525, homeY: 310, patrolMin: this.arena.minX + 30, patrolMax: this.arena.maxX - 30 }, level.meta));
            SR.particles.spawnRing(leftX + 19, 520, this.spec.p1, 48, 0.35);
            SR.particles.spawnRing(rightX + 19, 320, this.spec.p2, 48, 0.35);
            SR.audio.castMagic();
          }
          this.state = 'float_idle';
          this.stateTimer = 0.78 / spd;
        }
      }
    }
  }

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
    }

    getHitBurstColors() { return [this.spec.color, '#ffe894', '#ffffff']; }
    getPhase2Text() { return this.spec.wakeText; }

    onDeathCleanup(game) {
      this.meteors = [];
      this.pendingSummonSpots = [];
      if (game && game.enemies) {
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
      const slots = [0.12, 0.36, 0.64, 0.88].map((f) => {
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
        { type: cfg.soldiers[1], x: slots[1], floorY, isElite: false },
        { type: cfg.soldiers[2], x: slots[3], floorY, isElite: false },
        { type: eliteType,       x: slots[2], floorY, isElite: true }
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
        probe.baseY = probe.y;
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
      this.summonCooldown = this.phase === 2 ? 16.0 : 19.5;
      SR.audio.castMagic();
    }

    queueSkyDrops(count, kind, labels, colors, warnBase = 0.72, speedY = 540, extraProps = null) {
      const span = this.arena.maxX - this.arena.minX - 120;
      for (let i = 0; i < count; i++) {
        const mx = this.arena.minX + 60 + (span / Math.max(1, count - 1)) * i + (Math.random() - 0.5) * 48;
        this.meteors.push({
          x: mx,
          warnTimer: warnBase + i * 0.08,
          fired: false,
          dropKind: kind,
          label: labels ? labels[i % labels.length] : null,
          color: colors ? colors[i % colors.length] : '#ffe58f',
          vy: speedY,
          extra: extraProps ? extraProps(i) : null
        });
      }
    }

    update(dt, player, level, game) {
      this.animTime += dt;
      if (this.hitFlash > 0) this.hitFlash -= dt;
      if (this.swingAnim > 0) this.swingAnim -= dt;
      if (this.typingAnim > 0) this.typingAnim -= dt;
      if (this.summonCooldown > 0) this.summonCooldown -= dt;
      this.stateTimer -= dt;
      const spd = (this.phase === 2 ? 1.24 : 1.0) * this.spec.spd;

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
          this.stateTimer = 0.95 / spd;
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
      callout: '召喚外送小隊與街坊支援！！',
      soldiers: ['slime', 'knight', 'wisp'],
      elites: ['delivery_scooter', 'corgi_skater']
    },
    human_athlete: {
      callout: '體育校隊＋滑板柯基集合！！',
      soldiers: ['knight', 'shadow_dasher', 'bomber'],
      elites: ['corgi_skater', 'shiba_samurai']
    },
    human_trader: {
      callout: '主力部隊＋貓咪操盤手進場！！',
      soldiers: ['prism_turret', 'shadow_dasher', 'wisp'],
      elites: ['cat_thrower', 'delivery_scooter']
    },
    human_engineer: {
      callout: '外包工程師＋柴犬架構師支援！！',
      soldiers: ['prism_turret', 'knight', 'bomber'],
      elites: ['shiba_samurai', 'cat_thrower']
    },
    human_jk: {
      callout: '社團應援團＋最強柴柴出動！！',
      soldiers: ['shadow_dasher', 'knight', 'wisp'],
      elites: ['shiba_samurai', 'cat_thrower', 'corgi_skater', 'delivery_scooter']
    }
  };

  const HUMAN_BOSS_AI = {
    // ==================== 1) 老奶奶 (Grandma Lin — Throw + Dash + Sky Grocery Rain!) ====================
    human_grandma(dt, player, level, game, spd) {
      if (this.state === 'idle') {
        this.pushingWheelchair = false;
        this.facing = player.cx >= this.cx ? 1 : -1;
        this.vx *= 0.85;
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
            const cnt = this.phase === 2 ? 8 : 6;
            this.queueSkyDrops(
              cnt, 'sky_food', null, ['#ff9fd6', '#ffe58f', '#9cf5e3'], 0.7, 460,
              (idx) => ({ foodType: ['cabbage', 'tangerine', 'dumpling', 'red_envelope'][idx % 4] })
            );
            SR.audio.bossAlert();
            SR.particles.spawnText(this.cx, this.y - 22, '菜市場大特價雨！！', '#ffe58f', 1.16);
          }
        }
      } else if (this.state === 'market_rain_prep') {
        this.vx = 0;
        if (this.stateTimer <= 0) {
          this.state = 'idle';
          this.stateTimer = 0.78 / spd;
        }
      } else if (this.state === 'scold_prep') {
        this.facing = player.cx >= this.cx ? 1 : -1;
        this.vx = 0;
        if (this.stateTimer <= 0) {
          // Multi-directional 5–7 Scold Bubble Fan!
          const words = ['不穿外套!', '太晚睡!', '去吃飯!', '滑手機!', '念你喔!', '快喝水!', '多吃菜!'];
          const count = this.phase === 2 ? 7 : 5;
          const base = this.facing > 0 ? -0.25 : Math.PI + 0.25;
          for (let i = 0; i < count; i++) {
            const ang = base + (i - (count - 1) * 0.5) * 0.34;
            game.enemyProjectiles.push({
              kind: 'scold', x: this.cx + this.facing * 24, y: this.cy - 12,
              vx: Math.cos(ang) * 285, vy: Math.sin(ang) * 285 - 50,
              homingPlayer: true, homingTurn: 3.1, homingSpeed: this.phase === 2 ? 290 : 250,
              label: words[(this.patternIndex + i) % words.length],
              r: 13, life: 3.2, color: '#ff9fd6', deflectable: true
            });
          }
          SR.audio.castMagic();
          this.state = 'idle';
          this.stateTimer = 0.85 / spd;
        }
      } else if (this.state === 'cane_prep') {
        this.facing = player.cx >= this.cx ? 1 : -1;
        this.vx = 0;
        if (this.stateTimer <= 0) {
          // Fast Long-Range Cane Dash + radial orbs!
          this.state = 'cane_dash';
          this.stateTimer = 1.1;
          this.vx = this.facing * (this.phase === 2 ? 740 : 640);
          this.vy = -220;
          SR.audio.slide();
        }
      } else if (this.state === 'cane_dash') {
        const hitEdge = (this.facing > 0 && this.x + this.w >= this.arena.maxX - 16) ||
          (this.facing < 0 && this.x <= this.arena.minX + 16);
        if (hitEdge || this.stateTimer <= 0) {
          [-1, 1].forEach((dir) => {
            game.enemyProjectiles.push({
              kind: 'wave', x: this.cx + dir * 20, y: this.y + this.h - 14,
              vx: dir * 380, vy: 0, r: 15, life: 1.6, color: '#ff9fd6', deflectable: false
            });
          });
          this.vx = 0;
          this.state = 'idle';
          this.stateTimer = 0.78 / spd;
        }
      } else if (this.state === 'wheelchair_prep') {
        this.pushingWheelchair = true;
        this.facing = player.cx >= this.cx ? 1 : -1;
        this.vx = 0;
        if (this.stateTimer <= 0) {
          // Ultra-Fast Full-Arena Turbo Wheelchair Charge!
          this.state = 'wheelchair_dash';
          this.stateTimer = 1.45;
          this.trailTick = 0.16;
          this.vx = this.facing * (this.phase === 2 ? 840 : 720);
          SR.audio.slide();
        }
      } else if (this.state === 'wheelchair_dash') {
        this.pushingWheelchair = true;
        this.trailTick -= dt;
        if (this.trailTick <= 0) {
          this.trailTick = 0.18;
          // Flings hot tea cups upward while racing across the arena!
          game.enemyProjectiles.push({
            kind: 'boba', x: this.cx, y: this.y + 8,
            vx: -this.facing * 140, vy: -410, gravity: 780, bounces: 1,
            r: 10.5, life: 2.3, color: '#ffe58f', deflectable: true
          });
        }
        const hitEdge = (this.facing > 0 && this.x + this.w >= this.arena.maxX - 16) ||
          (this.facing < 0 && this.x <= this.arena.minX + 16);
        if (hitEdge || this.stateTimer <= 0) {
          this.vx = 0;
          this.pushingWheelchair = false;
          this.state = 'idle';
          this.stateTimer = 0.8 / spd;
        }
      }
      this.moveArenaBody(dt, level, false);
    },

    // ==================== 2) 熱血體育生 (Coach Chad — Throw + Dash + Sky Sports Ball Rain!) ====================
    human_athlete(dt, player, level, game, spd) {
      if (this.state === 'idle') {
        this.sportMode = 'idle';
        this.facing = player.cx >= this.cx ? 1 : -1;
        this.vx *= 0.85;
        if (this.stateTimer <= 0) {
          const seq = ['badminton_jump', 'sky_serve_prep', 'tennis_prep', 'basketball_prep', 'sprint_prep'];
          this.state = seq[this.patternIndex % seq.length];
          this.patternIndex++;
          if (this.state === 'badminton_jump') {
            this.sportMode = 'badminton';
            this.vy = -610;
            this.vx = this.facing * 115;
            this.stateTimer = 0.42;
            SR.audio.jump(true);
            SR.particles.spawnText(this.cx, this.y - 22, '連環羽球殺球！！', '#ffffff', 1.1);
          } else if (this.state === 'sky_serve_prep') {
            this.sportMode = 'basketball';
            this.stateTimer = 1.25;
            this.swingAnim = 0.4;
            const cnt = this.phase === 2 ? 8 : 6;
            this.queueSkyDrops(
              cnt, 'sky_sport', null, ['#ff964f', '#c4ff6b', '#ffffff'], 0.68, 520,
              (idx) => ({ sportBall: ['basketball', 'tennis', 'shuttlecock', 'volleyball'][idx % 4] })
            );
            SR.audio.bossAlert();
            SR.particles.spawnText(this.cx, this.y - 22, '高空魔球發球雨！！', '#ffe58f', 1.16);
          } else if (this.state === 'tennis_prep') {
            this.sportMode = 'tennis';
            this.stateTimer = 0.45 / spd;
            SR.particles.spawnText(this.cx, this.y - 22, '網球重砲齊發！', '#b8ff78', 1.1);
          } else if (this.state === 'basketball_prep') {
            this.sportMode = 'basketball';
            this.stateTimer = 0.45 / spd;
            SR.particles.spawnText(this.cx, this.y - 22, '全場三分雨！！', '#ffaa66', 1.1);
          } else if (this.state === 'sprint_prep') {
            this.sportMode = 'sprint';
            this.stateTimer = 0.48 / spd;
            SR.particles.spawnText(this.cx, this.y - 22, '超音速百米衝刺！！', '#ffe58f', 1.15);
          }
        }
      } else if (this.state === 'sky_serve_prep') {
        this.vx = 0;
        if (this.stateTimer <= 0) {
          this.state = 'idle';
          this.stateTimer = 0.78 / spd;
        }
      } else if (this.state === 'badminton_jump') {
        this.facing = player.cx >= this.cx ? 1 : -1;
        if (this.stateTimer <= 0) {
          this.swingAnim = 0.35;
          const baseAng = Math.atan2(player.cy - this.cy, player.cx - this.cx);
          const count = this.phase === 2 ? 9 : 6;
          for (let i = 0; i < count; i++) {
            const ang = baseAng + (i - (count - 1) * 0.5) * 0.22;
            const s = (i % 2 === 0 ? 480 : 395) * (this.phase === 2 ? 1.1 : 1.0);
            game.enemyProjectiles.push({
              kind: 'shuttlecock', x: this.cx + this.facing * 20, y: this.cy - 10,
              vx: Math.cos(ang) * s, vy: Math.sin(ang) * s,
              r: 9, life: 2.3, color: '#ffffff', deflectable: true
            });
          }
          SR.audio.slash(2);
          this.state = 'idle';
          this.stateTimer = 0.78 / spd;
        }
      } else if (this.state === 'tennis_prep') {
        this.facing = player.cx >= this.cx ? 1 : -1;
        this.vx = 0;
        if (this.stateTimer <= 0) {
          this.swingAnim = 0.35;
          const count = this.phase === 2 ? 7 : 5;
          const baseAng = Math.atan2(player.cy - this.cy, player.cx - this.cx);
          for (let i = 0; i < count; i++) {
            const ang = baseAng + (i - (count - 1) * 0.5) * 0.2;
            game.enemyProjectiles.push({
              kind: 'tennis', x: this.cx + this.facing * 24, y: this.cy - 4,
              vx: Math.cos(ang) * (this.phase === 2 ? 530 : 460),
              vy: Math.sin(ang) * (this.phase === 2 ? 530 : 460),
              r: 9.5, life: 2.4, color: '#c4ff6b', deflectable: true
            });
          }
          SR.audio.shoot(true);
          this.state = 'idle';
          this.stateTimer = 0.78 / spd;
        }
      } else if (this.state === 'basketball_prep') {
        this.facing = player.cx >= this.cx ? 1 : -1;
        this.vx = 0;
        if (this.stateTimer <= 0) {
          this.swingAnim = 0.35;
          this.vy = -280;
          const count = this.phase === 2 ? 6 : 4;
          for (let i = 0; i < count; i++) {
            const speedX = (180 + i * 95) * this.facing;
            game.enemyProjectiles.push({
              kind: 'basketball', x: this.cx + this.facing * 18, y: this.cy - 18,
              vx: speedX, vy: -350 - i * 48, gravity: 820, bounces: 3,
              r: 13.5, life: 3.5, color: '#ff964f', deflectable: true
            });
          }
          SR.audio.jump(false);
          this.state = 'idle';
          this.stateTimer = 0.85 / spd;
        }
      } else if (this.state === 'sprint_prep') {
        this.facing = player.cx >= this.cx ? 1 : -1;
        this.vx = 0;
        if (this.stateTimer <= 0) {
          // Ultra-Fast Long-Range 100m Sprint Dash!
          this.state = 'sprint_dash';
          this.stateTimer = 1.35;
          this.vx = this.facing * (this.phase === 2 ? 860 : 750);
          SR.audio.slide();
        }
      } else if (this.state === 'sprint_dash') {
        const hitEdge = (this.facing > 0 && this.x + this.w >= this.arena.maxX - 16) ||
          (this.facing < 0 && this.x <= this.arena.minX + 16);
        if (hitEdge || this.stateTimer <= 0) {
          this.vx = 0;
          this.state = 'idle';
          this.stateTimer = 0.74 / spd;
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
        this.facing = player.cx >= this.cx ? 1 : -1;
        this.vx *= 0.85;
        if (this.stateTimer <= 0) {
          const seq = ['kline_prep', 'bull_dash_prep', 'crash_prep', 'orders_prep'];
          this.state = seq[this.patternIndex % seq.length];
          this.patternIndex++;
          if (this.state === 'kline_prep') {
            this.sportMode = 'kline';
            this.stateTimer = 0.46 / spd;
            if (SR.audio.stockBell) SR.audio.stockBell();
            SR.particles.spawnText(this.cx, this.y - 24, 'K線多空雙殺！！', '#ff6b78', 1.12);
          } else if (this.state === 'crash_prep') {
            this.sportMode = 'crash';
            this.stateTimer = 1.4;
            const cnt = this.phase === 2 ? 8 : 6;
            this.queueSkyDrops(cnt, 'stock_crash', ['-10%', '跌停!', 'MARGIN', '斷頭!', '-9.9%', '崩盤!'], ['#52f29b', '#ff6b78'], 0.72, 620);
            SR.audio.bossAlert();
            SR.particles.spawnText(this.cx, this.y - 24, '大盤崩盤・跌停瀑布！！', '#52f29b', 1.18);
          } else if (this.state === 'bull_dash_prep') {
            this.sportMode = 'bull';
            this.stateTimer = 0.48 / spd;
            SR.particles.spawnText(this.cx, this.y - 24, '漲停鎖死・暴力突破！！', '#ffe58f', 1.15);
          } else if (this.state === 'orders_prep') {
            this.sportMode = 'orders';
            this.stateTimer = 0.48 / spd;
            if (SR.audio.stockBell) SR.audio.stockBell();
            SR.particles.spawnText(this.cx, this.y - 24, 'ALL-IN 軋空委託單！', '#9cf5e3', 1.1);
          }
        }
      } else if (this.state === 'kline_prep') {
        this.facing = player.cx >= this.cx ? 1 : -1;
        this.vx = 0;
        if (this.stateTimer <= 0) {
          // Multi-directional 7–10 Red & Green K-Line Candlesticks fan!
          this.swingAnim = 0.35;
          const count = this.phase === 2 ? 10 : 7;
          const baseAng = Math.atan2(player.cy - this.cy, player.cx - this.cx);
          const spread = this.phase === 2 ? 1.85 : 1.45;
          for (let i = 0; i < count; i++) {
            const ang = baseAng - spread * 0.5 + (spread / (count - 1)) * i;
            const isBull = i % 2 === 0;
            const pSpd = (isBull ? 440 : 365) * (this.phase === 2 ? 1.1 : 1.0);
            game.enemyProjectiles.push({
              kind: 'candlestick',
              bull: isBull,
              x: this.cx + this.facing * 20,
              y: this.cy - 10,
              vx: Math.cos(ang) * pSpd,
              vy: Math.sin(ang) * pSpd,
              r: 11,
              life: 2.6,
              color: isBull ? '#ff5c74' : '#4df29c',
              deflectable: true
            });
          }
          SR.audio.shoot(true);
          this.state = 'idle';
          this.stateTimer = 0.78 / spd;
        }
      } else if (this.state === 'crash_prep') {
        this.vx = 0;
        if (this.stateTimer <= 0) {
          // Also sweeps 3 horizontal sell-off candlesticks at ground/mid level!
          [-0.25, 0, 0.25].forEach((off) => {
            const ang = (this.facing > 0 ? 0 : Math.PI) + off;
            game.enemyProjectiles.push({
              kind: 'candlestick', bull: false, x: this.cx, y: this.cy,
              vx: Math.cos(ang) * 410, vy: Math.sin(ang) * 410,
              r: 11, life: 2.3, color: '#4df29c', deflectable: true
            });
          });
          this.state = 'idle';
          this.stateTimer = 0.76 / spd;
        }
      } else if (this.state === 'bull_dash_prep') {
        this.facing = player.cx >= this.cx ? 1 : -1;
        this.vx = 0;
        if (this.stateTimer <= 0) {
          // Ultra-Fast Full-Arena Bull-Run Breakout Dash!
          this.state = 'bull_dash';
          this.stateTimer = 1.4;
          this.trailTick = 0.1;
          this.vx = this.facing * (this.phase === 2 ? 880 : 760);
          SR.audio.slide();
        }
      } else if (this.state === 'bull_dash') {
        this.trailTick -= dt;
        if (this.trailTick <= 0) {
          this.trailTick = this.phase === 2 ? 0.11 : 0.15;
          // Launches rising red/gold breakout candlesticks upward as he surges across the arena!
          game.enemyProjectiles.push({
            kind: 'candlestick', bull: true, x: this.cx, y: this.cy - 10,
            vx: -this.facing * 95, vy: -310, gravity: 480,
            r: 10.5, life: 2.1, color: '#ff5c74', deflectable: true
          });
        }
        const hitEdge = (this.facing > 0 && this.x + this.w >= this.arena.maxX - 16) ||
          (this.facing < 0 && this.x <= this.arena.minX + 16);
        if (hitEdge || this.stateTimer <= 0) {
          this.vx = 0;
          this.state = 'idle';
          this.stateTimer = 0.74 / spd;
        }
      } else if (this.state === 'orders_prep') {
        this.facing = player.cx >= this.cx ? 1 : -1;
        this.vx = 0;
        if (this.stateTimer <= 0) {
          const labels = ['BUY!', 'SELL!', 'ALL-IN', '+10%', 'SHORT', 'CALL!'];
          const count = this.phase === 2 ? 6 : 4;
          for (let i = 0; i < count; i++) {
            const ang = (this.facing > 0 ? -0.4 : Math.PI + 0.4) + (i - (count - 1) * 0.5) * 0.42;
            const isBuy = i % 2 === 0;
            game.enemyProjectiles.push({
              kind: 'stock_order',
              x: this.cx + this.facing * 20, y: this.cy - 14,
              vx: Math.cos(ang) * 260, vy: Math.sin(ang) * 260 - 70,
              homingPlayer: true, homingTurn: 3.0, homingSpeed: this.phase === 2 ? 295 : 255,
              label: labels[(this.patternIndex + i) % labels.length],
              r: 12, life: 3.1, color: isBuy ? '#ff7088' : '#52f29b', deflectable: true
            });
          }
          SR.audio.castMagic();
          this.state = 'idle';
          this.stateTimer = 0.82 / spd;
        }
      }
      this.moveArenaBody(dt, level, false);
    },

    // ==================== 4) 爆肝工程師 (Kevin, 3AM Senior Engineer — Buffed!) ====================
    human_engineer(dt, player, level, game, spd) {
      if (this.state === 'idle') {
        this.facing = player.cx >= this.cx ? 1 : -1;
        this.vx *= 0.85;
        if (this.stateTimer <= 0) {
          const seq = ['type_codes', 'coffee_prep', 'stack_overflow', 'type_codes'];
          this.state = seq[this.patternIndex % seq.length];
          this.patternIndex++;
          if (this.state === 'type_codes') {
            this.typingAnim = 1.1;
            this.stateTimer = 0.48 / spd;
            SR.particles.spawnText(this.cx, this.y - 22, 'git push -f --all!!', '#9cf5e3', 1.08);
          } else if (this.state === 'stack_overflow') {
            this.typingAnim = 1.0;
            this.stateTimer = 1.4;
            const cnt = this.phase === 2 ? 8 : 6;
            this.queueSkyDrops(cnt, 'error_drop', ['404', 'NULL', 'ERR!', 'BUG!', '500', 'NaN', 'OOM', 'SEGFAULT'], ['#8ef7c8', '#ff88a8'], 0.76, 610);
            SR.audio.bossAlert();
            SR.particles.spawnText(this.cx, this.y - 22, 'STACK OVERFLOW!!', '#ff88a8', 1.18);
          } else if (this.state === 'coffee_prep') {
            this.stateTimer = 0.48 / spd;
            SR.particles.spawnText(this.cx, this.y - 22, '三倍濃縮咖啡衝刺！！', '#ffe58f', 1.1);
          }
        }
      } else if (this.state === 'type_codes') {
        this.facing = player.cx >= this.cx ? 1 : -1;
        this.vx = 0;
        if (this.stateTimer <= 0) {
          const snippets = ['{ }', '01', 'ERR', 'NULL', 'NaN', '=>', '!=', '&&'];
          const count = this.phase === 2 ? 7 : 5;
          for (let i = 0; i < count; i++) {
            const ang = (this.facing > 0 ? -0.35 : Math.PI + 0.35) + (i - (count - 1) * 0.5) * 0.34;
            game.enemyProjectiles.push({
              kind: 'code', x: this.cx + this.facing * 24, y: this.cy - 10,
              vx: Math.cos(ang) * 285, vy: Math.sin(ang) * 285 - 65,
              homingPlayer: true, homingTurn: 3.1, homingSpeed: this.phase === 2 ? 300 : 260,
              label: snippets[(this.patternIndex + i) % snippets.length],
              r: 12, life: 3.3, color: '#7ef7b8', deflectable: true
            });
          }
          SR.audio.castMagic();
          this.state = 'idle';
          this.stateTimer = 0.85 / spd;
        }
      } else if (this.state === 'stack_overflow') {
        this.vx = 0;
        if (this.stateTimer <= 0) {
          this.state = 'idle';
          this.stateTimer = 0.78 / spd;
        }
      } else if (this.state === 'coffee_prep') {
        this.facing = player.cx >= this.cx ? 1 : -1;
        this.vx = 0;
        if (this.stateTimer <= 0) {
          // Fast Long-Range Caffeinated Dash + 4 bouncing hot coffee mugs!
          this.state = 'coffee_dash';
          this.stateTimer = 1.3;
          this.vx = this.facing * (this.phase === 2 ? 800 : 680);
          [-260, -110, 110, 260].forEach((mvx) => {
            game.enemyProjectiles.push({
              kind: 'boba', x: this.cx, y: this.y + 10,
              vx: mvx, vy: -390, gravity: 780, bounces: 2,
              r: 10.5, life: 2.5, color: '#d49a6a', deflectable: true
            });
          });
          SR.audio.slide();
        }
      } else if (this.state === 'coffee_dash') {
        const hitEdge = (this.facing > 0 && this.x + this.w >= this.arena.maxX - 16) ||
          (this.facing < 0 && this.x <= this.arena.minX + 16);
        if (hitEdge || this.stateTimer <= 0) {
          this.vx = 0;
          this.state = 'idle';
          this.stateTimer = 0.76 / spd;
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
        this.facing = player.cx >= this.cx ? 1 : -1;
        this.vx *= 0.85;
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
            this.stateTimer = 0.44 / spd;
            this.barrageLeft = this.phase === 2 ? 7 : 5;
            this.barrageTick = 0;
            SR.particles.spawnText(this.cx, this.y - 24, '啞鈴連發特訓！！', '#ff9fd6', 1.15);
          } else if (this.state === 'cooking_prep') {
            this.sportMode = 'cooking';
            this.stateTimer = 0.6 / spd;
            if (SR.audio.wokSizzle) SR.audio.wokSizzle();
            SR.particles.spawnText(this.cx, this.y - 24, '家政課・麻辣鴛鴦火鍋！！', '#ff8870', 1.18);
          } else if (this.state === 'workout_dash_prep') {
            this.sportMode = 'workout';
            this.stateTimer = 0.45 / spd;
            SR.particles.spawnText(this.cx, this.y - 24, '全場全力衝刺！！', '#ff9fd6', 1.15);
          }
        }
      } else if (this.state === 'sneeze_prep') {
        this.facing = player.cx >= this.cx ? 1 : -1;
        this.vx = 0;
        if (this.stateTimer <= 0) {
          // 1) MASSIVE MULTI-DIRECTIONAL SNEEZE BLAST (9–13 items in 175° spread!)
          this.swingAnim = 0.4;
          this.vx = -this.facing * 150;
          if (SR.audio.sneeze) SR.audio.sneeze(); else SR.audio.slash(3);
          SR.particles.spawnText(this.cx + this.facing * 26, this.y - 28, '超級哈啾！！！', '#ffffff', 1.45);
          SR.particles.spawnBurst(this.cx + this.facing * 24, this.cy - 14, ['#d8fbff', '#ffffff', '#ffbae0', '#ffe58f'], 24, {
            angle: this.facing > 0 ? 0 : Math.PI, spread: 1.6, speedMin: 110, speedMax: 300, size: 5, gravity: 0
          });

          const sneezeKinds = ['sneeze', 'tissue', 'mask', 'eraser', 'pencil'];
          const count = this.phase === 2 ? 13 : 9;
          const baseAng = Math.atan2(player.cy - (this.cy - 14), player.cx - this.cx);
          const spread = this.phase === 2 ? 2.6 : 2.1; // Huge multi-direction burst!
          for (let i = 0; i < count; i++) {
            const ang = baseAng - spread * 0.5 + (spread / (count - 1)) * i;
            const sk = sneezeKinds[i % sneezeKinds.length];
            const pSpd = (sk === 'sneeze' ? 460 : sk === 'pencil' ? 430 : 330) * (this.phase === 2 ? 1.08 : 1.0);
            game.enemyProjectiles.push({
              kind: sk,
              x: this.cx + this.facing * 24, y: this.cy - 14,
              vx: Math.cos(ang) * pSpd, vy: Math.sin(ang) * pSpd,
              r: sk === 'tissue' || sk === 'mask' ? 12 : 10,
              life: 2.7,
              color: sk === 'sneeze' ? '#b8f4ff' : (sk === 'pencil' ? '#ffe58f' : '#ffffff'),
              deflectable: true
            });
          }

          // 2) ITEMS FALLING FROM THE SKY (tissues, masks, erasers raining across arena!)
          const skyCnt = this.phase === 2 ? 8 : 6;
          this.queueSkyDrops(
            skyCnt, 'sky_sneeze', null, ['#d8fbff', '#ffffff', '#ffbae0'], 0.65, 440,
            (idx) => ({ itemType: ['tissue', 'mask', 'eraser', 'pencil'][idx % 4] })
          );

          this.state = 'idle';
          this.stateTimer = 0.85 / spd;
        }
      } else if (this.state === 'dumbbell_prep') {
        this.facing = player.cx >= this.cx ? 1 : -1;
        this.vx = 0;
        if (this.stateTimer <= 0) {
          this.state = 'dumbbell_barrage';
          this.barrageTick = 0;
        }
      } else if (this.state === 'dumbbell_barrage') {
        // CRAZY-FAST RAPID-FIRE BALLISTIC DUMBBELLS aimed straight at player's current location!
        this.facing = player.cx >= this.cx ? 1 : -1;
        this.vx = 0;
        this.barrageTick -= dt;
        if (this.barrageTick <= 0 && this.barrageLeft > 0) {
          this.barrageLeft--;
          this.barrageTick = this.phase === 2 ? 0.15 : 0.19; // Rapid fire!
          this.swingAnim = 0.22;
          const sx = this.cx + this.facing * 18;
          const sy = this.cy - 22;
          const g = 1150;
          const dist = Math.hypot(player.cx - sx, player.cy - sy);
          // Fast ballistic flight time scaled smoothly by distance (0.36s..0.58s -> blazing fast!)
          const flightT = SR.clamp(dist / 980, 0.34, 0.56);
          const leadX = player.cx + (player.vx || 0) * flightT * 0.28;
          const vel = solveBallistic(sx, sy, leadX, player.cy, g, flightT);

          game.enemyProjectiles.push({
            kind: 'dumbbell',
            x: sx, y: sy,
            vx: SR.clamp(vel.vx, -920, 920),
            vy: SR.clamp(vel.vy, -820, 420),
            gravity: g,
            bounces: 1,
            r: 13.5,
            life: 2.4,
            color: '#ff7eb6',
            deflectable: true
          });
          SR.audio.shoot(true);
        }
        if (this.barrageLeft <= 0 && this.barrageTick <= 0) {
          this.state = 'idle';
          this.stateTimer = 0.78 / spd;
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
          const count = this.phase === 2 ? 9 : 6;
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
              bounces: 1,
              r: item === 'hotpot_pot' ? 14 : 12,
              life: 3.0,
              color: '#ff8870',
              deflectable: true
            });
          }

          // 2) HOTPOT INGREDIENTS RAINING FROM THE SKY! (火鍋、肉片、魚板丸子、嫩豆腐、金針菇、鮮蝦)
          const foodRainCnt = this.phase === 2 ? 8 : 6;
          this.queueSkyDrops(
            foodRainCnt, 'sky_food', null, ['#ff8870', '#ffe07d', '#ffffff'], 0.7, 460,
            (idx) => ({ foodType: hotpotItems[idx % hotpotItems.length] })
          );

          this.state = 'idle';
          this.stateTimer = 0.88 / spd;
        }
      } else if (this.state === 'workout_dash_prep') {
        this.facing = player.cx >= this.cx ? 1 : -1;
        this.vx = 0;
        if (this.stateTimer <= 0) {
          // Ultra-Fast Long-Range Full-Arena Workout Dash!
          this.state = 'workout_dash';
          this.stateTimer = 1.35;
          this.swingAnim = 1.1;
          this.vx = this.facing * (this.phase === 2 ? 860 : 750);
          SR.audio.slide();
        }
      } else if (this.state === 'workout_dash') {
        if (Math.random() < 0.5) {
          SR.particles.spawnBurst(this.cx, this.cy, ['#ff9fd6', '#ffe58f'], 2, {
            speedMin: 40, speedMax: 120, size: 3, shape: 'star'
          });
        }
        const hitEdge = (this.facing > 0 && this.x + this.w >= this.arena.maxX - 16) ||
          (this.facing < 0 && this.x <= this.arena.minX + 16);
        if (hitEdge || this.stateTimer <= 0) {
          SR.particles.spawnRing(this.cx + this.facing * 24, this.cy, '#ff9fd6', 84, 0.3);
          if (Math.hypot(player.cx - (this.cx + this.facing * 24), player.cy - this.cy) < 78) {
            player.takeDamage(1, this.facing, game, false, 'dash');
          }
          [-1, 1].forEach((dir) => {
            game.enemyProjectiles.push({
              kind: 'wave', x: this.cx + dir * 20, y: this.y + this.h - 14,
              vx: dir * (this.phase === 2 ? 430 : 365), vy: 0, r: 15, life: 1.75, color: '#ff9fd6', deflectable: false
            });
          });
          this.vx = 0;
          this.state = 'idle';
          this.stateTimer = 0.74 / spd;
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
