// Sunset Bay v7 — every number the game balances on, in one place.
// Nothing here is read from anywhere else at runtime: tune the feel of
// the whole Bay by editing this file alone. v7 keeps v6's numbers exactly
// and adds only presentation data: a mission giver per job (name, role,
// one original line), the SBPD dispatch callsign pool, and street names
// for the player's car. The dispatch panel, weapon slots and dialogue box
// all read their text from here, so no HUD string is invented elsewhere.
export const CFG = {
  worldHalf: 210,
  blockSize: 60,
  roadWidth: 12,
  sidewalkWidth: 4,
  playerHealth: 100,
  playerWalkSpeed: 6.5,
  playerRunSpeed: 11,
  playerJump: 8.5,
  gravity: 24,
  startMoney: 500,
  pistolMag: 12,
  pistolDamage: 34,
  pistolRange: 120,
  pistolFireDelay: 0.22,
  pistolReloadTime: 1.1,
  carTopSpeed: 34,
  carAccel: 16,
  carBrake: 30,
  carReverseSpeed: 10,
  carHealth: 100,
  carExplosionDamage: 55,
  carExplosionRadius: 9,
  wantedDecaySeconds: 14,
  maxWanted: 5,
  policeSpawnDistance: 150,
  policeRamDamage: 12,
  pedCount: 26,
  trafficCount: 12,
  missionRewards: {
    courier: 400, getaway: 600, harbor: 900, streetrace: 800,
    taxifare: 750, robbery: 1000, export: 1100, showdown: 1500,
  },
  getawayTimeLimit: 75,
  raceTimeLimit: 100,
  exportTimeLimit: 90,
  robberyHoldSeconds: 8,
  cameraDistance: 8.5,
  cameraHeight: 3.6,
  minimapRange: 120,
  upgradePrices: { engine: 800, armor: 600, nos: 500 },
  engineTopSpeedBonus: 9,
  engineAccelBonus: 5,
  armorDamageFactor: 0.55,
  nosBoost: 14,
  nosDrain: 34,
  nosRegen: 9,
  heliWanted: 4,
  roadblockWanted: 3,
};

// The street grid: centrelines on both axes. The city builder, the
// minimap and the traffic all read this one list.
export const STREET_COORDS = [-180, -120, -60, 0, 60, 120, 180];

// Places with a name on the map. The garage, store and gun shop are also
// real buildings; the docks and hideout are mission anchors.
export const PLACES = {
  garage: { x: -180, z: 180, label: 'Sunset Garage — upgrades' },
  gunshop: { x: 180, z: -180, label: 'Gun shop — ammo & armor' },
  store: { x: 60, z: 180, label: 'Corner Store — robbery target' },
  hideout: { x: 168, z: 168, label: 'Hideout — Pier House' },
  docks: { x: -168, z: -168, label: 'Export Docks' },
  harbor: { x: -168, z: -168, label: 'Harbor Yard' },
};

// One helper per weapon, so the four gun rows read as a table and every
// row carries the same fields in the same order.
function gun(name, damage, fireDelay, mag, reload, range, spread, pellets, auto) {
  return { name, damage, fireDelay, mag, reload, range, spread, pellets, auto };
}

// The four guns, in key order 1-4. `spread` is radians, `pellets` is how
// many rays one trigger pull sends out, `auto` means holding fire works.
export const WEAPONS = {
  pistol: gun('Pistol', 34, 0.22, 12, 1.1, 120, 0.012, 1, false),
  smg: gun('SMG', 16, 0.09, 30, 1.4, 95, 0.045, 1, true),
  shotgun: gun('Shotgun', 18, 0.85, 6, 1.9, 55, 0.11, 5, false),
  rifle: gun('Rifle', 55, 0.32, 20, 1.6, 170, 0.004, 1, false),
};
export const WEAPON_ORDER = ['pistol', 'smg', 'shotgun', 'rifle'];

