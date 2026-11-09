/* Jeep Transfer: motor de cálculos (funções puras, valores em centavos) */
(function (root) {
  'use strict';
  var C = {};

  function pad(n) { return String(n).padStart(2, '0'); }

  C.brl = function (c) {
    if (c === null || c === undefined || isNaN(c)) return 'sem dados';
    var neg = c < 0;
    var v = Math.abs(Math.round(c));
    var reais = Math.floor(v / 100).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    var s = 'R$ ' + reais + ',' + pad(v % 100);
    return neg ? '-' + s : s;
  };

  C.dayKey = function (ts) {
    var d = new Date(ts);
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  };

  C.clock = function (ts) {
    var d = new Date(ts);
    return pad(d.getHours()) + ':' + pad(d.getMinutes());
  };

  C.hm = function (ms) {
    var m = Math.max(0, Math.floor(ms / 60000));
    return Math.floor(m / 60) + 'h' + pad(m % 60);
  };

  C.timer = function (ms) {
    var s = Math.max(0, Math.floor(ms / 1000));
    return pad(Math.floor(s / 3600)) + ':' + pad(Math.floor(s / 60) % 60) + ':' + pad(s % 60);
  };

  C.parseMoney = function (str) {
    if (str === null || str === undefined) return NaN;
    var s = String(str).trim().replace(/[R$\s]/g, '');
    if (!s) return NaN;
    if (s.indexOf(',') >= 0) s = s.replace(/\./g, '').replace(',', '.');
    var v = parseFloat(s);
    return isNaN(v) ? NaN : Math.round(v * 100);
  };

  C.parseKm = function (str) {
    var v = parseFloat(String(str || '').replace(',', '.'));
    return isNaN(v) ? NaN : v;
  };

  C.live = function (list) { return (list || []).filter(function (r) { return !r.del; }); };

  C.sessionWorkedMs = function (s, now) {
    if (!s || !s.start) return 0;
    var end = s.end || now;
    var paused = s.pausedMs || 0;
    if (s.status === 'pause' && s.pauseStart) paused += end - s.pauseStart;
    return Math.max(0, end - s.start - paused);
  };

  C.sessionPausedMs = function (s, now) {
    if (!s) return 0;
    var p = s.pausedMs || 0;
    if (s.status === 'pause' && s.pauseStart) p += (s.end || now) - s.pauseStart;
    return p;
  };

  C.sessionKm = function (s) {
    if (!s) return null;
    var a = s.odoStart;
    var b = (s.odoEnd !== null && s.odoEnd !== undefined) ? s.odoEnd : s.odoLast;
    if (typeof a !== 'number' || typeof b !== 'number' || b < a) return null;
    return b - a;
  };

  // custo de combustível em centavos por km
  C.costPerKm = function (cfg) {
    if (!cfg || !(cfg.fuelPrice > 0) || !(cfg.kmPerL > 0)) return null;
    return cfg.fuelPrice / cfg.kmPerL;
  };

  C.dayStats = function (db, day, now, cfg) {
    var trips = C.live(db.trips).filter(function (t) { return C.dayKey(t.ts) === day; });
    var exps = C.live(db.expenses).filter(function (x) { return C.dayKey(x.ts) === day; });
    var sess = C.live(db.sessions).filter(function (s) { return C.dayKey(s.start) === day; });

    var uber = 0, nn = 0, nUber = 0, nNn = 0;
    var rk = { all: [0, 0, 0], uber: [0, 0], nn: [0, 0] };
    trips.forEach(function (t) {
      if (t.p === 'uber') { uber += t.c; nUber++; } else { nn += t.c; nNn++; }
      if (t.k > 0) {
        rk.all[0] += t.c; rk.all[1] += t.k; rk.all[2]++;
        var b = t.p === 'uber' ? rk.uber : rk.nn;
        b[0] += t.c; b[1] += t.k;
      }
    });
    var fat = uber + nn;

    var km = null;
    sess.forEach(function (s) {
      var k = C.sessionKm(s);
      if (k !== null) km = (km || 0) + k;
    });

    var cpk = C.costPerKm(cfg);
    var fuel = (km !== null && cpk !== null) ? Math.round(km * cpk) : null;

    var desp = 0, fuelPaid = 0;
    exps.forEach(function (x) { if (x.cat === 'Etanol') fuelPaid += x.c; else desp += x.c; });

    var lucro = fat - (fuel || 0) - desp;

    var ms = 0;
    sess.forEach(function (s) { ms += C.sessionWorkedMs(s, now); });

    var lh = ms >= 15 * 60000 ? lucro / (ms / 3600000) : null;
    var lkm = km > 0 ? lucro / km : null;
    var perKm = function (a) { return a[1] > 0 ? a[0] / a[1] : null; };

    return {
      trips: trips, exps: exps, sess: sess,
      fat: fat, uber: uber, nn: nn, nUber: nUber, nNn: nNn, n: trips.length,
      km: km, cpk: cpk, fuel: fuel, fuelKnown: fuel !== null,
      desp: desp, fuelPaid: fuelPaid, lucro: lucro,
      ms: ms, lh: lh, lkm: lkm,
      rpkAll: perKm(rk.all), rpkUber: perKm(rk.uber), rpkNn: perKm(rk.nn), rpkN: rk.all[2],
      worked: trips.length > 0 || sess.length > 0
    };
  };

  C.goal = function (lucro, meta, lh) {
    var pct = meta > 0 ? lucro / meta : 0;
    var falta = Math.max(0, meta - lucro);
    var projMs = falta === 0 ? 0 : (lh !== null && lh > 0 ? falta / lh * 3600000 : null);
    return { pct: pct, falta: falta, projMs: projMs };
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = C;
  else root.JTCore = C;
})(this);
