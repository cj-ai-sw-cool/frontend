"use client";

/**
 * 허브 "화주" 탭 데이터 훅 — Stage 11C, 정본 §14.2·§14.5·§14.8.
 *
 * 2026-09-14 백엔드가 라이브로 붙었다(`localhost:8000`, 백엔드 노트 `backend/docs/
 * tasks/2026-09-14-stage11c-backend-notes.md` §3 "프론트 계약"). 조회(GET)는
 * `usingMock` 플래그로 `lib/mocks/webhooks.ts` 표본을 대신 그리되, 이제는 **방어적
 * fallback**일 뿐이다(일시적 네트워크 실패 등, `use-hub.ts`의 `useHubOrders`와 같은
 * 관례). 뮤테이션은 실제 서버 응답을 그대로 쓴다 — 404 낙관적 캐시 분기는 백엔드가
 * 뜬 뒤 제거했다(`use-hub.ts`의 `useCreateTransfer`와 같은 수명).
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys, webhookAdmin } from "@/lib/endpoints";
import { mockApiKeys, mockDeliveries, mockEndpoints, mockRelay, mockSummary } from "@/lib/mocks/webhooks";
import type {
  CreateApiKeyRequest,
  CreateWebhookEndpointRequest,
  WebhookDeliveriesQuery,
} from "@/lib/types";

/** API 키 목록 — 선택된 화주가 있을 때만 */
export function useApiKeys(sellerCode: string | null) {
  const query = useQuery({
    queryKey: queryKeys.sellerApiKeys(sellerCode ?? ""),
    queryFn: () => webhookAdmin.apiKeys(sellerCode as string),
    enabled: sellerCode !== null,
    retry: false,
  });
  const usingMock = sellerCode !== null && query.isError;
  return {
    data: query.data ?? (usingMock ? (mockApiKeys[sellerCode as string] ?? []) : undefined),
    isLoading: query.isLoading && !usingMock,
    usingMock,
    error: usingMock ? null : query.error,
  };
}

/** 키 발급 — 평문은 응답에만 있다(정본 §14.2). 대화 상자가 결과를 1회 모달로 보여준다 */
export function useIssueApiKey(sellerCode: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateApiKeyRequest) => webhookAdmin.issueApiKey(sellerCode, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.sellerApiKeys(sellerCode) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.sellers });
      void queryClient.invalidateQueries({ queryKey: queryKeys.webhookSummary });
    },
  });
}

/** 키 폐기 */
export function useRevokeApiKey(sellerCode: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => webhookAdmin.revokeApiKey(sellerCode, id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.sellerApiKeys(sellerCode) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.sellers });
      void queryClient.invalidateQueries({ queryKey: queryKeys.webhookSummary });
    },
  });
}

/** 엔드포인트 목록 — 선택된 화주로 거른다 */
export function useWebhookEndpoints(sellerCode: string | null) {
  const query = useQuery({
    queryKey: queryKeys.webhookEndpoints({ seller: sellerCode ?? undefined }),
    queryFn: () => webhookAdmin.endpoints({ seller: sellerCode ?? undefined }),
    enabled: sellerCode !== null,
    retry: false,
  });
  const usingMock = sellerCode !== null && query.isError;
  return {
    data:
      query.data ?? (usingMock ? mockEndpoints.filter((e) => e.sellerCode === sellerCode) : undefined),
    isLoading: query.isLoading && !usingMock,
    usingMock,
    error: usingMock ? null : query.error,
  };
}

function invalidateEndpointQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  sellerCode: string | undefined,
) {
  void queryClient.invalidateQueries({ queryKey: queryKeys.webhookEndpoints({ seller: sellerCode }) });
  void queryClient.invalidateQueries({ queryKey: queryKeys.webhookSummary });
}

/** 엔드포인트 추가 — 평문 비밀이 응답에만 있다(생성 응답도 재발급과 같은
 * `{endpoint, secret}` 모양, 백엔드 노트 §3.2) */
