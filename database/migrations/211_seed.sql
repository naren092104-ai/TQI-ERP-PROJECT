-- TQI-ERP v2: seed marker.
-- This file is intentionally a no-op. The Super Admin row is inserted by
-- backend/src/db/init.ts (initDatabaseSchema) AFTER the migration runner has
-- applied this file, using a random bcrypt-hashed password printed to the
-- console. No demo data, no alias row, no demo modules.
SELECT 1;
