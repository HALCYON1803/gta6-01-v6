// Sunset Bay city: ground, streets, sidewalks, towers, palms, beach and sea.
// Returns the colliders (building AABBs) and the street network for traffic.
// v6 adds the Sunset Garage, the Corner Store and the gun shop as real,
// collidable places, plus neon signs on the downtown towers.
import * as THREE from 'three';
import { CFG, STREET_COORDS, PLACES } from './config.js';
import { makeRng, range, pick } from './random.js';

const TOWER_COLORS = [0x8a7f8d, 0x6f7f95, 0x9a8a6f, 0x7a6a8a, 0x5f7a8a, 0xb09a7a];
const NEON_COLORS = [0xff4fd8, 0x37e6ff, 0xffd94a, 0x7cff5e, 0xff7a3c];

export function buildCity(scene) {
  const rng = makeRng(20261119);
  const colliders = [];
  const half = CFG.worldHalf;

  // Land, beach strip and sea to the east.
  const land = new THREE.Mesh(
    new THREE.PlaneGeometry(half * 2 + 60, half * 2 + 60),
    new THREE.MeshLambertMaterial({ color: 0x5a6a55 })
  );
  land.rotation.x = -Math.PI / 2;
  land.position.set(0, -0.05, 0);
  land.receiveShadow = true;
  scene.add(land);
  const beach = new THREE.Mesh(
    new THREE.PlaneGeometry(46, half * 2 + 60),
    new THREE.MeshLambertMaterial({ color: 0xd9c08a })
  );
  beach.rotation.x = -Math.PI / 2;
  beach.position.set(half + 23, -0.02, 0);
  beach.receiveShadow = true;
  scene.add(beach);
  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(220, half * 2 + 400),
    new THREE.MeshLambertMaterial({ color: 0x2f7fb8 })
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(half + 156, -0.12, 0);
  scene.add(sea);

  // Streets: dark ribbons on the grid, with pale sidewalks beside them.
  const roadMat = new THREE.MeshLambertMaterial({ color: 0x3a3f47 });
  const walkMat = new THREE.MeshLambertMaterial({ color: 0x9a9a92 });
  for (const s of STREET_COORDS) {
    const vRoad = new THREE.Mesh(new THREE.PlaneGeometry(CFG.roadWidth, half * 2), roadMat);
    vRoad.rotation.x = -Math.PI / 2;
    vRoad.position.set(s, 0, 0);
    vRoad.receiveShadow = true;
    scene.add(vRoad);
    const hRoad = new THREE.Mesh(new THREE.PlaneGeometry(half * 2, CFG.roadWidth), roadMat);
    hRoad.rotation.x = -Math.PI / 2;
    hRoad.position.set(0, 0, s);
    hRoad.receiveShadow = true;
    scene.add(hRoad);
    for (const off of [-CFG.roadWidth / 2 - 2, CFG.roadWidth / 2 + 2]) {
      const vWalk = new THREE.Mesh(new THREE.PlaneGeometry(4, half * 2), walkMat);
      vWalk.rotation.x = -Math.PI / 2;
      vWalk.position.set(s + off, 0.01, 0);
      scene.add(vWalk);
      const hWalk = new THREE.Mesh(new THREE.PlaneGeometry(half * 2, 4), walkMat);
      hWalk.rotation.x = -Math.PI / 2;
      hWalk.position.set(0, 0.01, s + off);
      scene.add(hWalk);
    }
  }

  // One tower per block, skipping the blocks that hold the named places.
  const placeBlocks = [
    [PLACES.garage.x, PLACES.garage.z], [PLACES.store.x, PLACES.store.z],
    [PLACES.gunshop.x, PLACES.gunshop.z], [PLACES.hideout.x, PLACES.hideout.z],
  ];
  const blockCenters = [];
  for (let i = 0; i < STREET_COORDS.length - 1; i++) {
    for (let j = 0; j < STREET_COORDS.length - 1; j++) {
      blockCenters.push([(STREET_COORDS[i] + STREET_COORDS[i + 1]) / 2, (STREET_COORDS[j] + STREET_COORDS[j + 1]) / 2]);
    }
  }
  for (const [cx, cz] of blockCenters) {
    if (placeBlocks.some(([px, pz]) => Math.abs(px - cx) < 31 && Math.abs(pz - cz) < 31)) continue;
    if (rng() < 0.12) continue; // some blocks stay open plazas / parking
    const w = range(rng, 16, 30);
    const d = range(rng, 16, 30);
    const h = range(rng, 10, 46);
    const tower = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      new THREE.MeshLambertMaterial({ color: pick(rng, TOWER_COLORS) })
    );
    tower.position.set(cx, h / 2, cz);
    tower.castShadow = true;
    tower.receiveShadow = true;
    scene.add(tower);
    // Rooftop neon sign on the tallest downtown towers.
    if (h > 30 && rng() < 0.7) {
      const sign = new THREE.Mesh(
        new THREE.BoxGeometry(Math.min(14, w * 0.7), 1.6, 0.6),
        new THREE.MeshBasicMaterial({ color: pick(rng, NEON_COLORS) })
      );
      sign.position.set(cx, h + 1.2, cz + d / 2 + 0.4);
      scene.add(sign);
    }
    // Lit windows: a few bright quads on the tower faces.
    const winMat = new THREE.MeshBasicMaterial({ color: 0xffd94a });
    const wins = Math.floor(range(rng, 3, 8));
    for (let k = 0; k < wins; k++) {
      const win = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.1), winMat);
      win.position.set(cx - w / 2 + range(rng, 2, w - 2), range(rng, 3, h - 2), cz + d / 2 + 0.06);
      scene.add(win);
    }
    colliders.push({ minX: cx - w / 2 - 0.4, maxX: cx + w / 2 + 0.4, minZ: cz - d / 2 - 0.4, maxZ: cz + d / 2 + 0.4 });
  }

  // Named places: garage, corner store, gun shop — low buildings with a
  // colored roof so the player can spot them from the street.
  function placeBuilding(p, w, d, h, color, roofColor) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshLambertMaterial({ color }));
    b.position.set(p.x, h / 2, p.z);
    b.castShadow = true;
    scene.add(b);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(w + 1, 0.7, d + 1), new THREE.MeshLambertMaterial({ color: roofColor }));
    roof.position.set(p.x, h + 0.35, p.z);
    scene.add(roof);
    const sign = new THREE.Mesh(
      new THREE.BoxGeometry(Math.min(12, w * 0.8), 1.8, 0.6),
      new THREE.MeshBasicMaterial({ color: roofColor })
    );
    sign.position.set(p.x, h + 1.6, p.z + d / 2 + 0.4);
    scene.add(sign);
    colliders.push({ minX: p.x - w / 2 - 0.4, maxX: p.x + w / 2 + 0.4, minZ: p.z - d / 2 - 0.4, maxZ: p.z + d / 2 + 0.4 });
  }
  placeBuilding(PLACES.garage, 26, 18, 7, 0x4a5a6a, 0x37e6ff);
  placeBuilding(PLACES.store, 20, 14, 6, 0x8a5a3a, 0xffd94a);
  placeBuilding(PLACES.gunshop, 20, 14, 6, 0x3a4a3a, 0xff4fd8);

  // Palm trees along the beach and scattered through the plazas.
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x7a5a3a });
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x3a8a4a });
  for (let i = 0; i < 46; i++) {
    const x = i < 22 ? half + 8 + range(rng, 0, 26) : range(rng, -190, 190);
    const z = i < 22 ? range(rng, -200, 200) : pick(rng, STREET_COORDS) + range(rng, 10, 26) * (rng() < 0.5 ? 1 : -1);
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.34, 5.5, 6), trunkMat);
    trunk.position.set(x, 2.75, z);
    trunk.castShadow = true;
    scene.add(trunk);
    const crown = new THREE.Mesh(new THREE.ConeGeometry(2.4, 2.2, 7), leafMat);
    crown.position.set(x, 6.4, z);
    scene.add(crown);
    colliders.push({ minX: x - 0.6, maxX: x + 0.6, minZ: z - 0.6, maxZ: z + 0.6 });
  }

  // The pier reaching into the sea at the hideout corner.
  const pier = new THREE.Mesh(new THREE.BoxGeometry(60, 1.2, 8), new THREE.MeshLambertMaterial({ color: 0x8a6a4a }));
  pier.position.set(half + 30, 0.4, 168);
  pier.castShadow = true;
  scene.add(pier);

  return { colliders, streets: STREET_COORDS.slice() };
}

export function collideCircle(colliders, x, z, r) {
  for (const c of colliders) {
    if (x + r > c.minX && x - r < c.maxX && z + r > c.minZ && z - r < c.maxZ) return c;
  }
  return null;
}

export function resolveCircle(colliders, pos, r) {
  const c = collideCircle(colliders, pos.x, pos.z, r);
  if (!c) return;
  const pushL = (pos.x + r) - c.minX;
  const pushR = c.maxX - (pos.x - r);
  const pushU = (pos.z + r) - c.minZ;
  const pushD = c.maxZ - (pos.z - r);
  const m = Math.min(pushL, pushR, pushU, pushD);
  if (m === pushL) pos.x = c.minX - r;
  else if (m === pushR) pos.x = c.maxX + r;
  else if (m === pushU) pos.z = c.minZ - r;
  else pos.z = c.maxZ + r;
}
