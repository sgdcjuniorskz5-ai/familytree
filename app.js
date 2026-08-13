// Main Application Controller - Family Tree Builder
// (Plain script version - no ES module imports needed)

// --- Utility Functions ---

function generateId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for older browsers
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(str));
  return div.innerHTML;
}

function escapeAttr(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function sanitizeDate(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return '';
  const match = dateStr.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (!match) return '';
  const [, y, m, d] = match;
  const year = parseInt(y, 10);
  const month = parseInt(m, 10);
  const day = parseInt(d, 10);
  if (year < 1 || year > 9999 || month < 1 || month > 12 || day < 1 || day > 31) return '';
  // Validate days per month
  const daysInMonth = [31, (year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (day > daysInMonth[month - 1]) return '';
  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
}

function renderAvatarHtml(firstName, lastName, avatarUrl, size) {
  const s = size || 32;
  const fs = Math.max(10, Math.round(s * 0.35));
  const initials = escapeHtml(firstName.charAt(0) + (lastName ? lastName.charAt(0) : ''));
  if (avatarUrl) {
    const safeUrl = escapeAttr(avatarUrl);
    const fallbackStyle = `display:flex;align-items:center;justify-content:center;background:#cbd5e1;color:#475569;font-weight:700;font-size:${fs}px;width:${s}px;height:${s}px;border-radius:50%;flex-shrink:0;`;
    return `<img src="${safeUrl}" class="relation-avatar" style="width:${s}px;height:${s}px;" alt="" onerror="var d=document.createElement('div');d.className='relation-avatar';d.style.cssText='${fallbackStyle}';d.textContent='${initials}';this.replaceWith(d)">`;
  }
  return `<div class="relation-avatar" style="display:flex;align-items:center;justify-content:center;background:#cbd5e1;color:#475569;font-weight:700;font-size:${fs}px;width:${s}px;height:${s}px;border-radius:50%;flex-shrink:0;">${initials}</div>`;
}

// --- Toast Notification System ---
function showToast(message, type = 'info', duration = 3000) {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const icons = { success: 'fa-check-circle', error: 'fa-exclamation-circle', info: 'fa-info-circle', warning: 'fa-exclamation-triangle' };
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<i class="fas ${icons[type] || icons.info} toast-icon"></i><span class="toast-msg">${escapeHtml(message)}</span><button class="toast-close"><i class="fas fa-times"></i></button>`;
  toast.querySelector('.toast-close').addEventListener('click', () => removeToast(toast));
  container.appendChild(toast);
  if (duration > 0) setTimeout(() => removeToast(toast), duration);
  return toast;
}

function removeToast(toast) {
  if (!toast || toast.classList.contains('removing')) return;
  toast.classList.add('removing');
  setTimeout(() => toast.remove(), 300);
}

function showToastConfirm(message, onConfirm, onCancel) {
  const container = document.getElementById('toast-container');
  if (!container) { if (onCancel) onCancel(); return; }
  const toast = document.createElement('div');
  toast.className = 'toast warning';
  toast.style.pointerEvents = 'auto';
  toast.innerHTML = `<i class="fas fa-exclamation-triangle toast-icon"></i><span class="toast-msg">${escapeHtml(message)}</span>
    <button class="btn btn-danger" style="height:28px;padding:0 10px;font-size:11px;border-radius:6px;">Да</button>
    <button class="btn" style="height:28px;padding:0 10px;font-size:11px;border-radius:6px;">Нет</button>`;
  toast.querySelectorAll('button')[0].addEventListener('click', () => { removeToast(toast); if (onConfirm) onConfirm(); });
  toast.querySelectorAll('button')[1].addEventListener('click', () => { removeToast(toast); if (onCancel) onCancel(); });
  container.appendChild(toast);
}

// --- Undo/Redo System ---
const undoStack = [];
const redoStack = [];
const MAX_UNDO = 50;

function pushUndo(description) {
  undoStack.push({
    snapshot: JSON.parse(JSON.stringify(state.members)),
    focusedId: state.focusedPersonId,
    selectedId: state.selectedPersonId,
    description
  });
  if (undoStack.length > MAX_UNDO) undoStack.shift();
  redoStack.length = 0;
  updateUndoRedoUI();
}

function undo() {
  if (undoStack.length === 0) return;
  redoStack.push({
    snapshot: JSON.parse(JSON.stringify(state.members)),
    focusedId: state.focusedPersonId,
    selectedId: state.selectedPersonId,
    description: 'redo'
  });
  const action = undoStack.pop();
  state.members = action.snapshot;
  state.focusedPersonId = action.focusedId;
  state.selectedPersonId = action.selectedId;
  saveState();
  updateAndRender();
  renderSidebarProfile();
  updateUndoRedoUI();
  showToast('Отменено: ' + (action.description || 'действие'), 'info', 2000);
}

function redo() {
  if (redoStack.length === 0) return;
  undoStack.push({
    snapshot: JSON.parse(JSON.stringify(state.members)),
    focusedId: state.focusedPersonId,
    selectedId: state.selectedPersonId,
    description: 'undo'
  });
  const action = redoStack.pop();
  state.members = action.snapshot;
  state.focusedPersonId = action.focusedId;
  state.selectedPersonId = action.selectedId;
  saveState();
  updateAndRender();
  renderSidebarProfile();
  updateUndoRedoUI();
  showToast('Повторено', 'info', 2000);
}

function updateUndoRedoUI() {
  const bar = document.querySelector('.undo-redo-bar');
  if (!bar) return;
  bar.querySelector('[data-action="undo"]').disabled = undoStack.length === 0;
  bar.querySelector('[data-action="redo"]').disabled = redoStack.length === 0;
  const uc = bar.querySelector('.undo-count');
  const rc = bar.querySelector('.redo-count');
  if (uc) uc.textContent = undoStack.length > 0 ? undoStack.length : '';
  if (rc) rc.textContent = redoStack.length > 0 ? redoStack.length : '';
}

// --- Keyboard Shortcuts ---
function initKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    const target = e.target;
    const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT';
    
    // Ctrl+Z / Cmd+Z = Undo
    if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
      if (!isInput) { e.preventDefault(); undo(); return; }
    }
    // Ctrl+Y / Cmd+Shift+Z = Redo
    if (((e.ctrlKey || e.metaKey) && e.key === 'y') || ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'z') || ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'Z')) {
      if (!isInput) { e.preventDefault(); redo(); return; }
    }
    // Escape = close sidebar / modals / cancel selection
    if (e.key === 'Escape') {
      if (state.selectionMode.active) { cancelSelectionMode(); return; }
      if (massMode) { exitMassMode(); return; }
      const openModal = document.querySelector('.modal-overlay.open');
      if (openModal) { closeModal(openModal.id); return; }
      if (document.getElementById('sidebar').classList.contains('open')) { closeSidebar(); return; }
    }
    // Delete / Backspace = delete selected person (when not in input)
    if ((e.key === 'Delete' || e.key === 'Backspace') && !isInput) {
      if (state.selectedPersonId && state.members.length > 0) {
        e.preventDefault();
        const m = state.members.find(x => x.id === state.selectedPersonId);
        if (m) {
          showToastConfirm(`Удалить ${m.firstName} ${m.lastName}?`, () => {
            pushUndo('Удаление ' + m.firstName + ' ' + m.lastName);
            deleteMember(state.selectedPersonId);
          });
        }
      }
    }
  });
}

// Application State
let state = {
  members: [],
  focusedPersonId: "",
  selectedPersonId: "",
  theme: "dark",
  selectionMode: {
    active: false,
    type: "", // 'father', 'mother', 'spouse', 'child'
    sourceId: ""
  }
};

// --- User Authentication ---
const AUTH_KEY = 'family_tree_users';
const SESSION_KEY = 'family_tree_session';

async function hashPassword(password, salt) {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );
  const hash = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: encoder.encode(salt),
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    256
  );
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function generateSalt() {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('');
}

function getUsers() {
  const users = localStorage.getItem(AUTH_KEY);
  return users ? JSON.parse(users) : {};
}

function saveUsers(users) {
  localStorage.setItem(AUTH_KEY, JSON.stringify(users));
}

function getCurrentUser() {
  const session = localStorage.getItem(SESSION_KEY);
  return session ? JSON.parse(session) : null;
}

function setCurrentUser(username) {
  localStorage.setItem(SESSION_KEY, JSON.stringify({ username, loginTime: Date.now() }));
}

function clearCurrentUser() {
  localStorage.removeItem(SESSION_KEY);
}

async function registerUser(username, password) {
  const users = getUsers();
  if (users[username]) {
    throw new Error('Пользователь уже существует');
  }
  const salt = generateSalt();
  const passwordHash = await hashPassword(password, salt);
  users[username] = { salt, passwordHash, createdAt: Date.now() };
  saveUsers(users);
  return true;
}

async function loginUser(username, password) {
  const users = getUsers();
  const user = users[username];
  if (!user) {
    throw new Error('Пользователь не найден');
  }
  const passwordHash = await hashPassword(password, user.salt);
  if (passwordHash !== user.passwordHash) {
    throw new Error('Неверный пароль');
  }
  setCurrentUser(username);
  return true;
}

function logoutUser() {
  clearCurrentUser();
  location.reload();
}

function getUserDataKey(username) {
  return `family_tree_state_${username}`;
}

function loadState() {
  const currentUser = getCurrentUser();
  if (!currentUser) {
    showAuthModal();
    return;
  }
  
  const saved = localStorage.getItem(getUserDataKey(currentUser.username));
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      state.members = parsed.members || [];
      state.focusedPersonId = parsed.focusedPersonId || "";
      state.selectedPersonId = parsed.selectedPersonId || parsed.focusedPersonId || "";
      state.theme = parsed.theme || "dark";
    } catch (e) {
      console.error("Failed to load local state, using samples", e);
      loadSampleData();
    }
  } else {
    loadSampleData();
  }

  if (!state.selectedPersonId && state.focusedPersonId) {
    state.selectedPersonId = state.focusedPersonId;
  }
}

function saveState() {
  const currentUser = getCurrentUser();
  if (!currentUser) return;
  
  localStorage.setItem(getUserDataKey(currentUser.username), JSON.stringify({
    members: state.members,
    focusedPersonId: state.focusedPersonId,
    selectedPersonId: state.selectedPersonId,
    theme: state.theme
  }));
}

// Layout coordinates
let currentLayout = null;

// Mass selection state
let massMode = false;
let selectedIds = new Set();
// Expose to window for tree-renderer.js
window._massSelectionMode = false;
window._selectedIds = selectedIds;

// Search keyboard navigation state
let searchHighlightIndex = -1;

// Initialize Application
document.addEventListener('DOMContentLoaded', () => {
  loadState();
  initTheme();
  initUIEvents();
  
  // Initialize Renderer
  initTreeRenderer(
    'canvas-container', 
    'tree-canvas', 
    handleNodeSelect, 
    handleNodeFocus
  );

  // Initial draw
  updateAndRender();
  initKeyboardShortcuts();
  
  // Center initial node
  if (state.focusedPersonId) {
    setTimeout(() => {
      centerNode(state.focusedPersonId, currentLayout);
    }, 200);
  }
});

// Load state from LocalStorage or default sample data
function loadState() {
  const saved = localStorage.getItem('family_tree_state');
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      state.members = parsed.members || [];
      state.focusedPersonId = parsed.focusedPersonId || "";
      state.selectedPersonId = parsed.selectedPersonId || parsed.focusedPersonId || "";
      state.theme = parsed.theme || "dark";
    } catch (e) {
      console.error("Failed to load local state, using samples", e);
      loadSampleData();
    }
  } else {
    loadSampleData();
  }

  // Set default selection
  if (!state.selectedPersonId && state.focusedPersonId) {
    state.selectedPersonId = state.focusedPersonId;
  }
}

function loadSampleData() {
  state.members = JSON.parse(JSON.stringify(SAMPLE_MEMBERS));
  state.focusedPersonId = "1"; // Arthur Althaus
  state.selectedPersonId = "1";
  saveState();
}

function saveState() {
  localStorage.setItem('family_tree_state', JSON.stringify({
    members: state.members,
    focusedPersonId: state.focusedPersonId,
    selectedPersonId: state.selectedPersonId,
    theme: state.theme
  }));
}

// Themes System
function initTheme() {
  document.documentElement.setAttribute('data-theme', state.theme);
  const themeBtn = document.getElementById('theme-toggle');
  updateThemeIcon(themeBtn);

  themeBtn.addEventListener('click', () => {
    state.theme = state.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', state.theme);
    updateThemeIcon(themeBtn);
    saveState();
  });
}

function updateThemeIcon(btn) {
  if (state.theme === 'dark') {
    btn.innerHTML = '<i class="fas fa-sun"></i>';
    btn.setAttribute('data-tooltip', 'Светлая тема');
  } else {
    btn.innerHTML = '<i class="fas fa-moon"></i>';
    btn.setAttribute('data-tooltip', 'Темная тема');
  }
}

// Perform layout calculations and update SVG canvas
function updateAndRender() {
  if (state.members.length === 0) return;
  
  // If focus person deleted, find another root
  if (!state.members.some(m => m.id === state.focusedPersonId)) {
    state.focusedPersonId = state.members[0].id;
    state.selectedPersonId = state.focusedPersonId;
  }

  currentLayout = calculateTreeLayout(state.members, state.focusedPersonId);
  renderTree(state.members, currentLayout, state.focusedPersonId);
  
  // Also select correct card in tree UI
  highlightSelectedCard();
}

function highlightSelectedCard() {
  document.querySelectorAll('.card-node').forEach(node => {
    node.classList.remove('selected-active');
    if (node.getAttribute('data-id') === state.selectedPersonId) {
      node.classList.add('selected-active');
    }
  });
}

// Handle card click (selects node to show in sidebar)
function handleNodeSelect(id) {
  if (state.selectionMode.active) {
    executeLinking(id);
    return;
  }

  state.selectedPersonId = id;
  highlightSelectedCard();
  openSidebar();
  renderSidebarProfile();
}

// Handle card double-click / focus button click (re-centers tree layout)
function handleNodeFocus(id) {
  state.focusedPersonId = id;
  state.selectedPersonId = id;
  saveState();
  updateAndRender();
  centerNode(id, currentLayout);
  renderSidebarProfile();
  openSidebar();
}

// --- UI Interaction Handlers ---
function initUIEvents() {
  // Zoom & Pan Buttons
  document.getElementById('zoom-in').addEventListener('click', () => {
    simulateZoom(1.2);
  });
  document.getElementById('zoom-out').addEventListener('click', () => {
    simulateZoom(0.8);
  });
  document.getElementById('zoom-fit').addEventListener('click', () => {
    resetView(currentLayout);
  });
  document.getElementById('recenter-node').addEventListener('click', () => {
    centerNode(state.focusedPersonId, currentLayout);
  });
  document.getElementById('toggle-drag-mode').addEventListener('click', () => {
    toggleDragMode();
  });

  // Sidebar Controls
  document.getElementById('close-sidebar').addEventListener('click', closeSidebar);
  
  // Tabs switching
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const tabId = e.target.getAttribute('data-tab');
      switchTab(tabId);
    });
  });

  // Sidebar Editing Form Submit
  document.getElementById('edit-profile-form').addEventListener('submit', (e) => {
    e.preventDefault();
    saveProfileEdits();
  });

  // Sidebar Delete Member Button
  document.getElementById('delete-member-btn').addEventListener('click', () => {
    const m = state.members.find(x => x.id === state.selectedPersonId);
    if (!m) return;
    showToastConfirm(`Удалить ${m.firstName} ${m.lastName} и все связи?`, () => {
      pushUndo('Удаление ' + m.firstName + ' ' + m.lastName);
      deleteMember(state.selectedPersonId);
      showToast('Участник удалён', 'success');
    });
  });

  // Header Search Input
  const searchInput = document.getElementById('search-input');
  const searchDropdown = document.getElementById('search-dropdown');
  
  searchInput.addEventListener('input', (e) => {
    const q = e.target.value.toLowerCase().trim();
    searchHighlightIndex = -1;
    if (!q) {
      searchDropdown.style.display = 'none';
      return;
    }

    const filtered = state.members.filter(m => 
      `${m.firstName} ${m.lastName}`.toLowerCase().includes(q) ||
      `${m.lastName} ${m.firstName}`.toLowerCase().includes(q) ||
      (m.maidenName && m.maidenName.toLowerCase().includes(q)) ||
      (m.occupation && m.occupation.toLowerCase().includes(q))
    );

    // Deduplicate by firstName+lastName+birthDate
    const seen = new Set();
    const unique = filtered.filter(m => {
      const key = `${(m.firstName||'').toLowerCase()}_${(m.lastName||'').toLowerCase()}_${m.birthDate||''}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    renderSearchDropdown(unique);
  });

  searchInput.addEventListener('keydown', (e) => {
    const items = searchDropdown.querySelectorAll('.search-item');
    if (!items.length || searchDropdown.style.display === 'none') return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      searchHighlightIndex = Math.min(searchHighlightIndex + 1, items.length - 1);
      updateSearchHighlight(items);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      searchHighlightIndex = Math.max(searchHighlightIndex - 1, 0);
      updateSearchHighlight(items);
    } else if (e.key === 'Enter' && searchHighlightIndex >= 0) {
      e.preventDefault();
      items[searchHighlightIndex].click();
    } else if (e.key === 'Escape') {
      searchDropdown.style.display = 'none';
      searchInput.blur();
    }
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-box')) {
      searchDropdown.style.display = 'none';
    }
  });

  // Floating button & header action
  document.getElementById('add-unconnected-btn').addEventListener('click', () => openNewMemberModal());
  document.getElementById('add-unconnected-menu-btn').addEventListener('click', () => openNewMemberModal());

  // JSON Import / Export
  document.getElementById('export-json-btn').addEventListener('click', exportJSON);
  document.getElementById('import-json-input').addEventListener('change', importJSON);
  document.getElementById('export-png-btn').addEventListener('click', exportPNG);
  document.getElementById('export-svg-btn').addEventListener('click', exportSVG);
  document.getElementById('reset-tree-btn').addEventListener('click', () => {
    showToastConfirm('Сбросить древо и загрузить демо-данные?', () => {
      pushUndo('Сброс до демо-данных');
      loadSampleData();
      updateAndRender();
      resetView(currentLayout);
      renderSidebarProfile();
      showToast('Древо сброшено', 'info');
    });
  });

  // Selection Banner Cancel
  document.getElementById('cancel-selection-btn').addEventListener('click', cancelSelectionMode);

  // Mass Selection Controls
  document.getElementById('mass-select-toggle-btn').addEventListener('click', toggleMassMode);
  document.getElementById('mass-select-all-btn').addEventListener('click', selectAllMembers);
  document.getElementById('mass-delete-btn').addEventListener('click', massDeleteMembers);
  document.getElementById('mass-cancel-btn').addEventListener('click', exitMassMode);

  // User Account Button
  document.getElementById('user-account-btn').addEventListener('click', () => {
    const user = getCurrentUser();
    if (user) {
      showToastConfirm(`Вы вошли как "${user.username}". Выйти?`, logoutUser);
    } else {
      showAuthModal();
    }
  });

  // Modals Buttons
  initModalTriggers();
}

