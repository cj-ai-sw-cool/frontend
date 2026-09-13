/**
 * `GET /hub/**` 표본 — 2026-09-13 라이브 대조(`localhost:8000`, 백엔드 커밋 aaefe85
 * "S11D.3 센터 간 이동")로 필드 이름을 실제 응답에 맞췄다. 이제 라이브로 붙어 있으므로
 * `app/hub/_data/use-hub.ts` 가 실제 호출이 실패했을 때만(네트워크 끊김 등) 이 표본으로
 * 대신 그린다 — `app/analytics/_data/use-layout.ts` 의 `mockLayout` 과 같은 관례
 * (방어적 fallback, 상시 표본이 아니다).
 *
 * 센터 3곳(C1 수도권·C2 중부·C3 남부, `00-planning/02-situation.md`)과 화주 2곳
 * (SEL-A·SEL-B, 정본 §12.7 데모 시드가 쓰는 이름)으로 구성했다.
 */

import type {
  CenterSummary,
  CreateTransferRequest,
  GlobalAtpRow,
  HubOrderListItem,
  RoutingDecision,
  TransferOrder,
  TransferStatus,
} from "../types";

export const mockCenters: CenterSummary[] = [
  { code: "C1", name: "수도권 센터", bins: 13000, stockQty: 11200, openOrders: 42 },
  { code: "C2", name: "중부 센터", bins: 4200, stockQty: 2600, openOrders: 11 },
  { code: "C3", name: "남부 센터", bins: 13000, stockQty: 9800, openOrders: 6 },
];

export const mockHubOrders: HubOrderListItem[] = [
  {
    orderId: 5001,
    receiptNo: "R-DEMO-0501",
    sellerCode: "SEL-A",
    sellerName: "화주 A",
    regionCode: "SEOUL",
    center: "C1",
    routingRule: "PRIORITY",
    status: "ALLOCATED",
    orderedAt: "2026-09-13T09:10:00",
    cutoffAt: "2026-09-13T14:00:00",
  },
  {
    orderId: 5002,
    receiptNo: "R-DEMO-0502",
    sellerCode: "SEL-A",
    sellerName: "화주 A",
    regionCode: "CHUNGCHEONG",
    center: "C2",
    routingRule: "REGION",
    status: "ALLOCATED",
    orderedAt: "2026-09-13T09:22:00",
    cutoffAt: "2026-09-13T14:00:00",
  },
  {
    orderId: 5003,
    receiptNo: "R-DEMO-0503",
    sellerCode: "SEL-B",
    sellerName: "화주 B",
    regionCode: "BUSAN",
    center: "C1",
    routingRule: "STOCK",
    status: "ALLOCATED",
    orderedAt: "2026-09-13T09:31:00",
    cutoffAt: "2026-09-13T14:00:00",
  },
];

/** `orderId` 별 라우팅 상세 — 실제 API는 성공적으로 라우팅된 주문에만 있다(거부는
 * 주문 자체가 안 생긴다, `lib/types.ts` `RoutingDecision` 주석 참고) */
export const mockRoutingDecisions: Record<number, RoutingDecision> = {
  5001: {
    orderId: 5001,
    center: "C1",
    rule: "PRIORITY",
    candidates: [
      { center: "C1", feasible: true, totalAtp: 340, lines: [{ gtin: "8801234567890", requested: 20, available: 340 }] },
      { center: "C2", feasible: false, totalAtp: 0, lines: [{ gtin: "8801234567890", requested: 20, available: 0 }] },
    ],
    decidedAt: "2026-09-13T09:10:01",
  },
  5003: {
    orderId: 5003,
    center: "C1",
    rule: "STOCK",
    candidates: [
      { center: "C1", feasible: true, totalAtp: 12, lines: [{ gtin: "8809876543210", requested: 10, available: 12 }] },
      { center: "C3", feasible: false, totalAtp: 0, lines: [{ gtin: "8809876543210", requested: 10, available: 0 }] },
    ],
    decidedAt: "2026-09-13T09:31:01",
  },
};

