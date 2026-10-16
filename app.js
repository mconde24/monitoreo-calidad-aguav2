"use strict";
const station = window.AQUATRACE_STATION;
const CHANNEL_ID = station.channelId;
const API_URL = `https://api.thingspeak.com/channels/${CHANNEL_ID}/feeds.json`;
const REFRESH_MS = 30000;
const STALE_AFTER_MS = station.staleAfterMinutes * 60000;
const TIME_ZONE = "America/Bogota";
const $ = selector => document.querySelector(selector);
const rangeSelect = $("#wd-range");
const refreshButton = $("#wd-refresh");
const gaugeRoot = $("#wd-gauges");
const chartRoot = $("#wd-charts");
let histories = [];
let currentHistories = [];
let gauges = [];
let charts = [];
let loadedWindow = null;
let selectedSegment = null;
let statistics = [];
let loadingCurrent = false;
let loadingHistory = false;
let historyRequested = false;
let historyTruncated = false;
let generation = 0;
const variables = [
  {
    name: "pH",
    unit: "pH",
    field: "field1",
    color: "#ed8b37",
    min: 0,
    max: 14
  },
  {
    name: "Conductividad",
    unit: "µS/cm",
    field: "field2",
    color: "#9462bc",
    min: 0,
    max: 60000
  },
  {
    name: "Oxígeno disuelto",
    unit: "mg/L",
    field: "field3",
    color: "#3989ce",
    min: 0,
    max: 20
  },
  {
    name: "Temperatura",
    unit: "°C",
    field: "field4",
    color: "#009b91",
    min: 0,
    max: 50
  },
  {
    name: "Sólidos disueltos",
    unit: "ppm",
    field: "field5",
    color: "#1766bc",
    min: 0,
    max: 50000
  },
  {
    name: "Salinidad",
    unit: "ppt",
    field: "field6",
    color: "#26966e",
    min: 0,
    max: 50
  },
  {
    name: "Gravedad específica",
    unit: "adimensional",
    field: "field7",
    color: "#00a0ae",
    min: 0,
    max: 2,
    decimals: 4
  },
  {
    name: "Saturación",
    unit: "%",
    field: "field8",
    color: "#345579",
    min: 0,
    max: 150
  }
];

function formatNumber(value, digits = 2) {
  return new Intl.NumberFormat("es-CO", {
    maximumFractionDigits: digits
  }).format(value);
}

function formatDate(timestamp) {
  return new Intl.DateTimeFormat("es-CO", {
    timeZone: TIME_ZONE,
    dateStyle: "medium",
    timeStyle: "medium",
    hour12: false
  }).format(new Date(timestamp));
}

