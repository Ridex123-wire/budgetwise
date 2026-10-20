# BudgetWise 💰

**A personal finance app built with React Native, Expo, and Firebase.**

BudgetWise is a money-management application designed to help users track their finances, manage budgets, and work toward their savings goals.

## ✨ Features

- **User Authentication** — Create an account and sign in with Firebase Authentication.
- **Financial Dashboard** — View income, expenses, and financial summaries.
- **Transaction Management** — Add, edit, delete, and review income and expenses.
- **Budget Management** — Access the budgeting section to organize financial plans.
- **Savings Goals** — Use the savings section to work toward personal financial goals.
- **Profile & Settings** — View account information and manage account-related actions.
- **Cloud Data Storage** — Store user data in Firebase Cloud Firestore.
- **Protected User Data** — Firebase security rules are used to restrict access to user-owned data.

## 🛠️ Technologies Used

- React Native
- Expo
- Expo Router
- TypeScript
- Firebase Authentication
- Cloud Firestore
- Cloud Functions for Firebase
- Git and GitHub

## 📱 Project Screens

BudgetWise includes screens for:

- Home
- Dashboard
- Transactions
- Budgets
- Savings
- Explore
- Profile and Settings
- Login and Sign Up

## 🚀 Getting Started

### Prerequisites

Before running the project, install:

- [Node.js](https://nodejs.org/)
- [Git](https://git-scm.com/)
- [Expo Go](https://expo.dev/go/) if you want to test on a compatible mobile device

You will also need a Firebase project.

### 1. Clone the repository

```bash
git clone https://github.com/Ridex123-wire/budgetwise.git
```

### 2. Open the project folder

```bash
cd budgetwise
```

### 3. Install dependencies

```bash
npm install
```

### 4. Configure Firebase

Open `app/config/firebase.ts` and configure the Firebase client settings for your own Firebase project.

In the Firebase Console:

1. Enable Email/Password authentication.
2. Set up Cloud Firestore.
3. Configure and test your Firestore security rules before using real user data.

Never commit private service-account credentials, private keys, passwords, or other secrets to GitHub.

### 5. Start the application

```bash
npx expo start
```

Follow the Expo terminal instructions to run the app on a supported device or development platform.

## 🎯 Project Goal

BudgetWise is part of my journey as a developer, combining mobile app development, user authentication, cloud data storage, and practical financial-management features.

I am continuing to improve the application, expand its functionality, and strengthen its reliability and security.

## 👨‍💻 Developer

**Ridwan Adekunle**

Frontend developer growing toward full-stack and mobile development.

- Portfolio: [Devora](https://devora-portfolio-nizxk3hh3-ridex123-wire.vercel.app)
- GitHub: [Ridex123-wire](https://github.com/Ridex123-wire)

---

Built with purpose, one feature at a time. 🚀