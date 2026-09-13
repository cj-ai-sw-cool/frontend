"use client";

/**
 * 이벤트 스트림·리플레이·KPI 훅 — 분석 화면 3D 관제 모드와 허브 "관제" 탭이 함께 쓴다
 * (그래서 라우트별 `_data/`가 아니라 `lib/center.ts`와 같은 자리에 둔다).
 *
 * 정본 §13.3·§13.5, 브리프 §1·§3. SSE 연결 자체는 `lib/events-stream.ts` 하나만 연다 —
 * 여기는 그 결과를 React 상태로 잇고, `layout` 캐시 갱신 같은 화면별 반응은 호출부
 * (`app/analytics/_data/use-control-mode.ts`)가 `subscribe`로 이어받아 처리한다.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
const INITIAL_STATE: EventStreamState = {
  status: "connecting",
  connected: false,
  usingMock: false,
  lastSeq: null,
  lagMs: null,
  recent: [],
};

export function useEventStream(center: string): EventStreamState & { subscribe: (cb: (event: WmsEvent) => void) => () => void } {
  const [state, setState] = useState<EventStreamState>(INITIAL_STATE);
  const listenersRef = useRef(new Set<(event: WmsEvent) => void>());

  // 센터가 바뀌면 이전 센터의 버퍼를 들고 있지 않도록 렌더 중에 바로 되돌린다(React의
  // "prop 이 바뀔 때 state 조정" 패턴 — 이펙트 안에서 setState 하면 렌더가 한 번 더
  // 돈다, react-hooks/set-state-in-effect).
  const [renderedCenter, setRenderedCenter] = useState(center);
  if (center !== renderedCenter) {
    setRenderedCenter(center);
    setState(INITIAL_STATE);
  }

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
 * 조회하지 않는다. 실패하면(백엔드 미구현) `lib/mocks/events.ts` 표본을 범위로 잘라
 * 대신 쓴다 — `use-layout.ts`의 `usingMock` 관례와 같다. */
export function useEventsRange(query: EventsQuery, enabled: boolean) {
  const result = useQuery({
    queryKey: queryKeys.eventsRange(query),
    queryFn: () => events.list(query),
    enabled,
    retry: false,
    staleTime: 60_000,
  });
  const usingMock = enabled && result.isError;
  // `mockEventsForRange`가 매 렌더 새 배열을 만들면 그 참조를 deps 로 쓰는 리플레이
  // 재생 루프(`use-control-mode.ts`)가 매번 다시 걸린다 — 쿼리 조건이 같으면 같은
  // 배열을 돌려주도록 메모이즈한다.
  const mockData = useMemo(
    () => (usingMock ? mockEventsForRange(query) : undefined),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- query 는 매 렌더 새 객체라 필드별로 비교한다
    [usingMock, query.center, query.occurredFrom, query.occurredTo, query.from, query.to, query.types, query.limit],
  );
  return { ...result, data: result.data ?? mockData, usingMock };
}

function mockEventsForRange(query: EventsQuery): WmsEvent[] {
  const sample = mockEventSample(query.center, 200);
  if (!query.occurredFrom) return sample;
  const fromMs = new Date(query.occurredFrom).getTime();
  return sample.filter((event) => new Date(event.occurredAt).getTime() >= fromMs);
}

/**
 * KPI 패널 — `GET /events/kpi`. 라이브 연결 중엔 스트림 이벤트로 화면이 직접 증분하므로
 * (호출부 몫) 여기는 폴링 없이 최초 1회 + `staleTime` 만료 후 재조회만 한다(브리프 §3).
 *
 * `recentEvents`를 주면(분석 화면 KPI 패널·허브 관제 탭 둘 다) 서버 집계가 실패했을 때
 * 그 버퍼로 대충 낸 값을 대신 쓴다 — 정확한 서버 집계가 아니므로 호출부가 `usingMock`
 * 으로 배지를 달아야 한다.
 */
export function useEventsKpi(center: string, windowSize = "1h", recentEvents?: WmsEvent[]) {
  const result = useQuery<EventsKpiResponse>({
    queryKey: queryKeys.eventsKpi({ center, window: windowSize }),
    queryFn: () => events.kpi({ center, window: windowSize }),
    retry: false,
    staleTime: 30_000,
  });
  const usingMock = result.isError && recentEvents !== undefined;
  const estimated = useMemo(
    () => (usingMock ? estimateKpiFromEvents(recentEvents ?? []) : undefined),
    [usingMock, recentEvents],
  );
  return { ...result, data: result.data ?? estimated, usingMock };
}

/** `GET /events/kpi`가 없을 때 최근 버퍼(최대 50건)로 대충 낸 값 — `avgTaskDurationSec`·
 * `pendingTasksByZone`은 `InventoryTxRecorded`만으로 못 내 0/빈 배열로 둔다(서버 집계 필요) */
export function estimateKpiFromEvents(events: WmsEvent[]): EventsKpiResponse {
  if (events.length === 0) {
    return {
      center: "",
      window: "표본 없음",
      pickingLinesPerHour: 0,
      avgTaskDurationSec: 0,
      pendingTasksByZone: [],
      rebinCompletionsPerHour: 0,
      receivingCount: 0,
      shippingCount: 0,
      generatedAt: new Date().toISOString(),
    };
  }
  const byType = (type: string) => events.filter((e) => e.payload.txType === type).length;
  const oldest = events[events.length - 1];
  const newest = events[0];
  const spanMin = Math.max(1, (new Date(newest.occurredAt).getTime() - new Date(oldest.occurredAt).getTime()) / 60_000);
  const perHour = (count: number) => Math.round((count / spanMin) * 60);

  return {
    center: newest.centerId,
    window: `최근 ${Math.round(spanMin)}분 표본`,
    pickingLinesPerHour: perHour(byType("PICK")),
    avgTaskDurationSec: 0,
    pendingTasksByZone: [],
    rebinCompletionsPerHour: perHour(byType("REBIN")),
    receivingCount: byType("RECEIVE"),
    shippingCount: byType("SHIP"),
    generatedAt: new Date().toISOString(),
  };
}
