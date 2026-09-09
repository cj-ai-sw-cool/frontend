import type * as THREE_NS from "three";

/**
 * 저폴리 상자 두 종 — **코드로 직접 만든다.** GLB 파일이 없다.
 *
 * ★ 왜: 사용자가 만들어 온 GLB 두 개가 표면이 닫혀 있지 않았다(열린 모서리 마크 상자
 *   6,583개 · 택배 상자 9,788개, 닫힌 메시라면 0). 그 구멍으로 배경이 비쳐서 흰 금처럼
 *   보이던 것이 "크랙"의 정체였고, 재질·필터·해상도로는 고칠 수 없는 문제였다.
 *   `BoxGeometry` 로 세우면 각 판이 항상 닫힌 표면이라 구멍이 생길 수가 없다.
 *
 * ★ **속이 비어 있다.** 처음에는 몸통을 통짜 상자 하나로 만들었는데, 그러면 뚜껑을 열어도
 *   막힌 윗면이 보인다 — 상자가 아니라 나무 덩어리다. 그래서 몸통을 **벽 4장 + 바닥 1장**
 *   으로 짠다. 판마다 두께가 있고 각자 닫힌 육면체라, 속은 진짜로 비어 있으면서 표면은
 *   여전히 새지 않는다.
 *
 *     마인크래프트 상자   벽4 + 바닥 + 뚜껑 + 걸쇠 = 84 삼각형   (원본 74,679)
 *     택배 상자          벽4 + 바닥 + 날개4       = 108 삼각형  (원본 94,262)
 *
 * ── 여닫는 방식 ─────────────────────────────────────────────────────────────
 * "경첩 그룹"을 모서리에 두고 그 그룹을 돌린다. 축과 방향이 조각마다 다르므로(뚜껑은 뒤
 * 모서리에서 X 축, 택배 날개는 네 변에서 X·Z 축) 각 경첩이 자기 축과 부호를 들고 다닌다.
 * 뷰어는 `pivot.rotation[axis] = sign * angle` 한 줄로 전부 여닫는다.
 *
 * ⚠️ three 를 **정적으로 import 하지 않는다.** 이 파일을 쓰는 뷰어가 three 를 동적으로
 *    불러오므로 그 인스턴스를 인자로 받는다. 여기서 import 하면 번들에 three 가 정적으로
 *    끌려 들어와 동적 로딩이 무의미해진다(타입만 `import type` 으로 받는다).
 */

/** 뚜껑·날개가 다 열렸을 때의 각도(라디안) */
export const LID_OPEN_ANGLE = (108 * Math.PI) / 180;

/**
 * 판끼리 겹쳐 놓는 깊이.
 * 두 면이 **정확히 같은 자리**에 있으면 GPU 가 앞뒤를 못 정해 픽셀마다 다르게 골라 버린다
 * (z-파이팅 — 표면에 흰 점이 흩뿌려지고 모서리에 흰 줄이 생긴다). 살짝 파고들게 두면
 * 한쪽이 확실히 안쪽이라 그 다툼이 사라진다. 눈에 보일 만큼 크면 안 되고, 깊이 버퍼의
 * 정밀도보다는 확실히 커야 한다 — 0.01 이면 둘 다 만족한다.
 */
const OVERLAP = 0.01;

/**
 * 판 두께 — 상자마다 다르다. 속이 비었다는 것을 눈으로 보여 주는 값이면서,
 * **그 상자가 무엇으로 만들어졌는지**를 말한다. 두꺼우면 나무궤짝, 얇으면 종이상자다.
 */
const CHEST_WALL_T = 0.07; // 마크 상자 — 두꺼운 나무판
const CARTON_WALL_T = 0.025; // 택배 상자 — 얇은 골판지

/** 경첩 하나 — 어느 축을 어느 방향으로 돌려야 "열림"인가 */
export type Hinge = {
  pivot: THREE_NS.Group;
  axis: "x" | "z";
  /** +1 이면 각도를 그대로, -1 이면 반대로 돌린다 */
  sign: 1 | -1;
};

