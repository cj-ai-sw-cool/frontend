/* ═══════════════════════════════════════════════════════════════════════════
   창고 바깥 — 야적장
   `createExterior(THREE, { floorW, floorD, floorCz })` 하나만 내보낸다.

   왜 필요한가
     창고만 있으면 검은 허공에 떠 있는 바닥 한 장이다. 카메라를 뒤로 빼면 그 사실이 그대로
     드러나서, 아무리 안을 잘 만들어도 "모형"으로 보인다. 건물 발밑에 포장된 마당과 차선,
     도크와 트럭이 있으면 같은 건물이 어딘가에 서 있는 것이 된다.

   ★ 한때 하늘 돔·산 실루엣·먼 풀밭까지 있었으나 **전부 걷어냈다.** 배경 그림이 들어오는
     순간 화면의 주인공이 창고가 아니라 풍경이 되고, 이 화면은 풍경을 보러 오는 곳이
     아니다. 지금은 **포장된 마당까지만** 남긴다 — 건물이 땅에 붙어 있다는 것만 말하고
     거기서 끝낸다.
   ⚠️ 그래서 마당 바깥은 그냥 배경색이다. 판이 허공에서 뚝 끊기지 않도록 창고 쪽
      `scene.fog` 가 가장자리를 배경색으로 녹인다 — 안개 색과 배경색은 **반드시 같아야**
      한다. 어긋나면 마당 끝에 색 띠가 생긴다. 그래서 아래 `HAZE` 를 양쪽이 함께 쓴다.

   구성
     ① 야적장   — 건물 둘레의 아스팔트. 에이프런·순환 차선·주차 구획·도크 앞 빗금
     ② 가로등   — 기둥과 등기구만. 실제 광원은 켜지 않는다
     ③ 트럭 도크 — 건물 오른쪽에 하역장과 트럭 2대
   ═══════════════════════════════════════════════════════════════════════════ */

/** 배경·안개 색. 창고 쪽 `renderer.setClearColor` 와 `scene.fog` 가 같은 값을 쓴다 */
export const HAZE = 0x0f141b;

/* 결정론적 난수. `Math.random` 을 쓰면 새로고침마다 포장 얼룩이 바뀐다 —
   같은 장면이 매번 달라지면 "이 자리"라는 느낌이 안 산다 */
function rng32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function canvasTexture(THREE, w, h, draw, { repeatX = 1, repeatY = 1, wrap = true } = {}) {
  const cv = document.createElement("canvas");
  cv.width = w; cv.height = h;
  draw(cv.getContext("2d"), w, h);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  if (wrap) {
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.repeat.set(repeatX, repeatY);
  }
  return tex;
}

/* ── ① 야적장 ───────────────────────────────────────────────────────────
   건물 발밑의 아스팔트. 여기만 해상도를 높게 잡는다 — 카메라가 실제로 가까이 가는
   유일한 바깥 영역이라, 먼 지면과 같은 거친 무늬를 쓰면 티가 난다. */
function buildYard(THREE, dispose, { floorW, floorD, floorCz, dockX }) {
  const YW = floorW + 78, YD = floorD + 78;
  const PX = 2048;
  const PY = Math.round((YD / YW) * PX);

  const tex = canvasTexture(THREE, PX, PY, (c, w, h) => {
    const u = (x) => ((x + YW / 2) / YW) * w;
    const v = (z) => ((z - floorCz + YD / 2) / YD) * h;
    const ppm = w / YW;
    const rnd = rng32(101);

    /* 아스팔트 — 검정이 아니라 중간 회색이다. 어둡게 두면 건물만 떠 보이고,
       밝은 창고 바닥과의 대비도 지나치게 벌어진다 */
    c.fillStyle = "#5E656E";
    c.fillRect(0, 0, w, h);
    for (let i = 0; i < 3000; i++) {
      const g0 = 84 + rnd() * 30;
      c.fillStyle = `rgba(${g0},${g0 + 3},${g0 + 8},${0.14 + rnd() * 0.26})`;
      c.fillRect(rnd() * w, rnd() * h, 4 + rnd() * 28, 4 + rnd() * 28);
    }
    // 포장 보수 자국 — 조금 어두운 띠
    for (let i = 0; i < 26; i++) {
      c.fillStyle = `rgba(60,66,74,${0.1 + rnd() * 0.16})`;
      c.fillRect(rnd() * w, rnd() * h, 40 + rnd() * 260, 14 + rnd() * 40);
    }

    /* 가장자리를 어둡게 떨군다.
       ⚠️ 풀밭 띠를 두르던 자리다. 배경 그림을 없앤 뒤로는 마당 끝이 곧 세계의 끝이라,
          여기서 밝게 끝나면 판이 허공에 뜬 것이 그대로 보인다. 배경색 쪽으로 어두워지게
          해서 안개가 마저 지우도록 넘긴다. */
    const edge = c.createLinearGradient(0, 0, 0, h);
    edge.addColorStop(0, "rgba(15,20,27,0.95)");
    edge.addColorStop(0.13, "rgba(15,20,27,0)");
    edge.addColorStop(0.87, "rgba(15,20,27,0)");
    edge.addColorStop(1, "rgba(15,20,27,0.95)");
    c.fillStyle = edge;
    c.fillRect(0, 0, w, h);
    const edgeX = c.createLinearGradient(0, 0, w, 0);
    edgeX.addColorStop(0, "rgba(15,20,27,0.95)");
    edgeX.addColorStop(0.10, "rgba(15,20,27,0)");
    edgeX.addColorStop(0.90, "rgba(15,20,27,0)");
    edgeX.addColorStop(1, "rgba(15,20,27,0.95)");
    c.fillStyle = edgeX;
    c.fillRect(0, 0, w, h);

    /* 건물 둘레의 콘크리트 에이프런 — 아스팔트보다 밝아 건물 윤곽이 또렷해진다 */
    c.fillStyle = "#7C848E";
    c.fillRect(u(-floorW / 2 - 3), v(floorCz - floorD / 2 - 3), (floorW + 6) * ppm, (floorD + 6) * ppm);

    /* 주행로 — 건물을 둘러싸는 순환 차선 (노란 파선) */
    /* ⚠️ 선을 진하게 두지 않는다. 노란색은 회색 위에서 가장 튀는 색이라, 또렷하게
       그리면 화면의 주인공이 창고가 아니라 바닥 무늬가 된다. 현장 도장은 늘 조금
       바래 있기도 하다 */
    c.strokeStyle = "rgba(214,190,110,0.45)";
    c.lineWidth = Math.max(2, 0.16 * ppm);
    c.setLineDash([2.6 * ppm, 2.0 * ppm]);
    const ringPad = 11;
    c.strokeRect(
      u(-floorW / 2 - ringPad), v(floorCz - floorD / 2 - ringPad),
      (floorW + ringPad * 2) * ppm, (floorD + ringPad * 2) * ppm,
    );
    c.setLineDash([]);

    /* 주차 구획 — 왼쪽 마당 (트럭 도크는 오른쪽이라 서로 안 겹친다) */
    c.strokeStyle = "rgba(226,230,236,0.42)";
    c.lineWidth = Math.max(2, 0.12 * ppm);
    for (let i = 0; i < 9; i++) {
      const z = floorCz - 9 + i * 2.6;
      c.beginPath();
      c.moveTo(u(-floorW / 2 - 16), v(z));
      c.lineTo(u(-floorW / 2 - 22.5), v(z));
      c.stroke();
    }
    c.beginPath();
    c.moveTo(u(-floorW / 2 - 22.5), v(floorCz - 9));
    c.lineTo(u(-floorW / 2 - 22.5), v(floorCz - 9 + 8 * 2.6));
    c.stroke();

    /* 도크 앞 노란 빗금 — 트럭이 후진해 들어오는 자리 (건물 오른쪽) */
    /* ⚠️ 예전에는 폭 9m x 길이 18m 를 진한 노랑으로 가득 채웠는데, 화면에서 창고만큼
       큰 노란 덩어리가 되어 버렸다. 트럭이 실제로 후진해 들어오는 자리(도크 폭)만큼만
       칠하고, 농도도 절반으로 낮춘다. */
    const zx0 = v(floorCz - 10), zx1 = v(floorCz + 10);
    c.save();
    c.beginPath();
    c.rect(u(dockX + 1.2), zx0, 5.5 * ppm, zx1 - zx0);
    c.clip();
    c.strokeStyle = "rgba(222,190,70,0.34)";
    c.lineWidth = Math.max(2, 0.26 * ppm);
    for (let i = -20; i < 70; i++) {
      c.beginPath();
      c.moveTo(u(dockX + 1.2), zx0 + i * 1.5 * ppm);
      c.lineTo(u(dockX + 6.7), zx0 + i * 1.5 * ppm + 3 * ppm);
      c.stroke();
    }
    c.restore();
  }, { wrap: false });

  const mat = new THREE.MeshLambertMaterial({ map: tex });
  const geo = new THREE.PlaneGeometry(YW, YD);
  const m = new THREE.Mesh(geo, mat);
  m.rotation.x = -Math.PI / 2;
  m.position.set(0, -0.03, floorCz);
  /* 야적장은 그림자를 **받기만** 한다. 평평한 판이라 드리울 것이 없는데, 켜 두면
     그림자 맵에 창고만 한 사각형이 한 장 더 그려진다 */
  m.receiveShadow = true;
  dispose.push(geo, mat, tex);
  return m;
}

