import { countWords } from './dom.js';
import { HEADING_REJECT } from './constants.js';
import { appState } from './state.js';
import { resolvePlaceholderCategory } from './placeholders.js';

/** Extend word token end: graded compounds (A.1.-ness) or default apostrophe/hyphen words. */
function scanWordEnd(text, start) {
  const len = text.length;
  const rest = text.slice(start);
  const graded = rest.match(/^[A-Za-z](?:\.[A-Za-z0-9]+)*(?:\.-[A-Za-z0-9]+)?/);
  if (graded && graded[0].includes('.')) {
    return start + graded[0].length;
  }
  let end = start;
  while (end < len && /[\w''\u2019-]/.test(text[end])) end++;
  return end;
}

function cleanGutenbergText(rawText) {
  let text = rawText.replace(/\r\n/g, '\n');
  const startMatch = text.match(/\*\*\*\s*START OF (?:THE )?PROJECT GUTENBERG/i);
  const endMatch = text.match(/\*\*\*\s*END OF (?:THE )?PROJECT GUTENBERG/i);
  if (startMatch) {
    const startIdx = text.indexOf('\n', startMatch.index);
    text = text.slice(startIdx >= 0 ? startIdx + 1 : startMatch.index + startMatch[0].length);
  }
  if (endMatch) text = text.slice(0, endMatch.index);
  const licenseStart = text.search(/START:\s*FULL LICENSE/i);
  if (licenseStart >= 0) text = text.slice(0, licenseStart);
  text = text.replace(/[\u201c\u201d]/g, '"').replace(/[\u2018\u2019]/g, "'");
  const lines = text.split('\n');
  const skipPatterns = /^(TABLE OF CONTENTS|CONTENTS|PREFACE|INTRODUCTION|FOREWORD|LIST OF ILLUSTRATIONS|ILLUSTRATIONS|TRANSCRIBER|COPYRIGHT|LICENSE)\s*$/i;
  const cleaned = [];
  let skipping = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (skipPatterns.test(line)) { skipping = true; continue; }
    if (skipping && line === '') continue;
    if (skipping && line !== '') skipping = false;
    if (!skipping) cleaned.push(lines[i]);
  }
  text = cleaned.join('\n');
  text = text.replace(/\n{3,}/g, '\n\n').trim();
  return text;
}

function isHeadingLine(line, prevBlank, nextBlank) {
  const t = line.trim();
  if (!t || t.length > 80) return false;
  const upper = t.toUpperCase();
  if (HEADING_REJECT.has(upper)) return false;
  if (/^(CONTENTS|PREFACE|INTRODUCTION|FOREWORD|ILLUSTRATIONS|NOTES|TRANSCRIBER|COPYRIGHT|LICENSE|THE END|INDEX|DEDICATION)/i.test(t)) return false;
  if (/^(CHAPTER|PART|STORY|TALE|BOOK|SECTION|LETTER|SKETCH|ADVENTURE)\s+[IVXLCDM\d]+/i.test(t)) return true;
  if (/^\d+\.\s+[A-Z]/.test(t) && t.length < 60) return true;
  if (prevBlank && nextBlank && t.length >= 3 && t.length <= 60) {
    if (t === upper && t.split(/\s+/).length <= 8 && /[A-Z]/.test(t)) return true;
    const words = t.split(/\s+/);
    if (words.length >= 2 && words.length <= 6 && words.every(w => /^[A-Z]/.test(w))) return true;
  }
  return false;
}

function scoreSection(text) {
  const words = countWords(text);
  if (words < 250 || words > 5000) return -1;
  let score = 0;
  const quotes = (text.match(/"/g) || []).length;
  score += Math.min(quotes, 20);
  const sentences = (text.match(/[.!?]/g) || []).length;
  score += Math.min(sentences, 30);
  const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim()).length;
  score += paragraphs * 2;
  const lines = text.split('\n');
  const listLike = lines.filter(l => /^\s*[\d•\-*]/.test(l)).length;
  score -= listLike * 2;
  const avgLen = lines.reduce((s, l) => s + l.length, 0) / Math.max(lines.length, 1);
  if (avgLen < 30) score -= 10;
  if (/said|asked|replied|whispered|shouted| cried| laughed| told| answered/i.test(text)) score += 8;
  return score;
}

function detectSections(cleanText) {
  const lines = cleanText.split('\n');
  const headings = [];
  for (let i = 0; i < lines.length; i++) {
    const prevBlank = i === 0 || lines[i - 1].trim() === '';
    const nextBlank = i >= lines.length - 1 || lines[i + 1].trim() === '';
    if (isHeadingLine(lines[i], prevBlank, nextBlank)) {
      headings.push({ lineIndex: i, title: lines[i].trim() });
    }
  }
  const sections = [];
  for (let h = 0; h < headings.length; h++) {
    const start = headings[h].lineIndex + 1;
    const end = h + 1 < headings.length ? headings[h + 1].lineIndex : lines.length;
    const body = lines.slice(start, end).join('\n').trim();
    const wordCount = countWords(body);
    const score = scoreSection(body);
    if (score >= 0 && wordCount >= 250) {
      sections.push({ title: headings[h].title, text: body, wordCount, score });
    }
  }
  return sections.sort((a, b) => b.score - a.score);
}

function getRandomExcerpt(text, wordLimit) {
  const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim());
  if (!paragraphs.length) return trimToWordLimit(text, wordLimit);
  let startIdx = Math.floor(Math.random() * paragraphs.length);
  let combined = '';
  for (let i = startIdx; i < paragraphs.length; i++) {
    combined += (combined ? '\n\n' : '') + paragraphs[i];
    if (countWords(combined) >= wordLimit * 0.8) break;
  }
  if (countWords(combined) < wordLimit * 0.5) combined = text;
  return trimToWordLimit(combined, wordLimit);
}

