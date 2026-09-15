/**
 * 시뮬레이션 표본의 계산식 — 리드타임·타임라인·병목·비교(Stage 11E, 정본 §16.4·§16.5).
 * `simulation.ts`(시나리오·실행 상태)에서 분리했다(파일 300줄 상한, `use-slotting.ts`가
 * `use-slotting-mutations.ts` 를 떼어낸 것과 같은 이유).
 *
 * ⚠️ 난수가 아니라 시나리오 params 로 결정되는 식이다 — 사람 수·배치 크기 같은 자원이
 * 늘면 그 구간 대기가 줄어드는 방향으로만 계산한다. 정본 §16.2 표준시간 값 근처
 * 자릿수를 쓰지만 출처가 있는 실측이 아니라 **화면 시연용 가정**이다.
 *
 * 2026-09-15 백엔드가 라이브로 붙어 `use-simulation*.ts` 는 더 이상 이 파일을 참조하지
 * 않는다(백엔드 노트 "프론트 계약") — 이 파일은 수동 테스트·스토리북용 표본으로만
 * 남긴다(`lib/mocks/slotting.ts` 와 같은 처지). 구간 키·필드 이름은 그 노트에 맞춰
 * 고쳤다(`RECEIVING_WAIT`→`RECEIVE_WAIT`, `PICKING`→`PICK`, `PACKING`→`PACK`,
 * `orderCount`→`orders`, `SimulationLeadtimeRow.kind` 제거(`label` 로 대체) 등).
 */

import type {
  LeadtimeSegment,
  SaturatedResource,
  SimulationBottleneck,
  SimulationCompareResponse,
  SimulationCompareSegmentRow,
  SimulationLeadtimeResponse,
  SimulationLeadtimeRow,
  SimulationScenarioParams,
  SimulationTimelineBucket,
  SimulationTimelineResponse,
} from "../types";
import { LEADTIME_SEGMENTS } from "../types";
import { BASELINE_PARAMS, DAILY_ORDERS_DEFAULT } from "./simulation";

/* ── 리드타임 분해 — 시나리오 params 로 결정되는 식 ─────────────────────────────── */

