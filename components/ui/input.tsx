import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * ⚠️ Stitch 브루탈리즘 적용 — className 문자열만 바꿨다(구조·props 동일).
 *
 * 샘플 근거: 489·517·531행
 *   `border-2 border-on-background bg-surface-container-lowest`
 *
 * 바뀐 것
 *   1. `border` → `border-2`. 색은 그대로 `border-input`(= 검정 토큰)이라 지정 불필요.
 *   2. `bg-transparent` → `bg-card`. 샘플 입력창은 surface-container-lowest(흰색)이고,
 *      바탕이 회색(#dcd9d9)이 된 지금 투명으로 두면 입력 가능한 칸이 안 보인다.
 *   3. ⚠️ `disabled:bg-input/50`, `dark:bg-input/30`, `dark:disabled:bg-input/80` 제거.
 *      --input 이 이제 검정(라이트)/흰색(다크)이라 이걸 **배경**으로 쓰면
 *      비활성 입력이 짙은 회색(또는 흰) 덩어리가 된다. shadcn 이 --input 을
 *      "테두리색 + 비활성 배경"으로 겸용하던 것을 여기서 갈라, 배경은 --muted 로 옮겼다.
 *      (globals.css 의 --input 주석과 짝을 이룬다)
 */
function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "h-8 w-full min-w-0 rounded-lg border-2 border-input bg-card px-2.5 py-1 text-base transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
        className
      )}
      {...props}
    />
  )
}

export { Input }
