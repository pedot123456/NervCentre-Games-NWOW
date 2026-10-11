# PMX Digital Challenge – Word Rush
## UI/UX and rebuild specification

**App version:** 1.0.0 · **Spec date:** 10 October 2026 · **Source:** the working app ("Nerv Centre Word Rush" folder)

---

## 0. How to use this document

**Who it is for:** an AI coding assistant, or a developer, rebuilding this web app from scratch without the original source code.

**Goal:** the rebuilt app must look, move, sound and behave the same as the original: the same screens, flow, wording, colours, sizes and game rules.

**Rules for the builder**

1. Where this document gives an exact value (hex colour, rem size, text, timing in ms), use it **verbatim**. Don't "improve" wording, colours or spacing.
2. Don't add screens, features, pop-ups or text that this document doesn't describe.
3. Use the same stack (section 2). The styling is **Tailwind CSS 4** utility classes plus the custom stylesheet in **Appendix A**. Copy Appendix A as-is. Most class names quoted in this document are Tailwind 4 classes, or custom classes defined in Appendix A.
4. The appendices hold the original files for the parts that are hardest to describe in words: stylesheet, logo components, constellation, star background, sounds, game rules, validation and seed content. Copy them as-is.
5. Screenshots (in the PDF, and in the `screens/` folder next to this file) show every screen. The kiosk is captured at 1920×1080, phones at 390×844 (2× pixels) and Admin at 1440×900. When the text and a screenshot disagree, **the text wins** (screenshots contain test data).

**Logo files** (in the `logos/` folder next to this document; also sent separately). Put them in `client/src/assets/` with exactly these names:

| File | Size (px) | What it is | Where it is used |
|---|---|---|---|
| `petronas-logo.png` | 679 × 260 | PETRONAS logo, dark lettering, transparent background | Left (white) half of the partner-logo pill |
| `nervcentre-logo.png` | 744 × 200 | NERVCENTRE logo, version for dark backgrounds | Right (blue) half of the partner-logo pill |
| `nc-logo.png` | 1400 × 376 | Full NERVCENTRE logo (big "N" + wordmark) | Under the constellation in the reveal, battle podium |
| `nc-mark.png` | 624 × 442 | The "N" mark only | Under the constellation on the TV display ("just finished") |

> **Important:** the six constellation stars are placed on the "N" of `nc-logo.png` / `nc-mark.png` by fixed coordinates (Appendix D). Use these exact image files, not re-cropped or re-exported, or the stars won't sit on the letter.

**Suggested prompt** to paste with this document:
> "Rebuild the web app described in the attached specification exactly as written – same stack, same screens, same text, same colours and sizes, same rules. Copy the appendix files verbatim. Use the four logo PNGs I'm attaching, with the file names given in section 0. Don't add anything that isn't in the spec. Start with the project setup (section 2), then the design system (section 4), the shared components (section 5), the screens (sections 6–10), the game logic (section 11) and the back end (section 13). Check the result against the acceptance checklist (section 14)."

---

## 1. What the app is

**PMX Digital Challenge – Word Rush** is a touchscreen booth game for PETRONAS events, run by PMX (Digital Project Management). Players build the names of **six digital solutions** from shuffled word tiles. Each name they build lights one star of a constellation shaped like the "N" of the NERVCENTRE logo. Light all six and the logo is revealed. The fastest time wins.

**Game modes**

| Mode | Where it is played | Players |
|---|---|---|
| **Solo Rush** | Kiosk touchscreen, or a phone opening `#/` | 1 |
| **Multiplayer Battle** | Big screen shows a lobby (room code + QR); players use their own phones (`#/join`) | 2–4 |
| **Head-to-Head** | Two players side by side on one touchscreen, touching at the same time (hidden on phones) | 2 |

**Pages (hash routes)**

