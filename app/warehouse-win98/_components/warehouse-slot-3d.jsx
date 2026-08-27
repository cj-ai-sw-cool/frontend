import React, { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from "three";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { createNetherPortal } from "./nether-portal";
import { createPackingStation } from "./packing-station";
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
const DIMS_TXT = { xs: "30·30·20", s: "35·35·30", m: "40·40·40", l: "50·50·40", xl: "60·60·60", cold: "개별 산출" };

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

/* ── 텍스트 스프라이트 ──
   ★ win98 창 모양으로 바꿔 봤다가 되돌렸다 (팀 의견). 3D 안의 표찰까지 98 스킨을 입히면
     화면이 무거워지고, 랙 사이에 회색 창이 여섯 개 떠 있으니 정작 봐야 할 랙보다 표찰이
     먼저 눈에 들어왔다. 어두운 반투명 판은 배경에서 물러나 있어 그 문제가 없다. */
function makeLabel(title, sub, hex) {
  const cv = document.createElement("canvas");
  cv.width = 512; cv.height = 200;
  const c = cv.getContext("2d");
  c.fillStyle = "rgba(9,13,19,0.78)";
  const r = 26;
  c.beginPath();
  c.moveTo(r, 0); c.arcTo(512, 0, 512, 200, r); c.arcTo(512, 200, 0, 200, r);
  c.arcTo(0, 200, 0, 0, r); c.arcTo(0, 0, 512, 0, r); c.fill();
  c.strokeStyle = "#" + hex.toString(16).padStart(6, "0");
  c.lineWidth = 5; c.stroke();
  c.fillStyle = "#EDF2F8";
  c.font = "800 52px 'Noto Sans KR', sans-serif";
  c.fillText(title, 34, 82);
  c.fillStyle = "#9FB0C3";
  c.font = "500 30px 'JetBrains Mono', monospace";
  c.fillText(sub, 34, 148);
  const tex = new THREE.CanvasTexture(cv);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  sp.scale.set(3.3, 1.29, 1);
  return sp;
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

/* ── 작업자 (CJ풍 근무복 2종 — vest: 형광조끼 / jacket: 회색점퍼) ── */
function buildWorker({ cart = true, outfit = "vest", device = false } = {}) {
  const grp = new THREE.Group();
  const skin = new THREE.MeshLambertMaterial({ color: 0xE8B48C });
  const pants = new THREE.MeshLambertMaterial({ color: 0x2E3B4A });
  const dark = new THREE.MeshLambertMaterial({ color: 0x22262B });
  const white = new THREE.MeshLambertMaterial({ color: 0xF6F8FA });
  let torsoM, sleeveM, helmM, maskM, gloveM;
  if (outfit === "vest") {
    torsoM = new THREE.MeshLambertMaterial({ color: 0xCDE32E });  // 형광 조끼
    sleeveM = new THREE.MeshLambertMaterial({ color: 0x232B47 }); // 남색 이너
    helmM = new THREE.MeshLambertMaterial({ color: 0xFFD23E });
    maskM = new THREE.MeshLambertMaterial({ color: 0x191C22 });   // 검정 마스크
    gloveM = new THREE.MeshLambertMaterial({ color: 0x8A8F98 });  // 회색 장갑
  } else {
    torsoM = new THREE.MeshLambertMaterial({ color: 0xD8DCE0 });  // 회색 점퍼
    sleeveM = new THREE.MeshLambertMaterial({ color: 0x2E5FBF }); // 파랑 소매
    helmM = new THREE.MeshLambertMaterial({ color: 0xF2F5F8 });
    maskM = white;                                                 // 흰 마스크
    gloveM = skin;
  }
  const mk = (geo, mat, x, y, z, parent = grp) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  };
  // 다리 (골반 피벗)
  const legGeo = new THREE.BoxGeometry(0.10, 0.46, 0.12);
  const lLeg = new THREE.Group(); lLeg.position.set(-0.075, 0.5, 0); grp.add(lLeg);
  mk(legGeo, pants, 0, -0.23, 0, lLeg);
  const rLeg = new THREE.Group(); rLeg.position.set(0.075, 0.5, 0); grp.add(rLeg);
  mk(legGeo, pants, 0, -0.23, 0, rLeg);
  // 몸통 + 근무복 디테일
  mk(new THREE.BoxGeometry(0.30, 0.42, 0.17), torsoM, 0, 0.73, 0);
  if (outfit === "vest") {
    mk(new THREE.BoxGeometry(0.085, 0.09, 0.012), white, -0.07, 0.71, 0.093);  // 반사 포켓 좌
    mk(new THREE.BoxGeometry(0.085, 0.09, 0.012), white, 0.07, 0.71, 0.093);   // 반사 포켓 우
    mk(new THREE.BoxGeometry(0.30, 0.045, 0.012), white, 0, 0.60, 0.093);      // 하단 반사밴드
    mk(new THREE.BoxGeometry(0.016, 0.36, 0.013),
      new THREE.MeshLambertMaterial({ color: 0x1E63C8 }), 0, 0.73, 0.096);     // 파랑 지퍼
    mk(new THREE.BoxGeometry(0.06, 0.03, 0.012), white, -0.09, 0.87, 0.093);   // 어깨 반사탭
    mk(new THREE.BoxGeometry(0.06, 0.03, 0.012), white, 0.09, 0.87, 0.093);
  } else {
    const r3 = new THREE.MeshLambertMaterial({ color: 0xE23A3A });
    const y3 = new THREE.MeshLambertMaterial({ color: 0xF2B23E });
    const b3 = new THREE.MeshLambertMaterial({ color: 0x1E4FA3 });
    mk(new THREE.BoxGeometry(0.11, 0.026, 0.012), r3, -0.058, 0.845, 0.092);   // 가슴 3색 스트라이프
    mk(new THREE.BoxGeometry(0.11, 0.026, 0.012), y3, -0.046, 0.816, 0.092);
    mk(new THREE.BoxGeometry(0.11, 0.026, 0.012), b3, -0.034, 0.787, 0.092);
  }
  // 가슴 엠블럼 (흰 배지 + 3색 도트 — 제네릭)
  mk(new THREE.BoxGeometry(0.074, 0.05, 0.012), white, 0.085, 0.842, 0.094);
  mk(new THREE.BoxGeometry(0.014, 0.014, 0.013),
    new THREE.MeshBasicMaterial({ color: 0xE8542F }), 0.066, 0.842, 0.099);
  mk(new THREE.BoxGeometry(0.014, 0.014, 0.013),
    new THREE.MeshBasicMaterial({ color: 0x2FA84F }), 0.085, 0.842, 0.099);
  mk(new THREE.BoxGeometry(0.014, 0.014, 0.013),
    new THREE.MeshBasicMaterial({ color: 0x2E5FBF }), 0.104, 0.842, 0.099);
  // 팔 (어깨 피벗) + 손(장갑)
  const armRest = cart ? -1.0 : device ? -0.15 : -0.05;
  const armGeo = new THREE.BoxGeometry(0.08, 0.36, 0.09);
  const lArm = new THREE.Group(); lArm.position.set(-0.20, 0.90, 0); grp.add(lArm);
  mk(armGeo, sleeveM, 0, -0.16, 0, lArm);
  mk(new THREE.BoxGeometry(0.075, 0.07, 0.085), gloveM, 0, -0.37, 0, lArm);
  lArm.rotation.x = armRest;
  const rArm = new THREE.Group(); rArm.position.set(0.20, 0.90, 0); grp.add(rArm);
  mk(armGeo, sleeveM, 0, -0.16, 0, rArm);
  mk(new THREE.BoxGeometry(0.075, 0.07, 0.085), gloveM, 0, -0.37, 0, rArm);
  rArm.rotation.x = device ? -0.85 : armRest;
  // 핸드헬드 스캐너/PDA (옵션 — 오른손)
  if (device) {
    const pda = mk(new THREE.BoxGeometry(0.05, 0.095, 0.022), dark, 0, -0.40, 0.055, rArm);
    pda.rotation.x = 0.55;
    mk(new THREE.BoxGeometry(0.036, 0.05, 0.006),
      new THREE.MeshBasicMaterial({ color: 0x8FE0FF }), 0.0, -0.385, 0.068, rArm).rotation.x = 0.55;
  }
  // 머리 + 마스크 + 안전모
  mk(new THREE.SphereGeometry(0.095, 12, 10), skin, 0, 1.03, 0);
  mk(new THREE.BoxGeometry(0.10, 0.055, 0.03), maskM, 0, 1.005, 0.078);
  const hat = mk(new THREE.SphereGeometry(0.115, 12, 10), helmM, 0, 1.075, 0);
  hat.scale.y = 0.72;
  // 피킹 카트 (전방, 옵션)
  if (cart) {
    const cartG = new THREE.Group(); cartG.position.set(0, 0, 0.52); grp.add(cartG);
    mk(new THREE.BoxGeometry(0.5, 0.05, 0.72), dark, 0, 0.16, 0, cartG);
    const wheelGeo = new THREE.CylinderGeometry(0.055, 0.055, 0.04, 10);
    for (const [wx, wz] of [[-0.2, -0.28], [0.2, -0.28], [-0.2, 0.28], [0.2, 0.28]]) {
      const w = mk(wheelGeo, dark, wx, 0.055, wz, cartG);
      w.rotation.z = Math.PI / 2;
    }
    mk(new THREE.CylinderGeometry(0.018, 0.018, 0.52, 8), dark, -0.2, 0.44, -0.34, cartG);
    mk(new THREE.CylinderGeometry(0.018, 0.018, 0.52, 8), dark, 0.2, 0.44, -0.34, cartG);
    const cross = mk(new THREE.CylinderGeometry(0.02, 0.02, 0.44, 8), dark, 0, 0.70, -0.34, cartG);
    cross.rotation.z = Math.PI / 2;
    const cb = new THREE.MeshLambertMaterial({ color: 0xC59A63 });
    const b1 = mk(new THREE.BoxGeometry(0.24, 0.20, 0.24), cb, -0.09, 0.29, 0.06, cartG); b1.rotation.y = 0.2;
    const b2 = mk(new THREE.BoxGeometry(0.18, 0.16, 0.18), cb, 0.12, 0.27, -0.10, cartG); b2.rotation.y = -0.3;
  }
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
  const [tab, setTab] = useState(initialTab);   // 'map' | '3d'
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

  /* 씬 쪽 손잡이를 최신 함수로 유지한다 (위 ref 설명 참고).
     ⚠️ 렌더 중에 ref 를 건드리면 안 된다 — 리액트가 화면을 그리는 도중에 바깥 값을 바꾸는
        셈이라, 같은 렌더가 두 번 돌 때(개발 모드의 이중 실행) 결과가 갈린다.
        의존성 없는 effect 에 두면 **그릴 것을 다 그린 뒤** 매번 갱신된다. */
  const router = useRouter();
  useEffect(() => { goPackingRef.current = () => router.push("/packing-win98"); }, [router]);
  useEffect(() => { inRoomRef.current = inRoom; }, [inRoom]);

  useEffect(() => {
    onPortalHoverRef.current = (hovered, x, y) => setPortalTip(hovered ? { x, y } : null);
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
    const fill = new THREE.DirectionalLight(0xcfe0f5, 0.45);   // 태양 반대편 채움
    fill.position.set(-20, 18, -16);
    scene.add(fill);
    const warmA = new THREE.PointLight(0xffdfae, 0.3, 52); warmA.position.set(-8, 6.4, -2); scene.add(warmA);
    const warmB = new THREE.PointLight(0xffdfae, 0.28, 52); warmB.position.set(9, 6.4, 3); scene.add(warmB);
    const corrL = new THREE.PointLight(0xfff6e0, 0.26, 36); corrL.position.set(0, 5.2, 0); scene.add(corrL);

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
    scene.add(floor);

    /* ── 바깥 배경 (해질녘 산업단지) ──────────────────────────────────
       ⚠️ 바닥을 만든 **뒤에** 세운다. 야적장 판이 창고 바닥 치수를 받아 그 둘레에
          깔리므로, 치수가 정해지기 전에 부르면 크기가 어긋난다.
       ⚠️ 야적장 판은 y = -0.03 이다. 창고 바닥(y = 0)보다 낮게 두어야 겹치는 자리에서
          두 판이 서로 깜빡이지(z-fighting) 않는다. */
    const exterior = createExterior(THREE, { floorW, floorD, floorCz });
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
    addWall("left", new THREE.BoxGeometry(0.3, 5.4, floorD), 0x1a2028, -floorW / 2, 4.0, floorCz);
    addWall("left", new THREE.BoxGeometry(0.34, 1.3, floorD), 0x232b35, -floorW / 2, 0.65, floorCz);
    addWall("right", new THREE.BoxGeometry(0.3, 5.4, floorD), 0x1a2028, floorW / 2, 4.0, floorCz);
    addWall("right", new THREE.BoxGeometry(0.34, 1.3, floorD), 0x232b35, floorW / 2, 0.65, floorCz);

    /* 랙 구조 (인스턴싱) */
    const posts = [], decks = [], bars = [];
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
    const addInstanced = (list, mat) => {
      const im = new THREE.InstancedMesh(boxGeo, mat, list.length);
      list.forEach((it, i) => {
        dummy.position.set(...it.p); dummy.rotation.set(0, 0, 0);
        dummy.scale.set(...it.s); dummy.updateMatrix();
        im.setMatrixAt(i, dummy.matrix);
      });
      im.instanceMatrix.needsUpdate = true;
      scene.add(im);
      return im;
    };
    addInstanced(posts, new THREE.MeshLambertMaterial({ color: 0x2f66a8 }));
    addInstanced(decks, new THREE.MeshLambertMaterial({ color: 0x89929b }));
    addInstanced(bars, new THREE.MeshLambertMaterial({ color: 0xd96a26 }));

    /* 박스 (규격별 InstancedMesh) */
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

    /* 구역 라벨 */
    const labels = {};
    for (const z of layout.zones) {
      const g = z.g;
      const sub = `${DIMS_TXT[g.id]}cm · ${g.vol}cm³`;
      const sp = makeLabel(`${g.code} · ${g.name}`, sub, g.color);
      const pitch = g.h + PITCH_PAD;
      sp.position.set(z.center, g.levels * pitch + 1.35, z.zStart + z.len / 2);
      scene.add(sp);
      labels[g.id] = sp;
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
      for (let b = 0; b < nB; b++) {
        const s = 0.34 + rngP() * 0.3;
        const bx = new THREE.Mesh(new THREE.BoxGeometry(s, s * 0.8, s), cbMat);
        bx.position.set(pal.position.x + (rngP() - 0.5) * 0.5, 0.13 + s * 0.4 + b * s * 0.8, pal.position.z + (rngP() - 0.5) * 0.5);
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
      });
      scene.add(st.group);
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
        for (let b = 0; b < n; b++) {
          const sz = 0.46 + rngO() * 0.2;
          const bx = new THREE.Mesh(new THREE.BoxGeometry(0.95, sz, 0.9), cbMat);
          bx.position.set(cx + (rngO() - 0.5) * 0.12, 0.13 + sz / 2 + b * sz, pz + (rngO() - 0.5) * 0.12);
          bx.rotation.y = (rngO() - 0.5) * 0.14;
          scene.add(bx);
        }
      }
    }

    /* 작업자 2명 — CJ풍 근무복 (형광조끼+카트 / 회색점퍼+스캐너) */
    const patrolBound = Math.min(...layout.rowWidths) / 2 + 1.2;
    const worker1 = buildWorker({ cart: true, outfit: "vest" });
    const worker2 = buildWorker({ cart: false, outfit: "jacket", device: true });
    worker1.grp.position.set(-patrolBound * 0.5, 0, -0.72);
    worker2.grp.position.set(patrolBound * 0.55, 0, 0.72);
    scene.add(worker1.grp);
    scene.add(worker2.grp);
    const workers = [
      { m: worker1, s: { x: -patrolBound * 0.5, z: -0.72, dir: 1, head: Math.PI / 2, mode: "walk", timer: 3.5, pickT: 0, swing: 0, phase: 0, speed: 1.05, rng: mulberry32(555) } },
      { m: worker2, s: { x: patrolBound * 0.55, z: 0.72, dir: -1, head: -Math.PI / 2, mode: "walk", timer: 5.2, pickT: 0, swing: 0, phase: 1.7, speed: 0.9, rng: mulberry32(910) } },
    ];

    /* 지게차 — 입고장 라인 주행, 정차 시 포크 승강 */
    const fk = buildForklift();
    const fkBound = floorW / 2 - 4.2;
    const fkZ = CORRIDOR / 2 + layout.frontLen + 1.5;
    fk.grp.position.set(fkBound * 0.4, 0, fkZ);
    fk.grp.rotation.y = -Math.PI / 2;
    scene.add(fk.grp);
    const fkS = {
      x: fkBound * 0.4, dir: -1, head: -Math.PI / 2,
      mode: "drive", timer: 6, liftT: 0, t: 0, rng: mulberry32(777),
    };

    /* AGV 2대 — 사각 순환 경로 (앞줄 루프 / 뒷줄 루프, 반대 방향) */
    const sideA = Math.max(...layout.rowWidths) / 2 + 2.4;
    const sideB = Math.max(...layout.rowWidths) / 2 + 3.3;
    const frontLane = CORRIDOR / 2 + layout.frontLen + 0.5;
    const backLane = -(CORRIDOR / 2 + layout.backLen + 0.7);
    const agv1 = buildAGV({ tote: true });   // 토트 적재 — 앞줄 시계 방향
    const agv2 = buildAGV({ tote: false }); // 공차 — 뒷줄 반시계 방향
    scene.add(agv1.grp);
    scene.add(agv2.grp);
    const agvs = [
      {
        u: agv1, speed: 1.35, seg: 0, prog: 1.5, pauseT: 0, nextPause: 7, t: 0, rng: mulberry32(2024),
        path: [[-sideA, -0.15], [sideA, -0.15], [sideA, frontLane], [-sideA, frontLane]],
      },
      {
        u: agv2, speed: 1.2, seg: 0, prog: 4.0, pauseT: 0, nextPause: 9.5, t: 2.1, rng: mulberry32(4096),
        path: [[sideB, 0.15], [-sideB, 0.15], [-sideB, backLane], [sideB, backLane]],
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
      scene.add(crane);

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

      // P&D 스테이션 (통로 출구 소형 컨베이어)
      const dropZ = zEnd - 0.55;
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
        st: { phase: "pause", timer: 1.2 + rng() * 1.4, tgt: null, t: 0 },
      };
    };
    const cranes = CRANE_ZONES.map(buildStackerCrane);

    /* ── 카메라 궤도 컨트롤 ── */
    const OVERVIEW = { az: 0.62, pol: 1.00, r: 28.5, tx: 0, ty: 1.3, tz: 0.6 };
    const cur = { ...OVERVIEW }, des = { ...OVERVIEW };
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
          focusedStation = st;
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
      focusedStation = null;   // 다른 데를 봤으면 작업대에서 눈을 뗀 것이다
    };
    const onDown = (e) => {
      ptrs.set(e.pointerId, [e.clientX, e.clientY]);
      el.setPointerCapture(e.pointerId);
      clickInfo = ptrs.size === 1 ? { x: e.clientX, y: e.clientY, t: performance.now() } : null;
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
      onPortalHoverRef.current?.(next, x, y);
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
    };
    const onDbl = () => { Object.assign(des, OVERVIEW); focusedStation = null; };
    /* 우클릭 드래그로 카메라를 돌리므로, 네이티브 컨텍스트 메뉴는 방해만 된다 */
    const onContextMenu = (e) => e.preventDefault();

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
      if (e.target instanceof HTMLElement) {
        const tag = e.target.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "BUTTON" || tag === "SELECT") return;
      }
      e.preventDefault();
      const order = [...stations].reverse();   // 앞쪽(+z)이 배열 뒤에 있다
      const at = order.indexOf(focusedStation);
      const next = order[at + 1];
      if (next) {
        focusedStation = next;
        focusStation(next);
      } else {
        Object.assign(des, OVERVIEW);
        focusedStation = null;
      }
    };
    window.addEventListener("keydown", onKey);
    const onWheel = (e) => { e.preventDefault(); des.r = Math.min(58, Math.max(6, des.r * (1 + e.deltaY * 0.0011))); };
    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onUp);
    el.addEventListener("dblclick", onDbl);
    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("contextmenu", onContextMenu);

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
        for (let i = 0; i < gm.total; i++) {
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
    const resetView = () => { Object.assign(des, OVERVIEW); focusedStation = null; };

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
        m.grp.position.z = s.z;
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
        fadeWall(wallSets.right, camP.x > floorW / 2 - 2.5);
      }

      /* 카메라 감쇠 */
      cur.az += (des.az - cur.az) * 0.09;
      cur.pol += (des.pol - cur.pol) * 0.09;
      cur.r += (des.r - cur.r) * 0.09;
      cur.tx += (des.tx - cur.tx) * 0.09;
      cur.ty += (des.ty - cur.ty) * 0.09;
      cur.tz += (des.tz - cur.tz) * 0.09;
      applyCam();
      if (mount.clientWidth > 4) renderer.render(scene, camera);
      portal.update(dt, portalHovered);   // dt 는 위에서 이미 0.05 로 잘려 있다
      for (const st of stations) st.update(dt, st === hoveredStation, st === focusedStation);
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
      renderer.dispose();
      mount.removeChild(renderer.domElement);
    };
  }, []);

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
    const ctx = cvs.getContext("2d");
    let raf;
    const draw = () => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const w = cvs.width / dpr, h = cvs.height / dpr;
      ctx.fillStyle = "#10151C"; ctx.fillRect(0, 0, w, h);
      // 바닥
      ctx.fillStyle = "#171D27";
      ctx.fillRect(X(-floorW / 2), Y(zMin), floorW * scale, worldD * scale);
      ctx.strokeStyle = "#2C3644"; ctx.lineWidth = 1.5;
      ctx.strokeRect(X(-floorW / 2), Y(zMin), floorW * scale, worldD * scale);
      // 그리드
      ctx.strokeStyle = "rgba(255,255,255,0.035)"; ctx.lineWidth = 1;
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
      ctx.fillStyle = "rgba(70,95,80,0.22)";
      ctx.fillRect(X(-floorW / 2), Y(laneA), floorW * scale, (laneB - laneA) * scale);
      ctx.strokeStyle = "rgba(250,205,60,0.8)"; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(X(-floorW / 2), Y(laneA)); ctx.lineTo(X(floorW / 2), Y(laneA)); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(X(-floorW / 2), Y(laneB)); ctx.lineTo(X(floorW / 2), Y(laneB)); ctx.stroke();
      ctx.strokeStyle = "rgba(255,255,255,0.3)"; ctx.setLineDash([6, 5]);
      ctx.beginPath(); ctx.moveTo(X(-floorW / 2), Y(0)); ctx.lineTo(X(floorW / 2), Y(0)); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = "rgba(255,255,255,0.4)";
      ctx.font = `700 15px ${MAP_FONT}`; ctx.textAlign = "left";
      ctx.fillText("작업 통로", X(-floorW / 2) + 6, Y(0) + 3);
      // 하역 라인
      /* 하역 라인 경계선.
         ★ +1.7 에서 +3.1 로 내렸다. 원래 자리는 앞줄(D·E·F) 이름 줄과 같은 높이여서,
           점선이 글자를 관통했다(위 스크린샷의 "대형 185/220" 이 선 위에 얹힌 상태).
           라벨 두 줄이 끝나는 아래로 보내면 셋이 서로 안 겹친다. */
      const inZ = CORRIDOR / 2 + layout.frontLen + 3.1;
      ctx.strokeStyle = "rgba(255,138,42,0.65)"; ctx.setLineDash([9, 6]); ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(X(-floorW / 2 + 1.5), Y(inZ)); ctx.lineTo(X(floorW / 2 - 1.5), Y(inZ)); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = "rgba(255,255,255,0.35)";
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
        ctx.fillStyle = rgba(col, 0.07 + occ * 0.26);
        ctx.fillRect(rx, ry, rw, rh);
        ctx.strokeStyle = rgba(col, 0.75); ctx.lineWidth = 1.5;
        ctx.strokeRect(rx, ry, rw, rh);
        ctx.fillStyle = rgba(col, 0.5);
        for (const rkx of z.racks) {
          ctx.fillRect(X(rkx - z.depth / 2), Y(z.zStart), z.depth * scale, z.len * scale);
        }
        if (z.g.cold) {
          ctx.strokeStyle = "rgba(240,200,60,0.7)"; ctx.setLineDash([5, 4]);
          ctx.strokeRect(X(z.x0 - z.pad), Y(z.zStart - z.pad), (z.width + z.pad * 2) * scale, (z.len + z.pad * 2) * scale);
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
        ctx.fillStyle = rgba(col, 0.95);
        ctx.font = `800 24px ${MAP_FONT}`;
        ctx.fillText(z.g.code, rx + rw / 2, above ? ry - 9 : ry + rh + 21);
        ctx.font = `700 16px ${MAP_FONT}`;
        ctx.fillStyle = "#C8D4E0";
        ctx.fillText(
          `${z.g.name} ${pg ? pg.filled + "/" + pg.total : ""}`,
          rx + rw / 2,
          above ? ry - 35 : ry + rh + 41,
        );
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
            ctx.strokeStyle = "rgba(200,210,220,0.4)"; ctx.lineWidth = 1;
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
          ctx.strokeStyle = "#10151C"; ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.arc(wx, wy, 4, 0, Math.PI * 2); ctx.stroke();
          ctx.strokeStyle = i === 0 ? "#FFD23E" : "#F2F5F8";
          ctx.beginPath(); ctx.moveTo(wx, wy);
          ctx.lineTo(wx + Math.sin(wk.r) * 8, wy + Math.cos(wk.r) * 8);
          ctx.stroke();
        }
      }
      // 헤더
      ctx.textAlign = "left";
      ctx.fillStyle = "#8FA3B8"; ctx.font = `700 17px ${MAP_FONT}`;
      ctx.fillText("WAREHOUSE MAP — 실시간 탑뷰", 9, 19);
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
            <div style={{ display: tab === "3d" ? "block" : "none", position: "absolute", inset: 0 }}>
              <div className="w98-raised" style={{ position: "absolute", top: 0, left: 0, right: 0, height: 32, display: "flex", alignItems: "center", gap: 6, padding: "0 6px", zIndex: 20 }}>
                <button className="w98-btn" onClick={() => { setTab("map"); setSel(null); apiRef.current?.setHighlight(null); }}>◀ 지도</button>
                <button className="w98-btn" onClick={() => { setSel(null); apiRef.current?.setHighlight(null); apiRef.current?.resetView(); }}>전체 보기</button>
                <span style={{ fontWeight: "bold", marginLeft: 4 }}>3D VIEW — {sel ? GRADES.find((g) => g.id === sel)?.name : "전체"}</span>
              </div>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700;900&family=JetBrains+Mono:wght@500;700&display=swap');
        /* 유리판 - 위에서 아래로 아주 옅게 밝아지는 바탕 + 윗변 하이라이트 한 줄.
           평평한 반투명 사각형보다 한 겹 더 얹혀 있어 보인다. 바깥이 한낮으로 바뀌어
           배경이 밝아진 만큼 그림자를 키워야 패널이 배경에 묻히지 않는다. */
        .ws-panel { background: linear-gradient(180deg, rgba(19,26,36,.90), rgba(11,16,23,.86)); border: 1px solid rgba(150,180,215,.18); border-radius: 12px; backdrop-filter: blur(14px) saturate(1.15); box-shadow: 0 10px 30px rgba(0,0,0,.40), inset 0 1px 0 rgba(255,255,255,.07); color: #E8EDF4; }
        /* 머리글 - 작고 넓게 벌린 대문자. 제목이 아니라 '분류표'로 읽히게 한다 */
        .ws-eyebrow { font: 700 9.5px/1 'JetBrains Mono', monospace; letter-spacing: 1.8px; color: #6E8398; }
        .ws-h { font-size: 14.5px; font-weight: 800; letter-spacing: -.2px; }
        /* 구분선을 한쪽으로 흐리게 뺀다. 양끝까지 또렷한 선은 패널을 두 조각으로 잘라 버린다 */
        .ws-rule { height: 1px; background: linear-gradient(90deg, rgba(150,180,215,.24), rgba(150,180,215,0)); margin: 11px 0 9px; }
        .ws-stat { background: rgba(255,255,255,.045); border: 1px solid rgba(255,255,255,.06); border-radius: 8px; padding: 6px 9px; }
        .ws-stat span { font-size: 10px; color: #6E8398; }
        .ws-stat b { display: block; font: 700 15px 'JetBrains Mono', monospace; margin-top: 1px; color: #E8EDF4; }
        .ws-chip { display:flex; align-items:stretch; gap:9px; padding:6px 8px; border-radius:8px; cursor:pointer; border:1px solid transparent; transition: background .15s, border-color .15s; user-select:none; }
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
      <div className="ws-panel ws-left" style={{ position: "absolute", top: 46, left: 14, width: 252, padding: 14, fontFamily: "'Noto Sans KR', sans-serif" }}>
        <div className="ws-eyebrow">SLOT WAREHOUSE · SCENARIO 3</div>
        <div className="ws-h" style={{ marginTop: 5 }}>창고 슬롯 대시보드</div>

        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginTop: 12 }}>
          <div style={{ fontSize: 34, fontWeight: 700, fontFamily: "'JetBrains Mono',monospace", lineHeight: 0.95, color: over ? "#FF6B6B" : "#FFC978" }}>
            {u.toFixed(1)}<span style={{ fontSize: 15, marginLeft: 1 }}>%</span>
          </div>
          <div style={{ textAlign: "right", fontSize: 10.5, color: "#7E90A5", lineHeight: 1.5 }}>
            {dateTxt}<br />D+{day}
          </div>
        </div>

        <div style={{ height: 5, borderRadius: 3, background: "rgba(255,255,255,.07)", marginTop: 9, position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: 0, bottom: 0, left: 0, width: `${u}%`, borderRadius: 3, background: over ? "#FF6B6B" : "linear-gradient(90deg,#FFC24A,#FF8A2A)" }} />
          <div style={{ position: "absolute", left: `${THRESHOLD}%`, top: -1, bottom: -1, width: 2, background: "#FF6B6BAA" }} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 5, fontSize: 10, color: "#6E8398", fontFamily: "'JetBrains Mono',monospace" }}>
          <span>{usedVol} / 866.9 ㎥</span>
          <span>임계 {THRESHOLD}%</span>
        </div>

        <div className="ws-rule" />

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
          <div className="ws-stat"><span>입고</span><b style={{ color: "#7FD49A" }}>{stats?.inn?.toLocaleString() ?? "—"}</b></div>
          <div className="ws-stat"><span>출고</span><b style={{ color: "#8FB7E8" }}>{stats?.out?.toLocaleString() ?? "—"}</b></div>
          <div className="ws-stat"><span>재고</span><b>{REAL_STOCK[day].toLocaleString()}</b></div>
          <div className="ws-stat"><span>표시 슬롯</span><b>{stats ? stats.shownTotal.toLocaleString() : "4,004"}</b></div>
        </div>

        {over && (
          <div style={{ marginTop: 9, padding: "7px 10px", borderRadius: 8, background: "rgba(255,90,90,.12)", border: "1px solid rgba(255,107,107,.38)", fontSize: 11.5, color: "#FFB4B4", fontWeight: 700 }}>
            임계치 {THRESHOLD}% 초과 · 보관공간 부족 예상
          </div>
        )}
      </div>

      {/* ── 우측: 규격 범례 ── */}
      <div className="ws-panel ws-legend" style={{ position: "absolute", top: 46, right: 14, width: 224, padding: 12, fontFamily: "'Noto Sans KR', sans-serif" }}>
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
        <div style={{ fontSize: 10, color: "#5F7186", marginTop: 2, marginBottom: 8 }}>클릭 시 해당 구역만 강조</div>

        {GRADES.map((g) => {
          const pg = stats?.perGrade?.[g.id];
          const col = "#" + g.color.toString(16).padStart(6, "0");
          const pct = pg ? (pg.filled / pg.total) * 100 : 0;
          return (
            <div key={g.id} className={`ws-chip ${sel === g.id ? "on" : ""}`} onClick={() => toggleSel(g.id)}
              role="button" tabIndex={0} onKeyDown={(e) => e.key === "Enter" && toggleSel(g.id)}>
              {/* 색 표식을 점이 아니라 **세로 막대**로 바꿨다. 줄마다 왼쪽 끝이 색으로
                  정렬되어, 여섯 줄이 목록 하나로 묶여 보인다 */}
              <div style={{ width: 3, alignSelf: "stretch", borderRadius: 2, background: col, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 700 }}>
                    <span style={{ color: col, fontFamily: "'JetBrains Mono',monospace", marginRight: 5 }}>{g.code}</span>
                    {g.name}
                  </span>
                  <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10.5, color: "#9FB0C3" }}>
                    {pg ? `${pg.filled}/${pg.total}` : "—"}
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
                  <div style={{ flex: 1, height: 3, borderRadius: 2, background: "rgba(255,255,255,.07)" }}>
                    <div style={{ width: `${pct}%`, height: "100%", borderRadius: 2, background: col }} />
                  </div>
                  <span style={{ fontSize: 9.5, color: "#5F7186", fontFamily: "'JetBrains Mono',monospace", width: 34, textAlign: "right" }}>{g.share}</span>
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
        <div style={{ position: "absolute", bottom: 14, left: "50%", transform: "translateX(-50%)", display: "flex", gap: 6, fontFamily: "'Noto Sans KR', sans-serif" }}>
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

      {/* ── 우하단 힌트 ── */}
      <div style={{ position: "absolute", bottom: 14, right: 14, fontSize: 10.5, color: "#5F7186", textAlign: "right", lineHeight: 1.6, pointerEvents: "none", fontFamily: "'Noto Sans KR', sans-serif" }}>
        드래그 회전 · 스크롤/핀치 확대 · 클릭 → 지점 줌인<br />
        <b style={{ color: "#FFC978" }}>Enter → 출고 포스기 확대</b> · 더블클릭 → 전체 보기 · 범례 클릭 → 구역 하이라이트
      </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── 포탈 툴팁 ──
          (경고) `pointerEvents: none` 이 없으면 툴팁이 커서 아래로 들어가 포탈에서 마우스가
             벗어난 것으로 처리되고, 툴팁이 깜빡이며 사라졌다 나타났다 한다. */}
      {portalTip && !inRoom && (
        <div
          style={{
            position: "absolute", left: portalTip.x + 18, top: portalTip.y - 12,
            padding: "6px 11px", background: "rgba(26,15,46,0.94)",
            border: "1px solid #B04DFF", borderRadius: 3,
            color: "#E9D5FF", fontSize: 12.5, fontWeight: 700, whiteSpace: "nowrap",
            fontFamily: "'Malgun Gothic', sans-serif", pointerEvents: "none",
            boxShadow: "0 0 14px rgba(176,77,255,0.55)", zIndex: 40,
          }}
        >
          신규 물품 입고 검수실로 이동
        </div>
      )}

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

