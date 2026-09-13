"use client";

/**
 * 관제 모드 상태 — 분석 화면 3D "관제" 토글이 켜졌을 때만 쓴다(브리프 §2·§3, S11A.4·
 * 11A.5). 라이브 스트림(`useEventStream`)과 리플레이(`useEventsRange`)가 **같은**
 * 적용 함수(`applyEvent`)를 거친다 — 정본 §13.5 "같은 렌더러로 재생"을 그대로
 * 만족한다: 소스만 다르고 베이 점등·마커 이동·`layout` 캐시 갱신은 한 경로다.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/endpoints";
import { parseServerInstant, toServerLocalDateTime } from "@/lib/events-time";
import { useEventStream, useEventsRange } from "@/lib/use-events";
import type { Bay, LayoutResponse, WmsEvent } from "@/lib/types";
import type { ControlOverlay } from "../_components/layout/control-overlay";
import { useOccupancy } from "./use-inventory";

export type PlaybackSpeed = 1 | 4 | 16;
export type ControlSource = "live" | "replay";

export function useControlMode(center: string) {
  const queryClient = useQueryClient();
  const overlayRef = useRef<ControlOverlay | null>(null);
  const workerLastBayRef = useRef(new Map<string, number>());

  const [source, setSource] = useState<ControlSource>("live");
  const [speed, setSpeed] = useState<PlaybackSpeed>(1);
  const [paused, setPaused] = useState(false);
  const [replayIndex, setReplayIndex] = useState(0);
  const [replayRangeMin, setReplayRangeMin] = useState(60);

  const stream = useEventStream(center);

  // 정본 §13.5 "폴링 제거" — 스트림이 붙어 있으면 끄고, 끊기면 30초 폴백으로 되돌린다
  const occupancyFallback = useOccupancy({ enabled: source === "live" && !stream.connected });
  useEffect(() => {
    if (occupancyFallback.data) queryClient.invalidateQueries({ queryKey: queryKeys.layout(center) });
  }, [occupancyFallback.data, queryClient, center]);

  const applyEvent = useCallback(
    (event: WmsEvent) => {
      if (event.type !== "InventoryTxRecorded") return;
      // 2026-09-14 라이브 검증 — bayId 는 payload 가 아니라 이벤트 최상위 필드다
      // (`EventRow.java`, `lib/types.ts` `WmsEvent` 주석). BIN 이 아닌 로케이션
      // (RECEIVING 등)은 null 이라 점등·마커 이동을 건너뛴다.
      const bayId = event.bayId;
      if (bayId === null) return;

      patchLayoutCache(queryClient, center, bayId, event);
      overlayRef.current?.pulseBay(bayId, event.payload.txType, performance.now());

      if (event.worker) {
        const fromBayId = workerLastBayRef.current.get(event.worker) ?? null;
        overlayRef.current?.setWorkerTransition(event.worker, fromBayId, bayId, performance.now(), speed);
        workerLastBayRef.current.set(event.worker, bayId);
      }
    },
    [queryClient, center, speed],
  );

  // 라이브 — 스트림이 주는 이벤트를 그대로 적용
  useEffect(() => {
    if (source !== "live") return undefined;
    return stream.subscribe(applyEvent);
  }, [source, stream, applyEvent]);

  // 리플레이 — GET /events 범위를 배속에 맞춰 순서대로 재생(브리프 §3). `Date.now()`는
  // 순수해야 하는 렌더 계산에서 부르지 않는다 — 리플레이를 "시작"하는 이벤트 핸들러
  // (`startReplay`·`changeReplayRange`) 안에서만 다시 잡고, 재생 중엔 고정한다.
  const [replayStartIso, setReplayStartIso] = useState<string | null>(null);
  const range = useEventsRange(
    { center, occurredFrom: replayStartIso ?? undefined, limit: 5000 },
    source === "replay" && replayStartIso !== null,
  );

  useEffect(() => {
    if (source !== "replay" || paused || !range.data || range.data.length === 0) return undefined;
    if (replayIndex >= range.data.length) return undefined;
    const current = range.data[replayIndex];
    applyEvent(current);
    const next = range.data[replayIndex + 1];
    if (!next) return undefined;
    const nextMs = parseServerInstant(next.occurredAt) ?? 0;
    const currentMs = parseServerInstant(current.occurredAt) ?? 0;
    const gapMs = Math.max(20, (nextMs - currentMs) / speed);
    const timer = setTimeout(() => setReplayIndex((i) => i + 1), gapMs);
    return () => clearTimeout(timer);
  }, [source, paused, range.data, replayIndex, speed, applyEvent]);

  const startReplay = useCallback(() => {
    setReplayIndex(0);
    setPaused(false);
    setReplayStartIso(toServerLocalDateTime(Date.now() - replayRangeMin * 60_000));
    setSource("replay");
  }, [replayRangeMin]);
  const stopReplay = useCallback(() => setSource("live"), []);

  const changeReplayRange = useCallback((minutes: number) => {
    setReplayRangeMin(minutes);
    setReplayIndex(0);
    setReplayStartIso(toServerLocalDateTime(Date.now() - minutes * 60_000));
  }, []);

  const setControlOverlay = useCallback((overlay: ControlOverlay | null) => {
    overlayRef.current = overlay;
  }, []);

  return {
    stream,
    source,
    speed,
    setSpeed,
    paused,
    setPaused,
    replayIndex,
    replayTotal: range.data?.length ?? 0,
    replayLoading: range.isLoading,
    replayCurrentAt: range.data?.[replayIndex]?.occurredAt ?? null,
    replayRangeMin,
    setReplayRangeMin: changeReplayRange,
    seekReplay: setReplayIndex,
    startReplay,
    stopReplay,
    setControlOverlay,
  };
}

function patchLayoutCache(queryClient: QueryClient, center: string, bayId: number, event: WmsEvent): void {
  queryClient.setQueryData<LayoutResponse>(queryKeys.layout(center), (prev) => {
    if (!prev) return prev;
    return { ...prev, bays: prev.bays.map((bay) => (bay.id === bayId ? patchBayForTx(bay, event) : bay)) };
  });
}

/** 근사 갱신 — 정확한 칸 단위 재계산은 서버 몫이고, 여기는 다음 `GET /layout` 재조회
 * 전까지 점등에 맞춰 숫자가 같이 움직이는 정도만 맡는다(정본 §13.5) */
function patchBayForTx(bay: Bay, event: WmsEvent): Bay {
  const txType = event.payload.txType;
  const qty = typeof event.payload.qty === "number" ? event.payload.qty : 1;
  const fillSign = txType === "PICK" || txType === "SHIP" || txType === "TRANSFER_OUT" ? -1 : 1;
  return {
    ...bay,
    occupiedBins: Math.max(0, Math.min(bay.totalBins, bay.occupiedBins + fillSign)),
    qty: Math.max(0, bay.qty + fillSign * qty),
  };
}
