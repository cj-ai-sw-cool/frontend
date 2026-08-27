import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { useRouter } from "next/navigation";
import { createNetherPortal } from "./nether-portal";

/* ═══════════════════════════════════════════════════════════════════════════
   씬 2 — 신규 물품 입고 검수실
   창고(씬 1)의 네더 포탈을 클릭하면 열린다.

   무엇을 보여 주는 방인가
     신규 물품이 처음 들어오면 규격을 모른다. 그래서 3면 비전 측정대에 한 번 올려
     길이·가로·높이·무게를 재고, 그 값으로 어느 크기 구역(A~F)에 넣을지 정한다.
     이 방은 그 한 동작을 보여 준다 — 측정대, 3대의 카메라, 결과가 뜨는 모니터.

   ★ 씬 1 과 완전히 분리된 three.js 씬이다. 렌더러·카메라·루프를 따로 갖는다.
     같은 씬에 방을 덧붙이지 않은 이유 — 창고 씬은 시뮬레이션이 계속 돌아야 2D 지도가
     살아 있다. 방을 그 안에 넣으면 방에 있는 동안에도 창고 물체 수천 개를 계속 그리게
     된다. 방은 방대로, 창고는 창고대로 두는 편이 싸고 안전하다.

   ★ **색과 조명은 창고에서 그대로 가져온다.** 아래 `W` 팔레트가 그 사본이다. 두 화면이
     한 건물이어야 하는데 톤이 다르면, 포탈을 지난 순간 "다른 게임으로 넘어온" 느낌이
     난다. 바닥 무늬(회색 콘크리트 + 2m 격자 + 노란 통로선), 벽(어두운 판 + 걸레받이),
     랙 기둥의 파랑까지 같은 값을 쓴다.

   ⚠️ 부모가 높이를 갖고 있어야 한다. 렌더러가 부모 크기를 재서 캔버스를 맞춘다.
   ⚠️ 폭이 4px 이하일 때는 크기를 바꾸지 않는다(창고 쪽과 같은 가드). 숨겨진 판에서
      폭 0 으로 리사이즈하면 렌더러 내부 상태가 깨진다.
   ═══════════════════════════════════════════════════════════════════════════ */

/* ── 창고에서 가져온 팔레트 ───────────────────────────────────────────────
   ⚠️ 창고 쪽 값을 바꾸면 여기도 같이 바꿔야 한다. 두 파일이 서로를 import 하지 않는 건
      의도적이다 — 창고 파일은 팀원이 준 원본이라 손을 최소한만 댄다. */
const W = {
  bg: 0x161e28,        // 배경·안개
  floorBase: "#23282e",
  wallHi: 0x1a2028,    // 벽 상단
  wallLo: 0x232b35,    // 걸레받이
  rackBlue: 0x2f66a8,  // 랙 기둥
  steel: 0x596470,
  carton: 0xc59a63,
  pallet: 0x8a6a42,
  lane: "rgba(250,205,60,0.75)",
};

/* ── 측정 대상 물품 (실측 예시값) ─────────────────────────────────────────
   ★ 화면·모형·라벨이 같은 한 벌의 숫자를 본다. 모니터에 352 라고 떠 있는데 모형 상자는
     아무 크기나 되어 있으면, 보는 사람이 둘을 못 잇는다. mm → m 로만 바꿔 쓴다. */
const ITEM = {
  name: "햇반 210g × 6입",
  maker: "CJ제일제당",
  /* 흰 용기(지름 128mm) 3개 x 2줄 한 층 + 인쇄 슬리브 기준 실측 */
  lengthMm: 412, // x — 용기 3개 나란히 + 포장 여유
  heightMm: 58,  // y — 트레이 6 + 용기 43 + 필름·여유
  widthMm: 275,  // z — 용기 2줄 + 포장 여유
  realKg: 1.5,
  volKg: 1.4,    // 체적 / 5000 (택배 부피중량 관행)
  volCm3: 6571,
  sku: "CJ-8801007-0426",
  /* 세 변 합 41.2 + 27.5 + 5.8 = 74.5cm → 상한 80cm 인 A(극소형) 구역.
     ⚠️ 창고 쪽 등급 규칙(`GRADES` 의 "세 변 합 = 등급 상한")을 그대로 따른 값이다.
        길이 41cm 가 A 슬롯 한 변(30cm)보다 길다는 모순이 있지만, 그건 이 화면이 아니라
        등급 규칙 자체의 단순화다. 여기서 임의로 B 로 올리면 두 화면이 서로 다른 말을 한다. */
  grade: "A",
  gradeName: "극소형 구역",
};
const MM = 0.001;

/* 모형을 그리는 배율.
   ★ 실제 크기(412 x 275 x 58 mm)로 두면 1.2m 짜리 계량판 위에서 납작하고 작아, 무엇이
     올라가 있는지 알아보기 어려웠다. 1.45배로 그린다.
   ⚠️ **모니터에 뜨는 치수는 실제 값 그대로다.** 여기서 배율을 쓰는 것은 3D 모형뿐이고,
      화면·라벨의 숫자는 `ITEM` 을 그대로 읽는다. 창고 쪽에서 슬롯 개수만 축소 모형인 것과
      같은 성격의 타협이다 — 보여 주려고 키운 것이지 값이 달라진 게 아니다. */
const PROP_SCALE = 1.45;

const ROOM_W = 12;
const ROOM_D = 9.5;
const ROOM_H = 4.4;

/* ── 작은 도구들 ──────────────────────────────────────────────────────── */

/** 모서리가 둥근 사각형 윤곽. 아래 `roundedBox` 가 이걸 밀어내서 상자를 만든다 */
function roundedRect(w, h, r) {
  const s = new THREE.Shape();
  const x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

/**
 * 모서리가 둥근 상자. 바닥이 y=0 에 오도록 맞춰서 돌려준다.
 * ⚠️ `ExtrudeGeometry` 는 +z 방향으로 밀어낸다. 세워 놓으려면 x축으로 눕혀야 하고,
 *    그러고 나면 원점이 엉뚱한 곳에 남는다. 그래서 경계상자를 재서 바닥을 0 에 맞춘다 —
 *    "대충 이만큼 내리면 되겠지"로 두면 베벨 두께만큼 바닥에 파묻히거나 뜬다.
 */
function roundedBox(w, h, d, r = 0.06, bevel = 0.025) {
  const geo = new THREE.ExtrudeGeometry(roundedRect(w, d, r), {
    depth: Math.max(0.001, h - bevel * 2),
    bevelEnabled: true,
    bevelSize: bevel,
    bevelThickness: bevel,
    bevelSegments: 3,
    curveSegments: 6,
  });
  geo.rotateX(-Math.PI / 2);
  geo.computeBoundingBox();
  geo.translate(0, -geo.boundingBox.min.y, 0);
  return geo;
}

/** 글자를 그린 스프라이트. 항상 카메라를 보므로 어느 각도에서도 읽힌다 */
function makeLabel(text, { color = "#CFE9FF", size = 44, weight = 700, scale = 1 } = {}) {
  const pad = 10;
  const cv = document.createElement("canvas");
  const probe = cv.getContext("2d");
  const font = `${weight} ${size}px 'Malgun Gothic', '맑은 고딕', sans-serif`;
  probe.font = font;
  const w = Math.ceil(probe.measureText(text).width) + pad * 2;
  const h = size + pad * 2;
  cv.width = w; cv.height = h;

  const c = cv.getContext("2d");
  c.font = font;
  c.textAlign = "center";
  c.textBaseline = "middle";
  /* 글자 뒤에 어두운 테두리를 깔아 준다. 밝은 상자 위에서도 읽히게 하는 가장 싼 방법 */
  c.lineWidth = 6;
  c.strokeStyle = "rgba(10,14,20,0.85)";
  c.strokeText(text, w / 2, h / 2 + 1);
  c.fillStyle = color;
  c.fillText(text, w / 2, h / 2 + 1);

  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({
    map: tex, transparent: true, depthWrite: false, depthTest: false,
  }));
  /* 스프라이트 크기는 월드 단위다. 캔버스 픽셀을 그대로 쓰면 방보다 커진다.
     0.0022 는 "글자 높이 44px ≈ 10cm" 가 되도록 맞춘 값. */
  sp.scale.set(w * 0.0022 * scale, h * 0.0022 * scale, 1);
  sp.renderOrder = 10;
  return sp;
}

/** 캔버스에 그린 반복 무늬 텍스처 */
function patternTexture(size, draw, repeatX = 1, repeatY = 1) {
  const cv = document.createElement("canvas");
  cv.width = cv.height = size;
  draw(cv.getContext("2d"), size);
  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/* ── 바닥 ─────────────────────────────────────────────────────────────────
   ★ 창고와 같은 어두운 콘크리트(#23282e)를 쓰다가 **밝은 회색 에폭시 타일**로 바꿨다.
     창고는 넓어서 어두운 바닥이 깊이를 만들지만, 이 방은 좁아 사방이 벽이라 바닥까지
     어두우면 그냥 안 보인다. 바닥이 밝으면 천장 등이 닿지 않는 구석도 형태가 읽힌다.
   ★ 격자는 두 겹이다: 1m 타일 줄눈(가늘게)과 2m 기준선(굵게). 한 겹만 두면 밋밋하거나
     지나치게 촘촘하다. 2m 간격은 창고 바닥과 같은 축척이라 두 화면의 크기감이 이어진다.
   ⚠️ 바닥이 밝아졌으니 그 위에 얹는 것들의 색도 함께 뒤집어야 한다. 줄눈·글자는 흰색이
      아니라 **어두운 색**이어야 보이고, 구역 바탕은 어두운 초록이 아니라 옅은 초록이어야
      얼룩처럼 안 보인다. 바닥색만 바꾸고 나머지를 두면 전부 사라진다. */
function buildFloor(scene, dispose) {
  const PX = 1400;
  const cv = document.createElement("canvas");
  cv.width = PX;
  cv.height = Math.round((ROOM_D / ROOM_W) * PX);
  const c = cv.getContext("2d");
  const H = cv.height;

  const u = (x) => ((x + ROOM_W / 2) / ROOM_W) * PX;
  const v = (z) => ((z + ROOM_D / 2) / ROOM_D) * H;
  const PPM = PX / ROOM_W;            // 1m 이 몇 픽셀인가

  c.fillStyle = "#9AA0A8";
  c.fillRect(0, 0, PX, H);

  /* 1m 타일 — 타일마다 아주 조금씩 밝기를 달리한다. 완전히 같으면 타일이 아니라
     격자를 인쇄한 한 장으로 보인다 */
  for (let tx = -ROOM_W / 2; tx < ROOM_W / 2; tx += 1) {
    for (let tz = -ROOM_D / 2; tz < ROOM_D / 2; tz += 1) {
      const n = (Math.sin(tx * 12.9898 + tz * 78.233) * 43758.5453) % 1;
      const g = 154 + Math.round(Math.abs(n) * 12) - 4;
      c.fillStyle = `rgb(${g},${g + 5},${g + 12})`;
      c.fillRect(u(tx), v(tz), PPM, PPM);
    }
  }

  // 에폭시 반점 — 밝은 알갱이와 어두운 알갱이를 섞는다
  for (let i = 0; i < 5200; i++) {
    const dark = i % 2 === 0;
    c.fillStyle = dark
      ? `rgba(70,76,86,${0.05 + Math.random() * 0.12})`
      : `rgba(255,255,255,${0.05 + Math.random() * 0.14})`;
    c.fillRect(Math.random() * PX, Math.random() * H, 1 + Math.random() * 2.4, 1 + Math.random() * 2.4);
  }

  // 1m 줄눈 (가늘고 연하게)
  c.strokeStyle = "rgba(96,104,116,0.45)";
  c.lineWidth = 1.5;
  for (let x = -ROOM_W / 2; x <= ROOM_W / 2; x += 1) {
    c.beginPath(); c.moveTo(u(x), 0); c.lineTo(u(x), H); c.stroke();
  }
  for (let z = -ROOM_D / 2; z <= ROOM_D / 2; z += 1) {
    c.beginPath(); c.moveTo(0, v(z)); c.lineTo(PX, v(z)); c.stroke();
  }
  // 2m 기준선 (굵고 진하게) — 창고 바닥과 같은 간격
  c.strokeStyle = "rgba(72,80,92,0.55)";
  c.lineWidth = 3;
  for (let x = -ROOM_W / 2; x <= ROOM_W / 2; x += 2) {
    c.beginPath(); c.moveTo(u(x), 0); c.lineTo(u(x), H); c.stroke();
  }
  for (let z = -ROOM_D / 2; z <= ROOM_D / 2; z += 2) {
    c.beginPath(); c.moveTo(0, v(z)); c.lineTo(PX, v(z)); c.stroke();
  }

  /* 검수 구역 — 측정대를 둘러싼 사각형 */
  const zx0 = u(-2.3), zx1 = u(2.3), zz0 = v(-2.0), zz1 = v(2.0);
  c.fillStyle = "rgba(150,190,170,0.30)";
  c.fillRect(zx0, zz0, zx1 - zx0, zz1 - zz0);
  c.strokeStyle = "rgba(228,176,20,0.95)";
  c.lineWidth = 8;
  c.strokeRect(zx0, zz0, zx1 - zx0, zz1 - zz0);

  c.fillStyle = "rgba(48,56,68,0.62)";
  c.font = "800 30px 'Malgun Gothic', sans-serif";
  c.fillText("검수 구역 · INSPECTION", u(-2.16), v(-1.72));

  // 반입 방향 화살표 (컨베이어 → 측정대)
  c.font = "900 34px 'Consolas', monospace";
  c.fillStyle = "rgba(48,56,68,0.4)";
  for (let x = -4.4; x <= -2.7; x += 0.85) c.fillText("▶", u(x), v(0.12));

  // 셔터 앞 빗금 주의 구역
  c.save();
  c.beginPath();
  c.rect(u(-1.8), v(-ROOM_D / 2), u(1.8) - u(-1.8), v(-ROOM_D / 2 + 1.1) - v(-ROOM_D / 2));
  c.clip();
  c.strokeStyle = "rgba(226,176,26,0.75)";
  c.lineWidth = 14;
  for (let i = -14; i < 26; i++) {
    c.beginPath();
    c.moveTo(u(-1.8) + i * 28, v(-ROOM_D / 2));
    c.lineTo(u(-1.8) + i * 28 + 62, v(-ROOM_D / 2 + 1.1));
    c.stroke();
  }
  c.restore();

  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  /* ⚠️ 바닥이 밝아지면 이음매의 계단현상(모아레)이 눈에 띈다. 비등방 필터링을 켜서
     비스듬히 보이는 먼 바닥의 줄눈이 지글거리지 않게 한다. */
  tex.anisotropy = 8;
  const mat = new THREE.MeshLambertMaterial({ map: tex });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_W, ROOM_D), mat);
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);
  dispose.push(floor.geometry, mat, tex);
}

