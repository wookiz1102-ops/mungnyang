// 추천 상품 목록
// ▼ 새 상품은 이 배열 "맨 위"에 추가하세요 (최신순으로 표시됩니다).
//   img       : 쿠팡 상품 이미지 URL (선택)
//   name      : 상품명
//   desc      : 한 줄 설명 (선택)
//   listPrice : 정가 (선택, 예: "190,000원")
//   salePrice : 할인가 (선택, 예: "48,900원") — 있어야 가격 블록이 표시됨
//   discount  : 할인율 (선택, 예: "74%")
//   rating    : 평점 (선택, 숫자 0~5, 예: 4.8) — 쿠팡 상품 페이지 기준, 작성 시점
//   reviews   : 리뷰 수 (선택, 숫자, 예: 532)
//   url       : 쿠팡 파트너스 링크
//   tag       : 카테고리 배지 — 아래 6개 중 하나로 통일 (필터 버튼과 연동)
//               "급식·물" / "배변·위생" / "건강·안전" / "훈련·놀이" / "미용·목욕" / "하우스·외출"
//   date      : 등록일 (선택)
window.PRODUCTS = [
  {
    img: "https://thumbnail.coupangcdn.com/thumbnails/remote/492x492ex/image/vendor_inventory/a2ba/8fcb9d945281707f33e4ad454017ed33de56a75079d90087034527c4b27c.jpg",
    name: "이리로 강아지 슬개골 예방 미끄럼방지 방수 접이식 타일 매트",
    desc: "미끄러운 바닥은 슬개골 탈구의 주범. 방수·접이식 타일 매트로 무릎 부담을 덜어주는 소형견 필수템.",
    listPrice: "232,000원",
    salePrice: "150,400원",
    discount: "35%",
    reviews: 532,
    url: "https://link.coupang.com/a/fi0t205Cvc",
    tag: "건강·안전",
    date: "2026.07.12"
  },
  {
    img: "https://thumbnail.coupangcdn.com/thumbnails/remote/492x492ex/image/vendor_inventory/ad3a/c5012c0cbd9c346ddb655e1e805435d3c7641df8c81a1efaf63c65c2e4c6.png",
    name: "캣앤코 고양이 오픈형 자동화장실 스마트 프리미엄",
    desc: "UV 살균·자동처리 프리미엄 고양이 자동화장실. 화장실 청소 부담을 크게 덜어주는 저소음 오픈형.",
    listPrice: "500,000원",
    salePrice: "249,900원",
    discount: "50%",
    url: "https://link.coupang.com/a/fq7ujG55ZQ",
    tag: "배변·위생",
    date: "2026.07.12"
  },
  {
    img: "https://thumbnail.coupangcdn.com/thumbnails/remote/492x492ex/image/vendor_inventory/9fe9/5c7573d157e754f38f454b1d0aa7b5d37a8a9f265c118d65c09a7368977a.jpg",
    name: "웁쉬 스며들개 고흡수 강아지 배변패드 두툼형 (소형 50매)",
    desc: "고흡수 두툼형에 피톤치드향까지. 배변훈련의 필수 소모품, 1매당 부담 없는 대용량.",
    listPrice: "20,900원",
    salePrice: "13,700원",
    discount: "34%",
    url: "https://link.coupang.com/a/fiZzBxm0lw",
    tag: "배변·위생",
    date: "2026.07.12"
  },
  {
    img: "https://thumbnail.coupangcdn.com/thumbnails/remote/492x492ex/image/retail/images/2025/07/23/12/9/392afbc4-d625-4394-92a7-c61908565650.jpg",
    name: "디클펫 반려동물 자동급식기 AT-210",
    desc: "정해진 시간·양으로 자동 급여. 규칙적인 식사 관리와 공복 구토 예방에 좋은 4L 대용량 급식기.",
    listPrice: "251,000원",
    salePrice: "52,700원",
    discount: "79%",
    url: "https://link.coupang.com/a/fiZiJZd2mi",
    tag: "급식·물",
    date: "2026.07.12"
  },
  {
    img: "https://thumbnail.coupangcdn.com/thumbnails/remote/492x492ex/image/vendor_inventory/image_audit/stage/manual/ed55581be20858ea2cf996a7ef2cad6a0545a4c0c5c76c99e035c7ddd2e6_1751442474115.png",
    name: "펫그래비티 무선 무필터 물비움 정수기 3L",
    desc: "무선·무필터 순환식, 3L 대용량 스테인리스. 음수량을 늘려 비뇨기·신장 건강 관리에 좋아요.",
    listPrice: "190,000원",
    salePrice: "48,900원",
    discount: "74%",
    url: "https://link.coupang.com/a/fiXomXbxeK",
    tag: "급식·물",
    date: "2026.07.12"
  }
];
