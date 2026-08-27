/* ─────────────────────────────────────────────────────────────
   네더 포탈 — 창고 통로 끝에 세우는 이동 장치.
   누르면 신규 물품 입고 검수실로 넘어간다.

   ★ **별도 파일로 뺐다.** 창고 본체(`warehouse-slot-3d.jsx`)가 이미 1,600줄이라, 여기까지
     넣으면 손대기 어려워진다. 이 파일은 THREE 를 인자로 받아 그룹 하나를 돌려주는 공장
     함수다 — 씬을 모르고, 씬도 이 파일의 속을 모른다.

   ⚠️ `THREE` 를 import 하지 않고 **인자로 받는다.** 부르는 쪽이 이미 불러 둔 그 인스턴스를
      써야 한다. 여기서 따로 import 하면 번들에 따라 두 벌이 잡혀
      `instanceof` 검사와 재질 공유가 어긋난다.
   ───────────────────────────────────────────────────────────── */

/** 블록 한 칸(m). 마크 규격이라 사람 키보다 크게 잡는다 — 포탈 전체가 약 5m */
const BLOCK = 1.0;
/** 마크 정석 규격: 안쪽이 가로 2 × 세로 3, 테두리까지 하면 4 × 5 */
const INNER_W = 2;
const INNER_H = 3;

/**
 * 흑요석 텍스처 — 어두운 보라빛 검정에 보라 반점.
 * ⚠️ 그림 파일을 받지 않고 캔버스로 그린다. 64×64 한 장이라 파일을 더 둘 이유가 없고,
 *    색을 코드에서 바로 맞출 수 있다.
 */
