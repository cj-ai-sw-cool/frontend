/**
 * `GET /admin/webhooks/**`·`/admin/sellers/{code}/api-keys`·`/admin/events/relay` 표본
 * (Stage 11C, 정본 §14.2·§14.5·§14.8). 2026-09-14 시점 백엔드가 같은 시각
 * `feat/stage11c-webhooks`에서 작업 중이라 관리자 API가 없다(브리프 머리말,
 * `GET /admin/webhooks/summary` 404 확인) — `app/hub/_data/use-webhooks.ts`가 조회
 * 실패 시 이 표본으로 그린다. 라이브로 붙기 전엔 화면 체크(브리프 §3)를 실제로
 * 눌러볼 수 있어야 하므로, 뮤테이션도 아래 `mock*` 함수로 모듈 안 배열을 직접
 * 고쳐 흉내 낸다 — `lib/mocks/hub.ts`의 `mockCreateTransfer`/`mockDispatchTransfer`와
 * 같은 관례(방어적 fallback, 라이브가 붙으면 더는 타지 않는다).
 *
 * 화주 3곳은 `GET /sellers`(라이브, 2026-09-14 확인)의 실제 코드를 그대로 썼다 —
 * SEL-A 에이브랜드 9101(정상) · SEL-B 비뷰티 9102(초당 5건 초과 429) · SEL-C 씨헬스
 * 9103(30% 503, 브리프 §1 "모의 OMS 3개"). 발송 이력 60건은 세 엔드포인트에 상태
 * 골고루 나눠 채웠다.
 */

