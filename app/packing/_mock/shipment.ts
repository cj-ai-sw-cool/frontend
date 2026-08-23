/**
 * 출고 포장 화면 mock 데이터 — 백엔드가 준비되기 전까지 화면을 굴리기 위한 것.
 *
 * ⚠️ 이 폴더의 값은 전부 "가짜"다. 실제 호출은 `@/lib/endpoints` 의 `outbound` 를 쓰고,
 *    교체 지점은 `app/packing/_data/use-shipment-detail.ts` 한 곳뿐이다.
 *
 * 규칙
 * - 모든 mock 은 `@/lib/types` 의 계약 타입으로 타입 표기한다.
 *   → docs/02-api-spec.md 가 바뀌어 타입이 달라지면 여기서 **컴파일 에러**가 난다.
 *     mock 이 계약에서 조용히 벗어나는 것을 막는 장치다.
 * - 값 자체는 docs/02-api-spec.md §3-2 의 JSON 예시를 그대로 옮겼다.
 */
import type { BoxType, ProductImagesResponse, ShipmentDetail } from "@/lib/types";

/* ── 3-2 배송단위 상세 ───────────────────────────────────── */

/**
 * docs/02-api-spec.md §3-2 응답 예시와 동일한 모양.
 * items 의 첫 항목은 명세 예시 그대로이고, 나머지 2건은 리스트 표시 확인용으로 덧붙였다
 * (형태는 동일 — `handling` 은 서버가 계산한 파생 속성 코드 배열).
 */
export const MOCK_SHIPMENT_DETAIL: ShipmentDetail = {
  shipmentId: 501,
  orderId: 300,
  seqNo: 1,
  status: "PACKING",
  line: { lineId: 1, name: "라인A" },
  tote: { toteId: 7, barcode: "T-0012" },
  recommendedBox: {
    boxTypeId: 3,
    name: "B호",
    innerCm: [27.0, 20.0, 15.0],
    stockQty: 55,
  },
  finalBox: null, // 오버라이드 전 상태. 3-3 호출 후에는 값이 들어온다
  fillerRecommended: true,
  items: [
    {
      productId: 41,
      gtin: "8801234567890",
      name: "○○ 오렌지주스 500ml",
      qty: 2,
      handling: ["REFRIGERATE", "LIQUID_CAUTION"],
    },
    {
      productId: 58,
      gtin: "8809876543210",
      name: "△△ 머그컵 350ml",
      qty: 1,
      handling: ["FRAGILE"],
    },
    {
      productId: 72,
      gtin: "8801112223334",
      name: "□□ 즉석밥 210g 3입",
      qty: 3,
      handling: [],
    },
  ],
};

/**
 * 토트 바코드 → shipmentId 해석용 mock.
 * 실제로는 3-5 `POST /totes/scan` 이 배송단위 상세를 통째로 돌려준다(재스캔 멱등 — D-14).
 * 여기서는 "스캔이 성공하면 어떤 배송단위가 잡히는가"만 흉내 낸다.
 * 없는 바코드를 넣으면 404 TOTE_NOT_ASSIGNED 분기를 확인할 수 있다.
 */
export const MOCK_TOTE_BARCODE_TO_SHIPMENT_ID: Record<string, number | undefined> = {
  "T-0012": 501,
};

/* ── 1-6 제품 이미지 ─────────────────────────────────────── */

