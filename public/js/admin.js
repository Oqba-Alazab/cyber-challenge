const loginContainer = document.getElementById('loginContainer');
const dashboardContainer = document.getElementById('dashboardContainer');
const loginForm = document.getElementById('loginForm');
const logoutBtn = document.getElementById('logoutBtn');
const loginError = document.getElementById('loginError');
const toast = document.getElementById('toast');

// Check authentication status on page load
async function checkAuthStatus() {
  try {
    const response = await fetch('/api/admin/status');
    if (!response.ok) throw new Error('Server unreachable');
    const data = await response.json();

    if (data.authenticated) {
      showDashboard(data);
      loadParticipants();
      loadStats();
    } else {
      showLogin();
    }
  } catch (error) {
    showLogin();
    loginError.textContent = 'تنبيه: لا يمكن الاتصال بالخادم. تأكد من تشغيل الخادم بشكل صحيح.';
    loginError.classList.add('show');
  }
}

function showLogin() {
  loginContainer.classList.add('active');
  dashboardContainer.classList.remove('active');
}

function showDashboard(data) {
  loginContainer.classList.remove('active');
  dashboardContainer.classList.add('active');
  if (data && data.username) {
    document.getElementById('headerMeta').textContent = `مرحباً، ${data.username} • Cyber Challenge 2026`;
  }
}

// Show a temporary toast message
function showToast(message) {
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toast._timeout);
  toast._timeout = setTimeout(() => toast.classList.remove('show'), 2200);
}

// Handle login
if (loginForm) {
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const submitBtn = loginForm.querySelector('button');

    submitBtn.disabled = true;
    submitBtn.textContent = 'جاري التحقق...';
    loginError.classList.remove('show');

    try {
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username, password })
      });

      const data = await response.json();

      if (data.success) {
        showDashboard(data);
        await Promise.all([loadParticipants(), loadStats()]);
        loginForm.reset();
      } else {
        loginError.textContent = data.message || 'خطأ في بيانات الدخول';
        loginError.classList.add('show');
      }
    } catch (error) {
      loginError.textContent = 'حدث خطأ: ' + error.message;
      loginError.classList.add('show');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'دخول';
    }
  });
}

// Handle logout
if (logoutBtn) {
  logoutBtn.addEventListener('click', async () => {
    try {
      await fetch('/api/admin/logout', { method: 'POST' });
      showLogin();
    } catch (error) {
      console.error('Logout error:', error);
    }
  });
}

// Load statistics
async function loadStats() {
  try {
    const response = await fetch('/api/stats');
    const data = await response.json();

    if (data.success) {
      const total = data.total || 0;
      const granted = data.granted || 0;
      const rate = total > 0 ? Math.round((granted / total) * 100) : 0;

      document.getElementById('totalParticipants').textContent = total;
      document.getElementById('grantedPermissions').textContent = granted;
      document.getElementById('approvalRate').textContent = rate + '%';
      document.getElementById('countBadge').textContent = total + ' مشارك';
    }
  } catch (error) {
    console.error('Error loading stats:', error);
  }
}

// Format a date in Arabic
function formatArabicDate(isoString) {
  const date = new Date(isoString);
  return date.toLocaleString('ar-SA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

// Load participants as square image cards
async function loadParticipants() {
  try {
    const response = await fetch('/api/admin/participants');
    const data = await response.json();

    const loadingDiv = document.getElementById('participantsLoading');
    const emptyDiv = document.getElementById('participantsEmpty');
    const grid = document.getElementById('participantsGrid');

    participantsCount = data.success ? data.participants.length : 0;
    if (btnDeleteAll) {
      btnDeleteAll.disabled = participantsCount === 0;
      btnDeleteAll.textContent = participantsCount === 0 ? '🗑️ لا يوجد مشاركون' : '🗑️ حذف الكل';
    }

    if (data.success && data.participants.length > 0) {
      loadingDiv.style.display = 'none';
      emptyDiv.style.display = 'none';
      grid.style.display = 'grid';

      grid.innerHTML = '';

      data.participants.forEach((participant, index) => {
        const card = document.createElement('div');
        card.className = 'card';
        card.style.animationDelay = Math.min(index * 40, 400) + 'ms';

        const isGranted = participant.camera_permission === 'granted';
        const statusClass = isGranted ? 'granted' : 'denied';
        const statusText = isGranted ? '✓ موافق' : '✗ رفض';

        const photoHtml = participant.image_filename
          ? `
            <img src="/uploads/${participant.image_filename}" alt="صورة ${participant.participant_code}" loading="lazy">
            <div class="zoom-hint">🔍 عرض الصورة</div>
          `
          : `
            <div class="no-photo">
              <span class="icon">📷</span>
              لا توجد صورة
            </div>
          `;

        card.innerHTML = `
          <div class="card-photo-wrap" ${participant.image_filename ? `data-action="view" data-id="${participant.id}" data-code="${participant.participant_code}" data-filename="${participant.image_filename}" data-created="${participant.created_at}" data-permission="${participant.camera_permission}"` : ''}>
            <span class="card-status ${statusClass}">${statusText}</span>
            ${photoHtml}
          </div>
          <div class="card-body">
            <div class="card-code">
              <span>${participant.participant_code}</span>
              <button class="copy-btn" data-copy="${participant.participant_code}" title="نسخ الكود">📋</button>
            </div>
            <div class="card-date">🕒 ${formatArabicDate(participant.created_at)}</div>
            <div class="card-actions">
              ${participant.image_filename
                ? `<button class="btn-view" data-action="view" data-id="${participant.id}" data-code="${participant.participant_code}" data-filename="${participant.image_filename}" data-created="${participant.created_at}" data-permission="${participant.camera_permission}">🔍 عرض الصورة</button>`
                : `<button class="btn-view" disabled style="opacity:.5; cursor:not-allowed;">📷 لا توجد صورة</button>`}
              <button class="btn-delete" data-action="delete" data-id="${participant.id}" title="حذف المشارك">🗑️ حذف</button>
            </div>
          </div>
        `;

        grid.appendChild(card);
      });

      // Attach event listeners to all interactive elements in the grid
      grid.querySelectorAll('[data-action="view"]').forEach(btn => {
        btn.addEventListener('click', () => {
          viewImage(
            btn.getAttribute('data-id'),
            btn.getAttribute('data-code'),
            btn.getAttribute('data-filename'),
            btn.getAttribute('data-created'),
            btn.getAttribute('data-permission')
          );
        });
      });

      grid.querySelectorAll('.copy-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const code = btn.getAttribute('data-copy');
          navigator.clipboard.writeText(code)
            .then(() => showToast('✓ تم نسخ الكود: ' + code))
            .catch(() => {
              // Fallback for older browsers
              const ta = document.createElement('textarea');
              ta.value = code;
              document.body.appendChild(ta);
              ta.select();
              document.execCommand('copy');
              document.body.removeChild(ta);
              showToast('✓ تم نسخ الكود: ' + code);
            });
        });
      });

      grid.querySelectorAll('.btn-delete').forEach(btn => {
        btn.addEventListener('click', () => deleteParticipant(btn.getAttribute('data-id')));
      });

      // Show delete-all confirmation with the current count
      if (btnDeleteAll) {
        btnDeleteAll.onclick = () => openConfirmDeleteAll(participantsCount);
      }

    } else {
      loadingDiv.style.display = 'none';
      emptyDiv.style.display = 'flex';
      grid.style.display = 'none';
    }
  } catch (error) {
    console.error('Error loading participants:', error);
    document.getElementById('participantsLoading').textContent = 'حدث خطأ في تحميل البيانات';
  }
}