| Route | Page | Theme |
|---|---|---|
| `#/` | Kiosk game: splash, home, registration, how-to, race, reveal, feedback, results, leaderboard, battle host, Head-to-Head | Dark blue "night sky" |
| `#/join` or `#/join/1234` | Phone flow for Multiplayer Battle | Dark blue, phone-sized |
| `#/display` | TV screen: live leaderboard, live race, stats | Dark blue |
| `#/admin` | Staff area behind a PIN | Light (white cards on #f5f7fa) |

**The core loop (Solo):** Splash (1 s) → Home → *Tap to Begin* → Registration → How to Play (10 s) → 3-2-1-GO! → 30-second race → Constellation reveal → 3 feedback questions (once per player per day) → Results → Leaderboard → back Home (automatically after 30 s idle).

**The server is the source of truth for time and scores.** Every tap is timed by the server from its own GO time. Devices run the same rules locally, so feedback is instant, and the server's state then replaces the local one. A refresh or a dropped connection never resets a game.

---

## 2. Tech stack and project setup

### 2.1 Stack (match these)

| Layer | Technology |
|---|---|
| Language | **TypeScript 5.9** everywhere (front end, back end, shared rules) |
| Front end | **React 19** + **Vite 8** (`@vitejs/plugin-react`), **Tailwind CSS 4** through `@tailwindcss/vite` (there is **no** `tailwind.config.js`; the theme lives in CSS `@theme`, see Appendix A) |
| Animation | **framer-motion** (slide-ins, bottom sheet, constellation), plus CSS keyframes |
| Icons | **lucide-react** (every icon in this document is a Lucide icon name) |
| Fonts | `@fontsource-variable/inter`, `@fontsource-variable/space-grotesk`, `@fontsource-variable/nunito` (self-hosted, no Google Fonts) |
| Real-time | **Socket.IO 4.8** (`socket.io` and `socket.io-client`), WebSocket with automatic long-polling fallback |
| QR codes | `qrcode` (generates an SVG on the device, works offline) |
| Back end | **Node.js 24** running TypeScript with **tsx**; **Fastify 5** + `@fastify/static` (serves the built front end), **zod 4** (validation) |
| Database | **PostgreSQL** through `pg`; when `DATABASE_URL` is empty it uses an embedded **PGlite** (`@electric-sql/pglite`) for local or booth use |
| Hosting | **Render** (one web service, `render.yaml` Blueprint) + hosted PostgreSQL (**Neon**, Singapore region) |

The exact `package.json`, `vite.config.ts`, `render.yaml` and `client/index.html` are in **Appendix B**.

### 2.2 Folder structure

```
client/
  index.html
  public/icon.svg
  src/
    main.tsx            fonts + styles import, kiosk guards, socket/data start, render <App/>
    App.tsx             hash router, Starfield background, connection banner, rehearsal badge
    styles.css          Appendix A
    assets/             4 logo PNGs (section 0)
    kiosk/              Splash, Home, Frame (page shell), Register, HowToScreen, RaceScreen, PostGame, BattleHost, KioskApp (state machine)
    player/PlayerApp    phone flow (#/join)
    display/DisplayApp  TV screen (#/display)
    admin/              AdminApp (login + sidebar), InsightTabs (dashboard), FeedbackTab, GameTabs (live, results, boards), ContentTabs (solutions, settings), DataTabs (projects, exports, audit), charts, shared
    components/         Brand, Constellation, Starfield, Ticker, Timer, Countdown, PuzzleBoard, Reveal, RaceLanes, Boards, Results, RegistrationForm, OpuSelect, Feedback, HowTo, Qr, ui
    lib/                socket (+ server clock), data stores, hooks, session (refresh resume), sound, useRun, useRace, results, feedback (offline outbox), api, store
server/
  index.ts, app.ts, config.ts, realtime.ts (Socket.IO events)
  game/engine.ts        race engine: lobbies, timing, penalties, deadlines, recovery
  routes/public.ts, routes/admin.ts
  services/             boards, analytics, auth, backup, export (CSV / Excel), feedback
  db/                   db (pg / PGlite), migrations, store (all SQL), seed
shared/                 types, protocol, game (reducer), puzzle, validation, affiliation, feedback, seed, catalogue, time, random, admin, dashboard
```

- Import alias: `@shared` → `./shared` (in both `vite.config.ts` and `tsconfig.json`).
- Dev: `npm run dev` runs the API on port **8090** and Vite on **5174** (Vite proxies `/api` and `/socket.io` to 8090).
- Build: `npm run build` = `tsc --noEmit && vite build` → `dist/client`. Start: `npm start` = `tsx server/index.ts`. The server serves `dist/client` and the API on the same port.

---

## 3. Brand assets

### 3.1 PMX mark (inline SVG component `BrandMark`)

A hexagon outline with an "X" of connected nodes, in a Soft Green → Green gradient (`#BFD730` → `#00A19C`, top-left to bottom-right), filled with semi-transparent brand blue. The exact SVG is in Appendix C (`Brand.tsx`). It is used in the page header (`PmxBrand`) and the splash.

### 3.2 `PmxBrand` (top-left of every screen)

- Row: `BrandMark` (3rem square; compact version 2.5rem) with a soft lime glow (`drop-shadow(0 0 14px rgba(191,215,48,0.35))`), then two lines of text:
  - **"PMX"**: Space Grotesk, bold, letter-spacing 0.12em, 1.45rem (compact `text-lg`).
  - **"DIGITAL PROJECT MANAGEMENT"**: semibold, uppercase, Soft Green at 80% opacity, truncated with an ellipsis if there's no room.
    - Normal version (kiosk pages): `max(11px, 0.72rem)`, letter-spacing 0.2em, hidden on phones and on portrait screens up to 900 px wide.
    - Compact version (phone join page, Admin sidebar): always shown, `max(11px, 0.58rem)`, letter-spacing 0.06em.
- **Pressing and holding it for 2.5 s opens Admin** (staff shortcut).

### 3.3 `PartnerLogos` (PETRONAS + NERVCENTRE pill)

- A pill (fully rounded) 2.6em tall, with an overflow-hidden background `linear-gradient(135deg, #20419A 0%, #13286a 100%)`, shadow `0 0.7em 1.8em -0.6em rgb(0 0 0 / 0.6)` plus a 1 px ring of white at 25%.
- **Left part:** white panel, padding-left 1.2em, padding-right 1.65em, with a **diagonal right edge**: `clip-path: polygon(0 0, 100% 0, calc(100% - 0.85em) 100%, 0 100%)`. It holds `petronas-logo.png` at height 1.6em.
- **Right part:** on the blue gradient, padding-left 0.7em, padding-right 1.25em. It holds `nervcentre-logo.png` at height 1.32em.
- Every size is in **em**, so the font size scales the whole pill: `sm` = 0.82rem, `md` = 1.15rem, `lg` = `clamp(1.35rem, 2.6vh + 0.9vw, 2.5rem)`.

### 3.4 Favicon

`client/public/icon.svg`: a brand-blue rounded square with the hexagon and X in the lime → green gradient (Appendix B). Browser theme colour `#20419A`.

---

## 4. Design system

### 4.1 Colours

Only the **five PMX colours** are used for meaning. Red appears **only** for a wrong tile or an error. Text on Yellow or Soft Green is always dark (`#0f2259` / `#0b1638`).

| Token (Tailwind name) | Hex | Used for |
|---|---|---|
| `nc-blue` / `sky-600` | **#20419A** | Brand blue: structure, tiles, number badges, Admin sidebar, Head-to-Head button |
| `nc-lime` (Soft Green) | **#BFD730** | Main action buttons ("Tap to Begin", "Leaderboard"), selected toggles / answers / chips, placed answer slots, focus ring, "live" dot |
| `nc-green` | **#00A19C** | Correct / done: "Start" button on registration, solved flash, "See My Result", toggles on in Admin |
| `nc-yellow` | **#FDB924** | Timer, 1st place, NC Master badge, rehearsal badge, stars in feedback |
| `nc-purple` | **#763F98** | Multiplayer: battle button, lanes, wins board, NC Rookie badge, star glow |
| `nc-red` | **#D83B3E** | Wrong tile, error messages, penalty badges, offline banner |
| `sky` | #0f2259 | Page background base; dark text on lime / yellow |
| `sky-950` | #081436 | Ticker strip background (at 60%) |
| `sky-900` | #0b1a47 | Gradient end |
| `sky-800` | #13286a | Panels (at 86%), gradient middle |
| `sky-700` | #193485 | (shade) |
| `sky-500` | #2f56c0 | (shade) |
| `nc-blue-soft` | #9db4f2 | Light-blue text on dark: labels, secondary text, borders (at 24–45%) |
| `nc-green-soft` | #3cd0c9 | Green text/icons on dark (connected, built, last star centre) |
| `nc-purple-soft` | #cfaeea | Purple text/icons on dark; lit constellation lines |
| `nc-glow` | #b07fd6 | Countdown number glow |
| `nc-red-soft` | #ff9a9c | Red text on dark (penalties, "Hurry!", errors on dark) |
| `nc-navy` | #0b1638 | Text on white cards (registration, OPU sheet); QR modules |
| `surface` | #f5f7fa | Admin page background, feedback page |
| `text` | #172033 | Admin text |
| `muted` | #667085 | Secondary text on light surfaces |
| `line` | #d9e1ea | Borders on light surfaces |
| `error` | #d83b3e | Admin error text |
| Admin chart series | **#3f86e6** | Single-series charts, Solo, Project, "Yes" (a lighter step of brand blue, so it isn't confused with purple by colour-blind viewers) |
| Admin chart extra | #763F98 (Battle, Business), #00A19C (Head-to-Head), #98a2b3 ("No") | |
| Hover shades | lime #cce445, green #008e8a, purple #8a4db0, blue #284fb5 | Button hover |
| Dark-green text on light | #00726e | Admin "ok" notes, "All solved" tag |
| Dark-yellow text on light | #b07800 (crown), #7a5200 (warn note) | Admin |

**Signature gradients**

- **Page sky:** `radial-gradient(ellipse 120% 80% at 30% -10%, #20419a 0%, #13286a 45%, #0b1a47 100%)`.
- **Glows over the sky:** `radial-gradient(ellipse 55% 45% at 88% 88%, rgb(118 63 152 / 0.42), transparent 70%)` (purple, bottom-right) and `radial-gradient(ellipse 40% 35% at 5% 80%, rgb(0 161 156 / 0.16), transparent 70%)` (green, bottom-left).
- **Title highlight** (`.text-gradient`): `linear-gradient(100deg, #ffffff 0%, #BFD730 45%, #00A19C 100%)` clipped to text. It is applied to the **last word** of the event title ("PMX Digital **Challenge**").
- **Tile:** `linear-gradient(180deg, #2a4fb5, #20419a)`.
- **Panel:** `linear-gradient(180deg, rgb(255 255 255 / 0.07), rgb(255 255 255 / 0.02)), rgb(19 40 106 / 0.86)`.

### 4.2 Typography

| Font (CSS variable) | Family | Used for |
|---|---|---|
| `--font-sans` | **Inter Variable**, "Segoe UI", system-ui, sans-serif | Body text, buttons, tables |
| `--font-display` (`font-display`) | **Space Grotesk Variable** | Headings, titles, numbers, timer, tiles, clue, room code, ticker |
| `--font-friendly` | **Nunito Variable** | The feedback questions page only (rounder, friendlier) |

- All times and counters use `tabular-nums`. Times are always shown to **0.01 s** ("7.86 s", "29.07").
- **Label style** (`.label`): 0.85rem, bold, letter-spacing 0.16em, UPPERCASE, `#9db4f2` (often overridden to lime, yellow or purple-soft).
- Headings are bold with `leading-tight` and the title uses `tracking-tight`.

### 4.3 Sizing and scaling (critical)

The kiosk is designed on a **100rem × 60rem canvas**: the root font size scales with the viewport, so a 1920×1080 and a 1280×800 screen show the same layout without scrolling. **Every size in this spec is in rem** for that reason.

| Context (class on `<html>`) | Root `font-size` |
|---|---|
| Kiosk landscape (`html.kiosk`, routes `#/` and `#/display`) | `clamp(10px, min(1vw, 1.6667vh), 40px)` → 1rem = **19.2px at 1920×1080** |
| Any portrait screen | `clamp(10px, 1.9vw, 22px)` (page scrolls vertically) |
| Phones playing `#/` (`max-width: 640px` or `max-height: 520px`) | `clamp(14px, 4.1vmin, 17px)`, page scrolls |
| Phone join page (`html.route-phone`) | `clamp(14px, 4.1vw, 18px)`; 17px from 700px wide |
| Admin (`html.route-admin`) | 16px, light colour scheme |

- **Touch targets are never smaller than 56 px**: utility `tap` = `min-height: max(56px, 3.5rem)` and `tap-w` = `min-width: max(56px, 3.5rem)`. In Admin on touch screens, buttons are at least 44 px.
- On touch devices, inputs use `font-size: max(16px, 1em)` so iOS doesn't zoom in.
- **Breakpoints / variants:**
  - `phone:` = `(max-width: 640px)` **or** `(max-height: 520px)` (a phone upright or sideways). The same query is used in JavaScript (`PHONE_QUERY`) to switch to phone layouts.
  - `short:` = `(max-height: 520px)` (phone turned sideways).
  - `portrait:` = Tailwind's built-in orientation variant (tablets upright: everything stacks into one column).
  - Admin: `md` (768 px) and `xl` (1280 px) Tailwind breakpoints.
- Page widths: kiosk content is centred with `max-width: 112rem` and side padding 2.4rem (phones 1rem); the TV display uses `max-width: 110rem`; the phone join page `max-width: 34rem`; Admin main `max-width: 1400px`.
- Safe areas: the header top padding is `max(1.1rem, env(safe-area-inset-top))`, and bottom bars add `env(safe-area-inset-bottom)`.

### 4.4 Background: the animated night sky (`Starfield`)

Behind every page except Admin (fixed, full-screen, `pointer-events: none`), from bottom to top:

1. The **page sky** radial gradient (4.1).
2. The **purple + green glows** (4.1).
3. **Grid lines** (`.grid-lines`): 1 px lines of `rgb(157 180 242 / 0.06)` every 4rem in both directions, masked by `radial-gradient(ellipse 80% 70% at 50% 25%, #000 25%, transparent 80%)` so they fade out towards the edges (the PMX "command centre" look).
4. A `<canvas>` of **twinkling stars**:
   - Count = `(width × height / 5200) × density` (density 1; 0.6 on the phone join page). Device pixel ratio up to 2.
   - Each star: radius 0.35–1.15 px (8% are big stars of 1.2–2.3 px, which also get a faint halo of 3.2× radius at 18% of their alpha). Colour picked from white, white, `207,222,255` (pale blue), `207,174,234` (lilac), `191,215,48` (lime).
   - Twinkle: `alpha = 0.35 + 0.65 × (0.5 + 0.5 × sin(time × speed + phase))`, speed 0.4–1.8, random phase.
   - Drift: each star moves left by `0.02 × speed` px per frame and wraps around.
   - About once every 250 frames (`random < 0.004`), a **shooting star** crosses from the upper right towards the lower left: a 1.6 px line with a white → transparent gradient tail, velocity x −9…−14, y +3…+5 px per frame, fading by 0.025 per frame.
   - Runs at ~30 fps (skips frames under 33 ms), pauses in background tabs, and is drawn static (alpha 0.7, no drift, no shooting stars) when the user prefers reduced motion.

Exact code: Appendix E.

### 4.5 Surfaces

| Class | Look |
|---|---|
| `.panel` (dark glass card) | Panel gradient (4.1), 1 px border `rgb(157 180 242 / 0.24)`, radius **1.25rem**, shadow `inset 0 1px 0 rgb(255 255 255 / 0.05), 0 1.2rem 3rem -1.5rem rgb(0 0 0 / 0.65)`, `backdrop-filter: blur(6px)` |
| `.reg-card` (white card on dark) | White, text `#0b1638`, radius **1.5rem**, shadow `0 1.6rem 3.5rem -1.4rem rgb(0 0 0 / 0.65)`, light colour scheme; focus outline brand blue |
| `.fb-page` (feedback) | Background `#f5f7fa`, text `#172033`, **Nunito**, light colour scheme |
| `.card` (Admin) | White, 1 px `#d9e1ea` border, radius 1rem, shadow `0 1px 2px rgb(16 24 40 / 0.05)` |

### 4.6 Buttons

Base `.btn`: inline-flex, centred, gap 0.6em, min-height `max(56px, 3.5rem)`, padding 0 1.6rem, radius **0.95rem**, 1.5 px transparent border, 1.15rem, weight 700, line-height 1.15; transitions 0.12–0.2 s; **pressed = scale(0.97)**; disabled or `aria-disabled="true"` = opacity 0.45, no shadow, no press effect.

| Variant | Background / text | Shadow / border | Hover |
|---|---|---|---|
| `.btn-go` (main action) | Soft Green #BFD730 / `#0f2259`, weight 800 | `0 0.8rem 2rem -0.8rem rgb(191 215 48 / 0.75)` | #cce445 |
| `.btn-green` (confirm / Start) | Green #00A19C / white, 800 | `0 0.8rem 2rem -0.8rem rgb(0 161 156 / 0.75)` | #008e8a |
| `.btn-purple` (multiplayer) | Purple #763F98 / white, 800 | `0 0.8rem 2rem -0.8rem rgb(118 63 152 / 0.8)` | #8a4db0 |
| `.btn-yellow` | Yellow / `#0f2259`, 800 | | |
| `.btn-blue` (Head-to-Head) | Brand blue / white | border `rgb(157 180 242 / 0.45)` | #284fb5 |
| `.btn-ghost` (secondary on dark) | `rgb(255 255 255 / 0.05)` / white | border `rgb(157 180 242 / 0.32)` | white at 10% |
| `.btn-xl` (size modifier) | min-height `max(64px, 4.6rem)`, padding 0 2.6rem, 1.65rem, radius 1.2rem | | |
| `.btn-light` (Admin) | White / `#172033` | border `#d9e1ea` | `#f5f7fa` |
| `.btn-admin` (Admin primary) | Brand blue / white | | #284fb5 |
| `.btn-danger` (Admin) | White / red | border red at 45% | red at 6% |

**Icon-only header buttons** (sound, full screen, back, home on phones): `btn btn-ghost` with `tap-w` and no side padding, so they are 56 px squares; icon 1.5rem.

### 4.7 Form fields

- `.reg-field` (white registration inputs): full width, min-height `max(56px, 4rem)`, padding 0 1.1rem, radius 0.9rem, 2 px border `#d9e1ea`, `max(17px, 1.35rem)` semibold navy text, muted placeholder. **Focus (or open picker): Soft Green border + 0.25rem ring `rgb(191 215 48 / 0.35)`**. Invalid: red border.
- `.reg-label`: block, `max(15px, 1.05rem)` bold navy, 0.45rem below.
- `.reg-toggle` (Project / Business): flex centred, min-height `max(56px, 4.2rem)`, radius 0.95rem, 2 px `#d9e1ea` border, white, `max(18px, 1.45rem)` extra-bold navy. Selected = Soft Green fill and border. Invalid and unselected = red border. Pressed = scale(0.98).
- `.reg-error`: flex, red `max(14px, 1rem)` semibold, 0.4rem top margin, min-height 1.45em (space is reserved, so the layout doesn't jump), with a `CircleAlert` icon.
- `.field` (dark input, used for the phone room code): `rgb(8 20 54 / 0.72)` background, 2 px border `rgb(157 180 242 / 0.35)`, white 1.45rem semibold, radius 0.95rem; focus lime border + ring.
- `.afield` (Admin): radius 0.6rem, 1 px line border, padding 0.55rem 0.75rem; focus brand-blue border + 3 px ring at 15%.
- Focus ring everywhere else: `outline: 3px solid #BFD730; outline-offset: 3px` (`:focus-visible`).

### 4.8 Word and letter tiles

`.tile`: inline-flex centred, min-height `max(56px, 4.6rem)`, padding 0 1.2em, radius 1rem, 2 px border `rgb(157 180 242 / 0.45)`, tile gradient, white **Space Grotesk bold** 1.7rem, shadow `inset 0 1px 0 rgb(255 255 255 / 0.12), 0 0.5rem 1.2rem -0.6rem rgb(0 0 0 / 0.6)`; **pressed = scale(0.96)**.

- `.tile-letter` (Hard Mode): square (min-width = min-height), no padding, 2.1rem.
- `.tile-wrong`: red background, border `#ff8a8c`, with an ✕ icon, plus the **shake** animation.
- `.tile-used`: opacity 0.22 (and disabled).

### 4.9 Small elements

- **Live dot** (`.live-dot`): 0.6rem lime circle with a pulsing ring (`box-shadow` 0 → 0.6rem, 1.6 s, infinite).
- **Pill** (`Pill`): rounded-full, 1 px border, padding 0.25rem 0.75rem, 0.9rem bold, with tones blue / purple / green / yellow / red / lime.
- **Rehearsal badge:** fixed at the top centre, a yellow pill with a `FlaskConical` icon, "REHEARSAL – NOT COUNTED" (0.85rem, extra-bold, uppercase, tracking 0.18em, dark text). Shown on every page except the TV display while rehearsal mode is on.
- **Connection banner:** fixed at the top centre, a red pill with a `WifiOff` icon: "Connecting to the game server…" or "Connection lost – reconnecting…".
- **Idle hint:** "Back to the home page in {n} s if nobody taps." (0.95rem, white at 45%), counting down live and restarting on any tap.
- **Admin gear:** fixed bottom-right on the home page (bottom 3.6rem, right 0.75rem), a 56 px round button with a `Settings` icon in white at 25% (60% on hover).

### 4.10 Motion

| Name | Definition | Used for |
|---|---|---|
| `fade-in` | opacity 0 → 1, 0.3 s ease-out | General |
| `rise` | opacity 0, translateY(14px) → none, 0.45 s `cubic-bezier(0.2,0.8,0.2,1)` | Splash logos, lobby rows, reveal text (delay 1.6 s) |
| `pop` | opacity 0, scale(0.8) → 1, 0.4 s `cubic-bezier(0.2,1.3,0.4,1)` | Splash mark, solved flash, time-up overlay |
| `shake` | translateX 0 → −10 → 9 → −6 → 3 → 0 px, 0.42 s | Wrong tile |
| `float-up` | fade in, scale 1.08, then rise 2.4rem and fade out, 1.1 s | Penalty flash |
| `pulse-soft` | opacity 0.55 ↔ 1, 2.4 s infinite | Next answer slot, next star ring, "Live now" radio icon |
| `twinkle` | opacity 0.35 ↔ 1 and scale 0.85 ↔ 1, 2.8 s infinite | (available) |
| `count` | scale(1.8) and transparent → scale(1) at 40% → scale(0.85) and transparent, 0.9 s | 3-2-1-GO numbers |
| `tick` | scale(1.06) → 1 within 30%, 1 s infinite | Timer in the last 5 s |
| `marquee` | translateX(0 → −50%), **80 s** linear infinite | Solutions ticker |
| `splash-fill` | scaleX(0 → 1), 1000 ms linear | Splash progress bar |
| `fb-pop` | scale 0.7 → 1.25 → 1, 0.38 s | Feedback star tapped |
| `fb-pulse` | green ring 0 → 0.55rem fading, 2.2 s infinite | "See My Result" when ready |
| framer-motion | Conditional field slide-in (height 0 ↔ auto + opacity, 0.2 s ease-out); OPU bottom sheet (y 100% → 0, 0.24 s `[0.2,0.8,0.2,1]`, backdrop fade); feedback chips (height + opacity + y −6 px, 0.24 s); constellation (see 5.8) | |

`prefers-reduced-motion: reduce` turns every animation and transition to ~0 ms and stills the star canvas.

### 4.11 Sound (synthesised with the Web Audio API, no audio files)

Each sound is a set of short oscillator tones (attack 12 ms, exponential decay). Exact values in Appendix F.

| Event | Sound |
|---|---|
| Correct tile | `tap`: 700 Hz triangle, 50 ms, quiet |
| Solution built | `chime`: 784 → 1175 → 1568 Hz sine arpeggio |
| Wrong tile | `wrong`: 220 → 150 Hz sawtooth sweep, 240 ms |
| Skip | `skip`: 520 then 390 Hz triangle |
| Each second in the last 5 s | `tick`: 1250 Hz square, 35 ms, very quiet |
| 3, 2, 1 | `count`: 523 Hz sine, 160 ms |
| GO! | `go`: 784 then 1046 Hz triangle |
| Time up | `timeUp`: 440 then 330 Hz square |
| Each star in the reveal | `star`: 1320 + 1760 Hz sparkle |
| All six lit / battle winner | `reveal`: C–E–G–C fanfare (523, 659, 784, 1046 Hz) + 1568 Hz shimmer |
| A player joins the lobby | `join`: 660 then 990 Hz |

- Audio is unlocked on the first tap (browser rule).
- Mute toggle (speaker icon) is remembered per device (`localStorage 'wr.muted.v1'`). Admin sets the default ("Sound on by default").

### 4.12 Kiosk hardening and accessibility

- Kiosk and phone pages: no text selection (except inside inputs), no long-press callout, `touch-action: manipulation` (no double-tap zoom), `overscroll-behavior: none` (no pull-to-refresh), right-click / context menu blocked, pinch and Ctrl+wheel and Ctrl +/−/0 zoom blocked, image dragging blocked, links to other sites blocked.
- Viewport meta: `width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover`.
- **Full screen** button (⛶, `Maximize` / `Minimize` icon) in the header, hidden on phones.
- Everything works with a keyboard: tiles respond to Enter / Space; toggles, Yes/No and stars are ARIA radio groups with arrow keys; the OPU sheet traps focus and supports arrows, Home, End and Esc.
- The timer has `role="timer"`, flashes and errors use `aria-live`, and the constellation has `role="img"` with "4 of 6 stars lit".
- Shortcuts: **Ctrl + Shift + A** opens Admin from anywhere.

---

## 5. Shared building blocks

### 5.1 `KioskFrame`: the page shell for every kiosk screen after Home

- Container: `relative z-10 mx-auto flex h-dvh max-w-[112rem] flex-col`, padding 2.4rem left/right, bottom 1.4rem, top `max(1.1rem, safe-area)`. On phones, portrait screens and widths under 700 px it grows with its content (`min-h-dvh`) and the page scrolls; phone side padding is 1rem.
- **Header** (flex row, gap 1rem, 1rem below), in this order:
  1. **Back** button (only where allowed): ghost square, `ArrowLeft` icon.
  2. `PmxBrand` (hold 2.5 s for Admin).
  3. If there is a title: a 1 px × 2.4rem divider line (white at 20%), then the **title** in Space Grotesk 1.6rem bold, truncated (e.g. "Register to play", "Your results").
  4. Flexible space.
  5. Optional right-hand controls (e.g. leaderboard tabs).
  6. **Home** button (only where allowed): ghost, `House` icon + "Home" (phones show the icon only).
  7. **Sound** toggle.
  8. **Full screen** toggle (hidden on phones).
- On phones the header wraps: the title (1.2rem) and the right-hand controls each move onto their own full-width row underneath.
- **Back and Home are never shown during a race or on the feedback questions.**

### 5.2 Ticker (bottom of Home)

A full-width strip: top border `rgb(157 180 242 / 0.15)`, background `#081436` at 60%, padding-top 0.75rem, padding-bottom `max(0.7rem, safe-area)`, edge fade mask `linear-gradient(90deg, transparent, #000 8%, #000 92%, transparent)`. Inside, the **34 PMX catalogue solution names** (section 12.4) repeated twice in one row scroll left forever (`marquee`, 80 s). Each name: Space Grotesk 0.85rem semibold UPPERCASE, tracking 0.22em, Soft Green at 55%, followed by a small rotated square (0.375rem, Green #00A19C) as a separator; gap 2rem.

### 5.3 Timer (race clock)

- Counts down from the limit (30.00) to 0.00, shown to 0.01 s, refreshed every animation frame.
- Row: icon (`Timer`; `AlarmClock` in the last 5 s) + number + a small "s" (1.4rem semibold, 80% opacity). Space Grotesk bold, tabular, line-height 1.
- Sizes: **lg** number 5.2rem / icon 3.2rem; **md** 3.4rem / 2.2rem; **sm** 2.4rem / 1.6rem.
- Colour **Yellow**. In the **last 5 s it turns red-soft (#ff9a9c), pulses (`tick`) and plays a tick sound each whole second**. At 0 it stays red-soft.
- Under it: a bar (height 0.625rem, rounded, white at 10%) filled Yellow (red when urgent) to remaining ÷ limit, then a caption 0.95rem bold UPPERCASE tracking 0.18em: "TIME LEFT" (yellow at 80%), "HURRY!" or "TIME'S UP" (red-soft). The battle host's clock says "RACE CLOCK".
- Penalties move the clock forward (a wrong tile takes 1 s off immediately).

### 5.4 Countdown (3-2-1-GO!)

- Overlay over the race area (on phones fixed over the whole screen): z-index 30, `#0f2259` at 55% with a 2 px backdrop blur, no pointer events.
- Driven by **server time**, so every screen in a battle shows the same number. Relative to GO time `d = go_at − now`: more than 3000 ms → "Get ready…" (Space Grotesk 2.4rem bold, blue-soft); 3000–2000 → **3**; 2000–1000 → **2**; 1000–0 → **1**; 0 to −700 ms → **GO!**; then the overlay disappears.
- The number is Space Grotesk bold `min(16rem, 40vw)`, white (GO! in Soft Green), with glow `drop-shadow(0 0 40px rgba(176,127,214,0.8))`, re-animated with `count` for each number. The `count` sound plays on 3, 2, 1 and `go` on GO!.
- A race starts **3.5 s after it is created** (Solo / Head-to-Head) or after the 10 s how-to (Battle).

### 5.5 PuzzleBoard (clue, answer slots, tiles, Skip)

There are three size sets: **wide** (kiosk Solo), **half** (Head-to-Head) and **phone**.

| Part | wide | half | phone |
|---|---|---|---|
| Clue panel padding | 1.8rem | 1.1rem | 1rem |
| Clue text | 2.5rem | 1.6rem | 1.25rem |
| Tile | min-h 6.2rem, 2.3rem, px 1.3em, radius 1.2rem | min-h `max(56px,4rem)`, 1.35rem, px 0.9em | min-h 56px, 1.15rem, px 0.85em |
| Tile gap | 1.3rem | 0.7rem | 0.5rem |
| Answer slot | 2rem text, min-h 4.4rem | 1.3rem, min-h 3rem | 1.05rem, min-h 2.6rem |
| Skip button | min-h 4.4rem, px 2rem, 1.5rem | min-h `max(56px,3.8rem)`, 1.25rem | default |

Layout, top to bottom:

1. **Clue panel** (`.panel`):
   - Top row: left a lime label with `Lightbulb` "CLUE"; right a label with `Sparkles` (purple-soft) "**{n} OF 6**", where n = solved + 1 (capped at 6; while ended, n = solved).
   - The clue in Space Grotesk semibold, `leading-snug`. Before GO it says "Get ready…", after the end "Round complete".
   - **Answer slots** (1rem gap between words, 0.375rem between letters): one slot per word (min-width 5.5em) or, in Hard Mode, one per letter (min-width 2.6em, no padding), with rounded-lg 2 px borders and Space Grotesk bold. States:
     - **placed**: Soft Green fill + border, dark text, shows the word;
     - **next**: lime border at 80%, `pulse-soft`, shows "·" (or "?" for a letter) in white at 40%;
     - **later**: dashed border blue-soft at 40%, empty.
2. **Tiles**: centred, wrapping, vertically centred in the remaining space (phones: top-aligned). They react on **pointer-down** (not click), so two players on one screen can tap at the same moment. Used tiles fade to 22%. A wrong tile turns red with ✕ and shakes for 450 ms.
3. **Skip** button, centred: ghost button with `SkipForward` + "Skip" + a red badge "+2 s" (rounded-md, red at 80%, white bold 0.85em). Disabled before GO, after the end, and when only one solution is left.

**Flashes over the board**

- **Solution built:** at 38% from the top, centred: a Green pill (rounded-2xl, px 1.5rem, py 0.75rem, Space Grotesk 1.8rem bold, white, glow `0 0 40px rgba(0,161,156,0.7)`) with a ✓ (`Check`, stroke 3) + the solution name, `pop`, shown 900 ms. The next solution appears **immediately**.
- **Wrong tile / Skip / Time up:** at the top, centred: a red pill (rounded-xl, px 1rem, py 0.5rem, Space Grotesk 1.5rem bold) with ✕ + "Wrong tile · +1 s" / "Skipped · +2 s" / "Time's up!", `float-up`, 1.1 s.
- **Run over:** covers the board (rounded-2xl, `#0f2259` at 70%, 2 px blur): a 4rem icon (`CheckCircle2` green-soft if all six were built, otherwise `Hourglass` red-soft), "All stars lit!" or "Time's up!" (Space Grotesk 3rem bold), the finishing time in Yellow 2rem ("7.86 s"); in Head-to-Head also "Waiting for the other player…" (1.2rem, white at 70%).

### 5.6 Constellation (the signature visual)

An SVG of **six stars tracing the "N" of the NERVCENTRE logo**. Star coordinates are in the pixel space of the original logo (2058 × 553), **in this order**: (95, 470), (330, 150), (365, 480), (497, 318), (600, 150), (690, 95).

- **viewBox:** `20 20 760 540` (stars only) or `0 0 2058 553` when the full logo is shown.
- **Unlit star:** circle r 9, fill `#9db4f2` at 40%, stroke `#9db4f2` at 60%, width 2.
- **Guide lines** between consecutive stars: stroke `#9db4f2` at 22%, width 3, dash `6 12` (hidden once complete with the logo).
- **Lit star:** a glow circle r 48 (r 62 when all six are lit) filled with a radial gradient (white 95% → `#cfaeea` 70% at 25% → `#763f98` 35% at 60% → transparent), fading and scaling in from 0.3 over 0.45 s; a white 4-point sparkle (path `M x,y−30 L x+5,y−5 L x+30,y L x+5,y+5 L x,y+30 L x−5,y+5 L x−30,y L x−5,y−5 Z`, 85% opacity); a centre dot r 12 white (**the 6th star's dot is `#3cd0c9` with a 4 px white ring**). It springs in (stiffness 260, damping 16).
- **Lit line** between two lit stars: `#cfaeea`, width 5, round caps, Gaussian-blur glow (stdDeviation 6 merged with the line), drawn with `pathLength` 0 → 1 over 0.35 s. When all six are lit: white, width 6 (55% opacity over the logo).
- **Next star** (during a race): a ring r 26, stroke `#bfd730`, width 3, `pulse-soft`.
- **Logo underneath** (reveal / podium / TV): `nc-logo.png` drawn at 0,0, 2058 × 553 (or `nc-mark.png` at 780 × 553). It sits at 10% opacity and fades to 100% over 0.9 s once all six are lit.
- **Sequence mode (reveal):** star i lights at `0.25 + i × 0.32` s; the logo fades in at `0.35 + 6 × 0.32` s.
- Accessible label "{n} of 6 stars lit". Full code: Appendix D.

### 5.7 Reveal (after the race)

- Full screen (padding 2rem), centred column. Constellation with the **full logo** in sequence mode, width `min(80rem, 92%)` (compact on phones: max-width 34rem).
- Text rises in after 1.6 s:
  - All six: "✦ **All 6 solutions – fully lit!**" (`Sparkles` purple-soft, Space Grotesk 3.6rem bold white).
  - Otherwise: "Time's up! {n} of 6 stars lit" (or "Round complete {n} of 6 stars lit"), 3.2rem bold.
  - Under it in Yellow 2rem: `Timer` icon + "{Full name} · **7.86 s**" (time in bold Space Grotesk).
- Sounds: `star` for each lit star at 250 + i × 320 ms; if all six, `reveal` fanfare 100 ms after the last star.
- Moves on by itself after **5.2 s** (all six) or **3.6 s**, or on a tap.

### 5.8 RaceLanes (live race rows: battle host, phone waiting screen, TV)

- One `.panel` row per player, in **live order**: final place if known; otherwise more solved first, then whoever solved last sooner, then lane.
- **lg** grid columns `3.4rem | minmax(0,1.1fr) | 9rem | minmax(0,1.6fr) | auto`, padding 1rem, gap 1rem; **md** `2.4rem | 1fr | 6rem | 1.2fr` with the status under the bar.
- Cells:
  1. Position circle (3rem; the leader's is Yellow with dark text and gets a yellow border at 60% on the row; the winner shows a `Crown`).
  2. Name (Space Grotesk 1.7rem bold) + project / OPU (1.05rem, white at 60%).
  3. Mini constellation (5.6 × 8rem).
  4. Progress: "4/6 stars" bold, penalties "+2.00 s" in red-soft on the right; a bar (1rem tall, white at 10%) filled with a **purple → purple-soft gradient**, including partial progress through the current name.
  5. Status pill:
     - Finished: Green "✓ 12.34 s"
     - Time up: white at 10%, `Hourglass`
     - Disconnected: red at 30%, red-soft text, `WifiOff`
     - Ready: blue at 40%, `Wifi`
     - Racing: purple at 50%, purple-soft text, `Zap`

### 5.9 Leaderboard tables (`TimesTable`, `WinsTable`)

- `border-separate` with 0.35em row spacing. Header: `max(11px, 0.72em)`, bold, UPPERCASE, tracking 0.14em, blue-soft (wins: purple-soft).
- **Fastest times columns:** Rank · Name · Project / OPU · Solved ("6/6") · Time ("12.34 s", Space Grotesk bold). On phones the Project / OPU column is hidden and shown as a smaller second line under the name.
- **Wins columns:** Rank · Name · Project / OPU · Wins (`Users` icon) · Best time.
- **Rank cell:** 1st = Yellow circle (2.4em) with a dark `Crown`; 2nd and 3rd = circle with a 2 px blue-soft border + `Medal` icon + number; others = plain number at 70%.
- **Rows:** 1st = Yellow at 12% (wins: purple at 35%); others white at 4.5%; **the current player(s) = solid Soft Green with dark text and a "YOU" tag** (dark navy chip with lime text). Row ends are rounded (rounded-xl).
- **Text size per table:** sm 1rem, md 1.2rem, lg 1.45rem (phones ~1rem).
- **Empty states:** dashed rounded box with a `Trophy` icon: "No games yet – be the first!" (wins: `Swords`, "No battles won yet – start a Multiplayer Battle!").

### 5.10 ResultsView and TitleBadge

- **Title badge** (rounded-full, Space Grotesk bold; lg = px 1.25rem, py 0.5rem, 1.8rem):
  - **NC Master** (6 built): Yellow fill, dark text, `Crown`. Hint: "All solutions built – the full constellation is lit."
  - **NC Explorer** (4–5): Soft Green fill, dark text, `Compass`. Hint: "Most of the constellation lit – so close!"
  - **NC Rookie** (0–3): Purple fill, white text, `Sparkles`. Hint: "A great start – play again to light up more stars."
- The hint sits next to the badge (1.3rem, white at 75%).
- **Four stat panels** (4 columns; phones 2), each a `.panel` with an icon label and a 2.8rem Space Grotesk bold value:
  - `Timer` "FINISHING TIME" (or "TIME USED" when the clock ran out): value in Yellow, "7.86 s".
  - `Sparkles` "STARS LIT": "6/6".
  - `Hash` "RANK TODAY": "#1", or "Rehearsal" for test games, or "—". In Battle / Head-to-Head it is `Trophy` "BATTLE PLACE" / "HEAD-TO-HEAD": "Winner!" or "2nd".
  - `X` "PENALTIES": "+3.00 s".
- A summary line (1.1rem, white at 65%): "1 wrong tile · 1 skip · 1 player today", plus " · the clock ran out" when time ran out.
- **"✦ THE 6 DIGITAL SOLUTIONS"** recap (2 columns, gap 0.5rem): each solution in a rounded-xl box. Built = Green border at 50% + Green at 10% + `CheckCircle2` green-soft; not built = blue-soft border at 20% + `CircleDashed`. The name is Space Grotesk 1.2rem bold, then the recap line (1rem, white at 70%).

### 5.11 Registration form (same form on kiosk Solo, Head-to-Head and phones)

Fields in order:

1. **Full name**: `.reg-field`, placeholder "e.g. Nur Aisyah binti Ahmad", max 60 characters, auto-capitalise words, no autocorrect or spell-check, Enter = next.
2. **You are from**: two big toggles side by side (gap `max(10px, 0.8rem)`): **Project** (`HardHat` icon in brand blue) and **Business** (`Briefcase`). **Nothing is pre-selected.** The selected one turns Soft Green and its icon becomes a ✓.
3. **Project name** *or* **OPU**: slides in under the toggles (framer-motion, 0.2 s). Switching between Project and Business clears the other field.
   - Project name: `.reg-field`, placeholder "e.g. Kasawari CCS", max 80 characters, Enter = submit.
   - OPU: a field-sized button "Select your OPU" (muted) with a `ChevronDown`, which opens the **OPU bottom sheet** (5.12). It then shows the full value, e.g. "Downstream - MRCSB".
4. **Consent**: a big tappable box (rounded-xl, 2 px border, padding `max(12px, 0.85rem)`) with a custom checkbox (`max(28px, 2rem)` rounded square; ticked = lime with a dark ✓) and the text, with a green `ShieldCheck` icon: "I agree my name and project/OPU will be recorded for this event and shown on the leaderboard." Ticked = lime border + lime at 15%. Error = red border.
5. **Start** button: `btn btn-green btn-xl`, full width, `max(20px, 1.6rem)`, "Start →" (phones: "Join the battle →"; while checking: "Checking…").

Behaviour:

- **Start looks disabled** (`aria-disabled`, 45% opacity) until the form is valid, **but a tap on it still shows every problem inline**, under its field (red, with an icon, never a pop-up), and moves focus to the first problem. Errors also appear once a field has been filled in and left.
- After the device check passes, the server checks again (including blocked words). Server errors appear under the right field. A general error shows as a red box (rounded-xl, red border at 35%, red at 8%, `CircleAlert`).
- The exact rules and messages are in section 11.6.

### 5.12 OPU bottom sheet

- Rendered over the whole page (z-index 70). Backdrop `#050d24` at 70% (a tap closes the sheet). The panel is a `.reg-card` without bottom corners, full width up to `max(60rem, 860px)`, max-height 88dvh, sliding up from the bottom (0.24 s).
- Top: a grab handle (0.375rem × 3rem, rounded, `#d9e1ea`); title "Select your OPU" (Space Grotesk `max(20px, 1.6rem)` bold); a square close button with ✕ (56 px, 2 px line border, rounded-xl).
- Options are grouped under headings (`max(12px, 0.8rem)` bold UPPERCASE, tracking 0.14em, muted): **DOWNSTREAM**, **GAS & MARITIME**, **PE&T**, **UPSTREAM**, then **Others** with no heading. An entry "Group - Name" is listed as just "Name" under its group.
- Grid: 2 columns (3 from 700 px, 4 from 1000 px), gap 0.625rem. Each option is a `.reg-option`: min-height `max(56px, 4rem)`, 2 px border, radius 0.9rem, `max(17px, 1.3rem)` bold, left-aligned, lime border on hover. Selected = lime fill + ✓.
- While the sheet is open the page doesn't scroll. Keyboard: arrows, Home, End, Esc; focus stays inside.

### 5.13 Feedback form (three one-tap questions)

See 6.9 for its place in the flow.

- Header:
  - For Head-to-Head, a pill "Player 1 of 2 · {Name}" (rounded-full, brand blue, white extra-bold).
  - Title **"🎉 Great game! Your score is ready."** (brand blue, weight 900; kiosk 2rem / phone 1.3rem).
  - "Answer 3 quick questions to see your result." (semibold, text at 75%).
- Each question is a white card (radius 1.1rem, 1 px line border, padding `max(14px, 1.1rem)`). The question text is extra-bold (kiosk 1.25rem) and starts with a round brand-blue number badge (1, 2, 3).
  1. "Was the information shared at the booth relevant to your project or business needs?" with **Yes / No**.
  2. "Would you consider adopting or exploring any of the solutions showcased?" with **Yes / No**. On **Yes**, "Which ones? (optional – pick any)" slides in, followed by **chips** for the six solution names (pill, 2 px border, min-height `max(44px, 2.9rem)`, bold; selected = lime + ✓; multi-select). Switching to No clears the chips.
  3. "Did the booth help you better understand the available digital solutions?" with **five stars** (`max(48px, 3.3rem)` square, outline grey `#98a2b3`). Tapping star n fills stars 1–n in Yellow, with a pop. A label underneath (extra-bold brand blue): 1 "Not at all", 2 "A little", 3 "Somewhat", 4 "Yes", 5 "Very much".
- **Yes / No buttons** (`.fb-choice`): 2 columns, min-height `max(56px, 3.6rem)`, radius 1rem, 2 px border, white, `max(17px, 1.15rem)` extra-bold. Unselected they show 👍 / 👎 before the word; **selected = Soft Green + ✓**.
- **Submit "🏆 See My Result"** (`.fb-submit`): full width, min-height `max(56px, 3.8rem)`, radius 1rem, weight 900. Grey (`#d9e1ea` / muted text) and disabled until all three are answered; then **Green with a gentle pulsing ring**; while sending, a white spinner. It is kept in view in a sticky footer.

---

## 6. Kiosk screens and flow (`#/`)

### 6.1 Flow map

```
Splash (1 s, tap skips)
  └─► HOME ──Tap to Begin──► REGISTER ──Start──► HOW TO PLAY (10 s or "I'm ready!")
       │                                              └─► 3-2-1-GO ─► RACE (30 s) ─► REVEAL (3.6–5.2 s)
       │                                                   ─► FEEDBACK (skipped if answered today) ─► RESULTS ─► LEADERBOARD ─► HOME
       ├─Multiplayer Battle──► BATTLE LOBBY ─Start battle─► HOW TO PLAY (synced) ─► 3-2-1 ─► LIVE RACE VIEW ─► PODIUM ─► LEADERBOARD / New battle
       ├─Head-to-Head (not on phones)──► H2H REGISTER ─► HOW TO PLAY ─► 3-2-1 ─► SPLIT RACE ─► H2H REVEAL ─► FEEDBACK P1 ─► FEEDBACK P2 ─► H2H RESULTS ─► LEADERBOARD
       └─View Leaderboard──► LEADERBOARD
Idle: results, leaderboard, podium → Home after 30 s; registration after 60 s; feedback after 90 s (score already saved). Phones never time out.
Refresh: the kiosk reopens on the same step (saved in localStorage 'wr.kiosk.session.v2' for 20 minutes); the game itself carried on on the server.
```

### 6.2 Splash

![Splash](screens/00-splash.jpg)

- Fixed over everything (z-index 50), page-sky gradient + grid lines.
- Top (rises in): `PartnerLogos` size **lg**, top padding `max(clamp(1.25rem, 5vh, 3.5rem), safe-area)`.
- Centre:
  - The PMX mark at `clamp(4.5rem, 11vh, 8rem)`, popping in, with a blurred Green glow behind it (circle extending 35% beyond the mark, Green at 25%, blur-2xl).
  - The lime label "PMX · DIGITAL PROJECT MANAGEMENT".
  - The title "PMX Digital **Challenge**" (last word gradient) in Space Grotesk bold `clamp(2.4rem, 4.5vw + 2vh, 6rem)`, leading 0.95, tight tracking.
  - The subtitle "Powering Project Delivery Through Digital" in Space Grotesk medium, Soft Green, `clamp(1.1rem, 1.2vw + 0.8vh, 1.9rem)`.
- Bottom: a progress bar `min(22rem, 70vw)` wide, 0.375rem tall, white at 15%, filled with a Green → Soft Green gradient over **1000 ms**, then "GET READY" (Space Grotesk 0.8rem semibold, tracking 0.3em, white at 60%).
- After 1000 ms it fades out over 400 ms. A tap skips it. It is only shown when the kiosk opens on Home (never in front of a resumed game).

### 6.3 Home (attract screen)

![Home](screens/01-home.jpg)
![Home with Top Players](screens/13-home-after.jpg)

Layout: a full-height column = header + main + ticker. There is no `KioskFrame`.

**Header**

- Left: `PmxBrand`.
- Centre (absolutely centred, top 1rem): `PartnerLogos` **md**.
- Right: Sound + Full-screen buttons.
- On phones / portrait the logos drop to their own centred row under the header.

**Main**: a grid of `1.25fr 1fr` columns, vertically centred, gap 3rem (one column on phones / portrait).

Left column, in order:

1. A lime label with a live dot: "● WORD RUSH · BOOTH GAME".
2. Title (`h1`): "PMX Digital **Challenge**" in Space Grotesk bold **5.4rem**, leading 0.95, tight tracking (phones 2.5rem). Comes from the Admin setting `event_title`; the last word gets the gradient.
3. Subtitle: "Powering Project Delivery Through Digital" in Space Grotesk 1.75rem semibold, Soft Green (Admin `event_subtitle`).
4. Description (1.2rem, white at 80%, max-width 48rem): "Build the names of our 6 digital solutions from the word tiles in **⏱ 30 seconds**. Each name lights a star – the fastest time wins." The "⏱ 30 seconds" part is bold Yellow with a `Timer` icon; the number follows the timer setting.
5. **Tap to Begin**: full width (max 52rem), `btn-go`, min-height `max(80px, 7rem)`, radius 1.5rem, Space Grotesk `max(26px, 2.6rem)`, tight tracking. Content: `Hand` icon, "Tap to Begin", `ArrowRight`. Phones: min-height 4.8rem, 1.7rem. It opens Registration.
6. Two buttons in a 2-column grid (gap 0.75rem; stacked on phones), both `btn-xl` with 1.3rem text and 1.2rem side padding:
   - **Multiplayer Battle**: `btn-purple`, `Smartphone` icon.
   - **Head-to-Head**: `btn-blue`, `Columns2` icon. **Hidden on phones.**
7. Either:
   - **A battle lobby is open** (and it isn't a rehearsal): a purple notice (rounded-2xl, purple-soft border at 50%, purple at 45%, 1.2rem semibold) with a `Smartphone` icon: "Battle room **4821** is open – join on your phone!" (the code is Space Grotesk 1.45rem, tracking 0.2em).
   - **Otherwise**, three stats in a wrapping row (gap 2.2rem). Each stat is an icon tile (3rem, rounded-2xl, Green border at 40%, Green at 15%, lime icon) + a value (Space Grotesk 1.75rem bold) + a label (0.78rem semibold UPPERCASE, tracking 0.12em, white at 60%):
     - `Sparkles` "6" "DIGITAL SOLUTIONS"
     - `Timer` "30s" "TO LIGHT THEM ALL"
     - `Users` "2–4" "PLAYERS PER BATTLE"

Right column: the **Top Players** panel (`.panel`, padding 1.8rem).

- Header: a lime label with a live dot, "● LIVE · TODAY"; `h2` "Top Players" (Space Grotesk 2.1rem bold); on the right a Yellow `Trophy` icon (2.75rem) with a yellow glow.
- **Empty:** a dashed box (rounded-2xl, blue-soft border at 35%, padding 2.5rem 1.25rem): "No scores yet today" (Space Grotesk 1.4rem semibold) + "Be the first to light up the constellation." (white at 70%).
- **Rows** (today's top **5**, gap 0.625rem): rounded-2xl, padding 0.625rem 1rem, gap 1rem. Row 1 has a Yellow border at 40% and Yellow at 10%; other rows have white at 8% / 5%.
  - Rank badge (3rem rounded-xl, 2 px border): 1st = Yellow `Crown`; 2nd and 3rd = lime border + small `Medal` + number; others = the number.
  - Name (Space Grotesk 1.3rem semibold, truncated) over "{Project / OPU} · 6/6 stars" (0.95rem, white at 70%).
  - Time on the right (Space Grotesk 1.6rem bold, tabular): Yellow for 1st, lime for the others, e.g. "7.86s".
- `btn-ghost btn-xl` full width, 1.35rem: "View Leaderboard →".

**Bottom:** the Ticker (5.2). **Admin gear** bottom-right.

### 6.4 Registration (Solo)

![Registration – empty](screens/03a-register-empty.jpg)
![Registration – errors shown after tapping Start](screens/03b-register-errors.jpg)
![Registration – Project chosen](screens/03c-register-project.jpg)
![Registration – Business with OPU](screens/03e-register-business.jpg)
![Registration – portrait tablet](screens/03g-register-768x1024-business.jpg)

- `KioskFrame` with the title "**Register to play**", plus **Back** and **Home** (both go to Home).
- The white **registration card** is centred: full width up to 50rem, padding `max(18px, 1.9rem)`.
- Heading "**Who's playing?**" (Space Grotesk `max(24px, 2.2rem)` bold), then a line with a Green `Timer` icon: "Your name goes on the leaderboard with your project or OPU – then you have 30 seconds." (muted `max(15px, 1.05rem)`).
- Then the form (5.11). Name autofocuses.
- **Start** → the device check, then the server check → How to Play.
- The page returns Home after 60 s of no taps.

### 6.5 OPU bottom sheet

![OPU sheet](screens/03d-opu-sheet.jpg)

See 5.12.

### 6.6 How to Play

![How to Play](screens/04-howto.jpg)

- `KioskFrame` title: "Solo Rush · {Full name}" (Head-to-Head: "Head-to-Head · {A} vs {B}"). **Back** only while the how-to runs; **Home** except while starting.
- Vertically centred block (gap 1.2rem):
  - Header row: "How to play" (Space Grotesk **3rem** bold) on the left; on the right, in Yellow, a `Timer` icon + "{seconds left} s" (Space Grotesk 2rem bold).
  - **Three panels** in 3 columns (gap 1rem; stacked on phones), each `.panel` with padding 1.4rem. A panel's top row is a number circle (3rem, brand blue, Space Grotesk 1.5rem bold), a lime icon (2rem) and a title (Space Grotesk 1.7rem bold); its body text is 1.25rem.
    1. `Lightbulb` **Read the clue**: a quote box (rounded-xl, white at 5%, Space Grotesk semibold, white at 90%): "“Submits and tracks technical queries digitally”".
    2. `MousePointerClick` **Tap the words in order**: chips "1 · PTQ" and "2 · Online" (lime fill, dark text, rounded-lg, Space Grotesk bold), a decoy chip "Portal" (2 px blue-soft border at 30%, white at 35%), then on its own line "Each name you build lights a star." (white at 70%).
    3. `Sparkles` **Light all stars in 30 s**: three lines:
       - red-soft `X` "Wrong tile: **+1 s**"
       - blue-soft `SkipForward` "Skip (try it later): **+2 s**"
       - Yellow `Timer` "Fastest time wins"
       (the penalty values are bold red-soft and follow the settings).
  - Bottom row: a progress bar (0.75rem tall, rounded, white at 10%, lime fill growing over the 10 s) and a `btn-go` "**I'm ready!**" (Solo / Head-to-Head only; Battle has no button).
- After 10 s (or "I'm ready!") it shows "Starting…" (Space Grotesk 2.4rem bold, blue-soft) and asks the server to create the race. On error: the message in red-soft 1.6rem + `btn-go btn-xl` "↻ Try again".

### 6.7 Race (Solo)

![Countdown](screens/05-countdown.jpg)
![Race](screens/06-game.jpg)
![Wrong tile](screens/07-wrong.jpg)
![Three stars lit](screens/08-three-stars.jpg)

- `KioskFrame` title "{Full name} · {Project / OPU}", with **no Back or Home**.
- **Kiosk / tablet:** grid `1.55fr 1fr`, gap 1.6rem (portrait: one column).
  - Left: `PuzzleBoard` wide (5.5).
  - Right: a `.panel` (padding 1.4rem, gap 1rem) holding:
    - Timer **lg** (5.3);
    - the **constellation** filling the space (with the pulsing "next" ring);
    - the **lit list**: six rows (rounded-lg, padding 0.375rem 0.75rem, 1.12rem). A lit row is purple at 30%, semibold, with a purple-soft `Sparkles` and the solution name, in the order built. An unlit row is white at 35%: "{number} Not lit yet".
  - The 3-2-1-GO overlay covers the race area.
- **Phone upright:** a top row with the constellation (4.2 × 6rem) + Timer **sm**, then `PuzzleBoard` phone, with the countdown fixed full screen.
- **Phone sideways:** two columns, the board and an 11rem column with the constellation over the timer.
- When the race finishes (all six built or time up), wait **1100 ms**, then the **Reveal** (5.7).

![Reveal](screens/09-reveal.jpg)

### 6.8 Feedback (between the reveal and the results)

![Feedback (kiosk)](screens/11-feedback.jpg)

- `KioskFrame` with **no title, no Back, no Home** (brand, sound, full screen only).
- First "Saving your score…" (a blue spinner, 2.2rem, + brand-blue title) while the server confirms the score is saved. **If this player (full name + project name or OPU) already answered today, skip straight to Results.**
- Kiosk: the form (5.13) as a centred light card (max-width 64rem, radius 1.5rem, dark shadow) on the night sky, with the submit button in a sticky footer. Phones: a full-screen light page (max-width 34rem) with the button pinned to the bottom over a fade.
- No timer is shown. A kiosk left alone returns Home after 90 s (3 × the idle time); the score is already saved.
- Answers are stored on the device and resent automatically until the server has them (same `feedback_id`, so they are never counted twice).

### 6.9 Results

![Results](screens/10-results.jpg)

- `KioskFrame` title "**Your results**", with **Home** only.
- `h1` "**Well played, {first name}!**" (Space Grotesk 3rem bold).
- Then `ResultsView` (5.10).
- Footer row: the idle hint ("Back to the home page in 30 s if nobody taps.") on the left; on the right `btn-go btn-xl` "≡ **Leaderboard** →" (`ListOrdered` + `ArrowRight`).
- While loading: "Loading your results…" (Space Grotesk 2rem blue-soft); while offline: "Waiting for the connection to the game server…".
- Returns Home after 30 s idle.

### 6.10 Leaderboard

![Leaderboard](screens/12-leaderboard.jpg)
![Multiplayer wins](screens/23-wins-board.jpg)

- `KioskFrame` title "**Leaderboard**", with **Back** + **Home**. On the right, three tabs (`btn`, gap 0.5rem; phones full width with short labels):
  - `Trophy` "Fastest today" (phones "Today")
  - `ListOrdered` "All-time"
  - `Users` "Multiplayer wins" (phones "Wins")
- The active tab is `btn-go` (the wins tab active is `btn-purple`); inactive tabs are `btn-ghost`. After a battle the wins tab opens first; otherwise Fastest today.
- **Today / All-time:** `TimesTable` size lg, top **10**, each player's **best** game. This game's player(s) are highlighted with "YOU".
- **Wins:** two columns, "TODAY" and "ALL-TIME" (purple-soft labels), each a `WinsTable` md.
- Footer: idle hint + `btn-go btn-xl` "⌂ Back to Home". Returns Home after 30 s idle.

### 6.11 Multiplayer Battle (big screen)

![Battle lobby](screens/16-battle-lobby.jpg)
![Battle – synced countdown](screens/18-battle-race-start.jpg)
![Battle – live race](screens/19-battle-race.jpg)
![Battle – podium](screens/21-battle-results.jpg)

`KioskFrame` title:

- "Multiplayer Battle · Lobby"
- "Multiplayer Battle · Get ready"
- "Multiplayer Battle"

Back / Home appear in the lobby and at the end (they cancel the room).

**Opening:** "Opening a battle room…" (Space Grotesk 2rem, purple-soft). On error: a red message + `btn-purple btn-xl` "Try again".

**Lobby**: grid `1fr 1.15fr`, gap 2rem (stacked on phones / portrait).

- Left: a `.panel` with a purple-soft border at 40%, centred content, padding 2rem, gap 1.2rem:
  - "**Join the battle**" (Space Grotesk 2.6rem bold).
  - "Scan with your phone camera, or open the link and enter the room code." (1.3rem, white at 75%).
  - **QR code**, 15rem: a white rounded-2xl card with 0.5rem padding. Dark modules `#0B1638`, error correction M, margin 1. Encodes `{public address}/#/join/{code}`.
  - "ROOM CODE" (label, purple-soft) over the **4-digit code** (Space Grotesk **5.6rem** bold, tracking 0.25em, e.g. "9 3 0 8").
  - A URL chip (monospace 1.05rem, blue-soft, white at 5%): "{host}/#/join".
  - If the address is localhost: a Yellow warning box with `AlertTriangle`: "Phones can't open "localhost". Set the booth laptop's network address in Admin → Settings."
- Right:
  - "📱 Players 3/4" (Space Grotesk 2rem bold, purple-soft `Smartphone` icon).
  - Four slots (gap 0.8rem):
    - **Joined:** a `.panel` row that rises in, with a number circle (3rem, Purple), name (Space Grotesk 1.6rem bold) + project / OPU (1.05rem, white at 60%), then "Wifi Connected" (green-soft) or "WifiOff Offline" (red-soft), and an ✕ button to remove the player.
    - **Empty:** a 2 px dashed blue-soft box at 25% (radius 1.25rem) with a dashed circle and `UserPlus`: "Waiting for a player…" (1.3rem, white at 45%).
  - The `join` sound plays whenever someone joins.
  - Bottom: `btn-ghost btn-xl` "**Cancel**" and `btn-purple btn-xl` (fills the rest) with a filled `Play` icon:
    - "Need at least 2 players" (disabled)
    - "Start battle (3 players)"
    - "Starting…"

**How to Play (synchronised):** the same how-to with the heading "Get ready – how to play", following the server's end time, so every screen counts down together. There is no "I'm ready!" button. The players' names show underneath as purple pills.

**Live race:**

- Header row: "Live race · Room 9308" (Space Grotesk 2.4rem bold) and on the right a Timer **md** (26rem wide) captioned "RACE CLOCK", showing the race clock without penalties.
- Then `RaceLanes` lg.
- The 3-2-1-GO overlay is synced to the phones.

**Podium** (when everyone has finished): grid `1fr 1.2fr`.

- Left, centred:
  - Yellow `Crown` (4rem).
  - "**{Name} wins!**" (Space Grotesk 3.4rem bold).
  - The project / OPU (1.5rem, white at 70%).
  - The winner's constellation with the full logo, in sequence (max-width 44rem).
  - "6/6 stars · 12.34 s" (Yellow, Space Grotesk 2rem bold).
  - No winner: "No winner this time – nobody lit a star!".
- Right: `RaceLanes` with the final places.
- Footer: idle hint + `btn-ghost btn-xl` "≡ Leaderboard" + `btn-purple btn-xl` "↻ New battle".
- The reveal fanfare plays. Returns Home after 30 s idle.

**Cancelled:** "This room was closed." + "Back to start" (ghost) + "Open a new room" (purple).

### 6.12 Head-to-Head (two players, one screen; not on phones)

![H2H registration](screens/25-h2h-register.jpg)
![H2H race](screens/26-h2h-race.jpg)
![H2H reveal](screens/27-h2h-reveal.jpg)
![H2H feedback](screens/27b-h2h-feedback.jpg)
![H2H results](screens/28-h2h-results.jpg)

**Registration:**

- `KioskFrame` title "Head-to-Head", Back + Home.
- Two white cards side by side (gap 1.6rem; stacked in portrait), each with padding `max(16px, 1.4rem)` and a heading made of a brand-blue number circle (1 / 2) + "**Left player**" / "**Right player**" (Space Grotesk `max(20px, 1.7rem)` bold). Each card holds the form fields with tighter spacing.
- Enter in the left card's last field jumps to the right card's name.
- Below, centred: `btn-green btn-xl` (min-width 26rem) with `Swords` and "**Start Head-to-Head**". Tapping it while a form is invalid reveals the errors on both cards and moves focus to the first invalid card.

**Race:**

- `KioskFrame` title "Head-to-Head".
- Two halves split by a 2 px vertical line (blue-soft at 25%). Each half has:
  - a header: the name (Space Grotesk 1.7rem bold) + project / OPU (1.05rem, white at 60%), a constellation (6.2 × 8.6rem) and a Timer **md**;
  - then `PuzzleBoard` half.
- Both players tap at the same time. Only one timer plays the tick sound (the left one until that player ends, then the right).
- When one player ends, that board shows the run-over overlay with "Waiting for the other player…".

**Reveal:**

- A title "👑 **{Name} wins!**" (Yellow `Crown`) or "It's a draw!" (Space Grotesk 3rem bold).
- Two columns, each with a compact reveal. The winner's column gets Yellow at 10% and a 2 px Yellow ring at 60% (rounded-3xl).
- Moves on after 5.6 s or on a tap.

**Feedback:** player 1, then player 2, each with the pill "Player n of 2 · {Name}". Each player is skipped if they already answered today.

**Results:**

- Title: "👑 {Winner} wins in 12.34 s!" or "⚔ A draw – play again to settle it!" (Space Grotesk 2.6rem bold).
- Two columns, each with "{Name} · {Project / OPU}" over a compact `ResultsView`. The winner's column gets Yellow at 8% and a Yellow ring at 50%.

---

## 7. Phone flow – Multiplayer Battle (`#/join`)

![Phone registration](screens/16a-phone-register.jpg)
![Phone OPU sheet](screens/16b-phone-opu-sheet.jpg)
![Phone lobby](screens/17-phone-lobby.jpg)
![Phone feedback](screens/22a-phone-feedback.jpg)
![Phone results](screens/22-phone-results.jpg)

- **Shell:** centred column, max-width 34rem, padding 1rem.
  - Header: compact `PmxBrand`; on the right a title (small, bold, UPPERCASE, tracking 0.14em, purple-soft: "MULTIPLAYER BATTLE" or "ROOM 9308"); a Sound button (48 px).
  - Under the header, `PartnerLogos` **sm**, centred (hidden during the race).
  - The star background is at 60% density.
- **1. Room code** (only if the link had no code):
  - `Smartphone` icon (3rem, purple-soft), "**Join a battle**" (Space Grotesk 1.9rem bold), "Enter the 4-digit room code shown on the big screen." (white at 70%).
  - A dark `.field`, centred, Space Grotesk 2.4rem, tracking 0.5em, numeric keypad, digits only, max 4.
  - Error message in red-soft.
  - `btn-purple` full width "Next →" (enabled at 4 digits).
- **2. Registration:** the same registration card, with the heading "Who's playing?" (1.7rem) and the button "**Join the battle →**".
  - Room errors send the player back to step 1 with the message:
    - "Room not found. Check the 4-digit code on the big screen."
    - "This room is full (4 players). Wait for the next room."
    - "This battle has already started. Wait for the next room."
- **3. Lobby:**
  - A `.panel` (padding 1.25rem, centred) with a lime `PartyPopper` icon, "**You're in, {first name}!**" (1.7rem) and "Watch the big screen – the host starts the battle when everyone has joined." (white at 70%).
  - "👥 PLAYERS (3/4)" label, then the list (rounded-xl rows; **this player's row is lime with dark text and a "YOU" tag**).
  - A `btn-ghost` full-width "Leave room" (`LogOut`) at the bottom.
- **4. How to Play:** compact, one column, heading "Get ready!", synced to the big screen.
- **5. Race:**
  - A top row with the constellation (4.2 × 6rem) + Timer **sm**, then `PuzzleBoard` phone. Countdown full screen.
  - When this player has finished but others haven't: a panel with `CheckCircle2` "Finished in 12.34 s!" or `Hourglass` "Time's up!", "Waiting for the other players…", then `RaceLanes` md.
- **6. After the race:** compact Reveal → Feedback (phone page) → Results.
  - Results title: "**You won the battle!**" / "**You came 2nd**" / "Your results" (1.8rem), then a compact `ResultsView`, then `btn-go` full width "Continue →".
  - Offline: the phone shows the result from the race it already has; rank today follows once it is back online.
- **7. Thanks:** `CheckCircle2` (3.5rem, green-soft), "**Thanks for playing!**", "See the leaderboard on the big screen.", `btn-purple` "Join another battle".
- **Removed by the host:** back to step 1 with "You were removed from the room by the host.". **Room closed:** "The host closed this room." + "Join another room".
- A refresh resumes the same step (localStorage `wr.phone.session.v2`). Phones never time out.

---

## 8. TV display (`#/display`)

![TV display](screens/24-display.jpg)
![TV display during a race](screens/20-display-race.jpg)

Full screen, max-width 110rem, padding 1.4rem × 2.4rem, gap 1.2rem. It updates live.

- **Header:**
  - `PmxBrand`, a divider, then the event title (Space Grotesk 2rem bold).
  - Flexible space, then `PartnerLogos` md.
  - The Yellow pill "REHEARSAL" (`FlaskConical`) when rehearsal mode is on.
  - The time in Kuala Lumpur, "14:05" (Space Grotesk 1.6rem, white at 70%, refreshed every 15 s).
  - A faint ghost Home button (60% opacity) linking to `#/`.
- **Stats row** (3 columns): three `.panel`s, each with a blue-soft icon (2.4rem) + a label + a value (Space Grotesk 2.4rem bold):
  - `Users` "PLAYERS TODAY"
  - `Gamepad2` "GAMES TODAY"
  - `Trophy` "PLAYERS ALL-TIME"
- **Main** grid `1.25fr 1fr`:
  - **Left panel:** "🏆 Fastest times today" (Space Grotesk 1.9rem bold, Yellow `Trophy`), then `TimesTable` md, top 10. Empty: "No games yet today – be the first on the board!".
  - **Right, top:** a panel with a Yellow border at 40%: "⏱ FASTEST OF THE DAY" (Yellow label). The name is Space Grotesk 2.6rem bold, with the project / OPU (1.25rem, white at 70%) under it. On the right, the time in Yellow at 3.4rem and "6/6 stars" under it. Empty: "Waiting for the first game of the day…".
  - **Right, bottom:** the live panel. Its title is "📻 Live now · {Solo Rush | Multiplayer Battle | Head-to-Head | Multiplayer Battle lobby}" with a red-soft pulsing `Radio` icon, plus a Rehearsal tag for test races. Content:
    - **Lobby:** QR (11rem) + "BATTLE ROOM OPEN – JOIN NOW!" (purple-soft label) + the code (Space Grotesk 4.4rem, tracking 0.22em) + purple pills with the players' names (or "Waiting for players…").
    - **Running:** `RaceLanes` md.
    - **Just finished:** constellation with the N mark (9 × 12rem) + "{MODE} · JUST FINISHED" + the winner's name (2.4rem, with a `Crown` for multiplayer) + "6/6 stars · **12.34 s**".
    - **Nothing live:** title "⚔ Multiplayer wins today" + `WinsTable` sm (top 5) + "📱 Start a Multiplayer Battle on the kiosk – join with your phone."
  - Which race to feature: a running battle (or its how-to), then any running race, then an open lobby, then a just-finished race.

---

## 9. Admin (`#/admin`)

Light theme: root font 16px, page background `#f5f7fa`, text `#172033`, white `.card`s.

**Opening Admin:**

- tap the faint gear at the bottom right of Home;
- **press and hold the PMX logo for 2.5 s** on any kiosk screen;
- press **Ctrl + Shift + A**;
- or open `#/admin`.

### 9.1 Sign-in and PIN

![Admin](screens/02-admin.jpg)

- **Login:** full-screen page-sky gradient. A `btn-go` "⌂ Back to Home" sits top-left. Centred white card (max-width 24rem, rounded-2xl, padding 1.75rem, large shadow):
  - `PartnerLogos` sm on a brand-blue rounded panel.
  - "**PMX Digital Challenge · Admin**" (xl extra-bold), "Enter the Admin PIN." (muted).
  - A PIN field (password, numeric, digits only, max 12, centred, 2xl, tracking 0.5em).
  - A red error.
  - `btn-admin` full width "Sign in" (enabled from 4 digits; "Checking…" while checking).
  - `btn-light` "⌂ Back to Home".
- **First login:** a forced card "**Choose your own Admin PIN**" with "The default PIN only works once. Pick a 6–12 digit PIN (no repeated digits or runs like 123456) and keep it with the booth lead." Fields: Current PIN, New PIN, New PIN again; button "Save PIN".
  - Errors: "Use 6 to 12 digits." / "Do not use one repeated digit." / "Do not use a straight run of digits." / "The new PINs do not match."
  - Success: "PIN changed."
- Five wrong PINs lock Admin for 5 minutes. Sessions last 12 hours (token in sessionStorage `wr.admin.token`). The last open section is remembered (`wr.admin.tab`).

### 9.2 Layout

- **Left sidebar** (240 px, brand blue, white text, sticky, full height, padding 1rem, gap 1rem):
  - compact `PmxBrand`; "ADMIN" (xs bold UPPERCASE, tracking 0.16em, lime); `btn-go` "⌂ Back to Home" (small).
  - Navigation groups (11 px bold UPPERCASE, white at 45%):
    - **INSIGHTS:** Dashboard (`BarChart3`), Feedback (`MessageSquare`)
    - **EVENT DESK:** Live races (`Radio`), Results & players (`ListChecks`), Leaderboards (`Trophy`)
    - **GAME:** Solutions & decoys (`Puzzle`), Settings (`Settings`)
    - **DATA:** Project names (`FolderKanban`), Exports & data (`Database`), Audit log (`ScrollText`), Change PIN (`KeyRound`)
  - Item style: rounded-lg, padding 0.5rem, small semibold. **Active = lime fill with dark text**; others white at 85%, white at 10% on hover.
  - Bottom: "↗ TV display" (opens `#/display` in a new tab), "Sign out", and the version "v1.0.0" (11 px, white at 40%).
- **Under 768 px:** the sidebar becomes a sticky blue top bar with a Home icon button, a section drop-down and a sign-out button.
- **Main** (max-width 1400px, padding 1.25–1.75rem, sections spaced 1.25rem): a header row with the section name (2xl extra-bold, brand blue) and `btn-light` "⌂ Back to Home".
- **Shared Admin parts:**
  - `SectionCard`: a `.card` with a header (padding 1rem 1.25rem, bottom border, lg extra-bold title, actions on the right).
  - Notes (rounded-xl, small semibold): info (blue), error (red), ok (`#00726e` on Green at 5%), warn (`#7a5200` on Yellow at 15%).
  - Two-step **ConfirmButton**: the first tap turns it red with "Tap again to …"; it resets after 4 s.
  - Table header cells: xs bold UPPERCASE, wide tracking, muted; cells padding 0.625rem 1rem.
  - **Toggle switch:** 28 × 48 px rounded-full, Green when on, `#c5cfdb` when off, white knob; the label is followed by "(On)" / "(Off)".

### 9.3 Sections

![Dashboard](screens/29b-admin-dashboard-full.jpg)

**Dashboard** (refreshes every 15 s)

- **Filter card:**
  - Day: "Today", "All days", then each day.
  - Mode: "All modes", "Solo Rush", "Multiplayer Battle", "Head-to-Head".
  - Export buttons: `btn-admin` "Excel report", then `btn-light` "Games CSV", "Participants CSV", "Feedback CSV", "Project names CSV", "OPUs CSV", "Solutions CSV".
- If rehearsal games are in the period, an info note says they are left out.
- **8 stat tiles** (2 columns, 4 from md). Each tile: an xs UPPERCASE muted label, a 2xl extra-bold value and an xs muted note.

  | Tile | Value | Note |
  |---|---|---|
  | Players | count | "name + project / OPU" |
  | Games | count | "N battles / head-to-heads" |
  | All 6 lit | % | "N games" |
  | Avg stars lit | x.x | "out of 6" |
  | Fastest | x.xx s | "all 6 solved" |
  | Avg finish | x.xx s | "games with all 6" |
  | Understanding | x.x / 5 | "feedback Q3 · N answers" |
  | Feedback rate | % | "of games · details under Feedback" |

- **Charts** (2 columns from xl). Each chart is a card with a title, a muted subtitle and a "Table" / "Chart" toggle button that shows the same data as a table:
  1. "Games by hour" or "Games by day" ("Malaysia time"): column chart.
  2. "Stars lit per game" ("How far players got"): columns 0–6.
  3. "Game modes": split bar (Solo #3f86e6, Battle #763F98, Head-to-Head #00A19C).
  4. "Solutions – solve rate" ("Share of rounds where the name was built · wrong tiles per round"): horizontal bars in %, lowest first, with the note "x.x wrong/round".
  5. "Project vs Business" ("Where players are from"): split bar (Project #3f86e6, Business #763F98) + a games line.
  6. "Players by OPU" ("Business visitors (the table lists every OPU in Settings)"): bars + the note "N OPUs with no players yet – switch to Table to see every OPU."
  7. "Players by project name" ("Spellings grouped (capitals and spaces ignored) – merge more under Project names"): the top 12 bars.
  8. "Solution interest" ("Players who picked each solution in feedback Q2 – more under Feedback"): bars.
- **Chart style** (plain HTML/CSS):
  - **Column chart:** 180 px tall; 3 y-ticks (0, half, a "nice" max of 1/2/5 × 10ⁿ); gridlines `#e4e8ee`; columns max 24 px wide, 2 px gaps, 4 px rounded tops; a value label on the peak only; 11 px muted x labels.
  - **Bars:** label column `minmax(8rem, 14rem)`, bar 20 px tall with a 4 px rounded end, value + note on the right.
  - **Split bar:** 28 px tall, 2 px gaps, with a legend of swatch + label + "N · %".
  - **Donut:** 168 px, stroke 24, 2 px gaps, a big % in the middle.
  - **Tooltip** on hover / keyboard focus: a white card with a border and shadow, bold value + muted label.
  - Empty: a dashed box "No data for these filters."

![Feedback dashboard](screens/31-admin-feedback.jpg)

**Feedback** (refreshes every 15 s)

- **Filters:** Date from, Date to, "Today", "All dates", Game mode ("All modes" / "Solo" / "Team (Battle / Head-to-Head)"), Project / Business ("Project and Business" / "Project" / "Business"), OPU ("All OPUs" + list). Buttons: Excel, CSV.
- **5 tiles:**

  | Tile | Note |
  |---|---|
  | Responses | "one per player per day" |
  | Response rate | "of N completed games" |
  | Relevant | "Q1 Yes" |
  | Would explore | "Q2 Yes" |
  | Understanding | "Q3 average stars" (x.x / 5) |

- **Charts:**
  - "Q1 · Information relevant" and "Q2 · Would explore the solutions": donuts (Yes #3f86e6, No #98a2b3, the middle shows "% said Yes").
  - "Q3 · Understanding": the big average + 5 small stars + columns "1 ★" to "5 ★".
  - "Solution interest": bars, highest first.
- **Breakdown** card with tabs "By OPU" / "By project name". Table columns: OPU (or Project name), Responses, Relevant (Q1 Yes), Would explore (Q2 Yes), Understanding (Q3 avg).
- Rehearsal answers are left out (with an info note).

**Live races** (refreshes every 3 s)

- One bordered box per lobby or race:
  - mode name + a purple "Room 1234" tag + a status tag + a yellow "Rehearsal" tag;
  - "Stop race" (two-step);
  - the players: wifi icon, bold name, muted project / OPU, "4/6 · playing".
- Empty: "No lobbies or races right now."
- After a stop: "Race stopped – open runs ended with what they had."

![Results & players](screens/14-admin-results.jpg)

**Results & players**

- A segmented control "Games" / "Players". Filters (Day, Mode) + "Search" (name, project or OPU) + a "Show rehearsal games" checkbox.
- **Games table columns:**
  - Ended (KL date and time)
  - Mode
  - Name (a crown if they won)
  - Project / OPU: a "PROJECT" (blue) or "BUSINESS" (purple) tag + the value; "→ {merged group}" underneath when merged
  - Solved
  - Time
  - Penalties (+ "1 wrong · 1 skip")
  - Status tags: "All solved" / "Time up", "Rehearsal", "Removed"
  - Actions:
    - **Remove**: asks for a reason (at least 3 characters), then "Remove" / "Cancel"; the result is "Entry removed from the boards.". Removed rows are struck through on a red tint.
    - **Restore**
    - **Mark test** / **Unmark test**
- **Players table columns:** Name, Project / OPU, Games, Best ("6/6 · 7.86 s"), Battle wins, Last played.

![Leaderboards](screens/15-admin-boards.jpg)

**Leaderboards**

- Text: "Best time per player (full name + project name or OPU). Rehearsal games and removed entries are never shown." + the two-step "↻ Reset daily board" ("Today's boards start again from now. All-time boards and all game records are kept.").
- Four cards: "Fastest today (n)", "All-time (n)", "Multiplayer wins today", "Multiplayer wins all-time".

![Solutions & decoys](screens/13-admin-solutions.jpg)

**Solutions & decoys**

- "Save solutions". Explanation: "The answer is the solution name, split into word tiles. Each round picks 2–3 decoys – first from the solution's own list, then from the global decoys in Settings. A decoy that is one of the solution's own words is dropped automatically."
- **Six cards** "① STAR 1" … "⑥ STAR 6", each with:
  - Name (the answer), max 60
  - Clue (shown in the game), max 140
  - Recap line (results screen), max 220
  - Decoy words (comma-separated), with the hint "N usable decoys." or "Only N usable – global decoys fill the rest."
- **"Preview a round"** with buttons "Word tiles" and "Hard Mode": the six clues with their tiles (green = answer tile, grey = decoy) and "Answer: {name}".

**Settings**

- A warn note while rehearsal mode is on.
- **Game rules** card ("Save settings"):

  | Field | Range / hint |
  |---|---|
  | Timer (seconds) | 10–120, default 30 |
  | Wrong tile penalty (s) | default 1 |
  | Skip penalty (s) | default 2 |
  | Hard Mode toggle | "short words (e.g. PTQ, AI, PDSB) become letter tiles" |
  | Hard Mode: letter tiles for words up to | 2–6, default 4 |
  | Decoys per round – minimum / maximum | 0–5 |
  | Global decoy words | comma-separated |

- **Event & screens** card:

  | Field | Range / hint |
  |---|---|
  | Rehearsal mode toggle | |
  | Sound on by default toggle | |
  | Home page title | max 60 |
  | Subtitle | max 80 |
  | How to Play (seconds) | 3–30 |
  | Back to start after (seconds idle) | 10–300 |
  | Close idle battle lobby after (s) | 60–1800 |
  | Network address for the phone join QR code | e.g. `http://10.1.2.3:8090` |

- **OPU list (registration):** a textarea, one per line, "Group - Name" for grouping; 2–80 characters each, no repeats, up to 40 lines.
- **Blocked words (names & project names):** a monospace textarea. "word" blocks the whole word; "word*" also blocks it inside other words.

![Project names](screens/30-admin-project-names.jpg)

**Project names**

- An explanation of automatic grouping (capitals, accents, extra spaces and spaces around & / - + are ignored).
- Ticking two or more groups shows a **merge panel**: "Merge into" (select), "Show as (optional)", "Merge N groups".
- Table: checkbox · Project name (✏ rename inline) · Players · Spellings grouped (chips "Kasawari ×3", plus "unmerge “kasawari ccs”" buttons).

**Exports & data**

- **Exports:** an explanation, filters (default All days) and the same export buttons.
- **Backups:** "Back up now"; a list of "{date} · {reason} · {size} KB" with "Download". A daily automatic backup keeps the last 14.
- **Rehearsal & test data:** an Admin PIN field + the two-step "Delete rehearsal / test data" (a backup is taken first).

**Audit log:** table When / Action (underscores shown as spaces) / Details (monospace JSON).

**Change PIN:** the same card as 9.1.

---

## 10. Responsive behaviour summary

| Screen | Kiosk landscape (1920×1080, 1280×800) | Tablet portrait (768×1024) | Phone upright (360–430 wide) | Phone sideways |
|---|---|---|---|---|
| Home | Two columns, no scrolling | One column, scrolls; logos on their own row | One column; Head-to-Head hidden; full-screen button hidden | Same as phone |
| Registration | Centred 50rem card | Card full width | Card full width, normal 16 px type | Scrolls |
| Race | Board + side panel | One column | Stars + clock on top, board below, countdown full screen | Board + 11rem side column |
| Results / Leaderboard | Fits | Scrolls | Scrolls; stat grid 2 columns; Project / OPU under the name | Scrolls |
| Battle host | Two columns | One column | One column | |
| Head-to-Head | Two halves | Registration stacks | **Not offered** | |
| Admin | Sidebar | Sidebar (≥768) | Top bar + drop-down | |

Checks the original passes: no sideways scrolling on any screen, every tap target at least 44 px (kiosk 56 px), text at least 11 px, and the clock and every tile on screen while playing on a 360 px phone.

---

## 11. Game rules and logic

### 11.1 The round

- The **6 solutions**, one at a time, in a **random order**. Each shows its clue and **shuffled tiles**: the answer words plus **2–3 decoys** (Admin min / max).
  - Decoys come first from the solution's own list (shuffled), then from the global list.
  - A decoy equal to one of the answer words (ignoring case) is never used.
- Tiles get their ids **after** shuffling, so ids reveal nothing about the order.
- The round is built from a **seeded random generator** (the seed is the race id). Everyone in a battle gets the same order and the same tile shuffle.

### 11.2 Taps

| Action | Result |
|---|---|
| Correct tile (matches the next word; tiles with the same text are interchangeable) | Placed in the next slot (`tap` sound). When the name is complete: the star lights, `chime`, the green flash, **the next solution appears immediately**. |
| Wrong tile | Shakes red with ✕, **+1 s** penalty (Admin setting), `wrong` sound, red flash. Nothing placed is lost. |
| Skip | The current solution moves to the **end of the queue**, its progress is cleared, **+2 s**. Not available for the last unsolved solution. |
| Clock reaches 0 | The run ends ("Time's up!"). |

### 11.3 Time

- Limit **30 s** (Admin 10–120).
- **Effective time = real time since GO + penalties.** Penalties move the clock forward. The run ends when the effective time reaches the limit.
- The server keeps a deadline timer per run: GO + limit − penalties.
- The finishing time (all six built) includes penalties.
- **"Time used" for out-of-time runs** is the effective time of the last solution built (with none built, it is the full limit).

### 11.4 Hard Mode

Words of 2 to `hard_max_letters` (default 4) letters or digits (e.g. **PTQ**, **AI**, **PDSB**) become **one tile per letter**. Each such word adds **one decoy letter**: a random letter from `ABCDEFGHJKLMNPRSTUVWXYZ` that isn't in the word. The answer slots show one box per letter with "?" as the hint.

### 11.5 Ranking, titles and boards

- **Ranking:** more solved first, then the lower time, then whoever ended first.
- **Titles:** 6 = **NC Master**, 4–5 = **NC Explorer**, 0–3 = **NC Rookie**.
- **Player identity:** full name + project name, or full name + OPU. Matching ignores capitals, accents and spacing, and applies Admin merges.
- **Boards** show each player's **best** game:
  - "Fastest today" (Kuala Lumpur day, after the last daily reset), "All-time" and "Multiplayer wins" (Battle and Head-to-Head wins per player, today and all-time, with best time).
  - Rehearsal and removed games never appear.
  - The public boards return the top 10.
- **Battle / Head-to-Head winner:** place 1, and only if they built at least one solution. 0–0 = no winner / draw.
- **Times** are shown as seconds with two decimals: `round(ms / 10) / 100`, fixed to 2 places.

### 11.6 Registration rules (device and server; Appendix H)

| Field | Rule | Message |
|---|---|---|
| Full name | Trimmed, single spaces, 2–60 characters. Letters in any language (accents included), spaces, apostrophes, hyphens, periods; "a/l" and "a/p" allowed; at least 2 letters; no digits or other symbols; no blocked words | *Please enter your full name.* |
| You are from | Project or Business must be chosen | *Please select Project or Business.* |
| Project name | 2–80 characters, at least one letter; letters, digits, spaces and `' ’ . - / & ( ) , + # :`; no blocked words | *Please enter your project name.* |
| OPU | Must match an entry of the Admin list (ignoring case and spacing); saved exactly as listed, e.g. "Downstream - MRCSB" | *Please select your OPU.* |
| Consent | Must be ticked | *Please tick the consent box to continue.* |

Blocked-word matching undoes leetspeak (0→o, 1→i, 3→e, 4→a, 5→s, 7→t, 8→b, @→a, $→s, !→i), removes accents and squeezes repeated letters ("fuuuck"). Full logic: Appendix H.

### 11.7 Feedback rules

- Asked **once per player per Kuala Lumpur day**, after the score is saved and **before** the result card. A replay the same day goes straight to the result card.
- All three questions are required. The chips are only allowed with Q2 = Yes.
- `game_mode` is `solo`, or `team` for Battle and Head-to-Head.
- Rehearsal answers are counted separately.
- An answer given offline keeps the time it was given.

### 11.8 Server authority and resilience

- Each device runs the **same reducer** (Appendix G) locally for instant feedback and sends every tap and skip to the server.
- The server applies them with **its own clock** (elapsed = server now − GO) and answers with its state. When no taps are in flight, the device adopts the server's state.
- Devices sync their clock to the server (5 round trips, keeping the fastest; repeated every 30 s), so countdowns match on every screen.
- **Refresh / dropped Wi-Fi:** the page re-attaches with its saved run token and continues. The server keeps timing. A disconnected battle player's game ends when their time runs out.
- After a server restart, running races are recovered (runs whose time ran out end at once) and open lobbies are closed.
- An idle battle lobby closes after **5 minutes** (Admin setting).
- **Rehearsal mode:** games are saved as test data and never reach the boards or statistics.

---

## 12. Content (first-run defaults – all editable in Admin)

### 12.1 The six solutions (the constellation's six stars)

| # | Name (answer) | Clue (in the game) | Recap line (results) | Own decoys |
|---|---|---|---|---|
| 1 | Schedule Intelligent Dashboard | Spots schedule delays early with smart analytics | Consolidates schedule health and performance to flag potential schedule concerns early. | Smart, Analytics, Tracker, Portal |
| 2 | PTQ Online | Submits and tracks technical queries digitally | Simplifies submission, review, approval and tracking of technical queries and project changes. | Portal, Digital, System, Hub |
| 3 | Project Production Management | Tracks site productivity and work progress | Plan simulations, resource optimisation and daily work control to keep site work on track. | Tracker, Digital, Hub, System |
| 4 | Project AI | Predicts project risks using artificial intelligence | Uses artificial intelligence to predict project risks before they become issues. | Smart, Analytics, Digital, Insight |
| 5 | PDSB Services | Digital services delivered by PDSB | Digital services delivered by PDSB for project teams. | Portal, Hub, Digital, Platform |
| 6 | Project Command Centre | One central view to monitor and control the project | The single source of truth for project data – one central view to monitor and control the project. | Smart, Hub, System, Tracker |

**Global decoys:** Smart, Portal, Hub, Analytics, Digital, Tracker, System, Platform, Insight, Cloud.

### 12.2 OPU list (Business), in this order

**Downstream** – MRCSB, PC MTBE, PCEPE, PCFKSB, PCGCo, PCMSB, PCOGD, PDB, PETCO, PLISB, PP(T)SB, PRPC Group · **Gas & Maritime** – MLNG, PGB GPU · **PE&T** – GPE, PDSB, PRSB · **Upstream** – MPM, PMA, SBA, SKA · **Others**.

Stored as "Downstream - MRCSB" … "Others" (22 entries; see Appendix I).

### 12.3 Default settings

| Setting | Default |
|---|---|
| Home page title | PMX Digital Challenge |
| Subtitle | Powering Project Delivery Through Digital |
| Timer | 30 s |
| Wrong tile / Skip penalty | 1 s / 2 s |
| Hard Mode | off; letter tiles for words up to 4 |
| Decoys per round | 2–3 |
| How to Play | 10 s |
| Idle return | 30 s |
| Rehearsal mode | off |
| Sound on by default | on |
| Battle lobby closes | 300 s |
| Battle players | 2–4 |
| Countdown before GO | 3.5 s |

### 12.4 Ticker (34 PMX catalogue names, in order)

Project Command Centre · PPMS Suite · EPMS Project Risk · EPMS Permitting · Project Lesson Learn · Benchmark Hub · MYICONS · P6 EPPM · Smart Planner · Aspen K-Base · ORION · SAFRAN · Schedule Intelligent Dashboard · Synchro 4D · Project AI · P-EDMS · E-CDBM · PTQ Online · Selektor · P-ELSOR · FnGMap · Augmented Engineering Review · Engineering Maturity Index · LNGPro · ProTrackS · CR Pro · Advanced Work Packaging · Construct Hub · Project Production Management · PCMS · Quality+ · Online Project Quality · Quality Card · QPRS

### 12.5 Other fixed copy

- Page title: "PMX Digital Challenge – Word Rush". Meta description: "PMX Digital Challenge – Word Rush: build the names of our 6 digital solutions in 30 seconds."
- No visitor-facing screen says "Nerv Centre" (only the NERVCENTRE logo appears).

---

## 13. Back end

### 13.1 Architecture

- **One Node.js process** (Fastify) serves the built front end, the REST API and **Socket.IO** on one port (default **8090**, host 0.0.0.0).
- **PostgreSQL** through `DATABASE_URL`. Empty means embedded PGlite in a local data folder. Schema migrations run at start-up.
- The **race engine** keeps live races in memory and saves to the database on every solve, wrong tile, skip and end.
- Each run has a secret **run token**; each lobby or Head-to-Head has a **host token**. Only SHA-256 hashes are stored.
- Every message is validated with zod, and a flood guard limits messages.
- **Admin:** the PIN is hashed with scrypt; the default PIN must be changed at first login; 5 wrong PINs = 5-minute lockout; 12-hour sessions; an audit log.
- All "daily" logic uses **Asia/Kuala_Lumpur** time (UTC+8).

### 13.2 REST API

| Method and path | Purpose |
|---|---|
| GET `/api/health` | `{ ok, version, time }` (Render health check) |
| GET `/api/config` | Public settings (no blocked words or global decoys), solution names + recap lines, server time, KL day, version |
| POST `/api/players/validate` | Registration check → `{ ok, value }` or 400 `{ error:'invalid_player', field, message, errors }` |
| GET `/api/boards` | Boards: today, all-time, wins today / all-time, stats (players today, players total, games today, fastest today) |
| GET `/api/live` | Live races |
| GET `/api/runs/:id/result` (header `x-run-token`) | The result card for that run |
| GET `/api/runs/:id/feedback` | `{ score_saved, required, day }` (answers only once the score is saved) |
| POST `/api/feedback` | The three answers (safe to resend with the same `feedback_id`) |
| POST `/api/admin/login` · `/logout` · GET `/me` · POST `/pin` | Admin auth (Bearer token) |
| GET / PUT `/api/admin/settings` · `/api/admin/solutions` · GET `/api/admin/preview?hard=0/1` | Content |
| GET `/api/admin/runs` · POST `/runs/:id/remove` · `/restore` · `/test` · GET `/participants` | Results and players |
| GET `/api/admin/boards` · POST `/boards/reset-daily` | Boards |
| GET `/api/admin/live` · POST `/races/:id/stop` | Live races |
| GET `/api/admin/projects` · POST `/projects/merge` · `/unmerge` · `/label` | Project names |
| GET `/api/admin/dashboard` · `/feedback` · `/feedback/export.csv` · `/feedback/export.xlsx` | Insights |
| GET `/api/admin/export.csv?table=games/participants/feedback/projects/opus/solutions` · `/export.xlsx` | Exports (Excel: one sheet per table) |
| POST `/api/admin/test-data/delete` (needs the PIN) · GET / POST `/api/admin/backups` · GET `/backups/:name` | Data |
| GET `/api/admin/audit` | Audit log |

### 13.3 Socket.IO events (every client → server event has an acknowledgement callback `{ ok:true, … } | { ok:false, error, message, field?, errors? }`)

| Client → server | Payload → reply |
|---|---|
| `time:sync` | → server now (ms) |
| `solo:start` | `{ player, kiosk_id }` → `{ race, run_id, token }` (GO = now + 3.5 s) |
| `h2h:start` | `{ players[2], kiosk_id }` → `{ race, host_token, runs[{run_id, token}] }` |
| `room:create` | `{ kiosk_id }` → `{ race, host_token }` (random 4-digit code 1000–9999, unique among open rooms; one open lobby per kiosk) |
| `room:join` | `{ code, player, device_id }` → `{ race, run_id, token }` (errors `room_not_found`, `room_full`, `room_started`) |
| `room:leave` / `room:kick` / `room:cancel` | Lobby only |
| `room:start` | `{ race_id, host_token }`, needs at least 2 players → status `howto`; how-to ends now + 10 s; GO 3.5 s later |
| `race:watch` / `race:unwatch` | Subscribe to a race (a run token marks that player as connected) |
| `run:tap` | `{ race_id, run_id, token, puzzle, tile }` → `{ outcome, progress, status }` |
| `run:skip` | `{ race_id, run_id, token, puzzle }` → same |
| `display:watch` | → `{ live }` |
| **Server → client:** `race:state` (full race), `boards:changed`, `live:changed` (live races), `settings:changed` | |

Race status: `lobby → howto → running → finished` (or `cancelled`). Run status: `waiting · playing · finished · timeout · left`. Data shapes (`RaceState`, `RunProgress`, `RunResult`, `Boards` …): Appendix G, `shared/types.ts`.

### 13.4 Database (final schema – create directly for a fresh build)

```sql
CREATE TABLE settings   (key text PRIMARY KEY, value jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now());  -- one row per setting
CREATE TABLE solutions  (id text PRIMARY KEY, position int NOT NULL, name text NOT NULL, clue text NOT NULL,
                         description text NOT NULL DEFAULT '', decoys jsonb NOT NULL DEFAULT '[]', updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE players    (id uuid PRIMARY KEY, full_name text NOT NULL, affiliation_type text NOT NULL CHECK (affiliation_type IN ('project','business')),
                         project_name text, opu text, name_key text NOT NULL, affil_key text NOT NULL,  -- affil_key = 'p:<project key>' | 'o:<opu key>'
                         created_at timestamptz NOT NULL DEFAULT now(), last_seen_at timestamptz NOT NULL DEFAULT now(), UNIQUE (name_key, affil_key));
CREATE TABLE races      (id uuid PRIMARY KEY, mode text NOT NULL CHECK (mode IN ('solo','battle','h2h')),
                         status text NOT NULL CHECK (status IN ('lobby','howto','running','finished','cancelled')),
                         room_code text, rules jsonb NOT NULL, puzzles jsonb NOT NULL DEFAULT '[]', host_token_hash text, kiosk_id text,
                         is_test boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now(),
                         howto_ends_at timestamptz, go_at timestamptz, ended_at timestamptz, updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE runs       (id uuid PRIMARY KEY, race_id uuid NOT NULL REFERENCES races(id) ON DELETE CASCADE,
                         player_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE, lane int NOT NULL,
                         full_name text NOT NULL, affiliation_type text NOT NULL CHECK (affiliation_type IN ('project','business')), project_name text, opu text,
                         token_hash text NOT NULL, device_id text,
                         status text NOT NULL CHECK (status IN ('waiting','playing','finished','timeout','left')),
                         progress jsonb NOT NULL, solved int NOT NULL DEFAULT 0, time_ms int, penalty_ms int NOT NULL DEFAULT 0,
                         wrong int NOT NULL DEFAULT 0, skips int NOT NULL DEFAULT 0, place int, is_winner boolean NOT NULL DEFAULT false,
                         is_test boolean NOT NULL DEFAULT false, consent_at timestamptz NOT NULL DEFAULT now(),
                         removed_at timestamptz, removed_reason text, created_at timestamptz NOT NULL DEFAULT now(),
                         ended_at timestamptz, updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE feedback   (feedback_id uuid PRIMARY KEY, session_id uuid NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
                         player_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE, team_id uuid REFERENCES races(id) ON DELETE CASCADE,
                         full_name text NOT NULL, affiliation_type text NOT NULL, project_name text, opu text,
                         q1_relevant boolean NOT NULL, q2_would_explore boolean NOT NULL, q2_interested_solutions text[],
                         q3_understanding_rating int NOT NULL CHECK (q3_understanding_rating BETWEEN 1 AND 5),
                         game_mode text NOT NULL CHECK (game_mode IN ('solo','team')), submitted_at timestamptz NOT NULL DEFAULT now(),
                         is_test boolean NOT NULL DEFAULT false,
                         CONSTRAINT feedback_solutions_need_yes CHECK (q2_would_explore OR q2_interested_solutions IS NULL));
CREATE UNIQUE INDEX feedback_one_per_player_per_day ON feedback (player_id, ((submitted_at AT TIME ZONE 'Asia/Kuala_Lumpur')::date), is_test);
CREATE TABLE project_aliases (alias_key text PRIMARY KEY, target_key text NOT NULL, created_at timestamptz NOT NULL DEFAULT now());  -- Admin merges
CREATE TABLE project_labels  (project_key text PRIMARY KEY, label text NOT NULL, updated_at timestamptz NOT NULL DEFAULT now());     -- Admin renames
CREATE TABLE admin_users    (id uuid PRIMARY KEY, pin_hash text NOT NULL, must_change_pin boolean NOT NULL DEFAULT true, failed_attempts int NOT NULL DEFAULT 0,
                             locked_until timestamptz, last_login_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE admin_sessions (token_hash text PRIMARY KEY, user_id uuid NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
                             expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE audit_log      (id bigserial PRIMARY KEY, at timestamptz NOT NULL DEFAULT now(), action text NOT NULL, details jsonb NOT NULL DEFAULT '{}');
CREATE INDEX races_status ON races (status); CREATE INDEX runs_race ON runs (race_id); CREATE INDEX runs_player ON runs (player_id);
CREATE INDEX runs_ended ON runs (ended_at); CREATE INDEX feedback_session ON feedback (session_id); CREATE INDEX feedback_submitted ON feedback (submitted_at);
```

Project-name grouping key: lower case, accents removed, single spaces, no spaces around `& / - +`, leading/trailing punctuation trimmed (e.g. "GT & C" = "gt&c"). A group's label is the Admin rename, or else the most-used spelling (ties: more capital letters).

### 13.5 Configuration (environment variables)

| Variable | Meaning |
|---|---|
| `PORT` (8090), `HOST` (0.0.0.0) | Listen address |
| `DATABASE_URL` | PostgreSQL connection string (empty = embedded PGlite) |
| `DATA_DIR`, `BACKUP_DIR` | Local data and backups (booth laptop) |
| `ADMIN_DEFAULT_PIN` | First-login PIN (local default 1234; **on Render it must be a 6–12 digit PIN that is not a repeat or a run**) |
| `PUBLIC_BASE_URL` | Address in the join QR (on Render, `RENDER_EXTERNAL_URL` is used automatically) |
| `TLS_KEY_FILE`, `TLS_CERT_FILE` | Optional HTTPS |
| `LOG_LEVEL` | `warn` |

On Render (the `RENDER` environment variable is set), the server **refuses to start** without `DATABASE_URL` (Render wipes the disk on every deploy) or with a weak default PIN.

### 13.6 Hosting on Render

- `render.yaml` Blueprint (Appendix B): one **web** service, runtime node, region **singapore**, plan free (switch to **starter** for event days; free sleeps after 15 minutes idle), **numInstances: 1** (live races live in memory).
  - Build: `npm ci --include=dev && npm run build`. Start: `npm start`. Health check: `/api/health`. `autoDeploy: true`.
  - Environment: `NODE_VERSION=24`, `LOG_LEVEL=warn`, `DATABASE_URL` and `ADMIN_DEFAULT_PIN` (secrets).
- Database: Neon → new project → region AWS Asia Pacific (Singapore) → copy the connection string (ends `?sslmode=require`).
- After deploy: open `https://<service>.onrender.com/#/admin`, sign in with the first-login PIN and choose the permanent PIN. Share `https://<service>.onrender.com` (for example as a QR code on the booth poster).

---

## 14. Acceptance checklist (compare the rebuild with the screenshots)

- [ ] The night sky: a blue radial gradient, a purple glow bottom-right, a green glow bottom-left, a faint 4rem grid fading at the edges, twinkling and drifting stars, an occasional shooting star.
- [ ] The 1 s splash with the logos pill, the PMX mark glow, the gradient title, the progress bar and "GET READY".
- [ ] Home matches screenshot 01: the title with the gradient last word, the lime subtitle, the giant lime "Tap to Begin", the purple and blue buttons, three stats, the Top Players panel, the ticker, the faint gear.
- [ ] Every kiosk screen fits 1920×1080 and 1280×800 **without scrolling** (rem scaling).
- [ ] Registration: nothing pre-selected; Start looks disabled but a tap reveals inline red errors; the project / OPU field slides in; switching type clears the field; the OPU bottom sheet is grouped with headings; the consent box turns lime.
- [ ] How to Play: three panels, the 10 s countdown with a lime bar, "I'm ready!".
- [ ] 3-2-1-GO is synced to server time (identical on two screens in a battle).
- [ ] The race: yellow timer with 0.01 s, red + ticking in the last 5 s; tiles on pointer-down; wrong = red shake + "+1 s"; skip = "+2 s"; the green "✓ name" flash; the next solution appears immediately; the constellation lights star by star with the pulsing next ring.
- [ ] The reveal: stars light one by one, the NERVCENTRE logo appears under a full constellation, the stars sit exactly on the "N".
- [ ] Feedback: a light Nunito card; Yes / No with 👍 / 👎; chips only on Q2 = Yes; five yellow stars with labels; "See My Result" grey until complete, then green and pulsing; asked only once per player per day.
- [ ] Results: the title badge, four stat panels, the recap of six solutions, the idle countdown, the lime Leaderboard button.
- [ ] Leaderboard: three tabs, crown / medal ranks, the lime "YOU" row, Back to Home.
- [ ] Battle: QR + the big 4-digit code, four player slots with kick, a purple start button, the synced how-to, live lanes with purple bars, the podium with crown and constellation.
- [ ] Phones: the join flow works at 360 px wide; Head-to-Head is hidden on phones.
- [ ] Head-to-Head: simultaneous taps on both halves, the winner highlighted in yellow.
- [ ] TV display: stats, fastest today, fastest of the day, the live panel with QR / lanes / winner, the KL clock.
- [ ] Admin: the light theme, the blue sidebar with lime active item, all ten sections, charts with Table toggles, exports.
- [ ] Sounds as in 4.11; the mute toggle is remembered.
- [ ] A refresh mid-game resumes the same game; time keeps running on the server.

---

# Appendices – original files

Copy these files verbatim into the same paths. They are the exact source of the original app.

## Appendix A – Stylesheet (copy verbatim)

The complete design system: Tailwind 4 theme tokens, custom variants, base rules and component classes.

### `client/src/styles.css`

```css
@import "tailwindcss";

/* Phones: narrow screens in portrait, or any screen less than 520px tall (a phone turned sideways).
   Same query as PHONE_QUERY in lib/hooks.ts. Two blocks: the short form keeps only the first half of
   a comma-separated media query list. */
@custom-variant phone {
  @media (max-width: 640px) {
    @slot;
  }
  @media (max-height: 520px) {
    @slot;
  }
}
/* A phone turned sideways (short screen). */
@custom-variant short (@media (max-height: 520px));

/* ── Brand theme ───────────────────────────────────────────────────────────
   The five PMX colours: Blue #20419A (backgrounds & structure – the "sky" shades below are
   darker Blue) · Soft Green #BFD730 (main buttons, selected / active) · Green #00A19C (correct,
   done) · Yellow #FDB924 (timer, 1st place) · Purple #763F98 (multiplayer, star glow).
   Red is used only for a wrong tile / error message. "-soft" tints are for text on dark Blue.
   Dark text on Yellow / Soft Green. */
@theme {
  --font-sans: "Inter Variable", "Segoe UI", system-ui, -apple-system, sans-serif;
  --font-display: "Space Grotesk Variable", "Inter Variable", "Segoe UI", system-ui, sans-serif;
  /* Booth feedback questions: a rounder, friendlier face. */
  --font-friendly: "Nunito Variable", "Nunito", "Inter Variable", "Segoe UI", system-ui, sans-serif;

  --color-sky: #0f2259;
  --color-sky-950: #081436;
  --color-sky-900: #0b1a47;
  --color-sky-800: #13286a;
  --color-sky-700: #193485;
  --color-sky-600: #20419a;
  --color-sky-500: #2f56c0;

  --color-nc-blue: #20419a;
  --color-nc-blue-soft: #9db4f2;
  --color-nc-green: #00a19c;
  --color-nc-green-soft: #3cd0c9;
  --color-nc-lime: #bfd730;
  --color-nc-yellow: #fdb924;
  --color-nc-purple: #763f98;
  --color-nc-purple-soft: #cfaeea;
  --color-nc-glow: #b07fd6;
  --color-nc-red: #d83b3e;
  --color-nc-red-soft: #ff9a9c;
  /* Text on light surfaces (registration card, selected toggles). */
  --color-nc-navy: #0b1638;

  /* Light admin surfaces */
  --color-surface: #f5f7fa;
  --color-text: #172033;
  --color-muted: #667085;
  --color-line: #d9e1ea;
  --color-error: #d83b3e;

  --animate-fade-in: fade-in 0.3s ease-out both;
  --animate-rise: rise 0.45s cubic-bezier(0.2, 0.8, 0.2, 1) both;
  --animate-pop: pop 0.4s cubic-bezier(0.2, 1.3, 0.4, 1) both;
  --animate-shake: shake 0.42s ease-in-out both;
  --animate-float-up: float-up 1.1s ease-out both;
  --animate-pulse-soft: pulse-soft 2.4s ease-in-out infinite;
  --animate-twinkle: twinkle 2.8s ease-in-out infinite;
  --animate-count: count 0.9s cubic-bezier(0.2, 0.8, 0.2, 1) both;
  --animate-tick: tick 1s ease-out infinite;
  --animate-marquee: marquee 80s linear infinite;

  @keyframes marquee {
    from { transform: translateX(0); }
    to { transform: translateX(-50%); }
  }

  @keyframes fade-in {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  @keyframes rise {
    from { opacity: 0; transform: translateY(14px); }
    to { opacity: 1; transform: none; }
  }
  @keyframes pop {
    0% { opacity: 0; transform: scale(0.8); }
    100% { opacity: 1; transform: scale(1); }
  }
  @keyframes shake {
    0%, 100% { transform: translateX(0); }
    20% { transform: translateX(-10px); }
    40% { transform: translateX(9px); }
    60% { transform: translateX(-6px); }
    80% { transform: translateX(3px); }
  }
  @keyframes float-up {
    0% { opacity: 0; transform: translateY(8px) scale(0.9); }
    20% { opacity: 1; transform: translateY(0) scale(1.08); }
    100% { opacity: 0; transform: translateY(-2.4rem) scale(1); }
  }
  @keyframes pulse-soft {
    0%, 100% { opacity: 0.55; }
    50% { opacity: 1; }
  }
  @keyframes twinkle {
    0%, 100% { opacity: 0.35; transform: scale(0.85); }
    50% { opacity: 1; transform: scale(1); }
  }
  @keyframes count {
    0% { opacity: 0; transform: scale(1.8); }
    40% { opacity: 1; transform: scale(1); }
    100% { opacity: 0; transform: scale(0.85); }
  }
  @keyframes tick {
    0% { transform: scale(1.06); }
    30% { transform: scale(1); }
  }
}

/* ── Base ─────────────────────────────────────────────────────────────────
   Kiosk screens are laid out on a 100rem × 60rem canvas: the root font scales with
   the viewport so 1920×1080 and 1280×800 both fit without scrolling. Phones (join page)
   use normal 16px type; tablets in portrait scroll.                          */
@layer base {
  html {
    font-size: clamp(10px, min(1vw, 1.6667vh), 40px);
    color-scheme: dark;
    -webkit-tap-highlight-color: transparent;
    -webkit-text-size-adjust: 100%;
  }
  @media (orientation: portrait) {
    html {
      font-size: clamp(10px, 1.9vw, 22px);
    }
  }
  html.route-phone {
    font-size: clamp(14px, 4.1vw, 18px);
  }
  @media (min-width: 700px) {
    html.route-phone {
      font-size: 17px;
    }
  }
  html.route-admin {
    font-size: 16px;
    color-scheme: light;
  }
  body {
    margin: 0;
    background: var(--color-sky);
    color: #fff;
    font-family: var(--font-sans);
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    overscroll-behavior: none;
  }
  html.route-admin body {
    background: var(--color-surface);
    color: var(--color-text);
  }
  /* Kiosk hardening: no selection, no double-tap zoom, no pull-to-refresh. */
  html.kiosk body {
    user-select: none;
    -webkit-user-select: none;
    -webkit-touch-callout: none;
    touch-action: manipulation;
    overflow: hidden;
  }
  @media (orientation: portrait) {
    html.kiosk body {
      overflow-y: auto;
    }
  }
  /* Phones playing the main game (#/): phone-sized type (like the join page) and normal scrolling,
     upright or sideways. The screens switch to stacked phone layouts with the `phone:` variant. */
  @media (max-width: 640px), (max-height: 520px) {
    html.kiosk {
      font-size: clamp(14px, 4.1vmin, 17px);
    }
    html.kiosk body {
      overflow-y: auto;
    }
  }
  html.route-phone body {
    user-select: none;
    -webkit-user-select: none;
    -webkit-touch-callout: none;
    touch-action: manipulation;
  }
  html.kiosk input,
  html.kiosk textarea,
  html.route-phone input,
  html.route-phone textarea {
    user-select: text;
    -webkit-user-select: text;
  }
  /* iOS zooms into any focused field under 16px. */
  @media (pointer: coarse) {
    input,
    textarea,
    select {
      font-size: max(16px, 1em);
    }
  }
  img,
  svg {
    -webkit-user-drag: none;
  }
  button:not(:disabled),
  [role="button"],
  label[for] {
    cursor: pointer;
  }
  :focus-visible {
    outline: 3px solid var(--color-nc-lime);
    outline-offset: 3px;
  }
  ::selection {
    background: rgb(191 215 48 / 0.4);
  }
}

/* Touch targets are never smaller than 56px. */
@utility tap {
  min-height: max(56px, 3.5rem);
}
@utility tap-w {
  min-width: max(56px, 3.5rem);
}

@layer components {
  .panel {
    background: linear-gradient(180deg, rgb(255 255 255 / 0.07), rgb(255 255 255 / 0.02)), rgb(19 40 106 / 0.86);
    border: 1px solid rgb(157 180 242 / 0.24);
    border-radius: 1.25rem;
    box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.05), 0 1.2rem 3rem -1.5rem rgb(0 0 0 / 0.65);
    backdrop-filter: blur(6px);
  }
  /* Title highlight: white → Soft Green → Green. */
  .text-gradient {
    background: linear-gradient(100deg, #ffffff 0%, var(--color-nc-lime) 45%, var(--color-nc-green) 100%);
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
  }
  .live-dot {
    display: inline-block;
    width: 0.6rem;
    height: 0.6rem;
    flex-shrink: 0;
    border-radius: 9999px;
    background: var(--color-nc-lime);
    animation: live-dot-pulse 1.6s ease-out infinite;
  }
  .label {
    font-size: 0.85rem;
    font-weight: 700;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: var(--color-nc-blue-soft);
  }

  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.6em;
    min-height: max(56px, 3.5rem);
    padding: 0 1.6rem;
    border-radius: 0.95rem;
    border: 1.5px solid transparent;
    font-size: 1.15rem;
    font-weight: 700;
    line-height: 1.15;
    transition: transform 0.12s ease, background-color 0.2s ease, border-color 0.2s ease, opacity 0.2s ease, box-shadow 0.2s ease;
  }
  .btn:active:not(:disabled) {
    transform: scale(0.97);
  }
  .btn:disabled,
  .btn[aria-disabled="true"] {
    opacity: 0.45;
    cursor: not-allowed;
    box-shadow: none;
  }
  .btn[aria-disabled="true"]:active {
    transform: none;
  }
  /* Soft Green = the active / main action; dark text. */
  .btn-go {
    background: var(--color-nc-lime);
    color: var(--color-sky);
    font-weight: 800;
    box-shadow: 0 0.8rem 2rem -0.8rem rgb(191 215 48 / 0.75);
  }
  .btn-go:hover:not(:disabled) {
    background: #cce445;
  }
  /* Green = confirm / done. */
  .btn-green {
    background: var(--color-nc-green);
    color: #fff;
    font-weight: 800;
    box-shadow: 0 0.8rem 2rem -0.8rem rgb(0 161 156 / 0.75);
  }
  .btn-green:hover:not(:disabled):not([aria-disabled="true"]) {
    background: #008e8a;
  }
  /* Purple = multiplayer. */
  .btn-purple {
    background: var(--color-nc-purple);
    color: #fff;
    font-weight: 800;
    box-shadow: 0 0.8rem 2rem -0.8rem rgb(118 63 152 / 0.8);
  }
  .btn-purple:hover:not(:disabled) {
    background: #8a4db0;
  }
  .btn-yellow {
    background: var(--color-nc-yellow);
    color: var(--color-sky);
    font-weight: 800;
  }
  .btn-blue {
    background: var(--color-nc-blue);
    color: #fff;
    border-color: rgb(157 180 242 / 0.45);
  }
  .btn-blue:hover:not(:disabled) {
    background: #284fb5;
  }
  .btn-ghost {
    background: rgb(255 255 255 / 0.05);
    color: #fff;
    border-color: rgb(157 180 242 / 0.32);
  }
  .btn-ghost:hover:not(:disabled) {
    background: rgb(255 255 255 / 0.1);
  }
  .btn-xl {
    min-height: max(64px, 4.6rem);
    padding: 0 2.6rem;
    font-size: 1.65rem;
    border-radius: 1.2rem;
  }
  /* Light (admin) surfaces */
  .btn-light {
    background: #fff;
    color: var(--color-text);
    border-color: var(--color-line);
  }
  .btn-light:hover:not(:disabled) {
    background: var(--color-surface);
  }
  .btn-admin {
    background: var(--color-nc-blue);
    color: #fff;
  }
  .btn-admin:hover:not(:disabled) {
    background: #284fb5;
  }
  .btn-danger {
    background: #fff;
    color: var(--color-nc-red);
    border-color: rgb(216 59 62 / 0.45);
  }
  .btn-danger:hover:not(:disabled) {
    background: rgb(216 59 62 / 0.06);
  }
  .card {
    background: #fff;
    border: 1px solid var(--color-line);
    border-radius: 1rem;
    box-shadow: 0 1px 2px rgb(16 24 40 / 0.05);
  }

  .field {
    width: 100%;
    min-height: max(56px, 4rem);
    padding: 0 1.25rem;
    border-radius: 0.95rem;
    border: 2px solid rgb(157 180 242 / 0.35);
    background: rgb(8 20 54 / 0.72);
    color: #fff;
    font-size: 1.45rem;
    font-weight: 600;
    outline: none;
    transition: border-color 0.15s, box-shadow 0.15s;
  }
  .field::placeholder {
    color: rgb(255 255 255 / 0.36);
    font-weight: 500;
  }
  .field:focus {
    border-color: var(--color-nc-lime);
    box-shadow: 0 0 0 0.3rem rgb(191 215 48 / 0.18);
  }
  .field[aria-invalid="true"] {
    border-color: var(--color-nc-red-soft);
  }
  /* Registration form: a white card with dark navy text, light borders and a Soft Green focus.
     Sizes use max(px, rem) so the form stays readable on a small landscape tablet as well as at 1920×1080. */
  .reg-card {
    background: #fff;
    color: var(--color-nc-navy);
    border-radius: 1.5rem;
    box-shadow: 0 1.6rem 3.5rem -1.4rem rgb(0 0 0 / 0.65);
    color-scheme: light;
  }
  .reg-card :focus-visible {
    outline-color: var(--color-nc-blue);
  }
  .reg-label {
    display: block;
    margin-bottom: 0.45rem;
    font-size: max(15px, 1.05rem);
    font-weight: 700;
    color: var(--color-nc-navy);
  }
  .reg-field {
    width: 100%;
    min-height: max(56px, 4rem);
    padding: 0 1.1rem;
    border-radius: 0.9rem;
    border: 2px solid var(--color-line);
    background: #fff;
    color: var(--color-nc-navy);
    font-size: max(17px, 1.35rem);
    font-weight: 600;
    outline: none;
    transition: border-color 0.15s, box-shadow 0.15s;
  }
  .reg-field::placeholder {
    color: var(--color-muted);
    font-weight: 500;
  }
  .reg-field[aria-invalid="true"] {
    border-color: var(--color-nc-red);
  }
  .reg-field:focus,
  .reg-field[aria-expanded="true"] {
    border-color: var(--color-nc-lime);
    box-shadow: 0 0 0 0.25rem rgb(191 215 48 / 0.35);
  }
  /* Project / Business single-select toggles (nothing selected at first). */
  .reg-toggle {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.6em;
    min-height: max(56px, 4.2rem);
    padding: 0 1rem;
    border-radius: 0.95rem;
    border: 2px solid var(--color-line);
    background: #fff;
    color: var(--color-nc-navy);
    font-size: max(18px, 1.45rem);
    font-weight: 800;
    transition: background-color 0.15s, border-color 0.15s, transform 0.12s;
  }
  .reg-toggle:active {
    transform: scale(0.98);
  }
  .reg-toggle[aria-checked="true"] {
    background: var(--color-nc-lime);
    border-color: var(--color-nc-lime);
    color: var(--color-nc-navy);
  }
  .reg-toggle[aria-invalid="true"]:not([aria-checked="true"]) {
    border-color: var(--color-nc-red);
  }
  .reg-error {
    display: flex;
    align-items: flex-start;
    gap: 0.4em;
    min-height: 1.45em;
    margin-top: 0.4rem;
    font-size: max(14px, 1rem);
    font-weight: 600;
    line-height: 1.3;
    color: var(--color-nc-red);
  }
  /* OPU bottom sheet options */
  .reg-option {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    width: 100%;
    min-height: max(56px, 4rem);
    padding: 0.5rem 1.1rem;
    border-radius: 0.9rem;
    border: 2px solid var(--color-line);
    background: #fff;
    color: var(--color-nc-navy);
    text-align: left;
    font-size: max(17px, 1.3rem);
    font-weight: 700;
    line-height: 1.2;
    transition: background-color 0.15s, border-color 0.15s;
  }
  .reg-option:hover {
    border-color: var(--color-nc-lime);
  }
  .reg-option[aria-selected="true"] {
    background: var(--color-nc-lime);
    border-color: var(--color-nc-lime);
  }

  /* Booth feedback (between the game and the result card): light surface, one-tap answers.
     Selected = Soft Green with dark navy text and a ✓; unselected = white with a light border. */
  .fb-page {
    background: var(--color-surface);
    color: var(--color-text);
    font-family: var(--font-friendly);
    color-scheme: light;
  }
  .fb-page :focus-visible {
    outline-color: var(--color-nc-blue);
  }
  .fb-title {
    color: var(--color-nc-blue);
    font-weight: 900;
    line-height: 1.2;
  }
  .fb-question {
    color: var(--color-text);
    font-weight: 800;
    line-height: 1.3;
  }
  .fb-num {
    display: inline-grid;
    place-items: center;
    width: 1.55em;
    height: 1.55em;
    margin-right: 0.35em;
    border-radius: 9999px;
    background: var(--color-nc-blue);
    color: #fff;
    font-size: 0.85em;
    font-weight: 900;
    vertical-align: 0.1em;
  }
  .fb-choice {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5em;
    min-height: max(56px, 3.6rem);
    border-radius: 1rem;
    border: 2px solid var(--color-line);
    background: #fff;
    color: var(--color-nc-navy);
    font-size: max(17px, 1.15rem);
    font-weight: 800;
    transition: background-color 0.15s, border-color 0.15s, transform 0.12s;
  }
  .fb-choice:active {
    transform: scale(0.97);
  }
  .fb-choice[aria-checked="true"],
  .fb-chip[aria-checked="true"] {
    background: var(--color-nc-lime);
    border-color: var(--color-nc-lime);
    color: var(--color-nc-navy);
  }
  .fb-chip {
    display: inline-flex;
    align-items: center;
    gap: 0.35em;
    min-height: max(44px, 2.9rem);
    padding: 0.35rem 0.95rem;
    border-radius: 9999px;
    border: 2px solid var(--color-line);
    background: #fff;
    color: var(--color-nc-navy);
    font-size: max(14px, 0.95rem);
    font-weight: 700;
    line-height: 1.15;
    text-align: left;
    transition: background-color 0.15s, border-color 0.15s, transform 0.12s;
  }
  .fb-chip:active {
    transform: scale(0.97);
  }
  .fb-star {
    display: grid;
    place-items: center;
    width: max(48px, 3.3rem);
    height: max(48px, 3.3rem);
    border-radius: 0.9rem;
    color: #98a2b3;
  }
  .fb-star svg {
    width: 82%;
    height: 82%;
    fill: transparent;
    stroke-width: 1.8;
    transition: fill 0.15s, color 0.15s;
  }
  .fb-star[data-on="true"] {
    color: var(--color-nc-yellow);
  }
  .fb-star[data-on="true"] svg {
    fill: var(--color-nc-yellow);
  }
  .fb-star[data-pop="true"] svg {
    animation: fb-pop 0.38s cubic-bezier(0.2, 1.4, 0.4, 1);
  }
  .fb-submit {
    display: flex;
    width: 100%;
    align-items: center;
    justify-content: center;
    gap: 0.55em;
    min-height: max(56px, 3.8rem);
    border-radius: 1rem;
    background: var(--color-line);
    color: var(--color-muted);
    font-size: max(18px, 1.25rem);
    font-weight: 900;
    transition: background-color 0.2s, color 0.2s, transform 0.12s;
  }
  .fb-submit[data-ready="true"] {
    background: var(--color-nc-green);
    color: #fff;
    animation: fb-pulse 2.2s ease-in-out infinite;
  }
  .fb-submit[data-ready="true"]:active:not([aria-busy="true"]) {
    transform: scale(0.98);
  }
  .fb-submit[aria-busy="true"] {
    animation: none;
    cursor: progress;
  }
  .fb-spinner {
    width: 1.1em;
    height: 1.1em;
    border-radius: 9999px;
    border: 3px solid rgb(255 255 255 / 0.4);
    border-top-color: #fff;
    animation: fb-spin 0.8s linear infinite;
  }

  /* Admin form fields */
  .afield {
    width: 100%;
    border-radius: 0.6rem;
    border: 1px solid var(--color-line);
    background: #fff;
    padding: 0.55rem 0.75rem;
    color: var(--color-text);
    outline: none;
  }
  .afield:focus {
    border-color: var(--color-nc-blue);
    box-shadow: 0 0 0 3px rgb(32 65 154 / 0.15);
  }

  /* Word / letter tiles */
  .tile {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.5em;
    min-height: max(56px, 4.6rem);
    padding: 0 1.2em;
    border-radius: 1rem;
    border: 2px solid rgb(157 180 242 / 0.45);
    background: linear-gradient(180deg, #2a4fb5, #20419a);
    color: #fff;
    font-family: var(--font-display);
    font-weight: 700;
    font-size: 1.7rem;
    letter-spacing: 0.01em;
    box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.12), 0 0.5rem 1.2rem -0.6rem rgb(0 0 0 / 0.6);
    transition: transform 0.1s ease, background 0.15s ease, border-color 0.15s ease, opacity 0.2s ease;
    touch-action: manipulation;
  }
  .tile:active:not(:disabled) {
    transform: scale(0.96);
  }
  .tile-letter {
    min-width: max(56px, 4.6rem);
    padding: 0;
    font-size: 2.1rem;
  }
  .tile-wrong {
    background: var(--color-nc-red);
    border-color: #ff8a8c;
  }
  .tile-used {
    opacity: 0.22;
  }
}

@keyframes splash-fill {
  from { transform: scaleX(0); }
  to { transform: scaleX(1); }
}

@keyframes live-dot-pulse {
  0% { box-shadow: 0 0 0 0 rgb(191 215 48 / 0.6); }
  100% { box-shadow: 0 0 0 0.6rem rgb(191 215 48 / 0); }
}

/* Feedback: star "pop", the gentle pulse of the ready button, the sending spinner. */
@keyframes fb-pop {
  0% { transform: scale(0.7); }
  60% { transform: scale(1.25); }
  100% { transform: scale(1); }
}
@keyframes fb-pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgb(0 161 156 / 0.45); }
  50% { box-shadow: 0 0 0 0.55rem rgb(0 161 156 / 0); }
}
@keyframes fb-spin {
  to { transform: rotate(360deg); }
}

/* Faint grid behind the home page (the PMX "command centre" look). */
.grid-lines {
  background-image:
    linear-gradient(rgb(157 180 242 / 0.06) 1px, transparent 1px),
    linear-gradient(90deg, rgb(157 180 242 / 0.06) 1px, transparent 1px);
  background-size: 4rem 4rem;
  mask-image: radial-gradient(ellipse 80% 70% at 50% 25%, #000 25%, transparent 80%);
  -webkit-mask-image: radial-gradient(ellipse 80% 70% at 50% 25%, #000 25%, transparent 80%);
}

/* Admin on a touch screen: the compact admin buttons still get a thumb-sized height.
   (Unlayered on purpose, so it wins over the min-h-0 utility those buttons carry.) */
@media (pointer: coarse) {
  html.route-admin .btn {
    min-height: 44px;
  }
}

@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.001ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.001ms !important;
  }
}
```

## Appendix B – Project files

Dependencies, build set-up, hosting Blueprint, HTML shell, favicon, start-up (kiosk guards) and the router.

### `package.json`

```json
{
  "name": "nerv-centre-word-rush",
  "version": "1.0.0",
  "private": true,
  "description": "PMX Digital Challenge – Word Rush: touchscreen and multiplayer word-race booth game with live leaderboards and admin dashboard.",
  "type": "module",
  "engines": {
    "node": ">=20.19"
  },
  "scripts": {
    "dev": "concurrently -k -n api,web -c cyan,magenta \"tsx watch --clear-screen=false server/index.ts\" \"vite\"",
    "build": "tsc --noEmit && vite build",
    "start": "tsx server/index.ts",
    "typecheck": "tsc --noEmit",
    "test": "tsx --test --test-timeout=60000 tests/unit/*.test.ts tests/integration/*.test.ts",
    "e2e": "tsx tests/e2e/run.ts",
    "e2e:mobile": "tsx tests/e2e/mobile.ts",
    "db:reset": "tsx server/db/reset.ts"
  },
  "dependencies": {
    "@electric-sql/pglite": "^0.5.8",
    "@fastify/static": "^10.1.5",
    "@fontsource-variable/inter": "^5.3.0",
    "@fontsource-variable/nunito": "^5.3.0",
    "@fontsource-variable/space-grotesk": "^5.3.0",
    "fastify": "^5.12.5",
    "framer-motion": "^13.5.0",
    "lucide-react": "^1.49.0",
    "pg": "^8.23.1",
    "qrcode": "^1.5.4",
    "react": "^19.3.0",
    "react-dom": "^19.3.0",
    "socket.io": "^4.8.4",
    "socket.io-client": "^4.8.4",
    "tsx": "^4.23.15",
    "zod": "^4.6.5"
  },
  "devDependencies": {
    "@tailwindcss/vite": "^4.3.3",
    "@types/node": "^24.0.0",
    "@types/pg": "^8.11.0",
    "@types/qrcode": "^1.5.5",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@vitejs/plugin-react": "^6.1.1",
    "concurrently": "^10.0.5",
    "puppeteer-core": "^25.12.0",
    "tailwindcss": "^4.3.3",
    "typescript": "~5.9.3",
    "vite": "^8.3.2"
  }
}
```

### `tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2023", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "isolatedModules": true,
    "resolveJsonModule": true,
    "skipLibCheck": true,
    "noEmit": true,
    "types": ["node", "vite/client"],
    "paths": {
      "@shared/*": ["./shared/*"]
    }
  },
  "include": ["client/src", "server", "shared", "tests", "vite.config.ts"]
}
```

### `vite.config.ts`

```ts
import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const here = (p: string) => fileURLToPath(new URL(p, import.meta.url))
const API = `http://localhost:${process.env.PORT ?? 8090}`

export default defineConfig({
  root: here('./client'),
  base: '/',
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@shared': here('./shared') } },
  server: {
    port: 5174,
    host: true,
    proxy: {
      '/api': API,
      '/socket.io': { target: API, ws: true },
    },
  },
  build: {
    outDir: here('./dist/client'),
    emptyOutDir: true,
    target: 'es2022',
    chunkSizeWarningLimit: 1500,
  },
})
```

### `render.yaml`

```yaml
# Render Blueprint (https://render.com/docs/blueprint-spec) – Render → New → Blueprint → pick this repository.
# One web service runs everything: the pages, the API and the live game server (Socket.IO, server-side timing).
# All data (players, games, leaderboards, feedback) is kept in PostgreSQL through DATABASE_URL.
services:
  - type: web
    name: pmx-digital-solutions-games
    runtime: node
    region: singapore
    # "free" sleeps after 15 minutes without visitors (the next visit then waits about a minute).
    # Switch to "starter" (or higher) in the Render dashboard for event days.
    plan: free
    # Keep a single instance: live races are held in this server's memory.
    numInstances: 1
    buildCommand: npm ci --include=dev && npm run build
    startCommand: npm start
    healthCheckPath: /api/health
    autoDeploy: true
    envVars:
      - key: NODE_VERSION
        value: "24"
      - key: LOG_LEVEL
        value: warn
      # PostgreSQL connection string, e.g. from Neon (region: Singapore):
      #   postgresql://user:password@ep-xxxx-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require
      # Required – the server will not start without it (Render's disk is wiped on every deploy).
      - key: DATABASE_URL
        sync: false
      # Your own 6–12 digit first-login Admin PIN (not 1234). You choose a new PIN right after the first sign-in.
      - key: ADMIN_DEFAULT_PIN
        sync: false
```

### `client/index.html`

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
    <meta name="theme-color" content="#20419A" />
    <meta name="description" content="PMX Digital Challenge – Word Rush: build the names of our 6 digital solutions in 30 seconds." />
    <meta name="format-detection" content="telephone=no" />
    <meta name="mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
    <link rel="icon" type="image/svg+xml" href="/icon.svg" />
    <title>PMX Digital Challenge – Word Rush</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

### `client/public/icon.svg`

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#BFD730"/>
      <stop offset="1" stop-color="#00A19C"/>
    </linearGradient>
  </defs>
  <rect width="48" height="48" rx="10" fill="#20419A"/>
  <path d="M24 6 39.6 15v18L24 42 8.4 33V15Z" fill="none" stroke="url(#g)" stroke-width="3" stroke-linejoin="round"/>
  <path d="m17 17 14 14M31 17 17 31" stroke="url(#g)" stroke-width="3.4" stroke-linecap="round"/>
  <circle cx="24" cy="24" r="3" fill="#fff"/>
</svg>
```

### `client/src/main.tsx`

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/inter'
import '@fontsource-variable/nunito'
import '@fontsource-variable/space-grotesk'
import './styles.css'
import { App } from './App'
import { startData } from './lib/data'
import { startFeedbackSync } from './lib/feedback'
import { startSocket } from './lib/socket'
import { sfx } from './lib/sound'

/**
 * Kiosk hardening for touchscreens: no context menu / long-press menu, no pinch or ctrl-wheel
 * zoom, no image dragging, and links never open other sites on the kiosk.
 * (Pull-to-refresh, double-tap zoom and text selection are disabled in CSS.)
 */
function installKioskGuards() {
  const locked = () => document.documentElement.classList.contains('kiosk') || document.documentElement.classList.contains('route-phone')
  window.addEventListener('contextmenu', (e) => {
    const t = e.target instanceof Element ? e.target : null
    if (locked() && !t?.closest('input, textarea')) e.preventDefault()
  })
  document.addEventListener('gesturestart', (e) => locked() && e.preventDefault())
  window.addEventListener('wheel', (e) => locked() && e.ctrlKey && e.preventDefault(), { passive: false })
  window.addEventListener('keydown', (e) => {
    if (locked() && (e.ctrlKey || e.metaKey) && ['+', '=', '-', '0'].includes(e.key)) e.preventDefault()
  })
  window.addEventListener('dragstart', (e) => locked() && e.target instanceof HTMLImageElement && e.preventDefault())
  document.addEventListener(
    'click',
    (e) => {
      const a = e.target instanceof Element ? e.target.closest('a[href]') : null
      if (locked() && a && /^https?:/i.test(a.getAttribute('href') ?? '') && new URL(a.getAttribute('href')!, location.href).origin !== location.origin) {
        e.preventDefault()
      }
    },
    true,
  )
  window.addEventListener('pointerdown', () => sfx.unlock(), { once: true })
}

installKioskGuards()
startSocket()
startData()
// Feedback answered while offline is sent as soon as the connection is back.
startFeedbackSync()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

### `client/src/App.tsx`

```tsx
import { lazy, Suspense, useEffect } from 'react'
import { Starfield } from './components/Starfield'
import { ConnectionBanner, RehearsalBadge } from './components/ui'
import { DisplayApp } from './display/DisplayApp'
import { KioskApp } from './kiosk/KioskApp'
import { configStore } from './lib/data'
import { useRoute } from './lib/hooks'
import { useStore } from './lib/store'
import { PlayerApp } from './player/PlayerApp'

const AdminApp = lazy(() => import('./admin/AdminApp'))

const openAdmin = () => {
  location.hash = '#/admin'
}

/** Routes: #/ kiosk · #/join/1234 phones · #/display TV · #/admin staff (PIN). */
export function App() {
  const route = useRoute()
  const config = useStore(configStore)

  useEffect(() => {
    const html = document.documentElement
    html.classList.toggle('kiosk', route.name === 'kiosk' || route.name === 'display')
    html.classList.toggle('route-phone', route.name === 'join')
    html.classList.toggle('route-admin', route.name === 'admin')
  }, [route.name])

  // Ctrl + Shift + A opens Admin from anywhere.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && (e.key === 'A' || e.key === 'a')) {
        e.preventDefault()
        openAdmin()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  if (route.name === 'admin') {
    return (
      <Suspense fallback={<div className="p-10 text-center text-muted">Loading admin…</div>}>
        <AdminApp />
      </Suspense>
    )
  }
  return (
    <>
      <Starfield density={route.name === 'join' ? 0.6 : 1} />
      <ConnectionBanner />
      {route.name !== 'display' && <RehearsalBadge on={config?.settings.rehearsal_mode} />}
      {route.name === 'join' ? <PlayerApp key={route.code} code={route.code} /> : route.name === 'display' ? <DisplayApp /> : <KioskApp onAdmin={openAdmin} />}
    </>
  )
}
```

## Appendix C – Brand components

PMX mark (SVG), the PMX header brand with the 2.5 s long-press, and the PETRONAS + NERVCENTRE logo pill.

### `client/src/components/Brand.tsx`

```tsx
import { useId } from 'react'
import nervcentreLogo from '../assets/nervcentre-logo.png'
import petronasLogo from '../assets/petronas-logo.png'
import { useLongPress } from '../lib/hooks'

/** PMX mark (hexagon + connected nodes) in the brand Soft Green → Green. */
export function BrandMark({ className = '' }: { className?: string }) {
  const id = `bm${useId().replace(/[^a-zA-Z0-9]/g, '')}`
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#BFD730" />
          <stop offset="1" stopColor="#00A19C" />
        </linearGradient>
      </defs>
      <path d="M24 3.5 41.8 13.75v20.5L24 44.5 6.2 34.25v-20.5Z" fill="rgb(32 65 154 / 0.55)" stroke={`url(#${id})`} strokeWidth="2.5" strokeLinejoin="round" />
      <path d="m16.5 16.5 15 15M31.5 16.5l-15 15" stroke={`url(#${id})`} strokeWidth="3.2" strokeLinecap="round" />
      <circle cx="24" cy="24" r="3.2" fill="#fff" />
      <circle cx="16.5" cy="16.5" r="2" fill="#BFD730" />
      <circle cx="31.5" cy="16.5" r="2" fill="#BFD730" />
      <circle cx="16.5" cy="31.5" r="2" fill="#00A19C" />
      <circle cx="31.5" cy="31.5" r="2" fill="#00A19C" />
    </svg>
  )
}

/** "PMX · Digital Project Management" – a 2.5 s press opens Admin (staff shortcut). */
export function PmxBrand({ onAdmin, compact = false }: { onAdmin?: () => void; compact?: boolean }) {
  const hold = useLongPress(() => onAdmin?.(), 2500)
  return (
    <div className="flex min-w-0 select-none items-center gap-3" {...(onAdmin ? hold : {})} data-testid="pmx-brand">
      <BrandMark className={`${compact ? 'size-10' : 'size-[3rem]'} shrink-0 drop-shadow-[0_0_14px_rgba(191,215,48,0.35)]`} />
      <div className="min-w-0 leading-tight">
        <div className={`font-display font-bold tracking-[0.12em] ${compact ? 'text-lg' : 'text-[1.45rem]'}`}>PMX</div>
        {/* On a narrow portrait tablet the subline gives way so the page title next to it stays readable. */}
        <div className={`truncate font-semibold uppercase text-nc-lime/80 ${compact ? 'text-[max(11px,0.58rem)] tracking-[0.06em]' : 'text-[max(11px,0.72rem)] tracking-[0.2em] portrait:max-[900px]:hidden phone:hidden'}`}>Digital Project Management</div>
      </div>
    </div>
  )
}

const SIZES = {
  sm: 'text-[0.82rem]',
  md: 'text-[1.15rem]',
  lg: 'text-[clamp(1.35rem,2.6vh+0.9vw,2.5rem)]',
}

/**
 * PETRONAS + NERVCENTRE logo strip. PETRONAS (dark lettering) sits on a white panel and NERVCENTRE
 * (the version for dark backgrounds) on a brand-blue panel, joined by a diagonal split. Sized in em.
 */
export function PartnerLogos({ size = 'md', className = '' }: { size?: keyof typeof SIZES; className?: string }) {
  return (
    <div
      className={`flex h-[2.6em] select-none items-stretch overflow-hidden rounded-full bg-[linear-gradient(135deg,#20419A_0%,#13286a_100%)] shadow-[0_0.7em_1.8em_-0.6em_rgb(0_0_0/0.6),0_0_0_1px_rgb(255_255_255/0.25)] ${SIZES[size]} ${className}`}
      data-testid="partner-logos"
    >
      <div className="flex items-center bg-white pl-[1.2em] pr-[1.65em] [clip-path:polygon(0_0,100%_0,calc(100%_-_0.85em)_100%,0_100%)]">
        <img src={petronasLogo} alt="PETRONAS" draggable={false} className="h-[1.6em] w-auto" />
      </div>
      <div className="flex items-center pl-[0.7em] pr-[1.25em]">
        <img src={nervcentreLogo} alt="NERVCENTRE" draggable={false} className="h-[1.32em] w-auto" />
      </div>
    </div>
  )
}
```

## Appendix D – Constellation

The six-star "N" constellation with its exact coordinates, glow, lines and logo reveal.

### `client/src/components/Constellation.tsx`

```tsx
import { useId } from 'react'
import { motion } from 'framer-motion'
import ncLogo from '../assets/nc-logo.png'
import ncMark from '../assets/nc-mark.png'

/**
 * The NervCentre constellation: six stars that trace the "N" of the NERVCENTRE logo
 * (coordinates are pixels of the original logo, 2058 × 553). Each solved solution lights the next
 * star; when all six are lit the constellation glows and the logo appears under it.
 */
export const STAR_POINTS: [number, number][] = [
  [95, 470],
  [330, 150],
  [365, 480],
  [497, 318],
  [600, 150],
  [690, 95],
]
export const STAR_COUNT = STAR_POINTS.length

interface Props {
  /** Stars lit (0–6), in path order. */
  lit: number
  /** Logo under the stars: none, the N mark only, or the full logo with the wordmark. */
  logo?: 'none' | 'mark' | 'full'
  /** Light the stars one after another (reveal animation). */
  sequence?: boolean
  /** Pulse the next star to light. */
  showNext?: boolean
  className?: string
  title?: string
}

export function Constellation({ lit, logo = 'none', sequence = false, showNext = false, className = '', title }: Props) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '')
  const complete = lit >= STAR_COUNT
  const stepS = 0.32
  const delay = (i: number) => (sequence ? 0.25 + i * stepS : 0)
  const logoDelay = sequence ? 0.35 + STAR_COUNT * stepS : 0
  const full = logo === 'full'
  const viewBox = full ? '0 0 2058 553' : '20 20 760 540'
  const label = title ?? `${Math.min(lit, STAR_COUNT)} of ${STAR_COUNT} stars lit`

  return (
    <svg viewBox={viewBox} className={className} role="img" aria-label={label}>
      <defs>
        <radialGradient id={`g${uid}`}>
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.95" />
          <stop offset="0.25" stopColor="#cfaeea" stopOpacity="0.7" />
          <stop offset="0.6" stopColor="#763f98" stopOpacity="0.35" />
          <stop offset="1" stopColor="#763f98" stopOpacity="0" />
        </radialGradient>
        <filter id={`f${uid}`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="6" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {logo !== 'none' && (
        <motion.image
          href={full ? ncLogo : ncMark}
          x={0}
          y={0}
          width={full ? 2058 : 780}
          height={553}
          initial={{ opacity: complete ? 0 : 0.1 }}
          animate={{ opacity: complete ? 1 : 0.1 }}
          transition={{ delay: complete ? logoDelay : 0, duration: 0.9 }}
        />
      )}

      {/* Paths: faint guide lines, then the lit ones drawn in. */}
      <g>
        {STAR_POINTS.slice(0, -1).map(([x1, y1], i) => {
          const [x2, y2] = STAR_POINTS[i + 1]
          const on = i + 1 < lit
          return (
            <g key={i}>
              <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#9db4f2" strokeOpacity={complete && logo !== 'none' ? 0 : 0.22} strokeWidth={3} strokeDasharray="6 12" />
              {on && (
                <motion.line
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke={complete ? '#ffffff' : '#cfaeea'}
                  strokeWidth={complete ? 6 : 5}
                  strokeLinecap="round"
                  filter={`url(#f${uid})`}
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: complete && logo !== 'none' ? 0.55 : 0.9 }}
                  transition={{ delay: delay(i + 1), duration: 0.35 }}
                />
              )}
            </g>
          )
        })}
      </g>

      {STAR_POINTS.map(([x, y], i) => {
        const on = i < lit
        const isNext = showNext && i === lit
        const tab = i === STAR_COUNT - 1
        return (
          <g key={i}>
            {on && (
              <motion.circle
                cx={x}
                cy={y}
                r={complete ? 62 : 48}
                fill={`url(#g${uid})`}
                initial={{ opacity: 0, scale: 0.3 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: delay(i), duration: 0.45 }}
                style={{ transformOrigin: `${x}px ${y}px` }}
              />
            )}
            {isNext && (
              <circle cx={x} cy={y} r={26} fill="none" stroke="#bfd730" strokeWidth={3} className="animate-pulse-soft" />
            )}
            {on ? (
              <motion.g initial={{ opacity: 0, scale: 0 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: delay(i), type: 'spring', stiffness: 260, damping: 16 }} style={{ transformOrigin: `${x}px ${y}px` }}>
                <path d={`M${x} ${y - 30} L${x + 5} ${y - 5} L${x + 30} ${y} L${x + 5} ${y + 5} L${x} ${y + 30} L${x - 5} ${y + 5} L${x - 30} ${y} L${x - 5} ${y - 5} Z`} fill="#ffffff" opacity={0.85} />
                <circle cx={x} cy={y} r={12} fill={tab ? '#3cd0c9' : '#ffffff'} stroke="#ffffff" strokeWidth={tab ? 4 : 0} />
              </motion.g>
            ) : (
              <circle cx={x} cy={y} r={9} fill="#9db4f2" fillOpacity={0.4} stroke="#9db4f2" strokeOpacity={0.6} strokeWidth={2} />
            )}
          </g>
        )
      })}
    </svg>
  )
}
```

## Appendix E – Night-sky background

Gradients, grid and the twinkling / drifting / shooting-star canvas.

### `client/src/components/Starfield.tsx`

```tsx
import { useEffect, useRef } from 'react'

interface Star {
  x: number
  y: number
  r: number
  phase: number
  speed: number
  tint: string
}

/**
 * Animated night sky: twinkling stars drifting slowly, an occasional shooting star, and soft
 * blue / purple nebula glows. Runs at ~30 fps, pauses in background tabs, still for reduced motion.
 */
export function Starfield({ density = 1 }: { density?: number }) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
    let stars: Star[] = []
    let w = 0
    let h = 0
    let dpr = 1
    const tints = ['255,255,255', '255,255,255', '207,222,255', '207,174,234', '191,215,48']

    const resize = () => {
      dpr = Math.min(2, window.devicePixelRatio || 1)
      w = canvas.clientWidth
      h = canvas.clientHeight
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      const count = Math.round(((w * h) / 5200) * density)
      stars = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        r: Math.random() < 0.08 ? 1.2 + Math.random() * 1.1 : 0.35 + Math.random() * 0.8,
        phase: Math.random() * Math.PI * 2,
        speed: 0.4 + Math.random() * 1.4,
        tint: tints[Math.floor(Math.random() * tints.length)],
      }))
    }
    resize()
    window.addEventListener('resize', resize)

    let shooting: { x: number; y: number; vx: number; vy: number; life: number } | null = null
    let raf = 0
    let last = 0
    const draw = (t: number) => {
      raf = requestAnimationFrame(draw)
      if (document.hidden || t - last < 33) return
      last = t
      ctx.clearRect(0, 0, w, h)
      const time = t / 1000
      for (const s of stars) {
        if (!reduced) {
          s.x -= 0.02 * s.speed
          if (s.x < -2) s.x = w + 2
        }
        const a = reduced ? 0.7 : 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(time * s.speed + s.phase))
        ctx.beginPath()
        ctx.fillStyle = `rgba(${s.tint},${a.toFixed(3)})`
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2)
        ctx.fill()
        if (s.r > 1.3) {
          ctx.fillStyle = `rgba(${s.tint},${(a * 0.18).toFixed(3)})`
          ctx.beginPath()
          ctx.arc(s.x, s.y, s.r * 3.2, 0, Math.PI * 2)
          ctx.fill()
        }
      }
      if (!reduced) {
        if (!shooting && Math.random() < 0.004) {
          shooting = { x: Math.random() * w * 0.8 + w * 0.2, y: Math.random() * h * 0.4, vx: -9 - Math.random() * 5, vy: 3 + Math.random() * 2, life: 1 }
        }
        if (shooting) {
          const s = shooting
          const grad = ctx.createLinearGradient(s.x, s.y, s.x - s.vx * 9, s.y - s.vy * 9)
          grad.addColorStop(0, `rgba(255,255,255,${s.life})`)
          grad.addColorStop(1, 'rgba(255,255,255,0)')
          ctx.strokeStyle = grad
          ctx.lineWidth = 1.6
          ctx.beginPath()
          ctx.moveTo(s.x, s.y)
          ctx.lineTo(s.x - s.vx * 9, s.y - s.vy * 9)
          ctx.stroke()
          s.x += s.vx
          s.y += s.vy
          s.life -= 0.025
          if (s.life <= 0 || s.x < -100 || s.y > h + 100) shooting = null
        }
      }
    }
    raf = requestAnimationFrame(draw)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
    }
  }, [density])

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-0 overflow-hidden">
      {/* Brand Blue sky: #20419A at the top fading to a deep Blue, with a Purple glow (multiplayer) and a hint of Green. */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_120%_80%_at_30%_-10%,#20419a_0%,#13286a_45%,#0b1a47_100%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_55%_45%_at_88%_88%,rgb(118_63_152/0.42),transparent_70%),radial-gradient(ellipse_40%_35%_at_5%_80%,rgb(0_161_156/0.16),transparent_70%)]" />
      <div className="grid-lines absolute inset-0" />
      <canvas ref={ref} className="absolute inset-0 size-full" />
    </div>
  )
}
```

## Appendix F – Sounds

All sound effects, synthesised with Web Audio.

### `client/src/lib/sound.ts`

```ts
/**
 * Synthesised sound effects (Web Audio) – no audio files to load.
 * Browsers only allow audio after a user gesture, so `unlock()` runs on the first tap.
 */
