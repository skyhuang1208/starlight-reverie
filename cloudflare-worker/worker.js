// Starlight Reverie — Secure Multi-Board Cloudflare Workers + KV Leaderboard Backend
// - 6 Boards: 'stage_1'..'stage_5' + 'campaign' (continuous multi-stage chain)
// - Limit: 100 deduplicated records per board (keeps ONLY each player's highest score per (name, charId))
// - Security: HMAC-SHA256 run session tokens (supports continuous S_start..S5 progression & checkpoint retry upgrades),
//   per-IP rate limiting, strict CORS Origin allowlist, wall-clock validation, and per-board mathematical score ceilings.

const MAX_RECORDS = 100;
const TOKEN_TTL_MS = 1000 * 60 * 90; // 90 minutes max continuous session
const MAX_BODY_BYTES = 2048;
const RATE_LIMIT_MAX = 30;
const RATE_LIMIT_WINDOW_SEC = 600; // 30 score updates per 10 minutes per IP
const VALID_CHARS = new Set(['magic', 'gun', 'blade']);
const VALID_BOARDS = new Set(['campaign', 'stage_1', 'stage_2', 'stage_3', 'stage_4', 'stage_5']);

// Mathematical upper-bound score ceilings per board
const BOARD_CEILINGS = {
  campaign: 165000,
  stage_1: 30000,
  stage_2: 33000,
  stage_3: 36000,
  stage_4: 38000,
  stage_5: 44000
};

function getAllowedOrigins(env) {
  const raw = (env.ALLOWED_ORIGINS || 'https://skyhuang1208.github.io').split(',');
  return raw.map((s) => s.trim()).filter(Boolean);
}

function corsHeaders(origin, allowed) {
  const allow = origin && allowed.includes(origin) ? origin : allowed[0];
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Key',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'no-store'
  };
}

function json(data, status, headers) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers }
  });
}

function b64urlEncode(bytes) {
  let str = '';
  for (let i = 0; i < bytes.length; i++) str += String.fromCharCode(bytes[i]);
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function b64urlDecode(str) {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((str.length + 3) % 4);
  const bin = atob(padded);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function hmacSign(secret, message) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  return b64urlEncode(new Uint8Array(sig));
}

function timingSafeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function issueToken(secret, payload) {
  const encoded = b64urlEncode(new TextEncoder().encode(JSON.stringify(payload)));
  const sig = await hmacSign(secret, encoded);
  return `${encoded}.${sig}`;
}

async function verifyToken(secret, token) {
  if (typeof token !== 'string' || !token.includes('.')) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [encoded, sig] = parts;
  const expected = await hmacSign(secret, encoded);
  if (!timingSafeEqual(sig, expected)) return null;
  try {
    return JSON.parse(new TextDecoder().decode(b64urlDecode(encoded)));
  } catch (_) {
    return null;
  }
}

async function readJsonBody(request) {
  const ct = request.headers.get('Content-Type') || '';
  if (!ct.toLowerCase().includes('application/json')) return null;
  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) return null;
  try {
    return JSON.parse(text);
  } catch (_) {
    return null;
  }
}

function sanitizeName(raw) {
  return String(raw || '')
    .replace(/[\u0000-\u001f\u007f<>]/g, '')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, 18);
}

function normNameKey(name) {
  return String(name || '').trim().toLowerCase();
}

function compareEntries(a, b) {
  if (b.score !== a.score) return b.score - a.score;
  if ((b.cleared ? 1 : 0) !== (a.cleared ? 1 : 0)) return (b.cleared ? 1 : 0) - (a.cleared ? 1 : 0);
  if ((a.deaths || 0) !== (b.deaths || 0)) return (a.deaths || 0) - (b.deaths || 0);
  return (a.durationSec || 99999) - (b.durationSec || 99999);
}

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

