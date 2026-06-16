import { loadNlpEngine, awaitWinkEngine } from '../../src/lib/nlp-engine.js';

let compromiseEngine = null;
let fullEngine = null;

export async function getCompromiseEngine() {
  if (!compromiseEngine) {
    compromiseEngine = await loadNlpEngine();
  }
  return compromiseEngine;
}

export async function getFullEngine() {
  if (!fullEngine) {
    const engine = await getCompromiseEngine();
    await awaitWinkEngine(engine);
    fullEngine = engine;
  }
  return fullEngine;
}

export async function getEngine(mode = 'compromise') {
  return mode === 'compromise+wink' ? getFullEngine() : getCompromiseEngine();
}
