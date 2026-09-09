# Stage 0 / S0.2~S0.4 프론트 정리 — 에이전트 핸드오프 브리프

**작성일**: 2026-09-09
**담당**: 별도 에이전트 (독립 세션, Sonnet 또는 Opus)
**목적**: 발표용 잔재(비-win98 원본 화면, 이스터에그, 데모 훅, 3D 로봇 시뮬)를 걷어내고, win98 화면 4개가 실 API만으로 도는 상태를 만든다. 3D 창고·분석 화면의 정적 데이터는 이 단계에서 **유지**한다 (Stage 2에서 교체).

설계는 이 문서에 확정돼 있다. 에이전트는 **설계를 바꾸지 않고 실행**한다. 문서에 없는 결정이 필요하면 AskUserQuestion으로 묻는다.

## 0. 산출물 보관 위치

- 핸드오프 브리프: `docs/tasks/2026-09-09-stage0-frontend-cleanup-handoff.md` (이 파일)
- 중간 노트: `docs/tasks/2026-09-09-stage0-frontend-cleanup-notes.md`
- 최종 산출물: 브랜치 `chore/stage0-cleanup`, 소단계(S0.2 / S0.3 / S0.4)마다 커밋. push까지. PR은 만들지 않는다

## 1. 입력 (읽어야 할 것)

| 순서 | 경로 | 용도 |
| --- | --- | --- |
| 1 | `../backend/docs/00-planning/05-frontend-baseline.md` | 화면별 처리 방침 — 이 작업의 근거 |
| 2 | `../backend/docs/03-execution/01-stages.md` § Stage 0 | 확인 항목 |
| 3 | `README.md`, `AGENTS.md`, `CLAUDE.md` (frontend) | 저장소 규칙 (win98 화면은 `_components`를 공유하지 않는다 등) |
| 4 | `lib/nav.ts`, `lib/endpoints.ts`, `lib/types.ts`, `lib/api.ts`, `proxy.ts`, `app/api/v1/[...path]/route.ts` | nav·API·헤더 |
| 5 | `app/{inbound,packing,dashboard}/**` | 삭제 대상 (비-win98 원본) |
| 6 | `app/{inbound-win98,packing-win98,analytics-win98,warehouse-win98}/_components/shell.tsx` | 이스터에그·리셋 버튼 위치 |
| 7 | `app/{inbound-win98,packing-win98,analytics-win98}/_components/truck-dock.tsx` | BGM·팀 덱 링크 |
| 8 | `app/packing-win98/_components/{box-3d-viewer.tsx,piglin.js}` | 피글린 제거 |
| 9 | `app/warehouse-win98/_components/{warehouse-slot-3d.jsx,inbound-sim.js,nether-portal.js,sim-audio.js,product-models.js,inspection-room.jsx,packing-station.js,warehouse-exterior.js}` | 3D 시뮬 분리 |
| 10 | `app/inbound-win98/_data/use-inbound.ts`, `app/packing-win98/_data/{use-release-orders,use-next-tote}.ts` | 데모 훅 |
| 11 | `public/{audio,team5,models}` | 자산 정리 |
| 12 | `~/.claude/rules/*.md` | 코딩·UI·커밋 규칙 (전역) |

## 2. 확정된 설계

### S0.2 — 화면·이스터에그 정리

**삭제**

| 대상 | 비고 |
| --- | --- |
| `app/inbound/`, `app/packing/`, `app/dashboard/` 전체 | win98 화면이 완성본. `_mock`·`_data` 포함 |
| `components/common/minesweeper.tsx` | 셸 4곳(`inbound-win98`, `packing-win98`, `analytics-win98`, `warehouse-win98`)의 import·JSX 제거 |
| `app/packing-win98/_components/piglin.js` | `box-3d-viewer.tsx`의 `createPiglin` import와 hauler 관련 코드 경로(생성·애니메이션·정리) 제거. 박스 3D 뷰어 자체는 유지 |
| `app/warehouse-win98/_components/nether-portal.js`, `sim-audio.js` | |
| `public/audio/`, `public/team5/` | BGM, 팀 덱 |
| `app/api/demo/reset/route.ts` | 디렉토리 `app/api/demo/`까지 |
| `components/palette-dev-panel.tsx`, `components/fixed-stage.tsx` | 사용처가 삭제 대상에만 있으면 함께 삭제. 다른 곳에서 쓰면 유지하고 보고 |

