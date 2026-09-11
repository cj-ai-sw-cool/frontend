"use client";

import { useState, type ReactNode } from "react";
import { Plus, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { CreateAsnRequest, Seller } from "@/lib/types";
import { Btn, Etched, Field, Select, w98 } from "./win98-ui";

/**
 * ASN 등록 대화 상자 — 정본 §3.5 `POST /asns` 요청 그대로:
 * `{sellerCode, asnNo, expectedOn, note?, items:[{gtin, expectedQty, lotNo, expiresOn?}]}`.
 *
 * 목록 패널에 펼치지 않고 대화 상자로 뺀 이유는 asn-list-panel.tsx 주석 참고.
 *
 * ⚠️ 폼 상태는 `AsnRegisterForm`(자식)에 둔다 — Radix 는 닫히면 `DialogContent` 를 통째로
 *    언마운트하므로(manual-input-dialog.tsx 와 같은 규약), 다시 열면 폼이 저절로 빈 값으로
 *    시작한다. 여기(부모)에 상태를 두면 그 자동 초기화를 못 받는다.
 */
export function AsnRegisterDialog({
  open,
  onOpenChange,
  sellers,
  sellersLoading,
  onSubmit,
  isSubmitting,
  error,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sellers: Seller[] | undefined;
  sellersLoading: boolean;
  onSubmit: (body: CreateAsnRequest) => void;
  isSubmitting: boolean;
  error?: string | null;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className={`${w98.dialogTheme} ${w98.raised} w-[640px] max-w-none gap-0 rounded-none border-0 p-[3px] shadow-[3px_3px_0_0_rgba(0,0,0,0.35)] sm:max-w-none`}
      >
        <DialogHeader
          className={`${w98.titleText} h-6 flex-row items-center gap-1 space-y-0 bg-[color:var(--title-navy)] px-1 text-[color:var(--primary-foreground)]`}
        >
          <DialogTitle className={w98.titleText}>ASN 등록</DialogTitle>
          <DialogDescription className="sr-only">
            화주·ASN 번호·예정일과 품목을 입력해 ASN을 등록합니다.
          </DialogDescription>
        </DialogHeader>

        <AsnRegisterForm
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

interface DraftItem {
  gtin: string;
  expectedQty: string;
  lotNo: string;
  expiresOn: string;
}

const EMPTY_ITEM: DraftItem = { gtin: "", expectedQty: "", lotNo: "", expiresOn: "" };

function AsnRegisterForm({
  sellers,
  sellersLoading,
  onSubmit,
  onCancel,
  isSubmitting,
  error,
}: {
  sellers: Seller[] | undefined;
  sellersLoading: boolean;
  onSubmit: (body: CreateAsnRequest) => void;
  onCancel: () => void;
  isSubmitting: boolean;
  error?: string | null;
}) {
  const [sellerCode, setSellerCode] = useState("");
  const [asnNo, setAsnNo] = useState("");
  const [expectedOn, setExpectedOn] = useState("");
  const [note, setNote] = useState("");
  const [items, setItems] = useState<DraftItem[]>([{ ...EMPTY_ITEM }]);

  const updateItem = (index: number, patch: Partial<DraftItem>) =>
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)));

  const canSubmit =
    sellerCode.trim() !== "" &&
    asnNo.trim() !== "" &&
    expectedOn.trim() !== "" &&
    items.length > 0 &&
    items.every(
      (it) => it.gtin.trim() !== "" && it.lotNo.trim() !== "" && Number(it.expectedQty) > 0,
    );

  const submit = () => {
    if (!canSubmit) return;
    onSubmit({
      sellerCode: sellerCode.trim(),
      asnNo: asnNo.trim(),
      expectedOn,
      note: note.trim() === "" ? undefined : note.trim(),
      items: items.map((it) => ({
        gtin: it.gtin.trim(),
        expectedQty: Number(it.expectedQty),
        lotNo: it.lotNo.trim(),
        expiresOn: it.expiresOn.trim() === "" ? null : it.expiresOn,
      })),
    });
  };

  return (
    <>
      <div className="flex max-h-[70vh] flex-col gap-3 overflow-y-auto p-3">
        <div className="grid grid-cols-2 gap-2">
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
          <LabeledField label="ASN 번호">
            <Field
              mono
              value={asnNo}
              onChange={(event) => setAsnNo(event.target.value)}
              placeholder="ASN-2026-0911-01"
              className="h-7 w-full text-[14px]"
            />
          </LabeledField>
          <LabeledField label="예정일">
            <Field
              type="date"
              value={expectedOn}
              onChange={(event) => setExpectedOn(event.target.value)}
              className="h-7 w-full text-[14px]"
            />
          </LabeledField>
          <LabeledField label="메모 (선택)">
            <Field
              value={note}
              onChange={(event) => setNote(event.target.value)}
              className="h-7 w-full text-[14px]"
            />
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
            <div key={index} className="grid grid-cols-[1.3fr_0.7fr_1fr_1fr_28px] items-end gap-1.5">
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
                  value={item.expectedQty}
                  onChange={(event) => updateItem(index, { expectedQty: event.target.value })}
                  className="h-7 w-full text-right text-[13px]"
                />
              </LabeledField>
              <LabeledField label="로트">
                <Field
                  mono
                  value={item.lotNo}
                  onChange={(event) => updateItem(index, { lotNo: event.target.value })}
                  placeholder="L-2026-09"
                  className="h-7 w-full text-[13px]"
                />
              </LabeledField>
              <LabeledField label="유통기한">
                <Field
                  type="date"
                  value={item.expiresOn}
                  onChange={(event) => updateItem(index, { expiresOn: event.target.value })}
                  className="h-7 w-full text-[13px]"
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

      {/* win98 대화상자는 확인/취소가 오른쪽 아래에 나란히 온다(manual-input-dialog.tsx 와 같다) */}
      <div className="flex justify-end gap-2 border-t-2 border-[color:var(--surface-dim)] p-2">
        <Btn disabled={!canSubmit || isSubmitting} onClick={submit} className="h-7 w-28 font-bold">
          {isSubmitting ? "등록 중…" : "등록"}
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
