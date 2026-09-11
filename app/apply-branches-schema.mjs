import "dotenv/config";
import postgres from 'postgres';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("Missing DATABASE_URL environment variable.");
  process.exit(1);
}

const sql = postgres(DATABASE_URL, {
  ssl: 'require',
  max: 1,
  idle_timeout: 10,
});

async function run() {
  console.log('Applying Branches & Employees Schema to Supabase...');

  try {
    await sql`
      CREATE TABLE IF NOT EXISTS branches (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        branch_code TEXT UNIQUE NOT NULL,
        branch_name TEXT NOT NULL,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT now()
      );
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS employees (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        employee_id TEXT UNIQUE NOT NULL,
        full_name TEXT NOT NULL,
        branch_code TEXT REFERENCES branches(branch_code) ON DELETE CASCADE,
        role TEXT DEFAULT 'cashier',
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT now()
      );
    `;

    await sql`ALTER TABLE branches ENABLE ROW LEVEL SECURITY;`;
    await sql`ALTER TABLE employees ENABLE ROW LEVEL SECURITY;`;

    await sql`DROP POLICY IF EXISTS "Allow public select on active branches" ON branches;`;
    await sql`CREATE POLICY "Allow public select on active branches" ON branches FOR SELECT USING (is_active = true);`;

    await sql`DROP POLICY IF EXISTS "Allow public access on employees" ON employees;`;
    await sql`CREATE POLICY "Allow public access on employees" ON employees FOR ALL USING (true) WITH CHECK (true);`;

    await sql`DROP POLICY IF EXISTS "Allow public access on branches" ON branches;`;
    await sql`CREATE POLICY "Allow public access on branches" ON branches FOR ALL USING (true) WITH CHECK (true);`;

    await sql`
      INSERT INTO branches (branch_code, branch_name) VALUES
        ('BR-101', 'فرع الرياض الرئيسي - العليا'),
        ('BR-102', 'فرع جدة - الكورنيش'),
        ('BR-103', 'فرع الدمام - الشاطئ')
      ON CONFLICT (branch_code) DO NOTHING;
    `;

    await sql`
      INSERT INTO employees (employee_id, full_name, branch_code, role) VALUES
        ('EMP-1001', 'أحمد محمود العتيبي', 'BR-101', 'manager'),
        ('EMP-1002', 'سارة عبد الله الغامدي', 'BR-101', 'cashier'),
        ('EMP-2001', 'محمد علي الزهراني', 'BR-102', 'cashier')
      ON CONFLICT (employee_id) DO NOTHING;
    `;

    // 1. RPC register_employee
    await sql`
      CREATE OR REPLACE FUNCTION register_employee(
        p_employee_id TEXT,
        p_full_name TEXT,
        p_branch_code TEXT,
        p_role TEXT DEFAULT 'cashier'
      )
      RETURNS JSONB
      LANGUAGE plpgsql
      SECURITY DEFINER
      AS $$
      DECLARE
        v_branch_active BOOLEAN;
        v_new_emp RECORD;
        v_branch_name TEXT;
      BEGIN
        IF p_employee_id IS NULL OR trim(p_employee_id) = '' THEN
          RETURN jsonb_build_object('success', false, 'message', 'رقم الموظف مطلوب');
        END IF;

        IF p_full_name IS NULL OR trim(p_full_name) = '' THEN
          RETURN jsonb_build_object('success', false, 'message', 'اسم الموظف الكامل مطلوب');
        END IF;

        IF p_branch_code IS NULL OR trim(p_branch_code) = '' THEN
          RETURN jsonb_build_object('success', false, 'message', 'رقم الفرع مطلوب');
        END IF;

        SELECT is_active, branch_name INTO v_branch_active, v_branch_name
        FROM branches
        WHERE branch_code = trim(p_branch_code);

        IF NOT FOUND THEN
          RETURN jsonb_build_object('success', false, 'message', 'رقم الفرع غير موجود في النظام');
        END IF;

        IF NOT v_branch_active THEN
          RETURN jsonb_build_object('success', false, 'message', 'هذا الفرع معطل حالياً ولا يمكن إضافة موظفين له');
        END IF;

        IF EXISTS (SELECT 1 FROM employees WHERE employee_id = trim(p_employee_id)) THEN
          RETURN jsonb_build_object('success', false, 'message', 'الرقم الوظيفي مسجل لموظف آخر بالفعل');
        END IF;

        INSERT INTO employees (employee_id, full_name, branch_code, role, is_active)
        VALUES (trim(p_employee_id), trim(p_full_name), trim(p_branch_code), COALESCE(trim(p_role), 'cashier'), true)
        RETURNING * INTO v_new_emp;

        RETURN jsonb_build_object(
          'success', true,
          'message', 'تم تسجيل الموظف بنجاح',
          'employee', jsonb_build_object(
            'id', v_new_emp.id,
            'employee_id', v_new_emp.employee_id,
            'full_name', v_new_emp.full_name,
            'branch_code', v_new_emp.branch_code,
            'branch_name', v_branch_name,
            'role', v_new_emp.role,
            'created_at', v_new_emp.created_at
          )
        );
      EXCEPTION
        WHEN OTHERS THEN
          RETURN jsonb_build_object('success', false, 'message', SQLERRM);
      END;
      $$;
    `;

    // 2. RPC fast_employee_login
    await sql`
      CREATE OR REPLACE FUNCTION fast_employee_login(
        p_branch_code TEXT,
        p_employee_id TEXT
      )
      RETURNS JSONB
      LANGUAGE plpgsql
      SECURITY DEFINER
      AS $$
      DECLARE
        v_result RECORD;
      BEGIN
        IF p_branch_code IS NULL OR trim(p_branch_code) = '' OR p_employee_id IS NULL OR trim(p_employee_id) = '' THEN
          RETURN jsonb_build_object('success', false, 'message', 'يرجى إدخال رقم الفرع والرقم الوظيفي');
        END IF;

        SELECT
          e.id,
          e.employee_id,
          e.full_name,
          e.branch_code,
          b.branch_name,
          e.role,
          e.is_active AS emp_active,
          b.is_active AS branch_active
        INTO v_result
        FROM employees e
        JOIN branches b ON e.branch_code = b.branch_code
        WHERE e.employee_id = trim(p_employee_id)
          AND e.branch_code = trim(p_branch_code);

        IF NOT FOUND THEN
          RETURN jsonb_build_object('success', false, 'message', 'بيانات الدخول غير صحيحة، يرجى التأكد من رقم الفرع والرقم الوظيفي');
        END IF;

        IF NOT v_result.branch_active THEN
          RETURN jsonb_build_object('success', false, 'message', 'هذا الفرع معطل حالياً من قبل الإدارة');
        END IF;

        IF NOT v_result.emp_active THEN
          RETURN jsonb_build_object('success', false, 'message', 'حساب هذا الموظف معطل، يرجى مراجعة الإدارة');
        END IF;

        RETURN jsonb_build_object(
          'success', true,
          'message', 'تم تسجيل الدخول بنجاح',
          'session', jsonb_build_object(
            'id', v_result.id,
            'employee_id', v_result.employee_id,
            'full_name', v_result.full_name,
            'branch_code', v_result.branch_code,
            'branch_name', v_result.branch_name,
            'role', v_result.role,
            'logged_at', now()
          )
        );
      EXCEPTION
        WHEN OTHERS THEN
          RETURN jsonb_build_object('success', false, 'message', SQLERRM);
      END;
      $$;
    `;

    console.log('✅ Schema & RPC functions successfully applied!');
  } catch (err) {
    console.error('❌ Migration Error:', err);
  } finally {
    await sql.end();
  }
}

run();
