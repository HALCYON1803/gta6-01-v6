// Combat: four weapons on keys 1-4 (Pistol, SMG, Shotgun, Rifle), hitscan
// raycast, muzzle flash, tracer, ammo, reload, and damage to peds, cops
// and cars. The shotgun fires a spread of pellets per trigger pull.
//
// Aim note: the shot ray leaves the gun flat, in the camera's yaw
// direction — a ray cast from the camera through the player dives into
// the ground and never hits anything past ~6 m, which is how v5's
// shooting was silently broken at range.
import * as THREE from 'three';
import { CFG, WEAPONS, WEAPON_ORDER } from './config.js';
import { damageCar } from './vehicles.js';

export function createCombat(world) {
  const raycaster = new THREE.Raycaster();
  const flash = new THREE.PointLight(0xffc866, 0, 14);
  world.scene.add(flash);
  const mags = {};
  for (const id of WEAPON_ORDER) mags[id] = WEAPONS[id].mag;

  // Every mesh a bullet can hit right now: living peds and live cars.
  function collectTargets() {
    const found = [];
    for (const ped of world.peds) {
      if (ped.alive && !ped.down) found.push({ mesh: ped.mesh, kind: 'ped', ref: ped });
    }
    for (const car of world.cars) {
      if (!car.dead) found.push({ mesh: car.mesh, kind: 'car', ref: car });
    }
    return found;
  }

  function showSpark(point) {
    const spark = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0xffe9a0 })
    );
    spark.position.copy(point);
    world.scene.add(spark);
    world.effects.push({ mesh: spark, life: 0.12, kind: 'spark' });
  }

  const api = {
    weapon: 'pistol',
    ammo: WEAPONS.pistol.mag,
    reserve: Infinity,
    cooldown: 0,
    reloadTimer: 0,
    reloading: false,
    weaponDef() { return WEAPONS[this.weapon]; },
    update(dt) {
      this.cooldown = Math.max(0, this.cooldown - dt);
      if (this.reloading) {
        this.reloadTimer -= dt;
        if (this.reloadTimer <= 0) {
          this.reloading = false;
          const def = this.weaponDef();
          this.ammo = def.mag;
          mags[this.weapon] = this.ammo;
          world.audio.reload();
          world.hud.setAmmo(this.ammo, false);
        }
      }
      flash.intensity = Math.max(0, flash.intensity - dt * 220);
    },
    selectWeapon(id) {
      if (!WEAPONS[id] || id === this.weapon) return false;
      if (this.reloading) this.reloading = false;
      this.weapon = id;
      this.ammo = mags[id];
      world.audio.blip();
      world.hud.setAmmo(this.ammo, false);
      world.toast(`${WEAPONS[id].name} ready — ${this.ammo} in the mag`);
      return true;
    },
    startReload() {
      const def = this.weaponDef();
      if (this.reloading || this.ammo === def.mag) return;
      this.reloading = true;
      this.reloadTimer = def.reload;
      world.hud.setAmmo(this.ammo, true);
    },
    tryShoot() {
      if (this.cooldown > 0 || this.reloading || world.state !== 'play') return;
      if (this.ammo <= 0) { this.startReload(); return; }
      const def = this.weaponDef();
      this.cooldown = def.fireDelay;
      this.ammo -= 1;
      mags[this.weapon] = this.ammo;
      world.audio.shoot();
      // Muzzle flash at the gun.
      const gunWorld = new THREE.Vector3();
      world.player.mesh.userData.gun.getWorldPosition(gunWorld);
      flash.position.copy(gunWorld);
      flash.intensity = 60;
      const yaw = world.camState.yaw;
      const baseDir = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
      const up = new THREE.Vector3(0, 1, 0);
      const targets = collectTargets();
      const meshes = targets.map((t) => t.mesh);
      let endPoint = null;
      for (let pellet = 0; pellet < def.pellets; pellet++) {
        const dir = baseDir.clone().applyAxisAngle(up, (Math.random() - 0.5) * def.spread * 2);
        dir.y = (Math.random() - 0.5) * def.spread;
        dir.normalize();
        raycaster.set(gunWorld, dir);
        raycaster.far = def.range;
        const hits = raycaster.intersectObjects(meshes, true);
        if (hits.length > 0) {
          const hit = hits[0];
          if (!endPoint) endPoint = hit.point.clone();
          let obj = hit.object;
          while (obj.parent && obj.parent !== world.scene) obj = obj.parent;
          const target = targets.find((t) => t.mesh === obj);
          if (target) this.applyHit(target, hit.point, def.damage);
        } else if (!endPoint) {
          endPoint = gunWorld.clone().add(dir.clone().multiplyScalar(def.range));
        }
      }
      // Tracer line from gun to impact.
      const tracerMat = new THREE.LineBasicMaterial({ color: 0xffe9a0, transparent: true, opacity: 0.9 });
      const tracerGeo = new THREE.BufferGeometry().setFromPoints([gunWorld, endPoint]);
      const tracer = new THREE.Line(tracerGeo, tracerMat);
      world.scene.add(tracer);
      world.effects.push({ mesh: tracer, life: 0.08, kind: 'tracer' });
      // Scare nearby pedestrians — gunfire is loud.
      world.scaredAt(gunWorld.x, gunWorld.z, 40);
      world.hud.setAmmo(this.ammo, this.reloading);
      if (this.ammo === 0) this.startReload();
    },
    applyHit(target, point, damage) {
      if (target.kind === 'ped') {
        world.killPed(target.ref, 'shot');
        world.addWanted(1, 'Assault');
        world.toast('Pedestrian down — the cops noticed (+1 ★)');
      } else if (target.kind === 'car') {
        const car = target.ref;
        damageCar(world, car, damage);
        if (car.isPolice || car.driver === 'police') {
          world.addWanted(1, 'Shot at police');
        } else {
          world.addWanted(1, 'Firing in public');
        }
      }
      showSpark(point);
    },
  };
  return api;
}
