# Starlight Reverie · 夢光幻境

A pure HTML5 Canvas + Web Audio API 5-stage pastel-fantasy 2D side-scrolling action platformer playable directly in your browser — **zero installs, zero build step, works offline via `file://` or online**.

## Play Online · 線上遊玩
- **Live Site (GitHub Pages):** https://skyhuang1208.github.io/starlight-reverie/
- **Run Locally:** Download/clone this repo and open `index.html` directly in any modern browser.

---

## Playable Heroes · 可選英雄

All 3 heroes support **360° Mouse Aim** (Style A) and **0° / ±90° Keyboard Aim** (Style B) with live angled weapon animations!

| Hero | Difficulty | Normal Attack (`1` / `LMB`) | Skill (`2` / `RMB`) | Ult (`3` / `Q`, 15s CD) |
|---|---|---|---|---|
| **Luna · 法師** | 🟢 Beginner · 新手 | **🔥 Fire Bolt** — 3 aimed homing fire bolts with fiery splash | **❄️ Ice Volley** — 5 auto-tracking piercing ice bolts that chill & slow enemies | **⚡ Thunderbolt** — Piercing Mega Lightning Rail-Bolt + 8 homing lightning bolts |
| **Pip · 射手** | 🟡 Intermediate · 進階 | **🔫 Silver Burst** — Tight 30° 3-bullet silver burst (every 4th shot fires piercing platinum rounds) | **🌟 Gold Volley** — 5 piercing gleaming golden bullets + brief dodge-step grace | **☄️ Solar Nova** — 3 rapid waves of molten-gold railbeams & golden prism bullets following your live aim |
| **Lyra · 戰士** | 🔴 Advanced · 高手 | **⚔️ Star-Blade** — Fluid 3-hit sword combo that deflects enemy orbs & launches white-blue **劍氣** waves | **🗡️ Blade Surge** — Fast directional air/ground sword sprint that cuts enemies, blocks/deflects **frontal** shots (back remains open), grants path contact/dash immunity, and fires a large **劍氣** wave at the end | **☄️ Starfall** — Wide sword burst + 3 aimed **劍氣** waves + 6 Celestial Falling Swords |

---

## 5 Stages, Mid-Bosses & Final Bosses · 五大關卡與頭目

Each stage spans `12,440px` of handcrafted terrain (slide arches, one-way bars, floating clouds, 3 checkpoints, dynamic tracking thunderclouds & rain puddles) culminating in an **Animal/Creature Mid-Boss** and a **Human Final Boss** (each Human Boss features ranged throws, ultra-fast arena dashes, sky-drop rain, and **Summon Reinforcements**):

| Stage | Realm · 關卡名稱 | Difficulty | Theme & Highlights | 🛡️ Mid-Boss · 中頭目 | 👑 Final Boss · 關底頭目 |
|---|---|---|---|---|---|
| **1** | **Dreamlight Meadow · 夢光草原** | ★☆☆☆☆ | Pastel blossoms, crystal slide arches, Skyglass Plateau, and Moonlit Basin | **Celes-Bunny Golem · 露晶兔守護偶** — Stomp shockwaves, crystal shard eruptions, orb volleys & arena dash | **Grandma Lin · 巷口阿嬤** — Homing scold bubbles (`不穿外套!`), cane dash, turbo wheelchair charge & grocery market rain |
| **2** | **Whispering Cloudspire · 雲穹秘境** | ★★☆☆☆ | High-altitude Skyglass Bridges, floating cloud lifts, and Prism Turret garrisons | **Nyxia, Dream-Moth · 幻夢彩蝶** — Dual-speed petal fans, spiral storms, meteor rain & full-arena sweeps | **Coach Chad · 熱血體育生** — Jump badminton smashes, tennis cannons, bouncing basketball 3-pointers, sky sports rain & 100m sprint dash |
| **3** | **Velvet Dusk Woods · 暮櫻幻林** | ★★★☆☆ | Twilight sakura forests, Shadow Dasher ambushes, and the Twilight Trading Floor | **Zephyra, Owl-Seraph · 天光羽翼** — Aerial perches, tempest petal fans, spiral barrages & wing sweeps | **Victor, Day-Trade Wolf · 當沖股神** — Red/green K-line candlestick fans, `-10%` Limit-Down crash rain, bull-run breakout dash & homing `ALL-IN` orders |
| **4** | **Frostmoon Citadel · 寒月冰城** | ★★★★☆ | Aurora glacier ramparts, icy mirror basins, and the Sub-Zero Server Hall | **Frost-Bunny Golem · 寒霜兔巨偶** — Upgraded frost shockwaves, 5-way icy fans & rapid crystal dashes | **Kevin, 3AM Engineer · 爆肝工程師** — Homing code & API errors (`404`, `429`, `No Tokens`), `404 Not Found` / `Not Enough Tokens` / `STACK OVERFLOW` sky rain & triple-espresso dash tossing hot mugs |
| **5** | **Crimson Dream-Hell · 緋紅夢獄** | ★★★★★ | Obsidian lava basins, blood-eclipse moon, crimson thunderclouds, and the After-School Hell Gym | **Malakor, Abyssal Dragon · 深淵焰龍** — 11-way abyssal fans, 8-arm spiral storms, meteor cataclysm & shadow summons | **Mika · 水手服女高中生** — Mega sneeze storm + sky tissue/mask rain, rapid ballistic dumbbells, bubbling 麻辣鴛鴦火鍋 rain & full-arena workout dash |

