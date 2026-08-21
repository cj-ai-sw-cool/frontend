import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

/**
 * ⚠️ Stitch 브루탈리즘 적용 — 스타일(className 문자열)만 바꿨다.
 *    구조·props·variant 이름은 shadcn 원본 그대로다(다른 담당자 코드가 깨지지 않도록).
 *
 * 샘플 근거 (localWork/stitch-sample.html, P2 화면) — ⚠️ 아래 스펙은 Tailwind 스캐너가
 * 주석 속 문자열까지 클래스 후보로 주워 쓰지 않는 죽은 CSS 규칙을 만들지 않도록
 * 일부러 클래스 문법이 아닌 서술형으로 적었다. 원문은 샘플 해당 줄을 볼 것.
 *   582행 "박스 변경" 보조 버튼
 *     테두리 2px(on-background) · 하드 섀도우 오프셋 4px / 블러 0 / 색 rgb(27 28 28)
 *     누를 때: 아래로 4px 이동 + 그림자 제거
 *   615행 "포장 완료" 주요 버튼
 *     테두리 2px(on-background) · 하드 섀도우 오프셋 6px / 블러 0
 *     누를 때: 오른쪽·아래로 6px 이동 + 그림자 제거
 *
 * 여기서 정한 것
 *   · 테두리 두께만 border-2 로 올린다. **색은 지정하지 않는다** — --border 토큰이
 *     이미 검정(#1b1c1c)이라 `border-border` 한 마디면 샘플과 같은 색이 나온다.
 *   · 하드 섀도우(블러 0)는 오프셋 4px 하나로 통일했다. 샘플은 주요 버튼만 6px 지만,
 *     우리 버튼은 h-8~h-9(32~36px)로 샘플의 h-[180px] 대비 훨씬 작아서 6px 오프셋이
 *     버튼 높이의 1/5 을 먹는다. 4px 로 맞추고 강조는 색(variant)에 맡겼다.
 *   · 눌림은 "그림자 크기만큼 오른쪽·아래로 밀고 그림자를 끈다"는 샘플 규칙 그대로다.
 *     `not-aria-[haspopup]` 조건은 원본에서 가져왔다 — 드롭다운 트리거는 열린 뒤에도
 *     :active 가 남아 위치가 틀어지므로 제외한다.
 *   · ghost / link 는 테두리도 그림자도 넣지 않는다. 샘플에도 대응이 없고,
 *     "떠 있는 것처럼 보이는 것"은 실제로 누를 수 있는 덩어리에만 붙여야 의미가 있다.
 *   · outline 에 있던 `dark:border-input dark:bg-input/30 dark:hover:bg-input/50` 는 뺐다.
 *     --input 이 이제 테두리색 전용(라이트 검정 / 다크 흰색)이라 배경으로 쓰면
 *     다크에서 버튼이 흰 덩어리가 된다. 배경은 bg-background + hover:bg-muted 로 통일.
 */
const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-lg border-2 border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:not-aria-[haspopup]:translate-x-[4px] active:not-aria-[haspopup]:translate-y-[4px] active:not-aria-[haspopup]:shadow-none disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "border-border bg-primary text-primary-foreground shadow-[4px_4px_0px_0px_var(--color-foreground)] hover:bg-primary/80",
        outline:
          "border-border bg-background shadow-[4px_4px_0px_0px_var(--color-foreground)] hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground",
        secondary:
          "border-border bg-secondary text-secondary-foreground shadow-[4px_4px_0px_0px_var(--color-foreground)] hover:bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_5%)] aria-expanded:bg-secondary aria-expanded:text-secondary-foreground",
        ghost:
          "hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:hover:bg-muted/50",
        destructive:
          "border-border bg-destructive/10 text-destructive shadow-[4px_4px_0px_0px_var(--color-foreground)] hover:bg-destructive/20 focus-visible:border-destructive/40 focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:hover:bg-destructive/30 dark:focus-visible:ring-destructive/40",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default:
          "h-8 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        xs: "h-6 gap-1 rounded-[min(var(--radius-md),10px)] px-2 text-xs in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-7 gap-1 rounded-[min(var(--radius-md),12px)] px-2.5 text-[0.8rem] in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-9 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        icon: "size-8",
        "icon-xs":
          "size-6 rounded-[min(var(--radius-md),10px)] in-data-[slot=button-group]:rounded-lg [&_svg:not([class*='size-'])]:size-3",
        "icon-sm":
          "size-7 rounded-[min(var(--radius-md),12px)] in-data-[slot=button-group]:rounded-lg",
        "icon-lg": "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