/**
 * `GET /products/{id}/images` 응답 mock — 입고(1-6)에서 만든 이미지를 출고 화면이 재사용한다.
 *
 * ⚠️ **실제 이미지 파일은 저장소에 없다.** 아래 url 은 존재하지 않는 로컬 경로다.
 *    그래서 브라우저에서 항상 404 가 나고, `_components/product-image-panel.tsx` 의
 *    onError 대체 표시(회색 박스)가 대신 그려진다. 그게 의도한 동작이다 —
 *    "이미지가 깨졌을 때 화면이 어떻게 보이는가"를 mock 단계에서 확인할 수 있다.
 *    외부 URL 은 쓰지 않는다(네트워크·CSP 의존을 만들지 않기 위해).
 *
 * 키는 productId 이고, MOCK_SHIPMENT_DETAIL.items 의 세 건에 각각 다른 상태를 물려 뒀다.
 *   41 → MEASUREMENT   : 측정 원본 2장(카메라 2대)   … 여러 장이 와도 대표 1장만 그리는지 확인용
 *   58 → MASTER_FALLBACK: 코리안넷 대표 1장(cameraNo null) … source 표기 분기 확인용
 *   72 → images 가 빈 배열                              … "이미지 없음" 상태 확인용
 * 키에 없는 productId 는 undefined 가 나온다(= 404 자리).
 *
 * 41 이 2장인 이유가 바뀌었다 — 예전에는 화면 아래 `카메라 1`·`카메라 2` 전환 버튼을 확인하려고
 * 넣어 뒀지만, 그 버튼은 삭제됐다(대표 한 장만 표시). 데이터는 그대로 두는 게 맞다:
 * 계약상 1-6 은 여러 장을 줄 수 있고, 화면이 그중 대표를 고른다는 규칙(`pickRepresentative`)이
 * 실제로 지켜지는지는 **여러 장이 오는 mock 이 있어야** 확인된다.
 */
export const MOCK_PRODUCT_IMAGES: Record<number, ProductImagesResponse | undefined> = {
  41: {
    source: "MEASUREMENT",
    images: [
      { cameraNo: 1, url: "/mock/product-images/41-cam1.jpg" },
      { cameraNo: 2, url: "/mock/product-images/41-cam2.jpg" },
    ],
  },
  58: {
    source: "MASTER_FALLBACK",
    images: [{ cameraNo: null, url: "/mock/product-images/58-master.jpg" }],
  },
  72: {
    source: "MEASUREMENT",
    images: [],
  },
};

/* ── 3-4 박스 재고 현황 ──────────────────────────────────── */

/**
 * `GET /box-types` 응답 mock.
 * boxTypeId 3 은 위 MOCK_SHIPMENT_DETAIL.recommendedBox 와 같은 박스여야 한다
 * (추천 박스가 목록에 없으면 오버라이드 셀렉트가 빈 값으로 보인다).
 * D호(재고 0)는 "재고 없는 박스로는 오버라이드 불가" 표시를 확인하려고 넣어 뒀다.
 */
export const MOCK_BOX_TYPES: BoxType[] = [
  { boxTypeId: 1, name: "1호", innerCm: [22.0, 19.0, 9.0], stockQty: 120 },
  { boxTypeId: 2, name: "A호", innerCm: [25.0, 18.0, 12.0], stockQty: 8 },
  { boxTypeId: 3, name: "B호", innerCm: [27.0, 20.0, 15.0], stockQty: 55 },
  { boxTypeId: 4, name: "C호", innerCm: [34.0, 25.0, 21.0], stockQty: 31 },
  { boxTypeId: 5, name: "D호", innerCm: [41.0, 31.0, 28.0], stockQty: 0 },
];

/* ── 제품 재고: 이 화면에서 제거됨 (D-19) ───────────────── */

/**
 * 예전에 이 자리에 `ProductStockRow` 임시 타입과 `MOCK_PRODUCT_STOCK` 이 있었다.
 * docs/04-decisions.md **D-19** 로 출고 포장 화면에서 재고 현황 영역(제품 재고 + 박스 재고
 * 목록)을 통째로 걷어내면서 함께 지웠다.
 *
 * 지운 이유
 *   제품 재고는 docs/02-api-spec.md 에 대응 엔드포인트가 없어 계약 없이 화면만 있었고,
 *   포장 작업자가 그 자리에서 할 수 있는 행동도 없었다(재고를 보고 바꿀 수 있는 게 없다).
 *
 * 재고가 화면에서 완전히 사라진 것은 아니다 — 실제로 판단에 쓰이는
 * **추천 박스의 재고**는 3-2 응답의 `recommendedBox.stockQty` 로 계속 들어오고,
 * `_components/box-recommendation-panel.tsx` 가 그대로 표시한다.
 * 박스 목록(`MOCK_BOX_TYPES`)도 남아 있다 — 3-3 박스 오버라이드 드롭다운의 선택지다.
 */
