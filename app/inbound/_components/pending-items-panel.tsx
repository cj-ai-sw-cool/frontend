"use client";

import type { PendingReceiptItem } from "@/lib/types";
import { Panel, Sunken, w98 } from "./win98-ui";

/**
 * 미검수 품목 목록 — 도착 처리로 연 receipt에서 아직 검수 입력이 안 된 ASN 품목이다
 * (`GET /receipts/{id}/pending-items`, 정본 §3.5·§3.6).
 *
 * 예전 바코드 패널의 `다음 바코드`(시연용 자동 발급) 버튼이 "후계 기능이 올 자리"로 남겨
 * 뒀던 것의 실제 후계다(barcode-panel.tsx 참고, 그 버튼은 이 패널이 생기면서 지웠다).
 * 품목을 클릭하면 그 GTIN으로 1-1 스캔을 실행한다 — 작업자가 바코드를 직접 치지 않아도 된다.
 *
 * ★ 목록 칸 높이를 고정하고 내부 스크롤을 둔다 — 품목이 몇 개든 이 칸은 커지지 않는다.
 *   Stage 3 가 이 칸과 "검수 입력" 칸을 우측 열에 새로 얹으면서 고정 높이 예산을 넘겨,
 *   그 아래 "상품 정보" 칸이 세로로 눌려 잘리는 문제가 났다(사용자 보고). "상품 정보"는
 *   항상 전부 보여야 하는 칸이라 이 칸 쪽을 낮춰 자리를 돌려준다.
 */
export function PendingItemsPanel({
  items,
  isLoading,
  selectedAsnItemId,
  onSelect,
  disabled,
}: {
  items: PendingReceiptItem[];
  isLoading: boolean;
  selectedAsnItemId: number | null;
  onSelect: (item: PendingReceiptItem) => void;
  disabled: boolean;
}) {
  return (
    <Panel title="미검수 품목" className="h-[76px] shrink-0" bodyClassName="min-h-0">
      <Sunken className={`${w98.scroll} min-h-0 flex-1 overflow-y-auto`}>
        {isLoading ? (
          <p className={`${w98.small} p-1 text-[color:var(--muted-foreground)]`}>불러오는 중…</p>
        ) : items.length === 0 ? (
          <p className={`${w98.small} p-1 text-[color:var(--muted-foreground)]`}>
            이 receipt의 품목을 모두 검수했습니다.
          </p>
        ) : (
          <ul>
            {items.map((item) => (
              <li key={item.asnItemId}>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => onSelect(item)}
                  aria-current={selectedAsnItemId === item.asnItemId ? "true" : undefined}
                  className={`flex w-full items-center justify-between gap-2 border-b border-[color:var(--surface-dim)] px-1.5 py-0.5 text-left text-[13px] disabled:opacity-60 ${
                    selectedAsnItemId === item.asnItemId ? "bg-[color:var(--surface-variant)]" : ""
                  }`}
                >
                  <span className="truncate" title={item.productName}>
                    {item.productName}
                  </span>
                  <span className={`${w98.mono} shrink-0 tabular-nums`}>{item.expectedQty}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Sunken>
    </Panel>
  );
}
