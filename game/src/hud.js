// HUD: health + respect bars, money, wanted stars, radio, mission text,
// toasts, NOS meter, weapon slots, the SBPD dispatch panel, the mission
// giver's dialogue box, the car-condition panel, and a canvas minimap
// with roads, the player arrow, cars, cops, the helicopter, roadblocks,
// the garage and the objective.
//
// v7 is the density pack: the dispatch panel lists the live pursuit
// (callsign, distance, role) from police.dispatchUnits(), the slot row
// shows all four weapons from combat, and the dialogue box shows the
// current job's giver from config. Every panel reads real game state.
import { CFG, PLACES, WEAPON_ORDER, WEAPONS, RESPECT_RANKS, respectTitle, respectProgress } from './config.js';

// Green while healthy, amber when hurt, red when nearly down.
function healthGradient(hp) {
  if (hp > 50) return 'linear-gradient(90deg,#37d67a,#7cf2a8)';
  if (hp > 25) return 'linear-gradient(90deg,#e8a33a,#ffd94a)';
  return 'linear-gradient(90deg,#d63a3a,#ff7a7a)';
}

export function createHud(world) {
  const $ = (id) => document.getElementById(id);
  const els = {
    hud: $('hud'), healthBar: $('health-bar'), healthLabel: $('health-label'),
    money: $('money-val'), respect: $('respect-val'), respectBar: $('respect-bar'),
    respectNext: $('respect-next'), radio: $('radio'), stars: $('stars'),
    missionTitle: $('mission-title'), missionStep: $('mission-step'), missionDist: $('mission-dist'),
    toast: $('toast'), speedo: $('speedo'), nosBar: $('nos-bar'), nosWrap: $('nos-wrap'),
    minimap: $('minimap'), hint: $('hint'), crosshair: $('crosshair'), vignette: $('vignette'),
    menu: $('menu'), menuCard: $('menu-card'),
    dispatch: $('dispatch'), dispatchList: $('dispatch-list'),
    slots: $('weapon-slots'),
    dialogue: $('dialogue'), dlgAvatar: $('dlg-avatar'), dlgName: $('dlg-name'), dlgLine: $('dlg-line'),
    carPanel: $('car-panel'), carName: $('car-name'), carCondBar: $('car-cond-bar'), carCondLabel: $('car-cond-label'),
  };
  let toastTimer = null;

  const api = {
    showHud() { els.hud.classList.remove('hidden'); },
    hideHud() { els.hud.classList.add('hidden'); },
    setHealth(hp) {
      const clamped = Math.max(0, Math.min(100, hp));
      els.healthBar.style.width = `${clamped}%`;
      els.healthBar.style.background = healthGradient(hp);
      els.healthLabel.textContent = `HEALTH ${Math.round(clamped)}`;
      els.vignette.style.opacity = hp < 35 ? String((35 - hp) / 35 * 0.9) : '0';
    },
    setMoney(m) { els.money.textContent = String(m); },
    setRespect(r) {
      els.respect.textContent = `${r} · ${respectTitle(r)}`;
      els.respectBar.style.width = `${Math.round(respectProgress(r) * 100)}%`;
      const next = nextRank(r);
      els.respectNext.textContent = next ? `Next: ${next.title} at ${next.at}` : 'Top rank — King of the Bay';
    },
    // The ammo line is gone: the slot row below shows every weapon, its
    // key, its name and its magazine, with the current one highlighted.
    setAmmo(n, reloading) {
      const current = world.combat.weapon;
      const magOf = (id) => (world.combat.magOf ? world.combat.magOf(id) : WEAPONS[id].mag);
      els.slots.innerHTML = WEAPON_ORDER.map((id, i) => {
        const def = WEAPONS[id];
        const isCurrent = id === current;
        const ammo = isCurrent ? n : magOf(id);
        const state = isCurrent ? (reloading ? 'RELOADING' : `${ammo} / ${def.mag}`) : `${ammo} / ${def.mag}`;
        return `<div class="slot${isCurrent ? ' current' : ''}"><span class="slot-key">${i + 1}</span><span class="slot-name">${def.name}</span><span class="slot-ammo">${state}</span></div>`;
      }).join('');
    },
    setRadio(text) { els.radio.textContent = `♪ ${text}`; },
    setStars(n) {
      let s = '';
      for (let i = 0; i < CFG.maxWanted; i++) s += `<span class="${i < n ? '' : 'dim'}">★</span>`;
      els.stars.innerHTML = s;
    },
    setMission(title, step, dist) {
      els.missionTitle.textContent = title;
      els.missionStep.textContent = step;
      els.missionDist.textContent = dist;
    },
    toast(msg) {
      els.toast.textContent = msg;
      els.toast.style.opacity = '1';
      if (toastTimer) clearTimeout(toastTimer);
      toastTimer = setTimeout(() => { els.toast.style.opacity = '0'; }, 3200);
    },
    setHint(text) {
      if (text) {
        els.hint.textContent = text;
        els.hint.classList.remove('hidden');
      } else {
        els.hint.classList.add('hidden');
      }
    },
    setSpeed(kmh, driving, nosMeter, nosBurning) {
      if (!driving) {
        els.speedo.classList.add('hidden');
        els.nosWrap.classList.add('hidden');
        return;
      }
      els.speedo.classList.remove('hidden');
      els.speedo.firstChild.textContent = String(Math.round(kmh));
      if (typeof nosMeter === 'number') {
        els.nosWrap.classList.remove('hidden');
        els.nosBar.style.width = `${Math.max(0, Math.min(100, nosMeter))}%`;
        els.nosBar.style.background = nosBurning ? '#37e6ff' : '#2e6fd8';
      } else {
        els.nosWrap.classList.add('hidden');
      }
    },
    // The dispatch panel: one row per live pursuit unit — callsign,
    // tactical role, distance in metres, nearest first. Hidden when
    // nobody is chasing the player.
    refreshDispatch(units) {
      if (!units || units.length === 0) {
        els.dispatch.classList.add('hidden');
        return;
      }
      els.dispatch.classList.remove('hidden');
      els.dispatchList.innerHTML = units.map((u) =>
        `<div class="dispatch-row"><b>${u.callsign}</b><span class="dispatch-role">${u.role}</span><span class="dispatch-dist">${u.dist}m</span></div>`
      ).join('');
    },
    // The mission giver's dialogue box: portrait initials, name and role,
    // and the giver's line for the job. It stays up until the next job
    // replaces it or the job ends — a screenshot taken seconds later
    // still shows it.
    setDialogue(giver) {
      if (!giver) { els.dialogue.classList.add('hidden'); return; }
      els.dlgAvatar.textContent = giver.initials;
      els.dlgName.textContent = `${giver.name} — ${giver.role}`;
      els.dlgLine.textContent = giver.line;
      els.dialogue.classList.remove('hidden');
    },
    hideDialogue() { els.dialogue.classList.add('hidden'); },
    // The car panel: model name and condition bar, shown only while
    // driving. The condition is the car health the game already tracks.
    setCar(name, health) {
      if (!name) {
        els.carPanel.classList.add('hidden');
        return;
      }
      els.carPanel.classList.remove('hidden');
      els.carName.textContent = name;
      const clamped = Math.max(0, Math.min(100, health));
      els.carCondBar.style.width = `${clamped}%`;
      els.carCondBar.style.background = healthGradient(clamped);
      els.carCondLabel.textContent = `CONDITION ${Math.round(clamped)}%`;
    },
    drawMinimap() {
      const ctx = els.minimap.getContext('2d');
      const W = els.minimap.width;
      const H = els.minimap.height;
      const range = CFG.minimapRange;
      const p = world.player.inCar ? world.player.inCar.mesh.position : world.player.pos;
      const scale = W / (range * 2);
      const toX = (x) => W / 2 + (x - p.x) * scale;
      const toY = (z) => H / 2 + (z - p.z) * scale;
      ctx.clearRect(0, 0, W, H);
      // Land.
      ctx.fillStyle = '#5a6a55';
      ctx.fillRect(0, 0, W, H);
      // Roads.
      ctx.strokeStyle = '#3a3f47';
      ctx.lineWidth = Math.max(2, CFG.roadWidth * scale);
      for (const s of world.city.streets) {
        ctx.beginPath(); ctx.moveTo(toX(s), 0); ctx.lineTo(toX(s), H); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, toY(s)); ctx.lineTo(W, toY(s)); ctx.stroke();
      }
      // Sea on the east edge.
      ctx.fillStyle = '#2f7fb8';
      const seaX = toX(CFG.worldHalf + 23);
      if (seaX < W) ctx.fillRect(Math.max(0, seaX), 0, W, H);
      // Named places: garage (cyan), gun shop (pink), store (gold).
      const placeDot = (place, color, letter) => {
        ctx.fillStyle = color;
        ctx.beginPath(); ctx.arc(toX(place.x), toY(place.z), 5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#082a4a';
        ctx.font = 'bold 7px sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(letter, toX(place.x), toY(place.z));
      };
      placeDot(PLACES.garage, '#37e6ff', 'G');
      placeDot(PLACES.gunshop, '#ff4fd8', '$');
      placeDot(PLACES.store, '#ffd94a', 'S');
      // Mission target.
      if (world.missions.active) {
        const target = world.missions.targetPos();
        if (target) {
          ctx.fillStyle = '#ffd94a';
          ctx.beginPath(); ctx.arc(toX(target.x), toY(target.z), 6, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
        }
      }
      // Roadblocks (orange squares), helicopter (yellow ring).
      ctx.fillStyle = '#ff7a3c';
      for (const car of world.police.roadblocks) {
        if (car.dead) continue;
        ctx.fillRect(toX(car.mesh.position.x) - 3, toY(car.mesh.position.z) - 3, 6, 6);
      }
      if (world.heli && world.heli.active) {
        ctx.strokeStyle = '#ffe9a8';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(toX(world.heli.mesh.position.x), toY(world.heli.mesh.position.z), 7, 0, Math.PI * 2); ctx.stroke();
      }
      // Cars (white), cops (red), peds (dots).
      for (const car of world.cars) {
        if (car.dead) continue;
        ctx.fillStyle = car.isPolice ? '#ff4444' : '#ffffff';
        ctx.fillRect(toX(car.mesh.position.x) - 2, toY(car.mesh.position.z) - 2, 4, 4);
      }
      ctx.fillStyle = '#cfe8ff';
      for (const ped of world.peds) {
        if (!ped.alive || ped.down) continue;
        ctx.fillRect(toX(ped.pos.x) - 1, toY(ped.pos.z) - 1, 2, 2);
      }
      // Player arrow.
      ctx.save();
      ctx.translate(W / 2, H / 2);
      ctx.rotate(world.player.heading);
      ctx.fillStyle = '#ffd94a';
      ctx.beginPath();
      ctx.moveTo(0, -8); ctx.lineTo(5, 6); ctx.lineTo(-5, 6); ctx.closePath();
      ctx.fill();
      ctx.restore();
    },
  };
  api.setStars(0);
  api.setHealth(100);
  api.setRespect(0);
  api.setRadio('Radio off — press Q');
  return api;
}

// The next rank above the given respect, or null at the top of the ladder.
function nextRank(respect) {
  for (const rung of RESPECT_RANKS) {
    if (respect < rung.at) return rung;
  }
  return null;
}
