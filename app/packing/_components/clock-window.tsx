"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { w98 } from "./win98-ui";

/**
 * 아날로그 시계 팝업 — 사용자가 준 레퍼런스 그림(win98 `Time` 그룹박스) 그대로다.
 *
 * 하단 태스크바의 시계를 누르면 열리고, 오른쪽 위 `×` 로 닫는다.
 *
 * ── 레퍼런스에서 옮긴 것 ─────────────────────────────────────────────────────
 *   · `Time` 그룹박스 — 얇은 음각 테두리(어두운 선 + 흰 선)에 라벨이 테두리를 뚫고 앉는다
 *   · 라벨의 `T` 밑줄 — win98 의 단축키 표기(Alt+T). 그림에 있으니 그대로 살렸다
 *   · 시각 표시 12개 — 청록색 **정사각형**. 원이 아니라 네모라서 도트 느낌이 난다
 *   · 시침·분침 — 흰색에 짙은 외곽선. 회색 바탕에서 흰 선만으로는 안 보인다
 *   · 초침 — 빨강 + 가운데 빨간 점
 *
 * ⚠️ 시각은 **마운트한 뒤에만** 그린다. 서버 시각과 브라우저 시각이 다르므로 SSR 로 그리면
 *    하이드레이션에서 어긋난다. 팝업 자체가 닫힌 상태로 시작하니 실제로는 늘 클라이언트에서
 *    처음 그려지지만, 그래도 `now === null` 분기를 남겨 둔다(첫 렌더에는 바늘을 그리지 않는다).
 * ⚠️ 1초마다 다시 그린다. 초침이 있으니 분 단위 갱신으로는 멈춘 시계처럼 보인다.
 */
