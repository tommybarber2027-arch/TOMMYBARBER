        // 5. ATTENDANCE & STAFF
        function setStaffFilter(role) {
            staffRoleFilter = role;
            renderBarbersManage();
        }

        function markTodayAttendance(staffId, status) {
            if (!currentUser?.permissions?.attendance) { showToast('غير مصرح لك بتسجيل الحضور والغياب', 'error'); return; }
            const today = getTodayISO();
            if (!appState.attendanceRecords) appState.attendanceRecords = {};
            if (!appState.attendanceRecords[today]) appState.attendanceRecords[today] = {};
            const staff = appState.barbers.find(b => b.id === staffId);
            const ex0 = appState.attendanceRecords[today][staffId];
            if (status === 'present' && ex0 && ex0.status === 'present') {
                const t24 = get24TimeStr(), t12 = formatTime12(t24), lastX = ex0.extra && ex0.extra.length ? ex0.extra[ex0.extra.length - 1] : null;
                if ((lastX && !lastX.out12) || (!lastX && !ex0.checkOut)) { showToast('الموظف حاضر بالفعل. سجّل انصرافه الأول', 'error'); return; }
                (ex0.extra = ex0.extra || []).push({ in12: t12, in24: t24, out12: null, out24: null });
                logAudit('رجوع للشغل (' + t12 + ') للموظف: ' + staff?.name); saveState(); renderAll(); showToast('تم تسجيل رجوع ' + staff?.name); return;
            }
            const now24 = get24TimeStr(), now12 = formatTime12(now24);
            const lateMins = status === 'present' ? calcLateMinutes(staff?.shiftStart || '12:00', now24) : 0;
            appState.attendanceRecords[today][staffId] = {
                status, checkIn: status === 'present' ? now12 : null, checkOut: null,
                lateMinutes: lateMins, checkIn24: status === 'present' ? now24 : null,
                diffMin: status === 'present' ? diffFromShift(staff?.shiftStart || '12:00', now24) : 0, by: currentUser.displayName
            };
            logAudit(`تسجيل ${status === 'present' ? `حضور (${now12})` : (status === 'leave' ? 'إجازة' : 'غياب')} للموظف: ${staff?.name}`);
            saveState(); renderAll(); showToast(`تم تسجيل ${({ present: 'حضور', absent: 'غياب', leave: 'إجازة' })[status]} ${staff?.name}`);
        }

        function markTodayCheckout(staffId) {
            if (!currentUser?.permissions?.attendance) { showToast('غير مصرح لك بتسجيل الانصراف', 'error'); return; }
            const today = getTodayISO(), rec = appState.attendanceRecords?.[today]?.[staffId];
            if (!rec || rec.status !== 'present') { showToast('يجب تسجيل الحضور أولاً قبل الانصراف', 'error'); return; }
            const staff = appState.barbers.find(b => b.id === staffId), now12 = getTimeStr();
            const lx = rec.extra && rec.extra.length ? rec.extra[rec.extra.length - 1] : null;
            if (lx && !lx.out12) { lx.out12 = now12; lx.out24 = get24TimeStr(); }
            else if (!rec.checkOut) { rec.checkOut = now12; stampOut(rec, staff, get24TimeStr()); }
            else { showToast('مفيش جلسة مفتوحة للانصراف', 'error'); return; }
            logAudit(`تسجيل انصراف (${now12}) للموظف: ${staff?.name}`); saveState(); renderAll();
            showToast(`تم تسجيل انصراف ${staff?.name} الساعة ${now12}`);
        }

        function renderAttendanceSection() {
            const today = getTodayISO();
            document.getElementById('att-page-date').textContent = today;
            const todayMap = (appState.attendanceRecords && appState.attendanceRecords[today]) || {};
            const vals = appState.barbers.map(b => ({ b, r: todayMap[b.id] })), cnt = f => vals.filter(x => f(x.r || {}, x.b)).length;
            const nP = cnt(r => r.status === 'present'), nA = cnt(r => r.status === 'absent'), nV = cnt(r => r.status === 'leave'), nL = cnt((r, b) => r.status === 'present' && (r.lateMinutes || 0) > graceOf(b)), nW = vals.length - nP - nA - nV;
            const chip = (c, t, n) => `<span class="px-3 py-1 rounded-full border ${c}">${t} ${n}</span>`;
            document.getElementById('att-summary').innerHTML = chip('bg-emerald-950/60 border-emerald-800 text-emerald-300', 'حاضر', nP) + chip('bg-red-950/60 border-red-900 text-red-300', 'غايب', nA) + chip('bg-sky-950/60 border-sky-800 text-sky-300', 'إجازة', nV) + chip('bg-amber-950/50 border-amber-800 text-amber-300', 'متأخر بعد السماح', nL) + chip('bg-darkbg border-bordergold text-gray-300', 'لسه ما سجّلش', nW);

            document.getElementById('attendance-daily-cards').innerHTML = appState.barbers.map(b => {
                const rec = todayMap[b.id], st = rec?.status, pres = st === 'present', abs = st === 'absent', lv = st === 'leave';
                const bd = pres ? 'border-emerald-700/70' : abs ? 'border-red-800/70' : lv ? 'border-sky-800/70' : 'border-bordergold';
                const act = (js, cls, txt) => `<button type="button" onclick="${js}" class="flex-1 py-2.5 rounded-xl text-xs font-black transition ${cls}">${txt}</button>`;
                let state, actions;
                if (!rec) {
                    state = '<span class="text-gray-500">لسه ما سجّلش حضور النهاردة</span>';
                    actions = act(`markTodayAttendance('${b.id}','present')`, 'bg-emerald-600 hover:bg-emerald-500 text-white', 'تسجيل حضور') + act(`markTodayAttendance('${b.id}','absent')`, 'bg-red-950/60 border border-red-800 text-red-300 hover:bg-red-900/60', 'غياب') + act(`markTodayAttendance('${b.id}','leave')`, 'bg-sky-950/60 border border-sky-800 text-sky-300 hover:bg-sky-900/60', 'إجازة');
                } else if (pres) {
                    const ss = sessionsOf(rec), open = ss.some(x => !x.out12), wm = workedMin(rec);
                    state = `<span class="text-emerald-400 font-bold">حضر: <b>${formatTime12(rec.checkIn)}</b></span><button type="button" onclick="editCheckIn('${b.id}')" class="mr-1 text-gray-400 hover:text-gold" title="تعديل وقت الحضور">✎</button>${lateBadge(rec, b)}${ss.map((x, i) => (i ? `<span class="block text-[11px] text-gray-300 mt-0.5">رجع ${formatTime12(x.in12)}${x.out12 ? ' ← انصرف ' + formatTime12(x.out12) : ' (لسه موجود)'}</span>` : (x.out12 ? `<span class="text-sky-400 block mt-1">انصرف: <b>${formatTime12(x.out12)}</b>${x.early > 0 ? ` <span class="text-amber-400">(بدري ${fmtDur(x.early)})</span>` : ''}</span>` : ''))).join('')}${wm ? `<span class="block text-[11px] text-gray-400 mt-1">ساعات الشغل: ${fmtDur(wm)}</span>` : ''}`;
                    actions = act(open ? `markTodayCheckout('${b.id}')` : `markTodayAttendance('${b.id}','present')`, open ? 'bg-gold hover:bg-goldhover text-black' : 'bg-emerald-600 hover:bg-emerald-500 text-white', open ? 'تسجيل انصراف' : 'تسجيل حضور (رجع تاني)') + act(`undoLast('${b.id}')`, 'bg-darkbg border border-bordergold text-gray-400 hover:text-white', 'تراجع');
                } else {
                    state = abs ? '<span class="text-red-400 font-bold">غايب النهاردة (هيتخصم يوم)</span>' : '<span class="text-sky-300 font-bold">إجازة (من غير خصم)</span>';
                    actions = act(`undoLast('${b.id}')`, 'bg-darkbg border border-bordergold text-gray-300 hover:text-white', 'تراجع / تغيير');
                }
                return `<div class="bg-darkbg border ${bd} rounded-2xl p-3.5 space-y-3 text-xs"><div><h4 class="font-black text-white text-sm">${esc(b.name)}</h4><span class="text-[11px] text-gray-400">${esc(roleLabel(b.role || 'barber'))} • ميعاده: <b class="text-gold">${formatTime12(b.shiftStart || '12:00')}${b.shiftEnd ? ' - ' + formatTime12(b.shiftEnd) : ''}</b> • سماح ${graceOf(b)} د</span></div><div class="min-h-[44px] text-[12px]">${state}</div><div class="flex gap-2">${actions}</div></div>`;
            }).join('');


            const activeInvs = appState.invoices.filter(i => !i.deleted && (i.date || '').startsWith(payrollMonth));
            document.getElementById('attendance-report-tbody').innerHTML = appState.barbers.map(b => {
                const c = calculateStaffPayroll(b, activeInvs);
                return `
                    <tr class="hover:bg-white/[0.02]">
                        <td class="p-3 font-black text-white">${b.name}</td>
                        <td class="p-3 text-gray-400">${roleLabel(b.role || 'barber')}</td>
                        <td class="p-3 text-center text-gray-300">${formatTime12(b.shiftStart || '12:00')}</td>
                        <td class="p-3 text-center font-black text-emerald-400">${c.presentDays} يوم<div class="text-[10px] text-gray-400 font-normal">${fmtDur(c.workMinutes)} شغل</div></td>
                        <td class="p-3 text-center font-black text-red-400">${c.absentDays} يوم</td>
                        <td class="p-3 text-center font-bold text-amber-400">${c.lateDays} يوم • ${fmtDur(c.lateMinutes)}<div class="text-[10px] text-red-300 font-normal">بعد السماح: ${fmtDur(c.chargeMinutes)}</div></td>
                        <td class="p-3 text-center font-bold text-red-400">- ${fmt(c.totalTimeDeduction)} ج.م${(appState.salonInfo.lateDeduct !== 'auto' && c.chargeMinutes > 0) ? `<button type="button" onclick="applyLateDeduction('${b.id}')" class="block mx-auto mt-1 text-[10px] px-2 py-0.5 rounded-lg border border-red-800 text-red-300 hover:bg-red-950">اخصم التأخير (${fmt(Math.round(c.chargeMinutes / 60 * (b.lateHourRate || 0)))} ج.م)</button>` : ''}</td>
                        <td class="p-3 text-left font-black text-gold text-sm">${fmt(c.netPayable)} ج.م</td>
                    </tr>
                `;
            }).join('');
        }

        function renderStaffFilters() {
            const el = document.getElementById('sf-bar'); if (!el) return;
            el.innerHTML = [{ id: 'all', label: 'الكل' }, ...roles()].map(r => `<button onclick="setStaffFilter('${r.id}')" id="sf-${r.id}" class="sf-btn px-3.5 py-1.5 rounded-full text-xs ${staffRoleFilter === r.id ? 'font-black bg-gold text-black' : 'font-bold bg-panelbg border border-bordergold text-gray-300'}">${esc(r.label)}</button>`).join('');
        }

        function renderBarbersManage() {
            renderStaffFilters();
            const typeNames = { commission: 'نسبة فقط', salary: 'راتب ثابت فقط', both: 'راتب ثابت + نسبة' };
            const activeInvs = appState.invoices.filter(i => !i.deleted && (i.date || '').startsWith(payrollMonth));
            let sumBase = 0, sumComms = 0, sumNet = 0;
            appState.barbers.forEach(s => { const c = calculateStaffPayroll(s, activeInvs); sumBase += c.netBaseSalary; sumComms += c.totalComm; sumNet += c.netPayable; });

            document.getElementById('staff-kpi-count').textContent = `${appState.barbers.length} موظف`;
            document.getElementById('staff-kpi-salaries').textContent = `${fmt(sumBase)} ج.م`;
            document.getElementById('staff-kpi-comms').textContent = `${fmt(sumComms)} ج.م`;
            document.getElementById('staff-kpi-net').textContent = `${fmt(sumNet)} ج.م`;

            const list = staffRoleFilter === 'all' ? appState.barbers : appState.barbers.filter(b => (b.role || 'barber') === staffRoleFilter);
            document.getElementById('barbers-manage-grid').innerHTML = list.map(b => {
                const role = b.role || 'barber', pt = b.payType || 'commission', calc = calculateStaffPayroll(b, activeInvs);
                return `
                    <div class="bg-panelbg border border-bordergold rounded-2xl p-4 space-y-3">
                        <div class="flex items-start justify-between">
                            <div class="flex items-center gap-3">
                                <div class="w-12 h-12 rounded-full border border-gold/50 text-gold flex items-center justify-center text-lg shrink-0"><i class="fa-regular fa-user"></i></div>
                                <div>
                                    <h3 class="text-sm font-black text-white">${b.name}${b.hidden ? ' <span class="text-[10px] px-2 py-0.5 rounded-full bg-darkbg border border-bordergold text-gray-400 font-bold">مخفي</span>' : ''}</h3>
                                    <span class="inline-block mt-0.5 px-2.5 py-0.5 rounded-full bg-golddark border border-gold/30 text-[10px] text-gold font-bold">${roleLabel(role)} • ${typeNames[pt]}</span>
                                    <div class="text-[11px] text-gray-400 font-mono mt-1" dir="ltr">
                                        ${b.phone1 ? `<span><i class="fa-solid fa-phone text-gold text-[10px] mr-1"></i>${b.phone1}</span>` : ''}
                                        ${b.phone2 ? `<span class="mr-2 text-gray-500">| ${b.phone2}</span>` : ''}
                                    </div>
                                </div>
                            </div>
                            <div class="flex flex-col gap-1.5"><button onclick="openBarberModal('${b.id}')" class="px-3 py-1.5 rounded-xl border border-bordergold bg-darkbg hover:border-gold text-xs font-bold text-gray-300">تعديل</button><button onclick="printStatement('${b.id}')" class="px-3 py-1.5 rounded-xl border border-gold/40 bg-golddark text-gold hover:bg-gold hover:text-black text-xs font-bold transition">كشف حساب</button><button onclick="toggleBarberHidden('${b.id}')" class="px-3 py-1.5 rounded-xl border border-bordergold bg-darkbg text-gray-300 hover:border-gold text-xs font-bold">${b.hidden ? 'إظهار' : 'إخفاء'}</button><button onclick="deleteBarber('${b.id}')" class="px-3 py-1.5 rounded-xl border border-red-800/60 bg-red-950/30 text-red-300 hover:bg-red-900/50 text-xs font-bold">حذف</button></div>
                        </div>
                        <div class="space-y-1.5 text-xs border-t border-bordergold/50 pt-2.5">
                            ${pt !== 'commission' ? `<div class="flex justify-between"><span class="text-gray-400">الراتب الثابت (بعد الغياب والتأخير):</span><span class="font-bold text-white">${fmt(calc.netBaseSalary)} ج.م</span></div>` : ''}
                            ${pt !== 'salary' ? `<div class="flex justify-between"><span class="text-gray-400">عمولة الشغل (${b.commissionPct || 0}%):</span><span class="font-bold text-gold">${fmt(calc.regularComm)} ج.م</span></div>` : ''}
                            <div class="flex justify-between"><span class="text-gray-400">عمولة البشرة والعناية (${b.skinPct || 0}%):</span><span class="font-bold text-gold">${fmt(calc.careComm)} ج.م</span></div>
                            <div class="flex justify-between border-t border-bordergold pt-2 text-sm">
                                <span class="font-black text-white">صافي الباقي له:</span>
                                <span class="font-black text-gold">${fmt(calc.netPayable)} ج.م</span>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');

        }

        function toggleBarberPayFields() {
            const pt = document.getElementById('edit-barber-paytype').value;
            document.getElementById('barber-salary-wrap').classList.toggle('hidden', pt === 'commission');
            document.getElementById('barber-pct-wrap').classList.toggle('hidden', pt === 'salary');
        }

        function openBarberModal(id = null) {
            document.getElementById('edit-barber-role').innerHTML = roles().map(r => `<option value="${r.id}">${esc(r.label)}</option>`).join('');
            const bb = id ? appState.barbers.find(x => x.id === id) : null;
            document.getElementById('edit-barber-id').value = bb ? bb.id : '';
            { const _ar = bb ? (bb.nameAr || (hasAr(bb.name) ? bb.name : '')) : '', _en = bb ? (bb.nameEn || (hasAr(bb.name) ? '' : bb.name)) : '', _e = document.getElementById('edit-barber-name-en');
              document.getElementById('edit-barber-name').value = _ar; _e.value = _en; _e.dataset.manual = _en ? '1' : ''; if (!_en && _ar) autoEnName(); }
            document.getElementById('barber-delete-btn').classList.toggle('hidden', !bb);
            document.getElementById('edit-barber-phone1').value = bb?.phone1 || '';
            document.getElementById('edit-barber-phone2').value = bb?.phone2 || '';
            document.getElementById('edit-barber-role').value = bb?.role || 'barber';
            document.getElementById('edit-barber-paytype').value = bb?.payType || 'commission';
            document.getElementById('edit-barber-salary').value = bb?.baseSalary || 0;
            document.getElementById('edit-barber-pct').value = bb?.commissionPct ?? 30;
            document.getElementById('edit-barber-skinpct').value = bb?.skinPct ?? 10;
            document.getElementById('edit-barber-shift').value = bb?.shiftStart || '12:00';
            document.getElementById('edit-barber-late-rate').value = bb?.lateHourRate ?? 25;
            document.getElementById('edit-barber-shift-end').value = bb?.shiftEnd || '22:00';
            document.getElementById('edit-barber-grace').value = bb?.graceMinutes ?? 15;
            toggleBarberPayFields();
            document.getElementById('barber-modal').classList.remove('hidden');
        }

        function saveBarber(e) {
            e.preventDefault();
            const id = document.getElementById('edit-barber-id').value;
            const nameArIn = document.getElementById('edit-barber-name').value.trim(), nameEnIn = document.getElementById('edit-barber-name-en').value.trim();
            const name = nameArIn || nameEnIn, nameAr = nameArIn, nameEn = nameEnIn || (nameArIn ? trAr2En(nameArIn) : '');
            const phone1 = document.getElementById('edit-barber-phone1').value.trim();
            const phone2 = document.getElementById('edit-barber-phone2').value.trim();
            const role = document.getElementById('edit-barber-role').value;
            const payType = document.getElementById('edit-barber-paytype').value;
            const baseSalary = payType === 'commission' ? 0 : (Number(document.getElementById('edit-barber-salary').value) || 0);
            const commissionPct = payType === 'salary' ? 0 : (Number(document.getElementById('edit-barber-pct').value) || 0);
            const skinPct = Number(document.getElementById('edit-barber-skinpct').value) || 0;
            const shiftStart = document.getElementById('edit-barber-shift').value || '12:00';
            const lateHourRate = Number(document.getElementById('edit-barber-late-rate').value) || 0;

            if (!name || !phone1) { showToast('يجب إدخال الاسم ورقم التليفون الأساسي', 'error'); return; }
            const duplicateStaff = appState.barbers.find(b => b.id !== id && b.phone1 === phone1);
            if (duplicateStaff) { showToast(`رقم التليفون مسجل مسبقاً للموظف: ${duplicateStaff.name}`, 'error'); return; }

            const payload = { name, nameAr, nameEn, phone1, phone2, role, payType, baseSalary, commissionPct, skinPct, shiftStart, lateHourRate, shiftEnd: document.getElementById('edit-barber-shift-end').value || '22:00', graceMinutes: Math.max(0, Number(document.getElementById('edit-barber-grace').value) || 0) };
            if (id) { Object.assign(appState.barbers.find(x => x.id === id), payload); appState.invoices.forEach(i => { if (i.barberId === id) i.barberName = name; }); (appState.advances || []).forEach(a => { if (a.staffId === id) a.staffName = name; }); logAudit(`تعديل بيانات الموظف: ${name}`); }
            else { appState.barbers.push({ id: 'b-' + Date.now(), ...payload }); logAudit(`إضافة موظف جديد: ${name}`); }
            saveState(); closeModal('barber-modal'); renderAll(); showToast('تم حفظ بيانات الموظف');
        }

        function openAdvanceModal() {
            document.getElementById('adv-staff-id').innerHTML = appState.barbers.map(b => `<option value="${b.id}">${b.name}</option>`).join('');
            document.getElementById('adv-amount').value = '';
            document.getElementById('adv-reason').value = '';
            document.getElementById('advance-modal').classList.remove('hidden');
        }

        function saveAdvance(e) {
            e.preventDefault();
            const staffId = document.getElementById('adv-staff-id').value;
            const staff = appState.barbers.find(b => b.id === staffId);
            const amount = Number(document.getElementById('adv-amount').value);
            const reason = document.getElementById('adv-reason').value.trim();
            if (!staff || amount <= 0) return;
            if (!appState.advances) appState.advances = [];
            const advId = 'adv-' + Date.now(); appState.advances.unshift({ id: advId, staffId: staff.id, staffName: staff.name, amount, reason, date: getTodayISO() });
            (appState.expenses = appState.expenses || []).unshift({ id: 'ex-' + Date.now(), date: getTodayISO(), accId: 'a-adv', amount, pay: 'cash', note: 'سلفة - ' + staff.name + (reason ? ' - ' + reason : ''), empId: staff.id, advId });
            logAudit(`تسجيل سُلفة ${amount} ج.م على ${staff.name}`);
            saveState(); closeModal('advance-modal'); renderAll(); showToast('تم تسجيل السُلفة وخصمها من المستحق');
        }

        function deleteAdvance(id) {
            askConfirm('تحذف السلفة دي؟ هترجع للموظف في الحساب.', () => { appState.advances = (appState.advances || []).filter(a => a.id !== id); appState.expenses = (appState.expenses || []).filter(e => e.advId !== id); saveState(); renderAll(); }, 'احذف');
        }