function simulateZoom(scaleMultiplier) {
  const canvas = document.getElementById('tree-canvas');
  const zoomGroup = canvas.querySelector('#zoom-group');

  // Access the shared transformState exposed by tree-renderer
  const ts = getTransformState();
  const rect = canvas.getBoundingClientRect();
  const mouseX = rect.width / 2;
  const mouseY = rect.height / 2;

  let nextK = ts.k * scaleMultiplier;
  nextK = Math.max(0.15, Math.min(2.5, nextK));

  ts.x = mouseX - (mouseX - ts.x) * (nextK / ts.k);
  ts.y = mouseY - (mouseY - ts.y) * (nextK / ts.k);
  ts.k = nextK;

  setTransformState(ts);
  zoomGroup.setAttribute('transform', `translate(${ts.x}, ${ts.y}) scale(${ts.k})`);
}

// --- Search Dropdown Rendering ---
function renderSearchDropdown(items) {
  const dropdown = document.getElementById('search-dropdown');
  dropdown.innerHTML = '';

  if (items.length === 0) {
    dropdown.innerHTML = '<div style="padding: 10px 15px; font-size:13px; color:var(--text-muted)">Ничего не найдено</div>';
    dropdown.style.display = 'block';
    return;
  }

  items.slice(0, 8).forEach(item => {
    const itemEl = document.createElement('div');
    itemEl.className = 'search-item';
    
    const avatarHtml = renderAvatarHtml(item.firstName, item.lastName, item.avatar, 32);

    const birthYear = item.birthDate ? new Date(item.birthDate + 'T00:00:00').getFullYear() : '???';
    const deathYear = item.deathDate ? new Date(item.deathDate + 'T00:00:00').getFullYear() : (item.deathDate === "" ? "" : '???');
    const lifeStr = deathYear === "" ? `р. ${birthYear}` : `${birthYear} — ${deathYear}`;

    itemEl.innerHTML = `
      ${avatarHtml}
      <div class="search-item-info">
        <h5>${escapeHtml(item.firstName)} ${escapeHtml(item.lastName)}</h5>
        <p>${escapeHtml(lifeStr)} • ${escapeHtml(item.occupation || 'Родственник')}</p>
      </div>
    `;

    itemEl.addEventListener('click', () => {
      dropdown.style.display = 'none';
      document.getElementById('search-input').value = '';
      
      // Select and center
      handleNodeSelect(item.id);
      
      // If the node is not in current active 5-generation layout, focus on them
      if (!currentLayout.nodes.some(n => n.id === item.id)) {
        handleNodeFocus(item.id);
      } else {
        centerNode(item.id, currentLayout);
      }
    });

    dropdown.appendChild(itemEl);
  });

  dropdown.style.display = 'block';
}

