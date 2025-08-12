// js/script.js

// ===================================================================================
// FIREBASE SDK IMPORTS
// ===================================================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut, signInAnonymously } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, collection, addDoc, getDocs, onSnapshot, query, orderBy, deleteDoc, doc, where } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// ===================================================================================
// FIREBASE CONFIGURATION (SUDAH DIISI DENGAN KREDENSIAL ANDA)
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

// Inisialisasi Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ===================================================================================
// CLOUDINARY CONFIGURATION (SUDAH DIISI DENGAN KREDENSIAL ANDA)
// ===================================================================================
const CLOUDINARY_CLOUD_NAME = "imajinasilokal";
const CLOUDINARY_UPLOAD_PRESET = "simpan_lokal";
const MAX_IMAGE_SIZE_BYTES = 1 * 1024 * 1024; // 1 MB (1 * 1024 KB * 1024 bytes/KB)

// ===================================================================================
// GLOBAL VARIABLES AND DOM ELEMENTS
// ===================================================================================
window.currentUser = null; // Menyimpan objek pengguna yang sedang login
window.collections = [];   // Akan diisi dari Firestore

const gallery = document.getElementById('gallery');
const emptyGallery = document.getElementById('emptyGallery');
const imageForm = document.getElementById('imageForm');
const imageInput = document.getElementById('imageInput');
const previewImg = document.getElementById('previewImg');
const imagePreview = document.getElementById('imagePreview');
const detailModal = document.getElementById('detailModal');
const searchInput = document.getElementById('searchInput');
const platformFilter = document.getElementById('platformFilter');
const loginSection = document.getElementById('loginSection');
const appContent = document.getElementById('appContent');
const authButton = document.getElementById('authButton');

// New page elements
const landingPage = document.getElementById('landingPage');
const createCollectionPage = document.getElementById('createCollectionPage');
const savedCollectionsPage = document.getElementById('savedCollectionsPage');

// New export elements
const exportJsonBtn = document.getElementById('exportJsonBtn');
const exportZipBtn = document.getElementById('exportZipBtn');
const exportFilenameInput = document.getElementById('exportFilename');
const clearAllBtn = document.getElementById('clearAllBtn'); // Changed ID from clearBtn

// Referensi ke koleksi Firestore
const getAiCollectionsRef = (userId) => collection(db, `users/${userId}/aiCollections`);

// ===================================================================================
// UTILITY FUNCTIONS (TOAST, COPY, PAGE NAVIGATION)
// ===================================================================================
window.showToast = (message) => {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
};

// Fungsi untuk menampilkan halaman tertentu
window.showPage = (pageId) => {
    landingPage.classList.add('hidden');
    createCollectionPage.classList.add('hidden');
    savedCollectionsPage.classList.add('hidden');

    document.getElementById(pageId).classList.remove('hidden');

    // Jika masuk ke halaman koleksi, render ulang galeri
    if (pageId === 'savedCollectionsPage') {
        window.renderGallery();
        window.applyFilters();
    }
};

window.copyTextToClipboard = (text) => { // Made global
    if (!text || typeof text !== 'string') {
        showToast('Tidak ada teks untuk disalin.');
        return;
    }
    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text).then(() => {
            showToast('Teks berhasil disalin!');
        }).catch(err => {
            console.error('Gagal menggunakan navigator.clipboard:', err);
            window.fallbackCopy(text); // Call global fallback
        });
    } else {
        window.fallbackCopy(text); // Call global fallback
    }
};

window.fallbackCopy = (text) => { // Made global
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.top = "-9999px";
    textArea.style.left = "-9999px";
    textArea.style.opacity = "0";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
        const successful = document.execCommand('copy');
        if (successful) {
            showToast('Teks berhasil disalin!');
        } else {
            showToast('Gagal menyalin teks.');
        }
    } catch (err) {
        console.error('Gagal menggunakan execCommand:', err);
        showToast('Gagal menyalin teks.');
    }
    document.body.removeChild(textArea);
};

