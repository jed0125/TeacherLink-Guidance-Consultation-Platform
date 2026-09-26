/* ============================================
   Chat Page - Real-time Communication
   Features:
   - Shows list of teachers (for students) or students (for teachers)
   - Real-time messaging with Firestore onSnapshot
   - Chat ID = sorted user IDs joined with "_"
   - Messages stored in chats/{chatId}/messages/{msgId}
   ============================================ */

import { auth, db } from "./firebase.js";
import {
  getDocs,
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
  orderBy,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  getCurrentUserProfile,
  logoutUser
} from "./common.js";

// Global variables to track current state
let currentUser = null;           // The logged-in user (from auth)
let currentUserProfile = null;    // User's profile data from Firestore
let currentChatPartner = null;    // The person we're currently chatting with
let messagesUnsubscribe = null;   // Function to unsubscribe from messages listener
let authStateUnsubscribe = null;  // Function to unsubscribe from auth state listener

// Map of contact UID -> last message preview + time (for contact list)
let lastMessageMap = {};

// ========================================
// INITIALIZATION - Run when page loads
// ========================================
document.addEventListener("DOMContentLoaded", () => {
  // Set up auth state listener (waits for Firebase to restore login)
  authStateUnsubscribe = onAuthStateChanged(auth, async (user) => {
    if (!user) {
      // Not signed in -> redirect to login page
      window.location.href = "index.html";
      return;
    }

    try {
      currentUser = user;

      // 1. Load user's profile from Firestore
      currentUserProfile = await getCurrentUserProfile(currentUser.uid);

      // 2. Validate profile exists and has a valid role
      if (!currentUserProfile.exists) {
        showError("User profile not found. Please log in again.");
        await logoutUser();
        window.location.href = "index.html";
        return;
      }

      const role = currentUserProfile.data.role;
      if (!role || (role !== "student" && role !== "teacher")) {
        showError("Invalid user role. Please contact support.");
        await logoutUser();
        window.location.href = "index.html";
        return;
      }

      // 3. Update UI with user info (topbar + page header)
      updateUserBanner();
      updatePageHeader();

      // 4. Load contacts list (opposite role)
      await loadContactsList();

      // 5. Auto-select a contact if requested via URL query (?to=<uid>)
      autoSelectFromURL();

      // 6. Set up event listeners
      setupEventListeners();

    } catch (error) {
      console.error("Initialization error:", error);
      showError("Failed to load chat. Please try again.");
    }
  });
});

// Cleanup on unload
window.addEventListener("beforeunload", () => {
  if (messagesUnsubscribe) messagesUnsubscribe();
  if (authStateUnsubscribe) authStateUnsubscribe();
});

// ========================================
// USER INTERFACE UPDATES
// ========================================

function updateUserBanner() {
  const avatarEl = document.getElementById("userAvatar");
  const name = currentUserProfile.data.name || "User";
  const initials = name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
  avatarEl.textContent = initials;
  avatarEl.classList.add("avatar-gold");

  document.getElementById("userName").textContent = name;

  const role = currentUserProfile.data.role;
  document.getElementById("userRole").textContent =
    role.charAt(0).toUpperCase() + role.slice(1);
}

function updatePageHeader() {
  const role = currentUserProfile.data.role;
  const eyebrowEl = document.getElementById("chatEyebrow");
  const titleEl = document.getElementById("chatTitle");
  const subtitleEl = document.getElementById("chatSubtitle");
  const searchInput = document.getElementById("contactSearch");

  if (role === "teacher") {
    eyebrowEl.textContent = "TEACHER WORKSPACE";
    titleEl.textContent = "Student chat";
    subtitleEl.textContent =
      "Keep consultation conversations focused, private and easy to follow.";
    if (searchInput) searchInput.placeholder = "Search students.";
  } else {
    eyebrowEl.textContent = "STUDENT WORKSPACE";
    titleEl.textContent = "Teacher chat";
    subtitleEl.textContent =
      "Keep consultation conversations focused, private and easy to follow.";
    if (searchInput) searchInput.placeholder = "Search teachers.";
  }
}

function showError(message) {
  const banner = document.querySelector(".topbar");
  const existing = banner.querySelector(".message");
  if (existing) existing.remove();

  const errorDiv = document.createElement("div");
  errorDiv.className = "message error";
  errorDiv.textContent = message;
  banner.appendChild(errorDiv);

  // Remove after 5 seconds
  setTimeout(() => {
    if (errorDiv.parentNode) errorDiv.remove();
  }, 5000);
}

function applyAvatarColor(avatarEl) {
  if (!avatarEl) return;
  // List/conversation avatars stay solid green to match the mockups.
}

// ========================================
// CONTACTS LIST LOADING
// ========================================