function updateSearchHighlight(items) {
  items.forEach((item, i) => {
    item.classList.toggle('highlighted', i === searchHighlightIndex);
  });
  if (searchHighlightIndex >= 0 && items[searchHighlightIndex]) {
    items[searchHighlightIndex].scrollIntoView({ block: 'nearest' });
  }
}

// --- Sidebar Open / Close ---
function openSidebar() {
  document.getElementById('sidebar').classList.add('open');
}

function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
}

function switchTab(tabId) {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-tab') === tabId);
  });
  document.querySelectorAll('.tab-panel').forEach(panel => {
    panel.classList.toggle('active', panel.id === `tab-${tabId}`);
  });

  if (tabId === 'edit') {
    populateEditForm();
  } else if (tabId === 'relations') {
    renderRelationsTab();
  }
}

// --- Render Sidebar tabs ---
function renderSidebarProfile() {
  const m = state.members.find(x => x.id === state.selectedPersonId);
  if (!m) return;

  // Header Details
  document.getElementById('sidebar-title').innerText = `${m.firstName} ${m.lastName}`;
  
  // Large Avatar
  const avatarEl = document.getElementById('profile-avatar-large');
  const initials = m.firstName.charAt(0) + (m.lastName ? m.lastName.charAt(0) : '');
  if (m.avatar) {
    avatarEl.src = m.avatar;
    avatarEl.style.display = 'block';
    // Fallback if URL is broken
    avatarEl.onerror = () => {
      avatarEl.style.display = 'none';
      document.getElementById('profile-avatar-initials').style.display = 'flex';
      document.getElementById('profile-avatar-initials').innerText = initials;
    };
    document.getElementById('profile-avatar-initials').style.display = 'none';
  } else {
    avatarEl.style.display = 'none';
    document.getElementById('profile-avatar-initials').style.display = 'flex';
    document.getElementById('profile-avatar-initials').innerText = initials;
  }

  // Basic Info
  document.getElementById('profile-name').innerText = `${m.firstName} ${m.lastName}`;
  document.getElementById('profile-maiden').innerText = m.maidenName ? `(${m.maidenName})` : '';
  
  const birthYear = m.birthDate ? new Date(m.birthDate + 'T00:00:00').getFullYear() : '???';
  const deathYear = m.deathDate ? new Date(m.deathDate + 'T00:00:00').getFullYear() : (m.deathDate === "" ? "" : '???');
  const lifeStr = deathYear === "" ? `р. ${birthYear}` : `${birthYear} — ${deathYear}`;
  document.getElementById('profile-life-years').innerText = lifeStr;

  // Metadata Grid
  document.getElementById('profile-gender').innerText = m.gender === 'male' ? 'Мужской' : (m.gender === 'female' ? 'Женский' : 'Другой/Не указан');
  document.getElementById('profile-birth').innerText = `${m.birthDate ? formatDate(m.birthDate) : 'Неизвестно'}${m.birthPlace ? ` (${m.birthPlace})` : ''}`;
  
  const deathPanel = document.getElementById('profile-death-item');
  if (m.deathDate || m.deathPlace) {
    deathPanel.style.display = 'flex';
    document.getElementById('profile-death').innerText = `${m.deathDate ? formatDate(m.deathDate) : 'Неизвестно'}${m.deathPlace ? ` (${m.deathPlace})` : ''}`;
  } else {
    deathPanel.style.display = 'none';
  }

  document.getElementById('profile-job').innerText = m.occupation || 'Не указана';
  document.getElementById('profile-bio-text').innerText = m.bio || 'Биография отсутствует.';

  // Immediate Family Links inside Profile Tab
  renderProfileTabRelations(m);
  
  // Make sure we're on the profile tab on selection change
  switchTab('profile');
}

