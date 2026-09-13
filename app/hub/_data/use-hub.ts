"use client";

/**
 * 허브 창(`/hub`) 데이터 훅 — Stage 11D, 정본 §12.6·§12.8.
 *
 * 호출 래퍼는 `@/lib/endpoints` 의 `hub` 만 쓴다(컴포넌트에서 fetch 직접 호출 금지, 다른
 * 화면과 같은 규약). 2026-09-13 백엔드가 라이브로 붙었다(`localhost:8000`, 커밋 aaefe85
 * "S11D.3 센터 간 이동") — 조회(GET)는 `usingMock` 플래그로 `lib/mocks/hub.ts` 표본을
 * 대신 그리되, 이제는 **방어적 fallback**일 뿐이다(일시적 네트워크 실패 등,
 * `app/analytics/_data/use-layout.ts` 의 `useLayout` 관례와 같다). 이동 생성·출발은
 * 실제 서버 응답을 그대로 쓴다 — 404 낙관적 캐시 분기는 백엔드가 뜬 뒤 제거했다.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { hub, master, queryKeys } from "@/lib/endpoints";
import {
  mockCenters,
  mockGlobalAtp,
  mockHubOrders,
  mockRoutingDecisions,
  mockTransfers,
} from "@/lib/mocks/hub";
import type { CreateTransferRequest, GlobalAtpQuery, HubOrdersQuery, Page, TransfersQuery } from "@/lib/types";

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
      (params?.center === undefined || o.center === params.center) &&
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

/** "이동" 탭 표 — 목록도 상세와 같은 모양(`items` 포함)으로 온다(`TransferOrder` 주석 참고) */
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
  const mock = id !== null ? (mockTransfers.find((t) => t.transferId === id) ?? null) : null;
  return {
    data: query.data ?? (usingMock ? mock : undefined),
    isLoading: query.isLoading && !usingMock,
    usingMock,
  };
}

/**
 * 이동 생성 — `POST /hub/transfers`(정본 §12.5 ①). 성공하면 목록을 무효화하고 상세
 * 캐시를 미리 채운다(행을 바로 클릭하지 않아도 상세 조회가 캐시 히트로 시작하게).
 */
export function useCreateTransfer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: CreateTransferRequest) => hub.createTransfer(body),
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.hubTransfer(data.transferId), data);
      void queryClient.invalidateQueries({ queryKey: ["hub", "transfers"] });
    },
  });
}

/**
 * 출발 — `POST /hub/transfers/{id}/dispatch`(정본 §12.5 ②). 출발 센터 ATP 부족이면
 * 409 `INSUFFICIENT_ATP` — 호출부가 `error.is("INSUFFICIENT_ATP")` 로 분기한다.
 */
export function useDispatchTransfer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => hub.dispatchTransfer(id),
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.hubTransfer(data.transferId), data);
    },
    onSettled: (_data, _error, id) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.hubTransfer(id) });
      void queryClient.invalidateQueries({ queryKey: ["hub", "transfers"] });
    },
  });
}

/** "글로벌 ATP" 탭 — 화주 선택 필수(`enabled`). 라이브 대조: `Page<GlobalAtpRow>` 로 온다 */
export function useGlobalAtp(params: GlobalAtpQuery | null) {
  const query = useQuery({
    queryKey: queryKeys.hubAtp(params ?? { seller: "" }),
    queryFn: () => hub.atp(params as GlobalAtpQuery),
    enabled: params !== null && params.seller !== "",
    retry: false,
  });

  const usingMock = params !== null && params.seller !== "" && query.isError;
  return {
    data: query.data?.content ?? (usingMock ? mockGlobalAtp : undefined),
    isLoading: query.isLoading && !usingMock,
    usingMock,
  };
}

/** "센터" 탭 표본 재노출 — 다른 탭이 화면 안내(빨간 배지 등)에 쓴다 */
export const HUB_MOCK_CENTERS = mockCenters;
