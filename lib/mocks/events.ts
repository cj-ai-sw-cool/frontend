/**
 * `GET /events`·`GET /events/stream` 표본 — 정본 §13.2·§13.3. `lib/events-stream.ts`가
 * 라이브 SSE 를 못 열 때 이 파일이 대신한다: 표본 200건(`mockEventSample`)을 먼저
 * 채우고, 그 뒤로는 가짜 타이머(`createMockEventStream`)가 새 이벤트를 계속 만든다.
 *
 * `InventoryTxRecorded`만 만든다 — 3D 관제·KPI가 쓰는 것이 이 유형뿐이다(브리프 §1·§2).
 * 베이·통로는 `lib/mocks/layout.ts`의 `mockLayout`(존 4·베이 40)을 그대로 참조해, 3D가
 * 목 레이아웃으로 대체돼 있을 때도(`use-layout.ts`) 이벤트가 실제로 있는 베이를 가리킨다.
 *
 * 2026-09-14 라이브 검증 — `bayId`·`zoneCode`·`locationCode`는 `payload` 안이 아니라
 * 이벤트 최상위 필드다(`EventRow.java` 확인, `lib/types.ts` `WmsEvent` 주석). 이 파일도
 * 그 모양 그대로 만든다 — 목 단계에서 이미 실제 계약과 같은 필드로 화면 체크가 된다.
 */

import { mockLayout } from "./layout";
import type { Bay, InventoryTxType, WmsEvent } from "../types";

const TX_TYPES: InventoryTxType[] = [
  "RECEIVE",
  "PUTAWAY",
  "PICK",
  "REBIN",
  "RESTOCK",
  "SHIP",
  "ADJUST",
  "STATUS_CHANGE",
  "TRANSFER_OUT",
  "TRANSFER_IN",
];

/** 센터 하나 작업자 20명 — 정본 §13.4 "피커 8·리빈 4·포장 6·실사 2" */
export const MOCK_WORKER_CODES: string[] = [
  ...range(1, 8).map((n) => `PK${pad2(n)}`), // PICKER
  ...range(1, 4).map((n) => `RB${pad2(n)}`), // REBIN
  ...range(1, 6).map((n) => `PC${pad2(n)}`), // PACKER
  ...range(1, 2).map((n) => `CT${pad2(n)}`), // COUNTER
];

function range(from: number, to: number): number[] {
  const out: number[] = [];
  for (let n = from; n <= to; n++) out.push(n);
  return out;
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function bayForTick(tick: number): Bay {
  return mockLayout.bays[tick % mockLayout.bays.length];
}

/** 목이 만드는 가상 센터 내부 id — 라이브 `centerId`(숫자)와 자리만 맞추면 되고
 * 화면은 이 값을 안 쓴다("C1" → 1, "C2" → 2 식) */
function fakeCenterId(center: string): number {
  const n = Number(center.replace(/\D/g, ""));
  return Number.isFinite(n) && n > 0 ? n : 1;
}

function buildEvent(seq: number, center: string, occurredAt: Date, tick: number): WmsEvent {
  const worker = MOCK_WORKER_CODES[tick % MOCK_WORKER_CODES.length];
  const bay = bayForTick(tick);
  const txType = TX_TYPES[tick % TX_TYPES.length];
  return {
    seq,
    type: "InventoryTxRecorded",
    aggregateType: "INVENTORY_TX",
    aggregateId: seq,
    center,
    centerId: fakeCenterId(center),
    sellerId: null,
    locationId: bay.id * 100 + 1 + (tick % bay.positions),
    locationCode: `${bay.zoneCode}-${String(bay.aisleNo).padStart(2, "0")}-${String(bay.no).padStart(2, "0")}`,
    bayId: bay.id,
    zoneCode: bay.zoneCode,
    worker,
    occurredAt: occurredAt.toISOString(),
    payload: { txType, qty: 1 + (tick % 5) },
  };
}

/** 표본 200건 — 최근 1시간에 고르게 퍼져 있다(리플레이 스크러버 기본 범위와 맞춘다, 브리프 §3) */
export function mockEventSample(center: string, count = 200): WmsEvent[] {
  const now = Date.now();
  const stepMs = (60 * 60_000) / count; // 200건 → 18초 간격
  const events: WmsEvent[] = [];
  for (let i = 0; i < count; i++) {
    const seq = i + 1;
    const occurredAt = new Date(now - (count - i) * stepMs);
    events.push(buildEvent(seq, center, occurredAt, i));
  }
  return events;
}

export interface MockEventStreamHandle {
  close: () => void;
}

/**
 * 가짜 실시간 스트림 — `lib/events-stream.ts`가 라이브 SSE 를 열지 못할 때
 * `lib/use-events.ts`가 대신 켠다. 표본 마지막 순번(`lastSeq`)에서 이어 붙여 순번이
 * 끊기지 않게 한다(재연결 화면 체크와 같은 규칙).
 */
export function createMockEventStream(
  center: string,
  lastSeq: number,
  onEvent: (event: WmsEvent) => void,
  intervalMs = 900,
): MockEventStreamHandle {
  let seq = lastSeq;
  let tick = 10_000; // 표본이 쓴 tick(0~199)과 안 겹치게 크게 시작
  const timer = setInterval(() => {
    seq += 1;
    tick += 1;
    onEvent(buildEvent(seq, center, new Date(), tick));
  }, intervalMs);
  return { close: () => clearInterval(timer) };
}
