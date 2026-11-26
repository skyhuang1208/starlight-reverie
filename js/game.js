// Lean Game Orchestrator: State Machine, Dual Controls, Deadzone Camera, HUD & Stage Progression
// Delegates combat/projectiles to SR.Combat, world map art to SR.WorldRenderer, and entity rendering to SR.renderGame.
window.SR = window.SR || {};

(function (SR) {
  const W = SR.VIEW_W || 1200;
  const H = SR.VIEW_H || 680;

  class Game {
    constructor() {
      this.canvas = document.getElementById('game-canvas');
      this.ctx = this.canvas.getContext('2d');

      this.state = 'menu'; // 'menu' | 'instructions' | 'playing' | 'paused' | 'transition' | 'gameover' | 'victory'
      this.selectedChar = 'magic'; // Left = Luna (Beginner)
      this.selectedMapIndex = 0;
      this.hasSeenInstructions = false;
      this.cheats = { godMode: false, onePunch: false };
      // 2D Adventure Map Node Coordinates (560x356 Fantasy Continent & Volcanic Isle!)
      this.mapNodes = [
        { x: 118, y: 266, idx: 0 }, // Bottom-Left: Dreamlight Meadow
        { x: 158, y: 112, idx: 1 }, // Upper-Left: Whispering Cloudspire
        { x: 294, y: 186, idx: 2 }, // Center: Velvet Dusk Woods
        { x: 434, y: 98,  idx: 3 }, // Upper-Right: Frostmoon Citadel
        { x: 448, y: 264, idx: 4 }  // Bottom-Right Isle: Crimson Dream-Hell
      ];
      this.hoveredMapIndex = -1;
      this.time = 0;
      this.runDuration = 0;
      this.transitionTimer = 0;
      this.transitionDuration = 3.5;

      this.level = SR.createLevel(0);
      this.player = null;
      this.enemies = [];
      this.playerProjectiles = [];
      this.enemyProjectiles = [];
      this.activeArena = null;
      this.activeBoss = null;

      this.camX = 0;
      this.camY = 0;
      this.camLookahead = 0;
      this.shakeMag = 0;
      this.shakeX = 0;
      this.shakeY = 0;
      this.hitstop = 0;

      this.score = 0;
      this.combo = 0;
      this.comboTimer = 0;
      this.kills = 0;
      this.currentTerritoryId = '';
      this.bannerTimer = 0;
      this.spawnPoint = { x: 90, y: 560 };

      this.input = this.createEmptyInput();

      this.bindUI();
      this.bindInputs();
      this.lastFrame = performance.now();
      requestAnimationFrame((ts) => this.loop(ts));
    }

    createEmptyInput() {
      return {
        left: false, right: false, up: false, down: false,
        jumpHeld: false, jumpPressed: false,
        downPressed: false, slidePressed: false, slideHeld: false,
        attackHeld: false, skillPressed: false, ultimatePressed: false
      };
    }

    clearInputs() {
      this.input = this.createEmptyInput();
    }

    bindUI() {
      const $ = (id) => document.getElementById(id);
      this.el = {
        hud: $('hud'),
        actionBar: $('action-bar'),
        controlsBar: $('controls-bar'),
        menuOverlay: $('menu-overlay'),
        instructionOverlay: $('instruction-overlay'),
        pauseOverlay: $('pause-overlay'),
        transitionOverlay: $('transition-overlay'),
        gameoverOverlay: $('gameover-overlay'),
        victoryOverlay: $('victory-overlay'),
        worldMapCanvas: $('world-map-canvas'),
        mapCaption: $('map-selected-caption'),
        cheatGod: $('cheat-god'),
        cheatOnePunch: $('cheat-onepunch'),
        hudCheatsActive: $('hud-cheats-active'),
        transCountdown: $('trans-countdown'),
        transBarFill: $('trans-bar-fill'),
        charName: $('hud-char-name'),
        charRole: $('hud-char-role'),
        stagePill: $('hud-stage-pill'),
        hearts: $('hud-hearts'),
        slotBasic: $('slot-basic'),
        slotSkill: $('slot-skill'),
        slotSkillMask: $('slot-skill-mask'),
        slotSkillCd: $('slot-skill-cd'),
        slotUlt: $('slot-ult'),
        slotUltMask: $('slot-ult-mask'),
        slotUltCd: $('slot-ult-cd'),
        slotBasicIcon: $('slot-basic-icon'),
        slotSkillIcon: $('slot-skill-icon'),
        slotUltIcon: $('slot-ult-icon'),
        slotSkillName: $('slot-skill-name'),
        slotUltName: $('slot-ult-name'),
        score: $('hud-score'),
        comboWrap: $('hud-combo-wrap'),
        combo: $('hud-combo'),
        territoryBanner: $('territory-banner'),
        territoryName: $('territory-name'),
        territorySub: $('territory-sub'),
        bossBarWrap: $('boss-bar-wrap'),
        bossName: $('boss-name'),
        bossPhaseTag: $('boss-phase-tag'),
        bossHpFill: $('boss-hp-fill'),
        checkpointTag: $('hud-checkpoint-tag'),
        progressFill: $('stage-progress-fill'),
        portrait: $('hud-portrait'),
        btnMute: $('btn-mute'),
        btnNextStage: $('btn-next-stage')
      };

      // Character cards
      const cards = document.querySelectorAll('.char-card');
      cards.forEach((card) => {
        card.addEventListener('click', () => {
          cards.forEach((c) => c.classList.remove('selected'));
          card.classList.add('selected');
          this.selectedChar = card.dataset.char;
          SR.audio.pickup(false);
        });
      });

      // 金手指區
      if (this.el.cheatGod) {
        this.el.cheatGod.addEventListener('change', () => {
          this.cheats.godMode = this.el.cheatGod.checked;
          SR.audio.pickup(this.cheats.godMode);
        });
      }
      if (this.el.cheatOnePunch) {
        this.el.cheatOnePunch.addEventListener('change', () => {
          this.cheats.onePunch = this.el.cheatOnePunch.checked;
          SR.audio.pickup(this.cheats.onePunch);
        });
      }

      // Interactive Dreamland Island World Map
      if (this.el.worldMapCanvas) {
        const mapCvs = this.el.worldMapCanvas;
        const getMapPt = (ev) => {
          const rect = mapCvs.getBoundingClientRect();
          return {
            x: ((ev.clientX - rect.left) / rect.width) * mapCvs.width,
            y: ((ev.clientY - rect.top) / rect.height) * mapCvs.height
          };
        };
        mapCvs.addEventListener('mousemove', (ev) => {
          const pt = getMapPt(ev);
          let found = -1;
          for (const nd of this.mapNodes) {
            if (Math.hypot(pt.x - nd.x, pt.y - nd.y) < 42) { found = nd.idx; break; }
          }
          this.hoveredMapIndex = found;
        });
        mapCvs.addEventListener('mouseleave', () => { this.hoveredMapIndex = -1; });
        mapCvs.addEventListener('click', (ev) => {
          const pt = getMapPt(ev);
          let bestIdx = this.selectedMapIndex;
          let bestDist = 85;
          for (const nd of this.mapNodes) {
            const d = Math.hypot(pt.x - nd.x, pt.y - nd.y);
            if (d < bestDist) { bestDist = d; bestIdx = nd.idx; }
          }
          this.selectMap(bestIdx);
        });
      }
      // Quick stage dot buttons in Adventure Dossier
      document.querySelectorAll('.stage-dot-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          this.selectMap(parseInt(btn.dataset.map, 10) || 0);
        });
      });

      this.syncMapSelectorUI();

      // Buttons
      $('btn-start').addEventListener('click', () => this.enterFromMenu());
      const btnInstrGo = $('btn-instr-go');
      if (btnInstrGo) btnInstrGo.addEventListener('click', () => this.finishInstructionsAndStart());

      $('btn-pause').addEventListener('click', () => this.togglePause());
      $('btn-resume').addEventListener('click', () => this.togglePause());
      $('btn-restart-cp').addEventListener('click', () => {
        this.el.pauseOverlay.classList.add('hidden');
        this.startNewGame(this.selectedChar, true, this.selectedMapIndex);
      });
      $('btn-back-menu').addEventListener('click', () => this.returnToMenu());

      $('btn-retry-cp').addEventListener('click', () => this.startNewGame(this.selectedChar, true, this.selectedMapIndex));
      $('btn-retry-full').addEventListener('click', () => this.startNewGame(this.selectedChar, false, this.selectedMapIndex));
      $('btn-gameover-menu').addEventListener('click', () => this.returnToMenu());

      this.el.btnNextStage.addEventListener('click', () => this.advanceToNextStage());
      $('btn-trans-now').addEventListener('click', () => this.advanceToNextStage());
      $('btn-trans-menu').addEventListener('click', () => this.returnToMenu());
      $('btn-play-again').addEventListener('click', () => this.startNewGame(this.selectedChar, false, this.selectedMapIndex));
      $('btn-victory-menu').addEventListener('click', () => this.returnToMenu());

      this.el.btnMute.addEventListener('click', () => {
        const muted = SR.audio.toggleMute();
        this.el.btnMute.textContent = muted ? '🔇' : '🔊';
      });

      // Clickable circular action slots
      if (this.el.slotBasic) {
        this.el.slotBasic.addEventListener('mousedown', (e) => { e.stopPropagation(); if (this.state === 'playing') this.input.attackHeld = true; });
        this.el.slotBasic.addEventListener('mouseup', () => { this.input.attackHeld = false; });
      }
      if (this.el.slotSkill) {
        this.el.slotSkill.addEventListener('click', (e) => { e.stopPropagation(); if (this.state === 'playing') this.input.skillPressed = true; });
      }
      if (this.el.slotUlt) {
        this.el.slotUlt.addEventListener('click', (e) => { e.stopPropagation(); if (this.state === 'playing') this.input.ultimatePressed = true; });
      }
    }

    selectMap(idx) {
      this.selectedMapIndex = SR.clamp(idx, 0, SR.MAPS.length - 1);
      this.level = SR.createLevel(this.selectedMapIndex);
      this.camX = 0;
      this.syncMapSelectorUI();
      SR.audio.pickup(false);
    }

    enterFromMenu() {
      SR.audio.init();
      if (!this.hasSeenInstructions && this.el.instructionOverlay) {
        this.state = 'instructions';
        this.el.menuOverlay.classList.add('hidden');
        this.el.instructionOverlay.classList.remove('hidden');
      } else {
        this.startNewGame(this.selectedChar, false, this.selectedMapIndex);
      }
    }

    finishInstructionsAndStart() {
      this.hasSeenInstructions = true;
      if (this.el.instructionOverlay) this.el.instructionOverlay.classList.add('hidden');
      this.startNewGame(this.selectedChar, false, this.selectedMapIndex);
    }

    syncMapSelectorUI() {
      const m = SR.MAPS[this.selectedMapIndex];
      if (!m) return;
      if (this.el.mapCaption) {
        this.el.mapCaption.textContent = `Stage ${m.index + 1} · ${m.name} (${m.zh}) — Mid: ${m.midBossTitle} · Boss: ${m.bossTitle}`;
      }
      const setTxt = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
      setTxt('dossier-stage-tag', `STAGE ${m.index + 1} / 5`);
      setTxt('dossier-stars', m.stars);
      setTxt('dossier-title', m.name);
      setTxt('dossier-zh', `${m.zh} · 點選左側冒險地圖切換關卡`);
      setTxt('dossier-midboss', m.midBossTitle);
      setTxt('dossier-finalboss', m.bossTitle);
      document.querySelectorAll('.stage-dot-btn').forEach((btn) => {
        btn.classList.toggle('active', parseInt(btn.dataset.map, 10) === this.selectedMapIndex);
      });
    }

    bindInputs() {
      window.addEventListener('blur', () => this.clearInputs());

      window.addEventListener('keydown', (e) => {
        const code = e.code;
        if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(code)) {
          e.preventDefault();
        }
        if (this.state === 'menu') {
          if (code === 'ArrowLeft' || code === 'KeyA') this.cycleChar(-1);
          if (code === 'ArrowRight' || code === 'KeyD') this.cycleChar(1);
          if (code === 'Enter' || code === 'Space') this.enterFromMenu();
          return;
        }
        if (this.state === 'instructions') {
          if (code === 'Enter' || code === 'Space') this.finishInstructionsAndStart();
          return;
        }
        if (this.state === 'transition') {
          if (code === 'Enter' || code === 'Space') this.advanceToNextStage();
          return;
        }
        if (code === 'Escape' || code === 'KeyP') {
          if (this.state === 'playing' || this.state === 'paused') this.togglePause();
          return;
        }
        if (code === 'KeyM') {
          const muted = SR.audio.toggleMute();
          this.el.btnMute.textContent = muted ? '🔇' : '🔊';
          return;
        }
        if (this.state !== 'playing') return;

        // Dual Non-Colliding Control Styles:
        // Style A: WASD + Space + LMB (Attack) + RMB (Skill) + Q (Ultimate)
        // Style B: Arrows + Space + 1 (Attack) + 2 (Skill) + 3 (Ultimate)
        if (code === 'ArrowLeft' || code === 'KeyA') this.input.left = true;
        if (code === 'ArrowRight' || code === 'KeyD') this.input.right = true;
        if (code === 'ArrowDown' || code === 'KeyS') {
          if (!this.input.down) this.input.downPressed = true;
          this.input.down = true;
        }
        if (code === 'ArrowUp' || code === 'KeyW') {
          this.input.up = true;
          // For Shooter (Pip), Up/W aims upward without forcing an involuntary jump (Space jumps!)
          if (!(this.player && this.player.charId === 'gun')) {
            if (!this.input.jumpHeld) this.input.jumpPressed = true;
            this.input.jumpHeld = true;
          }
        }
        if (code === 'Space') {
          if (!this.input.jumpHeld) this.input.jumpPressed = true;
          this.input.jumpHeld = true;
        }
        if (code === 'ShiftLeft' || code === 'ShiftRight') {
          if (!this.input.slideHeld) this.input.slidePressed = true;
          this.input.slideHeld = true;
        }
        if (code === 'Digit1' || code === 'Numpad1') this.input.attackHeld = true;
        if (code === 'Digit2' || code === 'Numpad2') this.input.skillPressed = true;
        if (code === 'Digit3' || code === 'Numpad3' || code === 'KeyQ') this.input.ultimatePressed = true;
      });

      window.addEventListener('keyup', (e) => {
        const code = e.code;
        if (code === 'ArrowLeft' || code === 'KeyA') this.input.left = false;
        if (code === 'ArrowRight' || code === 'KeyD') this.input.right = false;
        if (code === 'ArrowDown' || code === 'KeyS') this.input.down = false;
        if (code === 'ArrowUp' || code === 'KeyW') {
          this.input.up = false;
          if (!(this.player && this.player.charId === 'gun')) this.input.jumpHeld = false;
        }
        if (code === 'Space') this.input.jumpHeld = false;
        if (code === 'ShiftLeft' || code === 'ShiftRight') this.input.slideHeld = false;
        if (code === 'Digit1' || code === 'Numpad1') this.input.attackHeld = false;
      });

      this.canvas.addEventListener('mousedown', (e) => {
        if (this.state !== 'playing') return;
        SR.audio.init();
        if (e.button === 0) this.input.attackHeld = true;
        if (e.button === 2) this.input.skillPressed = true;
      });

      window.addEventListener('mouseup', (e) => {
        if (e.button === 0) this.input.attackHeld = false;
      });

      this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    }

    cycleChar(dir) {
      const order = ['magic', 'gun', 'blade'];
      const idx = (order.indexOf(this.selectedChar) + dir + order.length) % order.length;
      this.selectedChar = order[idx];
      document.querySelectorAll('.char-card').forEach((c) => {
        c.classList.toggle('selected', c.dataset.char === this.selectedChar);
      });
      SR.audio.pickup(false);
    }

    getMapBgmMode() {
      return (this.level && this.level.meta && this.level.meta.id) || 'meadow';
    }

    getBossBgmMode() {
      return (this.level && this.level.meta && this.level.meta.id === 'hell') ? 'hell_boss' : 'boss';
    }

    advanceToNextStage() {
      const nextIdx = Math.min(SR.MAPS.length - 1, this.selectedMapIndex + 1);
      this.selectedMapIndex = nextIdx;
      this.syncMapSelectorUI();
      this.startNewGame(this.selectedChar, false, nextIdx, true);
    }

    startNewGame(charId, fromCheckpoint = false, mapIndex = this.selectedMapIndex, keepCampaignScore = false) {
      SR.audio.init();
      SR.particles.clearCombat();
      this.clearInputs();

      this.selectedMapIndex = mapIndex;
      const freshLevel = SR.createLevel(mapIndex);
      const prevSpawn = fromCheckpoint ? { ...this.spawnPoint } : { ...freshLevel.spawn };
      const prevCpIds = fromCheckpoint
        ? this.level.checkpoints.filter((c) => c.activated).map((c) => c.id)
        : [];
      const midBossAlreadyDone = fromCheckpoint && this.level.bossArenas.midboss && this.level.bossArenas.midboss.defeated;

      this.level = freshLevel;
      SR.audio.setBgmMode(this.getMapBgmMode());
      for (const cp of this.level.checkpoints) {
        if (prevCpIds.includes(cp.id)) cp.activated = true;
      }
      if (midBossAlreadyDone && this.level.bossArenas.midboss) {
        this.level.bossArenas.midboss.defeated = true;
      }
      if (SR.weather) SR.weather.reset(this.level.meta);

      this.spawnPoint = prevSpawn;
      this.player = new SR.Player(charId, this.spawnPoint.x, this.spawnPoint.y);

      this.enemies = this.level.enemySpawns
        .filter((sp) => !fromCheckpoint || sp.x >= this.spawnPoint.x - 160)
        .map((sp) => new SR.Enemy(sp, this.level.meta));

      this.playerProjectiles = [];
      this.enemyProjectiles = [];
      this.activeArena = null;
      this.activeBoss = null;

      if (!fromCheckpoint && !keepCampaignScore) {
        this.score = 0;
        this.kills = 0;
        this.runDuration = 0;
      }
      if (!fromCheckpoint) {
        this.el.checkpointTag.classList.add('hidden');
      }
      this.combo = 0;
      this.comboTimer = 0;
      this.currentTerritoryId = '';
      this.camLookahead = 30;
      this.camX = SR.clamp(this.player.x - W * 0.42, 0, this.level.width - W);
      this.camY = 0;

      this.state = 'playing';
      this.el.menuOverlay.classList.add('hidden');
      this.el.pauseOverlay.classList.add('hidden');
      if (this.el.transitionOverlay) this.el.transitionOverlay.classList.add('hidden');
      this.el.gameoverOverlay.classList.add('hidden');
      this.el.victoryOverlay.classList.add('hidden');
      this.el.hud.classList.remove('hidden');
      if (this.el.actionBar) this.el.actionBar.classList.remove('hidden');
      this.el.controlsBar.classList.remove('hidden');
      this.el.bossBarWrap.classList.add('hidden');

      this.el.charName.textContent = this.player.def.name;
      this.el.charRole.textContent = this.player.def.role;
      this.el.stagePill.textContent = `Stage ${mapIndex + 1}/5`;
      if (this.el.hudCheatsActive) {
        const tags = [];
        if (this.cheats.godMode) tags.push('<span class="cheat-badge-pill">無敵</span>');
        if (this.cheats.onePunch) tags.push('<span class="cheat-badge-pill">一拳必殺</span>');
        this.el.hudCheatsActive.innerHTML = tags.join('');
        this.el.hudCheatsActive.classList.toggle('hidden', tags.length === 0);
      }
      this.syncActionBarLabels();
      this.drawHudPortrait();
      this.updateHud();
      this.checkTerritoryBanner();
    }

    syncActionBarLabels() {
      if (!this.player || !this.el.slotBasicIcon) return;
      const meta = this.player.def.actionIcons;
      this.el.slotBasicIcon.textContent = meta.b;
      this.el.slotSkillIcon.textContent = meta.s;
      this.el.slotSkillName.textContent = meta.sName;
      this.el.slotUltIcon.textContent = meta.u;
      this.el.slotUltName.textContent = meta.uName;
    }

    returnToMenu() {
      this.clearInputs();
      this.state = 'menu';
      SR.audio.stopBgm();
      this.syncMapSelectorUI();
      this.el.hud.classList.add('hidden');
      if (this.el.actionBar) this.el.actionBar.classList.add('hidden');
      this.el.controlsBar.classList.add('hidden');
      this.el.pauseOverlay.classList.add('hidden');
      if (this.el.transitionOverlay) this.el.transitionOverlay.classList.add('hidden');
      this.el.gameoverOverlay.classList.add('hidden');
      this.el.victoryOverlay.classList.add('hidden');
      this.el.menuOverlay.classList.remove('hidden');
    }

    togglePause() {
      if (this.state === 'playing') {
        this.clearInputs();
        this.state = 'paused';
        this.el.pauseOverlay.classList.remove('hidden');
      } else if (this.state === 'paused') {
        this.state = 'playing';
        this.el.pauseOverlay.classList.add('hidden');
      }
    }

    addShake(mag) {
      this.shakeMag = Math.min(3.0, Math.max(this.shakeMag, mag * 0.35));
    }

    registerHitCombo() {
      this.combo++;
      this.comboTimer = 3.2;
    }

    applyPlayerMelee(hitbox, dmg, facing, isHeavy) {
      return SR.Combat.applyPlayerMelee(this, hitbox, dmg, facing, isHeavy);
    }

    onEnemyKilled(e) {
      this.kills++;
      this.score += e.score + this.combo * 15;
      SR.audio.enemyDefeat();
      SR.particles.spawnBurst(e.cx, e.cy, ['#ff9fd6', '#ffe58f', '#9cf5e3', '#ffffff'], 16, {
        speedMin: 80, speedMax: 240, size: 4.5, shape: 'star'
      });
      SR.particles.spawnRing(e.cx, e.cy, '#ffe58f', 48, 0.3);
      if (this.player && this.player.hp < this.player.maxHp && Math.random() < 0.32) {
        this.level.pickups.push({
          id: 9000 + this.kills, x: e.cx, y: e.cy,
          kind: 'heart', collected: false, bobPhase: 0
        });
      }
    }

    onBossDefeated(boss) {
      this.kills++;
      this.score += boss.score;
      this.enemyProjectiles = [];
      this.hitstop = this.cheats.onePunch ? 0.02 : 0.05;
      this.addShake(6);
      SR.particles.spawnBurst(boss.cx, boss.cy, ['#ffe58f', '#ff9fd6', '#9cf5e3', '#ffffff'], 42, {
        speedMin: 90, speedMax: 350, size: 6, shape: 'star', life: 0.9
      });
      SR.particles.spawnRing(boss.cx, boss.cy, '#ffe58f', 210, 0.6);

      boss.arena.defeated = true;
      boss.arena.active = false;
      this.activeArena = null;
      this.activeBoss = null;
      this.el.bossBarWrap.classList.add('hidden');
      SR.audio.setBgmMode(this.getMapBgmMode());

      if (boss.arena.id === 'midboss') {
        SR.audio.checkpoint();
        SR.particles.spawnText(boss.cx, boss.cy - 20, '✦ GUARDIAN CLEARED! ✦', '#9cf5e3', 1.45);
        this.level.pickups.push({
          id: 9991, x: boss.cx, y: 550, kind: 'heart', collected: false, bobPhase: 0
        });
      } else if (boss.arena.id === 'finalboss') {
        SR.audio.victory();
        setTimeout(() => {
          if (this.selectedMapIndex < SR.MAPS.length - 1) {
            this.showStageTransition();
          } else {
            this.showVictory();
          }
        }, 900);
      }
    }

    showStageTransition() {
      if (this.state === 'transition' || this.state === 'menu') return;
      this.clearInputs();
      this.state = 'transition';
      this.transitionTimer = this.transitionDuration;
      const meta = this.level.meta;
      const nextMeta = SR.MAPS[this.selectedMapIndex + 1];

      document.getElementById('trans-eyebrow').textContent = `✦ STAGE ${this.selectedMapIndex + 1} / 5 CLEARED ✦`;
      document.getElementById('trans-title').textContent = `${meta.name} Cleared!`;
      const stars = this.score >= 3800 && this.player.hp >= 4 ? '★★★' : (this.score >= 2200 ? '★★☆' : '★☆☆');
      document.getElementById('trans-rank').textContent = stars;
      document.getElementById('trans-stats').innerHTML = `
        <div class="result-stat-box"><span>Total Score</span><strong>${this.score}</strong></div>
        <div class="result-stat-box"><span>Defeated</span><strong>${this.kills}</strong></div>
        <div class="result-stat-box"><span>Time</span><strong>${Math.floor(this.runDuration)}s</strong></div>
      `;
      document.getElementById('trans-next-name').textContent = `Stage ${this.selectedMapIndex + 2} · ${nextMeta.name}`;
      document.getElementById('trans-next-sub').textContent = `${nextMeta.zh} · ${nextMeta.stars} · Boss: ${nextMeta.bossTitle}`;
      if (this.el.transCountdown) this.el.transCountdown.textContent = this.transitionDuration.toFixed(1);
      if (this.el.transBarFill) this.el.transBarFill.style.width = '0%';
      if (this.el.transitionOverlay) this.el.transitionOverlay.classList.remove('hidden');
    }

    showGameOver() {
      this.clearInputs();
      this.state = 'gameover';
      SR.audio.setBgmMode(this.getMapBgmMode());
      document.getElementById('gameover-stats').innerHTML = `
        <div class="result-stat-box"><span>Score</span><strong>${this.score}</strong></div>
        <div class="result-stat-box"><span>Defeated</span><strong>${this.kills}</strong></div>
        <div class="result-stat-box"><span>Time</span><strong>${Math.floor(this.runDuration)}s</strong></div>
      `;
      this.el.gameoverOverlay.classList.remove('hidden');
    }

    showVictory() {
      if (this.state === 'victory') return;
      this.clearInputs();
      this.state = 'victory';
      const isFinalMap = this.selectedMapIndex >= SR.MAPS.length - 1;
      const meta = this.level.meta;
      document.getElementById('victory-eyebrow').textContent = isFinalMap
        ? '✦ ALL 5 REALMS CONQUERED ✦'
        : `✦ STAGE ${this.selectedMapIndex + 1} / 5 CLEARED ✦`;
      document.getElementById('victory-title').textContent = isFinalMap
        ? 'Dreamland Grand Champion!'
        : `${meta.name} Cleared!`;
      document.getElementById('victory-sub').textContent = isFinalMap
        ? 'You overcame Malakor, Mika, and every challenger across all 5 dreamland realms!'
        : `${meta.bossTitle} fell! Advance to Stage ${this.selectedMapIndex + 2}: ${SR.MAPS[this.selectedMapIndex + 1].name} (${SR.MAPS[this.selectedMapIndex + 1].zh}).`;

      this.el.btnNextStage.classList.toggle('hidden', isFinalMap);
      if (!isFinalMap) {
        this.el.btnNextStage.textContent = `Enter Stage ${this.selectedMapIndex + 2}: ${SR.MAPS[this.selectedMapIndex + 1].name} ✦`;
      }

      const stars = this.score >= 4500 && this.player.hp >= 4 ? '★★★' : (this.score >= 3000 ? '★★☆' : '★☆☆');
      document.getElementById('victory-rank').textContent = stars;
      document.getElementById('victory-stats').innerHTML = `
        <div class="result-stat-box"><span>Stage Score</span><strong>${this.score}</strong></div>
        <div class="result-stat-box"><span>Enemies</span><strong>${this.kills}</strong></div>
        <div class="result-stat-box"><span>Clear Time</span><strong>${Math.floor(this.runDuration)}s</strong></div>
      `;
      this.el.victoryOverlay.classList.remove('hidden');
    }

    checkTerritoryBanner() {
      if (!this.player) return;
      const t = this.level.getTerritoryAt(this.player.cx);
      if (t.id !== this.currentTerritoryId) {
        this.currentTerritoryId = t.id;
        this.el.territoryName.textContent = `Stage ${this.selectedMapIndex + 1} · ${t.name}`;
        this.el.territorySub.textContent = t.sub;
        this.el.territoryBanner.classList.add('visible');
        this.bannerTimer = 3.2;
      }
    }

    updateMovingPlatforms(dt) {
      for (const mp of this.level.movingPlatforms) {
        const prevX = mp.x;
        const prevY = mp.y;
        mp.phase += dt * mp.speed;
        const t = (Math.sin(mp.phase) + 1) * 0.5;
        mp.x = mp.startX + (mp.endX - mp.startX) * t;
        mp.y = mp.startY + (mp.endY - mp.startY) * t;
        mp.dx = mp.x - prevX;
        mp.dy = mp.y - prevY;
      }
    }

    updateTriggersAndPickups() {
      const p = this.player;
      for (const cp of this.level.checkpoints) {
        if (!cp.activated && Math.abs(p.cx - cp.x) < 42 && Math.abs(p.y + p.h - cp.y) < 70) {
          cp.activated = true;
          this.spawnPoint = { x: cp.x, y: cp.y };
          SR.audio.checkpoint();
          SR.particles.spawnRing(cp.x, cp.y - 36, '#9cf5e3', 75, 0.45);
          SR.particles.spawnText(cp.x, cp.y - 68, `✦ ${cp.label} ✦`, '#9cf5e3', 1.25);
          this.el.checkpointTag.textContent = `✦ Checkpoint: ${cp.label}`;
          this.el.checkpointTag.classList.remove('hidden');
        }
      }

      for (const pk of this.level.pickups) {
        if (pk.collected) continue;
        if (Math.hypot(p.cx - pk.x, p.cy - pk.y) < 34) {
          pk.collected = true;
          if (pk.kind === 'heart') {
            p.hp = Math.min(p.maxHp, p.hp + 2);
            SR.audio.pickup(true);
            SR.particles.spawnBurst(pk.x, pk.y, ['#ff86c0', '#ffffff'], 12, { speedMin: 50, speedMax: 140, shape: 'star' });
            SR.particles.spawnText(pk.x, pk.y - 12, '+2 HP ♥', '#ff9fd6', 1.15);
          } else {
            this.score += 75;
            SR.audio.pickup(false);
            SR.particles.spawnBurst(pk.x, pk.y, ['#ffe58f', '#ffffff'], 8, { speedMin: 40, speedMax: 120, shape: 'star' });
            SR.particles.spawnText(pk.x, pk.y - 10, '+75 ✦', '#ffe694', 0.95);
          }
        }
      }

      const { midboss, finalboss } = this.level.bossArenas;
      if (midboss && !midboss.defeated && !midboss.active && p.cx >= midboss.triggerX) {
        this.activateBossArena(midboss);
      }
      if (finalboss && !finalboss.defeated && !finalboss.active && p.cx >= finalboss.triggerX) {
        this.activateBossArena(finalboss);
      }
    }

    activateBossArena(arena) {
      arena.active = true;
      this.activeArena = arena;
      if (arena.bossClass === 'golem') this.activeBoss = new SR.MidBoss(arena);
      else if (arena.bossClass === 'human') this.activeBoss = new SR.HumanBoss(arena);
      else this.activeBoss = new SR.FinalBoss(arena);
      this.enemies.push(this.activeBoss);
      this.el.bossBarWrap.classList.remove('hidden');
      this.el.bossName.textContent = arena.name;
      SR.audio.bossAlert();
      SR.audio.setBgmMode(this.getBossBgmMode());
    }

    update(dt) {
      this.time += dt;

      if (this.state === 'menu' || this.state === 'instructions') {
        this.camX = (this.time * 28) % Math.max(800, this.level.width - W);
        SR.particles.update(dt, 28);
        if (this.state === 'menu') {
          this.renderMenuPreviews();
          SR.WorldRenderer.renderWorldMap(
            this.el.worldMapCanvas, this.mapNodes, this.selectedMapIndex, this.hoveredMapIndex, this.time
          );
        }
        return;
      }

      if (this.state === 'transition') {
        SR.particles.update(dt, 0);
        this.transitionTimer -= dt;
        const pct = SR.clamp(((this.transitionDuration - this.transitionTimer) / this.transitionDuration) * 100, 0, 100);
        if (this.el.transCountdown) this.el.transCountdown.textContent = Math.max(0, this.transitionTimer).toFixed(1);
        if (this.el.transBarFill) this.el.transBarFill.style.width = `${pct}%`;
        if (this.transitionTimer <= 0) this.advanceToNextStage();
        return;
      }

      if (this.state !== 'playing') return;

      if (this.hitstop > 0) {
        this.hitstop -= dt;
        this.updateHud();
        return;
      }

      this.runDuration += dt;
      if (this.comboTimer > 0) {
        this.comboTimer -= dt;
        if (this.comboTimer <= 0) this.combo = 0;
      }
      if (this.bannerTimer > 0) {
        this.bannerTimer -= dt;
        if (this.bannerTimer <= 0) this.el.territoryBanner.classList.remove('visible');
      }

      this.updateMovingPlatforms(dt);
      this.player.update(dt, this.input, this.level, this);

      this.input.jumpPressed = false;
      this.input.downPressed = false;
      this.input.slidePressed = false;
      this.input.skillPressed = false;
      this.input.ultimatePressed = false;

      for (const e of this.enemies) {
        if (e.dead) continue;
        e.update(dt, this.player, this.level, this);
        const contactBox = { x: e.x + 5, y: e.y + 5, w: e.w - 10, h: e.h - 10 };
        if (SR.aabb(contactBox, this.player)) {
          const dmgSource = SR.Combat.isEnemyDashing(e) ? 'dash' : 'contact';
          this.player.takeDamage(1, this.player.cx >= e.cx ? 1 : -1, this, false, dmgSource);
        }
      }

      SR.Combat.updatePlayerProjectiles(this, dt);
      SR.Combat.updateEnemyProjectiles(this, dt);
      this.updateTriggersAndPickups();
      this.checkTerritoryBanner();

      if (SR.weather) {
        SR.weather.update(dt, this.player, this.level, this.camX, W, this);
      }

      this.updateCamera(dt);
      SR.particles.update(dt, this.lastCamVx || 0);
      this.updateHud();

      if (this.player.hp <= 0) {
        this.showGameOver();
      }
    }

    updateCamera(dt) {
      const prevCamX = this.camX;
      let targetCamX = this.camX;
      if (this.activeArena) {
        const arenaCenter = (this.activeArena.minX + this.activeArena.maxX) * 0.5;
        targetCamX = arenaCenter - W * 0.5;
      } else {
        if (Math.abs(this.player.vx) > 140) {
          const desiredLook = (this.player.vx > 0 ? 1 : -1) * 42;
          this.camLookahead += (desiredLook - this.camLookahead) * Math.min(1, dt * 1.8);
        }
        const focusX = this.camX + W * 0.44 - this.camLookahead;
        const deadzone = 70;
        const delta = this.player.cx - focusX;
        if (Math.abs(delta) > deadzone) {
          targetCamX = this.camX + (delta - Math.sign(delta) * deadzone);
        }
      }
      targetCamX = SR.clamp(targetCamX, 0, this.level.width - W);
      this.camX += (targetCamX - this.camX) * Math.min(1, dt * 4.5);
      this.lastCamVx = (this.camX - prevCamX) / Math.max(0.001, dt);

      if (this.shakeMag > 0.12) {
        this.shakeX = Math.sin(this.time * 48) * this.shakeMag;
        this.shakeY = Math.cos(this.time * 39) * this.shakeMag * 0.6;
        this.shakeMag *= Math.pow(0.0005, dt);
      } else {
        this.shakeMag = 0;
        this.shakeX = 0;
        this.shakeY = 0;
      }
    }

    drawHudPortrait() {
      const pctx = this.el.portrait.getContext('2d');
      pctx.clearRect(0, 0, 54, 54);
      SR.drawCharacterSprite(pctx, this.player.charId, {
        x: 27, y: 52, facing: 1, time: 0.4, scale: 0.9
      });
    }

    renderMenuPreviews() {
      document.querySelectorAll('.char-preview').forEach((cvs) => {
        const c = cvs.getContext('2d');
        const id = cvs.dataset.preview;
        const cx = cvs.width * 0.5;
        const baseY = cvs.height - 12;
        c.clearRect(0, 0, cvs.width, cvs.height);
        const g = c.createRadialGradient(cx, baseY, 4, cx, baseY, 32);
        g.addColorStop(0, 'rgba(255, 224, 248, 0.35)');
        g.addColorStop(1, 'rgba(255, 224, 248, 0)');
        c.fillStyle = g;
        c.beginPath();
        c.ellipse(cx, baseY, 32, 9, 0, 0, Math.PI * 2);
        c.fill();

        const isSel = id === this.selectedChar;
        SR.drawCharacterSprite(c, id, {
          x: id === 'blade' ? cx - 12 : cx,
          y: baseY,
          facing: 1,
          runTime: isSel ? this.time * 7 : 0,
          attackAnim: isSel && (this.time % 2.4 < 0.25) ? 0.25 - (this.time % 2.4) : 0,
          time: this.time,
          scale: isSel ? 1.06 : 0.96
        });
      });
    }

    updateHud() {
      if (!this.player) return;
      let heartsHtml = '';
      for (let i = 0; i < this.player.maxHp; i++) {
        heartsHtml += `<span class="heart ${i < this.player.hp ? '' : 'empty'}">💖</span>`;
      }
      if (this.el.hearts.innerHTML !== heartsHtml) {
        this.el.hearts.innerHTML = heartsHtml;
      }

      this.updateCircularSlot(
        this.el.slotSkill, this.el.slotSkillMask, this.el.slotSkillCd,
        this.player.skillTimer, this.player.def.skillCooldown
      );
      this.updateCircularSlot(
        this.el.slotUlt, this.el.slotUltMask, this.el.slotUltCd,
        this.player.ultimateTimer, this.player.def.ultimateCooldown
      );

      this.el.score.textContent = this.score;
      if (this.combo >= 2) {
        this.el.comboWrap.classList.remove('hidden');
        this.el.combo.textContent = this.combo;
      } else {
        this.el.comboWrap.classList.add('hidden');
      }

      if (this.el.progressFill) {
        const pct = SR.clamp((this.player.cx / this.level.width) * 100, 0, 100);
        this.el.progressFill.style.width = `${pct.toFixed(1)}%`;
      }

      if (this.activeBoss && !this.activeBoss.dead) {
        const bpct = Math.max(0, (this.activeBoss.hp / this.activeBoss.maxHp) * 100);
        this.el.bossHpFill.style.width = `${bpct}%`;
        this.el.bossPhaseTag.textContent = this.activeBoss.phase === 2 ? 'Phase II ✦' : 'Phase I';
      }
    }

    updateCircularSlot(slotEl, maskEl, cdTextEl, timer, maxCd) {
      if (!slotEl || !maskEl || !cdTextEl) return;
      if (timer > 0.02) {
        const remFrac = SR.clamp(timer / maxCd, 0, 1);
        const deg = Math.round(remFrac * 360);
        slotEl.classList.add('on-cd');
        slotEl.classList.remove('ready');
        maskEl.style.background = `conic-gradient(rgba(10, 6, 26, 0.78) 0deg ${deg}deg, transparent ${deg}deg 360deg)`;
        cdTextEl.textContent = timer >= 10 ? Math.ceil(timer) : timer.toFixed(1);
        cdTextEl.classList.remove('hidden');
      } else {
        slotEl.classList.remove('on-cd');
        slotEl.classList.add('ready');
        maskEl.style.background = 'none';
        cdTextEl.classList.add('hidden');
      }
    }

    loop(ts) {
      const dt = Math.min(0.05, (ts - this.lastFrame) / 1000);
      this.lastFrame = ts;
      this.update(dt);
      SR.renderGame(this.ctx, this, W, H);
      requestAnimationFrame((nextTs) => this.loop(nextTs));
    }
  }

  window.addEventListener('DOMContentLoaded', () => {
    SR.game = new Game();
  });
})(window.SR);
