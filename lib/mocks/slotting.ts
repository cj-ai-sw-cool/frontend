/**
 * `GET/POST /admin/slotting/**`·`/admin/relocations/**` 표본 (Stage 11B, 정본 §15).
 *
 * ⚠️ 2026-09-14 백엔드가 라이브로 붙었다(백엔드 노트 `backend/docs/tasks/
 * 2026-09-14-stage11b-backend-notes.md` §3 "프론트 계약") — `app/analytics/_data/
 * use-slotting.ts`·`use-slotting-mutations.ts` 는 더 이상 이 파일을 참조하지 않는다
 * (조회 실패 시 표본으로 대신 그리던 낙관 폴백을 걷어냈다). 이 파일은 스토리북·수동
 * 테스트용 표본으로만 남긴다 — 필드 모양은 라이브 응답과 맞춰 둔다.
 */

import type {
  CompareProposalResponse,
  GoldenZoneResponse,
  HeatmapResponse,
  ProposalItem,
  RelocationProposalDetail,
  SlottingParams,
  VelocityResponse,
  VelocityRow,
} from "../types";

export const mockSlottingParams: SlottingParams = {
  center: "C1",
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

function buildMockVelocityRows(): VelocityRow[] {
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
    const golden = grade === "A" && i % 4 !== 0;
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
          qty: 10 + (i % 20),
          golden,
        },
      ],
    } satisfies VelocityRow;
  });
}

/** `GET /admin/slotting/velocity` 표본 — 라이브 대조: 배열이 아니라 `{distribution, rows}` */
export const mockVelocity: VelocityResponse = (() => {
  const rows = buildMockVelocityRows();
  const totalLines = rows.reduce((sum, r) => sum + r.lines, 0);
  const aRows = rows.filter((r) => r.grade === "A");
  const bRows = rows.filter((r) => r.grade === "B");
  const cRows = rows.filter((r) => r.grade === "C");
  const aLines = aRows.reduce((sum, r) => sum + r.lines, 0);
  return {
    center: "C1",
    days: 28,
    distribution: {
      totalLines,
      products: rows.length,
      aProducts: aRows.length,
      bProducts: bRows.length,
      cProducts: cRows.length,
      aLineSharePct: totalLines > 0 ? Math.round((aLines / totalLines) * 1000) / 10 : 0,
    },
    rows,
  };
})();

/** `GET /admin/slotting/heatmap` 표본 — 라이브 대조: `{maxLines, bays}` */
export const mockHeatmap: HeatmapResponse = (() => {
  const bays = Array.from({ length: 16 }, (_, i) => {
    const bayNo = i + 1;
    const lines = Math.round(180 * Math.exp(-i / 5)) + (i % 3 === 0 ? 40 : 5);
    return { bayId: 101 + i, zoneCode: "AMBS", aisleNo: 2, bayNo, lines };
  });
  return { center: "C1", days: 28, maxLines: Math.max(...bays.map((b) => b.lines)), bays };
})();

/** `GET /admin/slotting/golden-zone` 표본 — 라이브 대조: `{candidateBins, goldenBins, bays}` */
export const mockGoldenZone: GoldenZoneResponse = {
  center: "C1",
  goldenShare: 0.15,
  candidateBins: 320,
  goldenBins: 48,
  bays: [1, 2, 3].map((bayNo) => ({
    bayId: 100 + bayNo,
    zoneCode: "AMBS",
    aisleNo: 2,
    bayNo,
    goldenBinCount: 3,
    distanceM: 4 + bayNo,
  })),
};

/** 제안 항목 12개 — MOVE_IN 9(A상품을 골든존으로) + EVICT 3(그 목적지 C상품을 먼저 빼냄,
 * 정본 §15.6 규칙 3). seq 로 적용 순서를 고정한다. */
