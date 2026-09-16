/**
 * 불변식 배지·이력 Dialog 공용 포맷터 (Stage 12) — 분석 개요 탭·허브 관제 탭이 각자
 * `win98-ui.tsx` 사본을 쓰므로 배지 컴포넌트 자체는 라우트마다 따로 두지만(다른 화면과
 * 같은 "코드를 공유하지 않는다" 관례), 시각·라벨 계산까지 두 번 적으면 한쪽만 고쳤을 때
 * 어긋난다 — 이 순수 함수들만 `lib/`에 모은다.
 */

import { parseServerInstant } from "./events-time";
import { invariantViolationCount, type InvariantRun, type InvariantTrigger } from "./types";

export const INVARIANT_TRIGGER_LABEL: Record<InvariantTrigger, string> = {
  SCHEDULED: "주기",
  MANUAL: "수동",
  SIMULATION: "시뮬레이션",
};

/** 배지 "마지막 검증 HH:MM" — `lib/events-time.ts` KST 규칙 재사용 */
export function formatInvariantTime(ranAt: string): string {
  const ms = parseServerInstant(ranAt);
  if (ms === null) return "—";
  return new Date(ms).toLocaleTimeString("ko-KR", { hour12: false, hour: "2-digit", minute: "2-digit" });
}

export function formatInvariantDateTime(ranAt: string): string {
  const ms = parseServerInstant(ranAt);
  if (ms === null) return "—";
  return new Date(ms).toLocaleString("ko-KR", { hour12: false });
}

export interface InvariantBadgeState {
  latest: InvariantRun | null;
  violationCount: number;
  hasWarning: boolean;
  label: string;
}

/** 배지 문구 — "불변식 — 마지막 검증 HH:MM · 위반 0"(브리프 §1) */
export function invariantBadgeState(runs: InvariantRun[] | undefined): InvariantBadgeState {
  const latest = runs && runs.length > 0 ? runs[0] : null;
  if (!latest) {
    return { latest: null, violationCount: 0, hasWarning: false, label: "불변식 — 이력 없음" };
  }
  const violationCount = invariantViolationCount(latest);
  return {
    latest,
    violationCount,
    hasWarning: violationCount > 0,
    label: `불변식 — 마지막 검증 ${formatInvariantTime(latest.ranAt)} · 위반 ${violationCount}`,
  };
}

/** 이력 표 한 행 요약 — "시각·트리거·위반 3개·소요 ms"(브리프 §1) */
export function invariantRowSummary(run: InvariantRun) {
  return {
    time: formatInvariantDateTime(run.ranAt),
    trigger: INVARIANT_TRIGGER_LABEL[run.trigger],
    stockVsLedger: run.stockVsLedger,
    allocationOverStock: run.allocationOverStock,
    ledgerVsOutbox: run.ledgerVsOutbox,
    total: invariantViolationCount(run),
    durationMs: run.durationMs,
  };
}

/** `run.detail`을 위반 목록 배열로 읽는다 — 라이브 대조(2026-09-16): 정상일 때는 빈
 * 배열이 와야 하지만 실제로는 Jackson `JsonNode`의 리플렉션 필드(`array`·`nodeType`…)가
 * 그대로 직렬화돼 온다(백엔드 버그로 보임, 확인 요청 필요). 배열이 아니면 빈 목록으로
 * 다뤄 화면이 죽지 않게 한다. */
export function invariantDetailList(run: InvariantRun): unknown[] {
  return Array.isArray(run.detail) ? run.detail : [];
}
