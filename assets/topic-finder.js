(function () {
  'use strict';

  var categories = {
    'quizzes/index.html': ['training'],
    'topics/ex-electrical.html': ['equipment'],
    'topics/high-voltage-clearance.html': ['equipment'],
    'topics/auto-inspection.html': ['management', 'equipment'],
    'topics/cns-45001.html': ['management'],
    'topics/job-safety-analysis-and-safe-work-standards.html': ['management'],
    'topics/emergency-response-plan.html': ['management'],
    'topics/risk-level-systems.html': ['management', 'chemical', 'health'],
    'topics/engineering-safety-analysis.html': ['management', 'equipment'],
    'topics/workplace-bullying-prevention.html': ['law', 'health'],
    'topics/minor-worker-protection.html': ['law', 'health'],
    'topics/delivery-platform-worker-protection.html': ['law'],
    'topics/abnormal-pressure-and-diving.html': ['health'],
    'topics/first-aid-personnel.html': ['health', 'management'],
    'topics/specific-and-regulated-chemicals.html': ['chemical', 'law'],
    'topics/osha-penalty-43-vs-45.html': ['law'],
    'topics/osha-vs-lsa-employer-duties.html': ['law'],
    'topics/osha-act-and-enforcement-rules.html': ['law'],
    'topics/safety-training.html': ['management'],
    'topics/osha-act-2025-amendment.html': ['law'],
    'topics/contractor-management.html': ['law', 'management'],
    'topics/work-environment-monitoring.html': ['health', 'chemical'],
    'topics/occupational-accident-reporting.html': ['law', 'management'],
    'topics/stop-work-and-appeal.html': ['law'],
    'topics/osh-management-documents.html': ['management'],
    'topics/worker-health-examinations.html': ['health'],
    'topics/maternal-health-risk.html': ['health', 'chemical'],
    'topics/machinery-regulation-axes.html': ['equipment', 'law'],
    'topics/machinery-certificate-validity.html': ['equipment'],
    'topics/construction-supervisors-and-scaffolds.html': ['equipment'],
    'topics/lifting-certificates-and-factors.html': ['equipment'],
    'topics/special-work-rest-periods.html': ['health'],
    'topics/penalties-and-accident-law-system.html': ['law'],
    'topics/high-pressure-gas-categories.html': ['chemical', 'equipment'],
    'topics/facility-rules-quick-reference.html': ['chemical', 'equipment'],
    'topics/passage-and-fixed-ladders.html': ['equipment'],
    'topics/pressure-vessel-comparison.html': ['equipment'],
    'topics/chemical-management-layers.html': ['chemical', 'law']
  };

  var search = document.getElementById('topic-search');
  var filterButtons = Array.prototype.slice.call(document.querySelectorAll('.filter-chip'));
  var cards = Array.prototype.slice.call(document.querySelectorAll('a.topic-card'));
  var panels = Array.prototype.slice.call(document.querySelectorAll('.panel')).filter(function (panel) {
    return panel.querySelector('a.topic-card');
  });
  var status = document.getElementById('topic-result-status');
  var empty = document.getElementById('topic-empty-state');
  var activeCategory = 'all';

  if (!search || !filterButtons.length || !cards.length || !status || !empty) return;

  cards.forEach(function (card) {
    var href = card.getAttribute('href').split(/[?#]/)[0];
    card.dataset.categories = (categories[href] || []).join(' ');
    card.dataset.searchText = card.textContent.replace(/\s+/g, ' ').trim().toLocaleLowerCase('zh-Hant');
  });

  function applyFilters() {
    var query = search.value.trim().toLocaleLowerCase('zh-Hant');
    var visible = 0;

    cards.forEach(function (card) {
      var categoryMatch = activeCategory === 'all' || card.dataset.categories.split(' ').indexOf(activeCategory) !== -1;
      var searchMatch = !query || card.dataset.searchText.indexOf(query) !== -1;
      var show = categoryMatch && searchMatch;
      card.hidden = !show;
      if (show) visible += 1;
    });

    panels.forEach(function (panel) {
      panel.hidden = !panel.querySelector('a.topic-card:not([hidden])');
    });

    empty.hidden = visible !== 0;
    status.textContent = query || activeCategory !== 'all'
      ? '找到 ' + visible + ' 個入口'
      : '共 38 個入口：37 個主題與 1 個數字填空訓練專區';
  }

  filterButtons.forEach(function (button) {
    button.addEventListener('click', function () {
      activeCategory = button.dataset.category;
      filterButtons.forEach(function (item) {
        var selected = item === button;
        item.classList.toggle('active', selected);
        item.setAttribute('aria-pressed', String(selected));
      });
      applyFilters();
    });
  });

  search.addEventListener('input', applyFilters);
  search.addEventListener('search', applyFilters);
  applyFilters();
})();
