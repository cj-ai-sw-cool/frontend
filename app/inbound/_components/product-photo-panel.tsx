"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { MeasurementImage } from "@/lib/types";

/**
 * 제품 촬영 사진 — docs/02-api-spec.md §1-3 의 `images`(카메라 3대),
 * 확정 후에는 §1-6 `GET /products/{id}/images` 가 같은 형태로 내려준다.
 * Stitch 샘플 P1 화면의 "제품 메인 촬영 사진"(914~929행)과
 * "제품 서브 촬영 사진"(931~947행) 두 패널에 대응한다.
 *
 * 순수 표시용(presentational): API 를 부르지 않는다.
 *
 * 메인 / 서브를 어떻게 가르나
 *   계약에는 "메인"이라는 개념이 없다. 카메라 번호가 붙은 사진 배열이 전부다.
 *   샘플이 한 장을 크게, 나머지를 작게 그리므로 **첫 장을 메인, 나머지를 서브**로 둔다.
 *   (1-6 의 MASTER_FALLBACK 은 `cameraNo: null` 한 장이라 자연히 메인만 그려진다.)
 *   샘플의 서브 슬롯 이름("측면/라벨", "특이사항")은 카메라 배치를 전제한 문구라 쓰지 않았다 —
 *   어느 카메라가 무엇을 찍는지는 계약에도 없고 하드웨어 배치가 정해지면 바뀔 값이다.
 *   대신 응답이 준 카메라 번호를 그대로 적는다.
 *
 * ⚠️ **지금은 사진을 실제로 그리지 않는다.** 저장소에 이미지 파일이 없고(mock url 은 존재하지
 *    않는 경로다), 외부 URL 은 금지다(네트워크·CSP 의존을 만들지 않기 위해).
 *    그래서 회색 자리표시 + 파일 경로 텍스트만 그린다.
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
    <div className="space-y-3">
      {/* ── 메인 (샘플 914~929행) ───────────────────────────── */}
      <section className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase">
            제품 메인 촬영 사진
          </h3>
          <div className="flex items-center gap-2">
            {sourceLabel ? (
              <span className="text-xs text-muted-foreground">{sourceLabel}</span>
            ) : null}
            {/* TODO(P1): "전체보기" — 사진을 크게 띄우는 모달. components/ui/dialog.tsx 사용.
                촬영본을 눈으로 검수하는 용도라 확대가 필요하다(샘플 917~920행).
                실제 이미지가 붙기 전까지는 띄울 게 없어서 비활성으로 뒀다. */}
            <Button type="button" variant="outline" size="sm" disabled>
              전체보기
            </Button>
          </div>
        </div>

        <div className="min-h-[180px] border-2 bg-muted">
          {isLoading ? (
            <Skeleton className="h-[180px] w-full" />
          ) : (
            <PhotoSlot image={main} placeholder="촬영 대기 중" tall />
          )}
        </div>
      </section>

      {/* ── 서브 (샘플 931~947행) ───────────────────────────── */}
      <section className="space-y-2">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase">
          제품 서브 촬영 사진
        </h3>
        <div className="grid grid-cols-2 gap-3">
          {isLoading ? (
            <>
              <Skeleton className="h-28 w-full" />
              <Skeleton className="h-28 w-full" />
            </>
          ) : (
            /* 샘플은 서브 칸을 2개로 고정해 뒀다. 계약상 카메라는 3대(§1-3)라 메인 1 + 서브 2 로
               딱 맞지만, 대수가 바뀌어도 화면이 비지 않도록 최소 2칸을 유지하며 늘어나게 둔다. */
            [subs[0], subs[1], ...subs.slice(2)].map((image, index) => (
              <div
                key={image?.url ?? `empty-${index}`}
                className="min-h-28 border-2 bg-muted"
              >
                <PhotoSlot image={image} placeholder="촬영 대기 중" />
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

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
  placeholder,
  tall = false,
}: {
  image: MeasurementImage | undefined;
  placeholder: string;
  tall?: boolean;
}) {
  if (image === undefined) {
    return <SlotBody tall={tall}>{placeholder}</SlotBody>;
  }

  return (
    <SlotBody tall={tall}>
      <span className="block font-medium">
        {image.cameraNo === null ? "대표 이미지" : `카메라 ${image.cameraNo}`}
      </span>
      <span className="mt-1 block font-mono text-xs break-all">{image.url}</span>
      <span className="mt-1 block text-xs">(이미지 파일 없음 — 자리표시)</span>
    </SlotBody>
  );
}

/** 사진 대신 보여줄 회색 자리 — 상태가 어떻든 같은 자리·같은 크기를 쓰도록 */
function SlotBody({ children, tall }: { children: ReactNode; tall: boolean }) {
  return (
    <div
      className={`flex w-full items-center justify-center p-4 text-center text-sm text-muted-foreground ${
        tall ? "min-h-[180px]" : "min-h-28"
      }`}
    >
      <span>{children}</span>
    </div>
  );
}
