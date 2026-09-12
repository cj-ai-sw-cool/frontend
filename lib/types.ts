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
  | "ASN_ITEM_NOT_FOUND"
  /** 진열 확정(Stage 4) — 잠금 아래 재검증 실패. `detail` 이 `PutawayRejectedDetail` 모양(정본 §4.5) */
  | "PUTAWAY_REJECTED"
  /** 진열(Stage 4) — stockId 가 없거나 이미 다 옮겨진 재고(2026-09-11 백엔드 라이브 보고) */
  | "STOCK_NOT_FOUND"
  /** 웨이브(Stage 6) — `GET /waves/{id}`·`.../tasks` 에서 id 가 없을 때(2026-09-11 백엔드 보고) */
  | "WAVE_NOT_FOUND"
  /** 피킹 배치(Stage 6) — `GET /pick-batches/{id}` 에서 id 가 없을 때(2026-09-11 백엔드 보고) */
  | "PICK_BATCH_NOT_FOUND"
  /** claim(Stage 7) — 먼저 가져간 작업자가 있을 때 409(정본 §7.1) */
  | "ALREADY_CLAIMED"
  /** claim(Stage 7) — 배치 토트 풀이 바닥났을 때 409(정본 §7.2) */
  | "NO_TOTE"
  /** 피킹 확정(Stage 7) — `POST /pick-tasks/{id}/pick` 에서 태스크 id 가 없을 때 404 */
  | "PICK_TASK_NOT_FOUND"
  /** 리빈 세션 시작(Stage 8) — 배치의 취소 아닌 주문 수만큼 빈 슬롯이 없을 때 409(정본 §8.1) */
  | "NO_SLOT"
  /** 리빈 종료(Stage 8) — 미완성 슬롯(주문)이 남아 있는데 `force` 없이 finish 를 부를 때
   * 409(정본 §8.3). 자동 처리는 `force` 를 안 보내므로 이 코드가 그대로 올라올 수 있다 */
  | "INCOMPLETE"
  /** 품목 스캔(Stage 9) — 스캔한 GTIN이 배송단위 품목에 없을 때 409(정본 §9.3) */
  | "NOT_IN_SHIPMENT"
  /** 품목 스캔(Stage 9) — 배송단위 토트에 위치한 그 주문의 ACTIVE HARD 할당에 없을 때
   * 409(정본 §9.3) */
  | "NOT_IN_TOTE"
  /** 품목 스캔(Stage 9) — 이미 필요 수량만큼 스캔한 품목을 더 스캔할 때 409(정본 §9.3) */
  | "OVER_SCAN"
  /** 포장완료(Stage 9) — 대조 미완(`detail.unverifiedItemCount`) 또는 보충 대기
   * (`detail.replenishBatchId`)로 막힐 때 409(백엔드 2026-09-12 라이브 보고). 코드 이름은
   * Stage 7~8 전환기의 `NOT_READY`와 같지만 뜻은 Stage 9로 완전히 바뀌었다 — 전환기의
   * PICKING/REBINNING 이중 차감 차단은 §9.1에서 제거됐다 */
  | "NOT_READY";

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
 * ~~1-5 `POST /inbound/stock-in`~~ — Stage 3 에서 삭제(정본 §3.5 "기존 POST /inbound/stock-in
 * 은 삭제"). Stage 2 전환기(T1)의 화주·로트 필수 재고 증가 경로였는데, ASN 검수
 * (`POST /receipts/{id}/items`, `AddReceiptItemRequest`)로 대체됐다.
 * `lib/endpoints.ts`·`_data/use-inbound.ts` 는 이 계약을 더 이상 부르지 않는다 — 타입만 남긴
 * 이유는 미사용 데모 목업(`app/inbound/_mock/inbound.ts`, 어디서도 import 되지 않는다)이
 * 여전히 참조해서다.
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
  /** 낱개 스캔 누계(Stage 9, 정본 §9.3) — `qty` 와 같아지면 그 품목은 대조 완료 */
  verifiedQty: number;
}

/** 배송단위의 보충 대기 상태(Stage 9, 정본 §9.3) — 파손 신고로 연 `REPLENISH` 배치가
 * 아직 안 끝났으면 채워진다. 채워져 있으면 포장완료를 막고 "보충 대기" 배지를 띄운다 */
