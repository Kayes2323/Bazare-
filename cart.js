// ============================================================
// BAZARE — Cart System
// cart.js
// ============================================================

function getCart() {
  try { return JSON.parse(localStorage.getItem('bazare_cart') || '[]'); } catch { return []; }
}
function saveCart(cart) {
  localStorage.setItem('bazare_cart', JSON.stringify(cart));
  updateCartBadge();
}
// Alias used by cart.html (was referenced but never defined).
function saveLocalCart(cart) { saveCart(cart); }
function clearCart() { saveCart([]); }
// Pages register rendered products here so onclick handlers only need an id (no user text inside attributes).
window.productCache = window.productCache || {};
function addToCartById(id, btn) {
  const p = window.productCache[id];
  if (!p) return;
  addToCart({ id: p.id, name: p.name, price: p.price, imageUrl: p.imageUrl || '', emoji: p.emoji || '📦', sellerId: p.sellerId }, btn);
}
function addToCart(product, btn) {
  requireAuth(() => {
    const cart = getCart();
    const ex   = cart.find(i => i.id === product.id);
    if (ex) ex.qty = (ex.qty || 1) + 1;
    else cart.push({ ...product, qty: 1 });
    saveCart(cart);
    if (btn) {
      const orig = btn.textContent;
      btn.textContent = '✓ যোগ হয়েছে';
      btn.style.cssText += 'background:#f0b429;color:#000;';
      setTimeout(() => { btn.textContent = orig; btn.style.background = ''; btn.style.color = ''; }, 1500);
    }
    showToast('🛒 কার্টে যোগ হয়েছে', 'success');
  });
}
function removeFromCart(id) { saveCart(getCart().filter(i => i.id !== id)); }
function updateQty(id, qty) {
  if (qty <= 0) { removeFromCart(id); return; }
  const cart = getCart();
  const item = cart.find(i => i.id === id);
  if (item) { item.qty = qty; saveCart(cart); }
}
function getCartCount() { return getCart().reduce((s, i) => s + (i.qty || 1), 0); }
function getCartTotal() { return getCart().reduce((s, i) => s + (i.price * (i.qty || 1)), 0); }
function updateCartBadge() {
  const n = getCartCount();
  document.querySelectorAll('.cart-badge').forEach(el => {
    el.textContent = n;
    el.style.display = n > 0 ? 'flex' : 'none';
  });
}
document.addEventListener('DOMContentLoaded', updateCartBadge);