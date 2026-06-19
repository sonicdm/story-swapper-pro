import pluralize from 'pluralize';
import { STOP_WORDS, TITLES, MONTHS, DAYS, listHas, DETERMINERS } from './constants.js';

/** Surface forms that should never become Mad Lib blanks (poetry, contractions). */
const POETIC_SKIP = new Set([
  "o'er", "e'er", "ne'er", "e'en", "e'e", "'tis", "'twas", "'twere", "'em", "'neath",
  'i\'m', 'it\'s', 'we\'re', 'they\'re', 'you\'re', 'don\'t', 'won\'t', 'can\'t',
  'shan\'t', 'ain\'t', 'let\'s', 'that\'s', 'what\'s', 'who\'s', 'here\'s', 'there\'s'
]);

/** Map archaic spellings to modern headword for POS lookup. */
const ARCHAIC_EXPAND = {
  "o'er": 'over', "e'er": 'ever', "ne'er": 'never', "e'en": 'even', "e'e": 'eye',
  "'tis": 'it', "'twas": 'was', "'twere": 'were'
};

const PREPOSITIONS = new Set([
  'over', 'under', 'before', 'after', 'above', 'below', 'between', 'through', 'across',
  'against', 'along', 'around', 'among', 'beyond', 'within', 'without', 'toward', 'towards'
]);

/** Abstract nouns that glue poems together — skip in common frames. */
const ABSTRACT_NOUNS = new Set([
  'fear', 'hope', 'love', 'death', 'care', 'life', 'faith', 'truth', 'peace', 'joy',
  'grief', 'pain', 'mercy', 'grace', 'rest', 'sleep', 'dream', 'heart', 'soul', 'blood'
]);

const COLOR_FRAME_PREV = new Set([
  'color', 'colour', 'colored', 'coloured', 'dyed', 'tinted', 'painted', 'stained'
]);

const COLOR_FRAME_NEXT = new Set(['color', 'colour', 'silk', 'cape', 'paint']);

export function isKnownColor(w) {
  return listHas('colors', w);
}

/** Whether a token should use the color prompt (not generic adjective). */
export function isColorWord(w, prevWord = '', nextWord = '') {
  if (!isKnownColor(w)) return false;
  if (COLOR_FRAME_PREV.has(prevWord) || COLOR_FRAME_NEXT.has(nextWord)) return true;
  if (prevWord === 'of' && isKnownColor(w)) return true;
  if (DETERMINERS.has(prevWord) && isKnownColor(w)) return true;
  return isKnownColor(w);
}

/** Shout/yell verbs remapped to sound-effect prompts for funnier swaps. */
const SHOUT_VERBS = new Set([
  'yell', 'yelled', 'yelling', 'scream', 'screamed', 'screaming', 'shout', 'shouted', 'shouting',
  'shriek', 'shrieked', 'shrieking', 'howl', 'howled', 'howling', 'roar', 'roared', 'roaring',
  'bellow', 'bellowed', 'bellowing', 'holler', 'hollered', 'hollering', 'whoop', 'whooped',
  'whisper', 'whispered', 'whispering', 'gasp', 'gasped', 'gasping', 'moan', 'moaned', 'moaning',
  'wail', 'wailed', 'wailing', 'sob', 'sobbed', 'sobbing', 'cry', 'cried', 'crying'
]);

export function isShoutVerb(w) {
  return SHOUT_VERBS.has(w);
}

export function isGerundVerb(w, prevWord = '', nextWord = '') {
  return w.endsWith('ing') && w.length > 4 && !isIngNounContext(w, prevWord, nextWord);
}

/** Irregular past-tense and common conjugated forms not caught by suffix rules. */
export const IRREGULAR_PAST = new Set([
  'ran', 'stood', 'sat', 'went', 'came', 'saw', 'gave', 'took', 'made', 'did', 'had',
  'said', 'told', 'held', 'left', 'felt', 'kept', 'slept', 'meant', 'built', 'sent',
  'spent', 'won', 'lost', 'found', 'thought', 'bought', 'brought', 'caught', 'taught',
  'fought', 'sought', 'heard', 'broke', 'spoke', 'wore', 'froze', 'chose', 'rose',
  'drove', 'wrote', 'grew', 'threw', 'drew', 'ate', 'fell', 'knew', 'swam', 'sang',
  'rang', 'began', 'led', 'read', 'met', 'got', 'hit', 'cut', 'put', 'let', 'set',
  'assured', 'whirled', 'shuffled', 'forestalled', 'wrapt', 'wept', 'leapt', 'dreamt',
  'burnt', 'learnt', 'dealt', 'crept', 'wept', 'shook', 'hid', 'bit', 'lit'
]);