window.copyElementText = (elementId) => { // Made global
    const element = document.getElementById(elementId);
    if (element && element.textContent) {
        window.copyTextToClipboard(element.textContent); // Call global copy
    } else {
        showToast('Tidak ada teks untuk disalin.');
    }
};

// Fungsi untuk menyalin semua parameter dalam format yang rapi
window.copyAllParameters = () => { // Made global
    if (currentDetailIndex < 0 || !window.collections[currentDetailIndex]) return;
    const item = window.collections[currentDetailIndex];
    let textToCopy = `Prompt: ${item.prompt}\n\n`;
    textToCopy += `Negative Prompt: ${item.negativePrompt || '-'}\n\n`;
    textToCopy += `---\n`;
    textToCopy += `Platform: ${item.platform}\n`;
    textToCopy += `Model: ${item.model || 'N/A'}\n`;

    if (item.platform === 'tensor' && item.tensorData) {
        const td = item.tensorData;
        textToCopy += `VAE: ${td.vae || 'Default'}\n`;
        textToCopy += `Sampler: ${td.sampler || '-'}\n`;
        textToCopy += `Scheduler: ${td.scheduler || '-'}\n`;
        textToCopy += `Steps: ${td.steps || '-'}\n`;
        textToCopy += `CFG Scale: ${td.cfg || '-'}\n`;
        textToCopy += `Seed: ${td.seed || '-'}\n`;
        if (td.lora && td.lora.length > 0) {
            textToCopy += `LoRA:\n`; // Tambahkan baris baru untuk daftar LoRA
            td.lora.forEach(l => {
                textToCopy += `  - ${l.name}: ${l.strength}\n`; // Format setiap LoRA dengan indentasi
            });
        }
        if (td.upscaler) textToCopy += `Upscaler: Yes\n`;
        if (td.adetailer) textToCopy += `ADetailer: Yes\n`;
    }
    textToCopy += `---\n`;
    if(item.tags) textToCopy += `Tags: ${item.tags}\n`;
    if(item.notes) textToCopy += `Notes: ${item.notes}\n`;

    window.copyTextToClipboard(textToCopy.trim()); // Call global copy
}

// ===================================================================================
// FIREBASE AUTHENTICATION FUNCTIONS
// ===================================================================================
const googleProvider = new GoogleAuthProvider();

window.signInWithGoogle = async () => {
  try {
    await signInWithPopup(auth, googleProvider);
    showToast('Login berhasil!');
    // onAuthStateChanged akan menangani pembaruan UI
  } catch (error) {
    console.error('Error saat login dengan Google:', error);
    showToast('Login gagal: ' + (error.message || 'Terjadi kesalahan.'));
  }
};

window.signOutUser = async () => {
  try {
    await signOut(auth);
    showToast('Logout berhasil!');
    // onAuthStateChanged akan menangani pembaruan UI
  } catch (error) {
    console.error('Error saat logout:', error);
    showToast('Logout gagal: ' + (error.message || 'Terjadi kesalahan.'));
  }
};

// Fungsi untuk mengubah tombol login/logout
window.handleAuthClick = async () => {
  if (window.currentUser) {
    await window.signOutUser();
  } else {
    await window.signInWithGoogle();
  }
};

