"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { ApiError } from "@/lib/api";
import type {
  Category,
  ConfirmRequest,
  ConfirmResponse,
  Handling,
  MeasurementResponse,
  Product,
} from "@/lib/types";

/**
 * 취급속성·분류 입력 + 측정 확정 — docs/02-api-spec.md §1-4
 * `POST /inbound/measurements/{sessionId}/confirm`.
 * Stitch 샘플 P1 화면 우측 컬럼(950~1049행 / 1340~1432행)에 대응한다.
 *
 * 순수 표시용(presentational): API 를 부르지 않는다. 폼 상태만 스스로 들고, 확정 요청은
 * 계약 타입(`ConfirmRequest`)으로 만들어 `onConfirm` 으로 위에 넘긴다.
 *
 * ⚠️ 이 폼의 필드는 **두 개의 다른 API 로 갈린다.** 한 화면에 같이 놓여 있어서 헷갈리기 쉽다.
 *   1-4 confirm 이 받는 것 : handling(냉장/파손/비정형) · dims(수기일 때) · weightKg
 *   1-4 가 받지 않는 것    : 제품 이름 · 대분류 · 중분류
 *                            → 이건 1-2 `POST /inbound/products` 의 입력이다(미등록 바코드 경로).
 *                              기등록 상품에서는 1-1 응답을 그대로 **보여주는** 값일 뿐이다.
 *   그래서 아래 onSubmit 은 이름·분류를 요청에 담지 않는다. 담으면 계약 위반이다.
 *
 * ── 치수 축 규약 (D-18) ────────────────────────────────────────────────
 *   `heightCm` 은 카메라 기하에서 별도 산출하는 실제 높이라 정렬 대상이 아니고,
 *   나머지 두 변은 **긴 쪽이 가로(widthCm), 짧은 쪽이 세로(lengthCm)** 다.
 *   불변식은 `widthCm >= lengthCm` 이고, 추론 응답이든 수기 입력(MANUAL)이든
 *   **서버가 가로·세로를 스왑 정렬한 뒤 저장**한다(높이는 건드리지 않는다).
 *
 *   화면이 이걸 알아야 하는 이유: 작업자가 가로 30 / 세로 45 로 넣어도 저장은 45 / 30 이 된다.
 *   화면이 아무 말도 안 하면 "내가 넣은 값과 저장된 값이 다르다"는 혼란이 생긴다.
 *   그래서 수기 입력 칸 바로 위에 안내 문구를 붙였다.
 *
 *   **검증으로 막지 않는다.** 자동 정렬이 결정이다 — 물리적으로 같은 값이라 작업자가 판단할
 *   여지가 없고, 시연 중에 검증 실패 화면을 띄울 이유가 없다. 그래서 가로<세로 입력도 그대로
 *   통과시킨다. 안내가 유일한 장치인 이유는 1-4 응답에 dims 가 없어서(§1-4) 정렬 결과를
 *   되받아 보여줄 수단이 화면에 없기 때문이다.
 */

/**
 * 폼 스키마 — **최소한만** 넣었다.
 *
 * TODO(P1): 검증 규칙을 채운다.
 *   · 수기 확정(MANUAL)일 때 dims 3개가 모두 양수여야 한다 → `superRefine` 으로 옮길 것.
 *     (지금은 아래 `parseManualDims` 가 제출 시점에 setError 로 대신 처리한다)
 *   · 무게: 세션에 저울값이 없으면 필수다(§1-4 — 없으면 400 VALIDATION_ERROR).
 *   · 길이 소수 1자리 / 무게 소수 3자리 상한 (D-03).
 *   · 제품 이름·중분류는 1-2 수기 등록 폼으로 옮겨야 할 수도 있다(위 주석 참고).
 *     그때는 이 스키마에서 빼고 그쪽 스키마로 이사시킬 것.
 * ⚠️ 가로>=세로 검증은 **넣지 않는다** (D-18 — 서버가 정렬한다).
 */
