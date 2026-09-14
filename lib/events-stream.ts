/**
 * SSE 연결 — 이 파일 하나에서만 `EventSource`를 연다(브리프 머리말 "SSE는
 * `lib/events-stream.ts` 한 곳"). `GET /events/stream?center=&from=`(정본 §13.3),
 * 이벤트 `id` = seq 라 브라우저 `Last-Event-ID`로 자동 재개한다(정본 §13.6 "재접속
 * 누락 0").
 *
 * 끊기면 지수 백오프(1s→2s→4s→…→30s 상한)로 재연결한다. 최초 연결이 연달아
 * 실패하면(백엔드가 아직 `/events/**`를 안 띄운 시기) `onUnavailable`로 상위 훅
 * (`lib/use-events.ts`)에 넘겨 `lib/mocks/events.ts` 가짜 스트림으로 넘어간다 — 그
 * 뒤로도 계속 주기적으로 재시도해, 백엔드가 뜨면 자동으로 라이브로 돌아온다.
 *
 * ⚠️ 2026-09-14 라이브 검증 — 서버(`EventStreamService.send()`)가 SSE 프레임을
 * `event: <type>`(예: `event: InventoryTxRecorded`)으로 이름 붙여 보낸다. 브라우저
 * `EventSource`는 이름 붙은 프레임을 `onmessage`로 못 받는다(스펙상 unnamed
 * `message` 이벤트만 잡는다) — 그래서 `WMS_EVENT_TYPES` 카탈로그 전체에
 * `addEventListener`를 건다. `onmessage`도 남겨 두는 이유는 서버가 이름 없이 보내는
 * 경우까지 잡기 위해서다(방어적 이중화, 비용 없음).
 */

import { API_BASE } from "./api";
import { WMS_EVENT_TYPES, type EventStreamStatus, type WmsEvent } from "./types";

const MAX_BACKOFF_MS = 30_000;
const UNAVAILABLE_AFTER_ERRORS = 3;

export interface EventStreamHandlers {
  onEvent: (event: WmsEvent) => void;
  onStatusChange: (status: EventStreamStatus) => void;
  /** 연속 실패 3회 — 아직 없는 엔드포인트로 보고 상위가 목으로 넘어가게 알린다.
   * 이후에도 이 커넥션은 백오프를 계속 돌며 라이브 복귀를 노린다. */
  onUnavailable: () => void;
}

export interface EventStreamHandle {
  close: () => void;
}

export function openEventStream(center: string, fromSeq: number | undefined, handlers: EventStreamHandlers): EventStreamHandle {
  let source: EventSource | null = null;
  let closed = false;
  let attempt = 0;
  let consecutiveErrors = 0;
  let reportedUnavailable = false;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let lastSeq = fromSeq;

  const connect = () => {
    if (closed) return;
    const qs = new URLSearchParams({ center });
    if (lastSeq !== undefined) qs.set("from", String(lastSeq));
    handlers.onStatusChange(attempt === 0 ? "connecting" : "reconnecting");

    source = new EventSource(`${API_BASE}/events/stream?${qs.toString()}`);

    source.onopen = () => {
      if (attempt > 0) {
        // 화면 체크 2: 재연결 후 seq 연속 확인용
        console.info(`[events-stream] reconnected center=${center} fromSeq=${lastSeq ?? "-"}`);
      }
      attempt = 0;
      consecutiveErrors = 0;
      handlers.onStatusChange("open");
    };

    const onFrame = (ev: MessageEvent<string>) => {
      consecutiveErrors = 0;
      try {
        const parsed = JSON.parse(ev.data) as WmsEvent;
        lastSeq = parsed.seq;
        handlers.onEvent(parsed);
      } catch {
        // 형식이 어긋난 메시지 한 건 때문에 스트림 전체를 끊지 않는다
      }
    };
    source.onmessage = onFrame;
    for (const type of WMS_EVENT_TYPES) source.addEventListener(type, onFrame);

    source.onerror = () => {
      consecutiveErrors += 1;
      source?.close();
      source = null;
      if (closed) return;

      if (!reportedUnavailable && consecutiveErrors >= UNAVAILABLE_AFTER_ERRORS) {
        reportedUnavailable = true;
        handlers.onUnavailable();
      }
      handlers.onStatusChange("reconnecting");
      attempt += 1;
      const delay = Math.min(1000 * 2 ** attempt, MAX_BACKOFF_MS);
      retryTimer = setTimeout(connect, delay);
    };
  };

  connect();

  return {
    close: () => {
      closed = true;
      if (retryTimer) clearTimeout(retryTimer);
      source?.close();
      handlers.onStatusChange("closed");
    },
  };
}
