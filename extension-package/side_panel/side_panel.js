// side_panel.js

// --- STATE ---
// We hold the app's state in memory, synced with chrome.storage
let state = {
  users: [], // { id: "u1", email: "..." }
  groups: [], // { id: "g1", name: "...", userIds: ["u1"] }
  lang: 'auto', // 'auto', 'en', 'es'
  langStrings: {},
  showUserGroupTags: true,
  showGroupMemberTags: true,
  experimentalMode: false,
  hasSeenSyncWarning: false // NEW: For first-time warning
};

// --- CONSTANTS ---
const LANG_TOGGLE_STATES = {
  'auto': { next: 'en', emoji: '🌐', title: 'langToggleAuto' },
  'en': { next: 'es', emoji: '🇬🇧', title: 'langToggleEN' },
  'es': { next: 'auto', emoji: '🇪🇸', title: 'langToggleES' }
};

// --- DOM SELECTORS ---
// Declarar como objeto vacío. Lo poblaremos en DOMContentLoaded.
const dom = {};

// --- I18N (Localization) ---
/**
 * Loads the language strings based on state.lang
 */
async function loadStrings() {
  let langToLoad = state.lang;
  if (langToLoad === 'auto') {
    langToLoad = getAutoLang();
  }

  const url = chrome.runtime.getURL(`_locales/${langToLoad}/messages.json`);
  try {
    const response = await fetch(url);
    const json = await response.json();
    state.langStrings = {};
    // Flatten the { "key": { "message": "..." } } structure
    for (const key in json) {
      state.langStrings[key] = json[key].message;
    }
  } catch (error) {
    console.error('Error loading lang strings:', error);
    // Fallback to English if Spanish fails
    if (langToLoad === 'es') {
      state.lang = 'en';
      await loadStrings();
    }
  }
}

/**
 * Applies loaded strings to the DOM
 */
function applyStrings() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.dataset.i18n;
    if (state.langStrings[key]) {
      el.textContent = state.langStrings[key];
    }
  });
  // Apply to titles
  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    const key = el.dataset.i18nTitle;
    if (state.langStrings[key]) {
      el.title = state.langStrings[key];
    }
  });
  // Update lang toggle button
  const langState = LANG_TOGGLE_STATES[state.lang];
  dom.langToggleBtn.textContent = langState.emoji;
  dom.langToggleBtn.title = state.langStrings[langState.title] || langState.title;
}

/**
 * Gets the auto-detected language
 */
function getAutoLang() {
  const uiLang = chrome.i18n.getUILanguage(); // e.g., "es-419"
  const baseLang = uiLang.split('-')[0];
  if (['es', 'ca', 'eu', 'gl'].includes(baseLang)) {
    return 'es';
  }
  return 'en';
}

/**
 * Handles the 3-state language toggle
 */
function handleLangToggle() {
  const currentState = LANG_TOGGLE_STATES[state.lang];
  state.lang = currentState.next;
  chrome.storage.local.set({ shareSquad_Lang: state.lang });
  // Reload strings and re-render
  initApp();
}

// --- STORAGE ---
/**
 * Fetches all data from chrome.storage.sync
 */
async function fetchData() {
  const syncData = await chrome.storage.sync.get([
    'shareSquad_Users',
    'shareSquad_Groups',
    'shareSquad_showUserGroupTags',
    'shareSquad_showGroupMemberTags',
    'shareSquad_experimentalMode',
    'shareSquad_hasSeenSyncWarning' // NEW: Load warning flag
  ]);
  state.users = syncData.shareSquad_Users || [];
  state.groups = syncData.shareSquad_Groups || [];
  state.showUserGroupTags = syncData.shareSquad_showUserGroupTags ?? true;
  state.showGroupMemberTags = syncData.shareSquad_showGroupMemberTags ?? true;
  state.experimentalMode = syncData.shareSquad_experimentalMode ?? false;
  state.hasSeenSyncWarning = syncData.shareSquad_hasSeenSyncWarning ?? false; // NEW: Init flag

  const localData = await chrome.storage.local.get('shareSquad_Lang');
  state.lang = localData.shareSquad_Lang || 'auto';
}

