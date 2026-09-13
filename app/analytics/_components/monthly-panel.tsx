/* ═══════════════════════════════════════════════════════════════════════════
   분석 화면 — 월간 물동량 · 칸 규격별 재고

   ★ 이 자리에 규격별 재고 → 일별 추이 그래프를 차례로 놓아 봤는데 둘 다 물러섰다. 앞엣것은
     아래 지도와 겹쳤고, 뒤엣것은 "데이터를 보여 줄 뿐 뜻이 한눈에 안 온다" 는 지적을 받았다.
     **달 단위**로 묶으니 이야기가 또렷해진다 (사용자 결정):
       8월  입고가 출고의 1.5배 → 재고 급증
       9월  입고 ≈ 출고        → 제자리
       10월 출고가 입고를 앞지름 → 재고 감소
     날짜별 그래프에서는 이 셋이 톱니 속에 묻혀 있었다.

   ★ 아래 칸은 **칸 규격별 재고** 다 (사용자 결정). 한때 여기 소진율과 재고
     순증을 두 상자로 두었는데, 셋으로 나뉜 칸이 저마다 다른 것을 말해 화면이 흩어졌다.
     지금은 **위가 시간(달별 물동량), 아래가 지금(규격별 재고)** 으로 두 가지만 말한다.
   ⚠️ Stage 11(11.0) 개정 — 존이 더 이상 상품 크기를 뜻하지 않는다(존은 매체 구획,
      존 7개 A~F 등급 배치가 사라졌다). 규격은 이제 `bin_type`(XS·S·M·L·XL·PLT) 의
      몫이라 이 칸도 존 코드(`GET /zones/summary`) 대신 `GET /layout` 베이의
      `binType`×`occupiedBins`/`totalBins` 합으로 다시 센다(백엔드에 bin_type 별
      집계 API 가 없다, 노트 참고). "박스 규격별 재고" → **"칸 규격별 재고"** 로도
      이름을 바꿨다 — bin_type 은 보관칸 규격이지 포장 박스(`GET /box-types`, 출고
      화면이 따로 쓴다)가 아니라 "박스"라고 부르면 다른 규격표와 헷갈린다.

   ⚠️ 이 칸만 **61일 전부**를 본다. 지도·흐름도는 `day`(기본 29 = 2024-09-11)를 "오늘"로
      말하지만, 여기는 지나간 달을 정리하는 자리라 달을 잘라 보여 주면 8월 한 달과 9월
      열하루를 나란히 놓고 비교하는 꼴이 된다. 대신 제목 밑에 기간을 적어 둔다.
   ⚠️ 그림은 **인라인 SVG** 다. 막대 여섯 개에 차트 라이브러리를 들일 이유가 없다.
   ★ 바탕은 화면 회색이고 그 위에 **들어가 보이는 흰 상자** 셋이 앉는다 — 옆 흐름도와
     같은 문법이다 (그쪽 머리말 참고). 두 칸이 다른 손으로 그려지면 통일감이 깨진다.

   ── 한 번에 보이는 달 ──────────────────────────────────────────────────────
   ★ 좌우로 넘길 수 있게 했다 (사용자 요청). 한 화면에 **석 달**만 놓는다 — 폭 340 에
     여섯 막대가 들어가면 값 글자가 서로 겹친다.
   ★ Stage 2 — 지어낸 열두 달 배열을 걷어냈다(브리프 §3 S2.8). 이제
     `GET /inventory/daily?from=오늘−30&to=오늘` 이 실제로 쌓인 원장만큼만 보여준다.
     최근 30일이라 대개 한두 달치라 화면에 빈칸이 남을 수 있다 — 그게 지금의 실제 데이터다.

   ── 세로 배분 ──────────────────────────────────────────────────────────────
   ⚠️ 상자 셋의 높이를 내용에 맡겼더니 아래에 **126px 이 빈 채로** 남았다 (사용자 지적).
      두 가지를 같이 손봐야 없어진다:
        1. 막대 그래프를 키운다. SVG 는 `viewBox` 비율대로 그려지므로 폭이 384 로 고정된
           이 칸에서는 **H 를 키우는 것이 곧 높이를 키우는 것**이다. 150 → 230 이면
           169px 이던 그림이 260px 이 된다.
        2. 남는 높이를 **그래프 상자가 다 가져간다** (사용자 결정 — 월별 칸을 더 크게).
           아래 둘은 `shrink-0` 으로 제 내용 높이만 쓰고, 그래프 상자만 `flex-1` 이다.
      1 만 하면 그래프만 커지고 상자는 그대로라 안쪽에 공백이 남고, 2 만 하면 상자는
      늘어나는데 그림이 작아 헐렁해진다 — 둘을 맞춰야 한다.

      ── 계산 (셋 중 하나를 바꾸면 여기부터 다시 재라) ────────────────────────
        오른쪽 칸 694 − 패널 껍데기 48 = 안쪽 646
        646 − py-1 8 − 상자 사이 gap 16 = 상자 셋이 쓸 622
        622 − 소진율 173 − 재고 순증 102 = **그래프 상자 347**
        347 − 제목 20 − 범례 18 − 상하 여백 20 = SVG 에 289px
        SVG 는 폭(384)에 맞춰 그려지므로  H = 289 × 340 / 384 ≈ **256**
   ★ 글씨를 전체적으로 키웠다 (사용자 요청 — 크게크게, 세련되게). 8~11px 로 빽빽하던 것을
     제목 15 / 숫자 20~26 / 라벨 12 로 올리고, 칸 폭도 300 → 402 로 늘렸다. 큰 글씨는
     여백과 같이 가야 해서 줄 수를 줄였다 — 월간 지표 표에서 '평균 사용률' 열을 빼고
     세 달을 **카드 셋**으로 폈다.
   ★ 색을 **전부 걷어냈다** (사용자 지적 — 화려하다). 입고·출고는 파랑/회색이 아니라
     **진한 회색 / 옅은 회색**으로 갈리고, 쌓임·빠짐은 색이 아니라 글자와 굵기가 말한다.
     색이 셋이면 셋 다 중요해 보이는데, 무채색에서는 굵은 것 하나만 눈에 든다.
   ═══════════════════════════════════════════════════════════════════════════ */
