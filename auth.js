// ============================================================
// BAZARE — Auth System
// auth.js
// ============================================================

let currentUser   = null;
let currentProfile = null; // Firestore user doc
let pendingAction  = null;
let recaptchaVerifier   = null;
let confirmationResult  = null;

// ── Auth State Listener ──
auth.onAuthStateChanged(async (user) => {
  currentUser = user;

  if (user) {
    // Load or create user profile in Firestore
    currentProfile = await loadOrCreateUserProfile(user);
    updateNavUI(user, currentProfile);

    if (pendingAction) {
      pendingAction();
      pendingAction = null;
    }
  } else {
    currentProfile = null;
    updateNavUI(null, null);
  }
});

// ── Load or Create User Profile ──
async function loadOrCreateUserProfile(user) {
  const ref = db.collection(COLLECTIONS.USERS).doc(user.uid);
  const snap = await ref.get();

  if (!snap.exists) {
    // New user — create profile
    const profile = {
      uid:         user.uid,
      name:        user.displayName || '',
      email:       user.email || '',
      phone:       user.phoneNumber || '',
      photoURL:    user.photoURL || '',
      role:        ROLES.BUYER,
      createdAt:   firebase.firestore.FieldValue.serverTimestamp(),
    };
    await ref.set(profile);
    return profile;
  }

  return snap.data();
}

// ── Update Navbar UI ──
function updateNavUI(user, profile) {
  const loginBtn   = document.getElementById('nav-login-btn');
  const userMenu   = document.getElementById('nav-user-menu');
  const userNameEl = document.getElementById('nav-user-name');
  const userAvatarEl = document.getElementById('nav-user-avatar');
  const sellerLink = document.getElementById('nav-seller-link');
  const adminLink  = document.getElementById('nav-admin-link');

  if (!loginBtn) return;

  if (user && profile) {
    loginBtn.style.display = 'none';
    if (userMenu) userMenu.style.display = 'flex';

    const name = (profile.name || user.displayName || 'আপনি').split(' ')[0];
    if (userNameEl) userNameEl.textContent = name;

    if (userAvatarEl) {
      if (user.photoURL) {
        userAvatarEl.innerHTML = `<img src="${user.photoURL}" alt="avatar" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`;
      } else {
        userAvatarEl.textContent = name[0].toUpperCase();
      }
    }

    // Show seller dashboard link if approved seller
    if (sellerLink) {
      sellerLink.style.display = profile.role === ROLES.SELLER ? 'flex' : 'none';
    }

    // Show admin link if admin
    if (adminLink) {
      adminLink.style.display = profile.role === ROLES.ADMIN ? 'flex' : 'none';
    }

  } else {
    loginBtn.style.display = 'flex';
    if (userMenu) userMenu.style.display = 'none';
    if (sellerLink) sellerLink.style.display = 'none';
    if (adminLink)  adminLink.style.display  = 'none';
  }
}

// ── Require Auth Before Action ──
function requireAuth(action) {
  if (currentUser) {
    action();
  } else {
    pendingAction = action;
    showAuthModal();
  }
}

