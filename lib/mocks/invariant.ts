/**
 * `GET/POST /admin/inventory/invariant/**` 표본 (Stage 12, 정본 §17.3) — `use-invariant.ts`
 * 가 라이브 실패 시 대신 그린다(`lib/mocks/simulation.ts`와 같은 처지). 2026-09-16 처음
 * 확인 시점 404였다가 같은 작업 중 백엔드가 라이브로 붙었다 — 이 표본은 이제 방어적
 * fallback(일시적 네트워크 실패 등)일 뿐이다. 필드 모양은 라이브 대조로 확정된
 * `InvariantRun`(`lib/types.ts` 머리말 — `centerId` 아니라 `center` 문자열) 그대로.
 *
 * 5분 주기(`@Scheduled`, 정본 §17.3)를 그대로 흉내 낸다 — `Date.now()`에서 5분 간격으로
 * 거슬러 올라가며 20건을 만든다(호출마다 값이 바뀌지 않도록 모듈 로드 시 한 번 고정).
 * 최신 값은 위반 0(배지 기본 상태가 "정상"으로 보이게), 5번째로 오래된 행 하나만 위반
 * 1건을 심어 이력 Dialog의 경고색·상세 렌더를 화면 체크로 확인할 수 있게 한다.
 */

import type { InvariantRun, InvariantTrigger } from "../types";

const FIVE_MIN_MS = 5 * 60_000;
const HISTORY_SIZE = 20;

function buildHistory(center: string): InvariantRun[] {
  const now = Date.now();
  const rows: InvariantRun[] = [];
  for (let i = 0; i < HISTORY_SIZE; i++) {
    const ranAt = new Date(now - i * FIVE_MIN_MS).toISOString();
    // 위에서 5번째(0-based index 4) — 최신(배지가 보는 값)은 항상 위반 0으로 남긴다
    const hasViolation = i === 4;
    const trigger: InvariantTrigger = i === 0 ? "MANUAL" : i % 7 === 0 ? "SIMULATION" : "SCHEDULED";
    rows.push({
      id: 9000 - i,
      center,
      ranAt,
      trigger,
      stockVsLedger: 0,
      allocationOverStock: hasViolation ? 1 : 0,
      ledgerVsOutbox: 0,
      durationMs: 180 + Math.round(Math.random() * 60),
      detail: hasViolation
        ? [
            {
              type: "ALLOCATION_OVER_STOCK",
              sku: "SKU-10231",
              locationCode: "AMBS-02-01-01-04",
              allocated: 42,
              onHand: 40,
            },
          ]
        : [],
      runRef: trigger === "SIMULATION" ? 101 : null,
    });
  }
  return rows;
}

/** 센터별로 한 번만 만들고 재사용 — 매 렌더 새 배열이면 참조가 바뀌어 불필요한 리렌더가
 * 생긴다(`use-simulation.ts` 표본과 같은 이유). "지금 검사" 목 폴백(`mockRunInvariantCheck`)
 * 이 이 배열 앞에 새 행을 얹는다. */
const historyByCenter = new Map<string, InvariantRun[]>();

function historyFor(center: string): InvariantRun[] {
  let rows = historyByCenter.get(center);
  if (!rows) {
    rows = buildHistory(center);
    historyByCenter.set(center, rows);
  }
  return rows;
}

export function mockInvariantRuns(center: string, limit = 20): InvariantRun[] {
  return historyFor(center).slice(0, limit);
}

/** "지금 검사" 버튼의 404 폴백 — 항상 위반 0(정상 검사)으로 이력 맨 앞에 얹는다.
 * ⚠️ 브리프 금지 규칙과 무관 — 이 호출은 조회 성격의 검사 트리거이지 실행 시작·PUT이
 * 아니다("FULL 측정 중" 금지 대상은 시뮬레이션 실행·매개변수 PUT). */
export function mockRunInvariantCheck(center: string): InvariantRun {
  const rows = historyFor(center);
  const next: InvariantRun = {
    id: (rows[0]?.id ?? 9000) + 1,
    center,
    ranAt: new Date().toISOString(),
    trigger: "MANUAL",
    stockVsLedger: 0,
    allocationOverStock: 0,
    ledgerVsOutbox: 0,
    durationMs: 190 + Math.round(Math.random() * 40),
    detail: [],
    runRef: null,
  };
  rows.unshift(next);
  return next;
}