function makeObsidianTexture(THREE) {
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const paint = canvas.getContext("2d");
  if (paint === null) return null;

  paint.fillStyle = "#1a0f2e";
  paint.fillRect(0, 0, size, size);

  /* 보라 반점 — 좌표 해시로 찍는다. Math.random 을 쓰면 새로 그릴 때마다 무늬가 달라져
     블록끼리 이어 붙였을 때 지직거린다 */
  for (let i = 0; i < 220; i += 1) {
    const n = Math.sin(i * 12.9898) * 43758.5453;
    const r1 = n - Math.floor(n);
    const m = Math.sin(i * 78.233) * 12345.6789;
    const r2 = m - Math.floor(m);
    const shade = r1 > 0.82 ? "#4a2a7a" : r1 > 0.6 ? "#2a1846" : "#120a20";
    paint.fillStyle = shade;
    paint.fillRect(Math.floor(r1 * size), Math.floor(r2 * size), 2, 2);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter; // 마크 블록이라 또렷한 도트로 둔다
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** 포탈 면 — 보라 소용돌이. 노이즈를 겹쳐 천천히 흐르게 한다 */
const PORTAL_VERTEX = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const PORTAL_FRAGMENT = `
  precision highp float;
  varying vec2 vUv;
  uniform float uTime;
  uniform float uGlow;   // 호버하면 올라간다

  /* 값 노이즈 — 텍스처 없이 소용돌이를 만들기 위한 최소 재료다 */
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
      mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
      u.y
    );
  }
  /* 여러 배율을 겹치면 큰 흐름과 잔무늬가 함께 생긴다 */
  float fbm(vec2 p) {
    float sum = 0.0, amp = 0.5;
    for (int i = 0; i < 5; i++) {
      sum += amp * noise(p);
      p *= 2.03;
      amp *= 0.5;
    }
    return sum;
  }

  void main() {
    vec2 uv = vUv - 0.5;

    /* 중심을 기준으로 비트는 것이 '소용돌이'의 전부다 —
       중심에서 멀수록 덜 돌게 해야 빨려 들어가는 느낌이 난다 */
    float radius = length(uv);
    float angle = atan(uv.y, uv.x) + uTime * 0.28 - radius * 2.4;
    vec2 swirl = vec2(cos(angle), sin(angle)) * radius;

    float n = fbm(swirl * 4.2 + vec2(0.0, uTime * 0.35));
    n = pow(n, 1.7);

    vec3 deep = vec3(0.24, 0.02, 0.42);   // 짙은 보라
    vec3 bright = vec3(0.78, 0.22, 0.98); // 자홍
    vec3 color = mix(deep, bright, n);

    /* 천천히 뛰는 맥동. 주기를 어긋나게 둘을 겹쳐 기계적으로 안 보이게 한다 */
    float pulse = 0.86 + 0.14 * sin(uTime * 1.6) + 0.06 * sin(uTime * 2.7);
    color *= pulse * uGlow;

    /* 가장자리는 프레임에 묻히도록 살짝 어둡게 */
    float edge = smoothstep(0.5, 0.16, radius);
    gl_FragColor = vec4(color, (0.62 + 0.3 * n) * edge);
  }
`;

/**
 * 포탈 하나를 만든다.
 *
 * @returns {{
 *   group: object, surface: object, light: object,
 *   pickTargets: object[], update: (dt: number, hovered: boolean) => void,
 *   dispose: () => void,
 * }}
 */
export function createNetherPortal(THREE, { position = [0, 0, 0], rotationY = 0, scale = 1 } = {}) {
  const group = new THREE.Group();
  group.position.set(position[0], position[1], position[2]);
  group.rotation.y = rotationY;
  group.scale.setScalar(scale);

  const obsidian = makeObsidianTexture(THREE);
  const frameMaterial = new THREE.MeshStandardMaterial({
    map: obsidian,
    color: 0xffffff,
    roughness: 0.55,
    metalness: 0.1,
  });

  /* ── 프레임 ──────────────────────────────────────────────────────────
     ★ 블록을 **한 칸씩 따로 놓는다.** 통짜 판으로 만들면 훨씬 싸지만, 마크 포탈의 인상은
       "블록이 쌓여 있다"는 계단식 실루엣에서 온다. 모서리는 원작대로 비운다. */
  const frameGeometry = new THREE.BoxGeometry(BLOCK, BLOCK, BLOCK * 0.5);
  const blocks = [];
  for (let x = -1; x <= INNER_W; x += 1) {
    for (let y = -1; y <= INNER_H; y += 1) {
      const isInside = x >= 0 && x < INNER_W && y >= 0 && y < INNER_H;
      const isCorner = (x === -1 || x === INNER_W) && (y === -1 || y === INNER_H);
      if (isInside || isCorner) continue;
      blocks.push([x, y]);
    }
  }

  const frame = new THREE.InstancedMesh(frameGeometry, frameMaterial, blocks.length);
  const placer = new THREE.Object3D();
  blocks.forEach(([x, y], index) => {
    placer.position.set((x - (INNER_W - 1) / 2) * BLOCK, (y + 0.5) * BLOCK, 0);
    placer.updateMatrix();
    frame.setMatrixAt(index, placer.matrix);
  });
  frame.castShadow = false;
  group.add(frame);

  /* ── 포탈 면 ─────────────────────────────────────────────────────────
     ⚠️ `depthWrite: false` — 반투명이라 깊이를 쓰면 뒤에 있는 입자가 사라진다.
     ⚠️ `AdditiveBlending` — 어두운 창고에서 스스로 빛나 보여야 한다.
     ⚠️ `DoubleSide` — 뒤에서 봐도 보여야 한다(요청). */
  const uniforms = {
    uTime: { value: 0 },
    uGlow: { value: 1 },
  };
  const surface = new THREE.Mesh(
    new THREE.PlaneGeometry(INNER_W * BLOCK, INNER_H * BLOCK),
    new THREE.ShaderMaterial({
      uniforms,
      vertexShader: PORTAL_VERTEX,
      fragmentShader: PORTAL_FRAGMENT,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    }),
  );
  surface.position.set(0, (INNER_H / 2 + 0.5) * BLOCK, 0);
  surface.userData.portal = true; // 클릭 판정에 쓴다
  group.add(surface);

  /* 클릭·호버는 **면보다 넉넉한 판**으로 받는다. 소용돌이 가장자리는 거의 투명해서
     그림만 보고 누르면 자꾸 빗나간다 */
  const hitArea = new THREE.Mesh(
    new THREE.PlaneGeometry((INNER_W + 2) * BLOCK, (INNER_H + 2) * BLOCK),
    new THREE.MeshBasicMaterial({ visible: false }),
  );
  hitArea.position.copy(surface.position);
  hitArea.userData.portal = true;
  group.add(hitArea);

  /* ── 빛 ──────────────────────────────────────────────────────────────
     포탈이 광원이어야 바닥과 근처 랙에 보라가 번진다. 그게 없으면 스티커처럼 보인다 */
  /* 도달 거리를 16 -> 9.5 로, 세기를 6.5 -> 4.6 으로 줄였다.
     넓게 퍼뜨리면 포탈이 아니라 **창고 한쪽이 통째로 보라색**이 된다. 빛은 문틀 근처에서
     끝나야 "저기서 새어 나온다"로 읽힌다. */
  const light = new THREE.PointLight(0xb04dff, 4.6, 9.5, 2);
  light.position.set(0, (INNER_H / 2 + 0.5) * BLOCK, 0.6);
  group.add(light);

  /* 바닥 반사 — 진짜 반사가 아니라 바닥에 눕힌 빛무리 한 장이다.
     실제 반사(리플렉션)는 이 장면 하나 때문에 렌더 비용이 배로 든다 */
  const floorGlow = new THREE.Mesh(
    /* 가로 7 x 세로 5 블록이었는데 4.4 x 2.4 로 줄였다.
       (주의) 가로는 **문틀 폭(4블록)을 넘기지 않는다.** 빛무리가 문틀보다 넓으면 바닥에서
          솟은 웅덩이처럼 보이지, 문에서 새어 나온 빛으로는 안 보인다.
       세로(바닥으로 뻗는 길이)는 특히 짧게 잡는다. 길게 두면 통로를 가로질러 카펫을
       깔아 놓은 꼴이 된다. */
    new THREE.PlaneGeometry(BLOCK * 4.4, BLOCK * 2.4),
    new THREE.MeshBasicMaterial({
      color: 0x8b2fd6,
      transparent: true,
      opacity: 0.2,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  floorGlow.rotation.x = -Math.PI / 2;
  floorGlow.position.set(0, 0.03, 0.52);   // 문틀 바로 앞. 멀리 두면 빛과 문이 따로 논다
  group.add(floorGlow);

  /* ── 입자 ────────────────────────────────────────────────────────────
     포탈 앞에서 천천히 떠오르는 보라 알갱이. 위로 다 오르면 아래에서 다시 시작한다 */
  const PARTICLES = 90;
  const positions = new Float32Array(PARTICLES * 3);
  const speeds = new Float32Array(PARTICLES);
  const seed = (i, salt) => {
    const n = Math.sin((i + 1) * salt) * 43758.5453;
    return n - Math.floor(n);
  };
  for (let i = 0; i < PARTICLES; i += 1) {
    positions[i * 3] = (seed(i, 12.9898) - 0.5) * INNER_W * BLOCK * 1.4;
    positions[i * 3 + 1] = seed(i, 78.233) * INNER_H * BLOCK * 1.6;
    positions[i * 3 + 2] = (seed(i, 37.719) - 0.5) * 1.4 + 0.5;
    speeds[i] = 0.16 + seed(i, 93.989) * 0.34;
  }
  const particleGeometry = new THREE.BufferGeometry();
  particleGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const particles = new THREE.Points(
    particleGeometry,
    new THREE.PointsMaterial({
      color: 0xd68bff,
      size: 0.11,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  group.add(particles);

  const TOP = INNER_H * BLOCK * 1.7;
  let glow = 1;

  return {
    group,
    surface,
    light,
    pickTargets: [hitArea, surface],

    /** 매 프레임 한 걸음. `hovered` 면 밝아진다 */
    update(dt, hovered) {
      uniforms.uTime.value += dt;

      /* 밝기는 **곧바로 바꾸지 않고 따라가게** 한다. 호버가 스칠 때마다 번쩍이면
         눈이 피로하다 */
      const target = hovered ? 1.55 : 1;
      glow += (target - glow) * Math.min(1, dt * 6);
      uniforms.uGlow.value = glow;
      light.intensity = 6.5 * glow;
      floorGlow.material.opacity = 0.2 * glow;

      const array = particleGeometry.attributes.position.array;
      for (let i = 0; i < PARTICLES; i += 1) {
        array[i * 3 + 1] += speeds[i] * dt;
        if (array[i * 3 + 1] > TOP) array[i * 3 + 1] = 0;
      }
      particleGeometry.attributes.position.needsUpdate = true;
    },

    dispose() {
      frameGeometry.dispose();
      frameMaterial.dispose();
      obsidian?.dispose();
      surface.geometry.dispose();
      surface.material.dispose();
      hitArea.geometry.dispose();
      hitArea.material.dispose();
      floorGlow.geometry.dispose();
      floorGlow.material.dispose();
      particleGeometry.dispose();
      particles.material.dispose();
    },
  };
}
