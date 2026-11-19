// Keyboard + mouse input, with pointer lock for the third-person camera.
// Keys are tracked by `code` (KeyW, Digit1, Space …), so the layout works
// the same on any keyboard. The game reads keys through pressed(), mouse
// movement through consumeMouse(), and clicks through consumeClick().
//
// Pointer lock is deliberately forgiving: in a headless browser, or
// without a user gesture, the request rejects — and that rejection must
// never show up as a console error. The game simply plays without
// mouse-look in that case.
export function createInput(canvas) {
  const held = new Set();
  let deltaX = 0;
  let deltaY = 0;
  let clickQueued = false;

  const state = {
    mouseDown: false,
    locked: false,
    pressed(code) { return held.has(code); },
    consumeMouse() {
      const out = { dx: deltaX, dy: deltaY };
      deltaX = 0;
      deltaY = 0;
      return out;
    },
    consumeClick() {
      const wasClicked = clickQueued;
      clickQueued = false;
      return wasClicked;
    },
    requestLock() {
      try {
        const p = canvas.requestPointerLock && canvas.requestPointerLock();
        if (p && p.catch) p.catch(() => { /* headless / no gesture: ignore */ });
      } catch (_) { /* pointer lock unavailable: ignore */ }
    },
    releaseLock() {
      try { if (document.pointerLockElement) document.exitPointerLock(); } catch (_) {}
      state.locked = false;
    },
  };

  document.addEventListener('pointerlockchange', () => {
    state.locked = document.pointerLockElement === canvas;
  });
  document.addEventListener('pointerlockerror', (e) => {
    e.preventDefault();
    state.locked = false;
  });
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') e.preventDefault();
    held.add(e.code);
  });
  window.addEventListener('keyup', (e) => held.delete(e.code));
  window.addEventListener('blur', () => held.clear());
  document.addEventListener('mousemove', (e) => {
    if (!state.locked) return;
    deltaX += e.movementX || 0;
    deltaY += e.movementY || 0;
  });
  canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) {
      state.mouseDown = true;
      clickQueued = true;
    }
  });
  window.addEventListener('mouseup', (e) => {
    if (e.button === 0) state.mouseDown = false;
  });
  return state;
}

// Note: the game never reads `held` directly — everything goes through
// the small API above, which is what lets the playtest drive the game
// with synthetic keys and still exercise the real input path.