// Listener untuk perubahan status autentikasi
onAuthStateChanged(auth, (user) => {
  window.currentUser = user; // Update global user state
  const authButton = document.getElementById('authButton');

  if (user) {
    // User login
    authButton.textContent = 'Logout';
    authButton.classList.remove('bg-red-600', 'hover:bg-red-700');
    authButton.classList.add('bg-gray-600', 'hover:bg-gray-700');
    authButton.innerHTML = '<i class="fa-solid fa-sign-out-alt mr-2"></i>Logout';
    // Hanya muat koleksi jika user sudah login
    window.loadCollections(user.uid);
    window.showPage('landingPage'); // Tampilkan landing page setelah login
  } else {
    // User logout (atau belum login)
    authButton.textContent = 'Login';
    authButton.classList.remove('bg-gray-600', 'hover:bg-gray-700');
    authButton.classList.add('bg-red-600', 'hover:bg-red-700');
    authButton.innerHTML = '<i class="fa-solid fa-sign-in-alt mr-2"></i>Login';
    // Kosongkan koleksi karena tidak ada user yang login
    window.collections = [];
    window.renderGallery();
    if (window.unsubscribeSnapshot) { // Hentikan listener Firestore sebelumnya
        window.unsubscribeSnapshot();
    }
    // Jika tidak ada user login, kita bisa mencoba login anonim untuk pengujian awal
    signInAnonymously(auth).then(() => {
      console.log("Signed in anonymously for initial testing.");
      // onAuthStateChanged akan terpicu lagi dengan user anonim
    }).catch((error) => {
      console.error("Anonymous sign-in failed:", error);
      showToast("Gagal login anonim. Fungsi penyimpanan mungkin tidak aktif.");
    });
    window.showPage('landingPage'); // Tetap tampilkan landing page
  }
});

// ===================================================================================
// FIRESTORE & DATA HANDLING FUNCTIONS
// ===================================================================================

// Fungsi untuk memuat koleksi dari Firestore secara real-time
// Diperbarui untuk mendukung pengguna anonim
window.loadCollections = (userId) => {
    // Hentikan listener sebelumnya jika ada
    if (window.unsubscribeSnapshot) {
        window.unsubscribeSnapshot();
    }

    const userCollectionsRef = getAiCollectionsRef(userId);
    const q = query(userCollectionsRef, orderBy('createdAt', 'desc'));

    window.unsubscribeSnapshot = onSnapshot(q, (snapshot) => {
        window.collections = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        window.renderGallery();
        window.applyFilters(); // Terapkan filter setelah data baru dimuat
    }, (error) => {
        console.error("Error fetching collections from Firestore:", error);
        showToast("Gagal memuat koleksi dari database. Coba login.");
    });
};

// Fungsi untuk menghapus dokumen dari Firestore
window.deleteCollectionFromFirestore = async (collectionId) => {
  if (!window.currentUser) {
    showToast('Anda harus login untuk menghapus koleksi!');
    return;
  }
  try {
    await deleteDoc(doc(db, `users/${window.currentUser.uid}/aiCollections`, collectionId));
    showToast('Koleksi berhasil dihapus dari database! (Gambar di Cloudinary tidak terhapus otomatis)');
    // Catatan: Gambar di Cloudinary tidak dihapus otomatis karena ini adalah unsigned upload.
    // Penghapusan aman dari Cloudinary memerlukan backend.
  } catch (error) {
    console.error('Gagal menghapus koleksi dari Firestore:', error);
    showToast('Gagal menghapus koleksi.');
  }
};

// ===================================================================================
// MAIN APP LOGIC (RENDER GALLERY, FORM SUBMISSION, ETC.)
// ===================================================================================

// Fungsi untuk menampilkan koleksi di galeri
window.renderGallery = (filteredCollections = window.collections) => {
  gallery.innerHTML = '';
  if (filteredCollections.length === 0) {
    emptyGallery.classList.remove('hidden');
    gallery.classList.add('hidden');
    return;
  }
  
  emptyGallery.classList.add('hidden');
  gallery.classList.remove('hidden');

  filteredCollections.forEach((item) => { 
    const tagsHtml = item.tags.split(',').map(tag => tag.trim() ? `<span class="badge bg-indigo-100 text-indigo-800">${tag.trim()}</span>` : '').join('');
    
    const galleryItem = document.createElement('div');
    galleryItem.className = 'gallery-item bg-white rounded-xl overflow-hidden border border-gray-200 flex flex-col';
    galleryItem.innerHTML = `
      <div class="relative">
        <img src="${item.imageUrl}" class="w-full h-48 object-cover" onerror="this.onerror=null;this.src='https://placehold.co/500x500/e2e8f0/e2e8f0?text=Error Image';">
        <div class="absolute top-2 right-2">
          <span class="badge bg-indigo-100 text-indigo-800 capitalize">${item.platform}</span>
        </div>
      </div>
      <div class="p-4 flex flex-col flex-grow">
        <h3 class="font-semibold mb-1 truncate">${item.model || 'N/A'}</h3>
        <p class="text-sm text-gray-600 mb-3 flex-grow">${item.prompt.substring(0, 50)}${item.prompt.length > 50 ? '...' : ''}</p>
        <div class="flex flex-wrap gap-1 mb-3">
          ${tagsHtml}
        </div>
        <button onclick="window.showDetail('${item.id}')" class="w-full mt-auto py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium">
          Lihat Detail
        </button>
      </div>
    `;
    gallery.appendChild(galleryItem);
  });
};

