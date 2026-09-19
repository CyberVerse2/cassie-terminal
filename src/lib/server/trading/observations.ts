import {sql} from 'drizzle-orm';
import {db} from '../db/client';
let ready:Promise<unknown>|undefined;
function ensure(){return ready??=db.execute(sql`CREATE TABLE IF NOT EXISTS cassie_market_observations(asset_key text NOT NULL,observed_at timestamptz NOT NULL,price numeric NOT NULL,PRIMARY KEY(asset_key,observed_at))`).catch(e=>{ready=undefined;throw e;});}
export async function observe(asset:any){await ensure();const at=new Date(Math.floor(Date.now()/60000)*60000).toISOString();await db.execute(sql`INSERT INTO cassie_market_observations(asset_key,observed_at,price) VALUES(${asset.chain+':'+asset.address.toLowerCase()},${at}::timestamptz,${String(asset.price)}) ON CONFLICT DO NOTHING`);}
export async function observations(asset:any){await ensure();return db.execute(sql`SELECT extract(epoch FROM observed_at)::int AS time,price::float AS value FROM cassie_market_observations WHERE asset_key=${asset.chain+':'+asset.address.toLowerCase()} AND observed_at>now()-interval '30 days' ORDER BY observed_at`);}
