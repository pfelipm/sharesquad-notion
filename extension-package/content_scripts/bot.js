/**
 * ShareSquad Bot - Injected Content Script (Phase 2)
 * This script contains the fragile "bot" logic to interact with the Notion DOM.
 */

/**
 * Helper function to pause execution.
 * @param {number} ms - Milliseconds to wait.
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Clicks an element and waits a bit for the UI to react.
 * @param {HTMLElement} element - The element to click.
 */
async function clickAndWait(element) {
  if (!element) return;
  element.click();
  await sleep(300); // Wait for Notion's UI to update
}

/**
 * Finds the main share menu popup.
 * This is our entry point.
 * @returns {HTMLElement|null} The share menu element.
 */
function findShareMenu() {
  // This selector is based on the HTML provided. It's fragile.
  // We look for the main dialog that contains the "Compartir" / "Share" tabs.
  return document.querySelector('div[role="dialog"] .notion-share-menu');
}

/**
 * Parses all existing user/group rows from the share menu.
 * @param {HTMLElement} shareMenu - The main share menu element.
 * @returns {Array} An array of objects: { email, permissionButton }
 */
function parseUserRows(shareMenu) {
  const rows = [];
  // This selector finds all rows for users/groups that are NOT the current user.
  // It relies on the structure you provided.
  const rowElements = shareMenu.querySelectorAll('div[role="button"][tabindex="0"]');

  rowElements.forEach(row => {
    try {
      // Find the email (in the 12px, secondary text div)
      const emailEl = row.querySelector('div[style*="font-size: 12px"] > div[style*="font-size: 12px"]');
      // Find the permission dropdown button
      const permissionButton = row.querySelector('div[role="button"][aria-expanded="false"]');

      if (emailEl && permissionButton) {
        const email = emailEl.textContent.trim();
        rows.push({ email, permissionButton });
      }
    } catch (e) {
      console.error('ShareSquad Bot: Error parsing a user row.', e, row);
    }
  });
  return rows;
}

/**
 * Finds the correct menu item (e.g., "Can edit") in an open permission menu.
 * This relies 100% on the *order* of items, making it language-independent.
 * @param {string} permissionKey - "full", "edit", "comment", "view"
 * @returns {HTMLElement|null} The menu item to click.
 */
function findPermissionMenuItem(permissionKey) {
  const permissionMap = {
    "full": 0,    // 1st item
    "edit": 1,    // 2nd item
    "comment": 2, // 3rd item
    "view": 3     // 4th item
  };
  const index = permissionMap[permissionKey];
  if (index === undefined) return null;

  // Find the currently open permission menu
  // This class name is from the HTML you provided. VERY FRAGILE.
  const menu = document.querySelector('.notion-sharing-permission-role-select');
  if (!menu) {
    console.error('ShareSquad Bot: Could not find open permission menu.');
    return null;
  }

  // Find all items and pick the one at the correct index
  const menuItems = menu.querySelectorAll('div[role="menuitem"]');
  return menuItems[index];
}

/**
 * Finds the invite button.
 * This relies on the text, so we check both languages.
 * @returns {HTMLElement|null} The invite button.
 */
function findInviteButton() {
  const buttons = Array.from(document.querySelectorAll('div[role="button"]'));
  return buttons.find(btn => btn.textContent === 'Invitar' || btn.textContent === 'Invite');
}

/**
 * Finds the invite permission dropdown (for new invites).
 * @returns {HTMLElement|null} The permission dropdown.
 */
function findInvitePermissionDropdown() {
  // This finds the permission dropdown next to the "Invitar" button
  const inviteButton = findInviteButton();
  if (!inviteButton) return null;

  // This selector is fragile, assumes structure
  const dropdown = inviteButton.parentElement.querySelector('div[role="button"][aria-expanded="false"]');

  // Fallback: If not next to button, find based on text (e.g., "Acceso completo")
  if (!dropdown) {
     const allDropdowns = Array.from(document.querySelectorAll('div[role="button"][aria-expanded="false"]'));
     // This is a weak guess
     return allDropdowns.find(d => d.textContent.includes('Acceso') || d.textContent.includes('Full access'));
  }
  return dropdown;
}

/**
 * Main function for the bot.
 * Implements the "Fusión Aditiva" (Hybrid) logic.
 * @param {object} payload - { emails: [...], permissionKey: "..." }
 */
