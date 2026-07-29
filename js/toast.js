/* ═══════════════════════════════════════════════════════
   4b · TOAST — notifications éphémères
   ═══════════════════════════════════════════════════════ */

import { EL, esc } from './dom.js';
import { TOAST_MS } from './config.js';

export function toast(text, kind = ''){
  const box = EL['ui-toasts'];
  if (!box){ console.log('[toast]', text); return; }

  const el = document.createElement('div');
  el.className = 'toast' + (kind ? ' toast-' + kind : '');
  el.innerHTML = esc(text);
  box.appendChild(el);

  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(6px)';
    setTimeout(() => el.remove(), 200);
  }, TOAST_MS);
}

export const ok   = t => toast(t, 'ok');
export const err  = t => toast(t, 'danger');
export const warn = t => toast(t, 'warn');
export const info = m => toast(m, 'info');

/* ─── Confirmation modale ─── */
let resolver = null;

export function confirmBox(text){
  const mod = EL['m-confirm'];
  if (!mod) return Promise.resolve(window.confirm(text));

  EL['ui-confirm-text'].textContent = text;
  mod.hidden = false;

  return new Promise(res => { resolver = res; });
}

export function initConfirm(){
  const close = (val) => {
    EL['m-confirm'].hidden = true;
    if (resolver){ resolver(val); resolver = null; }
  };
  EL['btn-confirm-ok']?.addEventListener('click', () => close(true));
  EL['btn-confirm-cancel']?.addEventListener('click', () => close(false));
  EL['m-confirm']?.addEventListener('click', e => {
    if (e.target === EL['m-confirm']) close(false);
  });
}
