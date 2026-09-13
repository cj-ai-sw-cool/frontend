"use client";

/**
 * 허브 창(`/hub`) 데이터 훅 — Stage 11D, 정본 §12.6·§12.8.
 *
 * 호출 래퍼는 `@/lib/endpoints` 의 `hub` 만 쓴다(컴포넌트에서 fetch 직접 호출 금지, 다른
 * 화면과 같은 규약). 백엔드가 `feat/stage11d-multicenter`에서 같은 시각 작업 중이라
 * (브리프 머리말) 2026-09-13 시점엔 이 5개 엔드포인트가 없을 수 있다 — 조회(GET)는
 * `usingMock` 플래그로 `lib/mocks/hub.ts` 표본을 대신 그린다(다른 화면의 `useLayout`
 * 관례와 같다). 이동 생성·출발(POST)은 그 관례가 없는 자리라 — 백엔드가 없을 때는
 * `onError` 에서 표본 데이터로 낙관적 캐시를 채워 화면 체크 4(브리프 §3)가 지나가게
 * 한다. 라이브 검증 대기.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@/lib/api";
import { hub, master, queryKeys } from "@/lib/endpoints";
import {
  mockCenters,
  mockCreateTransfer,
  mockDispatchTransfer,
  mockGlobalAtp,
  mockHubOrders,
  mockRoutingDecisions,
  mockTransferDetails,
  mockTransfers,
} from "@/lib/mocks/hub";
import type {
  CreateTransferRequest,
  GlobalAtpQuery,
  HubOrdersQuery,
  Page,
  TransferOrderDetail,
  TransfersQuery,
} from "@/lib/types";

function mockPage<T>(content: T[]): Page<T> {
  return {
    content,
    totalElements: content.length,
    totalPages: 1,
    number: 0,
    size: Math.max(content.length, 1),
    first: true,
    last: true,
    empty: content.length === 0,
  };
}

/** 센터 3곳 + 센터별 요약 — "센터" 탭 카드. 셸 상단 선택과 같은 훅(`lib/center.ts`)을 쓴다 */
export { useHubCenters } from "@/lib/center";

/** 화주 목록 — "이동 생성" 대화 상자의 화주 선택. Stage 1 마스터 API 재사용(다른 화면의
 * `useSellers` 와 같은 이유, `app/packing/_data/use-orders.ts` 머리말 참고) */
export function useSellers() {
  return useQuery({
    queryKey: queryKeys.sellers,
    queryFn: () => master.sellers(),
  });
}

/** "주문" 탭 표 — 센터·상태 필터 */
export function useHubOrders(params?: HubOrdersQuery) {
  const query = useQuery({
    queryKey: queryKeys.hubOrders(params),
    queryFn: () => hub.orders(params),
    retry: false,
  });

  const usingMock = query.isError;
  const filtered = mockHubOrders.filter(
    (o) =>
      (params?.center === undefined || o.centerCode === params.center) &&
      (params?.status === undefined || o.status === params.status),
  );
  return {
    data: query.data ?? (usingMock ? mockPage(filtered) : undefined),
    isLoading: query.isLoading && !usingMock,
    usingMock,
    error: usingMock ? null : query.error,
  };
}

/** 라우팅 상세 — 주문 행 클릭 시에만 조회 */
export function useOrderRouting(orderId: number | null) {
  const query = useQuery({
    queryKey: queryKeys.hubOrderRouting(orderId ?? -1),
    queryFn: () => hub.orderRouting(orderId as number),
    enabled: orderId !== null,
    retry: false,
  });

  const usingMock = orderId !== null && query.isError;
  const mock = orderId !== null ? (mockRoutingDecisions[orderId] ?? null) : null;
  return {
    data: query.data ?? (usingMock ? mock : undefined),
    isLoading: query.isLoading && !usingMock,
    usingMock,
  };
}

