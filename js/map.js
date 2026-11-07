/*!
 * Tournée calendriers — map.js (carte Leaflet / OpenStreetMap)
 * © Jérémy Bizeul / Vigie-lance — Tous droits réservés
 */
(function () {
  'use strict';
  var T = window.Tour;
  var map, layer, addMode = false, placingId = null, fitted = false, mePin = null;

  function icon(h) {
    var txt = T.esc(String(h.number || '').slice(0, 4));
    return L.divIcon({
      className: '',
      html: '<div class="pin s-' + h.status + '">' + txt + '</div>',
      iconSize: [28, 28], iconAnchor: [14, 14]
    });
  }

  function render() {
    if (!map) return;
    layer.clearLayers();
    var pts = [];
    T.store.all().forEach(function (h) {
      if (h.lat == null || h.lng == null) return;
      var m = L.marker([h.lat, h.lng], { icon: icon(h) });
      m.on('click', function () { T.app.openSheet(h.id); });
      m.addTo(layer);
      pts.push([h.lat, h.lng]);
    });
    if (!fitted && pts.length) {
      map.fitBounds(pts, { padding: [40, 40], maxZoom: 18 });
      fitted = true;
    }
  }

  function setAddMode(on) {
    addMode = !!on;
    T.$('#btnAdd').classList.toggle('on', addMode);
    T.$('#btnAdd').textContent = addMode ? '✕' : '＋';
    T.$('#addBanner').classList.toggle('hidden', !addMode);
  }

  function startPlacing(id) {
    placingId = id;
    setAddMode(false);
    T.$('#placeBanner').classList.remove('hidden');
  }
  function stopPlacing() {
    placingId = null;
    T.$('#placeBanner').classList.add('hidden');
  }

  function init() {
    map = L.map('map', { zoomControl: false }).setView([48.2, -3.5], 9);
    L.control.zoom({ position: 'bottomleft' }).addTo(map);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap'
    }).addTo(map);
    layer = L.layerGroup().addTo(map);

    map.on('click', function (e) {
      if (placingId) {
        T.store.update(placingId, { lat: e.latlng.lat, lng: e.latlng.lng });
        var id = placingId;
        stopPlacing();
        T.toast('Habitation placée');
        T.app.openSheet(id);
      } else if (addMode) {
        T.app.openSheet(null, { lat: e.latlng.lat, lng: e.latlng.lng });
      }
    });

    T.$('#btnAdd').addEventListener('click', function () { setAddMode(!addMode); });
    T.$('#btnCancelPlace').addEventListener('click', stopPlacing);
    T.$('#btnLocate').addEventListener('click', locate);
    T.$('#searchForm').addEventListener('submit', function (e) {
      e.preventDefault();
      search(T.$('#searchInput').value);
    });
    T.bus.on('change', render);
    render();
  }

  function locate() {
    if (!navigator.geolocation) { T.toast('Position non disponible'); return; }
    T.toast('Recherche de votre position…');
    navigator.geolocation.getCurrentPosition(function (p) {
      var ll = [p.coords.latitude, p.coords.longitude];
      map.setView(ll, 18);
      if (mePin) map.removeLayer(mePin);
      mePin = L.circleMarker(ll, { radius: 8, color: '#fff', weight: 3, fillColor: '#1a73e8', fillOpacity: 1 }).addTo(map);
    }, function () {
      T.toast('Position refusée (vérifiez l\'autorisation et le HTTPS)');
    }, { enableHighAccuracy: true, timeout: 15000 });
  }

  function search(q) {
    q = String(q || '').trim();
    if (!q) return;
    fetch('https://nominatim.openstreetmap.org/search?format=json&limit=1&q=' + encodeURIComponent(q))
      .then(function (r) { return r.json(); })
      .then(function (a) {
        if (!a.length) { T.toast('Adresse introuvable'); return; }
        map.setView([parseFloat(a[0].lat), parseFloat(a[0].lon)], 18);
      })
      .catch(function () { T.toast('Recherche impossible (réseau)'); });
  }

  // Rue + numéro d'après des coordonnées (OpenStreetMap), au mieux
  function reverse(lat, lng) {
    return fetch('https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1&zoom=18&lat=' + lat + '&lon=' + lng)
      .then(function (r) { return r.json(); })
      .then(function (d) {
        var a = (d && d.address) || {};
        return { street: a.road || a.pedestrian || a.path || '', number: a.house_number || '' };
      })
      .catch(function () { return { street: '', number: '' }; });
  }

  T.map = {
    init: init,
    render: render,
    reverse: reverse,
    startPlacing: startPlacing,
    focus: function (h) {
      if (h.lat == null) return;
      map.setView([h.lat, h.lng], Math.max(map.getZoom(), 18));
    },
    refresh: function () { if (map) setTimeout(function () { map.invalidateSize(); }, 50); },
    stopAdd: function () { setAddMode(false); }
  };
})();
