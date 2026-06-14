/*
 * Bandmeet 사설 봇 (메신저봇R / MessengerBotR) — 템플릿.
 * 24h PC 안드 에뮬 + 카카오 "부계정" 으로만 운영 (매뉴얼 §8 안전 규칙).
 *
 * 하는 일 (읽기 + 알림 only — 상태 변경 절대 금지):
 *   1) 아웃바운드: /api/bot/poll 주기 폴링 → 미발송 알림을 단톡 게시 → /api/bot/ack 로 발송 표시(멱등).
 *   2) 인바운드: "/합주봇" 메시지 감지 → /api/bot/schedule 조회 → 일정 텍스트 답장.
 *
 * ⚠ 이 파일은 템플릿입니다. 기기에서 실행하려면 아래 3개 상수를 채우고,
 *   메신저봇R 버전에 맞게 HTTP/리스너 API 를 미세 조정하세요(버전마다 다름).
 *   백엔드에 못 닿으면 단톡에 에러를 토하지 말고 침묵합니다(§8-5).
 */

// ── 설정 (반드시 채울 것) ───────────────────────────────────────────────
const BASE_URL = 'https://YOUR-APP.vercel.app'; // 배포된 Bandmeet 주소
const BOT_SECRET = 'PUT_BOT_SECRET_HERE'; // Vercel 환경변수 BOT_SECRET 과 동일 값
const ROOM_NAME = '우리 동아리 단톡'; // 봇이 게시/조회할 단톡방 이름 (설정 화면 연결 이름과 일치)
const POLL_MS = 15000; // 폴링 주기(ms)

const POLL_URL = BASE_URL + '/api/bot/poll';
const ACK_URL = BASE_URL + '/api/bot/ack';
const SCHEDULE_URL = BASE_URL + '/api/bot/schedule';

const bot = BotManager.getCurrentBot();

// ── HTTP 헬퍼 (jsoup — 메신저봇R 내장) ─────────────────────────────────
function httpGet(url) {
  return org.jsoup.Jsoup.connect(url)
    .header('Authorization', 'Bearer ' + BOT_SECRET)
    .ignoreContentType(true)
    .ignoreHttpErrors(true)
    .method(org.jsoup.Connection.Method.GET)
    .execute()
    .body();
}

function httpPost(url, jsonBody) {
  return org.jsoup.Jsoup.connect(url)
    .header('Authorization', 'Bearer ' + BOT_SECRET)
    .header('Content-Type', 'application/json')
    .requestBody(jsonBody)
    .ignoreContentType(true)
    .ignoreHttpErrors(true)
    .method(org.jsoup.Connection.Method.POST)
    .execute()
    .body();
}

// ── 1) 아웃바운드: 폴링 → 게시 → ack ──────────────────────────────────
function poll() {
  try {
    const res = httpGet(POLL_URL + '?room=' + encodeURIComponent(ROOM_NAME));
    const data = JSON.parse(res);
    if (!data || !data.messages || data.messages.length === 0) return;

    const sentIds = [];
    for (let i = 0; i < data.messages.length; i++) {
      const m = data.messages[i];
      bot.send(ROOM_NAME, m.body); // replyRoom 게시
      sentIds.push(m.id);
    }
    if (sentIds.length > 0) {
      // room 포함 → 서버가 이 단톡방(org) 메시지로 스코프(멱등 발송 표시).
      httpPost(ACK_URL, JSON.stringify({ room: ROOM_NAME, ids: sentIds }));
    }
  } catch (e) {
    // §8-5: 백엔드 장애를 단톡에 노출하지 않는다 — 침묵.
  }
}

const timer = new java.util.Timer();
timer.scheduleAtFixedRate(
  new java.util.TimerTask({ run: poll }),
  0,
  POLL_MS,
);

// ── 2) 인바운드: "/합주봇" 조회(읽기 전용) ────────────────────────────
function onMessage(msg) {
  try {
    const text = ('' + msg.content).trim();
    if (text.indexOf('/합주봇') !== 0) return; // 그 외 메시지는 무시(상태 변경 명령 없음)

    const res = httpGet(SCHEDULE_URL + '?room=' + encodeURIComponent(msg.room));
    const data = JSON.parse(res);
    if (data && data.text) msg.reply(data.text);
  } catch (e) {
    // 침묵.
  }
}

bot.addListener(Event.MESSAGE, onMessage);
