"use client";

/**
 * "엔드포인트 추가" 대화 상자 — 정본 §14.5 `POST /admin/webhooks/endpoints`, 브리프 §2
 * "URL·구독 유형 체크 4종". `transfer-create-dialog.tsx`와 같은 골격 — 폼 상태는 자식
 * (`EndpointCreateForm`)에 둬 Radix 가 닫힐 때 언마운트로 자동 초기화된다.
 */

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { WEBHOOK_EVENT_TYPES, type WebhookEventType } from "@/lib/types";
import { useCreateWebhookEndpoint } from "../_data/use-webhooks";
import { Btn, Checkbox, Field, w98 } from "./win98-ui";

const EVENT_TYPE_LABEL: Record<WebhookEventType, string> = {
  OrderStatusChanged: "주문 상태 변경",
  OrderCancelled: "주문 취소",
  ShipmentShipped: "출고 완료",
  InventoryChanged: "재고 변동",
};

export function WebhookEndpointCreateDialog({
  sellerCode,
  open,
  onOpenChange,
}: {
  sellerCode: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className={`${w98.dialogTheme} ${w98.raised} w-[460px] max-w-none gap-0 rounded-none border-0 p-[3px] shadow-[3px_3px_0_0_rgba(0,0,0,0.35)] sm:max-w-none`}
      >
        <DialogHeader
          className={`${w98.titleText} h-6 flex-row items-center gap-1 space-y-0 bg-[color:var(--title-navy)] px-1 text-[color:var(--primary-foreground)]`}
        >
          <DialogTitle className={w98.titleText}>엔드포인트 추가</DialogTitle>
          <DialogDescription className="sr-only">
            URL과 구독할 이벤트 유형을 선택해 웹훅 엔드포인트를 만듭니다.
          </DialogDescription>
        </DialogHeader>

        {open ? (
          <EndpointCreateForm sellerCode={sellerCode} onClose={() => onOpenChange(false)} />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function EndpointCreateForm({ sellerCode, onClose }: { sellerCode: string; onClose: () => void }) {
  const [url, setUrl] = useState("");
  const [eventTypes, setEventTypes] = useState<WebhookEventType[]>([...WEBHOOK_EVENT_TYPES]);
  const create = useCreateWebhookEndpoint();

  const toggleType = (type: WebhookEventType) =>
    setEventTypes((prev) => (prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]));

  const canSubmit = url.trim() !== "" && eventTypes.length > 0;

  const submit = () => {
    if (!canSubmit) return;
    create.mutate(
      { sellerCode, url: url.trim(), eventTypes },
      { onSuccess: onClose },
    );
  };

  return (
    <>
      <div className="flex flex-col gap-3 p-3">
        <label className="flex flex-col gap-0.5">
          <span className={`${w98.small} text-[color:var(--muted-foreground)]`}>URL</span>
          <Field
            mono
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="http://mock-sellers:9101/webhook"
            className="h-7 text-[13px]"
          />
        </label>

        <div className="flex flex-col gap-1">
          <span className={`${w98.small} font-bold`}>구독 유형</span>
          {WEBHOOK_EVENT_TYPES.map((type) => (
            <Checkbox
              key={type}
              label={`${EVENT_TYPE_LABEL[type]} (${type})`}
              checked={eventTypes.includes(type)}
              onToggle={() => toggleType(type)}
            />
          ))}
        </div>

        {create.error ? (
          <span className={`${w98.small} font-bold text-[color:var(--status-error)]`}>
            {create.error.message}
          </span>
        ) : null}
      </div>
      <div className="flex justify-end gap-2 border-t-2 border-[color:var(--surface-dim)] p-2">
        <Btn disabled={!canSubmit || create.isPending} onClick={submit} className="h-7 w-24 font-bold">
          {create.isPending ? "저장 중…" : "저장"}
        </Btn>
        <Btn onClick={onClose} className="h-7 w-20">
          취소
        </Btn>
      </div>
    </>
  );
}