function renderProfileTabRelations(m) {
  const container = document.getElementById('profile-relations-list');
  container.innerHTML = '';

  const relations = [];

  // Father
  if (m.fatherId) {
    const f = state.members.find(x => x.id === m.fatherId);
    if (f) relations.push({ person: f, role: 'Отец' });
  }
  // Mother
  if (m.motherId) {
    const mother = state.members.find(x => x.id === m.motherId);
    if (mother) relations.push({ person: mother, role: 'Мать' });
  }
  // Spouses
  if (m.spouses && m.spouses.length > 0) {
    m.spouses.forEach(s => {
      const sp = state.members.find(x => x.id === s.id);
      if (sp) relations.push({ person: sp, role: sp.gender === 'male' ? 'Муж' : 'Жена' });
    });
  }
  // Children
  const children = state.members.filter(x => x.fatherId === m.id || x.motherId === m.id);
  children.forEach(c => {
    relations.push({ person: c, role: c.gender === 'male' ? 'Сын' : 'Дочь' });
  });

  if (relations.length === 0) {
    container.innerHTML = '<p style="font-size:12px; color:var(--text-muted)">Нет связей в древе</p>';
    return;
  }

  relations.forEach(rel => {
    const item = document.createElement('div');
    item.className = 'relation-item';
    
    const avatarHtml = renderAvatarHtml(rel.person.firstName, rel.person.lastName, rel.person.avatar, 28);

    item.innerHTML = `
      <div class="relation-item-left">
        ${avatarHtml}
        <div class="relation-info">
          <h5>${escapeHtml(rel.person.firstName)} ${escapeHtml(rel.person.lastName)}</h5>
          <p>${rel.person.birthDate ? new Date(rel.person.birthDate + 'T00:00:00').getFullYear() : '???'}</p>
        </div>
      </div>
      <span class="relation-badge">${escapeHtml(rel.role)}</span>
    `;

    item.addEventListener('click', () => {
      handleNodeSelect(rel.person.id);
      centerNode(rel.person.id, currentLayout);
    });

    container.appendChild(item);
  });
}

// --- Populate Edit Profile Form ---
function populateEditForm() {
  const m = state.members.find(x => x.id === state.selectedPersonId);
  if (!m) return;

  document.getElementById('edit-firstName').value = m.firstName || '';
  document.getElementById('edit-lastName').value = m.lastName || '';
  document.getElementById('edit-maidenName').value = m.maidenName || '';
  document.getElementById('edit-gender').value = m.gender || 'male';
  document.getElementById('edit-birthDate').value = m.birthDate || '';
  document.getElementById('edit-birthPlace').value = m.birthPlace || '';
  document.getElementById('edit-deathDate').value = m.deathDate || '';
  document.getElementById('edit-deathPlace').value = m.deathPlace || '';
  document.getElementById('edit-occupation').value = m.occupation || '';
  document.getElementById('edit-bio').value = m.bio || '';
  document.getElementById('edit-avatar').value = m.avatar || '';

  const avatarPreview = document.getElementById('edit-avatar-preview');
  avatarPreview.src = m.avatar || 'https://via.placeholder.com/150';
}

function saveProfileEdits() {
  const id = state.selectedPersonId;
  const index = state.members.findIndex(m => m.id === id);
  if (index === -1) return;

  const form = document.getElementById('edit-profile-form');
  if (!validateForm(form)) return;

  const m = state.members[index];

  m.firstName = document.getElementById('edit-firstName').value.trim();
  m.lastName = document.getElementById('edit-lastName').value.trim();
  m.maidenName = document.getElementById('edit-maidenName').value.trim();
  m.gender = document.getElementById('edit-gender').value;
  m.birthDate = sanitizeDate(document.getElementById('edit-birthDate').value);
  m.birthPlace = document.getElementById('edit-birthPlace').value.trim();
  m.deathDate = sanitizeDate(document.getElementById('edit-deathDate').value);
  m.deathPlace = document.getElementById('edit-deathPlace').value.trim();
  m.occupation = document.getElementById('edit-occupation').value.trim();
  m.bio = document.getElementById('edit-bio').value.trim();
  m.avatar = document.getElementById('edit-avatar').value.trim();

  saveState();
  updateAndRender();
  renderSidebarProfile();
  showToast('Профиль обновлён', 'success');
}

// --- Delete Member ---
function deleteMember(id) {
  // Remove reference in other people's parent/spouse relationships
  state.members.forEach(m => {
    if (m.fatherId === id) m.fatherId = "";
    if (m.motherId === id) m.motherId = "";
    if (m.spouses) {
      m.spouses = m.spouses.filter(sp => sp.id !== id);
    }
  });

  // Remove member
  state.members = state.members.filter(m => m.id !== id);
  
  saveState();
  
  if (state.members.length > 0) {
    state.focusedPersonId = state.members[0].id;
    state.selectedPersonId = state.members[0].id;
    updateAndRender();
    renderSidebarProfile();
    resetView(currentLayout);
  } else {
    state.focusedPersonId = "";
    state.selectedPersonId = "";
    localStorage.removeItem('family_tree_state');
    location.reload();
  }
}

// --- Relations Connection Tab Management ---
function renderRelationsTab() {
  const m = state.members.find(x => x.id === state.selectedPersonId);
  if (!m) return;

  const container = document.getElementById('relations-actions-container');
  container.innerHTML = '';

  // 1. Father Section
  const fatherSec = createRelationPanel('Отец', m.fatherId, (fatherId) => {
    // Disconnect Father
    m.fatherId = "";
    saveState();
    updateAndRender();
    renderRelationsTab();
  }, () => {
    // Connect existing Father
    startSelectionMode('father', m.id);
  }, () => {
    // Add new Father
    openAddRelativeModal('father', m.id);
  });
  container.appendChild(fatherSec);

  // 2. Mother Section
  const motherSec = createRelationPanel('Мать', m.motherId, (motherId) => {
    // Disconnect Mother
    m.motherId = "";
    saveState();
    updateAndRender();
    renderRelationsTab();
  }, () => {
    // Connect existing Mother
    startSelectionMode('mother', m.id);
  }, () => {
    // Add new Mother
    openAddRelativeModal('mother', m.id);
  });
  container.appendChild(motherSec);

  // 3. Spouse Section
  const primarySpouse = m.spouses && m.spouses.length > 0 ? m.spouses[0].id : null;
  const spouseSec = createRelationPanel('Супруг(а)', primarySpouse, (spouseId) => {
    // Disconnect Spouse
    m.spouses = m.spouses.filter(s => s.id !== spouseId);
    // Bidirectional disconnect
    const sp = state.members.find(x => x.id === spouseId);
    if (sp && sp.spouses) {
      sp.spouses = sp.spouses.filter(s => s.id !== m.id);
    }
    saveState();
    updateAndRender();
    renderRelationsTab();
  }, () => {
    // Connect existing Spouse
    startSelectionMode('spouse', m.id);
  }, () => {
    // Add new Spouse
    openAddRelativeModal('spouse', m.id);
  });
  container.appendChild(spouseSec);

  // 4. Children Section
  const children = state.members.filter(x => x.fatherId === m.id || x.motherId === m.id);
  const childWrapper = document.createElement('div');
  childWrapper.className = 'relation-action-card';
  childWrapper.innerHTML = `<h4>Дети</h4>`;
  
  if (children.length > 0) {
    const list = document.createElement('div');
    list.className = 'relations-list';
    list.style.marginBottom = '15px';
    
    children.forEach(c => {
      const item = document.createElement('div');
      item.className = 'relation-item';
      item.style.cursor = 'default';
      
      const avatarHtml = renderAvatarHtml(c.firstName, c.lastName, c.avatar, 28);

      item.innerHTML = `
        <div class="relation-item-left">
          ${avatarHtml}
          <div class="relation-info">
            <h5>${escapeHtml(c.firstName)} ${escapeHtml(c.lastName)}</h5>
            <p>${c.gender === 'male' ? 'Сын' : 'Дочь'}</p>
          </div>
        </div>
        <button class="btn btn-danger btn-icon" style="height:28px; width:28px; border-radius:6px;" title="Отключить ребенка">
          <i class="fas fa-unlink" style="font-size:10px;"></i>
        </button>
      `;

      item.querySelector('.btn-danger').addEventListener('click', () => {
        showToastConfirm(`Отключить ${c.firstName} от родителей?`, () => {
          pushUndo('Отключение ребёнка ' + c.firstName);
          if (c.fatherId === m.id) c.fatherId = "";
          if (c.motherId === m.id) c.motherId = "";
          saveState();
          updateAndRender();
          renderRelationsTab();
          showToast('Ребёнок отключён', 'success');
        });
      });

      list.appendChild(item);
    });
    childWrapper.appendChild(list);
  }

  const buttons = document.createElement('div');
  buttons.className = 'relation-buttons-grid';
  buttons.innerHTML = `
    <button class="btn" id="link-existing-child"><i class="fas fa-link"></i> Привязать</button>
    <button class="btn btn-primary" id="add-new-child"><i class="fas fa-plus"></i> Создать</button>
  `;
  
  buttons.querySelector('#link-existing-child').addEventListener('click', () => {
    startSelectionMode('child', m.id);
  });
  buttons.querySelector('#add-new-child').addEventListener('click', () => {
    openAddRelativeModal('child', m.id);
  });

  childWrapper.appendChild(buttons);
  container.appendChild(childWrapper);
}

