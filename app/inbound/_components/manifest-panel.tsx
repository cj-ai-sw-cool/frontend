"use client";

import { Fragment } from "react";
import type { Product, ScanResponse } from "@/lib/types";
import { Panel, Sunken, w98 } from "./win98-ui";

/**
 * 1-1 응답 표시 — 목업의 `Product Manifest` 패널.
 *
 * ★ 아래에 붙어 있던 `Product Photo`(마스터 이미지) 칸을 **Visual Inspection 으로 옮겼다**
 *   (사용자 결정). 이 자리는 촬영 직후 뜨는 취급 주의사항 창이 서는 곳이 됐다.
 *   그래서 이 패널은 다시 텍스트 명세 하나만 갖고, 남는 세로를 전부 먹는다.
 *
 * 목업은 읽기 전용 textarea 에 `ITEM ID / DESC / DEST / ROUTING / PRIORITY` 를 찍고
 * 마지막 줄에 `> WAITING FOR CONFIRMATION...` 을 둔다. 그 **텍스트 단말 표현**을 그대로
 * 쓰되, 항목은 우리 계약이 실제로 주는 값으로 바꿨다.
 *
 * ⚠️ 목업의 DEST / ROUTING / PRIORITY 는 우리 계약에 없다(§1-1 은 상품 마스터만 준다).
 *    있는 척 채우면 시연 중에 "저 값은 뭐냐"는 질문에 답할 수 없어서, 실제로 있는
 *    GTIN·분류·재고·치수 상태로 갈아 끼웠다.
 *
 * ★ 이 칸이 우측 열에서 **유일하게 늘어나는 칸**이다 (사용자 결정) — 목업의 고정 140px 대신
 *   남는 세로를 전부 먹는다. 곧 제품 정보에 **사진 업로드**가 붙을 예정이고, 그때 자리를
 *   새로 만드는 게 아니라 이미 확보된 이 칸을 나눠 쓰면 되도록 미리 키워 둔 것이다.
 *   ⚠️ 그래서 내용이 짧아도 칸은 크다. 지금은 빈 아래쪽이 남는 게 정상이다.
 *
 * ★ **`min-h` 를 얹었다** (우측 열 잘림 수정, Stage 3). Stage 3 가 우측 열에 "미검수 품목" ·
 *   "검수 입력" 칸을 새로 얹으면서 고정 높이 예산을 넘겼고, `flex-1` 만으로는 이 칸이
 *   바닥날 때까지 눌려 품목명 한 줄만 남고 잘렸다(사용자 보고). `min-h` 는 품목명(2줄) +
 *   ITEM ID·GTIN·CLASS·STOCK·DIM 다섯 줄이 잘리지 않는 바닥선이다 — 남는 세로를 먹는
 *   성질(`flex-1`)은 그대로 두고, 그 아래로는 못 내려가게만 막는다.
 *   ⚠️ 글자 크기·줄 간격(`leading-*`)은 그대로 뒀다 — 여러 차례 사용자 확인을 거친 값이라
 *      이 수정에서 건드리지 않는다. 대신 표의 줄 사이 여백(`gap-y-1.5` → `gap-y-1`)과
 *      구분선 여백(`my-2` → `my-1.5`)만 줄여 자리를 보탰다.
 *
 * ★ 분류는 **읽기 전용**이다 (D-21). 1-2 `POST /inbound/products` 와 1-7 `GET /categories` 가
 *   v0.5 에서 삭제되어 작업자가 분류를 고르는 UI 도 수기 등록 폼도 없다.
 *   UNKNOWN 은 안내 후 흐름 종료다.
 */