/* ── 벽 ───────────────────────────────────────────────────────────────────
   창고와 같은 구성: 어두운 판(상단) + 조금 밝은 걸레받이(하단) + 파란 기둥.
   창고 벽은 카메라 방향에 따라 페이드하지만, 이 방은 좁아서 그럴 필요가 없다 —
   대신 앞쪽(+z) 벽을 아예 만들지 않아 카메라가 항상 방 안을 들여다본다. */
function buildWalls(scene, dispose) {
  /* ★ 벽은 창고 값(0x1a2028 / 0x232b35)보다 한 단계 밝게 쓴다.
     바닥만 밝히고 벽을 그대로 두면 밝은 판 위에 검은 상자를 덮어씌운 꼴이 되어,
     오히려 방이 더 답답해 보인다. 바닥·벽·천장은 같이 올려야 한다.
     ⚠️ 그렇다고 창고와 같은 값을 쓸 수는 없다. 창고는 천장이 높고 벽이 멀어 같은 색도
        더 어둡게 보인다. 여기서만 올리고 `W` 팔레트 원본은 건드리지 않는다. */
  const hi = new THREE.MeshLambertMaterial({ color: 0x2e3742 });
  const lo = new THREE.MeshLambertMaterial({ color: 0x3c4655 });
  const add = (geo, mat, x, y, z) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    scene.add(m);
    dispose.push(geo);
    return m;
  };

  add(new THREE.BoxGeometry(ROOM_W, ROOM_H, 0.3), hi, 0, ROOM_H / 2, -ROOM_D / 2);
  add(new THREE.BoxGeometry(ROOM_W, 1.1, 0.34), lo, 0, 0.55, -ROOM_D / 2);
  add(new THREE.BoxGeometry(0.3, ROOM_H, ROOM_D), hi, -ROOM_W / 2, ROOM_H / 2, 0);
  add(new THREE.BoxGeometry(0.34, 1.1, ROOM_D), lo, -ROOM_W / 2, 0.55, 0);
  add(new THREE.BoxGeometry(0.3, ROOM_H, ROOM_D), hi, ROOM_W / 2, ROOM_H / 2, 0);
  add(new THREE.BoxGeometry(0.34, 1.1, ROOM_D), lo, ROOM_W / 2, 0.55, 0);
  dispose.push(hi, lo);

  // 파란 기둥 — 창고 랙과 같은 색. 두 화면을 잇는 가장 눈에 띄는 신호다
  const postMat = new THREE.MeshLambertMaterial({ color: W.rackBlue });
  const postGeo = new THREE.BoxGeometry(0.16, ROOM_H, 0.16);
  for (const x of [-4.2, 4.2]) {
    const p = new THREE.Mesh(postGeo, postMat);
    p.position.set(x, ROOM_H / 2, -ROOM_D / 2 + 0.24);
    scene.add(p);
  }
  dispose.push(postGeo, postMat);

  /* 천장 트러스 — 창고의 골조를 축소해 옮겼다. 없으면 방이 아니라 '무대'처럼 보인다.
     ★ 천장 판은 **없앴다.** 카메라를 높이 올리면 판이 시야를 막아 방 안이 안 보였다.
       골조만 남기면 위에서 내려다볼 수 있으면서도 "덮인 공간"이라는 인상은 남는다 —
       실제 물류창고도 천장이 마감돼 있기보다 철골이 드러나 있다.
     ⚠️ 조명 기구의 봉이 이 트러스에 닿아야 한다. 천장이 없어진 뒤로는 봉이 허공에서
        끝나면 등이 떠 보인다. 그래서 `buildLights` 의 등 자리를 트러스의 z 값에 맞춘다 —
        아래 배열을 바꾸면 그쪽도 같이 바꿀 것. */
  const trussMat = new THREE.MeshLambertMaterial({ color: 0x39424e });
  const trussGeo = new THREE.BoxGeometry(ROOM_W, 0.14, 0.14);
  for (const z of [-3.0, -0.6, 1.8]) {
    const t = new THREE.Mesh(trussGeo, trussMat);
    t.position.set(0, ROOM_H - 0.22, z);
    scene.add(t);
  }
  dispose.push(trussGeo, trussMat);

  /* 셔터 — 뒷벽 가운데, 물품이 들어오는 문 */
  const shutter = patternTexture(64, (c, S) => {
    for (let y = 0; y < S; y += 8) {
      const g = y % 16 === 0 ? 92 : 70;
      c.fillStyle = `rgb(${g},${g + 4},${g + 10})`;
      c.fillRect(0, y, S, 8);
      c.fillStyle = "rgba(20,23,27,0.6)";
      c.fillRect(0, y + 7, S, 1);
    }
  }, 1, 12);
  const shMat = new THREE.MeshLambertMaterial({ map: shutter });
  const sh = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 2.9), shMat);
  sh.position.set(0, 1.45, -ROOM_D / 2 + 0.17);
  scene.add(sh);
  dispose.push(sh.geometry, shMat, shutter);

  const frameMat = new THREE.MeshLambertMaterial({ color: 0x4a525b });
  for (const [w, h, x, y] of [[3.66, 0.16, 0, 2.98], [0.13, 3.0, -1.77, 1.5], [0.13, 3.0, 1.77, 1.5]]) {
    const f = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.14), frameMat);
    f.position.set(x, y, -ROOM_D / 2 + 0.22);
    scene.add(f);
    dispose.push(f.geometry);
  }
  dispose.push(frameMat);
}

/* ── 카메라 한 대 ─────────────────────────────────────────────────────────
   렌즈가 그룹의 **+z** 를 향하도록 짓는다.
   ⚠️ 이게 중요하다. 일반 Object3D 의 `lookAt` 은 +z 축을 대상 쪽으로 돌린다(카메라·조명
      객체만 -z 를 쓴다). 렌즈를 -z 에 달아 놓고 `lookAt` 을 부르면 카메라가 정확히
      반대편을 찍는다. */
function makeVisionCamera(dispose, { label }) {
  const g = new THREE.Group();

  const shell = new THREE.MeshLambertMaterial({ color: 0x2b323b });
  const dark = new THREE.MeshLambertMaterial({ color: 0x14181d });
  const alu = new THREE.MeshLambertMaterial({ color: 0x8b96a4 });

  const bodyGeo = roundedBox(0.15, 0.115, 0.19, 0.03, 0.014);
  const body = new THREE.Mesh(bodyGeo, shell);
  body.position.y = -0.0575;   // roundedBox 는 바닥이 0 이므로 가운데로 옮긴다
  g.add(body);

  // 방열 핀 — 산업용 비전 카메라의 인상을 만드는 디테일
  const finGeo = new THREE.BoxGeometry(0.155, 0.008, 0.028);
  for (let i = 0; i < 3; i++) {
    const f = new THREE.Mesh(finGeo, alu);
    f.position.set(0, 0.035, -0.05 + i * 0.042);
    g.add(f);
  }

  // 렌즈 경통 + 유리
  const barrelGeo = new THREE.CylinderGeometry(0.043, 0.05, 0.09, 20);
  const barrel = new THREE.Mesh(barrelGeo, dark);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.z = 0.13;
  g.add(barrel);

  const ringGeo = new THREE.TorusGeometry(0.046, 0.008, 8, 22);
  const ring = new THREE.Mesh(ringGeo, alu);
  ring.position.z = 0.172;
  g.add(ring);

  const glassGeo = new THREE.CircleGeometry(0.04, 22);
  const glass = new THREE.Mesh(glassGeo, new THREE.MeshBasicMaterial({ color: 0x14314f }));
  glass.position.z = 0.176;
  g.add(glass);

  // 상태 LED — 아래 루프가 세 대를 차례로 켠다
  const ledMat = new THREE.MeshBasicMaterial({ color: 0x1f4a34 });
  const ledGeo = new THREE.SphereGeometry(0.013, 10, 8);
  const led = new THREE.Mesh(ledGeo, ledMat);
  led.position.set(0.055, 0.012, 0.055);
  g.add(led);

  // 케이블 — 뒤로 늘어지는 짧은 관. 있으면 '설치된 장비'로 읽힌다
  const cableGeo = new THREE.CylinderGeometry(0.011, 0.011, 0.16, 8);
  const cable = new THREE.Mesh(cableGeo, dark);
  cable.rotation.x = Math.PI / 2.4;
  cable.position.set(0, -0.03, -0.13);
  g.add(cable);

  const tag = makeLabel(label, { color: "#9FC4E8", size: 32, scale: 0.5 });
  tag.position.set(0, 0.13, 0);
  g.add(tag);
  dispose.push(tag.material.map, tag.material);

  dispose.push(bodyGeo, finGeo, barrelGeo, ringGeo, glassGeo, ledGeo, cableGeo,
    shell, dark, alu, glass.material, ledMat);

  return { group: g, led };
}

/* ── 측정 대상: 햇반 210g × 6입 ────────────────────────────────────────────
   ★ 무지 골판지 상자를 실제 상품으로 바꿨다. 갈색 네모는 "무언가"일 뿐이라, 화면의 치수와
     등급이 무엇에 대한 값인지 안 붙는다. 알아보는 물건이 올라가 있으면 "이걸 재서 A구역에
     넣는구나"가 한눈에 읽힌다.
   ★ 구성은 실제 제품 그대로 — 흰 용기 6개(3 × 2)가 한 층으로 놓이고, 인쇄 슬리브가
     **용기 옆면만** 감싼다. 뚜껑은 위로 드러나고 거기에 다시 인쇄가 되어 있다.
   ★ **뚜껑 인쇄가 이 모형의 핵심이다.** 측정기 카메라가 위에서 내려다보는 구도라, 화면에
     가장 크게 잡히는 면이 뚜껑이다. 옆면 슬리브를 아무리 잘 그려도 위에서는 안 보인다.
   ⚠️ 슬리브는 상자 하나가 아니라 **판 네 장**이다. 상자로 만들면 위가 막혀 용기가 안 보이고,
      투명 재질로 뚫으면 안쪽 면까지 비쳐 지저분해진다. 옆면만 세우는 편이 싸고 깨끗하다. */

