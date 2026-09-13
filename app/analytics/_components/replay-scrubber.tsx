"use client";

/**
 * 리플레이 스크러버 — 브리프 §3 "스크러버: 시각 범위(기본 최근 1시간) → `GET
 * /events?…` → 같은 렌더러로 재생(배속), 위치 슬라이더·타임스탬프". `source ===
 * "replay"`일 때만 `warehouse-slot-3d.tsx`가 이 컴포넌트를 띄운다.
 */

import { parseServerInstant } from "@/lib/events-time";

const RANGE_OPTIONS = [
  { label: "최근 30분", minutes: 30 },
  { label: "최근 1시간", minutes: 60 },
  { label: "최근 4시간", minutes: 240 },
];

interface ReplayScrubberProps {
  rangeMin: number;
  onRangeChange: (minutes: number) => void;
  index: number;
  total: number;
  onSeek: (index: number) => void;
  currentAt: string | null;
  loading: boolean;
}

export function ReplayScrubber({ rangeMin, onRangeChange, index, total, onSeek, currentAt, loading }: ReplayScrubberProps) {
  return (
    <div className="absolute right-4 bottom-4 left-4 flex flex-col gap-1.5 rounded-md border border-[rgba(160,190,220,.3)] bg-[rgba(11,16,23,.82)] p-3 backdrop-blur">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {RANGE_OPTIONS.map((opt) => (
            <button
              key={opt.minutes}
              type="button"
              onClick={() => onRangeChange(opt.minutes)}
              className={`rounded px-2 py-0.5 font-mono text-[11px] font-bold ${
                rangeMin === opt.minutes ? "bg-[rgba(255,138,42,.28)] text-[#FFC978]" : "text-[#9DB0C4] hover:bg-[rgba(255,255,255,.08)]"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <span className="font-mono text-[11px] text-[#DCE5EF]">
          {loading ? "불러오는 중…" : currentAt ? formatTimestamp(currentAt) : "—"}
          {total > 0 ? <span className="ml-2 text-[#6E8398]">{index + 1}/{total}</span> : null}
        </span>
      </div>

      <input
        type="range"
        min={0}
        max={Math.max(0, total - 1)}
        value={Math.min(index, Math.max(0, total - 1))}
        onChange={(e) => onSeek(Number(e.target.value))}
        disabled={total === 0}
        className="h-1.5 w-full cursor-pointer accent-[#FF8A2A]"
      />
    </div>
  );
}

function formatTimestamp(iso: string): string {
  const ms = parseServerInstant(iso);
  return ms === null ? "—" : new Date(ms).toLocaleTimeString("ko-KR", { hour12: false });
}
