// Editor state
let currentFile = null;
let dirty = false;
let username = null;
let treeData = [];

// DOM refs
const textarea    = document.getElementById('editor-textarea');
const preview     = document.getElementById('preview-content');
const filenameEl  = document.getElementById('current-filename');
const unsavedDot  = document.getElementById('unsaved-dot');
const fileTree    = document.getElementById('file-tree');
const toastEl     = document.getElementById('toast');
const modal       = document.getElementById('modal');
const modalTitle  = document.getElementById('modal-title');
const modalInput  = document.getElementById('modal-input');
const modalOk     = document.getElementById('modal-ok');
const modalCancel = document.getElementById('modal-cancel');

// Toast
let toastTimer;
function toast(msg, duration) {
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), duration || 2500);
}

// Modal
function showModal(title, placeholder, okLabel) {
  modalTitle.textContent = title;
  modalInput.value = '';
  modalInput.placeholder = placeholder || '';
  modalOk.textContent = okLabel || 'OK';
  modal.classList.remove('hidden');
  modalInput.focus();
  return new Promise((resolve) => {
    modalOk.onclick = () => { modal.classList.add('hidden'); resolve(modalInput.value.trim()); };
    modalCancel.onclick = () => { modal.classList.add('hidden'); resolve(null); };
  });
}

// Preview update
let previewTimer;
function updatePreview() {
  clearTimeout(previewTimer);
  previewTimer = setTimeout(() => {
    preview.innerHTML = '<div class="gemtext-preview">' + renderGemtext(textarea.value) + '</div>';
  }, 200);
}

// Mark dirty
textarea.addEventListener('input', () => {
  dirty = true;
  unsavedDot.style.display = 'inline';
  updatePreview();
});

// Warn on close if dirty
window.addEventListener('beforeunload', (e) => {
  if (dirty) { e.preventDefault(); e.returnValue = ''; }
});

// Ctrl+S to save
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 's') {
    e.preventDefault();
    saveFile();
  }
});

// Load file tree
async function loadTree() {
  try {
    treeData = await api.listFiles('');
    renderTree(treeData, fileTree, '');
  } catch (e) {
    if (e.status === 401) { window.location.href = '/login.html'; }
  }
}

function renderTree(items, container, prefix) {
  container.innerHTML = '';
  if (!items || items.length === 0) {
    container.innerHTML = '<div class="tree-empty">No files yet</div>';
    return;
  }
  // Dirs first, then files
  const sorted = [...items].sort((a, b) => {
    if (a.is_dir !== b.is_dir) return a.is_dir ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  for (const item of sorted) {
    const path = prefix ? prefix + '/' + item.name : item.name;
    const el = document.createElement('div');
    el.className = 'tree-item' + (item.is_dir ? ' is-dir' : '');
    el.dataset.path = path;
    el.innerHTML = '<span class="icon">' + (item.is_dir ? '📁' : '📄') + '</span>' + escHtml(item.name);
    if (!item.is_dir) {
      el.addEventListener('click', () => openFile(path, el));
    }
    container.appendChild(el);
  }
}

function escHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// Open file in editor
async function openFile(path, el) {
  if (dirty && !confirm('Discard unsaved changes?')) return;
  try {
    const content = await api.readFile(path);
    textarea.value = content;
    currentFile = path;
    dirty = false;
    unsavedDot.style.display = 'none';
    filenameEl.textContent = path;
    updatePreview();
    document.querySelectorAll('.tree-item').forEach(i => i.classList.remove('active'));
    if (el) el.classList.add('active');
  } catch (e) {
    toast('Could not open file');
  }
}

// Save current file
async function saveFile() {
  if (!currentFile) { toast('No file selected'); return; }
  try {
    await api.writeFile(currentFile, textarea.value);
    dirty = false;
    unsavedDot.style.display = 'none';
    toast('Saved');
  } catch (e) {
    const msg = e.error === 'LIMIT_EXCEEDED' ? 'Storage limit exceeded' : 'Save failed';
    toast(msg);
  }
}

// New file
async function newFile() {
  const name = await showModal('New file', 'e.g. posts/hello.gmi', 'Create');
  if (!name) return;
  const path = name.startsWith('/') ? name.slice(1) : name;
  try {
    await api.writeFile(path, '# ' + path + '\n');
    await loadTree();
    const el = document.querySelector('[data-path="' + path + '"]');
    openFile(path, el);
    toast('File created');
  } catch (e) {
    toast('Could not create file');
  }
}

// New folder
async function newFolder() {
  const name = await showModal('New folder', 'e.g. posts', 'Create');
  if (!name) return;
  try {
    await api.mkdir(name);
    await loadTree();
    toast('Folder created');
  } catch (e) {
    toast('Could not create folder');
  }
}

// Delete current file
async function deleteFile() {
  if (!currentFile) { toast('No file selected'); return; }
  if (!confirm('Delete ' + currentFile + '?')) return;
  try {
    await api.deleteFile(currentFile);
    currentFile = null;
    textarea.value = '';
    dirty = false;
    unsavedDot.style.display = 'none';
    filenameEl.textContent = 'No file open';
    preview.innerHTML = '';
    await loadTree();
    toast('Deleted');
  } catch (e) {
    toast('Delete failed');
  }
}

// Rename current file
async function renameFile() {
  if (!currentFile) { toast('No file selected'); return; }
  const newName = await showModal('Rename file', currentFile, 'Rename');
  if (!newName || newName === currentFile) return;
  try {
    await api.renameFile(currentFile, newName);
    currentFile = newName;
    filenameEl.textContent = newName;
    await loadTree();
    toast('Renamed');
  } catch (e) {
    toast('Rename failed');
  }
}

// Logout
async function logout() {
  await api.logout();
  window.location.href = '/login.html';
}

// Init
(async () => {
  // Check auth
  try {
    await api.listFiles('');
  } catch (e) {
    if (e.status === 401) { window.location.href = '/login.html'; return; }
  }
  await loadTree();
  updatePreview();
})();
