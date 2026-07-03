# Cavite Institute Property Management System

A fully functional property management system built with **HTML5, CSS3, Bootstrap 5, JavaScript**, **Node.js + Express.js**, and **MySQL**.

## Features

- **Dashboard** — Real-time statistics, Chart.js charts, recent activity tables
- **Inventory** — Full CRUD with search and filters
- **Categories & Locations** — Manage store configuration
- **Suppliers** — Supplier directory management
- **Borrow/Return** — Borrow requests, admin approval, return processing
- **Reports** — View, print, export to PDF and Excel
- **Authentication** — Session-based login with bcrypt password hashing
- **Role-based Access** — Admin and Staff roles

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | HTML5, CSS3, Bootstrap 5, JavaScript, Chart.js |
| Backend | Node.js, Express.js (MVC) |
| Database | MySQL |
| Auth | express-session, bcryptjs |

## Prerequisites

- [Node.js](https://nodejs.org/) (v16+)
- [MySQL](https://www.mysql.com/) Server
- [MySQL Workbench](https://www.mysql.com/products/workbench/) (optional, for DB management)

## Installation

### 1. Clone or open the project

```bash
cd OJT_InventorySystem
```

### 2. Configure the database

Open **MySQL Workbench** and run:

```
backend/database/schema.sql
```

Or via command line:

```bash
mysql -u root -p < backend/database/schema.sql
```

### 3. Configure environment variables

Copy and edit the `.env` file in the `backend` folder:

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

### 4. Install dependencies

```bash
cd backend
npm install
```

### 5. Seed sample data

```bash
npm run seed
```

### 6. Start the server

```bash
npm start
```

Open your browser at: **http://localhost:3000**

## Default Login Credentials

| Role  | Username | Password  |
|-------|----------|-----------|
| Admin | admin    | admin123  |
| Staff | staff    | staff123  |

## Project Structure

```
OJT_InventorySystem/
├── backend/
│   ├── config/          # Database configuration
│   ├── controllers/     # Route controllers (MVC)
│   ├── database/        # SQL schema and seed script
│   ├── middleware/      # Auth and validation middleware
│   ├── models/          # Database models (MVC)
│   ├── routes/          # API routes
│   ├── utils/           # Helpers and utilities
│   ├── .env             # Environment variables
│   ├── package.json
│   └── server.js        # Entry point
├── frontend/
│   ├── css/             # Stylesheets
│   ├── js/
│   │   ├── components/  # Reusable layout components
│   │   ├── pages/       # Page-specific JavaScript
│   │   ├── api.js       # API client
│   │   └── auth.js      # Auth utilities
│   ├── pages/           # HTML pages
│   └── index.html       # Login page
└── README.md
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/auth/login | User login |
| POST | /api/auth/logout | User logout |
| GET | /api/dashboard | Dashboard data |
| GET/POST/PUT/DELETE | /api/inventory | Inventory CRUD |
| GET/POST/PUT/DELETE | /api/categories | Categories CRUD |
| GET/POST/PUT/DELETE | /api/suppliers | Suppliers CRUD |
| GET/POST/PUT/DELETE | /api/locations | Locations CRUD |
| GET/POST | /api/borrow | Borrow transactions |
| PUT | /api/borrow/:id/approve | Approve borrow (admin) |
| PUT | /api/borrow/:id/reject | Reject borrow (admin) |
| POST | /api/borrow/:id/return | Process return |
| GET | /api/reports/:type | Get report data |
| GET | /api/reports/export/pdf/:type | Export PDF |
| GET | /api/reports/export/excel/:type | Export Excel |

## Database Tables

- `roles` — User roles (admin, staff)
- `users` — System users
- `categories` — Item categories
- `suppliers` — Supplier directory
- `locations` — Storage locations
- `inventory_items` — Inventory records
- `borrow_transactions` — Borrow requests
- `borrow_items` — Borrow line items
- `return_transactions` — Return records
- `activity_logs` — System activity log

## Development

```bash
# Run with auto-reload
npm run dev
```

## License

Educational project for Cavite Institute.
