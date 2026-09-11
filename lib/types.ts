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
  | "VALIDATION_ERROR"
  /** 마스터 데이터 유일성 위반(Stage 1) — 예: 화주 코드 중복 */
  | "CONFLICT"
  | "LOCATION_NOT_FOUND"
  /** 혼적 규칙 위반(Stage 2) — 정본 §2.3. BIN 로케이션에 다른 화주, 또는 같은 상품에
   * 다른 로트를 놓으려 할 때 409 */
  | "MIXING_VIOLATION"
  /** 검수 입력(Stage 3) — 스캔한 GTIN이 선택한 ASN의 품목에 없을 때 409(정본 §3.5) */
  | "ASN_ITEM_NOT_FOUND";

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
  /**
   * 모델이 신뢰도를 주면 0~1 (D-24). 현재 배포된 모델은 주지 않는다.
   * 서버 응답이 `NON_NULL` 이라 **없을 때는 필드 자체가 빠진다** — null 이 아니라 undefined 다.
   * 없으면 서버도 신뢰도 게이트 판정을 건너뛰므로 `gateFailReasons` 에 LOW_CONFIDENCE 가 없다.
   */
  confidence?: number | null;
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

/**
 * 1-5 `POST /inbound/stock-in` — 재고 증가의 유일한 경로 (D-09).
 *
 * Stage 2 전환기 규칙 T1(정본 02-data-model.md §2.5) — 화주·로트번호가 필수로 추가됐다.
 * 로트가 없으면 서버가 새로 만든다. 유통기한은 선택이다.
 * // Stage 2 transitional (T1): replaced in Stage 3 (ASN 검수가 대체)
 */
export interface StockInRequest {
  productId: number;
  qty: number;
  sellerCode: string;
  lotNo: string;
  expiresOn?: string | null;
}

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

/** `GET /lines` 목록 항목 — 대시보드 집계(packedCount 등) 없이 라인 자체 정보만 */
export interface Line {
  lineId: number;
  name: string;
  regionCode: string;
  /** "ACTIVE" 가 아니면 화면에서 고를 수 없게 막는다 — 값 자체는 서버가 정한다 */
  status: string;
}

