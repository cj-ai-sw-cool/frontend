/* ═══════════════════════════════════════════════════════════════════════════
   출고 포장 작업대
   `createPackingStation(THREE, { position, rotationY })` 하나만 내보낸다.

   무엇인가
     랙에서 꺼낸 물건이 도크로 나가기 전에 거치는 자리다. 컨베이어에 실려 온 상자를
     작업대에서 포장하고, 옆에 선 포스기 화면에서 배송단위와 추천 박스를 확인한다.

   ★ 검수실의 모니터와 **같은 규칙**으로 만들었다 — 화면에 우리 프론트의 실제 화면
     (`/packing`)을 축소해 그리고, 누르면 그 라우트로 넘어간다. 3D 안의 장비가
     이 시스템과 무관한 화면을 띄우고 있으면 "어딘가의 기계"로 끝나지만, 우리 화면이
     떠 있으면 창고와 대시보드가 한 시스템으로 읽힌다.

   ⚠️ 화면은 **그림**이지 실제 화면이 아니다. `/packing` 의 레이아웃을 크게 고치면
      여기 `drawScreen` 도 같이 손봐야 한다 — 자동으로 안 따라온다.
   ⚠️ 이 작업대는 출고 구역 안에 선다. 그 구역에는 AGV 순환 경로가 지나가므로
      (`x = rowWidths/2 + 2.4` 와 `+3.3`), 놓는 쪽에서 z 를 겹치지 않게 잡아야 한다.
      여기서는 크기만 정하고 자리는 부르는 쪽이 정한다.
   ═══════════════════════════════════════════════════════════════════════════ */

const W98 = {
  face: "#C0C0C0", light: "#FFFFFF", shadow: "#808080", dark: "#000000",
  title: "#000080", titleTxt: "#FFFFFF",
};
const KO = "'Malgun Gothic', '맑은 고딕', sans-serif";
const MONO = "'Consolas', 'Courier New', monospace";

function bevelOut(c, x, y, w, h, face) {
  c.fillStyle = face || W98.face; c.fillRect(x, y, w, h);
  c.fillStyle = W98.light; c.fillRect(x, y, w, 2); c.fillRect(x, y, 2, h);
  c.fillStyle = W98.dark; c.fillRect(x, y + h - 2, w, 2); c.fillRect(x + w - 2, y, 2, h);
  c.fillStyle = W98.shadow; c.fillRect(x + 2, y + h - 4, w - 4, 2); c.fillRect(x + w - 4, y + 2, 2, h - 4);
}

function bevelIn(c, x, y, w, h, fill) {
  if (fill) { c.fillStyle = fill; c.fillRect(x, y, w, h); }
  c.fillStyle = W98.shadow; c.fillRect(x, y, w, 2); c.fillRect(x, y, 2, h);
  c.fillStyle = W98.light; c.fillRect(x, y + h - 2, w, 2); c.fillRect(x + w - 2, y, 2, h);
}

/**
 * 포스기 화면 — `/packing` 을 그대로 옮겨 그린다.
 *
 * ★ 앞서는 "읽을 수 있는 것만" 남기고 배송단위·추천 박스만 그렸는데, 실제 화면과 다르니
 *   3D 안의 단말이 우리 시스템으로 안 읽혔다. 이제 **같은 배치**로 그린다 — 좌측 목차,
 *   상단 토트 스캔 줄, 좌 배송내역/품목, 우 박스 미리보기·제품 이미지·박스 추천,
 *   하단 재패킹·포장 완료.
 * ★ 실제 화면과 마찬가지로 **스캔 전에는 대부분 비어 있다.** 채워 넣으면 예쁘지만, 시연
 *   중에 "저 값은 어디서 왔냐"에 답할 수 없다. 빈 칸이 스스로 "토트를 스캔하면"이라고
 *   말하는 편이 정직하고, 원본과도 같다.
 *
 * ⚠️ 이건 **그림**이지 실제 화면이 아니다. `/packing` 의 레이아웃을 크게 고치면
 *    여기도 같이 손봐야 한다 — 자동으로 안 따라온다.
 * ⚠️ 캔버스 비율(960 x 560)은 화면 판의 비율과 **정확히** 같아야 한다. 어긋나면 옮겨 그린
 *    화면이 세로로 눌린다.
 */
