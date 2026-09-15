/**
 * 시뮬레이션 표본의 계산식 — 리드타임·타임라인·병목·비교(Stage 11E, 정본 §16.4·§16.5).
 * `simulation.ts`(시나리오·실행 상태)에서 분리했다(파일 300줄 상한, `use-slotting.ts`가
 * `use-slotting-mutations.ts` 를 떼어낸 것과 같은 이유).
 *
 * ⚠️ 난수가 아니라 시나리오 params 로 결정되는 식이다 — 사람 수·배치 크기 같은 자원이
 * 늘면 그 구간 대기가 줄어드는 방향으로만 계산한다. 정본 §16.2 표준시간 값 근처
 * 자릿수를 쓰지만 출처가 있는 실측이 아니라 **화면 시연용 가정**이다.
 *
 * 2026-09-16 백엔드가 라이브로 붙어 `use-simulation*.ts` 는 더 이상 이 파일을 참조하지
 * 않는다 — 수동 테스트·스토리북용 표본으로만 남긴다. 필드 이름은 라이브 대조로 확정된
 * 모양(`key`/`kind`/`segments`/`orders` 등)에 맞췄다.
 */

import type {
  LeadtimeSegment,
  SimulationLeadtimeResponse,
  SimulationLeadtimeRow,
  SimulationTimelineBucket,
  SimulationTimelineResponse,
} from "../types";
import { LEADTIME_SEGMENTS } from "../types";
import { BASELINE_PARAMS, DAILY_ORDERS_DEFAULT, type MockResolvedParams } from "./simulation";

/* ── 리드타임 분해 — 시나리오 params 로 결정되는 식 ─────────────────────────────── */

/** `simulation-compare.ts`(병목·비교) 도 같이 쓴다 — export 해 둔다 */
export const SEGMENT_KIND: Record<LeadtimeSegment, "WAIT" | "WORK"> = {
  RECEIVE_WAIT: "WAIT",
  WAVE_WAIT: "WAIT",
  PICK_WAIT: "WAIT",
  PICK: "WORK",
  REBIN_WAIT: "WAIT",
  REBIN: "WORK",
  PACK_WAIT: "WAIT",
  PACK: "WORK",
  SHIP_WAIT: "WAIT",
};

export const SEGMENT_LABEL: Record<LeadtimeSegment, string> = {
  RECEIVE_WAIT: "접수 대기",
  WAVE_WAIT: "웨이브 대기",
  PICK_WAIT: "피킹 대기",
  PICK: "피킹",
  REBIN_WAIT: "리빈 대기",
  REBIN: "리빈",
  PACK_WAIT: "포장 대기",
  PACK: "포장",
  SHIP_WAIT: "출고 대기",
};

/** 구간별 평균 초 — 자원이 기준(baseline)보다 많으면 그 구간 대기가 줄어드는 방향으로만
 * 계산한다(정본 §16.1 "병목은 대기 시간이 말한다"). 작업 시간은 조건에 거의 무관 —
 * `applySlotting` 만 피킹 작업 시간을 §15 정적 결과(5.31%)만큼 줄인다. `SHIP_WAIT` 는
 * 늘 0(라이브 대조 — 시뮬레이션에 상차 단계가 없다). */
function segmentAvgSec(segment: LeadtimeSegment, params: MockResolvedParams): number {
  const pickerRatio = BASELINE_PARAMS.pickers / params.pickers;
  const rebinnerRatio = BASELINE_PARAMS.rebinners / params.rebinners;
  const packerRatio = BASELINE_PARAMS.packers / params.packers;
  const packStationRatio = BASELINE_PARAMS.packStations / params.packStations;
  const toteRatio = BASELINE_PARAMS.totes / params.totes;
  const batchRatio = params.batchSize / BASELINE_PARAMS.batchSize;

  switch (segment) {
    case "RECEIVE_WAIT":
      return 3;
    case "WAVE_WAIT":
      return Math.round(params.waveIntervalMin * 60 * 0.6 * toteRatio);
    case "PICK_WAIT":
      return Math.round(820 * pickerRatio * batchRatio);
    case "PICK": {
      // 1.3 라인/주문(§11.2) × (12초/라인 + 최상·최하단 페널티 3초 + 평균 이동 10m ÷ 1.0m/s)
      const withMove = 1.3 * (12 + 3 + 10);
      return Math.round(params.applySlotting ? withMove * (1 - 0.0531) : withMove);
    }
    case "REBIN_WAIT":
      return Math.round(260 * rebinnerRatio);
    case "REBIN":
      return Math.round(1.3 * 9);
    case "PACK_WAIT":
      return Math.round(540 * packerRatio * packStationRatio);
    case "PACK":
      return Math.round(45 + 1.3 * 5);
    case "SHIP_WAIT":
      return 0;
  }
}

/** `fraction`(기본 1) — 정지된 실행은 24시간 전체가 아니라 멈춘 시점까지만 주문을
 * 받았다(정본 §16.3 "진행 중인 배치는 끝까지, 새 주문은 멈춤"). `mockRunProgressFraction`
 * 이 넘겨준다 — 완료(DONE) 실행은 1 그대로라 계산이 그대로다. */
