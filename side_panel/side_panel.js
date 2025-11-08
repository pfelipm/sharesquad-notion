// side_panel.js

// --- STATE ---
// We hold the app's state in memory, synced with chrome.storage
let state = {
  users: [], // { id: "u1", email: "..." }
  groups: [], // { id: "g1", name: "...", userIds: ["u1"] }
  lang: 'auto', // 'auto', 'en', 'es'
  langStrings: {},
  showUserGroupTags: true, // NEW
  showGroupMemberTags: true // NEW
};

// --- CONSTANTS ---
const LANG_TOGGLE_STATES = {
  'auto': { next: 'en', emoji: '🌐', title: 'langAuto' },
  'en': { next: 'es', emoji: '🇬🇧', title: 'langEN' },
  'es': { next: 'auto', emoji: '🇪🇸', title: 'langES' }
};

// --- DOM SELECTORS ---
const dom = {
  userList: document.getElementById('user-list'),
  groupList: document.getElementById('group-list'),
  addUserBtn: document.getElementById('add-user-btn'),
  addGroupBtn: document.getElementById('add-group-btn'),
  noUsersMsg: document.getElementById('no-users-msg'),
  noGroupsMsg: document.getElementById('no-groups-msg'),
  modalBackdrop: document.getElementById('modal-backdrop'),
  modalTitle: document.getElementById('modal-title'),
  modalBody: document.getElementById('modal-body'),
  modalCancelBtn: document.getElementById('modal-cancel-btn'),
  modalSaveBtn: document.getElementById('modal-save-btn'),
  langToggleBtn: document.getElementById('lang-toggle-btn'),
  toggleUserTags: document.getElementById('toggle-user-tags'), // NEW
  toggleGroupTags: document.getElementById('toggle-group-tags'), // NEW
  importBtn: document.getElementById('import-btn'), // NEW
  exportBtn: document.getElementById('export-btn'), // NEW
  importFileInput: document.getElementById('import-file-input'), // NEW
  // NEW: Dialog Modal Elements
  dialogBackdrop: document.getElementById('dialog-modal-backdrop'),
  dialogTitle: document.getElementById('dialog-modal-title'),
  dialogMessage: document.getElementById('dialog-modal-message'),
  dialogBtnOk: document.getElementById('dialog-modal-ok'),
  dialogBtnNo: document.getElementById('dialog-modal-no'),
  dialogBtnYes: document.getElementById('dialog-modal-yes')
};

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
    'shareSquad_showUserGroupTags', // NEW
    'shareSquad_showGroupMemberTags' // NEW
  ]);
  state.users = syncData.shareSquad_Users || [];
  state.groups = syncData.shareSquad_Groups || [];
  // Load view preferences, default to true
  state.showUserGroupTags = syncData.shareSquad_showUserGroupTags ?? true;
  state.showGroupMemberTags = syncData.shareSquad_showGroupMemberTags ?? true;

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

