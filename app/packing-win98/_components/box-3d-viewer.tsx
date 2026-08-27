"use client";

import type * as THREE_NS from "three";
import { useEffect, useRef, useState } from "react";
import {
  buildLowPolyCarton,
  buildLowPolyChest,
  type LowPolyBox,
} from "./low-poly-boxes";
import { w98 } from "./win98-ui";

/**
 * 3D 상자 뷰어 — 드래그하면 돌아가고, **한 번 누르면 뚜껑이 열리고 다시 누르면 닫힌다**.
 *
 * ★ 모델을 바꿔 끼울 수 있다 (사용자 요청 — 비교하려고). `modelUrl` 만 바꾸면 다시 만든다.
 *     `LOW_POLY_CHEST`              코드로 만든 마인크래프트 상자 — 파일 없음, 삼각형 36개
 *     `LOW_POLY_CARTON`             코드로 만든 택배 상자 — 파일 없음, 삼각형 72개
 *     `/models/chest-split.glb`     마인크래프트 상자 — 몸체 + 뚜껑, 여는 클립 있음
 *     `/models/carton-split-v3.glb` 택배 상자 — 몸체 + 날개 4장, 클립 없이 뷰어가 리깅
 *   GLB 둘은 클립이 하나씩 있고 **t=0 이 열림, 끝이 닫힘**이라 여는 동작은 거꾸로 재생이다.
 *   저폴리 둘은 클립이 없다 — 경첩 각도를 직접 굴린다(더 단순하고 정확하다).
 *
 * ★ 추천 박스의 **실제 내치수 비율로 늘려서** 세운다. 모델은 고정 비율이지만 그대로 두면
 *   B호(27×20×15)와 D호(41×31×28)가 똑같이 보여 "이 박스가 어떤 모양이냐"를 말해 주지 못한다.
 *
 * ── 크랙에 대하여 ───────────────────────────────────────────────────────────
 * 사용자가 만들어 온 GLB 두 개는 **표면이 닫혀 있지 않다.** 열린 모서리(경계 에지)가
 * 마크 상자 6,583개 · 택배 상자 9,788개다(닫힌 메시라면 0). 화면에 보이던 갈라진 자국은
 * 조명이나 텍스처 착시가 아니라 **실제 구멍**이고, 그 구멍으로 배경이 비친 것이다.
 * 재질·필터로는 고칠 수 없어서 두 갈래로 대응한다:
 *   ① `side: DoubleSide` — 구멍으로 배경 대신 안쪽 면이 보인다. 흰 금 → 어두운 이음매
 *   ② `LOW_POLY` — 상자를 코드로 만든다. BoxGeometry 는 항상 닫혀 있어 구멍이 생길 수 없다
 *
 * ★ three.js 는 **이 컴포넌트가 뜰 때만** 동적으로 불러온다. 정적 import 로 두면 출고 화면
 *   번들에 three 가 들어간다. CDN 을 쓰지 않는 이유는 폰트를 self-host 하는 것과 같다 —
 *   사내망·오프라인에서 3D 만 안 뜨는 상황을 만들지 않기 위해서다.
 */
