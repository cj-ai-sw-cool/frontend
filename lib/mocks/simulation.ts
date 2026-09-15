/**
 * `GET/POST /admin/simulation/**` 표본 — 시나리오·실행 상태 (Stage 11E, 정본 §16).
 * 계산식(리드타임·타임라인·병목·비교)은 `simulation-metrics.ts` 로 뺐다(파일 300줄
 * 상한, `use-slotting.ts`/`use-slotting-mutations.ts` 와 같은 이유).
 *
 * 2026-09-16 백엔드가 라이브로 붙어 `use-simulation*.ts` 는 더 이상 이 파일을 참조하지
 * 않는다 — 수동 테스트·스토리북용 표본으로만 남긴다(`lib/mocks/slotting.ts` 와 같은
 * 처지). 시나리오·실행의 `params` 필드는 라이브에서 전부 null 허용(센터 기본값 상속,
 * `lib/types.ts` `SimulationScenarioParams` 머리말)이지만, 이 표본은 항상 다 채운
 * `MockResolvedParams`(로컬 전용, 비-null) 로 계산한다 — 표본이 스스로 상속 규칙까지
 * 흉내 낼 필요는 없다.
 */

import {
  simulationRunId,
  type OrderProfileKind,
  type SimulationParams,
  type SimulationRun,
  type SimulationRunProgress,
  type SimulationRunStatus,
  type SimulationScenario,
} from "../types";

export const mockSimulationParams: SimulationParams = {
  center: "C1",
  params: {
    compression: 100,
    walkSpeedMps: 1.0,
    secPerLine: 12,
    levelPenaltySec: 3,
    rebinSecPerUnit: 9,
    packFixedSec: 45,
    packSecPerItem: 5,
    batchSetupSec: 30,
    pickers: 22,
    rebinners: 8,
    packers: 45,
    batchSize: 50,
    totes: 600,
    packStations: 45,
    rebinSlots: 1200,
    waveIntervalMin: 15,
    ordersPerDay: 15000,
    durationHours: 24,
  },
  sources: {},
};

/** 표본 계산 전용 — 라이브 시나리오의 `params`(전부 null 허용)와 달리 항상 다 채운다 */
export interface MockResolvedParams {
  durationHours: number;
  orderProfile: OrderProfileKind;
  pickers: number;
  rebinners: number;
  packers: number;
  batchSize: number;
  totes: number;
  packStations: number;
  rebinSlots: number;
  waveIntervalMin: number;
  applySlotting: boolean;
  seed: number;
}

export const BASELINE_PARAMS: MockResolvedParams = {
  durationHours: 24,
  orderProfile: "default",
  pickers: 22,
  rebinners: 8,
  packers: 45,
  batchSize: 50,
  totes: 600,
  packStations: 45,
  rebinSlots: 1200,
  waveIntervalMin: 15,
  applySlotting: false,
  seed: 20260915,
};

/** 데모 시드 기본 시나리오 4개(정본 §16.5 "시드가 만든다") */
export const mockScenarios: SimulationScenario[] = [
  { scenarioId: 1, center: "C1", name: "baseline", params: BASELINE_PARAMS, createdAt: "2026-09-15T00:00:00Z" },
  {
    scenarioId: 2,
    center: "C1",
    name: "pickers+5",
    params: { ...BASELINE_PARAMS, pickers: 27, seed: 20260916 },
    createdAt: "2026-09-15T00:05:00Z",
  },
  {
    scenarioId: 3,
    center: "C1",
    name: "batch30",
    params: { ...BASELINE_PARAMS, batchSize: 30, seed: 20260917 },
    createdAt: "2026-09-15T00:10:00Z",
  },
  {
    scenarioId: 4,
    center: "C1",
    name: "slotting",
    params: { ...BASELINE_PARAMS, applySlotting: true, seed: 20260918 },
    createdAt: "2026-09-15T00:15:00Z",
  },
];

/** 시나리오 4개에 대응하는 완료 실행 3건 + `slotting` 은 아직 실행 없음(브리프 §3 "실행
 * 3") — "새 시나리오 → 실행" 화면 체크가 빈 상태에서 시작하는 흐름도 보여준다 */
