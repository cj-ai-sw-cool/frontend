import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * ⚠️ Stitch 브루탈리즘 적용 — className 문자열만 바꿨다(구조·props 동일).
 *
 * 바뀐 것
 *   · 1px 옅은 링(원본의 ring 조합) → `border-2`(2px 검정 테두리).
 *     ring 은 레이아웃을 차지하지 않는 바깥 테두리라 각진 룩에서 흐릿하게 보인다.
 *     샘플은 모든 패널을 `border-2 border-on-background` 로 그린다(486·498·558·566행).
 *   · CardFooter 의 구분선도 border-t → border-t-2. 샘플의 패널 내부 구분선이
 *     `border-b-2 border-on-background`(501행)라서 맞췄다.
 *
 * 하드 섀도우를 **일부러 넣지 않았다.**
 *   샘플 P2 화면에서 그림자가 붙은 것은 (a) 버튼 2개(582·615행)와
 *   (b) "지금 선택된" 품목 행(510행)뿐이고, 패널 4개(486·498·558·566행)는
 *   전부 테두리만 있고 그림자가 없다. 즉 샘플에서 그림자는 "떠 있는 표면"이 아니라
 *   "누를 수 있다 / 지금 선택돼 있다"는 신호다. 카드는 둘 다 아니다.
 *   게다가 우리 화면은 카드를 그리드로 여러 개 늘어놓아서, 전부에 4px 오프셋을 주면
 *   그림자끼리 겹쳐 지저분해진다. 떠 보이는 효과는 회색 바탕(#dcd9d9) 위
 *   흰 카드(#ffffff) + 2px 검정 테두리로 이미 충분히 난다.
 *   → 진짜로 떠 있는 표면인 Dialog / SelectContent 에만 그림자를 붙였다.
 */
function Card({
  className,
  size = "default",
  ...props
}: React.ComponentProps<"div"> & { size?: "default" | "sm" }) {
  return (
    <div
      data-slot="card"
      data-size={size}
      className={cn(
        "group/card flex flex-col gap-(--card-spacing) overflow-hidden rounded-xl border-2 bg-card py-(--card-spacing) text-sm text-card-foreground [--card-spacing:--spacing(4)] has-data-[slot=card-footer]:pb-0 has-[>img:first-child]:pt-0 data-[size=sm]:[--card-spacing:--spacing(3)] data-[size=sm]:has-data-[slot=card-footer]:pb-0 *:[img:first-child]:rounded-t-xl *:[img:last-child]:rounded-b-xl",
        className
      )}
      {...props}
    />
  )
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        "group/card-header @container/card-header grid auto-rows-min items-start gap-1 rounded-t-xl px-(--card-spacing) has-data-[slot=card-action]:grid-cols-[1fr_auto] has-data-[slot=card-description]:grid-rows-[auto_auto] [.border-b]:pb-(--card-spacing)",
        className
      )}
      {...props}
    />
  )
}

function CardTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-title"
      className={cn(
        "font-heading text-base leading-snug font-medium group-data-[size=sm]/card:text-sm",
        className
      )}
      {...props}
    />
  )
}

function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

function CardAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-action"
      className={cn(
        "col-start-2 row-span-2 row-start-1 self-start justify-self-end",
        className
      )}
      {...props}
    />
  )
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-content"
      className={cn("px-(--card-spacing)", className)}
      {...props}
    />
  )
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer"
      className={cn(
        "flex items-center rounded-b-xl border-t-2 bg-muted/50 p-(--card-spacing)",
        className
      )}
      {...props}
    />
  )
}

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardAction,
  CardDescription,
  CardContent,
}
