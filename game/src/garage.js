// Sunset Garage: drive (or walk) to the garage and press G to open the
// upgrade shop. Engine (+top speed), Armor (55% damage) and NOS (Shift
// boost) are bought with mission cash and saved with the game.
import { CFG, PLACES } from './config.js';

const UPGRADES = [
  { id: 'engine', name: 'Engine Tune', price: CFG.upgradePrices.engine, desc: '+9 top speed, faster launch' },
  { id: 'armor', name: 'Armor Plating', price: CFG.upgradePrices.armor, desc: 'Your car takes 45% less damage' },
  { id: 'nos', name: 'NOS Kit', price: CFG.upgradePrices.nos, desc: 'Hold Shift while driving for a boost' },
];

export function nearGarage(world) {
  const p = world.player.inCar ? world.player.inCar.mesh.position : world.player.pos;
  return Math.hypot(p.x - PLACES.garage.x, p.z - PLACES.garage.z) < 16;
}

export function createGarage(world) {
  const panel = document.getElementById('garage-panel');
  const list = document.getElementById('garage-list');
  const closeBtn = document.getElementById('garage-close');
  const api = {
    open: false,
    isOpen() { return this.open; },
    refresh() {
      list.innerHTML = '';
      for (const u of UPGRADES) {
        const owned = world.player.upgrades[u.id];
        const row = document.createElement('div');
        row.className = 'garage-row';
        const canAfford = world.player.money >= u.price;
        row.innerHTML = `<b>${u.name}</b> — ${u.desc}<br>` +
          (owned ? '<span class="owned">✓ INSTALLED</span>'
            : `<button ${canAfford ? '' : 'disabled'}>$${u.price} — BUY</button>`);
        const btn = row.querySelector('button');
        if (btn) btn.addEventListener('click', () => this.buy(u.id));
        list.appendChild(row);
      }
      document.getElementById('garage-money').textContent = `$${world.player.money}`;
    },
    show() {
      if (!nearGarage(world)) {
        world.toast('Find the Sunset Garage (blue roof, SW corner) to tune your ride.');
        return false;
      }
      this.open = true;
      this.refresh();
      panel.classList.remove('hidden');
      world.audio.click();
      return true;
    },
    hide() {
      this.open = false;
      panel.classList.add('hidden');
    },
    toggle() {
      if (this.open) this.hide();
      else this.show();
    },
    buy(id) {
      const u = UPGRADES.find((x) => x.id === id);
      if (!u || world.player.upgrades[id]) return false;
      if (world.player.money < u.price) {
        world.toast('Not enough cash — run more jobs first.');
        return false;
      }
      world.player.money -= u.price;
      world.player.upgrades[id] = true;
      world.audio.cash();
      world.toast(`${u.name} installed!`);
      world.hud.setMoney(world.player.money);
      world.saveGame();
      this.refresh();
      return true;
    },
  };
  closeBtn.addEventListener('click', () => api.hide());
  return api;
}

// Garage placement: PLACES.garage (-180, 180) is the south-west corner,
// marked on the minimap with a cyan G and a blue-roofed building in the city.