/**
 * Saves all state data to chrome.storage.sync
 */
function saveData() {
  // A good place to sort before saving
  state.users.sort((a, b) => a.email.localeCompare(b.email));
  state.groups.sort((a, b) => a.name.localeCompare(b.name));

  chrome.storage.sync.set({
    shareSquad_Users: state.users,
    shareSquad_Groups: state.groups
  });
  // No need to await. Re-render immediately.
  render();
}

/**
 * Saves a single view preference to sync storage
 * @param {string} key The key to save
 * @param {any} value The value to save
 */
function saveViewPreference(key, value) {
  // MODIFIED: Added experimentalMode to the list of keys
  const validKeys = [
    'shareSquad_showUserGroupTags',
    'shareSquad_showGroupMemberTags',
    'shareSquad_experimentalMode',
    'shareSquad_hasSeenSyncWarning' // NEW: Add warning flag
  ];
  if (validKeys.includes(key)) {
    chrome.storage.sync.set({ [key]: value });
  }
}

// --- RENDER (View) ---
/**
 * Renders the entire UI based on the current state
 */
function render() {
  renderUserList();
  renderGroupList();
  // Set checkbox state
  dom.toggleUserTags.checked = state.showUserGroupTags;
  dom.toggleGroupTags.checked = state.showGroupMemberTags;

  // --- NEW: Fase 2 Render Logic ---
  dom.experimentalToggle.checked = state.experimentalMode;
  dom.syncPermissionsBtn.style.display = state.experimentalMode ? 'inline-block' : 'none';
  // --- END: Fase 2 Render Logic ---

  applyStrings(); // Re-apply strings in case of dynamic content
}

/**
 * Renders the User list
 */
function renderUserList() {
  dom.userList.innerHTML = ''; // Clear list
  if (state.users.length === 0) {
    dom.noUsersMsg.style.display = 'block';
    dom.userList.style.display = 'none';
    return;
  }

  dom.noUsersMsg.style.display = 'none';
  dom.userList.style.display = 'block';

  state.users.forEach(user => {
    const li = document.createElement('li');
    li.className = 'item';
    li.dataset.id = user.id;

    // Find all groups this user belongs to
    const groups = state.groups.filter(group => group.userIds.includes(user.id));
    let tagsHtml = '';
    if (state.showUserGroupTags && groups.length > 0) {
      tagsHtml = `<div class="tags">`;
      groups.slice(0, 2).forEach(group => {
        tagsHtml += `<span class="tag">${group.name}</span>`;
      });
      if (groups.length > 2) {
        tagsHtml += `<span class="tag">+${groups.length - 2}</span>`;
      }
      tagsHtml += `</div>`;
    }

    li.innerHTML = `
      <div class="item-main">
        <span>${user.email}</span>
        ${tagsHtml}
      </div>
      <div class="item-actions">
        <button class="button success small" data-action="inject-user" data-i18n-title="inject" title="Inject">➤</button>
        <button class="button icon" data-action="edit-user" data-i18n-title="edit" title="Edit">✏️</button>
        <button class="button icon delete" data-action="delete-user" data-i18n-title="delete" title="Delete">🗑️</button>
      </div>
    `;
    dom.userList.appendChild(li);
  });
}

/**
 * Renders the Group list
 */
