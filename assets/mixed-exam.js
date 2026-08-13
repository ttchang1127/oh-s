(function () {
  "use strict";

  var state = {
    catalog: null,
    items: [],
    cache: new Map(),
    questions: [],
    results: [],
    submitted: false,
    startedAt: 0,
    endedAt: 0,
    timerId: 0,
    remainingSeconds: 0,
    scopeLabel: "",
    strategyLabel: "",
    reviewFilter: "all"
  };
  var el = {};

  function byId(id) { return document.getElementById(id); }

  function normalize(value) {
    return String(value || "")
      .normalize("NFKC")
      .toLowerCase()
      .replace(/[µμ]/g, "μ")
      .replace(/\s+/g, "")
      .replace(/[，,。．.；;：:]/g, "");
  }

  function displayPrompt(value) {
    return String(value || "").replace(/〔\s*〕/g, "〔　　　　　〕");
  }

  function hasAny(value, tokens) {
    var n = normalize(value);
    return (tokens || []).some(function (token) { return n.indexOf(normalize(token)) !== -1; });
  }

  function chineseNumberToArabic(value) {
    var digits = { "零": 0, "〇": 0, "一": 1, "二": 2, "三": 3, "四": 4, "五": 5, "六": 6, "七": 7, "八": 8, "九": 9 };
    var units = { "十": 10, "百": 100, "千": 1000, "萬": 10000 };
    function parse(token) {
      var result = 0;
      var current = 0;
      var seenUnit = false;
      for (var i = 0; i < token.length; i += 1) {
        var character = token.charAt(i);
        if (Object.prototype.hasOwnProperty.call(digits, character)) {
          current = digits[character];
        } else if (Object.prototype.hasOwnProperty.call(units, character)) {
          seenUnit = true;
          result += (current || 1) * units[character];
          current = 0;
        }
      }
      if (seenUnit) { return String(result + current); }
      return token.split("").map(function (character) { return String(digits[character]); }).join("");
    }
    return String(value || "").replace(/[零〇一二三四五六七八九十百千萬]+/g, parse);
  }

  function prepareQuestion(question) {
    var prepared = Object.assign({}, question);
    var boundaryConflicts = {
      "未滿": ["以上", "大於", "超過"],
      "小於": ["以上", "大於", "超過"],
      "低於": ["以上", "大於", "超過"],
      "以上": ["未滿", "以下", "小於", "低於"],
      "以下": ["以上", "大於", "超過"],
      "超過": ["未滿", "以下", "小於", "低於"],
      "大於": ["未滿", "以下", "小於", "低於"]
    };
    var units = ["mg/m³", "f/cc", "ppm", "微米", "伏特", "公厘", "公斤", "公分", "公尺", "歲", "年"];
    var requirements = [];
    var core = String(prepared.answer || "");

    prepared.accept = Array.from(new Set([prepared.answer, chineseNumberToArabic(prepared.answer)].concat(prepared.accept || [])));
    if (!Object.prototype.hasOwnProperty.call(prepared, "requirements")) {
      Object.keys(boundaryConflicts).forEach(function (token) {
        if (core.indexOf(token) !== -1) {
          requirements.push({ label: "邊界詞「" + token + "」", tokens: [token] });
          core = core.replace(token, "");
          if (!prepared.conflicts) { prepared.conflicts = boundaryConflicts[token]; }
        }
      });
      if (core.indexOf("百分之") !== -1) {
        requirements.push({ label: "百分比", tokens: ["百分之", "%"] });
        core = core.replace("百分之", "");
      }
      units.forEach(function (unit) {
        if (core.indexOf(unit) !== -1) {
          var tokens = [unit];
          if (unit === "公斤") { tokens.push("kg"); }
          if (unit === "公分") { tokens.push("cm"); }
          if (unit === "公尺") { tokens.push("m"); }
          if (unit === "微米") { tokens.push("μm", "um"); }
          if (unit === "伏特") { tokens.push("v"); }
          if (unit === "公厘") { tokens.push("mm"); }
          if (unit === "mg/m³") { tokens.push("mg/m3"); }
          requirements.push({ label: "單位「" + unit + "」", tokens: tokens });
          core = core.replace(unit, "");
        }
      });
      prepared.requirements = requirements;
    }
    if (!prepared.core) {
      var removable = [];
      prepared.requirements.forEach(function (requirement) { removable = removable.concat(requirement.tokens || []); });
      removable = removable.concat(prepared.conflicts || []);
      removable.sort(function (a, b) { return b.length - a.length; });
      prepared.core = prepared.accept.map(function (answer) {
        var value = answer;
        removable.forEach(function (token) { value = value.split(token).join(""); });
        return value;
      });
      prepared.core.push(core);
      prepared.core = Array.from(new Set(prepared.core));
    }
    if (!prepared.conflicts) { prepared.conflicts = []; }
    return prepared;
  }

  function matchesCore(question, value) {
    var residue = normalize(value);
    var removable = [];
    (question.requirements || []).forEach(function (requirement) { removable = removable.concat(requirement.tokens || []); });
    removable = removable.concat(question.conflicts || []);
    removable.sort(function (a, b) { return normalize(b).length - normalize(a).length; });
    removable.forEach(function (token) {
      var target = normalize(token);
      if (target) { residue = residue.split(target).join(""); }
    });
    return (question.core || []).some(function (core) { return residue === normalize(core); });
  }

  function evaluate(question, value) {
    var input = normalize(value);
    if (!input) { return { status: "blank", message: "未作答。正式答案：" + question.answer }; }
    if ((question.accept || []).some(function (answer) { return input === normalize(answer); })) {
      return { status: "correct", message: "完全正確：" + question.answer };
    }
    if (matchesCore(question, value)) {
      var conflicts = (question.conflicts || []).filter(function (token) { return hasAny(value, [token]); });
      if (conflicts.length) {
        return { status: "partial", message: "數值正確，但邊界方向不一致（出現「" + conflicts.join("／") + "」）。正式答案：" + question.answer };
      }
      var missing = (question.requirements || []).filter(function (requirement) {
        return !hasAny(value, requirement.tokens || []);
      }).map(function (requirement) { return requirement.label; });
      if (missing.length) {
        return { status: "partial", message: "數值正確，但缺少" + missing.join("、") + "。正式答案：" + question.answer };
      }
      return { status: "partial", message: "內容接近，但應依框選的完整順序作答。正式答案：" + question.answer };
    }
    return { status: "wrong", message: "答案不正確。正式答案：" + question.answer };
  }

  function shuffle(items) {
    var copy = items.slice();
    for (var i = copy.length - 1; i > 0; i -= 1) {
      var j = Math.floor(Math.random() * (i + 1));
      var temp = copy[i]; copy[i] = copy[j]; copy[j] = temp;
    }
    return copy;
  }

  function balancedSample(pool, count) {
    var grouped = new Map();
    pool.forEach(function (question) {
      if (!grouped.has(question.pcode)) { grouped.set(question.pcode, []); }
      grouped.get(question.pcode).push(question);
    });
    var lawOrder = shuffle(Array.from(grouped.keys()));
    var queues = new Map();
    lawOrder.forEach(function (pcode) { queues.set(pcode, shuffle(grouped.get(pcode))); });
    var selected = [];
    while (selected.length < count) {
      var added = false;
      lawOrder = shuffle(lawOrder);
      lawOrder.forEach(function (pcode) {
        if (selected.length >= count) { return; }
        var queue = queues.get(pcode);
        if (queue.length) { selected.push(queue.pop()); added = true; }
      });
      if (!added) { break; }
    }
    return shuffle(selected);
  }

  function sampleQuestions(pool, count, strategy) {
    var actual = Math.min(Number(count), pool.length);
    return strategy === "weighted" ? shuffle(pool).slice(0, actual) : balancedSample(pool, actual);
  }

  function formatNumber(value) { return Number(value || 0).toLocaleString("zh-TW"); }

  function formatDuration(seconds) {
    var minutes = Math.floor(seconds / 60);
    var remainder = seconds % 60;
    return minutes + "分" + String(remainder).padStart(2, "0") + "秒";
  }

  function formatTimer(seconds) {
    return String(Math.floor(seconds / 60)).padStart(2, "0") + ":" + String(seconds % 60).padStart(2, "0");
  }

  function appendBadge(parent, text, className) {
    var badge = document.createElement("span");
    badge.className = className || "pill";
    badge.textContent = text;
    parent.appendChild(badge);
  }

  function selectedItems() {
    var category = el.category.value;
    return state.items.filter(function (item) { return !category || item.category === category; });
  }

  function updateScopeSummary() {
    var items = selectedItems();
    var questionCount = items.reduce(function (sum, item) { return sum + Number(item.questionCount || 0); }, 0);
    var label = el.category.value || "全部分類";
    el.scopeSummary.textContent = label + "：" + items.length + " 部法規，共 " + formatNumber(questionCount) + " 題可供抽選。";
  }

  function loadLaw(item, progress) {
    if (state.cache.has(item.id)) { progress(); return Promise.resolve(state.cache.get(item.id)); }
    return fetch("data/" + item.id + ".json", { cache: "no-store" })
      .then(function (response) {
        if (!response.ok) { throw new Error(item.id + " HTTP " + response.status); }
        return response.json();
      })
      .then(function (data) {
        state.cache.set(item.id, data);
        progress();
        return data;
      });
  }

  function buildPool(items) {
    var completed = 0;
    el.loading.hidden = false;
    el.loading.textContent = "正在載入 0／" + items.length + " 部法規……";
    function progress() {
      completed += 1;
      el.loading.textContent = "正在載入 " + completed + "／" + items.length + " 部法規……";
    }
    return Promise.all(items.map(function (item) { return loadLaw(item, progress); }))
      .then(function (dataSets) {
        var pool = [];
        dataSets.forEach(function (data, dataIndex) {
          var item = items[dataIndex];
          data.questions.forEach(function (question) {
            var prepared = prepareQuestion(question);
            prepared.key = item.id + ":" + question.id;
            prepared.pcode = item.id;
            prepared.lawName = item.title;
            prepared.category = item.category;
            pool.push(prepared);
          });
        });
        return pool;
      });
  }

  function createQuestionCard(question, index) {
    var card = document.createElement("article");
    card.className = "exam-question mixed-question";
    card.dataset.index = String(index);

    var head = document.createElement("div");
    head.className = "quiz-question-head";
    appendBadge(head, question.lawName, "pill teal");
    appendBadge(head, question.source, "pill");
    appendBadge(head, question.group, "pill");
    var number = document.createElement("span");
    number.className = "quiz-question-number";
    number.textContent = "第 " + (index + 1) + " 題";
    head.appendChild(number);

    var prompt = document.createElement("p");
    prompt.className = "quiz-prompt small";
    prompt.textContent = displayPrompt(question.prompt);

    var input = document.createElement("input");
    input.className = "quiz-input mixed-answer";
    input.type = "text";
    input.autocomplete = "off";
    input.setAttribute("aria-label", "第 " + (index + 1) + " 題答案");
    input.addEventListener("input", updateAnsweredProgress);

    var feedback = document.createElement("div");
    feedback.className = "quiz-feedback";
    feedback.hidden = true;

    card.appendChild(head);
    card.appendChild(prompt);
    card.appendChild(input);
    card.appendChild(feedback);
    return card;
  }

  function renderExam() {
    el.questions.textContent = "";
    state.questions.forEach(function (question, index) { el.questions.appendChild(createQuestionCard(question, index)); });
    el.statusScope.textContent = state.scopeLabel;
    el.statusCount.textContent = state.questions.length + " 題";
    el.result.hidden = true;
    el.submit.disabled = false;
    state.submitted = false;
    state.results = [];
    state.startedAt = Date.now();
    state.endedAt = 0;
    updateAnsweredProgress();
    renderPrint();
  }

  function updateAnsweredProgress() {
    var inputs = Array.prototype.slice.call(el.questions.querySelectorAll(".mixed-answer"));
    var answered = inputs.filter(function (input) { return normalize(input.value); }).length;
    el.answered.textContent = answered + "／" + state.questions.length;
    el.progress.style.width = (state.questions.length ? answered / state.questions.length * 100 : 0) + "%";
  }

  function clearTimer() {
    if (state.timerId) { window.clearInterval(state.timerId); state.timerId = 0; }
  }

  function startTimer(minutes) {
    clearTimer();
    state.remainingSeconds = Number(minutes) * 60;
    if (!state.remainingSeconds) { el.timer.textContent = "不計時"; return; }
    el.timer.textContent = formatTimer(state.remainingSeconds);
    state.timerId = window.setInterval(function () {
      state.remainingSeconds -= 1;
      el.timer.textContent = formatTimer(Math.max(0, state.remainingSeconds));
      el.timer.classList.toggle("is-urgent", state.remainingSeconds <= 300);
      if (state.remainingSeconds <= 0) { clearTimer(); submitExam(true); }
    }, 1000);
  }

  function startWithQuestions(questions, scopeLabel, minutes) {
    state.questions = questions;
    state.scopeLabel = scopeLabel;
    el.setup.hidden = true;
    el.loading.hidden = true;
    el.error.hidden = true;
    el.exam.hidden = false;
    renderExam();
    startTimer(minutes);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function startExam() {
    var items = selectedItems();
    var count = Number(el.count.value);
    var strategy = el.strategy.value;
    var minutes = Number(el.minutes.value);
    state.scopeLabel = el.category.value || "全部分類";
    state.strategyLabel = strategy === "balanced" ? "跨法規均衡" : "全部題目隨機";
    el.setup.hidden = true;
    el.error.hidden = true;
    buildPool(items)
      .then(function (pool) {
        var questions = sampleQuestions(pool, count, strategy);
        startWithQuestions(questions, state.scopeLabel, minutes);
      })
      .catch(function (error) {
        el.loading.hidden = true;
        el.setup.hidden = false;
        showError("組卷失敗，請重新整理後再試。", error);
      });
  }

  function setFeedback(target, result) {
    target.hidden = false;
    target.className = "quiz-feedback " + result.status;
    target.textContent = result.message;
  }

  function resultCounts() {
    return state.results.reduce(function (counts, item) {
      counts[item.result.status] += 1;
      return counts;
    }, { correct: 0, partial: 0, wrong: 0, blank: 0 });
  }

  function renderCategoryBreakdown() {
    var groups = new Map();
    state.results.forEach(function (item) {
      if (!groups.has(item.question.category)) { groups.set(item.question.category, { correct: 0, total: 0 }); }
      var group = groups.get(item.question.category);
      group.total += 1;
      if (item.result.status === "correct") { group.correct += 1; }
    });
    el.categoryBreakdown.textContent = "";
    Array.from(groups.keys()).sort().forEach(function (category) {
      var group = groups.get(category);
      var row = document.createElement("tr");
      [category, group.correct, group.total, Math.round(group.correct / group.total * 100) + "%"].forEach(function (value) {
        var cell = document.createElement("td"); cell.textContent = value; row.appendChild(cell);
      });
      el.categoryBreakdown.appendChild(row);
    });
  }

  function createReviewCard(item, index) {
    var card = document.createElement("article");
    card.className = "mixed-review-card";
    card.dataset.status = item.result.status;

    var head = document.createElement("div");
    head.className = "quiz-question-head";
    appendBadge(head, item.question.lawName, "pill teal");
    appendBadge(head, item.question.source, "pill");
    var status = document.createElement("span");
    status.className = "pill review-status " + item.result.status;
    status.textContent = { correct: "完全正確", partial: "部分正確", wrong: "答錯", blank: "未作答" }[item.result.status];
    head.appendChild(status);

    var prompt = document.createElement("p");
    prompt.className = "quiz-prompt small";
    prompt.textContent = (index + 1) + ". " + displayPrompt(item.question.prompt);

    var answer = document.createElement("p");
    answer.className = "mixed-review-answer";
    answer.textContent = "你的答案：" + (item.value || "（未作答）");

    var feedback = document.createElement("div");
    setFeedback(feedback, item.result);

    var details = document.createElement("details");
    details.className = "quiz-source";
    var summary = document.createElement("summary");
    summary.textContent = "查看來源內容";
    var source = document.createElement("p");
    source.textContent = item.question.sourceText;
    details.appendChild(summary);
    details.appendChild(source);

    card.appendChild(head);
    card.appendChild(prompt);
    card.appendChild(answer);
    card.appendChild(feedback);
    card.appendChild(details);
    return card;
  }

  function applyReviewFilter(filter) {
    state.reviewFilter = filter;
    document.querySelectorAll("[data-review]").forEach(function (button) {
      var active = button.dataset.review === filter;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    });
    el.review.querySelectorAll(".mixed-review-card").forEach(function (card) {
      card.hidden = filter === "incorrect" && card.dataset.status === "correct";
    });
  }

  function renderReview() {
    el.review.textContent = "";
    state.results.forEach(function (item, index) { el.review.appendChild(createReviewCard(item, index)); });
    applyReviewFilter("all");
  }

  function submitExam(autoSubmitted) {
    if (state.submitted) { return; }
    state.submitted = true;
    state.endedAt = Date.now();
    clearTimer();
    var cards = Array.prototype.slice.call(el.questions.querySelectorAll(".mixed-question"));
    state.results = state.questions.map(function (question, index) {
      var input = cards[index].querySelector(".mixed-answer");
      var feedback = cards[index].querySelector(".quiz-feedback");
      var value = input.value;
      var result = evaluate(question, value);
      input.disabled = true;
      cards[index].dataset.status = result.status;
      setFeedback(feedback, result);
      return { question: question, value: value, result: result };
    });
    var counts = resultCounts();
    var total = state.questions.length;
    var percent = Math.round(counts.correct / total * 100);
    var elapsed = Math.max(0, Math.round((state.endedAt - state.startedAt) / 1000));
    el.score.textContent = counts.correct + "／" + total + "（" + percent + "%）";
    el.partial.textContent = counts.partial;
    el.wrong.textContent = counts.wrong;
    el.blank.textContent = counts.blank;
    el.duration.textContent = formatDuration(elapsed);
    el.resultMessage.textContent = (autoSubmitted ? "時間到，系統已自動交卷。" : "交卷完成。") + "只有完整數字、單位與邊界詞都正確才計為完全正確。";
    el.redoWrong.disabled = counts.partial + counts.wrong + counts.blank === 0;
    renderCategoryBreakdown();
    renderReview();
    renderPrint();
    el.result.hidden = false;
    el.submit.disabled = true;
    el.progress.style.width = "100%";
    el.result.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function redoWrong() {
    var wrongQuestions = state.results.filter(function (item) { return item.result.status !== "correct"; }).map(function (item) { return item.question; });
    if (!wrongQuestions.length) { return; }
    startWithQuestions(shuffle(wrongQuestions), "本卷錯題重做", 0);
  }

  function resetExam() {
    clearTimer();
    el.timer.classList.remove("is-urgent");
    el.exam.hidden = true;
    el.result.hidden = true;
    el.setup.hidden = false;
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function renderPrint() {
    el.printMeta.textContent = "範圍：" + state.scopeLabel + "｜抽題：" + state.strategyLabel + "｜題數：" + state.questions.length + "｜姓名：________________　日期：________________";
    el.printQuestions.textContent = "";
    el.printAnswers.textContent = "";
    var answerList = document.createElement("ol");
    state.questions.forEach(function (question, index) {
      var item = document.createElement("div");
      item.className = "print-question";
      item.textContent = (index + 1) + ". " + displayPrompt(question.prompt) + "　（" + question.lawName + " " + question.source + "）";
      el.printQuestions.appendChild(item);
      var answer = document.createElement("li");
      answer.textContent = question.answer + "（" + question.lawName + " " + question.source + "）";
      answerList.appendChild(answer);
    });
    el.printAnswers.appendChild(answerList);
  }

  function showError(message, error) {
    el.error.hidden = false;
    el.error.textContent = message;
    if (window.console) { console.error(error); }
  }

  function hydrateCatalog(catalog) {
    var categories;
    state.catalog = catalog;
    state.items = (catalog.quizzes || []).filter(function (item) { return item.status === "ready"; });
    categories = Array.from(new Set(state.items.map(function (item) { return item.category; }))).sort();
    el.lawCount.textContent = state.items.length;
    el.questionTotal.textContent = formatNumber(state.items.reduce(function (sum, item) { return sum + Number(item.questionCount || 0); }, 0));
    el.categoryCount.textContent = categories.length;
    categories.forEach(function (category) {
      var option = document.createElement("option");
      option.value = category;
      option.textContent = category;
      el.category.appendChild(option);
    });
    el.loading.hidden = true;
    el.setup.hidden = false;
    updateScopeSummary();
  }

  function bindEvents() {
    el.category.addEventListener("change", updateScopeSummary);
    el.start.addEventListener("click", startExam);
    el.submit.addEventListener("click", function () { submitExam(false); });
    el.redoWrong.addEventListener("click", redoWrong);
    el.newExam.addEventListener("click", resetExam);
    el.print.addEventListener("click", function () { window.print(); });
    document.querySelectorAll("[data-review]").forEach(function (button) {
      button.addEventListener("click", function () { applyReviewFilter(button.dataset.review); });
    });
  }

  function init() {
    el.lawCount = byId("mixed-law-count");
    el.questionTotal = byId("mixed-question-total");
    el.categoryCount = byId("mixed-category-count");
    el.loading = byId("mixed-loading");
    el.error = byId("mixed-error");
    el.setup = byId("mixed-setup");
    el.exam = byId("mixed-exam");
    el.category = byId("mixed-category");
    el.count = byId("mixed-count");
    el.strategy = byId("mixed-strategy");
    el.minutes = byId("mixed-minutes");
    el.scopeSummary = byId("mixed-scope-summary");
    el.start = byId("mixed-start");
    el.statusScope = byId("mixed-status-scope");
    el.statusCount = byId("mixed-status-count");
    el.answered = byId("mixed-answered");
    el.timer = byId("mixed-timer");
    el.progress = byId("mixed-progress");
    el.questions = byId("mixed-questions");
    el.submit = byId("mixed-submit");
    el.result = byId("mixed-result");
    el.score = byId("mixed-score");
    el.partial = byId("mixed-partial");
    el.wrong = byId("mixed-wrong");
    el.blank = byId("mixed-blank");
    el.duration = byId("mixed-duration");
    el.resultMessage = byId("mixed-result-message");
    el.redoWrong = byId("mixed-redo-wrong");
    el.newExam = byId("mixed-new-exam");
    el.print = byId("mixed-print");
    el.categoryBreakdown = byId("mixed-category-breakdown");
    el.review = byId("mixed-review");
    el.printMeta = byId("mixed-print-meta");
    el.printQuestions = byId("mixed-print-questions");
    el.printAnswers = byId("mixed-print-answers");
    bindEvents();
    fetch("catalog.json", { cache: "no-store" })
      .then(function (response) {
        if (!response.ok) { throw new Error("HTTP " + response.status); }
        return response.json();
      })
      .then(hydrateCatalog)
      .catch(function (error) {
        el.loading.hidden = true;
        showError("題庫目錄載入失敗，請重新整理頁面。", error);
      });
  }

  window.OHSMixedExam = Object.freeze({
    normalize: normalize,
    chineseNumberToArabic: chineseNumberToArabic,
    prepareQuestion: prepareQuestion,
    evaluate: evaluate,
    balancedSample: balancedSample,
    sampleQuestions: sampleQuestions
  });
  document.addEventListener("DOMContentLoaded", init);
})();
