/* ============================================
   Common Shared Helpers
   Moved here so auth.js, chat.js, and consult.js
   can import them without running login-page code.
   ============================================ */

import { auth, db } from "./firebase.js";
import {
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import {
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

// --- Get Current User's Profile from Firestore ---
export async function getCurrentUserProfile(uid) {
  try {
    const docRef = doc(db, "users", uid);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      // Return the user data (name, email, role, etc.)
      return { exists: true, data: docSnap.data() };
    } else {
      // No profile found (shouldn't happen if registered properly)
      return { exists: false };
    }
  } catch (error) {
    return { exists: false, error: error.message };
  }
}

// --- Logout the Current User ---
export async function logoutUser() {
  try {
    await signOut(auth);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}