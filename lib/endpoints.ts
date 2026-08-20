/**
 * 엔드포인트 정의 — docs/02-api-spec.md 의 번호와 1:1 대응.
 * 도메인 담당(P1 입고 / P2 출고 / P3 플랫폼)이 각자 구역만 손대면 된다.
 */
import { api } from "./api";
import type {
  BoxOverrideResponse,
  BoxType,
  Category,
  CompleteResponse,
  ConfirmRequest,
  ConfirmResponse,
  CreateProductRequest,
  DashboardSummary,
  MeasurementResponse,
  Product,
  ProductImagesResponse,
  ScanResponse,
  ShipmentDetail,
  ShipmentListItem,
  ShipmentStatus,
  StockInResponse,
} from "./types";

/* ── P1 입고 ─────────────────────────────────────────────── */
export const inbound = {
  /** 1-1 바코드 스캔 — 3분기 판정 */
  scan: (barcode: string) => api.post<ScanResponse>("/inbound/scans", { barcode }),

  /** 1-2 임시 마스터 생성 — 미등록 바코드 */
  createProduct: (body: CreateProductRequest) =>
    api.post<Product>("/inbound/products", body),

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

  /** 1-7 분류 목록 — 수기 등록 드롭다운 (D-13) */
  categories: () => api.get<Category[]>("/categories"),
};

/* ── P2 출고 포장 ────────────────────────────────────────── */
export const outbound = {
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

/** TanStack Query 키 — 무효화 대상을 한곳에서 관리한다 */
export const queryKeys = {
  categories: ["categories"] as const,
  productImages: (id: number) => ["products", id, "images"] as const,
  dashboardSummary: ["dashboard", "summary"] as const,
  boxTypes: ["box-types"] as const,
  lineShipments: (lineId: number, status?: ShipmentStatus) =>
    ["lines", lineId, "shipments", status ?? "ALL"] as const,
  shipment: (id: number) => ["shipments", id] as const,
};
