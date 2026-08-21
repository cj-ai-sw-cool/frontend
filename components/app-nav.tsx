"use client";

import { LayoutDashboard, PackageCheck, PackagePlus, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV } from "@/lib/nav";
import { cn } from "@/lib/utils";

/**
 * 좌측 세로 사이드바 — app/layout.tsx 의 고정 헤더(64px) 아래부터 바닥까지.
 *
 * 화면 목록의 정본은 `lib/nav.ts` 다(팀 공유 파일이라 수정하지 않는다).
 * 아이콘은 화면 정의가 아니라 표현이므로 그쪽에 넣지 않고 여기서 href 로 붙인다.
 *
 * `owner`(P1/P2/P3)는 여기 표시하지 않는다 — 담당자 표기는 팀 내부 정보라
 * 현장 작업자에게는 의미가 없다. 홈 화면 카드에는 그대로 남겨 뒀다.
 *
 * 색은 전부 `--sidebar*` 토큰 클래스로만 쓴다(globals.css 의 잠정 토큰).
 * 디자인 확정본이 오면 토큰 값만 바뀌고 이 파일은 그대로다.
 *
 * ⚠️ 예외 한 곳 — 사이드바 **바깥 경계선**만 `border-foreground`(검정)를 쓴다.
 *    샘플 445행이 `border-r-2 border-on-background` 로 여기를 검정으로 긋는다.
 *    `border-sidebar-border`(#ffffff33, 반투명 흰색)를 2px 로 키워 봤자 남색 위
 *    옅은 흰 선이라 회색 본문과의 경계가 안 잡힌다. 이 선은 사이드바 "안쪽" 구분선이
 *    아니라 사이드바와 본문 사이의 경계라서 본문 쪽 색을 따르는 게 맞다.
 *    --sidebar* 토큰 값 자체는 건드리지 않았다(라이트·다크 8개 모두 그대로).
 */

/** href → 아이콘. lib/nav.ts 에 항목이 늘면 여기에도 추가한다 */
const NAV_ICON: Record<string, LucideIcon | undefined> = {
  "/inbound": PackagePlus, // 입고 = 물건이 들어옴
  "/packing": PackageCheck, // 출고 포장 = 담고 확인해서 내보냄
  "/dashboard": LayoutDashboard,
};

export function AppNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="주요 화면"
      className="bg-sidebar border-foreground fixed top-16 bottom-0 left-0 z-40 w-[155px] overflow-y-auto border-r-2 py-2"
    >
      <ul className="flex flex-col gap-1 px-2">
        {NAV.map((item) => {
          const Icon = NAV_ICON[item.href];
          // 하위 경로(/packing/123)에 들어가도 상위 항목이 계속 켜져 있어야 한다
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <li key={item.href}>
              <Link
                href={item.href}
                // 스크린리더에도 "지금 이 화면"이 전달되도록
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-20 flex-col items-center justify-center gap-1.5 rounded-md px-1 text-center text-sm leading-tight transition-colors",
                  active
                    ? "bg-sidebar-primary text-sidebar-primary-foreground font-semibold"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                )}
              >
                {Icon === undefined ? null : <Icon className="size-6 shrink-0" aria-hidden />}
                {/* 폭이 155px 로 좁다 — 라벨이 길어지면 두 줄로 접히게 둔다(잘라내지 않는다) */}
                <span className="text-balance">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
