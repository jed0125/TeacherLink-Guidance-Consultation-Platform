/* ============================================
   Consultations Page - JavaScript
   Features:
   - Students: select teacher, enter topic and date/time, send request
   - Teachers: view pending requests, accept/decline
   - Both: view status of their consultations
   Data stored in consultations collection
   ============================================ */

import { auth, db } from "./firebase.js";
import {
  getDocs,
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
  updateDoc,
  serverTimestamp,
  doc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  getCurrentUserProfile,
  logoutUser
} from "./common.js";

// Global variables
let currentUser = null;
let currentUserProfile = null;
let authStateUnsubscribe = null;
let consultationsUnsubscribes = [];
let initialized = false;

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

      // 3. Update UI to match role immediately (hides/shows panels correctly)
      updateRoleBasedUI();

      // 4. Prevent duplicate initialization
      if (initialized) {
        return;
      }
      initialized = true;

      // 5. Update UI with user info
      updateUserBanner();

      // 6. Set up event listeners
      setupEventListeners();

      // 7. Load teachers (for student role)
      await loadTeachers();

      // 8. Set up real-time consultations listener
      setupConsultationsListener();

    } catch (error) {
      console.error("Initialization error:", error);
      showError("Failed to load consultations. Please try again.");
    }
  });
});

