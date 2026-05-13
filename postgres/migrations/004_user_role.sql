-- Add user.role with allowed values admin/staff/customer.
-- Safe to run multiple times.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'customer';

ALTER TABLE users
  ADD CONSTRAINT IF NOT EXISTS users_role_check
  CHECK (role IN ('admin', 'staff', 'customer'));

