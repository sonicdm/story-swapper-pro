import { appState } from './state.js';

function $(sel) { return document.querySelector(sel); }
function $$(sel) { return document.querySelectorAll(sel); }

function setStatus(msg, type = 'info') {
  const el = $('#status');
  el.textContent = msg || '';
  el.className = type;
}

function showPhase(phase) {
  appState.phase = phase;
  $('#main').dataset.phase = phase;
  $$('.phase').forEach(p => p.classList.remove('active'));
  const panel = $(`#phase-${phase}`);
  if (panel) panel.classList.add('active');
  const sticky = $('#btn-sticky-reveal');
  if (sticky) sticky.classList.toggle('hidden', phase !== 'prompts');
}

function switchTab(tabName) {
  $$('.tab').forEach(t => {
    const active = t.dataset.tab === tabName;
    t.setAttribute('aria-selected', active ? 'true' : 'false');
  });
  $$('.panel').forEach(p => p.classList.remove('active'));
  $(`#panel-${tabName}`)?.classList.add('active');
}

function countWords(text) {
  const m = text.match(/\b[\w''-]+\b/g);
  return m ? m.length : 0;
}
export { $, $$, setStatus, showPhase, switchTab, countWords };
