import test from 'node:test';
import assert from 'node:assert/strict';
import {STOCKS,stockForTicker,verifiedStockMarket,tokenExitPrices} from './stock-assets.js';
const stock=STOCKS.NVDA;
const listing=`<a href="https://basescan.org/token/${stock.address}">NVDAc</a>`;
const asset={...stock,price:'220'};
test('resolves an exact underlying and preserves share classes',()=>{
  assert.equal(stockForTicker('nvda'),stock);
  for(const ticker of ['GOOG','NVDA-USD','NVDAx3L','COIN','CRCL','INTC','VRT'])assert.equal(stockForTicker(ticker),null);
});
test('only issuer-listed addresses can resolve, even if a counterfeit ranks first',()=>{
  const fake={...asset,address:'0x1111111111111111111111111111111111111111'};
  assert.equal(verifiedStockMarket(stock,[fake,asset],listing).address,stock.address);
  assert.throws(()=>verifiedStockMarket(stock,[fake],listing));
  assert.throws(()=>verifiedStockMarket(stock,[asset],''));
});
test('rejects wrong chains, decimals, symbols and missing prices',()=>{
  for(const change of [{chain:'ethereum'},{decimals:18},{symbol:'NVDAX'},{price:'0'},{price:'NaN'}])assert.throws(()=>verifiedStockMarket(stock,[{...asset,...change}],listing));
});
test('converts share targets to token prices with the current multiplier',()=>{
  assert.deepEqual(tokenExitPrices(250,190,1.02,224.4),{target:'255.00000000',stop:'193.80000000'});
});
test('does not fabricate missing exits or accept invalid price boundaries',()=>{
  for(const args of [[null,190,1,220],[250,null,1,220],[250,190,0,220],[210,190,1,220],[250,230,1,220],[250,190,1,Infinity]])assert.throws(()=>tokenExitPrices(...args));
});
