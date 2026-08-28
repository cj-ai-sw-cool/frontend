/* ═══════════════════════════════════════════════════════════════════════════
   분석 화면 — 창고 배치·재고 데이터

   ★ 원래 `warehouse-map.jsx` 안에 있던 것을 **꺼내 놓았다.** 규격별 재고 패널이 생기면서
     같은 숫자를 두 곳에서 쓰게 됐는데, 각자 복사해 두면 언젠가 지도와 패널이 서로 다른
     재고를 말하게 된다 — 그건 대시보드가 저지를 수 있는 가장 나쁜 종류의 오류다.
   ⚠️ 이 값들은 창고 화면(`/warehouse-win98`)에서 **복사해 온 것**이다. 이 저장소는 win98
      화면마다 `_components` 를 따로 갖는 것을 규칙으로 삼는다. 창고 쪽 규격이나 데이터를
      바꾸면 여기도 같이 바꿔야 한다 — 자동으로 따라오지 않는다.
   ═══════════════════════════════════════════════════════════════════════════ */

export const REAL_INV = {xs:[2515,3177,3404,4037,4251,4143,4651,5502,5356,5203,4756,3895,6017,4996,5027,5297,5836,5836,5537,5699,5776,5723,5485,5193,4963,5637,5637,5448,5727,5692,5293,5348,4718,4716,4015,4893,4725,4916,5945,6105,5621,5620,5602,5462,5508,5731,5931,5873,5693,5563,5446,5972,5276,5034,5136,5229,5424,5488,5247,5087,5032],s:[1284,1658,1586,2129,2296,2251,2633,3150,3093,3032,2894,2496,3479,3295,3335,3801,4051,4033,3912,3912,4012,3862,3755,3635,3560,3864,3864,3738,3938,4163,3988,4051,3935,4061,3773,3759,3822,3816,3873,3641,3421,3421,3575,3597,3622,3690,3727,3605,3658,3560,3521,3673,3388,3411,3359,3303,3402,3321,3295,3236,3196],m:[789,972,1019,1268,1351,1327,1451,1792,1766,1739,1680,1515,2101,1927,1919,1945,2106,2141,2090,2072,2099,2103,2047,1992,1934,2042,2041,1927,2175,2242,2174,2184,2089,2098,1977,1994,1971,1995,2095,1944,1855,1855,1878,1843,1852,1890,1963,1938,1893,1867,1846,1944,1812,1785,1785,1763,1852,1824,1825,1805,1806],l:[165,283,288,369,412,406,466,594,584,568,536,415,643,552,552,638,673,689,642,659,673,710,693,659,630,683,683,724,711,719,677,690,629,620,545,640,636,660,735,814,763,763,770,740,765,777,802,786,769,746,733,726,630,606,596,596,591,611,594,579,567],xxl:[43,58,44,57,73,68,101,116,108,100,93,46,67,21,21,32,14,26,15,12,20,17,6,9,26,77,77,77,133,141,119,126,96,101,60,92,69,76,117,124,98,98,99,107,121,121,120,103,80,75,69,99,109,104,98,102,104,103,92,85,80],xl:[17,20,12,3,14,9,9,12,16,15,13,12,16,11,13,15,22,16,12,12,25,33,31,29,24,46,46,48,51,49,47,50,47,49,29,22,28,30,39,49,38,38,44,44,44,46,39,33,28,24,27,29,27,23,23,20,14,13,9,13,9]};

export const INV_PEAK = {
  xs: Math.max(...REAL_INV.xs), s: Math.max(...REAL_INV.s), m: Math.max(...REAL_INV.m),
  l: Math.max(...REAL_INV.l), xl: Math.max(...REAL_INV.xl), xxl: Math.max(...REAL_INV.xxl),
};


/* 규격 정의 — w:한 변(m), h:높이(m), 실제 슬롯 치수 그대로
   ── 구역 색 ────────────────────────────────────────────────────────────────
   ★ 여섯 색을 **한 계열의 밝기 계단**으로 바꿨다. 전에는 금색·주홍·파랑·보라·분홍·하늘
     여섯이 서로 관계없는 색이었는데, A~F 는 사실 **크기 사다리**(극소→특대)다. 색이
     "무관하다"고 말하는데 실제로는 순서가 있으니 눈이 어긋났다. 계단으로 두면 색만 보고도
     어느 쪽이 큰 규격인지 읽힌다.
   ★ **F 만 색을 달리한다.** 그 구역은 `cold: true` — 냉장이라 성격 자체가 다르다. 여기서
     색이 갈리는 건 장식이 아니라 뜻이다.
   ★ 구역은 차갑게, 강조는 따뜻하게(`#FF8A2A`). 전에는 여섯이 다 최고 채도라 재생 버튼·
     슬라이더의 주황이 튈 자리가 없었다. 구역이 물러나야 강조가 강조로 보인다.
   ⚠️ 이 값은 2D 지도와 3D 뷰가 **같이 쓴다**(`z.g.color`). 같은 구역이 화면마다 다른 색이면
      오히려 헷갈리므로 한 곳에서만 정한다. */
