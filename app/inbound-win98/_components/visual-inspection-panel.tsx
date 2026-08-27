"use client";

import { useState, type ReactNode } from "react";
import { Camera, ImagePlus } from "lucide-react";
import type { MeasurementImage } from "@/lib/types";
import { Panel, w98 } from "./win98-ui";

/**
 * 촬영 사진 — 목업의 `Visual Inspection` 패널.
 *
 * 목업 구조 그대로다: 메인 카메라 65% + 오른쪽 35%(위아래 반반).
 * 각 칸은 파인 상자 안에 **네이비 캡션 줄** + 화면이고, 메인만 검정 바탕 + 초록 조준선이다.
 *
 * 확정 전에는 1-3 의 `images`, 확정 후에는 1-6 응답이 들어온다(page.tsx 에서 고른다).
 * 카메라가 3대 1세트(§1-3)라 메인 1 + 서브 2 로 딱 맞는다.
 *
 * ⚠️ mock 단계에는 이미지 파일이 저장소에 없다. 외부 URL 은 쓰지 않는다(네트워크·CSP 의존을
 *    만들지 않기 위해) — 그래서 img 를 걸지 않고 경로만 자리표시로 적는다. 실제 이미지가
 *    붙으면 Slot 의 마지막 분기만 img 로 바꾸면 된다.
 *
 * ★ **오른쪽 아래 칸은 이제 마스터 이미지다** (사용자 결정). 원래 `Special Notes` 자리였고
 *   그 뒤 세 번째 카메라 사진을 넣어 뒀었는데, 오른쪽 열의 `Product Photo` 칸을 취급
 *   주의사항 창에 내주면서 마스터 이미지가 이리로 왔다.
 *   ⚠️ 그러면 세 번째 카메라 사진이 갈 곳이 없어진다. 그래서 **`Side / Label` 칸을 눌러
 *      2번째 ↔ 3번째 사진을 바꿔 보게** 했다. 사진을 지우지 않고 한 칸에 겹쳐 둔 것이다.
 *
 * ⚠️ 마스터 이미지는 §1-1 의 `product.imageUrl` 이고, 카메라 사진(`images`)은 §1-3/§1-6 이다.
 *    **출처가 다른 두 값**이라 한 배열로 합치지 않는다 — 합치면 "몇 번째가 촬영본인가"가
 *    화면 사정에 따라 달라져서, 나중에 촬영본만 다뤄야 할 때 되돌리기 어렵다.
 */
