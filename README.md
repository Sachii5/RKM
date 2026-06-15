# RKM (Rute Kunjungan Mingguan) System

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![Build](https://img.shields.io/badge/build-passing-success.svg)
![Vue](https://img.shields.io/badge/Vue.js-3.0-4FC08D.svg?logo=vue.js)
![Node](https://img.shields.io/badge/Node.js-18+-339933.svg?logo=node.js)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15+-336791.svg?logo=postgresql)

## Description

The RKM (Rute Kunjungan Mingguan) System is an interactive, map-based tracking and zoning application designed to digitize and enforce salesman field visits. It features geospatial route planning, real-time survey data collection, strict photo-evidence validation, and comprehensive analytic dashboards for supervisors and administrators to enforce operational compliance.

## Table of Contents

- [Features](#features)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Environment Variables](#environment-variables)
- [Usage/Running the App](#usagerunning-the-app)
- [Architecture/Folder Structure](#architecturefolder-structure)
- [Contributing](#contributing)
- [License](#license)

## Features

- **Geospatial Route Planning (Zoning):** Interactive leaflet-based maps allowing supervisors to define radius-based visit zones and assign members to salesmen.
- **Strict Compliance & Photo Validation:** Visit workflows that require live photo evidence. Supervisors must manually approve or reject flagged visits based on photo integrity.
- **Dynamic Field Surveys:** Built-in survey modules capturing competitor analysis, inventory checks, and customer feedback.
- **Real-time Analytics Dashboard:** Comprehensive tracking of visit completion rates (SLA), pending approvals, and salesman performance metrics.
- **Hierarchical Role Management:** Granular access controls ensuring strict boundaries between Salesmen, Supervisors, Managers, and System Admins.
- **Automated Data Export:** Instant generation of clean CSV and Excel data extracts for business intelligence integration.
- **Partitioned Database Architecture:** High-performance PostgreSQL setup utilizing monthly table partitions for millions of visit logs.

## Prerequisites

Ensure you have the following installed on your local development machine:

- Node.js (v18.0.0 or higher)
- npm (v9.0.0 or higher)
- PostgreSQL (v15.0 or higher)
- Git

## Installation

Follow these steps to clone the repository and set up the development environment:

```bash
# 1. Clone the repository
git clone https://github.com/[INSERT_ORG_NAME]/RKM.git

# 2. Navigate into the project directory
cd RKM

# 3. Install Backend Dependencies
cd backend
npm install

# 4. Install Frontend Dependencies
cd ../frontend
npm install
```

### Database Setup

1. Log into your PostgreSQL instance.
2. Create a new database named `rkmspi`:
   ```sql
   CREATE DATABASE rkmspi;
   ```
3. Run the schema migration script:
   ```bash
   cd backend/database
   psql -U postgres -d rkmspi -f schema.sql
   ```

## Environment Variables

Create a `.env` file in the `backend/` directory based on the following template. Do not expose real credentials in your version control system.

```env
# Server Configuration
PORT=3000
NODE_ENV=development

# PostgreSQL Database Configuration
DB_USER=postgres
DB_PASSWORD=[INSERT_DB_PASSWORD_HERE]
DB_HOST=localhost
DB_PORT=5432
DB_NAME=rkmspi

# Authentication Security
JWT_SECRET=[INSERT_STRONG_SECRET_KEY_HERE]
```

## Usage/Running the App

### Start the Backend Server (Development Mode)
```bash
cd backend
npm run dev
```
*The backend server will start on `http://localhost:3000`.*

### Start the Frontend Server (Development Mode)
```bash
cd frontend
npm run dev
```
*The frontend application will start on `http://localhost:5173`.*

## Architecture/Folder Structure

```text
RKM/
├── backend/                  # Express.js REST API
│   ├── database/             # SQL schemas and migration scripts
│   ├── src/                  
│   │   ├── controllers/      # Request handlers and business logic
│   │   ├── middleware/       # JWT auth and RBAC validation
│   │   ├── routes/           # API endpoint definitions
│   │   ├── services/         # Core logic and integrations
│   │   └── utils/            # Cryptography, partitioning, and helpers
│   ├── uploads/              # Ignored directory for user-uploaded survey photos
│   ├── .env                  # Environment variables (ignored)
│   └── server.js             # Application entry point
├── frontend/                 # Vue.js 3 SPA Application
│   ├── public/               # Static assets
│   ├── src/
│   │   ├── assets/           # CSS and styling files
│   │   ├── components/       # Reusable Vue components
│   │   ├── composables/      # Shared Vue composition logic
│   │   ├── pages/            # View/Route components
│   │   ├── router/           # Vue-Router configuration
│   │   └── stores/           # Pinia state management
│   ├── index.html            # Main HTML template
│   ├── tailwind.config.js    # Tailwind CSS configuration
│   └── vite.config.js        # Vite bundler configuration
├── .gitignore                # Git ignore rules
└── README.md                 # Project documentation
```

## Contributing

1. Fork the repository.
2. Create a feature branch: `git checkout -b feature/your-feature-name`.
3. Commit your changes. Use Conventional Commits (e.g., `feat: add user management`, `fix: resolve auth token issue`).
4. Push to the branch: `git push origin feature/your-feature-name`.
5. Open a Pull Request for review.

## License

This project is licensed under the [MIT License](https://opensource.org/licenses/MIT).
