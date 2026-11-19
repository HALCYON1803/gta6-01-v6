// Cars: box-built bodies with cylinder wheels, arcade driving, damage and smoke.
// v6: engine upgrades raise the top speed, NOS burns a boost meter on Shift,
// armor cuts damage to the player's car. The gold coupe is the export target.
import * as THREE from 'three';
import { CFG } from './config.js';
import { makeRng, pick } from './random.js';
import { collideCircle } from './city.js';

const PAINTS = [0xd23b3b, 0x2e6fd8, 0xe8c33a, 0x3aa655, 0xe8e8e8, 0x222222, 0xd86a1e, 0x7a4fd0, 0x4fc3d0];

export function makeCarMesh(color, isPolice) {
  const g = new THREE.Group();
  const paint = new THREE.MeshLambertMaterial({ color: isPolice ? 0x1c2f4a : color });
  const glass = new THREE.MeshLambertMaterial({ color: 0x18242e });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.62, 4.4), paint);
  body.position.y = 0.55;
  body.castShadow = true;
  g.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.55, 2.2), glass);
  cabin.position.set(0, 1.1, -0.2);
  cabin.castShadow = true;
  g.add(cabin);
  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.3, 12);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
  const wheels = [];
  for (const [wx, wz] of [[-0.95, 1.45], [0.95, 1.45], [-0.95, -1.45], [0.95, -1.45]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(wx, 0.36, wz);
    g.add(w);
    wheels.push(w);
  }
  if (isPolice) {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.02, 0.2, 4.42), new THREE.MeshLambertMaterial({ color: 0xffffff }));
    stripe.position.y = 0.62;
    g.add(stripe);
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.16, 0.5), new THREE.MeshLambertMaterial({ color: 0xff2222 }));
    bar.position.set(0, 1.45, -0.2);
    g.add(bar);
    g.userData.lightBar = bar;
  }
  const head = new THREE.PointLight(0xfff2c0, 0, 18);
  head.position.set(0, 0.8, 2.4);
  g.add(head);
  g.userData.wheels = wheels;
  g.userData.headlight = head;
  return g;
}

export function createCar(world, opts) {
  const rng = makeRng((opts.seed || 7) * 7919 + 13);
  const isPolice = !!opts.police;
  const mesh = makeCarMesh(opts.color || pick(rng, PAINTS), isPolice);
  mesh.position.set(opts.x || 0, 0, opts.z || 0);
  mesh.rotation.y = opts.heading || 0;
  // Make the car raycastable immediately: a fresh mesh keeps an identity
  // matrixWorld until the next render, and at ~1 fps headless that is
  // seconds away — shots at a just-spawned car would pass through it.
  mesh.updateMatrixWorld(true);
  world.scene.add(mesh);
  const car = {
    mesh,
    isPolice,
    isPlayerCar: false,
    heading: opts.heading || 0,
    speed: 0,
    health: CFG.carHealth,
    smokeTimer: 0,
    dead: false,
    parked: opts.parked !== false,
    driver: opts.driver || null,   // 'player' | 'ai' | 'police' | null
    steer: 0,
    color: opts.color || 0,
    nosMeter: 100,
    nosBurning: false,
  };
  world.cars.push(car);
  return car;
}

export function explodeCar(world, car) {
  if (car.dead) return;
  car.dead = true;
  world.audio.explosion();
  const pos = car.mesh.position;
  const fire = new THREE.Mesh(
    new THREE.SphereGeometry(3.2, 12, 10),
    new THREE.MeshBasicMaterial({ color: 0xff7722, transparent: true, opacity: 0.95 })
  );
  fire.position.copy(pos).y = 1.2;
  world.scene.add(fire);
  world.effects.push({ mesh: fire, life: 0.7, kind: 'fireball' });
  const smoke = new THREE.Mesh(
    new THREE.SphereGeometry(2.4, 10, 8),
    new THREE.MeshBasicMaterial({ color: 0x333333, transparent: true, opacity: 0.7 })
  );
  smoke.position.copy(pos).y = 2.5;
  world.scene.add(smoke);
  world.effects.push({ mesh: smoke, life: 1.6, kind: 'smoke' });
  const hurt = (targetPos) => {
    const d = Math.hypot(targetPos.x - pos.x, targetPos.z - pos.z);
    if (d < CFG.carExplosionRadius) return CFG.carExplosionDamage * (1 - d / CFG.carExplosionRadius);
    return 0;
  };
  const pd = hurt(world.player.pos);
  if (pd > 0) world.damagePlayer(pd, 'explosion');
  for (const other of world.cars) {
    if (other === car || other.dead) continue;
    const d = hurt(other.mesh.position);
    if (d > 0) damageCar(world, other, d);
  }
  for (const ped of world.peds) {
    if (!ped.alive) continue;
    const d = hurt(ped.pos);
    if (d > 0) world.killPed(ped, 'explosion');
  }
  setTimeout(() => {
    world.scene.remove(car.mesh);
    const i = world.cars.indexOf(car);
    if (i >= 0) world.cars.splice(i, 1);
  }, 900);
}

