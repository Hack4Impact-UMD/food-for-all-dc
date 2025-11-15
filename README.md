<div align="center">
  <img src="my-app/src/assets/food-for-all-dc-logo.jpg" alt="Food For All DC logo" title="Food For All DC" height="120" />
  
  # 🥗 Food For All DC
  
  <p>
    <b>Modernizing food delivery for our community</b><br>
    <i>A nonprofit dedicated to feeding those in need</i>
  </p>

  <p>
    <a href="#environment-setup"><img src="https://img.shields.io/badge/Setup-Guide-257E68" alt="Setup Guide"></a>
    <a href="#project-structure"><img src="https://img.shields.io/badge/Project-Structure-257E68" alt="Project Structure"></a>
    <a href="#system-overview"><img src="https://img.shields.io/badge/System-Overview-257E68" alt="System Overview"></a>
    <a href="my-app/STYLING.md"><img src="https://img.shields.io/badge/Style-Guide-257E68" alt="Style Guide"></a>
  </p>
</div>

---

## 📋 About

This project modernizes and streamlines client management and delivery scheduling for Food For All DC, a nonprofit serving our community. 🚚🥕

This repository contains all the code, documentation, and setup guides you need to contribute or run the Food For All DC app. Please follow the setup guide below to get started. If you have questions, feel free to reach out via GitHub Issues!

---


## 📖 Contents

- [⚙️ Environment Setup](#%EF%B8%8F-environment-setup)
- [🏗️ Project Structure](#%EF%B8%8F-project-structure)
- [🎨 Style Guide](#-style-guide)
- [🗺️ System Overview](#%EF%B8%8F-system-overview)

---

## ⚙️ Environment Setup

<details open>
<summary><b>📂 Initial Steps</b></summary>
<br>

1. **GitHub SSH Configuration:**  
   - Follow this [GitHub Guide](https://docs.github.com/en/authentication/connecting-to-github-with-ssh).

2. **Clone the Repository:**
   ```bash
   git clone <your-repo-url>
   cd food-for-all-dc
   ```
</details>

<details open>
<summary><b>🌐 Running the App Locally (Frontend)</b></summary>
<br>

1. **Install dependencies and run the development server:**
   ```bash
   cd my-app
   npm install
   npm start
   ```
   Open [http://localhost:3000](http://localhost:3000) to see your running application.
</details>

<details open>
<summary><b>🔥 Firebase Local Emulator (Backend)</b></summary>
<br>

1. **Install Firebase CLI**
   ```bash
   npm install -g firebase-tools
   firebase login
   ```

2. **Install backend dependencies**
   ```bash
   cd my-app/functions
   npm install
   ```

3. **Run Emulator**
   ```bash
   firebase emulators:start
   ```

   ⚠️ **Use the Firebase Emulator for local testing only.**
</details>

<details open>
<summary><b>🐍 Python Cloud Functions (Advanced Backend)</b></summary>
<br>

1. **Set up Python environment:**
   ```bash
   cd my-app/functions-python
   python3 -m venv venv
   source venv/bin/activate
   pip install -r requirements.txt
   ```

2. **Run Firebase Emulator (from project root):**
   ```bash
   firebase emulators:start
   ```
</details>

---

## 🏗️ Project Structure

<details open>
<summary><b>Directory Structure Overview</b></summary>
<br>

```
food-for-all-dc/
│
├── my-app/
│   ├── public/                  # Static assets (favicon, index.html, etc.)
│   ├── src/                     # Main application source code
│   │   ├── assets/              # Images and static files
│   │   ├── auth/                # Authentication modules
│   │   ├── backend/             # Cloud function calls from frontend
│   │   ├── components/          # UI components
│   │   │   └── common/          # Reusable UI components
│   │   ├── config/              # Configuration files
│   │   ├── constants/           # Application constants
│   │   ├── context/             # React context providers
│   │   ├── hooks/               # Custom React hooks
│   │   ├── pages/               # App pages/views
│   │   ├── services/            # Business logic and API services
│   │   ├── styles/              # Styling and theme
│   │   ├── types/               # TypeScript type definitions
│   │   ├── utils/               # Utility functions
│   │   ├── App.tsx              # Main app component
│   │   └── index.tsx            # App entry point
│   ├── functions/               # Firebase backend (TypeScript)
│   │   └── src/index.ts         # Firebase functions entry point
│   ├── functions-python/        # Python backend functions
│   ├── package.json             # Frontend dependencies and scripts
│   ├── firebase.json            # Firebase configuration
│   └── .firebaserc              # Firebase project aliases
│
├── clean-code archive/          # Documentation archive
│
└── README.md                    # This file
```
</details>

---

## 🎨 Style Guide

<div align="center">
  <table>
    <tr>
      <td align="center">
        <h3>🖌️ Consistent Style, Beautiful App!</h3>
        <p>To keep our codebase clean and our UI/UX delightful, please check out our comprehensive style guide:</p>
        <p><a href="my-app/STYLING.md"><b>📚 STYLING.md</b></a></p>
      </td>
    </tr>
  </table>
</div>

The style guide covers:
- UI/UX principles and visual standards
- Code formatting and naming conventions
- Component structure and best practices

Following these guidelines helps everyone build a better Food For All DC experience!

---

## 🗺️ System Overview

<table>
  <tr>
    <td width="50%">
      <h3>Frontend</h3>
      <ul>
        <li>React + TypeScript</li>
        <li>Material UI</li>
        <li>Custom components</li>
        <li>Firebase integration</li>
      </ul>
    </td>
    <td width="50%">
      <h3>Backend</h3>
      <ul>
        <li>Firebase Cloud Functions (TypeScript)</li>
        <li>Python functions for routing/clustering</li>
        <li>Firebase Authentication</li>
        <li>Real-time delivery management</li>
      </ul>
    </td>
  </tr>
</table>

---

<div align="center">
  <h3>🎉 Happy coding! 🎉</h3>
  <p>Together, we'll make Food For All DC even more impactful! 🥗</p>
</div>
