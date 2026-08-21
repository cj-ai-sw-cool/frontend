import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

/**
 * ⚠️ Stitch 브루탈리즘 적용 — className 문자열만 바꿨다(구조·props 동일).
 *
 * 샘플 근거: 569행 경고 배지 `bg-error border-2 border-on-background`,
 *            561행 SKU 라벨 `bg-on-background text-white ... border border-white`.
 * 즉 샘플에서는 **채워진 배지도 테두리를 두른다.** 그래서 outline 뿐 아니라
 * default / secondary / destructive 에도 border-border 를 붙였다.
 * ghost / link 는 배경 없는 텍스트 취급이라 그대로 둔다.
 *
 * `rounded-4xl` 은 안 고쳤다 — --radius 가 0.125rem 으로 내려가면서
 * 파생값인 --radius-4xl 도 0.325rem(≈5px)이 되어, 알약 모양이 저절로 각진
 * 사각형이 된다. 클래스를 일일이 바꿀 필요가 없다.
 *
 * 높이(h-5=20px)는 유지했다. 테두리가 2px 로 두꺼워지면 안쪽 여백이 4px 줄지만
 * text-xs 의 line-height 가 16px 이라 딱 맞아 잘리지 않는다(20 - 2·2 = 16).
 */
const badgeVariants = cva(
  "group/badge inline-flex h-5 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-4xl border-2 border-transparent px-2 py-0.5 text-xs font-medium whitespace-nowrap transition-all focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&>svg]:pointer-events-none [&>svg]:size-3!",
  {
    variants: {
      variant: {
        default:
          "border-border bg-primary text-primary-foreground [a]:hover:bg-primary/80",
        secondary:
          "border-border bg-secondary text-secondary-foreground [a]:hover:bg-secondary/80",
        destructive:
          "border-border bg-destructive/10 text-destructive focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:focus-visible:ring-destructive/40 [a]:hover:bg-destructive/20",
        outline:
          "border-border text-foreground [a]:hover:bg-muted [a]:hover:text-muted-foreground",
        ghost:
          "hover:bg-muted hover:text-muted-foreground dark:hover:bg-muted/50",
        link: "text-primary underline-offset-4 hover:underline",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "span"

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
