# Guidance Consultation Platform

A real-time messaging and consultation platform connecting students with teachers/guidance counselors. Built with HTML, CSS, and JavaScript on Firebase (Auth, Firestore, Hosting). Role-based access, instant chat, and a request-and-approve consultation booking flow.

**Live demo:** https://guidance-consult.web.app

## Features

- **Authentication** — Email/password login and registration. New accounts default to the student role.
- **Real-time chat** — Students and teachers message each other instantly, with conversations synced live via Firestore.
- **Consultation requests** — Students pick a teacher, topic, and preferred date/time. Teachers can accept or decline, and both sides see the live status.
- **Role-based views** — Students and teachers see different navigation and actions based on their assigned role.
- **Responsive design** — Works on desktop browsers and mobile devices, with a dedicated mobile layout.

## Tech Stack

- **Frontend:** HTML5, CSS3, JavaScript (ES6 Modules) — no framework, no build step
- **Authentication:** Firebase Authentication (Email/Password)
- **Database:** Cloud Firestore (real-time NoSQL)
- **Hosting:** Firebase Hosting

## Project Structure

```
├── index.html          # Login / register page
├── chat.html            # Real-time chat
├── consult.html          # Consultation requests
├── css/
│   └── style.css
├── js/
│   ├── firebase.js       # Firebase config
│   ├── auth.js           # Register / login
│   ├── common.js         # Shared auth helpers
│   ├── chat.js
│   └── consult.js
├── firestore.rules       # Firestore security rules
└── firebase.json         # Hosting config
```

## Getting Started

1. Clone the repo and open the folder in VS Code.
2. Create a [Firebase project](https://console.firebase.google.com/) and register a web app.
3. Enable **Email/Password** sign-in under Authentication.
4. Create a **Cloud Firestore** database in production mode.
5. Paste your Firebase config into `js/firebase.js`.
6. Publish the rules in `firestore.rules` under Firestore → Rules.
7. Run locally with the VS Code **Live Server** extension (`index.html` → *Open with Live Server*).

## Deployment

```bash
npm install -g firebase-tools
firebase login
firebase init hosting
firebase deploy --only hosting
```

## Roles

- **Student** — created automatically on registration.
- **Teacher/Counselor** — assigned manually by changing a user's `role` field to `"teacher"` in Firestore.

## Security

Firestore security rules ensure:
- Only the two participants in a conversation can read or write its messages.
- Only the assigned teacher can accept or decline a consultation request.
- Users can only create their own profile, and only as a student.

## License

This project is provided as-is for educational purposes.
