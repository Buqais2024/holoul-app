# Holoul Maintenance PWA — project handoff

Maintenance management app for the Holoul e-waste plant (Jeddah). Owner: Muaz, maintenance
supervisor. Plant operates Sunday–Thursday. App language: English + Arabic (RTL). New feature
strings are English-only unless asked otherwise.

## Architecture

- **Frontend**: static PWA served from GitHub Pages (`https://github.com/Buqais2024/holoul-app`).
- **Backend**: one Google Apps Script web app (`Code.gs`), called as `POST` with form-encoded JSON.
- **Database**: Google Sheets (Users, Equipment, Spares, Tasks, reading sheets, auto-created tabs).
- **Offline first**: every write goes through an outbox in `sync.js`; the UI never blocks on network.

### Files (repo root)

| File | What it is |
|---|---|
| `index.html` | Whole app shell: login, public fault form, home, readings, checklists, settings, task modal. Inline CSS + JS. |
| `dash.js` | Dashboard (supervisor/manager view). IIFE, exports `window.HoloulDash`. Sections: overview, tasks, schedule, requests, procedures, pm, equipment, spares, purchasing, reports, costs, team, monthly. |
| `sync.js` | Offline outbox, `HS.post` / `HS.api` / `HS.kv` / `HS.state`. Loaded by both page and service worker. |
| `sw.js` | Service worker. `CACHE` constant carries the app version. |
| `qr.js` | QR generation/scanning for equipment and spare labels. |
| `Code.gs` | Apps Script backend. `version` field in the ping response is the backend version (now 20). |
| `manifest.json`, `icon*.png`, `icon.svg` | PWA assets. |

## Standing rules (do not break these)

1. **Never** `git commit`, `git push`, merge to `main`, or deploy the Apps Script without Muaz's
   explicit approval, each time.
2. Test on copies, never on the live Sheet or live deployment.
3. Backend and frontend ship **together** — a frontend that calls a route the deployed backend
   lacks is a broken app.
4. Bump the version in **both** places when shipping: `CACHE` in `sw.js` and every `?v=N`
   query string in `index.html` and `sw.js`. Current: **v25**, backend **20**.

## Deploy procedure (Muaz does this, after approving)

**Backend**: open the Apps Script project → select all in `Code.gs` → paste the new file →
Save → `Deploy` → `Manage deployments` → pencil (edit) → Version: `New version` → `Deploy`.
The web app URL must stay the same.

**Frontend**: push to `main`; GitHub Pages publishes it. Users get it after the service worker
picks up the new `CACHE` name (one reload, sometimes two).

## Test harness

Lives in `test/`. It
runs the **real** `Code.gs` inside a Node `vm` with a mock of the Apps
Script globals, so backend tests exercise production code.

- `gas_mock.js` — mock SpreadsheetApp / PropertiesService / CacheService / MailApp / Utilities.
  Mock clock starts **Sunday 2026-11-29 12:00 Asia/Riyadh**. `rt.advance` / `rt.setNow` move it.
- `world.js` — seed data (users `sup/1111`, `tech1/2222`, `tech2/2223`, equipment, spares, tasks).
- `server.js` — serves the app on `http://127.0.0.1:8788` and proxies `/api` to the mocked backend.
  Control routes: `/ctl/reset`, `/ctl/call`, `/ctl/tasks`, `/ctl/advance`, `/ctl/cycle`, `/ctl/mails`.
- `bt_common.py` — Playwright helpers (`newpage`, `login`, `ctl`, `BASE`).
- `mut7.py`, `mut8.py` — mutation testing: patch `Code.gs`, re-run suites, expect failures.

### Commands

```bash
# start / restart the test server after any code change
cd test && pkill -f "node server.js"; (nohup node server.js > /tmp/server.log 2>&1 &)

# backend suites (213 checks)
for f in backend pm assets parts reports requests plan r8; do node $f.test.js; done

# browser suites (277 checks) — needs playwright for python
for f in bt_suite bt_pm bt_assets bt_parts bt_reports bt_field bt_plan bt_r8 bt_r9; do python3 $f.py; done
```

### Gotchas

- The mock server clock (2026-11-29) is not the browser clock. When a test depends on dates use
  `pg.clock.set_fixed_time('2026-11-29T09:00:00Z')`, or pass dates explicitly to the API.
- Tokens expire when the mock clock advances — log in again after `/ctl/advance`.
- Headless Chromium **has** `SpeechRecognition`; delete it in an init script to test its absence.
- Async saves/messages: wait with `wait_for_function`, not `wait_for_timeout`.
- Server-computed periods (cost report `period`) are intentional — the client clock is untrusted.

## State of the work (as of this handoff)

Branch `release-17-tasks`, **everything uncommitted**. Built and fully tested, not deployed:

- **Releases 1–6**: readings, checklists, offline sync, tasks, roles/permissions, equipment and
  spare-part editing with photos, QR labels, dashboard, PM calendar, reports, repeating tasks.
- **Release 7**: procedures (checklists/audits with steps), purchase orders, team scheduling.
- **Release 8**: cost per machine (labor + parts + downtime, supervisor-only), settings sheet
  (labor rate, downtime rate, public form switch), public fault-report form reachable by QR with
  rate limits and honeypot, odd-reading alerts, voice dictation for notes.
- **v25 home redesign**: reading modules collapsed into one "Readings & checks" picker tile;
  "Your access" lists every feature the user's rights allow; per-user show/hide ("Show / hide"
  sheet, stored in `localStorage` as `holoul_hidden:<username>`); profile icon in the header
  opening a speech-bubble popover (name, role, ID, equipment, date, open/late work orders, last
  update, sync state); "New work order" only on Overview/Tasks/Schedule; Refresh is now an icon.

Preview artifact (test data, runs `Code.gs` in-page via `preview/mockgas.js`):
https://claude.ai/artifact/5tHdFYaFgkm7KkkmoB3BuQ

### Open items

- Ticked but unbuilt: **in-app chat** (feature 55). Comments on tasks/requests cover most of it.
- Decide whether to commit R7 + R8 + v25 to `release-17-tasks` and deploy.

## Conventions

- No build step, no framework, no npm dependencies in the app itself. Plain HTML/CSS/JS.
- Every new backend route goes through `withUser` (signed token) unless it is deliberately public.
- `locked()` wraps writes that must not interleave.
- Strings go through `t()` / the `I18N` tables; add English and Arabic keys together for existing
  features, English-only for new ones.
