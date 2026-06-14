// node 모듈 resolve 훅: '@/' 별칭 + 확장자 없는 .ts 임포트 해석 (스모크 스크립트 전용).
import { statSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url))); // scripts/.. = 프로젝트 루트
const SRC = pathResolve(ROOT, 'src');

function isFile(p) {
  try {
    return statSync(p).isFile();
  } catch {
    return false;
  }
}

function probe(basePath) {
  for (const cand of [
    basePath,
    basePath + '.ts',
    basePath + '.tsx',
    pathResolve(basePath, 'index.ts'),
  ]) {
    if (isFile(cand)) return pathToFileURL(cand).href;
  }
  return null;
}

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('@/')) {
    const hit = probe(pathResolve(SRC, specifier.slice(2)));
    if (hit) return { url: hit, shortCircuit: true };
  }
  if (
    (specifier.startsWith('./') || specifier.startsWith('../')) &&
    context.parentURL
  ) {
    const base = pathResolve(dirname(fileURLToPath(context.parentURL)), specifier);
    const hit = probe(base);
    if (hit) return { url: hit, shortCircuit: true };
  }
  return nextResolve(specifier, context);
}
