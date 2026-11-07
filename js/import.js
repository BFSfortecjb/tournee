/*!
 * Tournée calendriers — import.js (import d'adresses depuis la Base Adresse Nationale)
 * Source des données : Base Adresse Nationale (BAN), Licence Ouverte.
 * © Jérémy Bizeul / Vigie-lance — Tous droits réservés
 */
(function () {
  'use strict';
  var T = window.Tour;
  var voies = [], sel = {}, kind = 'all', query = '', srcLabel = '';

  function norm(s) {
    return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  }
  function numKey(n) {
    var m = String(n || '').match(/\d+/);
    return m ? parseInt(m[0], 10) : 1e9;
  }

  // Lecture CSV (séparateur ; ou , détecté, guillemets gérés)
  function parseCSV(text) {
    if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
    var first = text.slice(0, text.indexOf('\n') + 1 || text.length);
    var sep = first.split(';').length >= first.split(',').length ? ';' : ',';
    var rows = [], row = [], f = '', q = false, c;
    for (var i = 0; i < text.length; i++) {
      c = text[i];
      if (q) {
        if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; }
        else f += c;
      } else if (c === '"') q = true;
      else if (c === sep) { row.push(f); f = ''; }
      else if (c === '\n') { row.push(f); rows.push(row); row = []; f = ''; }
      else if (c !== '\r') f += c;
    }
    if (f !== '' || row.length) { row.push(f); rows.push(row); }
    return rows;
  }

  // Regroupe les adresses par voie. Retourne { ok, voies } ou { ok:false, msg }
  function build(text) {
    var rows = parseCSV(text);
    if (rows.length < 2) return { ok: false, msg: 'Fichier vide' };
    var head = rows[0].map(function (h) { return h.trim().toLowerCase(); });
    var ix = {};
    ['numero', 'rep', 'nom_voie', 'id_fantoir', 'lon', 'lat', 'type_position'].forEach(function (k) { ix[k] = head.indexOf(k); });
    if (ix.numero < 0 || ix.nom_voie < 0 || ix.lon < 0 || ix.lat < 0) {
      return { ok: false, msg: 'Ce fichier n\'est pas un CSV d\'adresses de la BAN (colonnes numero, nom_voie, lon, lat attendues)' };
    }
    var map = {}, list = [];
    for (var i = 1; i < rows.length; i++) {
      var r = rows[i];
      var name = (r[ix.nom_voie] || '').trim();
      var lat = parseFloat(r[ix.lat]), lng = parseFloat(r[ix.lon]);
      var num = (r[ix.numero] || '').trim();
      if (!name || !num || isNaN(lat) || isNaN(lng)) continue;
      var rep = ix.rep >= 0 ? (r[ix.rep] || '').trim() : '';
      var label = rep ? num + ' ' + rep : num;
      var v = map[name];
      if (!v) {
        v = map[name] = { name: name, ld: ix.id_fantoir >= 0 ? !(r[ix.id_fantoir] || '').trim() : false, items: [], seen: {} };
        list.push(v);
      }
      var key = label.toLowerCase();
      var entree = ix.type_position >= 0 && r[ix.type_position] === 'entrée';
      var prev = v.seen[key];
      if (prev === undefined) {
        v.seen[key] = v.items.length;
        v.items.push({ num: label, lat: lat, lng: lng, e: entree });
      } else if (entree && !v.items[prev].e) {
        v.items[prev] = { num: label, lat: lat, lng: lng, e: true };
      }
    }
    list.forEach(function (v) {
      delete v.seen;
      v.items.sort(function (a, b) { return numKey(a.num) - numKey(b.num) || a.num.localeCompare(b.num); });
    });
    list.sort(function (a, b) { return a.name.localeCompare(b.name, 'fr'); });
    return { ok: true, voies: list };
  }

  /* ---------- interface ---------- */
  function visible() {
    var q = norm(query);
    return voies.map(function (v, i) { return { v: v, i: i }; }).filter(function (o) {
      if (kind === 'rue' && o.v.ld) return false;
      if (kind === 'ld' && !o.v.ld) return false;
      return !q || norm(o.v.name).indexOf(q) >= 0;
    });
  }

  function summary() {
    var nv = 0, na = 0;
    voies.forEach(function (v, i) { if (sel[i]) { nv++; na += v.items.length; } });
    return { nv: nv, na: na };
  }

  function render() {
    var vis = visible();
    T.$('#impList').innerHTML = vis.length ? vis.map(function (o) {
      return '<label class="imp-row"><input type="checkbox" data-i="' + o.i + '"' + (sel[o.i] ? ' checked' : '') + '>' +
        '<span>' + T.esc(o.v.name) + (o.v.ld ? ' <em>lieu-dit</em>' : '') + '</span><small>' + o.v.items.length + '</small></label>';
    }).join('') : '<p class="empty">Aucune voie.</p>';
    T.$$('#impKinds .chip').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-k') === kind); });
    var s = summary();
    T.$('#impSum').textContent = s.nv + ' voie(s) cochée(s) — ' + s.na + ' adresse(s)';
    T.$('#impGo').disabled = !s.na;
    T.$('#impGo').textContent = s.na ? 'Importer ' + s.na + ' adresse(s)' : 'Cochez des rues à importer';
  }

  function setData(text, label) {
    var res = build(text);
    if (!res.ok) { T.toast(res.msg); return false; }
    voies = res.voies; sel = {}; srcLabel = label;
    var total = voies.reduce(function (n, v) { return n + v.items.length; }, 0);
    T.$('#impSrc').textContent = label + ' : ' + voies.length + ' voies, ' + total + ' adresses';
    render();
    return true;
  }

  function open() {
    T.$('#imp').classList.remove('hidden');
    if (voies.length) { render(); return; }
    T.$('#impSrc').textContent = 'Chargement des adresses de Bannalec…';
    fetch('data/bannalec.csv', { cache: 'no-store' }).then(function (r) {
      if (!r.ok) throw new Error('absent');
      return r.text();
    }).then(function (t) { setData(t, 'Bannalec (29004)'); })
      .catch(function () {
        T.$('#impSrc').textContent = 'Fichier data/bannalec.csv introuvable : chargez un CSV de la BAN avec le bouton ci-dessous.';
      });
  }

  function doImport() {
    var items = [];
    voies.forEach(function (v, i) {
      if (!sel[i]) return;
      v.items.forEach(function (a) { items.push({ street: v.name, number: a.num, lat: a.lat, lng: a.lng }); });
    });
    if (!items.length) return;
    if (T.store.all().length + items.length > 5000 &&
        !confirm('Cela porte le total à plus de 5 000 habitations : le partage de la version test risque de devenir trop lourd (limite GitHub environ 1 Mo). Continuer ?')) return;
    var r = T.store.addAddresses(items);
    T.$('#imp').classList.add('hidden');
    sel = {};
    T.toast(r.created + ' ajoutée(s)' + (r.placed ? ', ' + r.placed + ' placée(s) sur la carte' : '') + (r.skipped ? ', ' + r.skipped + ' déjà présente(s)' : ''));
  }

  function init() {
    T.$('#btnOpenImp').addEventListener('click', open);
    T.$('#impClose').addEventListener('click', function () { T.$('#imp').classList.add('hidden'); });
    T.$('#impSearch').addEventListener('input', function () { query = this.value; render(); });
    T.$('#impKinds').addEventListener('click', function (e) {
      var b = e.target.closest('[data-k]');
      if (b) { kind = b.getAttribute('data-k'); render(); }
    });
    T.$('#impList').addEventListener('change', function (e) {
      var i = e.target.getAttribute('data-i');
      if (i === null) return;
      if (e.target.checked) sel[i] = 1; else delete sel[i];
      var s = summary();
      T.$('#impSum').textContent = s.nv + ' voie(s) cochée(s) — ' + s.na + ' adresse(s)';
      T.$('#impGo').disabled = !s.na;
      T.$('#impGo').textContent = s.na ? 'Importer ' + s.na + ' adresse(s)' : 'Cochez des rues à importer';
    });
    T.$('#impAll').addEventListener('click', function () { visible().forEach(function (o) { sel[o.i] = 1; }); render(); });
    T.$('#impNone').addEventListener('click', function () { visible().forEach(function (o) { delete sel[o.i]; }); render(); });
    T.$('#impGo').addEventListener('click', doImport);
    T.$('#btnImpFile').addEventListener('click', function () { T.$('#impFile').click(); });
    T.$('#impFile').addEventListener('change', function () {
      var f = this.files && this.files[0], input = this;
      if (!f) return;
      var r = new FileReader();
      r.onload = function () { setData(String(r.result), f.name); input.value = ''; };
      r.readAsText(f);
    });
  }

  T.imp = { init: init, parse: build };
})();
