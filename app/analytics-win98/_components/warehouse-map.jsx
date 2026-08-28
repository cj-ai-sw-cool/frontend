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

/* 배치·재고는 `warehouse-data.js` 한 곳에서 온다 — 규격별 재고 패널과 **같은 숫자**를
   써야 해서 꺼내 놓았다. 그 파일 머리말 참고. */
import {
  REAL_INV, INV_PEAK, MAP_FONT, CORRIDOR, computeLayout,
} from "./warehouse-data";
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

  /* 날짜는 **저절로 흐른다.** 조작줄을 뺐으므로(사용자 요청 — 여기서는 필요 없다) 멈추거나
     되감을 길이 없고, 그래서 재생/정지 상태도 들고 있지 않다.
     ⚠️ 끝(60일)에서 멈추지 않고 처음으로 돌아간다. 대시보드에 늘 떠 있는 칸이라, 한 번
        끝까지 가고 멈춰 버리면 그 뒤로는 죽은 그림이 된다. */
  useEffect(() => {
    const iv = setInterval(() => setDay((d) => (d >= 60 ? 0 : d + 1)), 420);
    return () => clearInterval(iv);
  }, []);

  /* 날짜는 상태지만 그리기 루프는 매 프레임 돈다. 루프 안에서 상태를 직접 읽으면 첫 값에
     붙박이므로 ref 로 넘긴다 */
  const dayRef = useRef(day);
  useEffect(() => { dayRef.current = day; }, [day]);

  useEffect(() => {
    const wrap = wrapRef.current, cvs = canvasRef.current;
    if (!wrap || !cvs) return;

    const layout = computeLayout();
    const floorW = Math.max(...layout.rowWidths) + 11;
    /* 반드시 들어가야 하는 세로 범위 — 랙 양 끝에 **구역 라벨이 설 자리**까지 포함한다.
       뒤쪽(2.3m)이 앞쪽(1.6m)보다 넉넉한 이유는 A·B·C 라벨이 랙 **위**에 붙기 때문이다. */
    const needZ0 = -CORRIDOR / 2 - layout.backLen - 2.6;
    /* ⚠️ 앞쪽도 2.6m 를 비운다. 1.6m 로 두었더니 앞줄(D·E·F)의 구역 이름 줄이 화면 아래로
       잘렸다 — 그 라벨은 랙 사각형 **아래**에 두 줄로 붙어서, 축척 25px/m 기준 50px 남짓이
       필요하다. 2.6m 는 그 두 줄에 여유 한 줄을 더한 값이다. */
    const needZ1 = CORRIDOR / 2 + layout.frontLen + 2.6;
    const needD = needZ1 - needZ0;

    let scale = 1, ox = 0, oy = 0, dpr = 1, zMin = needZ0, worldD = needD;
    /* ★ **패널 비율에 세계를 맞춘다** (사용자 요청 — 여백 없이 꽉 차게).
         고정된 세로 범위를 패널에 끼워 넣으면(`contain`) 비율이 안 맞는 쪽에 반드시 띠가
         남는다. 반대로 세로 범위를 패널 비율에 맞춰 **늘리면**, 남는 만큼이 지도 위아래의
         빈 바닥으로 채워져 띠가 사라진다. 잘라 내는 것이 아니라 **더 보여 주는** 쪽이라
         내용이 사라지지 않는다.
       ⚠️ 필요한 범위(`needD`)보다 작아질 수는 없다. 패널이 세로로 길면 그때는 가로에 띠가
          남는데, 그건 잘라 내지 않기 위한 대가다 — 라벨이 잘리는 것보다 낫다. */
    const fit = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.max(10, wrap.clientWidth), h = Math.max(10, wrap.clientHeight);
      cvs.width = w * dpr; cvs.height = h * dpr;
      cvs.style.width = w + "px"; cvs.style.height = h + "px";

      worldD = Math.max(needD, (floorW * h) / w);
      zMin = needZ0 - (worldD - needD) / 2;   // 늘어난 만큼 위아래로 나눠 붙인다
      scale = Math.min(w / floorW, h / worldD);
      ox = (w - floorW * scale) / 2;
      oy = (h - worldD * scale) / 2;
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(wrap);

    const X = (wx) => ox + (wx + floorW / 2) * scale;
    const Y = (wz) => oy + (wz - zMin) * scale;
    const rgba = (n, a) => `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
    /* 색을 어둡게 눌러 준다 — 밝은 바닥 위에서 옅은 구역 색(A~F 는 전부 청회색 계열)이
       묻히는 것을 막는다 */
    const dim = (n, k) =>
      (Math.round(((n >> 16) & 255) * k) << 16) |
      (Math.round(((n >> 8) & 255) * k) << 8) |
      Math.round((n & 255) * k);
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
      /* ══ Windows 98 스타일 ══════════════════════════════════════════
         ★ 반투명·그라데이션으로 그리던 지도를 **98 의 문법**으로 다시 그렸다 (사용자 요청).
           98 의 화면은 세 가지로 이루어진다: 회색 면(#C0C0C0), 그 면을 튀어나오거나 들어가
           보이게 하는 **네 변의 밝기 차이**, 그리고 검은 1px 선. 알파와 흐림이 없다.
         ★ 그래서 점유율도 **색 농도가 아니라 눈금**으로 말한다 — 98 의 진행 막대처럼 파란
           칸을 채운다. 옅은 색끼리의 농도 차이는 작은 화면에서 안 읽히는데, 칸의 개수는
           멀리서도 세어진다.
         ⚠️ 선은 반드시 **0.5 를 더한 자리**에 긋는다. 캔버스의 좌표는 픽셀의 경계라,
            정수에 1px 선을 그으면 두 픽셀에 반씩 걸쳐 흐려진다 — 98 의 또렷함이 사라진다. */
      const W98 = {
        /* ⚠️ 98 의 기본 회색(#C0C0C0)은 **누런 기가 있다**(R=G=B 지만 주변 색과 어울리며
           따뜻하게 보인다). 지도 바닥에 넓게 깔면 그 기운이 화면 전체를 덮으므로, 여기서는
           중성 회색 쪽으로 올려 쓴다 — 창틀·패널은 여전히 진짜 98 색이라 대비도 산다. */
        face: "#C6C6C6", light: "#FFFFFF", shadow: "#808080", dark: "#000000",
        navy: "#000080", teal: "#008080", ink: "#000000",
      };
      /* 글자 크기 (px).
         ★ 12/13 → **15/17** (사용자 요청 — 잘 안 보인다). 지도를 키우면서 그림은 커졌는데
           글자만 그대로여서 상대적으로 더 작아졌다.
         ⚠️ 키우면 **구역 라벨이 설 자리도 같이 넓혀야** 한다. 아래 `codeY`/`barY` 가 13px
            기준으로 잡힌 값이라, 글자만 키우면 앞줄(D·E·F) 이름이 구역 네모를 파고든다. */
      const FS_NOTE = 15, FS_ZONE = 17;
      const px = (v) => Math.round(v) + 0.5;
      /** 튀어나온 테두리 (`out`) / 들어간 테두리 */
      const bevel = (x, y, bw, bh, out = true) => {
        ctx.lineWidth = 1;
        ctx.strokeStyle = out ? W98.light : W98.shadow;
        ctx.beginPath();
        ctx.moveTo(px(x), px(y + bh)); ctx.lineTo(px(x), px(y)); ctx.lineTo(px(x + bw), px(y));
        ctx.stroke();
        ctx.strokeStyle = out ? W98.shadow : W98.light;
        ctx.beginPath();
        ctx.moveTo(px(x + bw), px(y)); ctx.lineTo(px(x + bw), px(y + bh)); ctx.lineTo(px(x), px(y + bh));
        ctx.stroke();
      };

      /* ── 바닥 ── */
      ctx.fillStyle = W98.face;
      ctx.fillRect(0, 0, w, h);
      const fx = X(-floorW / 2), fy = Y(zMin);
      const fw = floorW * scale, fh = worldD * scale;
      ctx.fillStyle = "#DCDCDC";      // 바닥 — 누런 #D4D0C8 대신 중성 회색 (위 주의 참고)
      ctx.fillRect(fx, fy, fw, fh);
      bevel(fx, fy, fw, fh, false);   // 화면 안쪽으로 들어간 판

      /* ── 작업 통로 ──
         구역 사각형이 끝나는 지점부터 맞은편이 시작하는 지점까지만 칠한다 */
      const ZONE_PAD = 0.4;
      const laneA = -CORRIDOR / 2 + ZONE_PAD, laneB = CORRIDOR / 2 - ZONE_PAD;
      const ly = Y(laneA), lh = (laneB - laneA) * scale;
      ctx.fillStyle = "#BECCBE";      // 물 빠진 초록 — 바닥 밝기에 맞춰 함께 움직인다
      ctx.fillRect(fx, ly, fw, lh);
      ctx.strokeStyle = "#8A7A20"; ctx.lineWidth = 1;
      for (const yy of [ly, ly + lh]) {
        ctx.beginPath(); ctx.moveTo(fx, px(yy)); ctx.lineTo(fx + fw, px(yy)); ctx.stroke();
      }
      ctx.strokeStyle = W98.ink; ctx.setLineDash([5, 4]);
      ctx.beginPath(); ctx.moveTo(fx, px(Y(0))); ctx.lineTo(fx + fw, px(Y(0))); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = W98.ink;
      ctx.font = `700 ${FS_NOTE}px ${MAP_FONT}`; ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
      ctx.fillText("작업 통로", fx + 6, Y(0) - 4);

      /* ── 하역 라인 ── */
      ctx.strokeStyle = "#7A3A00"; ctx.setLineDash([7, 5]); ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(X(-floorW / 2 + 1.5), px(Y(unloadZ + 0.2)));
      ctx.lineTo(X(floorW / 2 - 1.5), px(Y(unloadZ + 0.2)));
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = "#5A4030";
      ctx.fillText("UNLOADING 하역 라인", fx + 6, Y(unloadZ + 0.2) - 4);

      /* ── 구역 ──
         뒷줄(A·B·C)은 라벨을 사각형 **위**에, 앞줄(D·E·F)은 아래에 붙인다. 둘 다 아래에
         붙이면 뒷줄 라벨이 작업 통로 한가운데에 떠서 통로 표시와 서로를 가린다 */
      ctx.textAlign = "center";
      for (const z of layout.zones) {
        const col = z.g.color;
        const occ = Math.min(0.99, Math.max(0.015,
          (REAL_INV[z.g.invKey][d] / INV_PEAK[z.g.invKey]) * 0.95));
        const rx = X(z.x0 - 0.35), ry = Y(z.zStart - ZONE_PAD);
        const rw = (z.width + 0.7) * scale, rh = (z.len + ZONE_PAD * 2) * scale;

        /* 구역 = 튀어나온 회색 판. 구역 색은 **판 자체가 아니라 위쪽 띠**로만 쓴다 —
           여섯 판을 전부 다른 색으로 칠하면 98 이 아니라 색종이가 된다 */
        /* 구역 판은 바닥보다 **조금 어둡게** 둔다. 같은 밝기면 튀어나온 테두리만으로는
           판이 떠 있는 것이 안 읽힌다 */
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

        /* ── 라벨 + 점유 눈금 ──
           ⚠️ 좁을 때는 이름을 버리고 숫자만 남긴다. 이름보다 채움 수가 정보다. */
        const above = z.row === 0;
        const total = z.racks.length * z.g.levels * z.g.cols;
        const filled = Math.round(occ * total);
        /* ── 라벨과 눈금이 설 자리 ──
           ⚠️ 기준선(baseline)은 글자의 **아랫변이 아니다.** 17px 글자는 기준선 아래로
              5px 남짓 더 내려간다(디센더). 기준선과 눈금 사이를 5px 로 두었더니 글자
              아랫부분이 눈금에 덮여 **잘려 보였다** (사용자 지적). 디센더 + 여유로
              9px 를 준다.
           ⚠️ 앞줄은 글자가 네모 **아래**에 붙으므로 윗변(기준선 - 어센더 약 14px)이
              네모를 파고들지 않아야 한다 — 기준선을 17 아래에 둬서 3px 를 띄운다.
           라벨 자리로 위아래 2.6m(≈78px)를 비워 두었다. 뒷줄 44px / 앞줄 36px 이니
           둘 다 그 안에 들어간다. */
        const codeY = above ? ry - 27 : ry + rh + 17;
        const barY = above ? ry - 18 : ry + rh + 27;

        ctx.fillStyle = W98.ink;
        ctx.font = `700 ${FS_ZONE}px ${MAP_FONT}`;
        const head = `${z.g.code} · ${z.g.name}`;
        const num = `${filled}/${total}`;
        /* 이름을 버릴지 정하는 기준 폭.
           ★ `rw + 8` 이었다. 글자를 키우고 나니 C·D·E·F 가 전부 이름을 잃고 숫자만
             남았다 — 그래서 화면이 "내용이 잘린" 것처럼 보였다.
           ⚠️ 라벨은 구역 네모 밖으로 조금 나와도 된다. 구역 사이가 2.3m(≈69px) 벌어져
              있으므로, 양쪽으로 28px 씩 빌려도 옆 구역 라벨과 부딪히지 않는다. */
        const room = rw + 56;
        ctx.fillText(
          ctx.measureText(`${head}  ${num}`).width <= room ? `${head}  ${num}` : num,
          rx + rw / 2, codeY,
        );

        /* 점유 눈금 — 98 진행 막대. 칸이 몇 개 찼는지로 점유율을 읽는다 */
        const pw = Math.min(rw, 86), phh = 9;
        const pxx = rx + (rw - pw) / 2;
        ctx.fillStyle = "#CFCFCF";
        ctx.fillRect(pxx, barY, pw, phh);
        bevel(pxx, barY, pw, phh, false);
        const cells = 10;
        const cw = (pw - 4) / cells;
        ctx.fillStyle = occ > 0.85 ? "#A00000" : W98.navy;
        for (let i = 0; i < Math.round(occ * cells); i += 1) {
          ctx.fillRect(pxx + 2 + i * cw, barY + 2, cw - 1.5, phh - 4);
        }
      }

      /* ── 움직이는 것들 ── */
      /* ⚠️ 움직이는 것들도 98 의 문법으로 그린다 — 원과 그림자 대신 **채운 사각형 + 검은
         1px 테두리**다. 이 크기(5~9px)에서 원은 안티에일리어싱으로 흐려지는데, 사각형은
         또렷하게 남는다. 98 의 아이콘이 전부 네모난 데는 이유가 있다. */
      /* 움직이는 것들의 크기 (px).
         ★ 한 번에 **1.4배쯤 키웠다** (사용자 요청). 지도를 키우고 나니 이것들만 예전
           크기로 남아 상대적으로 더 작아 보였다.
         ⚠️ 넷을 **같은 비율로** 키운다. 하나만 키우면 그것이 더 중요한 것처럼 읽힌다.
         ⚠️ 홀수로 잡는다. 1px 테두리를 두르는 네모라, 짝수면 가운데가 픽셀 경계에
            걸려 좌우 굵기가 달라 보인다. */
      const SZ = { agv: 13, worker: 11, crane: 13 };
      const chip = (cx2, cy2, size, fill) => {
        ctx.fillStyle = fill;
        ctx.fillRect(Math.round(cx2 - size / 2), Math.round(cy2 - size / 2), size, size);
        ctx.strokeStyle = "#000000"; ctx.lineWidth = 1;
        ctx.strokeRect(Math.round(cx2 - size / 2) + 0.5, Math.round(cy2 - size / 2) + 0.5, size - 1, size - 1);
      };

      const [a1x, a1z] = onLoop(agv1, el / 26);
      const [a2x, a2z] = onLoop(agv2, -el / 31);
      for (const [ax, az, carrying] of [[a1x, a1z, true], [a2x, a2z, false]]) {
        chip(X(ax), Y(az), SZ.agv, carrying ? "#000080" : "#FFFFFF");
      }

      // 지게차 — 하역 라인을 좌우로 왕복
      const fkBound = floorW / 2 - 4.2;
      const fkx = Math.sin(el / 7) * fkBound * 0.85;
      ctx.save();
      ctx.translate(Math.round(X(fkx)), Math.round(Y(unloadZ)));
      ctx.fillStyle = "#C8A000";
      /* 몸체 16x10 → 23x14 (위 `SZ` 와 같은 비율). 포크 길이도 같이 늘린다 —
         몸만 키우면 포크가 몸에 파묻혀 지게차로 안 읽힌다 */
      ctx.fillRect(-11.5, -7, 23, 14);
      ctx.strokeStyle = "#000000"; ctx.lineWidth = 1;
      ctx.strokeRect(-11, -6.5, 22, 13);
      const dir = Math.cos(el / 7) >= 0 ? 1 : -1;
      ctx.beginPath();
      ctx.moveTo(dir * 11.5, -3.5); ctx.lineTo(dir * 19, -3.5);
      ctx.moveTo(dir * 11.5, 3.5); ctx.lineTo(dir * 19, 3.5);
      ctx.stroke();
      ctx.restore();

      // 작업자 2명 — 통로를 오간다
      const pb = Math.min(...layout.rowWidths) / 2;
      for (const [i, phase, zz] of [[0, 0, -0.72], [1, 2.1, 0.72]]) {
        const wx = Math.sin(el / 11 + phase) * pb * 0.8;
        chip(X(wx), Y(zz), SZ.worker, i === 0 ? "#C8A000" : "#FFFFFF");
      }

      // ASRS 크레인 — A 구역 레일 위를 오르내린다
      const cz = zoneA.zStart + (0.5 + 0.5 * Math.sin(el / 9)) * zoneA.len;
      ctx.strokeStyle = "#808080"; ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(X(zoneA.center), Y(zoneA.zStart));
      ctx.lineTo(X(zoneA.center), Y(zoneA.zStart + zoneA.len));
      ctx.stroke();
      chip(X(zoneA.center), Y(cz), SZ.crane, "#FFFFFF");

      raf = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);


  return (
    <div className="flex min-h-0 flex-1 flex-col">
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
        {/* ⚠️ "클릭 → 3D 전체 화면" 딱지를 뺐다 (사용자 결정 — 설명이 필요 없다).
            누를 수 있다는 것은 이제 **커서 모양**만으로 알린다. 지도 위에 얹힌 글자가
            하나 줄어드는 만큼 화면이 조용해진다. */}
      </div>

      <style>{`
        .wm-btn { background:#C0C0C0; border:2px solid; border-color:#FFF #404040 #404040 #FFF;
          padding:2px 9px; font-size:12px; cursor:pointer; color:#000; white-space:nowrap; }
        .wm-btn:active { border-color:#404040 #FFF #FFF #404040; }
        .wm-txt { font-size:12px; color:#000; }
        .wm-cell { padding:2px 8px; font-size:11px; background:#0E141C; white-space:nowrap;
          border:1px solid #2C3644; font-family:'Consolas',monospace; }
        .wm-map:focus-visible { outline:2px solid #FF8A2A; outline-offset:-2px; }
      `}</style>
    </div>
  );
}
