"use client";

import { FlaskConical, LogOut, Settings, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV } from "@/lib/nav";
import { cn } from "@/lib/utils";

/**
 * 좌측 세로 사이드바 — 고정 스테이지(1600×1004) 안에서 헤더(64px) 아래부터 바닥까지.
 *
 * 화면 목록의 정본은 `lib/nav.ts` 다(팀 공유 파일이라 수정하지 않는다).
 * 아이콘은 화면 정의가 아니라 표현이므로 그쪽에 넣지 않고 여기서 href 로 붙인다.
 *
 * 색은 전부 `--sidebar*` 토큰 클래스로만 쓴다. 팔레트를 갈아끼워도 이 파일은 그대로다.
 *
 * ⚠️ 활성 탭 색이 디자인 확정본과 다르다 — 의도된 차이다.
 *    확정본(design.html)의 활성 탭은 `bg-surface-variant`(#e4e2e1 회색)인데,
 *    여기서는 `bg-sidebar-primary`(앰버 #fcb40d)를 그대로 쓴다. **앰버 유지로 결정**됐다.
 *    남색 바탕에서 회색보다 앰버가 멀리서도 훨씬 잘 잡히고, 회색 활성 탭은 오른쪽
 *    본문(회색 계열)과 붙어 보여 "사이드바가 여기서 끝난다"는 경계가 흐려진다.
 *
 * ⚠️ 경계선 색 — 사이드바 **구조선**은 전부 `border-foreground`(검정)를 쓴다.
 *    원래는 "바깥 경계선만 예외"라고 적어 뒀지만, 디자인 확정본을 받고 보니 예외가 아니라
 *    그게 규칙이었다: 확정본은 사이드바 우측 경계선(35행)뿐 아니라 항목 사이 구분선까지
 *    전부 `border-on-background`(#1b1c1c 검정) 2px 로 긋는다.
 *    `border-sidebar-border`(#ffffff33, 반투명 흰색)로는 남색 위에 옅은 흰 선만 남아
 *    브루탈리즘의 "굵은 검정 격자"가 성립하지 않는다.
 *    --sidebar* 토큰 값 자체는 여전히 건드리지 않았다(라이트·다크 8개 모두 그대로).
 *
 * ⚠️ 아이콘 라이브러리 — 확정본은 Material Symbols 를 쓰고, 활성 탭은 `FILL 1`(꽉 찬 아이콘)
 *    비활성은 `FILL 0`(선 아이콘)으로 상태를 한 번 더 구분한다. 그런데 Next 16.3.1 의
 *    next/font/google 에는 Material Symbols 자체가 없어 self-host 가 불가능하다.
 *    결정이 날 때까지 기존 의존성인 lucide-react 를 그대로 쓴다.
 *    → 그 결과 **FILL 축에 해당하는 표현이 없다.** 활성 상태는 배경색(앰버) + 굵은 글씨로만
 *      구분된다. 대비 자체는 충분하지만 확정본과 1:1은 아니다.
 */

/** href → 아이콘. lib/nav.ts 에 항목이 늘면 여기에도 추가한다.
 *  주석의 이름은 디자인 확정본이 쓰는 Material Symbols 이름 — 라이브러리 결정이 나면
 *  이 표만 바꾸면 되도록 대응을 남겨 둔다. */
const NAV_ICON: Record<string, LucideIcon | undefined> = {
  // win98 스킨 화면 셋 — 실험·데모용이라 확정본에 대응되는 아이콘이 없다.
  // 플라스크로 묶어 "본 화면이 아니라 별도 스킨"임을 목록에서 바로 알 수 있게 한다.
  "/inbound": FlaskConical,
  "/packing": FlaskConical,
  "/analytics": FlaskConical,
};

/** 하단 고정 줄 2개. ⚠️ **동작이 없다** — 확정본에 있으니 자리는 만들지만
 *  설정 화면도 인증도 아직 명세가 없다. 헤더 우측 아이콘과 같은 처리를 한다
 *  (aria-hidden + cursor-default). 없는 기능을 있는 것처럼 보이게 하지 않는다.
 *  기능이 생기면 각 항목을 Link 나 button 으로 바꾸고 aria-hidden 을 걷어내면 된다. */