export const GRADES = [
  { id: "xs", invKey: "xs", code: "A", name: "극소형", w: 0.30, h: 0.20, vol: "18,000", share: "63.4%", color: 0xA8C0E4, cols: 26, levels: 11, pairs: 4 },
  { id: "s",  invKey: "s",  code: "B", name: "소형",   w: 0.35, h: 0.30, vol: "36,750", share: "21.1%", color: 0x8FA9D2, cols: 18, levels: 8,  pairs: 3 },
  { id: "m",  invKey: "m",  code: "C", name: "중형",   w: 0.40, h: 0.40, vol: "64,000", share: "11.6%", color: 0x7792BF, cols: 14, levels: 6,  pairs: 2 },
  { id: "l",  invKey: "l",  code: "D", name: "대형",   w: 0.50, h: 0.40, vol: "100,000", share: "3.4%", color: 0x5F7BAB, cols: 11, levels: 5,  pairs: 2 },
  { id: "xl", invKey: "xl", code: "E", name: "특수",   w: 0.60, h: 0.60, vol: "216,000", share: "0.4%", color: 0x4A6595, cols: 9,  levels: 4,  pairs: 0, singles: 2 },
  { id: "cold", invKey: "xxl", code: "F", name: "특대형", w: 0.60, h: 0.60, vol: "575K~17M", share: "1.1%", color: 0x5FC2C8, cols: 9, levels: 3, pairs: 0, singles: 2, cold: true },
];

export const MAP_FONT = "'Malgun Gothic', '맑은 고딕', 'Apple SD Gothic Neo', sans-serif";

export const AISLE = 1.7, PAIR_GAP = 0.08, ZONE_GAP = 2.3;   // 3D 전용 PITCH_PAD 는 뺐다

export const CORRIDOR = 3.2;                       // 중앙 작업 통로 폭 (m)
export const ROWS = [["xs", "s", "m"], ["l", "xl", "cold"]]; // 뒷줄 / 앞줄

export function computeLayout() {
  const zones = [];
  const rowWidths = [];
  ROWS.forEach((ids, rowIdx) => {
    let cursor = 0;
    const rowZones = [];
    for (const id of ids) {
      const g = GRADES.find((x) => x.id === id);
      const depth = g.w, len = g.cols * g.w;
      const rackXs = [];
      let width = 0;
      if (g.pairs > 0) {
        const pairW = depth * 2 + PAIR_GAP;
        for (let p = 0; p < g.pairs; p++) {
          const x0 = p * (pairW + AISLE);
          rackXs.push(x0 + depth / 2, x0 + depth + PAIR_GAP + depth / 2);
        }
        width = g.pairs * pairW + (g.pairs - 1) * AISLE;
      } else {
        for (let s = 0; s < g.singles; s++) rackXs.push(s * (depth + AISLE) + depth / 2);
        width = g.singles * depth + (g.singles - 1) * AISLE;
      }
      const pad = g.cold ? 1.0 : 0;
      rowZones.push({ g, xLocal: cursor + pad, width, len, depth, rackXs, pad, row: rowIdx });
      cursor += width + ZONE_GAP + pad * 2;
    }
    const totalW = cursor - ZONE_GAP;
    rowWidths.push(totalW);
    const startX = -totalW / 2;
    for (const z of rowZones) {
      z.x0 = startX + z.xLocal;
      z.center = z.x0 + z.width / 2;
      z.racks = z.rackXs.map((rx) => z.x0 + rx);
      if (rowIdx === 0) {           // 뒷줄: 랙 끝이 통로 뒤편에 정렬
        z.zStart = -CORRIDOR / 2 - z.len;
        z.labelZ = -CORRIDOR / 2 + 0.95;   // 구역 문자는 통로 안쪽
      } else {                      // 앞줄: 랙 시작이 통로 앞편에 정렬
        z.zStart = CORRIDOR / 2;
        z.labelZ = z.zStart + z.len + 1.35; // 구역 문자는 입고장 쪽
      }
      zones.push(z);
    }
  });
  const backLen = Math.max(...zones.filter((z) => z.row === 0).map((z) => z.len));
  const frontLen = Math.max(...zones.filter((z) => z.row === 1).map((z) => z.len));
  return { zones, rowWidths, backLen, frontLen };
}


/** 그날의 규격별 재고 — 지도와 패널이 **같은 함수**를 써야 숫자가 어긋나지 않는다.
 *
 *  ⚠️ `occ` 를 0.015~0.99 로 가둔다. 0 이나 1 이 나오면 눈금이 통째로 비거나 꽉 차서,
 *     "데이터가 없다"와 "정말 비었다"가 구별되지 않는다.
 *  ⚠️ 총량은 **랙 수 x 단 x 열**로 그때그때 센다. 상수로 적어 두면 배치를 바꿨을 때
 *     칸 수만 늘고 분모는 그대로 남는다.
 */
export function gradeStats(day) {
  const layout = computeLayout();
  return layout.zones.map((z) => {
    const occ = Math.min(0.99, Math.max(0.015,
      (REAL_INV[z.g.invKey][day] / INV_PEAK[z.g.invKey]) * 0.95));
    const total = z.racks.length * z.g.levels * z.g.cols;
    return { g: z.g, occ, total, filled: Math.round(occ * total) };
  }).sort((a, b) => (a.g.code < b.g.code ? -1 : 1));
}
