"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";

/**
 * 팔레트 전환 패널 — **개발 모드 전용 도구다. 제품 UI 가 아니다.**
 *
 * app/globals.css 가 색 토큰을 [data-palette] × 라이트/다크 두 축으로 나눠 놨는데,
 * 그 네 조합이 실제로 의도대로 계산되는지 눈으로 확인할 수단이 없었다.
 * 특히 두 축은 (0,2,0) 특정성 동점을 한 군데 만들고, 그 자리를 "라이트 구역 -> 다크 구역"
 * 배치로 갈라 놨다(globals.css 의 "셀렉터 우선순위 설계" 참고).
 * 다크 + 비기본 팔레트 조합이 정확히 그 자리라, 코드만 봐서는 맞는지 알기 어렵다.
 * 이 패널은 그 조합을 한 번에 눌러 보기 위한 것이다.
 *
 * ── 프로덕션에서는 통째로 빠진다 ──────────────────────────────────────────
 * app/layout.tsx 가 `process.env.NODE_ENV === "production" ? null : <PaletteDevPanel />`
 * 로 감싼다. 번들러가 NODE_ENV 를 상수로 치환하면 이 컴포넌트를 참조하는 유일한 지점이
 * 죽은 코드가 되고, 모듈 전체가 트리셰이킹된다.
 * 조건부 렌더만으로는 문자열이 남는 경우가 있어서, 프로덕션 산출물에서 아래 PANEL_MARKER
 * 와 팔레트 이름이 실제로 사라졌는지 grep 으로 확인했다.
 *
 * ── 왜 스테이지 밖인가 ────────────────────────────────────────────────────
 * Toaster 와 같은 판단이다. 스테이지 안에 넣으면 transform: scale() 이 같이 먹어서
 * 좁은 화면에서 개발 도구까지 쪼그라든다. 도구는 항상 원본 크기여야 한다.
 * 스테이지 밖이라 transform 조상이 없고, 그래서 여기서는 position: fixed 가
 * (앱 셸과 달리) 뷰포트 기준으로 정상 동작한다.
 *
 * ── 왜 패널 자신은 앱 토큰을 안 쓰나 ──────────────────────────────────────
 * 이 패널의 색은 하드코딩이다(레터박스와 같은 이유). 팔레트를 갈아끼울 때 패널까지
 * 같이 색이 바뀌면 "지금 보는 색이 팔레트 결과인지 패널 자체 색인지"를 구분할 수 없다.
 * 계측기는 계측 대상과 같이 움직이면 안 된다.
 */

/** 프로덕션 번들 제외 여부를 grep 으로 확인할 때 쓰는 표식. 지우지 말 것. */
const PANEL_MARKER = "PALETTE_DEV_PANEL";

/** 두 축을 키 하나에 같이 담는다 — 따로 저장했다가 한쪽만 남아 어긋나는 일이 없게. */
const STORAGE_KEY = "dev:palette-panel";

/** 저장된 값이 없거나 못 읽을 때 떨어지는 기본 조합. */
const DEFAULT_STATE: PanelState = { palette: "terminal", dark: false };

type PanelState = { palette: string | null; dark: boolean };

/** null = "data-palette 속성 없음". 화면에 쓸 이름으로 바꾼다. */
const label = (name: string | null) => name ?? "(없음)";

/**
 * 팔레트 목록을 **하드코딩하지 않고 CSSOM 에서 직접 읽어낸다.**
 *
 * globals.css 는 "팔레트를 늘릴 때 블록을 복붙하면 끝" 을 설계 목표로 잡고 있다.
 * 목록을 여기에 배열로 또 적어 두면 추가 지점이 두 군데가 되어 그 설계가 깨진다
 * (그리고 둘 중 하나를 빼먹는 건 시간 문제다).
 * 그래서 브라우저가 이미 파싱해 둔 스타일시트를 훑어 `[data-palette=X]` 셀렉터에서
 * X 를 모은다. globals.css 에 블록을 추가하는 순간 패널에도 자동으로 나타난다.
 *
 * 대안으로 검토했다가 버린 것:
 *   · 상수 배열을 한 곳에 두고 globals.css 주석에서 가리키기 — 여전히 두 군데다.
 *     사람이 동기화를 지켜야 하는 구조는 결국 어긋난다.
 *   · 빌드 스크립트로 globals.css 를 파싱해 생성 — 추가 지점은 한 곳이 되지만
 *     빌드 파이프라인에 단계를 하나 더 붙이는 값이 이 도구에는 과하다.
 *
 * 순서는 스타일시트 등장 순서 = globals.css 소스 순서다. 라이트 구역이 먼저라
 * 파일에 적힌 순서 그대로("terminal", "debug", ...) 나온다.
 */
