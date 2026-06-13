import { z } from 'zod';

/**
 * 서버 전용 환경변수 검증 접근자. 클라이언트 컴포넌트에서 import 하지 말 것
 * (SUPABASE_SERVICE_ROLE_KEY 등 비공개 값을 포함하므로).
 */
const EnvSchema = z.object({
  DATABASE_URL: z.string().min(1),
  NEXT_PUBLIC_SUPABASE_URL: z.string().min(1),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
});

let cached: z.infer<typeof EnvSchema> | null = null;

export function serverEnv() {
  if (cached) return cached;
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const missing = parsed.error.issues.map((i) => i.path.join('.')).join(', ');
    throw new Error(
      `환경변수 누락/오류: ${missing} — .env.local 을 .env.example 기준으로 채우세요.`,
    );
  }
  cached = parsed.data;
  return cached;
}
