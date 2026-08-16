(function () {
  "use strict";

  var state = { catalog: null, items: [], categories: [] };
  var el = {};

  function byId(id) { return document.getElementById(id); }

  function normalize(value) {
    return String(value || "").normalize("NFKC").toLowerCase().replace(/\s+/g, "");
  }

  function formatDate(value) {
    var parts = String(value || "").split("-");
    return parts.length === 3 ? parts[0] + "." + parts[1] + "." + parts[2] : value;
  }

  function total(items, field) {
    return items.reduce(function (sum, item) { return sum + Number(item[field] || 0); }, 0);
  }

  function batchLabel(item) {
    return "第 " + String(item.batch).padStart(2, "0") + " 批";
  }

  function appendPill(parent, text, className) {
    var pill = document.createElement("span");
    pill.className = className || "pill";
    pill.textContent = text;
    parent.appendChild(pill);
  }

  function createCard(item) {
    var ready = item.status === "ready";
    var card = document.createElement(ready ? "a" : "article");
    card.className = "catalog-card" + (ready ? " is-ready" : " is-queued");
    if (ready) { card.href = item.url; }

    var top = document.createElement("div");
    top.className = "catalog-card-top";
    appendPill(top, batchLabel(item), "pill");
    appendPill(top, ready ? "已上線" : "待發布", ready ? "pill teal" : "pill queued");

    var title = document.createElement("h3");
    title.textContent = item.title;

    var description = document.createElement("p");
    description.textContent = item.description || "數字框選列印版已完成，互動題庫將依批次轉製、核對後上線。";

    var stats = document.createElement("div");
    stats.className = "catalog-card-stats";
    if (ready) {
      appendPill(stats, item.questionCount + " 題", "pill red");
      appendPill(stats, item.uniqueAnswerCount + " 種答案", "pill");
      appendPill(stats, item.sourceBoxCount + " 個來源框", "pill");
      if (item.notYetEffectiveCount) {
        appendPill(stats, "⚠ " + item.notYetEffectiveCount + " 題尚未生效", "pill future");
      }
    } else {
      appendPill(stats, item.order + " 發布順序", "pill");
    }

    var tags = document.createElement("div");
    tags.className = "catalog-tags";
    (item.tags || []).forEach(function (tag) { appendPill(tags, tag, "pill"); });

    var footer = document.createElement("div");
    footer.className = "catalog-card-footer";
    var version = document.createElement("span");
    version.textContent = ready ? "法規版本 " + formatDate(item.lastAmended) : item.id;
    var action = document.createElement("strong");
    action.textContent = ready ? "開始練習 →" : "排程中";
    footer.appendChild(version);
    footer.appendChild(action);

    card.appendChild(top);
    card.appendChild(title);
    card.appendChild(description);
    card.appendChild(stats);
    if (item.tags && item.tags.length) { card.appendChild(tags); }
    card.appendChild(footer);
    return card;
  }

  function filteredItems() {
    var query = normalize(el.search.value);
    var category = el.category.value;
    var batch = el.batch.value;
    var status = el.status.value;
    return state.items.filter(function (item) {
      var searchable = normalize([
        item.title, item.id, item.category, item.batchTitle, item.order, item.description
      ].concat(item.tags || []).join(" "));
      return (!query || searchable.indexOf(query) !== -1) &&
        (!category || item.category === category) &&
        (!batch || String(item.batch) === batch) &&
        (!status || item.status === status);
    }).sort(function (a, b) { return a.order.localeCompare(b.order); });
  }

  function createGroup(category, items) {
    var section = document.createElement("section");
    section.className = "catalog-category-group";

    var heading = document.createElement("div");
    heading.className = "catalog-category-heading";
    var title = document.createElement("h2");
    title.textContent = category;
    var count = document.createElement("span");
    count.textContent = items.length + " 部";
    heading.appendChild(title);
    heading.appendChild(count);

    var grid = document.createElement("div");
    grid.className = "catalog-grid";
    items.forEach(function (item) { grid.appendChild(createCard(item)); });

    section.appendChild(heading);
    section.appendChild(grid);
    return section;
  }

  function render() {
    var items = filteredItems();
    var readyCount = items.filter(function (item) { return item.status === "ready"; }).length;
    el.grid.textContent = "";
    state.categories.forEach(function (category) {
      var grouped = items.filter(function (item) { return item.category === category; });
      if (grouped.length) { el.grid.appendChild(createGroup(category, grouped)); }
    });
    el.resultCount.textContent = items.length + " 部法規／" + readyCount + " 部可練習";
    el.empty.hidden = items.length !== 0;
  }

  function hydrate(catalog) {
    var ready;
    state.catalog = catalog;
    state.items = (catalog.quizzes || []).filter(function (item) {
      return item.status === "ready" || item.status === "queued";
    });
    state.categories = Array.from(new Set(state.items.map(function (item) { return item.category; })));
    ready = state.items.filter(function (item) { return item.status === "ready"; });

    el.ready.textContent = ready.length;
    el.queued.textContent = state.items.length - ready.length;
    el.questions.textContent = total(ready, "questionCount");
    el.batches.textContent = catalog.plannedBatches || new Set(state.items.map(function (item) { return item.batch; })).size;
    if (el.future) { el.future.textContent = total(ready, "notYetEffectiveCount"); }

    state.categories.forEach(function (category) {
      var option = document.createElement("option");
      option.value = category;
      option.textContent = category;
      el.category.appendChild(option);
    });

    Array.from(new Set(state.items.map(function (item) { return item.batch; }))).sort(function (a, b) { return a - b; }).forEach(function (batch) {
      var first = state.items.find(function (item) { return item.batch === batch; });
      var option = document.createElement("option");
      option.value = String(batch);
      option.textContent = batchLabel(first) + "｜" + first.batchTitle;
      el.batch.appendChild(option);
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
    el.ready = byId("catalog-ready");
    el.queued = byId("catalog-queued");
    el.questions = byId("catalog-questions");
    el.batches = byId("catalog-batches");
    el.future = byId("catalog-future");
    el.search = byId("catalog-search");
    el.category = byId("catalog-category");
    el.batch = byId("catalog-batch");
    el.status = byId("catalog-status");
    el.resultCount = byId("catalog-result-count");
    el.loading = byId("catalog-loading");
    el.error = byId("catalog-error");
    el.grid = byId("catalog-grid");
    el.empty = byId("catalog-empty");

    el.search.addEventListener("input", render);
    el.category.addEventListener("change", render);
    el.batch.addEventListener("change", render);
    el.status.addEventListener("change", render);
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
