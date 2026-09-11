-- =============================================================================
-- AUTHENTICATION & ADMIN APPROVAL SYSTEM SCHEMA
-- Database Engine: PostgreSQL / Supabase
-- =============================================================================

-- 1. Create Table: branches (جدول الفروع)
CREATE TABLE IF NOT EXISTS branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_code TEXT UNIQUE NOT NULL,
  branch_name TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Create Table: employee_requests (طلبات تسجيل الموظفين المرفوعة للأدمن)
CREATE TABLE IF NOT EXISTS employee_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  branch_code TEXT REFERENCES branches(branch_code) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
  rejection_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Create Table: employees (جدول الموظفين المعتمدين والمنشئين فعلياً)
CREATE TABLE IF NOT EXISTS employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  branch_code TEXT REFERENCES branches(branch_code) ON DELETE CASCADE,
  role TEXT DEFAULT 'staff', -- 'staff', 'manager', 'admin'
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS (Row Level Security)
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;

-- Hardened Policies: Read-only access for public/anonymous client queries
-- All mutations (Insert, Update, Delete) are strictly mediated through SECURITY DEFINER RPCs
DROP POLICY IF EXISTS "Allow read branches" ON branches;
DROP POLICY IF EXISTS "Allow all on branches" ON branches;
CREATE POLICY "Allow read branches" ON branches FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow all on requests" ON employee_requests;
CREATE POLICY "Allow read requests" ON employee_requests FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow all on employees" ON employees;
CREATE POLICY "Allow read active employees" ON employees FOR SELECT USING (is_active = true);

-- Insert Default Demo Branches
INSERT INTO branches (branch_code, branch_name) VALUES
  ('1010001', 'فرع الرياض الرئيسي - العليا'),
  ('1010002', 'فرع جدة - الكورنيش'),
  ('1010003', 'فرع الدمام - الشاطئ')
ON CONFLICT (branch_code) DO NOTHING;

-- Insert Admin Account by default
INSERT INTO employees (employee_id, full_name, branch_code, role, is_active) VALUES
  ('10001', 'مدير النظام (الأدمن)', '1010001', 'admin', true)
ON CONFLICT (employee_id) DO NOTHING;

-- =============================================================================
-- FUNCTIONS / RPCs FOR REGISTRATION REQUEST, APPROVAL, AND LOGIN
-- =============================================================================

