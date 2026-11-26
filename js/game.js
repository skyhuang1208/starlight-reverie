// Lean Game Orchestrator: State Machine, Dual Controls, Deadzone Camera, HUD & Stage Progression
// Delegates combat/projectiles to SR.Combat, world map art to SR.WorldRenderer, and entity rendering to SR.renderGame.
window.SR = window.SR || {};

(function (SR) {
  const W = SR.VIEW_W || 1200;
  const H = SR.VIEW_H || 680;
  const PLAYER_NAME_KEY = 'sr_player_name';
  const HERO_LABELS = {
    magic: 'Luna · 法師',
    gun: 'Pip · 射手',
    blade: 'Lyra · 戰士'
  };

  class Game {
    constructor() {
      this.canvas = document.getElementById('game-canvas');
      this.ctx = this.canvas.getContext('2d');

      this.state = 'menu'; // 'menu' | 'instructions' | 'playing' | 'paused' | 'transition' | 'gameover' | 'victory'
      this.selectedChar = 'magic'; // Left = Luna (Beginner)
      this.selectedMapIndex = 0;
      this.hasSeenInstructions = false;
      this.playerName = this.loadSavedPlayerName();
      this.nameModalOpen = false;
      this.nameModalCanCancel = false;
      this.leaderboardModalOpen = false;
      this.feedbackModalOpen = false;
      this.feedbackCategory = 'idea';
      this.feedbackRating = 0;
      this.feedbackSubmitting = false;
      this.activeLeaderboardTab = 'stage_1';
      this.activeLeaderboardChar = 'all';
      this.embedPanels = {
        trans: { stageBoard: 'stage_1', showingCampaign: false, charFilter: 'all' },
        gameover: { stageBoard: 'stage_1', showingCampaign: false, charFilter: 'all' },
        victory: { stageBoard: 'stage_5', showingCampaign: false, charFilter: 'all' }
      };
      this.cheats = { godMode: false, onePunch: false };
      this.usedCheats = false;
      this.chainStartStage = 1;
      this.chainLockedScore = 0;
      this.chainLockedKills = 0;
      this.chainDeaths = 0;
      this.chainBonusAwarded = false;
      this.stagesCleared = 0;
      this.stageDeaths = 0;
      this.stageDuration = 0;
      this.deflectScoredCount = 0;
      this.runFinalized = false;
      this.checkpointSnapshot = { score: 0, kills: 0 };
      this.collectedPickupIds = new Set();
      this.bossVictoryTimeout = null;
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

      this.aimMode = 'keyboard'; // 'mouse' (360° cursor aim) | 'keyboard' (0° / ±90° arrow aim)
      this.mouse = { x: W * 0.65, y: H * 0.5, inside: false };
      this.input = this.createEmptyInput();

      this.bindUI();
      this.bindInputs();
      this.syncPlayerNameUI();
      if (!this.playerName) {
        this.openNameModal(false);
      }
      this.lastFrame = performance.now();
      requestAnimationFrame((ts) => this.loop(ts));
    }

    loadSavedPlayerName() {
      try {
        const saved = window.localStorage.getItem(PLAYER_NAME_KEY);
        if (saved && saved.trim()) return saved.trim().slice(0, 18);
      } catch (_) {}
      return '';
    }

    savePlayerName(rawName) {
      const cleaned = (rawName || '').trim().replace(/\s+/g, ' ').slice(0, 18);
      this.playerName = cleaned || 'Dreamer';
      try {
        window.localStorage.setItem(PLAYER_NAME_KEY, this.playerName);
      } catch (_) {}
      this.syncPlayerNameUI();
    }

    syncPlayerNameUI() {
      const display = this.playerName || 'Dreamer';
      if (this.el && this.el.menuPlayerName) this.el.menuPlayerName.textContent = display;
      if (this.el && this.el.hudPlayerName) this.el.hudPlayerName.textContent = display;
    }

    openNameModal(canCancel = false) {
      if (!this.el || !this.el.nameOverlay) return;
      this.nameModalOpen = true;
      this.nameModalCanCancel = canCancel;
      if (this.el.nameError) this.el.nameError.classList.add('hidden');
      if (this.el.playerNameInput) {
        this.el.playerNameInput.value = this.playerName || '';
      }
      if (this.el.btnNameSkip) {
        this.el.btnNameSkip.textContent = canCancel ? 'Cancel · 取消' : 'Play as Guest · 訪客遊玩';
      }
      this.el.nameOverlay.classList.remove('hidden');
      setTimeout(() => {
        if (this.el.playerNameInput) {
          this.el.playerNameInput.focus();
          this.el.playerNameInput.select();
        }
      }, 30);
    }

    closeNameModal() {
      this.nameModalOpen = false;
      this.nameModalCanCancel = false;
      if (this.el && this.el.nameOverlay) this.el.nameOverlay.classList.add('hidden');
      if (this.el && this.el.playerNameInput) this.el.playerNameInput.blur();
    }

    submitPlayerName() {
      if (!this.el || !this.el.playerNameInput) return;
      const val = this.el.playerNameInput.value.trim();
      if (!val) {
        if (this.el.nameError) this.el.nameError.classList.remove('hidden');
        this.el.playerNameInput.focus();
        return;
      }
      SR.audio.init();
      this.savePlayerName(val);
      this.closeNameModal();
      SR.audio.pickup(false);
    }

    skipPlayerName() {
      SR.audio.init();
      if (!this.nameModalCanCancel || !this.playerName) {
        this.savePlayerName('Dreamer');
      }
      this.closeNameModal();
      SR.audio.pickup(false);
    }

    syncSelectedCharUI() {
      document.querySelectorAll('.char-card').forEach((c) => {
        c.classList.toggle('selected', c.dataset.char === this.selectedChar);
      });
      if (this.el && this.el.selectedHeroPill) {
        const label = HERO_LABELS[this.selectedChar] || 'Luna · 法師';
        this.el.selectedHeroPill.textContent = `Active: ${label}`;
      }
    }

    async openLeaderboardModal(board = null, charFilter = null) {
      if (!this.el || !this.el.leaderboardOverlay || !SR.leaderboard) return;
      if (board) this.activeLeaderboardTab = SR.leaderboard.normalizeBoard(board);
      if (charFilter) this.activeLeaderboardChar = SR.leaderboard.normalizeCharFilter(charFilter);
      this.leaderboardModalOpen = true;
      this.el.leaderboardOverlay.classList.remove('hidden');
      document.querySelectorAll('#lb-tabs .lb-tab-btn').forEach((btn) => {
        btn.classList.toggle('active', btn.dataset.board === this.activeLeaderboardTab);
      });
      document.querySelectorAll('#lb-char-tabs .lb-char-btn').forEach((btn) => {
        btn.classList.toggle('active', btn.dataset.char === this.activeLeaderboardChar);
      });
      if (this.el.lbList) {
        this.el.lbList.textContent = 'Loading leaderboard... · 讀取排行榜中...';
      }
      const { mode, board: activeBoard, entries } = await SR.leaderboard.fetchTop(this.activeLeaderboardTab);
      if (this.el.lbModeBadge) {
        this.el.lbModeBadge.textContent = mode === 'cloud' ? '🌐 Global Cloud' : '💾 Local Scores';
      }
      SR.leaderboard.renderList(this.el.lbList, entries, activeBoard, this.activeLeaderboardChar, this.playerName);
    }

    async refreshEmbeddedLeaderboard(panelKey) {
      const st = this.embedPanels[panelKey];
      if (!st || !SR.leaderboard) return;
      const board = st.showingCampaign ? 'campaign' : st.stageBoard;
      const titleEl = document.getElementById(`${panelKey}-lb-title`);
      const listEl = document.getElementById(`${panelKey}-lb-list`);
      const toggleBtn = document.querySelector(`[data-lb-toggle="${panelKey}"]`);
      const charBtns = document.querySelectorAll(`[data-lb-chars="${panelKey}"] .lb-char-btn`);

      if (titleEl) titleEl.textContent = SR.leaderboard.getBoardTitle(board);
      if (toggleBtn) {
        toggleBtn.classList.toggle('is-campaign', st.showingCampaign);
        const stageNum = st.stageBoard.replace('stage_', '');
        toggleBtn.textContent = st.showingCampaign
          ? `🎯 Stage ${stageNum} · 返回本關`
          : '🏆 5-Stage · 五關總榜';
      }
      charBtns.forEach((btn) => btn.classList.toggle('active', btn.dataset.char === st.charFilter));
      if (listEl) listEl.textContent = 'Loading...';

      const { entries } = await SR.leaderboard.fetchTop(board);
      SR.leaderboard.renderList(listEl, entries, board, st.charFilter, this.playerName);
    }

    closeLeaderboardModal() {
      this.leaderboardModalOpen = false;
      if (this.el && this.el.leaderboardOverlay) {
        this.el.leaderboardOverlay.classList.add('hidden');
      }
    }

    openFeedbackModal() {
      if (!this.el || !this.el.feedbackOverlay) return;
      this.feedbackModalOpen = true;
      this.feedbackSubmitting = false;
      if (this.el.feedbackMetaSub) {
        this.el.feedbackMetaSub.textContent = `${SR.GAME_VERSION || 'v1.0.0'} · ${this.playerName || 'Dreamer'}`;
      }
      if (this.el.feedbackStatus) {
        this.el.feedbackStatus.classList.add('hidden');
        this.el.feedbackStatus.textContent = '';
      }
      if (this.el.btnFeedbackSubmit) {
        this.el.btnFeedbackSubmit.disabled = false;
        this.el.btnFeedbackSubmit.textContent = 'Send Feedback · 送出回饋 ✦';
      }
      this.setFeedbackCategory(this.feedbackCategory || 'idea');
      this.setFeedbackRating(this.feedbackRating || 0);
      this.el.feedbackOverlay.classList.remove('hidden');
      setTimeout(() => {
        if (this.el.feedbackMessage) this.el.feedbackMessage.focus();
      }, 30);
    }

    closeFeedbackModal() {
      this.feedbackModalOpen = false;
      if (this.el && this.el.feedbackOverlay) {
        this.el.feedbackOverlay.classList.add('hidden');
      }
      if (this.el && this.el.feedbackMessage) this.el.feedbackMessage.blur();
    }

    setFeedbackCategory(cat) {
      this.feedbackCategory = cat || 'idea';
      document.querySelectorAll('#fb-cat-row .fb-cat-btn').forEach((btn) => {
        btn.classList.toggle('active', btn.dataset.fbCat === this.feedbackCategory);
      });
    }

    setFeedbackRating(rating) {
      this.feedbackRating = rating;
      document.querySelectorAll('#fb-rating-row .fb-star-btn').forEach((btn) => {
        const val = parseInt(btn.dataset.fbStar, 10) || 0;
        btn.classList.toggle('active', val <= this.feedbackRating && this.feedbackRating > 0);
      });
    }

    showFeedbackStatus(msg, isError = false) {
      if (!this.el || !this.el.feedbackStatus) return;
      this.el.feedbackStatus.textContent = msg;
      this.el.feedbackStatus.className = `fb-status ${isError ? 'err' : 'ok'}`;
    }

    async submitFeedbackForm() {
      if (this.feedbackSubmitting || !SR.leaderboard || !this.el || !this.el.feedbackMessage) return;
      const msg = this.el.feedbackMessage.value.trim();
      if (msg.length < 3) {
        this.showFeedbackStatus('Please write at least 3 characters · 請至少輸入 3 個字元', true);
        this.el.feedbackMessage.focus();
        return;
      }

      this.feedbackSubmitting = true;
      if (this.el.btnFeedbackSubmit) {
        this.el.btnFeedbackSubmit.disabled = true;
        this.el.btnFeedbackSubmit.textContent = 'Sending... · 傳送中...';
      }

      const stage = this.state === 'playing' || this.state === 'paused' || this.state === 'gameover' || this.state === 'transition' || this.state === 'victory'
        ? (this.level && this.level.meta ? this.level.meta.index + 1 : this.selectedMapIndex + 1)
        : (this.selectedMapIndex + 1);

      const res = await SR.leaderboard.submitFeedback({
        name: this.playerName || 'Dreamer',
        category: this.feedbackCategory || 'idea',
        rating: this.feedbackRating || null,
        message: msg,
        stage,
        charId: this.selectedChar
      });

      this.feedbackSubmitting = false;
      if (this.el.btnFeedbackSubmit) {
        this.el.btnFeedbackSubmit.disabled = false;
        this.el.btnFeedbackSubmit.textContent = 'Send Feedback · 送出回饋 ✦';
      }

      if (res && res.ok) {
        this.el.feedbackMessage.value = '';
        if (this.el.feedbackCharCount) this.el.feedbackCharCount.textContent = '0 / 500';
        this.setFeedbackRating(0);
        this.showFeedbackStatus(
          res.mode === 'cloud'
            ? '✦ Thank you! Your feedback has been sent! · 感謝您的寶貴意見！'
            : '💾 Saved locally (offline mode) · 已暫存於本機，感謝回饋！',
          false
        );
      } else if (res && res.error === 'rate_limited') {
        this.showFeedbackStatus('Too many submissions right now — please try again later · 請稍後再試', true);
      } else {
        this.showFeedbackStatus('Could not send feedback — please check your message · 傳送失敗，請檢查內容後重試', true);
      }
    }

    clearBossVictoryTimeout() {
      if (this.bossVictoryTimeout) {
        clearTimeout(this.bossVictoryTimeout);
        this.bossVictoryTimeout = null;
      }
    }

    formatDuration(sec) {
      const s = Math.max(0, Math.floor(sec || 0));
      const m = Math.floor(s / 60);
      const rem = s % 60;
      return m > 0 ? `${m}:${String(rem).padStart(2, '0')}` : `${rem}s`;
    }

    renderResultStats(containerId, items) {
      const container = document.getElementById(containerId);
      if (!container) return;
      container.textContent = '';
      for (const item of items) {
        const box = document.createElement('div');
        box.className = 'result-stat-box';
        const span = document.createElement('span');
        span.textContent = item.label;
        const strong = document.createElement('strong');
        strong.textContent = String(item.value);
        box.appendChild(span);
        box.appendChild(strong);
        container.appendChild(box);
      }
    }

    getCombinedScore() {
      return this.chainLockedScore + this.score + (this.chainBonusAwarded ? 5000 : 0);
    }

    getCombinedKills() {
      return this.chainLockedKills + this.kills;
    }

    // Submits BOTH the isolated current Stage board (stage_k) AND the continuous 5-Stage board (campaign),
    // deduplicating by (name, charId) keeping ONLY personal best, then renders the embedded Stage leaderboard!
    async recordAndShowResultLeaderboard(panelKey, stageCleared, statusElId) {
      const stageNum = this.selectedMapIndex + 1;
      const stageBoard = `stage_${stageNum}`;
      const st = this.embedPanels[panelKey];
      if (st) {
        st.stageBoard = stageBoard;
        st.showingCampaign = false; // Default to current stage score at end, with toggle button to 5-stage!
        st.charFilter = 'all';
      }

      const statusEl = statusElId ? document.getElementById(statusElId) : null;
      if (!SR.leaderboard) return;

      if (this.usedCheats || this.cheats.godMode || this.cheats.onePunch) {
        if (statusEl) {
          statusEl.textContent = '✨ 金手指模式 · 不計入排行榜 (Cheats Active — Unranked)';
          statusEl.className = 'lb-status-pill unranked';
        }
        await this.refreshEmbeddedLeaderboard(panelKey);
        return;
      }

      const combinedScore = this.getCombinedScore();
      if (this.score <= 0 && combinedScore <= 0) {
        if (statusEl) statusEl.classList.add('hidden');
        await this.refreshEmbeddedLeaderboard(panelKey);
        return;
      }

      if (statusEl) {
        statusEl.textContent = '✦ Updating leaderboard... · 更新排行榜中...';
        statusEl.className = 'lb-status-pill';
      }

      const playerName = this.playerName || 'Dreamer';
      let stageRes = null;
      if (this.score > 0) {
        stageRes = await SR.leaderboard.submitScore({
          board: stageBoard,
          name: playerName,
          score: this.score,
          charId: this.selectedChar,
          startStage: stageNum,
          endStage: stageNum,
          stagesCleared: stageCleared ? 1 : 0,
          kills: this.kills,
          deaths: this.stageDeaths,
          durationSec: Math.max(1, Math.round(this.stageDuration)),
          cleared: !!stageCleared
        });
      }

      if (combinedScore > 0) {
        const fullCleared = this.chainStartStage === 1 && stageCleared && stageNum >= SR.MAPS.length && this.stagesCleared >= SR.MAPS.length;
        await SR.leaderboard.submitScore({
          board: 'campaign',
          name: playerName,
          score: combinedScore,
          charId: this.selectedChar,
          startStage: this.chainStartStage,
          endStage: stageNum,
          stagesCleared: this.stagesCleared,
          kills: this.getCombinedKills(),
          deaths: this.chainDeaths,
          durationSec: Math.max(1, Math.round(this.runDuration)),
          cleared: fullCleared
        });
      }

      if (statusEl) {
        if (stageRes && stageRes.saved) {
          const scope = stageRes.mode === 'cloud' ? 'Global' : 'Local';
          const rankTxt = stageRes.rank ? `#${stageRes.rank}` : 'Top 100';
          const tag = stageRes.improved ? 'New Best!' : 'Best Kept';
          statusEl.textContent = `🏆 Stage ${stageNum} ${rankTxt} (${scope} · ${tag})`;
          statusEl.className = 'lb-status-pill';
        } else {
          statusEl.classList.add('hidden');
        }
      }

      await this.refreshEmbeddedLeaderboard(panelKey);
    }

    createEmptyInput() {
      return {
        left: false, right: false, up: false, down: false,
        aimUp: false, aimDown: false,
        aimMode: this.aimMode || 'keyboard',
        mouseWorldX: 0, mouseWorldY: 0,
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
        nameOverlay: $('name-overlay'),
        nameForm: $('name-form'),
        playerNameInput: $('player-name-input'),
        nameError: $('name-error'),
        btnNameSkip: $('btn-name-skip'),
        btnEditName: $('btn-edit-name'),
        btnOpenLeaderboard: $('btn-open-leaderboard'),
        leaderboardOverlay: $('leaderboard-overlay'),
        lbList: $('lb-list'),
        lbModeBadge: $('lb-mode-badge'),
        btnLbRefresh: $('btn-lb-refresh'),
        btnLbClose: $('btn-lb-close'),
        btnOpenFeedback: $('btn-open-feedback'),
        btnPauseFeedback: $('btn-pause-feedback'),
        feedbackOverlay: $('feedback-overlay'),
        feedbackForm: $('feedback-form'),
        feedbackMessage: $('feedback-message'),
        feedbackCharCount: $('feedback-char-count'),
        feedbackStatus: $('feedback-status'),
        feedbackMetaSub: $('feedback-meta-sub'),
        btnFeedbackSubmit: $('btn-feedback-submit'),
        btnFeedbackClose: $('btn-feedback-close'),
        menuVersionBadge: $('menu-version-badge'),
        pauseVersionTag: $('pause-version-tag'),
        menuPlayerName: $('menu-player-name'),
        hudPlayerName: $('hud-player-name'),
        selectedHeroPill: $('selected-hero-pill'),
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
        charName: $('hud-char-name'),
        charRole: $('hud-char-role'),
        stagePill: $('hud-stage-pill'),
        hearts: $('hud-hearts'),
        slotBasic: $('slot-basic'),
        slotSkill: $('slot-skill'),
        slotSkillMask: $('slot-skill-mask'),
        slotSkillCd: $('slot-skill-cd'),
        slotSkillCharges: $('slot-skill-charges'),
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
          this.selectedChar = card.dataset.char;
          this.syncSelectedCharUI();
          SR.audio.pickup(false);
        });
      });
      this.syncSelectedCharUI();

      // Player Name Registration & Quick Edit
      if (this.el.nameForm) {
        this.el.nameForm.addEventListener('submit', (e) => {
          e.preventDefault();
          this.submitPlayerName();
        });
      }
      if (this.el.playerNameInput) {
        this.el.playerNameInput.addEventListener('input', () => {
          if (this.el.nameError) this.el.nameError.classList.add('hidden');
        });
      }
      if (this.el.btnNameSkip) {
        this.el.btnNameSkip.addEventListener('click', () => this.skipPlayerName());
      }
      if (this.el.btnEditName) {
        this.el.btnEditName.addEventListener('click', () => this.openNameModal(true));
      }
      if (this.el.nameOverlay) {
        this.el.nameOverlay.addEventListener('click', (e) => {
          if (e.target === this.el.nameOverlay && this.nameModalCanCancel) {
            this.closeNameModal();
          }
        });
      }

      // Full Leaderboard Modal Controls
      if (this.el.btnOpenLeaderboard) {
        this.el.btnOpenLeaderboard.addEventListener('click', () => {
          this.openLeaderboardModal(`stage_${this.selectedMapIndex + 1}`, 'all');
        });
      }
      if (this.el.btnLbClose) {
        this.el.btnLbClose.addEventListener('click', () => this.closeLeaderboardModal());
      }
      if (this.el.btnLbRefresh) {
        this.el.btnLbRefresh.addEventListener('click', () => this.openLeaderboardModal(this.activeLeaderboardTab, this.activeLeaderboardChar));
      }
      document.querySelectorAll('#lb-tabs .lb-tab-btn').forEach((btn) => {
        btn.addEventListener('click', () => this.openLeaderboardModal(btn.dataset.board, null));
      });
      document.querySelectorAll('#lb-char-tabs .lb-char-btn').forEach((btn) => {
        btn.addEventListener('click', () => this.openLeaderboardModal(null, btn.dataset.char));
      });
      if (this.el.leaderboardOverlay) {
        this.el.leaderboardOverlay.addEventListener('click', (e) => {
          if (e.target === this.el.leaderboardOverlay) this.closeLeaderboardModal();
        });
      }

      // Version Display & Player Feedback Modal Controls
      const ver = SR.GAME_VERSION || 'v1.0.0';
      if (this.el.menuVersionBadge) this.el.menuVersionBadge.textContent = ver;
      if (this.el.pauseVersionTag) this.el.pauseVersionTag.textContent = `Starlight Reverie · ${ver}`;

      if (this.el.btnOpenFeedback) {
        this.el.btnOpenFeedback.addEventListener('click', () => this.openFeedbackModal());
      }
      if (this.el.btnPauseFeedback) {
        this.el.btnPauseFeedback.addEventListener('click', () => this.openFeedbackModal());
      }
      if (this.el.btnFeedbackClose) {
        this.el.btnFeedbackClose.addEventListener('click', () => this.closeFeedbackModal());
      }
      if (this.el.feedbackOverlay) {
        this.el.feedbackOverlay.addEventListener('click', (e) => {
          if (e.target === this.el.feedbackOverlay) this.closeFeedbackModal();
        });
      }
      document.querySelectorAll('#fb-cat-row .fb-cat-btn').forEach((btn) => {
        btn.addEventListener('click', () => this.setFeedbackCategory(btn.dataset.fbCat));
      });
      document.querySelectorAll('#fb-rating-row .fb-star-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          const val = parseInt(btn.dataset.fbStar, 10) || 0;
          this.setFeedbackRating(this.feedbackRating === val ? 0 : val);
        });
      });
      if (this.el.feedbackMessage) {
        this.el.feedbackMessage.addEventListener('input', () => {
          if (this.el.feedbackCharCount) {
            this.el.feedbackCharCount.textContent = `${this.el.feedbackMessage.value.length} / 500`;
          }
          if (this.el.feedbackStatus && this.el.feedbackStatus.classList.contains('err')) {
            this.el.feedbackStatus.classList.add('hidden');
          }
        });
      }
      if (this.el.feedbackForm) {
        this.el.feedbackForm.addEventListener('submit', (e) => {
          e.preventDefault();
          this.submitFeedbackForm();
        });
      }

      // Embedded Result Leaderboard Controls (Stage Clear, Game Over, Victory)
      document.querySelectorAll('[data-lb-toggle]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const panelKey = btn.dataset.lbToggle;
          const st = this.embedPanels[panelKey];
          if (!st) return;
          st.showingCampaign = !st.showingCampaign;
          this.refreshEmbeddedLeaderboard(panelKey);
        });
      });
      document.querySelectorAll('[data-lb-chars]').forEach((group) => {
        const panelKey = group.dataset.lbChars;
        group.querySelectorAll('.lb-char-btn').forEach((btn) => {
          btn.addEventListener('click', () => {
            const st = this.embedPanels[panelKey];
            if (!st) return;
            st.charFilter = btn.dataset.char;
            this.refreshEmbeddedLeaderboard(panelKey);
          });
        });
      });

      // 金手指區
      if (this.el.cheatGod) {
        this.el.cheatGod.addEventListener('change', () => {
          this.cheats.godMode = this.el.cheatGod.checked;
          if (this.cheats.godMode) this.usedCheats = true;
          SR.audio.pickup(this.cheats.godMode);
        });
      }
      if (this.el.cheatOnePunch) {
        this.el.cheatOnePunch.addEventListener('change', () => {
          this.cheats.onePunch = this.el.cheatOnePunch.checked;
          if (this.cheats.onePunch) this.usedCheats = true;
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

      $('btn-retry-cp').addEventListener('click', () => this.startNewGame(this.selectedChar, true, this.selectedMapIndex, false));
      $('btn-retry-full').addEventListener('click', () => this.startNewGame(this.selectedChar, false, this.selectedMapIndex, false));
      $('btn-gameover-menu').addEventListener('click', () => this.returnToMenu());

      this.el.btnNextStage.addEventListener('click', () => this.advanceToNextStage());
      $('btn-trans-now').addEventListener('click', () => this.advanceToNextStage());
      $('btn-trans-menu').addEventListener('click', () => this.returnToMenu());
      $('btn-play-again').addEventListener('click', () => this.startNewGame(this.selectedChar, false, this.selectedMapIndex, false));
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
      const modeTag = document.getElementById('dossier-mode-tag');
      if (modeTag) {
        const isStage1 = this.selectedMapIndex === 0;
        modeTag.textContent = isStage1
          ? '🏆 Stage 1 + Full 5-Stage Chain (+5,000 Bonus) · 單關＆五關總榜'
          : `🎯 Stage ${m.index + 1} Board + Continuous Chain · 本關＆連續總榜`;
        modeTag.classList.toggle('trial-mode', !isStage1);
      }
      document.querySelectorAll('.stage-dot-btn').forEach((btn) => {
        btn.classList.toggle('active', parseInt(btn.dataset.map, 10) === this.selectedMapIndex);
      });
    }

    bindInputs() {
      window.addEventListener('blur', () => this.clearInputs());

      window.addEventListener('keydown', (e) => {
        const code = e.code;
        if (this.nameModalOpen) {
          if (code === 'Escape' && this.nameModalCanCancel) {
            e.preventDefault();
            this.closeNameModal();
          }
          return;
        }
        if (this.leaderboardModalOpen) {
          if (code === 'Escape') {
            e.preventDefault();
            this.closeLeaderboardModal();
          }
          return;
        }
        if (this.feedbackModalOpen) {
          if (code === 'Escape') {
            e.preventDefault();
            this.closeFeedbackModal();
          }
          return;
        }
        const activeTag = document.activeElement && document.activeElement.tagName;
        if (activeTag === 'INPUT' || activeTag === 'TEXTAREA') return;

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
        // Style A: WASD + Space + Mouse (360° Aim) + LMB (Attack) + RMB (Skill) + Q (Ult)
        // Style B: Arrows + Space + 1 (Attack) + 2 (Skill) + 3 (Ult) — Hold ↑ / ↓(air) for 90° vertical aim!
        if (code === 'ArrowLeft' || code === 'KeyA') this.input.left = true;
        if (code === 'ArrowRight' || code === 'KeyD') this.input.right = true;
        if (code === 'ArrowDown' || code === 'KeyS') {
          if (!this.input.down) this.input.downPressed = true;
          this.input.down = true;
          if (code === 'ArrowDown') this.input.aimDown = true;
        }
        if (code === 'ArrowUp') {
          // Style B: ArrowUp aims straight UP (-90°) without forcing an involuntary jump (Space jumps!)
          this.input.up = true;
          this.input.aimUp = true;
        }
        if (code === 'KeyW') {
          // Style A: W jumps seamlessly (since Mouse aims 360°!)
          this.input.up = true;
          if (!this.input.jumpHeld) this.input.jumpPressed = true;
          this.input.jumpHeld = true;
        }
        if (code === 'Space') {
          if (!this.input.jumpHeld) this.input.jumpPressed = true;
          this.input.jumpHeld = true;
        }
        if (code === 'ShiftLeft' || code === 'ShiftRight') {
          if (!this.input.slideHeld) this.input.slidePressed = true;
          this.input.slideHeld = true;
        }
        if (code === 'Digit1' || code === 'Numpad1') {
          this.aimMode = 'keyboard';
          this.input.attackHeld = true;
        }
        if (code === 'Digit2' || code === 'Numpad2') {
          this.aimMode = 'keyboard';
          this.input.skillPressed = true;
        }
        if (code === 'Digit3' || code === 'Numpad3') {
          this.aimMode = 'keyboard';
          this.input.ultimatePressed = true;
        }
        if (code === 'KeyQ') {
          this.input.ultimatePressed = true;
        }
      });

      window.addEventListener('keyup', (e) => {
        const code = e.code;
        if (code === 'ArrowLeft' || code === 'KeyA') this.input.left = false;
        if (code === 'ArrowRight' || code === 'KeyD') this.input.right = false;
        if (code === 'ArrowDown' || code === 'KeyS') {
          this.input.down = false;
          if (code === 'ArrowDown') this.input.aimDown = false;
        }
        if (code === 'ArrowUp') {
          this.input.up = false;
          this.input.aimUp = false;
        }
        if (code === 'KeyW') {
          this.input.up = false;
          this.input.jumpHeld = false;
        }
        if (code === 'Space') this.input.jumpHeld = false;
        if (code === 'ShiftLeft' || code === 'ShiftRight') this.input.slideHeld = false;
        if (code === 'Digit1' || code === 'Numpad1') this.input.attackHeld = false;
      });

      const updateMouseCoords = (e) => {
        const rect = this.canvas.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) return;
        const nx = ((e.clientX - rect.left) / rect.width) * W;
        const ny = ((e.clientY - rect.top) / rect.height) * H;
        if (Math.hypot(nx - this.mouse.x, ny - this.mouse.y) > 2.5) {
          this.aimMode = 'mouse';
        }
        this.mouse.x = SR.clamp(nx, 0, W);
        this.mouse.y = SR.clamp(ny, 0, H);
        this.mouse.inside = true;
      };

      this.canvas.addEventListener('mousemove', updateMouseCoords);
      this.canvas.addEventListener('mouseleave', () => { this.mouse.inside = false; });

      this.canvas.addEventListener('mousedown', (e) => {
        updateMouseCoords(e);
        this.aimMode = 'mouse';
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
      this.syncSelectedCharUI();
      SR.audio.pickup(false);
    }

    getMapBgmMode() {
      return (this.level && this.level.meta && this.level.meta.id) || 'meadow';
    }

    getBossBgmMode() {
      return (this.level && this.level.meta && this.level.meta.id === 'hell') ? 'hell_boss' : 'boss';
    }

    advanceToNextStage() {
      if (this.runFinalized) return;
      const nextIdx = Math.min(SR.MAPS.length - 1, this.selectedMapIndex + 1);
      // Lock the just-cleared stage's score into the continuous 5-stage chain before resetting stageScore to 0!
      this.chainLockedScore += this.score;
      this.chainLockedKills += this.kills;
      this.selectedMapIndex = nextIdx;
      this.syncMapSelectorUI();
      this.startNewGame(this.selectedChar, false, nextIdx, true);
    }

    startNewGame(charId, fromCheckpoint = false, mapIndex = this.selectedMapIndex, continueChain = false) {
      SR.audio.init();
      SR.particles.clearCombat();
      this.clearBossVictoryTimeout();
      this.clearInputs();

      const effectiveFromCp = fromCheckpoint && !this.runFinalized;
      const effectiveContinue = continueChain && !this.runFinalized;

      this.selectedMapIndex = mapIndex;
      const freshLevel = SR.createLevel(mapIndex);
      const prevSpawn = effectiveFromCp ? { ...this.spawnPoint } : { ...freshLevel.spawn };
      const prevCpIds = effectiveFromCp
        ? this.level.checkpoints.filter((c) => c.activated).map((c) => c.id)
        : [];
      const midBossAlreadyDone = effectiveFromCp && this.level.bossArenas.midboss && this.level.bossArenas.midboss.defeated;

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
      if (!effectiveFromCp) {
        this.collectedPickupIds = new Set();
      } else {
        // Prevent checkpoint death/respawn backtracking from farming stars/hearts already passed!
        for (const pk of this.level.pickups) {
          if (this.collectedPickupIds.has(pk.id) || pk.x < this.spawnPoint.x) {
            pk.collected = true;
          }
        }
      }
      this.player = new SR.Player(charId, this.spawnPoint.x, this.spawnPoint.y);

      this.enemies = this.level.enemySpawns
        .filter((sp) => !effectiveFromCp || sp.x >= this.spawnPoint.x)
        .map((sp) => new SR.Enemy(sp, this.level.meta));

      this.playerProjectiles = [];
      this.enemyProjectiles = [];
      this.activeArena = null;
      this.activeBoss = null;

      if (!effectiveFromCp && !effectiveContinue) {
        // Brand-new continuous run: resets BOTH Stage score AND 5-Stage chain to 0!
        this.score = 0;
        this.kills = 0;
        this.stageDeaths = 0;
        this.stageDuration = 0;
        this.deflectScoredCount = 0;
        this.chainStartStage = mapIndex + 1;
        this.chainLockedScore = 0;
        this.chainLockedKills = 0;
        this.chainDeaths = 0;
        this.chainBonusAwarded = false;
        this.stagesCleared = 0;
        this.runDuration = 0;
        this.runFinalized = false;
        this.usedCheats = !!(this.cheats.godMode || this.cheats.onePunch);
        this.checkpointSnapshot = { score: 0, kills: 0 };
        if (SR.leaderboard && SR.leaderboard.recordPlay) {
          SR.leaderboard.recordPlay({ charId, startStage: this.chainStartStage, usedCheats: this.usedCheats });
        }
        if (!this.usedCheats && SR.leaderboard) {
          SR.leaderboard.startRun(charId, this.chainStartStage);
        }
      } else if (effectiveFromCp) {
        // Fair Checkpoint Respawn: rolls current stage back to checkpointSnapshot minus 1500 pts (min 0),
        // preserves earlier cleared stages in chainLockedScore, and increments death counters!
        this.stageDeaths++;
        this.chainDeaths++;
        const retryPenalty = (SR.SCORING && SR.SCORING.retryPenalty) || 1500;
        this.score = Math.max(0, this.checkpointSnapshot.score - retryPenalty);
        this.kills = this.checkpointSnapshot.kills;
        this.checkpointSnapshot = { score: this.score, kills: this.kills };
        if (this.cheats.godMode || this.cheats.onePunch) this.usedCheats = true;
      } else if (effectiveContinue) {
        // Advancing continuously to next stage: fresh Stage Score = 0, continuous chain stays intact!
        this.score = 0;
        this.kills = 0;
        this.stageDeaths = 0;
        this.stageDuration = 0;
        this.deflectScoredCount = 0;
        this.checkpointSnapshot = { score: 0, kills: 0 };
        if (this.cheats.godMode || this.cheats.onePunch) this.usedCheats = true;
      }
      if (!effectiveFromCp) {
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
      // Jumping out to Menu resets the continuous 5-stage chain!
      this.chainLockedScore = 0;
      this.chainLockedKills = 0;
      this.chainDeaths = 0;
      this.chainBonusAwarded = false;
      this.stagesCleared = 0;
      this.runFinalized = true;
      if (SR.leaderboard) SR.leaderboard.clearRunToken();
      this.clearBossVictoryTimeout();
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

    addDeflectScore(pts = 40) {
      if (this.runFinalized || this.deflectScoredCount >= 10) return;
      this.deflectScoredCount++;
      this.score += pts;
    }

    onEnemyKilled(e) {
      SR.audio.enemyDefeat();
      SR.particles.spawnBurst(e.cx, e.cy, ['#ff9fd6', '#ffe58f', '#9cf5e3', '#ffffff'], 16, {
        speedMin: 80, speedMax: 240, size: 4.5, shape: 'star'
      });
      SR.particles.spawnRing(e.cx, e.cy, '#ffe58f', 48, 0.3);
      // Boss-summoned reinforcements award 0 score to prevent stalling a boss for infinite score farming!
      if (!e.isBossSummon && !this.runFinalized) {
        this.kills++;
        const sc = SR.SCORING || { comboCap: 20, comboPerStack: 5 };
        const comboBonus = Math.min(this.combo, sc.comboCap) * sc.comboPerStack;
        this.score += e.score + comboBonus;
      } else if (e.isBossSummon) {
        SR.particles.spawnText(e.cx, e.y - 16, '增援擊破', '#9cf5e3', 0.9);
      }
      if (e.isElite) {
        // Every defeated mini-boss (wild or boss-summoned!) guarantees an HP healing heart drop!
        this.level.pickups.push({
          id: SR.nextEntityId(), x: e.cx, y: Math.min(e.y + e.h - 22, 553),
          kind: 'heart', collected: false, bobPhase: 0
        });
      } else if (this.player && this.player.hp < this.player.maxHp && Math.random() < 0.32) {
        this.level.pickups.push({
          id: SR.nextEntityId(), x: e.cx, y: e.cy,
          kind: 'heart', collected: false, bobPhase: 0
        });
      }
    }

    onBossDefeated(boss) {
      if (!this.runFinalized) {
        this.kills++;
        this.score += boss.score;
      }
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
          id: SR.nextEntityId(), x: boss.cx, y: 550, kind: 'heart', collected: false, bobPhase: 0
        });
      } else if (boss.arena.id === 'finalboss') {
        this.stagesCleared++;
        // Clear-first Stage Bonuses: Stage Clear Bonus + Substantial 1-Try (0-Death) Bonus + HP Bonus (+250/HP)
        // Full 5-Stage Clear Bonus (+5,000) applies ONLY to the 5-Stage Combined total (keeps Stage 5 board fair!)
        if (!this.runFinalized && this.player) {
          const sc = SR.SCORING || {
            hpBonusPerHp: 250,
            stageClearBonus: [3000, 3500, 4000, 4500, 5000],
            oneTryBonus: [3500, 4000, 4500, 5000, 5500]
          };
          const clearBonus = sc.stageClearBonus[this.selectedMapIndex] ?? 3000;
          const oneTryBonus = this.stageDeaths === 0 ? (sc.oneTryBonus[this.selectedMapIndex] ?? 3500) : 0;
          const hpBonus = this.player.hp * sc.hpBonusPerHp;
          const stageBonus = clearBonus + oneTryBonus + hpBonus;
          this.score += stageBonus;
          if (this.chainStartStage === 1 && this.selectedMapIndex >= SR.MAPS.length - 1 && this.stagesCleared >= SR.MAPS.length) {
            this.chainBonusAwarded = true;
          }
          const tag = oneTryBonus > 0 ? '1-TRY CLEAR BONUS' : 'CLEAR BONUS';
          const bonusTxt = this.chainBonusAwarded
            ? `+${stageBonus.toLocaleString()} ${tag} & +5,000 5-STAGE ✦`
            : `+${stageBonus.toLocaleString()} ${tag} ✦`;
          SR.particles.spawnText(boss.cx, boss.cy - 34, bonusTxt, '#ffe58f', 1.25);
        }
        SR.audio.victory();
        this.clearBossVictoryTimeout();
        this.bossVictoryTimeout = setTimeout(() => {
          this.bossVictoryTimeout = null;
          if (this.state !== 'playing') return;
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
      const meta = this.level.meta;
      const nextMeta = SR.MAPS[this.selectedMapIndex + 1];

      document.getElementById('trans-eyebrow').textContent = `✦ STAGE ${this.selectedMapIndex + 1} / 5 CLEARED ✦`;
      document.getElementById('trans-title').textContent = `${meta.name} Cleared!`;
      const stars = this.stageDeaths === 0 && this.player.hp >= 4 ? '★★★' : (this.stageDeaths <= 1 ? '★★☆' : '★☆☆');
      document.getElementById('trans-rank').textContent = stars;
      this.renderResultStats('trans-stats', [
        { label: `Stage ${this.selectedMapIndex + 1} Score`, value: this.score.toLocaleString() },
        { label: '5-Stage Total', value: this.getCombinedScore().toLocaleString() },
        { label: 'Stage Time', value: this.formatDuration(this.stageDuration) }
      ]);
      document.getElementById('trans-next-name').textContent = `Stage ${this.selectedMapIndex + 2} · ${nextMeta.name}`;
      document.getElementById('trans-next-sub').textContent = `${nextMeta.zh} · ${nextMeta.stars} · Boss: ${nextMeta.bossTitle}`;
      if (this.el.transitionOverlay) this.el.transitionOverlay.classList.remove('hidden');
      this.recordAndShowResultLeaderboard('trans', true, 'trans-lb-status');
    }

    showGameOver() {
      this.clearBossVictoryTimeout();
      this.clearInputs();
      this.state = 'gameover';
      SR.audio.setBgmMode(this.getMapBgmMode());
      this.renderResultStats('gameover-stats', [
        { label: `Stage ${this.selectedMapIndex + 1} Score`, value: this.score.toLocaleString() },
        { label: '5-Stage Total', value: this.getCombinedScore().toLocaleString() },
        { label: 'Time', value: this.formatDuration(this.stageDuration) }
      ]);
      this.el.gameoverOverlay.classList.remove('hidden');
      // Immediately record personal-best & display Stage Leaderboard on death!
      this.recordAndShowResultLeaderboard('gameover', false, 'gameover-lb-status');
    }

    showVictory() {
      if (this.state === 'victory' || this.state === 'menu') return;
      this.clearBossVictoryTimeout();
      this.clearInputs();
      this.state = 'victory';
      this.runFinalized = true; // Locks score permanently after Stage 5!
      const isFinalMap = this.selectedMapIndex >= SR.MAPS.length - 1;
      const isFullCampaignClear = this.chainBonusAwarded;
      const meta = this.level.meta;
      document.getElementById('victory-eyebrow').textContent = isFullCampaignClear
        ? '✦ ALL 5 REALMS CONQUERED (+5,000 BONUS) ✦'
        : `✦ STAGE ${this.selectedMapIndex + 1} / 5 CLEARED ✦`;
      document.getElementById('victory-title').textContent = isFullCampaignClear
        ? 'Dreamland Grand Champion!'
        : `${meta.name} Cleared!`;
      document.getElementById('victory-sub').textContent = isFullCampaignClear
        ? 'Conquered all 5 realms continuously! Your Stage 5 & 5-Stage records are saved.'
        : `${meta.bossTitle} fell! Your Stage ${this.selectedMapIndex + 1} & continuous run records are saved.`;

      this.el.btnNextStage.classList.toggle('hidden', isFinalMap);
      if (!isFinalMap) {
        this.el.btnNextStage.textContent = `Enter Stage ${this.selectedMapIndex + 2}: ${SR.MAPS[this.selectedMapIndex + 1].name} ✦`;
      }

      const stars = this.stageDeaths === 0 && this.player.hp >= 4 ? '★★★' : (this.stageDeaths <= 2 ? '★★☆' : '★☆☆');
      document.getElementById('victory-rank').textContent = stars;
      this.renderResultStats('victory-stats', [
        { label: `Stage ${this.selectedMapIndex + 1} Score`, value: this.score.toLocaleString() },
        { label: '5-Stage Total', value: this.getCombinedScore().toLocaleString() },
        { label: 'Total Time', value: this.formatDuration(this.runDuration) }
      ]);
      this.el.victoryOverlay.classList.remove('hidden');
      this.recordAndShowResultLeaderboard('victory', true, 'victory-lb-status');
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
          this.checkpointSnapshot = { score: this.score, kills: this.kills };
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
          this.collectedPickupIds.add(pk.id);
          if (pk.kind === 'heart') {
            p.hp = Math.min(p.maxHp, p.hp + 2);
            SR.audio.pickup(true);
            SR.particles.spawnBurst(pk.x, pk.y, ['#ff86c0', '#ffffff'], 12, { speedMin: 50, speedMax: 140, shape: 'star' });
            SR.particles.spawnText(pk.x, pk.y - 12, '+2 HP ♥', '#ff9fd6', 1.15);
          } else {
            if (!this.runFinalized) this.score += 75;
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
        return;
      }

      if (this.state !== 'playing') return;

      if (this.hitstop > 0) {
        this.hitstop -= dt;
        this.updateHud();
        return;
      }

      this.runDuration += dt;
      this.stageDuration += dt;
      if (this.comboTimer > 0) {
        this.comboTimer -= dt;
        if (this.comboTimer <= 0) this.combo = 0;
      }
      if (this.bannerTimer > 0) {
        this.bannerTimer -= dt;
        if (this.bannerTimer <= 0) this.el.territoryBanner.classList.remove('visible');
      }

      this.updateMovingPlatforms(dt);
      this.input.aimMode = this.aimMode;
      this.input.mouseWorldX = this.camX + this.mouse.x;
      this.input.mouseWorldY = this.camY + this.mouse.y;
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

      this.updateSkillChargeSlot(
        this.el.slotSkill, this.el.slotSkillMask, this.el.slotSkillCd, this.el.slotSkillCharges,
        this.player.skillCharges, this.player.skillMaxCharges, this.player.skillTimer, this.player.def.skillCooldown
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

    updateSkillChargeSlot(slotEl, maskEl, cdTextEl, chargeEl, charges, maxCharges, timer, maxCd) {
      if (!slotEl || !maskEl || !cdTextEl) return;
      if (chargeEl) {
        chargeEl.textContent = String(charges);
        chargeEl.classList.toggle('empty', charges <= 0);
      }
      if (charges >= maxCharges) {
        slotEl.classList.remove('on-cd');
        slotEl.classList.add('ready');
        maskEl.style.background = 'none';
        cdTextEl.classList.add('hidden');
      } else if (charges > 0) {
        const remFrac = SR.clamp(timer / maxCd, 0, 1);
        const deg = Math.round(remFrac * 360);
        slotEl.classList.remove('on-cd');
        slotEl.classList.add('ready');
        maskEl.style.background = `conic-gradient(rgba(10, 6, 26, 0.36) 0deg ${deg}deg, transparent ${deg}deg 360deg)`;
        cdTextEl.classList.add('hidden');
      } else {
        const remFrac = SR.clamp(timer / maxCd, 0, 1);
        const deg = Math.round(remFrac * 360);
        slotEl.classList.add('on-cd');
        slotEl.classList.remove('ready');
        maskEl.style.background = `conic-gradient(rgba(10, 6, 26, 0.78) 0deg ${deg}deg, transparent ${deg}deg 360deg)`;
        cdTextEl.textContent = timer >= 10 ? Math.ceil(timer) : timer.toFixed(1);
        cdTextEl.classList.remove('hidden');
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
