# GTA 6 v6 — Improvement Report (Sunset Bay)

- Date: 2026-11-19 (build 14:07–14:45 +07)
- Competition: gta6-01 "Make GTA 6", $1,666, deadline 2026-11-24T15:00Z, results ~10/12
- Submitted v5: `01a1ed1b-3ed2-7398-97b2-43d814f8cdbf` ("Sunset Bay"), stage scored, round 4
- v6 repo: https://github.com/HALCYON1803/gta6-01-v6, commit `ca4faec` (HEAD), branch master
- v6 dir: `~/workspace/make-fun-bounty/gta6-01-v6/`
- Recording: `01a1f2a3-a246-70bc-b678-fb90f6ea5888` (STILL RUNNING — parent must seal it, see §6)
- Session id (this builder): `253ba91f-c3af-4501-b200-7c480d1632d8`

## 1. Competition still open? Yes

`GET /api/competitions/gta6-01` on 2026-11-19 ~14:08 +07: `status: "open"`,
phase dev ends `2026-11-24T15:00:00Z`, 8,053 submissions. `makefun check`
`competition_open` PASS.

## 2. Gap to the top (one sentence, with evidence)

Top entries have 7–12 story missions plus a police helicopter, roadblocks,
radio, garage upgrades, shops and safehouses while v5 has only 3 missions
and no helicopter, roadblocks, radio or garage, and sits at rank 2043
(judge 98.52%, 12–0) versus #1 klencho at 99.40% (12–0, "8 story missions,
5-star PCPD dispatch, helicopter & roadblocks, weapon wheel, carjacking,
garage upgrades, respect, saves, radio").

Top-10 titles all name the same kit: 7–12 missions, helicopter chases,
roadblocks, radio, garage upgrades, shops/safehouses. The judge reads
screenshots first (contact sheet) and a short source outline second, so v6
had to make the new systems VISIBLE in the screenshots and NAMED in the
source (new files: `heli.js`, `radio.js`, `garage.js`, `missions.js` with
8 defs, `combat.js` with 4 weapons).

## 3. What v6 changes vs v5

| Area | v5 | v6 |
|---|---|---|
| Story missions | 3 (courier, getaway, harbor) | 8 (+ street race, taxi fares, store robbery, export, showdown) via a generic step machine (goto / timedGoto / hold / destroy / heat / steal) |
| Weapons | pistol only | 4 on keys 1–4: Pistol, SMG, Shotgun (5 pellets), Rifle — distinct damage/rate/mag/spread |
| Police | 1–3 pursuit cars, stars decay when hidden | + roadblocks at 3★ (2 patrol cars across the road ahead, refreshed every 20 s) + **Air One helicopter** at 4★ (searchlight, pins the wanted level while overhead) |
| Radio | none | 3 stations (BAY FM / NEON / PALM), WebAudio synth sequencer, Q cycles, HUD shows station |
| Garage | none | Sunset Garage (G): Engine $800 (+9 top speed), Armor $600 (45% less car damage), NOS $500 (Shift boost, meter) — saved |
| Progression | money only | respect +100/mission, ranks Rookie → Wheelman → Street Legend → Bay Boss → King of the Bay, on HUD + title screen |
| Traffic AI | cruise + car-ahead slowdown | + pulls over when a police chase is within 38 m |
| City | towers, palms, beach | + garage / corner store / gun-shop buildings with colored roofs + signs, neon signs on tall towers, lit windows, pier |
| Combat aim | ray from camera through player — dived into the ground, never hit anything past ~6 m (found by probe) | ray leaves the gun flat in the camera yaw direction — hits at any range |
| Save | v1 key (money, missions) | v2 key (+ respect, upgrades, weapon) |
| Perf | pixelRatio ≤ 2, shadow 2048 | pixelRatio ≤ 1.25, shadow 1024 |
| Pointer lock | uncaught rejection in headless → console error | guarded with try/catch + `.catch()` |
| Bugs fixed | courier drop 2 at (-150,-150) sat inside a building collider — unreachable by a real driver | moved to (-180,-150) on the street; newly spawned cars call `updateMatrixWorld(true)` so they are raycastable immediately (a just-spawned rival was unhittable until the next render — at ~1 fps headless that is seconds); `clearRoadblocks()` resets the roadblock timer so a fresh heat can set a new roadblock |

