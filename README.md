# Al-Madina Electronics & Appliances ERP

Enterprise Showroom Business Management System for Electronics & Home Appliances Retail, Wholesale & Installment Recovery.

![Al-Madina ERP](https://img.shields.io/badge/Platform-Al--Madina%20ERP-blue)
![Build](https://img.shields.io/badge/Build-Passing-brightgreen)
![React](https://img.shields.io/badge/React-19.0-61dafb)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178c6)
![TailwindCSS](https://img.shields.io/badge/TailwindCSS-v4-38bdf8)
![License](https://img.shields.io/badge/License-Proprietary-red)

---

## 1. Project Overview

**Al-Madina Electronics & Appliances ERP** is a full-featured, showroom-tailored Enterprise Resource Planning system specifically engineered for Pakistani electronics showrooms. It handles end-to-end showroom workflows including:
- Cash, Credit, and Hire-Purchase/Installment sales.
- IMEI and Serial Number inventory tracking with supplier traceability.
- Double-entry chart of accounts, vouchers, customer & supplier ledgers, and trial balances.
- Post-dated cheque (PDC) clearing registers.
- Staff daily task queues, biometric-style attendance, and front-desk visitor registration.
- Audit-grade PDF exports and native Excel (`.xlsx`) two-way import/export.
- Optional WordPress / WooCommerce REST API synchronization.

---

## 2. Technology Stack

- **Frontend Core:** React 19 (SPA Architecture), TypeScript, Vite 8.
- **Styling & Design System:** Tailwind CSS v4, Lucide React Iconography, Motion.
- **Data Analytics & Visualizations:** Recharts 3.x responsive charting engine.
- **Document Generation:** `jspdf` & `jspdf-autotable` for audit-ready PDF statements.
- **Spreadsheet Processing:** `xlsx` (SheetJS) for native Excel import, export, and template generation.
- **Database & Persistence:**
  - Reactive Local Storage & In-Memory Cache engine with live observer pattern subscriptions.
  - Optional Google Cloud Firestore & Firebase Auth integration.
- **CI / CD:** GitHub Actions automated linting, type-checking, and production bundle verification.

---

## 3. Core Showroom Modules

1. **Executive Dashboard (`DashboardView`)**: Real-time sales turnover, inventory valuation, active receivables, Recharts 6-month sales & purchase trend visualization with performance insights.
2. **Sales & POS Billing (`POSBillingView`)**: Barcode scanning, serial number assignment, Cash / Credit / Installment invoicing, thermal & A4 invoice printing.
3. **Products & Serialized Inventory (`InventoryView`)**: Multi-category appliances catalog (ACs, Refrigerators, LED TVs, Washing Machines), warranty tracking, and serial status lifecycles.
4. **Purchase Invoices & Consignments (`PurchasesView`)**: Supplier consignment intake, landed freight costing, serial unit generation, and accounts payable ledger updates.
5. **Installments & Recovery (`InstallmentsView`)**: Hire-purchase financing calculator, guarantor recording, installment schedules, recovery officer assignments, and receipt generation.
6. **Customers Directory (`CustomersView`)**: Customer profiles, CNIC numbers, credit limits, outstanding balances, and Excel import/export.
7. **Suppliers & Vendors (`SuppliersView`)**: Distributor contacts, NTN registration, payment terms, and accounts payable ledgers.
8. **Staff Attendance (`AttendanceView`)**: Floor check-in/out, working hours, late arrivals, half-day tracking, and monthly attendance sheets.
9. **Daily Staff Tasks (`TasksView`)**: Departmental to-do management, priority tagging (Urgent to Low), status transitions, and progress monitoring.
10. **Visitors Register (`VisitorsView`)**: Showroom footfall logger, visitor purpose categorization, and floor checkout tracking.
11. **Vouchers & Journals (`AccountingView`)**: Double-entry Journal (JV), Payment (PV), Receive (RV), and Contra (CV) vouchers with debit=credit validation.
12. **Ledgers & Trial Balance (`LedgersView`)**: Real-time customer, supplier, and general ledger account statements with running balances.
13. **Cheque Management (`ChequesView`)**: Post-dated customer and vendor cheques, clearing registers, and automatic bank reconciliation.
14. **Reports & Financial Intelligence (`ReportsView`)**: Profit & Loss statements, COGS, Stock Valuation, Due Date Recovery Lists, and Brand-wise analytics.
15. **Targets & Goals (`TargetsView`)**: Monthly showroom sales and recovery quotas dynamically computed from real transactions.
16. **Audit Trail & Backup (`AuditBackupView`)**: Full audit history logging user actions, JSON backup download, and disaster restore.
17. **Showroom Settings (`SettingsView`)**: Showroom header details, NTN/STRN, print format selection, and WordPress / WooCommerce API credentials.

---

## 4. Installation & Local Development

### Prerequisites
- Node.js **22 LTS**
- **npm** (`npm ci` with `package-lock.json`)

### Setup Commands
```bash
# Clone the repository
git clone https://github.com/clientbridge28-alt/Al-Madina-Electronics-Appliances.git
cd Al-Madina-Electronics-Appliances

# Clean deterministic install from package-lock.json
npm ci

# Start full-stack dev server (Express API + Vite frontend on port 3000)
npm run dev
```
The application will launch on `http://localhost:3000`.

---

## 5. Environment Variables & Security

Configure environment variables by copying `.env.example`:
```bash
cp .env.example .env
```

| Variable | Scope | Description |
| :--- | :--- | :--- |
| `VITE_BASE` | Frontend Build | GitHub Pages subpath (`/Al-Madina-Electronics-Appliances/`) |
| `VITE_API_BASE_URL` | Frontend Build | Companion Express / Cloud Run backend URL (when static-hosted on GitHub Pages) |
| `VITE_FIREBASE_API_KEY` | Frontend Public | Firebase Web API key (optional override over `firebase-applet-config.json`) |
| `VITE_FIREBASE_AUTH_DOMAIN` | Frontend Public | Firebase Auth domain |
| `VITE_FIREBASE_PROJECT_ID` | Frontend Public | Firebase Project ID |
| `VITE_FIREBASE_STORAGE_BUCKET` | Frontend Public | Firebase Storage bucket |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Frontend Public | Firebase Messaging sender ID |
| `VITE_FIREBASE_APP_ID` | Frontend Public | Firebase Web App ID |
| `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS` | Backend Only | SMTP relay for MFA OTPs and owner security emails |
| `WP_SITE_URL`, `WP_REST_USERNAME`, `WP_APP_PASSWORD`, `WP_WC_KEY`, `WP_WC_SECRET` | Backend Only | Server-side WordPress/WooCommerce credentials (never exposed to browser) |

> **Security Rule:** Never commit `.env` or files containing live credentials, and never prefix private SMTP, WordPress, WooCommerce, or Firebase Admin secrets with `VITE_`.

---

## 6. Role-Based Access Control (RBAC)

The ERP enforces strict role-based profiles:
- **Owner / Super Admin (`clientbridge28@gmail.com`):** Full system authority, 21×7 permissions matrix, session revocation, security events, and disaster recovery restore.
- **Manager / Accountant / Cashier / StockManager / RecoveryOfficer / Receptionist:** Granular Firestore-enforced permissions per module and action.

---

## 7. Build, Verification & Deployment Architecture

```bash
npm run lint        # TypeScript check (tsc --noEmit)
npm run lint:rules  # Firestore security rules audit
npm test            # Vitest ERP accounting, inventory & RBAC suite
npm run build       # Production Vite bundle + dist/404.html SPA fallback
```

### GitHub Pages (Static Frontend) vs. Companion Backend (`server.ts`)
- **Works directly on GitHub Pages (`https://clientbridge28-alt.github.io/Al-Madina-Electronics-Appliances/`):**
  - Firebase Authentication (Google Sign-In, Email/Password, password reset, email verification).
  - Live Cloud Firestore real-time CRUD across all showroom modules (POS, Inventory, Purchases, Returns, Installments, Customers, Suppliers, Attendance, Tasks, Visitors, Vouchers, Ledgers, Cheques, Reports, Targets, Audit Logs).
  - Client-side Excel (`.xlsx`), CSV, JSON, and PDF exports & backups.
  - Isolated Client Demo Showcase (local read-only sandbox).
- **Requires Companion Backend (`server.ts` via Cloud Run / `Dockerfile` + `VITE_API_BASE_URL`):**
  - Owner staff account provisioning & session revocation (`/api/admin/users*`).
  - Email OTP MFA (`/api/mfa/request`, `/api/mfa/verify`) and SMTP security alerts (`/api/notifications/owner`).
  - Disaster Recovery server restore (`/api/admin/restore`).
  - Server-proxied WordPress / WooCommerce sync and secondary backup (`/api/wordpress/*`).

---

## 8. Data Modes

- **Live Cloud Firestore Mode (Default):** Authenticated showroom sessions synchronized in real time with Cloud Firestore.
- **Isolated Client Demo Showcase:** Local read-only sample dataset accessible from the login screen for client demonstrations without touching production Firestore records.