export const mockRuns: SimulationRun[] = [
  {
    runId: 101,
    scenarioId: 1,
    status: "DONE",
    compression: 100,
    virtualStart: "2026-09-15T00:00:00",
    virtualEnd: "2026-09-16T00:00:00",
    realStartedAt: "2026-09-15T09:00:00Z",
    realFinishedAt: "2026-09-15T09:14:24Z",
    outboxSeqFrom: 500000,
    outboxSeqTo: 548200,
    error: null,
  },
  {
    runId: 102,
    scenarioId: 2,
    status: "DONE",
    compression: 100,
    virtualStart: "2026-09-15T00:00:00",
    virtualEnd: "2026-09-16T00:00:00",
    realStartedAt: "2026-09-15T09:20:00Z",
    realFinishedAt: "2026-09-15T09:34:10Z",
    outboxSeqFrom: 548200,
    outboxSeqTo: 596800,
    error: null,
  },
  {
    runId: 103,
    scenarioId: 3,
    status: "STOPPED",
    compression: 100,
    virtualStart: "2026-09-15T00:00:00",
    virtualEnd: "2026-09-15T16:12:00",
    realStartedAt: "2026-09-15T09:40:00Z",
    realFinishedAt: "2026-09-15T09:50:07Z",
    outboxSeqFrom: 596800,
    outboxSeqTo: 621300,
    error: null,
  },
];

/** 화면에서 만든 시나리오(`mockCreateScenario`) — 시드 4개와 분리해 둔다. */
const createdScenarios: SimulationScenario[] = [];
let nextScenarioId = 900;

export function mockScenarioById(id: number): SimulationScenario | null {
  return (
    mockScenarios.find((s) => simulationScenarioIdOf(s) === id) ??
    createdScenarios.find((s) => simulationScenarioIdOf(s) === id) ??
    null
  );
}

function simulationScenarioIdOf(s: SimulationScenario): number {
  return (s.scenarioId ?? s.id) as number;
}

export function mockListScenarios(center: string): SimulationScenario[] {
  return [...mockScenarios, ...createdScenarios].filter((s) => s.center === center);
}

/** "생성" 버튼의 404 폴백 */
export function mockCreateScenario(body: { center: string; name: string; params: MockResolvedParams }): SimulationScenario {
  const scenario: SimulationScenario = {
    scenarioId: nextScenarioId++,
    center: body.center,
    name: body.name,
    params: body.params,
    createdAt: new Date().toISOString(),
  };
  createdScenarios.push(scenario);
  return scenario;
}

/* ── 실행 목록 — 생성·정지로 바뀌는 가변 상태 ────────────────────────────────────
   시드 3건(`mockRuns`)에 화면에서 만든 실행이 쌓인다. `slotting-mutations.ts` 의
   `mockProposalSeq` 관례와 같은 모듈 전역 카운터. */
const allRuns: SimulationRun[] = [...mockRuns];
let nextRunId = 1000;

const runParamsById = new Map<number, MockResolvedParams>();
for (const run of mockRuns) {
  const scenario = mockScenarioById(run.scenarioId);
  if (scenario) runParamsById.set(simulationRunId(run), scenario.params as MockResolvedParams);
}

/** 실행마다 호출될 때(2초 폴링)마다 조금씩 나아간다 — 실시간 Date.now() 대신 **호출
 * 횟수**로 전진시킨다(8회 × 2초 ≈ 16초면 완료). 화면 체크 "시작"·"중간" 캡처 두 장을
 * 무리 없이 나눠 찍을 수 있는 속도다. */
const PROGRESS_STEP_PCT = 13;
const progressState = new Map<number, { pct: number; status: SimulationRunStatus }>();
for (const run of mockRuns) progressState.set(simulationRunId(run), { pct: 100, status: run.status });

export function mockRunById(id: number): SimulationRun | null {
  return allRuns.find((r) => simulationRunId(r) === id) ?? null;
}

export function mockListRuns(center: string, scenarioId?: number): SimulationRun[] {
  return allRuns.filter(
    (r) =>
      mockScenarioById(r.scenarioId)?.center === center && (scenarioId === undefined || r.scenarioId === scenarioId),
  );
}

