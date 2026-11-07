/*!
 * Tournée calendriers — list.js (liste par rue)
 * © Jérémy Bizeul / Vigie-lance — Tous droits réservés
 */
(function () {
  'use strict';
  var T = window.Tour;
  var filter = 'all', quartier = 'all';

  function renderFilters() {
    var s = T.store.stats();
    var items = [['all', 'Tout (' + s.total + ')']].concat(T.STATUS_ORDER.map(function (k) {
      return [k, T.STATUS[k].label + ' (' + s[k] + ')'];
    }));
    T.$('#filters').innerHTML = items.map(function (it) {
      return '<button class="chip' + (filter === it[0] ? ' on' : '') + '" data-f="' + it[0] + '">' + T.esc(it[1]) + '</button>';
    }).join('');
  }

  function render() {
    renderFilters();
    var list = T.store.sorted(filter).filter(function (h) {
      if (quartier === 'all') return true;
      var q = T.quartierOf(h.street);
      return quartier === '_none' ? !q : q === quartier;
    });
    var body = T.$('#listBody');
    if (!list.length) {
      body.innerHTML = '<p class="empty">' + (T.store.all().length
        ? 'Aucune habitation avec ce statut.'
        : 'Aucune habitation pour l\'instant.<br>Ajoutez une rue ici, ou touchez la carte avec le bouton ＋.') + '</p>';
      return;
    }
    var html = '', cur = null;
    var all = T.store.all();
    list.forEach(function (h) {
      var street = h.street || '(sans rue)';
      if (street !== cur) {
        cur = street;
        var inStreet = all.filter(function (x) { return (x.street || '(sans rue)') === street; });
        var done = inStreet.filter(function (x) { return x.status !== 'todo'; }).length;
        html += '<div class="street-h"><span>' + T.esc(street) + '</span><small>' + done + '/' + inStreet.length + ' visitées</small></div>';
      }
      html += '<div class="row-h" data-id="' + h.id + '">' +
        '<div class="pin s-' + h.status + '">' + T.esc(String(h.number || '').slice(0, 4)) + '</div>' +
        '<div class="main"><b>' + T.esc(street) + ' ' + T.esc(h.number) + (h.unit ? ' · ' + T.esc(h.unit) : '') + '</b>' +
        '<small>' + ((h.visits || []).length > 1 ? (h.visits.length + ' passages · ') : '') + T.esc(h.note || '') + (h.lat == null ? ' · non placée sur la carte' : '') + '</small></div>' +
        '<span class="st">' + T.STATUS[h.status].label + '</span></div>';
    });
    body.innerHTML = html;
  }

  function init() {
    T.$('#qFilter').innerHTML = '<option value="all">Tous les quartiers</option>' +
      T.QUARTIERS.map(function (q) { return '<option value="' + T.esc(q.name) + '">' + T.esc(q.name) + '</option>'; }).join('') +
      '<option value="_none">Autres rues</option>';
    T.$('#qFilter').addEventListener('change', function () { quartier = this.value; render(); });
    T.$('#filters').addEventListener('click', function (e) {
      var b = e.target.closest('[data-f]');
      if (!b) return;
      filter = b.getAttribute('data-f');
      render();
    });
    T.$('#listBody').addEventListener('click', function (e) {
      var r = e.target.closest('[data-id]');
      if (r) T.app.openSheet(r.getAttribute('data-id'));
    });
    T.$('#btnToggleRange').addEventListener('click', function () {
      T.$('#rangeForm').classList.toggle('hidden');
    });
    T.$('#rangeForm').addEventListener('submit', function (e) {
      e.preventDefault();
      var n = T.store.addRange(T.$('#rgStreet').value, T.$('#rgFrom').value, T.$('#rgTo').value, T.$('#rgStep').value);
      T.toast(n + ' habitation(s) créée(s)');
      T.$('#rangeForm').classList.add('hidden');
      T.$('#rgStreet').value = '';
    });
    T.bus.on('change', render);
    render();
  }

  T.list = { init: init, render: render, setFilter: function (f) { filter = f; render(); } };
})();
