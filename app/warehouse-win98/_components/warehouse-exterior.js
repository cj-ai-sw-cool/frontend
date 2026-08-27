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
   CJ대한통운 5톤 윙바디. 실제 차량 도장을 따랐다.
     · 차체 전체가 파랑, 지붕만 흰색
     · 적재함 앞쪽에 사선 띠 넉 줄 (하늘 → 남색 → 빨강 → 주황) 이 오른쪽 위로 흐른다
     · 적재함 뒤쪽에 CJ 심볼과 "대한통운"
     · 앞쪽 위에 홈페이지·대표번호 작은 흰 글씨

   ★ 세미트레일러(길이 12m)에서 **5톤 박스트럭(7.6m)** 으로 바꿨다. 국내 물류 창고
     도크에 실제로 붙는 차가 이 크기이고, 트레일러는 이 마당 규모에 견줘 너무 컸다.

   ⚠️ 옆면 도장은 **양쪽에 다른 텍스처**를 쓴다. `BoxGeometry` 의 +x 면은 u=0 이 차 앞쪽,
      -x 면은 u=0 이 차 **뒤쪽**에 붙는다. 같은 그림을 쓰면 한쪽만 로고가 앞으로 가고
      사선 띠가 반대로 흐른다. 그래서 배치를 되짚은 사본을 -x 면에 붙인다.
      (글자를 뒤집는 게 아니다 — `liveryTexture` 의 `X()` 주의를 볼 것)
   ⚠️ 재질 배열의 순서는 `[+x, -x, +y, -y, +z, -z]` 로 고정이다. 이 순서를 바꾸면 지붕
      흰색이 옆면으로 가는 식으로 어긋난다. */

const CJ_BLUE = "#1668C4";
const CJ_DEEP = "#0E2A5C";

/** 적재함 옆면 도장.
 *  `flip` 은 **배치만** 좌우로 되짚는다(글자는 똑바로 그린다) — 아래 `X()` 주의 참고. */
