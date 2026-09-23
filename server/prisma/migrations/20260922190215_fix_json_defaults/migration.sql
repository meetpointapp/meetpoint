-- SQLite'ta Prisma'nın ürettiği `DEFAULT []` JSON olarak yorumlanmıyor; eski satırları onar.
UPDATE "Profile" SET "interests" = '[]' WHERE "interests" IS NULL OR "interests" = '' OR json_valid("interests") = 0;
UPDATE "Profile" SET "prompts" = '[]' WHERE "prompts" IS NULL OR "prompts" = '' OR json_valid("prompts") = 0;
