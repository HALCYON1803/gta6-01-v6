// Sunset Bay v6 — main loop, screen state machine, and the shared world object.
// 8 story missions, 4 weapons, 3 radio stations, garage upgrades (engine /
// armor / NOS), respect ranks, police helicopter + roadblocks, traffic that
// pulls over for sirens — one open-world crime game, offline, in the browser.
import * as THREE from 'three';
import { CFG, MISSION_DEFS, WEAPON_ORDER } from './config.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { buildCity } from './city.js';
import { createRenderer } from './render.js';
import { spawnTraffic, updateTraffic } from './traffic.js';
import { spawnPeds, updatePeds, scarePeds } from './pedestrians.js';
import { createPlayer, updatePlayerOnFoot, nearestCar, enterCar, exitCar } from './player.js';
import { createPolice } from './police.js';
import { createHeli } from './heli.js';
import { createCombat } from './combat.js';
import { createMissions } from './missions.js';
import { createHud } from './hud.js';
import { createRadio } from './radio.js';
import { createGarage, nearGarage } from './garage.js';
import { loadSave, writeSave, applySave } from './save.js';
import { applyShotPreset } from './shots.js';
import { driveCar } from './vehicles.js';

const canvas = document.getElementById('game-canvas');
const renderer = createRenderer(canvas);
const world = {
  scene: renderer.scene,
  camera: renderer.camera,
  renderer: renderer.renderer,
  camState: renderer.camState,
  input: createInput(canvas),
  audio: createAudio(),
  cars: [],
  traffic: [],
  peds: [],
  effects: [],
  stats: { bestWanted: 0, carsStolen: 0 },
  state: 'title',
  pausedFrom: null,
};

world.city = buildCity(world.scene);
world.player = createPlayer(world);
world.hud = createHud(world);
world.police = createPolice(world);
world.heli = createHeli(world);
world.combat = createCombat(world);
world.missions = createMissions(world);
world.radio = createRadio(world);
world.garage = createGarage(world);
spawnTraffic(world);
spawnPeds(world);

// ---- World-level actions used by the subsystems ---------------------------
world.toast = (msg) => world.hud.toast(msg);
world.addWanted = (n, reason) => {
  world.stats.bestWanted = Math.max(world.stats.bestWanted, world.police.wanted + n);
  world.police.addWanted(n, reason);
};
world.damagePlayer = (amount, cause) => {
  if (world.state !== 'play') return;
  const p = world.player;
  p.health = Math.max(0, p.health - amount);
  world.hud.setHealth(p.health);
  if (p.health <= 0) endGame(world.police.wanted > 0 ? 'busted' : 'wasted', cause);
};
world.knockPed = (ped) => {
  ped.down = true;
  ped.fade = 0;
  world.addWanted(1, 'Hit and run');
  world.toast('Pedestrian hit — the cops noticed (+1 ★)');
};
world.killPed = (ped, cause) => {
  ped.down = true;
  ped.fade = 0;
  void cause;
};
world.scaredAt = (x, z, r) => scarePeds(world, x, z, r);
world.saveGame = () => writeSave(world);
world.missionTargetPos = () => world.missions.targetPos();

// ---- Screens ---------------------------------------------------------------
const menuEl = document.getElementById('menu');
const menuStory = document.getElementById('menu-story');
const endText = document.getElementById('end-text');
const btnPlay = document.getElementById('btn-play');
const btnContinue = document.getElementById('btn-continue');
const saveInfo = document.getElementById('menu-save-info');
let savedData = loadSave();

function showMenu(mode, titleHtml, storyHtml) {
  menuEl.classList.remove('hidden');
  document.querySelector('#menu-card h1').innerHTML = titleHtml;
  menuStory.innerHTML = storyHtml;
  endText.textContent = '';
  btnPlay.textContent = mode === 'title' ? '▶ PLAY' : mode === 'paused' ? '▶ RESUME' : '↻ PLAY AGAIN';
  btnContinue.classList.toggle('hidden', !(mode === 'title' && savedData));
  if (mode === 'title' && savedData) {
    const doneCount = Object.values(savedData.missionsDone || {}).filter(Boolean).length;
    saveInfo.textContent = `Saved game found — $${savedData.money} · ${doneCount} mission(s) done · ${savedData.respect || 0} respect`;
  } else saveInfo.textContent = '';
  world.input.releaseLock();
}

