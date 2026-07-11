// ── Google Analytics 4 (방문자 통계) ─────────────────────────────
// 측정 ID는 아래 GA_ID 한 곳에서 관리합니다. main.js가 전 페이지 공용이라 자동 적용됩니다.
(function () {
  var GA_ID = "G-8K7NSBRTPG"; // 댕냥피디아 GA4 측정 ID

  // 미설정(플레이스홀더)·로컬 개발 환경에서는 추적하지 않음
  if (!GA_ID || GA_ID.indexOf("XXXX") !== -1) return;
  if (location.protocol === "file:") return;
  if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) return;

  var s = document.createElement("script");
  s.async = true;
  s.src = "https://www.googletagmanager.com/gtag/js?id=" + GA_ID;
  document.head.appendChild(s);

  window.dataLayer = window.dataLayer || [];
  window.gtag = function () { window.dataLayer.push(arguments); };
  window.gtag("js", new Date());
  window.gtag("config", GA_ID);
})();

// 모바일 내비게이션 토글
document.addEventListener("DOMContentLoaded", function () {
  var toggle = document.querySelector(".nav-toggle");
  var nav = document.querySelector(".site-nav");
  if (toggle && nav) {
    toggle.addEventListener("click", function () {
      nav.classList.toggle("open");
    });
  }

  // 품종 백과 탭 전환 (강아지/고양이)
  var tabBtns = document.querySelectorAll(".tab-btn");
  if (tabBtns.length) {
    tabBtns.forEach(function (btn) {
      btn.addEventListener("click", function () {
        var target = btn.getAttribute("data-tab");
        document.querySelectorAll(".tab-btn").forEach(function (b) {
          b.classList.toggle("active", b === btn);
        });
        document.querySelectorAll(".tab-panel").forEach(function (p) {
          p.hidden = p.getAttribute("data-panel") !== target;
        });
      });
    });
  }

  // 품종 카드 → 해당 품종 관련 글 목록 표시
  var breedCards = document.querySelectorAll(".breed-card[data-breed]");
  if (breedCards.length && window.BREED_DATA) {
    breedCards.forEach(function (card) {
      card.addEventListener("click", function () {
        var data = window.BREED_DATA[card.getAttribute("data-breed")];
        if (!data) return;
        var panel = card.closest(".tab-panel");
        var browse = panel.querySelector(".breed-browse");
        var detail = panel.querySelector(".breed-detail");
        detail.querySelector(".breed-detail-title").textContent = data.name + " 관련 글";
        detail.querySelector(".breed-articles").innerHTML = data.articles.map(function (a) {
          return '<a class="card" href="' + a.u + '">' +
            '<span class="emoji">' + a.e + '</span>' +
            '<h3>' + a.t + '</h3><p>' + a.d + '</p>' +
            '<span class="card-meta">' + a.m + '</span></a>';
        }).join("");
        browse.hidden = true;
        detail.hidden = false;
      });
    });
    document.querySelectorAll(".back-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var panel = btn.closest(".tab-panel");
        panel.querySelector(".breed-detail").hidden = true;
        panel.querySelector(".breed-browse").hidden = false;
      });
    });
  }

  // BreadcrumbList 구조화 데이터 자동 생성 (글 페이지)
  var crumb = document.querySelector(".article .breadcrumb");
  var h1 = document.querySelector(".article h1");
  if (crumb && h1) {
    var BASE = "https://daengnyangpedia.com";
    var clean = function (href) {
      var path = new URL(href, location.href).pathname
        .replace(/index\.html$/, "")
        .replace(/\.html$/, "");
      return BASE + path;
    };
    var list = [];
    crumb.querySelectorAll("a").forEach(function (a) {
      list.push({ name: a.textContent.trim(), item: clean(a.getAttribute("href")) });
    });
    list.push({ name: h1.textContent.trim(), item: clean(location.pathname) });
    var ld = {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      "itemListElement": list.map(function (it, i) {
        return { "@type": "ListItem", "position": i + 1, "name": it.name, "item": it.item };
      })
    };
    var s = document.createElement("script");
    s.type = "application/ld+json";
    s.textContent = JSON.stringify(ld);
    document.head.appendChild(s);
  }
});
