# PoliStrat v28 Split Project

이 프로젝트는 기존 단일 HTML 파일을 GitHub 업로드용 폴더 구조로 분리한 국제정치 시뮬레이션 버전입니다.

## 실행 방법

1. 이 폴더를 VS Code로 엽니다.
2. `index.html`을 엽니다.
3. Live Server로 실행합니다.
4. 기존처럼 Firebase 설정을 저장하고 사용합니다.

## 현재 구조

```text
index.html
css/
  style.css
js/
  main.js
  state.js
  utils.js
  resume.js
  firebase.js
  data.js
  map.js
  teacher.js
  student.js
```

현재 실행 코드는 기능별 JS 모듈로 분리되어 있고, `main.js`는 앱 시작과 이벤트 연결만 담당합니다.

## 다음 리팩토링 추천 순서

1. 브라우저에서 교사 세션 생성 확인
2. 학생 모둠 참가 확인
3. 참여 모둠 확정 후 지도 재배치 확인
4. 외교/행동 페이즈 제출 확인
5. 세션 초기화 확인


## v30 stable split

v29에서 일부 환경에서 버튼 이벤트가 작동하지 않는 문제가 있어, v30에서는 안정성을 우선해 실행 코드를 `main.js`에 유지했습니다.

- 실행 파일: `index.html`
- 실제 기능 코드: `js/main.js`
- CSS: `css/style.css`
- 나머지 JS 파일은 다음 리팩토링을 위한 자리입니다.

실행 확인 후 다음 단계에서 `data.js`부터 천천히 분리하세요.


## v31 reset + duplicate protection

추가 기능:
- 교사용 대시보드 세션 초기화 버튼
- teams / tiles / logs / meta/typeUsage 초기화
- 같은 세션 내 동일 모둠명 중복 입장 방지


## v36 teacher entry fixed

v35에서 teacher.js 분리 중 교사 시작 버튼이 작동하지 않는 문제가 있어 안정판으로 복구했습니다.

포함:
- 세션 초기화 + 중복 모둠명 방지
- 대시보드 스크롤/줄바꿈 CSS
- 모둠 카드 클릭 시 상세 현황 변경
- 선택된 모둠 카드 강조 표시

## v37 module split

기존 `main.js` 집중 구조를 기능별 모듈로 분리했습니다.

- `main.js`: 앱 초기화, 설정 저장, 복구 버튼 연결
- `state.js`: 공유 런타임 상태
- `utils.js`: DOM/표시/계산 유틸
- `resume.js`: 이전 세션 복구 정보
- `data.js`: 페이즈, 국가 유형, 지도 레이아웃
- `firebase.js`: Firebase 초기화와 Firestore helper
- `map.js`: 지도 렌더링, 타일 선택, 팀 이름 매핑
- `teacher.js`: 교사용 대시보드와 교사 이벤트
- `student.js`: 학생 화면, 국가 유형 모달, 행동 제출

주의:
- ES module 구조라 `index.html`을 파일로 직접 열기보다 Live Server 같은 로컬 서버로 실행하세요.
