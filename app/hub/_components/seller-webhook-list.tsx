"use client";

/**
 * "화주" 탭 좌측 — 화주 목록(정본 §14.8, 브리프 §2 상단 "코드·이름·상태·키 개수·엔드포인트
 * 개수·DEAD 건수 배지"). `GET /sellers`(라이브)와 `GET /admin/webhooks/summary`(엔드포인트
 * 별, 목/라이브)를 화주 코드로 합친다. 키 개수는 요약에 없어(정본 §14.5는 엔드포인트
 * 집계만 준다) 행마다 `useApiKeys`를 따로 불러 센다 — 행 하나가 컴포넌트 하나라 훅을
 * 반복문 밖에서 부르는 규칙을 어기지 않는다.
 */

import type { Seller, WebhookSummaryRow } from "@/lib/types";
import { useApiKeys } from "../_data/use-webhooks";
import { Btn, Panel, Sunken, w98 } from "./win98-ui";

export function SellerWebhookList({
  sellers,
  summaryBySeller,
  selectedCode,
  onSelect,
}: {
  sellers: Seller[];
  summaryBySeller: Map<string, WebhookSummaryRow[]>;
  selectedCode: string | null;
  onSelect: (code: string) => void;
}) {
  return (
    <Panel title="화주 목록" className="h-full w-64 shrink-0" bodyClassName="min-h-0">
      <Sunken className={`${w98.scroll} min-h-0 flex-1 overflow-y-auto`}>
        <ul className="flex flex-col">
          {sellers.map((seller) => (
            <SellerRow
              key={seller.code}
              seller={seller}
              rows={summaryBySeller.get(seller.code) ?? []}
              selected={seller.code === selectedCode}
              onSelect={() => onSelect(seller.code)}
            />
          ))}
        </ul>
      </Sunken>
    </Panel>
  );
}

function SellerRow({
  seller,
  rows,
  selected,
  onSelect,
}: {
  seller: Seller;
  rows: WebhookSummaryRow[];
  selected: boolean;
  onSelect: () => void;
}) {
  const { data: keys } = useApiKeys(seller.code);
  const activeKeyCount = (keys ?? []).filter((k) => k.revokedAt === null).length;
  const deadCount = rows.reduce((sum, r) => sum + r.dead, 0);

  return (
    <li>
      <Btn
        pressed={selected}
        onClick={onSelect}
        className="flex w-full items-center justify-between gap-2 px-2 py-1.5 text-left"
      >
        <span className="flex min-w-0 flex-col items-start">
          <span className="truncate text-[13px] font-bold">
            {seller.name} <span className={w98.small}>({seller.status === "ACTIVE" ? "운영" : "정지"})</span>
          </span>
          <span className={`${w98.mono} ${w98.small} text-[color:var(--muted-foreground)]`}>
            {seller.code} · 키 {activeKeyCount} · 엔드포인트 {rows.length}
          </span>
        </span>
        {deadCount > 0 ? (
          <span className="shrink-0 bg-[color:var(--status-error)] px-1.5 py-0.5 text-[11px] font-bold text-white">
            DEAD {deadCount}
          </span>
        ) : null}
      </Btn>
    </li>
  );
}
