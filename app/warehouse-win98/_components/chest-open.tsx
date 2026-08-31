"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";

/* ═══════════════════════════════════════════════════════════════════════════
   3D 마인크래프트 상자가 열린다 — 좀비가 들고 있던 상자를 누르면 이것이 뜬다.

   ★ 예전 이스터에그에 있던 상자를 되살렸다 (사용자 요청). 그때는 모델이 10.4MB 라 다 받기
     전에 연출이 끝나 아무 일도 없어 보였는데, 알고 보니 **dev 서버가 뻗어 있어서** 파일
     하나에 5초를 쓰고 있었다. 서버를 되살리니 같은 파일이 0.04초에 온다 — 모델 탓이
     아니었다.
   ⚠️ 그래도 처음 받는 사람에게는 시간이 든다. 그래서 바탕화면 쪽에서 **마우스를 올리는
      순간 미리 받아 둔다**(`truck-dock` 의 `warm`). 누르기 직전이라 시간을 벌면서도,
      안 누를 사람은 받지 않는다.
   ★ 뚜껑이 열리면 **돼지가 튀어나온다**(`pigs`). 그 연출은 이 뷰어가 이미 갖고 있어서,
     한 줄이면 켜진다 — 예전 이스터에그가 하던 그것이다 (사용자 요청).
   ⚠️ 켜져 있는 동안만 붙여 둔다. 그래야 누를 때마다 **뚜껑이 닫힌 상태에서** 새로
      시작한다 — 붙였다 떼는 것 자체가 초기화라, 되돌리는 코드가 아예 없어진다.
   ⚠️ `ssr:false` — three.js 가 `window` 와 WebGL 을 전제한다. 서버에서 그리려 하면 그
      자리에서 터진다.
   ═══════════════════════════════════════════════════════════════════════════ */

const Box3DViewer = dynamic(
  () => import("@/app/packing-win98/_components/box-3d-viewer").then((m) => m.Box3DViewer),
  { ssr: false, loading: () => null },
);

/** 장면이 준비된 뒤 뚜껑을 열기까지(ms) — 상자가 뜬 걸 눈이 알아볼 짧은 사이 */
const OPEN_AFTER = 380;
/** 준비 신호가 끝내 안 와도 이만큼 뒤에는 연다(ms). 없으면 영영 안 열린 채 멈춘다 */
const OPEN_LATEST = 4000;

export function ChestOpen({ onOpened }: { onOpened: () => void }) {
  const [lidOpen, setLidOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const markReady = useCallback(() => setReady(true), []);

  /* ★ **장면이 준비된 뒤에** 연다 (사용자 지적 — 돼지가 안 보이고 바로 넘어간다).
       예전에는 상자를 띄우자마자 380ms 뒤에 무조건 열고 `onOpened()` 를 불렀다. 그런데
       바깥은 그 신호를 받은 순간부터 "돼지 보여 줄 시간" 을 센다. 모델(10.4MB)이 늦게
       뜬 날에는 아직 상자도 없는데 카운트다운이 시작돼, 돼지가 튀어나올 즈음엔 이미
       넘어갈 시간이었다. 이제 준비 → 열기 → 세기 순서라 항상 온전히 보인다.
     ⚠️ 그래도 늦어질 수는 있으니 상한을 둔다. 모델이 끝내 안 오면 이스터에그가 화면에
        붙박여 버린다 — 그럴 바엔 상자 없이라도 넘어가는 편이 낫다. */
  useEffect(() => {
    const late = window.setTimeout(() => setReady(true), OPEN_LATEST);
    return () => window.clearTimeout(late);
  }, []);

  useEffect(() => {
    if (!ready) return undefined;
    const t = window.setTimeout(() => {
      setLidOpen(true);
      onOpened();
    }, OPEN_AFTER);
    return () => window.clearTimeout(t);
  }, [ready, onOpened]);

  return (
    <div
      aria-hidden
      style={{
        position: "fixed", inset: 0, zIndex: 9997,
        display: "flex", alignItems: "center", justifyContent: "center",
        pointerEvents: "none",
      }}
    >
      {/* ★ 상자를 **아래로 내리고 그릴 자리를 넓혔다** (사용자 요청 — 돼지가 잘 안 보인다).
             돼지는 상자에서 솟았다가 떨어지는데, 상자가 화면 한가운데 있으면 솟을 자리가
             절반뿐이다. 아래로 내리면 그 위가 다 무대가 된다.
          ⚠️ 돼지는 **이 칸 안에서만** 그려진다. 칸이 좁으면 화면 밖이 아니라 칸 밖으로
             나가 잘린다 — 그래서 칸을 키우는 것이 곧 돼지를 더 보는 길이다. */}
      {/* ⚠️ 이 칸은 **상자 크기**다. 돼지가 노는 자리가 아니다.
             그림판은 이 칸보다 사방 `PIG_SPILL`(420px) 만큼 크고, 돼지는 그 넓은 판
             전체를 쓴다. 그래서 칸을 줄이면 상자만 작아지고 돼지 무대는 그대로다
             — 사용자가 원한 "상자는 작게, 돼지는 잘 보이게" 가 바로 이 조합이다.
          ★ 980x720 → 400x320. `marginTop` 은 상자를 화면 아래쪽에 두어 위를 다 비운다. */}
      <div style={{ width: 400, height: 320, marginTop: 190 }}>
        <Box3DViewer
          modelUrl="/models/chest-split.glb"
          innerCm={[30, 30, 30]}
          name={null}
          lidOpen={lidOpen}
          pixelScale={1}
          pigs
          bare
          onReady={markReady}
          className="h-full"
        />
      </div>
    </div>
  );
}
