// Configuration Firebase (SDK compat via CDN)
const firebaseConfig = {
  apiKey: "AIzaSyCmVBCowzkjNJVfIUJeahn7G5_auCRylfs",
  authDomain: "chronos-plannig.firebaseapp.com",
  projectId: "chronos-plannig",
  storageBucket: "chronos-plannig.firebasestorage.app",
  messagingSenderId: "519617612656",
  appId: "1:519617612656:web:eb3dd18ad77a87362d1db5"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Expose auth & db as globals for auth.js and calendar.js
const auth = firebase.auth();
const db = firebase.firestore();

// Persistence locale pour garder la session entre les pages
auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL)
    .catch(err => console.warn('Persistence:', err.message));

console.log('[Firebase] Initialise — projet:', firebaseConfig.projectId);