/** 화면 체크 4 — "이동 생성 → 출발 → 도착 센터 입고 화면에 ASN TR-… 가 보인다"를 표본으로
 * 시연할 수 있게, 하나는 CREATED(출발 전) 다른 하나는 DISPATCHED(도착 센터 ASN 생성됨)로 둔다. */
export const mockTransfers: TransferOrder[] = [
  {
    transferId: 9001,
    transferNo: "TR-20260913-0001",
    fromCenter: "C1",
    toCenter: "C2",
    sellerCode: "SEL-A",
    status: "CREATED",
    asnNo: null,
    inTransitQty: 0,
    items: [
      { itemId: 1, gtin: "8801234567890", productName: "무선 이어폰", lotNo: null, qty: 40, shippedQty: 0, receivedQty: 0 },
      { itemId: 2, gtin: "8809876543210", productName: "보조배터리", lotNo: null, qty: 30, shippedQty: 0, receivedQty: 0 },
    ],
    createdAt: "2026-09-13T10:00:00",
    dispatchedAt: null,
    receivedAt: null,
  },
  {
    transferId: 9002,
    transferNo: "TR-20260913-0002",
    fromCenter: "C1",
    toCenter: "C3",
    sellerCode: "SEL-B",
    status: "DISPATCHED",
    asnNo: "TR-20260913-0002",
    inTransitQty: 25,
    items: [
      { itemId: 3, gtin: "8801112223334", productName: "블루투스 스피커", lotNo: "L-2026-09-1", qty: 25, shippedQty: 25, receivedQty: 0 },
    ],
    createdAt: "2026-09-13T08:00:00",
    dispatchedAt: "2026-09-13T08:05:00",
    receivedAt: null,
  },
];

/** 이동 생성 — transferId·transferNo·시각을 새로 부여해 `mockTransfers` 와 같은 모양의
 * CREATED 건을 돌려준다. 방어적 fallback 전용(네트워크가 끊겼을 때만 탄다) */
export function mockCreateTransfer(body: CreateTransferRequest, nextId: number): TransferOrder {
  const transferNo = `TR-20260913-${String(nextId).padStart(4, "0")}`;
  return {
    transferId: nextId,
    transferNo,
    fromCenter: body.fromCenter,
    toCenter: body.toCenter,
    sellerCode: body.sellerCode,
    status: "CREATED" as TransferStatus,
    asnNo: null,
    inTransitQty: 0,
    items: body.items.map((item, index) => ({
      itemId: index + 1,
      gtin: item.gtin,
      productName: item.gtin,
      lotNo: null,
      qty: item.qty,
      shippedQty: 0,
      receivedQty: 0,
    })),
    createdAt: new Date().toISOString(),
    dispatchedAt: null,
    receivedAt: null,
  };
}

/** 출발 — CREATED → DISPATCHED, ASN 번호를 transferNo 그대로 붙인다(정본 §12.5 ②) */
export function mockDispatchTransfer(transfer: TransferOrder): TransferOrder {
  return {
    ...transfer,
    status: "DISPATCHED",
    asnNo: transfer.transferNo,
    dispatchedAt: new Date().toISOString(),
    inTransitQty: transfer.items.reduce((sum, item) => sum + item.qty, 0),
    items: transfer.items.map((item) => ({ ...item, shippedQty: item.qty })),
  };
}

export const mockGlobalAtp: GlobalAtpRow[] = [
  {
    gtin: "8801234567890",
    name: "무선 이어폰",
    total: 620,
    inTransit: 40,
    byCenter: [
      { center: "C1", atp: 340 },
      { center: "C2", atp: 180 },
      { center: "C3", atp: 100 },
    ],
  },
  {
    gtin: "8809876543210",
    name: "보조배터리",
    total: 12,
    inTransit: 0,
    byCenter: [
      { center: "C1", atp: 12 },
      { center: "C2", atp: 0 },
      { center: "C3", atp: 0 },
    ],
  },
  {
    gtin: "8801112223334",
    name: "블루투스 스피커",
    total: 205,
    inTransit: 25,
    byCenter: [
      { center: "C1", atp: 120 },
      { center: "C2", atp: 0 },
      { center: "C3", atp: 85 },
    ],
  },
];
