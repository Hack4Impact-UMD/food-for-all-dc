<div align="center">
  <img src="my-app/src/assets/food-for-all-dc-logo.jpg" alt="Food For All DC logo" title="Food For All DC" height="120" />
  
  # 🥗 Food For All DC
  
  <p>
    <b>Modernizing food delivery for our community</b><br>
    <i>A nonprofit dedicated to feeding those in need</i>
  </p>

  <p>
    <a href="#quick-start"><img src="https://img.shields.io/badge/Setup-Guide-257E68" alt="Setup Guide"></a>
    <a href="#project-structure"><img src="https://img.shields.io/badge/Project-Structure-257E68" alt="Project Structure"></a>
    <a href="#tech-stack"><img src="https://img.shields.io/badge/Tech-Stack-257E68" alt="Tech Stack"></a>
    <a href="CONTRIBUTING.md"><img src="https://img.shields.io/badge/Contributing-Guide-257E68" alt="Contributing Guide"></a>
    <a href="my-app/STYLING.md"><img src="https://img.shields.io/badge/Style-Guide-257E68" alt="Style Guide"></a>
  </p>
</div>

---

## 📋 About

This project modernizes and streamlines client management and delivery scheduling for Food For All DC, a nonprofit serving our community. 🚚🥕

The system handles client intake, delivery scheduling, route optimization, and reporting. This repository contains all the code, documentation, and setup guides you need to contribute or run the Food For All DC app.

---

## 📖 Contents

- [🗺️ Roadmap](#️-roadmap)
- [⚙️ Quick Start](#-quick-start)
- [🏗️ Project Structure](#️-project-structure)
- [🔧 Tech Stack](#-tech-stack)
- [✨ Key Features](#-key-features)
- [📚 Documentation](#-documentation)
- [🤝 Contributing](#-contributing)
- [🎨 Style Guide](#-style-guide)

---

## ⚙️ Quick Start

### Prerequisites
- Node.js (v16+)
- Python 3.11+
- Firebase CLI

### Setup

1. **Clone and install:**
   ```bash
   git clone <your-repo-url>
   cd food-for-all-dc/my-app
   npm install
   ```

2. **Run frontend:**
   ```bash
   npm start
   ```
   Opens at [http://localhost:3000](http://localhost:3000)

3. **Setup Firebase emulator (optional):**
   ```bash
   npm install -g firebase-tools
   firebase login
   
   cd functions-python
   python3 -m venv venv
   source venv/bin/activate
   pip install -r requirements.txt
   
   cd ..
   firebase emulators:start
   ```
   ⚠️ **Use the Firebase Emulator for local testing only.**

---

## 🏗️ Project Structure

```
food-for-all-dc/
├── my-app/
│   ├── src/
│   │   ├── auth/              # Authentication & protected routes
│   │   ├── components/        # UI components
│   │   │   └── common/        # Reusable components (Button, Input, Modal)
│   │   ├── pages/             # App pages (Calendar, Profile, Reports, etc.)
│   │   ├── services/          # Business logic & API services
│   │   ├── context/           # React context providers
│   │   ├── hooks/             # Custom React hooks
│   │   ├── styles/           # CSS variables & global styles
│   │   ├── types/             # TypeScript definitions
│   │   └── utils/             # Utility functions
│   ├── functions-python/      # Python Cloud Functions
│   ├── package.json           # Frontend dependencies
│   └── firebase.json          # Firebase configuration
├── clean-code archive/        # Documentation archive
└── README.md                  # This file
```

---

## 🔧 Tech Stack

<table>
  <tr>
    <td width="50%">
      <h3>Frontend</h3>
      <ul>
        <li>React 18 + TypeScript</li>
        <li>Material UI (MUI v7)</li>
        <li>CSS Modules</li>
        <li>React Router v6</li>
        <li>DayPilot Calendar</li>
        <li>Leaflet (maps)</li>
        <li>React Virtuoso (virtualization)</li>
        <li>Luxon (date handling)</li>
      </ul>
    </td>
    <td width="50%">
      <h3>Backend</h3>
      <ul>
        <li>Firebase (Firestore, Auth, Cloud Functions)</li>
        <li>Python Cloud Functions:
          <ul>
            <li>Geocoding (address → coordinates)</li>
            <li>Clustering (delivery route optimization)</li>
            <li>User management (account deletion)</li>
            <li>Scheduled tasks (daily delivery updates)</li>
          </ul>
        </li>
      </ul>
    </td>
  </tr>
</table>

---

## ✨ Key Features

- **Client Management** - Client profiles, intake, and data management
- **Calendar** - Delivery scheduling and event management
- **Routes** - Delivery route planning and optimization
- **Reports** - Summary, client, and referral agency reports
- **User Management** - Role-based access (Admin, Manager, ClientIntake, Driver)

---

## 📚 Documentation

- **[Contributing Guide](CONTRIBUTING.md)** - How to contribute, code standards, and PR guidelines
- **[Styling Guide](my-app/STYLING.md)** - CSS Modules, theme variables, and component patterns
- **[Cursor Rules](.cursorrules)** - Code standards and architecture patterns

## 🔒 Security

- Client-side route protection via `ProtectedRoute`
- Password minimum: 8 characters
- Environment variables for sensitive config

---

## 🤝 Contributing

We welcome contributions! Please read our **[Contributing Guidelines](CONTRIBUTING.md)** before submitting a PR.

The guide covers:
- Code standards and best practices
- Git workflow and commit conventions
- Pull request process
- Common development workflows
- Style guide reference

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
- CSS Modules and theme variables
- Component patterns and best practices
- Code formatting and naming conventions

Following these guidelines helps everyone build a better Food For All DC experience!

---

## 📄 License

This project is licensed under the Apache License 2.0. See the [LICENSE](LICENSE) file for details.

Copyright 2025 National School Climate Center

---

## Scripts

```bash
npm start          # Development server
npm run build      # Production build
npm run lint       # Run ESLint
npm run lint:fix   # Fix linting issues
npm run format     # Format code with Prettier
```

---

<div align="center">
  <h3>🎉 Happy coding! 🎉</h3>
  <p>Together, we'll make Food For All DC even more impactful! 🥗</p>
  <p>If you have questions or need help, feel free to reach out via <a href="https://github.com/your-repo/issues">GitHub Issues</a>!</p>
</div>
