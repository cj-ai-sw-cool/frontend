"use client";

/**
 * 분석 화면 — 실시간 창고 맵 (2D 탑다운). Stage 11(11.0) 재작성 — 존 7개 두 줄 배치를
 * 전제하던 옛 `warehouse-map.jsx`(`lib/zone-layout.ts` 기반)를 걷어내고, 3D
 * (`warehouse-slot-3d.tsx`)와 같은 `GET /layout`(`use-layout.ts`)·같은 좌표 변환
 * (`layout/layout-geometry.ts`)을 그린다(브리프 §2 "2D 는 같은 데이터의 탑다운").
 *
 * ⚠️ 움직이는 AGV·지게차·작업자(옛 파일의 "시연용 궤적")는 뺐다 — 61일 정적 물동량
 *   실측 시절 "지도가 살아 있다"를 보이던 장치였는데, 새 레이아웃 계약(칸을 그리지
 *   않는다)·브리프 화면 체크 어디에도 요구되지 않는다(노트 "뺀 기능" 표).
 * ⚠️ 베이 클릭이 이제 **두 가지 뜻**을 가진다 — 빈 곳 클릭은 여전히 3D 전체 화면을
 *   열고(`onOpen3D`), 베이 위 클릭은 우측에 그 베이의 칸 격자를 편다(브리프 §2 "클릭
 *   동작 동일" — 3D 베이 클릭과 같은 결과를 2D 에서도 보여준다).
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useCenter } from "@/lib/center";
import type { Bay } from "@/lib/types";
import { useBayBins, useLayout } from "../_data/use-layout";
import { BayDetailPanel } from "./layout/bay-detail";
import {
  bayBox,
  bayDisplayCode,
  buildLayoutIndex,
  hexToRgba,
  layoutBounds,
  OCCUPANCY_COLORS,
  occupancyTier,
  zoneWorldRect,
} from "./layout/layout-geometry";
import { MAP_FONT, MAP_FLOOR } from "./warehouse-data";

const AREA_FILL: Record<string, string> = {
  STORAGE: "#C9C9C9",
  RECEIVING: "#C7D2BE",
  PACKING: "#D8CBB0",
  RETURNS: "#D8BEBE",
};

interface BayRect {
  x: number;
  y: number;
  w: number;
  h: number;
  bay: Bay;
}

export default function WarehouseMap({
  onOpen3D,
  heatmapLines,
  goldenBayIds,
}: {
  onOpen3D?: () => void;
  /** Stage 11B 슬로팅 탭 — 있으면 점유율 대신 이 베이별 PICK 라인 수로 5단계 색을 칠한다
   * (정본 §15.9 "베이 색 = 히트맵 라인 수"). 없으면 기존 점유율 색(창고 맵 기본 모드). */
  heatmapLines?: Map<number, number> | null;
  /** 골든존 테두리 토글 — 켜져 있으면 이 집합에 든 베이만 금색 테두리를 덧그린다(정본 §15.9) */
  goldenBayIds?: Set<number> | null;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bayRectsRef = useRef<BayRect[]>([]);
  const fitRef = useRef<{ scale: number; ox: number; oy: number; minX: number; minY: number } | null>(null);

  const center = useCenter();
  const { data: layout } = useLayout(center);
  const index = useMemo(() => (layout ? buildLayoutIndex(layout) : null), [layout]);

  const [hoveredBay, setHoveredBay] = useState<Bay | null>(null);
  const [selectedBay, setSelectedBay] = useState<Bay | null>(null);
  const { data: bins, isLoading: binsLoading } = useBayBins(selectedBay?.id ?? null);

  const draw = () => {
    const wrap = wrapRef.current, cvs = canvasRef.current;
    if (!wrap || !cvs || !layout || !index) return;
    const bounds = layoutBounds(layout);
    const pad = 2;
    const worldW = bounds.x1 - bounds.x0 + pad * 2;
    const worldD = bounds.y1 - bounds.y0 + pad * 2;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(10, wrap.clientWidth), h = Math.max(10, wrap.clientHeight);
    cvs.width = w * dpr; cvs.height = h * dpr;
    cvs.style.width = `${w}px`; cvs.style.height = `${h}px`;
    const ctx = cvs.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const scale = Math.min(w / worldW, h / worldD);
    const ox = (w - worldW * scale) / 2;
    const oy = (h - worldD * scale) / 2;
    const minX = bounds.x0 - pad, minY = bounds.y0 - pad;
    fitRef.current = { scale, ox, oy, minX, minY };
    const X = (x: number) => ox + (x - minX) * scale;
    const Y = (y: number) => oy + (y - minY) * scale;
    const px = (v: number) => Math.round(v) + 0.5;

    ctx.fillStyle = "#C6C6C6";
    ctx.fillRect(0, 0, w, h);

    const bevel = (x: number, y: number, bw: number, bh: number, out: boolean) => {
      ctx.lineWidth = 1;
      ctx.strokeStyle = out ? "#FFFFFF" : "#808080";
      ctx.beginPath();
      ctx.moveTo(px(x), px(y + bh)); ctx.lineTo(px(x), px(y)); ctx.lineTo(px(x + bw), px(y));
      ctx.stroke();
      ctx.strokeStyle = out ? "#808080" : "#FFFFFF";
      ctx.beginPath();
      ctx.moveTo(px(x + bw), px(y)); ctx.lineTo(px(x + bw), px(y + bh)); ctx.lineTo(px(x), px(y + bh));
      ctx.stroke();
    };

    // ── 방(Area) — 종류별 바닥판, 냉장·냉동은 점선 테두리로 "닫힌 방" 표시
    /* ⚠️ 라벨 글자는 **여기서 그리지 않고 목록에 쌓아 두었다가 맨 마지막에** 그린다
     * (옛 warehouse-map.jsx 와 같은 이유). 방을 그리는 이 시점에 바로 쓰면, 그 존(예
     * AMB 안 AMBS)이 방 상단 바로 밑에서 시작할 때 뒤이어 그리는 존 구획선·베이
     * 블록이 라벨 위를 덮어 버린다(2026-09-13 재확인 — AMB 라벨이 안 보였다) */
    const areaLabels: { text: string; x: number; y: number; align: CanvasTextAlign }[] = [];
    ctx.font = `700 13px ${MAP_FONT}`;
    for (const area of layout.areas) {
      const x = X(area.xM), y = Y(area.yM), aw = area.wM * scale, ah = area.dM * scale;
      ctx.fillStyle = MAP_FLOOR;
      ctx.fillRect(x, y, aw, ah);
      ctx.fillStyle = AREA_FILL[area.kind] ?? "#C9C9C9";
      ctx.globalAlpha = 0.55;
      ctx.fillRect(x, y, aw, ah);
      ctx.globalAlpha = 1;
      bevel(x, y, aw, ah, false);
      const cold = area.tempZone === "CHILLED" || area.tempZone === "FROZEN";
      if (cold) {
        ctx.strokeStyle = "#000000"; ctx.setLineDash([4, 3]);
        ctx.strokeRect(px(x), px(y), Math.round(aw), Math.round(ah));
        ctx.setLineDash([]);
      }
      /* 라벨 자리 — 방이 좁으면(라이브 CHL 4.2m·FRZ 2.8m 처럼) 안에 넣으면 옆 방
       * 라벨과 겹친다. 폭이 모자라면 방 위쪽 바깥으로 빼고 이름 없이 코드만 남긴다.
       * 존이 방을 거의 채우는 경우(AMB)도 안이 아니라 방 위쪽 바깥에 둔다 — 안에
       * 자리를 비워 두는 계산은 존 배치가 바뀔 때마다 깨진다, 바깥은 늘 비어 있다. */
      const fullLabel = `${area.code} · ${area.name}`;
      if (aw < 70) {
        areaLabels.push({ text: area.code, x: x + aw / 2, y: y - 4, align: "center" });
      } else {
        const label = ctx.measureText(fullLabel).width <= aw - 12 ? fullLabel : area.code;
        areaLabels.push({ text: label, x: x + aw / 2, y: y - 4, align: "center" });
      }
    }

    // ── 존 구획선
    ctx.strokeStyle = "#5A6B7A"; ctx.setLineDash([5, 4]); ctx.lineWidth = 1;
    for (const zone of layout.zones) {
      const rect = zoneWorldRect(zone);
      ctx.strokeRect(px(X(rect.x0)), px(Y(rect.y0)), Math.round((rect.x1 - rect.x0) * scale), Math.round((rect.y1 - rect.y0) * scale));
    }
    ctx.setLineDash([]);

    // ── 베이 블록 — 점유율(기본) 또는 히트맵 라인 수(슬로팅 탭) 5단계 색
    /* Stage 11B — `heatmapLines` 가 있으면 그 최댓값을 1.0 으로 놓고 같은 5단계 경계
     * (`occupancyTier`)를 재사용한다. 베이 색의 "뜻"만 바뀔 뿐 계산·팔레트는 그대로다
     * (정본 §15.9 "베이 색 = 히트맵 라인 수", `warehouse-map.tsx` 재사용 지시). */
    const maxHeat = heatmapLines ? Math.max(1, ...heatmapLines.values()) : 1;
    const rects: BayRect[] = [];
    for (const bay of layout.bays) {
      const box = bayBox(bay, index);
      if (!box) continue;
      const bx = X(box.cx - box.width / 2), by = Y(box.cy - box.depth / 2);
      const bw = box.width * scale, bh = box.depth * scale;
      const isHot = hoveredBay?.id === bay.id || selectedBay?.id === bay.id;
      const ratio = heatmapLines ? (heatmapLines.get(bay.id) ?? 0) / maxHeat : box.occupancyRatio;
      ctx.fillStyle = hexToRgba(OCCUPANCY_COLORS[occupancyTier(ratio)], 1);
      ctx.fillRect(bx, by, bw, bh);
      const isGolden = goldenBayIds?.has(bay.id) ?? false;
      ctx.strokeStyle = isHot ? "#FF8A2A" : isGolden ? "#F0C020" : "#000000";
      ctx.lineWidth = isHot || isGolden ? 2 : 1;
      ctx.strokeRect(px(bx), px(by), Math.max(1, Math.round(bw)), Math.max(1, Math.round(bh)));
      rects.push({ x: bx, y: by, w: bw, h: bh, bay });
    }
    bayRectsRef.current = rects;

    // ── 방 라벨 — 맨 마지막에, 항상 방 위쪽 바깥에(위 areaLabels 주석 참고)
    ctx.font = `700 13px ${MAP_FONT}`;
    ctx.fillStyle = "#1A1F28";
    ctx.textAlign = "center";
    for (const label of areaLabels) ctx.fillText(label.text, label.x, label.y);
    ctx.textAlign = "left";
  };

  useEffect(() => {
    draw();
    const wrap = wrapRef.current;
    if (!wrap) return;
    const ro = new ResizeObserver(draw);
    ro.observe(wrap);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout, index, hoveredBay, selectedBay, heatmapLines, goldenBayIds]);

  const hitTest = (clientX: number, clientY: number): Bay | null => {
    const cvs = canvasRef.current;
    if (!cvs) return null;
    const rect = cvs.getBoundingClientRect();
    const x = clientX - rect.left, y = clientY - rect.top;
    const hit = bayRectsRef.current.find((r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h);
    return hit?.bay ?? null;
  };

  if (!layout || !index) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center bg-[#10151C] text-[13px] text-[#8FA3B8]">
        레이아웃 불러오는 중…
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1">
      <div
        ref={wrapRef}
        className="wm-map relative min-h-0 flex-1 overflow-hidden"
        style={{ background: "#10151C", border: "2px solid", borderColor: "#404040 #FFF #FFF #404040" }}
        onMouseMove={(e) => setHoveredBay(hitTest(e.clientX, e.clientY))}
        onMouseLeave={() => setHoveredBay(null)}
        onClick={(e) => {
          const bay = hitTest(e.clientX, e.clientY);
          if (bay) setSelectedBay(bay);
          else onOpen3D?.();
        }}
      >
        <canvas ref={canvasRef} className="absolute inset-0 cursor-pointer" />
        {hoveredBay ? (
          <div className="pointer-events-none absolute top-2 left-2 rounded border border-black/40 bg-[rgba(12,17,24,.86)] px-2 py-1 font-mono text-xs font-bold text-white">
            {bayDisplayCode(hoveredBay)} · {hoveredBay.occupiedBins}/{hoveredBay.totalBins}
          </div>
        ) : null}
      </div>
      {selectedBay ? (
        <BayDetailPanel bay={selectedBay} bins={bins} isLoading={binsLoading} onClose={() => setSelectedBay(null)} />
      ) : null}
    </div>
  );
}
