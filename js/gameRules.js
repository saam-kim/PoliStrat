import { actionDefinitions, resourceLabels, strategicTileIndexes } from "./data.js?v=20260511-polistrat-flow12";

export function actionByName(name) {
  return actionDefinitions.find((action) => action.name === name);
}

export function isStrategicIndex(tileIndex) {
  return strategicTileIndexes.includes(Number(tileIndex));
}

export function activeCosts(action, tileIndex) {
  if (action.requiresTile && isStrategicIndex(tileIndex)) {
    return action.strategicCosts || action.costs || {};
  }
  return action.costs || {};
}

export function activeEffects(action, tileIndex) {
  return {
    ...(action.effects || {}),
    ...(action.requiresTile && isStrategicIndex(tileIndex) ? action.strategicEffects || {} : {})
  };
}

export function actionMessage(action, tileIndex) {
  if (typeof action.successText === "string") return action.successText;
  return action.requiresTile && isStrategicIndex(tileIndex)
    ? action.successText?.strategic
    : action.successText?.normal;
}

export function checkAction(action, team, tileIndex) {
  if (action.requiresTile && (tileIndex === null || tileIndex === undefined)) {
    return { ok: false, msg: `${action.name}은(는) 대상 타일을 먼저 선택해야 합니다.` };
  }

  const costs = activeCosts(action, tileIndex);
  for (const [field, amount] of Object.entries(costs)) {
    if ((team[field] || 0) < amount) {
      const label = resourceLabels[field] || action.costSmall || field;
      return { ok: false, msg: `${label}이 부족합니다. 필요 ${amount}, 현재 ${team[field] || 0}` };
    }
  }

  return { ok: true, msg: actionMessage(action, tileIndex) || `${action.name} 행동이 적용됩니다.` };
}

export function buildActionDelta(action, tileIndex) {
  const totals = {};

  Object.entries(activeCosts(action, tileIndex)).forEach(([field, amount]) => {
    totals[field] = (totals[field] || 0) - amount;
  });

  Object.entries(activeEffects(action, tileIndex)).forEach(([field, amount]) => {
    totals[field] = (totals[field] || 0) + amount;
  });

  return totals;
}

function formatDeltaList(values, multiplier) {
  const entries = Object.entries(values || {});
  if (!entries.length) return multiplier < 0 ? "소모 없음" : "효과 없음";

  return entries
    .map(([field, amount]) => {
      const delta = amount * multiplier;
      const label = resourceLabels[field] || field;
      return `${label} ${delta > 0 ? "+" : ""}${delta}`;
    })
    .join(", ");
}

export function formatActionEffects(action) {
  const normal = formatDeltaList(action.effects, 1);
  if (!action.strategicEffects) return normal;
  return `${normal}, ★핵심: ${formatDeltaList(action.strategicEffects, 1)}`;
}

export function formatActionCosts(action) {
  const normal = formatDeltaList(action.costs, -1);
  if (!action.strategicCosts) return normal;
  return `${normal} / ★핵심: ${formatDeltaList(action.strategicCosts, -1)}`;
}

export function formatDeltaSummary(delta) {
  const entries = Object.entries(delta || {}).filter(([, amount]) => amount !== 0);
  if (!entries.length) return "변화 없음";

  return entries
    .map(([field, amount]) => `${resourceLabels[field] || field} ${amount > 0 ? "+" : ""}${amount}`)
    .join(", ");
}
