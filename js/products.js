// 추천 상품 렌더링 + 카테고리 필터 + 페이지네이션 (10개씩, 최신순)
document.addEventListener("DOMContentLoaded", function () {
  var grid = document.getElementById("product-grid");
  var pager = document.getElementById("product-pager");
  var empty = document.getElementById("product-empty");
  var filterBar = document.getElementById("product-filters");
  if (!grid || !pager || !window.PRODUCTS) return;

  var PER_PAGE = 10;
  var ALL = window.PRODUCTS;
  // 배지(카테고리) 표시 순서 — 상품이 있는 카테고리만 필터 버튼으로 노출됩니다.
  var CATEGORY_ORDER = ["급식·물", "배변·위생", "건강·안전", "훈련·놀이", "미용·목욕", "하우스·외출"];

  var currentFilter = "";   // "" = 전체
  var current = 1;
  var items = ALL;
  var totalPages = 1;

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  function computeItems() {
    items = currentFilter ? ALL.filter(function (p) { return p.tag === currentFilter; }) : ALL;
    totalPages = Math.max(1, Math.ceil(items.length / PER_PAGE));
    if (current > totalPages) current = 1;
  }

  function cardHTML(p) {
    var thumb = p.img
      ? '<a class="product-thumb" href="' + esc(p.url) + '" rel="nofollow sponsored noopener" target="_blank">' +
        '<img src="' + esc(p.img) + '" alt="' + esc(p.name) + '" loading="lazy"></a>'
      : "";
    var rating = "";
    var r = Number(p.rating);
    var rv = Number(p.reviews);
    if (r > 0) {
      rating = '<div class="product-rating"><span class="rating-star">★</span> ' + r.toFixed(1) +
        (rv > 0 ? ' <span class="rating-count">· 리뷰 ' + rv.toLocaleString("ko-KR") + "</span>" : "") +
        "</div>";
    } else if (rv > 0) {
      rating = '<div class="product-rating"><span class="rating-count">리뷰 ' + rv.toLocaleString("ko-KR") + "개</span></div>";
    }
    var price = "";
    if (p.salePrice) {
      price = '<div class="product-price">' +
        (p.discount ? '<span class="price-off">' + esc(p.discount) + "</span>" : "") +
        (p.listPrice ? '<span class="price-list">' + esc(p.listPrice) + "</span>" : "") +
        '<span class="price-sale">' + esc(p.salePrice) + "</span>" +
        "</div>";
    }
    return '<div class="card product-card">' +
      thumb +
      (p.tag ? '<span class="product-tag">' + esc(p.tag) + "</span>" : "") +
      "<h3>" + esc(p.name) + "</h3>" +
      (p.desc ? "<p>" + esc(p.desc) + "</p>" : "") +
      rating +
      price +
      (p.date ? '<span class="card-meta">' + esc(p.date) + "</span>" : "") +
      '<a class="buy-btn" href="' + esc(p.url) + '" rel="nofollow sponsored noopener" target="_blank">쿠팡에서 보기</a>' +
      "</div>";
  }

  function renderFilters() {
    if (!filterBar) return;
    var present = CATEGORY_ORDER.filter(function (cat) {
      return ALL.some(function (p) { return p.tag === cat; });
    });
    if (present.length < 1) { filterBar.innerHTML = ""; return; } // 태그가 없으면 필터바 숨김
    var html = '<button class="filter-btn' + (currentFilter === "" ? " active" : "") + '" data-filter="">전체</button>';
    present.forEach(function (cat) {
      html += '<button class="filter-btn' + (currentFilter === cat ? " active" : "") + '" data-filter="' + esc(cat) + '">' + esc(cat) + "</button>";
    });
    filterBar.innerHTML = html;
  }

  function renderPager() {
    if (totalPages <= 1) { pager.innerHTML = ""; return; }
    var html = '<button class="page-btn" data-page="prev"' + (current === 1 ? " disabled" : "") + ">이전</button>";
    for (var i = 1; i <= totalPages; i++) {
      html += '<button class="page-btn' + (i === current ? " active" : "") + '" data-page="' + i + '">' + i + "</button>";
    }
    html += '<button class="page-btn" data-page="next"' + (current === totalPages ? " disabled" : "") + ">다음</button>";
    pager.innerHTML = html;
  }

  function render(scroll) {
    if (!items.length) {
      grid.innerHTML = "";
      pager.innerHTML = "";
      if (empty) {
        empty.hidden = false;
        empty.innerHTML = ALL.length
          ? "<p>이 카테고리에는 아직 등록된 상품이 없어요. 🐾</p>"
          : "<p>🐾 아직 등록된 추천 상품이 없습니다.<br>곧 유용한 반려용품을 하나씩 채워나갈 예정이에요!</p>";
      }
      return;
    }
    if (empty) empty.hidden = true;
    var start = (current - 1) * PER_PAGE;
    grid.innerHTML = items.slice(start, start + PER_PAGE).map(cardHTML).join("");
    renderPager();
    if (scroll) window.scrollTo({ top: grid.offsetTop - 90, behavior: "smooth" });
  }

  if (filterBar) {
    filterBar.addEventListener("click", function (e) {
      var btn = e.target.closest(".filter-btn");
      if (!btn) return;
      currentFilter = btn.getAttribute("data-filter");
      current = 1;
      computeItems();
      renderFilters();
      render(false);
    });
  }

  pager.addEventListener("click", function (e) {
    var btn = e.target.closest(".page-btn");
    if (!btn || btn.disabled) return;
    var p = btn.getAttribute("data-page");
    if (p === "prev") current = Math.max(1, current - 1);
    else if (p === "next") current = Math.min(totalPages, current + 1);
    else current = parseInt(p, 10);
    render(true);
  });

  computeItems();
  renderFilters();
  render(false);
});