async function loadContactsList() {
  try {
    const contactsContainer = document.getElementById("contactsContainer");
    contactsContainer.innerHTML = '<div class="loading">Loading contacts...</div>';

    // Determine opposite role
    const oppositeRole =
      currentUserProfile.data.role === "student" ? "teacher" : "student";

    // Query users collection for opposite role
    const usersRef = collection(db, "users");
    const q = query(usersRef, where("role", "==", oppositeRole));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      contactsContainer.innerHTML = ""; // Clear loading
      const emptyDiv = document.createElement("div");
      emptyDiv.className = "empty-state";
      const iconDiv = document.createElement("div");
      iconDiv.className = "empty-icon";
      iconDiv.textContent = "👥";
      const pDiv = document.createElement("p");
      pDiv.textContent = "No " + oppositeRole + "s found.";
      emptyDiv.appendChild(iconDiv);
      emptyDiv.appendChild(pDiv);
      contactsContainer.appendChild(emptyDiv);
      return;
    }

    // Build list of contacts
    contactsContainer.innerHTML = ""; // Clear loading
    lastMessageMap = {}; // reset

    querySnapshot.forEach((docSnap) => {
      const userData = docSnap.data();
      const contactEl = document.createElement("div");
      contactEl.className = "chat-contact";
      contactEl.dataset.uid = docSnap.id;

      const avatarDiv = document.createElement("div");
      avatarDiv.className = "avatar avatar-sm";
      const name = userData.name || "Unnamed";
      const initials = name
        .split(" ")
        .map((part) => part[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);
      avatarDiv.textContent = initials;

      const infoDiv = document.createElement("div");
      infoDiv.className = "contact-info";

      const topRow = document.createElement("div");
      topRow.className = "contact-top";

      const nameDiv = document.createElement("div");
      nameDiv.className = "contact-name";
      nameDiv.textContent = name;

      const timeDiv = document.createElement("div");
      timeDiv.className = "contact-time";
      timeDiv.textContent = lastMessageMap[docSnap.id]?.time || "";

      topRow.appendChild(nameDiv);
      topRow.appendChild(timeDiv);

      const roleDiv = document.createElement("div");
      roleDiv.className = "contact-role";
      roleDiv.textContent = userData.role || "";

      const msgDiv = document.createElement("div");
      msgDiv.className = "contact-last-msg";
      msgDiv.textContent =
        lastMessageMap[docSnap.id]?.preview || "No messages yet";

      infoDiv.appendChild(topRow);
      infoDiv.appendChild(roleDiv);
      infoDiv.appendChild(msgDiv);

      contactEl.appendChild(avatarDiv);
      contactEl.appendChild(infoDiv);

      contactsContainer.appendChild(contactEl);
    });

    // Add click handlers to all contacts
    document.querySelectorAll(".chat-contact").forEach((contact) => {
      contact.addEventListener("click", () => selectContact(contact));
    });

    // Set up search filter
    setupContactSearch();

  } catch (error) {
    console.error("Error loading contacts:", error);
    const contactsContainer = document.getElementById("contactsContainer");
    contactsContainer.innerHTML = ""; // Clear loading
    const errorDiv = document.createElement("div");
    errorDiv.className = "message error";
    errorDiv.textContent = "Failed to load contacts.";
    contactsContainer.appendChild(errorDiv);
  }
}

function setupContactSearch() {
  const searchInput = document.getElementById("contactSearch");
  if (!searchInput) return;
  // Remove previous listener by replacing node
  const newSearch = searchInput.cloneNode(true);
  searchInput.parentNode.replaceChild(newSearch, searchInput);

  newSearch.addEventListener("input", (e) => {
    const term = e.target.value.toLowerCase();
    document.querySelectorAll(".chat-contact").forEach((contact) => {
      const nameEl = contact.querySelector(".contact-name");
      const roleEl = contact.querySelector(".contact-role");
      const name = (nameEl ? nameEl.textContent : "").toLowerCase();
      const role = (roleEl ? roleEl.textContent : "").toLowerCase();
      contact.style.display = (name.includes(term) || role.includes(term)) ? "flex" : "none";
    });
  });
}

// Load the last message for a single contact (used by auto-select from URL).
async function loadLastMessageForContact(uid) {
  try {
    const uids = [currentUser.uid, uid].sort();
    const chatId = uids.join("_");
    const messagesRef = collection(db, "chats", chatId, "messages");
    const q = query(messagesRef, orderBy("createdAt", "desc"));
    const snapshot = await getDocs(q); // one-time fetch
    if (!snapshot.empty) {
      const docSnap = snapshot.docs[0];
      const msg = docSnap.data();
      lastMessageMap[uid] = {
        preview: msg.text || "",
        time: formatTimeShort(msg.createdAt)
      };
    } else {
      lastMessageMap[uid] = { preview: "No messages yet", time: "" };
    }
  } catch (e) {
    lastMessageMap[uid] = { preview: "No messages yet", time: "" };
  }
}

