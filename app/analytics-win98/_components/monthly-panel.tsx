/* ═══════════════════════════════════════════════════════════════════════════
   분석 화면 — 월간 입출고 지표

   ★ 이 자리에 규격별 재고 → 일별 추이 그래프를 차례로 놓아 봤는데 둘 다 물러섰다. 앞엣것은
     아래 지도와 겹쳤고, 뒤엣것은 "데이터를 보여 줄 뿐 뜻이 한눈에 안 온다" 는 지적을 받았다.
     **달 단위**로 묶으니 이야기가 또렷해진다 (사용자 결정):
       8월  입고가 출고의 1.5배 → 재고 급증
       9월  입고 ≈ 출고        → 제자리
       10월 출고가 입고를 앞지름 → 재고 감소
     날짜별 그래프에서는 이 셋이 톱니 속에 묻혀 있었다.

   ★ 그래서 이 칸의 주인공은 **소진율(출고÷입고)** 이다. 100% 를 넘으면 빠지고 못 넘으면
     쌓인다 — 막대 길이 하나로 "창고가 차는 중인가"가 읽힌다. 입고·출고 절대값만으로는
     둘 중 어느 쪽이 큰지를 매번 머리로 빼야 한다.

   ⚠️ 이 칸만 **61일 전부**를 본다. 지도·흐름도는 `day`(기본 29 = 2024-09-11)를 "오늘"로
      말하지만, 여기는 지나간 달을 정리하는 자리라 달을 잘라 보여 주면 8월 한 달과 9월
      열하루를 나란히 놓고 비교하는 꼴이 된다. 대신 제목 밑에 기간을 적어 둔다.
   ⚠️ 그림은 **인라인 SVG** 다. 막대 여섯 개에 차트 라이브러리를 들일 이유가 없다.
   ★ 바탕은 화면 회색이고 그 위에 **들어가 보이는 흰 상자** 셋이 앉는다 — 옆 흐름도와
     같은 문법이다 (그쪽 머리말 참고). 두 칸이 다른 손으로 그려지면 통일감이 깨진다.

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

import { FAINT, FILL, FILL_WEAK, INK, MUTED, RULE, TRACK } from "./clean-ui";
import { w98 } from "./win98-ui";
import { REAL_DATES, REAL_IN, REAL_OUT, REAL_USAGE } from "./warehouse-data";

type Month = {
  key: string;      // "2024-08"
  label: string;    // "8월"
  inn: number;
  out: number;
  net: number;
  burn: number;     // 소진율 = 출고 / 입고
  usage: number;    // 그 달 평균 사용률(%)
};

/** 일자별 실측을 달로 묶는다. 날짜 문자열이 ISO 라 앞 7글자가 곧 달이다 */
function byMonth(): Month[] {
  const acc = new Map<string, { inn: number; out: number; u: number[] }>();
  REAL_DATES.forEach((iso, i) => {
    const k = String(iso).slice(0, 7);
    const a = acc.get(k) ?? { inn: 0, out: 0, u: [] };
    a.inn += REAL_IN[i] ?? 0;
    a.out += REAL_OUT[i] ?? 0;
    a.u.push(REAL_USAGE[i] ?? 0);
    acc.set(k, a);
  });
  return [...acc.entries()].map(([key, a]) => ({
    key,
    label: `${Number(key.slice(5))}월`,
    inn: a.inn,
    out: a.out,
    net: a.inn - a.out,
    /* ⚠️ 입고가 0 인 달이 생기면 나눗셈이 무한대가 된다. 실측 3개월에는 없지만, 데이터가
       늘면 언제든 생길 수 있는 값이라 여기서 막는다 */
    burn: a.inn > 0 ? a.out / a.inn : 0,
    usage: a.u.length > 0 ? a.u.reduce((s, v) => s + v, 0) / a.u.length : 0,
  }));
}

const W = 340, H = 256, PAD_B = 28;