/** "실행" 버튼의 404 폴백 — 정본 §16.3 "비동기 1개만 동시 실행/센터" */
export function mockCreateRun(scenario: SimulationScenario): SimulationRun {
  const run: SimulationRun = {
    runId: nextRunId++,
    scenarioId: simulationScenarioIdOf(scenario),
    status: "RUNNING",
    compression: mockSimulationParams.params.compression,
    virtualStart: "2026-09-15T00:00:00",
    virtualEnd: null,
    realStartedAt: new Date().toISOString(),
    realFinishedAt: null,
    outboxSeqFrom: 700000,
    outboxSeqTo: null,
    error: null,
  };
  allRuns.unshift(run);
  runParamsById.set(simulationRunId(run), scenario.params as MockResolvedParams);
  progressState.set(simulationRunId(run), { pct: 0, status: "RUNNING" });
  return run;
}

/** "정지" 버튼의 404 폴백 — 진행 중이던 값을 그대로 얼려 STOPPED 로(정본 §16.3 "진행 중인
 * 배치는 끝까지, 새 주문은 멈춤" — 표본에서는 그 구분까지는 흉내내지 않는다) */
export function mockStopRun(runId: number): SimulationRun | null {
  const state = progressState.get(runId);
  if (state && state.status === "RUNNING") state.status = "STOPPED";
  const idx = allRuns.findIndex((r) => simulationRunId(r) === runId);
  if (idx === -1) return null;
  const updated: SimulationRun = { ...allRuns[idx], status: "STOPPED", realFinishedAt: new Date().toISOString() };
  allRuns[idx] = updated;
  return updated;
}

export const DAILY_ORDERS_DEFAULT = 15000;

export function mockRunProgress(runId: number): SimulationRunProgress {
  const state = progressState.get(runId) ?? { pct: 0, status: "QUEUED" as SimulationRunStatus };
  if (state.status === "RUNNING") {
    state.pct = Math.min(100, state.pct + PROGRESS_STEP_PCT);
    if (state.pct >= 100) {
      state.status = "DONE";
      const idx = allRuns.findIndex((r) => simulationRunId(r) === runId);
      if (idx !== -1) {
        allRuns[idx] = {
          ...allRuns[idx],
          status: "DONE",
          realFinishedAt: new Date().toISOString(),
          outboxSeqTo: (allRuns[idx].outboxSeqFrom ?? 700000) + 48000,
        };
      }
    }
  }
  progressState.set(runId, state);

  const params = runParamsById.get(runId) ?? BASELINE_PARAMS;
  const frac = state.pct / 100;
  const ordersReceived = Math.round(DAILY_ORDERS_DEFAULT * frac);
  const ordersShipped = Math.round(ordersReceived * Math.max(0, frac - 0.08));
  const virtualHours = params.durationHours * frac;

  return {
    runId,
    status: state.status,
    virtualNow: new Date(Math.round(virtualHours * 3_600_000)).toISOString(),
    virtualHours,
    progressPct: Math.round(state.pct),
    ordersReceived,
    ordersShipped,
    openBatches: Math.max(0, Math.round((params.pickers / 4) * (1 - frac * 0.6))),
    idleTotes: Math.max(0, Math.round(params.totes * (1 - frac * 0.7))),
    busyPackStations: Math.min(params.packStations, Math.round(params.packStations * (0.3 + frac * 0.5))),
    eventsPerSec: Math.round(40 + frac * 60),
  };
}

/** 실행이 멈춘 시점의 진행률(0~1) — STOPPED 실행의 "결과" 패널이 완료된 것처럼 전체
 * 24시간 분량을 보여주면 진행 띠의 "유입 7,800"과 리드타임의 "주문 15,000건"이 서로
 * 안 맞는다(정본 §16.3 "진행 중인 배치는 끝까지, 새 주문은 멈춤" — 화면 체크 s11e-5에서
 * 발견). `deriveLeadtimeResponse`·`deriveTimeline` 이 주문 수를 이 배율로 줄인다. */
export function mockRunProgressFraction(runId: number): number {
  const state = progressState.get(runId);
  return state ? state.pct / 100 : 1;
}

export function mockRunParams(runId: number): MockResolvedParams {
  return runParamsById.get(runId) ?? BASELINE_PARAMS;
}
