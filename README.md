# 🐾 댕냥백과 — 반려동물 정보 사이트

구글 애드센스 수익화를 목표로 하는 정적 HTML 반려동물 정보 사이트입니다.

## 📁 구조

```
mungnyang/
├── index.html              # 홈 (카테고리 + 최신글 + 나이 변환기)
├── breeds.html             # 카테고리: 품종 백과
├── health.html             # 카테고리: 건강·증상
├── food.html               # 카테고리: 사료·용품
├── training.html           # 카테고리: 행동·훈련
├── life.html               # 카테고리: 생활 정보
├── posts/
│   ├── beginner-dog-breeds.html    # 글: 초보자 강아지 품종 TOP 10
│   ├── dog-diarrhea.html           # 글: 강아지 설사 대처법
│   ├── dog-food-calculator.html    # 글: 사료 급여량 (+계산기)
│   ├── dog-potty-training.html     # 글: 배변훈련 5단계
│   └── _template.html              # 새 글 작성용 템플릿
├── about.html              # 소개 (애드센스 필수)
├── privacy.html            # 개인정보처리방침 (애드센스 필수)
├── contact.html            # 문의하기 (애드센스 필수)
├── disclaimer.html         # 이용약관·면책 (애드센스 필수)
├── css/style.css           # 공통 스타일
├── js/main.js              # 내비게이션 스크립트
├── robots.txt
├── sitemap.xml
└── content-plan 은 상위 폴더(D:\AI\content-plan.md) 참고
```

## 🔍 미리보기

폴더에서 `index.html`을 더블클릭하거나, 로컬 서버 실행:

```
cd D:\AI\mungnyang
python -m http.server 8000
# 브라우저에서 http://localhost:8000
```

## 🚀 배포 (무료)

### 방법 1: Netlify (가장 쉬움, 추천)
1. https://app.netlify.com 가입
2. "Add new site → Deploy manually"에 `mungnyang` 폴더를 드래그&드롭
3. 즉시 `xxx.netlify.app` 주소로 배포됨
4. (선택) 도메인 구입 후 연결 — **애드센스 승인에는 자체 도메인 강력 권장**

### 방법 2: GitHub Pages
1. GitHub 저장소 생성 → 파일 업로드
2. Settings → Pages → Branch: main 선택
3. `username.github.io/저장소명` 으로 배포됨

## ✏️ 배포 전 교체할 것 (placeholder)

| 위치 | 교체 내용 |
|---|---|
| `contact.html`, `privacy.html` | `[여기에 이메일 주소를 입력하세요]` → 실제 이메일 |
| `sitemap.xml`, `robots.txt` | `https://www.example.com` → 실제 도메인 |
| 모든 페이지 `<head>` | 애드센스 스크립트 주석 (승인 후 해제) |

## 💰 애드센스 신청 순서

1. **콘텐츠 확충** — 현재 4개 글 → content-plan.md의 1차 목록(15개)까지 채우기.
   글 개수가 애드센스 승인의 최대 변수입니다.
2. **자체 도메인 연결** — `.com`, `.co.kr` 등 (연 1~2만 원). 무료 서브도메인은 승인이 어렵습니다.
3. **구글 서치콘솔 등록** — sitemap.xml 제출, 색인 요청.
4. **2~4주 운영 후 신청** — https://adsense.google.com 에서 사이트 등록,
   안내에 따라 `<head>`에 인증 코드 삽입.
5. **승인 후**:
   - 각 페이지 `<head>`의 애드센스 스크립트 주석 해제 + 게시자 ID 교체
   - 글 본문의 `<div class="ad-slot">...</div>` 를 실제 광고 코드로 교체
     (또는 그대로 두고 "자동 광고"만 켜도 됨 — 초보자 추천)
   - 사이트 루트에 `ads.txt` 파일 추가 (애드센스에서 안내해 줌)

## 📝 새 글 추가하는 법

1. `posts/_template.html` 복사 → `posts/새글이름.html` (영문 소문자+하이픈)
2. `[대괄호]` 표시된 부분을 채우기 (제목, 메타설명, 날짜, 본문)
3. 해당 카테고리 페이지와 `index.html` 최신 글 목록에 카드 추가
4. `sitemap.xml`에 URL 추가
5. `js/search-data.js`에 검색 인덱스 항목 추가 (제목·설명·카테고리·경로·키워드)

## 📈 이후 성장 로드맵

- 1차 15개 글 발행 → 애드센스 신청
- 승인 후 2차 15개 글 (고단가: 펫보험, 중성화 비용, 신부전)
- 서치콘솔에서 노출 키워드 확인 → 잘 되는 주제 위주로 확장
- 사료 급여량 계산기 같은 도구를 고양이 버전으로도 확장
