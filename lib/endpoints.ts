/**
 * 엔드포인트 정의 — docs/02-api-spec.md 의 번호와 1:1 대응.
 * 도메인 담당(P1 입고 / P2 출고 / P3 플랫폼)이 각자 구역만 손대면 된다.
 */
import { api } from "./api";
import type {
  AddReceiptItemRequest,
  AdjustInventoryRequest,
  AdjustInventoryResponse,
  ArriveAsnResponse,
  AsnDetail,
  AsnListItem,
  AsnQuery,
  AtpRow,
  BoxOverrideResponse,
  BoxType,
  CompleteReceiptResponse,
  CompleteResponse,
  ConfirmRequest,
  ConfirmResponse,
  CreateAsnRequest,
  CreateSellerRequest,
  DailyInventory,
  DashboardSummary,
  InvariantMismatch,
  LinesResponse,
  Location,
  LocationCapacity,
  LocationCapacityQuery,
  LocationsQuery,
  MeasurementResponse,
  OrderCancelResponse,
  OrderDetail,
  OrderListItem,
  OrdersImportRequest,
  OrdersImportResponse,
  OrdersQuery,
  Page,
  PendingReceiptItem,
  PickBatchDetail,
  PickBatchesResponse,
  PickBatchStatus,
  ProductImagesResponse,
  PutawayConfirmRequest,
  PutawayConfirmResponse,
  PutawayPendingItem,
  PutawayPendingQuery,
  PutawayRecommendRequest,
  PutawayRecommendResponse,
  ReceiptItemCreatedResponse,
  ScanResponse,
  Seller,
  ShipmentDetail,
  ShipmentListItem,
  ShipmentStatus,
  SimulateRequest,
  SimulateResponse,
  StockItem,
  StockLedgerEntry,
  StockOccupancyRow,
  StockQuery,
  UpdateSellerRequest,
  WaveCreateRequest,
  WaveCreateResponse,
  WaveDetail,
  WaveListItem,
  WaveTasksResponse,
  WavesQuery,
  Zone,
  ZoneSummary,
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

  /* Stage 2 T1 의 1-5 `stockIn`(`POST /inbound/stock-in`)은 Stage 3 에서 삭제됐다 — 재고 증가는
     `asn.addItem`(`POST /receipts/{id}/items`)으로 대체됐다(정본 §3.5). */

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

/* ── 재고 — 로트·현재고·원장 (Stage 2) ────────────────────────────────────
   정본: backend/docs/02-system/02-data-model.md §2.4, docs/tasks/
   2026-09-10-stage2-inventory-core-handoff.md §3. */
export const inventory = {
  /** 현재고 표 — 화주·GTIN·로케이션·로트·상태로 필터, 페이지 */
  stock: (params?: StockQuery) => api.get<Page<StockItem>>(`/stock${toStockQueryString(params)}`),

  /** 재고 한 건의 원장 — 행 클릭 시 아래 표 */
  stockLedger: (stockId: number, params?: { page?: number; size?: number }) =>
    api.get<Page<StockLedgerEntry>>(`/stock/${stockId}/ledger${toPageQueryString(params)}`),

  /** BIN 전체 점유 — 3D·2D 지도 인스턴스 매핑용 (3,888행) */
  occupancy: () => api.get<StockOccupancyRow[]>("/stock/occupancy"),

  /** 존별 현재고 합계 — 흐름·규격별 재고 패널 */
  zonesSummary: () => api.get<ZoneSummary[]>("/zones/summary"),

  /** 일별 입출고·현재고·점유율 — 기간 상한 92일 */
  daily: (from: string, to: string) =>
    api.get<DailyInventory[]>(`/inventory/daily?from=${from}&to=${to}`),

  /** 불변식 검사 — 빈 배열이 정상 */
  invariant: () => api.get<InvariantMismatch[]>("/admin/inventory/invariant"),

  /** 재고 조정 — 화면 체크·ICQA 전 임시 창구 */
  adjust: (body: AdjustInventoryRequest) =>
    api.post<AdjustInventoryResponse>("/admin/inventory/adjust", body),
};

/* ── 입고 — ASN·수령·검수 (Stage 3) ──────────────────────────────────────
   정본: backend/docs/02-system/02-data-model.md §3.5, docs/tasks/
   2026-09-11-stage3-inbound-asn-handoff.md §3. 응답 타입은 라이브 검증(2026-09-11)으로
   실제 백엔드 레코드(AsnController/ReceiptController)에 맞췄다. */
export const asn = {
  /** ASN 목록 — 상태 필터 탭 */
  list: (params?: AsnQuery) => api.get<Page<AsnListItem>>(`/asns${toAsnQueryString(params)}`),

  /** ASN 등록 — GTIN 이 product 에 없으면 마스터에서 생성, 마스터에도 없으면 400. 등록 상세를 바로 돌려준다 */
  create: (body: CreateAsnRequest) => api.post<AsnDetail>("/asns", body),

  /** ASN 상세 — 품목별 예정·수령 누계·파손 누계·미달, receipt 목록 */
  get: (id: number) => api.get<AsnDetail>(`/asns/${id}`),

  /** 도착 처리 — ARRIVED(첫 도착) 또는 RECEIVING(재도착), receipt OPEN 생성 */
  arrive: (id: number) => api.post<ArriveAsnResponse>(`/asns/${id}/arrive`),

  /** 이 receipt 에서 아직 검수 입력 안 된 ASN 품목 — 입고 화면의 미검수 품목 목록. 응답은 배열이다 */
  pendingItems: (receiptId: number) =>
    api.get<PendingReceiptItem[]>(`/receipts/${receiptId}/pending-items`),

  /** 검수 입력 — receipt_item + RECEIVE tx. ASN 에 없는 GTIN 은 409 ASN_ITEM_NOT_FOUND */
  addItem: (receiptId: number, body: AddReceiptItemRequest) =>
    api.post<ReceiptItemCreatedResponse>(`/receipts/${receiptId}/items`, body),

  /** receipt 완료 — ASN 상태 판정(CLOSED / PARTIALLY_RECEIVED)까지 끝난 상세를 함께 준다 */
  completeReceipt: (receiptId: number) =>
    api.post<CompleteReceiptResponse>(`/receipts/${receiptId}/complete`),

  /** 수동 마감 — PARTIALLY_RECEIVED → CLOSED, 미달 품목 SHORT 기록. ASN 상세를 돌려준다 */
  close: (id: number) => api.post<AsnDetail>(`/asns/${id}/close`),
};

/* ── 진열 — directed putaway (Stage 4) ──────────────────────────────────
   정본: backend/docs/02-system/02-data-model.md §4.5, docs/tasks/
   2026-09-11-stage4-putaway-handoff.md §3. */
export const putaway = {
  /** 진열 대기 — 입고장 AVAILABLE 재고, 화주 필터 */
  pending: (params?: PutawayPendingQuery) =>
    api.get<Page<PutawayPendingItem>>(`/putaway/pending${toPutawayPendingQueryString(params)}`),

  /** 추천 — `qty` 생략 시 전량. 상한 5칸 + `unplacedQty` */
  recommend: (body: PutawayRecommendRequest) =>
    api.post<PutawayRecommendResponse>("/putaway/recommend", body),

  /** 확정 — 잠금 아래 재검증 후 이동. 실패는 전체 롤백 + 409 `PUTAWAY_REJECTED` */
  confirm: (body: PutawayConfirmRequest) =>
    api.post<PutawayConfirmResponse>("/putaway/confirm", body),

  /**
   * 칸 하나의 부피·적재율·현재 항목 — "다른 칸" 입력의 확인용.
   * `stockId`/`qty` 를 같이 주면 응답에 `acceptable`/`rejectReason`/`maxQty` 가 함께 온다
   * (2026-09-11 백엔드 라이브 보고 — 정본 §4.5 에 없던 추가. 화면이 혼적·온도·규격 규칙을
   * 직접 베끼지 않고 서버 판정을 그대로 보여줄 수 있다).
   */
  capacity: (locationCode: string, params?: LocationCapacityQuery) =>
    api.get<LocationCapacity>(
      `/locations/${encodeURIComponent(locationCode)}/capacity${toLocationCapacityQueryString(params)}`,
    ),
};

/* ── 주문·soft 할당 (Stage 5) ────────────────────────────────────────────
   정본: backend/docs/02-system/02-data-model.md §5.7, docs/tasks/
   2026-09-11-stage5-orders-allocation-handoff.md §3 S5.4. */
export const orders = {
  /** 주문 목록 — 화주·상태 필터, 페이지 */
  list: (params?: OrdersQuery) => api.get<Page<OrderListItem>>(`/orders${toOrdersQueryString(params)}`),

  /** 주문 상세 — 품목·할당(stage/status/수량)·배송단위 */
  get: (id: number) => api.get<OrderDetail>(`/orders/${id}`),

  /** 취소 — `RECEIVED`·`ALLOCATED` 에서만. 그 밖은 409 `INVALID_STATE`(정본 §5.5) */
  cancel: (id: number) => api.post<OrderCancelResponse>(`/orders/${id}/cancel`),

  /** 접수 — 기존 `POST /admin/orders/import` 유지 + 주문별 `cutoffAt?`(정본 §5.7) */
  import: (body: OrdersImportRequest) => api.post<OrdersImportResponse>("/admin/orders/import", body),
};

/* ── 웨이브·hard 할당·피킹 배치 (Stage 6) ───────────────────────────────────
   정본: backend/docs/02-system/02-data-model.md §6.5, docs/tasks/
   2026-09-11-stage6-wave-hard-handoff.md §3. 백엔드가 이 화면과 동시에 만들어지는 중이라 —
   계약대로 먼저 붙이고 라이브 검증은 완료 보고에서 남긴다. */
export const waves = {
  /** 웨이브 생성 — ALLOCATED 주문을 마감시각으로 묶어 hard 할당·배치 편성까지 한 번에(정본 §6.4) */
  create: (body: WaveCreateRequest) => api.post<WaveCreateResponse>("/waves", body),

  /** 웨이브 목록 — 상태·페이지 */
  list: (params?: WavesQuery) => api.get<Page<WaveListItem>>(`/waves${toWavesQueryString(params)}`),

  /** 웨이브 상세 — 주문 목록·배치 목록·skipped */
  get: (id: number) => api.get<WaveDetail>(`/waves/${id}`),

  /** 배치별 피킹 지시 전체 — 계약에는 있으나 이 화면은 배치 클릭마다 `pickBatches.get` 을
   * 쓴다(더 직접적인 대응이라, outbound.load 와 같은 관례로 래퍼만 둔다) */
  tasks: (id: number) => api.get<WaveTasksResponse>(`/waves/${id}/tasks`),
};

export const pickBatches = {
  /** 배치 상세 — 순서·칸·상품·로트·유통기한·수량 태스크 표(정본 §6.5, Stage 7 claim 의 기초) */
  get: (id: number) => api.get<PickBatchDetail>(`/pick-batches/${id}`),
};

/* ── 피킹 배치·작업자 시뮬레이터 (Stage 7B) ──────────────────────────────────
   정본: backend/docs/02-system/02-data-model.md §7.3·§7.5, docs/tasks/
   2026-09-12-stage7b-simulator-handoff.md §3 S7.6. 피킹 화면(PDA)은 두지 않는다 —
   claim→pick→complete 는 서버 안의 작업자 시뮬레이터가 대신 호출한다(웨이브 탭 "자동 처리"). */
export const picking = {
  /** 받을 수 있는 배치 목록 — 웨이브 순·seq 순(정본 §7.3). status 생략 시 전체 */
  batches: (status?: PickBatchStatus) =>
    api.get<PickBatchesResponse>(`/pick-batches${status ? `?status=${status}` : ""}`),

  /** 배치 상세 — `pickBatches.get` 과 같은 엔드포인트(Stage 7 필드 포함) */
  batch: (id: number) => pickBatches.get(id),

  /** 작업자 시뮬레이터 — OPEN 배치만 대상. claim→pick→complete 를 실제 작업자와 같은
   * 서비스로 단계별 트랜잭션 호출한다(정본 §7.5). OPEN 이 아니면 409 `INVALID_STATE`,
   * 남이 먼저 claim 했으면 409 `ALREADY_CLAIMED`. */
  simulate: (id: number, body: SimulateRequest) =>
    api.post<SimulateResponse>(`/admin/pick-batches/${id}/simulate`, body),
};

function toWavesQueryString(params?: WavesQuery): string {
  if (!params) return "";
  const qs = new URLSearchParams();
  if (params.status !== undefined) qs.set("status", params.status);
  if (params.page !== undefined) qs.set("page", String(params.page));
  if (params.size !== undefined) qs.set("size", String(params.size));
  const suffix = qs.toString();
  return suffix ? `?${suffix}` : "";
}

/** 화주 가용재고·금지선 — `master.sellers()`(목록·등록)와는 다른 API 라 별도 묶음으로 둔다 */
export const sellers = {
  /** 화주 전 SKU 가용재고 표 — 가용재고 탭(정본 §5.7 `GET .../atp?page`) */
  atp: (code: string, params?: { page?: number; size?: number }) =>
    api.get<Page<AtpRow>>(`/sellers/${encodeURIComponent(code)}/atp${toPageQueryString(params)}`),

  /** 금지선 일수 변경 — `PATCH /sellers/{code}`(정본 §5.1) */
  update: (code: string, body: UpdateSellerRequest) =>
    api.patch<Seller>(`/sellers/${encodeURIComponent(code)}`, body),
};

function toOrdersQueryString(params?: OrdersQuery): string {
  if (!params) return "";
  const qs = new URLSearchParams();
  if (params.seller !== undefined && params.seller !== "") qs.set("seller", params.seller);
  if (params.status !== undefined) qs.set("status", params.status);
  if (params.page !== undefined) qs.set("page", String(params.page));
  if (params.size !== undefined) qs.set("size", String(params.size));
  const suffix = qs.toString();
  return suffix ? `?${suffix}` : "";
}

function toLocationCapacityQueryString(params?: LocationCapacityQuery): string {
  if (!params) return "";
  const qs = new URLSearchParams();
  if (params.stockId !== undefined) qs.set("stockId", String(params.stockId));
  if (params.qty !== undefined) qs.set("qty", String(params.qty));
  const suffix = qs.toString();
  return suffix ? `?${suffix}` : "";
}

function toPutawayPendingQueryString(params?: PutawayPendingQuery): string {
  if (!params) return "";
  const qs = new URLSearchParams();
  if (params.seller !== undefined && params.seller !== "") qs.set("seller", params.seller);
  if (params.page !== undefined) qs.set("page", String(params.page));
  if (params.size !== undefined) qs.set("size", String(params.size));
  const suffix = qs.toString();
  return suffix ? `?${suffix}` : "";
}

function toAsnQueryString(params?: AsnQuery): string {
  if (!params) return "";
  const qs = new URLSearchParams();
  if (params.seller !== undefined && params.seller !== "") qs.set("seller", params.seller);
  if (params.status !== undefined) qs.set("status", params.status);
  if (params.page !== undefined) qs.set("page", String(params.page));
  if (params.size !== undefined) qs.set("size", String(params.size));
  const suffix = qs.toString();
  return suffix ? `?${suffix}` : "";
}

function toStockQueryString(params?: StockQuery): string {
  if (!params) return "";
  const qs = new URLSearchParams();
  if (params.seller !== undefined && params.seller !== "") qs.set("seller", params.seller);
  if (params.gtin !== undefined && params.gtin !== "") qs.set("gtin", params.gtin);
  if (params.location !== undefined && params.location !== "") qs.set("location", params.location);
  if (params.lot !== undefined && params.lot !== "") qs.set("lot", params.lot);
  if (params.status !== undefined) qs.set("status", params.status);
  if (params.page !== undefined) qs.set("page", String(params.page));
  if (params.size !== undefined) qs.set("size", String(params.size));
  const suffix = qs.toString();
  return suffix ? `?${suffix}` : "";
}

function toPageQueryString(params?: { page?: number; size?: number }): string {
  if (!params) return "";
  const qs = new URLSearchParams();
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
  stock: (params?: StockQuery) => ["stock", params ?? {}] as const,
  stockLedger: (stockId: number, params?: { page?: number; size?: number }) =>
    ["stock", stockId, "ledger", params ?? {}] as const,
  occupancy: ["stock", "occupancy"] as const,
  zonesSummary: ["zones", "summary"] as const,
  dailyInventory: (from: string, to: string) => ["inventory", "daily", from, to] as const,
  invariant: ["admin", "inventory", "invariant"] as const,
  asns: (params?: AsnQuery) => ["asns", params ?? {}] as const,
  asn: (id: number) => ["asns", id] as const,
  pendingItems: (receiptId: number) => ["receipts", receiptId, "pending-items"] as const,
  putawayPending: (params?: PutawayPendingQuery) => ["putaway", "pending", params ?? {}] as const,
  locationCapacity: (code: string) => ["locations", code, "capacity"] as const,
  orders: (params?: OrdersQuery) => ["orders", params ?? {}] as const,
  order: (id: number) => ["orders", id] as const,
  sellerAtp: (code: string, params?: { page?: number; size?: number }) =>
    ["sellers", code, "atp", params ?? {}] as const,
  waves: (params?: WavesQuery) => ["waves", params ?? {}] as const,
  wave: (id: number) => ["waves", id] as const,
  pickBatch: (id: number) => ["pick-batches", id] as const,
  pickBatchesList: (status?: PickBatchStatus) => ["pick-batches", "list", status ?? "ALL"] as const,
};
