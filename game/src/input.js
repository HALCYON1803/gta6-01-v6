// Keyboard + mouse input with pointer lock for the third-person camera.
// The pointer-lock request is guarded: in a headless browser (or without a
// user gesture) it rejects, and that rejection must never surface as a
// console error — the game simply plays without mouse-look there.
export function createInput(canvas) {
  const keys = new Set();
  let mouseDX = 0, mouseDY = 0, clicked = false;
  const state = {
    mouseDown: false,
    locked: false,
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
  document.addEventListener('pointerlockerror', (e) => { e.preventDefault(); state.locked = false; });
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') e.preventDefault();
    keys.add(e.code);
  });
  window.addEventListener('keyup', (e) => keys.delete(e.code));
  window.addEventListener('blur', () => keys.clear());
  document.addEventListener('mousemove', (e) => {
    if (!state.locked) return;
    mouseDX += e.movementX || 0;
    mouseDY += e.movementY || 0;
  });
  canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) { state.mouseDown = true; clicked = true; }
  });
  window.addEventListener('mouseup', (e) => {
    if (e.button === 0) state.mouseDown = false;
  });
  state.consumeMouse = () => {
    const out = { dx: mouseDX, dy: mouseDY };
    mouseDX = 0; mouseDY = 0;
    return out;
  };
  state.pressed = (code) => keys.has(code);
  state.consumeClick = () => {
    const c = clicked;
    clicked = false;
    return c;
  };
  return state;
}

// Note: keys are tracked by `code` (KeyW, Digit1, Space …) so the layout
// works the same on any keyboard; the game reads them through pressed().