import { createStore, readLocal, writeLocal } from './store'

const MUTE_KEY = 'wr.muted.v1'
export const mutedStore = createStore<boolean>(readLocal<boolean | null>(MUTE_KEY, null) ?? false, (v) => writeLocal(MUTE_KEY, v))

/** Applies the event default (Admin setting) unless someone already chose on this device. */
export function applySoundDefault(enabled: boolean) {
  if (readLocal<boolean | null>(MUTE_KEY, null) === null) mutedStore.set(!enabled)
}

let ctx: AudioContext | null = null

function audio(): AudioContext | null {
  if (mutedStore.get()) return null
  try {
    if (!ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!AC) return null
      ctx = new AC()
    }
    if (ctx.state === 'suspended') void ctx.resume()
    return ctx
  } catch {
    return null
  }
}

interface Tone {
  freq: number
  at?: number
  dur?: number
  type?: OscillatorType
  gain?: number
  to?: number
}

function play(tones: Tone[]) {
  const ac = audio()
  if (!ac) return
  const now = ac.currentTime
  for (const t of tones) {
    const start = now + (t.at ?? 0)
    const dur = t.dur ?? 0.12
    const osc = ac.createOscillator()
    const g = ac.createGain()
    osc.type = t.type ?? 'sine'
    osc.frequency.setValueAtTime(t.freq, start)
    if (t.to) osc.frequency.exponentialRampToValueAtTime(t.to, start + dur)
    g.gain.setValueAtTime(0.0001, start)
    g.gain.exponentialRampToValueAtTime(t.gain ?? 0.16, start + 0.012)
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur)
    osc.connect(g).connect(ac.destination)
    osc.start(start)
    osc.stop(start + dur + 0.05)
  }
}

