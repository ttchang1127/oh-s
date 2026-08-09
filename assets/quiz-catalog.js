(function () {
  "use strict";

  var state = { catalog: null, items: [] };
  var el = {};

  function byId(id) { return document.getElementById(id); }

  function normalize(value) {
    return String(value || "").normalize("NFKC").toLowerCase().replace(/\s+/g, "");
  }

  function formatDate(value) {
    var parts = String(value || "").split("-");
    return parts.length === 3 ? parts[0] + "." + parts[1] + "." + parts[2] : value;
  }

  function total(field) {
    return state.items.reduce(function (sum, item) { return sum + Number(item[field] || 0); }, 0);
  }

  function appendPill(parent, text, className) {
    var pill = document.createElement("span");
    pill.className = className || "pill";
    pill.textContent = text;
    parent.appendChild(pill);
  }

  function createCard(item) {
    var card = document.createElement("a");
    card.className = "catalog-card";
    card.href = item.url;

    var top = document.createElement("div");
    top.className = "catalog-card-top";
    appendPill(top, item.category, "pill teal");
    appendPill(top, item.id, "pill");

    var title = document.createElement("h2");
    title.textContent = item.title;

    var description = document.createElement("p");
    description.textContent = item.description;

    var stats = document.createElement("div");
    stats.className = "catalog-card-stats";
    appendPill(stats, item.questionCount + " 題", "pill red");
    appendPill(stats, item.uniqueAnswerCount + " 種答案", "pill");
    appendPill(stats, item.sourceBoxCount + " 個來源框", "pill");

    var tags = document.createElement("div");
    tags.className = "catalog-tags";
    (item.tags || []).forEach(function (tag) { appendPill(tags, tag, "pill"); });

    var footer = document.createElement("div");
    footer.className = "catalog-card-footer";
    var version = document.createElement("span");
    version.textContent = "法規版本 " + formatDate(item.lastAmended);
    var action = document.createElement("strong");
    action.textContent = "開始練習 →";
    footer.appendChild(version);
    footer.appendChild(action);

    card.appendChild(top);
    card.appendChild(title);
    card.appendChild(description);
    card.appendChild(stats);
    card.appendChild(tags);
    card.appendChild(footer);
    return card;
  }

  function filteredItems() {
    var query = normalize(el.search.value);
    var category = el.category.value;
    var items = state.items.filter(function (item) {
      var searchable = normalize([item.title, item.id, item.category, item.description].concat(item.tags || []).join(" "));
      return (!query || searchable.indexOf(query) !== -1) && (!category || item.category === category);
    });
    var sort = el.sort.value;
    items.sort(function (a, b) {
      if (sort === "questions") { return b.questionCount - a.questionCount || a.title.localeCompare(b.title, "zh-Hant"); }
      if (sort === "updated") { return String(b.lastAmended).localeCompare(String(a.lastAmended)) || a.title.localeCompare(b.title, "zh-Hant"); }
      return a.title.localeCompare(b.title, "zh-Hant");
    });
    return items;
  }

  function render() {
    var items = filteredItems();
    el.grid.textContent = "";
    items.forEach(function (item) { el.grid.appendChild(createCard(item)); });
    el.resultCount.textContent = items.length + " 部法規";
    el.empty.hidden = items.length !== 0;
  }

  function hydrate(catalog) {
    state.catalog = catalog;
    state.items = (catalog.quizzes || []).filter(function (item) { return item.status === "ready"; });
    el.laws.textContent = state.items.length;
    el.questions.textContent = total("questionCount");
    el.boxes.textContent = total("sourceBoxCount");
    el.updated.textContent = formatDate(catalog.updated);

    Array.from(new Set(state.items.map(function (item) { return item.category; }))).sort().forEach(function (category) {
      var option = document.createElement("option");
      option.value = category;
      option.textContent = category;
      el.category.appendChild(option);
    });
    el.loading.hidden = true;
    render();
  }

  function fail(error) {
    el.loading.hidden = true;
    el.error.hidden = false;
    el.error.textContent = "題庫目錄載入失敗，請重新整理頁面。";
    if (window.console) { console.error(error); }
  }

  function init() {
    el.laws = byId("catalog-laws");
    el.questions = byId("catalog-questions");
    el.boxes = byId("catalog-boxes");
    el.updated = byId("catalog-updated");
    el.search = byId("catalog-search");
    el.category = byId("catalog-category");
    el.sort = byId("catalog-sort");
    el.resultCount = byId("catalog-result-count");
    el.loading = byId("catalog-loading");
    el.error = byId("catalog-error");
    el.grid = byId("catalog-grid");
    el.empty = byId("catalog-empty");

    el.search.addEventListener("input", render);
    el.category.addEventListener("change", render);
    el.sort.addEventListener("change", render);
    fetch("catalog.json", { cache: "no-store" })
      .then(function (response) {
        if (!response.ok) { throw new Error("HTTP " + response.status); }
        return response.json();
      })
      .then(hydrate)
      .catch(fail);
  }

  document.addEventListener("DOMContentLoaded", init);
})();