// Helper to create relation card (Father/Mother/Spouse)
function createRelationPanel(title, relationId, onDisconnect, onConnectExisting, onAddNew) {
  const card = document.createElement('div');
  card.className = 'relation-action-card';
  card.innerHTML = `<h4>${title}</h4>`;

  if (relationId) {
    const relPerson = state.members.find(x => x.id === relationId);
    if (relPerson) {
      const avatarHtml = renderAvatarHtml(relPerson.firstName, relPerson.lastName, relPerson.avatar, 28);

      const relInfo = document.createElement('div');
      relInfo.className = 'relation-item';
      relInfo.style.cursor = 'default';
      relInfo.innerHTML = `
        <div class="relation-item-left">
          ${avatarHtml}
          <div class="relation-info">
            <h5>${escapeHtml(relPerson.firstName)} ${escapeHtml(relPerson.lastName)}</h5>
            <p>${relPerson.birthDate ? new Date(relPerson.birthDate + 'T00:00:00').getFullYear() : '???'}</p>
          </div>
        </div>
        <button class="btn btn-danger btn-icon" style="height:28px; width:28px; border-radius:6px;" title="Отключить связь">
          <i class="fas fa-unlink" style="font-size:10px;"></i>
        </button>
      `;

      relInfo.querySelector('.btn-danger').addEventListener('click', () => {
        showToastConfirm(`Удалить связь с ${relPerson.firstName} ${relPerson.lastName}?`, () => {
          pushUndo('Отключение связи с ' + relPerson.firstName);
          onDisconnect(relationId);
          showToast('Связь удалена', 'success');
        });
      });
      card.appendChild(relInfo);
      return card;
    }
  }

  // If no relation connected yet, show actions
  const buttons = document.createElement('div');
  buttons.className = 'relation-buttons-grid';
  buttons.innerHTML = `
    <button class="btn"><i class="fas fa-link"></i> Привязать</button>
    <button class="btn btn-primary"><i class="fas fa-plus"></i> Создать</button>
  `;

  buttons.querySelectorAll('button')[0].addEventListener('click', onConnectExisting);
  buttons.querySelectorAll('button')[1].addEventListener('click', onAddNew);
  
  card.appendChild(buttons);
  return card;
}

// --- Dynamic Connecting: Selection Mode ---
function startSelectionMode(type, sourceId) {
  state.selectionMode = { active: true, type, sourceId };
  
  const banner = document.getElementById('selection-banner');
  const label = document.getElementById('selection-banner-text');
  
  let roleStr = type === 'father' ? 'Отца' : (type === 'mother' ? 'Мать' : (type === 'spouse' ? 'Супруга(у)' : 'Ребенка'));
  label.innerText = `Режим связи: Выберите в древе или поиске человека, которого хотите добавить в качестве ${roleStr}`;
  banner.classList.add('active');
  
  closeSidebar();
}

function cancelSelectionMode() {
  state.selectionMode = { active: false, type: "", sourceId: "" };
  document.getElementById('selection-banner').classList.remove('active');
  openSidebar();
}

// --- Mass Selection Mode ---
function toggleMassMode() {
  massMode = !massMode;
  selectedIds.clear();
  window._massSelectionMode = massMode;
  window._selectedIds = selectedIds;
  
  const canvas = document.getElementById('canvas-container');
  const bar = document.getElementById('mass-select-bar');
  
  if (massMode) {
    canvas.classList.add('mass-mode');
    bar.classList.add('active');
    updateMassCount();
    closeSidebar();
    updateAndRender();
  } else {
    exitMassMode();
  }
}

function exitMassMode() {
  massMode = false;
  selectedIds.clear();
  window._massSelectionMode = false;
  window._selectedIds = selectedIds;
  document.getElementById('canvas-container').classList.remove('mass-mode');
  document.getElementById('mass-select-bar').classList.remove('active');
  updateAndRender();
}

function toggleMemberSelection(id) {
  if (selectedIds.has(id)) {
    selectedIds.delete(id);
  } else {
    selectedIds.add(id);
  }
  
  // Update checkbox visual state
  const checkbox = document.querySelector(`.card-select-checkbox[data-id="${id}"]`);
  if (checkbox) {
    checkbox.classList.toggle('checked', selectedIds.has(id));
  }
  
  updateMassCount();
}

function selectAllMembers() {
  const allIds = state.members.map(m => m.id);
  const allSelected = allIds.every(id => selectedIds.has(id));
  
  if (allSelected) {
    selectedIds.clear();
  } else {
    allIds.forEach(id => selectedIds.add(id));
  }
  
  // Update all checkbox visual states
  document.querySelectorAll('.card-select-checkbox').forEach(cb => {
    const id = cb.getAttribute('data-id');
    cb.classList.toggle('checked', selectedIds.has(id));
  });
  
  updateMassCount();
}

function updateMassCount() {
  document.getElementById('mass-count').textContent = selectedIds.size;
}

function massDeleteMembers() {
  if (selectedIds.size === 0) {
    showToast('Выберите хотя бы одного человека', 'warning');
    return;
  }
  
  const idsToDelete = new Set(selectedIds);
  const count = idsToDelete.size;
  showToastConfirm(`Удалить ${count} чел. и все связи?`, () => {
    pushUndo('Массовое удаление (' + count + ' чел.)');
    
    // Remove references from other members
    state.members.forEach(m => {
      if (idsToDelete.has(m.fatherId)) m.fatherId = "";
      if (idsToDelete.has(m.motherId)) m.motherId = "";
      if (m.spouses) {
        m.spouses = m.spouses.filter(sp => !idsToDelete.has(sp.id));
      }
    });
    
    // Remove selected members
    state.members = state.members.filter(m => !idsToDelete.has(m.id));
    
    // Handle focus/selection
    if (idsToDelete.has(state.focusedPersonId)) {
      state.focusedPersonId = state.members.length > 0 ? state.members[0].id : "";
    }
    if (idsToDelete.has(state.selectedPersonId)) {
      state.selectedPersonId = state.focusedPersonId;
    }
    
    saveState();
    exitMassMode();
    
    if (state.members.length > 0) {
      updateAndRender();
      renderSidebarProfile();
      resetView(currentLayout);
    } else {
      localStorage.removeItem('family_tree_state');
      location.reload();
    }
    showToast('Удалено ' + count + ' чел.', 'success');
  });
}

