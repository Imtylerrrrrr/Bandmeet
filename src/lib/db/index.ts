import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import { serverEnv } from '@/lib/env';
import * as schema from './schema';

// Supabase pooler(pgbouncer transaction mode) 대응: prepare 비활성화.
const client = postgres(serverEnv().DATABASE_URL, { prepare: false });

export const db = drizzle(client, { schema });
export { schema };