// View image in modal
window.viewImage = function(id, code, filename, createdAt, permission) {
  const modal = document.getElementById('imageModal');
  document.getElementById('modalImage').src = `/uploads/${filename}`;
  document.getElementById('modalParticipantCode').textContent = code;
  document.getElementById('modalCreatedAt').textContent = formatArabicDate(createdAt);
  document.getElementById('modalPermission').textContent = permission === 'granted' ? '✓ موافق' : '✗ رفض';

  // Download button behavior
  const downloadBtn = document.getElementById('btnDownload');
  downloadBtn.onclick = () => {
    const a = document.createElement('a');
    a.href = `/uploads/${filename}`;
    a.download = `participant-${code}.jpg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    showToast('⬇️ جارٍ تحميل الصورة...');
  };

  modal.classList.add('active');
};

window.closeImageModal = function() {
  document.getElementById('imageModal').classList.remove('active');
};

// Delete ALL participants
let participantsCount = 0;
const confirmDialog = document.getElementById('confirmDeleteAll');
const confirmOkBtn = document.getElementById('confirmOkBtn');
const confirmCancelBtn = document.getElementById('confirmCancelBtn');
const btnDeleteAll = document.getElementById('btnDeleteAll');

function openConfirmDeleteAll(count) {
  document.getElementById('deleteAllCount').textContent = count;
  confirmDialog.classList.add('active');
}

function closeConfirmDeleteAll() {
  confirmDialog.classList.remove('active');
}

if (confirmCancelBtn) {
  confirmCancelBtn.addEventListener('click', closeConfirmDeleteAll);
}

if (confirmDialog) {
  confirmDialog.addEventListener('click', (e) => {
    if (e.target.id === 'confirmDeleteAll') closeConfirmDeleteAll();
  });
}

if (confirmOkBtn) {
  confirmOkBtn.addEventListener('click', async () => {
    closeConfirmDeleteAll();
    try {
      const response = await fetch('/api/admin/participants', { method: 'DELETE' });
      const data = await response.json();
      if (data.success) {
        showToast(`✓ تم حذف ${data.deletedCount || 0} مشاركًا`);
        loadParticipants();
        loadStats();
      } else {
        alert('خطأ: ' + (data.message || 'لم يتم حذف المشاركين'));
      }
    } catch (error) {
      console.error('Error deleting all participants:', error);
      alert('حدث خطأ أثناء حذف جميع المشاركين');
    }
  });
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && confirmDialog && confirmDialog.classList.contains('active')) {
    closeConfirmDeleteAll();
  }
});

async function deleteParticipant(id) {
  if (!confirm('هل أنت متأكد من حذف هذا المشارك؟ سيتم حذف الصورة أيضًا.')) {
    return;
  }

  try {
    const response = await fetch(`/api/admin/participants/${id}`, {
      method: 'DELETE'
    });

    const data = await response.json();

    if (data.success) {
      showToast('✓ تم حذف المشارك');
      loadParticipants();
      loadStats();
    } else {
      alert('خطأ: ' + (data.message || 'لم يتم حذف المشارك'));
    }
  } catch (error) {
    console.error('Error deleting participant:', error);
    alert('حدث خطأ أثناء حذف المشارك');
  }
}

// Close modal when clicking outside or pressing Escape
const imageModal = document.getElementById('imageModal');
if (imageModal) {
  imageModal.addEventListener('click', (e) => {
    if (e.target.id === 'imageModal') {
      closeImageModal();
    }
  });
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeImageModal();
  }
});

// Initialize on page load
checkAuthStatus();

// Refresh data every 30 seconds
setInterval(() => {
  if (dashboardContainer && dashboardContainer.classList.contains('active')) {
    loadParticipants();
    loadStats();
  }
}, 30000);
