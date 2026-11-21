// Sunset Bay screenshot capture: serves game/, loads each ?shot= preset in
// headless Chromium over CDP, and writes the four dossier screenshots.
// Usage: node tools/shots.mjs [--port 8931]
// Writes screenshots/1-chase.jpg, 2-street.jpg, 3-mission.jpg, 4-garage.jpg
// and prints the console errors / failed requests seen during capture.
// v7: the cover is the chase, not the title menu.
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', 'game');
const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'screenshots');
const CHROME = '/home/hatch/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome';
const PORT = parseInt(process.argv.find((a) => a.startsWith('--port='))?.split('=')[1] || '8931', 10);
const DEBUG_PORT = 9335;

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

const SHOTS = [
  { shot: 'chase', file: '1-chase.jpg' },
  { shot: 'street', file: '2-street.jpg' },
  { shot: 'mission', file: '3-mission.jpg' },
  { shot: 'garage', file: '4-garage.jpg' },
];

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
  for (const { shot, file } of SHOTS) {
    await send('Page.navigate', { url: `http://localhost:${PORT}/?shot=${shot}` });
    await sleep(9000); // headless swiftshader needs seconds per frame
    const cap = await send('Page.captureScreenshot', { format: 'jpeg', quality: 85 });
    await writeFile(join(OUT, file), Buffer.from(cap.data, 'base64'));
    const state = await send('Runtime.evaluate', { expression: `window.__sunsetBay ? __sunsetBay.state() : 'no-handle'`, returnByValue: true });
    console.log(`${file}: state=${state.result?.value} errors=${errors.length} failedReqs=${failedReqs.length}`);
  }
  console.log(`\nSHOTS: ${SHOTS.length} written to ${OUT}`);
  console.log(`console errors: ${errors.length}${errors.length ? ' — ' + errors.slice(0, 5).join(' | ') : ''}`);
  console.log(`failed requests: ${failedReqs.length}${failedReqs.length ? ' — ' + failedReqs.slice(0, 5).join(' | ') : ''}`);
  process.exitCode = errors.length === 0 && failedReqs.length === 0 ? 0 : 1;
} finally {
  try { ws?.close(); } catch {}
  chrome.kill('SIGKILL');
  server.close();
}
process.exit(process.exitCode || 0);
