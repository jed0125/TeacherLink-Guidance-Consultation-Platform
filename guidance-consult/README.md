# Guidance Consultation Platform

**Development and Evaluation of a Web-Based Communication and Guidance Consultation Platform for Students and Teachers**

A simple, mobile-friendly web app for Grade 10 students and teachers/counselors to chat and request consultations. Built with plain HTML, CSS, JavaScript, and Firebase.

---

## 📁 Project Structure

```
guidance-consult/
├── css/
│   └── style.css          ← Shared styles (school-friendly, responsive)
├── js/
│   ├── firebase.js        ← Firebase config (replace placeholders!)
│   ├── auth.js            ← Login, register, logout logic
│   ├── chat.js            ← Chat page logic (Feature 2)
│   └── consult.js         ← Consultations page logic (Feature 3)
├── index.html             ← Login / Register page
├── chat.html              ← Chat page (Feature 2)
├── consult.html           ← Consultations page (Feature 3)
├── firestore.rules        ← Firestore security rules
└── README.md              ← This file
```

---

## 🚀 How to Run with VS Code Live Server

1. Open this folder in VS Code: `guidance-consult/`
2. Right-click on **`index.html`** in the file explorer.
3. Select **"Open with Live Server"**.
4. Your browser will open at `http://127.0.0.1:5500/index.html`

> **Note:** Do NOT open the HTML file directly by double-clicking it
> (e.g., `file:///...`). Firebase Auth requires a real server origin.
> Always use Live Server or another local HTTP server.

---

## ⚙️ How to Set Up Firebase

### Step 1: Create a Firebase Project
1. Go to [https://console.firebase.google.com/](https://console.firebase.google.com/)
2. Click **"Add Project"** and follow the prompts.
3. Give it a name (e.g., `guidance-consult`).
4. Disable Google Analytics (not needed for this project).

### Step 2: Add a Web App to Your Project
1. In your Firebase Console, click the **</>** icon (Web app).
2. Register the app with a nickname (e.g., `GuidanceWeb`).
3. Copy the **Firebase configuration object** — you'll paste it into `js/firebase.js`.

### Step 3: Update Firebase Config
Open **`js/firebase.js`** and replace the placeholder values:

```javascript
const firebaseConfig = {
  apiKey: "AIzaSy...YOUR_KEY",           // ← Paste from Firebase Console
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123..."
};
```

Save the file. You're now connected to Firebase!

### Step 4: Enable Authentication
1. In Firebase Console, go to **Authentication → Sign-in method**.
2. Enable **"Email/Password"** provider.
3. Save.

### Step 5: Create Firestore Database
1. Go to **Firestore Database → Create Database**.
2. Choose **"Start in Test Mode"** for initial setup (we'll secure it with rules next).
3. Pick a region and create.

### Step 6: Apply Security Rules
1. Go to **Firestore Database → Rules**.
2. Replace the default rules with the contents of **`firestore.rules`**.
3. Click **"Publish"**.

---

## 👤 How to Make a Teacher / Counselor Account

Teacher and counselor accounts are **NOT** created through the app interface.

**Method 1: Firebase Console (Recommended)**
1. Go to **Firebase Console → Authentication → Users**.
2. Click **"Add User"**.
3. Enter the teacher's email and password.
4. After creating the user, go to **Firestore Database → Users** and find that user's document.
5. Change the `role` field from `"student"` to `"teacher"`.

**Method 2: Using the Firebase Console data editor:**
1. Create the user via Authentication.
2. Manually add a document to the `users` collection with that user's UID as the document ID, containing:
   ```json
   {
     "name": "Ms. Garcia",
     "email": "ms.garcia@school.edu",
     "role": "teacher",
     "createdAt": "timestamp"
   }
   ```

---

## 🌐 How to Deploy to GitHub Pages

### Step 1: Push to GitHub
```bash
# Initialize git (if not already)
git init
git add .
git commit -m "Initial commit - login/register feature"

# Add your GitHub remote
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git

# Push to main branch
git branch -M main
git push -u origin main
```

### Step 2: Enable GitHub Pages
1. Go to your repository on GitHub.
2. Click **Settings** → **Pages**.
3. Under "Source", select **Deploy from a branch**.
4. Choose the **`main`** branch and folder **`/ (root)`**.
5. Click **Save**.

Your site will be live at `https://YOUR_USERNAME.github.io/YOUR_REPO/` after a few minutes.

### Important for Firebase on GitHub Pages:
Firebase Auth uses the domain's **authorized origins**. After deploying:
1. Go to **Firebase Console → Authentication → Settings**.
2. Add your GitHub Pages URL (e.g., `https://YOUR_USERNAME.github.io`) to the **Authorized domains** list.
3. Firebase automatically allows subdomains, so both `https://` and `http://` variants should work.

---

## 📖 Feature Roadmap

| Feature | Status | File(s) |
|---------|--------|---------|
| Login & Register | ✅ Complete | `index.html`, `js/auth.js` |
| Real-time Chat | ✅ Complete | `chat.html`, `js/chat.js` |
| Consultations | ✅ Complete | `consult.html`, `js/consult.js` |

---

## 🔒 Security Rules Summary

- **Users**: Can only read/write their own profile. Role is locked to `"student"` on registration.
- **Chats**: Only the two people in a conversation can read/write messages.
- **Consultations**: Students can create their own; teachers can only accept/decline their assigned consultations.

See **`firestore.rules`** for the full rule definitions.

---

## 📝 Notes for Defense (Grade 10)

- **Why Firebase?** Firebase handles authentication and real-time data sync without needing a backend server. This makes the app simple and easy to deploy.
- **Why Firestore?** It stores data as documents (like JSON), which is easy to understand and query in real time.
- **Security Rules** protect the data so students can't pretend to be teachers, and only chat participants can see their messages.