/** `GET /lines` */
export interface LinesResponse {
  lines: Line[];
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

/* ── 4. 마스터 — 화주·존·로케이션 (Stage 1) ─────────────────────────────
   정본: backend/docs/02-system/02-data-model.md §1, docs/tasks/
   2026-09-09-stage1-master-handoff.md §2. 필드는 백엔드 응답 DTO
   (SellerResponse/ZoneResponse/LocationResponse, backend/src/main/java/com/
   awesome/backend/{seller,location}/controller/)를 그대로 옮겼다. */

export type SellerStatus = "ACTIVE" | "INACTIVE";

/** `GET /sellers` 항목 / `POST /sellers` 응답 */
export interface Seller {
  id: number;
  code: string;
  name: string;
  status: SellerStatus;
}

/** `POST /sellers` 요청 */
export interface CreateSellerRequest {
  code: string;
  name: string;
}

export type TempZone = "AMBIENT" | "CHILLED" | "FROZEN";

/**
 * `GET /zones` 항목 — 3D·2D 레이아웃(`lib/zone-layout.ts`)과 로케이션 탭의
 * 존 단이 함께 읽는다. `locationCount` 는 그 존 소속 BIN 로케이션 수다.
 */
export interface Zone {
  code: string;
  name: string;
  tempZone: TempZone;
  /** 세 변 합 상한(cm). null = 상한 없음 */
  gradeCapCm: number | null;
  binWidthCm: number;
  binHeightCm: number;
  rackPairs: number;
  rackSingles: number;
  cols: number;
  levels: number;
  /** 3D 배치 줄 — 0 뒷줄, 1 앞줄 */
  rowNo: number;
  /** 줄 안 순서 */
  orderInRow: number;
  locationCount: number;
}

export type LocationType = "BIN" | "TOTE" | "REBIN_SLOT" | "RECEIVING" | "PACKING";
export type LocationStatus = "ACTIVE" | "BLOCKED";

/**
 * `GET /locations` 항목 / `GET /locations/{code}` 단건.
 * `zoneCode`·좌표·치수는 BIN 에만 있다 — 토트·슬롯·입고장·포장대는 전부 null 이다.
 */
export interface Location {
  id: number;
  code: string;
  type: LocationType;
  zoneCode: string | null;
  rackNo: number | null;
  levelNo: number | null;
  colNo: number | null;
  widthCm: number | null;
  lengthCm: number | null;
  heightCm: number | null;
  maxWeightKg: number | null;
  status: LocationStatus;
}

/** `GET /locations` 쿼리 — 전부 선택(§2 S1.2) */
export interface LocationsQuery {
  zone?: string;
  rack?: number;
  type?: LocationType;
  page?: number;
  size?: number;
}

/* ── 5. 재고 — 로트·현재고·원장 (Stage 2) ─────────────────────────────────
   정본: backend/docs/02-system/02-data-model.md §2.4·§2.6, docs/tasks/
   2026-09-10-stage2-inventory-core-handoff.md §3. 필드는 백엔드 응답 DTO
   (StockController/ZoneController/InventoryReportController/InventoryAdminController,
   backend/src/main/java/com/awesome/backend/inventory/) 를 그대로 옮겼다. */

export type StockStatus = "AVAILABLE" | "HOLD" | "DAMAGED";

/** `GET /stock` 행 — `qty > 0` 만 온다 */
export interface StockItem {
  stockId: number;
  location: { code: string; type: LocationType; zone: string | null };
  seller: { code: string; name: string };
  product: { id: number; gtin: string; name: string };
  lot: { lotNo: string; expiresOn: string | null };
  status: StockStatus;
  qty: number;
}

/** `GET /stock` 쿼리 — 전부 선택 */
export interface StockQuery {
  seller?: string;
  gtin?: string;
  location?: string;
  lot?: string;
  status?: StockStatus;
  page?: number;
  size?: number;
}

export type TxType =
  | "RECEIVE"
  | "PUTAWAY"
  | "PICK"
  | "REBIN"
  | "SHIP"
  | "ADJUST"
  | "STATUS_CHANGE";

/**
 * `GET /stock/{stockId}/ledger` 행 — 그 키(로케이션·화주·상품·로트)에 걸린 원장.
 *
 * ⚠️ 라이브 검증(브리프 §3, 2026-09-10)으로 정정 — 설계 초안과 실제 응답이 둘 다 다르다:
 *    - `id` 가 아니라 **`txId`**
 *    - `fromLocation`/`toLocation` 은 `{code}` 객체가 아니라 **로케이션 코드 문자열**(또는 null)
 */
export interface StockLedgerEntry {
  txId: number;
  txType: TxType;
  fromLocation: string | null;
  toLocation: string | null;
  fromStatus: StockStatus | null;
  toStatus: StockStatus | null;
  qty: number;
  reasonCode: string | null;
  refType: string | null;
  refId: number | null;
  createdAt: string;
}

/** `GET /stock/occupancy` 행 — BIN 전체(3,888행). 3D·2D 지도가 인스턴스 매핑에 쓴다 */
export interface StockOccupancyRow {
  code: string;
  zone: string;
  rack: number;
  level: number;
  col: number;
  qty: number;
  sellerCode: string | null;
}

/** `GET /zones/summary` 행 */
export interface ZoneSummary {
  code: string;
  binCount: number;
  occupiedBins: number;
  qty: number;
}

/** `GET /inventory/daily` 행 */
export interface DailyInventory {
  date: string;
  receivedQty: number;
  shippedQty: number;
  onHandQty: number;
  utilizationPct: number;
  /** S2.7 근사치 표시 — 일별 점유 스냅샷이 아니라 현재 시점 값(Stage 11에서 물질화) */
  utilizationIsCurrent?: boolean;
}

/** `GET /admin/inventory/invariant` 행 — 빈 배열이 정상 */
export interface InvariantMismatch {
  location: { code: string };
  seller: { code: string };
  product: { id: number; gtin: string };
  lot: { lotNo: string };
  status: StockStatus;
  stockQty: number;
  txQty: number;
}

/** `POST /admin/inventory/adjust` 요청 — 화면 체크·ICQA 전 임시 창구 */
export interface AdjustInventoryRequest {
  locationCode: string;
  sellerCode: string;
  gtin: string;
  lotNo: string;
  status: StockStatus;
  delta: number;
  reason: string;
}

export interface AdjustInventoryResponse {
  stockId: number;
  qty: number;
}

/**
 * Spring Data `Page<T>` 응답 — `GET /locations` 목록이 이 형식으로 온다.
 * 실무에서 실제로 쓰이는 필드만 옮겼다(`pageable`·`sort` 등 메타 필드는 제외).
 */
export interface Page<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  /** 0-based 페이지 번호 */
  number: number;
  size: number;
  first: boolean;
  last: boolean;
  empty: boolean;
}