export const COMPARATIVE_ADJS = new Set([
  'older', 'younger', 'bigger', 'smaller', 'taller', 'shorter', 'longer', 'better',
  'worse', 'faster', 'slower', 'nearer', 'farther', 'further', 'higher', 'lower',
  'warmer', 'colder', 'harder', 'softer', 'lighter', 'darker', 'stronger', 'weaker',
  'deeper', 'wider', 'richer', 'poorer', 'calmer', 'wilder', 'louder', 'quieter',
  'sharper', 'duller', 'braver', 'later', 'earlier', 'greater', 'lesser', 'inner',
  'outer', 'upper', 'lower', 'happier', 'sadder', 'angrier', 'easier', 'busier'
]);

const SENTENCE_STARTERS = new Set([
  'the', 'it', 'he', 'she', 'they', 'we', 'you', 'this', 'that', 'there', 'here',
  'then', 'now', 'yes', 'no', 'go', 'not', 'but', 'and', 'if', 'when', 'what',
  'who', 'how', 'why', 'his', 'her', 'our', 'their', 'bare', 'oh', 'for', 'with',
  'from', 'one', 'two', 'three', 'his', 'its', 'an', 'as', 'at', 'by', 'on', 'in',
  'to', 'of', 'or', 'so', 'up', 'do', 'be', 'my', 'me', 'us', 'am', 'is', 'are',
  'was', 'were', 'has', 'have', 'had', 'will', 'can', 'may', 'must', 'shall',
  'should', 'would', 'could', 'might', 'each', 'every', 'some', 'any', 'all',
  'both', 'few', 'many', 'much', 'more', 'most', 'such', 'only', 'own', 'same',
  'into', 'over', 'after', 'before', 'between', 'through', 'during', 'again',
  'once', 'very', 'just', 'also', 'about', 'above', 'below', 'too', 'any', 'leave',
  'get', 'let', 'put', 'say', 'see', 'take', 'make', 'come', 'give', 'think',
  'know', 'want', 'look', 'use', 'find', 'tell', 'ask', 'work', 'seem', 'feel',
  'try', 'call', 'keep', 'turn', 'start', 'show', 'hear', 'play', 'run', 'move',
  'live', 'believe', 'hold', 'bring', 'happen', 'write', 'provide', 'sit', 'stand',
  // Poetry / archaic line openers — not names (Well might…, Yet vain…)
  'well', 'hark', 'lo', 'behold', 'hail', 'mark', 'list', 'alas', 'hence', 'thus', 'yet'
]);

const ING_NOUN_CONTEXT = new Set([
  'the', 'a', 'an', 'this', 'that', 'these', 'those', 'my', 'your', 'his', 'her',
  'our', 'their', 'some', 'any', 'each', 'every', 'another', 'no', 'such'
]);

const COMPOUND_MODIFIERS = new Set(['living', 'dining', 'waiting', 'operating', 'farthest', 'nearest']);
const COMPOUND_HEADS = new Set(['room', 'rooms', 'area', 'areas', 'table', 'station', 'street', 'cliffs', 'cliff']);

/** Capitalized epithets before nouns (Old Marta, Fair charmer) — not proper names. */
const EPITHET_ADJECTIVES = new Set([
  'old', 'young', 'little', 'great', 'dear', 'poor', 'good', 'big', 'small', 'new', 'last', 'first',
  'fair', 'vain', 'fond', 'sweet', 'bright', 'soft', 'bold', 'wild', 'mild', 'pure', 'lone', 'clear',
  'pale', 'bleak', 'glad', 'sad', 'cold', 'warm', 'high', 'low', 'free', 'true', 'false'
]);

