/*!
 * Tournée calendriers — store.js (données locales + fusion pour le partage)
 * Les données sont gardées dans le navigateur ; sync.js les partage via GitHub.
 * © Jérémy Bizeul / Vigie-lance — Tous droits réservés
 */
(function () {
  'use strict';
  var T = window.Tour;
  var KEY = 'bfs_tournee_v1';
  var state = { houses: [], settings: { team: '' }, deleted: [] };

  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (raw) {
        var d = JSON.parse(raw);
        if (d && Array.isArray(d.houses)) {
          state.houses = d.houses;
          state.settings = d.settings || { team: '' };
          state.deleted = Array.isArray(d.deleted) ? d.deleted : [];
        }
      }
    } catch (e) { console.error('Lecture impossible', e); }
  }
  function persist() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); }
    catch (e) { T.toast('Enregistrement impossible (stockage plein ou bloqué)'); }
  }
  // fromRemote = true : changement venu du partage (ne doit pas être renvoyé)
  function save(fromRemote) {
    persist();
    T.bus.emit('change');
    if (!fromRemote) T.bus.emit('local');
  }
  function numKey(n) {
    var m = String(n || '').match(/\d+/);
    return m ? parseInt(m[0], 10) : 1e9;
  }
  function same(h, street, number) {
    return h.street.toLowerCase() === street.toLowerCase() &&
           String(h.number).toLowerCase() === String(number).toLowerCase();
  }
  function isDeleted(id) { return state.deleted.indexOf(id) >= 0; }

  T.store = {
    all: function () { return state.houses; },
    get: function (id) { return state.houses.filter(function (h) { return h.id === id; })[0] || null; },
    team: function () { return state.settings.team || ''; },
    setTeam: function (t) {
      state.settings.team = String(t || '').trim();
      persist();
      T.bus.emit('change');
    },

    add: function (h) {
      var o = {
        id: T.uid(),
        street: String(h.street || '').trim(),
        number: String(h.number || '').trim(),
        lat: h.lat == null ? null : h.lat,
        lng: h.lng == null ? null : h.lng,
        status: h.status || 'todo',
        note: String(h.note || '').trim(),
        team: h.team || state.settings.team || '',
        updated: new Date().toISOString()
      };
      state.houses.push(o);
      save();
      return o;
    },
    update: function (id, patch) {
      var h = T.store.get(id);
      if (!h) return null;
      Object.keys(patch).forEach(function (k) { h[k] = patch[k]; });
      if (patch.status !== undefined || patch.note !== undefined) {
        h.team = state.settings.team || h.team || '';
      }
      h.updated = new Date().toISOString();
      save();
      return h;
    },
    remove: function (id) {
      state.houses = state.houses.filter(function (h) { return h.id !== id; });
      if (!isDeleted(id)) state.deleted.push(id);
      save();
    },
    // Crée une série de numéros dans une rue (ignore les doublons)
    addRange: function (street, from, to, step) {
      street = String(street || '').trim();
      from = parseInt(from, 10); to = parseInt(to, 10);
      if (!street || isNaN(from) || isNaN(to)) return 0;
      if (from > to) { var t = from; from = to; to = t; }
      var created = 0;
      for (var n = from; n <= to; n++) {
        if (step === 'even' && n % 2 !== 0) continue;
        if (step === 'odd' && n % 2 !== 1) continue;
        var dup = state.houses.some(function (h) { return same(h, street, n); });
        if (dup) continue;
        state.houses.push({
          id: T.uid(), street: street, number: String(n), lat: null, lng: null,
          status: 'todo', note: '', team: state.settings.team || '',
          updated: new Date().toISOString()
        });
        created++;
      }
      if (created) save();
      return created;
    },
    streets: function () {
      var seen = {};
      state.houses.forEach(function (h) { if (h.street) seen[h.street] = 1; });
      return Object.keys(seen).sort(function (a, b) { return a.localeCompare(b, 'fr'); });
    },
    sorted: function (filter) {
      return state.houses
        .filter(function (h) { return !filter || filter === 'all' || h.status === filter; })
        .sort(function (a, b) {
          var s = (a.street || '~').localeCompare(b.street || '~', 'fr');
          return s || numKey(a.number) - numKey(b.number);
        });
    },
    stats: function () {
      var s = { total: state.houses.length, todo: 0, passe: 0, repasser: 0, refus: 0 };
      state.houses.forEach(function (h) { if (s[h.status] !== undefined) s[h.status]++; });
      return s;
    },
    byTeam: function () {
      var out = {};
      state.houses.forEach(function (h) {
        if (h.status === 'todo') return;
        var k = h.team || '(sans équipe)';
        out[k] = out[k] || { passe: 0, repasser: 0, refus: 0 };
        out[k][h.status]++;
      });
      return out;
    },

    // Contenu partagé (sans les réglages propres à l'appareil)
    snapshot: function () {
      return JSON.stringify({ app: 'bfs-tournee', version: T.VERSION, saved: new Date().toISOString(),
        houses: state.houses, deleted: state.deleted });
    },
    exportJSON: function () {
      return JSON.stringify({ app: 'bfs-tournee', version: T.VERSION, exported: new Date().toISOString(),
        houses: state.houses, deleted: state.deleted }, null, 2);
    },
    exportCSV: function () {
      var rows = [['Rue', 'Numéro', 'Statut', 'Note', 'Équipe', 'Latitude', 'Longitude', 'Mis à jour']];
      T.store.sorted().forEach(function (h) {
        rows.push([h.street, h.number, T.STATUS[h.status].label, h.note, h.team,
          h.lat == null ? '' : h.lat, h.lng == null ? '' : h.lng, h.updated]);
      });
      return '﻿' + rows.map(function (r) {
        return r.map(function (c) { return '"' + String(c == null ? '' : c).replace(/"/g, '""') + '"'; }).join(';');
      }).join('\r\n');
    },

    // Fusion : même id => la modification la plus récente gagne ; les suppressions sont conservées
    merge: function (d, fromRemote) {
      if (!d || !Array.isArray(d.houses)) return { ok: false, msg: 'Contenu non reconnu' };
      var added = 0, updated = 0, removed = 0;
      (Array.isArray(d.deleted) ? d.deleted : []).forEach(function (id) {
        if (!isDeleted(id)) state.deleted.push(id);
      });
      state.houses = state.houses.filter(function (h) {
        if (isDeleted(h.id)) { removed++; return false; }
        return true;
      });
      d.houses.forEach(function (n) {
        if (!n || !n.id || !T.STATUS[n.status] || isDeleted(n.id)) return;
        var cur = T.store.get(n.id);
        if (!cur) { state.houses.push(n); added++; }
        else if ((n.updated || '') > (cur.updated || '')) {
          Object.keys(n).forEach(function (k) { cur[k] = n[k]; });
          updated++;
        }
      });
      if (added || updated || removed) save(!!fromRemote); else persist();
      return { ok: true, added: added, updated: updated, removed: removed,
        msg: added + ' ajoutée(s), ' + updated + ' mise(s) à jour, ' + removed + ' supprimée(s)' };
    },
    importJSON: function (text) {
      var d;
      try { d = JSON.parse(text); } catch (e) { return { ok: false, msg: 'Fichier illisible' }; }
      if (!d || d.app !== 'bfs-tournee') return { ok: false, msg: 'Ce fichier n\'est pas une sauvegarde de l\'appli' };
      return T.store.merge(d, false);
    },
    reset: function () {
      state.houses.forEach(function (h) { if (!isDeleted(h.id)) state.deleted.push(h.id); });
      state.houses = [];
      save();
    }
  };

  load();
})();
