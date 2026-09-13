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
  BayBinsResponse,
  BoxOverrideResponse,
  BoxType,
  CenterSummary,
  CompleteReceiptResponse,
  CompleteResponse,
  ConfirmRequest,
  ConfirmResponse,
  CountTaskDetail,
  CountTaskListItem,
  CountTasksQuery,
  CreateAsnRequest,
  CreateSellerRequest,
  CreateTransferRequest,
  DailyInventory,
  DamageReportRequest,
  DamageReportResponse,
  DashboardSummary,
  GenerateCountTasksRequest,
  GenerateCountTasksResponse,
  GlobalAtpQuery,
  GlobalAtpRow,
  HubOrderListItem,
  HubOrdersQuery,
  InvariantCheckResult,
  ItemScanRequest,
  ItemScanResponse,
  LayoutResponse,
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
  PackingQueueItem,
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
  RebinSessionDetail,
  RebinSimulateRequest,
  RebinSimulateResponse,
  RoutingDecision,
  ScanResponse,
  Seller,
  ShipmentDetail,
  ShipmentListItem,
  ShipmentStatus,
  SimulateCountTaskRequest,
  SimulateRequest,
  SimulateResponse,
  StartCountTaskRequest,
  StartCountTaskResponse,
  StockItem,
  StockLedgerEntry,
  StockOccupancyRow,
  StockQuery,
  SubmitCountTaskRequest,
  SubmitCountTaskResponse,
  TransferOrder,
  TransfersQuery,
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

  /** 존 목록 — Stage 11(11.0)부터 `Area→Zone→Aisle→Bay` 계층의 매체 구획. 3D·2D
   * 레이아웃은 이 목록 대신 `layout()` 을 쓴다 — 이건 로케이션 탭 1단과 재고 탭 존
   * 표시가 계속 읽는다.
   * Stage 11D — `center` 를 붙이면 그 센터 존만 온다(정본 §12.6 `GET /zones?center=`).
   * 없으면 서버 기본값 `C1`(전환기 규칙, 정본 §12.6 "센터 축 조회 API 전부"). */
  zones: (center?: string) => api.get<Zone[]>(`/zones${center ? `?center=${center}` : ""}`),

  /**
   * 3D·2D 가 그리는 전체 레이아웃(정본 §11.0 "3D·2D 계약") — `{areas, zones, aisles,
   * bays}`. 베이 약 800~1,000행, 칸(Position)은 포함하지 않는다. 백엔드가 Stage 11을
   * 같은 시각에 만드는 중이라(브리프 머리말) 2026-09-13 시점엔 엔드포인트가 없을 수
   * 있다 — 호출부(`app/analytics/_data/use-layout.ts`)가 실패하면 `lib/mocks/layout.ts`
   * 표본으로 대신 그린다. 라이브 검증 대기.
   *
   * Stage 11D — `center` 를 붙이면 그 센터 평면만 온다(정본 §12.6 `GET /layout?center=`,
   * §12.8 "3D는 그 센터 평면만"). 없으면 서버 기본값 `C1`. */
  layout: (center?: string) => api.get<LayoutResponse>(`/layout${center ? `?center=${center}` : ""}`),

  /** 베이 하나의 칸 — 베이 클릭 시에만(≤ 20개). 위 `layout()` 과 같은 계약, 같은 대기 */
  bayBins: (bayId: number) => api.get<BayBinsResponse>(`/bays/${bayId}/bins`),

  /** 로케이션 목록 — zone·type 전부 선택, Spring Page 로 온다. `aisleId`·`bayId` 는
   * Stage 11(브리프 §3 S11.4)이 백엔드에 요청한 필터라 아직 없을 수 있다 — 로케이션
   * 탭은 이 값에 기대지 않고 응답을 코드 접두로 한 번 더 거른다(노트 참고) */
  locations: (params?: LocationsQuery) =>
    api.get<Page<Location>>(`/locations${toQueryString(params)}`),

  /** 로케이션 단건 — 없으면 404 */
  location: (code: string) => api.get<Location>(`/locations/${code}`),
};

