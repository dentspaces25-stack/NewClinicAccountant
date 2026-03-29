// ============================================
// CONFIGURATION - Set these two values
// ============================================
let GEMINI_API_KEY = localStorage.getItem('gemini_api_key') || '';
let APPS_SCRIPT_URL = localStorage.getItem('apps_script_url') || '';

// ============================================
// State
// ============================================
let selectedImageBase64 = null;
let originalImageSrc = null;
let cropper = null;
let extractedRows = [];

// ============================================
// Init
// ============================================
document.addEventListener('DOMContentLoaded', () => {
  // Load saved settings
  const keyInput = document.getElementById('geminiKeyInput');
  const urlInput = document.getElementById('appsScriptUrlInput');
  if (keyInput) keyInput.value = GEMINI_API_KEY;
  if (urlInput) urlInput.value = APPS_SCRIPT_URL;

  // Set today's date
  const dateInput = document.getElementById('dateInput');
  if (dateInput) {
    dateInput.value = new Date().toISOString().split('T')[0];
  }
});

// ============================================
// Settings
// ============================================
function saveSettings() {
  const key = document.getElementById('geminiKeyInput').value.trim();
  const url = document.getElementById('appsScriptUrlInput').value.trim();
  GEMINI_API_KEY = key;
  APPS_SCRIPT_URL = url;
  localStorage.setItem('gemini_api_key', key);
  localStorage.setItem('apps_script_url', url);
  showStatus('settingsStatus', 'success', 'تم حفظ الإعدادات');
  setTimeout(() => hideStatus('settingsStatus'), 2000);
}

// ============================================
// Image Upload
// ============================================
function handleImageUpload(input) {
  const file = input.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    const base64Full = e.target.result;
    selectedImageBase64 = base64Full.split(',')[1];
    originalImageSrc = base64Full;

    // Show preview
    const preview = document.getElementById('imagePreview');
    const previewContainer = document.getElementById('previewContainer');
    preview.src = base64Full;
    previewContainer.style.display = 'block';

    // Destroy old cropper if exists
    if (cropper) {
      cropper.destroy();
      cropper = null;
    }

    // Initialize cropper
    preview.onload = () => {
      cropper = new Cropper(preview, {
        viewMode: 1,
        dragMode: 'move',
        autoCropArea: 1,
        responsive: true,
        background: false,
      });
    };

    // Enable extract button
    document.getElementById('extractBtn').disabled = false;

    // Hide previous results
    document.getElementById('resultsCard').classList.add('hidden');
  };
  reader.readAsDataURL(file);
}

function applyCrop() {
  if (!cropper) return;

  const canvas = cropper.getCroppedCanvas();
  const croppedBase64 = canvas.toDataURL('image/jpeg', 0.9);
  selectedImageBase64 = croppedBase64.split(',')[1];

  // Replace preview with cropped image
  cropper.destroy();
  cropper = null;

  const preview = document.getElementById('imagePreview');
  preview.src = croppedBase64;

  showStatus('extractStatus', 'success', 'تم قص الصورة بنجاح');
  setTimeout(() => hideStatus('extractStatus'), 2000);
}

function resetCrop() {
  if (!originalImageSrc) return;

  if (cropper) {
    cropper.destroy();
    cropper = null;
  }

  const preview = document.getElementById('imagePreview');
  preview.src = originalImageSrc;
  selectedImageBase64 = originalImageSrc.split(',')[1];

  preview.onload = () => {
    cropper = new Cropper(preview, {
      viewMode: 1,
      dragMode: 'move',
      autoCropArea: 1,
      responsive: true,
      background: false,
    });
  };
}

