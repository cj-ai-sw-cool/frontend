/**
 * `GET /hub/**` 표본 — 정본 §12.6 API 를 백엔드가 아직 안 올린 시점(2026-09-13, 브리프
 * 머리말)에 화면을 먼저 그리기 위한 것이다. `app/hub/_data/use-hub.ts` 가 실제 호출이
 * 실패했을 때만(404 등) 이 표본으로 대신 그린다. 필드 이름은 `lib/types.ts` 12절 주석의
 * 가정 그대로다 — 라이브 검증 대기.
 *
 * 센터 3곳(C1 수도권·C2 중부·C3 남부, `00-planning/02-situation.md`)과 화주 2곳
 * (SEL-A·SEL-B, 정본 §12.7 데모 시드가 쓰는 이름)으로 라우팅·이동·글로벌 ATP 흐름을
 * 화면 체크 1~5(브리프 §3)가 전부 지나가게 구성했다.
 */

import type {
  CenterSummary,
  CreateTransferRequest,
  GlobalAtpRow,
  HubOrderListItem,
  RoutingDecision,
  TransferOrderDetail,
  TransferOrderListItem,
  TransferStatus,
} from "../types";

export const mockCenters: CenterSummary[] = [
  { code: "C1", name: "수도권", status: "ACTIVE", binCount: 13000, stockCount: 11200, openOrderCount: 42 },
  { code: "C2", name: "중부", status: "ACTIVE", binCount: 4200, stockCount: 2600, openOrderCount: 11 },
  { code: "C3", name: "남부", status: "ACTIVE", binCount: 13000, stockCount: 9800, openOrderCount: 6 },
];

export const mockHubOrders: HubOrderListItem[] = [
  {
    id: 5001,
    orderNo: "ORD-20260913-0501",
    sellerCode: "SEL-A",
    sellerName: "화주 A",
    regionCode: "SEOUL",
    centerCode: "C1",
    rule: "PRIORITY",
    status: "ALLOCATED",
    createdAt: "2026-09-13T09:10:00+09:00",
  },
  {
    id: 5002,
    orderNo: "ORD-20260913-0502",
    sellerCode: "SEL-A",
    sellerName: "화주 A",
    regionCode: "CHUNGCHEONG",
    centerCode: "C2",
    rule: "REGION",
    status: "ALLOCATED",
    createdAt: "2026-09-13T09:22:00+09:00",
  },
  {
    id: 5003,
    orderNo: "ORD-20260913-0503",
    sellerCode: "SEL-B",
    sellerName: "화주 B",
    regionCode: "BUSAN",
    centerCode: "C1",
    rule: "STOCK",
    status: "ALLOCATED",
    createdAt: "2026-09-13T09:31:00+09:00",
  },
  {
    id: 5004,
    orderNo: "ORD-20260913-0504",
    sellerCode: "SEL-B",
    sellerName: "화주 B",
    regionCode: "BUSAN",
    centerCode: null,
    rule: null,
    status: "RECEIVED",
    createdAt: "2026-09-13T09:40:00+09:00",
  },
];

export const mockRoutingDecisions: Record<number, RoutingDecision> = {
  5001: {
    orderId: 5001,
    orderNo: "ORD-20260913-0501",
    selectedCenter: "C1",
    rule: "PRIORITY",
    rejected: false,
    candidates: [
      {
        centerCode: "C1",
        centerName: "수도권",
        sufficient: true,
        lines: [
          { gtin: "8801234567890", productName: "무선 이어폰", requiredQty: 20, atp: 340, sufficient: true },
        ],
      },
      {
        centerCode: "C2",
        centerName: "중부",
        sufficient: false,
        lines: [
          { gtin: "8801234567890", productName: "무선 이어폰", requiredQty: 20, atp: 0, sufficient: false },
        ],
      },
    ],
    createdAt: "2026-09-13T09:10:01+09:00",
  },
  5004: {
    orderId: 5004,
    orderNo: "ORD-20260913-0504",
    selectedCenter: null,
    rule: null,
    rejected: true,
    candidates: [
      {
        centerCode: "C1",
        centerName: "수도권",
        sufficient: false,
        lines: [{ gtin: "8809876543210", productName: "보조배터리", requiredQty: 50, atp: 12, sufficient: false }],
      },
      {
        centerCode: "C3",
        centerName: "남부",
        sufficient: false,
        lines: [{ gtin: "8809876543210", productName: "보조배터리", requiredQty: 50, atp: 0, sufficient: false }],
      },
    ],
    createdAt: "2026-09-13T09:40:01+09:00",
  },
};

