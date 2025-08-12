// js/script.js
// ===================================================================================
// FIREBASE SDK IMPORTS
// ===================================================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut, signInAnonymously } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, collection, addDoc, onSnapshot, orderBy, query, serverTimestamp, deleteDoc, doc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// ===================================================================================
// FIREBASE CONFIGURATION (GUNAKAN PUNYA KAMU)
// ===================================================================================
const firebaseConfig = {
  apiKey: "AIzaSyBtwTZezlde_klGTybktv76cYmSvV9CiuE",
  authDomain: "penyimpan-prompt-asn.firebaseapp.com",
  projectId: "penyimpan-prompt-asn",
  storageBucket: "penyimpan-prompt-asn.firebasestorage.app",
  messagingSenderId: "369533423191",
  appId: "1:369533423191:web:dff66a2beaade29fc91d12",
  measurementId: "G-B5X32ER47K"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const cloudinaryUrl = "https://api.cloudinary.com/v1_1/imajinasilokal/image/upload";
const cloudinaryPreset = "simpan_lokal";


// ===================================================================================
// DOM REFS
// ===================================================================================
const authButton = document.getElementById('authButton');
const landingPage = document.getElementById('landingPage');
const createCollectionPage = document.getElementById('createCollectionPage');
const savedCollectionsPage = document.getElementById('savedCollectionsPage');
const gallery = document.getElementById('gallery');
const emptyGallery = document.getElementById('emptyGallery');

// Detail Modal refs
const detailModal = document.getElementById('detailModal');
const closeDetailModalBtn = document.getElementById('closeDetailModalBtn');

// Create refs
const imageInput = document.getElementById('imageInput');
const imagePreview = document.getElementById('imagePreview');
const previewImg = document.getElementById('previewImg');

// ===================================================================================
// FIRESTORE REFS
// ===================================================================================
const getAiCollectionsRef = (userId) => collection(db, `users/${userId}/aiCollections`);

// ===================================================================================
// UTILITIES
// ===================================================================================
window.showToast = (message) => {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2000);
};

window.showPage = (pageId) => {
  landingPage.classList.add('hidden');
  createCollectionPage.classList.add('hidden');
  savedCollectionsPage.classList.add('hidden');
  document.getElementById(pageId).classList.remove('hidden');

  if (pageId === 'savedCollectionsPage') {
    window.renderGallery();
  }
};

// Copy helpers
window.copyElementText = (id) => {
  const el = document.getElementById(id);
  if (!el) return;
  const txt = el.textContent || '';
  navigator.clipboard.writeText(txt).then(() => showToast('Disalin.'));
};

window.copyAllParameters = () => {
  const blocks = ['detailPlatform','detailModel','detailPrompt','detailNegativePrompt','detailNotes'];
  const txt = blocks.map(id => `${id}:\n${(document.getElementById(id)?.textContent||'-').trim()}`).join('\n\n');
  navigator.clipboard.writeText(txt).then(() => showToast('Semua parameter disalin.'));
};

// ===================================================================================
// AUTH
// ===================================================================================
const googleProvider = new GoogleAuthProvider();

window.signInWithGoogle = async () => {
  await signInWithPopup(auth, googleProvider);
};

window.signOutUser = async () => {
  await signOut(auth);
};

window.handleAuthClick = async () => {
  if (window.currentUser) {
    try {
      await window.signOutUser();
      showToast('Logout berhasil');
    } catch (e) {
      console.error(e); showToast('Logout gagal');
    }
  } else {
    try {
      await window.signInWithGoogle();
      showToast('Login berhasil');
    } catch (e) {
      console.error(e); showToast('Login gagal');
    }
  }
};

