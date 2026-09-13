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

export default function WarehouseMap({ onOpen3D }: { onOpen3D?: () => void }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bayRectsRef = useRef<BayRect[]>([]);
  const fitRef = useRef<{ scale: number; ox: number; oy: number; minX: number; minY: number } | null>(null);

  const { data: layout } = useLayout();
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
      ctx.fillStyle = "#1A1F28";
      ctx.fillText(`${area.code} · ${area.name}`, x + 6, y + 16);
    }

    // ── 존 구획선
    ctx.strokeStyle = "#5A6B7A"; ctx.setLineDash([5, 4]); ctx.lineWidth = 1;
    for (const zone of layout.zones) {
      const rect = zoneWorldRect(zone);
      ctx.strokeRect(px(X(rect.x0)), px(Y(rect.y0)), Math.round((rect.x1 - rect.x0) * scale), Math.round((rect.y1 - rect.y0) * scale));
    }
    ctx.setLineDash([]);

    // ── 베이 블록 — 점유율 5단계 색, 클릭용 사각형을 함께 기록한다
    const rects: BayRect[] = [];
    for (const bay of layout.bays) {
      const box = bayBox(bay, index);
      if (!box) continue;
      const bx = X(box.cx - box.width / 2), by = Y(box.cy - box.depth / 2);
      const bw = box.width * scale, bh = box.depth * scale;
      const isHot = hoveredBay?.id === bay.id || selectedBay?.id === bay.id;
      ctx.fillStyle = hexToRgba(OCCUPANCY_COLORS[occupancyTier(box.occupancyRatio)], 1);
      ctx.fillRect(bx, by, bw, bh);
      ctx.strokeStyle = isHot ? "#FF8A2A" : "#000000";
      ctx.lineWidth = isHot ? 2 : 1;
      ctx.strokeRect(px(bx), px(by), Math.max(1, Math.round(bw)), Math.max(1, Math.round(bh)));
      rects.push({ x: bx, y: by, w: bw, h: bh, bay });
    }
    bayRectsRef.current = rects;
  };

  useEffect(() => {
    draw();
    const wrap = wrapRef.current;
    if (!wrap) return;
    const ro = new ResizeObserver(draw);
    ro.observe(wrap);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout, index, hoveredBay, selectedBay]);

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
