/**
 * 베이 블록 — 브리프 §2 "베이 블록은 `InstancedMesh` 하나"(≈1,000개). 색은 점유율
 * (occupiedBins/totalBins) 5단계(`layout-geometry.ts` `occupancyTier`). 선택된 베이만
 * `buildExpandedBins` 로 칸(Position) 메시를 편다(≤ 20개, 개별 메시로 충분한 규모).
 */

import * as THREE from "three";
import type { Bay, Bin } from "@/lib/types";
import { bayBox, type LayoutIndex, OCCUPANCY_COLORS, occupancyTier } from "./layout-geometry";

const HIGHLIGHT_TINT = 0xff8a2a;
const DIM_OPACITY = 0.28;

export interface BayInstanceMesh {
  mesh: THREE.InstancedMesh;
  /** instanceId → bay. 클릭·호버 판정이 이 배열 순서에 그대로 의존한다 */
  order: Bay[];
}

/** 모든 베이를 담는 InstancedMesh 하나. 각 인스턴스는 자기 박스 치수로 스케일된 단위
 * 큐브다(BoxGeometry(1,1,1) 을 setMatrixAt 의 scale 로 늘린다 — geometry 를 베이마다
 * 새로 만들면 InstancedMesh 를 쓰는 의미가 없다) */
export function buildBayInstances(bays: Bay[], index: LayoutIndex): BayInstanceMesh | null {
  const boxes = bays.map((bay) => bayBox(bay, index)).filter((b): b is NonNullable<typeof b> => b !== null);
  if (boxes.length === 0) return null;

  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.05 });
  const mesh = new THREE.InstancedMesh(geometry, material, boxes.length);
  mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(boxes.length * 3), 3);
  mesh.name = "bay-instances";

  const m = new THREE.Matrix4();
  const color = new THREE.Color();
  const order: Bay[] = [];
  boxes.forEach((box, i) => {
    m.compose(
      new THREE.Vector3(box.cx, box.height / 2, box.cy),
      new THREE.Quaternion(),
      new THREE.Vector3(box.width, box.height, box.depth),
    );
    mesh.setMatrixAt(i, m);
    color.setHex(OCCUPANCY_COLORS[occupancyTier(box.occupancyRatio)]);
    mesh.setColorAt(i, color);
    order.push(box.bay);
  });
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;

  return { mesh, order };
}

/** 존 강조 — 그 존 소속 베이만 원색, 나머지는 어둡게(setHighlight(null) 이면 전부 원색) */
export function applyZoneHighlight(bim: BayInstanceMesh, index: LayoutIndex, zoneCode: string | null): void {
  const color = new THREE.Color();
  bim.order.forEach((bay, i) => {
    const box = bayBox(bay, index);
    if (!box) return;
    const base = OCCUPANCY_COLORS[occupancyTier(box.occupancyRatio)];
    const aisle = index.aisleById.get(bay.aisleId);
    const belongs = zoneCode === null || aisle?.zoneCode === zoneCode;
    color.setHex(base);
    if (!belongs) color.multiplyScalar(DIM_OPACITY);
    else if (zoneCode !== null) color.lerp(new THREE.Color(HIGHLIGHT_TINT), 0.35);
    bim.mesh.setColorAt(i, color);
  });
  if (bim.mesh.instanceColor) bim.mesh.instanceColor.needsUpdate = true;
}

/** 선택된 베이 하나의 칸(Position) 메시 — role 별 테두리 색, 비어 있으면 회색(브리프 §2
 * "role별 테두리, 비어 있으면 회색") */
export function buildExpandedBins(bay: Bay, bins: Bin[], index: LayoutIndex): THREE.Group | null {
  const box = bayBox(bay, index);
  if (!box) return null;

  const group = new THREE.Group();
  group.name = "expanded-bins";
  const cellW = box.width / bay.positions;
  const cellH = box.height / bay.levels;
  const geometry = new THREE.BoxGeometry(cellW * 0.86, cellH * 0.8, box.depth * 0.86);

  for (const bin of bins) {
    const filled = bin.qty > 0;
    const color = filled ? (bin.role === "PICK_FACE" ? 0x3d9e7a : 0x3d6fa3) : 0x555f6c;
    const mesh = new THREE.Mesh(
      geometry,
      new THREE.MeshStandardMaterial({ color, roughness: 0.5, transparent: !filled, opacity: filled ? 1 : 0.45 }),
    );
    const x = box.cx - box.width / 2 + cellW * (bin.positionNo - 0.5);
    const y = cellH * (bin.levelNo - 0.5);
    mesh.position.set(x, y, box.cy);
    mesh.userData.bin = bin;
    group.add(mesh);

    const edge = new THREE.LineSegments(
      new THREE.EdgesGeometry(geometry),
      new THREE.LineBasicMaterial({ color: bin.role === "PICK_FACE" ? 0x5fe0b0 : 0x6fb0ff }),
    );
    edge.position.copy(mesh.position);
    group.add(edge);
  }

  return group;
}
