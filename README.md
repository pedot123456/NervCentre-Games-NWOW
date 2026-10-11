# PMX Digital Challenge – Word Rush (NervCentre Games NWOW)

Touchscreen booth game: players build the names of six digital solutions from word tiles in 30 seconds.
Each name lights a star of the NERVCENTRE "N" constellation. Solo Rush, Multiplayer Battle (phones),
Head-to-Head (two players on one screen), a TV display and a PIN-protected Admin area.

Built to the spec in [`docs/Word-Rush-UI-UX-Spec.md`](docs/Word-Rush-UI-UX-Spec.md). Files in
`docs/original/` are parts of the original app kept for reference (not used by the build).

| Page | Address |
| --- | --- |
| Kiosk game | `/#/` |
| Phones (Multiplayer Battle) | `/#/join` or `/#/join/1234` |
| TV display | `/#/display` |
| Admin | `/#/admin` (first-login PIN `1234` locally – you must choose your own straight away) |

## Run it locally

Requires Node.js 20.19+.

```bash
npm install
npm run dev
```

The API runs on `http://localhost:8090` and the website on **`http://localhost:5174`**. Locally the
app uses an embedded PostgreSQL database (PGlite) in `%LOCALAPPDATA%\NervCentre Games NWOW\data` –
no setup needed. Ports already taken? `PORT=8091 npx tsx server/index.ts` and
`PORT=8091 npx vite --port 5180` in two terminals.

```bash
npm test                 # engine, feedback, admin and validation tests (in-memory database)
npm run build            # typecheck + build the website
npm start                # one server for everything on :8090 (booth laptop, no internet needed)
```

## Deploy online: Vercel + Supabase

1. **Database – Supabase:** create a free project at [supabase.com](https://supabase.com), region
   **Northeast Asia (Tokyo)** (the API runs next to it; for another region set
   `VERCEL_FUNCTION_REGION`, e.g. `sin1` for Singapore). Then **Connect → Transaction pooler** and copy
   the connection string (port `6543`), with your database password in it (special characters in
   the password percent-encoded, e.g. `/` → `%2F`). The app creates its tables itself.
2. **Vercel:** push this folder to GitHub, then on [vercel.com](https://vercel.com) **Add New →
   Project** and import the repository. Build settings come from `vercel.json`; leave them. Add two
   **Environment Variables**:
   - `DATABASE_URL` – the Supabase connection string
   - `ADMIN_DEFAULT_PIN` – your own 6–12 digit first-login PIN (not `1234`, no runs like `123456`)

   Optionally `CRON_SECRET` (any long random text) to protect the daily backup job.
3. Deploy, open `https://<project>.vercel.app/#/admin`, sign in with that PIN and choose the real one.
4. Phones join through the production address automatically (the QR code on the battle lobby).

**Check the Vercel build on your PC first:**

```bash
npm run build:vercel     # typecheck, build the website, bundle the API into .vercel/output
npm run preview:vercel   # serve that output the way Vercel does, on http://localhost:3000
```

### How it works on Vercel

The website is served from Vercel's CDN; the whole API is one serverless function in Tokyo
(`hnd1`, next to the database). Nothing is kept in server memory – every race, game, Admin session
and backup is in the database, so any instance can answer any request:

- **Live updates:** the original app pushed updates over Socket.IO, which serverless hosting can't
  keep open. Here the same events are HTTP calls (`POST /api/rt/<event>`, same payloads), and screens
  poll: about every 0.6 s during a race, 1–1.5 s in a lobby, 2 s for the TV display. A player's own
  taps are applied on the device at once and timed by the server.
- **Timing:** every countdown follows the server clock (devices sync to it), so all screens in a
  battle show the same 3-2-1-GO. Runs that run out of time are closed the next time anyone looks
  at the race; the daily cron settles anything left over.
- **Backups:** stored compressed in the database; a daily one runs at 02:00 Malaysia time (Vercel
  Cron) and when Admin opens the dashboard; the last 14 are kept. Admin → Exports & data downloads
  them as JSON.
- A free Supabase project pauses after 7 days with no activity – open the Supabase dashboard and
  click **Restore** before an event if it has been idle.

## Project structure

```
client/src/   React app: kiosk/, player/ (phones), display/ (TV), admin/, components/, lib/
server/       Fastify API: game/engine.ts (stateless race engine), routes/, services/, db/
shared/       Rules shared by device and server: game reducer, puzzles, validation, types
scripts/      Vercel build + local preview
tests/        node:test suites (run against an in-memory database)
```
