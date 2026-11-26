// Common Armies (6 Archetypes) & 4 Upgraded Scarce 小頭目:
// 1) 柴犬武士: Platform-crossing Iaijutsu Dash (skill) + Bark Sound Wave push (normal ranged attack!)
// 2) 外送飆車哥: Tosses 珍奶, 雞排, 肉丸子串, 臭豆腐, 炒麵, 炒飯!
// 3) 滑板柯基: 360° Ollie Kickflip & Skate Dash!
// 4) 亂丟貓咪: Frequent multi-item household junk volleys!
window.SR = window.SR || {};

(function (SR) {
  const ENEMY_ARCHETYPES = {
    // Ground common enemies
    slime:            { w: 38, h: 30, hp: 52,  score: 120, flying: false },
    knight:           { w: 42, h: 46, hp: 98,  score: 220, flying: false, shielded: true },
    prism_turret:     { w: 40, h: 44, hp: 88,  score: 260, flying: false, lowKb: true },
    shadow_dasher:    { w: 38, h: 46, hp: 92,  score: 280, flying: false },
    // Flying common enemies
    wisp:             { w: 36, h: 36, hp: 58,  score: 160, flying: true, lowKb: true },
    bomber:           { w: 38, h: 36, hp: 68,  score: 190, flying: true, lowKb: true },
    // Scarce Elites (Named!)
    shiba_samurai:    { w: 48, h: 44, hp: 230, score: 560, flying: false, isElite: true, dashCd: 1.4, displayName: '柴犬武士' },
    delivery_scooter: { w: 56, h: 48, hp: 235, score: 560, flying: false, isElite: true, dashCd: 1.1, displayName: '外送飆車哥' },
    corgi_skater:     { w: 52, h: 44, hp: 225, score: 550, flying: false, isElite: true, dashCd: 1.0, displayName: '滑板柯基' },
    cat_thrower:      { w: 44, h: 46, hp: 215, score: 550, flying: false, isElite: true, dashCd: 0.7, displayName: '亂丟貓咪' }
  };

  const CAT_JUNK_ITEMS = ['cup', 'keyboard', 'beer', 'plant', 'fishbone', 'mouse', 'slipper', 'clock'];
  const DELIVERY_FOODS = ['boba', 'chicken_cutlet', 'meatball_skewer', 'stinky_tofu', 'fried_noodles', 'fried_rice'];

  // Helper: find a reachable solid or bar surface near (tx, desiredBottomY) for Shiba's platform-crossing dash!
  function findLandingSurface(level, tx, w, desiredBottomY, currentBottomY) {
    let best = null;
    let bestScore = Infinity;
    const cx = tx + w * 0.5;

    for (const s of level.solids) {
      if (s.kind === 'wall' || s.kind === 'arch') continue;
      if (cx >= s.x + 10 && cx <= s.x + s.w - 10) {
        const dyFromPlayer = Math.abs(s.y - desiredBottomY);
        const dyFromSelf = Math.abs(s.y - currentBottomY);
        if (dyFromSelf <= 170) {
          const score = dyFromPlayer + dyFromSelf * 0.25;
          if (score < bestScore) {
            bestScore = score;
            best = { y: s.y, minX: s.x + 12, maxX: s.x + s.w - 12 };
          }
        }
      }
    }
    for (const bar of level.bars) {
      if (cx >= bar.x + 8 && cx <= bar.x + bar.w - 8) {
        const dyFromPlayer = Math.abs(bar.y - desiredBottomY);
        const dyFromSelf = Math.abs(bar.y - currentBottomY);
        if (dyFromSelf <= 170) {
          const score = dyFromPlayer + dyFromSelf * 0.25;
          if (score < bestScore) {
            bestScore = score;
            best = { y: bar.y, minX: bar.x + 6, maxX: bar.x + bar.w - 6 };
          }
        }
      }
    }
    return best;
  }

  class Enemy {
    constructor(spec, mapMeta = null) {
      this.id = SR.nextEntityId();
      this.type = spec.type;
      const arch = ENEMY_ARCHETYPES[this.type] || ENEMY_ARCHETYPES.slime;
      const hpScale = (mapMeta && mapMeta.enemyHpScale) || 1;
      this.spdScale = (mapMeta && mapMeta.enemySpeedScale) || 1;
      this.hellStyle = !!(mapMeta && mapMeta.id === 'hell');

      this.w = arch.w;
      this.h = arch.h;
      this.hp = Math.round(arch.hp * hpScale);
      this.maxHp = this.hp;
      this.score = arch.score;
      this.flying = !!arch.flying;
      this.isElite = !!arch.isElite;
      this.displayName = arch.displayName || '';
      this.shielded = !!arch.shielded;
      this.lowKb = !!arch.lowKb;

      this.x = spec.x;
      this.y = spec.y;
      this.vx = 0;
      this.vy = 0;
      this.facing = -1;
      this.patrolMin = spec.patrolMin ?? spec.x - 160;
      this.patrolMax = spec.patrolMax ?? spec.x + 160;
      this.homeY = spec.homeY ?? spec.y;
      this.state = 'patrol';
      this.stateTimer = 0.45 + Math.random() * 0.75;
      this.animTime = Math.random() * 6;
      this.hitFlash = 0;
      this.chillTimer = 0;
      this.dead = false;
      this.isBoss = false;
      this.onGround = false;

      // Elite-specific state
      this.dashCd = arch.dashCd || 0;
      this.barkCd = 0.9;
      this.slashTrail = null;
      this.trickCount = 0;
      this.boardSpin = 0;
      this.heldItem = null;
    }

    get cx() { return this.x + this.w * 0.5; }
    get cy() { return this.y + this.h * 0.5; }

    takeDamage(dmg, hitFromX, isMagicOrHeavy, game) {
      if (this.dead) return;
      const onePunch = !!(game && game.cheats && game.cheats.onePunch);
      let finalDmg = onePunch ? 9999 : dmg;
      let guarded = false;
      if (!onePunch && this.shielded && !isMagicOrHeavy) {
        const hitFromFront = (this.facing > 0 && hitFromX > this.cx) || (this.facing < 0 && hitFromX < this.cx);
        if (hitFromFront) {
          finalDmg = Math.max(4, Math.round(dmg * 0.42));
          guarded = true;
        }
      }

      this.hp -= finalDmg;
      this.hitFlash = 0.14;
      if (this.type !== 'knight' || !guarded) {
        const kb = this.lowKb ? 80 : 120;
        this.vx += (this.cx >= hitFromX ? 1 : -1) * kb;
      }

      SR.audio.hit(isMagicOrHeavy);
      SR.particles.spawnBurst(this.cx, this.cy, guarded ? ['#b8ecff', '#ffffff'] : ['#ffe794', '#ff9fd6', '#ffffff'], guarded ? 6 : 9, {
        speedMin: 60, speedMax: 185, size: 3.5, shape: 'star'
      });
      SR.particles.spawnText(
        this.cx, this.y - 8,
        guarded ? `GUARD ${finalDmg}` : `${finalDmg}`,
        guarded ? '#b8f0ff' : (isMagicOrHeavy ? '#ffe68f' : '#ffffff'),
        guarded ? 0.85 : (isMagicOrHeavy ? 1.15 : 1)
      );

      if (this.hp <= 0) {
        this.dead = true;
        game.onEnemyKilled(this);
      }
    }

    update(dt, player, level, game) {
      this.animTime += dt;
      if (this.hitFlash > 0) this.hitFlash -= dt;
      if (this.chillTimer > 0) this.chillTimer -= dt;
      const effDt = this.chillTimer > 0 ? dt * 0.52 : dt;

      const dx = player.cx - this.cx;
      const dy = player.cy - this.cy;
      const dist = Math.hypot(dx, dy);
      if (dist > 980) return;

      const fn = ENEMY_AI[this.type];
      if (fn) fn.call(this, effDt, player, dx, dy, dist, level, game);
    }

    moveGround(dt, level) {
      this.vy = Math.min(820, this.vy + 1400 * dt);
      this.x += this.vx * dt;
      for (const s of level.solids) {
        if (SR.aabb(this, s)) {
          if (this.vx > 0) this.x = s.x - this.w;
          else if (this.vx < 0) this.x = s.x + s.w;
          this.vx *= -0.5;
        }
      }

      const prevBottom = this.y + this.h;
      this.y += this.vy * dt;
      this.onGround = false;
      for (const s of level.solids) {
        if (SR.aabb(this, s)) {
          if (this.vy >= 0) {
            this.y = s.y - this.h;
            this.vy = 0;
            this.onGround = true;
          } else {
            this.y = s.y + s.h;
            this.vy = 0;
          }
        }
      }
      if (!this.onGround && this.vy >= 0) {
        for (const bar of level.bars) {
          if (this.x + this.w > bar.x + 4 && this.x < bar.x + bar.w - 4) {
            if (prevBottom <= bar.y + 10 && this.y + this.h >= bar.y) {
              this.y = bar.y - this.h;
              this.vy = 0;
              this.onGround = true;
              break;
            }
          }
        }
      }

      if (this.y > 720) {
        this.y = 480;
        this.vy = 0;
      }
    }
  }

  const ENEMY_AI = {
    slime(dt, player, dx, dy, dist, level, game) {
      this.stateTimer -= dt;
      if (this.state === 'patrol') {
        this.vx = this.facing * 76 * this.spdScale;
        if (this.x < this.patrolMin) this.facing = 1;
        if (this.x + this.w > this.patrolMax) this.facing = -1;
        if (dist < 340 && this.onGround && this.stateTimer <= 0) {
          this.facing = dx >= 0 ? 1 : -1;
          this.state = 'windup';
          this.stateTimer = 0.42 / this.spdScale;
          this.vx = 0;
        }
      } else if (this.state === 'windup') {
        this.vx *= 0.85;
        if (this.stateTimer <= 0) {
          this.state = 'leap';
          this.vx = this.facing * 245 * this.spdScale;
          this.vy = -440;
          this.stateTimer = 0.9;
        }
      } else if (this.state === 'leap') {
        if ((this.onGround && this.vy >= 0) || this.stateTimer <= 0) {
          this.state = 'patrol';
          this.stateTimer = 1.0 / this.spdScale;
          this.vx = 0;
          if (this.hellStyle) {
            [-1, 1].forEach((d) => {
              game.enemyProjectiles.push({
                kind: 'orb', x: this.cx + d * 10, y: this.y + this.h - 10,
                vx: d * 210, vy: -120, gravity: 420, r: 7, life: 1.0, color: '#ff8c66', deflectable: true
              });
            });
          }
        }
      }
      this.moveGround(dt, level);
    },

    knight(dt, player, dx, dy, dist, level) {
      this.stateTimer -= dt;
      if (this.state === 'patrol') {
        this.shielded = true;
        this.vx = this.facing * 78 * this.spdScale;
        if (this.x < this.patrolMin) this.facing = 1;
        if (this.x + this.w > this.patrolMax) this.facing = -1;
        if (dist < 380 && Math.abs(dy) < 95 && this.stateTimer <= 0) {
          this.facing = dx >= 0 ? 1 : -1;
          this.state = 'windup';
          this.stateTimer = 0.52 / this.spdScale;
          this.vx = 0;
        }
      } else if (this.state === 'windup') {
        this.shielded = true;
        this.vx = 0;
        if (this.stateTimer <= 0) {
          this.state = 'charge';
          this.stateTimer = 0.72;
          this.vx = this.facing * 355 * this.spdScale;
        }
      } else if (this.state === 'charge') {
        this.shielded = true;
        this.vx = this.facing * 355 * this.spdScale;
        if (this.stateTimer <= 0 || this.x <= this.patrolMin - 20 || this.x + this.w >= this.patrolMax + 20) {
          this.state = 'recover';
          this.stateTimer = 0.8 / this.spdScale;
          this.vx = 0;
          this.shielded = false;
        }
      } else if (this.state === 'recover') {
        this.shielded = false;
        this.vx *= 0.85;
        if (this.stateTimer <= 0) {
          this.state = 'patrol';
          this.stateTimer = 0.85 / this.spdScale;
          this.facing = dx >= 0 ? 1 : -1;
        }
      }
      this.moveGround(dt, level);
    },

    wisp(dt, player, dx, dy, dist, level, game) {
      this.facing = dx >= 0 ? 1 : -1;
      const desiredY = this.homeY + Math.sin(this.animTime * 2.6) * 26;
      this.vy = (desiredY - this.y) * 3.5;

      if (dist < 170) this.vx += (-this.facing * 155 * this.spdScale - this.vx) * Math.min(1, dt * 4);
      else if (dist > 350 && dist < 620) this.vx += (this.facing * 95 * this.spdScale - this.vx) * Math.min(1, dt * 3);
      else this.vx *= Math.pow(0.25, dt);

      this.x += this.vx * dt;
      this.y += this.vy * dt;

      this.stateTimer -= dt;
      if (this.state === 'patrol' && dist < 520 && this.stateTimer <= 0) {
        this.state = 'aim_charge';
        this.stateTimer = 0.6 / this.spdScale;
      } else if (this.state === 'aim_charge' && this.stateTimer <= 0) {
        const ang = Math.atan2(player.cy - this.cy, player.cx - this.cx);
        game.enemyProjectiles.push({
          kind: 'orb', x: this.cx, y: this.cy,
          vx: Math.cos(ang) * 275 * this.spdScale, vy: Math.sin(ang) * 275 * this.spdScale,
          r: 9, life: 2.6, color: this.hellStyle ? '#ff80a8' : '#d8a6ff', deflectable: true
        });
        SR.particles.spawnRing(this.cx, this.cy, '#d8a6ff', 24, 0.22);
        this.state = 'patrol';
        this.stateTimer = 1.85 / this.spdScale;
      }
    },

    bomber(dt, player, dx, dy, dist, level, game) {
      this.stateTimer -= dt;
      if (this.state === 'patrol') {
        this.vx = this.facing * 130 * this.spdScale;
        if (this.x < this.patrolMin) this.facing = 1;
        if (this.x + this.w > this.patrolMax) this.facing = -1;
        this.y = this.homeY + Math.sin(this.animTime * 2.8) * 18;
        if (Math.abs(dx) < 140 && dist < 460 && this.stateTimer <= 0) {
          this.state = 'windup';
          this.stateTimer = 0.38 / this.spdScale;
          this.vx *= 0.3;
        }
      } else if (this.state === 'windup') {
        this.vx *= 0.9;
        if (this.stateTimer <= 0) {
          game.enemyProjectiles.push({
            kind: 'bomb', x: this.cx, y: this.y + this.h,
            vx: dx * 0.35, vy: 65, r: 11, gravity: 540, life: 2.2,
            color: this.hellStyle ? '#ff946b' : '#ffe48f', deflectable: true
          });
          this.state = 'patrol';
          this.stateTimer = 1.9 / this.spdScale;
        }
      }
      this.x += this.vx * dt;
    },

    prism_turret(dt, player, dx, dy, dist, level, game) {
      this.facing = dx >= 0 ? 1 : -1;
      this.stateTimer -= dt;
      this.vx *= 0.85;
      if (this.state === 'patrol' && dist < 560 && this.stateTimer <= 0) {
        this.state = 'aim_charge';
        this.stateTimer = 0.72 / this.spdScale;
      } else if (this.state === 'aim_charge' && this.stateTimer <= 0) {
        const base = Math.atan2(player.cy - this.cy, player.cx - this.cx);
        [-0.32, 0, 0.32].forEach((off) => {
          const ang = base + off;
          game.enemyProjectiles.push({
            kind: 'petal', x: this.cx, y: this.cy,
            vx: Math.cos(ang) * 285 * this.spdScale, vy: Math.sin(ang) * 285 * this.spdScale,
            r: 8.5, life: 2.5, color: this.hellStyle ? '#ff7da8' : '#9cf5ff', deflectable: true
          });
        });
        SR.particles.spawnRing(this.cx, this.cy, '#9cf5ff', 32, 0.25);
        this.state = 'patrol';
        this.stateTimer = 2.15 / this.spdScale;
      }
      this.moveGround(dt, level);
    },

    shadow_dasher(dt, player, dx, dy, dist, level) {
      this.stateTimer -= dt;
      if (this.state === 'patrol') {
        this.vx = this.facing * 95 * this.spdScale;
        if (this.x < this.patrolMin) this.facing = 1;
        if (this.x + this.w > this.patrolMax) this.facing = -1;
        if (dist < 420 && Math.abs(dy) < 130 && this.stateTimer <= 0) {
          this.state = 'blink_prep';
          this.stateTimer = 0.42 / this.spdScale;
          this.vx = 0;
        }
      } else if (this.state === 'blink_prep') {
        this.vx = 0;
        if (this.stateTimer <= 0) {
          SR.particles.spawnRing(this.cx, this.cy, '#d59bff', 38, 0.25);
          const side = dx >= 0 ? -1 : 1;
          const nx = SR.clamp(player.cx + side * 125, this.patrolMin, this.patrolMax - this.w);
          this.x = nx;
          this.facing = player.cx >= this.cx ? 1 : -1;
          SR.particles.spawnRing(this.cx, this.cy, '#ff8fc8', 42, 0.25);
          this.state = 'slash_dash';
          this.stateTimer = 0.36;
          this.vx = this.facing * 430 * this.spdScale;
        }
      } else if (this.state === 'slash_dash') {
        if (this.stateTimer <= 0) {
          this.state = 'patrol';
          this.stateTimer = 1.45 / this.spdScale;
          this.vx = 0;
        }
      }
      this.moveGround(dt, level);
    },

    // 小頭目 #1: 柴犬武士 (UPGRADED!)
    // - Skill (CD): 0.5s Hilt-Grip -> Platform-Crossing Instant Iaijutsu Dash (can flash onto another platform/bar!)
    // - Normal Ranged Attack: Sonic Bark Sound Wave (汪！) that pushes the player back a distance!
    shiba_samurai(dt, player, dx, dy, dist, level, game) {
      if (this.dashCd > 0) this.dashCd -= dt;
      if (this.barkCd > 0) this.barkCd -= dt;
      if (this.slashTrail) {
        this.slashTrail.life -= dt;
        if (this.slashTrail.life <= 0) this.slashTrail = null;
      }
      this.stateTimer -= dt;

      if (this.state === 'patrol') {
        this.facing = dx >= 0 ? 1 : -1;
        this.vx = Math.abs(dx) > 58 ? this.facing * 140 * this.spdScale : this.vx * 0.8;
        if (this.x < this.patrolMin && this.vx < 0) this.vx = 0;
        if (this.x + this.w > this.patrolMax && this.vx > 0) this.vx = 0;

        // SKILL: Platform-crossing Iaijutsu Dash (can cross onto player's platform up to ±165px vertically!)
        if (this.dashCd <= 0 && dist < 410 && Math.abs(dy) < 165) {
          this.state = 'sheath_hold';
          this.stateTimer = 0.5; // Exact 0.5s hilt-grip telegraph!
          this.vx = 0;
          this.facing = dx >= 0 ? 1 : -1;
          if (SR.audio.katanaGlint) SR.audio.katanaGlint();
          SR.particles.spawnRing(this.cx + this.facing * 10, this.cy + 4, '#ffe894', 32, 0.3);
          SR.particles.spawnText(this.cx, this.y - 18, '居合・飛躍斬！', '#ffe894', 0.98);
        } else if (this.barkCd <= 0 && dist < 520 && Math.abs(dy) < 190) {
          // NORMAL RANGED ATTACK: Sonic Bark Sound Wave (pushes player away!)
          this.state = 'bark_windup';
          this.stateTimer = 0.28;
          this.vx = 0;
          this.facing = dx >= 0 ? 1 : -1;
        }
      } else if (this.state === 'bark_windup') {
        this.vx = 0;
        this.facing = dx >= 0 ? 1 : -1;
        if (this.stateTimer <= 0) {
          const ang = Math.atan2(player.cy - this.cy, player.cx - this.cx);
          const spd = 415 * this.spdScale;
          game.enemyProjectiles.push({
            kind: 'bark_wave',
            x: this.cx + this.facing * 20,
            y: this.cy - 6,
            vx: Math.cos(ang) * spd,
            vy: Math.sin(ang) * spd,
            r: 18,
            life: 1.45,
            color: '#ffe58f',
            pushForce: 620,
            pushLift: -210,
            deflectable: true
          });
          if (SR.audio.bark) SR.audio.bark();
          SR.particles.spawnRing(this.cx + this.facing * 18, this.cy - 6, '#ffe58f', 42, 0.25);
          SR.particles.spawnText(this.cx + this.facing * 16, this.y - 20, '汪！！', '#ffe894', 1.15);
          this.state = 'patrol';
          this.barkCd = 1.45 / this.spdScale;
        }
      } else if (this.state === 'sheath_hold') {
        this.vx = 0;
        if (this.stateTimer <= 0) {
          // INSTANT PLATFORM-CROSSING IAIJUTSU DASH!
          const startX = this.cx;
          const startY = this.cy;
          const minBound = (this.isBossSummon && game && game.activeArena) ? (game.activeArena.minX + 16) : 60;
          const maxBound = (this.isBossSummon && game && game.activeArena) ? (game.activeArena.maxX - this.w - 16) : (level.width - this.w - 60);
          const dashDist = SR.clamp(Math.abs(dx) + 70, 210, 340);
          const rawTargetX = SR.clamp(this.x + this.facing * dashDist, minBound, maxBound);

          // Try landing cleanly on a platform/bar near targetX & player's height!
          const surf = findLandingSurface(level, rawTargetX, this.w, player.y + player.h, this.y + this.h);
          let validX = this.x;
          let validY = this.y;

          if (surf) {
            const destY = surf.y - this.h;
            const testBox = { x: rawTargetX, y: destY, w: this.w, h: this.h };
            const insideSolid = level.solids.some(s => SR.aabb(testBox, s));
            if (!insideSolid) {
              validX = rawTargetX;
              validY = destY;
              // Adopt new platform patrol bounds (kept strictly inside arena when summoned by boss!)
              this.patrolMin = SR.clamp(Math.min(surf.minX, validX), minBound, maxBound + this.w);
              this.patrolMax = SR.clamp(Math.max(surf.maxX, validX + this.w), minBound, maxBound + this.w);
            }
          }

          // Fallback: horizontal raycast step if destination was blocked
          if (validX === this.x && validY === this.y) {
            for (let s = 1; s <= 12; s++) {
              const testX = this.x + (rawTargetX - this.x) * (s / 12);
              const testBox = { x: testX, y: this.y, w: this.w, h: this.h };
              if (level.solids.some(sol => SR.aabb(testBox, sol))) break;
              validX = testX;
            }
          }

          this.x = validX;
          this.y = validY;
          this.vy = 0;
          const endX = this.cx;
          const endY = this.cy;
          this.slashTrail = { x1: startX, y1: startY, x2: endX + this.facing * 24, y2: endY, life: 0.38, maxLife: 0.38 };
          SR.audio.slash(3);
          SR.particles.spawnBurst(startX, startY, ['#ffe894', '#ffffff'], 10, { speedMin: 40, speedMax: 150, size: 3.5, shape: 'star' });
          SR.particles.spawnBurst(endX, endY, ['#ffe894', '#ff9fd6', '#ffffff'], 14, { speedMin: 60, speedMax: 190, size: 4, shape: 'star' });

          // Diagonal slash segment collision check!
          const abx = (endX + this.facing * 24) - startX;
          const aby = endY - startY;
          const ab2 = Math.max(1, abx * abx + aby * aby);
          const tProj = SR.clamp(((player.cx - startX) * abx + (player.cy - startY) * aby) / ab2, 0, 1);
          const nearX = startX + abx * tProj;
          const nearY = startY + aby * tProj;
          if (Math.hypot(player.cx - nearX, player.cy - nearY) < 38) {
            player.takeDamage(1, this.facing, game, false, 'dash');
          }

          this.state = 'recover';
          this.stateTimer = 0.36;
          this.dashCd = 3.2 / this.spdScale; // Dash treated as Shiba's signature Skill CD!
        }
      } else if (this.state === 'recover') {
        this.vx *= 0.85;
        if (this.stateTimer <= 0) {
          this.state = 'patrol';
          this.facing = dx >= 0 ? 1 : -1;
        }
      }
      this.moveGround(dt, level);
    },

    // 小頭目 #2: 外送飆車哥 (UPGRADED — Full Taiwanese Delivery Feast!)
    // Throws 珍奶, 雞排, 肉丸子串, 臭豆腐, 炒麵, 炒飯!
    delivery_scooter(dt, player, dx, dy, dist, level, game) {
      if (this.dashCd > 0) this.dashCd -= dt;
      this.stateTimer -= dt;

      if (this.state === 'patrol') {
        this.vx = this.facing * 135 * this.spdScale;
        if (this.x < this.patrolMin) this.facing = 1;
        if (this.x + this.w > this.patrolMax) this.facing = -1;
        if (this.dashCd <= 0 && dist < 480 && Math.abs(dy) < 170) {
          this.facing = dx >= 0 ? 1 : -1;
          this.state = 'rev_windup';
          this.stateTimer = 0.48;
          this.vx = 0;
          const calls = ['雞排臭豆腐來囉！', '外送全餐到了！', '炒飯炒麵珍奶！'];
          SR.particles.spawnText(this.cx, this.y - 16, calls[Math.floor(Math.random() * calls.length)], '#ff9fd6', 0.92);
        }
      } else if (this.state === 'rev_windup') {
        this.vx = 0;
        if (this.stateTimer <= 0) {
          this.state = 'zoom';
          this.stateTimer = 0.88;
          this.vx = this.facing * 430 * this.spdScale;
          // Toss 3–4 assorted Taiwanese delivery foods!
          const count = this.hellStyle ? 4 : 3;
          for (let i = 0; i < count; i++) {
            const food = DELIVERY_FOODS[Math.floor(Math.random() * DELIVERY_FOODS.length)];
            const mult = 0.65 + i * 0.34;
            game.enemyProjectiles.push({
              kind: 'delivery_food',
              foodType: food,
              x: this.cx,
              y: this.y + 6,
              vx: this.facing * (195 * mult),
              vy: -310 - i * 62,
              gravity: 760,
              bounces: (food === 'boba' || food === 'meatball_skewer') ? 2 : 1,
              r: food === 'chicken_cutlet' ? 13 : 11.5,
              life: 2.8,
              color: food === 'stinky_tofu' ? '#b8ff9c' : '#ffd894',
              deflectable: true
            });
          }
          SR.audio.slide();
        }
      } else if (this.state === 'zoom') {
        this.vx = this.facing * 430 * this.spdScale;
        if (this.stateTimer <= 0 || this.x <= this.patrolMin - 15 || this.x + this.w >= this.patrolMax + 15) {
          this.state = 'patrol';
          this.vx = 0;
          this.dashCd = 2.0 / this.spdScale;
          this.facing = dx >= 0 ? 1 : -1;
        }
      }
      this.moveGround(dt, level);
    },

    // 小頭目 #3: 滑板柯基 (Skateboarding Corgi)
    corgi_skater(dt, player, dx, dy, dist, level, game) {
      if (this.dashCd > 0) this.dashCd -= dt;
      this.stateTimer -= dt;

      if (this.state === 'patrol') {
        this.boardSpin *= 0.85;
        this.vx = this.facing * 140 * this.spdScale;
        if (this.x < this.patrolMin) this.facing = 1;
        if (this.x + this.w > this.patrolMax) this.facing = -1;
        if (this.dashCd <= 0 && dist < 440 && Math.abs(dy) < 160) {
          this.facing = dx >= 0 ? 1 : -1;
          this.state = 'kickflip_windup';
          this.stateTimer = 0.45;
          this.vx = 0;
          this.trickCount++;
          SR.particles.spawnText(this.cx, this.y - 16, this.trickCount % 2 === 1 ? 'OLLIE! 🛹' : '滑板衝刺！', '#ffe58f', 0.92);
        }
      } else if (this.state === 'kickflip_windup') {
        this.vx = 0;
        if (this.stateTimer <= 0) {
          if (this.trickCount % 2 === 1) {
            this.state = 'ollie_air';
            this.vx = this.facing * SR.clamp(Math.abs(dx) * 1.15, 200, 340) * this.spdScale;
            this.vy = -520;
            this.stateTimer = 1.25;
            SR.audio.jump(true);
          } else {
            this.state = 'skate_dash';
            this.vx = this.facing * 460 * this.spdScale;
            this.stateTimer = 0.82;
            SR.audio.slide();
            [-0.22, -0.04, 0.14].forEach((angOff) => {
              const base = this.facing > 0 ? 0 : Math.PI;
              game.enemyProjectiles.push({
                kind: 'orb', x: this.cx + this.facing * 20, y: this.y + this.h - 8,
                vx: Math.cos(base + angOff) * 355, vy: Math.sin(base + angOff) * 355,
                r: 8.5, life: 1.8, color: '#ffe58f', deflectable: true
              });
            });
          }
        }
      } else if (this.state === 'ollie_air') {
        this.boardSpin += dt * 16;
        if ((this.onGround && this.vy >= 0) || this.stateTimer <= 0) {
          this.boardSpin = 0;
          SR.audio.hit(true);
          SR.particles.spawnRing(this.cx, this.y + this.h, '#ffe58f', 64, 0.3);
          [-1, 1].forEach((dir) => {
            game.enemyProjectiles.push({
              kind: 'wave', x: this.cx + dir * 18, y: this.y + this.h - 12,
              vx: dir * 295 * this.spdScale, vy: 0, r: 12, life: 1.2, color: '#ffbfa0', deflectable: true
            });
          });
          this.state = 'patrol';
          this.vx = 0;
          this.dashCd = 2.0 / this.spdScale;
        }
      } else if (this.state === 'skate_dash') {
        this.vx = this.facing * 460 * this.spdScale;
        if (Math.random() < 0.45) {
          SR.particles.spawnBurst(this.cx - this.facing * 16, this.y + this.h, ['#ffe58f', '#8be4ff'], 2, {
            speedMin: 30, speedMax: 90, upward: 35, size: 2.8
          });
        }
        if (this.stateTimer <= 0 || this.x <= this.patrolMin - 15 || this.x + this.w >= this.patrolMax + 15) {
          this.state = 'patrol';
          this.vx = 0;
          this.dashCd = 1.95 / this.spdScale;
          this.facing = dx >= 0 ? 1 : -1;
        }
      }
      this.moveGround(dt, level);
    },

    // 小頭目 #4: 亂丟貓咪 (UPGRADED — Faster, More Frequent, 4–5 Items per Throw!)
    cat_thrower(dt, player, dx, dy, dist, level, game) {
      if (this.dashCd > 0) this.dashCd -= dt;
      this.stateTimer -= dt;

      if (this.state === 'patrol') {
        this.heldItem = null;
        this.facing = dx >= 0 ? 1 : -1;
        if (dist < 150) this.vx = -this.facing * 135 * this.spdScale;
        else if (dist > 380) this.vx = this.facing * 110 * this.spdScale;
        else this.vx *= 0.85;
        if (this.x < this.patrolMin && this.vx < 0) this.vx = 0;
        if (this.x + this.w > this.patrolMax && this.vx > 0) this.vx = 0;

        if (this.dashCd <= 0 && dist < 580 && Math.abs(dy) < 250) {
          this.state = 'grab_windup';
          this.stateTimer = 0.28; // Much quicker windup!
          this.vx = 0;
          this.heldItem = CAT_JUNK_ITEMS[Math.floor(Math.random() * CAT_JUNK_ITEMS.length)];
          SR.particles.spawnText(this.cx, this.y - 18, '喵！全丟出去！', '#ffbae0', 0.94);
        }
      } else if (this.state === 'grab_windup') {
        this.facing = dx >= 0 ? 1 : -1;
        this.vx = 0;
        if (this.stateTimer <= 0) {
          // Hurls 4–5 chaotic household items in varied arcs!
          const count = this.hellStyle ? 5 : 4;
          const aimX = SR.clamp(Math.abs(dx) * 1.08, 155, 480);
          for (let i = 0; i < count; i++) {
            const itemType = i === 0 && this.heldItem
              ? this.heldItem
              : CAT_JUNK_ITEMS[Math.floor(Math.random() * CAT_JUNK_ITEMS.length)];
            const spreadMult = 0.72 + i * 0.19;
            const arcVy = -270 - i * 58 + SR.clamp(dy * 0.45, -130, 60);
            game.enemyProjectiles.push({
              kind: 'cat_junk',
              itemType,
              x: this.cx + this.facing * 14,
              y: this.y + 4,
              vx: this.facing * aimX * spreadMult,
              vy: arcVy,
              gravity: 690,
              bounces: (itemType === 'cup' || itemType === 'beer' || itemType === 'clock') ? 1 : 0,
              r: itemType === 'keyboard' ? 13 : 10.5,
              life: 2.9,
              color: '#ffe594',
              deflectable: true
            });
          }
          SR.audio.shoot(false);
          this.heldItem = null;
          this.state = 'patrol';
          this.dashCd = 1.05 / this.spdScale; // Throws much more frequently!
        }
      }
      this.moveGround(dt, level);
    }
  };

  SR.ENEMY_ARCHETYPES = ENEMY_ARCHETYPES;
  SR.Enemy = Enemy;
})(window.SR);