"use client";

import { useMemo, useState } from "react";
import { useCenter } from "@/lib/center";

import type { DailyInventory } from "@/lib/types";
import { useLayout } from "../_data/use-layout";
import { useRecentDailyInventory } from "../_data/use-inventory";
import { FAINT, FILL, FILL_WEAK, INK, MUTED, RULE, TRACK } from "./clean-ui";
import { w98 } from "./win98-ui";

type Month = {
  key: string;      // "2024-08"
  label: string;    // "8월"
  inn: number;
  out: number;
  net: number;
  burn: number;     // 소진율 = 출고 / 입고
  usage: number;    // 그 달 평균 사용률(%)
};

/** 일별 응답(최근 30일)을 달로 묶는다. 날짜 문자열이 ISO 라 앞 7글자가 곧 달이다 */
function byMonth(daily: DailyInventory[]): Month[] {
  const acc = new Map<string, { inn: number; out: number; u: number[] }>();
  for (const row of daily) {
    const k = row.date.slice(0, 7);
    const a = acc.get(k) ?? { inn: 0, out: 0, u: [] };
    a.inn += row.receivedQty;
    a.out += row.shippedQty;
    a.u.push(row.utilizationPct);
    acc.set(k, a);
  }
  return [...acc.entries()]
    .map(([key, a]) => ({
      key,
      label: `${Number(key.slice(5))}월`,
      inn: a.inn,
      out: a.out,
      net: a.inn - a.out,
      /* ⚠️ 입고가 0 인 달이 생기면 나눗셈이 무한대가 된다 */
      burn: a.inn > 0 ? a.out / a.inn : 0,
      usage: a.u.reduce((s, v) => s + v, 0) / Math.max(1, a.u.length),
    }))
    .sort((a, b) => (a.key < b.key ? -1 : 1));
}

const W = 340, H = 214, PAD_B = 26;

/* 보관칸 규격(`bin_type`, 정본 §11.0 표) — 치수는 그 표에서 그대로 옮겼다(mm).
   PLT_FLOOR 는 시드 기본값이 0(냉장 파렛트 예비)이라 화면에서 뺀다 — 늘 0/0 인
   줄은 "규격 사다리"에 자리만 차지하고 아무 것도 말하지 않는다. */
const BIN_TYPE_SPEC = [
  { code: "XS", mm: "300×300×200" },
  { code: "S", mm: "350×350×300" },
  { code: "M", mm: "400×400×400" },
  { code: "L", mm: "500×500×400" },
  { code: "XL", mm: "600×600×600" },
  { code: "PLT", mm: "1100×1100×1500" },
];

