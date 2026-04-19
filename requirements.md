# Gym Management PWA - Product Requirements Document

## 1. Overview
A full-featured Progressive Web App (PWA) for gym owners to manage members, payments, expenses, and plans. Built with React, Tailwind CSS, and Firebase.

## 2. Core Features
*   **Authentication:** Firebase Auth (Email/Password) with multi-gym isolation via `gymId`.
*   **Member Management:** Full CRUD, status auto-calculation (Active/Expired/Pending), WhatsApp integration for reminders.
*   **Payment System:** Cash/UPI tracking, auto-extension of membership, full history.
*   **Expense Tracking:** Category-based expenses with monthly summaries.
*   **Dashboard:** Real-time stats (Income, Expenses, Net Profit), member status charts, and expiry alerts.
*   **Plan Management:** Custom plans with price and duration-based logic.
*   **Notification System:** In-app alerts for expired memberships and payments.
*   **PWA:** Offline support, installable on mobile, manifest.json, and service workers.

## 3. Tech Stack
*   **Frontend:** React (Vite), Tailwind CSS
*   **Backend:** Firebase (Firestore, Auth)
*   **Charts:** Recharts
*   **Integration:** WhatsApp Cloud API / Twilio
*   **PWA:** vite-plugin-pwa

## 4. Data Structure (Firestore)
*   `gyms/`: Admin profile details.
*   `members/`: Name, phone, plan, expiry, gymId.
*   `payments/`: Amount, method, memberId, date, gymId.
*   `expenses/`: Amount, category, date, gymId.
*   `plans/`: Name, price, duration, gymId.
*   `notifications/`: Alerts for the gym admin.