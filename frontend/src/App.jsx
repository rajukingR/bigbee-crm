import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import MainLayout from './components/layout/MainLayout';
import ProtectedRoute from './components/layout/ProtectedRoute';
import Loader from './components/common/Loader';
import { useAuth } from './context/AuthContext';

const Login = lazy(() => import('./pages/auth/Login'));
const Dashboard = lazy(() => import('./pages/dashboard/Dashboard'));
const ManagerDashboard = lazy(() => import('./pages/dashboard/ManagerDashboard'));
// CRM
const Companies = lazy(() => import('./pages/crm/Companies'));
const CompanyDetail = lazy(() => import('./pages/crm/CompanyDetail'));
const Contacts = lazy(() => import('./pages/crm/Contacts'));
const Leads = lazy(() => import('./pages/crm/Leads'));
const LeadDetail = lazy(() => import('./pages/crm/LeadDetail'));
const Opportunities = lazy(() => import('./pages/crm/Opportunities'));
const OpportunityDetail = lazy(() => import('./pages/crm/OpportunityDetail'));
const FollowUps = lazy(() => import('./pages/crm/FollowUps'));
const Targets = lazy(() => import('./pages/crm/Targets'));
// Proposals
const Proposals = lazy(() => import('./pages/proposals/Proposals'));
const ProposalForm = lazy(() => import('./pages/proposals/ProposalForm'));
const ProposalDetail = lazy(() => import('./pages/proposals/ProposalDetail'));
// Projects
const Projects = lazy(() => import('./pages/projects/Projects'));
const ProjectDetail = lazy(() => import('./pages/projects/ProjectDetail'));
const Tasks = lazy(() => import('./pages/projects/Tasks'));
// Vendors
const Vendors = lazy(() => import('./pages/vendors/Vendors'));
const Quotations = lazy(() => import('./pages/vendors/Quotations'));
const PurchaseOrders = lazy(() => import('./pages/vendors/PurchaseOrders'));
const VendorBills = lazy(() => import('./pages/vendors/VendorBills'));
// Finance
const Invoices = lazy(() => import('./pages/finance/Invoices'));
const Expenses = lazy(() => import('./pages/finance/Expenses'));
const Profitability = lazy(() => import('./pages/finance/Profitability'));
const Receivables = lazy(() => import('./pages/finance/Receivables'));
// Execution & feedback
const ExecutionTracker = lazy(() => import('./pages/execution/ExecutionTracker'));
const ExecutionDetail = lazy(() => import('./pages/execution/ExecutionDetail'));
const Feedback = lazy(() => import('./pages/feedback/Feedback'));
const Escalations = lazy(() => import('./pages/feedback/Escalations'));
const ChangeRequests = lazy(() => import('./pages/feedback/ChangeRequests'));
// Marketing & reports
const Campaigns = lazy(() => import('./pages/marketing/Campaigns'));
const MarketingROI = lazy(() => import('./pages/marketing/MarketingROI'));
const Reports = lazy(() => import('./pages/reports/Reports'));
// Admin
const Approvals = lazy(() => import('./pages/admin/Approvals'));
const AuditLogs = lazy(() => import('./pages/admin/AuditLogs'));
const Settings = lazy(() => import('./pages/admin/Settings'));
const ImportData = lazy(() => import('./pages/admin/ImportData'));
const OrgChart = lazy(() => import('./pages/admin/OrgChart'));
// Masters
const MasterHome = lazy(() => import('./pages/masters/MasterHome'));
const EmployeeMaster = lazy(() => import('./pages/masters/EmployeeMaster'));
const Roles = lazy(() => import('./pages/masters/Roles'));
const Permissions = lazy(() => import('./pages/masters/Permissions'));
const Departments = lazy(() => import('./pages/masters/Departments'));
const LeadType = lazy(() => import('./pages/masters/LeadType'));
const LeadSource = lazy(() => import('./pages/masters/LeadSource'));
const SubSource = lazy(() => import('./pages/masters/SubSource'));
const LeadEventType = lazy(() => import('./pages/masters/LeadEventType'));
const LeadStatus = lazy(() => import('./pages/masters/LeadStatus'));
const FunnelStatus = lazy(() => import('./pages/masters/FunnelStatus'));
const Category = lazy(() => import('./pages/masters/Category'));
const FollowUpMode = lazy(() => import('./pages/masters/FollowUpMode'));
const Services = lazy(() => import('./pages/masters/Services'));
const CampaignType = lazy(() => import('./pages/masters/CampaignType'));
const AdvertisingType = lazy(() => import('./pages/masters/AdvertisingType'));
const MarketingChannel = lazy(() => import('./pages/masters/MarketingChannel'));
const Industry = lazy(() => import('./pages/masters/Industry'));
const LossReason = lazy(() => import('./pages/masters/LossReason'));
// Profile
const Profile = lazy(() => import('./pages/profile/Profile'));
const Notifications = lazy(() => import('./pages/profile/Notifications'));

const P = (module, el) => <ProtectedRoute module={module}>{el}</ProtectedRoute>;