**truck-dock.tsx (3벌)**: BGM 재생(`BGM_SRC`, `new Audio`), `TEAM_URL` 프리로드·이동 코드를 제거한다. 트럭 도크 시각 요소는 유지. 상자 클릭의 후속 동작이 이스터에그뿐이라면 클릭 핸들러를 제거하고 정적 장식으로 둔다.

**nav (`lib/nav.ts`)** — 4항목, 경로는 유지하고 라벨만 정리:

| href | label | description |
| --- | --- | --- |
| `/inbound-win98` | 입고 | ASN 검수 → 측정 → 수량 입고 |
| `/packing-win98` | 출고 포장 | 토트 스캔 → 박스 추천 → 포장 완료 |
| `/analytics-win98` | 분석 | 창고 지도 · 입출고 흐름 · 규격별 재고 |
| `/warehouse-win98` | 창고 | 슬롯 점유 3D |

`owner` 필드는 제거. 경로에서 `-win98` 접미를 떼는 것은 Stage 1에서 별도 결정 (지금 하지 않는다).

`app/page.tsx`는 NAV를 그대로 렌더하므로 수정 불필요 — 확인만.

### S0.3 — 데모 훅 제거, API 키 헤더

**삭제**: `lib/endpoints.ts`의 `demo` 객체, `lib/types.ts`의 `DemoNextBarcode`·`DemoStatus`·`DemoNextTote`·`DemoResetSummary`·`DemoReleasedOrders`, `app/packing-win98/_data/use-release-orders.ts`, `app/packing-win98/_data/use-next-tote.ts`, `use-inbound.ts`의 `nextBarcode`·`status` mutation.

**버튼 처리** — 삭제하지 않고 비활성. 후계 기능이 들어올 자리라서.

| 화면 | 버튼 | 처리 |
| --- | --- | --- |
| 입고 | 다음 바코드 (`nextBarcode`) | `disabled`, title "Stage 3: ASN 미검수 품목으로 대체" |
| 입고 | 리셋 | 제거 |
| 출고 | 주문 투입 (`releaseOrders`) | `disabled`, title "Stage 6: 웨이브 생성으로 대체" |
| 출고 | 다음 토트 (`nextTote`) | `disabled`, title "Stage 8: 리빈 완성 큐로 대체" |
| 출고 | 리셋 | 제거 |

입고 화면은 바코드 **수동 입력**으로 스캔이 가능해야 한다 — 이미 있는 입력 경로를 확인하고, 없으면 바코드 입력 필드를 노출한다 (AskUserQuestion으로 위치 확인).

**API 키 헤더** — 백엔드 브리프(`../backend/docs/tasks/2026-09-09-stage0-backend-demo-removal-handoff.md` §2.4)와 같은 계약:

| 항목 | 현재 | 변경 |
| --- | --- | --- |
| 헤더 | `X-Demo-Key` | `X-Api-Key` |
| 서버측 환경변수 | `DEMO_API_KEY` | `API_KEY` |

`lib/api.ts`, `proxy.ts`, `app/api/v1/[...path]/route.ts`, `.env.example`, README, Vercel 설정 문구. 헤더를 붙이는 위치가 서버 사이드(프록시)인지 확인하고 그대로 유지.

### S0.4 — 3D 시뮬 분리 (결정 ② 보류 반영)

**삭제**: `inbound-sim.js`(로봇·크레인), `nether-portal.js`, `sim-audio.js`, `product-models.js`(사용처가 `inbound-sim`뿐일 때 — 다른 곳에서 쓰면 유지하고 보고).

