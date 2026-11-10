const MIME_EXT = {
  'application/pdf': 'pdf',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.ms-powerpoint': 'ppt',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/zip': 'zip',
  'application/x-zip-compressed': 'zip',
  'application/rtf': 'rtf',
  'text/plain': 'txt',
  'text/csv': 'csv',
  'text/html': 'html',
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/svg+xml': 'svg',
  'video/mp4': 'mp4',
  'audio/mpeg': 'mp3',
};

// Strip characters the downloads API rejects in filenames.
function sanitize(name) {
  return (name || '')
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_')
    .replace(/^[.\s]+|[.\s]+$/g, '')
    .slice(0, 200);
}

function hasExtension(name) {
  return /\.[A-Za-z][A-Za-z0-9]{1,7}$/.test(name);
}

function nameFromDisposition(disposition) {
  if (!disposition) return '';
  const utf8 = disposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8) {
    try {
      return decodeURIComponent(utf8[1].trim());
    } catch {}
  }
  const plain = disposition.match(/filename="?([^";]+)"?/i);
  return plain ? plain[1].trim() : '';
}

function nameFromUrl(url) {
  try {
    const last = new URL(url).pathname.split('/').filter(Boolean).pop() || '';
    return decodeURIComponent(last);
  } catch {
    return '';
  }
}

function extFromBytes(bytes) {
  if (!bytes || bytes.length < 4) return '';
  const head = String.fromCharCode(...bytes.slice(0, 4));
  if (head === '%PDF') return 'pdf';
  if (head === '\x89PNG') return 'png';
  if (head.startsWith('\xff\xd8\xff')) return 'jpg';
  if (head.startsWith('GIF8')) return 'gif';
  return '';
}

// Ask the server what the file is: read the headers and the first chunk, then stop.
async function probe(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(url, { credentials: 'include', signal: controller.signal });
    const mime = (res.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
    const name = nameFromDisposition(res.headers.get('content-disposition'));
    let ext = MIME_EXT[mime] || '';
    if (!ext && res.body) {
      const { value } = await res.body.getReader().read();
      ext = extFromBytes(value);
    }
    return { name, ext };
  } catch {
    return { name: '', ext: '' };
  } finally {
    clearTimeout(timer);
    controller.abort();
  }
}

async function resolveFilename({ url, filename, isPdf }) {
  let name = sanitize(filename);
  if (hasExtension(name)) return name;

  let ext = isPdf ? 'pdf' : '';
  if (!name || !ext) {
    const info = await probe(url);
    if (!name) name = sanitize(info.name);
    if (hasExtension(name)) return name;
    ext = ext || info.ext;
  }

  if (!name) name = sanitize(nameFromUrl(url)) || 'download';
  if (hasExtension(name) || !ext) return name;
  return `${name}.${ext}`;
}

async function download(msg) {
  const filename = await resolveFilename(msg);
  try {
    await chrome.downloads.download({ url: msg.url, filename });
  } catch {
    // Fall back to the browser's own naming if the filename is rejected.
    await chrome.downloads.download({ url: msg.url });
  }
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.action === 'download' && msg.url) {
    download(msg);
  }
});
