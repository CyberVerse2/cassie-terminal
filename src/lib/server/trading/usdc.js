import { BASE_USDC } from './authorization.js';
import { EVM_CHAINS } from './asset-directory.js';

export const BASE_USDC_MARKET = { chain: 'base', address: BASE_USDC, decimals: 6 };

function addr(value) {
  return String(value ?? '').toLowerCase();
}

function dollars(amount) {
  return `$${Number(amount).toFixed(Number(amount) % 1 ? 2 : 0)}`;
}

export function usdcAmount(balances, market) {
  if (!market?.chain || !/^0x[a-f0-9]{40}$/i.test(market.address ?? '')) return 0;
  return (balances ?? []).reduce((sum, row) => {
    if (row.chain !== market.chain || addr(row.address) !== addr(market.address)) return sum;
    const held = Number(row.balance);
    return sum + (Number.isFinite(held) ? held : 0);
  }, 0);
}

export function evmUsdcCash(balances) {
  return (balances ?? []).reduce((sum, row) => {
    if (!(row.chain in EVM_CHAINS)) return sum;
    const symbol = String(row.symbol ?? row.ticker ?? '').toUpperCase();
    if (symbol !== 'USDC' && !(row.chain === 'base' && addr(row.address) === addr(BASE_USDC))) return sum;
    const held = Number(row.notional ?? row.balance);
    return sum + (Number.isFinite(held) ? held : 0);
  }, 0);
}

// Entry still spends Base USDC. Cross-chain trades also require a verified
// USDC market on the destination chain, and pass when that balance or Base
// covers the allocation. A destination-only balance is not enough to enter.
export function requireUsdc(balances, amount, settlement, base = BASE_USDC_MARKET) {
  if (!Number.isFinite(amount) || amount <= 0) throw Error('Invalid trade amount.');
  if (!settlement?.chain || !(settlement.chain in EVM_CHAINS) || !/^0x[a-f0-9]{40}$/i.test(settlement.address ?? '')) {
    throw Error('No verified USDC market is available for this trade.');
  }
  const dest = usdcAmount(balances, settlement);
  const onBase = usdcAmount(balances, base);
  if (dest >= amount) {
    if (settlement.chain === 'base' || onBase >= amount) return { dest, base: onBase };
    throw Error(`Fund at least ${dollars(amount)} USDC on Base in Portfolio. Cassie spends Base USDC to enter, then manages the position on ${settlement.chain}.`);
  }
  if (onBase >= amount) return { dest, base: onBase };
  const where = settlement.chain === 'base' ? 'Base' : `${settlement.chain} or Base`;
  throw Error(`Fund at least ${dollars(amount)} USDC on ${where} in Portfolio.`);
}
