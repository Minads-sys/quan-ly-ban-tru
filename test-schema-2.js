const fs = require('fs');
const envFile = fs.readFileSync('.env.local', 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
    const [k, ...v] = line.split('=');
    if (k && v.length > 0) env[k.trim()] = v.join('=').trim().replace(/['"]/g, '');
});

async function check() {
    const res = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/daily_reports?limit=1`, {
        headers: {
            'apikey': env.SUPABASE_SERVICE_ROLE_KEY,
            'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`
        }
    });
    const data = await res.json();
    console.log(Object.keys(data[0] || {}).join(', '));
}
check();
