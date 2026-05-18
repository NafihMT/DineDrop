# 🍽️ DineDrop

![.NET 8](https://img.shields.io/badge/.NET-8.0-512BD4?style=for-the-badge&logo=dotnet)
![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![Vite](https://img.shields.io/badge/Vite-B73BFE?style=for-the-badge&logo=vite&logoColor=FFD62E)
![SignalR](https://img.shields.io/badge/SignalR-0078D4?style=for-the-badge&logo=microsoft&logoColor=white)
![Clean Architecture](https://img.shields.io/badge/Clean_Architecture-10B981?style=for-the-badge)

**DineDrop** is a robust, production-ready food delivery and restaurant management platform. It features a high-performance **.NET Core API** built on **Clean Architecture** principles and a modern, responsive **React** frontend.

---

## ✨ Key Features

### 🛒 For Customers
- **Seamless Ordering**: Browse local restaurants, explore categorized menus, and manage your cart.
- **Real-Time Order Tracking**: Live order status updates powered by **SignalR** WebSocket connections.
- **Secure Payments & Wallet**: Built-in wallet management, transaction history, and support for promotional offers and coupons.
- **Location & Address Management**: Interactive address picker and saved delivery locations.

### 🏪 For Restaurant Owners
- **Premium Dashboard**: Real-time sales analytics, revenue ledger, and order volume metrics.
- **Live Order Fulfillment**: Instantly receive new incoming orders via SignalR with status progression (Pending ➡️ Preparing ➡️ Out for Delivery ➡️ Delivered).
- **Menu Item Management**: Complete menu item and category CRUD with live image uploads and validation.

### 🛡️ For Administrators
- **System Oversight**: Manage user approvals (verifying restaurant onboarding requests).
- **Security & Token Management**: Robust user role management with strict role-based access control (RBAC).

---

## 🏗️ Architecture & Project Structure

The repository is structured into two main decoupled environments:

```
DineDrop/
│
├── backend/                  # .NET 8 Clean Architecture Solution
│   ├── DineDrop.API/         # Presentation Layer (Controllers, Hubs, Middlewares)
│   ├── DineDrop.Application/ # Business Logic & Application Services (Interfaces, DTOs)
│   ├── DineDrop.Domain/      # Core Domain Entities, Enums, and Constants
│   └── DineDrop.Infrastructure/ # EF Core Data Access, Migrations, Real-Time Hubs, Identity
│
└── frontend/                 # React Single Page Application (Vite)
    ├── public/               # Static assets & icons
    └── src/                  # Components, Dashboards, Auth Flows, and Styles
```

### Backend Tech Stack
- **Framework**: .NET 8 / ASP.NET Core Web API
- **Architecture**: Clean Architecture / CQRS pattern inspired structure
- **Database**: SQL Server via **Entity Framework Core**
- **Authentication**: JWT with secure **HTTP-only Cookies** & Refresh Token Rotation
- **Real-Time Communication**: Microsoft SignalR (`OrderHub`)
- **Password Security**: BCrypt password hashing

### Frontend Tech Stack
- **Framework**: React 18 + Vite
- **Styling**: Modern CSS with CSS Variables & Responsive Glassmorphism Design
- **Routing & State**: Dynamic view rendering & contextual state management

---

## 🚀 Getting Started (Local Development)

### Prerequisites
- [.NET 8 SDK](https://dotnet.microsoft.com/download/dotnet/8.0)
- [Node.js (v18+)](https://nodejs.org/)
- [SQL Server](https://www.microsoft.com/en-us/sql-server/sql-server-downloads) (or SQL Server Express / Docker container)

### 1️⃣ Backend Setup
1. Open a terminal and navigate to the backend API directory:
   ```bash
   cd backend/DineDrop.API
   ```
2. **Setup Configuration**:
   Duplicate the template config file to create your local development settings:
   ```bash
   cp appsettings.example.json appsettings.json
   ```
   *Note: Open `appsettings.json` and configure your `DefaultConnection` string to point to your local SQL Server instance.*

3. **Apply Database Migrations**:
   Navigate to the project root or use the EF CLI to update your database:
   ```bash
   dotnet ef database update --project ../DineDrop.Infrastructure --startup-project .
   ```
   *Note: Migrations will automatically seed default Admin credentials (`admin@dinedrop.com` / `Admin@123`).*

4. **Run the API Server**:
   ```bash
   dotnet run
   ```
   The backend API will start on `http://localhost:5000` (or `https://localhost:5001`).

### 2️⃣ Frontend Setup
1. Open a separate terminal and navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. **Install Dependencies**:
   ```bash
   npm install
   ```
3. **Run the Development Server**:
   ```bash
   npm run dev
   ```
4. Open your browser and navigate to `http://localhost:5173`.

---

## 🔐 Security Highlights

- **Zero Secret Exploitation**: Sensitive files like `appsettings.json` and `.env` files are explicitly excluded via `.gitignore`.
- **Token Protection**: Access tokens and refresh tokens are securely transmitted and stored using strict `HttpOnly`, `Secure`, and `SameSite` cookie policies to guard against XSS and CSRF attacks.
- **Simultaneous Token Validation**: Strict validation ensures both access and refresh tokens are verified before performing secure token revocations or logouts.

---

## 📄 License
This project is proprietary and confidential. Unauthorized copying of files via any medium is strictly prohibited.