---

## Scarce Mini-Bosses · 四大特色小頭目

Appearing across stages and summoned by Human Bosses as elite reinforcements:
- **柴犬武士 (Shiba Samurai):** Telegraphed 0.5s hilt-grip **platform-crossing Iaijutsu Dash** + **Sonic Bark (`汪！！`)** knockback wave.
- **外送飆車哥 (Delivery Scooter):** Revs up and zooms across lanes flinging a Taiwanese night-market feast (**珍奶、雞排、肉丸子串、臭豆腐、炒麵、炒飯**).
- **滑板柯基 (Corgi Skater):** Performs **360° Ollie Kickflips** with landing shockwaves and high-speed **Skate Dashes**.
- **亂丟貓咪 (Stuff-Throwing Cat):** Rapidly hurls chaotic household items (**keyboards, beer mugs, coffee cups, potted plants, mice, slippers, clocks & fishbones**).

---

## ✨ 金手指區 (Golden Finger Cheats)

Available directly on the top-right of the Starter Menu for casual play or boss practice:
- **無敵不扣血 (`No Damage`):** Blocks all incoming enemy, projectile, dash, and lightning damage with a golden shield flash.
- **一拳必殺 (`1-Punch KO`):** Defeats any enemy, mini-boss, or boss in a single hit.

> **Leaderboard Note:** Toggling either cheat on at any point during a run marks that run **Unranked (`金手指模式 · 不計入排行榜`)** so leaderboard rankings stay 100% fair.

---

## Dual Non-Colliding Controls · 雙操作模式

Both control styles work simultaneously without key conflicts:
- **Style A · WASD + Mouse (360° Aim):**
  - `A / D` Move · `W / Space` Jump & Double Jump · `S / Shift` Slide / Drop Bar
  - **Mouse Pointer** aims 360° · `LMB` Attack · `RMB` Skill · `Q` Ult
- **Style B · Arrows + 1 / 2 / 3 (0° / ±90° Aim):**
  - `← / →` Move & Aim Left/Right (`0°`) · Hold `↑` Aim Straight Up (`-90°`) · Hold `↓` in mid-air Aim Straight Down (`+90°`)
  - `Space` Jump & Double Jump · `Shift / ↓` Slide / Drop Bar · `1` Attack · `2` Skill · `3` Ult
- **System Keys:** `Esc` or `P` Pause · `M` Mute / Unmute Audio
- **Slide Rule:** Extended sliding evades normal enemy body contact (`SLIDE EVADE`), **but does NOT avoid projectiles, dash attacks, or lightning strikes**.

---

## 🏆 Leaderboard & Fair Scoring · 排行榜系統

- **6 Separate Boards:** Individual leaderboards for **`Stage 1` – `Stage 5`** (every stage starts at `0`, making direct stage runs 100% fair) + **`🏆 5-Stage Combined · 五關連續總榜`** (accumulates across consecutive stages without returning to menu; clearing **Stage 1 → 5** continuously awards a **`+5,000` Full Clear Bonus**).
- **4 Character Pages:** **`All · 全部`**, **`✨ Luna`**, **`🔫 Pip`**, and **`⚔️ Lyra`** — displayed directly after Death and Stage Clear (no auto-skip countdown!).
- **Deduplicated Top 100:** Keeps only each player's highest personal best (capped at 100 records per board); Checkpoint Retries roll back to checkpoint score with a `-500` pt penalty, boss-summoned minions award `0` pts, and Lyra deflect points are capped per stage to prevent farming.
