// Wanted level and the Sunset Bay PD: patrol cars spawn at the map edge,
// chase the player, ram the player's car, and run the player down on foot.
// At 3 stars the PD throws up roadblocks ahead of the player, and at
// 4 stars Air One (the police helicopter, see heli.js) joins the chase.
import { CFG } from './config.js';
import { createCar, damageCar } from './vehicles.js';

// Wrap an angle difference into (-PI, PI] so a cop turns the short way.
function wrapAngle(dh) {
  while (dh > Math.PI) dh -= Math.PI * 2;
  while (dh < -Math.PI) dh += Math.PI * 2;
  return dh;
}

export function createPolice(world) {
  const api = {
    wanted: 0,
    hiddenTimer: 0,
    spawnTimer: 0,
    cops: [],
    roadblocks: [],
    roadblockTimer: 0,
    addWanted(n, reason) {
      const before = this.wanted;
      this.wanted = Math.max(0, Math.min(CFG.maxWanted, this.wanted + n));
      this.hiddenTimer = 0;
      if (this.wanted > before) {
        world.hud.setStars(this.wanted);
        if (this.wanted >= 1) world.audio.startSiren();
        world.missions.onCrime();
      }
    },
    loseWanted(n) {
      this.wanted = Math.max(0, this.wanted - n);
      world.hud.setStars(this.wanted);
      if (this.wanted === 0) {
        world.audio.stopSiren();
        for (const cop of this.cops) cop.giveUp = true;
        this.clearRoadblocks();
      }
    },
    spawnCop() {
      const p = world.player.pos;
      const angle = Math.random() * Math.PI * 2;
      const x = Math.max(-CFG.worldHalf + 8, Math.min(CFG.worldHalf - 8, p.x + Math.sin(angle) * CFG.policeSpawnDistance));
      const z = Math.max(-CFG.worldHalf + 8, Math.min(CFG.worldHalf - 8, p.z + Math.cos(angle) * CFG.policeSpawnDistance));
      const car = createCar(world, { x, z, heading: Math.atan2(p.x - x, p.z - z), police: true, parked: false, seed: 900 + this.cops.length });
      car.driver = 'police';
      car.cruiseSpeed = 26;
      const cop = { car, giveUp: false, onFoot: false, ramCooldown: 0 };
      this.cops.push(cop);
      return cop;
    },
    // Two patrol cars parked sideways across the road ahead of the player.
    spawnRoadblock() {
      const p = world.player.inCar ? world.player.inCar.mesh.position : world.player.pos;
      const heading = world.player.inCar ? world.player.inCar.heading : world.player.heading;
      const fx = Math.sin(heading);
      const fz = Math.cos(heading);
      const rx = Math.cos(heading);
      const rz = -Math.sin(heading);
      for (const side of [-3.2, 3.2]) {
        const car = createCar(world, {
          x: p.x + fx * 46 + rx * side,
          z: p.z + fz * 46 + rz * side,
          heading: heading + Math.PI / 2,
          police: true, parked: true, seed: 700 + this.roadblocks.length,
        });
        car.driver = 'police';
        this.roadblocks.push(car);
      }
      world.toast('Roadblock ahead! The PD sealed the street.');
    },
    clearRoadblocks() {
      for (const car of this.roadblocks) {
        if (car.dead) continue;
        world.scene.remove(car.mesh);
        const i = world.cars.indexOf(car);
        if (i >= 0) world.cars.splice(i, 1);
      }
      this.roadblocks = [];
      // A fresh heat should be able to set a new roadblock right away.
      this.roadblockTimer = 0;
    },
    // One pursuit car, one frame: steer toward the player, close in, and
    // ram when close enough (with a cooldown so it is not a stunlock).
    chaseStep(cop, dt) {
      if (cop.car.dead || cop.giveUp) return;
      cop.ramCooldown -= dt;
      const car = cop.car;
      const p = world.player;
      const tx = p.inCar ? p.inCar.mesh.position.x : p.pos.x;
      const tz = p.inCar ? p.inCar.mesh.position.z : p.pos.z;
      const dx = tx - car.mesh.position.x;
      const dz = tz - car.mesh.position.z;
      const dist = Math.hypot(dx, dz);
      const wantHeading = Math.atan2(dx, dz);
      const dh = wrapAngle(wantHeading - car.heading);
      car.heading += Math.max(-2.4 * dt, Math.min(2.4 * dt, dh));
      const targetSpeed = Math.min(30, 16 + this.wanted * 3);
      car.speed += (targetSpeed - car.speed) * Math.min(1, dt * 1.4);
      const nx = car.mesh.position.x + Math.sin(car.heading) * car.speed * dt;
      const nz = car.mesh.position.z + Math.cos(car.heading) * car.speed * dt;
      car.mesh.position.x = Math.max(-CFG.worldHalf, Math.min(CFG.worldHalf, nx));
      car.mesh.position.z = Math.max(-CFG.worldHalf, Math.min(CFG.worldHalf, nz));
      car.mesh.rotation.y = car.heading;
      for (const w of car.mesh.userData.wheels) w.rotation.x += car.speed * dt * 2.4;
      if (car.mesh.userData.lightBar) {
        car.mesh.userData.lightBar.material.color.setHex(Math.floor(performance.now() / 300) % 2 ? 0xff2222 : 0x2244ff);
      }
      if (dist < 3.4 && cop.ramCooldown <= 0) {
        cop.ramCooldown = 1.2;
        world.audio.crash();
        if (p.inCar) {
          damageCar(world, p.inCar, CFG.policeRamDamage);
          world.damagePlayer(6, 'ram');
          p.inCar.speed *= 0.5;
          car.speed *= 0.4;
        } else {
          world.damagePlayer(14, 'ram');
        }
      }
    },
    update(dt) {
      // Air One follows the heat level, roadblocks follow it too.
      if (world.heli) world.heli.update(dt);
      if (this.wanted === 0) {
        // Heat fades while hidden; cops that gave up drive off.
        for (const cop of this.cops) {
          if (cop.car.dead) continue;
          const dx = cop.car.mesh.position.x - world.player.pos.x;
          const dz = cop.car.mesh.position.z - world.player.pos.z;
          cop.car.heading = Math.atan2(dx, dz);
          cop.car.speed = Math.min(cop.car.speed + 8 * dt, 18);
          cop.car.mesh.position.x += Math.sin(cop.car.heading) * cop.car.speed * dt;
          cop.car.mesh.position.z += Math.cos(cop.car.heading) * cop.car.speed * dt;
          cop.car.mesh.rotation.y = cop.car.heading;
        }
        this.cops = this.cops.filter((c) => {
          const d = Math.hypot(c.car.mesh.position.x - world.player.pos.x, c.car.mesh.position.z - world.player.pos.z);
          if (d > 260 || c.car.dead) {
            if (!c.car.dead) {
              world.scene.remove(c.car.mesh);
              const i = world.cars.indexOf(c.car);
              if (i >= 0) world.cars.splice(i, 1);
            }
            return false;
          }
          return true;
        });
        return;
      }
      // Spawn enough pursuit cars for the star level (1 car per star, max 3).
      const wantCount = Math.min(3, this.wanted);
      this.spawnTimer -= dt;
      if (this.cops.filter((c) => !c.car.dead).length < wantCount && this.spawnTimer <= 0) {
        this.spawnCop();
        this.spawnTimer = 2.5;
      }
      // Roadblocks at 3+ stars: refresh one ahead of the player every 20 s,
      // and drop it once the player smashes past it.
      this.roadblockTimer -= dt;
      if (this.wanted >= CFG.roadblockWanted && this.roadblockTimer <= 0) {
        const p = world.player.inCar ? world.player.inCar.mesh.position : world.player.pos;
        const stale = this.roadblocks.length === 0 || this.roadblocks.every((c) =>
          c.dead || Math.hypot(c.mesh.position.x - p.x, c.mesh.position.z - p.z) > 90);
        if (stale) {
          this.clearRoadblocks();
          this.spawnRoadblock();
        }
        this.roadblockTimer = 20;
      }
      // If the player is far from every cop, the heat slowly cools — unless
      // Air One is overhead: the helicopter never loses sight of you.
      const nearest = this.cops.reduce((m, c) => Math.min(m, Math.hypot(c.car.mesh.position.x - world.player.pos.x, c.car.mesh.position.z - world.player.pos.z)), 1e9);
      const heliWatching = world.heli && world.heli.active;
      if (nearest > 90 && !heliWatching) {
        this.hiddenTimer += dt;
        if (this.hiddenTimer > CFG.wantedDecaySeconds) {
          this.hiddenTimer = 0;
          this.loseWanted(1);
          world.toast('Heat cooling off… −1 ★');
        }
      } else {
        this.hiddenTimer = 0;
      }
      for (const cop of this.cops) this.chaseStep(cop, dt);
      this.cops = this.cops.filter((c) => !c.car.dead);
    },
  };
  return api;
}