const FOOTER_ITEMS: { icon: LucideIcon; label: string }[] = [
  { icon: Settings, label: "설정" }, // 확정본: material-symbols settings
  { icon: LogOut, label: "로그아웃" }, // 확정본: material-symbols logout
];

/** @param version 화면 하단에 표기할 버전. package.json 의 version 을 서버 컴포넌트인
 *  app/layout.tsx 에서 읽어 넘긴다 — 여기서 직접 import 하면 **package.json 전체가
 *  클라이언트 번들에 실린다**(Turbopack 은 JSON named import 를 트리셰이킹하지 않는다.
 *  빌드 산출물에서 devDependencies 문자열이 나오는 걸로 확인했다).
 *  비밀 값은 없지만 의존성 목록·버전을 굳이 브라우저에 내보낼 이유도 없다. */
export function AppNav({ version }: { version: string }) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="주요 화면"
      // 고정 스테이지 안이므로 fixed 가 아니라 absolute 다(app/layout.tsx 주석 참고).
      // top-16(64px) ~ bottom-0 으로 잡아 스테이지 바닥에 정확히 붙인다.
      // 확정본은 `h-full` + 하단 블록 `mb-[64px]` 로 같은 결과를 만들지만,
      // 넘친 높이를 마진으로 되돌리는 방식이라 스테이지 높이가 바뀌면 어긋난다.
      className="bg-sidebar border-foreground absolute top-16 bottom-0 left-0 z-40 flex w-[155px] flex-col overflow-hidden border-r-2"
    >
      {/* 목록 상단에도 구분선을 하나 둔다 — 헤더 하단 border-b-2 와 만나 격자가 닫힌다 */}
      <ul className="border-foreground flex flex-grow flex-col border-t-2">
        {NAV.map((item) => {
          const Icon = NAV_ICON[item.href];
          // 하위 경로(/packing/123)에 들어가도 상위 항목이 계속 켜져 있어야 한다
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <li key={item.href} className="border-foreground border-b-2">
              <Link
                href={item.href}
                // 스크린리더에도 "지금 이 화면"이 전달되도록
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex flex-col items-center justify-center gap-2 px-2 py-6 text-center transition-colors",
                  active
                    ? "bg-sidebar-primary text-sidebar-primary-foreground font-bold"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                )}
              >
                {Icon === undefined ? null : <Icon className="size-8 shrink-0" aria-hidden />}
                {/* 폭이 155px 로 좁다 — 라벨이 길어지면 두 줄로 접히게 둔다(잘라내지 않는다) */}
                <span className="text-label-sm text-balance">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>

      {/* 하단 블록 — mt-auto 로 바닥에 붙인다. 위 목록이 짧아도 여기는 항상 바닥이다. */}
      <div className="border-foreground mt-auto border-t-2">
        {/* 버전 표기. 확정본은 "Terminal v1.0.4" 로 박아 뒀지만 하드코딩하지 않고
            package.json 의 version 을 쓴다 — 배포본과 화면 표기가 어긋날 일이 없다.
            값은 위 주석대로 서버에서 prop 으로 내려온다. */}
        <div className="px-panel-padding border-foreground/30 border-b py-3">
          <span className="text-label-sm text-outline-variant">Terminal v{version}</span>
        </div>

        {FOOTER_ITEMS.map(({ icon: Icon, label }, index) => (
          <div
            key={label}
            aria-hidden
            className={cn(
              "p-panel-padding text-sidebar-foreground flex cursor-default items-center gap-3",
              // 마지막 줄에는 아래 구분선을 긋지 않는다(사이드바 바닥이 이미 경계다)
              index < FOOTER_ITEMS.length - 1 && "border-foreground/30 border-b",
            )}
          >
            <Icon className="size-6 shrink-0" />
            <span className="text-label-sm">{label}</span>
          </div>
        ))}
      </div>
    </nav>
  );
}
