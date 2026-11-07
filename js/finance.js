/*!
 * Tournée calendriers — finance.js (onglet Dons : bilan, caisse, reçus)
 * Les montants viennent des fiches habitations ; le comptage de caisse reprend celui du tableur de la tournée.
 * © Jérémy Bizeul / Vigie-lance — Tous droits réservés
 */
(function () {
  'use strict';
  var T = window.Tour;
  var ESP = [200, 100, 50, 20, 10, 5, 2, 1, 0.5, 0.2, 0.1, 0.05, 0.02, 0.01];
  var CHQ = [150, 100, 75, 50, 40, 35, 30, 25, 20, 15, 12, 10, 8, 5];
  var group = 'team', caisseTeam = '';
  var fmt = function (n) { return T.money.fmt(n); };

  function active() { return T.$('#view-dons').classList.contains('active'); }
  function r2(n) { return Math.round(n * 100) / 100; }

  /* ---------- bilan ---------- */
  var GROUP_LABEL = { team: 'Équipe', quartier: 'Quartier', day: 'Jour' };

  function renderSummary() {
    var f = T.store.finance(), a = f.all;
    var kpis = [
      ['Total collecté', fmt(a.total), '#1d2024'],
      ['Espèces', fmt(a.esp), '#2e9e4f'],
      ['Chèques', fmt(a.chq), '#f0952b'],
      ['Dons', String(a.n - a.gratuit), '#8a8f98'],
      ['Gratuits', String(a.gratuit), '#8a8f98'],
      ['Don moyen', fmt(a.n - a.gratuit ? a.total / (a.n - a.gratuit) : 0), '#8a8f98']
    ];
    T.$('#finKpi').innerHTML = kpis.map(function (k) {
      return '<div class="kpi" style="border-left-color:' + k[2] + '"><b style="font-size:20px">' + T.esc(k[1]) + '</b><span>' + T.esc(k[0]) + '</span></div>';
    }).join('');

    T.$$('#finGroups .chip').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-g') === group); });
    var rows = f[group], keys = Object.keys(rows).sort(function (x, y) { return x.localeCompare(y, 'fr'); });
    T.$('#finTable').innerHTML = keys.length
      ? '<table><tr><th>' + GROUP_LABEL[group] + '</th><th>Total</th><th>Esp.</th><th>Chq.</th><th>Dons</th></tr>' +
        keys.map(function (k) {
          var b = rows[k];
          return '<tr><td>' + T.esc(k) + '</td><td>' + fmt(b.total) + '</td><td>' + fmt(b.esp) + '</td><td>' + fmt(b.chq) + '</td><td>' + b.n + '</td></tr>';
        }).join('') +
        '<tr><th>Total</th><th>' + fmt(a.total) + '</th><th>' + fmt(a.esp) + '</th><th>' + fmt(a.chq) + '</th><th>' + a.n + '</th></tr></table>'
      : '<p class="hint">Aucun don saisi pour l\'instant. Ouvrez une habitation, notez le montant et le paiement, puis touchez « Passé ».</p>';

    renderReceipts();
  }

  /* ---------- reçus / factures ---------- */
  function renderReceipts() {
    var list = T.store.receipts();
    T.$('#rcTxt').textContent = list.length + ' reçu(s) ou facture(s) demandé(s)';
    T.$('#rcList').innerHTML = list.map(function (h) {
      var addr = h.street + ' ' + h.number + (h.unit ? ' · ' + h.unit : '');
      return '<div class="row-h" data-id="' + h.id + '"><div class="main"><b>' + T.esc(h.donor || '(nom à compléter)') + '</b>' +
        '<small>' + T.esc(addr) + ' · ' + T.esc(T.money.label(h) || 'pas de don saisi') + (h.email ? ' · ' + T.esc(h.email) : '') + '</small></div></div>';
    }).join('');
  }

  /* ---------- caisse ---------- */
  function teamList() {
    var f = T.store.finance(), seen = {};
    Object.keys(f.team).forEach(function (t) { seen[t] = 1; });
    T.store.teamsWithCaisse().forEach(function (t) { seen[t] = 1; });
    if (T.store.team()) seen[T.store.team()] = 1;
    var l = Object.keys(seen).sort(function (a, b) { return a.localeCompare(b, 'fr'); });
    return l.length ? l : ['(sans équipe)'];
  }

  function key(v) { return String(v).replace('.', '_'); }

  function table(title, denoms, kind, saved) {
    return '<table class="caisse"><tr><th>' + title + '</th><th>Quantité</th><th>Montant</th></tr>' +
      denoms.map(function (d) {
        var q = saved && saved[kind] && saved[kind][key(d)] || '';
        return '<tr><td>' + fmt(d) + '</td><td><input type="number" min="0" step="1" inputmode="numeric" class="cq" data-k="' + kind + '" data-d="' + d + '" value="' + q + '"></td>' +
          '<td class="cm" data-m="' + kind + '-' + key(d) + '"></td></tr>';
      }).join('') + '</table>';
  }

  function buildCaisse() {
    var sel = T.$('#caisseTeam');
    var teams = teamList();
    if (!caisseTeam || teams.indexOf(caisseTeam) < 0) caisseTeam = teams.indexOf(T.store.team()) >= 0 ? T.store.team() : teams[0];
    sel.innerHTML = teams.map(function (t) { return '<option' + (t === caisseTeam ? ' selected' : '') + '>' + T.esc(t) + '</option>'; }).join('');
    var saved = T.store.getCaisse(caisseTeam);
    T.$('#caisseBox').innerHTML = table('Espèces', ESP, 'esp', saved) + table('Chèques', CHQ, 'chq', saved) +
      '<label>Autres chèques (montant total en €)<input id="chqOther" type="text" inputmode="decimal" value="' + (saved && saved.chqOther ? String(saved.chqOther).replace('.', ',') : '') + '"></label>' +
      '<div id="caisseRes"></div>';
    T.$('#caisseMsg').textContent = saved ? 'Dernier enregistrement : ' + new Date(saved.updated).toLocaleString('fr-FR') : 'Aucun comptage enregistré pour cette équipe.';
    computeCaisse();
  }

  // Lecture des quantités saisies
  function readCaisse() {
    var out = { esp: {}, chq: {}, chqOther: 0 };
    T.$$('#caisseBox .cq').forEach(function (i) {
      var q = parseInt(i.value, 10);
      if (q > 0) out[i.getAttribute('data-k')][key(i.getAttribute('data-d'))] = q;
    });
    var o = T.money.parse(T.$('#chqOther').value || '0');
    out.chqOther = isNaN(o) ? 0 : o;
    return out;
  }

  function computeCaisse() {
    var c = readCaisse(), counted = { esp: 0, chq: 0 };
    T.$$('#caisseBox .cq').forEach(function (i) {
      var k = i.getAttribute('data-k'), d = parseFloat(i.getAttribute('data-d')), q = parseInt(i.value, 10) || 0;
      counted[k] += Math.round(d * 100) * q;
      var cell = T.$('[data-m="' + k + '-' + key(d) + '"]');
      if (cell) cell.textContent = q ? fmt(d * q) : '';
    });
    counted.chq += Math.round(c.chqOther * 100);
    var f = T.store.finance(), t = f.team[caisseTeam] || { esp: 0, chq: 0, total: 0 };
    function line(label, cnt, exp) {
      var diff = r2(cnt / 100 - exp);
      return '<tr><td>' + label + '</td><td>' + fmt(cnt / 100) + '</td><td>' + fmt(exp) + '</td>' +
        '<td class="' + (Math.abs(diff) < 0.005 ? 'ok' : 'ko') + '">' + (Math.abs(diff) < 0.005 ? 'OK' : (diff > 0 ? '+' : '') + fmt(diff)) + '</td></tr>';
    }
    T.$('#caisseRes').innerHTML = '<table><tr><th></th><th>Compté</th><th>Saisi</th><th>Écart</th></tr>' +
      line('Espèces', counted.esp, t.esp) + line('Chèques', counted.chq, t.chq) +
      line('Total', counted.esp + counted.chq, t.esp + t.chq) + '</table>';
  }

  /* ---------- démarrage ---------- */
  function build() {
    T.$('#donsBody').innerHTML =
      '<div class="grid" id="finKpi"></div>' +
      '<div class="card"><h3>Bilan</h3>' +
        '<div id="finGroups" class="chips" style="margin-bottom:8px"><button class="chip on" data-g="team">Par équipe</button>' +
        '<button class="chip" data-g="quartier">Par quartier</button><button class="chip" data-g="day">Par jour</button></div>' +
        '<div id="finTable"></div></div>' +
      '<div class="card"><h3>Caisse</h3>' +
        '<label>Équipe<select id="caisseTeam"></select></label>' +
        '<div id="caisseBox"></div>' +
        '<button id="btnCaisseSave" class="btn-main" type="button">Enregistrer le comptage</button>' +
        '<p id="caisseMsg" class="hint"></p></div>' +
      '<div class="card"><h3>Reçus et factures demandés</h3><p id="rcTxt" class="hint" style="margin-top:0"></p><div id="rcList"></div>' +
        '<div class="btn-col" style="margin-top:8px"><button id="btnRcCsv" class="btn-sec" type="button">Exporter les demandes de reçu (CSV)</button>' +
        '<button id="btnDonsCsv" class="btn-sec" type="button">Exporter tous les dons (CSV)</button></div></div>' +
      '<p class="hint">Les noms et montants sont des données personnelles : à ne garder que le temps de la tournée, puis à supprimer.</p>';

    T.$('#finGroups').addEventListener('click', function (e) {
      var b = e.target.closest('[data-g]');
      if (b) { group = b.getAttribute('data-g'); renderSummary(); }
    });
    T.$('#caisseTeam').addEventListener('change', function () { caisseTeam = this.value; buildCaisse(); });
    T.$('#caisseBox').addEventListener('input', computeCaisse);
    T.$('#btnCaisseSave').addEventListener('click', function () {
      T.store.setCaisse(caisseTeam, readCaisse());
      T.toast('Comptage enregistré');
      buildCaisse();
    });
    T.$('#rcList').addEventListener('click', function (e) {
      var r = e.target.closest('[data-id]');
      if (r) T.app.openSheet(r.getAttribute('data-id'));
    });
    T.$('#btnRcCsv').addEventListener('click', function () {
      T.download('recus-' + new Date().toISOString().slice(0, 10) + '.csv', T.store.exportDonsCSV(true), 'text/csv;charset=utf-8');
    });
    T.$('#btnDonsCsv').addEventListener('click', function () {
      T.download('dons-' + new Date().toISOString().slice(0, 10) + '.csv', T.store.exportDonsCSV(false), 'text/csv;charset=utf-8');
    });
  }

  function init() {
    build();
    // Le formulaire de caisse n'est pas redessiné à chaque changement (pour ne pas perdre la saisie en cours)
    T.bus.on('change', function () { if (active()) { renderSummary(); computeCaisse(); } });
  }

  function show() { renderSummary(); buildCaisse(); }

  T.finance = { init: init, show: show, ESP: ESP, CHQ: CHQ };
})();
