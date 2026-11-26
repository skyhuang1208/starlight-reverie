// Playable Hero Controller (Luna · Pip · Lyra)
// Smooth platforming physics (coyote time, jump buffer, arch-safe sliding, moving clouds)
// + Balanced Normal Attack [1/LMB], Tactical Skill [2/RMB], and 15s Ultimate [3/Q].
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

      // Aim state (Shooter upward aim!)
      this.aimUp = false;

      // Weather puddle temporary slow status
      this.slowTimer = 0;

      // Combat state
      this.attackTimer = 0;
      this.attackAnim = 0;
      this.comboStep = 0;
      this.comboResetTimer = 0;
      this.shotCount = 0;
      this.skillTimer = 0;
      this.ultimateTimer = 0;
      this.ultimateFlash = 0;
      this.invulnTimer = 0;
      this.hurtTimer = 0;
      this.hitFlash = 0;

      // Lyra Air-Slicing Dive & 360° Cyclone state
      this.airSlicing = false;
      this.airSliceTick = 0;
      this.cycloneTimer = 0;
      this.cycloneTick = 0;
      this.cycloneAngle = 0;

      // Pip Ultimate multi-wave Hypernova Barrage state
      this.ultWavesLeft = 0;
      this.ultWaveTimer = 0;
      this.ultFacing = 1;
      this.ultAimUp = false;

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

    applySlow(duration) {
      this.slowTimer = Math.max(this.slowTimer, duration);
    }

    // Strong external knockback push (e.g., Shiba's Bark Sound Wave!)
    applyKnockbackPush(dir, forceX = 560, liftY = -220) {
      this.airSlicing = false;
      this.sliding = false;
      if (this.h !== this.normalH) {
        const bottom = this.y + this.h;
        this.h = this.normalH;
        this.y = bottom - this.h;
      }
      this.vx = dir * forceX;
      this.vy = Math.min(this.vy, liftY);
      this.hurtTimer = Math.max(this.hurtTimer, 0.34);
      this.onGround = false;
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
      if (this.sliding || this.slideCooldown > 0 || this.airSlicing) return;
      this.sliding = true;
      this.slideTimer = this.def.slideDuration;
      this.slideExtraLeft = 0.24; // Holding Shift / Down extends slide smoothly even longer!
      this.slideCooldown = 0.24;
      this.slideDodgeFxCd = 0;
      const bottom = this.y + this.h;
      this.h = this.slideH;
      this.y = bottom - this.h;
      const slowMult = this.slowTimer > 0 ? 0.46 : 1.0;
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

    update(dt, input, level, game) {
      if (this.coyoteTimer > 0) this.coyoteTimer -= dt;
      if (this.jumpBuffer > 0) this.jumpBuffer -= dt;
      if (this.dropThroughTimer > 0) this.dropThroughTimer -= dt;
      if (this.slideCooldown > 0) this.slideCooldown -= dt;
      if (this.attackTimer > 0) this.attackTimer -= dt;
      if (this.attackAnim > 0) this.attackAnim -= dt;
      if (this.comboResetTimer > 0) {
        this.comboResetTimer -= dt;
        if (this.comboResetTimer <= 0) this.comboStep = 0;
      }
      if (this.skillTimer > 0) this.skillTimer -= dt;
      if (this.ultimateTimer > 0) this.ultimateTimer -= dt;
      if (this.ultimateFlash > 0) this.ultimateFlash -= dt;
      if (this.invulnTimer > 0) this.invulnTimer -= dt;
      if (this.slideDodgeFxCd > 0) this.slideDodgeFxCd -= dt;
      if (this.hurtTimer > 0) this.hurtTimer -= dt;
      if (this.hitFlash > 0) this.hitFlash -= dt;
      if (this.slowTimer > 0) this.slowTimer -= dt;

      this.squashX += (1 - this.squashX) * Math.min(1, dt * 14);
      this.squashY += (1 - this.squashY) * Math.min(1, dt * 14);

      this.updateActiveAbilities(dt, game);

      let move = 0;
      if (input.left) move -= 1;
      if (input.right) move += 1;

      if (move !== 0 && !this.sliding && !this.airSlicing) {
        this.facing = move;
      }

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
      if ((input.slidePressed || (input.downPressed && this.onGround && !this.onBar)) && this.hurtTimer <= 0) {
        this.startSlide();
      } else if (input.downPressed && this.onBar) {
        this.dropThroughTimer = 0.24;
        this.onGround = false;
        this.onBar = false;
        this.y += 4;
        this.vy = Math.max(this.vy, 90);
      }

      if (input.jumpPressed) {
        this.jumpBuffer = 0.14;
      }

      this.aimUp = (this.charId === 'gun' && !!input.up);

      const speedMult = this.slowTimer > 0 ? 0.28 : 1.0;
      this.updateHorizontalMotion(dt, move, speedMult, input, level, game);
      this.updateJumpAndGravity(dt, input, level);
      this.handleCombatInputs(input, game);
      this.resolveWorldCollision(dt, level, game);
      this.updateRibbon(dt, game.time || 0);

      // Safety net if ever pushed below map floor
      if (this.y > 760) {
        this.y = 320;
        this.vy = 0;
        this.airSlicing = false;
      }
    }

    updateActiveAbilities(dt, game) {
      // Pip Ultimate multi-wave Hypernova Barrage
      if (this.ultWavesLeft > 0) {
        this.ultWaveTimer -= dt;
        if (this.ultWaveTimer <= 0) {
          this.ultWavesLeft--;
          this.ultWaveTimer = 0.17;
          this.firePipUltimateWave(game, this.ultFacing, this.ultAimUp);
        }
      }

      // Lyra [2] Skill 360° Rotational Blading Cyclone
      if (this.cycloneTimer > 0) {
        this.cycloneTimer -= dt;
        this.cycloneAngle += dt * 20;
        this.cycloneTick -= dt;
        if (this.cycloneTick <= 0) {
          this.cycloneTick = 0.155;
          const rad = 148;
          const spinBox = { x: this.cx - rad, y: this.cy - rad, w: rad * 2, h: rad * 2 };
          game.applyPlayerMelee(spinBox, 18, this.facing, true);
          SR.particles.spawnRing(this.cx, this.cy, '#9cf5ff', rad * 0.9, 0.22);
          SR.particles.spawnBurst(this.cx, this.cy, ['#8be4ff', '#ffe894', '#ff9fd6'], 7, {
            speedMin: 100, speedMax: 220, size: 4, shape: 'star', gravity: 0
          });
        }
        if (this.cycloneTimer <= 0) {
          this.fireCycloneCrescents(game, 2);
        }
      }
    }

    updateHorizontalMotion(dt, move, speedMult, input, level, game) {
      if (this.airSlicing) {
        // Slower forward ~30° diagonal huge-blade dive (atan2(170, 295) ≈ 30°)
        this.vx = this.facing * 295;
        this.vy = 170;
        this.afterimageTimer -= dt;
        if (this.afterimageTimer <= 0) {
          this.afterimageTimer = 0.055;
          SR.particles.spawnAfterimage(this.cx, this.y + this.h, this.facing, this.charId, false);
          SR.particles.spawnBurst(this.cx + this.facing * 52, this.cy + 24, ['#8be4ff', '#ffe894', '#ffffff'], 3, {
            speedMin: 35, speedMax: 115, size: 3.8, shape: 'star', gravity: 0
          });
        }
        this.airSliceTick -= dt;
        if (this.airSliceTick <= 0) {
          this.airSliceTick = 0.095;
          const diveBox = {
            x: this.facing > 0 ? this.cx - 28 : this.cx - 148,
            y: this.y - 36,
            w: 176,
            h: this.h + 76
          };
          game.applyPlayerMelee(diveBox, 24, this.facing, true);
        }
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
      if (this.jumpBuffer > 0 && !this.airSlicing) {
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

      // Variable jump height for crisp short-hops
      if (!input.jumpHeld && this.vy < -260 && !this.airSlicing) {
        this.vy += this.def.gravity * 1.45 * dt;
      }

      if (!this.airSlicing) {
        this.vy = Math.min(960, this.vy + this.def.gravity * dt);
      }
    }

    handleCombatInputs(input, game) {
      if (input.attackHeld && this.attackTimer <= 0 && this.hurtTimer <= 0 && !this.airSlicing) {
        this.performAttack(game);
      }
      if (input.skillPressed && this.skillTimer <= 0 && this.hurtTimer <= 0) {
        this.performSpecial(game);
      }
      if (input.ultimatePressed && this.ultimateTimer <= 0 && this.hurtTimer <= 0) {
        this.performUltimate(game);
      }
    }

    resolveWorldCollision(dt, level, game) {
      // Move X & resolve solid walls
      this.x += this.vx * dt;
      for (const s of level.solids) {
        if (SR.aabb(this, s)) {
          if (this.vx > 0) this.x = s.x - this.w;
          else if (this.vx < 0) this.x = s.x + s.w;
          this.vx = 0;
          if (this.airSlicing) this.airSlicing = false;
        }
      }

      // Clamp to active boss arena if locked
      if (game.activeArena) {
        if (this.x < game.activeArena.minX) {
          this.x = game.activeArena.minX;
          if (this.vx < 0) this.vx = 0;
        }
        if (this.x + this.w > game.activeArena.maxX) {
          this.x = game.activeArena.maxX - this.w;
          if (this.vx > 0) this.vx = 0;
        }
      }

      // Move Y & resolve solids + bars + moving clouds
      const prevBottom = this.y + this.h;
      const wasOnGround = this.onGround;
      const preLandVy = this.vy;
      this.y += this.vy * dt;
      this.onGround = false;
      this.onBar = false;

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

      if (!this.onGround && this.vy >= 0 && this.dropThroughTimer <= 0 && !this.airSlicing) {
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

      if (!this.onGround && this.vy >= 0 && this.dropThroughTimer <= 0 && !this.airSlicing) {
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

      if (this.onGround) {
        if (this.airSlicing) {
          this.airSlicing = false;
          this.attackTimer = 0.2;
          this.squashX = 1.35;
          this.squashY = 0.68;
          SR.audio.slash(3);
          SR.particles.spawnRing(this.cx, this.y + this.h - 4, '#ffe894', 115, 0.34);
          SR.particles.spawnBurst(this.cx, this.y + this.h - 4, ['#8be4ff', '#ffe894', '#ff9fd6', '#ffffff'], 22, {
            speedMin: 90, speedMax: 270, upward: 110, size: 5, shape: 'star'
          });
          const slamBox = { x: this.cx - 120, y: this.y - 36, w: 240, h: this.h + 44 };
          game.applyPlayerMelee(slamBox, 40, this.facing, true);
          [-1, 1].forEach((dir) => {
            game.playerProjectiles.push({
              kind: 'sword_qi',
              x: this.cx + dir * 24,
              y: this.y + this.h - 22,
              vx: dir * 580,
              vy: 0,
              r: 28,
              dmg: 24,
              pierce: 4,
              hitIds: new Set(),
              life: 0.38,
              color: '#2d8fff',
              magic: true
            });
          });
        } else if (!wasOnGround) {
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

      if (this.onGround && Math.abs(this.vx) > 20 && !this.sliding) {
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

    fireCycloneCrescents(game, count = 2) {
      const dirs = count >= 4
        ? [{ vx: 620, vy: 0 }, { vx: -620, vy: 0 }, { vx: 450, vy: -340 }, { vx: -450, vy: -340 }]
        : [{ vx: 580, vy: 0 }, { vx: -580, vy: 0 }];
      for (const d of dirs) {
        game.playerProjectiles.push({
          kind: 'sword_qi',
          x: this.cx,
          y: this.cy,
          vx: d.vx,
          vy: d.vy,
          r: count >= 4 ? 34 : 26,
          dmg: count >= 4 ? 36 : 20,
          pierce: 5,
          hitIds: new Set(),
          life: 0.50,
          color: '#2d8fff',
          magic: true
        });
      }
    }

    getPipAim(facing, aimUp) {
      if (aimUp) {
        return { baseAng: -Math.PI * 0.5, originX: this.cx, originY: this.y - 6 };
      }
      return { baseAng: facing > 0 ? 0 : Math.PI, originX: this.cx + facing * 22, originY: this.cy - (this.sliding ? 2 : 4) };
    }

    firePipSkillFan(game, facing, aimUp = false) {
      const count = 7;
      const spread = 1.82;
      const { baseAng, originX, originY } = this.getPipAim(facing, aimUp);
      for (let i = 0; i < count; i++) {
        const frac = -0.5 + i / (count - 1);
        const ang = baseAng + frac * spread;
        game.playerProjectiles.push({
          kind: 'silver_prism_lance',
          x: originX,
          y: originY,
          vx: Math.cos(ang) * 760,
          vy: Math.sin(ang) * 760,
          r: 12,
          dmg: 21,
          pierce: 3,
          hitIds: new Set(),
          life: 0.85,
          color: '#d8eeff',
          magic: true
        });
      }
    }

    firePipUltimateWave(game, facing, aimUp = false) {
      const count = 9;
      const spread = 1.68;
      const { baseAng, originX, originY } = this.getPipAim(facing, aimUp);
      SR.audio.shoot(true);

      for (let i = 0; i < count; i++) {
        const frac = -0.5 + i / (count - 1);
        const ang = baseAng + frac * spread;
        game.playerProjectiles.push({
          kind: 'silver_prism_lance',
          x: originX,
          y: originY,
          vx: Math.cos(ang) * 820,
          vy: Math.sin(ang) * 820,
          r: 15,
          dmg: 29,
          pierce: 5,
          hitIds: new Set(),
          life: 0.95,
          color: '#e6f5ff',
          magic: true
        });
      }

      game.playerProjectiles.push({
        kind: 'silver_railbeam',
        x: originX,
        y: originY,
        vx: Math.cos(baseAng) * 920,
        vy: Math.sin(baseAng) * 920,
        r: 34,
        dmg: 86,
        pierce: 10,
        hitIds: new Set(),
        life: 1.0,
        color: '#e8f5ff',
        magic: true
      });
    }

    performAttack(game) {
      this.attackTimer = this.def.attackCooldown;
      this.attackAnim = 0.24;

      if (this.charId === 'blade') {
        // Air-Slicing Dive only after a 2-step (double) jump! Slower forward ~30° huge-blade slice
        if (!this.onGround && !this.sliding && this.airJumpCount >= 2) {
          this.airSlicing = true;
          this.airSliceTick = 0;
          this.invulnTimer = Math.max(this.invulnTimer, 0.45);
          this.vx = this.facing * 295;
          this.vy = 170;
          SR.audio.slash(3);
          SR.particles.spawnSlashArc(this.cx + this.facing * 36, this.cy + 14, this.facing, 128, '#2d8fff', 3);
          return;
        }

        this.comboStep = (this.comboStep % 3) + 1;
        this.comboResetTimer = 0.72;
        const dmg = this.comboStep === 3 ? 39 : (this.comboStep === 2 ? 27 : 25);
        const reach = this.comboStep === 3 ? 150 : (this.comboStep === 2 ? 126 : 118);
        SR.audio.slash(this.comboStep);

        if (!this.sliding) {
          this.vx += this.facing * (this.comboStep === 3 ? 55 : 30);
        }

        const slashX = this.cx + this.facing * 24;
        const slashY = this.cy - 4;
        const slashColor = this.comboStep === 3 ? '#1e82ff' : '#3ea4ff';
        SR.particles.spawnSlashArc(slashX, slashY, this.facing, reach * 0.76, slashColor, this.comboStep);

        const hitbox = {
          x: this.facing > 0 ? this.cx - 18 : this.cx - reach - 12,
          y: this.y - 32,
          w: reach + 30,
          h: this.h + 52
        };
        game.applyPlayerMelee(hitbox, dmg, this.facing, this.comboStep === 3);

        // White-inside, blue-outside 劍氣 wave on every swing (massive wave on 3rd combo!)
        game.playerProjectiles.push({
          kind: 'sword_qi',
          x: this.cx + this.facing * 36,
          y: this.cy - 4,
          vx: this.facing * (this.comboStep === 3 ? 640 : 540),
          vy: 0,
          r: this.comboStep === 3 ? 36 : 22,
          dmg: this.comboStep === 3 ? 30 : 12,
          pierce: this.comboStep === 3 ? 4 : 2,
          hitIds: new Set(),
          life: this.comboStep === 3 ? 0.50 : 0.24,
          color: this.comboStep === 3 ? '#1f80ff' : '#3ca4ff',
          magic: true
        });
      } else if (this.charId === 'gun') {
        // 5 metallic silver bullets ±45° spread (Forward OR straight UP when holding Up/W!); every 4th volley fires piercing platinum rounds
        this.shotCount++;
        const isBurst = this.shotCount % 4 === 0;
        SR.audio.shoot(isBurst);
        const { baseAng, originX: muzzleX, originY: muzzleY } = this.getPipAim(this.facing, this.aimUp);
        if (!this.sliding && !this.aimUp) this.vx -= this.facing * (isBurst ? 38 : 16);

        SR.particles.spawnBurst(muzzleX, muzzleY, isBurst ? ['#e8f4ff', '#a8d4ff', '#ffffff'] : ['#dce6f2', '#ffffff'], isBurst ? 10 : 5, {
          angle: baseAng,
          spread: 1.5, speedMin: 60, speedMax: 165, life: 0.22, size: 3.2, gravity: 0, shape: 'star'
        });

        const angles = [-Math.PI / 4, -Math.PI / 8, 0, Math.PI / 8, Math.PI / 4];
        const spd = isBurst ? 780 : 700;

        angles.forEach((offset) => {
          const ang = baseAng + offset;
          game.playerProjectiles.push({
            kind: isBurst ? 'silver_piercer' : 'silver_bullet',
            x: muzzleX,
            y: muzzleY,
            vx: Math.cos(ang) * spd,
            vy: Math.sin(ang) * spd,
            r: isBurst ? 10.5 : 7.5,
            dmg: isBurst ? 27 : 17,
            pierce: isBurst ? 3 : 1,
            hitIds: new Set(),
            life: 0.85,
            color: isBurst ? '#e4f3ff' : '#d5e0ee',
            magic: isBurst
          });
        });
      } else if (this.charId === 'magic') {
        // 3 Elemental Bolts per cast: Fire Bolt + Ice Bolt + Lightning Bolt!
        this.shotCount++;
        SR.audio.castMagic();
        const castX = this.cx + this.facing * 20;
        const castY = this.cy - 8;
        SR.particles.spawnRing(castX, castY, '#a6e4ff', 24, 0.2);

        const elements = [
          { el: 'fire', color: '#ff6e38' },
          { el: 'lightning', color: '#ffe84d' },
          { el: 'ice', color: '#58e2ff' }
        ];
        const lanes = [
          { dy: -12, vy: -145, vxMult: 0.96 },
          { dy: 0,   vy: 0,    vxMult: 1.06 },
          { dy: 12,  vy: 145,  vxMult: 0.96 }
        ];

        lanes.forEach((lane, idx) => {
          const spec = elements[(idx + this.shotCount) % 3];
          game.playerProjectiles.push({
            kind: 'elem_bolt',
            element: spec.el,
            x: castX,
            y: castY + lane.dy,
            vx: this.facing * 335 * lane.vxMult,
            vy: lane.vy,
            r: 10,
            dmg: 10,
            pierce: 1,
            hitIds: new Set(),
            life: 1.42,
            color: spec.color,
            homing: true,
            splash: 48,
            magic: true
          });
        });
      }
    }

    // [2 / RMB] Skill
    performSpecial(game) {
      this.skillTimer = this.def.skillCooldown;
      this.attackAnim = 0.36;
      SR.audio.special();

      if (this.charId === 'blade') {
        this.cycloneTimer = 0.62;
        this.cycloneTick = 0;
        this.invulnTimer = Math.max(this.invulnTimer, 0.32);
        SR.audio.cyclone();
        SR.particles.spawnRing(this.cx, this.cy, '#38a0ff', 150, 0.34);
      } else if (this.charId === 'gun') {
        this.invulnTimer = Math.max(this.invulnTimer, 0.18);
        const { originX, originY } = this.getPipAim(this.facing, this.aimUp);
        SR.particles.spawnRing(originX, originY, '#dceeff', 58, 0.28);
        this.firePipSkillFan(game, this.facing, this.aimUp);
      } else if (this.charId === 'magic') {
        this.invulnTimer = Math.max(this.invulnTimer, 0.18);
        SR.particles.spawnRing(this.cx, this.cy, '#72dcff', 110, 0.34);
        SR.particles.spawnBurst(this.cx, this.cy, ['#ff743d', '#58e2ff', '#ffe84d'], 16, {
          speedMin: 70, speedMax: 210, size: 4.5, shape: 'star', gravity: 20
        });
        const ringElems = [
          { el: 'fire', color: '#ff6e38' },
          { el: 'ice', color: '#58e2ff' },
          { el: 'lightning', color: '#ffe84d' }
        ];
        for (let i = 0; i < 6; i++) {
          const ang = (Math.PI * 2 * i) / 6;
          const spec = ringElems[i % 3];
          game.playerProjectiles.push({
            kind: 'elem_bolt',
            element: spec.el,
            x: this.cx + Math.cos(ang) * 18,
            y: this.cy + Math.sin(ang) * 18,
            vx: Math.cos(ang) * 315,
            vy: Math.sin(ang) * 315,
            r: 11,
            dmg: 14,
            pierce: 1,
            hitIds: new Set(),
            life: 1.45,
            color: spec.color,
            homing: true,
            splash: 55,
            magic: true
          });
        }
      }
    }

    // [3 / Q] Ultimate Skill (15s CD)
    performUltimate(game) {
      this.ultimateTimer = this.def.ultimateCooldown;
      this.ultimateFlash = 0.75;
      this.attackAnim = 0.55;
      SR.audio.ultimate();
      game.addShake(5);

      if (this.charId === 'blade') {
        this.invulnTimer = Math.max(this.invulnTimer, 0.9);
        this.cycloneTimer = Math.max(this.cycloneTimer, 0.75);
        this.cycloneTick = 0;
        SR.particles.spawnRing(this.cx, this.cy, '#38a0ff', 260, 0.52);
        SR.particles.spawnBurst(this.cx, this.cy, ['#3298ff', '#8ce8ff', '#ffffff'], 34, {
          speedMin: 120, speedMax: 340, size: 6, shape: 'star', gravity: 20
        });
        SR.particles.spawnText(this.cx, this.y - 26, '✦ CELESTIAL STARFALL ✦', '#8ce8ff', 1.35);

        const ultBox = { x: this.cx - 260, y: this.cy - 220, w: 520, h: 400 };
        game.applyPlayerMelee(ultBox, 58, this.facing, true);
        this.fireCycloneCrescents(game, 4);

        let swordCenter = this.cx + this.facing * 60;
        if (game.activeBoss && !game.activeBoss.dead) {
          swordCenter = (this.cx + game.activeBoss.cx) * 0.5;
        }
        const offsets = [-260, -155, -50, 50, 155, 260];
        offsets.forEach((ox, idx) => {
          game.playerProjectiles.push({
            kind: 'starsword',
            x: swordCenter + ox,
            y: 30 - idx * 34,
            vx: this.facing * 50,
            vy: 760,
            r: 32,
            dmg: 58,
            pierce: 8,
            hitIds: new Set(),
            life: 1.35,
            color: '#2d8fff',
            magic: true
          });
        });
      } else if (this.charId === 'gun') {
        this.invulnTimer = Math.max(this.invulnTimer, 0.6);
        this.ultFacing = this.facing;
        this.ultAimUp = this.aimUp;
        this.ultWavesLeft = 2;
        this.ultWaveTimer = 0.17;
        const { originX, originY } = this.getPipAim(this.facing, this.aimUp);
        SR.particles.spawnRing(originX, originY, '#dceeff', 135, 0.45);
        SR.particles.spawnText(this.cx, this.y - 26, '✦ SILVER HYPERNOVA ✦', '#e6f5ff', 1.35);
        this.firePipUltimateWave(game, this.facing, this.aimUp);
      } else if (this.charId === 'magic') {
        this.invulnTimer = Math.max(this.invulnTimer, 0.65);
        SR.particles.spawnRing(this.cx, this.cy, '#ffe84d', 260, 0.55);
        SR.particles.spawnRing(this.cx, this.cy, '#58e2ff', 190, 0.45);
        SR.particles.spawnBurst(this.cx, this.cy, ['#ff6e38', '#58e2ff', '#ffe84d', '#ffffff'], 34, {
          speedMin: 110, speedMax: 320, size: 5.5, shape: 'star', gravity: 10
        });
        SR.particles.spawnText(this.cx, this.y - 26, '✦ ELEMENTAL SUPERNOVA ✦', '#ffe894', 1.35);

        const novaBox = { x: this.cx - 250, y: this.cy - 220, w: 500, h: 420 };
        game.applyPlayerMelee(novaBox, 45, this.facing, true);

        const ultElems = [
          { el: 'fire', color: '#ff6e38' },
          { el: 'ice', color: '#58e2ff' },
          { el: 'lightning', color: '#ffe84d' }
        ];
        for (let i = 0; i < 12; i++) {
          const ang = (Math.PI * 2 * i) / 12;
          const spec = ultElems[i % 3];
          game.playerProjectiles.push({
            kind: 'elem_bolt',
            element: spec.el,
            x: this.cx + Math.cos(ang) * 26,
            y: this.cy + Math.sin(ang) * 26,
            vx: Math.cos(ang) * 355,
            vy: Math.sin(ang) * 355,
            r: 13,
            dmg: 16,
            pierce: 1,
            hitIds: new Set(),
            life: 1.85,
            color: spec.color,
            homing: true,
            splash: 80,
            magic: true
          });
        }
      }
    }

    // source: 'contact' | 'dash' | 'projectile'
    // Sliding smoothly avoids normal enemy body 'contact', but NOT 'projectile' (bullets) or 'dash' attacks!
    takeDamage(amount, knockDir, game, keepVelocity = false, source = 'projectile') {
      if (this.invulnTimer > 0) return false;
      if (this.sliding && source === 'contact') {
        if (this.slideDodgeFxCd <= 0) {
          this.slideDodgeFxCd = 0.35;
          SR.particles.spawnRing(this.cx, this.cy, '#9cf5e3', 32, 0.22);
          SR.particles.spawnText(this.cx, this.y - 10, 'SLIDE EVADE ✦', '#9cf5e3', 0.85);
        }
        return false;
      }
      // 金手指 #1: 無敵不扣血 (No Damage)
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
      this.airSlicing = false;
      if (this.sliding) {
        const bottom = this.y + this.h;
        this.sliding = false;
        this.h = this.normalH;
        this.y = bottom - this.h;
      }
      if (!keepVelocity) {
        this.vx = knockDir * 260;
        this.vy = -270;
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
