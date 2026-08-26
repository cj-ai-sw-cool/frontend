"use client";

import type { ReactNode } from "react";
import { Camera } from "lucide-react";
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
 * ⚠️ 목업 오른쪽 아래 칸은 `Special Notes / NO ANOMALIES DETECTED` 라는 **고정 문구**다.
 *    이상 판정을 주는 API 가 없어서(§1-3 은 신뢰도·게이트만 준다) 그 문구를 지어내지 않고,
 *    계약이 실제로 주는 세 번째 카메라 사진 자리로 썼다. 캡션만 목업 표기를 살렸다.
 */
export function VisualInspectionPanel({
  images,
  isLoading,
  sourceLabel,
}: {
  images: MeasurementImage[];
  isLoading: boolean;
  sourceLabel?: string | null;
}) {
  const [main, ...subs] = images;

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

      {/* 서브 — 35% 열에 위아래 반반. 카메라가 3대를 넘어도 화면이 비지 않게 늘어나게 둔다
          (칸이 세로로 좁아질 뿐 넘치지 않는다) */}
      <div className="flex min-h-0 flex-1 flex-col gap-2" style={{ flex: "0 0 calc(35% - 8px)" }}>
        {[subs[0], subs[1], ...subs.slice(2)].map((image, index) => (
          <Slot
            key={image?.url ?? `empty-${index}`}
            caption={SUB_CAPTION[index] ?? `CAM 0${index + 2}`}
            className="min-h-0 flex-1"
          >
            <div className="flex h-full w-full items-center justify-center overflow-hidden bg-[color:var(--surface-dim)]">
              <SlotBody
                image={image}
                isLoading={isLoading}
                placeholder={SUB_PLACEHOLDER[index] ?? "촬영 대기 중"}
                tone="light"
              />
            </div>
          </Slot>
        ))}
      </div>
    </Panel>
  );
}

/** 목업 캡션 그대로 */
const SUB_CAPTION = ["Side / Label", "Special Notes"];
const SUB_PLACEHOLDER = ["촬영 대기 중", "촬영 대기 중"];

/** 파인 상자 + 네이비 캡션 줄 — 목업의 각 카메라 칸 */
function Slot({
  caption,
  children,
  className = "",
  style,
}: {
  caption: string;
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={style}
      className={`${w98.sunken} flex flex-col bg-[color:var(--surface-bright)] p-1 ${className}`}
    >
      <span
        className={`${w98.small} mb-1 shrink-0 bg-[color:var(--primary)] px-1 text-[color:var(--primary-foreground)]`}
      >
        {caption}
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