// ============================================
// Extract Data with Gemini
// ============================================
async function extractData() {
  if (!selectedImageBase64) return;

  if (!GEMINI_API_KEY) {
    showStatus('extractStatus', 'error', 'يرجى إدخال مفتاح Gemini API في الإعدادات أعلاه');
    return;
  }

  const btn = document.getElementById('extractBtn');
  btn.disabled = true;
  showStatus('extractStatus', 'loading', '<span class="spinner"></span> جاري استخراج البيانات...');

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              {
                text: `أنت مساعد لاستخراج البيانات من صور جداول مكتوبة بخط اليد.
استخرج البيانات من هذه الصورة وأرجعها بصيغة JSON فقط بدون أي نص إضافي.

الأعمدة هي:
- name (الاسم)
- paid (المدفوع - رقم)
- notes (الملاحظات)
- extra (الاضافي - رقم)
- paidFromExtra (المدفوع من الاضافي - رقم)

أرجع النتيجة بهذا الشكل بالضبط:
{"rows": [{"name": "...", "paid": "...", "notes": "...", "extra": "...", "paidFromExtra": "..."}]}

إذا كانت خانة فارغة اتركها نص فارغ "".
مهم جداً: اكتب الأرقام بالأرقام الإنجليزية (0-9) وليس العربية (٠-٩).
أرجع JSON فقط بدون أي شرح أو نص إضافي.`
              },
              {
                inlineData: {
                  mimeType: 'image/jpeg',
                  data: selectedImageBase64
                }
              }
            ]
          }]
        })
      }
    );

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error?.message || `HTTP ${response.status}`);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    // Parse JSON from response (handle markdown code blocks)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('لم يتم العثور على بيانات في الرد');
    }

    const parsed = JSON.parse(jsonMatch[0]);
    extractedRows = parsed.rows || [];

    if (extractedRows.length === 0) {
      showStatus('extractStatus', 'error', 'لم يتم العثور على بيانات في الصورة');
      btn.disabled = false;
      return;
    }

    renderTable();
    document.getElementById('resultsCard').classList.remove('hidden');
    showStatus('extractStatus', 'success', `تم استخراج ${extractedRows.length} صفوف بنجاح`);

  } catch (error) {
    showStatus('extractStatus', 'error', 'خطأ: ' + error.message);
  }

  btn.disabled = false;
}

// ============================================
// Render Editable Table
// ============================================
function renderTable() {
  const tbody = document.getElementById('dataBody');
  tbody.innerHTML = '';

  extractedRows.forEach((row, index) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><input type="text" value="${escapeHtml(row.name || '')}" onchange="updateRow(${index}, 'name', this.value)"></td>
      <td><input type="text" value="${escapeHtml(row.paid || '')}" onchange="updateRow(${index}, 'paid', this.value)"></td>
      <td><input type="text" value="${escapeHtml(row.notes || '')}" onchange="updateRow(${index}, 'notes', this.value)"></td>
      <td><input type="text" value="${escapeHtml(row.extra || '')}" onchange="updateRow(${index}, 'extra', this.value)"></td>
      <td><input type="text" value="${escapeHtml(row.paidFromExtra || '')}" onchange="updateRow(${index}, 'paidFromExtra', this.value)"></td>
      <td><button class="delete-btn" onclick="deleteRow(${index})">حذف</button></td>
    `;
    tbody.appendChild(tr);
  });
}

function updateRow(index, field, value) {
  extractedRows[index][field] = value;
}

function deleteRow(index) {
  extractedRows.splice(index, 1);
  renderTable();
}

function addRow() {
  extractedRows.push({ name: '', paid: '', notes: '', extra: '', paidFromExtra: '' });
  renderTable();
}

// ============================================
// Submit to Google Sheet
// ============================================
async function submitToSheet() {
  if (extractedRows.length === 0) return;

  if (!APPS_SCRIPT_URL) {
    showStatus('submitStatus', 'error', 'يرجى إدخال رابط Google Apps Script في الإعدادات أعلاه');
    return;
  }

  const btn = document.getElementById('submitBtn');
  btn.disabled = true;
  showStatus('submitStatus', 'loading', '<span class="spinner"></span> جاري الحفظ في Google Sheets...');

  const date = document.getElementById('dateInput').value;

  try {
    const response = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date, rows: extractedRows })
    });

    // With no-cors mode, we can't read the response, but the request is sent
    showStatus('submitStatus', 'success', 'تم الإرسال بنجاح! تحقق من Google Sheet');

    // Clear the form after successful submit
    setTimeout(() => {
      extractedRows = [];
      document.getElementById('resultsCard').classList.add('hidden');
      document.getElementById('previewContainer').style.display = 'none';
      selectedImageBase64 = null;
      document.getElementById('extractBtn').disabled = true;
      hideStatus('submitStatus');
      hideStatus('extractStatus');
    }, 3000);

  } catch (error) {
    showStatus('submitStatus', 'error', 'خطأ في الإرسال: ' + error.message);
  }

  btn.disabled = false;
}

// ============================================
// Utilities
// ============================================
function showStatus(id, type, message) {
  const el = document.getElementById(id);
  el.className = 'status ' + type;
  el.innerHTML = message;
}

function hideStatus(id) {
  const el = document.getElementById(id);
  el.className = 'status';
  el.style.display = 'none';
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML.replace(/"/g, '&quot;');
}
