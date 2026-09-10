/**
 * 입고 등록 화면 mock 데이터 — 백엔드가 준비되기 전까지 화면을 굴리기 위한 것.
 *
 * ⚠️ 이 폴더의 값은 전부 "가짜"다. 실제 호출은 `@/lib/endpoints` 의 `inbound` 를 쓰고,
 *    교체 지점은 `app/inbound-v3/_data/use-inbound.ts` 한 곳뿐이다.
 *
 * 규칙 (app/packing/_mock/shipment.ts 와 동일)
 * - 모든 mock 은 `@/lib/types` 의 계약 타입으로 타입 표기한다.
 *   → docs/02-api-spec.md 가 바뀌어 타입이 달라지면 여기서 **컴파일 에러**가 난다.
 *     mock 이 계약에서 조용히 벗어나는 것을 막는 장치다.
 * - 값 자체는 docs/02-api-spec.md §1-1 ~ §1-6 의 JSON 예시를 옮겼고,
 *   분기를 눈으로 확인하려고 몇 건을 덧붙였다(아래 표 참고).
 *
 * ── 시나리오 표 (P1 이 화면을 열고 확인할 수 있는 경로) ──────────────────
 *   바코드              1-1 판정      1-3 측정 결과              확인 목적
 *   8801234567893      REGISTERED   INFERRED · 게이트 통과      치수 O → 바로 수량 입고
 *   8801234500029      NEW          INFERRED · 게이트 통과      정상 촬영 흐름 (샘플 값)
 *   8801234500036      NEW          INFERRED · 게이트 미통과    DB 입력 잠금 + 사유 표시
 *   8801234500043      NEW          MEASURE_FAILED             수동 입력 모달 자동 오픈
 *   그 외               UNKNOWN      —                          "코리안넷 마스터에 없는
 *                                                              상품" 안내 후 종료 (D-21)
 *
 * ⚠️ 끝자리가 바뀌었다 (…890/022/033/044 → …893/029/036/043).
 *    EAN-13 의 13번째 자리는 장식이 아니라 **앞 12자리로 계산되는 체크디짓**이다.
 *    옛 값은 그 규칙을 안 지켜서, 우상단 바코드 그래픽이 네 시나리오 모두 "체크디짓 불일치"로
 *    흐리게 렌더됐다(`_components/ean-13-barcode.tsx`). 22/33/44 니모닉을 잃는 대신
 *    실제로 스캔 가능한 번호가 됐다.
 *    ⚠️ **docs D-17 의 시연 상품 GTIN(8801234500011~66)과 백엔드 `V2__seed.sql` 은 아직 옛
 *       값이다.** 실제 API 로 배선할 때 양쪽을 맞춰야 한다 — 안 맞추면 mock 에서 되던 스캔이
 *       실서버에서 UNKNOWN 으로 떨어진다.
 */
import type {
  ConfirmResponse,
  MeasurementFailed,
  MeasurementInferred,
  MeasurementResponse,
  Product,
  ProductImagesResponse,
  ScanResponse,
  StockInResponse,
} from "@/lib/types";

/* ── 1-1 바코드 스캔 ─────────────────────────────────────── */

/**
 * 마스터에 있는 상품들. 첫 건(41)은 docs/02-api-spec.md §1-1 응답 예시 그대로다.
 *
 * `imageUrl` 은 전부 null 로 뒀다 — 저장소에 실제 이미지 파일이 없고, 외부 URL 을 쓰면
 * 네트워크·CSP 의존이 생긴다. 화면은 null 을 "마스터 이미지 없음"으로 그린다.
 */
const MOCK_PRODUCTS: Product[] = [
  {
    productId: 41,
    gtin: "8801234567893",
    name: "○○ 오렌지주스 500ml",
    categoryL: "음료",
    categoryM: "과채주스",
    imageUrl: null,
    dimStatus: "CONFIRMED", // 치수 O → 1-1 판정이 REGISTERED
    stockQty: 120,
  },
  {
    productId: 55,
    gtin: "8801234500029",
    name: "△△ 머그컵 350ml",
    categoryL: "생활용품",
    categoryM: "주방용품",
    imageUrl: null,
    dimStatus: "NONE", // 치수 X → NEW
    stockQty: 0,
  },
  {
    productId: 56,
    gtin: "8801234500036",
    name: "□□ 즉석밥 210g 3입",
    categoryL: "가공식품",
    categoryM: "즉석밥",
    imageUrl: null,
    dimStatus: "NONE",
    stockQty: 12,
  },
  {
    productId: 57,
    gtin: "8801234500043",
    name: "◇◇ 생수 2L 6입",
    categoryL: "음료",
    categoryM: "생수",
    imageUrl: null,
    dimStatus: "NONE",
    stockQty: 0,
  },
];

