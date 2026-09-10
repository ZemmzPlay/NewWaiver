-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- CreateEnum
CREATE TYPE "relation_type" AS ENUM ('mother', 'father', 'guardian', 'other');

-- CreateEnum
CREATE TYPE "supervision_mode" AS ENUM ('accompanied', 'drop_off');

-- CreateEnum
CREATE TYPE "reg_status" AS ENUM ('active', 'void');

-- CreateEnum
CREATE TYPE "session_status" AS ENUM ('active', 'warned', 'expired', 'overdue', 'checked_out', 'cancelled');

-- CreateEnum
CREATE TYPE "notif_type" AS ENUM ('registration', 'expiry_warning', 'pickup_request', 'login_code');

-- CreateEnum
CREATE TYPE "notif_channel" AS ENUM ('email', 'whatsapp');

-- CreateEnum
CREATE TYPE "notif_status" AS ENUM ('scheduled', 'claimed', 'sent', 'delivered', 'failed', 'cancelled');

-- CreateEnum
CREATE TYPE "staff_role" AS ENUM ('staffer', 'pickup', 'supervisor', 'admin');

-- CreateEnum
CREATE TYPE "verify_method" AS ENUM ('code', 'qr', 'name_match', 'supervisor_override');

-- CreateEnum
CREATE TYPE "email_status" AS ENUM ('unknown', 'delivered', 'bounced', 'complained');

-- CreateEnum
CREATE TYPE "pickup_method" AS ENUM ('call', 'whatsapp');

-- CreateEnum
CREATE TYPE "pickup_outcome" AS ENUM ('answered', 'no_answer', 'on_the_way');

-- CreateEnum
CREATE TYPE "print_status" AS ENUM ('queued', 'printed', 'failed');

