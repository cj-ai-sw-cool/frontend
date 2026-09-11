/* ═══════════════════════════════════════════════════════════════════════════
   분석 화면 — 입출고 흐름 (입고 → 슬롯 창고 → 라인 → 출고)

   ★ 손그림으로 받은 흐름도를 옮긴 것이다. 한때 오른쪽 세로 칸에 있어서 위에서 아래로
     세웠다가, 위 가로 칸으로 자리를 옮기면서 **손그림 그대로 가로**가 됐다 (사용자 결정).
   ⚠️ 칸은 1390 x 122 다. 한 단계에 320px x 122px 이 돌아가므로 **세 줄**을 쓴다:
      이름 / 큰 숫자 / 부연. 글씨를 키워 달라는 요청에 맞춰 숫자를 34px 로 올렸는데,
      그만큼 줄 수를 늘리면 다시 빽빽해진다 — 큰 글씨와 여백은 같이 가야 뜻이 산다.
   ★ 단계를 가르는 방법을 **면에서 선으로** 바꿨다 (사용자 지적 — 촌스럽다). 옅은 회색
     면을 깔아 두었더니 네 덩어리가 둔하게 앉아 있었다. 지금은 얇은 테두리 하나로만
     가르고, 무게는 **글자 크기**가 진다 — 숫자 38px, 이름 13px.
   ★ 번호도 **까만 원에서 옅은 숫자**로 낮췄다. 순서를 알려 주면 그만인 표시라, 원까지
     칠하면 이름보다 눈에 먼저 든다.
   ★ 색을 **전부 걷어냈다** (사용자 지적 — 화려하다). 단계마다 다른 색 점을 찍던 것을
     **번호**로 바꿨다 — 흐름에서 알고 싶은 것은 "몇 번째"이지 "무슨 색"이 아니다.
     강조는 색이 아니라 글자 크기·굵기가 진다 (`clean-ui.ts` 머리말 참고).

   ★ 포장 라인 셋을 **갈라졌다 합쳐지는 선**으로 그렸다 (사용자 요청 — 다이어그램 느낌).
     전에는 라인 셋이 한 카드 안에 작은 상자로 나란히 있어서, 세 갈래로 나뉘었다가 다시
     모인다는 것이 그림에 없었다. 손그림이 원래 그 갈래를 말하고 있었다.
   ⚠️ 갈래는 **곡선**으로 잇는다. 직각으로 꺾으면 회로도처럼 보이고, 직선으로 부채꼴을
      그리면 세 선이 한 점에서 만나 뾰족해진다. 베지에 한 번이면 물길처럼 갈린다.
   ⚠️ 잇는 선은 **SVG**, 글자는 **HTML** 이다. 한 SVG 안에 다 넣으면 한글 글꼴과 고정폭
      숫자 정렬을 잃는다 — 선은 선이 잘하는 것에만 쓴다.

   ★ 바탕은 **화면 회색 그대로**이고, 그 위에 **흰 상자 넷**이 뜬다 (사용자 결정).
     한때 이 칸만 통째로 흰 판이었는데, 창 안에서 그 판만 도드라져 화면이 두 조각으로
     보였다. 바탕을 주변과 같은 회색으로 두면 창이 하나로 이어지고, 그 위에서 흰 상자가
     떠올라 **흐름이 강조된다** — 흰 판 위의 흰 상자는 테두리가 없으면 안 보인다.
   ⚠️ 잇는 선 색을 회색 바탕에 맞춰 **한 단계 진하게** 잡는다. 흰 바탕에서 쓰던 옅은
      회색은 이 바탕 위에서 거의 사라진다.
   ★ 상자를 **들어가 보이게**(sunken) 둘렀다 (사용자 요청 — 예전 윈도우처럼 아날로그하게).
     98 의 입체감은 그림자가 아니라 **네 변의 밝기 차이**다: 위·왼쪽은 어둡고 아래·오른쪽은
     밝으면 파인 것으로 보인다. 이 화면의 `w98.sunken` 이 바로 그 규칙이라 새로 만들지
     않고 가져다 쓴다 — 창틀과 같은 손으로 그린 것이 된다.
   ⚠️ 모서리를 **각지게** 되돌린다. 둥근 모서리와 98 베벨은 같이 못 간다. 베벨은 네 변이
      만나는 모서리에서 밝기가 꺾이며 입체가 생기는데, 둥글리면 그 꺾임이 뭉개진다.
   ⚠️ 그래도 창틀(`Panel`)은 98 그대로다. 창 안쪽만 담백한 것이지, 창까지 달라지면 이 칸만
      다른 프로그램에서 떠 온 것처럼 보인다.

   ★ Stage 2 — 정적 61일 배열을 걷어냈다(브리프 §3 S2.8). 숫자는
     `GET /inventory/daily` 의 오늘 행 + `GET /zones/summary` 에서 온다. 오늘 원장이 없으면
     0으로 보인다 — 지어낸 값으로 채우지 않는다.
   ⚠️ **라인 A·B·C 의 분배는 실측이 아니다.** 백엔드에 라인별 집계가 아직 없어서, 그날의
      출고 합계를 정해진 비율로 나눈 값이다. 합계만은 반드시 실제 출고 수와 같게 맞춘다 —
      나눈 값이 총계와 어긋나면 바로 위 칸과 대조했을 때 티가 난다. 라인별 데이터가 생기면
      `LINE_SHARE` 를 지우고 그 값을 꽂으면 된다.
   ═══════════════════════════════════════════════════════════════════════════ */