export function MonthlyPanel() {
  const months = byMonth();
  const peak = Math.max(1, ...months.flatMap((m) => [m.inn, m.out]));
  const n = months.length;

  /* 한 달 자리 안에 막대 둘. 자리 폭의 절반쯤을 막대에 쓰고 나머지를 여백으로 둔다 —
     꽉 채우면 달과 달의 경계가 사라져 막대 여섯 개가 한 줄로 보인다 */
  const slot = W / n;
  const bar = Math.min(44, slot * 0.34);
  const nf = (v: number) => v.toLocaleString();

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden px-1 py-1">
      <div className={`${w98.sunken} flex min-h-0 flex-1 flex-col justify-between bg-white px-3 py-2.5`}>
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-[15px] font-semibold" style={{ color: INK }}>월별 입고 · 출고</span>
          <span className="text-[11px]" style={{ color: MUTED }}>2024-08 ~ 10</span>
        </div>

        <div className="mt-1.5 flex items-center gap-4 text-[12px]" style={{ color: MUTED }}>
          <span className="flex items-center gap-1.5">
            <span className="size-[9px] rounded-[2px]" style={{ background: FILL }} />입고
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-[9px] rounded-[2px]" style={{ background: FILL_WEAK }} />출고
          </span>
        </div>

        <svg viewBox={`0 0 ${W} ${H}`} className="mt-2 w-full" role="img" aria-label="월별 입고 출고">
          {months.map((m, i) => {
            const cx = slot * (i + 0.5);
            const h = H - PAD_B;
            const hi = (m.inn / peak) * (h - 22);
            const ho = (m.out / peak) * (h - 22);
            return (
              <g key={m.key}>
                <rect x={cx - bar - 1.5} y={h - hi} width={bar} height={hi} fill={FILL} rx="2" />
                <rect x={cx + 1.5} y={h - ho} width={bar} height={ho} fill={FILL_WEAK} rx="2" />
                {/* 값은 막대 **위에** 적는다. 안에 넣으면 짧은 막대에서 글자가 삐져나온다 */}
                <text x={cx - bar / 2 - 1.5} y={h - hi - 5} textAnchor="middle" fontSize="12" fill={FAINT}>
                  {nf(m.inn)}
                </text>
                <text x={cx + bar / 2 + 1.5} y={h - ho - 5} textAnchor="middle" fontSize="12" fill={FAINT}>
                  {nf(m.out)}
                </text>
                <text x={cx} y={H - 4} textAnchor="middle" fontSize="16" fill={INK} fontWeight="600">
                  {m.label}
                </text>
              </g>
            );
          })}
          <line x1="0" x2={W} y1={H - PAD_B} y2={H - PAD_B} stroke={RULE} strokeWidth="1" />
        </svg>
      </div>

      {/* ── 소진율 ──
          출고 ÷ 입고. 100% 가 기준선이고, 못 넘으면 그만큼 창고에 쌓인다.
          ⚠️ 막대를 **150% 자**로 그린다. 100% 를 끝으로 잡으면 넘긴 달이 눈금 밖으로 나가
             "얼마나 넘었나"가 사라진다. */}
      <div className={`${w98.sunken} shrink-0 bg-white px-3 py-2.5`}>
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-[15px] font-semibold" style={{ color: INK }}>소진율</span>
          <span className="text-[11px]" style={{ color: MUTED }}>출고 ÷ 입고</span>
        </div>

        <div className="mt-2.5 flex flex-col gap-3">
          {months.map((m) => {
            const pct = m.burn * 100;
            const piling = pct < 100;   // 못 빼낸 만큼 쌓인다
            return (
              <div key={m.key}>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[13px]" style={{ color: MUTED }}>{m.label}</span>
                  <span className="flex items-baseline gap-1.5">
                    {/* ⚠️ 강조를 **굵기와 크기**로 준다. 쌓이는 달이 이 칸에서 눈에 걸려야 할
                        것이라, 그 달만 한 호수 크고 굵다 — 색을 안 쓰기로 했으므로 이것이
                        유일한 강조 수단이다. */}
                    <span
                      className={`font-mono leading-none tabular-nums ${
                        piling ? "text-[24px] font-bold" : "text-[20px] font-medium"
                      }`}
                      style={{ color: piling ? INK : MUTED }}
                    >
                      {pct.toFixed(0)}%
                    </span>
                    {/* 무슨 뜻인지 글자로 적는다 — 색이 없으니 이 말이 곧 범례다 */}
                    <span
                      className={`text-[11px] ${piling ? "font-semibold" : ""}`}
                      style={{ color: piling ? INK : FAINT }}
                    >
                      {piling ? "쌓임" : "빠짐"}
                    </span>
                  </span>
                </div>
                <div className={`${w98.sunken} relative mt-1.5 h-[9px] w-full`} style={{ background: TRACK }}>
                  <div
                    className="h-full"
                    style={{ width: `${Math.min(100, (pct / 150) * 100)}%`, background: piling ? FILL : FILL_WEAK }}
                  />
                  {/* 100% 기준선 */}
                  <span
                    className="absolute top-[-3px] h-[14px] w-px"
                    style={{ left: `${(100 / 150) * 100}%`, background: INK }}
                    aria-hidden
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── 재고 순증 ──
          표로 두면 숫자가 작아진다. 세 달을 **카드 셋**으로 펴서 한눈에 크기를 견주게 한다 */}
      <div className={`${w98.sunken} shrink-0 bg-white px-3 py-2.5`}>
        <div className="text-[15px] font-semibold" style={{ color: INK }}>재고 순증</div>
        {/* ★ 회색 판 위에 회색 글씨였다 (사용자 지적 — 또렷하지 않다). 세 가지가 겹쳤다:
              1. 흰 상자 안에 다시 **옅은 회색 판**을 깔아 글자와 바탕의 차이가 좁았다
              2. 달 이름과 사용률이 12px·11px 로 작은데 색까지 흐렸다
              3. 줄어든 달의 숫자를 일부러 흐리게 두었더니 "덜 중요한 것"이 아니라
                 **인쇄가 덜 된 것**으로 보였다
            지금은 판을 걷고 흰 바탕에 세로 실선으로만 나눈다. 숫자는 **셋 다 진하게** 쓰고,
            차이는 굵기(bold / semibold)로만 준다. */}
        <div className="mt-2.5 flex">
          {months.map((m, i) => (
            <div
              key={m.key}
              className="min-w-0 flex-1 px-3"
              style={{ borderLeft: i > 0 ? `1px solid ${RULE}` : undefined }}
            >
              <div className="text-[13px]" style={{ color: MUTED }}>{m.label}</div>
              {/* 늘었는지 줄었는지는 **부호**가 말한다. 쌓인 달만 굵게 — 색은 쓰지 않는다 */}
              <div
                className={`mt-1 font-mono text-[21px] leading-none tabular-nums ${
                  m.net > 0 ? "font-bold" : "font-semibold"
                }`}
                style={{ color: INK }}
              >
                {m.net >= 0 ? "+" : "−"}{nf(Math.abs(m.net))}
              </div>
              <div className="mt-1.5 text-[12px]" style={{ color: MUTED }}>
                사용률 {m.usage.toFixed(1)}%
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
