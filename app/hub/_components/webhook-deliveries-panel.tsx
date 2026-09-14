"use client";

/**
 * "화주" 탭 — 발송 이력 표 — 정본 §14.5·§14.8, 브리프 §2 하단 "seq·유형·엔드포인트·
 * 상태·시도·마지막 응답코드·다음 시도·시각. 상태 필터. DEAD 행 재시도. 행 클릭 →
 * payload JSON 접기/펼치기. 10초 폴링"(폴링 자체는 `useWebhookDeliveries` 안에 있다).
 */

import { Fragment, useState } from "react";
import { toast } from "sonner";
import { w98Toast } from "@/lib/win98-toast";
import type { WebhookDeliveryStatus } from "@/lib/types";
import { formatKst, Th, Td } from "./table";
import { useRetryDelivery, useWebhookDeliveries } from "../_data/use-webhooks";
import { Panel, Select, Sunken, Btn, w98 } from "./win98-ui";

const STATUS_LABEL: Record<WebhookDeliveryStatus, string> = {
  PENDING: "대기",
  SENDING: "전송 중",
  RETRY: "재시도 대기",
  DELIVERED: "완료",
  DEAD: "DEAD",
};

const STATUS_TONE: Record<WebhookDeliveryStatus, string> = {
  PENDING: "text-[color:var(--muted-foreground)]",
  SENDING: "text-[color:var(--muted-foreground)]",
  RETRY: "text-[color:var(--muted-foreground)]",
  DELIVERED: "text-[color:var(--status-success)]",
  DEAD: "text-[color:var(--status-error)]",
};

export function WebhookDeliveriesPanel({ sellerCode }: { sellerCode: string | null }) {
  const [statusFilter, setStatusFilter] = useState<WebhookDeliveryStatus | "">("");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const { data: deliveries, isLoading, usingMock } = useWebhookDeliveries({
    seller: sellerCode ?? undefined,
    status: statusFilter || undefined,
    limit: 100,
  });
  const retry = useRetryDelivery(sellerCode ?? undefined);

  const handleRetry = (id: number) => {
    retry.mutate(id, {
      onSuccess: (data) => toast.success(`재시도를 요청했습니다 (${data.revived}건 재전송)`, w98Toast.success),
      onError: (err) => toast.error("재시도에 실패했습니다", { ...w98Toast.notice, description: err.message }),
    });
  };

  return (
    <Panel
      title="발송 이력"
      className="h-full"
      bodyClassName="min-h-0"
      right={
        <Select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as WebhookDeliveryStatus | "")}
          className="h-6 w-32 text-[12px]"
        >
          <option value="">전체</option>
          {Object.entries(STATUS_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
      }
    >
      {usingMock ? (
        <span className="mb-1 w-fit bg-[color:var(--status-error)] px-1.5 py-0.5 text-[11px] font-bold text-white">
          /admin/webhooks/deliveries 표본
        </span>
      ) : null}
      {sellerCode === null ? (
        <span className="p-2 text-[13px] text-[color:var(--muted-foreground)]">
          좌측에서 화주를 먼저 선택하세요.
        </span>
      ) : (
        <Sunken className={`${w98.scroll} min-h-0 flex-1 overflow-y-auto`}>
          <table className="w-full border-collapse text-left text-[12px]">
            <thead className="sticky top-0 bg-[color:var(--surface)]">
              <tr>
                <Th>seq</Th>
                <Th>유형</Th>
                <Th>엔드포인트</Th>
                <Th>상태</Th>
                <Th>시도</Th>
                <Th>마지막 응답</Th>
                <Th>다음 시도</Th>
                <Th>시각</Th>
                <Th>{""}</Th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="p-2 text-[color:var(--muted-foreground)]">
                    발송 이력을 불러오는 중…
                  </td>
                </tr>
              ) : deliveries === undefined || deliveries.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-2 text-[color:var(--muted-foreground)]">
                    조건에 맞는 발송 이력이 없습니다.
                  </td>
                </tr>
              ) : (
                deliveries.map((d) => (
                  <Fragment key={d.deliveryId}>
                    <tr
                      onClick={() => setExpandedId(expandedId === d.deliveryId ? null : d.deliveryId)}
                      className="cursor-pointer border-t border-[color:var(--border)] hover:bg-[color:var(--surface-variant)]"
                    >
                      <Td mono>{d.outboxSeq}</Td>
                      <Td mono>{d.eventType}</Td>
                      <Td mono>{d.url}</Td>
                      <Td>
                        <span className={`font-bold ${STATUS_TONE[d.status]}`}>{STATUS_LABEL[d.status]}</span>
                      </Td>
                      <Td mono>{d.attempts}</Td>
                      <Td mono>{d.lastStatusCode ?? "—"}</Td>
                      <Td mono>{formatKst(d.nextAttemptAt)}</Td>
                      <Td mono>{formatKst(d.createdAt)}</Td>
                      <Td>
                        {d.status === "DEAD" ? (
                          <Btn
                            disabled={retry.isPending}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRetry(d.deliveryId);
                            }}
                            className="h-6 px-2 text-[11px] font-bold"
                          >
                            재시도
                          </Btn>
                        ) : null}
                      </Td>
                    </tr>
                    {expandedId === d.deliveryId ? (
                      <tr className="border-t border-[color:var(--border)]">
                        <td colSpan={9} className="p-0">
                          <Sunken className={`${w98.mono} m-1 max-h-48 overflow-auto p-2 text-[11px]`}>
                            <pre className="whitespace-pre-wrap">{JSON.stringify(d.payload, null, 2)}</pre>
                          </Sunken>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                ))
              )}
            </tbody>
          </table>
        </Sunken>
      )}
    </Panel>
  );
}
