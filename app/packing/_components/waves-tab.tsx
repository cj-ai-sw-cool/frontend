"use client";

import { useCallback, useState } from "react";
import type { WaveStatus } from "@/lib/types";
import { usePickBatchDetail, useWaveDetail, useWavesList } from "../_data/use-waves";
import { PickTaskPanel } from "./pick-task-panel";
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
  const [statusFilter, setStatusFilter] = useState<WaveStatus | "ALL">("ALL");
  const [page, setPage] = useState(0);
  const [selectedWaveId, setSelectedWaveId] = useState<number | null>(null);
  const [selectedBatchId, setSelectedBatchId] = useState<number | null>(null);

  const wavesQuery = useWavesList({
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
        className="w-[380px] shrink-0"
      />

      <PickTaskPanel
        batch={batch}
        isLoading={pickBatchQuery.isLoading}
        errorMessage={pickBatchQuery.error?.message ?? null}
      />
    </div>
  );
}