/** 뚜껑 필름 인쇄. 원판(`CircleGeometry`)에 붙으므로 정사각 캔버스에 원을 내접시켜 그린다 */
function hetbanLidTexture() {
  const S = 320, R = S / 2;
  const cv = document.createElement("canvas");
  cv.width = cv.height = S;
  const c = cv.getContext("2d");

  /* ⚠️ 원 밖은 투명하게 남긴다. `CircleGeometry` 의 uv 는 원을 정사각형에 내접시키므로,
     모서리를 칠해도 안 보이기는 하지만 가장자리 필터링에 섞여 테두리가 지저분해진다 */
  c.save();
  c.beginPath();
  c.arc(R, R, R, 0, Math.PI * 2);
  c.clip();

  c.fillStyle = "#F2ECE0";
  c.fillRect(0, 0, S, S);

  // 실링된 바깥 테두리 — 뚜껑을 용기에 붙인 자국
  c.strokeStyle = "#DCD0B8";
  c.lineWidth = S * 0.08;
  c.beginPath();
  c.arc(R, R, R - S * 0.04, 0, Math.PI * 2);
  c.stroke();
  c.strokeStyle = "rgba(186,170,142,0.55)";
  c.lineWidth = 2;
  c.beginPath();
  c.arc(R, R, R * 0.83, 0, Math.PI * 2);
  c.stroke();

  c.textAlign = "center";
  c.textBaseline = "middle";

  /* 햇반 로고 — 빨간 둥근 사각형 안에 흰 글씨. 실제 로고의 붓글씨체까지 흉내 낼 필요는
     없다. 이 크기에서는 빨간 덩어리와 흰 글자의 대비만 읽힌다 */
  const lw = S * 0.30, lh = S * 0.21, lx = S * 0.13, ly = S * 0.30;
  c.fillStyle = "#C9302C";
  c.beginPath();
  c.roundRect(lx, ly, lw, lh, S * 0.05);
  c.fill();
  c.fillStyle = "#FFFFFF";
  c.font = `800 ${Math.round(S * 0.13)}px 'Malgun Gothic', sans-serif`;
  c.fillText("햇반", lx + lw / 2, ly + lh / 2 + 1);

  c.fillStyle = "#8C6B3F";
  c.font = `700 ${Math.round(S * 0.036)}px 'Malgun Gothic', sans-serif`;
  c.fillText("COOKED WHITE RICE", lx + lw / 2, ly + lh + S * 0.05);
  c.font = `700 ${Math.round(S * 0.032)}px 'Malgun Gothic', sans-serif`;
  c.fillText("210g", lx + lw / 2, ly + lh + S * 0.10);

  /* 밥그릇 사진 자리 — 흰 밥 무더기 + 갈색 그릇. 사진 한 장을 넣을 수는 없으니 실루엣으로
     대신한다. 밥알은 작은 원 몇 개면 충분하다 — 정밀하게 그려도 화면에서는 몇 픽셀이다 */
  const bx = S * 0.66, by = S * 0.56, bw = S * 0.15;
  c.fillStyle = "#F8F6F1";
  c.beginPath();
  c.moveTo(bx - bw, by);
  c.bezierCurveTo(bx - bw * 0.9, by - bw * 1.5, bx + bw * 0.9, by - bw * 1.5, bx + bw, by);
  c.closePath();
  c.fill();
  c.fillStyle = "rgba(220,214,202,0.9)";
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI;
    const rr = bw * (0.25 + (i % 3) * 0.22);
    c.beginPath();
    c.ellipse(bx + Math.cos(a) * rr, by - Math.abs(Math.sin(a)) * rr * 0.7 - 3, 3.2, 2.1, a, 0, Math.PI * 2);
    c.fill();
  }
  c.fillStyle = "#C49A6C";
  c.beginPath();
  c.moveTo(bx - bw * 1.12, by);
  c.lineTo(bx + bw * 1.12, by);
  c.lineTo(bx + bw * 0.66, by + bw * 0.86);
  c.lineTo(bx - bw * 0.66, by + bw * 0.86);
  c.closePath();
  c.fill();
  c.fillStyle = "rgba(255,255,255,0.35)";
  c.fillRect(bx - bw * 1.05, by + 2, bw * 2.1, 3);

  // 오른쪽 아래 빨간 꼬리표 (즉석조리 표시 자리)
  c.fillStyle = "#C9302C";
  c.beginPath();
  c.roundRect(S * 0.72, S * 0.74, S * 0.16, S * 0.08, 4);
  c.fill();
  c.fillStyle = "#FFFFFF";
  c.font = `800 ${Math.round(S * 0.045)}px 'Malgun Gothic', sans-serif`;
  c.fillText("2분", S * 0.80, S * 0.78);

  /* 필름 광택 — 왼쪽 위에서 비스듬히 들어오는 하이라이트. 이게 없으면 종이 뚜껑처럼
     보인다. 실제로는 비닐이라 빛을 받는다 */
  const gl = c.createLinearGradient(0, 0, S * 0.8, S * 0.9);
  gl.addColorStop(0, "rgba(255,255,255,0.42)");
  gl.addColorStop(0.35, "rgba(255,255,255,0.06)");
  gl.addColorStop(1, "rgba(255,255,255,0)");
  c.fillStyle = gl;
  c.fillRect(0, 0, S, S);

  c.restore();

  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

/** 슬리브 인쇄면. `long` 이 참이면 긴 옆면(제품명 쪽), 거짓이면 짧은 옆면 */
function hetbanSleeveTexture(long) {
  const W = long ? 970 : 640, H = 200;
  const cv = document.createElement("canvas");
  cv.width = W; cv.height = H;
  const c = cv.getContext("2d");

  c.fillStyle = "#EFE7DA";           // 크림색 바탕
  c.fillRect(0, 0, W, H);
  c.fillStyle = "#C9302C";           // 아래 빨간 띠
  c.fillRect(0, H - 26, W, 26);
  c.fillStyle = "#FFFFFF";
  c.font = "700 15px 'Malgun Gothic', sans-serif";
  c.textAlign = "center";
  c.textBaseline = "middle";
  c.fillText("대한민국 1등, 햇반", W * 0.28, H - 13);

  const lw = long ? 190 : 170, lh = 86;
  const lx = long ? 74 : (W - lw) / 2 - 40, ly = 52;
  c.fillStyle = "#C9302C";
  c.beginPath();
  c.roundRect(lx, ly, lw, lh, 16);
  c.fill();
  c.fillStyle = "#FFFFFF";
  c.font = `800 ${long ? 58 : 54}px 'Malgun Gothic', sans-serif`;
  c.fillText("햇반", lx + lw / 2, ly + lh / 2 + 2);

  // 6개입 꼬리표 — 왼쪽 위 모서리
  c.fillStyle = "#8C6B3F";
  c.font = "800 22px 'Malgun Gothic', sans-serif";
  c.textAlign = "left";
  c.fillText("6개입", 20, 30);

  if (long) {
    c.fillStyle = "#8C6B3F";
    c.font = "700 30px 'Malgun Gothic', sans-serif";
    c.fillText("언제나 맛있는", 300, 58);
    c.fillStyle = "#C9302C";
    c.font = "900 62px 'Malgun Gothic', sans-serif";
    c.fillText("진 - 밥", 300, 112);
    c.fillStyle = "#6B5B45";
    c.font = "700 20px 'Malgun Gothic', sans-serif";
    c.fillText("COOKED WHITE RICE", 302, 150);
    c.font = "700 19px 'Malgun Gothic', sans-serif";
    c.textAlign = "right";
    c.fillText("210g × 6개입", W - 20, 34);
  } else {
    c.fillStyle = "#6B5B45";
    c.font = "700 22px 'Malgun Gothic', sans-serif";
    c.textAlign = "center";
    c.fillText("210g × 6개입", W / 2, 160);
  }

  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

/**
 * 햇반 6개입 한 팩. **바닥이 y = 0** 이 되게 만들어 돌려준다 —
 * 계량판 위에 올릴 때 판 높이만 넘기면 되도록.
 */
function buildHetbanPack(dispose) {
  const g = new THREE.Group();
  const L = ITEM.lengthMm * MM, WD = ITEM.widthMm * MM;

  /* 실측 기준 (mm)
     용기: 지름 128, 높이 43. 뚜껑 테두리는 지름 134 로 살짝 넓다(실링 플랜지).
     트레이 6 + 용기 43 + 필름 = 약 52. 나머지가 포장 여유. */
  const TRAY_H = 0.006;
  const BOWL_H = 0.043, BOWL_RT = 0.064, BOWL_RB = 0.055;
  const FLANGE_R = 0.067;
  const SLEEVE_H = TRAY_H + BOWL_H * 0.72;   // 뚜껑을 덮지 않는 높이까지만

  // 받침 트레이
  const trayMat = new THREE.MeshLambertMaterial({ color: 0xe8e0d2 });
  const tray = new THREE.Mesh(new THREE.BoxGeometry(L, TRAY_H, WD), trayMat);
  tray.position.y = TRAY_H / 2;
  g.add(tray);
  dispose.push(tray.geometry, trayMat);

  /* 용기 6개 (3 × 2)
     ⚠️ 옆면 분할을 28 로 올렸다. 12~16 이면 위에서 내려다볼 때 원이 아니라 다각형으로
        보이는데, 측정기 카메라 구도가 정확히 그 각도다. */
  const bowlMat = new THREE.MeshLambertMaterial({ color: 0xf7f6f2 });
  const flangeMat = new THREE.MeshLambertMaterial({ color: 0xefece4 });
  const bowlGeo = new THREE.CylinderGeometry(BOWL_RT, BOWL_RB, BOWL_H, 28);
  const flangeGeo = new THREE.CylinderGeometry(FLANGE_R, BOWL_RT, 0.004, 28);
  const lidGeo = new THREE.CircleGeometry(FLANGE_R - 0.001, 28);

  /* 뚜껑 인쇄는 여섯 개가 **같은 텍스처 한 장을 나눠 쓴다.** 여섯 장을 따로 만들면
     같은 그림을 여섯 번 GPU 에 올리게 된다 */
  const lidTex = hetbanLidTexture();
  const lidMat = new THREE.MeshLambertMaterial({ map: lidTex });

  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 2; j++) {
      const bx = (i - 1) * 0.133;
      const bz = (j - 0.5) * 0.136;

      const bowl = new THREE.Mesh(bowlGeo, bowlMat);
      bowl.position.set(bx, TRAY_H + BOWL_H / 2, bz);
      g.add(bowl);

      const flange = new THREE.Mesh(flangeGeo, flangeMat);
      flange.position.set(bx, TRAY_H + BOWL_H + 0.002, bz);
      g.add(flange);

      const lid = new THREE.Mesh(lidGeo, lidMat);
      lid.rotation.x = -Math.PI / 2;
      lid.position.set(bx, TRAY_H + BOWL_H + 0.0045, bz);
      /* 공장에서 찍어 붙인 필름이라 여섯 개가 거의 같은 방향이지만, 완전히 똑같으면
         복사-붙여넣기로 보인다. 2도 남짓만 흔든다 */
      lid.rotation.z = ((i * 2 + j) % 4 - 1.5) * 0.035;
      g.add(lid);
    }
  }
  dispose.push(bowlGeo, flangeGeo, lidGeo, bowlMat, flangeMat, lidMat, lidTex);

  /* 인쇄 슬리브 — 판 네 장 (위 주의 참고).
     ⚠️ 긴 면과 짧은 면은 가로세로 비가 달라서 텍스처를 따로 만든다. 한 장을 늘여 쓰면
        짧은 면에서 글자가 뚱뚱해진다. */
  const longTex = hetbanSleeveTexture(true);
  const shortTex = hetbanSleeveTexture(false);
  const longMat = new THREE.MeshLambertMaterial({ map: longTex, side: THREE.DoubleSide });
  const shortMat = new THREE.MeshLambertMaterial({ map: shortTex, side: THREE.DoubleSide });
  const longGeo = new THREE.PlaneGeometry(L, SLEEVE_H);
  const shortGeo = new THREE.PlaneGeometry(WD, SLEEVE_H);
  const sy = SLEEVE_H / 2;
  for (const sz of [-1, 1]) {
    const p = new THREE.Mesh(longGeo, longMat);
    p.position.set(0, sy, sz * (WD / 2 + 0.001));
    if (sz < 0) p.rotation.y = Math.PI;
    g.add(p);
  }
  for (const sx of [-1, 1]) {
    const p = new THREE.Mesh(shortGeo, shortMat);
    p.position.set(sx * (L / 2 + 0.001), sy, 0);
    p.rotation.y = sx > 0 ? Math.PI / 2 : -Math.PI / 2;
    g.add(p);
  }
  dispose.push(longGeo, shortGeo, longMat, shortMat, longTex, shortTex);

  /* 수축 필름 — 슬리브 위, 뚜껑 높이까지 감싸는 투명 띠.
     ⚠️ 팩 전체를 덮는 상자로 만들면 안 된다. 뚜껑 인쇄 위에 반투명 판이 한 겹 얹혀
        인쇄가 뿌예지는데, 그 뚜껑이 이 모형에서 가장 중요한 면이다. 옆면만 두른다. */
  const filmMat = new THREE.MeshLambertMaterial({
    color: 0xdce6f0, transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide,
  });
  const filmH = TRAY_H + BOWL_H + 0.008 - SLEEVE_H;
  const filmLong = new THREE.PlaneGeometry(L, filmH);
  const filmShort = new THREE.PlaneGeometry(WD, filmH);
  const fy = SLEEVE_H + filmH / 2;
  for (const sz of [-1, 1]) {
    const p = new THREE.Mesh(filmLong, filmMat);
    p.position.set(0, fy, sz * (WD / 2 + 0.0015));
    g.add(p);
  }
  for (const sx of [-1, 1]) {
    const p = new THREE.Mesh(filmShort, filmMat);
    p.position.set(sx * (L / 2 + 0.0015), fy, 0);
    p.rotation.y = Math.PI / 2;
    g.add(p);
  }
  dispose.push(filmLong, filmShort, filmMat);

  return g;
}

/**
 * 3면 비전 측정대.
 * ★ 예전 설계(노란 지주 + 아래를 겨눈 스캐너 + 파란 원뿔 빔 + 훑고 내려가는 격자면)를
 *   버렸다. 그 빔은 "센서가 작동 중"을 말하려던 장치인데, 실제 물류 현장의 체적 측정기는
 *   그런 걸 뿜지 않는다. 눈에 보이는 광선은 SF 소품처럼 보여서 오히려 장비의 신뢰도를
 *   깎는다. 대신 **장비의 생김새 자체**로 기능을 말하게 했다 — 문형 갠트리에 카메라 세
 *   대가 서로 다른 각도로 물건을 겨눈다. 무엇을 하는 기계인지 광선 없이도 읽힌다.
 * 돌려주는 것: { group, cams, plateEdge, plateTop }
 */
