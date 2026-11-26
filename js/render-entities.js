// Entity & Combat Renderer: Playable Heroes, Combat Auras, Enemies, 小頭目, Bosses, Projectiles & Frame Pipeline
window.SR = window.SR || {};

(function (SR) {
  function drawCharacterSprite(ctx, charId, opts) {
    const {
      x = 0, y = 0, facing = 1, sliding = false,
      runTime = 0, attackAnim = 0, squashX = 1, squashY = 1,
      time = 0, ribbon = null, alpha = 1, flash = false, scale = 1,
      airSlicing = false, aimUp = false
    } = opts;

    const palette = charId === 'blade'
      ? { hair: '#8be2ff', dress: '#4b6ec9', trim: '#ffe694', ribbon: '#ff9fd6', weapon: '#a4f3ff' }
      : charId === 'gun'
        ? { hair: '#ffb794', dress: '#e877a8', trim: '#ffe694', ribbon: '#9cf5e3', weapon: '#ffe394' }
        : { hair: '#cda6ff', dress: '#6a46b0', trim: '#9cf5e3', ribbon: '#ffe494', weapon: '#e6c8ff' };

    ctx.save();
    ctx.globalAlpha = alpha;

    if (ribbon && ribbon.length > 1) {
      ctx.save();
      ctx.strokeStyle = palette.ribbon;
      ctx.lineWidth = 6;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(ribbon[0].x, ribbon[0].y);
      for (let i = 1; i < ribbon.length; i++) ctx.lineTo(ribbon[i].x, ribbon[i].y);
      ctx.stroke();
      ctx.restore();
    }

    ctx.translate(x, y);
    ctx.scale(facing * squashX * scale, squashY * scale);
    if (sliding) {
      ctx.rotate(-0.42);
      ctx.translate(0, 4);
    } else if (airSlicing) {
      ctx.rotate(0.28);
    }

    const bob = sliding || airSlicing ? 0 : Math.abs(Math.sin(runTime)) * -3.5 + Math.sin(time * 3.5) * 1.2;
    const legSwing = sliding || airSlicing ? 0 : Math.sin(runTime) * 6;

    if (!ribbon || (!sliding && !airSlicing)) {
      ctx.fillStyle = 'rgba(24, 12, 48, 0.28)';
      ctx.beginPath();
      ctx.ellipse(0, 0, 14, 4, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Boots
    ctx.fillStyle = flash ? '#ffffff' : '#3a2b5e';
    if (sliding) {
      SR.roundRect(ctx, 2, -9, 14, 7, 3); ctx.fill();
      SR.roundRect(ctx, -12, -8, 12, 6, 3); ctx.fill();
    } else {
      SR.roundRect(ctx, -7 + legSwing * 0.5, -11, 6, 11, 3); ctx.fill();
      SR.roundRect(ctx, 1 - legSwing * 0.5, -11, 6, 11, 3); ctx.fill();
    }

    // Dress
    ctx.fillStyle = flash ? '#ffffff' : palette.dress;
    ctx.beginPath();
    ctx.moveTo(-11, -8 + bob);
    ctx.lineTo(-8, -26 + bob);
    ctx.lineTo(8, -26 + bob);
    ctx.lineTo(12, -8 + bob);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = flash ? '#ffffff' : palette.trim;
    ctx.fillRect(-10, -11 + bob, 20, 3);
    SR.drawStar(ctx, 2, -20 + bob, 4, 4.5, 2);
    ctx.fill();

    // Head
    ctx.fillStyle = flash ? '#ffffff' : '#fff0ea';
    ctx.beginPath();
    ctx.arc(0, -34 + bob, 13.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = flash ? '#ffffff' : palette.hair;
    ctx.beginPath();
    ctx.arc(-2, -36 + bob, 14.2, Math.PI * 0.78, Math.PI * 2.08);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(-11, -30 + bob, 4.5, 9, 0.25, 0, Math.PI * 2);
    ctx.fill();

    if (!flash) {
      const blinking = Math.sin(time * 1.7) > 0.96;
      ctx.fillStyle = '#2d1e4a';
      if (blinking) {
        ctx.fillRect(2, -34 + bob, 4.5, 1.5);
        ctx.fillRect(8.5, -34 + bob, 3.5, 1.5);
      } else {
        ctx.beginPath();
        ctx.ellipse(4.5, -33.5 + bob, 2.1, 2.8, 0, 0, Math.PI * 2);
        ctx.ellipse(10.2, -33.5 + bob, 1.8, 2.6, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(5.1, -34.5 + bob, 0.9, 0, Math.PI * 2);
        ctx.arc(10.7, -34.5 + bob, 0.8, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = 'rgba(255, 138, 186, 0.55)';
      ctx.beginPath();
      ctx.ellipse(1.5, -30 + bob, 2.6, 1.4, 0, 0, Math.PI * 2);
      ctx.ellipse(11.5, -30 + bob, 2.2, 1.3, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Weapons & Headwear
    if (charId === 'blade') {
      ctx.fillStyle = palette.ribbon;
      ctx.beginPath();
      ctx.ellipse(-10, -45 + bob, 6, 4, -0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffe896';
      SR.drawStar(ctx, -4, -45 + bob, 4, 5.5, 2.2);
      ctx.fill();

      ctx.save();
      const swingAngle = airSlicing
        ? 0.24
        : (attackAnim > 0 ? 1.25 - attackAnim * 7.8 : -0.32 + Math.sin(time * 4) * 0.08);
      ctx.translate(8, -19 + bob);
      ctx.rotate(swingAngle);
      ctx.shadowColor = '#8be4ff';
      ctx.shadowBlur = 18;
      ctx.fillStyle = '#ffe58f';
      SR.roundRect(ctx, -4, -10, 9, 20, 3);
      ctx.fill();
      SR.drawStar(ctx, 1, 0, 4, 6, 2.5);
      ctx.fill();
      const bg = ctx.createLinearGradient(5, 0, 62, 0);
      bg.addColorStop(0, '#8ceaff');
      bg.addColorStop(0.55, '#d8fbff');
      bg.addColorStop(1, '#ffe896');
      ctx.fillStyle = bg;
      ctx.beginPath();
      ctx.moveTo(5, -7.5);
      ctx.lineTo(48, -6);
      ctx.lineTo(64, 0);
      ctx.lineTo(48, 7.5);
      ctx.lineTo(5, 8.5);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(9, 0);
      ctx.lineTo(56, 0);
      ctx.stroke();
      ctx.restore();
    } else if (charId === 'gun') {
      ctx.fillStyle = '#ff8ec6';
      ctx.beginPath();
      ctx.ellipse(-1, -46 + bob, 14, 6.5, -0.15, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(-12, -45 + bob);
      ctx.quadraticCurveTo(-22, -54 + bob, -15, -39 + bob);
      ctx.fill();

      ctx.save();
      const recoil = attackAnim > 0 ? -4 : 0;
      if (aimUp) {
        ctx.translate(4, -30 + bob - recoil * 0.6);
        ctx.rotate(-Math.PI * 0.5);
      } else {
        ctx.translate(10 + recoil, -19 + bob);
      }
      ctx.shadowColor = '#ffe58f';
      ctx.shadowBlur = 12;
      ctx.fillStyle = '#ff96c8';
      SR.roundRect(ctx, -2, -5.5, 22, 11, 4);
      ctx.fill();
      ctx.fillStyle = '#ffe999';
      SR.roundRect(ctx, 16, -4.5, 9, 9, 3);
      ctx.fill();
      ctx.fillStyle = '#9cf5e3';
      ctx.beginPath();
      ctx.arc(9, 0, 3.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    } else if (charId === 'magic') {
      ctx.fillStyle = '#5c3c9e';
      ctx.beginPath();
      ctx.ellipse(0, -44 + bob, 19, 5.5, -0.1, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-12, -45 + bob);
      ctx.quadraticCurveTo(-5, -72 + bob, 6, -63 + bob);
      ctx.lineTo(12, -44 + bob);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#ffe594';
      SR.drawStar(ctx, 8, -56 + bob, 4, 4.5, 1.8);
      ctx.fill();

      ctx.save();
      const floatY = Math.sin(time * 4.5) * 3;
      const castTilt = attackAnim > 0 ? 0.45 : 0.12;
      ctx.translate(13, -21 + bob + floatY);
      ctx.rotate(castTilt);
      ctx.strokeStyle = '#ffe694';
      ctx.lineWidth = 3.2;
      ctx.beginPath();
      ctx.moveTo(0, 12);
      ctx.lineTo(0, -16);
      ctx.stroke();
      ctx.shadowColor = '#d7b0ff';
      ctx.shadowBlur = 14;
      ctx.fillStyle = '#9cf5e3';
      SR.drawStar(ctx, 0, -20, 4, 8, 3.2);
      ctx.fill();
      ctx.restore();
    }

    ctx.restore();
  }

  function drawPlayerCombatAuras(ctx, p, time) {
    if (p.airSlicing) {
      ctx.save();
      ctx.translate(p.cx, p.cy);
      ctx.scale(p.facing, 1);
      ctx.rotate(0.52);
      ctx.shadowColor = '#8be4ff';
      ctx.shadowBlur = 24;
      const grad = ctx.createLinearGradient(-45, 0, 148, 0);
      grad.addColorStop(0, 'rgba(139, 228, 255, 0)');
      grad.addColorStop(0.35, 'rgba(140, 234, 255, 0.62)');
      grad.addColorStop(0.75, 'rgba(255, 232, 148, 0.92)');
      grad.addColorStop(1, 'rgba(255, 255, 255, 0.98)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(-45, -24); ctx.lineTo(105, -34); ctx.lineTo(152, 0); ctx.lineTo(105, 34); ctx.lineTo(-45, 24);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#fff5b8';
      ctx.lineWidth = 6;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(38, 0, 96, -0.78, 0.78);
      ctx.stroke();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-10, 0); ctx.lineTo(142, 0);
      ctx.stroke();
      ctx.restore();
    }

    if (p.cycloneTimer > 0) {
      ctx.save();
      ctx.translate(p.cx, p.cy);
      const rad = 152;
      ctx.globalAlpha = Math.min(1, p.cycloneTimer / 0.25);
      ctx.strokeStyle = 'rgba(140, 234, 255, 0.65)';
      ctx.lineWidth = 14;
      ctx.shadowColor = '#8ceaff';
      ctx.shadowBlur = 22;
      ctx.beginPath();
      ctx.arc(0, 0, rad * 0.88, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255, 232, 148, 0.85)';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(0, 0, rad * 0.96, p.cycloneAngle, p.cycloneAngle + Math.PI * 1.5);
      ctx.stroke();
      for (let i = 0; i < 4; i++) {
        ctx.save();
        ctx.rotate(p.cycloneAngle + (Math.PI * 0.5) * i);
        const bg = ctx.createLinearGradient(28, 0, rad, 0);
        bg.addColorStop(0, '#ff9fd6');
        bg.addColorStop(0.45, '#8ceaff');
        bg.addColorStop(1, '#fff3b0');
        ctx.fillStyle = bg;
        ctx.beginPath();
        ctx.moveTo(30, -9); ctx.lineTo(rad - 24, -12); ctx.lineTo(rad + 4, 0); ctx.lineTo(rad - 24, 12); ctx.lineTo(30, 9);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(36, -2, rad - 56, 4);
        ctx.restore();
      }
      ctx.restore();
    }

    if (p.slowTimer > 0) {
      ctx.save();
      ctx.strokeStyle = 'rgba(128, 224, 255, 0.85)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.ellipse(p.cx, p.y + p.h, 20 + Math.sin(time * 9) * 3, 5.5, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.font = '800 11px "Quicksand", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#a6eeff';
      ctx.fillText('💧 SLOW', p.cx, p.y - 12);
      ctx.restore();
    }
  }

  function drawCatJunkItem(ctx, itemType) {
    if (itemType === 'keyboard') {
      ctx.fillStyle = '#e8ecf8';
      SR.roundRect(ctx, -18, -7, 36, 14, 3); ctx.fill();
      ctx.strokeStyle = '#586285'; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.fillStyle = '#6c7ba8';
      for (let kx = -14; kx <= 10; kx += 6) {
        ctx.fillRect(kx, -4, 4, 3);
        ctx.fillRect(kx, 1, 4, 3);
      }
    } else if (itemType === 'beer') {
      ctx.fillStyle = '#ffbe4f';
      SR.roundRect(ctx, -7, -8, 14, 17, 3); ctx.fill();
      ctx.strokeStyle = '#fff5d6'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(8, 0, 4.5, -Math.PI * 0.5, Math.PI * 0.5); ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(-4, -9, 4.5, 0, Math.PI * 2); ctx.arc(1, -10, 5, 0, Math.PI * 2); ctx.arc(5, -8, 4, 0, Math.PI * 2); ctx.fill();
    } else if (itemType === 'cup') {
      ctx.fillStyle = '#ff9fd6';
      SR.roundRect(ctx, -7, -7, 14, 15, 3); ctx.fill();
      ctx.strokeStyle = '#ff9fd6'; ctx.lineWidth = 2.2;
      ctx.beginPath(); ctx.arc(8, 0, 4, -Math.PI * 0.5, Math.PI * 0.5); ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-5, -5, 10, 3);
    } else if (itemType === 'plant') {
      ctx.fillStyle = '#d97b59';
      ctx.beginPath(); ctx.moveTo(-7, 0); ctx.lineTo(7, 0); ctx.lineTo(5, 10); ctx.lineTo(-5, 10); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#7de8a8';
      ctx.beginPath(); ctx.ellipse(-4, -4, 4, 6, -0.4, 0, Math.PI * 2); ctx.ellipse(4, -4, 4, 6, 0.4, 0, Math.PI * 2); ctx.ellipse(0, -6, 3.5, 6, 0, 0, Math.PI * 2); ctx.fill();
    } else if (itemType === 'mouse') {
      ctx.fillStyle = '#f0f4ff';
      ctx.beginPath(); ctx.ellipse(0, 0, 7, 10, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#707ba8'; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.fillStyle = '#ff85b4'; ctx.fillRect(-1.5, -6, 3, 4);
    } else if (itemType === 'slipper') {
      ctx.fillStyle = '#ff9fd6';
      ctx.beginPath(); ctx.ellipse(0, 0, 12, 6, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffe58f';
      SR.roundRect(ctx, -4, -5, 10, 10, 4); ctx.fill();
    } else if (itemType === 'clock') {
      ctx.fillStyle = '#9cf5e3';
      ctx.beginPath(); ctx.arc(0, 0, 9, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(0, 0, 6.5, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#2d1c4a'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -4.5); ctx.moveTo(0, 0); ctx.lineTo(3.5, 1); ctx.stroke();
    } else {
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(-12, 0); ctx.lineTo(10, 0); ctx.stroke();
      for (let fx = -6; fx <= 4; fx += 5) {
        ctx.beginPath(); ctx.moveTo(fx, -5); ctx.lineTo(fx, 5); ctx.stroke();
      }
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(10, 0, 4, 0, Math.PI * 2); ctx.fill();
    }
  }

  // Taiwanese Delivery Feast & Mika's Wok Cooking Dishes!
  function drawDeliveryFood(ctx, foodType, time) {
    if (foodType === 'chicken_cutlet') {
      // 雞排 (Big crispy golden fried chicken cutlet in paper sleeve!)
      ctx.fillStyle = '#d98a3b';
      ctx.beginPath();
      ctx.ellipse(0, -2, 13, 10, -0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#f5c26b'; ctx.lineWidth = 2; ctx.stroke();
      // White paper snack bag bottom
      ctx.fillStyle = '#fff5e4';
      SR.roundRect(ctx, -10, 1, 20, 11, 2); ctx.fill();
      ctx.fillStyle = '#ff6b78';
      ctx.fillRect(-10, 4, 20, 2.5);
    } else if (foodType === 'meatball_skewer') {
      // 肉丸子串 (3 juicy glazed meatballs on bamboo skewer!)
      ctx.strokeStyle = '#f2d49b'; ctx.lineWidth = 2.4;
      ctx.beginPath(); ctx.moveTo(-16, 0); ctx.lineTo(16, 0); ctx.stroke();
      [-7, 0, 7].forEach((mx) => {
        ctx.fillStyle = '#a64d36';
        ctx.beginPath(); ctx.arc(mx, 0, 4.8, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(255, 225, 175, 0.55)';
        ctx.beginPath(); ctx.arc(mx - 1.5, -1.5, 1.5, 0, Math.PI * 2); ctx.fill();
      });
    } else if (foodType === 'stinky_tofu') {
      // 臭豆腐 (Crispy golden cubes + pickled cabbage + green stink squiggles!)
      ctx.fillStyle = '#fff5e4';
      SR.roundRect(ctx, -12, -3, 24, 12, 3); ctx.fill();
      ctx.fillStyle = '#e8aa4d';
      SR.roundRect(ctx, -10, -8, 9, 9, 2); ctx.fill();
      SR.roundRect(ctx, 1, -8, 9, 9, 2); ctx.fill();
      ctx.fillStyle = '#7ef2a4'; // pickled veggies
      ctx.beginPath(); ctx.arc(0, -7, 3.2, 0, Math.PI * 2); ctx.fill();
      // Cute green aroma waves!
      ctx.strokeStyle = '#9eff8a'; ctx.lineWidth = 1.6;
      [-5, 5].forEach((sx) => {
        ctx.beginPath();
        ctx.moveTo(sx, -11);
        ctx.quadraticCurveTo(sx + Math.sin(time * 12) * 3, -16, sx, -20);
        ctx.stroke();
      });
    } else if (foodType === 'fried_noodles') {
      // 炒麵 (Takeout bowl overflowing with wavy golden noodles!)
      ctx.fillStyle = '#ff8598';
      ctx.beginPath(); ctx.moveTo(-12, 0); ctx.lineTo(12, 0); ctx.lineTo(9, 10); ctx.lineTo(-9, 10); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#ffd56b'; ctx.lineWidth = 2.4;
      for (let ny = -6; ny <= 0; ny += 3) {
        ctx.beginPath(); ctx.moveTo(-10, ny); ctx.quadraticCurveTo(-3, ny - 4, 3, ny); ctx.quadraticCurveTo(8, ny + 3, 10, ny - 1); ctx.stroke();
      }
      ctx.fillStyle = '#6fe89a'; ctx.fillRect(-3, -7, 5, 2.5);
    } else if (foodType === 'fried_rice') {
      // 炒飯 (Mound of steaming golden egg fried rice with scallions & shrimp!)
      ctx.fillStyle = '#fff5fb';
      ctx.beginPath(); ctx.arc(0, 2, 12, 0, Math.PI); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#ffe07d';
      ctx.beginPath(); ctx.arc(0, 2, 11, Math.PI, 0); ctx.closePath(); ctx.fill();
      // Scallion & egg specks
      ctx.fillStyle = '#68de8c'; ctx.fillRect(-5, -4, 3, 2); ctx.fillRect(3, -3, 3, 2);
      ctx.fillStyle = '#ff8870'; ctx.beginPath(); ctx.arc(0, -6, 3, 0, Math.PI * 2); ctx.fill();
    } else if (foodType === 'fried_egg') {
      // 煎蛋 (Sunny-side-up egg!)
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.ellipse(0, 0, 12, 9, 0.2, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffbe3b';
      ctx.beginPath(); ctx.arc(1, 0, 5, 0, Math.PI * 2); ctx.fill();
    } else if (foodType === 'shrimp') {
      // 蝦仁 (Cute pink curled shrimp!)
      ctx.strokeStyle = '#ff8a7a'; ctx.lineWidth = 6.5; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.arc(0, 0, 7, -0.5, Math.PI * 1.1); ctx.stroke();
      ctx.fillStyle = '#ff5959'; ctx.beginPath(); ctx.arc(7, -3, 3, 0, Math.PI * 2); ctx.fill();
    } else if (foodType === 'hotpot_pot') {
      // 麻辣鴛鴦火鍋 (Steaming bubbling Yin-Yang Hotpot!)
      ctx.fillStyle = '#3d2c42';
      ctx.beginPath(); ctx.arc(0, 1, 13, 0, Math.PI); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#5c4966'; ctx.fillRect(-15, -2, 30, 4); // pot handles/rim
      // Split Yin-Yang Broth (spicy red + creamy white!)
      ctx.fillStyle = '#ff595e';
      ctx.beginPath(); ctx.ellipse(-5, -2, 6.5, 4.5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff3d6';
      ctx.beginPath(); ctx.ellipse(5, -2, 6.5, 4.5, 0, 0, Math.PI * 2); ctx.fill();
      // Rising steam wisps
      ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = 1.6;
      [-4, 4].forEach((sx) => {
        ctx.beginPath(); ctx.moveTo(sx, -8); ctx.quadraticCurveTo(sx + Math.sin(time * 12) * 3, -13, sx, -17); ctx.stroke();
      });
    } else if (foodType === 'meat_slice') {
      // 涮肉片 (Marbled rolled hotpot beef slice!)
      ctx.fillStyle = '#e85d6f';
      SR.roundRect(ctx, -11, -7, 22, 14, 6); ctx.fill();
      ctx.strokeStyle = '#ffeef0'; ctx.lineWidth = 2.2;
      ctx.beginPath(); ctx.moveTo(-7, -3); ctx.quadraticCurveTo(0, 2, 7, -3); ctx.moveTo(-6, 3); ctx.quadraticCurveTo(0, 6, 6, 2); ctx.stroke();
    } else if (foodType === 'fishball') {
      // 魚板 / 貢丸 (Cute pink-swirl Narutomaki fishcake!)
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#ff85b4'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, 0, 5.5, 0, Math.PI * 1.65); ctx.stroke();
      ctx.strokeStyle = '#ff9fd6'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI * 2); ctx.stroke();
    } else if (foodType === 'tofu_cube') {
      // 嫩豆腐 (Soft creamy tofu block with green scallion!)
      ctx.fillStyle = '#fffaf0';
      SR.roundRect(ctx, -9, -8, 18, 16, 3); ctx.fill();
      ctx.strokeStyle = '#e8dcc5'; ctx.lineWidth = 1.6; ctx.stroke();
      ctx.fillStyle = '#6fe89a'; ctx.fillRect(-3, -4, 6, 3);
    } else if (foodType === 'enoki') {
      // 金針菇 (Bundle of cute enoki mushrooms!)
      ctx.strokeStyle = '#fff5e4'; ctx.lineWidth = 2.4; ctx.lineCap = 'round';
      [-5, 0, 5].forEach((ex) => {
        ctx.beginPath(); ctx.moveTo(ex * 0.6, 9); ctx.lineTo(ex, -5); ctx.stroke();
        ctx.fillStyle = '#fff0cc'; ctx.beginPath(); ctx.arc(ex, -7, 3.2, 0, Math.PI * 2); ctx.fill();
      });
    } else if (foodType === 'cabbage') {
      // 高麗菜 (Grandma's fresh market cabbage!)
      ctx.fillStyle = '#7de8a8';
      ctx.beginPath(); ctx.arc(0, 0, 11, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#e2fff0'; ctx.lineWidth = 1.8;
      ctx.beginPath(); ctx.arc(-2, -1, 6, 0.2, Math.PI * 1.3); ctx.stroke();
    } else if (foodType === 'tangerine') {
      // 橘子 (Grandma's lucky orange tangerine!)
      ctx.fillStyle = '#ff9c42';
      ctx.beginPath(); ctx.arc(0, 1, 10, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#6fe88a';
      ctx.beginPath(); ctx.ellipse(3, -9, 4.5, 2.5, -0.4, 0, Math.PI * 2); ctx.fill();
    } else if (foodType === 'red_envelope') {
      // 紅包 (Lucky red envelope from Grandma!)
      ctx.fillStyle = '#f0435a';
      SR.roundRect(ctx, -8, -11, 16, 22, 3); ctx.fill();
      ctx.strokeStyle = '#ffe58f'; ctx.lineWidth = 1.8; ctx.stroke();
      ctx.fillStyle = '#ffe58f'; ctx.beginPath(); ctx.arc(0, -1, 3.8, 0, Math.PI * 2); ctx.fill();
    } else if (foodType === 'dumpling') {
      // 肉包 (Fluffy steamed bun!)
      ctx.fillStyle = '#fff9ee';
      ctx.beginPath(); ctx.arc(0, 2, 11, Math.PI, 0); ctx.lineTo(11, 7); ctx.lineTo(-11, 7); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#e0d2ba'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(-4, -7); ctx.lineTo(0, -4); ctx.lineTo(4, -7); ctx.stroke();
    } else {
      // 珍奶 (Boba Tea Cup!)
      ctx.fillStyle = '#f5cfa0'; SR.roundRect(ctx, -8, -9, 16, 18, 4); ctx.fill();
      ctx.fillStyle = '#ffffff'; ctx.fillRect(-9, -11, 18, 4);
      ctx.fillStyle = '#ff7eb6'; ctx.fillRect(1, -18, 3, 9);
      ctx.fillStyle = '#2d1c14';
      ctx.beginPath(); ctx.arc(-3, 4, 2, 0, Math.PI * 2); ctx.arc(3, 5, 2, 0, Math.PI * 2); ctx.fill();
    }
  }

  function drawGroundShadow(ctx, rx) {
    ctx.fillStyle = 'rgba(20, 10, 42, 0.28)';
    ctx.beginPath();
    ctx.ellipse(0, 0, rx, 4.2, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Clean Enemy & Boss Sprite Dispatch Table
  const ENEMY_RENDERERS = {
    slime(ctx, e, flash) {
      const squash = e.state === 'windup' ? 1.32 : 1 + Math.sin(e.animTime * 5) * 0.08;
      const stretch = e.state === 'windup' ? 0.68 : 1 - Math.sin(e.animTime * 5) * 0.06;
      ctx.translate(e.cx, e.y + e.h);
      drawGroundShadow(ctx, 16);
      ctx.scale(squash, stretch);
      ctx.fillStyle = flash ? '#ffffff' : (e.hellStyle ? '#ff6b8b' : '#ff9bd2');
      ctx.beginPath(); ctx.arc(0, -14, 19, Math.PI, 0); ctx.lineTo(19, 0); ctx.lineTo(-19, 0); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.beginPath(); ctx.ellipse(-7, -21, 5, 3, -0.4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = e.hellStyle ? '#ffe88a' : '#331c4a';
      ctx.beginPath(); ctx.arc(e.facing * 5 - 4, -12, 2.4, 0, Math.PI * 2); ctx.arc(e.facing * 5 + 4, -12, 2.4, 0, Math.PI * 2); ctx.fill();
      if (e.state === 'windup') {
        ctx.font = '800 16px sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#ffe58f'; ctx.fillText('!', 0, -36);
      }
    },

    knight(ctx, e, flash) {
      ctx.translate(e.cx, e.y + e.h);
      drawGroundShadow(ctx, 16);
      ctx.scale(e.facing, 1);
      const bob = Math.abs(Math.sin(e.animTime * 7)) * -2.5;
      ctx.fillStyle = flash ? '#ffffff' : (e.hellStyle ? '#5c1f3d' : '#6d5db8');
      SR.roundRect(ctx, -14, -34 + bob, 28, 30, 10); ctx.fill();
      ctx.fillStyle = flash ? '#ffffff' : (e.hellStyle ? '#ff99b8' : '#b7c7ff');
      ctx.beginPath(); ctx.arc(0, -34 + bob, 14, Math.PI, 0); ctx.fill();
      ctx.fillStyle = e.hellStyle ? '#ffcf70' : '#ff9fd6';
      ctx.beginPath(); ctx.ellipse(-6, -48 + bob, 9, 4.5, -0.4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#24153d';
      SR.roundRect(ctx, -4, -32 + bob, 14, 7, 3); ctx.fill();
      ctx.fillStyle = e.state === 'charge' || e.state === 'windup' ? '#ffe58f' : '#9cf5e3';
      ctx.fillRect(0, -30 + bob, 3, 3); ctx.fillRect(6, -30 + bob, 3, 3);
      if (e.shielded) {
        ctx.shadowColor = e.hellStyle ? '#ff8ca8' : '#9eeeff'; ctx.shadowBlur = 10;
        ctx.fillStyle = e.hellStyle ? 'rgba(255, 138, 168, 0.88)' : 'rgba(164, 240, 255, 0.85)';
        SR.roundRect(ctx, 11, -34 + bob, 10, 28, 5); ctx.fill();
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.stroke();
      }
      if (e.state === 'windup') {
        ctx.scale(e.facing, 1);
        ctx.font = '800 18px sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#ffe58f'; ctx.fillText('!', 0, -56);
      }
    },

    wisp(ctx, e, flash) {
      ctx.translate(e.cx, e.cy);
      const flap = Math.sin(e.animTime * 11) * 0.35;
      ctx.fillStyle = flash ? '#ffffff' : (e.hellStyle ? 'rgba(255, 130, 175, 0.78)' : 'rgba(218, 178, 255, 0.78)');
      ctx.save(); ctx.rotate(-0.4 + flap); ctx.beginPath(); ctx.ellipse(-14, -4, 14, 8, -0.3, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      ctx.save(); ctx.rotate(0.4 - flap); ctx.beginPath(); ctx.ellipse(14, -4, 14, 8, 0.3, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      ctx.shadowColor = e.state === 'charge' ? '#ffe58f' : '#d5a8ff';
      ctx.shadowBlur = e.state === 'charge' ? 22 : 12;
      ctx.fillStyle = flash ? '#ffffff' : (e.state === 'charge' ? '#ffe9a3' : (e.hellStyle ? '#ff6e9c' : '#b784ff'));
      ctx.beginPath(); ctx.arc(0, 0, 14, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#2d1a4a';
      ctx.beginPath(); ctx.arc(-4, -1, 2.2, 0, Math.PI * 2); ctx.arc(4, -1, 2.2, 0, Math.PI * 2); ctx.fill();
    },

    bomber(ctx, e, flash) {
      ctx.translate(e.cx, e.cy);
      const flap = Math.sin(e.animTime * 14) * 5;
      ctx.fillStyle = '#fff5fb';
      ctx.beginPath();
      ctx.ellipse(-16, -6 + flap * 0.4, 11, 6, -0.3, 0, Math.PI * 2);
      ctx.ellipse(16, -6 + flap * 0.4, 11, 6, 0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = flash ? '#ffffff' : (e.state === 'windup' ? '#ffe58f' : (e.hellStyle ? '#ff8a70' : '#ffbfa6'));
      ctx.beginPath(); ctx.arc(0, -4, 14, Math.PI, 0); ctx.lineTo(17, 12); ctx.lineTo(-17, 12); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#331c4a';
      ctx.beginPath(); ctx.arc(-4, 0, 2.2, 0, Math.PI * 2); ctx.arc(4, 0, 2.2, 0, Math.PI * 2); ctx.fill();
    },

    prism_turret(ctx, e, flash) {
      const bob = Math.sin(e.animTime * 4) * 5;
      ctx.translate(e.cx, e.y + e.h);
      drawGroundShadow(ctx, 14);
      ctx.translate(0, -e.h * 0.5 + bob);
      ctx.shadowColor = e.hellStyle ? '#ff7da8' : '#9cf5ff';
      ctx.shadowBlur = e.state === 'charge' ? 22 : 12;
      ctx.fillStyle = flash ? '#ffffff' : (e.hellStyle ? '#ff7da8' : '#9cf5ff');
      ctx.beginPath(); ctx.moveTo(0, -24); ctx.lineTo(17, 0); ctx.lineTo(0, 22); ctx.lineTo(-17, 0); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.stroke();
      ctx.save(); ctx.rotate(e.animTime * 2.5); ctx.strokeStyle = '#ffe58f'; ctx.lineWidth = 2; ctx.strokeRect(-14, -14, 28, 28); ctx.restore();
      ctx.fillStyle = '#2d1a4a'; ctx.beginPath(); ctx.arc(0, 0, 4.5, 0, Math.PI * 2); ctx.fill();
    },

    shadow_dasher(ctx, e, flash, time) {
      ctx.translate(e.cx, e.y + e.h);
      drawGroundShadow(ctx, 15);
      ctx.scale(e.facing, 1);
      if (e.state === 'blink_prep') ctx.globalAlpha = 0.45 + Math.sin(time * 30) * 0.3;
      const bob = Math.sin(e.animTime * 6) * 3;
      ctx.fillStyle = flash ? '#ffffff' : (e.hellStyle ? '#47102c' : '#351c59');
      ctx.beginPath();
      ctx.moveTo(-16, -2); ctx.lineTo(-12, -38 + bob); ctx.quadraticCurveTo(0, -52 + bob, 14, -36 + bob);
      ctx.lineTo(17, -2); ctx.lineTo(6, -9); ctx.lineTo(-4, -2); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = e.hellStyle ? '#ff7da8' : '#d6a4ff'; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = '#ffe58f'; ctx.shadowColor = '#ffe58f'; ctx.shadowBlur = 8;
      ctx.beginPath(); ctx.ellipse(4, -30 + bob, 2.8, 1.8, -0.2, 0, Math.PI * 2); ctx.ellipse(10, -30 + bob, 2.5, 1.8, 0.2, 0, Math.PI * 2); ctx.fill();
    },

    shiba_samurai(ctx, e, flash, time) {
      if (e.slashTrail) {
        const st = e.slashTrail;
        const a = Math.max(0, st.life / st.maxLife);
        const sy1 = st.y1 !== undefined ? st.y1 : st.y;
        const sy2 = st.y2 !== undefined ? st.y2 : st.y;
        ctx.save();
        ctx.globalAlpha = a;
        ctx.strokeStyle = '#ffe894'; ctx.shadowColor = '#ffe894'; ctx.shadowBlur = 20;
        ctx.lineWidth = 14 * a + 2; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(st.x1, sy1); ctx.lineTo(st.x2, sy2); ctx.stroke();
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 5 * a + 1;
        ctx.beginPath(); ctx.moveTo(st.x1, sy1); ctx.lineTo(st.x2, sy2); ctx.stroke();
        ctx.restore();
      }
      ctx.translate(e.cx, e.y + e.h);
      drawGroundShadow(ctx, 20);
      ctx.scale(e.facing, 1);
      const crouch = e.state === 'sheath_hold' ? 5 : 0;
      const trot = Math.abs(e.vx) > 20 ? Math.abs(Math.sin(e.animTime * 11)) * -3 : 0;
      ctx.strokeStyle = flash ? '#ffffff' : '#e89643'; ctx.lineWidth = 6; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.arc(-20, -22 + crouch + trot, 7, 0.4, Math.PI * 1.5); ctx.stroke();
      ctx.fillStyle = flash ? '#ffffff' : '#ee9e4a';
      SR.roundRect(ctx, -20, -28 + crouch + trot, 38, 22, 10); ctx.fill();
      ctx.fillStyle = flash ? '#ffffff' : '#fff3de';
      SR.roundRect(ctx, -12, -16 + crouch + trot, 26, 10, 5); ctx.fill();
      SR.roundRect(ctx, -14, -9, 7, 9, 3); ctx.fill();
      SR.roundRect(ctx, 8, -9, 7, 9, 3); ctx.fill();
      ctx.fillStyle = flash ? '#ffffff' : '#ee9e4a';
      ctx.beginPath(); ctx.arc(10, -32 + crouch + trot, 14, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.moveTo(1, -42 + crouch + trot); ctx.lineTo(5, -53 + crouch + trot); ctx.lineTo(10, -43 + crouch + trot); ctx.fill();
      ctx.beginPath(); ctx.moveTo(11, -43 + crouch + trot); ctx.lineTo(17, -53 + crouch + trot); ctx.lineTo(20, -41 + crouch + trot); ctx.fill();
      ctx.fillStyle = '#fff5e4';
      ctx.beginPath(); ctx.ellipse(15, -28 + crouch + trot, 9, 6.5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffffff'; ctx.fillRect(-1, -40 + crouch + trot, 22, 4);
      ctx.fillStyle = '#ff6b8b'; ctx.beginPath(); ctx.arc(13, -38 + crouch + trot, 2.2, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#291a14';
      ctx.beginPath();
      ctx.arc(11, -33 + crouch + trot, 2.1, 0, Math.PI * 2);
      ctx.arc(18, -33 + crouch + trot, 2.1, 0, Math.PI * 2);
      ctx.arc(21, -29 + crouch + trot, 2.3, 0, Math.PI * 2);
      ctx.fill();

      ctx.save();
      ctx.translate(-2, -16 + crouch + trot);
      ctx.rotate(e.state === 'sheath_hold' ? -0.1 : -0.25);
      ctx.fillStyle = '#261e38'; SR.roundRect(ctx, -26, -3, 32, 6, 3); ctx.fill();
      ctx.fillStyle = '#ffe58f'; ctx.fillRect(4, -6, 4, 12);
      ctx.fillStyle = '#d94862'; SR.roundRect(ctx, 8, -3, 14, 6, 2); ctx.fill();
      if (e.state === 'sheath_hold') {
        const pulse = 1 + Math.sin(time * 28) * 0.35;
        ctx.shadowColor = '#ffe894'; ctx.shadowBlur = 18; ctx.fillStyle = '#fff9c4';
        SR.drawStar(ctx, 7, 0, 4, 13 * pulse, 4 * pulse); ctx.fill();
      }
      ctx.restore();
    },

    delivery_scooter(ctx, e, flash) {
      ctx.translate(e.cx, e.y + e.h);
      drawGroundShadow(ctx, 24);
      ctx.scale(e.facing, 1);
      const vib = Math.sin(e.animTime * 28) * 1.4;
      ctx.fillStyle = '#261d3a';
      ctx.beginPath(); ctx.arc(-16, -8, 8, 0, Math.PI * 2); ctx.arc(18, -8, 8, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#dfe6ff';
      ctx.beginPath(); ctx.arc(-16, -8, 3.5, 0, Math.PI * 2); ctx.arc(18, -8, 3.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = flash ? '#ffffff' : '#ff8ec6';
      SR.roundRect(ctx, -22, -22 + vib, 44, 13, 6); ctx.fill();
      SR.roundRect(ctx, 10, -34 + vib, 8, 18, 4); ctx.fill();
      ctx.fillStyle = flash ? '#ffffff' : '#ff6fa8';
      SR.roundRect(ctx, -28, -42 + vib, 22, 22, 4); ctx.fill();
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = flash ? '#ffffff' : '#7ae8d4';
      SR.roundRect(ctx, -4, -36 + vib, 14, 18, 5); ctx.fill();
      ctx.fillStyle = '#ffeef2'; ctx.beginPath(); ctx.arc(3, -44 + vib, 10, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ff6fa8'; ctx.beginPath(); ctx.arc(2, -46 + vib, 10.5, Math.PI * 0.85, Math.PI * 2.1); ctx.fill();
      ctx.fillStyle = '#2d1e4a'; SR.roundRect(ctx, 5, -47 + vib, 8, 5, 2); ctx.fill();
    },

    corgi_skater(ctx, e, flash) {
      ctx.translate(e.cx, e.y + e.h);
      drawGroundShadow(ctx, 22);
      ctx.scale(e.facing, 1);
      const crouch = e.state === 'kickflip_windup' ? 4 : 0;
      ctx.save();
      ctx.translate(0, -7);
      if (e.boardSpin) ctx.rotate(e.boardSpin);
      ctx.fillStyle = '#7ce8ff'; SR.roundRect(ctx, -26, -3, 52, 6, 3); ctx.fill();
      ctx.fillStyle = '#ff9fd6'; ctx.fillRect(-16, -2, 32, 2.5);
      ctx.fillStyle = '#ffe58f';
      ctx.beginPath(); ctx.arc(-15, 5, 4.5, 0, Math.PI * 2); ctx.arc(15, 5, 4.5, 0, Math.PI * 2); ctx.fill();
      ctx.restore();

      const bob = e.state === 'ollie_air' ? -4 : Math.sin(e.animTime * 9) * 1.5;
      ctx.fillStyle = flash ? '#ffffff' : '#f29f4b';
      SR.roundRect(ctx, -20, -32 + crouch + bob, 38, 21, 10); ctx.fill();
      ctx.fillStyle = '#fff6e8';
      ctx.beginPath(); ctx.arc(-18, -21 + crouch + bob, 7.5, 0, Math.PI * 2); ctx.fill();
      SR.roundRect(ctx, -6, -18 + crouch + bob, 22, 8, 4); ctx.fill();
      SR.roundRect(ctx, -12, -13 + crouch + bob, 6, 6, 2.5); ctx.fill();
      SR.roundRect(ctx, 8, -13 + crouch + bob, 6, 6, 2.5); ctx.fill();

      ctx.fillStyle = flash ? '#ffffff' : '#f29f4b';
      ctx.beginPath(); ctx.arc(11, -36 + crouch + bob, 13, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.moveTo(1, -44 + crouch + bob); ctx.lineTo(3, -58 + crouch + bob); ctx.lineTo(10, -46 + crouch + bob); ctx.fill();
      ctx.beginPath(); ctx.moveTo(12, -46 + crouch + bob); ctx.lineTo(19, -58 + crouch + bob); ctx.lineTo(22, -43 + crouch + bob); ctx.fill();
      ctx.fillStyle = '#ffadc8';
      ctx.beginPath(); ctx.moveTo(4, -46 + crouch + bob); ctx.lineTo(5, -53 + crouch + bob); ctx.lineTo(8, -46 + crouch + bob); ctx.fill();
      ctx.beginPath(); ctx.moveTo(14, -46 + crouch + bob); ctx.lineTo(18, -53 + crouch + bob); ctx.lineTo(19, -45 + crouch + bob); ctx.fill();
      ctx.fillStyle = '#fff6e8'; ctx.beginPath(); ctx.ellipse(17, -32 + crouch + bob, 8, 5.5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#291a14'; ctx.beginPath(); ctx.arc(23, -33 + crouch + bob, 2.2, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ff85a8'; ctx.beginPath(); ctx.ellipse(20, -28 + crouch + bob, 2.5, 3, 0.2, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#221738'; SR.roundRect(ctx, 8, -41 + crouch + bob, 14, 5.5, 2); ctx.fill();
      ctx.fillStyle = '#8be4ff'; ctx.fillRect(10, -40 + crouch + bob, 4, 2); ctx.fillRect(16, -40 + crouch + bob, 4, 2);
    },

    cat_thrower(ctx, e, flash, time) {
      ctx.translate(e.cx, e.y + e.h);
      drawGroundShadow(ctx, 16);
      ctx.scale(e.facing, 1);
      const bob = Math.sin(e.animTime * 6) * 2;
      ctx.strokeStyle = flash ? '#ffffff' : '#3a2d4f'; ctx.lineWidth = 5; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(-12, -12 + bob); ctx.quadraticCurveTo(-24, -22 + Math.sin(time * 7) * 6, -18, -34 + bob); ctx.stroke();
      ctx.fillStyle = flash ? '#ffffff' : '#3a2d4f';
      SR.roundRect(ctx, -14, -32 + bob, 28, 30, 11); ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.ellipse(3, -16 + bob, 9, 11, 0, 0, Math.PI * 2); ctx.fill();
      SR.roundRect(ctx, -9, -6, 7, 6, 3); ctx.fill();
      SR.roundRect(ctx, 4, -6, 7, 6, 3); ctx.fill();
      ctx.fillStyle = flash ? '#ffffff' : '#3a2d4f';
      ctx.beginPath(); ctx.arc(2, -38 + bob, 13.5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-9, -46 + bob); ctx.lineTo(-8, -57 + bob); ctx.lineTo(0, -49 + bob); ctx.fill();
      ctx.beginPath(); ctx.moveTo(4, -49 + bob); ctx.lineTo(12, -57 + bob); ctx.lineTo(13, -46 + bob); ctx.fill();
      ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.ellipse(7, -34 + bob, 7.5, 5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffe58f'; ctx.beginPath(); ctx.arc(1, -40 + bob, 2.5, 0, Math.PI * 2); ctx.arc(10, -40 + bob, 2.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#1b1126'; ctx.fillRect(0.5, -42 + bob, 1.4, 4); ctx.fillRect(9.5, -42 + bob, 1.4, 4);
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(13, -35 + bob); ctx.lineTo(20, -37 + bob); ctx.moveTo(13, -33 + bob); ctx.lineTo(20, -32 + bob); ctx.stroke();
      if (e.heldItem) {
        ctx.save(); ctx.translate(4, -62 + bob); drawCatJunkItem(ctx, e.heldItem); ctx.restore();
      }
    },

    midboss(ctx, e, flash) {
      ctx.translate(e.cx, e.y + e.h);
      drawGroundShadow(ctx, 36);
      const bob = Math.sin(e.animTime * 4) * 4;
      const cols = e.variant === 'pyro'
        ? ['#ff9a70', '#a62646', '#ffe58f']
        : e.variant === 'frost'
          ? ['#b8f6ff', '#4b78c7', '#e0d6ff']
          : ['#8de8e0', '#5372bd', '#ff9fd6'];
      ctx.shadowColor = cols[0]; ctx.shadowBlur = 20;
      ctx.fillStyle = flash ? '#ffffff' : cols[0];
      SR.roundRect(ctx, -26, -114 + bob, 16, 36, 8); ctx.fill();
      SR.roundRect(ctx, 10, -114 + bob, 16, 36, 8); ctx.fill();
      const bodyGrad = ctx.createLinearGradient(0, -84, 0, 0);
      bodyGrad.addColorStop(0, flash ? '#ffffff' : cols[0]);
      bodyGrad.addColorStop(1, flash ? '#ffffff' : cols[1]);
      ctx.fillStyle = bodyGrad;
      SR.roundRect(ctx, -39, -80 + bob * 0.5, 78, 78, 28); ctx.fill();
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3; ctx.stroke();
      ctx.fillStyle = e.phase === 2 ? '#ffe58f' : cols[2];
      SR.drawStar(ctx, 0, -28 + bob * 0.5, 4, 14, 5); ctx.fill();
      ctx.fillStyle = '#251742';
      ctx.beginPath(); ctx.arc(-14, -52 + bob * 0.5, 5, 0, Math.PI * 2); ctx.arc(14, -52 + bob * 0.5, 5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(-12.5, -53.5 + bob * 0.5, 2, 0, Math.PI * 2); ctx.arc(15.5, -53.5 + bob * 0.5, 2, 0, Math.PI * 2); ctx.fill();
    },

    humanboss(ctx, e, flash, time) {
      const cx = e.cx;
      // Unified Sky-Drop Warning Pillars (Sleek translucent vertical shimmer + ground target ring!)
      if (e.meteors && e.meteors.length) {
        for (const m of e.meteors) {
          if (!m.fired) {
            ctx.save();
            const pulse = 0.14 + 0.08 * Math.sin(time * 18);
            const col = m.color || '#7ef7b8';
            ctx.globalAlpha = pulse;
            const beamG = ctx.createLinearGradient(m.x, 40, m.x, 575);
            beamG.addColorStop(0, 'rgba(255,255,255,0)');
            beamG.addColorStop(0.3, col);
            beamG.addColorStop(1, col);
            ctx.fillStyle = beamG;
            ctx.fillRect(m.x - 13, 40, 26, 535);
            ctx.globalAlpha = 0.65;
            ctx.strokeStyle = '#ffe89a'; ctx.lineWidth = 1.8; ctx.setLineDash([7, 7]);
            ctx.beginPath(); ctx.moveTo(m.x, 50); ctx.lineTo(m.x, 575); ctx.stroke();
            ctx.setLineDash([]);
            ctx.strokeStyle = col; ctx.lineWidth = 2.4;
            ctx.beginPath(); ctx.ellipse(m.x, 574, 18, 5, 0, 0, Math.PI * 2); ctx.stroke();
            ctx.restore();
          }
        }
      }

      ctx.translate(cx, e.y + e.h);
      drawGroundShadow(ctx, 22);
      ctx.scale(e.facing, 1);
      const bob = Math.sin(e.animTime * 5) * 2.5;

      if (e.bossKind === 'human_grandma') {
        if (e.pushingWheelchair) {
          ctx.save(); ctx.translate(30, 0);
          ctx.strokeStyle = '#d8e4ff'; ctx.lineWidth = 4;
          ctx.beginPath(); ctx.moveTo(-14, -44); ctx.lineTo(-14, -20); ctx.lineTo(14, -20); ctx.lineTo(18, -6); ctx.stroke();
          ctx.strokeStyle = '#ffe58f'; ctx.lineWidth = 3.5;
          ctx.beginPath(); ctx.arc(-6, -15, 14, 0, Math.PI * 2); ctx.stroke();
          ctx.beginPath(); ctx.arc(14, -7, 6, 0, Math.PI * 2); ctx.stroke();
          ctx.restore();
        }
        ctx.fillStyle = '#4a3558';
        SR.roundRect(ctx, -10, -10, 9, 10, 4); ctx.fill();
        SR.roundRect(ctx, 2, -10, 9, 10, 4); ctx.fill();
        ctx.fillStyle = flash ? '#ffffff' : '#e882b4';
        SR.roundRect(ctx, -16, -46 + bob, 32, 38, 12); ctx.fill();
        ctx.fillStyle = '#ffe594';
        ctx.beginPath(); ctx.arc(-6, -32 + bob, 3, 0, Math.PI * 2); ctx.arc(7, -24 + bob, 3, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = flash ? '#ffffff' : '#ffe8dc';
        ctx.beginPath(); ctx.arc(0, -56 + bob, 14, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#e6e4f2';
        ctx.beginPath(); ctx.arc(-2, -60 + bob, 14, Math.PI * 0.85, Math.PI * 2.1); ctx.fill();
        ctx.beginPath(); ctx.arc(-13, -67 + bob, 8, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#ffd978'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(4, -55 + bob, 4.5, 0, Math.PI * 2); ctx.arc(12, -55 + bob, 4, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = '#2d1c3d';
        ctx.beginPath(); ctx.arc(5, -55 + bob, 1.8, 0, Math.PI * 2); ctx.arc(12.5, -55 + bob, 1.7, 0, Math.PI * 2); ctx.fill();
        if (!e.pushingWheelchair) {
          ctx.save(); ctx.translate(16, -26 + bob);
          ctx.rotate(e.state === 'cane_dash' ? -0.8 : (e.state === 'cane_prep' ? -0.45 : 0.1));
          ctx.strokeStyle = '#b06d44'; ctx.lineWidth = 4.5; ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(0, 26); ctx.lineTo(0, -14); ctx.arc(5, -14, 5, Math.PI, 0); ctx.stroke();
          ctx.restore();
        }
      } else if (e.bossKind === 'human_athlete') {
        const lean = e.state === 'sprint_dash' ? 0.35 : 0;
        ctx.rotate(lean);
        ctx.fillStyle = '#ffe58f';
        SR.roundRect(ctx, -11, -12, 10, 12, 4); ctx.fill();
        SR.roundRect(ctx, 3, -12, 10, 12, 4); ctx.fill();
        ctx.fillStyle = '#293566'; SR.roundRect(ctx, -14, -26 + bob, 28, 15, 5); ctx.fill();
        ctx.fillStyle = flash ? '#ffffff' : '#ff6b78'; SR.roundRect(ctx, -15, -50 + bob, 30, 26, 8); ctx.fill();
        ctx.save(); ctx.scale(e.facing, 1);
        ctx.font = '800 12px sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#ffffff'; ctx.fillText('23', 0, -33 + bob);
        ctx.restore();
        ctx.fillStyle = flash ? '#ffffff' : '#ffd8be'; ctx.beginPath(); ctx.arc(0, -61 + bob, 13.5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#33241c'; ctx.beginPath(); ctx.arc(-2, -65 + bob, 13.5, Math.PI * 0.9, Math.PI * 2.1); ctx.fill();
        ctx.fillStyle = '#ffffff'; ctx.fillRect(-13, -67 + bob, 26, 4.5);
        ctx.fillStyle = '#22152e'; ctx.beginPath(); ctx.arc(5, -60 + bob, 2.2, 0, Math.PI * 2); ctx.arc(11, -60 + bob, 2.2, 0, Math.PI * 2); ctx.fill();
        const sw = e.swingAnim > 0 ? 1.4 - e.swingAnim * 6 : -0.65;
        if (e.sportMode === 'badminton' || e.sportMode === 'tennis') {
          ctx.save(); ctx.translate(14, -40 + bob); ctx.rotate(sw);
          ctx.strokeStyle = e.sportMode === 'badminton' ? '#8be4ff' : '#c4ff6b'; ctx.lineWidth = 3;
          ctx.beginPath(); ctx.moveTo(0, 8); ctx.lineTo(0, -18); ctx.stroke();
          ctx.beginPath(); ctx.ellipse(0, -28, e.sportMode === 'badminton' ? 9 : 11, 13, 0, 0, Math.PI * 2); ctx.stroke();
          ctx.fillStyle = 'rgba(255,255,255,0.28)'; ctx.fill();
          ctx.restore();
        } else if (e.sportMode === 'basketball') {
          ctx.fillStyle = '#ff8c42';
          ctx.beginPath(); ctx.arc(18, -48 + bob + Math.sin(time * 16) * 5, 9, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = '#331c10'; ctx.lineWidth = 1.5; ctx.stroke();
        }
      } else if (e.bossKind === 'human_trader') {
        // 當沖股神 (Victor, Day-Trading Wolf — Suit, Red Tie, Floating Dual Stock Chart Monitors!)
        // Floating glowing K-Line candlestick monitors hovering behind him!
        ctx.save();
        const monBob = Math.sin(time * 3.5) * 4;
        ctx.translate(-34, -46 + monBob);
        ctx.fillStyle = '#181c36';
        ctx.strokeStyle = e.sportMode === 'crash' ? '#52f29b' : '#ff6b78';
        ctx.lineWidth = 2;
        SR.roundRect(ctx, -22, -16, 44, 30, 5); ctx.fill(); ctx.stroke();
        // Mini animated candlestick bars on screen!
        for (let k = 0; k < 5; k++) {
          const isUp = (k + Math.floor(time * 3)) % 2 === 0;
          const bh = 6 + ((k * 7) % 10);
          ctx.fillStyle = isUp ? '#ff5c74' : '#4df29c';
          ctx.fillRect(-16 + k * 7.5, -2 - (isUp ? bh * 0.6 : 0), 4.5, bh);
        }
        ctx.restore();

        const lean = e.state === 'bull_dash' ? 0.34 : 0;
        ctx.rotate(lean);
        // Dress shoes & tailored suit trousers
        ctx.fillStyle = '#1a1829';
        SR.roundRect(ctx, -11, -22, 9, 22, 3); ctx.fill();
        SR.roundRect(ctx, 2, -22, 9, 22, 3); ctx.fill();
        // Sharp tailored Wall-Street suit jacket + white dress shirt + glowing red tie!
        ctx.fillStyle = flash ? '#ffffff' : '#262d54';
        SR.roundRect(ctx, -16, -50 + bob, 32, 31, 8); ctx.fill();
        // White V-shirt & bold crimson bull-market tie
        ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.moveTo(-4, -50 + bob); ctx.lineTo(8, -50 + bob); ctx.lineTo(3, -32 + bob); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#ff4f6d';
        ctx.beginPath(); ctx.moveTo(1, -48 + bob); ctx.lineTo(5, -48 + bob); ctx.lineTo(6, -33 + bob); ctx.lineTo(3, -29 + bob); ctx.lineTo(0, -33 + bob); ctx.closePath(); ctx.fill();
        // Head + slicked-back wolf hair + Bluetooth trader earpiece + sharp shades!
        ctx.fillStyle = flash ? '#ffffff' : '#ffe0cc';
        ctx.beginPath(); ctx.arc(0, -61 + bob, 13.5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#241b30';
        ctx.beginPath();
        ctx.arc(-2, -65 + bob, 14, Math.PI * 0.85, Math.PI * 2.1);
        ctx.lineTo(13, -72 + bob); ctx.lineTo(2, -74 + bob); ctx.lineTo(-10, -71 + bob); ctx.closePath(); ctx.fill();
        // Sharp gold-rimmed glasses
        ctx.fillStyle = 'rgba(255, 228, 143, 0.35)'; ctx.strokeStyle = '#ffe58f'; ctx.lineWidth = 1.8;
        SR.roundRect(ctx, 1, -64 + bob, 13, 5.5, 2); ctx.fill(); ctx.stroke();
        // Glowing Cyan Bluetooth headset!
        ctx.fillStyle = '#8be4ff'; ctx.shadowColor = '#8be4ff'; ctx.shadowBlur = 8;
        ctx.beginPath(); ctx.arc(-4, -59 + bob, 2.5, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;
        // Glowing Stock Tablet / Phone in hand!
        ctx.save();
        ctx.translate(16, -34 + bob);
        ctx.rotate(e.swingAnim > 0 ? -0.55 : -0.15);
        ctx.fillStyle = '#ffe58f'; SR.roundRect(ctx, -3, -12, 11, 18, 2.5); ctx.fill();
        ctx.fillStyle = e.sportMode === 'crash' ? '#4df29c' : '#ff5c74';
        ctx.fillRect(-1, -10, 7, 14);
        ctx.restore();
      } else if (e.bossKind === 'human_jk') {
        const tilt = e.state === 'sneeze_prep' ? -0.26 : (e.state === 'workout_dash' ? 0.25 : 0);
        const shiver = e.state === 'sneeze_prep' ? Math.sin(time * 48) * 2.2 : 0;
        ctx.translate(shiver, 0); ctx.rotate(tilt);
        ctx.fillStyle = '#5c3626'; SR.roundRect(ctx, -10, -7, 9, 7, 3); ctx.fill(); SR.roundRect(ctx, 2, -7, 9, 7, 3); ctx.fill();
        ctx.fillStyle = '#ffffff'; ctx.fillRect(-8, -20, 6, 13); ctx.fillRect(3, -20, 6, 13);
        ctx.fillStyle = flash ? '#ffffff' : '#263366';
        ctx.beginPath(); ctx.moveTo(-12, -33 + bob); ctx.lineTo(12, -33 + bob); ctx.lineTo(18, -17 + bob); ctx.lineTo(-18, -17 + bob); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.22)'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(-6, -32 + bob); ctx.lineTo(-9, -17 + bob); ctx.moveTo(6, -32 + bob); ctx.lineTo(9, -17 + bob); ctx.stroke();
        ctx.fillStyle = flash ? '#ffffff' : '#fffaff'; SR.roundRect(ctx, -13, -51 + bob, 26, 20, 6); ctx.fill();
        ctx.fillStyle = '#263366';
        ctx.beginPath(); ctx.moveTo(-14, -50 + bob); ctx.lineTo(14, -50 + bob); ctx.lineTo(6, -40 + bob); ctx.lineTo(-10, -40 + bob); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#ff5978';
        ctx.beginPath(); ctx.moveTo(4, -43 + bob); ctx.lineTo(11, -46 + bob); ctx.lineTo(11, -38 + bob); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(4, -43 + bob); ctx.lineTo(-2, -46 + bob); ctx.lineTo(-2, -38 + bob); ctx.closePath(); ctx.fill();
        ctx.fillStyle = flash ? '#ffffff' : '#ffefe6'; ctx.beginPath(); ctx.arc(0, -62 + bob, 13.5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = flash ? '#ffffff' : '#4a2b3d';
        ctx.beginPath(); ctx.arc(-2, -65 + bob, 14, Math.PI * 0.8, Math.PI * 2.1); ctx.fill();
        ctx.beginPath(); ctx.ellipse(-18, -62 + bob + Math.sin(time * 8) * 2, 7, 13, 0.35, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#ff8ec6'; ctx.beginPath(); ctx.arc(-13, -69 + bob, 4, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#2c1836';
        if (e.state === 'sneeze_prep') {
          ctx.strokeStyle = '#2c1836'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(3, -64 + bob); ctx.lineTo(7, -61 + bob); ctx.lineTo(3, -59 + bob); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(12, -64 + bob); ctx.lineTo(9, -61 + bob); ctx.lineTo(12, -59 + bob); ctx.stroke();
        } else {
          ctx.beginPath(); ctx.ellipse(4.5, -61 + bob, 2.2, 2.8, 0, 0, Math.PI * 2); ctx.ellipse(10.5, -61 + bob, 2, 2.7, 0, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(5.2, -62 + bob, 0.9, 0, Math.PI * 2); ctx.arc(11.1, -62 + bob, 0.8, 0, Math.PI * 2); ctx.fill();
        }
        ctx.fillStyle = 'rgba(255, 132, 180, 0.6)';
        ctx.beginPath(); ctx.ellipse(2, -57 + bob, 2.6, 1.4, 0, 0, Math.PI * 2); ctx.ellipse(11.5, -57 + bob, 2.4, 1.4, 0, 0, Math.PI * 2); ctx.fill();
        if (e.sportMode === 'workout') {
          const pump = Math.sin(time * 24) * 7;
          ctx.save(); ctx.translate(15, -42 + bob + pump);
          ctx.rotate(e.swingAnim > 0 ? 0.7 : 0);
          ctx.fillStyle = '#d4e2ff'; ctx.fillRect(-3, -2, 16, 4);
          ctx.fillStyle = '#ff7eb6'; SR.roundRect(ctx, -6, -7, 6, 14, 2.5); ctx.fill(); SR.roundRect(ctx, 11, -7, 6, 14, 2.5); ctx.fill();
          ctx.restore();
        } else if (e.sportMode === 'cooking') {
          // 麻辣鴛鴦火鍋 (Steaming Bubbling Hotpot!)
          const simmer = Math.sin(time * 20) * 1.8;
          ctx.save(); ctx.translate(20, -32 + bob + simmer * 0.4);
          // Portable hotpot stove base with orange flame
          ctx.fillStyle = '#3b2e4d'; SR.roundRect(ctx, -14, 8, 28, 6, 2); ctx.fill();
          ctx.fillStyle = '#ff7b47'; ctx.shadowColor = '#ff7b47'; ctx.shadowBlur = 10;
          ctx.beginPath(); ctx.arc(0, 8, 6 + Math.sin(time * 32) * 1.5, Math.PI, 0); ctx.fill();
          ctx.shadowBlur = 0;
          // Deep clay/metal hotpot bowl + handles
          ctx.fillStyle = '#4a2c40';
          ctx.beginPath(); ctx.arc(0, -2, 16, 0, Math.PI); ctx.closePath(); ctx.fill();
          ctx.fillStyle = '#ffe58f'; ctx.fillRect(-19, -4, 38, 4);
          // Bubbling Red & White Yin-Yang Broth!
          ctx.fillStyle = '#ff5464';
          ctx.beginPath(); ctx.ellipse(-6, -4, 7.5, 4.5, 0, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#fff5dc';
          ctx.beginPath(); ctx.ellipse(6, -4, 7.5, 4.5, 0, 0, Math.PI * 2); ctx.fill();
          // Bubbling tofu & fishball + steam clouds!
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(-5, -12 - Math.abs(Math.sin(time * 10)) * 6, 3.5, 0, Math.PI * 2);
          ctx.arc(5, -14 - Math.abs(Math.cos(time * 10)) * 6, 3.2, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      } else {
        // Software Engineer (Kevin)
        ctx.fillStyle = '#364675'; SR.roundRect(ctx, -12, -22, 10, 22, 4); ctx.fill(); SR.roundRect(ctx, 2, -22, 10, 22, 4); ctx.fill();
        ctx.fillStyle = flash ? '#ffffff' : '#3b5c7a'; SR.roundRect(ctx, -16, -48 + bob, 32, 30, 8); ctx.fill();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(-14, -36 + bob); ctx.lineTo(14, -36 + bob); ctx.moveTo(0, -47 + bob); ctx.lineTo(0, -20 + bob); ctx.stroke();
        ctx.fillStyle = flash ? '#ffffff' : '#f7dac8'; ctx.beginPath(); ctx.arc(0, -59 + bob, 14, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#251d2e';
        ctx.beginPath(); ctx.arc(-2, -63 + bob, 14.5, Math.PI * 0.85, Math.PI * 2.08);
        ctx.lineTo(14, -68 + bob); ctx.lineTo(8, -75 + bob); ctx.lineTo(1, -70 + bob); ctx.lineTo(-7, -76 + bob); ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgba(126, 247, 184, 0.42)'; ctx.strokeStyle = '#1b1424'; ctx.lineWidth = 2.2;
        SR.roundRect(ctx, 0, -63 + bob, 9, 7, 1.5); ctx.fill(); ctx.stroke();
        SR.roundRect(ctx, 10, -63 + bob, 8, 7, 1.5); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#5c4b51';
        for (let st = -1; st <= 3; st++) {
          ctx.fillRect(2 + st * 2.8, -50 + bob + (st % 2), 1.5, 1.5);
          ctx.fillRect(3 + st * 2.5, -48 + bob, 1.4, 1.4);
        }
        const typeJitter = e.typingAnim > 0 ? Math.sin(time * 42) * 2.5 : 0;
        ctx.save(); ctx.translate(18, -32 + bob);
        ctx.fillStyle = '#d4dceb'; ctx.fillRect(-4, 0, 20, 4);
        ctx.beginPath(); ctx.moveTo(14, 0); ctx.lineTo(22, -16); ctx.lineTo(25, -14); ctx.lineTo(17, 2); ctx.closePath(); ctx.fill();
        ctx.shadowColor = '#7ef7b8'; ctx.shadowBlur = 14; ctx.fillStyle = '#8ef7c8'; ctx.fillRect(15, -13, 3, 12);
        ctx.fillStyle = '#f7dac8';
        ctx.beginPath(); ctx.arc(3, -2 + typeJitter, 3.2, 0, Math.PI * 2); ctx.arc(9, -2 - typeJitter, 3.2, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }
    },

    finalboss(ctx, e, flash, time) {
      const cx = e.cx, cy = e.cy;
      for (const m of e.meteors) {
        if (!m.fired) {
          ctx.save();
          const pulse = 0.25 + 0.3 * Math.sin(time * 18);
          const colGrad = ctx.createLinearGradient(m.x, 40, m.x, 575);
          colGrad.addColorStop(0, `rgba(255, 229, 143, ${pulse})`);
          colGrad.addColorStop(1, `rgba(255, 135, 185, ${pulse * 1.25})`);
          ctx.fillStyle = colGrad; ctx.fillRect(m.x - 18, 40, 36, 535);
          ctx.strokeStyle = '#ffe89a'; ctx.lineWidth = 2; ctx.setLineDash([8, 6]);
          ctx.beginPath(); ctx.moveTo(m.x, 40); ctx.lineTo(m.x, 575); ctx.stroke();
          ctx.restore();
        }
      }
      if (e.state === 'sweep_prep') {
        ctx.save();
        ctx.strokeStyle = 'rgba(255, 159, 214, 0.85)'; ctx.lineWidth = 5; ctx.setLineDash([12, 8]);
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(e.facing > 0 ? e.arena.maxX - 20 : e.arena.minX + 20, cy); ctx.stroke();
        ctx.restore();
      }
      ctx.translate(cx, cy);
      const wingFlap = Math.sin(e.animTime * (e.phase === 2 ? 9 : 5.5)) * 0.26;
      const spec = e.spec;
      if (e.phase === 2) {
        ctx.save(); ctx.rotate(time * 1.4);
        ctx.strokeStyle = 'rgba(255, 229, 143, 0.7)'; ctx.lineWidth = 3; ctx.setLineDash([10, 8]);
        ctx.beginPath(); ctx.arc(0, 0, e.bossKind === 'malakor' ? 72 : 58, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
      }
      if (e.bossKind === 'malakor') {
        [-1, 1].forEach((side) => {
          ctx.save(); ctx.scale(side, 1); ctx.rotate(wingFlap);
          ctx.shadowColor = '#ff5e8c'; ctx.shadowBlur = 22;
          const wg = ctx.createLinearGradient(0, -45, 84, 30);
          wg.addColorStop(0, flash ? '#ffffff' : '#ff6b96');
          wg.addColorStop(0.55, flash ? '#ffffff' : '#731642');
          wg.addColorStop(1, flash ? '#ffffff' : '#ffcf70');
          ctx.fillStyle = wg;
          ctx.beginPath(); ctx.moveTo(10, -10); ctx.lineTo(74, -46); ctx.lineTo(86, 6); ctx.lineTo(54, 24); ctx.lineTo(24, 34); ctx.closePath(); ctx.fill();
          ctx.restore();
        });
        ctx.fillStyle = flash ? '#ffffff' : '#300b26';
        ctx.beginPath(); ctx.moveTo(-24, -8); ctx.lineTo(24, -8); ctx.lineTo(36, 52); ctx.quadraticCurveTo(0, 42, -36, 52); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#ffcf70'; SR.drawStar(ctx, 0, 16, 4, 11, 4); ctx.fill();
        ctx.fillStyle = flash ? '#ffffff' : '#4a1438'; ctx.beginPath(); ctx.arc(0, -22, 20, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#ffcf70';
        ctx.beginPath(); ctx.moveTo(-14, -34); ctx.quadraticCurveTo(-30, -60, -12, -58); ctx.lineTo(-6, -38); ctx.fill();
        ctx.beginPath(); ctx.moveTo(14, -34); ctx.quadraticCurveTo(30, -60, 12, -58); ctx.lineTo(6, -38); ctx.fill();
        ctx.fillStyle = '#ffe88a'; ctx.shadowColor = '#ffe88a'; ctx.shadowBlur = 12;
        ctx.beginPath(); ctx.ellipse(-7, -20, 4, 2.6, 0.25, 0, Math.PI * 2); ctx.ellipse(7, -20, 4, 2.6, -0.25, 0, Math.PI * 2); ctx.fill();
      } else {
        [-1, 1].forEach((side) => {
          ctx.save(); ctx.scale(side, 1); ctx.rotate(wingFlap);
          ctx.shadowColor = spec.p1; ctx.shadowBlur = 16;
          const wg = ctx.createLinearGradient(0, -40, 66, 20);
          wg.addColorStop(0, flash ? '#ffffff' : (e.phase === 2 ? spec.p2 : spec.p1));
          wg.addColorStop(0.55, flash ? '#ffffff' : '#c79eff');
          wg.addColorStop(1, flash ? '#ffffff' : '#9cf5e3');
          ctx.fillStyle = wg;
          ctx.beginPath(); ctx.ellipse(36, -16, 38, 20, -0.35, 0, Math.PI * 2); ctx.fill();
          ctx.beginPath(); ctx.ellipse(28, 16, 28, 15, 0.4, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = 'rgba(255, 255, 255, 0.72)'; SR.drawStar(ctx, 40, -18, 4, 7, 2.8); ctx.fill();
          ctx.restore();
        });
        ctx.fillStyle = flash ? '#ffffff' : (e.bossKind === 'glaciella' ? '#2c4c8c' : (e.bossKind === 'zephyra' ? '#584da8' : '#4a2575'));
        ctx.beginPath(); ctx.moveTo(-18, -4); ctx.lineTo(18, -4); ctx.lineTo(28, 44); ctx.quadraticCurveTo(0, 36, -28, 44); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#ffe594'; SR.drawStar(ctx, 0, 14, 4, 8, 3); ctx.fill();
        ctx.fillStyle = flash ? '#ffffff' : '#ffeef8'; ctx.beginPath(); ctx.arc(0, -18, 17, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = flash ? '#ffffff' : spec.p1; ctx.beginPath(); ctx.arc(0, -21, 18, Math.PI * 0.9, Math.PI * 2.1); ctx.fill();
        ctx.fillStyle = '#ffe58f'; ctx.shadowColor = '#ffe58f'; ctx.shadowBlur = 14;
        if (e.bossKind === 'zephyra') {
          ctx.strokeStyle = '#ffe58f'; ctx.lineWidth = 3.5;
          ctx.beginPath(); ctx.ellipse(0, -44, 18, 6, 0, 0, Math.PI * 2); ctx.stroke();
        } else {
          SR.drawStar(ctx, 0, -44, 4, 12, 4.5); ctx.fill();
        }
        ctx.fillStyle = e.phase === 2 ? '#ffe58f' : spec.p1;
        ctx.beginPath(); ctx.ellipse(-6, -16, 3, 3.6, 0, 0, Math.PI * 2); ctx.ellipse(6, -16, 3, 3.6, 0, 0, Math.PI * 2); ctx.fill();
      }
    }
  };

  function drawEnemy(ctx, e, time) {
    ctx.save();
    const fn = ENEMY_RENDERERS[e.type];
    if (fn) fn(ctx, e, e.hitFlash > 0, time);
    ctx.restore();

    if (!e.isBoss && (e.hp < e.maxHp || e.isElite)) {
      const bw = e.isElite ? 54 : 38;
      const bx = e.cx - bw * 0.5;
      const by = e.y - (e.isElite ? 18 : 12);
      ctx.fillStyle = 'rgba(20, 12, 42, 0.78)';
      SR.roundRect(ctx, bx, by, bw, e.isElite ? 7 : 5, 3); ctx.fill();
      ctx.fillStyle = e.isElite ? '#ffe58f' : '#ff9fd6';
      SR.roundRect(ctx, bx, by, bw * Math.max(0, e.hp / e.maxHp), e.isElite ? 7 : 5, 3); ctx.fill();
      if (e.isElite) {
        ctx.font = '800 10.5px "Quicksand", "Microsoft JhengHei", "PingFang TC", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#ffe58f';
        ctx.fillText(`★ ${e.displayName || e.type}`, e.cx, by - 4);
      }
    }
  }

  function drawProjectiles(ctx, playerProjs, enemyProjs, time) {
    for (const p of playerProjs) {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.shadowColor = p.color; ctx.shadowBlur = 14;

      if (p.kind === 'sword_qi' || p.kind === 'crescent') {
        // Lyra: Unmistakable White-Inside, Electric-Blue-Outside 劍氣 (Sword-Qi Crescent!)
        ctx.rotate(Math.atan2(p.vy, p.vx));
        const r = p.r;
        ctx.shadowColor = '#1e88ff';
        ctx.shadowBlur = 20;
        // Deep royal-blue outer energy crescent
        ctx.fillStyle = '#1b76ff';
        ctx.beginPath();
        ctx.arc(-r * 0.25, 0, r * 1.15, -1.18, 1.18);
        ctx.arc(-r * 0.52, 0, r * 0.88, 1.06, -1.06, true);
        ctx.closePath();
        ctx.fill();
        // Vivid azure-blue mid aura
        ctx.fillStyle = '#5cc8ff';
        ctx.beginPath();
        ctx.arc(-r * 0.22, 0, r * 1.02, -1.08, 1.08);
        ctx.arc(-r * 0.44, 0, r * 0.84, 0.96, -0.96, true);
        ctx.closePath();
        ctx.fill();
        // Blazing pure-white core blade crescent inside!
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(-r * 0.18, 0, r * 0.92, -0.95, 0.95);
        ctx.arc(-r * 0.34, 0, r * 0.80, 0.84, -0.84, true);
        ctx.closePath();
        ctx.fill();
      } else if (p.kind === 'starsword') {
        // Lyra Ultimate: White-Inside, Sapphire-Blue-Outside Flying Energy Sword!
        ctx.rotate(Math.atan2(p.vy, p.vx));
        ctx.shadowColor = '#2b8cff';
        ctx.shadowBlur = 22;
        // Outer electric-blue blade aura
        ctx.fillStyle = '#2082ff';
        ctx.beginPath();
        ctx.moveTo(-46, -11); ctx.lineTo(24, -15); ctx.lineTo(54, 0); ctx.lineTo(24, 15); ctx.lineTo(-46, 11);
        ctx.closePath();
        ctx.fill();
        // Mid sky-blue edge
        ctx.fillStyle = '#73d6ff';
        ctx.beginPath();
        ctx.moveTo(-42, -7.5); ctx.lineTo(22, -10.5); ctx.lineTo(48, 0); ctx.lineTo(22, 10.5); ctx.lineTo(-42, 7.5);
        ctx.closePath();
        ctx.fill();
        // Pure-white razor core inside!
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.moveTo(-38, -3.5); ctx.lineTo(22, -5.5); ctx.lineTo(42, 0); ctx.lineTo(22, 5.5); ctx.lineTo(-38, 3.5);
        ctx.closePath();
        ctx.fill();
        // Ornate silver-blue crossguard & hilt
        ctx.fillStyle = '#d6f0ff';
        SR.roundRect(ctx, -38, -20, 8, 40, 3); ctx.fill();
        ctx.fillStyle = '#2b8cff';
        SR.roundRect(ctx, -54, -4, 16, 8, 3); ctx.fill();
      } else if (p.kind === 'silver_bullet') {
        // Pip Basic: Sleek Metallic Silver Bullet (sharp chrome tip + bright white glint!)
        ctx.rotate(Math.atan2(p.vy, p.vx));
        ctx.shadowColor = '#c8dcff';
        ctx.shadowBlur = 10;
        // Subtle silver slipstream tail
        const wake = ctx.createLinearGradient(-22, 0, -4, 0);
        wake.addColorStop(0, 'rgba(210, 228, 250, 0)');
        wake.addColorStop(1, 'rgba(235, 245, 255, 0.72)');
        ctx.strokeStyle = wake;
        ctx.lineWidth = 3.2;
        ctx.beginPath(); ctx.moveTo(-22, 0); ctx.lineTo(-4, 0); ctx.stroke();
        // Pointed brushed-silver bullet body
        const bg = ctx.createLinearGradient(0, -5.5, 0, 5.5);
        bg.addColorStop(0, '#eef5ff');
        bg.addColorStop(0.32, '#ffffff');
        bg.addColorStop(0.68, '#a6b7ce');
        bg.addColorStop(1, '#6f819c');
        ctx.fillStyle = bg;
        ctx.beginPath();
        ctx.moveTo(-10, -4.6);
        ctx.lineTo(3, -4.6);
        ctx.quadraticCurveTo(11, -3.8, 14, 0);
        ctx.quadraticCurveTo(11, 3.8, 3, 4.6);
        ctx.lineTo(-10, 4.6);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#53627a';
        ctx.lineWidth = 1.1;
        ctx.stroke();
        // Crisp specular chrome highlight along upper spine
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(-7, -2.8, 12, 1.6);
      } else if (p.kind === 'silver_piercer') {
        // Pip 4th Burst: Gleaming Platinum-Silver Armor-Piercing Rail Round!
        ctx.rotate(Math.atan2(p.vy, p.vx));
        ctx.shadowColor = '#a8dcff';
        ctx.shadowBlur = 16;
        const tail = ctx.createLinearGradient(-32, 0, 0, 0);
        tail.addColorStop(0, 'rgba(180, 225, 255, 0)');
        tail.addColorStop(1, 'rgba(235, 248, 255, 0.9)');
        ctx.strokeStyle = tail; ctx.lineWidth = 5;
        ctx.beginPath(); ctx.moveTo(-32, 0); ctx.lineTo(0, 0); ctx.stroke();
        const pg = ctx.createLinearGradient(0, -6.5, 0, 6.5);
        pg.addColorStop(0, '#ffffff');
        pg.addColorStop(0.45, '#d5e6fa');
        pg.addColorStop(1, '#7c92b0');
        ctx.fillStyle = pg;
        ctx.beginPath();
        ctx.moveTo(-14, -5); ctx.lineTo(6, -6); ctx.lineTo(20, 0); ctx.lineTo(6, 6); ctx.lineTo(-14, 5);
        ctx.closePath(); ctx.fill();
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(-10, 0); ctx.lineTo(15, 0); ctx.stroke();
      } else if (p.kind === 'silver_prism_lance') {
        // Pip Skill & Ult Fan: Mirror-Silver Prism Flechettes!
        ctx.rotate(Math.atan2(p.vy, p.vx));
        const s = p.r / 12;
        ctx.shadowColor = '#b4e8ff';
        ctx.shadowBlur = 16;
        // Translucent icy-silver outer diamond
        ctx.fillStyle = 'rgba(180, 224, 255, 0.72)';
        ctx.beginPath();
        ctx.moveTo(-19 * s, 0); ctx.lineTo(-4 * s, -8.5 * s); ctx.lineTo(21 * s, 0); ctx.lineTo(-4 * s, 8.5 * s);
        ctx.closePath(); ctx.fill();
        // Brushed chrome inner blade
        const lg = ctx.createLinearGradient(0, -6 * s, 0, 6 * s);
        lg.addColorStop(0, '#ffffff');
        lg.addColorStop(0.5, '#d6e4f5');
        lg.addColorStop(1, '#8499b5');
        ctx.fillStyle = lg;
        ctx.beginPath();
        ctx.moveTo(-15 * s, 0); ctx.lineTo(-2 * s, -5.5 * s); ctx.lineTo(18 * s, 0); ctx.lineTo(-2 * s, 5.5 * s);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.moveTo(-10 * s, 0); ctx.lineTo(14 * s, 0); ctx.lineTo(-2 * s, -2.5 * s);
        ctx.closePath(); ctx.fill();
      } else if (p.kind === 'silver_railbeam' || p.kind === 'megabeam') {
        // Pip Ultimate Centerpiece: Liquid-Silver Chrome Railgun Hyper-Lance!
        ctx.rotate(Math.atan2(p.vy, p.vx));
        ctx.shadowColor = '#b8e8ff';
        ctx.shadowBlur = 24;
        const bg = ctx.createLinearGradient(0, -18, 0, 18);
        bg.addColorStop(0, '#8ba4c4');
        bg.addColorStop(0.25, '#e8f5ff');
        bg.addColorStop(0.5, '#ffffff');
        bg.addColorStop(0.75, '#c2d8f2');
        bg.addColorStop(1, '#7189ab');
        ctx.fillStyle = bg;
        ctx.beginPath();
        ctx.moveTo(-48, -12); ctx.lineTo(22, -16); ctx.lineTo(48, 0); ctx.lineTo(22, 16); ctx.lineTo(-48, 12);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#ffffff';
        SR.roundRect(ctx, -38, -6, 68, 12, 6); ctx.fill();
        // Kinetic chrome shockwave chevrons
        ctx.strokeStyle = 'rgba(220, 244, 255, 0.9)';
        ctx.lineWidth = 2.8;
        [-18, 4].forEach((cx) => {
          ctx.beginPath();
          ctx.moveTo(cx - 10, -22); ctx.lineTo(cx + 8, 0); ctx.lineTo(cx - 10, 22);
          ctx.stroke();
        });
      } else if (p.kind === 'elem_bolt') {
        // Luna: Fire Bolt 🔥, Ice Bolt ❄️, or Lightning Bolt ⚡!
        const ang = Math.atan2(p.vy, p.vx);
        const s = p.r / 10;
        if (p.element === 'fire') {
          ctx.rotate(ang);
          ctx.shadowColor = '#ff5a1f';
          ctx.shadowBlur = 18;
          const flick = Math.sin(time * 28 + p.x * 0.08) * 2.5 * s;
          // Outer blazing red-orange flame teardrop
          ctx.fillStyle = '#ff4b1f';
          ctx.beginPath();
          ctx.moveTo(-22 * s, flick * 0.6);
          ctx.quadraticCurveTo(-8 * s, -12 * s, 8 * s, -7 * s);
          ctx.quadraticCurveTo(16 * s, 0, 8 * s, 7 * s);
          ctx.quadraticCurveTo(-8 * s, 12 * s, -22 * s, flick * 0.6);
          ctx.closePath(); ctx.fill();
          // Golden-amber mid flame
          ctx.fillStyle = '#ffaa2b';
          ctx.beginPath();
          ctx.moveTo(-14 * s, flick * 0.3);
          ctx.quadraticCurveTo(-2 * s, -7 * s, 11 * s, 0);
          ctx.quadraticCurveTo(-2 * s, 7 * s, -14 * s, flick * 0.3);
          ctx.closePath(); ctx.fill();
          // White-hot flame core
          ctx.fillStyle = '#fff9d6';
          ctx.beginPath(); ctx.ellipse(2 * s, 0, 5.5 * s, 3.2 * s, 0, 0, Math.PI * 2); ctx.fill();
        } else if (p.element === 'ice') {
          ctx.rotate(ang);
          ctx.shadowColor = '#3cd8ff';
          ctx.shadowBlur = 18;
          // Outer jagged frost crystal icicle spear
          ctx.fillStyle = '#2bb8ff';
          ctx.beginPath();
          ctx.moveTo(-18 * s, 0);
          ctx.lineTo(-6 * s, -8.5 * s);
          ctx.lineTo(18 * s, 0);
          ctx.lineTo(-6 * s, 8.5 * s);
          ctx.closePath(); ctx.fill();
          // Bright crystalline cyan upper facet
          ctx.fillStyle = '#9ff2ff';
          ctx.beginPath();
          ctx.moveTo(-15 * s, 0);
          ctx.lineTo(-5 * s, -6 * s);
          ctx.lineTo(16 * s, 0);
          ctx.closePath(); ctx.fill();
          // Sparkling pure-white ice core + frost glint
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.moveTo(-10 * s, 0); ctx.lineTo(-3 * s, -2.8 * s); ctx.lineTo(12 * s, 0); ctx.lineTo(-3 * s, 2.8 * s);
          ctx.closePath(); ctx.fill();
          ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.moveTo(-6 * s, -10 * s); ctx.lineTo(-6 * s, 10 * s);
          ctx.stroke();
        } else {
          // Lightning Bolt ⚡: Dynamic crackling jagged thunderbolt!
          ctx.rotate(ang);
          ctx.shadowColor = '#ffe84d';
          ctx.shadowBlur = 20;
          const j1 = Math.sin(time * 42 + p.y * 0.1) * 3 * s;
          const j2 = Math.cos(time * 38 + p.x * 0.1) * 3 * s;
          // Outer glowing electric gold-cyan arc
          ctx.strokeStyle = '#ffdf38';
          ctx.lineWidth = 6.5 * s;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'miter';
          ctx.beginPath();
          ctx.moveTo(-19 * s, j1);
          ctx.lineTo(-7 * s, -7 * s + j2 * 0.5);
          ctx.lineTo(-1 * s, 5 * s - j1 * 0.4);
          ctx.lineTo(9 * s, -5 * s + j2 * 0.4);
          ctx.lineTo(19 * s, 0);
          ctx.stroke();
          // Blazing pure-white inner lightning filament
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 2.8 * s;
          ctx.stroke();
          // Electric tip spark star
          ctx.fillStyle = '#ffffff';
          SR.drawStar(ctx, 17 * s, 0, 4, 6 * s, 2.2 * s); ctx.fill();
        }
      } else if (p.kind === 'starburst') {
        ctx.rotate(time * 12);
        ctx.fillStyle = p.color; SR.drawStar(ctx, 0, 0, 4, p.r * 1.45, p.r * 0.55); ctx.fill();
        ctx.fillStyle = '#ffffff'; SR.drawStar(ctx, 0, 0, 4, p.r * 0.75, p.r * 0.3); ctx.fill();
      } else if (p.kind === 'wisp') {
        ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(0, 0, p.r, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#ffffff'; SR.drawStar(ctx, 0, 0, 4, p.r * 0.85, p.r * 0.3); ctx.fill();
      } else {
        ctx.rotate(Math.atan2(p.vy, p.vx));
        ctx.fillStyle = p.color; SR.roundRect(ctx, -p.r * 1.4, -p.r * 0.55, p.r * 2.8, p.r * 1.1, p.r * 0.5); ctx.fill();
        ctx.fillStyle = '#ffffff'; SR.roundRect(ctx, -p.r * 0.7, -p.r * 0.25, p.r * 1.6, p.r * 0.5, p.r * 0.25); ctx.fill();
      }
      ctx.restore();
    }

    for (const p of enemyProjs) {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.shadowColor = p.color; ctx.shadowBlur = 14;
      if (p.kind === 'wave') {
        ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(0, 6, p.r, Math.PI, 0); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(0, 6, p.r * 0.5, Math.PI, 0); ctx.closePath(); ctx.fill();
      } else if (p.kind === 'code' || p.kind === 'error_drop') {
        const w = p.kind === 'error_drop' ? 46 : 38;
        const h = p.kind === 'error_drop' ? 28 : 22;
        ctx.fillStyle = 'rgba(18, 28, 38, 0.92)';
        SR.roundRect(ctx, -w * 0.5, -h * 0.5, w, h, 6); ctx.fill();
        ctx.strokeStyle = p.color; ctx.lineWidth = 2; ctx.stroke();
        ctx.font = '800 11px Consolas, monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillStyle = p.color; ctx.fillText(p.label || '{ }', 0, 1);
      } else if (p.kind === 'scold') {
        ctx.fillStyle = '#fff5fb'; SR.roundRect(ctx, -34, -13, 68, 24, 10); ctx.fill();
        ctx.strokeStyle = '#ff7eb6'; ctx.lineWidth = 2; ctx.stroke();
        ctx.font = '800 11px "Microsoft JhengHei", "PingFang TC", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillStyle = '#5c1a48'; ctx.fillText(p.label || '不穿外套!', 0, -1);
      } else if (p.kind === 'shuttlecock') {
        ctx.rotate(Math.atan2(p.vy, p.vx));
        ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.moveTo(6, 0); ctx.lineTo(-12, -8); ctx.lineTo(-10, 0); ctx.lineTo(-12, 8); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#ff6b8b'; ctx.beginPath(); ctx.arc(6, 0, 4.5, 0, Math.PI * 2); ctx.fill();
      } else if (p.kind === 'tennis') {
        ctx.rotate(time * 12);
        ctx.fillStyle = '#c4ff6b'; ctx.beginPath(); ctx.arc(0, 0, p.r, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(-4, 0, p.r * 0.7, -0.9, 0.9); ctx.stroke();
      } else if (p.kind === 'basketball') {
        ctx.rotate(time * 9);
        ctx.fillStyle = '#ff8c42'; ctx.beginPath(); ctx.arc(0, 0, p.r, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#3d1e0d'; ctx.lineWidth = 1.8; ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-p.r, 0); ctx.lineTo(p.r, 0); ctx.moveTo(0, -p.r); ctx.lineTo(0, p.r); ctx.stroke();
      } else if (p.kind === 'bark_wave') {
        // Shiba's Sonic Bark Sound Wave (Triple expanding golden sound arcs!)
        ctx.rotate(Math.atan2(p.vy, p.vx));
        [0, -9, -18].forEach((ox, idx) => {
          ctx.strokeStyle = idx === 0 ? '#ffffff' : '#ffe58f';
          ctx.lineWidth = 4 - idx * 0.8;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.arc(ox, 0, p.r * (1.0 - idx * 0.2), -0.95, 0.95);
          ctx.stroke();
        });
      } else if (p.kind === 'dumbbell') {
        // Mika's Spinning Heavy Ballistic Dumbbell!
        ctx.rotate(time * 16);
        ctx.fillStyle = '#e0ecff'; ctx.fillRect(-10, -2.5, 20, 5);
        ctx.fillStyle = '#ff7eb6';
        SR.roundRect(ctx, -15, -9, 7, 18, 3); ctx.fill();
        SR.roundRect(ctx, 8, -9, 7, 18, 3); ctx.fill();
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5; ctx.stroke();
      } else if (p.kind === 'candlestick') {
        // Stock Trader's Red/Green K-Line Candlestick with upper & lower wicks!
        ctx.rotate(Math.atan2(p.vy, p.vx) + Math.PI * 0.5);
        ctx.strokeStyle = p.color; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.moveTo(0, -18); ctx.lineTo(0, 18); ctx.stroke();
        ctx.fillStyle = p.color;
        SR.roundRect(ctx, -6, -10, 12, 20, 2); ctx.fill();
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.2; ctx.stroke();
      } else if (p.kind === 'stock_order' || p.kind === 'stock_crash') {
        // Stock Trader's BUY/SELL order ticket or giant falling -10% Crash Arrow!
        const isCrash = p.kind === 'stock_crash';
        const w = isCrash ? 56 : 48;
        const h = isCrash ? 30 : 22;
        ctx.fillStyle = isCrash ? 'rgba(18, 32, 28, 0.94)' : 'rgba(24, 18, 46, 0.92)';
        SR.roundRect(ctx, -w * 0.5, -h * 0.5, w, h, 6); ctx.fill();
        ctx.strokeStyle = p.color; ctx.lineWidth = 2.2; ctx.stroke();
        if (isCrash) {
          ctx.fillStyle = p.color;
          ctx.beginPath(); ctx.moveTo(-10, h * 0.5); ctx.lineTo(10, h * 0.5); ctx.lineTo(0, h * 0.5 + 11); ctx.closePath(); ctx.fill();
        }
        ctx.font = '800 11px "Quicksand", Consolas, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillStyle = p.color; ctx.fillText(p.label || '-10%', 0, 1);
      } else if (p.kind === 'delivery_food' || p.kind === 'sky_food') {
        ctx.rotate(Math.sin(time * 9 + p.x * 0.04) * 0.35);
        drawDeliveryFood(ctx, p.foodType || 'boba', time);
      } else if (p.kind === 'sky_sport') {
        const sb = p.sportBall || 'basketball';
        if (sb === 'shuttlecock') {
          ctx.rotate(Math.atan2(p.vy, p.vx));
          ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.moveTo(6, 0); ctx.lineTo(-12, -8); ctx.lineTo(-10, 0); ctx.lineTo(-12, 8); ctx.closePath(); ctx.fill();
          ctx.fillStyle = '#ff6b8b'; ctx.beginPath(); ctx.arc(6, 0, 4.5, 0, Math.PI * 2); ctx.fill();
        } else if (sb === 'tennis') {
          ctx.rotate(time * 12);
          ctx.fillStyle = '#c4ff6b'; ctx.beginPath(); ctx.arc(0, 0, 10.5, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(-4, 0, 7, -0.9, 0.9); ctx.stroke();
        } else if (sb === 'volleyball') {
          ctx.rotate(time * 9);
          ctx.fillStyle = '#fff7d6'; ctx.beginPath(); ctx.arc(0, 0, 12.5, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = '#5e8bff'; ctx.lineWidth = 2.2;
          ctx.beginPath(); ctx.arc(0, 0, 12.5, -0.5, 1.3); ctx.moveTo(-11, -3); ctx.quadraticCurveTo(0, 4, 11, -3); ctx.stroke();
        } else {
          ctx.rotate(time * 9);
          ctx.fillStyle = '#ff8c42'; ctx.beginPath(); ctx.arc(0, 0, 13, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = '#3d1e0d'; ctx.lineWidth = 1.8; ctx.stroke();
          ctx.beginPath(); ctx.moveTo(-13, 0); ctx.lineTo(13, 0); ctx.moveTo(0, -13); ctx.lineTo(0, 13); ctx.stroke();
        }
      } else if (p.kind === 'mask' || p.kind === 'eraser' || p.kind === 'pencil' || p.kind === 'sky_sneeze') {
        const sk = p.kind === 'sky_sneeze' ? (p.itemType || 'tissue') : p.kind;
        if (sk === 'pencil') {
          ctx.rotate(Math.atan2(p.vy, p.vx));
          ctx.fillStyle = '#ffe07d'; ctx.fillRect(-12, -3, 20, 6);
          ctx.fillStyle = '#ff85b4'; ctx.fillRect(-15, -3, 4, 6);
          ctx.fillStyle = '#fff5e4'; ctx.beginPath(); ctx.moveTo(8, -3); ctx.lineTo(15, 0); ctx.lineTo(8, 3); ctx.closePath(); ctx.fill();
        } else if (sk === 'eraser') {
          ctx.rotate(time * 10);
          ctx.fillStyle = '#ffffff'; SR.roundRect(ctx, -9, -6, 18, 12, 2); ctx.fill();
          ctx.fillStyle = '#6ba8ff'; ctx.fillRect(-4, -6, 9, 12);
        } else if (sk === 'mask') {
          ctx.rotate(Math.sin(time * 10 + p.x * 0.04) * 0.3);
          ctx.fillStyle = '#e2f7ff'; SR.roundRect(ctx, -10, -7, 20, 14, 3); ctx.fill();
          ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.6;
          ctx.beginPath(); ctx.arc(-11, 0, 4, Math.PI * 0.5, Math.PI * 1.5); ctx.arc(11, 0, 4, -Math.PI * 0.5, Math.PI * 0.5); ctx.stroke();
        } else {
          ctx.rotate(Math.sin(time * 10 + p.x * 0.05) * 0.4);
          ctx.fillStyle = '#ffffff';
          ctx.beginPath(); ctx.moveTo(-12, -8); ctx.quadraticCurveTo(0, -13, 12, -6);
          ctx.quadraticCurveTo(9, 4, 13, 10); ctx.quadraticCurveTo(0, 6, -11, 10); ctx.closePath(); ctx.fill();
          ctx.strokeStyle = '#c8e4ff'; ctx.lineWidth = 1.5; ctx.stroke();
        }
      } else if (p.kind === 'sneeze') {
        ctx.rotate(Math.atan2(p.vy, p.vx));
        ctx.fillStyle = 'rgba(205, 248, 255, 0.85)';
        ctx.beginPath(); ctx.arc(0, 0, p.r, 0, Math.PI * 2); ctx.arc(-8, -4, p.r * 0.7, 0, Math.PI * 2); ctx.arc(-8, 4, p.r * 0.7, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(2, 0, p.r * 0.65, -0.9, 0.9); ctx.stroke();
      } else if (p.kind === 'tissue') {
        ctx.rotate(Math.sin(time * 10 + p.x * 0.05) * 0.4);
        ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.moveTo(-12, -8); ctx.quadraticCurveTo(0, -13, 12, -6); ctx.quadraticCurveTo(9, 4, 13, 10); ctx.quadraticCurveTo(0, 6, -11, 10); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = '#c8e4ff'; ctx.lineWidth = 1.5; ctx.stroke();
      } else if (p.kind === 'cat_junk') {
        ctx.rotate(time * 8.5);
        drawCatJunkItem(ctx, p.itemType);
      } else if (p.kind === 'boba') {
        ctx.rotate(Math.sin(time * 8) * 0.25);
        ctx.fillStyle = p.color; SR.roundRect(ctx, -8, -9, 16, 18, 4); ctx.fill();
        ctx.fillStyle = '#ffffff'; ctx.fillRect(-9, -11, 18, 4);
        ctx.fillStyle = '#ff7eb6'; ctx.fillRect(1, -18, 3, 9);
        ctx.fillStyle = '#2d1c14'; ctx.beginPath(); ctx.arc(-3, 4, 2, 0, Math.PI * 2); ctx.arc(3, 5, 2, 0, Math.PI * 2); ctx.fill();
      } else if (p.kind === 'meteor') {
        ctx.fillStyle = p.color; ctx.beginPath(); ctx.moveTo(0, -p.r * 2.5); ctx.lineTo(p.r, 0); ctx.arc(0, 0, p.r, 0, Math.PI); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(0, 0, p.r * 0.55, 0, Math.PI * 2); ctx.fill();
      } else if (p.kind === 'petal' || p.kind === 'bomb') {
        ctx.rotate(time * 7);
        ctx.fillStyle = p.color; SR.drawStar(ctx, 0, 0, 4, p.r * 1.35, p.r * 0.55); ctx.fill();
        ctx.fillStyle = '#fff5fe'; ctx.beginPath(); ctx.arc(0, 0, p.r * 0.45, 0, Math.PI * 2); ctx.fill();
      } else {
        ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(0, 0, p.r, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.stroke();
      }
      ctx.restore();
    }
  }

  function renderGame(ctx, game, W, H) {
    ctx.clearRect(0, 0, W, H);
    const wr = SR.WorldRenderer;
    const pal = wr.drawBackground(ctx, game.level, game.camX, game.time, W, H);
    SR.particles.drawAmbient(ctx);

    const minVisX = game.camX - 180;
    const maxVisX = game.camX + W + 180;

    ctx.save();
    ctx.translate(
      Math.round(-game.camX + game.shakeX),
      Math.round(-game.camY + game.shakeY)
    );

    wr.drawProps(ctx, game.level, game.time, minVisX, maxVisX);
    wr.drawTerrain(ctx, game.level, pal, game.time, minVisX, maxVisX);
    wr.drawCheckpointsAndPickups(ctx, game.level, game.time, minVisX, maxVisX);
    wr.drawArenaBarriers(ctx, game.activeArena, game.time);

    if (SR.weather) {
      SR.weather.draw(ctx, game.time);
    }

    for (const ai of SR.particles.afterimages) {
      drawCharacterSprite(ctx, ai.charId, {
        x: ai.x, y: ai.y, facing: ai.facing, sliding: ai.sliding,
        time: game.time, alpha: (ai.life / ai.maxLife) * 0.42
      });
    }

    for (const e of game.enemies) {
      if (e.dead) continue;
      if (!e.isBoss && (e.x + e.w < minVisX || e.x > maxVisX)) continue;
      drawEnemy(ctx, e, game.time);
    }

    if (game.player) {
      const p = game.player;
      drawPlayerCombatAuras(ctx, p, game.time);
      const blinkOut = p.invulnTimer > 0 && !p.sliding && !p.airSlicing && p.cycloneTimer <= 0 && Math.floor(game.time * 18) % 2 === 0;
      if (!blinkOut) {
        drawCharacterSprite(ctx, p.charId, {
          x: p.cx, y: p.y + p.h, facing: p.facing, sliding: p.sliding,
          airSlicing: p.airSlicing, aimUp: p.aimUp, runTime: p.runTime, attackAnim: p.attackAnim,
          squashX: p.squashX, squashY: p.squashY, time: game.time,
          ribbon: p.ribbon, flash: p.hitFlash > 0
        });
      }
    }

    drawProjectiles(ctx, game.playerProjectiles, game.enemyProjectiles, game.time);
    SR.particles.drawWorld(ctx);

    ctx.restore();
  }

  SR.renderGame = renderGame;
  SR.drawCharacterSprite = drawCharacterSprite;
})(window.SR);