/* ── ② 가로등 ───────────────────────────────────────────────────────────
   ★ **실제 광원을 하나도 켜지 않는다.** 기둥과 등기구만 세운다. 장면이 이미 밝아
     켜 봐야 보이지도 않는데, 광원 하나마다 장면의 모든 재질이 다시 계산된다. 여기서
     가로등은 조명 장치가 아니라 **부지의 크기를 알려 주는 자**다 — 9.5m 짜리 기둥이
     일정 간격으로 서 있으면 마당이 얼마나 넓은지가 눈으로 잡힌다. */
function buildLamps(THREE, dispose, spots) {
  const g = new THREE.Group();
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x8b939d });
  const headMat = new THREE.MeshLambertMaterial({ color: 0x6a727c });
  const poleGeo = new THREE.CylinderGeometry(0.13, 0.2, 9.5, 10);
  const armGeo = new THREE.BoxGeometry(0.14, 0.14, 1.5);
  const headGeo = new THREE.BoxGeometry(0.66, 0.2, 1.05);

  for (const [x, z] of spots) {
    const pole = new THREE.Mesh(poleGeo, poleMat);
    pole.position.set(x, 4.75, z);
    g.add(pole);

    const dir = x < 0 ? 1 : -1;   // 등기구는 항상 마당 안쪽을 향한다
    const arm = new THREE.Mesh(armGeo, poleMat);
    arm.position.set(x + dir * 0.75, 9.4, z);
    arm.rotation.y = Math.PI / 2;
    g.add(arm);

    const head = new THREE.Mesh(headGeo, headMat);
    head.position.set(x + dir * 1.45, 9.2, z);
    g.add(head);
  }

  dispose.push(poleGeo, armGeo, headGeo, poleMat, headMat);
  return g;
}

/* ── ③ 트럭 ─────────────────────────────────────────────────────────────
   A.LTS 5톤 윙바디.
     · 차체 전체가 파랑, 지붕만 흰색
     · 적재함 앞쪽에 사선 띠 넉 줄 (하늘 → 남색 → 빨강 → 주황) 이 오른쪽 위로 흐른다
     · 적재함 뒤쪽에 A.LTS 마크(`shell.tsx` 의 `BrandMark` 와 같은 도형)와 "A.LTS"
     · 앞쪽 위에 홈페이지·대표번호 작은 흰 글씨(허구 값, 실제 회사 정보 아님)

   ⚠️ Stage 2(정본 02-data-model.md, 브리프 §3 S2.9) 에서 실제 기업명(CJ대한통운) 도장을
      이 앱의 자체 브랜드(A.LTS)로 바꿨다 — 마크·글자·URL·전화번호 전부.

   ★ 세미트레일러(길이 12m)에서 **5톤 박스트럭(7.6m)** 으로 바꿨다. 국내 물류 창고
     도크에 실제로 붙는 차가 이 크기이고, 트레일러는 이 마당 규모에 견줘 너무 컸다.

   ⚠️ 옆면 도장은 **양쪽에 다른 텍스처**를 쓴다. `BoxGeometry` 의 +x 면은 u=0 이 차 앞쪽,
      -x 면은 u=0 이 차 **뒤쪽**에 붙는다. 같은 그림을 쓰면 한쪽만 로고가 앞으로 가고
      사선 띠가 반대로 흐른다. 그래서 배치를 되짚은 사본을 -x 면에 붙인다.
      (글자를 뒤집는 게 아니다 — `liveryTexture` 의 `X()` 주의를 볼 것)
   ⚠️ 재질 배열의 순서는 `[+x, -x, +y, -y, +z, -z]` 로 고정이다. 이 순서를 바꾸면 지붕
      흰색이 옆면으로 가는 식으로 어긋난다. */

const ALTS_BLUE = "#1668C4";
const ALTS_DEEP = "#0E2A5C";

/** 적재함 옆면 도장.
 *  `flip` 은 **배치만** 좌우로 되짚는다(글자는 똑바로 그린다) — 아래 `X()` 주의 참고. */
