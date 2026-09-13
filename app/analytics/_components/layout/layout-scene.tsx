"use client";

/**
 * 3D 씬 마운트 — 카메라·조명·렌더 루프·호버(레이캐스트)·클릭. 정적 방/존/통로는
 * `area-mesh.ts`, 베이 블록(InstancedMesh 하나)과 칸 펼침은 `bay-mesh.ts` 가 만든다.
 * 이 파일은 그 둘을 무대에 올리고 카메라·상호작용만 맡는다(300줄 상한, 브리프 §2).
 *
 * `warehouse-slot-3d.jsx`(2,348줄, 존 7개 두 줄 배치)의 후계 — 카메라 조작(드래그 회전·
 * 휠 줌)은 같은 손맛을 유지하려 했으나, 새로 짜는 김에 직접 구현 대신 검증된
 * `OrbitControls`(three/examples)를 쓴다 — 300줄 예산 안에서 포인터·핀치·관성까지
 * 손으로 재구현하면 이 파일 하나가 옛 파일만큼 커진다.
 */

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { Bay, Bin, LayoutResponse } from "@/lib/types";
import { buildStaticGroup } from "./area-mesh";
import { applyZoneHighlight, type BayInstanceMesh, buildBayInstances, buildExpandedBins } from "./bay-mesh";
import { bayDisplayCode, buildLayoutIndex, layoutBounds } from "./layout-geometry";

export interface LayoutSceneApi {
  setHighlight: (zoneCode: string | null) => void;
  flyTo: (zoneCode: string) => void;
  resetView: () => void;
}

interface LayoutSceneProps {
  layout: LayoutResponse;
  selectedBay: Bay | null;
  selectedBins: Bin[] | undefined;
  onHoverBay: (bay: Bay | null) => void;
  onSelectBay: (bay: Bay | null) => void;
  onReady?: (api: LayoutSceneApi) => void;
  initialHighlight?: string | null;
}