import type {
  CreateApiKeyRequest,
  CreateApiKeyResponse,
  CreateWebhookEndpointRequest,
  RotateWebhookSecretResponse,
  SellerApiKey,
  WebhookDelivery,
  WebhookDeliveryStatus,
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

/* ── API 키 ──────────────────────────────────────────────────────────────── */
function key(
  id: number,
  keyPrefix: string,
  label: string,
  createdAt: string,
  lastUsedAt: string | null,
  revokedAt: string | null,
): SellerApiKey {
  return { id, keyPrefix, label, createdAt, lastUsedAt, revokedAt };
}

export const mockApiKeys: Record<string, SellerApiKey[]> = {
  "SEL-A": [
    key(101, "sk_a1b2c3d4", "운영 OMS", "2026-08-01T09:00:00", "2026-09-14T08:40:00", null),
    key(102, "sk_00aa11bb", "구 OMS(교체 예정)", "2026-06-01T09:00:00", "2026-08-30T10:00:00", null),
  ],
  "SEL-B": [key(201, "sk_f00dbeef", "운영 OMS", "2026-08-05T09:00:00", "2026-09-14T07:55:00", null)],
  "SEL-C": [
    key(301, "sk_9c9c9c9c", "테스트 키", "2026-07-20T09:00:00", null, "2026-08-01T09:00:00"),
    key(302, "sk_deadc0de", "운영 OMS", "2026-08-10T09:00:00", "2026-09-14T06:10:00", null),
  ],
};

let nextApiKeyId = 401;

export function mockIssueApiKey(sellerCode: string, body: CreateApiKeyRequest): CreateApiKeyResponse {
  const id = nextApiKeyId++;
  const prefix = `sk_${id.toString(16).padStart(8, "0")}`;
  const list = mockApiKeys[sellerCode] ?? (mockApiKeys[sellerCode] = []);
  list.unshift({
    id,
    keyPrefix: prefix,
    label: body.label,
    createdAt: new Date().toISOString(),
    lastUsedAt: null,
    revokedAt: null,
  });
  return { id, prefix, key: `${prefix}${"x".repeat(32)}` };
}

export function mockRevokeApiKey(sellerCode: string, id: number): void {
  const list = mockApiKeys[sellerCode];
  const found = list?.find((k) => k.id === id);
  if (found) found.revokedAt = new Date().toISOString();
}

/* ── 엔드포인트 ──────────────────────────────────────────────────────────── */
export const mockEndpoints: WebhookEndpoint[] = [
  endpoint(1, "SEL-A", "http://mock-sellers:9101/webhook", "whs_aa", ALL_EVENT_TYPES, "ACTIVE", null),
  endpoint(2, "SEL-B", "http://mock-sellers:9102/webhook", "whs_bb", ["OrderStatusChanged", "ShipmentShipped"], "ACTIVE", null),
  endpoint(3, "SEL-C", "http://mock-sellers:9103/webhook", "whs_cc", ALL_EVENT_TYPES, "SUSPENDED", "2026-09-14T07:30:00"),
];

function endpoint(
  id: number,
  sellerCode: string,
  url: string,
  secretPrefix: string,
  eventTypes: WebhookEventType[],
  status: WebhookEndpoint["status"],
  suspendedAt: string | null,
): WebhookEndpoint {
  const createdAt = "2026-08-01T09:05:00";
  return {
    id,
    sellerCode,
    url,
    secretPrefix,
    eventTypes: [...eventTypes],
    status,
    suspendedAt,
    createdAt,
    updatedAt: suspendedAt ?? createdAt,
  };
}

let nextEndpointId = 4;

export function mockCreateEndpoint(body: CreateWebhookEndpointRequest): WebhookEndpoint {
  const id = nextEndpointId++;
  const endpoint: WebhookEndpoint = {
    id,
    sellerCode: body.sellerCode,
    url: body.url,
    secretPrefix: `whs_${id.toString(16).padStart(2, "0")}`,
    eventTypes: body.eventTypes,
    status: "ACTIVE",
    suspendedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  mockEndpoints.unshift(endpoint);
  return endpoint;
}

export function mockUpdateEndpointStatus(id: number, status: "ACTIVE" | "DISABLED"): WebhookEndpoint | null {
  const endpoint = mockEndpoints.find((e) => e.id === id);
  if (!endpoint) return null;
  endpoint.status = status;
  endpoint.suspendedAt = status === "ACTIVE" ? null : endpoint.suspendedAt;
  endpoint.updatedAt = new Date().toISOString();
  return endpoint;
}

export function mockRotateSecret(id: number): RotateWebhookSecretResponse | null {
  const endpoint = mockEndpoints.find((e) => e.id === id);
  if (!endpoint) return null;
  const prefix = `whs_${Math.random().toString(16).slice(2, 4)}`;
  endpoint.secretPrefix = prefix;
  endpoint.updatedAt = new Date().toISOString();
  return { secretPrefix: prefix, secret: `${prefix}${"y".repeat(38)}` };
}

/** 재개 — SUSPENDED → ACTIVE, 그 엔드포인트의 DEAD 전부 PENDING으로(정본 §14.5 "재개") */
export function mockResumeEndpoint(id: number): WebhookEndpoint | null {
  const endpoint = mockEndpoints.find((e) => e.id === id);
  if (!endpoint) return null;
  endpoint.status = "ACTIVE";
  endpoint.suspendedAt = null;
  endpoint.updatedAt = new Date().toISOString();
  for (const delivery of mockDeliveries) {
    if (delivery.endpointId === id && delivery.status === "DEAD") {
      delivery.status = "PENDING";
      delivery.nextAttemptAt = null;
    }
  }
  return endpoint;
}

/* ── 발송 이력 60건 ──────────────────────────────────────────────────────── */
const STATUS_CYCLE: WebhookDeliveryStatus[] = ["DELIVERED", "DELIVERED", "DELIVERED", "PENDING", "RETRY", "DEAD"];

function buildDeliveries(): WebhookDelivery[] {
  const rows: WebhookDelivery[] = [];
  let seq = 9000;
  let id = 1;
  const endpointsBySeller: Array<{ endpointId: number; sellerCode: string; url: string }> = [
    { endpointId: 1, sellerCode: "SEL-A", url: "http://mock-sellers:9101/webhook" },
    { endpointId: 2, sellerCode: "SEL-B", url: "http://mock-sellers:9102/webhook" },
    { endpointId: 3, sellerCode: "SEL-C", url: "http://mock-sellers:9103/webhook" },
  ];
  for (const ep of endpointsBySeller) {
    for (let i = 0; i < 20; i++) {
      seq += 1;
      const status = ep.sellerCode === "SEL-C" && i >= 15 ? "DEAD" : STATUS_CYCLE[i % STATUS_CYCLE.length];
      const eventType = ALL_EVENT_TYPES[i % ALL_EVENT_TYPES.length];
      const createdAt = new Date(Date.UTC(2026, 8, 14, 0, i * 3)).toISOString();
      rows.push({
        id: id++,
        endpointId: ep.endpointId,
        endpointUrl: ep.url,
        sellerCode: ep.sellerCode,
        outboxSeq: seq,
        eventType,
        payload: buildPayload(eventType, seq),
        status,
        attempts: status === "DELIVERED" ? 1 : status === "DEAD" ? 3 : status === "RETRY" ? 1 : 0,
        nextAttemptAt: status === "RETRY" ? new Date(Date.now() + 25_000).toISOString().replace("Z", "") : null,
        lastStatusCode: status === "DELIVERED" ? 200 : status === "DEAD" ? 503 : status === "RETRY" ? 500 : null,
        lastError: status === "DEAD" ? "connect timeout" : null,
        deliveredAt: status === "DELIVERED" ? createdAt : null,
        createdAt,
      });
    }
  }
  return rows;
}

function buildPayload(eventType: WebhookEventType, seq: number): Record<string, unknown> {
  const base = { deliveryId: seq, seq, eventType, occurredAt: "2026-09-14T09:00:00+09:00", seller: { code: "SEL-A" } };
  switch (eventType) {
    case "OrderStatusChanged":
      return { ...base, data: { receiptNo: `R-DEMO-${seq}`, orderId: seq, fromStatus: "ALLOCATED", toStatus: "WAVED", center: "C1" } };
    case "OrderCancelled":
      return { ...base, data: { receiptNo: `R-DEMO-${seq}`, orderId: seq, reason: "재고 부족" } };
    case "ShipmentShipped":
      return { ...base, data: { receiptNo: `R-DEMO-${seq}`, orderId: seq, shipmentId: seq, line: 1, center: "C1" } };
    case "InventoryChanged":
      return {
        ...base,
        data: { gtin: "8801234567890", productName: "무선 이어폰", lotNo: null, txType: "PICK", qty: -1, center: "C1", atpAfter: { center: "C1", total: 340 } },
      };
  }
}

export const mockDeliveries: WebhookDelivery[] = buildDeliveries();

/** DEAD 1건 재시도 — 성공(200)으로 흉내 내고, 그 엔드포인트가 SUSPENDED 였으면 재개까지
 * 함께 한다(정본 §14.5 "재개 두 갈래" 중 하나) */
export function mockRetryDelivery(id: number): WebhookDelivery | null {
  const delivery = mockDeliveries.find((d) => d.id === id);
  if (!delivery) return null;
  delivery.status = "DELIVERED";
  delivery.attempts += 1;
  delivery.lastStatusCode = 200;
  delivery.lastError = null;
  delivery.nextAttemptAt = null;
  delivery.deliveredAt = new Date().toISOString();
  const endpoint = mockEndpoints.find((e) => e.id === delivery.endpointId);
  if (endpoint?.status === "SUSPENDED") mockResumeEndpoint(endpoint.id);
  return delivery;
}

/** 폴링마다 한 번씩 불러 "재개 후 PENDING이 순서대로 DELIVERED로 바뀌는" 진행을
 * 흉내 낸다(브리프 §3 화면 체크 4) — ACTIVE 엔드포인트마다 seq 가 가장 작은
 * PENDING/RETRY 1건만 DELIVERED 로 넘긴다(정본 §14.5 "엔드포인트 하나에는 한 번에 한 건") */
export function mockAdvanceDeliveries(): void {
  for (const endpoint of mockEndpoints) {
    if (endpoint.status !== "ACTIVE") continue;
    const inFlight = mockDeliveries
      .filter((d) => d.endpointId === endpoint.id && (d.status === "PENDING" || d.status === "RETRY"))
      .sort((a, b) => a.outboxSeq - b.outboxSeq)[0];
    if (!inFlight) continue;
    inFlight.status = "DELIVERED";
    inFlight.attempts += 1;
    inFlight.lastStatusCode = 200;
    inFlight.deliveredAt = new Date().toISOString();
    inFlight.nextAttemptAt = null;
  }
}

export function mockSummary(): WebhookSummaryRow[] {
  return mockEndpoints.map((endpoint) => {
    const rows = mockDeliveries.filter((d) => d.endpointId === endpoint.id);
    const pending = rows.filter((d) => d.status === "PENDING").length;
    const retry = rows.filter((d) => d.status === "RETRY").length;
    const dead = rows.filter((d) => d.status === "DEAD").length;
    const delivered = rows.filter((d) => d.status === "DELIVERED");
    const oldestPending = rows
      .filter((d) => d.status === "PENDING" || d.status === "RETRY")
      .sort((a, b) => a.outboxSeq - b.outboxSeq)[0];
    const lastDelivered = [...delivered].sort((a, b) => (b.deliveredAt ?? "").localeCompare(a.deliveredAt ?? ""))[0];
    return {
      endpointId: endpoint.id,
      sellerCode: endpoint.sellerCode,
      status: endpoint.status,
      pending,
      retry,
      dead,
      delivered24h: delivered.length,
      lastDeliveredAt: lastDelivered?.deliveredAt ?? null,
      oldestPendingSeq: oldestPending?.outboxSeq ?? null,
    };
  });
}

/** 로컬 기본 프로파일(`KAFKA_BOOTSTRAP_SERVERS` 없음)을 표본으로 그대로 흉내 — 릴레이
 * 꺼짐 띠(브리프 §3 화면 체크 5)가 기본으로 뜬다 */
export const mockRelay: WebhookRelaySummary = {
  enabled: false,
  lastPublishedSeq: null,
  unpublished: 0,
  oldestUnpublishedAt: null,
  lagSec: null,
};
