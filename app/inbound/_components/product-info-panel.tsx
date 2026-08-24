"use client";

import { CircleAlert } from "lucide-react";
import type { ScanJudgment, ScanResponse } from "@/lib/types";

/**
 * 제품 정보 — docs/02-api-spec.md §1-1 응답의 "1단 표시 데이터" 그 자체다.
 * 디자인 확정본 우측 컬럼 두 번째 패널(body.html 190~197행). 높이는 flex-1(≈380px).
 *
 * 순수 표시용(presentational): API 를 부르지 않는다.
 *
 * 아이콘 대응표 (확정본 Material Symbols → lucide-react)
 *   확정본 이 패널에는 아이콘이 없다. UNKNOWN 안내에만 lucide CircleAlert 를 새로 쓴다.
 *
 * ── ★ 계약 필수 UI ①: 1-1 판정 배지가 여기 있는 이유 ─────────────────────
 *   확정본에는 REGISTERED / NEW / UNKNOWN 표시가 없다(확정본은 분기를 그리지 않는다).
 *   이전 구현은 판정을 **전체 폭 카드 한 장**으로 뽑아 뒀는데, 확정본에는 그 자리가 없고
 *   940px 안에 새 행을 밀어 넣을 여유도 없다.
 *   판정은 결국 "지금 스캔한 이 상품이 어떤 상태냐"라서 상품 정보의 속성이다. 그래서 이
 *   패널의 헤더 우측에 배지로 붙였다 — 세로를 **0px** 더 먹고, 상품 이름 바로 위에 붙어
 *   "이 상품 = 이 판정"이 한눈에 묶인다. 확정본 좌측 측정 패널의 MEASURED 배지와 같은
 *   문법(같은 높이·테두리·글자 크기)이라 화면 안에서 규칙이 하나로 유지된다.
 *
 * ── ★ 계약 필수 UI ③: 분류는 읽기 전용 텍스트다 (D-21) ──────────────────
 *   v0.5 에서 1-2 `POST /inbound/products` 와 1-7 `GET /categories` 가 **삭제됐다.**
 *   분류를 작업자가 고르는 UI 는 만들지 않는다 — 표준 분류 체계가 오염되기 때문이다.
 *   여기서는 1-1 응답의 `categoryL` / `categoryM` 을 **보여주기만** 한다.
 *   이전 구현에 있던 대분류·중분류 Select 2개와 그 기본값을 채우던 이름→코드 역조회
 *   TODO(P1)는 이 결정으로 **소멸**했다(D-13 무효). 코드 자체를 화면이 다룰 일이 없어졌다.
 *
 * ── 사라진 칸에 대하여 ──────────────────────────────────────────────────
 *   이전 구현에는 "특이사항"·"등급" 입력칸이 잠긴 채 있었다(계약에 대응 필드가 없어서).
 *   확정본에는 그 자리가 아예 없고 940px 예산에도 들어가지 않아 화면에서 뺐다.
 *   ⚠️ **필드가 필요 없다고 결론난 게 아니다** — 저장 경로가 여전히 미정이다
 *      (① 상품 마스터에 넣기 ② 1-4 ConfirmRequest 확장 ③ 화면 전용).
 *      계약이 정해지면 이 패널이나 취급 주의사항 패널에 자리를 만들어야 한다.
 *
 * ── 세로 예산 (flex-1, 우측 컬럼 나머지 ≈380px) ─────────────────────────
 *   패딩 32 + 헤더 h-8(32) + gap-3(12) + 본문 flex-1(≈304)
 *   본문은 이미지 110px 칸과 텍스트 열이 나란히 서고, 텍스트 열은 세로 가운데 정렬이다.
 */
