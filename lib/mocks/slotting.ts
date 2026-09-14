/**
 * `GET/POST /admin/slotting/**`·`/admin/relocations/**` 표본 (Stage 11B, 정본 §15).
 * 백엔드가 2026-09-14 같은 시각 `feat/stage11b-slotting`에서 작업 중이라 curl 확인
 * 시점(404)엔 없다 — `app/analytics/_data/use-slotting.ts` 가 실패했을 때만 대신
 * 그린다(`lib/mocks/webhooks.ts`와 같은 관례). 뮤테이션(제안 생성·적용·비교·시뮬레이터)도
 * 조회가 실패한 동안은 이 파일 안에서 결정적으로 흉내 낸다 — 화면 체크(브리프 §3)가
 * 라이브 없이도 끝까지 돌아야 한다.
 *
 * 베이 id·zoneCode·aisleNo 는 `lib/mocks/layout.ts` 의 AMBS 통로(상온 선반, id 101~116,
 * aisleNo=2)를 그대로 참조한다 — 히트맵·골든존을 2D 지도(같은 표본 레이아웃)에 얹었을 때
 * 실제로 색이 칠해지는 베이여야 한다.
 */

import type {
  CompareProposalResponse,
  GoldenZoneBayRow,
  HeatmapBayRow,
  RelocationItem,
  RelocationProposalDetail,
  SlottingParams,
  VelocityRow,
} from "../types";

export const mockSlottingParams: SlottingParams = {
  walkSpeedMps: 1.0,
  secPerLine: 12,
  levelPenaltySec: 3,
  goldenShare: 0.15,
  heavyKg: 15,
  velocityDays: 28,
};

const MOCK_SELLERS = ["SEL-0001", "SEL-0014", "SEL-0032", "SEL-0057"];
const MOCK_PRODUCT_NAMES = [
  "즉석밥 210g", "생수 2L×6", "핸드크림 50ml", "비타민C 60정", "키친타월 6롤",
  "라면 5입", "물티슈 80매", "샴푸 500ml", "커피믹스 100T", "초콜릿바 6입",
  "즉석국 3입", "치약 120g", "섬유유연제 1L", "견과류믹스 300g", "종이컵 50입",
  "볼펜 12자루", "usb 케이블 1m", "무선이어폰 케이스", "구강청결제 750ml", "화장솜 80매",
  "선물세트 A", "선물세트 B", "주방세제 500ml", "휴지 30롤", "냉동만두 500g",
  "즉석카레 200g", "탄산수 500ml×20", "노트 5권", "건전지 AA 8입", "마스크 50매",
];

/** 30상품 회전율 — 라인 수를 지수적으로 흩어 누적 80/95% 경계가 자연스럽게 A15·B~9·C~6
 * 개로 나뉘게 한다(정본 §15.4 "상위 20%가 80%" 근거와 비슷한 비율). 결정적 계산, 난수 없음. */
export const mockVelocity: VelocityRow[] = buildMockVelocity();

function buildMockVelocity(): VelocityRow[] {
  const rawLines = MOCK_PRODUCT_NAMES.map((_, i) => Math.round(400 * Math.exp(-i / 6)) + 2);
  const totalLines = rawLines.reduce((sum, n) => sum + n, 0);
  let cum = 0;
  return MOCK_PRODUCT_NAMES.map((name, i) => {
    const lines = rawLines[i];
    cum += lines;
    const share = lines / totalLines;
    const cumShare = cum / totalLines;
    const grade = cumShare <= 0.8 ? "A" : cumShare <= 0.95 ? "B" : "C";
    const bayNo = 1 + (i % 16);
    const golden = grade === "A" && i % 4 !== 0; // A 상품 대다수는 이미 골든존 — 일부만 밖
    return {
      productId: 1000 + i,
      gtin: `880000${String(1000 + i).padStart(7, "0")}`,
      name,
      sellerCode: MOCK_SELLERS[i % MOCK_SELLERS.length],
      lines,
      share,
      cumShare,
      grade,
      currentBins: [
        {
          locationCode: `AMBS-02-${String(bayNo).padStart(2, "0")}-0${golden ? 2 : 5}-01`,
          golden,
        },
      ],
    } satisfies VelocityRow;
  });
}

/** AMBS 통로(id 101~116) 16베이의 PICK 라인 수 — 통로 안쪽(포장대에서 먼 베이 번호가 큰
 * 쪽)일수록 낮게, 입구 쪽은 들쑥날쑥하게 흩어 히트맵 5단계 색이 전부 보이게 한다. */
export const mockHeatmap: HeatmapBayRow[] = Array.from({ length: 16 }, (_, i) => {
  const bayNo = i + 1;
  const lines = Math.round(180 * Math.exp(-i / 5)) + (i % 3 === 0 ? 40 : 5);
  return { bayId: 101 + i, zoneCode: "AMBS", aisleNo: 2, bayNo, lines };
});

/** 골든존 = 포장대에 가까운 베이 상위 15% ≈ AMBS 16베이 중 2~3개(선반 5단 중 2~4단만
 * 100% 가중, 1·5단은 후보에서 빠진다는 가정으로 베이당 골든 칸 수를 3으로 통일) */
export const mockGoldenZone: GoldenZoneBayRow[] = [1, 2, 3].map((bayNo) => ({
  bayId: 100 + bayNo,
  zoneCode: "AMBS",
  aisleNo: 2,
  bayNo,
  goldenBinCount: 3,
}));

