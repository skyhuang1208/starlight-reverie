# Starlight Reverie — Secure Global Leaderboard (Cloudflare Workers + KV)

Zero-dependency, free-tier Cloudflare Workers + KV backend for **Starlight Reverie · 夢光幻境**.

## Features & Security
- **6 Separate Boards (`stage_1`..`stage_5` + `campaign` 5-stage combined)**, capped at **100 deduplicated personal-best records** per board.
- **HMAC-SHA256 signed session tokens:** Client calls `POST /api/run/start` for a signed session token; `POST /api/scores` verifies signature, wall-clock elapsed time, and per-board mathematical score ceilings.
- **Owner-only Admin Reset (`POST /api/admin/reset`):** Protected by an encrypted `ADMIN_RESET_KEY` Cloudflare Secret (never in Git/frontend) so only you can reset all boards or a single board from the 🗑 icon in the Leaderboard modal or via CLI!
- **Rate-limited & CORS-locked:** Per-IP sliding rate limit + strict Origin allowlist.

---

## Step-by-Step Deployment Guide (Free Cloudflare Account, ~3 Minutes)

### 1. Create the KV Namespace
1. Log in to [dash.cloudflare.com](https://dash.cloudflare.com/).
2. In the left sidebar, go to **Storage & Databases → Workers KV**.
3. Click **Create instance**, name it `LEADERBOARD_KV`, and click **Add**.

### 2. Deploy the Leaderboard Worker
1. Go to **Compute & AI → Workers & Pages → Create → Start with Hello World!**.
2. Name the Worker `starlight-reverie-lb` and click **Deploy**.
3. Click **Edit code**, replace all code with the contents of `cloudflare-worker/worker.js`, and click **Deploy**.

### 3. Bind KV & Set Secrets
In your Worker (`starlight-reverie-lb`) → **Settings**:
1. **Bindings → Add binding → KV namespace**:
   - Variable name: `LEADERBOARD_KV`
   - KV namespace: select `LEADERBOARD_KV` → **Save**.
2. **Variables and Secrets → Add**:
   - Type **Secret**: `LEADERBOARD_SECRET` = any random 32+ character string (used for HMAC signing).
   - Type **Secret**: `ADMIN_RESET_KEY` = your private admin password (12+ chars, used when clicking 🗑 Reset in the Leaderboard!).
   - Type **Text**: `ALLOWED_ORIGINS` = `https://skyhuang1208.github.io` *(if you also host on Cloudflare Pages, comma-separate both, e.g. `https://skyhuang1208.github.io,https://starlight-reverie.pages.dev`)*.

### 4. Connect the Game to Your Worker
1. Copy your Worker URL (e.g. `https://starlight-reverie-lb.<your-subdomain>.workers.dev`).
2. Paste it into `LEADERBOARD_API_URL` inside `js/config.js`.
3. Commit and push to GitHub — the Leaderboard automatically switches from `💾 Local Scores` to `🌐 Global Cloud`!

### 5. (Optional) Also Host the Game on Cloudflare Pages
1. In Cloudflare Dashboard → **Workers & Pages → Create → Pages → Connect to Git**.
2. Select `skyhuang1208/starlight-reverie`, branch `main`.
3. **Framework preset:** `None` · **Build command:** *(leave empty)* · **Build output directory:** `/` (root).
4. Click **Save and Deploy** — Cloudflare Pages auto-deploys every time you push to GitHub!

### Owner Reset via CLI (Alternative to the 🗑 Button)
```bash
curl -X POST "https://starlight-reverie-lb.<your-subdomain>.workers.dev/api/admin/reset" \
  -H "Content-Type: application/json" \
  -H "X-Admin-Key: YOUR_ADMIN_RESET_KEY" \
  -d '{"board":"all"}'
```
*(Pass `"board":"stage_1"`..`"stage_5"` or `"campaign"` to wipe a single board instead of `"all"`.)*