function buildMockItems(): ProposalItem[] {
  const items: ProposalItem[] = [];
  let seq = 1;
  for (let i = 0; i < 3; i++) {
    const bayNo = i + 1;
    items.push({
      itemId: 9000 + seq,
      seq: seq++,
      kind: "EVICT",
      productId: 1020 + i,
      gtin: `880000${String(1020 + i).padStart(7, "0")}`,
      productName: MOCK_PRODUCT_NAMES[20 + i],
      grade: "C",
      lines: 3 + i,
      sellerId: 1,
      sellerCode: MOCK_SELLERS[i % MOCK_SELLERS.length],
      lotId: 5000 + i,
      lotNo: `L-${5000 + i}`,
      qty: 12 + i,
      fromLocationCode: `AMBS-02-${String(bayNo).padStart(2, "0")}-03-01`,
      toLocationCode: `AMBS-02-${String(12 + bayNo).padStart(2, "0")}-03-01`,
      reason: "EVICT_C",
      selected: false,
      status: "PROPOSED",
      worker: null,
      completedAt: null,
    });
  }
  for (let i = 0; i < 9; i++) {
    const bayNo = (i % 3) + 1;
    items.push({
      itemId: 9000 + seq,
      seq: seq++,
      kind: "MOVE_IN",
      productId: 1000 + i,
      gtin: `880000${String(1000 + i).padStart(7, "0")}`,
      productName: MOCK_PRODUCT_NAMES[i],
      grade: "A",
      lines: Math.round(400 * Math.exp(-i / 6)) + 2,
      sellerId: 1,
      sellerCode: MOCK_SELLERS[i % MOCK_SELLERS.length],
      lotId: 4000 + i,
      lotNo: `L-${4000 + i}`,
      qty: 20 + i * 2,
      fromLocationCode: `AMBS-02-${String(9 + (i % 6)).padStart(2, "0")}-04-01`,
      toLocationCode: `AMBS-02-${String(bayNo).padStart(2, "0")}-03-01`,
      reason: "A_OUTSIDE_GOLDEN",
      selected: false,
      status: "PROPOSED",
      worker: null,
      completedAt: null,
    });
  }
  return items;
}

export function mockProposal(proposalId = 1): RelocationProposalDetail {
  const items = buildMockItems();
  return {
    proposalId,
    center: "C1",
    status: "DRAFT",
    itemCount: items.length,
    moveInCount: items.filter((i) => i.kind === "MOVE_IN").length,
    evictCount: items.filter((i) => i.kind === "EVICT").length,
    beforeM: null,
    afterM: null,
    beforeSec: null,
    afterSec: null,
    createdAt: "2026-09-14T09:00:00",
    appliedAt: null,
    items,
    skipped: [],
  };
}

export const mockProposals: RelocationProposalDetail[] = [mockProposal(1)];

/** 전후 비교 표본 — 라이브 대조: `diffPct` 양수가 개선(거리가 줄어든 비율) */
export const mockCompare: CompareProposalResponse = {
  proposalId: 1,
  center: "C1",
  before: { lines: 3120, aisles: 620, distanceM: 18420, timeSec: 40850 },
  after: { lines: 3120, aisles: 590, distanceM: 14180, timeSec: 32460 },
  diffPct: 23.0,
  timeDiffPct: 20.5,
  byBatch: Array.from({ length: 8 }, (_, i) => {
    const beforeM = 2100 + i * 120;
    const afterM = Math.round(beforeM * 0.77);
    const beforeSec = 4600 + i * 260;
    const afterSec = Math.round(beforeSec * 0.79);
    return {
      batchId: 500 + i,
      lines: 360 + i * 18,
      beforeM,
      afterM,
      beforeSec,
      afterSec,
      diffPct: Math.round(((beforeM - afterM) / beforeM) * 1000) / 10,
    };
  }),
};

/** `POST /admin/slotting/evaluate` 표본 — 제안이 아직 없을 때 "현재" 만 보여주는 자리 */
export const mockEvaluate = {
  center: "C1",
  totals: { batches: 8, ...mockCompare.before },
  byBatch: mockCompare.byBatch.map((b) => ({
    batchId: b.batchId,
    lines: b.lines,
    aisles: 3,
    distanceM: b.beforeM,
    timeSec: b.beforeSec,
  })),
};