function renderGroupList() {
  dom.groupList.innerHTML = ''; // Clear list
  if (state.groups.length === 0) {
    dom.noGroupsMsg.style.display = 'block';
    dom.groupList.style.display = 'none';
    return;
  }

  dom.noGroupsMsg.style.display = 'none';
  dom.groupList.style.display = 'block';

  state.groups.forEach(group => {
    const li = document.createElement('li');
    li.className = 'item';
    li.dataset.id = group.id;

    // Build member tags
    const members = group.userIds.map(id => state.users.find(u => u.id === id)).filter(Boolean);
    let tagsHtml = '';
    if (state.showGroupMemberTags && members.length > 0) {
      tagsHtml = `<div class="tags">`;
      members.slice(0, 2).forEach(member => {
        tagsHtml += `<span class="tag">${member.email.split('@')[0]}...</span>`;
      });
      if (members.length > 2) {
        tagsHtml += `<span class="tag">+${members.length - 2}</span>`;
      }
      tagsHtml += `</div>`;
    }

    li.innerHTML = `
      <div class="item-main">
        <span>${group.name}</span>
        ${tagsHtml}
      </div>
      <div class="item-actions">
        <button class="button success small" data-action="inject-group" data-i18n-title="inject" title="Inject">➤</button>
        <button class="button icon" data-action="edit-group" data-i18n-title="edit" title="Edit">✏️</button>
        <button class="button icon delete" data-action="delete-group" data-i18n-title="delete" title="Delete">🗑️</button>
      </div>
    `;
    dom.groupList.appendChild(li);
  });
}

// --- MODAL (Controller) ---
let currentModal = {
  type: null, // 'user', 'group'
  mode: null, // 'add', 'edit'
  id: null // id of item being edited
};

function showModal(type, mode, id = null) {
  currentModal = { type, mode, id };
  dom.modalBackdrop.style.display = 'flex';
  let titleKey = '';
  let bodyHtml = '';

  if (type === 'user') {
    const user = id ? state.users.find(u => u.id === id) : null;
    titleKey = mode === 'add' ? 'addUser' : 'editUser';

    // Build group checklist
    let groupChecklistHtml = '';
    if (state.groups.length > 0) {
      const sortedGroups = [...state.groups].sort((a,b) => a.name.localeCompare(b.name));
      groupChecklistHtml = sortedGroups.map(group => `
        <label class="check-item">
          <input type="checkbox" data-groupid="${group.id}" ${user && group.userIds.includes(user.id) ? 'checked' : ''}>
          <span>${group.name}</span>
        </label>
      `).join('');
    } else {
      groupChecklistHtml = `<p class="empty-state" data-i18n="noGroups" style="padding: 10px 0;"></p>`;
    }

    bodyHtml = `
      <div class="form-group">
        <label for="modal-input-email" data-i18n="email">Email</label>
        <input type="email" id="modal-input-email" value="${user ? user.email : ''}" placeholder="${state.langStrings['emailPlaceholder'] || 'name@example.com'}">
      </div>
      <div class="form-group">
        <label data-i18n="groups">Groups</label>
        <div class="checklist-container">${groupChecklistHtml}</div>
      </div>
    `;
  } else if (type === 'group') {
    const group = id ? state.groups.find(g => g.id === id) : null;
    titleKey = mode === 'add' ? 'addGroup' : 'editGroup';

    // Build user checklist
    let userChecklistHtml = `<p class="empty-state" data-i18n="noUsers" style="padding: 10px 0;"></p>`;
    if (state.users.length > 0) {
      const sortedUsers = [...state.users].sort((a,b) => a.email.localeCompare(b.email));
      userChecklistHtml = sortedUsers.map(user => `
        <label class="check-item">
          <input type="checkbox" data-userid="${user.id}" ${group && group.userIds.includes(user.id) ? 'checked' : ''}>
          <span>${user.email}</span>
        </label>
      `).join('');
    }

    bodyHtml = `
      <div class="form-group">
        <label for="modal-input-name" data-i18n="groupName">Group name</label>
        <input type="text" id="modal-input-name" value="${group ? group.name : ''}" placeholder="${state.langStrings['groupPlaceholder'] || 'Faculty'}">
      </div>
      <div class="form-group">
        <label data-i18n="members">Members</label>
        <div class="checklist-container">${userChecklistHtml}</div>
      </div>
    `;
  }

  dom.modalTitle.dataset.i18n = titleKey;
  dom.modalBody.innerHTML = bodyHtml;
  applyStrings(); // Apply strings to new modal content
}

function hideModal() {
  dom.modalBackdrop.style.display = 'none';
  dom.modalBody.innerHTML = '';
  currentModal = { type: null, mode: null, id: null };
}

