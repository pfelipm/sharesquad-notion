[🇪🇸 Spanish version](README.md)

# ShareSquad for Notion

## Description

ShareSquad for Notion is a Chrome extension designed to streamline how you collaborate with external individuals in Notion.

To understand the value it provides, it's important to know how Notion manages access:
*   **Members:** They have workspace-wide access. They are typically internal team members with broad permissions to create and edit, and each one represents a cost per seat in the billing plan.
*   **Guests:** They are external collaborators invited only to specific pages. Their access is limited, and they are often a more economical option, as Notion plans usually include a number of free guests.

The challenge arises when you need to repeatedly invite the same groups of external collaborators to different pages. Notion does not offer a native way to group these guests. **ShareSquad solves this problem** by allowing you to create and manage "squads" (teams) of guests, so you can add them to any page efficiently.

## Features and Workflow

The extension offers two modes of operation from the side panel, both requiring the user to have previously opened Notion's share dialog:

### 1. Manual Injection (Button "Inject")

This is the main and most stable feature.
*   **Workflow:**
    1.  On the Notion page, the user **must click "Share"** to open the share dialog.
    2.  In the extension's panel, select a group.
    3.  Click the **"Inject"** button.
*   **Result:** The extension will paste the group's email addresses into the invitation field of the already-open dialog. **Important:** Injected users are added to the existing permissions; they never replace them. The user must manually click Notion's "Invite" button to finalize the process.

### 2. Automatic Synchronization (Button "Sync Permissions" - Experimental)

This is the new experimental feature that automates part of the process.
*   **Workflow:**
    1.  On the Notion page, the user **must click "Share"** to open the share dialog.
    2.  In the extension's panel, select one or more users and/or groups.
    3.  Click the new **"Sync Permissions"** button.
*   **Result:** The extension will simulate typing the email addresses into the already-open dialog and perform the necessary clicks to send the invitations automatically.
*   **Important Behavior:**
    *   **Additive Process:** New users from your selection are invited to the page.
    *   **Permission Modification:** If a user in your selection has already been invited to the page, this function can **update their access level** (e.g., from "Can view" to "Can edit").
    *   **No Deletion:** This process **will never remove a user** from the page's access list, even if they are not part of your current selection. This is a safety measure to prevent accidental removal of access.

---

### Other Features

*   **Guest and Group Management:** Create, edit, and delete guest profiles (name and email) and group them into reusable "squads".
*   **Data Import and Export:** Back up your guests and groups to a JSON file.
*   **Cross-Device Sync:** Your configurations are saved and synchronized through your Chrome account.

## Technical Details

*   **Architecture:** The extension uses **Manifest V3**, with a background *Service Worker* and the *Side Panel* API.
*   **Storage:** Data is securely stored using `chrome.storage.sync`.
*   **Required Permissions:**
    *   `tabs`: To verify that you are on a Notion page.
    *   `scripting`: Necessary for the "Inject" and "Sync Permissions" buttons to interact with Notion's share dialog.
    *   `storage`: To save and sync your guest and group lists.
    *   `sidePanel`: To display the extension's user interface.
*   **Warning about the Experimental Feature:** The **"Sync Permissions"** button's functionality is experimental because it directly manipulates the DOM (the internal structure) of Notion's share dialog. If Notion changes its design, this button could stop working. The "Inject" button is simpler and more likely to remain functional after future Notion updates.

## Installation (Developer Mode)

As this is an experimental extension, it must be installed manually:

1.  **Download the Repository:** Click the `Code` → `Download ZIP` button. Alternatively, you can clone the repository using `git clone https://github.com/pfelipm/sharesquad-notion.git`.
2.  **Unzip the File:** Extract the ZIP file's contents to a permanent folder on your computer.
3.  **Open Chrome Extensions:** Go to `chrome://extensions`.
4.  **Enable Developer Mode:** Activate the switch in the top-right corner.
5.  **Load the Extension:** Click "Load unpacked" and select the `extension-package` folder located inside the folder where you extracted the files.
6.  **Done!** The extension will appear in your list, ready to use on `notion.so`.

## Credits and Contributions

This project was created and is maintained by **[Pablo Felip](https://www.linkedin.com/in/pfelipm/)**.

## License

This project is distributed under the terms of the [LICENSE](/LICENSE) file.
