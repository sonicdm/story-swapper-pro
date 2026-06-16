import {
  STOP_WORDS, ADJ_SUFFIXES, VERB_SUFFIXES, NOUN_SUFFIXES, VERB_FALSE, MODALS,
  DETERMINERS, CATEGORY_WEIGHTS, CATEGORY_LABELS, CATEGORY_HINTS, AUTO_PROMPTS, listHas
} from './constants.js';
import { filterPoolWithDictionary, validatePoolItem } from './dictionary-pos.js';
import {
  IRREGULAR_PAST, isPastTenseForm, isKnownVerbForm, isComparativeAdjective,
  isIngNounContext, looksLikeProperName, resolveProperNounCategory, isIdiomPart, isCompoundProtected, isLikelyPluralNoun,
  isPoeticOrArchaicForm, normalizeForPos, isPrepositionWord, isAbstractPoeticContext,
  isParticipleAfterName, isColorWord, isShoutVerb, isGerundVerb, isLexicalCompound,
  isReportingVerbBeforeName
} from './grammar.js';
import { posFromWinkTag } from './nlp-hints.js';

function hasSuffix(word, suffixes) {
  return suffixes.some(s => word.endsWith(s) && word.length > s.length + 2);
}

const MODIFIERS = new Set(['still', 'very', 'so', 'too', 'quite', 'rather', 'more', 'most', 'less', 'least', 'almost', 'nearly']);

function prevNounish(prev) {
  return DETERMINERS.has(prev) || listHas('personNouns', prev) || listHas('places', prev) ||
    listHas('objects', prev) || listHas('animals', prev) || listHas('bodyParts', prev) ||
    hasSuffix(prev, NOUN_SUFFIXES);
}

const GRAMMAR_CATS = new Set([
  'verb', 'past-tense verb', 'verb ending in -ing', 'adjective', 'adverb',
  'plural noun', 'noun', 'number'
]);

function applyResolvedGrammar(cats, w, prevWord, hints, nextWord = '') {
  const fun = cats.filter(c => !GRAMMAR_CATS.has(c));
  const pos = classifyWordPos(w, prevWord, hints, nextWord);
  const grammar = [];
  if (pos === 'verb') {
    grammar.push('verb');
    if (isPastTenseForm(w)) grammar.push('past-tense verb');
    if (isGerundVerb(w, prevWord, nextWord)) grammar.push('verb ending in -ing');
  } else if (pos === 'adjective') grammar.push('adjective');
  else if (pos === 'plural') grammar.push('plural noun');
  else if (pos === 'preposition') { /* skip grammar slot */ }
  else grammar.push('noun');
  return [...fun, ...grammar];
}

const NOUN_AFTER_DETERMINER = new Set([
  'rest', 'test', 'change', 'use', 'help', 'watch', 'walk', 'run', 'play', 'work', 'call',
  'mind', 'answer', 'picture', 'tour', 'report', 'exchange', 'sleep', 'dream', 'end',
  'start', 'turn', 'move', 'fall', 'rise'
]);

