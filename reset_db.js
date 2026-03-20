const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://jpdvtajgammezdvxpypb.supabase.co';
// Thay bằng key Service Role thực tế
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpwZHZ0YWpnYW1tZXpkdnhweXBiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjU4NTcyMiwiZXhwIjoyMDg4MTYxNzIyfQ.z_ma_30OrKjW_UfvM88FaI4V7PaiLe7VAojNPjk1KFg';

const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false }
});

async function resetData() {
    console.log("CHỌN PHƯƠNG ÁN XÓA DỮ LIỆU:");
    console.log("-----------------------------------------");
    console.log("Phương án 1: Chỉ xóa Lịch sử báo suất (daily_reports)");
    console.log("Phương án 2: Xóa sạch Báo suất + Xóa Room/Class/Group/User (Dọn dẹp triệt để ngoại trừ Cài đặt và tài khoản Admin)");
    console.log("-----------------------------------------");

    // LẤY CHẾ ĐỘ XÓA TỪ TERMINAL (vd: node reset_db.js 1 hoặc node reset_db.js 2)
    const mode = process.argv[2];

    if (!mode || (mode !== '1' && mode !== '2')) {
        console.error("Vui lòng truyền số 1 hoặc 2 làm tham số. Ví dụ: node reset_db.js 1");
        process.exit(1);
    }

    // 1. LUÔN XÓA BÁO SUẤT CHUNG (Cho cả mode 1 và 2)
    console.log("1. Đang xóa toàn bộ bảng daily_reports...");
    const { error: err1 } = await supabase.from('daily_reports').delete().neq('id', -1);
    if (err1) console.error(" Lỗi khi xóa daily_reports:", err1.message);
    else console.log("=> Xóa thành công daily_reports");

    if (mode === '2') {
        // 2. XÓA PROFILES (TRỪ ADMIN)
        console.log("2. Đang dọn dẹp danh sách tài khoản (Profiles) trừ Quản trị viên...");
        const { data: adminProfiles } = await supabase.from('profiles').select('id').eq('role', 'admin');
        const adminIds = adminProfiles ? adminProfiles.map(p => p.id) : [];
        if (adminIds.length > 0) {
            // Because Supabase 'not.in' expects a comma separated string formatted like (val1,val2)
            const { error: err2 } = await supabase.from('profiles').delete().not('id', 'in', `(${adminIds.join(',')})`);
            if (err2) console.error(" Lỗi khi xóa profiles:", err2.message);
            else console.log("=> Xóa thành công profiles (giữ lại Admin)");

            // XÓA Ở BẢNG AUTH THỤ ĐỘNG CỦA SUPABASE ADMIN
            // Note: Service Role key can manage users in Auth
            console.log(" Đang dọn file auth.users...");
            const { data: usersData, error: usersErr } = await supabase.auth.admin.listUsers();
            if (!usersErr && usersData && usersData.users) {
                for (const u of usersData.users) {
                    if (!adminIds.includes(u.id)) {
                        await supabase.auth.admin.deleteUser(u.id);
                    }
                }
                console.log("=> Xóa auth.users thành công");
            }
        }

        // 3. XÓA CLASSES
        console.log("3. Đang dọn dẹp classes...");
        const { error: err3 } = await supabase.from('classes').delete().neq('id', -1);
        if (err3) console.error(" Lỗi khi xóa classes:", err3.message);
        else console.log("=> Xóa thành công classes");

        // 4. XÓA ROOMS
        console.log("4. Đang dọn dẹp rooms...");
        const { error: err4 } = await supabase.from('rooms').delete().neq('id', -1);
        if (err4) console.error(" Lỗi khi xóa rooms:", err4.message);
        else console.log("=> Xóa thành công rooms");

        // 5. XÓA GROUPS
        console.log("5. Đang dọn dẹp groups...");
        const { error: err5 } = await supabase.from('groups').delete().neq('id', -1);
        if (err5) console.error(" Lỗi khi xóa groups:", err5.message);
        else console.log("=> Xóa thành công groups");

    }

    console.log("\nHOÀN TẤT ĐẶT LẠI DỮ LIỆU BÀN GIAO KHÁCH HÀNG.");
}

resetData();
