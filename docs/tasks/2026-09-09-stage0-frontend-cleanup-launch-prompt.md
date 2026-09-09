# S0.2~S0.4 프론트 정리 에이전트 — 런치 프롬프트

## 터미널 준비

```bash
cd ~/d/fulfillment-wms/frontend
git checkout main && git pull && git checkout -b chore/stage0-cleanup
claude --model sonnet
```

(Opus로 돌리려면 `--model opus`)

## 첫 프롬프트 (복붙)

```
너는 Stage 0 / S0.2~S0.4 "프론트 정리"를 독립적으로 수행하는 에이전트다.
핸드오프 브리프를 먼저 읽고 그 안의 확정 설계(§2)를 그대로 실행한다. 설계를 바꾸지 않는다.

필독:
1. /Users/idong-u/d/fulfillment-wms/frontend/docs/tasks/2026-09-09-stage0-frontend-cleanup-handoff.md
2. 브리프 §1 입력 표의 파일 전부 (백엔드 문서 2개 포함)

규칙:
- 설계에 없는 결정은 AskUserQuestion으로 3개씩 묶어 확인. 임의 결정 금지.
- 브랜치 chore/stage0-cleanup, S0.2 / S0.3 / S0.4 단위로 커밋, push.
- 3D 창고·분석의 정적 데이터는 유지. 보류 파일(inspection-room, packing-station, warehouse-exterior) 유지.
- 백엔드 저장소는 docs/02-system/putaway-grade-rule.md 1파일만 추가.
- ~/.claude/rules/*.md 준수. 한글 응답, 코드·주석 영어.
- 완료 시 브리프 §5 포맷으로 보고.

브리프 §3 Step 1~5 순서대로 진행. 시작.
```

## 메인 세션과의 동기화

- 백엔드 에이전트(`backend/docs/tasks/2026-09-09-stage0-backend-demo-removal-*`)와 병렬 실행 가능
- 둘 다 완료 보고를 메인 세션에 붙여 넣으면 Stage 0 화면 체크로 넘어간다
