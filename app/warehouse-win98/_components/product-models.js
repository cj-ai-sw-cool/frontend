/* ═══════════════════════════════════════════════════════════════════════════
   시연 상품 3D 모델

   ★ 적재 시뮬레이션에서 로봇이 나르는 물건을 **그 상품처럼** 보이게 한다 (사용자 요청).
     골판지 상자 세 개가 지나가는 것과, 컵라면 여섯 개가 담긴 트레이가 지나가는 것은
     시연에서 전혀 다르게 읽힌다 — 앞엣것은 "물류 데모"이고 뒤엣것은 "우리 물건"이다.

   ⚠️ 모델은 **실제 치수로** 만든다. 시뮬레이션의 짐은 원래 `l/w/h` 로 크기를 정하는데,
      모델은 그 축척을 쓰지 않고 제 크기로 서 있는다. 그래서 `DEMO_ITEMS` 의 치수를 바꾸면
      모델도 같이 고쳐야 한다 — 안 고치면 자막에 적힌 치수와 화면의 물건이 어긋난다.
   ⚠️ 무늬는 **캔버스로 그린다.** 이미지 파일을 쓰면 빌드에 자산이 붙고, 상품이 바뀔 때마다
      디자인 파일을 오간다. 물류 화면에서 필요한 것은 "무엇인지 알아볼 정도"까지다.
   ⚠️ 원점은 **상자의 한가운데**다. 시뮬레이션이 짐을 `y + h/2` 에 놓으므로, 바닥을 원점에
      두면 물건이 반쯤 파묻힌다.
   ═══════════════════════════════════════════════════════════════════════════ */

