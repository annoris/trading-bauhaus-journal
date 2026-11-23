/**
 * Custom zero-dependency SVG financial charting engine for Trading Bauhaus.
 * Uses CSS design tokens directly so dark/light themes stay synchronized.
 * Color only reinforces: signed figures, zero baselines, and distinct marker shapes carry meaning.
 */

export const escapeHtml = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

export function formatMoney(value, privacyMode = false, { signed = true, compact = false } = {}) {
  if (privacyMode) {
    if (!signed) return "$••••";
    return value >= 0 ? "+$••••" : "-$••••";
  }
  const abs = Math.abs(value);
  const sign = signed ? (value > 0 ? "+" : value < 0 ? "-" : "") : value < 0 ? "-" : "";
  if (compact && abs >= 1000) {
    return `${sign}$${(abs / 1000).toFixed(1)}k`;
  }
  return `${sign}$${abs.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatR(r) {
  if (r === null || r === undefined || Number.isNaN(r)) return "—";
  return `${r >= 0 ? "+" : ""}${r.toFixed(2)}R`;
}

export function formatProfitFactor(metrics) {
  if (metrics.profitFactorIsInfinite) return "∞";
  if (metrics.profitFactor === null) return "—";
  return metrics.profitFactor.toFixed(2);
}

export function formatWinRate(winRate) {
  return winRate !== null && winRate !== undefined ? `${(winRate * 100).toFixed(1)}%` : "—";
}

function renderYGridLines({ pad, width, yMin, yMax, yAt, formatLabel, ticks = 4 }) {
  const lines = [];
  for (let t = 0; t <= ticks; t++) {
    const val = yMin + ((yMax - yMin) * t) / ticks;
    const y = yAt(val);
    lines.push(`
      <line x1="${pad.left}" y1="${y.toFixed(1)}" x2="${width - pad.right}" y2="${y.toFixed(
        1,
      )}" stroke="var(--gridline)" stroke-width="1" stroke-dasharray="3 3" />
      <text x="${pad.left - 10}" y="${(y + 3.5).toFixed(
        1,
      )}" text-anchor="end" fill="var(--dim)" font-size="10.5" class="tabular-nums">${escapeHtml(
        formatLabel(val),
      )}</text>
    `);
  }
  return lines.join("");
}

export function formatShortDate(dateStr) {
  const [, month, day] = dateStr.split("-");
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const mIdx = Number(month) - 1;
  return `${months[mIdx] ?? month} ${Number(day)}`;
}

/** Semicircle SVG gauge for Win Rate */
export function renderWinRateGaugeSVG(winRate) {
  const pct = winRate !== null ? Math.max(0, Math.min(100, winRate * 100)) : 0;
  const radius = 58;
  const cx = 80;
  const cy = 74;
  const circumference = Math.PI * radius;
  const filled = (pct / 100) * circumference;

  return `
    <svg class="svg-gauge" viewBox="0 0 160 92" role="img" aria-label="Trade win rate gauge at ${pct.toFixed(1)}%">
      <path
        d="M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}"
        fill="none"
        stroke="var(--gridline)"
        stroke-width="11"
        stroke-linecap="round"
      />
      <path
        d="M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}"
        fill="none"
        stroke="${pct >= 50 ? "var(--profit)" : "var(--warning)"}"
        stroke-width="11"
        stroke-linecap="round"
        stroke-dasharray="${filled.toFixed(2)} ${circumference.toFixed(2)}"
      />
      <text x="${cx}" y="${cy - 10}" text-anchor="middle" fill="var(--fg)" font-size="20" font-weight="700" class="tabular-nums">
        ${winRate !== null ? `${pct.toFixed(1)}%` : "—"}
      </text>
      <text x="${cx}" y="${cy + 10}" text-anchor="middle" fill="var(--muted)" font-size="9.5" letter-spacing="0.08em">
        WIN RATE
      </text>
    </svg>
  `;
}

/** 6-axis Edge Score v2 radar chart with generous padding so labels never clip */
export function renderEdgeRadarSVG(components, { compact = false } = {}) {
  const axes = [
    { key: "winRate", label: "Win %", angleDeg: -90, anchor: "middle", dx: 0, dy: -12 },
    { key: "profitFactor", label: "Profit factor", angleDeg: -30, anchor: "start", dx: 11, dy: -2 },
    { key: "avgWinLoss", label: "Avg win/loss", angleDeg: 30, anchor: "start", dx: 11, dy: 8 },
    { key: "drawdown", label: "Drawdown", angleDeg: 90, anchor: "middle", dx: 0, dy: 16 },
    { key: "recovery", label: "Recovery", angleDeg: 150, anchor: "end", dx: -11, dy: 8 },
    { key: "consistency", label: "Consistency", angleDeg: 210, anchor: "end", dx: -11, dy: -2 },
  ];

  const width = compact ? 300 : 360;
  const height = compact ? 225 : 272;
  const cx = width / 2;
  const cy = height / 2;
  const radius = compact ? 58 : 72;
  const labelRadius = compact ? 68 : 82;

  const pointAt = (deg, r) => {
    const rad = (deg * Math.PI) / 180;
    return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
  };

  const rings = [0.25, 0.5, 0.75, 1]
    .map((scale) => {
      const pts = axes
        .map((a) =>
          pointAt(a.angleDeg, radius * scale)
            .map((n) => n.toFixed(1))
            .join(","),
        )
        .join(" ");
      return `<polygon points="${pts}" fill="none" stroke="var(--gridline)" stroke-width="1" />`;
    })
    .join("");

  const spokes = axes
    .map((a) => {
      const [x, y] = pointAt(a.angleDeg, radius);
      return `<line x1="${cx}" y1="${cy}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" stroke="var(--gridline)" stroke-width="1" />`;
    })
    .join("");

  const polygonPoints = axes
    .map((a) => {
      const score = Math.max(0, Math.min(100, components[a.key] ?? 0));
      return pointAt(a.angleDeg, (score / 100) * radius)
        .map((n) => n.toFixed(1))
        .join(",");
    })
    .join(" ");

  const vertexDots = axes
    .map((a) => {
      const score = Math.max(0, Math.min(100, components[a.key] ?? 0));
      const [x, y] = pointAt(a.angleDeg, (score / 100) * radius);
      return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3.4" fill="var(--brand)" stroke="var(--card)" stroke-width="1.4">
        <title>${escapeHtml(a.label)}: ${Math.round(score)}/100</title>
      </circle>`;
    })
    .join("");

  const labels = axes
    .map((a) => {
      const [lx, ly] = pointAt(a.angleDeg, labelRadius);
      const val = Math.round(components[a.key] ?? 0);
      return `
        <text
          x="${(lx + a.dx).toFixed(1)}"
          y="${(ly + a.dy).toFixed(1)}"
          text-anchor="${a.anchor}"
          fill="var(--muted)"
          font-size="${compact ? 9.5 : 10.5}"
          font-weight="500"
        >${escapeHtml(a.label)} <tspan fill="var(--fg)" font-weight="600" class="tabular-nums">${val}</tspan></text>
      `;
    })
    .join("");

  return `
    <svg class="svg-radar" viewBox="0 0 ${width} ${height}" role="img" aria-label="Edge Score 6-axis radar chart">
      ${rings}
      ${spokes}
      <polygon
        points="${polygonPoints}"
        fill="var(--brand)"
        fill-opacity="0.22"
        stroke="var(--brand)"
        stroke-width="2"
        stroke-linejoin="round"
      />
      ${vertexDots}
      ${labels}
    </svg>
  `;
}

