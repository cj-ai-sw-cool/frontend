/**
 * `GET /layout` · `GET /bays/{id}/bins` 표본 — 정본 §11.0 "3D·2D 계약" 그대로의 작은
 * 데모 레이아웃(존 4·통로 4·베이 40)이다. 백엔드가 Stage 11을 같은 시각(`feat/
 * stage11-scale`)에 만드는 중이라 2026-09-13 시점엔 이 엔드포인트가 없다 — 프론트는
 * 이 표본으로 먼저 3D·2D를 붙이고, 백엔드 노트에 실제 응답 예시가 나오면 라이브로
 * 바꾼다(`app/analytics/_data/use-layout.ts`가 호출 실패 시에만 이 파일을 쓴다).
 *
 * 좌표는 데이터 모델 §11.0 예시 그대로 area 원점 기준(m)이다. 실제 생성기(§11.3)처럼
 * 서펜타인 통로 하나에 좌 홀수·우 짝수 베이를 배치한다 — 규모만 작을 뿐 만드는 방식은
 * 같다(정본 §11.0 "데이터" — "데모 시드는 같은 생성기로 만든다").
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
const AISLE_WIDTH_M = 1.7;

/** 정본 §11.0 `bin_type` 표에서 이 표본이 쓰는 두 규격만 옮겼다(위치 수 = 베이 폭 ÷ 칸 폭) */
const BIN_TYPES: Record<"SHELF_S" | "PALLET_PLT", BinTypeSpec> = {
  SHELF_S: { code: "S", positions: 3 },
  PALLET_PLT: { code: "PLT", positions: 2 },
};

const LEVELS = 5;
const BAY_GAP = 0.15; // 베이 사이 통로 방향 틈

const AREAS: Area[] = [
  { code: "RCV", name: "입고·검수", kind: "RECEIVING", tempZone: "AMBIENT", xM: -14, yM: 2, wM: 12, dM: 10 },
  { code: "AMB", name: "상온 홀", kind: "STORAGE", tempZone: "AMBIENT", xM: 0, yM: 0, wM: 40, dM: 24 },
  { code: "PCK", name: "포장·put wall", kind: "PACKING", tempZone: "AMBIENT", xM: 41, yM: 2, wM: 12, dM: 12 },
  { code: "RTN", name: "반품", kind: "RETURNS", tempZone: "AMBIENT", xM: 41, yM: 15, wM: 12, dM: 8 },
  { code: "CHL", name: "냉장실", kind: "STORAGE", tempZone: "CHILLED", xM: 0, yM: 26, wM: 14, dM: 10 },
  { code: "FRZ", name: "냉동실", kind: "STORAGE", tempZone: "FROZEN", xM: 16, yM: 26, wM: 10, dM: 10 },
];

