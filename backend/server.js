require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const initDatabase = require('./database/init');
const { authenticate } = require('./middleware/auth');
const { notFound, errorHandler } = require('./middleware/error');
const { UPLOAD_ROOT } = require('./middleware/upload');
const { startAutomation } = require('./utils/automation');

const app = express();

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(
  cors({
    origin: (process.env.CLIENT_URL || 'http://localhost:5174').split(',').map((s) => s.trim()),
    credentials: true,
  })
);
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// Uploaded images / PDFs
app.use('/uploads', express.static(UPLOAD_ROOT));

app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

// Public
app.use('/api/auth', require('./routes/auth.routes'));

// Everything below requires login
app.use('/api', authenticate);

app.use('/api/dashboard', require('./routes/dashboard.routes'));
app.use('/api/search', require('./routes/search.routes'));
app.use('/api/notifications', require('./routes/notifications.routes'));
app.use('/api/attachments', require('./routes/attachments.routes'));

// Masters & access
app.use('/api/masters', require('./routes/masters.routes'));
app.use('/api/departments', require('./routes/departments.routes'));
app.use('/api/roles', require('./routes/roles.routes'));
app.use('/api/permissions', require('./routes/permissions.routes'));
app.use('/api/employees', require('./routes/employees.routes'));

// CRM
app.use('/api/companies', require('./routes/companies.routes'));
app.use('/api/contacts', require('./routes/contacts.routes'));
app.use('/api/leads', require('./routes/leads.routes'));
app.use('/api/opportunities', require('./routes/opportunities.routes'));
app.use('/api/activities', require('./routes/activities.routes'));
app.use('/api/targets', require('./routes/targets.routes'));
app.use('/api/proposals', require('./routes/proposals.routes'));

// Projects & delivery
app.use('/api/projects', require('./routes/projects.routes'));
app.use('/api/tasks', require('./routes/tasks.routes'));
app.use('/api/milestones', require('./routes/milestones.routes'));
app.use('/api/communication-logs', require('./routes/communicationLogs.routes'));
app.use('/api/change-requests', require('./routes/changeRequests.routes'));
app.use('/api/escalations', require('./routes/escalations.routes'));
app.use('/api/execution-items', require('./routes/executionItems.routes'));
app.use('/api/incidents', require('./routes/incidents.routes'));
app.use('/api/feedback', require('./routes/feedback.routes'));

// Procurement
app.use('/api/vendors', require('./routes/vendors.routes'));
app.use('/api/quotations', require('./routes/quotations.routes'));
app.use('/api/purchase-orders', require('./routes/purchaseOrders.routes'));
app.use('/api/vendor-bills', require('./routes/vendorBills.routes'));

// Finance
app.use('/api/invoices', require('./routes/invoices.routes'));
app.use('/api/expenses', require('./routes/expenses.routes'));
app.use('/api/finance', require('./routes/finance.routes'));

// Marketing, reports, admin
app.use('/api/campaigns', require('./routes/campaigns.routes'));
app.use('/api/reports', require('./routes/reports.routes'));
app.use('/api/approvals', require('./routes/approvals.routes'));
app.use('/api/audit-logs', require('./routes/audit.routes'));
app.use('/api/settings', require('./routes/settings.routes'));
app.use('/api/import', require('./routes/import.routes'));

app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

initDatabase()
  .then(() => {
    console.log('✔ Database ready');
    app.listen(PORT, () => console.log(`✔ Bigbee CRM API running on http://localhost:${PORT}`));
    startAutomation();
  })
  .catch((err) => {
    console.error('✖ Could not connect / initialise database:', err.message);
    process.exit(1);
  });

module.exports = app;