export function ClockWindow({ onClose }: { onClose: () => void }) {
  const now = useNow();

  /* 이 창도 끌어서 옮긴다 (사용자 요청) — 본 창과 같은 방식이다.
     `transform: translate()` 만 얹어서 레이아웃을 다시 계산하지 않는다. */
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isMoving, setIsMoving] = useState(false);
  const moveRef = useRef<{ x: number; y: number } | null>(null);

  return (
    /* 처음에는 태스크바(28px) 바로 위 오른쪽에 뜬다 — 누른 자리 근처에서 열리는 것이
       win98 의 방식이다. 그 뒤로는 사용자가 옮긴 자리에 있는다.
       ⚠️ 부모(라우트 레이아웃 루트)가 fixed + overflow-hidden 이라 이 absolute 의 기준은
          스테이지 전체이고, 스테이지 밖으로는 나가지 못한다. */
    <div
      role="dialog"
      aria-label="시계"
      className={`${w98.raised} absolute right-2 bottom-9 z-[70] bg-[color:var(--surface)] p-[3px] shadow-[3px_3px_0_0_rgba(0,0,0,0.35)]`}
      style={{
        transform: `translate(${offset.x}px, ${offset.y}px)`,
        transition: isMoving ? "none" : "transform 120ms ease-out",
      }}
    >
      {/* 창 타이틀바 — 여기를 잡고 끈다 */}
      <div
        onPointerDown={(event) => {
          // 닫기(×)를 눌렀을 때는 창이 끌려오면 안 된다
          if ((event.target as HTMLElement).closest("button") !== null) return;
          event.currentTarget.setPointerCapture(event.pointerId);
          moveRef.current = { x: event.clientX, y: event.clientY };
          setIsMoving(true);
        }}
        onPointerMove={(event) => {
          const start = moveRef.current;
          if (start === null) return;
          const dx = event.clientX - start.x;
          const dy = event.clientY - start.y;
          moveRef.current = { x: event.clientX, y: event.clientY };
          setOffset((prev) => ({
            /* 오른쪽 아래에 붙어 있으므로 왼쪽·위로는 많이, 오른쪽·아래로는 조금만 갈 수 있다.
               스테이지 밖으로 밀어 놓고 못 찾는 일이 없게 묶어 둔다. */
            x: clamp(prev.x + dx, -1380, 8),
            y: clamp(prev.y + dy, -720, 8),
          }));
        }}
        onPointerUp={() => {
          moveRef.current = null;
          setIsMoving(false);
        }}
        onPointerCancel={() => {
          moveRef.current = null;
          setIsMoving(false);
        }}
        /* 두 번 누르면 처음 자리(우하단)로 — 창을 어디 두었는지 잊었을 때의 탈출구다 */
        onDoubleClick={() => setOffset({ x: 0, y: 0 })}
        title="끌어서 옮기세요 · 두 번 누르면 제자리"
        className={`${w98.titleText} flex h-6 cursor-move items-center justify-between gap-2 bg-[color:var(--title-navy)] pr-0.5 pl-1 text-[color:var(--primary-foreground)] select-none`}
        style={{ touchAction: "none" }}
      >
        <span>Clock</span>
        <button
          type="button"
          onClick={onClose}
          aria-label="시계 닫기"
          title="닫기"
          className={`${w98.btn} ${w98.raised} flex size-4 items-center justify-center`}
        >
          <X className="size-2.5" aria-hidden />
        </button>
      </div>

      {/* `Time` 그룹박스 — 레퍼런스 그림의 액자 */}
      <div className="p-2">
        <div
          className="relative px-2 pt-3 pb-2"
          style={{
            // win98 그룹박스 = 어두운 선 하나 + 그 바깥 오른쪽·아래로 흰 선 하나
            border: "1px solid #808080",
            boxShadow: "1px 1px 0 0 #ffffff",
          }}
        >
          {/* 라벨이 테두리를 뚫고 앉는다 — 배경색으로 선을 지워 그렇게 보이게 한다 */}
          <span
            className="absolute -top-2 left-2 bg-[color:var(--surface)] px-1"
            style={{ fontSize: "var(--fs-small)" }}
          >
            <u>T</u>ime
          </span>

          <ClockFace now={now} />
        </div>

        {/* 디지털 시각도 같이 — 아날로그만 있으면 정확한 분을 읽는 데 시간이 걸린다.
            ⚠️ `now === null` 인 첫 렌더에는 자리만 잡아 둔다(레이아웃이 튀지 않게). */}
        <p className={`${w98.mono} ${w98.small} mt-1.5 text-center tabular-nums`}>
          {now === null ? "--:--:--" : formatDigital(now)}
        </p>
      </div>
    </div>
  );
}

/* ── 시계 문자판 ─────────────────────────────────────────────────────────────
   SVG 로 그린다. 100×100 좌표계에 그린 뒤 화면 크기로 줄이므로 어느 크기에서도 안 뭉갠다. */
const FACE_PX = 156;

