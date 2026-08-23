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
 *   요청을 원천 차단하고, (3) 되돌릴 수 없다는 문구를 항상 붙여 둔다.
 *
 * 높이를 스스로 지킨다
 *   고정 스테이지(1445×940 `overflow-hidden`)에서는 넘친 만큼 스크롤이 아니라 잘린다.
 *   그래서 부모가 준 높이(144) 안에서 버튼 행은 고정, 안내/경고 칸만 남는 높이를 쓰고
 *   그 안에서 스크롤한다. 예전에는 실패 경고가 버튼 **위**에 붙어 내용이 길어지면 버튼을
 *   아래로 밀어냈는데, 지금 그 구조는 버튼이 화면 밖으로 밀려나는 것과 같은 뜻이라 뒤집었다.
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
    /* 부모가 높이를 정해 준다(144). 버튼 64 + 간격 12 + 안내/실패 68.
       고정 스테이지에서는 넘치는 만큼 잘리므로 이 칸도 스스로 높이를 지켜야 한다. */
    <div className="flex h-full flex-col gap-grid-gap">
      {/* 하단 액션 행 — 샘플 608~619행. 좌 보조 : 우 주요 = 1 : 2 비율 그대로다. */}
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

      {/* 상시 안내와 실패 안내가 **같은 자리**를 나눠 쓴다 — 버튼 바로 아래가 이 버튼이
          무슨 일을 하는지 읽는 자리이기 때문이다. 실패했을 때는 그 자리를 경고가 가져간다.
          고정 높이(68)라 409 안내가 길어지면 이 안에서 스크롤한다 — 잘려서 사라지지 않는다.
          창고에서 놓친 경고는 오출고로 이어지므로 내용을 없애는 선택지는 없다. */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {failure ? (
          <Alert variant="destructive">
            <AlertTitle>{failure.title}</AlertTitle>
            <AlertDescription>{failure.detail}</AlertDescription>
          </Alert>
        ) : (
          <p className="text-center text-sm text-muted-foreground">
            완료하면 재고와 박스가 차감되고 토트가 해제됩니다. 되돌릴 수 없습니다.
          </p>
        )}
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
