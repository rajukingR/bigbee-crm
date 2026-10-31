# Bigbee CRM & ERP – Admin Platform

Admin dashboard for **Bigbee Experience Management Pvt. Ltd.** covering the full BRD scope:
lead → opportunity → proposal → project handover → delivery → procurement → finance → MIS.

| Layer    | Stack |
|----------|-------|
| Frontend | React 18 (JS/JSX only), Vite, Tailwind CSS 3, React Router 6, Recharts, react-icons |
| Backend  | Node.js, Express 4, MySQL (mysql2), JWT auth, Multer uploads (images + PDF) |

---

## 1. Run it

### Backend (port 5000)
```bash
cd backend
npm install
npm run dev        # or: npm start
```
On first start the server **creates all 53 tables and seeds** departments, roles (from the
organisation chart), default permissions, dropdown masters, settings and the super admin.
You can also run it on its own: `npm run db:init`.

`.env` is already filled with your values (DB `88.222.245.236`, port 5000, client `http://localhost:5174`).
> The MySQL server must allow remote connections from the machine running the backend
> (user `bigbeecrm` with `%` or your IP as host).

### Frontend (port 5174)
```bash
cd frontend
npm install
npm run dev
```
Open **http://localhost:5174** and sign in with
`admin@theregenerix.com` / `Admin@123` (from `ADMIN_EMAIL` / `ADMIN_PASSWORD`).

In development Vite proxies `/api` and `/uploads` to `http://localhost:5000`.
For a production build set `VITE_API_URL` in `frontend/.env` (e.g. `https://api.yourdomain.com`) and run `npm run build`.

---

## 2. Roles, permissions & data visibility

* **Roles** are seeded from the *Upward Reporting* org chart: MD, BD Head / BD Manager / BD Executive,
  Marketing Head / Digital & Offline Marketing Managers / Marketing Executive, CS Head / CS Manager / CS Executive,
  Production & Operations Head / Operations & Production Managers / Operations Executive / Procurement Manager,
  Creative Head / 3D Designer / Graphic Designer / Video Editor / Visualiser,
  HR & Finance Head / Accounts & Finance Manager / Accounts Executive / HR & Admin Manager / HR Executive, and Super Admin.
* **Permissions** (Masters → Permissions): per role × module × action
  (View, Create, Edit, Delete, Export, Approve). Every API route checks them.
  Sensitive areas are separate modules: *Vendor Bank Details* and *Project Financial Fields*.
* **Data visibility** per role: `own` (only my records), `team` (me + everyone reporting to me, any depth,
  from **Reports To** in Employee Master) or `all`.
* **Deactivating** an employee keeps their history; use the ⇄ action in Employee Master to reassign open
  leads, opportunities, tasks, companies and direct reports.

## 3. One login – a dashboard per role

Everyone signs in on the same login page. The backend picks the dashboard from the user's department / role,
the sidebar shows only the modules their role is allowed, and the bell + "My Notifications" panel show only their own messages.

| Role (department) | Dashboard shows |
|---|---|
| **Super Admin / MD (Management)** | Company overview (reference design) – revenue, vendor cost, margin, invoices paid, trend, BD target, snapshot, risks, top projects. **"View dashboard as"** switches to any role below with company-wide data. Admin can also see every user's notifications (`/api/notifications?all=1`). |
| BD Head / Manager / Executive | Won vs target, weighted pipeline, open leads, follow-ups due, BD target & coverage, pipeline by stage, deals closing this month, team leaderboard (managers) or own activity, recent leads |
| Marketing roles | Spend vs budget, leads generated & qualified, cost per lead, leads by source, campaign performance, latest enquiries and the BD owner they went to |
| CS Head / Manager / Executive | Active projects, handovers to accept, client approvals pending, escalations, upcoming events, proposals in progress, my tasks |
| Operations / Production | Next event countdown & readiness, readiness per project, overdue / issue checklist items, vendor deliveries, my tasks |
| Procurement Manager | Requirements awaiting vendor selection, POs pending approval / to issue, committed value, top vendor payables, recent quotations |
| Creative (3D, Graphic, Video, Visualiser) | Open briefs, due this week, overdue, delivered & on-time %, briefs with revision count, projects |
| Accounts & Finance / HR & Finance Head | Invoiced, collected, receivables (ageing), payables, collections due, approvals waiting for me, projects over budget / low margin |
| HR & Admin | Headcount by department, joiners, employees without a reporting manager, inactive users still owning open work |

Managers (`team` scope) see their own + team's numbers, executives (`own` scope) see their own.

