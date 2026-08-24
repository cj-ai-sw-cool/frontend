"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Pencil } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { Dimensions, MeasurementResponse } from "@/lib/types";

/**
 * 수동 입력 — docs/02-api-spec.md §1-4 `method: "MANUAL"` 의 `dims` / `weightKg` 를 받는다.
 * 디자인 확정본의 수동 입력 팝업(body.html 242~287행)을 그대로 옮긴 것이다.
 *
 * 순수 표시용(presentational): API 를 부르지 않는다. `적용` 은 값을 부모에게 올릴 뿐이고,
 * 실제 1-4 호출은 하단 `DB 입력` 버튼이 한다(action-buttons.tsx 주석 참고).
 *
 * 아이콘 대응표 (확정본 Material Symbols → lucide-react)
 *   edit → Pencil
 *
 * ── 왜 shadcn Dialog 인가 ────────────────────────────────────────────────
 *   확정본은 `position: fixed` 오버레이를 직접 만들지만, 우리 화면은 transform: scale()
 *   이 걸린 고정 스테이지 위에 있다. 그냥 body 에 붙이면 오버레이만 축소가 안 걸려
 *   뒤 화면보다 20% 크게 뜬다. components/ui/dialog.tsx 의 포탈 목적지가 이미 스테이지로
 *   배선돼 있어(fixed-stage.tsx 의 "포탈 목적지" 주석) 함께 축소된다.
 *
 * ── 왜 여기서 API 를 하나도 부르지 않나 ──────────────────────────────────
 *   `적용` 은 값을 부모에 기록하고 닫기만 한다. 확정(1-4)도, 세션 확보(1-3)도 안 한다.
 *   · 확정을 여기서 하면 확정과 입고가 다시 두 번의 누름으로 갈라진다(버튼 합침 결정).
 *   · 세션 확보를 여기서 하면 **촬영이 불가한 상황에서 모달이 그대로 멈춘다.** 수기 입력은
 *     바로 그 상황을 위한 탈출구인데, 탈출구가 촬영에 묶이면 뜻이 없다.
 *   그래서 1-3 이 필요하면 그건 `DB 입력` 시점에 부모가 부른다(page.tsx handleDbSubmit).
 *   ⚠️ 이전 개정에는 "적용 시점에 세션을 확보한다"고 적혀 있었다 — 위 이유로 뒤집혔다.
 *
 * ── 값은 부모가 들고 있다 ────────────────────────────────────────────────
 *   Radix 는 닫히면 이 안을 언마운트하므로 폼 상태는 매번 사라진다. 그래서 `defaultValues` 를
 *   **이전에 적용한 수기값 → 추론값 → 빈 칸** 순으로 깐다. 수기값이 이긴 상태에서 좌측
 *   측정 패널이 `--` 를 그리므로, 모달을 다시 여는 것이 작업자가 자기 숫자를 되보는
 *   두 번째 경로다(measurement-panel.tsx 상단 주석 ★).
 *
 * ── ★ D-18 안내 ────────────────────────────────────────────────────────
 *   서버는 MANUAL 로 받은 dims 도 **가로·세로를 스왑 정렬해서 저장**한다
 *   (`widthCm >= lengthCm` 불변식, 높이는 건드리지 않음). 작업자가 가로 30 / 세로 45 로
 *   넣어도 저장은 45 / 30 이 된다.
 *   **검증으로 막지 않는다.** 자동 정렬이 결정이다 — 물리적으로 같은 값이라 작업자가
 *   판단할 여지가 없고, 시연 중에 검증 실패 화면을 띄울 이유가 없다.
 *   1-4 응답에는 dims 가 없어서(§1-4) 정렬 결과를 되받아 보여줄 수단도 없다.
 *   그래서 아래 안내 문구가 이 사실을 작업자에게 알리는 **유일한** 장치다.
 */

/** 빈 칸·공백·숫자가 아닌 입력은 null 로 본다 ("안 넣음"과 0 을 구분하기 위해) */
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

