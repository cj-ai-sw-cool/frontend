/* ═══════════════════════════════════════════════════════════════════════════
   분석 화면 — 실시간 창고 맵 (2D 전용)

   ★ 창고 화면(`/warehouse-win98`)의 2D 지도를 여기에 옮겨 놓은 것이다. 다만 **그 컴포넌트를
     그대로 가져오지 않았다.** 거기서는 지도의 움직이는 것들(AGV·지게차·작업자)이 three.js
     씬의 매 프레임 결과를 받아 그려진다 — 지도를 살리려면 보이지도 않는 3D 창고를 통째로
     돌려야 한다는 뜻이다. 분석 대시보드 한 칸을 위해 WebGL 컨텍스트와 수천 개의 인스턴스를
     띄우는 건 값이 맞지 않는다.
     그래서 여기서는 **2D 만으로 자족하는 사본**을 만들었다. 물동량 데이터와 배치 계산은
     같은 것을 쓰고(아래), 움직이는 것들만 시간 함수로 직접 그린다.

   ⚠️ 배치 상수(`GRADES` · `computeLayout` · `CORRIDOR` …)와 실측 데이터는 창고 화면에서
      **복사해 온 것**이다. 이 저장소는 win98 화면마다 `_components` 를 따로 갖는 것을
      규칙으로 삼는다(다른 화면들과 같은 방식). 창고 쪽 규격이나 데이터를 바꾸면 여기도
      같이 바꿔야 한다 — 자동으로 따라오지 않는다.
   ⚠️ 움직이는 것들은 **시연용 궤적**이다. 창고 화면의 상태 기계(적재/하역/대기)를 옮겨
      오지 않았고, 정해진 경로를 일정 속도로 도는 것뿐이다. 지도가 "살아 있다"를 보이는 게
      목적이지 동작을 재현하는 게 아니다.
   ═══════════════════════════════════════════════════════════════════════════ */
"use client";

import React, { useEffect, useRef, useState } from "react";

/* 실측 데이터 — 창고 화면에서 복사. 이 지도가 실제로 쓰는 것만 남겼다:
   날짜 라벨(`REAL_DATES`)과 규격별 재고(`REAL_INV`). 사용률·입출고 건수는 위쪽 요약
   카드가 맡으므로 여기서는 들고 있지 않는다. */
const REAL_DATES = ["2024-08-01", "2024-08-02", "2024-08-05", "2024-08-06", "2024-08-07", "2024-08-08", "2024-08-09", "2024-08-12", "2024-08-13", "2024-08-14", "2024-08-16", "2024-08-19", "2024-08-20", "2024-08-21", "2024-08-22", "2024-08-23", "2024-08-26", "2024-08-27", "2024-08-28", "2024-08-29", "2024-08-30", "2024-09-02", "2024-09-03", "2024-09-04", "2024-09-05", "2024-09-06", "2024-09-08", "2024-09-09", "2024-09-10", "2024-09-11", "2024-09-12", "2024-09-13", "2024-09-19", "2024-09-20", "2024-09-23", "2024-09-24", "2024-09-25", "2024-09-26", "2024-09-27", "2024-09-30", "2024-10-02", "2024-10-03", "2024-10-04", "2024-10-07", "2024-10-08", "2024-10-10", "2024-10-11", "2024-10-14", "2024-10-15", "2024-10-16", "2024-10-17", "2024-10-18", "2024-10-21", "2024-10-22", "2024-10-23", "2024-10-24", "2024-10-25", "2024-10-28", "2024-10-29", "2024-10-30", "2024-10-31"];
const REAL_INV = {xs:[2515,3177,3404,4037,4251,4143,4651,5502,5356,5203,4756,3895,6017,4996,5027,5297,5836,5836,5537,5699,5776,5723,5485,5193,4963,5637,5637,5448,5727,5692,5293,5348,4718,4716,4015,4893,4725,4916,5945,6105,5621,5620,5602,5462,5508,5731,5931,5873,5693,5563,5446,5972,5276,5034,5136,5229,5424,5488,5247,5087,5032],s:[1284,1658,1586,2129,2296,2251,2633,3150,3093,3032,2894,2496,3479,3295,3335,3801,4051,4033,3912,3912,4012,3862,3755,3635,3560,3864,3864,3738,3938,4163,3988,4051,3935,4061,3773,3759,3822,3816,3873,3641,3421,3421,3575,3597,3622,3690,3727,3605,3658,3560,3521,3673,3388,3411,3359,3303,3402,3321,3295,3236,3196],m:[789,972,1019,1268,1351,1327,1451,1792,1766,1739,1680,1515,2101,1927,1919,1945,2106,2141,2090,2072,2099,2103,2047,1992,1934,2042,2041,1927,2175,2242,2174,2184,2089,2098,1977,1994,1971,1995,2095,1944,1855,1855,1878,1843,1852,1890,1963,1938,1893,1867,1846,1944,1812,1785,1785,1763,1852,1824,1825,1805,1806],l:[165,283,288,369,412,406,466,594,584,568,536,415,643,552,552,638,673,689,642,659,673,710,693,659,630,683,683,724,711,719,677,690,629,620,545,640,636,660,735,814,763,763,770,740,765,777,802,786,769,746,733,726,630,606,596,596,591,611,594,579,567],xxl:[43,58,44,57,73,68,101,116,108,100,93,46,67,21,21,32,14,26,15,12,20,17,6,9,26,77,77,77,133,141,119,126,96,101,60,92,69,76,117,124,98,98,99,107,121,121,120,103,80,75,69,99,109,104,98,102,104,103,92,85,80],xl:[17,20,12,3,14,9,9,12,16,15,13,12,16,11,13,15,22,16,12,12,25,33,31,29,24,46,46,48,51,49,47,50,47,49,29,22,28,30,39,49,38,38,44,44,44,46,39,33,28,24,27,29,27,23,23,20,14,13,9,13,9]};

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

