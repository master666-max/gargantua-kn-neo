/* storage.js -- localStorage persistence (params, quality, debug view, camera,
   music preference).  Every access is guarded: private-mode browsers throw. */
const NS = 'gargantua-kn-v2.';

function safe(fn, fallback) {
  try { return fn(); } catch (e) { return fallback; }
}
export const store = {
  get(key, fallback) {
    return safe(() => {
      const raw = localStorage.getItem(NS + key);
      if (raw == null) return fallback;
      return JSON.parse(raw);
    }, fallback);
  },
  set(key, value) {
    return safe(() => { localStorage.setItem(NS + key, JSON.stringify(value)); return true; }, false);
  },
  del(key) { safe(() => localStorage.removeItem(NS + key)); },
  clearAll() {
    safe(() => {
      const kill = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.indexOf(NS) === 0) kill.push(k);
      }
      kill.forEach(k => localStorage.removeItem(k));
    });
  },
};
