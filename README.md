# Cavite Institute Property Management System

School property management system for Cavite Institute — track assets, run lifecycle workflows, generate documents, and control access by role.

Built with **HTML5, CSS3, Bootstrap 5, JavaScript**, **Node.js + Express.js**, and **MySQL**.

## Features

- **Dashboard** — Role-aware stats, Chart.js charts, and recent activity
- **Inventory** — Property-tagged assets with batch IDs, serial numbers, classifications, and components
- **Borrow / Return** — Request, approve, and process returns
- **Transfers** — Move assets between departments/locations
- **Maintenance** — Submit and operate repair/service requests
- **Disposals** — Submit, inspect, and approve disposal requests
- **Pending Approvals** — Property Manager hub for borrow, transfer, maintenance, and disposal queues
- **Departments, Locations & Users** — System configuration (Administrator)
- **Suppliers** — Supplier directory
- **Documents** — Generated forms (PAR, GRN, RDF, ABL, TRF, RTF)
- **Reports** — View, print, and export to PDF/Excel
- **Archive** — Archived records (Administrator & Property Manager)
- **Notifications** — In-app alerts
- **Backup / Restore** — Database backup management (Administrator)
- **Authentication & RBAC** — Session login with bcrypt; Administrator, Property Manager, and Custodian
- **PWA** — Installable web app (`manifest.webmanifest`, service worker)

## Roles

| Role | Access summary |
|------|----------------|
| **Administrator** | System setup (users, departments, locations, suppliers), manage inventory school-wide, view workflows, full reports, archive, and backup management. Does **not** approve borrows/transfers or process returns. |
| **Property Manager** | Operational approvals and processing: borrow approve/reject, returns, transfers, maintenance, and disposals. Manage inventory and suppliers. Pending Approvals, reports, and archive. |
| **Custodian** | Department-scoped (`assigned_department_id`). View assigned inventory, submit borrow/transfer/maintenance/disposal requests, and access a limited set of reports. Cannot approve workflows or manage inventory. |

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | HTML5, CSS3, Bootstrap 5, JavaScript, Chart.js, Bootstrap Icons |
| Backend | Node.js, Express.js (MVC) |
| Database | MySQL (`mysql2`) |
| Auth | express-session, bcryptjs |
| Export | pdfkit, exceljs |
| Validation | express-validator |

The backend serves both the API and the static frontend from one process (no separate frontend build).

## Prerequisites

