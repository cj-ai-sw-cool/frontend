/**
 * 엔드포인트 정의 — docs/02-api-spec.md 의 번호와 1:1 대응.
 * 도메인 담당(P1 입고 / P2 출고 / P3 플랫폼)이 각자 구역만 손대면 된다.
 */
import { api } from "./api";
import type {
  BoxOverrideResponse,
  BoxType,
  CompleteResponse,
  ConfirmRequest,
  ConfirmResponse,
  CreateSellerRequest,
  DashboardSummary,
  LinesResponse,
  Location,
  LocationsQuery,
  MeasurementResponse,
  Page,
  ProductImagesResponse,
  ScanResponse,
  Seller,
  ShipmentDetail,
  ShipmentListItem,
  ShipmentStatus,
  StockInResponse,
  Zone,
} from "./types";

/* ── P1 입고 ─────────────────────────────────────────────── */
export const inbound = {
  /** 1-1 바코드 스캔 — 3분기 판정 */
  scan: (barcode: string) => api.post<ScanResponse>("/inbound/scans", { barcode }),

  /* 1-2 `POST /inbound/products` 는 v0.5 에서 삭제됐다 (D-21) — 백엔드에 엔드포인트가 없다 */

  /** 1-3 촬영·추론 — 동기, 최대 8초. 실패도 200 + status 로 온다 */
  measure: (productId: number) =>
    api.post<MeasurementResponse>("/inbound/measurements", { productId }),

  /** 1-4 측정 확정 — APPROVE / MANUAL */
  confirm: (sessionId: number, body: ConfirmRequest) =>
    api.post<ConfirmResponse>(`/inbound/measurements/${sessionId}/confirm`, body),

  /** 1-5 수량 입고 — 재고 증가의 유일한 경로 (D-09) */
  stockIn: (productId: number, qty: number) =>
    api.post<StockInResponse>("/inbound/stock-in", { productId, qty }),

  /** 1-6 제품 원본 이미지 (출고 화면에서도 재사용) */
  productImages: (productId: number) =>
    api.get<ProductImagesResponse>(`/products/${productId}/images`),

  /* 1-7 `GET /categories` 는 v0.5 에서 삭제됐다 (D-21) — 분류는 1-1 응답의 표시 전용이다 */
};

/* ── P2 출고 포장 ────────────────────────────────────────── */
export const outbound = {
  /** 라인 목록 — 활성 여부(status)로 골라 쓸 수 있는지 가른다. 이름은 서버가 준 그대로 쓴다 */
  lines: () => api.get<LinesResponse>("/lines"),

  /** 3-1 라인별 배송 내역 (B안, D-12) */
  lineShipments: (lineId: number, status?: ShipmentStatus) =>
    api.get<{ shipments: ShipmentListItem[] }>(
      `/lines/${lineId}/shipments${status ? `?status=${status}` : ""}`,
    ),

  /** 3-2 배송단위 상세 */
  shipment: (shipmentId: number) =>
    api.get<ShipmentDetail>(`/shipments/${shipmentId}`),

  /** 3-3 박스 오버라이드 */
  overrideBox: (shipmentId: number, boxTypeId: number) =>
    api.put<BoxOverrideResponse>(`/shipments/${shipmentId}/box`, { boxTypeId }),

  /** 3-4 박스 재고 현황 */
  boxTypes: () => api.get<BoxType[]>("/box-types"),

  /** 3-5 토트 스캔 — 재스캔 멱등 (D-14) */
  scanTote: (barcode: string) =>
    api.post<ShipmentDetail>("/totes/scan", { barcode }),

  /** 3-8 포장 완료 — 재고·박스 차감, 토트 해제 */
  complete: (shipmentId: number) =>
    api.post<CompleteResponse>(`/shipments/${shipmentId}/complete`),

  /** 3-9 적재 — 상태값만. 02 §3-9 기준 시연 범위 밖이나 05 §2 P2 산출물이라 래퍼는 둔다 */
  load: (shipmentId: number) =>
    api.put<{ shipmentId: number; status: "LOADED" }>(`/shipments/${shipmentId}/load`),
};

/* ── P3 대시보드 ─────────────────────────────────────────── */

export const dashboard = {
  /** 2-1 전체 현황 */
  summary: () => api.get<DashboardSummary>("/dashboard/summary"),
};

/* ── 마스터 — 화주·존·로케이션 (Stage 1) ─────────────────────
   정본: backend/docs/02-system/02-data-model.md §1, docs/tasks/
   2026-09-09-stage1-master-handoff.md §2. */
export const master = {
  /** 화주 목록 */
  sellers: () => api.get<Seller[]>("/sellers"),

  /** 화주 등록 — code 중복은 409 CONFLICT */
  createSeller: (body: CreateSellerRequest) => api.post<Seller>("/sellers", body),

  /** 존 목록 — 3D·2D 레이아웃(`lib/zone-layout.ts`)과 로케이션 탭의 존 단이 함께 읽는다 */
  zones: () => api.get<Zone[]>("/zones"),

  /** 로케이션 목록 — zone·rack·type 전부 선택, Spring Page 로 온다 */
  locations: (params?: LocationsQuery) =>
    api.get<Page<Location>>(`/locations${toQueryString(params)}`),

  /** 로케이션 단건 — 없으면 404 */
  location: (code: string) => api.get<Location>(`/locations/${code}`),
};

function toQueryString(params?: LocationsQuery): string {
  if (!params) return "";
  const qs = new URLSearchParams();
  if (params.zone !== undefined) qs.set("zone", params.zone);
  if (params.rack !== undefined) qs.set("rack", String(params.rack));
  if (params.type !== undefined) qs.set("type", params.type);
  if (params.page !== undefined) qs.set("page", String(params.page));
  if (params.size !== undefined) qs.set("size", String(params.size));
  const suffix = qs.toString();
  return suffix ? `?${suffix}` : "";
}

/** TanStack Query 키 — 무효화 대상을 한곳에서 관리한다 */
export const queryKeys = {
  productImages: (id: number) => ["products", id, "images"] as const,
  dashboardSummary: ["dashboard", "summary"] as const,
  lines: ["lines"] as const,
  boxTypes: ["box-types"] as const,
  lineShipments: (lineId: number, status?: ShipmentStatus) =>
    ["lines", lineId, "shipments", status ?? "ALL"] as const,
  shipment: (id: number) => ["shipments", id] as const,
  sellers: ["sellers"] as const,
  zones: ["zones"] as const,
  locations: (params?: LocationsQuery) => ["locations", params ?? {}] as const,
};
