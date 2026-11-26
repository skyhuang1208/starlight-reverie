// Dreamy particles, floating damage text, afterimages, and ambient fireflies/petals
window.SR = window.SR || {};

(function (SR) {
  class ParticleSystem {
    constructor() {
      this.particles = [];
      this.texts = [];
      this.ambient = [];
      this.afterimages = [];
      this.initAmbient();
    }

    initAmbient() {
      this.ambient = [];
      for (let i = 0; i < 42; i++) {
        this.ambient.push({
          x: Math.random() * 1200,
          y: Math.random() * 680,
          r: 1.8 + Math.random() * 3.2,
          vx: -10 - Math.random() * 20,
          vy: 8 + Math.random() * 18,
          phase: Math.random() * Math.PI * 2,
          kind: i % 3 === 0 ? 'petal' : 'firefly',
          color: ['#ffd1ec', '#ffe8a3', '#b3f7e8', '#d9c2ff'][i % 4]
        });
      }
    }

    clearCombat() {
      this.particles = [];
      this.texts = [];
      this.afterimages = [];
    }

    spawnBurst(x, y, color, count = 10, opts = {}) {
      // Soft particle cap keeps frame times rock-solid during heavy Ultimates & boss fights
      if (this.particles.length > 260) {
        this.particles.splice(0, Math.min(count, this.particles.length - 220));
      }
      const speedMin = opts.speedMin ?? 55;
      const speedMax = opts.speedMax ?? 210;
      const life = opts.life ?? 0.45;
      const size = opts.size ?? 4;
      const shape = opts.shape ?? 'circle';
      const gravity = opts.gravity ?? 120;
      for (let i = 0; i < count; i++) {
        const angle = opts.angle !== undefined
          ? opts.angle + (Math.random() - 0.5) * (opts.spread ?? 1.2)
          : Math.random() * Math.PI * 2;
        const spd = speedMin + Math.random() * (speedMax - speedMin);
        this.particles.push({
          x,
          y,
          vx: Math.cos(angle) * spd,
          vy: Math.sin(angle) * spd - (opts.upward ?? 25),
          size: size * (0.65 + Math.random() * 0.7),
          color: Array.isArray(color) ? color[i % color.length] : color,
          life: life * (0.7 + Math.random() * 0.5),
          maxLife: life,
          gravity,
          shape,
          rot: Math.random() * Math.PI * 2,
          vrot: (Math.random() - 0.5) * 8
        });
      }
    }

    spawnRing(x, y, color, maxRadius = 48, life = 0.3) {
      this.particles.push({
        x,
        y,
        vx: 0,
        vy: 0,
        size: 6,
        maxRadius,
        color,
        life,
        maxLife: life,
        gravity: 0,
        shape: 'ring'
      });
    }

    spawnSlashArc(x, y, facing, radius, color, combo = 1) {
      this.particles.push({
        x,
        y,
        vx: facing * 35,
        vy: 0,
        facing,
        radius,
        color,
        combo,
        life: 0.2,
        maxLife: 0.2,
        gravity: 0,
        shape: 'slash'
      });
    }

    spawnText(x, y, text, color = '#fff7d6', scale = 1) {
      this.texts.push({
        x: x + (Math.random() - 0.5) * 14,
        y,
        vy: -58,
        text: String(text),
        color,
        scale,
        life: 0.72,
        maxLife: 0.72
      });
    }

    spawnAfterimage(x, y, facing, charId, sliding) {
      this.afterimages.push({
        x,
        y,
        facing,
        charId,
        sliding,
        life: 0.22,
        maxLife: 0.22
      });
    }

    update(dt, cameraVx = 0) {
      for (let i = this.particles.length - 1; i >= 0; i--) {
        const p = this.particles[i];
        p.life -= dt;
        if (p.life <= 0) {
          this.particles.splice(i, 1);
          continue;
        }
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += p.gravity * dt;
        if (p.vrot) p.rot += p.vrot * dt;
      }

      for (let i = this.texts.length - 1; i >= 0; i--) {
        const t = this.texts[i];
        t.life -= dt;
        if (t.life <= 0) {
          this.texts.splice(i, 1);
          continue;
        }
        t.y += t.vy * dt;
        t.vy *= 0.94;
      }

      for (let i = this.afterimages.length - 1; i >= 0; i--) {
        this.afterimages[i].life -= dt;
        if (this.afterimages[i].life <= 0) {
          this.afterimages.splice(i, 1);
        }
      }

      for (const a of this.ambient) {
        a.phase += dt * 1.8;
        a.x += (a.vx - cameraVx * 0.15) * dt + Math.sin(a.phase) * 8 * dt;
        a.y += a.vy * dt + Math.cos(a.phase * 0.8) * 6 * dt;
        if (a.x < -20) a.x = 1220;
        if (a.x > 1220) a.x = -20;
        if (a.y > 700) a.y = -15;
        if (a.y < -20) a.y = 695;
      }
    }

    drawAmbient(ctx) {
      for (const a of this.ambient) {
        const alpha = 0.35 + 0.35 * Math.sin(a.phase * 1.6);
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = a.color;
        if (a.kind === 'petal') {
          ctx.translate(a.x, a.y);
          ctx.rotate(a.phase * 0.6);
          ctx.beginPath();
          ctx.ellipse(0, 0, a.r * 1.6, a.r * 0.85, 0, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.shadowColor = a.color;
          ctx.shadowBlur = 10;
          ctx.beginPath();
          ctx.arc(a.x, a.y, a.r, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }
    }

    drawWorld(ctx) {
      for (const p of this.particles) {
        const t = Math.max(0, p.life / p.maxLife);
        ctx.save();
        ctx.globalAlpha = t;

        if (p.shape === 'ring') {
          const r = p.size + (1 - t) * p.maxRadius;
          ctx.strokeStyle = p.color;
          ctx.lineWidth = 3 * t + 1;
          ctx.shadowColor = p.color;
          ctx.shadowBlur = 12;
          ctx.beginPath();
          ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
          ctx.stroke();
        } else if (p.shape === 'slash') {
          ctx.translate(p.x, p.y);
          ctx.scale(p.facing, 1);
          const startA = p.combo === 2 ? 0.9 : -1.15;
          const endA = p.combo === 2 ? -1.15 : 1.05;
          ctx.strokeStyle = p.color;
          ctx.lineWidth = (10 + p.combo * 3) * t;
          ctx.lineCap = 'round';
          ctx.shadowColor = p.color;
          ctx.shadowBlur = 16;
          ctx.beginPath();
          ctx.arc(0, 0, p.radius, Math.min(startA, endA), Math.max(startA, endA));
          ctx.stroke();
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 4 * t;
          ctx.beginPath();
          ctx.arc(0, 0, p.radius * 0.92, Math.min(startA, endA) + 0.15, Math.max(startA, endA) - 0.15);
          ctx.stroke();
        } else if (p.shape === 'star') {
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot);
          ctx.fillStyle = p.color;
          ctx.shadowColor = p.color;
          ctx.shadowBlur = 8;
          drawStar(ctx, 0, 0, 4, p.size * 1.4, p.size * 0.5);
          ctx.fill();
        } else {
          ctx.fillStyle = p.color;
          ctx.shadowColor = p.color;
          ctx.shadowBlur = 6;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * t + 0.8, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }

      for (const tx of this.texts) {
        const t = Math.max(0, tx.life / tx.maxLife);
        ctx.save();
        ctx.globalAlpha = Math.min(1, t * 1.6);
        ctx.font = `800 ${Math.round(17 * tx.scale)}px "Quicksand", "Segoe UI", sans-serif`;
        ctx.textAlign = 'center';
        ctx.lineWidth = 3.5;
        ctx.strokeStyle = 'rgba(28, 16, 56, 0.85)';
        ctx.strokeText(tx.text, tx.x, tx.y);
        ctx.fillStyle = tx.color;
        ctx.fillText(tx.text, tx.x, tx.y);
        ctx.restore();
      }
    }
  }

  function drawStar(ctx, cx, cy, spikes, outerR, innerR) {
    let rot = (Math.PI / 2) * 3;
    const step = Math.PI / spikes;
    ctx.beginPath();
    ctx.moveTo(cx, cy - outerR);
    for (let i = 0; i < spikes; i++) {
      ctx.lineTo(cx + Math.cos(rot) * outerR, cy + Math.sin(rot) * outerR);
      rot += step;
      ctx.lineTo(cx + Math.cos(rot) * innerR, cy + Math.sin(rot) * innerR);
      rot += step;
    }
    ctx.closePath();
  }

  SR.drawStar = drawStar;
  SR.particles = new ParticleSystem();
})(window.SR);
