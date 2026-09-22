INSERT INTO "Setting" ("key", "value", "updatedAt")
VALUES ('mp_max_installments', '12', CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO UPDATE
SET
  "value" = EXCLUDED."value",
  "updatedAt" = CURRENT_TIMESTAMP;
