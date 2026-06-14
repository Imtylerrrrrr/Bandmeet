// 공개 API(cron·bot) 공유 시크릿 Bearer 인증 (단일 출처).
// 시크릿 미설정이면 거부(fail-closed): 프로덕션에서 시크릿을 깜빡해도
// 공개 트리거가 되지 않고 닫힌다. Authorization: Bearer <secret>.

export function bearerAuthorized(request: Request, secret: string | undefined): boolean {
  if (!secret) return false;
  return request.headers.get('authorization') === `Bearer ${secret}`;
}