/** 화면 체크 4 — "이동 생성 → 출발 → 도착 센터 입고 화면에 ASN TR-… 가 보인다"를 표본으로
 * 시연할 수 있게, 하나는 CREATED(출발 전) 다른 하나는 DISPATCHED(도착 센터 ASN 생성됨)로 둔다. */
export const mockTransfers: TransferOrderListItem[] = [
  {
    id: 9001,
    transferNo: "TR-20260913-0001",
    fromCenter: "C1",
    toCenter: "C2",
    sellerCode: "SEL-A",
    status: "CREATED",
    itemCount: 2,
    createdAt: "2026-09-13T10:00:00+09:00",
  },
  {
    id: 9002,
    transferNo: "TR-20260913-0002",
    fromCenter: "C1",
    toCenter: "C3",
    sellerCode: "SEL-B",
    status: "DISPATCHED",
    itemCount: 1,
    createdAt: "2026-09-13T08:00:00+09:00",
  },
];

export const mockTransferDetails: Record<number, TransferOrderDetail> = {
  9001: {
    ...mockTransfers[0],
    items: [
      { gtin: "8801234567890", productName: "무선 이어폰", qty: 40, shippedQty: 0, receivedQty: 0 },
      { gtin: "8809876543210", productName: "보조배터리", qty: 30, shippedQty: 0, receivedQty: 0 },
    ],
    asnNo: null,
    dispatchedAt: null,
    receivedAt: null,
  },
  9002: {
    ...mockTransfers[1],
    items: [{ gtin: "8801112223334", productName: "블루투스 스피커", qty: 25, shippedQty: 25, receivedQty: 0 }],
    asnNo: "TR-20260913-0002",
    dispatchedAt: "2026-09-13T08:05:00+09:00",
    receivedAt: null,
  },
};

/** 이동 생성 — id·transferNo·시각을 새로 부여해 `mockTransfers`/`mockTransferDetails`
 * 와 같은 모양의 CREATED 건을 돌려준다. 표본 전용(로컬 상태에는 반영하지 않는다 —
 * `use-hub.ts` 가 mutation 성공을 낙관적으로 캐시에 얹는다). */
export function mockCreateTransfer(body: CreateTransferRequest, nextId: number): TransferOrderDetail {
  const transferNo = `TR-20260913-${String(nextId).padStart(4, "0")}`;
  return {
    id: nextId,
    transferNo,
    fromCenter: body.fromCenter,
    toCenter: body.toCenter,
    sellerCode: body.sellerCode,
    status: "CREATED" as TransferStatus,
    itemCount: body.items.length,
    createdAt: new Date().toISOString(),
    items: body.items.map((item) => ({
      gtin: item.gtin,
      productName: item.gtin,
      qty: item.qty,
      shippedQty: 0,
      receivedQty: 0,
    })),
    asnNo: null,
    dispatchedAt: null,
    receivedAt: null,
  };
}

/** 출발 — CREATED → DISPATCHED, ASN 번호를 transferNo 그대로 붙인다(정본 §12.5 ②) */
export function mockDispatchTransfer(detail: TransferOrderDetail): TransferOrderDetail {
  return {
    ...detail,
    status: "DISPATCHED",
    asnNo: detail.transferNo,
    dispatchedAt: new Date().toISOString(),
    items: detail.items.map((item) => ({ ...item, shippedQty: item.qty })),
  };
}

export const mockGlobalAtp: GlobalAtpRow[] = [
  {
    gtin: "8801234567890",
    productName: "무선 이어폰",
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
    productName: "보조배터리",
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
    productName: "블루투스 스피커",
    total: 205,
    inTransit: 25,
    byCenter: [
      { center: "C1", atp: 120 },
      { center: "C2", atp: 0 },
      { center: "C3", atp: 85 },
    ],
  },
];