onAuthStateChanged(auth, (user) => {
  window.currentUser = user || null;
  if (user) {
    authButton.innerHTML = '<i class="fa-solid fa-sign-out-alt mr-2"></i>Logout';
    authButton.classList.remove('bg-red-600','hover:bg-red-700');
    authButton.classList.add('bg-gray-600','hover:bg-gray-700');
    loadCollections(user.uid);
    showPage('landingPage');
  } else {
    authButton.innerHTML = '<i class="fa-solid fa-sign-in-alt mr-2"></i>Login';
    authButton.classList.remove('bg-gray-600','hover:bg-gray-700');
    authButton.classList.add('bg-red-600','hover:bg-red-700');
    // login anonim untuk test offline/dev
    signInAnonymously(auth).catch(err => console.warn('Anon login gagal:', err));
    showPage('landingPage');
  }
});

// ===================================================================================
// DATA & RENDER
// ===================================================================================
window.collections = [];

window.loadCollections = (userId) => {
  if (window.unsubscribeSnapshot) window.unsubscribeSnapshot();
  const q = query(getAiCollectionsRef(userId), orderBy('createdAt', 'desc'));
  window.unsubscribeSnapshot = onSnapshot(q, (snap) => {
    window.collections = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    window.renderGallery();
  });
};

window.renderGallery = (filtered = window.collections) => {
  gallery.innerHTML = '';
  if (!filtered || filtered.length === 0) {
    emptyGallery.classList.remove('hidden');
    gallery.classList.add('hidden');
    return;
  }
  emptyGallery.classList.add('hidden');
  gallery.classList.remove('hidden');

  filtered.forEach((item) => {
    const tagsHtml = (item.tags||'').split(',').map(t=>t.trim()).filter(Boolean).map(tag=>`<span class="badge bg-indigo-100 text-indigo-800">${tag}</span>`).join(' ');

    const wrap = document.createElement('div');
    wrap.className = 'gallery-item bg-white rounded-xl overflow-hidden border border-gray-200 flex flex-col';
    wrap.innerHTML = `
      <div class="relative">
        <img src="${item.imageUrl}" class="w-full h-48 object-cover" onerror="this.src='https://placehold.co/600x400?text=No+Image'"/>
        <div class="absolute top-2 right-2">
          <span class="badge bg-indigo-100 text-indigo-800 capitalize">${item.platform||'-'}</span>
        </div>
      </div>
      <div class="p-4 flex flex-col gap-2 flex-grow">
        <h3 class="font-semibold truncate">${item.model||'N/A'}</h3>
        <div class="text-sm text-gray-600 line-clamp-3">${(item.prompt||'').replace(/</g,'&lt;')}</div>
        <div class="flex flex-wrap gap-2 mt-1">${tagsHtml}</div>
        <div class="mt-3 flex gap-2">
          <button type="button" class="view-detail-btn px-3 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 font-medium" data-id="${item.id}">Lihat Detail</button>
        </div>
      </div>`;
    gallery.appendChild(wrap);
  });
};

// ===================================================================================
// DETAIL MODAL
// ===================================================================================
window.showDetail = (id) => {
  const idx = window.collections.findIndex(c => c.id === id);
  const item = window.collections[idx];
  if (!item) { console.warn('Item tidak ditemukan', id); return; }

  document.getElementById('detailImage').src = item.imageUrl || '';
  document.getElementById('detailPlatform').textContent = item.platform || '-';
  document.getElementById('detailModel').textContent = item.model || '-';
  document.getElementById('detailPrompt').textContent = item.prompt || '-';
  document.getElementById('detailNegativePrompt').textContent = item.negativePrompt || '-';
  document.getElementById('detailNotes').textContent = item.notes || '-';

  const tags = (item.tags||'').split(',').map(t=>t.trim()).filter(Boolean);
  document.getElementById('detailTags').innerHTML = tags.map(t=>`<span class="badge bg-indigo-100 text-indigo-800">${t}</span>`).join(' ');

  detailModal.classList.remove('hidden');
};

window.closeDetailModal = () => detailModal.classList.add('hidden');