function handleModalSave() {
  const { type, mode, id } = currentModal;

  if (type === 'user') {
    const email = document.getElementById('modal-input-email').value.trim();
    if (!email) return;

    let userId = id;

    if (mode === 'add') {
      const newUser = { id: `u_${Date.now()}`, email };
      state.users.push(newUser);
      userId = newUser.id;
    } else if (mode === 'edit') {
      const user = state.users.find(u => u.id === id);
      if (user) user.email = email;
    }

    if (userId) {
      document.querySelectorAll('#modal-body .checklist-container input[type="checkbox"]').forEach(input => {
        const groupId = input.dataset.groupid;
        const group = state.groups.find(g => g.id === groupId);
        if (!group) return;

        const userIsMember = group.userIds.includes(userId);

        if (input.checked && !userIsMember) {
          group.userIds.push(userId);
        } else if (!input.checked && userIsMember) {
          group.userIds = group.userIds.filter(uid => uid !== userId);
        }
      });
    }

  } else if (type === 'group') {
    const name = document.getElementById('modal-input-name').value.trim();
    if (!name) return;

    const selectedUserIds = [];
    document.querySelectorAll('#modal-body .checklist-container input[type="checkbox"]:checked').forEach(input => {
      selectedUserIds.push(input.dataset.userid);
    });

    if (mode === 'add') {
      state.groups.push({ id: `g_${Date.now()}`, name, userIds: selectedUserIds });
    } else if (mode === 'edit') {
      const group = state.groups.find(g => g.id === id);
      if (group) {
        group.name = name;
        group.userIds = selectedUserIds;
      }
    }
  }

  saveData();
  hideModal();
}

// --- ACTIONS (Controller) ---

// --- Custom Dialog Modal ---
let currentDialog = {
  onConfirm: null,
  isSyncWarning: false // NEW: Flag for sync warning
};

/**
 * Shows a custom dialog modal
 * @param {string} message The text to display
 * @param {string} titleKey The i18n key for the title
 * @param {'alert'|'confirm'} type The type of dialog
 * @param {function | null} onConfirm A callback function to run if "Yes" is clicked
 * @param {object} options - Optional flags (e.g., { showDontShowAgain: true })
 */
function showDialog(message, titleKey = 'importConfirmTitle', type = 'alert', onConfirm = null, options = {}) {
  dom.dialogMessage.textContent = message;
  dom.dialogTitle.dataset.i18n = titleKey;
  currentDialog.onConfirm = onConfirm;
  currentDialog.isSyncWarning = options.showDontShowAgain || false; // NEW: Set flag

  if (type === 'alert') {
    dom.dialogBtnNo.style.display = 'none';
    dom.dialogBtnYes.style.display = 'none';
    dom.dialogBtnOk.style.display = 'inline-block';
  } else if (type === 'confirm') {
    dom.dialogBtnNo.style.display = 'inline-block';
    dom.dialogBtnYes.style.display = 'inline-block';
    dom.dialogBtnOk.style.display = 'none';
  }

  // NEW: Show/hide the "Don't show again" checkbox
  if (currentDialog.isSyncWarning) {
    dom.syncWarningExtra.style.display = 'block';
    dom.syncWarningDontShow.checked = false;
  } else {
    dom.syncWarningExtra.style.display = 'none';
  }

  applyStrings(); // Apply title string and new checkbox string
  dom.dialogBackdrop.style.display = 'flex';
}

function hideDialog() {
  dom.dialogBackdrop.style.display = 'none';
  currentDialog.onConfirm = null;
  currentDialog.isSyncWarning = false; // NEW: Reset flag
}

/**
 * NEW: Handle OK click to check for "Don't show again"
 */
function handleDialogOk() {
  if (currentDialog.isSyncWarning && dom.syncWarningDontShow.checked) {
    state.hasSeenSyncWarning = true;
    saveViewPreference('shareSquad_hasSeenSyncWarning', true);
  }
  hideDialog();
}