"use client";

import type { ReactNode } from "react";

import { useRecentDailyInventory, useZonesSummary } from "../_data/use-inventory";
import { FAINT, FILL, INK, MUTED, TRACK } from "./clean-ui";
import { w98 } from "./win98-ui";

/** 라인별 분배 비율 — 실측이 아니다 (위 주의 참고). 합은 1 */
const LINE_SHARE = [0.4, 0.34, 0.26];
const LINE_NAME = ["A", "B", "C"];

/** 갈래 잇는 선의 세로 크기. 라인 셋의 자리를 여기서 정하고 SVG 와 HTML 이 나눠 쓴다 */
/** 잇는 선 색 — 회색 바탕(#C0C0C0) 위에서 읽히는 밝기. `FAINT` 는 여기서 묻힌다 */
const WIRE = "#7C848D";

const BRANCH_H = 100;
/** 라인 상자 하나의 높이 */
const LINE_H = 28;
/** 갈래 선 하나의 y (셋) — **상자 셋의 한가운데**다.
   ⚠️ 상자를 `justify-between` 으로 위·가운데·아래에 놓으므로 중심은 자동으로
      LINE_H/2, BRANCH_H/2, BRANCH_H−LINE_H/2 가 된다. 이 값과 어긋나면 선이 상자
      모서리에 가서 붙는다 — 셋을 따로 적지 말고 여기서 같이 구한다. */
const BRANCH_Y = [LINE_H / 2, BRANCH_H / 2, BRANCH_H - LINE_H / 2];

/**
 * 단계 하나 — 얇은 테두리 안에 번호 · 이름 · 큰 숫자 · 부연.
 *
 * ⚠️ 세 칸을 `flex-1` 로 **똑같이** 나눈다. 내용 길이에 맡기면 한 칸만 넓어져, 단계가
 *    같은 무게라는 것이 흐려진다.
 */
function Node({
  no, label, value, unit, children,
}: {
  no: number; label: string; value: string; unit: string; children?: ReactNode;
}) {
  return (
    <div
      className={`${w98.sunken} flex min-w-0 flex-1 flex-col justify-center bg-white px-4 py-3`}
    >
      <div className="flex items-baseline gap-2">
        {/* 몇 번째 단계인가. 순서만 알려 주면 되는 표시라 가장 옅게 둔다 */}
        <span className="font-mono text-[11px] font-semibold" style={{ color: FAINT }}>{no}</span>
        <span className="truncate text-[13px] font-medium" style={{ color: MUTED }}>{label}</span>
      </div>

      <div className="mt-1.5 flex items-baseline gap-2">
        <span
          className="font-mono text-[38px] leading-none font-bold tracking-tight tabular-nums"
          style={{ color: INK }}
        >
          {value}
        </span>
        <span className="text-[12px] whitespace-nowrap" style={{ color: MUTED }}>{unit}</span>
      </div>

      {children && <div className="mt-2">{children}</div>}
    </div>
  );
}

/** 곧게 잇는 선 — 카드와 카드 사이 */
function Link() {
  return (
    <div className="flex w-[30px] shrink-0 items-center" aria-hidden>
      <svg width="30" height="12" viewBox="0 0 30 12" fill="none" className="overflow-visible">
        <path d="M0 6h22" stroke={WIRE} strokeWidth="1.5" />
        <path d="M21 2.5l4 3.5-4 3.5" stroke={WIRE} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </svg>
    </div>
  );
}

/**
 * 갈라지거나 합쳐지는 선.
 * @param split 참이면 하나 → 셋, 거짓이면 셋 → 하나
 *
 * ⚠️ 합칠 때는 화살촉을 **끝(오른쪽)** 에 하나만 둔다. 세 갈래마다 촉을 달면 화살표 셋이
 *    한 점을 찌르는 모양이 되어, 합류가 아니라 충돌로 보인다.
 */
function Branch({ split }: { split: boolean }) {
  const W2 = 40, mid = BRANCH_H / 2;
  const paths = BRANCH_Y.map((y) =>
    split
      ? `M0 ${mid} C ${W2 * 0.55} ${mid}, ${W2 * 0.45} ${y}, ${W2} ${y}`
      : `M0 ${y} C ${W2 * 0.55} ${y}, ${W2 * 0.45} ${mid}, ${W2} ${mid}`);
  return (
    <div className="flex w-[40px] shrink-0 items-center" aria-hidden>
      <svg width={W2} height={BRANCH_H} viewBox={`0 0 ${W2} ${BRANCH_H}`} fill="none">
        {paths.map((d, i) => (
          <path key={i} d={d} stroke={WIRE} strokeWidth="1.5" fill="none" />
        ))}
        {!split && (
          <path
            d={`M${W2 - 5} ${mid - 3.5}l4 3.5-4 3.5`}
            stroke={WIRE} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"
          />
        )}
      </svg>
    </div>
  );
}

