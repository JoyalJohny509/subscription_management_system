# 👥 Brightloop SMS — Team Task Division & Development Roadmap (Team of 4)

This roadmap organizes the next phase of development across 4 distinct, balanced roles to satisfy all project criteria (including active Git collaboration across all members).

---

## 🏗️ Team Roles & Ownership

| Member | Title | Primary Ownership |
|---|---|---|
| **Member 1** | **Core Engine & Billing Architect** | Automated cron billing, subscription lifecycle, pro-rated seat upgrades, DB migrations |
| **Member 2** | **Frontend Lead & UI/UX Specialist** | Customer self-service portal, interactive MRR/ARR analytics charts, mobile responsiveness |
| **Member 3** | **Integrations & Payments Engineer** | Printable/PDF invoice generation, dynamic UPI QR codes, email notifications |
| **Member 4** | **Security, QA & DevOps Engineer** | Input validation (Zod), rate limiting, automated testing suite (Supertest/Jest), GitHub Actions CI |

---

## 👨‍💻 Member-by-Member Breakdown

### 🔹 Member 1: Core Engine & Billing Architect
- **Auto-Billing Cron Job**: Build a background scheduler (`backend/src/jobs/billingCron.js`) running daily to detect subscriptions due for billing and auto-generate invoices.
- **Auto-Close Rules**: Trigger automatic closure when `auto_close = 1` and end date is reached.
- **Seat / Add-on Upgrades**: Implement mid-cycle seat additions/removals with pro-rated billing calculation.
- **Database Migrations**: Coordinate database schema revisions and maintain referential integrity.

### 🔹 Member 2: Frontend Lead & UI/UX Specialist
- **Customer Self-Service Portal**: Build dedicated customer pages where clients view active subscriptions, request seat adjustments, or trigger early renewals.
- **Revenue Analytics & Charts**: Upgrade Dashboard with Monthly Recurring Revenue (MRR), Annual Recurring Revenue (ARR), and Churn Rate visualizations.
- **Responsive Navigation**: Implement a mobile navigation drawer and responsive tablet layouts.
- **User Experience Polish**: Add toast notifications, keyboard shortcuts, and smooth loading states.

### 🔹 Member 3: Integrations & Payments Engineer
- **PDF Invoice Generation**: Add one-click PDF invoice download with company logo, GSTIN, and tax breakdown.
- **Dynamic UPI QR Code**: Display a scannable UPI QR code on invoice payment modals (`upi://pay?pa=...&am=...`) for instant settlement.
- **Notification Engine**: Add transactional alerts (new invoice issued, receipt confirmation, upcoming renewal reminder).
- **Payment Reconciliation**: Implement a mock webhook endpoint to simulate automated bank payment confirmation.

### 🔹 Member 4: Security, QA & DevOps Engineer
- **Input Validation & Sanitization**: Implement Zod/Joi schema validation across all API routes to reject malformed data.
- **Security Hardening**: Add `express-rate-limit` to prevent brute-force attacks on `/api/auth/login` and `/api/auth/register`.
- **Automated Testing Suite**: Create unit and integration tests using Supertest for all 9 modules (target >80% coverage).
- **GitHub Actions CI/CD**: Configure `.github/workflows/ci.yml` to automatically run tests and frontend build checks on every pull request.

---

## 🔀 Git Branching & Collaboration Workflow

*Rule: "One member managing the repo is not enough."* Every member participates in code reviews and branching:

```
main (protected)
  ▲
  │ (Pull Request + 1 Approval required)
  ├── feat/billing-cron-scheduler    (Member 1)
  ├── feat/customer-portal           (Member 2)
  ├── feat/pdf-and-upi-qr            (Member 3)
  └── feat/zod-validation-and-ci     (Member 4)
```

1. **Create Branch**: `git checkout -b feat/<feature-name>`
2. **Work & Commit**: `git commit -m "feat: description of work"`
3. **Push to Remote**: `git push -u origin feat/<feature-name>`
4. **Open Pull Request (PR)**: Create PR on GitHub targeted at `main`.
5. **Code Review**: Assign at least one peer member to review and approve.
6. **Merge**: Merge into `main` after checks pass.

---

## 📅 Sprint Schedule

| Sprint | Goal | Key Deliverables |
|---|---|---|
| **Sprint 1 (Week 1–2)** | Automation & Portal | Billing Cron, Customer Portal UI, PDF Generator, Zod Validations |
| **Sprint 2 (Week 3–4)** | Payments & Testing | Prorated seat calculations, ARR/MRR charts, UPI QR codes, Supertest suite |
| **Sprint 3 (Week 5–6)** | Integration & CI/CD | DB optimization, Theme toggle, Notification triggers, GitHub Actions CI |
