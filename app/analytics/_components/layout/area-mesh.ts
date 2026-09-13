/**
 * Area·Zone·Aisle 정적 메시 — 바닥판(방)·구획선(존)·차선(통로). 브리프 §2 "Area마다
 * 바닥판(종류별 색·이름 라벨), 냉장실·냉동실은 벽(반투명)으로 닫힌 방". 베이는 수가
 * 많아(≈1,000) 여기서 만들지 않는다(`bay-mesh.ts`, InstancedMesh 하나).
 *
 * three.js 는 CSS 변수를 못 읽으므로(캔버스 렌더 API), 이 파일의 색은 숫자 16진수다 —
 * 기존 `lib/zone-layout.ts`(AMBIENT_COLOR_STEPS 등)와 같은 관례다.
 */

import * as THREE from "three";
import type { Area, LayoutResponse } from "@/lib/types";
import { zoneWorldRect } from "./layout-geometry";

const AREA_COLOR: Record<Area["kind"], number> = {
  STORAGE: 0x3a4656,
  RECEIVING: 0x4a5a3a,
  PACKING: 0x5a4a2e,
  RETURNS: 0x5a3a3a,
};
const COLD_TINT: Record<"CHILLED" | "FROZEN", number> = {
  CHILLED: 0x1f6b70,
  FROZEN: 0x1a4a6b,
};
const WALL_HEIGHT_M = 3.2;

/** 방 바닥판 하나(색은 kind, 냉장·냉동은 온도 계열로 덮어쓴다) + 냉장·냉동은 반투명 벽 4면 */
function buildAreaGroup(area: Area): THREE.Group {
  const group = new THREE.Group();
  group.name = `area:${area.code}`;

  const isCold = area.tempZone === "CHILLED" || area.tempZone === "FROZEN";
  const color = isCold ? COLD_TINT[area.tempZone as "CHILLED" | "FROZEN"] : AREA_COLOR[area.kind];

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(area.wM, area.dM),
    new THREE.MeshStandardMaterial({ color, roughness: 0.92, metalness: 0 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(area.xM + area.wM / 2, 0, area.yM + area.dM / 2);
  floor.receiveShadow = true;
  floor.userData.areaCode = area.code;
  group.add(floor);

  const edge = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.PlaneGeometry(area.wM, area.dM)),
    new THREE.LineBasicMaterial({ color: 0x0c1118, transparent: true, opacity: 0.6 }),
  );
  edge.rotation.x = -Math.PI / 2;
  edge.position.copy(floor.position);
  edge.position.y = 0.01;
  group.add(edge);

  if (isCold) {
    const wallMat = new THREE.MeshStandardMaterial({
      color,
      transparent: true,
      opacity: 0.22,
      side: THREE.DoubleSide,
      roughness: 0.4,
    });
    const cx = area.xM + area.wM / 2;
    const cz = area.yM + area.dM / 2;
    const walls: [number, number, number, number, number][] = [
      [cx, WALL_HEIGHT_M / 2, area.yM, area.wM, 0],
      [cx, WALL_HEIGHT_M / 2, area.yM + area.dM, area.wM, 0],
      [area.xM, WALL_HEIGHT_M / 2, cz, area.dM, Math.PI / 2],
      [area.xM + area.wM, WALL_HEIGHT_M / 2, cz, area.dM, Math.PI / 2],
    ];
    for (const [x, y, z, len, rotY] of walls) {
      const wall = new THREE.Mesh(new THREE.PlaneGeometry(len, WALL_HEIGHT_M), wallMat);
      wall.position.set(x, y, z);
      wall.rotation.y = rotY;
      wall.userData.wall = true;
      group.add(wall);
    }
  }

  return group;
}

/** 존 구획선 — 베이 배치를 눈으로 묶어 보이게 하는 얇은 사각 테두리(브리프 §2 "Zone
 * 사각형 안에") */
function buildZoneOutline(rect: { x0: number; y0: number; x1: number; y1: number }): THREE.LineSegments {
  const w = rect.x1 - rect.x0;
  const d = rect.y1 - rect.y0;
  const line = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.PlaneGeometry(w, d)),
    new THREE.LineDashedMaterial({ color: 0x8fa3b8, dashSize: 0.25, gapSize: 0.15, transparent: true, opacity: 0.55 }),
  );
  line.computeLineDistances();
  line.rotation.x = -Math.PI / 2;
  line.position.set(rect.x0 + w / 2, 0.02, rect.y0 + d / 2);
  return line;
}

/** 통로 중심선 — 서펜타인 방향을 화살표 색(FORWARD/REVERSE)으로 구분한다 */
/* ⚠️ 통로는 X축을 따라 뻗는다(라이브 데이터로 확인 — `bay.no` 가 커질수록 `xM` 이
 * 늘어난다, layout-geometry.ts 머리말). 예전엔 Y축이라고 가정해 세로선을 그었다. */
function buildAisleLine(x0: number, y0: number, lengthM: number, forward: boolean): THREE.Line {
  const points = [new THREE.Vector3(x0, 0.03, y0), new THREE.Vector3(x0 + lengthM, 0.03, y0)];
  const line = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(points),
    new THREE.LineBasicMaterial({ color: forward ? 0xff8a2a : 0xffd166, transparent: true, opacity: 0.85 }),
  );
  return line;
}

/* area·존·통로가 이제 전역 좌표라(layout-geometry.ts 머리말) `LayoutIndex` 역참조가
 * 필요 없다 — 베이만 존을 거쳐 매체를 찾는다(bay-mesh.ts). */
export function buildStaticGroup(layout: LayoutResponse): THREE.Group {
  const root = new THREE.Group();
  root.name = "layout-static";

  for (const area of layout.areas) root.add(buildAreaGroup(area));

  for (const zone of layout.zones) {
    root.add(buildZoneOutline(zoneWorldRect(zone)));
  }

  for (const aisle of layout.aisles) {
    root.add(buildAisleLine(aisle.xM, aisle.yM, aisle.lengthM, aisle.direction === "FORWARD"));
  }

  return root;
}