export const sfx = {
  unlock: () => audio(),
  tap: () => play([{ freq: 700, dur: 0.05, type: 'triangle', gain: 0.07 }]),
  /** A solution built – a bright chime. */
  chime: () =>
    play([
      { freq: 784, dur: 0.14, type: 'sine', gain: 0.16 },
      { freq: 1175, at: 0.07, dur: 0.18, type: 'sine', gain: 0.13 },
      { freq: 1568, at: 0.14, dur: 0.32, type: 'sine', gain: 0.1 },
    ]),
  wrong: () => play([{ freq: 220, dur: 0.24, type: 'sawtooth', gain: 0.07, to: 150 }]),
  skip: () => play([{ freq: 520, dur: 0.08, type: 'triangle', gain: 0.08 }, { freq: 390, at: 0.07, dur: 0.12, type: 'triangle', gain: 0.08 }]),
  tick: () => play([{ freq: 1250, dur: 0.035, type: 'square', gain: 0.045 }]),
  count: () => play([{ freq: 523, dur: 0.16, type: 'sine', gain: 0.2 }]),
  go: () => play([{ freq: 784, dur: 0.12, type: 'triangle' }, { freq: 1046, at: 0.1, dur: 0.32, type: 'triangle' }]),
  timeUp: () => play([{ freq: 440, dur: 0.16, type: 'square', gain: 0.06 }, { freq: 330, at: 0.18, dur: 0.34, type: 'square', gain: 0.06 }]),
  /** Full constellation lit. */
  reveal: () =>
    play([
      { freq: 523, dur: 0.16, type: 'triangle' },
      { freq: 659, at: 0.12, dur: 0.16, type: 'triangle' },
      { freq: 784, at: 0.24, dur: 0.16, type: 'triangle' },
      { freq: 1046, at: 0.38, dur: 0.6, type: 'triangle' },
      { freq: 1568, at: 0.5, dur: 0.6, type: 'sine', gain: 0.08 },
    ]),
  star: () => play([{ freq: 1320, dur: 0.1, type: 'sine', gain: 0.08 }, { freq: 1760, at: 0.05, dur: 0.16, type: 'sine', gain: 0.06 }]),
  join: () => play([{ freq: 660, dur: 0.1, type: 'triangle', gain: 0.1 }, { freq: 990, at: 0.08, dur: 0.16, type: 'triangle', gain: 0.1 }]),
}
```

## Appendix G – Game rules and data shapes

Shared types, the tap/skip reducer and ranking, puzzle building (seeded shuffle, decoys, Hard Mode), the seeded random generator and time formatting. The same code runs on the devices and on the server.

### `shared/types.ts`

```ts
import type { AffiliationType } from './validation'