// --- NEW: Loader Modal ---
function showLoader(titleKey, messageKey) {
  dom.loaderModalTitle.dataset.i18n = titleKey;
  dom.loaderModalMessage.dataset.i18n = messageKey;
  applyStrings(); // Apply new strings
  dom.loaderModalBackdrop.style.display = 'flex';
}

function hideLoader() {
  dom.loaderModalBackdrop.style.display = 'none';
}
// --- END: Loader Modal ---


function handleDelete(type, id) {
  const titleKey = (type === 'user') ? 'deleteConfirmMessageUser' : 'deleteConfirmMessageGroup';
  const confirmMsg = state.langStrings[titleKey] || 'Are you sure you want to delete this?';

  showDialog(confirmMsg, 'deleteConfirmTitle', 'confirm', () => {
    if (type === 'user') {
      state.users = state.users.filter(u => u.id !== id);
      state.groups.forEach(group => {
        group.userIds = group.userIds.filter(uid => uid !== id);
      });
    } else if (type === 'group') {
      state.groups = state.groups.filter(g => g.id !== id);
    }
    saveData();
  });
}

// --- IMPORT/EXPORT ---

function handleExport() {
  const data = {
    users: state.users,
    groups: state.groups
  };

  const jsonString = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `sharesquad_backup_${new Date().toISOString().split('T')[0]}.json`;

  document.body.appendChild(a);
  a.click();

  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function handleImportClick() {
  dom.importFileInput.click();
}

function handleFileSelected(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const content = e.target.result;
      const data = JSON.parse(content);

      if (!data || !Array.isArray(data.users) || !Array.isArray(data.groups)) {
        throw new Error(state.langStrings['importErrorInvalidFile'] || 'Invalid file structure.');
      }

      showDialog(
        state.langStrings['importConfirmMessage'] || 'Overwrite all data?',
        'importConfirmTitle',
        'confirm',
        () => {
          state.users = data.users;
          state.groups = data.groups;
          saveData();
          showDialog(state.langStrings['importSuccess'] || 'Import successful.', 'importSuccessTitle', 'alert');
        }
      );

    } catch (error) {
      console.error('Import failed:', error);
      showDialog(error.message, 'importErrorTitle', 'alert');
    } finally {
      event.target.value = null;
    }
  };

  reader.readAsText(file);
}

// --- END: IMPORT/EXPORT ---

/**
 * Helper to get the active Notion tab
 * @returns {Promise<chrome.tabs.Tab | null>}
 */
async function getActiveNotionTab() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });

    if (tab && tab.url && tab.url.startsWith('https://www.notion.so/')) {
      return tab;
    }

    console.warn('Not on a Notion tab.');
    // Not showing a dialog here, the callers will handle it.
    return null;
  } catch(e) {
    console.error("Error getting active tab:", e);
    showDialog(e.message, 'syncErrorTitle', 'alert');
    return null;
  }
}


/**
 * Base function to inject a list of emails
 * @param {string} emailList - A comma-separated string of emails
 */
async function handleInject(emailList) {
  if (!emailList) return;

  const tab = await getActiveNotionTab();
  if (!tab) {
    showDialog(state.langStrings['notificationMessage'] || 'This extension only works on notion.so pages.', 'notificationTitle', 'alert');
    return;
  }

  // --- CORRECCIÓN (FIX 1): Pre-check if the inject target exists ---
  try {
    // 1. Inject the bot script first to make sure functions are available
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content_scripts/bot.js'],
    });

    // 2. Run the pre-check function
    const [preCheckResult] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => window.preCheckInject(), // Assumes bot.js exposes this
    });

    // 3. Check for error
    if (preCheckResult && preCheckResult.result && preCheckResult.result.errorKey) {
      const errorKey = preCheckResult.result.errorKey;
      // Use the 'syncErrorShareMenu' key, as it's the same error
      const errorMessage = state.langStrings[errorKey] || 'Could not find Notion share menu.';
      showDialog(errorMessage, 'syncErrorTitle', 'alert');
      return; // Stop if popup isn't open
    }

    // 4. If pre-check passes, run the actual inject function
    const [injectResult] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (emails) => window.injectEmailsToNotion(emails), // Call exposed function
      args: [emailList]
    });

    // 5. Check for *another* error (e.g., input found then disappeared)
    if (injectResult && injectResult.result && injectResult.result.errorKey) {
       const errorKey = injectResult.result.errorKey;
       const errorMessage = state.langStrings[errorKey] || 'Could not find email input.';
       showDialog(errorMessage, 'syncErrorTitle', 'alert');
    }
    // No success message for inject, it's distracting.

  } catch (e) {
    console.error('ShareSquad: Error running inject script.', e);
    showDialog(e.message, 'syncErrorTitle', 'alert');
  }
}