export type LowPolyBox = {
  /** 장면에 넣을 뿌리. 크기는 1×1×1 안에 들어온다 */
  root: THREE_NS.Group;
  /**
   * 닫힘 진행도를 넣으면 그 상태로 그린다. **0 = 완전히 열림, 1 = 완전히 닫힘.**
   *
   * ★ 뷰어가 경첩을 하나하나 돌리지 않고 이 함수 하나만 부른다. 상자마다 닫히는 **순서**가
   *   다르기 때문이다 — 마크 상자는 뚜껑 한 장이 그냥 덮이지만, 택배 상자는 안쪽 날개가
   *   먼저 접히고 바깥 날개가 그 위를 덮은 다음 테이프가 붙는다. 그 순서를 아는 것은
   *   상자 자신이지 뷰어가 아니다.
   */
  setClosedProgress: (progress: number) => void;
  /** 만든 자원 — 뷰어가 언마운트할 때 되돌려 준다 */
  dispose: () => void;
};

/** 0~1 로 자른다 */
function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/**
 * 구간 [from, to] 안에서의 진행도를 0~1 로 바꾼다.
 * 여러 동작을 시간 위에 늘어놓을 때 쓴다 — 안쪽 날개는 0~0.34 구간, 바깥 날개는 0.3~0.66 …
 */
function stage(progress: number, from: number, to: number): number {
  return clamp01((progress - from) / (to - from));
}

/** 만든 지오메트리·재질·텍스처를 모아 두는 작은 살림살이 */
function createBin() {
  const items: { dispose: () => void }[] = [];
  return {
    keep<T extends { dispose: () => void }>(value: T): T {
      items.push(value);
      return value;
    },
    dispose: () => items.forEach((item) => item.dispose()),
  };
}

/* ── 속이 빈 몸통 ────────────────────────────────────────────────────────────
   벽 4장 + 바닥 1장.

   ★ **판끼리 살짝 파고들게 놓는다.** 이게 이 함수의 핵심이고, 처음에 틀렸던 부분이다.
     예전에는 벽과 바닥이, 벽과 벽이 **정확히 맞닿게** 놓여 있었다. 맞닿으면 두 면이 공간의
     같은 자리에 겹치고(coplanar), 그러면 GPU 가 어느 쪽이 앞인지 정하지 못해 픽셀마다
     다르게 골라 버린다 — 표면에 흰 점이 흩뿌려지는 **z-파이팅**이다.
     겹쳐 놓으면 한쪽이 확실히 안쪽이라 그 다툼 자체가 없어진다. 파고든 부분은 어차피
     판 속이라 보이지 않는다.

   ⚠️ 그래서 좌우 벽의 깊이를 **줄이지 않고 오히려 꽉 채운다**(1). 앞뒤 벽을 파고들게 하려는
      것이다. 예전에는 겹치지 않게 줄였는데, 그게 정확히 맞닿는 상황을 만들었다.
   ⚠️ 벽 아랫단도 바닥 속으로 반 두께만큼 내려 보낸다. 바닥 위에 정확히 세우면 같은 문제다.

   ⚠️ 안쪽 면에 따로 색을 칠하지 않는다. 각 판이 닫힌 육면체라 안쪽을 향한 면도 정상 면이고,
      빛이 위에서 들어오므로 벽 안쪽은 자연히 그늘진다 — 실제 상자와 같은 이치다. */