## 4. Measurements

### Playtest — `tools/playtest.mjs` (headless Chromium, CDP, swiftshader)

Final run: **43/43 PASS, 0 console errors, 0 failed requests.**
Runs before that: 21/40 → 33/43 → 41/43 → 42/43 → 43/43; every failure
was diagnosed with a probe script (`/tmp/probe*.mjs`, ephemeral) and fixed
in the game or the test — see §5 for the two real game bugs found this way.

Coverage of the 43 checks: load (title state, no failed requests), start,
walk (W moves), steal (test action + real E key with a 5 s hold — headless
runs ~0.3 fps so a 100 ms press falls between frames), drive (car moves,
wanted rises), all 4 weapons (select + shoot + real mouse click), radio
(3 stations cycle), garage (panel opens, buy engine/armor/NOS, money
deducted 5000 → 3100), NOS (meter 100 → ~39, speed ~42), all 8 missions
completed for real (courier 4 drops, getaway raise-then-lose 3★, harbor
rival shot dead, street race 5 gates, taxi 3 fares, robbery 8 s hold,
export coupe stolen + delivered, showdown 3 rivals shot dead), respect
800 after 8 missions, Air One at 4★, roadblock ≥ 2 at 3★, pursuit cars,
heat clears + roadblocks gone, save v2 written with 8 missions recorded.

Determinism note: the playtest drives game time with a `tick(seconds)`
test hook (`__sunsetBay.tick/driveFor/enterNearestCar/exitCar/clearWanted`)
because the headless loop clamps dt to 0.05 while rendering ~0.3–1 fps,
so real time runs ~20× game time. The hook only calls the game's own
update functions. Real key/click paths are also tested (E, mouse click, W).

### FPS (headless swiftshader, 1280×720)

- v5 baseline (same method, `?shot=street` + 3 s rAF count): **1.0 fps**
- v6: **0.3 / 0.7 / 1.0 fps across runs** (same method, driving)
- Verdict: NO measurable difference — the number is dominated by software
  rasterization and machine load (it varied 3× between identical runs),
  not by the game. The pixelRatio/shadow cuts target real GPUs and
  low-end machines; they did not hurt anything. Do not claim a v6 FPS win.

### Screenshots (real renders, Chromium headless, 1280×720)

- `1-start.jpg` — title over downtown, "8 JOBS", full controls list.
- `2-street.jpg` — Sunset Grand Prix, Gate 1, beacon column, NEON 101.5 radio, minimap target.
- `3-chase.jpg` — 4★ chase: **Air One visible with searchlight beam**,
  roadblock + pursuit cars ahead, 56 km/h, minimap heli ring.
