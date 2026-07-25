-- CreateTable
CREATE TABLE "AdminSession" (
    "id" TEXT NOT NULL,
    "admin_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminSession_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "StudentAccessSession" 
  ADD COLUMN "token_hash" TEXT NOT NULL,
  ADD COLUMN "ip_address" TEXT,
  ADD COLUMN "user_agent" TEXT,
  ADD COLUMN "revoked_at" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "AdminSession_token_hash_key" ON "AdminSession"("token_hash");

-- CreateIndex
CREATE INDEX "AdminSession_token_hash_idx" ON "AdminSession"("token_hash");

-- CreateIndex
CREATE INDEX "AdminSession_admin_id_idx" ON "AdminSession"("admin_id");

-- CreateIndex
CREATE UNIQUE INDEX "StudentAccessSession_token_hash_key" ON "StudentAccessSession"("token_hash");

-- CreateIndex
CREATE INDEX "StudentAccessSession_token_hash_idx" ON "StudentAccessSession"("token_hash");

-- CreateIndex
CREATE INDEX "StudentAccessSession_student_id_idx" ON "StudentAccessSession"("student_id");

-- AddForeignKey
ALTER TABLE "AdminSession" ADD CONSTRAINT "AdminSession_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "AdminUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