function drawScreen(c, W, H, live) {
  c.textBaseline = "middle";
  c.fillStyle = W98.face;
  c.fillRect(0, 0, W, H);

  /* ── 제목줄 ── */
  c.fillStyle = W98.title;
  c.fillRect(0, 0, W, 24);
  c.font = "700 14px " + KO;
  c.textAlign = "left";
  c.fillStyle = W98.titleTxt;
  c.fillText("OUTBOUND PACKING — 출고 포장", 9, 13);
  c.font = "700 13px " + MONO;
  c.textAlign = "right";
  c.fillText(live.clock, W - 9, 13);

  /* ── 좌측 목차 ── */
  bevelOut(c, 4, 28, 84, H - 32);
  bevelOut(c, 8, 32, 76, 32);
  c.strokeStyle = "#1B3C6E"; c.lineWidth = 2.5;
  c.beginPath(); c.moveTo(16, 56); c.lineTo(24, 38); c.lineTo(32, 56); c.closePath(); c.stroke();
  c.font = "800 14px " + KO;
  c.textAlign = "left";
  c.fillStyle = "#12233B";
  c.fillText("A.LTS", 38, 48);

  ["Inbound", "Packing", "Warehouse", "Analytics"].forEach((n, i) => {
    const y = 72 + i * 42;
    /* 지금 화면은 Packing 이다. 눌린 모양으로 그려야 목차가 "여기 있다"를 말한다 */
    if (i === 1) bevelIn(c, 8, y, 76, 38, "#AFAFAF");
    else bevelOut(c, 8, y, 76, 38);
    /* 아이콘은 단순 도형으로 그린다. 캔버스에서 이모지는 설치된 글꼴에 따라 네모로
       나오거나 아예 안 나온다 — 화면 안의 화면에서 그런 사고는 눈에 띈다 */
    c.strokeStyle = "#22334A"; c.lineWidth = 2;
    const ix = 46, iy = y + 12;
    if (i === 0) {
      c.beginPath(); c.moveTo(ix, iy - 6); c.lineTo(ix, iy + 4);
      c.moveTo(ix - 4, iy); c.lineTo(ix, iy + 4); c.lineTo(ix + 4, iy); c.stroke();
    } else if (i === 1) {
      c.strokeRect(ix - 7, iy - 5, 14, 10);
      c.beginPath(); c.moveTo(ix, iy - 5); c.lineTo(ix, iy + 5); c.stroke();
    } else if (i === 2) {
      c.strokeRect(ix - 8, iy - 4, 16, 9);
      c.beginPath(); c.moveTo(ix - 8, iy - 4); c.lineTo(ix, iy - 9); c.lineTo(ix + 8, iy - 4); c.stroke();
    } else {
      c.beginPath();
      c.moveTo(ix - 6, iy + 4); c.lineTo(ix - 6, iy);
      c.moveTo(ix, iy + 4); c.lineTo(ix, iy - 5);
      c.moveTo(ix + 6, iy + 4); c.lineTo(ix + 6, iy - 2);
      c.stroke();
    }
    c.font = "700 12px " + KO;
    c.textAlign = "center";
    c.fillStyle = "#000000";
    c.fillText(n, 46, y + 28);
    c.textAlign = "left";
  });

  /* ── 상단: 토트 스캔 ── */
  const MX = 94, MW = W - MX - 6;
  w98Panel(c, MX, 28, MW, 54, "Tote Barcode — 토트 스캔");
  bevelIn(c, MX + 8, 48, 200, 26, "#FFFFFF");
  c.font = "700 13px " + MONO;
  c.fillStyle = "#8A8A8A";
  c.textAlign = "left";
  c.fillText("예 :  T-0012", MX + 15, 61);
  /* 커서 — 입력 대기 중이라는 유일한 신호다. 깜빡여야 "받을 준비가 됐다"로 읽힌다 */
  if (live.caret) { c.fillStyle = "#000000"; c.fillRect(MX + 15, 53, 2, 16); }

  bevelOut(c, MX + 214, 48, 56, 26);
  c.font = "700 12px " + KO;
  c.fillStyle = "#707070";
  c.textAlign = "center";
  c.fillText("Scan", MX + 242, 61);

  c.textAlign = "left";
  c.font = "700 11px " + KO;
  c.fillStyle = "#000000";
  c.fillText("TEST:", MX + 282, 61);
  bevelIn(c, MX + 320, 48, 172, 26, "#FFFFFF");
  c.font = "700 11px " + KO;
  c.fillStyle = "#22334A";
  c.fillText("T-0012 · 정상 · 라인A 3품목", MX + 326, 61);
  bevelOut(c, MX + 496, 48, 44, 26);
  c.textAlign = "center";
  c.fillStyle = "#000000";
  c.fillText("Load", MX + 518, 61);

  c.textAlign = "left";
  c.font = "400 11px " + KO;
  c.fillStyle = "#3A3A3A";
  c.fillText("스캐너로 읽거나 직접 입력한 뒤 Enter 를 누르세요.", MX + 552, 61);

  /* ── 왼쪽 열: 배송 내역 + 품목 ── */
  const LW = 424;
  w98Panel(c, MX, 88, LW, 206, "Line Shipments — 라인별 배송 내역");
  emptyNote(c, MX + 8, 108, LW - 16, 178, "라인 선택 · 상태별 배송단위 리스트 (3-1)");

  w98Panel(c, MX, 300, LW, H - 300 - 6, "Items — 품목");

  /* ── 오른쪽 열 ── */
  const RX = MX + LW + 8, RW = W - RX - 6;
  w98Panel(c, RX, 88, RW, 238, "Box Preview — 박스 미리보기", ["마크(실사)", "실사", "실사2"]);
  bevelIn(c, RX + 8, 108, RW - 16, 210, "#FFFFFF");
  c.textAlign = "center";
  c.font = "700 15px " + MONO;
  c.fillStyle = "#3A4552";
  c.fillText("LOAD  대기 중", RX + RW / 2, 196);
  /* 마퀴 막대 — win98 이 "진행률을 모를 때" 쓰던 표현이라 대기 상태와 맞는다 */
  const mx0 = RX + 26, mw = RW - 52;
  bevelIn(c, mx0, 210, mw, 16, "#C0C0C0");
  for (let i = 0; i < 5; i++) {
    const bx = mx0 + 4 + ((live.marquee + i) % 12) * ((mw - 8) / 12);
    c.fillStyle = "#000080";
    c.fillRect(bx, 213, (mw - 8) / 12 - 2, 10);
  }

  const PY = 332, PH = H - PY - 52;
  const PIW = 150;
  w98Panel(c, RX, PY, PIW, PH, "Product Image — 제품 이미지");
  bevelIn(c, RX + 8, PY + 20, PIW - 16, PH - 28, "#FFFFFF");

  const BRX = RX + PIW + 8, BRW = RW - PIW - 8;
  w98Panel(c, BRX, PY, BRW, PH, "Box Recommendation — 박스 추천");
  c.textAlign = "left";
  c.font = "700 11px " + KO;
  c.fillStyle = "#000000";
  c.fillText("박스 변경:", BRX + 10, PY + PH - 18);
  bevelIn(c, BRX + 66, PY + PH - 29, BRW - 76, 22, "#FFFFFF");
  c.fillStyle = "#8A8A8A";
  c.fillText("박스를 선택하세요", BRX + 72, PY + PH - 18);

  /* ── 하단 버튼 둘 ──
     ⚠️ 실제로 눌리는 버튼이 아니다. 3D 안의 그림이라 손이 닿지 않는데 가만히 있으면
        화면이 정지 이미지처럼 보인다. `포장 완료` 만 이따금 눌린 모양으로 바꿔 준다. */
  const BY = H - 48, BH = 42;
  bevelOut(c, RX, BY, PIW, BH);
  c.textAlign = "center";
  c.font = "700 15px " + KO;
  c.fillStyle = "#909090";
  c.fillText("재패킹", RX + PIW / 2, BY + BH / 2);

  if (live.pressed) bevelIn(c, BRX, BY, BRW, BH, "#B4B4B4");
  else bevelOut(c, BRX, BY, BRW, BH);
  c.font = "800 18px " + KO;
  c.fillStyle = "#3A3A3A";
  c.fillText("포장 완료", BRX + BRW / 2 + (live.pressed ? 1 : 0), BY + BH / 2 + (live.pressed ? 1 : 0));

  /* ── 이 화면을 누르면 무슨 일이 일어나는지 ──
     3D 안의 물건은 CSS 의 `:hover` 도 툴팁도 없어서, 안내할 자리가 화면 자신뿐이다.
     확대 전과 후에 하는 일이 다르므로 글자도 달라야 한다.
     ⚠️ 원본에 없는 줄이다. 그래서 화면 안이 아니라 **제목줄 바로 아래 왼쪽**, 목차 위에
        겹치지 않는 빈 자리에 얹는다. */
  if (live.hovered || live.focused) {
    const txt = live.focused ? "클릭 → 출고 화면 열기" : "클릭 → 확대";
    c.font = "700 12px " + KO;
    const tw = c.measureText(txt).width + 18;
    c.fillStyle = "#000080";
    c.fillRect(W - tw - 8, 28, tw, 22);
    c.fillStyle = "#FFFFFF";
    c.textAlign = "center";
    c.fillText(txt, W - tw / 2 - 8, 39);
  }
}

