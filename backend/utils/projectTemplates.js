/**
 * Default task / milestone templates by event type.
 * offset = days relative to event start (negative = before event).
 */
const COMMON = {
  milestones: [
    { title: 'Client advance received', type: 'Payment', offset: -30 },
    { title: 'Concept & design approval', type: 'Client Approval', offset: -21 },
    { title: 'Venue confirmation', type: 'Venue Confirmation', offset: -20 },
    { title: 'Vendor POs issued', type: 'Vendor Delivery', offset: -14 },
    { title: 'Final run-of-show approved', type: 'Client Approval', offset: -3 },
    { title: 'Event day', type: 'Internal', offset: 0 },
    { title: 'Final invoice & collection', type: 'Payment', offset: 15 },
  ],
  tasks: [
    { title: 'Kick-off meeting with client', dept: 'CS', offset: -30, priority: 'High' },
    { title: 'Prepare detailed event brief', dept: 'CS', offset: -28 },
    { title: 'Concept & theme development', dept: 'CRE', offset: -25 },
    { title: 'Design key visuals & branding collaterals', dept: 'CRE', offset: -18 },
    { title: 'Venue recce & floor plan', dept: 'OPS', offset: -20 },
    { title: 'Vendor quotations & comparison', dept: 'OPS', offset: -18 },
    { title: 'Production schedule', dept: 'OPS', offset: -12 },
    { title: 'Logistics, manpower & transport plan', dept: 'OPS', offset: -7 },
    { title: 'Run-of-show / agenda', dept: 'CS', offset: -5 },
    { title: 'Technical rehearsal', dept: 'OPS', offset: -1, priority: 'High' },
    { title: 'Event execution', dept: 'OPS', offset: 0, priority: 'Urgent' },
    { title: 'Post-event report & feedback', dept: 'CS', offset: 3 },
    { title: 'Vendor bill reconciliation', dept: 'FIN', offset: 10 },
  ],
};

const EXTRA = {
  Conference: [
    { title: 'Speaker coordination & presentations', dept: 'CS', offset: -14 },
    { title: 'Delegate registration setup', dept: 'OPS', offset: -15 },
  ],
  MICE: [
    { title: 'Flight & hotel blocking', dept: 'OPS', offset: -40, priority: 'High' },
    { title: 'Visa / travel documentation', dept: 'OPS', offset: -30 },
    { title: 'Itinerary finalisation', dept: 'CS', offset: -20 },
  ],
  'Product Launch': [
    { title: 'Launch AV content & reveal mechanism', dept: 'CRE', offset: -15 },
    { title: 'Media / PR coordination', dept: 'CS', offset: -10 },
  ],
  'Gala Event': [
    { title: 'Artist confirmation', dept: 'CS', offset: -25, priority: 'High' },
    { title: 'F&B menu tasting', dept: 'OPS', offset: -10 },
  ],
  'Annual Day': [
    { title: 'Employee performances & rehearsals', dept: 'CS', offset: -10 },
    { title: 'Awards & trophies', dept: 'OPS', offset: -12 },
  ],
  'Brand Activation': [
    { title: 'Permissions & permits', dept: 'OPS', offset: -15, priority: 'High' },
    { title: 'Promoter hiring & training', dept: 'OPS', offset: -7 },
  ],
  'Employee Engagement': [{ title: 'Activity design & materials', dept: 'CRE', offset: -12 }],
};

function templateFor(eventTypeName) {
  return {
    milestones: COMMON.milestones,
    tasks: [...COMMON.tasks, ...(EXTRA[eventTypeName] || [])],
  };
}

module.exports = { templateFor, TEMPLATE_NAMES: ['Default', ...Object.keys(EXTRA)] };
