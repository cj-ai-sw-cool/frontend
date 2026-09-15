"use client";

/**
 * 시뮬레이션 탭 상단 — 시나리오 목록 + 실행/정지 + 진행 띠(정본 §16.6). 행을 고르면
 * 그 시나리오의 최근 실행을 아래 결과 패널에 올린다(`onSelectRun`) — `slotting-tab.tsx`
 * 가 `activeProposalId` 를 자식에 내려주는 것과 같은 얕은 상태 끌어올리기.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys, simulation } from "@/lib/endpoints";
import { useCreateRun, useStopRun } from "../_data/use-simulation-mutations";
import { useSimulationRunProgress, useSimulationRuns, useSimulationScenarios } from "../_data/use-simulation";
import { RUN_STATUS_LABEL } from "./simulation-labels";
import { SimulationScenarioCreateDialog } from "./simulation-scenario-create-dialog";
import { Btn, Sunken, w98 } from "./win98-ui";
import type { SimulationRun, SimulationRunStatus, SimulationScenario } from "@/lib/types";

const TERMINAL_STATUSES: SimulationRunStatus[] = ["DONE", "STOPPED", "FAILED"];

export function SimulationScenarioPanel({
  center,
  selectedScenarioId,
  onSelectScenario,
  selectedRunId,
  onSelectRun,
  onOpen3D,
}: {
  center: string;
  selectedScenarioId: number | null;
  onSelectScenario: (id: number) => void;
  selectedRunId: number | null;
  onSelectRun: (id: number) => void;
  onOpen3D: () => void;
}) {
  const [createOpen, setCreateOpen] = useState(false);
  const scenarios = useSimulationScenarios(center);
  const runs = useSimulationRuns(center);
  const progress = useSimulationRunProgress(selectedRunId);
  const createRun = useCreateRun(center);
  const stopRun = useStopRun(center);
  const queryClient = useQueryClient();

  /** 실행이 끝나면(DONE/STOPPED/FAILED) "최근 실행" 칸과 결과 패널(리드타임·타임라인·
   * 병목)을 같이 갱신한다. `useCreateRun` 의 `onSuccess` 가 캐시에 한 번 써 넣은 뒤로는
   * 이 쿼리가 더 이상 404 로 실패하지 않아(`usingMock` 이 꺼진다) 목록 훅이 표본으로
   * 되돌아가지 못하고, 결과 패널도 폴링이 없어(정본 §16.4 "저장값 조회") 끝나기 전에
   * 한 번 그린 값(낮은 진행률의 표본 폴백)에 멈춰 있는다(2026-09-15 화면 체크에서
   * 둘 다 발견). `syncedRunIdRef` 로 같은 실행에 두 번 이상 반복하지 않는다 — `progress.data`
   * 는 낙관 폴백이 매 렌더 새 객체를 만들어 참조가 안정적이지 않다. */
  const syncedRunIdRef = useRef<number | null>(null);
  useEffect(() => {
    if (selectedRunId === null || !progress.data) return;
    if (!TERMINAL_STATUSES.includes(progress.data.status)) return;
    if (syncedRunIdRef.current === selectedRunId) return;
    syncedRunIdRef.current = selectedRunId;
    queryClient.setQueryData(
      queryKeys.simulationRuns({ center }),
      (old: Awaited<ReturnType<typeof simulation.runs>> | undefined) =>
        (old ?? []).map((r) => (r.id === selectedRunId ? { ...r, status: progress.data!.status } : r)),
    );
    queryClient.invalidateQueries({ queryKey: queryKeys.simulationLeadtime(selectedRunId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.simulationTimeline(selectedRunId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.simulationBottleneck(selectedRunId) });
  }, [selectedRunId, progress.data, center, queryClient]);

  /** 시나리오마다 가장 최근 실행(정본 §16.6 "최근 실행 상태" 칸) — 실행 id 는 대체로
   * 생성 순이라 내림차순으로 첫 항목을 쓴다 */
  const latestRunByScenario = useMemo(() => {
    const map = new Map<number, SimulationRun>();
    for (const run of [...(runs.data ?? [])].sort((a, b) => b.id - a.id)) {
      if (!map.has(run.scenarioId)) map.set(run.scenarioId, run);
    }
    return map;
  }, [runs.data]);

  /** 센터당 동시 실행 1개(정본 §16.3) — 이미 RUNNING 인 실행이 있으면 "실행" 버튼을 막는다 */
  const anyRunning = (runs.data ?? []).some((r) => r.status === "RUNNING");

  const handleSelectScenario = (scenario: SimulationScenario) => {
    onSelectScenario(scenario.id);
    const latest = latestRunByScenario.get(scenario.id);
    if (latest) onSelectRun(latest.id);
  };

  const handleRun = () => {
    if (selectedScenarioId === null) return;
    createRun.mutate({ scenarioId: selectedScenarioId }, { onSuccess: (run) => onSelectRun(run.id) });
  };

  const handleStop = () => {
    if (selectedRunId === null) return;
    stopRun.mutate(selectedRunId);
  };

  const isSelectedRunning = progress.data?.status === "RUNNING";

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div className="flex shrink-0 items-center gap-2">
        <span className={`${w98.small} flex-1`}>시나리오 {scenarios.data?.length ?? "…"}개</span>
        <Btn onClick={() => setCreateOpen(true)} className="h-7 px-3 text-[12px]">
          새 시나리오
        </Btn>
        <Btn
          disabled={selectedScenarioId === null || anyRunning || createRun.isPending}
          onClick={handleRun}
          className="h-7 px-3 text-[12px]"
        >
          {createRun.isPending ? "시작 중…" : "실행"}
        </Btn>
        <Btn disabled={!isSelectedRunning || stopRun.isPending} onClick={handleStop} className="h-7 px-3 text-[12px]">
          {stopRun.isPending ? "정지 중…" : "정지"}
        </Btn>
        <Btn onClick={onOpen3D} className="h-7 px-3 text-[12px]">
          3D 관제에서 보기
        </Btn>
      </div>

      <Sunken className={`${w98.scroll} min-h-0 flex-1 overflow-y-auto`}>
        <table className="w-full border-separate border-spacing-0 text-left text-[12px]">
          <thead className="sticky top-0 z-10 bg-[color:var(--surface)]">
            <tr>
              <Th>이름</Th>
              <Th>인원(피커/리빈/포장)</Th>
              <Th>배치</Th>
              <Th>토트</Th>
              <Th>슬로팅</Th>
              <Th>최근 실행</Th>
            </tr>
          </thead>
          <tbody>
            {(scenarios.data ?? []).map((scenario) => {
              const latest = latestRunByScenario.get(scenario.id);
              const selected = scenario.id === selectedScenarioId;
              return (
                <tr
                  key={scenario.id}
                  onClick={() => handleSelectScenario(scenario)}
                  className={`cursor-pointer ${selected ? "bg-[color:var(--surface-variant)]" : ""}`}
                >
                  <Td className="font-bold">{scenario.name}</Td>
                  <Td mono>
                    {scenario.params.pickers}/{scenario.params.rebinners}/{scenario.params.packers}
                  </Td>
                  <Td mono>{scenario.params.batchSize}</Td>
                  <Td mono>{scenario.params.totes}</Td>
                  <Td>{scenario.params.applySlotting ? "적용" : "—"}</Td>
                  <Td className="font-bold">{latest ? RUN_STATUS_LABEL[latest.status] : "실행 없음"}</Td>
                </tr>
              );
            })}
            {(scenarios.data ?? []).length === 0 ? (
              <tr>
                <td colSpan={6} className="border-t border-[color:var(--border)] p-3 text-center text-[color:var(--muted-foreground)]">
                  시나리오 없음 — &ldquo;새 시나리오&rdquo;로 만드세요
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </Sunken>

      {selectedRunId !== null ? (
        <ProgressBar progress={progress.data} />
      ) : (
        <p className={`${w98.small} shrink-0 text-[color:var(--muted-foreground)]`}>
          {selectedScenarioId === null ? "시나리오를 고르세요." : '"실행"을 눌러 시작하세요.'}
        </p>
      )}

      <SimulationScenarioCreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        center={center}
        onCreated={(id) => onSelectScenario(id)}
      />
    </div>
  );
}

function ProgressBar({ progress }: { progress: ReturnType<typeof useSimulationRunProgress>["data"] }) {
  if (!progress) {
    return <Sunken className="shrink-0 px-3 py-2"><span className={`${w98.small} text-[color:var(--muted-foreground)]`}>진행 불러오는 중…</span></Sunken>;
  }
  return (
    <Sunken className={`${w98.mono} flex shrink-0 items-center gap-4 px-3 py-2 text-[12px]`}>
      <span className="font-bold">{RUN_STATUS_LABEL[progress.status]}</span>
      <span>가상 시각 {progress.virtualNow}</span>
      <span>진행 {progress.progressPct}%</span>
      <span>유입 {progress.ordersReceived.toLocaleString()}</span>
      <span>출고 {progress.ordersShipped.toLocaleString()}</span>
      <span>유휴 토트 {progress.idleTotes.toLocaleString()}</span>
      <span>포장대 가동 {progress.busyPackStations}</span>
      <span>{progress.eventsPerSec}건/s</span>
    </Sunken>
  );
}

function Th({ children }: { children?: React.ReactNode }) {
  return (
    <th className="border-b-2 border-[color:var(--border)] bg-[color:var(--surface)] p-1.5 font-bold">{children}</th>
  );
}

function Td({ children, className = "", mono = false }: { children?: React.ReactNode; className?: string; mono?: boolean }) {
  return (
    <td className={`border-t border-[color:var(--border)] p-1.5 ${mono ? w98.mono : ""} ${className}`}>{children}</td>
  );
}