function toQueryString(params?: LocationsQuery): string {
  if (!params) return "";
  const qs = new URLSearchParams();
  if (params.zone !== undefined) qs.set("zone", params.zone);
  if (params.aisle !== undefined) qs.set("aisle", String(params.aisle));
  if (params.aisleId !== undefined) qs.set("aisleId", String(params.aisleId));
  if (params.bayId !== undefined) qs.set("bayId", String(params.bayId));
  if (params.type !== undefined) qs.set("type", params.type);
  if (params.page !== undefined) qs.set("page", String(params.page));
  if (params.size !== undefined) qs.set("size", String(params.size));
  // Stage 11D — center 없으면 서버 기본값 C1(코디네이터 지시, 2026-09-13)
  if (params.center !== undefined) qs.set("center", params.center);
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

  /** 불변식 검사 — 두 불변식을 객체로 받는다(Stage 8, §7.9 결정). 둘 다 빈 배열이 정상.
   * Stage 11D — `center` 없으면 전체 + 센터별 내역(정본 §12.6 `GET /admin/inventory/
   * invariant?center=`). 이 화면에서는 아직 호출부가 없다(래퍼만 둔다). */
  invariant: (center?: string) =>
    api.get<InvariantCheckResult>(`/admin/inventory/invariant${center ? `?center=${center}` : ""}`),

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

/* ── 리빈 — put wall (Stage 8) ────────────────────────────────────────────
   정본: backend/docs/02-system/02-data-model.md §8.3·§8.4, docs/tasks/
   2026-09-12-stage8-rebin-handoff.md §3 S8.3. 작업자 화면 없음(§8.1) — 시뮬레이터가 세션을
   처리하고 웨이브 탭이 관전한다. */
export const rebin = {
  /** 배치의 세션 조회 — 없으면 404. 웨이브 탭이 이 404 를 "리빈 자동 처리" 버튼을 보여줄
   * 신호로 쓴다(정본 §8.4) */
  sessionByBatch: (pickBatchId: number) =>
    api.get<RebinSessionDetail>(`/rebin/sessions?pickBatchId=${pickBatchId}`),

  /** 세션 단건 — 계약(정본 §8.3)에 있는 API 라 래퍼만 둔다. 지금 화면은 `sessionByBatch` 만 쓴다 */
  session: (id: number) => api.get<RebinSessionDetail>(`/rebin/sessions/${id}`),

  /** 리빈 자동 처리 — 세션 시작→scan→finish 를 서버가 대신 한다(§8.1 "작업자 화면은 없다") */
  simulate: (body: RebinSimulateRequest) =>
    api.post<RebinSimulateResponse>("/admin/rebin/simulate", body),
};

/* ── 포장 큐 (Stage 8) ────────────────────────────────────────────────────
   정본 §8.3·§8.4. 리빈으로 완성된 주문의 배송단위 토트 큐 — 포장 탭 "다음 토트" 버튼이 쓴다. */
export const packing = {
  queue: (lineId: number) => api.get<PackingQueueItem[]>(`/packing/queue?lineId=${lineId}`),

  /** 낱개 스캔 대조(Stage 9, 정본 §9.3) — 토트 안 물건을 GTIN 으로 하나씩 스캔한다.
   * 품목에 없음 409 NOT_IN_SHIPMENT / 토트 할당에 없음 409 NOT_IN_TOTE / 초과 409 OVER_SCAN */
  scan: (shipmentId: number, body: ItemScanRequest) =>
    api.post<ItemScanResponse>(`/shipments/${shipmentId}/scan`, body),

  /** 재스캔 — verified_qty 전부 0(정본 §9.3). 갱신된 값은 배송단위 상세를 다시 불러와 읽는다 */
  rescan: (shipmentId: number) => api.del<unknown>(`/shipments/${shipmentId}/scans`),

  /** 파손 신고(정본 §9.3) — 보충 hard 성공이면 REPLENISH 배치, 칸에 없으면 주문 취소 */
  damage: (shipmentId: number, body: DamageReportRequest) =>
    api.post<DamageReportResponse>(`/shipments/${shipmentId}/damage`, body),
};

/* ── ICQA — 순환 실사·조정 (Stage 10) ────────────────────────────────────
   정본: backend/docs/02-system/02-data-model.md §10.3, docs/tasks/
   2026-09-13-stage10-icqa-handoff.md §3. 작업자 화면은 분석 화면의 탭이다(정본 §10.1
   "사람이 입력하는 화면 — 포장과 같은 예외"). 대량 처리용 시뮬레이터(`simulate`)는
   조율 전용이라 이 탭은 부르지 않는다. */
export const icqa = {
  /** 실사 생성 — 회전 상위·최근 조정 로케이션에 OPEN 태스크. 열린 태스크 있으면 건너뜀 */
  generate: (body: GenerateCountTasksRequest) =>
    api.post<GenerateCountTasksResponse>("/admin/count-tasks/generate", body),

  /** 목록 — 상태 필터, 페이지 */
  list: (params?: CountTasksQuery) => api.get<Page<CountTaskListItem>>(`/count-tasks${toCountTasksQueryString(params)}`),

  /** 상세 — COUNTING 중엔 수량 숨김 */
  detail: (id: number) => api.get<CountTaskDetail>(`/count-tasks/${id}`),

  /** 시작 — OPEN → COUNTING, 블라인드 라인(수량 없음) */
  start: (id: number, body: StartCountTaskRequest) =>
    api.post<StartCountTaskResponse>(`/count-tasks/${id}/start`, body),

  /** 제출 — 델타·조정·재할당·취소까지 한 번에 */
  submit: (id: number, body: SubmitCountTaskRequest) =>
    api.post<SubmitCountTaskResponse>(`/count-tasks/${id}/submit`, body),

  /** 시뮬레이터 — 조율만(화면에서 쓰지 않음, 래퍼만 둔다) */
  simulate: (id: number, body: SimulateCountTaskRequest) =>
    api.post<SubmitCountTaskResponse>(`/admin/count-tasks/${id}/simulate`, body),
};

function toCountTasksQueryString(params?: CountTasksQuery): string {
  if (!params) return "";
  const qs = new URLSearchParams();
  if (params.status !== undefined) qs.set("status", params.status);
  if (params.page !== undefined) qs.set("page", String(params.page));
  if (params.size !== undefined) qs.set("size", String(params.size));
  // Stage 11D — 정본 §12.6 `GET /count-tasks?center=`. 없으면 서버 기본값 `C1`
  if (params.center !== undefined) qs.set("center", params.center);
  const suffix = qs.toString();
  return suffix ? `?${suffix}` : "";
}

function toWavesQueryString(params?: WavesQuery): string {
  if (!params) return "";
  const qs = new URLSearchParams();
  if (params.status !== undefined) qs.set("status", params.status);
  if (params.page !== undefined) qs.set("page", String(params.page));
  if (params.size !== undefined) qs.set("size", String(params.size));
  // Stage 11D — 정본 §12.6 `GET /waves?center=`. 없으면 서버 기본값 `C1`
  if (params.center !== undefined) qs.set("center", params.center);
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
  // Stage 11D — 정본 §12.6 `GET /orders?center=`. 없으면 서버 기본값 `C1`
  if (params.center !== undefined) qs.set("center", params.center);
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
  // Stage 11D — 정본 §12.6 `GET /stock…?center=`. 없으면 서버 기본값 `C1`
  if (params.center !== undefined) qs.set("center", params.center);
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
  // Stage 11D — `center` 가 키에 들어간다(정본 §12.8 "모든 훅·쿼리 키에 center 포함").
  // 센터를 바꾸면 다른 캐시 항목이 되어 자동으로 다시 조회된다.
  zones: (center: string) => ["zones", center] as const,
  layout: (center: string) => ["layout", center] as const,
  bayBins: (bayId: number) => ["bays", bayId, "bins"] as const,
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
  rebinSessionByBatch: (pickBatchId: number) => ["rebin", "session-by-batch", pickBatchId] as const,
  packingQueue: (lineId: number) => ["packing", "queue", lineId] as const,
  countTasks: (params?: CountTasksQuery) => ["count-tasks", params ?? {}] as const,
  countTask: (id: number) => ["count-tasks", id] as const,
  // Stage 11D — 허브 창(정본 §12.6·§12.8)
  hubCenters: ["hub", "centers"] as const,
  hubOrders: (params?: HubOrdersQuery) => ["hub", "orders", params ?? {}] as const,
  hubOrderRouting: (orderId: number) => ["hub", "orders", orderId, "routing"] as const,
  hubTransfers: (params?: TransfersQuery) => ["hub", "transfers", params ?? {}] as const,
  hubTransfer: (id: number) => ["hub", "transfers", id] as const,
  hubAtp: (params: GlobalAtpQuery) => ["hub", "atp", params] as const,
};

/* ── 다창고 — 센터 축·주문 라우팅·센터 간 이동 (Stage 11D) ──────────────────────
   정본: backend/docs/02-system/02-data-model.md §12.6. 백엔드는 `feat/stage11d-
   multicenter`에서 같은 시각 작업 중이라(브리프 머리말) 2026-09-13 시점엔 이 5개
   엔드포인트가 없을 수 있다 — 호출부(`app/hub/_data/use-hub.ts`)가 실패하면
   `lib/mocks/hub.ts` 표본으로 대신 그린다. 라이브 검증 대기. */
export const hub = {
  /** 센터 3곳 + 센터별 칸·현재고·OPEN 주문 수 — 셸 상단 센터 선택도 이 목록을 쓴다 */
  centers: () => api.get<CenterSummary[]>("/hub/centers"),

  /** 주문 목록 — 센터·라우팅 규칙 열 */
  orders: (params?: HubOrdersQuery) =>
    api.get<Page<HubOrderListItem>>(`/hub/orders${toHubOrdersQueryString(params)}`),

  /** 라우팅 상세 — `routing_decision` + 후보 센터별 라인 ATP. 행 클릭 시 조회 */
  orderRouting: (orderId: number) => api.get<RoutingDecision>(`/hub/orders/${orderId}/routing`),

  /** 이동 오더 목록 — 라이브 대조: 목록도 상세와 같은 모양(`items` 배열 포함)으로 온다 */
  transfers: (params?: TransfersQuery) =>
    api.get<Page<TransferOrder>>(`/hub/transfers${toTransfersQueryString(params)}`),

  /** 이동 오더 상세 — shipped/received 진행 */
  transfer: (id: number) => api.get<TransferOrder>(`/hub/transfers/${id}`),

  /** 이동 생성 — 출발 센터 ATP 부족이면 409 `INSUFFICIENT_ATP`(정본 §12.5 ①) */
  createTransfer: (body: CreateTransferRequest) => api.post<TransferOrder>("/hub/transfers", body),

  /** 출발 — FEFO 확정, 도착 센터 ASN 자동 생성(정본 §12.5 ②). 409 `INSUFFICIENT_ATP` */
  dispatchTransfer: (id: number) => api.post<TransferOrder>(`/hub/transfers/${id}/dispatch`),

  /** 글로벌 ATP 표 — 화주 선택 필수, gtin 은 검색 보조. 라이브 대조: Page 로 온다 */
  atp: (params: GlobalAtpQuery) => api.get<Page<GlobalAtpRow>>(`/hub/atp${toGlobalAtpQueryString(params)}`),
};

function toHubOrdersQueryString(params?: HubOrdersQuery): string {
  if (!params) return "";
  const qs = new URLSearchParams();
  if (params.center !== undefined) qs.set("center", params.center);
  if (params.status !== undefined) qs.set("status", params.status);
  if (params.page !== undefined) qs.set("page", String(params.page));
  if (params.size !== undefined) qs.set("size", String(params.size));
  const suffix = qs.toString();
  return suffix ? `?${suffix}` : "";
}

function toTransfersQueryString(params?: TransfersQuery): string {
  if (!params) return "";
  const qs = new URLSearchParams();
  if (params.status !== undefined) qs.set("status", params.status);
  if (params.page !== undefined) qs.set("page", String(params.page));
  if (params.size !== undefined) qs.set("size", String(params.size));
  const suffix = qs.toString();
  return suffix ? `?${suffix}` : "";
}

function toGlobalAtpQueryString(params: GlobalAtpQuery): string {
  const qs = new URLSearchParams();
  qs.set("seller", params.seller);
  if (params.gtin !== undefined && params.gtin !== "") qs.set("gtin", params.gtin);
  const suffix = qs.toString();
  return suffix ? `?${suffix}` : "";
}
