/*!
 * Tournée calendriers — core.js (constantes, utilitaires, bus d'événements)
 * © Jérémy Bizeul / Vigie-lance — Tous droits réservés
 */
(function () {
  'use strict';
  var T = window.Tour = window.Tour || {};

  T.VERSION = '0.1-test-local';

  T.STATUS = {
    todo:     { label: 'Pas visité', color: '#8a8f98' },
    passe:    { label: 'Passé',      color: '#2e9e4f' },
    repasser: { label: 'À repasser', color: '#f0952b' },
    refus:    { label: 'Refus',      color: '#d6402f' }
  };
  T.STATUS_ORDER = ['passe', 'repasser', 'refus', 'todo'];

  T.$ = function (s, r) { return (r || document).querySelector(s); };
  T.$$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  T.esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };

  T.uid = function () {
    return 'h' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  };

  var tt;
  T.toast = function (msg) {
    var el = T.$('#toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.remove('hidden');
    clearTimeout(tt);
    tt = setTimeout(function () { el.classList.add('hidden'); }, 2500);
  };

  // Petit bus d'événements
  var handlers = {};
  T.bus = {
    on: function (name, fn) { (handlers[name] = handlers[name] || []).push(fn); },
    emit: function (name, data) { (handlers[name] || []).forEach(function (fn) { fn(data); }); }
  };

  T.download = function (filename, text, mime) {
    var blob = new Blob([text], { type: mime || 'text/plain' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  };
})();
