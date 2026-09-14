"use client";

/**
 * 분석 화면 "슬로팅" 탭 (Stage 11B, 정본 §15.9) — `analytics-page.tsx` 가 탭 전환으로
 * 이 컴포넌트를 통째로 올린다. 상단 매개변수 띠, 중단 좌(전후 비교·등급 분포) 우(2D
 * 히트맵), 하단 제안 목록 — 4개 패널을 각자 파일로 나눴다(파일 300줄 상한, `master-window.tsx`
 * 탭 관례와 같은 이유).
 */

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { useCenter } from "@/lib/center";
import { useLayout } from "../_data/use-layout";
import { useEvaluate, useGoldenZone, useHeatmap, useSlottingParams } from "../_data/use-slotting";
import { Btn, Checkbox, Panel, Select, Sunken, w98 } from "./win98-ui";
import { SlottingCompareView } from "./slotting-compare-panel";
import { SlottingParamsEditDialog } from "./slotting-params-edit-dialog";
import { SlottingProposalPanel } from "./slotting-proposal-panel";

const WarehouseMap = dynamic(() => import("./warehouse-map"), {
  ssr: false,
  loading: () => (
    <Sunken className="flex min-h-0 flex-1 items-center justify-center">
      <span className={`${w98.small} text-[color:var(--muted-foreground)]`}>맵 불러오는 중…</span>
    </Sunken>
  ),
});

const WAVE_WINDOW_OPTIONS = [5, 10, 20] as const;

