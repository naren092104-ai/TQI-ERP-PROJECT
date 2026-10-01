-- Archiving academic years has been removed from the product.
-- Restore legacy archived years as inactive drafts so they can be selected and managed again.
UPDATE academic_years
SET status = 'DRAFT', archived_at = NULL, is_active = 0
WHERE UPPER(status) = 'ARCHIVED' OR archived_at IS NOT NULL;
