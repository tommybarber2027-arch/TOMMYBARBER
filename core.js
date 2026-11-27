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
        let pinBuffer = '', failedAttempts = 0, lockedUntil = 0, loginUserId = null;
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
            d.innerHTML = Array.from({ length: n }, (_, i) => `<span class="${i < pinBuffer.length ? 'w-3.5 h-3.5 rounded-full bg-gold' : 'w-3 h-3 rounded-full border border-gold/50'}"></span>`).join('');
        }
        function pressPin(d) {
            if (Date.now() < lockedUntil) return;
            if (pinBuffer.length >= 8) return;
            pinBuffer += d; updatePinDots();
            const u = appState.users.find(x => x.id === loginUserId);
            if (u && String(u.password).length === pinBuffer.length) setTimeout(submitLogin, 150);
        }
        function backPin() { pinBuffer = pinBuffer.slice(0, -1); updatePinDots(); }
        function clearPin() { pinBuffer = ''; updatePinDots(); }
        function submitLogin() {
            if (Date.now() < lockedUntil) return;
            const user = appState.users.find(u => u.id === loginUserId); if (!user) return;
            if (!pinBuffer) { showToast('اكتب كلمة المرور', 'error'); return; }
            if (String(user.password) !== pinBuffer) {
                failedAttempts++; clearPin();
                if (failedAttempts >= 5) {
                    lockedUntil = Date.now() + 30000; failedAttempts = 0;
                    const msg = document.getElementById('pin-lock-msg'); msg.textContent = 'محاولات خاطئة متكررة! تم القفل لمدة 30 ثانية.'; msg.classList.remove('hidden');
                    setTimeout(() => msg.classList.add('hidden'), 30000);
                } else showToast('كلمة المرور غير صحيحة', 'error');
                return;
            }
            failedAttempts = 0; document.getElementById('pin-lock-msg').classList.add('hidden'); clearPin(); completeLogin(user);
        }
        document.addEventListener('keydown', e => {
            const a = document.getElementById('auth-screen'); if (!a || a.classList.contains('hidden')) return;
            if (/^\d$/.test(e.key)) pressPin(e.key); else if (e.key === 'Backspace') backPin(); else if (e.key === 'Enter') submitLogin();
        });
        function migrateAuth() {
            if (appState.authVersion === 2) return false;
            const old = appState.users || [], A = p => Object.assign({ pos: true, invoices: true, clients: true, editInvoices: false, reports: false, catalog: false, barbers: false, attendance: true, users: false, settings: false, expenses: false }, p || {});
            const isMgr = u => u.id === 'u-admin' || u.roleTitle === 'مدير' || u.username === 'admin';
            const mOld = old.find(isMgr) || {};
            const mgr = Object.assign({}, mOld, { id: mOld.id || 'u-admin', displayName: 'المدير', roleTitle: 'مدير', username: 'admin', password: '8800', pin: '8800', permissions: { pos: true, invoices: true, clients: true, editInvoices: true, reports: true, catalog: true, barbers: true, attendance: true, users: true, settings: true, expenses: true } });
            const c1 = { id: 'u-cashier1', displayName: 'كاشير 1', roleTitle: 'كاشير', username: 'cashier1', password: '1111', pin: '1111', permissions: A() };
            const c2 = { id: 'u-cashier2', displayName: 'كاشير 2', roleTitle: 'كاشير', username: 'cashier2', password: '2222', pin: '2222', permissions: A() };
            const others = old.filter(u => !isMgr(u) && !['u-omar', 'u-sara', 'u-cashier1', 'u-cashier2'].includes(u.id));
            appState.users = [mgr, c1, c2].concat(others); appState.authVersion = 2; return true;
        }
        if (migrateAuth()) saveState();

        function completeLogin(user) {
            if (user.permissions && user.permissions.expenses === undefined) user.permissions.expenses = (user.roleTitle === 'مدير');
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