/* ── 6. 입고 — ASN·수령·검수 (Stage 3) ─────────────────────────────────────
   정본: backend/docs/02-system/02-data-model.md §3.2·§3.5, docs/tasks/
   2026-09-11-stage3-inbound-asn-handoff.md §3. 백엔드 응답 DTO 필드명은 문서에
   테이블(컬럼)만 있고 JSON 스키마가 없어, 이 저장소의 다른 목록/상세 응답(예: StockItem
   의 seller/product 중첩 객체)과 같은 관례로 설계했다 — 라이브 검증에서 실제 응답과 어긋나면
   이 파일과 `endpoints.ts` 의 `asn` 묶음만 고치면 된다(화면 컴포넌트는 타입을 통해서만 닿는다). */

export type AsnStatus = "REGISTERED" | "ARRIVED" | "RECEIVING" | "PARTIALLY_RECEIVED" | "CLOSED";
export type ReceiptStatus = "OPEN" | "COMPLETED";
export type Discrepancy = "SHORT" | "OVER" | "DAMAGED" | "LOT_CHANGED";

/** `POST /asns` 요청의 품목 한 줄 — 로트는 화주(ASN)가 갖고 온다(정본 §3.1) */
export interface AsnItemCreate {
  gtin: string;
  expectedQty: number;
  lotNo: string;
  expiresOn?: string | null;
}

/** `POST /asns` 요청 */
export interface CreateAsnRequest {
  sellerCode: string;
  asnNo: string;
  expectedOn: string;
  note?: string;
  items: AsnItemCreate[];
}

/** `GET /asns` 목록 행 */
export interface AsnListItem {
  id: number;
  seller: { code: string; name: string };
  asnNo: string;
  expectedOn: string;
  status: AsnStatus;
  note: string | null;
  createdAt: string;
  closedAt: string | null;
}

/** `GET /asns` 쿼리 */
export interface AsnQuery {
  seller?: string;
  status?: AsnStatus;
  page?: number;
  size?: number;
}

/** `GET /asns/{id}` 품목 한 줄 — 예정·수령 누계·파손 누계·미달을 서버가 집계해 준다 */
export interface AsnItemDetail {
  id: number;
  product: { id: number; gtin: string; name: string };
  expectedQty: number;
  lotNo: string;
  expiresOn: string | null;
  /** 같은 asn_item 에 걸린 receipt_item.received_qty 합(정본 §3.2) */
  receivedQty: number;
  /** 같은 asn_item 에 걸린 receipt_item.damaged_qty 합 */
  damagedQty: number;
  /** max(expectedQty - receivedQty, 0) */
  shortQty: number;
}

/** `GET /asns/{id}` 의 receipt 목록 한 줄 */
export interface AsnReceiptSummary {
  id: number;
  seqNo: number;
  arrivedAt: string;
  status: ReceiptStatus;
  completedAt: string | null;
}

/** `GET /asns/{id}` 상세 */
export interface AsnDetail extends AsnListItem {
  items: AsnItemDetail[];
  receipts: AsnReceiptSummary[];
}

/** `POST /asns/{id}/arrive` 응답 — 새로 연 receipt */
export interface ArriveAsnResponse {
  receiptId: number;
  seqNo: number;
}

/** `GET /receipts/{id}/pending-items` 행 — 이 receipt 에서 아직 검수 입력 안 된 ASN 품목 */
export interface PendingReceiptItem {
  asnItemId: number;
  product: { id: number; gtin: string; name: string };
  expectedQty: number;
  lotNo: string;
  expiresOn: string | null;
}

export interface PendingItemsResponse {
  items: PendingReceiptItem[];
}

/** `POST /receipts/{id}/items` 요청 — GTIN 이 이 ASN 에 없으면 409 `ASN_ITEM_NOT_FOUND` */
export interface AddReceiptItemRequest {
  gtin: string;
  receivedQty: number;
  damagedQty: number;
  lotNo?: string;
  expiresOn?: string | null;
}

/** `POST /receipts/{id}/items` 응답 — 등록된 receipt_item */
export interface ReceiptItemResponse {
  id: number;
  asnItemId: number;
  product: { id: number; gtin: string; name: string };
  receivedQty: number;
  damagedQty: number;
  lotNo: string;
  expiresOn: string | null;
  discrepancy: Discrepancy | null;
  inspectedAt: string;
}

/** `POST /receipts/{id}/complete` 응답 — receipt COMPLETED, ASN 상태 판정 결과를 함께 준다 */
export interface CompleteReceiptResponse {
  receiptId: number;
  status: "COMPLETED";
  asnId: number;
  asnStatus: AsnStatus;
}

/** `POST /asns/{id}/close` 응답 */
export interface CloseAsnResponse {
  id: number;
  status: "CLOSED";
}

