/*
 * Riverline poker engine
 * Cards are encoded as integers 0-51: rankIndex * 4 + suitIndex.
 * rankIndex: 0 = 2 ... 12 = A. suitIndex: 0 = spades, 1 = hearts,
 * 2 = diamonds, 3 = clubs.
 */
(function (root) {
  'use strict';

  const RANK_CHARS = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];
  const RANK_LABELS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
  const SINGULAR = [
    'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
    'Jack', 'Queen', 'King', 'Ace'
  ];
  const PLURAL = [
    'Twos', 'Threes', 'Fours', 'Fives', 'Sixes', 'Sevens', 'Eights', 'Nines',
    'Tens', 'Jacks', 'Queens', 'Kings', 'Aces'
  ];
  const SUITS = [
    { id: 's', symbol: '\u2660', name: 'Spades', red: false },
    { id: 'h', symbol: '\u2665', name: 'Hearts', red: true },
    { id: 'd', symbol: '\u2666', name: 'Diamonds', red: true },
    { id: 'c', symbol: '\u2663', name: 'Clubs', red: false }
  ];
  const SUIT_INDEX = { s: 0, h: 1, d: 2, c: 3 };
  const CATEGORY_NAMES = [
    'High Card', 'One Pair', 'Two Pair', 'Three of a Kind', 'Straight',
    'Flush', 'Full House', 'Four of a Kind', 'Straight Flush'
  ];
  const CATEGORY_UNITS = 759375; // 15^5

  // Scratch space, reused by the hot evaluator.
  const rankCounts = new Uint8Array(13);

  function makeCard(rankIndex, suitIndex) {
    return rankIndex * 4 + suitIndex;
  }

  function rankOf(card) {
    return card >> 2;
  }

  function suitOf(card) {
    return card & 3;
  }

  function cardFromString(str) {
    const rank = RANK_CHARS.indexOf(str[0].toUpperCase());
    const suit = SUIT_INDEX[str[1].toLowerCase()];
    if (rank < 0 || suit === undefined) return null;
    return makeCard(rank, suit);
  }

  function cardToString(card) {
    return RANK_CHARS[rankOf(card)] + SUITS[suitOf(card)].id;
  }

  function cardDisplay(card) {
    const rank = rankOf(card);
    const suit = SUITS[suitOf(card)];
    return {
      rank: RANK_LABELS[rank],
      rankChar: RANK_CHARS[rank],
      suit: suit.id,
      symbol: suit.symbol,
      suitName: suit.name,
      red: suit.red
    };
  }

  function encode(category, a, b, c, d, e) {
    return (((((category * 15 + a) * 15 + b) * 15 + c) * 15 + d) * 15 + e);
  }

  /*
   * Evaluate exactly five cards. Returns a single comparable integer.
   * The high category is the dominant term, then up to five tie-breakers.
   */
  function evaluate5(c0, c1, c2, c3, c4) {
    const r0 = c0 >> 2, r1 = c1 >> 2, r2 = c2 >> 2, r3 = c3 >> 2, r4 = c4 >> 2;
    const s0 = c0 & 3, s1 = c1 & 3, s2 = c2 & 3, s3 = c3 & 3, s4 = c4 & 3;

    rankCounts.fill(0);
    rankCounts[r0]++;
    rankCounts[r1]++;
    rankCounts[r2]++;
    rankCounts[r3]++;
    rankCounts[r4]++;

    const flush = s0 === s1 && s1 === s2 && s2 === s3 && s3 === s4;
    const distinct = [];
    let four = -1;
    let three = -1;
    let pairHigh = -1;
    let pairLow = -1;

    for (let r = 12; r >= 0; r--) {
      const n = rankCounts[r];
      if (!n) continue;
      distinct.push(r);
      if (n === 4) four = r;
      else if (n === 3) {
        if (three === -1) three = r;
      } else if (n === 2) {
        if (pairHigh === -1) pairHigh = r;
        else if (pairLow === -1) pairLow = r;
      }
    }

    let straightHigh = -1;
    if (distinct.length === 5) {
      if (distinct[0] - distinct[4] === 4) {
        straightHigh = distinct[0];
      } else if (distinct[0] === 12 && distinct[1] === 3 && distinct[4] === 0) {
        straightHigh = 3; // Five-high wheel
      }
    }

    if (flush && straightHigh >= 0) {
      return encode(8, straightHigh, 0, 0, 0, 0);
    }

    if (four >= 0) {
      let kicker = 0;
      for (let i = 0; i < distinct.length; i++) {
        if (distinct[i] !== four) { kicker = distinct[i]; break; }
      }
      return encode(7, four, kicker, 0, 0, 0);
    }

    if (three >= 0 && pairHigh >= 0) {
      return encode(6, three, pairHigh, 0, 0, 0);
    }

    if (flush) {
      return encode(5, distinct[0], distinct[1], distinct[2], distinct[3], distinct[4]);
    }

    if (straightHigh >= 0) {
      return encode(4, straightHigh, 0, 0, 0, 0);
    }

    if (three >= 0) {
      const kickers = [];
      for (let i = 0; i < distinct.length && kickers.length < 2; i++) {
        if (distinct[i] !== three) kickers.push(distinct[i]);
      }
      return encode(3, three, kickers[0] || 0, kickers[1] || 0, 0, 0);
    }

    if (pairHigh >= 0 && pairLow >= 0) {
      let kicker = 0;
      for (let i = 0; i < distinct.length; i++) {
        if (distinct[i] !== pairHigh && distinct[i] !== pairLow) {
          kicker = distinct[i];
          break;
        }
      }
      return encode(2, pairHigh, pairLow, kicker, 0, 0);
    }

    if (pairHigh >= 0) {
      const kickers = [];
      for (let i = 0; i < distinct.length && kickers.length < 3; i++) {
        if (distinct[i] !== pairHigh) kickers.push(distinct[i]);
      }
      return encode(1, pairHigh, kickers[0] || 0, kickers[1] || 0, kickers[2] || 0, 0);
    }

    return encode(0, distinct[0], distinct[1], distinct[2], distinct[3], distinct[4]);
  }

  function categoryOfScore(score) {
    return Math.floor(score / CATEGORY_UNITS);
  }

  function combinations(n, k) {
    const out = [];
    const current = [];
    function walk(start) {
      if (current.length === k) {
        out.push(current.slice());
        return;
      }
      for (let i = start; i <= n - (k - current.length); i++) {
        current.push(i);
        walk(i + 1);
        current.pop();
      }
    }
    walk(0);
    return out;
  }

  const FIVE_COMBOS = {
    5: combinations(5, 5),
    6: combinations(6, 5),
    7: combinations(7, 5)
  };

  // Hot path used by the Monte Carlo worker. Takes exactly seven cards.
  function bestScore7(cards) {
    const combos = FIVE_COMBOS[7];
    let best = -1;
    for (let i = 0; i < 21; i++) {
      const combo = combos[i];
      const score = evaluate5(
        cards[combo[0]], cards[combo[1]], cards[combo[2]], cards[combo[3]], cards[combo[4]]
      );
      if (score > best) best = score;
    }
    return best;
  }

  function describeFive(cards) {
    rankCounts.fill(0);
    const suits = [0, 0, 0, 0];
    for (let i = 0; i < cards.length; i++) {
      rankCounts[rankOf(cards[i])]++;
      suits[suitOf(cards[i])]++;
    }

    const distinct = [];
    let four = -1;
    let three = -1;
    let pairHigh = -1;
    let pairLow = -1;
    for (let r = 12; r >= 0; r--) {
      const n = rankCounts[r];
      if (!n) continue;
      distinct.push(r);
      if (n === 4) four = r;
      else if (n === 3) {
        if (three === -1) three = r;
      } else if (n === 2) {
        if (pairHigh === -1) pairHigh = r;
        else if (pairLow === -1) pairLow = r;
      }
    }

    const flush = suits[0] === 5 || suits[1] === 5 || suits[2] === 5 || suits[3] === 5;
    let straightHigh = -1;
    if (distinct.length === 5) {
      if (distinct[0] - distinct[4] === 4) straightHigh = distinct[0];
      else if (distinct[0] === 12 && distinct[1] === 3 && distinct[4] === 0) straightHigh = 3;
    }

    let category = 0;
    let name = 'High Card';
    let detail = SINGULAR[distinct[0]] + ' high';

    if (flush && straightHigh >= 0) {
      category = 8;
      name = 'Straight Flush';
      detail = straightHigh === 12
        ? 'Royal flush'
        : SINGULAR[straightHigh] + '-high straight flush';
    } else if (four >= 0) {
      category = 7;
      name = 'Four of a Kind';
      detail = 'Four ' + PLURAL[four];
    } else if (three >= 0 && pairHigh >= 0) {
      category = 6;
      name = 'Full House';
      detail = PLURAL[three] + ' full of ' + PLURAL[pairHigh];
    } else if (flush) {
      category = 5;
      name = 'Flush';
      detail = SINGULAR[distinct[0]] + '-high flush';
    } else if (straightHigh >= 0) {
      category = 4;
      name = 'Straight';
      detail = SINGULAR[straightHigh] + '-high straight';
    } else if (three >= 0) {
      category = 3;
      name = 'Three of a Kind';
      detail = 'Three ' + PLURAL[three];
    } else if (pairHigh >= 0 && pairLow >= 0) {
      category = 2;
      name = 'Two Pair';
      let kicker = 0;
      for (let i = 0; i < distinct.length; i++) {
        if (distinct[i] !== pairHigh && distinct[i] !== pairLow) {
          kicker = distinct[i];
          break;
        }
      }
      detail = PLURAL[pairHigh] + ' and ' + PLURAL[pairLow] + ', ' + SINGULAR[kicker] + ' kicker';
    } else if (pairHigh >= 0) {
      category = 1;
      name = 'One Pair';
      let kicker = 0;
      for (let i = 0; i < distinct.length; i++) {
        if (distinct[i] !== pairHigh) {
          kicker = distinct[i];
          break;
        }
      }
      detail = 'Pair of ' + PLURAL[pairHigh] + ', ' + SINGULAR[kicker] + ' kicker';
    }

    return { category, name, detail };
  }

  function evaluatePartial(cards) {
    rankCounts.fill(0);
    for (let i = 0; i < cards.length; i++) rankCounts[rankOf(cards[i])]++;

    let four = -1;
    let three = -1;
    const pairs = [];
    const singles = [];
    for (let r = 12; r >= 0; r--) {
      const n = rankCounts[r];
      if (n === 4) four = r;
      else if (n === 3) three = r;
      else if (n === 2) pairs.push(r);
      else if (n === 1) singles.push(r);
    }

    let category = 0;
    let name = 'High Card';
    let detail = '';

    if (four >= 0) {
      category = 7;
      name = 'Four of a Kind';
      detail = 'Four ' + PLURAL[four];
    } else if (three >= 0 && pairs.length) {
      category = 6;
      name = 'Full House';
      detail = PLURAL[three] + ' full of ' + PLURAL[pairs[0]];
    } else if (three >= 0) {
      category = 3;
      name = 'Three of a Kind';
      detail = 'Three ' + PLURAL[three];
    } else if (pairs.length >= 2) {
      category = 2;
      name = 'Two Pair';
      detail = PLURAL[pairs[0]] + ' and ' + PLURAL[pairs[1]];
    } else if (pairs.length === 1) {
      category = 1;
      name = 'One Pair';
      detail = 'Pair of ' + PLURAL[pairs[0]];
    } else if (singles.length) {
      detail = SINGULAR[singles[0]] + ' high';
      if (cards.length === 2) {
        const suited = suitOf(cards[0]) === suitOf(cards[1]);
        detail = SINGULAR[singles[0]] + '-' + SINGULAR[singles[1]] + (suited ? ' suited' : ' offsuit');
      }
    }

    return { score: null, category, name, detail, cards: cards.slice(), partial: true };
  }

  function evaluateHand(cards) {
    if (!cards || !cards.length) {
      return { score: null, category: -1, name: 'No cards', detail: 'Pick your hand to begin', cards: [], partial: true };
    }
    if (cards.length < 5) return evaluatePartial(cards);

    const n = Math.min(cards.length, 7);
    const combos = FIVE_COMBOS[n];
    let best = -1;
    let bestCombo = null;
    for (let i = 0; i < combos.length; i++) {
      const combo = combos[i];
      const score = evaluate5(
        cards[combo[0]], cards[combo[1]], cards[combo[2]], cards[combo[3]], cards[combo[4]]
      );
      if (score > best) {
        best = score;
        bestCombo = combo;
      }
    }

    const bestCards = bestCombo.map(function (index) { return cards[index]; });
    const info = describeFive(bestCards);
    return {
      score: best,
      category: info.category,
      name: info.name,
      detail: info.detail,
      cards: bestCards,
      partial: false
    };
  }

  function startingHand(hole) {
    if (!hole || hole.length < 2) return null;
    const r0 = rankOf(hole[0]);
    const r1 = rankOf(hole[1]);
    const high = Math.max(r0, r1);
    const low = Math.min(r0, r1);
    const suited = suitOf(hole[0]) === suitOf(hole[1]);

    if (high === low) {
      return {
        name: 'Pocket ' + PLURAL[high],
        detail: 'Pocket pair',
        short: RANK_CHARS[high] + RANK_CHARS[high]
      };
    }

    return {
      name: RANK_CHARS[high] + RANK_CHARS[low] + (suited ? ' suited' : ' offsuit'),
      detail: SINGULAR[high] + '-' + SINGULAR[low] + (suited ? ' suited' : ' offsuit'),
      short: RANK_CHARS[high] + RANK_CHARS[low] + (suited ? 's' : 'o')
    };
  }

  function cardRankLabel(card) {
    return RANK_LABELS[rankOf(card)];
  }

  root.Poker = {
    RANK_CHARS: RANK_CHARS,
    RANK_LABELS: RANK_LABELS,
    SINGULAR: SINGULAR,
    PLURAL: PLURAL,
    SUITS: SUITS,
    CATEGORY_NAMES: CATEGORY_NAMES,
    makeCard: makeCard,
    rankOf: rankOf,
    suitOf: suitOf,
    cardFromString: cardFromString,
    cardToString: cardToString,
    cardDisplay: cardDisplay,
    cardRankLabel: cardRankLabel,
    evaluate5: evaluate5,
    bestScore7: bestScore7,
    categoryOfScore: categoryOfScore,
    evaluateHand: evaluateHand,
    startingHand: startingHand
  };
})(typeof self !== 'undefined' ? self : globalThis);
