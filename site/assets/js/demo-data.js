/**
 * Deterministic synthetic NQ/MNQ demo dataset & core analytics engine.
 * Pure vanilla ES module matching packages/core/src/metrics.ts,
 * packages/core/src/edge-score.ts, and apps/web/src/server/demo.ts.
 *
 * Notice: All records are synthetic, fictional, and read-only.
 */

import { formatMoney, formatProfitFactor, formatR, formatWinRate } from "./charts.js?v=1.2.0";

export const DEMO_ANCHOR_DATE = "2026-11-19";

export const DEMO_RULES = Object.freeze({
  startingBalance: 50_000,
  profitTarget: 3_000,
  dailyLossLimit: 500,
  softDailyStop: 300,
  trailingDrawdown: 2_000,
  maxMicros: 4,
  maxNq: 1,
  maxTradesPerDay: 2,
  maxRiskBeforeFees: 150,
});

export const DEMO_PLAYBOOK_RULES = Object.freeze([
  "Trade NQ or MNQ only; choose one directional bias for the session and wait for the opening range, a retest, or a VWAP reclaim/reject.",
  "Place the stop before entry; planned risk = contracts × stop points × $20 for NQ or $2 for MNQ, capped at $150 before fees.",
  "Use 1 NQ or 1–2 MNQ in this sample; the fictional account cap is 1 NQ or 4 MNQ.",
  "Take no more than 2 trades per session. Stop after 2 consecutive losses or a $300 realized loss; the separate fictional hard daily loss limit is $500.",
  "Never add to a losing position or widen a stop. Record any early exit and review it against the plan.",
  "Check the fictional $2,000 trailing drawdown and $3,000 profit target before each session; actual firms use different rules.",
]);

export const SETUPS = Object.freeze([
  { name: "Opening range pullback", tag: "setup: opening-range-pullback", winChance: 0.68 },
  { name: "VWAP reclaim/reject", tag: "setup: vwap-reclaim", winChance: 0.59 },
  { name: "Breakout retest", tag: "setup: breakout-retest", winChance: 0.54 },
]);

export const MISTAKE_META = Object.freeze({
  "late entry": {
    label: "Late entry",
    description:
      "Chased price after the trigger bar instead of waiting for the planned pullback level.",
  },
  "early exit": {
    label: "Early exit",
    description: "Closed a winning setup at ~0.75R before reaching the predefined profit target.",
  },
  "slipped stop": {
    label: "Slipped stop",
    description: "Stop fill executed ~12.5% beyond planned stop distance during fast tape.",
  },
});

export const EDGE_SCORE_WEIGHTS = Object.freeze({
  winRate: 15,
  profitFactor: 25,
  avgWinLoss: 20,
  drawdown: 15,
  recovery: 10,
  consistency: 15,
});

const MNQ_POINT_VALUE = 2;
const NQ_POINT_VALUE = 20;
const DEMO_SEED = 14621;
const TIME_ZONE = "America/New_York";

const roundToTick = (price) => Math.round(price * 4) / 4;
const roundMoney = (val) => Math.round(val * 100) / 100;
const clamp01 = (val) => Math.min(Math.max(val, 0), 1);

function createRng(seed) {
  let state = seed;
  return () => {
    state = (state * 1103515245 + 12345) % 2147483648;
    return state / 2147483648;
  };
}

function nySessionIso(dayDate, minutesAfterOpen, second) {
  const totalMinutes = 9 * 60 + 30 + minutesAfterOpen;
  const hour = Math.floor(totalMinutes / 60);
  const minute = totalMinutes % 60;
  const provisional = Date.UTC(
    dayDate.getUTCFullYear(),
    dayDate.getUTCMonth(),
    dayDate.getUTCDate(),
    hour,
    minute,
    second,
  );
  const parts = new Map(
    new Intl.DateTimeFormat("en-US", {
      timeZone: TIME_ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(new Date(provisional))
      .map((part) => [part.type, part.value]),
  );
  const observedWall = Date.UTC(
    Number(parts.get("year")),
    Number(parts.get("month")) - 1,
    Number(parts.get("day")),
    Number(parts.get("hour")),
    Number(parts.get("minute")),
    Number(parts.get("second")),
  );
  return new Date(provisional - (observedWall - provisional)).toISOString();
}

export function nyDayKey(isoString) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(isoString));
  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return `${map.year}-${map.month}-${map.day}`;
}

export function nyClockTime(isoString) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(isoString));
}

