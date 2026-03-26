// Editor state
let currentFile = null;
let currentIsDir = false;
let dirty = false;
let username = null;
let treeData = [];
let expandedFolders = new Set();
let folderContents = {};
let dragSrc = null;

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

// Load file tree (also refreshes contents of expanded folders)
async function loadTree() {
  try {
    treeData = await api.listFiles('');
    for (const path of expandedFolders) {
      try {
        folderContents[path] = await api.listFiles(path);
      } catch(e) {
        expandedFolders.delete(path);
        delete folderContents[path];
      }
    }
    renderTree(treeData, fileTree, '');
    if (currentFile) {
      const activeEl = document.querySelector('[data-path="' + currentFile + '"]');
      if (activeEl) activeEl.classList.add('active');
    }
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
  renderTreeItems(items, container, prefix);
}

function renderTreeItems(items, container, prefix) {
  const depth = prefix ? prefix.split('/').length : 0;
  const sorted = [...items].sort((a, b) => {
    if (a.is_dir !== b.is_dir) return a.is_dir ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  for (const item of sorted) {
    const path = prefix ? prefix + '/' + item.name : item.name;
    const isExpanded = item.is_dir && expandedFolders.has(path);
    const el = document.createElement('div');
    el.className = 'tree-item' + (item.is_dir ? ' is-dir' : '');
    el.dataset.path = path;
    el.style.paddingLeft = (8 + depth * 16) + 'px';
    const icon = item.is_dir ? (isExpanded ? '📂' : '📁') : '📄';
    el.innerHTML = '<span class="icon">' + icon + '</span>' + escHtml(item.name);
    if (item.is_dir) {
      el.addEventListener('click', () => selectFolder(path));
      el.addEventListener('dragover', (e) => {
        if (!dragSrc || dragSrc === path) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        document.querySelectorAll('.drag-over').forEach(i => i.classList.remove('drag-over'));
        el.classList.add('drag-over');
      });
      el.addEventListener('dragleave', () => el.classList.remove('drag-over'));
      el.addEventListener('drop', async (e) => {
        e.preventDefault();
        el.classList.remove('drag-over');
        if (!dragSrc) return;
        const src = dragSrc;
        dragSrc = null;
        const basename = src.split('/').pop();
        const destPath = path + '/' + basename;
        if (destPath === src) return;
        try {
          await api.renameFile(src, destPath);
          if (currentFile === src) { currentFile = destPath; filenameEl.textContent = destPath; }
          if (!expandedFolders.has(path)) expandedFolders.add(path);
          delete folderContents[path];
          await loadTree();
          toast('Moved to ' + path + '/');
        } catch(e) { toast('Move failed'); }
      });
    } else {
      el.addEventListener('click', () => openFile(path));
      el.draggable = true;
      el.addEventListener('dragstart', (e) => {
        dragSrc = path;
        e.dataTransfer.effectAllowed = 'move';
      });
      el.addEventListener('dragend', () => {
        dragSrc = null;
        document.querySelectorAll('.drag-over').forEach(i => i.classList.remove('drag-over'));
      });
    }
    container.appendChild(el);
    // If expanded, render children inline (indented)
    if (item.is_dir && isExpanded && folderContents[path]) {
      renderTreeItems(folderContents[path], container, path);
    }
  }
}

function escHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// Select a folder: offer to save if dirty, then toggle expand/collapse
async function selectFolder(path) {
  if (dirty && currentFile && !currentIsDir) {
    if (!confirm('Save unsaved changes to "' + currentFile + '"?')) return;
    const ok = await saveFile();
    if (!ok) return;
  }

  currentFile = path;
  currentIsDir = true;
  filenameEl.textContent = path + '/';

  if (expandedFolders.has(path)) {
    expandedFolders.delete(path);
  } else {
    expandedFolders.add(path);
    if (!folderContents[path]) {
      try {
        folderContents[path] = await api.listFiles(path);
      } catch(e) {
        folderContents[path] = [];
      }
    }
  }

  renderTree(treeData, fileTree, '');
  const activeEl = document.querySelector('[data-path="' + path + '"]');
  if (activeEl) activeEl.classList.add('active');
}

// Open file in editor, auto-expanding parent folders so the file is visible
async function openFile(path) {
  if (dirty && !confirm('Discard unsaved changes?')) return;

  // Expand all ancestor folders so the file shows up in the tree
  const parts = path.split('/');
  let needsRender = false;
  for (let i = 1; i < parts.length; i++) {
    const folderPath = parts.slice(0, i).join('/');
    if (!expandedFolders.has(folderPath)) {
      expandedFolders.add(folderPath);
      if (!folderContents[folderPath]) {
        try {
          folderContents[folderPath] = await api.listFiles(folderPath);
        } catch(e) {
          folderContents[folderPath] = [];
        }
      }
      needsRender = true;
    }
  }
  if (needsRender) {
    renderTree(treeData, fileTree, '');
  }

  try {
    const content = await api.readFile(path);
    textarea.value = content;
    currentFile = path;
    currentIsDir = false;
    dirty = false;
    unsavedDot.style.display = 'none';
    filenameEl.textContent = path;
    updatePreview();
    document.querySelectorAll('.tree-item').forEach(i => i.classList.remove('active'));
    const activeEl = document.querySelector('[data-path="' + path + '"]');
    if (activeEl) activeEl.classList.add('active');
  } catch (e) {
    toast('Could not open file');
  }
}

// Save current file — returns true on success, false on failure
async function saveFile() {
  if (!currentFile || currentIsDir) { toast('No file selected'); return false; }
  try {
    await api.writeFile(currentFile, textarea.value);
    dirty = false;
    unsavedDot.style.display = 'none';
    toast('Saved');
    return true;
  } catch (e) {
    const msg = e.error === 'LIMIT_EXCEEDED' ? 'Storage limit exceeded' : 'Save failed';
    toast(msg);
    return false;
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
    await openFile(path);
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

// Delete current file or folder
async function deleteFile() {
  if (!currentFile) { toast('No file selected'); return; }
  const isDir = currentIsDir;
  const label = isDir
    ? 'folder "' + currentFile + '" and all its contents'
    : currentFile;
  if (!confirm('Delete ' + label + '?')) return;
  try {
    await api.deleteFile(currentFile);
    if (isDir) {
      expandedFolders.delete(currentFile);
      delete folderContents[currentFile];
    }
    currentFile = null;
    currentIsDir = false;
    filenameEl.textContent = 'No file open';
    if (!isDir) {
      textarea.value = '';
      dirty = false;
      unsavedDot.style.display = 'none';
      preview.innerHTML = '';
    }
    await loadTree();
    toast('Deleted');
  } catch (e) {
    toast('Delete failed');
  }
}

// Rename current file or folder
async function renameFile() {
  if (!currentFile) { toast('No file selected'); return; }
  const label = currentIsDir ? 'Rename folder' : 'Rename file';
  const newName = await showModal(label, currentFile, 'Rename');
  if (!newName || newName === currentFile) return;
  try {
    await api.renameFile(currentFile, newName);
    if (currentIsDir) {
      // Update cached expanded-folder state to reflect the new path
      const oldPrefix = currentFile + '/';
      const newPrefix = newName + '/';
      for (const path of [...expandedFolders]) {
        if (path === currentFile) {
          expandedFolders.delete(path);
          expandedFolders.add(newName);
        } else if (path.startsWith(oldPrefix)) {
          expandedFolders.delete(path);
          expandedFolders.add(newPrefix + path.slice(oldPrefix.length));
        }
      }
      for (const path of Object.keys(folderContents)) {
        if (path === currentFile) {
          folderContents[newName] = folderContents[path];
          delete folderContents[path];
        } else if (path.startsWith(oldPrefix)) {
          folderContents[newPrefix + path.slice(oldPrefix.length)] = folderContents[path];
          delete folderContents[path];
        }
      }
      toast('Folder renamed. Links to files inside may be broken.', 4000);
    } else {
      toast('Renamed');
    }
    currentFile = newName;
    filenameEl.textContent = currentIsDir ? newName + '/' : newName;
    await loadTree();
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