export function ProductInfoPanel({
  result,
  isPending,
}: {
  /** 1-1 응답. 아직 스캔 전이면 undefined */
  result?: ScanResponse;
  isPending: boolean;
}) {
  const product = result?.product ?? null;

  return (
    <section className="bg-accent p-panel-padding flex min-h-0 flex-1 flex-col gap-3 border-2">
      <div className="flex h-8 shrink-0 items-center justify-between gap-3">
        <h2 className="text-label-sm">제품 정보</h2>
        <JudgmentBadge judgment={result?.judgment} isPending={isPending} />
      </div>

      {product === null ? (
        <EmptyBody judgment={result?.judgment} isPending={isPending} />
      ) : (
        <div className="flex min-h-0 flex-1 gap-4">
          {/* 마스터 이미지 자리 — 확정본 191~193행.
              ⚠️ mock 의 `imageUrl` 은 전부 null 이고 외부 URL 은 금지라 img 를 걸지 않는다.
                 실제 이미지가 붙으면 여기만 img 로 바꾸면 된다(product-photo-panel.tsx 와 동일). */}
          <div className="bg-card text-muted-foreground flex w-[110px] shrink-0 items-center justify-center overflow-hidden border-2 p-2 text-center text-xs">
            {product.imageUrl === null ? "마스터 이미지 없음" : product.imageUrl}
          </div>

          <div className="flex min-w-0 flex-1 flex-col justify-center gap-2">
            {/* 상품 이름 — 확정본은 48px 이지만 40px 로 내렸다.
                확정본 목업의 이름은 "이금기굴소스"(6자)인데 실제 마스터 이름은
                "○○ 오렌지주스 500ml"처럼 훨씬 길다. 이 열의 폭은
                488 - 패딩 32 - 이미지 110 - gap 16 = 330px 이라 48px 로는 세 줄이 나서
                아래 분류·재고 줄을 밀어낸다. 40px + 두 줄 제한이면 최대 88px 로 묶인다. */}
            <span className="line-clamp-2 text-[40px] leading-[44px] font-bold tracking-[-0.01em] break-keep">
              {product.name}
            </span>

            {/* ★ 분류 — 읽기 전용 (D-21). 위 주석 ③ 참고 */}
            <span className="text-label-sm text-muted-foreground truncate">
              {product.categoryL} · {product.categoryM}
            </span>

            <span className="text-label-sm text-muted-foreground truncate tabular-nums">
              {product.gtin} · 현재 재고 {product.stockQty}개 ·{" "}
              {product.dimStatus === "CONFIRMED" ? "치수 확정" : "치수 미확정"}
            </span>
          </div>
        </div>
      )}
    </section>
  );
}

/**
 * 스캔 전 / UNKNOWN 일 때의 본문.
 *
 * ⚠️ UNKNOWN 은 **안내하고 흐름을 종료**한다 (D-21, 02 §1-1).
 *    수기 등록 폼도 분류 선택 UI 도 만들지 않는다 — 마스터에 없는 바코드는 입고 대상이
 *    아니라는 팀 합의다. 이전 구현의 "1-2 수기 등록 폼" TODO(P1)는 이 결정으로 소멸했다.
 */
function EmptyBody({ judgment, isPending }: { judgment?: ScanJudgment; isPending: boolean }) {
  if (isPending) {
    return (
      <div className="text-muted-foreground text-sub-action-md flex min-h-0 flex-1 items-center justify-center">
        조회 중…
      </div>
    );
  }

  if (judgment === "UNKNOWN") {
    return (
      <div
        role="alert"
        className="text-status-error flex min-h-0 flex-1 flex-col items-center justify-center gap-3 text-center"
      >
        <CircleAlert className="size-10" aria-hidden />
        <span className="text-sub-action-md font-bold">코리안넷 마스터에 없는 상품</span>
        <span className="text-label-sm">
          입고 대상이 아닙니다. 바코드를 다시 확인하거나 다음 상품으로 넘어가세요.
        </span>
      </div>
    );
  }

  return (
    <div className="text-muted-foreground text-sub-action-md flex min-h-0 flex-1 items-center justify-center">
      바코드를 스캔하세요
    </div>
  );
}

/**
 * 1-1 판정 배지 — 계약 필수 UI ① (파일 상단 주석).
 * 좌측 측정 패널의 상태 배지와 **같은 문법**을 쓴다: h-8 · 1px 테두리 · text-label-sm · px-4.
 * 두 배지가 같은 규칙이라 화면을 가로질러 "배지 = 서버가 내린 판정"으로 읽힌다.
 */
function JudgmentBadge({ judgment, isPending }: { judgment?: ScanJudgment; isPending: boolean }) {
  const { tone, label } = describeJudgment(judgment, isPending);
  return (
    <span
      className={`text-label-sm flex h-8 shrink-0 items-center border px-4 ${
        tone === "ok"
          ? "bg-primary text-primary-foreground"
          : tone === "error"
            ? "bg-status-error text-primary-foreground"
            : tone === "info"
              ? "bg-secondary text-secondary-foreground"
              : "bg-card text-muted-foreground"
      }`}
    >
      {label}
    </span>
  );
}

/**
 * 세 갈래의 뜻 (§1-1). 판정 자체는 서버가 내리므로 화면에서 다시 계산하지 않는다.
 *   REGISTERED 마스터 O + 치수 O → 촬영 없이 바로 1-5 수량 입고
 *   NEW        마스터 O + 치수 X → 촬영·추론(1-3) → 확정(1-4) → 입고(1-5)
 *   UNKNOWN    마스터 X          → 안내 후 종료 (D-21)
 */
function describeJudgment(
  judgment: ScanJudgment | undefined,
  isPending: boolean,
): { tone: "ok" | "info" | "error" | "idle"; label: string } {
  if (isPending) return { tone: "idle", label: "SCANNING…" };
  if (judgment === undefined) return { tone: "idle", label: "NO SCAN" };
  if (judgment === "REGISTERED") return { tone: "ok", label: "REGISTERED · 치수 O" };
  if (judgment === "NEW") return { tone: "info", label: "NEW · 치수 X" };
  return { tone: "error", label: "UNKNOWN · 미등록" };
}