/** 제목 줄이 달린 패널 — 회색 바탕에 검은 제목, 오른쪽에 작은 탭 몇 개 */
function w98Panel(c, x, y, w, h, title, tabs) {
  bevelOut(c, x, y, w, h);
  c.font = "700 11px " + KO;
  c.textAlign = "left";
  c.textBaseline = "middle";
  c.fillStyle = "#000000";
  c.fillText(title, x + 8, y + 11);
  if (tabs) {
    let tx = x + w - 6;
    for (let i = tabs.length - 1; i >= 0; i--) {
      const tw = c.measureText(tabs[i]).width + 12;
      tx -= tw;
      if (i === tabs.length - 1) bevelIn(c, tx, y + 3, tw, 16, "#AFAFAF");
      else bevelOut(c, tx, y + 3, tw, 16);
      c.fillStyle = "#000000";
      c.textAlign = "center";
      c.fillText(tabs[i], tx + tw / 2, y + 11);
      c.textAlign = "left";
      tx -= 3;
    }
  }
}

/** 아직 값이 없는 칸 — 흰 바탕에 안내 한 줄 */
function emptyNote(c, x, y, w, h, text) {
  bevelIn(c, x, y, w, h, "#FFFFFF");
  c.font = "700 11px " + KO;
  c.textAlign = "center";
  c.fillStyle = "#22334A";
  c.fillText(text, x + w / 2, y + h / 2);
  c.textAlign = "left";
}

