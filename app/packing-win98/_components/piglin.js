/* ═══════════════════════════════════════════════════════════════════════════
   좀비화 피글린 — 포장이 끝난 상자를 밀고 나가는 역할.

   ★ 창고 화면(`/warehouse-win98`)의 작업자와 **같은 인물**이다. 이 저장소는 win98 화면마다
     `_components` 를 따로 갖는 것이 규칙이라 여기에 한 벌 더 둔다. 창고 쪽 생김새를 바꾸면
     여기도 같이 바꿔야 한다 — 두 화면에서 다른 사람이 일하고 있으면 안 된다.

   ⚠️ `THREE` 를 **인자로 받는다.** 이 화면은 three.js 를 동적으로 불러오므로(번들에 넣지
      않기 위해) 모듈 최상단에서 import 할 수 없다.
   ⚠️ 팔다리는 관절 자리에 그룹을 두고 그 안에 메시를 내려 단다. 메시를 직접 돌리면 가운데를
      축으로 돌아 다리가 몸을 뚫는다 — 축은 어깨와 골반에 있어야 한다.
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * @param {object} THREE
 * @param {number} height 원하는 키 (씬 단위). 상자가 1 남짓으로 정규화돼 있으므로
 *   실제 사람 비율(상자의 4배)로 두면 화면을 다 먹는다 — 부르는 쪽이 정한다.
 * @returns {{ grp, lLeg, rLeg, lArm, rArm, dispose: () => void }}
 */
export function createPiglin(THREE, height = 1.25) {
  const grp = new THREE.Group();
  const kept = [];
  const M = (color) => {
    const m = new THREE.MeshLambertMaterial({ color });
    kept.push(m);
    return m;
  };
  const skin = M(0xea9393);
  const snoutM = M(0xd57e7e);
  const rot = M(0x5e8b45);
  const bone = M(0xd9d9d2);
  const tunic = M(0x7a5a38);
  const belt = M(0x4a3722);
  const dark = M(0x22262b);

  const P = 0.0625; // 마인크래프트 1픽셀
  const mk = (geo, mat, x, y, z, parent = grp) => {
    kept.push(geo);
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  };

  /* 다리 — 관절은 골반(y = 12px) */
  const legGeo = new THREE.BoxGeometry(4 * P, 12 * P, 4 * P);
  const lLeg = new THREE.Group(); lLeg.position.set(-2 * P, 12 * P, 0); grp.add(lLeg);
  mk(legGeo, tunic, 0, -6 * P, 0, lLeg);
  const rLeg = new THREE.Group(); rLeg.position.set(2 * P, 12 * P, 0); grp.add(rLeg);
  mk(legGeo, tunic, 0, -6 * P, 0, rLeg);
  mk(new THREE.BoxGeometry(4.2 * P, 3 * P, 4.2 * P), rot, 0, -9 * P, 0, rLeg);

  /* 몸통 — 살 위에 갈색 튜닉 */
  mk(new THREE.BoxGeometry(8 * P, 12 * P, 4 * P), skin, 0, 18 * P, 0);
  mk(new THREE.BoxGeometry(8.3 * P, 8 * P, 4.3 * P), tunic, 0, 16 * P, 0);
  mk(new THREE.BoxGeometry(8.5 * P, 1.6 * P, 4.5 * P), belt, 0, 12.6 * P, 0);
  mk(new THREE.BoxGeometry(3 * P, 3 * P, 4.4 * P), rot, -1.5 * P, 22 * P, 0);

  /* 팔 — 상자를 미는 자세라 앞으로 뻗는다. 각도는 부르는 쪽이 다시 잡는다 */
  const armGeo = new THREE.BoxGeometry(4 * P, 12 * P, 4 * P);
  const lArm = new THREE.Group(); lArm.position.set(-6 * P, 23 * P, 0); grp.add(lArm);
  mk(armGeo, skin, 0, -6 * P, 0, lArm);
  mk(new THREE.BoxGeometry(4.2 * P, 3.5 * P, 4.2 * P), rot, 0, -3 * P, 0, lArm);
  const rArm = new THREE.Group(); rArm.position.set(6 * P, 23 * P, 0); grp.add(rArm);
  mk(armGeo, skin, 0, -6 * P, 0, rArm);
  mk(new THREE.BoxGeometry(4.2 * P, 4 * P, 4.2 * P), bone, 0, -9 * P, 0, rArm);

  /* 머리 */
  const head = new THREE.Group(); head.position.set(0, 24 * P, 0); grp.add(head);
  mk(new THREE.BoxGeometry(8 * P, 8 * P, 8 * P), skin, 0, 4 * P, 0, head);
  mk(new THREE.BoxGeometry(4.2 * P, 5 * P, 8.2 * P), bone, -2 * P, 5 * P, 0, head);
  mk(new THREE.BoxGeometry(5 * P, 3 * P, 1.5 * P), snoutM, 0, 3 * P, 4.5 * P, head);
  mk(new THREE.BoxGeometry(1 * P, 1 * P, 0.6 * P), dark, -1.2 * P, 3.4 * P, 5.3 * P, head);
  mk(new THREE.BoxGeometry(1 * P, 1 * P, 0.6 * P), dark, 1.2 * P, 3.4 * P, 5.3 * P, head);
  mk(new THREE.BoxGeometry(1.6 * P, 1 * P, 0.6 * P), dark, -2 * P, 5.4 * P, 4.1 * P, head);
  mk(new THREE.BoxGeometry(1.6 * P, 1 * P, 0.6 * P), dark, 2 * P, 5.4 * P, 4.1 * P, head);
  for (const s of [-1, 1]) {
    const ear = mk(new THREE.BoxGeometry(1.5 * P, 5 * P, 3 * P), skin, s * 4.6 * P, 4 * P, 0, head);
    ear.rotation.z = s * 0.32;
  }

  /* 마인크래프트 비율의 키는 32px = 2.0 이다. 원하는 키에 맞춰 줄인다 */
  grp.scale.setScalar(height / 2.0);

  return {
    grp,
    lLeg,
    rLeg,
    lArm,
    rArm,
    dispose() {
      for (const k of kept) k?.dispose?.();
    },
  };
}
