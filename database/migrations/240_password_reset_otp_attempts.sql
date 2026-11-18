-- Add persistent attempt tracking for password-reset OTP verification.
-- Additive only: existing reset-link rows remain valid and default to zero attempts.
ALTER TABLE password_reset_tokens
  ADD COLUMN attempts INT NOT NULL DEFAULT 0 AFTER used_at;
