import nlp from 'compromise/three';
import { normalizeForPos, isPrepositionWord } from './grammar.js';

function normalizeWord(word) {
  return (word || '').toLowerCase().replace(/^[^a-z0-9]+|[^a-z0-9'-]+$/g, '');
}

/** Document-level POS/entity hints from compromise — one pass over the full text. */
export function buildCompromiseHints(text) {
  const hints = {
    adjective: new Set(),
    adverb: new Set(),
    verb: new Set(),
    noun: new Set(),
    person: new Set(),
    place: new Set(),
    number: new Set(),
    preposition: new Set()
  };

  try {
    const doc = nlp(text);
    const tagMap = [
      ['#Adjective', 'adjective'],
      ['#Adverb', 'adverb'],
      ['#Verb', 'verb'],
      ['#Noun', 'noun'],
      ['#Person', 'person'],
      ['#Place', 'place'],
      ['#Value', 'number'],
      ['#Cardinal', 'number'],
      ['#Ordinal', 'number'],
      ['#Preposition', 'preposition']
    ];

    for (const [tag, key] of tagMap) {
      const values = doc.match(tag).out('array');
      for (const value of values) {
        for (const part of String(value).split(/\s+/)) {
          const norm = normalizeWord(part);
          if (norm) hints[key].add(norm);
        }
      }
    }

    // Expand archaic surface forms via compromise's implicit/machine lemma (o'er → over).
    const json = doc.json({ terms: true });
    for (const block of json) {
      for (const term of block.terms || []) {
        const surface = normalizeWord(term.normal || term.text);
        const head = normalizeWord(term.implicit || term.machine || '');
        if (!surface || !head || surface === head) continue;
        for (const [tag, key] of tagMap) {
          if ((term.tags || []).some(t => tag.slice(1) === t || t === tag.slice(1))) {
            hints[key].add(head);
          }
        }
        if (isPrepositionWord(head)) hints.preposition.add(surface);
      }
    }
  } catch (_) { /* use heuristics only */ }

  return hints;
}

/** Map wink universal POS tag to our grammar categories. */
export function posFromWinkTag(tag) {
  switch (tag) {
    case 'VERB': return ['verb'];
    case 'ADJ': return ['adjective'];
    case 'NOUN': return ['noun'];
    case 'PROPN': return ['noun']; // filtered later by proper-name guard
    case 'NUM': return ['number'];
    default: return [];
  }
}
