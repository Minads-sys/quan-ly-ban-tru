const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://jpdvtajgammezdvxpypb.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpwZHZ0YWpnYW1tZXpkdnhweXBiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjU4NTcyMiwiZXhwIjoyMDg4MTYxNzIyfQ.z_ma_30OrKjW_UfvM88FaI4V7PaiLe7VAojNPjk1KFg';

const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
});

const statements = [
    // Enable RLS
    `ALTER TABLE public.teacher_meal_reports ENABLE ROW LEVEL SECURITY`,

    // Drop existing policies
    `DROP POLICY IF EXISTS "Authenticated users can read teacher_meal_reports" ON public.teacher_meal_reports`,
    `DROP POLICY IF EXISTS "Admin/approver can insert teacher_meal_reports" ON public.teacher_meal_reports`,
    `DROP POLICY IF EXISTS "Admin/approver can update teacher_meal_reports" ON public.teacher_meal_reports`,
    `DROP POLICY IF EXISTS "Admin can delete teacher_meal_reports" ON public.teacher_meal_reports`,

    // SELECT: All authenticated users can read
    `CREATE POLICY "Authenticated users can read teacher_meal_reports"
     ON public.teacher_meal_reports FOR SELECT
     TO authenticated
     USING (true)`,

    // INSERT
    `CREATE POLICY "Admin/approver can insert teacher_meal_reports"
     ON public.teacher_meal_reports FOR INSERT
     TO authenticated
     WITH CHECK (
         EXISTS (
             SELECT 1 FROM public.profiles
             WHERE id = auth.uid()
             AND role IN ('admin', 'school_approver', 'reporter')
         )
     )`,

    // UPDATE
    `CREATE POLICY "Admin/approver can update teacher_meal_reports"
     ON public.teacher_meal_reports FOR UPDATE
     TO authenticated
     USING (
         EXISTS (
             SELECT 1 FROM public.profiles
             WHERE id = auth.uid()
             AND role IN ('admin', 'school_approver', 'reporter')
         )
     )`,

    // DELETE
    `CREATE POLICY "Admin can delete teacher_meal_reports"
     ON public.teacher_meal_reports FOR DELETE
     TO authenticated
     USING (
         EXISTS (
             SELECT 1 FROM public.profiles
             WHERE id = auth.uid()
             AND role = 'admin'
         )
     )`,
];

async function run() {
    console.log("🔧 Applying RLS policies for teacher_meal_reports...\n");

    for (const sql of statements) {
        const shortName = sql.split('\n')[0].trim().substring(0, 80);
        try {
            const { error } = await supabase.rpc('exec_sql', { sql_text: sql });
            if (error) throw error;
            console.log(`✅ ${shortName}`);
        } catch (e) {
            // rpc might not exist, try via postgREST pg endpoint
            console.log(`⚠️  Cannot run via RPC: ${shortName}`);
            console.log(`   Error: ${e.message || e}`);
        }
    }

    // Verification: try reading with service role (bypasses RLS)
    console.log("\n=== Verification ===");
    const { data, error } = await supabase
        .from('teacher_meal_reports')
        .select('*')
        .order('report_date', { ascending: false })
        .limit(5);
    
    if (error) {
        console.log("❌ Error reading:", error.message);
    } else {
        console.log(`✅ Found ${data.length} records in teacher_meal_reports (via service role)`);
        data.forEach(r => {
            console.log(`   📅 ${r.report_date}: Mặn ${r.salty_count}, Cháo ${r.porridge_count}, Chay ${r.vegetarian_count}`);
        });
    }

    console.log("\n" + "=".repeat(60));
    console.log("⚠️  Nếu RPC không khả dụng, hãy chạy SQL sau trong");
    console.log("   Supabase Dashboard > SQL Editor:");
    console.log("=".repeat(60));
    console.log(`
-- Enable RLS
ALTER TABLE public.teacher_meal_reports ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Authenticated users can read teacher_meal_reports" ON public.teacher_meal_reports;
DROP POLICY IF EXISTS "Admin/approver can insert teacher_meal_reports" ON public.teacher_meal_reports;
DROP POLICY IF EXISTS "Admin/approver can update teacher_meal_reports" ON public.teacher_meal_reports;
DROP POLICY IF EXISTS "Admin can delete teacher_meal_reports" ON public.teacher_meal_reports;

-- SELECT: All authenticated users can read
CREATE POLICY "Authenticated users can read teacher_meal_reports"
ON public.teacher_meal_reports FOR SELECT
TO authenticated
USING (true);

-- INSERT: Admin, school_approver, reporter
CREATE POLICY "Admin/approver can insert teacher_meal_reports"
ON public.teacher_meal_reports FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'school_approver', 'reporter'))
);

-- UPDATE: Admin, school_approver, reporter
CREATE POLICY "Admin/approver can update teacher_meal_reports"
ON public.teacher_meal_reports FOR UPDATE
TO authenticated
USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'school_approver', 'reporter'))
);

-- DELETE: Only admin
CREATE POLICY "Admin can delete teacher_meal_reports"
ON public.teacher_meal_reports FOR DELETE
TO authenticated
USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.teacher_meal_reports;
`);
}

run();
