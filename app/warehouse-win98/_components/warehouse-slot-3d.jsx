import React, { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from "three";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { createNetherPortal } from "./nether-portal";
import { createPackingStation } from "./packing-station";
import { createInboundSim, DEMO_ITEMS } from "./inbound-sim";
import { createSimAudio } from "./sim-audio";
import { createExterior, HAZE } from "./warehouse-exterior";
import InspectionRoom from "./inspection-room";

/* ─────────────────────────────────────────────────────────────
   시나리오 3 — 슬롯 창고 3D 대시보드 (2열 배치 + 중앙 작업 통로)
   실측 근거: 총용량 866.9㎥ · 사용률 21.7~68% (8/1~9/30, 61일)
   슬롯: 극소 30×30×20 / 소 35×35×30 / 중 40×40×40
         대 50×50×40 / 특수 60×60×60  (세 변 합 = 등급 상한)
   ───────────────────────────────────────────────────────────── */

const mulberry32 = (a) => () => {
  a |= 0; a = (a + 0x6D2B79F5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

/* ── 실측 물동량 데이터 (AI-Hub 29_물류공간 예측 · 2024-08-01 ~ 10-31, 영업일 61일) ── */
const REAL_DATES = ["2024-08-01", "2024-08-02", "2024-08-05", "2024-08-06", "2024-08-07", "2024-08-08", "2024-08-09", "2024-08-12", "2024-08-13", "2024-08-14", "2024-08-16", "2024-08-19", "2024-08-20", "2024-08-21", "2024-08-22", "2024-08-23", "2024-08-26", "2024-08-27", "2024-08-28", "2024-08-29", "2024-08-30", "2024-09-02", "2024-09-03", "2024-09-04", "2024-09-05", "2024-09-06", "2024-09-08", "2024-09-09", "2024-09-10", "2024-09-11", "2024-09-12", "2024-09-13", "2024-09-19", "2024-09-20", "2024-09-23", "2024-09-24", "2024-09-25", "2024-09-26", "2024-09-27", "2024-09-30", "2024-10-02", "2024-10-03", "2024-10-04", "2024-10-07", "2024-10-08", "2024-10-10", "2024-10-11", "2024-10-14", "2024-10-15", "2024-10-16", "2024-10-17", "2024-10-18", "2024-10-21", "2024-10-22", "2024-10-23", "2024-10-24", "2024-10-25", "2024-10-28", "2024-10-29", "2024-10-30", "2024-10-31"];
const REAL_USAGE = [21.67,29.46,29.92,37.49,40.77,39.88,45.2,55.44,54.51,53.25,50.33,42.12,61.7,54.76,54.99,60.25,64.8,65.29,62.33,63.02,64.53,65.08,63.18,60.63,58.44,64.01,64.0,63.46,66.42,67.98,64.64,65.55,61.21,61.6,55.37,59.82,59.61,60.9,66.4,67.16,62.82,62.82,63.96,62.63,63.62,65.08,66.73,65.3,64.2,62.56,61.7,64.01,57.57,56.17,55.87,55.59,56.78,56.91,55.72,54.66,53.94];
const REAL_IN = [640,1740,1000,2280,940,136,1624,2760,252,0,125,0,4940,0,780,1652,2300,460,0,780,960,2124,0,360,548,1996,0,1064,1840,1020,0,330,1860,1740,0,2020,860,680,1856,1026,0,0,658,480,368,810,928,660,472,54,74,1368,654,341,428,468,924,690,324,112,160];
const REAL_OUT = [827,385,815,770,406,329,517,905,495,266,810,1593,996,1521,715,791,1326,421,533,622,721,2281,431,860,928,784,1,1450,1067,749,708,179,2795,1609,1246,1019,1009,438,545,1153,881,1,485,655,249,466,601,904,689,340,267,567,1855,620,394,452,550,717,622,369,275];
const REAL_STOCK = [4813,6168,6353,7863,8397,8204,9311,11166,10923,10657,9972,8379,12323,10802,10867,11728,12702,12741,12208,12366,12605,12448,12017,11517,11137,12349,12348,11962,12735,13006,12298,12449,11514,11645,10399,11400,11251,11493,12804,12677,11796,11795,11968,11793,11912,12256,12583,12339,12122,11836,11643,12444,11243,10964,10998,11014,11388,11361,11063,10806,10691];
const REAL_INV = {xs:[2515,3177,3404,4037,4251,4143,4651,5502,5356,5203,4756,3895,6017,4996,5027,5297,5836,5836,5537,5699,5776,5723,5485,5193,4963,5637,5637,5448,5727,5692,5293,5348,4718,4716,4015,4893,4725,4916,5945,6105,5621,5620,5602,5462,5508,5731,5931,5873,5693,5563,5446,5972,5276,5034,5136,5229,5424,5488,5247,5087,5032],s:[1284,1658,1586,2129,2296,2251,2633,3150,3093,3032,2894,2496,3479,3295,3335,3801,4051,4033,3912,3912,4012,3862,3755,3635,3560,3864,3864,3738,3938,4163,3988,4051,3935,4061,3773,3759,3822,3816,3873,3641,3421,3421,3575,3597,3622,3690,3727,3605,3658,3560,3521,3673,3388,3411,3359,3303,3402,3321,3295,3236,3196],m:[789,972,1019,1268,1351,1327,1451,1792,1766,1739,1680,1515,2101,1927,1919,1945,2106,2141,2090,2072,2099,2103,2047,1992,1934,2042,2041,1927,2175,2242,2174,2184,2089,2098,1977,1994,1971,1995,2095,1944,1855,1855,1878,1843,1852,1890,1963,1938,1893,1867,1846,1944,1812,1785,1785,1763,1852,1824,1825,1805,1806],l:[165,283,288,369,412,406,466,594,584,568,536,415,643,552,552,638,673,689,642,659,673,710,693,659,630,683,683,724,711,719,677,690,629,620,545,640,636,660,735,814,763,763,770,740,765,777,802,786,769,746,733,726,630,606,596,596,591,611,594,579,567],xxl:[43,58,44,57,73,68,101,116,108,100,93,46,67,21,21,32,14,26,15,12,20,17,6,9,26,77,77,77,133,141,119,126,96,101,60,92,69,76,117,124,98,98,99,107,121,121,120,103,80,75,69,99,109,104,98,102,104,103,92,85,80],xl:[17,20,12,3,14,9,9,12,16,15,13,12,16,11,13,15,22,16,12,12,25,33,31,29,24,46,46,48,51,49,47,50,47,49,29,22,28,30,39,49,38,38,44,44,44,46,39,33,28,24,27,29,27,23,23,20,14,13,9,13,9]};
const CURVE = REAL_USAGE;
const REAL_DATE_LABEL = REAL_DATES.map((s) => {
  const [, mo, dd] = s.split("-");
  return `${+mo}월 ${+dd}일`;
});
const THRESHOLD = 65;
const TOTAL_CAP = 866.86;                    // 사용률·보관공간에서 역산한 실제 총용량
const FLOWS = { inn: REAL_IN, out: REAL_OUT };
/* 규격별 실측 재고 최대치 = 해당 구역의 슬롯 정원 기준 */
const INV_PEAK = {
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
const GRADES = [
  { id: "xs", invKey: "xs", code: "A", name: "극소형", w: 0.30, h: 0.20, vol: "18,000", share: "63.4%", color: 0xA8C0E4, cols: 26, levels: 11, pairs: 4 },
  { id: "s",  invKey: "s",  code: "B", name: "소형",   w: 0.35, h: 0.30, vol: "36,750", share: "21.1%", color: 0x8FA9D2, cols: 18, levels: 8,  pairs: 3 },
  { id: "m",  invKey: "m",  code: "C", name: "중형",   w: 0.40, h: 0.40, vol: "64,000", share: "11.6%", color: 0x7792BF, cols: 14, levels: 6,  pairs: 2 },
  { id: "l",  invKey: "l",  code: "D", name: "대형",   w: 0.50, h: 0.40, vol: "100,000", share: "3.4%", color: 0x5F7BAB, cols: 11, levels: 5,  pairs: 2 },
  { id: "xl", invKey: "xl", code: "E", name: "특수",   w: 0.60, h: 0.60, vol: "216,000", share: "0.4%", color: 0x4A6595, cols: 9,  levels: 4,  pairs: 0, singles: 2 },
  { id: "cold", invKey: "xxl", code: "F", name: "특대형", w: 0.60, h: 0.60, vol: "575K~17M", share: "1.1%", color: 0x5FC2C8, cols: 9, levels: 3, pairs: 0, singles: 2, cold: true },
];

/* ── 2D 지도 글꼴 ────────────────────────────────────────────────────────────
   ★ `Gulim(굴림)` 을 쓰다가 바꿨다. 비트맵 시절 글꼴이라 요즘 화면에서 획이 뭉개지고,
     어두운 배경 위 작은 한글은 특히 안 읽힌다. **맑은 고딕**은 힌팅이 살아 있어 같은
     크기에서도 또렷하다.
   ⚠️ 캔버스의 `font` 는 CSS 처럼 여러 글꼴을 나열해도 되지만, **따옴표와 순서를 지켜야**
      한다. 맥에는 맑은 고딕이 없으므로 애플 고딕을 다음 자리에 둔다.
   ⚠️ 캔버스는 `dpr` 로 확대해 그린다(아래 `ctx.scale`). 그래서 여기 크기는 **CSS 픽셀**
      기준이고, 고해상도 화면에서는 알아서 또렷해진다. */
const MAP_FONT = "'Malgun Gothic', '맑은 고딕', 'Apple SD Gothic Neo', sans-serif";

const AISLE = 1.7, PAIR_GAP = 0.08, ZONE_GAP = 2.3, PITCH_PAD = 0.09;

/* ── 출고 구역 ────────────────────────────────────────────────────────────────
   건물 **오른쪽 벽 안쪽**의 띠. 바로 바깥에 트럭 도크가 붙어 있어서, 랙에서 꺼낸 물건이
   여기 모였다가 문 너머 트럭으로 나간다 — 동선이 한 줄로 이어진다.
   ⚠️ 폭을 랙 바깥 여백보다 좁게 잡아야 한다. 랙은 x = ±(rowWidths/2) 까지 차 있고 바닥은
      거기서 5.5m 더 넓다. 아래 값(안쪽 끝 5.0m, 벽에서 0.5m)은 그 여백 안에 들어간다.
   ⚠️ 2D 지도·3D 바닥·3D 소품이 **같은 값**을 본다. 따로 적으면 하나만 옮겼을 때
      바닥칠과 파렛트가 어긋난다. */
const OUT_ZONE = {
  inner: 4.0,     // 랙 쪽 끝 (벽에서 안쪽으로 이만큼)
  outer: 0.35,    // 벽 쪽 끝
  halfLen: 8.6,   // z 방향 절반 길이
  /* 화물을 세우는 줄의 x. 벽에 붙여 둔다.
     ⚠️ AGV 순환 경로가 x = rowWidths/2 + 3.3 (약 14.1) 을 지난다. 화물을 구역 한가운데에
        놓으면 AGV 가 파렛트를 통과해 지나간다. 벽 쪽으로 1m 밀어 두면 AGV 는 화물과
        벽 사이가 아니라 **화물 앞을 지나가는 것**이 되어, 오히려 물건을 나르는 그림이 된다.
     ⚠️ 벽 안쪽 면이 floorW/2 - 0.15 이므로, 파렛트 폭(1.15)의 절반을 빼도 벽을 안 뚫는다. */
  stageOffset: 1.26,
};
/* ── 입고 구역 ────────────────────────────────────────────────────────────────
   건물 **왼쪽 벽 안쪽**의 짧은 띠. 출고 구역(오른쪽)과 짝을 이룬다 — 왼쪽으로 들어와
   랙에 들어갔다가 오른쪽으로 나간다는 흐름이 바닥만 봐도 읽힌다.
   ⚠️ 출고보다 짧게 잡는다. 왼쪽 벽 가운데(z = 0)에는 검수실 포탈이 서 있어서, z 범위를
      통로 앞쪽으로 밀어야 겹치지 않는다.
   ⚠️ 색은 **초록**이다. 주황(출고)과 같은 색을 쓰면 두 구역이 한 덩어리로 보이고,
      들어오는 곳과 나가는 곳이 구분되지 않는다. */
const IN_ZONE = { inner: 4.0, outer: 0.35, z0: 2.2, z1: 9.6, stageOffset: 1.3 };
const inZone = (floorW) => ({
  x0: -floorW / 2 + IN_ZONE.outer,
  x1: -floorW / 2 + IN_ZONE.inner,
  z0: IN_ZONE.z0,
  z1: IN_ZONE.z1,
});

const outZone = (floorW, floorCz) => ({
  x0: floorW / 2 - OUT_ZONE.inner,
  x1: floorW / 2 - OUT_ZONE.outer,
  z0: floorCz - OUT_ZONE.halfLen,
  z1: floorCz + OUT_ZONE.halfLen,
});
const CORRIDOR = 3.2;                       // 중앙 작업 통로 폭 (m)
const GUARD_H = 0.5;                        // 랙 끝 기둥 코너 가드 높이 (m)
const HANG_Y = 3.4;                         // 통로 로케이션 행거 판 높이 (m)
const HANG_TOP = 5.4;                       // 행거 줄이 매달린 천장 높이 (m)
const ROWS = [["xs", "s", "m"], ["l", "xl", "cold"]]; // 뒷줄 / 앞줄

function computeLayout() {
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


/* ── 바닥 텍스처 ──────────────────────────────────────────────────────────
   ★ 어두운 콘크리트(#23282e)에서 **밝은 회색 에폭시 타일**로 바꿨다. 검수실 바닥과 같은
     요리법이다 — 두 공간이 한 건물이려면 발밑이 같아야 한다.
   ★ 격자는 두 겹: 1m 타일 줄눈(가늘고 연하게)과 2m 기준선(굵고 진하게). 한 겹만 두면
     밋밋하거나 지나치게 촘촘하다.
   ⚠️ 바닥이 밝아진 만큼 **위에 얹는 것들의 색을 전부 뒤집어야 한다.** 예전에는 흰색
      반투명으로 그리던 격자·차선 글자·화살표가, 밝은 바닥에서는 아무것도 안 보인다.
      어두운 색으로 바꾸고, 노란 안전선처럼 원래 진한 것만 그대로 둔다.
   ⚠️ 구역 바닥칠은 색코드에 알파를 이어 붙여 쓴다(`col + "1c"`). 밝은 바닥에서는 그 정도
      알파로는 안 보여서 더 진하게 올렸다. */
function makeFloorTexture(layout, floorW, floorD, floorCz) {
  /* 바닥 끝(앞마당 바깥) — 아래 바닥 로고가 설 자리를 잡는 데 쓴다 */
  const zMaxLocal = floorCz + floorD / 2;
  const W = 2048, H = Math.round((floorD / floorW) * 2048);
  const cv = document.createElement("canvas");
  cv.width = W; cv.height = H;
  const c = cv.getContext("2d");
  const rng = mulberry32(99);

  const u = (x) => ((x + floorW / 2) / floorW) * W;
  const v = (z) => ((z - floorCz + floorD / 2) / floorD) * H;
  const PPM = W / floorW;

  c.fillStyle = "#9AA0A8";
  c.fillRect(0, 0, W, H);

  /* 1m 타일 — 타일마다 아주 조금씩 밝기를 달리한다. 완전히 같으면 타일이 아니라
     격자를 인쇄한 한 장으로 보인다 */
  for (let tx = Math.floor(-floorW / 2); tx < floorW / 2; tx += 1) {
    for (let tz = Math.floor(floorCz - floorD / 2); tz < floorCz + floorD / 2; tz += 1) {
      const n = (Math.sin(tx * 12.9898 + tz * 78.233) * 43758.5453) % 1;
      const g = 150 + Math.round(Math.abs(n) * 12);
      c.fillStyle = `rgb(${g},${g + 5},${g + 12})`;
      c.fillRect(u(tx), v(tz), PPM, PPM);
    }
  }

  // 에폭시 반점 — 밝은 알갱이와 어두운 알갱이를 섞는다
  for (let i = 0; i < 7000; i++) {
    c.fillStyle = i % 2 === 0
      ? `rgba(70,76,86,${0.05 + rng() * 0.12})`
      : `rgba(255,255,255,${0.05 + rng() * 0.14})`;
    c.fillRect(rng() * W, rng() * H, 1 + rng() * 2.6, 1 + rng() * 2.6);
  }

  // 1m 줄눈
  c.strokeStyle = "rgba(96,104,116,0.42)"; c.lineWidth = 2;
  for (let x = -floorW / 2; x <= floorW / 2; x += 1) { c.beginPath(); c.moveTo(u(x), 0); c.lineTo(u(x), H); c.stroke(); }
  for (let z = floorCz - floorD / 2; z <= floorCz + floorD / 2; z += 1) { c.beginPath(); c.moveTo(0, v(z)); c.lineTo(W, v(z)); c.stroke(); }
  // 2m 기준선
  c.strokeStyle = "rgba(72,80,92,0.55)"; c.lineWidth = 4;
  for (let x = -floorW / 2; x <= floorW / 2; x += 2) { c.beginPath(); c.moveTo(u(x), 0); c.lineTo(u(x), H); c.stroke(); }
  for (let z = floorCz - floorD / 2; z <= floorCz + floorD / 2; z += 2) { c.beginPath(); c.moveTo(0, v(z)); c.lineTo(W, v(z)); c.stroke(); }

  /* 중앙 작업 통로 */
  const cTop = v(-CORRIDOR / 2), cBot = v(CORRIDOR / 2);
  c.fillStyle = "rgba(150,190,170,0.30)";
  c.fillRect(0, cTop, W, cBot - cTop);
  c.strokeStyle = "rgba(228,176,20,0.95)"; c.lineWidth = 9;
  c.beginPath(); c.moveTo(0, v(-CORRIDOR / 2 + 0.14)); c.lineTo(W, v(-CORRIDOR / 2 + 0.14)); c.stroke();
  c.beginPath(); c.moveTo(0, v(CORRIDOR / 2 - 0.14)); c.lineTo(W, v(CORRIDOR / 2 - 0.14)); c.stroke();
  c.strokeStyle = "rgba(56,64,76,0.45)"; c.lineWidth = 4; c.setLineDash([36, 30]);
  c.beginPath(); c.moveTo(0, v(0)); c.lineTo(W, v(0)); c.stroke();
  c.setLineDash([]);
  c.fillStyle = "rgba(48,56,68,0.62)";
  c.font = "800 40px 'Noto Sans KR', sans-serif";
  c.fillText("작업 통로", u(-floorW / 2 + 1.4), v(0.55));
  c.font = "900 44px 'JetBrains Mono', monospace";
  c.fillStyle = "rgba(48,56,68,0.42)";
  for (let ax = -floorW / 2 + 7; ax < floorW / 2 - 3; ax += 7.5) {
    c.fillText("→", u(ax), v(-0.55));
    c.fillText("←", u(ax + 3.6), v(0.75));
  }

  for (const z of layout.zones) {
    const col = "#" + z.g.color.toString(16).padStart(6, "0");
    c.fillStyle = col + "38";           // 밝은 바닥에서는 1c 로는 안 보인다
    c.fillRect(u(z.x0 - 0.35), v(z.zStart - 0.4), u(z.x0 + z.width + 0.35) - u(z.x0 - 0.35), v(z.zStart + z.len + 0.4) - v(z.zStart - 0.4));
    c.strokeStyle = col + "aa"; c.lineWidth = 4;
    c.strokeRect(u(z.x0 - 0.35), v(z.zStart - 0.4), u(z.x0 + z.width + 0.35) - u(z.x0 - 0.35), v(z.zStart + z.len + 0.4) - v(z.zStart - 0.4));
    /* 바닥에 찍힌 큰 구역 문자.
       ⚠️ 구역 색 그대로 쓰면 밝은 바닥에서 흐려진다(둘 다 밝은 색이라 대비가 없다).
          어두운 회청색으로 찍고 구역 색은 테두리에만 남긴다. */
    c.fillStyle = "rgba(52,62,78,0.55)";
    c.font = "900 100px 'Noto Sans KR', sans-serif";
    c.textAlign = "center";
    c.fillText(z.g.code, u(z.center), v(z.labelZ) + 34);
    c.textAlign = "left";
    if (z.g.cold) {
      const x1 = u(z.x0 - z.pad), x2 = u(z.x0 + z.width + z.pad);
      const y1 = v(z.zStart - z.pad), y2 = v(z.zStart + z.len + z.pad);
      c.save(); c.beginPath(); c.rect(x1, y1, x2 - x1, y2 - y1); c.clip();
      c.strokeStyle = "rgba(226,176,26,0.75)"; c.lineWidth = 10;
      for (let s = -floorD * 2; s < floorW; s += 0.9) { c.beginPath(); c.moveTo(u(s), y2 + 20); c.lineTo(u(s + 3), y1 - 20); c.stroke(); }
      c.restore();
      /* 냉장 구역 안쪽은 다시 바닥색으로 덮는다 — 빗금은 테두리 띠로만 남는다.
         예전에는 어두운 남색(#1d2b36cc)이었는데, 밝은 바닥에서 그러면 구멍처럼 보인다 */
      c.fillStyle = "#A6ADB6"; c.fillRect(x1 + 12, y1 + 12, x2 - x1 - 24, y2 - y1 - 24);
    }
  }

  /* ── 안전 표시 ─────────────────────────────────────────────────────────────
     ★ 구역 문자와 통로 화살표는 있었는데, **통로와 랙 사이가 아무 표시 없이** 만나고 있었다.
       실제 창고에서 그 지점이 가장 위험한 자리라(지게차와 사람이 직각으로 마주친다) 늘
       정지선과 횡단 표시가 그려져 있다. 그 한 줄이 바닥을 도면에서 현장으로 바꾼다.

     ⚠️ 통로 입구를 **랙 사이 간격에서 찾아낸다.** 통로 x 를 따로 적어 두면 규격을 바꿔
        랙이 늘거나 줄었을 때 정지선만 옛 자리에 남는다. 랙 좌표를 훑어 **깊이보다 넓게
        벌어진 곳**을 통로로 본다 — 쌍 안쪽 간격(PAIR_GAP)은 좁아서 안 걸린다.
     ⚠️ 구역 칠 **뒤에** 그린다. 앞서 그리면 구역 사각형이 정지선을 덮는다. */
  for (const z of layout.zones) {
    const mouth = z.row === 0 ? v(-CORRIDOR / 2 + 0.1) : v(CORRIDOR / 2 - 0.1);
    const inward = z.row === 0 ? -1 : 1;   // 랙이 뻗어 나가는 쪽

    for (let i = 0; i < z.racks.length - 1; i += 1) {
      const gap = z.racks[i + 1] - z.racks[i];
      if (gap < z.depth * 1.5) continue;   // 쌍 안쪽 — 통로가 아니다
      const cx = (z.racks[i] + z.racks[i + 1]) / 2;
      const half = (gap - z.depth) / 2 - 0.05;

      /* 정지선 — 통로 입구를 가로지르는 굵은 노란 띠.
         ⚠️ 두께를 픽셀로 적지 않고 **미터에서 환산한다**(`PPM`). 바닥 텍스처는 창고 폭에
            맞춰 늘어나므로, 픽셀로 박아 두면 창고가 커질 때 선만 가늘어진다. */
      c.fillStyle = "rgba(228,176,20,0.9)";
      c.fillRect(u(cx - half), mouth, u(cx + half) - u(cx - half), PPM * 0.14);

      /* 횡단 표시 — 통로 입구에서 랙 쪽으로 뻗는 흰 빗살.
         ⚠️ 통로를 **가로질러** 긋지 않는다. 여기서 건너는 것은 통로가 아니라 랙 사이로
            들어가는 길이고, 통로를 가로지르는 빗살은 지게차가 서야 할 자리를 덮는다. */
      c.fillStyle = "rgba(240,244,250,0.55)";
      for (let k = 0; k < 5; k += 1) {
        const zz = (z.row === 0 ? -CORRIDOR / 2 : CORRIDOR / 2) + inward * (0.28 + k * 0.34);
        c.fillRect(u(cx - half), v(zz), u(cx + half) - u(cx - half), PPM * 0.12);
      }
    }
  }

  /* ── 앞마당 바닥 로고 ──────────────────────────────────────────────────────
     ★ 앞줄 랙과 하역 라인 사이 6.5m 가 통째로 비어 있었다. 실제 물류센터는 그 자리에 브랜드
       도장을 크게 찍어 둔다 — 바닥 도장은 장식이 아니라 "여기가 누구 창고인가"를 말한다.
     ⚠️ 글자 크기를 **미터에서 환산한다**(`PPM`). 픽셀로 박으면 창고가 커질 때 글자만 작아진다.
     ⚠️ 바닥은 에폭시라 도장이 **완전히 불투명하지 않다.** 알파를 낮춰 타일 줄눈이 비쳐야
        칠한 것으로 보인다 — 꽉 채우면 스티커를 붙인 것 같다. */
  {
    const cz = (CORRIDOR / 2 + layout.frontLen + zMaxLocal) / 2;
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.fillStyle = "rgba(40,58,86,0.30)";
    c.font = `700 ${Math.round(PPM * 0.62)}px 'Noto Sans KR', sans-serif`;
    c.fillText("모두를 위한 단 하나의 배송", u(0), v(cz - 0.95));

    /* ── 오네 로고 마크 ────────────────────────────────────────────────
       ★ 글자 옆에 마크를 같이 찍는다 (사용자 요청). 브랜드 도장은 글자만 있으면 안내문이고,
         마크가 붙어야 로고가 된다.
       ⚠️ 마크와 글자를 **한 덩어리로 가운데 정렬**한다. 글자만 가운데 두고 마크를 왼쪽에
          덧붙이면 덩어리 전체가 오른쪽으로 밀려, 앞마당 한가운데가 아니게 된다. 그래서
          둘의 폭을 먼저 재고 시작점을 계산한다.
       ⚠️ 바닥 도장이라 **알파를 낮춘다.** 다른 도장(글자)이 0.30~0.34 인데 마크만 진하면
          같은 페인트로 안 보인다. 조금만 높게(0.44) 둔 것은 마크가 면이라 글자보다 옅게
          보이기 때문이다. */
    const MARK = PPM * 2.05, GAP = PPM * 0.55;
    c.font = `900 ${Math.round(PPM * 1.75)}px 'Noto Sans KR', sans-serif`;
    const tw = c.measureText("오네 (O-NE)").width;
    const x0 = u(0) - (MARK + GAP + tw) / 2;
    const my = v(cz + 0.75) - MARK / 2;
    {
      const S = MARK, x = x0, y = my;
      c.save();
      c.globalAlpha = 0.44;
      /* 타일 — 왼쪽 위·아래 모서리를 비스듬히 잘라 낸 사각형. 시안(왼아래)에서
         파랑(오른위)으로 넘어간다 */
      const g = c.createLinearGradient(x, y + S, x + S, y);
      g.addColorStop(0, "#20C6EA");
      g.addColorStop(1, "#1B5CE0");
      c.beginPath();
      c.moveTo(x + S * 0.24, y);
      c.lineTo(x + S, y);
      c.lineTo(x + S, y + S);
      c.lineTo(x + S * 0.30, y + S);
      c.lineTo(x, y + S * 0.70);
      c.lineTo(x, y + S * 0.24);
      c.closePath();
      c.fillStyle = g;
      c.fill();

      /* 검은 글자·기호는 타일에서 파낸 것처럼 보여야 한다 — 같은 알파 안에서 위에 얹는다 */
      c.fillStyle = "#0B1016";
      // O — 왼쪽 위 고리
      c.beginPath();
      c.arc(x + S * 0.30, y + S * 0.30, S * 0.175, 0, Math.PI * 2);
      c.arc(x + S * 0.30, y + S * 0.30, S * 0.085, 0, Math.PI * 2, true);
      c.fill("evenodd");
      // 오른쪽 위 빗금
      c.beginPath();
      c.moveTo(x + S * 0.60, y + S * 0.30);
      c.lineTo(x + S * 0.86, y + S * 0.30);
      c.lineTo(x + S * 0.76, y + S * 0.42);
      c.lineTo(x + S * 0.50, y + S * 0.42);
      c.closePath();
      c.fill();
      // NE — 아래쪽
      c.textAlign = "center";
      c.font = `900 ${Math.round(S * 0.40)}px 'Arial Black', Arial, sans-serif`;
      c.fillText("NE", x + S * 0.55, y + S * 0.72);
      c.restore();
    }

    c.fillStyle = "rgba(24,86,180,0.34)";     // 오네 — 파란 강조
    c.textAlign = "left";
    c.font = `900 ${Math.round(PPM * 1.75)}px 'Noto Sans KR', sans-serif`;
    c.fillText("오네 (O-NE)", x0 + MARK + GAP, v(cz + 0.75));
  }

  /* ── 출고 구역 (오른쪽 벽 안쪽) ──
     ⚠️ 주황은 이 화면에서 '강조' 자리에 쓰는 색이다(재생 버튼·슬라이더). 바닥을 그 색으로
        가득 칠하면 강조가 강조로 안 보이므로, 농도를 낮추고 테두리로만 또렷하게 남긴다. */
  {
    const oz = outZone(floorW, floorCz);
    const ox0 = u(oz.x0), ox1 = u(oz.x1), oy0 = v(oz.z0), oy1 = v(oz.z1);
    c.fillStyle = "rgba(232,138,42,0.20)";
    c.fillRect(ox0, oy0, ox1 - ox0, oy1 - oy0);
    c.strokeStyle = "rgba(226,140,44,0.85)";
    c.lineWidth = 7;
    c.strokeRect(ox0, oy0, ox1 - ox0, oy1 - oy0);

    /* 칸 구분선 — 도크 문 수(2개)에 맞춰 셋으로 나눈다. 빈 사각형만 있으면 '구역'인지
       '색칠'인지 모르는데, 칸이 나뉘어 있으면 물건을 놓는 자리로 읽힌다 */
    c.strokeStyle = "rgba(226,140,44,0.4)";
    c.lineWidth = 4;
    for (let i = 1; i < 3; i++) {
      const yy = oy0 + ((oy1 - oy0) * i) / 3;
      c.beginPath(); c.moveTo(ox0, yy); c.lineTo(ox1, yy); c.stroke();
    }

    /* 글자는 띠를 따라 **세로로** 눕힌다. 폭 4.5m 짜리 띠에 가로로 쓰면 두 글자밖에
       안 들어간다 */
    c.save();
    c.translate((ox0 + ox1) / 2, (oy0 + oy1) / 2);
    c.rotate(-Math.PI / 2);
    c.textAlign = "center";
    c.fillStyle = "rgba(255,255,255,0.72)";
    c.font = "900 74px 'Noto Sans KR', sans-serif";
    c.fillText("출고 구역  ·  OUTBOUND DOCKS", 0, 26);
    c.restore();
    c.textAlign = "left";
  }

  /* ── 입고 구역 (왼쪽 벽 안쪽) ── */
  {
    const iz = inZone(floorW);
    const ix0 = u(iz.x0), ix1 = u(iz.x1), iy0 = v(iz.z0), iy1 = v(iz.z1);
    c.fillStyle = "rgba(64,168,108,0.20)";
    c.fillRect(ix0, iy0, ix1 - ix0, iy1 - iy0);
    c.strokeStyle = "rgba(58,166,104,0.85)";
    c.lineWidth = 7;
    c.strokeRect(ix0, iy0, ix1 - ix0, iy1 - iy0);
    c.strokeStyle = "rgba(58,166,104,0.4)";
    c.lineWidth = 4;
    for (let i = 1; i < 3; i++) {
      const yy = iy0 + ((iy1 - iy0) * i) / 3;
      c.beginPath(); c.moveTo(ix0, yy); c.lineTo(ix1, yy); c.stroke();
    }
    /* 글자는 띠를 따라 세로로 눕힌다. 출고 쪽과 **반대로** 돌려야 두 글자가 서로
       마주 보지 않고 같은 방향(건물 안쪽)을 향한다 */
    c.save();
    c.translate((ix0 + ix1) / 2, (iy0 + iy1) / 2);
    c.rotate(Math.PI / 2);
    c.textAlign = "center";
    c.fillStyle = "rgba(255,255,255,0.72)";
    c.font = "900 66px 'Noto Sans KR', sans-serif";
    c.fillText("입고 구역  ·  INBOUND", 0, 26);
    c.restore();
    c.textAlign = "left";
  }

  /* 하역 라인 (앞줄 너머) */
  const inZ = CORRIDOR / 2 + layout.frontLen + 1.7;
  c.strokeStyle = "rgba(214,108,20,0.8)"; c.lineWidth = 7; c.setLineDash([46, 30]);
  c.beginPath(); c.moveTo(u(-floorW / 2 + 2), v(inZ)); c.lineTo(u(floorW / 2 - 2), v(inZ)); c.stroke();
  c.setLineDash([]);
  c.fillStyle = "rgba(52,62,78,0.42)";
  c.font = "900 60px 'JetBrains Mono', monospace";
  c.fillText("UNLOADING  하역 라인  →", u(-11.5), v(inZ + 1.5));

  const tex = new THREE.CanvasTexture(cv);
  /* ⚠️ 바닥이 밝아지면 이음매의 계단현상(모아레)이 눈에 띈다. 비스듬히 보이는 먼 바닥의
     줄눈이 지글거리지 않게 필터링을 4 -> 8 로 올린다. */
  tex.anisotropy = 8;
  return tex;
}

/* ── 좀비화 피글린 ────────────────────────────────────────────────────────────
   창고의 작업자와 지게차 운전자를 마인크래프트 좀비화 피글린으로 바꿨다 (사용자 요청).

   ★ 앞서 있던 `buildWorker`(CJ풍 근무복)와 **같은 것을 돌려준다** — `{ grp, lLeg, rLeg,
     lArm, rArm, hasCart, hasDevice, armRest }`. 걷기·정차·스캔 동작을 굴리는 틱 코드는
     그대로 두고 겉모습만 바꾸기 위해서다. 손잡이가 같으면 갈아 끼우는 것으로 끝난다.
     ⚠️ `buildWorker` 는 지웠다. 되살리려면 git 이력에서 꺼내 이 함수 자리에 두고 아래
        두 호출만 바꾸면 된다 — 쓰지 않는 200줄을 남겨 두면 어느 쪽이 진짜인지 헷갈린다.
   ★ 비율은 마인크래프트 그대로다(머리 8 · 몸통 8×12×4 · 팔다리 4×12×4 픽셀). 1픽셀을
     1/16m 로 두면 키가 2m 라 창고에서 조금 커서, 그룹째 0.86 으로 줄인다.
   ⚠️ 팔다리는 **관절 자리에 그룹을 두고 그 안에 메시를 내려 단다.** 메시를 직접 돌리면
      가운데를 축으로 돌아 다리가 몸을 뚫는다 — 축은 어깨와 골반에 있어야 한다.
   ⚠️ 초록 썩은 자국은 살보다 **아주 조금 크게** 겹쳐 놓는다. 같은 크기면 두 면이 정확히
      겹쳐서 어느 쪽이 앞인지 매 프레임 달라지고, 그 깜빡임(z-fighting)이 눈에 띈다. */
/* ── CJ대한통운 안전조끼 ──────────────────────────────────────────────
   ★ 출고장 작업자에게 조끼를 입힌다 (사용자 요청). 실제 현장에서 작업자는 반드시 반사
     조끼를 입고, 파란 조끼에 옆구리 빨강·노랑 띠가 CJ대한통운을 한눈에 알아보게 한다.
   ⚠️ 재질을 **한 번만 만들어 돌려쓴다.** 피글린마다 캔버스 세 장을 새로 구우면 작업자가
      늘어날 때마다 텍스처가 그만큼 GPU 로 올라간다. 무늬가 개체마다 다를 이유도 없다.
   ⚠️ 처음 부를 때 만든다. 모듈이 읽히는 시점에 `document` 를 만지면 서버 렌더에서 터진다.
   ⚠️ 상자 면 순서는 [+x, -x, +y, -y, +z, -z] 다. 옆면 둘에 반사 띠, 앞면에 지퍼와 주머니,
      뒷면에 이름을 넣는다 — 순서를 흐트러뜨리면 등판 글씨가 옆구리로 간다. */
let vestMats = null;
function getVestMaterials() {
  if (vestMats !== null) return vestMats;
  const BLUE = "#1E82C8", DEEP = "#1568A6", RED = "#DC3B2C", YEL = "#F2B01E";
  const paint = (size, draw) => {
    const cv = document.createElement("canvas");
    cv.width = cv.height = size;
    const c = cv.getContext("2d");
    c.fillStyle = BLUE;
    c.fillRect(0, 0, size, size);
    draw(c, size);
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return new THREE.MeshLambertMaterial({ map: tex });
  };

  /* 옆구리 — 세로 반사 띠. 이 띠가 조끼를 조끼로 보이게 하는 유일한 신호다 */
  const side = paint(64, (c, n) => {
    c.fillStyle = RED; c.fillRect(n * 0.30, 0, n * 0.16, n);
    c.fillStyle = YEL; c.fillRect(n * 0.50, 0, n * 0.16, n);
  });

  /* 앞면 — 가운데 지퍼와 가슴/허리 주머니 */
  const front = paint(128, (c, n) => {
    c.fillStyle = DEEP;
    c.fillRect(n * 0.10, n * 0.42, n * 0.30, n * 0.26);   // 왼쪽 주머니
    c.fillRect(n * 0.60, n * 0.42, n * 0.30, n * 0.26);   // 오른쪽 주머니
    c.strokeStyle = "rgba(0,0,0,0.35)"; c.lineWidth = 3;
    c.strokeRect(n * 0.10, n * 0.42, n * 0.30, n * 0.26);
    c.strokeRect(n * 0.60, n * 0.42, n * 0.30, n * 0.26);
    c.fillStyle = "#123F63";
    c.fillRect(n * 0.485, 0, n * 0.03, n);               // 지퍼
    c.fillStyle = "#FFFFFF";
    c.font = `700 ${Math.round(n * 0.12)}px 'Malgun Gothic', sans-serif`;
    c.textAlign = "center"; c.textBaseline = "middle";
    c.fillText("CJ", n * 0.26, n * 0.22);
  });

  /* 뒷면 — 이름. 등판이 제일 넓어 글씨가 들어갈 자리는 여기뿐이다 */
  const back = paint(128, (c, n) => {
    c.fillStyle = "#FFFFFF";
    c.textAlign = "center"; c.textBaseline = "middle";
    c.font = `700 ${Math.round(n * 0.15)}px 'Malgun Gothic', sans-serif`;
    c.fillText("CJ", n * 0.5, n * 0.36);
    c.font = `700 ${Math.round(n * 0.11)}px 'Malgun Gothic', sans-serif`;
    c.fillText("대한통운", n * 0.5, n * 0.54);
  });

  const plain = new THREE.MeshLambertMaterial({ color: 0x1E82C8 });
  vestMats = [side, side, plain, plain, front, back];
  return vestMats;
}

function buildPiglin({ cart = true, device = false, seated = false, vest = false } = {}) {
  const grp = new THREE.Group();
  const skin = new THREE.MeshLambertMaterial({ color: 0xEA9393 });
  const snoutM = new THREE.MeshLambertMaterial({ color: 0xD57E7E });
  const rot = new THREE.MeshLambertMaterial({ color: 0x5E8B45 });
  const bone = new THREE.MeshLambertMaterial({ color: 0xD9D9D2 });
  const tunic = new THREE.MeshLambertMaterial({ color: 0x7A5A38 });
  const belt = new THREE.MeshLambertMaterial({ color: 0x4A3722 });
  const dark = new THREE.MeshLambertMaterial({ color: 0x22262B });

  const P = 0.0625; // 마인크래프트 1픽셀
  const mk = (geo, mat, x, y, z, parent = grp) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  };

  /* ── 다리 ── */
  const legGeo = new THREE.BoxGeometry(4 * P, 12 * P, 4 * P);
  const lLeg = new THREE.Group(); lLeg.position.set(-2 * P, 12 * P, 0); grp.add(lLeg);
  mk(legGeo, tunic, 0, -6 * P, 0, lLeg);
  mk(new THREE.BoxGeometry(4.2 * P, 3 * P, 4.2 * P), rot, 0, -9 * P, 0, lLeg);
  const rLeg = new THREE.Group(); rLeg.position.set(2 * P, 12 * P, 0); grp.add(rLeg);
  mk(legGeo, tunic, 0, -6 * P, 0, rLeg);

  /* ── 몸통 — 살 위에 갈색 튜닉을 덧입힌다 ── */
  mk(new THREE.BoxGeometry(8 * P, 12 * P, 4 * P), skin, 0, 18 * P, 0);
  mk(new THREE.BoxGeometry(8.3 * P, 8 * P, 4.3 * P), tunic, 0, 16 * P, 0);
  /* 조끼는 튜닉 **위에** 한 겹 더 씌운다 (8.3 → 8.7). 같은 크기로 두면 두 면이 같은
     깊이라 z-파이팅으로 얼룩진다. 어깨선(19P)에서 허리(14.5P)까지만 덮어 조끼로 보이게 한다 */
  if (vest) {
    mk(new THREE.BoxGeometry(8.7 * P, 9 * P, 4.7 * P), getVestMaterials(), 0, 16.6 * P, 0);
  }
  mk(new THREE.BoxGeometry(8.5 * P, 1.6 * P, 4.5 * P), belt, 0, 12.6 * P, 0);
  // 가슴께 썩은 자국
  mk(new THREE.BoxGeometry(3 * P, 3 * P, 4.4 * P), rot, -1.5 * P, 22 * P, 0);

  /* ── 팔 ──
     `armRest` 는 원본 작업자와 같은 규칙이다: 카트를 밀면 앞으로 뻗고, 단말을 들면 조금
     들고, 맨손이면 거의 내린다. 틱이 이 값을 기준으로 흔든다 */
  const armGeo = new THREE.BoxGeometry(4 * P, 12 * P, 4 * P);
  const armRest = cart ? -1.0 : device ? -0.15 : -0.05;
  const lArm = new THREE.Group(); lArm.position.set(-6 * P, 23 * P, 0); grp.add(lArm);
  mk(armGeo, skin, 0, -6 * P, 0, lArm);
  mk(new THREE.BoxGeometry(4.2 * P, 3.5 * P, 4.2 * P), rot, 0, -3 * P, 0, lArm);
  lArm.rotation.x = armRest;
  const rArm = new THREE.Group(); rArm.position.set(6 * P, 23 * P, 0); grp.add(rArm);
  mk(armGeo, skin, 0, -6 * P, 0, rArm);
  // 오른팔은 뼈가 드러났다 — 좀비화의 표시
  mk(new THREE.BoxGeometry(4.2 * P, 4 * P, 4.2 * P), bone, 0, -9 * P, 0, rArm);
  rArm.rotation.x = device ? -0.85 : armRest;

  /* ── 머리 ── */
  const head = new THREE.Group(); head.position.set(0, 24 * P, 0); grp.add(head);
  mk(new THREE.BoxGeometry(8 * P, 8 * P, 8 * P), skin, 0, 4 * P, 0, head);
  // 드러난 두개골 — 왼쪽 반만
  mk(new THREE.BoxGeometry(4.2 * P, 5 * P, 8.2 * P), bone, -2 * P, 5 * P, 0, head);
  // 주둥이 (앞면 +z)
  mk(new THREE.BoxGeometry(5 * P, 3 * P, 1.5 * P), snoutM, 0, 3 * P, 4.5 * P, head);
  mk(new THREE.BoxGeometry(1 * P, 1 * P, 0.6 * P), dark, -1.2 * P, 3.4 * P, 5.3 * P, head);
  mk(new THREE.BoxGeometry(1 * P, 1 * P, 0.6 * P), dark, 1.2 * P, 3.4 * P, 5.3 * P, head);
  // 눈
  mk(new THREE.BoxGeometry(1.6 * P, 1 * P, 0.6 * P), dark, -2 * P, 5.4 * P, 4.1 * P, head);
  mk(new THREE.BoxGeometry(1.6 * P, 1 * P, 0.6 * P), dark, 2 * P, 5.4 * P, 4.1 * P, head);
  // 귀 — 옆으로 늘어진 살덩이. 살짝 눕혀야 붙어 있는 것으로 보인다
  for (const s of [-1, 1]) {
    const ear = mk(new THREE.BoxGeometry(1.5 * P, 5 * P, 3 * P), skin, s * 4.6 * P, 4 * P, 0, head);
    ear.rotation.z = s * 0.32;
  }

  if (device) {
    // 손에 든 스캐너 — 원본 작업자와 같은 소품
    mk(new THREE.BoxGeometry(0.09, 0.14, 0.04), dark, 0, -0.42, 0.05, rArm);
  }

  if (cart) {
    /* 밀고 다니는 손수레 — 원본 작업자의 것을 그대로 옮겼다. 이것까지 바꾸면 창고의
       다른 소품과 색이 어긋난다 */
    const cartG = new THREE.Group(); cartG.position.set(0, 0, 0.52); grp.add(cartG);
    const cb = new THREE.MeshLambertMaterial({ color: 0xC59A63 });
    mk(new THREE.BoxGeometry(0.5, 0.05, 0.72), dark, 0, 0.16, 0, cartG);
    const wheelGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.03, 10);
    for (const [wx, wz] of [[-0.2, 0.28], [0.2, 0.28], [-0.2, -0.28], [0.2, -0.28]]) {
      const w = mk(wheelGeo, dark, wx, 0.055, wz, cartG);
      w.rotation.z = Math.PI / 2;
    }
    mk(new THREE.CylinderGeometry(0.018, 0.018, 0.52, 8), dark, -0.2, 0.44, -0.34, cartG);
    mk(new THREE.CylinderGeometry(0.018, 0.018, 0.52, 8), dark, 0.2, 0.44, -0.34, cartG);
    const cross = mk(new THREE.CylinderGeometry(0.02, 0.02, 0.44, 8), dark, 0, 0.70, -0.34, cartG);
    cross.rotation.z = Math.PI / 2;
    const b1 = mk(new THREE.BoxGeometry(0.24, 0.20, 0.24), cb, -0.09, 0.29, 0.06, cartG); b1.rotation.y = 0.2;
    const b2 = mk(new THREE.BoxGeometry(0.18, 0.16, 0.18), cb, 0.12, 0.27, -0.10, cartG); b2.rotation.y = -0.3;
  }

  if (seated) {
    /* 앉은 자세 — 다리를 앞으로 접고 팔을 핸들 쪽으로 든다.
       ⚠️ 관절 그룹을 돌리는 것으로 끝난다. 자세용 모델을 따로 만들지 않는다 */
    lLeg.rotation.x = -Math.PI / 2;
    rLeg.rotation.x = -Math.PI / 2;
    lArm.rotation.x = -1.15;
    rArm.rotation.x = -1.15;
  }

  grp.scale.setScalar(0.86); // 키 2m → 약 1.72m
  return { grp, lLeg, rLeg, lArm, rArm, hasCart: cart, hasDevice: device, armRest };
}


/* ── 지게차 (승강 포크 + 적재 팔레트 + 경광등) ── */
function buildForklift() {
  const grp = new THREE.Group();
  const body = new THREE.MeshLambertMaterial({ color: 0xF0A81E });
  const dark = new THREE.MeshLambertMaterial({ color: 0x23272C });
  const steel = new THREE.MeshLambertMaterial({ color: 0x596470 });
  const seatM = new THREE.MeshLambertMaterial({ color: 0x2E3B4A });
  const mk = (geo, mat, x, y, z, parent = grp) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  };
  // 차체 + 카운터웨이트 + 엔진커버 + 시트
  mk(new THREE.BoxGeometry(1.02, 0.42, 1.5), body, 0, 0.5, -0.1);
  mk(new THREE.BoxGeometry(0.96, 0.5, 0.42), body, 0, 0.52, -0.92);
  mk(new THREE.BoxGeometry(0.9, 0.16, 0.7), dark, 0, 0.74, -0.35);
  mk(new THREE.BoxGeometry(0.42, 0.1, 0.4), seatM, 0, 0.86, -0.42);
  mk(new THREE.BoxGeometry(0.4, 0.34, 0.06), seatM, 0, 1.06, -0.6);
  const col = mk(new THREE.CylinderGeometry(0.025, 0.025, 0.4, 8), dark, 0, 0.95, -0.02);
  col.rotation.x = 0.6;
  const wheelHandle = mk(new THREE.CylinderGeometry(0.11, 0.11, 0.03, 12), dark, 0, 1.1, 0.08);
  wheelHandle.rotation.x = 0.6;
  // 오버헤드 가드 + 루프
  for (const [px, pz] of [[-0.42, 0.42], [0.42, 0.42], [-0.42, -0.78], [0.42, -0.78]]) {
    mk(new THREE.BoxGeometry(0.055, 1.0, 0.055), steel, px, 1.2, pz);
  }
  mk(new THREE.BoxGeometry(1.0, 0.06, 1.34), steel, 0, 1.73, -0.18);
  // 경광등
  const beacon = mk(new THREE.CylinderGeometry(0.06, 0.075, 0.12, 10),
    new THREE.MeshBasicMaterial({ color: 0xFF9A2A }), 0, 1.82, -0.18);
  // 마스트
  mk(new THREE.BoxGeometry(0.07, 1.95, 0.09), dark, -0.3, 1.0, 0.72);
  mk(new THREE.BoxGeometry(0.07, 1.95, 0.09), dark, 0.3, 1.0, 0.72);
  mk(new THREE.BoxGeometry(0.62, 0.06, 0.09), dark, 0, 1.9, 0.72);
  // 포크 (승강 그룹) — 백레스트 + 프롱 2개 + 적재 팔레트
  const forks = new THREE.Group(); forks.position.set(0, 0.12, 0); grp.add(forks);
  mk(new THREE.BoxGeometry(0.56, 0.3, 0.06), steel, 0, 0.18, 0.79, forks);
  mk(new THREE.BoxGeometry(0.1, 0.045, 0.95), steel, -0.2, 0.02, 1.28, forks);
  mk(new THREE.BoxGeometry(0.1, 0.045, 0.95), steel, 0.2, 0.02, 1.28, forks);
  const palM = new THREE.MeshLambertMaterial({ color: 0x8A6A42 });
  const cbM = new THREE.MeshLambertMaterial({ color: 0xC59A63 });
  mk(new THREE.BoxGeometry(0.95, 0.11, 0.95), palM, 0, 0.1, 1.28, forks);
  const fb1 = mk(new THREE.BoxGeometry(0.42, 0.34, 0.42), cbM, -0.14, 0.33, 1.2, forks); fb1.rotation.y = 0.15;
  const fb2 = mk(new THREE.BoxGeometry(0.3, 0.26, 0.3), cbM, 0.2, 0.29, 1.42, forks); fb2.rotation.y = -0.35;
  // 바퀴 (축을 x방향으로 미리 회전해 굴림 애니메이션 대비)
  const wheelGeo = new THREE.CylinderGeometry(0.22, 0.22, 0.16, 14);
  wheelGeo.rotateZ(Math.PI / 2);
  const wheels = [];
  for (const [wx, wz] of [[-0.5, 0.5], [0.5, 0.5], [-0.46, -0.75], [0.46, -0.75]]) {
    wheels.push(mk(wheelGeo, dark, wx, 0.22, wz));
  }
  return { grp, forks, wheels, beacon };
}

/* ── AGV (라운드 퍽 타입 — 흰 차체 + 대각 스트라이프 도장 + C자 LED + 턴테이블) ── */
function buildAGV({ tote = false } = {}) {
  const grp = new THREE.Group();
  const shell = new THREE.Group();
  shell.scale.set(1.12, 1, 0.88); // 타원형 풋프린트
  grp.add(shell);
  // 차체 도장 텍스처: 흰 바탕 + 대각 3색 스트라이프 + 다크 노즈 (u=0 seam이 전면 +z)
  const cv = document.createElement("canvas");
  cv.width = 1024; cv.height = 128;
  const c = cv.getContext("2d");
  c.fillStyle = "#F4F6F8"; c.fillRect(0, 0, 1024, 128);
  const stripe = (x0, w, col, skew) => {
    c.fillStyle = col;
    c.beginPath();
    c.moveTo(x0, 128); c.lineTo(x0 + w, 128);
    c.lineTo(x0 + w + skew, 0); c.lineTo(x0 + skew, 0);
    c.closePath(); c.fill();
  };
  stripe(150, 46, "#E23A3A", 74);   // 빨강
  stripe(208, 62, "#1E4FA3", 74);   // 파랑
  stripe(282, 30, "#F2B23E", 74);   // 노랑
  stripe(792, 30, "#F2B23E", -74);  // 반대측
  stripe(836, 50, "#1E4FA3", -74);
  c.fillStyle = "#232830";          // 다크 노즈 (전면)
  c.fillRect(0, 0, 94, 128);
  c.fillRect(930, 0, 94, 128);
  const bodyTex = new THREE.CanvasTexture(cv);
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.40, 0.45, 0.24, 28),
    [
      new THREE.MeshLambertMaterial({ map: bodyTex }),   // 측면 (도장)
      new THREE.MeshLambertMaterial({ color: 0xEDEFF2 }), // 상판
      new THREE.MeshLambertMaterial({ color: 0x1A1E24 }), // 하판
    ]
  );
  body.position.y = 0.19;
  shell.add(body);
  // 하부 스커트
  const skirt = new THREE.Mesh(
    new THREE.CylinderGeometry(0.43, 0.40, 0.09, 28),
    new THREE.MeshLambertMaterial({ color: 0x1A1E24 })
  );
  skirt.position.y = 0.055;
  shell.add(skirt);
  // 전면 C자형 LED 밴드
  const led = new THREE.Mesh(
    new THREE.CylinderGeometry(0.435, 0.468, 0.085, 20, 1, true, -0.85, 1.7),
    new THREE.MeshBasicMaterial({ color: 0x53E0FF, side: THREE.DoubleSide })
  );
  led.position.y = 0.155;
  shell.add(led);
  // 상단 회전 턴테이블 (검정, 이중 링 + 허브)
  const disc = new THREE.Group();
  disc.position.y = 0.335;
  shell.add(disc);
  const d1 = new THREE.Mesh(new THREE.CylinderGeometry(0.30, 0.30, 0.05, 24),
    new THREE.MeshLambertMaterial({ color: 0x15181D }));
  disc.add(d1);
  const d2 = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.075, 24),
    new THREE.MeshLambertMaterial({ color: 0x0E1013 }));
  d2.position.y = 0.03;
  disc.add(d2);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.09, 12),
    new THREE.MeshLambertMaterial({ color: 0x2E353D }));
  hub.position.y = 0.05;
  disc.add(hub);
  // 적재 토트 (옵션 — 턴테이블 위)
  if (tote) {
    const toteM = new THREE.MeshLambertMaterial({ color: 0x2E6FD8 });
    const t1 = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.26, 0.38), toteM);
    t1.position.y = 0.56; grp.add(t1);
    const t2 = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.05, 0.42), toteM);
    t2.position.y = 0.705; grp.add(t2);
    const cb = new THREE.MeshLambertMaterial({ color: 0xC59A63 });
    const tb = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.13, 0.19), cb);
    tb.position.set(0.05, 0.75, 0.02); tb.rotation.y = 0.4; grp.add(tb);
  }
  return { grp, led, disc };
}