const confirmFormSchema = z.object({
  productName: z.string().min(1, "제품 이름을 입력하세요"),
  largeCategoryCode: z.string(),
  mediumCategoryCode: z.string(),
  refrigerate: z.boolean(),
  fragile: z.boolean(),
  irregular: z.boolean(),
  // 치수·무게는 문자열로 받는다 — 비어 있는 입력칸을 숫자로 강제 변환하면 0 이 되어
  // "안 넣음"과 "0 을 넣음"을 구분할 수 없다. 숫자 변환은 제출 시점에 한 번만 한다.
  widthCm: z.string(),
  lengthCm: z.string(),
  heightCm: z.string(),
  weightKg: z.string(),
});

type ConfirmFormValues = z.infer<typeof confirmFormSchema>;

export function ConfirmForm({
  product,
  measurement,
  categories,
  isCategoriesLoading,
  isManualOpen,
  onToggleManual,
  onConfirm,
  onRemeasure,
  isConfirming,
  isMeasuring,
  confirmResult,
  confirmError,
}: {
  /** 1-1 로 잡힌 상품. 스캔 전이면 null */
  product: Product | null;
  /** 1-3 응답. 촬영 전이면 undefined */
  measurement?: MeasurementResponse;
  /** 1-7 분류 목록 — 대/중분류가 한 배열에 섞여 온다 (D-13) */
  categories: Category[];
  isCategoriesLoading: boolean;
  /** 수기 입력 칸이 열려 있는가. MEASURE_FAILED 면 부모가 자동으로 연다 (§1-3) */
  isManualOpen: boolean;
  onToggleManual: (open: boolean) => void;
  /** 계약 타입 그대로 위로 올린다. 실제 호출은 부모가 한다 */
  onConfirm: (request: ConfirmRequest) => void;
  /** 재촬영 = 같은 productId 로 1-3 재호출 (§1-3) */
  onRemeasure: () => void;
  isConfirming: boolean;
  isMeasuring: boolean;
  /** 1-4 성공 응답. 확정된 뒤에는 폼을 잠근다 */
  confirmResult?: ConfirmResponse;
  confirmError?: Error | null;
}) {
  const inferred = measurement?.status === "INFERRED" ? measurement : null;

  /**
   * 폼 값은 `defaultValues` 로만 잡는다(RHF 의 `values` 동기화나 useEffect reset 을 쓰지 않는다).
   * 대신 부모가 `key` 를 상품·세션 기준으로 주기 때문에, 새 스캔이나 새 촬영이 오면
   * 컴포넌트가 통째로 다시 마운트되면서 기본값이 새로 잡힌다.
   * 한 세션 안에서는 리렌더가 몇 번 일어나도 작업자가 입력한 값이 지워지지 않는다.
   */
  const form = useForm({
    resolver: zodResolver(confirmFormSchema),
    defaultValues: buildDefaults(product, measurement, categories),
  });

  /**
   * 중분류 선택지를 좁히려면 지금 고른 대분류를 알아야 한다.
   * `form.watch()` 가 아니라 `useWatch` 를 쓰는 이유: watch 는 렌더마다 새 함수를 돌려줘
   * React Compiler 가 이 컴포넌트 전체의 메모이제이션을 포기한다(빌드 경고로 나온다).
   * useWatch 는 훅이라 그 문제가 없고, 구독 대상도 이 필드 하나로 좁혀진다.
   */
  const largeCategoryCode = useWatch({
    control: form.control,
    name: "largeCategoryCode",
  });
  const largeCategories = categories.filter((c) => c.level === "LARGE");
  const mediumCategories = categories.filter(
    (c) => c.level === "MEDIUM" && c.parentCode === largeCategoryCode,
  );

  const isConfirmed = confirmResult !== undefined;
  const isBusy = isConfirming || isMeasuring;
  /** 승인은 게이트를 통과한 세션에서만 (§1-3 / §1-4). 실제 방어선은 서버(409 GATE_NOT_PASSED) */
  const canApprove = inferred !== null && inferred.gatePassed && !isConfirmed && !isBusy;
  /** 수기 확정은 MEASURE_FAILED 세션 포함 **항상** 허용된다 (§1-4) */
  const canManualConfirm = measurement !== undefined && !isConfirmed && !isBusy;

  const submit = (method: "APPROVE" | "MANUAL") =>
    form.handleSubmit((values) => {
      const handling: Handling = {
        refrigerate: values.refrigerate,
        fragile: values.fragile,
        irregular: values.irregular,
      };
      // 세션 저울값을 그대로 되돌려 보내는 것도 계약상 유효하다(§1-4 — 값을 주면 수기 수정으로 본다).
      // TODO(P1): 작업자가 무게를 건드리지 않았으면 아예 생략(null)해서 세션값을 쓰게 하는 편이
      //   의도가 분명하다. dirtyFields 로 판별할 수 있다.
      const weightKg = toNumber(values.weightKg);

      if (method === "APPROVE") {
        onConfirm({ method: "APPROVE", weightKg, handling });
        return;
      }

      const dims = parseManualDims(values);
      if (dims === null) {
        // 최소 검증 — 세 변이 다 숫자여야 수기 확정이 성립한다
        for (const field of ["widthCm", "lengthCm", "heightCm"] as const) {
          if (toNumber(values[field]) === null) {
            form.setError(field, { message: "숫자를 입력하세요" });
          }
        }
        return;
      }
      // ⚠️ 여기서 가로·세로를 정렬하지 않는다 — 서버가 한다 (D-18).
      onConfirm({ method: "MANUAL", dims, weightKg, handling });
    });

  return (
    <div className="space-y-4">
      {/* ── 제품 정보 (샘플 958~980행) ──────────────────────
          1-4 가 아니라 1-1 표시값 / 1-2 입력값이다. 위 파일 주석 참고. */}
      <div className="space-y-2">
        <Label htmlFor="product-name">제품 이름</Label>
        <Input
          id="product-name"
          className="h-12 text-base md:text-base"
          placeholder="제품명 스캔 대기…"
          disabled={isConfirmed}
          aria-invalid={form.formState.errors.productName ? true : undefined}
          {...form.register("productName")}
        />
        {form.formState.errors.productName ? (
          <p role="alert" className="text-sm text-status-error">
            {form.formState.errors.productName.message}
          </p>
        ) : null}
      </div>

      {/* 대분류 / 중분류 — 1-7 코드 드롭다운 (D-13).
          화면은 `code` 만 주고받는다. 이름은 표시 전용이다. */}
      <div className="grid grid-cols-2 gap-3">
        <Controller
          control={form.control}
          name="largeCategoryCode"
          render={({ field }) => (
            <div className="min-w-0 space-y-2">
              <Label htmlFor="category-large">대분류</Label>
              <Select
                value={field.value === "" ? undefined : field.value}
                disabled={isCategoriesLoading || isConfirmed}
                onValueChange={(value) => {
                  field.onChange(value);
                  // 대분류가 바뀌면 중분류는 더 이상 유효하지 않다(부모가 달라졌다)
                  form.setValue("mediumCategoryCode", "");
                }}
              >
                <SelectTrigger id="category-large" className="h-12 w-full text-base">
                  <SelectValue placeholder={isCategoriesLoading ? "불러오는 중…" : "선택…"} />
                </SelectTrigger>
                <SelectContent>
                  {largeCategories.map((category) => (
                    <SelectItem key={category.code} value={category.code}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        />

        <Controller
          control={form.control}
          name="mediumCategoryCode"
          render={({ field }) => (
            <div className="min-w-0 space-y-2">
              <Label htmlFor="category-medium">중분류</Label>
              <Select
                value={field.value === "" ? undefined : field.value}
                // 대분류를 먼저 골라야 선택지가 생긴다 (parentCode 로 걸러지므로)
                disabled={isCategoriesLoading || isConfirmed || mediumCategories.length === 0}
                onValueChange={field.onChange}
              >
                <SelectTrigger id="category-medium" className="h-12 w-full text-base">
                  <SelectValue placeholder="선택…" />
                </SelectTrigger>
                <SelectContent>
                  {mediumCategories.map((category) => (
                    <SelectItem key={category.code} value={category.code}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        />
      </div>

      {/* ── 계약에 없는 필드 ────────────────────────────────
          샘플·요청서에는 "특이사항"과 "등급"이 있지만 docs/02-api-spec.md 에 대응 필드가 없다.
          (샘플의 "특이사항"은 서브 촬영 사진 슬롯 이름이기도 하다 — 943행)
          TODO(계약없음): 저장 경로를 정해야 한다. 셋 중 하나다.
            ① 1-2 CreateProductRequest 에 필드를 추가한다
            ② 1-4 ConfirmRequest 에 추가한다(취급속성과 함께 product 에 기록되는 자리)
            ③ 화면 전용으로 두고 서버에 보내지 않는다(= 사실상 기능 없음)
          결정 전까지는 잠가 둔다 — 입력받아 놓고 버리면 작업자가 저장됐다고 오해한다. */}
      <div className="space-y-3 border-2 border-dashed p-3">
        <p className="text-xs font-medium text-muted-foreground">
          아래 두 칸은 API 계약에 대응 필드가 없어 잠겨 있습니다 (저장 경로 미정)
        </p>
        <div className="space-y-2">
          <Label htmlFor="remark">특이사항</Label>
          <Input id="remark" className="h-12 text-base md:text-base" disabled placeholder="계약 미정" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="grade">등급</Label>
          <Input id="grade" className="h-12 text-base md:text-base" disabled placeholder="계약 미정" />
        </div>
      </div>

      <Separator />

      {/* ── 취급 주의사항 (샘플 1007~1023행) ────────────────
          1-4 요청의 `handling` 이다. 기본값은 1-3 응답의 handlingDefaults
          (= 서버의 category_attribute_map 기본값)에서 온다. 작업자가 덮어쓸 수 있다. */}
      <fieldset className="space-y-2" disabled={isConfirmed}>
        <legend className="mb-2 text-sm font-medium">취급 주의사항 (다중선택)</legend>
        <div className="flex flex-col gap-2">
          <HandlingToggle control={form} name="refrigerate" label="냉장 필요" />
          <HandlingToggle control={form} name="fragile" label="파손 주의" />
          <HandlingToggle control={form} name="irregular" label="비정형" />
        </div>
      </fieldset>

      <Separator />

      {/* ── 수기 입력 (샘플 982~1005행 — 샘플은 이 자리를 잠근 상태로 그렸다) ──
          §1-3 이 정한 동작: MEASURE_FAILED 면 프론트가 이 칸을 **자동으로 연다.**
          게이트 미통과일 때도 작업자가 직접 열어 수기로 확정할 수 있다(§1-4 MANUAL 은 항상 허용). */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm font-medium">수기 입력 (가로 · 세로 · 높이 · 무게)</span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isConfirmed}
            aria-pressed={isManualOpen}
            onClick={() => onToggleManual(!isManualOpen)}
          >
            {isManualOpen ? "접기" : "수동 입력"}
          </Button>
        </div>

        {isManualOpen ? (
          <div className="space-y-3">
            {/* ★ D-18 안내 — 이 문구가 축 규약을 작업자에게 알리는 유일한 장치다.
                검증으로 막지 않는 이유와 응답에 dims 가 없어 되받을 수 없다는 사정은
                이 파일 상단 주석에 적어 뒀다. */}
            <p className="border-2 bg-muted p-3 text-sm">
              <span className="font-medium">가로·세로는 서버가 자동 정렬합니다.</span> 긴 쪽이
              가로, 짧은 쪽이 세로로 저장되므로 순서를 바꿔 입력해도 됩니다. 높이는 그대로
              저장됩니다.
            </p>

            <div className="grid grid-cols-2 gap-3">
              <DimensionInput
                form={form}
                name="widthCm"
                label="가로"
                unit="cm"
                disabled={isConfirmed}
              />
              <DimensionInput
                form={form}
                name="lengthCm"
                label="세로"
                unit="cm"
                disabled={isConfirmed}
              />
              <DimensionInput
                form={form}
                name="heightCm"
                label="높이"
                unit="cm"
                disabled={isConfirmed}
              />
              <DimensionInput
                form={form}
                name="weightKg"
                label="무게"
                unit="kg"
                disabled={isConfirmed}
              />
            </div>

            <Button
              type="button"
              size="lg"
              variant="secondary"
              className="h-14 w-full text-base font-semibold"
              disabled={!canManualConfirm}
              onClick={submit("MANUAL")}
            >
              {isConfirming ? "확정 중…" : "수기 확정"}
            </Button>
          </div>
        ) : null}
      </div>

      {confirmError ? (
        <Alert variant="destructive">
          <AlertTitle>{describeConfirmFailure(confirmError).title}</AlertTitle>
          <AlertDescription>{describeConfirmFailure(confirmError).detail}</AlertDescription>
        </Alert>
      ) : null}

      {isConfirmed ? (
        <Alert>
          <AlertTitle>치수가 확정되었습니다</AlertTitle>
          <AlertDescription>
            확정 방식 {confirmResult.dimMethod === "INFERRED" ? "추론 승인" : "수기 입력"} · 이제
            아래에서 수량을 입고하세요 (재고는 확정이 아니라 입고에서만 늘어납니다 — D-09).
          </AlertDescription>
        </Alert>
      ) : null}

      {/* ── 하단 액션 (샘플 1039~1048행: 촬영 1 : DB 입력 2) ──
          샘플의 "촬영"은 첫 촬영과 재촬영을 겸한다. 우리도 같은 버튼 하나로 둔다. */}
      <div className="flex gap-3">
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="h-16 flex-1 text-base font-semibold"
          disabled={product === null || isBusy || isConfirmed}
          onClick={onRemeasure}
        >
          {isMeasuring ? "촬영 중…" : measurement === undefined ? "촬영" : "재촬영"}
        </Button>

        <Button
          type="button"
          size="lg"
          className="h-16 flex-[2] text-lg font-semibold"
          disabled={!canApprove}
          onClick={submit("APPROVE")}
        >
          {isConfirming ? "확정 중…" : "승인"}
        </Button>
      </div>

      <p className="text-center text-sm text-muted-foreground">
        {inferred !== null && !inferred.gatePassed
          ? "게이트 미통과 상태라 승인이 잠겨 있습니다. 재촬영하거나 수기로 확정하세요."
          : "승인하면 추론된 치수가 그대로 상품에 기록됩니다."}
      </p>
    </div>
  );
}

/* ── 조각들 ──────────────────────────────────────────────── */

/**
 * 취급속성 토글 — 샘플은 체크박스가 아니라 큰 버튼 3개다(1010~1021행).
 * 장갑 낀 손을 전제한 크기라 그대로 따랐다. components/ui 에 Checkbox 가 없기도 하다.
 */
function HandlingToggle({
  control,
  name,
  label,
}: {
  control: ReturnType<typeof useForm<ConfirmFormValues>>;
  name: "refrigerate" | "fragile" | "irregular";
  label: string;
}) {
  return (
    <Controller
      control={control.control}
      name={name}
      render={({ field }) => (
        <Button
          type="button"
          variant={field.value ? "secondary" : "outline"}
          size="lg"
          aria-pressed={field.value}
          onClick={() => field.onChange(!field.value)}
          className="h-14 w-full text-base font-semibold aria-pressed:bg-accent"
        >
          {label}
          {field.value ? " ✓" : ""}
        </Button>
      )}
    />
  );
}

/** 수기 치수 한 칸 — 라벨 + 숫자 입력 + 단위 (샘플 988~991행) */
function DimensionInput({
  form,
  name,
  label,
  unit,
  disabled,
}: {
  form: ReturnType<typeof useForm<ConfirmFormValues>>;
  name: "widthCm" | "lengthCm" | "heightCm" | "weightKg";
  label: string;
  unit: string;
  disabled: boolean;
}) {
  const error = form.formState.errors[name];

  return (
    <div className="min-w-0 space-y-1">
      <Label htmlFor={`manual-${name}`} className="text-xs">
        {label} ({unit})
      </Label>
      <Input
        id={`manual-${name}`}
        type="text"
        inputMode="decimal"
        placeholder="--"
        disabled={disabled}
        aria-invalid={error ? true : undefined}
        className="h-12 text-base tabular-nums md:text-base"
        {...form.register(name)}
      />
      {error ? (
        <p role="alert" className="text-xs text-status-error">
          {error.message}
        </p>
      ) : null}
    </div>
  );
}

/* ── 값 변환 ─────────────────────────────────────────────── */

/** 빈 칸·공백·숫자가 아닌 입력은 null 로 본다 ("안 넣음"과 0 을 구분하기 위해) */
function toNumber(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

/** 세 변이 전부 숫자일 때만 dims 를 만든다. 하나라도 비면 null (호출부가 에러 표시) */
function parseManualDims(values: ConfirmFormValues) {
  const widthCm = toNumber(values.widthCm);
  const lengthCm = toNumber(values.lengthCm);
  const heightCm = toNumber(values.heightCm);
  if (widthCm === null || lengthCm === null || heightCm === null) return null;
  return { widthCm, lengthCm, heightCm };
}

/**
 * 폼 기본값.
 * 이름·분류는 1-1 응답에서, 취급속성 기본값과 수기 치수 초기값은 1-3 응답에서 온다.
 * 수기 칸을 추론값으로 미리 채우는 이유: 수기 확정은 보통 "추론값을 조금 고치는" 작업이라
 * 빈 칸에서 시작하면 작업자가 네 값을 전부 다시 재야 한다.
 */
function buildDefaults(
  product: Product | null,
  measurement: MeasurementResponse | undefined,
  categories: Category[],
): ConfirmFormValues {
  const inferred = measurement?.status === "INFERRED" ? measurement : null;
  const handling = inferred?.handlingDefaults;

  /**
   * ⚠️ 계약 불일치 — 1-1 의 `product` 는 분류를 **이름**으로 준다(`categoryL`/`categoryM`).
   *    반면 1-2 는 **코드**를 받는다(`mediumCategoryCode`, D-13). 이름→코드 역조회가 필요한데,
   *    이건 D-13 이 서버에서 없애려던 바로 그 작업이다(동명 분류에서 충돌한다).
   *    TODO(P1): 1-1 응답에도 분류 코드를 실어 달라고 요청하거나(02 수정), 이 화면에서
   *      분류를 항상 작업자가 다시 고르게 할지 정한다. 지금은 이름이 유일하게 일치할 때만
   *      코드를 채우고, 애매하면 빈 값으로 둔다(잘못된 코드를 채우는 것보다 안전하다).
   */
  const large = matchByName(categories, "LARGE", product?.categoryL);
  const medium = categories.find(
    (c) => c.level === "MEDIUM" && c.parentCode === large?.code && c.name === product?.categoryM,
  );

  return {
    productName: product?.name ?? "",
    largeCategoryCode: large?.code ?? "",
    mediumCategoryCode: medium?.code ?? "",
    refrigerate: handling?.refrigerate ?? false,
    fragile: handling?.fragile ?? false,
    irregular: handling?.irregular ?? false,
    widthCm: inferred ? String(inferred.inferred.widthCm) : "",
    lengthCm: inferred ? String(inferred.inferred.lengthCm) : "",
    heightCm: inferred ? String(inferred.inferred.heightCm) : "",
    weightKg: measurement?.weightKg == null ? "" : String(measurement.weightKg),
  };
}

/** 같은 이름이 둘 이상이면 고르지 않는다 — 틀린 코드를 넣느니 비워 두는 편이 낫다 */
function matchByName(
  categories: Category[],
  level: Category["level"],
  name: string | undefined,
): Category | undefined {
  if (name === undefined) return undefined;
  const matches = categories.filter((c) => c.level === level && c.name === name);
  return matches.length === 1 ? matches[0] : undefined;
}

/**
 * 1-4 실패 안내.
 * 계약이 정한 실패는 409 `GATE_NOT_PASSED` / 409 `SESSION_ALREADY_CONFIRMED` /
 * 400 `VALIDATION_ERROR` 다. 코드별로 작업자가 할 행동이 다르므로 메시지를 가른다.
 * 판별은 `lib/api.ts` 의 `ApiError.is()` 를 쓴다 — 문자열 비교를 흩뿌리지 않기 위해서.
 */
function describeConfirmFailure(error: Error): { title: string; detail: string } {
  if (error instanceof ApiError) {
    if (error.is("GATE_NOT_PASSED")) {
      return {
        title: "게이트 미통과 세션은 승인할 수 없습니다",
        detail: "재촬영해서 신뢰도를 높이거나, 수기 입력으로 확정하세요.",
      };
    }
    if (error.is("SESSION_ALREADY_CONFIRMED")) {
      return {
        title: "이미 확정된 세션입니다",
        detail: "다시 확정할 수 없습니다. 새로 촬영하거나 수량 입고로 넘어가세요.",
      };
    }
    if (error.is("VALIDATION_ERROR")) {
      return {
        title: "입력값을 확정할 수 없습니다",
        detail: `${error.message} 무게가 비어 있으면 확정할 수 없습니다.`,
      };
    }
  }
  return { title: "측정 확정에 실패했습니다", detail: error.message };
}