export function isEpithetAdjective(w) {
  return EPITHET_ADJECTIVES.has(w);
}

/** Line-initial adverbs in poetry (Well might…) — not names. */
const POETIC_SENTENCE_ADVERBS = new Set(['well']);

export function isPoeticSentenceAdverb(w, tok) {
  return Boolean(tok?.atSentenceStart && POETIC_SENTENCE_ADVERBS.has(w));
}

/** Common role words (boy, man) — nouns, not names like Henry or Marta. */
export function isGenericPersonRole(w, tok) {
  return listHas('personNouns', w) && tok && !/^[A-Z]/.test(tok.text);
}

export function isPastTenseForm(w) {
  return w.endsWith('ed') || IRREGULAR_PAST.has(w);
}

export function isKnownVerbForm(w) {
  if (IRREGULAR_PAST.has(w)) return true;
  if (listHas('verbs', w)) return true;
  if (w.endsWith('ies') && listHas('verbs', w.slice(0, -3) + 'y')) return true;
  if (w.endsWith('es') && listHas('verbs', w.slice(0, -2))) return true;
  if (w.endsWith('s') && !w.endsWith('ss') && listHas('verbs', w.slice(0, -1))) return true;
  if (w.endsWith('ed') && listHas('verbs', w.slice(0, -2))) return true;
  if (w.endsWith('ing') && listHas('verbs', w.slice(0, -3))) return true;
  return false;
}

export function isComparativeAdjective(w, prevWord) {
  if (COMPARATIVE_ADJS.has(w)) return true;
  if (w.endsWith('ier') && w.length > 4) return true;
  if (!w.endsWith('er') || w.length < 4) return false;
  if (/^(was|were|is|are|am|be|been|seem|seems|look|looks|feel|feels|became|grow|grows|turn|turns)$/.test(prevWord)) {
    return true;
  }
  return false;
}

/** -est / -ful / etc. — capitalized mid-line in poetry, not names (Softest, Forgetful). */
const SUPERLATIVE_EST_NOUNS = new Set([
  'west', 'east', 'rest', 'nest', 'guest', 'crest', 'chest', 'jest', 'fest', 'best', 'test',
  'priest', 'beast', 'feast', 'breast', 'quest', 'pest', 'zest'
]);

export function isLikelyDerivedAdjective(w, prevWord = '') {
  if (isComparativeAdjective(w, prevWord)) return true;
  if (w.endsWith('ful') && w.length > 4) return true;
  if (w.endsWith('less') && w.length > 5) return true;
  if (w.endsWith('ous') && w.length > 5) return true;
  if (w.endsWith('ive') && w.length > 5) return true;
  if (w.endsWith('est') && w.length > 5 && !SUPERLATIVE_EST_NOUNS.has(w)) return true;
  return false;
}

export function isIngNounContext(w, prev, next) {
  if (!w.endsWith('ing')) return false;
  if (ING_NOUN_CONTEXT.has(prev)) return true;
  if (next && !STOP_WORDS.has(next) && !isKnownVerbForm(next)) return true;
  return false;
}

export function normalizeForPos(w) {
  return ARCHAIC_EXPAND[w] || w;
}

