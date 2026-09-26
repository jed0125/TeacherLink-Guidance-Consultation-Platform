/* ============================================
   Firebase Configuration
   ============================================
   IMPORTANT: Replace the placeholder values below
   with your actual Firebase project credentials.
   You can find these in your Firebase Console:
   Project Settings > General > Your Apps > Web

   After replacing, the format should look like:
   apiKey: "AIzaSy..."
   authDomain: "my-school-app.firebaseapp.com"
   projectId: "my-school-app"
   etc.
   ============================================ */

// Import Firebase from CDN (version 10.x)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// --- Your Firebase Config ---
const firebaseConfig = {
  apiKey: "AIzaSyCyqcajCc_tD6NqiJxY_ASd55tcFoYEibI",
  authDomain: "guidance-consult.firebaseapp.com",
  projectId: "guidance-consult",
  storageBucket: "guidance-consult.firebasestorage.app",
  messagingSenderId: "980942510848",
  appId: "1:980942510848:web:b113861d987e54d1b571e5"
};

// --- Initialize Firebase ---
const app = initializeApp(firebaseConfig);

// Get the Auth instance for login/register
const auth = getAuth(app);

// Get the Firestore instance for reading/writing data
const db = getFirestore(app);

// Export them so other files can use them
export { auth, db };