/**
 * Types shared by the kiosk, the phones, the display, the admin area and the server.
 * Times are epoch milliseconds on the SERVER clock unless a name says otherwise.
 */

export type GameMode = 'solo' | 'battle' | 'h2h'

export const MODE_LABELS: Record<GameMode, string> = {
  solo: 'Solo Rush',
  battle: 'Multiplayer Battle',
  h2h: 'Head-to-Head',
}

/** lobby → howto (10 s, everyone together) → running (3-2-1 until go_at, then racing) → finished. */
export type RaceStatus = 'lobby' | 'howto' | 'running' | 'finished' | 'cancelled'

/** waiting = in lobby / how-to / countdown; left = left the lobby or removed by the host. */
export type RunStatus = 'waiting' | 'playing' | 'finished' | 'timeout' | 'left'

// ── Content ─────────────────────────────────────────────────────────────────

export interface Solution {
  id: string
  position: number
  /** The answer players build, e.g. "Schedule Intelligent Dashboard". */
  name: string
  /** Shown during the game. */
  clue: string
  /** One-line learning recap shown on the results screen. */
  description: string
  /** Decoy words for this solution (2–3 are picked per round). */
  decoys: string[]
}

export interface Settings {
  /** Home page title, e.g. "PMX Digital Challenge". */
  event_title: string
  /** Line under the title, e.g. "Powering Project Delivery Through Digital". */
  event_subtitle: string
  timer_seconds: number
  wrong_penalty_ms: number
  skip_penalty_ms: number
  hard_mode: boolean
  /** In Hard Mode, words this short or shorter become letter tiles ("PTQ", "AI", "PDSB"). */
  hard_max_letters: number
  decoys_min: number
  decoys_max: number
  howto_seconds: number
  /** Post-game screens return to the attract screen after this much inactivity. */
  idle_seconds: number
  /** Rehearsal: games are saved as test data, excluded from boards and statistics. */
  rehearsal_mode: boolean
  sound_default: boolean
  /** Address used in the Multiplayer join QR code (phones can't open "localhost"). */
  public_base_url: string
  interest_question: string
  /** OPUs offered when a player is from Business (in display order). Editable in Admin. */
  opus: string[]
  /** Extra decoy words used when a solution has too few of its own. */
  global_decoys: string[]
  profanity: string[]
  /** "Reset daily board": today's boards only count games that ended after this moment (ISO). */
  board_reset_at: string | null
  lobby_timeout_seconds: number
}

