"use client";

import dynamic from "next/dynamic";
import { Panel } from "./_components/win98-ui";

/**
 * 슬롯 창고 — win98 셸의 **네 번째 화면**. 실측 물동량(2024-08-01 ~ 10-31, 영업일 61일)으로
 * 창고 점유를 2D 실시간 지도와 3D 로 보여 준다.
 *
 * ★ 본체(`_components/warehouse-slot-3d.jsx`)는 받아 온 코드를 그대로 쓰고, 셸만 걷어냈다.
 *   three.js 씬 구성·애니메이션 루프, `simRef`/`statsRef`/`apiRef` 로 3D → 2D 값을 나눠 쓰는
 *   부분, 2D 맵 렌더 루프는 손대지 않았다 — 그쪽이 이 화면의 전부라서다.
 *
 * ★ **브라우저에서만 불러온다**(`ssr: false`). three.js 가 `window` 와 WebGL 컨텍스트를
 *   전제로 하는데, Next 는 이 화면을 빌드 때 미리 그려 두려 한다. 그때 실행되면 그 자리에서
 *   터지므로 서버 렌더를 막는다.
 *
 * ⚠️ **높이를 위에서 아래로 흘려보낸다.** three.js 렌더러가 부모 크기를 재서 캔버스를 맞추기
 *    때문에, 중간에 높이를 잃는 칸이 하나라도 있으면 캔버스가 0px 이 되어 아무것도 안 보인다.
 *    `<main>` → 이 div → Panel → 본체 까지 전부 높이가 이어져야 한다.
 * ⚠️ 이 화면은 스크롤이 없다(다른 win98 화면과 같은 전제). 넘치면 스크롤이 아니라 잘린다.
 */
const WarehouseSlot3D = dynamic(() => import("./_components/warehouse-slot-3d"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-[13px]">
      창고 도면을 불러오는 중…
    </div>
  ),
});

export default function WarehouseWin98Page() {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Panel
        title="슬롯 창고 현황"
        right={
          <span className="shrink-0 text-[13px] font-normal">
            실측 61일 · 총용량 866.9㎥
          </span>
        }
        className="min-h-0 flex-1"
        bodyClassName="min-h-0"
      >
        <WarehouseSlot3D />
      </Panel>
    </div>
  );
}
