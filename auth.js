// ============================================================
// BAZARE — Auth System (Fixed)
// auth.js
// ============================================================

let currentUser    = null;
let currentProfile = null;
let pendingAction  = null;
let recaptchaVerifier  = null;
let confirmationResult = null;

auth.onAuthStateChanged(async (user) => {
  currentUser = user;
  if (user) {
    // Handle redirect result first
    try {
      const result = await auth.getRedirectResult();
      if (result?.user) {
        hideAuthModal();
        showToast('✅ Google দিয়ে লগইন সফল!', 'success');
      }
    } catch(e) { console.log('redirect result:', e); }

    currentProfile = await loadOrCreateProfile(user);
    updateNavUI(user, currentProfile);
    if (pendingAction) { pendingAction(); pendingAction = null; }
  } else {
    currentProfile = null;
    updateNavUI(null, null);
  }
});

async function loadOrCreateProfile(user) {
  const ref  = db.collection(COL.USERS).doc(user.uid);
  const snap = await ref.get();
  if (!snap.exists) {
    const profile = {
      uid:       user.uid,
      name:      user.displayName || '',
      email:     user.email || '',
      phone:     user.phoneNumber || '',
      photoURL:  user.photoURL || '',
      role:      'buyer',
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    };
    await ref.set(profile);
    return profile;
  }
  return snap.data();
}

function updateNavUI(user, profile) {
  const loginBtn   = document.getElementById('nav-login-btn');
  const userMenu   = document.getElementById('nav-user-menu');
  const userName   = document.getElementById('nav-user-name');
  const userAvatar = document.getElementById('nav-user-avatar');
  const sellerLink = document.getElementById('nav-seller-link');
  const adminLink  = document.getElementById('nav-admin-link');

  if (!loginBtn) return;

  if (user && profile) {
    loginBtn.style.display = 'none';
    if (userMenu)   userMenu.style.display  = 'flex';
    const name = (profile.name || user.displayName || 'আপনি').split(' ')[0];
    if (userName)   userName.textContent    = name;
    if (userAvatar) {
      userAvatar.innerHTML = user.photoURL
        ? `<img src="${user.photoURL}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`
        : name[0].toUpperCase();
    }
    if (sellerLink) sellerLink.style.display = profile.role === 'seller' ? 'inline-flex' : 'none';
    if (adminLink)  adminLink.style.display  = profile.role === 'admin'  ? 'inline-flex' : 'none';
  } else {
    loginBtn.style.display = 'inline-flex';
    if (userMenu)   userMenu.style.display   = 'none';
    if (sellerLink) sellerLink.style.display = 'none';
    if (adminLink)  adminLink.style.display  = 'none';
  }
}

function requireAuth(action) {
  if (currentUser) action();
  else { pendingAction = action; showAuthModal(); }
}

function showAuthModal(hint = '') {
  const modal = document.getElementById('auth-modal');
  if (!modal) return;
  showAuthStep('main');
  const hintEl = document.getElementById('auth-hint');
  if (hint && hintEl) hintEl.textContent = hint;
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
  const el = document.getElementById('auth-step-' + step);
  if (el) el.classList.remove('hidden');
}

// ── Google Login ──
async function loginWithGoogle() {
  try {
    const provider = new firebase.auth.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });

    try {
      await auth.signInWithPopup(provider);
      hideAuthModal();
      showToast('✅ Google দিয়ে লগইন সফল!', 'success');
    } catch (popupErr) {
      if (popupErr.code === 'auth/popup-blocked' ||
          popupErr.code === 'auth/popup-closed-by-user') {
        // Fallback to redirect
        await auth.signInWithRedirect(provider);
        return;
      }
      throw popupErr;
    }
  } catch (err) {
    console.error('Google login error:', err);
    if (err.code === 'auth/unauthorized-domain') {
      showToast('❌ Firebase Console এ bazare.vercel.app domain add করুন', 'error');
    } else if (err.code === 'auth/network-request-failed') {
      showToast('❌ Internet connection চেক করুন', 'error');
    } else if (err.code !== 'auth/popup-closed-by-user') {
      showToast('❌ লগইন ব্যর্থ: ' + (err.message || 'অজানা সমস্যা'), 'error');
    }
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
  if (phone.length < 13) { showToast('সঠিক ফোন নম্বর দিন', 'error'); return; }
  try {
    sendBtn.disabled = true; sendBtn.textContent = 'পাঠানো হচ্ছে...';
    if (!recaptchaVerifier) {
      recaptchaVerifier = new firebase.auth.RecaptchaVerifier('recaptcha-container', { size: 'invisible' });
    }
    confirmationResult = await auth.signInWithPhoneNumber(phone, recaptchaVerifier);
    showAuthStep('phone-otp');
    const el = document.getElementById('otp-sent-to');
    if (el) el.textContent = phone;
    document.querySelector('.otp-input')?.focus();
    showToast('📱 OTP পাঠানো হয়েছে!', 'success');
  } catch (err) {
    console.error('OTP error:', err);
    if (err.code === 'auth/too-many-requests') {
      showToast('❌ অনেকবার চেষ্টা করেছেন। কিছুক্ষণ পর আবার চেষ্টা করুন।', 'error');
    } else {
      showToast('❌ OTP পাঠাতে ব্যর্থ। নম্বর চেক করুন।', 'error');
    }
    recaptchaVerifier = null;
  } finally {
    if (sendBtn) { sendBtn.disabled = false; sendBtn.textContent = 'OTP পাঠান'; }
  }
}