function buildRig(scene, dispose) {
  const g = new THREE.Group();

  const PED_W = 1.3, PED_D = 1.3, PED_H = 0.86, CASTER = 0.075;
  const graphite = new THREE.MeshLambertMaterial({ color: 0x2a3038 });
  const alu = new THREE.MeshLambertMaterial({ color: 0x8b96a4 });
  const dark = new THREE.MeshLambertMaterial({ color: 0x161a1f });

  /* ── 받침대 ── */
  const pedGeo = roundedBox(PED_W, PED_H, PED_D, 0.06, 0.028);
  const ped = new THREE.Mesh(pedGeo, graphite);
  ped.position.y = CASTER * 2;
  g.add(ped);
  dispose.push(pedGeo);

  // 허리 높이의 파란 띠 — 창고 랙 색. 장비가 이 건물 소속으로 보이게 한다
  const bandMat = new THREE.MeshLambertMaterial({ color: W.rackBlue });
  const bandGeo = new THREE.BoxGeometry(PED_W + 0.012, 0.045, PED_D + 0.012);
  const band = new THREE.Mesh(bandGeo, bandMat);
  band.position.y = CASTER * 2 + PED_H * 0.72;
  g.add(band);
  dispose.push(bandGeo, bandMat);

  const castMat = new THREE.MeshLambertMaterial({ color: 0x22272d });
  const castGeo = new THREE.CylinderGeometry(CASTER, CASTER, 0.05, 14);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const c = new THREE.Mesh(castGeo, castMat);
    c.rotation.z = Math.PI / 2;
    c.position.set(sx * (PED_W / 2 - 0.16), CASTER, sz * (PED_D / 2 - 0.16));
    g.add(c);
  }
  dispose.push(castGeo, castMat);

  /* ── 계량 상판 ──
     ★ 예전의 '빛나는 청록 아크릴 판'을 스테인리스 계량판으로 바꿨다. 빛나는 판은
       측정기가 아니라 조명기구처럼 보였다. 대신 가장자리에 얇은 파란 선 하나만 남겨
       "여기가 재는 자리"를 표시한다 — 현장 장비가 실제로 쓰는 방식이다. */
  const plateGeo = roundedBox(PED_W - 0.06, 0.04, PED_D - 0.06, 0.04, 0.016);
  const plateMat = new THREE.MeshLambertMaterial({ color: 0x9aa5b1 });
  const plate = new THREE.Mesh(plateGeo, plateMat);
  plate.position.y = CASTER * 2 + PED_H;
  g.add(plate);
  dispose.push(plateGeo, plateMat);
  const PLATE_TOP = plate.position.y + 0.04;

  const edgeGeo = new THREE.EdgesGeometry(new THREE.PlaneGeometry(PED_W - 0.22, PED_D - 0.22));
  const plateEdge = new THREE.LineSegments(edgeGeo, new THREE.LineBasicMaterial({ color: 0x3e8fd0 }));
  plateEdge.rotation.x = -Math.PI / 2;
  plateEdge.position.y = PLATE_TOP + 0.002;
  g.add(plateEdge);
  dispose.push(edgeGeo, plateEdge.material);

  /* ── 앞면 명판 ── */
  const plaqueCv = document.createElement("canvas");
  plaqueCv.width = 320; plaqueCv.height = 88;
  {
    const c = plaqueCv.getContext("2d");
    c.fillStyle = "#20262d"; c.fillRect(0, 0, 320, 88);
    c.fillStyle = "#3e8fd0"; c.fillRect(0, 74, 320, 5);
    c.font = "800 40px 'Segoe UI', Arial, sans-serif";
    c.textBaseline = "middle";
    c.fillStyle = "#DCE6F2";
    c.fillText("CMES", 18, 34);
    c.font = "700 19px 'Malgun Gothic', sans-serif";
    c.fillStyle = "#7E93A8";
    c.fillText("3-VIEW DIMENSIONER", 132, 38);
  }
  const plaqueTex = new THREE.CanvasTexture(plaqueCv);
  plaqueTex.colorSpace = THREE.SRGBColorSpace;
  const plaqueMat = new THREE.MeshLambertMaterial({ map: plaqueTex });
  const plaque = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.17), plaqueMat);
  plaque.position.set(0, CASTER * 2 + PED_H * 0.42, PED_D / 2 + 0.006);
  g.add(plaque);
  dispose.push(plaque.geometry, plaqueMat, plaqueTex);

  /* ── 문형 갠트리 ──
     카메라 세 대를 매다는 구조물. 알루미늄 프로파일 느낌으로 얇게 뽑는다. */
  const POST_X = 0.98, POST_H = 2.42, POST_Z = -0.22;
  const postGeo = new THREE.BoxGeometry(0.085, POST_H, 0.085);
  const footGeo = new THREE.BoxGeometry(0.3, 0.045, 0.3);
  for (const sx of [-1, 1]) {
    const p = new THREE.Mesh(postGeo, alu);
    p.position.set(sx * POST_X, POST_H / 2, POST_Z);
    g.add(p);
    const f = new THREE.Mesh(footGeo, graphite);
    f.position.set(sx * POST_X, 0.022, POST_Z);
    g.add(f);
  }
  dispose.push(postGeo, footGeo);

  const beamGeo = new THREE.BoxGeometry(POST_X * 2 + 0.085, 0.11, 0.13);
  const beam = new THREE.Mesh(beamGeo, alu);
  beam.position.set(0, POST_H - 0.055, POST_Z);
  g.add(beam);
  // 보 앞면의 파란 줄
  const stripeGeo = new THREE.BoxGeometry(POST_X * 2 + 0.09, 0.022, 0.006);
  const stripe = new THREE.Mesh(stripeGeo, new THREE.MeshLambertMaterial({ color: W.rackBlue }));
  stripe.position.set(0, POST_H - 0.02, POST_Z + 0.068);
  g.add(stripe);
  dispose.push(beamGeo, stripeGeo, stripe.material, alu, graphite, dark);

  /* ── 카메라 3대 ──
     한 물건을 세 각도에서 동시에 잡는다는 게 이 장비의 요지다:
       TOP  — 바로 위에서 → 길이 x 가로(바닥 면적)
       L/R  — 좌우 앞 45° 에서 → 높이와 옆면, 그리고 서로의 사각(死角)을 메운다
     ⚠️ 세 대가 모두 **같은 한 점**(상판 위 물건의 중심)을 봐야 한다. 각자 다른 데를
        보면 각도만 다른 세 대가 아니라 그냥 흩어진 장식이 된다. */
  const AIM = new THREE.Vector3(0, PLATE_TOP + ITEM.heightMm * MM * PROP_SCALE * 0.5, 0);
  const mounts = [
    { label: "TOP", pos: [0, POST_H - 0.2, POST_Z] },
    { label: "L-45", pos: [-POST_X + 0.02, 1.86, POST_Z + 0.62] },
    { label: "R-45", pos: [POST_X - 0.02, 1.86, POST_Z + 0.62] },
  ];
  const cams = [];
  for (const m of mounts) {
    const cam = makeVisionCamera(dispose, { label: m.label });
    cam.group.position.set(...m.pos);
    cam.group.lookAt(AIM);
    g.add(cam.group);
    cams.push(cam);
  }

  /* 측면 카메라를 기둥에 잇는 팔 */
  const armMat = new THREE.MeshLambertMaterial({ color: 0x8b96a4 });
  for (const sx of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.055, 0.62), armMat);
    arm.position.set(sx * (POST_X - 0.01), 1.86, POST_Z + 0.31);
    g.add(arm);
    dispose.push(arm.geometry);
  }
  dispose.push(armMat);

  /* ── 측정 대상 ── */
  const L = ITEM.lengthMm * MM, H = ITEM.heightMm * MM, WD = ITEM.widthMm * MM;
  const pack = buildHetbanPack(dispose);
  pack.position.set(0, PLATE_TOP, 0);   // 팩은 바닥이 원점이라 판 높이만 넘기면 된다
  pack.scale.setScalar(PROP_SCALE);     // 보이라고 키운다 (위 `PROP_SCALE` 주의 참고)
  g.add(pack);
  /* ⚠️ 팩의 원점은 **바닥**이다. 아래 와이어프레임과 치수 라벨은 물건의 **가운데**를
     기준으로 놓이므로, 팩 위치를 그대로 복사하면 안 되고 높이의 절반을 더해야 한다.
     (예전 골판지 상자는 원점이 가운데여서 그냥 복사하면 됐다) */
  const cy = PLATE_TOP + (H * PROP_SCALE) / 2;

  /* ── 치수 와이어프레임 ──
     이건 남긴다. 광선과 달리 **측정 결과의 표시**라서, 없으면 무엇을 쟀는지 안 보인다.
     ★ 옆에 붙어 있던 `412 mm` 같은 숫자 라벨은 **뺐다.** 같은 값이 바로 앞 모니터에 크게
       떠 있어서, 물건 옆에 또 적으면 눈이 두 번 읽고 화면만 어수선해진다. 여기서는 "무엇을
       재고 있다"만 선으로 말하고, 값은 화면이 맡는다.
     ⚠️ 상자와 똑같은 크기로 두면 선이 면에 파묻혀 점선처럼 끊긴다. 2cm 키운다.
     ⚠️ 모형을 키웠으므로 테두리도 같은 배율이어야 한다 — 안 그러면 선이 상자 속을 지난다. */
  const wireGeo = new THREE.BoxGeometry(
    L * PROP_SCALE + 0.02, H * PROP_SCALE + 0.02, WD * PROP_SCALE + 0.02,
  );
  const edges = new THREE.EdgesGeometry(wireGeo);
  const wire = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x4cc9ff }));
  wire.position.set(0, cy, 0);
  g.add(wire);
  dispose.push(wireGeo, edges, wire.material);

  scene.add(g);
  return { group: g, cams, plateEdge, plateTop: PLATE_TOP };
}

/** 대형 스탠드 모니터. 화면은 캔버스로 그린다 */
function buildMonitor(scene, dispose) {
  const g = new THREE.Group();
  const SW = 2.0, SH = 1.2;

  /* 캔버스 비율(1280x768 = 1.667)을 판 비율(2.0 x 1.2 = 1.667)과 **정확히** 맞춘다.
     어긋나면 실제 입고 화면을 옮겨 그린 그림이 세로로 눌려 보인다. */
  const cv = document.createElement("canvas");
  cv.width = 1280; cv.height = 768;
  const ctx = cv.getContext("2d");
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;

  /* ⚠️ 화면은 `MeshBasicMaterial` 이어야 한다. Lambert 로 두면 방 조명에 따라 화면이
     어두워진다 — 모니터는 스스로 빛나는 물건이다. */
  const screenMat = new THREE.MeshBasicMaterial({ map: tex });
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(SW, SH), screenMat);
  /* ⚠️ 케이스보다 **앞에** 놓아야 한다. `roundedBox` 는 바닥이 y=0 인 상자를 주는데,
     그걸 x축으로 90도 눕히면 두께가 z = 0 ~ 0.05 를 차지한다. 화면을 z=0.021 에 두면
     케이스 앞면(z=0.05) 뒤에 파묻혀 새까맣게만 보인다 — 실제로 그렇게 보였다. */
  screen.position.set(0, 0, 0.056);
  screen.userData.monitor = true;   // 클릭 판정에 쓴다
  g.add(screen);
  dispose.push(screen.geometry, screenMat, tex);

  const caseMat = new THREE.MeshLambertMaterial({ color: 0x1b1f25 });
  const shell = new THREE.Mesh(roundedBox(SW + 0.09, 0.05, SH + 0.09, 0.03, 0.015), caseMat);
  shell.rotation.x = Math.PI / 2;   // 눕힌 상자를 세워 액자로 쓴다
  g.add(shell);
  dispose.push(shell.geometry);

  /* 마우스를 올렸을 때 켜지는 테두리. 클릭할 수 있는 물건이라는 유일한 신호라
     꺼져 있을 때도 완전히 안 보이면 안 된다 — 그래서 기본 투명도를 0 이 아니라 0.25 로 둔다 */
  const glowMat = new THREE.MeshBasicMaterial({
    color: 0x4cc9ff, transparent: true, opacity: 0.25, side: THREE.DoubleSide,
  });
  const glowGeo = new THREE.EdgesGeometry(new THREE.PlaneGeometry(SW + 0.05, SH + 0.05));
  const glow = new THREE.LineSegments(glowGeo, new THREE.LineBasicMaterial({
    color: 0x4cc9ff, transparent: true, opacity: 0.3,
  }));
  glow.position.set(0, 0, 0.058);
  g.add(glow);
  dispose.push(glowGeo, glow.material, glowMat);

  const spill = new THREE.PointLight(0x4fa8e8, 1.1, 4.5, 2);
  spill.position.set(0, 0, 0.7);
  g.add(spill);

  const tilt = new THREE.Group();
  tilt.add(g);
  tilt.rotation.x = -0.13;
  tilt.position.y = 1.66;

  const stand = new THREE.Group();
  stand.add(tilt);
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x2c323a });
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.075, 1.08, 16), poleMat);
  pole.position.y = 0.54;
  stand.add(pole);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.48, 0.06, 24), poleMat);
  base.position.y = 0.03;
  stand.add(base);
  dispose.push(pole.geometry, base.geometry, poleMat, caseMat);

  const hint = makeLabel("클릭 → 입고 등록 화면 열기", { color: "#BFE9FF", size: 36, scale: 0.66 });
  hint.position.set(0, 2.62, 0);
  stand.add(hint);
  dispose.push(hint.material.map, hint.material);

  scene.add(stand);
  return { stand, screen, glow, hint, ctx, canvas: cv, tex, pickTargets: [screen] };
}