export function Box3DViewer({
  modelUrl,
  innerCm,
  name,
  lidOpen,
  pixelScale = 3,
  decalUrl,
  pigs = false,
  bare = false,
  className = "",
}: {
  /**
   * 액자 없이 **상자만** 그린다 — 파인 테두리·바탕·아래 안내 문구를 모두 뺀다.
   *
   * 바탕화면 이스터에그처럼 화면 위에 상자를 띄울 때 쓴다. 그 자리에는 감쌀 칸이 없어서,
   * 테두리가 있으면 배경 위에 창이 하나 더 뜬 것처럼 보인다.
   */
  bare?: boolean;
  /**
   * 🐷 뚜껑이 열릴 때 **마인크래프트 돼지가 튀어나온다** (이스터에그).
   * 마크 상자에만 켠다 — 택배 상자에서 돼지가 나오면 그건 사고다.
   */
  pigs?: boolean;
  /** 띄울 모델. GLB 경로이거나 `LOW_POLY`. 바뀌면 장면을 통째로 다시 만든다 */
  modelUrl: string;
  /** [가로, 세로, 높이] cm — 추천/최종 박스의 내치수. 없으면 빈 자리표시 */
  innerCm: [number, number, number] | null;
  name: string | null;
  /**
   * 뚜껑이 열려 있어야 하는가 — **화면 흐름이 정한다**.
   *   토트를 스캔해 박스가 정해지면 true  → 천천히 한 번 열린다
   *   포장 완료를 누르면          false → 천천히 닫힌다
   * 값이 **바뀔 때만** 움직인다.
   */
  lidOpen: boolean;
  /**
   * 몇 배로 축소해 그릴 것인가 = **도트의 굵기**. 1 이면 도트 없이 또렷하게 그린다.
   * 마크 상자는 굵게(3), 택배 상자는 1 — 골판지가 도트로 보이면 택배 상자가 아니다.
   */
  pixelScale?: number;
  /**
   * 상자 앞면에 얹을 그림(택배사 인쇄) 경로. 없으면 아무것도 붙이지 않는다.
   * ⚠️ 모델의 UV 를 건드리지 않는다 — 앞면에 **얇은 판을 한 장 덧대는** 방식이라
   *    어떤 모델에도 그대로 붙고, 원본 텍스처를 훼손하지 않는다.
   */
  decalUrl?: string;
  className?: string;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  /** 마우스를 받는 판. 캔버스가 아니다 — 아래 SPILL 설명 참고 */
  const surfaceRef = useRef<HTMLDivElement>(null);

  /**
   * 칸 밖으로 그릴 폭(px).
   *
   * ★ 돼지가 있는 상자만 **훨씬 크게** 잡는다 (사용자 요청 — 돼지가 화면 바닥까지 떨어진
   *   다음 사라지게). 돼지는 캔버스 밖으로 나가는 순간 잘려서 사라지므로, 떨어질 거리를
   *   벌어 주려면 캔버스가 그만큼 아래로 뻗어 있어야 한다. 3D 칸 아래에서 창 바닥까지가
   *   약 406px 이라(패널 여백 9 + 8 + 아래 칸 290 + 8 + 버튼 64 + 창·바탕 여백 27)
   *   420px 이면 돼지가 화면 끝에 닿는다.
   * ⚠️ 이걸 모든 상자에 주지 않는 이유는 **그리는 픽셀 수**다. 420px 을 사방에 주면
   *    캔버스가 1522 × 1186 = 약 180만 픽셀이 되고, 그걸 매 프레임 그린다. 돼지가 없는
   *    상자에는 아무 이득이 없는 비용이라 96px 로 둔다.
   */
  const spill = pigs ? PIG_SPILL : SPILL;
  /** 뚜껑을 여닫는 손잡이. 3D 쪽이 채워 주고, lidOpen 과 더블클릭이 같이 쓴다 */
  const setLidRef = useRef<((open: boolean) => void) | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "failed">(
    "loading",
  );
  const [wasTouched, setWasTouched] = useState(false);

  const isEmpty = innerCm === null;
  /* 이펙트를 비율이 바뀔 때만 다시 돌리려고 문자열로 굳혀 둔다 — 배열을 그대로 의존성에 넣으면
     매 렌더 새 배열이라 3D 장면이 계속 다시 만들어진다 */
  const ratioKey = innerCm === null ? "" : innerCm.join(",");

  useEffect(() => {
    const host = hostRef.current;
    if (host === null || ratioKey === "") return;

    let disposed = false;
    let cleanup: (() => void) | null = null;
    setStatus("loading");

    void (async () => {
      try {
        const THREE = await import("three");
        if (disposed) return;

        /* ── ★ 칸보다 **크게 그려서 상자가 밖으로 나오게 한다** (사용자 요청) ──────
           예전에는 캔버스가 칸에 딱 맞아서, 상자를 돌리다 모서리가 위로 삐져나오는 순간
           그대로 **잘려 나갔다**. 상자는 회전하면 대각선 길이만큼 커지는데(정육면체면 최대
           √3 ≈ 1.7배) 칸은 그대로라, 어떤 각도에서는 반드시 닿는다.

           해결은 두 가지 중 하나다:
             ① 카메라를 뒤로 빼서 어떤 각도에서도 안 닿게 한다 → 상자가 작아진다
             ② 캔버스를 칸보다 크게 만들어 **넘치는 부분을 칸 밖에 그린다** → 크기 유지
           사용자가 고른 건 ②다("화면 밖으로도 나오게 해서 잘리는 순간 없게, 맨 앞에").

           ⚠️ 넘친 캔버스는 **마우스를 받지 않는다**(pointer-events: none). 캔버스 사각형이
              칸보다 크니, 그대로 두면 투명한 여백이 옆 패널의 클릭을 가로챈다. 그래서
              드래그·클릭은 칸 크기 그대로인 별도의 판(surfaceRef)이 받는다.
           ⚠️ 화각을 같이 넓혀야 한다. 캔버스만 키우고 fov 를 그대로 두면 같은 세계가 더 큰
              화면에 그려지는 게 아니라 **더 넓은 세계**가 보이므로 상자가 그만큼 작아진다.
              세로로 보이는 세계의 높이가 화면 비율만큼 늘어나야 하니
                tan(새 fov / 2) = tan(원래 fov / 2) × (그리는 높이 / 칸 높이)
              다. 이러면 픽셀당 세계 크기가 그대로라 상자 크기가 변하지 않는다. */
        const width = host.clientWidth;
        const height = host.clientHeight;
        /** 칸(sunken)의 실제 높이 — host 는 사방으로 SPILL 만큼 더 크다 */
        const slotHeight = Math.max(1, height - spill * 2);

        /* ── ★ 저해상도로 그린 뒤 CSS 로 확대한다 = win98 도트 느낌 ──────────
           1/PIXEL_SCALE 크기로 렌더하면 미세한 계단·이음매가 한 텍셀 아래로 내려가 사라지고
           굵은 픽셀만 남는다. 그 픽셀을 `image-rendering: pixelated` 로 키우면 도트가 된다.
           ⚠️ antialias 를 끈다 — 저해상도에서 AA 는 픽셀 경계를 흐려 도트 느낌을 없앤다.
           ⚠️ setPixelRatio(1) — 고해상도 화면에서 2배로 그려 버리면 이 방식이 무의미하다. */
        const isPixelated = pixelScale > 1;
        const renderer = new THREE.WebGLRenderer({
          antialias: !isPixelated,
          alpha: true,
        });
        renderer.setPixelRatio(
          isPixelated ? 1 : Math.min(window.devicePixelRatio, 2),
        );
        renderer.setSize(
          Math.max(1, Math.round(width / pixelScale)),
          Math.max(1, Math.round(height / pixelScale)),
          false,
        );
        renderer.setClearColor(0x000000, 0);
        host.appendChild(renderer.domElement);
        renderer.domElement.style.display = "block";
        renderer.domElement.style.width = "100%";
        renderer.domElement.style.height = "100%";
        if (isPixelated) renderer.domElement.style.imageRendering = "pixelated";
        renderer.domElement.style.touchAction = "none";
        renderer.domElement.style.pointerEvents = "none"; // 마우스는 surface 가 받는다

        const scene = new THREE.Scene();
        const halfFov = Math.atan(
          Math.tan((BASE_FOV * Math.PI) / 360) * (height / slotHeight),
        );
        const camera = new THREE.PerspectiveCamera(
          (halfFov * 360) / Math.PI,
          width / height,
          0.1,
          100,
        );

        /* 빛 — 세 방향에서. 한 방향만 주면 반대쪽 면이 새까매져 상자가 잘려 보인다 */
        scene.add(new THREE.AmbientLight(0xffffff, 1.5));
        const keyLight = new THREE.DirectionalLight(0xffffff, 2.2);
        keyLight.position.set(3, 5, 4);
        scene.add(keyLight);
        const fillLight = new THREE.DirectionalLight(0xffffff, 0.8);
        fillLight.position.set(-4, 2, -3);
        scene.add(fillLight);

        /* ── GLB 의 머티리얼 손보기 ────────────────────────────────────────
           **도트로 그릴 때만** 평면 램버트로 갈아 끼운다(색 텍스처 한 장만 남김).
           원본 PBR(노멀맵 + 거칠기맵 + 금속기)은 도트 텍스처 위에서 픽셀 경계마다 홈과
           하이라이트를 만들어 균열처럼 읽히기 때문이다.

           ⚠️ 반대로 **또렷하게 그릴 때(pixelScale === 1)는 원본 재질을 그대로 둔다.**
              사실적인 모델은 그 노멀맵·거칠기맵이 곧 질감이라, 벗겨내면 종이 인형이 된다.
              표면이 닫힌 모델이라면 그 맵들이 가짜 균열을 만들지도 않는다. */
        const maxAnisotropy = renderer.capabilities.getMaxAnisotropy();

        const applyRealisticMaterials = (root: THREE_NS.Object3D) =>
          root.traverse((object) => {
            const mesh = object as { material?: unknown; isMesh?: boolean };
            if (mesh.isMesh !== true) return;
            const materials = Array.isArray(mesh.material)
              ? mesh.material
              : mesh.material === undefined
                ? []
                : [mesh.material];
            for (const material of materials) {
              const record = material as Record<string, unknown>;
              for (const key of [
                "map",
                "normalMap",
                "roughnessMap",
                "metalnessMap",
              ]) {
                const texture = record[key];
                if (texture instanceof THREE.Texture) {
                  texture.anisotropy = maxAnisotropy; // 비스듬한 면에서 무늬가 뭉개지지 않게
                  texture.needsUpdate = true;
                }
              }
            }
          });

        const applyPixelMaterials = (root: THREE_NS.Object3D) =>
          root.traverse((object) => {
            const mesh = object as { material?: unknown; isMesh?: boolean };
            if (mesh.isMesh !== true) return;

            const originals = Array.isArray(mesh.material)
              ? mesh.material
              : mesh.material === undefined
                ? []
                : [mesh.material];

            const replaced = originals.map((original) => {
              const record = original as Record<string, unknown> & {
                dispose?: () => void;
              };
              const map = record.map;

              if (map instanceof THREE.Texture) {
                map.magFilter = THREE.NearestFilter; // 확대는 각지게 — 도트의 핵심
                map.minFilter = THREE.LinearMipmapLinearFilter; // 축소는 부드럽게 — 줄 튐 방지
                map.anisotropy = maxAnisotropy;
                map.generateMipmaps = true;
                map.needsUpdate = true;
              }

              /* 안 쓰게 된 맵은 여기서 버린다 (아래 cleanup 은 새 재질만 보게 된다) */
              for (const key of [
                "normalMap",
                "roughnessMap",
                "metalnessMap",
                "aoMap",
              ]) {
                const texture = record[key];
                if (texture instanceof THREE.Texture) texture.dispose();
              }

              const flat = new THREE.MeshLambertMaterial({
                map: map instanceof THREE.Texture ? map : null,
                color: map instanceof THREE.Texture ? 0xffffff : 0xc8823c,
                /* ★ 양면 렌더 — 이 GLB 들은 표면이 닫혀 있지 않다(위 주석 참고).
                   기본값(FrontSide)이면 구멍이 뚫린 채 배경이 비치지만, DoubleSide 면
                   그 구멍으로 상자 **안쪽 면**이 보여 흰 금이 어두운 이음매로 바뀐다. */
                side: THREE.DoubleSide,
                /* 깨진 메시는 정점 법선도 어긋나 있어 부드럽게 보간하면 면마다 밝기가 튄다 */
                flatShading: true,
              });

              record.dispose?.();
              return flat;
            });

            (mesh as { material: unknown }).material = Array.isArray(
              mesh.material,
            )
              ? replaced
              : (replaced[0] ?? null);
          });

        /* ── 모델 만들기 — 두 갈래 ──────────────────────────────────────────
           `LOW_POLY` 면 코드로 만든다(low-poly-chest.ts). 파일을 받지 않고, 삼각형 36개에
           표면이 닫혀 있어 크랙이 원천적으로 없다. 그 외에는 GLB 를 받아 온다. */
        let model: THREE_NS.Object3D;
        let lowPoly: LowPolyBox | null = null;
        let clips: THREE_NS.AnimationClip[] = [];

        if (modelUrl === LOW_POLY_CHEST) {
          lowPoly = buildLowPolyChest(THREE);
          model = lowPoly.root;
        } else if (modelUrl === LOW_POLY_CARTON) {
          lowPoly = buildLowPolyCarton(THREE);
          model = lowPoly.root;
        } else {
          const { GLTFLoader } =
            await import("three/examples/jsm/loaders/GLTFLoader.js");
          const gltf = await new GLTFLoader().loadAsync(modelUrl);
          if (disposed) {
            renderer.dispose();
            return;
          }
          model = gltf.scene;
          clips = gltf.animations;
          if (isPixelated) applyPixelMaterials(model);
          else applyRealisticMaterials(model);
        }

        /* ── 이름으로 경첩 찾기 ────────────────────────────────────────────
           애니메이션 클립이 없는 GLB 라도, 뚜껑이 **별도 노드로 분리**되어 있고 그 노드의
           원점이 경첩 자리에 있으면 우리가 직접 돌릴 수 있다. tools/split-box.py 가 만드는
           파일이 정확히 그 모양이다(`box_lid`, 원점 = 뒤쪽 아래 모서리).

           ⚠️ 클립이 있으면 클립이 이긴다 — 만든 사람이 의도한 궤적이 우리 추측보다 정확하다.
           ⚠️ 뚜껑이 **열린 자세로 저장돼 있다**고 본다(팀원이 자른 모델이 그렇다). 그래서
              진행도 0 이 원본이고, 닫을 때만 되돌린다. 얼마나 되돌릴지는 아래에서 잰다. */
        /* ── 날개 자동 리깅 ────────────────────────────────────────────────
           팀원이 블렌더에서 택배 상자의 **날개 4장을 따로 떼어** 주었다. 각 날개는 이미
           경첩 자리에 원점이 잡혀 있어서 노드의 rotation 만 돌리면 접힌다.

           ★ 각도를 코드에 박지 않고 **모델을 재서 구한다.** 팀원이 다시 잘라 오거나 다른
             상자가 들어와도 코드를 안 고쳐도 되기 때문이다. 재는 순서는 이렇다:

             ① 몸체 = 정점이 가장 많은 메시. 날개는 몸체보다 훨씬 작다.
             ② 경첩 축 = 날개가 **더 길게 뻗은 쪽**(x 와 z 중). 경첩은 몸체와 맞닿은 변이고,
                그 변이 곧 날개의 긴 쪽이다. 남은 축이 날개가 뻗어 나가는 방향이다.
             ③ 지금 각도 ψ = 경첩에서 가장 먼 정점의 (뻗는축, y) 평면 각도.
                이 모델은 넷 다 바깥·아래 22° 였다 — 활짝 열린 자세다.
             ④ 닫힘 목표 = **안쪽 수평.** 경첩이 상자 왼쪽에 있으면 오른쪽(0°)이, 오른쪽에
                있으면 왼쪽(180°)이 안쪽이다.
             ⑤ 도는 방향 = **위(90°)를 지나는 쪽.** 같은 자세에 이르는 길이 둘인데, 아래를
                지나면 날개가 상자 밑을 훑고 지나간다. 실제 종이 상자가 접히는 길은 위다.

           ⚠️ 축마다 회전이 각도를 더하는 방향이 다르다.
                Rz: x' = x·cosθ − y·sinθ  →  ψ 가 **θ 만큼 늘어난다**
                Rx: y' = y·cosθ − z·sinθ  →  ψ 가 **θ 만큼 줄어든다**
              그래서 x축 경첩만 부호를 뒤집는다. 이 부호 하나를 놓쳐서 마크 상자 뚜껑이
              바닥으로 파고들었던 적이 있다.
           ⚠️ 정점을 3개마다 하나씩만 본다. 날개 하나가 3만 삼각형이라 전부 볼 이유가 없고,
              가장 먼 점 하나만 찾으면 되는 일이라 표본으로 충분하다. */
        type Flap = {
          node: THREE_NS.Object3D;
          axis: "x" | "z";
          /** 닫힘까지 돌려야 하는 각(라디안). 부호가 곧 도는 방향이다 */
          closedAngle: number;
          /** 접히는 순서 — 0 이 먼저(안쪽), 1 이 나중(바깥쪽) */
          stage: 0 | 1;
          /** 골판지 두께. 나중에 접히는 쌍을 이만큼 띄워 **위에 얹는다** */
          thickness: number;
          /** 원래 경첩 높이. 띄운 뒤 되돌릴 기준값 */
          baseY: number;
          /** 같은 쌍 안에서 몇 번째로 접히는가 (0 또는 1). 아주 살짝 시차를 준다 */
          lag: 0 | 1;
          /** 경첩에서 날개 끝까지의 거리. 마주 보는 쌍을 맞물리게 늘릴 때 쓴다 */
          reach: number;
        };

        const riggedFlaps: Flap[] = (() => {
          if (lowPoly !== null || clips.length > 0) return [];

          const meshes: THREE_NS.Mesh[] = [];
          model.traverse((object) => {
            if ((object as THREE_NS.Mesh).isMesh === true)
              meshes.push(object as THREE_NS.Mesh);
          });
          // 몸체 1 + 날개 2장 미만이면 이 방식으로 볼 상자가 아니다
          if (meshes.length < 3) return [];

          const vertexCount = (mesh: THREE_NS.Mesh) =>
            mesh.geometry.getAttribute("position")?.count ?? 0;
          const body = meshes.reduce((a, b) =>
            vertexCount(a) >= vertexCount(b) ? a : b,
          );

          /* ── ★ 노드에 걸린 회전을 **기하에 굽는다** ───────────────────────
             팀원이 새로 잘라 준 모델은 날개마다 노드에 회전(quaternion)이 들어 있다. 아래
             리깅은 "정점 좌표가 곧 월드 방향"이라고 보고 경첩 축과 각도를 구하는데, 노드가
             이미 돌아가 있으면 그 전제가 깨진다 — 실제로 네 장을 전부 X축 경첩으로 잘못 읽고
             닫으면 상자 밖 x=1.03 까지 날아갔다.

             ★ 고치는 방법이 두 가지다. ① 리깅 전체를 회전까지 고려하도록 일반화하거나,
               ② **회전을 정점에 미리 곱해 넣고 노드는 이동만 남기거나.** ②를 골랐다 —
               `노드(T·R) × 정점` 과 `노드(T) × (R × 정점)` 은 같은 결과인데, 뒤쪽은 그 뒤의
               모든 계산이 회전을 몰라도 되게 만든다. 리깅·펴기·늘리기가 전부 그대로 통한다.
             ⚠️ 크기(scale)도 같이 굽는다. 회전만 굽고 크기를 남기면 두께·길이를 잰 값이
                실제와 어긋난다.
             ⚠️ 기하를 **여러 메시가 나눠 쓰면** 이 방법은 서로를 망가뜨린다. 이 모델들은
                메시마다 자기 기하를 갖고 있어 문제없지만, 공유하는 파일이 오면 먼저
                복제해야 한다. */
          const upright = new THREE.Quaternion();
          for (const mesh of meshes) {
            const isPlain =
              mesh.quaternion.equals(upright) &&
              mesh.scale.x === 1 &&
              mesh.scale.y === 1 &&
              mesh.scale.z === 1;
            if (isPlain) continue;

            mesh.geometry.applyMatrix4(
              new THREE.Matrix4().compose(
                new THREE.Vector3(),
                mesh.quaternion,
                mesh.scale,
              ),
            );
            mesh.quaternion.identity();
            mesh.scale.set(1, 1, 1);
            mesh.updateMatrix();
          }

          const found: Flap[] = [];
          const vertex = new THREE.Vector3();

          for (const mesh of meshes) {
            if (mesh === body) continue;
            const attribute = mesh.geometry.getAttribute("position");
            if (attribute === undefined) continue;

            mesh.geometry.computeBoundingBox();
            const bounds = mesh.geometry.boundingBox;
            if (bounds === null) continue;

            // ② 경첩 축 = 더 긴 쪽
            const axis: "x" | "z" =
              bounds.max.x - bounds.min.x > bounds.max.z - bounds.min.z
                ? "x"
                : "z";
            const outwardIsX = axis === "z";

            /* ③ 지금 각도 ψ — **판 전체의 주축**으로 잰다.
               ★ 한때 "경첩에서 가장 먼 정점"의 각도를 썼다가 바꿨다. 그 점은 판의 **모서리**라
                 두께의 절반만큼 위에 얹혀 있어서, 각도가 늘 그만큼 부풀려 나온다. 이 모델에서
                 실측 편향이 **3.5°~4.4°** 였고, 그만큼 날개가 눕지 않고 들린 채로 섰다
                 (0.46 길이에서 끝이 0.03 뜬다).
               ★ 주축은 정점 하나가 아니라 **분포 전체**가 정한다. 판처럼 한 방향으로 납작한
                 점구름에서 1주성분은 곧 그 판이 뻗은 방향이고, 두께는 그 직교 방향으로
                 밀려나므로 각도에 섞이지 않는다. 공분산 2×2 의 고유벡터라 닫힌 식으로 나온다:
                     θ = ½ · atan2(2·Sxy, Sxx − Syy)
               ⚠️ 주축은 방향만 알려 주고 **부호는 모른다**(180° 뒤집힌 것과 구별 못 한다).
                  그래서 가장 먼 점을 하나 잡아 두고, 주축이 그쪽을 향하도록 부호를 맞춘다.
               ⚠️ 정점을 3개마다 하나씩만 본다. 날개 하나가 3만 삼각형이라 전부 볼 이유가 없고,
                  평균과 분산을 구하는 일이라 표본으로 충분하다. */
            let farthest = 0;
            let farOut = 0;
            let farY = 0;
            let count = 0;
            let sumOut = 0;
            let sumY = 0;
            let sumOutOut = 0;
            let sumYY = 0;
            let sumOutY = 0;

            for (let i = 0; i < attribute.count; i += 3) {
              vertex.fromBufferAttribute(
                attribute as THREE_NS.BufferAttribute,
                i,
              );
              const out = outwardIsX ? vertex.x : vertex.z;
              const distance = Math.hypot(out, vertex.y);
              if (distance > farthest) {
                farthest = distance;
                farOut = out;
                farY = vertex.y;
              }
              count += 1;
              sumOut += out;
              sumY += vertex.y;
              sumOutOut += out * out;
              sumYY += vertex.y * vertex.y;
              sumOutY += out * vertex.y;
            }
            if (farthest === 0 || count === 0) continue;

            const meanOut = sumOut / count;
            const meanY = sumY / count;
            const varOut = sumOutOut / count - meanOut * meanOut;
            const varY = sumYY / count - meanY * meanY;
            const covOutY = sumOutY / count - meanOut * meanY;

            const principal = 0.5 * Math.atan2(2 * covOutY, varOut - varY);
            let dirOut = Math.cos(principal);
            let dirY = Math.sin(principal);
            // 주축이 경첩에서 멀어지는 쪽을 향하게 돌려 놓는다
            if (dirOut * farOut + dirY * farY < 0) {
              dirOut = -dirOut;
              dirY = -dirY;
            }

            let psi = (Math.atan2(dirY, dirOut) * 180) / Math.PI;
            if (psi < 0) psi += 360; // [0, 360)

            // ④ 안쪽 = 경첩이 붙은 벽의 반대편
            const hingeOut = outwardIsX ? mesh.position.x : mesh.position.z;
            const target = hingeOut < 0 ? 0 : 180;

            // ⑤ 위를 지나는 쪽으로 돈다
            let delta = (((target - psi) % 360) + 360) % 360; // [0, 360)
            const passesUp = psi < 90 ? psi + delta >= 90 : psi + delta >= 450;
            if (!passesUp) delta -= 360;

            const closedAngle =
              ((axis === "x" ? -delta : delta) * Math.PI) / 180;

            /* 골판지 두께 = **다 접은 자세에서의 y 두께.** 지금 자세로 재면 안 된다 —
               날개가 22° 기울어 있어서 그 기울기까지 두께로 잡힌다(0.03 이 0.20 으로 나온다).
               회전 뒤의 y 만 구하면 판이 눕혀진 상태라 그 두께가 곧 종이 두께다.
                 Rz: y' = x·sinθ + y·cosθ      (뻗는 축이 x)
                 Rx: y' = y·cosθ − z·sinθ      (뻗는 축이 z)
               둘 다 "뻗는 축 성분"과 y 로만 쓰면 같은 꼴이라 한 줄로 합쳤다.

               ★ 판 **전체**의 y 폭을 쓰면 안 된다. 이 날개는 평평하지 않고 0.03~0.04 휘어
                 있어서, 전체로 재면 두께가 0.065 로 나온다 — 진짜 종이 두께(0.03)의 두 배다.
                 그 값으로 날개를 층지게 쌓았더니 이음매에 0.026 짜리 능선이 솟았다.
               ★ 그래서 **격자 칸마다 재고 중앙값을 쓴다.** 한 칸 안에서는 판이 거의 평평하니
                 그 칸의 y 폭이 곧 종이 두께이고, 칸이 64개면 몇 칸이 이상해도 중앙값은
                 흔들리지 않는다. 휨은 칸과 칸 **사이**의 차이라 이 방식에 안 섞인다.
               ⚠️ 칸 나누기는 **회전 전 좌표**(bounds)로 한다. 회전 뒤 좌표로 나누려면 범위를
                  먼저 알아야 해서 훑기를 한 번 더 해야 하는데, 칸은 "가까운 것끼리 묶는"
                  일이라 어느 좌표계로 나눠도 같다. */
            const cos = Math.cos(closedAngle);
            const sin = Math.sin(closedAngle);

            const BINS = 8;
            const binLow = new Float64Array(BINS * BINS).fill(Infinity);
            const binHigh = new Float64Array(BINS * BINS).fill(-Infinity);
            const binCount = new Int32Array(BINS * BINS);

            const outLow = outwardIsX ? bounds.min.x : bounds.min.z;
            const outHigh = outwardIsX ? bounds.max.x : bounds.max.z;
            const alongLow = outwardIsX ? bounds.min.z : bounds.min.x;
            const alongHigh = outwardIsX ? bounds.max.z : bounds.max.x;
            const outStep = Math.max(1e-9, outHigh - outLow) / BINS;
            const alongStep = Math.max(1e-9, alongHigh - alongLow) / BINS;
            /* ★ 도달거리도 **눕힌 자세에서** 잰다. 경첩에서 끝점까지의 직선거리(빗변)를 쓰면
                 안 된다 — 그 끝점은 판의 모서리라 두께의 절반만큼 위에 있고, 눕히면 그
                 각도(여기선 3.6°)만큼 짧아진다. 빗변으로 맞췄더니 마주 보는 날개 사이에
                 0.0045 짜리 틈이 남았다. 눕힌 자세의 길이 성분(u)이 곧 "가운데까지 얼마나
                 가는가"다. */
            let maxReach = 0;
            for (let i = 0; i < attribute.count; i += 3) {
              vertex.fromBufferAttribute(
                attribute as THREE_NS.BufferAttribute,
                i,
              );
              const out = outwardIsX ? vertex.x : vertex.z;
              const flatY =
                axis === "z"
                  ? out * sin + vertex.y * cos
                  : vertex.y * cos - out * sin;

              const along = outwardIsX ? vertex.z : vertex.x;
              const bin =
                Math.min(BINS - 1, Math.max(0, Math.floor((out - outLow) / outStep))) * BINS +
                Math.min(BINS - 1, Math.max(0, Math.floor((along - alongLow) / alongStep)));
              if (flatY < binLow[bin]!) binLow[bin] = flatY;
              if (flatY > binHigh[bin]!) binHigh[bin] = flatY;
              binCount[bin] = (binCount[bin] ?? 0) + 1;

              const flatU =
                axis === "z" ? out * cos - vertex.y * sin : vertex.y * sin + out * cos;
              const reach = Math.abs(flatU);
              if (reach > maxReach) maxReach = reach;
            }

            /* 칸별 두께의 중앙값. 정점이 몇 개 없는 칸은 가장자리라 값이 못 미더워 뺀다 */
            const spans: number[] = [];
            for (let bin = 0; bin < BINS * BINS; bin += 1) {
              if ((binCount[bin] ?? 0) < 12) continue;
              const span = binHigh[bin]! - binLow[bin]!;
              if (Number.isFinite(span)) spans.push(span);
            }
            spans.sort((a, b) => a - b);
            const measuredThickness =
              spans.length > 0 ? spans[Math.floor(spans.length / 2)]! : 0;

            found.push({
              node: mesh,
              axis,
              closedAngle,
              // 마주 보는 두 장이 같은 순서다. 축이 다르면 순서도 다르다
              stage: axis === "z" ? 0 : 1,
              lag: 0, // 아래에서 쌍마다 0/1 로 다시 매긴다
              thickness: measuredThickness,
              baseY: mesh.position.y,
              reach: maxReach,
            });
          }

          /* ★ **같은 쌍의 두 장에 아주 작은 시차를 준다** (0.04 = 전체의 4%).
               마주 보는 두 장이 한 프레임도 안 어긋나고 똑같이 움직이면 기계가 접는 것처럼
               보인다. 사람 손도, 접는 기계도 두 장을 정확히 동시에 눕히지는 못한다.
               시차가 크면 "따로 논다"가 되고, 없으면 "복제됐다"가 된다. 4%가 그 사이다. */
          let counted = 0;
          for (const stage of [0, 1] as const) {
            counted = 0;
            for (const flap of found) {
              if (flap.stage !== stage) continue;
              flap.lag = counted === 0 ? 0 : 1;
              counted += 1;
            }
          }

          /* ── ★ 회색으로 나오는 면의 **텍스처를 반대편에서 복사한다** ────────
             새로 받은 모델은 날개의 **한쪽 면만** 골판지 갈색 [203,154,112] 이고 반대쪽은
             회색 [117,111,103] 이다. 텍스처의 엉뚱한 자리를 읽고 있다.

             ★ 한때 판을 뒤집어 갈색이 위로 오게 했다가 되돌렸다. 뒤집으면 닫았을 때는
               멀쩡하지만 **열면 안쪽이 회색**이 된다 — 문제가 반대편으로 옮겨 갈 뿐이다.
               실제 골판지는 양면이 다 골판지색이므로, 고칠 것은 방향이 아니라 **텍스처**다.
             ★ 그래서 회색 면의 정점에 **같은 자리 갈색 면의 UV** 를 준다. 판은 얇은 널빤지라
               두 면이 같은 (길이, 폭) 자리에 서로 마주 보고 있어서, 그 자리의 갈색 UV 를
               쓰면 무늬까지 자연스럽게 이어진다. 단색으로 칠하는 것보다 낫다.
             ⚠️ 정점을 하나하나 짝지으면 느리고, 두 면의 정점 수도 다르다. **격자로 나눠**
                칸마다 갈색 UV 의 평균을 구해 두고 거기서 가져온다. 48×48 이면 이 판에서
                칸마다 수십 개가 들어가 평균이 안정적이다.
             ⚠️ 텍스처를 못 읽으면(캔버스 차단·미로드) 아무것도 하지 않는다. 보정이라
                확신이 없으면 원본을 그대로 두는 편이 안전하다. */
          const repairFlapTexture = (): void => {
            const skin = (found[0]?.node as THREE_NS.Mesh | undefined)?.material as
              | THREE_NS.MeshStandardMaterial
              | undefined;
            const source = skin?.map?.image as CanvasImageSource | undefined;
            if (source === undefined) return;

            const size = 64;
            const canvas = document.createElement("canvas");
            canvas.width = size;
            canvas.height = size;
            const paint = canvas.getContext("2d", { willReadFrequently: true });
            if (paint === null) return;

            let pixels: Uint8ClampedArray;
            try {
              paint.drawImage(source, 0, 0, size, size);
              pixels = paint.getImageData(0, 0, size, size).data;
            } catch {
              return; // 다른 출처의 그림이면 읽을 수 없다
            }

            /** UV 자리의 색이 얼마나 알록달록한가 — 골판지는 크고 회색은 0 에 가깝다 */
            const colourfulnessAt = (u: number, v: number) => {
              const px = Math.min(size - 1, Math.floor((u - Math.floor(u)) * size));
              const py = Math.min(size - 1, Math.floor((v - Math.floor(v)) * size));
              const at = (py * size + px) * 4;
              const r = pixels[at] ?? 0;
              const g = pixels[at + 1] ?? 0;
              const b = pixels[at + 2] ?? 0;
              return Math.max(r, g, b) - Math.min(r, g, b);
            };

            const vertex = new THREE.Vector3();

            for (const flap of found) {
              const mesh = flap.node as THREE_NS.Mesh;
              const position = mesh.geometry.getAttribute("position");
              const uv = mesh.geometry.getAttribute("uv") as
                | THREE_NS.BufferAttribute
                | undefined;
              if (position === undefined || uv === undefined) continue;

              const cos = Math.cos(flap.closedAngle);
              const sin = Math.sin(flap.closedAngle);
              const heightOf = (p: THREE_NS.Vector3) =>
                flap.axis === "z" ? p.x * sin + p.y * cos : p.y * cos - p.z * sin;
              const lengthOf = (p: THREE_NS.Vector3) =>
                flap.axis === "z" ? p.x * cos - p.y * sin : p.y * sin + p.z * cos;
              const sideOf = (p: THREE_NS.Vector3) => (flap.axis === "z" ? p.z : p.x);

              /* 판의 가운데 높이와 (길이, 폭) 범위를 한 번에 훑는다 */
              let sum = 0;
              let count = 0;
              let minLength = Infinity;
              let maxLength = -Infinity;
              let minSide = Infinity;
              let maxSide = -Infinity;
              for (let i = 0; i < position.count; i += 4) {
                vertex.fromBufferAttribute(position as THREE_NS.BufferAttribute, i);
                sum += heightOf(vertex);
                count += 1;
                const along = lengthOf(vertex);
                const across = sideOf(vertex);
                if (along < minLength) minLength = along;
                if (along > maxLength) maxLength = along;
                if (across < minSide) minSide = across;
                if (across > maxSide) maxSide = across;
              }
              if (count === 0) continue;
              const mid = sum / count;

              /* 두 면의 알록달록함을 재서 어느 쪽이 골판지인지 정한다 */
              let brightAbove = 0;
              let countAbove = 0;
              let brightBelow = 0;
              let countBelow = 0;
              for (let i = 0; i < position.count; i += 4) {
                vertex.fromBufferAttribute(position as THREE_NS.BufferAttribute, i);
                const tone = colourfulnessAt(uv.getX(i), uv.getY(i));
                if (heightOf(vertex) >= mid) {
                  brightAbove += tone;
                  countAbove += 1;
                } else {
                  brightBelow += tone;
                  countBelow += 1;
                }
              }
              if (countAbove === 0 || countBelow === 0) continue;
              const aboveIsCardboard =
                brightAbove / countAbove > brightBelow / countBelow;
              // 차이가 작으면 둘 다 멀쩡한 것이다 — 건드리지 않는다
              if (Math.abs(brightAbove / countAbove - brightBelow / countBelow) < 8) {
                continue;
              }

              /* ── 골판지 면의 정점을 격자에 담아 둔다 ───────────────────────
                 ★ 한때 **칸마다 UV 를 평균 내서** 회색 면에 나눠 줬다가 되돌렸다. 그러면
                   칸 경계를 지나는 삼각형이 텍스처의 전혀 다른 자리로 건너뛰어, 그 경계가
                   전부 이음매로 보인다 — 화면에 상자 표면이 갈라진 것처럼 금이 갔던 게
                   이것이다. 평균은 값을 뭉개는 연산이라 **연속이어야 하는 UV 에 쓰면 안 된다.**
                 ★ 대신 **가장 가까운 정점의 UV 를 그대로 복사**한다. 이웃한 회색 정점은
                   이웃한 갈색 정점을 찾아가므로 UV 도 이웃끼리 붙어 있고, 무늬가 끊기지 않는다.
                 ⚠️ 격자는 "가까운 것부터 보기" 위한 장치일 뿐 값을 섞지 않는다. 칸마다 정점
                    번호만 이어 두고(연결 리스트), 실제로는 거리를 재서 하나를 고른다. */
              const grid = 96;
              const head = new Int32Array(grid * grid).fill(-1);
              const next = new Int32Array(position.count).fill(-1);

              const gridLength = Math.max(1e-9, maxLength - minLength) / grid;
              const gridSide = Math.max(1e-9, maxSide - minSide) / grid;
              const cellOf = (along: number, across: number) => {
                const gx = Math.min(
                  grid - 1,
                  Math.max(0, Math.floor((along - minLength) / gridLength)),
                );
                const gy = Math.min(
                  grid - 1,
                  Math.max(0, Math.floor((across - minSide) / gridSide)),
                );
                return gx * grid + gy;
              };

              for (let i = 0; i < position.count; i += 1) {
                vertex.fromBufferAttribute(position as THREE_NS.BufferAttribute, i);
                if (heightOf(vertex) >= mid !== aboveIsCardboard) continue;
                const cell = cellOf(lengthOf(vertex), sideOf(vertex));
                next[i] = head[cell]!;
                head[cell] = i;
              }

              /* ── 회색 면의 정점에 가장 가까운 갈색 정점의 UV 를 준다 ──────── */
              const probe = new THREE.Vector3();
              let repaired = 0;

              for (let i = 0; i < position.count; i += 1) {
                vertex.fromBufferAttribute(position as THREE_NS.BufferAttribute, i);
                if (heightOf(vertex) >= mid === aboveIsCardboard) continue;

                const along = lengthOf(vertex);
                const across = sideOf(vertex);
                const cell = cellOf(along, across);
                const cx = Math.floor(cell / grid);
                const cy = cell % grid;

                let bestIndex = -1;
                let bestDistance = Infinity;
                // 가까운 칸부터 넓혀 가며 본다. 찾은 뒤에도 한 겹 더 봐야 진짜 최단이 나온다
                for (let ring = 0; ring < 6; ring += 1) {
                  for (let dx = -ring; dx <= ring; dx += 1) {
                    for (let dy = -ring; dy <= ring; dy += 1) {
                      if (ring > 0 && Math.abs(dx) !== ring && Math.abs(dy) !== ring) continue;
                      const x = cx + dx;
                      const y = cy + dy;
                      if (x < 0 || y < 0 || x >= grid || y >= grid) continue;

                      for (let j = head[x * grid + y]!; j >= 0; j = next[j]!) {
                        probe.fromBufferAttribute(position as THREE_NS.BufferAttribute, j);
                        const da = lengthOf(probe) - along;
                        const db = sideOf(probe) - across;
                        const distance = da * da + db * db;
                        if (distance < bestDistance) {
                          bestDistance = distance;
                          bestIndex = j;
                        }
                      }
                    }
                  }
                  if (bestIndex >= 0 && ring >= 1) break;
                }
                if (bestIndex < 0) continue;

                uv.setXY(i, uv.getX(bestIndex), uv.getY(bestIndex));
                repaired += 1;
              }

              if (repaired > 0) uv.needsUpdate = true;
            }
          };
          repairFlapTexture();

          /* ── ★ 마주 보는 쌍이 **가운데서 만나도록 늘린다** (사용자 요청 — 이음새 없게) ──
             모델의 날개는 경첩에서 0.46 인데, 마주 보는 경첩 사이가 1.12 라 한 장이 0.56 은
             되어야 가운데서 만난다. 그대로 두면 닫아도 윗면 한가운데에 0.2 × 0.2 짜리
             구멍이 남는다(화면에서 실제로 보였다).

             ★ **노드의 scale 을 쓰지 않는다.** `node.scale.x = 1.2` 로 늘리면 안 된다 —
               three 의 노드 변환은 `이동 × 회전 × 크기` 순서라 크기가 **회전 전** 좌표계에
               적용된다. 이 날개는 지금 17° 기울어 저장돼 있어서, 그 상태의 x 만 늘리면
               길이만 자라는 게 아니라 **기울기까지 바뀐다.** 그러면 다 접었을 때 수평이
               아니라 비스듬히 뜬다.
             ★ 그래서 **정점을 직접 옮긴다.** 순서는 이렇다:
                 ① 다 접힌 자세로 돌려 놓고 본다 (그 자세에서 날개는 수평이다)
                 ② 그 자세의 "길이 방향"(u)만 k 배 한다. 두께 방향(v)은 건드리지 않는다
                 ③ 다시 원래 자세로 되돌린다
               길이 방향으로만 늘렸으니 두께도, 기울기도, 접히는 각도도 그대로다.
             ⚠️ 텍스처가 길이 방향으로 21% 늘어난다. 골판지 결이라 눈에 띄지 않지만,
                무늬가 뚜렷한 상자가 오면 UV 도 같이 손봐야 한다.
             ⚠️ 근본 해결은 블렌더에서 날개를 0.56 으로 잘라 오는 것이다. 여기서 늘리는 건
                모델이 고쳐질 때까지의 보정이고, 모델이 이미 충분히 길면(k ≤ 1) 아무 일도
                하지 않는다. */
          const stretchFlap = (
            flap: Flap,
            factor: number,
            tailKeep: number,
            targetThickness: number,
          ) => {
            const geometry = (flap.node as THREE_NS.Mesh).geometry;
            const attribute = geometry.getAttribute(
              "position",
            ) as THREE_NS.BufferAttribute;
            const cos = Math.cos(flap.closedAngle);
            const sin = Math.sin(flap.closedAngle);

            /** 접힌 자세에서의 길이 좌표. + 가 상자 안쪽인지 바깥쪽인지는 날개마다 다르다 */
            const lengthOf = (x: number, y: number, z: number) =>
              flap.axis === "z" ? x * cos - y * sin : y * sin + z * cos;

            /* ── 1차: 어디까지가 날개이고 어디부터가 꼬리인지 가른다 ──────────
               ★ 팀원이 자를 때 **접는 선보다 조금 안쪽에서 잘라서**, 날개마다 경첩 뒤로
                 0.02~0.07 짜리 꼬리가 남아 있다. 원래 벽에 붙어 있던 조각이다.
                 197° 를 돌리면 이 꼬리가 반대편으로 넘어가 **벽 바깥으로 삐져나오고**,
                 그 끝이 잘린 단면이라 톱니처럼 도돌도돌하게 보인다. 화면에서 상자 윗
                 모서리를 따라 보이던 그 지저분한 줄이 이것이다.
               ★ 그래서 길이 방향 배율을 **한 값으로 쓰지 않는다** — 날개 쪽은 늘리고,
                 꼬리 쪽은 오히려 줄여서 벽 안으로 집어넣는다.
               ⚠️ 꼬리를 0 으로 만들지는 않는다. 완전히 없애면 날개가 반쯤 열렸을 때 경첩
                  자리에 틈이 벌어진다. 남길 길이(`tailKeep`)는 **벽까지의 여유를 재서**
                  부르는 쪽이 정한다 — 그 안에 들어가면 벽에 가려 안 보이면서 이음매도
                  메워진다. 두께 기준으로 잡았더니 경첩이 벽보다 안쪽에 있는 만큼
                  (0.016~0.020) 여전히 삐져나왔다. */
            let minLength = Infinity;
            let maxLength = -Infinity;
            for (let i = 0; i < attribute.count; i += 1) {
              const value = lengthOf(
                attribute.getX(i),
                attribute.getY(i),
                attribute.getZ(i),
              );
              if (value < minLength) minLength = value;
              if (value > maxLength) maxLength = value;
            }

            // 날개 본체는 멀리 뻗은 쪽이다. 반대쪽 짧은 것이 꼬리다
            const bodySide = Math.abs(maxLength) >= Math.abs(minLength) ? 1 : -1;
            const tailLength = bodySide > 0 ? -minLength : maxLength;
            const tailFactor =
              tailLength > tailKeep ? tailKeep / tailLength : 1;

            /* ── 1차-b: **삐친 정점**의 높이를 찾는다 ───────────────────────
               ★ 화면에서 상자 윗변을 따라 보이던 **톱니**의 정체다. 잘린 단면이라 정점 몇 개가
                 판 위로 뾰족하게 솟아 있고, 실측으로 **위쪽 1% 가 0.011 만큼** 튀어나와
                 있었다(판의 진짜 두께가 0.022 이니 절반이나 된다).
               ★ 몸체 테두리에 쓴 방법과 같지만, **눕힌 자세의 두께 방향(v)** 에서 깎는다.
                 월드 y 로 깎으면 날개가 회전하는 동안 기준이 같이 돌아 엉뚱한 데가 깎인다.
                 v 는 날개에 붙어 있는 좌표라 어느 각도에서도 "판의 위아래"를 뜻한다.
               ⚠️ 최댓값이 아니라 **백분위**로 자른다. 최댓값은 그 삐친 정점 자신이라 기준이
                  될 수 없다. 위 1% · 아래 1% 를 잘라내면 판의 실제 면만 남는다.
               ⚠️ 4개마다 하나씩만 모아 정렬한다. 2만 개를 다 정렬할 이유가 없고, 백분위는
                  표본으로도 충분히 안정적이다. */
            const thicknessSamples: number[] = [];
            const sideSamples: number[] = [];
            const lengthSamples: number[] = [];
            for (let i = 0; i < attribute.count; i += 4) {
              const x = attribute.getX(i);
              const y = attribute.getY(i);
              const z = attribute.getZ(i);
              thicknessSamples.push(
                flap.axis === "z" ? x * sin + y * cos : y * cos - z * sin,
              );
              // 경첩 축 방향 = 날개의 폭. 이 축은 회전해도 값이 안 바뀐다
              sideSamples.push(flap.axis === "z" ? z : x);
              lengthSamples.push(lengthOf(x, y, z));
            }
            thicknessSamples.sort((a, b) => a - b);
            sideSamples.sort((a, b) => a - b);
            lengthSamples.sort((a, b) => a - b);

            const pick = (sorted: number[], ratio: number, fallback: number) =>
              sorted[Math.floor(sorted.length * ratio)] ?? fallback;

            const ceilingV = pick(thicknessSamples, 0.99, Number.POSITIVE_INFINITY);
            const floorV = pick(thicknessSamples, 0.01, Number.NEGATIVE_INFINITY);

            /* ★ **판이 두꺼우면 두께 방향으로 눌러 얇게 만든다** (사용자 요청 — 접었을 때
                 위로 튀어나온 턱을 반으로). 그 턱은 날개의 **잘린 단면**이다.
               ★ 배율을 상수로 박지 않고 **상자 크기에 맞춰 정한다.** 처음엔 0.5 로 박아 뒀는데,
                 그 값은 첫 모델(단면이 상자 폭의 4.6%)에 맞춘 것이라 얇게 잘라 온 모델에는
                 과했다 — 종잇장이 되어 옆에서 보면 사라진다. 목표 두께를 상자 폭의 2.5% 로
                 두고 거기까지만 누르면, 두꺼운 모델은 눌리고 이미 얇은 모델은 그대로 남는다.
               ★ 가운데(중앙값)를 기준으로 눌러서 **두께와 휨이 같은 비율로** 줄어든다.
                 턱이 낮아지는 동시에 판도 평평해지므로, 위에 얹히는 테이프도 더 잘 붙는다.
               ⚠️ 아래에서 쓰는 `flap.thickness` 도 같은 비율로 줄여야 한다. 그 값으로 바깥
                  쌍을 들어 올리는데, 옛 두께로 들면 실제 판보다 높이 떠서 사이가 벌어진다. */
            const midV = pick(thicknessSamples, 0.5, 0);
            const measuredSpan = ceilingV - floorV;
            const squash =
              Number.isFinite(measuredSpan) && measuredSpan > targetThickness
                ? targetThickness / measuredSpan
                : 1;

            /* ★ **옆변을 일자로 편다** (사용자 요청 — 접었을 때 위 모서리를 일자로).
                 날개 네 장의 옆변이 모여 상자 윗면의 테두리를 이룬다. 그 변이 잘린 단면이라
                 들쭉날쭉하고, 실측으로 **0.010~0.032 씩** 흔들렸다 — 두께 방향 삐침(0.011)
                 보다 오히려 크다. 화면에서 톱니로 보이던 것의 대부분이 이쪽이다.

               ★ **자르는 게 아니라 붙인다.** 튀어나온 것만 깎으면(단순 clamp) 바깥으로 나온
                 뾰족한 부분은 없어지지만 **안으로 파인 홈은 그대로 남아** 여전히 들쭉날쭉하다.
                 그래서 가장자리 3% 를 띠로 잡아 **통째로 한 평면에 붙인다** — 나온 것은
                 들어가고 파인 것은 나와서 변이 곧아진다. 칼로 한 번 밀어 다듬는 것과 같다.
               ⚠️ 붙일 평면은 p99 다. 최댓값을 쓰면 그 삐친 정점 하나에 전부 끌려 나간다.
               ⚠️ 띠는 6% 다. 3% 로 시작했다가 넓혔다 — 그 폭으로는 흔들림의 바깥쪽만 잡히고
                  안쪽 홈이 남아 여전히 들쭉날쭉했다. 더 넓히면 날개의 실제 면까지 평면으로
                  눌려 각져 보이므로 여기서 멈춘다.
               ⚠️ 이 축은 경첩 축이라 **회전해도 값이 그대로**다. 두께처럼 변환할 필요 없이
                  원래 좌표를 바로 다루면 된다. */
            const ceilingW = pick(sideSamples, 0.99, Number.POSITIVE_INFINITY);
            const floorW = pick(sideSamples, 0.01, Number.NEGATIVE_INFINITY);
            const edgeBandHigh = pick(sideSamples, 0.94, Number.POSITIVE_INFINITY);
            const edgeBandLow = pick(sideSamples, 0.06, Number.NEGATIVE_INFINITY);

            /** 가장자리 띠에 들면 평면에 붙이고, 아니면 그대로 둔다 */
            const straighten = (value: number) =>
              value >= edgeBandHigh
                ? ceilingW
                : value <= edgeBandLow
                  ? floorW
                  : value;

            /* ★ **앞뒤 끝변도 같은 방법으로 편다** (사용자 요청 — 가로 모서리도 말끔하게).
                 옆변만 폈더니 세로 모서리는 깨끗해졌는데 **가로 모서리가 남았다.** 그 변은
                 날개의 **길이 방향** 양끝이기 때문이다:
                   경첩 쪽 끝(꼬리) → 상자 벽과 만나는 가로 모서리
                   반대쪽 끝(팁)   → 가운데 이음매
                 옆변은 경첩 축이라 손대는 좌표가 달랐고, 그래서 이 두 변은 그대로였다.
               ⚠️ **크기를 바꾸기 전에** 편다. 뒤에서 날개 쪽과 꼬리 쪽에 서로 다른 배율을
                  곱하는데, 그 뒤에 펴면 두 구간의 경계에서 평면이 어긋난다. */
            const tipPlane = pick(lengthSamples, bodySide > 0 ? 0.99 : 0.01, 0);
            const tipBand = pick(lengthSamples, bodySide > 0 ? 0.94 : 0.06, 0);
            const tailPlane = pick(lengthSamples, bodySide > 0 ? 0.01 : 0.99, 0);
            const tailBand = pick(lengthSamples, bodySide > 0 ? 0.06 : 0.94, 0);

            const straightenLength = (value: number) => {
              if (bodySide > 0) {
                if (value >= tipBand) return tipPlane;
                if (value <= tailBand) return tailPlane;
              } else {
                if (value <= tipBand) return tipPlane;
                if (value >= tailBand) return tailPlane;
              }
              return value;
            };

            /* ── 2차: 실제로 옮긴다 ──────────────────────────────────────── */
            for (let i = 0; i < attribute.count; i += 1) {
              const x = attribute.getX(i);
              const y = attribute.getY(i);
              const z = attribute.getZ(i);

              const along = straightenLength(lengthOf(x, y, z));
              const onBody = bodySide > 0 ? along >= 0 : along <= 0;
              const u = along * (onBody ? factor : tailFactor);

              if (flap.axis === "z") {
                // Rz: 접힌 자세의 두께 성분 / 폭은 z
                const raw = Math.min(ceilingV, Math.max(floorV, x * sin + y * cos));
                const v = midV + (raw - midV) * squash;
                const side = straighten(z);
                attribute.setXYZ(i, u * cos + v * sin, -u * sin + v * cos, side);
              } else {
                // Rx: 접힌 자세의 두께 성분 / 폭은 x
                const raw = Math.min(ceilingV, Math.max(floorV, y * cos - z * sin));
                const v = midV + (raw - midV) * squash;
                const side = straighten(x);
                attribute.setXYZ(i, side, v * cos + u * sin, -v * sin + u * cos);
              }
            }

            attribute.needsUpdate = true;

            /* ⚠️ 법선을 다시 구한다. 삐친 정점을 깎으면 그 자리 면의 방향이 바뀌는데,
                  옛 법선을 그대로 두면 평평해진 자리에 뾰족했을 때의 그림자가 남는다. */
            geometry.computeVertexNormals();
            geometry.computeBoundingBox();
            geometry.computeBoundingSphere();
            flap.reach *= factor;
            flap.thickness *= squash;
          };

          /* 몸체의 바깥 벽 위치. 꼬리를 이 안으로 밀어 넣으면 벽에 가려 안 보인다 */
          const bodyBounds = new THREE.Box3().setFromObject(body);

          for (const axis of ["z", "x"] as const) {
            const pair = found.filter((flap) => flap.axis === axis);
            if (pair.length !== 2) continue;

            // 뻗어 나가는 방향 = 경첩 축이 아닌 쪽
            const outwardKey = axis === "z" ? "x" : "z";
            const separation = Math.abs(
              pair[0]!.node.position[outwardKey] - pair[1]!.node.position[outwardKey],
            );
            if (!Number.isFinite(separation) || separation <= 0) continue;

            /* 각자 절반씩 오면 가운데서 만난다. 거기에 1% 를 더 준다(약 0.006).
               끝단이 완벽한 직선이 아니라서다 — 실측 편차가 0.003 이라, 딱 절반으로 맞추면
               울퉁불퉁한 부분에 실금이 남는다. 그 편차의 두 배를 여유로 잡았다. */
            const needed = (separation / 2) * 1.01;
            for (const flap of pair) {
              /* 경첩에서 바깥 벽까지의 거리 = 꼬리를 남길 길이.
                 ★ 한때 70% 만 남겼다. 끝변이 들쭉날쭉해서 딱 맞추면 굽은 자리가 벽을 뚫고
                   나왔기 때문이다. 이제 그 변을 평면에 붙여 폈으니 **벽까지 꽉 채운다.**
                   그래야 날개 끝이 벽 바깥면과 나란히 만나 가로 모서리가 한 줄로 떨어진다 —
                   짧게 두면 벽 위에 턱이 생기고, 그 턱에서 잘린 단면이 그대로 보인다. */
              const hinge = flap.node.position[outwardKey];
              const wall = hinge < 0 ? bodyBounds.min[outwardKey] : bodyBounds.max[outwardKey];
              const tailKeep = Math.max(0.002, Math.abs(wall - hinge));

              /* ⚠️ 배율이 1 이하라도 부른다. 날개가 이미 충분히 길더라도 **꼬리는
                    다듬어야** 하기 때문이다 — 그 둘을 한 함수가 같이 처리한다. */
              const boxWidth = Math.max(
                bodyBounds.max.x - bodyBounds.min.x,
                bodyBounds.max.z - bodyBounds.min.z,
              );
              stretchFlap(
                flap,
                Math.max(1, needed / flap.reach),
                tailKeep,
                boxWidth * FLAP_THICKNESS_RATIO,
              );
            }
          }

          /* ── ★ 몸체 윗 테두리 깎기 ────────────────────────────────────────
             화면에서 상자 윗변을 따라 **톱니 왕관**처럼 삐죽삐죽 솟아 있던 것의 정체다.
             날개가 아니라 **몸체 벽의 잘린 단면**이다 — 날개를 떼어낸 자리라 골판지의 골이
             그대로 드러나 있고, 그 골이 규칙적인 톱니로 보인다. 실측으로 테두리 중앙값보다
             0.0125 (상자 높이의 1.5%) 솟아 있었다.

             ★ 깎을 높이를 상수로 두지 않고 **접는 선**을 쓴다. 벽이 끝나고 날개가 시작되는
               자리가 곧 경첩이고, 경첩의 높이는 이미 알고 있다(각 날개 노드의 y). 그 평균이
               곧 "벽이 여기서 끝나야 한다"는 높이다. 상자가 바뀌어도 따라온다.
             ⚠️ 위로 솟은 것만 눌러 내린다. 아래로 파인 곳까지 끌어올리면 벽면 정점이 위로
                끌려 올라가 벽이 우그러진다. 솟은 쪽만 없애도 왕관은 사라진다 — 실루엣을
                만드는 건 파인 곳이 아니라 솟은 곳이다.
             ⚠️ 몸체 노드에 이동이 걸려 있을 수 있으므로 로컬 좌표로 환산해서 자른다. */
          if (found.length >= 2) {
            const foldY =
              found.reduce((sum, flap) => sum + flap.baseY, 0) / found.length;
            const localRim = foldY - body.position.y;
            const bodyPosition = body.geometry.getAttribute(
              "position",
            ) as THREE_NS.BufferAttribute;

            /* ★ **높이만 깎아서는 부족했다.** 위로 솟은 것을 눌러도 벽의 윗변이 **안팎으로**
                 들쭉날쭉한 건 그대로라, 보는 각도에 따라 여전히 톱니로 보인다. 잘린 단면이
                 벽면에서 나왔다 들어갔다 하기 때문이다.
               ★ 그래서 테두리 근처(윗변에서 0.03 안쪽)의 **바깥면 정점을 벽 평면에 붙인다.**
                 나온 것은 들어가고 파인 것은 나와서 윗변이 곧은 네모가 된다.
               ⚠️ **바깥면만** 만진다. 벽은 안팎 두 겹인데 안쪽 면까지 밖으로 밀면 테두리에서
                  벽 두께가 사라져 칼날처럼 얇아진다. 바깥 평면에서 0.03 안쪽에 있는 것만
                  고르면 바깥면만 잡힌다.
               ⚠️ x·z 를 각각 본다. 상자가 정사각형이 아니고 bbox 도 좌우 비대칭이라,
                  "가장 바깥"이 면마다 다르다. */
            body.geometry.computeBoundingBox();
            const shape = body.geometry.boundingBox;
            const rimBand = 0.03; // 테두리로 볼 높이
            const faceBand = 0.03; // 바깥면으로 볼 두께

            let trimmed = 0;
            for (let i = 0; i < bodyPosition.count; i += 1) {
              const y = bodyPosition.getY(i);
              if (y <= localRim - rimBand) continue;

              if (y > localRim) {
                bodyPosition.setY(i, localRim);
                trimmed += 1;
              }
              if (shape === null) continue;

              const x = bodyPosition.getX(i);
              if (x > shape.max.x - faceBand) bodyPosition.setX(i, shape.max.x);
              else if (x < shape.min.x + faceBand) bodyPosition.setX(i, shape.min.x);

              const z = bodyPosition.getZ(i);
              if (z > shape.max.z - faceBand) bodyPosition.setZ(i, shape.max.z);
              else if (z < shape.min.z + faceBand) bodyPosition.setZ(i, shape.min.z);
            }

            bodyPosition.needsUpdate = true;
            /* 눌린 자리의 면 방향이 바뀌었으니 법선을 다시 구한다 — 안 그러면 평평해진
               자리에 뾰족했을 때의 그림자가 남는다 */
            body.geometry.computeVertexNormals();
            body.geometry.computeBoundingBox();
            body.geometry.computeBoundingSphere();
            void trimmed;
          }

          return found.length >= 2 ? found : [];
        })();

        /**
         * 날개를 진행도만큼 접는다. **0 = 열림, 1 = 닫힘.**
         * 테이프 길이를 재려면 닫아 본 뒤 되돌려야 해서, 접는 일만 따로 떼어 두었다.
         */
        /**
         * 한 장이 접히는 곡선 — **끝에서 살짝 지나쳤다가 제자리로 돌아온다.**
         *
         * ★ 순수한 smoothstep 은 목표에 닿고 그대로 선다. 실제 골판지 날개는 눕는 순간
         *   제 무게로 살짝 더 내려갔다가 종이의 탄성으로 되올라온다. 그 한 번의 흔들림이
         *   있고 없고가 "접혔다"와 "각도가 바뀌었다"의 차이다.
         * ⚠️ 지나치는 양을 1.2% 로 묶었다. 202° 회전이라 1.2% 면 약 2.4°, 날개 끝이 0.017
         *    내려간다. 골판지 두께(0.021)보다 작아서, 위에 얹힌 쌍이 아래 쌍을 파고들지
         *    않는다 — 이 값을 키우면 두 장이 겹쳐 보인다.
         * ⚠️ 0.82 에서 이미 목표에 닿고 남은 구간을 흔들림에 쓴다. 끝까지 다 쓰고 나서
         *    흔들면 애니메이션이 끝난 뒤에도 움직이는 것처럼 보인다.
         */
        const settle = (t: number) => {
          if (t <= 0) return 0;
          if (t >= 1) return 1;
          const reach = Math.min(1, t / 0.82);
          const eased = reach * reach * (3 - 2 * reach);
          const bounce =
            t <= 0.82 ? 0 : Math.sin(((t - 0.82) / 0.18) * Math.PI) * 0.012;
          return eased + bounce;
        };

        /**
         * 날개를 진행도만큼 접는다. **0 = 열림, 1 = 닫힘.**
         * 테이프 길이를 재려면 닫아 본 뒤 되돌려야 해서, 접는 일만 따로 떼어 두었다.
         */
        const applyFlaps = (progress: number) => {
          const whole = Math.min(1, Math.max(0, progress));
          for (const flap of riggedFlaps) {
            /* ★ 접는 순서를 시간표로 못박는다. 한 장이 각각 전체의 42% 를 쓴다:
                   안쪽 쌍  0.00~0.42 · 0.04~0.46
                   바깥 쌍  0.38~0.80 · 0.42~0.84
                   테이프           0.84~1.00
               안쪽 쌍이 다 눕기 전에 바깥 쌍이 출발한다(0.42 vs 0.38). 완전히 끊어 두면
               중간에 아무것도 안 움직이는 순간이 생겨 멈칫하고, 너무 겹치면 네 장이
               한꺼번에 움직여 순서가 안 보인다.
               ⚠️ 마지막 장이 정확히 0.84 에 끝나야 그 뒤에 테이프가 붙는다. 접히는 중에
                  테이프가 있으면 날개가 테이프를 뚫고 지나간다. */
            const from = (flap.stage === 0 ? 0 : 0.38) + 0.04 * flap.lag;
            const local = Math.min(1, Math.max(0, (whole - from) / 0.42));
            const eased = settle(local);
            flap.node.rotation[flap.axis] = flap.closedAngle * eased;

            /* ★ 나중에 접히는 쌍을 **종이 한 장 두께만큼 들어 올린다.**
                 안 그러면 네 장이 정확히 같은 높이에 눕는다. 지금 모델은 두 쌍이 서로
                 닿지 않아 z-파이팅까지 가지는 않지만, 층이 없으면 "네 장이 겹쳐 덮였다"가
                 아니라 "판 네 개가 한 평면에 놓였다"로 보인다. 실제 상자는 나중 것이
                 먼저 것 위에 올라앉는다.
               ⚠️ 진행도에 비례해 들어 올린다. 처음부터 띄워 두면 열려 있을 때 그 쌍만
                  공중에 떠 보인다.
               ⚠️ `settle` 말고 `local` 로 올린다. 높이까지 튕기면 날개가 위아래로
                  덜컹거린다 — 흔들리는 건 각도 하나면 충분하다. */
            /* ★ 들어 올리는 양이 두 단계다.
                   쌍이 다르면  **종이 한 장 두께** — 나중 쌍이 먼저 쌍 위에 앉는다
                   같은 쌍 안   **0.004 만** — 겹친 자리가 깜빡이지 않을 만큼만
               ⚠️ 같은 쌍 안의 값을 두께에 비례시켰다가 되돌렸다(두께의 40% = 0.026).
                  이유는 그게 **눈에 보이는 능선**이 되기 때문이다 — 상자 폭의 2.3% 짜리
                  단이 이음매를 따라 솟아 화면에서 밝은 띠로 보였다. 여기서 필요한 건
                  "실제로 한 장이 다른 장을 덮는 높이"가 아니라 **깊이 버퍼가 둘을 구별할
                  만큼**이고, 그건 0.004 면 충분하다. 형태는 그대로 두고 다툼만 없앤다. */
            const lift =
              flap.thickness * (flap.stage === 1 ? 1 : 0) + 0.004 * flap.lag;
            if (lift > 0) {
              flap.node.position.y = flap.baseY + lift * Math.min(1, local);
            }
          }
        };

        /* ── 봉인 테이프 ───────────────────────────────────────────────────
           실제 택배 상자처럼 **윗면을 가로질러 한 줄** 붙이고, 양 끝을 옆면으로 접어
           내린다 (사용자 요청 — 참고 사진 그대로).

           ★ 방향은 **이음매를 따라간다.** 마지막에 접히는 한 쌍이 가운데서 맞닿는 선이
             곧 이음매이고, 그 선은 그 쌍의 경첩 축과 나란하다. 여기서는 x 축이다.
             테이프는 그 선을 덮어야 하므로 x 로 길게 눕는다.
           ★ 폭은 **상자에서 잰다.** 실제 포장용 테이프는 40cm 상자에 4.8cm, 약 12% 다.
             상자 깊이의 15% 로 잡으면 어떤 호수가 와도 같은 비율로 보인다.
           ⚠️ 붙는 시점은 **날개가 다 눕고 나서**(0.84~)다. 접히는 도중에 이미 있으면
              날개가 테이프를 뚫고 지나간다.
           ⚠️ 끝동 기하를 위로 반 칸 올려 둔다(`translate(0, -h/2, 0)`). 그래야 scale.y 를
              키울 때 **위쪽 모서리에 붙은 채 아래로 자란다.** 안 그러면 가운데를 기준으로
              위아래로 자라 상자 윗면을 뚫고 올라간다. */
type Tape = {
          strip: THREE_NS.Mesh;
          ends: THREE_NS.Mesh[];
          /** 붙는 진행을 그릴 때 쓰는 조각 수 */
          columns: number;
        };

        const tape: Tape | null = (() => {
          if (riggedFlaps.length < 4) return null;

          applyFlaps(1);
          model.updateMatrixWorld(true);
          const closedBounds = new THREE.Box3().setFromObject(model);

          const spanX = closedBounds.max.x - closedBounds.min.x;
          const spanZ = closedBounds.max.z - closedBounds.min.z;
          if (!Number.isFinite(spanX) || spanX <= 0 || spanZ <= 0) {
            applyFlaps(0);
            return null;
          }

          /* 실제 포장 테이프는 40cm 상자에 4.8cm, 약 12% 다. 깊이의 15% 로 잡으면 어떤
             호수가 와도 같은 비율로 보인다 */
          const width = spanZ * 0.15;
          const length = spanX + 0.02; // 모서리를 살짝 넘겨 끊는다
          const startX = closedBounds.min.x - 0.01;
          const centerZ = (closedBounds.min.z + closedBounds.max.z) / 2;

          /* ── ★ 윗면 높이를 **가로로 훑어서** 잰다 ──────────────────────────
             한때 테이프를 `closedBounds.max.y` 한 값에 평평하게 놓았더니 **공중에 떠서**
             붙었다. 이 날개는 평평하지 않고 0.03~0.04 휘어 있어서, 그 값이 "윗면"이 아니라
             **가장 높이 솟은 혹 하나**의 높이이기 때문이다. 판 하나를 그 높이에 두면 나머지
             대부분 위로 뜬다.
             그래서 테이프를 **한 장의 판이 아니라 조각을 이어 붙인 띠**로 만들고, 조각마다
             그 자리의 윗면 높이를 따로 준다. 휜 면 위에 실제로 눌러 붙인 것처럼 앉는다.

           ★ 높이는 **레이캐스트가 아니라 정점을 훑어서** 구한다. 이 모델은 42만 삼각형이라
             광선 하나에 그 전부를 재는데, 49번이면 2천만 번이다. 마지막에 접히는 쌍(= 윗면을
             이루는 두 장)의 정점을 한 번 훑으면 같은 답이 훨씬 싸게 나온다.
           ⚠️ 테이프가 지나갈 띠(|z − 중심| ≤ 폭/2) 안의 정점만 본다. 그 밖은 테이프가 닿지
              않는 자리라 높이에 섞이면 안 된다.
           ⚠️ 정점이 하나도 없는 칸은 이웃에서 가져온다. 상자 모서리 근처는 비기 쉽다. */
          /* ★ 높이를 **테이프 폭의 양쪽 가장자리마다 따로** 잰다.
               한 줄만 재서 폭 전체에 같은 높이를 주면, 윗면이 폭 방향으로 기울어 있을 때
               한쪽 모서리가 뜬다. 실제로 화면에서 테이프 아래로 틈이 보이던 이유다.
               양쪽을 따로 재면 테이프가 그 기울기를 따라 비스듬히 앉는다. */
          const columns = 48;
          const heightsNear = new Float64Array(columns + 1).fill(Number.NEGATIVE_INFINITY);
          const heightsFar = new Float64Array(columns + 1).fill(Number.NEGATIVE_INFINITY);
          const halfWidth = width / 2;
          const sample = new THREE.Vector3();

          for (const flap of riggedFlaps) {
            if (flap.stage !== 1) continue; // 마지막에 접히는 쌍이 곧 윗면이다
            const flapPosition = (flap.node as THREE_NS.Mesh).geometry.getAttribute(
              "position",
            );
            if (flapPosition === undefined) continue;

            for (let i = 0; i < flapPosition.count; i += 2) {
              sample
                .fromBufferAttribute(flapPosition as THREE_NS.BufferAttribute, i)
                .applyMatrix4(flap.node.matrixWorld);
              const across = sample.z - centerZ;
              if (Math.abs(across) > halfWidth) continue;

              const ratio = (sample.x - startX) / length;
              if (ratio < 0 || ratio > 1) continue;
              const column = Math.round(ratio * columns);
              const lane = across < 0 ? heightsNear : heightsFar;
              if (sample.y > lane[column]!) lane[column] = sample.y;
            }
          }

          applyFlaps(0);

          /* ── 빈 칸 메우기 ────────────────────────────────────────────────
             ★ **반드시 이웃 칸에서 가져온다.** 한때 빈 칸을 `closedBounds.max.y` 로 메웠다가
               테이프 양 끝이 상자 위로 솟았다. 그 값은 상자에서 가장 높은 점(경첩 쪽에 솟은
               혹, 0.408)이라, 실제 이음매 높이(0.378)보다 0.03 이나 위였다.
               테이프는 상자보다 0.01 길게 걸치므로 **맨 끝 두 칸에는 정점이 없다** — 늘
               비는 자리다. 거기에 엉뚱한 값이 들어가면 매번 양 끝이 들린다.
             ⚠️ 순서가 중요하다. 앞뒤 끝을 **가장 가까운 아는 값**으로 먼저 채우고, 그 다음
               가운데 빈 칸을 왼쪽 값으로 잇는다. 앞에서부터 무작정 훑으면 첫 칸이 아직
               아무것도 모르는 상태라 기본값이 새어 들어간다. */
          const fillGaps = (lane: Float64Array): boolean => {
            let firstKnown = -1;
            for (let i = 0; i <= columns; i += 1) {
              if (Number.isFinite(lane[i]!)) {
                firstKnown = i;
                break;
              }
            }
            if (firstKnown < 0) return false;

            let lastKnown = firstKnown;
            for (let i = columns; i >= 0; i -= 1) {
              if (Number.isFinite(lane[i]!)) {
                lastKnown = i;
                break;
              }
            }
            for (let i = 0; i < firstKnown; i += 1) lane[i] = lane[firstKnown]!;
            for (let i = lastKnown + 1; i <= columns; i += 1) lane[i] = lane[lastKnown]!;

            let carried = lane[firstKnown]!;
            for (let i = firstKnown; i <= lastKnown; i += 1) {
              if (Number.isFinite(lane[i]!)) carried = lane[i]!;
              else lane[i] = carried;
            }
            return true;
          };

          if (!fillGaps(heightsNear) || !fillGaps(heightsFar)) return null;

          /* ── 테이프 결 ──────────────────────────────────────────────────
             ★ 색은 **오네 파랑**이다 (사용자 결정). CJ대한통운 상자에 실제로 쓰는 색이라
               앞면 인쇄와 같은 말을 한다.
             ★ 단색 판으로 두면 "파란 종잇조각"으로 보인다. 실제 테이프는 두 가지가 눈에
               띈다: **길이 방향으로 흐르는 결**과 **가장자리가 살짝 어두운 것**(접착면이
               비쳐서 그렇다). 그 둘만 넣어도 테이프로 읽힌다.
             ⚠️ 세로(v)로만 변하고 가로(u)로는 한결같은 그림이라, 결이 길이 방향으로 흐른다. */
          const tapeCanvas = document.createElement("canvas");
          tapeCanvas.width = 4;
          tapeCanvas.height = 64;
          const paint = tapeCanvas.getContext("2d");
          if (paint !== null) {
            for (let row = 0; row < tapeCanvas.height; row += 1) {
              const across = row / (tapeCanvas.height - 1);
              const edge = Math.min(1, Math.min(across, 1 - across) / 0.12);
              const shade = 0.78 + 0.22 * edge;
              const noise = Math.sin(row * 12.9898) * 43758.5453;
              const grain = 0.975 + 0.05 * (noise - Math.floor(noise));
              const level = Math.max(0, Math.min(1, shade * grain));
              /* 오네(CJ대한통운) 파랑. 로고 파랑을 그대로 쓰면 상자 위에서 너무 튀어서,
                 인쇄된 로고보다 한 단계 낮은 채도로 잡았다 — 테이프는 배경이지 주인공이 아니다 */
              paint.fillStyle = `rgb(${Math.round(32 * level)}, ${Math.round(
                86 * level,
              )}, ${Math.round(170 * level)})`;
              paint.fillRect(0, row, tapeCanvas.width, 1);
            }
          }
          const tapeTexture = new THREE.CanvasTexture(tapeCanvas);
          tapeTexture.colorSpace = THREE.SRGBColorSpace;
          tapeTexture.anisotropy = maxAnisotropy;

          /* 참고 사진의 크라프트 테이프는 반들거리지 않아서 반사를 낮게 잡았다.
             ⚠️ `DoubleSide` — 두께 없는 띠라 아래에서 올려다보면 뒷면이 보인다 */
          const material = new THREE.MeshPhongMaterial({
            map: tapeTexture,
            shininess: 18,
            specular: 0x3a3a3a,
            side: THREE.DoubleSide,
          });

          /* 판을 눕히고 한쪽 끝을 원점에 맞춘다. 그래야 조각을 왼쪽부터 순서대로 드러낼 수
             있다(scale 로 늘리면 높이 굴곡까지 같이 눌린다) */
          const stripGeometry = new THREE.PlaneGeometry(length, width, columns, 1);
          stripGeometry.rotateX(-Math.PI / 2);
          stripGeometry.translate(length / 2, 0, 0);

          const stripPosition = stripGeometry.getAttribute(
            "position",
          ) as THREE_NS.BufferAttribute;
          /* ⚠️ 띄우는 높이를 0.004 → **0.0015** 로 낮췄다. 테이프가 붙어 보이려면 사이가
                없어야 하는데, 0.004 는 상자 폭의 0.14% 라 확대해서 보면 틈으로 읽혔다.
                0 으로 두면 윗면과 같은 평면이 되어 z-파이팅으로 깜빡이므로 그 직전까지만
                내린다. */
          for (let i = 0; i < stripPosition.count; i += 1) {
            const column = i % (columns + 1);
            const lane = stripPosition.getZ(i) < 0 ? heightsNear : heightsFar;
            stripPosition.setY(i, lane[column]! + 0.0015);
          }
          stripPosition.needsUpdate = true;
          stripGeometry.computeVertexNormals();

          const strip = new THREE.Mesh(stripGeometry, material);
          strip.position.set(startX, 0, centerZ); // 높이는 정점에 이미 들어 있다
          strip.visible = false;
          stripGeometry.setDrawRange(0, 0);
          model.add(strip);

          /* 양 끝을 옆면으로 접어 내린다. 위쪽 모서리에 붙은 채 아래로 자라야 하므로
             기하를 반 칸 내려 둔다 */
          const drop = (closedBounds.max.y - closedBounds.min.y) * 0.16;
          const endGeometry = new THREE.BoxGeometry(0.008, drop, width);
          endGeometry.translate(0, -drop / 2, 0);

          const ends = [
            { x: closedBounds.min.x - 0.004, y: (heightsNear[0]! + heightsFar[0]!) / 2 },
            {
              x: closedBounds.max.x + 0.004,
              y: (heightsNear[columns]! + heightsFar[columns]!) / 2,
            },
          ].map((spot) => {
            const end = new THREE.Mesh(endGeometry, material);
            end.position.set(spot.x, spot.y + 0.004, centerZ);
            end.scale.y = 0.0001;
            end.visible = false;
            model.add(end);
            return end;
          });

          return { strip, ends, columns };
        })();

        const namedLid: THREE_NS.Object3D | null =
          lowPoly !== null || clips.length > 0 || riggedFlaps.length > 0
            ? null
            : (() => {
                let found: THREE_NS.Object3D | null = null;
                model.traverse((object) => {
                  if (found === null && /lid|flap|top|cover/i.test(object.name))
                    found = object;
                });
                return found;
              })();

        /**
         * 뚜껑이 지금 얼마나 젖혀져 있는지 **직접 잰다**(라디안).
         *
         * ★ 각도를 손으로 정하지 않는 이유: 팀원이 자른 모델은 뚜껑이 **열린 자세로** 저장돼
         *   있고(수평에서 약 130°), 그 값은 파일마다 다르다. 경첩(= 노드의 원점)에서 가장 먼
         *   정점들이 수평에서 몇 도 위에 있는지가 곧 그 각도이고, 그만큼 되돌리면 뚜껑이
         *   몸체 위에 정확히 눕는다. 다음에 다른 각도로 잘라 와도 코드를 안 고쳐도 된다.
         * ⚠️ 정점을 5개마다 하나씩만 본다 — 12만 개를 다 볼 필요가 없고, 평균이라 표본으로
         *    충분하다.
         */
        const measureOpenAngle = (lid: THREE_NS.Object3D): number => {
          const attribute = (
            lid as { geometry?: THREE_NS.BufferGeometry }
          ).geometry?.getAttribute("position");
          if (attribute === undefined) return Math.PI;

          const vertex = new THREE.Vector3();
          let maxDistance = 0;
          for (let i = 0; i < attribute.count; i += 5) {
            vertex.fromBufferAttribute(
              attribute as THREE_NS.BufferAttribute,
              i,
            );
            maxDistance = Math.max(maxDistance, Math.hypot(vertex.y, vertex.z));
          }

          let sumY = 0;
          let sumZ = 0;
          let count = 0;
          for (let i = 0; i < attribute.count; i += 5) {
            vertex.fromBufferAttribute(
              attribute as THREE_NS.BufferAttribute,
              i,
            );
            if (Math.hypot(vertex.y, vertex.z) < maxDistance * 0.9) continue;
            sumY += vertex.y;
            sumZ += vertex.z;
            count += 1;
          }
          if (count === 0) return Math.PI;
          return Math.atan2(sumY / count, sumZ / count);
        };

        const openAngle = namedLid === null ? 0 : measureOpenAngle(namedLid);

        /* ── 🐷 이스터에그: 뚜껑이 열리면 돼지가 튀어나온다 ────────────────
           마크 상자에서만 켠다. 스프라이트(항상 카메라를 바라보는 판)를 쓰는 이유는,
           돼지 이미지가 이미 **아이소메트릭으로 렌더된 그림**이라서다 — 3D 모델을 새로
           만들 필요 없이 그림 한 장을 세워 두면 상자와 같은 시점으로 보인다.

           ⚠️ 돼지는 `pivot` 이 아니라 `scene` 에 붙인다. pivot 에 붙이면 상자를 드래그해
              돌릴 때 이미 튀어나온 돼지까지 같이 끌려다닌다 — 튀어나온 순간부터는 상자와
              무관한 물체여야 한다.
           ⚠️ `NearestFilter` — 마인크래프트 그림이라 확대해도 픽셀이 뭉개지면 안 된다.
           ⚠️ "동작 줄이기"를 켠 사용자에게는 아예 만들지 않는다. 장식이라 없어도 되는
              연출이고, 갑자기 여러 개가 튀는 움직임은 그 설정이 막으려는 바로 그것이다. */
        type Pig = {
          sprite: THREE_NS.Sprite;
          vx: number;
          vy: number;
          vz: number;
          spin: number;
          age: number;
        };
        const herd: Pig[] = [];
        const pigTextures: THREE_NS.Texture[] = [];
        /** 돼지가 나오는 높이 = 상자 입구. 스케일까지 반영된 실제 크기에서 잰다 */
        let mouthY = 0.3;
        let measuredMouth = false;

        if (
          pigs &&
          !window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ) {
          const pigLoader = new THREE.TextureLoader();
          for (const url of PIG_URLS) {
            try {
              const texture = await pigLoader.loadAsync(url);
              texture.colorSpace = THREE.SRGBColorSpace;
              texture.magFilter = THREE.NearestFilter;
              pigTextures.push(texture);
            } catch {
              /* 한 장을 못 받아도 나머지로 논다 — 이스터에그가 화면을 막으면 안 된다 */
            }
          }
        }

        const releasePigs = () => {
          if (pigTextures.length === 0) return;
          /* 입구 높이는 **처음 내보낼 때** 잰다. 여기서 미리 재려 해도 pivot(크기를 입힌
             상자)이 아직 만들어지기 전이라 잴 것이 없다 — 이 함수는 항상 그 뒤에 불린다. */
          if (!measuredMouth) {
            measuredMouth = true;
            mouthY = new THREE.Box3().setFromObject(pivot).max.y;
          }
          for (let index = 0; index < PIG_COUNT; index += 1) {
            const texture = pigTextures[index % pigTextures.length];
            if (texture === undefined) continue;

            const material = new THREE.SpriteMaterial({
              map: texture,
              transparent: true,
              depthWrite: false,
            });
            const sprite = new THREE.Sprite(material);

            /* 아기 돼지가 섞이도록 크기를 흩는다. 전부 같은 크기면 복사한 티가 난다 */
            const size = 0.24 + Math.random() * 0.18;
            sprite.scale.set(size * PIG_ASPECT, size, 1);

            /* 사방으로 고르게 흩어지되 완전히 규칙적이지는 않게 — 각도를 등분한 뒤 흔든다 */
            const angle =
              (index / PIG_COUNT) * Math.PI * 2 + Math.random() * 0.7;
            sprite.position.set(
              Math.cos(angle) * 0.07,
              mouthY - 0.06,
              Math.sin(angle) * 0.07,
            );
            sprite.renderOrder = 2;
            scene.add(sprite);

            const speed = 0.4 + Math.random() * 0.5;
            herd.push({
              sprite,
              vx: Math.cos(angle) * speed,
              vy: 1.4 + Math.random() * 0.8,
              vz: Math.sin(angle) * speed,
              spin: (Math.random() - 0.5) * 5,
              age: 0,
            });
          }
        };

        /**
         * 돼지가 사라지는 높이(월드 좌표).
         *
         * ★ **시간이 아니라 위치로 정한다** (사용자 요청 — 화면 끝까지 다 내려간 다음에
         *   사라지게). 전에는 2.4초를 살고 도중에 서서히 흐려졌는데, 그러면 아직 화면
         *   한복판에 있는 돼지가 공중에서 증발했다.
         * ★ 화면 아래 끝이 월드 좌표로 어디인지는 **카메라에서 계산한다.** 원근 카메라가
         *   거리 d 에서 보여 주는 세로 높이의 절반은 `tan(화각/2) × d` 다. 화각을 넘침
         *   폭에 맞춰 이미 넓혀 뒀으므로, 이 값이 곧 넓어진 캔버스의 아래 끝이다.
         *   숫자를 손으로 박지 않아서, 넘침 폭이나 칸 크기가 바뀌어도 따라온다.
         * ⚠️ 1.05 를 곱해 조금 더 내려보낸다 — 정확히 경계에서 지우면 반쯤 잘린 돼지가
         *    깜빡이며 사라진다. 완전히 나간 뒤에 치운다.
         */
        const pigFloor =
          -Math.tan((camera.fov * Math.PI) / 360) *
          camera.position.length() *
          1.05;

        /** 매 프레임 돼지를 한 걸음 날린다 — 포물선으로 떠올랐다가 화면 밖까지 떨어진다 */
        const advancePigs = (delta: number) => {
          for (let index = herd.length - 1; index >= 0; index -= 1) {
            const pig = herd[index];
            if (pig === undefined) continue;

            pig.age += delta;
            pig.vy -= PIG_GRAVITY * delta;
            pig.sprite.position.x += pig.vx * delta;
            pig.sprite.position.y += pig.vy * delta;
            pig.sprite.position.z += pig.vz * delta;
            pig.sprite.material.rotation += pig.spin * delta;

            /* 흐려지지 않는다 — 끝까지 또렷하게 떨어지다가 화면 밖에서 치워진다.
               ⚠️ PIG_MAX_LIFE 는 안전장치다. 카메라가 바뀌어 pigFloor 를 영영 못 넘는 일이
                  생기면 돼지가 무한히 쌓인다. 눈에 보일 일은 없는 값으로 잡아 둔다. */
            if (pig.sprite.position.y < pigFloor || pig.age > PIG_MAX_LIFE) {
              scene.remove(pig.sprite);
              pig.sprite.material.dispose();
              herd.splice(index, 1);
            }
          }
        };

        /* ── 뚜껑을 움직이는 클립 ──────────────────────────────────────────
           ★ 클립을 **재생시키지 않고, 매 프레임 시간을 우리가 직접 넣는다.**
             원래는 `timeScale = -speed` 로 역재생해서 열었는데, 그러면 뚜껑이 다 열린 뒤에도
             계속 다시 열렸다. 이유는 `AnimationAction` 의 기본 루프가 `LoopRepeat` 라서다 —
             거꾸로 흐르던 시간이 0 에 닿는 순간 three 가 먼저 duration 으로 **감아 버려서**,
             우리가 "0 이하면 멈춰라"를 확인할 기회 자체가 오지 않았다.
             시간을 직접 넣으면 루프도 timeScale 도 관여하지 않는다 — 진행도가 목표에 닿으면
             그 프레임에 그대로 선다. 저폴리 상자를 굴리는 방식과도 같아져서 아래
             `advanceLid` 가 갈래 없이 한 줄이 된다.
           ⚠️ `paused = true` 로 두는 게 핵심이다. 재생 중이면 `mixer.update()` 가 우리가 넣은
              시간에 delta 를 더해 버린다. 멈춰 둔 채 시간만 바꾸고 `update(0)` 으로 그린다. */
        const mixer = new THREE.AnimationMixer(model);
        const clip: THREE_NS.AnimationClip | undefined = clips[0];
        const clipDuration = clip?.duration ?? 0;
        const clipAction = clip !== undefined ? mixer.clipAction(clip) : null;
        if (clipAction !== null) {
          clipAction.play();
          clipAction.paused = true;
        }

        /**
         * 테이프를 그릴 때인가 — **닫는 동작일 때만** true. 처음에는 없다.
         *
         * ⚠️ 선언이 여기 있어야 한다. 아래 `setClosedProgress` 가 이 값을 읽는데, 그 함수는
         *    정의된 뒤 **바로 아래에서 한 번 불린다**(상자 크기를 재려고 `setClosedProgress(1)`).
         *    `let` 은 선언 전에 읽으면 ReferenceError 를 던지고(TDZ), 그 오류를 바깥 try 가
         *    삼켜서 화면에는 "상자를 불러오지 못했습니다" 로만 보인다. 실제로 그렇게 깨졌다.
         *    여닫기 상태값들(`isClosed` 등)과 같이 아래에 두고 싶어도 여기 있어야 하는 이유다.
         */
        let tapeArmed = false;

        /**
         * 닫힘 상태를 그리는 함수 — **0 = 열림, 1 = 닫힘.**
         * 상자마다 닫히는 순서가 달라서(택배 상자는 안쪽 날개 → 바깥 날개 → 테이프),
         * 그 순서를 아는 쪽이 직접 그린다. 여기서는 진행도만 굴린다.
         * null 이면 이 모델은 클립으로 움직인다는 뜻이다.
         */
        const setClosedProgress: ((progress: number) => void) | null =
          lowPoly !== null
            ? lowPoly.setClosedProgress
            : riggedFlaps.length > 0
              ? (progress) => {
                  const whole = Math.min(1, Math.max(0, progress));
                  applyFlaps(whole);

                  /* 두 동작으로 나눈다 — 먼저 윗면을 죽 가로지르고(0.84~0.96), 그 다음
                     양 끝을 옆으로 눌러 접는다(0.94~1.00). 손으로 붙이는 순서 그대로다. */
                  if (tape !== null) {
                    // 여는 동작이면 아예 그리지 않는다 (setLidRef 의 tapeArmed 설명 참고)
                    const rolled = !tapeArmed
                      ? 0
                      : Math.min(1, Math.max(0, (whole - 0.84) / 0.12));
                    /* 조각을 왼쪽부터 하나씩 드러낸다. `scale.x` 로 늘리면 굴곡까지
                       가로로 눌려서 붙는 동안 테이프가 찌그러져 보인다. */
                    tape.strip.visible = rolled > 0;
                    tape.strip.geometry.setDrawRange(
                      0,
                      Math.ceil(rolled * tape.columns) * 6,
                    );

                    const pressed = !tapeArmed
                      ? 0
                      : Math.min(1, Math.max(0, (whole - 0.94) / 0.06));
                    for (const end of tape.ends) {
                      end.visible = pressed > 0;
                      end.scale.y = Math.max(0.0001, pressed);
                    }
                  }
                }
              : namedLid !== null
                ? (progress) => {
                    /* 잰 각도만큼 **되돌린다**. 진행도 0 이면 회전 0 = 파일에 저장된 열린 자세.
                     ⚠️ 부호가 **양수**다. X 축 회전은
                          y' = y·cosθ − z·sinθ ,  z' = y·sinθ + z·cosθ
                        이므로 각도 φ = atan2(y, z) 인 방향이 **φ − θ** 로 간다. 뚜껑이 지금
                        φ = 130° (위·뒤)에 있으니 φ = 0(앞으로 눕기)으로 보내려면 θ = +130° 다.
                        음수로 뒀더니 뚜껑이 아래로 파고들어 상자 밑으로 빠졌다 — 그게
                        "몸통과 뚜껑이 따로 논다"의 정체였다. */
                    (namedLid as THREE_NS.Object3D).rotation.x =
                      openAngle * Math.min(1, Math.max(0, progress));
                  }
                : clipAction !== null
                  ? (progress) => {
                      /* 클립은 `lid_close` 라 **시작이 열림, 끝이 닫힘**이다. 진행도를 그대로
                       시간으로 환산하면 된다 — 0 → t=0(열림), 1 → t=duration(닫힘). */
                      clipAction.time =
                        Math.min(1, Math.max(0, progress)) * clipDuration;
                      mixer.update(0);
                    }
                  : null;

        /* ★ **크기를 재기 전에 뚜껑을 닫아 둔다.** 이 순서가 "다른 상자처럼 보이던" 원인이었다.
           아래에서 모델의 바운딩박스를 재서 내치수 비율로 늘리는데, 뚜껑이 열린 채로 재면
           그 바운딩박스가 **활짝 젖혀진 뚜껑까지 감싼다**(젖혀진 뚜껑은 뒤로 z -1.5 까지 뻗는다).
           몸통은 z 1.0 인데 2.2 로 재고 그 비율로 눌러 버리니, 상자가 납작하게 찌그러져
           원본과 전혀 다른 물건으로 보였다. 닫은 자세가 곧 이 상자의 **진짜 치수**다.

           ⚠️ 그래서 위의 뚜껑 리깅(믹서·액션)이 **측정보다 먼저** 와야 한다. 클립으로 움직이는
              모델은 `setClosedProgress` 가 null 이라, 믹서를 나중에 만들면 잴 때까지 뚜껑이
              파일에 저장된 열린 자세 그대로다 — 직접 굴리는 모델만 고쳐 놓으면 반쪽이다. */
        setClosedProgress?.(1);

        /* ── 택배사 인쇄(데칼) ──────────────────────────────────────────────
           앞면 벽에 **얇은 판을 한 장 덧대** 그림을 얹는다. 모델의 UV 를 다시 펴는 대신
           판을 붙이는 이유는 세 가지다:
             ① 생성 모델의 UV 는 아틀라스로 구워져 있어 "앞면이 UV 의 어디인지"를 알 수 없다
             ② 판이면 어떤 모델에도 같은 코드로 붙고, 원본 텍스처를 훼손하지 않는다
             ③ 위치·크기를 숫자로 조절할 수 있어 눈으로 맞추기 쉽다

           ⚠️ 앞면 위치는 **몸통을 재서** 찾는다. 전체 bbox 를 쓰면 펼쳐진 날개 끝에 판이
              붙어 허공에 뜬다 — 아래 25% 슬랩만 보고 벽 위치를 구한다.
           ⚠️ 정점은 **월드 좌표로** 읽는다. 노드에 이동·크기가 걸려 있으면 로컬 좌표는
              실제 위치가 아니다.
           ⚠️ 벽에서 0.004 만 띄운다. 딱 붙이면 z-파이팅으로 깜빡인다. */
        if (decalUrl !== undefined) {
          model.updateMatrixWorld(true);

          const decalBounds = new THREE.Box3().setFromObject(model);
          const slabTop =
            decalBounds.min.y + (decalBounds.max.y - decalBounds.min.y) * 0.25;

          let wallHalfX = 0;
          let wallHalfZ = 0;
          const point = new THREE.Vector3();

          const eachVertex = (visit: (v: THREE_NS.Vector3) => void) => {
            model.traverse((object) => {
              const mesh = object as {
                isMesh?: boolean;
                geometry?: THREE_NS.BufferGeometry;
                matrixWorld?: THREE_NS.Matrix4;
              };
              if (mesh.isMesh !== true || mesh.geometry === undefined) return;
              const attribute = mesh.geometry.getAttribute("position");
              if (attribute === undefined) return;
              for (let i = 0; i < attribute.count; i += 3) {
                point.fromBufferAttribute(
                  attribute as THREE_NS.BufferAttribute,
                  i,
                );
                if (mesh.matrixWorld !== undefined)
                  point.applyMatrix4(mesh.matrixWorld);
                visit(point);
              }
            });
          };

          eachVertex((v) => {
            if (v.y > slabTop) return;
            wallHalfX = Math.max(wallHalfX, Math.abs(v.x));
            wallHalfZ = Math.max(wallHalfZ, Math.abs(v.z));
          });

          /* 벽 꼭대기(테두리) — 발자국을 벗어난 정점이 처음 나타나는 높이.
             ⚠️ 날개가 밖으로 뻗은 모델(통짜 실사 상자)에서는 이 검사가 실제로 걸린다.
                날개를 따로 떼어 리깅하는 모델은 닫으면 아무것도 발자국 밖으로 나가지
                않아서 `rimY` 가 그대로 상자 꼭대기로 남고, 그때 `wallHeight` 는 상자
                전체 높이가 된다. 아래 비율(0.88 / 0.40)은 그 값을 기준으로 잡은 것이다. */
          let rimY = decalBounds.max.y;
          if (wallHalfX > 0 && wallHalfZ > 0) {
            eachVertex((v) => {
              if (
                Math.abs(v.x) > wallHalfX * 1.06 ||
                Math.abs(v.z) > wallHalfZ * 1.06
              ) {
                if (v.y < rimY) rimY = v.y;
              }
            });
          }
          const wallHeight = rimY - decalBounds.min.y;

          if (wallHalfX > 0 && wallHalfZ > 0 && wallHeight > 0) {
            const texture = await new THREE.TextureLoader().loadAsync(decalUrl);
            texture.colorSpace = THREE.SRGBColorSpace;
            texture.anisotropy = maxAnisotropy;

            const image = texture.image as
              { width?: number; height?: number } | undefined;
            const aspect =
              image?.width !== undefined &&
              image.height !== undefined &&
              image.height > 0
                ? image.width / image.height
                : 1.7;

            /* 벽 가로를 거의 꽉 채운다. 작은 판이 큰 벽 한가운데 놓이면 인쇄가 아니라
               붙여 놓은 스티커로 보인다 — 인쇄는 면을 따라 넓게 앉는다.
               ⚠️ 0.96 → **0.88** 로 줄였다 (사용자 지적 — 스티커가 너무 크고 높이 붙어 있다).
                  가로를 꽉 채우면 세로도 따라 커져서(가로세로 비가 고정) 벽을 거의 다 덮고,
                  그러면 "어디에 인쇄됐다"가 아니라 "벽이 곧 인쇄"가 된다. */
            let decalWidth = wallHalfX * 2 * 0.88;
            let decalHeight = decalWidth / aspect;
            const maxHeight = wallHeight * 0.72;
            if (decalHeight > maxHeight) {
              decalHeight = maxHeight;
              decalWidth = decalHeight * aspect;
            }

            /* ★ **곱하기 합성**으로 얹는다 — "붙인 것"과 "인쇄된 것"을 가르는 한 줄이다.
                 결과색 = 그림색 × 바탕색
               이라 그림의 흰 바탕은 1 을 곱하는 셈이라 사라지고(골판지가 그대로 비친다)
               잉크가 있는 진한 부분만 남는다. 골판지의 결·그림자가 인쇄 위로 그대로 지나간다.
               ⚠️ 재질이 Lambert 가 아니라 **Basic** 이다. 바탕 벽은 이미 빛을 받아 그려져
                  있으므로, 곱해질 그림까지 빛 계산을 하면 두 번 어두워진다.
               ⚠️ `depthWrite: false` + `renderOrder` — 아주 얇게 떠 있는 판이라 깊이를 쓰면
                  각도에 따라 깜빡인다. */
            const decal = new THREE.Mesh(
              new THREE.PlaneGeometry(decalWidth, decalHeight),
              new THREE.MeshBasicMaterial({
                map: texture,
                transparent: true,
                blending: THREE.MultiplyBlending,
                depthWrite: false,
              }),
            );
            decal.renderOrder = 1;

            /* ★ 인쇄를 **벽의 아래쪽으로** 내린다 (사용자 결정 — 너무 위에 붙어 있었다).
                 벽 높이의 0.5(정중앙) → **0.40** 지점이 인쇄의 중심이다. 실제 택배 상자도
                 로고를 가운데가 아니라 아래쪽에 얹는다 — 위쪽은 접히는 날개와 테이프가
                 지나가는 자리라 인쇄를 피한다.
               ⚠️ 바닥으로 흘러내리지 않게 묶는다. 상자 비율이 납작해지면(예: 40×30×10)
                  벽이 낮아지는데, 그때 0.40 을 그대로 쓰면 인쇄 아래쪽이 바닥 밑으로 나간다.
                  아래 여백을 벽 높이의 4% 이상으로 보장한다. */
            const decalBottomMargin = wallHeight * 0.04;
            const decalCenterY = Math.max(
              decalBounds.min.y + decalBottomMargin + decalHeight / 2,
              decalBounds.min.y + wallHeight * 0.4,
            );
            decal.position.set(0, decalCenterY, wallHalfZ + 0.004);
            model.add(decal);
          }
        }

        /* ── 실제 박스 비율 입히기 ────────────────────────────────────────
           모델을 단위 정육면체로 정규화한 뒤, 내치수를 가장 긴 변 기준으로 normalize 해서
           축마다 다시 곱한다. cm 의 [가로, 세로, 높이] 를 3D 의 [x, y, z] 에 맞춘다
           (three 는 y 가 위쪽이고, 박스의 "세로"는 바닥면의 깊이라 z 다). */
        const box = new THREE.Box3().setFromObject(model);
        const size = new THREE.Vector3();
        const center = new THREE.Vector3();
        box.getSize(size);
        box.getCenter(center);

        const [wCm, dCm, hCm] = ratioKey.split(",").map(Number);
        const longest = Math.max(wCm, dCm, hCm, 1);

        const pivot = new THREE.Group();
        model.position.sub(center); // 모델을 자기 중심에 맞춘다(회전이 중심을 돌게)
        pivot.add(model);
        pivot.scale.set(
          (1 / Math.max(size.x, 1e-6)) * (wCm / longest),
          (1 / Math.max(size.y, 1e-6)) * (hCm / longest),
          (1 / Math.max(size.z, 1e-6)) * (dCm / longest),
        );
        scene.add(pivot);

        /* 카메라 거리 = 상자 크기. 세 값을 같은 비율로 줄이면 커지고, 너무 줄이면 잘린다 */
        camera.position.set(1.28, 0.92, 1.56);
        camera.lookAt(0, 0, 0);

        /** 직접 굴리는 갈래에서 쓰는 값 — 지금 진행도와 목표 진행도 (1 = 닫힘) */
        let progress = 1;
        let progressTarget = 1;
        setClosedProgress?.(progress);

        /** 지금 닫혀 있는가 */
        let isClosed = true;
        /** 🐷 이번에 여는 동안 돼지를 이미 내보냈는가 */
        let hasReleased = false;

        setLidRef.current = (open: boolean) => {
          if (open === !isClosed) return; // 이미 그 상태다 — 다시 시작하지 않는다
          isClosed = !open;
          progressTarget = open ? 0 : 1;

          /* ★ 테이프는 **닫을 때만** 나온다 (사용자 결정).
               전에는 진행도만 보고 그렸더니, 화면에 처음 뜰 때(닫힌 상태로 시작해서 열리는
               구간) 테이프가 이미 붙은 채로 나타났다가 사라졌다. 상자가 열리는 장면에
               테이프가 보이면 "뜯는 중"으로 읽혀서 뜻이 반대가 된다.
             ⚠️ 진행도가 아니라 **의도**를 기준으로 삼는다. 여닫는 방향이 정해지는 곳이
                여기뿐이라, 판단도 여기서 한 번만 한다. */
          tapeArmed = !open;
        };

        /** 매 프레임 한 걸음 움직인다. 목표에 닿으면 더 이상 아무것도 하지 않는다 —
            이 한 줄이 "다 열린 뒤에도 계속 다시 열리던" 문제의 답이다. */
        const advanceLid = (delta: number) => {
          if (setClosedProgress === null || progress === progressTarget) return;

          const step = delta / LID_SECONDS;
          progress =
            progress < progressTarget
              ? Math.min(progressTarget, progress + step)
              : Math.max(progressTarget, progress - step);
          setClosedProgress(progress);

          /* 🐷 뚜껑이 **충분히 열린 순간**에 내보낸다. 열기 시작하자마자 내보내면 아직
             닫혀 있는 뚜껑을 뚫고 나오는 것처럼 보인다. 0.45 는 틈이 눈에 보이기 시작하는
             지점이다(0 = 완전히 열림, 1 = 닫힘).
             ⚠️ `hasReleased` 로 한 번만 나가게 막는다 — 없으면 여는 동안 매 프레임 나온다.
                다시 닫으면 풀려서, 여닫을 때마다 새로 나온다. */
          if (progressTarget === 0 && progress <= PIG_TRIGGER && !hasReleased) {
            hasReleased = true;
            releasePigs();
          } else if (progressTarget === 1) {
            hasReleased = false;
          }
        };

        /* ⚠️ 여기서 lidOpen 을 직접 읽어 열지 않는다. 장면이 준비되면 아래 동기화 이펙트가
           `status` 변화를 보고 한 번 더 돌면서 그 값을 반영한다(렌더 중 ref 를 만지지 않으려고). */

        /* ── 회전(드래그) ─────────────────────────────────────────────────
           OrbitControls 를 쓰지 않는다 — 필요한 건 좌우·상하 회전 둘뿐인데 그 모듈까지
           불러오면 번들만 커진다. pointer 이벤트 세 개면 같은 일을 한다. */
        let dragging: { x: number; y: number } | null = null;
        /** 누른 뒤 손가락이 움직인 총 거리. **클릭과 드래그를 가르는 기준**이다 */
        let dragDistance = 0;
        pivot.rotation.set(-0.12, -0.6, 0);

        /* 마우스를 받는 판. 캔버스는 칸보다 커서 옆 패널을 덮으므로 쓸 수 없다.
           surface 는 칸과 정확히 같은 크기라, 상자가 밖으로 나와 있어도 조작 범위는
           "이 칸 안"으로 유지된다 — 눈에 보이는 경계와 손이 닿는 경계가 같아야 한다. */
        const surface: HTMLElement = surfaceRef.current ?? renderer.domElement;
        let touched = false;

        const onDown = (event: PointerEvent) => {
          surface.setPointerCapture(event.pointerId);
          dragging = { x: event.clientX, y: event.clientY };
          dragDistance = 0;
          touched = true;
          setWasTouched(true);
        };
        const onMove = (event: PointerEvent) => {
          if (dragging === null) return;
          const dx = event.clientX - dragging.x;
          const dy = event.clientY - dragging.y;
          dragging = { x: event.clientX, y: event.clientY };
          dragDistance += Math.abs(dx) + Math.abs(dy);
          pivot.rotation.y += dx * 0.01;
          // 위아래는 뒤집히면 어지럽고 상자 안이 안 보이므로 묶어 둔다
          pivot.rotation.x = Math.min(
            0.9,
            Math.max(-0.9, pivot.rotation.x + dy * 0.01),
          );
        };
        const onUp = () => {
          /* ★ 움직이지 않고 뗐으면 **클릭**이다 — 뚜껑을 여닫는다 (사용자 결정).
             한 번 누르면 열리고 **열린 채로 멈춘다**, 다시 누르면 닫힌다.
             ⚠️ 임계값이 필요한 이유: 상자를 돌리려고 끈 것도 브라우저에게는 클릭이다.
                그냥 onClick 을 달면 돌릴 때마다 뚜껑이 같이 여닫힌다.
             ⚠️ 6px 은 "손이 떨린 것"과 "돌리려던 것"의 경계다. 터치에서는 완전히 가만히
                누르기가 어려워서 0 으로 두면 클릭이 거의 인식되지 않는다. */
          if (dragging !== null && dragDistance < 6) {
            setLidRef.current?.(isClosed);
          }
          dragging = null;
        };

        surface.addEventListener("pointerdown", onDown);
        surface.addEventListener("pointermove", onMove);
        surface.addEventListener("pointerup", onUp);
        surface.addEventListener("pointercancel", onUp);

        /* ── 루프 ─────────────────────────────────────────────────────────
           ⚠️ 손대기 전에만 혼자 천천히 돈다. 한 번 잡으면 멈춘다 — 계속 돌면 원하는 각도로
              세워 둘 수가 없다. "동작 줄이기"를 켠 사용자에게는 처음부터 돌지 않는다. */
        const reduceMotion = window.matchMedia(
          "(prefers-reduced-motion: reduce)",
        ).matches;
        const clock = new THREE.Clock();
        let frame = 0;

        const tick = () => {
          frame = requestAnimationFrame(tick);
          const delta = clock.getDelta();
          if (!touched && !reduceMotion) pivot.rotation.y += delta * 0.35;
          advanceLid(delta);
          advancePigs(delta);
          renderer.render(scene, camera);
        };
        tick();
        setStatus("ready");

        cleanup = () => {
          cancelAnimationFrame(frame);
          surface.removeEventListener("pointerdown", onDown);
          surface.removeEventListener("pointermove", onMove);
          surface.removeEventListener("pointerup", onUp);
          surface.removeEventListener("pointercancel", onUp);
          mixer.stopAllAction();
          lowPoly?.dispose();
          // 테이프 결은 캔버스로 만든 텍스처라 씬 정리에 안 걸린다 — 따로 버린다
          (tape?.strip.material as THREE_NS.MeshPhongMaterial | undefined)?.map?.dispose();
          /* 아직 날고 있던 돼지와 그림을 버린다. 그림(텍스처)은 여러 돼지가 나눠 쓰므로
             스프라이트를 지우는 것만으로는 안 없어진다 — 따로 버려야 한다. */
          for (const pig of herd) {
            scene.remove(pig.sprite);
            pig.sprite.material.dispose();
          }
          herd.length = 0;
          for (const texture of pigTextures) texture.dispose();

          /* WebGL 자원은 GC 가 걷어가지 않는다. 안 버리면 화면을 몇 번 오간 뒤
             "too many WebGL contexts" 로 3D 가 통째로 안 뜬다. */
          scene.traverse((object) => {
            const mesh = object as {
              geometry?: { dispose?: () => void };
              material?: unknown;
            };
            mesh.geometry?.dispose?.();
            const materials = Array.isArray(mesh.material)
              ? mesh.material
              : mesh.material === undefined
                ? []
                : [mesh.material];
            for (const material of materials) {
              const record = material as Record<string, unknown> & {
                dispose?: () => void;
              };
              for (const key of [
                "map",
                "normalMap",
                "roughnessMap",
                "metalnessMap",
              ]) {
                const texture = record[key];
                if (texture instanceof THREE.Texture) texture.dispose();
              }
              record.dispose?.();
            }
          });
          renderer.dispose();
          renderer.domElement.remove();
          setLidRef.current = null;
        };
      } catch {
        /* 모델을 못 불러와도 화면 전체가 죽으면 안 된다 — 이름·치수는 옆에 그대로 있다 */
        if (!disposed) setStatus("failed");
      }
    })();

    return () => {
      disposed = true;
      cleanup?.();
    };
  }, [ratioKey, modelUrl, pixelScale, decalUrl, pigs, spill]);

  /* 화면 흐름(스캔·포장 완료)이 lidOpen 을 바꾸면 뚜껑이 따라 움직인다.
     `status` 를 의존성에 넣는 이유: 3D 가 준비되기 전에 lidOpen 이 바뀌면 손잡이가 아직
     null 이라 놓친다. 준비 완료 시점에 한 번 더 돌려서 그 값을 반영한다. */
  useEffect(() => {
    setLidRef.current?.(lidOpen);
  }, [lidOpen, status]);

  return (
    /* ★ 크기를 스스로 정하지 않고 부모를 꽉 채운다 — 상자를 크게 보고 싶다는 요구로
       오른쪽 열 위쪽을 통째로 쓰게 됐고, 그때부터 칸 크기는 바깥에서 정하는 편이 맞다. */
    <div className={`flex min-h-0 flex-col gap-1 ${className}`}>
      <div
        /* ⚠️ `overflow-hidden` 을 뺐다 — 이게 상자를 자르던 장본인이다. 대신 빈 상태의
              마퀴 막대가 넘칠 일은 없으므로(칸 안에 들어가는 크기다) 잃는 것이 없다. */
        className={`${bare ? "" : w98.sunken} relative flex min-h-0 w-full flex-1 items-center justify-center`}
        style={bare ? undefined : { backgroundColor: STAGE_BG }}
        title={
          isEmpty
            ? undefined
            : "드래그해서 돌리고, 한 번 누르면 뚜껑이 열립니다"
        }
      >
        {isEmpty ? (
          /* 추천 박스가 없을 때 — 상자를 그리지 않는다(비율을 모르는데 그리면 아무 박스나
             그린 셈이다). 대신 **기다리는 중**이라고 말한다.
             ⚠️ 점선 네모를 쓰지 않는다 (사용자 결정) — 빈 상자처럼 보여서 "박스가 정해졌는데
                안 그려진 건가?" 로 읽혔다. 움직이는 막대는 그렇게 오해될 여지가 없다. */
          <div className="flex w-2/3 flex-col items-center gap-3">
            <span
              className={`${w98.mono} text-[15px] tracking-[0.08em] uppercase`}
            >
              Load 대기중
              <span className={w98.blink}>_</span>
            </span>

            {/* win98 의 마퀴 진행 막대 — 파란 블록 한 줌이 계속 지나간다.
                진행률을 모를 때 쓰던 표현이라 "토트를 스캔하기 전"이라는 상태와 정확히 맞는다 */}
            <div className={`${w98.sunken} ${w98.marquee} w-full`}>
              <div className={w98.marqueeInner}>
                {[0, 1, 2, 3, 4].map((index) => (
                  <span key={index} className={w98.marqueeBlock} />
                ))}
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* 그림판 — 칸보다 사방 SPILL 만큼 크다. 넘친 부분은 칸 밖(옆 패널 위)에
                그려지고, 마우스는 통과시킨다. z-20 이라 옆 패널보다 앞에 온다. */}
            <div
              ref={hostRef}
              className="pointer-events-none absolute z-20"
              style={{
                top: -spill,
                right: -spill,
                bottom: -spill,
                left: -spill,
              }}
            />
            {/* 조작 판 — 칸과 같은 크기. 드래그(회전)와 클릭(여닫기)을 여기서 받는다 */}
            <div
              ref={surfaceRef}
              className="absolute inset-0 z-30"
              style={{ touchAction: "none" }}
            />
            {status !== "ready" ? (
              <span
                className={`${w98.small} absolute inset-0 flex items-center justify-center text-center text-[color:var(--muted-foreground)]`}
              >
                {status === "loading"
                  ? "상자 불러오는 중…"
                  : "상자를 불러오지 못했습니다"}
              </span>
            ) : null}
          </>
        )}
      </div>

      {isEmpty || bare ? null : (
        <span className={`${w98.small} text-[color:var(--muted-foreground)]`}>
          {wasTouched ? (name ?? "박스") : "드래그 회전 · 클릭해서 여닫기"}
        </span>
      )}
    </div>
  );
}