// Handle image preview when selected and check size limit
imageInput.addEventListener('change', function(e) {
  const file = e.target.files[0];
  if (file) {
    if (file.size > MAX_IMAGE_SIZE_BYTES) {
        showToast(`Ukuran gambar terlalu besar! Maksimal ${MAX_IMAGE_SIZE_BYTES / (1024 * 1024)} MB.`);
        imageInput.value = ''; // Clear the input
        imagePreview.classList.add('hidden');
        return;
    }
    const reader = new FileReader();
    reader.onload = function(e) {
      previewImg.src = e.target.result;
      imagePreview.classList.remove('hidden');
    }
    reader.readAsDataURL(file);
  }
});

// Handle platform change to show relevant fields
document.querySelectorAll('input[name="platform"]').forEach(radio => {
  radio.addEventListener('change', function() {
    const isTensor = this.value === 'tensor';
    document.getElementById('tensorFields').classList.toggle('hidden', !isTensor);
    document.getElementById('altModelFields').classList.toggle('hidden', isTensor); 
    
    ['midjourney', 'piclumen', 'gemini', 'leonardo'].forEach(p => {
      const el = document.getElementById(`${p}Models`);
      if (el) el.classList.toggle('hidden', this.value !== p);
    });
  });
});

// Handle custom model input
document.getElementById('model').addEventListener('change', function() {
  document.getElementById('customModel').classList.toggle('hidden', this.value !== 'custom');
});