function buildReplayBars(trade, rand) {
  const barCount = 24;
  const entryIdx = 5;
  const exitIdx = 19;
  const sign = trade.direction === "long" ? 1 : -1;
  const totalSpanMs = Math.max(60_000, Date.parse(trade.closedAt) - Date.parse(trade.openedAt));
  const barDurationMs = Math.max(30_000, Math.round(totalSpanMs / (exitIdx - entryIdx)));
  const entryMs = Date.parse(trade.openedAt);

  const stopDist = Math.abs(trade.avgEntry - trade.stopLoss);
  const movePts = (trade.exitPrice - trade.avgEntry) * sign;
  const isWin = trade.netPnl > 0;

  // Path of mid-close offsets relative to entry (in direction-signed points)
  const signedAnchors = new Array(barCount).fill(0);
  for (let i = 0; i < barCount; i++) {
    if (i < entryIdx) {
      const distBack = entryIdx - i;
      signedAnchors[i] = -distBack * (stopDist * (0.18 + rand() * 0.14));
    } else if (i === entryIdx) {
      signedAnchors[i] = stopDist * 0.08;
    } else if (i < exitIdx) {
      const progress = (i - entryIdx) / (exitIdx - entryIdx);
      if (isWin) {
        const earlyDip =
          progress < 0.25
            ? -stopDist * (0.28 + rand() * 0.18) * Math.sin((progress / 0.25) * Math.PI)
            : 0;
        signedAnchors[i] =
          movePts * Math.pow(progress, 0.92) + earlyDip + (rand() - 0.5) * stopDist * 0.22;
      } else {
        const fakeOut =
          progress < 0.28
            ? stopDist * (0.3 + rand() * 0.2) * Math.sin((progress / 0.28) * Math.PI)
            : 0;
        signedAnchors[i] =
          movePts * Math.pow(progress, 1.1) + fakeOut + (rand() - 0.5) * stopDist * 0.2;
      }
    } else if (i === exitIdx) {
      signedAnchors[i] = movePts;
    } else {
      const postStep = i - exitIdx;
      signedAnchors[i] = movePts + (isWin ? 1 : -1) * postStep * stopDist * (0.08 + rand() * 0.12);
    }
  }

  const bars = [];
  let prevClose = roundToTick(trade.avgEntry + sign * signedAnchors[0] - sign * stopDist * 0.12);

  for (let i = 0; i < barCount; i++) {
    const tMs = entryMs + (i - entryIdx) * barDurationMs;
    const iso = new Date(tMs).toISOString();
    const targetClose = roundToTick(trade.avgEntry + sign * signedAnchors[i]);
    const open = prevClose;
    let close = targetClose;

    if (i === entryIdx) {
      close = roundToTick(trade.avgEntry + sign * Math.max(0.5, stopDist * 0.12));
    }
    if (i === exitIdx) {
      close = trade.exitPrice;
    }

    const bodyHigh = Math.max(open, close);
    const bodyLow = Math.min(open, close);
    const wickUp = Math.max(0.25, roundToTick(stopDist * (0.08 + rand() * 0.18)));
    const wickDown = Math.max(0.25, roundToTick(stopDist * (0.08 + rand() * 0.18)));

    let high = roundToTick(bodyHigh + wickUp);
    let low = roundToTick(bodyLow - wickDown);

    // Ensure entry bar encompasses entryPrice and exit bar encompasses exitPrice without crossing stop prematurely on wins
    if (i === entryIdx) {
      high = Math.max(high, trade.avgEntry);
      low = Math.min(low, trade.avgEntry);
    }
    if (i === exitIdx) {
      high = Math.max(high, trade.exitPrice);
      low = Math.min(low, trade.exitPrice);
    }
    if (isWin && i >= entryIdx && i <= exitIdx) {
      if (trade.direction === "long") {
        low = Math.max(low, roundToTick(trade.stopLoss + 0.5));
      } else {
        high = Math.min(high, roundToTick(trade.stopLoss - 0.5));
      }
    }

    const barPriceForUnrealized = i === exitIdx ? trade.exitPrice : close;
    const unrealizedGross =
      (barPriceForUnrealized - trade.avgEntry) * sign * trade.quantity * trade.pointValue;
    const unrealizedNet = roundMoney(unrealizedGross - (i >= entryIdx ? trade.fees : 0));

    bars.push({
      index: i,
      iso,
      timeLabel: nyClockTime(iso),
      open,
      high,
      low,
      close,
      unrealizedNet,
      isEntryBar: i === entryIdx,
      isExitBar: i === exitIdx,
    });

    prevClose = close;
  }

  // Compute realistic MAE & MFE across entry..exit bars
  let mae = 0;
  let mfe = 0;
  for (let i = entryIdx; i <= exitIdx; i++) {
    const b = bars[i];
    const favPrice = trade.direction === "long" ? b.high : b.low;
    const advPrice = trade.direction === "long" ? b.low : b.high;
    const favUsd = Math.max(
      0,
      (favPrice - trade.avgEntry) * sign * trade.quantity * trade.pointValue,
    );
    const advUsd = Math.min(
      0,
      (advPrice - trade.avgEntry) * sign * trade.quantity * trade.pointValue,
    );
    if (favUsd > mfe) mfe = favUsd;
    if (advUsd < mae) mae = advUsd;
  }

  const exitBar = bars[exitIdx];
  return {
    bars,
    entryBarIndex: entryIdx,
    exitBarIndex: exitIdx,
    mae: roundMoney(mae),
    mfe: roundMoney(mfe),
    captureEfficiency:
      mfe > 0 ? Math.max(0, Math.min(100, Math.round((trade.grossPnl / mfe) * 100))) : 0,
    exitTimeLabel: exitBar.timeLabel,
  };
}

function buildRuleChecks(trade) {
  return DEMO_PLAYBOOK_RULES.map((rule, index) => {
    let followed = true;
    if (index === 0 && trade.mistakes.includes("late entry")) {
      followed = false;
    } else if (
      index === 4 &&
      (trade.mistakes.includes("early exit") || trade.mistakes.includes("slipped stop"))
    ) {
      followed = false;
    }
    return { index: index + 1, rule, followed };
  });
}