/**
 * `modelUrl` 이 이 둘 중 하나면 파일을 받지 않고 **코드로 상자를 만든다**(low-poly-boxes.ts).
 * 실제 경로가 아니라 갈림길 표시라 슬래시로 시작하지 않는다 — GLB 경로와 섞일 일이 없다.
 *
 * ⚠️ GLB 경로(`/models/*.glb`)도 여전히 받는다. 원본과 비교하고 싶으면 page.tsx 의
 *    BOX_MODELS 에 그 경로를 한 줄 넣으면 된다 — 대신 크랙이 같이 돌아온다.
 */
export const LOW_POLY_CHEST = "lowpoly-chest";
export const LOW_POLY_CARTON = "lowpoly-carton";

/** 3D 무대 바탕색 — 흰색. 도트 상자의 짙은 외곽이 가장 또렷하게 서는 바탕이다 */
const STAGE_BG = "#ffffff";

/**
 * 뚜껑이 다 여닫히는 데 걸리는 시간(초).
 * ⚠️ `page.tsx` 의 LID_CLOSE_MS 와 짝이다 — 포장 완료 뒤 화면을 비우기 전에 그만큼 기다린다.
 */
const LID_SECONDS = 1.8;

/**
 * 날개 단면이 상자 폭에서 차지해도 되는 비율.
 *
 * 접었을 때 상자 윗변에 서는 턱의 높이다. 실제 골판지는 40cm 상자에 0.5cm, 약 1.2% 인데,
 * 스캔으로 뜬 날개는 휨까지 더해 5% 를 넘기도 한다. 2.5% 를 넘으면 그만큼 눌러 얇게 만든다.
 * ⚠️ 더 낮추지 말 것 — 판이 종잇장처럼 얇아지면 옆에서 볼 때 사라진다.
 */
