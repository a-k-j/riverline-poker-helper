/* Riverline app shell and hand analysis UI. */
(function () {
  'use strict';

  const P = window.Poker;
  const CARD_DIALOG = document.getElementById('cardDialog');
  const RING_LENGTH = 2 * Math.PI * 50;
  const STORAGE_KEY = 'riverline.table.v1';

  const els = {
    holeRow: document.getElementById('holeRow'),
    flopRow: document.getElementById('flopRow'),
    turnRow: document.getElementById('turnRow'),
    riverRow: document.getElementById('riverRow'),
    seatState: document.getElementById('seatState'),
    heroHint: document.getElementById('heroHint'),
    streetBadge: document.getElementById('streetBadge'),
    oppMinus: document.getElementById('oppMinus'),
    oppPlus: document.getElementById('oppPlus'),
    oppCount: document.getElementById('oppCount'),
    randomBtn: document.getElementById('randomBtn'),
    clearBtn: document.getElementById('clearBtn'),
    emptyRandomBtn: document.getElementById('emptyRandomBtn'),
    emptyState: document.getElementById('emptyState'),
    emptyCopy: document.getElementById('emptyCopy'),
    analysisLive: document.getElementById('analysisLive'),
    handEyebrow: document.getElementById('handEyebrow'),
    handName: document.getElementById('handName'),
    handDetail: document.getElementById('handDetail'),
    tierBadge: document.getElementById('tierBadge'),
    bestFive: document.getElementById('bestFive'),
    bestFiveLabel: document.getElementById('bestFiveLabel'),
    ringProgress: document.getElementById('ringProgress'),
    equityValue: document.getElementById('equityValue'),
    winValue: document.getElementById('winValue'),
    tieValue: document.getElementById('tieValue'),
    loseValue: document.getElementById('loseValue'),
    strengthMeter: document.getElementById('strengthMeter'),
    strengthLabel: document.getElementById('strengthLabel'),
    equityContext: document.getElementById('equityContext'),
    simNote: document.getElementById('simNote'),
    outsPill: document.getElementById('outsPill'),
    drawChips: document.getElementById('drawChips'),
    drawNote: document.getElementById('drawNote'),
    adviceText: document.getElementById('adviceText'),
    pickerEyebrow: document.getElementById('pickerEyebrow'),
    pickerTitle: document.getElementById('pickerTitle'),
    pickerClose: document.getElementById('pickerClose'),
    deck: document.getElementById('deck'),
    removeCard: document.getElementById('removeCard'),
    cancelCard: document.getElementById('cancelCard'),
    installBtn: document.getElementById('installBtn'),
    offlineTag: document.getElementById('offlineTag'),
    toast: document.getElementById('toast')
  };

  const state = {
    hole: [null, null],
    board: [null, null, null, null, null],
    opponents: 1,
    active: null,
    results: null,
    drawInfo: null,
    generation: 0,
    timer: null,
    worker: null
  };

  const TIERS = {
    monster: { label: 'Monster', level: 5, color: '#7ee0a8' },
    strong: { label: 'Strong', level: 4, color: '#b9df8d' },
    playable: { label: 'Playable', level: 3, color: '#e7c87f' },
    marginal: { label: 'Marginal', level: 2, color: '#eeaa6f' },
    weak: { label: 'Weak', level: 1, color: '#e4857c' }
  };

  const SLOT_NAMES = {
    hole0: 'first hole card',
    hole1: 'second hole card',
    board0: 'first flop card',
    board1: 'second flop card',
    board2: 'third flop card',
    board3: 'turn card',
    board4: 'river card'
  };

  let toastTimer = null;
  let deferredInstallPrompt = null;

  /* ---------- Helpers ---------- */

  function slotKey(zone, index) {
    return zone + index;
  }

  function allChosenCards() {
    return state.hole.concat(state.board).filter(function (card) { return card !== null; });
  }

  function usedCardSet(exceptCard) {
    const set = new Set();
    allChosenCards().forEach(function (card) {
      if (card !== exceptCard) set.add(card);
    });
    return set;
  }

  function showToast(message) {
    els.toast.textContent = message;
    els.toast.classList.add('is-visible');
    if (toastTimer) window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(function () {
      els.toast.classList.remove('is-visible');
    }, 3200);
  }

  function pluralOpponents(count) {
    return count === 1 ? 'opponent' : 'opponents';
  }

  /* ---------- Card markup ---------- */

  function cardHTML(card) {
    const d = P.cardDisplay(card);
    return (
      '<span class="playing-card ' + (d.red ? 'is-red' : '') + '" aria-hidden="true">' +
        '<span class="card-corner">' +
          '<span class="card-rank">' + d.rank + '</span>' +
          '<span class="card-suit">' + d.symbol + '</span>' +
        '</span>' +
        '<span class="card-center-suit">' + d.symbol + '</span>' +
        '<span class="card-corner card-corner-bottom">' +
          '<span class="card-rank">' + d.rank + '</span>' +
          '<span class="card-suit">' + d.symbol + '</span>' +
        '</span>' +
      '</span>'
    );
  }

  function miniCardHTML(card, isBest) {
    return (
      '<span class="mini-card ' + (isBest ? 'is-best' : '') + '">' +
        cardHTML(card) +
      '</span>'
    );
  }

  /* ---------- Table rendering ---------- */

  function createSlots() {
    function makeSlot(zone, index, container) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'card-slot is-empty';
      button.dataset.zone = zone;
      button.dataset.index = String(index);
      button.addEventListener('click', function () {
        openPicker(zone, index);
      });
      container.appendChild(button);
    }

    makeSlot('hole', 0, els.holeRow);
    makeSlot('hole', 1, els.holeRow);
    makeSlot('board', 0, els.flopRow);
    makeSlot('board', 1, els.flopRow);
    makeSlot('board', 2, els.flopRow);
    makeSlot('board', 3, els.turnRow);
    makeSlot('board', 4, els.riverRow);
  }

  function renderSlots(bestSet) {
    const buttons = document.querySelectorAll('.card-slot');
    buttons.forEach(function (button) {
      const zone = button.dataset.zone;
      const index = Number(button.dataset.index);
      const card = state[zone][index];
      const name = SLOT_NAMES[slotKey(zone, index)];

      if (card === null) {
        button.className = 'card-slot is-empty';
        button.innerHTML =
          '<span class="slot-plus" aria-hidden="true"><span>+</span><span class="slot-suit">♠</span></span>';
        button.setAttribute('aria-label', 'Choose your ' + name);
      } else {
        const d = P.cardDisplay(card);
        button.className = 'card-slot is-filled' + (bestSet.has(card) ? ' is-best' : '');
        button.innerHTML = cardHTML(card);
        button.setAttribute(
          'aria-label',
          'Your ' + name + ': ' + d.rank + ' of ' + d.suitName + '. Change card.'
        );
      }
    });
  }

  function streetFor(boardCount) {
    if (boardCount === 0) return 'Preflop';
    if (boardCount < 3) return 'Partial board';
    if (boardCount === 3) return 'Flop';
    if (boardCount === 4) return 'Turn';
    return 'River';
  }

  function updateTableLabels(hole, board) {
    const starting = hole.length === 2 ? P.startingHand(hole) : null;

    if (hole.length === 0) {
      els.seatState.textContent = 'Waiting for cards';
      els.heroHint.textContent = 'Choose 2 cards';
    } else if (hole.length === 1) {
      els.seatState.textContent = 'One card to go';
      els.heroHint.textContent = 'Choose 1 more';
    } else {
      els.seatState.textContent = starting.short + ' in the hole';
      els.heroHint.textContent = 'Tap to change';
    }

    els.streetBadge.textContent = streetFor(board.length);
  }

  function updateHandInfo(hole, board, known) {
    if (board.length === 0) {
      const start = P.startingHand(hole);
      els.handEyebrow.textContent = 'Starting hand';
      els.handName.textContent = start.name;
      els.handDetail.textContent = start.detail + ' · preflop';
      return;
    }

    const hand = P.evaluateHand(known);
    els.handEyebrow.textContent = board.length < 3 ? 'Current hand · partial board' : 'Current hand';
    els.handName.textContent = hand.name;
    els.handDetail.textContent = hand.detail;
  }

  function updateBestFive(hole, board, known, hand, bestSet) {
    let cards;
    let label;

    if (known.length >= 5) {
      cards = hand.cards;
      label = 'Best five';
    } else {
      cards = known;
      label = board.length === 0 ? 'Hole cards' : 'Your cards';
    }

    els.bestFive.innerHTML = cards.map(function (card) {
      return miniCardHTML(card, known.length > 5 && bestSet.has(card));
    }).join('');
    els.bestFiveLabel.textContent = label;
  }

  /* ---------- Draw analysis ---------- */

  function unseenCards(known) {
    const seen = new Set(known);
    const out = [];
    for (let card = 0; card < 52; card++) {
      if (!seen.has(card)) out.push(card);
    }
    return out;
  }

  function completesStraight(rankSet) {
    for (let low = 0; low <= 8; low++) {
      let complete = true;
      for (let rank = low; rank < low + 5; rank++) {
        if (!rankSet.has(rank)) {
          complete = false;
          break;
        }
      }
      if (complete) return true;
    }
    return rankSet.has(12) && rankSet.has(0) && rankSet.has(1) && rankSet.has(2) && rankSet.has(3);
  }

  function updateDraws(hole, board, known) {
    const info = { chips: [], improving: 0, note: '' };
    els.drawChips.hidden = true;
    els.outsPill.hidden = true;

    if (board.length === 0) {
      info.note = 'Draws appear once the flop is dealt.';
      renderDrawInfo(info);
      return info;
    }

    if (board.length < 3) {
      info.note = 'Add the full flop to detect flush and straight draws.';
      renderDrawInfo(info);
      return info;
    }

    if (board.length === 5) {
      info.note = 'The river is dealt — no more cards to come.';
      renderDrawInfo(info);
      return info;
    }

    const current = P.evaluateHand(known);
    const rankSeen = new Array(13).fill(0);
    const suitSeen = [0, 0, 0, 0];
    const rankSet = new Set();

    known.forEach(function (card) {
      const rank = P.rankOf(card);
      rankSeen[rank]++;
      rankSet.add(rank);
      suitSeen[P.suitOf(card)]++;
    });

    const unseen = unseenCards(known);
    const namedOuts = new Set();

    // Flush draw.
    let flushSuit = -1;
    let maxSuitCount = 0;
    suitSeen.forEach(function (count, suit) {
      if (count > maxSuitCount) {
        maxSuitCount = count;
        flushSuit = suit;
      }
    });

    if (maxSuitCount === 4 && current.category < 5) {
      unseen.forEach(function (card) {
        if (P.suitOf(card) === flushSuit) namedOuts.add(card);
      });
      info.chips.push({
        kind: 'flush',
        label: 'Flush draw',
        outs: 13 - suitSeen[flushSuit]
      });
    } else if (maxSuitCount === 3 && board.length === 3 && current.category < 5) {
      info.chips.push({ kind: 'backdoor', label: 'Backdoor flush', outs: 0 });
    }

    // Straight draw.
    if (current.category < 4) {
      const completionRanks = [];
      for (let rank = 0; rank < 13; rank++) {
        if (rankSet.has(rank)) continue;
        rankSet.add(rank);
        if (completesStraight(rankSet)) completionRanks.push(rank);
        rankSet.delete(rank);
      }

      if (completionRanks.length > 0) {
        let straightOuts = 0;
        completionRanks.forEach(function (rank) {
          straightOuts += 4 - rankSeen[rank];
        });
        unseen.forEach(function (card) {
          if (completionRanks.indexOf(P.rankOf(card)) !== -1) namedOuts.add(card);
        });
        info.chips.push({
          kind: 'straight',
          label: completionRanks.length >= 2 ? 'Open-ended draw' : 'Gutshot',
          outs: straightOuts
        });
      }
    }

    // Overcards: both hole cards above the board and no pair yet.
    if (current.category === 0 && board.length >= 3) {
      const holeRanks = hole.map(P.rankOf);
      const boardRanks = board.map(P.rankOf);
      const highestBoard = Math.max.apply(null, boardRanks);
      if (holeRanks[0] > highestBoard && holeRanks[1] > highestBoard) {
        unseen.forEach(function (card) {
          const rank = P.rankOf(card);
          if (rank === holeRanks[0] || rank === holeRanks[1]) namedOuts.add(card);
        });
        info.chips.push({
          kind: 'overcards',
          label: 'Two overcards',
          outs: (4 - rankSeen[holeRanks[0]]) + (4 - rankSeen[holeRanks[1]])
        });
      }
    }

    info.improving = namedOuts.size;

    const remaining = 52 - known.length;
    let chance = 0;
    if (board.length === 4) {
      chance = (info.improving / remaining) * 100;
      info.note = info.improving
        ? 'Chance to improve on the river: ' + Math.round(chance) + '%. Outs are counted once, but not every out wins the pot.'
        : 'No clear draws right now. The river is next.';
    } else {
      const missOne = (remaining - info.improving) / remaining;
      const missTwo = (remaining - info.improving - 1) / (remaining - 1);
      chance = (1 - missOne * missTwo) * 100;
      info.note = info.improving
        ? 'Chance to improve by the river: ' + Math.round(chance) + '%. Outs are counted once, but not every out wins the pot.'
        : 'No clear draws right now.';
    }

    renderDrawInfo(info);
    return info;
  }

  function renderDrawInfo(info) {
    els.drawChips.hidden = info.chips.length === 0;
    els.outsPill.hidden = info.improving === 0;
    els.outsPill.textContent = info.improving + ' outs';
    els.drawChips.innerHTML = info.chips.map(function (chip) {
      return (
        '<span class="draw-chip" data-kind="' + chip.kind + '">' +
          chip.label +
          (chip.outs ? ' <strong>' + chip.outs + '</strong>' : '') +
        '</span>'
      );
    }).join('');
    els.drawNote.textContent = info.note;
  }

  /* ---------- Tier and advice ---------- */

  function tierFor(equity, opponents) {
    const fairShare = 100 / (opponents + 1);
    const ratio = equity / fairShare;
    if (ratio >= 1.6) return TIERS.monster;
    if (ratio >= 1.25) return TIERS.strong;
    if (ratio >= 0.95) return TIERS.playable;
    if (ratio >= 0.68) return TIERS.marginal;
    return TIERS.weak;
  }

  function adviceFor(tier, board, drawInfo) {
    const tierKey = Object.keys(TIERS).find(function (key) { return TIERS[key] === tier; });

    if (board.length === 0) {
      if (tierKey === 'monster') return 'Premium starting hand. Play confidently and build the pot.';
      if (tierKey === 'strong') return 'A strong start. Open or continue with confidence.';
      if (tierKey === 'playable') return 'Playable, but position and the action still matter.';
      if (tierKey === 'marginal') return 'Speculative. Continue only when the price is right.';
      return 'A weak starting hand. Fold unless you have a very good reason to continue.';
    }

    if (tierKey === 'monster') return 'You are well ahead of a random range. Bet for value and protect your equity.';
    if (tierKey === 'strong') return 'A strong spot. Keep betting for value, with an eye on scary turns and rivers.';
    if (tierKey === 'playable') return 'A reasonable spot. Continue, but stay aware of what the next card can change.';
    if (tierKey === 'marginal') return 'Marginal. Let pot odds and your opponent’s action decide the next step.';
    if (drawInfo && drawInfo.improving > 0) {
      return 'Behind right now, but you have ' + drawInfo.improving + ' outs to improve. Let the price decide.';
    }
    return 'Likely behind. Fold unless the price is very good.';
  }

  function setStrengthMeter(level) {
    const bars = els.strengthMeter.querySelectorAll('span');
    bars.forEach(function (bar, index) {
      bar.classList.toggle('is-on', index < level);
    });
  }

  function resetEquityPanel() {
    els.analysisLive.classList.add('is-loading');
    els.analysisLive.style.setProperty('--tier', TIERS.playable.color);
    els.ringProgress.style.strokeDashoffset = String(RING_LENGTH);
    els.equityValue.textContent = '—';
    els.winValue.textContent = '—';
    els.tieValue.textContent = '—';
    els.loseValue.textContent = '—';
    els.tierBadge.textContent = 'Reading';
    els.tierBadge.dataset.tier = 'playable';
    els.strengthLabel.textContent = 'Reading the spot';
    setStrengthMeter(0);
    els.simNote.textContent = 'Running the numbers…';
    els.adviceText.textContent = 'Simulating thousands of runouts…';
  }

  function applyResults(result, hole, board) {
    state.results = result;
    const tier = tierFor(result.equity, result.opponents);
    const equityRounded = Math.round(result.equity);

    els.analysisLive.classList.remove('is-loading');
    els.analysisLive.style.setProperty('--tier', tier.color);
    els.tierBadge.textContent = tier.label;
    els.tierBadge.dataset.tier = Object.keys(TIERS).find(function (key) { return TIERS[key] === tier; });
    els.strengthLabel.textContent = tier.label;
    setStrengthMeter(tier.level);

    els.equityValue.textContent = equityRounded + '%';
    els.ringProgress.style.strokeDashoffset = String(RING_LENGTH * (1 - result.equity / 100));
    els.winValue.textContent = result.win.toFixed(1) + '%';
    els.tieValue.textContent = result.tie.toFixed(1) + '%';
    els.loseValue.textContent = result.lose.toFixed(1) + '%';
    els.equityContext.textContent = 'Simulated vs ' + result.opponents + ' ' + pluralOpponents(result.opponents);
    els.simNote.textContent =
      'vs ' + result.opponents + ' random ' + pluralOpponents(result.opponents) +
      ' · ' + result.iterations.toLocaleString() + ' runouts';
    els.adviceText.textContent = adviceFor(tier, board, state.drawInfo);
  }

  /* ---------- Simulation ---------- */

  function iterationsFor(opponents) {
    if (opponents <= 2) return 16000;
    if (opponents <= 4) return 10000;
    if (opponents <= 6) return 7000;
    return 6000;
  }

  function cancelSimulation() {
    state.generation++;
    if (state.timer) {
      window.clearTimeout(state.timer);
      state.timer = null;
    }
    if (state.worker) {
      state.worker.terminate();
      state.worker = null;
    }
  }

  function scheduleSimulation(hole, board) {
    cancelSimulation();
    resetEquityPanel();
    const generation = state.generation;
    state.timer = window.setTimeout(function () {
      runSimulation(generation, hole, board);
    }, 130);
  }

  function runSimulation(generation, hole, board) {
    if (generation !== state.generation) return;

    const opponents = state.opponents;
    const iterations = iterationsFor(opponents);

    try {
      const worker = new Worker('./assets/equity-worker.js');
      state.worker = worker;

      worker.onmessage = function (event) {
        if (generation !== state.generation) {
          worker.terminate();
          return;
        }
        const data = event.data || {};
        if (data.type === 'result') {
          worker.terminate();
          state.worker = null;
          applyResults(data, hole, board);
        } else if (data.type === 'error') {
          worker.terminate();
          state.worker = null;
          runLocalSimulation(generation, hole, board);
        }
      };

      worker.onerror = function () {
        worker.terminate();
        state.worker = null;
        if (generation === state.generation) {
          runLocalSimulation(generation, hole, board);
        }
      };

      worker.postMessage({
        type: 'simulate',
        id: generation,
        hero: hole.slice(),
        board: board.slice(),
        opponents: opponents,
        iterations: iterations
      });
    } catch (error) {
      runLocalSimulation(generation, hole, board);
    }
  }

  function runLocalSimulation(generation, hole, board) {
    if (generation !== state.generation) return;
    const iterations = Math.min(iterationsFor(state.opponents), 6000);

    window.setTimeout(function () {
      if (generation !== state.generation) return;
      try {
        const result = simulateLocally(hole, board, state.opponents, iterations);
        if (generation === state.generation) applyResults(result, hole, board);
      } catch (error) {
        els.analysisLive.classList.remove('is-loading');
        els.simNote.textContent = 'Equity simulation is unavailable right now.';
        els.adviceText.textContent = 'Still check your made hand and draws while the simulator is unavailable.';
        els.equityValue.textContent = '—';
      }
    }, 30);
  }

  function simulateLocally(hole, board, opponents, iterations) {
    const known = hole.concat(board);
    const unseen = unseenCards(known);
    const pool = new Uint8Array(unseen.length);
    const boardFull = new Array(5);
    const heroSeven = new Array(7);
    const oppSeven = new Array(7);
    let wins = 0;
    let ties = 0;
    let losses = 0;
    let equity = 0;

    for (let i = 0; i < board.length; i++) boardFull[i] = board[i];
    heroSeven[0] = hole[0];
    heroSeven[1] = hole[1];

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
      const heroScore = P.bestScore7(heroSeven);

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

        const score = P.bestScore7(oppSeven);
        if (score > heroScore) better++;
        else if (score === heroScore) equal++;
      }

      if (better === 0) {
        if (equal === 0) {
          wins++;
          equity++;
        } else {
          ties++;
          equity += 1 / (equal + 1);
        }
      } else {
        losses++;
      }
    }

    return {
      iterations: iterations,
      opponents: opponents,
      equity: (equity / iterations) * 100,
      win: (wins / iterations) * 100,
      tie: (ties / iterations) * 100,
      lose: (losses / iterations) * 100,
      elapsed: 0
    };
  }

  /* ---------- Main refresh ---------- */

  function refresh(options) {
    const settings = options || {};
    const hole = state.hole.filter(function (card) { return card !== null; });
    const board = state.board.filter(function (card) { return card !== null; });
    const known = hole.concat(board);
    const hand = known.length ? P.evaluateHand(known) : null;
    const bestSet = new Set();

    if (known.length > 5 && hand) {
      hand.cards.forEach(function (card) { bestSet.add(card); });
    }

    renderSlots(bestSet);
    updateTableLabels(hole, board);

    if (settings.save !== false) saveState();

    if (hole.length < 2) {
      cancelSimulation();
      state.results = null;
      state.drawInfo = null;
      els.emptyState.hidden = false;
      els.analysisLive.hidden = true;
      els.emptyCopy.textContent = hole.length === 1
        ? 'One card to go. Choose your second hole card to unlock your hand read, draws, and equity.'
        : 'Choose your two hole cards to see your made hand, your draws, and your equity against random hands.';
      return;
    }

    els.emptyState.hidden = true;
    els.analysisLive.hidden = false;
    updateHandInfo(hole, board, known);
    updateBestFive(hole, board, known, hand, bestSet);
    state.drawInfo = updateDraws(hole, board, known);
    state.results = null;
    els.equityContext.textContent = 'Simulated vs ' + state.opponents + ' ' + pluralOpponents(state.opponents);
    scheduleSimulation(hole, board);
  }

  /* ---------- Card picker ---------- */

  function pickerZoneLabel(zone, index) {
    if (zone === 'hole') return index === 0 ? 'Your first hole card' : 'Your second hole card';
    if (index < 3) return 'Flop card ' + (index + 1);
    if (index === 3) return 'Turn card';
    return 'River card';
  }

  function openPicker(zone, index) {
    state.active = { zone: zone, index: index };
    const current = state[zone][index];
    els.pickerEyebrow.textContent = pickerZoneLabel(zone, index);
    els.pickerTitle.textContent = current === null ? 'Choose a card' : 'Change your card';
    els.removeCard.hidden = current === null;
    renderDeck(current);
    els.deck.scrollTop = 0;
    if (!CARD_DIALOG.open) CARD_DIALOG.showModal();
  }

  function renderDeck(currentCard) {
    const used = usedCardSet(currentCard);
    const suitOrder = [0, 1, 2, 3];

    els.deck.innerHTML = suitOrder.map(function (suitIndex) {
      const suit = P.SUITS[suitIndex];
      const cards = [];

      for (let rank = 12; rank >= 0; rank--) {
        const card = P.makeCard(rank, suitIndex);
        const isCurrent = card === currentCard;
        const isUsed = used.has(card);
        const isRed = suit.red;
        const label = P.RANK_LABELS[rank];
        const classes = ['deck-card'];

        if (isRed) classes.push('is-red');
        if (isCurrent) classes.push('is-current');
        if (isUsed) classes.push('is-used');

        cards.push(
          '<button type="button" class="' + classes.join(' ') + '"' +
            ' data-card="' + card + '"' +
            (isUsed ? ' disabled' : '') +
            ' aria-label="' + label + ' of ' + suit.name + (isUsed ? ', already in use' : '') + '">' +
            '<span class="deck-rank">' + label + '</span>' +
            '<span class="deck-suit">' + suit.symbol + '</span>' +
          '</button>'
        );
      }

      return (
        '<div class="deck-suit">' +
          '<div class="deck-suit-head">' +
            '<span class="suit-symbol ' + (suit.red ? 'is-red' : 'is-black') + '">' + suit.symbol + '</span>' +
            suit.name +
          '</div>' +
          '<div class="deck-grid">' + cards.join('') + '</div>' +
        '</div>'
      );
    }).join('');
  }

  function chooseCard(card) {
    if (!state.active) return;
    const zone = state.active.zone;
    const index = state.active.index;
    state[zone][index] = card;
    CARD_DIALOG.close();
    refresh();
  }

  function removeActiveCard() {
    if (!state.active) return;
    state[state.active.zone][state.active.index] = null;
    CARD_DIALOG.close();
    refresh();
  }

  /* ---------- Table actions ---------- */

  function setOpponents(value) {
    state.opponents = Math.max(1, Math.min(8, value));
    els.oppCount.textContent = String(state.opponents);
    els.oppMinus.disabled = state.opponents === 1;
    els.oppPlus.disabled = state.opponents === 8;
    refresh();
  }

  function dealRandom() {
    const deck = [];
    for (let card = 0; card < 52; card++) deck.push(card);
    for (let i = deck.length - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0;
      const temp = deck[i];
      deck[i] = deck[j];
      deck[j] = temp;
    }

    state.hole = [deck[0], deck[1]];
    state.board = [deck[2], deck[3], deck[4], deck[5], deck[6]];
    state.results = null;
    if (CARD_DIALOG.open) CARD_DIALOG.close();
    refresh();
    showToast('Random hand dealt.');
  }

  function clearTable() {
    state.hole = [null, null];
    state.board = [null, null, null, null, null];
    state.results = null;
    if (CARD_DIALOG.open) CARD_DIALOG.close();
    refresh();
    showToast('Table cleared.');
  }

  /* ---------- Persistence ---------- */

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        hole: state.hole,
        board: state.board,
        opponents: state.opponents
      }));
    } catch (error) {
      // Storage can be unavailable in private mode; the app still works.
    }
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      const hole = Array.isArray(data.hole) && data.hole.length === 2 ? data.hole : [null, null];
      const board = Array.isArray(data.board) && data.board.length === 5 ? data.board : [null, null, null, null, null];

      const validCard = function (card) {
        return card === null || (Number.isInteger(card) && card >= 0 && card < 52);
      };
      if (!hole.every(validCard) || !board.every(validCard)) return;

      const chosen = hole.concat(board).filter(function (card) { return card !== null; });
      if (new Set(chosen).size !== chosen.length) return;

      state.hole = hole;
      state.board = board;
      if (Number.isInteger(data.opponents)) {
        state.opponents = Math.max(1, Math.min(8, data.opponents));
      }
    } catch (error) {
      // Ignore malformed saved tables.
    }
  }

  /* ---------- PWA ---------- */

  function setupInstall() {
    window.addEventListener('beforeinstallprompt', function (event) {
      event.preventDefault();
      deferredInstallPrompt = event;
      els.installBtn.hidden = false;
    });

    els.installBtn.addEventListener('click', function () {
      if (!deferredInstallPrompt) return;
      deferredInstallPrompt.prompt();
      deferredInstallPrompt.userChoice.then(function (choice) {
        if (choice.outcome === 'accepted') showToast('Riverline is being installed.');
        deferredInstallPrompt = null;
        els.installBtn.hidden = true;
      });
    });

    window.addEventListener('appinstalled', function () {
      deferredInstallPrompt = null;
      els.installBtn.hidden = true;
      showToast('Riverline installed. It now works offline.');
    });

    if (window.matchMedia('(display-mode: standalone)').matches) {
      els.installBtn.hidden = true;
    }
  }

  function setupServiceWorker() {
    if (!('serviceWorker' in navigator) || window.location.protocol === 'file:') return;

    navigator.serviceWorker.register('./sw.js').then(function () {
      return navigator.serviceWorker.ready;
    }).then(function () {
      els.offlineTag.hidden = false;
    }).catch(function () {
      // The app is still fully usable without offline caching.
    });
  }

  /* ---------- Events ---------- */

  function bindEvents() {
    els.randomBtn.addEventListener('click', dealRandom);
    els.emptyRandomBtn.addEventListener('click', dealRandom);
    els.clearBtn.addEventListener('click', clearTable);
    els.oppMinus.addEventListener('click', function () { setOpponents(state.opponents - 1); });
    els.oppPlus.addEventListener('click', function () { setOpponents(state.opponents + 1); });

    els.pickerClose.addEventListener('click', function () { CARD_DIALOG.close(); });
    els.cancelCard.addEventListener('click', function () { CARD_DIALOG.close(); });
    els.removeCard.addEventListener('click', removeActiveCard);

    els.deck.addEventListener('click', function (event) {
      const button = event.target.closest('.deck-card');
      if (!button || button.disabled) return;
      chooseCard(Number(button.dataset.card));
    });

    CARD_DIALOG.addEventListener('click', function (event) {
      if (event.target === CARD_DIALOG) CARD_DIALOG.close();
    });

    CARD_DIALOG.addEventListener('close', function () {
      state.active = null;
    });

    window.addEventListener('online', function () {
      showToast('Back online.');
    });
  }

  /* ---------- Boot ---------- */

  function init() {
    createSlots();
    loadState();
    els.oppCount.textContent = String(state.opponents);
    els.oppMinus.disabled = state.opponents === 1;
    els.oppPlus.disabled = state.opponents === 8;
    bindEvents();
    refresh({ save: false });

    const params = new URLSearchParams(window.location.search);
    if (params.get('deal') === 'random') {
      dealRandom();
    }

    setupInstall();
    setupServiceWorker();
  }

  init();
})();
