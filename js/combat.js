// Shared Combat & Projectile Resolution Engine
// Used by both live Game and headless balance/traversal simulations (zero logic duplication!).
window.SR = window.SR || {};

(function (SR) {
  function applyPlayerMelee(game, hitbox, dmg, facing, isHeavy) {
    let hitAny = false;
    for (const e of game.enemies) {
      if (e.dead) continue;
      if (SR.aabb(hitbox, e)) {
        e.takeDamage(dmg, game.player.cx, isHeavy, game);
        if (game.registerHitCombo) game.registerHitCombo();
        hitAny = true;
      }
    }

    for (let i = game.enemyProjectiles.length - 1; i >= 0; i--) {
      const ep = game.enemyProjectiles[i];
      if (!ep.deflectable) continue;
      const pbox = { x: ep.x - ep.r, y: ep.y - ep.r, w: ep.r * 2, h: ep.r * 2 };
      if (SR.aabb(hitbox, pbox)) {
        SR.audio.deflect();
        SR.particles.spawnRing(ep.x, ep.y, '#9cf5e3', 34, 0.25);
        SR.particles.spawnText(ep.x, ep.y - 12, 'DEFLECT!', '#9cf5e3', 0.95);
        game.playerProjectiles.push({
          kind: 'sword_qi',
          x: ep.x,
          y: ep.y,
          vx: facing * 680,
          vy: -ep.vy * 0.35,
          r: 22,
          dmg: 28,
          pierce: 3,
          hitIds: new Set(),
          life: 0.72,
          color: '#349eff',
          magic: true
        });
        game.enemyProjectiles.splice(i, 1);
        // Cap scored deflects per stage (max 10 x 40 = 400 pts) to prevent infinite deflect farming
        if (game.addDeflectScore) {
          game.addDeflectScore(40);
        } else {
          game.score = (game.score || 0) + 40;
        }
        hitAny = true;
      }
    }

    if (hitAny && isHeavy && !(game.cheats && game.cheats.onePunch)) {
      game.hitstop = Math.max(game.hitstop || 0, 0.018);
    }
    return hitAny;
  }

  // Lyra Skill (Blade Surge): blocks/deflects enemy projectiles in FRONT of her held sword,
  // but intentionally leaves her BACK unprotected!
  function applyBladeSurgeBlock(game, player, dirX, dirY) {
    const projs = game.enemyProjectiles;
    for (let i = projs.length - 1; i >= 0; i--) {
      const ep = projs[i];
      const relX = ep.x - player.cx;
      const relY = ep.y - player.cy;
      const dist = Math.hypot(relX, relY);
      if (dist > 58 + (ep.r || 10)) continue;

      // Positive dot product = in front of Lyra's held blade; negative = behind her back!
      const forwardDot = relX * dirX + relY * dirY;
      if (forwardDot < -8) continue;

      SR.audio.deflect();
      SR.particles.spawnRing(ep.x, ep.y, '#8ceaff', 36, 0.24);
      SR.particles.spawnBurst(ep.x, ep.y, ['#ffffff', '#3ca4ff', '#ffe894'], 6, {
        speedMin: 60, speedMax: 180, size: 3.2, shape: 'star', gravity: 0
      });

      if (ep.deflectable) {
        SR.particles.spawnText(ep.x, ep.y - 12, 'DEFLECT!', '#9cf5ff', 0.9);
        game.playerProjectiles.push({
          kind: 'sword_qi',
          x: ep.x,
          y: ep.y,
          vx: dirX * 700,
          vy: dirY * 700,
          r: 22,
          dmg: 30,
          pierce: 3,
          hitIds: new Set(),
          life: 0.65,
          color: '#349eff',
          magic: true
        });
        if (game.addDeflectScore) game.addDeflectScore(40);
      } else {
        SR.particles.spawnText(ep.x, ep.y - 12, 'BLOCK!', '#c8f6ff', 0.85);
      }
      projs.splice(i, 1);
    }
  }

  function updatePlayerProjectiles(game, dt) {
    const projs = game.playerProjectiles;
    for (let i = projs.length - 1; i >= 0; i--) {
      const p = projs[i];
      p.life -= dt;
      if (p.life <= 0) {
        projs.splice(i, 1);
        continue;
      }

      if (p.homing) {
        let best = null;
        let bestDist = 415;
        for (const e of game.enemies) {
          if (e.dead) continue;
          const d = Math.hypot(e.cx - p.x, e.cy - p.y);
          if (d < bestDist) {
            bestDist = d;
            best = e;
          }
        }
        if (best) {
          const hSpd = p.homingSpeed || 425;
          const hTurn = p.homingTurn || 5.4;
          const desiredVx = ((best.cx - p.x) / bestDist) * hSpd;
          const desiredVy = ((best.cy - p.y) / bestDist) * hSpd;
          p.vx += (desiredVx - p.vx) * Math.min(1, dt * hTurn);
          p.vy += (desiredVy - p.vy) * Math.min(1, dt * hTurn);
        }
      }

      p.x += p.vx * dt;
      p.y += p.vy * dt;

      if (Math.random() < 0.35) {
        SR.particles.spawnBurst(p.x, p.y, p.color, 1, {
          speedMin: 10, speedMax: 45, life: 0.2, size: 2.5, gravity: 0
        });
      }

      if (p.kind === 'silver_bullet') {
        let hitWall = false;
        for (const s of game.level.solids) {
          if (p.x > s.x && p.x < s.x + s.w && p.y > s.y && p.y < s.y + s.h) {
            hitWall = true;
            break;
          }
        }
        if (hitWall) {
          SR.particles.spawnBurst(p.x, p.y, p.color, 3, { speedMin: 30, speedMax: 80, life: 0.18, size: 2.2 });
          projs.splice(i, 1);
          continue;
        }
      }

      let consumed = false;
      for (const e of game.enemies) {
        if (e.dead || p.hitIds.has(e.id)) continue;
        const pbox = { x: p.x - p.r, y: p.y - p.r, w: p.r * 2, h: p.r * 2 };
        if (SR.aabb(pbox, e)) {
          p.hitIds.add(e.id);
          e.takeDamage(p.dmg, p.x, p.magic, game);
          if (p.chill && !e.isBoss) {
            e.chillTimer = Math.max(e.chillTimer || 0, p.chill);
          }
          if (game.registerHitCombo) game.registerHitCombo();

          if (p.splash) {
            SR.particles.spawnRing(p.x, p.y, p.color, p.splash * 0.7, 0.24);
            for (const other of game.enemies) {
              if (other.dead || other.id === e.id) continue;
              if (Math.hypot(other.cx - p.x, other.cy - p.y) <= p.splash) {
                other.takeDamage(Math.round(p.dmg * 0.65), p.x, true, game);
                if (p.chill && !other.isBoss) {
                  other.chillTimer = Math.max(other.chillTimer || 0, p.chill * 0.75);
                }
              }
            }
          }

          p.pierce--;
          if (p.pierce <= 0) {
            consumed = true;
            break;
          }
        }
      }
      if (consumed) projs.splice(i, 1);
    }
  }

  function updateEnemyProjectiles(game, dt) {
    const projs = game.enemyProjectiles;
    const player = game.player;
    for (let i = projs.length - 1; i >= 0; i--) {
      const ep = projs[i];
      ep.life -= dt;
      if (ep.life <= 0) {
        projs.splice(i, 1);
        continue;
      }

      if (ep.homingPlayer && player) {
        const dx = player.cx - ep.x;
        const dy = player.cy - ep.y;
        const d = Math.hypot(dx, dy);
        if (d > 10 && d < 640) {
          const spd = ep.homingSpeed || 245;
          const turn = ep.homingTurn || 3.0;
          ep.vx += ((dx / d) * spd - ep.vx) * Math.min(1, dt * turn);
          ep.vy += ((dy / d) * spd - ep.vy) * Math.min(1, dt * turn);
        }
      }

      if (ep.gravity) ep.vy += ep.gravity * dt;
      ep.x += ep.vx * dt;
      ep.y += ep.vy * dt;

      // Bouncing projectiles (Basketballs, Boba cups, Cat-thrown cups/beers)
      if (ep.bounces && ep.bounces > 0 && ep.vy > 0) {
        for (const s of game.level.solids) {
          if (s.kind === 'wall') continue;
          if (ep.x > s.x && ep.x < s.x + s.w && ep.y + ep.r >= s.y && ep.y < s.y + 30) {
            ep.y = s.y - ep.r;
            ep.vy = -Math.abs(ep.vy) * 0.72;
            ep.bounces--;
            if (SR.audio.bounce) SR.audio.bounce();
            SR.particles.spawnBurst(ep.x, s.y, [ep.color, '#ffffff'], 4, { speedMin: 25, speedMax: 80, size: 2.5 });
            break;
          }
        }
      }

      if (ep.kind === 'bomb' || ep.kind === 'meteor' || ep.kind === 'error_drop' || ep.kind === 'stock_crash' || ep.kind === 'sky_food' || ep.kind === 'sky_sneeze' || ep.kind === 'sky_sport') {
        let hitGround = false;
        for (const s of game.level.solids) {
          if (s.kind === 'wall') continue;
          if (ep.x > s.x && ep.x < s.x + s.w && ep.y + ep.r >= s.y && ep.y < s.y + s.h) {
            hitGround = true;
            break;
          }
        }
        if (hitGround) {
          const big = ep.kind === 'meteor' || ep.kind === 'error_drop' || ep.kind === 'stock_crash';
          SR.particles.spawnRing(ep.x, ep.y, ep.color, big ? 68 : 44, 0.28);
          SR.particles.spawnBurst(ep.x, ep.y, [ep.color, '#ffffff'], 10, {
            speedMin: 60, speedMax: 180, size: 3.5, shape: 'star'
          });
          if (player && Math.hypot(player.cx - ep.x, player.cy - ep.y) < (big ? 54 : 40)) {
            player.takeDamage(1, player.cx >= ep.x ? 1 : -1, game);
          }
          projs.splice(i, 1);
          continue;
        }
      }

      if (player) {
        const pbox = { x: ep.x - ep.r * 0.85, y: ep.y - ep.r * 0.85, w: ep.r * 1.7, h: ep.r * 1.7 };
        if (SR.aabb(pbox, player)) {
          const pushDir = ep.vx !== 0 ? Math.sign(ep.vx) : (player.cx >= ep.x ? 1 : -1);
          if (ep.pushForce) {
            // Shiba's Bark Sound Wave pushes the player back a noticeable distance!
            player.applyKnockbackPush(pushDir, ep.pushForce, ep.pushLift || -210, game.level ? game.level.solids : null);
            SR.particles.spawnRing(ep.x, ep.y, '#ffe58f', 54, 0.26);
            SR.particles.spawnText(player.cx, player.y - 18, '汪！擊退！', '#ffe58f', 1.0);
            player.takeDamage(1, pushDir, game, true); // preserve strong bark push!
            projs.splice(i, 1);
          } else {
            const hit = player.takeDamage(1, pushDir, game);
            if (hit || (game.cheats && game.cheats.godMode)) {
              projs.splice(i, 1);
            }
          }
        }
      }
    }
  }

  // Enemies/Bosses currently performing a dash/charge/sweep attack (cannot be avoided by sliding!)
  const DASH_STATES = new Set([
    'charge', 'slash_dash', 'zoom', 'skate_dash',
    'dash', 'sweep',
    'cane_dash', 'wheelchair_dash', 'sprint_dash', 'bull_dash', 'coffee_dash', 'workout_dash'
  ]);

  function isEnemyDashing(e) {
    return !!(e && DASH_STATES.has(e.state));
  }

  SR.Combat = {
    applyPlayerMelee,
    applyBladeSurgeBlock,
    updatePlayerProjectiles,
    updateEnemyProjectiles,
    isEnemyDashing
  };
})(window.SR);