/** 캔버스 하나 만들고 그리기 컨텍스트를 넘긴다 */
function canvas(THREE, w, h, draw) {
  const cv = document.createElement("canvas");
  cv.width = w;
  cv.height = h;
  draw(cv.getContext("2d"), w, h);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

/* ── 농심 누들핏 카구리맛 40.5g — 6개입 케이스 ────────────────────────────────
   단품: 지름 약 99mm, 높이 99mm 의 소컵 (위가 넓은 원뿔대)
   케이스: 3 x 2 로 세워 담아 300 x 198 x 99 mm

   ⚠️ 컵 반지름(0.0495)과 자리 간격이 **딱 맞물린다.** 3개 x 0.099 = 0.297 ≈ 케이스 폭 0.30,
      2개 x 0.099 = 0.198 = 케이스 깊이. 하나라도 키우면 컵끼리 겹치거나 트레이를 넘는다. */
export function makeKaguriCase(THREE) {
  const g = new THREE.Group();
  const keep = [];
  const M = (o) => { const m = new THREE.MeshLambertMaterial(o); keep.push(m); return m; };
  const G = (geo) => { keep.push(geo); return geo; };

  const CASE_H = 0.099;
  const TRAY_H = 0.006;
  const R_TOP = 0.0495, R_BOT = 0.036;
  const CUP_H = CASE_H - TRAY_H;              // 트레이 위에 서서 케이스 높이를 채운다
  const yBottom = -CASE_H / 2;                // 케이스 바닥

  /* ── 몸통 무늬 ──
     원통 옆면의 v 는 아래(0)에서 위(1)로 간다. 캔버스는 y=0 이 위쪽이므로 **캔버스 위쪽이
     컵 위쪽**이다 — 노란 상표를 위에, 짙은 면 그림을 아래에 그린다. */
  const bodyTex = canvas(THREE, 512, 200, (c, W, H) => {
    c.fillStyle = "#F2C230";                  // 노란 바탕
    c.fillRect(0, 0, W, H);
    // 아래쪽 짙은 면 그림
    c.fillStyle = "#4A2A12";
    c.fillRect(0, H * 0.46, W, H * 0.54);
    c.strokeStyle = "rgba(214,150,60,0.75)";  // 면발
    c.lineWidth = 3;
    for (let i = 0; i < 26; i += 1) {
      const x = (i / 26) * W;
      c.beginPath();
      c.moveTo(x, H * 0.52);
      c.bezierCurveTo(x + 14, H * 0.68, x - 14, H * 0.80, x + 8, H * 0.96);
      c.stroke();
    }
    // 붉은 국물 기운
    c.fillStyle = "rgba(150,44,18,0.45)";
    c.fillRect(0, H * 0.46, W, H * 0.12);

    c.textAlign = "center";
    c.textBaseline = "middle";
    /* ⚠️ 글씨는 u = 0.5 쯤에 한 번만 그린다. 원통은 이 그림을 **한 바퀴에 한 번** 두르므로,
       여러 번 그리면 상표가 컵을 빙 둘러 반복된다 */
    c.fillStyle = "#C8102E";
    c.font = "900 64px 'Malgun Gothic', '맑은 고딕', sans-serif";
    c.fillText("누들핏", W * 0.5, H * 0.24);
    // 카구리 — 밝은 타원 위에
    c.fillStyle = "#F7E3A8";
    c.beginPath();
    c.ellipse(W * 0.5, H * 0.40, 92, 26, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = "#8A3A10";
    c.font = "900 40px 'Malgun Gothic', '맑은 고딕', sans-serif";
    c.fillText("카구리", W * 0.5, H * 0.41);
    // 농심 마크 — 붉은 원과 흰 글자
    c.fillStyle = "#C8102E";
    c.beginPath();
    c.arc(W * 0.5 - 150, H * 0.22, 17, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = "#FFFFFF";
    c.font = "700 17px 'Malgun Gothic', sans-serif";
    c.fillText("농심", W * 0.5 - 150, H * 0.225);
  });

  /* ── 뚜껑 무늬 (원통의 윗면) ──
     ⚠️ 원통 윗면의 uv 는 **원판을 감싼 사각형**이라, 그림의 네 귀퉁이는 잘려 안 보인다.
        중요한 것은 가운데에 몰아 그린다. */
  const lidTex = canvas(THREE, 256, 256, (c, W) => {
    c.fillStyle = "#F0BE2A";
    c.fillRect(0, 0, W, W);
    c.strokeStyle = "rgba(180,130,30,0.5)";   // 실링 자국
    c.lineWidth = 2;
    c.beginPath();
    c.arc(W / 2, W / 2, W * 0.44, 0, Math.PI * 2);
    c.stroke();
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.fillStyle = "#C8102E";
    c.beginPath();
    c.arc(W * 0.30, W * 0.34, 14, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = "#FFFFFF";
    c.font = "700 13px 'Malgun Gothic', sans-serif";
    c.fillText("농심", W * 0.30, W * 0.345);
    c.fillStyle = "#C8102E";
    c.font = "900 40px 'Malgun Gothic', '맑은 고딕', sans-serif";
    c.fillText("누들핏", W / 2, W * 0.46);
    c.fillStyle = "#F7E3A8";
    c.beginPath();
    c.ellipse(W / 2, W * 0.63, 62, 19, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = "#8A3A10";
    c.font = "900 27px 'Malgun Gothic', '맑은 고딕', sans-serif";
    c.fillText("카구리", W / 2, W * 0.635);
    c.fillStyle = "rgba(90,50,16,0.8)";
    c.font = "700 16px 'Arial', sans-serif";
    c.fillText("120kcal", W / 2, W * 0.79);
  });

  /* ── 트레이 ──
     낮은 골판지 받침. 컵이 그 위에 선다 */
  const tray = M({ color: 0xB98F5C });
  const base = new THREE.Mesh(G(new THREE.BoxGeometry(0.30, TRAY_H, 0.198)), tray);
  base.position.y = yBottom + TRAY_H / 2;
  g.add(base);
  const wallLong = G(new THREE.BoxGeometry(0.30, 0.022, 0.004));
  const wallShort = G(new THREE.BoxGeometry(0.004, 0.022, 0.198));
  for (const sz of [-1, 1]) {
    const m = new THREE.Mesh(wallLong, tray);
    m.position.set(0, yBottom + 0.011, sz * (0.198 / 2 - 0.002));
    g.add(m);
  }
  for (const sx of [-1, 1]) {
    const m = new THREE.Mesh(wallShort, tray);
    m.position.set(sx * (0.30 / 2 - 0.002), yBottom + 0.011, 0);
    g.add(m);
  }

  /* ── 컵 6개 ──
     ⚠️ 면 순서가 [옆면, 윗면, 아랫면] 이라, 재질 배열도 그 순서로 준다. 뒤집으면 뚜껑
        무늬가 컵 바닥에 붙는다. */
  const cupGeo = G(new THREE.CylinderGeometry(R_TOP, R_BOT, CUP_H, 20));
  const rimGeo = G(new THREE.TorusGeometry(R_TOP - 0.002, 0.0035, 6, 22));
  const bodyMat = M({ map: bodyTex });
  const lidMat = M({ map: lidTex });
  const botMat = M({ color: 0xE8E2D6 });
  const rimMat = M({ color: 0xEBD9A6 });
  keep.push(bodyTex, lidTex);

  const cupY = yBottom + TRAY_H + CUP_H / 2;
  for (let i = 0; i < 6; i += 1) {
    const cx = ((i % 3) - 1) * 0.099;
    const cz = (Math.floor(i / 3) - 0.5) * 0.099;
    const cup = new THREE.Mesh(cupGeo, [bodyMat, lidMat, botMat]);
    cup.position.set(cx, cupY, cz);
    /* 상표가 보는 쪽을 향하게 조금씩 다르게 돌린다 — 여섯 개가 똑같이 서 있으면 찍어낸
       것처럼 보인다. 실제 트레이도 손으로 담아 조금씩 틀어져 있다 */
    cup.rotation.y = Math.PI + (i % 2 ? 0.18 : -0.12);
    g.add(cup);

    const rim = new THREE.Mesh(rimGeo, rimMat);
    rim.rotation.x = Math.PI / 2;
    rim.position.set(cx, yBottom + TRAY_H + CUP_H - 0.002, cz);
    g.add(rim);
  }

  g.userData.dispose = () => { for (const k of keep) k.dispose?.(); };
  return g;
}

/* ── 하이트진로 테라 1600mL 페트 — 12병 케이스 ────────────────────────────────
   단품: 지름 약 102mm, 높이 318mm 의 대용량 페트
   케이스: 4 x 3 으로 세워 담아 408 x 309 x 318 mm

   ⚠️ 자리 간격이 병 지름과 **딱 맞물린다.** 4개 x 0.102 = 0.408 = 케이스 폭,
      3개 x 0.103 = 0.309 = 케이스 깊이. 하나라도 키우면 병끼리 겹치거나 트레이를 넘는다.
   ⚠️ 병 하나를 메시 다섯 개로 만들면 12병에 60개가 된다. 부위마다 **인스턴싱**으로 묶어
      다섯 번만 그린다 — 같은 모양이 열두 번 서는 것이라 딱 맞는 쓰임이다. */
export function makeTerraCase(THREE) {
  const g = new THREE.Group();
  const keep = [];
  const M = (o) => { const m = new THREE.MeshLambertMaterial(o); keep.push(m); return m; };
  const G = (geo) => { keep.push(geo); return geo; };

  const CASE_H = 0.318, TRAY_H = 0.008;
  const yBottom = -CASE_H / 2;
  const foot = yBottom + TRAY_H;            // 병이 서는 높이

  /* ── 라벨 무늬 ──
     원통 옆면의 v 는 아래(0)에서 위(1)로 간다. 글씨는 u = 0.5 쯤에 **한 번만** 그린다 —
     원통이 이 그림을 한 바퀴에 한 번 두르므로, 여러 번 그리면 상표가 병을 빙 둘러 반복된다 */
  const labelTex = canvas(THREE, 512, 220, (c, W, H) => {
    c.fillStyle = "#2E9E4A";                // 초록 라벨
    c.fillRect(0, 0, W, H);
    c.fillStyle = "rgba(255,255,255,0.10)"; // 위아래 옅은 띠
    c.fillRect(0, 0, W, H * 0.14);
    c.fillRect(0, H * 0.86, W, H * 0.14);
    c.textAlign = "center";
    c.textBaseline = "middle";
    // 금색 V — 상표 아래 삼각 표식
    c.strokeStyle = "#E8C33A";
    c.lineWidth = 7;
    c.beginPath();
    c.moveTo(W * 0.5 - 42, H * 0.60);
    c.lineTo(W * 0.5, H * 0.78);
    c.lineTo(W * 0.5 + 42, H * 0.60);
    c.stroke();
    c.fillStyle = "#FFFFFF";
    c.font = "900 78px 'Arial Black', 'Arial', sans-serif";
    try { c.letterSpacing = "6px"; } catch { /* 지원 안 하면 자간 없이 */ }
    c.fillText("TERRA", W * 0.5, H * 0.36);
    c.font = "700 24px 'Arial', sans-serif";
    c.fillText("FROM AGM", W * 0.5, H * 0.50);
  });
  keep.push(labelTex);

  /* ── 자리 12곳 ──
     상표가 보는 쪽을 향하게 조금씩 다르게 돌린다 — 열둘이 똑같이 서 있으면 찍어낸 것처럼
     보인다. 실제 케이스도 손으로 담아 조금씩 틀어져 있다 */
  const spots = [];
  for (let i = 0; i < 12; i += 1) {
    spots.push({
      x: ((i % 4) - 1.5) * 0.102,
      z: (Math.floor(i / 4) - 1) * 0.103,
      rot: Math.PI + (i % 3 - 1) * 0.22,
    });
  }
  const dummy = new THREE.Object3D();
  /** 부위 하나를 열두 자리에 한 번에 세운다 */
  const part = (geo, mat, yOff) => {
    const im = new THREE.InstancedMesh(G(geo), mat, spots.length);
    spots.forEach((sp, i) => {
      dummy.position.set(sp.x, foot + yOff, sp.z);
      dummy.rotation.set(0, sp.rot, 0);
      dummy.updateMatrix();
      im.setMatrixAt(i, dummy.matrix);
    });
    im.instanceMatrix.needsUpdate = true;
    g.add(im);
  };

  /* 병 — 바닥부터 쌓은 높이가 곧 병 높이(0.310)다.
       몸통 0.000~0.200 · 라벨 0.052~0.158 · 어깨 0.200~0.252 · 목 0.252~0.282 · 캡 0.282~0.310
     ⚠️ 라벨은 몸통보다 **아주 조금 굵게** 두른다. 같은 반지름이면 두 면이 같은 자리에서
        다퉈 얼룩덜룩해진다(z-파이팅). */
  const glass = M({ color: 0x1B3A1E });     // 속이 비치는 진한 녹갈색
  const capMat = M({ color: 0x2A8B3F });
  part(new THREE.CylinderGeometry(0.051, 0.047, 0.200, 16), glass, 0.100);
  part(new THREE.CylinderGeometry(0.0518, 0.0518, 0.106, 16, 1, true), M({ map: labelTex }), 0.105);
  part(new THREE.CylinderGeometry(0.025, 0.051, 0.052, 16), glass, 0.226);
  part(new THREE.CylinderGeometry(0.0235, 0.0235, 0.030, 12), capMat, 0.267);
  part(new THREE.CylinderGeometry(0.026, 0.026, 0.028, 12), capMat, 0.296);

  /* ── 트레이 ── */
  const tray = M({ color: 0xB98F5C });
  const base = new THREE.Mesh(G(new THREE.BoxGeometry(0.408, TRAY_H, 0.309)), tray);
  base.position.y = yBottom + TRAY_H / 2;
  g.add(base);
  const wallLong = G(new THREE.BoxGeometry(0.408, 0.030, 0.004));
  const wallShort = G(new THREE.BoxGeometry(0.004, 0.030, 0.309));
  for (const sz of [-1, 1]) {
    const m = new THREE.Mesh(wallLong, tray);
    m.position.set(0, yBottom + 0.015, sz * (0.309 / 2 - 0.002));
    g.add(m);
  }
  for (const sx of [-1, 1]) {
    const m = new THREE.Mesh(wallShort, tray);
    m.position.set(sx * (0.408 / 2 - 0.002), yBottom + 0.015, 0);
    g.add(m);
  }

  g.userData.dispose = () => { for (const k of keep) k.dispose?.(); };
  return g;
}

/* ── 오리온 오뜨 치즈 12p — 32개입 케이스 ─────────────────────────────────────
   단품: 252 x 316 x 39 mm 의 납작한 종이 상자
   케이스: 2열 x 2줄 x **8단**으로 눕혀 쌓아 504 x 632 x 312 mm

   ★ 눕혀 쌓는다. 앞의 둘(컵라면·페트)은 세워 담지만 이것은 납작해서, 실제로도 피자 상자처럼
     포개어 수축 포장한다. 그래서 화면에서는 **맨 위 상자의 앞면**과 옆으로 줄줄이 드러난
     얇은 옆면이 보인다 — 그 줄무늬가 "몇 개 들었나"를 말해 준다.
   ⚠️ 8단 x 39mm = 312mm 로 케이스 높이가 **딱 맞는다.** 트레이를 깔 자리가 없어 받침을
      두지 않았다 (수축 포장이라 실제로도 없다).
   ⚠️ 앞면 무늬만 있고 옆면은 주황 민무늬다. 그래서 상자 하나를 **몸통 + 얇은 인쇄판** 둘로
      나눈다 — 한 덩어리에 면마다 다른 재질을 주려면 재질 배열이 필요한데, 인스턴싱과 함께
      쓰면 무늬가 어느 면에 붙을지가 three 버전에 따라 갈린다. 둘로 나누면 그럴 일이 없다. */
export function makeOtteCase(THREE) {
  const g = new THREE.Group();
  const keep = [];
  const M = (o) => { const m = new THREE.MeshLambertMaterial(o); keep.push(m); return m; };
  const G = (geo) => { keep.push(geo); return geo; };

  const BW = 0.252, BD = 0.316, BH = 0.039;   // 단품 한 개
  const CASE_H = BH * 8;                      // 0.312
  const yBottom = -CASE_H / 2;

  /* ── 앞면 무늬 ──
     상자를 눕히므로 이 그림이 **윗면**에 온다. 캔버스 가로가 상자의 짧은 변(252),
     세로가 긴 변(316)이다 — 비율을 맞춰야 글씨가 안 늘어난다. */
  const faceTex = canvas(THREE, 256, 320, (c, W, H) => {
    c.fillStyle = "#E8813A";                  // 주황 바탕
    c.fillRect(0, 0, W, H);
    c.fillStyle = "#F7EBD2";                  // 위쪽 크림색 띠
    c.fillRect(0, 0, W, H * 0.16);
    // 오리온 마크
    c.fillStyle = "#1B4FA0";
    c.beginPath();
    c.arc(W * 0.16, H * 0.07, 11, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = "#FFFFFF";
    c.font = "700 11px 'Malgun Gothic', sans-serif";
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.fillText("오리온", W * 0.16, H * 0.072);
    c.fillStyle = "#6A4A20";
    c.font = "700 13px 'Malgun Gothic', sans-serif";
    c.fillText("달지 않은 케이크", W * 0.60, H * 0.075);

    // 케이크 바 — 크림색 막대에 흰 드리즐
    c.save();
    c.translate(W * 0.5, H * 0.50);
    c.rotate(-0.22);
    c.fillStyle = "#F2D08A";
    c.fillRect(-W * 0.34, -18, W * 0.68, 36);
    c.strokeStyle = "#FFFFFF";
    c.lineWidth = 5;
    for (let i = -4; i <= 4; i += 1) {
      c.beginPath();
      c.moveTo(i * 18 - 8, -18);
      c.lineTo(i * 18 + 8, 18);
      c.stroke();
    }
    c.restore();

    // 오뜨 — 흰 글씨에 주황 테두리
    c.font = "900 76px 'Malgun Gothic', '맑은 고딕', sans-serif";
    c.lineWidth = 8;
    c.strokeStyle = "#C4551A";
    c.strokeText("오뜨", W * 0.42, H * 0.27);
    c.fillStyle = "#FFFFFF";
    c.fillText("오뜨", W * 0.42, H * 0.27);
    // 치즈
    c.font = "900 26px 'Malgun Gothic', sans-serif";
    c.fillStyle = "#FFFFFF";
    c.fillText("치즈", W * 0.30, H * 0.365);
    // Cheese — 크림색 흘림체 느낌
    c.font = "italic 900 44px 'Georgia', serif";
    c.fillStyle = "#F7E3B0";
    c.fillText("Cheese", W * 0.40, H * 0.70);
    // x12조각 배지
    c.fillStyle = "#C4551A";
    c.beginPath();
    c.ellipse(W * 0.72, H * 0.86, 46, 20, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = "#FFFFFF";
    c.font = "900 22px 'Arial', sans-serif";
    c.fillText("×12조각", W * 0.72, H * 0.865);
  });
  keep.push(faceTex);

  /* ── 자리 32곳 — 2열 x 2줄 x 8단 ── */
  const spots = [];
  for (let k = 0; k < 8; k += 1) {
    for (let i = 0; i < 4; i += 1) {
      spots.push({
        x: ((i % 2) - 0.5) * BW,
        z: (Math.floor(i / 2) - 0.5) * BD,
        y: yBottom + BH / 2 + k * BH,
        /* 손으로 쌓은 티 — 아주 조금씩 틀어 놓는다. 딱 맞으면 인쇄물 더미로 보인다 */
        rot: ((k * 7 + i * 3) % 5 - 2) * 0.012,
      });
    }
  }
  const dummy = new THREE.Object3D();
  const part = (geo, mat, yOff) => {
    const im = new THREE.InstancedMesh(G(geo), mat, spots.length);
    spots.forEach((sp, i) => {
      dummy.position.set(sp.x, sp.y + yOff, sp.z);
      dummy.rotation.set(0, sp.rot, 0);
      dummy.updateMatrix();
      im.setMatrixAt(i, dummy.matrix);
    });
    im.instanceMatrix.needsUpdate = true;
    g.add(im);
  };

  /* 몸통(주황)과 그 위에 얇게 얹은 인쇄판.
     ⚠️ 인쇄판을 몸통보다 아주 조금 작게 만든다. 같은 크기면 옆면이 서로 다퉈 얼룩진다 */
  part(new THREE.BoxGeometry(BW, BH - 0.002, BD), M({ color: 0xE8813A }), 0);
  part(new THREE.BoxGeometry(BW - 0.002, 0.0022, BD - 0.002), M({ map: faceTex }), BH / 2 - 0.001);

  g.userData.dispose = () => { for (const k of keep) k.dispose?.(); };
  return g;
}


/* 실제 제품 사진을 상표로 쓴다.
   ★ 손으로 그린 무늬는 "무슨 물건인지" 까지만 말한다. 시연에서 보는 사람이 아는 것은
     실제 포장이므로 코리안넷 제품 사진을 그대로 붙인다 (사용자 지적).
   ⚠️ 사진은 흰 배경 정면 컷이라 여백을 미리 잘라 두었다. 여백째 쓰면 상품이 면 가운데
      조그맣게만 들어가 무엇인지 안 보인다. */
function photo(THREE, file) {
  const tex = new THREE.TextureLoader().load(`/products/${file}`);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

/* 사진을 옆 네 면에 입힌 상자.
   ★ 처음에는 둥근 기둥을 만들고 그 앞에 얇은 상표판을 세웠는데, 판이 몸통 면을 덮지
     못해 화면에서는 색 덩어리로만 보였다 (사용자 지적). 상자의 각 면은 UV 가 0~1 로
     딱 떨어지므로, 재질을 면마다 따로 주면 사진이 면을 정확히 채운다.
   ⚠️ BoxGeometry 의 재질 순서는 [+x, -x, +y, -y, +z, -z] 다. 위·아래만 민색으로 두고
      옆 네 면에 사진을 준다 — 위에서 내려다보는 각도에서 사진이 눕지 않게. */
function photoBox(THREE, w, h, d, tex, topColor, keep) {
  const side = new THREE.MeshLambertMaterial({ map: tex });
  const cap = new THREE.MeshLambertMaterial({ color: topColor });
  const geo = new THREE.BoxGeometry(w, h, d);
  keep.push(side, cap, geo);
  return new THREE.Mesh(geo, [side, side, cap, cap, side, side]);
}

/* ── 스팸 1.81kg — 6개입 케이스 ──────────────────────────────────────────────
   단품: 101 x 101 x 198 mm 의 대형 사각 캔. 뚜껑은 단면 전체를 덮는 은박이다.
   케이스: 3 x 2 로 세워 담아 303 x 202 x 198 mm — 세 변 합 70.3cm → A 극소형 */
export function makeSpamCase(THREE) {
  const g = new THREE.Group();
  const keep = [];
  const M = (o) => { const m = new THREE.MeshLambertMaterial(o); keep.push(m); return m; };
  const G = (geo) => { keep.push(geo); return geo; };

  const CASE_H = 0.198, TRAY_H = 0.006;
  const CAN_W = 0.101, CAN_H = CASE_H - TRAY_H;
  const BODY = CAN_W * 0.95;
  const yBottom = -CASE_H / 2;
  const tex = photo(THREE, "spam-1810g.jpg");

  const tray = new THREE.Mesh(G(new THREE.BoxGeometry(0.303, TRAY_H, 0.202)), M({ color: 0xc59a63 }));
  tray.position.y = yBottom + TRAY_H / 2;
  g.add(tray);

  for (let i = 0; i < 6; i += 1) {
    const x = ((i % 3) - 1) * CAN_W;
    const z = (Math.floor(i / 3) - 0.5) * CAN_W;
    const can = photoBox(THREE, BODY, CAN_H, BODY, tex, 0xc9ccd1, keep);
    can.position.set(x, yBottom + TRAY_H + CAN_H / 2, z);
    g.add(can);
  }
  g.userData.dispose = keep;
  return g;
}

/* ── 비비고 사골곰탕 500g — 10개입 케이스 ────────────────────────────────────
   단품: 58 x 156 x 218 mm 의 스탠딩 파우치. 납작해서 앞뒤 면이 넓다.
   케이스: 2열 5줄로 세워 담아 312 x 290 x 218 mm — 세 변 합 82.0cm → B 소형 */
export function makeGomtangCase(THREE) {
  const g = new THREE.Group();
  const keep = [];
  const M = (o) => { const m = new THREE.MeshLambertMaterial(o); keep.push(m); return m; };
  const G = (geo) => { keep.push(geo); return geo; };

  const CASE_H = 0.218, TRAY_H = 0.006;
  const P_W = 0.058, P_L = 0.156, P_H = CASE_H - TRAY_H;
  const yBottom = -CASE_H / 2;
  const tex = photo(THREE, "gomtang-500g.jpg");

  const tray = new THREE.Mesh(G(new THREE.BoxGeometry(0.312, TRAY_H, 0.290)), M({ color: 0xc59a63 }));
  tray.position.y = yBottom + TRAY_H / 2;
  g.add(tray);

  /* 파우치는 앞뒤가 넓고 옆이 얇다. 사진은 넓은 앞뒤(±z)에 오도록 상자를 세운다 */
  const side = new THREE.MeshLambertMaterial({ map: tex });
  const edge = new THREE.MeshLambertMaterial({ color: 0xEDE6D8 });
  const geo = new THREE.BoxGeometry(P_L * 0.96, P_H, P_W * 0.9);
  keep.push(side, edge, geo);
  for (let i = 0; i < 10; i += 1) {
    const x = ((i % 2) - 0.5) * P_L;
    const z = (Math.floor(i / 2) - 2) * P_W;
    const m = new THREE.Mesh(geo, [edge, edge, edge, edge, side, side]);
    m.position.set(x, yBottom + TRAY_H + P_H / 2, z);
    g.add(m);
  }
  g.userData.dispose = keep;
  return g;
}

/* ── 백설 고추장삼겹살구이양념 2450G — 12개입 케이스 ──────────────────────────
   단품: 114 x 114 x 281 mm 의 대용량 통. 몸통 위에 넓은 검정 뚜껑이 앉는다.
   케이스: 4 x 3 으로 세워 담아 456 x 342 x 281 mm — 세 변 합 107.9cm → C 중형 */
export function makeSauceCase(THREE) {
  const g = new THREE.Group();
  const keep = [];
  const M = (o) => { const m = new THREE.MeshLambertMaterial(o); keep.push(m); return m; };
  const G = (geo) => { keep.push(geo); return geo; };

  const CASE_H = 0.281, TRAY_H = 0.008;
  const J_W = 0.114, J_H = CASE_H - TRAY_H;
  const BODY = J_W * 0.94, BODY_H = J_H * 0.88, CAP_H = J_H * 0.10;
  const yBottom = -CASE_H / 2;
  const tex = photo(THREE, "sauce-2450g.jpg");

  const tray = new THREE.Mesh(G(new THREE.BoxGeometry(0.456, TRAY_H, 0.342)), M({ color: 0xc59a63 }));
  tray.position.y = yBottom + TRAY_H / 2;
  g.add(tray);

  const capMat = M({ color: 0x2A2320 });
  const capGeo = G(new THREE.CylinderGeometry(BODY * 0.34, BODY * 0.34, CAP_H, 16));
  for (let i = 0; i < 12; i += 1) {
    const x = ((i % 4) - 1.5) * J_W;
    const z = (Math.floor(i / 4) - 1) * J_W;
    const foot = yBottom + TRAY_H;
    const jar = photoBox(THREE, BODY, BODY_H, BODY, tex, 0x6B2118, keep);
    jar.position.set(x, foot + BODY_H / 2, z);
    g.add(jar);
    const cap = new THREE.Mesh(capGeo, capMat);
    cap.position.set(x, foot + BODY_H + CAP_H / 2, z);
    g.add(cap);
  }
  g.userData.dispose = keep;
  return g;
}

/** 이름 → 만드는 함수. `DEMO_ITEMS` 의 `model` 이 이 열쇠를 가리킨다 */
export const PRODUCT_MODELS = {
  spam: makeSpamCase,
  gomtang: makeGomtangCase,
  sauce: makeSauceCase,
  /* 지난 시연 상품. DEMO_ITEMS 가 더는 안 부르지만, 상품이 다시 바뀔 때 참고로 남긴다 */
  kaguri: makeKaguriCase,
  otte: makeOtteCase,
  terra: makeTerraCase,
};