/**
 * @param {object} THREE
 * @param {{ position: [number, number, number], rotationY?: number, line?: number, packed?: number, seed?: number }} opts
 * @returns {{ group, pickTargets: object[], update: (dt: number, hovered: boolean) => void, dispose: () => void }}
 */
/**
 * @param {{makePiglin?: () => object}} opt.makePiglin 작업대에 세울 사람. **창고 안 작업자와
 *   같은 함수**를 넘겨야 한다 — 여기서 따로 만들면 같은 창고에서 다른 사람이 일한다.
 *   없으면 사람 없이 설비만 놓는다.
 */
export function createPackingStation(THREE, { position, rotationY = 0, line = 3, packed = 128, seed = 0, makePiglin }) {
  const group = new THREE.Group();
  group.position.set(position[0], position[1], position[2]);
  group.rotation.y = rotationY;

  const dispose = [];
  const steel = new THREE.MeshLambertMaterial({ color: 0x8b96a4 });
  const frame = new THREE.MeshLambertMaterial({ color: 0x39414d });
  const dark = new THREE.MeshLambertMaterial({ color: 0x1b1f25 });
  const carton = new THREE.MeshLambertMaterial({ color: 0xc59a63 });
  dispose.push(steel, frame, dark, carton);

  /* ── 컨베이어 (그룹의 z 축을 따라 흐른다) ── */
  const LEN = 2.8, WID = 0.72, TOP = 0.62;
  const sideGeo = new THREE.BoxGeometry(0.05, 0.13, LEN);
  for (const sx of [-1, 1]) {
    const m = new THREE.Mesh(sideGeo, frame);
    m.position.set(sx * (WID / 2), TOP, 0);
    group.add(m);
  }
  const legGeo = new THREE.BoxGeometry(0.07, TOP, 0.07);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const l = new THREE.Mesh(legGeo, frame);
    l.position.set(sx * (WID / 2 - 0.03), TOP / 2, sz * (LEN / 2 - 0.2));
    group.add(l);
  }
  dispose.push(sideGeo, legGeo);

  /* 롤러 — 하나의 지오메트리를 여러 메시가 나눠 쓴다. 매 프레임 돌려서 벨트가 사는 티를 낸다 */
  /* ⚠️ 회전축을 **지오메트리에 구워 넣는다.** 메시의 `rotation` 으로 눕혀 놓고 다른 축을
     더하면 원통이 제자리에서 도는 게 아니라 통째로 휘청인다 — 오일러 각은 XYZ 순서로
     곱해지므로, 눕히는 회전이 바깥에 남아 있으면 더해지는 회전이 원통의 축이 아니라
     월드 축을 기준으로 걸리기 때문이다. 실제로 벨트가 이상하게 돌아 보였던 이유다.
     구워 넣으면 메시의 회전이 비어 있어서, 더하는 축이 곧 원통의 축이 된다. */
  const rollGeo = new THREE.CylinderGeometry(0.055, 0.055, WID - 0.06, 12);
  rollGeo.rotateZ(Math.PI / 2);        // 축을 +y 에서 +x 로 (벨트는 z 로 흐른다)
  const rollers = [];
  for (let i = 0; i < Math.floor(LEN / 0.17); i++) {
    const r = new THREE.Mesh(rollGeo, steel);
    r.position.set(0, TOP + 0.02, -LEN / 2 + 0.1 + i * 0.17);
    group.add(r);
    rollers.push(r);
  }
  dispose.push(rollGeo);

  /* 벨트 위 상자 몇 개 — 크기를 조금씩 달리해야 "여러 건"으로 보인다 */
  for (const [w, h, d, z] of [[0.42, 0.3, 0.34, -0.95], [0.34, 0.26, 0.3, -0.2], [0.5, 0.34, 0.38, 0.75]]) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), carton);
    b.position.set((seed % 2 ? -1 : 1) * 0.03, TOP + 0.02 + h / 2, z);
    b.rotation.y = ((z + seed) % 1) * 0.18;
    group.add(b);
    dispose.push(b.geometry);
  }

  /* ── 포장 작업대 — 컨베이어 끝(+z)에 붙는다 ── */
  const BENCH_H = 0.78;
  const benchTop = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.06, 0.78), steel);
  benchTop.position.set(0, BENCH_H, LEN / 2 + 0.42);
  group.add(benchTop);
  const benchLegGeo = new THREE.BoxGeometry(0.07, BENCH_H, 0.07);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const l = new THREE.Mesh(benchLegGeo, frame);
    l.position.set(sx * 0.5, BENCH_H / 2, LEN / 2 + 0.42 + sz * 0.32);
    group.add(l);
  }
  dispose.push(benchTop.geometry, benchLegGeo);

  // 작업대 위 소품 — 저울, 테이프 디스펜서, 라벨 프린터
  const scale = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.05, 0.26), dark);
  scale.position.set(-0.36, BENCH_H + 0.055, LEN / 2 + 0.42);
  group.add(scale);
  const tape = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.028, 8, 18), new THREE.MeshLambertMaterial({ color: 0x3f8fd8 }));
  tape.position.set(0.1, BENCH_H + 0.08, LEN / 2 + 0.3);
  group.add(tape);
  const printer = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.16, 0.22), dark);
  printer.position.set(0.42, BENCH_H + 0.11, LEN / 2 + 0.5);
  group.add(printer);
  dispose.push(scale.geometry, tape.geometry, tape.material, printer.geometry);

  /* ── 포스기 ──────────────────────────────────────────────────────────
     작업대 왼쪽에 기둥을 세우고 화면을 매단다.
     ⚠️ 화면은 `MeshBasicMaterial` 이어야 한다. Lambert 로 두면 창고 조명에 따라 어두워지는데,
        포스기 화면은 스스로 빛나는 물건이다. */
  /* ★ 62 x 42cm 에서 **86 x 50cm** 로 키웠다. 화면에 대시보드 한 판을 통째로 옮겨 그리는데,
     작은 판에 그리면 확대해도 글자가 몇 픽셀이라 못 읽는다. 34인치급 모니터는 실제 포장
     작업대에도 흔하다.
     ⚠️ 캔버스 비율(960 x 560 = 1.714)과 **같아야** 한다. 어긋나면 화면이 눌려 보인다. */
  const SCR_W = 0.86, SCR_H = 0.502;
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 1.12, 12), frame);
  post.position.set(-0.72, 0.56, LEN / 2 + 0.42);
  group.add(post);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.2, 0.04, 16), frame);
  base.position.set(-0.72, 0.02, LEN / 2 + 0.42);
  group.add(base);
  dispose.push(post.geometry, base.geometry);

  const cv = document.createElement("canvas");
  cv.width = 960; cv.height = 560;
  const ctx = cv.getContext("2d");
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  const screenMat = new THREE.MeshBasicMaterial({ map: tex });
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(SCR_W, SCR_H), screenMat);
  dispose.push(screen.geometry, screenMat, tex);

  /* 화면·테두리·안내를 한 그룹에 담아 통째로 기울인다 — 부품마다 각도를 맞추면
     하나만 어긋나도 티가 난다 */
  const head = new THREE.Group();
  head.position.set(-0.72, 1.24, LEN / 2 + 0.42);
  head.rotation.x = -0.22;             // 서 있는 사람이 내려다보는 각도
  group.add(head);

  const shell = new THREE.Mesh(new THREE.BoxGeometry(SCR_W + 0.06, SCR_H + 0.06, 0.05), dark);
  head.add(shell);
  screen.position.z = 0.027;           // 케이스 앞면(0.025)보다 앞
  screen.userData.pos = true;          // 클릭 판정에 쓴다
  head.add(screen);
  dispose.push(shell.geometry);

  /* 마우스를 올렸을 때 켜지는 테두리. 3D 안에는 CSS 의 `:hover` 가 없으니
     누를 수 있다는 걸 이렇게 알린다 — 꺼져 있을 때도 아주 흐리게는 보여야 한다 */
  const glowGeo = new THREE.EdgesGeometry(new THREE.PlaneGeometry(SCR_W + 0.04, SCR_H + 0.04));
  const glow = new THREE.LineSegments(glowGeo, new THREE.LineBasicMaterial({
    color: 0x4cc9ff, transparent: true, opacity: 0.28,
  }));
  glow.position.z = 0.03;
  head.add(glow);
  dispose.push(glowGeo, glow.material);

  /* 클릭 판정용 판 — 화면보다 넉넉하게. 작은 화면을 정확히 겨누게 하면 자꾸 빗나간다 */
  const hit = new THREE.Mesh(
    new THREE.PlaneGeometry(SCR_W + 0.18, SCR_H + 0.18),
    new THREE.MeshBasicMaterial({ visible: false }),
  );
  hit.position.z = 0.031;
  hit.userData.pos = true;
  head.add(hit);
  dispose.push(hit.geometry, hit.material);

  /* 화면이 앞으로 흘리는 빛 — 이게 있어야 켜져 있는 것으로 보인다 */
  const spill = new THREE.PointLight(0x6fb6ff, 0.85, 2.4, 2);
  spill.position.set(-0.72, 1.24, LEN / 2 + 0.66);
  group.add(spill);

  const live = {
    clock: "--:--:--",
    pressed: false,
    hovered: false,
    focused: false,
    caret: true,
    marquee: 0,
    line,
    packed,
  };
  /* ── 작업자 ──
     ★ 설비만 있고 사람이 없으면 "전시된 장비"로 보인다 (사용자 요청). 벨트 옆에 서서
       손을 놀리고 있으면 그때부터 이 자리가 **일하는 자리**가 된다.
     ⚠️ 벨트 **옆**에 세운다. 벨트 위나 끝에 세우면 흘러오는 상자를 몸으로 막는다.
     ⚠️ 팔은 두 팔의 위상을 어긋나게 흔든다. 똑같이 흔들면 손뼉 치는 것처럼 보인다. */
  const worker = typeof makePiglin === "function" ? makePiglin() : null;
  if (worker) {
    worker.grp.position.set(WID / 2 + 0.52, 0, LEN / 2 - 0.15);
    worker.grp.rotation.y = -Math.PI / 2;   // 벨트 쪽(-x)을 보고 선다
    group.add(worker.grp);
  }

  let elapsed = 0, lastDraw = -1;
  drawScreen(ctx, cv.width, cv.height, live);
  tex.needsUpdate = true;

  return {
    group,
    pickTargets: [hit, screen],
    /* 화면이 매달린 그룹. 부르는 쪽이 여기서 월드 좌표와 정면 방향을 뽑아
       카메라를 그 앞에 세운다 — 작업대가 어디에 어떤 각도로 놓였는지 몰라도 된다 */
    screenAnchor: head,
    update(dt, hovered, focused = false) {
      elapsed += dt;
      for (const r of rollers) r.rotation.x += dt * 5.2;   // 축이 x 로 구워져 있다

      if (worker) {
        /* 상자를 집어 테이프를 붙이는 손놀림. 팔만 움직이고 발은 붙어 있다 —
           포장 작업은 제자리에서 하는 일이라 걷게 하면 오히려 딴짓으로 보인다. */
        const w = elapsed * 3.1;
        worker.lArm.rotation.x = worker.armRest - 0.75 + 0.5 * Math.sin(w);
        worker.rArm.rotation.x = worker.armRest - 0.75 + 0.5 * Math.sin(w + 1.9);
        worker.grp.position.y = 0.022 * Math.abs(Math.sin(w));
        // 이따금 포스기 쪽으로 몸을 튼다 — 계속 같은 각이면 마네킹으로 보인다
        worker.grp.rotation.y = -Math.PI / 2 + 0.30 * Math.sin(elapsed * 0.42);
      }

      const want = hovered ? 0.85 + 0.15 * Math.sin(elapsed * 5) : 0.28;
      glow.material.opacity += (want - glow.material.opacity) * 0.18;

      /* ⚠️ 화면은 초당 4번만 다시 그린다. 620x420 캔버스를 매 프레임 GPU 로 올리면
         작업대 두 대만으로도 창고 전체를 그리는 비용을 넘긴다. */
      /* 안내 글자는 바뀌는 즉시 보여야 한다. 다음 정기 갱신(최대 0.25초)을 기다리면
         마우스를 올렸는데 글자가 늦게 뜬다 */
      const stale = hovered !== live.hovered || focused !== live.focused;
      live.hovered = hovered;
      live.focused = focused;
      if (!stale && elapsed - lastDraw < 0.25) return;
      lastDraw = elapsed;
      const d = new Date();
      const p2 = (n) => String(n).padStart(2, "0");
      live.clock = `${p2(d.getHours())}:${p2(d.getMinutes())}:${p2(d.getSeconds())}`;
      live.pressed = Math.floor(elapsed / 1.4) % 4 === 0;
      live.caret = Math.floor(elapsed * 1.6) % 2 === 0;
      live.marquee = Math.floor(elapsed * 6) % 12;
      drawScreen(ctx, cv.width, cv.height, live);
      tex.needsUpdate = true;
    },
    dispose() {
      for (const d of dispose) d?.dispose?.();
    },
  };
}
