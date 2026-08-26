"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Pencil } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Dimensions, MeasurementResponse } from "@/lib/types";
import { Btn, Etched, Field, Sunken, w98 } from "./win98-ui";

/**
 * 수동 입력 모달 — win98 의 **대화 상자** 모양이다(네이비 타이틀바 + 튀어나온 판 +
 * 파인 입력란 + 오른쪽 아래 확인/취소).
 *
 * 값만 부모로 올리고 API 는 부르지 않는다. 실제 확정은 `등록` 이 1-4 MANUAL 로 보낸다.
 *
 * ⚠️ `styles.dialogTheme` — 이 모달은 Radix 포탈로 **스테이지 엘리먼트**에 붙는다
 *    (components/fixed-stage.tsx). 그 자리는 layout.tsx 의 테마 래퍼 **밖**이라 win98 토큰과
 *    폰트가 상속되지 않는다 — 안 걸면 회색 창 위에 요즘 팝업이 뜬다.
 *
 * ⚠️ Radix 는 닫히면 이 안을 통째로 언마운트한다 — 그래서 열 때마다 폼이 새로 마운트되고
 *    defaultValues 가 그 시점의 값으로 다시 잡힌다. useEffect reset 이 필요 없다.
 */
export function ManualInputDialog({
  open,
  onOpenChange,
  measurement,
  applied,
  onApply,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  measurement?: MeasurementResponse;
  applied?: { dims: Dimensions; weightKg: number | null } | null;
  /** `weightKg: null` 은 "세션 저울값을 그대로 쓴다"는 뜻이다 (§1-4) */
  onApply: (dims: Dimensions, weightKg: number | null) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className={`${w98.dialogTheme} ${w98.raised} w-[520px] max-w-none gap-0 rounded-none border-0 p-[3px] shadow-[3px_3px_0_0_rgba(0,0,0,0.35)] sm:max-w-none`}
      >
        {/* 창 타이틀바 */}
        <DialogHeader
          className={`${w98.titleText} h-6 flex-row items-center gap-1 space-y-0 bg-[color:var(--title-navy)] px-1 text-[color:var(--primary-foreground)]`}
        >
          <Pencil className="size-3.5 shrink-0" aria-hidden />
          <DialogTitle className={w98.titleText}>Manual Dimension Entry</DialogTitle>
          <DialogDescription className="sr-only">
            가로·세로·높이·무게를 직접 입력합니다.
          </DialogDescription>
        </DialogHeader>

        <ManualForm
          measurement={measurement}
          applied={applied}
          onApply={onApply}
          onCancel={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

function ManualForm({
  measurement,
  applied,
  onApply,
  onCancel,
}: {
  measurement?: MeasurementResponse;
  applied?: { dims: Dimensions; weightKg: number | null } | null;
  onApply: (dims: Dimensions, weightKg: number | null) => void;
  onCancel: () => void;
}) {
  const inferred = measurement?.status === "INFERRED" ? measurement : null;
  const hasSessionWeight = measurement?.weightKg != null;
  const hasSession = measurement !== undefined;

  const form = useForm({
    resolver: zodResolver(manualSchema),
    defaultValues: {
      widthCm: applied
        ? String(applied.dims.widthCm)
        : inferred
          ? String(inferred.inferred.widthCm)
          : "",
      lengthCm: applied
        ? String(applied.dims.lengthCm)
        : inferred
          ? String(inferred.inferred.lengthCm)
          : "",
      heightCm: applied
        ? String(applied.dims.heightCm)
        : inferred
          ? String(inferred.inferred.heightCm)
          : "",
      weightKg:
        applied?.weightKg != null
          ? String(applied.weightKg)
          : measurement?.weightKg == null
            ? ""
            : String(measurement.weightKg),
    },
  });

  const submit = form.handleSubmit((values) => {
    const dims: Dimensions = {
      widthCm: Number(values.widthCm),
      lengthCm: Number(values.lengthCm),
      heightCm: Number(values.heightCm),
    };
    onApply(dims, toNumber(values.weightKg));
  });

  return (
    <div className="flex flex-col gap-3 p-3">
      {/* ★ D-18 안내 — `적용` 직후 화면이 정렬된 결과를 실제로 보여 준다(page.tsx 의 sortAxes 가
          저장 전에 같은 규칙을 적용하고, 그 값이 측정 상자와 이 폼의 기본값에 그대로 뜬다).
          작업자가 넣은 순서와 다르게 **보이는** 것이 버그가 아니라 규약임을 미리 알린다. */}
      <Sunken className={`${w98.small} p-2`}>
        <span className="font-bold">긴 쪽이 가로, 짧은 쪽이 세로로 표시·저장</span>됩니다. (높이는
        그대로)
      </Sunken>

      {/* 촬영 전이면 — `등록` 이 촬영을 한 번 돌린다는 사실을 미리 알린다.
          ⚠️ 계약 제약이다: 1-4 는 sessionId 를 경로 파라미터로 받고 그 세션은 1-3 만 만든다.
             그래서 촬영이 물리적으로 불가해도 1-3 을 한 번은 불러야 수기 확정이 성립한다.
             촬영이 MEASURE_FAILED 로 와도 sessionId 는 실려 오므로(§1-3) 흐름은 이어진다. */}
      {!hasSession ? (
        <p className={`${w98.small} text-[color:var(--muted-foreground)]`}>
          아직 촬영 전입니다. 수기값은 지금 기록되고, <span className="font-bold">등록</span>{" "}
          를 누를 때 확정에 필요한 측정 세션을 만들기 위해 촬영이 한 번 실행됩니다 (최대 8초).
        </p>
      ) : null}

      <div className="grid grid-cols-2 gap-2">
        <DimensionField form={form} name="widthCm" label="Width (가로)" unit="cm" />
        <DimensionField form={form} name="lengthCm" label="Length (세로)" unit="cm" />
        <DimensionField form={form} name="heightCm" label="Height (높이)" unit="cm" />
        <DimensionField
          form={form}
          name="weightKg"
          label="Weight (무게)"
          unit="kg"
          note={hasSessionWeight ? undefined : "저울값이 없습니다"}
        />
      </div>

      <Etched />

      {/* win98 대화상자는 확인/취소가 **오른쪽 아래**에 나란히 온다 */}
      <div className="flex justify-end gap-2">
        <Btn onClick={submit} className="h-7 w-24 font-bold">
          적용
        </Btn>
        <Btn onClick={onCancel} className="h-7 w-24">
          취소
        </Btn>
      </div>
    </div>
  );
}

function DimensionField({
  form,
  name,
  label,
  unit,
  note,
}: {
  form: ReturnType<typeof useForm<ManualFormValues>>;
  name: keyof ManualFormValues;
  label: string;
  unit: string;
  note?: string;
}) {
  const error = form.formState.errors[name];

  return (
    <div className="min-w-0">
      <label htmlFor={`manual-${name}`} className={`${w98.small} mb-1 block`}>
        {label}
      </label>
      <div className="flex items-center gap-1">
        <Field
          id={`manual-${name}`}
          type="text"
          inputMode="decimal"
          mono
          placeholder="--"
          aria-invalid={error ? true : undefined}
          className="h-7 min-w-0 flex-1 text-[15px] tabular-nums"
          {...form.register(name)}
        />
        <span className={`${w98.small} w-5 shrink-0`}>{unit}</span>
      </div>
      {error ? (
        <p role="alert" className={`${w98.small} mt-1 text-[color:var(--status-error)]`}>
          {error.message}
        </p>
      ) : note ? (
        <p className={`${w98.small} mt-1 text-[color:var(--muted-foreground)]`}>{note}</p>
      ) : null}
    </div>
  );
}

/* ── 검증 ───────────────────────────────────────────────── */

function toNumber(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function isPositive(raw: string): boolean {
  const parsed = toNumber(raw);
  return parsed !== null && parsed > 0;
}

const manualSchema = z.object({
  widthCm: z.string().refine(isPositive, "0보다 큰 숫자"),
  lengthCm: z.string().refine(isPositive, "0보다 큰 숫자"),
  heightCm: z.string().refine(isPositive, "0보다 큰 숫자"),
  /** 비워 두면 "세션 저울값을 쓴다"는 뜻이라 빈 문자열이 허용된다 (§1-4) */
  weightKg: z
    .string()
    .refine((v) => v.trim() === "" || isPositive(v), "숫자를 입력하거나 비워 두세요"),
});

type ManualFormValues = z.infer<typeof manualSchema>;
