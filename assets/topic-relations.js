(function () {
  'use strict';

  var topics = {
    'abnormal-pressure-and-diving': { title: '異常氣壓作業與潛水公告', category: '健康保護', related: ['special-work-rest-periods', 'worker-health-examinations', 'risk-level-systems'] },
    'auto-inspection': { title: '自動檢查頻率總整理', category: '管理制度', related: ['osh-management-documents', 'machinery-regulation-axes', 'ex-electrical'] },
    'chemical-management-layers': { title: '危害性化學品四層分類', category: '化學品', related: ['specific-and-regulated-chemicals', 'risk-level-systems', 'maternal-health-risk'] },
    'cns-45001': { title: 'CNS 45001 重點解析', category: '管理制度', related: ['osh-management-documents', 'job-safety-analysis-and-safe-work-standards', 'emergency-response-plan'] },
    'construction-supervisors-and-scaffolds': { title: '營造作業主管、支柱與施工架', category: '設備營造', related: ['engineering-safety-analysis', 'contractor-management', 'passage-and-fixed-ladders'] },
    'contractor-management': { title: '承攬管理', category: '核心法規', related: ['engineering-safety-analysis', 'osha-penalty-43-vs-45', 'occupational-accident-reporting'] },
    'delivery-platform-worker-protection': { title: '外送員與平台工作者保護', category: '核心法規', related: ['osha-act-2025-amendment', 'osha-vs-lsa-employer-duties', 'occupational-accident-reporting'] },
    'emergency-response-plan': { title: '緊急應變計畫', category: '管理制度', related: ['job-safety-analysis-and-safe-work-standards', 'occupational-accident-reporting', 'cns-45001'] },
    'engineering-safety-analysis': { title: '工程安全分析與整體工程統合管理', category: '管理制度', related: ['contractor-management', 'construction-supervisors-and-scaffolds', 'job-safety-analysis-and-safe-work-standards'] },
    'ex-electrical': { title: '防爆電氣設備', category: '設備營造', related: ['facility-rules-quick-reference', 'high-voltage-clearance', 'auto-inspection'] },
    'facility-rules-quick-reference': { title: '危險物四類型定義與判斷', category: '化學品', related: ['chemical-management-layers', 'high-pressure-gas-categories', 'passage-and-fixed-ladders'] },
    'first-aid-personnel': { title: '急救人員配置、資格與監造判斷', category: '健康保護', related: ['occupational-accident-reporting', 'worker-health-examinations', 'safety-training'] },
    'high-pressure-gas-categories': { title: '高壓氣體分類判斷', category: '化學品', related: ['specific-and-regulated-chemicals', 'pressure-vessel-comparison', 'facility-rules-quick-reference'] },
    'high-voltage-clearance': { title: '特高壓充電電路接近界限', category: '設備營造', related: ['ex-electrical', 'auto-inspection', 'machinery-regulation-axes'] },
    'job-safety-analysis-and-safe-work-standards': { title: '工作安全分析與安全衛生作業標準', category: '管理制度', related: ['risk-level-systems', 'cns-45001', 'emergency-response-plan'] },
    'lifting-certificates-and-factors': { title: '起重吊掛三角色與安全係數', category: '設備營造', related: ['machinery-regulation-axes', 'machinery-certificate-validity', 'construction-supervisors-and-scaffolds'] },
    'machinery-certificate-validity': { title: '危險性機械設備檢查證有效年限', category: '設備營造', related: ['machinery-regulation-axes', 'pressure-vessel-comparison', 'auto-inspection'] },
    'machinery-regulation-axes': { title: '危險性機械設備三軸比較', category: '設備營造', related: ['machinery-certificate-validity', 'lifting-certificates-and-factors', 'pressure-vessel-comparison'] },
    'maternal-health-risk': { title: '母性健康保護與濃度風險分級', category: '健康保護', related: ['worker-health-examinations', 'risk-level-systems', 'minor-worker-protection'] },
    'minor-worker-protection': { title: '未成年工作者保護', category: '核心法規', related: ['maternal-health-risk', 'osha-vs-lsa-employer-duties', 'special-work-rest-periods'] },
    'occupational-accident-reporting': { title: '職業災害通報', category: '核心法規', related: ['contractor-management', 'emergency-response-plan', 'penalties-and-accident-law-system'] },
    'osh-management-documents': { title: '安全衛生組織、規章、計畫與紀錄', category: '管理制度', related: ['cns-45001', 'auto-inspection', 'safety-training'] },
    'osha-act-2025-amendment': { title: '114 年職安法修法重點', category: '核心法規', related: ['workplace-bullying-prevention', 'delivery-platform-worker-protection', 'engineering-safety-analysis'] },
    'osha-act-and-enforcement-rules': { title: '職安法母法與施行細則對照導讀', category: '核心法規', related: ['osha-penalty-43-vs-45', 'chemical-management-layers', 'contractor-management'] },
    'osha-penalty-43-vs-45': { title: '職安法 §43 與 §45 裁罰判斷', category: '核心法規', related: ['penalties-and-accident-law-system', 'contractor-management', 'occupational-accident-reporting'] },
    'osha-vs-lsa-employer-duties': { title: '職安法與勞基法雇主義務比較', category: '核心法規', related: ['penalties-and-accident-law-system', 'minor-worker-protection', 'occupational-accident-reporting'] },
    'passage-and-fixed-ladders': { title: '通道寬度、架設通道與固定梯', category: '設備營造', related: ['facility-rules-quick-reference', 'construction-supervisors-and-scaffolds', 'high-voltage-clearance'] },
    'penalties-and-accident-law-system': { title: '四法罰則與職業災害三法體系', category: '核心法規', related: ['osha-penalty-43-vs-45', 'osha-vs-lsa-employer-duties', 'occupational-accident-reporting'] },
    'pressure-vessel-comparison': { title: '壓力容器四方比較', category: '設備營造', related: ['machinery-certificate-validity', 'machinery-regulation-axes', 'high-pressure-gas-categories'] },
    'risk-level-systems': { title: '風險分級制度比較', category: '管理制度', related: ['chemical-management-layers', 'maternal-health-risk', 'job-safety-analysis-and-safe-work-standards'] },
    'safety-training': { title: '教育訓練時數總整理', category: '管理制度', related: ['first-aid-personnel', 'osh-management-documents', 'contractor-management'] },
    'special-work-rest-periods': { title: '特殊作業作息時間比較', category: '健康保護', related: ['abnormal-pressure-and-diving', 'worker-health-examinations', 'minor-worker-protection'] },
    'specific-and-regulated-chemicals': { title: '特定化學物質與五類化學品比較', category: '化學品', related: ['chemical-management-layers', 'risk-level-systems', 'high-pressure-gas-categories'] },
    'stop-work-and-appeal': { title: '停工制度與申訴保護', category: '核心法規', related: ['occupational-accident-reporting', 'osha-penalty-43-vs-45', 'contractor-management'] },
    'work-environment-monitoring': { title: '作業環境監測', category: '健康保護', related: ['risk-level-systems', 'specific-and-regulated-chemicals', 'worker-health-examinations'] },
    'worker-health-examinations': { title: '勞工健康檢查與健康管理', category: '健康保護', related: ['maternal-health-risk', 'first-aid-personnel', 'work-environment-monitoring'] },
    'workplace-bullying-prevention': { title: '職場霸凌防治新制', category: '核心法規', related: ['osha-act-2025-amendment', 'osh-management-documents', 'osha-vs-lsa-employer-duties'] }
  };

  function renderRelatedTopics() {
    var slug = location.pathname.split('/').pop().replace(/\.html$/, '');
    var current = topics[slug];
    var footer = document.querySelector('footer');
    if (!current || !footer || document.querySelector('.related-section')) return;

    var section = document.createElement('section');
    section.className = 'related-section';
    section.setAttribute('aria-labelledby', 'related-topics-title');

    var heading = document.createElement('h2');
    heading.id = 'related-topics-title';
    heading.textContent = '延伸學習';
    section.appendChild(heading);

    var intro = document.createElement('p');
    intro.className = 'related-intro';
    intro.textContent = '依概念、法源與考題關係接續閱讀：';
    section.appendChild(intro);

    var grid = document.createElement('div');
    grid.className = 'related-grid';
    current.related.forEach(function (relatedSlug) {
      var item = topics[relatedSlug];
      if (!item) return;
      var link = document.createElement('a');
      link.className = 'related-card';
      link.href = relatedSlug + '.html';
      link.innerHTML = '<span class="related-category">' + item.category + '</span><strong>' + item.title + '</strong><span aria-hidden="true">→</span>';
      grid.appendChild(link);
    });
    section.appendChild(grid);
    footer.parentNode.insertBefore(section, footer);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', renderRelatedTopics);
  } else {
    renderRelatedTopics();
  }
})();