const FLAP_THICKNESS_RATIO = 0.025;

/**
 * 상자가 칸 **밖으로 나올 수 있는 폭**(px, 사방).
 *
 * 상자는 돌리면 대각선만큼 커진다 — 정육면체는 최대 √3 ≈ 1.73 배다. 칸 높이의 절반쯤을
 * 여유로 두면 어떤 각도에서도 모서리가 잘리지 않는다. 96px 은 이 칸(약 260px)에서 그 값이다.
 * ⚠️ 무작정 키우지 않는다. 넘친 만큼 옆 패널을 가리고, 그만큼 픽셀도 더 그린다.
 */
const SPILL = 96;

/** 칸 높이 기준 세로 화각. 실제 화각은 넘친 만큼 넓혀서 쓴다 (위 카메라 설명 참고) */
const BASE_FOV = 32;

/* ── 🐷 이스터에그 상수 ──────────────────────────────────────────────────────
   마인크래프트 위키의 돼지 렌더 세 장. 셋 다 배경이 투명하고 같은 각도로 그려져 있어
   한 장면에 섞어 놔도 따로 놀지 않는다. */
const PIG_URLS = [
  "/textures/pigs/pig.png",
  "/textures/pigs/pig-saddled.webp",
  "/textures/pigs/pig-baby.webp",
];
/** 그림의 가로:세로 (726 × 673). 이 값으로 늘려야 돼지가 안 찌그러진다 */
const PIG_ASPECT = 726 / 673;
const PIG_COUNT = 9;
/** 중력(단위/초²). 실제 9.8 을 쓰면 화면 크기에 비해 너무 빨리 떨어져 눈에 안 남는다 */
const PIG_GRAVITY = 3.2;
/** 안전장치 — 어떤 이유로든 화면 밖으로 못 나간 돼지를 치우는 시간(초). 평소엔 안 걸린다 */
const PIG_MAX_LIFE = 20;
/** 돼지가 있는 상자의 넘침 폭. 화면 바닥까지 떨어질 거리를 벌어 준다 (위 spill 설명 참고) */
const PIG_SPILL = 420;
/** 뚜껑이 이만큼 열렸을 때 튀어나온다 (0 = 완전히 열림, 1 = 닫힘) */
const PIG_TRIGGER = 0.45;
