"use client";

import { useCallback, useState } from "react";
import { ChestBurst } from "./chest-burst";
import { w98 } from "./win98-ui";

/**
 * 바탕화면 이스터에그 — 청록 바탕 한가운데의 **마인크래프트 동굴 구덩이**.
 * 그 어둠 속에서 **워든이 눈을 깜빡이며 천천히 올라온다.**
 *
 * ★ 워든은 **상자를 하나 들고 있다.** 그 상자를 누르면 화면 가운데에 진짜 3D 상자가 떠오르고
 *   뚜껑이 열리며 돼지가 튀어나온다(`chest-burst.tsx`). 배경에서 **클릭을 받는 것은 그 상자
 *   하나뿐**이고, 나머지는 창을 끌 때 방해되지 않도록 전부 통과시킨다.
 *
 * 평소에는 창이 바탕을 통째로 덮고 있어서 보이지 않는다. 창 타이틀바를 잡고 아래로 끌어
 * 내리면 그제서야 드러난다 — 그게 이 그림의 전부이자 의도다(사용자 요청).
 *
 * ★ 참고한 그림은 **위에서 내려다본 구덩이**다(사용자가 준 스크린샷). 그래서 언덕 옆모습이
 *   아니라 **동심원**으로 그린다 — 바깥은 잔디, 안으로 갈수록 돌이 어두워지고, 가운데는 검다.
 *   깊이를 색의 단계로만 표현하는 것이 마인크래프트의 방식이기도 하다.
 *
 * ★ 타일을 손으로 찍지 않고 **거리로 계산**한다. 중심에서의 타원 거리에 노이즈를 조금 섞어
 *   층을 가르면, 손으로 찍은 것보다 자연스럽게 우둘투둘하고 크기도 마음대로 바꿀 수 있다.
 *
 * ⚠️ 노이즈는 좌표 해시다. Math.random 을 쓰면 렌더마다 지형이 달라져 배경이 지직거리고,
 *    서버·클라이언트 결과도 어긋난다.
 * ⚠️ `pointer-events: none` — 배경이라 클릭을 먹으면 창을 끌 때 방해가 된다.
 * ⚠️ `aria-hidden` — 스크린리더에게는 아무 의미가 없는 장식이다.
 * ⚠️ 움직임은 CSS 애니메이션이라 "동작 줄이기"를 켠 사용자에게는 멈춘다(win98.module.css).
 */

/** 한 블록의 크기(px)와 판의 크기(블록 수) */
const TILE = 13;
const COLS = 34;
const ROWS = 24;

/** 구덩이의 반지름(블록). 가로로 넓은 타원이라 위에서 본 느낌이 난다 */
const RADIUS_X = 13;
const RADIUS_Y = 9;

/** 층 — 바깥에서 안으로. `until` 은 정규화 거리(1 = 구덩이 가장자리) */
const LAYERS: { until: number; base: string; dark: string }[] = [
  { until: 0.4, base: "#050505", dark: "#0a0a0a" }, // 바닥 없는 어둠
  { until: 0.56, base: "#3a3a3a", dark: "#2c2c2c" }, // 깊은 돌
  { until: 0.72, base: "#5a5a5a", dark: "#4a4a4a" }, // 중간 돌
  { until: 0.88, base: "#7f7f7f", dark: "#6c6c6c" }, // 얕은 돌
  { until: 1.0, base: "#8a8a8a", dark: "#767676" }, // 가장자리 돌
];

/** 구덩이 바깥 — 잔디밭. 가끔 흙과 잎이 섞인다 */
const GRASS = { base: "#6aa03c", dark: "#55832f" };
const DIRT = { base: "#8b5a2b", dark: "#734820" };
const LEAF = { base: "#4f7c2a", dark: "#3e6220" };
/** 구덩이 안쪽 가장자리에 낀 이끼 — 참고 사진의 초록 얼룩 */
const MOSS = { base: "#5c7a3a", dark: "#48602c" };