export function isPoeticOrArchaicForm(tok) {
  const raw = tok.text.toLowerCase();
  if (POETIC_SKIP.has(raw)) return true;
  // Poetic apostrophe past: toss'd, skreigh'd, lov'd, wrapt'd …
  if (/^[a-z]+['\u2019]d$/i.test(tok.text)) return true;
  return false;
}

export function isPrepositionWord(w) {
  return PREPOSITIONS.has(normalizeForPos(w));
}

export function isAbstractPoeticContext(w, prev, next) {
  if (!ABSTRACT_NOUNS.has(w)) return false;
  if (['when', 'where', 'from', 'with', 'without', 'through', 'in', 'if', 'though', 'although'].includes(prev)) {
    return true;
  }
  if (prev === 'at' && ['rest', 'sea', 'peace', 'ease', 'home', 'last'].includes(w)) return true;
  if (prev === 'of' && ['love', 'thee', 'thou'].includes(w)) return false;
  if (w === 'fear' && next === 'and' && ['from', 'free'].includes(prev)) return true;
  if (w === 'care' && prev === 'and') return true;
  return false;
}

export function isParticipleAfterName(tok, wordTokens, wi) {
  if (!tok.norm.endsWith('ing')) return false;
  if (wi === 0) return false;
  const prev = wordTokens[wi - 1];
  return /^[A-Z]/.test(prev.text) && looksLikeProperName(prev);
}

export function resolveProperNounCategory(tok, hints = null, { termTags = [], prevWord = '' } = {}) {
  if (!tok || !/^[A-Z]/.test(tok.text)) return null;
  const w = tok.norm;
  const prev = (prevWord || '').toLowerCase();
  if (TITLES.has(w) || MONTHS.has(w) || DAYS.has(w)) return null;
  if (SENTENCE_STARTERS.has(w)) return null;
  if (STOP_WORDS.has(w)) return null;
  if (isEpithetAdjective(w)) return null;
  if (isLikelyDerivedAdjective(w, prev)) return null;

  const isPlaceTag = termTags.some(t => /Place/i.test(t));
  const isPersonTag = termTags.some(t => /Person|FirstName|LastName/i.test(t));
  const geoPrev = ['of', 'river', 'sands', 'lake', 'mount', 'mountain', 'isle', 'island', 'bay', 'strait'];

  if (geoPrev.includes(prev)) return 'place';
  if (isPlaceTag || hints?.place?.has(w)) return 'place';
  if (listHas('places', w) && /^[A-Z]/.test(tok.text)) return 'place';

  if (isPersonTag || hints?.person?.has(w)) return 'name of someone in the room';

  if (!tok.atSentenceStart) return 'name of someone in the room';

  // Sentence start: short TitleCase names (Sim, Henry) — not common words or long tokens like Account.
  if (/^[A-Z][a-z]{2,5}$/.test(tok.text) && !listHas('places', w) && !listHas('objects', w)
      && !isEpithetAdjective(w) && !listHas('adjectives', w) && !listHas('adverbs', w)
      && !isLikelyDerivedAdjective(w, prev)) {
    return 'name of someone in the room';
  }

  return null;
}

export function looksLikeProperName(tok) {
  return resolveProperNounCategory(tok) !== null;
}

const TIME_OF_DAY = new Set([
  'evening', 'morning', 'afternoon', 'night', 'noon', 'midnight', 'dawn', 'dusk'
]);

const REPORTING_VERBS = new Set([
  'said', 'replied', 'returned', 'cried', 'asked', 'answered', 'continued',
  'exclaimed', 'whispered', 'muttered', 'shouted', 'declared', 'observed',
  'remarked', 'interposed', 'added', 'croaked', 'murmured', 'growled'
]);

export function isReportingVerb(tok) {
  return REPORTING_VERBS.has(tok.norm);
}

function isPossessiveForm(w) {
  return /['\u2019]s$/i.test(w);
}

function wordAt(wordTokens, wi, offset) {
  const t = wordTokens[wi + offset];
  return t ? t.norm : '';
}

/** Dialogue attribution: "returned Poole", "said Utterson" — verb must stay. */
export function isReportingVerbBeforeName(tok, wordTokens, wi) {
  if (!REPORTING_VERBS.has(tok.norm)) return false;
  const next = wordTokens[wi + 1];
  return Boolean(next && looksLikeProperName(next));
}

export function isIdiomPart(tok, wordTokens, wi) {
  const w = tok.norm;
  const prev = wordAt(wordTokens, wi, -1);
  const next = wordAt(wordTokens, wi, 1);
  const prev2 = wordAt(wordTokens, wi, -2);
  const next2 = wordAt(wordTokens, wi, 2);
  const possBase = w.replace(/['\u2019]s$/i, '');

  if (TIME_OF_DAY.has(w) && prev === 'one') return true;
  if (w === 'one' && TIME_OF_DAY.has(next)) return true;

  if (w === 'matter' && prev === 'the') return true;
  if (w === 'the' && next === 'matter') return true;

  if (w === 'seat' && prev === 'a' && prev2 === 'take') return true;
  if (w === 'a' && next === 'seat' && prev === 'take') return true;
  if (w === 'take' && next === 'a' && next2 === 'seat') return true;

  if (w === 'time' && prev === 'your' && prev2 === 'take') return true;
  if (w === 'your' && next === 'time' && prev === 'take') return true;
  if (w === 'take' && next === 'your' && next2 === 'time') return true;

  if (w === 'ways' && isPossessiveForm(prev)) return true;
  if (w === 'way' && (prev === 'the' || isPossessiveForm(prev))) return true;

  if (w === 'wish' && next === 'i' && next2 === 'may') return true;
  if (w === 'do' && prev === 'i' && prev2 === 'if') return true;

  if (w === 'good' && (next === 'man' || next === 'reason' || next === 'fellow' || next === 'sir')) return true;
  if (w === 'good' && prev === 'my' && next === 'man') return true;
  if (w === 'man' && prev === 'good') return true;
  if (w === 'reason' && (prev === 'good' || prev === 'some')) return true;

  if (w === 'appearance' && isPossessiveForm(prev)) return true;
  if (isPossessiveForm(w) && next === 'appearance') return true;

  if (isReportingVerbBeforeName(tok, wordTokens, wi)) return true;

  if (w === 'instead' && next === 'of') return true;
  if (w === 'of' && (prev === 'instead' || next === 'course' || prev === 'think')) return true;
  if (w === 'course' && prev === 'of') return true;
  if (w === 'all' && next === 'but') return true;
  if (w === 'but' && prev === 'all') return true;
  if (w === 'as' && next === 'well') return true;
  if (w === 'well' && prev === 'as') return true;
  if (w === 'rest' && prev === 'at') return true;
  if (w === 'sea' && prev === 'at') return true;
  if (w === 'at' && (next === 'rest' || next === 'sea' || next === 'last' || next === 'home')) return true;
  if (w === 'free' && next === 'from') return true;
  if (w === 'from' && prev === 'free') return true;

  if (w === 'think' && next === 'of') return true;
  if (w === 'others' && prev === 'of' && prev2 === 'think') return true;

  if (possBase === 'other' && prev === 'each') return true;
  if (possBase === 'else' && ['everybody', 'everyone', 'somebody', 'someone', 'anybody', 'anyone'].includes(prev)) {
    return true;
  }
  if (['everybody', 'everyone', 'somebody', 'someone', 'anybody', 'anyone'].includes(w) && next.replace(/['\u2019]s$/i, '') === 'else') {
    return true;
  }

  return false;
}

/** Graded or hyphenated lexical units (A.1.-ness, grown-ups) — swap as a whole or not at all. */
export function isLexicalCompound(tok) {
  const t = tok.text;
  if (/^[A-Za-z]\.(?:\d+\.)+-[a-zA-Z]+$/i.test(t)) return true;
  if (/^(grown-ups|banqueting-hall|dining-room|bath-room|ginger-wine)$/i.test(t)) return true;
  return false;
}

export function isCompoundProtected(w, next) {
  return Boolean(next && COMPOUND_MODIFIERS.has(w) && COMPOUND_HEADS.has(next));
}

export function isLikelyPluralNoun(w, prev, hints) {
  if (['children', 'men', 'women', 'people', 'mice', 'geese', 'teeth', 'feet'].includes(w)) return true;
  if (w.length <= 3) return false;
  if (!pluralize.isPlural(w)) return false;
  if (w.endsWith('ss') || w.endsWith('us') || w.endsWith('is')) return false;
  if (['is', 'was', 'has', 'does', 'goes', 'says'].includes(w)) return false;
  if (hints?.noun?.has(w)) return true;
  return ['the', 'some', 'many', 'few', 'several', 'these', 'those', 'two', 'three', 'four', 'five', 'his', 'her', 'their', 'our', 'my', 'your'].includes(prev);
}

export function phraseLooksPlural(value) {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  const last = (parts[parts.length - 1] || '').toLowerCase();
  if (!last) return false;
  if (['children', 'people', 'men', 'women', 'geese', 'mice', 'teeth', 'feet'].includes(last)) return true;
  return pluralize.isPlural(last);
}
