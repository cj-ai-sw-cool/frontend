import { clsx, type ClassValue } from "clsx"
import { extendTailwindMerge } from "tailwind-merge"

const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      // 'font-size' 그룹에 우리 커스텀 텍스트 크기 토큰들을 추가 등록
      "font-size": [
        "text-action-lg",
        "text-measurement-xl",
        "text-sub-action-md",
        "text-label-sm",
      ],
    },
  },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
