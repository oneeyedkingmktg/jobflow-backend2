// ============================================================================
// STUB FILE - MailerLite replaced by backend API
// This file exists only to prevent import errors during migration
// ============================================================================

// Export empty functions so old imports don't break
export const getSubscribersByGroup = async () => {
  console.warn('getSubscribersByGroup: MailerLite deprecated, use backend API');
  return [];
};

export const syncLeadToMailerLite = async (lead) => {
  console.warn('syncLeadToMailerLite: MailerLite deprecated, use backend API');
  return { success: true };
};

export const deleteSubscriber = async (email) => {
  console.warn('deleteSubscriber: MailerLite deprecated, use backend API');
  return { success: true };
};

export const updateSubscriber = async (email, data) => {
  console.warn('updateSubscriber: MailerLite deprecated, use backend API');
  return { success: true };
};

// Add any other exports that might be imported elsewhere
export default {
  getSubscribersByGroup,
  syncLeadToMailerLite,
  deleteSubscriber,
  updateSubscriber,
};
