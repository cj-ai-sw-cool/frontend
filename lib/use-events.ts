"use client";

/**
 * 이벤트 스트림·리플레이·KPI 훅 — 분석 화면 3D 관제 모드와 허브 "관제" 탭이 함께 쓴다
 * (그래서 라우트별 `_data/`가 아니라 `lib/center.ts`와 같은 자리에 둔다).
 *
 * 정본 §13.3·§13.5, 브리프 §1·§3. SSE 연결 자체는 `lib/events-stream.ts` 하나만 연다 —
 * 여기는 그 결과를 React 상태로 잇고, `layout` 캐시 갱신 같은 화면별 반응은 호출부
 * (`app/analytics/_data/use-control-mode.ts`)가 `subscribe`로 이어받아 처리한다.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { events, queryKeys } from "./endpoints";
import { openEventStream } from "./events-stream";
import { createMockEventStream, mockEventSample } from "./mocks/events";
import type { EventsKpiResponse, EventsQuery, EventStreamStatus, WmsEvent } from "./types";

const RECENT_BUFFER = 50;

export interface EventStreamState {
  status: EventStreamStatus;
  /** 라이브·목 어느 쪽이든 이벤트가 흐르고 있으면 true(브리프 §3 "lag 표시") */
  connected: boolean;
  usingMock: boolean;
  lastSeq: number | null;
  /** 지금 − 마지막 이벤트 `occurredAt`(ms, 정본 §13.5 "lag = 지금 − 마지막 이벤트 occurred_at") */
  lagMs: number | null;
  /** 허브 관제 탭 "최근 이벤트 50건 표"(브리프 §3) — 최신이 앞 */
  recent: WmsEvent[];
}

/**
 * `useEventStream(center)` — 브리프 §1. 실 SSE 를 먼저 열어 보고, 연속 3회 실패하면
 * `lib/mocks/events.ts` 가짜 스트림으로 넘어간다(`use-layout.ts`의 `usingMock` 관례와
 * 같은 방어적 fallback). `subscribe`로 원본 이벤트를 그대로 받아 화면별로 반응한다.
 */
export function useEventStream(center: string): EventStreamState & { subscribe: (cb: (event: WmsEvent) => void) => () => void } {
  const [state, setState] = useState<EventStreamState>({
    status: "connecting",
    connected: false,
    usingMock: false,
    lastSeq: null,
    lagMs: null,
    recent: [],
  });
  const listenersRef = useRef(new Set<(event: WmsEvent) => void>());

  const handleEvent = useCallback((event: WmsEvent) => {
    setState((prev) => ({
      ...prev,
      lastSeq: event.seq,
      lagMs: Date.now() - new Date(event.occurredAt).getTime(),
      recent: [event, ...prev.recent].slice(0, RECENT_BUFFER),
    }));
    for (const listener of listenersRef.current) listener(event);
  }, []);

  useEffect(() => {
    let closed = false;
    let mockHandle: { close: () => void } | null = null;
    setState((prev) => ({ ...prev, recent: [], lastSeq: null, lagMs: null, usingMock: false }));

    const startMock = () => {
      if (closed || mockHandle) return;
      setState((prev) => ({ ...prev, status: "open", connected: true, usingMock: true }));
      const sample = mockEventSample(center);
      for (const event of sample) handleEvent(event);
      const last = sample.at(-1);
      mockHandle = createMockEventStream(center, last?.seq ?? 0, handleEvent);
    };

    const liveHandle = openEventStream(center, undefined, {
      onEvent: handleEvent,
      onStatusChange: (status) =>
        setState((prev) => (prev.usingMock ? prev : { ...prev, status, connected: status === "open" })),
      onUnavailable: startMock,
    });

    return () => {
      closed = true;
      liveHandle.close();
      mockHandle?.close();
    };
  }, [center, handleEvent]);

  const subscribe = useCallback((cb: (event: WmsEvent) => void) => {
    listenersRef.current.add(cb);
    return () => listenersRef.current.delete(cb);
  }, []);

  return { ...state, subscribe };
}

/** 리플레이 스크러버 — `GET /events` 범위(정본 §13.3). `enabled`가 false 면(라이브 모드)
 * 조회하지 않는다 */
export function useEventsRange(query: EventsQuery, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.eventsRange(query),
    queryFn: () => events.list(query),
    enabled,
    staleTime: 60_000,
  });
}

/** KPI 패널 — `GET /events/kpi`. 라이브 연결 중엔 스트림 이벤트로 화면이 직접 증분하므로
 * (호출부 몫) 여기는 폴링 없이 최초 1회 + `staleTime` 만료 후 재조회만 한다(브리프 §3) */
export function useEventsKpi(center: string, windowSize = "1h") {
  return useQuery<EventsKpiResponse>({
    queryKey: queryKeys.eventsKpi({ center, window: windowSize }),
    queryFn: () => events.kpi({ center, window: windowSize }),
    staleTime: 30_000,
  });
}