/** Settings the kiosk / phones / display need (no blocked-word list). */
export type PublicSettings = Omit<Settings, 'profanity' | 'global_decoys'>

export interface PublicConfig {
  settings: PublicSettings
  /** Names + recap lines (the clue text is only sent inside a race). */
  solutions: Pick<Solution, 'id' | 'name' | 'description'>[]
  server_time: number
  /** KL business day "YYYY-MM-DD". */
  today: string
  version: string
}

// ── Puzzles ─────────────────────────────────────────────────────────────────

export interface Tile {
  id: string
  text: string
  kind: 'word' | 'letter'
}

/** One step of the answer; `word` groups letter tiles back into a word for display. */
export interface AnswerToken {
  text: string
  word: number
}

export interface Puzzle {
  solution_id: string
  name: string
  clue: string
  answer: AnswerToken[]
  tiles: Tile[]
}

export interface GameRules {
  limit_ms: number
  wrong_penalty_ms: number
  skip_penalty_ms: number
  hard_mode: boolean
}

export interface PuzzleStat {
  wrong: number
  skips: number
  /** Effective time (incl. penalties) when it was solved. */
  solved_ms: number | null
}

/** A player's progress through a race. Pure data: the same reducer runs on the device and the server. */
export interface RunProgress {
  /** Puzzle indexes still to solve; [0] is the current one (Skip moves it to the end). */
  queue: number[]
  /** Puzzle indexes in the order they were solved. */
  solved: number[]
  /** Answer tokens already placed for the current puzzle. */
  progress: number
  /** Tile ids used for the current puzzle. */
  used: string[]
  penalty_ms: number
  wrong: number
  skips: number
  /** Effective time (real elapsed + penalties) of the latest solve. */
  last_solve_ms: number | null
  /** Effective finishing time when all puzzles were solved. */
  finish_ms: number | null
  ended: 'finished' | 'timeout' | null
  stats: PuzzleStat[]
}

