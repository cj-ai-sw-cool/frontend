/**
 * `GET /admin/webhooks/**`·`/admin/sellers/{code}/api-keys`·`/admin/events/relay` 표본
 * (Stage 11C, 정본 §14.2·§14.5·§14.8). 백엔드가 2026-09-14 라이브로 붙었다(백엔드 노트
 * `backend/docs/tasks/2026-09-14-stage11c-backend-notes.md` §3) — 이 표본은 이제
 * **방어적 fallback**일 뿐이다(일시적 네트워크 실패 등, `lib/mocks/hub.ts`의
 * `mockCenters`·`mockTransfers`와 같은 관례). 조회가 실패했을 때만 읽고, 뮤테이션은
 * 표본으로 흉내 내지 않는다(`use-hub.ts`의 `useCreateTransfer`처럼 실제 서버 응답을
 * 그대로 쓴다).
 */

import type {
  SellerApiKey,
  WebhookDelivery,
  WebhookEndpoint,
  WebhookEventType,
  WebhookRelaySummary,
  WebhookSummaryRow,
} from "../types";

const ALL_EVENT_TYPES: WebhookEventType[] = [
  "OrderStatusChanged",
  "OrderCancelled",
  "ShipmentShipped",
  "InventoryChanged",
];

export const mockApiKeys: Record<string, SellerApiKey[]> = {
  "SEL-A": [
    {
      id: 101,
      prefix: "a1b2c3d4",
      label: "운영 OMS",
      createdAt: "2026-08-01T09:00:00",
      lastUsedAt: "2026-09-14T08:40:00",
      revokedAt: null,
      revoked: false,
    },
  ],
  "SEL-B": [
    {
      id: 201,
      prefix: "f00dbeef",
      label: "운영 OMS",
      createdAt: "2026-08-05T09:00:00",
      lastUsedAt: "2026-09-14T07:55:00",
      revokedAt: null,
      revoked: false,
    },
  ],
  "SEL-C": [],
};

export const mockEndpoints: WebhookEndpoint[] = [
  {
    endpointId: 1,
    sellerCode: "SEL-A",
    url: "http://seller-normal:9100/webhooks/{eventType}",
    secretPrefix: "aPC5sA",
    eventTypes: [...ALL_EVENT_TYPES],
    status: "ACTIVE",
    suspendedAt: null,
    createdAt: "2026-08-01T09:05:00",
    updatedAt: "2026-08-01T09:05:00",
  },
];

export const mockDeliveries: WebhookDelivery[] = [
  {
    deliveryId: 1,
    endpointId: 1,
    url: "http://seller-normal:9100/webhooks/{eventType}",
    sellerCode: "SEL-A",
    outboxSeq: 1,
    eventType: "InventoryChanged",
    payload: {
      deliveryId: 1,
      seq: 1,
      eventType: "InventoryChanged",
      occurredAt: "2026-09-14T09:00:00Z",
      seller: { code: "SEL-A" },
      data: {
        gtin: "8801234567890",
        productName: "무선 이어폰",
        lotNo: null,
        txType: "PICK",
        qty: -1,
        center: "C1",
        atpAfter: { center: 340, total: 340 },
      },
    },
    status: "DELIVERED",
    attempts: 0,
    nextAttemptAt: null,
    lastStatusCode: 200,
    lastError: null,
    deliveredAt: "2026-09-14T09:00:01",
    createdAt: "2026-09-14T09:00:00",
  },
];

export function mockSummary(): WebhookSummaryRow[] {
  return mockEndpoints.map((endpoint) => ({
    endpointId: endpoint.endpointId,
    sellerCode: endpoint.sellerCode,
    sellerName: endpoint.sellerCode,
    url: endpoint.url,
    status: endpoint.status,
    pending: 0,
    retry: 0,
    dead: 0,
    delivered24h: mockDeliveries.filter((d) => d.endpointId === endpoint.endpointId && d.status === "DELIVERED")
      .length,
    lastDeliveredAt: null,
    oldestPendingSeq: null,
    apiKeyCount: mockApiKeys[endpoint.sellerCode]?.filter((k) => !k.revoked).length ?? 0,
  }));
}

/** 로컬 기본 프로파일(`KAFKA_BOOTSTRAP_SERVERS` 없음)을 표본으로 그대로 흉내 — 조회가
 * 실패했을 때 릴레이 꺼짐 회색 띠로 대신 그린다 */
export const mockRelay: WebhookRelaySummary = {
  enabled: false,
  lastPublishedSeq: null,
  unpublished: 0,
  oldestUnpublishedAt: null,
  lagSec: null,
};