/** 한 화면에 놓는 달 수 */
const VISIBLE = 3;

export function MonthlyPanel() {
  /* Stage 2 — 흐름 패널과 **같은 응답**(브리프 §3 S2.8) 을 쓴다. 같은 훅을 부르므로
     TanStack Query 가 요청을 하나로 합친다(두 훅이 계산하는 날짜가 같아 쿼리 키가 같다). */
  const { data: daily } = useRecentDailyInventory();
  const all = useMemo(() => byMonth(daily ?? []), [daily]);

  /* 규격별 재고는 Stage 11(11.0)부터 존이 아니라 `bin_type` 기준이다(파일 머리말).
     백엔드에 bin_type 별 집계 API 가 없어(2026-09-13 확인) `GET /layout` 베이를
     `binType` 으로 묶어 `totalBins`/`occupiedBins` 를 직접 더한다 — 칸(Position)
     단위가 아니라 베이 단위 합이라 실제 칸 수와 같다(베이의 totalBins 가 이미
     levels×positions 다, `Bay` 타입 참고). */
  const center = useCenter();
  const { data: layout } = useLayout(center);
  const binTypeStats = useMemo(() => {
    const acc = new Map<string, { binCount: number; occupiedBins: number }>();
    for (const bay of layout?.bays ?? []) {
      const entry = acc.get(bay.binType) ?? { binCount: 0, occupiedBins: 0 };
      entry.binCount += bay.totalBins;
      entry.occupiedBins += bay.occupiedBins;
      acc.set(bay.binType, entry);
    }
    return BIN_TYPE_SPEC.map((spec) => ({
      code: spec.code,
      mm: spec.mm,
      binCount: acc.get(spec.code)?.binCount ?? 0,
      occupiedBins: acc.get(spec.code)?.occupiedBins ?? 0,
    })).filter((stat) => stat.binCount > 0);
  }, [layout]);

  /* 보이는 창의 **첫 달** 번호. 데이터가 들어오기 전에는 null 로 두고, 들어오면 **가장
     최근 석 달**이 보이게 연다 — 30일치라 대개 한두 달뿐이라도 그중 최신 쪽이다. */
  const [from, setFrom] = useState<number | null>(null);
  const start = Math.max(0, Math.min(from ?? Math.max(0, all.length - VISIBLE), all.length - VISIBLE));
  const months = all.slice(start, start + VISIBLE);
  /* ⚠️ 막대 눈금은 **보이는 석 달**에서만 잡는다. 전체에서 잡으면 넘길 때마다 눈금이
     그대로라 창마다 막대가 다 짧아 보이는 달이 생긴다 — 비교는 한 화면 안에서 한다. */
  const peak = Math.max(1, ...months.flatMap((m) => [m.inn, m.out]));
  /* 데이터가 아직 없으면(n=0) 폭 나눗셈이 무한대가 된다 — 최소 1로 막는다 */
  const n = Math.max(1, months.length);
  const canPrev = start > 0;
  const canNext = start + VISIBLE < all.length;

  /* 한 달 자리 안에 막대 둘. 자리 폭의 절반쯤을 막대에 쓰고 나머지를 여백으로 둔다 —
     꽉 채우면 달과 달의 경계가 사라져 막대 여섯 개가 한 줄로 보인다 */
  const slot = W / n;
  const bar = Math.min(44, slot * 0.34);
  const nf = (v: number) => v.toLocaleString();

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden px-1 py-1">
      <div className={`${w98.sunken} shrink-0 bg-white px-3 py-2.5`}>
        <div className="flex items-center justify-between gap-2">
          <span className="text-[15px] font-semibold" style={{ color: INK }}>월별 물동량</span>
          <div className="flex items-center gap-1.5">
            {/* 보이는 기간은 **데이터에서 읽는다.** 손으로 적어 두면 넘겼을 때 그대로 남는다 */}
            <span className="text-[11px] tabular-nums" style={{ color: MUTED }}>
              {months.length === 0
                ? "데이터 없음"
                : `${months[0]?.key} ~ ${months[months.length - 1]?.key.slice(5)}`}
            </span>
            {/* ⚠️ 못 넘길 때는 **끄되 감추지 않는다.** 사라졌다 나타나면 그 자리에서 제목이
                밀리고, 넘길 수 있는 화면인지도 알 수 없다 */}
            <button
              type="button" aria-label="이전 달"
              disabled={!canPrev}
              onClick={() => setFrom(start - 1)}
              className={`${w98.btn} ${w98.raised} h-[18px] w-[18px] text-[10px] leading-none`}
              style={{ color: canPrev ? INK : FAINT, opacity: canPrev ? 1 : 0.5 }}
            >
              ◀
            </button>
            <button
              type="button" aria-label="다음 달"
              disabled={!canNext}
              onClick={() => setFrom(start + 1)}
              className={`${w98.btn} ${w98.raised} h-[18px] w-[18px] text-[10px] leading-none`}
              style={{ color: canNext ? INK : FAINT, opacity: canNext ? 1 : 0.5 }}
            >
              ▶
            </button>
          </div>
        </div>

        <div className="mt-1.5 flex items-center gap-4 text-[12px]" style={{ color: MUTED }}>
          <span className="flex items-center gap-1.5">
            <span className="size-[9px] rounded-[2px]" style={{ background: FILL }} />입고
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-[9px] rounded-[2px]" style={{ background: FILL_WEAK }} />출고
          </span>
        </div>

        {/* ── 막대 그래프 ────────────────────────────────────────────────
            ★ 납작한 사각형 여섯 개였다 (사용자 지적 — 촌스럽다). 색을 안 쓰기로 한 화면이라
              입체는 **밝기 차이**로만 만들 수 있다. 세 가지를 얹었다:
                1. 막대마다 98 의 **튀어나온 베벨** — 위·왼쪽은 밝게, 아래·오른쪽은 어둡게.
                   창틀과 같은 규칙이라 이 화면에서 낯설지 않다.
                2. 세로 **그러데이션** — 위가 밝고 아래가 어두우면 원통처럼 서 보인다.
                3. **눈금선** — 빈 윗공간이 채워지고, 막대 높이를 견줄 자가 생긴다.
            ⚠️ 모서리를 각지게 둔다(`rx` 없음). 둥근 막대에 98 베벨을 두르면 모서리에서
               밝기가 안 꺾여 입체가 무너진다.
            ⚠️ 눈금선은 막대 **뒤에** 그린다. 위에 그리면 막대를 가로지르는 줄이 되어
               막대가 잘려 보인다. */}
        <svg viewBox={`0 0 ${W} ${H}`} className="mt-2 w-full" role="img" aria-label="월별 물동량">
          <defs>
            <linearGradient id="mBarIn" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3C444C" />
              <stop offset="100%" stopColor="#1B2126" />
            </linearGradient>
            <linearGradient id="mBarOut" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#CBD0D6" />
              <stop offset="100%" stopColor="#A2A9B1" />
            </linearGradient>
          </defs>

          {/* 눈금선 — 최댓값을 넷으로 나눈다 */}
          {[0.25, 0.5, 0.75, 1].map((f) => {
            const y = (H - PAD_B) - f * (H - PAD_B - 22);
            return <line key={f} x1="0" x2={W} y1={y} y2={y} stroke={RULE} strokeWidth="1" />;
          })}

          {months.map((m, i) => {
            const cx = slot * (i + 0.5);
            const h = H - PAD_B;
            const hi = (m.inn / peak) * (h - 22);
            const ho = (m.out / peak) * (h - 22);
            /* 막대 하나 — 면 + 위/왼쪽 밝은 모서리 + 아래/오른쪽 어두운 모서리 */
            const bevel = (x: number, y: number, w: number, hh: number, light: string, dark: string) => (
              <>
                <path d={`M${x} ${y + hh} L${x} ${y} L${x + w} ${y}`} stroke={light} strokeWidth="1.4" fill="none" />
                <path d={`M${x + w} ${y} L${x + w} ${y + hh} L${x} ${y + hh}`} stroke={dark} strokeWidth="1.4" fill="none" />
              </>
            );
            const xi = cx - bar - 1.5, xo = cx + 1.5;
            return (
              <g key={m.key}>
                <rect x={xi} y={h - hi} width={bar} height={hi} fill="url(#mBarIn)" />
                {bevel(xi, h - hi, bar, hi, "#59626B", "#0E1215")}
                <rect x={xo} y={h - ho} width={bar} height={ho} fill="url(#mBarOut)" />
                {bevel(xo, h - ho, bar, ho, "#E6EAEE", "#7C838B")}

                {/* 값은 막대 **위에** 적는다. 안에 넣으면 짧은 막대에서 글자가 삐져나온다 */}
                <text x={xi + bar / 2} y={h - hi - 6} textAnchor="middle" fontSize="12" fill={FAINT}>
                  {nf(m.inn)}
                </text>
                <text x={xo + bar / 2} y={h - ho - 6} textAnchor="middle" fontSize="12" fill={FAINT}>
                  {nf(m.out)}
                </text>
                <text x={cx} y={H - 4} textAnchor="middle" fontSize="16" fill={INK} fontWeight="600">
                  {m.label}
                </text>
              </g>
            );
          })}

          {/* 바닥선 — 눈금선보다 진하게. 막대가 서 있는 바닥이라 한 단계 굵다 */}
          <line x1="0" x2={W} y1={H - PAD_B} y2={H - PAD_B} stroke={MUTED} strokeWidth="1.4" />
        </svg>
      </div>

      {/* ── 칸 규격별 재고 ── */}
      <div className={`${w98.sunken} flex min-h-0 flex-1 flex-col bg-white px-3 py-2.5`}>
        <div className="flex shrink-0 items-baseline justify-between gap-2">
          <span className="text-[15px] font-semibold" style={{ color: INK }}>칸 규격별 재고</span>
          <span className="text-[11px]" style={{ color: MUTED }}>채움 / 전체</span>
        </div>

        {/* ── 한 줄 = 규격 하나 ────────────────────────────────────────
            ★ 한 줄에 규격·치수·재고 수·비율·막대 다섯 가지가 있었다. 다 있으니
              **아무것도 눈에 안 들어왔다** (사용자 지적). 규격 코드만 크게 남기고
              나머지를 낮췄다.
            ★ 규격 코드를 **왼쪽 기둥에 세로로 정렬**한다. 줄의 왼쪽 끝이 XS~PLT 로
              줄지어 서면, 눈이 그 기둥만 훑어도 규격 사다리가 읽힌다.
            ⚠️ 치수는 코드 아래 작게만 둔다 — 여기는 "지금 얼마나 찼나"를 보는 자리라
               재고 수와 나란히 두면 어느 쪽이 재고인지 흐려진다.
            ⚠️ 줄이 남는 높이를 나눠 갖는다(`flex-1`). 줄 높이를 못 박으면 창 높이가
               조금만 달라져도 마지막 줄이 잘리거나 아래가 휑하다. */}
        <div className="mt-2 flex min-h-0 flex-1 flex-col">
          {binTypeStats.map((stat, i) => {
            const pct = stat.binCount > 0 ? (stat.occupiedBins / stat.binCount) * 100 : 0;
            /* 임계를 넘긴 규격만 굵게. 색을 안 쓰므로 굵기가 유일한 강조다 */
            const hot = pct > 85;
            return (
              <div
                key={stat.code}
                className="flex min-h-0 flex-1 items-center gap-3"
                style={i === 0 ? undefined : { borderTop: `1px solid ${RULE}` }}
              >
                {/* 규격 코드 — 이 줄의 이름이자 이 칸에서 가장 큰 글자 */}
                <div className="w-[38px] shrink-0 text-center">
                  <div className="text-[21px] leading-none font-bold" style={{ color: INK }}>
                    {stat.code}
                  </div>
                  <div className="mt-0.5 text-[9px] leading-none" style={{ color: FAINT }}>{stat.mm}</div>
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-1 font-mono leading-none">
                    <span
                      className={`text-[16px] tabular-nums ${hot ? "font-bold" : "font-semibold"}`}
                      style={{ color: INK }}
                    >
                      {stat.occupiedBins.toLocaleString()}
                    </span>
                    <span className="text-[11px] tabular-nums" style={{ color: MUTED }}>
                      /{stat.binCount.toLocaleString()}
                    </span>
                    <span className="ml-auto text-[12px] tabular-nums" style={{ color: hot ? INK : MUTED }}>
                      {pct.toFixed(1)}%
                    </span>
                  </div>

                  {/* 98 의 진행 막대 — 파인 홈 안이 찬다 */}
                  <div className={`${w98.sunken} mt-1.5 h-[7px] w-full`} style={{ background: TRACK }}>
                    <div className="h-full" style={{ width: `${pct}%`, background: hot ? FILL : FILL_WEAK }} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