// NEW: Function to save view preferences
function saveViewPreference(key, value) {
  chrome.storage.sync.set({ [key]: value });
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

    // --- NEW LOGIC ---
    // Find all groups this user belongs to
    const groups = state.groups.filter(group => group.userIds.includes(user.id));
    let tagsHtml = '';
    // MODIFIED: Check preference state
    if (state.showUserGroupTags && groups.length > 0) {
      tagsHtml = `<div class="tags">`;
      // Show first 2 groups, then "+X more" (same logic as group list)
      groups.slice(0, 2).forEach(group => {
        tagsHtml += `<span class="tag">${group.name}</span>`;
      });
      if (groups.length > 2) {
        tagsHtml += `<span class="tag">+${groups.length - 2}</span>`;
      }
      tagsHtml += `</div>`;
    }
    // --- END NEW LOGIC ---

    // --- UPDATED HTML STRUCTURE ---
    // We now use <div class="item-main"> to stack email and tags
    li.innerHTML = `
      <div class="item-main">
        <span>${user.email}</span>
        ${tagsHtml}
      </div>
      <div class="item-actions">
        <!-- NEW: Added inject button for individual user -->
        <button class="button success inject" data-action="inject-user" data-i18n-title="inject" title="Inject">➤</button>
        <button class="button icon edit" data-action="edit-user" data-i18n-title="edit" title="Edit">✏️</button>
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
    // MODIFIED: Check preference state
    if (state.showGroupMemberTags && members.length > 0) {
      tagsHtml = `<div class="tags">`;
      // Show first 2 members, then "+X more"
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
        <button class="button success inject" data-action="inject-group" data-i18n-title="inject" title="Inject">➤</button>
        <button class="button icon edit" data-action="edit-group" data-i18n-title="edit" title="Edit">✏️</button>
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
    titleKey = mode === 'add' ? 'modalAddUser' : 'modalEditUser';

    // NEW: Build group checklist
    let groupChecklistHtml = '';
    if (state.groups.length > 0) {
      groupChecklistHtml = state.groups.map(group => `
        <label class="check-item">
          <input type="checkbox" data-groupid="${group.id}" ${user && group.userIds.includes(user.id) ? 'checked' : ''}>
          <span>${group.name}</span>
        </label>
      `).join('');
    } else {
      groupChecklistHtml = `<p class="empty-state" data-i18n="noGroups" style="padding: 10px 0;">No groups defined yet.</p>`;
    }

    bodyHtml = `
      <div class="form-group">
        <label for="user-email" data-i18n="email">Email</label>
        <input type="email" id="user-email" value="${user ? user.email : ''}" placeholder="name@example.com">
      </div>
      <!-- NEW: Added group checklist -->
      <div class="form-group">
        <label data-i18n="groups">Groups</label>
        <div class="checklist-container">${groupChecklistHtml}</div>
      </div>
    `;
  } else if (type === 'group') {
    const group = id ? state.groups.find(g => g.id === id) : null;
    titleKey = mode === 'add' ? 'modalAddGroup' : 'modalEditGroup';

    // Build user checklist
    let userChecklistHtml = '<p class="empty-state" data-i18n="noUsers" style="padding: 10px 0;">No users added yet.</p>';
    if (state.users.length > 0) {
      userChecklistHtml = state.users.map(user => `
        <label class="check-item">
          <input type="checkbox" data-userid="${user.id}" ${group && group.userIds.includes(user.id) ? 'checked' : ''}>
          <span>${user.email}</span>
        </label>
      `).join('');
    }

    bodyHtml = `
      <div class="form-group">
        <label for="group-name" data-i18n="groupName">Group name</label>
        <input type="text" id="group-name" value="${group ? group.name : ''}" placeholder="e.g., Claustro">
      </div>
      <div class="form-group">
        <label data-i18n="members">Members</label>
        <!-- RENAMED: from user-checklist to checklist-container -->
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
    const email = document.getElementById('user-email').value.trim();
    if (!email) return; // Add validation later
    
    let userId = id; // Will be null for 'add' mode initially

    if (mode === 'add') {
      const newUser = { id: `u_${Date.now()}`, email };
      state.users.push(newUser);
      userId = newUser.id; // Get the new ID
    } else if (mode === 'edit') {
      const user = state.users.find(u => u.id === id);
      if (user) user.email = email;
    }

    // NEW: Update group memberships for this user
    if (userId) {
      document.querySelectorAll('.checklist-container input[type="checkbox"]').forEach(input => {
        const groupId = input.dataset.groupid;
        const group = state.groups.find(g => g.id === groupId);
        if (!group) return;

        const userIsMember = group.userIds.includes(userId);

        if (input.checked && !userIsMember) {
          // Add user to group
          group.userIds.push(userId);
        } else if (!input.checked && userIsMember) {
          // Remove user from group
          group.userIds = group.userIds.filter(uid => uid !== userId);
        }
      });
    }

  } else if (type === 'group') {
    const name = document.getElementById('group-name').value.trim();
    if (!name) return; // Add validation

    const selectedUserIds = [];
    document.querySelectorAll('.checklist-container input[type="checkbox"]:checked').forEach(input => {
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

// --- NEW: Custom Dialog Modal ---
let currentDialog = {
  onConfirm: null
};

/**
 * Shows a custom dialog modal
 * @param {string} message The text to display
 * @param {string} titleKey The i18n key for the title
 * @param {'alert'|'confirm'} type The type of dialog
 * @param {function | null} onConfirm A callback function to run if "Yes" is clicked
 */
function showDialog(message, titleKey = 'confirmTitle', type = 'alert', onConfirm = null) {
  dom.dialogMessage.textContent = message;
  dom.dialogTitle.dataset.i18n = titleKey;
  applyStrings(); // Apply the title

  currentDialog.onConfirm = onConfirm;

  if (type === 'confirm') {
    dom.dialogBtnOk.style.display = 'none';
    dom.dialogBtnNo.style.display = 'inline-block';
    dom.dialogBtnYes.style.display = 'inline-block';
  } else { // 'alert'
    dom.dialogBtnOk.style.display = 'inline-block';
    dom.dialogBtnNo.style.display = 'none';
    dom.dialogBtnYes.style.display = 'none';
  }
  dom.dialogBackdrop.style.display = 'flex';
}

function hideDialog() {
  dom.dialogBackdrop.style.display = 'none';
  currentDialog.onConfirm = null;
}
// --- END: Custom Dialog Modal ---


function handleDelete(type, id) {
  const confirmKey = 'deleteConfirm';
  const confirmMsg = state.langStrings[confirmKey] || 'Are you sure you want to delete this?';
  
  // MODIFIED: Use custom dialog
  showDialog(confirmMsg, 'delete', 'confirm', () => {
    if (type === 'user') {
      state.users = state.users.filter(u => u.id !== id);
      // Also remove this user from all groups
      state.groups.forEach(group => {
        group.userIds = group.userIds.filter(uid => uid !== id);
      });
    } else if (type === 'group') {
      state.groups = state.groups.filter(g => g.id !== id);
    }
    saveData();
  });
}

// --- NEW: IMPORT/EXPORT ---

/**
 * Handles the Export button click
 */
function handleExport() {
  // We only export users and groups. Preferences are local.
  const data = {
    users: state.users,
    groups: state.groups
  };
  
  const jsonString = JSON.stringify(data, null, 2); // Pretty-print JSON
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = `sharesquad_backup_${new Date().toISOString().split('T')[0]}.json`;
  
  document.body.appendChild(a);
  a.click(); // Trigger download
  
  // Clean up
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Handles the Import button click
 */
function handleImportClick() {
  // Trigger the hidden file input
  dom.importFileInput.click();
}

/**
 * Handles the file selection from the hidden input
 */
function handleFileSelected(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const content = e.target.result;
      const data = JSON.parse(content);

      // Validate the imported data structure
      if (!data || !Array.isArray(data.users) || !Array.isArray(data.groups)) {
        throw new Error('Invalid data structure');
      }

      // Ask for confirmation
      const confirmKey = 'importConfirm';
      const confirmMsg = state.langStrings[confirmKey] || 'Are you sure? This will overwrite ALL current data.';
      
      // MODIFIED: Use custom dialog
      showDialog(confirmMsg, 'importData', 'confirm', () => {
        // Validation passed and confirmed. Overwrite state.
        state.users = data.users;
        state.groups = data.groups;
        saveData(); // This will save and re-render
        
        const successKey = 'importSuccess';
        const successMsg = state.langStrings[successKey] || 'Data imported successfully.';
        // MODIFIED: Use custom dialog
        showDialog(successMsg, 'importData', 'alert');
      });

    } catch (error) {
      console.error('Import failed:', error);
      const errorKey = 'importError';
      const errorMsg = state.langStrings[errorKey] || 'Invalid File. Please select a valid ShareSquad JSON backup file.';
      // MODIFIED: Use custom dialog
      showDialog(errorMsg, 'importError', 'alert');
    } finally {
      // Reset the file input to allow importing the same file again
      event.target.value = null;
    }
  };
  
  reader.readAsText(file);
}

// --- END: IMPORT/EXPORT ---

// MODIFIED: Renamed to handle both group and user injects
async function handleInject(emailList) {
  if (!emailList) return;

  // Get current Notion tab
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (!tab || !tab.url.includes('notion.so')) {
    console.warn('Not on a Notion tab.');
    // We shouldn't hit this if host_permissions and sidePanel logic are correct,
    // but it's good practice.
    return;
  }

  // Inject the script
  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    function: injectEmailsToNotion,
    args: [emailList]
  });
}

