"use client";

/**
 * "화주" 탭 좌측 — 화주 목록(정본 §14.8, 브리프 §2 상단 "코드·이름·상태·키 개수·엔드포인트
 * 개수·DEAD 건수 배지"). `GET /sellers`(라이브)와 `GET /admin/webhooks/summary`(엔드포인트
 * 별, 라이브)를 화주 코드로 합친다. 키 개수는 `GET /sellers`의 `apiKeyCount`를 그대로
 * 쓴다(백엔드 노트 §1.16) — 화주마다 `GET .../api-keys`를 따로 부르지 않는다.
 *
 * 패널 폭 `w-72`(288px) — `w-64`(256px)였을 때 "SEL-A · 키 2 · 엔드포인트 1" 같은 메타
 * 줄이 DEAD 배지와 좁아진 폭 안에서 단어 중간에 줄바꿈됐다(코디네이터 지적). `truncate`
 * 로 넘치면 말줄임표로 자르되, 이 폭에서는 실제로 넘치지 않는다.
 */

import type { Seller, WebhookSummaryRow } from "@/lib/types";
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
    <Panel title="화주 목록" className="h-full w-72 shrink-0" bodyClassName="min-h-0">
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
          <span className={`${w98.mono} ${w98.small} truncate whitespace-nowrap text-[color:var(--muted-foreground)]`}>
            {seller.code} · 키 {seller.apiKeyCount ?? 0} · 엔드포인트 {rows.length}
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