// Cleanup on unload
window.addEventListener("beforeunload", () => {
  // Unsubscribe from all listeners
  consultationsUnsubscribes.forEach(unsub => unsub());
  consultationsUnsubscribes = [];
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
  const roleLabel = role.charAt(0).toUpperCase() + role.slice(1);
  document.getElementById("userRole").textContent = roleLabel;

  const signedInName = document.getElementById("signedInName");
  const signedInMeta = document.getElementById("signedInMeta");
  if (signedInName) signedInName.textContent = name;
  if (signedInMeta) {
    signedInMeta.textContent = `${roleLabel} · Holy Trinity College`;
  }
}

function updateRoleBasedUI() {
  const role = currentUserProfile.data.role;
  document.getElementById("studentPanel").hidden = role !== "student";
  document.getElementById("teacherPanel").hidden = role !== "teacher";
  // Mockup surfaces use the role panels only (no secondary list).
  document.getElementById("allConsultationsPanel").hidden = true;

  const eyebrowEl = document.getElementById("consultEyebrow");
  const titleEl = document.getElementById("consultTitle");
  const subtitleEl = document.getElementById("consultSubtitle");
  const addAvailBtn = document.getElementById("addAvailabilityBtn");

  if (role === "teacher") {
    eyebrowEl.textContent = "TEACHER WORKSPACE";
    titleEl.textContent = "Consultations";
    subtitleEl.textContent =
      "Review student requests and keep upcoming meetings organised.";
    addAvailBtn.hidden = false;
  } else {
    eyebrowEl.textContent = "STUDENT WORKSPACE";
    titleEl.textContent = "Request a consultation";
    subtitleEl.textContent =
      "Choose a teacher and suggest a time that works for you.";
    addAvailBtn.hidden = true;
  }
}

function applyAvatarColor() {
  // Avatars use the solid brand green from CSS.
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

function showMessage(message, type) {
  // Use a message area in the main content
  let messageBox = document.getElementById("consultMessageBox");
  if (!messageBox) {
    messageBox = document.createElement("div");
    messageBox.id = "consultMessageBox";
    messageBox.className = "message";
    const consultContent = document.getElementById("consultContent");
    if (consultContent) {
      consultContent.insertBefore(messageBox, consultContent.firstChild);
    }
  }
  messageBox.textContent = message;
  messageBox.className = `message ${type}`;

  // Remove after 5 seconds
  setTimeout(() => {
    if (messageBox.parentNode) messageBox.remove();
  }, 5000);
}

// ========================================
// TEACHERS LIST LOADING (for students)
// ========================================

async function loadTeachers() {
  // Only relevant for students
  if (currentUserProfile.data.role !== "student") return;

  const teacherSelect = document.getElementById("teacherSelect");
  // Clear and show loading
  teacherSelect.innerHTML = "";
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "Loading teachers...";
  teacherSelect.appendChild(placeholder);
  teacherSelect.disabled = true;

  try {
    const teachersRef = collection(db, "users");
    const q = query(teachersRef, where("role", "==", "teacher"));
    const querySnapshot = await getDocs(q);

    teacherSelect.innerHTML = ""; // Clear loading
    if (querySnapshot.empty) {
      const noTeachers = document.createElement("option");
      noTeachers.value = "";
      noTeachers.textContent = "No teachers available";
      teacherSelect.appendChild(noTeachers);
      return;
    }

    querySnapshot.forEach((docSnap) => {
      const teacherData = docSnap.data();
      const option = document.createElement("option");
      option.value = docSnap.id;
      // Safe text content (teacher name from trusted data)
      option.textContent = `${teacherData.name || "Unnamed"} (${teacherData.role})`;
      // Store teacher name for later retrieval during form submission
      option.dataset.name = teacherData.name || "Unnamed";
      teacherSelect.appendChild(option);
    });

  } catch (error) {
    console.error("Error loading teachers:", error);
    teacherSelect.innerHTML = "";
    const errorOption = document.createElement("option");
    errorOption.value = "";
    errorOption.textContent = "Error loading teachers";
    teacherSelect.appendChild(errorOption);
  } finally {
    teacherSelect.disabled = false;
  }
}

// ========================================
// CONSULTATIONS LISTENER & DISPLAY
// ========================================

function setupConsultationsListener() {
  // Clear previous listeners
  consultationsUnsubscribes.forEach(unsub => unsub());
  consultationsUnsubscribes = [];

  try {
    const consultationsRef = collection(db, "consultations");
    let q;
    const role = currentUserProfile.data.role;

    if (role === "student") {
      q = query(consultationsRef, where("studentId", "==", currentUser.uid));
    } else if (role === "teacher") {
      q = query(consultationsRef, where("teacherId", "==", currentUser.uid));
    } else {
      showError("Invalid role");
      return;
    }

    // Set up real-time listener - we'll sort in JavaScript
    const unsub = onSnapshot(q, (snapshot) => {
      renderConsultations(snapshot);
    }, (error) => {
      console.error("Consultations listener error:", error);
      showError(`Failed to load consultations: ${error.message}`);
    });
    consultationsUnsubscribes.push(unsub);

  } catch (error) {
    console.error("Error setting up consultations listener:", error);
    showError("Failed to load consultations. Please try again.");
  }
}

function renderConsultations(snapshot) {
  const consultationsList = document.getElementById("consultationsList");
  const pendingList = document.getElementById("pendingConsultations");
  const allConsultationsList = document.getElementById("allConsultationsList");

  if (!consultationsList || !pendingList || !allConsultationsList) return;

  // Clear lists
  consultationsList.innerHTML = "";
  pendingList.innerHTML = "";
  allConsultationsList.innerHTML = "";

  // Sort in JavaScript: newest first, pending (null timestamp) treated as newest
  const docs = [];
  snapshot.forEach((docSnap) => {
    docs.push({ id: docSnap.id, data: docSnap.data() });
  });
  docs.sort((a, b) => {
    const timeA = getTimestampMs(a.data.when);
    const timeB = getTimestampMs(b.data.when);
    // null/pending timestamps sort to the top (newest)
    if (timeA === null && timeB === null) return 0;
    if (timeA === null) return -1;
    if (timeB === null) return 1;
    return timeB - timeA; // descending
  });

  // Compute stats for teacher view
  if (currentUserProfile.data.role === "teacher") {
    updateStatCards(docs);
  }

  if (docs.length === 0) {
    const emptyMsg = document.createElement("div");
    emptyMsg.textContent = "No consultations found.";
    emptyMsg.style.textAlign = "center";
    emptyMsg.style.padding = "20px";
    consultationsList.appendChild(emptyMsg);
    pendingList.appendChild(emptyMsg.cloneNode(true));
    allConsultationsList.appendChild(emptyMsg.cloneNode(true));
    return;
  }

  docs.forEach(({ id, data: consult }) => {
    // Build consultation card safely
    const card = createConsultationCard(id, consult);
    consultationsList.appendChild(card);

    // If teacher and consultation is pending or accepted, show in pending list
    if (currentUserProfile.data.role === "teacher" && (consult.status === "pending" || consult.status === "accepted")) {
      const pendingCard = createConsultationCard(id, consult, true); // true for pending list
      pendingList.appendChild(pendingCard);
    }
  });

  // Update student count badge (number of pending requests)
  const studentBadge = document.getElementById("studentCountBadge");
  if (studentBadge) {
    const studentPending = docs.filter(d => d.data.status === "pending").length;
    studentBadge.textContent = studentPending + " PENDING";
  }
}

function updateStatCards(docs) {
  // pending = status === "pending"
  const pendingCount = docs.filter(d => d.data.status === "pending").length;

  // this week = `when` in the next 7 days
  const now = Date.now();
  const weekMs = 7 * 24 * 60 * 60 * 1000;
  const thisWeekCount = docs.filter(d => {
    const whenMs = getTimestampMs(d.data.when);
    return whenMs && whenMs > now && whenMs < now + weekMs;
  }).length;

  // completed this term = accepted/declined in the current school term
  // Simplify: count accepted + declined (real term logic would be more complex)
  const completedCount = docs.filter(d => d.data.status === "accepted" || d.data.status === "declined").length;

  // Update DOM
  const pendingEl = document.querySelector('[data-stat="pending"]');
  const thisWeekEl = document.querySelector('[data-stat="this-week"]');
  const completedEl = document.querySelector('[data-stat="completed"]');

  if (pendingEl) pendingEl.textContent = pendingCount;
  if (thisWeekEl) thisWeekEl.textContent = thisWeekCount;
  if (completedEl) completedEl.textContent = completedCount;

  // Update pending count badge to match rows shown (pending + accepted)
  const pendingBadge = document.getElementById("pendingCountBadge");
  if (pendingBadge) {
    const shownCount = docs.filter(
      (d) => d.data.status === "pending" || d.data.status === "accepted"
    ).length;
    pendingBadge.textContent =
      shownCount + " REQUEST" + (shownCount !== 1 ? "S" : "");
  }

  // Update student count badge
  const studentBadge = document.getElementById("studentCountBadge");
  if (studentBadge) {
    const studentPending = docs.filter(d => d.data.status === "pending").length;
    studentBadge.textContent = studentPending + " PENDING";
  }
}

// Extract a millisecond timestamp from a Firestore Timestamp or ISO string.
// Returns null when no timestamp is set (treated as newest during sorting).
function getTimestampMs(value) {
  if (!value) return null;
  if (typeof value.toDate === "function") {
    return value.toDate().getTime();
  }
  if (typeof value === "object" && typeof value.seconds === "number") {
    return value.seconds * 1000;
  }
  if (typeof value === "string" || typeof value === "number") {
    const ms = new Date(value).getTime();
    return Number.isNaN(ms) ? null : ms;
  }
  return null;
}

function createConsultationCard(consultId, consult, forPendingList = false) {
  const cardDiv = document.createElement("div");
  cardDiv.dataset.consultId = consultId;

  const isStudentViewer = currentUserProfile.data.role === "student";
  const otherRole = isStudentViewer ? "teacher" : "student";
  const otherName = consult[`${otherRole}Name`] || "Unknown";

  // Student "Your requests" — nested soft box matching the mockup
  if (currentUserProfile.data.role === "student" && !forPendingList) {
    cardDiv.className = "consult-card request-card";

    const nameDiv = document.createElement("div");
    nameDiv.className = "request-teacher";
    nameDiv.textContent = otherName;

    const topicDiv = document.createElement("div");
    topicDiv.className = "request-topic";
    topicDiv.textContent = consult.topic || "No topic";

    const timeDiv = document.createElement("div");
    timeDiv.className = "request-time";
    timeDiv.textContent = formatWhen(consult.when);
    if (consult.status === "pending") timeDiv.classList.add("pending");
    else if (consult.status === "accepted") timeDiv.classList.add("accepted");
    else if (consult.status === "declined") timeDiv.classList.add("declined");

    cardDiv.appendChild(nameDiv);
    cardDiv.appendChild(topicDiv);
    cardDiv.appendChild(timeDiv);
    return cardDiv;
  }

  // Teacher pending / accepted list row
  if (forPendingList && currentUserProfile.data.role === "teacher") {
    cardDiv.className = "consult-card";

    const avatarDiv = document.createElement("div");
    avatarDiv.className = "avatar avatar-sm";
    const initials = otherName
      .split(" ")
      .map((part) => part[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
    avatarDiv.textContent = initials;
    cardDiv.appendChild(avatarDiv);

    const infoDiv = document.createElement("div");
    infoDiv.className = "consult-info";

    const nameRow = document.createElement("div");
    nameRow.className = "consult-name-row";

    const nameSpan = document.createElement("span");
    nameSpan.className = "consult-name";
    nameSpan.textContent = otherName;
    nameRow.appendChild(nameSpan);

    const statusPill = document.createElement("span");
    statusPill.className = `badge badge-${consult.status === "accepted" ? "accepted" : "pending"}`;
    statusPill.textContent = consult.status === "accepted" ? "ACCEPTED" : "PENDING";
    nameRow.appendChild(statusPill);

    infoDiv.appendChild(nameRow);

    const topicDiv = document.createElement("div");
    topicDiv.className = "consult-topic";
    topicDiv.textContent = consult.topic || "No topic";
    infoDiv.appendChild(topicDiv);

    const timeDiv = document.createElement("div");
    timeDiv.className = "consult-time";
    timeDiv.textContent = formatWhen(consult.when);
    infoDiv.appendChild(timeDiv);

    cardDiv.appendChild(infoDiv);

    const actionsDiv = document.createElement("div");
    actionsDiv.className = "consult-actions";

    const viewBtn = document.createElement("button");
    viewBtn.type = "button";
    viewBtn.className = "btn btn-outline";
    viewBtn.textContent = "View details";
    viewBtn.addEventListener("click", () => {
      const details = cardDiv.querySelector(".consult-details-expanded");
      if (details) {
        details.remove();
      } else {
        const expanded = document.createElement("div");
        expanded.className = "consult-details-expanded";
        expanded.innerHTML = `
          <strong>Student:</strong> ${consult.studentName || "Unknown"}<br>
          <strong>Topic:</strong> ${consult.topic || "No topic"}<br>
          <strong>Date/Time:</strong> ${formatWhen(consult.when)}<br>
          <strong>Submitted:</strong> ${formatWhen(consult.createdAt)}<br>
          <strong>Status:</strong> ${capitalizeFirstLetter(consult.status || "pending")}
        `;
        cardDiv.appendChild(expanded);
      }
    });
    actionsDiv.appendChild(viewBtn);

    if (consult.status === "pending") {
      const declineBtn = document.createElement("button");
      declineBtn.type = "button";
      declineBtn.className = "btn btn-decline";
      declineBtn.textContent = "Decline request";
      declineBtn.addEventListener("click", () =>
        handleConsultationDecision(consultId, "declined")
      );
      actionsDiv.appendChild(declineBtn);

      const availBtn = document.createElement("button");
      availBtn.type = "button";
      availBtn.className = "btn btn-outline";
      availBtn.textContent = "Add availability";
      availBtn.addEventListener("click", () =>
        toggleAvailabilityEditor(cardDiv, consultId, consult)
      );
      actionsDiv.appendChild(availBtn);

      const acceptBtn = document.createElement("button");
      acceptBtn.type = "button";
      acceptBtn.className = "btn btn-primary";
      acceptBtn.textContent = "Accept request";
      acceptBtn.addEventListener("click", () =>
        handleConsultationDecision(consultId, "accepted")
      );
      actionsDiv.appendChild(acceptBtn);
    } else if (consult.status === "accepted") {
      const messageBtn = document.createElement("button");
      messageBtn.type = "button";
      messageBtn.className = "btn btn-primary";
      messageBtn.textContent = "Message student";
      messageBtn.addEventListener("click", () => {
        window.location.href = `chat.html?to=${consult.studentId}`;
      });
      actionsDiv.appendChild(messageBtn);
    }

    cardDiv.appendChild(actionsDiv);

    return cardDiv;
  }

  cardDiv.className = "consult-card";
  cardDiv.textContent = "Consultation";
  return cardDiv;
}

function toggleAvailabilityEditor(cardDiv, consultId, consult) {
  const existing = cardDiv.querySelector(".availability-editor");
  if (existing) {
    existing.remove();
    return;
  }

  const editor = document.createElement("div");
  editor.className = "availability-editor consult-details-expanded";

  const label = document.createElement("label");
  label.htmlFor = `avail-${consultId}`;
  label.textContent = "Suggest a new date and time";
  label.style.display = "block";
  label.style.fontWeight = "700";
  label.style.marginBottom = "8px";

  const input = document.createElement("input");
  input.type = "datetime-local";
  input.id = `avail-${consultId}`;
  input.className = "availability-input";
  input.required = true;

  const whenMs = getTimestampMs(consult.when);
  if (whenMs) {
    const local = new Date(whenMs - new Date().getTimezoneOffset() * 60000);
    input.value = local.toISOString().slice(0, 16);
  }

  const saveBtn = document.createElement("button");
  saveBtn.type = "button";
  saveBtn.className = "btn btn-primary";
  saveBtn.textContent = "Save availability";
  saveBtn.addEventListener("click", async () => {
    if (!input.value) {
      showMessage("Please choose a date and time.", "error");
      return;
    }
    const ok = await updateConsultationAvailability(consultId, input.value);
    if (ok) editor.remove();
  });

  const row = document.createElement("div");
  row.className = "availability-editor-row";
  row.appendChild(input);
  row.appendChild(saveBtn);

  editor.appendChild(label);
  editor.appendChild(row);
  cardDiv.appendChild(editor);
}

async function updateConsultationAvailability(consultId, datetimeLocalValue) {
  if (currentUserProfile.data.role !== "teacher") {
    showMessage("Only teachers can update availability.", "error");
    return false;
  }

  try {
    // Keep the same datetime-local string format students use on create.
    if (Number.isNaN(new Date(datetimeLocalValue).getTime())) {
      showMessage("Invalid date and time.", "error");
      return false;
    }

    const consultRef = doc(db, "consultations", consultId);
    await updateDoc(consultRef, { when: datetimeLocalValue });
    showMessage("Availability updated.", "success");
    return true;
  } catch (error) {
    console.error("Error updating availability:", error);
    showMessage("Failed to update availability. Please try again.", "error");
    return false;
  }
}

// Format a Firestore Timestamp, ISO string, or plain seconds object into a
// human-readable date/time. Falls back to "Not set" when nothing is present.
function formatWhen(value) {
  if (!value) return "Not set";
  let date;
  if (typeof value.toDate === "function") {
    date = value.toDate();
  } else if (typeof value === "object" && typeof value.seconds === "number") {
    date = new Date(value.seconds * 1000);
  } else if (typeof value === "string" || typeof value === "number") {
    date = new Date(value);
  } else {
    return "Not set";
  }
  if (Number.isNaN(date.getTime())) return "Not set";
  return date.toLocaleString();
}

// Helper to capitalize first letter
function capitalizeFirstLetter(str) {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// ========================================
// CONSULTATION FORM SUBMISSION (students)
// ========================================

async function handleConsultationFormSubmit(event) {
  event.preventDefault();

  // Only students can submit
  if (currentUserProfile.data.role !== "student") {
    showMessage("Only students can request consultations.", "error");
    return;
  }

  const teacherSelect = document.getElementById("teacherSelect");
  const topicInput = document.getElementById("topicInput");
  const dateInput = document.getElementById("consultationDate");

  const teacherId = teacherSelect.value;
  const topic = topicInput.value.trim();
  const whenValue = dateInput.value; // ISO string from datetime-local

  // Validation
  if (!teacherId) {
    showMessage("Please select a teacher.", "error");
    return;
  }
  if (!topic) {
    showMessage("Please enter a topic.", "error");
    return;
  }
  if (topic.length > 500) {
    showMessage("Topic is too long (max 500 characters).", "error");
    return;
  }
  if (!whenValue) {
    showMessage("Please select a date and time.", "error");
    return;
  }

  // Disable form
  const submitBtn = document.getElementById("submitConsultBtn");
  submitBtn.disabled = true;
  submitBtn.textContent = "Sending...";

  try {
    // Get teacher name from the selected option (stored in select's data)
    let teacherName = "Unknown";
    const selectedOption = teacherSelect.options[teacherSelect.selectedIndex];
    if (selectedOption && selectedOption.dataset.name) {
      teacherName = selectedOption.dataset.name;
    }

    // Add consultation to Firestore with the required structure
    await addDoc(collection(db, "consultations"), {
      studentId: currentUser.uid,
      studentName: currentUserProfile.data.name,
      teacherId: teacherId,
      teacherName: teacherName,
      topic: topic,
      when: whenValue,
      status: "pending",
      createdAt: serverTimestamp()
    });

    // Reset form
    teacherSelect.value = "";
    topicInput.value = "";
    dateInput.value = "";

    showMessage("Consultation request sent successfully!", "success");
    // Listener will update UI automatically
  } catch (error) {
    console.error("Error submitting consultation:", error);
    showMessage("Failed to send request. Please try again.", "error");
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Request consultation";
  }
}

// ========================================
// CONSULTATION DECISION (teachers accept/decline)
// ========================================

async function handleConsultationDecision(consultId, newStatus) {
  // Only teachers can decide
  if (currentUserProfile.data.role !== "teacher") {
    showMessage("Only teachers can accept/decline consultations.", "error");
    return;
  }

  try {
    const consultRef = doc(db, "consultations", consultId);
    await updateDoc(consultRef, {
      status: newStatus
    });

    showMessage(`Consultation ${newStatus}.`, "success");
    // Listener will update UI automatically
  } catch (error) {
    console.error("Error updating consultation:", error);
    showMessage(`Failed to ${newStatus} consultation. Please try again.`, "error");
  }
}

// ========================================
// EVENT LISTENERS SETUP
// ========================================

function setupEventListeners() {
  // Logout button
  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
      try {
        await logoutUser();
        // Auth state listener will redirect
      } catch (error) {
        console.error("Logout error:", error);
        showError("Logout failed. Please try again.");
      }
    });
  }

  // Nav to Chat
  const navChat = document.getElementById("navChat");
  if (navChat) {
    navChat.addEventListener("click", (e) => {
      e.preventDefault();
      window.location.href = "chat.html";
    });
  }

  // Consultation form (student)
  const consultForm = document.getElementById("consultationForm");
  if (consultForm) {
    consultForm.addEventListener("submit", handleConsultationFormSubmit);
  }

  // "+ Add availability" button (placeholder, no Firestore writes)
  const addAvailBtn = document.getElementById("addAvailabilityBtn");
  if (addAvailBtn) {
    addAvailBtn.addEventListener("click", () => {
      showMessage("Add availability coming soon.", "error");
    });
  }
}