function generateTrades() {
  const random = createRng(DEMO_SEED);
  const replayRandom = createRng(DEMO_SEED + 7919);
  const startOfRange = Date.UTC(2026, 9, 1); // Oct 1, 2026
  const endOfRange = Date.UTC(2026, 10, 19); // Nov 19, 2026
  const losingDay = "2026-10-14"; // 2nd Wednesday of Oct 2026
  const trades = [];

  for (let ts = startOfRange; ts <= endOfRange; ts += 86_400_000) {
    const day = new Date(ts);
    const weekday = day.getUTCDay();
    if (weekday === 0 || weekday === 6) continue;

    const dayKey = day.toISOString().slice(0, 10);
    const forcedLosingDay = dayKey === losingDay;
    const tradesToday = forcedLosingDay ? 2 : random() < 0.44 ? 2 : 1;
    let minute = 4 + Math.floor(random() * 18);
    let consecutiveLosses = 0;

    const daysIntoRange = (ts - startOfRange) / 86_400_000;
    const sessionReference = roundToTick(20_800 + daysIntoRange * 3 + random() * 34);
    const sessionLong = random() < 0.54;
    const symbol = random() < 0.28 ? "NQ" : "MNQ";
    const pointValue = symbol === "NQ" ? NQ_POINT_VALUE : MNQ_POINT_VALUE;
    const quantity = symbol === "NQ" ? 1 : 1 + Math.floor(random() * 2);
    const feePerSide = roundMoney(quantity * (symbol === "NQ" ? 2.5 : 0.62));

    for (let tNum = 0; tNum < tradesToday; tNum++) {
      const setup = SETUPS[Math.floor(random() * SETUPS.length)];
      const direction = sessionLong ? "long" : "short";
      const sign = sessionLong ? 1 : -1;
      const avgEntry = roundToTick(sessionReference + (random() - 0.5) * 28);
      const stopPoints =
        symbol === "NQ" ? 4 + Math.floor(random() * 3) : 8 + Math.floor(random() * 7);
      const targetPoints = roundToTick(stopPoints * (1.55 + random() * 0.55));
      const lateEntry = random() < 0.13;
      const adjustedWinChance = setup.winChance - (lateEntry ? 0.18 : 0);
      const wins = !forcedLosingDay && random() < adjustedWinChance;
      const earlyExit = wins && random() < 0.13;
      const slippedStop = !wins && random() < 0.16;

      const realizedPoints = wins
        ? earlyExit
          ? stopPoints * 0.75
          : targetPoints
        : -stopPoints * (slippedStop ? 1.125 : 1);

      const exitPrice = roundToTick(avgEntry + sign * realizedPoints);
      const holdMinutes = 5 + Math.floor(random() * 22);
      const openedAt = nySessionIso(day, minute, Math.floor(random() * 60));
      const closedAt = nySessionIso(day, minute + holdMinutes, Math.floor(random() * 60));

      const grossPnl = roundMoney(realizedPoints * quantity * pointValue);
      const fees = roundMoney(feePerSide * 2);
      const netPnl = roundMoney(grossPnl - fees);
      const status = netPnl > 0 ? "win" : netPnl < 0 ? "loss" : "breakeven";

      const stopLoss = roundToTick(avgEntry - sign * stopPoints);
      const profitTarget = roundToTick(avgEntry + sign * targetPoints);
      const plannedRisk = roundMoney(stopPoints * quantity * pointValue);
      const realizedR = plannedRisk > 0 ? roundMoney(netPnl / plannedRisk) : null;
      const plannedR = stopPoints > 0 ? roundMoney(targetPoints / stopPoints) : null;

      const mistakes = [];
      if (lateEntry) mistakes.push("late entry");
      if (earlyExit) mistakes.push("early exit");
      if (slippedStop) mistakes.push("slipped stop");

      const id = `TB-DEMO-${String(trades.length + 1).padStart(3, "0")}`;
      const entrySide = sessionLong ? "buy" : "sell";
      const exitSide = sessionLong ? "sell" : "buy";

      const reviewSections = [
        `PLAN: ${setup.name} (${direction.toUpperCase()}); entry ${avgEntry.toFixed(2)}, stop ${stopLoss.toFixed(2)}, target ${profitTarget.toFixed(2)}.`,
        `SESSION: ${symbol} (${quantity} contract${quantity === 1 ? "" : "s"}); session bias remained ${direction}.`,
        `RISK: ${quantity} ${symbol} × ${stopPoints} pts × $${pointValue}/pt = $${plannedRisk.toFixed(2)} planned risk before fees.`,
        `EXECUTION: ${mistakes.length ? `Review tag: ${mistakes.join(", ")}.` : "Entry and exit followed the written setup."} ${
          earlyExit
            ? "Position was closed at ~0.75R before hitting the planned target."
            : slippedStop
              ? "Stop fill includes simulated 12.5% tape slippage."
              : "Exit matched the planned stop or target zone."
        }`,
        `REVIEW: ${netPnl >= 0 ? "Positive result" : "Loss"} of ${netPnl >= 0 ? "+" : "-"}$${Math.abs(netPnl).toFixed(2)} net after $${fees.toFixed(2)} fees (${realizedR !== null ? `${realizedR >= 0 ? "+" : ""}${realizedR.toFixed(2)}R` : "—"}).`,
      ];

      const baseTrade = {
        id,
        key: id,
        symbol,
        direction,
        side: entrySide.toUpperCase(),
        quantity,
        pointValue,
        avgEntry,
        exitPrice,
        stopLoss,
        profitTarget,
        stopPoints,
        targetPoints,
        plannedRisk,
        plannedR,
        realizedR,
        grossPnl,
        fees,
        netPnl,
        status,
        openedAt,
        closedAt,
        dateKey: nyDayKey(closedAt),
        entryTime: nyClockTime(openedAt),
        exitTime: nyClockTime(closedAt),
        durationMs: holdMinutes * 60_000,
        durationMinutes: holdMinutes,
        setup: setup.name,
        setupTag: setup.tag,
        tags: [symbol, "prop-evaluation", "planned-risk", setup.tag],
        mistakes,
        rating: mistakes.length ? 3 : netPnl >= 0 ? 5 : 4,
        reviewed: true,
        notes: reviewSections,
        executions: [
          {
            id: `${id}-EX-1`,
            side: entrySide,
            quantity,
            price: avgEntry,
            fee: feePerSide,
            executedAt: openedAt,
            time: nyClockTime(openedAt),
          },
          {
            id: `${id}-EX-2`,
            side: exitSide,
            quantity,
            price: exitPrice,
            fee: feePerSide,
            executedAt: closedAt,
            time: nyClockTime(closedAt),
          },
        ],
      };

      const replay = buildReplayBars(baseTrade, replayRandom);
      baseTrade.replay = replay;
      baseTrade.ruleChecks = buildRuleChecks(baseTrade);

      trades.push(baseTrade);

      consecutiveLosses = netPnl > 0 ? 0 : consecutiveLosses + 1;
      if (consecutiveLosses >= 2) break;

      minute += holdMinutes + 8 + Math.floor(random() * 36);
      if (minute > 330) break;
    }
  }

  return trades;
}