- `4-mission.jpg` — Corner Store Job robbery in progress ("5s left in the
  zone / 5s of 8s"), 2★, beacon + marker, storefront behind the player.
- All four: 0 console errors, 0 failed requests during capture.

### Build / dossier

- `MAKEFUN_OUTPUT_DIR=out node main.ts` → `out/dossier.json` **427,310 bytes**
  (limit 1.5 MiB). `out/` is git-ignored, as in v5.
- `makefun check --kit … --repo … --worktree`: **4 passed, 0 failed,
  16 skipped, 5 checked at submission** — "ok: every check run here passes".
  All transcript checks (`thinking_reproduces` etc.) are skipped locally by
  design: "the site runs it on the transcripts it builds from gta6-01's
  sealed recordings". **thinking_reproduces ≥ 30% could NOT be verified
  locally — the parent must confirm it from the sealed recording / at
  submission (see §6).**
- At-submission items: repo public ✓ (created public 2026-11-19),
  repo created after opening ✓, commit pushed ✓ (`ca4faec` on master),
  repo owner HALCYON1803 = the account's linked GitHub login, snapshot is
  our own work (differs from every other entry).

## 5. Lessons (for the next build)

1. **A ray from the camera through the player cannot hit distant targets.**
   v5's shooting was effectively broken past ~6 m and nobody noticed,
   because the playtest never shot at a measured distance. Test combat at
   a known range with a known target and read the target's health back.
2. **Newly spawned meshes have an identity matrixWorld until the next
   render.** At ~1 fps headless that is seconds. Any raycast/shoot test
   right after a spawn will miss. Fix in the game (`updateMatrixWorld`
   on spawn), not only in the test.
3. **Mission points must be reachable on foot/by car.** A point inside a
   building collider is unreachable even though teleport-based tests pass.
   Probe every mission point against `city.colliders` before shipping.
4. **Headless fps is ~0.3–1.0 and dt is clamped to 0.05**, so real time is
   ~20× game time: key presses shorter than a frame never register, and
   timers (hold 8 s, race 100 s) never elapse in real time. Drive game time
   with a `tick()` hook in tests; test real keys with multi-second holds.
5. **The judge sees screenshots first.** A feature that is real but not
   visible in any screenshot (helicopter above the camera) scores nothing.
   Stage the chase shot so Air One + its searchlight are in frame.
6. **Roadblocks need a timer reset on clear**, or a second heat wave
   cannot set a new one for 20 s.

## 6. Recording / submission — READ THIS BEFORE SUBMITTING

- Recording `01a1f2a3-a246-70bc-b678-fb90f6ea5888` is **still running**
  (log `~/.makefun/record-gta6-01-v6.log`). I did NOT stop it: sealing
  needs the usage file, and usage rows are only written when this run
  finishes. Parent steps: (1) run the muse.db usage SELECT for agent
  `253ba91f-c3af-4501-b200-7c480d1632d8` and write the rows unchanged to
  `~/.makefun/muse-usage-gta6-01.jsonl`; (2) stop the recording
  (kill the record process) and wait for "recording … sealed";
  (3) submit with **both** recordings — v5's build session AND this v6
  session (per the skill: an improvement-only bundle credits only the
  changed lines and can fall below the 30% floor).
- **⚠️ Session-timing caveat (important):** this builder session began
  ~14:07 +07, BEFORE the recording started (~14:15). The kit warns, and
  its help repeats, that "a session begun before the recording started
  fails transcripts_witnessed". I started the recording myself because
  the brief told me to, but the correct order is record-first, then
  spawn the builder. The site-side gate is the only verdict — if it
  fails, the fix is to keep this recording running, spawn a FRESH
  builder subagent under it (session begun after the recording), and
  have that session rewrite the entry files under recording, then seal
  and submit with the fresh session (+ v5's session). Do NOT just submit
  and hope: a failed gate rejects the entry outright.
- **Submit via repo URL, not source bundle.** This repo was created with
  plain `git init` (no `makefun init` drand-anchor first commit). For a
  repo-URL submission the check uses GitHub's creation time (2026-11-19,
  after the 2026-11-17 opening) — fine. For a source bundle the site
  wants the anchor in history. Adding an anchor commit now would postdate
  the build and risks `thinking_fresh`; prefer repo URL:
  `--repo-url https://github.com/HALCYON1803/gta6-01-v6 --commit ca4faec`
  (verify the sha is still HEAD at submit time — the repo must not gain
  new commits after the submission sha is chosen).
- Suggested title: `Sunset Bay: 8 story jobs, Air One & roadblocks — open-world crime` (leaderboard titles of the top 10 all list the feature set).
- v5 repo had NO git remote — there was no "same repo" to push to. v6
  has its own repo (above); the v5 directory was never modified.
- Do NOT delete `out/` recursively — `main.ts` only clears its children,
  as in v5. No fees were paid, no keys bought, no wallet touched.