- [Node.js](https://nodejs.org/) (v16+)
- [MySQL](https://www.mysql.com/) Server
- [MySQL Workbench](https://www.mysql.com/products/workbench/) (optional)

## Installation

### 1. Open the project

```bash
cd inventory_system/backend
```

### 2. Configure environment variables

Create a `.env` file in the `backend` folder:

```env
PORT=3000
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=cavite_inventory
DB_PORT=3306
SESSION_SECRET=your_secret_key
NODE_ENV=development
```

### 3. Install dependencies

```bash
npm install
```

### 4. Set up the database

**Option A — one-shot setup** (runs `schema.sql` + seed):

```bash
npm run setup
```

**Option B — manual:**

```bash
mysql -u root -p < database/schema.sql
npm run seed
```

On `npm start`, additional schema migrations run automatically (SOP, archive, documents, property-based inventory, batch/serial fields, and related updates).

### 5. Seed demo accounts (optional)

```bash
npm run seed:test-accounts
npm run verify:demo-accounts
```

Optional sample workflow data:

```bash
npm run seed:sample-data
```

### 6. Start the server

```bash
npm start
```

Open **http://localhost:3000**

For auto-reload during development:

```bash
npm run dev
```

## Default Login Credentials

| Role | Username | Password |
|------|----------|----------|
| Administrator | admin | admin123 |
| Property Manager | pm_test | pm123456 |
| Custodian (ICT) | ict_custodian | cust123456 |

See [`TEST_ACCOUNTS.md`](TEST_ACCOUNTS.md) for the full demo account list (including Engineering and SHS custodians).

Administrator (`admin` / `admin123`) comes from `npm run seed` and is not overwritten by the demo account seed.

## Project Structure

```
inventory_system/
├── README.md
├── TEST_ACCOUNTS.md
├── backend/
│   ├── config/              # Database configuration
│   ├── controllers/         # Route controllers (MVC)
│   ├── database/            # schema.sql, seeds, migrations
│   ├── middleware/          # Auth and validation
│   ├── models/              # Database models (MVC)
│   ├── routes/              # API routes
│   ├── utils/               # Role helpers, documents, backups, inventory services
│   ├── storage/             # Backup files and related storage
│   ├── .env                 # Environment variables (create locally)
│   ├── package.json
│   └── server.js            # Entry point (API + static frontend)
└── frontend/
    ├── css/
    ├── images/
    ├── vendor/              # Bootstrap Icons, etc.
    ├── js/
    │   ├── components/      # Layout, nav, shared UI
    │   ├── pages/           # Page-specific scripts
    │   ├── vendor/          # Chart.js
    │   ├── api.js
    │   └── auth.js
    ├── pages/               # App HTML pages
    ├── index.html           # Login
    ├── forgot-password.html
    ├── manifest.webmanifest
    └── sw.js
```

## Main Pages

| Page | Path | Roles |
|------|------|-------|
| Dashboard | `/pages/dashboard.html` | All |
| Pending Approvals | `/pages/pending-approvals.html` | Property Manager |
| Inventory | `/pages/inventory.html` | All |
| Borrow | `/pages/orders.html` | All |
| Transfers | `/pages/transfer-requests.html` | Property Manager, Custodian |
| Maintenance | `/pages/maintenance-requests.html` | All |
| Disposals | `/pages/disposal-requests.html` | All |
| Suppliers | `/pages/suppliers.html` | Administrator, Property Manager |
| Departments / Locations / Users | `/pages/manage-*.html` | Administrator |
| Reports | `/pages/reports.html` | All (Custodian: limited types) |
| Archive | `/pages/archive.html` | Administrator, Property Manager |
| Documents | `/pages/documents.html` | Administrator, Property Manager |
| Settings | `/pages/settings.html` | All |

## API Overview

| Area | Base path |
|------|-----------|
| Auth | `/api/auth` |
| Dashboard | `/api/dashboard` |
| Inventory | `/api/inventory` |
| Components | `/api/components` |
| Departments | `/api/departments` |
| Locations | `/api/locations` |
| Suppliers | `/api/suppliers` |
| Users | `/api/users` |
| Borrow / Return | `/api/borrow` |
| Transfers | `/api/transfers` |
| Maintenance | `/api/maintenance` |
| Disposals | `/api/disposals` |
| Reports | `/api/reports` |
| Documents | `/api/documents` |
| Notifications | `/api/notifications` |
| Archive | `/api/archive` |
| Backups | `/api/backups` |
| Search | `/api/search` |
| Health | `/api/health` |

Legacy `/api/categories` may still exist; the UI uses **Departments**.

## Database (core tables)

- `roles`, `users` — Auth and RBAC (custodians use `assigned_department_id`)
- `departments`, `locations`, `suppliers`
- `inventory_items` — Assets (property tags, batch/serial fields via migrations)
- `borrow_transactions`, `borrow_items`, `return_transactions`
- `transfer_requests`, `maintenance_records`, `disposal_requests`
- `component_replacements`, `notifications`, `activity_logs`
- Document and backup-related tables are added by startup migrations

## Useful Scripts

```bash
cd inventory_system/backend

npm run setup                  # schema + seed
npm run seed                   # base seed (includes admin)
npm run seed:test-accounts     # PM + custodian demos
npm run verify:demo-accounts
npm run seed:sample-data
npm run cleanup:sample-data
npm run reset:system-data
npm run migrate:sop
npm run migrate:archive
```

## License

Educational project for Cavite Institute.
