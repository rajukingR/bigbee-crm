/**
 * Simple dropdown masters. Each one is its own table with
 * id, name, description, sort_order, status plus optional extra columns.
 * The URL key (e.g. /api/masters/lead-sources) maps to the table here.
 */
const MASTERS = {
  'lead-types': {
    table: 'lead_types',
    label: 'Lead Type',
    seed: ['Outbound', 'Inbound', 'Marketing', 'Existing Client', 'Tender', 'Referral'],
  },
  'lead-sources': {
    table: 'lead_sources',
    label: 'Lead Source',
    seed: ['Outbound Call', 'Referral', 'Website', 'Email', 'Campaign', 'LinkedIn', 'SEO', 'Meta', 'Tender', 'Existing Client'],
  },
  'sub-sources': {
    table: 'sub_sources',
    label: 'Sub Source',
    extra: { source_id: 'INT NULL' },
    join: { table: 'lead_sources', on: 'source_id', as: 'source_name' },
    seed: [],
  },
  'lead-event-types': {
    table: 'lead_event_types',
    label: 'Lead Event Type',
    seed: ['Annual Day', 'Conference', 'MICE', 'Product Launch', 'Brand Activation', 'Gala Event', 'Employee Engagement', 'Dealer Meet', 'Exhibition'],
  },
  'lead-statuses': {
    table: 'lead_statuses',
    label: 'Lead Status',
    extra: { color: "VARCHAR(20) DEFAULT '#64748b'" },
    seed: [
      { name: 'New', color: '#3b82f6' },
      { name: 'Contacted', color: '#8b5cf6' },
      { name: 'In Progress', color: '#f97316' },
      { name: 'Qualified', color: '#22c55e' },
      { name: 'Disqualified', color: '#ef4444' },
      { name: 'Converted', color: '#0ea5e9' },
      { name: 'Inactive', color: '#94a3b8' },
    ],
  },
  'funnel-statuses': {
    table: 'funnel_statuses',
    label: 'Funnel Status',
    extra: {
      probability: 'DECIMAL(5,2) DEFAULT 0',
      stage_type: "ENUM('open','won','lost','hold') DEFAULT 'open'",
      color: "VARCHAR(20) DEFAULT '#64748b'",
    },
    seed: [
      { name: 'New Lead', probability: 5, stage_type: 'open', color: '#94a3b8' },
      { name: 'Contacted', probability: 10, stage_type: 'open', color: '#3b82f6' },
      { name: 'Qualified', probability: 20, stage_type: 'open', color: '#6366f1' },
      { name: 'Meeting / Brief', probability: 30, stage_type: 'open', color: '#8b5cf6' },
      { name: 'Proposal / Costing', probability: 50, stage_type: 'open', color: '#f97316' },
      { name: 'Negotiation', probability: 70, stage_type: 'open', color: '#eab308' },
      { name: 'Verbal Confirmation', probability: 90, stage_type: 'open', color: '#14b8a6' },
      { name: 'Won', probability: 100, stage_type: 'won', color: '#22c55e' },
      { name: 'Lost', probability: 0, stage_type: 'lost', color: '#ef4444' },
      { name: 'On Hold', probability: 0, stage_type: 'hold', color: '#64748b' },
    ],
  },
  categories: {
    table: 'categories',
    label: 'Category',
    seed: ['Venue', 'AV & Lighting', 'Fabrication', 'Printing', 'Artist & Talent', 'Catering', 'Transport', 'Hospitality', 'Decor', 'Manpower', 'Photography & Video'],
  },
  'follow-up-modes': {
    table: 'follow_up_modes',
    label: 'Follow Up Mode',
    seed: ['Call', 'Email', 'Meeting', 'WhatsApp', 'Video Call', 'Site Visit'],
  },
  services: {
    table: 'services',
    label: 'Service',
    seed: ['Corporate Events', 'MICE', 'Conferences', 'Product Launch', 'Employee Engagement', 'Brand Activation', 'Gala Events', 'Exhibitions', 'Virtual / Hybrid Events'],
  },
  'campaign-types': {
    table: 'campaign_types',
    label: 'Campaign Type',
    seed: ['Lead Generation', 'Brand Awareness', 'Event Promotion', 'Retargeting'],
  },
  'advertising-types': {
    table: 'advertising_types',
    label: 'Type of Advertising',
    seed: ['Search Ads', 'Display Ads', 'Social Media Ads', 'Email Marketing', 'Print', 'Outdoor', 'Event Sponsorship'],
  },
  'marketing-channels': {
    table: 'marketing_channels',
    label: 'Marketing Channel',
    seed: ['Google Ads', 'Meta', 'LinkedIn', 'Email', 'Events', 'Referrals', 'Organic / SEO', 'Offline'],
  },
  industries: {
    table: 'industries',
    label: 'Industry',
    seed: ['FMCG', 'Retail', 'Automotive', 'Consumer Durables', 'Construction Materials', 'Fertilizers', 'Paints', 'Electronics', 'Electrical', 'BFSI', 'IT', 'Pharma', 'Other'],
  },
  'loss-reasons': {
    table: 'loss_reasons',
    label: 'Loss Reason',
    seed: ['Price', 'Lost to Competitor', 'Budget Cut', 'Timeline Mismatch', 'Event Cancelled', 'No Response', 'Scope Mismatch'],
  },
};

module.exports = MASTERS;
