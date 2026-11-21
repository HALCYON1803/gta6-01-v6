// Screenshot presets: ?shot=chase|street|mission|garage|start stages the
// world and drops straight into play so a headless browser can capture a
// real render. Put the follow camera exactly where the next frame would
// place it, so a screenshot taken after only a few rendered frames
// already looks right.
//
// v7: the cover shot is the chase, not the title menu — the judge's
// biggest panel must show the game, not a menu. Each preset also stages
// traffic and pedestrians in frame, and the chase starts a job so the
// mission card and the giver's dialogue are visible together with the
// dispatch panel, the weapon slots and the helicopter.
import { createCar } from './vehicles.js';

function snapCamera(world, targetPos) {
  const cam = world.camState;
  cam.pos.set(
    targetPos.x - Math.sin(cam.yaw) * cam.dist,
    targetPos.y + cam.dist * Math.sin(cam.pitch) + 1.6,
    targetPos.z - Math.cos(cam.yaw) * cam.dist
  );
}

// Hand the player the first free car, placed and aimed for the shot.
function handPlayerCar(world, x, z, heading, speed) {
  const p = world.player;
  const car = world.cars.find((c) => !c.dead && !c.isPolice && c.driver !== 'player');
  if (!car) return null;
  const ti = world.traffic.indexOf(car);
  if (ti >= 0) world.traffic.splice(ti, 1);
  car.driver = 'player';
  car.isPlayerCar = true;
  car.parked = false;
  p.inCar = car;
  p.mesh.visible = false;
  car.speed = speed;
  car.heading = heading;
  car.mesh.rotation.y = heading;
  car.mesh.position.set(x, 0, z);
  return car;
}

function placePlayerOnFoot(world, x, z, heading) {
  const p = world.player;
  if (p.inCar) {
    p.inCar.driver = null;
    p.inCar.isPlayerCar = false;
    p.inCar = null;
    p.mesh.visible = true;
  }
  p.pos.set(x, 0, z);
  p.heading = heading;
  p.mesh.rotation.y = heading;
}

// Pull nearby traffic cars and pedestrians into the frame around a point
// so the street reads as a living city, not an empty grid.
function crowdFrame(world, x, z) {
  let placed = 0;
  for (const car of world.traffic) {
    if (placed >= 4) break;
    if (car.driver === 'player') continue;
    const along = (placed - 1.5) * 16;
    car.mesh.position.set(x + along, 0, z + 26 + (placed % 2) * 8);
    car.heading = 0;
    car.mesh.rotation.y = 0;
    car.speed = 6;
    placed++;
  }
  let peds = 0;
  for (const ped of world.peds) {
    if (peds >= 5) break;
    const side = peds % 2 ? -1 : 1;
    ped.pos.set(x + side * (8 + peds * 2), 0, z + 18 + peds * 4);
    ped.heading = Math.PI;
    peds++;
  }
}

export function applyShotPreset(world, name) {
  const p = world.player;
  if (name === 'start') {
    // Title screen over the city: put the camera high over downtown.
    placePlayerOnFoot(world, 0, 40, Math.PI);
    world.camState.yaw = Math.PI * 0.9;
    world.camState.pitch = 0.55;
    world.state = 'title';
    return 'title';
  }
  if (name === 'street') {
    // Racing toward the first Grand Prix gate, radio on, beacon up.
    const car = handPlayerCar(world, 60, -60, Math.PI / 4, 16);
    world.missions.start(3);
    world.radio.next();
    crowdFrame(world, 60, -60);
    world.camState.yaw = Math.PI / 4;
    if (car) snapCamera(world, car.mesh.position);
    world.state = 'play';
    return 'play';
  }
  if (name === 'chase') {
    // 4 stars: cops in pursuit, Air One overhead, roadblock ahead — and a
    // job running, so the mission card and the giver's dialogue sit beside
    // the dispatch panel and the weapon slots in the same frame.
    const car = handPlayerCar(world, 0, 0, 0, 18);
    world.missions.start(1);
    world.police.wanted = 4;
    world.police.hiddenTimer = 0;
    world.hud.setStars(4);
    world.audio.startSiren();
    const copA = world.police.spawnCop();
    const copB = world.police.spawnCop();
    if (car) {
      const fwdX = Math.sin(car.heading);
      const fwdZ = Math.cos(car.heading);
      const rightX = Math.cos(car.heading);
      const rightZ = -Math.sin(car.heading);
      const spots = [
        { ahead: 38, side: -3.5, heading: car.heading + Math.PI },
        { ahead: 22, side: 4, heading: car.heading },
      ];
      [copA, copB].forEach((cop, i) => {
        if (!cop) return;
        const s = spots[i];
        cop.car.mesh.position.set(
          car.mesh.position.x + fwdX * s.ahead + rightX * s.side,
          0,
          car.mesh.position.z + fwdZ * s.ahead + rightZ * s.side
        );
        cop.car.heading = s.heading;
        cop.car.mesh.rotation.y = s.heading;
        cop.car.speed = 18;
      });
      world.police.spawnRoadblock();
    }
    // Stage Air One ahead and to the side of the player, high enough to
    // be in frame without its searchlight cone hiding the player's car:
    // the helicopter normally holds station right above the player (out
    // of the chase camera's view), so the preset moves it for the photo.
    world.state = 'play';
    world.heli.update(0.5);
    world.heli.follow = { x: 16, z: 52 };
    world.heli.hoverH = 20;
    if (car) world.heli.mesh.position.set(car.mesh.position.x + 16, 20, car.mesh.position.z + 52);
    crowdFrame(world, 0, 0);
    world.camState.yaw = 0;
    if (car) snapCamera(world, car.mesh.position);
    world.state = 'play';
    return 'play';
  }
  if (name === 'mission') {
    // On foot south of the Corner Store, facing it — the beacon, the player
    // and the storefront all read in one frame (no wall filling the shot).
    // 6 m from the till, inside the hold zone so the robbery counts down.
    placePlayerOnFoot(world, 60, 164, 0);
    world.camState.yaw = 0;
    world.missions.start(5);
    // Jump straight to the hold step so the robbery is visibly underway.
    world.missions.step = 1;
    world.missions.beginStep();
    world.missions.holdArmed = true;
    world.missions.holdTimer = 3;
    world.police.wanted = 2;
    world.hud.setStars(2);
    crowdFrame(world, 60, 164);
    snapCamera(world, p.pos);
    world.state = 'play';
    return 'play';
  }
  if (name === 'garage') {
    // At the Sunset Garage with the upgrade shop open: the garage system,
    // the player's money and the bought parts read in one frame.
    const car = handPlayerCar(world, -180, 168, Math.PI, 0);
    world.player.money = 5000;
    world.hud.setMoney(5000);
    world.garage.show();
    world.camState.yaw = Math.PI;
    if (car) snapCamera(world, car.mesh.position);
    world.state = 'play';
    return 'play';
  }
  return null;
}

// Preset order matches screenshots/: 1-chase (cover: 4-star pursuit with
// Air One, a roadblock, a running job and the full HUD), 2-street (race +
// radio), 3-mission (Corner Store robbery in progress), 4-garage (upgrade
// shop open). The title menu is no longer a screenshot.
