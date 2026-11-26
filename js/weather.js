// Dynamic Weather System:
// 1) Tracking Thundercloud: enters from boundary, tracks player, stops & aggregates electricity for 1.0s, strikes 2x wide!
// 2) Raindrops & Puddles: stratified sky droplets splash on terrain -> distributed temporary puddle -> strong temporary slow.
window.SR = window.SR || {};

(function (SR) {
  class WeatherSystem {
    constructor() {
      this.clouds = [];
      this.drops = [];
      this.puddles = [];
      this.lightningTimer = 11;
      this.rainTimer = 0.9;
      this.rainSectors = [];
      this.config = {
        lightningMin: 14,
        lightningMax: 21,
        rainRate: 1.85,
        hellTheme: false
      };
    }

    reset(mapConfig) {
      this.clouds = [];
      this.drops = [];
      this.puddles = [];
      this.rainSectors = [];
      const diff = (mapConfig && mapConfig.difficulty) || 1;
      this.config = {
        lightningMin: Math.max(9.5, 16 - diff * 1.2),
        lightningMax: Math.max(14, 23 - diff * 1.6),
        rainRate: Math.max(0.78, 1.95 - diff * 0.22),
        hellTheme: !!(mapConfig && mapConfig.id === 'hell')
      };
      this.lightningTimer = 7.5 + Math.random() * 4.5;
      this.rainTimer = 1.1;
    }

    spawnTrackingCloud(player, camX, viewW) {
      const fromRight = Math.random() < 0.6;
      const startX = fromRight ? camX + viewW + 90 : camX - 90;
      const y = Math.max(76, Math.min(185, player.y - 210));
      this.clouds.push({
        x: startX,
        y,
        vx: 0,
        state: 'tracking', // 'tracking' -> 'charging' (1.0s) -> 'striking' (0.34s) -> 'fading'
        timer: 0,
        chargeDuration: 1.0,
        strikeY: 640,
        hitPlayer: false,
        alpha: 0,
        sparks: [],
        boltPts: [],
        trackTime: 0
      });
    }

    findGroundY(x, startY, level) {
      let bestY = 660;
      for (const s of level.solids) {
        if (s.kind === 'wall') continue;
        if (x >= s.x && x <= s.x + s.w && s.y >= startY && s.y < bestY) {
          bestY = s.y;
        }
      }
      for (const b of level.bars) {
        if (x >= b.x + 6 && x <= b.x + b.w - 6 && b.y >= startY && b.y < bestY) {
          bestY = b.y;
        }
      }
      return bestY;
    }

    buildBoltPoints(x, y1, y2) {
      const pts = [{ x, y: y1 }];
      const segs = 9;
      for (let i = 1; i < segs; i++) {
        const t = i / segs;
        pts.push({
          x: x + (Math.random() - 0.5) * 52,
          y: y1 + (y2 - y1) * t
        });
      }
      pts.push({ x, y: y2 });
      return pts;
    }

    spawnRaindrop(camX, viewW) {
      // Stratified horizontal distribution across 5 screen sectors so droplets & puddles stay well spread out
      if (this.rainSectors.length === 0) {
        this.rainSectors = [0, 1, 2, 3, 4];
        for (let i = this.rainSectors.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          const tmp = this.rainSectors[i];
          this.rainSectors[i] = this.rainSectors[j];
          this.rainSectors[j] = tmp;
        }
      }
      const sector = this.rainSectors.pop();
      const usableW = viewW - 140;
      const sectorW = usableW / 5;
      const x = camX + 70 + sector * sectorW + (0.15 + Math.random() * 0.7) * sectorW;
      this.drops.push({
        x,
        y: -14,
        vx: -18 - Math.random() * 14,
        vy: 330 + Math.random() * 100,
        r: 4 + Math.random() * 2.2
      });
    }

    update(dt, player, level, camX, viewW, game) {
      if (!player) return;

      // 1) Lightning cloud spawner (rare yet not too rare)
      this.lightningTimer -= dt;
      if (this.lightningTimer <= 0 && this.clouds.length < 1) {
        this.spawnTrackingCloud(player, camX, viewW);
        this.lightningTimer = this.config.lightningMin + Math.random() * (this.config.lightningMax - this.config.lightningMin);
      }

      // Update clouds
      for (let i = this.clouds.length - 1; i >= 0; i--) {
        const c = this.clouds[i];
        c.timer += dt;

        if (c.state === 'tracking') {
          c.alpha = Math.min(1, c.alpha + dt * 2.4);
          c.trackTime += dt;
          const dx = player.cx - c.x;
          const desiredY = Math.max(72, Math.min(185, player.y - 220));
          const maxSpd = 420;
          const targetVx = Math.max(-maxSpd, Math.min(maxSpd, dx * 3.5));
          c.vx += (targetVx - c.vx) * Math.min(1, dt * 6);
          c.x += c.vx * dt;
          c.y += (desiredY - c.y) * Math.min(1, dt * 3);

          // Lock on once aligned above player (or after max 4.5s tracking)
          if ((Math.abs(dx) < 26 && c.trackTime > 0.65) || c.trackTime > 4.5) {
            c.state = 'charging';
            c.timer = 0;
            c.vx = 0;
            c.strikeY = this.findGroundY(c.x, c.y + 20, level);
            SR.audio.lightningCharge();
          }
        } else if (c.state === 'charging') {
          // Stop in place for 1.5s while aggregating electric power!
          c.strikeY = this.findGroundY(c.x, c.y + 20, level);
          if (Math.random() < 0.65) {
            const ang = Math.random() * Math.PI * 2;
            const dist = 36 + Math.random() * 44;
            c.sparks.push({
              x: c.x + Math.cos(ang) * dist,
              y: c.y + 8 + Math.sin(ang) * dist * 0.55,
              life: 0.22,
              maxLife: 0.22
            });
          }
          for (let s = c.sparks.length - 1; s >= 0; s--) {
            const sp = c.sparks[s];
            sp.life -= dt;
            sp.x += (c.x - sp.x) * Math.min(1, dt * 11);
            sp.y += (c.y + 8 - sp.y) * Math.min(1, dt * 11);
            if (sp.life <= 0) c.sparks.splice(s, 1);
          }

          if (c.timer >= c.chargeDuration) {
            c.state = 'striking';
            c.timer = 0;
            c.boltPts = this.buildBoltPoints(c.x, c.y + 18, c.strikeY);
            SR.audio.lightningStrike();
            game.addShake(4);
            SR.particles.spawnRing(c.x, c.strikeY, this.config.hellTheme ? '#ff91b8' : '#b8f3ff', 68, 0.34);
            SR.particles.spawnBurst(c.x, c.strikeY, ['#ffffff', '#ffe88f', '#8beeff'], 18, {
              speedMin: 80, speedMax: 250, upward: 90, size: 4, shape: 'star'
            });
          }
        } else if (c.state === 'striking') {
          if (Math.random() < 0.5) {
            c.boltPts = this.buildBoltPoints(c.x, c.y + 18, c.strikeY);
          }
          // Check player collision with 2x wider lightning column during active strike window
          if (!c.hitPlayer && c.timer < 0.22) {
            const boltBox = {
              x: c.x - 44,
              y: c.y + 18,
              w: 88,
              h: Math.max(40, c.strikeY - (c.y + 18))
            };
            if (SR.aabb(boltBox, player)) {
              c.hitPlayer = true;
              player.takeDamage(1, player.cx >= c.x ? 1 : -1, game);
            }
          }
          if (c.timer >= 0.34) {
            c.state = 'fading';
            c.timer = 0;
          }
        } else if (c.state === 'fading') {
          c.alpha -= dt * 1.4;
          c.y -= dt * 24;
          if (c.alpha <= 0) {
            this.clouds.splice(i, 1);
          }
        }
      }

      // 2) Raindrops spawner
      this.rainTimer -= dt;
      if (this.rainTimer <= 0) {
        this.spawnRaindrop(camX, viewW);
        this.rainTimer = this.config.rainRate * (0.65 + Math.random() * 0.7);
      }

      // Update raindrops -> create temporary puddles on ground/plateau/bar impact
      for (let i = this.drops.length - 1; i >= 0; i--) {
        const d = this.drops[i];
        d.x += d.vx * dt;
        d.y += d.vy * dt;

        let landedY = null;
        for (const s of level.solids) {
          if (s.kind === 'wall') continue;
          if (d.x >= s.x + 8 && d.x <= s.x + s.w - 8 && d.y >= s.y && d.y <= s.y + 24) {
            landedY = s.y;
            break;
          }
        }
        if (landedY === null) {
          for (const b of level.bars) {
            if (d.x >= b.x + 12 && d.x <= b.x + b.w - 12 && d.y >= b.y && d.y <= b.y + 14) {
              landedY = b.y;
              break;
            }
          }
        }

        if (landedY !== null) {
          // Splash into a distributed temporary slowing puddle (wider spacing & lower density)
          const existsNear = this.puddles.find((p) => Math.abs(p.x - d.x) < 165 && Math.abs(p.y - landedY) < 28);
          if (existsNear) {
            existsNear.life = Math.min(existsNear.maxLife, existsNear.life + 2.0);
          } else if (this.puddles.length < 5) {
            this.puddles.push({
              x: d.x,
              y: landedY,
              w: 72,
              life: 7.5,
              maxLife: 7.5,
              ripple: 0
            });
          }
          SR.particles.spawnBurst(d.x, landedY, this.config.hellTheme ? ['#ff94b8', '#ffd294'] : ['#9cebff', '#d6f8ff'], 4, {
            speedMin: 25, speedMax: 75, upward: 45, life: 0.25, size: 2.5
          });
          this.drops.splice(i, 1);
          continue;
        }

        if (d.y > 700) {
          this.drops.splice(i, 1);
        }
      }

      // 3) Update temporary puddles & apply temporary slow to player stepping in them
      const viewCenter = camX + viewW * 0.5;
      for (let i = this.puddles.length - 1; i >= 0; i--) {
        const p = this.puddles[i];
        p.life -= dt;
        p.ripple += dt * 4;
        if (p.life <= 0 || Math.abs(p.x - viewCenter) > viewW) {
          this.puddles.splice(i, 1);
          continue;
        }
        // Check if player feet are stepping on this puddle
        const feetY = player.y + player.h;
        if (
          player.onGround &&
          Math.abs(feetY - p.y) < 10 &&
          player.x + player.w > p.x - p.w * 0.45 &&
          player.x < p.x + p.w * 0.45
        ) {
          player.applySlow(2.0);
          if (Math.abs(player.vx) > 40 && Math.random() < 0.25) {
            SR.particles.spawnBurst(player.cx, feetY, this.config.hellTheme ? ['#ff94b8', '#ffda9e'] : ['#9cebff', '#ffffff'], 2, {
              speedMin: 20, speedMax: 65, upward: 50, life: 0.24, size: 2.5
            });
          }
        }
      }
    }

    draw(ctx, time) {
      const isHell = this.config.hellTheme;

      // Draw temporary puddles on terrain surfaces
      for (const p of this.puddles) {
        const fade = Math.min(1, p.life / 1.4);
        ctx.save();
        ctx.globalAlpha = 0.78 * fade;
        const grad = ctx.createRadialGradient(p.x, p.y, 4, p.x, p.y, p.w * 0.52);
        if (isHell) {
          grad.addColorStop(0, '#ff8cb8');
          grad.addColorStop(0.65, '#c94c8a');
          grad.addColorStop(1, 'rgba(180, 50, 110, 0)');
        } else {
          grad.addColorStop(0, '#c8f8ff');
          grad.addColorStop(0.65, '#66c9ff');
          grad.addColorStop(1, 'rgba(80, 175, 255, 0)');
        }
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.ellipse(p.x, p.y + 1, p.w * 0.52, 7.5, 0, 0, Math.PI * 2);
        ctx.fill();

        // Subtle shimmering surface ripple
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.68)';
        ctx.lineWidth = 1.5;
        const rw = 10 + ((p.ripple * 9) % (p.w * 0.38));
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, rw, 2.8, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      // Draw falling raindrops
      for (const d of this.drops) {
        ctx.save();
        ctx.translate(d.x, d.y);
        ctx.rotate(0.08);
        ctx.fillStyle = isHell ? 'rgba(255, 165, 198, 0.85)' : 'rgba(178, 240, 255, 0.88)';
        ctx.shadowColor = isHell ? '#ff8cb8' : '#8ae4ff';
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.moveTo(0, -d.r * 2.2);
        ctx.quadraticCurveTo(d.r * 1.15, 0, 0, d.r * 1.1);
        ctx.quadraticCurveTo(-d.r * 1.15, 0, 0, -d.r * 2.2);
        ctx.fill();
        ctx.restore();
      }

      // Draw tracking thunderclouds, 1.5s electric charge aggregation, and lightning bolts
      for (const c of this.clouds) {
        ctx.save();
        ctx.globalAlpha = Math.max(0, Math.min(1, c.alpha));

        // Charging warning shimmer & aggregating arcs (1.5 seconds!)
        if (c.state === 'charging') {
          const prog = Math.min(1, c.timer / c.chargeDuration);
          const pulse = 0.16 + prog * 0.34 + Math.sin(time * 26) * 0.08;

          // 2x wider vertical warning zone below the stopped cloud
          const beam = ctx.createLinearGradient(c.x, c.y + 18, c.x, c.strikeY);
          beam.addColorStop(0, isHell ? `rgba(255, 130, 175, ${pulse * 1.3})` : `rgba(165, 240, 255, ${pulse * 1.3})`);
          beam.addColorStop(1, isHell ? `rgba(255, 224, 135, ${pulse})` : `rgba(255, 240, 155, ${pulse})`);
          ctx.fillStyle = beam;
          ctx.fillRect(c.x - 36, c.y + 18, 72, Math.max(0, c.strikeY - (c.y + 18)));

          // Dashed outer & center warning lines
          ctx.strokeStyle = '#fff09c';
          ctx.lineWidth = 2;
          ctx.setLineDash([7, 6]);
          ctx.beginPath();
          ctx.moveTo(c.x, c.y + 18);
          ctx.lineTo(c.x, c.strikeY);
          ctx.stroke();
          ctx.setLineDash([]);

          // 2x wider ground danger ring pulsing
          ctx.strokeStyle = '#ffe88a';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.ellipse(c.x, c.strikeY, 34 + prog * 24, 8, 0, 0, Math.PI * 2);
          ctx.stroke();

          // Aggregating electric sparks pulled into the cloud core!
          ctx.strokeStyle = '#e6fbff';
          ctx.lineWidth = 2;
          for (const sp of c.sparks) {
            ctx.beginPath();
            ctx.moveTo(sp.x, sp.y);
            ctx.lineTo(c.x + (Math.random() - 0.5) * 10, c.y + 10);
            ctx.stroke();
          }

          // Swelling glowing electric core in center of cloud
          ctx.shadowColor = '#ffe98a';
          ctx.shadowBlur = 14 + prog * 18;
          ctx.fillStyle = '#fff5b8';
          ctx.beginPath();
          ctx.arc(c.x, c.y + 12, 6 + prog * 12, 0, Math.PI * 2);
          ctx.fill();
        }

        // Active 2x Wide Lightning Bolt!
        if (c.state === 'striking' && c.boltPts.length > 1) {
          ctx.save();
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          // 2x Outer glow
          ctx.strokeStyle = isHell ? '#ff8cb8' : '#7ee8ff';
          ctx.shadowColor = isHell ? '#ff8cb8' : '#7ee8ff';
          ctx.shadowBlur = 32;
          ctx.lineWidth = 28;
          ctx.beginPath();
          ctx.moveTo(c.boltPts[0].x, c.boltPts[0].y);
          for (let k = 1; k < c.boltPts.length; k++) ctx.lineTo(c.boltPts[k].x, c.boltPts[k].y);
          ctx.stroke();

          // 2x Bright white-gold core
          ctx.strokeStyle = '#fffbe0';
          ctx.lineWidth = 11;
          ctx.beginPath();
          ctx.moveTo(c.boltPts[0].x, c.boltPts[0].y);
          for (let k = 1; k < c.boltPts.length; k++) ctx.lineTo(c.boltPts[k].x, c.boltPts[k].y);
          ctx.stroke();
          ctx.restore();
        }

        // Cute-ominous storm cloud body
        const jitterX = c.state === 'charging' ? Math.sin(time * 42) * 2.5 : 0;
        const cx = c.x + jitterX;
        const cy = c.y;
        const cg = ctx.createLinearGradient(cx, cy - 28, cx, cy + 24);
        if (isHell) {
          cg.addColorStop(0, '#5a234a');
          cg.addColorStop(1, '#291026');
        } else {
          cg.addColorStop(0, '#5c558e');
          cg.addColorStop(1, '#2c2552');
        }
        ctx.fillStyle = cg;
        ctx.shadowColor = c.state === 'charging' ? '#ffe58f' : 'rgba(20, 12, 48, 0.5)';
        ctx.shadowBlur = c.state === 'charging' ? 20 : 10;
        ctx.beginPath();
        ctx.arc(cx - 28, cy + 4, 21, 0, Math.PI * 2);
        ctx.arc(cx, cy - 8, 28, 0, Math.PI * 2);
        ctx.arc(cx + 28, cy + 4, 21, 0, Math.PI * 2);
        ctx.arc(cx - 10, cy + 10, 19, 0, Math.PI * 2);
        ctx.arc(cx + 12, cy + 10, 19, 0, Math.PI * 2);
        ctx.fill();

        // Cute grumpy glowing storm eyes on the cloud!
        ctx.fillStyle = c.state === 'charging' || c.state === 'striking' ? '#ffe88a' : '#b8e8ff';
        ctx.beginPath();
        ctx.arc(cx - 9, cy + 2, 3, 0, Math.PI * 2);
        ctx.arc(cx + 9, cy + 2, 3, 0, Math.PI * 2);
        ctx.fill();

        // Countdown lightning emblem & crackling electric arcs on top of cloud while aggregating (1.5s)
        if (c.state === 'charging') {
          const prog = Math.min(1, c.timer / c.chargeDuration);
          ctx.save();
          ctx.strokeStyle = '#fff39c';
          ctx.shadowColor = '#8beeff';
          ctx.shadowBlur = 12;
          ctx.lineWidth = 2.2;
          for (let a = 0; a < 4; a++) {
            const ang = time * 5 + a * (Math.PI * 0.5);
            const rOuter = 32 - prog * 10;
            const sx = cx + Math.cos(ang) * rOuter;
            const sy = cy + Math.sin(ang) * (rOuter * 0.65);
            const mx = (cx + sx) * 0.5 + (Math.random() - 0.5) * 10;
            const my = (cy + 4 + sy) * 0.5 + (Math.random() - 0.5) * 10;
            ctx.beginPath();
            ctx.moveTo(sx, sy);
            ctx.lineTo(mx, my);
            ctx.lineTo(cx, cy + 6);
            ctx.stroke();
          }
          ctx.fillStyle = '#fff9c4';
          ctx.beginPath();
          ctx.arc(cx, cy + 8, 4 + prog * 8, 0, Math.PI * 2);
          ctx.fill();
          ctx.font = '800 14px "Quicksand", sans-serif';
          ctx.textAlign = 'center';
          ctx.fillStyle = '#ffe88a';
          ctx.fillText('⚡', cx, cy - 38);
          ctx.restore();
        }

        ctx.restore();
      }
    }
  }

  SR.weather = new WeatherSystem();
})(window.SR);
