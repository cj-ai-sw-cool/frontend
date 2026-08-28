"use client";

import { TriangleAlert } from "lucide-react";
import type { Dimensions, MeasurementResponse } from "@/lib/types";
import { Panel, Sunken, TrayBox, w98 } from "./win98-ui";

/**
 * 1-3 자동 측정 결과 — 목업의 `Automatic Measurement Data` 패널.
 *
 * 목업은 파인 상자 4개(Width / Length / Height / Weight)를 가로로 늘어놓고, 값은
 * Courier Prime 큰 숫자다. 무게만 빨간색으로 그려져 있다.
 *
 * ⚠️ 목업의 빨간 무게에 **대응하는 상태가 우리 계약에 없다** — 1-3 응답에 "무게 상한 초과"
 *    같은 필드가 없다(§1-3). 없는 상태를 그리는 대신 실제로 존재하는 문제 상태인
 *    **저울값 미수신**(`weightKg == null`)에 그 빨강을 배정했다. 확정(1-4)이 400 으로
 *    막히는 조건이라 작업자가 빨갛게 알아야 하는 것도 맞다. 상한 초과가 계약에 생기면
 *    여기 조건만 늘리면 된다.
 *
 * ⚠️ 치수(가로·세로·높이)는 카메라 추론값이라 신뢰도 게이트의 대상이고, 무게는 저울
 *    실측이라 게이트와 무관하다(§1-3). 한때 이 구분을 칸마다 한 줄씩 적어 뒀지만
 *    **지금은 뺐다**(사용자 결정) — 헤더의 상태 배지와 사유 문구가 같은 말을 하고 있어서
 *    숫자 읽는 데 방해만 됐다. 자세한 사정은 아래 Box 주석 참고.
 */