/**
 * 1-1 `POST /inbound/scans` 응답 mock — 바코드로 찾는다.
 *
 * 판정 규칙은 계약 그대로다 (docs/02-api-spec.md §1-1).
 *   마스터 O + 치수 O → REGISTERED
 *   마스터 O + 치수 X → NEW      (서버가 이 시점에 product 를 upsert 한다)
 *   마스터 X          → UNKNOWN  (`product: null`)
 * 여기 없는 바코드는 UNKNOWN 이 나온다 — `runScan` 이 그렇게 처리한다.
 */
export const MOCK_SCAN_BY_BARCODE: Record<string, ScanResponse | undefined> =
  Object.fromEntries(
    MOCK_PRODUCTS.map((product) => [
      product.gtin,
      {
        judgment: product.dimStatus === "CONFIRMED" ? "REGISTERED" : "NEW",
        product,
      } satisfies ScanResponse,
    ]),
  );

/** 미등록 바코드용 응답 — 계약상 `product` 는 null 이다 */
export const MOCK_SCAN_UNKNOWN: ScanResponse = {
  judgment: "UNKNOWN",
  product: null,
};

/* ── 1-3 촬영·추론 ───────────────────────────────────────── */

/**
 * 촬영 이미지 3장(카메라 3대) — docs/02-api-spec.md §1-3 의 `images`.
 *
 * ⚠️ **실제 이미지 파일은 저장소에 없다.** 아래 url 은 존재하지 않는 로컬 경로다.
 *    그래서 `_components/product-photo-panel.tsx` 는 img 를 걸지 않고 회색 자리표시만
 *    그린다(외부 URL 금지 — 네트워크·CSP 의존을 만들지 않기 위해).
 */
function mockImages(sessionId: number): MeasurementInferred["images"] {
  return [
    { cameraNo: 1, url: `/mock/measurements/${sessionId}-1.jpg` },
    { cameraNo: 2, url: `/mock/measurements/${sessionId}-2.jpg` },
    { cameraNo: 3, url: `/mock/measurements/${sessionId}-3.jpg` },
  ];
}

/**
 * productId → 1-3 응답. 위 시나리오 표의 네 갈래를 그대로 담았다.
 *
 * ⚠️ 치수 축 규약(D-18): `widthCm >= lengthCm` 이 불변식이다. 아래 값들도 전부 이 규칙을
 *    지킨다 — 서버가 저장 전에 가로·세로를 스왑 정렬하므로, 응답으로 돌아오는 값은
 *    항상 정렬된 상태다. 높이는 정렬 대상이 아니라 별도 산출값이다.
 */
export const MOCK_MEASUREMENT_BY_PRODUCT_ID: Record<
  number,
  MeasurementResponse | undefined
> = {
  // 41 — docs/02-api-spec.md §1-3 성공 응답 예시 그대로 (재촬영 경로 확인용)
  41: {
    sessionId: 901,
    status: "INFERRED",
    inferred: { widthCm: 6.5, lengthCm: 6.5, heightCm: 21.0 },
    weightKg: 0.52,
    confidence: 0.93,
    gatePassed: true,
    gateFailReasons: [],
    images: mockImages(901),
    handlingDefaults: { refrigerate: true, fragile: true, irregular: false },
  } satisfies MeasurementInferred,

  // 55 — Stitch 샘플 "측정 후" 상태(1054~1436행)의 표시값 그대로
  55: {
    sessionId: 902,
    status: "INFERRED",
    inferred: { widthCm: 45.5, lengthCm: 30.2, heightCm: 20.0 },
    weightKg: 12.4,
    confidence: 0.91,
    gatePassed: true,
    gateFailReasons: [],
    images: mockImages(902),
    handlingDefaults: { refrigerate: false, fragile: true, irregular: false },
  } satisfies MeasurementInferred,

  // 56 — 게이트 미통과. 승인 버튼이 잠기고 사유가 표시돼야 한다 (§1-3)
  56: {
    sessionId: 903,
    status: "INFERRED",
    inferred: { widthCm: 21.4, lengthCm: 14.8, heightCm: 9.6 },
    weightKg: 0.63,
    confidence: 0.41,
    gatePassed: false,
    // ⚠️ 사유 코드 목록은 02 에 없다(계약은 `string[]`). §1-3 본문의 서술
    //    "임계값 미만, 종횡비 이상, 상한 초과"를 코드처럼 옮겨 적은 임시값이다.
    gateFailReasons: ["LOW_CONFIDENCE", "ASPECT_RATIO_ANOMALY"],
    images: mockImages(903),
    handlingDefaults: { refrigerate: false, fragile: false, irregular: false },
  } satisfies MeasurementInferred,

  // 57 — 타임아웃. HTTP 에러가 아니라 status 값이다 (§1-3)
  57: {
    sessionId: 904,
    status: "MEASURE_FAILED",
    failReason: "TIMEOUT",
    // 저울은 추론과 별개 경로라 추론이 실패해도 무게는 실릴 수 있다 (§1-3)
    weightKg: 9.8,
  } satisfies MeasurementFailed,
};

