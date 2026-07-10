import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
import { config } from '../config';

// Reuse one pool across dev HMR reloads so `vite dev` doesn't exhaust Postgres
// connections on every module invalidation.
const g = globalThis as unknown as { __cassieSql?: ReturnType<typeof postgres> };
const sql = g.__cassieSql ?? postgres(config.databaseUrl, { max: 10, onnotice: () => {} });
if (!g.__cassieSql) g.__cassieSql = sql;

export const db = drizzle(sql, { schema });
export { schema };