const SEGMENT_KIND: Record<LeadtimeSegment, "WAIT" | "WORK"> = {
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

const SEGMENT_LABEL: Record<LeadtimeSegment, string> = {
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
 * 늘 0(백엔드 노트 — 시뮬레이션에 상차 단계가 없다). */
function segmentAvgSec(segment: LeadtimeSegment, params: SimulationScenarioParams): number {
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
export function deriveLeadtimeRows(params: SimulationScenarioParams, fraction = 1): SimulationLeadtimeRow[] {
  const totalOrders = Math.round(DAILY_ORDERS_DEFAULT * (params.durationHours / 24) * fraction);
  const avgSecs = LEADTIME_SEGMENTS.map((segment) => segmentAvgSec(segment, params));
  const totalAvg = avgSecs.reduce((sum, v) => sum + v, 0);

  return LEADTIME_SEGMENTS.map((segment, i) => {
    const avgSec = avgSecs[i];
    return {
      segment,
      label: SEGMENT_LABEL[segment],
      avgSec,
      p50Sec: Math.round(avgSec * 0.9),
      p95Sec: Math.round(avgSec * 1.8),
      share: totalAvg > 0 ? avgSec / totalAvg : 0,
      orders: totalOrders,
    };
  });
}

export function deriveLeadtimeResponse(
  runId: number,
  params: SimulationScenarioParams,
  fraction = 1,
): SimulationLeadtimeResponse {
  const rows = deriveLeadtimeRows(params, fraction);
  const secs = rows.map((r) => r.avgSec);
  const totalAvg = secs.reduce((sum, v) => sum + v, 0);
  return {
    runId,
    rows,
    totalOrders: rows[0]?.orders ?? 0,
    totalLeadtime: {
      avgSec: totalAvg,
      p50Sec: Math.round(totalAvg * 0.88),
      p95Sec: Math.round(totalAvg * 1.7),
      p99Sec: Math.round(totalAvg * 2.1),
      minSec: Math.round(totalAvg * 0.6),
      maxSec: Math.round(totalAvg * 2.6),
      orders: rows[0]?.orders ?? 0,
    },
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

function profileWeights(params: SimulationScenarioParams): number[] {
  if (params.orderProfile === "flat") return new Array(24).fill(1 / 24);
  if (params.orderProfile === "custom" && params.customProfile) {
    const sum = params.customProfile.reduce((s, v) => s + v, 0);
    return sum > 0 ? params.customProfile.map((v) => v / sum) : new Array(24).fill(1 / 24);
  }
  return defaultProfileWeights();
}

/** `fraction` — 정지된 실행은 멈춘 가상 시각 이후 시간대는 아예 데이터가 없다
 * (`deriveLeadtimeRows` 주석 참고). 그 시각까지의 칸만 유입·출고를 채운다. */
export function deriveTimeline(runId: number, params: SimulationScenarioParams, fraction = 1): SimulationTimelineResponse {
  const weights = profileWeights(params);
  const totalOrders = Math.round(DAILY_ORDERS_DEFAULT * (params.durationHours / 24));
  const elapsedHours = Math.round(Math.min(24, params.durationHours) * fraction);
  const rows = deriveLeadtimeRows(params);
  const waitBySegment = Object.fromEntries(
    rows.filter((r) => SEGMENT_KIND[r.segment] === "WAIT").map((r) => [r.segment, r.avgSec]),
  );

  const buckets: SimulationTimelineBucket[] = weights.slice(0, Math.min(24, params.durationHours)).map((w, h) => {
    const reached = h < elapsedHours;
    const received = reached ? Math.round(totalOrders * w) : 0;
    const isPeak = h >= 20 && h <= 23;
    const shipped = reached ? Math.round(received * (isPeak ? 0.82 : 0.97)) : 0;
    const load = isPeak ? 1.25 : 0.85;
    return {
      bucketStart: `${String(h).padStart(2, "0")}:00`,
      hourOfDay: h,
      ordersReceived: received,
      ordersShipped: shipped,
      avgWaitSecBySegment: Object.fromEntries(
        Object.entries(waitBySegment).map(([seg, sec]) => [seg, Math.round((sec as number) * load)]),
      ),
      idleTotesPct: Math.round(Math.max(5, 60 - (isPeak ? 40 : 15))),
      packStationOccupancyPct: Math.min(100, Math.round(50 * load)),
      pickerOccupancyPct: Math.min(100, Math.round(55 * load)),
      rebinnerOccupancyPct: Math.min(100, Math.round(48 * load)),
    };
  });

  return { runId, bucket: "1h", buckets };
}

/* ── 병목 — 대기가 가장 긴 구간 + 포화 자원 ────────────────────────────────────── */

const SEGMENT_RESOURCE: Partial<Record<LeadtimeSegment, SaturatedResource>> = {
  WAVE_WAIT: "TOTES",
  PICK_WAIT: "PICKERS",
  REBIN_WAIT: "REBINNERS",
  PACK_WAIT: "PACK_STATIONS",
};

export function deriveBottleneck(params: SimulationScenarioParams): SimulationBottleneck {
  const rows = deriveLeadtimeRows(params).filter((r) => SEGMENT_KIND[r.segment] === "WAIT");
  const totalWait = rows.reduce((sum, r) => sum + r.avgSec, 0) || 1;
  const worst = rows.reduce((max, r) => (r.avgSec > max.avgSec ? r : max), rows[0]);
  return {
    segment: worst.segment,
    label: worst.label,
    share: worst.avgSec / totalWait,
    peakWaitSec: worst.avgSec,
    saturated: [SEGMENT_RESOURCE[worst.segment] ?? "PICKERS"],
    waits: rows.map((r) => ({ segment: r.segment, label: r.label, waitSec: r.avgSec, share: r.avgSec / totalWait })),
    cost: worst.avgSec * (params.durationHours >= 24 ? 15000 : Math.round(15000 * (params.durationHours / 24))),
  };
}

export function deriveCompare(
  runA: number,
  paramsA: SimulationScenarioParams,
  runB: number,
  paramsB: SimulationScenarioParams,
): SimulationCompareResponse {
  const rowsA = deriveLeadtimeRows(paramsA);
  const rowsB = deriveLeadtimeRows(paramsB);
  const segments: SimulationCompareSegmentRow[] = LEADTIME_SEGMENTS.map((segment, i) => {
    const aSec = rowsA[i].avgSec;
    const bSec = rowsB[i].avgSec;
    const diffSec = aSec - bSec;
    return { segment, aSec, bSec, diffSec, diffPct: aSec > 0 ? (diffSec / aSec) * 100 : 0 };
  });

  return {
    runA,
    runB,
    segments,
    completionRatePctA: 96.4,
    completionRatePctB: paramsB.pickers > paramsA.pickers ? 98.9 : 95.1,
    peakShipDelaySecA: segmentAvgSec("PACK_WAIT", paramsA) + segmentAvgSec("PICK_WAIT", paramsA),
    peakShipDelaySecB: segmentAvgSec("PACK_WAIT", paramsB) + segmentAvgSec("PICK_WAIT", paramsB),
    bottleneckA: deriveBottleneck(paramsA),
    bottleneckB: deriveBottleneck(paramsB),
    sameInput: paramsA.seed === paramsB.seed && paramsA.orderProfile === paramsB.orderProfile,
  };
}
