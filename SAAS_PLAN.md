# 🚀 FAJ Multi-Tenant SaaS Transformation Plan

This document serves as the primary architectural reference for transforming the FAJ Security Management System into a multi-tenant platform for commercial subscription services.

---

## 🏗️ 1. Database Architecture (PostgreSQL)
The system will shift from a single-owner model to a shared-infrastructure model with data isolation.

### A. New `companies` Table
This table will store the master data for each client.
- `id`: Primary Key (Serial)
- `name`: Formal name of the company.
- `company_code`: Unique identifier for login (e.g., `COMP01`, `SOLUTIONS`).
- `subscription_plan`: (Basic, Pro, Enterprise).
- `expiry_date`: Date when access is automatically revoked.
- `status`: (Active, Suspended, Expired).
- `max_users`: Limit on the number of guards allowed for this company.

### B. Table Updates
A `company_id` (Foreign Key) column will be added to the following tables:
- `users`
- `visitors`
- `patrol_rounds`
- `locations`
- `activity_log`
- `role_permissions` (Enables per-company custom permissions).

---

## 🛠️ 2. Super Admin Interface (GM Portal)
A restricted portal accessible only by the General Manager (Owner of the FAJ platform).

- **Global Dashboard:** Overview of total active companies, total guards in the system, and revenue metrics.
- **Company Lifecycle Management:** 
    - Register new companies.
    - Automatic generation of the first 'Admin' user for every new company.
- **Subscription Management:** 
    - Extend or shorten subscription dates.
    - Instant "Kill Switch" to suspend access for non-paying clients.

---

## ⚙️ 3. Backend API & Data Isolation
The server-side logic will be upgraded to ensure data privacy.

- **Multi-Tenant Middleware:** Every API request will pass through a layer that extracts the `company_id` from the JWT token and enforces it on all SQL queries.
    - *Example:* `SELECT * FROM visitors` becomes `SELECT * FROM visitors WHERE company_id = ?`.
- **Enhanced Authentication:** 
    - Login credentials will now require `company_code`.
    - Verification sequence: 1. Does Company exist? -> 2. Is Company Active? -> 3. Is User Active? -> 4. Verify Password.

---

## 🖥️ 4. Client Interface (The Company View)
The experience for the end-client (Security Managers and Guards).

- **Unified Login:** A professional login screen with a new field for "Company Code".
- **Isolated Workspace:** Each company sees only their own data. They cannot see or interact with the Super Admin panel or other companies.
- **Subscription Awareness:** In-app notifications for admins when their subscription is nearing its expiry date.

---

## 🔄 5. Registration Workflow (Adding new Clients)
1. **GM Action:** Log into Super Admin Panel.
2. **Registration:** Enter Company Name, Code, and Expiry Date.
3. **Automated Setup:** System creates the company entry and the first Master Admin account.
4. **Onboarding:** GM sends the login link and credentials to the new client.
5. **Client Autonomy:** The client logs in and begins adding their own guards and locations.

---

## 📈 6. Implementation Strategy
1. **Phase 1:** DB Schema Migration (Add `companies` table and `company_id` columns).
2. **Phase 2:** Backend Logic Update (Multi-tenant middleware and scoping).
3. **Phase 3:** Super Admin UI Development.
4. **Phase 4:** Frontend Login and Dashboard branding updates.

---
*Created: February 2026*
