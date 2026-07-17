// 품종별 관련 글 매핑 — 품종 카드를 누르면 이 목록이 표시됩니다.
// 개별 품종 심화 글을 발행하면 해당 품종 배열 맨 앞에 추가하세요.
(function () {
  // 재사용 글 정의
  var patella = { t: "강아지 슬개골 탈구, 증상과 단계별 대처", d: "소형견이 특히 취약한 무릎 질환 — 단계별 대처와 예방법.", e: "🦴", m: "건강·증상", u: "posts/dog-patella-luxation" };
  var anxiety = { t: "강아지 분리불안 증상과 완화 방법", d: "애착이 강한 품종에 흔한 분리불안 — 자가진단과 둔감화 훈련.", e: "🏠", m: "행동·훈련", u: "posts/dog-separation-anxiety" };
  var potty = { t: "강아지 배변훈련 실패 없이 하는 법 (5단계)", d: "칭찬 기반 5단계 배변훈련.", e: "🚽", m: "행동·훈련", u: "posts/dog-potty-training" };
  var walk = { t: "강아지 산책 언제부터, 얼마나 시킬까", d: "크기별 산책량과 여름·겨울 주의사항.", e: "🚶", m: "생활 정보", u: "posts/dog-walking-guide" };
  var foodCalc = { t: "강아지 사료 급여량 계산하는 법 (+계산기)", d: "체중·나이·중성화 여부로 하루 급여량 계산.", e: "🧮", m: "사료·용품", u: "posts/dog-food-calculator" };
  var heat = { t: "강아지 여름철 더위·열사병 관리법", d: "코가 짧은 단두종이 특히 취약 — 응급 신호와 처치.", e: "☀️", m: "건강·증상", u: "posts/dog-summer-heatstroke" };
  var kitten = { t: "새끼 고양이 키우기 첫 주 체크리스트", d: "준비물, 첫날 적응, 나이별 먹이기, 첫 병원 방문.", e: "🍼", m: "생활 정보", u: "posts/kitten-first-week" };
  var catVac = { t: "고양이 예방접종, 언제 무엇을 맞출까", d: "종합백신(FVRCP) 일정표와 실내묘 접종의 필요성.", e: "🩺", m: "생활 정보", u: "posts/cat-vaccination" };
  var catFood = { t: "고양이 사료 고르는 기준 5가지", d: "비만·비뇨기 관리에 중요한 사료 선택 기준.", e: "🐟", m: "사료·용품", u: "posts/cat-food-guide" };
  var kidney = { t: "고양이 신부전 초기 증상 알아보기", d: "노령묘 최다 질환 — 초기 신호와 조기 발견법.", e: "💧", m: "건강·증상", u: "posts/cat-kidney-disease" };

  // 개별 품종 심화 글
  var maltese = { t: "말티즈 키우기 완벽 가이드", d: "성격·수명·주의할 질병·관리법을 한 번에.", e: "🐶", m: "품종 심화", u: "posts/breed-maltese" };
  var poodle = { t: "토이푸들 키우기 완벽 가이드", d: "지능·훈련·미용·질병까지 완벽 정리.", e: "🐩", m: "품종 심화", u: "posts/breed-poodle" };
  var pom = { t: "포메라니안 키우기 완벽 가이드", d: "기관허탈·슬개골·털 관리 등 필수 정보.", e: "🦊", m: "품종 심화", u: "posts/breed-pomeranian" };
  var korat = { t: "코리안 숏헤어(코숏) 키우기 완벽 가이드", d: "성격·수명·건강 관리와 입양 방법.", e: "🐱", m: "품종 심화", u: "posts/breed-korat" };
  var russian = { t: "러시안블루 키우기 완벽 가이드", d: "조용한 성격, 건강, 알레르기 특성까지.", e: "🩵", m: "품종 심화", u: "posts/breed-russian-blue" };
  var scottish = { t: "스코티시폴드 키우기 완벽 가이드", d: "접힌 귀의 진실 — 입양 전 꼭 알아야 할 것.", e: "🐈", m: "품종 심화", u: "posts/breed-scottish-fold" };
  var shihtzu = { t: "시츄 키우기 완벽 가이드", d: "느긋하고 짖음 적은 성격, 단두종 관리까지.", e: "🐶", m: "품종 심화", u: "posts/breed-shihtzu" };
  var bichon = { t: "비숑 프리제 키우기 완벽 가이드", d: "사교적인 솜뭉치 — 성격·질병·미용 관리.", e: "🐩", m: "품종 심화", u: "posts/breed-bichon" };
  var golden = { t: "골든리트리버 키우기 완벽 가이드", d: "온순한 대형견 — 성격·질병·산책 관리.", e: "🦮", m: "품종 심화", u: "posts/breed-golden" };
  var persian = { t: "페르시안 고양이 키우기 완벽 가이드", d: "우아한 장모 — 성격·유전병·털 관리.", e: "🐱", m: "품종 심화", u: "posts/breed-persian" };
  var british = { t: "브리티시 숏헤어 키우기 완벽 가이드", d: "독립적이고 느긋 — 1인 가구 추천 품종.", e: "🐱", m: "품종 심화", u: "posts/breed-british" };
  var ragdoll = { t: "랙돌 키우기 완벽 가이드", d: "안기는 순둥이 대형묘 — 성격·질병·털 관리.", e: "🐈", m: "품종 심화", u: "posts/breed-ragdoll" };
  var cavalier = { t: "카바리에 킹 찰스 스패니얼 키우기 완벽 가이드", d: "온화함의 대명사 — 성격·수명·심장병 관리.", e: "🐶", m: "품종 심화", u: "posts/breed-cavalier" };
  var papillon = { t: "파피용 키우기 완벽 가이드", d: "작지만 지능 최상위 — 성격·훈련·질병 관리.", e: "🦋", m: "품종 심화", u: "posts/breed-papillon" };
  var schnauzer = { t: "미니어처 슈나우저 키우기 완벽 가이드", d: "수염 신사 — 성격·저지방 식이·췌장염 주의.", e: "🐶", m: "품종 심화", u: "posts/breed-schnauzer" };
  var labrador = { t: "래브라도 리트리버 키우기 완벽 가이드", d: "온순한 대형견 — 운동·식탐·고관절 관리.", e: "🦮", m: "품종 심화", u: "posts/breed-labrador" };
  var american = { t: "아메리칸 숏헤어 키우기 완벽 가이드", d: "튼튼하고 활발 — 심장병·비만 관리 포인트.", e: "🐱", m: "품종 심화", u: "posts/breed-american" };
  var munchkin = { t: "먼치킨 고양이 키우기 완벽 가이드", d: "짧은 다리의 진실 — 관절·환경 관리.", e: "🐈", m: "품종 심화", u: "posts/breed-munchkin" };

  window.BREED_DATA = {
    // 강아지
    "b-maltese":   { name: "말티즈", articles: [maltese, patella, anxiety] },
    "b-poodle":    { name: "토이푸들", articles: [poodle, patella, potty] },
    "b-bichon":    { name: "비숑 프리제", articles: [bichon, patella, anxiety] },
    "b-shihtzu":   { name: "시츄", articles: [shihtzu, heat] },
    "b-cavalier":  { name: "카바리에 킹 찰스 스패니얼", articles: [cavalier, anxiety] },
    "b-papillon":  { name: "파피용", articles: [papillon, patella, potty] },
    "b-pom":       { name: "포메라니안", articles: [pom, patella] },
    "b-schnauzer": { name: "미니어처 슈나우저", articles: [schnauzer, foodCalc] },
    "b-golden":    { name: "골든리트리버", articles: [golden, walk, foodCalc] },
    "b-lab":       { name: "래브라도 리트리버", articles: [labrador, walk, foodCalc] },
    // 고양이
    "c-korat":     { name: "코리안 숏헤어", articles: [korat, kitten, catVac] },
    "c-russian":   { name: "러시안블루", articles: [russian, catFood] },
    "c-british":   { name: "브리티시 숏헤어", articles: [british, catFood] },
    "c-american":  { name: "아메리칸 숏헤어", articles: [american, catFood] },
    "c-ragdoll":   { name: "랙돌", articles: [ragdoll, kitten] },
    "c-munchkin":  { name: "먼치킨", articles: [munchkin, kitten] },
    "c-scottish":  { name: "스코티시폴드", articles: [scottish, kidney] },
    "c-persian":   { name: "페르시안", articles: [persian, kidney] }
  };
})();