function liveryTexture(THREE, flip) {
  const W = 1024, H = 492;
  const cv = document.createElement("canvas");
  cv.width = W; cv.height = H;
  const c = cv.getContext("2d");

  /* 설계 좌표 → 캔버스 좌표.
     ⚠️ 예전에는 `c.translate(W,0); c.scale(-1,1)` 로 캔버스를 통째로 뒤집었다. 그러면
        배치뿐 아니라 **글자까지 좌우로 반전되어**, 반대편에서 브랜드 글자가 거울글씨로
        보였다. 뒤집어야 하는 것은 배치뿐이다 — 좌표만 되짚고 글자는 정방향으로 그린다.
     ⚠️ 좌우가 뒤집히면 글자 정렬도 함께 뒤집어야 한다. 왼쪽 정렬로 x 에 찍던 글자를
        되짚은 x 에 그대로 왼쪽 정렬하면 글자 블록이 반대쪽으로 삐져나간다. */
  const X = (x) => (flip ? W - x : x);
  const AL = (a) => (flip ? (a === "left" ? "right" : "left") : a);

  c.fillStyle = ALTS_BLUE;
  c.fillRect(0, 0, W, H);

  /* 사선 띠 — 아래에서 위로 갈수록 차 앞쪽으로 눕는다. 네 줄의 폭을 일부러 다르게
     둔다. 같은 폭으로 늘어놓으면 도장이 아니라 신호등 무늬처럼 보인다.
     ⚠️ 네 꼭짓점을 모두 `X()` 로 넘긴다. 그래야 기울기까지 같이 뒤집혀, 양쪽에서
        띠가 **같은 방향으로**(차 뒤 → 차 앞 위쪽) 흐른다. */
  const SKEW = H * 0.62;
  const band = (x0, w, color) => {
    c.fillStyle = color;
    c.beginPath();
    c.moveTo(X(x0), H);
    c.lineTo(X(x0 + w), H);
    c.lineTo(X(x0 + w + SKEW), 0);
    c.lineTo(X(x0 + SKEW), 0);
    c.closePath();
    c.fill();
  };
  band(96, 26, "#4FC2EE");    // 하늘
  band(128, 96, ALTS_DEEP);     // 남색 (가장 넓다)
  band(228, 54, "#E5342C");   // 빨강
  band(286, 40, "#F5A623");   // 주황

  c.textBaseline = "middle";

  /* 홈페이지·대표번호 — 실제 차량에도 앞쪽 위에 작게 들어간다.
     ⚠️ 사선 띠와 겹치지 않는 자리(띠보다 뒤)에 둔다. 겹치면 파란 바탕에 흰 글씨가
        아니라 남색 위 흰 글씨가 되어 읽히지 않는다 */
  c.fillStyle = "rgba(255,255,255,0.92)";
  c.textAlign = AL("left");
  c.font = "700 26px 'Malgun Gothic', Arial, sans-serif";
  c.fillText("www.alts.co.kr", X(470), 74);
  c.font = "800 30px 'Consolas', monospace";
  c.fillText("1588-7900", X(470), 112);

  /* ── A.LTS 마크 + 글자 ──
     `shell.tsx` 의 `BrandMark` 와 **같은 도형**(네이비 사각형 위 흰 삼각형 테두리 +
     금색 막대)을 캔버스로 다시 그린다 — 화면 안에서 이 앱을 대표하는 마크가 하나여야
     한다(Stage 2, 브리프 §3 S2.9, 실제 기업명 도장을 걷어낸 자리).
     ⚠️ 좌우 대칭 도형이라 `flip` 이어도 도형 자체를 뒤집을 필요는 없다 — 자리(왼쪽/
        오른쪽 끝)만 `X()` 로 되짚는다. 사각형처럼 두 변의 끝점을 각각 `X()` 로 구해
        `Math.min` 으로 왼쪽 끝을 잡으면, 방향을 가정하지 않아도 항상 올바른 쪽에 선다. */
  const LX = 560, LY = H * 0.62, S = 108;
  const markX0 = Math.min(X(LX), X(LX + S));
  const markY0 = LY - S / 2;
  c.fillStyle = "#003087";
  c.fillRect(markX0, markY0, S, S);
  c.save();
  c.translate(markX0, markY0);
  c.beginPath();
  c.moveTo(S * 0.5, S * 0.134);
  c.lineTo(S * 0.894, S * 0.919);
  c.lineTo(S * 0.106, S * 0.919);
  c.closePath();
  c.moveTo(S * 0.5, S * 0.403);
  c.lineTo(S * 0.734, S * 0.841);
  c.lineTo(S * 0.266, S * 0.841);
  c.closePath();
  c.fillStyle = "#FFFFFF";
  c.fill("evenodd");
  c.fillStyle = "#FCB40D";
  c.fillRect(S * 0.266, S * 0.684, S * 0.469, S * 0.15);
  c.restore();

  c.fillStyle = "#FFFFFF";
  c.font = "900 76px 'Malgun Gothic', sans-serif";
  c.textAlign = AL("left");
  c.fillText("A.LTS", X(LX + S + 30), LY - 4);

  /* 아래쪽 살짝 어두운 띠 — 차체 옆면은 아래로 갈수록 그늘이 진다. 이게 없으면
     평평한 판때기로 보인다. 위아래 방향이라 좌우 뒤집기와는 무관하다 */
  const sh = c.createLinearGradient(0, H * 0.72, 0, H);
  sh.addColorStop(0, "rgba(0,0,0,0)");
  sh.addColorStop(1, "rgba(0,0,0,0.28)");
  c.fillStyle = sh;
  c.fillRect(0, 0, W, H);

  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

/** 뒷문 — 알루미늄 셔터. 가로 골이 촘촘히 잡혀 있다 */
/**
 * 적재함 뒷문(셔터) 무늬.
 * @param {boolean} blue 파란 문으로 그릴까. **닫힌 채 서 있는 차**에 쓴다 (사용자 지적 —
 *   문이 닫혀 있으면 뒷면도 차체와 같은 파란색이어야 한다). 열린 차의 문짝은 안쪽 면과
 *   경첩이 보이는 자리라 회색 셔터 그대로 둔다.
 */
function rearDoorTexture(THREE, blue = false) {
  const W = 256, H = 256;
  const cv = document.createElement("canvas");
  cv.width = W; cv.height = H;
  const c = cv.getContext("2d");
  for (let y = 0; y < H; y += 10) {
    const alt = (y / 10) % 2 === 0;
    if (blue) {
      /* 파란 문도 **골이 보여야** 셔터로 읽힌다. 단색으로 칠하면 차 뒤를 잘라 낸 것처럼
         평평해져서, 닫힌 문이 아니라 파란 벽이 된다 */
      c.fillStyle = alt ? "#1668c4" : "#1a75d8";
    } else {
      const g = 176 + (alt ? 14 : 0);
      c.fillStyle = `rgb(${g},${g + 3},${g + 8})`;
    }
    c.fillRect(0, y, W, 10);
    c.fillStyle = blue ? "rgba(9,54,106,0.55)" : "rgba(90,98,108,0.5)";
    c.fillRect(0, y + 9, W, 1);
  }
  // 위쪽 띠 + 손잡이 봉 두 개
  c.fillStyle = blue ? "#0F4E96" : ALTS_BLUE;
  c.fillRect(0, 0, W, 34);
  c.fillStyle = blue ? "#7E9DC4" : "#8A939E";
  c.fillRect(W * 0.3, 40, 7, H - 60);
  c.fillRect(W * 0.68, 40, 7, H - 60);

  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * A.LTS 박스트럭.
 * ⚠️ **뒷문이 원점(z = 0)** 이고 차체는 +z 쪽으로 뻗는다. 도크에 붙일 때 "뒷문을 범퍼에
 *    맞춘다"가 곧 "z 를 범퍼 위치에 둔다"가 되어, 차 길이를 몰라도 세울 수 있다.
 */
/* 적재함 치수 — **상차 장면이 같은 값을 쓴다.** 뒷문·짐칸·상자 더미가 전부 이 숫자에
   기대고 있어서, 각자 적어 두면 트럭을 조금만 키워도 문이 허공에 뜨거나 상자가 벽을
   뚫는다. 한 곳에서만 정한다. */
const BW = 2.32;                                 // 적재함 폭
const BOX_L = 5.2, BOX_H = 2.5, BOX_Y = 1.05;    // 길이·높이·바닥 높이
const CAB_L = 2.05;
/* 적재함 뒷면(뒷문)의 z. `buildTruck` 주석대로 뒷문이 원점 쪽이고 차체가 +z 로 뻗는다 */
const REAR_Z = 0.1;

/* 출차 주행 — 속도(m/s) · 직진 구간(m) · 90° 를 도는 데 쓰는 거리(m) · 총 주행(m).
   ⚠️ `TURN_AT` 은 **차 길이(8m 남짓)보다 짧아도 된다.** 회전축이 뒷문이라 6.5m 만 나가도
      차체는 이미 도크 밖이다. 더 늘리면 90° 를 다 돌기 전에 화면 밖으로 나간다. */
const DEPART_V = 3.4, TURN_AT = 6.5, TURN_LEN = 9.0, DEPART_LEN = 26;

/**
 * @param {{open?: boolean}} opt `open` 이면 뒷문 면을 지우고 짐칸 안쪽을 만들어 둔다 —
 *   문짝과 상차 장면은 `buildLoading` 이 따로 얹는다.
 */
function buildTruck(THREE, dispose, { open = false } = {}) {
  const g = new THREE.Group();

  const blueMat = new THREE.MeshLambertMaterial({ color: 0x1668c4 });
  const roofMat = new THREE.MeshLambertMaterial({ color: 0xe6ebf1 });
  const darkMat = new THREE.MeshLambertMaterial({ color: 0x232830 });
  const glassMat = new THREE.MeshLambertMaterial({ color: 0x1b2b3d });
  const chromeMat = new THREE.MeshLambertMaterial({ color: 0x9aa3ad });

  const liveryR = liveryTexture(THREE, false);   // +x 면: u=0 이 차 앞
  const liveryL = liveryTexture(THREE, true);    // -x 면: u=0 이 차 뒤 → 배치를 되짚는다
  const doorTex = rearDoorTexture(THREE, !open);   // 닫힌 차는 파란 문 (위 주석)
  const sideR = new THREE.MeshLambertMaterial({ map: liveryR });
  const sideL = new THREE.MeshLambertMaterial({ map: liveryL });
  const doorMat = new THREE.MeshLambertMaterial({ map: doorTex });

  /* 적재함 — 면마다 다른 재질. 순서는 [+x, -x, +y, -y, +z, -z] 고정 */
  const boxGeo = new THREE.BoxGeometry(BW, BOX_H, BOX_L);
  const box = new THREE.Mesh(boxGeo, [
    sideR, sideL, roofMat, darkMat, blueMat, doorMat,
  ]);
  box.position.set(0, BOX_Y + BOX_H / 2, BOX_L / 2 + 0.1);
  g.add(box);
  dispose.push(boxGeo, sideR, sideL, doorMat, liveryR, liveryL, doorTex);

  if (open) {
    /* ⚠️ 뒷면 재질을 **안 그리게** 한다(`visible = false`). 지오메트리에서 면을 빼는
       것보다 이 편이 낫다 — 면 순서([+x,-x,+y,-y,+z,-z])가 재질 배열과 짝지어져
       있어서, 면을 빼면 나머지 재질이 한 칸씩 밀려 옆면에 뒷문 무늬가 붙는다.
       ⚠️ 안쪽 껍데기를 따로 세운다. 상자는 바깥면만 그리므로(백페이스 컬링) 뒷면을
          지우면 안이 뚫려 보이는 게 아니라 **반대쪽 바깥 풍경**이 보인다. */
    doorMat.visible = false;
    const inGeo = new THREE.BoxGeometry(BW - 0.06, BOX_H - 0.06, BOX_L - 0.06);
    const inMat = new THREE.MeshLambertMaterial({ color: 0x6f7681, side: THREE.BackSide });
    const inner = new THREE.Mesh(inGeo, inMat);
    inner.position.copy(box.position);
    g.add(inner);
    dispose.push(inGeo, inMat);
  }

  // 적재함 아래 사이드 스커트
  const skirtGeo = new THREE.BoxGeometry(BW - 0.12, 0.42, BOX_L - 0.2);
  const skirt = new THREE.Mesh(skirtGeo, darkMat);
  skirt.position.set(0, BOX_Y - 0.16, BOX_L / 2 + 0.1);
  g.add(skirt);
  dispose.push(skirtGeo);

  /* 운전실 — 적재함보다 낮고 좁다. 이 비율이 어긋나면 트럭이 아니라 버스로 보인다 */
  const cabZ = BOX_L + 0.2 + CAB_L / 2;
  const cabGeo = new THREE.BoxGeometry(BW - 0.06, 1.72, CAB_L);
  const cab = new THREE.Mesh(cabGeo, blueMat);
  cab.position.set(0, 1.28, cabZ);
  g.add(cab);
  dispose.push(cabGeo);

  const wsGeo = new THREE.BoxGeometry(BW - 0.24, 0.82, 0.08);
  const ws = new THREE.Mesh(wsGeo, glassMat);
  ws.position.set(0, 1.72, cabZ + CAB_L / 2 - 0.02);
  g.add(ws);
  dispose.push(wsGeo);

  // 옆창
  const swGeo = new THREE.BoxGeometry(0.06, 0.6, 0.9);
  for (const sx of [-1, 1]) {
    const sw = new THREE.Mesh(swGeo, glassMat);
    sw.position.set(sx * (BW / 2 - 0.04), 1.66, cabZ + 0.15);
    g.add(sw);
  }
  dispose.push(swGeo);

  // 앞 범퍼 + 그릴
  const bumpGeo = new THREE.BoxGeometry(BW, 0.34, 0.22);
  const bump = new THREE.Mesh(bumpGeo, chromeMat);
  bump.position.set(0, 0.62, cabZ + CAB_L / 2 + 0.09);
  g.add(bump);
  dispose.push(bumpGeo);

  // 차대 — 적재함과 바퀴 사이의 빈 곳을 메운다
  const frameGeo = new THREE.BoxGeometry(BW - 0.5, 0.24, BOX_L + CAB_L);
  const frame = new THREE.Mesh(frameGeo, darkMat);
  frame.position.set(0, 0.72, (BOX_L + CAB_L) / 2);
  g.add(frame);
  dispose.push(frameGeo);

  /* 바퀴 — 앞 1축, 뒤 1축(복륜). 뒤를 두 짝으로 보이게 두 개를 붙여 세우면
     5톤 화물차의 인상이 난다 */
  const wheelGeo = new THREE.CylinderGeometry(0.46, 0.46, 0.3, 14);
  const hubGeo = new THREE.CylinderGeometry(0.17, 0.17, 0.32, 10);
  const axles = [[cabZ - 0.15, false], [1.35, true], [1.68, true]];
  for (const [wz, dual] of axles) {
    for (const sx of [-1, 1]) {
      const off = dual ? BW / 2 - 0.16 : BW / 2 - 0.2;
      const wheel = new THREE.Mesh(wheelGeo, darkMat);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(sx * off, 0.46, wz);
      g.add(wheel);
      const hub = new THREE.Mesh(hubGeo, chromeMat);
      hub.rotation.z = Math.PI / 2;
      hub.position.set(sx * (off + 0.03), 0.46, wz);
      g.add(hub);
    }
  }
  dispose.push(wheelGeo, hubGeo, blueMat, roofMat, darkMat, glassMat, chromeMat);

  return g;
}

/* ═══════════════════════════════════════════════════════════════════════════
   상차 장면 — 뒷문 열린 트럭에 좀비화 피글린이 상자를 싣는다.

   ★ 도크에 트럭만 세워 두면 "주차장"이지 출고장이 아니다. 상자가 흘러 들어가고 누군가
     그것을 받아 쌓고 있어야 이 자리가 무엇을 하는 곳인지 읽힌다 (사용자 요청).
   ★ 피글린은 **창고 안 작업자와 같은 인물**이다. `makePiglin` 으로 받아 쓴다 — 여기서
     따로 만들면 같은 창고에서 다른 사람이 일하게 된다.

   ── 좌표 ────────────────────────────────────────────────────────────────────
   이 그룹은 도크(`bay`) 안에 놓이고, **트럭과 같은 x** 에 선다. 그래서 z 를 트럭과 같은
   눈금으로 읽을 수 있다: 도크 단이 z 0~1.5, 트럭 뒷문이 z 1.6 + REAR_Z, 짐칸 바닥이
   y = BOX_Y.
   ⚠️ 롤러는 도크 단 위(y = DOCK_TOP)에 있고 짐칸 바닥(BOX_Y)은 그보다 10cm **낮다.**
      그래서 상자가 굴러 들어가는 것이 아니라 **사람이 들어서 내려놓는** 그림이 맞다.
   ═══════════════════════════════════════════════════════════════════════════ */
function buildLoading(THREE, dispose, { truckZ, dockTop, makePiglin }) {
  const g = new THREE.Group();
  /* ⚠️ 이 안의 z 는 전부 **뒷문 기준**으로 적는다. 트럭을 비스듬히 세우면서 이 그룹이
     트럭과 같은 축으로 함께 돌게 됐는데, 도크 기준으로 적어 두면 트럭만 돌고 롤러와
     상자 줄은 제자리에 남아 서로 어긋난다. */
  const door = truckZ + REAR_Z;      // 뒷문 면
  const floor = BOX_Y;               // 짐칸 바닥 높이

  const carton = new THREE.MeshLambertMaterial({ color: 0xC59A63 });
  const steel = new THREE.MeshLambertMaterial({ color: 0x9AA5B1 });
  const frame = new THREE.MeshLambertMaterial({ color: 0x353C44 });
  dispose.push(carton, steel, frame);

  /* ── 뒷문 두 짝 ──
     ⚠️ 경첩을 **모서리에** 두고 판을 그 자식으로 매단다. 판 자체를 돌리면 한가운데를
        축으로 돌아 반쪽이 짐칸을 뚫고 들어간다.
     ⚠️ 두 짝의 여는 방향 부호가 서로 **반대**다. 같은 부호를 주면 한 짝은 밖으로,
        다른 한 짝은 짐칸 안으로 접힌다. */
  const doorTex = rearDoorTexture(THREE);
  const doorMat = new THREE.MeshLambertMaterial({ map: doorTex });
  const panelGeo = new THREE.BoxGeometry(BW / 2, BOX_H - 0.06, 0.055);
  dispose.push(doorTex, doorMat, panelGeo);
  const OPEN = 2.0;                  // 약 115° — 도크에 붙은 트럭이 열 수 있는 만큼
  for (const sx of [-1, 1]) {
    const hinge = new THREE.Group();
    hinge.position.set(sx * (BW / 2), floor + BOX_H / 2, door);
    hinge.rotation.y = sx * OPEN;
    const panel = new THREE.Mesh(panelGeo, doorMat);
    panel.position.set(-sx * (BW / 4), 0, 0);
    hinge.add(panel);
    g.add(hinge);
  }

  /* ── 도크 위 롤러 컨베이어 ── */
  const railGeo = new THREE.BoxGeometry(0.06, 0.13, 1.45);
  for (const sx of [-1, 1]) {
    const r = new THREE.Mesh(railGeo, frame);
    r.position.set(sx * 0.47, dockTop + 0.07, door - 0.92);
    g.add(r);
  }
  const rollGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.88, 10);
  rollGeo.rotateZ(Math.PI / 2);      // 축을 x 로 — 상자는 z 로 흐른다
  const rollers = [];
  for (let i = 0; i < 8; i += 1) {
    const r = new THREE.Mesh(rollGeo, steel);
    r.position.set(0, dockTop + 0.1, door - 1.58 + i * 0.18);
    g.add(r);
    rollers.push(r);
  }
  dispose.push(railGeo, rollGeo);

  /* ── 상자 ───────────────────────────────────────────────────────────
     ★ 상자 하나가 **끝까지 같은 상자**다 (사용자 지적 — 시늉만 하지 말고 진짜 옮기게).
       전에는 벨트의 상자가 사라지는 순간 손에 **다른** 상자가 나타나고, 더미도 미리 숨겨
       둔 또 다른 상자를 하나씩 켜는 식이었다. 세 자리에 세 벌이 있었으니 옮긴 것이 아니라
       세 군데서 따로 연기한 셈이다.
       지금은 하나가 **줄 → 손 → 더미**로 옮겨 다닌다. 그래서 상자를 셀 수 있다.
     ⚠️ 들 때 상자를 **피글린의 자식으로 넣는다**(`pig.grp.add`). 좌표를 매 프레임 계산해
        따라붙이면 몸이 돌 때 상자가 한 박자 늦게 따라와 손에서 떨어져 보인다. 자식으로
        넣으면 회전·이동이 공짜로 따라온다.
     ⚠️ 내려놓을 때는 **월드 자리를 지키며** 다시 그룹으로 옮긴다. 그냥 부모만 바꾸면 손에
        있던 상자가 그 순간 원점으로 튄다.
     ⚠️ 지오메트리·재질은 **한 벌만** 만들어 열두 상자가 나눠 쓴다. */
  const CARTON = new THREE.BoxGeometry(0.44, 0.30, 0.34);
  dispose.push(CARTON);
  const FEED_Y = dockTop + 0.15;
  const HOLD = door - 0.36;          // 인계 지점 — 뒷문 바로 앞
  const GAP = 0.62;
  const ON_BELT = 5;                 // 벨트에 한 번에 보이는 수
  const SLOTS = 8;                   // 짐칸 더미 — 2열 x 4단

  /** 더미의 i 번째 자리 */
  const slotAt = (i) => [
    ((i % 2) - 0.5) * 0.52,
    floor + 0.16 + Math.floor(i / 2) * 0.32,
    /* ⚠️ 더미를 뒷문에서 2.6m 안쪽에 둔다. 든 상자는 몸 앞으로 0.67m 나가므로, 피글린이
       서는 자리(door+1.55)에서 상자 앞면이 door+2.22 다 — 더미 앞면(door+2.43)과 21cm
       뜬다. 예전 값(1.95)에서는 든 상자가 더미를 그대로 파고들었다. */
    door + 2.6,
  ];

  const boxes = [];
  /* ⚠️ 벨트(5) + 더미(8) + 손(1) = 14 개가 동시에 나와 있을 수 있다. 풀이 그보다 작으면
     더미가 다 차기 직전에 벨트가 비어, 상자가 안 오는 몇 초가 생긴다 */
  for (let i = 0; i < 15; i += 1) {
    const m = new THREE.Mesh(CARTON, carton);
    m.visible = false;
    g.add(m);
    boxes.push(m);
  }
  /** 벨트 위 (앞이 먼저) / 아직 안 쓴 것 / 짐칸에 쌓인 것 */
  const queue = [];
  const spare = boxes.slice();
  const piled = [];
  let carried = null;

  /** 벨트 뒤쪽에 한 개 올린다 */
  const feedOne = () => {
    const m = spare.pop();
    if (!m) return;
    const last = queue[queue.length - 1];
    m.position.set(0, FEED_Y, (last ? last.position.z : HOLD) - GAP);
    m.rotation.set(0, 0, 0);
    m.visible = true;
    queue.push(m);
  };
  for (let i = 0; i < ON_BELT; i += 1) feedOne();

  /* ── 피글린 — 짐칸 안에서 문과 더미 사이를 오간다 ── */
  const pig = makePiglin();
  pig.grp.position.set(0, floor, door + 0.55);
  g.add(pig.grp);

  /* 한 개를 싣는 데 걸리는 시간과, 그 안에서 각 동작이 끝나는 지점(초).
     ⚠️ 순서대로 커져야 한다 — 어긋나면 손이 비었는데 놓는 동작이 나온다. */
  const T = 3.6;
  const t1 = 0.9, t2 = 1.15, t3 = 2.1, t4 = 2.55;  // 대기 / 집기 / 나르기 / 놓기
  const Z_DOOR = door + 0.55, Z_STACK = door + 1.55;
  let t = 0, stage = -1;

  const ease = (u) => u * u * (3 - 2 * u);          // 시작·끝이 느린 보간
  /** 집거나 놓는 동안의 짧은 이동. 부모가 무엇이든 **그 부모 안에서의** 자리로 옮긴다 */
  let tween = null;
  const tmp = new THREE.Vector3();

  const stageOf = (x) =>
    (x < t1 ? 0 : x < t2 ? 1 : x < t3 ? 2 : x < t4 ? 3 : 4);

  /* 상자가 놓일 **손 자리** (피글린 로컬).
     ★ 눈대중으로 (0, 0.75, 0.32) 에 두었더니 상자가 몸통을 파고들고 손은 상자 밖에 있었다
       (사용자 지적 — 피글린과 상자가 겹친다). 팔 끝을 실제로 계산해서 맞춘 값이다.
     ── 계산 ──────────────────────────────────────────────────────────
       1픽셀 P = 0.0625, 피글린 스케일 0.86 → 1픽셀이 0.05375m
       어깨 y = 23px, 팔 길이 12px, 나를 때 팔 각도 1.3rad
       손 y = (23 − 12·cos1.3)px = 19.8px = 1.064m
       손 z = (12·sin1.3)px      = 11.6px = 0.621m
       몸통 앞면 z = 2.15px = 0.116m
     → 상자(깊이 0.34) 중심을 z 0.50 에 두면 0.33~0.67 을 차지해 **손이 그 안에** 들어오고,
       몸통 앞면과는 0.21m 뜬다. 높이 1.00 이면 손이 상자 윗부분을 잡은 모양이 된다. */
  const HAND = new THREE.Vector3(0, 1.00, 0.50);

  /** 벨트 맨 앞 상자를 손으로 옮긴다 */
  const grab = () => {
    if (carried || queue.length === 0) return;
    const m = queue.shift();
    /* ⚠️ 있던 자리에서 **미끄러져** 손으로 온다. 곧바로 손 자리에 꽂으면 40cm 를 순간이동해
       벨트에서 손으로 튄다 — 집는 것이 아니라 바뀌는 것으로 보인다. */
    pig.grp.updateMatrixWorld(true);
    m.getWorldPosition(tmp);
    pig.grp.add(m);
    m.position.copy(pig.grp.worldToLocal(tmp.clone()));
    m.rotation.set(0, 0, 0);
    carried = m;
    tween = { m, from: m.position.clone(), to: HAND.clone(), u: 0, dur: t2 - t1 };
    feedOne();
  };

  /** 손의 상자를 더미에 내려놓는다 */
  const place = () => {
    if (!carried) return;
    const m = carried;
    carried = null;
    /* ⚠️ 세계 좌표를 먼저 읽고, 부모를 바꾼 뒤 그 자리로 되돌린다. 순서가 바뀌면 상자가
       한 프레임 원점에 나타난다. */
    pig.grp.updateMatrixWorld(true);
    m.getWorldPosition(tmp);
    g.add(m);
    g.updateMatrixWorld(true);
    m.position.copy(g.worldToLocal(tmp));
    m.rotation.set(0, 0, 0);
    tween = { m, from: m.position.clone(), to: new THREE.Vector3(...slotAt(piled.length)), u: 0, dur: t4 - t3 };
    piled.push(m);

    /* 다 실었다 — 한 차 나간 것으로 치고 더미를 비워 벨트로 돌려보낸다 */
    if (piled.length >= SLOTS) {
      for (const b of piled) { b.visible = false; spare.push(b); }
      piled.length = 0;
    }
  };

  return {
    group: g,
    update(dt) {
      t += dt;
      if (t >= T) t -= T;

      const st = stageOf(t);
      if (st !== stage) {
        /* ⚠️ **바뀌는 순간에만** 집고 놓는다. 매 프레임 부르면 상자가 프레임마다 부모를
           오가며 깜빡인다. */
        if (st === 1) grab();
        if (st === 3) place();
        stage = st;
      }

      for (const r of rollers) r.rotation.x += dt * 4.4;

      /* 벨트 — 맨 앞은 인계 지점에서 멈추고, 뒤는 앞차 간격을 지킨다.
         ⚠️ 각자 같은 속도로만 가게 두면 맨 앞이 기다리는 동안 뒤차가 파고들어 겹친다. */
      let ahead = HOLD;
      for (const b of queue) {
        b.position.z = Math.min(ahead, b.position.z + 0.55 * dt);
        ahead = b.position.z - GAP;
      }

      /* 집기·놓기 — 있던 자리에서 목표 자리까지 짧게 미끄러진다 */
      if (tween) {
        tween.u = Math.min(1, tween.u + dt / tween.dur);
        tween.m.position.lerpVectors(tween.from, tween.to, ease(tween.u));
        if (tween.u >= 1) tween = null;
      }

      /* 피글린 — 문 ↔ 더미 왕복 */
      let z = Z_DOOR, face = Math.PI, walk = 0;
      if (t < t1) {                                 // 문 앞에서 기다린다
        pig.lArm.rotation.x = -0.5 - 0.35 * Math.sin((t / t1) * Math.PI);
        pig.rArm.rotation.x = pig.lArm.rotation.x;
      } else if (t < t2) {                          // 집는다
        pig.lArm.rotation.x = -1.3;
        pig.rArm.rotation.x = -1.3;
      } else if (t < t3) {                          // 안으로 나른다
        const u = ease((t - t2) / (t3 - t2));
        z = Z_DOOR + (Z_STACK - Z_DOOR) * u;
        face = Math.PI + u * Math.PI;               // 돌아서면서 걷는다
        walk = 1;
        pig.lArm.rotation.x = -1.3;
        pig.rArm.rotation.x = -1.3;
      } else if (t < t4) {                          // 내려놓는다
        z = Z_STACK;
        face = 0;
        const u = (t - t3) / (t4 - t3);
        pig.lArm.rotation.x = -1.3 + u * 0.5;
        pig.rArm.rotation.x = pig.lArm.rotation.x;
      } else {                                      // 빈손으로 돌아온다
        const u = ease((t - t4) / (T - t4));
        z = Z_STACK + (Z_DOOR - Z_STACK) * u;
        face = u * Math.PI;                         // 0 → π (다시 문을 본다)
        walk = 1;
        pig.lArm.rotation.x = -0.2;
        pig.rArm.rotation.x = -0.2;
      }
      pig.grp.position.z = z;
      pig.grp.rotation.y = face;
      const sw = walk ? Math.sin(t * 11) * 0.55 : 0;
      pig.lLeg.rotation.x = sw;
      pig.rLeg.rotation.x = -sw;
    },
  };
}

/** 하역 도크 — 콘크리트 단과 도크 문, 고무 범퍼. -z 를 보는 방향으로 짓는다 */
function buildDock(THREE, dispose, { width, bays }) {
  const g = new THREE.Group();
  const conc = new THREE.MeshLambertMaterial({ color: 0x9aa2ac });
  const rubber = new THREE.MeshLambertMaterial({ color: 0x1a1e24 });

  /* 단을 3.2m 에서 1.5m 로 줄였다. 길게 빼면 트럭이 벽에서 그만큼 멀어져, 후진해
     붙은 게 아니라 마당에 세워 둔 것처럼 보인다 */
  const DOCK_H = 1.15, DOCK_D = 1.5;
  const slab = new THREE.Mesh(new THREE.BoxGeometry(width, DOCK_H, DOCK_D), conc);
  slab.position.set(0, DOCK_H / 2, DOCK_D / 2);
  slab.receiveShadow = true;   // 트럭·상자 그림자가 이 단 위에 진다
  slab.castShadow = true;
  g.add(slab);
  dispose.push(slab.geometry);

  /* ★ 베이마다 세워 두던 **셔터 문을 없앴다** (사용자 지적).
     창고 벽이 통짜였을 때는 그 문이 바깥에서 도크를 도크로 보이게 하는 유일한 표시였다.
     지금은 벽에 문틀이 뚫려 있어서, 그 셔터가 열린 문 **바로 뒤에 서서** 트럭 짐칸을
     가린다 — 안을 보라고 뚫어 놓고 그 앞을 막고 선 꼴이다. 문 노릇은 벽의 문틀이 하고,
     여기 남는 것은 단·범퍼뿐이다.
     ⚠️ 되살릴 때는 **열린 자세**로 세워야 한다. 닫힌 셔터를 그대로 두면 같은 문제가
        다시 생긴다. */
  const bumpGeo = new THREE.BoxGeometry(0.4, 0.5, 0.26);
  const span = width - 5;
  const xs = [];
  for (let i = 0; i < bays; i++) {
    const x = bays === 1 ? 0 : -span / 2 + (i * span) / (bays - 1);
    xs.push(x);
    for (const sx of [-1.6, 1.6]) {
      const bump = new THREE.Mesh(bumpGeo, rubber);
      bump.position.set(x + sx, DOCK_H - 0.2, DOCK_D - 0.05);
      g.add(bump);
    }
  }
  dispose.push(bumpGeo, conc, rubber);
  return { group: g, xs, face: DOCK_D, top: DOCK_H };
}

/**
 * @param {object} THREE
 * @param {{floorW:number, floorD:number, floorCz:number}} dims 창고 바닥 치수
 * @param {{makePiglin?: () => object}} deps 상차 장면이 쓸 작업자. **창고 안 작업자와 같은
 *   함수**를 넘겨야 한다 — 여기서 따로 만들면 같은 창고에서 다른 사람이 일하게 된다.
 *   없으면 상차 장면 없이 트럭만 세운다.
 * @returns {{group: object, update: (dt:number) => void, dispose: () => void}}
 */
export function createExterior(THREE, { floorW, floorD, floorCz }, { makePiglin } = {}) {
  const group = new THREE.Group();
  const dispose = [];

  const dockX = floorW / 2 + 0.9;   // 건물 오른쪽 벽 바로 바깥

  const lampSpots = [
    [-floorW / 2 - 15, floorCz - 14],
    [-floorW / 2 - 15, floorCz + 8],
    [-floorW / 2 - 15, floorCz + 26],
    [floorW / 2 + 26, floorCz - 16],
    [floorW / 2 + 26, floorCz + 16],
    [-13, floorCz - floorD / 2 - 16],
    [13, floorCz - floorD / 2 - 16],
  ];

  group.add(buildYard(THREE, dispose, { floorW, floorD, floorCz, dockX }));
  group.add(buildLamps(THREE, dispose, lampSpots));

  /* ── 도크와 트럭 — 건물 **오른쪽**(+x) ──
     ⚠️ 앞쪽(+z)에 두면 안 된다. 기본 카메라가 앞마당 한가운데(z ≈ +20)에 서 있어서,
        거기 트럭을 놓으면 카메라 코앞을 가로막는다. 오른쪽이면 기본 시점에서 건물 옆으로
        나란히 보이고(참고 이미지의 배치), 화면을 가리지도 않는다.
     ⚠️ 도크는 부품이 전부 **local +z 쪽으로** 자란다(단·범퍼·트럭 모두). 그룹을 +90°
        돌리면 local +z 가 world +x 로 가서, 건물 오른쪽 **바깥**으로 뻗는다.
        -90° 로 돌리면 정확히 반대로 건물 **안쪽**을 파고든다 — 실제로 그렇게 되어 있어서
        트럭이 랙 사이에 박혀 있었다. 부호 하나가 안팎을 가른다. */
  const bay = new THREE.Group();
  bay.rotation.y = Math.PI / 2;
  bay.position.set(dockX, 0, floorCz);
  group.add(bay);

  const dock = buildDock(THREE, dispose, { width: 20, bays: 2 });
  bay.add(dock.group);

  /* 트럭 2대만 세운다. 도크를 줄줄이 채우면 화면이 트럭으로 찬다 —
     운영 중인 창고는 도크 대부분이 비어 있고 한두 대가 붙어 있다.
     ⚠️ 트럭은 뒷문이 원점이고 차체가 +z 로 뻗는다(`buildTruck` 주석 참고). 그래서 z 를
        범퍼 바로 뒤(`dock.face + 0.1`)에 두면 뒷문이 범퍼에 닿고 차체 전체가 마당으로
        나간다. 차 길이가 바뀌어도 이 값은 그대로다. */
  /* ★ **앞쪽 한 대만 문을 연다** (사용자 요청 — 상차 중인 차). 두 대 다 열어 두면
     상차 장면이 둘로 늘어 화면이 산만하고, 도크가 늘 만차인 창고로 보인다. */
  let loading = null;
  let depart = null;   // 두 번째(닫힌) 트럭 — 출고 시점에서만 배송을 나간다
  dock.xs.forEach((x, i) => {
    const open = i === 0 && typeof makePiglin === "function";
    /* ★ 상차 중인 차는 **비스듬히** 세운다 (사용자 요청 — 안이 잘 안 보인다).
         뒷문이 창고 벽을 정면으로 보고 있으면 짐칸 안이 어느 각도에서도 안 보인다.
         조금 틀어 두면 열린 문으로 안이 들여다보이고, 실제 도크에서도 트럭이 자로 잰
         듯 붙지는 않는다.
       ⚠️ 축을 **뒷문 자리**에 둔다. 차 한가운데를 축으로 돌리면 뒷문이 도크에서 떨어져
          나가, 붙어 있던 차가 마당 한가운데로 밀려난다.
       ⚠️ 트럭과 상차 라인(롤러·상자·피글린)을 **같은 그룹에** 넣는다. 따로 두면 차만
          돌고 상자 줄은 제자리에 남아 허공에서 상자를 받는 그림이 된다. */
    const slot = new THREE.Group();
    slot.position.set(x, 0, dock.face + 0.1);
    slot.rotation.y = open ? 0.34 : 0;   // 약 19°
    bay.add(slot);

    const t = buildTruck(THREE, dispose, { open });
    /* 트럭이 마당에 그림자를 드리운다 — 이게 없으면 8m 짜리 차가 떠 보인다.
       ⚠️ 짐칸 안쪽 껍데기는 `BackSide` 라 그림자 맵에서 앞뒤가 뒤집힌다. 그래도 겉면
          상자가 이미 같은 자리를 덮고 있어 결과는 같으므로 따로 빼지 않는다. */
    t.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    slot.add(t);
    if (!open) {
      /* ⚠️ 움직일 대상은 트럭(`t`)이 아니라 **`slot`** 이다. 트럭만 옮기면 회전축이 차
         한가운데가 되어 도크에 붙어 있던 뒷문이 옆으로 쓸려 나간다. slot 은 뒷문 자리에
         원점이 있어(위 주석) 그대로 차량 좌표계로 쓸 수 있다. */
      depart = { slot, on: false, x0: slot.position.x, z0: slot.position.z, px: slot.position.x, pz: slot.position.z, d: 0, v: 0, head: 0 };
      return;
    }
    loading = buildLoading(THREE, dispose, {
      truckZ: 0, dockTop: dock.top, makePiglin,
    });
    loading.group.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    slot.add(loading.group);
  });

  return {
    group,
    /* 도크 베이의 **월드 z**. 창고 오른쪽 벽에 문을 뚫는 자리다.
       ⚠️ 벽 쪽에서 다시 계산하지 않게 여기서 내준다. 도크는 `bay` 안에 살고 그 그룹은
          +90° 돌아 있어서 로컬 x 가 월드 **-z** 로 간다 — 이 변환을 두 곳에 적어 두면
          도크를 옮겼을 때 문만 제자리에 남는다. */
    doorZs: dock.xs.map((x) => floorCz - x),

    /* ── 두 번째 트럭 출차 ────────────────────────────────────────
       ★ Enter 로 출고 구역에 섰을 때만 닫힌 차가 배송을 나간다 (사용자 요청). 도크에 늘
         두 대가 붙어 있으면 정지 화면이라, 한 대가 천천히 빠져나가는 것만으로 "지금
         돌아가는 센터"가 된다.
       ⚠️ **평소 창고 화면에서는 움직이지 않는다.** 그래서 스스로 도는 애니메이션이 아니라
          시점 쪽에서 켜고 끄는 스위치다.
       ⚠️ 끌 때 **제자리로 되돌린다.** 안 그러면 Enter 를 한 바퀴 더 돌았을 때 도크 한 칸이
          빈 채로 남고, 마당 저편에 트럭이 서 있게 된다. */
    setDeparting(on) {
      if (!depart || depart.on === on) return;
      depart.on = on;
      if (!on) {
        depart.d = 0; depart.v = 0; depart.head = 0;
        depart.px = depart.x0; depart.pz = depart.z0;
        depart.slot.position.set(depart.x0, 0, depart.z0);
        depart.slot.rotation.y = 0;
      }
    },

    update(dt) {
      loading?.update(dt);

      /* 출차 주행 — 천천히 붙는 속도로 도크를 빠져나가 왼쪽으로 90° 돌아 사라진다.
         ⚠️ 진행 방향으로 **적분**한다. 목표 지점을 잡고 그리로 보간하면 차가 옆으로
            미끄러지는 그림이 된다 — 차는 제 코가 향한 쪽으로만 간다.
         ⚠️ 조향은 시간이 아니라 **거리**에 비례한다. 시간에 걸면 붙는 속도 구간에서
            제자리 회전처럼 팽이가 돈다. */
      if (depart?.on && depart.d < DEPART_LEN) {
        depart.v = Math.min(DEPART_V, depart.v + 1.6 * dt);
        const step = depart.v * dt;
        depart.d += step;
        if (depart.d > TURN_AT && depart.head < Math.PI / 2) {
          depart.head = Math.min(Math.PI / 2, depart.head + (Math.PI / 2) * (step / TURN_LEN));
        }
        depart.px += Math.sin(depart.head) * step;   // head 0 = 도크 밖으로 (local +z)
        depart.pz += Math.cos(depart.head) * step;
        depart.slot.position.set(depart.px, 0, depart.pz);
        depart.slot.rotation.y = depart.head;
      }
    },
    dispose() {
      for (const d of dispose) d?.dispose?.();
    },
  };
}