/** "이동" 탭 표 */
export function useTransfers(params?: TransfersQuery) {
  const query = useQuery({
    queryKey: queryKeys.hubTransfers(params),
    queryFn: () => hub.transfers(params),
    retry: false,
  });

  const usingMock = query.isError;
  const filtered = mockTransfers.filter(
    (t) => params?.status === undefined || t.status === params.status,
  );
  return {
    data: query.data ?? (usingMock ? mockPage(filtered) : undefined),
    isLoading: query.isLoading && !usingMock,
    usingMock,
    error: usingMock ? null : query.error,
  };
}

/** 이동 오더 상세 — shipped/received 진행 */
export function useTransferDetail(id: number | null) {
  const query = useQuery({
    queryKey: queryKeys.hubTransfer(id ?? -1),
    queryFn: () => hub.transfer(id as number),
    enabled: id !== null,
    retry: false,
  });

  const usingMock = id !== null && query.isError;
  const mock = id !== null ? (mockTransferDetails[id] ?? null) : null;
  return {
    data: query.data ?? (usingMock ? mock : undefined),
    isLoading: query.isLoading && !usingMock,
    usingMock,
  };
}

let mockTransferSeq = 9900;

/**
 * 이동 생성 — `POST /hub/transfers`. 백엔드가 아직 없으면(404 등) 표본 응답으로 낙관적
 * 캐시를 채운다(위 머리말) — 화면 체크 4 "이동 생성 → 출발 → 도착 센터 입고 화면에 ASN
 * TR-… 가 보인다"가 백엔드 없이도 지나가야 한다.
 */
export function useCreateTransfer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: CreateTransferRequest) => hub.createTransfer(body),
    onError: (error, body) => {
      if (!(error instanceof ApiError)) return;
      const created = mockCreateTransfer(body, ++mockTransferSeq);
      mockTransferDetails[created.id] = created;
      mockTransfers.unshift(created);
      queryClient.setQueryData(queryKeys.hubTransfer(created.id), created);
    },
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.hubTransfer(data.id), data);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["hub", "transfers"] });
    },
  });
}

/**
 * 출발 — `POST /hub/transfers/{id}/dispatch`. 409 `INSUFFICIENT_ATP` 는 안내만 하고
 * (호출부가 `error.is("INSUFFICIENT_ATP")` 로 분기), 엔드포인트 자체가 없을 때만(404)
 * 표본 응답으로 대신 DISPATCHED 처리한다.
 */
export function useDispatchTransfer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => hub.dispatchTransfer(id),
    onError: (error, id) => {
      if (!(error instanceof ApiError) || error.status !== 404) return;
      const cached = mockTransferDetails[id];
      const listed = mockTransfers.find((t) => t.id === id);
      const current: TransferOrderDetail | undefined =
        cached ?? (listed === undefined ? undefined : { ...listed, items: [], asnNo: null, dispatchedAt: null, receivedAt: null });
      if (current === undefined) return;
      const dispatched = mockDispatchTransfer(current);
      mockTransferDetails[id] = dispatched;
      const idx = mockTransfers.findIndex((t) => t.id === id);
      if (idx >= 0) mockTransfers[idx] = dispatched;
      queryClient.setQueryData(queryKeys.hubTransfer(id), dispatched);
    },
    onSettled: (_data, _error, id) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.hubTransfer(id) });
      void queryClient.invalidateQueries({ queryKey: ["hub", "transfers"] });
    },
  });
}

/** "글로벌 ATP" 탭 — 화주 선택 필수(`enabled`) */
export function useGlobalAtp(params: GlobalAtpQuery | null) {
  const query = useQuery({
    queryKey: queryKeys.hubAtp(params ?? { seller: "" }),
    queryFn: () => hub.atp(params as GlobalAtpQuery),
    enabled: params !== null && params.seller !== "",
    retry: false,
  });

  const usingMock = params !== null && params.seller !== "" && query.isError;
  return {
    data: query.data ?? (usingMock ? mockGlobalAtp : undefined),
    isLoading: query.isLoading && !usingMock,
    usingMock,
  };
}

/** "센터" 탭 표본 재노출 — 다른 탭이 화면 안내(빨간 배지 등)에 쓴다 */
export const HUB_MOCK_CENTERS = mockCenters;
