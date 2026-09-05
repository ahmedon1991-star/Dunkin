/**
 * apply-audit-tables.mjs
 * ─────────────────────────────────────────────────────────────────────
 * يُنشئ جداول الجرد التشغيلي مباشرةً في قاعدة البيانات بدون drizzle-kit push
 * شغّله بـ: node apply-audit-tables.mjs
 * ─────────────────────────────────────────────────────────────────────
 */

import { config } from "dotenv";
import postgres from "postgres";

config(); // تحميل .env

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("❌ DATABASE_URL غير موجود في ملف .env");
  process.exit(1);
}

const sql = postgres(DATABASE_URL, { prepare: false });

async function run() {
  console.log("🔄 جاري إنشاء جداول الجرد التشغيلي...\n");

  try {
    // 1. Enum: نوع الجرد
    await sql`
      DO $$ BEGIN
        CREATE TYPE audit_type AS ENUM ('weekly', 'monthly');
      EXCEPTION WHEN duplicate_object THEN
        RAISE NOTICE 'audit_type enum already exists, skipping.';
      END $$;
    `;
    console.log("  ✅ audit_type enum");

    // 2. Enum: حالة الجرد
    await sql`
      DO $$ BEGIN
        CREATE TYPE audit_status AS ENUM ('draft', 'completed');
      EXCEPTION WHEN duplicate_object THEN
        RAISE NOTICE 'audit_status enum already exists, skipping.';
      END $$;
    `;
    console.log("  ✅ audit_status enum");

    // 3. جدول رؤوس الجرد
    await sql`
      CREATE TABLE IF NOT EXISTS inventory_audits (
        id           SERIAL PRIMARY KEY,
        audit_type   audit_type    NOT NULL,
        auditor_name VARCHAR(255)  NOT NULL,
        notes        TEXT,
        audit_status audit_status  NOT NULL DEFAULT 'draft',
        created_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
        updated_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW()
      );
    `;
    console.log("  ✅ inventory_audits table");

    // 4. جدول بنود الجرد
    await sql`
      CREATE TABLE IF NOT EXISTS inventory_audit_items (
        id            SERIAL PRIMARY KEY,
        audit_id      INTEGER      NOT NULL REFERENCES inventory_audits(id) ON DELETE CASCADE,
        product_code  VARCHAR(64)  NOT NULL,
        product_name  VARCHAR(512) NOT NULL,
        category      VARCHAR(255) NOT NULL,
        unit          VARCHAR(64)  NOT NULL,
        system_qty    INTEGER,
        actual_qty    INTEGER,
        difference    INTEGER,
        item_notes    TEXT
      );
    `;
    console.log("  ✅ inventory_audit_items table");

    // 5. Index على audit_id
    await sql`
      CREATE INDEX IF NOT EXISTS idx_audit_items_audit_id
        ON inventory_audit_items(audit_id);
    `;
    console.log("  ✅ index on audit_id");

    // 6. Trigger لتحديث updated_at
    await sql`
      CREATE OR REPLACE FUNCTION update_audit_updated_at()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `;
    await sql`
      DROP TRIGGER IF EXISTS trg_audits_updated_at ON inventory_audits;
    `;
    await sql`
      CREATE TRIGGER trg_audits_updated_at
        BEFORE UPDATE ON inventory_audits
        FOR EACH ROW EXECUTE FUNCTION update_audit_updated_at();
    `;
    console.log("  ✅ updated_at trigger");

    console.log("\n🎉 تمت العملية بنجاح — الجداول جاهزة!");
  } catch (err) {
    console.error("\n❌ خطأ أثناء تنفيذ الـ migration:", err.message);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

run();