function hideMenu() {
  menuEl.classList.add('hidden');
  world.input.requestLock();
}

// Clear every cop, roadblock and the helicopter so a fresh run starts clean.
function clearHeat() {
  world.police.wanted = 0;
  world.police.hiddenTimer = 0;
  world.police.clearRoadblocks();
  world.heli.reset();
  for (const cop of world.police.cops) {
    if (!cop.car.dead) {
      world.scene.remove(cop.car.mesh);
      const i = world.cars.indexOf(cop.car);
      if (i >= 0) world.cars.splice(i, 1);
    }
  }
  world.police.cops = [];
  world.audio.stopSiren();
}

function startGame(fromSave) {
  world.audio.unlock();
  world.audio.click();
  world.garage.hide();
  if (fromSave && savedData) applySave(world, savedData);
  world.player.health = CFG.playerHealth;
  clearHeat();
  world.hud.setStars(0);
  world.hud.setHealth(world.player.health);
  world.hud.setMoney(world.player.money);
  world.hud.setRespect(world.player.respect);
  world.hud.setAmmo(world.combat.ammo, false);
  world.hud.setRadio(world.radio.label());
  world.state = 'play';
  world.hud.showHud();
  hideMenu();
  if (!world.missions.active && !Object.values(world.missions.done).some(Boolean)) {
    world.missions.start(0);
  } else if (!world.missions.active) {
    world.hud.setMission('', 'Press N for your next job', '');
  }
}

function endGame(kind, cause) {
  world.state = kind;
  world.audio.stopEngine();
  world.audio.stopSiren();
  world.hud.hideHud();
  world.input.releaseLock();
  const title = kind === 'busted' ? 'BUSTED' : 'WASTED';
  const story = kind === 'busted'
    ? 'The Sunset Bay PD caught up with you. Rico Marlowe is going back to the harbor lockup… unless you try again.'
    : 'Rico Marlowe is down. The Bay keeps moving without you — but the story is not over yet.';
  showMenu(kind, `<span id="end-title" style="color:${kind === 'busted' ? '#6fb7ff' : '#ff5a5a'}">${title}</span>`, story + ` <i>(${cause})</i>`);
  world.saveGame();
}

function pauseGame() {
  if (world.state !== 'play') return;
  world.state = 'paused';
  world.audio.stopEngine();
  world.hud.hideHud();
  showMenu('paused', 'PAUSED', 'Take a breath, Rico. The Bay will wait — the cops might not.');
}

btnPlay.addEventListener('click', () => {
  if (world.state === 'paused') { world.state = 'play'; hideMenu(); world.hud.showHud(); return; }
  startGame(false);
});
btnContinue.addEventListener('click', () => startGame(true));
document.addEventListener('visibilitychange', () => {
  if (document.hidden && world.state === 'play') pauseGame();
});

// ---- Input edges -----------------------------------------------------------
const prevKeys = new Set();
function edge(code) {
  const down = world.input.pressed(code);
  const was = prevKeys.has(code);
  if (down && !was) prevKeys.add(code);
  if (!down) prevKeys.delete(code);
  return down && !was;
}

// ---- Effects ----------------------------------------------------------------
function updateEffects(dt) {
  for (let i = world.effects.length - 1; i >= 0; i--) {
    const fx = world.effects[i];
    fx.life -= dt;
    if (fx.kind === 'fireball') fx.mesh.scale.multiplyScalar(1 + dt * 2);
    if (fx.kind === 'smoke') {
      fx.mesh.position.y += dt * 1.5;
      fx.mesh.material.opacity = Math.max(0, fx.life / 1.6 * 0.7);
    }
    if (fx.kind === 'tracer' || fx.kind === 'spark') fx.mesh.material.opacity = Math.max(0, fx.life / 0.12);
    if (fx.life <= 0) {
      world.scene.remove(fx.mesh);
      if (fx.mesh.geometry) fx.mesh.geometry.dispose();
      if (fx.mesh.material) fx.mesh.material.dispose();
      world.effects.splice(i, 1);
    }
  }
}

// ---- Main loop ---------------------------------------------------------------
const clock = new THREE.Clock();
let hudTimer = 0;

