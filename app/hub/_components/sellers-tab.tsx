"use client";

/**
 * 허브 "화주" 탭 — Stage 11C, 정본 §14.2·§14.5·§14.8, 브리프 §2.
 *
 * 3단: 좌 화주 목록(`seller-webhook-list.tsx`) → 중 API 키·엔드포인트 카드
 * (`webhook-keys-panel.tsx`·`webhook-endpoints-panel.tsx`, 선택된 화주 것만) → 하단
 * 전폭 발송 이력 표(`webhook-deliveries-panel.tsx`). 상단 띠는 `GET /admin/events/relay`
 * (릴레이 lag·브로커 꺼짐)와 요약 합계(pending/retry/dead)를 보여준다. 이 탭이 선택
 * 상태를 통째로 들고 있다(`orders-tab.tsx`·`transfers-tab.tsx`와 같은 관례).
 */

import { useMemo, useState } from "react";
import type { WebhookSummaryRow } from "@/lib/types";
import { useSellers } from "../_data/use-hub";
import { useWebhookRelay, useWebhookSummary } from "../_data/use-webhooks";
import { SellerWebhookList } from "./seller-webhook-list";
import { WebhookDeliveriesPanel } from "./webhook-deliveries-panel";
import { WebhookEndpointsPanel } from "./webhook-endpoints-panel";
import { WebhookKeysPanel } from "./webhook-keys-panel";
import { TrayBox } from "./win98-ui";

export function SellersTab() {
  const { data: sellers, isLoading: sellersLoading } = useSellers();
  const summary = useWebhookSummary();
  const relay = useWebhookRelay();
  const [selectedCode, setSelectedCode] = useState<string | null>(null);

  const summaryBySeller = useMemo(() => {
    const map = new Map<string, WebhookSummaryRow[]>();
    for (const row of summary.data ?? []) {
      const list = map.get(row.sellerCode) ?? [];
      list.push(row);
      map.set(row.sellerCode, list);
    }
    return map;
  }, [summary.data]);

  const totals = useMemo(() => {
    const rows = summary.data ?? [];
    return rows.reduce(
      (acc, r) => ({ pending: acc.pending + r.pending, retry: acc.retry + r.retry, dead: acc.dead + r.dead }),
      { pending: 0, retry: 0, dead: 0 },
    );
  }, [summary.data]);

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <RelaySummaryBar relayEnabled={relay.data?.enabled ?? false} lagSec={relay.data?.lagSec ?? null} totals={totals} />

      <div className="flex min-h-0 flex-[3] gap-2">
        {sellersLoading ? (
          <span className="w-64 shrink-0 p-1 text-[13px] text-[color:var(--muted-foreground)]">
            화주 목록을 불러오는 중…
          </span>
        ) : (
          <SellerWebhookList
            sellers={sellers ?? []}
            summaryBySeller={summaryBySeller}
            selectedCode={selectedCode}
            onSelect={setSelectedCode}
          />
        )}

        <div className="flex min-h-0 flex-1 flex-col gap-2">
          {selectedCode === null ? (
            <span className="p-1 text-[13px] text-[color:var(--muted-foreground)]">
              좌측에서 화주를 선택하면 API 키·엔드포인트를 보여줍니다.
            </span>
          ) : (
            <>
              <WebhookKeysPanel sellerCode={selectedCode} />
              <WebhookEndpointsPanel sellerCode={selectedCode} />
            </>
          )}
        </div>
      </div>

      <div className="min-h-0 flex-[2]">
        <WebhookDeliveriesPanel sellerCode={selectedCode} />
      </div>
    </div>
  );
}

function RelaySummaryBar({
  relayEnabled,
  lagSec,
  totals,
}: {
  relayEnabled: boolean;
  lagSec: number | null;
  totals: { pending: number; retry: number; dead: number };
}) {
  return (
    <div className="flex shrink-0 items-center gap-2">
      {/* 브로커 없음은 로컬 기본 프로파일에서 흔한 상태라 경고색이 아니라 회색(TrayBox
          기본 톤)으로 둔다(브리프 §2 "회색 띠") — 빨강은 DEAD 처럼 실제로 조치가
          필요한 자리에만 쓴다 */}
      <TrayBox tone="normal" className="flex-1 text-[color:var(--muted-foreground)]">
        {relayEnabled
          ? `릴레이 정상${lagSec !== null ? ` · lag ${lagSec.toFixed(1)}s` : ""}`
          : "브로커 없음 — 릴레이·발송 정지"}
      </TrayBox>
      <TrayBox>대기 {totals.pending}</TrayBox>
      <TrayBox>재시도 {totals.retry}</TrayBox>
      <TrayBox tone={totals.dead > 0 ? "error" : "normal"}>DEAD {totals.dead}</TrayBox>
    </div>
  );
}