// ── Races (what clients receive) ────────────────────────────────────────────

export interface RunPublic {
  id: string
  lane: number
  /** Full name as typed. */
  name: string
  affiliation_type: AffiliationType
  /** The project name or the OPU (the "Project / OPU" column). */
  affiliation: string
  status: RunStatus
  connected: boolean
  progress: RunProgress
  /** Ranking time once ended: finishing time, or time of the last solve when the clock ran out. */
  time_ms: number | null
  /** Place within this race once it has finished. */
  place: number | null
  is_winner: boolean
}

export interface RaceState {
  id: string
  mode: GameMode
  status: RaceStatus
  room_code: string | null
  rules: GameRules
  /** Sent once the race is running (everyone gets the same order and tile shuffle). */
  puzzles: Puzzle[]
  /** Tokens per puzzle (for progress bars before/without the puzzles). */
  answer_lengths: number[]
  howto_ends_at: number | null
  go_at: number | null
  ended_at: number | null
  is_test: boolean
  max_players: number
  runs: RunPublic[]
}

// ── Boards ──────────────────────────────────────────────────────────────────

export interface BoardRow {
  rank: number
  player_key: string
  /** Full name as typed. */
  name: string
  affiliation_type: AffiliationType
  /** The project name or the OPU (the "Project / OPU" column). */
  affiliation: string
  solved: number
  time_ms: number
  mode: GameMode
  run_id: string
  ended_at: string
}

export interface WinsRow {
  rank: number
  player_key: string
  /** Full name as typed. */
  name: string
  affiliation_type: AffiliationType
  /** The project name or the OPU (the "Project / OPU" column). */
  affiliation: string
  wins: number
  battles: number
  best_time_ms: number | null
}

export interface Boards {
  day: string
  today: BoardRow[]
  all_time: BoardRow[]
  wins_today: WinsRow[]
  wins_all_time: WinsRow[]
  stats: {
    players_today: number
    players_total: number
    games_today: number
    fastest_today: BoardRow | null
  }
}

export interface RunResult {
  run_id: string
  race_id: string
  mode: GameMode
  /** Full name as typed. */
  name: string
  affiliation_type: AffiliationType
  /** The project name or the OPU (the "Project / OPU" column). */
  affiliation: string
  solved: number
  total: number
  time_ms: number
  finished: boolean
  penalty_ms: number
  wrong: number
  skips: number
  title: string
  /** Place on today's Fastest Times board (best run per player); null for rehearsal games. */
  rank_today: number | null
  players_today: number
  /** Place within a Battle / Head-to-Head race. */
  place: number | null
  is_winner: boolean
  is_test: boolean
  /** Solutions in this round with whether this player solved them (learning recap). */
  recap: { solution_id: string; name: string; description: string; solved: boolean }[]
  feedback_given: boolean
}
```

### `shared/game.ts`

```ts
import type { GameRules, Puzzle, RunProgress } from './types'

/**
 * The race reducer. The same pure functions run on the player's device (instant feedback)
 * and on the server, which is the source of truth: it uses its own clock for `realElapsedMs`
 * (server time since GO), so the result can't be changed from the browser.
 *
 * Penalties move the clock forward: effective time = real time since GO + penalties,
 * and the run ends when the effective time reaches the limit (default 30 s).
 */

export type TapOutcome = 'correct' | 'solved' | 'finished' | 'wrong' | 'timeout' | 'ignored'
export type SkipOutcome = 'skipped' | 'timeout' | 'ignored'

export function createProgress(puzzleCount: number): RunProgress {
  return {
    queue: Array.from({ length: puzzleCount }, (_, i) => i),
    solved: [],
    progress: 0,
    used: [],
    penalty_ms: 0,
    wrong: 0,
    skips: 0,
    last_solve_ms: null,
    finish_ms: null,
    ended: null,
    stats: Array.from({ length: puzzleCount }, () => ({ wrong: 0, skips: 0, solved_ms: null })),
  }
}

export const effectiveMs = (p: RunProgress, realElapsedMs: number) => Math.max(0, realElapsedMs) + p.penalty_ms

export const remainingMs = (p: RunProgress, rules: GameRules, realElapsedMs: number) =>
  Math.max(0, rules.limit_ms - effectiveMs(p, realElapsedMs))

/** Server epoch ms at which this run runs out of time (penalties bring it forward). */
export const deadlineAt = (p: RunProgress, rules: GameRules, goAt: number) => goAt + rules.limit_ms - p.penalty_ms

export const timeUp = (p: RunProgress): RunProgress => (p.ended ? p : { ...p, ended: 'timeout' })

export function applyTap(
  p: RunProgress,
  puzzles: readonly Puzzle[],
  rules: GameRules,
  puzzleIndex: number,
  tileId: string,
  realElapsedMs: number,
): { progress: RunProgress; outcome: TapOutcome } {
  if (p.ended || realElapsedMs < 0) return { progress: p, outcome: 'ignored' }
  if (effectiveMs(p, realElapsedMs) >= rules.limit_ms) return { progress: timeUp(p), outcome: 'timeout' }
  const current = p.queue[0]
  if (current === undefined || current !== puzzleIndex) return { progress: p, outcome: 'ignored' }
  const puzzle = puzzles[current]
  const tile = puzzle?.tiles.find((t) => t.id === tileId)
  if (!puzzle || !tile || p.used.includes(tileId)) return { progress: p, outcome: 'ignored' }

  const expected = puzzle.answer[p.progress]
  // Tiles with the same text are interchangeable (e.g. a repeated letter).
  if (expected && tile.text === expected.text) {
    const used = [...p.used, tileId]
    const placed = p.progress + 1
    if (placed < puzzle.answer.length) return { progress: { ...p, used, progress: placed }, outcome: 'correct' }
    const t = effectiveMs(p, realElapsedMs)
    const queue = p.queue.slice(1)
    const solved: RunProgress = {
      ...p,
      queue,
      solved: [...p.solved, current],
      progress: 0,
      used: [],
      last_solve_ms: t,
      stats: p.stats.map((s, i) => (i === current ? { ...s, solved_ms: t } : s)),
    }
    if (!queue.length) return { progress: { ...solved, finish_ms: t, ended: 'finished' }, outcome: 'finished' }
    return { progress: solved, outcome: 'solved' }
  }

  const next: RunProgress = {
    ...p,
    penalty_ms: p.penalty_ms + rules.wrong_penalty_ms,
    wrong: p.wrong + 1,
    stats: p.stats.map((s, i) => (i === current ? { ...s, wrong: s.wrong + 1 } : s)),
  }
  if (effectiveMs(next, realElapsedMs) >= rules.limit_ms) return { progress: timeUp(next), outcome: 'timeout' }
  return { progress: next, outcome: 'wrong' }
}

/** Skip: the current solution goes to the end of the queue (its progress is cleared) for a time penalty. */
export function canSkip(p: RunProgress): boolean {
  return !p.ended && p.queue.length > 1
}

export function applySkip(
  p: RunProgress,
  rules: GameRules,
  puzzleIndex: number,
  realElapsedMs: number,
): { progress: RunProgress; outcome: SkipOutcome } {
  if (p.ended || realElapsedMs < 0) return { progress: p, outcome: 'ignored' }
  if (effectiveMs(p, realElapsedMs) >= rules.limit_ms) return { progress: timeUp(p), outcome: 'timeout' }
  if (p.queue[0] !== puzzleIndex || !canSkip(p)) return { progress: p, outcome: 'ignored' }
  const [current, ...rest] = p.queue
  const next: RunProgress = {
    ...p,
    queue: [...rest, current],
    progress: 0,
    used: [],
    penalty_ms: p.penalty_ms + rules.skip_penalty_ms,
    skips: p.skips + 1,
    stats: p.stats.map((s, i) => (i === current ? { ...s, skips: s.skips + 1 } : s)),
  }
  if (effectiveMs(next, realElapsedMs) >= rules.limit_ms) return { progress: timeUp(next), outcome: 'timeout' }
  return { progress: next, outcome: 'skipped' }
}

// ── Ranking ─────────────────────────────────────────────────────────────────

/**
 * Ranking time: the finishing time (incl. penalties) when all were solved; when the clock ran out,
 * the time of the last solve ("time used" to reach that many). Nothing solved → the full limit.
 */
export function rankingTimeMs(p: RunProgress, limitMs: number): number {
  if (p.ended === 'finished' && p.finish_ms !== null) return p.finish_ms
  return p.last_solve_ms ?? limitMs
}

export interface Rankable {
  solved: number
  time_ms: number
  /** Tie-break: who got there first (epoch ms). */
  ended_at: number
}

/** More solved first, then faster time, then earlier finish. */
export function compareRuns(a: Rankable, b: Rankable): number {
  return b.solved - a.solved || a.time_ms - b.time_ms || a.ended_at - b.ended_at
}

/** Results titles. */
export function titleFor(solved: number, total = 6): string {
  if (solved >= total) return 'NC Master'
  if (solved >= Math.max(1, total - 2)) return 'NC Explorer'
  return 'NC Rookie'
}

export const TITLE_HINTS: Record<string, string> = {
  'NC Master': 'All solutions built – the full constellation is lit.',
  'NC Explorer': 'Most of the constellation lit – so close!',
  'NC Rookie': 'A great start – play again to light up more stars.',
}
```

### `shared/puzzle.ts`

```ts
import { seededRandom, shuffle } from './random'
import type { AnswerToken, Puzzle, Solution, Tile } from './types'
import { cleanText } from './validation'

export interface PuzzleOptions {
  hard_mode: boolean
  hard_max_letters: number
  decoys_min: number
  decoys_max: number
  global_decoys: readonly string[]
}

export const answerWords = (name: string) => cleanText(name).split(' ').filter(Boolean)