// Radio stations. The music itself is a WebAudio sequencer in radio.js;
// these rows only say what each station sounds like.
export const RADIO_STATIONS = [
  { id: 'bayfm',    name: 'BAY FM 87.9',  tag: 'Sunset Drive', bpm: 96,  root: 110, mode: 'minor' },
  { id: 'neon',     name: 'NEON 101.5',   tag: 'Night Cruise', bpm: 122, root: 130.8, mode: 'minor' },
  { id: 'palmtree', name: 'PALM 94.2',    tag: 'Island Reggae', bpm: 78,  root: 98,  mode: 'major' },
];

// Respect is +100 per finished job. The title is shown on the HUD and
// on the title screen, and it is also read back by the mission-complete
// toast, so keep the ladder here in one place.
export const RESPECT_RANKS = [
  { at: 0,   title: 'Rookie' },
  { at: 100, title: 'Wheelman' },
  { at: 300, title: 'Street Legend' },
  { at: 500, title: 'Bay Boss' },
  { at: 800, title: 'King of the Bay' },
];
export function respectTitle(respect) {
  let title = RESPECT_RANKS[0].title;
  for (const rung of RESPECT_RANKS) {
    if (respect >= rung.at) title = rung.title;
  }
  return title;
}
// Progress to the next rank, 0..1, for the respect bar on the HUD.
export function respectProgress(respect) {
  for (let i = 0; i < RESPECT_RANKS.length - 1; i++) {
    if (respect < RESPECT_RANKS[i + 1].at) {
      return (respect - RESPECT_RANKS[i].at) / (RESPECT_RANKS[i + 1].at - RESPECT_RANKS[i].at);
    }
  }
  return 1;
}

// SBPD dispatch callsigns: one per pursuit unit, handed out in spawn
// order and cycled when more units arrive than the pool holds. The
// helicopter is always AIR-1. All names are original to Sunset Bay.
export const DISPATCH_CALLSIGNS = [
  'EGRET-6', 'TERN-9', 'MULLET-21', 'SNOOK-14',
  'COBIA-33', 'JACK-27', 'POMPANO-8', 'GROUPER-19',
];
export const HELI_CALLSIGN = 'AIR-1';

// Street names for the player's car, picked by seed in vehicles.js.
// The police cruiser is always the SBPD Interceptor.
export const CAR_MODELS = [
  'Bayside GT', 'Palmetto S', 'Dune Runner',
  'Corso V8', 'Tidewater LX', 'Marina GT',
];

// Step builders: one per step kind, so a mission reads as a short list
// of calls instead of a wall of object literals. The objects they build
// are exactly the step shapes missions.js dispatches on:
//   goto      — walk or drive to a point; the beacon marks it
//   timedGoto — same, but the step clock is running
//   hold      — stay inside the zone for `seconds` (the robbery)
//   destroy   — wreck `count` rival cars near a point
//   heat      — getaway: push the heat to 3 stars, then shake it off
//   steal     — steal the marked car, then deliver it
function goTo(x, z, label) { return { type: 'goto', x, z, label }; }
function goTimed(x, z, time, label) { return { type: 'timedGoto', x, z, time, label }; }
function holdAt(x, z, seconds, label) { return { type: 'hold', x, z, seconds, label }; }
function wreck(x, z, count, label) { return { type: 'destroy', x, z, count, label }; }
function heatStep(x, z, label) { return { type: 'heat', x, z, label }; }
function stealStep(x, z, label) { return { type: 'steal', x, z, label }; }