// ── Phone Login — Verify OTP ──
async function verifyOTP() {
  const inputs = document.querySelectorAll('.otp-input');
  const btn    = document.getElementById('verify-otp-btn');
  const otp    = Array.from(inputs).map(i => i.value).join('');
  if (otp.length !== 6) { showToast('৬ সংখ্যার OTP দিন', 'error'); return; }
  try {
    btn.disabled = true; btn.textContent = 'যাচাই হচ্ছে...';
    await confirmationResult.confirm(otp);
    hideAuthModal();
    showToast('✅ লগইন সফল!', 'success');
  } catch {
    showToast('❌ OTP ভুল। আবার চেষ্টা করুন।', 'error');
    inputs.forEach(i => i.value = '');
    inputs[0]?.focus();
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'নিশ্চিত করুন'; }
  }
}

// ── Logout ──
async function logout() {
  await auth.signOut();
  showToast('লগআউট সফল', 'info');
  window.location.href = 'index.html';
}

// ── User Dropdown ──
function toggleUserDropdown() {
  const dd = document.getElementById('user-dropdown');
  if (!dd) return;
  dd.style.display = dd.style.display === 'none' ? 'block' : 'none';
}

// ── Toast ──
function showToast(msg, type = 'info') {
  let c = document.getElementById('toast-container');
  if (!c) {
    c = document.createElement('div');
    c.id = 'toast-container';
    c.style.cssText = 'position:fixed;bottom:90px;right:20px;z-index:9999;display:flex;flex-direction:column;gap:8px;';
    document.body.appendChild(c);
  }
  const bg = type === 'success' ? '#1a7a3c' : type === 'error' ? '#e53e3e' : '#2d3748';
  const t  = document.createElement('div');
  t.style.cssText = `background:${bg};color:white;padding:12px 18px;border-radius:12px;font-size:14px;font-weight:500;box-shadow:0 8px 24px rgba(0,0,0,0.2);font-family:'Hind Siliguri',sans-serif;max-width:320px;animation:slideDown 0.3s ease;`;
  t.textContent = msg;
  c.appendChild(t);
  setTimeout(() => { t.style.opacity='0'; t.style.transition='opacity 0.3s'; setTimeout(()=>t.remove(),300); }, 3500);
}

// ── Init ──
document.addEventListener('DOMContentLoaded', () => {
  // OTP auto-advance
  document.querySelectorAll('.otp-input').forEach((input, idx, all) => {
    input.addEventListener('input', e => {
      input.value = e.target.value.replace(/\D/g,'').slice(-1);
      if (input.value && idx < all.length-1) all[idx+1].focus();
    });
    input.addEventListener('keydown', e => {
      if (e.key==='Backspace' && !input.value && idx>0) all[idx-1].focus();
    });
  });

  // Close modal on backdrop
  document.getElementById('auth-modal')?.addEventListener('click', e => {
    if (e.target.id === 'auth-modal') hideAuthModal();
  });

  // Close dropdown outside click
  document.addEventListener('click', e => {
    const dd = document.getElementById('user-dropdown');
    if (dd && !e.target.closest('#nav-user-menu')) dd.style.display = 'none';
  });
});