function executeLinking(clickedId) {
  const { type, sourceId } = state.selectionMode;
  cancelSelectionMode();

  if (clickedId === sourceId) {
    showToast('Нельзя связать человека с самим собой', 'error');
    return;
  }

  const source = state.members.find(m => m.id === sourceId);
  const target = state.members.find(m => m.id === clickedId);

  if (!source || !target) return;

  const desc = { father: 'Отец', mother: 'Мать', spouse: 'Супруг(а)', child: 'Ребёнок' }[type] || type;
  pushUndo('Связь: ' + desc);

  if (type === 'father') {
    if (target.gender === 'female') {
      showToast('Выбрана женщина в качестве отца — проверьте пол', 'warning');
    }
    source.fatherId = clickedId;
  } 
  else if (type === 'mother') {
    if (target.gender === 'male') {
      showToast('Выбран мужчина в качестве матери — проверьте пол', 'warning');
    }
    source.motherId = clickedId;
  } 
  else if (type === 'spouse') {
    if (!source.spouses) source.spouses = [];
    if (!source.spouses.some(s => s.id === clickedId)) {
      source.spouses.push({ id: clickedId, marriageDate: "", marriagePlace: "", divorced: false });
    }
    if (!target.spouses) target.spouses = [];
    if (!target.spouses.some(s => s.id === sourceId)) {
      target.spouses.push({ id: sourceId, marriageDate: "", marriagePlace: "", divorced: false });
    }
  } 
  else if (type === 'child') {
    if (source.gender === 'male') {
      // If this child already has a different father, update it
      if (target.fatherId && target.fatherId !== sourceId) {
        showToast(`Отец ${target.firstName} изменён`, 'info', 2000);
      }
      target.fatherId = sourceId;
    } else {
      if (target.motherId && target.motherId !== sourceId) {
        showToast(`Мать ${target.firstName} изменена`, 'info', 2000);
      }
      target.motherId = sourceId;
    }
  }

  saveState();
  try {
    updateAndRender();
  } catch(e) {
    console.error("Render error after linking", e);
  }
  handleNodeSelect(sourceId);
  showToast(`${desc} установлен(а): ${source.firstName} → ${target.firstName}`, 'success');
}

// --- Add Relative Form Modal ---
function openAddRelativeModal(type, sourceId) {
  const modal = document.getElementById('modal-add-relative');
  const form = document.getElementById('add-relative-form');
  const title = document.getElementById('add-relative-title');

  let roleStr = type === 'father' ? 'Отца' : (type === 'mother' ? 'Матери' : (type === 'spouse' ? 'Супруга(и)' : 'Ребенка'));
  title.innerText = `Создать и добавить ${roleStr}`;

  // Pre-fill gender where obvious
  const genderSelect = document.getElementById('rel-gender');
  if (type === 'father') genderSelect.value = 'male';
  else if (type === 'mother') genderSelect.value = 'female';

  form.onsubmit = (e) => {
    e.preventDefault();
    if (!validateForm(form)) return;
    
    try {
      const newId = generateId();
      const newMember = {
        id: newId,
        firstName: document.getElementById('rel-firstName').value.trim(),
        lastName: document.getElementById('rel-lastName').value.trim(),
        maidenName: document.getElementById('rel-maidenName').value.trim(),
        gender: genderSelect.value,
        birthDate: sanitizeDate(document.getElementById('rel-birthDate').value),
        birthPlace: document.getElementById('rel-birthPlace').value.trim(),
        deathDate: sanitizeDate(document.getElementById('rel-deathDate').value),
        deathPlace: document.getElementById('rel-deathPlace').value.trim(),
        occupation: document.getElementById('rel-occupation').value.trim(),
        bio: document.getElementById('rel-bio').value.trim(),
        avatar: document.getElementById('rel-avatar').value.trim(),
        fatherId: "",
        motherId: "",
        spouses: []
      };

      // Auto connect relationship
      const source = state.members.find(x => x.id === sourceId);
      if (type === 'father') {
        source.fatherId = newId;
      } else if (type === 'mother') {
        source.motherId = newId;
      } else if (type === 'spouse') {
        if (!source.spouses) source.spouses = [];
        source.spouses.push({ id: newId, marriageDate: "", marriagePlace: "", divorced: false });
        newMember.spouses.push({ id: sourceId, marriageDate: "", marriagePlace: "", divorced: false });
      } else if (type === 'child') {
        if (source.gender === 'male') {
          newMember.fatherId = sourceId;
        } else {
          newMember.motherId = sourceId;
        }
      }

      state.members.push(newMember);
      saveState();
      updateAndRender();
      renderRelationsTab();
      form.reset();
      showToast('Родственник создан и привязан', 'success');
    } catch (err) {
      console.error("Error adding relative:", err);
      showToast('Ошибка: ' + err.message, 'error', 5000);
    } finally {
      closeModal('modal-add-relative');
    }
  };

  openModal('modal-add-relative');
}

// --- Add Unconnected Member Modal ---
function openNewMemberModal() {
  const modal = document.getElementById('modal-new-member');
  const form = document.getElementById('new-member-form');

  form.onsubmit = (e) => {
    e.preventDefault();
    if (!validateForm(form)) return;

    try {
      const newId = generateId();
      const newMember = {
        id: newId,
        firstName: document.getElementById('new-firstName').value.trim(),
        lastName: document.getElementById('new-lastName').value.trim(),
        maidenName: document.getElementById('new-maidenName').value.trim(),
        gender: document.getElementById('new-gender').value,
        birthDate: sanitizeDate(document.getElementById('new-birthDate').value),
        birthPlace: document.getElementById('new-birthPlace').value.trim(),
        deathDate: sanitizeDate(document.getElementById('new-deathDate').value),
        deathPlace: document.getElementById('new-deathPlace').value.trim(),
        occupation: document.getElementById('new-occupation').value.trim(),
        bio: document.getElementById('new-bio').value.trim(),
        avatar: document.getElementById('new-avatar').value.trim(),
        fatherId: "",
        motherId: "",
        spouses: []
      };

      state.members.push(newMember);
      pushUndo('Создание ' + newMember.firstName + ' ' + newMember.lastName);
      
      // Set as focused if database was empty
      if (state.members.length === 1) {
        state.focusedPersonId = newId;
        state.selectedPersonId = newId;
      }

      saveState();
      updateAndRender();
      form.reset();
      showToast(newMember.firstName + ' ' + newMember.lastName + ' добавлен(а)', 'success');

      // Select this member in sidebar
      handleNodeSelect(newId);
      
      // Smooth transition
      if (state.focusedPersonId === newId) {
        if (currentLayout) resetView(currentLayout);
      } else {
        // Focus on them to see them
        handleNodeFocus(newId);
      }
    } catch (err) {
      console.error("Error creating new member:", err);
      showToast('Ошибка: ' + err.message, 'error', 5000);
    } finally {
      closeModal('modal-new-member');
    }
  };

  openModal('modal-new-member');
}