export function LayoutScene({
  layout,
  selectedBay,
  selectedBins,
  onHoverBay,
  onSelectBay,
  onReady,
  initialHighlight = null,
}: LayoutSceneProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const expandedGroupRef = useRef<THREE.Group | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const bimRef = useRef<BayInstanceMesh | null>(null);

  /* ── 씬 구성 — layout 이 바뀌지 않는 한(사실상 마운트 1회) ── */
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;

    const index = buildLayoutIndex(layout);
    const bounds = layoutBounds(layout);
    const centerX = (bounds.x0 + bounds.x1) / 2;
    const centerZ = (bounds.y0 + bounds.y1) / 2;
    const spanM = Math.max(bounds.x1 - bounds.x0, bounds.y1 - bounds.y0);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x10151c);
    scene.fog = new THREE.Fog(0x10151c, spanM * 0.9, spanM * 2.6);
    sceneRef.current = scene;

    scene.add(buildStaticGroup(layout, index));
    const bim = buildBayInstances(layout.bays, index);
    if (bim) {
      scene.add(bim.mesh);
      bimRef.current = bim;
    }

    scene.add(new THREE.HemisphereLight(0xcfe0ff, 0x1a1f28, 0.9));
    const sun = new THREE.DirectionalLight(0xffffff, 1.1);
    sun.position.set(centerX + spanM * 0.4, spanM * 0.7, centerZ + spanM * 0.3);
    scene.add(sun);

    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, spanM * 6);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    wrap.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.maxPolarAngle = Math.PI / 2.02;
    controls.minDistance = spanM * 0.08;
    controls.maxDistance = spanM * 1.6;

    const setTarget = (x: number, z: number, radius: number, elevation = 0.5) => {
      controls.target.set(x, elevation, z);
      const dir = camera.position.clone().sub(controls.target).normalize();
      camera.position.copy(controls.target).addScaledVector(dir, radius);
    };
    const overview = () => setTarget(centerX, centerZ, spanM * 0.95, spanM * 0.02);
    camera.position.set(centerX, spanM * 0.6, centerZ + spanM * 0.9);
    overview();

    /* ── 리사이즈 ── */
    const fit = () => {
      const w = Math.max(10, wrap.clientWidth);
      const h = Math.max(10, wrap.clientHeight);
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(wrap);

    /* ── 호버·클릭 ── */
    const ray = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let hovered: number | null = null;

    const pickBay = (clientX: number, clientY: number): { bay: Bay; instanceId: number } | null => {
      if (!bimRef.current) return null;
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
      ray.setFromCamera(pointer, camera);
      const hits = ray.intersectObject(bimRef.current.mesh);
      const hit = hits[0];
      if (!hit || hit.instanceId === undefined) return null;
      return { bay: bimRef.current.order[hit.instanceId], instanceId: hit.instanceId };
    };

    const onMove = (e: PointerEvent) => {
      const hit = pickBay(e.clientX, e.clientY);
      const tip = tooltipRef.current;
      if (hit) {
        hovered = hit.instanceId;
        onHoverBay(hit.bay);
        if (tip) {
          tip.hidden = false;
          tip.style.left = `${e.clientX - rect0(wrap).left + 14}px`;
          tip.style.top = `${e.clientY - rect0(wrap).top + 14}px`;
          tip.textContent = `${bayDisplayCode(hit.bay, index)} · ${hit.bay.binType} · ${hit.bay.occupiedBins}/${hit.bay.totalBins}`;
        }
      } else if (hovered !== null) {
        hovered = null;
        onHoverBay(null);
        if (tip) tip.hidden = true;
      }
    };
    const onClick = (e: MouseEvent) => {
      const hit = pickBay(e.clientX, e.clientY);
      onSelectBay(hit?.bay ?? null);
    };
    renderer.domElement.addEventListener("pointermove", onMove);
    renderer.domElement.addEventListener("click", onClick);

    /* ── API ── */
    const setHighlight = (zoneCode: string | null) => {
      if (bimRef.current) applyZoneHighlight(bimRef.current, index, zoneCode);
    };
    const flyTo = (zoneCode: string) => {
      const zone = index.zoneByCode.get(zoneCode);
      const area = zone ? index.areaByCode.get(zone.areaCode) : null;
      if (!zone || !area) return;
      const zx = area.xM + zone.xM + zone.wM / 2;
      const zz = area.yM + zone.yM + zone.dM / 2;
      setTarget(zx, zz, Math.max(zone.wM, zone.dM) * 1.4, 1.2);
    };
    onReady?.({ setHighlight, flyTo, resetView: overview });
    if (initialHighlight) {
      setHighlight(initialHighlight);
      flyTo(initialHighlight);
    }

    let raf = 0;
    const tick = () => {
      controls.update();
      renderer.render(scene, camera);
      raf = requestAnimationFrame(tick);
    };
    tick();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      renderer.domElement.removeEventListener("pointermove", onMove);
      renderer.domElement.removeEventListener("click", onClick);
      controls.dispose();
      renderer.dispose();
      wrap.removeChild(renderer.domElement);
      sceneRef.current = null;
      bimRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout]);

  /* ── 선택된 베이의 칸 펼침 — 씬 재구성 없이 그룹만 교체 ── */
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    if (expandedGroupRef.current) {
      scene.remove(expandedGroupRef.current);
      expandedGroupRef.current = null;
    }
    if (selectedBay && selectedBins) {
      const index = buildLayoutIndex(layout);
      const group = buildExpandedBins(selectedBay, selectedBins, index);
      if (group) {
        scene.add(group);
        expandedGroupRef.current = group;
      }
    }
  }, [layout, selectedBay, selectedBins]);

  return (
    <div ref={wrapRef} className="relative h-full w-full">
      <div
        ref={tooltipRef}
        hidden
        className="pointer-events-none absolute z-10 rounded border border-[rgba(150,180,215,.35)] bg-[rgba(12,17,24,.9)] px-2 py-1 text-xs font-bold text-[#DCE5EF]"
      />
    </div>
  );
}

function rect0(el: HTMLElement): DOMRect {
  return el.getBoundingClientRect();
}