function generateJournalDays(trades) {
  const byDay = new Map();
  for (const t of trades) {
    const list = byDay.get(t.dateKey) ?? [];
    list.push(t);
    byDay.set(t.dateKey, list);
  }

  const sessions = [];
  for (const [date, dayTrades] of [...byDay.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const netPnl = roundMoney(dayTrades.reduce((s, t) => s + t.netPnl, 0));
    const wins = dayTrades.filter((t) => t.status === "win").length;
    const losses = dayTrades.filter((t) => t.status === "loss").length;
    const mistakes = [...new Set(dayTrades.flatMap((t) => t.mistakes))];
    const primarySymbol = dayTrades[0].symbol;
    const bias = dayTrades[0].direction;
    const primarySetup = dayTrades[0].setup;

    let cum = 0;
    const intradayCurve = dayTrades.map((t) => {
      cum = roundMoney(cum + t.netPnl);
      return {
        t: t.closedAt,
        label: t.exitTime,
        cumNetPnl: cum,
      };
    });

    const plan = `Bias: ${bias.toUpperCase()} ${primarySymbol} after New York 09:30 open. Focus setup: ${primarySetup}. Max 2 trades, risk capped at $${DEMO_RULES.maxRiskBeforeFees} before fees, daily soft stop $${DEMO_RULES.softDailyStop}.`;

    const execution =
      mistakes.length > 0
        ? `Executed ${dayTrades.length} trade${dayTrades.length > 1 ? "s" : ""} (${wins}W / ${losses}L) for ${netPnl >= 0 ? "+" : "-"}$${Math.abs(netPnl).toFixed(2)} net. Flagged execution leak: ${mistakes.join(", ")}.`
        : `Clean execution across ${dayTrades.length} trade${dayTrades.length > 1 ? "s" : ""} (${wins}W / ${losses}L) for ${netPnl >= 0 ? "+" : "-"}$${Math.abs(netPnl).toFixed(2)} net. Respected stop placement and directional bias.`;

    const lesson = mistakes.includes("late entry")
      ? "Wait for price to touch the planned retracement zone—skipping late chases preserves expectancy."
      : mistakes.includes("early exit")
        ? "Hold winners to the pre-planned 1.5R–2.0R target unless structure breaks against the position."
        : mistakes.includes("slipped stop")
          ? "Avoid placing entries right ahead of 10:00 ET macro volatility spikes where stops can slip."
          : netPnl < 0
            ? "Session stopped cleanly within the daily risk cap; protect capital for tomorrow's A+ opening setup."
            : "Process followed cleanly: bias, stop distance, and position size matched the playbook.";

    sessions.push({
      date,
      trades: dayTrades,
      tradeCount: dayTrades.length,
      wins,
      losses,
      netPnl,
      bias,
      primarySymbol,
      mistakes,
      intradayCurve,
      plan,
      execution,
      lesson,
      focusScore: mistakes.length > 0 ? 3 : netPnl >= 0 ? 5 : 4,
    });
  }

  return sessions;
}

function generatePropLedger() {
  // Fictional USD prop-firm ledger inspired by apps/web/src/lib/prop-demo.ts
  const accounts = [
    {
      id: "prop-harbor-1",
      firm: "Harbor (Demo)",
      name: "Evaluation · attempt 1",
      program: "Evaluation",
      status: "Breached",
      sizeUsd: 50_000,
      openedOn: "2026-07-10",
      closedOn: "2026-08-02",
      splitPct: 90,
      note: "Fictional evaluation hit trailing drawdown during FOMC week.",
    },
    {
      id: "prop-harbor-2",
      firm: "Harbor (Demo)",
      name: "Evaluation · attempt 2",
      program: "Evaluation",
      status: "Passed",
      sizeUsd: 50_000,
      openedOn: "2026-08-05",
      closedOn: "2026-08-29",
      splitPct: 90,
      note: "Passed $3,000 target with 1–2 MNQ sizing and zero daily limit violations.",
    },
    {
      id: "prop-harbor-funded",
      firm: "Harbor (Demo)",
      name: "Funded · 50K",
      program: "Funded",
      status: "Active",
      sizeUsd: 50_000,
      openedOn: "2026-09-02",
      closedOn: null,
      splitPct: 90,
      note: "Active fictional funded account; 90% profit split after $15 wire fee.",
    },
    {
      id: "prop-summit-1",
      firm: "Summit (Demo)",
      name: "Evaluation · phase 1",
      program: "Evaluation",
      status: "Passed",
      sizeUsd: 100_000,
      openedOn: "2026-08-18",
      closedOn: "2026-09-14",
      splitPct: 80,
      note: "Fictional two-step challenge; initial evaluation fee refunded on first payout.",
    },
    {
      id: "prop-summit-funded",
      firm: "Summit (Demo)",
      name: "Funded · 100K",
      program: "Funded",
      status: "Active",
      sizeUsd: 100_000,
      openedOn: "2026-09-22",
      closedOn: null,
      splitPct: 80,
      note: "Active fictional 100K funded account with 80% split.",
    },
  ];

  const entries = [
    {
      id: "PF-01",
      date: "2026-07-10",
      accountId: "prop-harbor-1",
      firm: "Harbor (Demo)",
      accountName: "Evaluation · attempt 1",
      type: "expense",
      category: "Evaluation fee",
      reference: "SIM-HB-101",
      status: "Completed",
      grossAmount: 149.0,
      cashAmount: -149.0,
      note: "Fictional 50K evaluation purchase.",
    },
    {
      id: "PF-02",
      date: "2026-08-05",
      accountId: "prop-harbor-2",
      firm: "Harbor (Demo)",
      accountName: "Evaluation · attempt 2",
      type: "expense",
      category: "Reset fee",
      reference: "SIM-HB-108",
      status: "Completed",
      grossAmount: 99.0,
      cashAmount: -99.0,
      note: "Fictional reset after attempt 1 breach.",
    },
    {
      id: "PF-03",
      date: "2026-08-18",
      accountId: "prop-summit-1",
      firm: "Summit (Demo)",
      accountName: "Evaluation · phase 1",
      type: "expense",
      category: "Evaluation fee",
      reference: "SIM-SM-201",
      status: "Completed",
      grossAmount: 450.0,
      cashAmount: -450.0,
      note: "Fictional 100K two-phase challenge fee.",
    },
    {
      id: "PF-04",
      date: "2026-09-02",
      accountId: "prop-harbor-funded",
      firm: "Harbor (Demo)",
      accountName: "Funded · 50K",
      type: "expense",
      category: "Activation",
      reference: "SIM-HB-114",
      status: "Completed",
      grossAmount: 149.0,
      cashAmount: -149.0,
      note: "Fictional funded activation fee.",
    },
    {
      id: "PF-05",
      date: "2026-09-18",
      accountId: "prop-harbor-funded",
      firm: "Harbor (Demo)",
      accountName: "Funded · 50K",
      type: "payout",
      category: "Payout receipt",
      reference: "SIM-PAY-301",
      status: "Completed",
      grossAmount: 950.0,
      cashAmount: 840.0,
      note: "90% split ($855) minus $15 simulated transfer fee.",
    },
    {
      id: "PF-06",
      date: "2026-10-01",
      accountId: "prop-harbor-funded",
      firm: "Harbor (Demo)",
      accountName: "Funded · 50K",
      type: "expense",
      category: "Market data",
      reference: "SIM-HB-122",
      status: "Completed",
      grossAmount: 49.0,
      cashAmount: -49.0,
      note: "Monthly CME L1/platform bundle.",
    },
    {
      id: "PF-07",
      date: "2026-10-09",
      accountId: "prop-summit-1",
      firm: "Summit (Demo)",
      accountName: "Evaluation · phase 1",
      type: "refund",
      category: "Fee refund",
      reference: "SIM-SM-209",
      status: "Completed",
      grossAmount: 450.0,
      cashAmount: 450.0,
      note: "Refunded evaluation fee upon funded verification.",
    },
    {
      id: "PF-08",
      date: "2026-10-16",
      accountId: "prop-summit-funded",
      firm: "Summit (Demo)",
      accountName: "Funded · 100K",
      type: "payout",
      category: "Payout receipt",
      reference: "SIM-PAY-304",
      status: "Completed",
      grossAmount: 1200.0,
      cashAmount: 960.0,
      note: "80% split received.",
    },
    {
      id: "PF-09",
      date: "2026-10-28",
      accountId: "prop-harbor-funded",
      firm: "Harbor (Demo)",
      accountName: "Funded · 50K",
      type: "payout",
      category: "Payout receipt",
      reference: "SIM-PAY-310",
      status: "Completed",
      grossAmount: 1000.0,
      cashAmount: 850.0,
      note: "90% split ($900) minus $10 wire and $40 fee adjustment.",
    },
    {
      id: "PF-10",
      date: "2026-11-01",
      accountId: "prop-harbor-funded",
      firm: "Harbor (Demo)",
      accountName: "Funded · 50K",
      type: "expense",
      category: "Market data",
      reference: "SIM-HB-131",
      status: "Completed",
      grossAmount: 49.0,
      cashAmount: -49.0,
      note: "Monthly CME L1/platform bundle.",
    },
    {
      id: "PF-11",
      date: "2026-11-11",
      accountId: "prop-harbor-funded",
      firm: "Harbor (Demo)",
      accountName: "Funded · 50K",
      type: "payout",
      category: "Partial payout",
      reference: "SIM-PAY-318",
      status: "Approved",
      grossAmount: 1250.0,
      cashAmount: 450.0,
      note: "Partial tranche received ($450 of $1,110 expected).",
    },
    {
      id: "PF-12",
      date: "2026-11-17",
      accountId: "prop-summit-funded",
      firm: "Summit (Demo)",
      accountName: "Funded · 100K",
      type: "payout",
      category: "Payout request",
      reference: "SIM-PAY-324",
      status: "Requested",
      grossAmount: 800.0,
      cashAmount: 0.0,
      note: "Awaiting review; $0 cash received yet.",
    },
  ];

  return { accounts, entries };
}

export function generateDemoDataset() {
  const trades = generateTrades();
  const journalDays = generateJournalDays(trades);
  const propLedger = generatePropLedger();
  return {
    account: {
      name: "NQ / MNQ Prop Evaluation · Demo",
      currency: "USD",
      initialBalance: DEMO_RULES.startingBalance,
      trailingDrawdown: DEMO_RULES.trailingDrawdown,
      profitTarget: DEMO_RULES.profitTarget,
    },
    trades,
    journalDays,
    propLedger,
  };
}

export function filterTrades(trades, { range = "all", symbol = "ALL" } = {}) {
  const anchorMs = Date.parse(`${DEMO_ANCHOR_DATE}T23:59:59Z`);
  let cutoffDays = null;
  if (range === "7d") cutoffDays = 7;
  else if (range === "30d") cutoffDays = 30;
  else if (range === "90d") cutoffDays = 90;

  return trades.filter((t) => {
    if (symbol && symbol !== "ALL" && t.symbol !== symbol) return false;
    if (cutoffDays !== null) {
      const closedMs = Date.parse(t.closedAt);
      const diffDays = (anchorMs - closedMs) / 86_400_000;
      if (diffDays > cutoffDays) return false;
    }
    return true;
  });
}

export function dailyStats(trades) {
  const closed = [...trades].sort((a, b) => Date.parse(a.closedAt) - Date.parse(b.closedAt));
  const map = new Map();
  for (const t of closed) {
    let day = map.get(t.dateKey);
    if (!day) {
      day = {
        date: t.dateKey,
        netPnl: 0,
        grossPnl: 0,
        fees: 0,
        trades: 0,
        wins: 0,
        losses: 0,
        breakevens: 0,
        volume: 0,
      };
      map.set(t.dateKey, day);
    }
    day.netPnl = roundMoney(day.netPnl + t.netPnl);
    day.grossPnl = roundMoney(day.grossPnl + t.grossPnl);
    day.fees = roundMoney(day.fees + t.fees);
    day.trades += 1;
    day.volume += t.quantity;
    if (t.status === "win") day.wins += 1;
    else if (t.status === "loss") day.losses += 1;
    else day.breakevens += 1;
  }
  return [...map.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export function equityCurve(trades) {
  const ordered = [...trades].sort(
    (a, b) => Date.parse(a.closedAt) - Date.parse(b.closedAt) || a.id.localeCompare(b.id),
  );
  let cum = 0;
  return ordered.map((t, index) => {
    cum = roundMoney(cum + t.netPnl);
    return {
      index: index + 1,
      id: t.id,
      symbol: t.symbol,
      date: t.dateKey,
      t: t.closedAt,
      pnl: t.netPnl,
      cumNetPnl: cum,
    };
  });
}

function mean(values) {
  if (!values.length) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function sampleStdDev(values, avg) {
  if (values.length < 2) return null;
  const variance = values.reduce((sum, v) => sum + (v - avg) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function computeMetrics(trades, initialBalance = DEMO_RULES.startingBalance) {
  const closed = [...trades].sort(
    (a, b) => Date.parse(a.closedAt) - Date.parse(b.closedAt) || a.id.localeCompare(b.id),
  );
  const wins = closed.filter((t) => t.status === "win");
  const losses = closed.filter((t) => t.status === "loss");
  const breakevens = closed.filter((t) => t.status === "breakeven");

  const days = dailyStats(closed);
  const curve = equityCurve(closed);

  const grossProfit = closed.reduce((total, t) => total + Math.max(0, t.netPnl), 0);
  const grossLoss = closed.reduce((total, t) => total - Math.min(0, t.netPnl), 0);
  const netPnl = roundMoney(closed.reduce((total, t) => total + t.netPnl, 0));
  const grossPnl = roundMoney(closed.reduce((total, t) => total + t.grossPnl, 0));
  const fees = roundMoney(closed.reduce((total, t) => total + t.fees, 0));

  const winningDays = days.filter((d) => d.netPnl > 0).length;

  let maxWinStreak = 0;
  let maxLossStreak = 0;
  let run = 0;
  for (const t of closed) {
    if (t.status === "breakeven") continue;
    const dir = t.status === "win" ? 1 : -1;
    run = Math.sign(run) === dir ? run + dir : dir;
    if (run > maxWinStreak) maxWinStreak = run;
    if (-run > maxLossStreak) maxLossStreak = -run;
  }

  // Drawdown matching packages/core/src/equity.ts
  let peak = 0;
  let maxDrawdown = 0;
  let maxDrawdownPct = null;
  for (const pt of curve) {
    if (pt.cumNetPnl > peak) peak = pt.cumNetPnl;
    const dd = peak - pt.cumNetPnl;
    if (dd > maxDrawdown) {
      maxDrawdown = dd;
      const base = initialBalance + peak;
      maxDrawdownPct = base > 0 ? dd / base : null;
    }
  }
  maxDrawdown = roundMoney(maxDrawdown);

  const avgWin = mean(wins.map((t) => t.netPnl));
  const avgLoss = mean(losses.map((t) => Math.abs(t.netPnl)));
  const winRate = closed.length > 0 ? wins.length / closed.length : null;
  const avgWinLossRatio =
    avgWin !== null && avgLoss !== null && avgLoss > 0 ? avgWin / avgLoss : null;

  const dayProfits = days.filter((d) => d.netPnl > 0).map((d) => d.netPnl);
  const totalDayProfit = dayProfits.reduce((s, v) => s + v, 0);
  const profitConcentration = totalDayProfit > 0 ? Math.max(...dayProfits) / totalDayProfit : null;

  const rMultiples = closed.map((t) => t.realizedR).filter((r) => r !== null);
  const dailyPnLs = days.map((d) => d.netPnl);
  const avgDailyPnl = mean(dailyPnLs) ?? 0;
  const dailyStdDev = sampleStdDev(dailyPnLs, avgDailyPnl);
  const sharpeRatio =
    dailyStdDev !== null && dailyStdDev > 0 ? (avgDailyPnl / dailyStdDev) * Math.sqrt(252) : null;

  const negativeDaily = dailyPnLs.map((p) => Math.min(0, p));
  const downsideDeviation = Math.sqrt(
    negativeDaily.reduce((sum, v) => sum + v ** 2, 0) / (days.length || 1),
  );
  const sortinoRatio =
    downsideDeviation > 0 ? (avgDailyPnl / downsideDeviation) * Math.sqrt(252) : null;

  const rMean = mean(rMultiples);
  const rStdDev = rMean !== null ? sampleStdDev(rMultiples, rMean) : null;
  const sqn =
    rMultiples.length >= 2 && rMean !== null && rStdDev !== null && rStdDev > 0
      ? Math.sqrt(rMultiples.length) * (rMean / rStdDev)
      : null;

  return {
    totalTrades: closed.length,
    closedTrades: closed.length,
    wins: wins.length,
    losses: losses.length,
    breakevens: breakevens.length,
    netPnl,
    grossPnl,
    grossProfit: roundMoney(grossProfit),
    grossLoss: roundMoney(grossLoss),
    fees,
    winRate,
    dayWinRate: days.length > 0 ? winningDays / days.length : null,
    tradingDays: days.length,
    profitFactor: closed.length === 0 ? null : grossLoss > 0 ? grossProfit / grossLoss : null,
    profitFactorIsInfinite: closed.length > 0 && grossLoss === 0 && grossProfit > 0,
    avgWin,
    avgLoss,
    avgWinLossRatio,
    expectancy: closed.length > 0 ? netPnl / closed.length : null,
    largestWin: wins.reduce((max, t) => Math.max(max, t.netPnl), 0),
    largestLoss: losses.reduce((min, t) => Math.min(min, t.netPnl), 0),
    maxWinStreak,
    maxLossStreak,
    currentStreak: run,
    totalVolume: closed.reduce((s, t) => s + t.quantity, 0),
    avgDurationMs: mean(closed.map((t) => t.durationMs)),
    maxDrawdown,
    maxDrawdownPct,
    recoveryFactor: maxDrawdown > 0 ? netPnl / maxDrawdown : null,
    profitConcentration,
    avgRealizedR: rMean,
    medianRealizedR: median(rMultiples),
    sqn,
    sharpeRatio,
    sortinoRatio,
    days,
    curve,
  };
}

/** Exact port of packages/core/src/edge-score.ts (EDGE_SCORE_VERSION = 2) */
export function computeEdgeScore(metrics) {
  const winRate = clamp01((metrics.winRate ?? 0) / 0.6) * 100;
  const pf = metrics.profitFactorIsInfinite ? 3 : (metrics.profitFactor ?? 0);
  const profitFactor = clamp01(pf / 3) * 100;
  const avgWinLoss = clamp01((metrics.avgWinLossRatio ?? 0) / 2.5) * 100;
  const ddPct = metrics.maxDrawdownPct;
  const drawdown = ddPct === null ? 50 : (1 - clamp01(ddPct / 0.25)) * 100;
  const recovery =
    metrics.maxDrawdown > 0
      ? clamp01((metrics.recoveryFactor ?? 0) / 3) * 100
      : metrics.netPnl > 0
        ? 100
        : 0;
  const concentration = metrics.profitConcentration;
  const consistency =
    concentration === null
      ? 0
      : concentration <= 0.15
        ? 100
        : (1 - clamp01((concentration - 0.15) / 0.85)) * 100;

  const components = {
    winRate,
    profitFactor,
    avgWinLoss,
    drawdown,
    recovery,
    consistency,
  };

  const totalWeight = Object.values(EDGE_SCORE_WEIGHTS).reduce((a, b) => a + b, 0);
  const weighted =
    Object.entries(components).reduce(
      (total, [key, value]) => total + value * EDGE_SCORE_WEIGHTS[key],
      0,
    ) / totalWeight;

  return {
    version: 2,
    score: metrics.closedTrades >= 5 ? Math.round(weighted * 100) / 100 : null,
    components,
    closedTrades: metrics.closedTrades,
  };
}

export function computeBreakdownBySetup(trades) {
  return SETUPS.map((setupDef) => {
    const subset = trades.filter((t) => t.setup === setupDef.name);
    const m = computeMetrics(subset);
    return {
      setup: setupDef.name,
      tag: setupDef.tag,
      trades: m.closedTrades,
      wins: m.wins,
      losses: m.losses,
      winRate: m.winRate,
      profitFactor: m.profitFactor,
      profitFactorIsInfinite: m.profitFactorIsInfinite,
      avgR: m.avgRealizedR,
      netPnl: m.netPnl,
    };
  }).sort((a, b) => b.netPnl - a.netPnl);
}

export function computeMistakeImpact(trades) {
  return Object.entries(MISTAKE_META).map(([key, meta]) => {
    const tagged = trades.filter((t) => t.mistakes.includes(key));
    const netPnl = roundMoney(tagged.reduce((s, t) => s + t.netPnl, 0));
    const lossesOnly = roundMoney(tagged.reduce((s, t) => s + Math.max(0, -t.netPnl), 0));
    const wins = tagged.filter((t) => t.status === "win").length;
    const avgR = mean(tagged.map((t) => t.realizedR).filter((r) => r !== null));
    const extraSlipCost =
      key === "slipped stop"
        ? roundMoney(
            tagged.reduce((s, t) => s + t.stopPoints * 0.125 * t.quantity * t.pointValue, 0),
          )
        : key === "early exit"
          ? roundMoney(
              tagged.reduce(
                (s, t) =>
                  s +
                  Math.max(0, (t.targetPoints - t.stopPoints * 0.75) * t.quantity * t.pointValue),
                0,
              ),
            )
          : lossesOnly;

    return {
      key,
      label: meta.label,
      description: meta.description,
      count: tagged.length,
      winRate: tagged.length > 0 ? wins / tagged.length : null,
      netPnl,
      lossesCost: lossesOnly,
      opportunityOrSlipCost: extraSlipCost,
      avgR,
    };
  });
}

export function computeRuleAdherence(trades) {
  return DEMO_PLAYBOOK_RULES.map((rule, idx) => {
    const ruleIndex = idx + 1;
    let followedCount = 0;
    for (const t of trades) {
      const check = t.ruleChecks.find((r) => r.index === ruleIndex);
      if (!check || check.followed) followedCount += 1;
    }
    const pct = trades.length > 0 ? Math.round((followedCount / trades.length) * 1000) / 10 : 100;
    return {
      index: ruleIndex,
      rule,
      followedCount,
      totalCount: trades.length,
      pct,
    };
  });
}

export function buildCalendarMonth(trades, year, month) {
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const prefix = `${year}-${String(month).padStart(2, "0")}`;
  const monthTrades = trades.filter((t) => t.dateKey.startsWith(prefix));
  const statsByDay = new Map(dailyStats(monthTrades).map((d) => [d.date, d]));

  const firstWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay(); // 0=Sun..6=Sat
  const weeks = [];
  let currentWeek = new Array(7).fill(null);

  for (let dayNum = 1; dayNum <= daysInMonth; dayNum++) {
    const dateStr = `${prefix}-${String(dayNum).padStart(2, "0")}`;
    const wd = (firstWeekday + dayNum - 1) % 7;
    const stat = statsByDay.get(dateStr) ?? null;
    currentWeek[wd] = {
      dayNum,
      date: dateStr,
      stat,
    };
    if (wd === 6 || dayNum === daysInMonth) {
      const weekNet = roundMoney(
        currentWeek.reduce((s, cell) => s + (cell && cell.stat ? cell.stat.netPnl : 0), 0),
      );
      const weekTrades = currentWeek.reduce(
        (s, cell) => s + (cell && cell.stat ? cell.stat.trades : 0),
        0,
      );
      weeks.push({
        days: currentWeek,
        netPnl: weekNet,
        trades: weekTrades,
      });
      currentWeek = new Array(7).fill(null);
    }
  }

  const activeDays = [...statsByDay.values()].sort((a, b) => a.date.localeCompare(b.date));
  const greenDays = activeDays.filter((d) => d.netPnl > 0);
  const redDays = activeDays.filter((d) => d.netPnl < 0);
  const totalTrades = activeDays.reduce((s, d) => s + d.trades, 0);
  const totalWins = activeDays.reduce((s, d) => s + d.wins, 0);
  const netPnl = roundMoney(activeDays.reduce((s, d) => s + d.netPnl, 0));

  const weekdayTotals = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((label, idx) => {
    const matching = activeDays.filter((d) => new Date(`${d.date}T12:00:00Z`).getUTCDay() === idx);
    return {
      label,
      trades: matching.reduce((s, d) => s + d.trades, 0),
      netPnl: roundMoney(matching.reduce((s, d) => s + d.netPnl, 0)),
    };
  });
  const topWeekday = [...weekdayTotals].sort((a, b) => b.netPnl - a.netPnl)[0] ?? null;

  return {
    year,
    month,
    label: new Date(Date.UTC(year, month - 1, 15)).toLocaleString("en-US", {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }),
    weeks,
    activeDays,
    insights: {
      netPnl,
      tradingDays: activeDays.length,
      greenDays: greenDays.length,
      redDays: redDays.length,
      totalTrades,
      winRate: totalTrades > 0 ? totalWins / totalTrades : null,
      profitableDayRate: activeDays.length > 0 ? greenDays.length / activeDays.length : null,
      bestDay: activeDays.reduce((best, d) => (!best || d.netPnl > best.netPnl ? d : best), null),
      worstDay: activeDays.reduce(
        (worst, d) => (!worst || d.netPnl < worst.netPnl ? d : worst),
        null,
      ),
      topWeekday: topWeekday && topWeekday.trades > 0 ? topWeekday : null,
    },
  };
}

export function computePropSummary(propLedger) {
  let spent = 0;
  let refunds = 0;
  let received = 0;
  let pendingPayouts = 0;

  for (const row of propLedger.entries) {
    if (row.type === "expense") spent += Math.abs(row.cashAmount);
    else if (row.type === "refund") refunds += row.cashAmount;
    else if (row.type === "payout") {
      received += row.cashAmount;
      if (row.status === "Approved" || row.status === "Requested") {
        pendingPayouts += Math.max(0, row.grossAmount * 0.85 - row.cashAmount);
      }
    }
  }

  const netSpend = roundMoney(spent - refunds);
  const netCashFlow = roundMoney(received - netSpend);
  const cashRoi = netSpend > 0 ? netCashFlow / netSpend : null;

  return {
    spent: roundMoney(spent),
    refunds: roundMoney(refunds),
    netSpend,
    received: roundMoney(received),
    pendingPayouts: roundMoney(pendingPayouts),
    netCashFlow,
    cashRoi,
  };
}

export function computeAiBriefing(trades, metrics, edgeScore) {
  if (!trades.length) {
    return {
      performanceRead: "No trades match the active timeframe and symbol filter.",
      setupPattern: "Reset filters to inspect setup expectancy and win rates across NQ and MNQ.",
      riskExecution: "Risk metrics require at least 1 closed trade in scope.",
      nextReview: "Switch timeframe back to All or 30D to evaluate session discipline.",
    };
  }

  const setups = computeBreakdownBySetup(trades).filter((s) => s.trades > 0);
  const topSetup = setups[0];
  const weakSetup = setups[setups.length - 1];
  const mistakes = computeMistakeImpact(trades);
  const late = mistakes.find((m) => m.key === "late entry");
  const early = mistakes.find((m) => m.key === "early exit");
  const ddBuffer = roundMoney(DEMO_RULES.trailingDrawdown - metrics.maxDrawdown);
  const targetRemaining = roundMoney(DEMO_RULES.profitTarget - metrics.netPnl);

  const pfText = formatProfitFactor(metrics);
  const wrText = formatWinRate(metrics.winRate);
  const avgRText = formatR(metrics.avgRealizedR);
  const fmtUsd = (val, signed = false) => formatMoney(val, false, { signed });

  const performanceRead = `${metrics.closedTrades} closed trades produced ${fmtUsd(
    metrics.netPnl,
    true,
  )} net (${wrText} win rate, ${pfText} profit factor, ${avgRText} avg R)${
    edgeScore.score !== null ? `, scoring ${edgeScore.score.toFixed(1)}/100 on Edge Score v2.` : "."
  }`;

  const setupPattern = topSetup
    ? `${topSetup.setup} leads with ${fmtUsd(topSetup.netPnl, true)} across ${topSetup.trades} trades (${(
        (topSetup.winRate ?? 0) * 100
      ).toFixed(1)}% win rate).${
        weakSetup && weakSetup.setup !== topSetup.setup
          ? ` ${weakSetup.setup} trails at ${fmtUsd(weakSetup.netPnl, true)} over ${weakSetup.trades} trades.`
          : ""
      }`
    : "Only one setup is present in this filter.";

  const riskExecution = `Max drawdown stayed at ${fmtUsd(metrics.maxDrawdown)} — preserving ${fmtUsd(
    Math.max(0, ddBuffer),
  )} inside the fictional $2,000.00 trailing drawdown limit. ${
    targetRemaining > 0
      ? `${fmtUsd(targetRemaining)} remains toward the $3,000.00 target.`
      : "Sample net P&L has cleared the $3,000.00 fictional target."
  }`;

  const nextReview =
    late && late.count > 0
      ? `Focus next review on the ${late.count} late-entry execution${
          late.count > 1 ? "s" : ""
        } ($${late.lossesCost.toFixed(2)} realized loss) and ${
          early && early.count > 0
            ? `the ${early.count} early exit${early.count > 1 ? "s" : ""} that left $${early.opportunityOrSlipCost.toFixed(
                2,
              )} on the table.`
            : "confirming retracement fill discipline."
        }`
      : "Rule compliance is high in this slice; inspect your largest losing session in Calendar to verify stop placement.";

  return { performanceRead, setupPattern, riskExecution, nextReview };
}

export function answerAiPrompt(promptKey, trades, metrics, edgeScore, maskMoneyFn) {
  if (!trades.length) {
    return {
      title: "Insufficient filtered records",
      body: "Zero closed trades match the current filter. Broaden the timeframe or symbol to cite execution metrics.",
      citations: ["0 trades in scope"],
    };
  }

  const money = maskMoneyFn || ((v) => formatMoney(v, false, { signed: true }));
  const setups = computeBreakdownBySetup(trades).filter((s) => s.trades > 0);
  const mistakes = computeMistakeImpact(trades);
  const adherence = computeRuleAdherence(trades);

  if (promptKey === "best-setup") {
    const best = setups[0];
    const second = setups[1];
    const pfStr = formatProfitFactor(best);
    return {
      title: `Best Setup Edge: ${best.setup}`,
      body: `${best.setup} delivered ${money(best.netPnl)} across ${best.trades} trades (${formatWinRate(
        best.winRate,
      )} win rate, PF ${pfStr}, ${formatR(best.avgR)} avg R).${
        second
          ? ` By comparison, ${second.setup} generated ${money(second.netPnl)} across ${second.trades} trades.`
          : ""
      }`,
      citations: [
        `${best.trades} ${best.setup} trades`,
        `Win rate ${formatWinRate(best.winRate)}`,
        `Expectancy ${money(best.netPnl / best.trades)}/trade`,
      ],
    };
  }

  if (promptKey === "mistake-cost") {
    const late = mistakes.find((m) => m.key === "late entry");
    const early = mistakes.find((m) => m.key === "early exit");
    const slip = mistakes.find((m) => m.key === "slipped stop");
    const totalTagged = trades.filter((t) => t.mistakes.length > 0).length;
    const cleanTrades = trades.filter((t) => t.mistakes.length === 0);
    const cleanPnl = cleanTrades.reduce((s, t) => s + t.netPnl, 0);

    return {
      title: "Quantified Cost of Tagged Mistakes",
      body: `${totalTagged} of ${trades.length} filtered trades carried a mistake tag. Late entries (${
        late.count
      } trades) cost ${money(-late.lossesCost)} in realized losses; early exits (${
        early.count
      } trades) forfeited ~${money(early.opportunityOrSlipCost).replace("+", "")} vs full target; slipped stops (${
        slip.count
      } trades) added ~${money(-slip.opportunityOrSlipCost)} of slippage. Mistake-free trades (${
        cleanTrades.length
      }) netted ${money(cleanPnl)}.`,
      citations: [
        `${late.count} late entries`,
        `${early.count} early exits`,
        `${slip.count} slipped stops`,
        `Clean trades: ${money(cleanPnl)}`,
      ],
    };
  }

  // rule-compliance
  const avgCompliance = adherence.reduce((s, r) => s + r.pct, 0) / Math.max(1, adherence.length);
  const weakRules = adherence.filter((r) => r.pct < 100);
  const ddText = money(-metrics.maxDrawdown).replace("-", "");
  return {
    title: "Playbook Rule Compliance Readout",
    body: `Average adherence across the 6 NQ/MNQ rules is ${avgCompliance.toFixed(1)}% (${
      trades.length
    } trades). Sizing (≤1 NQ / ≤2 MNQ) and daily trade cap (≤2/session) held at 100.0%, keeping max drawdown at ${ddText}. ${
      weakRules.length
        ? `Exceptions concentrated in Rule #${weakRules.map((r) => r.index).join(" & #")} (${weakRules
            .map((r) => `${r.pct.toFixed(1)}%`)
            .join(", ")}).`
        : "Zero rule breaks occurred in this filtered slice."
    }`,
    citations: [
      `Avg compliance ${avgCompliance.toFixed(1)}%`,
      `Edge Score ${edgeScore.score !== null ? edgeScore.score.toFixed(1) : "N/A"}`,
      `Max DD ${ddText}`,
    ],
  };
}
