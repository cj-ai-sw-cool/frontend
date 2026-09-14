"use client";

/**
 * 슬로팅 매개변수 편집 Dialog — 상단 띠 "편집"(정본 §15.9, `PUT /admin/slotting/params`).
 * `wave-create-dialog.tsx` 와 같은 골격: 뮤테이션 훅은 `DialogContent` 안에서만 만든다
 * (코딩 규칙 "뮤테이션 훅은 DialogContent 안") — 닫힐 때 언마운트되어 다음에 열면 폼이
 * 최신 조회값으로 다시 시작한다.
 */

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { SlottingParams } from "@/lib/types";
import { useUpdateSlottingParams } from "../_data/use-slotting-mutations";
import { Btn, Field, w98 } from "./win98-ui";

export function SlottingParamsEditDialog({
  open,
  onOpenChange,
  center,
  current,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  center: string;
  current: SlottingParams | null;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className={`${w98.dialogTheme} ${w98.raised} w-[440px] max-w-none gap-0 rounded-none border-0 p-[3px] shadow-[3px_3px_0_0_rgba(0,0,0,0.35)] sm:max-w-none`}
      >
        <DialogHeader
          className={`${w98.titleText} h-6 flex-row items-center gap-1 space-y-0 bg-[color:var(--title-navy)] px-1 text-[color:var(--primary-foreground)]`}
        >
          <DialogTitle className={w98.titleText}>슬로팅 매개변수 편집</DialogTitle>
          <DialogDescription className="sr-only">
            보행 속도·라인당 시간·단 페널티·골든존 비율·무게 기준·집계 일수를 저장합니다.
          </DialogDescription>
        </DialogHeader>

        {current === null ? (
          <p className={`${w98.small} p-3 text-[color:var(--muted-foreground)]`}>불러오는 중…</p>
        ) : (
          <DialogBody center={center} current={current} onClose={() => onOpenChange(false)} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function DialogBody({
  center,
  current,
  onClose,
}: {
  center: string;
  current: SlottingParams;
  onClose: () => void;
}) {
  const [form, setForm] = useState<SlottingParams>(current);
  const update = useUpdateSlottingParams(center);

  const setField = (key: keyof SlottingParams) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((f) => ({ ...f, [key]: Number(e.target.value) }));
  };

  const submit = () => {
    // 센터는 쿼리로 이미 보낸다 — 바디에는 여섯 값만(라이브 대조, `UpdateSlottingParamsRequest`)
    const { walkSpeedMps, secPerLine, levelPenaltySec, goldenShare, heavyKg, velocityDays } = form;
    update.mutate({ walkSpeedMps, secPerLine, levelPenaltySec, goldenShare, heavyKg, velocityDays }, { onSuccess: onClose });
  };

  return (
    <>
      <div className="grid grid-cols-2 gap-3 p-3">
        <NumField label="보행 속도(m/s)" value={form.walkSpeedMps} step={0.1} onChange={setField("walkSpeedMps")} />
        <NumField label="라인당 시간(초)" value={form.secPerLine} onChange={setField("secPerLine")} />
        <NumField label="단 페널티(초)" value={form.levelPenaltySec} onChange={setField("levelPenaltySec")} />
        <NumField
          label="골든존 비율(0~1)"
          value={form.goldenShare}
          step={0.01}
          onChange={setField("goldenShare")}
        />
        <NumField label="무거운 기준(kg)" value={form.heavyKg} onChange={setField("heavyKg")} />
        <NumField label="집계 일수" value={form.velocityDays} onChange={setField("velocityDays")} />
      </div>

      {update.error ? (
        <p
          role="alert"
          className={`${w98.small} mx-3 mb-2 bg-[#ffdad6] p-2 font-bold text-[color:var(--status-error)]`}
        >
          {update.error.message}
        </p>
      ) : null}

      <div className="flex justify-end gap-2 border-t-2 border-[color:var(--surface-dim)] p-2">
        <Btn disabled={update.isPending} onClick={submit} className="h-7 w-24 font-bold">
          {update.isPending ? "저장 중…" : "저장"}
        </Btn>
        <Btn onClick={onClose} className="h-7 w-20">
          취소
        </Btn>
      </div>
    </>
  );
}

function NumField({
  label,
  value,
  step = 1,
  onChange,
}: {
  label: string;
  value: number;
  step?: number;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <label className="flex flex-col gap-0.5">
      <span className={`${w98.small} text-[color:var(--muted-foreground)]`}>{label}</span>
      <Field type="number" mono step={step} value={value} onChange={onChange} className="h-8 text-[13px]" />
    </label>
  );
}
