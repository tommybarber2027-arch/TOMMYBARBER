        // ===================== FINANCE: salon expenses + staff advances/deductions =====================
        let finTab = 'exp', finMonth = '';
        const finMoney = n => Number(n || 0).toLocaleString('en-US') + ' ج.م';
        const finId = () => 'f' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
        function finAdvTotal(staffId, month) {
            return (appState.finAdv || []).filter(a => a.staffId === staffId && (a.date || '').startsWith(month || finMonth)).reduce((s, a) => s + Number(a.amount || 0), 0);
        }
        function ensureNewPerms() {
            appState.finExpenses = appState.finExpenses || []; appState.finAdv = appState.finAdv || []; appState.attendanceLog = appState.attendanceLog || {};
            let ch = false;
            (appState.users || []).forEach(u => {
                u.permissions = u.permissions || {};
                if (u.permissions.attendance === undefined) { u.permissions.attendance = !!u.permissions.barbers; ch = true; }
                if (u.permissions.finance === undefined) { u.permissions.finance = !!u.permissions.settings; ch = true; }
            });
            if (currentUser) { const u = appState.users.find(x => x.id === currentUser.id); if (u) currentUser.permissions = u.permissions; }
            if (ch) saveState();
        }
        function finShow(t) { finTab = t; finRefresh(); }
        function finAddExp() {
            const item = document.getElementById('fe-item').value.trim(), amt = Number(document.getElementById('fe-amt').value), note = document.getElementById('fe-note').value.trim(), date = document.getElementById('fe-date').value || getTodayISO();
            if (!item || !(amt > 0)) { showToast('اكتب البند والمبلغ', 'error'); return; }
            appState.finExpenses.unshift({ id: finId(), date, item, amount: amt, note });
            logAudit(`مصروف: ${item} ${amt}`); saveState();
            ['fe-item', 'fe-amt', 'fe-note'].forEach(i => document.getElementById(i).value = ''); finRefresh(); showToast('تم تسجيل المصروف');
        }
        function finAddAdv() {
            const b = appState.barbers.find(x => x.id === document.getElementById('fa-staff').value), type = document.getElementById('fa-type').value, amt = Number(document.getElementById('fa-amt').value), note = document.getElementById('fa-note').value.trim(), date = document.getElementById('fa-date').value || getTodayISO();
            if (!b || !(amt > 0)) { showToast('اختار الموظف واكتب المبلغ', 'error'); return; }
            appState.finAdv.unshift({ id: finId(), date, staffId: b.id, staffName: b.name, type, amount: amt, note });
            logAudit(`${type} للموظف ${b.name}: ${amt}`); saveState();
            ['fa-amt', 'fa-note'].forEach(i => document.getElementById(i).value = ''); finRefresh(); showToast('تم التسجيل وهيتخصم من مستحقاته');
        }
        function finDel(kind, id) {
            askConfirm('تحذف السجل ده؟', () => { const k = kind === 'exp' ? 'finExpenses' : 'finAdv'; appState[k] = appState[k].filter(x => x.id !== id); saveState(); finRefresh(); }, 'احذف');
        }
        function finRefresh() {
            const root = document.getElementById('view-finance'); if (!root) return;
            ensureNewPerms();
            if (!finMonth) finMonth = getTodayISO().slice(0, 7);
            const inp = 'w-full bg-darkbg border border-bordergold rounded-xl px-3 py-2 text-white', lbl = 'block text-gray-400 mb-1';
            if (!document.getElementById('fin-body')) {
                root.innerHTML = `<div class="flex flex-wrap items-center gap-2"><h2 class="text-sm font-black text-gold">المالية</h2><button id="fin-t-exp" onclick="finShow('exp')" class="set-pill">مصاريف الصالون</button><button id="fin-t-adv" onclick="finShow('adv')" class="set-pill">السلف والخصومات</button><input type="month" id="fin-month" onchange="finMonth=this.value||finMonth;finRefresh()" class="bg-darkbg border border-bordergold rounded-xl px-3 py-2 text-white text-xs"></div>
                <div id="fin-body">
                <div id="fin-p-exp" class="space-y-3"><div class="bg-panelbg border border-bordergold rounded-2xl p-4 space-y-2 text-xs"><h3 class="text-sm font-black text-white">إضافة مصروف</h3>
                  <div><label class="${lbl}">البند (إيجار، كهرباء، مياه، نت، أدوات...)</label><input id="fe-item" class="${inp}"></div>
                  <div class="grid grid-cols-2 gap-2"><div><label class="${lbl}">المبلغ</label><input id="fe-amt" type="number" min="0" class="${inp}"></div><div><label class="${lbl}">التاريخ</label><input id="fe-date" type="date" class="${inp}"></div></div>
                  <div><label class="${lbl}">ملاحظات (اختياري)</label><input id="fe-note" class="${inp}"></div>
                  <button onclick="finAddExp()" class="w-full bg-gold text-black font-black py-2.5 rounded-xl">إضافة المصروف</button></div><div id="fin-exp-list" class="bg-panelbg border border-bordergold rounded-2xl p-4 text-xs"></div></div>
                <div id="fin-p-adv" class="space-y-3"><div class="bg-panelbg border border-bordergold rounded-2xl p-4 space-y-2 text-xs"><h3 class="text-sm font-black text-white">تسجيل سلفة أو خصم</h3>
                  <div class="grid grid-cols-2 gap-2"><div><label class="${lbl}">الموظف</label><select id="fa-staff" class="${inp}"></select></div><div><label class="${lbl}">النوع</label><select id="fa-type" class="${inp}"><option>سلفة</option><option>خصم</option><option>منتج</option></select></div></div>
                  <div class="grid grid-cols-2 gap-2"><div><label class="${lbl}">المبلغ</label><input id="fa-amt" type="number" min="0" class="${inp}"></div><div><label class="${lbl}">التاريخ</label><input id="fa-date" type="date" class="${inp}"></div></div>
                  <div><label class="${lbl}">ملاحظات (السبب)</label><input id="fa-note" placeholder="مثلاً: خد منتج / سلفة / خصم بسبب..." class="${inp}"></div>
                  <button onclick="finAddAdv()" class="w-full bg-gold text-black font-black py-2.5 rounded-xl">تسجيل (بيتخصم من المرتب)</button></div><div id="fin-adv-list" class="space-y-3"></div></div></div>`;
                document.getElementById('fe-date').value = document.getElementById('fa-date').value = getTodayISO();
            }
            document.getElementById('fin-month').value = finMonth;
            document.getElementById('fin-p-exp').classList.toggle('hidden', finTab !== 'exp'); document.getElementById('fin-p-adv').classList.toggle('hidden', finTab !== 'adv');
            document.getElementById('fin-t-exp').classList.toggle('on', finTab === 'exp'); document.getElementById('fin-t-adv').classList.toggle('on', finTab === 'adv');
            const del = (k, id) => `<button onclick="finDel('${k}','${id}')" class="px-2 py-1 rounded-lg border border-red-800/60 bg-red-950/30 text-red-300 text-xs font-bold">حذف</button>`;
            const ex = appState.finExpenses.filter(e => (e.date || '').startsWith(finMonth)), exT = ex.reduce((s, e) => s + e.amount, 0);
            document.getElementById('fin-exp-list').innerHTML = `<div class="flex justify-between mb-2"><b class="text-gold">مصاريف ${finMonth}</b><b class="text-white">${finMoney(exT)}</b></div>` + (ex.map(e => `<div class="flex items-center justify-between gap-2 py-2 border-t border-bordergold/40"><div><b class="text-white">${esc(e.item)}</b> <span class="text-gray-400">${esc(e.date)}${e.note ? ' • ' + esc(e.note) : ''}</span></div><div class="flex items-center gap-2"><b class="text-white">${finMoney(e.amount)}</b>${del('exp', e.id)}</div></div>`).join('') || '<p class="text-gray-400">مفيش مصاريف في الشهر ده.</p>');
            const sel = document.getElementById('fa-staff'), cur = sel.value; sel.innerHTML = appState.barbers.map(b => `<option value="${b.id}">${esc(b.name)}</option>`).join(''); if (cur) sel.value = cur;
            const invs = appState.invoices.filter(i => !i.deleted && (i.date || '').startsWith(finMonth));
            document.getElementById('fin-adv-list').innerHTML = appState.barbers.map(b => {
                const c = calculateStaffPayroll(b, invs), earn = Number((c.netBaseSalary + c.totalComm).toFixed(2)), mine = appState.finAdv.filter(a => a.staffId === b.id && (a.date || '').startsWith(finMonth)), ded = mine.reduce((s, a) => s + a.amount, 0), rem = earn - ded;
                return `<div class="bg-panelbg border border-bordergold rounded-2xl p-4 text-xs space-y-1.5"><div class="flex justify-between"><b class="text-white text-sm">${esc(b.name)}</b><b class="${rem < 0 ? 'text-red-400' : 'text-emerald-400'}">المتبقي: ${finMoney(rem)}</b></div>
                  <div class="flex justify-between text-gray-300"><span>المستحق (الراتب + العمولة)</span><span>${finMoney(earn)}</span></div><div class="flex justify-between text-gray-300"><span>السلف والخصومات</span><span>${finMoney(ded)}</span></div>` +
                    mine.map(a => `<div class="flex items-center justify-between gap-2 pt-1.5 border-t border-bordergold/40"><span class="text-gray-300"><b class="text-white">${esc(a.type)}</b> ${esc(a.date)}${a.note ? ' • ' + esc(a.note) : ''}</span><span class="flex items-center gap-2"><b class="text-white">${finMoney(a.amount)}</b>${del('adv', a.id)}</span></div>`).join('') + '</div>';
            }).join('');
        }