// Handle form submission to save new collection (via direct Cloudinary upload)
imageForm.addEventListener('submit', async function(e) {
  e.preventDefault();
  
  const imageFile = imageInput.files[0];
  if (!imageFile) {
    showToast('Silakan pilih gambar terlebih dahulu!');
    return;
  }
  if (imageFile.size > MAX_IMAGE_SIZE_BYTES) { // Double check size on submit
    showToast(`Ukuran gambar terlalu besar! Maksimal ${MAX_IMAGE_SIZE_BYTES / (1024 * 1024)} MB.`);
    return;
  }
  if (!window.currentUser) {
    showToast('Anda harus login untuk menyimpan koleksi! (Coba tombol Login)');
    return;
  }

  showToast('Mengunggah gambar ke Cloudinary...');
  
  const platform = document.querySelector('input[name="platform"]:checked').value;
  let model = '';

  if (platform === 'tensor') {
      model = document.getElementById('model').value === 'custom' 
          ? document.getElementById('customModel').value 
          : document.getElementById('model').value;
  } else {
      const modelSelect = document.getElementById(`${platform}Model`);
      if (modelSelect) model = modelSelect.value;
  }
  
  // --- CLOUDINARY DIRECT UPLOAD ---
  const cloudinaryFormData = new FormData();
  cloudinaryFormData.append('file', imageFile);
  cloudinaryFormData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET); // Gunakan unsigned upload preset
  cloudinaryFormData.append('folder', `ai_collections/${window.currentUser.uid}`); // Folder per user di Cloudinary

  let imageUrl = '';
  try {
    const cloudinaryResponse = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, {
      method: 'POST',
      body: cloudinaryFormData
    });

    if (!cloudinaryResponse.ok) {
      const errorData = await cloudinaryResponse.json();
      throw new Error(errorData.error.message || 'Gagal mengunggah gambar ke Cloudinary.');
    }

    const cloudinaryData = await cloudinaryResponse.json();
    imageUrl = cloudinaryData.secure_url; // Dapatkan URL gambar yang aman dari Cloudinary
    showToast('Gambar berhasil diunggah ke Cloudinary!');

    // --- SIMPAN METADATA KE FIRESTORE ---
    const newCollection = {
      imageUrl: imageUrl, // URL gambar dari Cloudinary
      platform: platform,
      model: model,
      prompt: document.getElementById('prompt').value,
      negativePrompt: document.getElementById('negativePrompt').value,
      tags: document.getElementById('tags').value,
      notes: document.getElementById('notes').value,
      userId: window.currentUser.uid, // Simpan UID pengguna
      createdAt: new Date() // Timestamp
    };

    if (platform === 'tensor') {
        newCollection.tensorData = {
            vae: document.getElementById('vae').value,
            sampler: document.getElementById('sampler').value,
            scheduler: document.getElementById('scheduler').value,
            cfg: document.getElementById('cfg').value,
            steps: document.getElementById('steps').value,
            seed: document.getElementById('seed').value || 'acak',
            upscaler: document.getElementById('upscaler').checked,
            adetailer: document.getElementById('adetailer').checked,
            lora: Array.from(document.querySelectorAll('.lora-item')).map(item => {
                const name = item.querySelector('.lora-name').value.trim();
                const strength = item.querySelector('.lora-strength').value;
                return name ? { name, strength } : null;
            }).filter(Boolean)
        };
    }

    const userCollectionsRef = getAiCollectionsRef(window.currentUser.uid);
    await addDoc(userCollectionsRef, newCollection);
    
    showToast('Koleksi berhasil disimpan di Firestore!');
    resetForm();
    // renderGallery akan dipanggil otomatis oleh onSnapshot dari Firestore
  } catch (error) {
    console.error('Error saat menyimpan koleksi:', error);
    showToast('Error: ' + (error.message || 'Terjadi kesalahan saat unggah/simpan.'));
  }
});

// Fungsi untuk mereset form
const resetForm = () => {
    imageForm.reset();
    imagePreview.classList.add('hidden');
    imageInput.value = '';
    document.getElementById('gemini').checked = true;
    document.getElementById('gemini').dispatchEvent(new Event('change'));
};

// Handle Reset Form button
document.getElementById('resetFormBtn').addEventListener('click', () => {
    resetForm();
    showToast('Form telah di-reset.');
});

