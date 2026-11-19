// Sunset Bay v6 — every tunable number lives here so balancing is one edit away.
// v6 adds: 8 story missions, 4 weapons, 3 radio stations, garage upgrades
// (engine / armor / NOS), respect ranks, police helicopter + roadblocks.
export const CFG = {
  worldHalf: 210,            // playable square is [-210, 210] on both axes
  blockSize: 60,             // distance between street centrelines
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
  wantedDecaySeconds: 14,    // seconds hidden before one star drops
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
  // Garage upgrades: price + what they change.
  upgradePrices: { engine: 800, armor: 600, nos: 500 },
  engineTopSpeedBonus: 9,
  engineAccelBonus: 5,
  armorDamageFactor: 0.55,   // player car takes 55% damage with armor
  nosBoost: 14,              // extra top speed while NOS burns
  nosDrain: 34,              // meter per second while burning
  nosRegen: 9,               // meter per second while idle
  heliWanted: 4,             // Air One joins the chase at this heat
  roadblockWanted: 3,        // roadblocks appear at this heat
};

// Four weapons on keys 1-4. Spread is in radians, pellets fire per shot.
export const WEAPONS = {
  pistol:  { name: 'Pistol',  damage: 34, fireDelay: 0.22, mag: 12, reload: 1.1, range: 120, spread: 0.012, pellets: 1, auto: false },
  smg:     { name: 'SMG',     damage: 16, fireDelay: 0.09, mag: 30, reload: 1.4, range: 95,  spread: 0.045, pellets: 1, auto: true },
  shotgun: { name: 'Shotgun', damage: 18, fireDelay: 0.85, mag: 6,  reload: 1.9, range: 55,  spread: 0.11,  pellets: 5, auto: false },
  rifle:   { name: 'Rifle',   damage: 55, fireDelay: 0.32, mag: 20, reload: 1.6, range: 170, spread: 0.004, pellets: 1, auto: false },
};
export const WEAPON_ORDER = ['pistol', 'smg', 'shotgun', 'rifle'];

// Three in-car radio stations, all synthesized live by radio.js.
export const RADIO_STATIONS = [
  { id: 'bayfm',    name: 'BAY FM 87.9',  tag: 'Sunset Drive', bpm: 96,  root: 110, mode: 'minor' },
  { id: 'neon',     name: 'NEON 101.5',   tag: 'Night Cruise', bpm: 122, root: 130.8, mode: 'minor' },
  { id: 'palmtree', name: 'PALM 94.2',    tag: 'Island Reggae', bpm: 78,  root: 98,  mode: 'major' },
];

// Respect: 100 per finished mission. Ranks show on the HUD and title screen.
export const RESPECT_RANKS = [
  { at: 0,   title: 'Rookie' },
  { at: 100, title: 'Wheelman' },
  { at: 300, title: 'Street Legend' },
  { at: 500, title: 'Bay Boss' },
  { at: 800, title: 'King of the Bay' },
];
export function respectTitle(respect) {
  let title = RESPECT_RANKS[0].title;
  for (const r of RESPECT_RANKS) if (respect >= r.at) title = r.title;
  return title;
}

// Named places the player can find on the map and minimap.
export const PLACES = {
  garage: { x: -180, z: 180, label: 'Sunset Garage — upgrades' },
  gunshop: { x: 180, z: -180, label: 'Gun shop — ammo & armor' },
  store: { x: 60, z: 180, label: 'Corner Store — robbery target' },
  hideout: { x: 168, z: 168, label: 'Hideout — Pier House' },
  docks: { x: -168, z: -168, label: 'Export Docks' },
  harbor: { x: -168, z: -168, label: 'Harbor Yard' },
};

export const STREET_COORDS = [-180, -120, -60, 0, 60, 120, 180];

