// Eight story missions with step-by-step objectives, a beacon column, HUD
// distance and cash rewards. Steps run through one small machine:
// goto / timedGoto / hold / destroy / heat / steal — see config.js.
// Missions run one at a time, in order, and can be replayed. Each finished
// mission pays cash and +100 respect toward the next rank.
import * as THREE from 'three';
import { CFG, MISSION_DEFS, respectTitle } from './config.js';
import { createCar } from './vehicles.js';

export function createMissions(world) {
  const beaconMat = new THREE.MeshBasicMaterial({ color: 0xffd94a, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false });
  const beacon = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 60, 12, 1, true), beaconMat);
  beacon.position.y = 30;
  beacon.visible = false;
  world.scene.add(beacon);
  const markerGeo = new THREE.SphereGeometry(1.1, 12, 10);
  const markerMat = new THREE.MeshBasicMaterial({ color: 0xffd94a, transparent: true, opacity: 0.85 });
  const marker = new THREE.Mesh(markerGeo, markerMat);
  marker.visible = false;
  world.scene.add(marker);

  const state = {
    current: 0,            // index into MISSION_DEFS
    step: 0,
    active: false,
    done: { courier: false, getaway: false, harbor: false, streetrace: false, taxifare: false, robbery: false, export: false, showdown: false },
    getawayTimer: 0,
    getawayPeaked: false,
    stepTimer: 0,
    holdTimer: 0,
    holdArmed: false,
    rivalCars: [],
    exportCar: null,
    def() { return MISSION_DEFS[this.current]; },
    stepDef() { return this.def().steps[this.step]; },
    playerPos() {
      return world.player.inCar ? world.player.inCar.mesh.position : world.player.pos;
    },
    targetPos() {
      if (!this.active) return null;
      const s = this.stepDef();
      if (!s) return null;
      if (s.type === 'destroy') {
        const alive = this.rivalCars.find((c) => !c.dead);
        if (alive) return { x: alive.mesh.position.x, z: alive.mesh.position.z };
      }
      if (s.type === 'steal' && this.exportCar && !this.exportCar.dead) {
        return { x: this.exportCar.mesh.position.x, z: this.exportCar.mesh.position.z };
      }
      return { x: s.x, z: s.z };
    },
    onCrime() {
      // Getaway mission: the crime that starts the heat. The countdown must
      // start here too — the update loop only arms it when it first notices
      // the heat, and a 0 timer would fail the mission on the next frame.
      if (this.active && this.def().id === 'getaway' && world.police.wanted >= 3) {
        this.getawayPeaked = true;
        this.getawayTimer = CFG.getawayTimeLimit;
      }
    },
    onEnterCar(car) {
      if (this.active && this.stepDef() && this.stepDef().type === 'steal' && car === this.exportCar) {
        world.toast('Coupe stolen! Get it to the Export Docks — fast!');
        world.audio.chime();
        this.advance();
      }
    },
    spawnRivalCars(count, x, z) {
      this.clearRivals();
      for (let i = 0; i < count; i++) {
        const car = createCar(world, { x: x + (i - (count - 1) / 2) * 9, z: z + (i % 2) * 6, heading: Math.PI / 4, parked: true, seed: 31337 + i * 17 });
        car.health = 80;
        this.rivalCars.push(car);
      }
    },
    clearRivals() {
      for (const car of this.rivalCars) {
        if (car.dead) continue;
        world.scene.remove(car.mesh);
        const i = world.cars.indexOf(car);
        if (i >= 0) world.cars.splice(i, 1);
      }
      this.rivalCars = [];
    },
    spawnExportCar(x, z) {
      if (this.exportCar && !this.exportCar.dead) return;
      const car = createCar(world, { x, z, heading: Math.PI / 2, parked: true, seed: 424242, color: 0xe8c33a });
      car.health = 120;
      this.exportCar = car;
    },
    start(index) {
      this.current = index;
      this.step = 0;
      this.active = true;
      this.getawayTimer = 0;
      this.getawayPeaked = false;
      this.holdTimer = 0;
      this.holdArmed = false;
      this.clearRivals();
      const def = this.def();
      world.toast(`Mission: ${def.name} — ${def.intro}`);
      world.audio.chime();
      this.beginStep();
      this.refreshBeacon();
      world.hud.setMission(def.name, this.stepText(), '');
      world.saveGame();
    },
    beginStep() {
      const s = this.stepDef();
      if (!s) return;
      this.stepTimer = s.time || 0;
      this.holdTimer = 0;
      this.holdArmed = false;
      if (s.type === 'destroy') this.spawnRivalCars(s.count || 1, s.x, s.z);
      if (s.type === 'steal') this.spawnExportCar(s.x, s.z);
      this.refreshBeacon();
    },
    stepText() {
      const s = this.stepDef();
      if (!this.active || !s) return 'No mission — press N for the next job';
      if (s.type === 'heat') {
        if (!this.getawayPeaked) return 'Raise your heat to 3 ★ (steal cars, fire your gun)';
        return 'Now lose the cops — get to 0 ★ before the clock runs out';
      }
      if (s.type === 'hold') return `${s.label} — ${Math.max(0, Math.ceil(s.seconds - this.holdTimer))}s left in the zone`;
      if (s.type === 'destroy') {
        const left = this.rivalCars.filter((c) => !c.dead).length;
        return `${s.label} — ${left} car${left === 1 ? '' : 's'} left`;
      }
      return s.label;
    },
    refreshBeacon() {
      if (!this.active) { beacon.visible = false; marker.visible = false; return; }
      const p = this.targetPos();
      if (!p) { beacon.visible = false; marker.visible = false; return; }
      beacon.visible = true;
      marker.visible = true;
      beacon.position.x = p.x;
      beacon.position.z = p.z;
      marker.position.set(p.x, 2.2 + Math.sin(performance.now() / 300) * 0.3, p.z);
    },
    complete() {
      const def = this.def();
      const reward = CFG.missionRewards[def.id] || 300;
      this.done[def.id] = true;
      this.active = false;
      world.player.money += reward;
      world.player.respect += 100;
      world.audio.missionDone();
      world.audio.cash();
      world.toast(`Mission complete: ${def.name} — +$${reward} · +100 respect (${respectTitle(world.player.respect)})`);
      world.hud.setMission('', 'All jobs in this chain done — press N for the next one', '');
      world.hud.setRespect(world.player.respect);
      beacon.visible = false;
      marker.visible = false;
      world.saveGame();
    },
    fail(msg) {
      this.active = false;
      beacon.visible = false;
      marker.visible = false;
      this.clearRivals();
      world.toast(`${msg} Press N to retry.`);
      world.hud.setMission('', `${msg} Press N to retry.`, '');
    },
    advance() {
      const def = this.def();
      this.step += 1;
      world.audio.chime();
      if (this.step >= def.steps.length) this.complete();
      else {
        world.toast(`Checkpoint reached — next: ${this.stepDef().label}`);
        this.beginStep();
        this.refreshBeacon();
      }
    },
    nextMission() {
      // Pick the first unfinished mission; if all done, restart the chain.
      const idx = MISSION_DEFS.findIndex((d) => !this.done[d.id]);
      this.start(idx === -1 ? 0 : idx);
    },
    update(dt) {
      if (!this.active) { this.refreshBeacon(); return; }
      const def = this.def();
      const s = this.stepDef();
      if (!s) return;
      const p = this.playerPos();
      this.refreshBeacon();
      const distTo = (t) => Math.hypot(p.x - t.x, p.z - t.z);
      if (s.type === 'goto') {
        const d = distTo(s);
        world.hud.setMission(def.name, s.label, `${Math.round(d)}m to target`);
        if (d < 7) this.advance();
      } else if (s.type === 'timedGoto') {
        this.stepTimer -= dt;
        const d = distTo(s);
        world.hud.setMission(def.name, s.label, `${Math.round(d)}m — ${Math.ceil(this.stepTimer)}s left`);
        if (d < 7) this.advance();
        else if (this.stepTimer <= 0) this.fail('Out of time!');
      } else if (s.type === 'hold') {
        const d = distTo(s);
        if (d < 10) {
          if (!this.holdArmed) {
            this.holdArmed = true;
            world.addWanted(2, 'Robbery');
            world.toast('The till is open — the alarm is ringing! Stay in the store!');
          }
          this.holdTimer += dt;
          world.hud.setMission(def.name, this.stepText(), `${Math.ceil(s.seconds - this.holdTimer)}s of ${s.seconds}s`);
          if (this.holdTimer >= s.seconds) this.advance();
        } else {
          this.holdTimer = 0;
          world.hud.setMission(def.name, s.label, `${Math.round(d)}m — get inside the store`);
        }
      } else if (s.type === 'destroy') {
        const left = this.rivalCars.filter((c) => !c.dead).length;
        const target = this.targetPos();
        const d = target ? distTo(target) : 0;
        world.hud.setMission(def.name, this.stepText(), `${left} car${left === 1 ? '' : 's'} left — ${Math.round(d)}m`);
        if (left === 0) this.advance();
      } else if (s.type === 'steal') {
        const target = this.targetPos();
        const d = target ? distTo(target) : 0;
        world.hud.setMission(def.name, s.label, `${Math.round(d)}m — press E by the gold coupe`);
        if (this.exportCar && this.exportCar.dead) this.fail('The coupe was wrecked!');
      } else if (s.type === 'heat') {
        if (!this.getawayPeaked) {
          world.hud.setMission(def.name, this.stepText(), `Heat: ${world.police.wanted} ★ — need 3 ★`);
          if (world.police.wanted >= 3) {
            this.getawayPeaked = true;
            this.getawayTimer = CFG.getawayTimeLimit;
            world.toast('3 ★ heat! Now lose them!');
          }
        } else {
          this.getawayTimer -= dt;
          world.hud.setMission(def.name, this.stepText(), `Heat: ${world.police.wanted} ★ — ${Math.ceil(this.getawayTimer)}s left`);
          if (world.police.wanted === 0) this.complete();
          else if (this.getawayTimer <= 0) this.fail('Getaway failed — the cops kept you.');
        }
      }
    },
  };
  return state;
}