export function useCreateWebhookEndpoint() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateWebhookEndpointRequest) => webhookAdmin.createEndpoint(body),
    onSuccess: (data) => invalidateEndpointQueries(queryClient, data.endpoint.sellerCode),
  });
}

/** 상태 토글(PATCH) — ACTIVE ↔ DISABLED */
export function useUpdateEndpointStatus(sellerCode: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: number; status: "ACTIVE" | "DISABLED" }) =>
      webhookAdmin.updateEndpoint(vars.id, { status: vars.status }),
    onSuccess: () => invalidateEndpointQueries(queryClient, sellerCode),
  });
}

/** 비밀 재발급 — 평문은 응답에만 있다 */
export function useRotateSecret(sellerCode: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => webhookAdmin.rotateSecret(id),
    onSuccess: () => invalidateEndpointQueries(queryClient, sellerCode),
  });
}

/** 재개 — SUSPENDED → ACTIVE, DEAD 전부 PENDING(정본 §14.5). 응답 `revived`가 되돌린
 * 건수다 */
export function useResumeEndpoint(sellerCode: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => webhookAdmin.resumeEndpoint(id),
    onSuccess: () => {
      invalidateEndpointQueries(queryClient, sellerCode);
      void queryClient.invalidateQueries({ queryKey: ["admin", "webhooks", "deliveries"] });
    },
  });
}

/** 발송 이력 — 10초 폴링(브리프 §2 "SSE 없이 10초 폴링") */
export function useWebhookDeliveries(params: WebhookDeliveriesQuery) {
  const query = useQuery({
    queryKey: queryKeys.webhookDeliveries(params),
    queryFn: () => webhookAdmin.deliveries(params),
    enabled: params.seller !== undefined,
    retry: false,
    refetchInterval: 10_000,
  });
  const usingMock = params.seller !== undefined && query.isError;

  const filtered = mockDeliveries
    .filter(
      (d) =>
        (params.seller === undefined || d.sellerCode === params.seller) &&
        (params.endpoint === undefined || d.endpointId === params.endpoint) &&
        (params.status === undefined || d.status === params.status),
    )
    .sort((a, b) => b.outboxSeq - a.outboxSeq)
    .slice(0, params.limit ?? 100);

  return {
    data: query.data ?? (usingMock ? filtered : undefined),
    isLoading: query.isLoading && !usingMock,
    usingMock,
    error: usingMock ? null : query.error,
  };
}

/** DEAD 1건 재시도 — 그 발송이 속한 엔드포인트를 통째로 재개한다(정본 §14.5, 백엔드
 * 노트 §1.8). 응답 `revived`로 "N건을 다시 보냅니다"를 띄운다 */
export function useRetryDelivery(sellerCode: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => webhookAdmin.retryDelivery(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin", "webhooks", "deliveries"] });
      invalidateEndpointQueries(queryClient, sellerCode);
    },
  });
}

/** 엔드포인트별 pending/retry/dead/delivered24h 요약 — 화주 목록 배지 */
export function useWebhookSummary() {
  const query = useQuery({
    queryKey: queryKeys.webhookSummary,
    queryFn: () => webhookAdmin.summary(),
    retry: false,
  });
  const usingMock = query.isError;
  return {
    data: query.data ?? (usingMock ? mockSummary() : undefined),
    isLoading: query.isLoading && !usingMock,
    usingMock,
  };
}

/** outbox → Kafka 릴레이 관찰(정본 §14.4) — 요약 띠의 lag·브로커 상태 */
export function useWebhookRelay() {
  const query = useQuery({
    queryKey: queryKeys.webhookRelay,
    queryFn: () => webhookAdmin.relay(),
    retry: false,
  });
  const usingMock = query.isError;
  return {
    data: query.data ?? (usingMock ? mockRelay : undefined),
    isLoading: query.isLoading && !usingMock,
    usingMock,
  };
}