/** 짧은 컨베이어 + 대기 중인 상자 */
function buildConveyor(scene, dispose, LEN = 5.6) {
  const g = new THREE.Group();
  const WD = 0.78, TOP = 0.62;

  const frameMat = new THREE.MeshLambertMaterial({ color: 0x353c44 });
  const side = new THREE.BoxGeometry(LEN, 0.12, 0.05);
  for (const sz of [-1, 1]) {
    const m = new THREE.Mesh(side, frameMat);
    m.position.set(0, TOP, sz * (WD / 2));
    g.add(m);
  }
  dispose.push(side);

  /* 다리 — 길이에 맞춰 2.4m 마다 한 쌍씩. 양 끝에만 세우면 5m 넘는 벨트가 공중에
     걸쳐 있는 꼴이 되어, 가운데가 처져 보이지 않아도 보는 사람이 불안해한다 */
  const legGeo = new THREE.BoxGeometry(0.07, TOP, 0.07);
  const pairs = Math.max(2, Math.round(LEN / 2.4) + 1);
  for (let i = 0; i < pairs; i++) {
    const lx = -LEN / 2 + 0.22 + (i * (LEN - 0.44)) / (pairs - 1);
    for (const sz of [-1, 1]) {
      const l = new THREE.Mesh(legGeo, frameMat);
      l.position.set(lx, TOP / 2, sz * (WD / 2 - 0.03));
      g.add(l);
    }
  }
  dispose.push(legGeo, frameMat);

  const rollMat = new THREE.MeshLambertMaterial({ color: 0x9aa5b1 });
  /* ⚠️ 회전축을 **지오메트리에 구워 넣는다.** 메시의 `rotation` 으로 눕혀 놓고 다른 축을
     더하면 원통이 제자리에서 도는 게 아니라 통째로 휘청인다 — 오일러 각은 XYZ 순서로
     곱해지므로, 눕히는 회전이 바깥에 남아 있으면 더해지는 회전이 원통의 축이 아니라
     월드 축을 기준으로 걸리기 때문이다. 실제로 벨트가 이상하게 돌아 보였던 이유다.
     구워 넣으면 메시의 회전이 비어 있어서, 더하는 축이 곧 원통의 축이 된다. */
  const rollGeo = new THREE.CylinderGeometry(0.055, 0.055, WD - 0.06, 12);
  rollGeo.rotateX(Math.PI / 2);        // 축을 +y 에서 +z 로 (벨트는 x 로 흐른다)
  const rollers = [];
  for (let i = 0; i < Math.floor(LEN / 0.17); i++) {
    const r = new THREE.Mesh(rollGeo, rollMat);
    r.position.set(-LEN / 2 + 0.1 + i * 0.17, TOP + 0.02, 0);
    g.add(r);
    rollers.push(r);
  }
  dispose.push(rollGeo, rollMat);

  /* 실려 가는 상자 — 크기와 색을 조금씩 달리해야 "여러 건"으로 보인다.
     ★ 가만히 놓여 있던 것을 **흐르게** 바꿨다. 롤러만 돌고 짐이 멈춰 있으면 고장난 벨트다.
     ⚠️ 간격을 일정하게 두지 않는다. 자로 잰 듯 같은 간격이면 컨베이어가 아니라 회전목마로
        보인다 — 실제 라인은 짐이 몰렸다 비었다 한다. */
  const boxes = [];
  const SPEC = [
    [0.42, 0.30, 0.32, 0xc9a06a, 0.00],
    [0.34, 0.26, 0.28, 0xb98f5c, 0.19],
    [0.50, 0.34, 0.36, 0xd1aa76, 0.41],
    [0.38, 0.28, 0.30, 0xc09363, 0.58],
    [0.46, 0.32, 0.34, 0xd6b183, 0.83],
  ];
  for (const [w, h, d, col, frac] of SPEC) {
    const mat = new THREE.MeshLambertMaterial({ color: col });
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(-LEN / 2 + frac * LEN, TOP + 0.02 + h / 2, 0);
    m.rotation.y = (frac - 0.5) * 0.16;
    g.add(m);
    boxes.push(m);
    dispose.push(m.geometry, mat);
  }

  scene.add(g);
  return { group: g, rollers, boxes, len: LEN, top: TOP };
}

/* ── 창고 소품 ────────────────────────────────────────────────────────────
   이 방이 '물류창고 안'으로 읽히게 하는 건 사실 측정기가 아니라 **주변 잡동사니**다.
   랙 한 칸, 파렛트, 쌓인 박스가 있어야 창고고, 없으면 전시장이다. */
/** 목재 파렛트 한 장. 상판 윗면이 y = 0.1725 에 온다(`userData.top`) */
function makePallet(dispose) {
  const g = new THREE.Group();
  const mat = new THREE.MeshLambertMaterial({ color: W.pallet });
  const deck = new THREE.BoxGeometry(1.1, 0.035, 0.9);
  for (const y of [0.06, 0.155]) {
    const d = new THREE.Mesh(deck, mat);
    d.position.y = y;
    g.add(d);
  }
  const blk = new THREE.BoxGeometry(0.14, 0.085, 0.9);
  for (const bx of [-0.45, 0, 0.45]) {
    const b = new THREE.Mesh(blk, mat);
    b.position.set(bx, 0.107, 0);
    g.add(b);
  }
  dispose.push(deck, blk, mat);
  g.userData.top = 0.1725;
  return g;
}

/* ── 신규 입고 대기 물품 ──────────────────────────────────────────────────
   검수를 기다리는 실제 상품 두 종류를 파렛트에 쌓는다. 갈색 골판지 상자만 있으면
   "무언가 담긴 상자"일 뿐이라 무엇이 들어오는 현장인지 안 보인다. 알아볼 수 있는
   물건(즉석밥 6개입, 음료 12입 팩)이 있어야 식품 물류 창고로 읽힌다.

   ★ 전부 `InstancedMesh` 로 그린다. 즉석밥 용기가 162개, 음료병이 216개라 하나씩
     메시로 만들면 그리기 호출만 400번 가까이 된다. 인스턴싱은 같은 모양을 위치만
     바꿔 한 번에 그리므로, 종류당 1번으로 끝난다.
   ⚠️ 인스턴스는 **파렛트 그룹의 자식**으로 넣는다. 그래야 파렛트를 옮기거나 돌릴 때
      쌓인 물건이 따라온다. 씬에 따로 넣으면 파렛트만 움직이고 짐은 제자리에 남는다. */
function buildIncomingGoods(scene, dispose) {
  const dummy = new THREE.Object3D();
  const place = (im, i, x, y, z, rx = 0, ry = 0) => {
    dummy.position.set(x, y, z);
    dummy.rotation.set(rx, ry, 0);
    dummy.updateMatrix();
    im.setMatrixAt(i, dummy.matrix);
  };

  /* ── ① 즉석밥 6개입 (3열 × 3행 × 3단 = 27팩) ── */
  const ricePallet = makePallet(dispose);
  /* 측정대 왼쪽 — 컨베이어가 있던 자리다 (위 맞바꿈 주석 참고).
     ⚠️ x = -3.6 은 측정대(받침대 ±0.65, 갠트리 기둥 ±0.98)와 파렛트 폭(1.1)이
        서로 안 닿는 최소한의 거리다. 더 붙이면 갠트리 기둥에 짐이 파고든다. */
  ricePallet.position.set(-3.6, 0, -0.6);
  ricePallet.rotation.y = 0.22;
  scene.add(ricePallet);

  const RC = 3, RR = 3, RL = 3;           // 열 · 행 · 단
  const PACK_H = 0.108;
  const nPack = RC * RR * RL;

  const bowlGeo = new THREE.CylinderGeometry(0.044, 0.037, 0.055, 12);
  const lidGeo = new THREE.CircleGeometry(0.044, 12);
  const filmGeo = new THREE.BoxGeometry(0.3, PACK_H, 0.215);
  const bowlMat = new THREE.MeshLambertMaterial({ color: 0xf4f1ea });
  const lidMat = new THREE.MeshLambertMaterial({ color: 0xd0d6de });
  /* 수축 포장 필름. 완전 투명이면 없느니만 못하고, 불투명하면 안이 안 보인다 */
  const filmMat = new THREE.MeshLambertMaterial({
    color: 0xdfe8f0, transparent: true, opacity: 0.22, depthWrite: false,
  });

  const bowls = new THREE.InstancedMesh(bowlGeo, bowlMat, nPack * 6);
  const lids = new THREE.InstancedMesh(lidGeo, lidMat, nPack * 6);
  const films = new THREE.InstancedMesh(filmGeo, filmMat, nPack);
  let bi = 0, pi = 0;
  for (let l = 0; l < RL; l++) {
    for (let r = 0; r < RR; r++) {
      for (let c = 0; c < RC; c++) {
        const px = (c - 1) * 0.315;
        const pz = (r - 1) * 0.235;
        const py = 0.1725 + PACK_H * l;
        /* 단마다 살짝 돌려 쌓는다. 자로 잰 듯 반듯하면 사람이 쌓은 짐이 아니라
           격자 무늬로 보인다 */
        const ry = (l % 2 === 0 ? 1 : -1) * 0.02;
        place(films, pi++, px, py + PACK_H / 2, pz, 0, ry);
        for (let bx = 0; bx < 3; bx++) {
          for (let bz = 0; bz < 2; bz++) {
            const ox = px + (bx - 1) * 0.098;
            const oz = pz + (bz - 0.5) * 0.104;
            place(bowls, bi, ox, py + 0.033, oz, 0, ry);
            place(lids, bi, ox, py + 0.061, oz, -Math.PI / 2, ry);
            bi++;
          }
        }
      }
    }
  }
  for (const im of [films, bowls, lids]) im.instanceMatrix.needsUpdate = true;
  ricePallet.add(films, bowls, lids);
  dispose.push(bowlGeo, lidGeo, filmGeo, bowlMat, lidMat, filmMat);

  /* ── ② 음료 12입 세트 (3열 × 3행 × 2단 = 18세트, 216병) ── */
  const drinkPallet = makePallet(dispose);
  drinkPallet.position.set(-3.4, 0, 0.98);
  drinkPallet.rotation.y = -0.28;
  scene.add(drinkPallet);

  const DC = 3, DR = 3, DL = 2;
  const CASE_H = 0.212;
  const nCase = DC * DR * DL;

  const bodyGeo = new THREE.CylinderGeometry(0.031, 0.031, 0.15, 10);
  const capGeo = new THREE.CylinderGeometry(0.017, 0.017, 0.026, 10);
  const trayGeo = new THREE.BoxGeometry(0.315, 0.035, 0.245);
  const caseGeo = new THREE.BoxGeometry(0.318, CASE_H, 0.248);
  const bodyMat = new THREE.MeshLambertMaterial({ color: 0x4fa8c8 });
  const capMat = new THREE.MeshLambertMaterial({ color: 0xe6ebef });
  const trayMat = new THREE.MeshLambertMaterial({ color: 0x2e6fd8 });
  const caseFilm = new THREE.MeshLambertMaterial({
    color: 0xcfe0ee, transparent: true, opacity: 0.18, depthWrite: false,
  });

  const bodies = new THREE.InstancedMesh(bodyGeo, bodyMat, nCase * 12);
  const caps = new THREE.InstancedMesh(capGeo, capMat, nCase * 12);
  const trays = new THREE.InstancedMesh(trayGeo, trayMat, nCase);
  const cases = new THREE.InstancedMesh(caseGeo, caseFilm, nCase);
  let di = 0, ci = 0;
  for (let l = 0; l < DL; l++) {
    for (let r = 0; r < DR; r++) {
      for (let c = 0; c < DC; c++) {
        const px = (c - 1) * 0.335;
        const pz = (r - 1) * 0.262;
        const py = 0.1725 + CASE_H * l;
        const ry = (l % 2 === 0 ? 1 : -1) * 0.025;
        place(trays, ci, px, py + 0.018, pz, 0, ry);
        place(cases, ci, px, py + CASE_H / 2, pz, 0, ry);
        ci++;
        for (let bx = 0; bx < 4; bx++) {
          for (let bz = 0; bz < 3; bz++) {
            const ox = px + (bx - 1.5) * 0.074;
            const oz = pz + (bz - 1) * 0.076;
            place(bodies, di, ox, py + 0.111, oz, 0, ry);
            place(caps, di, ox, py + 0.199, oz, 0, ry);
            di++;
          }
        }
      }
    }
  }
  for (const im of [trays, bodies, caps, cases]) im.instanceMatrix.needsUpdate = true;
  drinkPallet.add(trays, bodies, caps, cases);
  dispose.push(bodyGeo, capGeo, trayGeo, caseGeo, bodyMat, capMat, trayMat, caseFilm);

  /* ── 라벨 ──
     무엇이 몇 개 쌓여 있는지 글자로 못 박는다. 모형만으로는 "6개입"인지 "4개입"인지
     알 수 없는데, 검수 대기 물량은 숫자가 요점이다. */
  for (const [txt, pallet, h] of [
    ["신규 입고 · 즉석밥 6개입 × 27팩", ricePallet, 0.1725 + PACK_H * RL + 0.22],
    ["신규 입고 · 음료 12입 × 18세트", drinkPallet, 0.1725 + CASE_H * DL + 0.22],
  ]) {
    const sp = makeLabel(txt, { color: "#DCE8F4", size: 34, scale: 0.62 });
    sp.position.set(0, h, 0);
    pallet.add(sp);
    dispose.push(sp.material.map, sp.material);
  }
}

function buildProps(scene, dispose) {
  const postMat = new THREE.MeshLambertMaterial({ color: W.rackBlue });
  const beamMat = new THREE.MeshLambertMaterial({ color: 0xd8823a });   // 창고 랙 보와 같은 주황
  const cartonMat = new THREE.MeshLambertMaterial({ color: W.carton });

  /* 오른쪽 벽에 붙인 2단 랙 한 구간 */
  const rack = new THREE.Group();
  const RW = 3.2, RH = 2.4, RD = 0.9;
  const postGeo = new THREE.BoxGeometry(0.1, RH, 0.1);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const p = new THREE.Mesh(postGeo, postMat);
    p.position.set(sx * (RW / 2), RH / 2, sz * (RD / 2));
    rack.add(p);
  }
  const beamGeo = new THREE.BoxGeometry(RW, 0.07, 0.06);
  const deckGeo = new THREE.BoxGeometry(RW, 0.03, RD);
  for (const y of [0.9, 1.75]) {
    for (const sz of [-1, 1]) {
      const b = new THREE.Mesh(beamGeo, beamMat);
      b.position.set(0, y, sz * (RD / 2));
      rack.add(b);
    }
    const d = new THREE.Mesh(deckGeo, new THREE.MeshLambertMaterial({ color: 0x39414b }));
    d.position.set(0, y - 0.05, 0);
    rack.add(d);
    dispose.push(d.material);
  }
  // 칸에 박스 채우기
  for (const [y, xs] of [[0.9, [-1.1, -0.35, 0.45, 1.15]], [1.75, [-1.0, 0.1, 0.95]]]) {
    for (const x of xs) {
      const h = 0.32 + ((Math.abs(x * 7) % 3) * 0.06);
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.5, h, 0.55), cartonMat);
      b.position.set(x, y - 0.035 + h / 2, 0);
      rack.add(b);
      dispose.push(b.geometry);
    }
  }
  rack.position.set(ROOM_W / 2 - 0.75, 0, -2.6);
  rack.rotation.y = -Math.PI / 2;
  scene.add(rack);
  dispose.push(postGeo, beamGeo, deckGeo);

  /* 파렛트 두 장 + 쌓인 박스 */
  const mkPallet = (x, z, ry) => {
    const p = makePallet(dispose);
    p.position.set(x, 0, z);
    p.rotation.y = ry;
    scene.add(p);
    return p;
  };
  const p1 = mkPallet(-4.3, -2.9, 0.16);
  for (let i = 0; i < 3; i++) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.36, 0.7), cartonMat);
    b.position.set(0, 0.18 + 0.36 * i + 0.16, 0);
    b.rotation.y = i * 0.06;
    p1.add(b);
    dispose.push(b.geometry);
  }
  const p2 = mkPallet(3.6, -3.4, -0.3);
  for (let i = 0; i < 2; i++) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.4, 0.68), cartonMat);
    b.position.set(0, 0.2 + 0.4 * i + 0.16, 0);
    p2.add(b);
    dispose.push(b.geometry);
  }

  dispose.push(postMat, beamMat, cartonMat);
}