function addOpenShell(
  THREE: typeof THREE_NS,
  bin: ReturnType<typeof createBin>,
  root: THREE_NS.Group,
  material: THREE_NS.Material,
  height: number,
  thickness: number,
) {
  const bottom = -0.5;

  /* 바닥 — 밑면 전체 */
  const floor = new THREE.Mesh(bin.keep(new THREE.BoxGeometry(1, thickness, 1)), material);
  floor.position.y = bottom + thickness / 2;
  root.add(floor);

  /* 벽 — 바닥 **속으로** 반 두께 파고든 지점에서 시작해 몸통 꼭대기까지 */
  const wallBottom = bottom + thickness / 2;
  const wallH = height - thickness / 2;
  const wallY = wallBottom + wallH / 2;

  const frontBack = bin.keep(new THREE.BoxGeometry(1, wallH, thickness));
  // 좌우 벽은 깊이를 꽉 채워 앞뒤 벽을 파고든다
  const leftRight = bin.keep(new THREE.BoxGeometry(thickness, wallH, 1));

  for (const z of [0.5 - thickness / 2, -0.5 + thickness / 2]) {
    const wall = new THREE.Mesh(frontBack, material);
    wall.position.set(0, wallY, z);
    root.add(wall);
  }
  for (const x of [0.5 - thickness / 2, -0.5 + thickness / 2]) {
    const wall = new THREE.Mesh(leftRight, material);
    wall.position.set(x, wallY, 0);
    root.add(wall);
  }
}

/* ── 마인크래프트 상자 ───────────────────────────────────────────────────────
   원작 비례를 따랐다: 16픽셀 중 뚜껑이 위 5칸, 몸통이 아래 10칸, 그 사이에 걸쇠. */
const CHEST_LID_H = 1 / 3;
const CHEST_BODY_H = 1 - CHEST_LID_H;

export function buildLowPolyChest(THREE: typeof THREE_NS): LowPolyBox {
  const bin = createBin();
  const wood = bin.keep(new THREE.MeshLambertMaterial({ map: bin.keep(makePlankTexture(THREE)) }));
  const metal = bin.keep(new THREE.MeshLambertMaterial({ map: bin.keep(makeMetalTexture(THREE)) }));

  const root = new THREE.Group();
  addOpenShell(THREE, bin, root, wood, CHEST_BODY_H, CHEST_WALL_T);

  /* 뚜껑 — 경첩은 몸통 윗면의 **뒤쪽 모서리**다. 경첩 그룹을 그 모서리에 두고 뚜껑을 그
     앞쪽에 얹으면 회전 한 번으로 여닫힌다. 뚜껑은 통짜 판이 맞다(원작도 그렇다).
     ⚠️ 부호가 -1 인 이유: X 축 회전은 +z 를 아래로 내린다(y' = -sinθ). 뚜껑 앞모서리(+z)가
        위로 들려야 하므로 뒤집는다. */
  const lidPivot = new THREE.Group();
  lidPivot.position.set(0, -0.5 + CHEST_BODY_H, -0.5);
  root.add(lidPivot);

  const lid = new THREE.Mesh(bin.keep(new THREE.BoxGeometry(1, CHEST_LID_H, 1)), wood);
  /* ⚠️ 아랫면을 몸통 꼭대기보다 OVERLAP 만큼 **내려** 앉힌다. 정확히 얹으면 뚜껑 밑면과
     벽 윗면이 같은 자리에 겹쳐 z-파이팅으로 흰 줄이 생긴다(앞면 한가운데 세로줄이 그것이었다). */
  lid.position.set(0, CHEST_LID_H / 2 - OVERLAP, 0.5);
  lidPivot.add(lid);

  /* 걸쇠 — 뚜껑과 몸통 사이 앞면의 작은 쇳조각. 이것 하나로 "마크 상자"가 된다 */
  const latch = new THREE.Mesh(bin.keep(new THREE.BoxGeometry(0.16, 0.18, 0.06)), metal);
  latch.position.set(0, -0.5 + CHEST_BODY_H - 0.03, 0.5 + 0.02);
  root.add(latch);

  return {
    root,
    /* 뚜껑 한 장이라 순서랄 게 없다 — 진행도를 그대로 각도로 쓴다 */
    setClosedProgress: (progress) => {
      lidPivot.rotation.x = -LID_OPEN_ANGLE * (1 - clamp01(progress));
    },
    dispose: bin.dispose,
  };
}

