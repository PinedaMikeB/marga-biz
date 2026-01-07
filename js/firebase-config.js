/**
 * Firebase Configuration for Marga Website
 * Used by browser-side JavaScript
 */

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCgPJs1Neq2bRMAOvREBeV-f2i_3h1Qx3M",
  authDomain: "sah-spiritual-journal.firebaseapp.com",
  projectId: "sah-spiritual-journal",
  storageBucket: "sah-spiritual-journal.firebasestorage.app",
  messagingSenderId: "450636566224",
  appId: "1:450636566224:web:5c46eb4b827e6fd3ad58d5"
};

// Initialize Firebase (using compatibility mode for simplicity)
firebase.initializeApp(firebaseConfig);

// Initialize services
const db = firebase.firestore();
const functions = firebase.functions();
const storage = firebase.storage();

console.log('✅ Firebase initialized');
console.log('📊 Project:', firebaseConfig.projectId);