/** 이름 — 값 한 줄. 부연은 전부 이 모양이라, 눈이 왼쪽만 훑어도 읽힌다 */
function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-2 text-[12px]">
      <span style={{ color: MUTED }}>{label}</span>
      <span className="font-mono font-semibold tabular-nums" style={{ color: INK }}>{children}</span>
    </div>
  );
}

/**
 * Stage 2 — `GET /inventory/daily?from=오늘−30&to=오늘` 의 마지막 행(오늘)과
 * `GET /zones/summary` 로 그린다(브리프 §3 S2.8). 정적 61일 배열은 삭제했다.
 * 응답이 비어 있으면(그날 원장이 없으면) 0으로 둔다.
 */
export function FlowPanel() {
  const { data: daily } = useRecentDailyInventory();
  const today = daily && daily.length > 0 ? daily[daily.length - 1] : undefined;
  const inn = today?.receivedQty ?? 0;
  const out = today?.shippedQty ?? 0;
  const stock = today?.onHandQty ?? 0;
  const delta = inn - out;

  /* 슬롯 점유율 — 존별 합계(`GET /zones/summary`)를 전체로 묶는다. 로딩 중이거나 아직
     안 받았으면 0%로 둔다. */
  const { data: zonesSummary } = useZonesSummary();
  const total = zonesSummary?.reduce((sum, z) => sum + z.binCount, 0) ?? 0;
  const filled = zonesSummary?.reduce((sum, z) => sum + z.occupiedBins, 0) ?? 0;
  const occ = total > 0 ? filled / total : 0;

  /* ⚠️ 마지막 라인은 **빼서** 구한다. 셋 다 반올림하면 합이 출고 수와 한두 건 어긋나는데,
     바로 옆 칸에 그 총계가 적혀 있으므로 그 어긋남이 그대로 보인다. */
  const lines = LINE_SHARE.map((r, i) =>
    i === LINE_SHARE.length - 1
      ? out - LINE_SHARE.slice(0, -1).reduce((s, x) => s + Math.round(out * x), 0)
      : Math.round(out * r));

  const n = (v: number) => v.toLocaleString();

  return (
    <div className="flex min-h-0 flex-1 items-center overflow-hidden px-1 py-1">
      <Node no={1} label="입고" value={n(inn)} unit="건">
        {/* 부호를 **글자로** 적는다. 늘었는지 줄었는지는 색이 아니라 이 기호가 말한다 */}
        <Row label="재고 증감">{delta >= 0 ? "+" : "−"}{n(Math.abs(delta))}</Row>
      </Node>

      <Link />

      <Node no={2} label="슬롯 창고" value={n(stock)} unit="건 재고">
        <Row label="슬롯 점유">{(occ * 100).toFixed(1)}%</Row>
        {/* 98 의 진행 막대 — 홈이 파여 있고 그 안이 찬다. 둥근 막대는 이 화면의 문법이 아니다 */}
        <div className={`${w98.sunken} mt-1.5 h-[7px] w-full overflow-hidden`} style={{ background: TRACK }}>
          <div className="h-full" style={{ width: `${occ * 100}%`, background: FILL }} />
        </div>
      </Node>

      <Branch split />

      {/* ── 포장 라인 셋 — 갈래의 한가운데 ──
          ★ 한 상자 안에 실선으로 나누던 것을 **상자 셋으로 떼어 놓았다** (사용자 요청 —
            붙어 있지 말고 나뉘게). 갈래가 세 갈래로 갈라진다는 것이 요점인데, 도착지가
            한 덩어리면 선만 셋이고 실제로는 한 곳으로 들어가는 그림이 된다.
          ⚠️ 높이를 `BRANCH_H` 로 못 박는다. 내용에 맡기면 세 상자의 높이가 글자에 따라
             달라져 양옆 갈래 선이 상자 가운데를 못 맞춘다. */}
      <div
        className="flex shrink-0 flex-col justify-between"
        style={{ height: BRANCH_H, width: 150 }}
      >
        {lines.map((v, i) => (
          <div
            key={LINE_NAME[i]}
            className={`${w98.sunken} flex items-center justify-between gap-2 bg-white px-2.5`}
            style={{ height: LINE_H }}
          >
            <span className="text-[12px]" style={{ color: MUTED }}>라인 {LINE_NAME[i]}</span>
            <span className="font-mono text-[19px] leading-none font-bold tabular-nums" style={{ color: INK }}>
              {n(v)}
            </span>
          </div>
        ))}
      </div>

      <Branch split={false} />

      <Node no={4} label="출고" value={n(out)} unit="건 포장 완료">
        <Row label="가동 라인">{LINE_NAME.length} / {LINE_NAME.length}</Row>
      </Node>
    </div>
  );
}
