const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://jpdvtajgammezdvxpypb.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpwZHZ0YWpnYW1tZXpkdnhweXBiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjU4NTcyMiwiZXhwIjoyMDg4MTYxNzIyfQ.z_ma_30OrKjW_UfvM88FaI4V7PaiLe7VAojNPjk1KFg';

const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false }
});

async function check() {
    // 1. Check all teacher meal reports
    console.log("=== ALL teacher_meal_reports ===");
    const { data: reports, error: err1 } = await supabase
        .from('teacher_meal_reports')
        .select('*')
        .order('report_date', { ascending: false })
        .limit(10);
    
    if (err1) console.error("Error:", err1.message);
    else console.log(JSON.stringify(reports, null, 2));

    // 2. Check RLS status
    console.log("\n=== RLS policies on teacher_meal_reports ===");
    const { data: policies, error: err2 } = await supabase.rpc('exec_sql', {
        sql: `SELECT policyname, cmd, qual, with_check 
              FROM pg_policies 
              WHERE tablename = 'teacher_meal_reports'`
    }).maybeSingle();

    if (err2) {
        // Try raw query via postgrest
        console.log("Cannot check policies via RPC, checking RLS enabled status...");
        const { data: rlsCheck, error: err3 } = await supabase.rpc('exec_sql', {
            sql: `SELECT relname, relrowsecurity FROM pg_class WHERE relname = 'teacher_meal_reports'`
        }).maybeSingle();
        if (err3) console.log("RPC not available, cannot check RLS status directly. Error:", err3.message);
        else console.log(JSON.stringify(rlsCheck, null, 2));
    } else {
        console.log(JSON.stringify(policies, null, 2));
    }

    // 3. Check table columns
    console.log("\n=== Table columns ===");
    const { data: cols, error: err4 } = await supabase
        .from('teacher_meal_reports')
        .select('*')
        .limit(0);
    // Just checking if table exists and is accessible
    if (err4) console.error("Table access error:", err4.message);
    else console.log("Table accessible via service role");
}

check();
