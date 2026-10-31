CREATE INDEX IF NOT EXISTS idx_subs_start_expiry ON subscriptions(start_date, expiry_date);
CREATE INDEX IF NOT EXISTS idx_invoices_billing_period ON invoices(billing_period_start, billing_period_end);
CREATE INDEX IF NOT EXISTS idx_plans_auto_close ON plans(auto_close, end_date);
