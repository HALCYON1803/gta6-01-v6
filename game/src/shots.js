// Screenshot presets: ?shot=start|street|chase|mission stages the world and
// drops straight into play so a headless browser can capture a real render.
// Put the follow camera exactly where the next frame would place it, so a
// screenshot taken after only a few rendered frames already looks right.
function snapCamera(world, targetPos) {
  const cam = world.camState;
  cam.pos.set(
    targetPos.x - Math.sin(cam.yaw) * cam.dist,
    targetPos.y + cam.dist * Math.sin(cam.pitch) + 1.6,
    targetPos.z - Math.cos(cam.yaw) * cam.dist
  );
}

function givePlayerCar(world, x, z, heading, speed) {
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

export function applyShotPreset(world, name) {
  const p = world.player;
  const setPlayer = (x, z, heading) => {
    if (p.inCar) { p.inCar.driver = null; p.inCar.isPlayerCar = false; p.inCar = null; p.mesh.visible = true; }
    p.pos.set(x, 0, z);
    p.heading = heading;
    p.mesh.rotation.y = heading;
  };
  if (name === 'start') {
    // Title screen over the city: put the camera high over downtown.
    setPlayer(0, 40, Math.PI);
    world.camState.yaw = Math.PI * 0.9;
    world.camState.pitch = 0.55;
    world.state = 'title';
    return 'title';
  }
  if (name === 'street') {
    // Racing toward the first Grand Prix gate, radio on, beacon up.
    const car = givePlayerCar(world, 60, -60, Math.PI / 4, 16);
    world.missions.start(3);
    world.radio.next();
    world.camState.yaw = Math.PI / 4;
    if (car) snapCamera(world, car.mesh.position);
    world.state = 'play';
    return 'play';
  }
  if (name === 'chase') {
    // 4 stars: cops in pursuit, Air One overhead, roadblock ahead.
    const car = givePlayerCar(world, 0, 0, 0, 18);
    world.police.wanted = 4;
    world.police.hiddenTimer = 0;
    world.hud.setStars(4);
    world.audio.startSiren();
    const copA = world.police.spawnCop();
    const copB = world.police.spawnCop();
    if (car) {
      const fwdX = Math.sin(car.heading), fwdZ = Math.cos(car.heading);
      const rightX = Math.cos(car.heading), rightZ = -Math.sin(car.heading);
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
    // Stage Air One ahead of the player, low enough to be in frame: the
    // helicopter normally holds station right above the player (out of the
    // chase camera's view), so the preset moves it forward for the photo.
    world.state = 'play';
    world.heli.update(0.5);
    world.heli.follow = { x: 0, z: 38 };
    world.heli.hoverH = 16;
    if (car) world.heli.mesh.position.set(car.mesh.position.x, 16, car.mesh.position.z + 38);
    world.camState.yaw = 0;
    if (car) snapCamera(world, car.mesh.position);
    world.state = 'play';
    return 'play';
  }
  if (name === 'mission') {
    // On foot south of the Corner Store, facing it — the beacon, the player
    // and the storefront all read in one frame (no wall filling the shot).
    // 6 m from the till, inside the hold zone so the robbery counts down.
    setPlayer(60, 164, 0);
    world.camState.yaw = 0;
    world.missions.start(5);
    // Jump straight to the hold step so the robbery is visibly underway.
    world.missions.step = 1;
    world.missions.beginStep();
    world.missions.holdArmed = true;
    world.missions.holdTimer = 3;
    world.police.wanted = 2;
    world.hud.setStars(2);
    snapCamera(world, p.pos);
    world.state = 'play';
    return 'play';
  }
  return null;
}

// Preset order matches screenshots/: 1-start (title), 2-street (race +
// radio), 3-chase (4-star pursuit with Air One and a roadblock),
// 4-mission (Corner Store robbery in progress).
