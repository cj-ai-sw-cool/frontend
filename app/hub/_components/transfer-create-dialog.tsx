"use client";

/**
 * "이동 생성" 대화 상자 — 정본 §12.5 ① `POST /hub/transfers`, 브리프 §2 "이동" 탭.
 *
 * `wave-create-dialog.tsx`/`asn-register-dialog.tsx` 와 같은 골격 — 폼 상태는 자식
 * (`TransferCreateForm`)에 두어 Radix 가 닫힐 때 언마운트로 자동 초기화되게 한다.
 */

import { useState, type ReactNode } from "react";
import { Plus, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { CenterCode, CenterSummary, CreateTransferRequest, Seller } from "@/lib/types";
import { Btn, Etched, Field, Select, w98 } from "./win98-ui";

interface DraftItem {
  gtin: string;
  qty: string;
}

const EMPTY_ITEM: DraftItem = { gtin: "", qty: "" };

export function TransferCreateDialog({
  open,
  onOpenChange,
  centers,
  sellers,
  sellersLoading,
  onSubmit,
  isSubmitting,
  error,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  centers: CenterSummary[];
  sellers: Seller[] | undefined;
  sellersLoading: boolean;
  onSubmit: (body: CreateTransferRequest) => void;
  isSubmitting: boolean;
  error?: string | null;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className={`${w98.dialogTheme} ${w98.raised} w-[560px] max-w-none gap-0 rounded-none border-0 p-[3px] shadow-[3px_3px_0_0_rgba(0,0,0,0.35)] sm:max-w-none`}
      >
        <DialogHeader
          className={`${w98.titleText} h-6 flex-row items-center gap-1 space-y-0 bg-[color:var(--title-navy)] px-1 text-[color:var(--primary-foreground)]`}
        >
          <DialogTitle className={w98.titleText}>이동 생성</DialogTitle>
          <DialogDescription className="sr-only">
            출발·도착 센터와 화주, 품목을 입력해 센터 간 이동 오더를 만듭니다.
          </DialogDescription>
        </DialogHeader>

        <TransferCreateForm
          centers={centers}
          sellers={sellers}
          sellersLoading={sellersLoading}
          onSubmit={onSubmit}
          onCancel={() => onOpenChange(false)}
          isSubmitting={isSubmitting}
          error={error}
        />
      </DialogContent>
    </Dialog>
  );
}

function TransferCreateForm({
  centers,
  sellers,
  sellersLoading,
  onSubmit,
  onCancel,
  isSubmitting,
  error,
}: {
  centers: CenterSummary[];
  sellers: Seller[] | undefined;
  sellersLoading: boolean;
  onSubmit: (body: CreateTransferRequest) => void;
  onCancel: () => void;
  isSubmitting: boolean;
  error?: string | null;
}) {
  const [fromCenter, setFromCenter] = useState<CenterCode | "">("");
  const [toCenter, setToCenter] = useState<CenterCode | "">("");
  const [sellerCode, setSellerCode] = useState("");
  const [items, setItems] = useState<DraftItem[]>([{ ...EMPTY_ITEM }]);

  const updateItem = (index: number, patch: Partial<DraftItem>) =>
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)));

  const canSubmit =
    fromCenter !== "" &&
    toCenter !== "" &&
    fromCenter !== toCenter &&
    sellerCode.trim() !== "" &&
    items.length > 0 &&
    items.every((it) => it.gtin.trim() !== "" && Number(it.qty) > 0);

  const submit = () => {
    if (!canSubmit) return;
    onSubmit({
      fromCenter: fromCenter as CenterCode,
      toCenter: toCenter as CenterCode,
      sellerCode: sellerCode.trim(),
      items: items.map((it) => ({ gtin: it.gtin.trim(), qty: Number(it.qty) })),
    });
  };

  return (
    <>
      <div className="flex max-h-[70vh] flex-col gap-3 overflow-y-auto p-3">
        <div className="grid grid-cols-2 gap-2">
          <LabeledField label="출발 센터">
            <Select
              value={fromCenter}
              onChange={(event) => setFromCenter(event.target.value as CenterCode)}
              className="h-7 w-full text-[14px]"
            >
              <option value="">선택하세요</option>
              {centers.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code} · {c.name}
                </option>
              ))}
            </Select>
          </LabeledField>
          <LabeledField label="도착 센터">
            <Select
              value={toCenter}
              onChange={(event) => setToCenter(event.target.value as CenterCode)}
              className="h-7 w-full text-[14px]"
            >
              <option value="">선택하세요</option>
              {centers
                .filter((c) => c.code !== fromCenter)
                .map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.code} · {c.name}
                  </option>
                ))}
            </Select>
          </LabeledField>
          <LabeledField label="화주">
            <Select
              value={sellerCode}
              disabled={sellersLoading}
              onChange={(event) => setSellerCode(event.target.value)}
              className="h-7 w-full text-[14px]"
            >
              <option value="">{sellersLoading ? "불러오는 중…" : "선택하세요"}</option>
              {sellers?.map((seller) => (
                <option key={seller.id} value={seller.code}>
                  {seller.code} · {seller.name}
                </option>
              ))}
            </Select>
          </LabeledField>
        </div>

        <Etched />

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className={`${w98.small} font-bold`}>품목</span>
            <Btn
              onClick={() => setItems((prev) => [...prev, { ...EMPTY_ITEM }])}
              className="flex h-6 items-center gap-1 px-2 text-[13px]"
            >
              <Plus className="size-3.5" aria-hidden />
              행 추가
            </Btn>
          </div>

          {items.map((item, index) => (
            <div key={index} className="grid grid-cols-[1.6fr_1fr_28px] items-end gap-1.5">
              <LabeledField label="GTIN">
                <Field
                  mono
                  inputMode="numeric"
                  value={item.gtin}
                  onChange={(event) => updateItem(index, { gtin: event.target.value })}
                  className="h-7 w-full text-[13px]"
                />
              </LabeledField>
              <LabeledField label="수량">
                <Field
                  mono
                  inputMode="numeric"
                  value={item.qty}
                  onChange={(event) => updateItem(index, { qty: event.target.value })}
                  className="h-7 w-full text-right text-[13px]"
                />
              </LabeledField>
              <Btn
                disabled={items.length <= 1}
                onClick={() => setItems((prev) => prev.filter((_, i) => i !== index))}
                title="이 행 삭제"
                aria-label="이 행 삭제"
                className="flex h-7 w-7 items-center justify-center self-end"
              >
                <Trash2 className="size-3.5" aria-hidden />
              </Btn>
            </div>
          ))}
        </div>

        {error ? (
          <div
            role="alert"
            className={`${w98.sunken} ${w98.small} bg-[#ffdad6] p-2 font-bold text-[color:var(--status-error)]`}
          >
            {error}
          </div>
        ) : null}
      </div>

      <div className="flex justify-end gap-2 border-t-2 border-[color:var(--surface-dim)] p-2">
        <Btn disabled={!canSubmit || isSubmitting} onClick={submit} className="h-7 w-28 font-bold">
          {isSubmitting ? "생성 중…" : "이동 생성"}
        </Btn>
        <Btn onClick={onCancel} className="h-7 w-24">
          취소
        </Btn>
      </div>
    </>
  );
}

function LabeledField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex min-w-0 flex-col gap-0.5">
      <span className={`${w98.small} text-[color:var(--muted-foreground)]`}>{label}</span>
      {children}
    </label>
  );
}
