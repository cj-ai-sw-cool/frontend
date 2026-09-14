"use client";

/**
 * "화주" 탭 — API 키 카드 — 정본 §14.2, 브리프 §2 중단 "API 키 카드(prefix·label·발급일·
 * 마지막 사용·폐기 버튼)".
 */

import { toast } from "sonner";
import { w98Toast } from "@/lib/win98-toast";
import { useState } from "react";
import { formatKst, Th, Td } from "./table";
import { useApiKeys, useRevokeApiKey } from "../_data/use-webhooks";
import { WebhookKeyIssueDialog } from "./webhook-key-issue-dialog";
import { Btn, Panel, Sunken, w98 } from "./win98-ui";

export function WebhookKeysPanel({ sellerCode }: { sellerCode: string }) {
  const { data: keys, isLoading, usingMock } = useApiKeys(sellerCode);
  const revoke = useRevokeApiKey(sellerCode);
  const [issueOpen, setIssueOpen] = useState(false);

  const handleRevoke = (id: number) => {
    revoke.mutate(id, {
      onSuccess: () => toast.success("키를 폐기했습니다", w98Toast.success),
      onError: (err) => toast.error("폐기에 실패했습니다", { ...w98Toast.notice, description: err.message }),
    });
  };

  return (
    <Panel
      title="API 키"
      right={
        <Btn onClick={() => setIssueOpen(true)} className="h-6 px-2 text-[12px] font-bold">
          키 발급
        </Btn>
      }
    >
      {usingMock ? (
        <span className="mb-1 w-fit bg-[color:var(--status-error)] px-1.5 py-0.5 text-[11px] font-bold text-white">
          /admin/sellers/{sellerCode}/api-keys 표본
        </span>
      ) : null}
      <Sunken className={`${w98.scroll} min-h-0 flex-1 overflow-y-auto`}>
        <table className="w-full border-collapse text-left text-[12px]">
          <thead className="sticky top-0 bg-[color:var(--surface)]">
            <tr>
              <Th>prefix</Th>
              <Th>라벨</Th>
              <Th>발급일</Th>
              <Th>마지막 사용</Th>
              <Th>상태</Th>
              <Th>{""}</Th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={6} className="p-2 text-[color:var(--muted-foreground)]">
                  키 목록을 불러오는 중…
                </td>
              </tr>
            ) : keys === undefined || keys.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-2 text-[color:var(--muted-foreground)]">
                  발급된 키가 없습니다.
                </td>
              </tr>
            ) : (
              keys.map((key) => (
                <tr key={key.id} className="border-t border-[color:var(--border)]">
                  <Td mono>{key.keyPrefix}…</Td>
                  <Td>{key.label}</Td>
                  <Td mono>{formatKst(key.createdAt)}</Td>
                  <Td mono>{formatKst(key.lastUsedAt)}</Td>
                  <Td>
                    {key.revokedAt !== null ? (
                      <span className="font-bold text-[color:var(--status-error)]">폐기됨</span>
                    ) : (
                      <span className="font-bold text-[color:var(--status-success)]">사용 중</span>
                    )}
                  </Td>
                  <Td>
                    {key.revokedAt === null ? (
                      <Btn
                        disabled={revoke.isPending}
                        onClick={() => handleRevoke(key.id)}
                        className="h-6 px-2 text-[11px]"
                      >
                        폐기
                      </Btn>
                    ) : null}
                  </Td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Sunken>

      <WebhookKeyIssueDialog sellerCode={sellerCode} open={issueOpen} onOpenChange={setIssueOpen} />
    </Panel>
  );
}
