"use client";

import type { ReactNode } from "react";
import { Camera, ImagePlus, Maximize } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { MeasurementImage } from "@/lib/types";

/**
 * 제품 촬영 사진 — docs/02-api-spec.md §1-3 의 `images`(카메라 3대),
 * 확정 후에는 §1-6 `GET /products/{id}/images` 가 같은 형태로 내려준다.
 * 디자인 확정본 좌측 컬럼의 두 패널에 대응한다 —
 *   "제품 메인 촬영 사진" 366px (body.html 110~125행)
 *   "제품 서브 촬영 사진" 243px (body.html 127~143행)
 *
 * 순수 표시용(presentational): API 를 부르지 않는다.
 *
 * 아이콘 대응표 (확정본 Material Symbols → lucide-react)
 *   crop_free → Maximize · photo_camera → Camera · add_photo_alternate → ImagePlus
 *
 * ── 왜 컴포넌트 하나가 패널 두 개를 그리나 ───────────────────────────────
 *   확정본은 메인과 서브를 별도 section 으로 그리지만, 계약이 주는 것은 카메라 번호가
 *   붙은 **사진 한 배열**이고 어느 장이 메인인지는 배열 순서로만 정해진다. 부품을 둘로
 *   가르면 같은 배열을 두 번 넘겨야 하고, "첫 장이 메인" 규칙이 두 파일로 흩어진다.
 *   그래서 프래그먼트로 section 둘을 돌려준다 — 좌측 컬럼의 flex 자식이 그대로 둘이 되어
 *   확정본과 같은 gap-grid-gap 간격이 붙는다.
 *
 * 메인 / 서브를 어떻게 가르나
 *   계약에는 "메인"이라는 개념이 없다. **첫 장을 메인, 나머지를 서브**로 둔다.
 *   (1-6 의 MASTER_FALLBACK 은 `cameraNo: null` 한 장이라 자연히 메인만 그려진다.)
 *   확정본의 서브 슬롯 이름("측면/라벨", "특이사항")은 카메라 배치를 전제한 문구라
 *   빈 칸 안내에만 쓰고, 사진이 있으면 응답이 준 카메라 번호를 그대로 적는다 —
 *   어느 카메라가 무엇을 찍는지는 계약에도 없고 하드웨어 배치가 정해지면 바뀔 값이다.
 *
 * ⚠️ **지금은 사진을 실제로 그리지 않는다.** 저장소에 이미지 파일이 없고(mock url 은 존재하지
 *    않는 경로다), 외부 URL 은 금지다(네트워크·CSP 의존을 만들지 않기 위해).
 *    그래서 회색 자리표시 + 파일 경로 텍스트만 그린다.
 *
 * ── 세로 예산 ───────────────────────────────────────────────────────────
 *   메인 366 = 패딩 32 + 헤더 h-8(32) + mb-2(8) + 사진칸 294(flex-1)
 *   서브 243 = 패딩 32 + 헤더 h-5(20) + mb-2(8) + 사진칸 183(flex-1)
 */
