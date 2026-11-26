// Playable Hero Controller (Luna · Pip · Lyra)
// - Dual Aiming: 360° Mouse Aim (Style A) + Classic 0°/±90° Directional Key Aim (Style B)
// - Luna (Wizard · Beginner): 🔥 Fire Bolt Attack · ❄️ Piercing Ice Volley Skill · ⚡ Thunderbolt Ult
// - Pip (Shooter · Intermediate): 30° 3-Silver-Bullet Burst · 🌟 Piercing Golden Volley Skill · ☄️ Solar Nova Golden Ult
// - Lyra (Warrior · Advanced): Sleek Star-Blade + 🗡️ Directional Blade Surge Skill (cuts & blocks front shots, ends with 劍氣!) + ☄️ Starfall Ult
window.SR = window.SR || {};

(function (SR) {
  class Player {
    constructor(charId, x, y) {
      this.def = SR.CHAR_DEFS[charId] || SR.CHAR_DEFS.blade;
      this.charId = this.def.id;
      this.w = 34;
      this.normalH = 48;
      this.slideH = 24;
      this.h = this.normalH;
      this.x = x;
      this.y = y - this.h;
      this.vx = 0;
      this.vy = 0;
      this.facing = 1;

      this.hp = this.def.maxHp;
      this.maxHp = this.def.maxHp;
      this.onGround = false;
      this.onBar = false;
      this.jumpsLeft = 2;
      this.airJumpCount = 0;
      this.coyoteTimer = 0;
      this.jumpBuffer = 0;
      this.dropThroughTimer = 0;

      // Slide state
      this.sliding = false;
      this.slideTimer = 0;
      this.slideExtraLeft = 0;
      this.slideCooldown = 0;
      this.slideDodgeFxCd = 0;

      // Dual Aiming state (360° Mouse or 0°/±90° Keyboard)
      this.aimMode = 'keyboard';
      this.aimAngle = 0; // Radians in world space (0 = right, PI = left, -PI/2 = up, +PI/2 = down)
      this.aimUp = false;
      this.castRecoil = 0;
      this.lastSpellElement = 'fire';

      // Weather puddle temporary slow status
      this.slowTimer = 0;

      // Combat state
      this.attackTimer = 0;
      this.attackAnim = 0;
      this.comboStep = 0;
      this.comboResetTimer = 0;
      this.shotCount = 0;
      this.skillMaxCharges = this.def.skillMaxCharges || 2;
      this.skillCharges = this.skillMaxCharges;
      this.skillTimer = 0;
      this.skillCastGap = 0;
      this.ultimateTimer = 0;
      this.ultimateFlash = 0;
      this.invulnTimer = 0;
      this.hurtTimer = 0;
      this.hitFlash = 0;

      // Lyra Skill: Directional Blade Surge (cuts enemies, blocks frontal projectiles, fires 劍氣 at end!)
      this.bladeSurging = false;
      this.bladeSurgeTimer = 0;
      this.bladeSurgeAngle = 0;
      this.bladeSurgeTick = 0;

      // Pip Ult multi-wave Solar Nova state
      this.ultWavesLeft = 0;
      this.ultWaveTimer = 0;

      // Visual animation
      this.runTime = 0;
      this.squashX = 1;
      this.squashY = 1;
      this.ribbon = [];
      for (let i = 0; i < 6; i++) {
        this.ribbon.push({ x: this.x, y: this.y + 18 });
      }
      this.afterimageTimer = 0;
    }

    get cx() { return this.x + this.w * 0.5; }
    get cy() { return this.y + this.h * 0.5; }
    get shoulderY() { return this.y + (this.sliding ? 11 : 21); }

    applySlow(duration) {
      this.slowTimer = Math.max(this.slowTimer, duration);
    }

    // Safely attempt to exit slide without clipping head into low arch ceilings
    tryStandUp(solids) {
      if (!this.sliding && this.h === this.normalH) return true;
      if (solids && !this.canStandUp(solids)) {
        this.sliding = true;
        this.slideTimer = Math.max(this.slideTimer, 0.12);
        return false;
      }
      const bottom = this.y + this.h;
      this.sliding = false;
      this.h = this.normalH;
      this.y = bottom - this.h;
      return true;
    }

    // Strong external knockback push (e.g., Shiba's Bark Sound Wave!)
    applyKnockbackPush(dir, forceX = 560, liftY = -220, solids = null) {
      this.bladeSurging = false;
      this.bladeSurgeTimer = 0;
      const stoodUp = this.tryStandUp(solids);
      this.vx = dir * forceX;
      this.vy = stoodUp ? Math.min(this.vy, liftY) : 0;
      this.hurtTimer = Math.max(this.hurtTimer, 0.34);
      if (stoodUp) this.onGround = false;
    }

    canStandUp(solids) {
      const testBox = {
        x: this.x + 2,
        y: this.y - (this.normalH - this.slideH),
        w: this.w - 4,
        h: this.normalH
      };
      for (const s of solids) {
        if (SR.aabb(testBox, s)) return false;
      }
      return true;
    }

    startSlide() {
      if (this.sliding || this.slideCooldown > 0 || this.bladeSurging) return;
      this.sliding = true;
      this.slideTimer = this.def.slideDuration;
      this.slideExtraLeft = 0.24;
      this.slideCooldown = 0.24;
      this.slideDodgeFxCd = 0;
      const bottom = this.y + this.h;
      this.h = this.slideH;
      this.y = bottom - this.h;
      const slowMult = this.slowTimer > 0 ? 0.62 : 1.0;
      this.vx = this.facing * this.def.slideSpeed * slowMult;
      this.squashX = 1.32;
      this.squashY = 0.72;
      SR.audio.slide();
      SR.particles.spawnBurst(this.cx - this.facing * 12, this.y + this.h, [this.def.primaryColor, '#ffffff'], 8, {
        speedMin: 40, speedMax: 140, upward: 45, size: 3.5, shape: 'star'
      });
    }

    endSlide(solids) {
      if (!this.sliding) return;
      if (!this.canStandUp(solids)) {
        this.slideTimer = 0.06;
        this.vx = this.facing * Math.max(220, Math.abs(this.vx) * 0.94);
        return;
      }
      const bottom = this.y + this.h;
      this.sliding = false;
      this.h = this.normalH;
      this.y = bottom - this.h;
      this.squashX = 0.88;
      this.squashY = 1.14;
    }

    // Computes exact firing angle from Mouse (360°) OR Directional Keys (0° / ±90°)
    updateAim(input) {
      this.aimMode = input.aimMode || 'keyboard';
      if (this.aimMode === 'mouse' && typeof input.mouseWorldX === 'number' && typeof input.mouseWorldY === 'number') {
        const dx = input.mouseWorldX - this.cx;
        const dy = input.mouseWorldY - this.shoulderY;
        if (Math.hypot(dx, dy) > 4) {
          this.aimAngle = Math.atan2(dy, dx);
        }
        // Turn hero smoothly toward mouse cursor when not locked in slide/surge
        if (!this.sliding && !this.bladeSurging && Math.abs(dx) > 6) {
          this.facing = dx >= 0 ? 1 : -1;
        }
      } else {
        // Style B Classic 0° / ±90° Keyboard Aim:
        // Hold ↑ -> -90° (Straight UP); Hold ↓ in mid-air -> +90° (Straight DOWN); otherwise 0°/180° horizontal!
        if (input.aimUp) {
          this.aimAngle = -Math.PI * 0.5;
        } else if (input.aimDown && !this.onGround && !this.sliding) {
          this.aimAngle = Math.PI * 0.5;
        } else {
          this.aimAngle = this.facing > 0 ? 0 : Math.PI;
        }
      }
      this.aimUp = this.aimAngle < -Math.PI * 0.25 && this.aimAngle > -Math.PI * 0.75;
    }

    // Exact world spawn coordinates at the tip of the aimed staff / gun barrel / sword!
    getWeaponMuzzle(angle = this.aimAngle, reach = 26) {
      return {
        x: this.cx + Math.cos(angle) * reach,
        y: this.shoulderY + Math.sin(angle) * reach
      };
    }

    update(dt, input, level, game) {
      if (this.coyoteTimer > 0) this.coyoteTimer -= dt;
      if (this.jumpBuffer > 0) this.jumpBuffer -= dt;
      if (this.dropThroughTimer > 0) this.dropThroughTimer -= dt;
      if (this.slideCooldown > 0) this.slideCooldown -= dt;
      if (this.attackTimer > 0) this.attackTimer -= dt;
      if (this.attackAnim > 0) this.attackAnim -= dt;
      if (this.castRecoil > 0) this.castRecoil = Math.max(0, this.castRecoil - dt * 5.5);
      if (this.comboResetTimer > 0) {
        this.comboResetTimer -= dt;
        if (this.comboResetTimer <= 0) this.comboStep = 0;
      }
      if (this.skillCastGap > 0) this.skillCastGap -= dt;
      if (this.skillCharges < this.skillMaxCharges) {
        if (this.skillTimer <= 0) this.skillTimer = this.def.skillCooldown;
        this.skillTimer -= dt;
        if (this.skillTimer <= 0) {
          this.skillCharges++;
          this.skillTimer = this.skillCharges < this.skillMaxCharges ? this.def.skillCooldown : 0;
        }
      } else {
        this.skillTimer = 0;
      }
      if (this.ultimateTimer > 0) this.ultimateTimer -= dt;
      if (this.ultimateFlash > 0) this.ultimateFlash -= dt;
      if (this.invulnTimer > 0) this.invulnTimer -= dt;
      if (this.slideDodgeFxCd > 0) this.slideDodgeFxCd -= dt;
      if (this.hurtTimer > 0) this.hurtTimer -= dt;
      if (this.hitFlash > 0) this.hitFlash -= dt;
      if (this.slowTimer > 0) this.slowTimer -= dt;

      this.squashX += (1 - this.squashX) * Math.min(1, dt * 14);
      this.squashY += (1 - this.squashY) * Math.min(1, dt * 14);

      let move = 0;
      if (input.left) move -= 1;
      if (input.right) move += 1;

      if (move !== 0 && !this.sliding && !this.bladeSurging) {
        this.facing = move;
      }

      // Resolve aim BEFORE combat & active abilities so projectiles always match visual weapon angle!
      this.updateAim(input);
      this.updateActiveAbilities(dt, level, game);

      // Drop through one-way bar
      if (this.onBar && input.down && input.jumpPressed) {
        this.dropThroughTimer = 0.24;
        this.onGround = false;
        this.onBar = false;
        this.y += 4;
        this.vy = Math.max(this.vy, 90);
        input.jumpPressed = false;
      }

      // Slide / drop input
      if ((input.slidePressed || (input.downPressed && this.onGround && !this.onBar)) && this.hurtTimer <= 0 && !this.bladeSurging) {
        this.startSlide();
      } else if (input.downPressed && this.onBar && !this.bladeSurging) {
        this.dropThroughTimer = 0.24;
        this.onGround = false;
        this.onBar = false;
        this.y += 4;
        this.vy = Math.max(this.vy, 90);
      }

      if (input.jumpPressed) {
        this.jumpBuffer = 0.14;
      }

      const speedMult = this.slowTimer > 0 ? 0.48 : 1.0;
      this.updateHorizontalMotion(dt, move, speedMult, input, level);
      this.updateJumpAndGravity(dt, input, level);
      this.handleCombatInputs(input, level, game);
      this.resolveWorldCollision(dt, level, game);
      this.updateRibbon(dt, game.time || 0);

      if (this.y > 760) {
        this.y = 320;
        this.vy = 0;
        this.bladeSurging = false;
        this.bladeSurgeTimer = 0;
      }
    }

    finishBladeSurge(game, hitWall = false) {
      if (!this.bladeSurging) return;
      this.bladeSurging = false;
      this.bladeSurgeTimer = 0;
      const ang = this.bladeSurgeAngle;
      const dirX = Math.cos(ang);
      const dirY = Math.sin(ang);

      // Smooth momentum carry + brief post-surge grace so finishing near a boss feels fair & crisp!
      this.vx = hitWall ? 0 : dirX * 220;
      this.vy = hitWall ? Math.min(0, this.vy) : Math.max(-240, dirY * 190);
      this.invulnTimer = Math.max(this.invulnTimer, 0.22);
      this.squashX = 1.18;
      this.squashY = 0.86;

      // Fire powerful white-inside / electric-blue-outside 劍氣 wave at the end of the sprint!
      const muzzle = this.getWeaponMuzzle(ang, 28);
      SR.audio.slash(3);
      SR.particles.spawnRing(muzzle.x, muzzle.y, '#38a0ff', 76, 0.28);
      SR.particles.spawnBurst(muzzle.x, muzzle.y, ['#ffffff', '#3ea4ff', '#ffe894'], 14, {
        angle: ang, spread: 1.1, speedMin: 90, speedMax: 240, size: 4.5, shape: 'star', gravity: 0
      });
      game.playerProjectiles.push({
        kind: 'sword_qi',
        x: muzzle.x,
        y: muzzle.y,
        vx: dirX * 720,
        vy: dirY * 720,
        r: 38,
        dmg: 46,
        pierce: 6,
        hitIds: new Set(),
        life: 0.68,
        color: '#1e88ff',
        magic: true
      });
    }

    updateActiveAbilities(dt, level, game) {
      // Pip Ult: 3 rapid Solar Nova waves following Pip's live aimAngle!
      if (this.ultWavesLeft > 0) {
        this.ultWaveTimer -= dt;
        if (this.ultWaveTimer <= 0) {
          this.ultWavesLeft--;
          this.ultWaveTimer = 0.16;
          this.firePipUltimateWave(game, this.aimAngle);
        }
      }

      // Lyra Skill: Directional Blade Surge (~820 px/s, ~0.34s, cuts enemies & blocks frontal shots!)
      if (this.bladeSurging) {
        this.bladeSurgeTimer -= dt;
        const dirX = Math.cos(this.bladeSurgeAngle);
        const dirY = Math.sin(this.bladeSurgeAngle);
        const surgeSpeed = 820;
        this.vx = dirX * surgeSpeed;
        this.vy = dirY * surgeSpeed;
        if (Math.abs(dirX) > 0.15) this.facing = dirX >= 0 ? 1 : -1;

        // Block & deflect enemy projectiles strictly in FRONT of Lyra's held sword (NOT from her back!)
        if (SR.Combat && SR.Combat.applyBladeSurgeBlock) {
          SR.Combat.applyBladeSurgeBlock(game, this, dirX, dirY);
        }

        // Crisp sword-trail afterimages
        this.afterimageTimer -= dt;
        if (this.afterimageTimer <= 0) {
          this.afterimageTimer = 0.036;
          SR.particles.spawnAfterimage(this.cx, this.y + this.h, this.facing, this.charId, false);
          SR.particles.spawnBurst(this.cx + dirX * 26, this.shoulderY + dirY * 26, ['#ffffff', '#48b2ff', '#ffe894'], 3, {
            speedMin: 30, speedMax: 110, size: 3.4, shape: 'star', gravity: 0
          });
        }

        // Slice enemies along the forward path
        this.bladeSurgeTick -= dt;
        if (this.bladeSurgeTick <= 0) {
          this.bladeSurgeTick = 0.06;
          const leadX = this.cx + dirX * 24;
          const leadY = this.shoulderY + dirY * 24;
          const surgeBox = { x: leadX - 42, y: leadY - 38, w: 84, h: 76 };
          game.applyPlayerMelee(surgeBox, 22, this.facing, true);
        }

        if (this.bladeSurgeTimer <= 0) {
          this.finishBladeSurge(game, false);
        }
      }
    }

    updateHorizontalMotion(dt, move, speedMult, input, level) {
      if (this.bladeSurging) {
        return; // Velocity controlled directly by Blade Surge vector!
      } else if (this.sliding) {
        this.slideTimer -= dt;
        this.vx *= Math.pow(0.42, dt);
        if (Math.abs(this.vx) < 285 * speedMult) this.vx = this.facing * 285 * speedMult;
        this.afterimageTimer -= dt;
        if (this.afterimageTimer <= 0) {
          this.afterimageTimer = 0.045;
          SR.particles.spawnAfterimage(this.cx, this.y + this.h, this.facing, this.charId, true);
        }
        if (this.slideTimer <= 0) {
          if ((input.slideHeld || input.down) && this.slideExtraLeft > 0) {
            const ext = Math.min(dt, this.slideExtraLeft);
            this.slideExtraLeft -= ext;
            this.slideTimer = 0.01;
          } else {
            this.endSlide(level.solids);
          }
        }
      } else if (this.hurtTimer > 0) {
        this.vx *= Math.pow(0.08, dt);
      } else {
        const targetVx = move * this.def.speed * speedMult;
        const accel = this.onGround ? 2450 : 1650;
        if (this.vx < targetVx) this.vx = Math.min(targetVx, this.vx + accel * dt);
        else if (this.vx > targetVx) this.vx = Math.max(targetVx, this.vx - accel * dt);
      }
    }

    updateJumpAndGravity(dt, input, level) {
      if (this.jumpBuffer > 0 && !this.bladeSurging) {
        const canFirstJump = this.onGround || this.coyoteTimer > 0;
        const canDoubleJump = !canFirstJump && this.jumpsLeft > 0;
        if (canFirstJump || canDoubleJump) {
          if (this.sliding) {
            if (this.canStandUp(level.solids)) {
              this.endSlide(level.solids);
            } else {
              this.jumpBuffer = 0;
            }
          }
          if (!this.sliding) {
            const isDouble = !canFirstJump;
            this.vy = isDouble ? this.def.doubleJumpVel : this.def.jumpVel;
            this.onGround = false;
            this.onBar = false;
            this.coyoteTimer = 0;
            this.jumpBuffer = 0;
            this.jumpsLeft = isDouble ? 0 : 1;
            this.airJumpCount++;
            this.squashX = 0.78;
            this.squashY = 1.26;
            SR.audio.jump(isDouble);
            SR.particles.spawnBurst(
              this.cx,
              this.y + this.h,
              isDouble ? [this.def.primaryColor, '#ffe9a6', '#ffffff'] : ['#ffffff', '#ffe0f4'],
              isDouble ? 11 : 6,
              { speedMin: 35, speedMax: 135, upward: 20, size: isDouble ? 4 : 3, shape: isDouble ? 'star' : 'circle', gravity: 60 }
            );
            if (isDouble) {
              SR.particles.spawnRing(this.cx, this.y + this.h, this.def.primaryColor, 30, 0.24);
            }
          }
        }
      }

      if (!input.jumpHeld && this.vy < -260 && !this.bladeSurging) {
        this.vy += this.def.gravity * 1.45 * dt;
      }

      if (!this.bladeSurging) {
        this.vy = Math.min(960, this.vy + this.def.gravity * dt);
      }
    }

    handleCombatInputs(input, level, game) {
      if (input.attackHeld && this.attackTimer <= 0 && this.hurtTimer <= 0 && !this.bladeSurging) {
        this.performAttack(game);
      }
      if (input.skillPressed && this.skillCharges > 0 && this.skillCastGap <= 0 && this.hurtTimer <= 0 && !this.bladeSurging) {
        this.performSpecial(level, game);
      }
      if (input.ultimatePressed && this.ultimateTimer <= 0 && this.hurtTimer <= 0) {
        this.performUltimate(game);
      }
    }

    resolveWorldCollision(dt, level, game) {
      let surgeHitSolid = false;

      // Move X & resolve solid walls
      this.x += this.vx * dt;
      for (const s of level.solids) {
        if (SR.aabb(this, s)) {
          if (this.vx > 0) this.x = s.x - this.w;
          else if (this.vx < 0) this.x = s.x + s.w;
          this.vx = 0;
          if (this.bladeSurging) surgeHitSolid = true;
        }
      }

      // Clamp to active boss arena if locked
      if (game.activeArena) {
        if (this.x < game.activeArena.minX) {
          this.x = game.activeArena.minX;
          if (this.vx < 0) this.vx = 0;
          if (this.bladeSurging) surgeHitSolid = true;
        }
        if (this.x + this.w > game.activeArena.maxX) {
          this.x = game.activeArena.maxX - this.w;
          if (this.vx > 0) this.vx = 0;
          if (this.bladeSurging) surgeHitSolid = true;
        }
      }

      // Move Y & resolve solids + bars + moving clouds
      const prevBottom = this.y + this.h;
      const wasOnGround = this.onGround;
      const preLandVy = this.vy;
      this.y += this.vy * dt;
      this.onGround = false;
      this.onBar = false;

      // Clamp top ceiling so upward Blade Surge never leaves screen!
      if (this.y < 36) {
        this.y = 36;
        if (this.vy < 0) this.vy = 0;
      }

      for (const s of level.solids) {
        if (SR.aabb(this, s)) {
          if (this.vy >= 0) {
            this.y = s.y - this.h;
            this.vy = 0;
            this.onGround = true;
          } else {
            this.y = s.y + s.h;
            this.vy = 0;
            if (this.bladeSurging) surgeHitSolid = true;
          }
        }
      }

      if (!this.onGround && this.vy >= 0 && this.dropThroughTimer <= 0 && !this.bladeSurging) {
        for (const bar of level.bars) {
          if (this.x + this.w > bar.x + 4 && this.x < bar.x + bar.w - 4) {
            if (prevBottom <= bar.y + 12 && this.y + this.h >= bar.y) {
              this.y = bar.y - this.h;
              this.vy = 0;
              this.onGround = true;
              this.onBar = true;
              break;
            }
          }
        }
      }

      if (!this.onGround && this.vy >= 0 && this.dropThroughTimer <= 0 && !this.bladeSurging) {
        for (const mp of level.movingPlatforms) {
          if (this.x + this.w > mp.x + 4 && this.x < mp.x + mp.w - 4) {
            if (prevBottom <= mp.y + 14 && this.y + this.h >= mp.y - 2) {
              this.y = mp.y - this.h;
              this.vy = 0;
              this.onGround = true;
              this.onBar = true;
              this.x += mp.dx || 0;
              break;
            }
          }
        }
      }

      if (this.bladeSurging && surgeHitSolid) {
        this.finishBladeSurge(game, true);
      }

      if (this.onGround) {
        if (!wasOnGround && !this.bladeSurging) {
          this.squashX = 1.2;
          this.squashY = 0.82;
          if (preLandVy > 340 && SR.audio.land) SR.audio.land();
          SR.particles.spawnBurst(this.cx, this.y + this.h, ['#ffffff', '#ffe8f8'], 5, {
            speedMin: 25, speedMax: 85, upward: 15, size: 2.5, gravity: 80
          });
        }
        this.jumpsLeft = 2;
        this.airJumpCount = 0;
        this.coyoteTimer = 0.12;
      }

      if (this.onGround && Math.abs(this.vx) > 20 && !this.sliding && !this.bladeSurging) {
        this.runTime += dt * (Math.abs(this.vx) / 28);
      }
    }

    updateRibbon(dt, time) {
      const anchorX = this.cx - this.facing * 8;
      const anchorY = this.y + (this.sliding ? 9 : 16);
      for (let i = 0; i < this.ribbon.length; i++) {
        const pt = this.ribbon[i];
        const prevX = i === 0 ? anchorX : this.ribbon[i - 1].x;
        const prevY = i === 0 ? anchorY : this.ribbon[i - 1].y;
        const targetX = i === 0 ? anchorX : prevX - this.facing * 5.2;
        const targetY = i === 0 ? anchorY : prevY + Math.sin(time * 8 + i * 0.7) * 1.4;
        pt.x += (targetX - pt.x) * Math.min(1, dt * 18);
        pt.y += (targetY - pt.y) * Math.min(1, dt * 18);
        const segDx = pt.x - prevX;
        const segDy = pt.y - prevY;
        const segLen = Math.hypot(segDx, segDy);
        const maxLen = i === 0 ? 4 : 7.5;
        if (segLen > maxLen) {
          pt.x = prevX + (segDx / segLen) * maxLen;
          pt.y = prevY + (segDy / segLen) * maxLen;
        }
      }
    }

    // Pip Skill: 5 Gleaming Golden Piercing Bullets in a crisp ~34° aimed fan!
    firePipGoldenSkill(game, baseAng) {
      const count = 5;
      const spread = 0.60; // ~34° tight focused golden volley
      const muzzle = this.getWeaponMuzzle(baseAng, 26);
      SR.particles.spawnRing(muzzle.x, muzzle.y, '#ffe47a', 46, 0.24);
      SR.particles.spawnBurst(muzzle.x, muzzle.y, ['#fff8c4', '#ffd24c', '#ffffff'], 10, {
        angle: baseAng, spread: 0.9, speedMin: 80, speedMax: 210, life: 0.24, size: 3.6, gravity: 0, shape: 'star'
      });
      for (let i = 0; i < count; i++) {
        const frac = -0.5 + i / (count - 1);
        const ang = baseAng + frac * spread;
        game.playerProjectiles.push({
          kind: 'golden_bullet',
          x: muzzle.x,
          y: muzzle.y,
          vx: Math.cos(ang) * 880,
          vy: Math.sin(ang) * 880,
          r: 11.5,
          dmg: 24,
          pierce: 3,
          hitIds: new Set(),
          life: 0.88,
          color: '#ffd95a',
          splash: 34,
          magic: true
        });
      }
    }

    // Pip Ult: 3 Rapid Solar Nova Waves — Molten-Gold Solar Railbeam + 4 Golden Prism Bullets!
    firePipUltimateWave(game, baseAng) {
      const muzzle = this.getWeaponMuzzle(baseAng, 28);
      SR.audio.shoot(true);
      this.castRecoil = 1.0;

      const offsets = [-0.28, -0.14, 0.14, 0.28];
      for (const off of offsets) {
        const ang = baseAng + off;
        game.playerProjectiles.push({
          kind: 'golden_bullet',
          x: muzzle.x,
          y: muzzle.y,
          vx: Math.cos(ang) * 900,
          vy: Math.sin(ang) * 900,
          r: 12,
          dmg: 18,
          pierce: 4,
          hitIds: new Set(),
          life: 0.95,
          color: '#ffe066',
          magic: true
        });
      }

      game.playerProjectiles.push({
        kind: 'golden_railbeam',
        x: muzzle.x,
        y: muzzle.y,
        vx: Math.cos(baseAng) * 980,
        vy: Math.sin(baseAng) * 980,
        r: 34,
        dmg: 60,
        pierce: 10,
        hitIds: new Set(),
        life: 0.98,
        color: '#ffe26a',
        splash: 54,
        magic: true
      });
    }

    // [1 / LMB] Normal Attack
    performAttack(game) {
      this.attackTimer = this.def.attackCooldown;
      this.attackAnim = 0.24;
      this.castRecoil = 0.85;
      const baseAng = this.aimAngle;

      if (this.charId === 'blade') {
        // Double-jump air-slice removed (moved & upgraded into Skill: Blade Surge!)
        // Clean 3-hit Star-Blade combo + aimed White-Inside / Blue-Outside 劍氣 wave!
        this.comboStep = (this.comboStep % 3) + 1;
        this.comboResetTimer = 0.72;
        const dmg = this.comboStep === 3 ? 40 : (this.comboStep === 2 ? 28 : 26);
        const reach = this.comboStep === 3 ? 132 : (this.comboStep === 2 ? 112 : 104);
        SR.audio.slash(this.comboStep);

        const dirX = Math.cos(baseAng);
        const dirY = Math.sin(baseAng);
        if (!this.sliding && Math.abs(dirX) > 0.3) {
          this.vx += Math.sign(dirX) * (this.comboStep === 3 ? 48 : 24);
        }

        const slashX = this.cx + dirX * 22;
        const slashY = this.shoulderY + dirY * 22;
        const slashColor = this.comboStep === 3 ? '#1e82ff' : '#3ea4ff';
        SR.particles.spawnSlashArc(slashX, slashY, this.facing, reach * 0.7, slashColor, this.comboStep);

        const hitbox = {
          x: slashX - reach * 0.45 + dirX * (reach * 0.32),
          y: slashY - 48 + dirY * 28,
          w: reach,
          h: 96
        };
        game.applyPlayerMelee(hitbox, dmg, this.facing, this.comboStep === 3);

        const muzzle = this.getWeaponMuzzle(baseAng, 30);
        game.playerProjectiles.push({
          kind: 'sword_qi',
          x: muzzle.x,
          y: muzzle.y,
          vx: dirX * (this.comboStep === 3 ? 650 : 560),
          vy: dirY * (this.comboStep === 3 ? 650 : 560),
          r: this.comboStep === 3 ? 32 : 20,
          dmg: this.comboStep === 3 ? 30 : 14,
          pierce: this.comboStep === 3 ? 4 : 2,
          hitIds: new Set(),
          life: this.comboStep === 3 ? 0.52 : 0.28,
          color: this.comboStep === 3 ? '#1f80ff' : '#3ca4ff',
          magic: true
        });
      } else if (this.charId === 'gun') {
        // 3 Metallic Silver Bullets in ~30° total spread (-15°, 0°, +15°) straight along aimAngle!
        this.shotCount++;
        const isBurst = this.shotCount % 4 === 0;
        SR.audio.shoot(isBurst);
        const muzzle = this.getWeaponMuzzle(baseAng, 25);
        if (!this.sliding && Math.abs(Math.cos(baseAng)) > 0.5) {
          this.vx -= Math.sign(Math.cos(baseAng)) * (isBurst ? 28 : 12);
        }

        SR.particles.spawnBurst(muzzle.x, muzzle.y, isBurst ? ['#e8f4ff', '#a8d4ff', '#ffffff'] : ['#dce6f2', '#ffffff'], isBurst ? 8 : 5, {
          angle: baseAng,
          spread: 0.6, speedMin: 60, speedMax: 165, life: 0.2, size: 3.0, gravity: 0, shape: 'star'
        });

        const angles = [-Math.PI / 12, 0, Math.PI / 12]; // Exact 30° total spread!
        const spd = isBurst ? 860 : 780;
        angles.forEach((offset) => {
          const ang = baseAng + offset;
          game.playerProjectiles.push({
            kind: isBurst ? 'silver_piercer' : 'silver_bullet',
            x: muzzle.x,
            y: muzzle.y,
            vx: Math.cos(ang) * spd,
            vy: Math.sin(ang) * spd,
            r: isBurst ? 11 : 8.5,
            dmg: isBurst ? 26 : 18,
            pierce: isBurst ? 3 : 1,
            hitIds: new Set(),
            life: 0.88,
            color: isBurst ? '#e4f3ff' : '#d5e0ee',
            magic: isBurst
          });
        });
      } else if (this.charId === 'magic') {
        // Luna Normal Attack: 🔥 Fire Bolts aimed along aimAngle from staff tip (homing + fiery splash)!
        this.shotCount++;
        this.lastSpellElement = 'fire';
        SR.audio.castMagic();
        const muzzle = this.getWeaponMuzzle(baseAng, 28);
        SR.particles.spawnRing(muzzle.x, muzzle.y, '#ff7838', 22, 0.18);
        SR.particles.spawnBurst(muzzle.x, muzzle.y, ['#ff5a24', '#ffb838', '#fff5c4'], 5, {
          angle: baseAng, spread: 0.7, speedMin: 45, speedMax: 120, life: 0.22, size: 3.0, gravity: 0
        });

        const offsets = [-0.20, 0, 0.20]; // Tight ±11.5° fiery fan along aimAngle
        offsets.forEach((off, idx) => {
          const ang = baseAng + off;
          const spd = idx === 1 ? 430 : 395;
          game.playerProjectiles.push({
            kind: 'elem_bolt',
            element: 'fire',
            x: muzzle.x,
            y: muzzle.y,
            vx: Math.cos(ang) * spd,
            vy: Math.sin(ang) * spd,
            r: 10.5,
            dmg: 12,
            pierce: 1,
            hitIds: new Set(),
            life: 1.38,
            color: '#ff6e38',
            homing: true,
            splash: 50,
            magic: true
          });
        });
      }
    }

    // [2 / RMB] Skill
    performSpecial(level, game) {
      this.skillCharges = Math.max(0, this.skillCharges - 1);
      this.skillCastGap = 0.16;
      if (this.skillTimer <= 0) {
        this.skillTimer = this.def.skillCooldown;
      }
      this.attackAnim = 0.34;
      this.castRecoil = 1.0;
      const baseAng = this.aimAngle;
      SR.audio.special();

      if (this.charId === 'blade') {
        // New Lyra Skill: Directional Blade Surge (fast aerial/ground sword charge, blocks frontal shots, fires 劍氣 at end!)
        if (this.sliding) {
          this.tryStandUp(level ? level.solids : null);
        }
        // If standing on solid ground and aiming downward into the floor, flatten horizontally so she surges cleanly forward!
        let surgeAng = baseAng;
        if (this.onGround && !this.onBar && Math.sin(surgeAng) > 0.22) {
          surgeAng = Math.cos(surgeAng) >= 0 ? 0 : Math.PI;
        }
        this.bladeSurging = true;
        this.bladeSurgeTimer = 0.34;
        this.bladeSurgeAngle = surgeAng;
        this.bladeSurgeTick = 0;
        this.onGround = false;
        this.onBar = false;
        if (Math.abs(Math.cos(surgeAng)) > 0.15) {
          this.facing = Math.cos(surgeAng) >= 0 ? 1 : -1;
        }
        SR.audio.slash(3);
        SR.particles.spawnRing(this.cx, this.shoulderY, '#3ea4ff', 68, 0.26);
        SR.particles.spawnText(this.cx, this.y - 14, '劍影突襲 ✦', '#8ce8ff', 0.95);
      } else if (this.charId === 'gun') {
        // Pip Skill: 🌟 5 Piercing Golden Bullets aimed along aimAngle + crisp dodge-step grace!
        this.invulnTimer = Math.max(this.invulnTimer, 0.28);
        this.firePipGoldenSkill(game, baseAng);
      } else if (this.charId === 'magic') {
        // Luna Skill: ❄️ 5 Piercing Glacial Ice Bolts aimed along aimAngle (chills & slows non-boss enemies!)
        this.lastSpellElement = 'ice';
        this.invulnTimer = Math.max(this.invulnTimer, 0.20);
        const muzzle = this.getWeaponMuzzle(baseAng, 28);
        SR.particles.spawnRing(muzzle.x, muzzle.y, '#58e2ff', 58, 0.28);
        SR.particles.spawnBurst(muzzle.x, muzzle.y, ['#58e2ff', '#c8f8ff', '#ffffff'], 14, {
          angle: baseAng, spread: 1.0, speedMin: 80, speedMax: 220, size: 4.2, shape: 'star', gravity: 0
        });

        const count = 5;
        const spread = 0.70; // ~40° aimed glacial fan
        for (let i = 0; i < count; i++) {
          const frac = -0.5 + i / (count - 1);
          const ang = baseAng + frac * spread;
          game.playerProjectiles.push({
            kind: 'elem_bolt',
            element: 'ice',
            x: muzzle.x,
            y: muzzle.y,
            vx: Math.cos(ang) * 540,
            vy: Math.sin(ang) * 540,
            r: 12,
            dmg: 16,
            pierce: 3,
            hitIds: new Set(),
            life: 1.35,
            color: '#58e2ff',
            homing: true,
            homingSpeed: 540,
            homingTurn: 6.2,
            chill: 1.5,
            splash: 38,
            magic: true
          });
        }
      }
    }

    // [3 / Q] Ultimate Skill (30s CD)
    performUltimate(game) {
      this.ultimateTimer = this.def.ultimateCooldown;
      this.ultimateFlash = 0.75;
      this.attackAnim = 0.52;
      this.castRecoil = 1.0;
      const baseAng = this.aimAngle;
      SR.audio.ultimate();
      game.addShake(5);

      if (this.charId === 'blade') {
        this.invulnTimer = Math.max(this.invulnTimer, 0.9);
        SR.particles.spawnRing(this.cx, this.cy, '#38a0ff', 240, 0.5);
        SR.particles.spawnBurst(this.cx, this.cy, ['#3298ff', '#8ce8ff', '#ffffff'], 32, {
          speedMin: 120, speedMax: 340, size: 6, shape: 'star', gravity: 20
        });
        SR.particles.spawnText(this.cx, this.y - 26, '✦ CELESTIAL STARFALL ✦', '#8ce8ff', 1.35);

        const ultBox = { x: this.cx - 240, y: this.cy - 200, w: 480, h: 380 };
        game.applyPlayerMelee(ultBox, 52, this.facing, true);

        // 3 aimed directional 劍氣 waves along aimAngle
        const muzzle = this.getWeaponMuzzle(baseAng, 30);
        [-0.26, 0, 0.26].forEach((off) => {
          const ang = baseAng + off;
          game.playerProjectiles.push({
            kind: 'sword_qi',
            x: muzzle.x,
            y: muzzle.y,
            vx: Math.cos(ang) * 680,
            vy: Math.sin(ang) * 680,
            r: 36,
            dmg: 36,
            pierce: 6,
            hitIds: new Set(),
            life: 0.65,
            color: '#2d8fff',
            magic: true
          });
        });

        let swordCenter = this.cx + Math.cos(baseAng) * 140;
        if (game.activeBoss && !game.activeBoss.dead) {
          swordCenter = (this.cx + game.activeBoss.cx) * 0.5;
        }
        const offsets = [-250, -150, -50, 50, 150, 250];
        offsets.forEach((ox, idx) => {
          game.playerProjectiles.push({
            kind: 'starsword',
            x: swordCenter + ox,
            y: 30 - idx * 34,
            vx: this.facing * 45,
            vy: 780,
            r: 32,
            dmg: 50,
            pierce: 8,
            hitIds: new Set(),
            life: 1.35,
            color: '#2d8fff',
            magic: true
          });
        });
      } else if (this.charId === 'gun') {
        // Pip Ult: ☄️ Solar Nova — 3 blazing Golden Railgun + Golden Prism Bullet waves along live aimAngle!
        this.invulnTimer = Math.max(this.invulnTimer, 0.85);
        this.ultWavesLeft = 2;
        this.ultWaveTimer = 0.15;
        const muzzle = this.getWeaponMuzzle(baseAng, 28);
        SR.particles.spawnRing(muzzle.x, muzzle.y, '#ffe47a', 135, 0.45);
        SR.particles.spawnText(this.cx, this.y - 26, '✦ SOLAR GOLDEN NOVA ✦', '#ffe885', 1.35);
        this.firePipUltimateWave(game, baseAng);
      } else if (this.charId === 'magic') {
        // Luna Ult: ⚡ Thunderbolt — Piercing Mega Lightning Rail-Bolt + 8 Homing Crackling Lightning Bolts!
        this.lastSpellElement = 'lightning';
        this.invulnTimer = Math.max(this.invulnTimer, 0.70);
        const muzzle = this.getWeaponMuzzle(baseAng, 30);
        SR.particles.spawnRing(this.cx, this.cy, '#ffe84d', 250, 0.52);
        SR.particles.spawnBurst(this.cx, this.cy, ['#ffe84d', '#ffffff', '#9cf5ff'], 32, {
          speedMin: 110, speedMax: 320, size: 5.5, shape: 'star', gravity: 10
        });
        SR.particles.spawnText(this.cx, this.y - 26, '✦ THUNDERBOLT STORM ✦', '#ffe84d', 1.35);

        const novaBox = { x: this.cx - 220, y: this.cy - 200, w: 440, h: 380 };
        game.applyPlayerMelee(novaBox, 34, this.facing, true);

        // Centerpiece Mega Lightning Beam straight along aimAngle!
        game.playerProjectiles.push({
          kind: 'lightning_beam',
          x: muzzle.x,
          y: muzzle.y,
          vx: Math.cos(baseAng) * 880,
          vy: Math.sin(baseAng) * 880,
          r: 26,
          dmg: 68,
          pierce: 10,
          hitIds: new Set(),
          life: 0.95,
          color: '#ffe84d',
          splash: 58,
          magic: true
        });

        // 8 Homing Crackling Lightning Bolts fanning out!
        for (let i = 0; i < 8; i++) {
          const off = -1.05 + (2.1 / 7) * i;
          const ang = baseAng + off;
          game.playerProjectiles.push({
            kind: 'elem_bolt',
            element: 'lightning',
            x: muzzle.x,
            y: muzzle.y,
            vx: Math.cos(ang) * 420,
            vy: Math.sin(ang) * 420,
            r: 13.5,
            dmg: 18,
            pierce: 2,
            hitIds: new Set(),
            life: 1.65,
            color: '#ffe84d',
            homing: true,
            splash: 64,
            magic: true
          });
        }
      }
    }

    // source: 'contact' | 'dash' | 'projectile'
    // - Sliding avoids normal enemy body 'contact', NOT 'projectile' or 'dash'
    // - Lyra's Blade Surge is IMMUNE to 'contact' & 'dash' on her path, and blocks frontal projectiles via sword (back remains vulnerable!)
    takeDamage(amount, knockDir, game, keepVelocity = false, source = 'projectile') {
      if (this.invulnTimer > 0) return false;
      if (this.bladeSurging && (source === 'contact' || source === 'dash')) {
        return false;
      }
      if (this.sliding && source === 'contact') {
        if (this.slideDodgeFxCd <= 0) {
          this.slideDodgeFxCd = 0.35;
          SR.particles.spawnRing(this.cx, this.cy, '#9cf5e3', 32, 0.22);
          SR.particles.spawnText(this.cx, this.y - 10, 'SLIDE EVADE ✦', '#9cf5e3', 0.85);
        }
        return false;
      }
      if (game && game.cheats && game.cheats.godMode) {
        this.invulnTimer = 0.45;
        SR.audio.deflect();
        SR.particles.spawnRing(this.cx, this.cy, '#ffe894', 44, 0.25);
        SR.particles.spawnText(this.cx, this.y - 12, '無敵 ✦', '#ffe894', 0.95);
        return false;
      }
      this.hp = Math.max(0, this.hp - amount);
      this.invulnTimer = 1.15;
      this.hurtTimer = Math.max(this.hurtTimer, 0.26);
      this.hitFlash = 0.25;
      this.bladeSurging = false;
      this.bladeSurgeTimer = 0;
      const solids = game && game.level ? game.level.solids : null;
      const stoodUp = this.sliding ? this.tryStandUp(solids) : true;
      if (!keepVelocity) {
        this.vx = knockDir * 260;
        this.vy = stoodUp ? -270 : 0;
      }
      this.squashX = 1.24;
      this.squashY = 0.8;
      if (game) {
        game.combo = 0;
        game.addShake(4);
        game.hitstop = 0.035;
      }
      SR.audio.playerHurt();
      SR.particles.spawnBurst(this.cx, this.cy, ['#ff7eb6', '#ffffff', '#ffd0ec'], 14, {
        speedMin: 70, speedMax: 220, size: 4.5, shape: 'star'
      });
      SR.particles.spawnText(this.cx, this.y - 10, `-${amount}`, '#ff8fc4', 1.15);
      return true;
    }
  }

  SR.Player = Player;
})(window.SR);