**Notifications by role** (in addition to assignments and approvals): BD – overdue follow-ups, inactive leads;
Marketing – "your lead was won"; CS – handover submitted, client approval overdue, proposal follow-up due;
Operations – execution item overdue / issue; Finance – new confirmed project, collection due, expense / PO approvals;
Managers – escalations, overdue team items, new team member; everyone – task due today, new task / comment.

## 4. Modules (sidebar)

| Menu | What it does |
|------|--------------|
| Dashboard | Role-based – see section 3. |
| Manager Dashboard | Team scorecard (target, won, pipeline, activity, overdue), team funnel and follow-ups. |
| Lead & Enquiry Management | Companies (duplicate check, client type & A–D buckets, full account history), Contacts, Leads (auto-assignment to least-loaded BD, reassignment history with reason, qualify/disqualify, duplicate flag, convert), Sales Funnel (drag-and-drop Kanban + list, weighted pipeline, stage ageing, loss reasons), Follow-ups board, Targets (target vs achieved, gap, coverage vs 5× target, forecast, incentive). |
| Proposal & Estimation | Line-item costing, discount / agency fee / GST, live margin, approval rules (discount, margin, payment terms), versions & revisions, send / client response, attachments. |
| Project Management | Won → project without re-entry, BD→CS/Ops handover checklist with submit/accept/clarify, tasks (statuses from BRD, dependencies, comments, files, Gantt-style timeline, event-type templates), milestones, communication log, change requests (approval adds to project value/budget), escalations, financial P&L, documents, feedback & closure. |
| Vendor Management | Vendor master (restricted bank details, compliance docs), quotation comparison & selection, purchase/work orders with amount-based approval and budget check, vendor bills & payments. |
| Budget & Finance | Invoices & receipts, expenses (approval above limit), project profitability (estimated vs actual margin, budget variance, flags), receivables ageing buckets. |
| Execution Tracker | Readiness per live/upcoming project, execution checklist by category, incidents / last-minute changes, floor plans / riders / site photos, event-day status. |
| Feedback & Closure | Client feedback & ratings (repeat business creates a BD lead), escalations, change requests. |
| Marketing | Campaigns with CPL / CPA / ROAS / ROI (shown only when an attribution method is set) and Marketing ROI by channel & lead source. |
| Reports & Analytics | Sales funnel, target achievement, lead activity, project status, profitability, receivables, vendor commitments, marketing ROI, lost business, department scorecards (BD, CS, Ops, Creative, Finance, Marketing); daily/weekly/monthly/quarterly/yearly filters and Excel/CSV export. |
| Admin & Automation | Approval queue, read-only audit trail, settings & rules (thresholds, limits, ageing buckets), CSV import with error report, org chart. |
| Masters | Employee Master, Roles, Permissions, Departments, Lead Type, Lead Source, Sub Source, Lead Event Type, Lead Status, Funnel Status (probability per stage), Category, Follow Up Mode, Services, Campaign Type, Type of Advertising, Marketing Channel, Industry, Loss Reason. |

**Automation** (every 30 min): overdue follow-up alerts to owner + manager, inactive / no-next-action leads,
escalation of overdue high-priority tasks and high-value opportunities, collection reminders, daily client bucket refresh.
Notifications appear on the bell icon. Global search covers companies, contacts, lead IDs, opportunity IDs,
project codes, proposals, vendors and invoices. Every create / edit / delete / approve / reassign / export / login is audit-logged.

## 5. File uploads
Images (JPG, PNG, WEBP, GIF, SVG) and PDF, max 10 MB each, stored under `backend/uploads/YYYY-MM/`
and served at `/uploads/...`. Available on companies, leads, opportunities, proposals, projects, tasks,
vendors, purchase orders, vendor bills, invoices, expenses, campaigns and employee photos.

## 6. Project structure
```
backend/
  server.js                 Express app & route mounting
  config/db.js              MySQL pool
  database/schema.js        all CREATE TABLE statements
  database/seed.js          roles, permissions, masters, settings, admin
  middleware/               auth (JWT + permission), upload (multer), errors
  controllers/              one file per module
  routes/                   one file per module
  utils/                    crud factory, data scope, audit, approvals, finance & sales metrics, automation
frontend/src/
  pages/<module>/<Page>.jsx one file per page (masters, crm, proposals, projects, vendors, finance, …)
  components/layout         Sidebar, MasterSidebar, Header, MainLayout
  components/common         DataTable, CrudPage, Modal, forms, Attachments, StatCard, …
  context/                  Auth & lookup (dropdown) providers
  hooks/, utils/, config/menu.js
```
#   b i g b e e - c r m  
 