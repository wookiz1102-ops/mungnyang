// 추천 상품 렌더링 + 페이지네이션 (10개씩, 최신순)
document.addEventListener("DOMContentLoaded", function () {
  var grid = document.getElementById("product-grid");
  var pager = document.getElementById("product-pager");
  var empty = document.getElementById("product-empty");
  if (!grid || !pager || !window.PRODUCTS) return;

  var PER_PAGE = 10;
  var items = window.PRODUCTS;
  var totalPages = Math.max(1, Math.ceil(items.length / PER_PAGE));
  var current = 1;

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  function cardHTML(p) {
    return '<div class="card product-card">' +
      (p.tag ? '<span class="product-tag">' + esc(p.tag) + "</span>" : "") +
      "<h3>" + esc(p.name) + "</h3>" +
      "<p>" + esc(p.desc) + "</p>" +
      (p.date ? '<span class="card-meta">' + esc(p.date) + "</span>" : "") +
      '<a class="buy-btn" href="' + esc(p.url) + '" rel="nofollow sponsored noopener" target="_blank">쿠팡에서 보기</a>' +
      "</div>";
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
      if (empty) empty.hidden = false;
      return;
    }
    if (empty) empty.hidden = true;
    var start = (current - 1) * PER_PAGE;
    grid.innerHTML = items.slice(start, start + PER_PAGE).map(cardHTML).join("");
    renderPager();
    if (scroll) window.scrollTo({ top: grid.offsetTop - 80, behavior: "smooth" });
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

  render(false);
});
