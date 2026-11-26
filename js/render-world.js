// World Renderer: Dynamic Sky & Moon, Parallax Hills, Viewport-Culled Props, Terrain,
// Bars, Moving Clouds, Checkpoints, Pickups, Arena Barriers & Dreamland Island World Map.
window.SR = window.SR || {};

(function (SR) {
  const BG_STARS = [];
  for (let i = 0; i < 68; i++) {
    BG_STARS.push({
      x: SR.hash01(i * 3 + 1) * 1200,
      y: 22 + SR.hash01(i * 3 + 2) * 295,
      r: 1.0 + SR.hash01(i * 3 + 3) * 2.2,
      phase: SR.hash01(i * 3 + 4) * Math.PI * 2
    });
  }

  const BG_CLOUDS = [
    { x: 110, y: 120, s: 1.15 },
    { x: 430, y: 88, s: 0.9 },
    { x: 760, y: 145, s: 1.3 },
    { x: 1080, y: 105, s: 0.95 },
    { x: 1380, y: 165, s: 1.1 }
  ];

  function getBlendedPalette(level, worldX) {
    const list = level.territories;
    let idx = 0;
    for (let i = 0; i < list.length; i++) {
      if (worldX >= list[i].startX) idx = i;
    }
    const cur = list[idx];
    const next = list[Math.min(list.length - 1, idx + 1)];
    const blendZone = 320;
    let t = 0;
    if (cur !== next && worldX > cur.endX - blendZone) {
      t = SR.clamp((worldX - (cur.endX - blendZone)) / blendZone, 0, 1);
    }
    return {
      skyTop: SR.lerpColor(cur.skyTop, next.skyTop, t),
      skyMid: SR.lerpColor(cur.skyMid, next.skyMid, t),
      skyBot: SR.lerpColor(cur.skyBot, next.skyBot, t),
      hillFar: SR.lerpColor(cur.hillFar, next.hillFar, t),
      hillNear: SR.lerpColor(cur.hillNear, next.hillNear, t),
      groundTop: SR.lerpColor(cur.groundTop, next.groundTop, t),
      groundBody: SR.lerpColor(cur.groundBody, next.groundBody, t),
      accent: SR.lerpColor(cur.accent, next.accent, t)
    };
  }

  function drawBackground(ctx, level, camX, time, W, H) {
    const pal = getBlendedPalette(level, camX + W * 0.5);
    const isHell = !!(level.meta && level.meta.id === 'hell');

    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, pal.skyTop);
    sky.addColorStop(0.55, pal.skyMid);
    sky.addColorStop(1, pal.skyBot);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    // Subtle dreamy horizon glow bloom for atmospheric depth
    const horizon = ctx.createRadialGradient(W * 0.5, H * 0.85, 40, W * 0.5, H * 0.85, W * 0.65);
    horizon.addColorStop(0, isHell ? 'rgba(255, 115, 140, 0.16)' : 'rgba(255, 226, 248, 0.18)');
    horizon.addColorStop(1, 'rgba(255, 226, 248, 0)');
    ctx.fillStyle = horizon;
    ctx.fillRect(0, 0, W, H);

    // Stars / Embers
    for (const s of BG_STARS) {
      const sx = ((s.x - camX * 0.04) % W + W) % W;
      const alpha = 0.35 + 0.55 * Math.sin(time * 2.1 + s.phase);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = isHell ? '#ffd2a8' : '#fff9e6';
      if (s.r > 2.2) {
        SR.drawStar(ctx, sx, s.y, 4, s.r * 2.2, s.r * 0.65);
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.arc(sx, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // Crescent Moon (or Blood-Eclipse Moon in Dream-Hell!) gently framed in upper-right sky
    const prog = level.width > 0 ? SR.clamp(camX / level.width, 0, 1) : 0;
    const moonX = 885 - prog * 95;
    const moonY = 122;
    ctx.save();
    const halo = ctx.createRadialGradient(moonX, moonY, 18, moonX, moonY, 138);
    if (isHell) {
      halo.addColorStop(0, 'rgba(255, 110, 145, 0.55)');
      halo.addColorStop(0.5, 'rgba(255, 165, 95, 0.22)');
      halo.addColorStop(1, 'rgba(255, 80, 120, 0)');
    } else {
      halo.addColorStop(0, 'rgba(255, 244, 210, 0.5)');
      halo.addColorStop(0.45, 'rgba(255, 198, 238, 0.18)');
      halo.addColorStop(1, 'rgba(255, 198, 238, 0)');
    }
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(moonX, moonY, 138, 0, Math.PI * 2);
    ctx.fill();

    if (isHell) {
      ctx.fillStyle = '#ff9bb4';
      ctx.shadowColor = '#ff6b94';
      ctx.shadowBlur = 22;
      ctx.beginPath();
      ctx.arc(moonX, moonY, 44, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#240718';
      ctx.beginPath();
      ctx.arc(moonX + 4, moonY - 2, 34, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = '#fff5cf';
      ctx.shadowColor = 'rgba(255, 240, 185, 0.85)';
      ctx.shadowBlur = 18;
      ctx.beginPath();
      ctx.arc(moonX, moonY, 42, 0.22 * Math.PI, 1.72 * Math.PI, false);
      ctx.quadraticCurveTo(moonX - 8, moonY - 4, moonX + Math.cos(0.22 * Math.PI) * 42, moonY + Math.sin(0.22 * Math.PI) * 42);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    // Soft clouds
    ctx.save();
    for (const c of BG_CLOUDS) {
      const cx = (((c.x - camX * 0.08 + time * 8) % 1560) + 1560) % 1560 - 180;
      const cy = c.y + Math.sin(time * 0.6 + c.x) * 4;
      ctx.fillStyle = isHell ? 'rgba(255, 130, 165, 0.16)' : 'rgba(255, 240, 250, 0.25)';
      ctx.beginPath();
      ctx.arc(cx, cy, 34 * c.s, 0, Math.PI * 2);
      ctx.arc(cx + 32 * c.s, cy - 10 * c.s, 42 * c.s, 0, Math.PI * 2);
      ctx.arc(cx + 70 * c.s, cy, 32 * c.s, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // Parallax hills / jagged hell ridges
    ctx.save();
    ctx.fillStyle = pal.hillFar;
    ctx.globalAlpha = 0.56;
    ctx.beginPath();
    ctx.moveTo(0, H);
    for (let x = 0; x <= W + 40; x += 40) {
      const wx = x + camX * 0.16;
      const y = isHell
        ? 418 + Math.abs(Math.sin(wx * 0.0045)) * -64 + Math.cos(wx * 0.011) * 24
        : 418 + Math.sin(wx * 0.0032) * 52 + Math.cos(wx * 0.0075) * 22;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(W, H);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = pal.hillNear;
    ctx.globalAlpha = 0.64;
    ctx.beginPath();
    ctx.moveTo(0, H);
    for (let x = 0; x <= W + 30; x += 30) {
      const wx = x + camX * 0.3;
      const y = 488 + Math.sin(wx * 0.0046 + 1.2) * 40 + Math.cos(wx * 0.009) * 16;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(W, H);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    return pal;
  }

  function drawProps(ctx, level, time, minVisX, maxVisX) {
    for (const p of level.props) {
      if (p.x < minVisX - 140 || p.x > maxVisX + 140) continue;
      ctx.save();
      if (p.kind === 'tree') {
        const s = p.scale || 1;
        ctx.translate(p.x, p.y);
        ctx.fillStyle = '#6c4d7a';
        SR.roundRect(ctx, -9 * s, -68 * s, 18 * s, 70 * s, 7);
        ctx.fill();
        const colors = p.hue === 'mint'
          ? ['#88e8d4', '#b4f8ea', '#e2fff8']
          : p.hue === 'lavender'
            ? ['#b896f2', '#d7bdff', '#f3e6ff']
            : ['#ff9fd2', '#ffc2e4', '#ffe7f5'];
        const sway = Math.sin(time * 1.4 + p.x * 0.02) * 3;
        ctx.fillStyle = colors[0];
        ctx.beginPath();
        ctx.arc(-26 * s + sway, -72 * s, 32 * s, 0, Math.PI * 2);
        ctx.arc(26 * s + sway, -70 * s, 30 * s, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = colors[1];
        ctx.beginPath();
        ctx.arc(sway, -92 * s, 38 * s, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = colors[2];
        ctx.globalAlpha = 0.7;
        ctx.beginPath();
        ctx.arc(-10 * s + sway, -104 * s, 16 * s, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.kind === 'lantern') {
        ctx.translate(p.x, p.y);
        ctx.strokeStyle = '#d8c2ff';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(0, -56);
        ctx.quadraticCurveTo(0, -68, 12, -66);
        ctx.stroke();
        const glow = 0.75 + 0.25 * Math.sin(time * 3 + p.x);
        ctx.shadowColor = '#ffe594';
        ctx.shadowBlur = 16;
        ctx.fillStyle = `rgba(255, 232, 152, ${glow})`;
        ctx.beginPath();
        ctx.arc(13, -58, 7, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.kind === 'flowerCluster') {
        for (let i = -2; i <= 2; i++) {
          const fx = p.x + i * 16;
          const fy = p.y - 6 - (Math.abs(i) % 2) * 5;
          ctx.fillStyle = ['#ff9fd6', '#ffe58f', '#9cf5e3'][Math.abs(i) % 3];
          ctx.beginPath(); ctx.arc(fx, fy, 5, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#fff';
          ctx.beginPath(); ctx.arc(fx, fy, 2, 0, Math.PI * 2); ctx.fill();
        }
      } else if (p.kind === 'crystalPillar') {
        const h = p.h || 100;
        const grad = ctx.createLinearGradient(p.x, p.y - h, p.x, p.y);
        grad.addColorStop(0, 'rgba(184, 245, 255, 0.85)');
        grad.addColorStop(1, 'rgba(130, 114, 212, 0.55)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(p.x - 16, p.y);
        ctx.lineTo(p.x - 12, p.y - h + 20);
        ctx.lineTo(p.x, p.y - h);
        ctx.lineTo(p.x + 12, p.y - h + 20);
        ctx.lineTo(p.x + 16, p.y);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      } else if (p.kind === 'hellSpire') {
        const h = p.h || 130;
        const grad = ctx.createLinearGradient(p.x, p.y - h, p.x, p.y);
        grad.addColorStop(0, '#ff7da4');
        grad.addColorStop(0.35, '#591a38');
        grad.addColorStop(1, '#220918');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(p.x - 20, p.y);
        ctx.lineTo(p.x - 11, p.y - h * 0.65);
        ctx.lineTo(p.x, p.y - h);
        ctx.lineTo(p.x + 13, p.y - h * 0.6);
        ctx.lineTo(p.x + 20, p.y);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 200, 125, 0.72)';
        ctx.lineWidth = 1.8;
        ctx.stroke();
      } else if (p.kind === 'sanctuaryArch') {
        const isHell = !!(level.meta && level.meta.id === 'hell');
        ctx.translate(p.x, p.y);
        ctx.strokeStyle = isHell ? 'rgba(255, 135, 170, 0.45)' : 'rgba(246, 206, 255, 0.42)';
        ctx.lineWidth = 12;
        ctx.beginPath();
        ctx.moveTo(-45, 0);
        ctx.lineTo(-45, -130);
        ctx.arc(0, -130, 45, Math.PI, 0);
        ctx.lineTo(45, 0);
        ctx.stroke();
        ctx.fillStyle = isHell ? '#ff9466' : '#ffe694';
        ctx.shadowColor = isHell ? '#ff708c' : '#ffe694';
        ctx.shadowBlur = 14;
        SR.drawStar(ctx, 0, -175, 4, 11, 4);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  function drawTerrain(ctx, level, pal, time, minVisX, maxVisX) {
    // Basin mist / lava shimmer
    const mists = [level.basinMist, level.basinMist2].filter(Boolean);
    for (const bm of mists) {
      if (bm.x + bm.w < minVisX || bm.x > maxVisX) continue;
      ctx.save();
      const mistColors = bm.style === 'lava'
        ? ['rgba(255, 120, 95, 0)', 'rgba(255, 130, 95, 0.48)', 'rgba(255, 224, 145, 0.8)']
        : bm.style === 'dusk'
          ? ['rgba(210, 150, 255, 0)', 'rgba(210, 150, 255, 0.36)', 'rgba(245, 210, 255, 0.65)']
          : bm.style === 'frost'
            ? ['rgba(165, 240, 255, 0)', 'rgba(165, 240, 255, 0.38)', 'rgba(235, 255, 255, 0.72)']
            : ['rgba(148, 248, 234, 0)', 'rgba(148, 248, 234, 0.34)', 'rgba(210, 255, 248, 0.58)'];

      const mistGrad = ctx.createLinearGradient(0, bm.y - 24, 0, bm.y + bm.h);
      mistGrad.addColorStop(0, mistColors[0]);
      mistGrad.addColorStop(1, mistColors[1]);
      ctx.fillStyle = mistGrad;
      ctx.fillRect(bm.x, bm.y - 24, bm.w, bm.h + 24);
      ctx.strokeStyle = mistColors[2];
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      const sx = Math.max(bm.x, Math.floor(minVisX / 24) * 24);
      const ex = Math.min(bm.x + bm.w, maxVisX + 24);
      for (let x = sx; x <= ex; x += 24) {
        const y = bm.y + 8 + Math.sin(x * 0.03 + time * 2.8) * 3;
        if (x === sx) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.restore();
    }

    // Solid ground, plateaus, basins & slide arches
    for (const s of level.solids) {
      if (s.kind === 'wall') continue;
      if (s.x + s.w < minVisX || s.x > maxVisX) continue;
      ctx.save();
      if (s.kind === 'arch') {
        const isHell = !!(level.meta && level.meta.id === 'hell');
        const g = ctx.createLinearGradient(s.x, s.y, s.x, s.y + s.h);
        g.addColorStop(0, isHell ? '#cc4d78' : '#c8a6ff');
        g.addColorStop(1, isHell ? '#4f1730' : '#795ec4');
        ctx.fillStyle = g;
        SR.roundRect(ctx, s.x, s.y, s.w, s.h, 16);
        ctx.fill();
        ctx.strokeStyle = isHell ? 'rgba(255, 200, 145, 0.78)' : 'rgba(255, 240, 255, 0.72)';
        ctx.lineWidth = 2.5;
        ctx.stroke();

        ctx.fillStyle = isHell ? '#ffcf96' : '#ffe5f6';
        SR.roundRect(ctx, s.x + 8, s.y + 6, s.w - 16, 10, 6);
        ctx.fill();

        if (s.hint) {
          const bob = Math.sin(time * 3.5) * 2.5;
          ctx.font = '800 12px "Quicksand", "Segoe UI", sans-serif';
          ctx.textAlign = 'center';
          ctx.fillStyle = '#ffe899';
          ctx.shadowColor = 'rgba(20, 10, 45, 0.9)';
          ctx.shadowBlur = 6;
          ctx.fillText(s.hint, s.x + s.w * 0.5, s.y + s.h * 0.62 + bob);
        }
      } else {
        const bodyColor = s.kind === 'hell'
          ? '#331124'
          : s.kind === 'plateau'
            ? '#4f5a9a'
            : s.kind === 'basin'
              ? '#2c416d'
              : s.kind === 'sanctuary'
                ? '#3b2463'
                : '#5b4687';
        const topColor = s.kind === 'hell'
          ? '#ff849e'
          : s.kind === 'plateau'
            ? '#aef1ff'
            : s.kind === 'basin'
              ? '#8af2df'
              : s.kind === 'sanctuary'
                ? '#f4bfff'
                : '#92ebc9';

        const grad = ctx.createLinearGradient(s.x, s.y, s.x, s.y + Math.min(180, s.h));
        grad.addColorStop(0, bodyColor);
        grad.addColorStop(1, s.kind === 'hell' ? '#170610' : '#1e163a');
        ctx.fillStyle = grad;
        SR.roundRect(ctx, s.x, s.y, s.w, s.h, 14);
        ctx.fill();

        // Subtle stone/crystal facets
        ctx.fillStyle = s.kind === 'hell' ? 'rgba(255, 165, 110, 0.14)' : 'rgba(255, 255, 255, 0.06)';
        const startFacet = Math.max(s.x + 22, Math.floor(minVisX / 64) * 64);
        const endFacet = Math.min(s.x + s.w - 30, maxVisX);
        for (let px = startFacet; px < endFacet; px += 64) {
          if (px >= s.x + 18) {
            SR.roundRect(ctx, px, s.y + 26, 36, 14, 7);
            ctx.fill();
          }
        }

        // Luminous pastel grass/crystal trim cap
        ctx.fillStyle = topColor;
        SR.roundRect(ctx, s.x, s.y, s.w, 15, 9);
        ctx.fill();
        ctx.fillStyle = s.kind === 'hell' ? 'rgba(255, 232, 160, 0.55)' : 'rgba(255, 255, 255, 0.48)';
        SR.roundRect(ctx, s.x + 6, s.y + 2, s.w - 12, 4.5, 4);
        ctx.fill();
      }
      ctx.restore();
    }

    // One-way bars (橫桿)
    for (const bar of level.bars) {
      if (bar.x + bar.w < minVisX || bar.x > maxVisX) continue;
      ctx.save();
      const colors = bar.style === 'hell'
        ? ['#ff7096', '#ffcf78']
        : bar.style === 'crystal'
          ? ['#a8eeff', '#72a8ff']
          : bar.style === 'moon'
            ? ['#9ef7e7', '#55b8c7']
            : bar.style === 'star'
              ? ['#ffe594', '#ff9fd6']
              : ['#ffd2e8', '#c89bff'];

      const g = ctx.createLinearGradient(bar.x, bar.y, bar.x + bar.w, bar.y);
      g.addColorStop(0, colors[0]);
      g.addColorStop(0.5, '#ffffff');
      g.addColorStop(1, colors[1]);

      ctx.shadowColor = colors[0];
      ctx.shadowBlur = 10;
      ctx.fillStyle = g;
      SR.roundRect(ctx, bar.x, bar.y, bar.w, 11, 6);
      ctx.fill();

      ctx.fillStyle = '#ffe9a3';
      SR.drawStar(ctx, bar.x + 4, bar.y + 5.5, 4, 7, 2.8);
      ctx.fill();
      SR.drawStar(ctx, bar.x + bar.w - 4, bar.y + 5.5, 4, 7, 2.8);
      ctx.fill();
      ctx.restore();
    }

    // Moving floating cloud platforms
    for (const mp of level.movingPlatforms) {
      if (mp.x + mp.w < minVisX - 60 || mp.x > maxVisX + 60) continue;
      const isHell = !!(level.meta && level.meta.id === 'hell');
      ctx.save();
      ctx.shadowColor = isHell ? 'rgba(255, 130, 160, 0.7)' : 'rgba(255, 232, 250, 0.7)';
      ctx.shadowBlur = 12;
      ctx.fillStyle = isHell ? '#ffd6e2' : '#fff5fd';
      const cx = mp.x + mp.w * 0.5;
      const cy = mp.y + 10;
      SR.roundRect(ctx, mp.x + 4, mp.y, mp.w - 8, 16, 9);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(mp.x + 24, cy + 2, 16, 0, Math.PI * 2);
      ctx.arc(cx, cy + 4, 21, 0, Math.PI * 2);
      ctx.arc(mp.x + mp.w - 24, cy + 2, 16, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = isHell ? '#ff9466' : '#ffe594';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(mp.x + 12, mp.y + 2);
      ctx.lineTo(mp.x + mp.w - 12, mp.y + 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawCheckpointsAndPickups(ctx, level, time, minVisX, maxVisX) {
    for (const cp of level.checkpoints) {
      if (cp.x < minVisX - 60 || cp.x > maxVisX + 60) continue;
      ctx.save();
      ctx.translate(cp.x, cp.y);
      const bob = Math.sin(time * 3) * 5;
      ctx.fillStyle = '#7c62b5';
      SR.roundRect(ctx, -18, -12, 36, 12, 5);
      ctx.fill();
      const col = cp.activated ? '#9cf5e3' : '#ffd2ef';
      ctx.shadowColor = col;
      ctx.shadowBlur = cp.activated ? 22 : 12;
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.moveTo(0, -64 + bob);
      ctx.lineTo(13, -42 + bob);
      ctx.lineTo(0, -20 + bob);
      ctx.lineTo(-13, -42 + bob);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      SR.drawStar(ctx, 0, -42 + bob, 4, 6, 2.2);
      ctx.fill();
      if (cp.activated) {
        ctx.font = '700 11px "Quicksand", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#b4ffef';
        ctx.fillText('CHECKPOINT ✦', 0, -74 + bob);
      }
      ctx.restore();
    }

    for (const pk of level.pickups) {
      if (pk.collected || pk.x < minVisX - 30 || pk.x > maxVisX + 30) continue;
      const y = pk.y + Math.sin(time * 3.5 + pk.bobPhase) * 5;
      ctx.save();
      ctx.translate(pk.x, y);
      if (pk.kind === 'heart') {
        ctx.shadowColor = '#ff86c0';
        ctx.shadowBlur = 14;
        ctx.fillStyle = '#ff88c2';
        ctx.beginPath();
        ctx.moveTo(0, 7);
        ctx.bezierCurveTo(-13, -3, -12, -14, 0, -6);
        ctx.bezierCurveTo(12, -14, 13, -3, 0, 7);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.65)';
        ctx.beginPath();
        ctx.arc(-4, -5, 2.3, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.rotate(Math.sin(time * 2.4 + pk.bobPhase) * 0.25);
        ctx.shadowColor = '#ffe694';
        ctx.shadowBlur = 12;
        ctx.fillStyle = '#ffe89a';
        SR.drawStar(ctx, 0, 0, 4, 11, 4.5);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        SR.drawStar(ctx, 0, 0, 4, 5, 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  function drawArenaBarriers(ctx, arena, time) {
    if (!arena || !arena.active || arena.defeated) return;
    [arena.minX, arena.maxX].forEach((bx) => {
      ctx.save();
      const grad = ctx.createLinearGradient(bx - 12, 0, bx + 12, 0);
      grad.addColorStop(0, 'rgba(255, 166, 224, 0)');
      grad.addColorStop(0.5, `rgba(255, 224, 150, ${0.4 + 0.2 * Math.sin(time * 5)})`);
      grad.addColorStop(1, 'rgba(255, 166, 224, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(bx - 12, 120, 24, 520);
      ctx.restore();
    });
  }

  // Full Square-ish RPG Fantasy Adventure Map (560x356 Cartography Chart!)
  function renderWorldMap(cvs, mapNodes, selectedMapIndex, hoveredMapIndex, t) {
    if (!cvs) return;
    const ctx = cvs.getContext('2d');
    const mw = cvs.width;
    const mh = cvs.height;

    // 1) Rich Nautical Fantasy Ocean with radial twilight vignette
    const ocean = ctx.createRadialGradient(mw * 0.45, mh * 0.45, 30, mw * 0.5, mh * 0.5, mw * 0.72);
    ocean.addColorStop(0, '#2a5696');
    ocean.addColorStop(0.55, '#1e3970');
    ocean.addColorStop(1, '#1a1a42');
    ctx.fillStyle = ocean;
    ctx.fillRect(0, 0, mw, mh);

    // Subtle vintage cartography lat/long gridlines
    ctx.strokeStyle = 'rgba(210, 238, 255, 0.08)';
    ctx.lineWidth = 1;
    for (let gx = 56; gx < mw; gx += 56) {
      ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, mh); ctx.stroke();
    }
    for (let gy = 56; gy < mh; gy += 56) {
      ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(mw, gy); ctx.stroke();
    }

    // Animated ocean wave crests
    ctx.strokeStyle = 'rgba(182, 238, 255, 0.22)';
    ctx.lineWidth = 1.5;
    for (let row = 0; row < 7; row++) {
      const y = 26 + row * 50;
      for (let col = 0; col < 6; col++) {
        const x = ((col * 105 + row * 42 + t * (6 + (row % 3) * 2)) % (mw + 50)) - 25;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.quadraticCurveTo(x + 9, y - 4, x + 18, y);
        ctx.quadraticCurveTo(x + 27, y - 4, x + 36, y);
        ctx.stroke();
      }
    }

    // Tiny cute wooden sailboat drifting in the southern sea!
    const boatX = 278 + Math.sin(t * 0.6) * 22;
    const boatY = 312 + Math.cos(t * 1.4) * 2.5;
    ctx.save();
    ctx.translate(boatX, boatY);
    ctx.fillStyle = '#8c5338';
    ctx.beginPath(); ctx.moveTo(-11, 0); ctx.lineTo(11, 0); ctx.lineTo(7, 5); ctx.lineTo(-7, 5); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#fff5e4';
    ctx.beginPath(); ctx.moveTo(0, -14); ctx.lineTo(9, -2); ctx.lineTo(0, -2); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ff9fd6';
    ctx.beginPath(); ctx.moveTo(-1, -11); ctx.lineTo(-8, -2); ctx.lineTo(-1, -2); ctx.closePath(); ctx.fill();
    ctx.restore();

    // 2) Main Sprawling 2D Fantasy Continent (Stages 1, 2, 3, 4) + Volcanic Isle (Stage 5)!
    const mainContinent = () => {
      ctx.beginPath();
      ctx.moveTo(56, 260);
      ctx.bezierCurveTo(34, 188, 68, 92, 134, 62);
      ctx.bezierCurveTo(192, 36, 260, 68, 326, 62);
      ctx.bezierCurveTo(392, 56, 466, 36, 502, 82);
      ctx.bezierCurveTo(526, 114, 514, 162, 460, 174);
      ctx.bezierCurveTo(405, 186, 378, 224, 344, 248);
      ctx.bezierCurveTo(298, 278, 232, 260, 182, 294);
      ctx.bezierCurveTo(128, 328, 72, 314, 56, 260);
      ctx.closePath();
    };

    const hellIsle = () => {
      ctx.beginPath();
      ctx.moveTo(392, 256);
      ctx.bezierCurveTo(400, 212, 464, 198, 508, 222);
      ctx.bezierCurveTo(540, 240, 536, 296, 496, 318);
      ctx.bezierCurveTo(452, 338, 384, 306, 392, 256);
      ctx.closePath();
    };

    // Shallow turquoise coastline glow & drop shadow
    ctx.save();
    ctx.fillStyle = 'rgba(138, 242, 232, 0.28)';
    ctx.save(); ctx.translate(0, 5); mainContinent(); ctx.fill(); ctx.restore();
    ctx.fillStyle = 'rgba(255, 115, 135, 0.34)';
    ctx.save(); ctx.translate(0, 4); hellIsle(); ctx.fill(); ctx.restore();

    // Multi-biome terrain fill across the main continent
    const landG = ctx.createLinearGradient(55, 310, 510, 55);
    landG.addColorStop(0.0, '#78dba8');  // Stage 1: Emerald Meadow (Bottom-Left)
    landG.addColorStop(0.32, '#82d0f5'); // Stage 2: Skyglass Peaks (Upper-Left)
    landG.addColorStop(0.62, '#8452b5'); // Stage 3: Velvet Dusk Woods (Center)
    landG.addColorStop(1.0, '#b5ebff');  // Stage 4: Frostmoon Glacier (Upper-Right)
    ctx.fillStyle = landG;
    mainContinent();
    ctx.fill();
    // Soft biome radial washes for rich organic cartography!
    ctx.save();
    mainContinent();
    ctx.clip();
    const s1Wash = ctx.createRadialGradient(118, 268, 12, 118, 268, 118);
    s1Wash.addColorStop(0, 'rgba(130, 240, 185, 0.92)');
    s1Wash.addColorStop(1, 'rgba(130, 240, 185, 0)');
    ctx.fillStyle = s1Wash; ctx.fillRect(0, 0, mw, mh);

    const s2Wash = ctx.createRadialGradient(160, 108, 12, 160, 108, 110);
    s2Wash.addColorStop(0, 'rgba(148, 225, 255, 0.92)');
    s2Wash.addColorStop(1, 'rgba(148, 225, 255, 0)');
    ctx.fillStyle = s2Wash; ctx.fillRect(0, 0, mw, mh);

    const s3Wash = ctx.createRadialGradient(294, 186, 12, 294, 186, 102);
    s3Wash.addColorStop(0, 'rgba(140, 74, 186, 0.88)');
    s3Wash.addColorStop(1, 'rgba(140, 74, 186, 0)');
    ctx.fillStyle = s3Wash; ctx.fillRect(0, 0, mw, mh);

    const s4Wash = ctx.createRadialGradient(434, 98, 12, 434, 98, 115);
    s4Wash.addColorStop(0, 'rgba(196, 244, 255, 0.95)');
    s4Wash.addColorStop(1, 'rgba(196, 244, 255, 0)');
    ctx.fillStyle = s4Wash; ctx.fillRect(0, 0, mw, mh);

    // Winding shimmering river cutting from Cloudspire down to Dusk Woods Bay!
    ctx.strokeStyle = 'rgba(168, 242, 255, 0.72)';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(192, 128);
    ctx.bezierCurveTo(234, 152, 222, 206, 260, 258);
    ctx.stroke();
    ctx.restore();

    // Continent crisp shoreline border
    ctx.strokeStyle = 'rgba(255, 246, 228, 0.72)';
    ctx.lineWidth = 2.4;
    mainContinent();
    ctx.stroke();

    // Volcanic Dream-Hell Isle (Bottom-Right!)
    const hellG = ctx.createRadialGradient(462, 262, 10, 462, 262, 76);
    hellG.addColorStop(0, '#8f1f48');
    hellG.addColorStop(0.65, '#591230');
    hellG.addColorStop(1, '#360a1e');
    ctx.fillStyle = hellG;
    hellIsle();
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 168, 130, 0.8)';
    ctx.lineWidth = 2.2;
    ctx.stroke();
    ctx.restore();

    // Ancient stone sea-bridge crossing the eastern strait right under the Stage 4 -> 5 trail!
    ctx.save();
    ctx.strokeStyle = 'rgba(20, 12, 36, 0.5)';
    ctx.lineWidth = 11;
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(454, 171); ctx.lineTo(462, 214); ctx.stroke();
    ctx.strokeStyle = '#ffd99e';
    ctx.lineWidth = 7;
    ctx.beginPath(); ctx.moveTo(454, 171); ctx.lineTo(462, 214); ctx.stroke();
    ctx.strokeStyle = '#6c496e';
    ctx.lineWidth = 4;
    ctx.setLineDash([3, 4]);
    ctx.beginPath(); ctx.moveTo(454, 171); ctx.lineTo(462, 214); ctx.stroke();
    ctx.restore();

    // 3) Detailed Handcrafted Map Landmarks for ALL 5 Realms!
    // Stage 1: Meadow Blossom Trees & Cozy Village Cottage (Bottom-Left)
    [[82, 244], [156, 280], [98, 286]].forEach(([tx, ty], k) => {
      ctx.fillStyle = '#6c4d7a'; ctx.fillRect(tx - 2, ty - 4, 4, 11);
      ctx.fillStyle = k === 1 ? '#ffc8e6' : '#ff9fd6';
      ctx.beginPath(); ctx.arc(tx, ty - 7, 9, 0, Math.PI * 2); ctx.fill();
    });
    // Tiny cute cottage
    ctx.fillStyle = '#fff5e4'; ctx.fillRect(142, 232, 16, 11);
    ctx.fillStyle = '#ff7ea8';
    ctx.beginPath(); ctx.moveTo(139, 233); ctx.lineTo(150, 223); ctx.lineTo(161, 233); ctx.closePath(); ctx.fill();

    // Stage 2: Cloudspire Alpine Peaks & Fluffy Clouds (Upper-Left)
    [[118, 128, 22, 34], [156, 116, 26, 44], [192, 126, 20, 32]].forEach(([mx, my, bw, bh]) => {
      ctx.fillStyle = '#4e79c4';
      ctx.beginPath(); ctx.moveTo(mx - bw, my); ctx.lineTo(mx, my - bh); ctx.lineTo(mx + bw, my); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#eefaff';
      ctx.beginPath(); ctx.moveTo(mx - bw * 0.35, my - bh * 0.65); ctx.lineTo(mx, my - bh); ctx.lineTo(mx + bw * 0.35, my - bh * 0.65); ctx.closePath(); ctx.fill();
    });
    ctx.fillStyle = 'rgba(255, 248, 255, 0.92)';
    ctx.beginPath();
    ctx.arc(124, 88, 9, 0, Math.PI * 2); ctx.arc(136, 84, 11, 0, Math.PI * 2); ctx.arc(148, 89, 8, 0, Math.PI * 2);
    ctx.fill();

    // Stage 3: Velvet Sakura Forest & Twilight Trading Spire (Center)
    [[258, 174], [326, 166], [336, 212]].forEach(([tx, ty], k) => {
      ctx.fillStyle = '#3b1c54'; ctx.fillRect(tx - 2, ty - 3, 4, 12);
      ctx.fillStyle = k % 2 === 0 ? '#d896ff' : '#ff9fd6';
      ctx.beginPath(); ctx.arc(tx, ty - 7, 10, 0, Math.PI * 2); ctx.fill();
    });
    ctx.fillStyle = '#9cf5e3';
    ctx.beginPath(); ctx.arc(272, 218, 4, Math.PI, 0); ctx.arc(318, 224, 4, Math.PI, 0); ctx.fill();

    // Stage 4: Frostmoon Glacial Peaks & Ice Citadel Castle (Upper-Right)
    [[392, 118, 18, 34], [486, 126, 18, 32]].forEach(([mx, my, bw, bh]) => {
      ctx.fillStyle = '#89c4f0';
      ctx.beginPath(); ctx.moveTo(mx - bw, my); ctx.lineTo(mx, my - bh); ctx.lineTo(mx + bw, my); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.moveTo(mx - bw * 0.4, my - bh * 0.6); ctx.lineTo(mx, my - bh); ctx.lineTo(mx + bw * 0.4, my - bh * 0.6); ctx.closePath(); ctx.fill();
    });
    // Crystalline castle towers standing proudly behind Stage 4
    ctx.fillStyle = '#dffaff';
    ctx.fillRect(444, 62, 24, 22);
    ctx.fillRect(439, 54, 7, 30);
    ctx.fillRect(466, 54, 7, 30);
    ctx.fillStyle = '#7de6ff';
    ctx.beginPath(); ctx.moveTo(437, 54); ctx.lineTo(442.5, 43); ctx.lineTo(448, 54); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(464, 54); ctx.lineTo(469.5, 43); ctx.lineTo(475, 54); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#5c8fd6';
    ctx.fillRect(453, 73, 6, 11);

    // Stage 5: Crimson Dream-Hell Volcano & Glowing Magma Crater (Offset right of Node 5!)
    ctx.fillStyle = '#290717';
    ctx.beginPath(); ctx.moveTo(460, 272); ctx.lineTo(482, 220); ctx.lineTo(500, 220); ctx.lineTo(520, 272); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ff7654';
    ctx.shadowColor = '#ff5e82'; ctx.shadowBlur = 14;
    ctx.beginPath(); ctx.ellipse(491, 221, 10, 4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#ff8b5c'; ctx.lineWidth = 2.2;
    ctx.beginPath(); ctx.moveTo(490, 224); ctx.quadraticCurveTo(484, 244, 478, 264); ctx.stroke();
    ctx.shadowBlur = 0;

    // 4) Winding Golden Adventure Path connecting 1 -> 2 -> 3 -> 4 -> 5!
    ctx.save();
    ctx.strokeStyle = 'rgba(34, 18, 58, 0.55)';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(mapNodes[0].x, mapNodes[0].y);
    for (let i = 1; i < mapNodes.length; i++) {
      const p = mapNodes[i - 1], c = mapNodes[i];
      let mx = (p.x + c.x) * 0.5 + (i % 2 === 0 ? 18 : -22);
      let my = (p.y + c.y) * 0.5 + (i % 2 === 0 ? -16 : 14);
      // Route segment 4 -> 5 smoothly straight across the stone sea-bridge!
      if (i === 4) { mx = 458; my = 188; }
      ctx.quadraticCurveTo(mx, my, c.x, c.y);
    }
    ctx.stroke();

    ctx.strokeStyle = '#ffe896';
    ctx.lineWidth = 3;
    ctx.setLineDash([7, 6]);
    ctx.lineDashOffset = -t * 15;
    ctx.stroke();
    ctx.restore();

    // Subtle antique inner cartography border
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 232, 165, 0.24)';
    ctx.lineWidth = 1;
    SR.roundRect(ctx, 7, 7, mw - 14, mh - 14, 10);
    ctx.stroke();
    ctx.restore();

    // 5) Ornate Golden Compass Rose (Top-Left Ocean Corner!)
    ctx.save();
    ctx.translate(42, 42);
    ctx.strokeStyle = 'rgba(255, 232, 165, 0.65)';
    ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.arc(0, 0, 20, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = 'rgba(255, 232, 165, 0.85)';
    SR.drawStar(ctx, 0, 0, 4, 16, 4); ctx.fill();
    ctx.fillStyle = '#ff9fd6';
    ctx.beginPath(); ctx.moveTo(0, -16); ctx.lineTo(3.5, 0); ctx.lineTo(-3.5, 0); ctx.closePath(); ctx.fill();
    ctx.font = '800 9px "Quicksand", sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffe896';
    ctx.fillText('N', 0, -25);
    ctx.restore();

    // Vintage Map Cartouche Ribbon (Bottom-Left!)
    ctx.save();
    ctx.fillStyle = 'rgba(20, 14, 46, 0.76)';
    ctx.strokeStyle = 'rgba(255, 228, 158, 0.55)';
    ctx.lineWidth = 1.4;
    SR.roundRect(ctx, 14, mh - 32, 178, 22, 11);
    ctx.fill(); ctx.stroke();
    ctx.font = '800 10.5px "Quicksand", "Microsoft JhengHei", sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffe896';
    ctx.fillText('🗺️ 夢光大陸冒險地圖 · ATLAS', 103, mh - 21);
    ctx.restore();

    // 6) Interactive Stage Nodes (1..5) with Crisp Labels & Animated Selection Beacon!
    for (const nd of mapNodes) {
      const m = SR.MAPS[nd.idx];
      const isSel = nd.idx === selectedMapIndex;
      const isHov = nd.idx === hoveredMapIndex;

      ctx.save();
      if (isSel) {
        const pulse = 21 + Math.sin(t * 5.5) * 4;
        ctx.strokeStyle = '#ffe58f';
        ctx.lineWidth = 2.6;
        ctx.shadowColor = '#ffe58f';
        ctx.shadowBlur = 16;
        ctx.beginPath(); ctx.arc(nd.x, nd.y, pulse, 0, Math.PI * 2); ctx.stroke();
        // Bouncing golden adventure marker pin above selected node!
        const pinY = nd.y - 26 + Math.sin(t * 6) * 3;
        ctx.fillStyle = '#ffe896';
        ctx.beginPath();
        ctx.moveTo(nd.x, pinY + 7); ctx.lineTo(nd.x - 6, pinY - 3); ctx.lineTo(nd.x + 6, pinY - 3);
        ctx.closePath(); ctx.fill();
      }

      ctx.fillStyle = isSel ? '#ffe896' : (isHov ? '#ffd2ef' : '#261a4a');
      ctx.strokeStyle = m.themeColor;
      ctx.lineWidth = isSel ? 3.5 : 2.5;
      ctx.beginPath(); ctx.arc(nd.x, nd.y, isSel ? 15.5 : 13.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

      ctx.font = '800 13.5px "Quicksand", sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = isSel || isHov ? '#241442' : '#ffffff';
      ctx.fillText(String(nd.idx + 1), nd.x, nd.y + 0.5);

      const labelY = nd.y + 26;
      ctx.font = '800 11px "Quicksand", "Microsoft JhengHei", sans-serif';
      const lbl = `${m.zh} ${m.stars.slice(0, m.difficulty)}`;
      const tw = ctx.measureText(lbl).width + 14;
      ctx.fillStyle = isSel ? 'rgba(34, 20, 66, 0.94)' : 'rgba(20, 12, 42, 0.82)';
      ctx.strokeStyle = isSel ? 'rgba(255, 229, 143, 0.85)' : 'rgba(255, 224, 248, 0.28)';
      ctx.lineWidth = 1.2;
      SR.roundRect(ctx, nd.x - tw * 0.5, labelY - 9.5, tw, 19, 9.5);
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = isSel ? '#ffe896' : '#fff5fc';
      ctx.fillText(lbl, nd.x, labelY);
      ctx.restore();
    }
  }

  SR.WorldRenderer = {
    drawBackground,
    drawProps,
    drawTerrain,
    drawCheckpointsAndPickups,
    drawArenaBarriers,
    renderWorldMap
  };
})(window.SR);
