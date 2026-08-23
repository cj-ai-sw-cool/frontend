"use client";

import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import type { BoxType } from "@/lib/types";

/**
 * 추천 박스 표시 + 오버라이드 — docs/01-mvp.md §3 우상단.
 *   표시: docs/02-api-spec.md §3-2 의 `recommendedBox` / `finalBox` / `fillerRecommended`
 *   변경: §3-3 `PUT /shipments/{id}/box`
 *
 * 순수 표시용(presentational): 셀렉트에서 고른 boxTypeId 를 `onOverride` 로 위에 넘길 뿐,
 * API 호출은 부모가 한다.
 *
 * 오버라이드를 "덮어쓰기"로 그리지 않는 이유
 *   계약이 `recommendedBoxId` 와 `finalBoxId` 를 **둘 다** 보존한다(§3-3). 추천이 왜 틀렸는지
 *   나중에 되짚을 수 있어야 하므로, 화면에서도 추천값을 지우지 않고 나란히 보여준다.
 *
 * 단위는 cm 고정 (D-03).
 */
export function BoxRecommendationPanel({
  recommendedBox,
  finalBox,
  fillerRecommended,
  availableBoxes,
  onOverride,
  isPending = false,
  error,
}: {
  /**
   * 계약상 `ShipmentDetail.recommendedBox` 는 null 이 될 수 있어서 그대로 받는다.
   * 부모에서 걸러내면 추천이 없을 때 패널이 통째로 사라져 이유를 알 수 없다.
   */
  recommendedBox: BoxType | null;
  /** 오버라이드된 박스. 없으면 null */
  finalBox: BoxType | null;
  fillerRecommended: boolean;
  /** 3-4 `GET /box-types` 결과 — 오버라이드 후보 */
  availableBoxes: BoxType[];
  onOverride: (boxTypeId: number) => void;
  isPending?: boolean;
  error?: string | null;
}) {
  // 실제로 포장에 쓰이는 박스. 서버도 final 우선, 없으면 recommended 로 차감한다 (§3-8)
  const effectiveBox = finalBox ?? recommendedBox;
  const isOverridden =
    finalBox !== null &&
    recommendedBox !== null &&
    finalBox.boxTypeId !== recommendedBox.boxTypeId;

  return (
    <div className="space-y-4">
      {effectiveBox === null ? (
        <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          추천 박스가 없습니다. 아래에서 직접 선택하세요.
        </div>
      ) : (
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            {/* Stitch 의 measurement-xl(32px)에 대응 — 멀리서도 박스 호수가 보여야 한다 */}
            <span className="text-3xl leading-none font-bold">{effectiveBox.name}</span>
            {isOverridden ? <Badge variant="secondary">오버라이드됨</Badge> : null}
          </div>

          <dl className="grid grid-cols-[auto_1fr] gap-x-3 text-sm">
            <dt className="text-muted-foreground">내치수</dt>
            <dd className="tabular-nums">{formatInnerCm(effectiveBox.innerCm)}</dd>

            <dt className="text-muted-foreground">박스 재고</dt>
            <dd
              className={
                effectiveBox.stockQty === 0
                  ? "font-medium text-status-error tabular-nums"
                  : "tabular-nums"
              }
            >
              {effectiveBox.stockQty}개{effectiveBox.stockQty === 0 ? " (품절)" : ""}
            </dd>
          </dl>
        </div>
      )}

      {isOverridden && recommendedBox !== null ? (
        <p className="text-sm text-muted-foreground">
          원래 추천: <span className="font-medium">{recommendedBox.name}</span> (
          {formatInnerCm(recommendedBox.innerCm)})
        </p>
      ) : null}

      {fillerRecommended ? (
        <div className="rounded-lg bg-accent px-3 py-2 text-sm text-accent-foreground">
          <span className="font-medium">충전재 권장</span> — 내용물과 박스 사이 빈 공간이
          있습니다. 완충재를 채워 주세요.
        </div>
      ) : null}

      <Separator />

      <div className="space-y-2">
        <Label htmlFor="box-override" className="text-base">
          박스 변경
        </Label>
        <Select
          value={effectiveBox === null ? undefined : String(effectiveBox.boxTypeId)}
          disabled={isPending || availableBoxes.length === 0}
          onValueChange={(value) => onOverride(Number(value))}
        >
          <SelectTrigger id="box-override" className="h-12 w-full text-base">
            <SelectValue placeholder="박스를 선택하세요" />
          </SelectTrigger>
          <SelectContent>
            {availableBoxes.map((box) => (
              <SelectItem
                key={box.boxTypeId}
                value={String(box.boxTypeId)}
                // 재고 없는 박스는 고를 수 없다 — 3-8 에서 어차피 차감에 실패한다
                disabled={box.stockQty === 0}
              >
                {box.name} · {formatInnerCm(box.innerCm)} · 재고 {box.stockQty}개
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {error ? (
          <p role="alert" className="text-sm text-status-error">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}

/** `[27.0, 20.0, 15.0]` → `27.0 × 20.0 × 15.0 cm` (D-03: 길이는 cm 소수 1자리) */
function formatInnerCm(innerCm: BoxType["innerCm"]): string {
  return `${innerCm.map((value) => value.toFixed(1)).join(" × ")} cm`;
}
