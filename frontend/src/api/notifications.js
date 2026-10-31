import api from './axios'

// Email Notifications (Member 3 – Integrations)
export const sendRenewalReminders = (daysBefore = 7) =>
  api.post('/notifications/renewal-reminder', { days_before: daysBefore })

export const sendInvoiceNotification = (invoiceId) =>
  api.post(`/notifications/send-invoice/${invoiceId}`)