export function deriveLeadtimeRows(params: MockResolvedParams, fraction = 1): SimulationLeadtimeRow[] {
  const totalOrders = Math.round(DAILY_ORDERS_DEFAULT * (params.durationHours / 24) * fraction);
  const avgSecs = LEADTIME_SEGMENTS.map((segment) => segmentAvgSec(segment, params));
  const totalAvg = avgSecs.reduce((sum, v) => sum + v, 0) || 1;

  return LEADTIME_SEGMENTS.map((segment, i) => {
    const avgSec = avgSecs[i];
    return {
      key: segment,
      label: SEGMENT_LABEL[segment],
      kind: SEGMENT_KIND[segment],
      avgSec,
      p50Sec: Math.round(avgSec * 0.9),
      p95Sec: Math.round(avgSec * 1.8),
      // 퍼센트(0~100) — 라이브 대조
      share: (avgSec / totalAvg) * 100,
      orders: totalOrders,
    };
  });
}

export function deriveLeadtimeResponse(
  runId: number,
  params: MockResolvedParams,
  fraction = 1,
): SimulationLeadtimeResponse {
  const segments = deriveLeadtimeRows(params, fraction);
  const totalAvg = segments.reduce((sum, r) => sum + r.avgSec, 0);
  const orders = segments[0]?.orders ?? 0;
  const shipped = Math.round(orders * 0.9);
  return {
    runId,
    orders: {
      received: orders,
      waved: Math.round(orders * 0.95),
      picked: Math.round(orders * 0.94),
      rebinned: Math.round(orders * 0.92),
      shipped,
      cancelled: 0,
      completionPct: orders > 0 ? (shipped / orders) * 100 : 0,
    },
    totalLeadtime: {
      orders: shipped,
      avgSec: totalAvg,
      p50Sec: Math.round(totalAvg * 0.88),
      p95Sec: Math.round(totalAvg * 1.7),
      p99Sec: Math.round(totalAvg * 2.1),
      minSec: Math.round(totalAvg * 0.6),
      maxSec: Math.round(totalAvg * 2.6),
    },
    segments,
  };
}

/* ── 타임라인 — 24시간, 정본 §16.2 유입 프로파일(피크 20~23시 33%·정점 1.8배) ─────── */

/** 시간대별 유입 가중치 합 1.0 — `default` 프로파일(정본 §16.3) */
function defaultProfileWeights(): number[] {
  const weights = new Array(24).fill(1);
  for (let h = 20; h <= 23; h++) weights[h] = 1.8;
  const sum = weights.reduce((s, v) => s + v, 0);
  return weights.map((w) => w / sum);
}

function profileWeights(params: MockResolvedParams): number[] {
  if (params.orderProfile === "flat") return new Array(24).fill(1 / 24);
  return defaultProfileWeights();
}

/** `fraction` — 정지된 실행은 멈춘 가상 시각 이후 시간대는 아예 데이터가 없다
 * (`deriveLeadtimeRows` 주석 참고). 그 시각까지의 칸만 유입·출고를 채운다. */
export function deriveTimeline(runId: number, params: MockResolvedParams, fraction = 1): SimulationTimelineResponse {
  const weights = profileWeights(params);
  const totalOrders = Math.round(DAILY_ORDERS_DEFAULT * (params.durationHours / 24));
  const elapsedHours = Math.round(Math.min(24, params.durationHours) * fraction);
  const rows = deriveLeadtimeRows(params);
  const waitBySegment = Object.fromEntries(rows.filter((r) => r.kind === "WAIT").map((r) => [r.key, r.avgSec]));
  const waitOrdersBySegment = Object.fromEntries(rows.filter((r) => r.kind === "WAIT").map((r) => [r.key, r.orders]));

  const buckets: SimulationTimelineBucket[] = weights.slice(0, Math.min(24, params.durationHours)).map((w, h) => {
    const reached = h < elapsedHours;
    const received = reached ? Math.round(totalOrders * w) : 0;
    const isPeak = h >= 20 && h <= 23;
    const shipped = reached ? Math.round(received * (isPeak ? 0.82 : 0.97)) : 0;
    const load = isPeak ? 1.25 : 0.85;
    return {
      hour: h,
      hourOfDay: h,
      received,
      shipped,
      waitSec: Object.fromEntries(
        Object.entries(waitBySegment).map(([seg, sec]) => [seg, Math.round((sec as number) * load)]),
      ),
      waitOrders: waitOrdersBySegment,
      idleTotes: Math.max(0, Math.round(params.totes * (1 - (isPeak ? 0.75 : 0.4)))),
      packStationBusyPct: Math.round(50 * load),
      pickerBusyPct: Math.round(55 * load),
      rebinBusyPct: Math.round(48 * load),
      openBatches: Math.max(0, Math.round(params.pickers / 4)),
    };
  });

  return buckets;
}

