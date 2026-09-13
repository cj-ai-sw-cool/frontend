/**
 * `GET /layout` · `GET /bays/{id}/bins` 표본 — 정본 §11.0 "3D·2D 계약" 그대로의 작은
 * 데모 레이아웃(존 4·통로 4·베이 40)이다. `app/analytics/_data/use-layout.ts` 가 실제
 * 호출이 실패했을 때만(백엔드가 아직 없거나 재시드 중이거나) 이 표본으로 대신 그린다.
 *
 * ⚠️ 2026-09-13 백엔드 라이브 `/layout`·`/zones` 응답으로 좌표·필드를 다시 맞췄다
 * (`app/analytics/_components/layout/layout-geometry.ts` 머리말, `lib/types.ts`
 * `Area`/`Zone`/`Bay` 주석) — area·zone·aisle·bay 좌표는 전부 **같은 건물 전역
 * 평면**(area 오프셋을 더하지 않는다), 통로는 X축을 따라 뻗고 베이는 `zoneCode`+
 * `aisleNo` 로 통로를 가리킨다(`aisleId` 아님). 서펜타인 통로에 좌 홀수·우 짝수
 * 베이를 배치하는 방식은 실제 생성기(§11.3)와 같다 — 규모만 작다.
 */

import type { Area, Aisle, Bay, Bin, BinRole, LayoutResponse, Medium } from "../types";

interface BinTypeSpec {
  code: string;
  positions: number;
}

/** `app/analytics/_components/layout/layout-geometry.ts` 와 같은 값이다 — `lib/` 가
 * `app/`을 거꾸로 import 하지 않도록 여기 값을 따로 둔다(둘 다 정본 §11.0 표에서 왔다,
 * 상수라 바뀔 일이 드물다). 바뀌면 두 곳 다 고친다 */
const BAY_LENGTH_M: Record<Medium, number> = { SHELF: 1.2, PALLET_RACK: 2.7, PALLET_FLOOR: 2.7 };
const BAY_DEPTH_M: Record<Medium, number> = { SHELF: 0.55, PALLET_RACK: 1.3, PALLET_FLOOR: 1.3 };
const AISLE_WIDTH_M = 1.7;

/** 정본 §11.0 `bin_type` 표에서 이 표본이 쓰는 두 규격만 옮겼다(위치 수 = 베이 폭 ÷ 칸 폭) */
const BIN_TYPES: Record<"SHELF_S" | "PALLET_PLT", BinTypeSpec> = {
  SHELF_S: { code: "S", positions: 3 },
  PALLET_PLT: { code: "PLT", positions: 2 },
};

const LEVELS = 5;

const AREAS: Area[] = [
  { id: 1, code: "RCV", name: "입고·검수", kind: "RECEIVING", tempZone: "AMBIENT", xM: -14, yM: 2, wM: 12, dM: 10 },
  { id: 2, code: "AMB", name: "상온 홀", kind: "STORAGE", tempZone: "AMBIENT", xM: 0, yM: 0, wM: 40, dM: 24 },
  { id: 3, code: "PCK", name: "포장·put wall", kind: "PACKING", tempZone: "AMBIENT", xM: 41, yM: 2, wM: 12, dM: 12 },
  { id: 4, code: "RTN", name: "반품", kind: "RETURNS", tempZone: "AMBIENT", xM: 41, yM: 15, wM: 12, dM: 8 },
  { id: 5, code: "CHL", name: "냉장실", kind: "STORAGE", tempZone: "CHILLED", xM: 0, yM: 26, wM: 14, dM: 10 },
  { id: 6, code: "FRZ", name: "냉동실", kind: "STORAGE", tempZone: "FROZEN", xM: 16, yM: 26, wM: 10, dM: 10 },
];

/**
 * 통로 하나 + 그 위 베이들을 만든다(전역 좌표, `xM/yM` = 통로 시작 모서리). `bayCount` 는
 * 좌우 합, 짝수여야 쌍이 맞는다 — 쌍마다 X로 한 칸 전진하고(통로 방향), LEFT·RIGHT 는
 * Y로 갈린다(라이브 데이터로 확인한 축, layout-geometry.ts 머리말).
 */