// Copy buttons in modal
const bindCopyButtons = () => {
  document.getElementById('copyPromptBtn')?.addEventListener('click', () => window.copyElementText('detailPrompt'));
  document.getElementById('copyNegativePromptBtn')?.addEventListener('click', () => window.copyElementText('detailNegativePrompt'));
  document.getElementById('copyAllParametersBtn')?.addEventListener('click', window.copyAllParameters);
};

// Delete
window.deleteCurrentItem = async () => {
  const img = document.getElementById('detailImage');
  const current = window.collections.find(c => c.imageUrl === img.src);
  if (!current || !window.currentUser) return;
  await deleteDoc(doc(getAiCollectionsRef(window.currentUser.uid), current.id));
  showToast('Item dihapus.');
  window.closeDetailModal();
};

// ===================================================================================
// CREATE FLOW (contoh minimal)
// ===================================================================================
const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

const resetForm = () => {
  document.getElementById('model').value = '';
  document.getElementById('prompt').value = '';
  document.getElementById('negativePrompt').value = '';
  document.getElementById('tags').value = '';
  document.getElementById('notes').value = '';
  imageInput.value = '';
  imagePreview.classList.add('hidden');
};

imageInput?.addEventListener('change', (e) => {
  const file = e.target.files?.[0];
  if (!file) { imagePreview.classList.add('hidden'); return; }
  if (file.size > MAX_IMAGE_SIZE_BYTES) { showToast('Ukuran gambar terlalu besar!'); return; }
  const reader = new FileReader();
  reader.onload = (ev) => { previewImg.src = ev.target.result; imagePreview.classList.remove('hidden'); };
  reader.readAsDataURL(file);
});

const saveBtn = document.getElementById('saveBtn');
saveBtn?.addEventListener('click', async () => {
  if (!window.currentUser) { showToast('Login dulu.'); return; }
  const file = imageInput.files?.[0];
  const payload = {
    imageUrl: file ? previewImg.src : '', // di produksi: upload ke Cloudinary lalu pakai URL
    platform: document.getElementById('platform').value,
    model: document.getElementById('model').value,
    prompt: document.getElementById('prompt').value,
    negativePrompt: document.getElementById('negativePrompt').value,
    tags: document.getElementById('tags').value,
    notes: document.getElementById('notes').value,
    createdAt: serverTimestamp()
  };
  await addDoc(getAiCollectionsRef(window.currentUser.uid), payload);
  showToast('Tersimpan.');
  resetForm();
});

// ===================================================================================
// NAV & GLOBAL LISTENERS
// ===================================================================================
document.addEventListener('DOMContentLoaded', () => {
  // Menu bubble
  document.getElementById('createCollectionMenuItem')?.addEventListener('click', () => window.showPage('createCollectionPage'));
  document.getElementById('savedCollectionsMenuItem')?.addEventListener('click', () => window.showPage('savedCollectionsPage'));
  document.getElementById('settingsMenuItem')?.addEventListener('click', () => window.showToast('Fitur ini akan segera hadir!'));

  // Back buttons
  document.getElementById('backToLandingFromCreate')?.addEventListener('click', () => window.showPage('landingPage'));
  document.getElementById('backToLandingFromSaved')?.addEventListener('click', () => window.showPage('landingPage'));

  // Auth button
  document.getElementById('authButton')?.addEventListener('click', window.handleAuthClick);

  // Login modal button (opsional)
  document.getElementById('signInGoogleBtn')?.addEventListener('click', async () => {
    try { await window.signInWithGoogle(); window.loginModal?.classList?.add('hidden'); } catch {}
  });

  // Gallery click (event delegation) — FIX utama tombol "Lihat Detail"
  gallery?.addEventListener('click', (e) => {
    const btn = e.target.closest('.view-detail-btn');
    if (!btn) return;
    const id = btn.dataset.id; // selalu ada karena ambil dari tombolnya
    window.showDetail(id);
    bindCopyButtons();
  });

  // Close detail modal
  closeDetailModalBtn?.addEventListener('click', window.closeDetailModal);

  // Default page
  window.showPage('landingPage');
});
