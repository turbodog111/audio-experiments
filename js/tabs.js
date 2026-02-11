/* ═══════════════════════════════════════════════
   Tab switching
   ═══════════════════════════════════════════════ */

document.querySelectorAll('.tab-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('tab-' + btn.dataset.tab).classList.add('active');

    // Widen container for editor tab
    var container = document.querySelector('.container');
    if (btn.dataset.tab === 'editor') {
      container.classList.add('editor-active');
    } else {
      container.classList.remove('editor-active');
    }
  });
});