export function ManifestPanel({
  result,
  isPending,
  stockLabel,
  right,
}: {
  result?: ScanResponse;
  isPending: boolean;
  /**
   * STOCK 줄에 찍을 문구 — Stage 3부터 1-1 응답의 `product.stockQty`(전역 재고, T5)는 쓰지
   * 않는다(정본 §3.6). 선택한 ASN의 화주 기준으로 `GET /stock?seller&gtin` 합을 page.tsx 가
   * 계산해 이 문자열로 넘긴다. ASN을 아직 안 골랐으면 그 사정을 이 문자열이 말한다.
   */
  stockLabel: string;
  /** 제목 줄 오른쪽에 놓을 것 — 지금은 취급 주의사항 창을 여는 버튼이 들어온다 */
  right?: React.ReactNode;
}) {
  /* ★ **바코드를 찍기 전에는 품목명 한 줄만 둔다** (사용자 결정 — 대기 화면을 깨끗하게).
       전에는 `ITEM ID --` 부터 `> WAITING FOR SCAN...` 까지 여섯 줄이 전부 `--` 로 차 있었다.
       빈 값을 줄 수만큼 늘어놓으면 "아직 아무것도 없다"가 아니라 "무언가 잘못됐다"로 읽힌다.
       칸의 높이는 어차피 flex-1 이라 줄을 지워도 레이아웃이 흔들리지 않는다.
     ⚠️ 기준은 `isPending` 이 아니라 **응답이 왔는가**다. 조회 중에도 표를 띄우면 `--` 여섯
        줄이 잠깐 지나가고, 그 깜빡임이 대기 화면을 지저분하게 만든 원인이었다. */
  const hasResult = result !== undefined;
  const status = hasResult ? buildStatus(result) : null;

  return (
    <Panel
      title="상품 정보"
      right={right}
      className="min-h-[300px] flex-1 shrink-0"
      bodyClassName="min-h-0 gap-2"
    >
      {/* 위 — 텍스트 명세. 남는 세로를 여기가 먹는다 */}
      <Sunken className={`${w98.scroll} min-h-0 flex-1 overflow-y-auto p-1`}>
        {/* ★ **품목명만 따로 뽑아 맨 위에 크게 둔다** (사용자 결정 — "우선순위가 필요해").
            여섯 줄이 전부 같은 크기·굵기·색이라 눈이 값을 골라내지 못했다. 그중 작업자가
            실제로 확인하는 건 "지금 든 게 무슨 물건인가" 하나인데, 그게 ITEM ID 와 동급으로
            묻혀 있었다. 전부 키우는 대신 **한 줄만 올려** 나머지를 배경으로 내린다.
            ⚠️ 모노를 쓰지 않는다. Courier Prime 에는 한글이 없어 값이 맑은 고딕으로 떨어지고,
               그러면 공백으로 맞춘 `:` 세로줄이 한글 줄에서만 어긋나 오히려 지저분해진다.
               품목명은 거의 항상 한글이라 처음부터 본문 폰트로 두는 편이 깔끔하다.
            ⚠️ `break-keep` — 한글은 단어 중간에서 끊기면 읽기 나쁘다. 어절 단위로만 넘긴다. */}
        <ProductName product={result?.product ?? null} isPending={isPending} />
        {hasResult ? (
          <>
          <div className={`${w98.etched} my-1`} />

          {/* ★ **공백으로 맞추던 정렬을 진짜 2단 표로 바꿨다** (사용자 결정 —
                "글씨끼리 여백을 붙이고 글씨 크기를 키우는 게 가독성 좋을 듯").

              전에는 `GTIN   : 8801234567893` 처럼 라벨 뒤에 공백을 채워 `:` 를 세로로 맞췄다.
              그 공백이 실제로 **화면 폭을 먹는다** — 가장 긴 라벨(ITEM ID)에 맞춰 모든 줄이
              7칸을 잡고 있었고, `:` 앞뒤 여백까지 더하면 한 줄에서 9칸이 빈칸이었다.
              글자를 키우면 그 빈칸도 같이 커져서 20px 이 폭의 한계였다(22px 에서 DIM 줄이
              두 줄로 접혔다).

              표로 바꾸면 라벨 칸이 **가장 긴 라벨 딱 그만큼**만 차지하고(`auto`), 남는 폭은
              전부 값으로 간다. 그 덕에 같은 칸에서 20 → **22px** 로 올라갔다.
              ⚠️ 라벨과 값 사이는 `gap-x-3`(12px). 공백 두 칸(약 26px)보다 좁으면서도 두 열이
                 붙어 보이지 않는 최소치다.
              ⚠️ 모노는 그대로 둔다. GTIN·재고가 숫자라 자릿수가 세로로 맞아야 한다.
              ⚠️ 라벨 색을 낮춘다. 크기를 키울수록 라벨이 값만큼 강해져서, 색까지 같으면
                 어느 쪽이 값인지 눈이 매번 다시 찾는다. */}
          {/* ★ **모노를 뺐다** (사용자 요청 — 이 화면 글씨를 다 같은 고딕으로).
              Roboto Mono 에는 한글이 없어서 `음료 / 과채주스` 같은 값만 맑은 고딕으로
              떨어졌다. 한 줄 안에서 서체가 갈리니 글자 굵기도 자간도 어긋나 보였다.
              본문 서체로 통일하면 라벨·값·한글이 전부 같은 글꼴이 된다.
              ⚠️ 대신 `tabular-nums` 를 건다. 모노를 포기하면 숫자 폭이 글자마다 달라져
                 GTIN·재고의 자릿수가 세로로 안 맞는데, 이 설정이 숫자만 고정폭으로 만든다.
                 모노가 이 칸에서 실제로 하던 일이 그것 하나였다. */}
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-0.5 text-[22px] leading-7 font-bold tabular-nums">
            {buildRows(result, isPending, stockLabel).map((row) => (
              <Fragment key={row.label}>
                <dt className="text-[color:var(--muted-foreground)]">{row.label}</dt>
                <dd className="break-keep">
                  {/* 값은 검정, **뜻을 덧붙이는 부분만 파랑** (사용자 결정).
                      분류와 치수 확정 여부는 "이 상품이 어떤 상태인가"를 말하는 값이라,
                      번호·수량과 같은 검정으로 두면 눈에 안 걸린다. */}
                  {row.accent === true ? (
                    <span className="text-[color:var(--primary)]">{row.value}</span>
                  ) : (
                    row.value
                  )}
                  {row.note === undefined ? null : (
                    <span className="ml-2 text-[color:var(--primary)]">{row.note}</span>
                  )}
                </dd>
              </Fragment>
            ))}
          </dl>

          {/* 상태 줄 — 값이 아니라 **지금 무슨 상태인가**를 말한다.
              표 안에 넣지 않는 이유: 라벨-값 짝이 아니라서 2단에 넣으면 한쪽 칸이 비고,
              빈 칸이 생기면 표가 무너져 보인다. */}
          {status === null ? null : (
            <p
              className="mt-4 text-[18px] leading-6 font-bold break-keep whitespace-pre-line"
            >
              {status}
            </p>
          )}
          </>
        ) : null}
      </Sunken>
    </Panel>
  );
}