const MAP_FONT = "'Malgun Gothic', '맑은 고딕', 'Apple SD Gothic Neo', sans-serif";

const AISLE = 1.7, PAIR_GAP = 0.08, ZONE_GAP = 2.3;   // 3D 전용 PITCH_PAD 는 뺐다

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

/* ── 닫힌 경로 위의 한 점 ────────────────────────────────────────────────
   `t` 는 0~1. 변의 길이에 비례해 나눠 걷는다 — 꼭짓점마다 같은 시간을 주면 짧은 변에서
   느려지고 긴 변에서 빨라져, 도는 물체의 속도가 들쭉날쭉해 보인다. */
function onLoop(pts, t) {
  const segs = [];
  let total = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    const d = Math.hypot(b[0] - a[0], b[1] - a[1]);
    segs.push(d);
    total += d;
  }
  let want = ((t % 1) + 1) % 1 * total;
  for (let i = 0; i < pts.length; i++) {
    if (want <= segs[i] || i === pts.length - 1) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      const k = segs[i] > 0 ? want / segs[i] : 0;
      return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
    }
    want -= segs[i];
  }
  return pts[0];
}

/**
 * @param {{ onOpen3D?: () => void }} props
 *   `onOpen3D` — 지도를 누르면 부를 함수. 분석 화면이 3D 전체 화면을 여는 데 쓴다.
 *   ⚠️ 손잡이는 **지도 판에만** 건다. 조작줄(재생·슬라이더)까지 덮으면 날짜를 옮기려다
 *      3D 가 열린다.
 */