/** sessionId → 그 세션이 붙어 있는 productId. 1-4 확정 응답을 만들 때 쓴다 */
export const MOCK_SESSION_TO_PRODUCT_ID: Record<number, number | undefined> = {
  901: 41,
  902: 55,
  903: 56,
  904: 57,
};

/** sessionId → 게이트 통과 여부. 1-4 APPROVE 의 409 GATE_NOT_PASSED 판정에 쓴다 */
export const MOCK_SESSION_GATE_PASSED: Record<number, boolean | undefined> = {
  901: true,
  902: true,
  903: false,
  904: false, // MEASURE_FAILED 세션은 승인 대상이 아니다 (MANUAL 만 허용)
};

/* ── 1-4 측정 확정 ───────────────────────────────────────── */

/** docs/02-api-spec.md §1-4 응답 예시 형태 */
export function mockConfirmResponse(
  productId: number,
  method: "APPROVE" | "MANUAL",
): ConfirmResponse {
  return {
    productId,
    dimStatus: "CONFIRMED",
    dimMethod: method === "APPROVE" ? "INFERRED" : "MANUAL",
  };
}

/* ── 1-5 수량 입고 ───────────────────────────────────────── */

/**
 * 입고 전 재고 — `stockQty` 누적값을 만들기 위한 기준선.
 * 실제 서버는 DB 값에 더하지만, mock 은 상태를 들고 있지 않으므로
 * "판정 시점의 마스터 재고 + 입고 수량"으로 계산한다 (docs/02-api-spec.md §1-5).
 */
export function mockStockInResponse(productId: number, qty: number): StockInResponse {
  const base = MOCK_PRODUCTS.find((p) => p.productId === productId)?.stockQty ?? 0;
  return { productId, stockQty: base + qty };
}

/* ── 1-6 제품 원본 이미지 ────────────────────────────────── */

/**
 * `GET /products/{id}/images` 응답 mock — 확정 후 화면이 1-3 의 `images` 대신
 * 이걸 보게 된다(그리고 출고 포장 화면도 같은 API 를 쓴다).
 * 41 은 마스터 대체 경로를, 55 는 측정 원본 경로를 확인하려고 갈라 뒀다.
 *
 * ⚠️ **위 시나리오 표의 상품 네 건을 모두 채워 둔다.** 계약상 1-6 은 확정된 상품이면 항상
 *    응답을 주는데(둘 중 하나의 source), 여기 빠진 상품이 있으면 화면에서 "확정한 순간
 *    사진이 사라지는" 것처럼 보인다 — 확정 전에는 1-3 의 images 를 쓰다가 확정 후 이쪽으로
 *    갈아끼우기 때문이다. mock 구멍을 화면 쪽 fallback 으로 덮지 않기 위해 여기서 메운다.
 */
export const MOCK_PRODUCT_IMAGES: Record<number, ProductImagesResponse | undefined> = {
  41: {
    source: "MASTER_FALLBACK",
    images: [{ cameraNo: null, url: "/mock/products/41-master.jpg" }],
  },
  55: {
    source: "MEASUREMENT",
    images: mockImages(902),
  },
  // 56 — 게이트는 미통과였지만 촬영 자체는 됐으므로 측정 원본이 남는다
  56: {
    source: "MEASUREMENT",
    images: mockImages(903),
  },
  // 57 — 측정이 실패해 촬영 원본이 없고, 마스터 imageUrl 도 null 이라 보여줄 사진이 없다.
  //      "사진 0장"도 계약이 허용하는 응답이라 그대로 둔다(화면은 빈 자리표시를 그린다).
  57: {
    source: "MASTER_FALLBACK",
    images: [],
  },
};

/* ── 1-7 분류 목록 — v0.5 에서 삭제됨 (D-21) ─────────────── */

/*
 * `GET /categories` 계약이 v0.5 에서 삭제되어 `MOCK_CATEGORIES` 도 함께 지웠다.
 * 유일한 소비처가 1-2 수기 등록 폼의 분류 드롭다운이었는데 1-2 도 같이 사라졌다.
 * 화면에 보이는 대분류·중분류는 1-1 응답의 `categoryL`/`categoryM`(위 MOCK_PRODUCTS)이
 * 그대로 채우므로 별도 목록이 필요 없다 — 표시 전용이고 작업자가 고르지 않는다.
 * ⚠️ `lib/types.ts` 의 `Category` 타입과 `lib/endpoints.ts` 의 categories 래퍼는 팀 공유
 *    파일이라 남겨 뒀다. 이 파일에서는 호출도 참조도 없다.
 */
