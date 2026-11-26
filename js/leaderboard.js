// Secure Multi-Board & 4-Character-Tab Leaderboard Client (Cloudflare Workers + KV + Local Fallback)
// - Separate boards: 'stage_1'..'stage_5' + 'campaign' (5-stage combined)
// - 4 Character Pages per board: 'all' (All Heroes, deduped by player name) | 'magic' (Luna) | 'gun' (Pip) | 'blade' (Lyra)
// - Strict deduplication: keeps ONLY each player's highest score per (board, charId), capped at 100 records per board
// - Strict DOM textContent rendering (zero innerHTML with user data -> XSS-proof)
window.SR = window.SR || {};

(function (SR) {
  const LOCAL_STORAGE_KEY = 'sr_leaderboard_v3';
  const MAX_RECORDS = 100;
  const VALID_BOARDS = ['campaign', 'stage_1', 'stage_2', 'stage_3', 'stage_4', 'stage_5'];
  const VALID_CHAR_FILTERS = ['all', 'magic', 'gun', 'blade'];
  const HERO_DISPLAY = {
    magic: 'Luna',
    gun: 'Pip',
    blade: 'Lyra'
  };

  function normNameKey(name) {
    return String(name || 'Dreamer').trim().toLowerCase();
  }

  function compareEntries(a, b) {
    if (b.score !== a.score) return b.score - a.score;
    if ((b.cleared ? 1 : 0) !== (a.cleared ? 1 : 0)) return (b.cleared ? 1 : 0) - (a.cleared ? 1 : 0);
    if ((a.deaths || 0) !== (b.deaths || 0)) return (a.deaths || 0) - (b.deaths || 0);
    return (a.durationSec || 99999) - (b.durationSec || 99999);
  }

  // Deduplicate keeping ONLY the highest-ranked record per (playerName + charId), capped to MAX_RECORDS
  function dedupAndSort(list) {
    const bestByKey = new Map();
    for (const item of list) {
      if (!item || !item.score || item.score <= 0) continue;
      const key = `${normNameKey(item.name)}::${item.charId || 'magic'}`;
      const prev = bestByKey.get(key);
      if (!prev || compareEntries(item, prev) < 0) {
        bestByKey.set(key, item);
      }
    }
    return Array.from(bestByKey.values()).sort(compareEntries).slice(0, MAX_RECORDS);
  }

  // Filter entries for one of the 4 character pages:
  // - 'all': deduplicated by player name (each player appears ONCE with their single highest hero score!)
  // - 'magic' | 'gun' | 'blade': only that hero's deduplicated personal-best scores
  function filterByCharPage(entries, charFilter = 'all') {
    const cf = VALID_CHAR_FILTERS.includes(charFilter) ? charFilter : 'all';
    if (cf === 'all') {
      const bestByPlayer = new Map();
      for (const item of entries || []) {
        const pkey = normNameKey(item.name);
        const prev = bestByPlayer.get(pkey);
        if (!prev || compareEntries(item, prev) < 0) {
          bestByPlayer.set(pkey, item);
        }
      }
      return Array.from(bestByPlayer.values()).sort(compareEntries).slice(0, MAX_RECORDS);
    }
    return (entries || []).filter((e) => e.charId === cf).sort(compareEntries).slice(0, MAX_RECORDS);
  }

  class LeaderboardClient {
    constructor() {
      this.activeToken = null;
      this.cachedBoards = this.loadLocalAll();
      this.lastMode = this.isCloudEnabled() ? 'cloud' : 'local';
    }

    normalizeBoard(board) {
      return VALID_BOARDS.includes(board) ? board : 'stage_1';
    }

    normalizeCharFilter(cf) {
      return VALID_CHAR_FILTERS.includes(cf) ? cf : 'all';
    }

    getApiBase() {
      return (SR.LEADERBOARD_API_URL || '').trim().replace(/\/+$/, '');
    }

    isCloudEnabled() {
      const base = this.getApiBase();
      if (!base) return false;
      return /^https:\/\//i.test(base) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(base);
    }

    sanitizeName(raw) {
      return String(raw || '')
        .replace(/[\u0000-\u001f\u007f<>]/g, '')
        .trim()
        .replace(/\s+/g, ' ')
        .slice(0, 18) || 'Dreamer';
    }

    loadLocalAll() {
      const empty = {};
      VALID_BOARDS.forEach((b) => { empty[b] = []; });
      try {
        const raw = window.localStorage.getItem(LOCAL_STORAGE_KEY);
        if (!raw) return empty;
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          VALID_BOARDS.forEach((b) => {
            if (Array.isArray(parsed[b])) empty[b] = dedupAndSort(parsed[b]);
          });
        }
      } catch (_) {}
      return empty;
    }

    saveLocalAll(allBoards) {
      try {
        window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(allBoards));
      } catch (_) {}
    }

    // Request an HMAC-signed session token for a continuous run (covers S_start..S5 + campaign)
    async startRun(charId, startStage) {
      this.activeToken = null;
      if (!this.isCloudEnabled()) return null;
      try {
        const res = await fetch(`${this.getApiBase()}/api/run/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            charId: HERO_DISPLAY[charId] ? charId : 'magic',
            startStage: SR.clamp(parseInt(startStage, 10) || 1, 1, 5)
          })
        });
        if (!res.ok) return null;
        const data = await res.json();
        if (data && typeof data.token === 'string') {
          this.activeToken = data.token;
        }
        return this.activeToken;
      } catch (_) {
        return null;
      }
    }

    clearRunToken() {
      this.activeToken = null;
    }

    // Reset local scores (board = 'all' or specific board)
    resetLocal(board = 'all') {
      const all = this.loadLocalAll();
      if (board === 'all') {
        VALID_BOARDS.forEach((b) => { all[b] = []; });
      } else {
        const b = this.normalizeBoard(board);
        all[b] = [];
      }
      this.saveLocalAll(all);
      this.cachedBoards = all;
      return { ok: true, mode: 'local', cleared: board === 'all' ? VALID_BOARDS.slice() : [this.normalizeBoard(board)] };
    }

    // Owner-only reset: resets local cache, and in Cloud mode authenticates via X-Admin-Key header (never stored in client!)
    async adminReset(board = 'all', adminKey = '') {
      if (!this.isCloudEnabled()) {
        return this.resetLocal(board);
      }
      const key = String(adminKey || '').trim();
      if (!key) return { ok: false, error: 'missing_key' };
      try {
        const res = await fetch(`${this.getApiBase()}/api/admin/reset`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Admin-Key': key
          },
          body: JSON.stringify({ board })
        });
        const data = await res.json().catch(() => null);
        if (res.ok && data && data.ok) {
          this.resetLocal(board);
          return { ok: true, mode: 'cloud', cleared: data.cleared || [] };
        }
        return { ok: false, error: (data && data.error) || `http_${res.status}` };
      } catch (_) {
        return { ok: false, error: 'network_error' };
      }
    }

    async fetchTop(board = 'stage_1') {
      const b = this.normalizeBoard(board);
      if (this.isCloudEnabled()) {
        try {
          const res = await fetch(`${this.getApiBase()}/api/scores?board=${encodeURIComponent(b)}`, { method: 'GET' });
          if (res.ok) {
            const data = await res.json();
            if (data && Array.isArray(data.entries)) {
              this.cachedBoards[b] = dedupAndSort(data.entries);
              this.lastMode = 'cloud';
              return { mode: 'cloud', board: b, entries: this.cachedBoards[b] };
            }
          }
        } catch (_) {}
      }
      const all = this.loadLocalAll();
      this.cachedBoards = all;
      this.lastMode = 'local';
      return { mode: 'local', board: b, entries: all[b] || [] };
    }

    async submitScore(payload) {
      const b = this.normalizeBoard(payload.board);
      const entry = {
        board: b,
        name: this.sanitizeName(payload.name),
        score: Math.max(0, Math.round(Number(payload.score) || 0)),
        charId: HERO_DISPLAY[payload.charId] ? payload.charId : 'magic',
        startStage: SR.clamp(parseInt(payload.startStage, 10) || 1, 1, 5),
        endStage: SR.clamp(parseInt(payload.endStage, 10) || 1, 1, 5),
        stagesCleared: SR.clamp(parseInt(payload.stagesCleared, 10) || 0, 0, 5),
        kills: Math.max(0, Math.round(Number(payload.kills) || 0)),
        deaths: Math.max(0, Math.round(Number(payload.deaths) || 0)),
        durationSec: Math.max(1, Math.round(Number(payload.durationSec) || 1)),
        cleared: !!payload.cleared,
        ts: Date.now()
      };

      if (entry.score <= 0) {
        return { saved: false, mode: this.lastMode, board: b, improved: false, entries: this.cachedBoards[b] || [] };
      }

      // Local deduplicated personal-best update
      const allLocal = this.loadLocalAll();
      const prevList = allLocal[b] || [];
      const prevBest = prevList.find(
        (e) => normNameKey(e.name) === normNameKey(entry.name) && e.charId === entry.charId
      );
      const improvedLocal = !prevBest || compareEntries(entry, prevBest) < 0;
      const mergedLocal = dedupAndSort(prevList.concat([entry]));
      allLocal[b] = mergedLocal;
      this.saveLocalAll(allLocal);
      const localAllView = filterByCharPage(mergedLocal, 'all');
      const localRank = localAllView.findIndex((e) => normNameKey(e.name) === normNameKey(entry.name)) + 1;

      if (this.isCloudEnabled() && this.activeToken) {
        try {
          const res = await fetch(`${this.getApiBase()}/api/scores`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...entry, token: this.activeToken })
          });
          const data = await res.json().catch(() => null);
          if (res.ok && data && Array.isArray(data.entries)) {
            const clean = dedupAndSort(data.entries);
            this.cachedBoards[b] = clean;
            this.lastMode = 'cloud';
            const cloudAllView = filterByCharPage(clean, 'all');
            const cloudRank = cloudAllView.findIndex((e) => normNameKey(e.name) === normNameKey(entry.name)) + 1;
            return {
              saved: true,
              mode: 'cloud',
              board: b,
              improved: data.improved !== false,
              rank: cloudRank || data.rank || null,
              entries: clean
            };
          }
        } catch (_) {}
      }

      this.cachedBoards[b] = mergedLocal;
      this.lastMode = 'local';
      return {
        saved: true,
        mode: 'local',
        board: b,
        improved: improvedLocal,
        rank: localRank || null,
        entries: mergedLocal
      };
    }

    formatTime(sec) {
      const s = Math.max(0, Math.floor(sec || 0));
      const m = Math.floor(s / 60);
      const rem = s % 60;
      return m > 0 ? `${m}:${String(rem).padStart(2, '0')}` : `${rem}s`;
    }

    getBoardTitle(board) {
      if (board === 'campaign') return '5-Stage Combined · 五關連續總榜';
      const num = String(board || 'stage_1').replace('stage_', '');
      return `Stage ${num} Leaderboard · 第 ${num} 關排行`;
    }

    // Strict DOM-only renderer supporting 4 character pages ('all' | 'magic' | 'gun' | 'blade') up to 100 records
    renderList(containerEl, entries, board = 'stage_1', charFilter = 'all', highlightName = '') {
      if (!containerEl) return;
      containerEl.textContent = '';

      const filtered = filterByCharPage(entries, charFilter);
      if (filtered.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'lb-empty';
        const heroHint = charFilter === 'all' ? '' : ` (${HERO_DISPLAY[charFilter] || charFilter})`;
        empty.textContent = board === 'campaign'
          ? `No 5-Stage scores${heroHint} yet — play continuously without cheats to claim #1!`
          : `No Stage ${board.replace('stage_', '')} scores${heroHint} yet — claim #1!`;
        containerEl.appendChild(empty);
        return;
      }

      const normHighlight = normNameKey(highlightName);
      filtered.slice(0, MAX_RECORDS).forEach((row, idx) => {
        const item = document.createElement('div');
        item.className = 'lb-row';
        if (idx === 0) item.classList.add('lb-top-1');
        else if (idx === 1) item.classList.add('lb-top-2');
        else if (idx === 2) item.classList.add('lb-top-3');
        if (highlightName && normNameKey(row.name) === normHighlight) {
          item.classList.add('lb-me');
        }

        const rankEl = document.createElement('span');
        rankEl.className = 'lb-rank';
        rankEl.textContent = idx === 0 ? '👑' : (idx === 1 ? '🥈' : (idx === 2 ? '🥉' : `#${idx + 1}`));

        const nameEl = document.createElement('span');
        nameEl.className = 'lb-name';
        nameEl.textContent = row.name || 'Dreamer';

        const metaEl = document.createElement('span');
        metaEl.className = 'lb-meta';
        const heroLabel = HERO_DISPLAY[row.charId] || 'Luna';
        const deathTxt = (row.deaths || 0) === 0 ? '0☠' : `${row.deaths}☠`;
        let progressTxt = '';
        if (board === 'campaign') {
          progressTxt = (row.startStage === 1 && row.cleared && row.stagesCleared >= 5)
            ? 'S1→5✦'
            : `S${row.startStage || 1}→${row.endStage || 1}`;
        } else {
          progressTxt = row.cleared ? 'CLEAR✦' : 'TRY';
        }
        metaEl.textContent = charFilter === 'all'
          ? `${heroLabel} · ${progressTxt} · ${deathTxt} · ${this.formatTime(row.durationSec)}`
          : `${progressTxt} · ${deathTxt} · ${this.formatTime(row.durationSec)}`;

        const scoreEl = document.createElement('span');
        scoreEl.className = 'lb-score';
        scoreEl.textContent = Number(row.score || 0).toLocaleString();

        item.appendChild(rankEl);
        item.appendChild(nameEl);
        item.appendChild(metaEl);
        item.appendChild(scoreEl);
        containerEl.appendChild(item);
      });
    }
  }

  SR.LEADERBOARD_BOARDS = VALID_BOARDS;
  SR.LEADERBOARD_MAX_RECORDS = MAX_RECORDS;
  SR.leaderboard = new LeaderboardClient();
})(window.SR);
