const toggle = document.getElementById('show-toggle');

chrome.storage.local.get({ showButton: true }).then(({ showButton }) => {
  toggle.checked = showButton !== false;
});

toggle.addEventListener('change', () => {
  chrome.storage.local.set({ showButton: toggle.checked });
});