-- 1. Function: submit_employee_request
-- الموظف يقدم طلب تسجيل حساب من واجهة الموقع
CREATE OR REPLACE FUNCTION submit_employee_request(
  p_full_name TEXT,
  p_employee_id TEXT,
  p_branch_code TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_branch_active BOOLEAN;
  v_branch_name TEXT;
BEGIN
  -- Trim inputs
  p_full_name := trim(p_full_name);
  p_employee_id := trim(p_employee_id);
  p_branch_code := trim(p_branch_code);

  -- Validations
  IF p_full_name IS NULL OR p_full_name = '' THEN
    RETURN jsonb_build_object('success', false, 'message', 'يرجى إدخال اسم الموظف الكامل');
  END IF;

  IF p_employee_id IS NULL OR p_employee_id = '' THEN
    RETURN jsonb_build_object('success', false, 'message', 'يرجى إدخال الرقم الوظيفي المطلوب');
  END IF;

  IF p_branch_code IS NULL OR p_branch_code = '' THEN
    RETURN jsonb_build_object('success', false, 'message', 'يرجى إدخال رقم الفرع');
  END IF;

  -- Verify branch existence
  SELECT is_active, branch_name INTO v_branch_active, v_branch_name
  FROM branches
  WHERE branch_code = p_branch_code;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'رقم الفرع غير موجود في قاعدة البيانات');
  END IF;

  IF NOT v_branch_active THEN
    RETURN jsonb_build_object('success', false, 'message', 'هذا الفرع معطل حالياً من قبل الإدارة');
  END IF;

  -- Check if employee already exists in approved employees table
  IF EXISTS (SELECT 1 FROM employees WHERE employee_id = p_employee_id) THEN
    RETURN jsonb_build_object('success', false, 'message', 'هذا الرقم الوظيفي مسجل لموظف معتمد بالفعل');
  END IF;

  -- Check if employee request is already pending
  IF EXISTS (SELECT 1 FROM employee_requests WHERE employee_id = p_employee_id AND status = 'pending') THEN
    RETURN jsonb_build_object('success', false, 'message', 'يوجد طلب تسجيل معلق بنفس الرقم الوظيفي بانتظار موافقة الأدمن');
  END IF;

  -- Insert or Update Request to Pending
  INSERT INTO employee_requests (full_name, employee_id, branch_code, status)
  VALUES (p_full_name, p_employee_id, p_branch_code, 'pending')
  ON CONFLICT (employee_id) DO UPDATE
    SET full_name = EXCLUDED.full_name,
        branch_code = EXCLUDED.branch_code,
        status = 'pending',
        rejection_reason = NULL,
        created_at = now();

  RETURN jsonb_build_object(
    'success', true,
    'message', 'تم رفع طلب الحساب بنجاح! حسابك حالياً بانتظار مراجعة وموافقة الإدارة (الأدمن)'
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$$;


-- 2. Function: login_employee
-- تسجيل دخول الموظف والتحقق من حالة الموافقة
CREATE OR REPLACE FUNCTION login_employee(
  p_branch_code TEXT,
  p_employee_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_emp RECORD;
  v_req RECORD;
BEGIN
  p_branch_code := trim(p_branch_code);
  p_employee_id := trim(p_employee_id);

  IF p_branch_code IS NULL OR p_branch_code = '' OR p_employee_id IS NULL OR p_employee_id = '' THEN
    RETURN jsonb_build_object('success', false, 'message', 'يرجى إدخال رقم الفرع والرقم الوظيفي');
  END IF;

  -- 1. Check if employee is approved & active in employees table
  SELECT e.*, b.branch_name, b.is_active AS branch_active
  INTO v_emp
  FROM employees e
  JOIN branches b ON e.branch_code = b.branch_code
  WHERE e.employee_id = p_employee_id AND e.branch_code = p_branch_code;

  IF FOUND THEN
    IF NOT v_emp.branch_active THEN
      RETURN jsonb_build_object('success', false, 'message', 'هذا الفرع معطل حالياً من قبل الإدارة');
    END IF;

    IF NOT v_emp.is_active THEN
      RETURN jsonb_build_object('success', false, 'message', 'حسابك معطل حالياً من قبل الأدمن');
    END IF;

    -- Successful Login
    RETURN jsonb_build_object(
      'success', true,
      'status', 'approved',
      'message', 'تم تسجيل الدخول بنجاح',
      'session', jsonb_build_object(
        'id', v_emp.id,
        'employee_id', v_emp.employee_id,
        'full_name', v_emp.full_name,
        'branch_code', v_emp.branch_code,
        'branch_name', v_emp.branch_name,
        'role', v_emp.role,
        'logged_at', now()
      )
    );
  END IF;

  -- 2. Check if there is a pending or rejected request
  SELECT er.*, b.branch_name
  INTO v_req
  FROM employee_requests er
  LEFT JOIN branches b ON er.branch_code = b.branch_code
  WHERE er.employee_id = p_employee_id;

  IF FOUND THEN
    IF v_req.status = 'pending' THEN
      RETURN jsonb_build_object(
        'success', false,
        'status', 'pending',
        'message', 'طلبك ما زال قيد المراجعة وبانتظار موافقة الأدمن. يرجى تواصل مع الإدارة لتفعيل حسابك.'
      );
    ELSIF v_req.status = 'rejected' THEN
      RETURN jsonb_build_object(
        'success', false,
        'status', 'rejected',
        'message', COALESCE('تم رفض طلب تسجيل حسابك من قبل الأدمن. السبب: ' || v_req.rejection_reason, 'تم رفض طلب حسابك من قبل الإدارة.')
      );
    END IF;
  END IF;

  -- Credentials mismatch
  RETURN jsonb_build_object('success', false, 'message', 'بيانات الدخول غير صحيحة. تحقق من رقم الفرع والرقم الوظيفي.');
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$$;


-- 3. Function: approve_employee_request (الأدمن يوافق على طلب الحساب)
CREATE OR REPLACE FUNCTION approve_employee_request(
  p_request_id UUID,
  p_role TEXT DEFAULT 'staff'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_req RECORD;
BEGIN
  SELECT * INTO v_req FROM employee_requests WHERE id = p_request_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'طلب التسجيل غير موجود');
  END IF;

  -- Create or update employee record
  INSERT INTO employees (employee_id, full_name, branch_code, role, is_active)
  VALUES (v_req.employee_id, v_req.full_name, v_req.branch_code, COALESCE(p_role, 'staff'), true)
  ON CONFLICT (employee_id) DO UPDATE
    SET full_name = EXCLUDED.full_name,
        branch_code = EXCLUDED.branch_code,
        role = EXCLUDED.role,
        is_active = true;

  -- Update request status
  UPDATE employee_requests SET status = 'approved' WHERE id = p_request_id;

  RETURN jsonb_build_object('success', true, 'message', 'تمت الموافقة على طلب الموظف وتفعيل حسابه بنجاح!');
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$$;


-- 4. Function: reject_employee_request (الأدمن يرفض طلب الحساب)
CREATE OR REPLACE FUNCTION reject_employee_request(
  p_request_id UUID,
  p_reason TEXT DEFAULT 'رفض من قبل الإدارة'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE employee_requests
  SET status = 'rejected',
      rejection_reason = p_reason
  WHERE id = p_request_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'طلب التسجيل غير موجود');
  END IF;

  RETURN jsonb_build_object('success', true, 'message', 'تم رفض طلب الموظف');
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$$;


-- 5. Function: toggle_employee_active (الأدمن يعطل أو يفعل حساب موظف)
CREATE OR REPLACE FUNCTION toggle_employee_active(
  p_employee_id TEXT,
  p_is_active BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE employees
  SET is_active = p_is_active
  WHERE employee_id = p_employee_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'الموظف غير موجود');
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'message', CASE WHEN p_is_active THEN 'تم تفعيل حساب الموظف' ELSE 'تم تعطيل حساب الموظف' END
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$$;
