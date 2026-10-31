/* Riverline equity simulator. Runs off the main thread. */
importScripts('./poker.js');

self.onmessage = function (event) {
  const data = event.data || {};
  if (data.type !== 'simulate') return;

  const started = Date.now();
  const hero = data.hero || [];
  const board = data.board || [];
  const opponents = Math.max(1, Math.min(8, Number(data.opponents) || 1));
  const iterations = Math.max(1000, Number(data.iterations) || 12000);

  if (hero.length !== 2 || board.length > 5) {
    self.postMessage({ type: 'error', id: data.id, message: 'Invalid table state.' });
    return;
  }

  const known = hero.concat(board);
  const knownSet = new Set(known);
  const unseen = [];
  for (let card = 0; card < 52; card++) {
    if (!knownSet.has(card)) unseen.push(card);
  }

  const pool = new Uint8Array(unseen.length);
  const boardFull = new Array(5);
  for (let i = 0; i < board.length; i++) boardFull[i] = board[i];
  const heroSeven = new Array(7);
  heroSeven[0] = hero[0];
  heroSeven[1] = hero[1];
  const oppSeven = new Array(7);
  const oppScores = new Array(opponents);

  let wins = 0;
  let ties = 0;
  let losses = 0;
  let equity = 0;

  for (let iteration = 0; iteration < iterations; iteration++) {
    pool.set(unseen);
    let remaining = pool.length;

    for (let i = board.length; i < 5; i++) {
      const pick = (Math.random() * remaining) | 0;
      boardFull[i] = pool[pick];
      remaining--;
      pool[pick] = pool[remaining];
    }

    heroSeven[2] = boardFull[0];
    heroSeven[3] = boardFull[1];
    heroSeven[4] = boardFull[2];
    heroSeven[5] = boardFull[3];
    heroSeven[6] = boardFull[4];
    const heroScore = self.Poker.bestScore7(heroSeven);

    let better = 0;
    let equal = 0;

    for (let p = 0; p < opponents; p++) {
      const a = (Math.random() * remaining) | 0;
      oppSeven[0] = pool[a];
      remaining--;
      pool[a] = pool[remaining];

      const b = (Math.random() * remaining) | 0;
      oppSeven[1] = pool[b];
      remaining--;
      pool[b] = pool[remaining];

      oppSeven[2] = boardFull[0];
      oppSeven[3] = boardFull[1];
      oppSeven[4] = boardFull[2];
      oppSeven[5] = boardFull[3];
      oppSeven[6] = boardFull[4];

      const score = self.Poker.bestScore7(oppSeven);
      oppScores[p] = score;
      if (score > heroScore) better++;
      else if (score === heroScore) equal++;
    }

    if (better === 0) {
      if (equal === 0) {
        wins++;
        equity += 1;
      } else {
        ties++;
        equity += 1 / (equal + 1);
      }
    } else {
      losses++;
    }
  }

  const pct = function (value) { return (value / iterations) * 100; };

  self.postMessage({
    type: 'result',
    id: data.id,
    iterations: iterations,
    opponents: opponents,
    equity: (equity / iterations) * 100,
    win: pct(wins),
    tie: pct(ties),
    lose: pct(losses),
    elapsed: Date.now() - started
  });
};
