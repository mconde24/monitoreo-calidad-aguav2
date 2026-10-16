
"use strict";

// ================================================
// CONFIGURACION DE THINGSPEAK
// ================================================
const CHANNEL_ID = "3151173";
const REFRESH_MS = 30000;
const DEFAULT_RANGE = 1440;
// Ajustar al intervalo de transmisión del sensor: 15 min por defecto.
const STALE_AFTER_MS = 15 * 60 * 1000;

// No se requiere API Key para un canal publico.
const API_URL =
  `https://api.thingspeak.com/channels/${CHANNEL_ID}/feeds.json`;

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
    max: 2
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

// Zona horaria para presentar las fechas.
const TIME_ZONE = "America/Bogota";

const $ = (selector) => document.querySelector(selector);

const rangeSelect = $("#wd-range");
const refreshButton = $("#wd-refresh");
const csvButton = $("#wd-csv");
const statusBox = $("#wd-status");
const gaugeRoot = $("#wd-gauges");
const chartRoot = $("#wd-charts");

let histories = variables.map(() => []);
let charts = [];
let gauges = [];
let busy = false;
let lastSuccessfulRead = null;
let recordCount = 0;
let lastDataTime = null;

if (
  !rangeSelect ||
  !refreshButton ||
  !csvButton ||
  !statusBox ||
  !gaugeRoot ||
  !chartRoot
) {
  throw new Error("No se encontraron los elementos del dashboard.");
}