// The eight story jobs, in the order the N key hands them out. Each job
// has a giver — a named character whose line opens the job in the
// dialogue box. Giver names and lines are original to Sunset Bay.
export const MISSION_DEFS = [
  {
    id: 'courier',
    name: 'Courier Run',
    giver: { name: 'Lena Cross', role: 'Dispatcher', initials: 'LC', line: 'Four drops, in order. No detours, no questions — the Bay pays on time.' },
    intro: 'Deliver the package to 4 drop points, in order. Steal a car — it is faster.',
    steps: [
      goTo(150, -150, 'Drop 1 — Marina Gate'),
      goTo(-180, -150, 'Drop 2 — North Docks'),
      goTo(-150, 150, 'Drop 3 — Palm Court'),
      goTo(150, 150, 'Drop 4 — Sunset Pier'),
    ],
  },
  {
    id: 'getaway',
    name: 'Getaway',
    giver: { name: 'Mara Voss', role: 'Fixer', initials: 'MV', line: 'Get hot enough that the whole Bay sees you — then vanish like you were never there.' },
    intro: 'Raise your heat to 3 stars, then lose the cops completely before the clock runs out.',
    steps: [heatStep(0, 0, 'Lose the heat — stay unseen')],
  },
  {
    id: 'harbor',
    name: 'Harbor Takedown',
    giver: { name: 'Dante Cole', role: 'Harbor Boss', initials: 'DC', line: 'One rival car at the harbor. Wreck it, then come home to the Pier House.' },
    intro: 'Destroy the rival crew car at the harbor, then reach the hideout.',
    steps: [
      wreck(-168, -168, 1, 'Rival car — Harbor Yard'),
      goTo(168, 168, 'Hideout — Pier House'),
    ],
  },
  {
    id: 'streetrace',
    name: 'Sunset Grand Prix',
    giver: { name: 'Kiki Santos', role: 'Race Organizer', initials: 'KS', line: 'Five gates, one hundred seconds. Beat the clock and the Bay is yours.' },
    intro: 'Street race! Hit all 5 gates before the 100 second clock runs out. A car helps a lot.',
    steps: [
      goTimed(120, -60, 100, 'Gate 1 — Marina Straight'),
      goTimed(120, 120, 100, 'Gate 2 — Palm Court'),
      goTimed(-60, 120, 100, 'Gate 3 — Bay Bridge'),
      goTimed(-120, -60, 100, 'Gate 4 — North Docks'),
      goTimed(0, 0, 100, 'Finish — Downtown'),
    ],
  },
  {
    id: 'taxifare',
    name: 'Cab Hustle',
    giver: { name: 'Bea Fontaine', role: 'Diner Owner', initials: 'BF', line: 'Borrowed cab, three fares. Quick drops mean fat tips — drive like you mean it.' },
    intro: 'You borrowed a cab. Pick up 3 fares and drop each one off — tips pay if you are quick.',
    steps: [
      goTo(-60, -120, 'Pick up fare 1 — North Docks'),
      goTo(150, 60, 'Drop fare 1 — Marina Gate'),
      goTo(60, -180, 'Pick up fare 2 — Bay Bridge'),
      goTo(-150, 150, 'Drop fare 2 — Palm Court'),
      goTo(180, 0, 'Pick up fare 3 — Sunset Pier'),
      goTo(0, 180, 'Drop fare 3 — Pier House'),
    ],
  },
  {
    id: 'robbery',
    name: 'Corner Store Job',
    giver: { name: 'Bea Fontaine', role: 'Diner Owner', initials: 'BF', line: 'Eight seconds at the till. The alarm will sing — stay put anyway.' },
    intro: 'Rob the Corner Store: stand at the counter for 8 seconds. The cops WILL come — then run to the hideout.',
    steps: [
      goTo(60, 170, 'Corner Store — get inside'),
      holdAt(60, 170, 8, 'Robbing the till — stay put!'),
      goTo(168, 168, 'Escape — Hideout, Pier House'),
    ],
  },
  {
    id: 'export',
    name: 'Hot Wheels Export',
    giver: { name: 'Gus Ferreira', role: 'Buyer', initials: 'GF', line: 'Gold coupe by Marina Gate. Bring it to my docks in ninety seconds and it is yours to sell.' },
    intro: 'A buyer at the docks wants the gold coupe parked by Marina Gate. Steal it and deliver it in 90 seconds.',
    steps: [
      stealStep(150, -120, 'Steal the gold coupe — Marina Gate'),
      goTimed(-168, -168, 90, 'Deliver to the Export Docks'),
    ],
  },
  {
    id: 'showdown',
    name: 'Harbor Showdown',
    giver: { name: 'Nadia Reyes', role: 'Crew Lieutenant', initials: 'NR', line: 'Three of them at the harbor. Send them all home in smoke.' },
    intro: 'The rival crew sent three cars to the harbor. Wreck all three, then get to the hideout.',
    steps: [
      wreck(-168, -168, 3, 'Rival crew — 3 cars at the Harbor'),
      goTo(168, 168, 'Hideout — Pier House'),
    ],
  },
];
