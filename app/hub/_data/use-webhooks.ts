"use client";

/**
 * 허브 "화주" 탭 데이터 훅 — Stage 11C, 정본 §14.2·§14.5·§14.8.
 *
 * 관리자 API가 아직 없다(브리프 머리말, `GET /admin/webhooks/summary` 404 확인,
 * 2026-09-14) — 조회는 `usingMock` 플래그로 `lib/mocks/webhooks.ts` 표본을 대신
 * 그린다(`use-hub.ts`의 `useHubOrders` 관례). 뮤테이션은 라우트가 없을 때(404)만
 * 같은 표본의 `mock*` 함수로 낙관적으로 흉내 내고, 그 밖의 에러(409 등 진짜 도메인
 * 에러)는 그대로 올린다 — 백엔드가 뜨면 `isRouteMissing` 분기를 걷어낸다
 * (`use-hub.ts` 머리말 "404 낙관적 캐시 분기는 백엔드가 뜬 뒤 제거했다"와 같은 수명).
 */

import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@/lib/api";
import { queryKeys, webhookAdmin } from "@/lib/endpoints";
import {
  mockAdvanceDeliveries,
  mockApiKeys,
  mockCreateEndpoint,
  mockDeliveries,
  mockEndpoints,
  mockIssueApiKey,
  mockRelay,
  mockResumeEndpoint,
  mockRetryDelivery,
  mockRevokeApiKey,
  mockRotateSecret,
  mockSummary,
  mockUpdateEndpointStatus,
} from "@/lib/mocks/webhooks";
import type {
  CreateApiKeyRequest,
  CreateWebhookEndpointRequest,
  WebhookDeliveriesQuery,
} from "@/lib/types";

function isRouteMissing(err: unknown): boolean {
  return err instanceof ApiError && err.status === 404;
}

/** API 키 목록 — 선택된 화주가 있을 때만 */
export function useApiKeys(sellerCode: string | null) {
  const query = useQuery({
    queryKey: queryKeys.sellerApiKeys(sellerCode ?? ""),
    queryFn: () => webhookAdmin.apiKeys(sellerCode as string),
    enabled: sellerCode !== null,
    retry: false,
  });
  const usingMock = sellerCode !== null && query.isError && isRouteMissing(query.error);
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
    mutationFn: async (body: CreateApiKeyRequest) => {
      try {
        return await webhookAdmin.issueApiKey(sellerCode, body);
      } catch (err) {
        if (isRouteMissing(err)) return mockIssueApiKey(sellerCode, body);
        throw err;
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.sellerApiKeys(sellerCode) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.webhookSummary });
    },
  });
}

/** 키 폐기 */
export function useRevokeApiKey(sellerCode: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      try {
        await webhookAdmin.revokeApiKey(sellerCode, id);
      } catch (err) {
        if (isRouteMissing(err)) {
          mockRevokeApiKey(sellerCode, id);
          return;
        }
        throw err;
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.sellerApiKeys(sellerCode) });
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
  const usingMock = sellerCode !== null && query.isError && isRouteMissing(query.error);
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

/** 엔드포인트 추가 */
export function useCreateWebhookEndpoint() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: CreateWebhookEndpointRequest) => {
      try {
        return await webhookAdmin.createEndpoint(body);
      } catch (err) {
        if (isRouteMissing(err)) return mockCreateEndpoint(body);
        throw err;
      }
    },
    onSuccess: (data) => invalidateEndpointQueries(queryClient, data.sellerCode),
  });
}

/** 상태 토글(PATCH) — ACTIVE ↔ DISABLED */
export function useUpdateEndpointStatus(sellerCode: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { id: number; status: "ACTIVE" | "DISABLED" }) => {
      try {
        return await webhookAdmin.updateEndpoint(vars.id, { status: vars.status });
      } catch (err) {
        if (isRouteMissing(err)) {
          const updated = mockUpdateEndpointStatus(vars.id, vars.status);
          if (updated) return updated;
        }
        throw err;
      }
    },
    onSuccess: () => invalidateEndpointQueries(queryClient, sellerCode),
  });
}

/** 비밀 재발급 — 평문은 응답에만 있다 */
export function useRotateSecret(sellerCode: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      try {
        return await webhookAdmin.rotateSecret(id);
      } catch (err) {
        if (isRouteMissing(err)) {
          const rotated = mockRotateSecret(id);
          if (rotated) return rotated;
        }
        throw err;
      }
    },
    onSuccess: () => invalidateEndpointQueries(queryClient, sellerCode),
  });
}

/** 재개 — SUSPENDED → ACTIVE, DEAD 전부 PENDING(정본 §14.5) */
export function useResumeEndpoint(sellerCode: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      try {
        return await webhookAdmin.resumeEndpoint(id);
      } catch (err) {
        if (isRouteMissing(err)) {
          const resumed = mockResumeEndpoint(id);
          if (resumed) return resumed;
        }
        throw err;
      }
    },
    onSuccess: () => {
      invalidateEndpointQueries(queryClient, sellerCode);
      void queryClient.invalidateQueries({ queryKey: ["admin", "webhooks", "deliveries"] });
    },
  });
}

/** 발송 이력 — 10초 폴링(브리프 §2 "SSE 없이 10초 폴링"). 목일 때는 `query.errorUpdatedAt`
 * 이 바뀌는(= 폴링 한 번 돈) 시점마다 `mockAdvanceDeliveries`로 한 걸음 진행시켜, 재개 후
 * PENDING이 순서대로 DELIVERED 로 바뀌는 진행을 흉내 낸다(브리프 §3 화면 체크 4). */
export function useWebhookDeliveries(params: WebhookDeliveriesQuery) {
  const query = useQuery({
    queryKey: queryKeys.webhookDeliveries(params),
    queryFn: () => webhookAdmin.deliveries(params),
    enabled: params.seller !== undefined,
    retry: false,
    refetchInterval: 10_000,
  });
  const usingMock = params.seller !== undefined && query.isError && isRouteMissing(query.error);

  useEffect(() => {
    if (usingMock) mockAdvanceDeliveries();
  }, [usingMock, query.errorUpdatedAt]);

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

/** DEAD 1건 재시도 */
export function useRetryDelivery(sellerCode: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      try {
        return await webhookAdmin.retryDelivery(id);
      } catch (err) {
        if (isRouteMissing(err)) {
          const retried = mockRetryDelivery(id);
          if (retried) return retried;
        }
        throw err;
      }
    },
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
  const usingMock = query.isError && isRouteMissing(query.error);
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
  const usingMock = query.isError && isRouteMissing(query.error);
  return {
    data: query.data ?? (usingMock ? mockRelay : undefined),
    isLoading: query.isLoading && !usingMock,
    usingMock,
  };
}
