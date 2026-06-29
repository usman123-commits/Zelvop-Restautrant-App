// Legal status transitions as defined in state-machines.md
// Key = current status, Value = array of allowed next statuses

const TRANSITIONS = {
  pending_assignment: ['assigned', 'cancelled'],
  assigned: ['accepted', 'pending_assignment', 'cancelled'],
  accepted: ['picked_up', 'cancelled', 'assigned'],
  picked_up: ['delivered'],
  delivered: [],
  cancelled: [],
};

const ACCEPT_TIMEOUT_MS = 3 * 60 * 1000; // 3 minutes

const isValidTransition = (from, to) => {
  const allowed = TRANSITIONS[from];
  if (!allowed) return false;
  return allowed.includes(to);
};

const isTerminalState = (status) => {
  return status === 'delivered' || status === 'cancelled';
};

const canCancel = (status) => {
  return ['pending_assignment', 'assigned', 'accepted'].includes(status);
};

module.exports = {
  TRANSITIONS,
  ACCEPT_TIMEOUT_MS,
  isValidTransition,
  isTerminalState,
  canCancel,
};