/* ── 택배 상자 ───────────────────────────────────────────────────────────────
   위가 열린 몸통 + 네 변의 날개. 닫히면 날개가 눕고, 열리면 바깥으로 젖혀진다. */
const CARTON_BODY_H = 0.8;
const FLAP_T = 0.02; // 날개 한 겹 — 벽과 같은 골판지다
/**
 * 날개 길이. **절반(0.5)보다 조금 짧다.**
 * 정확히 절반이면 마주 보는 두 날개가 가운데서 딱 맞닿아 z-파이팅으로 흰 줄이 생긴다.
 * 조금 짧게 두면 가운데에 가는 틈이 생기는데, 실제 택배 상자도 그 자리에 이음매가 있다 —
 * 문제를 없애면서 오히려 더 그럴듯해진다. 그 틈은 아래쪽 안쪽 날개가 가린다.
 */
const FLAP_REACH = 0.47;
/** 안쪽 날개(좌우)와 바깥 날개(앞뒤)의 높이 차 — 실제 상자도 안쪽을 먼저 접고 바깥을 덮는다 */
const FLAP_LAYER = FLAP_T * 0.8;

export function buildLowPolyCarton(THREE: typeof THREE_NS): LowPolyBox {
  const bin = createBin();
  const cardboard = bin.keep(
    new THREE.MeshLambertMaterial({ map: bin.keep(makeCardboardTexture(THREE)) }),
  );

  const root = new THREE.Group();
  addOpenShell(THREE, bin, root, cardboard, CARTON_BODY_H, CARTON_WALL_T);

  /* 날개 4장 — 몸통 윗면의 네 모서리가 경첩이다.
     닫힌 상태(각도 0)에서는 날개가 **눕는다**(위를 덮는다). 열면 바깥으로 젖혀진다.
     ⚠️ 축과 부호가 변마다 다르다. 자유단(안쪽 끝)이 위로 들려야 "열림"인데, 회전 공식상
        그 방향이 변에 따라 뒤집히기 때문이다 — 아래 표가 그 결과다. */
  const topY = -0.5 + CARTON_BODY_H;
  const frontBackFlap = bin.keep(new THREE.BoxGeometry(1, FLAP_T, FLAP_REACH));
  const sideFlap = bin.keep(new THREE.BoxGeometry(FLAP_REACH, FLAP_T, 1));

  const specs: {
    at: [number, number, number];
    offset: [number, number, number];
    axis: "x" | "z";
    sign: 1 | -1;
    geometry: THREE_NS.BoxGeometry;
  }[] = [
    // 앞(+z) — 안쪽(-z)으로 뻗는다. 바깥 날개라 조금 위에 얹힌다
    { at: [0, topY + FLAP_LAYER, 0.5], offset: [0, 0, -FLAP_REACH / 2], axis: "x", sign: 1, geometry: frontBackFlap },
    // 뒤(-z) — 안쪽(+z)으로
    { at: [0, topY + FLAP_LAYER, -0.5], offset: [0, 0, FLAP_REACH / 2], axis: "x", sign: -1, geometry: frontBackFlap },
    // 오른쪽(+x) — 안쪽(-x)으로. 안쪽 날개라 조금 아래에 깔린다
    { at: [0.5, topY - FLAP_LAYER, 0], offset: [-FLAP_REACH / 2, 0, 0], axis: "z", sign: -1, geometry: sideFlap },
    // 왼쪽(-x) — 안쪽(+x)으로
    { at: [-0.5, topY - FLAP_LAYER, 0], offset: [FLAP_REACH / 2, 0, 0], axis: "z", sign: 1, geometry: sideFlap },
  ];

  /* 안쪽(좌우)과 바깥(앞뒤)을 나눠 둔다 — 닫는 순서가 다르기 때문이다 */
  const innerHinges: Hinge[] = [];
  const outerHinges: Hinge[] = [];

  specs.forEach((spec, index) => {
    const pivot = new THREE.Group();
    pivot.position.set(...spec.at);
    root.add(pivot);

    const flap = new THREE.Mesh(spec.geometry, cardboard);
    flap.position.set(...spec.offset);
    pivot.add(flap);

    const hinge: Hinge = { pivot, axis: spec.axis, sign: spec.sign };
    // specs 의 앞 둘이 바깥(앞뒤), 뒤 둘이 안쪽(좌우)이다
    (index < 2 ? outerHinges : innerHinges).push(hinge);
  });

  /* ── 테이프 ────────────────────────────────────────────────────────────
     날개가 다 덮인 뒤 가운데 이음매를 따라 **왼쪽에서 오른쪽으로 붙는다**.

     ⚠️ 방향이 한때 90° 틀려 있었다. 테이프는 아무 데나 붙는 게 아니라 **바깥 날개 두 장이
        맞닿는 이음매**를 덮는 물건이다. 바깥 날개는 앞뒤(±z)에 달려 있으므로 둘이 만나는
        선은 z=0 을 지나 **x 방향으로** 뻗는다. 테이프도 그 선을 따라 x 로 누워야 한다.
     ⚠️ 길이를 바꾸는 대신 **z 방향 스케일**을 0→1 로 키운다. 지오메트리를 매 프레임 다시
        만들면 GPU 로 계속 올려야 하지만, 스케일은 행렬 한 줄이라 공짜에 가깝다.
     ⚠️ 그룹을 하나 끼우고 그 안에서 테이프를 절반만큼 밀어 둔다. 그래야 스케일이 가운데가
        아니라 **앞끝에서부터** 자란다 — 테이프는 한쪽 끝을 붙이고 밀어 나가는 물건이다. */
  const tapeGroup = new THREE.Group();
  tapeGroup.position.set(-0.5, topY + FLAP_LAYER + FLAP_T / 2 + 0.004, 0);
  root.add(tapeGroup);

  const tape = new THREE.Mesh(
    bin.keep(new THREE.BoxGeometry(1, 0.008, 0.17)),
    bin.keep(
      new THREE.MeshLambertMaterial({
        map: bin.keep(makeTapeTexture(THREE)),
        transparent: true,
        opacity: 0.94, // 포장 테이프는 완전히 불투명하지 않다
      }),
    ),
  );
  tape.position.x = 0.5; // 한쪽 끝을 그룹 원점에 맞춘다 — 거기서부터 자란다
  tapeGroup.add(tape);

  /* 운송장 — "이건 택배 상자다"를 한눈에 말하는 물건. 앞면 벽에 아주 얇게 얹는다.
     ⚠️ 벽면에서 0.002 만 띄운다. 딱 붙이면 같은 자리에 두 면이 놓여 z-파이팅으로 깜빡인다. */
  const label = new THREE.Mesh(
    bin.keep(new THREE.PlaneGeometry(0.44, 0.3)),
    bin.keep(new THREE.MeshLambertMaterial({ map: bin.keep(makeLabelTexture(THREE)) })),
  );
  label.position.set(0, -0.5 + CARTON_BODY_H * 0.45, 0.5 + 0.002);
  root.add(label);

  return {
    root,
    /**
     * 닫히는 순서 — 실제 택배 상자를 접는 순서 그대로다.
     *   0.00~0.34  안쪽 날개(좌우)가 먼저 접힌다
     *   0.30~0.66  바깥 날개(앞뒤)가 그 위를 덮는다  (살짝 겹쳐 시작해 끊기지 않게)
     *   0.66~1.00  테이프가 앞에서 뒤로 붙는다
     * 여는 것은 이 값을 1→0 으로 되돌리면 되므로, 테이프가 먼저 떨어지고 바깥 날개가 열린 뒤
     * 안쪽 날개가 열린다 — 순서까지 저절로 뒤집힌다.
     *
     * ⚠️ 안쪽이 먼저 접혀야 마주 보는 날개끼리 **겹치지 않는다.** 동시에 접으면 네 장이
     *    가운데서 서로 파고들어 지저분해진다.
     */
    setClosedProgress: (progress) => {
      const p = clamp01(progress);

      const innerAngle = LID_OPEN_ANGLE * (1 - stage(p, 0, 0.34));
      for (const hinge of innerHinges) {
        hinge.pivot.rotation[hinge.axis] = hinge.sign * innerAngle;
      }

      const outerAngle = LID_OPEN_ANGLE * (1 - stage(p, 0.3, 0.66));
      for (const hinge of outerHinges) {
        hinge.pivot.rotation[hinge.axis] = hinge.sign * outerAngle;
      }

      const tapeLength = stage(p, 0.66, 1);
      tapeGroup.scale.x = Math.max(tapeLength, 0.0001); // 0 이면 행렬이 뭉개진다
      tapeGroup.visible = tapeLength > 0.001;
    },
    dispose: bin.dispose,
  };
}

