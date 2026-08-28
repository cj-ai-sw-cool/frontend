/* ═══════════════════════════════════════════════════════════════════════════
   분석 화면 — 규격별 재고 수량 (A~F)

   ★ 원래 이 자리는 "Throughput — 시간대별 처리량" 이었는데, 그 수치는 아직 계약이 없어
     빈 칸으로 두고 있었다. **재고는 이미 실측 데이터로 돌아간다** — 비어 있는 자리를
     붙들고 있는 것보다 지금 보여 줄 수 있는 것을 놓는 편이 낫다.
   ★ 숫자는 아래 창고 맵과 **같은 함수**에서 온다(`warehouse-data` 의 `gradeStats`). 각자
     계산하면 언젠가 지도와 이 패널이 서로 다른 재고를 말하게 되는데, 그건 대시보드가
     저지를 수 있는 가장 나쁜 오류다.

   ── 왜 이 모양인가 ──────────────────────────────────────────────────────────
   ⚠️ 칸이 **974 x 100px 로 납작하다.** 세로로 쌓으면 여섯 줄이 안 들어간다. 그래서 여섯을
      가로로 나란히 놓고, 각 칸 안에서만 위아래로 쌓는다.
   ⚠️ 점유율을 **색 농도가 아니라 눈금**으로 말한다 — 98 의 진행 막대와 같은 방식이고,
      아래 지도의 구역 눈금과도 같은 문법이다. 두 곳이 같은 것을 다르게 그리면 같은 것으로
      안 읽힌다.
   ⚠️ 색은 규격 색(`g.color`)을 **위쪽 띠에만** 쓴다. 칸 전체를 여섯 색으로 칠하면 98 이
      아니라 색종이가 된다 — 지도에서 구역을 그릴 때와 같은 이유다.
   ═══════════════════════════════════════════════════════════════════════════ */
"use client";

import { gradeStats } from "./warehouse-data";
import { Sunken, w98 } from "./win98-ui";

/** 0xRRGGBB → CSS. 규격 색은 3D·2D 가 함께 쓰는 값이라 숫자로 들고 있다 */
const hex = (n: number) => `#${n.toString(16).padStart(6, "0")}`;

/** 눈금 칸 수. 지도의 구역 눈금과 같은 10칸이다 — 두 곳의 "한 칸"이 같은 뜻이어야 한다 */
const CELLS = 10;

export function InventoryPanel({ day = 29 }: { day?: number }) {
  const rows = gradeStats(day);

  return (
    <div className="flex min-h-0 flex-1 gap-1">
      {rows.map(({ g, occ, total, filled }) => {
        const lit = Math.round(occ * CELLS);
        /* 임계 65% 를 넘긴 구역은 붉게 — 창고 화면의 경고와 같은 기준이다.
           ⚠️ 색만으로 말하지 않는다. 아래에 퍼센트 숫자를 같이 적는다 — 색각 이상이 있는
              사람에게 붉은 눈금과 남색 눈금은 같은 회색이다. */
        const hot = occ > 0.85;
        return (
          <div
            key={g.id}
            className={`${w98.raised} flex min-w-0 flex-1 flex-col bg-[color:var(--surface)] px-1.5 pt-0 pb-1`}
          >
            {/* 규격 색 띠 — 이 칸이 어느 구역인지를 지도와 같은 색으로 잇는다 */}
            <div className="-mx-1.5 h-[5px] shrink-0" style={{ background: hex(g.color) }} />

            {/* 규격 이름 — 13px(`w98.small`) → **17px** (사용자 지적: 잘 안 보인다).
                ⚠️ 줄 높이를 못 박는다(19px). 기본 줄 높이는 글자의 1.5배라, 키운 만큼
                   줄 상자가 같이 불어나 아래 눈금이 칸 밖으로 밀린다.
                ⚠️ 재고 수도 같이 키운다(17 → 22px). 이름과 같은 크기가 되면 무엇을 보러
                   온 칸인지가 흐려진다 — 여기서 가장 큰 글자는 수량이어야 한다. */}
            <div className="mt-1 flex shrink-0 items-baseline gap-1 truncate text-[17px] leading-[19px] font-bold">
              <span>{g.code}</span>
              <span className="opacity-70">·</span>
              <span className="truncate">{g.name}</span>
            </div>

            {/* 재고 수 — 이 칸에서 가장 큰 글자. 여기 보러 온 숫자다.
                ⚠️ 숫자는 고정폭으로 찍는다. 값이 바뀔 때 자릿수마다 폭이 달라지면 옆 칸과
                   높이가 어긋나 보이고, 재고가 흔들리는 것처럼 읽힌다. */}
            <div className="mt-0.5 flex shrink-0 items-baseline gap-0.5 font-mono leading-none">
              <span className="text-[22px] font-bold tabular-nums" style={{ color: hot ? "#A00000" : "#000080" }}>
                {filled.toLocaleString()}
              </span>
              <span className="text-[14px] tabular-nums opacity-70">/{total.toLocaleString()}</span>
            </div>

            {/* 점유 눈금 — 98 진행 막대. 칸이 몇 개 찼는지로 읽는다 */}
            <Sunken className="mt-auto flex h-[11px] shrink-0 gap-[1px] p-[2px]">
              {Array.from({ length: CELLS }, (_, i) => (
                <span
                  key={i}
                  className="min-w-0 flex-1"
                  style={{ background: i < lit ? (hot ? "#A00000" : "#000080") : "transparent" }}
                />
              ))}
            </Sunken>

            <div className="mt-0.5 shrink-0 text-right text-[14px] leading-[16px] tabular-nums">
              {(occ * 100).toFixed(1)}%
            </div>
          </div>
        );
      })}
    </div>
  );
}