export default function App() {
  const { user, loading } = useAuth();
  if (loading) return <Loader full />;

  return (
    <Suspense fallback={<Loader full />}>
      <Routes>
        <Route path="/login" element={user ? <Navigate to="/dashboard" replace /> : <Login />} />
        <Route
          element={
            <ProtectedRoute>
              <MainLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={P('dashboard', <Dashboard />)} />
          <Route path="/manager-dashboard" element={P('manager_dashboard', <ManagerDashboard />)} />

          <Route path="/companies" element={P('companies', <Companies />)} />
          <Route path="/companies/:id" element={P('companies', <CompanyDetail />)} />
          <Route path="/contacts" element={P('contacts', <Contacts />)} />
          <Route path="/leads" element={P('leads', <Leads />)} />
          <Route path="/leads/:id" element={P('leads', <LeadDetail />)} />
          <Route path="/opportunities" element={P('opportunities', <Opportunities />)} />
          <Route path="/opportunities/:id" element={P('opportunities', <OpportunityDetail />)} />
          <Route path="/follow-ups" element={P(['activities', 'leads', 'tasks'], <FollowUps />)} />
          <Route path="/targets" element={P('targets', <Targets />)} />

          <Route path="/proposals" element={P('proposals', <Proposals />)} />
          <Route path="/proposals/new" element={<ProtectedRoute module="proposals" action="create"><ProposalForm /></ProtectedRoute>} />
          <Route path="/proposals/:id/edit" element={<ProtectedRoute module="proposals" action="edit"><ProposalForm /></ProtectedRoute>} />
          <Route path="/proposals/:id" element={P('proposals', <ProposalDetail />)} />

          <Route path="/projects" element={P('projects', <Projects />)} />
          <Route path="/projects/:id" element={P('projects', <ProjectDetail />)} />
          <Route path="/tasks" element={P('tasks', <Tasks />)} />

          <Route path="/vendors" element={P('vendors', <Vendors />)} />
          <Route path="/vendors/quotations" element={P('quotations', <Quotations />)} />
          <Route path="/vendors/purchase-orders" element={P('purchase_orders', <PurchaseOrders />)} />
          <Route path="/vendors/bills" element={P('vendor_bills', <VendorBills />)} />

          <Route path="/finance/invoices" element={P('invoices', <Invoices />)} />
          <Route path="/finance/expenses" element={P('expenses', <Expenses />)} />
          <Route path="/finance/profitability" element={P('profitability', <Profitability />)} />
          <Route path="/finance/receivables" element={P(['profitability', 'invoices'], <Receivables />)} />

          <Route path="/execution" element={P('execution', <ExecutionTracker />)} />
          <Route path="/execution/:id" element={P('execution', <ExecutionDetail />)} />
          <Route path="/feedback" element={P('feedback', <Feedback />)} />
          <Route path="/feedback/escalations" element={P('escalations', <Escalations />)} />
          <Route path="/feedback/change-requests" element={P('escalations', <ChangeRequests />)} />

          <Route path="/marketing/campaigns" element={P('campaigns', <Campaigns />)} />
          <Route path="/marketing/roi" element={P('campaigns', <MarketingROI />)} />
          <Route path="/reports" element={P('reports', <Reports />)} />

          <Route path="/admin/approvals" element={<ProtectedRoute><Approvals /></ProtectedRoute>} />
          <Route path="/admin/audit-logs" element={P('audit_logs', <AuditLogs />)} />
          <Route path="/admin/settings" element={P('settings', <Settings />)} />
          <Route path="/admin/import" element={P('import', <ImportData />)} />
          <Route path="/admin/org-chart" element={P('employees', <OrgChart />)} />

          <Route path="/masters" element={<MasterHome />} />
          <Route path="/masters/employees" element={P('employees', <EmployeeMaster />)} />
          <Route path="/masters/roles" element={P('roles', <Roles />)} />
          <Route path="/masters/permissions" element={P('permissions', <Permissions />)} />
          <Route path="/masters/departments" element={P('departments', <Departments />)} />
          <Route path="/masters/lead-type" element={P('masters', <LeadType />)} />
          <Route path="/masters/lead-source" element={P('masters', <LeadSource />)} />
          <Route path="/masters/sub-source" element={P('masters', <SubSource />)} />
          <Route path="/masters/lead-event-type" element={P('masters', <LeadEventType />)} />
          <Route path="/masters/lead-status" element={P('masters', <LeadStatus />)} />
          <Route path="/masters/funnel-status" element={P('masters', <FunnelStatus />)} />
          <Route path="/masters/category" element={P('masters', <Category />)} />
          <Route path="/masters/follow-up-mode" element={P('masters', <FollowUpMode />)} />
          <Route path="/masters/services" element={P('masters', <Services />)} />
          <Route path="/masters/campaign-type" element={P('masters', <CampaignType />)} />
          <Route path="/masters/advertising-type" element={P('masters', <AdvertisingType />)} />
          <Route path="/masters/marketing-channel" element={P('masters', <MarketingChannel />)} />
          <Route path="/masters/industry" element={P('masters', <Industry />)} />
          <Route path="/masters/loss-reason" element={P('masters', <LossReason />)} />

          <Route path="/profile" element={<Profile />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="*" element={<div className="card p-10 text-center text-slate-500">Page not found</div>} />
        </Route>
      </Routes>
    </Suspense>
  );
}