/* ── 텍스처 ──────────────────────────────────────────────────────────────────
   16×16 캔버스에 직접 점을 찍는다. 마인크래프트 텍스처가 딱 이 크기다.
   ⚠️ `NearestFilter` + 밉맵 끄기 — 이게 없으면 그냥 흐린 갈색 판이 된다.
   ⚠️ 좌표 해시로 얼룩을 찍는다. Math.random 을 쓰면 렌더할 때마다 무늬가 달라진다. */

const TEX_SIZE = 16;

function makePlankTexture(THREE: typeof THREE_NS): THREE_NS.Texture {
  return makeTexture(THREE, (ctx, size) => {
    ctx.fillStyle = "#8a6134"; // 참나무
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = "#6d4a26"; // 나뭇결
    for (let y = 3; y < size; y += 4) ctx.fillRect(0, y, size, 1);
    ctx.fillStyle = "#79532c";
    speckle(ctx, size, 7, 0);
    ctx.strokeStyle = "#4d3319"; // 블록 경계 — 마크 텍스처의 특징
    ctx.strokeRect(0.5, 0.5, size - 1, size - 1);
  });
}

function makeMetalTexture(THREE: typeof THREE_NS): THREE_NS.Texture {
  return makeTexture(THREE, (ctx, size) => {
    ctx.fillStyle = "#b0b0b0";
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = "#8a8a8a";
    speckle(ctx, size, 5, 9);
    ctx.strokeStyle = "#5a5a5a";
    ctx.strokeRect(0.5, 0.5, size - 1, size - 1);
  });
}

