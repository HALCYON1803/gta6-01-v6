// Save / load: money, respect, finished missions, garage upgrades, weapon
// and the best stats, in localStorage. This build uses a v2 key so old
// saves do not load half a garage into the new build.
const KEY = 'sunset-bay-save-v2';

export function loadSave() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object') return null;
    return data;
  } catch (_) { return null; }
}

export function writeSave(world) {
  try {
    const data = {
      money: world.player.money,
      respect: world.player.respect,
      missionsDone: world.missions.done,
      upgrades: world.player.upgrades,
      weapon: world.combat.weapon,
      savedAt: Date.now(),
      bestWanted: world.stats.bestWanted,
      carsStolen: world.stats.carsStolen,
    };
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch (_) { /* storage may be unavailable in some contexts */ }
}

// Loading is defensive on purpose: a save only ever fills in fields the
// game already knows, and only with values of the right type — a corrupt
// or hand-edited save can never invent a mission or an upgrade.
export function applySave(world, data) {
  if (!data) return;
  if (typeof data.money === 'number') world.player.money = data.money;
  if (typeof data.respect === 'number') world.player.respect = data.respect;
  if (data.missionsDone) {
    for (const k of Object.keys(data.missionsDone)) {
      if (k in world.missions.done) world.missions.done[k] = !!data.missionsDone[k];
    }
  }
  if (data.upgrades) {
    for (const k of Object.keys(data.upgrades)) {
      if (k in world.player.upgrades) world.player.upgrades[k] = !!data.upgrades[k];
    }
  }
  if (typeof data.bestWanted === 'number') world.stats.bestWanted = data.bestWanted;
  if (typeof data.carsStolen === 'number') world.stats.carsStolen = data.carsStolen;
  if (typeof data.weapon === 'string' && world.combat.selectWeapon) {
    world.combat.selectWeapon(data.weapon);
  }
  world.hud.setMoney(world.player.money);
  world.hud.setRespect(world.player.respect);
}