export default function WarehouseMap({ onOpen3D }) {
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const [day, setDay] = useState(29);
  const [playing, setPlaying] = useState(true);

  /* 재생 — 창고 화면과 같은 속도(0.42초에 하루) */
  useEffect(() => {
    if (!playing) return;
    const iv = setInterval(() => {
      setDay((d) => (d >= 60 ? (setPlaying(false), 60) : d + 1));
    }, 420);
    return () => clearInterval(iv);
  }, [playing]);

  /* 날짜는 상태지만 그리기 루프는 매 프레임 돈다. 루프 안에서 상태를 직접 읽으면 첫 값에
     붙박이므로 ref 로 넘긴다 */
  const dayRef = useRef(day);
  useEffect(() => { dayRef.current = day; }, [day]);

  useEffect(() => {
    const wrap = wrapRef.current, cvs = canvasRef.current;
    if (!wrap || !cvs) return;

    const layout = computeLayout();
    const zMin = -CORRIDOR / 2 - layout.backLen - 3.0;
    const zMax = CORRIDOR / 2 + layout.frontLen + 3.5;   // 뒤쪽 빈 마당은 잘라 낸다
    const floorW = Math.max(...layout.rowWidths) + 11;
    const worldD = zMax - zMin;

    let scale = 1, ox = 0, oy = 0, dpr = 1;
    const fit = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.max(10, wrap.clientWidth), h = Math.max(10, wrap.clientHeight);
      cvs.width = w * dpr; cvs.height = h * dpr;
      cvs.style.width = w + "px"; cvs.style.height = h + "px";
      scale = Math.min((w - 24) / floorW, (h - 46) / worldD);
      ox = (w - floorW * scale) / 2;
      oy = (h - worldD * scale) / 2 + 6;
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(wrap);

    const X = (wx) => ox + (wx + floorW / 2) * scale;
    const Y = (wz) => oy + (wz - zMin) * scale;
    const rgba = (n, a) => `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
    const ctx = cvs.getContext("2d");

    /* 움직이는 것들의 경로 — 창고 3D 와 같은 자리를 쓴다 */
    const sideA = Math.max(...layout.rowWidths) / 2 + 2.4;
    const sideB = Math.max(...layout.rowWidths) / 2 + 3.3;
    const frontLane = CORRIDOR / 2 + layout.frontLen + 0.5;
    const backLane = -(CORRIDOR / 2 + layout.backLen + 0.7);
    const unloadZ = CORRIDOR / 2 + layout.frontLen + 1.5;
    const agv1 = [[-sideA, -0.15], [sideA, -0.15], [sideA, frontLane], [-sideA, frontLane]];
    const agv2 = [[sideB, 0.15], [-sideB, 0.15], [-sideB, backLane], [sideB, backLane]];
    const zoneA = layout.zones[0];

    const t0 = performance.now();
    let raf;

    const draw = () => {
      const el = (performance.now() - t0) / 1000;
      const d = dayRef.current;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const w = cvs.width / dpr, h = cvs.height / dpr;
      ctx.fillStyle = "#10151C";
      ctx.fillRect(0, 0, w, h);

      // 바닥
      ctx.fillStyle = "#171D27";
      ctx.fillRect(X(-floorW / 2), Y(zMin), floorW * scale, worldD * scale);
      ctx.strokeStyle = "#2C3644"; ctx.lineWidth = 1.5;
      ctx.strokeRect(X(-floorW / 2), Y(zMin), floorW * scale, worldD * scale);

      // 2m 격자
      ctx.strokeStyle = "rgba(255,255,255,0.035)"; ctx.lineWidth = 1;
      for (let gx = Math.ceil(-floorW / 2 / 2) * 2; gx <= floorW / 2; gx += 2) {
        ctx.beginPath(); ctx.moveTo(X(gx), Y(zMin)); ctx.lineTo(X(gx), Y(zMax)); ctx.stroke();
      }
      for (let gz = Math.ceil(zMin / 2) * 2; gz <= zMax; gz += 2) {
        ctx.beginPath(); ctx.moveTo(X(-floorW / 2), Y(gz)); ctx.lineTo(X(floorW / 2), Y(gz)); ctx.stroke();
      }

      /* 작업 통로 — 구역 사각형이 끝나는 지점부터 맞은편이 시작하는 지점까지만 칠한다.
         `ZONE_PAD` 는 아래 구역 그리기의 여백과 같은 값이어야 한다 */
      const ZONE_PAD = 0.4;
      const laneA = -CORRIDOR / 2 + ZONE_PAD, laneB = CORRIDOR / 2 - ZONE_PAD;
      ctx.fillStyle = "rgba(70,95,80,0.22)";
      ctx.fillRect(X(-floorW / 2), Y(laneA), floorW * scale, (laneB - laneA) * scale);
      ctx.strokeStyle = "rgba(250,205,60,0.8)"; ctx.lineWidth = 1.5;
      for (const zz of [laneA, laneB]) {
        ctx.beginPath(); ctx.moveTo(X(-floorW / 2), Y(zz)); ctx.lineTo(X(floorW / 2), Y(zz)); ctx.stroke();
      }
      ctx.strokeStyle = "rgba(255,255,255,0.3)"; ctx.setLineDash([6, 5]);
      ctx.beginPath(); ctx.moveTo(X(-floorW / 2), Y(0)); ctx.lineTo(X(floorW / 2), Y(0)); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = "rgba(255,255,255,0.4)";
      ctx.font = `700 13px ${MAP_FONT}`; ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
      ctx.fillText("작업 통로", X(-floorW / 2) + 6, Y(0) + 3);

      // 하역 라인
      ctx.strokeStyle = "rgba(255,138,42,0.6)"; ctx.setLineDash([9, 6]); ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(X(-floorW / 2 + 1.5), Y(unloadZ + 0.2));
      ctx.lineTo(X(floorW / 2 - 1.5), Y(unloadZ + 0.2));
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = "rgba(255,255,255,0.34)";
      ctx.fillText("UNLOADING 하역 라인 →", X(-floorW / 2) + 6, Y(unloadZ + 0.2) - 6);

      /* 구역 — 점유율에 따라 채움 농도가 달라진다.
         뒷줄(A·B·C)은 라벨을 사각형 **위**에, 앞줄(D·E·F)은 아래에 붙인다. 둘 다 아래에
         붙이면 뒷줄 라벨이 작업 통로 한가운데에 떠서 통로 표시와 서로를 가린다 */
      ctx.textAlign = "center";
      for (const z of layout.zones) {
        const col = z.g.color;
        const occ = Math.min(0.99, Math.max(0.015,
          (REAL_INV[z.g.invKey][d] / INV_PEAK[z.g.invKey]) * 0.95));
        const rx = X(z.x0 - 0.35), ry = Y(z.zStart - ZONE_PAD);
        const rw = (z.width + 0.7) * scale, rh = (z.len + ZONE_PAD * 2) * scale;

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
          ctx.strokeRect(X(z.x0 - z.pad), Y(z.zStart - z.pad),
            (z.width + z.pad * 2) * scale, (z.len + z.pad * 2) * scale);
          ctx.setLineDash([]);
        }

        /* 라벨 — 뒷줄(A·B·C)은 사각형 **위**, 앞줄(D·E·F)은 아래.
           ⚠️ 이 지도는 대시보드 한 칸에 들어가서 폭이 크게 달라진다. 글자 크기를 고정하면
              좁을 때 이웃 구역 이름과 서로 겹쳐 한 줄로 이어져 읽힌다(D·E·F 에서 특히).
              그래서 **축척에 맞춰 크기를 줄이고, 그래도 넘치면 이름을 버리고 숫자만** 남긴다.
              지울 것을 정하는 순서가 중요하다 — 이름보다 채움 수가 정보다. */
        const above = z.row === 0;
        const total = z.racks.length * z.g.levels * z.g.cols;
        const codeSize = Math.max(12, Math.min(20, scale * 1.05));
        const nameSize = Math.max(8.5, Math.min(13, scale * 0.72));

        ctx.fillStyle = rgba(col, 0.95);
        ctx.font = `800 ${codeSize}px ${MAP_FONT}`;
        ctx.fillText(z.g.code, rx + rw / 2, above ? ry - codeSize * 0.42 : ry + rh + codeSize);

        ctx.font = `700 ${nameSize}px ${MAP_FONT}`;
        ctx.fillStyle = "#C8D4E0";
        const count = `${Math.round(occ * total)}/${total}`;
        const full = `${z.g.name} ${count}`;
        const room = rw + 6;   // 사각형보다 아주 조금 넘치는 것까지는 허용한다
        const label = ctx.measureText(full).width <= room
          ? full
          : ctx.measureText(count).width <= room
            ? count
            : "";
        if (label) {
          ctx.fillText(label, rx + rw / 2,
            above ? ry - codeSize * 0.42 - nameSize - 5 : ry + rh + codeSize + nameSize + 4);
        }
      }

      /* ── 움직이는 것들 ── */
      const [a1x, a1z] = onLoop(agv1, el / 26);
      const [a2x, a2z] = onLoop(agv2, -el / 31);
      for (const [ax, az, carrying] of [[a1x, a1z, true], [a2x, a2z, false]]) {
        const px = X(ax), py = Y(az);
        ctx.fillStyle = "#F2F4F6";
        ctx.beginPath(); ctx.arc(px, py, 5, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = "#1E63C8"; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(px, py, 5, 0, Math.PI * 2); ctx.stroke();
        if (carrying) {
          ctx.fillStyle = "#FFB040";
          ctx.beginPath(); ctx.arc(px, py, 2, 0, Math.PI * 2); ctx.fill();
        }
      }

      // 지게차 — 하역 라인을 좌우로 왕복
      const fkBound = floorW / 2 - 4.2;
      const fx = Math.sin(el / 7) * fkBound * 0.85;
      ctx.save();
      ctx.translate(X(fx), Y(unloadZ));
      ctx.fillStyle = "#F0A81E";
      ctx.fillRect(-7, -4.5, 14, 9);
      ctx.strokeStyle = "#596470"; ctx.lineWidth = 1.6;
      const dir = Math.cos(el / 7) >= 0 ? 1 : -1;
      ctx.beginPath();
      ctx.moveTo(dir * 7, -2.5); ctx.lineTo(dir * 12, -2.5);
      ctx.moveTo(dir * 7, 2.5); ctx.lineTo(dir * 12, 2.5);
      ctx.stroke();
      ctx.restore();

      // 작업자 2명 — 통로를 오간다
      const pb = Math.min(...layout.rowWidths) / 2;
      for (const [i, phase, zz] of [[0, 0, -0.72], [1, 2.1, 0.72]]) {
        const wx = Math.sin(el / 11 + phase) * pb * 0.8;
        ctx.fillStyle = i === 0 ? "#FFD23E" : "#F2F5F8";
        ctx.beginPath(); ctx.arc(X(wx), Y(zz), 3.4, 0, Math.PI * 2); ctx.fill();
      }

      // ASRS 크레인 — A 구역 레일 위를 오르내린다
      const cz = zoneA.zStart + (0.5 + 0.5 * Math.sin(el / 9)) * zoneA.len;
      ctx.strokeStyle = "rgba(200,210,220,0.35)"; ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(X(zoneA.center), Y(zoneA.zStart));
      ctx.lineTo(X(zoneA.center), Y(zoneA.zStart + zoneA.len));
      ctx.stroke();
      ctx.fillStyle = "#F2F4F6";
      ctx.fillRect(X(zoneA.center) - 3.5, Y(cz) - 3.5, 7, 7);

      raf = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  const dateTxt = REAL_DATES[day].slice(5).replace("-", "/");

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-1">
      {/* 조작줄 — 창고 화면의 지도 툴바를 그대로 옮겼다 */}
      <div className="flex shrink-0 items-center gap-2 px-1">
        <button
          type="button"
          className="wm-btn"
          onClick={() => { if (day >= 60) setDay(0); setPlaying((p) => !p); }}
        >
          {playing ? "II 정지" : "► 재생"}
        </button>
        <span className="wm-txt whitespace-nowrap">{dateTxt} (D+{day})</span>
        <input
          type="range" min="0" max="60" value={day} aria-label="날짜"
          onChange={(e) => { setPlaying(false); setDay(+e.target.value); }}
          className="min-w-[60px] flex-1"
        />
        {/* ★ 사용률·입출고 수치 칸을 뺐다. 같은 값이 이 화면 위쪽 요약 카드에 이미 있고,
            좁은 조작줄에 수치를 끼워 넣으니 슬라이더가 눌려 날짜를 잡기 어려웠다.
            조작에 쓰는 것만 남기고 읽는 값은 위에 맡긴다. */}
      </div>

      {/* 지도 */}
      <div
        ref={wrapRef}
        className="wm-map relative min-h-0 flex-1 overflow-hidden"
        style={{
          background: "#10151C", border: "2px solid",
          borderColor: "#404040 #FFF #FFF #404040",
          cursor: onOpen3D ? "pointer" : "default",
        }}
        role={onOpen3D ? "button" : undefined}
        tabIndex={onOpen3D ? 0 : undefined}
        onClick={() => onOpen3D?.()}
        onKeyDown={(e) => { if (onOpen3D && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); onOpen3D(); } }}
      >
        <canvas ref={canvasRef} className="absolute inset-0" />
        {onOpen3D && (
          /* 안내 딱지 — 누를 수 있다는 걸 알리는 유일한 신호다. 지도는 그림이라
             CSS 의 커서 말고는 스스로 "누르라"고 말하지 못한다 */
          <span className="wm-hint">클릭 → 3D 전체 화면</span>
        )}
      </div>

      <style>{`
        .wm-btn { background:#C0C0C0; border:2px solid; border-color:#FFF #404040 #404040 #FFF;
          padding:2px 9px; font-size:12px; cursor:pointer; color:#000; white-space:nowrap; }
        .wm-btn:active { border-color:#404040 #FFF #FFF #404040; }
        .wm-txt { font-size:12px; color:#000; }
        .wm-cell { padding:2px 8px; font-size:11px; background:#0E141C; white-space:nowrap;
          border:1px solid #2C3644; font-family:'Consolas',monospace; }
        .wm-hint { position:absolute; right:8px; bottom:8px; padding:4px 9px; border-radius:3px;
          background:rgba(12,17,24,.82); border:1px solid rgba(150,180,215,.28); color:#BFD4E8;
          font-size:11px; font-weight:700; pointer-events:none; transition:opacity .15s; opacity:.7; }
        .wm-map:hover .wm-hint { opacity:1; border-color:#FF8A2A; color:#FFD9B0; }
        .wm-map:focus-visible { outline:2px solid #FF8A2A; outline-offset:-2px; }
      `}</style>
    </div>
  );
}
