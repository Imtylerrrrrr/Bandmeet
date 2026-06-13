import { config as loadEnv } from 'dotenv';
import { defineConfig } from 'drizzle-kit';

// Next 과 동일하게 .env.local 에서 DATABASE_URL 을 읽는다.
loadEnv({ path: '.env.local' });

export default defineConfig({
  schema: './src/lib/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    // generate 는 연결하지 않으므로 미설정 시 placeholder. migrate/push/studio 는 실제 값 필요.
    url: process.env.DATABASE_URL ?? 'postgresql://placeholder@localhost:5432/db',
  },
  // Supabase 의 auth/storage 등 내부 스키마는 건드리지 않는다.
  schemaFilter: ['public'],
  strict: true,
  verbose: true,
});