function discoverPalettes(): string[] {
  const PALETTE_IN_SELECTOR = /\[data-palette=["']?([\w-]+)["']?\]/g;
  const names: string[] = [];

  const walk = (rules: CSSRuleList) => {
    for (const rule of Array.from(rules)) {
      if (rule instanceof CSSStyleRule) {
        for (const match of rule.selectorText.matchAll(PALETTE_IN_SELECTOR)) {
          if (!names.includes(match[1])) names.push(match[1]);
        }
      }
      // @layer / @media / @supports 같은 그룹 규칙 안에 들어가 있을 수도 있다
      const nested = (rule as CSSGroupingRule).cssRules;
      if (nested !== undefined) walk(nested);
    }
  };

  for (const sheet of Array.from(document.styleSheets)) {
    try {
      walk(sheet.cssRules);
    } catch {
      // 교차 출처 스타일시트는 cssRules 접근이 막힌다. 우리 CSS 는 동일 출처라
      // 여기 걸릴 일이 없지만, 서드파티 시트가 끼어도 조용히 넘어가야 한다.
    }
  }
  return names;
}

/* ── localStorage 를 "외부 시스템" 으로 다룬다 ──────────────────────────────
   처음에는 useState + 마운트 이펙트에서 복원하는 흔한 방식으로 짰는데 두 가지가 걸렸다:
     ① 서버 렌더는 저장값을 모르므로 SSR HTML 과 클라이언트 첫 렌더가 달라져
        하이드레이션 불일치가 난다. 개발 전용 도구가 개발 중에 콘솔 에러를 뿜는 셈이다.
     ② 이펙트 안에서 setState 를 부르는 형태라 react-hooks/set-state-in-effect 에 걸린다
        (실제로 lint 가 잡았다).
   useSyncExternalStore 가 정확히 이 문제를 위한 API 다 — 서버 스냅샷을 따로 받고,
   하이드레이션이 끝난 뒤 클라이언트 값으로 다시 렌더해 준다. 이펙트에서 setState 를
   부르지 않으므로 규칙도 자연히 만족한다.
   덤: storage 이벤트를 구독하므로 탭을 두 개 띄워 비교할 때 서로 동기화된다. */

const listeners = new Set<() => void>();

/** localStorage 를 못 쓸 때의 대체 저장소.
    쓰기가 실패해도 이번 세션 동안은 패널이 정상 동작해야 한다 — 저장이 안 될 뿐이지
    전환 자체가 막히면 도구로서 쓸모가 없다. */
let memoryFallback: string | null = null;

function subscribe(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange);
  window.addEventListener("storage", onStoreChange);
  return () => {
    listeners.delete(onStoreChange);
    window.removeEventListener("storage", onStoreChange);
  };
}

/** ⚠️ 스냅샷은 **문자열 원본**을 그대로 돌려준다.
    파싱한 객체를 돌려주면 호출마다 새 참조가 되어 useSyncExternalStore 가 무한 렌더를 돈다. */
function getSnapshot(): string {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored !== null) return stored;
  } catch {
    // 사생활 보호 모드·정책 차단 등. 아래 메모리 폴백으로 내려간다.
  }
  return memoryFallback ?? "";
}

/** 서버에는 저장소가 없다. 빈 문자열 -> parse 가 기본 조합을 돌려준다. */
function getServerSnapshot(): string {
  return "";
}

function parse(raw: string): PanelState {
  if (raw === "") return DEFAULT_STATE;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return DEFAULT_STATE;
    const { palette, dark } = parsed as Partial<PanelState>;
    return {
      palette: typeof palette === "string" || palette === null ? palette : DEFAULT_STATE.palette,
      dark: typeof dark === "boolean" ? dark : DEFAULT_STATE.dark,
    };
  } catch {
    // 손상된 값이 들어 있어도 기본 조합으로 뜬다.
    return DEFAULT_STATE;
  }
}

function write(next: PanelState): void {
  const raw = JSON.stringify(next);
  // 메모리에 먼저 넣는다 — localStorage 가 던져도 화면은 즉시 바뀐다.
  memoryFallback = raw;
  try {
    window.localStorage.setItem(STORAGE_KEY, raw);
  } catch {
    // 저장 실패는 무시한다. 새로고침하면 기본 조합으로 돌아갈 뿐이다.
  }
  // storage 이벤트는 "다른 탭" 에서만 오므로, 이 탭은 직접 알린다.
  for (const listener of listeners) listener();
}

