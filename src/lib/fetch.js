import { countWords } from './dom.js';

/** CORS-friendly mirror of madlibs-api data for static hosting (GitHub Pages). */
const MADLIBS_CDN = 'https://cdn.jsdelivr.net/gh/chroline/madlibs-api@main/data/templates.json';

let madlibsCdnCache = null;

function isLocalhost() {
  const h = location.hostname;
  return h === 'localhost' || h === '127.0.0.1' || h === '[::1]';
}

function pickPlainTextUrl(formats) {
  if (!formats) return null;
  const keys = Object.keys(formats);
  const utf8 = keys.find(k => /text\/plain.*utf-8/i.test(k));
  if (utf8) return formats[utf8];
  const plain = keys.find(k => k.startsWith('text/plain'));
  return plain ? formats[plain] : null;
}

/** Score Gutenberg plain-text URLs — lower is tried first. */
function gutenbergUrlPriority(url) {
  if (!url) return 99;
  if (/\/files\/\d+\/\d+-0\.txt$/i.test(url)) return 1;
  if (/\/cache\/epub\/\d+\/pg\d+\.txt$/i.test(url)) return 2;
  if (/\/files\/\d+\//i.test(url) && /\.txt/i.test(url)) return 3;
  if (/\/cache\/epub\//i.test(url) && /\.txt/i.test(url)) return 4;
  if (/\/ebooks\/\d+\.txt\.utf-8$/i.test(url)) return 90;
  return 20;
}

/** Skip readme/index sidecars — not playable story text. */
function isGutenbergStoryUrl(url) {
  if (!url || !/\.txt/i.test(url)) return false;
  if (/readme|index\.html|cover\.|metadata/i.test(url)) return false;
  return true;
}

/** Gutendex sometimes lists audio books because they ship a text/plain readme. */
function isGutenbergReadableBook(book) {
  if (!book?.id) return false;
  if (book.media_type && book.media_type !== 'Text') return false;
  const formats = book.formats || {};
  const plainUrls = Object.keys(formats)
    .filter(k => k.startsWith('text/plain'))
    .map(k => formats[k])
    .filter(isGutenbergStoryUrl);
  if (plainUrls.length) return true;
  return true;
}

function looksLikeGutenbergStory(text) {
  if (!text || text.length < 400) return false;
  if (/\*\*\*\s*START OF (?:THE )?PROJECT GUTENBERG/i.test(text)) return true;
  return countWords(text) >= 80;
}

/** Build every plain-text URL we might try for a Gutenberg book (most reliable first). */
function gutenbergTextCandidates(book) {
  const urls = [];
  const id = book.id;
  if (id) {
    urls.push(`https://www.gutenberg.org/files/${id}/${id}-0.txt`);
    urls.push(`https://www.gutenberg.org/cache/epub/${id}/pg${id}.txt`);
  }
  const formats = book.formats || {};
  for (const key of Object.keys(formats)) {
    if (key.startsWith('text/plain') && isGutenbergStoryUrl(formats[key])) {
      urls.push(formats[key]);
    }
  }
  if (id) {
    urls.push(`https://www.gutenberg.org/ebooks/${id}.txt.utf-8`);
  }
  const unique = [...new Set(urls.filter(isGutenbergStoryUrl))];
  unique.sort((a, b) => gutenbergUrlPriority(a) - gutenbergUrlPriority(b));
  return unique;
}

function isGutenbergHost(url) {
  try {
    const host = new URL(url).hostname;
    return host === 'www.gutenberg.org' || host === 'gutenberg.org';
  } catch (_) {
    return false;
  }
}

/** True when Gutenberg book downloads cannot work (null origin blocks every proxy). */
export function gutenbergBlockedOnFileProtocol() {
  return location.protocol === 'file:';
}

/** Same-origin proxy path (Vite dev/preview server.proxy → gutenberg.org). */
function toSameOriginGutenbergProxy(url) {
  try {
    if (!isGutenbergHost(url) || !isLocalhost()) return null;
    const u = new URL(url);
    return `/api/gutenberg${u.pathname}${u.search}`;
  } catch (_) {
    return null;
  }
}

function stripJinaReaderWrapper(text) {
  const marker = 'Markdown Content:';
  const idx = text.indexOf(marker);
  if (idx >= 0) return text.slice(idx + marker.length).trim();
  return text.replace(/^Title:\s*[\s\S]*?(?:\n\n|\r\n\r\n)/, '').trim();
}

/** CORS proxies for cross-origin text/JSON. Empty on file:// — null origin is blocked by all public proxies. */
function getActiveCorsProxies() {
  if (location.protocol === 'file:') return [];
  return [
    (url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
    (url) => `https://cors.eu.org/${url}`
  ];
}

async function fetchViaAllOriginsGet(url, asJson = false) {
  const res = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(url)}`);
  if (!res.ok) throw new Error(`proxy HTTP ${res.status}`);
  const data = await res.json();
  if (!data?.contents) throw new Error('empty response');
  return asJson ? JSON.parse(data.contents) : data.contents;
}

/** Fetch text: same-origin Gutenberg proxy on localhost; public proxies elsewhere. */
async function fetchTextWithCorsFallback(url) {
  if (location.protocol === 'file:' && isGutenbergHost(url)) {
    throw new Error('gutenberg-file-protocol');
  }

  const localProxy = toSameOriginGutenbergProxy(url);
  if (localProxy) {
    const res = await fetch(localProxy);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    if (!text || text.length < 50) throw new Error('empty response');
    return text;
  }

  const attempts = [];

  if (!isGutenbergHost(url)) {
    attempts.push(async () => {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.text();
    });
  }

  attempts.push(
    ...getActiveCorsProxies().map((proxy) => async () => {
      const res = await fetch(proxy(url), { headers: { Accept: 'text/plain, text/*, */*' } });
      if (!res.ok) throw new Error(`proxy HTTP ${res.status}`);
      const text = await res.text();
      if (!text || text.length < 50) throw new Error('empty response');
      return text;
    })
  );

  if (location.protocol !== 'file:') {
    attempts.push(async () => fetchViaAllOriginsGet(url, false));
  }

  if (isGutenbergHost(url)) {
    attempts.push(async () => {
      const res = await fetch(`https://r.jina.ai/${url}`, {
        headers: { Accept: 'text/plain, text/*, */*' }
      });
      if (!res.ok) throw new Error(`reader HTTP ${res.status}`);
      const text = stripJinaReaderWrapper(await res.text());
      if (!text || text.length < 50) throw new Error('empty response');
      return text;
    });
  }

  let lastErr;
  for (const attempt of attempts) {
    try {
      return await attempt();
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr || new Error('fetch failed');
}

/** Fetch JSON: direct first (works for Gutendex/PoetryDB even from file://), then proxies. */
async function fetchJsonWithCorsFallback(url) {
  const attempts = [
    async () => {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
    ...getActiveCorsProxies().map((proxy) => async () => {
      const res = await fetch(proxy(url), { headers: { Accept: 'application/json' } });
      if (!res.ok) throw new Error(`proxy HTTP ${res.status}`);
      return res.json();
    })
  ];

  if (location.protocol !== 'file:') {
    attempts.push(async () => fetchViaAllOriginsGet(url, true));
  }

  let lastErr;
  for (const attempt of attempts) {
    try {
      return await attempt();
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr || new Error('fetch failed');
}

async function fetchGutendexResults(query, category) {
  const params = new URLSearchParams({
    languages: 'en',
    mime_type: 'text/plain',
    page_size: '32'
  });
  if (query) params.set('search', query);
  if (category) params.set('topic', category);
  const data = await fetchJsonWithCorsFallback(`https://gutendex.com/books?${params}`);
  return (data.results || []).filter(isGutenbergReadableBook);
}

async function fetchRandomReadableBook(category) {
  for (let attempt = 0; attempt < 6; attempt++) {
    const page = Math.floor(Math.random() * 8) + 1;
    const params = new URLSearchParams({
      languages: 'en',
      mime_type: 'text/plain',
      page_size: '32',
      page: String(page)
    });
    if (category) params.set('topic', category);
    const data = await fetchJsonWithCorsFallback(`https://gutendex.com/books?${params}`);
    const readable = (data.results || []).filter(isGutenbergReadableBook);
    if (readable.length) {
      return readable[Math.floor(Math.random() * readable.length)];
    }
  }
  throw new Error('gutenberg-no-readable');
}

async function fetchGutenbergText(book) {
  if (gutenbergBlockedOnFileProtocol()) {
    throw new Error('gutenberg-file-protocol');
  }
  if (!isGutenbergReadableBook(book)) {
    throw new Error('gutenberg-audio-only');
  }
  const candidates = gutenbergTextCandidates(book);
  if (!candidates.length) throw new Error('gutenberg-no-text');
  let lastErr;
  for (const url of candidates) {
    try {
      const text = await fetchTextWithCorsFallback(url);
      if (text && looksLikeGutenbergStory(text)) return text;
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr || new Error('gutenberg-no-text');
}

async function fetchPoem(author, title) {
  let url;
  if (author && title) {
    url = `https://poetrydb.org/author,title/${encodeURIComponent(author)};${encodeURIComponent(title)}`;
  } else if (author) {
    url = `https://poetrydb.org/author/${encodeURIComponent(author)}`;
  } else if (title) {
    url = `https://poetrydb.org/title/${encodeURIComponent(title)}`;
  } else {
    url = 'https://poetrydb.org/random/1';
  }
  const data = await fetchJsonWithCorsFallback(url);
  const poems = Array.isArray(data) ? data : [data];
  if (!poems.length) throw new Error('no poems found');
  return poems;
}

function toSameOriginMadlibsProxy(apiPath) {
  if (!isLocalhost()) return null;
  return `/api/madlibs${apiPath}`;
}

async function loadMadlibsCdnTemplates() {
  if (madlibsCdnCache) return madlibsCdnCache;
  const res = await fetch(MADLIBS_CDN);
  if (!res.ok) throw new Error(`madlibs CDN HTTP ${res.status}`);
  madlibsCdnCache = await res.json();
  return madlibsCdnCache;
}

/** Live API on localhost (Vite proxy); madlibs-api data via jsDelivr on GitHub Pages. */
async function fetchMadLibApi(apiPath) {
  const proxy = toSameOriginMadlibsProxy(apiPath);
  if (proxy) {
    const res = await fetch(proxy);
    if (!res.ok) throw new Error(`madlibs HTTP ${res.status}`);
    return res.json();
  }

  const templates = await loadMadlibsCdnTemplates();
  if (apiPath === '/api/random') {
    const titles = Object.keys(templates);
    const title = titles[Math.floor(Math.random() * titles.length)];
    return { title, ...templates[title] };
  }
  const storyMatch = apiPath.match(/^\/api\/story\/(.+)$/);
  if (storyMatch) {
    const title = decodeURIComponent(storyMatch[1]);
    const entry = templates[title];
    if (!entry) throw new Error('madlibs-not-found');
    return { title, ...entry };
  }
  throw new Error('madlibs-unknown-path');
}

async function fetchMadLibRandom() {
  const { parseMadLibApiResponse, getRandomBundledMadLib } = await import('./madlibs.js');
  try {
    const data = await fetchMadLibApi('/api/random');
    return parseMadLibApiResponse(data);
  } catch (_) {
    return getRandomBundledMadLib();
  }
}

async function fetchMadLibByTitle(title) {
  const { parseMadLibApiResponse, getBundledMadLib } = await import('./madlibs.js');
  const trimmed = (title || '').trim();
  if (!trimmed) throw new Error('madlibs-no-title');
  const bundled = getBundledMadLib(trimmed);
  try {
    const data = await fetchMadLibApi(`/api/story/${encodeURIComponent(trimmed)}`);
    return parseMadLibApiResponse(data);
  } catch (_) {
    if (bundled) return bundled;
    throw new Error('madlibs-not-found');
  }
}

function poemToText(poem) {
  const lines = poem.lines || [];
  const text = lines.join('\n');
  const author = Array.isArray(poem.author) ? poem.author[0] : poem.author;
  const title = poem.title || 'Untitled Poem';
  return { text, title: author ? `"${title}" by ${author}` : title };
}

export {
  fetchTextWithCorsFallback, fetchJsonWithCorsFallback, fetchGutendexResults,
  fetchGutenbergText, fetchRandomReadableBook, fetchPoem, poemToText,
  fetchMadLibRandom, fetchMadLibByTitle,
  gutenbergTextCandidates, isGutenbergReadableBook, looksLikeGutenbergStory,
  gutenbergUrlPriority, stripJinaReaderWrapper, toSameOriginGutenbergProxy
};