/* ── 골판지 ──────────────────────────────────────────────────────────────────
   ⚠️ 마크 텍스처와 **정반대로** 만든다 (사용자 지적 — 택배 상자까지 마크처럼 보였다).
      마크 느낌을 만들던 것이 셋이었다: ① 16×16 저해상도 ② 칸마다 두른 짙은 외곽선
      ③ NearestFilter 확대. 택배 상자는 그 셋을 전부 뒤집는다 —
      64×64 로 올리고, 외곽선을 지우고, 부드럽게 확대한다(makeTexture 의 crisp=false).
      남는 것은 크라프트지 색과 아주 가는 골 결, 그리고 종이 섬유 얼룩이다. */
const CARTON_TEX = 64;

function makeCardboardTexture(THREE: typeof THREE_NS): THREE_NS.Texture {
  return makeTexture(
    THREE,
    (ctx, size) => {
      ctx.fillStyle = "#c9a173"; // 크라프트지
      ctx.fillRect(0, 0, size, size);

      /* 골 결 — 골판지 특유의 세로 물결. 아주 옅어야 한다. 진하면 줄무늬 벽지가 된다 */
      for (let x = 0; x < size; x += 4) {
        ctx.fillStyle = "rgba(150, 110, 70, 0.16)";
        ctx.fillRect(x, 0, 2, size);
        ctx.fillStyle = "rgba(240, 215, 180, 0.14)";
        ctx.fillRect(x + 2, 0, 1, size);
      }

      /* 종이 섬유 — 낱개 점. 골고루 흩어져야 재생지처럼 보인다 */
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          const h = hash(x, y);
          if (h % 23 === 0) {
            ctx.fillStyle = "rgba(120, 85, 50, 0.22)";
            ctx.fillRect(x, y, 1, 1);
          } else if (h % 31 === 0) {
            ctx.fillStyle = "rgba(255, 240, 215, 0.20)";
            ctx.fillRect(x, y, 1, 1);
          }
        }
      }
    },
    { size: CARTON_TEX, crisp: false },
  );
}

