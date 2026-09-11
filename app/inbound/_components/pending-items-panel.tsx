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
    <Panel title="미검수 품목" className="h-28 shrink-0" bodyClassName="min-h-0">
      <Sunken className={`${w98.scroll} min-h-0 flex-1 overflow-y-auto`}>
        {isLoading ? (
          <p className={`${w98.small} p-1.5 text-[color:var(--muted-foreground)]`}>불러오는 중…</p>
        ) : items.length === 0 ? (
          <p className={`${w98.small} p-1.5 text-[color:var(--muted-foreground)]`}>
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
                  className={`flex w-full items-center justify-between gap-2 border-b border-[color:var(--surface-dim)] px-1.5 py-1 text-left text-[13px] disabled:opacity-60 ${
                    selectedAsnItemId === item.asnItemId ? "bg-[color:var(--surface-variant)]" : ""
                  }`}
                >
                  <span className="truncate" title={item.product.name}>
                    {item.product.name}
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