/* ═══════════════════ 컴포넌트 ═══════════════════ */
/**
 * @param {{ initialTab?: "map" | "3d" }} props
 *   `initialTab` — 어느 판으로 열 것인가. 기본은 지도.
 *   ★ 분석 화면이 이 컴포넌트를 전체 화면으로 띄울 때 곧바로 3D 로 열기 위해 받는다.
 *     열고 나서 탭을 바꾸는 방법도 있지만, 그러면 지도가 한 프레임 그려졌다 사라져 깜빡인다.
 */
export default function WarehouseSlot3D({ initialTab = "map" }) {
  const mountRef = useRef(null);
  const apiRef = useRef(null);
  const [day, setDay] = useState(29);
  const [sel, setSel] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [stats, setStats] = useState(null);
  const [webglOk, setWebglOk] = useState(true);
  /* 'map' | '3d'.
     ★ 입고 화면에서 `?sim=1` 로 넘어왔으면 **처음부터 3D 로 연다.** 이 화면은 지도로 열리는데,
       지도 탭에 선 채로 시뮬레이션만 돌리면 적재 영상이 숨은 탭 뒤에서 혼자 끝난다 (3D 판은
       `display:none` 일 뿐 살아 있다).
     ⚠️ 효과 안에서 `setTab` 을 부르지 않는다. 첫 렌더가 지도로 한 번 그려진 뒤 3D 로 다시
        그려지는 낭비이고, 무엇보다 lint 가 막는다(effect 안의 동기 setState). 처음 값으로
        정하면 그런 일이 아예 없다.
     ⚠️ 초기화 함수 안에서 읽는다. 본문에서 바로 읽으면 렌더마다 주소를 다시 파싱한다. */
  const [tab, setTab] = useState(() => (
    typeof window !== "undefined"
      && new URLSearchParams(window.location.search).get("sim") === "1"
      ? "3d" : initialTab
  ));
  /* 하단 타임라인이 펼쳐져 있는가. 기본은 접힘 - 이 화면의 주인공은 3D 창고인데
     폭 640px 짜리 패널이 늘 아래를 가리고 있었다 */
  const [timelineOpen, setTimelineOpen] = useState(false);

  /* 포탈 - 툴팁과 검수실 표시. 툴팁 자리는 커서를 따라간다 */
  const [portalTip, setPortalTip] = useState(null); // { x, y } | null
  /* 검수실에 들어와 있는가.
     * 전에는 'none -> dive -> room -> back' 4단계였다. 카메라를 포탈로 밀어넣고 보라색
       막을 덮었다 걷는 연출이었는데, 들어가는 데 1.3초가 걸렸다. 자주 오가는 화면에서
       그만한 대기는 연출이 아니라 방해라서, 단계를 없애고 값 하나로 줄였다. */
  const [inRoom, setInRoom] = useState(false);
  /* 출고 작업대 화면을 코앞에서 들여다보고 있는가.
     ⚠️ 이 동안에는 화면에 겹쳐 둔 판을 다 감춘다. 카메라가 모니터를 가득 채우도록 다가가는데,
        마무리 카드가 그 위에 그대로 떠 있어 정작 보여 주려는 출고 화면을 가렸다. */
  const [atStation, setAtStation] = useState(false);
  /* 입고 적재 시뮬레이션이 돌고 있나 + 지금 무엇을 하고 있나(한 줄).
     ⚠️ 진행 상황을 **글자로도** 내보낸다. 로봇이 30m 를 가는 동안 눈이 그것을 놓치면
        화면이 멈춘 것처럼 보이는데, 글자가 따라가면 무슨 일이 일어나는지 계속 읽힌다. */
  const [simLine, setSimLine] = useState(null);
  /* 시뮬레이션이 화면을 잡고 있는가. 참이면 대시보드 패널을 다 감춘다.
     ★ 시연에서 이 화면은 **영상**이다 (사용자 요청). 양옆 패널과 아래 타임라인이 3D 를
       사방에서 잘라 먹고 있어서, 정작 보여 주려는 창고가 가운데 창문만큼만 남았다.
     ⚠️ `simLine` 으로 대신하지 않는다. 자막은 구간에 따라 잠깐씩 비는데(넘겨주는 사이),
        그때마다 패널이 깜빡이며 돌아온다. 시작과 끝에서만 바뀌는 값이 따로 있어야 한다. */
  const [simActive, setSimActive] = useState(false);
  /* 방금 슬롯에 넣은 것. 슬롯 **옆에 붙어 뜨는** 작은 팝업의 내용이다.
     ★ 넣고 나면 "그래서 어떻게 됐나"가 화면에 없었다 (사용자 제안). 어느 칸에 들어갔고
       그 구역이 얼마나 찼는지를 그 자리에서 말해 주면 적재가 숫자로 이어진다.
     ⚠️ **자리는 여기서 안 다룬다.** 팝업은 3D 안의 한 점을 따라다녀야 하는데, 그 좌표를
        상태로 두면 매 프레임 리액트가 다시 그린다. 내용만 상태로 두고, 자리는 아래 틱이
        DOM 을 직접 옮긴다. */
  /* 소리 손잡이와 켬/끔.
     ⚠️ 씬을 다시 만들 때마다 새로 만들면 안 된다 — `AudioContext` 는 브라우저가 몇 개까지만
        허락하고, 넘기면 그때부터 조용해진다. 화면이 사는 동안 한 벌만 쓴다.
     ⚠️ 기본값은 **켬**이다. 시연에서 소리가 필요하면 끄기보다 켜 두는 쪽이 안전하다 —
        발표 중에 조용하면 고장으로 보이지만, 시끄러우면 바로 끌 수 있다. */
  /* ⚠️ `useRef` 에 렌더 중 값을 넣으면 안 된다(리액트 규칙 — 렌더는 순수해야 하고,
     같은 렌더가 두 번 돌 수 있다). `useState` 의 **초기화 함수**는 딱 한 번만 불리므로
     여기에 맞는 자리다. */
  /* ★ 시뮬레이션 사운드 스위치. 곡은 `sim-audio.js` 에 따로 있다 — 여기서는 켜고 끄기만
       한다. 시연 자리에 따라 소리를 빼야 할 때가 있어서 한 줄로 남겨 두었다.
     ⚠️ 스위치를 여기 **하나만** 둔다. 호출부(start/stop/stow) 네 곳을 각각 주석 처리하면
        다시 켤 때 한 곳을 빠뜨리기 쉽고, 그러면 배경음 없이 효과음만 나는 상태가 된다. */
  const SIM_SOUND = true;
  const [audio] = useState(() =>
    (!SIM_SOUND || typeof window === "undefined" ? null : createSimAudio()));
  /* 방금 넣은 칸 — 자막 아래 열 게이지가 쓴다. 다음 건이 시작되면 시뮬레이션이 null 을
     보내 스스로 내려간다 (`inbound-sim` 의 `startNext` 참고) */
  const [placed, setPlaced] = useState(null);
  const simRunRef = useRef(null);      // 시뮬레이션을 시작하는 손잡이 (씬이 채운다)

  /* ── 입고 화면에서 넘어온 자동 시작 ──────────────────────────────
     ★ 입고 3건을 다 등록하면 입고 화면이 `?sim=1` 을 달고 이리로 보낸다 (사용자 요청).
       시연에서 입고와 적재는 한 장면이라, 도착해서 버튼을 한 번 더 누르면 흐름이 끊긴다.
     ⚠️ 씬이 다 만들어진 **뒤에야** 손잡이(`simRunRef`)가 채워진다. 이 효과가 씬 효과보다
        먼저 돌 수 있어서, 손잡이가 생길 때까지 짧게 지켜보다가 **한 번만** 부른다.
     ⚠️ 부르고 나면 주소에서 `?sim=1` 을 지운다. 안 지우면 새로고침할 때마다 처음부터
        다시 시작해서, 창고를 둘러보려는 순간마다 화면을 빼앗긴다.
     ⚠️ `useSearchParams` 대신 `window.location` 을 읽는다. 이 화면은 ssr:false 라 창이 늘
        있고, 훅을 쓰면 이 컴포넌트만을 위한 Suspense 경계를 세워야 한다. */
  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    if (new URLSearchParams(window.location.search).get("sim") !== "1") return undefined;
    /* 탭은 위 `useState` 초기화에서 이미 3D 로 잡혔다 — 여기서는 씬이 준비되기만 기다린다 */
    const t = window.setInterval(() => {
      if (!simRunRef.current) return;
      window.clearInterval(t);
      window.history.replaceState(null, "", window.location.pathname);
      simRunRef.current(DEMO_ITEMS);
    }, 120);
    return () => window.clearInterval(t);
  }, []);
  /* ⚠️ 원본의 시계(`clock`)를 뺐다. 작업표시줄에만 쓰던 값인데 그 표시줄을 걷어냈으니,
     남겨 두면 아무도 안 보는 값을 위해 인터벌만 돈다. */
  const mapWrapRef = useRef(null);
  const mapCanvasRef = useRef(null);
  const statsRef = useRef(null);  // 맵 캔버스가 읽는 최신 통계
  const simRef = useRef(null);    // 매 프레임 엔티티 위치 (3D 틱 → 2D 맵)

  /* ★ 포탈이 바깥에 알리는 두 가지를 **ref 로 받는다.** 씬을 만드는 useEffect 는 한 번만
       돌기 때문에, 그 안에서 지금의 상태 함수를 직접 부르면 처음 값에 붙박인다.
       ref 를 거치면 언제 불려도 최신 것이 불린다. */
  const rootRef = useRef(null);   // 툴팁 좌표를 이 상자 기준으로 되돌리는 데 쓴다
  /* 출고 작업대의 포스기를 누르면 실제 출고 화면으로 넘어간다.
     ★ `<a href>` 가 아니라 라우터를 쓴다. 3D 안의 물체라 링크를 걸 DOM 이 없기도 하고,
       `router.push` 는 클라이언트 전환이라 앱을 새로 내려받지 않는다(뒤로 가기도 된다). */
  const goPackingRef = useRef(null);
  /* 검수실이 열려 있는가. 씬을 만드는 effect 안의 키 처리기가 읽는다 —
     상태를 직접 잡으면 첫 값에 붙박이므로 ref 로 넘긴다 */
  const inRoomRef = useRef(false);
  const onEnterPortalRef = useRef(null);
  const onPortalHoverRef = useRef(null);
  const onStationFocusRef = useRef(null);

  /* 씬 쪽 손잡이를 최신 함수로 유지한다 (위 ref 설명 참고).
     ⚠️ 렌더 중에 ref 를 건드리면 안 된다 — 리액트가 화면을 그리는 도중에 바깥 값을 바꾸는
        셈이라, 같은 렌더가 두 번 돌 때(개발 모드의 이중 실행) 결과가 갈린다.
        의존성 없는 effect 에 두면 **그릴 것을 다 그린 뒤** 매번 갱신된다. */
  const router = useRouter();
  useEffect(() => { goPackingRef.current = () => router.push("/packing-win98"); }, [router]);
  /* 상태 함수는 리액트가 그대로 유지하므로 한 번만 걸어 두면 된다 */
  useEffect(() => { onStationFocusRef.current = setAtStation; }, []);

  /* 씬 쪽 손잡이를 최신 함수로 유지한다 (위 ref 설명 참고).
     ⚠️ 렌더 중에 ref 를 건드리면 안 된다 — 리액트가 화면을 그리는 도중에 바깥 값을 바꾸는
        셈이라, 같은 렌더가 두 번 돌 때(개발 모드의 이중 실행) 결과가 갈린다.
        의존성 없는 effect 에 두면 **그릴 것을 다 그린 뒤** 매번 갱신된다. */
  useEffect(() => {
    onPortalHoverRef.current = (hovered, x, y, w) => setPortalTip(hovered ? { x, y, w } : null);
    onEnterPortalRef.current = () => {
      if (inRoom) return;
      setPortalTip(null);   // 검수실이 덮으면 커서가 포탈에서 벗어나는 걸 못 보므로 손으로 지운다
      setInRoom(true);
    };
  });

  /* ── 씬 구성 (1회) ── */
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true });
      /* eslint-disable-next-line react-hooks/set-state-in-effect --
         WebGL 컨텍스트를 못 만들면 이 화면은 그릴 것이 없다. 그 사실을 알 수 있는 곳이
         여기뿐이라(생성 시도를 해 봐야 안다) 상태를 여기서 세운다. 렌더마다 도는 것도
         아니고 실패했을 때 한 번뿐이라 되풀이될 여지가 없다. */
    } catch { setWebglOk(false); return; }
    /* ── 그림자 ────────────────────────────────────────────────────────
       ★ 그림자를 켰다. 그전에는 로봇·지게차·트럭이 전부 바닥에 **떠 보였다** — 물건이
         땅에 놓여 있다는 것을 말해 주는 것은 조명이 아니라 그림자다.
       ⚠️ `PCFSoft` 를 쓴다. 기본(`BasicShadowMap`)은 계단이 그대로 보여서, 이 정도
          해상도에서는 그림자가 톱니로 보인다. */
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    renderer.setSize(Math.max(2, mount.clientWidth), Math.max(2, mount.clientHeight));
    /* ⚠️ 원본은 three r128 기준이라 `outputEncoding = sRGBEncoding` 이었다. r152 에서
       그 이름이 사라지고 `outputColorSpace = SRGBColorSpace` 로 바뀌었다.
       ★ three 를 0.128 로 내리지 않고 **이 한 줄만 고쳤다** — 출고 화면의 상자 뷰어가
         `SRGBColorSpace` 를 쓰고 있어서 버전을 내리면 그쪽이 깨진다. 이 파일이 쓰는
         r128 전용 API 는 이것 하나뿐이라, 두 화면이 같은 three 를 쓸 수 있다.
       ⚠️ r155 부터 조명이 물리 단위로 바뀌었다. 밝기가 원본과 다르면 광원 세기를
          조정하면 된다 — 코드가 깨지는 문제는 아니다. */
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    /* ★ 배경을 0x0c1117 -> 0x161E28 로 올렸다. 조명만 세게 하면 물건은 밝아져도
         빈 공간은 그대로 새까매서, 화면 전체는 여전히 어둡게 느껴진다. 배경이 바닥값을
         정하므로 여기부터 올려야 "밝아졌다"는 인상이 난다. */
    renderer.setClearColor(HAZE);
    mount.appendChild(renderer.domElement);
    renderer.domElement.style.touchAction = "none";

    const scene = new THREE.Scene();
    /* 안개도 같은 색이어야 먼 랙이 배경에 자연스럽게 녹는다.
       시작 거리를 52 -> 64 로 밀었다. 배경이 밝아진 만큼 안개가 일찍 먹으면
       중간 거리 랙까지 뿌옇게 날아간다. */
    /* 안개 색을 배경색이 아니라 **지평선 안개색**으로 바꿨다.
       바깥에 하늘과 산이 생기면서, 먼 물체가 잠겨야 할 곳은 검은 배경이 아니라
       해질녘 하늘 아래쪽이 되었다. 배경색으로 두면 먼 트럭이 하늘보다 어두워져
       허공에 구멍이 뚫린 것처럼 보인다.
       거리도 64~126 에서 70~210 으로 넓혔다. 이제 200m 밖까지 볼 것이 있다. */
    /* ⚠️ 안개는 **야적장 판의 끝을 지우는 용도**다. 배경 그림을 없앤 뒤로 마당 바깥은
       그냥 배경색이라, 안개가 없으면 포장이 허공에서 직사각형으로 뚝 끊긴다.
       거리를 55~115 로 잡은 근거: 건물 반대편 벽까지가 카메라에서 약 46m 라 그 안쪽은
       안개가 닿지 않고(랙이 뿌예지면 안 된다), 마당 모서리는 80~100m 라 충분히 녹는다.
       ⚠️ 안개 색은 `setClearColor` 와 **같은 값**이어야 한다. 어긋나면 마당 끝에 색 띠가
          남는다. 그래서 둘 다 `HAZE` 하나를 쓴다. */
    scene.fog = new THREE.Fog(HAZE, 55, 115);
    const camera = new THREE.PerspectiveCamera(46, Math.max(1, mount.clientWidth) / Math.max(1, mount.clientHeight), 0.1, 300);

    /* 조명 - 한낮
       ★ 원래는 야간 산업 조명이었다. 바깥을 한낮으로 바꾸면서 여기도 같이 올렸다 -
         창문 하나 없는 건물이라도 안팎 밝기가 어긋나면 눈이 먼저 안다.
       값을 고른 순서:
         1) 반구광을 가장 크게 올린다. 하늘색(위)과 땅색(아래)을 함께 넣어 주는 광원이라,
            한낮의 "사방에서 오는 빛"을 한 줄로 흉내낼 수 있다.
         2) 태양(dir)을 세게. 방향이 하나뿐이라 랙에 그림자 방향이 생기고, 그게 없으면
            아무리 밝아도 평평해 보인다.
         3) 앰비언트는 **덜** 올린다. 이건 방향이 없어서, 크게 주면 그림자가 통째로 지워져
            건물이 종이처럼 납작해진다. 어두운 구석을 겨우 들어올릴 만큼만.
         4) 천장 등은 오히려 **줄인다.** 대낮에도 창고 등은 켜져 있지만, 주광이 강해지면
            상대적으로 존재감이 사라지는 게 실제 모습이다. 그대로 두면 누런 얼룩만 남는다.
       ⚠️ r155+ 는 조명이 물리 단위다. 숫자만 두 배로 키운다고 밝기가 두 배가 되지 않으니
          위 순서대로 만진다. */
    scene.add(new THREE.AmbientLight(0x9fb4c8, 0.62));
    scene.add(new THREE.HemisphereLight(0xcfe6fa, 0x6d7a5e, 2.05));
    const dir = new THREE.DirectionalLight(0xfff6e2, 1.85);
    dir.position.set(28, 44, 20);
    scene.add(dir);
    /* ★ **이 빛만** 그림자를 만든다. 나머지(채움·천장등)까지 켜면 그림자가 여러 방향으로
         겹쳐 지저분해지고, 그림자 맵을 그 수만큼 더 그려야 한다.
       ⚠️ 그림자 카메라는 **직교**이고 범위를 손으로 잡아 줘야 한다. 기본값(±5m)은 창고
          한가운데 몇 미터만 덮어서, 나머지에서는 그림자가 뚝 끊긴다. 창고 바닥에 마당
          까지 더한 크기로 잡는다.
       ⚠️ 범위를 넓힐수록 같은 맵에 더 넓은 땅이 들어가 그림자가 흐려진다. 2048 로 약
          25px/m — 접지 그림자로는 이 정도가 한계다. 더 키우면 프레임을 깎아먹는다.
       ⚠️ `bias` 를 음수로 조금 준다. 안 주면 평평한 바닥이 자기 그림자에 얼룩진다
          (shadow acne). 너무 키우면 이번엔 그림자가 물체에서 떨어져 뜬다. */
    dir.castShadow = true;
    dir.shadow.mapSize.set(2048, 2048);
    dir.shadow.bias = -0.0009;
    dir.shadow.normalBias = 0.02;
    const fill = new THREE.DirectionalLight(0xcfe0f5, 0.45);   // 태양 반대편 채움
    fill.position.set(-20, 18, -16);
    scene.add(fill);
    const warmA = new THREE.PointLight(0xffdfae, 0.3, 52); warmA.position.set(-8, 6.4, -2); scene.add(warmA);
    const warmB = new THREE.PointLight(0xffdfae, 0.28, 52); warmB.position.set(9, 6.4, 3); scene.add(warmB);
    const corrL = new THREE.PointLight(0xfff6e0, 0.26, 36); corrL.position.set(0, 5.2, 0); scene.add(corrL);

    /** 이 가지 아래 모든 메시가 그림자를 드리우게 한다.
     *  ★ 그림자를 드리우는 것은 **움직이는 것들과 랙 골조뿐**이다. 씬 전체에 켜면 슬롯
     *    상자 4천 개까지 그림자 맵에 한 번 더 그려야 하는데, 그 상자들은 랙 안에 있어
     *    바닥까지 닿지도 않는다 — 값은 다 치르고 보이는 것은 없다.
     *  ⚠️ 만든 **직후에** 부른다. 나중에 자식이 더 붙으면 그것들은 안 걸린다. */
    const castAll = (root) => {
      root.traverse((o) => { if (o.isMesh) o.castShadow = true; });
      return root;
    };

    const layout = computeLayout();
    const zMin = -CORRIDOR / 2 - layout.backLen - 3.0;
    const zMax = CORRIDOR / 2 + layout.frontLen + 6.5;
    const floorW = Math.max(...layout.rowWidths) + 11;
    const floorD = zMax - zMin;
    const floorCz = (zMax + zMin) / 2;

    /* ── 네더 포탈 ────────────────────────────────────────────────────
       창고 **왼쪽 통로 끝**에 세운다. 작업 통로(z = 0)의 서쪽 끝이라 랙에 가리지 않고,
       카메라를 어디에 두어도 한 번은 눈에 들어온다.
       ⚠️ 바닥 가장자리에서 한 칸 안쪽(1.6m)에 둔다. 딱 끝에 세우면 바닥 밖으로 빛무리가
          삐져나가 허공에 떠 보인다.
       ⚠️ +x(창고 안쪽)를 보게 돌린다. 밖을 보면 소용돌이가 안 보인다. */
    const portal = createNetherPortal(THREE, {
      position: [-floorW / 2 + 1.6, 0, 0],
      rotationY: Math.PI / 2,
      scale: 1,
    });
    scene.add(portal.group);

    /* 바닥 */
    const floorTex = makeFloorTexture(layout, floorW, floorD, floorCz);
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(floorW, floorD),
      new THREE.MeshLambertMaterial({ map: floorTex })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.z = floorCz;
    floor.receiveShadow = true;
    scene.add(floor);

    /* 그림자 카메라를 바닥에 맞춘다 (위 `dir.castShadow` 주의 참고).
       ⚠️ 빛의 **목표**도 창고 가운데로 옮긴다. 기본 목표는 원점인데, 바닥이 z 로 치우쳐
          있어서 그대로 두면 그림자 범위가 창고 한쪽으로 쏠린다.
       ⚠️ 목표는 씬에 넣어야 행렬이 갱신된다. 넣지 않으면 위치를 바꿔도 빛이 안 돈다. */
    dir.target.position.set(0, 0, floorCz);
    scene.add(dir.target);
    {
      const r = Math.max(floorW, floorD) / 2 + 8;   // 마당까지 덮는다
      const c = dir.shadow.camera;
      c.left = -r; c.right = r; c.top = r; c.bottom = -r;
      c.near = 1; c.far = 140;
      c.updateProjectionMatrix();
    }

    /* ── 바깥 배경 (해질녘 산업단지) ──────────────────────────────────
       ⚠️ 바닥을 만든 **뒤에** 세운다. 야적장 판이 창고 바닥 치수를 받아 그 둘레에
          깔리므로, 치수가 정해지기 전에 부르면 크기가 어긋난다.
       ⚠️ 야적장 판은 y = -0.03 이다. 창고 바닥(y = 0)보다 낮게 두어야 겹치는 자리에서
          두 판이 서로 깜빡이지(z-fighting) 않는다. */
    /* ⚠️ 상차 장면의 작업자는 **창고 안 작업자와 같은 함수**로 만든다. 바깥에서 따로
       만들면 같은 창고에서 다른 사람이 일하게 된다 (`warehouse-exterior` 주석 참고). */
    const exterior = createExterior(THREE, { floorW, floorD, floorCz }, {
      makePiglin: () => buildPiglin({ cart: false, vest: true }),   // 도크 상차 작업자
    });
    scene.add(exterior.group);

    /* 벽 (카메라 방향에 따라 자동 페이드) · 트러스 · 조명기구 */
    const mkWallMat = (c) => new THREE.MeshLambertMaterial({ color: c, transparent: true, opacity: 1, depthWrite: false });
    const wallSets = { back: [], left: [], right: [] };
    const addWall = (set, geo, c, x, y, z) => {
      const m = new THREE.Mesh(geo, mkWallMat(c));
      m.position.set(x, y, z);
      m.userData.wall = true;
      scene.add(m);
      wallSets[set].push(m);
    };
    addWall("back", new THREE.BoxGeometry(floorW, 5.4, 0.3), 0x1a2028, 0, 4.0, zMin);
    addWall("back", new THREE.BoxGeometry(floorW, 1.3, 0.34), 0x232b35, 0, 0.65, zMin);

    /* ── 뒷벽 회사 로고 ────────────────────────────────────────────
       ★ 글자만 쓰다가 **로고 그대로**로 바꿨다 (사용자 요청). CJ 꽃잎 마크 + CJ +
         OLIVENETWORKS 한 벌이다. 랙 위쪽 벽이 통째로 비어 있어 이 자리가 브랜드 벽이 된다 —
         통로에서 고개를 들면 반드시 들어오는 면이다.
       ⚠️ 워드마크를 **검정으로 쓰면 안 된다.** 원본 로고는 검은 글자지만 이 벽이 어두워서
          (0x1a2028) 그대로 두면 글자가 아예 안 보인다. 어두운 배경에 놓는 로고는 밝은
          쪽으로 뒤집어 쓰는 것이 원칙이고, 실제 센터의 벽 로고도 흰색이다.
       ⚠️ 그래도 흰색은 안 쓴다 (사용자 요청 — 진하지 않게). 벽보다 밝되 눌러 칠한 회청색이면
          "거기 있다"까지만 읽히고 화면의 주인공 자리를 안 뺏는다.
       ⚠️ 꽃잎 색은 살린다. 이 로고에서 알아보게 하는 것은 글자가 아니라 세 꽃잎이라,
          여기까지 눌러 버리면 그냥 회색 글씨가 된다.
       ⚠️ 간판이 아니라 **칠한 것**이다. 회사명은 벽 자체가 말하는 것이라 두께를 주면
          광고판이 된다 (A.LTS·신규입고는 무엇을 가리키는 표지라 판을 걸었다).
       ⚠️ `MeshBasicMaterial` — 빛이 거의 안 닿는 벽이라 램버트면 로고가 벽과 같이 묻힌다.
       ⚠️ `wallSets.back` 에 넣는다. 카메라가 벽 너머로 돌면 벽이 투명해지는데, 로고만
          남으면 허공에 떠 있게 된다. */
    {
      /* ⚠️ 캔버스 폭을 **글자를 재서** 정한다. 1536 으로 못 박았더니 OLIVENETWORKS 가
         오른쪽에서 잘렸다 (사용자 지적) — 글꼴이 없어 대체 글꼴로 떨어지면 폭이 또 달라지므로,
         눈으로 맞춘 숫자는 언제든 다시 어긋난다. 재고 나서 그 폭으로 캔버스를 만든다.
         ⚠️ `canvas.width` 를 바꾸면 컨텍스트가 **초기화된다.** 그래서 재기용으로 한 번 쓰고,
            폭을 정한 뒤 글꼴을 다시 세워야 한다. */
      const CH = 435;
      const F_CJ = Math.round(CH * 0.40), F_OL = Math.round(CH * 0.345);
      const cjFont = `900 ${F_CJ}px 'Arial Black', Arial, sans-serif`;
      const olFont = `800 ${F_OL}px 'Arial Black', Arial, sans-serif`;
      const cv = document.createElement("canvas");
      cv.width = 64; cv.height = CH;
      let c = cv.getContext("2d");
      c.font = cjFont;
      const cjW = c.measureText("CJ").width;
      c.font = olFont;
      const olW = c.measureText("OLIVENETWORKS").width;

      const PAD = CH * 0.07, MARK = CH * 0.52, GAP = CH * 0.10;
      const CW = Math.ceil(PAD + cjW + GAP * 0.4 + MARK + GAP + olW + PAD);
      cv.width = CW;
      c = cv.getContext("2d");
      c.clearRect(0, 0, CW, CH);

      /** 꽃잎 하나 — 기울인 타원 */
      const petal = (cx, cy, rx, ry, rot, fill) => {
        c.save();
        c.translate(cx, cy);
        c.rotate(rot);
        c.beginPath();
        c.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
        c.fillStyle = fill;
        c.fill();
        c.restore();
      };

      const INK = "#C3CBD4";   // 워드마크 — 벽보다 밝되 눌러 칠한다 (위 주석)
      c.textBaseline = "middle";
      c.textAlign = "left";

      // CJ
      c.font = cjFont;
      c.fillStyle = INK;
      c.fillText("CJ", PAD, CH * 0.56);

      // 꽃잎 셋 — 파랑(위) · 주황(오른쪽) · 빨강(아래)
      const mx = PAD + cjW + GAP * 0.4 + MARK / 2, my = CH * 0.46, R = CH * 0.155;
      petal(mx - R * 0.42, my - R * 0.95, R * 0.62, R * 0.92, -0.45, "#2E86D8");
      petal(mx + R * 0.86, my - R * 0.10, R * 0.95, R * 0.66, -0.25, "#E8720E");
      petal(mx - R * 0.10, my + R * 1.00, R * 0.62, R * 0.92, 0.30, "#DC2A4E");

      // OLIVENETWORKS
      c.font = olFont;
      c.fillStyle = INK;
      c.fillText("OLIVENETWORKS", PAD + cjW + GAP * 0.4 + MARK + GAP, CH * 0.56);

      const tex = new THREE.CanvasTexture(cv);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 8;
      const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false });
      /* 폭 9m — 랙 위(3.3m)와 벽 윗변(6.7m) 사이에 로고 높이(2.55m)가 들어가는 크기다.
         더 키우면 천장을 넘고, 줄이면 통로에서 글자가 안 읽힌다 */
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(9.0, 9.0 * CH / CW), mat);
      /* 벽 두께가 0.3 이라 중심에서 0.15 가 표면이다. 1cm 띄워 z-파이팅을 피한다 */
      sign.position.set(0, 5.1, zMin + 0.16);
      scene.add(sign);
      wallSets.back.push(sign);
    }
    addWall("left", new THREE.BoxGeometry(0.3, 5.4, floorD), 0x1a2028, -floorW / 2, 4.0, floorCz);
    addWall("left", new THREE.BoxGeometry(0.34, 1.3, floorD), 0x232b35, -floorW / 2, 0.65, floorCz);
    /* ── 오른쪽 벽 — 도크 문을 뚫는다 ──────────────────────────────────
       ★ 통짜 벽이 도크를 정면으로 가로막고 있었다 (사용자 지적). 각도를 낮추면 트럭 짐칸이
         보여야 하는데, 벽이 딱 그 사이에 서 있었다. 확대하면 벽이 사라지긴 하지만 그건
         "벽을 지운" 것이지 창고가 아니다 — 실제 물류창고는 베이마다 문이 뚫려 있다.
       ⚠️ 벽을 **구간으로 쪼개** 세운다. 뚫는 것이 아니라 문 자리를 비우고 나머지만 세우는
          것이다. 박스 지오메트리에서 구멍을 파려면 CSG 가 필요한데, 그 한 벌을 들이는 것보다
          구간 서넛으로 나누는 편이 싸고 결과도 같다.
       ⚠️ 문 위에는 **인방**을 남긴다. 천장까지 통째로 비우면 벽이 끊긴 것으로 보이고,
          건물이 두 동으로 갈라진다.
       ⚠️ 문 자리는 `exterior` 가 알려 준다. 도크 좌표를 여기서 다시 계산하면 도크를 옮겼을 때
          문만 제자리에 남는다. */
    const DOOR_W = 3.4, DOOR_H = 3.7;   // 트럭 뒷문(2.5m)과 짐칸이 함께 들어오는 크기
    const WALL_TOP = 6.7;               // 본체 벽 윗변 (아래 5.4 짜리 판의 y 4.0 기준)
    const wz0 = floorCz - floorD / 2, wz1 = floorCz + floorD / 2;
    const doorZs = (exterior.doorZs ?? [])
      .filter((z) => z - DOOR_W / 2 > wz0 + 0.3 && z + DOOR_W / 2 < wz1 - 0.3)
      .sort((a, b) => a - b);

    /* 문 사이에 남는 벽 구간 */
    let cursor = wz0;
    const solids = [];
    for (const dz of doorZs) {
      if (dz - DOOR_W / 2 > cursor) solids.push([cursor, dz - DOOR_W / 2]);
      cursor = dz + DOOR_W / 2;
    }
    if (cursor < wz1) solids.push([cursor, wz1]);

    for (const [a, b] of solids) {
      const len = b - a, cz = (a + b) / 2;
      addWall("right", new THREE.BoxGeometry(0.3, 5.4, len), 0x1a2028, floorW / 2, 4.0, cz);
      addWall("right", new THREE.BoxGeometry(0.34, 1.3, len), 0x232b35, floorW / 2, 0.65, cz);
    }

    for (const dz of doorZs) {
      const lintel = WALL_TOP - DOOR_H;
      addWall("right", new THREE.BoxGeometry(0.3, lintel, DOOR_W), 0x1a2028,
        floorW / 2, DOOR_H + lintel / 2, dz);
      /* 문틀 — 옆기둥 둘과 위 인방. 벽보다 밝게 둬야 구멍이 아니라 **문**으로 읽힌다 */
      for (const sz of [-1, 1]) {
        addWall("right", new THREE.BoxGeometry(0.36, DOOR_H, 0.16), 0x33404f,
          floorW / 2, DOOR_H / 2, dz + sz * (DOOR_W / 2 - 0.08));
      }
      addWall("right", new THREE.BoxGeometry(0.36, 0.18, DOOR_W), 0x33404f,
        floorW / 2, DOOR_H - 0.09, dz);
    }

    /* ── 벽 사인 (팀 로고 · 입고 게이트 표지) ────────────────────────
       ★ 벽에 **칠한 글자**에서 **걸어 놓은 간판**으로 바꿨다 (사용자 지적 — 좀 더 세련된
         폰트로, 잘 붙어 있게). 달라진 것은 셋이다:
           · 판을 얇은 **상자**로 만든다. 두께 7cm 가 있으면 옆에서 볼 때 벽에서 살짝 떠
             있는 테두리가 보여 "붙어 있는 물건"이 된다. 평면은 어느 각도에서도 두께가
             없어서 벽에 인쇄한 것처럼 보였다.
           · 글자를 **어두운 판 위**에 얹는다. 어두운 벽에 밝은 글자만 떠 있으면 배경이
             없어 글자가 공중에 뜨는데, 판이 깔리면 그 판이 벽에 걸린 것으로 읽힌다.
           · 글꼴을 **가늘게, 자간을 넓게**. 굵은 글씨를 크게 쓰면 경고문이 되고, 가늘고
             넓게 쓰면 기업 사인이 된다.
       ★ 자리도 옮겼다. 표지는 **가리키는 것 바로 위**에 있어야 한다 — "신규입고"는 포탈
         (z 0, 문틀 위끝 y 4.0) 바로 위로, 로고는 랙도 포탈도 없는 뒤쪽 빈 벽으로.
         둘을 같은 자리에 겹쳐 쌓으면 벽 위쪽(6.7m)을 넘어간다.
       ⚠️ 앞면만 `MeshBasicMaterial` 이다. 이 벽은 빛이 거의 안 닿는 어두운 면이라 램버트로
          두면 글자가 벽과 같이 묻힌다. 테두리는 램버트로 두어 어둡게 남긴다 — 그 대비가
          곧 판의 두께로 보인다.
       ⚠️ `BoxGeometry` 의 면 순서는 [+x,-x,+y,-y,+z,-z] 다. 판을 y 90° 돌려 앞면(+z)을
          창고 안쪽(+x)으로 보내므로, 글자는 **다섯 번째** 자리에 넣는다.
       ⚠️ `wallSets.left` 에 함께 넣는다. 카메라가 그 벽 너머로 돌면 벽이 투명해지는데,
          간판만 남으면 허공에 글자가 떠 있게 된다. */
    const mkWallSign = (cv, w, h, y, z) => {
      const tex = new THREE.CanvasTexture(cv);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 8;
      const face = new THREE.MeshBasicMaterial({ map: tex });
      const edge = new THREE.MeshLambertMaterial({ color: 0x0C1119 });
      const m = new THREE.Mesh(
        new THREE.BoxGeometry(w, h, 0.07),
        [edge, edge, edge, edge, face, edge],
      );
      /* 벽 두께가 0.3 이라 중심에서 0.15 가 표면이다. 판 두께 절반(0.035)을 더해 얹는다 */
      m.position.set(-floorW / 2 + 0.19, y, z);
      m.rotation.y = Math.PI / 2;
      scene.add(m);
      wallSets.left.push(m);
      return m;
    };

    /** 판 바탕 — 어두운 면에 얇은 테두리. 두 간판이 같은 차림새를 쓴다 */
    const signPlate = (c, W, H) => {
      c.fillStyle = "#111925";
      c.fillRect(0, 0, W, H);
      c.strokeStyle = "#4E617A";
      c.lineWidth = 3;
      c.strokeRect(9, 9, W - 18, H - 18);
      /* 위쪽에 옅은 선 한 줄 — 판이 빛을 받는 쪽이 어디인지 알려 주면 평평해 보이지 않는다 */
      c.fillStyle = "rgba(255,255,255,0.07)";
      c.fillRect(12, 12, W - 24, 3);
    };

    /* 팀 로고 — 뒤쪽 빈 벽 위 */
    const logoCv = document.createElement("canvas");
    logoCv.width = 1024; logoCv.height = 256;
    {
      const c = logoCv.getContext("2d");
      signPlate(c, 1024, 256);
      c.textAlign = "center";
      c.textBaseline = "middle";
      /* ⚠️ 굵기를 400 으로 둔다. 300 을 적어도 윈도우에 얇은 Arial 이 없어 400 으로 떨어지는데,
         그때 자간까지 좁으면 그냥 굵은 글씨가 된다 — 세련됨은 자간이 만든다 */
      c.font = "400 104px 'Helvetica Neue', 'Segoe UI', Arial, sans-serif";
      try { c.letterSpacing = "30px"; } catch { /* 지원 안 하면 자간 없이 */ }
      c.fillStyle = "#E9F0F8";
      c.fillText("A.LTS", 512 + 15, 112);   // 자간이 오른쪽에도 붙어 왼쪽으로 쏠린다
      c.fillStyle = "#FF8A2A";               // 강조색 한 번만 — 창고 화면의 강조와 같은 주황
      c.fillRect(412, 176, 200, 5);
    }
    mkWallSign(logoCv, 6.2, 1.55, 5.25, -6.5);

    /* 입고 게이트 표지 — 포탈(z 0, 문틀 위끝 4.0m) 바로 위 */
    const signCv = document.createElement("canvas");
    signCv.width = 1024; signCv.height = 290;
    {
      const c = signCv.getContext("2d");
      signPlate(c, 1024, 290);
      /* 왼쪽 세로 막대 — 현장 표지의 흔한 짜임이다. 글자에 색을 또 쓰지 않아도 눈이 여기서
         시작한다 */
      c.fillStyle = "#FF8A2A";
      c.fillRect(64, 62, 11, 166);
      c.textAlign = "left";
      c.textBaseline = "middle";
      c.font = "600 104px 'Malgun Gothic', '맑은 고딕', sans-serif";
      try { c.letterSpacing = "6px"; } catch { /* 지원 안 하면 자간 없이 */ }
      c.fillStyle = "#E9F0F8";
      c.fillText("신규입고", 108, 116);
      c.font = "700 38px 'Segoe UI', Arial, sans-serif";
      try { c.letterSpacing = "9px"; } catch { /* 지원 안 하면 자간 없이 */ }
      c.fillStyle = "#8FA5BC";
      c.fillText("NEW INBOUND", 112, 205);
    }
    mkWallSign(signCv, 4.4, 1.25, 4.78, 0);

    /* 랙 구조 (인스턴싱) */
    const posts = [], decks = [], bars = [], guards = [];
    for (const z of layout.zones) {
      const g = z.g;
      const pitch = g.h + PITCH_PAD;
      const hTot = g.levels * pitch + 0.12;
      const nSeg = Math.max(2, Math.round(z.len / 2.1));
      for (const rx of z.racks) {
        for (let s = 0; s <= nSeg; s++) {
          const pz = z.zStart + (s / nSeg) * z.len;
          for (const off of [-1, 1]) {
            posts.push({ p: [rx + off * (z.depth / 2), hTot / 2, pz], s: [0.06, hTot, 0.06] });
            /* ★ 랙 **양 끝** 기둥에만 노란 코너 가드를 씌운다 (아래 주석) */
            if (s === 0 || s === nSeg) {
              guards.push({ p: [rx + off * (z.depth / 2), GUARD_H / 2, pz], s: [0.145, GUARD_H, 0.145] });
            }
          }
        }
        for (let k = 0; k < g.levels; k++) {
          const y = k * pitch;
          decks.push({ p: [rx, y + 0.028, z.zStart + z.len / 2], s: [z.depth + 0.02, 0.05, z.len + 0.05] });
          for (const off of [-1, 1]) {
            bars.push({ p: [rx + off * (z.depth / 2 - 0.03), y + 0.075, z.zStart + z.len / 2], s: [0.055, 0.09, z.len + 0.05] });
          }
        }
      }
    }
    const boxGeo = new THREE.BoxGeometry(1, 1, 1);
    const dummy = new THREE.Object3D();
    /* @param cast 그림자를 드리울까. 랙 골조는 켜고 **슬롯 상자 4천 개는 끈다** —
       상자는 대부분 랙 안에 있어 바닥까지 닿지도 않는데, 그림자 맵에 4천 개를 한 번 더
       그리는 값은 그대로 든다. 골조(기둥·선반)만으로도 통로에 줄무늬가 진다. */
    const addInstanced = (list, mat, cast = false) => {
      const im = new THREE.InstancedMesh(boxGeo, mat, list.length);
      im.castShadow = cast;
      list.forEach((it, i) => {
        dummy.position.set(...it.p); dummy.rotation.set(0, 0, 0);
        dummy.scale.set(...it.s); dummy.updateMatrix();
        im.setMatrixAt(i, dummy.matrix);
      });
      im.instanceMatrix.needsUpdate = true;
      scene.add(im);
      return im;
    };
    /* ★ 한때 시뮬레이션 중 이 재질들을 **반투명하게**, 다음에는 시선을 가리는 부분만
         셰이더에서 **뚫어**(`discard`) 보았다. 둘 다 되돌렸다 (사용자 지적).
         전부 비치면 창고가 유령처럼 되고, 뚫으면 그 경계가 번진 얼룩으로 보인다.
       ⚠️ 시야가 막히는 문제는 **카메라 각도로** 푼다 — 재질을 건드리지 않는다. */
    addInstanced(posts, new THREE.MeshLambertMaterial({ color: 0x2f66a8 }), true);
    addInstanced(decks, new THREE.MeshLambertMaterial({ color: 0x89929b }), true);
    addInstanced(bars, new THREE.MeshLambertMaterial({ color: 0xd96a26 }), true);

    /* ── 랙 코너 가드 ──────────────────────────────────────────────
       ★ 랙 끝 기둥 밑동에 노란 보호대를 씌운다. 실제 풀필먼트 센터에서 통로로 튀어나온
         기둥은 지게차·AGV 가 가장 먼저 들이받는 자리라 반드시 가드가 있고, **노란색 밑동이
         줄지어 보이는 것**이 창고 사진을 창고답게 만드는 요소다. 파란 기둥만 서 있으면
         전시용 모형처럼 보인다.
       ⚠️ **끝 기둥에만** 씌운다(`s === 0 || s === nSeg`). 랙 중간 기둥은 선반에 가려 통로에서
          보이지도 않는데, 전부 씌우면 인스턴스가 수백 개로 늘고 통로가 노란 점선처럼 된다.
       ⚠️ 단면(0.145)을 기둥(0.06)보다 크게 잡아 **감싸는 것처럼** 보이게 한다. 같거나 작으면
          기둥 안에 묻혀 색만 바뀐 것으로 보이고, z-파이팅으로 면이 깜빡인다. */
    addInstanced(guards, new THREE.MeshLambertMaterial({ color: 0xE0AC1C }), true);

    /* ── 랙 끝 로케이션 표지판 ────────────────────────────────────────
       ★ 랙마다 끝면에 `A-01` 같은 번호판을 붙인다. 창고가 창고로 보이는 것은 규모가 아니라
         이런 표시에서 온다 — 실제 현장은 통로에서 랙을 번호로 부르고, 그 번호가 없으면
         "물건 쌓인 선반"이지 로케이션 관리가 되는 창고가 아니다.

       ⚠️ **글자 26장을 한 장의 텍스처에 몰아 그린다.** 표지판마다 캔버스를 만들면 텍스처가
          26개 생기고 그만큼 GPU 로 올라간다. 한 장에 세로로 쌓아 두고, 판마다 UV 의 v
          범위만 제 줄로 옮기면 재질 하나를 26장이 나눠 쓴다.
       ⚠️ 붙는 면은 **통로 쪽 끝**이다. 뒷줄(row 0)은 랙이 통로 앞에서 끝나므로 +z 끝에
          붙이고 +z 를 보게, 앞줄(row 1)은 통로에서 시작하므로 -z 끝에 붙이고 -z 를 보게
          돌린다. 반대로 달면 통로에서 안 보이고 랙 사이에서만 보인다.
       ⚠️ 높이는 랙 높이에 맞춰 **깎는다.** 2.4m 로 못 박으면 F(특대형, 2.19m)에서는 랙보다
          위에 떠서 허공에 번호가 걸린다. */
    {
      const plates = [];
      for (const z of layout.zones) {
        z.racks.forEach((rx, i) => {
          plates.push({
            label: `${z.g.code}-${String(i + 1).padStart(2, "0")}`,
            x: rx,
            /* 랙 높이 = 단수 x 피치 + 여유 (아래 골조 계산과 같은 식) */
            y: Math.min(2.35, z.g.levels * (z.g.h + PITCH_PAD) + 0.12 - 0.3),
            z: z.row === 0 ? z.zStart + z.len + 0.04 : z.zStart - 0.04,
            face: z.row === 0 ? 0 : Math.PI,
          });
        });
      }

      const ROW_H = 64, CVW = 256;
      const cv = document.createElement("canvas");
      cv.width = CVW;
      cv.height = ROW_H * plates.length;
      const c = cv.getContext("2d");
      plates.forEach((p, i) => {
        const y0 = i * ROW_H;
        c.fillStyle = "#141A21";                    // 판 — 어두운 회청색
        c.fillRect(0, y0, CVW, ROW_H);
        c.fillStyle = "#FF8A2A";                    // 왼쪽 강조 띠
        c.fillRect(0, y0, 10, ROW_H);
        c.fillStyle = "#E8EEF6";
        c.font = "700 38px 'JetBrains Mono', 'Consolas', monospace";
        c.textAlign = "center";
        c.textBaseline = "middle";
        c.fillText(p.label, CVW / 2 + 5, y0 + ROW_H / 2 + 1);
      });
      const plateTex = new THREE.CanvasTexture(cv);
      plateTex.colorSpace = THREE.SRGBColorSpace;
      plateTex.anisotropy = 8;
      /* ⚠️ 어두운 벽·랙 사이에 놓이므로 `MeshBasicMaterial` 이다. 램버트로 두면 통로 조명이
         닿지 않는 각도에서 번호가 안 읽힌다 — 표지판은 늘 읽혀야 표지판이다. */
      const plateMat = new THREE.MeshBasicMaterial({ map: plateTex, transparent: true });

      plates.forEach((p, i) => {
        const geo = new THREE.PlaneGeometry(0.62, 0.16);
        /* 이 판이 쓸 줄만 UV 로 잘라 낸다. `PlaneGeometry` 의 uv 는 (0,1)(1,1)(0,0)(1,0) 순 */
        const v0 = 1 - (i + 1) / plates.length, v1 = 1 - i / plates.length;
        const uv = geo.attributes.uv;
        uv.setY(0, v1); uv.setY(1, v1); uv.setY(2, v0); uv.setY(3, v0);
        uv.needsUpdate = true;
        const m = new THREE.Mesh(geo, plateMat);
        m.position.set(p.x, p.y, p.z);
        m.rotation.y = p.face;
        scene.add(m);
      });
    }

    /* 박스 (규격별 InstancedMesh) */
    /* 입고 적재 시뮬레이션. 아래에서 만들지만 `applyDay` 가 먼저 참조하므로 여기서 선언한다
       (선언 전에 읽으면 TDZ 로 터진다 — `let` 은 선언 줄을 지나야 읽을 수 있다) */
    let inboundSim = null;
    const gradeMeshes = {};
    const rngB = mulberry32(1234);
    for (const z of layout.zones) {
      const g = z.g;
      const pitch = g.h + PITCH_PAD;
      const mats = [], baseCols = [], hiCols = [], dimCols = [];
      const gc = new THREE.Color(g.color);
      for (const rx of z.racks) {
        for (let k = 0; k < g.levels; k++) {
          for (let j = 0; j < g.cols; j++) {
            const jit = 0.82 + rngB() * 0.12;
            const bw = g.w * 0.9 * jit, bh = g.h * 0.82 * (0.9 + rngB() * 0.12);
            dummy.position.set(
              rx + (rngB() - 0.5) * 0.02,
              k * pitch + 0.055 + bh / 2,
              z.zStart + (j + 0.5) * g.w
            );
            dummy.rotation.set(0, (rngB() - 0.5) * 0.1, 0);
            dummy.scale.set(bw, bh, bw);
            dummy.updateMatrix();
            mats.push(dummy.matrix.clone());
            const base = new THREE.Color().setHSL(0.072 + rngB() * 0.012, 0.42, 0.46 + rngB() * 0.12);
            if (g.cold) base.setHSL(0.55, 0.25, 0.55 + rngB() * 0.12);
            baseCols.push(base);
            hiCols.push(base.clone().lerp(gc, 0.62));
            dimCols.push(new THREE.Color().setHSL(0.58, 0.07, 0.14 + rngB() * 0.03));
          }
        }
      }
      const total = mats.length;
      const order = [...Array(total).keys()];
      const rngS = mulberry32(g.id.charCodeAt(0) * 77 + 5);
      for (let i = total - 1; i > 0; i--) {
        const j = Math.floor(rngS() * (i + 1));
        [order[i], order[j]] = [order[j], order[i]];
      }
      const rank = new Array(total);
      order.forEach((slot, r) => (rank[slot] = r));
      const im = new THREE.InstancedMesh(boxGeo, new THREE.MeshLambertMaterial({ color: 0xffffff }), total);
      for (let i = 0; i < total; i++) { im.setMatrixAt(i, mats[i]); im.setColorAt(i, baseCols[i]); }
      im.instanceMatrix.needsUpdate = true;
      if (im.instanceColor) im.instanceColor.needsUpdate = true;
      scene.add(im);
      gradeMeshes[g.id] = { im, mats, rank, total, baseCols, hiCols, dimCols, zone: z };
    }
    const ZERO = new THREE.Matrix4().makeScale(0.0001, 0.0001, 0.0001);
    const curCounts = {}; // ASRS 크레인이 참조하는 현재 규격별 적재 수

    /* ★ 랙 위에 떠 있던 반투명 라벨 판을 **없앴다** (사용자 요청). 아래 통로 행거가 같은
         정보를 이미 이고 있어서 두 벌이 겹쳐 보였고, 떠 있는 판은 랙을 가리기까지 했다.
         구역별 강조(범례 클릭)는 행거 판이 그대로 넘겨받는다 — `labels` 에 행거를 담는다. */
    const labels = {};

    /* ── 통로 로케이션 행거 ────────────────────────────────────────
       ★ 중앙 통로 위에 구역 안내판을 매단다. 실제 센터에서 통로를 걸으면 **머리 위 행거**로
         구역을 찾지, 랙 끝 표지판은 이미 그 앞에 가야 보인다. 시뮬레이션 1인칭이 통로를
         달릴 때 이 판들이 하나씩 머리 위로 지나가는데, 그 흐름이 "안내 체계가 있는 창고"로
         읽힌다.
       ⚠️ 높이 3.4m — 카메라(최저 2.3m)보다 확실히 위다. 더 낮추면 주행 시점의 정중앙을
          가리고, 더 올리면 화면 밖으로 나가 있어 지나가는 줄도 모른다.
       ⚠️ 뒷줄(row 0)은 z -1.02, 앞줄은 +1.02 로 갈라 놓는다. 둘 다 z 0 에 걸면 같은 x 를
          쓰는 두 구역의 판이 정확히 겹쳐 한 장만 보인다.
       ⚠️ `DoubleSide` 다. 통로는 양방향이라 한쪽 면만 그리면 반대편에서 오는 시점에서
          판이 통째로 사라진다. */
    for (const z of layout.zones) {
      const g = z.g;
      const gc = "#" + g.color.toString(16).padStart(6, "0");
      const cv = document.createElement("canvas");
      cv.width = 512; cv.height = 128;
      const c2 = cv.getContext("2d");
      c2.fillStyle = "#F2F0EA"; c2.fillRect(0, 0, 512, 128);
      c2.fillStyle = gc; c2.fillRect(0, 0, 132, 128);
      c2.strokeStyle = "#1A2028"; c2.lineWidth = 8; c2.strokeRect(4, 4, 504, 120);
      c2.fillStyle = "#FFFFFF";
      c2.font = "800 84px 'Malgun Gothic', sans-serif";
      c2.textAlign = "center"; c2.textBaseline = "middle";
      c2.fillText(g.code, 66, 68);
      c2.textAlign = "left";
      c2.fillStyle = "#14181C";
      c2.font = "800 50px 'Malgun Gothic', sans-serif";
      c2.fillText(g.name, 158, 48);
      c2.fillStyle = "#5A626B";
      c2.font = "700 30px 'Malgun Gothic', sans-serif";
      c2.fillText(`${g.cols} X ${g.levels} LOC`, 158, 96);
      const tex = new THREE.CanvasTexture(cv);
      tex.colorSpace = THREE.SRGBColorSpace;

      const sw = Math.max(1.9, Math.min(3.0, z.width - 0.6));
      const sh = sw / 4;
      /* ★ 랙 **끝에서 슬롯 한 칸 안쪽**에 단다 (사용자 요청). 통로 한가운데나 랙 바로
           앞에 걸면 두 줄의 판이 통로 위에서 마주 보며 겹치고, 정작 그 구역 위에는 아무것도
           없다. 한 칸 들어가면 판이 제 구역을 이고 선다.
         ⚠️ 두 줄 다 `zStart + len` 이 **바깥쪽 끝**이다 — 뒷줄은 그 끝이 통로를, 앞줄은
            앞마당을 보고 있어서 방향은 반대지만 부호는 같다. 여기에 `row` 로 갈래를 치면
            한쪽이 랙 반대편으로 튀어나간다. */
      const hz = z.zStart + z.len - g.w;
      const sign = new THREE.Mesh(
        new THREE.PlaneGeometry(sw, sh),
        new THREE.MeshLambertMaterial({ map: tex, side: THREE.DoubleSide }),
      );
      /* ⚠️ 높이는 **랙 위**여야 한다. 3.4m 로 못 박으면 A구역(11단, 3.31m)에서 판 아래쪽이
         랙에 파묻힌다. 랙 높이에 판 절반과 여유를 더해 올린다. */
      const hy = Math.max(HANG_Y, g.levels * (g.h + PITCH_PAD) + 0.12 + sh / 2 + 0.3);
      sign.position.set(z.center, hy, hz);
      scene.add(sign);
      /* 범례를 클릭했을 때 흐려지는 대상 — 예전 라벨 판이 하던 일이다.
         ⚠️ `transparent` 를 미리 켜 둔다. 불투명 재질에 opacity 만 낮추면 아무 일도 없다. */
      sign.material.transparent = true;
      labels[g.id] = sign;

      /* 줄 두 가닥 — 판만 떠 있으면 매달린 것이 아니라 붙여 놓은 것으로 보인다 */
      const cable = new THREE.MeshLambertMaterial({ color: 0x39414A });
      for (const sx of [-sw * 0.36, sw * 0.36]) {
        const top = hy + sh / 2, len = HANG_TOP - top;
        const cy = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, len, 6), cable);
        cy.position.set(z.center + sx, top + len / 2, hz);
        scene.add(cy);
      }
    }

    /* 냉장 룸 */
    const coldZ = layout.zones.find((z) => z.g.cold);
    if (coldZ) {
      const cw = coldZ.width + coldZ.pad * 2, cd = coldZ.len + coldZ.pad * 2, ch = 3.1;
      const cx = coldZ.x0 - coldZ.pad + cw / 2, cz = coldZ.zStart - coldZ.pad + cd / 2;
      const glass = new THREE.MeshLambertMaterial({
        color: 0x9fdcff, transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide,
      });
      const mkPanel = (w, h, px, py, pz, ry = 0) => {
        const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), glass);
        m.position.set(px, py, pz); m.rotation.y = ry; scene.add(m);
      };
      mkPanel(cw, ch, cx, ch / 2, cz - cd / 2);
      mkPanel(cw, ch, cx, ch / 2, cz + cd / 2);
      mkPanel(cd, ch, cx - cw / 2, ch / 2, cz, Math.PI / 2);
      mkPanel(cd, ch, cx + cw / 2, ch / 2, cz, Math.PI / 2);
      const top = new THREE.Mesh(new THREE.PlaneGeometry(cw, cd), glass);
      top.rotation.x = -Math.PI / 2; top.position.set(cx, ch, cz); scene.add(top);
      const frame = new THREE.MeshLambertMaterial({ color: 0x2b3d4d });
      for (const [fx, fz] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) {
        const c = new THREE.Mesh(new THREE.BoxGeometry(0.1, ch, 0.1), frame);
        c.position.set(cx + fx * cw / 2, ch / 2, cz + fz * cd / 2); scene.add(c);
      }
      const cl = new THREE.PointLight(0x6fd8ff, 0.9, 9);
      cl.position.set(cx, 2.4, cz); scene.add(cl);
    }

    /* 입고장 팔레트 */
    /* 파렛트·골판지 재질은 입고장과 출고장이 함께 쓴다. 같은 창고의 같은 물건이므로
       색이 갈리면 안 된다 */
    const palMat = new THREE.MeshLambertMaterial({ color: 0x8a6a42 });
    const cbMat = new THREE.MeshLambertMaterial({ color: 0xc59a63 });
    const rngP = mulberry32(31);
    const inboundZ = CORRIDOR / 2 + layout.frontLen + 3.1; // 지게차 주행 라인(+1.5)과 간섭 방지
    for (const px of [-11, -5.4, 0.4, 6, 11.2]) {
      const pal = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.13, 1.1), palMat);
      pal.position.set(px, 0.065, inboundZ + (rngP() - 0.5) * 0.8);
      pal.rotation.y = (rngP() - 0.5) * 0.5;
      scene.add(pal);
      const nB = 1 + Math.floor(rngP() * 3);
      /* ⚠️ 출고 쪽과 같은 이유로 실제 높이를 더해 쌓는다 (그쪽 주석 참고) */
      let inY = 0.13;
      for (let b = 0; b < nB; b++) {
        const s = 0.34 + rngP() * 0.3;
        const bx = new THREE.Mesh(new THREE.BoxGeometry(s, s * 0.8, s), cbMat);
        bx.position.set(pal.position.x + (rngP() - 0.5) * 0.5, inY + s * 0.4, pal.position.z + (rngP() - 0.5) * 0.5);
        inY += s * 0.8;
        bx.rotation.y = rngP() * 0.8;
        scene.add(bx);
      }
    }

    /* ── 입고 하차 화물 ──
       ★ 파렛트 위에 **햇반 6개입 크기의 네모를 층층이 쌓는다.** 낱개 상자 몇 개를 흩어
         놓는 것보다 이쪽이 물류창고답다 — 실제로 들어오는 단위는 낱개가 아니라 파렛트다.
       ★ 한 층씩 **방향을 90도 돌려** 쌓는다(인터로킹). 실제 파렛타이징이 그렇게 하고,
         옆에서 보면 이음매가 격자로 엇갈려 "쌓은 것"으로 읽힌다. 같은 방향으로만 쌓으면
         세로줄이 죽 이어져 통짜 덩어리처럼 보인다.
       ★ 파렛트마다 **높이를 다르게** 둔다. 다 똑같으면 진열대가 되고, 들쭉날쭉해야
         "일부는 이미 빼 갔다"는 시간이 생긴다.
       ⚠️ 상자가 1,000개 가까이 되므로 `InstancedMesh` 로 그린다. 개별 메시로 만들면
          그리기 호출만 1,000번이다. 랩 필름도 파렛트마다 하나씩이라 같이 인스턴싱한다.
       ⚠️ 화물 줄은 AGV 순환 경로를 피해 벽 쪽에 붙인다(출고 쪽과 같은 이유). */
    {
      const iz = inZone(floorW);
      const rngI = mulberry32(717);

      /* 낱개 포장 인쇄 — 크림 바탕에 빨간 띠와 흰 글자.
         ⚠️ 한 장을 상자 여섯 면에 다 붙인다. 면마다 가로세로 비가 달라 늘어나므로,
            어느 비율에서도 뭉개지지 않는 단순한 무늬여야 한다 — 가로 띠 하나면 충분하다. */
      const packCv = document.createElement("canvas");
      packCv.width = 256; packCv.height = 128;
      {
        const pc = packCv.getContext("2d");
        pc.fillStyle = "#EFE7DA"; pc.fillRect(0, 0, 256, 128);
        pc.strokeStyle = "rgba(150,132,104,0.55)"; pc.lineWidth = 3;
        pc.strokeRect(1.5, 1.5, 253, 125);
        pc.fillStyle = "#C9302C"; pc.fillRect(0, 74, 256, 32);
        pc.fillStyle = "#FFFFFF";
        pc.font = "800 24px 'Malgun Gothic', sans-serif";
        pc.textAlign = "center"; pc.textBaseline = "middle";
        pc.fillText("햇반 6개입", 128, 91);
        pc.fillStyle = "#8C6B3F";
        pc.font = "700 15px 'Malgun Gothic', sans-serif";
        pc.fillText("210g × 6", 128, 46);
      }
      const packTex = new THREE.CanvasTexture(packCv);
      packTex.colorSpace = THREE.SRGBColorSpace;
      const packMat = new THREE.MeshLambertMaterial({ map: packTex });

      /* 낱개 치수 = 검수실에서 재고 있는 그 물건. 두 화면이 같은 숫자를 봐야
         "저기서 잰 게 여기 쌓여 있다"가 성립한다 (412 × 58 × 275 mm) */
      const PW = 0.412, PH = 0.058, PD = 0.275;
      const GAP = 0.004;                       // 층 사이 미세한 틈 — 이음매가 보여야 쌓은 티가 난다
      const PALLET_TOP = 0.13;

      const spots = [];
      for (let col = 0; col < 2; col++) {
        for (let row = 0; row < 5; row++) {
          spots.push({
            x: -floorW / 2 + IN_ZONE.stageOffset + col * 1.22,
            z: iz.z0 + 0.9 + row * 1.5,
            layers: 11 + Math.floor(rngI() * 8),   // 11~18층
            spin: (rngI() - 0.5) * 0.12,
          });
        }
      }

      const boxGeoP = new THREE.BoxGeometry(PW, PH, PD);
      const total = spots.reduce((n, s) => n + s.layers * 6, 0);
      const stack = new THREE.InstancedMesh(boxGeoP, packMat, total);
      const wrapGeo = new THREE.BoxGeometry(1, 1, 1);
      const wrapMat = new THREE.MeshLambertMaterial({
        color: 0xcfe0ee, transparent: true, opacity: 0.15, depthWrite: false,
      });
      const wraps = new THREE.InstancedMesh(wrapGeo, wrapMat, spots.length);
      const dmy = new THREE.Object3D();
      let bi = 0;

      spots.forEach((sp, si) => {
        const pal = new THREE.Mesh(new THREE.BoxGeometry(1.12, 0.13, 0.94), palMat);
        pal.position.set(sp.x, 0.065, sp.z);
        pal.rotation.y = sp.spin;
        scene.add(pal);

        for (let l = 0; l < sp.layers; l++) {
          const turned = l % 2 === 1;           // 한 층 걸러 90도
          const y = PALLET_TOP + PH / 2 + l * (PH + GAP);
          /* 한 층은 낱개 6개. 돌아간 층은 가로·세로 개수가 뒤바뀐다 —
             (2 × 3) ↔ (3 × 2). 어느 쪽이든 발자국이 0.82 x 0.83 으로 같아서
             파렛트 위에 딱 맞는다 */
          const nx = turned ? 3 : 2, nz = turned ? 2 : 3;
          const sw = turned ? PD : PW, sd = turned ? PW : PD;
          for (let a = 0; a < nx; a++) {
            for (let b = 0; b < nz; b++) {
              const lx = (a - (nx - 1) / 2) * sw;
              const lz = (b - (nz - 1) / 2) * sd;
              const cos = Math.cos(sp.spin), sin = Math.sin(sp.spin);
              dmy.position.set(sp.x + lx * cos + lz * sin, y, sp.z - lx * sin + lz * cos);
              dmy.rotation.set(0, sp.spin + (turned ? Math.PI / 2 : 0) + (rngI() - 0.5) * 0.03, 0);
              dmy.scale.set(1, 1, 1);
              dmy.updateMatrix();
              stack.setMatrixAt(bi++, dmy.matrix);
            }
          }
        }

        // 스트레치 랩 — 쌓은 높이에 맞춰 늘인 상자 한 개
        const hTot = sp.layers * (PH + GAP);
        dmy.position.set(sp.x, PALLET_TOP + hTot / 2, sp.z);
        dmy.rotation.set(0, sp.spin, 0);
        dmy.scale.set(0.9, hTot + 0.02, 0.9);
        dmy.updateMatrix();
        wraps.setMatrixAt(si, dmy.matrix);
      });

      stack.instanceMatrix.needsUpdate = true;
      wraps.instanceMatrix.needsUpdate = true;
      scene.add(stack);
      scene.add(wraps);
    }

    /* ── 출고 포장 작업대 2대 ──
       ★ 랙에서 꺼낸 물건이 도크로 나가기 전에 거치는 자리다. 컨베이어는 벽과 나란히
         (z 방향으로) 놓는다 — 구역을 가로지르게 놓으면 AGV 순환 경로(x = 13.2 / 14.1)를
         가로막는다.
       ⚠️ 포스기는 **작업자 쪽이면서 기본 시점에서도 읽히는** 각도로 튼다. 통로만 보게
          하면 창고를 처음 열었을 때 화면이 옆모습으로만 보여, 누를 수 있다는 걸 아무도
          모른다. -0.75 rad 이 그 절충이다.
       ⚠️ z 자리는 아래 대기 화물과 겹치지 않게 잡혀 있다. 한쪽을 옮기면 다른 쪽도 볼 것. */
    const stationX = floorW / 2 - 1.15;
    const stations = [-4.5, 4.5].map((sz, i) => {
      const st = createPackingStation(THREE, {
        position: [stationX, 0, floorCz + sz],
        rotationY: -0.75,
        line: 3 + i,
        packed: 128 + i * 37,
        seed: i,
        /* ★ 작업자는 **앞쪽 한 대에만** 세운다 (사용자 지적 — 뒤쪽엔 빼 달라).
             둘 다 세우면 좁은 자리에 같은 동작이 나란히 돌아 눈에 거슬리고, 어느 쪽을
             보라는 화면인지가 흐려진다. 한 명이 일하고 한 대는 비어 있는 편이 실제
             현장에도 가깝다.
           ⚠️ 앞쪽은 **i = 1** 이다(z = +4.5). 배열이 [-4.5, +4.5] 라 뒤쪽이 먼저다 —
              Enter 로 훑는 순서를 뒤집어 쓰는 것과 같은 이유다.
           창고 안 작업자와 같은 함수로 만든다 (`packing-station` 주석 참고) */
        makePiglin: i === 1 ? () => buildPiglin({ cart: false, vest: true }) : undefined,
      });
      scene.add(castAll(st.group));
      return st;
    });

    /* ── 출고 대기 화물 ──
       바닥에 색만 칠해 두면 '비어 있는 구역'이다. 나갈 물건이 실제로 쌓여 있어야
       출고장으로 보인다. 파렛트는 도크 문 앞에 줄 세우고, 토트는 그 옆에 낮게 깐다. */
    {
      /* z 는 아래 `SPOTS` 가 직접 정한다 — 구역 범위(`outZone`)를 균등 분할하던 것을
         작업대와 겹쳐서 손으로 찍는 방식으로 바꿨다 */
      const cx = floorW / 2 - OUT_ZONE.stageOffset;   // 벽 쪽 한 줄 (위 주석 참고)
      const rngO = mulberry32(505);
      const toteM = new THREE.MeshLambertMaterial({ color: 0x2E6FD8 });
      /* ── 오네 포장 상자 ──
         ★ 여기 쌓인 큰 상자는 **나갈 물건**이다. 민무늬 골판지면 "상자가 쌓여 있다"에서
           끝나지만, 브랜드가 찍혀 있으면 "우리 물건이 나간다"가 된다 (사용자 요청).
         ⚠️ 무늬는 **옆면 넷에만** 붙인다. 면 순서가 [+x,-x,+y,-y,+z,-z] 라 위·아래는
            민무늬 골판지로 남긴다 — 상자 윗면에 상표가 찍힌 포장은 없다.
         ⚠️ 텍스처 하나를 **모든 상자가 나눠 쓴다.** 상자마다 캔버스를 만들면 그만큼
            GPU 로 올라간다. */
      const oneCv = document.createElement("canvas");
      oneCv.width = 512; oneCv.height = 320;
      {
        const c = oneCv.getContext("2d");
        c.fillStyle = "#EFEAE0";                       // 크라프트 화이트
        c.fillRect(0, 0, 512, 320);
        c.fillStyle = "#1856B4";
        c.fillRect(0, 0, 512, 6);
        c.textAlign = "left";
        c.textBaseline = "middle";
        c.font = "700 30px 'Malgun Gothic', sans-serif";
        c.fillText("월요일부터 일요일까지", 34, 62);
        c.fillText("매일매일 배송", 34, 102);
        c.font = "900 128px 'Malgun Gothic', '맑은 고딕', sans-serif";
        c.fillText("오네", 30, 216);
        c.font = "700 22px 'Arial', sans-serif";
        c.fillStyle = "#5B6B7E";
        c.fillText("O-NE", 262, 246);
        // CJ대한통운 — 오른쪽 위에 작게
        c.textAlign = "right";
        c.fillStyle = "#1856B4";
        c.font = "700 26px 'Malgun Gothic', sans-serif";
        c.fillText("CJ대한통운", 480, 60);
        c.strokeStyle = "rgba(90,70,45,0.35)";        // 봉함 테이프 자국
        c.lineWidth = 3;
        c.beginPath(); c.moveTo(0, 300); c.lineTo(512, 300); c.stroke();
      }
      const oneTex = new THREE.CanvasTexture(oneCv);
      oneTex.colorSpace = THREE.SRGBColorSpace;
      oneTex.anisotropy = 8;
      const oneSide = new THREE.MeshLambertMaterial({ map: oneTex });
      /* 무늬 없는 면 — **무늬의 바탕색과 같은 크라프트 화이트**다.
         ⚠️ 여기에 골판지색(`cbMat`)을 쓰면 흰 옆면에 갈색 뚜껑이 덮인 꼴이 된다
            (사용자 지적). 한 상자는 한 색이어야 한 상자로 보인다. */
      const onePlain = new THREE.MeshLambertMaterial({ color: 0xEFEAE0 });
      /* 면 순서 [+x, -x, +y, -y, +z, -z].
         ★ 스티커를 **-x 한 면에만** 붙인다 (사용자 지적 — 네 면에 다 붙어 정신없다).
           실제 상자도 상표는 한 면에 붙는다. -x 를 고른 이유는 출고 구역이 오른쪽 벽에
           붙어 있어서, 통로 쪽(작은 x)에서 보는 면이 그쪽이기 때문이다. */
      const oneFaces = [onePlain, oneSide, onePlain, onePlain, onePlain, onePlain];
      /* 파렛트와 토트를 번갈아 세운다. 한 종류만 줄 세우면 창고가 아니라 선반 진열대로
         보인다 - 나갈 물건은 원래 형태가 섞여 있다.
         ⚠️ z 를 균등 간격으로 뿌리지 않고 **손으로 찍는다.** 작업대 두 대가 z 로
            -5.9~-3.1 과 3.1~5.9 를 차지하므로, 균등 간격이면 그 위에 겹쳐 놓인다. */
      const SPOTS = [-7.4, -1.9, -0.2, 1.5, 7.6];
      for (let i = 0; i < SPOTS.length; i++) {
        const pz = floorCz + SPOTS[i];
        if (i % 3 === 2) {
          // 파란 토트 2단
          for (let k = 0; k < 2; k++) {
            const t = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.3, 0.44), toteM);
            t.position.set(cx + (rngO() - 0.5) * 0.1, 0.15 + k * 0.3, pz);
            t.rotation.y = (rngO() - 0.5) * 0.18;
            scene.add(t);
          }
          continue;
        }
        const pal = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.13, 1.15), palMat);
        pal.position.set(cx, 0.065, pz);
        pal.rotation.y = (rngO() - 0.5) * 0.14;
        scene.add(pal);
        const n = 2 + Math.floor(rngO() * 2);
        /* ⚠️ 쌓는 높이는 **앞 상자들의 실제 높이를 더해서** 구한다. 예전에는 `b * sz` 로
           지금 상자의 높이를 층수만큼 곱했는데, 상자마다 높이가 다르므로 아래가 낮으면
           위가 뜨고 아래가 높으면 서로 파고들었다 (사용자 지적 — 가운데 상자가 떴다). */
        let stackY = 0.13;
        for (let b = 0; b < n; b++) {
          const sz = 0.46 + rngO() * 0.2;
          const bx = new THREE.Mesh(new THREE.BoxGeometry(0.95, sz, 0.9), oneFaces);
          bx.position.set(cx + (rngO() - 0.5) * 0.12, stackY + sz / 2, pz + (rngO() - 0.5) * 0.12);
          stackY += sz;
          bx.rotation.y = (rngO() - 0.5) * 0.14;
          scene.add(bx);
        }
      }
    }

    /* 작업자 2명 — CJ풍 근무복 (형광조끼+카트 / 회색점퍼+스캐너) */
    const patrolBound = Math.min(...layout.rowWidths) / 2 + 1.2;
    /* ★ CJ풍 근무복 작업자에서 **좀비화 피글린**으로 갈아 끼웠다 (사용자 요청).
       `buildPiglin` 이 `buildWorker` 와 같은 손잡이를 돌려주므로, 아래 걷기·정차 상태
       기계는 한 줄도 손대지 않았다. `buildWorker` 는 지우지 않고 남겨 둔다 — 되돌리고
       싶으면 이 두 줄만 바꾸면 된다. */
    /* ★ 창고 안 작업자도 조끼를 입힌다 (사용자 요청). 출고장 둘만 입고 있으면 같은
       현장인데 복장이 갈린다 — 실제 센터에서 반사 조끼는 구역이 아니라 신분에 붙는다 */
    const worker1 = buildPiglin({ cart: true, vest: true });
    const worker2 = buildPiglin({ cart: false, device: true, vest: true });
    worker1.grp.position.set(-patrolBound * 0.5, 0, -0.72);
    worker2.grp.position.set(patrolBound * 0.55, 0, 0.72);
    scene.add(castAll(worker1.grp));
    scene.add(castAll(worker2.grp));
    const workers = [
      { m: worker1, s: { x: -patrolBound * 0.5, z: -1.30, dir: 1, head: Math.PI / 2, mode: "walk", timer: 3.5, pickT: 0, swing: 0, phase: 0, speed: 1.05, rng: mulberry32(555) } },
      { m: worker2, s: { x: patrolBound * 0.55, z: 1.30, dir: -1, head: -Math.PI / 2, mode: "walk", timer: 5.2, pickT: 0, swing: 0, phase: 1.7, speed: 0.9, rng: mulberry32(910) } },
    ];

    /* 지게차 — 입고장 라인 주행, 정차 시 포크 승강 */
    const fk = buildForklift();
    /* 운전석에 앉은 피글린. 지게차 그룹의 자식으로 넣어야 차와 함께 움직인다 —
       씬에 따로 넣으면 차만 가고 운전자는 제자리에 남는다.
       ⚠️ 좌석이 y = 0.86 이고 피글린의 원점은 발바닥이라, 앉은키만큼 내려 앉힌다 */
    const driver = buildPiglin({ cart: false, seated: true });
    driver.grp.position.set(0, 0.52, -0.34);
    fk.grp.add(driver.grp);
    const fkBound = floorW / 2 - 4.2;
    const fkZ = CORRIDOR / 2 + layout.frontLen + 1.5;
    fk.grp.position.set(fkBound * 0.4, 0, fkZ);
    fk.grp.rotation.y = -Math.PI / 2;
    scene.add(castAll(fk.grp));   // 운전석 피글린도 함께 걸린다
    const fkS = {
      x: fkBound * 0.4, dir: -1, head: -Math.PI / 2,
      mode: "drive", timer: 6, liftT: 0, t: 0, rng: mulberry32(777),
    };

    /* ── AGV 2대 — 사각 순환 경로 (앞줄 루프 / 뒷줄 루프, 반대 방향) ──
       ★ 통로 구간의 차선을 **∓0.15 에서 ∓0.54 로** 벌렸다 (사용자 지적 — 서로 통과한다).
         둘이 마주 오는데 0.3m 밖에 안 떨어져 있었다. AGV 는 차체 반지름 0.45 에 가로
         비율 1.12 라 **반폭이 0.50m** 다 — 1.0m 짜리 둘이 0.3m 간격으로 스쳐 가니 그냥
         겹쳐 지나갔다.
       ── 통로 3.2m 를 나눠 쓰는 법 ────────────────────────────────────────
         작업자 -1.30 │ AGV -0.54 │ (배송 로봇 0) │ AGV +0.54 │ 작업자 +1.30
         AGV 끼리   틈 0.08m │ AGV↔작업자 틈 0.045m │ 통로 가장자리 여유 0.085m
       ⚠️ 여기서 더 벌릴 수는 없다. AGV 둘(2.0m)과 작업자 둘(0.86m)만으로 이미 2.86m 다.
          시뮬레이션의 배송 로봇까지 나란히 세울 자리는 없다 — 그래서 그쪽은 자리가
          아니라 **시간**으로 비킨다 (아래 틱의 `corridorBusy`). */
    /* ★ 순환 경로의 양옆 구간을 **랙 바로 바깥**으로 당겼다 (사용자 지적 — AGV 가 물건을
         다 통과해 다닌다). 예전 값(+2.4 / +3.3 → x 13.2 / 14.1)은 랙과 벽 사이 한가운데를
         지나는데, 그 자리가 곧 **출고 작업대와 입고 스테이징**이다. 바닥에 색만 칠해 둔
         구역이 아니라 물건이 서 있는 자리라, 지나갈 때마다 작업대를 뚫고 나왔다.
       ⚠️ 숫자를 눈으로 고르지 않는다. 랙 끝은 rowWidths/2 = 10.81. 출고 작업대는 벽에서
          1.15m 안쪽에 길이 2.8 짜리가 43° 로 서 있어, x 반폭이 2.16 — **x 13.00 부터**
          차지한다. 그러니 빈 띠는 10.81 ~ 13.00, 딱 2.19m 다.
       ⚠️ AGV 폭이 0.9 라 그 띠에 두 줄이 겨우 들어간다: 안쪽 줄 10.98~11.88, 바깥 줄
          11.93~12.83. 앞뒤로 15cm 남짓씩 남는다 — 이 숫자를 조금이라도 키우면 한쪽이
          랙을, 다른 쪽이 작업대를 뚫는다. */
    const rackEdge = Math.max(...layout.rowWidths) / 2;
    const sideA = rackEdge + 0.62;
    const sideB = rackEdge + 1.57;
    const frontLane = CORRIDOR / 2 + layout.frontLen + 0.5;
    const backLane = -(CORRIDOR / 2 + layout.backLen + 0.7);
    const agv1 = buildAGV({ tote: true });   // 토트 적재 — 앞줄 시계 방향
    const agv2 = buildAGV({ tote: false }); // 공차 — 뒷줄 반시계 방향
    scene.add(castAll(agv1.grp));
    scene.add(castAll(agv2.grp));
    const agvs = [
      {
        u: agv1, speed: 1.35, seg: 0, prog: 1.5, pauseT: 0, nextPause: 7, t: 0, rng: mulberry32(2024),
        path: [[-sideA, -0.54], [sideA, -0.54], [sideA, frontLane], [-sideA, frontLane]],
      },
      {
        u: agv2, speed: 1.2, seg: 0, prog: 4.0, pauseT: 0, nextPause: 9.5, t: 2.1, rng: mulberry32(4096),
        path: [[sideB, 0.54], [-sideB, 0.54], [-sideB, backLane], [sideB, backLane]],
      },
    ];


    /* ── ASRS 스태커 크레인 ────────────────────────────────────────────
       ★ A구역(극소형)에만 한 대 있던 것을 **B(소형)·E(특수)에도** 세웠다. 그러면서 통째로
         공장 함수로 뽑았다 — 세 벌을 복사해 두면 한 대만 고쳐지는 사고가 난다.
       ★ 구역마다 슬롯 규격도 랙 수도 다르므로 **치수를 전부 계산한다.** 예전 코드는 A구역
         값(포크 뻗는 거리 0.95, 랙 index 1·2 …)을 숫자로 박아 두고 있었는데, 그대로 두면
         E구역에서 포크가 랙에 못 닿거나 크레인이 랙을 뚫는다.
       ⚠️ 크레인이 설 통로는 **랙 두 개 사이**여야 한다. A(8랙)·B(6랙)는 index 1·2 사이가
          통로지만, E 는 랙이 둘뿐(singles: 2)이라 0·1 사이다. 아래 `iA` 계산이 그것이다 —
          여기에 1 을 박아 두면 E 에서 `racks[2]` 가 없어 좌표가 NaN 이 된다. */
    const CRANE_ZONES = [
      { id: "xs", seed: 9001 },
      { id: "s", seed: 9002 },
      { id: "m", seed: 9004 },
      { id: "xl", seed: 9003 },
    ];
    const alu = new THREE.MeshLambertMaterial({ color: 0xB8C0C8 });
    const craneDark = new THREE.MeshLambertMaterial({ color: 0x3A424C });
    const craneWhite = new THREE.MeshLambertMaterial({ color: 0xF2F4F6 });
    const craneBlue = new THREE.MeshLambertMaterial({ color: 0x1E63C8 });
    const craneRib = new THREE.MeshLambertMaterial({ color: 0xD7DCE1 });
    const craneTote = new THREE.MeshLambertMaterial({ color: 0x9AA1A8 });

    const buildStackerCrane = ({ id, seed }) => {
      const zone = layout.zones.find((zz) => zz.g.id === id);
      const g = zone.g;
      const pitch = g.h + PITCH_PAD;
      const rackH = g.levels * pitch + 0.12;

      /* 통로가 될 두 랙. 랙이 둘뿐이면 0·1, 그보다 많으면 1·2 */
      const iA = Math.min(1, zone.racks.length - 2);
      const iB = iA + 1;
      const craneX = (zone.racks[iA] + zone.racks[iB]) / 2;
      const zEnd = zone.zStart + zone.len;
      /* 포크가 뻗는 거리 = 통로 절반 + 랙 절반 − 여유. 규격이 크면 랙도 두꺼워 더 뻗는다 */
      const reach = AISLE / 2 + g.w / 2 - 0.05;
      const dropOff = g.w / 2 + 0.45;
      const boxW = g.w * 0.8, boxH = g.h * 0.78;

      const railB = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.05, zone.len + 0.7), alu);
      railB.position.set(craneX, 0.025, zone.zStart + zone.len / 2 + 0.1);
      scene.add(railB);
      const railT = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, zone.len + 0.7), craneDark);
      railT.position.set(craneX, rackH + 0.42, zone.zStart + zone.len / 2 + 0.1);
      scene.add(railT);

      const crane = new THREE.Group();
      crane.position.set(craneX, 0, zone.zStart + zone.len * 0.35);
      scene.add(castAll(crane));

      const mastH = rackH + 0.4;
      // 백색 트윈 마스트 + 수평 리브 + 하부 블루 액센트
      for (const mz of [-0.26, 0.26]) {
        const m = new THREE.Mesh(new THREE.BoxGeometry(0.13, mastH, 0.15), craneWhite);
        m.position.set(0, mastH / 2, mz);
        crane.add(m);
        for (let ry = 0.95; ry < mastH - 0.3; ry += 0.5) {
          const rib = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.03, 0.17), craneRib);
          rib.position.set(0, ry, mz);
          crane.add(rib);
        }
        const ac = new THREE.Mesh(new THREE.BoxGeometry(0.138, 0.55, 0.158), craneBlue);
        ac.position.set(0, 0.56, mz);
        crane.add(ac);
      }
      // 상단 캡 + 그린 라이트바
      const cap = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.12, 0.76), craneWhite);
      cap.position.set(0, mastH + 0.1, 0);
      crane.add(cap);
      const led = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.055, 0.7),
        new THREE.MeshBasicMaterial({ color: 0x35D96B }));
      led.position.set(0, mastH + 0.19, 0);
      crane.add(led);
      // 모바일 베이스 — 백색 + 다크 스커트 + 블루 밴드 + 컬러 도트
      const base = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.2, 0.98), craneWhite);
      base.position.y = 0.14;
      crane.add(base);
      const skirtB = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.09, 1.02), craneDark);
      skirtB.position.y = 0.045;
      crane.add(skirtB);
      const bAcc = new THREE.Mesh(new THREE.BoxGeometry(0.585, 0.07, 0.99), craneBlue);
      bAcc.position.y = 0.225;
      crane.add(bAcc);
      [0xE8542F, 0xF2B23E, 0x2FA84F, 0x2E5FBF].forEach((dc, di) => {
        for (const sx of [-1, 1]) {
          const d = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.05, 0.05),
            new THREE.MeshBasicMaterial({ color: dc }));
          d.position.set(sx * 0.297, 0.13, -0.28 + di * 0.19);
          crane.add(d);
        }
      });
      // 온보드 버퍼 선반 (마스트 후방 3단 + 회색 토트)
      for (const px of [-0.17, 0.17]) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.05, rackH * 0.82, 0.05), craneWhite);
        post.position.set(px, rackH * 0.41 + 0.24, -0.64);
        crane.add(post);
      }
      for (let sh = 0; sh < 3; sh++) {
        const shy = 0.85 + sh * 0.78;
        const plate = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.035, 0.34), craneWhite);
        plate.position.set(0, shy, -0.64);
        crane.add(plate);
        const t = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.17, 0.26), craneTote);
        t.position.set(0, shy + 0.105, -0.64);
        crane.add(t);
      }

      const carriage = new THREE.Group();
      carriage.position.y = 0.6;
      crane.add(carriage);
      {
        const b = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.32, 0.44), craneWhite);
        b.position.y = 0.22; carriage.add(b);
        const tr = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.05, 0.46), craneBlue);
        tr.position.y = 0.41; carriage.add(tr);
        const wn = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.09, 0.09),
          new THREE.MeshBasicMaterial({ color: 0xFFD23E }));
        wn.position.set(0.256, 0.24, 0); carriage.add(wn);
      }
      const fork = new THREE.Group();
      fork.position.y = 0.03;
      carriage.add(fork);
      fork.add(new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.035, 0.34), alu));
      const carried = new THREE.Mesh(new THREE.BoxGeometry(boxW, boxH, boxW),
        new THREE.MeshLambertMaterial({ color: 0xC59A63 }));
      carried.position.y = boxH / 2 + 0.02;
      carried.visible = false;
      fork.add(carried);

      /* P&D 스테이션 (통로 입구 소형 컨베이어)
         ★ **중앙 작업 통로에 맞닿은 끝**에 둔다. 뒷줄 구역은 통로가 z 가 큰 쪽에서 끝나고
           (zEnd), 앞줄 구역은 z 가 작은 쪽에서 시작한다(zStart) — 두 줄이 반대다.
         ⚠️ 예전에는 두 줄 모두 `zEnd - 0.55` 였다. 그러면 앞줄 구역의 P&D 가 통로에서 가장
            **먼** 끝에 놓여서, 짐을 나르는 로봇이 랙 사이를 깊숙이 파고들어야 했다. 로봇이
            선반을 뚫고 지나가 보이던 원인이고, 실제 창고에서도 P&D 는 통로 입구에 둔다. */
      const dropZ = zone.row === 0 ? zEnd - 0.55 : zone.zStart + 0.55;
      const conv = new THREE.Group();
      conv.position.set(craneX + dropOff, 0, dropZ);
      scene.add(conv);
      const top = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.06, 0.8), craneDark);
      top.position.y = 0.36; conv.add(top);
      for (const [lx, lz] of [[-0.2, -0.32], [0.2, -0.32], [-0.2, 0.32], [0.2, 0.32]]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.36, 0.05), alu);
        leg.position.set(lx, 0.18, lz); conv.add(leg);
      }
      const depBox = new THREE.Mesh(new THREE.BoxGeometry(boxW, boxH, boxW),
        new THREE.MeshLambertMaterial({ color: 0xC59A63 }));
      depBox.position.set(craneX + dropOff, 0.39 + boxH / 2, dropZ);
      depBox.visible = false;
      scene.add(depBox);

      const rng = mulberry32(seed);
      const per = g.levels * g.cols;
      /* 실제로 물건이 있는 슬롯만 고른다 — 빈 칸에 포크를 넣고 상자를 꺼내면
         아무것도 없던 자리에서 상자가 생겨난다 */
      const pickSlot = () => {
        const gm = gradeMeshes[id];
        const nFilled = curCounts[id] ?? 0;
        for (let t = 0; t < 40; t++) {
          const rackIdx = rng() < 0.5 ? iA : iB;
          const k = Math.floor(rng() * g.levels);
          const j = 1 + Math.floor(rng() * (g.cols - 2));
          const i = rackIdx * per + k * g.cols + j;
          if (gm.rank[i] < nFilled) {
            return { i, z: zone.zStart + (j + 0.5) * g.w, y: k * pitch + 0.04, dir: rackIdx === iA ? -1 : 1 };
          }
        }
        return null;
      };

      return {
        id, crane, carriage, fork, carried, depBox, led, dropZ, reach, dropOff, pickSlot, rng,
        /* 아래 넷은 입고 적재 시뮬레이션이 쓴다 — 예약 슬롯의 좌표를 계산하고 로봇의
           길을 잡는 데 필요하다. 크레인만 아는 값이라 여기서 함께 내보낸다 */
        zone, g, pitch, iA, iB, craneX,
        st: { phase: "pause", timer: 1.2 + rng() * 1.4, tgt: null, t: 0 },
      };
    };
    const cranes = CRANE_ZONES.map(buildStackerCrane);

    /* ── 카메라 궤도 컨트롤 ── */
    const OVERVIEW = { az: 0.62, pol: 1.00, r: 28.5, tx: 0, ty: 1.3, tz: 0.6 };
    /* 출고 구역 한 발 앞 — Enter 를 처음 눌렀을 때 서는 자리.
       ★ 전에는 Enter 한 번에 포스기 화면까지 **바로** 날아갔다 (사용자 지적). 시연에서
         그 사이가 통째로 빠지니, 어디를 확대한 것인지가 안 보이고 화면만 갈아 낀 것
         같았다. 한 정거장을 둬서 출고 구역 전체를 먼저 보여 준다 — 작업대·피글린·
         상자, 그리고 열린 문 너머의 트럭까지 한 화면에 든다.
       ⚠️ 거리를 **15 아래**로 잡는다. 오른쪽 벽이 그 거리에서 사라지도록 되어 있어서,
          이 값이 그보다 크면 벽이 그대로 서서 트럭을 가린다 — 이 장면의 요점이 사라진다.
       ⚠️ 시선은 작업대와 도크 문 **사이**에 둔다. 작업대에 맞추면 트럭이 화면 밖으로
          밀리고, 문에 맞추면 작업 장면이 구석으로 간다. */
    const OUTBOUND = {
      az: -0.95, pol: 1.08, r: 13.5,
      tx: floorW / 2 - 1.0, ty: 1.7, tz: floorCz + 6.0,
    };
    const cur = { ...OVERVIEW }, des = { ...OVERVIEW };

    /* ── 입고 적재 시뮬레이션 ──────────────────────────────────────────
       ⚠️ AGV 경로 상수(`sideA`)와 크레인이 만들어진 **뒤에** 세운다. 로봇이 그 통로를 타고
          가고, 예약 슬롯은 크레인이 서 있는 랙에서 고른다.
       ⚠️ `applyDay` 가 이 객체를 참조하므로, 첫 `applyDay` 호출보다 먼저 있어야 한다. */
    /* 시뮬레이션을 카메라가 따라가고 있나.
       ★ **자리만 따라가고 각도는 사용자에게 남긴다.** 각도까지 붙들면 보고 싶은 쪽을 볼 수
         없어 답답하고, 자리를 안 따라가면 로봇이 화면 밖으로 나가 버린다. 둘의 절충이다.
       ⚠️ 화면을 끌거나 확대하면 따라가기를 끈다. 사용자가 손을 댔는데 카메라가 계속
          제자리로 끌고 가면 "고장난 화면"이 된다. */
    let followSim = false;
    /* Enter 한 바퀴에서 **출고 구역 정거장**에 서 있는가 (위 `OUTBOUND` 주석 참고).
       ⚠️ 카메라를 전체 보기로 되돌리는 곳에서는 이 값도 함께 내려야 한다. 안 그러면
          더블클릭으로 물러난 뒤 Enter 를 눌렀을 때 그 정거장을 건너뛰고 포스기로 간다. */
    let outboundStage = false;
    /* 배송 로봇이 통로를 쓰는 중인가. 작업자·AGV 가 이 값을 보고 비켜선다 */
    let corridorBusy = false;
    /* 시뮬레이션 카메라가 쓰는 값들. 궤도 값(`cur`/`des`)과 따로 두는 이유는 아래 틱의
       주석 참고 — 궤도 감쇠로는 달리는 목표를 못 따라잡는다 */
    /* 팝업이 따라다닐 3D 좌표와 남은 시간(초).
       ⚠️ 리액트 상태가 아니라 이 안의 변수다 — 매 프레임 바뀌는 값이라 상태로 두면
          초당 60번 다시 그린다. */

    const camPos = new THREE.Vector3();
    const camLook = new THREE.Vector3();
    const wantPos = new THREE.Vector3();
    /* 조준점 — 시뮬레이션이 주는 `focus` 를 **한 번 걸러 낸 값**.
       ★ 화면이 어지러웠던 진짜 원인이 여기 있었다. `focus` 는 짐 그 자체인데, 포크가
         뻗고 크레인이 승강할 때마다 짐이 잔떨림을 갖는다. 그것을 그대로 바라보면
         **떨림이 곧 화면 회전**이 된다 — 사람의 눈은 위치 변화보다 각도 변화에
         훨씬 예민해서, 몇 cm 의 떨림도 멀미로 온다.
       ★ 그래서 카메라가 아니라 **보는 대상을 먼저** 안정시킨다. 이 값이 짐을 느리게
         따라가고, 카메라는 이 값만 본다. 사람이 물건을 눈으로 좇을 때 머리가 물건의
         잔떨림까지 따라가지 않는 것과 같다.
       ⚠️ 카메라 **자리를 잡는 기준도 이 값**이어야 한다. 자리는 짐 기준, 시선은 걸러 낸
         값 기준으로 두면 둘이 어긋나 화면이 미끄러지듯 흔들린다. */
    const aim = new THREE.Vector3();
    let filmAz = 0, filmPol = 1.18, filmDist = 3.4;

    inboundSim = createInboundSim(THREE, {
      scene,
      layout,
      gradeMeshes,
      cranes,
      /* 로봇이 나오고 돌아가는 자리 — 검수실로 가는 그 포탈이다.
         ⚠️ 포탈 객체에서 직접 읽는다. 좌표를 여기 한 번 더 적으면 포탈을 옮겼을 때
            로봇만 옛 자리에서 나온다 */
      portalPos: [portal.group.position.x, 0, portal.group.position.z],
      zeroMatrix: ZERO,
      makeAGV: () => buildAGV({ tote: false }),
      onStatus: (line) => setSimLine(line),
      onPlaced: (p) => {
        setPlaced(p);
        if (p) audio?.stow();   // 칸에 들어간 그 순간에만 (지울 때는 말고)
        /* ── 슬롯 반짝임 ────────────────────────────────────────────
           ★ 물건이 들어간 칸이 잠깐 밝아졌다 가라앉는다 (사용자 요청). 글자 없이도
             "여기 들어갔다"가 읽힌다.
           ⚠️ **3D 안에서** 일어난다. 예전 팝업은 화면에 붙어 있어서 카메라가 움직이면
              겉돌았는데, 인스턴스 색은 그 칸에 붙어 있으므로 카메라를 그대로 따라간다. */
      },
      /* 마지막에 카메라가 향할 곳 — 출고 구역 한가운데 (`outZone` 이 정한 자리) */
      outboundAt: [
        (outZone(floorW, floorCz).x0 + outZone(floorW, floorCz).x1) / 2,
        1.4,
        floorCz,
      ],
      /* 배송 로봇이 중앙 통로를 지나는 동안 **작업자와 순환 AGV 를 통로 밖으로 물린다.**
         셋이 같은 통로를 쓰고 있어서 서로를 뚫고 지나갔다.
         ⚠️ 멈추지 않고 **비켜서게** 한다. 멈춰 세우면 창고가 죽은 것처럼 보이고 2D 지도의
            점들도 얼어붙는다. `yieldZ` 만큼 통로 밖으로 밀어 두고, 끝나면 되돌린다. */
      clearCorridor: (busy) => {
        corridorBusy = busy;
      },
    });
    simRunRef.current = (items) => {
      /* ⚠️ 지금 보고 있던 각을 넘겨준다. 도입부가 그 각을 붙들고 시작해야 버튼을 누른
         순간 화면이 홱 돌지 않는다 (`inbound-sim` 의 `introAz` 참고). */
      inboundSim.start(items);
      setSimActive(true);
      /* ⚠️ 여기가 **버튼을 누른 흐름 안**이라 소리를 켤 수 있다. 자동재생 정책 때문에
         사용자 동작에서 떨어져 나오면 `AudioContext` 가 조용히 막힌다 */
      audio?.start();
      followSim = true;
      /* 촬영 시작 — 지금 카메라 자리에서 이어 받는다. 0 에서 시작하면 첫 프레임에 카메라가
         창고 원점으로 순간이동했다가 날아온다 */
      camPos.copy(camera.position);
      camLook.set(cur.tx, cur.ty, cur.tz);
      aim.copy(camLook);   // 0 에서 시작하면 첫 프레임에 창고 원점을 본다
      filmAz = cur.az;
      filmPol = cur.pol;
      filmDist = cur.r;
    };

    const applyCam = () => {
      const t = new THREE.Vector3(cur.tx, cur.ty, cur.tz);
      camera.position.set(
        t.x + cur.r * Math.sin(cur.pol) * Math.sin(cur.az),
        t.y + cur.r * Math.cos(cur.pol),
        t.z + cur.r * Math.sin(cur.pol) * Math.cos(cur.az)
      );
      camera.lookAt(t);
    };
    const el = renderer.domElement;
    const ptrs = new Map();
    let pinchD = 0;
    /* 클릭 지점 포커스 (탭과 드래그 구분) */
    const ray = new THREE.Raycaster();
    let clickInfo = null;
    /* 우클릭 드래그가 지금 진행 중인가. 드래그가 캔버스 밖에서 끝나도(오버레이 패널 위,
       3D 탭 wrapper 바깥 등) 뒤따라오는 네이티브 컨텍스트 메뉴를 window 레벨에서 막기
       위한 게이트. 항상 막아 두지 않고 이 플래그로 게이트하는 이유는 onWindowContextMenu
       선언부 옆 주석 참고 */
    let rightDragActive = false;
    /* 포탈에 마우스가 올라와 있는가. 상태가 아니라 지역 변수다 -
       매 프레임 읽는 값이라 상태로 두면 초당 60번 리렌더가 돈다.
       (주의) **쓰는 곳보다 위에** 둔다. `let` 은 선언 줄을 지나기 전에는 읽을 수 없어서,
          아래 `focusAt`/`onHover` 보다 뒤에 두면 호출 시점에 따라 터진다. */
    let portalHovered = false;
    /* 마우스가 올라와 있는 작업대 (없으면 null). 매 프레임 읽는 값이라 상태로 두면
       초당 60번 리렌더가 돈다 — 포탈 쪽과 같은 이유다 */
    let hoveredStation = null;
    /* 카메라가 지금 어느 작업대를 들여다보고 있나 (없으면 null).
       ★ 두 단계로 나눈 이유: 멀리서 누르자마자 라우트가 바뀌면, 무엇을 눌렀는지 보지도
         못한 채 화면이 넘어간다. 한 번은 다가가서 **무엇인지 보여 주고**, 그 다음 클릭에
         넘긴다. 무엇을 하는 클릭인지는 포스기 화면 자신이 적어 준다. */
    let focusedStation = null;
    /* 값을 바꾸는 자리는 여기 하나뿐이다. 바뀌는 곳이 여덟 군데라, 각자 바꾸면 화면에
       알리는 것을 어딘가에서 빠뜨린다. */
    const setStation = (st) => {
      if (focusedStation === st) return;
      focusedStation = st;
      onStationFocusRef.current?.(st !== null);
    };

    /* 작업대 포스기 정면으로 카메라를 옮긴다.
       ⚠️ 새 카메라 연출을 만들지 않고 **기존 궤도 목표값만 바꾼다** — 루프가 이미 목표를
          향해 부드럽게 따라가므로(`cur += (des-cur)*0.09`) 그것만으로 다가가는 그림이 난다.
       ⚠️ 화면의 정면 방향은 작업대가 놓인 각도에 따라 달라진다. 고정된 각도를 적어 두면
          작업대를 옮기는 순간 카메라가 화면 뒤통수를 본다. 앵커에서 매번 뽑는다. */
    const focusStation = (st) => {
      const p = new THREE.Vector3();
      st.screenAnchor.getWorldPosition(p);
      const n = new THREE.Vector3(0, 0, 1)
        .applyQuaternion(st.screenAnchor.getWorldQuaternion(new THREE.Quaternion()));
      des.tx = p.x; des.ty = p.y; des.tz = p.z;
      des.az = Math.atan2(n.x, n.z);
      des.pol = 1.34;   // 거의 수평. 서서 화면을 보는 눈높이
      /* ⚠️ 1.9m 에서 1.05m 로 당겼다. 화면에 대시보드 한 판이 통째로 그려져 있어서,
         멀면 옮겨 그린 보람 없이 글자가 뭉갠다. 이 거리에서 화면 세로가 화면(뷰포트)의
         절반을 넘게 차지해 캔버스가 거의 1:1 로 보인다. */
      des.r = 1.05;
    };

    const focusAt = (px, py) => {
      const rect = el.getBoundingClientRect();
      const nd = new THREE.Vector2(
        ((px - rect.left) / rect.width) * 2 - 1,
        -((py - rect.top) / rect.height) * 2 + 1
      );
      ray.setFromCamera(nd, camera);

      /* ★ 포탈을 **먼저** 본다. 포탈 판이 바닥·랙보다 앞에 있어도, 일반 클릭 판정은
         "가장 가까운 것"을 고르므로 소용돌이의 투명한 부분에서 뒤가 잡힐 수 있다.
         따로 먼저 검사하면 그 어긋남이 없다. */
      /* 출고 포스기 — 포탈과 같은 이유로 따로 먼저 검사한다. 클릭 판정용 판이 투명해서
         일반 판정에 맡기면 뒤에 있는 랙이 잡힌다 */
      for (const st of stations) {
        if (ray.intersectObjects(st.pickTargets, false).length === 0) continue;
        if (focusedStation === st) {
          goPackingRef.current?.();     // 이미 들여다보고 있다 → 실제 화면으로
        } else {
          setStation(st);
          focusStation(st);             // 처음 눌렀다 → 다가가서 보여 준다
        }
        return;
      }

      const portalHit = ray.intersectObjects(portal.pickTargets, false);
      if (portalHit.length > 0) {
        /* 호버 상태를 손으로 되돌린다. 이제 화면이 검수실로 덮이므로 마우스가 포탈에서
           벗어나는 순간을 못 본다 — 그대로 두면 돌아온 뒤에도 커서가 계속 손 모양이고,
           툴팁도 "이미 올라와 있다"고 여겨 다시 안 뜬다. */
        portalHovered = false;
        el.style.cursor = "";
        onEnterPortalRef.current?.();
        return;
      }

      /* ⚠️ 바깥 배경은 클릭 판정에서 **통째로 뺀다.** 하늘 돔은 280m, 먼 지면은 600m
         크기라 화면 어디를 눌러도 걸린다. 그대로 두면 빈 곳을 눌렀을 때 카메라가
         하늘 한복판이나 지평선 밖으로 날아간다.
         가지 하나를 목록에서 빼는 편이 걸린 뒤에 걸러내는 것보다 싸다 - 그 아래 수백
         개(트럭·기둥·산)를 아예 훑지 않는다. */
      const pickRoots = scene.children.filter((o) => o !== exterior.group);
      const hits = ray.intersectObjects(pickRoots, true);
      const h = hits.find(
        (hh) => hh.object.visible && !hh.object.userData.wall && !hh.object.userData.portal,
      );
      if (!h) return;
      des.tx = h.point.x;
      des.ty = Math.min(3.0, Math.max(0.7, h.point.y));
      des.tz = h.point.z;
      des.r = Math.max(6.5, cur.r * 0.55); // 클릭할 때마다 단계 줌인
      setStation(null);   // 다른 데를 봤으면 작업대에서 눈을 뗀 것이다
    };
    const onDown = (e) => {
      followSim = false;   // 사용자가 손을 댔다 (위 `followSim` 주의 참고)
      ptrs.set(e.pointerId, [e.clientX, e.clientY]);
      el.setPointerCapture(e.pointerId);
      clickInfo = ptrs.size === 1 ? { x: e.clientX, y: e.clientY, t: performance.now() } : null;
      if (e.button === 2) rightDragActive = true;
    };
    /* 마우스가 포탈 위에 있는지 본다. 끌고 있는 중에는 보지 않는다 —
       화면을 돌리는 동안 커서가 포탈을 스쳐도 반응하면 안 된다 */
    const onHover = (e) => {
      if (ptrs.size > 0) return;
      const rect = el.getBoundingClientRect();
      const nd = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1,
      );
      ray.setFromCamera(nd, camera);
      /* 작업대 호버 — 커서만 바꾸고 상태는 안 건드린다 */
      const overStation = stations.find((st) => ray.intersectObjects(st.pickTargets, false).length > 0) ?? null;
      if (overStation !== hoveredStation) {
        hoveredStation = overStation;
        if (overStation) el.style.cursor = "pointer";
      }

      const next = ray.intersectObjects(portal.pickTargets, false).length > 0;
      if (next === portalHovered) {
        if (!next && !hoveredStation) el.style.cursor = "";
        return; // 바뀔 때만 알린다
      }

      portalHovered = next;
      el.style.cursor = next ? "pointer" : "";

      /* (경고) 화면 좌표를 그대로 넘기면 안 된다. 이 앱은 1600x1004 고정 무대를
         `transform: scale()` 로 줄여 놓았고, 툴팁은 그 무대 **안에** 놓인다. 무대 안에서는
         길이 단위가 배율만큼 다르므로, 루트 상자 기준으로 되돌리고 배율로 나눠 준다. */
      const root = rootRef.current;
      let x = e.clientX, y = e.clientY;
      if (root) {
        const rr = root.getBoundingClientRect();
        const k = root.offsetWidth > 0 ? rr.width / root.offsetWidth : 1;
        x = (e.clientX - rr.left) / (k || 1);
        y = (e.clientY - rr.top) / (k || 1);
      }
      onPortalHoverRef.current?.(next, x, y, root ? root.offsetWidth : 0);
    };
    el.addEventListener("pointermove", onHover);

    const onMove = (e) => {
      if (!ptrs.has(e.pointerId)) return;
      const [lx, ly] = ptrs.get(e.pointerId);
      ptrs.set(e.pointerId, [e.clientX, e.clientY]);
      if (ptrs.size === 1) {
        des.az -= (e.clientX - lx) * 0.0052;
        des.pol = Math.min(1.38, Math.max(0.22, des.pol - (e.clientY - ly) * 0.0042));
      } else if (ptrs.size === 2) {
        const pts = [...ptrs.values()];
        const d = Math.hypot(pts[0][0] - pts[1][0], pts[0][1] - pts[1][1]);
        if (pinchD > 0) des.r = Math.min(58, Math.max(6, des.r * (pinchD / d)));
        pinchD = d;
      }
    };
    const onUp = (e) => {
      if (clickInfo && ptrs.size === 1) {
        const dx = e.clientX - clickInfo.x, dy = e.clientY - clickInfo.y;
        if (dx * dx + dy * dy < 36 && performance.now() - clickInfo.t < 450) focusAt(e.clientX, e.clientY);
      }
      clickInfo = null;
      ptrs.delete(e.pointerId);
      if (ptrs.size < 2) pinchD = 0;
      /* 즉시 끄지 않는다 - 우클릭을 뗄 때 브라우저는 pointerup → contextmenu 를 같은
         태스크 안에서 동기적으로 쏜다. setTimeout(0) 으로 다음 태스크로 미뤄야
         onWindowContextMenu 가 먼저 플래그를 읽고 소비할 시간을 번다. */
      setTimeout(() => { rightDragActive = false; }, 0);
    };
    const onDbl = () => { Object.assign(des, OVERVIEW); setStation(null); outboundStage = false; exterior.setDeparting(false); };
    /* 우클릭 드래그로 카메라를 돌리므로, 네이티브 컨텍스트 메뉴는 방해만 된다 */
    const onContextMenu = (e) => e.preventDefault();
    /* el 밖(오버레이 패널 더 바깥, 3D 탭 wrapper 바깥 등)에서 드래그가 끝나는 극단적인
       경우까지 덮기 위해 window 레벨에서 한 번 더 막는다. 항상 켜 두지 않고
       rightDragActive 로 게이트하는 이유: 이 앱의 다른 화면(2D 지도, win98 셸의 다른
       창)에서는 정상적인 우클릭이 필요할 수 있는데, 무조건 preventDefault 하면 그것까지
       막아 버린다. 이 화면에서 실제로 우클릭-드래그가 일어났을 때만 다음 contextmenu
       하나를 막는다. */
    const onWindowContextMenu = (e) => {
      if (rightDragActive) {
        e.preventDefault();
        rightDragActive = false;
      }
    };

    /* Enter — 출고 포스기를 차례로 확대한다.
       ★ 순서는 **앞쪽(카메라에 가까운 쪽)부터**다. 기본 시점에서 눈에 먼저 들어오는 것이
         앞쪽이고, 시연에서 "저거요" 하고 가리키는 것도 그쪽이다.
       ★ 마지막 작업대에서 한 번 더 누르면 전체 보기로 돌아간다. 키 하나로 한 바퀴가
         닫혀야 손이 키보드를 떠나지 않는다.
       ⚠️ Esc 는 쓰지 않는다. 이 컴포넌트는 분석 화면에서 전체 화면 오버레이로도 뜨는데,
          거기서 Esc 는 오버레이를 닫는 키다. 두 곳이 같은 키를 두고 다투면 어느 쪽이
          이길지가 붙는 순서에 달리게 된다.
       ⚠️ 3D 판이 숨겨져 있을 때는 받지 않는다. `display:none` 이면 `offsetParent` 가
          null 이라, 상태를 따로 들고 다니지 않고도 보이는지 알 수 있다. */
    const onKey = (e) => {
      if (e.key !== "Enter" || el.offsetParent === null) return;
      /* ⚠️ 검수실이 화면을 덮고 있으면 넘긴다. 검수실도 Enter 를 쓰는데(측정기 → 모니터),
         두 곳이 같은 창(window)에서 듣고 있어 그냥 두면 **둘 다** 반응한다. 보이지 않는
         창고 카메라가 멋대로 움직여서, 돌아왔을 때 엉뚱한 자리에 서 있게 된다.
         리스너 등록 순서에 기대는 `stopPropagation` 대신 여기서 못을 박는다. */
      if (inRoomRef.current) return;
      const tag = e.target instanceof HTMLElement ? e.target.tagName : "";
      /* 글자를 치고 있는 중이면 언제나 넘긴다 — 카메라가 남의 타자를 가로채면 안 된다 */
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      /* ── 시뮬레이션에서 빠져나오기 ────────────────────────────────
         ★ 적재가 끝나면 `outro` 가 출고 쪽을 비춘 채 멈추는데, 그동안에도 카메라는
           시뮬레이션 것이다(`running` 이 참으로 남는다). 놓아 주지 않으면 아래에서
           `des` 를 바꿔 봐야 매 프레임 덮어써진다.
         ⚠️ **버튼 걸러내기보다 먼저** 와야 한다. 시뮬레이션을 버튼으로 시작하면 그
            버튼에 포커스가 남고, Enter 는 브라우저가 그 버튼의 클릭으로 바꿔 보낸다 —
            나가려고 누른 Enter 가 시뮬레이션을 **다시 시작**시켰다. 여기서 가로채고
            `preventDefault` 로 그 클릭 합성을 막는다.
         ⚠️ 여기서 **돌아간다.** 같은 Enter 로 포스기까지 한 번에 가면 빠져나온 창고
            화면을 보지도 못하고 다음 곳으로 끌려간다. 한 번 더 누르면 그때 간다.
         ⚠️ 시뮬레이션이 매 프레임 지금 카메라를 `cur`/`des` 에 되받아 적어 두므로,
            `des` 만 전체 보기로 바꾸면 서 있던 자리에서 부드럽게 물러난다. */
      if (followSim || inboundSim?.running) {
        e.preventDefault();
        inboundSim?.finish();
        followSim = false;
        setSimActive(false);
        audio?.stop();
        setStation(null);
        outboundStage = false;   // 시뮬레이션에서 나오면 한 바퀴를 처음부터
        exterior.setDeparting(false);
        Object.assign(des, OVERVIEW);
        return;
      }

      if (tag === "BUTTON") return;   // 평소에는 버튼이 Enter 를 먼저 가진다
      e.preventDefault();

      /* ── Enter 한 바퀴 ─────────────────────────────────────────────
           전체 보기 → **출고 구역** → 앞 포스기 → 전체 보기
         ★ 출고 구역 한 정거장을 앞에 끼웠다 (사용자 요청). 바로 포스기로 날아가면
           무엇을 확대한 것인지 안 보인다 — 먼저 그 구역을 보여 주고 나서 들어간다.
         ★ 포스기는 **앞쪽 한 대만** 들른다 (사용자 결정). 뒤쪽 작업대는 같은 화면을 띄운
           같은 설비라 두 번 볼 것이 없고, 시연에서 그 한 정거장이 늘어지는 만큼 흐름이
           끊긴다. 작업자(피글린)가 서 있는 쪽도 앞쪽이다.
         ⚠️ `stations` 는 z 가 [-4.5, +4.5] 순서라 **앞쪽이 배열 뒤에 있다.** 앞의 것을
            집으면 화면에서 먼 쪽으로 날아간다. */
      if (!outboundStage && focusedStation === null) {
        outboundStage = true;
        Object.assign(des, OUTBOUND);
        exterior.setDeparting(true);   // 닫힌 트럭이 배송을 나간다 (출고 시점에서만)
        return;
      }
      const front = stations[stations.length - 1];
      if (focusedStation === null && front) {
        setStation(front);
        focusStation(front);
      } else {
        Object.assign(des, OVERVIEW);
        setStation(null);
        outboundStage = false;   // 한 바퀴 돌았다 — 다음 Enter 는 다시 출고 구역부터
        exterior.setDeparting(false);   // 트럭도 도크로 되돌린다
      }
    };
    window.addEventListener("keydown", onKey);
    const onWheel = (e) => {
      e.preventDefault();
      /* ⚠️ 확대도 따라가기를 끈다. 시뮬레이션이 거리를 매 프레임 잡고 있어서, 켜 둔 채
         휠을 돌리면 두 값이 서로 밀며 화면이 떤다. 손을 대면 카메라를 넘겨주는 쪽이 맞다. */
      /* 손을 대면 조작이 필요해진다 — 감춰 둔 패널을 돌려준다 */
      followSim = false;
      setSimActive(false);
      des.r = Math.min(58, Math.max(6, des.r * (1 + e.deltaY * 0.0011)));
    };
    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onUp);
    el.addEventListener("dblclick", onDbl);
    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("contextmenu", onContextMenu);
    window.addEventListener("contextmenu", onWindowContextMenu);

    /* ── API ── */
    const applyDay = (d) => {
      const u = CURVE[d];
      const perGrade = {};
      let shownFilled = 0, shownTotal = 0;
      for (const g of GRADES) {
        const gm = gradeMeshes[g.id];
        // 실측 규격별 재고 / 해당 규격 최대 재고 = 구역 점유율
        const series = REAL_INV[g.invKey];
        const occ = Math.min(0.99, Math.max(0.015, (series[d] / INV_PEAK[g.invKey]) * 0.95));
        const n = Math.round(occ * gm.total);
        /* ⚠️ 입고 시뮬레이션이 예약한 칸은 건너뛴다. 안 그러면 날짜 슬라이더를 움직이는
           순간 방금 로봇이 넣은 상자가 그 자리에서 사라진다 (`inbound-sim.js` 의 같은 주의). */
        const skip = inboundSim?.reserved.get(g.id);
        for (let i = 0; i < gm.total; i++) {
          if (skip?.includes(i)) continue;
          gm.im.setMatrixAt(i, gm.rank[i] < n ? gm.mats[i] : ZERO);
        }
        gm.im.instanceMatrix.needsUpdate = true;
        perGrade[g.id] = { filled: n, total: gm.total };
        curCounts[g.id] = n;
        shownFilled += n; shownTotal += gm.total;
      }
      setStats({ u, perGrade, shownFilled, shownTotal, inn: FLOWS.inn[d], out: FLOWS.out[d] });
    };
    const setHighlight = (id) => {
      for (const g of GRADES) {
        const gm = gradeMeshes[g.id];
        for (let i = 0; i < gm.total; i++) {
          const col = id == null ? gm.baseCols[i] : g.id === id ? gm.hiCols[i] : gm.dimCols[i];
          gm.im.setColorAt(i, col);
        }
        if (gm.im.instanceColor) gm.im.instanceColor.needsUpdate = true;
        labels[g.id].material.opacity = id == null ? 0.95 : g.id === id ? 1 : 0.18;
      }
    };
    const flyTo = (id) => {
      const z = gradeMeshes[id].zone;
      des.tx = z.center; des.ty = 1.3; des.tz = z.zStart + z.len / 2;
      des.r = Math.max(9.5, Math.max(z.width, z.len) * 1.85);
      des.az = z.row === 0 ? 0.45 : 0.45;
      des.pol = 1.02;
    };
    const resetView = () => { Object.assign(des, OVERVIEW); setStation(null); };

    apiRef.current = { applyDay, setHighlight, flyTo, resetView };

    /* ── 루프 ── */
    const clock = new THREE.Clock();
    let raf;
    const tick = () => {
      const dt = Math.min(0.05, clock.getDelta());


      /* 작업자 2명 상태 기계 (공통 갱신기) */
      for (const w of workers) {
        const s = w.s, m = w.m;
        if (s.mode === "walk") {
          /* ★ 배송 로봇과 마주치게 생기면 **돌아선다** (사용자 지적 — 막힌 길이면
               돌아가야 한다). 옆으로 비키는 것만으로는 좁은 통로에서 정면으로 스쳐
               지나가는 그림이 나온다.
             ⚠️ 로봇은 통로를 **+x 로만** 간다. 그래서 정면으로 부딪히는 경우는 작업자가
                -x 로 걸을 때뿐이다. 돌아서는 방향을 +x 한쪽으로 고정해야 로봇이 지나간
                뒤에 다시 돌아서는 제자리걸음이 안 생긴다. */
          const botX = corridorBusy ? inboundSim?.botX : undefined;
          if (botX !== undefined && s.dir < 0 && botX < s.x && s.x - botX < 3.4) s.dir = 1;
          s.x += s.dir * s.speed * dt;
          if (s.x > patrolBound) { s.x = patrolBound; s.dir = -1; }
          if (s.x < -patrolBound) { s.x = -patrolBound; s.dir = 1; }
          s.head = s.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
          s.timer -= dt;
          if (s.timer <= 0) {
            s.mode = "pick";
            s.pickT = 1.5 + s.rng() * 1.2;
            s.head = s.rng() > 0.5 ? 0 : Math.PI; // 앞줄 / 뒷줄 랙을 향해 정지
          }
        } else {
          s.pickT -= dt;
          if (s.pickT <= 0) { s.mode = "walk"; s.timer = 3 + s.rng() * 5; }
        }
        s.phase += dt * (s.mode === "walk" ? 6.6 : 0);
        s.swing += ((s.mode === "walk" ? 0.55 : 0) - s.swing) * Math.min(1, dt * 8);
        const sN = Math.sin(s.phase);
        const wr = s.swing / 0.55 || 0;
        m.grp.position.x = s.x;
        /* ★ 로봇이 통로를 쓰는 동안은 **통로 가장자리로 비켜선다**.
           ⚠️ 비켜서는 자리는 반드시 **통로 안**이어야 한다. 처음에는 서 있던 z 에서 그냥
              1.5m 밀었는데, 통로 반폭이 1.6m 라 z = 2.22 로 나가면서 피글린이 랙을 뚫고
              서 있었다 (사용자 지적). 통로 벽에서 몸 반지름만큼 물린 자리가 한계다.
           ⚠️ 뚝 옮기지 않고 감쇠로 옮긴다. 순간이동하면 비켜선 것이 아니라 사라졌다
              나타난 것으로 보인다. */
        /* ⚠️ 비켜서는 자리는 평소 자리(∓1.30)보다 **바깥**이어야 한다. 안쪽으로 넣으면
           오히려 AGV 차선으로 들어간다. 몸 반폭 0.215 를 빼면 1.38 이 한계다 */
        const yieldZ = corridorBusy ? Math.sign(s.z || 1) * (CORRIDOR / 2 - 0.22) : s.z;
        m.grp.position.z += (yieldZ - m.grp.position.z) * Math.min(1, dt * 2.2);
        m.grp.position.y = Math.abs(Math.cos(s.phase)) * 0.035 * wr;
        let dh = s.head - m.grp.rotation.y;
        dh = Math.atan2(Math.sin(dh), Math.cos(dh));
        m.grp.rotation.y += dh * Math.min(1, dt * 5.5);
        m.lLeg.rotation.x = sN * s.swing;
        m.rLeg.rotation.x = -sN * s.swing;
        if (m.hasCart) {
          m.lArm.rotation.x = m.armRest + sN * 0.06 * wr;
          m.rArm.rotation.x = m.armRest - sN * 0.06 * wr;
        } else if (m.hasDevice) {
          m.lArm.rotation.x = m.armRest - sN * s.swing * 0.75; // 왼팔만 스윙
          m.rArm.rotation.x = -0.85;                            // 스캐너 든 오른팔 고정
        } else {
          m.lArm.rotation.x = m.armRest - sN * s.swing * 0.75;
          m.rArm.rotation.x = m.armRest + sN * s.swing * 0.75;
        }
      }

      /* 지게차 상태 기계 — 주행 ↔ 정차·포크 승강 */
      fkS.t += dt;
      if (fkS.mode === "drive") {
        fkS.x += fkS.dir * 1.55 * dt;
        if (fkS.x > fkBound) { fkS.x = fkBound; fkS.dir = -1; }
        if (fkS.x < -fkBound) { fkS.x = -fkBound; fkS.dir = 1; }
        fkS.head = fkS.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
        for (const wh of fk.wheels) wh.rotation.x += (1.55 * dt) / 0.22;
        fkS.timer -= dt;
        if (fkS.timer <= 0) { fkS.mode = "lift"; fkS.liftT = 0; }
      } else {
        fkS.liftT += dt;
        const lt = fkS.liftT;
        let fy;
        if (lt < 1.0) fy = 0.12 + (lt / 1.0) * 0.93;          // 상승
        else if (lt < 2.1) fy = 1.05;                           // 유지
        else if (lt < 3.1) fy = 1.05 - ((lt - 2.1) / 1.0) * 0.93; // 하강
        else { fy = 0.12; fkS.mode = "drive"; fkS.timer = 5 + fkS.rng() * 6; }
        fk.forks.position.y = fy;
      }
      fk.grp.position.x = fkS.x;
      let fdh = fkS.head - fk.grp.rotation.y;
      fdh = Math.atan2(Math.sin(fdh), Math.cos(fdh));
      fk.grp.rotation.y += fdh * Math.min(1, dt * 3.2);
      fk.beacon.scale.setScalar(1 + 0.25 * Math.sin(fkS.t * 9));

      /* AGV 2대 — 웨이포인트 루프 주행, 랜덤 정차 시 리프트 디스크 회전 */
      for (const a of agvs) {
        /* ★ 배송 로봇이 통로를 쓰는 동안 AGV 는 비켜야 하는데, 사각 경로를 도는 물건이라
             **옆으로는 못 비킨다**(경로를 벗어나면 랙을 뚫는다). 그래서 **시간으로** 비킨다.
           ⚠️ 그 자리에서 그냥 세우면 안 된다. 통로 한가운데 멈춘 AGV 를 배송 로봇이 그대로
              통과해 버린다 — 셋이 나란히 설 폭이 없기 때문이다(위 주석). 통로 구간(`seg 0`)
              에 있을 때는 **끝까지 달려 빠져나간 뒤에** 선다. 실제 현장에서도 교차로
              한가운데가 아니라 빠져나가서 기다린다. */
        if (corridorBusy && a.seg !== 0) { a.u.disc.rotation.y += dt * 1.2; continue; }
        a.t += dt;
        if (a.pauseT > 0) {
          a.pauseT -= dt;
          a.u.disc.rotation.y += dt * 2.4; // 정차 중 리프트 동작
        } else {
          a.nextPause -= dt;
          if (a.nextPause <= 0) {
            a.pauseT = 1.0 + a.rng() * 1.5;
            a.nextPause = 6 + a.rng() * 9;
          }
          let move = a.speed * dt;
          while (move > 0) {
            const p0 = a.path[a.seg], p1 = a.path[(a.seg + 1) % a.path.length];
            const segLen = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
            const remain = segLen - a.prog;
            if (move < remain) { a.prog += move; move = 0; }
            else { move -= remain; a.prog = 0; a.seg = (a.seg + 1) % a.path.length; }
          }
          a.u.disc.rotation.y += dt * 0.5;
        }
        const p0 = a.path[a.seg], p1 = a.path[(a.seg + 1) % a.path.length];
        const segLen = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) || 1;
        const f = a.prog / segLen;
        a.u.grp.position.set(p0[0] + (p1[0] - p0[0]) * f, 0, p0[1] + (p1[1] - p0[1]) * f);
        const headT = Math.atan2(p1[0] - p0[0], p1[1] - p0[1]);
        let adh = headT - a.u.grp.rotation.y;
        adh = Math.atan2(Math.sin(adh), Math.cos(adh));
        a.u.grp.rotation.y += adh * Math.min(1, dt * 6);
        a.u.led.scale.y = 1 + 0.7 * Math.abs(Math.sin(a.t * (a.pauseT > 0 ? 12 : 5)));
      }

      /* ASRS 스태커 크레인 — 반출 사이클 상태 기계 (구역마다 한 대) */
      {
        const mv = (v, tv, spd) => v + Math.max(-spd * dt, Math.min(spd * dt, tv - v));
        for (const c of cranes) {
          const s = c.st;
          s.t += dt;
          c.led.scale.y = 1 + 0.35 * Math.abs(Math.sin(s.t * 3));
          /* ⚠️ 시뮬레이션이 이 크레인을 쓰는 동안은 평소 반출 사이클을 쉰다. 둘이 같이 돌면
             같은 좌표를 서로 덮어써서 크레인이 두 곳으로 동시에 가려다 떨린다. */
          if (s.phase === "sim") continue;
          if (s.phase === "pause") {
            s.timer -= dt;
            if (s.timer <= 0) {
              s.tgt = c.pickSlot();
              if (s.tgt) s.phase = "toSlot";
              else s.timer = 2; // 적재 슬롯 없음(사용률 극저) — 대기
            }
          } else if (s.phase === "toSlot") {
            c.crane.position.z = mv(c.crane.position.z, s.tgt.z, 1.7);
            c.carriage.position.y = mv(c.carriage.position.y, s.tgt.y, 1.1);
            if (Math.abs(c.crane.position.z - s.tgt.z) < 0.01 && Math.abs(c.carriage.position.y - s.tgt.y) < 0.01) {
              s.phase = "extend";
              c.depBox.visible = false; // 이전 하역분은 반출된 것으로
            }
          } else if (s.phase === "extend") {
            c.fork.position.x = mv(c.fork.position.x, s.tgt.dir * c.reach, 1.6);
            if (Math.abs(c.fork.position.x - s.tgt.dir * c.reach) < 0.01) { s.phase = "grab"; s.timer = 0.28; }
          } else if (s.phase === "grab") {
            s.timer -= dt;
            if (s.timer <= 0) {
              const gm = gradeMeshes[c.id];
              gm.im.setMatrixAt(s.tgt.i, ZERO); // 랙에서 실제 박스 반출
              gm.im.instanceMatrix.needsUpdate = true;
              c.carried.visible = true;
              s.phase = "retract";
            }
          } else if (s.phase === "retract") {
            c.fork.position.x = mv(c.fork.position.x, 0, 1.6);
            if (Math.abs(c.fork.position.x) < 0.01) s.phase = "toDrop";
          } else if (s.phase === "toDrop") {
            c.crane.position.z = mv(c.crane.position.z, c.dropZ, 1.7);
            c.carriage.position.y = mv(c.carriage.position.y, 0.34, 1.1);
            if (Math.abs(c.crane.position.z - c.dropZ) < 0.01 && Math.abs(c.carriage.position.y - 0.34) < 0.01) s.phase = "dExtend";
          } else if (s.phase === "dExtend") {
            c.fork.position.x = mv(c.fork.position.x, c.dropOff, 1.6);
            if (Math.abs(c.fork.position.x - c.dropOff) < 0.01) { s.phase = "drop"; s.timer = 0.25; }
          } else if (s.phase === "drop") {
            s.timer -= dt;
            if (s.timer <= 0) { c.carried.visible = false; c.depBox.visible = true; s.phase = "dRetract"; }
          } else if (s.phase === "dRetract") {
            c.fork.position.x = mv(c.fork.position.x, 0, 1.6);
            if (Math.abs(c.fork.position.x) < 0.01) { s.phase = "pause"; s.timer = 0.8 + c.rng() * 1.6; }
          }
        }
      }

      /* 2D 맵으로 엔티티 위치 공유 (3D 숨김 상태에서도 시뮬레이션 유지) */
      simRef.current = {
        workers: workers.map((w) => ({ x: w.m.grp.position.x, z: w.m.grp.position.z, r: w.m.grp.rotation.y })),
        agvs: agvs.map((a) => ({ x: a.u.grp.position.x, z: a.u.grp.position.z, r: a.u.grp.rotation.y })),
        fk: { x: fk.grp.position.x, z: fk.grp.position.z, r: fk.grp.rotation.y },
        cranes: cranes.map((c) => ({ x: c.crane.position.x, z: c.crane.position.z, carrying: c.carried.visible })),
      };

      /* 벽 자동 페이드 — 카메라가 벽 너머로 넘어가면 해당 벽 투명화 */
      {
        const camP = camera.position;
        const fadeWall = (list, hide) => {
          for (const w of list) {
            const target = hide ? 0 : 1;
            w.material.opacity += (target - w.material.opacity) * Math.min(1, dt * 7);
            w.visible = w.material.opacity > 0.03;
          }
        };
        fadeWall(wallSets.back, camP.z < zMin + 2.5);
        fadeWall(wallSets.left, camP.x < -floorW / 2 + 2.5);
        /* ★ 오른쪽 벽만 **확대해도** 사라진다 (사용자 요청). 그 너머 도크에서 상차가
             돌아가고 있는데, 벽이 정확히 그 사이를 막고 있다 — 창고 안에서 당겨 보면
             트럭 짐칸이 보여야 한다.
           ⚠️ 기준은 카메라 **거리**(`cur.r`)다. 화면에 꽉 차게 당겼는지를 재는 값이라,
              어디를 보고 있든 "확대했다"와 뜻이 같다.
           ⚠️ 나머지 두 벽은 그대로 둔다. 셋 다 이렇게 하면 조금만 당겨도 창고가 지붕 없는
              평면도가 되어, 안에 있다는 느낌이 사라진다. */
        fadeWall(wallSets.right, camP.x > floorW / 2 - 2.5 || cur.r < 15);
      }

      /* ── 갱신 순서 ───────────────────────────────────────────────────
         ⚠️ 움직이는 것들을 **카메라보다 먼저** 갱신한다. 예전에는 렌더 뒤에 있어서 카메라가
            늘 **한 프레임 전의 자리**를 보고 있었다 — 초당 60프레임이면 6.2m/s 로 달리는
            로봇이 매 프레임 10cm 씩 앞서 나간다. 화면이 못 따라오는 것처럼 보이던 원인이다. */
      portal.update(dt, portalHovered);   // dt 는 위에서 이미 0.05 로 잘려 있다
      exterior.update(dt);   // 도크 상차 장면 (뒷문·롤러·피글린)
      for (const st of stations) st.update(dt, st === hoveredStation, st === focusedStation);
      inboundSim?.update(dt);

      if (inboundSim?.running && followSim) {
        /* ── 시뮬레이션 카메라 (영화처럼) ────────────────────────────
           ★ 궤도 컨트롤(`des` → `cur` 감쇠)을 **거치지 않고 카메라를 직접 몬다.** 그 감쇠는
             프레임마다 9% 씩 좁히는 고정 비율이라, 목표가 가만히 있을 때는 부드럽지만
             목표가 매 프레임 도망가면 영원히 따라잡지 못한다. 실제로 화면이 뒤처져 보였다.
           ★ 대신 **지수 감쇠**를 쓴다: `1 - exp(-k·dt)`. 프레임률이 달라져도 같은 시간에
             같은 만큼 좁혀지고, k 를 크게 잡아 바짝 붙일 수 있다.
           ⚠️ 카메라가 볼 점과 설 자리를 따로 감쇠한다. 보는 쪽을 더 빠르게(k 6) 해야 시선이
              짐에 붙어 있고, 자리를 느리게(k 3) 해야 카메라가 미끄러지듯 따라온다. 둘을 같은
              값으로 두면 딱딱한 리그에 매단 것처럼 보인다.
           ⚠️ 이 값도 함께 낮췄다. 자리만 느리고 목표가 빠르면 카메라가 늘 뒤처진 채 끌려가는데,
              그 어긋남이 화면을 흔들리게 만든다 — 두 값은 같이 움직여야 한다. */
        const cam = inboundSim.cam;
        const f = inboundSim.focus;

        /* 각도·거리·높이 모두 시뮬레이션이 장면에 맞게 정해 준다(`inbound-sim` 의 `cam`).
           여기서는 **옮기기만** 한다 — 장면이 바뀌면 값이 갈리고, 그 사이를 이 감쇠가
           이어 주므로 컷이 아니라 카메라가 걸어서 옮겨 가는 그림이 된다.
           ★ 계수를 절반 아래로 낮췄다 (사용자 요청 — 화면이 정신없다). 1.0~1.1 이면 한 장면에서
             다음 장면으로 옮겨 가는 데 2~3초가 걸린다. 그 느림이 곧 "내려앉는다 / 올라간다"는
             동작으로 읽힌다 — 빠르면 그냥 순간이동이고, 이 화면의 어지러움이 거기서 왔다.
           ⚠️ 각도를 거리보다 조금 더 느리게 옮긴다(1.0 : 1.1). 방향이 먼저 홱 돌면 장면이
              바뀐 게 아니라 카메라가 튄 것처럼 보인다. */
        /* ★ 짐이 빨라진 만큼(`inbound-sim` 의 속도 주석) 계수를 함께 올렸다: 1.0/1.1 → 1.3/1.4.
             짐만 빨라지면 카메라가 뒤처진 채 끌려가고, 그 어긋남이 곧 어지러움이다. */
        /* ★ 각도·거리를 **감쇠하지 않고 그대로 쓴다** (사용자 지적 — 마지막 적재에서 시야가
             슬롯을 통과한다).
             원인이 여기 있었다. 통로(az -π/2)에서 골목(az ≈ 0)으로 각을 서서히 돌리면,
             그 **중간 각들이 만드는 자리**가 통로도 골목도 아닌 랙 한가운데다 — 구면 좌표를
             보간하면 카메라가 호를 그리며 지나가기 때문이다. 자리를 직선으로 옮기면 그런
             중간 지점이 안 생긴다.
           ⚠️ 부드러움은 여기서 만들지 않는다. 아래 `camPos.lerp` 가 **직선으로** 따라가고,
              `aim` 이 시선을 걸러 준다 — 두 겹이면 충분하다. */
        filmAz = cam.az;
        filmDist = cam.dist;
        filmPol = cam.pol;

        /* 짐의 잔떨림을 먼저 걸러 낸다 (위 `aim` 주석 참고). 카메라 자리와 시선이 **둘 다**
           이 값을 기준으로 잡혀야 어긋나지 않는다 */
        /* ── 위아래는 더 빨리 따라간다 ─────────────────────────────
           ★ 크레인이 짐을 올릴 때 화면이 뒤늦게 따라 올라갔다 (사용자 지적). 크레인은
             3.6m/s 로 오르는데 감쇠 2.4 는 90% 따라잡는 데 1초가 걸려서, 짐이 화면 위로
             빠져나갔다가 뒤늦게 가운데로 돌아온다.
           ⚠️ 그렇다고 **전체를 빠르게 하면 안 된다.** 예전에 어지럽다고 한 원인이 가로
              방향의 급한 추적이었다. 크레인 승강은 세로 한 축뿐이므로, **y 만** 빠르게
              하고 x·z 는 그대로 둔다 — 흔들림은 가로에서 오고 지연은 세로에서 왔다. */
        const kA = 1 - Math.exp(-2.4 * dt), kAy = 1 - Math.exp(-5.0 * dt);
        aim.x += (f.x - aim.x) * kA;
        aim.z += (f.z - aim.z) * kA;
        aim.y += (f.y - aim.y) * kAy;

        const sinP = Math.sin(filmPol);
        wantPos.set(
          aim.x + filmDist * sinP * Math.sin(filmAz),
          aim.y + filmDist * Math.cos(filmPol),
          aim.z + filmDist * sinP * Math.cos(filmAz),
        );
        /* ⚠️ 카메라가 내려갈 수 있는 **바닥 높이**를 지킨다. 각을 낮추면 화면이 훨씬
           현장 같아지지만, 구역 통로(폭 1.7m, 양쪽이 랙) 옆에서는 그대로 선반을 뚫는다.
           얼마까지 내려가도 되는지는 지금 무엇을 보는지 아는 쪽이 안다 — `cam.minY` 다. */
        if (wantPos.y < cam.minY) wantPos.y = cam.minY;
        /* ★ 골목에서 빠져나오는 동안은 **x 를 붙든다** (`inbound-sim` 의 `EXIT_HOLD` 참고).
             카메라 자리를 직선으로 당기다 보니, 골목에서 통로로 나오는 것과 다음 구역으로
             x 를 옮기는 것이 겹쳐 그 대각선이 사이의 랙을 관통했다. x 를 잠깐 묶어 두면
             통로로 먼저 나온 다음에 통로를 타고 옮겨 간다 — 사람이 걷는 길과 같다. */
        if (cam.corridorFirst) wantPos.x = camPos.x;
        /* ★ 반대로 **들어갈 때는 z 를 붙든다** (`inbound-sim` 의 `ENTER_HOLD` 참고).
             통로를 따라 그 골목의 x 까지 먼저 가고, 거기서 꺾어 들어간다. 안 붙들면
             통로에서 골목 깊숙한 곳까지 대각선으로 질러가며 랙 줄을 관통한다. */
        if (cam.alignFirst) wantPos.z = camPos.z;
        /* ★ 자리와 시선의 감쇠를 **거의 같게** 맞췄다 (3.0 / 6.0 → 2.0 / 2.6). 시선이
             자리보다 두 배 빠르면, 카메라가 아직 옮겨 가는 중에 고개만 먼저 홱 돌아간다
             — 그 어긋남이 "화면이 미끄러진다"는 느낌의 정체다. 사람이 걸으며 무엇을 볼
             때 머리와 몸은 거의 같은 속도로 돈다.
           ⚠️ 느리게 잡을수록 부드럽지만 그만큼 뒤처진다. 2.0 이면 90% 따라잡는 데
              1.15초 — 짐이 6.2m/s 로 가도 화면 안에 남는다. */
        const kP = 1 - Math.exp(-2.0 * dt), kPy = 1 - Math.exp(-4.4 * dt);
        camPos.x += (wantPos.x - camPos.x) * kP;
        camPos.z += (wantPos.z - camPos.z) * kP;
        camPos.y += (wantPos.y - camPos.y) * kPy;
        const kL = 1 - Math.exp(-2.6 * dt), kLy = 1 - Math.exp(-5.4 * dt);
        camLook.x += (aim.x - camLook.x) * kL;
        camLook.z += (aim.z - camLook.z) * kL;
        camLook.y += (aim.y - camLook.y) * kLy;
        camera.position.copy(camPos);
        camera.lookAt(camLook);

        /* 끝나는 순간 궤도가 엉뚱한 자리에서 이어지지 않게, 지금 카메라를 궤도 값으로
           **되돌려 적어 둔다.** 이렇게 해 두면 시뮬레이션이 끝나도 화면이 튀지 않는다 */
        const off = camPos.clone().sub(camLook);
        cur.r = des.r = Math.max(0.5, off.length());
        cur.pol = des.pol = Math.acos(Math.min(1, Math.max(-1, off.y / cur.r)));
        cur.az = des.az = Math.atan2(off.x, off.z);
        cur.tx = des.tx = camLook.x;
        cur.ty = des.ty = camLook.y;
        cur.tz = des.tz = camLook.z;
      } else {
        if (!inboundSim?.running) followSim = false;
        /* 카메라 감쇠 (평소) */
        cur.az += (des.az - cur.az) * 0.09;
        cur.pol += (des.pol - cur.pol) * 0.09;
        cur.r += (des.r - cur.r) * 0.09;
        cur.tx += (des.tx - cur.tx) * 0.09;
        cur.ty += (des.ty - cur.ty) * 0.09;
        cur.tz += (des.tz - cur.tz) * 0.09;
        applyCam();
      }

      /* ── 슬롯 팝업 자리 ──
         3D 의 한 점을 화면 좌표로 옮긴다: `project` 가 -1~1 의 정규화 좌표를 주므로 화면
         크기에 맞춰 편다. y 는 부호가 반대다 — 3D 는 위가 +, 화면은 아래가 + 다.
         ⚠️ `z > 1` 이면 **카메라 뒤**다. 그대로 두면 화면 반대편에 유령처럼 뜬다.
         ⚠️ 가장자리에서 안쪽으로 물린다. 슬롯이 화면 끝에 있을 때 팝업이 절반만 보이면
            없느니만 못하다. */

      if (mount.clientWidth > 4) renderer.render(scene, camera);
      raf = requestAnimationFrame(tick);
    };
    applyDay(29);
    applyCam();
    tick();

    const ro = new ResizeObserver(() => {
      const w = mount.clientWidth, h = mount.clientHeight;
      if (w < 4 || h < 4) return;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    });
    ro.observe(mount);

    return () => {
      el.removeEventListener("pointermove", onHover);
      portal.dispose();
      exterior.dispose();
      for (const st of stations) st.dispose();
      inboundSim?.dispose();
      cancelAnimationFrame(raf);
      ro.disconnect();
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", onUp);
      el.removeEventListener("dblclick", onDbl);
      window.removeEventListener("keydown", onKey);
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("contextmenu", onContextMenu);
      window.removeEventListener("contextmenu", onWindowContextMenu);
      audio?.stop();
      renderer.dispose();
      mount.removeChild(renderer.domElement);
    };
    /* `audio` 는 `useState` 초기화로 한 번만 만들어져 바뀌지 않는다 — 넣어도 씬을
       다시 만들지 않는다 */
  }, [audio]);

  useEffect(() => { apiRef.current?.applyDay(day); }, [day]);
  useEffect(() => {
    apiRef.current?.setHighlight(sel);
    if (sel) apiRef.current?.flyTo(sel);
    else apiRef.current?.resetView();
  }, [sel]);
  useEffect(() => {
    if (!playing) return;
    const iv = setInterval(() => {
      setDay((d) => {
        if (d >= 60) { setPlaying(false); return d; }
        return d + 1;
      });
    }, 240);
    return () => clearInterval(iv);
  }, [playing]);

  useEffect(() => { statsRef.current = stats; }, [stats]);


  /* ── 2D 실시간 탑뷰 맵 ── */
  useEffect(() => {
    const wrap = mapWrapRef.current, cvs = mapCanvasRef.current;
    if (!wrap || !cvs) return;
    const layout = computeLayout();
    const zMin = -CORRIDOR / 2 - layout.backLen - 3.0;
    /* 지도에서만 뒤쪽(입고장)을 짧게 끊는다.
       ★ 3D 바닥은 +6.5m 까지 있지만, 그 뒤편은 파렛트 몇 장뿐이라 지도에서는 빈 회색 띠로만
         보인다. 그만큼 세로를 먹으면 정작 봐야 할 랙이 작아진다. 지게차 주행선(+1.5)과
         입고장 표시선(+1.7)이 들어갈 만큼만 남기고 자른다.
       ⚠️ 3D 쪽 `zMax` 는 건드리지 않는다 - 그건 바닥 크기라 줄이면 물건이 바닥 밖에 뜬다.
          여기서 잘리는 건 **지도의 시야**일 뿐이다. */
    const zMax = CORRIDOR / 2 + layout.frontLen + 3.5;
    const floorW = Math.max(...layout.rowWidths) + 11;
    const worldD = zMax - zMin;
    let scale = 1, ox = 0, oy = 0, dpr = 1;
    const fit = () => {
      dpr = Math.min(window.devicePixelRatio, 2);
      const w = Math.max(10, wrap.clientWidth), h = Math.max(10, wrap.clientHeight);
      cvs.width = w * dpr; cvs.height = h * dpr;
      cvs.style.width = w + "px"; cvs.style.height = h + "px";
      const s = Math.min((w - 28) / floorW, (h - 40) / worldD);
      scale = s;
      ox = (w - floorW * s) / 2;
      oy = (h - worldD * s) / 2 + 4;
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(wrap);
    const X = (wx) => ox + (wx + floorW / 2) * scale;
    const Y = (wz) => oy + (wz - zMin) * scale;
    const rgba = (n, a) => `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
    /* ── 98 팔레트 ──────────────────────────────────────────────────
       ★ 어두운 탑뷰에서 **분석 화면과 같은 밝은 98 지도**로 올렸다 (사용자 요청 — 그쪽으로
         업그레이드했으니 여기도 맞춰 달라). 두 화면이 같은 창고를 그리는데 한쪽만 검은
         화면이면, 같은 것을 보고 있다는 사실이 안 읽힌다.
       ⚠️ 데이터는 **그대로 여기 것을 쓴다.** 분석 쪽 지도는 2D 자족 사본이라 움직이는 것들이
          가짜 궤적이고 날짜도 고정이다. 컴포넌트를 갈아끼우면 이 화면이 가진 실제 AGV·지게차
          위치와 날짜 슬라이더 연동을 잃는다 — 그래서 **그림만** 옮겨 왔다.
       ⚠️ 98 기본 회색(#C0C0C0)은 누런 기가 있어 넓게 깔면 화면을 덮는다. 중성 회색 쪽으로
          올려 쓴다 (분석 화면과 같은 값). */
    const W98 = { face: "#C6C6C6", light: "#FFFFFF", shadow: "#808080", navy: "#000080", ink: "#000000" };
    const MAP_FLOOR = "#DCDCDC";
    /* 옅은 구역 색(A~F 는 전부 청회색)이 밝은 바닥에서 묻히지 않게 눌러 준다 */
    const dim = (n, k) =>
      (Math.round(((n >> 16) & 255) * k) << 16) |
      (Math.round(((n >> 8) & 255) * k) << 8) |
      Math.round((n & 255) * k);
    const px = (v) => Math.round(v) + 0.5;
    const ctx = cvs.getContext("2d");
    let raf;
    const draw = () => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const w = cvs.width / dpr, h = cvs.height / dpr;
      /** 튀어나온 테두리 (`out`) / 들어간 테두리 */
      const bevel = (bx, by, bw, bh, out = true) => {
        ctx.lineWidth = 1;
        ctx.strokeStyle = out ? W98.light : W98.shadow;
        ctx.beginPath();
        ctx.moveTo(px(bx), px(by + bh)); ctx.lineTo(px(bx), px(by)); ctx.lineTo(px(bx + bw), px(by));
        ctx.stroke();
        ctx.strokeStyle = out ? W98.shadow : W98.light;
        ctx.beginPath();
        ctx.moveTo(px(bx + bw), px(by)); ctx.lineTo(px(bx + bw), px(by + bh)); ctx.lineTo(px(bx), px(by + bh));
        ctx.stroke();
      };
      ctx.fillStyle = W98.face; ctx.fillRect(0, 0, w, h);
      // 바닥 — 화면 안쪽으로 들어간 판
      ctx.fillStyle = MAP_FLOOR;
      ctx.fillRect(X(-floorW / 2), Y(zMin), floorW * scale, worldD * scale);
      bevel(X(-floorW / 2), Y(zMin), floorW * scale, worldD * scale, false);
      // 그리드
      ctx.strokeStyle = "rgba(0,0,0,0.05)"; ctx.lineWidth = 1;
      for (let gx = Math.ceil(-floorW / 2 / 2) * 2; gx <= floorW / 2; gx += 2) {
        ctx.beginPath(); ctx.moveTo(X(gx), Y(zMin)); ctx.lineTo(X(gx), Y(zMax)); ctx.stroke();
      }
      for (let gz = Math.ceil(zMin / 2) * 2; gz <= zMax; gz += 2) {
        ctx.beginPath(); ctx.moveTo(X(-floorW / 2), Y(gz)); ctx.lineTo(X(floorW / 2), Y(gz)); ctx.stroke();
      }
      /* 작업 통로
         ★ 예전에는 통로 띠를 `CORRIDOR` 폭(3.2m) 그대로 그렸다. 그런데 아래에서 구역
           사각형을 랙보다 0.4m 크게 그리므로(여백), 양쪽 구역이 통로를 0.4m 씩 먹고
           들어와 노란 선이 사각형 위를 지나갔다.
         ★ 그래서 통로를 **실제로 비어 있는 만큼만** 그린다: 구역 사각형이 끝나는 지점부터
           맞은편 사각형이 시작하는 지점까지. 겹치지 않고, 자연히 좁아진다.
         ⚠️ `ZONE_PAD` 는 아래 구역 그리기의 여백과 **같은 값이어야 한다.** 한쪽만 바꾸면
            다시 겹친다. */
      const ZONE_PAD = 0.4;
      const laneA = -CORRIDOR / 2 + ZONE_PAD;   // 뒷줄 사각형이 끝나는 z
      const laneB = CORRIDOR / 2 - ZONE_PAD;    // 앞줄 사각형이 시작하는 z
      ctx.fillStyle = "#BECCBE";      // 물 빠진 초록 — 바닥 밝기에 맞춰 함께 움직인다
      ctx.fillRect(X(-floorW / 2), Y(laneA), floorW * scale, (laneB - laneA) * scale);
      ctx.strokeStyle = "#8A7A20"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(X(-floorW / 2), Y(laneA)); ctx.lineTo(X(floorW / 2), Y(laneA)); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(X(-floorW / 2), Y(laneB)); ctx.lineTo(X(floorW / 2), Y(laneB)); ctx.stroke();
      ctx.strokeStyle = W98.ink; ctx.setLineDash([5, 4]); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(X(-floorW / 2), Y(0)); ctx.lineTo(X(floorW / 2), Y(0)); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = "rgba(48,56,68,0.62)";
      ctx.font = `700 15px ${MAP_FONT}`; ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
      ctx.fillText("작업 통로", X(-floorW / 2) + 6, Y(0) + 3);
      // 하역 라인
      /* 하역 라인 경계선.
         ★ +1.7 에서 +3.1 로 내렸다. 원래 자리는 앞줄(D·E·F) 이름 줄과 같은 높이여서,
           점선이 글자를 관통했다(위 스크린샷의 "대형 185/220" 이 선 위에 얹힌 상태).
           라벨 두 줄이 끝나는 아래로 보내면 셋이 서로 안 겹친다. */
      const inZ = CORRIDOR / 2 + layout.frontLen + 3.1;
      ctx.strokeStyle = "#7A3A00"; ctx.setLineDash([7, 5]); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(X(-floorW / 2 + 1.5), Y(inZ)); ctx.lineTo(X(floorW / 2 - 1.5), Y(inZ)); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = "#5A4030";
      /* 글자를 선 **위**에 둔다. 아래에 두면 그만큼 지도 세로가 더 필요해지는데,
         잘라낸 뒤라 그 여유가 없다. 왼쪽 끝이라 구역 라벨과 가로로 겹치지도 않는다. */
      ctx.fillText("UNLOADING 하역 라인 →", X(-floorW / 2) + 6, Y(inZ) - 7);
      // 구역 (점유율 따라 채움 농도 변화)
      const st = statsRef.current;
      ctx.textAlign = "center";
      for (const z of layout.zones) {
        const col = z.g.color;
        const pg = st?.perGrade?.[z.g.id];
        const occ = pg ? pg.filled / pg.total : 0.5;
        const rx = X(z.x0 - 0.35), ry = Y(z.zStart - 0.4);
        const rw = (z.width + 0.7) * scale, rh = (z.len + 0.8) * scale;
        /* 구역 = 튀어나온 회색 판. 구역 색은 **판이 아니라 위쪽 띠**로만 쓴다 — 여섯 판을
           전부 다른 색으로 칠하면 98 이 아니라 색종이가 된다.
           ⚠️ 판을 바닥보다 조금 어둡게 둔다. 같은 밝기면 튀어나온 테두리만으로는 판이 떠
              있는 것이 안 읽힌다. */
        ctx.fillStyle = "#C9C9C9";
        ctx.fillRect(rx, ry, rw, rh);
        bevel(rx, ry, rw, rh, true);
        ctx.fillStyle = rgba(dim(col, 0.85), 1);
        ctx.fillRect(rx + 2, ry + 2, rw - 4, 5);

        // 랙 — 진한 회청색 블록 + 검은 테두리
        for (const rkx of z.racks) {
          const bx = X(rkx - z.depth / 2), bw2 = z.depth * scale;
          const by = Y(z.zStart), bh2 = z.len * scale;
          ctx.fillStyle = rgba(dim(col, 0.55), 1);
          ctx.fillRect(bx, by, bw2, bh2);
          ctx.strokeStyle = W98.ink; ctx.lineWidth = 1;
          ctx.strokeRect(px(bx), px(by), Math.round(bw2), Math.round(bh2));
        }
        if (z.g.cold) {
          /* 냉장 구역 — 98 의 '선택된 항목' 표시와 같은 점선 테두리 */
          ctx.strokeStyle = W98.ink; ctx.setLineDash([2, 2]);
          ctx.strokeRect(px(X(z.x0 - z.pad)), px(Y(z.zStart - z.pad)),
            Math.round((z.width + z.pad * 2) * scale), Math.round((z.len + z.pad * 2) * scale));
          ctx.setLineDash([]);
        }
        /* 라벨을 어느 쪽에 붙일까
           ★ 뒷줄(A·B·C)은 **사각형 위**, 앞줄(D·E·F)은 아래에 붙인다. 둘 다 아래에 붙이면
             뒷줄 라벨이 작업 통로 한가운데에 떠서, 통로 표시와 글자가 서로를 가린다.
             바깥쪽으로 밀어내면 두 줄 모두 자기 사각형에 붙어 있으면서 통로가 비워진다.
           ⚠️ 위쪽은 순서를 뒤집어 단다. 기호(A)가 사각형에 가깝고 이름이 바깥이라야,
              아래쪽 줄(기호가 위·이름이 아래)과 읽는 방향이 같아진다.
           ⚠️ 24px 글자의 글리프는 기준선 위로 약 24px 을 차지한다. 두 줄 간격을 26px 보다
              좁히면 이름 아랫부분과 기호 윗부분이 겹친다. */
        const above = z.row === 0;
        /* ── 라벨 한 줄 + 점유 눈금 (분석 화면과 같은 짜임) ──
           ⚠️ 기준선(baseline)은 글자의 **아랫변이 아니다.** 17px 글자는 기준선 아래로 5px
              남짓 더 내려간다(디센더). 기준선과 눈금 사이를 좁히면 글자 아랫부분이 눈금에
              덮여 잘려 보인다.
           ⚠️ 좁으면 이름을 버리고 숫자만 남긴다 — 이름보다 채움 수가 정보다. 구역 사이가
              2.3m 벌어져 있어 양쪽으로 28px 씩 빌려도 옆 라벨과 안 부딪힌다. */
        const codeY = above ? ry - 27 : ry + rh + 17;
        const barY = above ? ry - 18 : ry + rh + 27;
        ctx.fillStyle = W98.ink;
        ctx.font = `700 17px ${MAP_FONT}`;
        const head = `${z.g.code} · ${z.g.name}`;
        const num = pg ? `${pg.filled}/${pg.total}` : "";
        const room = rw + 56;
        ctx.fillText(
          ctx.measureText(`${head}  ${num}`).width <= room ? `${head}  ${num}` : num || head,
          rx + rw / 2, codeY,
        );
        /* 점유 눈금 — 98 진행 막대. 칸이 몇 개 찼는지로 점유율을 읽는다 */
        const pw2 = Math.min(rw, 86), phh = 9;
        const pxx = rx + (rw - pw2) / 2;
        ctx.fillStyle = "#CFCFCF";
        ctx.fillRect(pxx, barY, pw2, phh);
        bevel(pxx, barY, pw2, phh, false);
        const cells = 10, cw2 = (pw2 - 4) / cells;
        ctx.fillStyle = occ > 0.85 ? "#A00000" : W98.navy;
        for (let i = 0; i < Math.round(occ * cells); i += 1) {
          ctx.fillRect(pxx + 2 + i * cw2, barY + 2, cw2 - 1.5, phh - 4);
        }
      }
      // 실시간 엔티티
      const sim = simRef.current;
      if (sim) {
        /* ASRS 스태커 크레인 + 레일 — 세 구역에 한 대씩.
           ⚠️ 레일 길이는 크레인이 선 **그 구역**의 길이여야 한다. 예전에는 항상 첫 구역
              (A)의 길이를 썼는데, 크레인이 늘어난 뒤로는 B·E 의 레일이 엉뚱한 길이로
              그려진다. 크레인의 x 로 구역을 되찾아 그 길이를 쓴다. */
        for (const cr of sim.cranes ?? []) {
          const zc = layout.zones.find((zz) => cr.x >= zz.x0 - 0.5 && cr.x <= zz.x0 + zz.width + 0.5);
          if (zc) {
            ctx.strokeStyle = "rgba(0,0,0,0.35)"; ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(X(cr.x), Y(zc.zStart));
            ctx.lineTo(X(cr.x), Y(zc.zStart + zc.len));
            ctx.stroke();
          }
          ctx.fillStyle = "#F2F4F6";
          ctx.fillRect(X(cr.x) - 4, Y(cr.z) - 4, 8, 8);
          ctx.fillStyle = cr.carrying ? "#FFB040" : "#35D96B";
          ctx.beginPath(); ctx.arc(X(cr.x), Y(cr.z) - 7, 2.5, 0, Math.PI * 2); ctx.fill();
        }
        for (const a of sim.agvs) { // AGV — 흰 원 + 파랑 링 + 시안 헤딩
          const ax = X(a.x), ay = Y(a.z);
          ctx.fillStyle = "#F2F4F6";
          ctx.beginPath(); ctx.arc(ax, ay, 5.5, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = "#1E63C8"; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(ax, ay, 5.5, 0, Math.PI * 2); ctx.stroke();
          ctx.fillStyle = "#53E0FF";
          ctx.beginPath();
          ctx.arc(ax + Math.sin(a.r) * 7, ay + Math.cos(a.r) * 7, 2, 0, Math.PI * 2);
          ctx.fill();
        }
        if (sim.fk) { // 지게차 — 주황 사각 + 포크 라인
          ctx.save();
          ctx.translate(X(sim.fk.x), Y(sim.fk.z));
          ctx.rotate(Math.atan2(Math.cos(sim.fk.r), Math.sin(sim.fk.r)));
          ctx.fillStyle = "#F0A81E";
          ctx.fillRect(-8, -5, 16, 10);
          ctx.strokeStyle = "#596470"; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(8, -3); ctx.lineTo(14, -3); ctx.moveTo(8, 3); ctx.lineTo(14, 3); ctx.stroke();
          ctx.restore();
        }
        for (let i = 0; i < sim.workers.length; i++) { // 작업자 — 안전모 색 점
          const wk = sim.workers[i];
          const wx = X(wk.x), wy = Y(wk.z);
          ctx.fillStyle = i === 0 ? "#FFD23E" : "#F2F5F8";
          ctx.beginPath(); ctx.arc(wx, wy, 4, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = W98.ink; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.arc(wx, wy, 4, 0, Math.PI * 2); ctx.stroke();
          ctx.strokeStyle = i === 0 ? "#FFD23E" : "#F2F5F8";
          ctx.beginPath(); ctx.moveTo(wx, wy);
          ctx.lineTo(wx + Math.sin(wk.r) * 8, wy + Math.cos(wk.r) * 8);
          ctx.stroke();
        }
      }
      // 헤더
      ctx.textAlign = "left";
      ctx.fillStyle = W98.ink; ctx.font = `700 15px ${MAP_FONT}`;
      ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
      ctx.fillText("Warehouse — 실시간 창고 맵", 9, 19);
      raf = requestAnimationFrame(draw);
    };
    draw();
    const onClick = (e) => {
      const rect = cvs.getBoundingClientRect();
      const wx = (e.clientX - rect.left - ox) / scale - floorW / 2;
      const wz = (e.clientY - rect.top - oy) / scale + zMin;
      let hit = null;
      for (const z of layout.zones) {
        if (wx >= z.x0 - 0.6 && wx <= z.x0 + z.width + 0.6 && wz >= z.zStart - 0.7 && wz <= z.zStart + z.len + 0.7) {
          hit = z.g.id; break;
        }
      }
      if (hit) {
        setSel(hit);
        apiRef.current?.setHighlight(hit);
        apiRef.current?.flyTo(hit);
      } else {
        setSel(null);
        apiRef.current?.setHighlight(null);
        apiRef.current?.resetView();
      }
      setTab("3d");
    };
    cvs.addEventListener("click", onClick);
    cvs.style.cursor = "pointer";
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      cvs.removeEventListener("click", onClick);
    };
  }, []);

  const dateTxt = REAL_DATE_LABEL[day];
  const u = stats?.u ?? CURVE[day];
  const usedVol = ((u / 100) * TOTAL_CAP).toFixed(1);
  const over = u >= THRESHOLD;

  /* 스파크라인 */
  const chartW = 560, chartH = 74;
  const cx = (d) => 6 + (d / 60) * (chartW - 12);
  const cy = (v) => chartH - 8 - ((v - 15) / (72 - 15)) * (chartH - 16);
  const path = CURVE.map((v, d) => `${d === 0 ? "M" : "L"}${cx(d).toFixed(1)},${cy(v).toFixed(1)}`).join(" ");
  const area = path + ` L${cx(60)},${chartH} L${cx(0)},${chartH} Z`;

  const toggleSel = useCallback((id) => setSel((s) => (s === id ? null : id)), []);

  if (!webglOk) {
    return <div style={{ padding: 40, fontFamily: "sans-serif", color: "#ccc", background: "#0c1117", height: "100%" }}>
      WebGL을 사용할 수 없는 환경입니다. 브라우저에서 하드웨어 가속을 켜고 다시 열어 주세요.
    </div>;
  }

  return (
    /* ── 대시보드 셸 안에 들어가는 형태 ────────────────────────────────
       ★ 원본의 win98 셸(타이틀바·메뉴줄·좌측 사이드바·작업표시줄)을 걷어냈다. 이 앱은
         이미 자기 셸을 갖고 있어서, 그대로 두면 창 안에 창이 또 있는 모양이 된다.
       ★ 높이를 `100vh` → **`100%`** 로 바꿨다. 고정 스테이지(1600×1004) 안에 들어가므로
         뷰포트 높이를 쓰면 스테이지 밖까지 잡는다.
       ⚠️ **부모가 높이를 갖고 있어야 한다.** three.js 렌더러가 부모 크기를 재서 캔버스를
          맞추는데, 부모 높이가 0 이면 아무것도 안 그려진다.
       ⚠️ 3D 판이 `display:none` 일 때 폭이 0 이 되면 렌더러가 깨진다. 원본의 폭 가드
          (`clientWidth > 4`)를 그대로 두었다 — 지우지 말 것. */
    <div ref={rootRef} className="w98" style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden" }}>
      {/* 바깥 테두리. 작업표시줄이 없어졌으니 아래 여백(bottom: 42)도 없앤다 */}
      <div className="w98-raised" style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column" }}>
        {/* 2D ↔ 3D 전환 — 원본의 사이드바·작업표시줄 버튼을 대신한다.
            ⚠️ 내부 상태 이름(`tab === "map" | "3d"`)은 그대로 쓴다. 두 판의 display 와
               three.js 쪽 로직이 그 값을 보고 있어서, 이름을 바꾸면 고칠 곳이 늘어난다. */}
        <div
          style={{ display: "flex", gap: 8, padding: "6px 8px", flexShrink: 0, alignItems: "center" }}
        >
          <Button
            type="button"
            size="sm"
            variant={tab === "map" ? "default" : "outline"}
            onClick={() => setTab("map")}
          >
            실시간 지도
          </Button>
          <Button
            type="button"
            size="sm"
            variant={tab === "3d" ? "default" : "outline"}
            onClick={() => setTab("3d")}
          >
            3D 뷰
          </Button>
          <span style={{ fontSize: 11, color: "#404040", marginLeft: 2 }}>
            슬롯 창고 — 실측 물동량 61일 (2024-08-01 ~ 10-31)
          </span>
        </div>
        <div style={{ flex: 1, display: "flex", minHeight: 0, padding: 3, gap: 3 }}>
          {/* ── 콘텐츠 ── */}
          <div className="w98-sunken" style={{ flex: 1, position: "relative", minWidth: 0, background: "#0c1117", overflow: "hidden" }}>
            {/* ── MAP PANE (2D 실시간 탑뷰) ── */}
            <div style={{ display: tab === "map" ? "flex" : "none", flexDirection: "column", position: "absolute", inset: 0 }}>
              <div className="w98-raised" style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 8px", margin: 2, flexShrink: 0 }}>
                <button className="w98-btn" onClick={() => { if (day >= 60) setDay(0); setPlaying((p) => !p); }}>{playing ? "II 정지" : "► 재생"}</button>
                <span style={{ whiteSpace: "nowrap" }}>{dateTxt} (D+{day})</span>
                <input type="range" min="0" max="60" value={day} aria-label="날짜"
                  onChange={(e) => { setPlaying(false); setDay(+e.target.value); }} style={{ flex: 1, minWidth: 60 }} />
                <span className="w98-cell w98-sunken" style={{ color: over ? "#A00000" : "#000080", fontWeight: "bold" }}>사용률 {u.toFixed(1)}%</span>
                <button className="w98-btn" onClick={() => { setSel(null); apiRef.current?.setHighlight(null); apiRef.current?.resetView(); setTab("3d"); }}>3D 전체 ▶</button>
              </div>
              <div ref={mapWrapRef} style={{ flex: 1, margin: "0 2px", position: "relative", overflow: "hidden", background: "#10151C", border: "2px solid", borderColor: "#404040 #FFF #FFF #404040" }}>
                <canvas ref={mapCanvasRef} style={{ position: "absolute", inset: 0 }} />
              </div>
              <div style={{ display: "flex", gap: 2, margin: 2, flexShrink: 0 }}>
                <span className="w98-cell w98-sunken">슬롯 {stats ? stats.shownTotal.toLocaleString() : "4,004"}</span>
                <span className="w98-cell w98-sunken">▲ 입고 {stats?.inn?.toLocaleString() ?? "—"} · ▼ 출고 {stats?.out?.toLocaleString() ?? "—"}</span>
                <span className="w98-cell w98-sunken">총용량 866.9㎥</span>
                <span className="w98-cell w98-sunken" style={{ flex: 1, textAlign: "right" }}>구역 클릭 → 해당 구역 3D 진입 · 빈 곳 클릭 → 3D 전체</span>
              </div>
            </div>
            {/* ── 3D PANE ── */}
            <div
              className={simActive ? "ws-film" : undefined}
              style={{ display: tab === "3d" ? "block" : "none", position: "absolute", inset: 0 }}
              onContextMenu={(e) => e.preventDefault()}
            >
              <div className="w98-raised ws-3dtools" style={{ position: "absolute", top: 0, left: 0, right: 0, height: 32, display: "flex", alignItems: "center", gap: 6, padding: "0 6px", zIndex: 20 }}>
                <button className="w98-btn" onClick={() => { setTab("map"); setSel(null); apiRef.current?.setHighlight(null); }}>◀ 지도</button>
                <button className="w98-btn" onClick={() => { setSel(null); apiRef.current?.setHighlight(null); apiRef.current?.resetView(); }}>전체 보기</button>
                <span style={{ fontWeight: "bold", marginLeft: 4 }}>3D VIEW — {sel ? GRADES.find((g) => g.id === sel)?.name : "전체"}</span>
                {/* 입고 적재 시뮬레이션 — 입고 화면에서 넘어오지 않았을 때 손으로 돌리는 길 */}
                <button
                  className="w98-btn"
                  style={{ marginLeft: "auto" }}
                  /* ⚠️ 누른 뒤 **포커스를 놓는다.** 안 놓으면 이 버튼이 Enter 를 계속
                     물고 있어서, 시뮬레이션에서 나가려고 누른 Enter 가 이 버튼을 다시
                     눌러 처음부터 되돌린다. 위 `onKey` 에서도 막지만, 애초에 영화가
                     시작된 뒤에 시작 버튼이 포커스를 쥐고 있을 이유가 없다. */
                  onClick={(e) => { e.currentTarget.blur(); simRunRef.current?.(DEMO_ITEMS); }}
                  title="상품 3건을 입고 문에서 받아 등급별 슬롯까지 적재한다"
                >
                  ▶ 입고 적재 시뮬레이션
                </button>
              </div>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700;900&family=JetBrains+Mono:wght@500;700&display=swap');
        /* 유리판 - 위에서 아래로 아주 옅게 밝아지는 바탕 + 윗변 하이라이트 한 줄.
           평평한 반투명 사각형보다 한 겹 더 얹혀 있어 보인다. 바깥이 한낮으로 바뀌어
           배경이 밝아진 만큼 그림자를 키워야 패널이 배경에 묻히지 않는다. */
        /* 시뮬레이션이 도는 동안은 대시보드를 감춘다 (위 simActive 주석 참고).
           ⚠️ 이 블록은 JS 템플릿 리터럴 안이라 **백틱을 쓰면 안 된다** — 리터럴이 거기서
              끊겨 빌드가 깨진다. 자막만 남긴다: 그건 화면을 가리는 것이 아니라 화면의
              일부다. */
        .ws-film .ws-left, .ws-film .ws-legend, .ws-film .ws-timeline,
        .ws-film .ws-bottombar, .ws-film .ws-hint, .ws-film .ws-3dtools { display: none !important; }
        /* ── 시뮬레이션은 화면을 통째로 쓴다 ──────────────────────────
           ★ 창틀 안 한 칸에서 돌던 것을 **무대 전체**로 키웠다 (사용자 요청). 적재 영상은
             이 화면의 결과물이라, 98 창틀과 탭줄에 둘러싸여 있으면 화면의 여러 요소 중
             하나로 보인다. 꽉 채우면 그때만큼은 그것이 화면 전부가 된다.
           ⚠️ position: fixed 가 뷰포트가 아니라 **무대**를 채운다. 이 앱은 1600x1004
              고정 무대를 transform: scale() 로 줄여 놓았고, transform 이 걸린 조상이 있으면
              fixed 는 그 조상을 기준으로 잡힌다. 그래서 브라우저 창이 아니라 무대에 딱 맞는다.
           ⚠️ 인라인 스타일(position:absolute; inset:0)을 이겨야 하므로 important 를 붙인다.
           ⚠️ 나가는 길은 그대로 Enter 다. 시뮬레이션이 끝나면 simActive 가 꺼지면서 이 규칙도
              같이 풀려, 원래 창틀 안 화면으로 돌아온다 — 따로 되돌리는 코드가 없다. */
        .ws-film { position: fixed !important; inset: 0 !important; z-index: 9000 !important; }
        .ws-panel { background: linear-gradient(180deg, rgba(19,26,36,.90), rgba(11,16,23,.86)); border: 1px solid rgba(150,180,215,.18); border-radius: 12px; backdrop-filter: blur(14px) saturate(1.15); box-shadow: 0 10px 30px rgba(0,0,0,.40), inset 0 1px 0 rgba(255,255,255,.07); color: #E8EDF4; }
        /* ── 담백한 판 ──────────────────────────────────────────────
           ★ 3D 통로 행거와 **같은 차림새**로 맞췄다 (사용자 요청 — 행거 디자인이 예쁘다).
             규격 색은 문자 배지 한 곳에만 두고, 나머지는 굵기와 크기로만 말한다.
           ★ 바탕은 **어둡고 반투명하게** 되돌렸다 (사용자 지적 — 꽉 찬 크림색 판이
             지저분하고 화질이 나빠 보인다). 밝은 판은 어두운 3D 위에 종이를 덧댄 것처럼
             떠 보였는데, 어둡게 비치면 같은 화면의 일부로 앉는다.
           ⚠️ 흐림(backdrop-filter)을 켠 채로 둔다. 안 켜면 랙 무늬가 글자 뒤로 그대로
              비쳐, 투명하게 만든 값이 읽기 어려움으로 되돌아온다.
           ⚠️ 투명해진 만큼 글자 대비가 준다. 흐린 색을 쓰던 라벨을 한 단계 올리고 굵기를
              키운 것이 그 보상이다.
           ⚠️ 인라인 색이 이 규칙을 이긴다. 그래서 아래 마크업의 색도 같이 바꿔 두었다 —
              여기만 고치면 글자만 예전 색으로 남는다.
           ⚠️ 이 블록은 JS 템플릿 리터럴 안이다. **백틱을 쓰면 빌드가 깨진다.** */
        .ws-panel.ws-clean { background: rgba(11,16,23,.62); border: 1px solid rgba(160,190,220,.30); border-radius: 3px; backdrop-filter: blur(14px) saturate(1.1); box-shadow: 0 10px 28px rgba(0,0,0,.45); color: #F2F5F9; }
        .ws-clean .ws-eyebrow { color: #9DB0C4; font-weight: 800; }
        .ws-clean .ws-rule { background: rgba(160,190,220,.28); }
        .ws-clean .ws-stat { background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.11); border-radius: 2px; }
        .ws-clean .ws-stat span { color: #9DB0C4; font-weight: 700; }
        .ws-clean .ws-stat b { color: #F2F5F9; font-weight: 800; }
        .ws-clean .ws-chip { border-radius: 2px; }
        .ws-clean .ws-chip:hover { background: rgba(255,255,255,.07); }
        .ws-clean .ws-chip.on { border-color: rgba(255,255,255,.34); background: rgba(255,255,255,.09); }
        .ws-clean .ws-x { color: #9DB0C4; font-weight: 700; }
        .ws-clean .ws-x:hover { color: #fff; background: rgba(255,255,255,.12); }
        /* 머리글 - 작고 넓게 벌린 대문자. 제목이 아니라 '분류표'로 읽히게 한다 */
        .ws-eyebrow { font: 700 9.5px/1 'JetBrains Mono', monospace; letter-spacing: 1.8px; color: #6E8398; }
        .ws-h { font-size: 14.5px; font-weight: 800; letter-spacing: -.2px; }
        /* 구분선을 한쪽으로 흐리게 뺀다. 양끝까지 또렷한 선은 패널을 두 조각으로 잘라 버린다 */
        .ws-rule { height: 1px; background: linear-gradient(90deg, rgba(150,180,215,.24), rgba(150,180,215,0)); margin: 11px 0 9px; }
        .ws-stat { background: rgba(255,255,255,.045); border: 1px solid rgba(255,255,255,.06); border-radius: 8px; padding: 6px 9px; }
        .ws-stat span { font-size: 10px; color: #6E8398; }
        .ws-stat b { display: block; font: 700 15px 'JetBrains Mono', monospace; margin-top: 1px; color: #E8EDF4; }
        .ws-chip { display:flex; align-items:stretch; gap:10px; padding:9px 10px; border-radius:8px; cursor:pointer; border:1px solid transparent; transition: background .15s, border-color .15s; user-select:none; }
        .ws-chip:hover { background: rgba(255,255,255,.05); }
        .ws-chip.on { border-color: rgba(255,255,255,.26); background: rgba(255,255,255,.075); }
        /* 접힌 타임라인 버튼 */
        .ws-pill { display:inline-flex; align-items:center; gap:9px; padding:8px 14px; border-radius:999px; cursor:pointer; font-family:inherit; font-size:12px; font-weight:700; color:#DCE5EF; background: linear-gradient(180deg, rgba(19,26,36,.92), rgba(11,16,23,.88)); border:1px solid rgba(150,180,215,.20); backdrop-filter: blur(12px); box-shadow: 0 8px 24px rgba(0,0,0,.38), inset 0 1px 0 rgba(255,255,255,.07); transition: border-color .15s; }
        .ws-pill:hover { border-color: rgba(255,138,42,.55); }
        .ws-pill:focus-visible { outline: 2px solid #FF8A2A; outline-offset: 2px; }
        .ws-x { background:none; border:none; color:#7E90A5; cursor:pointer; font-size:13px; line-height:1; padding:3px 6px; border-radius:6px; font-family:inherit; }
        .ws-x:hover { color:#fff; background:rgba(255,255,255,.09); }
        .ws-chip:focus-visible { outline: 2px solid #FF8A2A; outline-offset: 2px; }
        input[type=range].ws-range { -webkit-appearance:none; width:100%; height:22px; background:transparent; position:absolute; left:0; bottom:-4px; margin:0; cursor:pointer; }
        input[type=range].ws-range::-webkit-slider-thumb { -webkit-appearance:none; width:16px; height:16px; border-radius:50%; background:#FF8A2A; border:2px solid #0c1117; box-shadow:0 0 0 2px #FF8A2A66; }
        input[type=range].ws-range::-moz-range-thumb { width:14px; height:14px; border-radius:50%; background:#FF8A2A; border:2px solid #0c1117; }
        .ws-btn { background:#FF8A2A; color:#14100a; border:none; border-radius:9px; font-weight:900; padding:7px 13px; cursor:pointer; font-family:inherit; font-size:13px; }
        .ws-btn:focus-visible { outline: 2px solid #fff; outline-offset: 2px; }
        .ws-btn.ghost { background:rgba(255,255,255,.08); color:#DCE5EF; }
        @media (prefers-reduced-motion: reduce) { .ws-chip { transition:none; } }
        @media (max-width: 760px) {
          .ws-left { width: 46vw !important; }
          .ws-legend { display:none !important; }
          .ws-timeline { width: 92vw !important; }
        }
        /* ── Windows 98 스킨 ── */
        .w98 { font-family: 굴림, Gulim, 'MS Sans Serif', 돋움, sans-serif; font-size: 12px; color: #000; }
        .w98 * { box-sizing: border-box; }
        .w98-raised { background: #C0C0C0; border: 2px solid; border-color: #FFF #404040 #404040 #FFF; box-shadow: inset 1px 1px 0 #DFDFDF, inset -1px -1px 0 #808080; }
        .w98-sunken { background: #C0C0C0; border: 2px solid; border-color: #404040 #FFF #FFF #404040; box-shadow: inset 1px 1px 0 #808080, inset -1px -1px 0 #DFDFDF; }
        .w98-title { background: linear-gradient(90deg, #000080, #1084D0); color: #fff; font-weight: bold; padding: 3px 6px; display: flex; align-items: center; gap: 6px; font-size: 12px; letter-spacing: 0.3px; flex-shrink: 0; }
        .w98-btn { background: #C0C0C0; border: 2px solid; border-color: #FFF #404040 #404040 #FFF; box-shadow: inset 1px 1px 0 #DFDFDF, inset -1px -1px 0 #808080; padding: 3px 10px; cursor: pointer; font-family: inherit; font-size: 12px; color: #000; user-select: none; white-space: nowrap; }
        .w98-btn:active, .w98-btn.pressed { border-color: #404040 #FFF #FFF #404040; box-shadow: inset 1px 1px 0 #808080; }
        .w98-btn:disabled { color: #707070; cursor: default; }
        .w98-tbtn { padding: 0 4px; font-size: 10px; line-height: 12px; height: 16px; font-weight: bold; }
        .w98-tabbtn { line-height: 1.5; text-align: center; padding: 6px 2px; width: 100%; }
        .w98-cell { padding: 2px 8px; font-size: 11px; background: #C0C0C0; white-space: nowrap; }
      `}</style>

      <div ref={mountRef} style={{ position: "absolute", top: 32, left: 0, right: 0, bottom: 0, fontFamily: "'Noto Sans KR', sans-serif" }} />

      {/* ── 좌상단: 상태 패널 ──
          ★ 정보를 **세 층으로** 나눴다: 무엇인가(머리글) → 지금 얼마인가(큰 숫자와 막대)
            → 자세히(작은 칸 넷). 예전에는 글줄이 여덟 개 세로로 쭉 이어져서, 급할 때 어디를
            봐야 하는지가 없었다. 큰 숫자 하나만 보고 지나갈 수도 있어야 한다.
          ★ 곁가지 수치(재고·표시 슬롯)를 문장에서 빼내 2x2 칸으로 옮겼다. 같은 종류의
            숫자는 같은 모양으로 줄 세워야 눈이 훑는다. */}
      <div className="ws-panel ws-clean ws-left" style={{ position: "absolute", top: 46, left: 14, width: 252, padding: 14, fontFamily: "'Noto Sans KR', sans-serif" }}>
        <div className="ws-eyebrow">SLOT WAREHOUSE · SCENARIO 3</div>
        <div className="ws-h" style={{ marginTop: 5 }}>창고 슬롯 대시보드</div>

        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginTop: 12 }}>
          <div style={{ fontSize: 34, fontWeight: 700, fontFamily: "'JetBrains Mono',monospace", lineHeight: 0.95, color: over ? "#FF7E7E" : "#FFC978" }}>
            {u.toFixed(1)}<span style={{ fontSize: 15, marginLeft: 1 }}>%</span>
          </div>
          <div style={{ textAlign: "right", fontSize: 10.5, fontWeight: 700, color: "#9DB0C4", lineHeight: 1.5 }}>
            {dateTxt}<br />D+{day}
          </div>
        </div>

        <div style={{ height: 5, borderRadius: 3, background: "rgba(255,255,255,.11)", marginTop: 9, position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: 0, bottom: 0, left: 0, width: `${u}%`, borderRadius: 3, background: over ? "#FF6B6B" : "#FFC978" }} />
          <div style={{ position: "absolute", left: `${THRESHOLD}%`, top: -1, bottom: -1, width: 2, background: "#FF6B6BAA" }} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 5, fontSize: 10, fontWeight: 700, color: "#9DB0C4", fontFamily: "'JetBrains Mono',monospace" }}>
          <span>{usedVol} / 866.9 ㎥</span>
          <span>임계 {THRESHOLD}%</span>
        </div>

        <div className="ws-rule" />

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
          <div className="ws-stat"><span>입고</span><b>{stats?.inn?.toLocaleString() ?? "—"}</b></div>
          <div className="ws-stat"><span>출고</span><b>{stats?.out?.toLocaleString() ?? "—"}</b></div>
          <div className="ws-stat"><span>재고</span><b>{REAL_STOCK[day].toLocaleString()}</b></div>
          <div className="ws-stat"><span>표시 슬롯</span><b>{stats ? stats.shownTotal.toLocaleString() : "4,004"}</b></div>
        </div>

        {over && (
          <div style={{ marginTop: 9, padding: "7px 10px", borderRadius: 2, background: "rgba(255,90,90,.16)", border: "1px solid rgba(255,107,107,.5)", fontSize: 11.5, color: "#FFC2C2", fontWeight: 700 }}>
            임계치 {THRESHOLD}% 초과 · 보관공간 부족 예상
          </div>
        )}
      </div>

      {/* ── 우측: 규격 범례 ── */}
      <div className="ws-panel ws-clean ws-legend" style={{ position: "absolute", top: 46, right: 14, width: 224, padding: 12, fontFamily: "'Noto Sans KR', sans-serif" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div className="ws-eyebrow">SIZE ZONES</div>
          {/* 선택 해제를 별도 버튼이 아니라 머리글 자리에 둔다. 예전에는 목록 아래에 큰
              버튼이 나타났다 사라져서, 그때마다 패널 높이가 출렁였다 */}
          <button
            className="ws-x"
            onClick={() => { setSel(null); apiRef.current?.setHighlight(null); apiRef.current?.resetView(); }}
            style={{ visibility: sel ? "visible" : "hidden", fontSize: 10.5, fontWeight: 700, letterSpacing: 0.4 }}
          >
            전체 보기 ✕
          </button>
        </div>
        <div style={{ fontSize: 11, fontWeight: 600, color: "#9DB0C4", marginTop: 3, marginBottom: 10 }}>클릭 시 해당 구역만 강조</div>

        {/* ── 규격 목록 ────────────────────────────────────────────────
            ★ 글씨를 키우고 **색을 걷어냈다** (사용자 요청 — 크고 직관적이고, 색이 많은 건
              별로다). 예전에는 줄마다 규격 색이 세 군데(세로 막대·코드 글자·진행 막대)에
              쓰여서, 여섯 줄이면 색이 열여덟 번 나왔다. 그러니 어느 줄이 찬 줄인지가 색에
              묻혔다.
            ★ 지금은 **채움 정도만** 색을 쓴다: 임계를 넘긴 줄은 주황, 나머지는 흐린 청회색.
              한 화면에서 색이 뜻하는 것이 하나뿐이라 그 색이 곧 경고로 읽힌다.
            ⚠️ 규격 색은 **왼쪽 세로 막대 하나에만** 남긴다. 지도와 3D 가 같은 색으로
               구역을 그리고 있어서, 이걸 지우면 목록과 창고를 잇는 고리가 끊긴다.
            ⚠️ 숫자는 고정폭으로 찍는다. 자릿수마다 폭이 달라지면 여섯 줄의 오른쪽 끝이
               들쭉날쭉해 목록이 흔들려 보인다. */}
        {GRADES.map((g) => {
          const pg = stats?.perGrade?.[g.id];
          const col = "#" + g.color.toString(16).padStart(6, "0");
          const pct = pg ? (pg.filled / pg.total) * 100 : 0;
          const hot = pct >= 90;
          return (
            <div key={g.id} className={`ws-chip ${sel === g.id ? "on" : ""}`} onClick={() => toggleSel(g.id)}
              role="button" tabIndex={0} onKeyDown={(e) => e.key === "Enter" && toggleSel(g.id)}>
              {/* 규격 문자 배지 — 3D 통로 행거의 색 띠를 그대로 줄인 것이다. 줄마다 왼쪽
                  끝이 색으로 정렬되어 여섯 줄이 목록 하나로 묶인다.
                  ⚠️ 글자는 **어둡게** 쓴다. 행거 판은 84px 라 흰 글자가 버티지만, 여기 15px
                     흰 글자를 A구역(#A8C0E4) 같은 옅은 하늘색 위에 올리면 안 읽힌다. */}
              <div style={{ width: 26, minHeight: 26, alignSelf: "stretch", borderRadius: 2, background: col, color: "#14181C", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", font: "800 15px 'JetBrains Mono', monospace" }}>{g.code}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
                  <span style={{ fontSize: 15, fontWeight: 700, letterSpacing: -0.2 }}>
                    {g.name}
                  </span>
                  <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 14, fontWeight: 800, color: "#F2F5F9", fontVariantNumeric: "tabular-nums" }}>
                    {pg ? pg.filled.toLocaleString() : "—"}
                    <span style={{ fontSize: 11, fontWeight: 700, color: "#9DB0C4" }}>{pg ? `/${pg.total.toLocaleString()}` : ""}</span>
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
                  <div style={{ flex: 1, height: 5, borderRadius: 3, background: "rgba(255,255,255,.11)" }}>
                    <div style={{ width: `${pct}%`, height: "100%", borderRadius: 3, background: hot ? "#FF8A2A" : "#A9BDD2" }} />
                  </div>
                  {/* 채움 비율을 적는다. 예전에는 전체 재고에서 그 규격이 차지하는 몫(`share`)을
                      적었는데, 바로 옆 막대는 **그 구역이 얼마나 찼나**를 말하고 있어서 둘이
                      서로 다른 것을 가리켰다 */}
                  <span style={{ fontSize: 12, fontWeight: 800, color: hot ? "#FFB27A" : "#B7C7D9", fontFamily: "'JetBrains Mono',monospace", width: 42, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                    {pg ? `${pct.toFixed(0)}%` : "—"}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── 하단: 61일 타임라인 ──
          ★ 늘 펼쳐 두던 것을 **접었다.** 이 화면의 주인공은 3D 창고인데, 폭 640px 짜리
            패널이 아래를 늘 가리고 있었다. 타임라인은 "지금 며칠인가"를 바꿀 때만 필요하고,
            그 값은 접힌 버튼에도 적혀 있으므로 평소에는 버튼 하나면 충분하다.
          ⚠️ 접혔을 때도 재생 버튼은 남긴다. 자동 재생은 자주 쓰는 기능이라, 그것까지
             펼쳐야 닿게 하면 접은 이득이 사라진다. */}
      {!timelineOpen ? (
        <div className="ws-bottombar" style={{ position: "absolute", bottom: 14, left: "50%", transform: "translateX(-50%)", display: "flex", gap: 6, fontFamily: "'Noto Sans KR', sans-serif" }}>
          <button className="ws-pill" onClick={() => setTimelineOpen(true)}>
            <span style={{ color: "#7E90A5" }}>물동량 타임라인</span>
            <span style={{ fontFamily: "'JetBrains Mono',monospace", color: over ? "#FF8A8A" : "#FFC978" }}>
              D+{day} · {u.toFixed(1)}%
            </span>
            <span style={{ color: "#5F7186", fontSize: 10 }}>▲</span>
          </button>
          <button
            className="ws-pill"
            style={{ padding: "8px 12px" }}
            aria-label={playing ? "정지" : "재생"}
            onClick={() => { if (day >= 60) setDay(0); setPlaying((p) => !p); }}
          >
            {playing ? "⏸" : "▶"}
          </button>
        </div>
      ) : (
        <div className="ws-panel ws-timeline" style={{ position: "absolute", bottom: 14, fontFamily: "'Noto Sans KR', sans-serif", left: "50%", transform: "translateX(-50%)", width: "min(640px, 94vw)", padding: "11px 15px 15px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 7 }}>
            <div style={{ minWidth: 0 }}>
              <div className="ws-eyebrow">THROUGHPUT · 61 DAYS</div>
              <div style={{ fontSize: 10.5, color: "#5F7186", marginTop: 3 }}>
                2024-08-01 – 10-31 (영업일 61일) · 실측 사용률
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
              <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, color: over ? "#FF8A8A" : "#FFC978" }}>
                D+{day} · {u.toFixed(1)}%
              </span>
              <button className="ws-btn" onClick={() => { if (day >= 60) setDay(0); setPlaying((p) => !p); }}>
                {playing ? "⏸ 정지" : "▶ 재생"}
              </button>
              <button className="ws-x" aria-label="타임라인 접기" onClick={() => setTimelineOpen(false)}>▼</button>
            </div>
          </div>
          <div style={{ position: "relative" }}>
            <svg viewBox={`0 0 ${chartW} ${chartH}`} style={{ width: "100%", height: 74, display: "block" }} aria-hidden="true">
              <defs>
                <linearGradient id="wsArea" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#FF8A2A" stopOpacity="0.35" />
                  <stop offset="100%" stopColor="#FF8A2A" stopOpacity="0.02" />
                </linearGradient>
              </defs>
              <line x1="6" x2={chartW - 6} y1={cy(THRESHOLD)} y2={cy(THRESHOLD)} stroke="#FF5D5D" strokeWidth="1" strokeDasharray="5 4" opacity="0.7" />
              <text x={chartW - 8} y={cy(THRESHOLD) - 4} fill="#FF7B7B" fontSize="9" textAnchor="end" fontFamily="JetBrains Mono">임계 65%</text>
              <path d={area} fill="url(#wsArea)" />
              <path d={path} fill="none" stroke="#FFB569" strokeWidth="2" strokeLinejoin="round" />
              <line x1={cx(day)} x2={cx(day)} y1="4" y2={chartH} stroke="#fff" strokeWidth="1" opacity="0.35" />
              <circle cx={cx(day)} cy={cy(CURVE[day])} r="4.5" fill="#FF8A2A" stroke="#0c1117" strokeWidth="2" />
            </svg>
            <input className="ws-range" type="range" min="0" max="60" step="1" value={day}
              aria-label="날짜 선택" onChange={(e) => { setPlaying(false); setDay(+e.target.value); }} />
          </div>
        </div>
      )}

      {/* ── 입고 적재 진행 줄 ──
          ⚠️ 화면 **아래 가운데**에 둔다. 로봇이 어디에 있든 눈이 한 번은 지나는 자리이고,
             좌우 패널을 가리지 않는다. 타임라인 알약과는 세로로 어긋나게 띄운다. */}
      {/* ── 적재 자막 ─────────────────────────────────────────────────
          ★ 한 줄짜리 작은 띠였다. 시연에서 **읽히지 않는** 크기라 키웠는데, 그냥 키우면
            화면 밖으로 나가므로 **세 줄로 나눴다**: 회차 / 상품 / 치수·목적지.
          ★ 말풍선으로 물건 옆에 매달지 않았다 (사용자와 의논). 카메라가 계속 움직이고 짐에
            바짝 붙어서, 매달면 화면 밖으로 나가거나 랙에 파묻힌다 — 가림 처리를 따로 해야
            한다. 게다가 이만큼 긴 글을 옆에 띄우면 정작 봐야 할 물건을 가린다. 중계 자막이
            늘 아래에 있는 이유와 같다: 눈은 가운데(동작)에 두고 글은 곁눈으로 읽는다.
          ⚠️ 폭을 못 박지 않고 `max-width` 만 준다. 상품명 길이가 제각각이라 고정 폭이면
             짧은 이름에서 휑하고 긴 이름에서 넘친다.
          ⚠️ `pointerEvents: none` — 자막이 3D 판 위에 떠 있어서, 안 끄면 이 자리에서
             드래그·클릭이 먹히지 않는다. */}
      {/* ── 마무리 카드 ────────────────────────────────────────────────
          ★ 적재가 끝나면 **구역별로 몇 칸이 늘었는지**를 보여 준다 (사용자 요청).
            적재 순간마다 띄우던 팝업을 여기로 옮긴 것이다 — 그때는 카메라가 움직이는데
            화면에 붙은 판만 가만히 있어 겉돌았지만, 마무리는 카메라가 멈춰 있어 읽을
            자리가 된다. 같은 정보라도 놓이는 순간이 다르면 다른 것이 된다.
          ⚠️ 비율은 **여기서** 계산한다. 그날의 기준 재고(`stats`)는 화면 쪽에만 있고,
             시뮬레이션은 자기가 몇 개 넣었는지만 안다.
          ⚠️ 기준 재고는 적재해도 다시 계산되지 않는다. 그래서 '이후'는 `filled + added`
             로 직접 더한다 — 안 그러면 넣었는데 숫자가 그대로인 화면이 된다. */}
      {simLine?.outro && !atStation && (
        <div
          className="ws-panel"
          style={{
            position: "absolute", bottom: 58, left: "50%", transform: "translateX(-50%)",
            padding: "18px 26px 16px", fontFamily: "'Noto Sans KR', sans-serif",
            minWidth: 520, pointerEvents: "none",
          }}
        >
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 20 }}>
            <span style={{ fontSize: 20, fontWeight: 800, color: "#7FD49A" }}>
              {simLine.outro.count}건 적재 완료
            </span>
            <span style={{ fontSize: 14, fontWeight: 700, color: "#7E90A5", fontFamily: "'JetBrains Mono',monospace" }}>
              {simLine.outro.time}
            </span>
          </div>

          <div style={{ marginTop: 12, borderTop: "1px solid rgba(150,180,215,.22)", paddingTop: 11, display: "grid", gap: 9 }}>
            {simLine.outro.zones.map((z) => {
              const pg = stats?.perGrade?.[z.id];
              const total = pg?.total ?? 0;
              const before = pg?.filled ?? 0;
              const after = before + z.added;
              const pctA = total > 0 ? (before / total) * 100 : 0;
              const pctB = total > 0 ? (after / total) * 100 : 0;
              return (
                <div key={z.id} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ width: 96, fontSize: 15, fontWeight: 700, color: "#F2F6FB" }}>
                    {z.code} · {z.name}
                  </span>
                  <span style={{ fontSize: 13, color: "#7E90A5", fontFamily: "'JetBrains Mono',monospace", width: 52 }}>
                    +{z.added}칸
                  </span>
                  {/* 늘어난 만큼을 막대 끝에 밝게 얹는다 — 숫자보다 변화가 먼저 보인다 */}
                  <span style={{ flex: 1, height: 7, borderRadius: 4, background: "rgba(255,255,255,.10)", position: "relative", overflow: "hidden" }}>
                    <span style={{ position: "absolute", inset: 0, width: `${pctA}%`, borderRadius: 4, background: "#6E86A0" }} />
                    <span style={{ position: "absolute", top: 0, bottom: 0, left: `${pctA}%`, width: `${Math.max(0.6, pctB - pctA)}%`, background: "#FFC978" }} />
                  </span>
                  <span style={{ fontSize: 13.5, fontFamily: "'JetBrains Mono',monospace", color: "#9FB0C3", width: 128, textAlign: "right" }}>
                    {pctA.toFixed(1)}%
                    <span style={{ color: "#5F7186" }}> → </span>
                    <b style={{ color: "#FFC978" }}>{pctB.toFixed(1)}%</b>
                  </span>
                </div>
              );
            })}
          </div>

          <div style={{ marginTop: 12, fontSize: 13, color: "#7E90A5" }}>{simLine.note}</div>
        </div>
      )}

      {/* ── 랙 면 격자 (오른쪽 위) ────────────────────────────────────
          ★ 세로 막대 하나였던 것을 **랙 한 면을 그대로 그린 격자**로 바꿨다 (사용자 요청 —
            구역을 2D 로 그려서 칸에 색칠하는 식이 세련되고 귀엽겠다). 막대는 "몇 단인가"만
            말하지만, 격자는 그 물건이 **랙 어디쯤**에 꽂혔는지를 한 그림에 담는다.
          ★ 레트로 픽셀 격자로 그린다 — 칸 사이를 1px 씩 띄우고 98 의 들어간 테두리를 두르면,
            이 화면의 나머지(창틀·베벨)와 같은 말투가 된다.
          ⚠️ 칸 크기를 **폭에 맞춰 나눈다.** 등급마다 열 수가 다르다(A는 26열, E는 9열) —
             한 크기로 못 박으면 A는 넘치고 E는 휑하다.
          ⚠️ 아래부터 위로 쌓는다(`column-reverse`). 랙은 1단이 바닥이라, 배열 순서 그대로
             그리면 위아래가 뒤집힌 그림이 된다.
          ⚠️ 찼는지는 **여기서** 판정한다. 시뮬레이션은 순위만 넘기고(`faceRanks`), 그날의
             채움 수(`stats`)는 화면 쪽에만 있다.
          ⚠️ `.ws-film` 이 감추는 목록에 넣지 않는다 — 시뮬레이션이 도는 동안 보라고 만든
             판이라, 대시보드와 같이 숨으면 존재 이유가 없어진다.
          ⚠️ 다만 **마무리 카드가 뜨면 내린다.** 마무리는 세 건을 통째로 정리해 보여 주는
             자리인데, 그 옆에 마지막 한 건짜리 판이 남아 있으면 어느 쪽을 읽어야 할지
             갈린다 (사용자 지적). 끝났다는 화면에는 끝난 이야기만 있어야 한다. */}
      {placed?.faceRanks && !simLine?.outro && !atStation && (() => {
        const pg = stats?.perGrade?.[placed.gradeId];
        if (!pg) return null;
        const n = pg.filled;
        /* ★ 판을 키웠다 (사용자 요청). 폭을 **고정**하고 칸 크기를 열 수로 나눈다 —
             칸을 고정하고 폭을 따라가게 두면 A(26열)와 E(9열)에서 판 너비가 확 달라져,
             물건이 바뀔 때마다 오른쪽 위가 들썩인다.
           ⚠️ 이렇게 두면 세로도 저절로 맞는다: A는 11px x 11단, E는 33px x 4단, C는
              21px x 6단 — 셋 다 130px 언저리라 판 높이가 거의 안 변한다. */
        const W = 312;                                   // 격자가 쓸 수 있는 폭 (고정)
        const cw = Math.max(4, Math.floor((W - (placed.cols - 1)) / placed.cols));
        const gridW = cw * placed.cols + (placed.cols - 1);
        const used = placed.faceRanks.flat().filter((r) => r < n).length + 1;
        const totalCells = placed.cols * placed.levels;
        return (
          <div
            className="ws-panel"
            style={{
              position: "absolute", top: 46, right: 14, width: W + 36,
              padding: "16px 18px 17px", fontFamily: "'Noto Sans KR', sans-serif",
              pointerEvents: "none", zIndex: 30,
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 800, color: "#7FD49A", letterSpacing: 0.6 }}>
              직전 적재
            </div>
            <div style={{ marginTop: 6, display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10 }}>
              <span style={{ fontSize: 20, fontWeight: 800, color: "#F2F6FB" }}>{placed.grade}</span>
              <span style={{ fontSize: 17, fontWeight: 700, color: "#57C8FF", fontFamily: "'JetBrains Mono',monospace" }}>
                {placed.slot}
              </span>
            </div>

            {/* 랙 한 면 — 들어간 테두리 안에 픽셀 격자 */}
            <div
              style={{
                marginTop: 13, padding: 5, borderRadius: 2,
                background: "rgba(0,0,0,.30)",
                boxShadow: "inset 1px 1px 0 rgba(0,0,0,.55), inset -1px -1px 0 rgba(255,255,255,.10)",
                display: "flex", flexDirection: "column-reverse", gap: 1, width: gridW + 10, margin: "0 auto",
              }}
            >
              {placed.faceRanks.map((row, k) => (
                <div key={k} style={{ display: "flex", gap: 1 }}>
                  {row.map((r, c) => {
                    const now = k + 1 === placed.level && c + 1 === placed.col;
                    return (
                      <div
                        key={c}
                        style={{
                          width: cw, height: cw,
                          background: now ? "#57C8FF" : r < n ? "#5A7A9E" : "rgba(255,255,255,.07)",
                          boxShadow: now ? "0 0 13px rgba(87,200,255,.95)" : undefined,
                        }}
                      />
                    );
                  })}
                </div>
              ))}
            </div>

            <div style={{ marginTop: 12, display: "flex", justifyContent: "space-between", fontSize: 14.5, color: "#9FB0C3", fontFamily: "'JetBrains Mono',monospace" }}>
              {/* ★ "이 랙" 이라는 말을 뺐다 (사용자 지적). 격자가 바로 위에 있어서 이 숫자가
                     무엇에 대한 것인지는 이미 보인다 — 굳이 이름을 붙이면 오른쪽의 '구역'과
                     나란히 놓여 두 이름이 서로 다른 분모를 가리키는 꼴이 된다. */}
              <span><b style={{ color: "#F2F6FB" }}>{used}/{totalCells}</b>칸</span>
              <span>구역 <b style={{ color: "#F2F6FB" }}>{(((pg.filled + placed.bump) / pg.total) * 100).toFixed(1)}%</b></span>
            </div>
          </div>
        );
      })()}

      {simLine && !simLine.outro && !atStation && (
        <div
          className="ws-panel"
          style={{
            position: "absolute", bottom: 58, left: "50%", transform: "translateX(-50%)",
            padding: "12px 22px", fontFamily: "'Noto Sans KR', sans-serif",
            maxWidth: 720, pointerEvents: "none",
          }}
        >
          {simLine.note ? (
            <div style={{ fontSize: 17, fontWeight: 700, color: "#FFC978", whiteSpace: "nowrap" }}>
              {simLine.note}
            </div>
          ) : (
            <>
              <div style={{ display: "flex", alignItems: "baseline", gap: 9, fontSize: 12, fontWeight: 700 }}>
                <span style={{ color: "#7FD49A" }}>▲ 입고 적재</span>
                <span style={{ color: "#5F7186", fontFamily: "'JetBrains Mono',monospace" }}>
                  {simLine.step} / {simLine.total}
                </span>
              </div>

              {/* 상품명 — 이 자막에서 가장 큰 글자. 무엇이 들어가는지가 요점이다 */}
              <div style={{ marginTop: 4, fontSize: 21, fontWeight: 700, color: "#F2F6FB", lineHeight: 1.2 }}>
                {simLine.name}
              </div>

              <div style={{ marginTop: 6, display: "flex", alignItems: "baseline", gap: 12, fontSize: 13.5, flexWrap: "wrap" }}>
                <span style={{ color: "#9FB0C3", fontFamily: "'JetBrains Mono',monospace" }}>
                  {simLine.l}×{simLine.w}×{simLine.h}
                  <span style={{ color: "#5F7186" }}> mm</span>
                </span>
                {/* 세 변 합이 등급을 정한 근거다 — 그래서 목적지 **바로 앞**에 둔다 */}
                <span style={{ color: "#9FB0C3" }}>
                  세 변 합{" "}
                  <b style={{ color: "#DCE5EF", fontFamily: "'JetBrains Mono',monospace" }}>
                    {simLine.sumCm.toFixed(1)}cm
                  </b>
                </span>
                <span style={{ color: "#5F7186" }}>→</span>
                <span style={{ color: "#FFC978", fontWeight: 700 }}>
                  {simLine.grade}
                  {simLine.slot ? <span style={{ color: "#C9A46A" }}> · {simLine.slot}</span> : " · 갈 곳 없음"}
                </span>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── 우하단 힌트 ── */}
      <div className="ws-hint" style={{ position: "absolute", bottom: 14, right: 14, fontSize: 10.5, color: "#5F7186", textAlign: "right", lineHeight: 1.6, pointerEvents: "none", fontFamily: "'Noto Sans KR', sans-serif" }}>
        드래그 회전 · 스크롤/핀치 확대 · 클릭 → 지점 줌인<br />
        <b style={{ color: "#FFC978" }}>Enter → 출고 구역 → 포스기 확대</b> · 더블클릭 → 전체 보기 · 범례 클릭 → 구역 하이라이트
      </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── 포탈 툴팁 ──
          (경고) `pointerEvents: none` 이 없으면 툴팁이 커서 아래로 들어가 포탈에서 마우스가
             벗어난 것으로 처리되고, 툴팁이 깜빡이며 사라졌다 나타났다 한다. */}
      {portalTip && !inRoom && (() => {
        /* ★ 글씨를 키웠다 (사용자 지적 - 잘 안 보인다). 한 줄짜리 작은 딱지에서 **제목 +
             부연** 두 줄 팝업으로 바꿨다. 포탈은 이 화면에서 유일하게 다른 화면으로 넘어가는
             입구라, 그 사실이 커서 옆에서 바로 읽혀야 한다.
           (경고) 커진 만큼 **오른쪽으로 넘칠 수 있다.** 커서 오른쪽에 놓았을 때 무대 밖으로
              나가면 왼쪽으로 넘긴다. 무대 폭은 호버 쪽에서 같이 넘겨받는다 - 여기서
              `window.innerWidth` 를 보면 안 된다. 이 무대는 배율이 걸린 고정 1600 폭이다. */
        const POP_W = 372;
        const stage = portalTip.w || 0;
        const flip = stage > 0 && portalTip.x + 22 + POP_W > stage - 12;
        const left = flip ? Math.max(12, portalTip.x - 22 - POP_W) : portalTip.x + 22;
        return (
          <div
            style={{
              position: "absolute", left, top: Math.max(10, portalTip.y - 34), width: POP_W,
              padding: "14px 18px 15px", background: "rgba(26,15,46,0.95)",
              border: "1.5px solid #B04DFF", borderRadius: 4,
              fontFamily: "'Malgun Gothic', sans-serif", pointerEvents: "none",
              boxShadow: "0 0 30px rgba(176,77,255,0.6), inset 0 0 26px rgba(176,77,255,0.12)", zIndex: 40,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
              <span style={{ fontSize: 26, lineHeight: 1, color: "#D9A6FF", textShadow: "0 0 12px rgba(176,77,255,0.9)" }}>▣</span>
              <span style={{ fontSize: 21, fontWeight: 800, color: "#F3E4FF", letterSpacing: "0.01em", textShadow: "0 0 10px rgba(176,77,255,0.5)" }}>
                신규 물품 입고
              </span>
            </div>
            <div style={{ marginTop: 9, fontSize: 15, fontWeight: 700, color: "#D3B6F5", letterSpacing: "0.01em" }}>
              검수실로 이동합니다
            </div>
          </div>
        );
      })()}

      {/* ── 검수실 (씬 2) ──
          창고 화면 위를 통째로 덮는다. 창고 씬은 뒤에서 계속 돈다 - 시뮬레이션이 멈추면
          돌아왔을 때 2D 지도의 시각이 튄다.
          (주의) 나갈 때 시점을 되돌린다. 안 그러면 포탈을 클릭했던 각도 그대로 남아,
             돌아온 순간 화면 구석만 보인다. */}
      {inRoom && (
        <div style={{ position: "absolute", inset: 0, zIndex: 50 }}>
          <InspectionRoom onExit={() => { setInRoom(false); apiRef.current?.resetView(); }} />
        </div>
      )}

    </div>
  );
}

