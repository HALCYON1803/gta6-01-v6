// Pedestrians: they stroll the sidewalks, flee from gunfire and crashes,
// and go down when the player runs them over (which the cops notice).
import * as THREE from 'three';
import { CFG } from './config.js';
import { makeRng, range, pick } from './random.js';
import { resolveCircle } from './city.js';

const SHIRTS = [0xd23b3b, 0x2e6fd8, 0xe8c33a, 0x3aa655, 0xe8e8e8, 0xd86a1e, 0x7a4fd0, 0x4fc3d0, 0xff8ab0];

export function makePedMesh(rng) {
  const g = new THREE.Group();
  const shirt = new THREE.MeshLambertMaterial({ color: pick(rng, SHIRTS) });
  const skin = new THREE.MeshLambertMaterial({ color: 0xd9a986 });
  const pants = new THREE.MeshLambertMaterial({ color: 0x2b2b2b });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 0.7, 4, 8), shirt);
  body.position.y = 1.0;
  body.castShadow = true;
  g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 8), skin);
  head.position.y = 1.72;
  g.add(head);
  const legs = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, 0.55, 8), pants);
  legs.position.y = 0.3;
  g.add(legs);
  return g;
}

export function spawnPeds(world) {
  const rng = makeRng(777);
  world.peds = [];
  for (let i = 0; i < CFG.pedCount; i++) {
    const mesh = makePedMesh(rng);
    const street = pick(rng, world.city.streets);
    const side = (rng() < 0.5 ? -1 : 1) * range(rng, 8, 11);
    const along = range(rng, -195, 195);
    const vertical = rng() < 0.5;
    mesh.position.set(vertical ? street + side : along, 0, vertical ? along : street + side);
    world.scene.add(mesh);
    world.peds.push({
      mesh,
      pos: mesh.position,
      heading: range(rng, 0, Math.PI * 2),
      speed: range(rng, 1.0, 2.2),
      alive: true,
      down: false,
      fade: 0,
      scared: 0,
      scaredX: 0,
      scaredZ: 0,
    });
  }
}

export function scarePeds(world, x, z, radius) {
  for (const ped of world.peds) {
    if (!ped.alive || ped.down) continue;
    const d = Math.hypot(ped.pos.x - x, ped.pos.z - z);
    if (d < radius) {
      ped.scared = 2.5;
      ped.scaredX = x;
      ped.scaredZ = z;
    }
  }
}

// One ped, one frame. A downed ped sinks and tips over, then gets back
// up somewhere else after a while; a scared ped sprints away from the
// scare point; everyone else wanders the sidewalk and bounces off the
// map edge.
function stepPed(world, ped, dt) {
  if (!ped.alive) return;
  if (ped.down) {
    ped.fade += dt;
    ped.mesh.position.y = -Math.min(1, ped.fade) * 0.6;
    ped.mesh.rotation.z = Math.min(1, ped.fade * 2) * 1.4;
    if (ped.fade > 6) {
      ped.down = false;
      ped.fade = 0;
      ped.mesh.position.y = 0;
      ped.mesh.rotation.z = 0;
      ped.mesh.position.x = range(Math.random, -180, 180);
      ped.mesh.position.z = range(Math.random, -180, 180);
    }
    return;
  }
  let speed = ped.speed;
  let heading = ped.heading;
  if (ped.scared > 0) {
    ped.scared -= dt;
    heading = Math.atan2(ped.pos.x - ped.scaredX, ped.pos.z - ped.scaredZ);
    speed = 5.5;
    ped.heading = heading;
  }
  ped.pos.x += Math.sin(heading) * speed * dt;
  ped.pos.z += Math.cos(heading) * speed * dt;
  ped.mesh.rotation.y = heading;
  if (Math.abs(ped.pos.x) > 200 || Math.abs(ped.pos.z) > 200) ped.heading += Math.PI;
  if (Math.random() < dt * 0.15) ped.heading += (Math.random() - 0.5) * 1.2;
  resolveCircle(world.city.colliders, ped.pos, 0.5);
}

export function updatePeds(world, dt) {
  for (const ped of world.peds) stepPed(world, ped, dt);
}