/** Cumulative P&L area/line curve with zero baseline and interactive point markers */
export function renderEquityCurveSVG(
  points,
  {
    privacyMode = false,
    height = 240,
    width = 680,
    compact = false,
    interactive = true,
    uid = "eq",
  } = {},
) {
  if (!points || !points.length) {
    return `<div class="chart-empty">No closed trades match the current filter.</div>`;
  }

  const pad = compact
    ? { top: 10, right: 10, bottom: 14, left: 10 }
    : { top: 18, right: 20, bottom: 32, left: 66 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;

  const series = [
    { index: 0, date: points[0].date ?? "", cumNetPnl: 0, pnl: 0, symbol: "" },
    ...points,
  ];
  const values = series.map((p) => p.cumNetPnl);
  const rawMin = Math.min(0, ...values);
  const rawMax = Math.max(0, ...values);
  const span = Math.max(40, rawMax - rawMin);
  const yMin = rawMin - span * 0.08;
  const yMax = rawMax + span * 0.08;

  const xAt = (i) =>
    pad.left + (series.length <= 1 ? plotW / 2 : (i / (series.length - 1)) * plotW);
  const yAt = (v) => pad.top + ((yMax - v) / (yMax - yMin)) * plotH;
  const zeroY = yAt(0);

  const coords = series.map((p, i) => ({ ...p, x: xAt(i), y: yAt(p.cumNetPnl) }));
  const linePath = coords
    .map((c, i) => `${i === 0 ? "M" : "L"} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`)
    .join(" ");
  const areaPath = `${linePath} L ${coords[coords.length - 1].x.toFixed(1)} ${zeroY.toFixed(
    1,
  )} L ${coords[0].x.toFixed(1)} ${zeroY.toFixed(1)} Z`;

  const lastVal = series[series.length - 1].cumNetPnl;
  const positive = lastVal >= 0;
  const strokeColor = positive ? "var(--profit)" : "var(--loss)";

  // Y gridlines
  const gridLines = compact
    ? ""
    : renderYGridLines({
        pad,
        width,
        yMin,
        yMax,
        yAt,
        formatLabel: (val) =>
          formatMoney(val, privacyMode, { signed: true, compact: Math.abs(val) >= 1000 }),
      });

  // X ticks
  const xTickIndices =
    series.length <= 4
      ? series.map((_, i) => i)
      : [
          0,
          Math.floor((series.length - 1) * 0.33),
          Math.floor((series.length - 1) * 0.66),
          series.length - 1,
        ];
  const xLabels = compact
    ? ""
    : [...new Set(xTickIndices)]
        .map((idx) => {
          const item = coords[idx];
          if (!item || !item.date) return "";
          const label = idx === 0 ? "Start" : formatShortDate(item.date);
          return `<text x="${item.x.toFixed(1)}" y="${height - 8}" text-anchor="middle" fill="var(--dim)" font-size="10.5">${escapeHtml(
            label,
          )}</text>`;
        })
        .join("");

  const interactiveCircles = interactive
    ? coords
        .slice(1)
        .map(
          (c) => `
          <g class="eq-point-group" data-equity-idx="${c.index}">
            <circle cx="${c.x.toFixed(1)}" cy="${c.y.toFixed(1)}" r="10" fill="transparent" class="eq-hit" />
            <circle
              cx="${c.x.toFixed(1)}"
              cy="${c.y.toFixed(1)}"
              r="3.2"
              fill="${c.pnl >= 0 ? "var(--profit)" : "var(--loss)"}"
              stroke="var(--card)"
              stroke-width="1.3"
              class="eq-dot"
            />
          </g>
        `,
        )
        .join("")
    : "";

  return `
    <svg class="svg-equity" viewBox="0 0 ${width} ${height}" role="img" aria-label="Cumulative net P&L equity curve">
      <defs>
        <linearGradient id="grad-${uid}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${strokeColor}" stop-opacity="0.28" />
          <stop offset="100%" stop-color="${strokeColor}" stop-opacity="0.01" />
        </linearGradient>
      </defs>
      ${gridLines}
      <line
        x1="${pad.left}"
        y1="${zeroY.toFixed(1)}"
        x2="${width - pad.right}"
        y2="${zeroY.toFixed(1)}"
        stroke="var(--baseline)"
        stroke-width="1.3"
      />
      <path d="${areaPath}" fill="url(#grad-${uid})" />
      <path d="${linePath}" fill="none" stroke="${strokeColor}" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round" />
      ${interactiveCircles}
      ${xLabels}
    </svg>
  `;
}

/** Zero-anchored Daily Net P&L vertical bars */
export function renderDailyBarsSVG(days, privacyMode = false) {
  if (!days || !days.length) {
    return `<div class="chart-empty">No trading days in this filter.</div>`;
  }

  const width = 760;
  const height = 240;
  const pad = { top: 20, right: 16, bottom: 32, left: 66 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;

  const vals = days.map((d) => d.netPnl);
  const rawMin = Math.min(0, ...vals);
  const rawMax = Math.max(0, ...vals);
  const span = Math.max(50, rawMax - rawMin);
  const yMin = rawMin - span * 0.1;
  const yMax = rawMax + span * 0.1;
  const yAt = (v) => pad.top + ((yMax - v) / (yMax - yMin)) * plotH;
  const zeroY = yAt(0);

  const slotW = plotW / days.length;
  const barW = Math.max(4, Math.min(26, slotW * 0.66));

  const gridLines = renderYGridLines({
    pad,
    width,
    yMin,
    yMax,
    yAt,
    formatLabel: (val) =>
      formatMoney(val, privacyMode, { signed: true, compact: Math.abs(val) >= 1000 }),
  });

  const bars = days
    .map((day, idx) => {
      const x = pad.left + idx * slotW + (slotW - barW) / 2;
      const yVal = yAt(day.netPnl);
      const yTop = day.netPnl >= 0 ? yVal : zeroY;
      const barH = Math.max(2, Math.abs(yVal - zeroY));
      const fill = day.netPnl >= 0 ? "var(--profit)" : "var(--loss)";
      return `
        <rect
          x="${x.toFixed(1)}"
          y="${yTop.toFixed(1)}"
          width="${barW.toFixed(1)}"
          height="${barH.toFixed(1)}"
          rx="2.5"
          fill="${fill}"
          fill-opacity="0.88"
          class="daily-bar-rect"
          data-bar-date="${day.date}"
          data-bar-pnl="${day.netPnl}"
          data-bar-trades="${day.trades}"
        >
          <title>${day.date}: ${formatMoney(day.netPnl, privacyMode)} (${day.trades} trade${
            day.trades === 1 ? "" : "s"
          })</title>
        </rect>
      `;
    })
    .join("");

  const labelStep = Math.max(1, Math.ceil(days.length / 6));
  const xLabels = days
    .filter((_, idx) => idx % labelStep === 0 || idx === days.length - 1)
    .map((day) => {
      const idx = days.indexOf(day);
      const cx = pad.left + idx * slotW + slotW / 2;
      return `<text x="${cx.toFixed(1)}" y="${height - 8}" text-anchor="middle" fill="var(--dim)" font-size="10">${escapeHtml(
        formatShortDate(day.date),
      )}</text>`;
    })
    .join("");

  return `
    <svg class="svg-daily-bars" viewBox="0 0 ${width} ${height}" role="img" aria-label="Daily net P&L bar chart">
      ${gridLines}
      <line x1="${pad.left}" y1="${zeroY.toFixed(1)}" x2="${width - pad.right}" y2="${zeroY.toFixed(
        1,
      )}" stroke="var(--baseline)" stroke-width="1.4" />
      ${bars}
      ${xLabels}
    </svg>
  `;
}

/** Interactive Trade Scatter Plot (Duration vs Net P&L or Realized R) */
export function renderScatterSVG(trades, metric = "pnl", privacyMode = false) {
  if (!trades || !trades.length) {
    return `<div class="chart-empty">No trades available for scatter plot.</div>`;
  }

  const width = 760;
  const height = 290;
  const pad = { top: 22, right: 24, bottom: 38, left: 66 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;

  const yValueOf = (t) => (metric === "r" ? (t.realizedR ?? 0) : t.netPnl);
  const durations = trades.map((t) => t.durationMinutes);
  const maxDur = Math.max(25, ...durations) + 2;
  const yVals = trades.map(yValueOf);
  const rawMin = Math.min(0, ...yVals);
  const rawMax = Math.max(0, ...yVals);
  const span = Math.max(metric === "r" ? 2 : 60, rawMax - rawMin);
  const yMin = rawMin - span * 0.1;
  const yMax = rawMax + span * 0.1;

  const xAt = (mins) => pad.left + (mins / maxDur) * plotW;
  const yAt = (val) => pad.top + ((yMax - val) / (yMax - yMin)) * plotH;
  const zeroY = yAt(0);

  const gridLines = renderYGridLines({
    pad,
    width,
    yMin,
    yMax,
    yAt,
    formatLabel: (val) =>
      metric === "r"
        ? `${val >= 0 ? "+" : ""}${val.toFixed(1)}R`
        : formatMoney(val, privacyMode, { signed: true, compact: Math.abs(val) >= 1000 }),
  });

  const xTicks = [0, 5, 10, 15, 20, 25, 30]
    .filter((m) => m <= maxDur)
    .map((m) => {
      const x = xAt(m);
      return `
        <line x1="${x.toFixed(1)}" y1="${pad.top}" x2="${x.toFixed(1)}" y2="${
          height - pad.bottom
        }" stroke="var(--gridline)" stroke-width="1" stroke-opacity="0.45" />
        <text x="${x.toFixed(1)}" y="${height - 12}" text-anchor="middle" fill="var(--dim)" font-size="10.5" class="tabular-nums">${m}m</text>
      `;
    })
    .join("");

  // Distinct shapes: wins = circles, losses = rotated diamonds (color only reinforces!)
  const dots = trades
    .map((t) => {
      const cx = xAt(t.durationMinutes);
      const cy = yAt(yValueOf(t));
      const isWin = t.netPnl >= 0;
      const fill = isWin ? "var(--profit)" : "var(--loss)";
      const marker = isWin
        ? `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="5.5" fill="${fill}" fill-opacity="0.86" stroke="var(--card)" stroke-width="1.5" />`
        : `<polygon points="${cx.toFixed(1)},${(cy - 6).toFixed(1)} ${(cx + 6).toFixed(
            1,
          )},${cy.toFixed(1)} ${cx.toFixed(1)},${(cy + 6).toFixed(1)} ${(cx - 6).toFixed(
            1,
          )},${cy.toFixed(1)}" fill="${fill}" fill-opacity="0.88" stroke="var(--card)" stroke-width="1.5" />`;

      return `
        <g
          class="scatter-node"
          tabindex="0"
          role="button"
          aria-label="Inspect ${t.symbol} ${t.direction} on ${t.dateKey}, ${formatMoney(
            t.netPnl,
            privacyMode,
          )}"
          data-trade-id="${t.id}"
        >
          <circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="12" fill="transparent" />
          ${marker}
        </g>
      `;
    })
    .join("");

  return `
    <svg class="svg-scatter" viewBox="0 0 ${width} ${height}" role="img" aria-label="Trade scatter plot of duration versus ${
      metric === "r" ? "realized R" : "net P&L"
    }">
      ${gridLines}
      ${xTicks}
      <line x1="${pad.left}" y1="${zeroY.toFixed(1)}" x2="${width - pad.right}" y2="${zeroY.toFixed(
        1,
      )}" stroke="var(--baseline)" stroke-width="1.4" />
      ${dots}
      <text x="${pad.left + plotW / 2}" y="${height - 1}" text-anchor="middle" fill="var(--dim)" font-size="10" letter-spacing="0.06em">
        HOLDING DURATION (MINUTES)
      </text>
    </svg>
  `;
}

/** OHLC Candlestick chart for Trade Detail & Replay Modal */
export function renderCandlestickSVG(trade, visibleCount) {
  const { bars, entryBarIndex, exitBarIndex } = trade.replay;
  const shownCount = Math.max(1, Math.min(bars.length, visibleCount));

  const width = 760;
  const height = 290;
  const pad = { top: 24, right: 98, bottom: 30, left: 16 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;

  // Scale Y across entire replay window + stop + target so replay stays steady
  const pricePoints = [
    trade.avgEntry,
    trade.exitPrice,
    trade.stopLoss,
    trade.profitTarget,
    ...bars.flatMap((b) => [b.high, b.low]),
  ];
  const minPrice = Math.min(...pricePoints);
  const maxPrice = Math.max(...pricePoints);
  const padRange = Math.max(2, (maxPrice - minPrice) * 0.12);
  const yMin = minPrice - padRange;
  const yMax = maxPrice + padRange;

  const yAt = (price) => pad.top + ((yMax - price) / (yMax - yMin)) * plotH;
  const slotW = plotW / bars.length;
  const bodyW = Math.max(6, Math.min(18, slotW * 0.56));

  // Reference price lines (Target, Entry, Stop)
  const refLevels = [
    { label: "TGT", price: trade.profitTarget, color: "var(--profit)" },
    { label: "ENT", price: trade.avgEntry, color: "var(--fg)" },
    { label: "STP", price: trade.stopLoss, color: "var(--loss)" },
  ];
  const refYs = refLevels.map((lvl) => yAt(lvl.price));

  // Horizontal price grid (hide tick text when close to a reference pill)
  const yTicks = [0, 0.33, 0.66, 1]
    .map((t) => {
      const p = yMin + (yMax - yMin) * t;
      const y = yAt(p);
      const collides = refYs.some((ry) => Math.abs(ry - y) < 15);
      return `
        <line x1="${pad.left}" y1="${y.toFixed(1)}" x2="${width - pad.right}" y2="${y.toFixed(
          1,
        )}" stroke="var(--gridline)" stroke-width="1" stroke-dasharray="2 4" />
        ${
          collides
            ? ""
            : `<text x="${width - pad.right + 8}" y="${(y + 3.5).toFixed(
                1,
              )}" fill="var(--dim)" font-size="10" class="tabular-nums">${p.toFixed(2)}</text>`
        }
      `;
    })
    .join("");

  const refLines = refLevels
    .map((lvl) => {
      const y = yAt(lvl.price);
      return `
        <line x1="${pad.left}" y1="${y.toFixed(1)}" x2="${width - pad.right}" y2="${y.toFixed(
          1,
        )}" stroke="${lvl.color}" stroke-width="1.2" stroke-dasharray="5 4" stroke-opacity="0.78" />
        <rect x="${width - pad.right + 4}" y="${(y - 9).toFixed(
          1,
        )}" width="90" height="18" rx="4" fill="var(--popover)" stroke="${lvl.color}" stroke-opacity="0.45" />
        <text x="${width - pad.right + 10}" y="${(y + 3.5).toFixed(
          1,
        )}" fill="${lvl.color}" font-size="9.5" font-weight="700" class="tabular-nums">
          ${lvl.label} ${lvl.price.toFixed(2)}
        </text>
      `;
    })
    .join("");

  // Visible candlesticks
  const candles = bars
    .slice(0, shownCount)
    .map((bar, i) => {
      const cx = pad.left + i * slotW + slotW / 2;
      const isUp = bar.close >= bar.open;
      const color = isUp ? "var(--profit)" : "var(--loss)";
      const yHigh = yAt(bar.high);
      const yLow = yAt(bar.low);
      const yOpen = yAt(bar.open);
      const yClose = yAt(bar.close);
      const rectTop = Math.min(yOpen, yClose);
      const rectH = Math.max(2.5, Math.abs(yClose - yOpen));
      const isCurrent = i === shownCount - 1;

      return `
        <g class="candle-bar ${isCurrent ? "is-current" : ""}">
          ${
            isCurrent
              ? `<rect x="${(cx - slotW / 2 + 1).toFixed(1)}" y="${pad.top}" width="${(
                  slotW - 2
                ).toFixed(1)}" height="${plotH}" fill="var(--brand)" fill-opacity="0.08" rx="3" />`
              : ""
          }
          <line x1="${cx.toFixed(1)}" y1="${yHigh.toFixed(1)}" x2="${cx.toFixed(
            1,
          )}" y2="${yLow.toFixed(1)}" stroke="${color}" stroke-width="1.6" />
          <rect
            x="${(cx - bodyW / 2).toFixed(1)}"
            y="${rectTop.toFixed(1)}"
            width="${bodyW.toFixed(1)}"
            height="${rectH.toFixed(1)}"
            rx="1.5"
            fill="${color}"
          />
        </g>
      `;
    })
    .join("");

  // Entry and Exit markers once reached
  let markers = "";
  if (shownCount - 1 >= entryBarIndex) {
    const ex = pad.left + entryBarIndex * slotW + slotW / 2;
    const ey = yAt(trade.avgEntry);
    const isLong = trade.direction === "long";
    const tri = isLong
      ? `${ex.toFixed(1)},${(ey + 6).toFixed(1)} ${(ex - 6).toFixed(1)},${(ey + 16).toFixed(
          1,
        )} ${(ex + 6).toFixed(1)},${(ey + 16).toFixed(1)}`
      : `${ex.toFixed(1)},${(ey - 6).toFixed(1)} ${(ex - 6).toFixed(1)},${(ey - 16).toFixed(
          1,
        )} ${(ex + 6).toFixed(1)},${(ey - 16).toFixed(1)}`;
    markers += `
      <polygon points="${tri}" fill="var(--brand)" stroke="var(--bg)" stroke-width="1.2" />
      <text x="${ex.toFixed(1)}" y="${(isLong ? ey + 27 : ey - 20).toFixed(
        1,
      )}" text-anchor="middle" fill="var(--brand)" font-size="9.5" font-weight="700">
        ${isLong ? "BUY" : "SELL"}
      </text>
    `;
  }

  if (shownCount - 1 >= exitBarIndex) {
    const xx = pad.left + exitBarIndex * slotW + slotW / 2;
    const xy = yAt(trade.exitPrice);
    const exitColor = trade.netPnl >= 0 ? "var(--profit)" : "var(--loss)";
    markers += `
      <polygon
        points="${xx.toFixed(1)},${(xy - 7).toFixed(1)} ${(xx + 7).toFixed(1)},${xy.toFixed(
          1,
        )} ${xx.toFixed(1)},${(xy + 7).toFixed(1)} ${(xx - 7).toFixed(1)},${xy.toFixed(1)}"
        fill="${exitColor}"
        stroke="var(--bg)"
        stroke-width="1.4"
      />
      <text x="${xx.toFixed(1)}" y="${(xy - 12).toFixed(
        1,
      )}" text-anchor="middle" fill="${exitColor}" font-size="9.5" font-weight="700">EXIT</text>
    `;
  }

  // Time labels on bottom
  const timeMarks = [
    0,
    entryBarIndex,
    Math.floor((entryBarIndex + exitBarIndex) / 2),
    exitBarIndex,
    bars.length - 1,
  ]
    .map((idx) => {
      const cx = pad.left + idx * slotW + slotW / 2;
      return `<text x="${cx.toFixed(1)}" y="${height - 8}" text-anchor="middle" fill="var(--dim)" font-size="10" class="tabular-nums">${escapeHtml(
        bars[idx].timeLabel,
      )}</text>`;
    })
    .join("");

  return `
    <svg class="svg-candles" viewBox="0 0 ${width} ${height}" role="img" aria-label="OHLC candlestick replay chart for ${trade.symbol}">
      ${yTicks}
      ${refLines}
      ${candles}
      ${markers}
      ${timeMarks}
    </svg>
  `;
}