// ========================================
// URL AUTO-SELECT (for "Message student" from consult page)
// ========================================

async function autoSelectFromURL() {
  const params = new URLSearchParams(window.location.search);
  const to = params.get("to");
  if (!to) return;

  // Clear query param so reloads don't re-trigger
  window.history.replaceState({}, document.title, window.location.pathname);

  // Find the contact element
  const contactEl = document.querySelector('.chat-contact[data-uid="' + to + '"]');
  if (!contactEl) return;

  // Load last message for this contact (updates preview/time)
  await loadLastMessageForContact(to);
  // Refresh the contact row's preview/time
  refreshContactRow(to);

  // Select it
  selectContact(contactEl);

  if (window.innerWidth < 768) {
    document.getElementById("chatLayout")?.classList.add("chat-main-hidden");
  }
}

function refreshContactRow(uid) {
  const contactEl = document.querySelector('.chat-contact[data-uid="' + uid + '"]');
  if (!contactEl) return;
  const info = lastMessageMap[uid];
  if (!info) return;
  const msgDiv = contactEl.querySelector(".contact-last-msg");
  const timeDiv = contactEl.querySelector(".contact-time");
  if (msgDiv) msgDiv.textContent = info.preview;
  if (timeDiv) timeDiv.textContent = info.time;
}

// ========================================
// CONTACT SELECTION & CHAT LOADING
// ========================================

async function selectContact(contactElement) {
  // Update active state in UI
  document.querySelectorAll(".chat-contact").forEach((c) => {
    c.classList.remove("active");
  });
  contactElement.classList.add("active");

  // Get the selected contact's UID and data
  const partnerUid = contactElement.dataset.uid;
  const partnerNameEl = contactElement.querySelector(".contact-name");
  const partnerName = partnerNameEl ? partnerNameEl.textContent : "Unknown";
  const partnerRole = contactElement.querySelector(".contact-role");
  const partnerRoleText = partnerRole ? partnerRole.textContent : "";

  // Store current chat partner
  currentChatPartner = { uid: partnerUid, name: partnerName };

  // Update chat header, avatar, subtitle, active badge
  const chatHeader = document.getElementById("chatHeader");
  chatHeader.textContent = partnerName;

  const convSub = document.getElementById("convSub");
  const roleLabel = partnerRoleText
    ? partnerRoleText.charAt(0).toUpperCase() + partnerRoleText.slice(1)
    : "Contact";
  convSub.textContent = `${roleLabel} · Consultation thread`;

  const convAvatar = document.getElementById("convAvatar");
  convAvatar.textContent = partnerName
    .split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const activeBadge = document.getElementById("activeBadge");
  activeBadge.style.display = "inline-flex";

  // Show chat input area
  document.getElementById("chatInputArea").style.display = "flex";
  document.getElementById("chatInput").focus();

  // Clear previous messages
  const messagesContainer = document.getElementById("chatMessages");
  messagesContainer.innerHTML = "";
  const loadingDiv = document.createElement("div");
  loadingDiv.className = "no-chat";
  loadingDiv.textContent = "Loading messages...";
  messagesContainer.appendChild(loadingDiv);

  // On mobile, switch to showing the conversation column
  if (window.innerWidth < 768) {
    document.getElementById("chatLayout")?.classList.add("chat-main-hidden");
  }

  // Set up real-time messages listener
  setupMessagesListener();
}

// ========================================
// REAL-TIME MESSAGES LISTENER
// ========================================

function setupMessagesListener() {
  // Unsubscribe from previous listener if exists
  if (messagesUnsubscribe) {
    messagesUnsubscribe();
  }

  try {
    // Generate chat ID: sorted UIDs joined with "_"
    const uids = [currentUser.uid, currentChatPartner.uid].sort();
    const chatId = uids.join("_");

    // Reference to messages subcollection
    const messagesRef = collection(
      db,
      "chats",
      chatId,
      "messages"
    );

    // Query: get messages ordered by time
    const q = query(
      messagesRef,
      orderBy("createdAt", "asc")
      // limit(50) // Optional: limit for very active chats
    );

    // Set up real-time listener
    messagesUnsubscribe = onSnapshot(q, (snapshot) => {
      // Clear messages container
      const messagesContainer = document.getElementById("chatMessages");
      messagesContainer.innerHTML = "";

      if (snapshot.empty) {
        messagesContainer.innerHTML = "";
        const noChatDiv = document.createElement("div");
        noChatDiv.className = "no-chat";
        noChatDiv.textContent = "No messages yet. Start the conversation!";
        messagesContainer.appendChild(noChatDiv);
        return;
      }

      // Track last message for this partner (update contact list preview)
      let lastMsg = null;

      // Add each message to the UI
      snapshot.forEach((docSnap) => {
        const msg = docSnap.data();
        addMessageToUI(msg);
        lastMsg = msg;
      });

      // Update contact list row with last message + time
      if (lastMsg) {
        lastMessageMap[currentChatPartner.uid] = {
          preview: lastMsg.text || "",
          time: formatTimeShort(lastMsg.createdAt)
        };
        refreshContactRow(currentChatPartner.uid);
      }

      // Auto-scroll to bottom when new messages arrive
      scrollToBottom();
    });

  } catch (error) {
    console.error("Error setting up messages listener:", error);
    showError("Failed to load messages. Please try again.");
  }
}