export function damageCar(world, car, amount) {
  if (car.dead) return;
  // Armor upgrade: the player's car shrugs off a share of every hit.
  if (car.isPlayerCar && world.player.upgrades.armor) amount *= CFG.armorDamageFactor;
  car.health -= amount;
  if (car.health <= 35 && car.smokeTimer <= 0) {
    car.smokeTimer = 0.4;
    const puff = new THREE.Mesh(
      new THREE.SphereGeometry(1.1, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0x555555, transparent: true, opacity: 0.55 })
    );
    puff.position.copy(car.mesh.position).y = 1.6;
    world.scene.add(puff);
    world.effects.push({ mesh: puff, life: 1.1, kind: 'smoke' });
  }
  if (car.health <= 0) explodeCar(world, car);
}

// Arcade drive step for the player's car (and police cars, which reuse it).
export function driveCar(world, car, input, dt) {
  if (car.dead) return;
  const fwd = input.pressed('KeyW') || input.pressed('ArrowUp');
  const back = input.pressed('KeyS') || input.pressed('ArrowDown');
  const left = input.pressed('KeyA') || input.pressed('ArrowLeft');
  const right = input.pressed('KeyD') || input.pressed('ArrowRight');
  const handbrake = input.pressed('Space');
  const upgrades = world.player.upgrades;
  const topSpeed = CFG.carTopSpeed + (upgrades.engine ? CFG.engineTopSpeedBonus : 0);
  const accel = CFG.carAccel + (upgrades.engine ? CFG.engineAccelBonus : 0);
  // NOS: hold Shift while driving to burn the meter for a burst of speed.
  const wantNos = upgrades.nos && car.isPlayerCar && (input.pressed('ShiftLeft') || input.pressed('ShiftRight')) && car.nosMeter > 0 && car.speed > 4;
  car.nosBurning = !!wantNos;
  if (wantNos) car.nosMeter = Math.max(0, car.nosMeter - CFG.nosDrain * dt);
  else car.nosMeter = Math.min(100, car.nosMeter + CFG.nosRegen * dt);
  const speedCap = topSpeed + (wantNos ? CFG.nosBoost : 0);
  const dir = car.speed >= 0 ? 1 : -1;
  if (fwd) car.speed += accel * dt;
  if (back) car.speed -= (car.speed > 0.5 ? CFG.carBrake : CFG.carAccel * 0.7) * dt;
  if (handbrake) car.speed -= Math.sign(car.speed) * CFG.carBrake * 1.4 * dt;
  if (!fwd && !back) car.speed -= Math.sign(car.speed) * 6 * dt;
  if (Math.abs(car.speed) < 0.15 && !fwd && !back) car.speed = 0;
  car.speed = Math.max(-CFG.carReverseSpeed, Math.min(speedCap, car.speed));
  const steerTarget = (left ? 1 : 0) - (right ? 1 : 0);
  car.steer += (steerTarget - car.steer) * Math.min(1, dt * 8);
  car.heading += car.steer * 1.9 * dt * dir * Math.min(1, Math.abs(car.speed) / 6);
  const nx = car.mesh.position.x + Math.sin(car.heading) * car.speed * dt;
  const nz = car.mesh.position.z + Math.cos(car.heading) * car.speed * dt;
  const hit = collideCircle(world.city.colliders, nx, nz, 1.6);
  if (hit) {
    if (Math.abs(car.speed) > 8) {
      world.audio.crash();
      damageCar(world, car, Math.abs(car.speed) * 1.2);
      if (car.isPlayerCar) world.damagePlayer(Math.abs(car.speed) * 0.4, 'crash');
    }
    car.speed *= -0.25;
  } else {
    car.mesh.position.x = nx;
    car.mesh.position.z = nz;
  }
  car.mesh.position.x = Math.max(-CFG.worldHalf, Math.min(CFG.worldHalf, car.mesh.position.x));
  car.mesh.position.z = Math.max(-CFG.worldHalf, Math.min(CFG.worldHalf, car.mesh.position.z));
  car.mesh.rotation.y = car.heading;
  const spin = car.speed * dt * 2.4;
  for (const w of car.mesh.userData.wheels) w.rotation.x += spin;
  car.mesh.rotation.z = -car.steer * 0.04 * Math.min(1, Math.abs(car.speed) / 10);
  if (car.isPolice && car.mesh.userData.lightBar) {
    car.mesh.userData.lightBar.material.color.setHex(Math.floor(performance.now() / 300) % 2 ? 0xff2222 : 0x2244ff);
  }
  if (car.smokeTimer > 0) car.smokeTimer -= dt;
}
