/* ==========================================================================
   Monitor Shelly EM - Frontend (MorenoPerez)
   - Origen de datos: https://worker-monitor-shelly-aerotermia.borkosmoreno.workers.dev
   - Endpoints usados: /api/latest y /api/range?start=&end=&bucket=raw
   - Gráfico: Chart.js 4 + zoom + date-fns adapter
   - Requisitos: UTC por defecto, conmutador UTC/local, gaps >2min, stepped,
                 3 líneas (aero verde, resto azul, casa rojo), selector líneas,
                 tarjetas actual + estadísticas, CSV local, auto-refresco 60s incremental,
                 sin reload, mensajes de error con colores, sugerencia min 0.
   ========================================================================== */
(function () {
  'use strict';

  /* --------------------------------------------------------------------------
     Bloque 1: Constantes de configuración
     -------------------------------------------------------------------------- */
  const API_BASE = 'https://worker-monitor-shelly-aerotermia.borkosmoreno.workers.dev';
  const REFRESH_MS = 60 * 1000;          // Auto-refresco cada 60 s (requisito)
  const GAP_MS = 2 * 60 * 1000;          // Hueco >2 min => null en gráfica
  const STALE_WARN_S = 3 * 60;           // >3 min aviso amarillo
  const STALE_ERR_S = 15 * 60;           // >15 min error rojo
  const WINDOW_24H_MS = 24 * 60 * 60 * 1000;

  // Colores exigidos: Aerotermia verde, Resto azul, Casa rojo
  const COL = { aero: '#16a34a', resto: '#2563eb', casa: '#dc2626' };

  /* --------------------------------------------------------------------------
     Bloque 2: Estado interno de la aplicación
     -------------------------------------------------------------------------- */
  let registros = [];        // [{t,aeroW,casaW,aeroWh,casaWh,fecha}]
  let latestInfo = null;     // último dato global desde /api/latest
  let modoUTC = true;        // true=UTC, false=local
  let modoVivo = true;       // true=últimas 24h, false=día concreto UTC
  let fechaDia = null;       // 'YYYY-MM-DD' cuando no es vivo
  let chart = null;          // instancia Chart.js
  let zoomActivo = false;    // si el usuario ha hecho zoom/pan
  let tsRangeOk = null;      // Date.now() del último fetch range ok
  let cargando = false;
  let timerRefresh = null;   // interval 60s
  let timerTick = null;      // interval 1s para "hace X s"

  /* --------------------------------------------------------------------------
     Bloque 3: Formateadores numéricos y de fecha
     -------------------------------------------------------------------------- */
  const fmtW = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 0 });
  const fmtWdec = new Intl.NumberFormat('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const fmtKWh = new Intl.NumberFormat('es-ES', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
  const TZ_LOCAL = Intl.DateTimeFormat().resolvedOptions().timeZone || 'local';

  // Formatea una época (ms) según modo UTC/local con opciones Intl
  function fmtIntl(epochMs, opts) {
    if (!Number.isFinite(epochMs)) return '—';
    const o = Object.assign({}, opts);
    if (modoUTC) o.timeZone = 'UTC';
    return new Intl.DateTimeFormat('es-ES', o).format(new Date(epochMs));
  }

  // Hora corta HH:MM
  function fmtHora(epochMs) {
    return fmtIntl(epochMs, { hour: '2-digit', minute: '2-digit', hour12: false });
  }

  // Fecha + hora larga para tooltips y tarjetas
  function fmtFechaHora(epochMs) {
    const s = fmtIntl(epochMs, {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
    });
    return s + (modoUTC ? ' UTC' : ' (local)');
  }

  // Potencia en W con unidad
  function fmtPot(v) {
    if (!Number.isFinite(v)) return '—';
    return fmtW.format(v) + ' W';
  }

  /* --------------------------------------------------------------------------
     Bloque 4: Utilidades de fecha UTC (días)
     -------------------------------------------------------------------------- */
  function ymdUTC(epochMs) {
    const d = new Date(epochMs);
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(d.getUTCDate()).padStart(2, '0');
    return `${d.getUTCFullYear()}-${m}-${dd}`;
  }
  function sumarDias(ymd, n) {
    const p = ymd.split('-').map(Number);
    const base = Date.UTC(p[0], p[1] - 1, p[2]);
    return ymdUTC(base + n * 86400000);
  }
  function inicioDiaMs(ymd) {
    const p = ymd.split('-').map(Number);
    return Date.UTC(p[0], p[1] - 1, p[2], 0, 0, 0, 0);
  }
  function finDiaMs(ymd) {
    return inicioDiaMs(ymd) + 86400000 - 1;
  }

  /* --------------------------------------------------------------------------
     Bloque 5: Manejo de eje temporal para UTC/local
     Chart.js con date-fns adapter dibuja siempre en hora local del navegador.
     Para mostrar UTC desplazamos el valor X visualmente, conservando t real.
     -------------------------------------------------------------------------- */
  function toDisplayMs(rawMs) {
    if (!modoUTC) return rawMs;
    return rawMs + new Date(rawMs).getTimezoneOffset() * 60000;
  }
  function toRawMs(displayMs) {
    if (!modoUTC) return displayMs;
    return displayMs - new Date(displayMs).getTimezoneOffset() * 60000;
  }

  /* --------------------------------------------------------------------------
     Bloque 6: Acceso al Worker (fetch)
     -------------------------------------------------------------------------- */
  async function fetchJSON(url) {
    const r = await fetch(url, { headers: { Accept: 'application/json' } });
    let j = null;
    try { j = await r.json(); } catch (_) { j = null; }
    if (!r.ok || !j) {
      const msg = j && j.error ? j.error : `HTTP ${r.status}`;
      throw new Error(msg);
    }
    if (j.success === false) {
      throw new Error(j.error || 'Respuesta success=false');
    }
    return j;
  }

  function urlLatest() {
    return `${API_BASE}/api/latest`;
  }
  function urlRange(fromMs, toMs) {
    const u = new URL(`${API_BASE}/api/range`);
    u.searchParams.set('start', new Date(fromMs).toISOString());
    u.searchParams.set('end', new Date(toMs).toISOString());
    u.searchParams.set('bucket', 'raw'); // 1 punto/min hasta 48h
    return u.toString();
  }

  async function cargarLatest() {
    const j = await fetchJSON(urlLatest());
    // j.latest puede ser null si BBDD vacía
    return j.latest || null;
  }

  async function cargarRange(fromMs, toMs) {
    const j = await fetchJSON(urlRange(fromMs, toMs));
    // Normaliza y ordena por t
    const data = (j.data || [])
      .map(o => ({
        t: Number(o.t),
        aeroW: Number.isFinite(o.aeroW) ? o.aeroW : null,
        casaW: Number.isFinite(o.casaW) ? o.casaW : null,
        aeroWh: Number.isFinite(o.aeroWh) ? o.aeroWh : null,
        casaWh: Number.isFinite(o.casaWh) ? o.casaWh : null,
        fecha: o.fecha || null
      }))
      .filter(o => Number.isFinite(o.t))
      .sort((a, b) => a.t - b.t);
    return { data, meta: j };
  }

  /* --------------------------------------------------------------------------
     Bloque 7: Rango temporal actual según modo
     -------------------------------------------------------------------------- */
  function rangoActual() {
    if (modoVivo) {
      const ahora = Date.now();
      return { desde: ahora - WINDOW_24H_MS, hasta: ahora };
    }
    return { desde: inicioDiaMs(fechaDia), hasta: finDiaMs(fechaDia) };
  }

  /* --------------------------------------------------------------------------
     Bloque 8: Gestión de estados visuales y avisos
     -------------------------------------------------------------------------- */
  function el(id) { return document.getElementById(id); }

  function mostrarAviso(tipo, texto) {
    const n = el('mon-aviso');
    if (!n) return;
    n.hidden = false;
    n.className = `mon-estado mon-estado--${tipo}`;
    n.textContent = texto;
  }
  function ocultarAviso() {
    const n = el('mon-aviso');
    if (n) n.hidden = true;
  }
  function pintarMetaPeriodo() {
    const r = rangoActual();
    const e = el('mon-periodo');
    if (!e) return;
    if (modoVivo) {
      e.textContent = `Mostrando: últimas 24 h (${fmtHora(r.desde)} → ${fmtHora(r.hasta)} ${modoUTC ? 'UTC' : 'local'})`;
    } else {
      e.textContent = `Mostrando: día ${fechaDia} completo en UTC (eje en ${modoUTC ? 'UTC' : 'local'})`;
    }
  }
  function pintarTickActualizado() {
    const e = el('mon-actualizado');
    if (!e) return;
    if (tsRangeOk === null) {
      e.textContent = 'Sin actualizar todavía';
      return;
    }
    const s = Math.max(0, Math.round((Date.now() - tsRangeOk) / 1000));
    if (s < 60) e.textContent = `Actualizado hace ${s} s`;
    else e.textContent = `Actualizado hace ${Math.floor(s / 60)} min ${s % 60} s`;
  }

  function pintarEstadoShelly() {
    const caja = el('mon-estado-shelly');
    if (!caja) return;
    if (!latestInfo || !Number.isFinite(latestInfo.timestamp)) {
      caja.hidden = true;
      return;
    }
    caja.hidden = false;
    const t = Number(latestInfo.timestamp);
    const ageS = Number.isFinite(latestInfo.ageSeconds) ? latestInfo.ageSeconds : Math.round((Date.now() - t) / 1000);
    const min = Math.floor(ageS / 60);
    caja.classList.remove('mon-estado--ok', 'mon-estado--aviso', 'mon-estado--error', 'mon-estado--info');

    if (ageS <= STALE_WARN_S) {
      caja.className = 'mon-estado mon-estado--ok';
      caja.textContent = `Shelly enviando con normalidad. Última lectura: ${fmtHora(t)} ${modoUTC ? 'UTC' : 'local'}.`;
    } else if (ageS <= STALE_ERR_S) {
      caja.className = 'mon-estado mon-estado--aviso';
      caja.textContent = `Sin datos nuevos desde hace ${min} min (última lectura: ${fmtHora(t)} ${modoUTC ? 'UTC' : ''}).`;
    } else {
      caja.className = 'mon-estado mon-estado--error';
      caja.textContent = `El Shelly lleva ${min} minutos sin enviar datos (última lectura: ${fmtHora(t)} ${modoUTC ? 'UTC' : ''}).`;
    }
  }

  function gestionarErrorCarga(err) {
    const m = err && err.message ? err.message : String(err);
    if (/failed to fetch|networkerror|load failed/i.test(m)) {
      mostrarAviso('error', 'El Worker no responde. Comprueba tu conexión o el estado del Worker en Cloudflare.');
    } else if (/Origen no permitido/i.test(m)) {
      mostrarAviso('error', 'El Worker no responde (CORS). Si estás en localhost, abre el fichero generado en _site directamente o añade localhost a ALLOWED_ORIGINS para pruebas.');
    } else {
      mostrarAviso('error', `Error al obtener datos: ${m}`);
    }
  }

  /* --------------------------------------------------------------------------
     Bloque 9: Construcción de series para Chart.js con gestión de huecos
     No alteramos registros originales. Solo generamos arrays con {x,y,t}
     e inyectamos puntos null si el salto > GAP_MS.
     -------------------------------------------------------------------------- */
  function construirSeriesParaGrafico() {
    const aero = [], resto = [], casa = [];
    let prevT = null;

    for (const r of registros) {
      if (prevT !== null && (r.t - prevT) > GAP_MS) {
        // Hueco limpio: punto null 1 min después del último dato válido
        const xGap = toDisplayMs(prevT + 60000);
        aero.push({ x: xGap, y: null });
        resto.push({ x: xGap, y: null });
        casa.push({ x: xGap, y: null });
      }
      const x = toDisplayMs(r.t);
      const a = Number.isFinite(r.aeroW) ? r.aeroW : null;
      const c = Number.isFinite(r.casaW) ? r.casaW : null;
      const d = (a === null || c === null) ? null : (c - a); // puede ser negativo

      aero.push({ x, y: a, t: r.t });
      casa.push({ x, y: c, t: r.t });
      resto.push({ x, y: d, t: r.t });
      prevT = r.t;
    }
    return { aero, resto, casa };
  }

  /* --------------------------------------------------------------------------
     Bloque 10: Cálculo de estadísticas del periodo visible
     - min/max con timestamp, media, energía kWh = último - primero
     -------------------------------------------------------------------------- */
  function calcResumen(getVal) {
    let n = 0, sum = 0, mn = Infinity, mnT = null, mx = -Infinity, mxT = null;
    for (const r of registros) {
      const v = getVal(r);
      if (!Number.isFinite(v)) continue;
      n++; sum += v;
      if (v < mn) { mn = v; mnT = r.t; }
      if (v > mx) { mx = v; mxT = r.t; }
    }
    if (n === 0) return null;
    return { n, media: sum / n, min: mn, minT: mnT, max: mx, maxT: mxT };
  }
  function calcEnergia(campoWh) {
    let primero = null, ultimo = null;
    for (const r of registros) {
      const v = r[campoWh];
      if (!Number.isFinite(v)) continue;
      if (primero === null) primero = v;
      ultimo = v;
    }
    if (primero === null || ultimo === null) return null;
    return (ultimo - primero) / 1000; // kWh
  }
  function celdaExtremo(val, t) {
    if (!Number.isFinite(val)) return '—';
    return `${fmtW.format(val)} W<span class="mon-sub">${fmtHora(t)}</span>`;
  }
  function celdaKWh(v, fiable) {
    if (v === null || !Number.isFinite(v)) return '—';
    const txt = `${fmtKWh.format(v)} kWh`;
    if (!fiable) return `<span class="mon-nofiable">${txt}<span class="mon-sub">no fiable</span></span>`;
    return txt;
  }

  function pintarTarjetaActual() {
    if (!latestInfo) {
      el('mon-act-aero').textContent = '—';
      el('mon-act-resto').textContent = '—';
      el('mon-act-casa').textContent = '—';
      el('mon-act-fecha').textContent = '—';
      return;
    }
    const a = latestInfo.aerotermiaW;
    const c = latestInfo.casaTotalW;
    const d = (Number.isFinite(a) && Number.isFinite(c)) ? (c - a) : null;

    el('mon-act-aero').textContent = fmtPot(a);
    el('mon-act-casa').textContent = fmtPot(c);
    el('mon-act-resto').textContent = fmtPot(d);
    el('mon-act-fecha').textContent = fmtFechaHora(Number(latestInfo.timestamp));
  }

  function pintarEstadisticas() {
    // Resúmenes de potencia instantánea
    const rA = calcResumen(r => r.aeroW);
    const rC = calcResumen(r => r.casaW);
    const rR = calcResumen(r => (Number.isFinite(r.casaW) && Number.isFinite(r.aeroW)) ? (r.casaW - r.aeroW) : NaN);

    // Energía acumulada
    const kA = calcEnergia('aeroWh');
    const kC = calcEnergia('casaWh');
    const kR = (kA === null || kC === null) ? null : (kC - kA);

    const fiableA = kA === null || kA >= 0;
    const fiableC = kC === null || kC >= 0;
    const fiableR = fiableA && fiableC;

    const filas = [
      ['aero', rA, kA, fiableA],
      ['resto', rR, kR, fiableR],
      ['casa', rC, kC, fiableC]
    ];
    for (const [id, res, kwh, fiable] of filas) {
      const minEl = el(`mon-st-${id}-min`);
      const maxEl = el(`mon-st-${id}-max`);
      const medEl = el(`mon-st-${id}-med`);
      const kwhEl = el(`mon-st-${id}-kwh`);
      if (!minEl) continue;
      minEl.innerHTML = res ? celdaExtremo(res.min, res.minT) : '—';
      maxEl.innerHTML = res ? celdaExtremo(res.max, res.maxT) : '—';
      medEl.textContent = res ? `${fmtW.format(res.media)} W` : '—';
      kwhEl.innerHTML = celdaKWh(kwh, fiable);
    }

    const nota = el('mon-nota-energia');
    if (nota) {
      if (!fiableA || !fiableC) {
        nota.innerHTML = 'Energía = contador Wh acumulado del Shelly (último − primero). <strong class="mon-nofiable">Negativo detectado: posible reinicio de contador.</strong>';
      } else {
        nota.textContent = 'Energía = contador Wh acumulado del Shelly (último − primero del periodo).';
      }
    }
  }

  /* --------------------------------------------------------------------------
     Bloque 11: Gráfico Chart.js
     -------------------------------------------------------------------------- */
  function datasetBase(label, color) {
    return {
      label,
      data: [],
      borderColor: color,
      backgroundColor: color,
      borderWidth: 1.6,
      stepped: true,          // muestreo por minuto escalonado
      pointRadius: 0,         // sin marcadores
      pointHoverRadius: 3,
      pointHitRadius: 10,
      spanGaps: false,        // respeta null => hueco visible
      tension: 0
    };
  }

  function crearGrafico() {
    if (typeof Chart === 'undefined') {
      mostrarAviso('error', 'No se pudo cargar Chart.js desde CDN.');
      return;
    }
    // Registra plugin zoom si no está auto-registrado
    if (window.ChartZoom) {
      try { Chart.register(window.ChartZoom); } catch (_) {}
    }

    const ctx = el('mon-grafico').getContext('2d');
    chart = new Chart(ctx, {
      type: 'line',
      data: {
        datasets: [
          datasetBase('Aerotermia (W)', COL.aero),
          datasetBase('Resto vivienda (W)', COL.resto),
          datasetBase('Casa total (W)', COL.casa)
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        interaction: { mode: 'index', intersect: false },
        scales: {
          x: {
            type: 'time',
            time: { displayFormats: { minute: 'HH:mm', hour: 'HH:mm', day: 'dd/MM' } },
            title: { display: true, text: 'Hora UTC' },
            ticks: { autoSkip: true, maxRotation: 0, maxTicksLimit: 12 },
            grid: { color: 'rgba(0,0,0,0.05)' }
          },
          y: {
            suggestedMin: 0, // Requisito: mínimo 0 automático pero permite negativos
            title: { display: true, text: 'Potencia (W)' },
            ticks: { callback: v => fmtW.format(v) },
            grid: { color: 'rgba(0,0,0,0.05)' }
          }
        },
        plugins: {
          legend: { position: 'bottom', labels: { usePointStyle: true, boxWidth: 8 } },
          tooltip: {
            callbacks: {
              title: items => {
                if (!items.length) return '';
                const t = items[0].raw && items[0].raw.t;
                return Number.isFinite(t) ? fmtFechaHora(t) : '';
              },
              label: item => {
                const v = item.parsed.y;
                return `${item.dataset.label}: ${v === null ? 'sin dato' : fmtWdec.format(v) + ' W'}`;
              }
            }
          },
          zoom: {
            limits: { x: { min: 'original', max: 'original' } },
            pan: { enabled: true, mode: 'x', onPanComplete: () => { zoomActivo = true; } },
            zoom: {
              wheel: { enabled: true },
              pinch: { enabled: true },
              mode: 'x',
              onZoomComplete: () => { zoomActivo = true; }
            }
          }
        }
      }
    });
  }

  function reconstruirVista() {
    if (chart) {
      const s = construirSeriesParaGrafico();
      chart.data.datasets[0].data = s.aero;
      chart.data.datasets[1].data = s.resto;
      chart.data.datasets[2].data = s.casa;
      chart.options.scales.x.title.text = modoUTC ? 'Hora UTC' : `Hora local (${TZ_LOCAL})`;
      chart.update('none');
    }
    pintarTarjetaActual();
    pintarEstadisticas();
    pintarEstadoShelly();
    pintarMetaPeriodo();
    pintarTickActualizado();
    aplicarVisibilidadLineas();
  }

  /* --------------------------------------------------------------------------
     Bloque 12: Visibilidad de líneas (selector usuario)
     -------------------------------------------------------------------------- */
  function aplicarVisibilidadLineas() {
    if (!chart) return;
    const map = [
      { chk: 'chk-aero', idx: 0 },
      { chk: 'chk-resto', idx: 1 },
      { chk: 'chk-casa', idx: 2 }
    ];
    for (const m of map) {
      const cb = el(m.chk);
      if (!cb) continue;
      const visible = cb.checked;
      chart.setDatasetVisibility(m.idx, visible);
    }
    chart.update('none');
  }

  /* --------------------------------------------------------------------------
     Bloque 13: Exportación CSV local con ; y coma decimal
     -------------------------------------------------------------------------- */
  function exportarCSV() {
    if (registros.length === 0) {
      mostrarAviso('aviso', 'No hay datos para este periodo.');
      return;
    }
    const fmtDec = (v, d) => Number.isFinite(v) ? v.toFixed(d).replace('.', ',') : '';
    const lineas = [];
    lineas.push('epoch_ms;fecha_hora_utc;fecha_hora_local;aerotermia_w;resto_vivienda_w;casa_total_w;aerotermia_wh_acum;casa_total_wh_acum');

    for (const r of registros) {
      const d = new Date(r.t);
      const local = new Intl.DateTimeFormat('es-ES', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
      }).format(d);
      const resto = (Number.isFinite(r.casaW) && Number.isFinite(r.aeroW)) ? (r.casaW - r.aeroW) : NaN;
      lineas.push([
        r.t,
        d.toISOString(),
        local,
        fmtDec(r.aeroW, 2),
        fmtDec(resto, 2),
        fmtDec(r.casaW, 2),
        fmtDec(r.aeroWh, 2),
        fmtDec(r.casaWh, 2)
      ].join(';'));
    }

    const nombre = `shelly-em-${modoVivo ? 'ultimas24h-' + ymdUTC(Date.now()) : fechaDia}.csv`;
    const blob = new Blob(['\uFEFF' + lineas.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = nombre;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
  }

  /* --------------------------------------------------------------------------
     Bloque 14: Carga completa de datos (24h o día)
     -------------------------------------------------------------------------- */
  async function cargarCompleto() {
    if (cargando) return;
    cargando = true;
    mostrarAviso('info', 'Cargando datos…');

    const r = rangoActual();

    try {
      // Dos llamadas independientes pero en paralelo para velocidad
      const [latest, range] = await Promise.all([cargarLatest(), cargarRange(r.desde, r.hasta)]);

      latestInfo = latest;
      registros = range.data;
      tsRangeOk = Date.now();
      zoomActivo = false;
      if (chart) chart.resetZoom('none');

      reconstruirVista();

      if (registros.length === 0) {
        mostrarAviso('aviso', 'No hay datos para este periodo.');
      } else {
        ocultarAviso();
      }
    } catch (err) {
      gestionarErrorCarga(err);
    } finally {
      cargando = false;
    }
  }

  /* --------------------------------------------------------------------------
     Bloque 15: Carga incremental (solo datos nuevos)
     Usado por auto-refresco cada 60 s en modo vivo.
     -------------------------------------------------------------------------- */
  async function cargarIncremental() {
    if (cargando || !modoVivo) return;
    if (registros.length === 0) { return cargarCompleto(); }

    const ultimoT = registros[registros.length - 1].t;
    const desde = ultimoT + 1;
    const hasta = Date.now();
    if (hasta <= desde) { pintarEstadoShelly(); return; }

    cargando = true;
    try {
      const [latest, range] = await Promise.all([cargarLatest(), cargarRange(desde, hasta)]);
      latestInfo = latest;
      if (range.data.length > 0) {
        registros = registros.concat(range.data);
        // Poda para mantener ventana 24h móvil
        const corte = Date.now() - WINDOW_24H_MS;
        registros = registros.filter(x => x.t >= corte);
      }
      tsRangeOk = Date.now();
      reconstruirVista();
      ocultarAviso();
    } catch (err) {
      gestionarErrorCarga(err);
    } finally {
      cargando = false;
    }
  }

  /* --------------------------------------------------------------------------
     Bloque 16: Controles de la UI
     -------------------------------------------------------------------------- */
  function activarBoton(idActivo, ids) {
    for (const id of ids) {
      const b = el(id);
      if (!b) continue;
      b.classList.toggle('mon-btn--activo', id === idActivo);
    }
  }

  function cambiarZona(nuevoUTC) {
    if (nuevoUTC === modoUTC) return;

    // Intenta conservar el rango visible haciendo zoom converso
    let rangoRaw = null;
    if (chart && zoomActivo) {
      const esc = chart.scales.x;
      if (esc && Number.isFinite(esc.min) && Number.isFinite(esc.max)) {
        rangoRaw = { min: toRawMs(esc.min), max: toRawMs(esc.max) };
      }
    }

    modoUTC = nuevoUTC;
    activarBoton(modoUTC ? 'btn-utc' : 'btn-local', ['btn-utc', 'btn-local']);
    reconstruirVista();

    if (rangoRaw && chart && typeof chart.zoomScale === 'function') {
      chart.zoomScale('x', { min: toDisplayMs(rangoRaw.min), max: toDisplayMs(rangoRaw.max) }, 'none');
    }
  }

  function irVivo() {
    modoVivo = true;
    fechaDia = ymdUTC(Date.now());
    const inp = el('inp-fecha');
    if (inp) inp.value = fechaDia;
    el('btn-vivo')?.classList.add('mon-btn--activo');
    actualizarBotonesDia();
    programarRefresh();
    cargarCompleto();
  }

  function irDia(ymd) {
    modoVivo = false;
    fechaDia = ymd;
    const inp = el('inp-fecha');
    if (inp) inp.value = ymd;
    el('btn-vivo')?.classList.remove('mon-btn--activo');
    actualizarBotonesDia();
    programarRefresh();
    cargarCompleto();
  }

  function actualizarBotonesDia() {
    const hoy = ymdUTC(Date.now());
    const btnSig = el('btn-dia-sig');
    const inp = el('inp-fecha');
    if (inp) inp.max = hoy;
    if (btnSig) btnSig.disabled = (!modoVivo && fechaDia >= hoy) || modoVivo;
  }

  function programarRefresh() {
    if (timerRefresh) { clearInterval(timerRefresh); timerRefresh = null; }
    if (modoVivo) {
      timerRefresh = setInterval(cargarIncremental, REFRESH_MS);
    }
  }

  function enlazarControles() {
    el('btn-vivo')?.addEventListener('click', irVivo);
    el('btn-dia-ant')?.addEventListener('click', () => {
      const base = fechaDia || ymdUTC(Date.now());
      irDia(sumarDias(base, -1));
    });
    el('btn-dia-sig')?.addEventListener('click', () => {
      if (!fechaDia) return;
      const hoy = ymdUTC(Date.now());
      const sig = sumarDias(fechaDia, 1);
      if (sig > hoy) return;
      irDia(sig);
    });
    el('inp-fecha')?.addEventListener('change', e => {
      if (e.target.value) irDia(e.target.value);
    });
    el('btn-utc')?.addEventListener('click', () => cambiarZona(true));
    el('btn-local')?.addEventListener('click', () => cambiarZona(false));
    el('btn-actualizar')?.addEventListener('click', () => {
      if (modoVivo) cargarIncremental(); else cargarCompleto();
    });
    el('btn-zoom-reset')?.addEventListener('click', () => {
      if (chart) { chart.resetZoom(); zoomActivo = false; }
    });
    el('btn-csv')?.addEventListener('click', exportarCSV);

    // Selector de líneas
    ['chk-aero', 'chk-resto', 'chk-casa'].forEach(id => {
      el(id)?.addEventListener('change', aplicarVisibilidadLineas);
    });

    // Al volver a la pestaña, refresco inmediato si estamos en vivo
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && modoVivo) cargarIncremental();
    });
  }

  /* --------------------------------------------------------------------------
     Bloque 17: Inicialización
     -------------------------------------------------------------------------- */
  function iniciar() {
    fechaDia = ymdUTC(Date.now());
    const inp = el('inp-fecha');
    if (inp) inp.value = fechaDia;

    enlazarControles();
    actualizarBotonesDia();
    crearGrafico();

    // Tick cada segundo para contadores y estado shelly
    if (timerTick) clearInterval(timerTick);
    timerTick = setInterval(() => {
      pintarTickActualizado();
      pintarEstadoShelly();
    }, 1000);

    programarRefresh();
    cargarCompleto();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciar);
  } else {
    iniciar();
  }
})();