/* ── 조명 ─────────────────────────────────────────────────────────────────
   ★ 창고와 같은 구성을 쓰되, 방이 좁으니 세기를 조금 더 준다. 창고는 넓어서 어둑한
     구석이 분위기가 되지만, 좁은 방에서 같은 어둠은 그냥 안 보이는 것이다.
   순서는 창고와 동일: 앰비언트(바닥값) → 반구광(고른 확산) → 주광 → 반대편 채움광
   → 천장 등. 앰비언트를 먼저 올려야 그림자 쪽이 검게 죽지 않는다. */
function buildLights(scene, dispose) {
  scene.add(new THREE.AmbientLight(0x36404d, 1.25));
  scene.add(new THREE.HemisphereLight(0xcfe2f2, 0x3a352c, 1.45));

  const dir = new THREE.DirectionalLight(0xfff0da, 1.05);
  dir.position.set(7, 11, 8);
  scene.add(dir);

  const fill = new THREE.DirectionalLight(0xcfe0f5, 0.5);
  fill.position.set(-8, 7, -6);
  scene.add(fill);

  /* 천장 공장등 4개 — 창고의 따뜻한 색(0xffdfae)을 그대로 쓴다 */
  const shadeMat = new THREE.MeshLambertMaterial({ color: 0x3a4048, side: THREE.DoubleSide });
  const bulbMat = new THREE.MeshBasicMaterial({ color: 0xfff6e2 });
  const shadeGeo = new THREE.ConeGeometry(0.5, 0.36, 18, 1, true);
  const bulbGeo = new THREE.CircleGeometry(0.34, 18);
  const rodGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.34, 8);

  /* ⚠️ z 값(-3.0 / 1.8)은 `buildWalls` 의 트러스 위치다. 봉이 트러스에 물려야 등이
     매달린 것으로 보인다 — 천장 판이 없어진 뒤로는 이게 유일한 지지대다 */
  for (const [x, z] of [[-3.1, -3.0], [3.1, -3.0], [-3.1, 1.8], [3.1, 1.8]]) {
    const shade = new THREE.Mesh(shadeGeo, shadeMat);
    shade.position.set(x, ROOM_H - 0.5, z);
    scene.add(shade);

    const bulb = new THREE.Mesh(bulbGeo, bulbMat);
    bulb.rotation.x = Math.PI / 2;
    bulb.position.set(x, ROOM_H - 0.67, z);
    scene.add(bulb);

    const rod = new THREE.Mesh(rodGeo, shadeMat);
    rod.position.set(x, ROOM_H - 0.2, z);
    scene.add(rod);

    /* ⚠️ `Object.assign(light, { position: new Vector3(...) })` 로 줄여 쓰면 안 된다.
       three.js 의 `position` 은 `Object.defineProperties` 로 만든 **읽기 전용 속성**이라,
       모듈(엄격 모드)에서 대입하면 TypeError 로 씬 전체가 죽는다. 반드시 기존 벡터의
       `.set()` 을 부른다. */
    const lamp = new THREE.PointLight(0xffdfae, 1.5, 13, 2);
    lamp.position.set(x, ROOM_H - 0.75, z);
    scene.add(lamp);
  }
  // 측정대 바로 위 작업등 — 주인공에 빛을 몰아 준다
  const task = new THREE.PointLight(0xfff6e0, 1.5, 7, 2);
  task.position.set(0, 3.0, 0.5);
  scene.add(task);

  dispose.push(shadeGeo, bulbGeo, rodGeo, shadeMat, bulbMat);
}

/* ── 모니터에 그리는 화면 ──────────────────────────────────────────────────
   ★ 일반적인 대시보드를 그리던 것을 **우리 프론트의 `/inbound-win98` 입고 등록 화면**을
     축소해 옮겨 그리는 것으로 바꿨다. 검수실 모니터에 이 시스템과 무관한 화면이 떠 있으면
     "어딘가의 장비"로 끝나지만, 우리 화면이 떠 있으면 이 방이 우리 시스템의 일부가 된다.
     화면을 클릭하면 실제 그 라우트로 넘어간다(아래 `pickTargets`).
   ★ 치수 네 칸은 3D 측정대가 재고 있는 값을 그대로 쓴다(mm → cm). 모형·라벨·모니터가
     같은 숫자를 보여야 셋이 한 동작으로 읽힌다.
   ⚠️ 매 프레임 다시 그리면 안 된다. 1280x768 캔버스를 초당 60번 GPU 로 올리는 비용이
      방 전체를 그리는 비용보다 크다. 아래 루프에서 초당 4번만 부른다.
   ⚠️ 이건 **그림**이지 실제 화면이 아니다. 진짜 화면을 고쳐도 여기는 안 따라온다 —
      레이아웃을 크게 손보면 이 함수도 같이 손봐야 한다. */

const W98 = {
  face: "#C0C0C0", light: "#FFFFFF", shadow: "#808080", dark: "#000000",
  title: "#000080", titleTxt: "#FFFFFF", text: "#000000",
};
const KO = "'Malgun Gothic', '맑은 고딕', sans-serif";
const MONO = "'Consolas', 'Courier New', monospace";

/** 튀어나온 테두리 (버튼·패널) */
function bevelOut(c, x, y, w, h, face) {
  c.fillStyle = face || W98.face; c.fillRect(x, y, w, h);
  c.fillStyle = W98.light; c.fillRect(x, y, w, 2); c.fillRect(x, y, 2, h);
  c.fillStyle = W98.dark; c.fillRect(x, y + h - 2, w, 2); c.fillRect(x + w - 2, y, 2, h);
  c.fillStyle = W98.shadow; c.fillRect(x + 2, y + h - 4, w - 4, 2); c.fillRect(x + w - 4, y + 2, 2, h - 4);
}

/** 눌린 테두리 (입력칸·표시영역) */
function bevelIn(c, x, y, w, h, fill) {
  if (fill) { c.fillStyle = fill; c.fillRect(x, y, w, h); }
  c.fillStyle = W98.shadow; c.fillRect(x, y, w, 2); c.fillRect(x, y, 2, h);
  c.fillStyle = W98.light; c.fillRect(x, y + h - 2, w, 2); c.fillRect(x + w - 2, y, 2, h);
}

/** 파란 제목줄이 달린 패널 */
function w98Panel(c, x, y, w, h, title, right) {
  bevelOut(c, x, y, w, h);
  c.fillStyle = W98.title;
  c.fillRect(x + 4, y + 4, w - 8, 22);
  c.font = "700 15px " + KO;
  c.textBaseline = "middle";
  c.fillStyle = W98.titleTxt;
  c.textAlign = "left";
  c.fillText(title, x + 10, y + 16);
  if (right) { c.textAlign = "right"; c.fillText(right, x + w - 11, y + 16); }
}

/** 사진 대기 자리 — 회색 바탕 + 카메라 아이콘 + 안내 글 */
function cameraPlaceholder(c, x, y, w, h, caption) {
  c.fillStyle = "#9A9A9A";
  c.fillRect(x, y, w, h);
  const cx = x + w / 2, cy = y + h / 2 - 8;
  c.strokeStyle = "#6E6E6E";
  c.lineWidth = 3;
  c.strokeRect(cx - 22, cy - 13, 44, 30);
  c.beginPath();
  c.moveTo(cx - 10, cy - 13); c.lineTo(cx - 6, cy - 20);
  c.lineTo(cx + 6, cy - 20); c.lineTo(cx + 10, cy - 13);
  c.stroke();
  c.beginPath(); c.arc(cx, cy + 2, 8, 0, Math.PI * 2); c.stroke();
  c.font = "700 13px " + KO;
  c.textAlign = "center";
  c.textBaseline = "middle";
  c.fillStyle = "#6E6E6E";
  c.fillText(caption, cx, cy + 34);
}

