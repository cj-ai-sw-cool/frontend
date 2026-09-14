"use client";

/**
 * "키 발급" 대화 상자 — 정본 §14.2 `POST /admin/sellers/{code}/api-keys`, 브리프 §2
 * "키 발급 → label 입력 → 응답 평문 1회 모달". `icqa-count-dialog.tsx`와 같은 골격 —
 * 뮤테이션 훅(`useIssueApiKey`)은 `DialogBody`(DialogContent 안)에 둬 닫힐 때 언마운트로
 * 초기화된다. 평문 단계에선 복사 확인 전 닫기를 막아야 해서(브리프 §2) 그 가드만 이
 * 파일 최상위(`onOpenChange`)에 둔다 — `blockCloseRef`로 자식과 값을 주고받는다.
 */

import { useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useIssueApiKey } from "../_data/use-webhooks";
import { PlaintextSecretPanel } from "./plaintext-secret-panel";
import { Btn, Field, w98 } from "./win98-ui";

export function WebhookKeyIssueDialog({
  sellerCode,
  open,
  onOpenChange,
}: {
  sellerCode: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const blockCloseRef = useRef(false);

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
          <DialogTitle className={w98.titleText}>API 키 발급</DialogTitle>
          <DialogDescription className="sr-only">
            라벨을 입력해 화주 API 키를 발급합니다.
          </DialogDescription>
        </DialogHeader>

        {open ? (
          <DialogBody
            sellerCode={sellerCode}
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
  onClose,
  onBlockCloseChange,
}: {
  sellerCode: string;
  onClose: () => void;
  onBlockCloseChange: (blocked: boolean) => void;
}) {
  const [label, setLabel] = useState("");
  const [issuedKey, setIssuedKey] = useState<string | null>(null);
  const issue = useIssueApiKey(sellerCode);

  if (issuedKey !== null) {
    return (
      <PlaintextSecretPanel
        description="발급된 API 키"
        value={issuedKey}
        onCopiedChange={(copied) => onBlockCloseChange(!copied)}
        onClose={onClose}
      />
    );
  }

  const submit = () => {
    if (label.trim() === "") return;
    issue.mutate({ label: label.trim() }, { onSuccess: (data) => setIssuedKey(data.key) });
  };

  return (
    <>
      <div className="flex flex-col gap-2 p-3">
        <label className="flex flex-col gap-0.5">
          <span className={`${w98.small} text-[color:var(--muted-foreground)]`}>라벨</span>
          <Field
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="운영 OMS"
            className="h-7 text-[13px]"
          />
        </label>
        {issue.error ? (
          <span className={`${w98.small} font-bold text-[color:var(--status-error)]`}>
            {issue.error.message}
          </span>
        ) : null}
      </div>
      <div className="flex justify-end gap-2 border-t-2 border-[color:var(--surface-dim)] p-2">
        <Btn disabled={label.trim() === "" || issue.isPending} onClick={submit} className="h-7 w-24 font-bold">
          {issue.isPending ? "발급 중…" : "발급"}
        </Btn>
        <Btn onClick={onClose} className="h-7 w-20">
          취소
        </Btn>
      </div>
    </>
  );
}
