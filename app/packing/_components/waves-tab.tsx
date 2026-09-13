"use client";

import { useCallback, useState } from "react";
import { useCenter } from "@/lib/center";
import type { WaveStatus } from "@/lib/types";
import { usePickBatchDetail, useWaveDetail, useWavesList } from "../_data/use-waves";
import { BatchDetailPanel } from "./batch-detail-panel";
import { RebinSimulateDialog } from "./rebin-simulate-dialog";
import { WaveBatchSimulateDialog } from "./wave-batch-simulate-dialog";
import { WaveDetailPanel } from "./wave-detail-panel";
import { WaveListPanel } from "./wave-list-panel";

const PAGE_SIZE = 20;

/**
 * "웨이브" 탭 — 정본 §6.7, 브리프 §3 S6.5.
 *
 * "주문" 탭(`orders-tab.tsx`)과 같은 관례로 이 컴포넌트가 자기 상태·데이터 훅을 통째로
 * 들고 있다. 3열: 목록(300) · 상세(flex-1, 주문+배치+skipped) · 피킹 지시(flex-1, 배치
 * 클릭 시 채워짐) — 웨이브 상세의 배치 표를 클릭하면 오른쪽 열이 그 배치의 태스크로 바뀐다.
 */
export function WavesTab() {
  const center = useCenter();
  const [statusFilter, setStatusFilter] = useState<WaveStatus | "ALL">("ALL");
  const [page, setPage] = useState(0);
  const [selectedWaveId, setSelectedWaveId] = useState<number | null>(null);
  const [selectedBatchId, setSelectedBatchId] = useState<number | null>(null);
  /** "자동 처리" 대화 상자가 여는 배치 — 오른쪽 열 선택(`selectedBatchId`)과는 별개다.
   * 목록 행을 클릭하지 않고도 자동 처리를 열 수 있어야 한다(브리프 §3 S7.6). */
  const [simulateBatchId, setSimulateBatchId] = useState<number | null>(null);
  /** "리빈 자동 처리" 대화 상자가 여는 배치 — `rebin-panel.tsx`의 버튼이 연다(정본 §8.1,
   * 브리프 §3 S8.3). 오른쪽 열의 리빈 탭에서만 열리므로 `selectedBatchId`가 항상 채워져
   * 있지만, 대화 상자 자체의 열림 상태는 이 값으로 따로 관리한다(위 `simulateBatchId`와
   * 같은 이유). */
  const [rebinBatchId, setRebinBatchId] = useState<number | null>(null);

  const wavesQuery = useWavesList({
    center,
    status: statusFilter === "ALL" ? undefined : statusFilter,
    page,
    size: PAGE_SIZE,
  });
  const waveDetailQuery = useWaveDetail(selectedWaveId);
  const pickBatchQuery = usePickBatchDetail(selectedBatchId);

  const wavesPage = wavesQuery.data;
  const wave = waveDetailQuery.data ?? null;
  const batch = pickBatchQuery.data ?? null;

  const handleStatusFilterChange = useCallback((status: WaveStatus | "ALL") => {
    setStatusFilter(status);
    setPage(0);
  }, []);

  /** 다른 웨이브를 고르면 오른쪽 피킹 지시는 비운다 — 이전 웨이브의 배치 id 가 새 웨이브에는
   * 없는 배치를 가리킬 수 있다 */
  const handleSelectWave = useCallback((id: number) => {
    setSelectedWaveId(id);
    setSelectedBatchId(null);
  }, []);

  return (
    <div className="relative flex min-h-0 flex-1 gap-2">
      <WaveListPanel
        items={wavesPage?.content ?? []}
        isLoading={wavesQuery.isLoading}
        errorMessage={wavesQuery.error?.message ?? null}
        statusFilter={statusFilter}
        onStatusFilterChange={handleStatusFilterChange}
        selectedId={selectedWaveId}
        onSelect={handleSelectWave}
        page={wavesPage?.number ?? page}
        totalPages={wavesPage?.totalPages ?? 0}
        onPageChange={setPage}
        className="w-[300px] shrink-0"
      />

      <WaveDetailPanel
        wave={wave}
        isLoading={waveDetailQuery.isLoading}
        errorMessage={waveDetailQuery.error?.message ?? null}
        selectedBatchId={selectedBatchId}
        onSelectBatch={setSelectedBatchId}
        onSimulateBatch={setSimulateBatchId}
        className="w-[380px] shrink-0"
      />

      <BatchDetailPanel
        key={selectedBatchId ?? "none"}
        batch={batch}
        isLoading={pickBatchQuery.isLoading}
        errorMessage={pickBatchQuery.error?.message ?? null}
        onOpenRebin={setRebinBatchId}
      />

      <WaveBatchSimulateDialog
        batchId={simulateBatchId}
        onOpenChange={(open) => {
          if (!open) setSimulateBatchId(null);
        }}
      />

      <RebinSimulateDialog
        pickBatchId={rebinBatchId}
        onOpenChange={(open) => {
          if (!open) setRebinBatchId(null);
        }}
      />
    </div>
  );
}