export function MeasurementPanel({
  data,
  manualDims,
  manualWeightKg,
  isLoading,
  error,
  note,
}: {
  data?: MeasurementResponse;
  manualDims?: Dimensions | null;
  manualWeightKg?: number | null;
  isLoading: boolean;
  error?: string | null;
  /**
   * 지금 무엇을 하면 되는지 한 줄 — 스캔 결과가 정하는 안내다.
   * (예: `REGISTERED — 촬영 없이 수량만 입고할 수 있습니다`)
   *
   * ★ 원래 `Product Manifest` 안 마지막 줄에 있었는데 **여기로 옮겼다** (사용자 결정).
   *   거기서는 데이터 여섯 줄에 묻혀 잘 안 읽혔고, 정작 그 안내가 가리키는 다음 동작
   *   (촬영·측정)은 이 패널에 있다. 안내는 시킬 일 옆에 있어야 한다.
   * ⚠️ 경고(게이트 미통과·측정 실패)가 있으면 그쪽이 이긴다 — 한 자리에 둘을 겹쳐 쓰되
   *    급한 쪽이 먼저다.
   */
  note?: string;
}) {
  const isManualWinning = manualDims != null;
  const inferred = !isManualWinning && data?.status === "INFERRED" ? data : null;

  const widthCm = inferred?.inferred.widthCm;
  const lengthCm = inferred?.inferred.lengthCm;
  const heightCm = inferred?.inferred.heightCm;
  const weightKg = isManualWinning ? undefined : data?.weightKg;

  const isDimsAlert =
    !isManualWinning && data !== undefined && (data.status === "MEASURE_FAILED" || !data.gatePassed);
  const isWeightAlert = data !== undefined && data.weightKg == null && manualWeightKg == null;

  const notice = describeNotice({ data, error, manualDims, manualWeightKg });
  const status = describeStatus(data, isManualWinning, isLoading);

  return (
    <Panel
      title="Automatic Measurement Data"
      right={
        <>
          {/* ★ 행동 안내를 **제목 줄로** 옮겼다 (사용자 결정 — 상자 위 줄에서는 잘렸다).
              제목과 상태 배지 사이가 원래 비어 있던 자리라 새 공간을 만들지 않았고,
              폭이 500px 가까이 나와서 문장이 접히거나 잘리지 않는다.
              ⚠️ 경고(게이트 미통과·측정 실패)는 여전히 상자 **위 빨간 줄**이다. 급한 말은
                 제목 줄에 끼워 넣으면 안 된다 — 눈에 걸리는 크기가 달라야 한다. */}
          {notice.tone !== "error" && note !== undefined && note !== "" ? (
            <span
              title={note}
              /* ⚠️ **줄 높이를 20px 로 준다.** 13px 글자에 14px 줄(=w98.small)로 두었더니
                 한글 윗부분이 잘렸다 — 이 줄은 모노 폰트라 한글이 맑은 고딕으로 폴백되는데,
                 그 글리프가 라틴보다 위아래로 크기 때문이다. `truncate`(overflow:hidden)와
                 만나면 그 넘친 부분이 그대로 잘려 나간다.
                 ⚠️ 모노를 뺐다 — 문장 대부분이 한글이라 모노로 얻을 게 없고(자릿수 정렬이
                    필요한 값이 아니다), 오히려 자간이 벌어져 읽기 나빴다.
                 ⚠️ 색과 굵기를 올렸다: 흐린 회색 → 본문색 + 700. 안내는 읽으라고 있는 줄이다. */
              /* ★ 14 → **18px** (사용자 지적 — 작아서 안 보였다). 이 줄은 "지금 무엇을 해야
                    하는가"를 말하는 유일한 자리라, 제목보다 작으면 안 읽힌다.
                 ⚠️ 줄 높이도 20 → 26px 로 같이 올린다. 한글 폴백 글꼴은 라틴보다 위아래로
                    커서, 글자만 키우고 줄을 그대로 두면 `truncate`(overflow:hidden)에 윗부분이
                    잘려 나간다 — 예전에 13px 로 겪은 것과 같은 문제다. */
              className="min-w-0 flex-1 truncate text-right text-[18px] leading-[26px] font-bold text-[color:var(--foreground)]"
            >
              &gt; {note}
            </span>
          ) : null}
          <TrayBox tone={status.tone === "error" ? "error" : "normal"} className="shrink-0">
            {status.label}
          </TrayBox>
        </>
      }
      className="shrink-0"
    >
      {/* ★ 경고를 **측정 상자 위로** 올렸다 (사용자 결정).
          게이트 미통과·측정 실패는 "이 숫자를 그대로 쓰면 안 된다"는 말인데, 아래에 있으면
          숫자를 다 읽고 난 뒤에야 눈에 들어온다. 위에 두면 숫자를 읽기 전에 먼저 걸린다.
          ⚠️ 자리를 항상 차지하지는 않는다 — 평소(정상)에는 이 줄이 통째로 없다. 빈 줄을
             남겨 두면 정상 상태에서 위쪽이 어색하게 비고, 이 패널은 shrink-0 이라 사라져도
             아래 사진 패널(flex-1)이 그만큼 늘어나 전체 높이는 그대로다. */}
      {notice.tone === "error" && notice.text !== "" ? (
        <div
          role="alert"
          title={notice.text}
          className={`${w98.sunken} mb-2 flex items-center gap-2 bg-[#ffdad6] px-2 py-1 font-bold text-[color:var(--status-error)]`}
        >
          <TriangleAlert className="size-4 shrink-0" aria-hidden />
          <span className="truncate">{notice.text}</span>
        </div>
      ) : null}

      <div className="grid grid-cols-4 gap-2">
        <Box label="Width" unit="cm" value={formatCm(widthCm)} alert={isDimsAlert} />
        <Box label="Length" unit="cm" value={formatCm(lengthCm)} alert={isDimsAlert} />
        <Box label="Height" unit="cm" value={formatCm(heightCm)} alert={isDimsAlert} />
        {/* ⚠️ 무게가 빨개지는 조건은 치수와 다르다 — 게이트가 아니라 **저울값 미수신**이다. */}
        <Box label="Weight" unit="kg" value={formatKg(weightKg)} alert={isWeightAlert} />
      </div>

      {/* 수기값을 적용한 상태의 안내 — 경고가 아니라 "무엇이 저장될지"의 예고라 아래에 둔다 */}
      {notice.tone === "info" && notice.text !== "" ? (
        <p
          title={notice.text}
          className={`${w98.small} mt-2 truncate text-[color:var(--muted-foreground)]`}
        >
          {notice.text}
        </p>
      ) : null}
    </Panel>
  );
}

/**
 * 목업의 파인 측정 상자 하나.
 *
 * ⚠️ 값 아래에 있던 출처 한 줄(`카메라 추론` / `저울 실측`)은 **뺐다** (사용자 결정).
 *    치수는 추론값이라 신뢰도 게이트의 대상이고 무게는 저울 실측이라 게이트와 무관하다는
 *    사실(§1-3)은 여전히 유효하지만, 그건 헤더의 상태 배지와 그 옆 사유 문구가 이미 말한다 —
 *    칸마다 반복하면 숫자를 읽으러 온 눈에 잡음이 된다.
 *    그 줄이 빠진 만큼 숫자를 키웠다(34 → 44px).
 */