/**
 * Handles click on a group inject button
 * @param {string} groupId
 */
async function handleInjectGroup(groupId) {
  const group = state.groups.find(g => g.id === groupId);
  if (!group) return;

  const members = group.userIds.map(id => state.users.find(u => u.id === id)).filter(Boolean);
  const emailList = members.map(u => u.email).join(', ');

  await handleInject(emailList);
}

/**
 * Handles click on a user inject button
 * @param {string} userId
 */
async function handleInjectUser(userId) {
  const user = state.users.find(u => u.id === userId);
  if (!user) return;

  await handleInject(user.email); // Pass the single email
}

// --- NEW: FASE 2 (Sync Permissions) ---

function showSyncModal() {
  // Sort and render groups
  const sortedGroups = [...state.groups].sort((a, b) => a.name.localeCompare(b.name));
  if (sortedGroups.length > 0) {
    dom.syncModalGroupList.innerHTML = sortedGroups.map(group => `
      <label class="check-item">
        <input type="checkbox" data-groupid="${group.id}">
        <span>${group.name}</span>
      </label>
    `).join('');
  } else {
    dom.syncModalGroupList.innerHTML = `<p class="empty-state" data-i18n="noGroups"></p>`;
  }

  // Sort and render users
  const sortedUsers = [...state.users].sort((a, b) => a.email.localeCompare(b.email));
  if (sortedUsers.length > 0) {
    dom.syncModalUserList.innerHTML = sortedUsers.map(user => `
      <label class="check-item">
        <input type="checkbox" data-userid="${user.id}">
        <span>${user.email}</span>
      </label>
    `).join('');
  } else {
    dom.syncModalUserList.innerHTML = `<p class="empty-state" data-i18n="noUsers"></p>`;
  }

  // Reset permission dropdown
  dom.syncModalPermissionSelect.value = 'full';

  dom.syncModalBackdrop.style.display = 'flex';
  applyStrings(); // Apply strings to new modal content
}

function hideSyncModal() {
  dom.syncModalBackdrop.style.display = 'none';
}

