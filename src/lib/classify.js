import {
  STOP_WORDS, ADJ_SUFFIXES, VERB_SUFFIXES, NOUN_SUFFIXES, VERB_FALSE, MODALS,
  DETERMINERS, MONTHS, DAYS, NUMBER_WORD_SET, CATEGORY_WEIGHTS, CATEGORY_LABELS, CATEGORY_HINTS, listHas
} from './constants.js';
import { filterPoolWithDictionary, validatePoolItem } from './dictionary-pos.js';
import {
  IRREGULAR_PAST, isPastTenseForm, isKnownVerbForm, isComparativeAdjective,
  isIngNounContext, looksLikeProperName, resolveProperNounCategory, isIdiomPart, isCompoundProtected, isLikelyPluralNoun,
  isPoeticOrArchaicForm, normalizeForPos, isPrepositionWord, isAbstractPoeticContext,
  isParticipleAfterName, isColorWord, isShoutVerb, isGerundVerb, isLexicalCompound,
  isReportingVerbBeforeName, isReportingVerb, isGenericPersonRole, isEpithetAdjective, isPoeticSentenceAdverb,
  isLikelyDerivedAdjective
} from './grammar.js';
import { posFromWinkTag } from './nlp-hints.js';

function hasSuffix(word, suffixes) {
  return suffixes.some(s => word.endsWith(s) && word.length > s.length + 2);
}

const MODIFIERS = new Set(['still', 'very', 'so', 'too', 'quite', 'rather', 'more', 'most', 'less', 'least', 'almost', 'nearly']);
const PREPOSITION_CONTEXT = new Set([
  'about', 'above', 'across', 'after', 'against', 'along', 'among', 'around',
  'at', 'before', 'behind', 'below', 'beneath', 'beside', 'between', 'beyond',
  'by', 'for', 'from', 'in', 'inside', 'into', 'near', 'of', 'off', 'on',
  'onto', 'out', 'over', 'through', 'to', 'toward', 'towards', 'under', 'with',
  'within', 'without'
]);

function prevNounish(prev) {
  return DETERMINERS.has(prev) || listHas('personNouns', prev) || listHas('places', prev) ||
    listHas('objects', prev) || listHas('animals', prev) || listHas('bodyParts', prev) ||
    hasSuffix(prev, NOUN_SUFFIXES);
}

const GRAMMAR_CATS = new Set([
  'verb', 'past-tense verb', 'verb ending in -ing', 'adjective', 'adverb',
  'plural noun', 'noun', 'number'
]);

const MADLIB_PROMPT_RECIPE = [
  'adjective',
  'object',
  'past-tense verb',
  'place',
  'animal',
  'day of week',
  'food',
  'name of someone in the room',
  'plural noun',
  'body part',
  'verb',
  'color',
  'clothing item',
  'adverb',
  'emotion',
  'sound',
  'verb ending in -ing',
  'job',
  'vehicle',
  'noun'
];

const FILL_CATEGORY_PRIORITY = [
  'adjective',
  'past-tense verb',
  'object',
  'place',
  'animal',
  'food',
  'name of someone in the room',
  'day of week',
  'plural noun',
  'body part',
  'verb',
  'color',
  'clothing item',
  'emotion',
  'sound',
  'verb ending in -ing',
  'job',
  'vehicle',
  'adverb',
  'noun',
  'number'
];

const MADLIB_GUIDE_WORDS = 150;
const MADLIB_GUIDE_BLANKS = 18;

