/* ============================================
   Authentication Module
   Handles login and register only.
   Uses Firebase Authentication (email/password) v9 modular SDK.
   Shared helpers (getCurrentUserProfile, logoutUser)
   live in js/common.js.
   ============================================ */

// Import Firebase auth and Firestore from our config file
import { auth, db } from "./firebase.js";

// Import Firestore methods needed for user registration
import {
  doc,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// Import modular auth functions from Firebase v10
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

// --- Register a New User ---
// New accounts are ALWAYS created as "student" role.
// Teachers/counselors are set manually in Firebase Console.
export async function registerUser(name, email, password) {
  try {
    // 1. Create the user with email & password via Firebase Auth
    const userCredential = await createUserWithEmailAndPassword(
      auth,
      email,
      password
    );
    const user = userCredential.user;

    // 2. Save extra user info to Firestore (name, role, etc.)
    //    The role is always "student" when registering through the app.
    //    NOTE: email is intentionally NOT saved in the users document.
    await setDoc(doc(db, "users", user.uid), {
      name: name,
      role: "student", // Always student on registration
      createdAt: serverTimestamp()
    });

    // 3. Return success with the user object
    return { success: true, user: user };
  } catch (error) {
    // If something goes wrong, return the error message
    return { success: false, error: error.message };
  }
}

// --- Login an Existing User ---
export async function loginUser(email, password) {
  try {
    // Sign in with email and password
    const userCredential = await signInWithEmailAndPassword(
      auth,
      email,
      password
    );
    return { success: true, user: userCredential.user };
  } catch (error) {
    return { success: false, error: error.message };
  }
}