export function SlottingTab() {
  const center = useCenter();
  const [waveWindow, setWaveWindow] = useState<(typeof WAVE_WINDOW_OPTIONS)[number]>(10);
  const [editOpen, setEditOpen] = useState(false);
  const [goldenOn, setGoldenOn] = useState(false);
  const [activeProposalId, setActiveProposalId] = useState<number | null>(null);

  const paramsQuery = useSlottingParams(center);
  const heatmapQuery = useHeatmap(center);
  const goldenZoneQuery = useGoldenZone(center, goldenOn);
  /* 제안이 없을 때만 "현재" 평가를 따로 부른다 — 제안이 있으면 비교 패널이 그 제안의
   * before/after 를 쓴다(브리프 §1 "제안 없으면 evaluate만 현재"). waveIds 는 데모 웨이브
   * 1~N을 그대로 쓴다 — 실제 "최근 웨이브 N개" 목록 조회는 이 탭의 범위 밖(웨이브 탭이
   * 이미 가진 목록)이라 순번을 그대로 생성한다. */
  const evaluateRequest = useMemo(
    () =>
      activeProposalId === null
        ? { center, waveIds: Array.from({ length: waveWindow }, (_, i) => i + 1) }
        : null,
    [center, waveWindow, activeProposalId],
  );
  const evaluateQuery = useEvaluate(evaluateRequest);

  /* `lib/mocks/slotting.ts` 표본의 베이 id(101~116)는 `lib/mocks/layout.ts` 표본의
   * AMBS 통로 채번을 그대로 따른 것이다 — 하지만 `GET /layout`(§11) 은 이 화면과 별개로
   * 이미 라이브라 실제 베이 id 가 다르다(순번이 1부터). 그래서 표본을 쓰는 동안에는
   * 지금 로드된 레이아웃의 AMBS 베이 id 로 자리만 바꿔 낀다 — 2D 지도가 실제로 칠할 수
   * 있는 베이를 가리키게 하기 위해서다. 라이브 히트맵이 붙으면 이 리매핑은 자연히
   * 타지 않는다(`usingMock` 이 꺼진다). */
  const { data: layout } = useLayout(center);
  const ambsBayIds = useMemo(() => {
    const bays = layout?.bays.filter((b) => b.zoneCode === "AMBS") ?? [];
    return [...bays].sort((a, b) => a.no - b.no).map((b) => b.id);
  }, [layout]);

  const heatmapByBay = useMemo(() => {
    if (!heatmapQuery.data) return null;
    const remap = heatmapQuery.usingMock && ambsBayIds.length > 0;
    return new Map(
      heatmapQuery.data.map((row, i) => [remap ? (ambsBayIds[i % ambsBayIds.length] ?? row.bayId) : row.bayId, row.lines]),
    );
  }, [heatmapQuery.data, heatmapQuery.usingMock, ambsBayIds]);

  const goldenBayIds = useMemo(() => {
    if (!goldenOn || !goldenZoneQuery.data) return null;
    const remap = goldenZoneQuery.usingMock && ambsBayIds.length > 0;
    return new Set(
      goldenZoneQuery.data.map((row, i) => (remap ? (ambsBayIds[i % ambsBayIds.length] ?? row.bayId) : row.bayId)),
    );
  }, [goldenOn, goldenZoneQuery.data, goldenZoneQuery.usingMock, ambsBayIds]);

  const params = paramsQuery.data;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      {/* ── 상단 띠 — 매개변수 요약 + 편집 + 평가 대상 ─────────────────────── */}
      <Panel title="슬로팅 매개변수" className="h-[74px] shrink-0">
        <div className="flex h-full items-center gap-4">
          {params ? (
            <Sunken className={`${w98.mono} flex flex-1 items-center gap-4 px-3 py-1.5 text-[12px]`}>
              <span>속도 {params.walkSpeedMps}m/s</span>
              <span>라인당 {params.secPerLine}초</span>
              <span>단 페널티 {params.levelPenaltySec}초</span>
              <span>골든존 {Math.round(params.goldenShare * 100)}%</span>
              <span>무게 {params.heavyKg}kg↑</span>
              <span>집계 {params.velocityDays}일</span>
            </Sunken>
          ) : (
            <Sunken className={`${w98.small} flex flex-1 items-center px-3 text-[color:var(--muted-foreground)]`}>
              불러오는 중…
            </Sunken>
          )}
          <Btn onClick={() => setEditOpen(true)} className="h-8 px-3 text-[12px]">
            편집
          </Btn>
          <label className="flex items-center gap-1.5">
            <span className={`${w98.small} text-[color:var(--muted-foreground)]`}>평가 대상</span>
            <Select
              value={waveWindow}
              onChange={(e) => setWaveWindow(Number(e.target.value) as (typeof WAVE_WINDOW_OPTIONS)[number])}
              className="h-8 w-32 text-[12px]"
            >
              {WAVE_WINDOW_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  최근 웨이브 {n}
                </option>
              ))}
            </Select>
          </label>
        </div>
      </Panel>

      {/* ── 중단 — 좌 전후 비교, 우 2D 히트맵 ──────────────────────────────── */}
      <div className="flex min-h-0 flex-1 gap-2">
        <Panel title="전후 비교 · 등급 분포" className="min-h-0 min-w-0 flex-[1.1]">
          <SlottingCompareView
            center={center}
            waveWindow={waveWindow}
            activeProposalId={activeProposalId}
            evaluateTotals={evaluateQuery.data?.totals ?? null}
          />
        </Panel>

        <Panel
          title="2D 히트맵 — 베이별 피킹 라인 수"
          right={<Checkbox label="골든존 테두리" checked={goldenOn} onToggle={() => setGoldenOn((v) => !v)} />}
          className="min-h-0 min-w-0 flex-1"
        >
          <Sunken className="flex min-h-0 flex-1 flex-col p-1.5">
            <WarehouseMap heatmapLines={heatmapByBay} goldenBayIds={goldenBayIds} />
          </Sunken>
        </Panel>
      </div>

      {/* ── 하단 — 제안 목록 ────────────────────────────────────────────── */}
      <Panel title="재배치 제안" className="h-[300px] shrink-0">
        <SlottingProposalPanel
          center={center}
          waveWindow={waveWindow}
          activeProposalId={activeProposalId}
          onProposalChange={setActiveProposalId}
        />
      </Panel>

      <SlottingParamsEditDialog open={editOpen} onOpenChange={setEditOpen} center={center} current={params ?? null} />
    </div>
  );
}