// Eight story missions. Steps run in order; types:
//   goto      — reach a point (label shown, beacon marks it)
//   timedGoto — reach a point before the step clock runs out
//   hold      — stay inside the zone for `seconds` (robbery)
//   destroy   — destroy `count` rival cars near a point
//   heat      — getaway: raise heat to 3 stars, then lose it (special)
//   steal     — steal the marked export car, then deliver it (special)
export const MISSION_DEFS = [
  {
    id: 'courier',
    name: 'Courier Run',
    intro: 'Deliver the package to 4 drop points, in order. Steal a car — it is faster.',
    steps: [
      { type: 'goto', x: 150, z: -150, label: 'Drop 1 — Marina Gate' },
      { type: 'goto', x: -180, z: -150, label: 'Drop 2 — North Docks' },
      { type: 'goto', x: -150, z: 150, label: 'Drop 3 — Palm Court' },
      { type: 'goto', x: 150, z: 150, label: 'Drop 4 — Sunset Pier' },
    ],
  },
  {
    id: 'getaway',
    name: 'Getaway',
    intro: 'Raise your heat to 3 stars, then lose the cops completely before the clock runs out.',
    steps: [{ type: 'heat', x: 0, z: 0, label: 'Lose the heat — stay unseen' }],
  },
  {
    id: 'harbor',
    name: 'Harbor Takedown',
    intro: 'Destroy the rival crew car at the harbor, then reach the hideout.',
    steps: [
      { type: 'destroy', x: -168, z: -168, count: 1, label: 'Rival car — Harbor Yard' },
      { type: 'goto', x: 168, z: 168, label: 'Hideout — Pier House' },
    ],
  },
  {
    id: 'streetrace',
    name: 'Sunset Grand Prix',
    intro: 'Street race! Hit all 5 gates before the 100 second clock runs out. A car helps a lot.',
    steps: [
      { type: 'timedGoto', x: 120, z: -60, time: 100, label: 'Gate 1 — Marina Straight' },
      { type: 'timedGoto', x: 120, z: 120, time: 100, label: 'Gate 2 — Palm Court' },
      { type: 'timedGoto', x: -60, z: 120, time: 100, label: 'Gate 3 — Bay Bridge' },
      { type: 'timedGoto', x: -120, z: -60, time: 100, label: 'Gate 4 — North Docks' },
      { type: 'timedGoto', x: 0, z: 0, time: 100, label: 'Finish — Downtown' },
    ],
  },
  {
    id: 'taxifare',
    name: 'Cab Hustle',
    intro: 'You borrowed a cab. Pick up 3 fares and drop each one off — tips pay if you are quick.',
    steps: [
      { type: 'goto', x: -60, z: -120, label: 'Pick up fare 1 — North Docks' },
      { type: 'goto', x: 150, z: 60, label: 'Drop fare 1 — Marina Gate' },
      { type: 'goto', x: 60, z: -180, label: 'Pick up fare 2 — Bay Bridge' },
      { type: 'goto', x: -150, z: 150, label: 'Drop fare 2 — Palm Court' },
      { type: 'goto', x: 180, z: 0, label: 'Pick up fare 3 — Sunset Pier' },
      { type: 'goto', x: 0, z: 180, label: 'Drop fare 3 — Pier House' },
    ],
  },
  {
    id: 'robbery',
    name: 'Corner Store Job',
    intro: 'Rob the Corner Store: stand at the counter for 8 seconds. The cops WILL come — then run to the hideout.',
    steps: [
      { type: 'goto', x: 60, z: 170, label: 'Corner Store — get inside' },
      { type: 'hold', x: 60, z: 170, seconds: 8, label: 'Robbing the till — stay put!' },
      { type: 'goto', x: 168, z: 168, label: 'Escape — Hideout, Pier House' },
    ],
  },
  {
    id: 'export',
    name: 'Hot Wheels Export',
    intro: 'A buyer at the docks wants the gold coupe parked by Marina Gate. Steal it and deliver it in 90 seconds.',
    steps: [
      { type: 'steal', x: 150, z: -120, label: 'Steal the gold coupe — Marina Gate' },
      { type: 'timedGoto', x: -168, z: -168, time: 90, label: 'Deliver to the Export Docks' },
    ],
  },
  {
    id: 'showdown',
    name: 'Harbor Showdown',
    intro: 'The rival crew sent three cars to the harbor. Wreck all three, then get to the hideout.',
    steps: [
      { type: 'destroy', x: -168, z: -168, count: 3, label: 'Rival crew — 3 cars at the Harbor' },
      { type: 'goto', x: 168, z: 168, label: 'Hideout — Pier House' },
    ],
  },
];