/** Hard Mode turns short words ("PTQ", "AI", "PDSB") into letter tiles. */
export function isLetterWord(word: string, maxLetters: number): boolean {
  return word.length >= 2 && word.length <= maxLetters && /^[\p{L}\p{N}]+$/u.test(word)
}

const LETTERS = 'ABCDEFGHJKLMNPRSTUVWXYZ'

function uniqueWords(list: readonly string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of list) {
    const w = cleanText(raw)
    if (!w || seen.has(w.toLowerCase())) continue
    seen.add(w.toLowerCase())
    out.push(w)
  }
  return out
}

/** Decoys that could never be confused with a real answer word of this solution. */
export function usableDecoys(solution: Pick<Solution, 'name' | 'decoys'>, global: readonly string[]): { own: string[]; global: string[] } {
  const answer = new Set(answerWords(solution.name).map((w) => w.toLowerCase()))
  const own = uniqueWords(solution.decoys).filter((d) => !answer.has(d.toLowerCase()))
  const ownSet = new Set(own.map((d) => d.toLowerCase()))
  return { own, global: uniqueWords(global).filter((d) => !answer.has(d.toLowerCase()) && !ownSet.has(d.toLowerCase())) }
}

export function buildPuzzle(solution: Solution, opts: PuzzleOptions, rand: () => number): Puzzle {
  const words = answerWords(solution.name)
  const answer: AnswerToken[] = []
  const pieces: Omit<Tile, 'id'>[] = []

  words.forEach((word, wi) => {
    if (opts.hard_mode && isLetterWord(word, opts.hard_max_letters)) {
      for (const ch of word) {
        answer.push({ text: ch, word: wi })
        pieces.push({ text: ch, kind: 'letter' })
      }
      // One decoy letter per letter-word, never a letter of that word.
      const pool = LETTERS.split('').filter((c) => !word.toUpperCase().includes(c))
      pieces.push({ text: pool[Math.floor(rand() * pool.length)], kind: 'letter' })
    } else {
      answer.push({ text: word, word: wi })
      pieces.push({ text: word, kind: 'word' })
    }
  })

  const min = Math.max(0, Math.min(opts.decoys_min, opts.decoys_max))
  const max = Math.max(min, opts.decoys_max)
  const count = min + Math.floor(rand() * (max - min + 1))
  const { own, global } = usableDecoys(solution, opts.global_decoys)
  for (const d of [...shuffle(own, rand), ...shuffle(global, rand)].slice(0, count)) pieces.push({ text: d, kind: 'word' })

  // Ids are given after shuffling, so tile ids say nothing about the answer order.
  const tiles = shuffle(pieces, rand).map((p, i) => ({ ...p, id: `t${i}` }))
  return { solution_id: solution.id, name: cleanText(solution.name), clue: cleanText(solution.clue), answer, tiles }
}

/** The round: every solution once, in a random order, each with its own shuffled tiles. Same seed → same round. */
export function buildPuzzles(solutions: readonly Solution[], opts: PuzzleOptions, seed: string): Puzzle[] {
  const rand = seededRandom(seed)
  const usable = solutions.filter((s) => answerWords(s.name).length > 0)
  return shuffle(usable, rand).map((s) => buildPuzzle(s, opts, rand))
}

/** Words built so far from the placed tokens ("P","T","Q" → "PTQ"). */
export function builtWords(puzzle: Puzzle, placed: number): string[] {
  const words: string[] = []
  for (const t of puzzle.answer.slice(0, placed)) words[t.word] = (words[t.word] ?? '') + t.text
  return words.filter((w) => w !== undefined)
}
```

### `shared/random.ts`

```ts
/** Small deterministic PRNG so every player in a race gets the same order and tile shuffle. */
export function seededRandom(seed: string): () => number {
  // FNV-1a hash → mulberry32
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  let a = h >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function shuffle<T>(list: readonly T[], rand: () => number = Math.random): T[] {
  const a = [...list]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** RFC 4122 v4 UUID (uses crypto.randomUUID when available). */
export function uuid(): string {
  const c = globalThis.crypto as Crypto | undefined
  if (c?.randomUUID) return c.randomUUID()
  const bytes = new Uint8Array(16)
  if (c?.getRandomValues) c.getRandomValues(bytes)
  else for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256)
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}
```

### `shared/time.ts`

```ts
/**
 * All "daily" logic runs on Asia/Kuala_Lumpur time (UTC+8, no daylight saving).
 */
export const KL_OFFSET_MS = 8 * 60 * 60 * 1000
export const DAY_MS = 24 * 60 * 60 * 1000

/** "YYYY-MM-DD" of the KL day containing `ts`. */
export function klDayKey(ts: number = Date.now()): string {
  return new Date(ts + KL_OFFSET_MS).toISOString().slice(0, 10)
}

/** UTC epoch-ms range [start, end) of a KL day ("YYYY-MM-DD", or the day containing `ts`). */
export function klDayRange(day: string | number = Date.now()): { start: number; end: number } {
  const key = typeof day === 'number' ? klDayKey(day) : day
  const [y, m, d] = key.split('-').map(Number)
  const start = Date.UTC(y, m - 1, d) - KL_OFFSET_MS
  return { start, end: start + DAY_MS }
}

/** Hour of day (0–23) in KL time. */
export function klHour(ts: number): number {
  return new Date(ts + KL_OFFSET_MS).getUTCHours()
}

/** "1 Oct 2026, 14:05" in KL time, independent of the device's own time zone. */
export function formatKlDateTime(ts: number): string {
  const d = new Date(ts + KL_OFFSET_MS)
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const hh = String(d.getUTCHours()).padStart(2, '0')
  const mm = String(d.getUTCMinutes()).padStart(2, '0')
  return `${d.getUTCDate()} ${months[d.getUTCMonth()]} ${d.getUTCFullYear()}, ${hh}:${mm}`
}

/** Seconds to 0.01, e.g. 12345 → "12.35". */
export function formatSeconds(ms: number | null | undefined): string {
  if (ms === null || ms === undefined || !Number.isFinite(ms)) return '—'
  return (Math.round(Math.max(0, ms) / 10) / 100).toFixed(2)
}
```

## Appendix H – Registration rules

Field rules, exact messages, consent text and the blocked-word matcher.

### `shared/validation.ts`

```ts
/**
 * Registration rules: full name, "You are from" Project or Business, then the project name
 * (free text) or the OPU (from the Admin-editable list), plus PDPA consent.
 * Shared so the kiosk, the phones and the server apply exactly the same rules;
 * the server is authoritative and also runs the blocked-word check.
 */

export const LIMITS = {
  name: { min: 2, max: 60 },
  project: { min: 2, max: 80 },
} as const

export type AffiliationType = 'project' | 'business'

export const AFFILIATION_LABELS: Record<AffiliationType, string> = {
  project: 'Project',
  business: 'Business',
}

export const MESSAGES = {
  name: 'Please enter your full name.',
  affiliation: 'Please select Project or Business.',
  project: 'Please enter your project name.',
  opu: 'Please select your OPU.',
  consent: 'Please tick the consent box to continue.',
} as const

export const CONSENT_TEXT = 'I agree my name and project/OPU will be recorded for this event and shown on the leaderboard.'

export type Field = 'full_name' | 'affiliation_type' | 'project_name' | 'opu' | 'consent'
export type FieldErrors = Partial<Record<Field, string>>

/** What a device sends when a player registers. */
export interface PlayerInput {
  full_name: string
  affiliation_type: AffiliationType | null
  project_name: string | null
  opu: string | null
  consent: boolean
}

/** A checked registration, ready to store. Exactly one of project_name / opu is set. */
export interface Registration {
  full_name: string
  affiliation_type: AffiliationType
  project_name: string | null
  opu: string | null
}

/** NFC, trimmed, single spaces. */
export function cleanText(raw: unknown): string {
  return String(raw ?? '')
    .normalize('NFC')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Full names: 2–60 characters of letters (any script, accents included), spaces, apostrophes,
 * hyphens and periods. "bin" / "binti" are ordinary words; "a/l" and "a/p" are the only places a
 * slash is allowed. Digits and other symbols are not, so numbers-only and symbols-only entries fail.
 */
export function checkFullName(raw: unknown, profanity: readonly string[] = []): { ok: true; value: string } | { ok: false } {
  const value = cleanText(raw)
  if (value.length < LIMITS.name.min || value.length > LIMITS.name.max) return { ok: false }
  const withoutPatronymic = value.replace(/(^|\s)a\/[lp](?=\s|$)/giu, '$1')
  if (!/^[\p{L}\p{M}\s'’.\-]+$/u.test(withoutPatronymic)) return { ok: false }
  if ((value.match(/\p{L}/gu) ?? []).length < 2) return { ok: false }
  if (profanity.length && containsProfanity(value, profanity)) return { ok: false }
  return { ok: true, value }
}

/** Project names: 2–80 characters with at least one letter; digits and common punctuation allowed ("PFLNG 3", "Kasawari CCS"). */
export function checkProjectName(raw: unknown, profanity: readonly string[] = []): { ok: true; value: string } | { ok: false } {
  const value = cleanText(raw)
  if (value.length < LIMITS.project.min || value.length > LIMITS.project.max) return { ok: false }
  if (!/\p{L}/u.test(value) || !/^[\p{L}\p{M}\p{N}\s'’.\-\/&(),+#:]+$/u.test(value)) return { ok: false }
  if (profanity.length && containsProfanity(value, profanity)) return { ok: false }
  return { ok: true, value }
}

/** The OPU exactly as written in the list (matching ignores case and spacing). */
export function matchOpu(raw: unknown, opus: readonly string[]): string | null {
  const v = cleanText(raw).toLowerCase()
  if (!v) return null
  return opus.find((o) => cleanText(o).toLowerCase() === v) ?? null
}

export type RegistrationCheck = { ok: true; value: Registration } | { ok: false; errors: FieldErrors; field: Field; message: string }

/**
 * Checks every field at once (for inline errors under each field). `field`/`message` is the first problem.
 * Leave `profanity` empty on devices – the server adds the blocked-word check.
 */
export function checkRegistration(p: Partial<PlayerInput> | null | undefined, opus: readonly string[], profanity: readonly string[] = [], opts: { requireConsent?: boolean } = {}): RegistrationCheck {
  const errors: FieldErrors = {}
  const name = checkFullName(p?.full_name, profanity)
  if (!name.ok) errors.full_name = MESSAGES.name
  const type = p?.affiliation_type === 'project' || p?.affiliation_type === 'business' ? p.affiliation_type : null
  if (!type) errors.affiliation_type = MESSAGES.affiliation
  let project: string | null = null
  let opu: string | null = null
  if (type === 'project') {
    const pr = checkProjectName(p?.project_name, profanity)
    if (pr.ok) project = pr.value
    else errors.project_name = MESSAGES.project
  } else if (type === 'business') {
    opu = matchOpu(p?.opu, opus)
    if (!opu) errors.opu = MESSAGES.opu
  }
  if (opts.requireConsent !== false && p?.consent !== true) errors.consent = MESSAGES.consent
  const order: Field[] = ['full_name', 'affiliation_type', 'project_name', 'opu', 'consent']
  const first = order.find((f) => errors[f])
  if (first) return { ok: false, errors, field: first, message: errors[first]! }
  return { ok: true, value: { full_name: name.ok ? name.value : '', affiliation_type: type!, project_name: project, opu } }
}

/** "Project name" or "OPU" – what the leaderboards show in the "Project / OPU" column. */
export function affiliationOf(r: { affiliation_type: AffiliationType; project_name: string | null; opu: string | null }): string {
  return (r.affiliation_type === 'project' ? r.project_name : r.opu) ?? ''
}

// ── Profanity ───────────────────────────────────────────────────────────────

const LEET: Record<string, string> = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '8': 'b', '@': 'a', $: 's', '!': 'i', '|': 'i', '+': 't' }

/** Lower-case, accents removed (Latin only – other scripts are kept intact), leetspeak undone. */
function fold(s: string): string {
  return s
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[0134578@$!|+]/g, (ch) => LEET[ch] ?? ch)
}

/** "fuuuck" → "fuck" */
const squeeze = (s: string) => s.replace(/(\p{L})\1+/gu, '$1')

/**
 * True when the text contains a blocked word.
 * - "word"  blocks the whole word only (so "Rashitah" is not caught by "shit").
 * - "word*" also blocks the word inside other words / joined-up text.
 * - Multi-word entries ("anak haram") block that phrase.
 */
export function containsProfanity(text: string, words: readonly string[]): boolean {
  const tokens = fold(text)
    .split(/[^\p{L}\p{M}]+/u)
    .filter(Boolean)
  if (!tokens.length) return false
  const variants = [tokens, tokens.map(squeeze)]
  for (const entry of words) {
    const raw = fold(entry.trim())
    if (!raw) continue
    const inside = raw.endsWith('*')
    const phrase = raw
      .replace(/\*+$/, '')
      .split(/[^\p{L}\p{M}]+/u)
      .filter(Boolean)
    if (!phrase.length) continue
    for (const toks of variants) {
      const joined = ` ${toks.join(' ')} `
      const compact = toks.join('')
      for (const p of [phrase, phrase.map(squeeze)]) {
        if (inside) {
          if (compact.includes(p.join(''))) return true
        } else if (joined.includes(` ${p.join(' ')} `)) {
          return true
        }
      }
    }
  }
  return false
}

// ── Identity ────────────────────────────────────────────────────────────────

/** Case-, accent- and spacing-insensitive form used to recognise returning players. */
export function nameKey(s: string): string {
  return cleanText(s)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[’`]/g, "'")
}
```

## Appendix I – Seed content and copy

Default solutions, blocked words, OPU list and settings; the feedback wording; the ticker list.

### `shared/seed.ts`

```ts
import type { Settings, Solution } from './types'

/**
 * First-run content. Everything here is editable in Admin.
 * Clues are the examples from the brief; recap lines for SID, PTQ Online, PPM and PCC follow the
 * PMX catalogue wording. Project AI and PDSB Services use the brief's clue text – replace with the
 * official one-liners before the event if needed.
 */
export const SEED_SOLUTIONS: Solution[] = [
  {
    id: 'sid',
    position: 1,
    name: 'Schedule Intelligent Dashboard',
    clue: 'Spots schedule delays early with smart analytics',
    description: 'Consolidates schedule health and performance to flag potential schedule concerns early.',
    decoys: ['Smart', 'Analytics', 'Tracker', 'Portal'],
  },
  {
    id: 'ptq-online',
    position: 2,
    name: 'PTQ Online',
    clue: 'Submits and tracks technical queries digitally',
    description: 'Simplifies submission, review, approval and tracking of technical queries and project changes.',
    decoys: ['Portal', 'Digital', 'System', 'Hub'],
  },
  {
    id: 'ppm',
    position: 3,
    name: 'Project Production Management',
    clue: 'Tracks site productivity and work progress',
    description: 'Plan simulations, resource optimisation and daily work control to keep site work on track.',
    decoys: ['Tracker', 'Digital', 'Hub', 'System'],
  },
  {
    id: 'project-ai',
    position: 4,
    name: 'Project AI',
    clue: 'Predicts project risks using artificial intelligence',
    description: 'Uses artificial intelligence to predict project risks before they become issues.',
    decoys: ['Smart', 'Analytics', 'Digital', 'Insight'],
  },
  {
    id: 'pdsb-services',
    position: 5,
    name: 'PDSB Services',
    clue: 'Digital services delivered by PDSB',
    description: 'Digital services delivered by PDSB for project teams.',
    decoys: ['Portal', 'Hub', 'Digital', 'Platform'],
  },
  {
    id: 'pcc',
    position: 6,
    name: 'Project Command Centre',
    clue: 'One central view to monitor and control the project',
    description: 'The single source of truth for project data – one central view to monitor and control the project.',
    decoys: ['Smart', 'Hub', 'System', 'Tracker'],
  },
]

/** Default blocked-word list (English + Malay), editable in Admin → Settings. */
export const SEED_PROFANITY: string[] = [
  'fuck*', 'shit', 'shits', 'shitty', 'bullshit*', 'shithead*', 'cunt*', 'bitch*', 'bastard*', 'asshole*',
  'ass', 'arse', 'arsehole*', 'cock', 'pussy*', 'whore*', 'slut*', 'nigger*', 'nigga*', 'fag', 'faggot*',
  'retard*', 'wanker*', 'twat*', 'bollocks*', 'porn', 'porno*', 'sex', 'sexy', 'penis', 'vagina', 'boob',
  'boobs', 'tits', 'rape', 'rapist*', 'nazi', 'hitler', 'anal', 'anus', 'dildo*', 'jerkoff*', 'blowjob*',
  'babi', 'bodoh', 'sial', 'celaka', 'bangsat', 'keparat', 'puki', 'pukimak*', 'pantat', 'lancau*', 'butoh',
  'kote', 'konek', 'pepek', 'jubur', 'haram jadah', 'anak haram', 'sundal', 'pelacur', 'lahanat', 'bangang',
  'bengap', 'kimak', 'cibai*', 'lanjiao*', 'lanjiau*', 'pundek', 'mampus', 'setan', 'jalang', 'gampang',
]

/**
 * OPUs offered when a player is from Business – in this order. Admin can edit the list.
 * "Group - Name" entries are shown under a group heading in the picker ("Downstream" → MRCSB, PC MTBE, …).
 */
export const DEFAULT_OPUS: string[] = [
  'Downstream - MRCSB',
  'Downstream - PC MTBE',
  'Downstream - PCEPE',
  'Downstream - PCFKSB',
  'Downstream - PCGCo',
  'Downstream - PCMSB',
  'Downstream - PCOGD',
  'Downstream - PDB',
  'Downstream - PETCO',
  'Downstream - PLISB',
  'Downstream - PP(T)SB',
  'Downstream - PRPC Group',
  'Gas & Maritime - MLNG',
  'Gas & Maritime - PGB GPU',
  'PE&T - GPE',
  'PE&T - PDSB',
  'PE&T - PRSB',
  'Upstream - MPM',
  'Upstream - PMA',
  'Upstream - SBA',
  'Upstream - SKA',
  'Others',
]

/** The first OPU list – migration 003 replaces it with DEFAULT_OPUS where it was saved unchanged (used by its test). */
export const PREVIOUS_DEFAULT_OPUS: string[] = [
  'Upstream',
  'Downstream',
  'Gas & Maritime',
  'Project, Engineering and Technology',
  'Malaysia Petroleum Management',
  'Finance',
  'Corporate Sustainability',
  'Group Corporate Governance & Secretarial',
]

export const DEFAULT_SETTINGS: Settings = {
  event_title: 'PMX Digital Challenge',
  event_subtitle: 'Powering Project Delivery Through Digital',
  timer_seconds: 30,
  wrong_penalty_ms: 1000,
  skip_penalty_ms: 2000,
  hard_mode: false,
  hard_max_letters: 4,
  decoys_min: 2,
  decoys_max: 3,
  howto_seconds: 10,
  idle_seconds: 30,
  rehearsal_mode: false,
  sound_default: true,
  public_base_url: '',
  interest_question: 'Which digital solution interests you most?',
  opus: DEFAULT_OPUS,
  global_decoys: ['Smart', 'Portal', 'Hub', 'Analytics', 'Digital', 'Tracker', 'System', 'Platform', 'Insight', 'Cloud'],
  profanity: SEED_PROFANITY,
  board_reset_at: null,
  lobby_timeout_seconds: 300,
}

/** Stored settings merged over the defaults (new settings get their default automatically). */
export function withDefaults(stored: Partial<Settings> | null | undefined): Settings {
  return { ...DEFAULT_SETTINGS, ...(stored ?? {}) }
}

/** Bounds enforced by Admin (and the tests). */
export const SETTING_BOUNDS = {
  timer_seconds: [10, 120],
  wrong_penalty_ms: [0, 10_000],
  skip_penalty_ms: [0, 10_000],
  hard_max_letters: [2, 6],
  decoys_min: [0, 5],
  decoys_max: [0, 5],
  howto_seconds: [3, 30],
  idle_seconds: [10, 300],
  lobby_timeout_seconds: [60, 1800],
} as const

export const SOLUTION_COUNT = 6
export const MAX_BATTLE_PLAYERS = 4
export const COUNTDOWN_MS = 3500
```

### `shared/feedback.ts`

```ts
import type { GameMode } from './types'
import type { AffiliationType } from './validation'

/**
 * Booth feedback: three one-tap questions between the end of a game and the result card.
 * Asked once per player per KL day (player = normalised full name + project name or OPU, as on the
 * boards); a replay the same day goes straight to the result card.
 */

export type FeedbackMode = 'solo' | 'team'

/** Solo Rush → solo; Multiplayer Battle and Head-to-Head → team (each player answers for themselves). */
export const feedbackModeOf = (mode: GameMode): FeedbackMode => (mode === 'solo' ? 'solo' : 'team')

export const FEEDBACK_MODE_LABELS: Record<FeedbackMode, string> = {
  solo: 'Solo',
  team: 'Team',
}

export const FEEDBACK_COPY = {
  heading: '🎉 Great game! Your score is ready.',
  intro: 'Answer 3 quick questions to see your result.',
  q1: 'Was the information shared at the booth relevant to your project or business needs?',
  q2: 'Would you consider adopting or exploring any of the solutions showcased?',
  q2_chips: 'Which ones? (optional – pick any)',
  q3: 'Did the booth help you better understand the available digital solutions?',
  submit: 'See My Result',
} as const

/** Label under the stars for ratings 1–5. */
export const UNDERSTANDING_LABELS = ['', 'Not at all', 'A little', 'Somewhat', 'Yes', 'Very much'] as const

/** POST /api/feedback. `feedback_id` is made on the device, so a retry after a dropped connection is never counted twice. */
export interface FeedbackSubmission {
  feedback_id: string
  run_id: string
  token: string
  q1_relevant: boolean
  q2_would_explore: boolean
  /** Solution ids – only with a Yes to question 2 (optional, any number). */
  q2_interested_solutions: string[] | null
  q3_understanding_rating: number
  /** When "See My Result" was tapped, on the server clock as the device knew it (an offline answer syncs later). */
  answered_at: number
}

export interface FeedbackSaved {
  ok: true
  /** duplicate = this exact answer had already arrived (a retry). */
  status: 'saved' | 'duplicate'
}

/** GET /api/runs/:id/feedback – answers only once the game's score is in the database. */
export interface FeedbackStatus {
  score_saved: true
  /** False when this player already answered today: go straight to the result card. */
  required: boolean
  /** KL day "YYYY-MM-DD". */
  day: string
}

// ── Admin: Feedback section ─────────────────────────────────────────────────

export interface FeedbackFilter {
  /** KL days "YYYY-MM-DD", both inclusive; null = open-ended. */
  from: string | null
  to: string | null
  mode: FeedbackMode | 'all'
  affiliation: AffiliationType | 'all'
  /** One OPU (Business answers only); null = every OPU. */
  opu: string | null
}

export interface FeedbackBreakdownRow {
  key: string
  label: string
  responses: number
  q1_yes: number
  q2_yes: number
  q3_average: number | null
}

export interface FeedbackDashboard {
  filter: FeedbackFilter
  /** OPU choices for the filter: the Admin list plus any OPU found in answers. */
  opus: string[]
  /** Rehearsal answers for the same filters (left out of everything else). */
  rehearsal_responses: number
  responses: number
  /** Games played to the end (all solved or out of time) for the same filters. */
  completed_games: number
  /** responses ÷ completed_games */
  response_rate: number | null
  q1: { yes: number; no: number }
  q2: { yes: number; no: number }
  q3: { average: number | null; distribution: { rating: number; count: number }[] }
  /** Distinct players who picked each solution under question 2, highest first. */
  solutions: { id: string; name: string; players: number }[]
  /** Business answers per OPU (most answers first). */
  by_opu: FeedbackBreakdownRow[]
  /** Project answers per project name (spellings grouped, Admin merges applied). */
  by_project: FeedbackBreakdownRow[]
}
```

### `shared/catalogue.ts`

```ts
/** PMX Catalogue – Go Live: the 34 digital solutions (scrolling ticker on the home page). */
export const PMX_SOLUTION_NAMES = [
  'Project Command Centre',
  'PPMS Suite',
  'EPMS Project Risk',
  'EPMS Permitting',
  'Project Lesson Learn',
  'Benchmark Hub',
  'MYICONS',
  'P6 EPPM',
  'Smart Planner',
  'Aspen K-Base',
  'ORION',
  'SAFRAN',
  'Schedule Intelligent Dashboard',
  'Synchro 4D',
  'Project AI',
  'P-EDMS',
  'E-CDBM',
  'PTQ Online',
  'Selektor',
  'P-ELSOR',
  'FnGMap',
  'Augmented Engineering Review',
  'Engineering Maturity Index',
  'LNGPro',
  'ProTrackS',
  'CR Pro',
  'Advanced Work Packaging',
  'Construct Hub',
  'Project Production Management',
  'PCMS',
  'Quality+',
  'Online Project Quality',
  'Quality Card',
  'QPRS',
] as const
```