function ClockFace({ now }: { now: Date | null }) {
  const seconds = now === null ? 0 : now.getSeconds();
  const minutes = now === null ? 0 : now.getMinutes();
  const hours = now === null ? 0 : now.getHours() % 12;

  /* 각도 — 12시가 0°, 시계 방향. 시침은 분에 따라 조금씩 움직인다(정시에만 딱 떨어지면
     실제 시계처럼 안 보인다). */
  const secondAngle = seconds * 6;
  const minuteAngle = minutes * 6 + seconds * 0.1;
  const hourAngle = hours * 30 + minutes * 0.5;

  return (
    <svg
      viewBox="0 0 100 100"
      width={FACE_PX}
      height={FACE_PX}
      role="img"
      aria-label={now === null ? "시계" : `현재 시각 ${formatDigital(now)}`}
      style={{ display: "block", backgroundColor: "var(--surface)" }}
    >
      {/* 시각 표시 12개 — 청록 정사각형 + 그 안쪽에 숫자.
          ★ 숫자는 레퍼런스 그림에 없지만 넣었다 (사용자 요청). 네모만 있으면 3시와 4시를
            눈으로 세어야 한다. 눈금은 바깥 링(반지름 39), 숫자는 안쪽 링(반지름 28)에 둬서
            바늘이 지나가도 숫자를 가리지 않는다.
          ⚠️ 글꼴을 지정하지 않는다 — 부모(win98 테마)의 Arimo 를 그대로 물려받는다.
             win98 의 시스템 글꼴(MS Sans Serif) 자리에 우리가 넣은 것이 Arimo 다.
          ⚠️ 12·3·6·9 는 네모를 키우고 숫자를 굵게 한다. 방향을 잡는 기준점이라 나머지 여덟
             개와 같은 무게로 두면 시계가 평평해 보인다. */}
      {Array.from({ length: 12 }, (_, index) => {
        const angle = (index * 30 * Math.PI) / 180;
        const cx = 50 + 39 * Math.sin(angle);
        const cy = 50 - 39 * Math.cos(angle);
        const size = index % 3 === 0 ? 8 : 6.5;

        /* 문자판의 12시는 배열의 0번이다 — 0을 12로 바꿔 준다 */
        const hourLabel = index === 0 ? 12 : index;
        const tx = 50 + 28 * Math.sin(angle);
        const ty = 50 - 28 * Math.cos(angle);

        return (
          <g key={index}>
            <rect
              x={cx - size / 2}
              y={cy - size / 2}
              width={size}
              height={size}
              fill="#16a3a3"
              stroke="#0b6b6b"
              strokeWidth={1}
            />
            <text
              x={tx}
              y={ty}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={index % 3 === 0 ? 11 : 9.5}
              fontWeight={index % 3 === 0 ? 700 : 400}
              fill="#000000"
            >
              {hourLabel}
            </text>
          </g>
        );
      })}

      {now === null ? null : (
        <>
          {/* 시침·분침 — 짙은 선 위에 흰 선을 겹쳐 외곽선 있는 흰 바늘을 만든다.
              회색 바탕에 흰 선만 그으면 경계가 사라져서 두 바늘이 붙어 보인다. */}
          <Hand angle={hourAngle} length={22} width={7} />
          <Hand angle={minuteAngle} length={33} width={6} />

          {/* 초침 — 가늘고 빨갛다. 꼬리를 조금 남기는 게 실제 시계의 모양이다 */}
          <line
            x1={50 - 6 * Math.sin((secondAngle * Math.PI) / 180)}
            y1={50 + 6 * Math.cos((secondAngle * Math.PI) / 180)}
            x2={50 + 37 * Math.sin((secondAngle * Math.PI) / 180)}
            y2={50 - 37 * Math.cos((secondAngle * Math.PI) / 180)}
            stroke="#d61a1a"
            strokeWidth={1.5}
          />
          <circle cx={50} cy={50} r={3} fill="#d61a1a" stroke="#7a0d0d" strokeWidth={1} />
        </>
      )}
    </svg>
  );
}

/** 외곽선 있는 흰 바늘 하나 */
function Hand({ angle, length, width }: { angle: number; length: number; width: number }) {
  const radians = (angle * Math.PI) / 180;
  const x2 = 50 + length * Math.sin(radians);
  const y2 = 50 - length * Math.cos(radians);

  return (
    <>
      <line x1={50} y1={50} x2={x2} y2={y2} stroke="#2a2a2a" strokeWidth={width} strokeLinecap="round" />
      <line
        x1={50}
        y1={50}
        x2={x2}
        y2={y2}
        stroke="#ffffff"
        strokeWidth={width - 2.5}
        strokeLinecap="round"
      />
    </>
  );
}

/* ── 시각 ────────────────────────────────────────────────────────────────────
   ⚠️ 1초마다 갱신한다. 초침이 있으니 분 단위로는 멈춘 시계로 보인다.
   ⚠️ 이펙트 **본문에서 직접** setState 하지 않는다(그러면 렌더가 한 번 더 돈다).
      `tick` 을 거쳐 부르는 것과 setInterval 콜백은 그 규칙에 걸리지 않는다. */
function useNow(): Date | null {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    const tick = () => setNow(new Date());
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, []);

  return now;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function formatDigital(date: Date): string {
  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
}
