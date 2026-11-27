        const firebaseConfig = {
            apiKey: "AIzaSyD3NFgHKlVKJbZ4_tBaYQbreDOTdK6QI3I",
            authDomain: "tommy-barber.firebaseapp.com",
            databaseURL: "https://tommy-barber-default-rtdb.firebaseio.com",
            projectId: "tommy-barber",
            storageBucket: "tommy-barber.firebasestorage.app",
            messagingSenderId: "401586383604",
            appId: "1:401586383604:web:f3da40e6960cbe86c44ca1",
            measurementId: "G-MQCJCNVDJQ"
        };

        let db = null, cloudRef = null, isApplyingRemote = false;
        let usbFileHandle = null;

        const STORAGE_KEY = 'tommy_barber_exact_clone_v7_local';
        const localISO = d => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().split('T')[0];
        const BIZ_SHIFT = 5 * 3600000;
        const getTodayISO = () => localISO(new Date(Date.now() - BIZ_SHIFT));
        let payrollMonth = getTodayISO().slice(0, 7);
        const toMin = t => { const [h, m] = String(t || '').split(':').map(Number); return isNaN(h) ? null : h * 60 + (m || 0); };
        const diffFromShift = (shift, t24) => { const a = toMin(shift), b = toMin(t24); return a == null || b == null ? 0 : b - a; };
        const graceOf = st => (st && st.graceMinutes != null ? Number(st.graceMinutes) : 15);
        const chargeMin = (late, st) => { const g = graceOf(st); if (late <= g) return 0; return appState.salonInfo.lateMode === 'excess' ? late - g : late; };
        function stampOut(rec, st, t24) { rec.checkOut24 = t24; const e = st && st.shiftEnd ? toMin(st.shiftEnd) - toMin(t24) : 0; rec.earlyMinutes = e > 0 ? e : 0; }
        function lateBadge(rec, st) {
            const d = rec.diffMin != null ? rec.diffMin : (rec.lateMinutes || 0), late = Math.max(0, d), g = graceOf(st);
            const B = (c, t) => `<span class="block mt-1 px-2 py-0.5 rounded-lg border text-[11px] font-black ${c}">${t}</span>`;
            if (d < 0) return B('bg-sky-950/50 border-sky-800 text-sky-300', 'جه بدري ' + fmtDur(-d));
            if (late === 0) return B('bg-emerald-950/60 border-emerald-800 text-emerald-300', 'في الميعاد');
            if (late <= g) return B('bg-amber-950/50 border-amber-800 text-amber-300', 'متأخر ' + fmtDur(late) + ' (جوه السماح - بدون خصم)');
            return B('bg-red-950/60 border-red-800 text-red-300', 'متأخر ' + fmtDur(late) + (appState.salonInfo.lateDeduct === 'auto' ? ' - هيتخصم' : ' - بعد السماح (بيتسجل بس)'));
        }
        const invFactor = inv => (inv.subtotal > 0 && inv.total != null ? inv.total / inv.subtotal : 1);
        const get24TimeStr = () => { const d = new Date(); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
        const formatTime12 = (timeStr) => {
            if (!timeStr) return '';
            if (timeStr.includes('ص') || timeStr.includes('م')) return timeStr;
            const [hStr, mStr] = timeStr.split(':');
            let h = parseInt(hStr, 10);
            if (isNaN(h)) return timeStr;
            const suffix = h >= 12 ? 'م' : 'ص';
            h = h % 12 || 12;
            return `${String(h).padStart(2, '0')}:${mStr} ${suffix}`;
        };
        const getTimeStr = () => formatTime12(get24TimeStr());
        const fmt = (n) => Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 2 });
        const DEFAULT_ROLES = [
            {id:'barber',label:'حلاق (صنايعي)',perf:true},
            {id:'assistant',label:'مساعد حلاق'},
            {id:'skincare',label:'أخصائي بشرة وتنظيف بشرة',perf:true},
            {id:'nails',label:'أخصائي مانيكير وبديكير',perf:true},
            {id:'cleaner',label:'عامل أرضية'},
            {id:'cafe',label:'عامل كافيه'},
            {id:'cashier',label:'كاشير'},
            {id:'manager',label:'مدير'}
        ];
        const roles = () => (appState.roles && appState.roles.length ? appState.roles : DEFAULT_ROLES);
        const roleLabel = r => (roles().find(x => x.id === r) || { label: 'حلاق (صنايعي)' }).label;
        const isPerf = b => !!(roles().find(x => x.id === (b.role || 'barber')) || {}).perf;
        const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
        const CARE_CATEGORIES = ['cat_skin', 'cat_haircare', 'cat_beard', 'cat_dyes', 'cat_scrub', 'cat_smooth'];
        const isCareCat = id => CARE_CATEGORIES.includes(id) || /بشرة|عناية|بديكير|مانيكير|صبغ|اسكراب|تنعيم|دقن/.test((appState.categories.find(c => c.id === id) || {}).name || '');

        const defaultState = {
            salonInfo: {
                name: 'TOMMY BARBER',
                sub: 'صالون رجالي',
                address: 'المحلة الكبرى - شارع البحر - أمام بنك ناصر الاجتماعي',
                phone: '01000746687',
                paymentNumbers: 'محفظة / انستاباي: 01000746687'
            },
            users: [
                { id: 'u-admin', displayName: 'المدير', roleTitle: 'مدير', username: 'admin', password: '1234', pin: '1234', permissions: { pos: true, invoices: true, clients: true, editInvoices: true, reports: true, catalog: true, barbers: true, attendance: true, users: true, settings: true } },
                { id: 'u-omar', displayName: 'omar', roleTitle: 'كاشير', username: 'omar', password: '1111', pin: '1111', permissions: { pos: true, invoices: true, clients: true, editInvoices: false, reports: false, catalog: false, barbers: false, attendance: true, users: false, settings: false } },
                { id: 'u-sara', displayName: 'sara', roleTitle: 'كاشير', username: 'sara', password: '2222', pin: '2222', permissions: { pos: true, invoices: true, clients: true, editInvoices: false, reports: false, catalog: false, barbers: false, attendance: false, users: false, settings: false } }
            ],
            barbers: [
                { id: 'b1', name: 'أحمد', phone1: '01011112222', phone2: '', role: 'barber', payType: 'commission', baseSalary: 0, commissionPct: 30, skinPct: 15, shiftStart: '12:00', lateHourRate: 30 },
                { id: 'b2', name: 'فتحي', phone1: '01022223333', phone2: '', role: 'barber', payType: 'both', baseSalary: 3500, commissionPct: 25, skinPct: 10, shiftStart: '12:00', lateHourRate: 25 },
                { id: 'b3', name: 'يوسف', phone1: '01033334444', phone2: '', role: 'barber', payType: 'salary', baseSalary: 6000, commissionPct: 0, skinPct: 10, shiftStart: '12:00', lateHourRate: 25 },
                { id: 'b4', name: 'عبد الرحمن', phone1: '01044445555', phone2: '', role: 'barber', payType: 'both', baseSalary: 4000, commissionPct: 20, skinPct: 10, shiftStart: '13:00', lateHourRate: 25 },
                { id: 'b8', name: 'مصطفى', phone1: '01088889999', phone2: '', role: 'skincare', payType: 'both', baseSalary: 3000, commissionPct: 25, skinPct: 25, shiftStart: '12:00', lateHourRate: 25 },
                { id: 'b5', name: 'كريم', phone1: '01055556666', phone2: '', role: 'assistant', payType: 'both', baseSalary: 2500, commissionPct: 0, skinPct: 15, shiftStart: '11:30', lateHourRate: 15 },
                { id: 'b6', name: 'omar', phone1: '01066667777', phone2: '', role: 'cashier', payType: 'salary', baseSalary: 4500, commissionPct: 0, skinPct: 0, shiftStart: '11:30', lateHourRate: 20 },
                { id: 'b7', name: 'سعيد', phone1: '01077778888', phone2: '', role: 'cleaner', payType: 'salary', baseSalary: 3000, commissionPct: 0, skinPct: 0, shiftStart: '11:00', lateHourRate: 15 }
            ],
            clients: [{ id: 'c-1', name: 'خالد ناصر', phone: '01099887766', createdAt: getTodayISO() }],
            attendanceRecords: {},
            advances: [
                { id: 'adv-1', staffId: 'b1', staffName: 'أحمد', amount: 300, reason: 'سُلفة نقدية', date: getTodayISO() },
                { id: 'adv-2', staffId: 'b5', staffName: 'كريم', amount: 150, reason: 'سُلفة منتصف الشهر', date: getTodayISO() }
            ],
            categories: [
                { id: 'cat_cut', name: 'خدمات القص', icon: 'fa-scissors' },
                { id: 'cat_style', name: 'خدمات التصفيف', icon: 'fa-wind' },
                { id: 'cat_haircare', name: 'خدمات العناية بالشعر', icon: 'fa-droplet' },
                { id: 'cat_beard', name: 'خدمات العناية بالدقن', icon: 'fa-face-smile' },
                { id: 'cat_smooth', name: 'خدمات تنعيم الشعر', icon: 'fa-wand-magic-sparkles' },
                { id: 'cat_dyes', name: 'خدمات الصبغات', icon: 'fa-mortar-pestle' },
                { id: 'cat_skin', name: 'خدمات العناية بالبشرة', icon: 'fa-face-laugh-beam' },
                { id: 'cat_scrub', name: 'الاسكرابات', icon: 'fa-jar' },
                { id: 'cat_groom', name: 'باكدجات خاصة بالعريس', icon: 'fa-crown' },
                { id: 'cat_nails', name: 'مانيكير وبديكير', icon: 'fa-hand-sparkles' }
            ],
            catalog: [
                { id: 's1', category: 'cat_cut', name: 'قص شعر', price: 150, icon: 'fa-scissors' },
                { id: 's2', category: 'cat_cut', name: 'قص شعر اطفال (تحت 4 سنوات)', price: 100, icon: 'fa-child' },
                { id: 's3', category: 'cat_cut', name: 'حلاقة دقن', price: 100, icon: 'fa-face-smile' },
                { id: 's4', category: 'cat_cut', name: 'حلاقة دقن بالشفره', price: 130, icon: 'fa-pen-nib' },
                { id: 's5', category: 'cat_cut', name: 'تحديد شعر ودقن', price: 100, icon: 'fa-ruler-horizontal' },
                { id: 's6', category: 'cat_style', name: 'استشوار شعر', price: 100, icon: 'fa-wind' },
                { id: 's7', category: 'cat_style', name: 'استشوار دقن', price: 80, icon: 'fa-wind' },
                { id: 's8', category: 'cat_style', name: 'مكواه شعر', price: 100, icon: 'fa-fire' },
                { id: 's9', category: 'cat_style', name: 'كيرلي تويست', price: 100, icon: 'fa-hurricane' },
                { id: 's10', category: 'cat_style', name: 'كيرلي ستايل', price: 400, icon: 'fa-hurricane' },
                { id: 's11', category: 'cat_style', name: 'ويفي', price: 80, icon: 'fa-water' },
                { id: 's12', category: 'cat_beard', name: 'حمام زيت بالعسل والاعشاب للدقن', price: 150, icon: 'fa-leaf' },
                { id: 's13', category: 'cat_beard', name: 'حمام زيت بالكولاجين للدقن', price: 200, icon: 'fa-droplet' },
                { id: 's14', category: 'cat_beard', name: 'جلسة ازالة القشره للدقن', price: 200, icon: 'fa-sparkles' },
                { id: 's15', category: 'cat_haircare', name: 'جلسة علاج التساقط', price: 300, icon: 'fa-droplet' },
                { id: 's16', category: 'cat_smooth', name: 'فرد شعري مصري', price: 250, icon: 'fa-wand-magic-sparkles' },
                { id: 's17', category: 'cat_smooth', name: 'خدمة بروتين (البروتين الخاص بالعميل)', price: 400, icon: 'fa-bolt' },
                { id: 's18', category: 'cat_dyes', name: 'صبغة شعر اصفر (GOLD)', price: 400, icon: 'fa-mortar-pestle' },
                { id: 's19', category: 'cat_dyes', name: 'صبغة شعر سيلفر (خصل)', price: 500, icon: 'fa-mortar-pestle' },
                { id: 's20', category: 'cat_skin', name: 'تنظيف بشره هيدروفيشل 7 مراحل', price: 600, icon: 'fa-face-laugh-beam' },
                { id: 's21', category: 'cat_scrub', name: 'اسكراب وجه بالقهوة والذهب', price: 100, icon: 'fa-jar' },
                { id: 's22', category: 'cat_groom', name: 'باكدج العريس الملكي', price: 1500, icon: 'fa-crown' },
                { id: 's23', category: 'cat_nails', name: 'مانيكير', price: 150, icon: 'fa-hand-sparkles' },
                { id: 's24', category: 'cat_nails', name: 'بديكير', price: 200, icon: 'fa-hand-sparkles' }
            ],
            invoices: [
                {
                    id: 1303, date: getTodayISO(), time: '08:17 م', barberId: 'b1', barberName: 'أحمد',
                    clientName: 'خالد ناصر', clientPhone: '01099887766', paymentMethod: 'cash',
                    subtotal: 700, discount: 0, total: 700, cashierName: 'omar', deleted: false,
                    items: [
                        { itemId: 's16', name: 'فرد شعري مصري', category: 'cat_smooth', price: 250, qty: 1 },
                        { itemId: 's18', name: 'صبغة شعر اصفر (GOLD)', category: 'cat_dyes', price: 250, qty: 1 },
                        { itemId: 's13', name: 'حمام زيت بالكولاجين للدقن', category: 'cat_beard', price: 200, qty: 1 }
                    ]
                }
            ],
            auditLogs: []
        };

        let appState = loadState();
        let currentUser = null;
        let selectedBarberId = appState.barbers.find(isPerf)?.id || 'b1';
        let selectedCategoryId = appState.categories[0]?.id || 'cat_cut';
        let servicesBoxVisible = true;
        let editingInvoiceId = null;
        let staffRoleFilter = 'all';
        let currentDraft = { items: [], paymentMethod: 'cash', discount: 0 };

        function loadState() {
            try { const s = localStorage.getItem(STORAGE_KEY); if (s) return JSON.parse(s); } catch (e) {}
            return JSON.parse(JSON.stringify(defaultState));
        }

        function saveState() {
            if (!isApplyingRemote) appState._ts = Date.now();
            try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(appState));
                if (cloudRef && !isApplyingRemote) cloudRef.set(JSON.parse(JSON.stringify(appState))).catch(() => {});
                if (usbFileHandle) writeToUsbFile();
            } catch (e) {}
        }

        async function linkUsbBackupFolder() {
            if (typeof window.showSaveFilePicker !== 'function') {
                showToast('لربط الفلاشة مباشرة افتح البرنامج من رابطك الرسمي في Chrome أو Edge', 'error');
                return;
            }
            try {
                usbFileHandle = await window.showSaveFilePicker({
                    suggestedName: 'TOMMY_BARBER_USB_BACKUP.json',
                    types: [{ description: 'JSON Backup', accept: { 'application/json': ['.json'] } }]
                });
                await writeToUsbFile();
                const el = document.getElementById('usb-sync-status');
                if (el) el.textContent = `✓ متصل بالفلاشة (${usbFileHandle.name}) — يحفظ تلقائياً`;
                showToast('تم ربط الفلاشة بنجاح! سيتم الحفظ عليها تلقائياً مع كل عملية');
            } catch (e) {
                if (e.name !== 'AbortError') showToast('تعذر الوصول للمسار المختار', 'error');
            }
        }

        async function writeToUsbFile() {
            if (!usbFileHandle) return;
            try {
                const writable = await usbFileHandle.createWritable();
                await writable.write(JSON.stringify(appState, null, 2));
                await writable.close();
            } catch (e) {}
        }

        function logAudit(text) {
            appState.auditLogs.unshift({ id: 'a-' + Date.now(), text, user: currentUser ? currentUser.displayName : 'النظام', time: `${getTodayISO()} ${getTimeStr()}` });
        }

        function initCloudSync() {
            try { if (typeof firebase !== 'undefined' && !firebase.apps.length) firebase.initializeApp(firebaseConfig); if (typeof firebase !== 'undefined') { db = firebase.database(); cloudRef = db.ref('tommy_barber_exact_clone_v7'); } } catch (e) {}
            if (!cloudRef) return;
            cloudRef.on('value', (snap) => {
                const remote = snap.val();
                if (remote) {
                    const rt = remote._ts || 0, lt = appState._ts || 0;
                    if (rt && rt === lt) return;
                    if (rt < lt) { cloudRef.set(JSON.parse(JSON.stringify(appState))).catch(() => {}); return; }
                    isApplyingRemote = true;
                    appState = {
                        ...JSON.parse(JSON.stringify(defaultState)),
                        ...remote,
                        salonInfo: { ...defaultState.salonInfo, ...(remote.salonInfo || {}) },
                        users: remote.users || defaultState.users,
                        barbers: remote.barbers || defaultState.barbers,
                        clients: remote.clients || defaultState.clients,
                        attendanceRecords: remote.attendanceRecords || {},
                        advances: remote.advances || [],
                        categories: remote.categories || defaultState.categories,
                        catalog: remote.catalog || defaultState.catalog,
                        invoices: remote.invoices || [],
                        auditLogs: remote.auditLogs || []
                    };
                    localStorage.setItem(STORAGE_KEY, JSON.stringify(appState));
                    renderAll();
                    isApplyingRemote = false;
                    if (migrateAuth()) { saveState(); renderAll(); }
                } else {
                    saveState();
                }
            });
        }

        function showToast(msg, type = 'success') {
            const c = document.getElementById('toast-container');
            const t = document.createElement('div');
            t.className = `pointer-events-auto border ${type === 'error' ? 'bg-red-950 border-red-600 text-red-200' : 'bg-panelbg border-gold text-white'} px-4 py-3 rounded-2xl shadow-2xl text-xs font-bold flex items-center gap-2`;
            t.innerHTML = `<i class="fa-solid ${type === 'error' ? 'fa-circle-exclamation text-red-400' : 'fa-circle-check text-gold'}"></i><span>${msg}</span>`;
            c.appendChild(t);
            setTimeout(() => t.remove(), 3000);
        }

        function closeModal(id) { document.getElementById(id)?.classList.add('hidden'); }

        // AUTH
        const MGR_MIN = 10, CASH_MIN = 6, PIN_MAX = 12;
        const _K = [0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
        function sha256b(msg) {
            let h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a, h4 = 0x510e527f, h5 = 0x9b05688c, h6 = 0x1f83d9ab, h7 = 0x5be0cd19;
            const l = msg.length, nb = (l + 9 + 63) >> 6, buf = new Uint8Array(nb * 64); buf.set(msg); buf[l] = 0x80;
            const dv = new DataView(buf.buffer); dv.setUint32(nb * 64 - 4, (l * 8) >>> 0); dv.setUint32(nb * 64 - 8, Math.floor(l * 8 / 4294967296));
            const w = new Uint32Array(64);
            for (let o = 0; o < nb * 64; o += 64) {
                for (let i = 0; i < 16; i++) w[i] = dv.getUint32(o + i * 4);
                for (let i = 16; i < 64; i++) { const a = w[i - 15], b = w[i - 2]; w[i] = (w[i - 16] + (((a >>> 7) | (a << 25)) ^ ((a >>> 18) | (a << 14)) ^ (a >>> 3)) + w[i - 7] + (((b >>> 17) | (b << 15)) ^ ((b >>> 19) | (b << 13)) ^ (b >>> 10))) | 0; }
                let a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7;
                for (let i = 0; i < 64; i++) {
                    const t1 = (h + (((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7))) + ((e & f) ^ (~e & g)) + _K[i] + w[i]) | 0;
                    const t2 = ((((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10))) + ((a & b) ^ (a & c) ^ (b & c))) | 0;
                    h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
                }
                h0 = (h0 + a) | 0; h1 = (h1 + b) | 0; h2 = (h2 + c) | 0; h3 = (h3 + d) | 0; h4 = (h4 + e) | 0; h5 = (h5 + f) | 0; h6 = (h6 + g) | 0; h7 = (h7 + h) | 0;
            }
            const out = new Uint8Array(32), ov = new DataView(out.buffer); [h0, h1, h2, h3, h4, h5, h6, h7].forEach((x, i) => ov.setUint32(i * 4, x >>> 0)); return out;
        }
        const _hex = a => [...a].map(x => x.toString(16).padStart(2, '0')).join('');
        function hashPass(pass, salt) {
            const enc = new TextEncoder(), s = enc.encode(salt); let h = sha256b(enc.encode(salt + ':' + pass));
            for (let i = 0; i < 20000; i++) { const m = new Uint8Array(32 + s.length); m.set(h); m.set(s, 32); h = sha256b(m); }
            return _hex(h);
        }
        function randBytes(n) { const a = new Uint8Array(n); if (window.crypto && crypto.getRandomValues) crypto.getRandomValues(a); else for (let i = 0; i < n; i++) a[i] = Math.floor(Math.random() * 256); return a; }
        const setUserPass = (u, p) => { u.salt = _hex(randBytes(16)); u.passHash = hashPass(p, u.salt); delete u.password; delete u.pin; };
        const checkUserPass = (u, p) => !!(u && u.passHash && u.salt) && hashPass(p, u.salt) === u.passHash;
        const isMgrUser = u => !!u && u.roleTitle === 'مدير';
        const minPassLen = u => isMgrUser(u) ? MGR_MIN : CASH_MIN;
        function passProblem(p, u) {
            if (!/^\d+$/.test(p)) return 'الباسورد أرقام فقط';
            if (p.length < minPassLen(u)) return `الباسورد لازم يكون ${minPassLen(u)} أرقام على الأقل`;
            if (p.length > PIN_MAX) return `الباسورد أقصى حد ${PIN_MAX} رقم`;
            if (/^(\d)\1+$/.test(p) || '01234567890123456789'.includes(p) || '98765432109876543210'.includes(p)) return 'الباسورد سهل التخمين، اختار أرقام مش متتالية ولا متكررة';
            return '';
        }
        const REC_AL = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        const normRec = s => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
        function makeRecovery(u) {
            const r = randBytes(16); let c = ''; r.forEach(x => { c += REC_AL[x % 32]; });
            u.recSalt = _hex(randBytes(16)); u.recHash = hashPass(c, u.recSalt);
            return c.match(/.{4}/g).join('-');
        }
        const checkRecovery = (u, code) => !!(u && u.recHash) && hashPass(normRec(code), u.recSalt) === u.recHash;

        let pinBuffer = '', failedAttempts = 0, loginUserId = null;
        let lockedUntil = Number((() => { try { return localStorage.getItem('tommy_lku'); } catch (e) { return 0; } })()) || 0;
        function registerFail() {
            failedAttempts++;
            if (failedAttempts < 5) { showToast('كلمة المرور غير صحيحة', 'error'); return; }
            let lv = 0; try { lv = Number(localStorage.getItem('tommy_lk')) || 0; } catch (e) {}
            lv++; const secs = 30 * Math.pow(2, Math.min(lv - 1, 7));
            lockedUntil = Date.now() + secs * 1000; failedAttempts = 0;
            try { localStorage.setItem('tommy_lk', lv); localStorage.setItem('tommy_lku', lockedUntil); } catch (e) {}
            const msg = document.getElementById('pin-lock-msg'); msg.textContent = `محاولات خاطئة متكررة! تم القفل لمدة ${secs >= 60 ? Math.round(secs / 60) + ' دقيقة' : secs + ' ثانية'}.`; msg.classList.remove('hidden');
            setTimeout(() => msg.classList.add('hidden'), secs * 1000);
        }
        const clearFails = () => { failedAttempts = 0; try { localStorage.removeItem('tommy_lk'); localStorage.removeItem('tommy_lku'); } catch (e) {} };
        function renderLoginUsers() {
            const el = document.getElementById('login-users'); if (!el) return;
            if (!loginUserId || !appState.users.some(u => u.id === loginUserId)) loginUserId = appState.users[0] && appState.users[0].id;
            el.innerHTML = appState.users.map(u => { const on = u.id === loginUserId;
                return `<button type="button" onclick="selectLoginUser('${u.id}')" class="flex flex-col items-center gap-1 rounded-2xl border px-2 py-3 text-center transition ${on ? 'border-gold bg-golddark/40 text-gold' : 'border-bordergold bg-darkbg text-gray-300 hover:border-gold/50'}"><svg class="ic w-6 h-6" viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/></svg><span class="text-xs font-black leading-tight">${esc(u.displayName)}</span><span class="text-[10px] opacity-70">${esc(u.roleTitle)}</span></button>`; }).join('');
            updatePinDots();
        }
        function selectLoginUser(id) { loginUserId = id; clearPin(); renderLoginUsers(); }
        function updatePinDots() {
            const d = document.getElementById('pin-dots'); if (!d) return;
            const n = Math.max(4, pinBuffer.length);
            { const f = document.getElementById('forgot-link'); if (f) { const u = appState.users.find(x => x.id === loginUserId); f.classList.toggle('hidden', !(u && isMgrUser(u) && u.recHash)); } }
            d.innerHTML = Array.from({ length: n }, (_, i) => `<span class="${i < pinBuffer.length ? 'w-3.5 h-3.5 rounded-full bg-gold' : 'w-3 h-3 rounded-full border border-gold/50'}"></span>`).join('');
        }
        function pressPin(d) {
            if (Date.now() < lockedUntil) return;
            if (pinBuffer.length >= PIN_MAX) return;
            pinBuffer += d; updatePinDots();
        }
        function backPin() { pinBuffer = pinBuffer.slice(0, -1); updatePinDots(); }
        function clearPin() { pinBuffer = ''; updatePinDots(); }
        function submitLogin() {
            if (Date.now() < lockedUntil) { showToast('الدخول مقفول مؤقتاً، استنى شوية', 'error'); return; }
            const user = appState.users.find(u => u.id === loginUserId); if (!user) return;
            if (!pinBuffer) { showToast('اكتب كلمة المرور', 'error'); return; }
            const ok = checkUserPass(user, pinBuffer); clearPin();
            if (!ok) { registerFail(); return; }
            clearFails(); document.getElementById('pin-lock-msg').classList.add('hidden');
            if (user.mustChange) forcePassChange(user, () => completeLogin(user)); else completeLogin(user);
        }
        document.addEventListener('keydown', e => {
            const a = document.getElementById('auth-screen'); if (!a || a.classList.contains('hidden') || document.getElementById('sec-box')) return;
            if (/^\d$/.test(e.key)) pressPin(e.key); else if (e.key === 'Backspace') backPin(); else if (e.key === 'Enter') submitLogin();
        });

        // ---- password change / recovery screens ----
        function secModal(title, html, okText, onOk, onCancel) {
            document.getElementById('sec-box')?.remove();
            const d = document.createElement('div'); d.id = 'sec-box'; d.className = 'fixed inset-0 z-[300] bg-black/85 flex items-center justify-center p-4';
            d.innerHTML = `<div class="bg-panelbg border border-bordergold rounded-2xl max-w-sm w-full p-5 space-y-3 text-sm"><h3 class="font-black text-gold">${title}</h3>${html}<div class="grid ${onCancel ? 'grid-cols-2' : 'grid-cols-1'} gap-2"><button type="button" id="sec-ok" class="bg-gold text-black font-black py-2.5 rounded-xl">${okText}</button>${onCancel ? '<button type="button" id="sec-no" class="bg-darkbg border border-bordergold text-gray-300 font-bold py-2.5 rounded-xl">رجوع</button>' : ''}</div></div>`;
            document.body.appendChild(d);
            d.querySelector('#sec-ok').onclick = () => { if (onOk(d) !== false) d.remove(); };
            if (onCancel) d.querySelector('#sec-no').onclick = () => { d.remove(); onCancel(); };
            const i = d.querySelector('input'); if (i) i.focus();
        }
        const _pi = (id, ph) => `<input id="${id}" type="password" inputmode="numeric" maxlength="${PIN_MAX}" autocomplete="off" dir="ltr" placeholder="${ph}" class="w-full bg-darkbg border border-bordergold rounded-xl px-3 py-2 text-gold font-black tracking-widest text-center">`;
        function showRecoveryCode(code, then) {
            secModal('كود الاسترجاع', `<p class="text-gray-300 leading-relaxed text-xs">ده الكود اللي يفتح لك البرنامج لو نسيت الباسورد. اكتبه على ورقة واحفظها في مكان آمن بره الصالون. <b class="text-red-400">مش هيظهر تاني</b>، وأي كود قديم بيبطل.</p><div dir="ltr" class="bg-darkbg border border-gold rounded-xl py-3 text-center font-mono font-black text-lg tracking-widest text-gold select-all">${code}</div><button type="button" onclick="navigator.clipboard&&navigator.clipboard.writeText('${code}').then(()=>showToast('تم النسخ'))" class="w-full bg-darkbg border border-bordergold text-gray-200 font-bold py-2 rounded-xl text-xs">نسخ الكود</button>`, 'كتبته وحفظته', () => { if (then) then(); });
        }
        function forcePassChange(user, done) {
            const mg = isMgrUser(user);
            secModal('لازم تغيّر كلمة المرور', `<p class="text-gray-300 text-xs leading-relaxed">كلمة المرور الحالية قديمة أو ضعيفة. اختار كلمة جديدة ${minPassLen(user)} أرقام على الأقل، من غير تكرار أو تسلسل.</p>${_pi('sp1', 'كلمة المرور الجديدة')}${_pi('sp2', 'اكتبها تاني للتأكيد')}`, 'حفظ ودخول', d => {
                const a = d.querySelector('#sp1').value, b = d.querySelector('#sp2').value, pr = passProblem(a, user);
                if (pr) { showToast(pr, 'error'); return false; }
                if (a !== b) { showToast('الكلمتين مش متطابقتين', 'error'); return false; }
                setUserPass(user, a); user.mustChange = false; const code = mg ? makeRecovery(user) : null;
                currentUser = user; logAudit(`تغيير كلمة مرور ${user.displayName}`); currentUser = null; saveState();
                if (code) setTimeout(() => showRecoveryCode(code, done), 50); else setTimeout(done, 50);
            }, () => {});
        }
        function forgotPassword() {
            const user = appState.users.find(u => u.id === loginUserId);
            if (!user || !isMgrUser(user) || !user.recHash) { showToast('مفيش كود استرجاع متسجل', 'error'); return; }
            secModal('استرجاع كلمة المرور', `<p class="text-gray-300 text-xs leading-relaxed">اكتب كود الاسترجاع اللي كتبته على الورقة، وبعدها اختار كلمة جديدة.</p><input id="sr0" dir="ltr" autocomplete="off" placeholder="XXXX-XXXX-XXXX-XXXX" class="w-full bg-darkbg border border-bordergold rounded-xl px-3 py-2 text-gold font-mono font-black tracking-widest text-center uppercase">${_pi('sr1', 'كلمة المرور الجديدة')}${_pi('sr2', 'اكتبها تاني للتأكيد')}`, 'تأكيد', d => {
                if (Date.now() < lockedUntil) { showToast('الدخول مقفول مؤقتاً، استنى شوية', 'error'); return false; }
                if (!checkRecovery(user, d.querySelector('#sr0').value)) { registerFail(); return false; }
                const a = d.querySelector('#sr1').value, b = d.querySelector('#sr2').value, pr = passProblem(a, user);
                if (pr) { showToast(pr, 'error'); return false; }
                if (a !== b) { showToast('الكلمتين مش متطابقتين', 'error'); return false; }
                clearFails(); setUserPass(user, a); user.mustChange = false; const code = makeRecovery(user);
                logAudit('استرجاع كلمة مرور المدير بكود الاسترجاع'); saveState(); setTimeout(() => showRecoveryCode(code, () => showToast('تم تغيير كلمة المرور، سجّل الدخول')), 50);
            }, () => {});
        }

        function migrateAuth() {
            let ch = false;
            if (appState.authVersion !== 2 && appState.authVersion !== 3) {
                const old = appState.users || [], A = p => Object.assign({ pos: true, invoices: true, clients: true, editInvoices: false, reports: false, catalog: false, barbers: false, attendance: true, finance: false, drawer: true, users: false, settings: false }, p || {});
                const isMgr = u => u.id === 'u-admin' || u.roleTitle === 'مدير' || u.username === 'admin';
                const mOld = old.find(isMgr) || {};
                const mgr = Object.assign({}, mOld, { id: mOld.id || 'u-admin', displayName: 'المدير', roleTitle: 'مدير', username: 'admin', password: '8800', permissions: { pos: true, invoices: true, clients: true, editInvoices: true, reports: true, catalog: true, barbers: true, attendance: true, finance: true, drawer: true, users: true, settings: true } });
                const c1 = { id: 'u-cashier1', displayName: 'كاشير 1', roleTitle: 'كاشير', username: 'cashier1', password: '1111', permissions: A() };
                const c2 = { id: 'u-cashier2', displayName: 'كاشير 2', roleTitle: 'كاشير', username: 'cashier2', password: '2222', permissions: A() };
                const others = old.filter(u => !isMgr(u) && !['u-omar', 'u-sara', 'u-cashier1', 'u-cashier2'].includes(u.id));
                appState.users = [mgr, c1, c2].concat(others); ch = true;
            }
            (appState.users || []).forEach(u => {
                if (u.password !== undefined && !u.passHash) { const p = String(u.password); setUserPass(u, p); u.mustChange = !!passProblem(p, u); ch = true; }
                else if (u.password !== undefined || u.pin !== undefined) { delete u.password; delete u.pin; ch = true; }
            });
            if (appState.authVersion !== 3) { appState.authVersion = 3; ch = true; }
            return ch;
        }
        if (migrateAuth()) saveState();

        function completeLogin(user) {
            if (user.permissions) { if (user.permissions.drawer === undefined) user.permissions.drawer = !!user.permissions.pos; }
            currentUser = user;
            document.getElementById('auth-screen').classList.add('hidden');
            document.getElementById('main-app').classList.remove('hidden');
            document.getElementById('header-user-badge').textContent = `${user.displayName} • ${user.roleTitle}`;

            let firstTab = null;
            document.querySelectorAll('.nav-btn').forEach(btn => {
                const perm = btn.getAttribute('data-perm');
                if (user.permissions && user.permissions[perm]) {
                    btn.classList.remove('hidden');
                    if (!firstTab) firstTab = perm;
                } else {
                    btn.classList.add('hidden');
                }
            });

            renderAll();
            if (firstTab) switchTab(firstTab);
        }

        function logoutUser() {
            currentUser = null; clearPin(); renderLoginUsers();
            document.getElementById('main-app').classList.add('hidden');
            document.getElementById('auth-screen').classList.remove('hidden');
        }

        function switchTab(tabId) {
            if (currentUser && currentUser.permissions && !currentUser.permissions[tabId]) {
                showToast('غير مصرح لك بالدخول لهذه الشاشة', 'error');
                return;
            }
            document.querySelectorAll('.view-section').forEach(s => s.classList.add('hidden'));
            document.querySelectorAll('.nav-btn').forEach(b => {
                b.className = 'nav-btn px-3.5 py-2 rounded-xl text-xs font-bold text-gray-300 hover:text-gold transition whitespace-nowrap shrink-0' + ((currentUser && currentUser.permissions && !currentUser.permissions[b.getAttribute('data-perm')]) ? ' hidden' : '');
            });
            document.getElementById(`view-${tabId}`)?.classList.remove('hidden');
            const activeBtn = document.getElementById(`tab-${tabId}`);
            if (activeBtn) {
                activeBtn.className = 'nav-btn px-3.5 py-2 rounded-xl text-xs font-black bg-gold text-black transition whitespace-nowrap shrink-0';
                activeBtn.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
            }
            document.getElementById('mobile-pos-bar').classList.toggle('hidden', tabId !== 'pos');
        }
