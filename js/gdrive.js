/* ═══════════════════════════════════════════════
   Google Drive configuration
   ─────────────────────────────────────────────
   To enable Google Drive import, fill in the
   three values below from your Google Cloud
   Console project. Leave them empty to disable.

   Setup steps:
   1. Go to https://console.cloud.google.com
   2. Create a project (or use an existing one)
   3. Enable "Google Picker API" and "Google Drive API"
   4. Create an API Key (Credentials > Create Credentials > API Key)
   5. Create an OAuth 2.0 Client ID (type: Web application)
      - Add your domain to "Authorized JavaScript origins"
        e.g. http://localhost:8080 for local dev
   6. Configure the OAuth consent screen
   7. Paste values below
   ═══════════════════════════════════════════════ */
const GDRIVE_CLIENT_ID = '';  // e.g. '123456789.apps.googleusercontent.com'
const GDRIVE_API_KEY   = '';  // e.g. 'AIzaSy...'
const GDRIVE_APP_ID    = '';  // Your Cloud project number (numeric)

const GDRIVE_SCOPES = 'https://www.googleapis.com/auth/drive.file';
const AUDIO_MIMETYPES = 'audio/mpeg,audio/mp3';

/* ═══════════════════════════════════════════════
   Google Drive Picker integration
   ═══════════════════════════════════════════════ */

const gdriveEnabled = !!(GDRIVE_CLIENT_ID && GDRIVE_API_KEY && GDRIVE_APP_ID);

let gdrivePickerReady = false;
let gdriveTokenClient = null;
let gdriveAccessToken = null;

function initGoogleDrive() {
  if (!gdriveEnabled) return;

  // Wait for gapi
  function waitGapi() {
    if (typeof gapi !== 'undefined') {
      gapi.load('picker', () => {
        gdrivePickerReady = true;
        enableGdriveButtons();
      });
    } else {
      setTimeout(waitGapi, 200);
    }
  }

  // Wait for GIS (Google Identity Services)
  function waitGis() {
    if (typeof google !== 'undefined' && google.accounts && google.accounts.oauth2) {
      gdriveTokenClient = google.accounts.oauth2.initTokenClient({
        client_id: GDRIVE_CLIENT_ID,
        scope: GDRIVE_SCOPES,
        callback: '', // set before each request
      });
      enableGdriveButtons();
    } else {
      setTimeout(waitGis, 200);
    }
  }

  waitGapi();
  waitGis();
}

function enableGdriveButtons() {
  if (!gdrivePickerReady || !gdriveTokenClient) return;
  document.querySelectorAll('.gdrive-btn').forEach(btn => btn.disabled = false);
}

/**
 * Open the Google Drive Picker.
 * multiSelect: if true, allow picking multiple files.
 * Returns a promise resolving to an array of { name, blob } objects.
 */
function openDrivePicker(multiSelect) {
  return new Promise((resolve, reject) => {
    function showPicker() {
      const docsView = new google.picker.DocsView(google.picker.ViewId.DOCS);
      docsView.setIncludeFolders(true);
      docsView.setMimeTypes(AUDIO_MIMETYPES);

      const builder = new google.picker.PickerBuilder()
        .enableFeature(google.picker.Feature.NAV_HIDDEN)
        .setDeveloperKey(GDRIVE_API_KEY)
        .setAppId(GDRIVE_APP_ID)
        .setOAuthToken(gdriveAccessToken)
        .addView(docsView)
        .setTitle('Select MP3 file' + (multiSelect ? 's' : ''))
        .setCallback(async (data) => {
          if (data.action === google.picker.Action.PICKED) {
            try {
              const docs = data[google.picker.Response.DOCUMENTS];
              const results = [];
              for (const doc of docs) {
                const fileId = doc[google.picker.Document.ID];
                const fileName = doc[google.picker.Document.NAME];
                const blob = await downloadDriveFile(fileId);
                results.push({ name: fileName, blob });
              }
              resolve(results);
            } catch (err) {
              reject(err);
            }
          } else if (data.action === google.picker.Action.CANCEL) {
            resolve([]);
          }
        });

      if (multiSelect) {
        builder.enableFeature(google.picker.Feature.MULTISELECT_ENABLED);
      }

      builder.build().setVisible(true);
    }

    // Get or refresh the OAuth token
    gdriveTokenClient.callback = (tokenResponse) => {
      if (tokenResponse.error) {
        reject(new Error('Google auth error: ' + tokenResponse.error));
        return;
      }
      gdriveAccessToken = tokenResponse.access_token;
      showPicker();
    };

    if (gdriveAccessToken === null) {
      gdriveTokenClient.requestAccessToken({ prompt: 'consent' });
    } else {
      gdriveTokenClient.requestAccessToken({ prompt: '' });
    }
  });
}

async function downloadDriveFile(fileId) {
  const url = 'https://www.googleapis.com/drive/v3/files/' + encodeURIComponent(fileId) + '?alt=media';
  const response = await fetch(url, {
    headers: { 'Authorization': 'Bearer ' + gdriveAccessToken },
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error('Drive download failed (' + response.status + '): ' + text);
  }
  return response.blob();
}

// Show setup notice if Drive is not configured
function showGdriveSetupNotice(noticeEl) {
  if (gdriveEnabled) return;
  noticeEl.innerHTML =
    'Google Drive import is available but needs API keys. ' +
    'Set <code>GDRIVE_CLIENT_ID</code>, <code>GDRIVE_API_KEY</code>, and ' +
    '<code>GDRIVE_APP_ID</code> in <code>js/gdrive.js</code>. ' +
    'See the comments there for setup steps.';
  noticeEl.classList.add('active');
}

// Boot Google Drive
initGoogleDrive();