async function syncPermissionsOnNotionPage(payload) {
  const { emails, permissionKey } = payload;
  const emailsToSync = new Set(emails);
  const emailsFoundInPopup = new Set();

  const shareMenu = findShareMenu();
  if (!shareMenu) {
    // We're not in the share menu, abort.
    return { errorKey: 'syncErrorShareMenu' };
  }

  const userRows = parseUserRows(shareMenu);

  // --- PART 1: UPDATE EXISTING USERS ---
  console.log('ShareSquad Bot: Starting Part 1 (Update existing users)...');
  for (const row of userRows) {
    if (emailsToSync.has(row.email)) {
      console.log(`ShareSquad Bot: Found user ${row.email}, updating permission...`);
      emailsFoundInPopup.add(row.email);

      // Click the permission dropdown
      await clickAndWait(row.permissionButton);

      // Find the correct menu item (e.g., "Can edit")
      const menuItemToClick = findPermissionMenuItem(permissionKey);

      if (menuItemToClick) {
        // Click it to set the permission
        await clickAndWait(menuItemToClick);
      } else {
        console.error(`ShareSquad Bot: Could not find menu item for ${permissionKey}`);
        // Click again to close the dropdown
        await clickAndWait(document.body);
      }

      await sleep(100); // Small delay between users
    }
  }

  // --- PART 2: INVITE NEW USERS ---
  console.log('ShareSquad Bot: Starting Part 2 (Invite new users)...');
  const emailsToInvite = emails.filter(email => !emailsFoundInPopup.has(email));

  if (emailsToInvite.length > 0) {
    console.log(`ShareSquad Bot: Inviting ${emailsToInvite.length} new users...`);

    // 1. Find the email input
    const input = document.querySelector('input[placeholder*="Correo electrónico"], input[placeholder*="Email or group"]');
    if (!input) {
      console.error('ShareSquad Bot: Could not find email input field.');
      return { errorKey: 'syncErrorInput' };
    }

    // 2. Inject emails (using our append logic)
    const currentEmails = input.value.split(',').map(e => e.trim()).filter(e => e.length > 0);
    const combinedEmails = new Set([...currentEmails, ...emailsToInvite]);
    input.value = Array.from(combinedEmails).join(', ');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));

    await sleep(300); // Wait for Notion to process emails

    // 3. Find and click the *invite* permission dropdown
    const inviteDropdown = findInvitePermissionDropdown();
    if (inviteDropdown) {
      await clickAndWait(inviteDropdown);

      // 4. Find and click the correct permission in the menu
      const menuItemToClick = findPermissionMenuItem(permissionKey);
      if (menuItemToClick) {
        await clickAndWait(menuItemToClick);
      } else {
         console.error(`ShareSquad Bot: Could not find invite menu item for ${permissionKey}`);
         await clickAndWait(document.body); // Close dropdown
      }
    } else {
      console.warn('ShareSquad Bot: Could not find invite permission dropdown. Using default permission.');
    }

    // 5. Find and click the "Invite" button
    const inviteButton = findInviteButton();
    if (inviteButton) {
      await clickAndWait(inviteButton);
      console.log('ShareSquad Bot: Invite process complete.');
    } else {
      console.error('ShareSquad Bot: Could not find "Invite" button.');
      return { errorKey: 'syncErrorInviteBtn' };
    }
  }

  return { success: true };
}

// CORREGIDO: Expose the function to the global 'window' scope
window.syncPermissionsOnNotionPage = syncPermissionsOnNotionPage;

// --- NUEVA FUNCIÓN (Para Fase 1) ---
/**
 * This function is serialized and executed *on the Notion page*.
 * It checks if the inject target (email input) exists.
 * @returns {object} { success: true } or { errorKey: '...' }
 */
function preCheckInject() {
  const input = document.querySelector('input[placeholder*="Correo electrónico o grupo"], input[placeholder*="Email or group"]');
  if (input) {
    return { success: true };
  }
  // No podemos encontrar el input. Esto significa que el pop-up de "Invitar" no está abierto.
  // Devolvemos el mismo error que la Fase 2 para ser coherentes.
  return { errorKey: 'syncErrorShareMenu' };
}
// Expose this function as well
window.preCheckInject = preCheckInject;

/**
 * This function is serialized and executed *on the Notion page*.
 * It cannot access any variables from this script's scope.
 * @returns {object} { success: true } or { errorKey: '...' }
 */
function injectEmailsToNotion(emailsToInject) {
  // Find the Notion input field. This is the "fragile" part.
  const input = document.querySelector('input[placeholder*="Correo electrónico o grupo"], input[placeholder*="Email or group"]');

  if (input) {
    const currentEmails = input.value
      .split(',')
      .map(email => email.trim())
      .filter(email => email.length > 0);

    const newEmails = emailsToInject
      .split(',')
      .map(email => email.trim())
      .filter(email => email.length > 0);

    const combinedEmails = new Set([...currentEmails, ...newEmails]);

    const finalEmailString = Array.from(combinedEmails).join(', ');

    input.value = finalEmailString;

    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));

    // Si llegamos aquí, fue un éxito
    return { success: true };
  } else {
    console.error('ShareSquad for Notion: Could not find the share input field.');
    // CORREGIDO: Devolver una clave de error
    return { errorKey: 'syncErrorInput' };
  }
}

// Expose this function as well
window.injectEmailsToNotion = injectEmailsToNotion;