function drawInboundScreen(c, CW, CH, live) {
  c.textBaseline = "middle";

  /* ── 제목줄 ── */
  c.fillStyle = W98.face; c.fillRect(0, 0, CW, CH);
  c.fillStyle = W98.title; c.fillRect(0, 0, CW, 30);
  c.font = "700 17px " + KO;
  c.textAlign = "left";
  c.fillStyle = W98.titleTxt;
  c.fillText("INBOUND REGISTRATION — 입고 등록", 12, 16);

  /* ── 좌측 목차 ── */
  bevelOut(c, 6, 36, 112, CH - 42);
  bevelOut(c, 12, 42, 100, 46);
  c.strokeStyle = "#1B3C6E"; c.lineWidth = 3;
  c.beginPath(); c.moveTo(24, 76); c.lineTo(34, 52); c.lineTo(44, 76); c.closePath(); c.stroke();
  c.font = "800 16px " + KO;
  c.fillStyle = "#12233B";
  c.fillText("A.LTS", 52, 65);

  const navs = ["Inbound", "Packing", "Warehouse", "Analytics"];
  navs.forEach((n, i) => {
    const y = 98 + i * 50;
    if (i === 0) bevelIn(c, 12, y, 100, 44, "#AFAFAF");
    else bevelOut(c, 12, y, 100, 44);
    /* 아이콘은 단순 도형으로 그린다. 캔버스에서 이모지는 설치된 글꼴에 따라
       네모로 나오거나 아예 안 나온다 — 화면 안의 화면에서 그런 사고는 눈에 띈다 */
    c.strokeStyle = "#22334A"; c.lineWidth = 2.5;
    const ix = 62, iy = y + 14;
    if (i === 0) {
      c.beginPath(); c.moveTo(ix, iy - 7); c.lineTo(ix, iy + 5);
      c.moveTo(ix - 5, iy); c.lineTo(ix, iy + 5); c.lineTo(ix + 5, iy); c.stroke();
    } else if (i === 1) {
      c.strokeRect(ix - 8, iy - 6, 16, 12);
      c.beginPath(); c.moveTo(ix, iy - 6); c.lineTo(ix, iy + 6); c.stroke();
    } else if (i === 2) {
      c.strokeRect(ix - 9, iy - 5, 18, 11);
      c.beginPath(); c.moveTo(ix - 9, iy - 5); c.lineTo(ix, iy - 11); c.lineTo(ix + 9, iy - 5); c.stroke();
    } else {
      c.beginPath();
      c.moveTo(ix - 7, iy + 5); c.lineTo(ix - 7, iy);
      c.moveTo(ix, iy + 5); c.lineTo(ix, iy - 6);
      c.moveTo(ix + 7, iy + 5); c.lineTo(ix + 7, iy - 2);
      c.stroke();
    }
    c.font = "700 14px " + KO;
    c.textAlign = "center";
    c.fillStyle = W98.text;
    c.fillText(n, 62, y + 33);
    c.textAlign = "left";
  });

  /* ── 가운데: 자동 계측 ── */
  const MX = 124, MW = 796;
  c.font = "700 16px " + KO;
  c.fillStyle = W98.text;
  c.fillText("Automatic Measurement Data", MX + 4, 48);
  bevelOut(c, MX + MW - 84, 38, 80, 22);
  c.font = "700 13px " + KO;
  c.textAlign = "center";
  c.fillText("PREVIEW", MX + MW - 44, 49);
  c.textAlign = "left";

  const cards = [
    ["Width", (live.width / 10).toFixed(1), "cm"],
    ["Length", (live.length / 10).toFixed(1), "cm"],
    ["Height", (live.height / 10).toFixed(1), "cm"],
    ["Weight", live.realKg, "kg"],
  ];
  const cw = (MW - 24) / 4;
  cards.forEach((row, i) => {
    const x = MX + i * (cw + 8);
    bevelIn(c, x, 62, cw, 118, "#FFFFFF");
    c.textAlign = "left";
    c.font = "700 15px " + KO;
    c.fillStyle = "#22334A";
    c.fillText(row[0], x + 12, 84);
    c.font = "700 50px " + MONO;
    c.fillStyle = "#000000";
    c.fillText(row[1], x + 12, 132);
    /* 단위는 숫자 **폭을 재서** 그 뒤에 붙인다. 고정 좌표로 두면 "85.5" 와 "120.0" 처럼
       자릿수가 달라질 때 단위가 숫자에 겹치거나 멀리 떨어진다. */
    const numW = c.measureText(row[1]).width;
    c.font = "700 16px " + KO;
    c.fillStyle = "#3A3A3A";
    c.fillText(row[2], x + 16 + numW, 146);
  });

  /* ── 가운데: 육안 검사 ── */
  c.font = "700 16px " + KO;
  c.fillStyle = W98.text;
  c.fillText("Visual Inspection", MX + 4, 200);

  const PY = 210, PH = CH - PY - 60;
  const mvW = 505;
  w98Panel(c, MX, PY, mvW, PH, "Main View / CAM 01");
  const vx = MX + 8, vy = PY + 30, vw = mvW - 16, vh = PH - 38;
  c.fillStyle = "#000000"; c.fillRect(vx, vy, vw, vh);
  cameraPlaceholder(c, vx + 8, vy + 8, vw - 16, vh - 16, "촬영 대기 중");
  c.strokeStyle = "#1E7A34"; c.lineWidth = 2;
  c.strokeRect(vx + 4, vy + 4, vw - 8, vh - 8);
  c.font = "700 14px " + MONO;
  c.textAlign = "left";
  c.fillStyle = "#35D96B";
  c.fillText("CAM 0" + (live.cam + 1) + " - MAIN REC", vx + 12, vy + 18);
  c.fillStyle = "#FF4444";
  c.beginPath(); c.arc(vx + vw - 20, vy + 18, 5, 0, Math.PI * 2); c.fill();
  const bx0 = vx + vw / 2 - 76;
  for (let i = 0; i < 6; i++) {
    c.fillStyle = i <= live.cam * 2 + 1 ? "#35D96B" : "#12381F";
    c.fillRect(bx0 + i * 26, vy + vh - 46, 22, 12);
  }

  const sx = MX + mvW + 10, sw = MW - mvW - 10;
  const sh1 = 262;
  w98Panel(c, sx, PY, sw, sh1, "Side / Label");
  cameraPlaceholder(c, sx + 8, PY + 30, sw - 16, sh1 - 38, "촬영 대기 중");

  const ny = PY + sh1 + 8, nh = PH - sh1 - 8;
  w98Panel(c, sx, ny, sw, nh, "Special Notes");
  cameraPlaceholder(c, sx + 8, ny + 30, sw - 16, nh - 38, "촬영 대기 중");

  /* ── 오른쪽 열 ── */
  const RX = 928, RW = CW - RX - 6;
  c.font = "700 16px " + KO;
  c.textAlign = "left";
  c.fillStyle = W98.text;
  c.fillText("Barcode Data", RX + 4, 48);

  bevelIn(c, RX, 62, RW - 34, 30, "#FFFFFF");
  c.font = "400 14px " + KO;
  c.fillStyle = "#8A8A8A";
  c.fillText("스캔 또는 입력 후 Enter", RX + 10, 78);
  bevelOut(c, RX + RW - 30, 62, 30, 30);

  bevelIn(c, RX, 98, RW, 34, "#EDEDED");
  c.font = "700 15px " + KO;
  c.textAlign = "center";
  c.fillStyle = "#22334A";
  c.fillText("조회한 바코드가 여기 그려집니다", RX + RW / 2, 116);

  c.textAlign = "left";
  c.font = "700 13px " + KO;
  c.fillStyle = W98.text;
  c.fillText("TEST:", RX + 2, 154);
  bevelIn(c, RX + 44, 142, RW - 106, 26, "#FFFFFF");
  c.font = "400 12px " + KO;
  c.fillStyle = "#22334A";
  c.fillText("게이트 통과 · 기존 데이터  8801234567893", RX + 50, 155);
  bevelOut(c, RX + RW - 56, 142, 56, 26);
  c.font = "700 13px " + KO;
  c.textAlign = "center";
  c.fillStyle = W98.text;
  c.fillText("Load", RX + RW - 28, 155);

  c.textAlign = "left";
  c.font = "700 16px " + KO;
  c.fillText("Product Manifest", RX + 4, 190);
  bevelOut(c, RX + RW - 108, 180, 108, 22);
  c.font = "700 13px " + KO;
  c.textAlign = "center";
  c.fillStyle = "#8A2020";
  c.fillText("취급 주의사항", RX + RW - 54, 191);

  bevelIn(c, RX, 206, RW, 190, "#FFFFFF");
  c.textAlign = "left";
  c.font = "700 13px " + KO;
  c.fillStyle = "#5E7A96";
  c.fillText("품목명", RX + 12, 226);
  c.font = "800 20px " + KO;
  c.fillStyle = W98.text;
  c.fillText(ITEM.name, RX + 12, 254);
  c.font = "700 13px " + KO;
  c.fillStyle = "#5E7A96";
  c.fillText(ITEM.maker, RX + 12, 280);
  c.font = "700 13px " + MONO;
  c.fillText("세 변 합 " + ((ITEM.lengthMm + ITEM.widthMm + ITEM.heightMm) / 10).toFixed(1) + " cm", RX + 12, 306);

  w98Panel(c, RX, 406, RW, 196, "Product Photo", "마스터 이미지");
  cameraPlaceholder(c, RX + 8, 436, RW - 16, 158, "NO PRODUCT");

  const bw = (RW - 8) / 2;
  ["촬영", "등록"].forEach((t, i) => {
    const x = RX + i * (bw + 8);
    bevelOut(c, x, 612, bw, 82);
    c.font = "800 24px " + KO;
    c.textAlign = "center";
    c.fillStyle = "#3A3A3A";
    c.fillText(t, x + bw / 2, 653);
  });

  /* ── 하단 상태줄 — 3면 카메라 상태 ──
     실제 입고 화면에는 없는 줄이다. 이 방에서만 쓰는 정보(어느 카메라가 찍는 중인지,
     방금 잰 체적)를 여기 모아 둔다. 3D 의 카메라 LED 와 **같은 값**을 본다. */
  const sy = CH - 46;
  bevelIn(c, 6, sy, CW - 12, 40, "#B4B4B4");
  c.textAlign = "left";
  c.font = "700 14px " + KO;
  c.fillStyle = "#22334A";
  c.fillText("3면 비전 측정 · " + live.clock, 18, sy + 20);
  ["TOP", "L-45", "R-45"].forEach((n, i) => {
    const x = 250 + i * 118;
    const on = live.cam === i;
    bevelIn(c, x, sy + 6, 108, 28, on ? "#1E7A34" : "#9A9A9A");
    c.fillStyle = on ? "#8CFFB4" : "#6E6E6E";
    c.beginPath(); c.arc(x + 16, sy + 20, 6, 0, Math.PI * 2); c.fill();
    c.font = "700 14px " + MONO;
    c.fillStyle = on ? "#FFFFFF" : "#4A4A4A";
    c.fillText(n, x + 30, sy + 21);
  });
  c.textAlign = "right";
  c.font = "700 14px " + KO;
  c.fillStyle = "#22334A";
  c.fillText(
    "체적 " + live.volCm3 + " cm³ · 부피중량 " + live.volKg + " kg · " + ITEM.grade + " " + ITEM.gradeName,
    CW - 18, sy + 20,
  );
}

