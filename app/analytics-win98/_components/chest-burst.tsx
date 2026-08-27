"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

/**
 * 바탕화면 이스터에그의 **터지는 부분** — 워든이 든 상자를 누르면 화면 가운데에 진짜 3D
 * 마인크래프트 상자가 떠오르고, 뚜껑이 열리며 **돼지가 튀어나온다.**
 *
 * ★ 출고 화면의 3D 뷰어를 **그대로 가져다 쓴다**(복사하지 않는다). 돼지 연출은 이미 그
 *   안에 있고(`pigs`), 뚜껑을 여는 것도 `lidOpen` 한 줄이다. 여기서 다시 만들면 두 곳이
 *   갈라지고, 돼지를 손볼 때마다 두 번 고쳐야 한다.
 *
 * ★ **누른 순간에만 불러온다.** 상자 모델이 10.4MB 라, 배경에 늘 띄워 두면 이스터에그
 *   하나가 화면 넷의 로딩을 붙잡는다. `next/dynamic` 으로 미뤄 두면 **찾아낸 사람만** 그
 *   비용을 낸다. 그 전까지는 이 파일이 자바스크립트 번들에도 안 들어간다.
 *
 * ⚠️ `pointer-events: none` — 배경 연출이라 클릭을 먹으면 창을 끌 때 방해가 된다. 뷰어
 *    안에는 드래그로 돌리는 판이 있지만, 부모가 none 이면 자식도 못 받으므로 그대로 통과한다.
 * ⚠️ 뚜껑은 **뜨자마자가 아니라 한 박자 뒤에** 연다. 모델을 받아 장면을 세우는 동안 이미
 *    열려 버리면, 화면에 나타났을 때는 돼지가 이미 다 날아간 뒤다.
 * ⚠️ "동작 줄이기"를 켠 사용자에게는 아무것도 하지 않는다. 갑자기 여러 개가 튀는 움직임은
 *    그 설정이 막으려는 바로 그것이다.
 */

const Box3DViewer = dynamic(
  () => import("@/app/packing-win98/_components/box-3d-viewer").then((m) => m.Box3DViewer),
  { ssr: false, loading: () => null },
);

/** 상자가 뜬 뒤 뚜껑을 열기까지(ms) — 장면이 자리를 잡을 시간 */
const OPEN_AFTER = 700;
/** 다 보여 주고 사라지기까지(ms). 돼지가 화면 밖으로 떨어질 만큼은 되어야 한다 */
const DISMISS_AFTER = 5200;

export function ChestBurst({ active, onDone }: { active: boolean; onDone: () => void }) {
  /* ★ 실제 내용은 **켜져 있는 동안만 붙여 둔다.** 그래야 누를 때마다 뚜껑이 닫힌 상태에서
       새로 시작한다 — 상태를 바깥에 두고 effect 안에서 되돌리면, 켜고 끌 때마다 이전 값을
       지우는 코드가 필요해지고 그건 "effect 안에서 상태를 세우지 말라"는 규칙에 걸린다.
       붙였다 떼는 것 자체가 초기화라 되돌릴 코드가 아예 없어진다. */
  if (!active) return null;
  return <Burst onDone={onDone} />;
}

function Burst({ onDone }: { onDone: () => void }) {
  const [isLidOpen, setIsLidOpen] = useState(false);

  useEffect(() => {
    const openTimer = window.setTimeout(() => setIsLidOpen(true), OPEN_AFTER);
    const doneTimer = window.setTimeout(onDone, DISMISS_AFTER);
    return () => {
      window.clearTimeout(openTimer);
      window.clearTimeout(doneTimer);
    };
  }, [onDone]);

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center"
    >
      {/* 상자가 놓일 자리. 배경 한가운데에서 조금 위 — 워든이 들고 있던 높이다 */}
      <div style={{ width: 520, height: 420, marginBottom: 40 }}>
        <Box3DViewer
          modelUrl="/models/chest-split.glb"
          innerCm={[30, 30, 30]}
          name={null}
          lidOpen={isLidOpen}
          pixelScale={1}
          pigs
          bare
          className="h-full"
        />
      </div>
    </div>
  );
}