export function VisualInspectionPanel({
  images,
  isLoading,
  sourceLabel,
  masterImageUrl = null,
  productName = null,
  isProductPending = false,
}: {
  images: MeasurementImage[];
  isLoading: boolean;
  sourceLabel?: string | null;
  /** §1-1 의 `product.imageUrl` — 코리안넷 마스터 이미지. 없으면 자리표시만 뜬다 */
  masterImageUrl?: string | null;
  productName?: string | null;
  isProductPending?: boolean;
}) {
  const [main, ...subs] = images;
  /* `Side / Label` 칸이 지금 몇 번째 사진을 보고 있나 (0 = 2번째, 1 = 3번째).
     ⚠️ 사진이 바뀌면(재촬영·확정) 되돌린다 — 3번째를 보던 중에 새 촬영이 들어오면
        엉뚱한 장을 보고 있게 된다. `images` 배열 자체를 키로 삼지 않고 길이만 보는 이유는,
        같은 길이의 새 배열이 와도 보던 자리를 유지하는 편이 덜 튀기 때문이다. */
  const [sideShot, setSideShot] = useState(0);
  const sideChoices = [subs[0], subs[1]].filter((im) => im !== undefined);
  const canFlip = sideChoices.length > 1;
  const shown = sideChoices[canFlip ? sideShot : 0];

  return (
    <Panel
      title="Visual Inspection"
      right={
        <span className={`${w98.small} flex shrink-0 items-center gap-1 font-normal`}>
          {/* 1-6 의 source — 사진이 촬영 원본인지 마스터 대체인지 알려 준다 */}
          {sourceLabel ? <span>{sourceLabel}</span> : null}
          <Camera className="size-3.5" aria-hidden />
        </span>
      }
      className="min-h-0 flex-1"
      bodyClassName="flex-row gap-2"
    >
      {/* 메인 — 목업의 flex: 0 0 65% 그대로 */}
      <Slot caption="Main View / CAM 01" className="min-h-0" style={{ flex: "0 0 65%" }}>
        <div className={`${w98.camBlack} relative flex h-full w-full items-center justify-center overflow-hidden`}>
          <SlotBody image={main} isLoading={isLoading} placeholder="촬영 대기 중" tone="dark" waiting />
          {/* 감시 카메라 오버레이 — 목업의 두 줄 그대로 */}
          <div className={`${w98.camGreen} ${w98.mono} ${w98.small} absolute top-2 left-2 z-10`}>
            CAM 01 - MAIN REC
          </div>
          <div className={`${w98.camFrame} absolute inset-0 m-4`} aria-hidden />
        </div>
      </Slot>

      {/* 서브 — 35% 열에 위아래 반반 */}
      <div className="flex min-h-0 flex-1 flex-col gap-2" style={{ flex: "0 0 calc(35% - 8px)" }}>
        {/* 위 — 측면/라벨. 3번째 사진이 있으면 눌러서 바꿔 볼 수 있다 */}
        <Slot
          caption="Side / Label"
          className="min-h-0 flex-1"
          right={
            canFlip ? (
              <span className={`${w98.mono} shrink-0 opacity-80`}>{sideShot + 2}/3 ▸</span>
            ) : null
          }
          onActivate={canFlip ? () => setSideShot((prev) => (prev === 0 ? 1 : 0)) : undefined}
          hint={canFlip ? "눌러서 다음 사진" : undefined}
        >
          <div className="flex h-full w-full items-center justify-center overflow-hidden bg-[color:var(--surface-dim)]">
            <SlotBody image={shown} isLoading={isLoading} placeholder="촬영 대기 중" tone="light" />
          </div>
        </Slot>

        {/* 아래 — 마스터 이미지 (위 주석 참고) */}
        <Slot caption="Product Photo" right={<span className="shrink-0 opacity-80">마스터 이미지</span>} className="min-h-0 flex-1">
          <div className="flex h-full w-full items-center justify-center overflow-hidden bg-[color:var(--surface-dim)]">
            {isProductPending ? (
              <span className={`${w98.mono} ${w98.small} uppercase opacity-70`}>loading…</span>
            ) : masterImageUrl === null ? (
              <div className="flex flex-col items-center gap-2 opacity-30">
                <ImagePlus className="size-8" aria-hidden />
                <span className={`${w98.mono} ${w98.small} uppercase`}>
                  {productName === null ? "no product" : "이미지 없음"}
                </span>
              </div>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={masterImageUrl}
                alt={`${productName ?? "제품"} 마스터 이미지`}
                className="h-full w-full object-contain"
              />
            )}
          </div>
        </Slot>
      </div>
    </Panel>
  );
}

/** 파인 상자 + 네이비 캡션 줄 — 목업의 각 카메라 칸.
 *  `onActivate` 를 주면 눌러서 쓰는 칸이 된다(키보드로도 닿게 `role`·`tabIndex` 를 붙인다). */
