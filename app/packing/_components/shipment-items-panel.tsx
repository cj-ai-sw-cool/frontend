"use client";

import { ApiError } from "@/lib/api";
import type { ShipmentItem } from "@/lib/types";
import { Btn, Panel, Sunken, w98 } from "./win98-ui";

/**
 * 3-2 품목 표 — win98 의 리스트 뷰 모양(파인 상자 + 회색 머리행 + 눌린 선택 행).
 *
 * ★ Stage 9 — 실수량 입력(D-06, 프론트 상태로만 존재하던 값)을 걷어내고 서버가 낱개 스캔으로
 *   센 `verifiedQty` 를 그대로 쓴다(정본 §9.3). "필요/스캔" 두 칸과 패널 머리의 진행 막대가
 *   그 값을 보여주고, 행마다 "파손 신고" 버튼이 붙는다.
 *
 * ⚠️ 스캔 오류(품목 아님/토트에 없음/초과)는 표 **바깥**, 표 아래 한 줄에 고정한다(정본 §9.4).
 *    표까지 같이 스크롤되면 품목이 많을 때 오류가 위로 밀려나 사라진다.
 * ⚠️ 품목 수는 정해져 있지 않다. 고정 스테이지에서는 넘치면 잘리므로 표만 안에서 스크롤한다.
 */
