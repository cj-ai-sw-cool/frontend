/**
 * 베이 점등 — 브리프 §2 "베이 점등(유형별 색 1.5초 페이드 — PICK 주황·PUTAWAY 녹·SHIP
 * 파랑·ADJUST 빨강·TRANSFER 보라)". 고정 크기 `InstancedMesh` 링버퍼 하나로 만든다 —
 * 매번 새 메시를 만들지 않고, 슬롯을 순환해 재사용한다(성능, 브리프 §2 "60fps").
 *
 * 슬롯 인덱스는 절대 배열에서 빼지 않는다(끝난 자리는 `null`로만 표시) — 배열에서
 * 빼면 `InstancedMesh`의 인스턴스 번호와 슬롯이 어긋난다.
 */

import * as THREE from "three";
import type { Bay, InventoryTxType } from "@/lib/types";
import { bayBox, type LayoutIndex } from "./layout-geometry";

/** 정본 §13.2 tx 유형 10종 중 3D 점등 색이 있는 것(브리프 §2) + 나머지는 근접 계열로 보충 */
export const TX_TYPE_COLORS: Record<InventoryTxType, number> = {
  PICK: 0xff8a2a, // 주황
  PUTAWAY: 0x3d9e7a, // 녹
  SHIP: 0x3d6fa3, // 파랑
  ADJUST: 0xc23b3b, // 빨강
  TRANSFER_OUT: 0x9a5fd9, // 보라
  TRANSFER_IN: 0x9a5fd9, // 보라
  RECEIVE: 0x3d9e7a, // 브리프 미지정 — 입고라 PUTAWAY 와 같은 녹 계열
  REBIN: 0xe0c23a, // 브리프 미지정 — 보관 재배치, PUTAWAY 와 구분되는 노랑
  RESTOCK: 0x3d9e7a,
  STATUS_CHANGE: 0x8fa3b8,
};

const MAX_ACTIVE = 96;
const PULSE_DURATION_MS = 1500;
const BACKGROUND_HEX = 0x10151c; // layout-scene.tsx 의 scene.background 와 같은 값

interface Slot {
  startedAt: number;
  baseColor: THREE.Color;
  cx: number;
  cy: number;
  height: number;
  width: number;
  depth: number;
}

export interface BayPulse {
  group: THREE.Group;
  pulse: (bay: Bay, index: LayoutIndex, colorHex: number, atMs: number) => void;
  tick: (nowMs: number) => void;
  dispose: () => void;
}

export function buildBayPulse(): BayPulse {
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const material = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.5, depthWrite: false });
  const mesh = new THREE.InstancedMesh(geometry, material, MAX_ACTIVE);
  mesh.count = MAX_ACTIVE;
  mesh.name = "bay-pulse";

  const group = new THREE.Group();
  group.name = "bay-pulse-overlay";
  group.add(mesh);

  const slots: (Slot | null)[] = new Array(MAX_ACTIVE).fill(null);
  let nextSlot = 0;
  const m = new THREE.Matrix4();
  const color = new THREE.Color();
  const hidden = new THREE.Vector3(0, 0, 0);

  const pulse: BayPulse["pulse"] = (bay, index, colorHex, atMs) => {
    const box = bayBox(bay, index);
    if (!box) return;
    const slot = nextSlot;
    nextSlot = (nextSlot + 1) % MAX_ACTIVE;
    slots[slot] = {
      startedAt: atMs,
      baseColor: new THREE.Color(colorHex),
      cx: box.cx,
      cy: box.cy,
      height: box.height,
      width: box.width,
      depth: box.depth,
    };
  };

  const tick: BayPulse["tick"] = (nowMs) => {
    slots.forEach((slot, i) => {
      if (!slot) return;
      const t = Math.max(0, Math.min(1, (nowMs - slot.startedAt) / PULSE_DURATION_MS));
      if (t >= 1) {
        slots[i] = null;
        m.compose(new THREE.Vector3(0, -1000, 0), new THREE.Quaternion(), hidden);
        mesh.setMatrixAt(i, m);
        return;
      }
      const scaleUp = 1 + 0.15 * (1 - t);
      m.compose(
        new THREE.Vector3(slot.cx, slot.height / 2, slot.cy),
        new THREE.Quaternion(),
        new THREE.Vector3(slot.width * scaleUp, slot.height * scaleUp, slot.depth * scaleUp),
      );
      mesh.setMatrixAt(i, m);
      color.copy(slot.baseColor).lerp(new THREE.Color(BACKGROUND_HEX), t);
      mesh.setColorAt(i, color);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  };

  return {
    group,
    pulse,
    tick,
    dispose: () => {
      geometry.dispose();
      material.dispose();
    },
  };
}
