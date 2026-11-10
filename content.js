(function () {
  if (window.__bbDlLoaded) return;
  window.__bbDlLoaded = true;

  // pdfUrl is used for PDFs, originalUrl for other file types — prefer originalUrl
  function getDownload() {
    try {
      const params = new URL(location.href).searchParams;
      const original = params.get('originalUrl');
      const raw = original || params.get('pdfUrl');
      return raw ? { url: decodeURIComponent(raw), isPdf: !original } : null;
    } catch {
      return null;
    }
  }

  function getFilename(downloadUrl) {
    try {
      const u = new URL(downloadUrl);
      const disposition = u.searchParams.get('response-content-disposition');
      if (disposition) {
        const utf8 = disposition.match(/filename\*=UTF-8''([^&;]+)/i);
        if (utf8) return decodeURIComponent(utf8[1]);
        const plain = disposition.match(/filename="?([^"&;]+)"?/i);
        if (plain) return plain[1];
      }
    } catch {}
    return null;
  }

  const ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:6px"><path d="M12 3v13M5 14l7 7 7-7"/><path d="M3 21h18"/></svg>`;

  // Grays chosen to sit on the viewer's dark toolbar
  const IDLE_BG = '#4a4a4a';
  const HOVER_BG = '#5c5c5c';
  const BUSY_BG = '#333';

  function injectButton({ url, isPdf }, filename) {
    if (document.getElementById('__bb_dl_btn')) return null;

    const btn = document.createElement('button');
    btn.id = '__bb_dl_btn';
    btn.innerHTML = `${ICON}Download`;
    Object.assign(btn.style, {
      position: 'fixed',
      top: '14px',
      right: '12px',
      zIndex: '2147483647',
      background: IDLE_BG,
      color: '#fff',
      border: '1px solid #666',
      borderRadius: '4px',
      padding: '6px 14px',
      fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
      fontSize: '12px',
      fontWeight: '700',
      letterSpacing: '0.04em',
      textTransform: 'uppercase',
      cursor: 'pointer',
      transition: 'background 0.15s',
      display: 'none', // shown once the show/hide setting has been read
      alignItems: 'center',
    });

    btn.onclick = () => {
      chrome.runtime.sendMessage({ action: 'download', url, filename, isPdf });
      btn.innerHTML = `${ICON}Downloading...`;
      btn.style.background = BUSY_BG;
      btn.style.color = '#aaa';
      btn.style.cursor = 'default';
      btn.disabled = true;
      setTimeout(() => {
        btn.innerHTML = `${ICON}Download`;
        btn.style.background = IDLE_BG;
        btn.style.color = '#fff';
        btn.style.cursor = 'pointer';
        btn.disabled = false;
      }, 3000);
    };
    btn.onmouseenter = () => { if (!btn.disabled) btn.style.background = HOVER_BG; };
    btn.onmouseleave = () => { if (!btn.disabled) btn.style.background = IDLE_BG; };

    // wait for body if not ready
    const attach = () => document.body ? document.body.appendChild(btn) : setTimeout(attach, 100);
    attach();
    return btn;
  }

  const download = getDownload();
  if (download) {
    const btn = injectButton(download, getFilename(download.url));
    if (btn) {
      // The popup's toggle stores showButton; default is to show.
      const setVisible = (show) => { btn.style.display = show ? 'flex' : 'none'; };
      chrome.storage.local.get({ showButton: true })
        .then(({ showButton }) => setVisible(showButton !== false))
        .catch(() => setVisible(true));
      chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'local' && changes.showButton) {
          setVisible(changes.showButton.newValue !== false);
        }
      });
    }
  }
})();
