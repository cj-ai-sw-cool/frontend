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
import { buildAreaLabels, buildStaticGroup } from "./area-mesh";
import { applyZoneHighlight, type BayInstanceMesh, buildBayInstances, buildExpandedBins } from "./bay-mesh";
import { buildControlOverlay, type ControlOverlay } from "./control-overlay";
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
  /** 관제 모드(브리프 §2, S11A.4) — 켜면 베이 점등·작업자 마커 오버레이를 씬에 얹는다 */
  controlMode?: boolean;
  onControlReady?: (api: ControlOverlay | null) => void;
}

export function LayoutScene({
  layout,
  selectedBay,
  selectedBins,
  onHoverBay,
  onSelectBay,
  onReady,
  initialHighlight = null,
  controlMode = false,
  onControlReady,
}: LayoutSceneProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const labelsLayerRef = useRef<HTMLDivElement>(null);
  const expandedGroupRef = useRef<THREE.Group | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const bimRef = useRef<BayInstanceMesh | null>(null);
  const controlRef = useRef<ControlOverlay | null>(null);

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
    /* 안개(Fog)는 넣지 않는다 — 화면 체크에 필요 없는 장식이고, 오버뷰 카메라 거리와
       근접 거리가 겹치기 쉬워 튜닝 없이 넣으면 베이 블록이 배경색에 묻힌다
       (베이가 검게 나오던 실제 원인은 따로 있었다 — `bay-mesh.ts` 머리말 참고). */
    sceneRef.current = scene;

    scene.add(buildStaticGroup(layout));
    const labels = labelsLayerRef.current ? buildAreaLabels(labelsLayerRef.current, layout.areas) : null;
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

    const setTarget = (x: number, z: number, radius: number, elevation = 0.5) => {
      controls.target.set(x, elevation, z);
      const dir = camera.position.clone().sub(controls.target).normalize();
      camera.position.copy(controls.target).addScaledVector(dir, radius);
    };
    /* 오버뷰 반경 — footprint(가로·세로) 뿐 아니라 베이 높이(파렛트 5단×1.5m=7.5m 까지)
       까지 담는 구(sphere)를 하나 씌우고, 그 구가 화면(FOV·가로세로비)에 꽉 차는
       거리를 역산한다. spanM(가로·세로 중 큰 쪽)만 보던 예전 방식은 카메라가 기울어
       있어(위→아래를 그대로 안 본다) 안전 마진이 없었다 — 존이 area 를 벗어나던 시절엔
       안 드러났지만, 포함 관계가 고쳐져 랙이 방 안 제자리에 서자 앞쪽 파렛트 랙이
       화면을 가득 채우고 나머지 방이 잘려 나갔다(2026-09-13 코디네이터 재확인). */
    const maxHeightM = 8; // 파렛트 랙 5단×1.5m(7.5m)에 여유를 더한 값
    const boundingRadius = Math.sqrt((bounds.x1 - bounds.x0) ** 2 + (bounds.y1 - bounds.y0) ** 2 + maxHeightM ** 2) / 2;
    const aspect = Math.max(10, wrap.clientWidth) / Math.max(10, wrap.clientHeight);
    const vFovHalf = THREE.MathUtils.degToRad(camera.fov / 2);
    const hFovHalf = Math.atan(Math.tan(vFovHalf) * aspect);
    const overviewRadius = (boundingRadius / Math.sin(Math.min(vFovHalf, hFovHalf))) * 1.12;
    controls.maxDistance = Math.max(spanM * 1.6, overviewRadius * 1.3);

    const overview = () => setTarget(centerX, centerZ, overviewRadius, spanM * 0.02);
    /* 초기 각도는 거의 위에서 내려다보되(3D 임을 알아볼 만큼만 기울인다) — Y:Z 비를
       가파르게 잡아야 건물 깊이(81.6m)가 화면 수직 방향에 그대로 눌려 담긴다. */
    camera.position.set(centerX, spanM * 0.9, centerZ + spanM * 0.45);
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
          tip.textContent = `${bayDisplayCode(hit.bay)} · ${hit.bay.binType} · ${hit.bay.occupiedBins}/${hit.bay.totalBins}`;
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
      if (!zone) return;
      /* zone.xM/yM 은 이제 전역 좌표라 area 오프셋을 더하지 않는다(layout-geometry.ts
       * 머리말). 존이 area 보다 깊게 뻗을 수 있어(같은 머리말) 반경 상한을 span 의
       * 80% 로 눌러 카메라가 지나치게 멀어지지 않게 한다. */
      const zx = zone.xM + zone.wM / 2;
      const zz = zone.yM + zone.dM / 2;
      const radius = Math.min(Math.max(zone.wM, zone.dM) * 1.2, spanM * 0.8);
      setTarget(zx, zz, radius, 1.2);
    };
    onReady?.({ setHighlight, flyTo, resetView: overview });
    if (initialHighlight) {
      setHighlight(initialHighlight);
      flyTo(initialHighlight);
    }

    let raf = 0;
    const tick = () => {
      controls.update();
      controlRef.current?.tick(performance.now());
      renderer.render(scene, camera);
      labels?.update(camera, renderer.domElement.clientWidth, renderer.domElement.clientHeight);
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
      labels?.dispose();
      if (controlRef.current) {
        controlRef.current.dispose();
        controlRef.current = null;
      }
      sceneRef.current = null;
      bimRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout]);

  /* ── 관제 모드 토글 — 씬을 다시 짓지 않고 오버레이 그룹만 얹거나 뗀다 ── */
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    if (controlMode && !controlRef.current) {
      const overlay = buildControlOverlay(layout);
      scene.add(overlay.group);
      controlRef.current = overlay;
      onControlReady?.(overlay);
    } else if (!controlMode && controlRef.current) {
      scene.remove(controlRef.current.group);
      controlRef.current.dispose();
      controlRef.current = null;
      onControlReady?.(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [controlMode, layout]);

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
      <div ref={labelsLayerRef} className="pointer-events-none absolute inset-0 z-0" />
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