function classifyWordPos(w, prevWord, hints, nextWord = '') {
  const posW = normalizeForPos(w);
  if (isPrepositionWord(posW) || hints?.preposition?.has(w) || hints?.preposition?.has(posW)) {
    return 'preposition';
  }
  if (/['\u2019\u2018]s$/.test(w)) return 'noun';
  if (hints?.noun?.has(posW) && !hints?.verb?.has(posW)) return 'noun';
  if (hints?.adjective?.has(posW) && !hints?.verb?.has(posW) && !isPrepositionWord(posW)) return 'adjective';
  if (hints?.verb?.has(posW) && !isIngNounContext(w, prevWord, nextWord)) return 'verb';

  const afterToOrModal = prevWord === 'to' || MODALS.has(prevWord);
  const afterNounish = prevNounish(prevWord);
  const afterModifier = MODIFIERS.has(prevWord) || listHas('adjectives', prevWord);
  const inAdj = listHas('adjectives', w) || isComparativeAdjective(w, prevWord) ||
    (hasSuffix(w, ADJ_SUFFIXES) && !w.endsWith('ly'));
  const inVerb = isKnownVerbForm(w) || (hasSuffix(w, VERB_SUFFIXES) && !VERB_FALSE.has(w));

  if (isComparativeAdjective(w, prevWord)) return 'adjective';
  if (isIngNounContext(w, prevWord, nextWord)) return 'noun';
  if (afterToOrModal && inVerb) return 'verb';
  if (DETERMINERS.has(prevWord) && NOUN_AFTER_DETERMINER.has(w)) return 'noun';
  if (listHas('adjectives', prevWord) && !inVerb) {
    if (inAdj) return 'adjective';
    if (w.endsWith('s') && !w.endsWith('ss') && w.length > 3) return 'plural';
    return 'noun';
  }
  if (w.endsWith('s') && !w.endsWith('ss') && w.length > 3 && !w.endsWith('ness') && afterNounish && !afterToOrModal) {
    if ((listHas('places', prevWord) || listHas('objects', prevWord)) && !inVerb) return 'plural';
    if ((listHas('personNouns', prevWord) || listHas('animals', prevWord)) && inVerb) return 'verb';
  }
  if (inAdj && inVerb) return (afterNounish || afterModifier) ? 'adjective' : 'verb';
  if (inVerb) return 'verb';
  if (inAdj) return 'adjective';
  if (isLikelyPluralNoun(w, prevWord, hints)) return 'plural';
  if (w.endsWith('s') && !w.endsWith('ss') && w.length > 3 && !w.endsWith('ness') && !inVerb) return 'plural';
  if (hasSuffix(w, NOUN_SUFFIXES) && !(w.endsWith('er') && isComparativeAdjective(w, prevWord))) return 'noun';
  return 'noun';
}

function classifyTokenHeuristic(tok, wordTokens, wi, tokens, hints) {
  const w = tok.norm;
  const prevWord = wi > 0 ? wordTokens[wi - 1].norm : '';
  const nextWord = wi + 1 < wordTokens.length ? wordTokens[wi + 1].norm : '';

  if (STOP_WORDS.has(w) || w.length < 2) {
    return { categories: [], confidence: 0 };
  }
  if (w.endsWith('ly') && w.length > 4) {
    return { categories: [], confidence: 0 };
  }
  if (isLexicalCompound(tok)) {
    return { categories: [], confidence: 0 };
  }
  const properCat = resolveProperNounCategory(tok, hints, { prevWord });
  if (properCat) {
    return { categories: [properCat], confidence: 0.92, properNoun: true };
  }
  if (isIdiomPart(tok, wordTokens, wi)) {
    return { categories: [], confidence: 0 };
  }
  if (isReportingVerbBeforeName(tok, wordTokens, wi)) {
    return { categories: [], confidence: 0 };
  }
  if (isPoeticOrArchaicForm(tok)) {
    return { categories: [], confidence: 0 };
  }
  if (isParticipleAfterName(tok, wordTokens, wi)) {
    return { categories: [], confidence: 0 };
  }
  if (isAbstractPoeticContext(w, prevWord, nextWord)) {
    return { categories: [], confidence: 0 };
  }
  if (isCompoundProtected(w, nextWord)) {
    return { categories: [], confidence: 0 };
  }

  const cats = [];
  let confidence = 0.35;

  if (listHas('animals', w)) { cats.push('animal'); confidence = 0.9; }
  if (listHas('bodyParts', w)) { cats.push('body part'); confidence = Math.max(confidence, 0.85); }
  if (listHas('places', w)) { cats.push('place'); confidence = Math.max(confidence, 0.85); }
  if (listHas('objects', w)) { cats.push('object'); confidence = Math.max(confidence, 0.8); }
  if (listHas('foods', w)) { cats.push('food'); confidence = Math.max(confidence, 0.88); }
  if (listHas('jobs', w)) { cats.push('job'); confidence = Math.max(confidence, 0.85); }
  if (listHas('vehicles', w)) { cats.push('vehicle'); confidence = Math.max(confidence, 0.85); }
  if (listHas('clothing', w)) { cats.push('clothing item'); confidence = Math.max(confidence, 0.85); }
  if (listHas('sillyWords', w)) { cats.push('silly word'); confidence = Math.max(confidence, 0.8); }
  if (listHas('emotions', w)) { cats.push('emotion'); confidence = Math.max(confidence, 0.85); }
  if (listHas('sounds', w) || isShoutVerb(w)) { cats.push('sound'); confidence = Math.max(confidence, 0.8); }
  if (isColorWord(w, prevWord, nextWord)) {
    cats.push('color');
    confidence = Math.max(confidence, 0.88);
  }
  if (listHas('personNouns', w)) { cats.push('name of someone in the room'); confidence = Math.max(confidence, 0.85); }

  const pos = classifyWordPos(w, prevWord, hints, nextWord);

  if (pos === 'preposition') {
    return { categories: [], confidence: 0 };
  }
  if (pos === 'verb') {
    cats.push('verb');
    if (isPastTenseForm(w)) cats.push('past-tense verb');
    if (isGerundVerb(w, prevWord, nextWord)) cats.push('verb ending in -ing');
    confidence = Math.max(confidence, hints?.verb?.has(w) ? 0.88 : 0.72);
  } else if (pos === 'adjective') {
    cats.push('adjective');
    confidence = Math.max(confidence, hints?.adjective?.has(w) ? 0.88 : 0.72);
  } else if (pos === 'plural') {
    cats.push('plural noun');
    confidence = Math.max(confidence, 0.68);
  } else if (pos === 'noun') {
    cats.push('noun');
    confidence = Math.max(confidence, hints?.noun?.has(w) ? 0.85 : 0.65);
  }

  if (DETERMINERS.has(prevWord) && cats.includes('noun')) confidence = Math.max(confidence, 0.78);
  if (hints?.person?.has(w) && !cats.includes('name of someone in the room') && listHas('personNouns', w)) {
    cats.push('name of someone in the room');
    confidence = Math.max(confidence, 0.88);
  }

  if (tokens[tok.index - 1]?.type === 'number' || /^\d+$/.test(w)) {
    cats.push('number');
    confidence = Math.max(confidence, 0.9);
  }

  return {
    categories: applyResolvedGrammar([...new Set(cats)], w, prevWord, hints, nextWord),
    confidence
  };
}

function classifyTokensHeuristic(tokens, hints = null) {
  const wordTokens = tokens.filter(t => t.type === 'word');
  const classifications = new Map();

  wordTokens.forEach((tok, wi) => {
    classifications.set(tok.index, classifyTokenHeuristic(tok, wordTokens, wi, tokens, hints));
  });

  return classifications;
}

function mergeWinkPos(classifications, tokens, engine) {
  if (!engine.wink) return classifications;

  const text = tokens.map(t => t.text).join('');
  const wordTokens = tokens.filter(t => t.type === 'word');
  const hints = engine.lastHints || null;

  try {
    const doc = engine.wink.nlp.readDoc(text);
    const its = engine.wink.its;
    let wi = 0;

    doc.tokens().each(t => {
      if (wi >= wordTokens.length) return false;
      const tok = wordTokens[wi++];
      const pos = t.out(its.pos);
      const base = classifications.get(tok.index) || { categories: [], confidence: 0.35 };
      if (base.confidence === 0) return;
      if (base.properNoun) return;

      const prevWord = wi > 1 ? wordTokens[wi - 2].norm : '';
      const nextWord = wi < wordTokens.length ? wordTokens[wi]?.norm : '';
      const winkCats = posFromWinkTag(pos);
      const merged = [...new Set([...base.categories, ...winkCats])];

      if (pos === 'PROPN') {
        const properCat = resolveProperNounCategory(tok, hints, { prevWord });
        if (properCat) {
          classifications.set(tok.index, {
            categories: [properCat],
            confidence: 0.92,
            properNoun: true
          });
          return;
        }
        classifications.set(tok.index, { categories: [], confidence: 0 });
        return;
      }

      classifications.set(tok.index, {
        categories: applyResolvedGrammar(merged, tok.norm, prevWord, hints, nextWord),
        confidence: Math.max(base.confidence, 0.9)
      });
    });
  } catch (_) { /* keep compromise/heuristic */ }

  return classifications;
}

function mergeCompromiseTerms(classifications, tokens, engine, hints) {
  const text = tokens.map(t => t.text).join('');
  const wordTokens = tokens.filter(t => t.type === 'word');

  try {
    const doc = engine.nlp(text);
    const json = doc.json({ terms: true });
    const terms = json[0]?.terms || [];
    let ti = 0;

    for (const term of terms) {
      const termText = (term.normal || term.text || '').toLowerCase();
      while (ti < wordTokens.length && wordTokens[ti].norm !== termText) ti++;
      if (ti >= wordTokens.length) break;

      const tok = wordTokens[ti++];
      const base = classifications.get(tok.index) || { categories: [], confidence: 0.35 };
      if (base.confidence === 0) continue;
      if (base.properNoun) continue;

      const prevWord = ti > 1 ? wordTokens[ti - 2].norm : '';
      const nextWord = ti < wordTokens.length ? wordTokens[ti]?.norm : '';
      const tags = term.tags || [];
      const cats = [...base.categories];

      if (tags.some(t => /ProperNoun/i.test(t))) {
        const properCat = resolveProperNounCategory(tok, hints, { termTags: tags, prevWord });
        if (properCat) {
          classifications.set(tok.index, {
            categories: [properCat],
            confidence: 0.92,
            properNoun: true
          });
          continue;
        }
      }
      if (tags.some(t => /Person|FirstName|LastName/i.test(t))) {
        const properCat = resolveProperNounCategory(tok, hints, { termTags: tags, prevWord });
        if (properCat) {
          classifications.set(tok.index, {
            categories: [properCat],
            confidence: 0.92,
            properNoun: true
          });
          continue;
        }
      }
      if (tags.some(t => /Place/i.test(t))) {
        const properCat = resolveProperNounCategory(tok, hints, { termTags: tags, prevWord });
        if (properCat) {
          classifications.set(tok.index, {
            categories: [properCat],
            confidence: 0.92,
            properNoun: true
          });
          continue;
        }
      }
      if (tags.some(t => /Verb/i.test(t)) && !cats.includes('verb')) cats.push('verb');
      if (tags.some(t => /Adjective/i.test(t)) && !cats.includes('adjective')) cats.push('adjective');
      if (tags.some(t => /Noun/i.test(t)) && !cats.includes('noun')) cats.push('noun');
      if (tags.some(t => /Place/i.test(t)) && listHas('places', tok.norm) && !cats.includes('place')) {
        cats.push('place');
      }
      if (tags.some(t => /Value|Number|Cardinal|Ordinal/i.test(t)) && !cats.includes('number')) {
        cats.push('number');
      }

      classifications.set(tok.index, {
        categories: applyResolvedGrammar([...new Set(cats)], tok.norm, prevWord, hints, nextWord),
        confidence: Math.max(base.confidence, 0.87)
      });
    }
  } catch (_) { /* keep heuristic */ }

  return classifications;
}

function classifyTokensWithNlp(tokens, engine) {
  const text = tokens.map(t => t.text).join('');
  const hints = engine.buildHints ? engine.buildHints(text) : null;
  engine.lastHints = hints;

  let classifications = classifyTokensHeuristic(tokens, hints);
  classifications = mergeCompromiseTerms(classifications, tokens, engine, hints);
  classifications = mergeWinkPos(classifications, tokens, engine);

  return classifications;
}

function resolvePromptCount(revealLength, promptSetting) {
  if (promptSetting !== 'auto') return parseInt(promptSetting, 10);
  const limits = Object.keys(AUTO_PROMPTS).map(Number).sort((a, b) => a - b);
  for (const lim of limits) {
    if (revealLength <= lim) return AUTO_PROMPTS[lim];
  }
  return 20;
}

function pickCategory(categories, tok, prevWord = '', cls = null) {
  const w = tok.norm;
  if (cls?.properNoun) {
    if (categories.includes('name of someone in the room')) return 'name of someone in the room';
    if (categories.includes('place')) return 'place';
  }
  const properCat = resolveProperNounCategory(tok, null, { prevWord });
  if (properCat && categories.includes(properCat)) return properCat;

  // Wildcard prompts: fun semantic categories beat strict grammar labels.
  if (categories.includes('color') && isColorWord(w)) return 'color';
  if (categories.includes('body part') && listHas('bodyParts', w)) return 'body part';
  if (categories.includes('animal') && listHas('animals', w)) return 'animal';
  if (categories.includes('food') && listHas('foods', w)) return 'food';
  if (categories.includes('job') && listHas('jobs', w)) return 'job';
  if (categories.includes('name of someone in the room')) {
    if (listHas('personNouns', w) || resolveProperNounCategory(tok)) {
      return 'name of someone in the room';
    }
  }
  if (categories.includes('emotion') && listHas('emotions', w)) return 'emotion';
  if (categories.includes('sound') && (listHas('sounds', w) || isShoutVerb(w))) return 'sound';
  if (categories.includes('vehicle') && listHas('vehicles', w)) return 'vehicle';
  if (categories.includes('clothing item') && listHas('clothing', w)) return 'clothing item';
  if (categories.includes('place')) {
    if (listHas('places', w) || resolveProperNounCategory(tok) === 'place') return 'place';
  }
  if (categories.includes('object') && listHas('objects', w)) return 'object';
  if (categories.includes('silly word') && listHas('sillyWords', w)) return 'silly word';
  const grammar = [
    'verb ending in -ing', 'past-tense verb', 'adverb', 'adjective', 'verb',
    'plural noun', 'noun', 'number'
  ];
  for (const g of grammar) {
    if (categories.includes(g)) return g;
  }
  return 'noun';
}

function resolveMinDistance(tokens, count) {
  const n = tokens.length;
  return Math.max(6, Math.min(35, Math.floor(n / (count * 2.5))));
}

function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6D2B79F5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** All tokens eligible for swapping (before shuffle / distance filtering). */
function buildSwapPool(tokens, classifications) {
  const wordTokens = tokens.filter(t => t.type === 'word');
  const pool = [];

  for (let wi = 0; wi < wordTokens.length; wi++) {
    const tok = wordTokens[wi];
    const cls = classifications.get(tok.index);
    if (!cls || !cls.categories.length || cls.confidence < 0.35) continue;
    if (STOP_WORDS.has(tok.norm)) continue;
    if (isPoeticOrArchaicForm(tok)) continue;
    if (isParticipleAfterName(tok, wordTokens, wi)) continue;
    const prevWord = wi > 0 ? wordTokens[wi - 1].norm : '';
    const nextWord = wi + 1 < wordTokens.length ? wordTokens[wi + 1].norm : '';
    if (isAbstractPoeticContext(tok.norm, prevWord, nextWord)) continue;
    if (isIdiomPart(tok, wordTokens, wi)) continue;
    if (isReportingVerbBeforeName(tok, wordTokens, wi)) continue;
    if (isLexicalCompound(tok)) continue;
    if (isCompoundProtected(tok.norm, nextWord)) continue;
    if (tok.norm.length < 3 && !cls.categories.includes('number')) continue;

    const category = pickCategory(cls.categories, tok, prevWord, cls);
    const weight = CATEGORY_WEIGHTS[category] || 5;
    pool.push({
      tokenIndex: tok.index,
      original: tok.text,
      norm: tok.norm,
      category,
      weight,
      confidence: cls.confidence,
      properNoun: Boolean(cls.properNoun)
    });
  }

  return pool;
}

function selectReplacementCandidates(tokens, classifications, options) {
  const {
    count,
    minDistance = resolveMinDistance(tokens, count),
    seed,
    excludeTokenIndices = null,
    allowPartial = false,
    dictionaryPos = null
  } = options;
  const excluded = excludeTokenIndices instanceof Set
    ? excludeTokenIndices
    : new Set(excludeTokenIndices || []);
  let pool = [...buildSwapPool(tokens, classifications)].filter(
    item => !excluded.has(item.tokenIndex)
  );
  if (dictionaryPos?.size) {
    pool = filterPoolWithDictionary(pool, dictionaryPos);
  }
  const rng = seed != null ? seededRandom(seed) : Math.random;
  pool.sort(() => rng() - 0.5);
  const selected = [];
  const usedNorms = new Set();
  const usedIndices = [];

  for (const item of pool) {
    if (selected.length >= count) break;
    if (usedNorms.has(item.norm)) continue;
    if (usedIndices.some(idx => Math.abs(idx - item.tokenIndex) < minDistance)) continue;

    let entry = item;
    if (dictionaryPos?.size) {
      const validated = validatePoolItem(item, dictionaryPos);
      if (!validated) continue;
      entry = validated;
    }

    usedNorms.add(entry.norm);
    usedIndices.push(entry.tokenIndex);
    selected.push({
      tokenIndex: entry.tokenIndex,
      originalWord: entry.original,
      category: entry.category,
      label: CATEGORY_LABELS[entry.category] || entry.category,
      hint: CATEGORY_HINTS[entry.category] || '',
      preservePossessive: /['\u2019]s$/i.test(entry.original),
      preservePlural: entry.category === 'plural noun'
        || (/[^'\u2019]s$/i.test(entry.original) && !/ss$/i.test(entry.original) && entry.category === 'noun'),
      properNoun: Boolean(entry.properNoun)
    });
  }

  if (!allowPartial && selected.length < Math.min(6, count) && count >= 6) {
    throw new Error('Too few replaceable words in this text. Try a longer excerpt or different section.');
  }
  return selected;
}

export {
  classifyTokensHeuristic, classifyTokensWithNlp,
  resolvePromptCount, pickCategory, resolveMinDistance,
  buildSwapPool, selectReplacementCandidates
};