// --- JSON File Operations ---
function exportJSON() {
  const data = JSON.stringify({
    members: state.members,
    focusedPersonId: state.focusedPersonId
  }, null, 2);

  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `family_tree_backup_${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function importJSON(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (event) => {
    try {
      const parsed = JSON.parse(event.target.result);
      if (!parsed.members || !Array.isArray(parsed.members)) {
        throw new Error("Неверный формат резервной копии");
      }

      state.members = parsed.members;
      state.focusedPersonId = parsed.focusedPersonId || parsed.members[0].id;
      state.selectedPersonId = state.focusedPersonId;
      
      saveState();
      updateAndRender();
      resetView(currentLayout);
      renderSidebarProfile();
      showToast('Древо импортировано (' + state.members.length + ' чел.)', 'success');
    } catch (err) {
      showToast('Ошибка импорта: ' + err.message, 'error', 5000);
    }
  };
  reader.readAsText(file);
  e.target.value = ''; // clear input
}

// --- Export to PNG ---
function exportPNG() {
  const svgEl = document.getElementById('tree-canvas');
  const zoomGroup = svgEl.querySelector('#zoom-group');
  if (!zoomGroup || !zoomGroup.children.length) {
    showToast('Нечего экспортировать — дерево пустое', 'warning');
    return;
  }
  showToast('Подготовка PNG...', 'info', 1500);

  const clone = svgEl.cloneNode(true);
  // Calculate bounding box of all content
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  if (currentLayout && currentLayout.nodes.length > 0) {
    currentLayout.nodes.forEach(n => {
      minX = Math.min(minX, n.x);
      maxX = Math.max(maxX, n.x + n.width);
      minY = Math.min(minY, n.y);
      maxY = Math.max(maxY, n.y + n.height);
    });
  }
  const pad = 60;
  const w = (maxX - minX) + pad * 2;
  const h = (maxY - minY) + pad * 2;
  clone.setAttribute('width', w);
  clone.setAttribute('height', h);
  clone.setAttribute('viewBox', `${minX - pad} ${minY - pad} ${w} ${h}`);

  // Add background
  const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  bg.setAttribute('width', '100%');
  bg.setAttribute('height', '100%');
  bg.setAttribute('fill', getComputedStyle(document.documentElement).getPropertyValue('--bg-primary').trim() || '#0b0f19');
  clone.insertBefore(bg, clone.firstChild);

  const svgData = new XMLSerializer().serializeToString(clone);
  const canvas = document.createElement('canvas');
  const scale = 2;
  canvas.width = w * scale;
  canvas.height = h * scale;
  const ctx = canvas.getContext('2d');
  ctx.scale(scale, scale);

  const img = new Image();
  img.onload = () => {
    ctx.drawImage(img, 0, 0, w, h);
    const a = document.createElement('a');
    a.download = `family_tree_${new Date().toISOString().slice(0, 10)}.png`;
    a.href = canvas.toDataURL('image/png');
    a.click();
    showToast('PNG экспортирован', 'success');
  };
  img.onerror = () => showToast('Ошибка экспорта PNG', 'error');
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgData);
}

// --- Export to SVG ---
function exportSVG() {
  const svgEl = document.getElementById('tree-canvas');
  const zoomGroup = svgEl.querySelector('#zoom-group');
  if (!zoomGroup || !zoomGroup.children.length) {
    showToast('Нечего экспортировать — дерево пустое', 'warning');
    return;
  }

  const clone = svgEl.cloneNode(true);
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  if (currentLayout && currentLayout.nodes.length > 0) {
    currentLayout.nodes.forEach(n => {
      minX = Math.min(minX, n.x);
      maxX = Math.max(maxX, n.x + n.width);
      minY = Math.min(minY, n.y);
      maxY = Math.max(maxY, n.y + n.height);
    });
  }
  const pad = 60;
  const w = (maxX - minX) + pad * 2;
  const h = (maxY - minY) + pad * 2;
  clone.setAttribute('width', w);
  clone.setAttribute('height', h);
  clone.setAttribute('viewBox', `${minX - pad} ${minY - pad} ${w} ${h}`);

  const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  bg.setAttribute('width', '100%');
  bg.setAttribute('height', '100%');
  bg.setAttribute('fill', getComputedStyle(document.documentElement).getPropertyValue('--bg-primary').trim() || '#0b0f19');
  clone.insertBefore(bg, clone.firstChild);

  const svgData = new XMLSerializer().serializeToString(clone);
  const blob = new Blob([svgData], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.download = `family_tree_${new Date().toISOString().slice(0, 10)}.svg`;
  a.href = url;
  a.click();
  URL.revokeObjectURL(url);
  showToast('SVG экспортирован', 'success');
}

// --- Modals Framework Logic ---
function initModalTriggers() {
  // Modal Triggers
  document.getElementById('open-stats-btn').addEventListener('click', () => {
    buildStatistics();
    openModal('modal-stats');
  });

  document.getElementById('open-timeline-btn').addEventListener('click', () => {
    buildTimeline();
    openModal('modal-timeline');
  });

  document.getElementById('open-calc-btn').addEventListener('click', () => {
    populateCalcSelectors();
    openModal('modal-calc');
  });

  document.getElementById('open-db-btn').addEventListener('click', () => {
    buildAllMembersList();
    openModal('modal-db');
  });

  document.getElementById('remove-duplicates-btn').addEventListener('click', removeDuplicates);

  // Modal Closers
  document.querySelectorAll('.close-modal-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const modal = e.target.closest('.modal-overlay');
      closeModal(modal.id);
    });
  });

  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        closeModal(overlay.id);
      }
    });
  });

  // Auth modal handlers
  const loginForm = document.getElementById('login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const username = document.getElementById('login-username').value.trim();
      const password = document.getElementById('login-password').value;
      try {
        await loginUser(username, password);
        closeModal('modal-login');
        showToast('Вход выполнен', 'success');
        location.reload();
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  }

  const registerForm = document.getElementById('register-form');
  if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const username = document.getElementById('register-username').value.trim();
      const password = document.getElementById('register-password').value;
      const confirm = document.getElementById('register-confirm').value;
      if (password !== confirm) {
        showToast('Пароли не совпадают', 'error');
        return;
      }
      try {
        await registerUser(username, password);
        closeModal('modal-register');
        showToast('Регистрация успешна', 'success');
        setCurrentUser(username);
        location.reload();
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  }

  document.getElementById('switch-to-register')?.addEventListener('click', () => {
    closeModal('modal-login');
    openModal('modal-register');
  });

  document.getElementById('switch-to-login')?.addEventListener('click', () => {
    closeModal('modal-register');
    openModal('modal-login');
  });
}

function openModal(id) {
  document.getElementById(id).classList.add('open');
}

function closeModal(id) {
  document.getElementById(id).classList.remove('open');
}

function showAuthModal() {
  openModal('modal-login');
}

// --- Relationship Calculator Operations ---
function populateCalcSelectors() {
  const selA = document.getElementById('calc-select-a');
  const selB = document.getElementById('calc-select-b');
  
  selA.innerHTML = '';
  selB.innerHTML = '';

  // Sort members alphabetically
  const sorted = [...state.members].sort((x, y) => `${x.firstName} ${x.lastName}`.localeCompare(`${y.firstName} ${y.lastName}`));

  sorted.forEach(m => {
    const opt = `<option value="${m.id}">${escapeHtml(m.firstName)} ${escapeHtml(m.lastName)} (${m.birthDate ? new Date(m.birthDate + 'T00:00:00').getFullYear() : '???'})</option>`;
    selA.innerHTML += opt;
    selB.innerHTML += opt;
  });

  // Set default selections
  if (state.selectedPersonId) selA.value = state.selectedPersonId;
  if (state.focusedPersonId && state.focusedPersonId !== state.selectedPersonId) {
    selB.value = state.focusedPersonId;
  } else if (state.members.length > 1) {
    selB.value = state.members.find(x => x.id !== state.selectedPersonId).id;
  }

  calculateSelectedRelationship();

  // Add listeners
  selA.onchange = calculateSelectedRelationship;
  selB.onchange = calculateSelectedRelationship;
}

function calculateSelectedRelationship() {
  const idA = document.getElementById('calc-select-a').value;
  const idB = document.getElementById('calc-select-b').value;

  const personA = state.members.find(x => x.id === idA);
  const personB = state.members.find(x => x.id === idB);

  if (!personA || !personB) return;

  const relationshipStr = getRelationship(state.members, idA, idB);
  
  document.getElementById('calc-result').innerText = relationshipStr;
  
  // Custom explanation details
  document.getElementById('calc-desc').innerText = 
    `Родство рассчитывается от лица: ${personA.firstName} ${personA.lastName} к лицу: ${personB.firstName} ${personB.lastName}.`;
}

// --- Statistics Rendering ---
function buildStatistics() {
  const total = state.members.length;
  document.getElementById('stats-total-members').innerText = total;

  // Gender counts
  const males = state.members.filter(m => m.gender === 'male').length;
  const females = state.members.filter(m => m.gender === 'female').length;
  const others = total - males - females;

  const malePercent = total > 0 ? Math.round((males / total) * 100) : 0;
  const femalePercent = total > 0 ? Math.round((females / total) * 100) : 0;

  document.getElementById('stats-gender-list').innerHTML = `
    <div class="stats-list-item">
      <span>Мужчины: ${males}</span>
      <span>${malePercent}%</span>
    </div>
    <div class="stats-bar-wrapper">
      <div class="stats-bar"><div class="stats-bar-fill" style="width: ${malePercent}%; background-color: var(--gender-male)"></div></div>
    </div>
    <div class="stats-list-item" style="margin-top: 5px;">
      <span>Женщины: ${females}</span>
      <span>${femalePercent}%</span>
    </div>
    <div class="stats-bar-wrapper">
      <div class="stats-bar"><div class="stats-bar-fill" style="width: ${femalePercent}%; background-color: var(--gender-female)"></div></div>
    </div>
  `;

  // Age calculations (for deceased / living)
  let totalAge = 0;
  let countWithAge = 0;
  const currentYear = new Date().getFullYear();

  state.members.forEach(m => {
    if (m.birthDate) {
      const birth = new Date(m.birthDate + 'T00:00:00').getFullYear();
      if (m.deathDate) {
        const death = new Date(m.deathDate + 'T00:00:00').getFullYear();
        totalAge += (death - birth);
        countWithAge++;
      } else {
        totalAge += (currentYear - birth);
        countWithAge++;
      }
    }
  });

  const avgLife = countWithAge > 0 ? Math.round(totalAge / countWithAge) : 0;
  document.getElementById('stats-avg-lifespan').innerText = `${avgLife} лет`;
  document.getElementById('stats-avg-lifespan-sub').innerText = `Рассчитано для ${countWithAge} участников`;

  // Common Last Names
  const surnames = {};
  state.members.forEach(m => {
    const name = (m.lastName || '').trim();
    if (name) {
      surnames[name] = (surnames[name] || 0) + 1;
    }
  });

  const sortedNames = Object.entries(surnames).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const namesContainer = document.getElementById('stats-surnames-list');
  namesContainer.innerHTML = '';

  if (sortedNames.length === 0) {
    namesContainer.innerHTML = '<div style="font-size:12px; color:var(--text-muted)">Нет данных</div>';
  } else {
    sortedNames.forEach(([name, count]) => {
      namesContainer.innerHTML += `
        <div class="stats-list-item">
          <span>${name}</span>
          <strong>${count} чел.</strong>
        </div>
      `;
    });
  }

  // Deceased count
  const deceased = state.members.filter(m => m.deathDate !== "").length;
  const living = total - deceased;
  document.getElementById('stats-living-count').innerText = `${living} жив. / ${deceased} ушедш.`;
}

// --- Timeline Rendering ---
function buildTimeline() {
  const container = document.getElementById('timeline-events-container');
  container.innerHTML = '';

  const events = [];
  const processedCouples = new Set();

  state.members.forEach(m => {
    // Birth Event
    if (m.birthDate) {
      const date = new Date(m.birthDate + 'T00:00:00');
      events.push({
        year: date.getFullYear(),
        dateVal: date,
        type: 'birth',
        title: `${m.firstName} ${m.lastName} родился(лась)`,
        desc: `Место рождения: ${m.birthPlace || 'не указано'}. ${m.occupation ? `Профессия: ${m.occupation}.` : ''}`
      });
    }
    // Death Event
    if (m.deathDate) {
      const date = new Date(m.deathDate + 'T00:00:00');
      events.push({
        year: date.getFullYear(),
        dateVal: date,
        type: 'death',
        title: `${m.firstName} ${m.lastName} скончался(лась)`,
        desc: `Ушел(шла) в возрасте ${new Date(m.deathDate + 'T00:00:00').getFullYear() - new Date(m.birthDate + 'T00:00:00').getFullYear()} лет. Место: ${m.deathPlace || 'не указано'}.`
      });
    }
    // Marriage Events (to avoid duplicates, create unique couple key)
    if (m.spouses && m.spouses.length > 0) {
      m.spouses.forEach(s => {
        const coupleKey = [m.id, s.id].sort().join('-');
        if (!processedCouples.has(coupleKey)) {
          processedCouples.add(coupleKey);
          const spouse = state.members.find(x => x.id === s.id);
          if (spouse && s.marriageDate) {
            const date = new Date(s.marriageDate + 'T00:00:00');
            events.push({
              year: date.getFullYear(),
              dateVal: date,
              type: 'marriage',
              title: `Бракосочетание: ${m.firstName} и ${spouse.firstName}`,
              desc: `Свадьба состоялась в городе ${s.marriagePlace || 'не указано'}.`
            });
          }
        }
      });
    }
  });

  // Sort chronologically
  events.sort((a, b) => a.year - b.year || a.dateVal - b.dateVal);

  if (events.length === 0) {
    container.innerHTML = '<div style="text-align:center; padding: 20px; color:var(--text-muted)">Нет событий. Пожалуйста, добавьте даты рождения/смерти участникам.</div>';
    return;
  }

  events.forEach(ev => {
    const evEl = document.createElement('div');
    evEl.className = 'timeline-event';
    
    evEl.innerHTML = `
      <div class="timeline-dot ${ev.type}"></div>
      <div class="timeline-time">${ev.year} год</div>
      <div class="timeline-event-card">
        <div class="timeline-title">${ev.title}</div>
        <div class="timeline-desc">${ev.desc}</div>
      </div>
    `;

    container.appendChild(evEl);
  });
}

// --- Database: All Members List Modal Rendering ---
function buildAllMembersList() {
  const grid = document.getElementById('db-members-grid');
  grid.innerHTML = '';

  const searchInput = document.getElementById('db-search-input');
  searchInput.value = '';

  function renderList(list) {
    grid.innerHTML = '';
    
    if (list.length === 0) {
      grid.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:20px; color:var(--text-muted)">Список пуст</div>';
      return;
    }

    list.forEach(m => {
      const card = document.createElement('div');
      card.className = 'db-member-card';
      
      const avatarHtml = renderAvatarHtml(m.firstName, m.lastName, m.avatar, 40);

      const birthYear = m.birthDate ? new Date(m.birthDate + 'T00:00:00').getFullYear() : '???';
      const deathYear = m.deathDate ? new Date(m.deathDate + 'T00:00:00').getFullYear() : (m.deathDate === "" ? "" : '???');
      const datesStr = deathYear === "" ? `р. ${birthYear}` : `${birthYear} — ${deathYear}`;

      card.innerHTML = `
        ${avatarHtml}
        <div class="db-member-info">
          <h4>${escapeHtml(m.firstName)} ${escapeHtml(m.lastName)}</h4>
          <p>${escapeHtml(datesStr)} • ${escapeHtml(m.occupation || 'Родственник')}</p>
        </div>
      `;

      card.addEventListener('click', () => {
        closeModal('modal-db');
        handleNodeSelect(m.id);
        
        // Center node
        if (currentLayout.nodes.some(n => n.id === m.id)) {
          centerNode(m.id, currentLayout);
        } else {
          // If not in layout, make them focus
          handleNodeFocus(m.id);
        }
      });

      grid.appendChild(card);
    });
  }

  // Initial list render (sorted alphabetically)
  const sorted = [...state.members].sort((a, b) => `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`));
  renderList(sorted);

  // Search filter
  searchInput.oninput = (e) => {
    const q = e.target.value.toLowerCase().trim();
    const filtered = sorted.filter(m => 
      `${m.firstName} ${m.lastName}`.toLowerCase().includes(q) ||
      (m.maidenName && m.maidenName.toLowerCase().includes(q)) ||
      (m.occupation && m.occupation.toLowerCase().includes(q))
    );
    renderList(filtered);
  };

  // Count duplicates
  updateDuplicatesCount();
}

function findDuplicates() {
  const groups = {};
  state.members.forEach(m => {
    const key = `${(m.firstName||'').trim().toLowerCase()}_${(m.lastName||'').trim().toLowerCase()}_${m.birthDate||''}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(m);
  });
  return Object.values(groups).filter(g => g.length > 1);
}