function buildAisleWithBays(
  aisleId: number,
  zoneCode: string,
  no: number,
  xM: number,
  yM: number,
  bayCount: number,
  binType: BinTypeSpec,
  medium: Medium,
  bayIdStart: number,
): { aisle: Aisle; bays: Bay[] } {
  const pairs = bayCount / 2;
  const pitch = BAY_LENGTH_M[medium];
  const lengthM = pairs * pitch;
  const totalBins = LEVELS * binType.positions;
  const rowGap = AISLE_WIDTH_M + BAY_DEPTH_M[medium]; // LEFT·RIGHT 행 사이(통로 차선 + 베이 깊이)

  const bays: Bay[] = [];
  for (let p = 0; p < pairs; p++) {
    const bayX = xM + p * pitch;
    // 점유율을 베이마다 다르게 흩어 5단계 색이 전부 보이게 한다(결정적 패턴, Math.random 없음)
    const fillRatioLeft = (0.15 + ((p * 7) % 10) * 0.09) % 1;
    const fillRatioRight = (0.15 + ((p * 3 + 5) % 10) * 0.09) % 1;
    const occLeft = Math.round(totalBins * fillRatioLeft);
    const occRight = Math.round(totalBins * fillRatioRight);

    bays.push({
      id: bayIdStart + p * 2,
      zoneCode,
      aisleNo: no,
      no: p * 2 + 1, // 좌 홀수
      side: "LEFT",
      binType: binType.code,
      levels: LEVELS,
      positions: binType.positions,
      xM: bayX,
      yM,
      totalBins,
      occupiedBins: occLeft,
      qty: occLeft * 6,
    });
    bays.push({
      id: bayIdStart + p * 2 + 1,
      zoneCode,
      aisleNo: no,
      no: p * 2 + 2, // 우 짝수
      side: "RIGHT",
      binType: binType.code,
      levels: LEVELS,
      positions: binType.positions,
      xM: bayX,
      yM: yM + rowGap,
      totalBins,
      occupiedBins: occRight,
      qty: occRight * 6,
    });
  }

  return {
    aisle: { id: aisleId, zoneCode, no, direction: no % 4 === 2 ? "FORWARD" : "REVERSE", xM, yM, lengthM },
    bays,
  };
}

const AMBS = buildAisleWithBays(1, "AMBS", 2, 3, 10, 16, BIN_TYPES.SHELF_S, "SHELF", 101);
const AMBP = buildAisleWithBays(2, "AMBP", 4, 25, 10, 8, BIN_TYPES.PALLET_PLT, "PALLET_RACK", 201);
const CHLS = buildAisleWithBays(3, "CHLS", 2, 2, 31, 8, BIN_TYPES.SHELF_S, "SHELF", 301);
const FRZS = buildAisleWithBays(4, "FRZS", 2, 18, 31, 8, BIN_TYPES.SHELF_S, "SHELF", 401);

export const mockLayout: LayoutResponse = {
  areas: AREAS,
  zones: [
    { id: 1, code: "AMBS", name: "상온 선반", areaCode: "AMB", medium: "SHELF", xM: 2, yM: 2, wM: 20, dM: 18 },
    { id: 2, code: "AMBP", name: "상온 파렛트", areaCode: "AMB", medium: "PALLET_RACK", xM: 24, yM: 2, wM: 14, dM: 18 },
    { id: 3, code: "CHLS", name: "냉장 선반", areaCode: "CHL", medium: "SHELF", xM: 1, yM: 27, wM: 12, dM: 8 },
    { id: 4, code: "FRZS", name: "냉동 선반", areaCode: "FRZ", medium: "SHELF", xM: 17, yM: 27, wM: 8, dM: 8 },
  ],
  aisles: [AMBS.aisle, AMBP.aisle, CHLS.aisle, FRZS.aisle],
  bays: [...AMBS.bays, ...AMBP.bays, ...CHLS.bays, ...FRZS.bays],
};

const MOCK_SELLERS = ["SEL-0001", "SEL-0014", "SEL-0032", "SEL-0057"];
const MOCK_PRODUCTS = ["즉석밥 210g", "생수 2L×6", "핸드크림 50ml", "비타민C 60정", "키친타월 6롤"];

/** `GET /bays/{id}/bins` 표본 — 베이 코드 규칙 그대로(`{존}-{통로:2}-{베이:2}-{단:2}-{위치:2}`).
 * 선반(SHELF)은 1~4단 PICK_FACE·5단 RESERVE, 파렛트는 전부 RESERVE(정본 §11.0 "role").
 * 칸 하나가 로트별 `items[]` 를 담는 실제 응답 모양(2026-09-13 라이브 검증, `Bin` 타입
 * 주석)을 그대로 따른다 — 표본은 칸당 로트 하나만 채운다. */
export function mockBinsForBay(bayId: number): Bin[] {
  const bay = mockLayout.bays.find((b) => b.id === bayId);
  if (!bay) return [];
  const isShelf = bay.binType !== "PLT";

  const bins: Bin[] = [];
  let locationId = bayId * 100;
  let filled = 0;
  let pickSequence = bayId * 10;
  for (let level = 1; level <= bay.levels; level++) {
    const role: BinRole = isShelf && level < bay.levels ? "PICK_FACE" : "RESERVE";
    for (let position = 1; position <= bay.positions; position++) {
      locationId += 1;
      pickSequence += 1;
      const isOccupied = filled < bay.occupiedBins;
      if (isOccupied) filled += 1;
      const seed = locationId % MOCK_SELLERS.length;
      const qty = isOccupied ? 10 + (locationId % 40) : 0;
      bins.push({
        locationId,
        code: `${bay.zoneCode}-${pad2(bay.aisleNo)}-${pad2(bay.no)}-${pad2(level)}-${pad2(position)}`,
        levelNo: level,
        positionNo: position,
        role,
        pickSequence,
        sellerCode: isOccupied ? MOCK_SELLERS[seed] : null,
        qty,
        items: isOccupied
          ? [{ gtin: `880000${String(locationId).padStart(7, "0")}`, productName: MOCK_PRODUCTS[seed % MOCK_PRODUCTS.length], lotNo: `L-${locationId}`, qty }]
          : [],
      });
    }
  }
  return bins;
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}
