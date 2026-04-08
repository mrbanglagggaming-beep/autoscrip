// firebase-config.js
const firebaseConfig = {
  apiKey: "AIzaSyA5_HYl2R1Sa17xBeBhyxO4lGa9lAY5ut4",
  authDomain: "powerscript-pro-web.firebaseapp.com",
  projectId: "powerscript-pro-web",
  storageBucket: "powerscript-pro-web.firebasestorage.app",
  messagingSenderId: "709315727810",
  appId: "1:709315727810:web:abeb73172635061343c65b"
};

// Initialize Firebase
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

window._fbDb = firebase.firestore();
window._fbAuth = firebase.auth();

// Enable offline persistence
window._fbDb.enablePersistence({ synchronizeTabs: true })
  .catch(err => console.warn('Persistence error:', err.code));

// Admin configuration
window.ADMIN_ROLES = new Set(['super_admin', 'admin', 'content_manager', 'moderator']);
window.MASTER_EMAIL = "mrbanglagggaming@gmail.com";
window.MASTER_UID = "E970GEv5ZJFbHaoojCnFe25GSeY1";

function initFirebase() {
  console.log("Firebase initialized");
}
