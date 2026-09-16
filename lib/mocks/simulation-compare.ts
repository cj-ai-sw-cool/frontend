/**
 * 시뮬레이션 표본 — 병목·비교 계산식(Stage 11E, 정본 §16.4·§16.5). `simulation-metrics.ts`
 * (리드타임·타임라인)에서 분리했다(파일 300줄 상한, 같은 이유).
 *
 * 2026-09-16 백엔드가 라이브로 붙어 `use-simulation*.ts` 는 더 이상 이 파일을 참조하지
 * 않는다 — 수동 테스트·스토리북용 표본으로만 남긴다.
 */

import type {
  LeadtimeSegment,
  SaturatedResource,
  SimulationBottleneck,
  SimulationCompareResponse,
  SimulationCompareSegmentRow,
  SimulationLeadtimeResponse,
} from "../types";
import { LEADTIME_SEGMENTS } from "../types";
import { DAILY_ORDERS_DEFAULT, type MockResolvedParams } from "./simulation";
import { SEGMENT_KIND, SEGMENT_LABEL, deriveLeadtimeResponse, deriveLeadtimeRows } from "./simulation-metrics";

/* ── 병목 — 대기가 가장 긴 구간 + 포화 자원 ────────────────────────────────────── */

const SEGMENT_RESOURCE: Partial<Record<LeadtimeSegment, SaturatedResource>> = {
  WAVE_WAIT: "TOTE",
  PICK_WAIT: "PICKER",
  REBIN_WAIT: "REBINNER",
  PACK_WAIT: "PACK_STATION",
};

export function deriveBottleneck(runId: number, params: MockResolvedParams): SimulationBottleneck {
  const rows = deriveLeadtimeRows(params).filter((r) => r.kind === "WAIT");
  const worst = rows.reduce((max, r) => (r.avgSec > max.avgSec ? r : max), rows[0]);
  const resource = SEGMENT_RESOURCE[worst.key] ?? "PICKER";
  const virtualSeconds = params.durationHours * 3600;
  const cost = {
    realSeconds: Math.round(virtualSeconds / 100),
    virtualSeconds,
    compression: 100,
    events: Math.round(DAILY_ORDERS_DEFAULT * (params.durationHours / 24) * 8),
    eventsPerSec: 40,
    outboxSeqFrom: 0,
    outboxSeqTo: 0,
  };
  return {
    runId,
    segmentKey: worst.key,
    label: worst.label,
    hour: 20,
    saturatedResource: resource,
    waitSec: worst.avgSec,
    share: worst.share,
    peakWaitSec: Math.round(worst.avgSec * 1.6),
    saturated: [resource],
    waits: rows,
    cost,
  };
}

/** `SimulationBottleneck`(독립 조회 모양) → 비교 응답의 `bottleneck.a/b`(더 가벼운 모양,
 * `lib/types.ts` `SimulationCompareBottleneck` 머리말 참고) */
function toCompareBottleneck(bn: SimulationBottleneck) {
  return {
    segmentKey: bn.segmentKey,
    label: bn.label,
    hour: bn.hour,
    waitSec: bn.waitSec,
    avgSec: bn.waitSec,
    share: bn.share,
    peakAvgSec: bn.peakWaitSec,
    saturatedResource: bn.saturatedResource,
    saturated: bn.saturated,
  };
}

function compareMetric(a: number, b: number) {
  return { a, b, diff: a - b, diffPct: a > 0 ? ((a - b) / a) * 100 : null };
}

export function deriveCompare(
  runA: number,
  paramsA: MockResolvedParams,
  runB: number,
  paramsB: MockResolvedParams,
): SimulationCompareResponse {
  const rowsA = deriveLeadtimeRows(paramsA);
  const rowsB = deriveLeadtimeRows(paramsB);
  const segments: SimulationCompareSegmentRow[] = LEADTIME_SEGMENTS.map((segment, i) => {
    const aSec = rowsA[i].avgSec;
    const bSec = rowsB[i].avgSec;
    const diffSec = aSec - bSec;
    return {
      key: segment,
      label: SEGMENT_LABEL[segment],
      kind: SEGMENT_KIND[segment],
      aSec,
      bSec,
      diffSec,
      diffPct: aSec > 0 ? (diffSec / aSec) * 100 : 0,
    };
  });

  const leadA = deriveLeadtimeResponse(runA, paramsA);
  const leadB = deriveLeadtimeResponse(runB, paramsB);
  const bottleneckA = deriveBottleneck(runA, paramsA);
  const bottleneckB = deriveBottleneck(runB, paramsB);

  const sideOf = (runId: number, name: string, params: MockResolvedParams, lead: SimulationLeadtimeResponse, bn: SimulationBottleneck) => ({
    runId,
    name,
    status: "DONE" as const,
    compression: 100,
    seed: params.seed,
    orderProfile: typeof params.orderProfile === "string" ? params.orderProfile : params.orderProfile.kind,
    pickers: params.pickers,
    batchSize: params.batchSize,
    applySlotting: params.applySlotting,
    orders: lead.orders,
    total: lead.totalLeadtime,
    bottleneck: toCompareBottleneck(bn),
    cost: bn.cost,
  });

  return {
    a: sideOf(runA, "A", paramsA, leadA, bottleneckA),
    b: sideOf(runB, "B", paramsB, leadB, bottleneckB),
    segments,
    p50: compareMetric(leadA.totalLeadtime.p50Sec, leadB.totalLeadtime.p50Sec),
    p95: compareMetric(leadA.totalLeadtime.p95Sec, leadB.totalLeadtime.p95Sec),
    bottleneck: { a: toCompareBottleneck(bottleneckA), b: toCompareBottleneck(bottleneckB) },
    peakHour: {
      a: { hour: 20, hourOfDay: 20, received: 1200, shipped: 900, totalWaitSec: rowsA.reduce((s, r) => s + r.avgSec, 0) },
      b: { hour: 20, hourOfDay: 20, received: 1200, shipped: 950, totalWaitSec: rowsB.reduce((s, r) => s + r.avgSec, 0) },
    },
    sameInput: paramsA.seed === paramsB.seed && paramsA.orderProfile === paramsB.orderProfile,
  };
}