-- CreateTable
CREATE TABLE "events" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "venue" TEXT NOT NULL,
    "starts_at" TIMESTAMPTZ NOT NULL,
    "ends_at" TIMESTAMPTZ NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Dubai',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "zones" (
    "id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "name_ar" TEXT,
    "supervision_mode" "supervision_mode" NOT NULL,
    "capacity" INTEGER,
    "min_age" INTEGER,
    "max_age" INTEGER,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "zones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "packages" (
    "id" UUID NOT NULL,
    "zone_id" UUID NOT NULL,
    "label" TEXT NOT NULL,
    "minutes" INTEGER NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "packages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "waiver_versions" (
    "id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'en',
    "version" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "body_md" TEXT NOT NULL,
    "published_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "waiver_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guardians" (
    "id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "full_name" TEXT NOT NULL,
    "relation" "relation_type" NOT NULL,
    "relation_other" TEXT,
    "phone_e164" TEXT NOT NULL,
    "phone_tail" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "email_status" "email_status" NOT NULL DEFAULT 'unknown',
    "locale" TEXT NOT NULL DEFAULT 'en',
    "marketing_consent" BOOLEAN NOT NULL DEFAULT false,
    "marketing_consent_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "guardians_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "registrations" (
    "id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "guardian_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "status" "reg_status" NOT NULL DEFAULT 'active',
    "source" TEXT NOT NULL DEFAULT 'web',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "registrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "children" (
    "id" UUID NOT NULL,
    "registration_id" UUID NOT NULL,
    "full_name" TEXT NOT NULL,
    "age_years" INTEGER NOT NULL,
    "medical_notes" TEXT,
    "photo_consent" BOOLEAN NOT NULL DEFAULT false,
    "child_code" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "requested_package_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "children_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consents" (
    "id" UUID NOT NULL,
    "registration_id" UUID NOT NULL,
    "waiver_version_id" UUID NOT NULL,
    "accepted_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "typed_name" TEXT NOT NULL,
    "ip" TEXT,
    "user_agent" TEXT,

    CONSTRAINT "consents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff" (
    "id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "full_name" TEXT NOT NULL,
    "role" "staff_role" NOT NULL DEFAULT 'staffer',
    "pin_hash" TEXT NOT NULL,
    "default_zone_id" UUID,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "staff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "devices" (
    "id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "label" TEXT NOT NULL,
    "zone_id" UUID,
    "print_agent_url" TEXT,
    "printer_ip" TEXT,
    "last_seen_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL,
    "child_id" UUID NOT NULL,
    "zone_id" UUID NOT NULL,
    "package_id" UUID NOT NULL,
    "minutes" INTEGER NOT NULL,
    "started_by_staff_id" UUID,
    "started_at" TIMESTAMPTZ NOT NULL,
    "ends_at" TIMESTAMPTZ NOT NULL,
    "warn_at" TIMESTAMPTZ NOT NULL,
    "status" "session_status" NOT NULL DEFAULT 'active',
    "stub_ref" TEXT,
    "checked_out_at" TIMESTAMPTZ,
    "checked_out_by_staff_id" UUID,
    "released_to" TEXT,
    "verify_method" "verify_method",
    "extends_session_id" UUID,
    "client_uuid" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "session_id" UUID,
    "registration_id" UUID NOT NULL,
    "type" "notif_type" NOT NULL,
    "channel" "notif_channel" NOT NULL DEFAULT 'email',
    "to_address" TEXT NOT NULL,
    "scheduled_for" TIMESTAMPTZ NOT NULL,
    "claimed_at" TIMESTAMPTZ,
    "sent_at" TIMESTAMPTZ,
    "provider_message_id" TEXT,
    "status" "notif_status" NOT NULL DEFAULT 'scheduled',
    "error" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pickup_attempts" (
    "id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "staff_id" UUID,
    "attempted_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "method" "pickup_method" NOT NULL,
    "outcome" "pickup_outcome" NOT NULL,
    "note" TEXT,

    CONSTRAINT "pickup_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prints" (
    "id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "staff_id" UUID,
    "device_id" UUID,
    "copy_no" INTEGER NOT NULL DEFAULT 1,
    "payload_hash" TEXT NOT NULL,
    "printed_at" TIMESTAMPTZ,
    "status" "print_status" NOT NULL DEFAULT 'queued',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "prints_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "login_challenges" (
    "id" UUID NOT NULL,
    "guardian_id" UUID NOT NULL,
    "code_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "consumed_at" TIMESTAMPTZ,
    "requested_ip" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "login_challenges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" UUID NOT NULL,
    "event_id" UUID,
    "actor_type" TEXT NOT NULL,
    "actor_id" UUID,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entity_id" UUID,
    "meta" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "packages_zone_idx" ON "packages"("zone_id", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "waiver_versions_event_locale_version_key" ON "waiver_versions"("event_id", "locale", "version");

-- CreateIndex
CREATE INDEX "guardians_event_tail_idx" ON "guardians"("event_id", "phone_tail");

-- CreateIndex
CREATE UNIQUE INDEX "guardians_event_phone_key" ON "guardians"("event_id", "phone_e164");

-- CreateIndex
CREATE INDEX "registrations_guardian_idx" ON "registrations"("guardian_id");

-- CreateIndex
CREATE UNIQUE INDEX "registrations_code_key" ON "registrations"("code");

-- CreateIndex
CREATE INDEX "children_registration_idx" ON "children"("registration_id", "seq");

-- CreateIndex
CREATE UNIQUE INDEX "children_child_code_key" ON "children"("child_code");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_client_uuid_key" ON "sessions"("client_uuid");

-- CreateIndex
CREATE INDEX "sessions_zone_status_ends_idx" ON "sessions"("zone_id", "status", "ends_at");

-- CreateIndex
CREATE INDEX "sessions_child_idx" ON "sessions"("child_id");

-- CreateIndex
CREATE INDEX "notifications_session_idx" ON "notifications"("session_id", "type");

-- CreateIndex
CREATE INDEX "pickup_attempts_session_idx" ON "pickup_attempts"("session_id", "attempted_at");

-- CreateIndex
CREATE INDEX "login_challenges_guardian_idx" ON "login_challenges"("guardian_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_log_entity_idx" ON "audit_log"("entity", "entity_id");

-- AddForeignKey
ALTER TABLE "zones" ADD CONSTRAINT "zones_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "packages" ADD CONSTRAINT "packages_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "zones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "waiver_versions" ADD CONSTRAINT "waiver_versions_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guardians" ADD CONSTRAINT "guardians_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registrations" ADD CONSTRAINT "registrations_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registrations" ADD CONSTRAINT "registrations_guardian_id_fkey" FOREIGN KEY ("guardian_id") REFERENCES "guardians"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "children" ADD CONSTRAINT "children_registration_id_fkey" FOREIGN KEY ("registration_id") REFERENCES "registrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "children" ADD CONSTRAINT "children_requested_package_id_fkey" FOREIGN KEY ("requested_package_id") REFERENCES "packages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consents" ADD CONSTRAINT "consents_registration_id_fkey" FOREIGN KEY ("registration_id") REFERENCES "registrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consents" ADD CONSTRAINT "consents_waiver_version_id_fkey" FOREIGN KEY ("waiver_version_id") REFERENCES "waiver_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff" ADD CONSTRAINT "staff_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff" ADD CONSTRAINT "staff_default_zone_id_fkey" FOREIGN KEY ("default_zone_id") REFERENCES "zones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devices" ADD CONSTRAINT "devices_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devices" ADD CONSTRAINT "devices_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "zones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_child_id_fkey" FOREIGN KEY ("child_id") REFERENCES "children"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "zones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "packages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_started_by_staff_id_fkey" FOREIGN KEY ("started_by_staff_id") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_checked_out_by_staff_id_fkey" FOREIGN KEY ("checked_out_by_staff_id") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_registration_id_fkey" FOREIGN KEY ("registration_id") REFERENCES "registrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pickup_attempts" ADD CONSTRAINT "pickup_attempts_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pickup_attempts" ADD CONSTRAINT "pickup_attempts_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prints" ADD CONSTRAINT "prints_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prints" ADD CONSTRAINT "prints_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prints" ADD CONSTRAINT "prints_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "login_challenges" ADD CONSTRAINT "login_challenges_guardian_id_fkey" FOREIGN KEY ("guardian_id") REFERENCES "guardians"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Hand-added: Postgres features Prisma's schema DSL cannot express directly.
-- These mirror the previous Drizzle migrations 0000/0001 exactly.

-- One live session per child, across both zones. The partial index is the
-- rule — enforced here rather than in application code.
CREATE UNIQUE INDEX "sessions_one_live_per_child" ON "sessions"("child_id")
  WHERE status IN ('active', 'warned', 'expired', 'overdue');

-- Hard rule 4: the worker claims off this index, so it has to be cheap.
CREATE INDEX "notifications_due_idx" ON "notifications"("status", "scheduled_for")
  WHERE status = 'scheduled';

-- Backs the fuzzy name search at the counter (word_similarity / LIKE), see
-- apps/web/src/server/search.ts.
CREATE INDEX "guardians_full_name_trgm_idx" ON "guardians" USING GIN ("full_name" gin_trgm_ops);
CREATE INDEX "children_full_name_trgm_idx" ON "children" USING GIN ("full_name" gin_trgm_ops);
