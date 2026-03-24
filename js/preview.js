// Gemtext renderer — converts gemtext to HTML
function renderGemtext(text) {
  const lines = text.split('\n');
  let html = '';
  let inPre = false;
  let inList = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Preformatted toggle
    if (line.startsWith('```')) {
      if (inList) { html += '</ul>'; inList = false; }
      if (inPre) {
        html += '</pre>';
        inPre = false;
      } else {
        const alt = escHtml(line.slice(3).trim());
        html += '<pre' + (alt ? ' title="' + alt + '"' : '') + '>';
        inPre = true;
      }
      continue;
    }

    if (inPre) {
      html += escHtml(line) + '\n';
      continue;
    }

    // Close list if needed
    if (!line.startsWith('* ') && inList) {
      html += '</ul>';
      inList = false;
    }

    if (line.startsWith('### ')) {
      html += '<h3>' + escHtml(line.slice(4)) + '</h3>';
    } else if (line.startsWith('## ')) {
      html += '<h2>' + escHtml(line.slice(3)) + '</h2>';
    } else if (line.startsWith('# ')) {
      html += '<h1>' + escHtml(line.slice(2)) + '</h1>';
    } else if (line.startsWith('=> ')) {
      const parts = line.slice(3).trimStart().split(/\s+/);
      const url = parts[0] || '';
      const label = parts.slice(1).join(' ') || url;
      const safeUrl = url.startsWith('gemini://') ? '#' : escHtml(url);
      const title = url.startsWith('gemini://') ? ' title="gemini:// link — open in a Gemini browser"' : '';
      html += '<a class="gmi-link" href="' + safeUrl + '"' + title + '>' + escHtml(label) + '</a>';
    } else if (line.startsWith('* ')) {
      if (!inList) { html += '<ul>'; inList = true; }
      html += '<li>' + escHtml(line.slice(2)) + '</li>';
    } else if (line.startsWith('> ')) {
      html += '<blockquote>' + escHtml(line.slice(2)) + '</blockquote>';
    } else if (line.trim() === '') {
      html += '<br>';
    } else {
      html += '<p>' + escHtml(line) + '</p>';
    }
  }

  if (inList) html += '</ul>';
  if (inPre) html += '</pre>';

  return html;
}

function escHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
