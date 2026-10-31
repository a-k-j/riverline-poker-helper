# Riverline — Poker Hand Helper

A polished, offline-ready poker hand helper. Pick your hole cards and the community board to see your made hand, draws and outs, and simulated equity against random opponents.

No account, no backend, no tracking. Everything runs in your browser and your last table is saved on your device.

## Run it locally

There is no build step and no dependencies. Serve the folder over HTTP so the service worker and install prompt can work:

```sh
python3 -m http.server 4173 --bind 127.0.0.1
```

Then open <http://127.0.0.1:4173/>.

Any static file server works. Opening `index.html` directly from disk will still run the evaluator, but service worker caching and installation require `localhost` or HTTPS.

## Install as an app

- **Chrome / Edge:** use the install icon in the address bar, or the **Install app** button in the header when available.
- **iOS Safari:** Share → **Add to Home Screen**.
- **Android:** browser menu → **Install app** / **Add to Home screen**.

Once installed, the app opens standalone and works offline.

## Features

- Card picker for two hole cards, the flop, turn and river, with duplicate-card prevention.
- Best-five hand evaluation across all combinations, from high card to straight flush.
- Draw detection: flush draws, backdoor flush draws, open-ended straight draws, gutshots and overcards, with deduplicated outs.
- Monte Carlo equity simulation against 1–8 random opponents in a Web Worker, with a main-thread fallback.
- Automatic hand tier and contextual advice based on equity, street and draws.
- Responsive desktop and mobile layout with a bottom-sheet card picker on small screens.
- Installable PWA with offline app-shell caching and persistent table state.

## Project layout

```text
index.html                 App shell and UI markup
assets/styles.css          Responsive poker-themed design
assets/app.js              UI state, picker, persistence, draws and simulation orchestration
assets/poker.js            Card encoding, hand evaluator and best-five selection
assets/equity-worker.js    Monte Carlo equity worker
assets/fonts/              Self-hosted Manrope and DM Serif Display
icons/                     App icons, maskable icons and favicons
manifest.webmanifest       PWA metadata
sw.js                      Offline app-shell service worker
```

## Notes

- Equity is simulated against random hands; treat it as context, not betting advice.
- The service worker uses a cache-first strategy for static assets. Bump `CACHE_NAME` in `sw.js` after changing cached files.
- Local table state is stored under `riverline.table.v1` in `localStorage`.