// ── Show / Hide Auth Modal ──
function showAuthModal(hint = '') {
  const modal = document.getElementById('auth-modal');
  if (!modal) return;
  showAuthStep('main');
  if (hint) {
    const el = document.getElementById('auth-hint');
    if (el) el.textContent = hint;
  }
  modal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function hideAuthModal() {
  const modal = document.getElementById('auth-modal');
  if (!modal) return;
  modal.classList.add('hidden');
  document.body.style.overflow = '';
}

function showAuthStep(step) {
  document.querySelectorAll('.auth-step').forEach(el => el.classList.add('hidden'));
  const el = document.getElementById(`auth-step-${step}`);
  if (el) el.classList.remove('hidden');
}

// ── Google Login ──
async function loginWithGoogle() {
  try {
    const provider = new firebase.auth.GoogleAuthProvider();
    await auth.signInWithPopup(provider);
    hideAuthModal();
    showToast('✅ Google দিয়ে লগইন সফল!', 'success');
  } catch (err) {
    console.error(err);
    showToast('❌ লগইন ব্যর্থ হয়েছে: ' + err.message, 'error');
  }
}

// ── Phone Login — Send OTP ──
async function sendOTP() {
  const phoneInput = document.getElementById('phone-input');
  const sendBtn    = document.getElementById('send-otp-btn');
  if (!phoneInput) return;

  let phone = phoneInput.value.trim();
  if (phone.startsWith('0')) phone = '+88' + phone;
  else if (!phone.startsWith('+')) phone = '+880' + phone;

  if (phone.length < 13) {
    showToast('সঠিক ফোন নম্বর দিন (যেমন: 01712345678)', 'error');
    return;
  }

  try {
    sendBtn.disabled = true;
    sendBtn.textContent = 'পাঠানো হচ্ছে...';

    if (!recaptchaVerifier) {
      recaptchaVerifier = new firebase.auth.RecaptchaVerifier('recaptcha-container', {
        size: 'invisible'
      });
    }

    confirmationResult = await auth.signInWithPhoneNumber(phone, recaptchaVerifier);
    showAuthStep('phone-otp');

    const sentToEl = document.getElementById('otp-sent-to');
    if (sentToEl) sentToEl.textContent = phone;

    const firstInput = document.querySelector('.otp-input');
    if (firstInput) firstInput.focus();

    showToast('📱 OTP পাঠানো হয়েছে!', 'success');
  } catch (err) {
    console.error(err);
    showToast('❌ OTP পাঠাতে ব্যর্থ। নম্বর চেক করুন।', 'error');
    recaptchaVerifier = null;
  } finally {
    if (sendBtn) { sendBtn.disabled = false; sendBtn.textContent = 'OTP পাঠান'; }
  }
}

// ── Phone Login — Verify OTP ──
async function verifyOTP() {
  const inputs = document.querySelectorAll('.otp-input');
  const verifyBtn = document.getElementById('verify-otp-btn');
  const otp = Array.from(inputs).map(i => i.value).join('');

  if (otp.length !== 6) {
    showToast('৬ সংখ্যার OTP দিন', 'error');
    return;
  }

  try {
    verifyBtn.disabled = true;
    verifyBtn.textContent = 'যাচাই হচ্ছে...';
    await confirmationResult.confirm(otp);
    hideAuthModal();
    showToast('✅ ফোন নম্বর দিয়ে লগইন সফল!', 'success');
  } catch (err) {
    showToast('❌ OTP ভুল। আবার চেষ্টা করুন।', 'error');
    inputs.forEach(i => i.value = '');
    inputs[0].focus();
  } finally {
    if (verifyBtn) { verifyBtn.disabled = false; verifyBtn.textContent = 'নিশ্চিত করুন'; }
  }
}

// ── Logout ──
async function logout() {
  await auth.signOut();
  showToast('লগআউট সফল', 'info');
  window.location.href = 'index.html';
}

// ── OTP Input Auto-advance ──
function setupOTPInputs() {
  const inputs = document.querySelectorAll('.otp-input');
  inputs.forEach((input, idx) => {
    input.addEventListener('input', (e) => {
      const val = e.target.value.replace(/\D/g, '');
      input.value = val.slice(-1);
      if (val && idx < inputs.length - 1) inputs[idx + 1].focus();
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && !input.value && idx > 0) inputs[idx - 1].focus();
    });
    input.addEventListener('paste', (e) => {
      e.preventDefault();
      const pasted = (e.clipboardData || window.clipboardData).getData('text').replace(/\D/g, '');
      inputs.forEach((inp, i) => inp.value = pasted[i] || '');
      if (pasted.length >= 6) inputs[5].focus();
    });
  });
}

// ── Toast ──
function showToast(msg, type = 'info') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.style.cssText = 'position:fixed;bottom:90px;right:24px;z-index:9999;display:flex;flex-direction:column;gap:10px;pointer-events:none;';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.style.cssText = `background:${type==='success'?'#1a7a3c':type==='error'?'#e53e3e':'#2d3748'};color:white;padding:14px 20px;border-radius:12px;font-size:14px;font-weight:500;box-shadow:0 8px 24px rgba(0,0,0,0.2);animation:slideDown 0.3s ease;pointer-events:auto;max-width:320px;font-family:'Hind Siliguri',sans-serif;`;
  toast.textContent = msg;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// Init on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  setupOTPInputs();

  // Close modal on backdrop click
  const modal = document.getElementById('auth-modal');
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) hideAuthModal();
    });
  }
});