// Handle Export JSON button with custom filename
window.exportJson = function() { // Made global
  if (window.collections.length === 0) {
    showToast('Tidak ada data untuk diekspor.');
    return;
  }
  let filename = exportFilenameInput.value.trim();
  if (!filename) {
      filename = `koleksi-ai-${new Date().toISOString().slice(0,10)}`;
  }
  filename += '.json';

  const dataStr = JSON.stringify(window.collections, null, 2);
  const dataBlob = new Blob([dataStr], {type: 'application/json'});
  const url = URL.createObjectURL(dataBlob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  showToast('Data berhasil diekspor!');
};

// Handle Export ZIP button (placeholder/explanation)
window.exportZip = function() { // Made global
    showToast('Ekspor ke ZIP dengan gambar memerlukan backend yang lebih kompleks. Untuk saat ini, Anda bisa mengekspor JSON.');
    // Implementasi ZIP dengan gambar dari Cloudinary memerlukan:
    // 1. Library JSZip (https://stuk.github.io/jszip/)
    // 2. Fetch setiap gambar dari URL Cloudinary
    // 3. Menambahkan gambar ke objek JSZip
    // 4. Menghasilkan file ZIP
    // Ini bisa sangat memakan sumber daya browser dan lambat untuk banyak gambar.
    // Jika Anda ingin ZIP hanya berisi JSON, itu lebih mudah:
    // const zip = new JSZip();
    // zip.file(filename.replace('.json', '.zip'), JSON.stringify(window.collections, null, 2));
    // zip.generateAsync({type:"blob"}).then(function(content) {
    //     saveAs(content, filename.replace('.json', '.zip'));
    // });
};


// Handle Import JSON button
window.importJson = () => document.getElementById('importInput').click(); // Made global
document.getElementById('importInput').addEventListener('change', async function(e) {
  const file = e.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = async function(e) {
      try {
        const importedData = JSON.parse(e.target.result);
        if (Array.isArray(importedData)) {
          if (!window.currentUser) {
            showToast('Anda harus login untuk mengimpor koleksi!');
            return;
          }
          showToast('Mengimpor koleksi...');
          const userCollectionsRef = getAiCollectionsRef(window.currentUser.uid);
          
          const importPromises = importedData.map(item => {
            const dataToImport = {
                ...item,
                createdAt: new Date(), 
                userId: window.currentUser.uid 
            };
            delete dataToImport.id; 
            delete dataToImport.imageData; 

            if (!dataToImport.imageUrl || !dataToImport.prompt) {
                console.warn("Melewatkan item impor tidak valid:", item);
                return Promise.resolve();
            }
            return addDoc(userCollectionsRef, dataToImport);
          });
          
          await Promise.all(importPromises.filter(Boolean)); 
          showToast(`${importedData.length} koleksi berhasil diimpor ke database Anda!`);
        } else {
          throw new Error("Format tidak valid");
        }
      } catch (error) {
        console.error('Gagal impor:', error);
        showToast('Gagal impor. Pastikan file JSON valid dan formatnya benar.');
      }
    }
    reader.readAsText(file);
    this.value = ''; // Reset input file
  }
});

// Handle Clear All button (menghapus semua koleksi pengguna)
window.clearAllCollections = async function() { // Made global
    if (!window.currentUser) {
      showToast('Anda harus login untuk menghapus koleksi!');
      return;
    }
    if (window.collections.length === 0) {
        showToast('Tidak ada data untuk dihapus.');
        return;
    }
    const userConfirmed = window.confirm('Apakah Anda yakin ingin menghapus SEMUA koleksi Anda? Tindakan ini tidak dapat dibatalkan.');
    if (userConfirmed) {
        showToast('Menghapus semua koleksi...');
        const userCollectionsRef = getAiCollectionsRef(window.currentUser.uid);
        const q = query(userCollectionsRef);
        const snapshot = await getDocs(q);
        const deletePromises = snapshot.docs.map(docToDelete => deleteDoc(doc(db, `users/${window.currentUser.uid}/aiCollections`, docToDelete.id)));
        try {
            await Promise.all(deletePromises);
            showToast('Semua koleksi telah dihapus dari database! (Gambar di Cloudinary tidak terhapus otomatis)');
        } catch (error) {
            console.error('Gagal menghapus semua koleksi:', error);
            showToast('Gagal menghapus semua koleksi.');
        }
    }
};

// ===================================================================================
// DETAIL MODAL FUNCTIONS
// ===================================================================================

