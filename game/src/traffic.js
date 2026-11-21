// AI traffic: cars cruise along street lines, keep their lane, slow for the
// car ahead and pause briefly at intersections. When the police are in
// pursuit nearby, traffic pulls over — sirens clear the road, like a real city.
import { CFG } from './config.js';
import { makeRng, range, pick } from './random.js';
import { createCar } from './vehicles.js';
import { collideCircle } from './city.js';

export function spawnTraffic(world) {
  const rng = makeRng(4242);
  world.traffic = [];
  for (let i = 0; i < CFG.trafficCount; i++) {
    const vertical = rng() < 0.5;
    const street = pick(rng, world.city.streets);
    const lane = (rng() < 0.5 ? -1 : 1) * 3;
    const along = range(rng, -190, 190);
    const car = createCar(world, {
      x: vertical ? street + lane : along,
      z: vertical ? along : street + lane,
      heading: vertical ? (lane > 0 ? 0 : Math.PI) : (lane > 0 ? Math.PI / 2 : -Math.PI / 2),
      parked: false,
      seed: 100 + i,
    });
    car.driver = 'ai';
    car.cruiseSpeed = range(rng, 9, 14);
    car.vertical = vertical;
    car.street = street;
    car.lane = lane;
    world.traffic.push(car);
  }
  // Parked cars the player can steal, lined up along a few streets.
  const spots = [
    [62, -118], [62, -58], [-58, 122], [122, 58], [-122, -58],
    [58, 182], [-182, 62], [182, -122], [-62, -182], [118, -62],
  ];
  spots.forEach(([x, z], i) => {
    const car = createCar(world, { x, z, heading: (i % 2 ? Math.PI / 2 : 0) + (i % 3) * 0.1, parked: true, seed: 500 + i });
    car.driver = null;
  });
}

// Send a car that reached the map edge back in on a fresh street.
function respawnAtEdge(world, car) {
  const rng = makeRng((Math.random() * 1e9) | 0);
  const vertical = rng() < 0.5;
  const street = pick(rng, world.city.streets);
  const lane = (rng() < 0.5 ? -1 : 1) * 3;
  const edge = -CFG.worldHalf + 12;
  car.mesh.position.set(vertical ? street + lane : edge, 0, vertical ? edge : street + lane);
  car.heading = vertical ? 0 : Math.PI / 2;
  car.vertical = vertical;
  car.street = street;
  car.lane = lane;
  car.speed = car.cruiseSpeed;
}

// How fast this car wants to go: full cruise speed, unless a car is right
// ahead in the same lane, a chase is passing, or an intersection is near.
function wantedSpeed(world, car, chaseOn) {
  let targetSpeed = car.cruiseSpeed;
  for (const other of world.cars) {
    if (other === car || other.dead) continue;
    const dx = other.mesh.position.x - car.mesh.position.x;
    const dz = other.mesh.position.z - car.mesh.position.z;
    const ahead = car.vertical ? dz * Math.cos(car.heading) : dx * Math.sin(car.heading);
    const side = car.vertical ? Math.abs(dx) : Math.abs(dz);
    if (ahead > 0 && ahead < 12 && side < 3.5) { targetSpeed = 0; break; }
    if (ahead > 0 && ahead < 22 && side < 3.5) targetSpeed = Math.min(targetSpeed, 4);
  }
  // Sirens nearby: pull over and wait for the chase to pass.
  if (chaseOn) {
    const nearCop = world.police.cops.some((c) => !c.car.dead &&
      Math.hypot(c.car.mesh.position.x - car.mesh.position.x, c.car.mesh.position.z - car.mesh.position.z) < 38);
    if (nearCop) targetSpeed = 0;
  }
  // Near an intersection, ease off a little.
  const along = car.vertical ? car.mesh.position.z : car.mesh.position.x;
  const nearCross = world.city.streets.some((s) => Math.abs(along - s) < 9 && Math.abs(along - s) > 2);
  if (nearCross && Math.random() < 0.5) targetSpeed = Math.min(targetSpeed, 5);
  return targetSpeed;
}

function stepTrafficCar(world, car, dt, chaseOn) {
  if (car.dead) return;
  const targetSpeed = wantedSpeed(world, car, chaseOn);
  car.speed += (targetSpeed - car.speed) * Math.min(1, dt * 1.6);
  const nx = car.mesh.position.x + Math.sin(car.heading) * car.speed * dt;
  const nz = car.mesh.position.z + Math.cos(car.heading) * car.speed * dt;
  if (Math.abs(nx) > CFG.worldHalf - 6 || Math.abs(nz) > CFG.worldHalf - 6) {
    respawnAtEdge(world, car);
    return;
  }
  if (!collideCircle(world.city.colliders, nx, nz, 1.6)) {
    car.mesh.position.x = nx;
    car.mesh.position.z = nz;
  } else {
    car.speed = 0;
  }
  car.mesh.rotation.y = car.heading;
  for (const w of car.mesh.userData.wheels) w.rotation.x += car.speed * dt * 2.4;
  if (car.smokeTimer > 0) car.smokeTimer -= dt;
}

export function updateTraffic(world, dt) {
  const chaseOn = world.police.wanted >= 2;
  for (const car of world.traffic) stepTrafficCar(world, car, dt, chaseOn);
}

// Traffic AI notes: cruise speeds are per-car (9–14), cars wrap to a fresh
// street at the map edge, and the pull-over check above runs against the
// live police list, so a chase genuinely empties the road ahead of the player.
