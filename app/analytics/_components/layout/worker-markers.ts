/**
 * 작업자 마커 — 브리프 §2 "작업자 마커(작업자별 1개, 라벨 코드)…마커·점등은
 * `InstancedMesh`·`Sprite`로 — 작업자 60명·이벤트 초당 수십 건에서 60fps". 몸통은
 * `InstancedMesh` 하나(색만 바뀌는 원뿔), 코드 라벨은 작업자마다 `Sprite` 하나(캔버스
 * 텍스트 텍스처) — 60개 정도면 개별 Sprite 로도 충분히 싸다.
 */

import * as THREE from "three";
import type { PathPoint } from "./worker-path";
import { pointAlongPath } from "./worker-path";

const MAX_WORKERS = 64; // 브리프 "작업자 60명" + 여유
const MARKER_HEIGHT_M = 1.7; // 사람 눈높이 근사(연출)
const LABEL_OFFSET_M = 0.5;

export interface WorkerTransition {
  code: string;
  path: PathPoint[];
  startedAt: number;
  durationMs: number;
}

export interface WorkerMarkers {
  group: THREE.Group;
  setTransition: (transition: WorkerTransition) => void;
  tick: (nowMs: number) => void;
  dispose: () => void;
}

export function buildWorkerMarkers(): WorkerMarkers {
  const geometry = new THREE.ConeGeometry(0.32, 0.9, 8);
  const material = new THREE.MeshStandardMaterial({ roughness: 0.4, metalness: 0.1 });
  const mesh = new THREE.InstancedMesh(geometry, material, MAX_WORKERS);
  mesh.count = 0;
  mesh.name = "worker-markers";

  const group = new THREE.Group();
  group.name = "worker-overlay";
  group.add(mesh);

  const codeToSlot = new Map<string, number>();
  const transitions = new Map<string, WorkerTransition>();
  const labels = new Map<string, THREE.Sprite>();
  const m = new THREE.Matrix4();
  const color = new THREE.Color();

  const slotFor = (code: string): number => {
    const existing = codeToSlot.get(code);
    if (existing !== undefined) return existing;
    const slot = codeToSlot.size;
    codeToSlot.set(code, slot);
    color.setHSL((hashCode(code) % 360) / 360, 0.6, 0.58);
    mesh.setColorAt(slot, color);
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.count = codeToSlot.size;

    const sprite = makeLabelSprite(code);
    labels.set(code, sprite);
    group.add(sprite);
    return slot;
  };

  const setTransition: WorkerMarkers["setTransition"] = (transition) => {
    if (codeToSlot.size >= MAX_WORKERS && !codeToSlot.has(transition.code)) return;
    slotFor(transition.code);
    transitions.set(transition.code, transition);
  };

  const tick: WorkerMarkers["tick"] = (nowMs) => {
    let dirty = false;
    transitions.forEach((transition, code) => {
      const slot = codeToSlot.get(code);
      if (slot === undefined || transition.path.length === 0) return;
      const progress = (nowMs - transition.startedAt) / Math.max(1, transition.durationMs);
      const point = pointAlongPath(transition.path, progress);
      m.compose(
        new THREE.Vector3(point.x, MARKER_HEIGHT_M / 2, point.y),
        new THREE.Quaternion(),
        new THREE.Vector3(1, 1, 1),
      );
      mesh.setMatrixAt(slot, m);
      const label = labels.get(code);
      if (label) label.position.set(point.x, MARKER_HEIGHT_M + LABEL_OFFSET_M, point.y);
      dirty = true;
    });
    if (dirty) mesh.instanceMatrix.needsUpdate = true;
  };

  return {
    group,
    setTransition,
    tick,
    dispose: () => {
      geometry.dispose();
      material.dispose();
      labels.forEach((sprite) => {
        sprite.material.map?.dispose();
        sprite.material.dispose();
      });
    },
  };
}

function makeLabelSprite(text: string): THREE.Sprite {
  const canvas = document.createElement("canvas");
  canvas.width = 160;
  canvas.height = 48;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.fillStyle = "rgba(10,14,20,0.78)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.font = "bold 26px monospace";
    ctx.fillStyle = "#FFC978";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, canvas.width / 2, canvas.height / 2);
  }
  const texture = new THREE.CanvasTexture(canvas);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthTest: false, transparent: true }));
  sprite.scale.set(1.3, 0.4, 1);
  return sprite;
}

function hashCode(text: string): number {
  let hash = 0;
  for (let i = 0; i < text.length; i++) hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
  return hash;
}