function plannedCategories(count, pool = []) {
  const remaining = new Map();
  for (const item of pool) {
    remaining.set(item.category, (remaining.get(item.category) || 0) + 1);
  }
  if (!remaining.size) return [];

  const plan = [];
  while (plan.length < count) {
    let added = false;
    for (const category of MADLIB_PROMPT_RECIPE) {
      if (plan.length >= count) break;
      const left = remaining.get(category) || 0;
      if (left <= 0) continue;
      plan.push(category);
      remaining.set(category, left - 1);
      added = true;
    }
    if (!added) break;
  }

  while (plan.length < count) {
    let added = false;
    for (const category of FILL_CATEGORY_PRIORITY) {
      if (plan.length >= count) break;
      const left = remaining.get(category) || 0;
      if (left <= 0) continue;
      plan.push(category);
      remaining.set(category, left - 1);
      added = true;
    }
    if (!added) break;
  }

  return plan;
}

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
  const pluralSurface = w.endsWith('s') && !w.endsWith('ss') && w.length > 3 && !w.endsWith('ness');

  if (isComparativeAdjective(w, prevWord)) return 'adjective';
  if (isIngNounContext(w, prevWord, nextWord)) return 'noun';
  if (afterToOrModal && inVerb) return 'verb';
  if (prevWord === 'that' && pluralSurface && inVerb) return 'verb';
  if (pluralSurface && DETERMINERS.has(prevWord) && nextWord && isKnownVerbForm(nextWord)) return 'plural';
  if (pluralSurface && nextWord?.endsWith('s') && !nextWord.endsWith('ss')) return 'plural';
  if (pluralSurface && prevWord && isKnownVerbForm(prevWord) && PREPOSITION_CONTEXT.has(nextWord)) return 'plural';
  if (DETERMINERS.has(prevWord) && NOUN_AFTER_DETERMINER.has(w)) return 'noun';
  if (listHas('adjectives', prevWord) && !inVerb) {
    if (inAdj) return 'adjective';
    if (pluralSurface) return 'plural';
    return 'noun';
  }
  if (pluralSurface && afterNounish && !afterToOrModal) {
    if ((listHas('places', prevWord) || listHas('objects', prevWord)) && !inVerb) return 'plural';
    if ((listHas('personNouns', prevWord) || listHas('animals', prevWord)) && inVerb) return 'verb';
  }
  if (inAdj && inVerb) return (afterNounish || afterModifier) ? 'adjective' : 'verb';
  if (inVerb) return 'verb';
  if (inAdj) return 'adjective';
  if (isLikelyPluralNoun(w, prevWord, hints)) return 'plural';
  if (pluralSurface && !inVerb) return 'plural';
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
  if (isPoeticSentenceAdverb(w, tok)) {
    return { categories: ['adverb'], confidence: 0.85 };
  }
  if (isEpithetAdjective(w) && /^[A-Z]/.test(tok.text)) {
    return { categories: ['adjective'], confidence: 0.85 };
  }
  if (isLikelyDerivedAdjective(w, prevWord) && /^[A-Z]/.test(tok.text)) {
    return { categories: ['adjective'], confidence: 0.85 };
  }
  if (MONTHS.has(w)) {
    return { categories: [], confidence: 0 };
  }
  if (DAYS.has(w)) {
    return { categories: ['day of week'], confidence: 0.95 };
  }
  if (NUMBER_WORD_SET.has(w)) {
    return { categories: ['number'], confidence: 0.9 };
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
  if (listHas('personNouns', w) && !isGenericPersonRole(w, tok)) {
    cats.push('name of someone in the room');
    confidence = Math.max(confidence, 0.85);
  }

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
  if (hints?.person?.has(w) && !cats.includes('name of someone in the room')
      && !isGenericPersonRole(w, tok)) {
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
  return resolveMadLibPromptCount(revealLength);
}

function countWordTokens(tokens) {
  return tokens.filter(t => t.type === 'word').length;
}

function resolveMadLibPromptCount(wordCount) {
  const words = Math.max(0, Number(wordCount) || 0);
  if (!words) return 0;
  return Math.max(1, Math.round((words * MADLIB_GUIDE_BLANKS) / MADLIB_GUIDE_WORDS));
}

function resolveAutoPromptCount(wordCount, pool = []) {
  const base = resolveMadLibPromptCount(wordCount);
  if (!pool.length) return 0;

  const sourceCap = new Set(pool.map(item => item.norm)).size;
  return Math.min(base, sourceCap);
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
    const properName = resolveProperNounCategory(tok);
    if (properName === 'name of someone in the room') return 'name of someone in the room';
    if (listHas('personNouns', w) && !isGenericPersonRole(w, tok)) {
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
  if (categories.includes('day of week') && DAYS.has(w)) return 'day of week';
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
  const safeCount = Math.max(1, count || 1);
  return Math.max(6, Math.min(35, Math.floor(n / (safeCount * 2.5))));
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

function shuffledCopy(items, rng) {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function shouldSkipAutoCandidate(category, tok, prevWord, nextWord) {
  if (category === 'adjective' && /ed$/.test(tok.norm) && nextWord === 'like') return true;
  if (category === 'adjective' && tok.norm === 'right' && prevWord === 'just') return true;
  if (category === 'past-tense verb' && /ed$/.test(tok.norm) && ['by', 'like', 'with'].includes(nextWord)) return true;
  if (category === 'past-tense verb' && tok.norm === 'named') return true;
  if ((category === 'verb' || category === 'past-tense verb') && prevWord === 'there' && ['lived', 'stood', 'sat', 'lay'].includes(tok.norm)) return true;
  if (category === 'verb' && tok.norm === 'like' && DETERMINERS.has(nextWord)) return true;
  if (category === 'noun' && DAYS.has(tok.norm)) return true;
  if (category === 'noun' && MONTHS.has(tok.norm)) return true;
  return false;
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
    if (MONTHS.has(tok.norm)) continue;
    if (isReportingVerb(tok)) continue;
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
    if (shouldSkipAutoCandidate(category, tok, prevWord, nextWord)) continue;
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

function toPromptCandidate(entry) {
  const pluralPreserveCategories = new Set([
    'noun', 'animal', 'body part', 'place', 'object', 'food', 'job',
    'vehicle', 'clothing item'
  ]);
  const looksPlural = /(?:[^'\u2019]s|ies)$/i.test(entry.original) && !/ss$/i.test(entry.original);
  return {
    tokenIndex: entry.tokenIndex,
    originalWord: entry.original,
    category: entry.category,
    label: CATEGORY_LABELS[entry.category] || entry.category,
    hint: CATEGORY_HINTS[entry.category] || '',
    preservePossessive: /['\u2019]s$/i.test(entry.original),
    preservePlural: entry.category === 'plural noun'
      || (looksPlural && pluralPreserveCategories.has(entry.category)),
    properNoun: Boolean(entry.properNoun)
  };
}

function selectReplacementCandidates(tokens, classifications, options) {
  const {
    count,
    minDistance: requestedMinDistance = null,
    seed,
    excludeTokenIndices = null,
    allowPartial = false,
    dictionaryPos = null,
    autoCount = false
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
  const targetCount = autoCount
    ? resolveAutoPromptCount(countWordTokens(tokens), pool, count)
    : count;
  const minDistance = requestedMinDistance ?? resolveMinDistance(tokens, targetCount);
  const rng = seed != null ? seededRandom(seed) : Math.random;
  pool = shuffledCopy(pool, rng);
  const selected = [];
  const usedNorms = new Set();
  const usedIndices = [];

  function trySelect(category, distance) {
    if (selected.length >= targetCount) return false;
    for (const item of pool) {
      if (item.category !== category) continue;
      if (usedNorms.has(item.norm)) continue;
      if (usedIndices.some(idx => Math.abs(idx - item.tokenIndex) < distance)) continue;

      let entry = item;
      if (dictionaryPos?.size) {
        const validated = validatePoolItem(item, dictionaryPos);
        if (!validated || validated.category !== item.category) continue;
        entry = validated;
      }

      usedNorms.add(entry.norm);
      usedIndices.push(entry.tokenIndex);
      selected.push(toPromptCandidate(entry));
      return true;
    }
    return false;
  }

  const plan = plannedCategories(targetCount, pool);
  for (const category of plan) {
    if (selected.length >= targetCount) break;
    trySelect(category, minDistance);
  }

  const relaxedDistance = Math.max(1, Math.floor(minDistance / 2));
  for (const category of plan) {
    if (selected.length >= targetCount) break;
    trySelect(category, relaxedDistance);
  }

  while (selected.length < targetCount) {
    let added = false;
    for (const category of FILL_CATEGORY_PRIORITY) {
      if (selected.length >= targetCount) break;
      added = trySelect(category, relaxedDistance) || added;
    }
    if (!added) break;
  }

  if (!allowPartial && selected.length < Math.min(6, targetCount) && targetCount >= 6) {
    throw new Error('Too few replaceable words in this text. Try a longer excerpt or different section.');
  }
  return selected;
}

export {
  classifyTokensHeuristic, classifyTokensWithNlp,
  resolvePromptCount, resolveMadLibPromptCount, resolveAutoPromptCount, pickCategory, resolveMinDistance,
  buildSwapPool, selectReplacementCandidates, plannedCategories
};
