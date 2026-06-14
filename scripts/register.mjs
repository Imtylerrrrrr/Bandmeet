// --import 로 메인 모듈보다 먼저 실행: .env.local 로드 + resolve 훅 등록.
import { register } from 'node:module';
import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
config({ path: resolve(ROOT, '.env.local') });
register('./loader-hooks.mjs', import.meta.url);