/** 맨 위 큰 줄 — 이 화면에서 가장 먼저 읽혀야 하는 값 하나 */
/**
 * 품목명을 **상품**과 **규격**으로 가른다: "하이트진로(주) 테라" / "1600mL x 1페트".
 *
 * ★ 그냥 두면 칸 너비에 걸리는 아무 데서나 넘어간다 — 실제로 "... 1600mL x" 에서 끊기고
 *   "1페트" 만 다음 줄에 남았다 (사용자 지적). 규격은 한 덩어리라 쪼개지면 읽기 나쁘다.
 * ★ 가르는 자리는 **첫 숫자 토큰 앞**이다. 상품 이름은 글자로 시작하고 규격은 수량·용량
 *   으로 시작하므로, 그 경계가 곧 이름과 규격의 경계다:
 *     농심 누들핏 카구리맛 | 40.5g      오리온 오뜨 치즈 | 12p
 * ⚠️ 앞이 비면(이름이 숫자로 시작) 가르지 않는다. 규격만 남고 이름이 사라진다.
 * ⚠️ 짧은 이름은 그대로 둔다. 어차피 한 줄에 들어가는데 억지로 나누면 허전해진다.
 */
function splitName(name: string): [string, string | null] {
  if (name.length < 12) return [name, null];
  const parts = name.split(/\s+/);
  const at = parts.findIndex((p) => /^[0-9]/.test(p));
  if (at <= 0) return [name, null];
  return [parts.slice(0, at).join(" "), parts.slice(at).join(" ")];
}

