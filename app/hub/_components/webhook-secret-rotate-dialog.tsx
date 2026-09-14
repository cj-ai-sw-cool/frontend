"use client";

/**
 * "비밀 재발급" 대화 상자 — 정본 §14.5 `POST /admin/webhooks/endpoints/{id}/rotate-secret`,
 * 브리프 §2 "비밀 재발급(평문 1회 모달)". `webhook-key-issue-dialog.tsx`와 같은 골격
 * (확인 단계 → 뮤테이션 → 평문 패널) — 서명 검증에 쓰던 비밀이 즉시 바뀌므로 실수 클릭을
 * 막으려 한 단계(확인 버튼)를 둔다.
 */

import { useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useRotateSecret } from "../_data/use-webhooks";
import { PlaintextSecretPanel } from "./plaintext-secret-panel";
import { Btn, w98 } from "./win98-ui";

export function WebhookSecretRotateDialog({
  sellerCode,
  endpointId,
  onOpenChange,
}: {
  sellerCode: string;
  /** null 이면 닫힌 상태 — 부모가 재발급할 엔드포인트 id 를 넘기면 연다 */
  endpointId: number | null;
  onOpenChange: (open: boolean) => void;
}) {
  const blockCloseRef = useRef(false);
  const open = endpointId !== null;

  const handleOpenChange = (next: boolean) => {
    if (!next && blockCloseRef.current) return;
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        showCloseButton={false}
        className={`${w98.dialogTheme} ${w98.raised} w-[420px] max-w-none gap-0 rounded-none border-0 p-[3px] shadow-[3px_3px_0_0_rgba(0,0,0,0.35)] sm:max-w-none`}
      >
        <DialogHeader
          className={`${w98.titleText} h-6 flex-row items-center gap-1 space-y-0 bg-[color:var(--title-navy)] px-1 text-[color:var(--primary-foreground)]`}
        >
          <DialogTitle className={w98.titleText}>비밀 재발급</DialogTitle>
          <DialogDescription className="sr-only">
            엔드포인트의 서명 비밀을 새로 발급합니다. 기존 비밀은 즉시 무효화됩니다.
          </DialogDescription>
        </DialogHeader>

        {open ? (
          <DialogBody
            sellerCode={sellerCode}
            endpointId={endpointId}
            onClose={() => onOpenChange(false)}
            onBlockCloseChange={(blocked) => {
              blockCloseRef.current = blocked;
            }}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function DialogBody({
  sellerCode,
  endpointId,
  onClose,
  onBlockCloseChange,
}: {
  sellerCode: string;
  endpointId: number;
  onClose: () => void;
  onBlockCloseChange: (blocked: boolean) => void;
}) {
  const [rotatedSecret, setRotatedSecret] = useState<string | null>(null);
  const rotate = useRotateSecret(sellerCode);

  if (rotatedSecret !== null) {
    return (
      <PlaintextSecretPanel
        description="새 비밀"
        value={rotatedSecret}
        onCopiedChange={(copied) => onBlockCloseChange(!copied)}
        onClose={onClose}
      />
    );
  }

  return (
    <>
      <div className="flex flex-col gap-2 p-3">
        <span className={`${w98.small}`}>
          기존 비밀은 즉시 무효화됩니다. 화주 OMS 쪽 서명 검증 값도 같이 바꿔야 합니다.
        </span>
        {rotate.error ? (
          <span className={`${w98.small} font-bold text-[color:var(--status-error)]`}>
            {rotate.error.message}
          </span>
        ) : null}
      </div>
      <div className="flex justify-end gap-2 border-t-2 border-[color:var(--surface-dim)] p-2">
        <Btn
          disabled={rotate.isPending}
          onClick={() => rotate.mutate(endpointId, { onSuccess: (data) => setRotatedSecret(data.secret) })}
          className="h-7 w-28 font-bold"
        >
          {rotate.isPending ? "재발급 중…" : "재발급"}
        </Btn>
        <Btn onClick={onClose} className="h-7 w-20">
          취소
        </Btn>
      </div>
    </>
  );
}