/** 운송장 — 흰 종이에 바코드와 글줄 몇 개. 멀리서 봤을 때의 인상만 맞으면 된다 */
function makeLabelTexture(THREE: typeof THREE_NS): THREE_NS.Texture {
  return makeTexture(
    THREE,
    (ctx, size) => {
      ctx.fillStyle = "#f4f1e8";
      ctx.fillRect(0, 0, size, size);

      // 위쪽 글줄
      ctx.fillStyle = "#4a4a4a";
      for (let i = 0; i < 4; i++) {
        ctx.fillRect(6, 8 + i * 7, size - 12 - (i % 2) * 14, 3);
      }

      // 가로줄
      ctx.fillStyle = "#9a9a9a";
      ctx.fillRect(4, 40, size - 8, 1);

      // 바코드 — 굵기가 제각각이어야 바코드로 보인다
      ctx.fillStyle = "#111111";
      let x = 8;
      let seed = 0;
      while (x < size - 8) {
        const w = 1 + (hash(seed, 3) % 3);
        ctx.fillRect(x, 46, w, 14);
        x += w + 1 + (hash(seed, 7) % 2);
        seed += 1;
      }
    },
    { size: CARTON_TEX, crisp: false },
  );
}

/** 포장 테이프 — 누런 반투명 비닐에 세로 결이 보인다 */
function makeTapeTexture(THREE: typeof THREE_NS): THREE_NS.Texture {
  return makeTexture(
    THREE,
    (ctx, size) => {
      ctx.fillStyle = "#e8dcb8";
      ctx.fillRect(0, 0, size, size);
      // 늘어난 비닐의 결
      for (let x = 0; x < size; x += 3) {
        ctx.fillStyle = "rgba(255, 255, 255, 0.30)";
        ctx.fillRect(x, 0, 1, size);
      }
      // 가장자리가 살짝 접혀 진해진다
      ctx.fillStyle = "rgba(160, 140, 95, 0.35)";
      ctx.fillRect(0, 0, 2, size);
      ctx.fillRect(size - 2, 0, 2, size);
    },
    { size: 32, crisp: false },
  );
}

function speckle(ctx: CanvasRenderingContext2D, size: number, every: number, salt: number) {
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (hash(x + salt, y + salt) % every === 0) ctx.fillRect(x, y, 1, 1);
    }
  }
}

/**
 * 캔버스에 그린 그림을 텍스처로 만든다.
 * `crisp` 가 true 면 확대할 때 각지게(도트), false 면 부드럽게 — 이 한 값이 마크 상자와
 * 택배 상자의 인상을 가른다.
 */
function makeTexture(
  THREE: typeof THREE_NS,
  draw: (ctx: CanvasRenderingContext2D, size: number) => void,
  options: { size?: number; crisp?: boolean } = {},
): THREE_NS.Texture {
  const size = options.size ?? TEX_SIZE;
  const crisp = options.crisp ?? true;

  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (ctx !== null) {
    ctx.lineWidth = 1;
    draw(ctx, size);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = crisp ? THREE.NearestFilter : THREE.LinearFilter;
  texture.minFilter = crisp ? THREE.NearestFilter : THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = !crisp;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** 좌표 → 고정된 의사난수. 같은 자리는 언제나 같은 무늬가 된다 */
function hash(x: number, y: number): number {
  const n = (x * 73856093) ^ (y * 19349663);
  return Math.abs(n);
}
