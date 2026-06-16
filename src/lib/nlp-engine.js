import nlp from 'compromise/three';
import { buildCompromiseHints } from './nlp-hints.js';

let winkPromise = null;
let winkCache = null;

async function loadWink() {
  const [winkModule, modelModule] = await Promise.all([
    import('wink-nlp'),
    import('wink-eng-lite-web-model')
  ]);
  const winkNLP = winkModule.default;
  const model = modelModule.default;
  const instance = winkNLP(model);
  return { name: 'wink', nlp: instance, its: instance.its };
}

function attachWink(engine, wink) {
  if (!wink) return;
  engine.wink = wink;
  engine.name = 'compromise+wink';
}

/** Load compromise immediately; wink loads in the background (~1 MB model). */
export async function loadNlpEngine() {
  const engine = {
    name: 'compromise',
    nlp,
    wink: null,
    buildHints: buildCompromiseHints
  };

  if (winkCache) {
    attachWink(engine, winkCache);
    return engine;
  }

  if (!winkPromise) {
    winkPromise = loadWink()
      .then(wink => {
        winkCache = wink;
        return wink;
      })
      .catch(() => null);
  }

  winkPromise.then(wink => attachWink(engine, wink));

  return engine;
}

export async function awaitWinkEngine(engine) {
  if (engine.wink) return engine.wink;
  const wink = await (winkPromise || Promise.resolve(null));
  attachWink(engine, wink);
  return wink;
}