function ProductName({ product, isPending }: { product: Product | null; isPending: boolean }) {
  const name = isPending ? "SCANNING…" : (product?.name ?? "--");
  const isPlaceholder = !isPending && product === null;
  /* 자리표시자(`--`·`SCANNING…`)는 가르지 않는다 — 규격이 없는 문자열이다 */
  const [head, spec] = isPlaceholder || isPending ? [name, null] : splitName(name);

  return (
    <div className="shrink-0">
      {/* ★ 라벨을 흐린 회색 13px → **본문색 14px 굵게** (사용자 지적 — 안 보였다).
          라벨이 흐리면 값과의 짝이 안 읽혀서, 큰 글자만 덩그러니 떠 있는 것처럼 보인다. */}
      <span className="block text-[15px] font-bold text-[color:var(--foreground)]">품목명</span>
      <span
        /* ★ 21 → 23 → **27px**, 거기에 `-webkit-text-stroke` 로 획을 한 번 더 두껍게 한다
             (사용자 지적 — 더 굵게).
           ⚠️ `font-weight` 를 더 올릴 수는 없다. 이 이름은 거의 항상 한글이라 맑은 고딕으로
              폴백되는데, 맑은 고딕은 Regular/Bold 두 종뿐이라 800·900 을 줘도 Bold 에서
              멈춘다. 획 자체를 굵히는 text-stroke 만이 여기서 더 굵어지는 유일한 방법이다.
           ⚠️ 0.4px 을 넘기지 않는다. 그 이상이면 한글 자모 사이가 메워져 뭉개진다 —
              취급 주의사항의 빨간 글씨(`checkedNeon`)에서 이미 찾아 둔 값이다. */
        style={{ WebkitTextStroke: "0.4px currentColor" }}
        className={`block text-[27px] leading-9 font-bold break-keep ${
          isPlaceholder ? "text-[color:var(--muted-foreground)]" : ""
        }`}
        title={product?.name}
      >
        {head}
        {/* 규격은 **줄을 바꿔** 붙인다. 같은 크기·굵기라 한 이름의 두 줄로 읽힌다 */}
        {spec !== null && <span className="block">{spec}</span>}
      </span>
    </div>
  );
}

/** 표에 찍을 라벨-값 짝. 상태 줄(`> …`)은 따로 만든다 — 짝이 아니라 문장이라서다 */
function buildRows(
  result: ScanResponse | undefined,
  isPending: boolean,
  stockLabel: string,
): { label: string; value: string; accent?: boolean; note?: string }[] {
  const product = isPending ? null : (result?.product ?? null);

  if (product === null) {
    /* 값이 없을 때도 **줄 수는 그대로** 둔다. 스캔할 때마다 칸 높이가 들썩이면 아래
       사진 자리까지 같이 움직여서 화면이 불안해 보인다. */
    return ["ITEM ID", "GTIN", "CLASS", "STOCK", "DIM"].map((label) => ({ label, value: "--" }));
  }

  const isRegistered = result?.judgment === "REGISTERED";

  return [
    { label: "ITEM ID", value: String(product.productId) },
    { label: "GTIN", value: product.gtin },
    {
      label: "CLASS",
      value: `${product.categoryL} / ${product.categoryM}`,
      accent: true,
    },
    { label: "STOCK", value: stockLabel },
    {
      label: "DIM",
      value: product.dimStatus,
      note: isRegistered ? "(치수 확정)" : "(치수 미확정)",
    },
  ];
}

/** 표 아래 문장. **응답이 온 뒤에만** 부른다 — 대기 중에는 이 칸 자체가 없다 */
function buildStatus(result: ScanResponse): string | null {
  if (result.product === null) {
    /* UNKNOWN — 코리안넷 마스터에 없는 상품. 입고 대상이 아니라 여기서 흐름이 끝난다 (D-21) */
    return [
      "> UNKNOWN — 코리안넷 마스터에 없는 상품",
      "> 입고 대상이 아닙니다. 바코드를 다시 확인하세요.",
    ].join("\n");
  }
  return null;
  /* ⚠️ `> REGISTERED — 촬영 없이…` 같은 **행동 안내는 여기서 뺐다** (사용자 결정).
     이 칸은 상품이 무엇인지 적는 자리이고, 지금 무엇을 해야 하는지는 측정 패널 위의
     한 줄이 말한다(measurement-panel.tsx). 두 곳이 나눠 맡으니 각자 짧아진다. */
}