export function ProductPhotoPanel({
  images,
  isLoading,
  sourceLabel,
}: {
  /** 1-3 의 images 또는 1-6 의 images. 아직 촬영 전이면 빈 배열 */
  images: MeasurementImage[];
  isLoading: boolean;
  /** 1-6 의 `source` 를 사람 말로 옮긴 것. 1-3 단계에서는 null */
  sourceLabel?: string | null;
}) {
  const [main, ...subs] = images;

  return (
    <>
      {/* ── 메인 (확정본 110~125행) ─────────────────────────── */}
      <section className="bg-accent p-panel-padding flex h-[366px] shrink-0 flex-col border-2">
        <div className="mb-2 flex h-8 shrink-0 items-center justify-between gap-3">
          <h2 className="text-label-sm">제품 메인 촬영 사진</h2>
          <div className="flex shrink-0 items-center gap-3">
            {sourceLabel ? (
              <span className="text-label-sm text-muted-foreground">{sourceLabel}</span>
            ) : null}
            {/* TODO(P1): "전체보기" — 사진을 크게 띄우는 모달. components/ui/dialog.tsx 사용.
                촬영본을 눈으로 검수하는 용도라 확대가 필요하다(확정본 113~116행).
                실제 이미지가 붙기 전까지는 띄울 게 없어서 비활성으로 뒀다. */}
            <Button type="button" variant="outline" disabled className="text-label-sm h-8 px-3">
              <Maximize aria-hidden />
              전체보기
            </Button>
          </div>
        </div>

        <div className="bg-card flex min-h-0 flex-1 items-center justify-center overflow-hidden border-2">
          <PhotoSlot image={main} isLoading={isLoading} icon="camera" placeholder="촬영 대기 중" />
        </div>
      </section>

      {/* ── 서브 (확정본 127~143행) ─────────────────────────── */}
      <section className="bg-accent p-panel-padding flex h-[243px] shrink-0 flex-col border-2">
        <h2 className="text-label-sm mb-2 flex h-5 shrink-0 items-center">제품 서브 촬영 사진</h2>
        <div className="flex min-h-0 flex-1 gap-4">
          {/* 확정본은 서브 칸을 2개로 고정해 뒀다. 계약상 카메라는 3대(§1-3)라 메인 1 + 서브 2 로
              딱 맞지만, 대수가 바뀌어도 화면이 비지 않도록 최소 2칸을 유지하며 늘어나게 둔다.
              ⚠️ 3칸을 넘으면 244px 안에서 칸이 좁아진다 — 넘치지는 않지만 사진이 작아진다. */}
          {[subs[0], subs[1], ...subs.slice(2)].map((image, index) => (
            <div
              key={image?.url ?? `empty-${index}`}
              className="bg-card flex min-w-0 flex-1 items-center justify-center overflow-hidden border-2"
            >
              <PhotoSlot
                image={image}
                isLoading={isLoading}
                icon="add"
                placeholder={SUB_SLOT_PLACEHOLDER[index] ?? "추가 촬영"}
              />
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

/** 확정본 133·139행의 빈 칸 문구. 사진이 없을 때만 쓴다(카메라 배치를 단정하지 않기 위해) */
const SUB_SLOT_PLACEHOLDER = ["측면/라벨", "특이사항"];

/**
 * 사진 한 칸.
 *
 * TODO(P1): 실제 이미지가 붙으면 이 안을 img 로 바꾼다.
 *   출고 화면의 `app/packing/_components/product-image-panel.tsx` 에 같은 일을 하는 코드가
 *   이미 있다 — onError 로 깨진 사진을 대체 표시로 넘기고, next/image 를 쓰지 않는 이유
 *   (백엔드 도메인 remotePatterns 합의 전)도 거기 주석에 적혀 있다. 그대로 옮겨 오면 된다.
 */
function PhotoSlot({
  image,
  isLoading,
  icon,
  placeholder,
}: {
  image: MeasurementImage | undefined;
  isLoading: boolean;
  icon: "camera" | "add";
  placeholder: string;
}) {
  if (isLoading) {
    return <SlotBody icon={icon}>측정 중…</SlotBody>;
  }

  if (image === undefined) {
    return <SlotBody icon={icon}>{placeholder}</SlotBody>;
  }

  return (
    <div className="text-muted-foreground w-full p-4 text-center">
      <span className="text-label-sm block">
        {image.cameraNo === null ? "대표 이미지" : `카메라 ${image.cameraNo}`}
      </span>
      <span className="mt-1 block font-mono text-xs break-all">{image.url}</span>
      <span className="mt-1 block text-xs">(이미지 파일 없음 — 자리표시)</span>
    </div>
  );
}

/** 사진 대신 보여줄 자리 — 확정본 119~122행(아이콘 + 문구)과 같은 구성 */
function SlotBody({ children, icon }: { children: ReactNode; icon: "camera" | "add" }) {
  const Icon = icon === "camera" ? Camera : ImagePlus;
  return (
    <div className="text-muted-foreground flex flex-col items-center gap-2 p-4 text-center">
      <Icon className={icon === "camera" ? "size-12 opacity-50" : "size-8 opacity-50"} aria-hidden />
      <span className="text-label-sm">{children}</span>
    </div>
  );
}
