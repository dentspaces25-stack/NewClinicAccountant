// ============================================
// Google Apps Script - Copy this code into your Google Apps Script editor
// ============================================
// HOW TO SET UP:
// 1. Open your Google Sheet
// 2. Go to Extensions → Apps Script
// 3. Delete any existing code and paste this entire file
// 4. Click Deploy → New deployment
// 5. Choose "Web app"
// 6. Set "Execute as" = Me, "Who has access" = Anyone
// 7. Click Deploy and copy the URL
// 8. Paste the URL in app.js where it says APPS_SCRIPT_URL
// ============================================

function doPost(e) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    const data = JSON.parse(e.postData.contents);

    const rows = data.rows;
    const date = data.date || '';

    rows.forEach(function(row) {
      sheet.appendRow([
        date,
        row.name || '',
        row.paid || '',
        row.notes || '',
        row.extra || '',
        row.paidFromExtra || ''
      ]);
    });

    return ContentService
      .createTextOutput(JSON.stringify({ success: true, message: 'تم الحفظ بنجاح' }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, message: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// Allow CORS preflight
function doGet(e) {
  return ContentService
    .createTextOutput(JSON.stringify({ status: 'ok', message: 'الخدمة تعمل' }))
    .setMimeType(ContentService.MimeType.JSON);
}