export function PaletteDevPanel() {
  const [open, setOpen] = useState(false);
  const [palettes, setPalettes] = useState<string[]>([]);

  const raw = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const state = useMemo(() => parse(raw), [raw]);
  const { palette, dark } = state;

  /* 상태를 <html> 에 반영한다. 여기는 "React 상태를 외부 시스템에 밀어 넣는" 자리라
     이펙트가 맞다(setState 를 부르지 않는다).

     ⚠️ .dark 클래스를 이 패널이 **직접** 조작한다. 지금 앱에 ThemeProvider 가 없어서
        .dark 를 붙여 주는 주체가 아무도 없기 때문이다(next-themes 는 의존성 목록에만 있고
        app/providers.tsx 에서 쓰지 않는다). next-themes 를 여기서 새로 도입하지 않은 건
        그게 별도 결정 사항이라 이번 범위 밖이어서다.
        나중에 ThemeProvider 가 들어오면 **같은 클래스를 두 주체가 만지게 되어 충돌한다.**
        그때는 이 줄을 지우고 패널이 ThemeProvider 의 setTheme 을 호출하도록 바꿔야 한다.
        data-palette 쪽은 ThemeProvider 와 무관하므로 그대로 두면 된다. */
  useEffect(() => {
    const root = document.documentElement;
    if (palette === null) root.removeAttribute("data-palette");
    else root.dataset.palette = palette;
    root.classList.toggle("dark", dark);
  }, [palette, dark]);

  /* 언마운트되면 흔적을 지운다. HMR 로 이 컴포넌트만 사라지거나, 프로덕션 빌드로 바꿔
     패널이 없어졌는데 <html> 에 debug 팔레트가 박혀 있는 상태를 남기지 않기 위해서다. */
  useEffect(() => {
    const root = document.documentElement;
    return () => {
      root.removeAttribute("data-palette");
      root.classList.remove("dark");
    };
  }, []);

  // 패널을 열 때마다 목록을 다시 훑는다 — 개발 중 globals.css 에 팔레트를 추가하면
  // HMR 로 스타일시트가 갈리는데, 마운트 때 한 번만 훑으면 새로고침 전까지 안 보인다.
  // 이펙트가 아니라 이벤트 핸들러에서 부르는 게 의미상으로도 맞다("열 때 갱신").
  const handleOpen = () => {
    setPalettes(discoverPalettes());
    setOpen(true);
  };

  const btn = (active: boolean) =>
    [
      "border border-[#4b5563] px-2 py-1 transition-colors",
      active ? "bg-[#e5e7eb] font-semibold text-[#111827]" : "bg-[#1f2937] text-[#e5e7eb] hover:bg-[#374151]",
    ].join(" ");

  const current = `${label(palette)} · ${dark ? "다크" : "라이트"}`;

  return (
    <div
      // PANEL_MARKER 를 DOM 속성으로도 흘려 둔다 — 프로덕션 산출물 grep 의 표적이자,
      // 개발 중 "이 요소가 뭐지?" 를 바로 알 수 있게 하는 표식이다.
      data-dev-tool={PANEL_MARKER}
      className="fixed right-3 bottom-3 z-[9999] font-mono text-[12px] leading-tight"
    >
      {open ? (
        <div className="w-[236px] border border-[#374151] bg-[#111827] text-[#e5e7eb] shadow-[0_4px_16px_rgba(0,0,0,0.4)]">
          <div className="flex items-center justify-between border-b border-[#374151] px-3 py-2">
            <span className="font-semibold tracking-wide">팔레트 전환 (dev)</span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="패널 접기"
              className="px-1 text-[#9ca3af] hover:text-[#e5e7eb]"
            >
              ✕
            </button>
          </div>

          <div className="px-3 py-2">
            <div className="mb-1 text-[#9ca3af]">data-palette</div>
            <div className="flex flex-wrap gap-1">
              {/* 맨 앞의 null 은 "속성을 아예 붙이지 않은" 상태다. 설계상 terminal 과 같은
                  결과가 나와야 하지만 켜지는 셀렉터가 다르다 —
                  없음이면 :root / :root.dark 만 (0,1,0)·(0,2,0),
                  terminal 이면 [data-palette] 가 붙은 (0,2,0)·(0,3,0) 까지 켜진다.
                  둘이 같은 화면을 내는지가 곧 특정성 설계가 맞다는 증거라서 같이 눌러 본다. */}
              {[null, ...palettes].map((name) => (
                <button
                  key={name ?? "__none__"}
                  type="button"
                  aria-pressed={palette === name}
                  title={name === null ? "data-palette 속성을 제거한다(기본 팔레트 경로)" : undefined}
                  onClick={() => write({ ...state, palette: name })}
                  className={btn(palette === name)}
                >
                  {label(name)}
                </button>
              ))}
            </div>
            {palettes.length === 0 ? (
              <div className="mt-1 text-[#9ca3af]">스타일시트에서 팔레트를 찾지 못했다</div>
            ) : null}
          </div>

          <div className="border-t border-[#374151] px-3 py-2">
            <div className="mb-1 text-[#9ca3af]">테마 (html.dark)</div>
            <div className="flex gap-1">
              <button
                type="button"
                aria-pressed={!dark}
                onClick={() => write({ ...state, dark: false })}
                className={btn(!dark)}
              >
                라이트
              </button>
              <button
                type="button"
                aria-pressed={dark}
                onClick={() => write({ ...state, dark: true })}
                className={btn(dark)}
              >
                다크
              </button>
            </div>
          </div>

          <div className="border-t border-[#374151] px-3 py-2 text-[#9ca3af]">현재: {current}</div>
        </div>
      ) : (
        <button
          type="button"
          onClick={handleOpen}
          className="border border-[#374151] bg-[#111827] px-2 py-1 text-[#e5e7eb] shadow-[0_4px_16px_rgba(0,0,0,0.4)] hover:bg-[#1f2937]"
        >
          팔레트: {current}
        </button>
      )}
    </div>
  );
}
