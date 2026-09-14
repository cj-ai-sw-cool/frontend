/**
 * 서버 시각 변환 — 라이브 검증(2026-09-14, `EventRow`·`EventKpi` 소스 확인): `occurredAt`·
 * `windowFrom`·`windowTo`·`lastEventAt`는 Java `LocalDateTime`이라 오프셋이 없다. 이
 * 환경은 컨테이너가 UTC 라 우연히 UTC 값이 찍히지만, 앱이 타임존을 강제하는 설정은 없다
 * (`application.yml`에 `spring.jackson.time-zone` 없음 — 완료 보고 "라이브 검증 대기"
 * 참고). 오프셋 없는 문자열을 그냥 `new Date(x)`로 읽으면 브라우저가 **로컬** 시간대로
 * 해석해 KST 환경에서 9시간 어긋난다 — 이 파일 두 함수로만 서버 시각을 주고받는다.
 */

/** 서버가 준 시각 문자열 → epoch ms. 오프셋이 이미 있으면(`Z`·`+09:00` 등) 그대로,
 * 없으면 `Z`를 붙여 UTC 로 읽는다. */
export function parseServerInstant(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const hasOffset = /[zZ]|[+-]\d{2}:?\d{2}$/.test(iso);
  const withZone = hasOffset ? iso : `${iso}Z`;
  const ms = new Date(withZone).getTime();
  return Number.isNaN(ms) ? null : ms;
}

/** epoch ms → `GET /events` 쿼리에 보낼 `LocalDateTime` 문자열(오프셋 없이, 밀리초까지).
 * 서버는 `@DateTimeFormat(iso = ISO.DATE_TIME)` + `LocalDateTime` 바인딩이라 `Z`가
 * 붙어도 에러는 안 나지만 오프셋이 조용히 버려진다 — 아예 안 붙여서 이 환경의 UTC
 * 우연에 기대지 않고 명시적으로 맞춘다. */
export function toServerLocalDateTime(epochMs: number): string {
  return new Date(epochMs).toISOString().replace(/Z$/, "");
}