const RELOCATION_REASON = ["A_OUTSIDE_GOLDEN", "A_OUTSIDE_GOLDEN", "EVICT_C"] as const;

/** 제안 항목 12개 — MOVE_IN 9(A상품을 골든존으로) + EVICT 3(그 목적지에 있던 C상품을
 * 먼저 빼냄, 정본 §15.6 규칙 3 "EVICT 항목을 먼저"). seq 로 적용 순서를 고정한다. */
function buildMockItems(proposalId: number): RelocationItem[] {
  const items: RelocationItem[] = [];
  let seq = 1;
  // EVICT 3건 — 골든존 안 C상품을 밖 빈 칸으로
  for (let i = 0; i < 3; i++) {
    const bayNo = i + 1;
    items.push({
      id: 9000 + seq,
      proposalId,
      seq: seq++,
      kind: "EVICT",
      productId: 1020 + i,
      gtin: `880000${String(1020 + i).padStart(7, "0")}`,
      productName: MOCK_PRODUCT_NAMES[20 + i],
      sellerId: 1,
      sellerCode: MOCK_SELLERS[i % MOCK_SELLERS.length],
      lotId: 5000 + i,
      qty: 12 + i,
      grade: "C",
      lines: 3 + i,
      fromLocationId: 10100 + bayNo,
      fromLocationCode: `AMBS-02-${String(bayNo).padStart(2, "0")}-03-01`,
      toLocationId: 10112 + bayNo,
      toLocationCode: `AMBS-02-${String(12 + bayNo).padStart(2, "0")}-03-01`,
      reason: "EVICT_C",
      selected: true,
      status: "PROPOSED",
      workerId: null,
      startedAt: null,
      completedAt: null,
    });
  }
  // MOVE_IN 9건 — 골든존 밖 A상품을 방금 비운(또는 원래 빈) 골든 칸으로
  for (let i = 0; i < 9; i++) {
    const bayNo = (i % 3) + 1;
    items.push({
      id: 9000 + seq,
      proposalId,
      seq: seq++,
      kind: "MOVE_IN",
      productId: 1000 + i,
      gtin: `880000${String(1000 + i).padStart(7, "0")}`,
      productName: MOCK_PRODUCT_NAMES[i],
      sellerId: 1,
      sellerCode: MOCK_SELLERS[i % MOCK_SELLERS.length],
      lotId: 4000 + i,
      qty: 20 + i * 2,
      grade: "A",
      lines: Math.round(400 * Math.exp(-i / 6)) + 2,
      fromLocationId: 10200 + i,
      fromLocationCode: `AMBS-02-${String(9 + (i % 6)).padStart(2, "0")}-04-01`,
      toLocationId: 10100 + bayNo,
      toLocationCode: `AMBS-02-${String(bayNo).padStart(2, "0")}-03-01`,
      reason: RELOCATION_REASON[i % RELOCATION_REASON.length] === "EVICT_C" ? "A_OUTSIDE_GOLDEN" : "A_OUTSIDE_GOLDEN",
      selected: true,
      status: "PROPOSED",
      workerId: null,
      startedAt: null,
      completedAt: null,
    });
  }
  return items;
}

export function mockProposal(id = 1): RelocationProposalDetail {
  return {
    id,
    centerId: 1,
    center: "C1",
    status: "DRAFT",
    params: mockSlottingParams,
    beforeM: null,
    afterM: null,
    beforeSec: null,
    afterSec: null,
    createdAt: "2026-09-14T09:00:00",
    appliedAt: null,
    items: buildMockItems(id),
  };
}

export const mockProposals: RelocationProposalDetail[] = [mockProposal(1)];

/** 전후 비교 — 최근 웨이브 20개 가정치. after 는 A상품이 골든존으로 옮겨간 만큼 통로
 * 12번까지 가지 않아도 되어 거리·시간이 준다(정본 §15.7). 결정적 고정값. */
export const mockCompare: CompareProposalResponse = {
  before: { distanceM: 18420, timeSec: 40850, lines: 3120 },
  after: { distanceM: 14180, timeSec: 32460, lines: 3120 },
  diffPct: -23.0,
  byBatch: Array.from({ length: 8 }, (_, i) => {
    const beforeDistance = 2100 + i * 120;
    const afterDistance = Math.round(beforeDistance * 0.77);
    const beforeTime = 4600 + i * 260;
    const afterTime = Math.round(beforeTime * 0.79);
    const lines = 360 + i * 18;
    return {
      batchId: 500 + i,
      before: { distanceM: beforeDistance, timeSec: beforeTime, lines },
      after: { distanceM: afterDistance, timeSec: afterTime, lines },
      diffPct: Math.round(((afterDistance - beforeDistance) / beforeDistance) * 1000) / 10,
    };
  }),
};

/** `POST /admin/slotting/evaluate` 표본 — 제안이 아직 없을 때 "현재" 만 보여주는 자리라
 * `mockCompare.before`/`byBatch[].before` 를 그대로 옮긴다(같은 웨이브 20개 가정). */
export const mockEvaluate = {
  batches: mockCompare.byBatch.map((b) => ({
    batchId: b.batchId,
    lines: b.before.lines,
    aisles: 3,
    distanceM: b.before.distanceM,
    timeSec: b.before.timeSec,
  })),
  totals: mockCompare.before,
};
