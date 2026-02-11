/* ═══════════════════════════════════════════════
   Help Guide Sidebar
   ═══════════════════════════════════════════════ */
(function guideModule() {
  var toggleBtn = document.getElementById('guideToggleBtn');
  var sidebar   = document.getElementById('guideSidebar');
  var closeBtn  = document.getElementById('guideCloseBtn');

  function openGuide() {
    sidebar.classList.add('open');
    highlightActiveSection();
  }

  function closeGuide() {
    sidebar.classList.remove('open');
  }

  toggleBtn.addEventListener('click', openGuide);
  closeBtn.addEventListener('click', closeGuide);

  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && sidebar.classList.contains('open')) {
      closeGuide();
    }
  });

  function highlightActiveSection() {
    var activeTab = document.querySelector('.tab-btn.active');
    var tabName = activeTab ? activeTab.dataset.tab : '';

    var sections = sidebar.querySelectorAll('.guide-section');
    for (var i = 0; i < sections.length; i++) {
      sections[i].classList.remove('guide-section-highlighted');
    }

    var map = {
      repeater:  'guide-repeater',
      setlist:   'guide-setlist',
      editor:    'guide-editor',
      converter: 'guide-converter'
    };

    var targetId = map[tabName];
    if (targetId) {
      var el = document.getElementById(targetId);
      if (el) {
        el.classList.add('guide-section-highlighted');
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }
})();
