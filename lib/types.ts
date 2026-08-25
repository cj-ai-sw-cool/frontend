/**
 * API 계약 타입 — docs/02-api-spec.md v0.6 기준.
 *
 * 문서가 정본이다. 계약이 바뀌면 02 를 먼저 고치고 이 파일을 맞춘다.
 * 단위: 길이 cm(소수 1자리), 무게 kg(소수 3자리) — D-03.
 */

/* ── 0. 공통 ─────────────────────────────────────────────── */

export type ApiErrorCode =
  | "PRODUCT_NOT_FOUND"
  | "SESSION_NOT_FOUND"
  | "GATE_NOT_PASSED"
  | "SESSION_ALREADY_CONFIRMED"
  | "TOTE_NOT_ASSIGNED"
  | "SHIPMENT_NOT_FOUND"
  | "BOX_TYPE_NOT_FOUND"
  | "INVALID_STATE"
  | "OUT_OF_STOCK"
  | "VALIDATION_ERROR";

export interface ApiErrorBody {
  code: ApiErrorCode | string;
  message: string;
  detail?: Record<string, unknown>;
}

export interface Dimensions {
  widthCm: number;
  lengthCm: number;
  heightCm: number;
}

export interface Handling {
  refrigerate: boolean;
  fragile: boolean;
  irregular: boolean;
}

/* ── 1. 입고 ─────────────────────────────────────────────── */

export type ScanJudgment = "REGISTERED" | "NEW" | "UNKNOWN";
export type DimStatus = "NONE" | "CONFIRMED";

export interface Product {
  productId: number;
  gtin: string;
  name: string;
  categoryL: string;
  categoryM: string;
  imageUrl: string | null;
  dimStatus: DimStatus;
  stockQty: number;
}

/** 1-1 `POST /inbound/scans` */
export interface ScanResponse {
  judgment: ScanJudgment;
  /** UNKNOWN 이면 null */
  product: Product | null;
}

/**
 * ~~1-2 `POST /inbound/products`~~ — v0.5 에서 삭제 (D-21).
 * 마스터에 없는 바코드는 1-1 에서 안내하고 흐름을 종료하므로 임시 마스터를 만들지 않는다.
 * 백엔드에도 엔드포인트가 없다 — 타입만 남기면 되살아날 수 있어 함께 지운다.
 */

export interface MeasurementImage {
  cameraNo: number | null;
  url: string;
}

/** 1-3 성공 응답 */
export interface MeasurementInferred {
  sessionId: number;
  status: "INFERRED";
  inferred: Dimensions;
  /** 저울 연동 실측값. 추론 아님 → 게이트 무관. 미수신 시 null */
  weightKg: number | null;
  confidence: number;
  gatePassed: boolean;
  gateFailReasons: string[];
  images: MeasurementImage[];
  handlingDefaults: Handling;
}

/** 1-3 타임아웃/실패 응답 — HTTP 에러가 아닌 상태값이다 */
export interface MeasurementFailed {
  sessionId: number;
  status: "MEASURE_FAILED";
  failReason: string;
  weightKg: number | null;
}

export type MeasurementResponse = MeasurementInferred | MeasurementFailed;

/** 1-4 확정 — APPROVE 는 gatePassed=true 세션만, MANUAL 은 항상 허용 */
export type ConfirmRequest =
  | { method: "APPROVE"; weightKg?: number | null; handling: Handling }
  | { method: "MANUAL"; dims: Dimensions; weightKg?: number | null; handling: Handling };

export interface ConfirmResponse {
  productId: number;
  dimStatus: DimStatus;
  dimMethod: "INFERRED" | "MANUAL";
}

/** 1-5 `POST /inbound/stock-in` — 재고 증가의 유일한 경로 (D-09) */
export interface StockInResponse {
  productId: number;
  stockQty: number;
}

/** 1-6 `GET /products/{id}/images` */
export interface ProductImagesResponse {
  source: "MEASUREMENT" | "MASTER_FALLBACK";
  images: MeasurementImage[];
}

/**
 * ~~1-7 `GET /categories`~~ — v0.5 에서 삭제 (D-21, D-13 무효).
 * 유일한 소비처가 1-2 의 분류 드롭다운이었다. 화면에 보이는 대분류·중분류는
 * 1-1 응답의 `categoryL`/`categoryM` 이 그대로 채우므로 목록 조회가 필요 없다.
 */

/* ── 2. 대시보드 ─────────────────────────────────────────── */

export interface LineSummary {
  lineId: number;
  name: string;
  regionCode: string;
  status: string;
  /** 처리량 = 완료 박스 = 토트 */
  packedCount: number;
  inProgressCount: number;
}

/** 2-1 `GET /dashboard/summary` */
export interface DashboardSummary {
  lines: LineSummary[];
  inbound: { todayConfirmed: number; pendingNew: number };
}

/* ── 3. 출고 ─────────────────────────────────────────────── */

/** TOTE_ASSIGNED=대기중, PACKING=진행중, PACKED=완료 (D-12) */
export type ShipmentStatus =
  | "PLANNED"
  | "TOTE_ASSIGNED"
  | "PACKING"
  | "PACKED"
  | "LOADED";

/** 3-1 리스트 항목 */
export interface ShipmentListItem {
  shipmentId: number;
  receiptNo: string;
  seqNo: number;
  status: ShipmentStatus;
  toteBarcode: string | null;
}

export interface BoxType {
  boxTypeId: number;
  name: string;
  /** [가로, 세로, 높이] cm */
  innerCm: [number, number, number];
  stockQty: number;
}

export interface ShipmentItem {
  productId: number;
  gtin: string;
  name: string;
  qty: number;
  /** 파생 속성 포함해 서버가 계산 */
  handling: string[];
}

/** 3-2 / 3-5 배송단위 상세 */
export interface ShipmentDetail {
  shipmentId: number;
  orderId: number;
  seqNo: number;
  status: ShipmentStatus;
  line: { lineId: number; name: string };
  tote: { toteId: number; barcode: string } | null;
  recommendedBox: BoxType | null;
  /** 오버라이드 시 값 존재 */
  finalBox: BoxType | null;
  fillerRecommended: boolean;
  items: ShipmentItem[];
}

/** 3-3 박스 오버라이드 */
export interface BoxOverrideResponse {
  shipmentId: number;
  recommendedBoxId: number;
  finalBoxId: number;
}

/** 3-8 포장 완료 */
export interface CompleteResponse {
  shipmentId: number;
  status: "PACKED";
  packedAt: string;
  /** 대시보드 처리량 +1 즉시 반영값 */
  line: { lineId: number; packedCount: number };
}