export interface ShipmentReplenish {
  batchId: number;
  status: PickBatchStatus;
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
  /** 보충 대기 중이 아니면 null(Stage 9, 정본 §9.3) */
  replenish: ShipmentReplenish | null;
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

/* ── 3-5b. 낱개 스캔 대조 · 파손 (Stage 9, 정본 §9.3) ───────────────────── */

/** `POST /shipments/{id}/scan` 요청 — `qty` 생략 시 서버 기본값 1 */
export interface ItemScanRequest {
  gtin: string;
  qty?: number;
}

/** `POST /shipments/{id}/scan` 응답의 품목 한 줄 — 백엔드 2026-09-12 라이브 보고로 `name` 추가 */
export interface ItemScanStatus {
  gtin: string;
  name: string;
  need: number;
  verified: number;
}

/** `POST /shipments/{id}/scan` 응답 — `complete` 는 전 품목 `verified = need` 인가.
 * `shipmentId` 는 백엔드 2026-09-12 라이브 보고로 추가(초안에는 없었다) */
export interface ItemScanResponse {
  shipmentId: number;
  items: ItemScanStatus[];
  complete: boolean;
}

/** `POST /shipments/{id}/damage` 요청 */
export interface DamageReportRequest {
  gtin: string;
  qty: number;
  worker: string;
}

/** `POST /shipments/{id}/damage` 응답의 보충 배치 태스크 한 줄 */
export interface DamageReplenishTask {
  pickTaskId: number;
  seqNo: number;
  locationCode: string;
  qty: number;
}

/** `outcome: "REPLENISH"` 일 때만 채워진다 — 칸에서 다시 약속해 연 배치 */
export interface DamageReplenish {
  pickBatchId: number;
  status: PickBatchStatus;
  tasks: DamageReplenishTask[];
}

/** `outcome: "ORDER_CANCELLED"` 일 때 입고장으로 반납된 정상품 한 줄 */
export interface DamageRestockedItem {
  gtin: string;
  name: string;
  lotNo: string | null;
  qty: number;
}

/** `POST /shipments/{id}/damage` 응답 — 실제 백엔드 레코드(`DamageReportResponse.java`) 그대로.
 * 초안에는 `{outcome, replenishBatchId}` 뿐이었으나, `replenish` 는 중첩 객체이고 `shipmentId`·
 * `gtin`·`qty`·`restocked`·`items` 도 같이 온다(2026-09-13 라이브 대조로 정정).
 * `replenish` 는 `REPLENISH` 일 때만, `restocked` 는 `ORDER_CANCELLED` 일 때만 값이 찬다 —
 * 나머지 갈래에서는 각각 `null`/빈 배열이다(정본 §9.3, `ShipmentDamageService.report`). */
export interface DamageReportResponse {
  shipmentId: number;
  gtin: string;
  qty: number;
  outcome: "REPLENISH" | "ORDER_CANCELLED";
  replenish: DamageReplenish | null;
  restocked: DamageRestockedItem[];
  items: ItemScanStatus[];
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
  /** 유통기한 출고 금지선(일) — Stage 5, 정본 §5.1·§5.2. 기본 7 */
  minShelfLifeDays: number;
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

/** 불변식 1 위반 행(`stock.qty ≠ Σtx`) — `GET /admin/inventory/invariant` 응답의
 * `stockVsLedger[]`(정본 §2.6). 빈 배열이 정상 */
export interface InvariantMismatch {
  location: { code: string };
  seller: { code: string };
  product: { id: number; gtin: string };
  lot: { lotNo: string };
  status: StockStatus;
  stockQty: number;
  txQty: number;
}

/** 불변식 2 위반 행(`Σ ACTIVE HARD allocation.qty > stock.qty(AVAILABLE)`) — 정본 §7.9,
 * `GET /admin/inventory/invariant` 응답의 `allocationOverStock[]`. `InvariantMismatch`와
 * 같은 키(로케이션·화주·상품·로트)지만 원장 대신 활성 HARD 할당 합을 견준다. 빈 배열이 정상 */
export interface AllocationOverStockRow {
  location: { code: string };
  seller: { code: string };
  product: { id: number; gtin: string };
  lot: { lotNo: string };
  allocatedQty: number;
  stockQty: number;
}

/**
 * `GET /admin/inventory/invariant` 응답 — Stage 7 까지는 배열이었으나(§7.9 결정, 브리프
 * "S7.7 변경 반영") 이제 두 불변식을 한 객체로 함께 담는다. 정본 §8.4·§8.5 "불변식
 * {stockVsLedger:[], allocationOverStock:[]}" — 둘 다 빈 배열이 정상.
 */
export interface InvariantCheckResult {
  stockVsLedger: InvariantMismatch[];
  allocationOverStock: AllocationOverStockRow[];
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
   2026-09-11-stage3-inbound-asn-handoff.md §3. 필드는 백엔드 응답 레코드
   (AsnController/ReceiptController, backend/src/main/java/com/awesome/backend/
   inbound/asn/controller/) 를 라이브 검증(2026-09-11)으로 그대로 옮겼다 — 평평한
   sellerCode/sellerName·productId/gtin/productName 필드다. 이 저장소의 다른 응답
   (StockItem 의 seller/product 중첩 객체)과는 다른 모양이니 섞어 쓰지 않는다. */

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

/** `POST /asns` 요청 — `AsnCreateRequest` */
export interface CreateAsnRequest {
  sellerCode: string;
  asnNo: string;
  expectedOn: string;
  note?: string;
  items: AsnItemCreate[];
}

/** `GET /asns` 목록 행 — `AsnResponse` */
export interface AsnListItem {
  asnId: number;
  sellerCode: string;
  sellerName: string;
  asnNo: string;
  expectedOn: string;
  status: AsnStatus;
  note: string | null;
  itemCount: number;
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

/** `GET /asns/{id}` 품목 한 줄 — `AsnItemResponse`. 예정·수령·파손 누계·미달을 서버가 집계해 준다 */
export interface AsnItemDetail {
  asnItemId: number;
  productId: number;
  gtin: string;
  productName: string;
  dimStatus: DimStatus;
  expectedQty: number;
  /** 파손을 포함한 수령 누계 */
  receivedQty: number;
  damagedQty: number;
  /** max(expectedQty - receivedQty, 0) */
  shortageQty: number;
  lotNo: string;
  expiresOn: string | null;
}

/** `GET /asns/{id}` 의 receipt 안 검수 한 줄 — `ReceiptItemResponse` */
export interface ReceiptItemDetail {
  receiptItemId: number;
  asnItemId: number;
  gtin: string;
  productName: string;
  /** 파손을 포함한 총 수령 */
  receivedQty: number;
  damagedQty: number;
  lotNo: string;
  expiresOn: string | null;
  discrepancy: Discrepancy | null;
  inspectedAt: string;
}

/** `GET /asns/{id}` 의 receipt 목록 한 줄 — `ReceiptResponse` */
export interface AsnReceiptSummary {
  receiptId: number;
  seqNo: number;
  status: ReceiptStatus;
  arrivedAt: string;
  completedAt: string | null;
  items: ReceiptItemDetail[];
}

/** `GET /asns/{id}` 상세, `POST /asns`·`POST /asns/{id}/close` 응답 — `AsnDetailResponse` */
export interface AsnDetail extends AsnListItem {
  items: AsnItemDetail[];
  receipts: AsnReceiptSummary[];
}

/** `POST /asns/{id}/arrive` 응답 — `ArriveResponse`. 새로 연 receipt 를 함께 돌려준다 */
export interface ArriveAsnResponse {
  asnId: number;
  status: AsnStatus;
  receiptId: number;
  seqNo: number;
}

/**
 * `GET /receipts/{id}/pending-items` 행 — `PendingItemResponse`.
 * 이 receipt 에서 아직 검수 입력 안 된 ASN 품목. 응답은 이 타입의 **배열**이다(래퍼 객체 없음).
 */
export interface PendingReceiptItem {
  asnItemId: number;
  productId: number;
  gtin: string;
  productName: string;
  imageUrl: string | null;
  dimStatus: DimStatus;
  expectedQty: number;
  /** 지금까지(이전 receipt 포함) 수령 누계 */
  receivedQty: number;
  /** expectedQty - receivedQty — 이번 도착에 받을 것으로 기대하는 수량. 검수 입력의 기본값 */
  remainingQty: number;
  lotNo: string;
  expiresOn: string | null;
}

/** `POST /receipts/{id}/items` 요청 — `ReceiptItemRequest`. GTIN 이 이 ASN 에 없으면 409 `ASN_ITEM_NOT_FOUND` */
export interface AddReceiptItemRequest {
  gtin: string;
  /** 0 도 받는다 — 예정 품목이 이번 도착에 하나도 안 왔음을 기록할 때 */
  receivedQty: number;
  damagedQty: number;
  lotNo?: string;
  expiresOn?: string | null;
}

/** `POST /receipts/{id}/items` 응답 — `ReceiptItemCreatedResponse` */
export interface ReceiptItemCreatedResponse {
  receiptItemId: number;
  receiptId: number;
  asnItemId: number;
  gtin: string;
  productName: string;
  receivedQty: number;
  damagedQty: number;
  lotNo: string;
  expiresOn: string | null;
  discrepancy: Discrepancy | null;
  expectedQty: number;
  /** 이번 입력을 포함한 수령 누계 */
  receivedTotalQty: number;
  shortageQty: number;
  asnId: number;
  asnStatus: AsnStatus;
}

/** `POST /receipts/{id}/complete` 응답 — `ReceiptCompleteResponse`. ASN 상태 판정까지 끝난 상세를 함께 준다 */
export interface CompleteReceiptResponse {
  receiptId: number;
  receiptStatus: ReceiptStatus;
  asn: AsnDetail;
}

/* ── 7. 진열 — directed putaway (Stage 4) ──────────────────────────────────
   정본: backend/docs/02-system/02-data-model.md §4.5(API)·§4.6(프론트 계약), docs/tasks/
   2026-09-11-stage4-putaway-handoff.md §3. 백엔드(stage4-backend)가 2026-09-11 라이브로
   전한 실제 응답에 맞췄다 — 정본과 다른 점은 전부 **추가**이고 삭제·변경은 없다(백엔드
   보고 그대로). */

export type PutawayTier = "SAME_LOT" | "SAME_SELLER" | "EMPTY";

/**
 * `GET /putaway/pending` 행 — 입고장(RCV-01)의 AVAILABLE 재고. `StockItem`(§5)과 같은
 * 모양이지만 이 화면 전용으로 별도 타입을 둔다 — 로케이션이 항상 RCV-01 이라 그 필드가 없다.
 * `dimConfirmed` — 계약 초안의 `dimStatus: DimStatus` 대신 백엔드가 boolean 으로 준다.
 * `product.tempZone` — 정본 §4.2, 온도 필터 설명용(예: 냉장품은 F존만 추천).
 */
export interface PutawayPendingItem {
  stockId: number;
  seller: { code: string; name: string };
  product: { id: number; gtin: string; name: string; tempZone: TempZone };
  lot: { lotNo: string; expiresOn: string | null };
  qty: number;
  dimConfirmed: boolean;
}

/** `GET /putaway/pending` 쿼리 */
export interface PutawayPendingQuery {
  seller?: string;
  page?: number;
  size?: number;
}

/**
 * `POST /putaway/recommend` 이동 후보 한 칸.
 * `zoneCode`/`rackNo`/`levelNo`/`colNo` — 백엔드가 `locationCode` 와 함께 분해된 값도 준다
 * (2026-09-11 라이브 보고). 프론트에서 문자열을 다시 쪼갤 필요가 없다.
 */
export interface PutawayMove {
  locationCode: string;
  zoneCode: string;
  rackNo: number;
  levelNo: number;
  colNo: number;
  qty: number;
  tier: PutawayTier;
  /** 이 이동을 반영한 뒤의 적재율(%) — `BinCapacity.loadLevel` */
  loadLevelAfterPct: number;
}

/** `POST /putaway/recommend` 요청 — `qty` 생략 = 전량 */
export interface PutawayRecommendRequest {
  stockId: number;
  qty?: number;
}

/** `POST /putaway/recommend` 응답 — 상한 5칸, 다 못 넣으면 `unplacedQty` */
export interface PutawayRecommendResponse {
  moves: PutawayMove[];
  unplacedQty: number;
}

/** `POST /putaway/confirm` 요청 — 화면이 고른(추천 그대로 또는 다른 칸으로 바꾼) 이동 목록 */
export interface PutawayConfirmRequest {
  stockId: number;
  moves: { locationCode: string; qty: number }[];
}

/**
 * `POST /putaway/confirm` 응답 — 확정된 이동. 실패는 전체 롤백 + 409 `PUTAWAY_REJECTED`.
 * `movedQty`/`remainingQty` — 백엔드 라이브 보고(2026-09-11)로 정정. 계약 초안에는 없었다.
 */
export interface PutawayConfirmResponse {
  stockId: number;
  movedQty: number;
  remainingQty: number;
  moves: { locationCode: string; qty: number }[];
}

/** 409 `PUTAWAY_REJECTED` 의 `detail` — `ApiError.detail` 을 이 모양으로 좁혀 읽는다 */
export interface PutawayRejectedDetail {
  locationCode: string;
  reason: string;
}

/** `GET /locations/{code}/capacity` 안 항목 — 그 칸에 지금 들어 있는 재고 한 줄 */
export interface LocationCapacityItem {
  seller: { code: string; name: string };
  product: { id: number; gtin: string; name: string };
  lot: { lotNo: string; expiresOn: string | null };
  qty: number;
}

/**
 * `GET /locations/{code}/capacity` 쿼리 — `stockId`/`qty` 는 선택. 둘 다 주면 응답에
 * `acceptable`/`rejectReason`/`maxQty` 가 함께 온다(그 재고 기준 수용 판정, 2026-09-11
 * 백엔드 라이브 보고 — 정본 §4.5 에 없던 추가 기능). "다른 칸" 입력이 이 조합을 쓴다.
 */
export interface LocationCapacityQuery {
  stockId?: number;
  qty?: number;
}

/**
 * `GET /locations/{code}/capacity` 응답 — "다른 칸" 입력의 확인 결과.
 * `zoneCode`/`tempZone`/`gradeCapCm` 은 온도·규격 필터를 화면에서 설명하는 데 쓴다(§4.3).
 * `acceptable`/`rejectReason`/`maxQty` 는 `stockId` 쿼리를 줬을 때만 채워진다 — 안 주면
 * 셋 다 `null`(백엔드가 그렇게 명시했다).
 */
export interface LocationCapacity {
  locationCode: string;
  zoneCode: string | null;
  tempZone: TempZone | null;
  gradeCapCm: number | null;
  volumeCm3: number | null;
  loadLevelPct: number;
  items: LocationCapacityItem[];
  acceptable: boolean | null;
  rejectReason: string | null;
  maxQty: number | null;
}

/* ── 9. 주문·soft 할당 (Stage 5) ────────────────────────────────────────────
   정본: backend/docs/02-system/02-data-model.md §5.2·§5.7, docs/tasks/
   2026-09-11-stage5-orders-allocation-handoff.md §3 S5.4. 백엔드가 이 화면과 동시에
   만들어지는 중이라 — 계약(§5.7)대로 먼저 붙이고 라이브 검증은 완료 보고에서 남긴다. */

/** 정본 §5.2 — 기존 IN_PACKING/PACKED/LOADED 는 PACKING/SHIPPED 로 흡수됐다 */
export type OrderStatus =
  | "RECEIVED"
  | "ALLOCATED"
  | "WAVED"
  | "PICKING"
  | "REBINNING"
  | "PACKING"
  | "SHIPPED"
  | "CANCELLED";

/** 주문 취소가 허용되는 상태 — 정본 §5.5. 그 밖은 409 `INVALID_STATE` */
export const CANCELLABLE_ORDER_STATUSES: readonly OrderStatus[] = ["RECEIVED", "ALLOCATED"];

export type AllocationStage = "SOFT" | "HARD";
export type AllocationStatus = "ACTIVE" | "CONSUMED" | "CANCELLED";

/**
 * 주문 품목 한 줄의 할당 — 정본 §5.2. `lotNo`/`locationCode`/`expiresOn` 은 HARD 에서만
 * 채워진다(Stage 6, 정본 §6.7 "HARD 할당(칸·로트·유통기한)"). `allocationId`/`orderItemId`
 * — 2026-09-11 라이브 검증으로 정정. 계약 초안에는 품목 아래 중첩으로 적었지만, 실제로는
 * `OrderDetail.allocations` 가 **품목과 나란한 최상위 배열**이고 `orderItemId` 로 그 품목을
 * 가리킨다 — 화면(`order-detail-panel.tsx`)이 이 값으로 묶는다.
 * ⚠️ `lotNo`/`locationCode`/`expiresOn` — Stage 6 백엔드 2026-09-11 보고로 정정. 필드
 * 자체는 항상 온다(SOFT 단계에서는 **셋 다 `null`**, 필드가 빠지는 게 아니다) — 그래서
 * 옵셔널이 아니라 nullable 로 둔다.
 */
export interface OrderAllocation {
  allocationId: number;
  orderItemId: number;
  productId: number;
  gtin: string;
  qty: number;
  stage: AllocationStage;
  status: AllocationStatus;
  lotNo: string | null;
  locationCode: string | null;
  expiresOn: string | null;
}

/** `orderItemId` — 2026-09-11 라이브 검증으로 정정(계약 초안의 `id` 대신) */
export interface OrderDetailItem {
  orderItemId: number;
  productId: number;
  gtin: string;
  name: string;
  qty: number;
}

/**
 * 주문에 딸린 배송단위 요약 — T6(정본 §5.6), Stage 6에서 hard 할당 뒤로 옮겨진다.
 * `lineId`/`toteCode`/`items` — 2026-09-11 라이브 검증으로 정정. 계약 초안의
 * `tote: {toteId, barcode}` 중첩 대신 **토트 바코드를 문자열로 바로** 준다(아직 안
 * 배정됐으면 `null` 로 추정 — 라이브에서는 항상 배정된 경우만 확인됐다).
 */
export interface OrderShipmentSummary {
  shipmentId: number;
  seqNo: number;
  status: ShipmentStatus;
  lineId: number;
  toteCode: string | null;
  items: { productId: number; gtin: string; name: string; qty: number }[];
}

/**
 * `GET /orders` 목록 항목. `orderId`/`sellerCode`/`sellerName` — 2026-09-11 라이브 검증으로
 * 정정(계약 초안의 `id`·중첩 `seller` 대신). ⚠️ **목록과 상세가 화주를 다르게 표현한다** —
 * 목록은 이 평평한 두 필드, 상세(`OrderDetail`)는 중첩 `seller` 객체다. 화면이 각자 맞춰
 * 읽는다(같은 모양으로 통일해 달라고 정리하지 않는다 — 지금은 실제 응답을 그대로 따른다).
 */
export interface OrderListItem {
  orderId: number;
  receiptNo: string;
  sellerCode: string;
  sellerName: string;
  regionCode: string;
  status: OrderStatus;
  orderedAt: string;
  cutoffAt: string | null;
  cancelledAt: string | null;
  /** 2026-09-12 라이브 검증으로 추가 — 계약 초안엔 없었지만 실제 응답에 항상 온다 */
  createdAt: string;
}

/**
 * `GET /orders/{id}` — 품목·할당·배송단위(정본 §5.7). `orderId` — 라이브 검증으로 정정.
 * `allocations` 는 품목과 나란한 최상위 배열이다(위 `OrderAllocation` 주석 참고) — 화면이
 * `orderItemId` 로 묶어서 보여준다.
 */
export interface OrderDetail {
  orderId: number;
  receiptNo: string;
  seller: { code: string; name: string };
  regionCode: string;
  status: OrderStatus;
  orderedAt: string;
  cutoffAt: string | null;
  cancelledAt: string | null;
  /** 2026-09-12 라이브 검증으로 추가 — 계약 초안엔 없었지만 실제 응답에 항상 온다 */
  createdAt: string;
  items: OrderDetailItem[];
  allocations: OrderAllocation[];
  shipments: OrderShipmentSummary[];
}

/** `GET /orders` 쿼리 */
export interface OrdersQuery {
  seller?: string;
  status?: OrderStatus;
  page?: number;
  size?: number;
}

/** `POST /orders/{id}/cancel` 응답 — `orderId` 는 2026-09-11 라이브 검증으로 정정 */
export interface OrderCancelResponse {
  orderId: number;
  status: "CANCELLED";
  cancelledAt: string;
}

/** `POST /admin/orders/import` 요청 한 줄 — 기존 형식 + `cutoffAt`(정본 §5.7) */
export interface OrdersImportRequest {
  batchId: string;
  sellerCode: string;
  orders: {
    receiptNo: string;
    regionCode: string;
    orderedAt: string;
    /** 마감시각 — 출처는 Stage 6 결정, 지금은 선택 입력(정본 §5.2) */
    cutoffAt?: string;
    items: { gtin: string; qty: number }[];
  }[];
}

/** `POST /admin/orders/import` 거부 한 건 — `reason` 이 `INSUFFICIENT_STOCK` 이면 `detail` 에
 * `{gtin, requested, available}` 이 온다(정본 §5.4) */
export interface OrdersImportRejected {
  receiptNo: string;
  reason: string;
  detail?: Record<string, unknown>;
}

/**
 * `POST /admin/orders/import` 응답. `shipments` 는 Stage 6 에서 완전히 사라졌다(T6 종료,
 * 백엔드 2026-09-11 보고로 필드 삭제 확정 — 0 이 아니라 없다). 화면(`order-import-panel.tsx`)
 * 은 이 필드를 표시하지 않는다.
 */
export interface OrdersImportResponse {
  batchId: string;
  orders: number;
  splitOrders: number;
  rejected: OrdersImportRejected[];
}

/**
 * `GET /sellers/{code}/atp` 행 — 화주 가용재고 표(분석 화면 마스터 창).
 * `onHand` 는 BIN·AVAILABLE 만, `blockedByShelfLife` 는 금지선에 걸려 ATP 에서 빠진 수량
 * (정본 §5.3). `productId`/`name` — 2026-09-11 라이브 검증으로 정정(초안에는
 * `productName` 으로 적었으나 실제 필드는 `name` 이고 `productId` 가 함께 온다).
 */
export interface AtpRow {
  productId: number;
  gtin: string;
  name: string;
  onHand: number;
  allocated: number;
  blockedByShelfLife: number;
  atp: number;
}

/** `PATCH /sellers/{code}` 요청 — 금지선 일수만 바꾼다(정본 §5.1) */
export interface UpdateSellerRequest {
  minShelfLifeDays: number;
}

/* ── 6. 웨이브·hard 할당·피킹 배치 (Stage 6) ─────────────────────────────
   정본: backend/docs/02-system/02-data-model.md §6.3·§6.5, docs/tasks/
   2026-09-11-stage6-wave-hard-handoff.md §3. 필드명은 백엔드(stage6-backend)가 2026-09-11
   에 WaveApiIT 로 jsonPath 검증까지 걸어 직접 보고한 응답 그대로다(엔드포인트가 아직 push
   전이라 curl 라이브 대조는 못 했지만, 응답 모양은 이미 고정됐다고 보고 받았다). */

/** 웨이브 상태 — 정본 §6.6. RELEASED(생성) 만 Stage 6 범위, PICKING·DONE 은 Stage 7 전이 */
export type WaveStatus = "RELEASED" | "PICKING" | "DONE";

/** 피킹 배치 상태 — 정본 §6.3. OPEN 만 Stage 6 범위, 나머지는 Stage 7 claim 이후 */
export type PickBatchStatus = "OPEN" | "CLAIMED" | "PICKING" | "DONE";

/** 배치 종류(Stage 9, 정본 §9.2) — `REPLENISH` 는 파손 보충용, 목적지가 배송단위 토트다 */
export type PickBatchKind = "WAVE" | "REPLENISH";

/** 피킹 태스크 상태 — 정본 §6.3·§7.2. 배치 생성 직후는 전부 PENDING. `CANCELLED` 는
 * Stage 7 — 재할당 실패로 주문이 취소되면 그 주문 몫만 남은(아직 못 집은) 태스크가
 * 이 상태가 된다(백엔드 2026-09-12 보고). 화면은 이 상태를 건너뛴다 */
export type PickTaskStatus = "PENDING" | "PICKED" | "SHORT" | "CANCELLED";

/** 웨이브 생성 때 hard 할당이 안 되어 빠진 주문의 사유 — 백엔드 2026-09-11 보고.
 * `HARD_SHORT` 만 재고 부족(정상 경로), 나머지 셋은 예외 경로 */
export type WaveSkippedReason = "HARD_SHORT" | "ALREADY_WAVED" | "INVALID_STATE" | "INTERNAL_ERROR";

/**
 * 웨이브 생성 때 hard 할당이 안 되어 빠진 주문 — 정본 §6.4, 백엔드 2026-09-11 보고로 확정.
 * `receiptNo` 는 초안에 없었다(화면에 사유를 사람이 읽는 자리 — `wave-create-dialog.tsx`
 * 참고). `detail` 은 사유마다 키가 다르다 — `HARD_SHORT` 는 `{productId, requested,
 * available}`. 그 주문은 ALLOCATED 로 남고 다음 웨이브 후보가 된다.
 */
export interface WaveSkipped {
  orderId: number;
  receiptNo: string;
  reason: WaveSkippedReason | string;
  detail?: Record<string, unknown>;
}

/** `GET /waves` 목록 항목 — 백엔드 2026-09-11 보고. `batchCount` 는 초안에 없었다 */
export interface WaveListItem {
  waveId: number;
  waveNo: string;
  cutoffAt: string;
  status: WaveStatus;
  orderCount: number;
  batchCount: number;
  createdAt: string;
}

/**
 * 웨이브 상세의 주문 한 줄 — 정본 §6.5 "주문 목록", 백엔드 2026-09-11 보고로 필드를
 * 대폭 늘렸다(초안에는 `orderId`/`receiptNo`/`sellerCode`/`status` 만 있었다).
 * `pickBatchId` 는 배치 편성이 안 된 주문(슬롯 부족으로 다음 배치로 밀린 주문, 정본
 * §6.2a)이면 null.
 */
export interface WaveOrderSummary {
  orderId: number;
  receiptNo: string;
  sellerCode: string;
  sellerName: string;
  regionCode: string;
  status: OrderStatus;
  orderedAt: string;
  cutoffAt: string | null;
  pickBatchId: number | null;
}

/** 웨이브 상세의 배치 한 줄 — 클릭하면 `pickBatches.get` 으로 태스크 표를 연다.
 * `taskCount`/`claimedBy`/`claimedAt` 은 백엔드 2026-09-11 보고로 추가(초안에는 없었다) —
 * claimedBy·claimedAt 은 Stage 7 전까지 항상 null.
 * `pickedTaskCount` — Stage 7, 포장 화면 웨이브 탭 배치 표의 "진행 n/N"(브리프 §3). 백엔드에
 * 필드 추가를 요청해 둔 상태라 옵셔널로 둔다 — 안 오면 화면이 n/N 대신 "—" 를 보여준다. */
export interface WaveBatchSummary {
  pickBatchId: number;
  seqNo: number;
  status: PickBatchStatus;
  orderCount: number;
  taskCount: number;
  claimedBy: string | null;
  claimedAt: string | null;
  pickedTaskCount?: number;
  /** Stage 9 추가 — 옵셔널로 두는 이유는 `pickedTaskCount` 와 같다(백엔드 롤아웃 순서
   * 보장 안 됨). 안 오면 화면이 "—" 로 보여준다 */
  kind?: PickBatchKind;
}

/**
 * `GET /waves/{id}` — 주문 목록·배치 목록·skipped(정본 §6.5). ⚠️ `skipped` 는 항상 빈
 * 배열이다(백엔드 2026-09-11 보고) — §6.3 스키마에 skipped 저장 표가 없어서(빠진 주문은
 * wave_id 가 비어 웨이브와 연결이 안 된다), 값은 웨이브 **생성 응답**(`WaveCreateResponse`)
 * 에만 찬다. 화면에서 skipped 를 보여줘야 하면 그 생성 결과를 계속 쥐고 있어야 한다 —
 * `wave-create-dialog.tsx` 가 그 결과를 대화 상자 안에서 보여주는 이유이자, GET 상세
 * (`wave-detail-panel.tsx`)의 skipped 절이 사실상 항상 비어 있는 이유. 사용자 보고에
 * 결정 사항으로 올린다(정본과 실제 스키마가 어긋나는 지점이라 프론트가 단독으로 해소할
 * 수 없다).
 */
export interface WaveDetail {
  waveId: number;
  waveNo: string;
  cutoffAt: string;
  status: WaveStatus;
  orderCount: number;
  createdAt: string;
  orders: WaveOrderSummary[];
  batches: WaveBatchSummary[];
  skipped: WaveSkipped[];
}

/**
 * 피킹 지시 한 줄 — 정본 §6.5 "순서·칸·상품·로트·유통기한·수량", 백엔드 2026-09-11 보고로
 * 필드를 정정했다. ⚠️ `productId` 가 아니라 `sellerCode`/`gtin`/`productName` 이 온다(초안은
 * `productId`/`gtin`/`name` 으로 적었다 — 실제 응답과 다르다). `expiresOn` 은 로트 조인으로
 * 들어간다(LocalDate, 유통기한 없는 로트면 null) — `seqNo` 순서가 로케이션 코드 순이라
 * FEFO 가 이 순서 그대로 보인다(화면 체크 3번, 브리프 §4).
 */
/**
 * ⚠️ Stage 7 — `zoneCode`/`rackNo`/`levelNo`/`colNo` 추가(정본 §7.4 "location{code,zone,
 * rack,level,col}", 백엔드 2026-09-12 보고). BIN 이 아닌 로케이션이면 null 일 수 있어
 * 타입은 nullable 이지만, 피킹 태스크는 항상 BIN 이라 실제로는 늘 채워진다.
 */
export interface PickTask {
  pickTaskId: number;
  seqNo: number;
  locationCode: string;
  zoneCode: string | null;
  rackNo: number | null;
  levelNo: number | null;
  colNo: number | null;
  sellerCode: string;
  gtin: string;
  productName: string;
  lotNo: string;
  expiresOn: string | null;
  qty: number;
  pickedQty: number;
  status: PickTaskStatus;
}

/** `GET /pick-batches/{id}` — 배치 상세(Stage 7 claim 의 기초, 정본 §6.5). `orders` 는
 * 백엔드 2026-09-11 보고로 정정(초안의 `orderCount` 숫자가 아니라 `WaveOrderSummary[]` 배열).
 * `waveStatus`/`toteLocationCode`/`startedAt`/`completedAt` — Stage 7 추가(백엔드 2026-09-12
 * 보고). `toteLocationCode` 는 claim 전 null. `complete` 응답에서 웨이브 상태는 별도 필드
 * 없이 이 `waveStatus` 로 본다. */
export interface PickBatchDetail {
  pickBatchId: number;
  waveId: number;
  waveNo: string;
  waveStatus: WaveStatus;
  seqNo: number;
  status: PickBatchStatus;
  claimedBy: string | null;
  claimedAt: string | null;
  toteLocationCode: string | null;
  startedAt: string | null;
  completedAt: string | null;
  orders: WaveOrderSummary[];
  tasks: PickTask[];
}

/** `GET /waves/{id}/tasks` 의 배치 한 묶음 — 배치별 피킹 지시(정본 §6.5) */
export interface WaveTaskBatch {
  pickBatchId: number;
  seqNo: number;
  status: PickBatchStatus;
  orderCount: number;
  tasks: PickTask[];
}

/** `GET /waves/{id}/tasks` 응답 — 백엔드 2026-09-11 보고로 모양이 바뀌었다(초안은 평평한
 * 배열을 가정했으나 실제로는 배치별로 묶여 온다). 배치 클릭 흐름은 `pickBatches.get` 을
 * 쓰므로(배치 상세가 더 직접적인 대응) 이 화면은 아직 호출하지 않는다 — 계약에 있는 API 라
 * 타입·래퍼만 둔다(outbound.load 와 같은 관례) */
export interface WaveTasksResponse {
  waveId: number;
  waveNo: string;
  batches: WaveTaskBatch[];
}

/** `POST /waves` 요청 — 정본 §6.4. 마감시각 기본값은 화면이 계산한다(정본 §6.2, 브리프 §3) */
export interface WaveCreateRequest {
  cutoffAt: string;
}

/** `POST /waves` 응답 — 정본 §6.4 "주문 수·배치 수·태스크 수·skipped". 이 응답의 `skipped`
 * 만 항상 찬다(`WaveDetail.skipped` 주석 참고) */
export interface WaveCreateResponse {
  waveId: number;
  waveNo: string;
  orderCount: number;
  batchCount: number;
  taskCount: number;
  skipped: WaveSkipped[];
}

/** `GET /waves` 쿼리 */
export interface WavesQuery {
  status?: WaveStatus;
  page?: number;
  size?: number;
}

/* ── 7. 피킹 (Stage 7) ──────────────────────────────────────────────────────
   정본: backend/docs/02-system/02-data-model.md §7.2·§7.3·§7.4, docs/tasks/
   2026-09-12-stage7-picking-handoff.md §3 S7.4. 백엔드(stage7-backend)와 세션 안에서
   contract 를 맞춘 뒤(2026-09-12) 적었다 — 아직 엔드포인트가 안 떠서 curl 라이브 대조는
   못 했지만, 응답 모양은 백엔드가 직접 확정해 보고한 것이다. */

/** `GET /pick-batches?status` 한 줄 — 작업자가 받을 수 있는 배치 목록(정본 §7.3, 백엔드
 * 2026-09-12 보고). 페이지네이션 없음. */
export interface PickBatchListItem {
  pickBatchId: number;
  waveId: number;
  waveNo: string;
  seqNo: number;
  status: PickBatchStatus;
  orderCount: number;
  taskCount: number;
  claimedBy: string | null;
  claimedAt: string | null;
  toteLocationCode: string | null;
}

/** `GET /pick-batches?status` 응답 */
export interface PickBatchesResponse {
  items: PickBatchListItem[];
}

/** 재할당 새 태스크 — 부족분을 다른 칸에서 채우면 배치 끝에 붙는다(정본 §7.3) */
export interface ReallocationNewTask {
  pickTaskId: number;
  seqNo: number;
  locationCode: string;
  qty: number;
}

/** 재할당 실패로 취소된 주문 — 사유는 항상 `PICK_SHORT`(정본 §7.1) */
export interface ReallocationCancelledOrder {
  orderId: number;
  receiptNo: string;
}

/**
 * 재할당 결과 — 정본 §7.3, 백엔드 2026-09-12 보고. `outcome` 은 그 태스크(칸)에 물려 있던
 * 부족분이 어떻게 됐는지를 요약한다:
 *   NEW_TASK        부족분 전부 다른 칸으로 재할당(새 태스크 추가)
 *   ORDER_CANCELLED 부족분 전부 재할당 실패 → 관련 주문 취소
 *   MIXED           부족분이 여러 주문(HARD 할당)에 걸쳐 있어 일부는 재할당, 일부는 취소
 * 화면은 `newTasks`/`cancelledOrders` 길이를 보고 안내 문구를 조합한다(브리프 §3 "응답의
 * 재할당 결과 안내").
 */
export interface Reallocation {
  outcome: "NEW_TASK" | "ORDER_CANCELLED" | "MIXED";
  newTasks: ReallocationNewTask[];
  cancelledOrders: ReallocationCancelledOrder[];
}

/* ── 7.5 작업자 시뮬레이터 (Stage 7B) ────────────────────────────────────────
   정본: backend/docs/02-system/02-data-model.md §7.5, docs/tasks/
   2026-09-12-stage7b-simulator-handoff.md §3 S7.6. 피킹 화면(PDA) 대신 서버 시뮬레이터가
   claim→pick→complete 를 단계별로 대신 호출한다 — 웨이브 탭 OPEN 배치의 "자동 처리". */

/** `POST /admin/pick-batches/{id}/simulate` 요청의 태스크별 실제 수량 지정 — 정본 §7.5.
 * 지정하지 않은 태스크(이 배열에 없는 `pickTaskId`)는 지시 수량대로 집는다. 재할당으로
 * 배치 끝에 추가된 태스크는 id 를 미리 알 수 없어 항상 지시대로다. */
export interface SimulateShortInput {
  pickTaskId: number;
  foundQty: number;
}

/** `POST /admin/pick-batches/{id}/simulate` 요청 — `worker` 기본값은 화면이 `SIM-01` 로 채운다 */
export interface SimulateRequest {
  worker: string;
  shorts: SimulateShortInput[];
}

/**
 * 시뮬레이터 결과의 단계 한 줄 — 정본 §7.5 `steps[]`. `status` 는 이 태스크 자체의 확정
 * 결과(PICKED 아니면 SHORT) — `PENDING`/`CANCELLED` 는 오지 않는다. PICKED 면
 * `reallocation` 은 null.
 */
export interface SimulateStep {
  pickTaskId: number;
  seqNo: number;
  locationCode: string;
  gtin: string;
  productName: string;
  qty: number;
  pickedQty: number;
  status: PickTaskStatus;
  reallocation: Reallocation | null;
}

/**
 * `POST /admin/pick-batches/{id}/simulate` 응답 — 정본 §7.5. OPEN 이 아니면 409
 * `INVALID_STATE`, 남이 먼저 claim 했으면(경합 중이면) claim 의 409 `ALREADY_CLAIMED` 가
 * 그대로 나간다. `elapsedMs` 는 시뮬레이터 시작부터 배치 complete 까지.
 */
export interface SimulateResponse {
  pickBatchId: number;
  worker: string;
  toteLocationCode: string | null;
  batchStatus: PickBatchStatus;
  waveStatus: WaveStatus;
  elapsedMs: number;
  steps: SimulateStep[];
  cancelledOrders: ReallocationCancelledOrder[];
  addedTasks: ReallocationNewTask[];
}

/* ── 8. 리빈 — put wall (Stage 8) ─────────────────────────────────────────
   정본: backend/docs/02-system/02-data-model.md §8.2·§8.3·§8.4, docs/tasks/
   2026-09-12-stage8-rebin-handoff.md §3 S8.3. 작업자 화면 없음(§8.1과 같은 결정) — 시뮬레이터가
   세션을 처리하고 웨이브 탭이 관전한다. 백엔드와 같은 세션에서 동시에 만들어지는 중이라 —
   §8.3에 적힌 필드명은 그대로 옮겼고, 라이브 대조는 완료 보고에서 남긴다. */

export type RebinSessionStatus = "ACTIVE" | "FINISHED";

/** `rebin_slot_assignment.status` — 정본 §8.2 스키마 그대로(ACTIVE/COMPLETED/RELEASED) */
export type RebinSlotStatus = "ACTIVE" | "COMPLETED" | "RELEASED";

/** 리빈 벽 한 슬롯의 품목 한 줄 — 정본 §8.3 "품목별 have/need". `need`=`order_item.qty`,
 * `have`=그 슬롯에 위치한 이 주문의 ACTIVE HARD 할당 합(§8.2 "주문별 진행은 저장하지 않고
 * 유도한다"). `have === need` 인 품목이 전부면 그 슬롯은 완성이다. */
export interface RebinSlotItem {
  gtin: string;
  name: string;
  need: number;
  have: number;
}

/** `GET /rebin/sessions/{id}` 슬롯 한 줄 — 정본 §8.3 */
export interface RebinSlot {
  slotCode: string;
  orderId: number;
  receiptNo: string;
  status: RebinSlotStatus;
  items: RebinSlotItem[];
}

/** 토트에 남았고 ACTIVE 할당이 없는 잉여 — 정본 §8.1 "잉여·취소분은 입고장으로 되돌린다" */
export interface RebinLeftover {
  gtin: string;
  lotNo: string;
  qty: number;
}

/**
 * `GET /rebin/sessions/{id}` 및 `GET /rebin/sessions?pickBatchId=` 응답 — 리빈 벽(정본 §8.3).
 * `pickBatchId=` 조회는 세션이 없으면 **404** — 화면은 이 404 를 "리빈 자동 처리" 버튼을 보여줄
 * 신호로 쓴다(브리프 §3, `lib/api.ts` 의 `ApiError.status`로 판별).
 * `sessionId`/`pickBatchId` — 라이브 대조(2026-09-12, 별도 배치 R-REBIN8-1)로 확인. 정본 §8.3
 * 문안에는 없었지만 실제 응답에 항상 온다.
 */
export interface RebinSessionDetail {
  sessionId: number;
  pickBatchId: number;
  status: RebinSessionStatus;
  worker: string;
  toteLocationCode: string;
  slots: RebinSlot[];
  leftovers: RebinLeftover[];
}

/** `POST /admin/rebin/simulate` 요청 — 브리프 §3 "작업자 코드 기본 SIM-01"(화면이 채운다) */
export interface RebinSimulateRequest {
  pickBatchId: number;
  worker: string;
}

/** 리빈 이동 한 줄 — `POST /rebin/sessions/{id}/scan` 응답의 `moves[]`(정본 §8.3) 그대로 */
export interface RebinScanMove {
  slotCode: string;
  receiptNo: string;
  qty: number;
}

/**
 * `POST /rebin/sessions/{id}/scan` 응답 — 정본 §8.3 + 조율자 결정 3번(2026-09-12, 백엔드
 * 세션 안 라이브 보고)으로 `unmovedQty`/`leftover` 추가. `unmovedQty` 는 읽은 수량 중 갈
 * 곳이 없어 배치 토트에 그대로 둔 몫(그 상품을 기다리는 주문이 벽에 없거나, 기다리는 양보다
 * 많이 읽었을 때 0 보다 커진다). `leftover` 는 이제 `unmovedQty > 0` 과 동치다 — 이전에는
 * `moves` 가 비었는지로 정했으나 일부만 옮겨간 경우를 놓쳤다. 지금 화면은 이 엔드포인트를
 * 직접 부르지 않고 시뮬레이터만 쓰지만, 계약에 있는 응답이라 타입을 맞춰 둔다.
 */
export interface RebinScanResponse {
  moves: RebinScanMove[];
  completedOrders: string[];
  unmovedQty: number;
  leftover: boolean;
}

/**
 * `POST /admin/rebin/simulate` 응답의 `scans[]` 원소 — 백엔드 실 구현 확정(2026-09-12,
 * 조율자 결정 3번). 이미 이동 단위로 펼쳐진 평평한 행이다(스캔 한 번에 여러 줄이 나올 수
 * 있다) — 이 프로젝트가 앞서 추정했던 `{gtin, productName, qty, moves[]}` 중첩 모양은
 * 폐기한다.
 * - 옮긴 줄: `slotCode`/`receiptNo` 채워짐, `qty` = 옮긴 수량, `unmovedQty: 0`
 * - 옮기지 못한 몫이 있으면 별도 줄로: `slotCode`/`receiptNo` 는 `null`, `qty: 0`,
 *   `unmovedQty > 0` — 결과 패널이 "옮기지 못함 n" 으로 보여준다(`rebin-result-view.tsx`).
 *   시뮬레이터는 벽이 기다리는 몫만 골라 읽으므로(§8.1) 실제로는 거의 나오지 않는다 — 잉여는
 *   스캔하지 않고 종료(finish)가 입고장으로 되돌린다.
 */
export interface RebinSimulateScan {
  slotCode: string | null;
  receiptNo: string | null;
  gtin: string;
  productName: string;
  qty: number;
  unmovedQty: number;
}

/** 반납(RESTOCK) 한 줄 — 정본 §8.3 "restocked:[{gtin, lotNo, qty}]" + `productName`
 * (2026-09-12 백엔드 라이브 보고로 추가 — 정본 초안에는 없었다) */
export interface RebinRestockRow {
  gtin: string;
  productName: string;
  lotNo: string;
  qty: number;
}

/**
 * `POST /admin/rebin/simulate` 응답 — 정본 §8.3. `completedOrders` 는 `receiptNo` 문자열
 * 배열이다(`/scan` 응답의 `completedOrders:[receiptNo]`과 같은 모양 — Stage 7B
 * `cancelledOrders`처럼 객체 배열이 아니다).
 * `cancelledOrders` — 2026-09-12 백엔드 라이브 보고로 추가(정본 §8.3 문안에는 없었다).
 * force 종료로 미완성 슬롯이 취소되는 경로에서만 채워질 것으로 보여 옵셔널로 둔다 — 이번
 * 라이브 대조(정상 완주 배치)에서는 항상 빈 배열이었다.
 */
export interface RebinSimulateResponse {
  sessionId: number;
  scans: RebinSimulateScan[];
  completedOrders: string[];
  restocked: RebinRestockRow[];
  cancelledOrders?: ReallocationCancelledOrder[];
  elapsedMs: number;
}

/** `GET /packing/queue?lineId=` 행 — PACKING 상태 주문의 배송단위 토트 큐, `ordered_at` 순
 * (정본 §8.3). 포장 탭 "다음 토트" 버튼이 첫 행의 `toteCode` 를 스캔 입력에 채운다(브리프 §3). */
export interface PackingQueueItem {
  toteCode: string;
  receiptNo: string;
  shipmentSeq: number;
}



/* ── 10. ICQA — 순환 실사·조정 (Stage 10) ────────────────────────────────
   정본: backend/docs/02-system/02-data-model.md §10.2·§10.3, docs/tasks/
   2026-09-13-stage10-icqa-handoff.md §3. 라이브 대조(2026-09-13)로 실제 응답에 맞췄다 —
   정본 문안의 목록 필드 나열(§10.3 "목록 {countTaskId, locationCode, zoneCode, reason,
   status, worker, createdAt}")보다 실제 응답이 더 넓다(`outcome`·`movedDuringCount`·
   `sourceTaskId`·`recountTaskId`·`startedAt`·`completedAt`·`lines` 도 함께 옴) — 목록·시작·
   상세가 같은 레코드 모양을 공유하고 `lines`만 상황에 따라 `null`/블라인드(수량 `null`)/
   공개로 달라진다. */

export type CountTaskReason = "CYCLE_ROTATION" | "CYCLE_RECENT_ADJUST" | "PICK_DISCREPANCY" | "RECOUNT";
export type CountTaskStatus = "OPEN" | "COUNTING" | "DONE" | "RECOUNT_NEEDED" | "CANCELLED";
export type CountTaskOutcome = "ADJUSTED" | "CONFIRMED" | "RECOUNT_NEEDED";

/** 태스크 한 줄 — 목록·시작·상세가 공유하는 모양(라이브 대조로 확인). COUNTING 중 시작
 * 응답은 수량 넷(`expectedQty`~`adjustTxId`)이 `null`이다(블라인드, 정본 §10.1) */
export interface CountTaskLine {
  lineId: number;
  sellerCode: string;
  gtin: string;
  productName: string;
  lotNo: string;
  status: StockStatus;
  expectedQty: number | null;
  deltaQty: number | null;
  countedQty: number | null;
  diff: number | null;
  adjustTxId: number | null;
}

/**
 * 태스크 레코드 — `GET /count-tasks` 목록 행·`GET /count-tasks/{id}` 상세·
 * `POST .../start` 응답이 모두 같은 모양이다(라이브 대조로 확인, 정본 §10.3 문안보다 필드가
 * 많다). 목록 조회에서는 `lines`가 보통 `null`(정본 §10.3 목록 문안대로 가볍게), 시작
 * 직후엔 블라인드 라인 배열, 완료 후 상세 조회엔 공개된 라인 배열이다.
 */
export interface CountTaskRecord {
  countTaskId: number;
  locationCode: string;
  zoneCode: string;
  reason: CountTaskReason;
  status: CountTaskStatus;
  outcome: CountTaskOutcome | null;
  worker: string | null;
  movedDuringCount: boolean;
  sourceTaskId: number | null;
  recountTaskId: number | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  lines: CountTaskLine[] | null;
}

/** `GET /count-tasks` 목록 행 — `CountTaskRecord`와 같은 모양(라이브 대조) */
export type CountTaskListItem = CountTaskRecord;

/** `GET /count-tasks/{id}` 상세 — `CountTaskRecord`와 같은 모양(라이브 대조) */
export type CountTaskDetail = CountTaskRecord;

export interface CountTasksQuery {
  status?: CountTaskStatus;
  page?: number;
  size?: number;
}

export interface GenerateCountTasksRequest {
  days: number;
  topN: number;
}

/** `generate` 응답의 `created[]` — 라이브 대조로 확인(`zoneCode` 포함, 정본 §10.3 문안엔 없었다) */
export interface GenerateCountTaskCreated {
  countTaskId: number;
  locationCode: string;
  zoneCode: string;
  reason: CountTaskReason;
}

/** `generate` 응답의 `skipped[]` — 라이브 대조로 확인. 정본 §10.3 문안의 `skipped:[…]`와
 * 달리 `created`와 다른 모양이다 — 열린 태스크를 가리키는 `openCountTaskId`/`openStatus`를
 * 준다(태스크를 새로 안 만들었으니 자기 `countTaskId`는 없다) */
export interface GenerateCountTaskSkipped {
  locationCode: string;
  reason: CountTaskReason;
  openCountTaskId: number;
  openStatus: CountTaskStatus;
}

/** `generate` 응답 — `days`/`topN`을 그대로 돌려준다(라이브 대조로 확인, 정본 문안엔 없었다) */
export interface GenerateCountTasksResponse {
  days: number;
  topN: number;
  created: GenerateCountTaskCreated[];
  skipped: GenerateCountTaskSkipped[];
}

export interface StartCountTaskRequest {
  worker: string;
}

/** `POST .../start` 응답 — `CountTaskRecord`와 같은 모양, `lines`는 블라인드(수량 `null`) */
export type StartCountTaskResponse = CountTaskRecord;

export interface SubmitCountTaskLine {
  sellerCode: string;
  gtin: string;
  lotNo: string;
  status: StockStatus;
  countedQty: number;
}

export interface SubmitCountTaskRequest {
  lines: SubmitCountTaskLine[];
}

/** 제출 결과 한 줄 — `CountTaskLine`과 달리 수량이 항상 채워진다(라이브 대조로 확인) */
export interface SubmitCountTaskResultLine {
  lineId: number;
  sellerCode: string;
  gtin: string;
  productName: string;
  lotNo: string;
  status: StockStatus;
  expectedQty: number;
  deltaQty: number;
  countedQty: number;
  diff: number;
  adjustTxId: number | null;
}

/**
 * 제출 응답 — 라이브 대조(2026-09-13)로 확인. `countTaskId`/`locationCode`가 함께 오고
 * 목록·시작 레코드와 달리 `zoneCode`/`reason`/`status`/`worker`는 없는 더 좁은 모양이다.
 * `reallocated`/`cancelledOrders`는 이번 대조에서 항상 빈 배열이었다(재할당이 걸리는
 * 시나리오는 사용자 체크용 로케이션 몫이라 범위 밖) — 원소 모양은 Stage 7 재할당
 * (`ReallocationNewTask`)·취소(`ReallocationCancelledOrder`) 타입과 같다고 가정한 채로 둔다.
 */
export interface SubmitCountTaskResponse {
  countTaskId: number;
  locationCode: string;
  outcome: CountTaskOutcome;
  moved: boolean;
  lines: SubmitCountTaskResultLine[];
  recountTaskId: number | null;
  reallocated: ReallocationNewTask[];
  cancelledOrders: ReallocationCancelledOrder[];
}

export interface SimulateCountTaskOverride {
  gtin: string;
  lotNo: string;
  status: StockStatus;
  countedQty: number;
}

export interface SimulateCountTaskRequest {
  worker: string;
  overrides?: SimulateCountTaskOverride[];
}