// ================================================
// FECHAS Y FORMATO
// ================================================
function formatNumber(value) {
  return new Intl.NumberFormat("es-CO", {
    maximumFractionDigits: 2
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

// ================================================
// CONSTRUIR MEDIDORES Y GRAFICAS
// ================================================
function createGauge(variable, index) {
  const card = document.createElement("article");
  card.className = "gauge-card";
  card.style.setProperty("--variable-color", variable.color);

  card.innerHTML = `
    <h3>${escapeHTML(variable.name)}</h3>
    <canvas
      class="gauge-canvas"
      role="img"
      aria-label="Medidor de ${escapeHTML(variable.name)}"
    ></canvas>
    <div class="gauge-value">--</div>
    <div class="gauge-unit">${escapeHTML(variable.unit)}</div>
    <div class="gauge-time">Sin lecturas</div>
  `;

  gaugeRoot.appendChild(card);

  return {
    card,
    canvas: card.querySelector("canvas"),
    value: card.querySelector(".gauge-value"),
    time: card.querySelector(".gauge-time"),
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

          callbacks: {
            title(items) {
              if (!items.length) return "";

              return formatDate(items[0].parsed.x);
            },

            label(context) {
              return `${variable.name}: ${
                formatNumber(context.parsed.y)
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
              if (Number(rangeSelect.value) > 1440) {
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
    empty: card.querySelector(".chart-empty"),
    variable,
    index
  };
}

function initializeDashboard() {
  variables.forEach((variable, index) => {
    gauges.push(createGauge(variable, index));
    charts.push(createChart(variable, index));
  });
}

// ================================================
// DIBUJAR MEDIDORES SEMICIRCULARES
// ================================================
function drawGauge(gauge, latest) {
  const canvas = gauge.canvas;
  const width = canvas.clientWidth || 160;
  const height = 116;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);
  const { variable } = gauge;
  const cx = width / 2;
  const cy = 88;
  const radius = Math.min(width * 0.39, 72);
  ctx.lineWidth = 7;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.arc(cx, cy, radius, Math.PI, 2 * Math.PI);
  ctx.strokeStyle = "#eaf0f2";
  ctx.stroke();
  if (Number.isFinite(latest)) {
    const fraction = Math.max(0, Math.min(1,
      (latest - variable.min) / (variable.max - variable.min)));
    if (fraction > 0) {
      ctx.beginPath();
      ctx.arc(cx, cy, radius, Math.PI, Math.PI + Math.PI * fraction);
      ctx.strokeStyle = variable.color;
      ctx.stroke();
    }
  }
  ctx.font = "10px system-ui, sans-serif";
  ctx.fillStyle = "#667980";
  ctx.textAlign = "center";
  ctx.fillText(formatNumber(variable.min), cx - radius, cy + 18);
  ctx.fillText(formatNumber(variable.max), cx + radius, cy + 18);
  canvas.setAttribute("aria-label", `${variable.name}: ${Number.isFinite(latest) ? formatNumber(latest) + " " + variable.unit : "sin datos"}. Escala ${variable.min} a ${variable.max}.`);
}

// ================================================
// ACTUALIZAR LA INTERFAZ
// ================================================
function redraw() {
  gauges.forEach((gauge) => {
    const points = histories[gauge.index];
    const latest = points.length ? points[points.length - 1] : null;

    gauge.value.textContent = latest
      ? formatNumber(latest.value)
      : "--";

    const stale = latest && Date.now() - latest.time > STALE_AFTER_MS;
    const outside = latest && (latest.value < gauge.variable.min || latest.value > gauge.variable.max);
    gauge.card.classList.toggle("is-stale", Boolean(stale));
    gauge.card.classList.toggle("is-outside", Boolean(outside));
    gauge.time.textContent = latest
      ? `${formatDate(latest.time)}${stale ? " · Dato antiguo" : ""}${outside ? " · Fuera de escala" : ""}`
      : "Sin lecturas en el periodo";

    drawGauge(
      gauge,
      latest ? latest.value : NaN
    );
  });

  charts.forEach(({ chart, index, empty }) => {
    empty.hidden = histories[index].length > 0;
    const rangeMinutes = Number(rangeSelect.value) || DEFAULT_RANGE;
    chart.options.scales.x.min = Date.now() - rangeMinutes * 60000;
    chart.options.scales.x.max = Date.now();
    chart.data.datasets[0].data = histories[index].map((point) => ({
      x: point.time,
      y: point.value
    }));

    chart.data.datasets[0].pointRadius = histories[index].length === 1 ? 3 : 0;
    chart.update("none");
  });

  $("#record-count").textContent = formatNumber(recordCount);

  const latestTimes = histories
    .filter((points) => points.length > 0)
    .map((points) => points[points.length - 1].time);

  $("#last-reading").textContent = latestTimes.length
    ? formatDate(Math.max(...latestTimes))
    : "--";
}

// ================================================
// ESTADO DE LA CONEXION
// ================================================
function setStatus(message, state) {
  statusBox.textContent = message;
  statusBox.className = "status";

  if (state) {
    statusBox.classList.add(state);
  }

  const dot = $("#connection-dot");
  const label = $("#connection-label");

  dot.className = "dot";

  if (state === "success") {
    dot.classList.add("online");
    const stale = lastDataTime === null || Date.now() - lastDataTime > STALE_AFTER_MS;
    dot.classList.toggle("stale", stale);
    label.textContent = stale ? "Fuente conectada · Sin datos recientes" : "Fuente conectada · Datos recientes";
  } else if (state === "error") {
    dot.classList.add("offline");
    label.textContent = "Consulta fallida";
  } else {
    label.textContent = state === "warning" ? "Fuente conectada · Sin datos en el periodo" : "Consultando fuente…";
  }
}

// ================================================
// CONSULTAR THINGSPEAK
// ================================================
async function refresh() {
  if (busy) return;

  busy = true;
  refreshButton.disabled = true;
  setStatus("Consultando las mediciones de ThingSpeak...");

  const minutes = Number(rangeSelect.value) || DEFAULT_RANGE;
  const now = Date.now();
  const start = now - minutes * 60 * 1000;

  try {
    const params = new URLSearchParams({
      minutes: String(minutes),
      results: "8000"
    });

    // No se envia api_key porque el canal es publico.
    const url = `${API_URL}?${params.toString()}`;

    const response = await fetch(url, {
      signal: AbortSignal.timeout(20000),
      method: "GET",
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error(`Error HTTP ${response.status}`);
    }

    const data = await response.json();

    if (!data || !Array.isArray(data.feeds)) {
      throw new Error(
        "Respuesta no valida. Verifica que el canal sea publico."
      );
    }

    const nextHistories = variables.map((variable) => {
      return data.feeds
        .map((feed) => {
          const time = Date.parse(feed.created_at);
          const raw = feed[variable.field];

          if (
            raw === null ||
            raw === undefined ||
            String(raw).trim() === ""
          ) {
            return null;
          }

          const value = Number(raw);

          if (!Number.isFinite(time) || !Number.isFinite(value)) {
            return null;
          }

          return { time, value };
        })
        .filter((point) => {
          return point !== null &&
            point.time >= start &&
            point.time <= now;
        })
        .sort((a, b) => a.time - b.time);
    });

    const validTimes = data.feeds.map(feed => Date.parse(feed.created_at))
      .filter(time => Number.isFinite(time) && time >= start && time <= now);
    recordCount = validTimes.length;
    lastDataTime = nextHistories.reduce((latest, points) =>
      points.length ? Math.max(latest ?? 0, points[points.length - 1].time) : latest, null);
    histories = nextHistories;
    lastSuccessfulRead = Date.now();

    redraw();

    const count = recordCount;

    if (count > 0 && lastDataTime !== null) {
      setStatus(
        `Lectura correcta. ThingSpeak devolvió ${count} registros ` +
        `para el periodo consultado.${data.feeds.length >= 8000 ? " Se alcanzó el límite de 8000 registros; el historial puede estar incompleto." : ""}`,
        "success"
      );
    } else {
      setStatus(
        "La conexión funciona, pero no hay registros en este periodo.",
        "warning"
      );
    }

    $("#last-update").textContent =
      `Última consulta correcta: ${formatDate(lastSuccessfulRead)}`;

  } catch (error) {
    console.error("Error consultando ThingSpeak:", error);

    setStatus(
      `No fue posible consultar ThingSpeak: ${error.message}. ` +
      "Se conservan los datos de la última consulta correcta; pueden no corresponder al periodo seleccionado.",
      "error"
    );

    // Conserva las últimas lecturas válidas si falla la conexión.
    $("#last-update").textContent = lastSuccessfulRead
      ? `Última consulta correcta: ${formatDate(lastSuccessfulRead)}`
      : "Todavía no se ha recibido una lectura correcta.";

  } finally {
    busy = false;
    refreshButton.disabled = false;
  }
}

// ================================================
// DESCARGAR HISTORIAL CSV
// ================================================
function downloadCSV() {
  const allTimes = [
    ...new Set(
      histories.flatMap((points) =>
        points.map((point) => point.time)
      )
    )
  ].sort((a, b) => a - b);

  if (!allTimes.length) {
    setStatus(
      "No hay mediciones para exportar. Espera a recibir datos.",
      "warning"
    );
    return;
  }

  const lookup = histories.map((points) => {
    return new Map(points.map((point) => [point.time, point.value]));
  });

  const headers = [
    "fecha_hora_UTC",
    ...variables.map((variable) =>
      `${variable.name} (${variable.unit})`
    )
  ];

  const rows = allTimes.map((time) => {
    const values = [
      new Date(time).toISOString(),
      ...lookup.map((map) => {
        const value = map.get(time);
        return value === undefined ? "" : String(value);
      })
    ];

    return values.map((value) => {
      // Escapado CSV compatible con Excel.
      return `"${String(value).replace(/"/g, '""')}"`;
    }).join(",");
  });

  const csv = "\uFEFF" + [
    headers.map((value) => `"${value}"`).join(","),
    ...rows
  ].join("\r\n");

  const blob = new Blob([csv], {
    type: "text/csv;charset=utf-8;"
  });

  const objectURL = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = objectURL;
  link.download = `calidad-agua-${CHANNEL_ID}.csv`;

  document.body.appendChild(link);
  link.click();
  link.remove();

  setTimeout(() => URL.revokeObjectURL(objectURL), 1000);
}

// ================================================
// EVENTOS E INICIALIZACION
// ================================================
rangeSelect.addEventListener("change", refresh);
refreshButton.addEventListener("click", refresh);
csvButton.addEventListener("click", downloadCSV);

let refreshTimer = null;

function startAutoRefresh() {
  if (refreshTimer !== null) {
    clearInterval(refreshTimer);
  }

  refreshTimer = setInterval(() => {
    // Evita solicitudes innecesarias en pestañas ocultas.
    if (!document.hidden) {
      refresh();
    }
  }, REFRESH_MS);
}

document.addEventListener("visibilitychange", () => {
  if (!document.hidden) {
    refresh();
  }
});

window.addEventListener("resize", () => {
  gauges.forEach((gauge) => {
    const points = histories[gauge.index];
    const latest = points.length ? points[points.length - 1] : null;

    drawGauge(gauge, latest ? latest.value : NaN);
  });
});

if (typeof Chart === "undefined") {
  setStatus(
    "No se pudo cargar Chart.js. Comprueba tu conexión a Internet.",
    "error"
  );
} else {
  initializeDashboard();
  redraw();
  refresh();
  startAutoRefresh();
}
