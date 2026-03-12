const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://jpdvtajgammezdvxpypb.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpwZHZ0YWpnYW1tZXpkdnhweXBiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjU4NTcyMiwiZXhwIjoyMDg4MTYxNzIyfQ.z_ma_30OrKjW_UfvM88FaI4V7PaiLe7VAojNPjk1KFg';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkData() {
    console.log("--- PROFILES (Room Managers) ---");
    const { data: profiles, error: pErr } = await supabase
        .from('profiles')
        .select('email, full_name, role, room_id')
        .eq('role', 'room_manager');
    if (pErr) console.error(pErr);
    else console.log(JSON.stringify(profiles, null, 2));

    console.log("\n--- ROOMS ---");
    const { data: rooms, error: rErr } = await supabase
        .from('rooms')
        .select('id, name');
    if (rErr) console.error(rErr);
    else console.log(JSON.stringify(rooms, null, 2));
}

checkData();
