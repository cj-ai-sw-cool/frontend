"use client";

/**
 * "화주" 탭 — 엔드포인트 카드 — 정본 §14.5, 브리프 §2 중단 "엔드포인트(URL·구독 유형
 * 체크 4종·상태 배지·suspended_at·비밀 재발급·재개·비활성/활성 토글)".
 */

import { useState } from "react";
import { toast } from "sonner";
import { w98Toast } from "@/lib/win98-toast";
import type { WebhookEndpointStatus } from "@/lib/types";
import { formatKst, Th, Td } from "./table";
import { useResumeEndpoint, useUpdateEndpointStatus, useWebhookEndpoints } from "../_data/use-webhooks";
import { WebhookEndpointCreateDialog } from "./webhook-endpoint-create-dialog";
import { WebhookSecretRotateDialog } from "./webhook-secret-rotate-dialog";
import { Btn, Panel, Sunken, w98 } from "./win98-ui";

const STATUS_LABEL: Record<WebhookEndpointStatus, string> = {
  ACTIVE: "ACTIVE",
  SUSPENDED: "SUSPENDED",
  DISABLED: "DISABLED",
};

const STATUS_TONE: Record<WebhookEndpointStatus, string> = {
  ACTIVE: "text-[color:var(--status-success)]",
  SUSPENDED: "text-[color:var(--status-error)]",
  DISABLED: "text-[color:var(--muted-foreground)]",
};

export function WebhookEndpointsPanel({ sellerCode }: { sellerCode: string }) {
  const { data: endpoints, isLoading, usingMock } = useWebhookEndpoints(sellerCode);
  const updateStatus = useUpdateEndpointStatus(sellerCode);
  const resume = useResumeEndpoint(sellerCode);
  const [createOpen, setCreateOpen] = useState(false);
  const [rotateEndpointId, setRotateEndpointId] = useState<number | null>(null);

  const handleResume = (id: number) => {
    resume.mutate(id, {
      onSuccess: () => toast.success("엔드포인트를 재개했습니다", w98Toast.success),
      onError: (err) => toast.error("재개에 실패했습니다", { ...w98Toast.notice, description: err.message }),
    });
  };

  const handleToggle = (id: number, current: WebhookEndpointStatus) => {
    const next = current === "DISABLED" ? "ACTIVE" : "DISABLED";
    updateStatus.mutate(
      { id, status: next },
      {
        onSuccess: () => toast.success(next === "ACTIVE" ? "활성화했습니다" : "비활성화했습니다", w98Toast.success),
        onError: (err) => toast.error("상태 변경에 실패했습니다", { ...w98Toast.notice, description: err.message }),
      },
    );
  };

  return (
    <Panel
      title="엔드포인트"
      right={
        <Btn onClick={() => setCreateOpen(true)} className="h-6 px-2 text-[12px] font-bold">
          엔드포인트 추가
        </Btn>
      }
    >
      {usingMock ? (
        <span className="mb-1 w-fit bg-[color:var(--status-error)] px-1.5 py-0.5 text-[11px] font-bold text-white">
          /admin/webhooks/endpoints 표본
        </span>
      ) : null}
      <Sunken className={`${w98.scroll} min-h-0 flex-1 overflow-y-auto`}>
        <table className="w-full border-collapse text-left text-[12px]">
          <thead className="sticky top-0 bg-[color:var(--surface)]">
            <tr>
              <Th>URL</Th>
              <Th>구독</Th>
              <Th>상태</Th>
              <Th>정지 시각</Th>
              <Th>{""}</Th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={5} className="p-2 text-[color:var(--muted-foreground)]">
                  엔드포인트를 불러오는 중…
                </td>
              </tr>
            ) : endpoints === undefined || endpoints.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-2 text-[color:var(--muted-foreground)]">
                  등록된 엔드포인트가 없습니다.
                </td>
              </tr>
            ) : (
              endpoints.map((ep) => (
                <tr key={ep.id} className="border-t border-[color:var(--border)] align-top">
                  <Td mono>{ep.url}</Td>
                  <Td mono>{ep.eventTypes.length}종</Td>
                  <Td>
                    <span className={`font-bold ${STATUS_TONE[ep.status]}`}>{STATUS_LABEL[ep.status]}</span>
                  </Td>
                  <Td mono>{formatKst(ep.suspendedAt)}</Td>
                  <Td>
                    <div className="flex flex-wrap gap-1">
                      {ep.status === "SUSPENDED" ? (
                        <Btn
                          disabled={resume.isPending}
                          onClick={() => handleResume(ep.id)}
                          className="h-6 px-2 text-[11px] font-bold"
                        >
                          재개
                        </Btn>
                      ) : null}
                      {ep.status !== "SUSPENDED" ? (
                        <Btn
                          disabled={updateStatus.isPending}
                          onClick={() => handleToggle(ep.id, ep.status)}
                          className="h-6 px-2 text-[11px]"
                        >
                          {ep.status === "DISABLED" ? "활성" : "비활성"}
                        </Btn>
                      ) : null}
                      <Btn onClick={() => setRotateEndpointId(ep.id)} className="h-6 px-2 text-[11px]">
                        비밀 재발급
                      </Btn>
                    </div>
                  </Td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Sunken>

      <WebhookEndpointCreateDialog sellerCode={sellerCode} open={createOpen} onOpenChange={setCreateOpen} />
      <WebhookSecretRotateDialog
        sellerCode={sellerCode}
        endpointId={rotateEndpointId}
        onOpenChange={(open) => {
          if (!open) setRotateEndpointId(null);
        }}
      />
    </Panel>
  );
}
