/* ═══════════════════════════════════════════════════════
   7 · AUTH — connexion seule, inscriptions fermées
   ═══════════════════════════════════════════════════════ */

import { SUPA_URL, SUPA_KEY } from './config.js';
import { EL, on, show, hide, setTxt, getVal } from './dom.js';
import { S } from './state.js';

export const sb = window.supabase.createClient(SUPA_URL, SUPA_KEY, {
  auth: { persistSession:true, autoRefreshToken:true }
});

let onLogin  = () => {};
let onLogout = () => {};

function msg(text, ok = false){
  const el = EL['auth-msg'];
  if (!el) return;
  el.textContent = text || '';
  el.classList.toggle('is-ok', ok);
}

function humanError(err){
  const m = (err?.message || '').toLowerCase();
  if (m.includes('invalid login'))     return 'Email ou mot de passe incorrect.';
  if (m.includes('email not confirmed')) return 'Compte non confirmé. Contacte l\'administrateur.';
  if (m.includes('rate limit'))        return 'Trop de tentatives. Patiente une minute.';
  if (m.includes('failed to fetch'))   return 'Pas de connexion réseau.';
  return err?.message || 'Erreur inconnue.';
}

async function submit(e){
  e.preventDefault();
  const email = getVal('auth-email').trim();
  const pass  = getVal('auth-pass');

  if (!email){                 return msg('Email requis.'); }
  if (!pass || pass.length<6){ return msg('Mot de passe : 6 caractères minimum.'); }

  EL['auth-submit'].disabled = true;
  msg('Connexion…');

  const { data, error } = await sb.auth.signInWithPassword({ email, password: pass });

  EL['auth-submit'].disabled = false;

  if (error){ return msg(humanError(error)); }

  msg('');
  enter(data.user);
}

function enter(user){
  S.user = user;
  hide('auth-view');
  show('ui-app');
  setTxt('ui-user-email', user.email);
  onLogin(user);
}

function leave(){
  S.user = null;
  hide('ui-app');
  show('auth-view');
  EL['auth-pass'].value = '';
  msg('');
  onLogout();
}

export async function logout(){
  await sb.auth.signOut();
  leave();
}

/** Branche l'auth. Appelé une seule fois par boot.js */
export async function initAuth({ onLogin:cbIn, onLogout:cbOut }){
  onLogin  = cbIn  || onLogin;
  onLogout = cbOut || onLogout;

  on('auth-form',      'submit', submit);
  on('ui-btn-logout',  'click',  logout);

  const { data } = await sb.auth.getSession();
  if (data?.session?.user) enter(data.session.user);
  else { show('auth-view'); hide('ui-app'); }

  sb.auth.onAuthStateChange((evt) => {
    if (evt === 'SIGNED_OUT' && S.user) leave();
  });
}