function updateDuplicatesCount() {
  const el = document.getElementById('duplicates-count');
  if (!el) return;
  const dupes = findDuplicates();
  if (dupes.length === 0) {
    el.textContent = 'Дублей не найдено';
    el.style.color = 'var(--text-muted)';
  } else {
    const totalExtra = dupes.reduce((sum, g) => sum + g.length - 1, 0);
    el.textContent = `Найдено дублей: ${totalExtra} чел. в ${dupes.length} группах`;
    el.style.color = '#f59e0b';
  }
}

function removeDuplicates() {
  const dupes = findDuplicates();
  if (dupes.length === 0) {
    showToast('Дублей не найдено', 'info');
    return;
  }
  const totalExtra = dupes.reduce((sum, g) => sum + g.length - 1, 0);
  showToastConfirm(`Удалить ${totalExtra} дублей? Будет оставлен по одному экземпляру.`, () => {
    pushUndo('Удаление дублей (' + totalExtra + ' чел.)');
    const idsToRemove = new Set();
    dupes.forEach(group => {
      // Keep the first member, remove the rest
      for (let i = 1; i < group.length; i++) {
        idsToRemove.add(group[i].id);
      }
    });
    // Clean up references
    state.members.forEach(m => {
      if (idsToRemove.has(m.fatherId)) m.fatherId = "";
      if (idsToRemove.has(m.motherId)) m.motherId = "";
      if (m.spouses) {
        m.spouses = m.spouses.filter(sp => !idsToRemove.has(sp.id));
      }
    });
    state.members = state.members.filter(m => !idsToRemove.has(m.id));
    if (idsToRemove.has(state.focusedPersonId)) {
      state.focusedPersonId = state.members.length > 0 ? state.members[0].id : "";
    }
    if (idsToRemove.has(state.selectedPersonId)) {
      state.selectedPersonId = state.focusedPersonId;
    }
    saveState();
    updateAndRender();
    renderSidebarProfile();
    buildAllMembersList();
    showToast('Удалено ' + totalExtra + ' дублей', 'success');
  });
}

// --- General Helper Utilities ---
function formatDate(dateStr) {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    const months = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
    return `${parseInt(parts[2])} ${months[parseInt(parts[1]) - 1]} ${parts[0]}`;
  }
  return dateStr;
}

function validateForm(formEl) {
  let valid = true;
  formEl.querySelectorAll('[required]').forEach(input => {
    const val = input.value.trim();
    if (!val) {
      input.style.borderColor = '#ef4444';
      valid = false;
    } else {
      input.style.borderColor = '';
    }
  });
  return valid;
}