async function handleSyncModalApply() {
  const permissionKey = dom.syncModalPermissionSelect.value;

  // 1. Get all checked user IDs directly
  const selectedUserIds = new Set();
  dom.syncModalUserList.querySelectorAll('input[data-userid]:checked').forEach(input => {
    selectedUserIds.add(input.dataset.userid);
  });

  // 2. Get all checked group IDs and add their user IDs
  dom.syncModalGroupList.querySelectorAll('input[data-groupid]:checked').forEach(input => {
    const group = state.groups.find(g => g.id === input.dataset.groupid);
    if (group) {
      group.userIds.forEach(uid => selectedUserIds.add(uid));
    }
  });

  // 3. Convert Set of IDs to array of emails
  const emailsToSync = Array.from(selectedUserIds).map(id => {
    return state.users.find(u => u.id === id)?.email;
  }).filter(Boolean); // Filter out any undefined emails

  hideSyncModal(); // Hide modal immediately

  if (emailsToSync.length === 0) {
    console.log('Sync: No users selected.');
    return; // Nothing to do
  }

  // 4. Get active tab
  const tab = await getActiveNotionTab();
  if (!tab) {
    // CORREGIDO: getActiveNotionTab ya muestra el error
    return;
  }

  const payload = {
    emails: emailsToSync,
    permissionKey: permissionKey
  };

  // --- CORRECCIÓN (FIX 2): Mostrar Loader ANTES, ocultar DESPUÉS ---
  showLoader('syncWorkingTitle', 'syncWorkingMessage');

  let runResult;
  try {
    // 5. Inject and run the bot
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content_scripts/bot.js'],
    });

    [runResult] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (payload) => window.syncPermissionsOnNotionPage(payload),
      args: [payload],
    });

  } catch (e) {
    console.error('ShareSquad: Error running sync bot.', e);
    runResult = { result: { errorKey: 'syncErrorTitle' } }; // Generic error
  } finally {
    // 6. Ocultar el Loader, pase lo que pase
    hideLoader();
  }

  // 7. Mostrar resultado DESPUÉS de ocultar el loader
  if (runResult && runResult.result && runResult.result.errorKey) {
    const errorKey = runResult.result.errorKey;
    const errorMessage = state.langStrings[errorKey] || 'Unknown synchronization error.';
    showDialog(errorMessage, 'syncErrorTitle', 'alert');
  } else {
    // CORREGIDO: Usar el nuevo mensaje de "Éxito"
    showDialog(state.langStrings['syncSuccessMessage'] || 'Sync completed!', 'syncSuccessTitle', 'alert');
  }
}
// --- END: FASE 2 ---


// --- EVENT LISTENERS ---
function setupEventListeners() {
  // Modal buttons
  dom.modalCancelBtn.addEventListener('click', hideModal);
  dom.modalSaveBtn.addEventListener('click', handleModalSave);

  // Add buttons
  dom.addUserBtn.addEventListener('click', () => showModal('user', 'add'));
  dom.addGroupBtn.addEventListener('click', () => showModal('group', 'add'));

  // Language toggle
  dom.langToggleBtn.addEventListener('click', handleLangToggle);

  // View toggles
  dom.toggleUserTags.addEventListener('click', (e) => {
    state.showUserGroupTags = e.target.checked;
    saveViewPreference('shareSquad_showUserGroupTags', state.showUserGroupTags);
    renderUserList();
    applyStrings();
  });
  dom.toggleGroupTags.addEventListener('click', (e) => {
    state.showGroupMemberTags = e.target.checked;
    saveViewPreference('shareSquad_showGroupMemberTags', state.showGroupMemberTags);
    renderGroupList();
    applyStrings();
  });

  // Import/Export buttons
  dom.exportBtn.addEventListener('click', handleExport);
  dom.importBtn.addEventListener('click', handleImportClick);
  dom.importFileInput.addEventListener('change', handleFileSelected);

  // Dialog modal buttons
  dom.dialogBtnOk.addEventListener('click', handleDialogOk);
  dom.dialogBtnNo.addEventListener('click', hideDialog);
  dom.dialogBtnYes.addEventListener('click', () => {
    if (typeof currentDialog.onConfirm === 'function') {
      currentDialog.onConfirm();
    }
    hideDialog();
  });

  // Fase 2 Listeners
  dom.experimentalToggle.addEventListener('click', (e) => {
    const isChecked = e.target.checked;
    state.experimentalMode = isChecked;
    saveViewPreference('shareSquad_experimentalMode', state.experimentalMode);
    render();
    applyStrings();

    // Show warning on first check
    if (isChecked && !state.hasSeenSyncWarning) {
      showDialog(
        state.langStrings['syncWarningMessage'] || "How to use...",
        'syncWarningTitle',
        'alert',
        null, // No confirm callback
        { showDontShowAgain: true } // Pass the option
      );
    }
  });

  dom.syncPermissionsBtn.addEventListener('click', showSyncModal);
  dom.syncModalCancelBtn.addEventListener('click', hideSyncModal);
  dom.syncModalApplyBtn.addEventListener('click', handleSyncModalApply);

  // Loader modal listener (no buttons, but good practice)
  dom.loaderModalBackdrop.addEventListener('click', () => {
    // Don't allow closing by clicking backdrop
  });

  // Event delegation for dynamic lists
  dom.userList.addEventListener('click', (e) => {
    const button = e.target.closest('button[data-action]');
    if (!button) return;

    const action = button.dataset.action;
    const id = button.closest('li.item').dataset.id;

    if (action === 'edit-user') {
      showModal('user', 'edit', id);
    } else if (action === 'delete-user') {
      handleDelete('user', id);
    } else if (action === 'inject-user') {
      handleInjectUser(id);
    }
  });

  dom.groupList.addEventListener('click', (e) => {
    const button = e.target.closest('button[data-action]');
    if (!button) return;

    const action = button.dataset.action;
    const id = button.closest('li.item').dataset.id;

    if (action === 'edit-group') {
      showModal('group', 'edit', id);
    } else if (action === 'delete-group') {
      handleDelete('group', id);
    } else if (action === 'inject-group') {
      handleInjectGroup(id);
    }
  });
}

