// Issuer-published contracts, verified 2026-09-19 at https://brand.base.org/stocks.
// Never infer an address from a symbol or substitute a leveraged/perpetual asset.
export const STOCK_SOURCE = 'https://brand.base.org/stocks';
export const STOCKS = Object.freeze(Object.fromEntries(Object.entries({
  NVDA:'0xb20000000000000000000078ee7ce2fe4908108c',
  META:'0xb2000000000000000000008bc8786b856e61707c',
  AAPL:'0xb200000000000000000000c2e324d24d7eecd1fb',
  GOOGL:'0xb2000000000000000000002d0ba3164cc74f58b7',
  AMZN:'0xb200000000000000000000d9192b6b456483c2e8',
  MSFT:'0xb200000000000000000000ab99cfa739e253872b',
  MSTR:'0xb2000000000000000000004884b426556b92883d',
  SNDK:'0xb200000000000000000000397293cb8cda9a10c5',
  SPCX:'0xb2000000000000000000007b9fcbd005511acbd5',
  TSLA:'0xb2000000000000000000001e800a7f5189430cd0',
}).map(([ticker,address])=>[ticker,{ticker,address,chain:'base',symbol:`${ticker}c`,decimals:8,issuer:'Coinbase',source:STOCK_SOURCE}])));

export function stockForTicker(ticker) {
  // Share-class names are deliberate: GOOG must never silently become GOOGL.
  return typeof ticker==='string' ? STOCKS[ticker.toUpperCase()] ?? null : null;
}
export function verifiedStockMarket(stock, assets, issuerPage) {
  const addresses=[...issuerPage.matchAll(/https:\/\/basescan\.org\/token\/(0x[a-fA-F0-9]{40})(?![a-fA-F0-9])/g)].map(m=>m[1].toLowerCase());
  if(!addresses.includes(stock.address))throw new Error('This stock is no longer listed by its issuer.');
  const asset=assets?.find(a=>a.chain===stock.chain && a.address?.toLowerCase()===stock.address);
  if(!asset || asset.symbol!==stock.symbol || asset.decimals!==stock.decimals)throw new Error('Definitive has no verified market for this tokenized stock.');
  if(!Number.isFinite(Number(asset.price)) || Number(asset.price)<=0)throw new Error('A current tokenized-stock price is unavailable.');
  return {...stock,price:Number(asset.price)};
}

export function tokenExitPrices(target,stop,multiplier,entry) {
  if(![target,stop,multiplier,entry].every(n=>Number.isFinite(n)&&n>0))throw new Error('This trade needs verified entry, take-profit, and stop-loss prices.');
  const takeProfit=target*multiplier,stopLoss=stop*multiplier;
  if(takeProfit<=entry || stopLoss>=entry)throw new Error('The exit prices no longer bracket the current token price.');
  return {target:takeProfit.toFixed(8),stop:stopLoss.toFixed(8)};
}