function liveryTexture(THREE, flip) {
  const W = 1024, H = 492;
  const cv = document.createElement("canvas");
  cv.width = W; cv.height = H;
  const c = cv.getContext("2d");

  /* 설계 좌표 → 캔버스 좌표.
     ⚠️ 예전에는 `c.translate(W,0); c.scale(-1,1)` 로 캔버스를 통째로 뒤집었다. 그러면
        배치뿐 아니라 **글자까지 좌우로 반전되어**, 반대편에서 "대한통운" 이 거울글씨로
        보였다. 뒤집어야 하는 것은 배치뿐이다 — 좌표만 되짚고 글자는 정방향으로 그린다.
     ⚠️ 좌우가 뒤집히면 글자 정렬도 함께 뒤집어야 한다. 왼쪽 정렬로 x 에 찍던 글자를
        되짚은 x 에 그대로 왼쪽 정렬하면 글자 블록이 반대쪽으로 삐져나간다. */
  const X = (x) => (flip ? W - x : x);
  const AL = (a) => (flip ? (a === "left" ? "right" : "left") : a);

  c.fillStyle = CJ_BLUE;
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
  band(128, 96, CJ_DEEP);     // 남색 (가장 넓다)
  band(228, 54, "#E5342C");   // 빨강
  band(286, 40, "#F5A623");   // 주황

  c.textBaseline = "middle";

  /* 홈페이지·대표번호 — 실제 차량에도 앞쪽 위에 작게 들어간다.
     ⚠️ 사선 띠와 겹치지 않는 자리(띠보다 뒤)에 둔다. 겹치면 파란 바탕에 흰 글씨가
        아니라 남색 위 흰 글씨가 되어 읽히지 않는다 */
  c.fillStyle = "rgba(255,255,255,0.92)";
  c.textAlign = AL("left");
  c.font = "700 26px 'Malgun Gothic', Arial, sans-serif";
  c.fillText("www.cjlogistics.co.kr", X(470), 74);
  c.font = "800 30px 'Consolas', monospace";
  c.fillText("1588-1255", X(470), 112);

  /* ── CJ 심볼 + 대한통운 ──
     심볼은 꽃잎 셋(빨강·주황·파랑)이 가운데를 돈다. 화면에서 30px 남짓으로 보일
     크기라 정밀하게 그릴 이유가 없고, 색과 배치만 맞으면 그것으로 읽힌다.
     ⚠️ 꽃잎은 글자가 아니므로 통째로 뒤집어도 된다 — 거울에 비친 꽃도 꽃이다. */
  const LX = 560, LY = H * 0.62, R = 62;
  c.save();
  c.translate(X(LX), LY);
  if (flip) c.scale(-1, 1);
  const petal = (angle, color) => {
    c.save();
    c.rotate(angle);
    c.fillStyle = color;
    c.beginPath();
    c.moveTo(0, 0);
    c.quadraticCurveTo(R * 0.95, -R * 0.30, R * 0.86, -R * 0.86);
    c.quadraticCurveTo(R * 0.30, -R * 0.95, 0, 0);
    c.closePath();
    c.fill();
    c.restore();
  };
  petal(-Math.PI / 2, "#E5342C");
  petal(-Math.PI / 2 + (Math.PI * 2) / 3, "#F5A623");
  petal(-Math.PI / 2 + (Math.PI * 4) / 3, "#4FC2EE");
  c.restore();

  c.fillStyle = "#FFFFFF";
  c.font = "900 76px 'Malgun Gothic', sans-serif";
  c.textAlign = AL("left");
  c.fillText("대한통운", X(LX + 92), LY - 4);

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
function rearDoorTexture(THREE) {
  const W = 256, H = 256;
  const cv = document.createElement("canvas");
  cv.width = W; cv.height = H;
  const c = cv.getContext("2d");
  for (let y = 0; y < H; y += 10) {
    const g = 176 + ((y / 10) % 2 === 0 ? 14 : 0);
    c.fillStyle = `rgb(${g},${g + 3},${g + 8})`;
    c.fillRect(0, y, W, 10);
    c.fillStyle = "rgba(90,98,108,0.5)";
    c.fillRect(0, y + 9, W, 1);
  }
  // 위쪽 파란 띠 + 손잡이 봉 두 개
  c.fillStyle = CJ_BLUE;
  c.fillRect(0, 0, W, 34);
  c.fillStyle = "#8A939E";
  c.fillRect(W * 0.3, 40, 7, H - 60);
  c.fillRect(W * 0.68, 40, 7, H - 60);

  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * CJ대한통운 박스트럭.
 * ⚠️ **뒷문이 원점(z = 0)** 이고 차체는 +z 쪽으로 뻗는다. 도크에 붙일 때 "뒷문을 범퍼에
 *    맞춘다"가 곧 "z 를 범퍼 위치에 둔다"가 되어, 차 길이를 몰라도 세울 수 있다.
 */
function buildTruck(THREE, dispose) {
  const g = new THREE.Group();

  const BW = 2.32;               // 적재함 폭
  const BOX_L = 5.2, BOX_H = 2.5, BOX_Y = 1.05;   // 적재함 길이·높이·바닥 높이
  const CAB_L = 2.05;

  const blueMat = new THREE.MeshLambertMaterial({ color: 0x1668c4 });
  const roofMat = new THREE.MeshLambertMaterial({ color: 0xe6ebf1 });
  const darkMat = new THREE.MeshLambertMaterial({ color: 0x232830 });
  const glassMat = new THREE.MeshLambertMaterial({ color: 0x1b2b3d });
  const chromeMat = new THREE.MeshLambertMaterial({ color: 0x9aa3ad });

  const liveryR = liveryTexture(THREE, false);   // +x 면: u=0 이 차 앞
  const liveryL = liveryTexture(THREE, true);    // -x 면: u=0 이 차 뒤 → 배치를 되짚는다
  const doorTex = rearDoorTexture(THREE);
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

/** 하역 도크 — 콘크리트 단과 도크 문, 고무 범퍼. -z 를 보는 방향으로 짓는다 */
function buildDock(THREE, dispose, { width, bays }) {
  const g = new THREE.Group();
  const conc = new THREE.MeshLambertMaterial({ color: 0x9aa2ac });
  const rubber = new THREE.MeshLambertMaterial({ color: 0x1a1e24 });
  const doorMat = new THREE.MeshLambertMaterial({ color: 0x6d7a8a });

  /* 단을 3.2m 에서 1.5m 로 줄였다. 길게 빼면 트럭이 벽에서 그만큼 멀어져, 후진해
     붙은 게 아니라 마당에 세워 둔 것처럼 보인다 */
  const DOCK_H = 1.15, DOCK_D = 1.5;
  const slab = new THREE.Mesh(new THREE.BoxGeometry(width, DOCK_H, DOCK_D), conc);
  slab.position.set(0, DOCK_H / 2, DOCK_D / 2);
  g.add(slab);
  dispose.push(slab.geometry);

  const bayGeo = new THREE.BoxGeometry(2.9, 3.2, 0.16);
  const bumpGeo = new THREE.BoxGeometry(0.4, 0.5, 0.26);
  const span = width - 5;
  const xs = [];
  for (let i = 0; i < bays; i++) {
    const x = bays === 1 ? 0 : -span / 2 + (i * span) / (bays - 1);
    xs.push(x);
    const door = new THREE.Mesh(bayGeo, doorMat);
    door.position.set(x, DOCK_H + 1.6, 0.1);
    g.add(door);
    for (const sx of [-1.6, 1.6]) {
      const bump = new THREE.Mesh(bumpGeo, rubber);
      bump.position.set(x + sx, DOCK_H - 0.2, DOCK_D - 0.05);
      g.add(bump);
    }
  }
  dispose.push(bayGeo, bumpGeo, conc, rubber, doorMat);
  return { group: g, xs, face: DOCK_D };
}

/**
 * @param {object} THREE
 * @param {{floorW:number, floorD:number, floorCz:number}} dims 창고 바닥 치수
 * @returns {{group: object, dispose: () => void}}
 */
export function createExterior(THREE, { floorW, floorD, floorCz }) {
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
  for (const x of dock.xs) {
    const t = buildTruck(THREE, dispose);
    t.position.set(x, 0, dock.face + 0.1);
    bay.add(t);
  }

  return {
    group,
    dispose() {
      for (const d of dispose) d?.dispose?.();
    },
  };
}