// --- INITIALIZATION ---
/**
 * Main function to initialize the app
 */
async function initApp() {
  await fetchData();
  await loadStrings();
  render();
  applyStrings();
}

document.addEventListener('DOMContentLoaded', () => {
  // --- Poblar el objeto dom AHORA que el DOM está listo ---
  dom.userList = document.getElementById('user-list');
  dom.groupList = document.getElementById('group-list');
  dom.addUserBtn = document.getElementById('add-user-btn');
  dom.addGroupBtn = document.getElementById('add-group-btn');
  dom.noUsersMsg = document.getElementById('no-users-msg');
  dom.noGroupsMsg = document.getElementById('no-groups-msg');
  dom.modalBackdrop = document.getElementById('modal-backdrop');
  dom.modalTitle = document.getElementById('modal-title');
  dom.modalBody = document.getElementById('modal-body');
  dom.modalCancelBtn = document.getElementById('modal-cancel-btn');
  dom.modalSaveBtn = document.getElementById('modal-save-btn');
  dom.langToggleBtn = document.getElementById('lang-toggle-btn');
  dom.toggleUserTags = document.getElementById('toggle-user-tags');
  dom.toggleGroupTags = document.getElementById('toggle-group-tags');
  dom.importBtn = document.getElementById('import-btn');
  dom.exportBtn = document.getElementById('export-btn');
  dom.importFileInput = document.getElementById('import-file-input');
  // Dialog Modal Elements
  dom.dialogBackdrop = document.getElementById('dialog-modal-backdrop');
  dom.dialogTitle = document.getElementById('dialog-modal-title');
  dom.dialogMessage = document.getElementById('dialog-modal-message');
  dom.dialogBtnOk = document.getElementById('dialog-btn-ok');
  dom.dialogBtnNo = document.getElementById('dialog-btn-no');
  dom.dialogBtnYes = document.getElementById('dialog-btn-yes');
  // "Don't show again" elements
  dom.syncWarningExtra = document.getElementById('sync-warning-extra');
  dom.syncWarningDontShow = document.getElementById('sync-warning-dont-show');
  // Fase 2 Elements
  dom.experimentalToggle = document.getElementById('toggle-experimental');
  dom.syncPermissionsBtn = document.getElementById('sync-permissions-btn');
  // Sync Modal (matches your HTML)
  dom.syncModalBackdrop = document.getElementById('sync-modal');
  dom.syncModalPermissionSelect = document.getElementById('sync-permission-select');
  dom.syncModalGroupList = document.getElementById('sync-group-list');
  dom.syncModalUserList = document.getElementById('sync-user-list');
  dom.syncModalCancelBtn = document.getElementById('sync-modal-cancel-btn');
  dom.syncModalApplyBtn = document.getElementById('sync-modal-apply-btn');
  // NEW: Loader Modal
  dom.loaderModalBackdrop = document.getElementById('loader-modal-backdrop');
  dom.loaderModalTitle = document.getElementById('loader-modal-title');
  dom.loaderModalMessage = document.getElementById('loader-modal-message');
  // --- Fin de poblar el DOM ---

  initApp();
  setupEventListeners();
});
