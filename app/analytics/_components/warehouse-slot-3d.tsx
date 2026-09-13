"use client";

/**
 * 창고 3D 전체 화면 — Stage 11(11.0) 재작성. 옛 `warehouse-slot-3d.jsx`(2,348줄, 존 7개
 * 두 줄 배치 + 내부 "지도/3D" 탭)의 후계다. 두 가지를 걷어냈다:
 *
 * - 내부 "지도" 탭 — 이 컴포넌트를 여는 유일한 호출부(`app/analytics/page.tsx`)가 항상
 *   `initialTab="3d"` 로 열었다(2D는 페이지의 `WarehouseMap` 패널이 따로 맡는다) — 죽은
 *   분기였다. 2D 는 이제 `warehouse-map.tsx` 하나로 합친다.
 * - 적재 시뮬레이션·타임라인 — 61일 정적 물동량 실측 시절 기능이라 Stage 2 에서 이미
 *   `applyOccupancy` 로 대체됐던 자리인데, 브리프(§2)가 요구하는 화면 체크에 없고 새
 *   레이아웃 계약(칸을 그리지 않는다)과 맞지 않아 뺐다. 노트 "남긴 기능/뺀 기능" 표 참고.
 *
 * 남긴 것: 좌상단 점유율 대시보드·우측 규격(존) 범례 — 데이터 출처를 `GET
 * /stock/occupancy` 인스턴스 집계에서 `GET /zones/summary`(존별 합계)로 바꿨을 뿐,
 * 자리와 뜻은 그대로다.
 */

import { useMemo, useRef, useState } from "react";
import { useCenter } from "@/lib/center";
import { useControlMode } from "../_data/use-control-mode";
import { useZonesSummary } from "../_data/use-inventory";
import { useBayBins, useLayout } from "../_data/use-layout";
import { BayDetailPanel } from "./layout/bay-detail";
import type { ControlOverlay } from "./layout/control-overlay";
import { bayDisplayCode, buildLayoutIndex } from "./layout/layout-geometry";
import { LayoutScene, type LayoutSceneApi } from "./layout/layout-scene";
import { ControlToolbar } from "./control-toolbar";
import { KpiPanel } from "./kpi-panel";
import { ReplayScrubber } from "./replay-scrubber";
import type { Bay } from "@/lib/types";

export interface WarehouseApi {
  setHighlight: (id: string | null) => void;
  flyTo: (id: string) => void;
  resetView: () => void;
}