/* ═══════════════════ 컴포넌트 ═══════════════════ */
export default function InspectionRoom({ onExit }) {
  const mountRef = useRef(null);
  const router = useRouter();
  /* 모니터를 누르면 실제 입고 등록 화면으로 넘어간다.
     ★ `<a href>` 가 아니라 라우터를 쓴다. 3D 안의 물체라 링크를 걸 DOM 이 없기도 하고,
       `router.push` 는 클라이언트 전환이라 앱을 새로 내려받지 않는다(뒤로 가기도 된다). */
  const goInboundRef = useRef(null);
  /* onExit 을 ref 로 들고 있는다. 씬 생성 effect 는 한 번만 돌아서, 그 안에서 prop 을
     직접 잡으면 첫 번째 값에 붙박인다. */
  const exitRef = useRef(onExit);
  const [ready, setReady] = useState(false);

  /* ⚠️ 렌더 중에 ref 를 건드리면 안 된다 - 리액트가 화면을 그리는 도중에 바깥 값을
     바꾸는 셈이라, 같은 렌더가 두 번 돌 때(개발 모드의 이중 실행) 결과가 갈린다.
     effect 에 두면 그릴 것을 다 그린 뒤 갱신된다. */
  useEffect(() => { exitRef.current = onExit; }, [onExit]);
  useEffect(() => { goInboundRef.current = () => router.push("/inbound-win98"); }, [router]);

  useEffect(() => {
    const el = mountRef.current;
    if (!el) return;

    const dispose = [];
    let raf = 0;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(W.bg);
    scene.fog = new THREE.Fog(W.bg, 17, 36);

    const camera = new THREE.PerspectiveCamera(46, 1, 0.1, 120);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    el.appendChild(renderer.domElement);
    renderer.domElement.style.display = "block";
    renderer.domElement.style.touchAction = "none";

    buildFloor(scene, dispose);
    buildWalls(scene, dispose);
    buildLights(scene, dispose);
    buildProps(scene, dispose);
    buildIncomingGoods(scene, dispose);
    const rig = buildRig(scene, dispose);
    const mon = buildMonitor(scene, dispose);
    const conv = buildConveyor(scene, dispose);

    /* 배치 — 측정대가 가운데, 모니터는 오른쪽 앞에서 안쪽을 보고,
       컨베이어는 왼쪽에서 측정대 쪽으로 물건을 보낸다 */
    /* 모니터를 측정대 쪽으로 당겼다 (x 3.15 → 2.3, z 0.9 → 1.15).
       ★ 멀리 두면 "방 한쪽에 놓인 다른 장비"로 보인다. 이 화면은 **지금 재고 있는 그 물건의
         결과**를 띄우는 것이라, 측정대 옆에 붙어 있어야 둘이 한 세트로 읽힌다.
       ⚠️ 더 당길 수는 없다. 화면 판이 폭 2m 라 이 위치에서 x 1.48~3.13 을 차지하는데,
          갠트리 기둥이 x = ±0.98 이다. 여기서 0.5m 만 더 붙이면 화면 모서리가 기둥을 파고든다.
       ⚠️ 기본 시점(카메라가 +x·+z 쪽)에서 측정대를 가리지 않는지도 확인했다. 카메라와
          원점을 잇는 선은 이 모니터의 z 높이에서 x ≈ 0.79 를 지나므로 화면 왼쪽 끝(1.48)
          바깥이다 — 가리지 않는다. */
    mon.stand.position.set(2.3, 0, 1.15);
    mon.stand.rotation.y = -0.62;
    /* ★ 컨베이어를 **왼쪽 벽에 붙여 앞까지** 뽑았다. 방 한가운데 3.4m 짜리가 덩그러니
         놓여 있으니 어디서 와서 어디로 가는지가 없어, 라인이 아니라 소품으로 보였다.
         벽을 따라 길게 놓으면 셔터 쪽에서 들어와 앞으로 나간다는 방향이 생긴다.
       ★ 화물 더미(즉석밥·음료)는 측정대 옆에 그대로 둔다. 키가 1.2m 라 앞에 두면 측정대를
         가리는데, 컨베이어는 무릎 높이라 앞을 지나도 아무것도 안 가린다.
       ⚠️ `rotation.y = -π/2` 여야 짐이 **앞쪽(+z)** 으로 흐른다. `+π/2` 로 돌리면 local +x
          가 world −z 로 가서 짐이 셔터 쪽으로 거슬러 올라간다.
       ⚠️ z 는 -1.4 에서 시작한다. 그보다 뒤는 벽에 붙은 복귀 포탈(z ≈ -1.85 ~ -4.15)
          자리라, 더 늘리면 컨베이어가 포탈을 관통한다.
       ⚠️ x = -5.15. 벽 안쪽 면이 -5.83 이고 벨트 폭이 0.78 이니 벽과 0.29m 뜬다 — 붙어
          보이면서 다리가 벽을 뚫지는 않는 자리다. */
    conv.group.position.set(-5.15, 0, 1.4);
    conv.group.rotation.y = -Math.PI / 2;

    /* 돌아가는 작은 포탈 — 왼쪽 벽에 붙인다.
       ⚠️ 벽에 딱 붙이면 흑요석 뒷면이 벽을 뚫는다. 벽 안쪽 면에서 조금 띄운다. */
    const back = createNetherPortal(THREE, {
      position: [-ROOM_W / 2 + 0.3, 0, -3.0],
      rotationY: Math.PI / 2,
      scale: 0.58,
    });
    scene.add(back.group);

    const backLabel = makeLabel("창고로", { color: "#E9D5FF", size: 40, scale: 0.8 });
    backLabel.position.set(-ROOM_W / 2 + 0.7, 2.05, -3.0);
    scene.add(backLabel);
    dispose.push(backLabel.material.map, backLabel.material);

    /* ── 카메라 조작 — 창고 씬과 같은 궤도 방식 ── */
    const HOME = { az: 0.6, pol: 1.16, r: 7.4, tx: 0, ty: 1.15, tz: 0 };
    const cur = { ...HOME }, des = { ...HOME };
    const applyCam = () => {
      camera.position.set(
        cur.tx + cur.r * Math.sin(cur.pol) * Math.sin(cur.az),
        cur.ty + cur.r * Math.cos(cur.pol),
        cur.tz + cur.r * Math.sin(cur.pol) * Math.cos(cur.az),
      );
      camera.lookAt(cur.tx, cur.ty, cur.tz);
    };
    applyCam();

    const ndcOf = (e) => {
      const r = el.getBoundingClientRect();
      return new THREE.Vector2(
        ((e.clientX - r.left) / r.width) * 2 - 1,
        -((e.clientY - r.top) / r.height) * 2 + 1,
      );
    };

    const ptrs = new Map();
    let pinchD = 0, clickInfo = null;
    const ray = new THREE.Raycaster();

    /* 누를 수 있는 것들. 각자 "무엇을 맞히면 무엇을 한다"를 한 줄로 들고 있다.
       ⚠️ 판정 순서가 곧 우선순위다. 모니터가 포탈 앞을 가리는 각도에서는 먼저 적힌 쪽이
          이긴다 - 지금은 서로 멀리 떨어져 있어 부딪히지 않지만, 물건을 옮기면 확인할 것. */
    const clickables = [
      { targets: back.pickTargets, run: () => exitRef.current?.() },
      { targets: mon.pickTargets, run: () => goInboundRef.current?.() },
    ];
    let hovered = null;   // 지금 마우스가 올라와 있는 항목 (없으면 null)

    const hitAt = (e) => {
      ray.setFromCamera(ndcOf(e), camera);
      for (const t of clickables) {
        if (ray.intersectObjects(t.targets, false).length > 0) return t;
      }
      return null;
    };

    const onDown = (e) => {
      ptrs.set(e.pointerId, [e.clientX, e.clientY]);
      el.setPointerCapture(e.pointerId);
      clickInfo = ptrs.size === 1 ? { x: e.clientX, y: e.clientY, t: performance.now() } : null;
    };
    const onMove = (e) => {
      if (!ptrs.has(e.pointerId)) {
        // 끌지 않는 동안에만 누를 수 있는 것 위인지 본다
        const hit = hitAt(e);
        if (hit !== hovered) {
          hovered = hit;
          el.style.cursor = hit ? "pointer" : "";
        }
        return;
      }
      const [lx, ly] = ptrs.get(e.pointerId);
      ptrs.set(e.pointerId, [e.clientX, e.clientY]);
      if (ptrs.size === 1) {
        des.az -= (e.clientX - lx) * 0.0052;
        des.pol = Math.min(1.42, Math.max(0.3, des.pol - (e.clientY - ly) * 0.0042));
      } else if (ptrs.size === 2) {
        const pts = [...ptrs.values()];
        const d = Math.hypot(pts[0][0] - pts[1][0], pts[0][1] - pts[1][1]);
        if (pinchD > 0) des.r = Math.min(14, Math.max(2.6, des.r * (pinchD / d)));
        pinchD = d;
      }
    };
    const onUp = (e) => {
      if (clickInfo && ptrs.size === 1) {
        const dx = e.clientX - clickInfo.x, dy = e.clientY - clickInfo.y;
        if (dx * dx + dy * dy < 36 && performance.now() - clickInfo.t < 450) {
          hitAt(e)?.run();
        }
      }
      clickInfo = null;
      ptrs.delete(e.pointerId);
      if (ptrs.size < 2) pinchD = 0;
    };
    const onWheel = (e) => {
      e.preventDefault();
      des.r = Math.min(14, Math.max(2.6, des.r * (1 + e.deltaY * 0.0011)));
    };
    const onDbl = () => { Object.assign(des, HOME); stop = -1; };

    /* Enter — 이 방에서 볼 것을 차례로 확대한다: 측정기 → 모니터 → 전체.
       ★ 순서가 곧 작업 순서다. 물건을 재고(측정기), 결과를 읽는다(모니터). 한 번 더 누르면
         전체로 돌아와 한 바퀴가 닫힌다 — 키 하나로 끝나야 손이 키보드를 떠나지 않는다.
       ⚠️ Esc 는 쓰지 않는다. 분석 화면이 이 3D 를 전체 화면으로 띄울 때 Esc 로 닫으므로,
          여기서 같은 키를 잡으면 어느 쪽이 이길지가 리스너 순서에 달리게 된다.
       ⚠️ 모니터는 **화면 판에서** 자리와 정면 방향을 뽑는다. 고정 각도를 적어 두면 모니터를
          옮기는 순간(방금도 옮겼다) 카메라가 화면 뒤통수를 본다. */
    let stop = -1;
    const faceOf = (obj, r, pol) => {
      const p = new THREE.Vector3();
      obj.getWorldPosition(p);
      const n = new THREE.Vector3(0, 0, 1)
        .applyQuaternion(obj.getWorldQuaternion(new THREE.Quaternion()));
      des.tx = p.x; des.ty = p.y; des.tz = p.z;
      des.az = Math.atan2(n.x, n.z);
      des.pol = pol;
      des.r = r;
    };
    const STOPS = [
      /* 측정기 — 계량판 위 물건의 눈높이. 정면이랄 게 없는 장비라 기본 시점과 같은 쪽에서
         다가간다(반대편으로 돌아가면 갠트리 뒷면만 보인다) */
      () => {
        /* ★ 눈높이에서 옆으로 보던 것을 **위에서 내려다보는 각**으로 바꿨다. 재는 물건은
             계량판에 납작하게 놓여 있어서, 옆에서 보면 윗면(햇반 뚜껑 인쇄)이 거의 안 보인다.
             내려다보면 물건이 제대로 보이고, 그것을 겨누는 카메라 세 대도 같이 프레임에 든다 —
             "저 카메라들이 이걸 찍고 있다"가 한 장면에 담긴다.
           ⚠️ `pol` 은 위에서 잰 각이다. 작을수록 위에서 본다(0 = 바로 위). 1.16 → 0.86.
           ⚠️ 겨누는 점을 물건보다 조금 올린다. 물건에 딱 맞추면 갠트리 윗부분이 화면 밖으로
              밀려나 카메라가 안 보인다. */
        des.tx = 0; des.ty = rig.plateTop + 0.42; des.tz = 0;
        des.az = 0.6; des.pol = 0.86; des.r = 2.4;
      },
      /* 모니터 — 화면 세로가 시야의 절반쯤을 차지하는 거리.
         ★ 1.7m 에서 2.7m 로 물러났다. 1.7m 에서는 화면이 시야의 8할을 먹어서, 모니터만
           보이고 그게 **어디에 놓인 모니터인지**가 안 보였다. 물러나면 측정대와 방이 같이
           들어와 "재는 자리 옆의 화면"으로 읽힌다.
         ⚠️ 거리를 정하는 계산: 세로 시야각 46도이므로 거리 r 에서 보이는 높이는
            2·r·tan(23°) ≈ 0.85·r 이다. 화면 세로가 1.2m 이니 r = 2.7 이면
            1.2 / (0.85 × 2.7) ≈ 0.52 — 화면이 시야의 절반이다. 더 작게 하려면 r 을 키운다. */
      () => faceOf(mon.screen, 2.7, 1.36),
    ];

    const onKey = (e) => {
      if (e.key !== "Enter") return;
      if (e.target instanceof HTMLElement) {
        const tag = e.target.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "BUTTON" || tag === "SELECT") return;
      }
      e.preventDefault();
      stop += 1;
      if (stop >= STOPS.length) { Object.assign(des, HOME); stop = -1; return; }
      STOPS[stop]();
    };
    window.addEventListener("keydown", onKey);

    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onUp);
    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("dblclick", onDbl);

    /* ⚠️ 폭이 4px 이하면 손대지 않는다. 판이 숨겨져 있을 때 0 으로 리사이즈하면
       렌더러가 깨진다(창고 쪽과 같은 이유). */
    const resize = () => {
      const w = el.clientWidth, h = el.clientHeight;
      if (w <= 4 || h <= 4) return;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(el);

    /* 측정값이 아주 조금씩 흔들리게 둔다. 완전히 고정된 숫자는 "화면 캡처"처럼 보이고,
       크게 흔들리면 "고장난 저울"처럼 보인다. ±1mm / ±0.1kg 이 적당하다. */
    const live = {
      clock: "--:--:--",
      length: ITEM.lengthMm, width: ITEM.widthMm, height: ITEM.heightMm,
      realKg: ITEM.realKg.toFixed(1), volKg: ITEM.volKg.toFixed(1),
      volCm3: ITEM.volCm3.toLocaleString("en-US"),
      cam: 0,
    };
    let lastDraw = -1, lastJitter = -1;
    const jitter = (base, amp) => base + Math.round((Math.random() * 2 - 1) * amp);

    const LED_ON = new THREE.Color(0x54ef9a);
    const LED_OFF = new THREE.Color(0x1f4a34);

    const clock = new THREE.Clock();
    let elapsed = 0;

    const tick = () => {
      const dt = Math.min(0.05, clock.getDelta());
      elapsed += dt;

      /* 세 대가 차례로 찍는다 — TOP → L-45 → R-45, 0.55초씩.
         ★ 이게 이 장비의 유일한 '작동 중' 신호다. 광선을 없앤 자리를 이 리듬이 대신한다.
           눈에 띄되 방을 물들이지 않는다는 점이 광선과 다르다. */
      const camIdx = Math.floor((elapsed / 0.55) % 3);
      if (camIdx !== live.cam) {
        live.cam = camIdx;
        rig.cams.forEach((c, i) => c.led.material.color.copy(i === camIdx ? LED_ON : LED_OFF));
      }

      // 계량판 테두리가 아주 느리게 숨쉰다
      rig.plateEdge.material.color.setHSL(0.56, 0.62, 0.5 + 0.08 * Math.sin(elapsed * 1.6));

      /* 벨트 — 롤러가 돌고 짐이 그 위를 흐른다.
         ⚠️ 롤러 회전 속도와 짐의 속도는 **같은 값에서 나와야** 한다. 따로 적으면 짐이
            롤러 위를 미끄러지는 것처럼 보인다. 반지름 0.055m 이므로 각속도 = v / r. */
      const beltV = 0.34;                        // m/s — "천천히"
      for (const r of conv.rollers) r.rotation.z += (beltV / 0.055) * dt;
      for (const b of conv.boxes) {
        b.position.x += beltV * dt;
        /* 끝에 닿으면 반대쪽 끝에서 다시 들어온다. 짐이 사라졌다 나타나는 것이 아니라
           라인이 계속 돌고 있는 것으로 읽히도록, 넘기는 자리를 화면 밖(벨트 끝 너머)에 둔다 */
        if (b.position.x > conv.len / 2 + 0.4) b.position.x = -conv.len / 2 - 0.4;
      }

      back.update(dt, hovered?.targets === back.pickTargets);

      /* 모니터 테두리 - 마우스가 올라오면 진해지고 천천히 숨쉰다.
         3D 안의 물체는 CSS 의 `:hover` 가 없으니, 누를 수 있다는 걸 이렇게 알린다. */
      const monHot = hovered?.targets === mon.pickTargets;
      const want = monHot ? 0.85 + 0.15 * Math.sin(elapsed * 5) : 0.3;
      mon.glow.material.opacity += (want - mon.glow.material.opacity) * 0.18;
      mon.hint.material.opacity = monHot ? 1 : 0.55;

      /* 화면은 초당 4번만 다시 그린다 (위 주석 참고) */
      if (elapsed - lastDraw > 0.25) {
        lastDraw = elapsed;
        const d = new Date();
        const p2 = (n) => String(n).padStart(2, "0");
        live.clock = `${p2(d.getHours())}:${p2(d.getMinutes())}:${p2(d.getSeconds())}`;
        if (elapsed - lastJitter > 1.4) {
          lastJitter = elapsed;
          live.length = jitter(ITEM.lengthMm, 1);
          live.width = jitter(ITEM.widthMm, 1);
          live.height = jitter(ITEM.heightMm, 1);
          live.realKg = (ITEM.realKg + (Math.random() * 2 - 1) * 0.08).toFixed(1);
          live.volKg = (ITEM.volKg + (Math.random() * 2 - 1) * 0.08).toFixed(1);
          live.volCm3 = Math.round(live.length * live.width * live.height * 0.001)
            .toLocaleString("en-US");
        }
        drawInboundScreen(mon.ctx, mon.canvas.width, mon.canvas.height, live);
        mon.tex.needsUpdate = true;
      }

      cur.az += (des.az - cur.az) * 0.1;
      cur.pol += (des.pol - cur.pol) * 0.1;
      cur.r += (des.r - cur.r) * 0.1;
      cur.tx += (des.tx - cur.tx) * 0.1;
      cur.ty += (des.ty - cur.ty) * 0.1;
      cur.tz += (des.tz - cur.tz) * 0.1;
      applyCam();

      renderer.render(scene, camera);
      raf = requestAnimationFrame(tick);
    };
    tick();
    setReady(true);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", onUp);
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("dblclick", onDbl);
      window.removeEventListener("keydown", onKey);
      back.dispose();
      for (const d of dispose) d?.dispose?.();
      renderer.dispose();
      if (renderer.domElement.parentNode === el) el.removeChild(renderer.domElement);
    };
  }, []);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%", background: "#161E28", overflow: "hidden" }}>
      <div ref={mountRef} style={{ position: "absolute", inset: 0 }} />

      {/* 돌아가기 — 3D 안의 작은 포탈을 못 찾는 사람을 위한 확실한 출구 */}
      <button
        type="button"
        onClick={() => onExit?.()}
        style={{
          position: "absolute", left: 14, top: 14, zIndex: 5,
          padding: "9px 15px", cursor: "pointer",
          background: "rgba(26,15,46,0.9)", border: "1px solid #B04DFF",
          borderRadius: 3, color: "#E9D5FF", fontSize: 13.5, fontWeight: 800,
          fontFamily: "'Malgun Gothic', '맑은 고딕', sans-serif",
          boxShadow: "0 0 12px rgba(176,77,255,0.45)",
        }}
      >
        ← 창고로 돌아가기
      </button>

      <div
        style={{
          position: "absolute", left: 14, top: 58, zIndex: 5,
          color: "#8FA6BD", fontSize: 12, fontWeight: 700, lineHeight: 1.65,
          fontFamily: "'Malgun Gothic', '맑은 고딕', sans-serif",
          textShadow: "0 1px 3px rgba(0,0,0,0.8)", pointerEvents: "none",
          opacity: ready ? 1 : 0, transition: "opacity 400ms ease",
        }}
      >
        신규 물품 입고 검수실 · 3면 비전 체적 측정
        <br />
        <span style={{ color: "#5E7A96", fontWeight: 400 }}>
          <b style={{ color: "#FFC978" }}>Enter → 측정기 · 모니터 확대</b>
          <br />
          드래그 회전 · 스크롤 확대 · 더블클릭 전체 보기 · 벽면 포탈 클릭 시 창고로
        </span>
      </div>
    </div>
  );
}