function isPlausibleScore(entry, token, nowMs) {
  const wallSec = (nowMs - token.startedAt) / 1000;
  if (wallSec < 4 || nowMs - token.startedAt > TOKEN_TTL_MS) return false;
  if (entry.durationSec > wallSec + 15) return false;
  if (entry.charId !== token.charId) return false;

  if (entry.board === 'campaign') {
    if (entry.startStage !== token.startStage) return false;
    if (entry.endStage < token.startStage) return false;
    const maxPossibleStages = 6 - token.startStage;
    if (entry.stagesCleared > maxPossibleStages) return false;
    if (entry.stagesCleared > 0 && wallSec < entry.stagesCleared * 12) return false;
  } else {
    const stageNum = parseInt(entry.board.replace('stage_', ''), 10);
    if (stageNum < token.startStage || stageNum > 5) return false;
    if (entry.cleared && wallSec < 12) return false;
  }

  const ceiling = BOARD_CEILINGS[entry.board] || 35000;
  const fullCampaignBonus = (entry.board === 'campaign' && token.startStage === 1 && entry.cleared && entry.stagesCleared >= 5) ? 5000 : 0;
  const maxByKills = entry.kills * 1100 + entry.stagesCleared * 14500 + fullCampaignBonus + 4500;
  if (entry.score <= 0 || entry.score > Math.min(maxByKills, ceiling)) return false;
  return true;
}