function formatTimeShort(value) {
  if (!value) return "";
  let date;
  if (typeof value.toDate === "function") {
    date = value.toDate();
  } else if (typeof value === "object" && typeof value.seconds === "number") {
    date = new Date(value.seconds * 1000);
  } else if (typeof value === "string" || typeof value === "number") {
    date = new Date(value);
  } else {
    return "";
  }
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ========================================
// MESSAGE DISPLAY & SENDING
// ========================================

function addMessageToUI(message) {
  const messagesContainer = document.getElementById("chatMessages");
  const messageDiv = document.createElement("div");

  // Determine if message is sent by current user or received
  const isSentByMe = message.senderId === currentUser.uid;

  messageDiv.className = `msg-bubble ${isSentByMe ? "sent" : "received"}`;

  // Safe construction without innerHTML for user data
  const textDiv = document.createElement("div");
  textDiv.textContent = message.text;

  const metaDiv = document.createElement("div");
  metaDiv.className = "msg-meta";

  // Sender name (or "You")
  const senderText = isSentByMe ? "You" : (message.senderName || "Unknown");

  metaDiv.textContent = `${senderText} • ${formatTimeShort(message.createdAt)}`;

  messageDiv.appendChild(textDiv);
  messageDiv.appendChild(metaDiv);
  messagesContainer.appendChild(messageDiv);
}

function scrollToBottom() {
  const messagesContainer = document.getElementById("chatMessages");
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Send message handler
async function sendMessage() {
  const input = document.getElementById("chatInput");
  const text = input.value.trim();

  if (!text || !currentChatPartner) return;

  try {
    // Disable input temporarily
    input.disabled = true;
    input.placeholder = "Sending...";

    // Generate chat ID
    const uids = [currentUser.uid, currentChatPartner.uid].sort();
    const chatId = uids.join("_");

    // Add message to Firestore
    await addDoc(collection(db, "chats", chatId, "messages"), {
      senderId: currentUser.uid,
      senderName: currentUserProfile.data.name,
      text: text,
      createdAt: serverTimestamp(),
    });

    // Clear input and re-enable
    input.value = "";
    input.disabled = false;
    input.placeholder = "Type your message...";
    input.focus();

  } catch (error) {
    console.error("Error sending message:", error);
    showError("Failed to send message. Please try again.");
    input.disabled = false;
    input.placeholder = "Type your message...";
  }
}

// ========================================
// EVENT LISTENERS SETUP
// ========================================

function setupEventListeners() {
  // Logout button
  document.getElementById("logoutBtn")?.addEventListener("click", async () => {
    try {
      // Unsubscribe from messages listener first
      if (messagesUnsubscribe) messagesUnsubscribe();

      // Sign out
      await logoutUser();
      // Auth state listener will redirect to index.html
    } catch (error) {
      console.error("Logout error:", error);
      showError("Logout failed. Please try again.");
    }
  });

  // Nav to Consultations
  document.getElementById("navConsult")?.addEventListener("click", (e) => {
    e.preventDefault();
    // Unsubscribe from messages listener when leaving chat
    if (messagesUnsubscribe) messagesUnsubscribe();
    window.location.href = "consult.html";
  });

  // Send message button
  document.getElementById("sendBtn")?.addEventListener("click", sendMessage);

  // Enter key to send message
  document
    .getElementById("chatInput")
    ?.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        sendMessage();
      }
    });

  // Back button (mobile): return to contact list
  document.getElementById("backToContacts")?.addEventListener("click", () => {
    document.getElementById("chatLayout")?.classList.remove("chat-main-hidden");
    // Unsubscribe from messages listener
    if (messagesUnsubscribe) {
      messagesUnsubscribe();
      messagesUnsubscribe = null;
    }
    // Clear active selection visually
    document.querySelectorAll(".chat-contact").forEach((c) => {
      c.classList.remove("active");
    });
  });
}