function formatTime(timestamp) {
  return new Intl.DateTimeFormat("es-CO", {
    timeZone: TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(new Date(timestamp));
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function createGauge(variable, index) {
  const card = document.createElement("article");
  card.className = "gauge-card";
  card.style.setProperty("--variable-color", variable.color);

  card.innerHTML = `
    <h3>${escapeHTML(variable.name)}</h3>
    <div class="gauge-dial"><canvas
      class="gauge-canvas"
      role="img"
      aria-label="Medidor de ${escapeHTML(variable.name)}"
    ></canvas>
    <div class="gauge-value">--</div>
    <div class="gauge-unit">${escapeHTML(variable.unit)}</div></div>
    <p class="gauge-reference"></p>
    <p class="gauge-quality" role="status">Esperando lectura</p>
    <div class="gauge-time">Sin lecturas</div>
  `;

  gaugeRoot.appendChild(card);

  return {
    card,
    canvas: card.querySelector("canvas"),
    value: card.querySelector(".gauge-value"),
    time: card.querySelector(".gauge-time"),
    reference: card.querySelector(".gauge-reference"),
    quality: card.querySelector(".gauge-quality"),
    variable,
    index
  };
}

function createChart(variable, index) {
  const card = document.createElement("article");
  card.className = "chart-card";
  card.style.setProperty("--variable-color", variable.color);

  card.innerHTML = `
    <h3 class="chart-title">${escapeHTML(variable.name)}</h3>
    <p class="chart-subtitle">
      ${escapeHTML(variable.unit)} · Lecturas individuales
    </p>
    <form class="axis-controls" aria-label="Escala vertical de ${escapeHTML(variable.name)}">
      <div class="control"><label for="y-mode-${index}">Escala vertical</label><select id="y-mode-${index}" class="y-mode"><option value="auto">Automática</option><option value="manual">Manual</option></select></div>
      <div class="y-manual" hidden><div class="control"><label for="y-min-${index}">Mínimo</label><input id="y-min-${index}" class="y-min" type="number" step="any" value="${variable.min}" required></div><div class="control"><label for="y-max-${index}">Máximo</label><input id="y-max-${index}" class="y-max" type="number" step="any" value="${variable.max}" required></div><button class="button" type="submit">Aplicar</button></div>
    </form><p class="axis-message" role="status" aria-live="polite"></p>
    <div class="chart-wrap">
      <canvas
        role="img"
        aria-label="Historial de ${escapeHTML(variable.name)}"
      ></canvas>
    </div>
    <p class="chart-empty" hidden>Sin mediciones en el periodo seleccionado.</p>
  `;

  chartRoot.appendChild(card);

  const canvas = card.querySelector("canvas");

  const chart = new Chart(canvas, {
    plugins: [segmentOverlay],
    type: "line",

    data: {
      datasets: [{
        label: `${variable.name} (${variable.unit})`,
        data: [],
        borderColor: variable.color,
        backgroundColor: variable.color + "0D",
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 5,
        pointHoverBackgroundColor: variable.color,
        fill: true,
        tension: 0,
        spanGaps: false
      }]
    },

    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      normalized: true,

      interaction: {
        mode: "nearest",
        intersect: false
      },

      plugins: {
        legend: {
          display: false
        },

        tooltip: {
          enabled: true,
          displayColors: false,
          titleFont: {size: 15},
          bodyFont: {size: 15},
          padding: 12,

          callbacks: {
            title(items) {
              if (!items.length) return "";

              return formatDate(items[0].parsed.x);
            },

            label(context) {
              return `${variable.name}: ${
                formatNumber(context.parsed.y, variable.decimals ?? 2)
              } ${variable.unit}`;
            }
          }
        }
      },

      scales: {
        x: {
          type: "linear",

          title: {
            display: true,
            text: "Hora (Colombia)"
          },

          ticks: {
            maxTicksLimit: 6,

            callback(value) {
              if (loadedWindow && loadedWindow.end - loadedWindow.start > 86400000) {
                return new Intl.DateTimeFormat("es-CO", {
                  timeZone: TIME_ZONE, day: "2-digit", month: "short",
                  hour: "2-digit", minute: "2-digit", hour12: false
                }).format(new Date(Number(value)));
              }
              return formatTime(Number(value));
            }
          },

          grid: {
            color: "#edf2f7"
          }
        },

        y: {
          title: {
            display: true,
            text: variable.unit
          },

          ticks: {
            maxTicksLimit: 6,

            callback(value) {
              return formatNumber(value);
            }
          },

          grid: {
            color: "#edf2f7"
          }
        }
      }
    }
  });

  return {
    chart,
    canvas,
    controls: card.querySelector(".axis-controls"),
    yMode: card.querySelector(".y-mode"),
    yManual: card.querySelector(".y-manual"),
    yMin: card.querySelector(".y-min"),
    yMax: card.querySelector(".y-max"),
    axisMessage: card.querySelector(".axis-message"),
    empty: card.querySelector(".chart-empty"),
    variable,
    index
  };
}

// Las referencias ecológicas son independientes de las escalas del instrumento.
function referenceFor(variable) {
  const profile = $("#water-profile").value;
  if (variable.field === "field1" && profile !== "unset") {
    const upper = profile === "marine" ? 8.5 : 9;
    return {text: `Referencia: 6,5–${formatNumber(upper)} pH`, kind: "ph", low: 6.5, high: upper,
      bands: [{min: variable.min, max: 6.5, color: "#b77916"},
        {min: 6.5, max: upper, color: "#218355"},
        {min: upper, max: variable.max, color: "#b77916"}]};
  }
  if (variable.field === "field3" && profile === "freshwater") {
    return {text: "Referencia: ≥5 mg/L · Lagos de agua dulce", kind: "oxygen",
      bands: [{min: 0, max: 3, color: "#bd4045"}, {min: 3, max: 5, color: "#b77916"},
        {min: 5, max: variable.max, color: "#218355"}]};
  }
  const notes = {
    field1: "Selecciona un perfil para consultar la referencia",
    field2: "Referencia: línea base de conductividad del sitio",
    field3: "Referencia: criterio local de oxígeno y organismos",
    field4: "Referencia: régimen térmico y especies locales",
    field5: "Referencia: mineralización natural del cuerpo de agua",
    field6: "Referencia: salinidad natural y tipo de ecosistema",
    field7: "Referencia: temperatura y salinidad del agua",
    field8: "Referencia: temperatura, presión y salinidad"
  };
  return {text: notes[variable.field], kind: "context", bands: []};
}
function evaluateReading(variable, value, stale) {
  const ref = referenceFor(variable);
  if (!Number.isFinite(value)) return {state: "neutral", text: "Sin dato para evaluar"};
  if (stale) return {state: "neutral", text: "Dato antiguo · Revisar fecha"};
  if (value < variable.min || value > variable.max) return {state: "review", text: "Fuera de escala · Revisar lectura"};
  if (ref.kind === "ph") return value >= ref.low && value <= ref.high
    ? {state: "good", text: "Dentro de referencia"} : {state: "review", text: "Fuera de referencia"};
  if (ref.kind === "oxygen") {
    if (value <= 3) return {state: "low", text: "Oxígeno bajo · ≤3 mg/L"};
    if (value < 5) return {state: "review", text: "Oxígeno moderado · <5 mg/L"};
    return {state: "good", text: "Referencia ≥5 mg/L satisfecha"};
  }
  return {state: "neutral", text: "Requiere referencia local"};
}
function drawGauge(gauge, latest) {
  const canvas = gauge.canvas;
  const width = canvas.clientWidth || 220;
  const height = 176;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(width * dpr);canvas.height = Math.round(height * dpr);
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);ctx.clearRect(0, 0, width, height);
  const {variable} = gauge;
  const cx = width / 2, cy = 128;
  const radius = Math.min(width * 0.34, 89);
  const fraction = value => Math.max(0, Math.min(1, (value - variable.min) / (variable.max - variable.min)));
  const angle = value => Math.PI + Math.PI * fraction(value);
  ctx.lineWidth = 5;ctx.lineCap = "butt";
  referenceFor(variable).bands.forEach(band => {
    ctx.beginPath();ctx.arc(cx, cy, radius + 12, angle(band.min), angle(band.max));ctx.strokeStyle = band.color;ctx.stroke();
  });
  ctx.lineWidth = 9;ctx.lineCap = "round";
  ctx.beginPath();ctx.arc(cx, cy, radius, Math.PI, 2 * Math.PI);ctx.strokeStyle = "#e5ecef";ctx.stroke();
  if (Number.isFinite(latest) && fraction(latest) > 0) {
    ctx.beginPath();ctx.arc(cx, cy, radius, Math.PI, angle(latest));ctx.strokeStyle = variable.color;ctx.stroke();
  }
  ctx.font = "14px system-ui, sans-serif";ctx.fillStyle = "#465d68";ctx.textAlign = "center";
  ctx.fillText(formatNumber(variable.min), cx - radius, cy + 29);ctx.fillText(formatNumber(variable.max), cx + radius, cy + 29);
  const reference = referenceFor(variable).text;
  canvas.setAttribute("aria-label", `${variable.name}: ${Number.isFinite(latest) ? formatNumber(latest, variable.decimals ?? 2) + " " + variable.unit : "sin datos"}. Escala ${variable.min} a ${variable.max}. ${reference}.`);
}

// Todas las fechas de entrada se interpretan explícitamente en Colombia (UTC−5),
// independientemente de la zona horaria del navegador.
function inputDate(time) {
  return new Date(time - 5 * 3600000).toISOString().slice(0, 19);
}
function parseInput(value) {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(value)
    ? Date.parse(`${value}-05:00`) : NaN;
}
function parseFeeds(feeds, start = -Infinity, end = Infinity) {
  return variables.map(variable => feeds.map(feed => {
    const time = Date.parse(feed.created_at);
    const raw = feed[variable.field];
    if (raw == null || String(raw).trim() === "") return null;
    const value = Number(raw);
    return Number.isFinite(time) && Number.isFinite(value) && time >= start && time <= end
      ? {time, value} : null;
  }).filter(Boolean).sort((a, b) => a.time - b.time));
}
async function readSource(params) {
  // Sólo lectura de un canal público: no se utilizan claves de API.
  const response = await fetch(`${API_URL}?${new URLSearchParams(params)}`, {
    signal: AbortSignal.timeout(20000), cache: "no-store"
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const data = await response.json();
  if (!data || !Array.isArray(data.feeds)) throw new Error("Respuesta no válida del canal público");
  return data.feeds;
}
function showMessage(id, text, state = "") {
  const box = $(id);
  box.textContent = text;
  box.className = `status ${state}`;
}
function drawCurrent() {
  gauges.forEach(gauge => {
    const latest = currentHistories[gauge.index]?.at(-1);
    const stale = latest && Date.now() - latest.time > STALE_AFTER_MS;
    const outside = latest && (latest.value < gauge.variable.min || latest.value > gauge.variable.max);
    gauge.value.textContent = latest ? formatNumber(latest.value, gauge.variable.decimals ?? 2) : "—";
    gauge.time.textContent = latest
      ? `${formatDate(latest.time)}${stale ? " · Dato antiguo" : ""}${outside ? " · Fuera de escala" : ""}`
      : "Sin dato en los últimos 100 registros";
    gauge.card.classList.toggle("is-stale", Boolean(stale));
    gauge.reference.textContent = referenceFor(gauge.variable).text;
    const assessment = evaluateReading(gauge.variable, latest?.value ?? NaN, stale);
    gauge.quality.textContent = assessment.text;
    gauge.quality.className = `gauge-quality ${assessment.state}`;
    drawGauge(gauge, latest?.value ?? NaN);
  });
}
async function refreshCurrent() {
  if (loadingCurrent) return;
  loadingCurrent = true;
  refreshButton.disabled = true;
  try {
    const feeds = await readSource({results: "100"});
    currentHistories = parseFeeds(feeds, -Infinity, Date.now());
    drawCurrent();
    const times = currentHistories.flatMap(points => points.length ? [points.at(-1).time] : []);
    const latest = times.length ? Math.max(...times) : null;
    const stale = latest === null || Date.now() - latest > STALE_AFTER_MS;
    $("#connection-dot").className = `dot ${stale ? "stale" : "online"}`;
    $("#connection-label").textContent = latest === null ? "Fuente disponible · Sin lecturas" : stale ? "Fuente disponible · Lecturas antiguas" : "Fuente disponible · Datos recientes";
    // La fecha individual sólo se muestra en cada medidor; no se repite arriba.
    showMessage("#wd-status", latest === null ? "No hay valores válidos en los últimos 100 registros." : "", latest === null ? "warning" : "");
    $("#last-update").textContent = `Última consulta de estación: ${formatDate(Date.now())}`;
  } catch (error) {
    drawCurrent();
    $("#connection-dot").className = "dot offline";
    $("#connection-label").textContent = "No se pudo consultar la estación";
    showMessage("#wd-status", `Consulta fallida (${error.message}). Se conservan las últimas lecturas recibidas; revisa sus fechas.`, "error");
  } finally {
    loadingCurrent = false;
    refreshButton.disabled = false;
  }
}
function queryWindow() {
  if (rangeSelect.value === "custom") {
    return {start: parseInput($("#query-start").value), end: parseInput($("#query-end").value)};
  }
  const end = Math.floor(Date.now() / 1000) * 1000;
  return {start: end - Number(rangeSelect.value) * 60000, end};
}
async function loadHistory() {
  const range = queryWindow();
  if (!Number.isFinite(range.start) || !Number.isFinite(range.end) || range.start >= range.end) {
    showMessage("#history-status", "Indica un inicio y un fin válidos, con el inicio anterior al fin.", "error");return;
  }
  if (range.end - range.start > 365 * 86400000) {
    showMessage("#history-status", "Consulta como máximo un año por vez.", "warning");return;
  }
  const token = ++generation;
  loadingHistory = true;
  $("#load-history").disabled = true;
  showMessage("#history-status", "Cargando historial…");
  try {
    const feeds = await readSource({
      start: new Date(range.start).toISOString().slice(0, 19).replace("T", " "),
      end: new Date(range.end).toISOString().slice(0, 19).replace("T", " "),
      timezone: "UTC",
      results: "8000"
    });
    if (token !== generation) return;
    histories = parseFeeds(feeds, range.start, range.end);
    loadedWindow = range;
    historyTruncated = feeds.length >= 8000;
    const count = feeds.filter(feed => {
      const time = Date.parse(feed.created_at);return time >= range.start && time <= range.end;
    }).length;
    $("#time-mode").value = "history";
    $("#time-manual").hidden = true;
    $("#apply-time-view").hidden = true;
    $("#view-start").value = inputDate(range.start);
    $("#view-end").value = inputDate(range.end);
    resetSegment();
    showMessage("#history-status", `${formatNumber(count)} registros recibidos · ${formatDate(range.start)} — ${formatDate(range.end)}.${historyTruncated ? " Límite de 8000 registros alcanzado: el historial y las estadísticas pueden estar incompletos. Reduce el intervalo de consulta." : ""}`, historyTruncated ? "warning" : count ? "" : "warning");
    renderCharts();
  } catch (error) {
    showMessage("#history-status", `No se pudo cargar el historial (${error.message}). ${loadedWindow ? "Se conserva el intervalo cargado anteriormente, indicado en el análisis." : "Intenta nuevamente."}`, "error");
  } finally {
    if (token === generation) {loadingHistory = false;$("#load-history").disabled = false;}
  }
}
function calculateStats(points, start, end) {
  const values = points.filter(p => p.time >= start && p.time <= end).map(p => p.value).sort((a, b) => a - b);
  const n = values.length;
  if (!n) return {n: 0, mean: null, median: null, min: null, max: null};
  const middle = Math.floor(n / 2);
  return {n, mean: values.reduce((a, b) => a + b, 0) / n,
    median: n % 2 ? values[middle] : (values[middle - 1] + values[middle]) / 2,
    min: values[0], max: values[n - 1]};
}
function renderStats() {
  statistics = variables.map((variable, index) => ({variable,
    ...calculateStats(histories[index] || [], selectedSegment.start, selectedSegment.end)}));
  const number = (value, variable) => value === null ? "—" : formatNumber(value, variable.decimals ?? 2);
  $("#stats-body").innerHTML = statistics.map(row => `<tr><td>${escapeHTML(row.variable.name)}<span class="stats-unit">${escapeHTML(row.variable.unit)}</span></td><td>${formatNumber(row.n)}</td><td>${number(row.mean, row.variable)}</td><td>${number(row.median, row.variable)}</td></tr>`).join("");
  const all = histories.flatMap(points => points.map(p => p.time));
  const inside = all.filter(time => time >= selectedSegment.start && time <= selectedSegment.end);
  const coverage = inside.length ? ` Lecturas disponibles: ${formatDate(inside.reduce((a,b)=>Math.min(a,b)))} — ${formatDate(inside.reduce((a,b)=>Math.max(a,b)))}.` : " Sin lecturas en este segmento.";
  const box = $("#segment-message");box.className = "segment-message";
  box.textContent = `${formatDate(selectedSegment.start)} — ${formatDate(selectedSegment.end)}.${coverage}${historyTruncated ? " Cálculos sobre un historial posiblemente incompleto." : ""}`;
}
function setSegment(start, end) {
  if (!loadedWindow || !Number.isFinite(start) || !Number.isFinite(end) || start >= end || start < loadedWindow.start || end > loadedWindow.end) {
    $("#segment-message").textContent = "Selecciona un inicio anterior al fin, dentro del historial cargado.";
    $("#segment-message").className = "segment-message error";return false;
  }
  selectedSegment = {start, end};
  $("#segment-start").value = inputDate(start);
  $("#segment-end").value = inputDate(end);
  renderStats();
  charts.forEach(({chart}) => chart.draw());
  if ($("#time-mode").value === "segment") renderChartWindow();
  return true;
}
function resetSegment() {
  if (loadedWindow) setSegment(loadedWindow.start, loadedWindow.end);
}
function renderCharts() {
  charts.forEach(({chart, index, empty}) => {
    empty.hidden = histories[index].length > 0;
    const view = chartWindow() || loadedWindow;
    chart.options.scales.x.min = view.start;
    chart.options.scales.x.max = view.end;
    chart.data.datasets[0].data = histories[index].map(point => ({x: point.time, y: point.value}));
    chart.data.datasets[0].pointRadius = histories[index].length === 1 ? 3 : 0;
    chart.resize();chart.update("none");
  });
  renderChartWindow();
}
function chartWindow() {
  if (!loadedWindow) return null;
  const mode = $("#time-mode").value;
  if (mode === "segment") return selectedSegment || loadedWindow;
  if (mode === "available") {
    const times = histories.flatMap(points => points.map(point => point.time));
    if (!times.length) return loadedWindow;
    let start = times.reduce((a,b)=>Math.min(a,b)), end = times.reduce((a,b)=>Math.max(a,b));
    if (start === end) {start = Math.max(loadedWindow.start, start-30000);end = Math.min(loadedWindow.end, end+30000);}
    return {start, end};
  }
  if (mode === "manual") {
    const start = parseInput($("#view-start").value), end = parseInput($("#view-end").value);
    if (!Number.isFinite(start) || !Number.isFinite(end) || start >= end || start < loadedWindow.start || end > loadedWindow.end) return null;
    return {start, end};
  }
  return loadedWindow;
}
function renderChartWindow() {
  const view = chartWindow();
  if (!view) {
    $("#time-view-message").textContent = loadedWindow ? "Indica un inicio anterior al fin, dentro del historial cargado. La vista anterior se conserva." : "Carga un historial para ajustar la vista.";
    $("#time-view-message").className = "time-view-message error";
    return false;
  }
  charts.forEach(({chart}) => {
    chart.options.scales.x.min = view.start;chart.options.scales.x.max = view.end;
    chart.update("none");
  });
  $("#time-view-message").textContent = `Vista: ${formatDate(view.start)} — ${formatDate(view.end)}. Cambiar la vista no modifica el segmento estadístico.`;
  $("#time-view-message").className = "time-view-message";
  return true;
}
function applyVerticalAxis(entry) {
  const {chart, yMode, yMin, yMax, axisMessage} = entry;
  if (yMode.value === "auto") {
    delete chart.options.scales.y.min;delete chart.options.scales.y.max;
    axisMessage.textContent = "";chart.update("none");return true;
  }
  const min = yMin.value.trim() === "" ? NaN : Number(yMin.value);
  const max = yMax.value.trim() === "" ? NaN : Number(yMax.value);
  if (!Number.isFinite(min) || !Number.isFinite(max) || min >= max) {
    axisMessage.textContent = "El mínimo debe ser menor que el máximo.";return false;
  }
  chart.options.scales.y.min = min;chart.options.scales.y.max = max;
  axisMessage.textContent = "";chart.update("none");return true;
}
function attachAxisControls(entry) {
  entry.yMode.addEventListener("change", () => {
    entry.yManual.hidden = entry.yMode.value !== "manual";
    if (entry.yMode.value === "auto") applyVerticalAxis(entry);
    else {
      const scale = entry.chart.scales.y;
      if (Number.isFinite(scale?.min) && Number.isFinite(scale?.max)) {
        entry.yMin.value = scale.min;entry.yMax.value = scale.max;
      }
      applyVerticalAxis(entry);
    }
  });
  entry.controls.addEventListener("submit", event => {event.preventDefault();applyVerticalAxis(entry);});
}
// El mismo segmento se sombrea en las ocho series.
const segmentOverlay = {
  id: "segmentOverlay",
  beforeDatasetsDraw(chart) {
    const segment = chart.$dragSegment || selectedSegment;
    if (!segment || !chart.chartArea || !chart.scales.x) return;
    const {left, right, top, bottom} = chart.chartArea;
    const x1 = Math.max(left, chart.scales.x.getPixelForValue(segment.start));
    const x2 = Math.min(right, chart.scales.x.getPixelForValue(segment.end));
    if (x2 <= x1) return;
    const ctx = chart.ctx;ctx.save();ctx.fillStyle = "rgba(20,100,119,0.08)";ctx.fillRect(x1, top, x2 - x1, bottom - top);ctx.restore();
  }
};
function attachSelection({canvas, chart}) {
  let first = null;
  const timeAt = event => {
    const rect = canvas.getBoundingClientRect();
    const pixel = (event.clientX - rect.left) * chart.width / rect.width;
    return chart.scales.x.getValueForPixel(Math.max(chart.chartArea.left, Math.min(chart.chartArea.right, pixel)));
  };
  canvas.addEventListener("pointerdown", event => {
    if (!loadedWindow || !chart.chartArea || event.button !== 0) return;
    const rect = canvas.getBoundingClientRect();
    const x = (event.clientX - rect.left) * chart.width / rect.width;
    const y = (event.clientY - rect.top) * chart.height / rect.height;
    if (x < chart.chartArea.left || x > chart.chartArea.right || y < chart.chartArea.top || y > chart.chartArea.bottom) return;
    first = timeAt(event);canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener("pointermove", event => {
    if (first === null) return;
    const last = timeAt(event);chart.$dragSegment = {start: Math.min(first, last), end: Math.max(first, last)};chart.draw();
  });
  canvas.addEventListener("pointerup", event => {
    if (first === null) return;
    const last = timeAt(event);const start = Math.min(first, last);const end = Math.max(first, last);first = null;delete chart.$dragSegment;
    if (end - start > 1000) setSegment(Math.max(loadedWindow.start, Math.floor(start / 1000) * 1000), Math.min(loadedWindow.end, Math.ceil(end / 1000) * 1000));
    chart.draw();
  });
  canvas.addEventListener("pointercancel", () => {first = null;delete chart.$dragSegment;chart.draw();});
}
function saveCSV(headers, rows, name) {
  const quote = value => `"${String(value ?? "").replace(/"/g, '""')}"`;
  const csv = "\uFEFF" + [headers, ...rows].map(row => row.map(quote).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], {type: "text/csv;charset=utf-8;"}));
  const a = document.createElement("a");a.href = url;a.download = name;document.body.appendChild(a);a.click();a.remove();setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function exportData() {
  if (!loadedWindow) {showMessage("#history-status", "Carga un historial antes de exportar.", "warning");return;}
  const times = [...new Set(histories.flatMap(points => points.map(p => p.time)))].sort((a,b) => a-b);
  if (!times.length) {showMessage("#history-status", "No hay lecturas para exportar.", "warning");return;}
  const lookups = histories.map(points => new Map(points.map(p => [p.time, p.value])));
  saveCSV(["fecha_hora_UTC", ...variables.map(v => `${v.name} (${v.unit})`)], times.map(t => [new Date(t).toISOString(), ...lookups.map(m => m.get(t) ?? "")]), "aquatrace-lecturas.csv");
}
function exportStats() {
  if (!selectedSegment) return;
  saveCSV(["variable", "unidad", "n", "media", "mediana", "minimo", "maximo", "inicio_UTC", "fin_UTC", "historial_posiblemente_incompleto"], statistics.map(s => [s.variable.name, s.variable.unit, s.n, s.mean, s.median, s.min, s.max, new Date(selectedSegment.start).toISOString(), new Date(selectedSegment.end).toISOString(), historyTruncated]), "aquatrace-estadisticas.csv");
}
function initializeStation() {
  document.title = `${station.brand} · ${station.name}`;
  $("#station-brand").textContent = station.brand;$("#station-name").textContent = station.name;
  $("#channel-label").textContent = CHANNEL_ID;$("#map-name").textContent = station.place;$("#map-place").textContent = station.site;
  $("#latitude").textContent = `${station.latitude.toFixed(5)}°`;
  $("#longitude").textContent = `${station.longitude.toFixed(5)}°`;
  $("#map-note").textContent = station.locationNote;
  const lat = station.latitude, lon = station.longitude;
  const params = new URLSearchParams({bbox: `${lon-.002},${lat-.0015},${lon+.002},${lat+.0015}`, layer: "mapnik", marker: `${lat},${lon}`});
  $("#station-map").src = `https://www.openstreetmap.org/export/embed.html?${params}`;
  $("#map-link").href = `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=18/${lat}/${lon}`;
  $("#water-profile").value = station.defaultWaterProfile || "freshwater";
  const now = Math.floor(Date.now()/1000)*1000;
  $("#query-start").value = inputDate(now - 86400000);$("#query-end").value = inputDate(now);
}
function selectTab(name) {
  ["current", "history"].forEach(key => {
    const active = name === key;const button = $(`#tab-${key}`);
    button.setAttribute("aria-selected", String(active));button.tabIndex = active ? 0 : -1;
    $(`#panel-${key}`).hidden = !active;
  });
  if (name === "current") drawCurrent();
  if (name === "history") {
    if (!historyRequested) {historyRequested = true;loadHistory();}
    charts.forEach(({chart}) => {chart.resize();chart.update("none");});
  }
}
["current", "history"].forEach(name => {
  $(`#tab-${name}`).addEventListener("click", () => selectTab(name));
  $(`#tab-${name}`).addEventListener("keydown", event => {
    if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
      event.preventDefault();const target = event.key === "Home" ? "current" : event.key === "End" ? "history" : name === "current" ? "history" : "current";selectTab(target);$(`#tab-${target}`).focus();
    }
  });
});
rangeSelect.addEventListener("change", () => {
  $("#query-dates").hidden = rangeSelect.value !== "custom";
  if (rangeSelect.value !== "custom") {historyRequested = true;loadHistory();}
});
$("#time-mode").addEventListener("change", () => {
  const manual = $("#time-mode").value === "manual";
  $("#time-manual").hidden = !manual;$("#apply-time-view").hidden = !manual;
  if (!manual) renderChartWindow();
});
$("#time-view-form").addEventListener("submit", event => {event.preventDefault();renderChartWindow();});
$("#reset-time-view").addEventListener("click", () => {
  $("#time-mode").value = "history";$("#time-manual").hidden = true;$("#apply-time-view").hidden = true;renderChartWindow();
});
$("#history-form").addEventListener("submit", event => {event.preventDefault();historyRequested = true;loadHistory();});
$("#segment-form").addEventListener("submit", event => {event.preventDefault();setSegment(parseInput($("#segment-start").value), parseInput($("#segment-end").value));});
$("#reset-segment").addEventListener("click", resetSegment);
$("#wd-csv").addEventListener("click", exportData);$("#stats-csv").addEventListener("click", exportStats);
refreshButton.addEventListener("click", refreshCurrent);
window.addEventListener("resize", drawCurrent);
document.addEventListener("visibilitychange", () => {if (!document.hidden) refreshCurrent();});
initializeStation();
$("#water-profile").addEventListener("change", drawCurrent);
// Compatibilidad con fotos subidas en la raíz o en la carpeta assets.
["sensor", "landscape"].forEach(name => {
  const image = document.querySelector(`.${name}-photo`);
  const handleImageError = () => {
    if (image.dataset.fallbackTried) {
      image.alt = "No se encontró la fotografía. Sube los archivos JPEG junto a index.html.";
      return;
    }
    image.dataset.fallbackTried = "true";
    image.src = name === "sensor" ? "./assets/aquatrace-sensores.jpeg" : "./assets/entorno-estacion.jpeg";
  };
  image.addEventListener("error", handleImageError);
  if (image.complete && image.naturalWidth === 0) handleImageError();
});
if (typeof Chart !== "undefined") {
  Chart.defaults.font.size = 14;
  Chart.defaults.font.family = '"Segoe UI", system-ui, sans-serif';
  Chart.defaults.color = "#465d68";
}
variables.forEach((variable, index) => gauges.push(createGauge(variable, index)));
if (typeof Chart !== "undefined") {
  variables.forEach((variable, index) => charts.push(createChart(variable, index)));
  charts.forEach(attachSelection);
  charts.forEach(attachAxisControls);
} else {
  showMessage("#history-status", "No se pudo cargar Chart.js. Los medidores y los cálculos tabulares siguen disponibles; comprueba tu conexión para ver las gráficas.", "error");
}
refreshCurrent();
setInterval(() => {if (!document.hidden) refreshCurrent();}, REFRESH_MS);
