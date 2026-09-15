/**
 * `GET/POST /admin/simulation/**` 표본 — 시나리오·실행 상태 (Stage 11E, 정본 §16).
 * 계산식(리드타임·타임라인·병목·비교)은 `simulation-metrics.ts` 로 뺐다(파일 300줄
 * 상한, `use-slotting.ts`/`use-slotting-mutations.ts` 와 같은 이유).
 *
 * 2026-09-15 시점 백엔드는 같은 브랜치에서 동시 작업 중이라(브리프 머리말) 전부 404다.
 * `use-simulation.ts`·`use-simulation-mutations.ts`가 `use-slotting.ts`(11B, 백엔드
 * 붙기 전)와 같은 관례로 이 표본을 쓴다 — 조회는 실패 시 대신 그리고, 뮤테이션은
 * route-not-found(404)에 한해 이 파일의 가변 상태를 직접 써서 "시나리오 생성 → 실행 →
 * 진행 → 완료 → 리드타임·비교" 흐름을 재현한다.
 */

import {
  simulationRunId,
  type SimulationParams,
  type SimulationRun,
  type SimulationRunProgress,
  type SimulationRunStatus,
  type SimulationScenario,
  type SimulationScenarioParams,
} from "../types";

export const mockSimulationParams: SimulationParams = {
  center: "C1",
  walkSpeedMps: 1.0,
  pickLineSec: 12,
  levelPenaltySec: 3,
  rebinSecPerItem: 9,
  packBaseSec: 45,
  packSecPerItem: 5,
  batchPrepSec: 30,
  compression: 100,
};

export const BASELINE_PARAMS: SimulationScenarioParams = {
  durationHours: 24,
  orderProfile: "default",
  customProfile: null,
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
  { id: 1, center: "C1", name: "baseline", params: BASELINE_PARAMS, createdAt: "2026-09-15T00:00:00Z" },
  {
    id: 2,
    center: "C1",
    name: "pickers+5",
    params: { ...BASELINE_PARAMS, pickers: 27, seed: 20260916 },
    createdAt: "2026-09-15T00:05:00Z",
  },
  {
    id: 3,
    center: "C1",
    name: "batch30",
    params: { ...BASELINE_PARAMS, batchSize: 30, seed: 20260917 },
    createdAt: "2026-09-15T00:10:00Z",
  },
  {
    id: 4,
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
    id: 101,
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
    id: 102,
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
    id: 103,
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

/** 화면에서 만든 시나리오(`mockCreateScenario`) — 시드 4개와 분리해 둔다. `mockScenarioById`
 * 가 둘 다 찾아야 새로 만든 시나리오의 실행도 리드타임·타임라인·병목을 낼 수 있다(이걸
 * 놓쳐서 "결과" 패널이 "불러오는 중…"에 멈춰 있던 결함을 2026-09-15 화면 체크에서
 * 발견 — `use-simulation-mutations.ts` 가 이 배열을 몰라 자기 모듈에 따로 들고 있었다). */
const createdScenarios: SimulationScenario[] = [];
let nextScenarioId = 900;

export function mockScenarioById(id: number): SimulationScenario | null {
  return mockScenarios.find((s) => s.id === id) ?? createdScenarios.find((s) => s.id === id) ?? null;
}

export function mockListScenarios(center: string): SimulationScenario[] {
  return [...mockScenarios, ...createdScenarios].filter((s) => s.center === center);
}

/** "생성" 버튼의 404 폴백 */
export function mockCreateScenario(body: { center: string; name: string; params: SimulationScenarioParams }): SimulationScenario {
  const scenario: SimulationScenario = {
    id: nextScenarioId++,
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

const runParamsById = new Map<number, SimulationScenarioParams>();
for (const run of mockRuns) {
  const scenario = mockScenarioById(run.scenarioId);
  if (scenario) runParamsById.set(simulationRunId(run), scenario.params);
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
    id: nextRunId++,
    scenarioId: scenario.id,
    status: "RUNNING",
    compression: mockSimulationParams.compression,
    virtualStart: "2026-09-15T00:00:00",
    virtualEnd: null,
    realStartedAt: new Date().toISOString(),
    realFinishedAt: null,
    outboxSeqFrom: 700000,
    outboxSeqTo: null,
    error: null,
  };
  allRuns.unshift(run);
  runParamsById.set(simulationRunId(run), scenario.params);
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
  const virtualElapsedMs = Math.round(params.durationHours * 3600_000 * frac);
  const virtualNow = new Date(virtualElapsedMs).toISOString().slice(11, 19);

  return {
    id: runId,
    status: state.status,
    virtualNow: `${Math.floor(virtualElapsedMs / 3_600_000)}h ${virtualNow.slice(3, 5)}m`,
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

export function mockRunParams(runId: number): SimulationScenarioParams {
  return runParamsById.get(runId) ?? BASELINE_PARAMS;
}