// NEW: Handler for group inject button
async function handleInjectGroup(groupId) {
  const group = state.groups.find(g => g.id === groupId);
  if (!group) return;

  const members = group.userIds.map(id => state.users.find(u => u.id === id)).filter(Boolean);
  const emailList = members.map(u => u.email).join(', ');

  await handleInject(emailList);
}

// NEW: Handler for user inject button
async function handleInjectUser(userId) {
  const user = state.users.find(u => u.id === userId);
  if (!user) return;

  await handleInject(user.email); // Pass the single email
}


/**
 * This function is serialized and executed *on the Notion page*.
 * It cannot access any variables from this script's scope.
 */
function injectEmailsToNotion(emailsToInject) {
  // Find the Notion input field. This is the "fragile" part.
  // This selector targets the placeholder text in either language.
  const input = document.querySelector('input[placeholder*="Correo electrónico o grupo"], input[placeholder*="Email or group"]');
  
  if (input) {
    // --- NEW LOGIC TO APPEND AND DE-DUPLICATE ---
    
    // 1. Get current emails from the input, split by comma, trim, and filter out empty strings.
    const currentEmails = input.value
      .split(',')
      .map(email => email.trim())
      .filter(email => email.length > 0);
      
    // 2. Get new emails to inject, split, trim, filter.
    const newEmails = emailsToInject
      .split(',')
      .map(email => email.trim())
      .filter(email => email.length > 0);
      
    // 3. Combine both lists and de-duplicate using a Set.
    const combinedEmails = new Set([...currentEmails, ...newEmails]);
    
    // 4. Convert back to an array, join with ", ", and set as the new value.
    const finalEmailString = Array.from(combinedEmails).join(', ');
    
    input.value = finalEmailString;
    
    // --- END NEW LOGIC ---
    
    // Dispatch events to make Notion's framework (React) recognize the change
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  } else {
    console.error('ShareSquad for Notion: Could not find the share input field.');
    // We could send a message back to the side panel to show an error.
  }
}

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

  // NEW: View toggles
  dom.toggleUserTags.addEventListener('click', (e) => {
    state.showUserGroupTags = e.target.checked;
    saveViewPreference('shareSquad_showUserGroupTags', state.showUserGroupTags);
    renderUserList(); // Just re-render the user list
    applyStrings(); // Re-apply tooltips
  });
  dom.toggleGroupTags.addEventListener('click', (e) => {
    state.showGroupMemberTags = e.target.checked;
    saveViewPreference('shareSquad_showGroupMemberTags', state.showGroupMemberTags);
    renderGroupList(); // Just re-render the group list
    applyStrings(); // Re-apply tooltips
  });

  // NEW: Import/Export buttons
  dom.exportBtn.addEventListener('click', handleExport);
  dom.importBtn.addEventListener('click', handleImportClick);
  dom.importFileInput.addEventListener('change', handleFileSelected);

  // NEW: Dialog modal buttons
  dom.dialogBtnOk.addEventListener('click', hideDialog);
  dom.dialogBtnNo.addEventListener('click', hideDialog);
  dom.dialogBtnYes.addEventListener('click', () => {
    if (typeof currentDialog.onConfirm === 'function') {
      currentDialog.onConfirm();
    }
    hideDialog();
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
    } else if (action === 'inject-user') { // NEW
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
      handleInjectGroup(id); // MODIFIED: Call specific handler
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
  // Call applyStrings again AFTER render, as render might create new elements
  applyStrings();
}

document.addEventListener('DOMContentLoaded', () => {
  initApp();
  setupEventListeners();
});