/**
 * 치수·무게는 문자열로 받는다 — 비어 있는 입력칸을 숫자로 강제 변환하면 0 이 되어
 * "안 넣음"과 "0 을 넣음"을 구분할 수 없다. 숫자 변환은 제출 시점에 한 번만 한다.
 *
 * 이전 구현의 TODO(P1)("dims 3개 양수 검증을 superRefine 으로 옮길 것")은 여기서 닫았다 —
 * 제출 시점 setError 대신 스키마가 직접 판정한다.
 *
 * TODO(P1): 남은 검증 규칙.
 *   · 길이 소수 1자리 / 무게 소수 3자리 상한 (D-03). 지금은 자릿수를 제한하지 않는다.
 *   · 무게: 세션에 저울값이 없으면 **필수**다(§1-4 — 없으면 400 VALIDATION_ERROR).
 *     그 판정은 세션 값을 알아야 해서 이 스키마가 아니라 page.tsx 의 submit plan 이 한다
 *     (`DB 입력` 이 "무게 미확정"으로 잠긴다). 아래 안내 문구가 그 사정을 알린다.
 */
const manualSchema = z.object({
  widthCm: z.string().refine(isPositive, "0보다 큰 숫자를 입력하세요"),
  lengthCm: z.string().refine(isPositive, "0보다 큰 숫자를 입력하세요"),
  heightCm: z.string().refine(isPositive, "0보다 큰 숫자를 입력하세요"),
  weightKg: z
    .string()
    .refine((v) => v.trim() === "" || isPositive(v), "숫자를 입력하거나 비워 두세요"),
});

type ManualFormValues = z.infer<typeof manualSchema>;