function Slot({
  caption,
  children,
  className = "",
  style,
  right,
  onActivate,
  hint,
}: {
  caption: string;
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
  /** 캡션 줄 오른쪽에 놓을 것 — 사진 번호나 출처 표기 */
  right?: ReactNode;
  /** 누르면 할 일. 없으면 그냥 보는 칸이다 */
  onActivate?: () => void;
  hint?: string;
}) {
  return (
    <div
      style={style}
      className={`${w98.sunken} flex flex-col bg-[color:var(--surface-bright)] p-1 ${className} ${
        onActivate ? "cursor-pointer" : ""
      }`}
      role={onActivate ? "button" : undefined}
      tabIndex={onActivate ? 0 : undefined}
      title={hint}
      onClick={onActivate}
      onKeyDown={
        onActivate
          ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onActivate();
              }
            }
          : undefined
      }
    >
      <span
        className={`${w98.small} mb-1 flex shrink-0 items-center justify-between gap-2 bg-[color:var(--primary)] px-1 text-[color:var(--primary-foreground)]`}
      >
        <span className="truncate">{caption}</span>
        {right}
      </span>
      <div className="min-h-0 flex-1">{children}</div>
    </div>
  );
}

function SlotBody({
  image,
  isLoading,
  placeholder,
  tone,
  waiting = false,
}: {
  image: MeasurementImage | undefined;
  isLoading: boolean;
  placeholder: string;
  tone: "dark" | "light";
  /** 대기 막대를 함께 보일 것인가 — **메인 카메라 칸에만** 켠다 (사용자 결정) */
  waiting?: boolean;
}) {
  const muted = tone === "dark" ? "text-white" : "text-[color:var(--foreground)]";

  if (isLoading) {
    return (
      <div className={`flex w-2/3 flex-col items-center gap-3 ${muted}`}>
        <Camera className="size-10 opacity-30" aria-hidden />
        <span className={`${w98.mono} ${w98.small} uppercase opacity-70`}>측정 중…</span>
        {waiting ? <Marquee /> : null}
      </div>
    );
  }

  if (image === undefined) {
    /* ★ 메인 칸에만 win98 마퀴 막대를 둔다 (사용자 결정).
       세 칸 모두에 넣으면 화면이 깜빡이는 것투성이가 된다 — 기다리라는 말은 한 번이면 된다.
       ⚠️ 서브 칸(측면/라벨·추가 촬영)은 예전 그대로 아이콘 + 문구뿐이다. */
    if (waiting) {
      return (
        <div className={`flex w-2/3 flex-col items-center gap-3 ${muted}`}>
          <Camera className="size-10 opacity-30" aria-hidden />
          <span className={`${w98.mono} ${w98.small} uppercase opacity-70`}>
            {placeholder}
            <span className={w98.blink}>_</span>
          </span>
          <Marquee />
        </div>
      );
    }

    return (
      <div className={`flex flex-col items-center gap-2 opacity-30 ${muted}`}>
        <Camera className="size-10" aria-hidden />
        <span className={`${w98.mono} ${w98.small} uppercase`}>{placeholder}</span>
      </div>
    );
  }

  return (
    <div className={`${w98.mono} ${w98.small} w-full p-2 text-center ${tone === "dark" ? w98.camGreen : ""}`}>
      <span className="block font-bold">
        {image.cameraNo === null ? "MASTER IMAGE" : `CAM 0${image.cameraNo}`}
      </span>
      <span className="mt-1 block break-all">{image.url}</span>
      <span className="mt-1 block">(no image file — placeholder)</span>
    </div>
  );
}

/**
 * win98 의 마퀴 진행 막대 — 초록 블록 한 줌이 계속 지나간다.
 * 채워지는 막대가 아니라 **지나가는** 막대인 것이 핵심이다. 촬영이 언제 시작될지는
 * 작업자가 버튼을 누르기 전까지 알 수 없으므로, 진행률을 모른다는 뜻의 표현이 맞다.
 * 색은 이 칸의 CRT 초록에 맞췄다 — 검은 화면에서 네이비는 보이지 않는다.
 */
function Marquee() {
  return (
    <div className={`${w98.marquee} w-full`}>
      <div className={w98.marqueeInner}>
        {[0, 1, 2, 3, 4].map((index) => (
          <span key={index} className={w98.marqueeBlock} />
        ))}
      </div>
    </div>
  );
}