// One-shot keys while playing: pause, mute, next job, reload, radio,
// garage, horn, weapon select, and E to enter / exit a car.
function handlePlayKeys() {
  if (edge('KeyP')) pauseGame();
  if (edge('KeyM')) {
    world.audio.setMuted(!world.audio.isMuted());
    world.radio.setMuted(world.audio.isMuted());
    world.toast(world.audio.isMuted() ? 'Sound muted (M)' : 'Sound on (M)');
  }
  if (edge('KeyN')) world.missions.nextMission();
  if (edge('KeyR')) world.combat.startReload();
  if (edge('KeyQ')) world.radio.next();
  if (edge('KeyG')) world.garage.toggle();
  if (edge('KeyH')) world.audio.horn();
  for (let i = 0; i < WEAPON_ORDER.length; i++) {
    if (edge(`Digit${i + 1}`)) world.combat.selectWeapon(WEAPON_ORDER[i]);
  }
  if (edge('KeyE')) {
    if (world.player.inCar) exitCar(world);
    else {
      const car = nearestCar(world, 4.5);
      if (car) {
        enterCar(world, car);
        world.stats.carsStolen += 1;
      }
    }
  }
  if (world.input.consumeClick() && !world.player.inCar) world.combat.tryShoot();
  else if (world.input.mouseDown && !world.player.inCar && world.combat.weaponDef().auto) world.combat.tryShoot();
}

// Context hint under the crosshair: stealable car, or the garage nearby.
function refreshHint() {
  if (!world.player.inCar) {
    const car = nearestCar(world, 4.5);
    if (car) world.hud.setHint('Press E to steal the car');
    else if (nearGarage(world)) world.hud.setHint('Sunset Garage — press G for upgrades');
    else world.hud.setHint('');
  } else if (nearGarage(world)) world.hud.setHint('Sunset Garage — press G for upgrades');
  else world.hud.setHint('');
}

// Car-vs-ped collisions: a fast car knocks peds down.
function checkCarPedHits() {
  for (const car of world.cars) {
    if (car.dead || Math.abs(car.speed) < 5) continue;
    for (const ped of world.peds) {
      if (!ped.alive || ped.down) continue;
      const d = Math.hypot(car.mesh.position.x - ped.pos.x, car.mesh.position.z - ped.pos.z);
      if (d < 2.0) {
        world.knockPed(ped);
        if (car.isPlayerCar) world.audio.crash();
      }
    }
  }
}

function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 0.05);
  const input = world.input;
  const mouse = input.consumeMouse();

  if (world.state === 'play') {
    handlePlayKeys();
    // Driving vs walking.
    if (world.player.inCar) {
      driveCar(world, world.player.inCar, input, dt);
      world.audio.startEngine(Math.abs(world.player.inCar.speed) / CFG.carTopSpeed);
      const car = world.player.inCar;
      world.hud.setSpeed(Math.abs(car.speed) * 3.6, true, world.player.upgrades.nos ? car.nosMeter : undefined, car.nosBurning);
    } else {
      const yaw = renderer.updateCamera(world.player.pos, dt, mouse.dx, mouse.dy);
      updatePlayerOnFoot(world, dt, yaw);
      world.audio.stopEngine();
      world.hud.setSpeed(0, false);
    }
    if (world.player.inCar) {
      renderer.updateCamera(world.player.inCar.mesh.position, dt, mouse.dx, mouse.dy);
    }
    updateTraffic(world, dt);
    updatePeds(world, dt);
    world.police.update(dt);
    world.combat.update(dt);
    world.missions.update(dt);
    checkCarPedHits();
    refreshHint();
    hudTimer -= dt;
    if (hudTimer <= 0) {
      hudTimer = 0.12;
      world.hud.drawMinimap();
      world.hud.setHealth(world.player.health);
      world.hud.setMoney(world.player.money);
    }
  } else if (world.state === 'title') {
    // Slow cinematic orbit over downtown behind the title screen.
    const t = performance.now() / 1000;
    const cx = Math.sin(t * 0.05) * 60;
    const cz = Math.cos(t * 0.05) * 60;
    renderer.camera.position.set(cx, 55, cz);
    renderer.camera.lookAt(0, 10, 0);
    updateTraffic(world, dt);
    updatePeds(world, dt);
  } else if (world.state === 'paused' || world.state === 'busted' || world.state === 'wasted') {
    // Frozen world behind the menu; keep traffic drifting for life.
    updateTraffic(world, dt * 0.2);
  }
  updateEffects(dt);
  renderer.renderer.render(world.scene, world.camera);
}

