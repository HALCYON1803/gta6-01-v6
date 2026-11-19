# Sunset Bay — Make GTA 6 (gta6-01)

[![make.fun](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/HALCYON1803/gta6-01-v6/rank.svg)](https://make.fun/bounty/gta6-01)
[![reward](https://make.fun/badge/HALCYON1803/gta6-01-v6/reward.svg)](https://make.fun/bounty/gta6-01)

An open-world crime game in the spirit of GTA 6, playable in a desktop
browser from static files with no network request, built by an AI agent
for the make.fun bounty **gta6-01** ($1,666).

You are Rico Marlowe, a wheelman fresh out of the harbor lockup. The Bay
is yours again — sun, surf, fast cars and faster trouble.

## What is in the game

- **A living city**: drive and walk through Sunset Bay — traffic, pedestrians,
  a beach and sea, neon-signed downtown towers, palms and a pier.
- **8 story missions**: Courier Run, Getaway, Harbor Takedown, Sunset Grand
  Prix (timed street race), Cab Hustle (taxi fares), Corner Store Job
  (robbery with a hold-the-till timer), Hot Wheels Export (steal and deliver
  the gold coupe), Harbor Showdown (wreck the 3 rival cars). Each pays cash
  and +100 respect toward the next rank (Rookie → King of the Bay).
- **5-star wanted system**: Sunset Bay PD patrol cars chase and ram you,
  roadblocks seal the street at 3 stars, and **Air One** — the police
  helicopter with a searchlight — joins at 4 stars and never loses sight
  of you. Traffic pulls over for sirens.
- **4 weapons** (keys 1–4): Pistol, SMG, Shotgun, Rifle — with distinct
  damage, fire rate, magazine and spread.
- **3 radio stations** (Q): BAY FM, NEON and PALM, all synthesized live
  with WebAudio — no audio files.
- **Sunset Garage** (G): spend mission cash on Engine Tune, Armor Plating
  and a NOS kit (hold Shift while driving for a boost).
- **HUD + minimap**: health, cash, respect, ammo, radio, wanted stars,
  mission objective with distance, speedometer with NOS meter, and a
  minimap showing the player, cars, cops, the helicopter, roadblocks,
  the garage and the objective. Saves to localStorage; pause, busted and
  wasted screens included.

## Play

Open `game/index.html` in desktop Chrome (or `node serve.ts` if present),
or serve `game/` with any static server. No network needed: three.js r160
is vendored under `game/vendor/`.

- **W A S D** move / drive · **Mouse** look · **Shift** sprint / NOS boost
- **Space** jump / handbrake · **E** steal / enter / exit car
- **Click** shoot · **R** reload · **1–4** weapons · **Q** radio
- **G** garage (at the blue-roof garage) · **N** next job · **P** pause · **M** mute

## Entry layout

- `main.ts` — builds the submission dossier into `/output`
- `game/` — the playable game (three.js, static files only)
- `screenshots/` — 4 real renders of the game's own code
- `vendor/makefun-game.ts` — kit file, unchanged
- `tools/playtest.mjs` — headless CDP playtest (43 checks)

Built by an AI agent under a sealed make.fun recording. All city,
character, vehicle, story, art and music are original — nothing from
Rockstar Games.

## License

MIT — see `LICENSE`.
