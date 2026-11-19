// The player on foot: third-person WASD movement, jump, and stealing cars.
// The player also carries the persistent state: garage upgrades, respect
// and the current weapon live here, not in the save file's shape alone.
import * as THREE from 'three';
import { CFG } from './config.js';
import { resolveCircle } from './city.js';

export function makePlayerMesh() {
  const g = new THREE.Group();
  const jacket = new THREE.MeshLambertMaterial({ color: 0x274b8f });
  const skin = new THREE.MeshLambertMaterial({ color: 0xd9a986 });
  const pants = new THREE.MeshLambertMaterial({ color: 0x2b2b2b });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.34, 0.8, 4, 10), jacket);
  body.position.y = 1.08;
  body.castShadow = true;
  g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.27, 12, 10), skin);
  head.position.y = 1.85;
  head.castShadow = true;
  g.add(head);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.29, 0.1, 12), new THREE.MeshLambertMaterial({ color: 0xffc93a }));
  cap.position.y = 2.05;
  g.add(cap);
  const legs = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.36, 0.6, 8), pants);
  legs.position.y = 0.34;
  g.add(legs);
  // A little pistol in the right hand, visible when aiming. Combat reads
  // it back through userData.gun to place the muzzle flash and the ray.
  const gun = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 0.42), new THREE.MeshLambertMaterial({ color: 0x1a1a1a }));
  gun.position.set(0.42, 1.15, 0.3);
  g.add(gun);
  g.userData.gun = gun;
  return g;
}

export function createPlayer(world) {
  const mesh = makePlayerMesh();
  mesh.position.set(0, 0, 20);
  world.scene.add(mesh);
  return {
    mesh,
    pos: mesh.position,
    heading: Math.PI,
    velY: 0,
    grounded: true,
    health: CFG.playerHealth,
    money: CFG.startMoney,
    respect: 0,
    upgrades: { engine: false, armor: false, nos: false },
    inCar: null,
    walkBob: 0,
    stepTimer: 0,
  };
}

// Find the nearest stealable car within reach of the player.
export function nearestCar(world, maxDist) {
  let best = null;
  let bestD = maxDist;
  for (const car of world.cars) {
    if (car.dead || car.driver === 'player') continue;
    const d = Math.hypot(car.mesh.position.x - world.player.pos.x, car.mesh.position.z - world.player.pos.z);
    if (d < bestD) { bestD = d; best = car; }
  }
  return best;
}

export function enterCar(world, car) {
  const p = world.player;
  if (car.driver === 'ai') {
    // Hijack a moving car: its driver bails out as a pedestrian.
    const i = world.traffic.indexOf(car);
    if (i >= 0) world.traffic.splice(i, 1);
  }
  car.driver = 'player';
  car.isPlayerCar = true;
  car.parked = false;
  p.inCar = car;
  p.mesh.visible = false;
  world.audio.startEngine(0);
  world.addWanted(1, 'Grand theft auto');
  world.toast('Car stolen — the cops noticed (+1 ★)');
  // The export mission watches for its own marked car.
  if (world.missions.onEnterCar) world.missions.onEnterCar(car);
}

export function exitCar(world) {
  const p = world.player;
  const car = p.inCar;
  if (!car) return;
  car.driver = null;
  car.isPlayerCar = false;
  car.speed = 0;
  p.inCar = null;
  p.mesh.visible = true;
  const side = car.heading + Math.PI / 2;
  p.pos.set(car.mesh.position.x + Math.sin(side) * 2.2, 0, car.mesh.position.z + Math.cos(side) * 2.2);
  world.audio.stopEngine();
}

// WASD relative to the camera yaw, Shift to sprint, Space to jump.
// Movement is clamped to the map and pushed out of building colliders;
// sprinting into a pedestrian hard enough knocks them down (a crime!).
export function updatePlayerOnFoot(world, dt, camYaw) {
  const p = world.player;
  const input = world.input;
  const fwd = (input.pressed('KeyW') || input.pressed('ArrowUp') ? 1 : 0) - (input.pressed('KeyS') || input.pressed('ArrowDown') ? 1 : 0);
  const strafe = (input.pressed('KeyD') || input.pressed('ArrowRight') ? 1 : 0) - (input.pressed('KeyA') || input.pressed('ArrowLeft') ? 1 : 0);
  const sprint = input.pressed('ShiftLeft') || input.pressed('ShiftRight');
  const speed = sprint ? CFG.playerRunSpeed : CFG.playerWalkSpeed;
  const mx = Math.sin(camYaw) * fwd + Math.cos(camYaw) * strafe;
  const mz = Math.cos(camYaw) * fwd - Math.sin(camYaw) * strafe;
  const len = Math.hypot(mx, mz);
  if (len > 0.01) {
    p.pos.x += (mx / len) * speed * dt;
    p.pos.z += (mz / len) * speed * dt;
    p.heading = Math.atan2(mx, mz);
    p.walkBob += dt * (sprint ? 13 : 9);
    p.mesh.position.y = Math.abs(Math.sin(p.walkBob)) * 0.07;
    p.mesh.rotation.z = Math.sin(p.walkBob) * 0.05;
  } else {
    p.mesh.position.y = 0;
    p.mesh.rotation.z = 0;
  }
  p.mesh.rotation.y = p.heading;
  stepJump(p, input, dt);
  p.pos.x = Math.max(-CFG.worldHalf, Math.min(CFG.worldHalf, p.pos.x));
  p.pos.z = Math.max(-CFG.worldHalf, Math.min(CFG.worldHalf, p.pos.z));
  resolveCircle(world.city.colliders, p.pos, 0.55);
  checkPedBumps(world, p, len, speed);
}

// Jump on Space, then gravity until the feet touch the ground again.
function stepJump(p, input, dt) {
  if (input.pressed('Space') && p.grounded) {
    p.velY = CFG.playerJump;
    p.grounded = false;
  }
  if (!p.grounded) {
    p.velY -= CFG.gravity * dt;
    p.pos.y += p.velY * dt;
    if (p.pos.y <= 0) { p.pos.y = 0; p.velY = 0; p.grounded = true; }
  }
}

// Run into a pedestrian hard enough and they go down.
function checkPedBumps(world, p, moveLen, speed) {
  for (const ped of world.peds) {
    if (!ped.alive || ped.down) continue;
    const d = Math.hypot(ped.pos.x - p.pos.x, ped.pos.z - p.pos.z);
    if (d < 0.9 && moveLen > 0.01 && speed > 9) {
      world.knockPed(ped);
    }
  }
}