window.showDetail = (id) => { // Made global
  currentDetailIndex = window.collections.findIndex(col => col.id === id);
  const item = window.collections[currentDetailIndex];
  if (!item) {
    console.error("Item tidak ditemukan dengan ID:", id);
    return;
  }

  document.getElementById('detailImage').src = item.imageUrl; 
  document.getElementById('detailPrompt').textContent = item.prompt || '-';
  document.getElementById('detailNegativePrompt').textContent = item.negativePrompt || '-';
  document.getElementById('detailNotes').textContent = item.notes || '-';
  
  document.getElementById('detailPlatform').textContent = item.platform;
  document.getElementById('detailModel').textContent = item.model || 'N/A';
  
  const tagsContainer = document.getElementById('detailTags');
  tagsContainer.innerHTML = item.tags.split(',').map(tag => tag.trim() ? `<span class="badge bg-indigo-100 text-indigo-800">${tag.trim()}</span>` : '').join('');
  
  const tensorParamsContainer = document.getElementById('detailTensorParams');
  if (item.platform === 'tensor' && item.tensorData) {
    tensorParamsContainer.classList.remove('hidden');
    const { tensorData } = item;
    document.getElementById('detailSteps').textContent = tensorData.steps || '-';
    document.getElementById('detailCfg').textContent = tensorData.cfg || '-';
    document.getElementById('detailSampler').textContent = tensorData.sampler || '-';
    document.getElementById('detailScheduler').textContent = tensorData.scheduler || '-';
    document.getElementById('detailSeed').textContent = tensorData.seed || '-';
    document.getElementById('detailVae').textContent = tensorData.vae || 'Default';
    
    const loraContainer = document.getElementById('detailLora');
    // Memastikan setiap LoRA memiliki ID unik untuk disalin
    loraContainer.innerHTML = tensorData.lora?.map((l, i) => 
        `<div class="flex justify-between items-center">
           <span id="loraValue-${item.id}-${i}">${l.name}: ${l.strength}</span>
           <i class="fa-solid fa-copy copy-icon" onclick="window.copyElementText('loraValue-${item.id}-${i}')"></i>
         </div>`
    ).join('') || '<span class="text-gray-500">Tidak ada</span>';
    
    document.getElementById('detailUpscaler').classList.toggle('hidden', !tensorData.upscaler);
    document.getElementById('detailAdetailer').classList.toggle('hidden', !tensorData.adetailer); 
  } else {
    tensorParamsContainer.classList.add('hidden');
  }

  detailModal.classList.remove('hidden');
};

window.closeDetailModal = () => { // Made global
  detailModal.classList.add('hidden');
  currentDetailIndex = -1;
};

window.deleteCurrentItem = async function() { // Made global
    if (currentDetailIndex > -1 && window.currentUser) {
        const itemToDelete = window.collections[currentDetailIndex];
        const userConfirmed = window.confirm('Anda yakin ingin menghapus item ini? Tindakan ini tidak dapat dibatalkan.');
        if (userConfirmed) {
            await window.deleteCollectionFromFirestore(itemToDelete.id);
            window.closeDetailModal(); // Call global
        }
    } else if (!window.currentUser) {
        showToast('Anda harus login untuk menghapus koleksi!');
    }
};

// ===================================================================================
// FILTERING FUNCTIONS
// ===================================================================================

window.applyFilters = () => {
    const searchTerm = searchInput.value.toLowerCase();
    const selectedPlatform = platformFilter.value;

    const filtered = window.collections.filter(item => {
        const matchesSearch = searchTerm === '' ||
            item.prompt.toLowerCase().includes(searchTerm) ||
            item.tags.toLowerCase().includes(searchTerm) ||
            (item.model && item.model.toLowerCase().includes(searchTerm));
        
        const matchesPlatform = selectedPlatform === '' || item.platform === selectedPlatform;

        return matchesSearch && matchesPlatform;
    });
    window.renderGallery(filtered);
};

searchInput.addEventListener('input', window.applyFilters);
platformFilter.addEventListener('change', window.applyFilters);

// ===================================================================================
// APPLICATION INITIALIZATION
// ===================================================================================

document.addEventListener('DOMContentLoaded', () => {
  // Pastikan Gemini terpilih secara default saat DOMContentLoaded
  document.getElementById('gemini').checked = true;
  document.getElementById('gemini').dispatchEvent(new Event('change'));
  
  // Tampilkan halaman landing di awal
  window.showPage('landingPage'); 
  
  // onAuthStateChanged akan secara otomatis mencoba login anonim
  // yang akan memicu loadCollections jika berhasil
});
