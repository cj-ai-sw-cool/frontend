"use client";

/**
 * 관제 모드 도구줄 — 브리프 §2 "3D 관제 모드" 토글·라이브/리플레이·배속·일시정지, 우상단
 * "연출 — 위치는 마지막 태스크 기준" 표시(정본 §13.1 "연출이고 기록이 아님을 화면에
 * 표시"). `warehouse-slot-3d.tsx`가 상태(`use-control-mode.ts`)를 들고 이 컴포넌트는
 * 표시만 한다.
 */

import type { ControlSource, PlaybackSpeed } from "../_data/use-control-mode";

const SPEEDS: PlaybackSpeed[] = [1, 4, 16];

interface ControlToolbarProps {
  controlMode: boolean;
  onToggleControlMode: () => void;
  source: ControlSource;
  onStartReplay: () => void;
  onStopReplay: () => void;
  speed: PlaybackSpeed;
  onSpeedChange: (speed: PlaybackSpeed) => void;
  paused: boolean;
  onTogglePause: () => void;
  connected: boolean;
  usingMock: boolean;
  lagMs: number | null;
}

export function ControlToolbar({
  controlMode,
  onToggleControlMode,
  source,
  onStartReplay,
  onStopReplay,
  speed,
  onSpeedChange,
  paused,
  onTogglePause,
  connected,
  usingMock,
  lagMs,
}: ControlToolbarProps) {
  return (
    <div className="absolute top-4 left-1/2 z-10 flex -translate-x-1/2 flex-col items-center gap-1.5">
      <div className="flex items-center gap-1.5 rounded-md border border-[rgba(160,190,220,.3)] bg-[rgba(11,16,23,.82)] p-1.5 backdrop-blur">
        <ToolbarButton active={controlMode} onClick={onToggleControlMode} label="관제" />

        {controlMode ? (
          <>
            <Divider />
            <ToolbarButton active={source === "live"} onClick={onStopReplay} label="라이브" />
            <ToolbarButton active={source === "replay"} onClick={onStartReplay} label="리플레이" />
            <Divider />
            {SPEEDS.map((s) => (
              <ToolbarButton key={s} active={speed === s} onClick={() => onSpeedChange(s)} label={`${s}×`} />
            ))}
            <Divider />
            <ToolbarButton active={paused} onClick={onTogglePause} label={paused ? "재생" : "일시정지"} />
            <Divider />
            <StatusBadge connected={connected} usingMock={usingMock} lagMs={lagMs} />
          </>
        ) : null}
      </div>

      {controlMode ? (
        <span className="rounded bg-[rgba(255,193,120,.14)] px-2 py-0.5 font-mono text-[10px] font-bold text-[#FFC978]">
          연출 — 위치는 마지막 태스크 기준
        </span>
      ) : null}
    </div>
  );
}

function ToolbarButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded px-2 py-1 font-mono text-[11px] font-bold transition-colors ${
        active ? "bg-[rgba(255,138,42,.28)] text-[#FFC978]" : "text-[#9DB0C4] hover:bg-[rgba(255,255,255,.08)]"
      }`}
    >
      {label}
    </button>
  );
}

function Divider() {
  return <span className="h-4 w-px bg-[rgba(160,190,220,.25)]" aria-hidden />;
}

function StatusBadge({ connected, usingMock, lagMs }: { connected: boolean; usingMock: boolean; lagMs: number | null }) {
  const label = !connected ? "연결 끊김" : usingMock ? "목 스트림" : "라이브";
  const dotColor = !connected ? "bg-[#c23b3b]" : usingMock ? "bg-[#e0c23a]" : "bg-[#3d9e7a]";
  return (
    <span className="flex items-center gap-1.5 px-1.5 font-mono text-[10px] text-[#9DB0C4]">
      <span className={`size-1.5 rounded-full ${dotColor}`} aria-hidden />
      {label}
      {lagMs !== null ? <span className="text-[#6E8398]">· lag {(lagMs / 1000).toFixed(1)}s</span> : null}
    </span>
  );
}