function selectSection(cleanText, sections, mode, previousIndex = -1, wordLimit = appState.revealLength) {
  if (mode === 'random-excerpt') {
    const text = getRandomExcerpt(cleanText, wordLimit);
    return { title: 'Random excerpt', text, index: -1 };
  }
  if (mode === 'beginning') {
    let text = cleanText;
    if (sections.length) {
      const idx = cleanText.indexOf(sections[0].text);
      if (idx >= 0) text = cleanText.slice(idx);
    }
    return { title: 'Beginning', text, index: -1 };
  }
  if (sections.length) {
    const top = sections.slice(0, 3);
    let pick;
    if (top.length === 1) pick = { section: top[0], index: sections.indexOf(top[0]) };
    else {
      const weights = top.map(s => s.score + 1);
      const total = weights.reduce((a, b) => a + b, 0);
      let r = Math.random() * total;
      let chosen = 0;
      for (let i = 0; i < weights.length; i++) {
        r -= weights[i];
        if (r <= 0) { chosen = i; break; }
      }
      if (previousIndex >= 0 && top.length > 1) {
        const avail = top.map((s, i) => ({ s, i })).filter(x => sections.indexOf(x.s) !== previousIndex);
        if (avail.length) {
          const pick2 = avail[Math.floor(Math.random() * avail.length)];
          return { title: pick2.s.title, text: pick2.s.text, index: sections.indexOf(pick2.s) };
        }
      }
      pick = { section: top[chosen], index: sections.indexOf(top[chosen]) };
    }
    return { title: pick.section.title, text: pick.section.text, index: pick.index };
  }
  return { title: null, text: cleanText, index: -1 };
}

function trimToWordLimit(text, limit) {
  const wc = countWords(text);
  if (wc <= limit) return text;
  const sentences = text.split(/(?<=[.!?])\s+/);
  let result = '';
  let words = 0;
  for (const sent of sentences) {
    const sw = countWords(sent);
    if (words + sw > limit && words >= limit * 0.85) break;
    result += (result ? ' ' : '') + sent;
    words += sw;
    if (words >= limit) break;
  }
  if (!result.trim()) {
    const parts = text.split(/\s+/);
    result = parts.slice(0, limit).join(' ');
  }
  const resultWords = countWords(result);
  if (resultWords > limit) {
    result = result.split(/\s+/).slice(0, limit).join(' ');
  }
  return result.trim();
}

function tokenize(text) {
  const tokens = [];
  let i = 0;
  let sentenceIndex = 0;
  let wordIndex = 0;
  let atSentenceStart = true;
  const len = text.length;

  while (i < len) {
    const ch = text[i];
    let type, end = i + 1;

    if (/\s/.test(ch)) {
      type = 'whitespace';
      while (end < len && /\s/.test(text[end])) end++;
    } else if (ch === '{') {
      const close = text.indexOf('}', end);
      if (close > end) {
        const inner = text.slice(end, close).trim();
        const category = resolvePlaceholderCategory(inner);
        type = 'blank';
        end = close + 1;
        const blankSlice = text.slice(i, end);
        tokens.push({
          index: tokens.length,
          text: blankSlice,
          norm: '',
          type: 'blank',
          blankCategory: category || 'noun',
          placeholderTag: inner,
          isCapitalized: false,
          sentenceIndex,
          wordIndex: -1,
          atSentenceStart: atSentenceStart
        });
        if (/[.!?]/.test(blankSlice)) {
          sentenceIndex++;
          atSentenceStart = true;
          wordIndex = 0;
        } else {
          atSentenceStart = false;
        }
        i = end;
        continue;
      }
    } else if (ch === '_' && i + 2 < len && text[i + 1] === '_' && text[i + 2] === '_') {
      while (end < len && text[end] === '_') end++;
      const blankSlice = text.slice(i, end);
      tokens.push({
        index: tokens.length,
        text: blankSlice,
        norm: '',
        type: 'blank',
        blankCategory: 'noun',
        placeholderTag: 'noun',
        isCapitalized: false,
        sentenceIndex,
        wordIndex: -1,
        atSentenceStart: atSentenceStart
      });
      atSentenceStart = false;
      i = end;
      continue;
    } else if (/\d/.test(ch)) {
      type = 'number';
      while (end < len && /[\d.,]/.test(text[end])) end++;
    } else if (/[\w''\u2019-]/.test(ch) && /[a-zA-Z]/.test(ch)) {
      type = 'word';
      end = scanWordEnd(text, i);
    } else if (/[.,!?;:()[\]{}""''—–-]/.test(ch)) {
      type = 'punctuation';
    } else {
      type = 'other';
    }

    const slice = text.slice(i, end);
    const token = {
      index: tokens.length,
      text: slice,
      norm: type === 'word' ? slice.toLowerCase().replace(/^['']+|['']+$/g, '') : slice,
      type,
      isCapitalized: type === 'word' && /^[A-Z]/.test(slice) && !atSentenceStart,
      sentenceIndex,
      wordIndex: type === 'word' ? wordIndex : -1,
      atSentenceStart: type === 'word' ? atSentenceStart : false
    };
    tokens.push(token);

    if (type === 'word') {
      wordIndex++;
      atSentenceStart = false;
    }
    if (/[.!?]/.test(slice)) {
      sentenceIndex++;
      atSentenceStart = true;
      wordIndex = 0;
    }
    i = end;
  }
  return tokens;
}
export {
  cleanGutenbergText, isHeadingLine, scoreSection, detectSections,
  getRandomExcerpt, selectSection, trimToWordLimit, tokenize
};
