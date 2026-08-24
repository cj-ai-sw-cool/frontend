"use client";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api";

/**
 * 포장 완료 — docs/02-api-spec.md §3-8 `POST /shipments/{id}/complete`.
 *
 * 순수 표시용(presentational): 실제 호출은 부모가 한다. 여기서는 클릭을 위로 올리고
 * 진행/실패 상태를 그린다.
 *
 * 화면 하단 액션 행을 통째로 맡는다 — 보조 "재피킹" + 주요 "포장 완료" (샘플 608~619행).
 * 재피킹은 부를 API 가 없어 props 도 핸들러도 없다. 근거는 아래 버튼 옆 주석(D-20) 참고.
 *
 * 왜 이렇게 큰가 / 왜 중복 클릭을 막는가
 *   이 버튼 한 번에 서버가 단일 트랜잭션으로 **재고 차감 + 박스 재고 −1 + 토트 해제 +
 *   처리량 +1** 을 수행한다(§3-8). 되돌리는 API 가 없다.
 *   그래서 (1) 화면에서 가장 큰 요소로 두고, (2) `isPending` 동안 disabled 로 두 번째
 *   요청을 원천 차단한다.
 *   예전에는 (3) "되돌릴 수 없습니다" 문구를 버튼 밑에 항상 붙여 뒀는데, 사용자 요청으로
 *   삭제됐다 — 되돌릴 수 없다는 사실 자체는 그대로지만, 매번 읽는 문구로 경고하는 대신
 *   버튼 크기·중복 클릭 차단·실패 시 경고로 다룬다. 실패 경고(409)는 그래서 더 중요해졌고
 *   절대 지우지 않는다.
 *
 * 높이 — 내용만큼만 쓰고, 버튼은 항상 화면 바닥(우측 단 끝, y=824)에 붙는다
 *   고정 스테이지(1445×940 `overflow-hidden`)에서는 넘친 만큼 스크롤이 아니라 잘린다.
 *   이 칸은 **우측 단의 마지막 칸이자 유일하게 높이가 변하는 칸**이라, 자기 높이를 고정하지
 *   않고 내용 높이(평소 버튼 64, 실패 시 경고 + 12 + 64)만 쓴다. 늘어난 만큼은 위쪽
 *   제품 이미지 패널(`flex-1`)이 내준다 — 세로 합은 두 상태 모두 824 로 같다.
 *
 *   경고를 다시 버튼 **위**로 올린 이유
 *     한 번은 아래로 내렸었다. "위에 두면 경고가 길어질 때 버튼이 아래로 밀려 화면 밖으로
 *     나간다"는 이유였는데, 그건 **버튼이 위에 붙어 있고 이 칸이 고정 높이일 때**의 이야기다.
 *     지금은 버튼이 바닥 기준(마지막 자식)이라 위로 자랄 뿐 아래로 밀려날 수 없고,
 *     경고 자체도 `max-h`+스크롤로 자라는 폭을 묶어 뒀다. 그래서 판단을 되돌린다 —
 *     읽는 순서(무슨 일이 있었는지 → 그래서 뭘 누를지)도 경고가 위일 때가 자연스럽다.
 *
 * 에러 표시
 *   계약상 실패는 409 `INVALID_STATE` / `OUT_OF_STOCK` 두 가지다. 코드별로 작업자가 할
 *   행동이 다르므로(재고 확인 vs 상태 확인) 메시지를 갈라 준다.
 *   판별은 `lib/api.ts` 의 `ApiError.is()` 를 쓴다 — 문자열 비교를 흩뿌리지 않기 위해서.
 */
export function PackCompleteButton({
  onComplete,
  disabled = false,
  isPending,
  error,
}: {
  onComplete: () => void;
  disabled?: boolean;
  isPending: boolean;
  /** 실패 결과. `ApiError` 면 코드별 안내로, 그 외에는 message 로 표시한다 */
  error?: Error | null;
}) {
  const failure = error ? describeFailure(error) : null;

  return (
    /* 높이를 고정하지 않는다 — 평소 64, 실패 시 경고(최대 120) + 12 + 64.
       마지막 자식이 버튼 행이라 이 칸이 자라도 버튼 하단은 항상 우측 단 끝에 남는다. */
    <div className="flex flex-col gap-grid-gap">
      {/* 실패 안내 — 계약상 409 두 가지(§3-8). 평소에는 자리를 차지하지 않는다.
          `max-h`+스크롤로 길이를 묶어 두는 이유: 서버 message 를 그대로 쓰는 갈래가 있어
          길이가 예측되지 않는데, 여기가 무한정 자라면 위쪽 제품 이미지 패널을 0 까지 밀어낸다.
          잘라 없애는 게 아니라 이 안에서 스크롤되므로 전문은 그대로 읽을 수 있다. */}
      {failure ? (
        <Alert variant="destructive" className="max-h-[120px] shrink-0 overflow-y-auto">
          <AlertTitle>{failure.title}</AlertTitle>
          <AlertDescription>{failure.detail}</AlertDescription>
        </Alert>
      ) : null}

      {/* 하단 액션 행 — 샘플 608~619행. 좌 보조 : 우 주요 = 1 : 2 비율 그대로다.
          이 행이 마지막 자식이라 버튼 하단 = 좌측 `품목` 패널 하단(y=824)으로 맞춰진다. */}
      <div className="flex h-16 shrink-0 gap-3">
        {/* 재피킹 — 동작 미정 (D-20). 백엔드 파이프라인 없음(D-06): 실물 토트를 출고 라인으로
            되돌리는 운영 절차로 처리되며 시스템 상태 전이가 없다. 프론트 동작은 사용자 지시 대기.
            그래서 핸들러를 아예 붙이지 않는다 — 눌러도 아무 일도 일어나지 않는 것이 현재 정상이다.
            죽은 버튼처럼 보이지 않도록 비활성으로 두지는 않는다. 잠그는 조건은 배송단위가 없을 때
            하나뿐이고, 이건 포장 완료와 같은 규칙이다(배송단위가 없으면 되돌릴 토트도 없다).
            샘플은 이 자리를 비활성으로 그렸지만 우리는 살아 있는 보조 버튼으로 둔다. */}
        <Button
          type="button"
          variant="outline"
          size="lg"
          disabled={disabled}
          className="h-16 flex-1 text-lg font-semibold"
        >
          재피킹
        </Button>

        <Button
          type="button"
          size="lg"
          // 진행 중에는 항상 잠근다 — 중복 클릭이 곧 이중 차감이다
          disabled={disabled || isPending}
          onClick={onComplete}
          className="h-16 flex-[2] text-xl font-semibold"
        >
          {isPending ? "처리 중…" : "포장 완료"}
        </Button>
      </div>
    </div>
  );
}

function describeFailure(error: Error): { title: string; detail: string } {
  if (error instanceof ApiError) {
    if (error.is("OUT_OF_STOCK")) {
      return {
        title: "재고가 부족해 완료하지 못했습니다",
        detail:
          "차감할 재고가 모자랍니다. 실물 수량과 재고 현황을 확인한 뒤 다시 시도하세요.",
      };
    }
    if (error.is("INVALID_STATE")) {
      return {
        title: "지금은 완료할 수 없는 상태입니다",
        detail:
          "이미 완료되었거나 포장 진행 상태가 아닙니다. 토트를 다시 스캔해 현재 상태를 확인하세요.",
      };
    }
  }
  return { title: "포장 완료에 실패했습니다", detail: error.message };
}
