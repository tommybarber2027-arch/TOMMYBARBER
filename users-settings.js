        // 6. USERS & 7. SETTINGS
        function renderUsersManage() {
            document.getElementById('users-manage-grid').innerHTML = appState.users.map(u => `
                <div class="bg-panelbg border border-bordergold rounded-2xl p-4 space-y-2 text-xs">
                    <div class="flex justify-between items-center">
                        <h4 class="font-black text-white text-sm">${u.displayName}</h4>
                        <span class="px-2.5 py-0.5 rounded-full bg-golddark border border-gold/40 text-gold font-bold">${u.roleTitle}</span>
                    </div>
                    <p class="text-gray-400 font-mono">${u.mustChange ? '<b class="text-red-400">لازم يغيّر كلمة المرور</b>' : 'كلمة المرور محفوظة مشفّرة'}</p>
                    <div class="grid grid-cols-2 gap-2"><button onclick="openUserModal('${u.id}')" class="py-2 rounded-xl border border-bordergold bg-darkbg hover:border-gold text-gray-300 font-bold">تعديل الصلاحيات</button>${isMgrUser(u) ? '' : `<button onclick="deleteUser('${u.id}')" class="py-2 rounded-xl border border-red-800/60 bg-red-950/30 text-red-300 hover:bg-red-900/50 font-bold">حذف المستخدم</button>`}</div>
                </div>
            `).join('');
        }

        function openUserModal(id = null) {
            const permsKeys = ['pos', 'invoices', 'clients', 'editInvoices', 'reports', 'catalog', 'barbers', 'attendance', 'drawer', 'endShift', 'bookings', 'finance', 'users', 'settings', 'archive', 'partners'];
            if (id) {
                const u = appState.users.find(x => x.id === id);
                if (!u) return;
                document.getElementById('edit-user-id').value = u.id;
                document.getElementById('edit-user-display').value = u.displayName || '';
                { const e = document.getElementById('edit-user-display-en'); e.value = u.displayNameEn || ''; e.dataset.manual = u.displayNameEn ? '1' : ''; }
                document.getElementById('edit-user-role').value = u.roleTitle || 'كاشير';
                document.getElementById('edit-user-username').value = u.username || '';
                document.getElementById('edit-user-password').value = '';
                document.getElementById('edit-user-pin').value = '';
                permsKeys.forEach(p => { const cb = document.getElementById(`perm-${p}`); if (cb) cb.checked = !!(u.permissions && u.permissions[p]); });
            } else {
                if (appState.users.length >= 12) { showToast('وصلت للحد الأقصى من المستخدمين', 'error'); return; }
                document.getElementById('edit-user-id').value = '';
                document.getElementById('edit-user-display').value = '';
                { const e = document.getElementById('edit-user-display-en'); e.value = ''; e.dataset.manual = ''; }
                document.getElementById('edit-user-role').value = 'كاشير';
                document.getElementById('edit-user-username').value = '';
                document.getElementById('edit-user-password').value = '';
                document.getElementById('edit-user-pin').value = '';
                permsKeys.forEach(p => { const cb = document.getElementById(`perm-${p}`); if (cb) cb.checked = (p === 'pos' || p === 'invoices' || p === 'clients'); });
            }
            userRoleChanged(!id); { const u0 = id ? appState.users.find(x => x.id === id) : null; const ps = document.getElementById('edit-user-partner'); if (ps && u0 && u0.partnerId) ps.value = u0.partnerId; }
            document.getElementById('user-modal').classList.remove('hidden');
        }
        function userRoleChanged(applyDefaults) {
            const r = document.getElementById('edit-user-role').value, w = document.getElementById('edit-user-partner-wrap'), ps = document.getElementById('edit-user-partner');
            if (ps) ps.innerHTML = ptData().list.map(p => `<option value="${p.id}">${esc(p.name)}</option>`).join('');
            if (w) w.classList.toggle('hidden', r !== 'شريك');
            if (applyDefaults === true && r === 'شريك') ['pos', 'invoices', 'clients', 'reports', 'bookings', 'partners'].forEach(p => { const cb = document.getElementById('perm-' + p); if (cb) cb.checked = true; });
        }

        function saveUser(e) {
            e.preventDefault();
            const id = document.getElementById('edit-user-id').value;
            const permsKeys = ['pos', 'invoices', 'clients', 'editInvoices', 'reports', 'catalog', 'barbers', 'attendance', 'drawer', 'endShift', 'bookings', 'finance', 'users', 'settings', 'archive', 'partners'];
            const perms = {};
            permsKeys.forEach(p => { const cb = document.getElementById(`perm-${p}`); perms[p] = cb ? cb.checked : false; });
            const username = document.getElementById('edit-user-username').value.trim() || ('u' + Date.now());
            const pwd = document.getElementById('edit-user-password').value.trim();
            const roleSel = document.getElementById('edit-user-role').value, tgt = id ? appState.users.find(x => x.id === id) : null;
            if (currentUser && !isMgrUser(currentUser) && (roleSel === 'مدير' || roleSel === 'شريك' || (tgt && (isMgrUser(tgt) || tgt.roleTitle === 'شريك')))) { showToast('إدارة المدير والشركاء للمدير العام بس', 'error'); return; }
            if (roleSel === 'شريك' && !document.getElementById('edit-user-partner').value) { showToast('اختار الشريك المربوط', 'error'); return; }
            if (tgt && isMgrUser(tgt) && roleSel !== 'مدير') { showToast('مينفعش تغيّر وظيفة المدير', 'error'); return; }
            if (!id && roleSel === 'مدير' && appState.users.some(isMgrUser)) { showToast('فيه مدير واحد بس', 'error'); return; }
            if (!id || pwd) { const pr = passProblem(pwd, { roleTitle: roleSel }); if (pr) { showToast(pr, 'error'); return; } }

            if (appState.users.some(u => u.id !== id && (u.username.toLowerCase() === username.toLowerCase()))) {
                showToast('اسم المستخدم مستخدم بالفعل', 'error');
                return;
            }

            const _dn = document.getElementById('edit-user-display').value.trim(), data = { displayName: _dn, displayNameEn: document.getElementById('edit-user-display-en').value.trim() || (hasAr(_dn) ? trAr2En(_dn) : _dn), roleTitle: document.getElementById('edit-user-role').value, username, permissions: perms, partnerId: document.getElementById('edit-user-role').value === 'شريك' ? document.getElementById('edit-user-partner').value : undefined };
            let newRec = null;
            if (id) {
                const targetUser = appState.users.find(x => x.id === id);
                if (targetUser) {
                    Object.assign(targetUser, data);
                    if (pwd) { setUserPass(targetUser, pwd); targetUser.mustChange = false; if (isMgrUser(targetUser)) newRec = makeRecovery(targetUser); }
                    logAudit(`تعديل صلاحيات المستخدم: ${data.displayName}`);
                    if (currentUser && currentUser.id === id) {
                        currentUser = targetUser;
                        document.getElementById('header-user-badge').textContent = `${targetUser.displayName} • ${targetUser.roleTitle}`;
                        document.querySelectorAll('.nav-btn').forEach(btn => {
                            const perm = btn.getAttribute('data-perm');
                            btn.classList.toggle('hidden', !(targetUser.permissions && targetUser.permissions[perm]));
                        });
                    }
                }
            } else {
                const nu = { id: 'u-' + Date.now(), ...data }; setUserPass(nu, pwd); appState.users.push(nu);
                logAudit(`إضافة مستخدم جديد: ${data.displayName}`);
            }
            saveState(); closeModal('user-modal'); renderAll(); showToast('تم حفظ بيانات وصلاحيات المستخدم بنجاح'); if (newRec) showRecoveryCode(newRec);
        }

        function renderRoles() {
            const el = document.getElementById('roles-list'); if (!el) return;
            el.innerHTML = roles().map(r => `<div class="flex items-center justify-between bg-darkbg border border-bordergold/60 rounded-xl px-3 py-2"><span class="text-white font-bold">${esc(r.label)} ${r.perf ? '<span class="text-[10px] text-gold">• بتعمل خدمات</span>' : ''}</span><button type="button" onclick="delRole('${r.id}')" class="text-gray-500 hover:text-red-400">حذف</button></div>`).join('');
        }
        function addRole() {
            const n = document.getElementById('new-role-name').value.trim(); if (!n) return;
            if (!appState.roles) appState.roles = JSON.parse(JSON.stringify(DEFAULT_ROLES));
            appState.roles.push({ id: 'r' + Date.now(), label: n, perf: document.getElementById('new-role-perf').checked });
            document.getElementById('new-role-name').value = ''; logAudit('إضافة وظيفة: ' + n); saveState(); renderAll(); showToast('تمت إضافة الوظيفة');
        }
        function delRole(id) {
            if (appState.barbers.some(b => (b.role || 'barber') === id)) return showToast('في موظفين على الوظيفة دي، غيّر وظيفتهم الأول', 'error');
            if (!appState.roles) appState.roles = JSON.parse(JSON.stringify(DEFAULT_ROLES));
            appState.roles = appState.roles.filter(r => r.id !== id); saveState(); renderAll();
        }

        function renderSettings() {
            { const a = document.getElementById('set-late-mode'), b = document.getElementById('set-late-deduct'); if (a) a.value = appState.salonInfo.lateMode || 'full'; if (b) b.value = appState.salonInfo.lateDeduct || 'track'; }
            renderRoles();
            if (/tommy|تومي|بربر|باربر/i.test(appState.salonInfo.name || '')) appState.salonInfo.name = 'TOMMY BARBER';
            document.getElementById('header-salon-name').textContent = (appState.salonInfo.name || 'TOMMY BARBER').toUpperCase();
            document.getElementById('header-salon-sub').textContent = appState.salonInfo.sub || 'صالون رجالي';
            document.getElementById('set-name').value = appState.salonInfo.name;
            document.getElementById('set-sub').value = appState.salonInfo.sub || 'صالون رجالي';
            document.getElementById('set-address').value = appState.salonInfo.address;
            document.getElementById('set-phone').value = appState.salonInfo.phone;
            document.getElementById('set-payment-numbers').value = appState.salonInfo.paymentNumbers || '';
            setInvForm(getInvSettings()); applyPaper(getInvSettings()); showSettingsPanel(setPanel);

            document.getElementById('audit-log-box').innerHTML = appState.auditLogs.slice(0, 30).map(a => `
                <div class="bg-darkbg border border-bordergold/50 rounded-xl p-2.5 flex justify-between items-center">
                    <span><b class="text-gold">${a.user}:</b> ${a.text}</span>
                    <span class="text-[10px] text-gray-500">${a.time}</span>
                </div>
            `).join('');
        }

        function saveSalonSettings(e) {
            if (e) e.preventDefault();
            if (!currentUser?.permissions?.settings) { showToast('غير مصرح لك', 'error'); return; }
            { const a = document.getElementById('set-late-mode'), b = document.getElementById('set-late-deduct'); if (a) appState.salonInfo.lateMode = a.value; if (b) appState.salonInfo.lateDeduct = b.value; }
            appState.salonInfo.name = document.getElementById('set-name').value.trim().toUpperCase();
            appState.salonInfo.sub = document.getElementById('set-sub').value.trim();
            appState.salonInfo.address = document.getElementById('set-address').value.trim();
            appState.salonInfo.phone = document.getElementById('set-phone').value.trim();
            appState.salonInfo.paymentNumbers = document.getElementById('set-payment-numbers').value.trim();
            saveState(); renderSettings(); showToast('تم حفظ الإعدادات');
        }

        function openResetOperationalModal() {
            if (!currentUser?.permissions?.settings) { showToast('غير مصرح لك بتنفيذ هذه العملية', 'error'); return; }
            confirmDanger('بداية جديدة: هيتمسح كل الفواتير (والترقيم يرجع لـ1)، والشيفتات والدرج والخزنة، والمصاريف والسلف، والحضور، والحجوزات، وسجل المراجعة. هيفضل زي ما هو: الحلاقين، العملاء، الخدمات والأسعار، المستخدمين، الإعدادات، والأرشيف.', executeOperationalReset, 'ابدأ من جديد');
        }

        function executeOperationalReset() {
            appState.invoices = []; appState.lastInvId = 0;
            appState.attendanceRecords = {}; appState.attendanceLog = {};
            appState.advances = []; appState.expenses = [];
            appState.finExpenses = []; appState.finAdv = [];
            appState.shifts = []; appState.vaultAdj = []; appState.vaultBase = 0; appState.bookings = [];
            appState.auditLogs = [];
            window.__handover = false;
            logAudit('بداية جديدة: تصفير الفواتير والشيفتات والخزنة والمصاريف والحجوزات مع الاحتفاظ بالأساسيات');
            try { ensureShift(); } catch (e) { }
            saveState(); resetCurrentInvoice(); renderAll(); closeModal('reset-ops-modal');
            showToast('تمت البداية الجديدة. الأساسيات محفوظة والباقي اتصفّر');
        }

        function downloadFullBackup() {
            const blob = new Blob([JSON.stringify(appState, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a'); a.href = url; a.download = `TOMMY_BARBER_Backup_${getTodayISO()}.json`; a.click(); URL.revokeObjectURL(url);
            showToast('تم تحميل النسخة الاحتياطية بنجاح');
        }

        function restoreFullBackup(e) {
            const file = e.target.files?.[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (ev) => {
                try {
                    const parsed = JSON.parse(ev.target.result);
                    if (!parsed || !parsed.catalog || !parsed.barbers) { showToast('ملف النسخة الاحتياطية غير صالح', 'error'); return; }
                    appState = { ...JSON.parse(JSON.stringify(defaultState)), ...parsed }; migrateAuth();
                    logAudit('تم استرجاع نسخة احتياطية لقاعدة البيانات'); saveState(); renderAll();
                    showToast('تم استرجاع جميع البيانات بنجاح!');
                } catch (err) { showToast('حدث خطأ أثناء قراءة الملف', 'error'); }
            };
            reader.readAsText(file);
            e.target.value = '';
        }

        const DEFAULT_ACCOUNTS = [
            {id:'g-fixed',name:'مصروفات ثابتة',parent:null},{id:'a-rent',name:'إيجار المحل',parent:'g-fixed'},
            {id:'g-util',name:'المرافق والاتصالات',parent:null},{id:'a-elec',name:'كهرباء',parent:'g-util'},{id:'a-water',name:'مياه',parent:'g-util'},{id:'a-net',name:'إنترنت',parent:'g-util'},{id:'a-tel',name:'تليفون أرضي',parent:'g-util'},
            {id:'g-clean',name:'النظافة',parent:null},{id:'a-cleaner',name:'نظافة المكان',parent:'g-clean'},{id:'a-cleansup',name:'أدوات ومواد تنظيف',parent:'g-clean'},
            {id:'g-sup',name:'مستلزمات الصالون',parent:null},{id:'a-tools',name:'أدوات حلاقة',parent:'g-sup'},{id:'a-mat',name:'خامات ومنتجات (صبغات، كريمات...)',parent:'g-sup'},{id:'a-cafe',name:'مستلزمات الكافيه',parent:'g-sup'},
            {id:'g-maint',name:'صيانة وتجهيزات',parent:null},{id:'a-maint',name:'صيانة وإصلاحات',parent:'g-maint'},{id:'a-equip',name:'معدات وأثاث',parent:'g-maint'},
            {id:'g-staff',name:'العمالة',parent:null},{id:'a-adv',name:'سلف الموظفين',parent:'g-staff',adv:true},{id:'a-bonus',name:'مكافآت وحوافز',parent:'g-staff'},
            {id:'g-other',name:'مصروفات أخرى',parent:null},{id:'a-misc',name:'نثريات',parent:'g-other'},{id:'a-fees',name:'رسوم وضرائب',parent:'g-other'}];
        let expMonth = '';
        const byId = id => document.getElementById(id);
        const accounts = () => (appState.accounts && appState.accounts.length ? appState.accounts : DEFAULT_ACCOUNTS);
        const ownAccounts = () => { if (!appState.accounts || !appState.accounts.length) appState.accounts = JSON.parse(JSON.stringify(DEFAULT_ACCOUNTS)); return appState.accounts; };
        const accName = id => { const a = accounts().find(x => x.id === id); if (!a) return 'حساب محذوف'; const p = a.parent && accounts().find(x => x.id === a.parent); return (p ? p.name + ' › ' : '') + a.name; };
        const isAdvAcc = id => !!(accounts().find(x => x.id === id) || {}).adv;
        function onExpAccChange() { const v = byId('exp-acc').value; byId('exp-emp-wrap').classList.toggle('hidden', !isAdvAcc(v)); byId('exp-new-wrap').classList.toggle('hidden', v !== '__new'); }
        let editingExp = null;
        function renderExpenses() {
            if (!byId('view-expenses')) return;
            const m = expMonth || getTodayISO().slice(0, 7); byId('exp-month').value = m;
            if (!byId('exp-date').value) byId('exp-date').value = getTodayISO();
            const ex = (appState.expenses || []).filter(e => (e.date || '').startsWith(m)).sort((a, b) => (b.date || '').localeCompare(a.date || '') || String(b.id).localeCompare(String(a.id)));
            const sum = l => l.reduce((s, e) => s + Number(e.amount || 0), 0), advs = ex.filter(e => isAdvAcc(e.accId)), opx = ex.filter(e => !isAdvAcc(e.accId));
            const rev = appState.invoices.filter(i => !i.deleted && (i.date || '').startsWith(m)).reduce((s, i) => s + Number(i.total || 0), 0), net = rev - sum(opx) - sum(advs);
            const card = (l, v, c) => `<div class="bg-panelbg border border-bordergold rounded-2xl p-3.5"><span class="text-[11px] text-gray-400 block">${l}</span><span class="text-xl font-black ${c}">${fmt(v)} ج.م</span></div>`;
            byId('exp-summary').innerHTML = card('إيرادات الشهر', rev, 'text-white') + card('مصاريف الصالون', sum(opx), 'text-red-400') + card('سلف الموظفين', sum(advs), 'text-amber-400') + card('الصافي (إيرادات - مصاريف - سلف)', net, net >= 0 ? 'text-gold' : 'text-red-400');
            const A = accounts(), sel = byId('exp-acc'), cur = sel.value;
            sel.innerHTML = '<option value="__new">+ بند جديد مش موجود في القايمة</option>' + A.filter(a => !a.parent).map(g => `<optgroup label="${esc(g.name)}">${A.filter(a => a.parent === g.id).map(a => `<option value="${a.id}">${esc(a.name)}</option>`).join('')}</optgroup>`).join('');
            if (cur && (cur === '__new' || A.some(a => a.id === cur))) sel.value = cur; else if (!cur) sel.value = 'a-misc' in Object.fromEntries(A.map(a => [a.id, 1])) ? 'a-misc' : sel.value;
            byId('exp-new-group').innerHTML = A.filter(a => !a.parent).map(g => `<option value="${g.id}">في مجموعة: ${esc(g.name)}</option>`).join('');
            byId('exp-emp').innerHTML = appState.barbers.map(b => `<option value="${b.id}">${esc(b.name)}</option>`).join('');
            onExpAccChange();
            const tot = sum(ex) || 1;
            byId('exp-breakdown').innerHTML = A.filter(a => !a.parent).map(g => {
                const kids = A.filter(a => a.parent === g.id), rows = kids.map(k => ({ k, v: sum(ex.filter(e => e.accId === k.id)) })).filter(r => r.v > 0), gv = rows.reduce((s, r) => s + r.v, 0);
                if (!gv) return '';
                return `<div><div class="flex justify-between font-black text-white"><span>${esc(g.name)}</span><span class="text-gold">${fmt(gv)} ج.م</span></div><div class="h-1.5 bg-darkbg rounded-full my-1 overflow-hidden"><div class="h-full bg-gold" style="width:${Math.round(gv / tot * 100)}%"></div></div>${rows.map(r => `<div class="flex justify-between text-gray-400 pr-3"><span>${esc(r.k.name)}</span><span>${fmt(r.v)}</span></div>`).join('')}</div>`;
            }).join('') || '<p class="text-gray-500 text-center py-4">مفيش مصاريف في الشهر ده</p>';
            const payL = { cash: 'نقدي', visa: 'إنستا باي', wallet: 'محفظة' };
            byId('exp-list').innerHTML = ex.map(e => `<tr><td class="p-2 font-mono text-gray-400 whitespace-nowrap">${e.date}</td><td class="p-2 text-white">${esc(accName(e.accId))}<div class="text-[11px] text-gray-500">${esc(e.note || '')}${e.empId ? ' • ' + esc(empName2(e.empId)) : ''} • ${payL[e.pay] || ''}</div></td><td class="p-2 font-black ${isAdvAcc(e.accId) ? 'text-amber-400' : 'text-red-400'} whitespace-nowrap">${fmt(e.amount)}</td><td class="p-2 whitespace-nowrap"><button type="button" onclick="editExpense('${e.id}')" class="text-gray-400 hover:text-gold ml-2">تعديل</button><button type="button" onclick="delExpense('${e.id}')" class="text-gray-500 hover:text-red-400">حذف</button></td></tr>`).join('') || '<tr><td class="p-4 text-center text-gray-500">لا توجد حركات</td></tr>';
            byId('accounts-tree').innerHTML = A.filter(a => !a.parent).map(g => `<div class="bg-darkbg border border-bordergold/70 rounded-xl p-3 space-y-1.5"><div class="flex items-center justify-between gap-2"><b class="text-gold">${esc(g.name)}</b><span class="flex gap-2 text-gray-400"><button type="button" onclick="renameAccount('${g.id}')" class="hover:text-gold">تعديل</button><button type="button" onclick="addAccount('${g.id}')" class="hover:text-gold">+ حساب</button><button type="button" onclick="deleteAccount('${g.id}')" class="hover:text-red-400">حذف</button></span></div>${A.filter(a => a.parent === g.id).map(a => `<div class="flex items-center justify-between pr-3 text-gray-300"><span>${esc(a.name)}${a.adv ? ' <span class="text-[10px] text-amber-400">(بتتخصم من المرتب)</span>' : ''}</span><span class="flex gap-2 text-gray-500"><button type="button" onclick="renameAccount('${a.id}')" class="hover:text-gold">تعديل</button><button type="button" onclick="deleteAccount('${a.id}')" class="hover:text-red-400">حذف</button></span></div>`).join('')}</div>`).join('');
        }
        const empName2 = id => (appState.barbers.find(b => b.id === id) || {}).name || '';
        function addExpense(e) {
            e.preventDefault();
            let accId = byId('exp-acc').value; const amount = Number(byId('exp-amount').value), date = byId('exp-date').value || getTodayISO();
            if (!(amount > 0)) return showToast('اكتب المبلغ', 'error');
            if (accId === '__new') {
                const n = byId('exp-new-name').value.trim(); if (!n) return showToast('اكتب اسم البند الجديد', 'error');
                const na = { id: 'a' + Date.now(), name: n, parent: byId('exp-new-group').value }; ownAccounts().push(na); accId = na.id; byId('exp-new-name').value = '';
            }
            if (!accounts().some(a => a.id === accId)) return showToast('اختار الحساب', 'error');
            const note = byId('exp-note').value.trim(), pay = byId('exp-pay').value, adv = isAdvAcc(accId); let st = null;
            if (adv) { st = appState.barbers.find(b => b.id === byId('exp-emp').value); if (!st) return showToast('اختار الموظف', 'error'); }
            const old = editingExp ? (appState.expenses || []).find(x => x.id === editingExp) : null, rec = old || { id: 'ex-' + Date.now() };
            Object.assign(rec, { date, accId, amount, pay, note });
            appState.advances = appState.advances || [];
            if (adv) {
                const a = rec.advId && appState.advances.find(x => x.id === rec.advId);
                if (a) Object.assign(a, { staffId: st.id, staffName: st.name, amount, reason: note || 'سلفة', date });
                else { rec.advId = 'adv-' + Date.now(); appState.advances.unshift({ id: rec.advId, staffId: st.id, staffName: st.name, amount, reason: note || 'سلفة', date }); }
                rec.empId = st.id; rec.note = note || ('سلفة - ' + st.name);
            } else if (rec.advId) { appState.advances = appState.advances.filter(x => x.id !== rec.advId); delete rec.advId; delete rec.empId; }
            if (!old) (appState.expenses = appState.expenses || []).unshift(rec);
            logAudit((old ? 'تعديل' : 'تسجيل') + ' مصروف ' + amount + ' ج.م على ' + accName(accId));
            editingExp = null; byId('exp-amount').value = ''; byId('exp-note').value = ''; byId('exp-submit').textContent = 'تسجيل'; byId('exp-cancel').classList.add('hidden');
            saveState(); renderAll(); showToast(old ? 'تم حفظ التعديل' : 'تم التسجيل');
        }
        function editExpense(id) {
            const x = (appState.expenses || []).find(e => e.id === id); if (!x) return;
            editingExp = id; byId('exp-date').value = x.date; byId('exp-acc').value = x.accId; onExpAccChange();
            if (x.empId) byId('exp-emp').value = x.empId; byId('exp-amount').value = x.amount; byId('exp-pay').value = x.pay || 'cash'; byId('exp-note').value = x.advId ? (x.note || '') : (x.note || '');
            byId('exp-submit').textContent = 'حفظ التعديل'; byId('exp-cancel').classList.remove('hidden'); byId('exp-date').scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        function cancelExpEdit() { editingExp = null; byId('exp-amount').value = ''; byId('exp-note').value = ''; byId('exp-submit').textContent = 'تسجيل'; byId('exp-cancel').classList.add('hidden'); }
        function delExpense(id) {
            const x = (appState.expenses || []).find(e => e.id === id); if (!x) return;
            askConfirm('تحذف الحركة دي؟' + (x.advId ? ' (السلفة هترجع للموظف في المرتب)' : ''), () => {
                appState.expenses = appState.expenses.filter(e => e.id !== id); if (x.advId) appState.advances = (appState.advances || []).filter(a => a.id !== x.advId);
                if (editingExp === id) cancelExpEdit(); logAudit('حذف مصروف ' + x.amount + ' ج.م'); saveState(); renderAll();
            }, 'احذف');
        }
        function addAccount(parent) {
            askInput(parent ? 'اسم الحساب الجديد' : 'اسم المجموعة الجديدة', '', n => { ownAccounts().push({ id: (parent ? 'a' : 'g') + Date.now(), name: n, parent }); saveState(); renderAll(); });
        }
        function renameAccount(id) { const a = ownAccounts().find(x => x.id === id); askInput('الاسم الجديد', a.name, n => { a.name = n; saveState(); renderAll(); }); }
        function deleteAccount(id) {
            const A = ownAccounts(), a = A.find(x => x.id === id);
            if (a.adv) return showToast('حساب السلف أساسي ومينفعش يتحذف', 'error');
            if (A.some(x => x.parent === id)) return showToast('احذف الحسابات اللي جواه الأول', 'error');
            if ((appState.expenses || []).some(e => e.accId === id)) return showToast('عليه حركات مسجلة، مينفعش يتحذف', 'error');
            askConfirm('تحذف الحساب ' + esc(a.name) + '؟', () => { appState.accounts = A.filter(x => x.id !== id); saveState(); renderAll(); }, 'احذف');
        }
        function printStatement(id) {
            const st = appState.barbers.find(b => b.id === id); if (!st) return; const m = payrollMonth;
            const c = calculateStaffPayroll(st, appState.invoices.filter(i => !i.deleted && (i.date || '').startsWith(m)));
            const advs = (appState.advances || []).filter(a => a.staffId === id && (a.date || '').startsWith(m)).sort((a, b) => a.date.localeCompare(b.date));
            const days = Object.entries(appState.attendanceRecords || {}).filter(([d, mp]) => d.startsWith(m) && mp && mp[id]).sort((a, b) => a[0].localeCompare(b[0]));
            const R = (a, b, cls = '') => `<tr class="${cls}"><td>${a}</td><td class="n">${b}</td></tr>`;
            const stt = r => r.status === 'present' ? `حضور ${r.checkIn || ''}${r.checkOut ? ' - انصراف ' + r.checkOut : ''}${r.lateMinutes > 0 ? ' (تأخير ' + fmtDur(r.lateMinutes) + ')' : ''}` : (r.status === 'absent' ? 'غياب' : 'إجازة');
            const html = `<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>كشف حساب ${esc(st.name)}</title><style>body{font-family:Tahoma,Arial,sans-serif;margin:24px;color:#111}h1{margin:0;font-size:22px;letter-spacing:2px}h2{font-size:15px;margin:18px 0 6px;border-bottom:2px solid #111;padding-bottom:3px}table{width:100%;border-collapse:collapse;font-size:13px}td{padding:5px 6px;border-bottom:1px solid #ccc;text-align:right}.n{text-align:left;white-space:nowrap}.tot td{font-weight:bold;border-top:2px solid #111;font-size:15px}.m{color:#555;font-size:12px}.sg{margin-top:40px;display:flex;justify-content:space-between;font-size:13px}</style></head><body><h1>${esc((appState.salonInfo.name || 'TOMMY BARBER').toUpperCase())}</h1><div class="m">كشف حساب موظف - شهر ${m}</div><h2>${esc(st.name)} - ${esc(roleLabel(st.role || 'barber'))}</h2>
<table>${R('الراتب الأساسي', fmt(c.baseSalary) + ' ج.م')}${R('عمولة الخدمات', fmt(c.regularComm) + ' ج.م')}${R('عمولة البشرة والعناية', fmt(c.careComm) + ' ج.م')}${R('خصم الغياب (' + c.absentDays + ' يوم)', '- ' + fmt(c.absenceDeduction) + ' ج.م')}${R('تأخير الشهر: ' + fmtDur(c.lateMinutes) + ' (بعد السماح ' + fmtDur(c.chargeMinutes) + ')', '- ' + fmt(c.lateDeduction) + ' ج.م')}${R('السلف (' + advs.length + ')', '- ' + fmt(c.advancesTotal) + ' ج.م')}${R('الصافي المستحق', fmt(c.netPayable) + ' ج.م', 'tot')}</table>
<h2>السلف والخصومات</h2><table>${advs.map(a => R(a.date + ' - ' + esc(a.reason || 'سلفة'), fmt(a.amount) + ' ج.م')).join('') || R('لا توجد سلف', '-')}</table>
<h2>سجل الحضور</h2><table>${days.map(([d, mp]) => R(d, stt(mp[id]))).join('') || R('لا يوجد تسجيل', '-')}</table>
<div class="sg"><span>توقيع الموظف: ________________</span><span>توقيع المدير: ________________</span></div><script>onload=()=>setTimeout(()=>print(),300)<\/script></body></html>`;
            const w = window.open('', '_blank'); if (!w) return showToast('اسمح بالنوافذ المنبثقة عشان تطبع الكشف', 'error');
            w.document.write(window.i18nHtml ? window.i18nHtml(html) : html); w.document.close();
        }
        let deferredInstall = null;
        window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredInstall = e; byId('install-btn')?.classList.remove('hidden'); });
        function installApp() { if (!deferredInstall) return; deferredInstall.prompt(); deferredInstall.userChoice.finally(() => { deferredInstall = null; byId('install-btn')?.classList.add('hidden'); }); }
        function askBox(title, bodyHtml, onOk, okText = 'موافق') {
            byId('ask-box')?.remove();
            const d = document.createElement('div'); d.id = 'ask-box'; d.className = 'fixed inset-0 z-[150] bg-black/80 flex items-center justify-center p-4';
            d.innerHTML = `<div class="bg-panelbg border border-bordergold rounded-2xl max-w-sm w-full p-5 space-y-4 text-sm"><h3 class="font-black text-gold">${title}</h3>${bodyHtml}<div class="grid grid-cols-2 gap-2"><button type="button" id="ask-ok" class="bg-gold text-black font-black py-2.5 rounded-xl">${okText}</button><button type="button" id="ask-no" class="bg-darkbg border border-bordergold text-gray-300 font-bold py-2.5 rounded-xl">إلغاء</button></div></div>`;
            document.body.appendChild(d);
            const close = () => d.remove(), go = () => { if (onOk(d) !== false) close(); };
            d.querySelector('#ask-no').onclick = close; d.querySelector('#ask-ok').onclick = go;
            const i = d.querySelector('input'); if (i) { i.focus(); i.addEventListener('keydown', e => { if (e.key === 'Enter') go(); }); }
        }
        const askConfirm = (msg, yes, okText) => askBox('تأكيد', `<p class="text-gray-200 leading-relaxed">${msg}</p>`, () => { yes(); }, okText || 'تأكيد');
        const askInput = (title, val, cb, type = 'text') => askBox(title, `<input id="ask-in" type="${type}" value="${esc(val || '')}" class="w-full bg-darkbg border border-bordergold rounded-xl px-3 py-2 text-white">`, d => { const v = d.querySelector('#ask-in').value.trim(); if (!v) return false; cb(v); });
        function fmtDur(min) { min = Math.round(min || 0); if (min <= 0) return '0 د'; if (min < 60) return min + ' د'; const h = Math.floor(min / 60), m = min % 60; return h + ' ساعة' + (m ? ' و' + m + ' د' : ''); }
        function sessionsOf(rec) { return [{ in12: rec.checkIn, in24: rec.checkIn24, out12: rec.checkOut, out24: rec.checkOut24, early: rec.earlyMinutes || 0 }].concat(rec.extra || []); }
        function workedMin(rec) { return sessionsOf(rec).reduce((s, x) => { if (!x.in24 || !x.out24) return s; let d = toMin(x.out24) - toMin(x.in24); if (d < 0) d += 1440; return s + d; }, 0); }
        function undoLast(id) {
            if (!currentUser?.permissions?.attendance) return showToast('غير مصرح لك', 'error');
            const day = appState.attendanceRecords?.[getTodayISO()], rec = day && day[id]; if (!rec) return;
            const st = appState.barbers.find(b => b.id === id), ex = rec.extra && rec.extra.length ? rec.extra[rec.extra.length - 1] : null;
            if (ex) { if (ex.out12) { ex.out12 = null; ex.out24 = null; } else rec.extra.pop(); }
            else if (rec.status === 'present' && rec.checkOut) { rec.checkOut = null; rec.checkOut24 = null; rec.earlyMinutes = 0; }
            else { askConfirm('تمسح تسجيل النهاردة للموظف ' + esc(st?.name || '') + '؟', () => { delete day[id]; logAudit('مسح تسجيل حضور اليوم: ' + (st?.name || '')); saveState(); renderAll(); }, 'امسح'); return; }
            logAudit('تراجع عن آخر حركة حضور: ' + (st?.name || '')); saveState(); renderAll(); showToast('تم التراجع');
        }
        function editCheckIn(staffId) {
            if (!currentUser?.permissions?.attendance) return;
            const rec = appState.attendanceRecords?.[getTodayISO()]?.[staffId]; if (!rec) return;
            askInput('وقت الحضور الصحيح', rec.checkIn24 || '', v => {
                const t = v.padStart(5, '0'), st = appState.barbers.find(b => b.id === staffId);
                rec.checkIn = formatTime12(t); rec.lateMinutes = calcLateMinutes(st?.shiftStart || '12:00', t); rec.checkIn24 = t; rec.diffMin = diffFromShift(st?.shiftStart || '12:00', t);
                logAudit('تعديل وقت حضور ' + (st?.name || '')); saveState(); renderAll();
            }, 'time');
        }
        function applyLateDeduction(id) {
            const st = appState.barbers.find(b => b.id === id); if (!st) return;
            const c = calculateStaffPayroll(st, []), amt = Math.round(c.chargeMinutes / 60 * (Number(st.lateHourRate) || 0)), advId = 'adv-late-' + id + '-' + payrollMonth;
            if (!(amt > 0)) return showToast('مفيش مبلغ يتخصم', 'error');
            if ((appState.advances || []).some(a => a.id === advId)) return showToast('خصم التأخير اتسجل قبل كده للشهر ده', 'error');
            askConfirm('تخصم ' + amt + ' ج.م من مرتب ' + esc(st.name) + ' بسبب التأخير (' + fmtDur(c.chargeMinutes) + ')؟', () => {
                appState.advances = appState.advances || [];
                appState.advances.unshift({ id: advId, staffId: id, staffName: st.name, amount: amt, reason: 'خصم تأخير ' + fmtDur(c.chargeMinutes) + ' - شهر ' + payrollMonth, date: payrollMonth === getTodayISO().slice(0, 7) ? getTodayISO() : payrollMonth + '-28' });
                logAudit('خصم تأخير ' + amt + ' ج.م على ' + st.name); saveState(); renderAll(); showToast('تم الخصم');
            }, 'اخصم');
        }
        function setPayrollMonth(v) { if (!v) return; payrollMonth = v; renderAll(); }
        function renderAll() {
            try { ensureCafe(); } catch (e) { console.error(e); }
            try { renderLoginUsers(); } catch (e) {}
            document.querySelectorAll('.pm-input').forEach(i => i.value = payrollMonth);
            renderPOS(); renderInvoicesTable(); renderClientsTable(); renderReports();
            renderCatalogManagement(); renderBarbersManage(); renderUsersManage(); renderSettings();
            try { ensureNewPerms(); renderAttendance(); finRefresh(); renderDrawer(); renderPL(); renderBookings(); renderArchive(); renderPartners(); renderFootBar(); } catch (e) { console.error(e); }
        }