**보류(유지)**: `inspection-room.jsx`, `packing-station.js`, `warehouse-exterior.js` — 파일과 연결 그대로 둔다. Stage 2에서 재활용 여부 결정.

`warehouse-slot-3d.jsx`에서 삭제 모듈의 import·호출·`skip` 예약 로직(`applyDay`의 `skip?.includes(i)`)을 제거한다. 정적 배열(`REAL_*`)과 `applyDay`는 유지.

**등급 규칙 보존**: `inbound-sim.js`의 `GRADE_CAPS`와 `gradeForMm` 본문을 삭제 전에 `../backend/docs/02-system/putaway-grade-rule.md`로 옮긴다 (코드 블록 + "3D 시뮬에서 이식, Stage 4 putaway 치수 필터의 기준" 한 줄).

**`public/models/`(38M)**: 각 모델 파일의 참조처를 grep. `box-3d-viewer.tsx`·`packing-win98/page.tsx`가 쓰는 것만 남기고, 삭제된 시뮬만 쓰던 모델은 삭제. 참조처 불명확한 파일은 목록으로 보고하고 유지.

## 3. 에이전트가 할 일

Step 1. §1 입력 읽기. `grep -rn "demo\.\|Demo\|minesweeper\|piglin\|nether\|sim-audio\|inbound-sim\|team5\|bgm\|BGM" app lib components public --include='*.ts' --include='*.tsx' --include='*.js' --include='*.jsx'` 결과를 노트에 기록.
Step 2. S0.2 → 커밋. `npm run build && npm run lint` 통과 후.
Step 3. S0.3 → 커밋. 같은 검증.
Step 4. S0.4 → 커밋. 같은 검증. 등급 규칙 문서는 backend 저장소에 별도 커밋 (`docs(system): putaway 등급 규칙 — 3D 시뮬에서 이식`).
Step 5. 최종: 위 grep 0건(보류 파일 내부 제외), `npm run build` 통과, 개발 서버 기동 후 4화면 렌더 확인 스크린샷. 결과 보고.

설계에 없는 결정(바코드 수동 입력 위치, 참조처 불명 모델 파일, truck-dock 클릭 처리 등)은 AskUserQuestion — 3개씩 묶어서.

## 4. 규칙/제약

- 설계(§2) 변경 금지. 이견은 보고서에 적고 설계대로 진행
- win98 화면의 `_components`는 화면별로 독립 — 공용화하지 않는다 (저장소 규칙)
- 3D 창고·분석의 정적 배열·`applyDay` 유지. Stage 2 대상
- `~/.claude/rules/ui-ux-standards.md` 준수 (inline style·하드코딩 색 금지 등). 기존 코드의 위반은 이번에 고치지 않는다
- 브랜치 `chore/stage0-cleanup`. 커밋 메시지 `~/.claude/rules/git-workflow.md` 형식, 한국어
- 백엔드 저장소는 등급 규칙 문서 1파일 외 건드리지 않는다

## 5. 결과 보고 포맷

```
## S0.2~S0.4 프론트 정리 완료
### 산출물
- 브랜치: chore/stage0-cleanup (커밋 3개)
- 삭제: 파일 N개, public 자산 N MB
- 변경: (파일별 한 줄)
- backend: docs/02-system/putaway-grade-rule.md
### 검증
- npm run build / lint: 통과
- grep 잔재: 0건 (보류 파일 제외)
- 4화면 렌더: 스크린샷 경로
### 이견 / 설계와 다르게 한 것
...
### 사용자 질의응답 기록
...
### 다음 액션 (사용자)
- 백엔드 S0.1 브랜치와 함께 기동해 화면 체크 — 입고(바코드 수동 입력 → 측정 → 수량입고), 포장(토트 스캔 → 박스 추천 → 완료), 분석·창고(정적 데이터로 렌더, 로봇·포탈·소리 없음)
```
