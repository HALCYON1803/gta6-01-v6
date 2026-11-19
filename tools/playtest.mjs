// Sunset Bay v6 playtest: serves game/, drives it in headless Chromium over
// CDP, and checks every system — load, walk, drive, all 8 missions, 4 weapons,
// radio, garage, helicopter + roadblocks, save, FPS, console errors.
// Usage: node tools/playtest.mjs [--port 8941] [--shots]  (screenshots need
// the .tools/cdp-v3.mjs driver instead; this script checks logic, not pixels)
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', 'game');
const CHROME = '/home/hatch/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome';
const PORT = parseInt(process.argv.find((a) => a.startsWith('--port='))?.split('=')[1] || '8941', 10);
const DEBUG_PORT = 9334;

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg' };
const server = createServer(async (req, res) => {
  try {
    const p = join(ROOT, decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html');
    const data = await readFile(p);
    res.writeHead(200, { 'content-type': MIME[extname(p)] || 'application/octet-stream' });
    res.end(data);
  } catch { res.writeHead(404); res.end('not found'); }
});
await new Promise((r) => server.listen(PORT, r));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const chrome = spawn(CHROME, ['--headless=new', '--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', `--remote-debugging-port=${DEBUG_PORT}`, '--window-size=1280,720', '--hide-scrollbars', 'about:blank'], { stdio: 'ignore' });

async function getWsUrl() {
  for (let i = 0; i < 40; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/list`);
      const list = await res.json();
      const page = list.find((t) => t.type === 'page');
      if (page) return page.webSocketDebuggerUrl;
    } catch { /* not up yet */ }
    await sleep(250);
  }
  throw new Error('chrome devtools did not come up');
}
let id = 0;
const pending = new Map();
const errors = [];
const failedReqs = [];
let ws;
function send(method, params = {}) {
  return new Promise((resolve) => {
    const mid = ++id;
    pending.set(mid, { resolve });
    ws.send(JSON.stringify({ id: mid, method, params }));
  });
}
async function evalJs(expr) {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) return { __error: r.exceptionDetails.exception?.description || 'eval exception' };
  return r.result?.value;
}
async function key(code, ms, keyName) {
  const key = keyName || code.replace('Key', '').replace('Digit', '').toLowerCase();
  await send('Input.dispatchKeyEvent', { type: 'keyDown', code, key, windowsVirtualKeyCode: 0 });
  await sleep(ms);
  await send('Input.dispatchKeyEvent', { type: 'keyUp', code, key, windowsVirtualKeyCode: 0 });
  await sleep(200);
}
async function clickAt(x, y) {
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
  await sleep(120);
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
  await sleep(200);
}

const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok: !!ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
}
async function waitFor(fn, timeoutMs = 8000, stepMs = 250) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    if (await fn()) return true;
    await sleep(stepMs);
  }
  return false;
}

try {
  const wsUrl = await getWsUrl();
  ws = new WebSocket(wsUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id).resolve(msg.result || {}); pending.delete(msg.id); }
    else if (msg.method === 'Runtime.exceptionThrown') errors.push(msg.params.exceptionDetails?.exception?.description || 'exception');
    else if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') errors.push(msg.params.args.map((a) => a.value ?? a.description ?? '').join(' '));
    else if (msg.method === 'Network.loadingFailed') failedReqs.push(msg.params.errorText || 'loadingFailed');
    else if (msg.method === 'Network.responseReceived' && msg.params.response.status >= 400) failedReqs.push(`${msg.params.response.status} ${msg.params.response.url}`);
  };
  await send('Runtime.enable');
  await send('Page.enable');
  await send('Network.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: `http://localhost:${PORT}/` });
  await sleep(5000);

  check('loads: title state, handle present', (await evalJs(`!!window.__sunsetBay && __sunsetBay.state()`)) === 'title');
  check('loads: no failed requests', failedReqs.length === 0, failedReqs.join('; '));
  check('start: enters play', (await evalJs(`__sunsetBay.start(), __sunsetBay.state()`)) === 'play');

  // Walk: teleport, then hold W and confirm the player moves.
  await evalJs(`__sunsetBay.teleport(0, 20)`);
  const p0 = await evalJs(`JSON.stringify(__sunsetBay.player())`);
  await key('KeyW', 1500);
  const p1 = await evalJs(`JSON.stringify(__sunsetBay.player())`);
  check('walk: W moves player', JSON.parse(p0).z !== JSON.parse(p1).z || JSON.parse(p0).x !== JSON.parse(p1).x, `${p0} -> ${p1}`);

  // Steal a car: teleport next to a parked car, enter it (test action), and
  // prove the real E key binding works too with a long hold (headless runs
  // ~1 fps, so a 100 ms press would fall between frames).
  await evalJs(`__sunsetBay.teleport(60, -118)`);
  await sleep(300);
  check('steal: enter nearest car', (await evalJs(`__sunsetBay.enterNearestCar()`)) === true);
  check('steal: player is in car', (await evalJs(`__sunsetBay.player().inCar`)) === true);
  check('drive: wanted rose after theft', (await evalJs(`__sunsetBay.wanted()`)) >= 1);
  const speed = await evalJs(`__sunsetBay.driveFor(3)`);
  const carPos = await evalJs(`JSON.stringify({x: __sunsetBay.world.player.inCar.mesh.position.x, z: __sunsetBay.world.player.inCar.mesh.position.z})`);
  check('drive: car moves under W', Math.abs(JSON.parse(carPos).x - 62) + Math.abs(JSON.parse(carPos).z + 118) > 5, `${carPos} speed=${speed}`);
  await evalJs(`__sunsetBay.exitCar()`);
  await sleep(300); // exitCar leaves the player 2.2 m beside the car
  await key('KeyE', 5000); // headless runs ~0.3 fps: the press must span a frame
  check('steal: real E key enters car', (await evalJs(`__sunsetBay.player().inCar`)) === true);

  // Weapons: switch through all four, fire the pistol at nothing (no crash).
  for (const w of ['smg', 'shotgun', 'rifle', 'pistol']) {
    await evalJs(`__sunsetBay.selectWeapon('${w}')`);
    check(`weapon: select ${w}`, (await evalJs(`__sunsetBay.weapon()`)) === w);
  }
  await evalJs(`__sunsetBay.world.combat.tryShoot()`);
  check('weapon: shooting works', (await evalJs(`__sunsetBay.world.combat.ammo`)) === 11);
  // Real mouse click wiring: shooting only works on foot, so step out of
  // the car first, click, let the cooldown elapse, let a frame run
  // (headless is ~0.3 fps, so a frame takes ~3 s — wait for one).
  await evalJs(`__sunsetBay.exitCar()`);
  await clickAt(640, 360);
  await evalJs(`__sunsetBay.tick(0.5)`);
  await sleep(5000);
  check('weapon: mouse click fires', (await evalJs(`__sunsetBay.world.combat.ammo`)) === 10);
  await evalJs(`__sunsetBay.enterNearestCar()`);

  // Radio: cycle all three stations.
  const r0 = await evalJs(`__sunsetBay.radio()`);
  await evalJs(`__sunsetBay.nextRadio()`);
  const r1 = await evalJs(`__sunsetBay.radio()`);
  await evalJs(`__sunsetBay.nextRadio()`);
  const r2 = await evalJs(`__sunsetBay.radio()`);
  check('radio: Q cycles stations', r0 !== r1 && r1 !== r2, `${r0} | ${r1} | ${r2}`);

  // Garage: fund the player, go to the garage, buy all three upgrades.
  await evalJs(`__sunsetBay.setMoney(5000); __sunsetBay.teleport(-180, 168)`);
  await sleep(300);
  check('garage: panel opens near garage', (await evalJs(`__sunsetBay.world.garage.show()`)) === true);
  for (const u of ['engine', 'armor', 'nos']) {
    check(`garage: buy ${u}`, (await evalJs(`__sunsetBay.buyUpgrade('${u}')`)) === true);
  }
  check('garage: money deducted', (await evalJs(`__sunsetBay.player().money`)) === 5000 - 800 - 600 - 500);
  await evalJs(`__sunsetBay.world.garage.hide()`);

  // NOS: with the kit installed, drive with NOS for 2 game-seconds. Point
  // the car down the open street first — it faces the garage after the
  // teleport, and a collider would pin it in place.
  await evalJs(`__sunsetBay.world.player.inCar.heading = Math.PI; __sunsetBay.world.player.inCar.mesh.rotation.y = Math.PI;`);
  const nos0 = await evalJs(`__sunsetBay.world.player.inCar.nosMeter`);
  const nosSpeed = await evalJs(`__sunsetBay.driveFor(2, true)`);
  const nos1 = await evalJs(`__sunsetBay.world.player.inCar.nosMeter`);
  check('nos: Shift burns meter while driving', nos1 < nos0, `${nos0} -> ${nos1} speed=${nosSpeed}`);

  // Missions: complete all 8 by teleporting through their steps, advancing
  // the simulation with tick() (the render loop is ~1 fps headless, so
  // real-time waits would never let a mission step register).
  async function gotoStep(x, z) {
    await evalJs(`__sunsetBay.teleport(${x}, ${z})`);
    await evalJs(`__sunsetBay.tick(0.5)`);
    await sleep(150);
  }
  // 1 Courier: 4 drops.
  await evalJs(`__sunsetBay.startMission(0)`);
  for (const [x, z] of [[150, -150], [-180, -150], [-150, 150], [150, 150]]) await gotoStep(x, z);
  check('mission 1 courier completes', (await evalJs(`__sunsetBay.missions().done.courier`)) === true);
  // 2 Getaway: raise heat, then lose it.
  await evalJs(`__sunsetBay.startMission(1)`);
  await evalJs(`__sunsetBay.setWanted(3)`);
  await evalJs(`__sunsetBay.tick(0.5)`);
  await evalJs(`__sunsetBay.clearWanted()`);
  await evalJs(`__sunsetBay.tick(0.5)`);
  check('mission 2 getaway completes', (await evalJs(`__sunsetBay.missions().done.getaway`)) === true);
  // 3 Harbor: exit the car, then shoot the rival car (aim camera at it,
  // direct tryShoot + tick to step the cooldown), then hideout.
  await evalJs(`__sunsetBay.startMission(2)`);
  await evalJs(`__sunsetBay.exitCar()`);
  for (let shot = 0; shot < 6; shot++) {
    const alive = await evalJs(`__sunsetBay.world.missions.rivalCars.filter(c=>!c.dead).length`);
    if (alive === 0) break;
    await evalJs(`(()=>{const w=__sunsetBay.world;const r=w.missions.rivalCars.find(c=>!c.dead);if(!r)return;const p=w.player.pos;w.camState.yaw=Math.atan2(r.mesh.position.x-p.x,r.mesh.position.z-p.z);w.player.heading=w.camState.yaw;})()`);
    await evalJs(`__sunsetBay.teleport(-162, -162)`);
    await evalJs(`__sunsetBay.world.combat.tryShoot()`);
    await evalJs(`__sunsetBay.tick(0.3)`);
  }
  check('mission 3 harbor: rival destroyed', (await evalJs(`__sunsetBay.world.missions.rivalCars.filter(c=>!c.dead).length`)) === 0);
  await gotoStep(168, 168);
  check('mission 3 harbor completes', (await evalJs(`__sunsetBay.missions().done.harbor`)) === true);
  // 4 Street race: 5 timed gates.
  await evalJs(`__sunsetBay.startMission(3)`);
  for (const [x, z] of [[120, -60], [120, 120], [-60, 120], [-120, -60], [0, 0]]) await gotoStep(x, z);
  check('mission 4 streetrace completes', (await evalJs(`__sunsetBay.missions().done.streetrace`)) === true);
  // 5 Taxi: 3 pickups + 3 drops.
  await evalJs(`__sunsetBay.startMission(4)`);
  for (const [x, z] of [[-60, -120], [150, 60], [60, -180], [-150, 150], [180, 0], [0, 180]]) await gotoStep(x, z);
  check('mission 5 taxifare completes', (await evalJs(`__sunsetBay.missions().done.taxifare`)) === true);
  // 6 Robbery: store, hold 8s in the zone (tick advances game time), hideout.
  await evalJs(`__sunsetBay.startMission(5)`);
  await gotoStep(60, 170);
  await evalJs(`__sunsetBay.tick(9)`);
  check('mission 6 robbery: hold finished', (await evalJs(`__sunsetBay.missions().step`)) === 2);
  await gotoStep(168, 168);
  check('mission 6 robbery completes', (await evalJs(`__sunsetBay.missions().done.robbery`)) === true);
  // 7 Export: steal the gold coupe, deliver to the docks.
  await evalJs(`__sunsetBay.startMission(6)`);
  await evalJs(`__sunsetBay.teleport(148, -120)`);
  await evalJs(`__sunsetBay.enterNearestCar()`);
  check('mission 7 export: coupe stolen', (await evalJs(`__sunsetBay.player().inCar`)) === true);
  await gotoStep(-168, -168);
  check('mission 7 export completes', (await evalJs(`__sunsetBay.missions().done.export`)) === true);
  // 8 Showdown: destroy 3 rival cars, then hideout.
  await evalJs(`__sunsetBay.startMission(7)`);
  await evalJs(`__sunsetBay.exitCar()`);
  for (let shot = 0; shot < 14; shot++) {
    const alive = await evalJs(`__sunsetBay.world.missions.rivalCars.filter(c=>!c.dead).length`);
    if (alive === 0) break;
    await evalJs(`(()=>{const w=__sunsetBay.world;const r=w.missions.rivalCars.find(c=>!c.dead);if(!r)return;const p=w.player.pos;w.camState.yaw=Math.atan2(r.mesh.position.x-p.x,r.mesh.position.z-p.z);})()`);
    await evalJs(`__sunsetBay.teleport(-162, -162)`);
    await evalJs(`__sunsetBay.world.combat.tryShoot()`);
    await evalJs(`__sunsetBay.tick(0.3)`);
  }
  check('mission 8 showdown: 3 rivals destroyed', (await evalJs(`__sunsetBay.world.missions.rivalCars.filter(c=>!c.dead).length`)) === 0);
  await gotoStep(168, 168);
  check('mission 8 showdown completes', (await evalJs(`__sunsetBay.missions().done.showdown`)) === true);
  check('respect: 8 missions = 800', (await evalJs(`__sunsetBay.player().respect`)) === 800);

  // Police escalation: 4 stars brings Air One + roadblocks; losing the heat clears them.
  await evalJs(`__sunsetBay.setWanted(4)`);
  await evalJs(`__sunsetBay.tick(1)`);
  check('police: Air One joins at 4 stars', (await evalJs(`__sunsetBay.heli()`)) === true);
  check('police: roadblock appears at 3+ stars', (await evalJs(`__sunsetBay.roadblocks()`)) >= 2);
  check('police: pursuit cars spawned', (await evalJs(`__sunsetBay.cops()`)) >= 1);
  await evalJs(`__sunsetBay.clearWanted()`);
  await evalJs(`__sunsetBay.tick(0.5)`);
  check('police: heat clears, roadblocks gone', (await evalJs(`__sunsetBay.wanted()`)) === 0 && (await evalJs(`__sunsetBay.roadblocks()`)) === 0);

  // FPS: 3s of driving frames on the same headless swiftshader setup as v5.
  await evalJs(`__sunsetBay.teleport(0, 0)`);
  await send('Input.dispatchKeyEvent', { type: 'keyDown', code: 'KeyW', key: 'w', windowsVirtualKeyCode: 0 });
  const fps = await evalJs(`new Promise(r=>{let n=0;const t0=performance.now();const loop=()=>{n++;if(performance.now()-t0<3000)requestAnimationFrame(loop);else r((n/3).toFixed(1))};requestAnimationFrame(loop)})`);
  await send('Input.dispatchKeyEvent', { type: 'keyUp', code: 'KeyW', key: 'w', windowsVirtualKeyCode: 0 });
  console.log(`FPS (headless swiftshader, 1280x720, driving): ${fps}`);
  check('perf: fps measured', parseFloat(fps) > 0, `fps=${fps}`);

  // Save: a v2 save exists in localStorage after all that play.
  check('save: v2 save written', (await evalJs(`!!localStorage.getItem('sunset-bay-save-v2')`)) === true);
  const doneCount = await evalJs(`Object.values(JSON.parse(localStorage.getItem('sunset-bay-save-v2')).missionsDone).filter(Boolean).length`);
  check('save: all 8 missions recorded', doneCount === 8, `done=${doneCount}`);

  // Console errors collected across the whole run.
  check('errors: zero console errors', errors.length === 0, errors.slice(0, 5).join(' | '));

  const passed = results.filter((r) => r.ok).length;
  console.log(`\nPLAYTEST: ${passed}/${results.length} passed`);
  if (passed !== results.length) {
    console.log('FAILED:');
    for (const r of results.filter((r) => !r.ok)) console.log(`  - ${r.name} ${r.detail}`);
  }
  process.exitCode = passed === results.length ? 0 : 1;
} finally {
  try { ws?.close(); } catch {}
  chrome.kill('SIGKILL');
  server.close();
}
process.exit(process.exitCode || 0);