export default function WarehouseSlot3D({
  onReady,
  initialHighlight = null,
}: {
  onReady?: (api: WarehouseApi) => void;
  initialHighlight?: string | null;
}) {
  const center = useCenter();
  const { data: layout, usingMock, isLoading } = useLayout(center);
  const { data: zonesSummary } = useZonesSummary();

  const [hoveredBay, setHoveredBay] = useState<Bay | null>(null);
  const [selectedBay, setSelectedBay] = useState<Bay | null>(null);
  const [selectedZone, setSelectedZone] = useState<string | null>(initialHighlight);
  const [controlMode, setControlMode] = useState(false);
  const apiRef = useRef<LayoutSceneApi | null>(null);

  const control = useControlMode(center);
  const handleControlReady = (overlay: ControlOverlay | null) => control.setControlOverlay(overlay);

  const { data: bins, isLoading: binsLoading } = useBayBins(selectedBay?.id ?? null);
  const index = useMemo(() => (layout ? buildLayoutIndex(layout) : null), [layout]);

  const summaryByCode = useMemo(() => new Map((zonesSummary ?? []).map((z) => [z.code, z])), [zonesSummary]);
  const totals = useMemo(() => {
    const rows = zonesSummary ?? [];
    const binCount = rows.reduce((sum, z) => sum + z.binCount, 0);
    const occupiedBins = rows.reduce((sum, z) => sum + z.occupiedBins, 0);
    return { binCount, occupiedBins, ratio: binCount > 0 ? (occupiedBins / binCount) * 100 : 0 };
  }, [zonesSummary]);

  const handleReady = (api: LayoutSceneApi) => {
    apiRef.current = api;
    onReady?.({
      setHighlight: (id) => {
        setSelectedZone(id);
        api.setHighlight(id);
      },
      flyTo: api.flyTo,
      resetView: () => {
        setSelectedZone(null);
        api.resetView();
      },
    });
  };

  const selectZone = (code: string | null) => {
    setSelectedZone(code);
    apiRef.current?.setHighlight(code);
    if (code) apiRef.current?.flyTo(code);
    else apiRef.current?.resetView();
  };

  if (isLoading || !layout || !index) {
    return (
      <div className="flex h-full items-center justify-center bg-[#10151C] text-sm text-[#8FA3B8]">
        레이아웃 불러오는 중…
      </div>
    );
  }

  return (
    <div className="relative flex h-full w-full bg-[#10151C] text-[#E8EDF4]">
      <div className="relative min-h-0 min-w-0 flex-1">
        <LayoutScene
          layout={layout}
          selectedBay={selectedBay}
          selectedBins={bins}
          onHoverBay={setHoveredBay}
          onSelectBay={setSelectedBay}
          onReady={handleReady}
          initialHighlight={initialHighlight}
          controlMode={controlMode}
          onControlReady={handleControlReady}
        />

        <ControlToolbar
          controlMode={controlMode}
          onToggleControlMode={() => setControlMode((v) => !v)}
          source={control.source}
          onStartReplay={control.startReplay}
          onStopReplay={control.stopReplay}
          speed={control.speed}
          onSpeedChange={control.setSpeed}
          paused={control.paused}
          onTogglePause={() => control.setPaused((v) => !v)}
          connected={control.stream.connected}
          usingMock={control.stream.usingMock}
          lagMs={control.stream.lagMs}
        />

        {/* 좌상단 — 관제 모드면 이벤트 KPI, 아니면 점유율 대시보드(GET /zones/summary 합계) */}
        {controlMode ? (
          <KpiPanel center={center} recentEvents={control.stream.recent} />
        ) : (
          <div className="absolute top-4 left-4 w-64 rounded-md border border-[rgba(160,190,220,.3)] bg-[rgba(11,16,23,.72)] p-3 backdrop-blur">
            <div className="font-mono text-[10px] font-bold tracking-wider text-[#9DB0C4]">SLOT WAREHOUSE · STAGE 11</div>
            <div className="mt-1 text-sm font-bold">창고 슬롯 대시보드</div>
            <div className="mt-2 font-mono text-3xl font-bold text-[#FFC978]">
              {totals.ratio.toFixed(1)}
              <span className="ml-1 text-sm">%</span>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-1.5">
              <Stat label="채움 칸" value={totals.occupiedBins.toLocaleString()} />
              <Stat label="전체 칸" value={totals.binCount.toLocaleString()} />
              <Stat label="베이 수" value={layout.bays.length.toLocaleString()} />
              <Stat label="방 수" value={layout.areas.length.toLocaleString()} />
            </div>
            {usingMock ? (
              <p className="mt-2 rounded border border-[rgba(255,193,120,.4)] bg-[rgba(255,193,120,.12)] p-1.5 text-[10px] text-[#FFC978]">
                백엔드 /layout 미구현 — 표본(lib/mocks/layout.ts) 표시 중
              </p>
            ) : null}
            {hoveredBay ? (
              <p className="mt-2 font-mono text-[11px] text-[#DCE5EF]">
                {bayDisplayCode(hoveredBay)} · {hoveredBay.binType} · {hoveredBay.occupiedBins}/{hoveredBay.totalBins}
              </p>
            ) : null}
          </div>
        )}

        {controlMode && control.source === "replay" ? (
          <ReplayScrubber
            rangeMin={control.replayRangeMin}
            onRangeChange={control.setReplayRangeMin}
            index={control.replayIndex}
            total={control.replayTotal}
            onSeek={control.seekReplay}
            currentAt={control.replayCurrentAt}
            loading={control.replayLoading}
          />
        ) : null}

        {/* 우측 — 존 범례(선택하면 그 존으로 flyTo + 강조) */}
        <div className="absolute top-4 right-4 w-56 rounded-md border border-[rgba(160,190,220,.3)] bg-[rgba(11,16,23,.72)] p-3 backdrop-blur">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] font-bold tracking-wider text-[#9DB0C4]">ZONES</span>
            {selectedZone ? (
              <button type="button" className="text-[10px] font-bold text-[#9DB0C4] hover:text-white" onClick={() => selectZone(null)}>
                전체 보기 ✕
              </button>
            ) : null}
          </div>
          <ul className="mt-2 flex flex-col gap-1">
            {layout.zones.map((zone) => {
              const summary = summaryByCode.get(zone.code);
              const ratio = summary && summary.binCount > 0 ? (summary.occupiedBins / summary.binCount) * 100 : 0;
              return (
                <li key={zone.code}>
                  <button
                    type="button"
                    onClick={() => selectZone(zone.code)}
                    className={`flex w-full items-center justify-between rounded px-2 py-1 text-left text-xs ${
                      selectedZone === zone.code ? "bg-[rgba(255,138,42,.18)]" : "hover:bg-[rgba(255,255,255,.06)]"
                    }`}
                  >
                    <span className="font-mono font-bold">{zone.code}</span>
                    <span className="text-[#9DB0C4]">{ratio.toFixed(0)}%</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      {selectedBay ? (
        <BayDetailPanel bay={selectedBay} bins={bins} isLoading={binsLoading} onClose={() => setSelectedBay(null)} />
      ) : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-[rgba(255,255,255,.08)] bg-[rgba(255,255,255,.045)] px-2 py-1">
      <span className="block text-[10px] text-[#6E8398]">{label}</span>
      <b className="font-mono text-sm text-[#E8EDF4]">{value}</b>
    </div>
  );
}