export function CaveEntrance() {
  /* 상자를 눌렀는가. 누르는 동안에는 3D 상자가 화면 가운데에 떠 있다 */
  const [isBursting, setIsBursting] = useState(false);
  const finish = useCallback(() => setIsBursting(false), []);

  const openChest = useCallback(() => {
    /* ⚠️ "동작 줄이기" 를 켠 사용자에게는 열지 않는다. 여러 개가 갑자기 튀어나오는 움직임은
          그 설정이 막으려는 바로 그것이다. */
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    setIsBursting(true);
  }, []);

  const width = COLS * TILE;
  const height = ROWS * TILE;
  const centerX = (COLS - 1) / 2;
  const centerY = (ROWS - 1) / 2;

  const tiles: { x: number; y: number; base: string; dark: string }[] = [];

  for (let y = 0; y < ROWS; y += 1) {
    for (let x = 0; x < COLS; x += 1) {
      /* 타원 거리 + 노이즈. 노이즈가 있어야 가장자리가 블록답게 들쭉날쭉해진다 */
      const nx = (x - centerX) / RADIUS_X;
      const ny = (y - centerY) / RADIUS_Y;
      const noise = (hash(x, y, 1) % 100) / 100 - 0.5;
      const distance = Math.sqrt(nx * nx + ny * ny) + noise * 0.11;

      if (distance > 1.0) {
        /* 구덩이 바깥 — 잔디밭. 판 가장자리로 갈수록 아무것도 없는 게 자연스러워서
           멀리는 그리지 않는다(청록 바탕이 그대로 보인다). */
        if (distance > 1.34) continue;
        const roll = hash(x, y, 2) % 10;
        const palette = roll === 0 ? DIRT : roll <= 2 ? LEAF : GRASS;
        tiles.push({ x, y, ...palette });
        continue;
      }

      const layer = LAYERS.find((one) => distance <= one.until) ?? LAYERS[LAYERS.length - 1];
      /* 안쪽 가장자리에만 이끼를 조금 — 참고 사진에서 초록이 걸쳐 있던 자리다 */
      const isMossy = distance > 0.62 && distance < 0.9 && hash(x, y, 3) % 7 === 0;
      tiles.push({ x, y, ...(isMossy ? MOSS : layer) });
    }
  }

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 flex items-center justify-center"
    >
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        shapeRendering="crispEdges"
      >
        {tiles.map((tile) => (
          <g key={`${tile.x}-${tile.y}`}>
            <rect
              x={tile.x * TILE}
              y={tile.y * TILE}
              width={TILE}
              height={TILE}
              fill={tile.base}
            />
            {/* 블록마다 어두운 점 두 개 — 마인크래프트 텍스처의 거친 느낌 */}
            {[0, 1].map((n) => (
              <rect
                key={n}
                x={tile.x * TILE + (hash(tile.x, tile.y, n + 4) % (TILE - 3))}
                y={tile.y * TILE + (hash(tile.y, tile.x, n + 9) % (TILE - 3))}
                width={3}
                height={3}
                fill={tile.dark}
              />
            ))}
          </g>
        ))}

        <Warden
          centerX={width / 2}
          bottomY={height / 2 + RADIUS_Y * TILE * 0.42}
          onChestClick={openChest}
        />
      </svg>

      {/* 3D 상자는 **누른 순간에만** 불러온다 — 모델이 10.4MB 라 배경에 늘 띄워 둘 수 없다 */}
      <ChestBurst active={isBursting} onDone={finish} />
    </div>
  );
}

/* ── 워든 ────────────────────────────────────────────────────────────────────
   어둠 속에서 **천천히 올라왔다 다시 가라앉는다.** 눈은 그와 별개로 깜빡인다.

   ⚠️ 형태는 실루엣이다. 원작 워든의 특징 세 가지만 남겼다 —
      새까만 몸, 청록으로 빛나는 가슴의 결, 그리고 **가로로 길게 빛나는 눈**.
      작게 그려도 그 셋이면 워든으로 읽힌다. */
/* ── 워든이 든 상자 ──────────────────────────────────────────────────────────
   워든 몸통 앞에 놓는 작은 마인크래프트 상자. 원작의 특징 셋만 남겼다 —
   **짙은 테두리 · 결이 보이는 나무 · 가운데 쇠 걸쇠.** 작게 그려도 그 셋이면 상자로 읽힌다.
     #  테두리   w  나무   d  나무의 짙은 결   l  걸쇠(쇠) */
const CHEST_MAP = [
  "##########",
  "#wwwwwwww#",
  "#wdwwwwdw#",
  "####ll####",
  "#wwwllwww#",
  "#wdwwwwdw#",
  "##########",
];
const CHEST_UNIT = 6;
const CHEST_COLOR: Record<string, string> = {
  "#": "#5a3a1c",
  w: "#a9743c",
  d: "#8c5c2c",
  l: "#b9bec4",
};

