// 클라이언트 사이드 글 검색
// - 홈: 전체 글 검색 / 카테고리 페이지: data-category로 범위 제한
document.addEventListener("DOMContentLoaded", function () {
  var input = document.getElementById("search-input");
  var results = document.getElementById("search-results");
  if (!input || !results || !window.SEARCH_DATA) return;

  var scope = input.getAttribute("data-category"); // null이면 전체 검색
  var hideTargets = document.querySelectorAll(".js-hide-on-search");
  var CAT_LABEL = {
    breeds: "품종 백과", health: "건강·증상", food: "사료·용품",
    training: "행동·훈련", life: "생활 정보"
  };

  function cardHTML(p) {
    return '<a class="card" href="' + p.u + '">' +
      '<span class="emoji">' + p.e + '</span>' +
      '<h3>' + p.t + '</h3>' +
      '<p>' + p.d + '</p>' +
      '<span class="card-meta">' + CAT_LABEL[p.c] + ' · ' + p.m + '</span>' +
      '</a>';
  }

  function setHidden(hide) {
    for (var i = 0; i < hideTargets.length; i++) {
      hideTargets[i].style.display = hide ? "none" : "";
    }
  }

  input.addEventListener("input", function () {
    var q = input.value.trim().toLowerCase();

    if (!q) {
      results.hidden = true;
      results.innerHTML = "";
      setHidden(false);
      return;
    }

    var tokens = q.split(/\s+/);
    var matches = [];
    for (var i = 0; i < window.SEARCH_DATA.length; i++) {
      var p = window.SEARCH_DATA[i];
      if (scope && p.c !== scope) continue;
      var hay = (p.t + " " + p.d + " " + (p.k || "")).toLowerCase();
      var ok = true;
      for (var j = 0; j < tokens.length; j++) {
        if (hay.indexOf(tokens[j]) === -1) { ok = false; break; }
      }
      if (ok) matches.push(p);
    }

    setHidden(true);
    results.hidden = false;
    if (matches.length) {
      var html = "";
      for (var m = 0; m < matches.length; m++) html += cardHTML(matches[m]);
      results.innerHTML = html;
    } else {
      results.innerHTML = '<p class="search-empty">🔍 "' + input.value.trim().replace(/</g, "&lt;") +
        '"에 대한 결과가 없습니다. 다른 단어로 검색해 보세요.</p>';
    }
  });
});