/** 통로 하나 + 그 위 베이들을 만든다. `bayCount` 는 좌우 합, 짝수여야 쌍이 맞는다 */
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
  const bayLength = BAY_LENGTH_M[medium]; // 통로 방향 베이 폭(1.2m 선반 / 2.7m 파렛트)
  const pitch = bayLength + BAY_GAP;
  const lengthM = pairs * pitch;
  const totalBins = LEVELS * binType.positions;
  // 베이 박스는 `bay.xM/yM` 을 footprint **중심**으로 해석한다(layout-geometry.ts 머리말)
  const depthOffset = AISLE_WIDTH_M / 2 + 0.3; // 통로 차선 + 베이 절반 깊이 근사

  const bays: Bay[] = [];
  for (let p = 0; p < pairs; p++) {
    const bayCenterY = yM + p * pitch + bayLength / 2;
    // 점유율을 베이마다 다르게 흩어 5단계 색이 전부 보이게 한다(결정적 패턴, Math.random 없음)
    const fillRatioLeft = (0.15 + ((p * 7) % 10) * 0.09) % 1;
    const fillRatioRight = (0.15 + ((p * 3 + 5) % 10) * 0.09) % 1;
    const occLeft = Math.round(totalBins * fillRatioLeft);
    const occRight = Math.round(totalBins * fillRatioRight);

    bays.push({
      id: bayIdStart + p * 2,
      aisleId,
      no: p * 2 + 1, // 좌 홀수
      side: "LEFT",
      binType: binType.code,
      levels: LEVELS,
      positions: binType.positions,
      xM: xM - depthOffset,
      yM: bayCenterY,
      totalBins,
      occupiedBins: occLeft,
      qty: occLeft * 6,
    });
    bays.push({
      id: bayIdStart + p * 2 + 1,
      aisleId,
      no: p * 2 + 2, // 우 짝수
      side: "RIGHT",
      binType: binType.code,
      levels: LEVELS,
      positions: binType.positions,
      xM: xM + depthOffset,
      yM: bayCenterY,
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

const AMBS = buildAisleWithBays(1, "AMBS", 2, 12, 3, 16, BIN_TYPES.SHELF_S, "SHELF", 101);
const AMBP = buildAisleWithBays(2, "AMBP", 4, 31, 3, 8, BIN_TYPES.PALLET_PLT, "PALLET_RACK", 201);
const CHLS = buildAisleWithBays(3, "CHLS", 2, 7, 1, 8, BIN_TYPES.SHELF_S, "SHELF", 301);
const FRZS = buildAisleWithBays(4, "FRZS", 2, 5, 1, 8, BIN_TYPES.SHELF_S, "SHELF", 401);

function zoneBinCount(bays: Bay[]): number {
  return bays.reduce((sum, b) => sum + b.totalBins, 0);
}

export const mockLayout: LayoutResponse = {
  areas: AREAS,
  zones: [
    { code: "AMBS", name: "상온 선반(피킹면)", areaCode: "AMB", medium: "SHELF", binCount: zoneBinCount(AMBS.bays), xM: 2, yM: 2, wM: 20, dM: 18 },
    { code: "AMBP", name: "상온 파렛트(예비)", areaCode: "AMB", medium: "PALLET_RACK", binCount: zoneBinCount(AMBP.bays), xM: 24, yM: 2, wM: 14, dM: 18 },
    { code: "CHLS", name: "냉장 선반", areaCode: "CHL", medium: "SHELF", binCount: zoneBinCount(CHLS.bays), xM: 1, yM: 1, wM: 12, dM: 8 },
    { code: "FRZS", name: "냉동 선반", areaCode: "FRZ", medium: "SHELF", binCount: zoneBinCount(FRZS.bays), xM: 1, yM: 1, wM: 8, dM: 8 },
  ],
  aisles: [AMBS.aisle, AMBP.aisle, CHLS.aisle, FRZS.aisle],
  bays: [...AMBS.bays, ...AMBP.bays, ...CHLS.bays, ...FRZS.bays],
};

const MOCK_SELLERS = ["SEL-0001", "SEL-0014", "SEL-0032", "SEL-0057"];
const MOCK_PRODUCTS = ["즉석밥 210g", "생수 2L×6", "핸드크림 50ml", "비타민C 60정", "키친타월 6롤"];

/** `GET /bays/{id}/bins` 표본 — 베이 코드 규칙 그대로(`{존}-{통로:2}-{베이:2}-{단:2}-{위치:2}`).
 * 선반(SHELF)은 1~4단 PICK_FACE·5단 RESERVE, 파렛트는 전부 RESERVE(정본 §11.0 "role") */
export function mockBinsForBay(bayId: number): Bin[] {
  const bay = mockLayout.bays.find((b) => b.id === bayId);
  if (!bay) return [];
  const aisle = mockLayout.aisles.find((a) => a.id === bay.aisleId);
  const zoneCode = aisle?.zoneCode ?? "?";
  const isShelf = bay.binType !== "PLT";

  const bins: Bin[] = [];
  let locationId = bayId * 100;
  let filled = 0;
  for (let level = 1; level <= bay.levels; level++) {
    const role: BinRole = isShelf && level < bay.levels ? "PICK_FACE" : "RESERVE";
    for (let position = 1; position <= bay.positions; position++) {
      locationId += 1;
      const isOccupied = filled < bay.occupiedBins;
      if (isOccupied) filled += 1;
      const seed = locationId % MOCK_SELLERS.length;
      bins.push({
        locationId,
        code: `${zoneCode}-${pad2(aisle?.no ?? 0)}-${pad2(bay.no)}-${pad2(level)}-${pad2(position)}`,
        levelNo: level,
        positionNo: position,
        role,
        sellerCode: isOccupied ? MOCK_SELLERS[seed] : null,
        productName: isOccupied ? MOCK_PRODUCTS[seed % MOCK_PRODUCTS.length] : null,
        qty: isOccupied ? 10 + (locationId % 40) : 0,
      });
    }
  }
  return bins;
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}