// ---- Boot --------------------------------------------------------------------
document.getElementById('loading').remove();
const TITLE_STORY = 'You are <b>Rico Marlowe</b>, a wheelman fresh out of the harbor lockup. The Bay is yours again — sun, surf, fast cars and faster trouble. Run 8 story jobs, dodge the Sunset Bay PD (and Air One), tune your ride at the Sunset Garage, and take back the harbor from the rival crew that set you up.';
const shot = new URLSearchParams(location.search).get('shot');
if (shot) {
  const mode = applyShotPreset(world, shot);
  if (mode === 'play') {
    world.hud.showHud();
    world.hud.setHealth(world.player.health);
    world.hud.setMoney(world.player.money);
    world.hud.setRespect(world.player.respect);
    world.hud.setAmmo(world.combat.ammo, false);
    world.hud.setRadio(world.radio.label());
    if (shot === 'mission') world.hud.setMission('Corner Store Job', 'Robbing the till — stay put!', '');
  } else {
    showMenu('title', 'SUNSET BAY', TITLE_STORY);
  }
} else {
  showMenu('title', 'SUNSET BAY', TITLE_STORY);
}
// Expose a small handle for automated playtests (read-only state + actions).
window.__sunsetBay = {
  world,
  state: () => world.state,
  player: () => ({ x: world.player.pos.x, z: world.player.pos.z, health: world.player.health, money: world.player.money, respect: world.player.respect, inCar: !!world.player.inCar, upgrades: { ...world.player.upgrades } }),
  wanted: () => world.police.wanted,
  missions: () => ({ active: world.missions.active, current: world.missions.current, step: world.missions.step, done: { ...world.missions.done }, defs: MISSION_DEFS.map((d) => d.id) }),
  radio: () => world.radio.label(),
  heli: () => world.heli.active,
  roadblocks: () => world.police.roadblocks.filter((c) => !c.dead).length,
  cops: () => world.police.cops.filter((c) => !c.car.dead).length,
  weapon: () => world.combat.weapon,
  start: () => startGame(false),
  startMission: (i) => world.missions.start(i),
  setHealth: (h) => { world.player.health = h; world.hud.setHealth(h); },
  setMoney: (m) => { world.player.money = m; world.hud.setMoney(m); },
  setWanted: (n) => world.police.addWanted(n, 'playtest'),
  clearWanted: () => { world.police.wanted = 0; world.police.loseWanted(0); },
  teleport: (x, z) => { if (world.player.inCar) { world.player.inCar.mesh.position.set(x, 0, z); } else world.player.pos.set(x, 0, z); },
  // Deterministic test actions: advance the simulation by N game-seconds
  // without waiting on the render loop (headless swiftshader runs ~1 fps,
  // and the loop clamps dt to 0.05, so real time is 20x game time there).
  tick: (seconds) => {
    const steps = Math.ceil(seconds / 0.05);
    for (let i = 0; i < steps; i++) {
      updateTraffic(world, 0.05);
      updatePeds(world, 0.05);
      world.police.update(0.05);
      world.combat.update(0.05);
      world.missions.update(0.05);
      updateEffects(0.05);
    }
    return true;
  },
  // Drive the player's car forward for N game-seconds (optionally with NOS).
  driveFor: (seconds, nos) => {
    const car = world.player.inCar;
    if (!car) return false;
    const fakeInput = { pressed: (c) => c === 'KeyW' || c === 'ArrowUp' || (!!nos && (c === 'ShiftLeft' || c === 'ShiftRight')) };
    const steps = Math.ceil(seconds / 0.05);
    for (let i = 0; i < steps; i++) driveCar(world, car, fakeInput, 0.05);
    return car.speed;
  },
  enterNearestCar: () => {
    const car = nearestCar(world, 4.5);
    if (!car) return false;
    enterCar(world, car);
    return true;
  },
  exitCar: () => { exitCar(world); return true; },
  buyUpgrade: (id) => world.garage.buy(id),
  selectWeapon: (id) => world.combat.selectWeapon(id),
  nextRadio: () => world.radio.next(),
};
frame();
