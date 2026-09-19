export function validateSettings(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Invalid trading settings.');
  for (const key of ['amountUsd', 'maxDeployedUsd', 'maxPositions']) {
    if (!['number', 'string'].includes(typeof input[key]) || String(input[key]).trim() === '') throw new Error('Enter an amount and position limit.');
  }
  const amountUsd = Number(input.amountUsd), maxDeployedUsd = Number(input.maxDeployedUsd), maxPositions = Number(input.maxPositions);
  for (const n of [amountUsd, maxDeployedUsd]) if (!Number.isFinite(n) || n < 1 || n > 1000000 || Math.abs(n * 100 - Math.round(n * 100)) > 0.000001) throw new Error('Choose a dollar amount from $1 to $1,000,000, with no more than two decimal places.');
  if (maxDeployedUsd < amountUsd) throw new Error('Total trading capital must cover at least one trade.');
  if (!Number.isInteger(maxPositions) || maxPositions < 1 || maxPositions > 20) throw new Error('Choose between 1 and 20 open positions.');
  return { amountUsd, maxDeployedUsd, maxPositions };
}
// Free-form research can mention an index, percentage, range, or unrelated
// price. Only an unambiguous scalar USD price is usable for this estimate.
export function dollarLevel(text) {
  if (typeof text !== 'string' || !/^\s*\$?\s*(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?\s*(?:USD)?\s*$/i.test(text)) return null;
  const n = Number(text.replace(/USD|[$,\s]/gi, ''));
  return Number.isFinite(n) && n > 0 ? n : null;
}
export function estimateOutcome(plan, amount, outcome) {
  if (!['target', 'stop'].includes(outcome)) return null;
  if (!plan || !['spot','shares'].includes(plan.instrument) || plan.side !== 'long') return null;
  const entry = Number(plan.entryPrice), exit = dollarLevel(outcome === 'target' ? plan.target : plan.stop);
  if (!Number.isFinite(entry) || entry <= 0 || !Number.isFinite(amount) || amount <= 0 || !exit) return null;
  if (outcome === 'target' ? exit <= entry : exit >= entry) return null;
  return { pnl: amount * (exit / entry - 1), exit, amount, entry };
}
export const usd = value => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(value);