export default {
  async fetch(request, env) {
    const allowed = getAllowedOrigins(env);
    const origin = request.headers.get('Origin') || '';
    const headers = corsHeaders(origin, allowed);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers });
    }

    if (request.method === 'POST' && origin && !allowed.includes(origin)) {
      return json({ error: 'origin_not_allowed' }, 403, headers);
    }

    const url = new URL(request.url);

    // 1) GET /api/scores?board=stage_1..stage_5|campaign
    if (request.method === 'GET' && url.pathname === '/api/scores') {
      const reqBoard = url.searchParams.get('board') || 'stage_1';
      const board = VALID_BOARDS.has(reqBoard) ? reqBoard : 'stage_1';
      const entries = (await env.LEADERBOARD_KV.get(`scores:${board}`, { type: 'json' })) || [];
      return json({ board, entries }, 200, headers);
    }

    if (!env.LEADERBOARD_SECRET || env.LEADERBOARD_SECRET.length < 16) {
      return json({ error: 'server_misconfigured' }, 500, headers);
    }

    // 2) POST /api/run/start — Issue HMAC-signed continuous run session token
    if (request.method === 'POST' && url.pathname === '/api/run/start') {
      const body = await readJsonBody(request);
      if (!body) return json({ error: 'invalid_body' }, 400, headers);
      const charId = VALID_CHARS.has(body.charId) ? body.charId : 'magic';
      const startStage = Math.max(1, Math.min(5, parseInt(body.startStage, 10) || 1));

      const token = await issueToken(env.LEADERBOARD_SECRET, {
        runId: crypto.randomUUID(),
        startedAt: Date.now(),
        charId,
        startStage
      });
      return json({ token }, 200, headers);
    }

    // 3) POST /api/scores — Verify session token, deduplicate keeping personal best, cap at 100
    if (request.method === 'POST' && url.pathname === '/api/scores') {
      const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
      const rateKey = `rl:${ip}`;
      const hits = parseInt((await env.LEADERBOARD_KV.get(rateKey)) || '0', 10);
      if (hits >= RATE_LIMIT_MAX) {
        return json({ error: 'rate_limited' }, 429, headers);
      }
      await env.LEADERBOARD_KV.put(rateKey, String(hits + 1), { expirationTtl: RATE_LIMIT_WINDOW_SEC });

      const body = await readJsonBody(request);
      if (!body) return json({ error: 'invalid_body' }, 400, headers);

      const tokenData = await verifyToken(env.LEADERBOARD_SECRET, body.token);
      if (!tokenData || !tokenData.runId) {
        return json({ error: 'invalid_token' }, 401, headers);
      }

      const board = VALID_BOARDS.has(body.board) ? body.board : null;
      if (!board) return json({ error: 'invalid_board' }, 400, headers);

      const name = sanitizeName(body.name);
      if (!name) return json({ error: 'invalid_name' }, 400, headers);

      const entry = {
        board,
        name,
        score: Math.round(Number(body.score) || 0),
        charId: tokenData.charId,
        startStage: board === 'campaign' ? tokenData.startStage : parseInt(board.replace('stage_', ''), 10),
        endStage: Math.max(1, Math.min(5, parseInt(body.endStage, 10) || tokenData.startStage)),
        stagesCleared: Math.max(0, Math.min(5, parseInt(body.stagesCleared, 10) || 0)),
        kills: Math.max(0, Math.min(400, Math.round(Number(body.kills) || 0))),
        deaths: Math.max(0, Math.min(99, Math.round(Number(body.deaths) || 0))),
        durationSec: Math.max(1, Math.min(5400, Math.round(Number(body.durationSec) || 1))),
        cleared: !!body.cleared,
        ts: Date.now()
      };

      if (!isPlausibleScore(entry, tokenData, Date.now())) {
        return json({ error: 'implausible_score' }, 422, headers);
      }

      // Per-session guard: once a stage board is locked as cleared in this run, don't allow inflating it later
      const runKey = `run:${tokenData.runId}`;
      const runState = (await env.LEADERBOARD_KV.get(runKey, { type: 'json' })) || { locked: {} };
      if (runState.locked[board]) {
        return json({ error: 'board_already_finalized_for_run' }, 409, headers);
      }
      if (entry.cleared && (board !== 'campaign' || entry.endStage >= 5)) {
        runState.locked[board] = true;
      }
      await env.LEADERBOARD_KV.put(runKey, JSON.stringify(runState), { expirationTtl: 60 * 100 });

      const kvKey = `scores:${board}`;
      const current = (await env.LEADERBOARD_KV.get(kvKey, { type: 'json' })) || [];
      const prevBest = current.find(
        (e) => normNameKey(e.name) === normNameKey(entry.name) && e.charId === entry.charId
      );
      const improved = !prevBest || compareEntries(entry, prevBest) < 0;

      const updated = improved ? dedupAndSort(current.concat([entry])) : dedupAndSort(current);
      if (improved) {
        await env.LEADERBOARD_KV.put(kvKey, JSON.stringify(updated));
      }

      const rank = updated.findIndex(
        (e) => normNameKey(e.name) === normNameKey(entry.name) && e.charId === entry.charId
      ) + 1;
      return json({ ok: true, board, improved, rank: rank || null, entries: updated }, 200, headers);
    }

    // 4) POST /api/admin/reset — Owner-only reset protected by encrypted ADMIN_RESET_KEY secret
    // Body: { board: "all" | "campaign" | "stage_1".."stage_5" }, Header: X-Admin-Key: <ADMIN_RESET_KEY>
    if (request.method === 'POST' && url.pathname === '/api/admin/reset') {
      if (!env.ADMIN_RESET_KEY || env.ADMIN_RESET_KEY.length < 12) {
        return json({ error: 'admin_reset_not_configured' }, 503, headers);
      }
      const providedKey = request.headers.get('X-Admin-Key') || '';
      if (!timingSafeEqual(providedKey, env.ADMIN_RESET_KEY)) {
        return json({ error: 'unauthorized' }, 401, headers);
      }
      const body = (await readJsonBody(request)) || {};
      const target = body.board || 'all';
      const boardsToClear = target === 'all'
        ? Array.from(VALID_BOARDS)
        : (VALID_BOARDS.has(target) ? [target] : []);
      if (boardsToClear.length === 0) {
        return json({ error: 'invalid_board' }, 400, headers);
      }
      for (const b of boardsToClear) {
        await env.LEADERBOARD_KV.put(`scores:${b}`, '[]');
      }
      return json({ ok: true, cleared: boardsToClear }, 200, headers);
    }

    return json({ error: 'not_found' }, 404, headers);
  }
};