const WARDEN_UNIT = 9;
const WARDEN_MAP = [
  "   #####   ",
  "  #######  ",
  "  #ee#ee#  ",
  "  #######  ",
  "   #####   ",
  " ######### ",
  "###ccccc###",
  "###ccccc###",
  "###ccccc###",
  " ######### ",
  " ###   ### ",
  " ###   ### ",
  " ##     ## ",
];

function Warden({
  centerX,
  bottomY,
  onChestClick,
}: {
  centerX: number;
  bottomY: number;
  onChestClick: () => void;
}) {
  const width = WARDEN_MAP[0].length * WARDEN_UNIT;
  const height = WARDEN_MAP.length * WARDEN_UNIT;
  const originX = centerX - width / 2;
  const originY = bottomY - height;

  const body: { x: number; y: number }[] = [];
  const glow: { x: number; y: number }[] = [];
  const eyes: { x: number; y: number }[] = [];

  WARDEN_MAP.forEach((row, y) => {
    row.split("").forEach((cell, x) => {
      if (cell === "#") body.push({ x, y });
      else if (cell === "c") glow.push({ x, y });
      else if (cell === "e") eyes.push({ x, y });
    });
  });

  const place = (cell: { x: number; y: number }) => ({
    x: originX + cell.x * WARDEN_UNIT,
    y: originY + cell.y * WARDEN_UNIT,
    width: WARDEN_UNIT,
    height: WARDEN_UNIT,
  });

  return (
    /* 올라왔다 가라앉는 움직임은 이 그룹 하나에 건다 — 눈 깜빡임과 주기가 달라야
       기계적으로 보이지 않는다 */
    <g className={w98.wardenRise}>
      {body.map((cell, index) => (
        <rect key={`b${index}`} {...place(cell)} fill="#0b1a1d" />
      ))}

      {/* 가슴의 결 — 은은하게 맥동한다. 워든의 심장 소리에 해당하는 표현이다 */}
      <g className={w98.wardenPulse}>
        {glow.map((cell, index) => (
          <rect key={`c${index}`} {...place(cell)} fill="#2f9e94" />
        ))}
      </g>

      {/* 들고 있는 상자 — **배경에서 유일하게 클릭을 받는 것**이다.
          몸통 앞 가슴 높이에 놓아야 "들고 있다"로 읽힌다. 발치에 두면 그냥 떨어뜨린 물건이다.
          ⚠️ 워든과 함께 오르내려야 하므로 이 그룹 **안에** 둔다. 밖에 두면 워든만 움직이고
             상자는 제자리에 남아 둘이 따로 논다. */}
      <g
        style={{ pointerEvents: "auto", cursor: "pointer" }}
        onClick={onChestClick}
        role="button"
        tabIndex={-1}
      >
        {CHEST_MAP.flatMap((row, rowIndex) =>
          row.split("").map((cell, colIndex) => {
            const fill = CHEST_COLOR[cell];
            if (fill === undefined) return null;
            return (
              <rect
                key={`chest-${rowIndex}-${colIndex}`}
                x={centerX - (CHEST_MAP[0].length * CHEST_UNIT) / 2 + colIndex * CHEST_UNIT}
                y={originY + 5.4 * WARDEN_UNIT + rowIndex * CHEST_UNIT}
                width={CHEST_UNIT}
                height={CHEST_UNIT}
                fill={fill}
              />
            );
          }),
        )}
      </g>

      {/* 눈 — 깜빡인다. 빛무리를 한 겹 깔아 어둠 속에서 빛나는 것처럼 보이게 한다 */}
      <g className={w98.wardenBlink}>
        {eyes.map((cell, index) => {
          const rect = place(cell);
          return (
            <g key={`e${index}`}>
              <rect
                x={rect.x - 4}
                y={rect.y - 4}
                width={rect.width + 8}
                height={rect.height + 8}
                fill="#4fd0c9"
                opacity={0.22}
              />
              <rect {...rect} fill="#7ff5ec" />
            </g>
          );
        })}
      </g>
    </g>
  );
}

/** 좌표 → 고정된 의사난수. 같은 칸은 언제나 같은 무늬가 된다 */
function hash(x: number, y: number, salt: number): number {
  const n = (x * 73856093) ^ (y * 19349663) ^ (salt * 83492791);
  return Math.abs(n);
}
