(function () {
  "use strict";

  var state = {
    data: null,
    practiceQuestions: [],
    practiceIndex: 0,
    examQuestions: [],
    wrong: new Set(),
    storageKey: ""
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
    var core = String(question.answer || "");

    question.accept = Array.from(new Set([question.answer, chineseNumberToArabic(question.answer)].concat(question.accept || [])));
    if (!Object.prototype.hasOwnProperty.call(question, "requirements")) {
      Object.keys(boundaryConflicts).forEach(function (token) {
        if (core.indexOf(token) !== -1) {
          requirements.push({ label: "邊界詞「" + token + "」", tokens: [token] });
          core = core.replace(token, "");
          if (!question.conflicts) { question.conflicts = boundaryConflicts[token]; }
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
      question.requirements = requirements;
    }
    if (!question.core) {
      var removable = [];
      question.requirements.forEach(function (requirement) {
        removable = removable.concat(requirement.tokens || []);
      });
      removable = removable.concat(question.conflicts || []);
      removable.sort(function (a, b) { return b.length - a.length; });
      question.core = question.accept.map(function (answer) {
        var value = answer;
        removable.forEach(function (token) { value = value.split(token).join(""); });
        return value;
      });
      question.core.push(core);
      question.core = Array.from(new Set(question.core));
    }
    if (!question.conflicts) { question.conflicts = []; }
    return question;
  }

  function matchesCore(question, value) {
    var residue = normalize(value);
    var removable = [];
    (question.requirements || []).forEach(function (requirement) {
      removable = removable.concat(requirement.tokens || []);
    });
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
    if (!input) {
      return { status: "blank", message: "尚未作答。" };
    }
    var correct = (question.accept || []).some(function (answer) {
      return input === normalize(answer);
    });
    if (correct) {
      return { status: "correct", message: "正確：" + question.answer };
    }

    if (matchesCore(question, value)) {
      var conflicts = (question.conflicts || []).filter(function (token) {
        return hasAny(value, [token]);
      });
      if (conflicts.length) {
        return {
          status: "partial",
          message: "數值正確，但邊界方向不一致（出現「" + conflicts.join("／") + "」）。正式答案：" + question.answer
        };
      }
      var missing = (question.requirements || []).filter(function (requirement) {
        return !hasAny(value, requirement.tokens || []);
      }).map(function (requirement) { return requirement.label; });
      if (missing.length) {
        return {
          status: "partial",
          message: "數值正確，但缺少" + missing.join("、") + "。正式答案：" + question.answer
        };
      }
      return {
        status: "partial",
        message: "內容接近，但請依框選的完整順序作答。正式答案：" + question.answer
      };
    }

    return { status: "wrong", message: "答案不正確。正式答案：" + question.answer };
  }

  function loadWrong() {
    try {
      var saved = JSON.parse(localStorage.getItem(state.storageKey) || "[]");
      state.wrong = new Set(Array.isArray(saved) ? saved : []);
    } catch (error) {
      state.wrong = new Set();
    }
    updateWrongCount();
  }

  function saveWrong() {
    try { localStorage.setItem(state.storageKey, JSON.stringify(Array.from(state.wrong))); } catch (error) {}
    updateWrongCount();
  }

  function updateWrong(questionId, isWrong) {
    if (isWrong) { state.wrong.add(questionId); } else { state.wrong.delete(questionId); }
    saveWrong();
  }

  function updateWrongCount() {
    el.wrongCount.textContent = String(state.wrong.size);
  }

  function setFeedback(target, result) {
    target.hidden = false;
    target.className = "quiz-feedback " + result.status;
    target.textContent = result.message;
  }

  function renderPractice() {
    var questions = state.practiceQuestions;
    var empty = questions.length === 0;
    el.practiceLabel.textContent = el.activeMode === "wrong" ? "錯題重做" : "逐題練習";
    el.practiceInput.value = "";
    el.practiceFeedback.hidden = true;
    el.sourceDetails.hidden = true;
    el.sourceDetails.open = false;

    if (empty) {
      el.questionSource.textContent = "完成";
      el.questionGroup.textContent = "錯題重做";
      el.questionNumber.textContent = "";
      el.questionPrompt.textContent = "目前沒有錯題。完成逐題練習或模擬考後，答錯與部分正確的題目會自動收進這裡。";
      el.practiceInput.disabled = true;
      el.checkButton.disabled = true;
      el.prevButton.disabled = true;
      el.nextButton.disabled = true;
      el.progressText.textContent = "0／0";
      el.progressBar.style.width = "0%";
      return;
    }

    var question = questions[state.practiceIndex];
    var position = state.practiceIndex + 1;
    el.questionSource.textContent = question.source;
    el.questionGroup.textContent = question.group;
    if (el.questionEffective) {
      if (question.effectiveFrom) {
        el.questionEffective.textContent = "⚠ " + question.effectiveFrom + " 才施行";
        el.questionEffective.hidden = false;
      } else {
        el.questionEffective.hidden = true;
      }
    }
    el.questionNumber.textContent = "第 " + position + " 題";
    el.questionPrompt.textContent = displayPrompt(question.prompt);
    el.sourceText.textContent = question.sourceText;
    el.practiceInput.disabled = false;
    el.checkButton.disabled = false;
    el.prevButton.disabled = state.practiceIndex === 0;
    el.nextButton.disabled = state.practiceIndex === questions.length - 1;
    el.progressText.textContent = position + "／" + questions.length;
    el.progressBar.style.width = (position / questions.length * 100) + "%";
    el.practiceInput.focus();
  }

  function checkPractice() {
    if (!state.practiceQuestions.length) { return; }
    var question = state.practiceQuestions[state.practiceIndex];
    var result = evaluate(question, el.practiceInput.value);
    setFeedback(el.practiceFeedback, result);
    el.sourceDetails.hidden = false;
    updateWrong(question.id, result.status !== "correct");
  }

  function movePractice(delta) {
    var next = state.practiceIndex + delta;
    if (next < 0 || next >= state.practiceQuestions.length) { return; }
    state.practiceIndex = next;
    renderPractice();
  }

  function shuffle(items) {
    var copy = items.slice();
    for (var i = copy.length - 1; i > 0; i -= 1) {
      var j = Math.floor(Math.random() * (i + 1));
      var temp = copy[i]; copy[i] = copy[j]; copy[j] = temp;
    }
    return copy;
  }

  function appendBadge(parent, text, className) {
    var badge = document.createElement("span");
    badge.className = className || "pill";
    badge.textContent = text;
    parent.appendChild(badge);
  }

  function renderExam() {
    state.examQuestions = shuffle(state.data.questions);
    el.examQuestions.textContent = "";
    el.examResult.hidden = true;
    state.examQuestions.forEach(function (question, index) {
      var card = document.createElement("article");
      card.className = "exam-question";
      card.dataset.id = question.id;

      var head = document.createElement("div");
      head.className = "quiz-question-head";
      appendBadge(head, question.source, "pill teal");
      appendBadge(head, question.group, "pill");
      var number = document.createElement("span");
      number.className = "quiz-question-number";
      number.textContent = "第 " + (index + 1) + " 題";
      head.appendChild(number);

      var prompt = document.createElement("p");
      prompt.className = "quiz-prompt small";
      prompt.textContent = displayPrompt(question.prompt);

      var input = document.createElement("input");
      input.className = "quiz-input";
      input.type = "text";
      input.autocomplete = "off";
      input.dataset.questionId = question.id;
      input.setAttribute("aria-label", "第 " + (index + 1) + " 題答案");

      var feedback = document.createElement("div");
      feedback.className = "quiz-feedback";
      feedback.hidden = true;

      card.appendChild(head);
      card.appendChild(prompt);
      card.appendChild(input);
      card.appendChild(feedback);
      el.examQuestions.appendChild(card);
    });
  }

  function submitExam() {
    var correctCount = 0;
    state.examQuestions.forEach(function (question) {
      var input = el.examQuestions.querySelector('[data-question-id="' + question.id + '"]');
      var card = input.closest(".exam-question");
      var feedback = card.querySelector(".quiz-feedback");
      var result = evaluate(question, input.value);
      if (result.status === "correct") { correctCount += 1; }
      card.dataset.status = result.status;
      input.disabled = true;
      setFeedback(feedback, result);
      updateWrong(question.id, result.status !== "correct");
    });
    var total = state.examQuestions.length;
    var percent = Math.round(correctCount / total * 100);
    el.examResult.hidden = false;
    el.examResult.textContent = "得分：" + correctCount + "／" + total + "（" + percent + "%）。錯題與部分正確題目已加入錯題重做。";
    el.examResult.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function renderPrint() {
    el.printTitle.textContent = state.data.title;
    el.printMeta.textContent = "法規版本：" + state.data.lastAmended + "｜題數：" + state.data.questionCount + "｜姓名：________________　日期：________________";
    el.printQuestions.textContent = "";
    el.printAnswers.textContent = "";
    var answerList = document.createElement("ol");
    state.data.questions.forEach(function (question, index) {
      var item = document.createElement("div");
      item.className = "print-question";
      item.textContent = (index + 1) + ". " + displayPrompt(question.prompt) + "　（" + question.source + "）";
      el.printQuestions.appendChild(item);

      var answer = document.createElement("li");
      answer.textContent = question.answer + "（" + question.source + "）";
      answerList.appendChild(answer);
    });
    el.printAnswers.appendChild(answerList);
  }

  function setMode(mode) {
    el.activeMode = mode;
    document.querySelectorAll(".quiz-mode-button[data-mode]").forEach(function (button) {
      button.classList.toggle("active", button.dataset.mode === mode);
    });
    el.practiceView.hidden = mode === "exam";
    el.examView.hidden = mode !== "exam";

    if (mode === "exam") {
      renderExam();
      return;
    }
    state.practiceIndex = 0;
    state.practiceQuestions = mode === "wrong"
      ? state.data.questions.filter(function (question) { return state.wrong.has(question.id); })
      : state.data.questions.slice();
    renderPractice();
  }

  function bindEvents() {
    document.querySelectorAll(".quiz-mode-button[data-mode]").forEach(function (button) {
      button.addEventListener("click", function () { setMode(button.dataset.mode); });
    });
    el.checkButton.addEventListener("click", checkPractice);
    el.practiceInput.addEventListener("keydown", function (event) {
      if (event.key === "Enter") { event.preventDefault(); checkPractice(); }
    });
    el.prevButton.addEventListener("click", function () { movePractice(-1); });
    el.nextButton.addEventListener("click", function () { movePractice(1); });
    el.submitExam.addEventListener("click", submitExam);
    el.printButton.addEventListener("click", function () { window.print(); });
  }

  function hydrate(data) {
    data.questions = data.questions.map(prepareQuestion);
    state.data = data;
    state.storageKey = "ohs-number-quiz-wrong-" + data.pcode;
    document.title = data.title + "｜職安主題整理";
    el.quizTitle.textContent = data.title;
    el.quizLede.textContent = "以數字框選列印版為唯一題庫來源；含逐題練習、隨機模擬考、錯題重做及 A4 列印。";
    el.metaQuestions.textContent = data.questionCount;
    el.metaUnique.textContent = data.uniqueAnswerCount;
    el.metaBoxes.textContent = data.sourceBoxCount;
    el.metaVersion.textContent = data.lastAmended;
    el.metaPcode.textContent = data.pcode;
    loadWrong();
    renderPrint();
    el.loading.hidden = true;
    setMode("practice");
  }

  function fail(error) {
    el.loading.hidden = true;
    el.error.hidden = false;
    el.error.textContent = "題庫載入失敗，請重新整理頁面。";
    if (window.console) { console.error(error); }
  }

  function init() {
    el.quizTitle = byId("quiz-title");
    el.quizLede = byId("quiz-lede");
    el.metaQuestions = byId("meta-questions");
    el.metaUnique = byId("meta-unique");
    el.metaBoxes = byId("meta-boxes");
    el.metaVersion = byId("meta-version");
    el.metaPcode = byId("meta-pcode");
    el.wrongCount = byId("wrong-count");
    el.loading = byId("loading");
    el.error = byId("error");
    el.practiceView = byId("practice-view");
    el.examView = byId("exam-view");
    el.practiceLabel = byId("practice-label");
    el.progressText = byId("progress-text");
    el.progressBar = byId("progress-bar");
    el.questionSource = byId("question-source");
    el.questionGroup = byId("question-group");
    el.questionEffective = byId("question-effective");
    el.questionNumber = byId("question-number");
    el.questionPrompt = byId("question-prompt");
    el.practiceInput = byId("practice-input");
    el.checkButton = byId("check-button");
    el.practiceFeedback = byId("practice-feedback");
    el.sourceDetails = byId("source-details");
    el.sourceText = byId("source-text");
    el.prevButton = byId("prev-button");
    el.nextButton = byId("next-button");
    el.examQuestions = byId("exam-questions");
    el.submitExam = byId("submit-exam");
    el.examResult = byId("exam-result");
    el.printButton = byId("print-button");
    el.printTitle = byId("print-title");
    el.printMeta = byId("print-meta");
    el.printQuestions = byId("print-questions");
    el.printAnswers = byId("print-answers");
    bindEvents();

    var requested = new URLSearchParams(window.location.search).get("law") || "N0060065";
    var law = /^[A-Z][0-9]+$/.test(requested) ? requested : "N0060065";
    fetch("data/" + law + ".json", { cache: "no-store" })
      .then(function (response) {
        if (!response.ok) { throw new Error("HTTP " + response.status); }
        return response.json();
      })
      .then(hydrate)
      .catch(fail);
  }

  window.OHSNumberQuiz = Object.freeze({ normalize: normalize, chineseNumberToArabic: chineseNumberToArabic, prepareQuestion: prepareQuestion, evaluate: evaluate });
  document.addEventListener("DOMContentLoaded", init);
})();
