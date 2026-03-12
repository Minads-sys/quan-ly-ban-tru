const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://jpdvtajgammezdvxpypb.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpwZHZ0YWpnYW1tZXpkdnhweXBiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjU4NTcyMiwiZXhwIjoyMDg4MTYxNzIyfQ.z_ma_30OrKjW_UfvM88FaI4V7PaiLe7VAojNPjk1KFg';

const supabase = createClient(supabaseUrl, supabaseKey);

async function applyRLS() {
    const query = `
        CREATE POLICY "Admin can manage all profiles"
        ON public.profiles FOR ALL
        TO authenticated
        USING (
            EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
        );
    `;
    
    // Using Supabase JS client to execute raw SQL isn't directly supported.
    // However, I will write the update query directly to verify that the assignment issue is fixed
    // Since I have the service_role key, I can bypass RLS directly using standard updates.
    
    // Oh wait, the frontend uses the user's JWT to update profiles, so the RLS is what's blocking the frontend!
    // The user will need to run the SQL in Supabase Dashboard.
    console.log("Please run the SQL file in Supabase Dashboard.");
}

applyRLS();