export function ManualInputDialog({
  open,
  onOpenChange,
  measurement,
  applied,
  onApply,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 1-3 응답 — 추론값을 초기값으로 깔고, 세션 저울값 유무를 알린다. 촬영 전이면 undefined */
  measurement?: MeasurementResponse;
  /** 이전에 `적용` 한 수기값. 있으면 추론값보다 먼저 초기값으로 깔린다 */
  applied?: { dims: Dimensions; weightKg: number | null } | null;
  /** 적용 — 값만 부모로 올린다. `weightKg: null` 은 "세션 저울값을 그대로 쓴다"는 뜻이다 */
  onApply: (dims: Dimensions, weightKg: number | null) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* 확정본 244행: w-[664px] · bg-surface-variant · hc-border(2px) · 모서리 각짐 */}
      <DialogContent
        showCloseButton={false}
        className="bg-accent w-[664px] max-w-none gap-0 rounded-none border-2 p-0 sm:max-w-none"
      >
        {/* 확정본 245~249행: 64px 검정 바 + 흰 글자 */}
        <DialogHeader className="bg-foreground text-primary-foreground px-panel-padding h-16 flex-row items-center gap-3 space-y-0 border-b-2">
          <Pencil className="size-6 shrink-0" aria-hidden />
          <DialogTitle className="text-sub-action-md font-bold">수동 입력</DialogTitle>
          <DialogDescription className="text-label-sm text-outline-variant ml-auto">
            가로 | 세로 | 높이 | 무게
          </DialogDescription>
        </DialogHeader>

        {/* Radix 는 닫히면 이 안을 통째로 언마운트한다 — 그래서 열 때마다 폼이 새로 마운트되고
            defaultValues 가 그 시점의 값으로 다시 잡힌다. useEffect reset 이 필요 없다. */}
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

  /**
   * 수기 칸을 추론값으로 미리 채우는 이유: 수기 확정은 보통 "추론값을 조금 고치는" 작업이라
   * 빈 칸에서 시작하면 작업자가 네 값을 전부 다시 재야 한다.
   * 측정 실패(MEASURE_FAILED)면 추론값 자체가 없어서 치수는 빈 칸이고 무게만 채워진다.
   */
  const form = useForm({
    resolver: zodResolver(manualSchema),
    defaultValues: {
      widthCm: applied ? String(applied.dims.widthCm) : inferred ? String(inferred.inferred.widthCm) : "",
      lengthCm: applied ? String(applied.dims.lengthCm) : inferred ? String(inferred.inferred.lengthCm) : "",
      heightCm: applied ? String(applied.dims.heightCm) : inferred ? String(inferred.inferred.heightCm) : "",
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
    // ⚠️ 여기서 가로·세로를 정렬하지 않는다 — 서버가 한다 (D-18, 파일 상단 주석).
    //
    // TODO(P1): 작업자가 무게를 건드리지 않았으면 아예 생략(null)해서 세션값을 쓰게 하는 편이
    //   의도가 분명하다. form.formState.dirtyFields.weightKg 로 판별할 수 있다.
    //   지금은 칸에 남아 있는 값을 그대로 보낸다 — 계약상 유효하다(§1-4: 값을 주면 수기 수정).
    onApply(dims, toNumber(values.weightKg));
  });

  return (
    <div className="p-panel-padding flex flex-col gap-4">
      {/* ★ D-18 안내.
          ⚠️ 이전 개정의 "이 문구가 축 규약을 알리는 **유일한** 장치"라는 서술은 더 이상 맞지
             않다 — 이제 `적용` 직후 화면이 **정렬된 결과를 실제로 보여준다**(page.tsx 의
             sortAxes 가 저장 전에 같은 규칙을 적용하고, 그 값이 측정 패널 헤더 줄과 이 폼의
             기본값에 그대로 뜬다). 그래서 문구도 "저장됩니다"에서 "표시·저장됩니다"로 고쳤다:
             작업자가 넣은 순서와 다르게 **보이는** 것이 버그가 아니라 규약임을 미리 알린다. */}
      <p className="text-label-sm bg-muted border-2 p-3 font-normal">
        <span className="font-bold">가로·세로는 자동 정렬됩니다.</span> 긴 쪽이 가로, 짧은 쪽이
        세로로 표시·저장되므로 순서를 바꿔 입력해도 됩니다. 높이는 그대로입니다.
      </p>

      {/* 촬영 전이면 — `DB 입력` 이 촬영을 한 번 돌린다는 사실을 미리 알린다.
          ⚠️ 계약 제약이다: 1-4 는 sessionId 를 경로 파라미터로 받고 그 세션은 1-3 만 만든다.
             그래서 촬영이 물리적으로 불가해도 1-3 을 한 번은 불러야 수기 확정이 성립한다.
             촬영이 MEASURE_FAILED 로 와도 sessionId 는 실려 오므로(§1-3) 흐름은 이어진다. */}
      {!hasSession ? (
        <p className="text-label-sm text-muted-foreground">
          아직 촬영 전입니다. 수기값은 지금 기록되고,{" "}
          <span className="text-foreground font-bold">DB 입력</span> 을 누를 때 확정에 필요한 측정
          세션을 만들기 위해 촬영이 한 번 실행됩니다 (최대 8초). 추론값은 여기 입력한 수기값으로
          덮입니다.
        </p>
      ) : null}

      <div className="grid grid-cols-2 gap-3">
        <DimensionField form={form} name="widthCm" label="가로" unit="cm" />
        <DimensionField form={form} name="lengthCm" label="세로" unit="cm" />
        <DimensionField form={form} name="heightCm" label="높이" unit="cm" />
        <DimensionField
          form={form}
          name="weightKg"
          label="무게"
          unit="kg"
          note={
            hasSessionWeight
              ? "비우면 저울값을 그대로 씁니다"
              : "저울값이 없습니다 — 입력해야 확정됩니다"
          }
        />
      </div>

      {/* 확정본 281~284행: 취소 / 적용, 각 72px */}
      <div className="gap-grid-gap flex">
        {/* ⚠️ 비활성에 투명도를 쓰지 않는다 — 글씨가 안 읽히는 것이 이 화면의 원래 불만이었다
            (barcode-scan-row.tsx 의 같은 결정과 짝). 이 두 버튼은 지금 잠기는 경우가 없지만
            규칙을 한 화면 안에서 통일해 둔다. */}
        <button
          type="button"
          onClick={onCancel}
          className="bg-card text-action-lg hover:bg-muted disabled:bg-muted disabled:text-muted-foreground disabled:opacity-100 h-[72px] flex-1 border-2 active:translate-y-1"
        >
          취소
        </button>
        <button
          type="button"
          onClick={submit}
          className="bg-primary text-primary-foreground text-action-lg disabled:bg-muted disabled:text-muted-foreground h-[72px] flex-1 border-2 opacity-100 active:translate-y-1"
        >
          적용
        </button>
      </div>
    </div>
  );
}

/** 확정본 253~259행: 라벨 + 56px 입력 + 우측 단위 첨자 */
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
      <label htmlFor={`manual-${name}`} className="text-label-sm mb-1 block">
        {label}
      </label>
      <div className="relative">
        <Input
          id={`manual-${name}`}
          type="text"
          inputMode="decimal"
          placeholder="--"
          aria-invalid={error ? true : undefined}
          className="text-measurement-xl h-[56px] w-full rounded-none pr-11 pl-3 tabular-nums md:text-3xl"
          {...form.register(name)}
        />
        <span className="text-label-sm text-muted-foreground absolute top-[18px] right-3">
          {unit}
        </span>
      </div>
      {error ? (
        <p role="alert" className="text-status-error mt-1 text-xs">
          {error.message}
        </p>
      ) : note ? (
        <p className="text-muted-foreground mt-1 text-xs">{note}</p>
      ) : null}
    </div>
  );
}