export function ShipmentItemsPanel({
  items,
  selectedProductId,
  onSelectProduct,
  onDamageReport,
  replenishPending,
  scanError,
  isLoading,
  hasShipment,
}: {
  items: ShipmentItem[];
  selectedProductId: number | null;
  onSelectProduct: (productId: number) => void;
  /** 행의 "파손 신고" 버튼 — 대화 상자를 연다(정본 §9.4) */
  onDamageReport: (item: ShipmentItem) => void;
  /** 보충 배치 처리 대기 중이면 "파손 신고"를 잠근다 — 이미 연 보충이 끝나기 전에 또
   * 신고하면 어느 건에 대한 처리인지 헷갈린다 */
  replenishPending: boolean;
  /** 품목 스캔 실패 — `NOT_IN_SHIPMENT`/`NOT_IN_TOTE`/`OVER_SCAN`(정본 §9.3) */
  scanError: Error | null;
  isLoading: boolean;
  hasShipment: boolean;
}) {
  /* verifiedQty 를 ?? 0 으로 방어한다 — 백엔드 롤아웃 순서가 보장되지 않아(S9.1이 아직 안
     떴을 수 있다) 필드가 비어 오면 undefined + undefined = NaN 이 되고, 그 NaN 이 진행
     막대 폭 클래스 계산까지 번져 막대가 "꽉 찬 것"처럼 보이는 사고로 이어진다
     (2026-09-12 라이브 대조에서 발견). */
  const totalNeed = items.reduce((sum, item) => sum + item.qty, 0);
  const totalVerified = items.reduce((sum, item) => sum + (item.verifiedQty ?? 0), 0);
  const allVerified = items.length > 0 && totalVerified === totalNeed;
  const scanErrorMessage = describeScanError(scanError);

  return (
    <Panel
      title="품목"
      right={
        hasShipment && items.length > 0 ? (
          <div className="flex shrink-0 items-center gap-2">
            <span
              className={`${w98.small} font-bold ${
                allVerified
                  ? "text-[color:var(--status-success)]"
                  : "text-[color:var(--muted-foreground)]"
              }`}
            >
              스캔 {totalVerified}/{totalNeed}
            </span>
            <div className={`${w98.sunken} h-3 w-28 overflow-hidden bg-[color:var(--surface-bright)]`}>
              <div
                className={`h-full bg-[color:var(--primary)] ${progressWidthClass(totalVerified, totalNeed)}`}
              />
            </div>
          </div>
        ) : undefined
      }
      className="min-h-0 flex-1"
    >
      <Sunken className={`${w98.scroll} min-h-0 flex-1 overflow-y-auto`}>
        {isLoading ? (
          <Placeholder>조회 중…</Placeholder>
        ) : !hasShipment ? (
          <div className="h-full" />
        ) : items.length === 0 ? (
          <Placeholder>이 배송단위에 품목이 없습니다</Placeholder>
        ) : (
          <table className="w-full table-fixed border-collapse">
            {/* win98 리스트 뷰의 머리행 — 튀어나온 회색 버튼처럼 생겼다 */}
            <thead className="sticky top-0 z-10">
              <tr className="bg-[color:var(--surface)]">
                <Th className="w-[38%]">제품</Th>
                <Th className="w-[10%] text-center">필요</Th>
                <Th className="w-[14%] text-center">스캔</Th>
                <Th className="w-[22%]">포장시 취급 주의</Th>
                <Th className="w-[16%]">동작</Th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const verifiedQty = item.verifiedQty ?? 0;
                const isComplete = verifiedQty === item.qty;
                const isSelected = item.productId === selectedProductId;

                return (
                  /* ★ 선택 강조를 **제품명 칸으로만** 좁혔다 (사용자 결정).
                     예전에는 행 전체가 네이비로 칠해지면서 글자가 흰색으로 뒤집혔는데,
                     그러면 GTIN·수량 같은 작은 글자가 오히려 안 읽혔고 그 행만 화면에서 튀었다.
                     이제 행은 조용하고, 강조는 실제로 고른 것(제품)에만 붙는다. */
                  <tr key={item.productId}>
                    <td className="border-b border-[color:var(--surface-variant)] px-1 py-2 align-middle">
                      {/* 제품 이름 자체가 "이 품목을 보겠다" 버튼이다.
                          행 전체에 onClick 을 걸면 오른쪽 버튼을 누를 때도 같이 눌리고,
                          키보드로는 아예 닿지 않는다. 진짜 버튼으로 두면 둘 다 해결된다. */}
                      <button
                        type="button"
                        aria-pressed={isSelected}
                        onClick={() => onSelectProduct(item.productId)}
                        title={item.name}
                        /* 고른 칸만 네이비로 채우고 왼쪽에 두꺼운 띠를 둔다.
                           띠가 있으면 표를 세로로 훑을 때 어느 줄을 보고 있었는지 바로 찾는다 */
                        className={`flex w-full min-w-0 flex-col gap-0.5 border-l-4 px-2 py-1 text-left ${
                          isSelected
                            ? "border-[#000040] bg-[color:var(--primary)] text-[color:var(--primary-foreground)]"
                            : "border-transparent"
                        }`}
                      >
                        <span className="block truncate text-[17px] leading-6 font-bold">{item.name}</span>
                        <span
                          className={`${w98.mono} block truncate text-[13px] leading-5 ${
                            isSelected ? "opacity-80" : ""
                          }`}
                        >
                          {item.gtin}
                        </span>
                      </button>
                    </td>
                    <td
                      className={`${w98.mono} border-b border-[color:var(--surface-variant)] px-1 py-2 text-center align-middle text-[22px] font-bold tabular-nums`}
                    >
                      {item.qty}
                    </td>
                    <td
                      className={`${w98.mono} border-b border-[color:var(--surface-variant)] px-1 py-2 text-center align-middle text-[22px] font-bold tabular-nums ${
                        isComplete ? "text-[color:var(--status-success)]" : ""
                      }`}
                    >
                      {verifiedQty}
                    </td>
                    <td
                      className="border-b border-[color:var(--surface-variant)] px-1 py-2 align-middle text-[13px]"
                    >
                      {item.handling.length > 0 ? (
                        /* ★ **버튼 모양(베벨) + 글자색**을 같이 쓴다 (사용자 결정).
                           색은 그대로 살린다: 냉장 = 파랑 · 파손주의 = 빨강 · 그 외 = 본문색.
                           ⚠️ 색만으로 뜻을 전하지는 않는다 — 글자가 그대로 있으므로 색을 못 보는
                              사람도 `냉장`/`파손주의` 를 읽을 수 있다. */
                        <div className="flex flex-wrap gap-1">
                          {item.handling.map((code) => (
                            <span
                              key={code}
                              className={`${w98.raised} bg-[color:var(--surface)] px-1.5 py-0.5 font-bold ${
                                HANDLING_COLOR[code] ?? "text-[color:var(--foreground)]"
                              }`}
                            >
                              {HANDLING_LABEL[code] ?? code}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-[color:var(--muted-foreground)]">해당 없음</span>
                      )}
                    </td>
                    <td className="border-b border-[color:var(--surface-variant)] px-1 py-2 align-middle">
                      <Btn
                        disabled={replenishPending}
                        onClick={() => onDamageReport(item)}
                        title={
                          replenishPending
                            ? "보충 처리 중에는 파손 신고를 할 수 없습니다"
                            : `${item.name} 파손 신고`
                        }
                        className={`${w98.small} h-7 w-full px-1 font-bold`}
                      >
                        파손 신고
                      </Btn>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Sunken>

      {/* 스캔 오류 — 품목 아님 / 토트에 없음 / 초과(정본 §9.3·§9.4). 표 스크롤과 자리를
          나눠 쓰지 않아 행이 많아도 사라지지 않는다. */}
      {scanErrorMessage ? (
        <p
          role="alert"
          title={scanErrorMessage}
          className={`${w98.small} mt-1 shrink-0 truncate font-bold text-[color:var(--status-error)]`}
        >
          {scanErrorMessage}
        </p>
      ) : null}
    </Panel>
  );
}

function Th({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <th
      className={`${w98.raised} bg-[color:var(--surface)] px-1 py-1 text-left font-normal ${className}`}
    >
      {children}
    </th>
  );
}

function Placeholder({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="flex h-full items-center justify-center p-4 text-center text-[13px] text-[color:var(--muted-foreground)]"
    >
      {children}
    </div>
  );
}

const HANDLING_LABEL: Record<string, string | undefined> = {
  REFRIGERATE: "냉장",
  FRAGILE: "파손주의",
  IRREGULAR: "비정형",
  LIQUID_CAUTION: "액체주의",
};

/**
 * 취급 속성별 글자색.
 * 놓치면 상품이 상하거나 깨지는 둘에만 색을 준다 — 전부 색칠하면 아무것도 강조되지 않는다.
 */
const HANDLING_COLOR: Record<string, string | undefined> = {
  REFRIGERATE: "text-[#0b3ea8]", // 냉장 — 차가운 쪽
  FRAGILE: "text-[color:var(--status-error)]", // 파손 주의 — 경고
};

/**
 * 진행 막대의 채움 폭 — 퍼센트를 그대로 style 로 넣지 않는다(inline style 금지, UI/UX
 * 규칙). 10% 단위로 반올림해 미리 만들어 둔 Tailwind 임의값 클래스 중 하나를 고른다 —
 * 클래스 문자열이 소스에 그대로 있어야 Tailwind 가 빌드에 포함시킨다.
 */
const PROGRESS_WIDTH_CLASS = [
  "w-0",
  "w-[10%]",
  "w-[20%]",
  "w-[30%]",
  "w-[40%]",
  "w-[50%]",
  "w-[60%]",
  "w-[70%]",
  "w-[80%]",
  "w-[90%]",
  "w-full",
] as const;

function progressWidthClass(verified: number, need: number): string {
  if (need <= 0 || !Number.isFinite(verified)) return "w-0";
  const ratio = Math.min(1, Math.max(0, verified / need));
  const step = Math.round(ratio * 10);
  return PROGRESS_WIDTH_CLASS[step];
}

/** 스캔 실패 안내 — 판별은 `ApiError.is()`(pack-actions.tsx 와 같은 관례) */
function describeScanError(error: Error | null): string | null {
  if (error === null) return null;
  if (error instanceof ApiError) {
    if (error.is("NOT_IN_SHIPMENT")) return "배송단위 품목이 아님";
    if (error.is("NOT_IN_TOTE")) return "토트에 없음";
    if (error.is("OVER_SCAN")) return "초과";
  }
  return error.message;
}