function Box({
  label,
  unit,
  value,
  alert,
}: {
  label: string;
  /** `cm` / `kg` — 숫자 **아래 왼쪽**에 따로 앉는다 */
  unit: string;
  value: string;
  alert: boolean;
}) {
  const isEmpty = value === EMPTY;

  return (
    /* ★ 112 → **132px** (사용자 결정). 한때 156px 까지 올렸다가 되돌렸다 — 제목 줄의 안내
         문구를 18px 로 키우는 쪽이 더 급했고, 그 높이는 여기서 내주는 편이 맞다.
         늘어난 20px + 제목 줄 6px 은 아래 Visual Inspection(flex-1)이 내준다. 우측 열을
         68px 넓힌 것과 맞물려 사진 칸이 가로세로 함께 줄어든다.
       ⚠️ 숫자를 더 키우지는 않았다. 56px 은 이미 두 칸 떨어져서도 읽히는 크기이고,
          여기서 더 키우면 `120.0` 같은 다섯 글자가 칸을 넘는다. 늘린 건 여백이다 —
          숫자 주변이 비어야 숫자가 커 보인다. */
    <Sunken className="flex min-h-[132px] flex-col justify-center px-2 py-3">
      {/* ★ 라벨에서 단위를 뗐다 (사용자 결정) — `Width (cm)` 처럼 붙여 두면 단위가 제목의
          일부처럼 읽혀서, 정작 숫자를 볼 때는 무슨 단위인지 다시 위를 봐야 한다. */}
      <span className={`${w98.small} text-[color:var(--muted-foreground)]`}>{label}</span>

      {/* ★ 단위는 숫자 **오른쪽 아래**에 붙는다 (사용자 결정).
          `items-baseline` 이라 큰 숫자와 작은 단위가 같은 밑줄에 앉는다 — 그래서 단위가
          자연히 숫자의 오른쪽 아래에 놓인다. 세로 가운데에 맞추면 숫자 옆에 붕 떠 보인다.
          ⚠️ 숫자에 `tabular-nums` 가 걸려 있어 자릿수가 바뀌어도 단위 위치가 흔들리지 않는다. */}
      <div className="mt-1 flex items-baseline gap-1.5">
        <span
          className={`${w98.mono} text-[56px] leading-[58px] font-bold tabular-nums ${
            alert
              ? "text-[color:var(--status-error)]"
              : isEmpty
                ? "text-[color:var(--surface-dim)]"
                : "text-[color:var(--foreground)]"
          }`}
        >
          {value}
        </span>
        <span className={`${w98.mono} text-[15px] leading-5 text-[color:var(--muted-foreground)]`}>
          {unit}
        </span>
      </div>
    </Sunken>
  );
}

/* ── 문구 (v2/v3 에서 그대로 — 계약 해석이라 스킨과 무관하다) ────────────── */

function describeNotice({
  data,
  error,
  manualDims,
  manualWeightKg,
}: {
  data: MeasurementResponse | undefined;
  error: string | null | undefined;
  manualDims?: Dimensions | null;
  manualWeightKg?: number | null;
}): { tone: "error" | "info"; text: string } {
  if (manualDims != null) {
    const { widthCm, lengthCm, heightCm } = manualDims;
    const weight = manualWeightKg == null ? "무게 저울값" : `${formatKg(manualWeightKg)} kg`;
    return {
      tone: "info",
      text: `수기 ${formatCm(widthCm)} / ${formatCm(lengthCm)} / ${formatCm(heightCm)} cm · ${weight} — 등록 시 저장`,
    };
  }
  if (error) return { tone: "error", text: error };
  if (data === undefined) return { tone: "info", text: "" };
  if (data.status === "MEASURE_FAILED") {
    return {
      tone: "error",
      text: `측정 실패 (${data.failReason}) — 재촬영하거나 수동 입력으로 확정하세요`,
    };
  }
  if (!data.gatePassed) {
    return {
      tone: "error",
      text: `게이트 미통과 — ${data.gateFailReasons.join(" · ")} · 재촬영 또는 수동 입력으로 해제`,
    };
  }
  return { tone: "info", text: "" };
}

function describeStatus(
  data: MeasurementResponse | undefined,
  isManualWinning: boolean,
  isLoading: boolean,
): { tone: "ok" | "error" | "idle"; label: string } {
  if (isLoading) return { tone: "idle", label: "MEASURING…" };
  if (isManualWinning) return { tone: "ok", label: "MANUAL" };
  if (data === undefined) return { tone: "idle", label: "STANDBY" };
  if (data.status === "MEASURE_FAILED") return { tone: "error", label: "FAILED" };
  // 신뢰도는 모델이 줄 때만 배지에 붙인다. 없을 때 0 으로 접으면 게이트를 통과한 측정이
  // `MEASURED 0%` 로 보여 반대로 읽힌다 (D-24).
  const percent = data.confidence == null ? "" : ` ${(data.confidence * 100).toFixed(0)}%`;
  if (!data.gatePassed) return { tone: "error", label: `GATE${percent || " 미통과"}` };
  return { tone: "ok", label: `MEASURED${percent}` };
}

/* ── 숫자 ───────────────────────────────────────────────── */

const EMPTY = "--";

function formatCm(value: number | undefined): string {
  return value === undefined ? EMPTY : value.toFixed(1);
}

/**
 * 무게 — 소수점 뒤 **불필요한 0 을 지운다** (`12.5` / `0.52` / `9.8`).
 * 목업 표기가 `12.5` 라 자릿수를 줄여야 하는데, `toFixed(1)` 로 내리면 mock 41 번의
 * `0.52kg` 이 `0.5` 가 돼 실제 값을 잃는다. 최대 3자리까지 쓰되 꼬리 0 만 자른다.
 */
function formatKg(value: number | null | undefined): string {
  if (value === undefined || value === null) return EMPTY;
  return String(Number(value.toFixed(3)));
}
