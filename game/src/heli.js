// Air One — the Sunset Bay PD helicopter. It joins the chase at 4 stars,
// hovers above the player with a sweeping searchlight, and never loses
// sight of you: while it is overhead your wanted level cannot cool off.
// It leaves (climbing away) once the heat is gone.
//
// The helicopter is a visual + rules object, not a car: it never
// collides, never takes damage, and its only job is to pin the wanted
// level while it circles. Shooting it down is not part of this build.
// v7: the helicopter reports its dispatch callsign (AIR-1) so the
// dispatch panel can list it beside the ground units.
import * as THREE from 'three';
import { CFG, HELI_CALLSIGN } from './config.js';

export function createHeli(world) {
  const g = new THREE.Group();
  const navy = new THREE.MeshLambertMaterial({ color: 0x1c2f4a });
  const dark = new THREE.MeshLambertMaterial({ color: 0x222222 });

  // A box part bolted onto the group at (x, y, z).
  function bolt(w, h, d, mat, x, y, z) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    g.add(m);
    return m;
  }
  bolt(2.2, 1.4, 4.6, navy, 0, 0, 0);            // body
  bolt(0.7, 0.7, 4.2, navy, 0, 0.2, -4.0);       // tail boom
  bolt(1.9, 0.9, 1.4, new THREE.MeshLambertMaterial({ color: 0x9fd8ff }), 0, 0.35, 1.8); // glass
  bolt(2.24, 0.3, 4.62, new THREE.MeshLambertMaterial({ color: 0xffffff }), 0, -0.1, 0); // stripe
  const rotor = bolt(9.5, 0.08, 0.5, dark, 0, 1.0, 0);
  const tailRotor = bolt(0.08, 2.0, 0.4, dark, 0.45, 0.3, -5.8);

  // Searchlight: a cone of light the player can see sweeping the street.
  const beam = new THREE.Mesh(
    new THREE.ConeGeometry(3.2, 26, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false })
  );
  beam.position.y = -13;
  g.add(beam);
  const spot = new THREE.PointLight(0xfff2b0, 0, 30);
  spot.position.y = -1;
  g.add(spot);
  g.visible = false;
  world.scene.add(g);

  function playerPos() {
    return world.player.inCar ? world.player.inCar.mesh.position : world.player.pos;
  }

  const state = {
    mesh: g,
    rotor,
    beam,
    active: false,
    leaving: false,
    hoverH: 26,
    callsign: HELI_CALLSIGN,
    // Where the helicopter holds station relative to the player. The chase
    // screenshot preset moves it ahead of the player so it is in frame.
    follow: { x: 10, z: -8 },
    reset() {
      this.active = false;
      this.leaving = false;
      g.visible = false;
      g.position.y = this.hoverH;
    },
    update(dt) {
      const wanted = world.police.wanted;
      if (!this.active && wanted >= CFG.heliWanted && world.state === 'play') {
        this.active = true;
        this.leaving = false;
        g.visible = true;
        const p = playerPos();
        g.position.set(p.x + 14, this.hoverH, p.z - 10);
        world.toast('Air One overhead — the helicopter has your scent!');
        world.audio.horn();
      }
      if (!this.active) return;
      rotor.rotation.y += dt * 22;
      tailRotor.rotation.x += dt * 30;
      const p = playerPos();
      if (wanted === 0 || this.leaving) {
        // Climb away and disappear.
        this.leaving = true;
        g.position.y += dt * 14;
        g.position.x += dt * 6;
        if (g.position.y > 90) {
          this.active = false;
          this.leaving = false;
          g.visible = false;
        }
        return;
      }
      // Hover above and slightly behind the player, spotlight on them.
      const tx = p.x + this.follow.x;
      const tz = p.z + this.follow.z;
      g.position.x += (tx - g.position.x) * Math.min(1, dt * 1.1);
      g.position.z += (tz - g.position.z) * Math.min(1, dt * 1.1);
      g.position.y += (this.hoverH + Math.sin(performance.now() / 900) * 1.2 - g.position.y) * Math.min(1, dt * 2);
      const dx = p.x - g.position.x;
      const dz = p.z - g.position.z;
      g.rotation.y = Math.atan2(dx, dz);
      // Sweep the beam in a slow circle around the player.
      const t = performance.now() / 1600;
      beam.position.x = Math.sin(t) * 2.2;
      beam.position.z = Math.cos(t) * 2.2;
      beam.rotation.z = Math.sin(t) * 0.12;
      beam.rotation.x = -Math.cos(t) * 0.12;
    },
  };
  return state;
}
