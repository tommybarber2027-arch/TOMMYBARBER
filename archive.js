        // ===================== ARCHIVE (الأرشيف - للمدير فقط) =====================
        // appState.archive = [{id,month,at,by,summary,vaultDelta,data:{invoices,finExpenses,finAdv,advances,shifts,bookings}}]
        let archOpen = null, archTab = 'inv';
        const arArr = () => (appState.archive = appState.archive || []);
        const arMoney = n => Number(n || 0).toLocaleString('en-US') + ' ج.م';
        const arMonthOf = iso => (iso || '').slice(0, 7);
        const arShiftMonth = s => s.openedAt ? dwBiz(s.openedAt).slice(0, 7) : '';
        function arCollect(m) {
            return {
                invoices: appState.invoices.filter(i => arMonthOf(i.date) === m),
                finExpenses: (appState.finExpenses || []).filter(e => arMonthOf(e.date) === m),
                finAdv: (appState.finAdv || []).filter(a => arMonthOf(a.date) === m),
                advances: (appState.advances || []).filter(a => arMonthOf(a.date) === m),
                shifts: shiftsArr().filter(s => s.status === 'closed' && arShiftMonth(s) === m),
                bookings: (appState.bookings || []).filter(b => !bkActive(b) && arMonthOf(b.date) === m)
            };
        }
        function arSummary(d, m) {
            const inR = x => arMonthOf(x) === m;
            const inc = d.invoices.filter(i => !i.deleted).reduce((t, i) => t + Number(i.total || 0), 0) + d.bookings.filter(b => b.status === 'ملغي').reduce((t, b) => t + bkNet(b), 0);
            const exp = d.finExpenses.reduce((t, e) => t + Number(e.amount), 0), adv = d.finAdv.reduce((t, a) => t + Number(a.amount), 0);
            return { income: inc, out: exp + adv, net: inc - exp - adv, invCount: d.invoices.filter(i => !i.deleted).length, shiftCount: d.shifts.length };
        }
        function arVaultDelta(d) {
            return d.shifts.reduce((t, s) => t + shiftTransferTotal(s), 0)
                - d.finExpenses.filter(x => x.src !== 'drawer').reduce((t, x) => t + Number(x.amount), 0)
                - d.finAdv.filter(x => x.src !== 'drawer').reduce((t, x) => t + Number(x.amount), 0)
                - d.bookings.reduce((t, b) => t + (b.pays || []).filter(p => p.kind === 'رد' && p.src !== 'drawer').reduce((u, p) => u + Number(p.amount), 0), 0);
        }
        function arMonths() {
            const cur = getTodayISO().slice(0, 7), set = new Set();
            appState.invoices.forEach(i => set.add(arMonthOf(i.date)));
            (appState.finExpenses || []).concat(appState.finAdv || []).forEach(x => set.add(arMonthOf(x.date)));
            shiftsArr().filter(s => s.status === 'closed').forEach(s => set.add(arShiftMonth(s)));
            (appState.bookings || []).filter(b => !bkActive(b)).forEach(b => set.add(arMonthOf(b.date)));
            return [...set].filter(m => m && m < cur).sort().reverse();
        }
        function arDownload(rec) {
            const blob = new Blob([JSON.stringify(rec, null, 1)], { type: 'application/json' }), a = document.createElement('a');
            a.href = URL.createObjectURL(blob); a.download = 'tommy-archive-' + rec.month + '.json'; document.body.appendChild(a); a.click(); a.remove();
        }
        function arCommit(m) {
            const d = arCollect(m), n = d.invoices.length + d.finExpenses.length + d.finAdv.length + d.shifts.length + d.bookings.length; if (!n) return null;
            const rec = { id: 'ar' + Date.now().toString(36) + m.replace('-', ''), month: m, at: new Date().toISOString(), by: currentUser.displayName, summary: arSummary(d, m), vaultDelta: arVaultDelta(d), data: JSON.parse(JSON.stringify(d)) };
            const ids = k => new Set(d[k].map(x => x.id));
            const maxInv = d.invoices.reduce((t, i) => Math.max(t, i.id), 0); appState.lastInvId = Math.max(appState.lastInvId || 0, maxInv, ...appState.invoices.map(i => i.id), 0);
            appState.invoices = appState.invoices.filter(x => !ids('invoices').has(x.id));
            ['finExpenses', 'finAdv', 'advances', 'bookings'].forEach(k => { const s = ids(k); appState[k] = (appState[k] || []).filter(x => !s.has(x.id)); });
            const ss = ids('shifts'); appState.shifts = appState.shifts.filter(x => !ss.has(x.id));
            appState.vaultBase = Number(appState.vaultBase || 0) + rec.vaultDelta; arArr().unshift(rec); logAudit('أرشفة شهر ' + m); return rec;
        }
        function arDoAll() {
            if (!currentUser?.permissions?.archive) { showToast('غير مصرح لك', 'error'); return; }
            const ms = arMonths().filter(m => { const d = arCollect(m); return d.invoices.length + d.finExpenses.length + d.finAdv.length + d.shifts.length + d.bookings.length > 0; });
            if (!ms.length) { showToast('مفيش شهور قديمة تتأرشف', 'error'); return; }
            askConfirm(`هنأرشف كل الشهور المنتهية دفعة واحدة (${ms.length} شهر: ${ms.join('، ')}). كل الفواتير والمصاريف والسلف والشيفتات والحجوزات المنتهية فيها هتتشال من الشغل اليومي والتقارير وتتحفظ هنا في الأرشيف، ورصيد الخزنة مش هيتغير. الشهر الحالي مش بيتأرشف. تقدر ترجّع أي شهر. نسخة ملف واحدة هتنزل على جهازك.`, () => {
                const recs = ms.map(arCommit).filter(Boolean); saveState();
                const blob = new Blob([JSON.stringify(recs, null, 1)], { type: 'application/json' }), a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'tommy-archive-all-' + getTodayISO() + '.json'; document.body.appendChild(a); a.click(); a.remove();
                renderAll(); showToast('تمت أرشفة ' + recs.length + ' شهر');
            }, 'أرشف الكل');
        }
        function arDo() {
            if (!currentUser?.permissions?.archive) { showToast('غير مصرح لك', 'error'); return; }
            const m = document.getElementById('ar-month').value; if (!m) { showToast('اختار الشهر', 'error'); return; }
            const d = arCollect(m), n = d.invoices.length + d.finExpenses.length + d.finAdv.length + d.shifts.length + d.bookings.length;
            if (!n) { showToast('مفيش بيانات في الشهر ده', 'error'); return; }
            const sm = arSummary(d, m);
            askConfirm(`هنأرشف شهر ${m}: ${d.invoices.length} فاتورة، ${d.shifts.length} شيفت، ${d.finExpenses.length} مصروف، ${d.finAdv.length} سلفة، ${d.bookings.length} حجز منتهي. هتتشال من الشاشات اليومية والتقارير، ورصيد الخزنة مش هيتغير. تنبيه: مرتبات وعمولات الشهر ده مش هتتحسب بعد الأرشفة، فاتأكد إنك صرفتها. الأرشيف بيتحفظ جوه البرنامج وبينزل منه نسخة ملف على جهازك.`, () => {
                const rec = arCommit(m); if (!rec) return; saveState(); arDownload(rec); renderAll(); showToast('تمت الأرشفة ونزلت نسخة على جهازك');
            }, 'أرشف');
        }
        function arRestore(id) {
            const rec = arArr().find(x => x.id === id); if (!rec) return;
            askConfirm(`هنرجّع شهر ${rec.month} للبرنامج وتتحسب تاني في التقارير. تكمل؟`, () => {
                const d = rec.data;
                appState.invoices = appState.invoices.concat(d.invoices).sort((a, b) => b.id - a.id);
                ['finExpenses', 'finAdv', 'advances', 'bookings', 'shifts'].forEach(k => { appState[k] = (appState[k] || []).concat(d[k] || []); });
                appState.vaultBase = Number(appState.vaultBase || 0) - Number(rec.vaultDelta || 0);
                appState.archive = arArr().filter(x => x.id !== id); if (archOpen === id) archOpen = null;
                logAudit('إرجاع شهر ' + rec.month + ' من الأرشيف'); saveState(); renderAll(); showToast('تم إرجاع الشهر');
            }, 'رجّعه');
        }
        function arOpen(id) { archOpen = archOpen === id ? null : id; archTab = 'inv'; renderArchive(); }
        function arTab(t) { archTab = t; renderArchive(); }
        function arPrint(id) {
            const r = arArr().find(x => x.id === id); if (!r) return; const S = getInvSettings(), fs = { sm: 10, md: 12, lg: 14 }[S.font] || 12, sm = r.summary;
            const row = (a, b, x) => `<div style="display:flex;justify-content:space-between;gap:8px;${x || ''}"><span>${a}</span><span>${b}</span></div>`;
            applyPaper(S);
            document.getElementById('printable-receipt').innerHTML = `<div style="font-size:${fs}px;line-height:1.6;color:#000"><div style="text-align:center;border-bottom:1px dashed #000;padding-bottom:6px;margin-bottom:6px"><div style="font-weight:900;font-size:1.4em">${esc(((S.title || '').trim() || (appState.salonInfo || {}).name || 'TOMMY BARBER').toUpperCase())}</div><b>ملخص شهر ${esc(r.month)} (أرشيف)</b></div>${row('عدد الفواتير', sm.invCount)}${row('عدد الشيفتات', sm.shiftCount)}${row('كسبت', arMoney(sm.income), 'font-weight:900')}${row('صرفت', arMoney(sm.out), 'font-weight:900')}${row('الباقي', arMoney(sm.net), 'font-weight:900;border-top:1px solid #000;margin-top:4px;padding-top:4px')}<div style="text-align:center;margin-top:6px;font-weight:900">${sm.net < 0 ? 'خسران' : (sm.net > 0 ? 'ربحان' : 'متعادل')}</div></div>`;
            document.getElementById('receipt-modal').classList.remove('hidden');
        }
        function arDetail(r) {
            const d = r.data, t = (k, l) => `<button onclick="arTab('${k}')" class="set-pill ${archTab === k ? 'on' : ''}">${l} (${(d[k === 'inv' ? 'invoices' : k === 'sh' ? 'shifts' : k === 'ex' ? 'finExpenses' : k === 'ad' ? 'finAdv' : 'bookings'] || []).length})</button>`;
            const line = (a, b, c) => `<div class="flex justify-between gap-2 border-t border-bordergold/30 pt-1.5"><span class="text-gray-300">${a}</span><span class="shrink-0 flex items-center gap-2">${b}${c || ''}</span></div>`;
            let body = '';
            if (archTab === 'inv') body = d.invoices.map(i => line(`<b class="text-white">#${i.id}</b> ${esc(i.date)} ${esc(i.clientName || '')} • ${esc(i.barberName || '')}${i.deleted ? ' <span class="text-red-400">(محذوفة)</span>' : ''}`, `<b class="text-gold">${arMoney(i.total)}</b>`)).join('');
            else if (archTab === 'sh') body = d.shifts.map(s => line(`<b class="text-white">شيفت ${s.no}</b> ${esc(s.cashierName || '')} • ${dwDT(s.closedAt)} • مرحّل ${arMoney(s.carried)}`, `<button onclick="openShiftReport('${s.id}', arFindShift('${r.id}','${s.id}'))" class="px-3 py-1 rounded-xl border border-bordergold bg-darkbg text-gray-200 font-bold">طباعة</button>`)).join('');
            else if (archTab === 'ex') body = d.finExpenses.map(e => line(`<b class="text-white">${esc(e.item)}</b> ${esc(e.date)} • ${e.src === 'drawer' ? 'من الدرج' : 'من الخزنة'}${e.note ? ' • ' + esc(e.note) : ''}`, `<b>${arMoney(e.amount)}</b>`)).join('');
            else if (archTab === 'ad') body = d.finAdv.map(a => line(`<b class="text-white">${esc(a.type)}</b> ${esc(a.staffName)} ${esc(a.date)}${a.note ? ' • ' + esc(a.note) : ''}`, `<b>${arMoney(a.amount)}</b>`)).join('');
            else body = d.bookings.map(b => line(`<b class="text-white">${esc(b.clientName)}</b> ${esc(b.type)} ${esc(b.date)} • ${esc(b.status)}`, `<b>${arMoney(bkNet(b))}</b>`)).join('');
            return `<div class="space-y-2 pt-2"><div class="flex flex-wrap gap-2">${t('inv', 'فواتير')}${t('sh', 'شيفتات')}${t('ex', 'مصاريف')}${t('ad', 'سلف')}${t('bk', 'حجوزات')}</div><div class="space-y-1.5 max-h-96 overflow-auto">${body || '<p class="text-gray-500">لا يوجد.</p>'}</div></div>`;
        }
        const arFindShift = (rid, sid) => { const r = arArr().find(x => x.id === rid); return r && r.data.shifts.find(s => s.id === sid); };
        function renderArchive() {
            const root = document.getElementById('view-archive'); if (!root) return;
            if (!currentUser?.permissions?.archive) { root.innerHTML = '<p class="text-gray-400 text-xs">للمدير فقط.</p>'; return; }
            const months = arMonths(), card = 'bg-panelbg border border-bordergold rounded-2xl p-4 space-y-2 text-xs';
            root.innerHTML = `<div class="${card}"><h2 class="text-sm font-black text-gold">أرشفة شهر</h2><p class="text-gray-300 leading-relaxed">بتنقل فواتير وشيفتات ومصاريف وسلف وحجوزات منتهية في شهر قديم من الشغل اليومي للأرشيف. الشهر الحالي مش بيتأرشف. تقدر تفتحه وتطبع منه وترجّعه في أي وقت.</p>
              <div class="flex gap-2"><select id="ar-month" class="flex-1 bg-darkbg border border-bordergold rounded-xl px-3 py-2 text-white">${months.map(m => `<option>${m}</option>`).join('') || '<option value="">مفيش شهور قديمة</option>'}</select><button onclick="arDo()" class="bg-gold text-black font-black px-4 rounded-xl">أرشف</button></div><button onclick="arDoAll()" class="w-full bg-darkbg border border-bordergold text-gold font-black py-2 rounded-xl">أرشفة كل الشهور المنتهية دفعة واحدة</button><div class="bg-darkbg rounded-xl p-3 text-gray-400 leading-relaxed"><b class="text-gray-200">الفرق بين الأرشيف والمسح:</b><br>• <b class="text-white">الأرشيف</b>: بيحفظ تاريخ الشهور القديمة بعيد عن الشغل اليومي والتقارير، وتقدر تفتحه وتطبعه وترجّعه.<br>• <b class="text-white">بداية جديدة / المسح</b> (من الإعدادات): بيمسح نهائي ومفيش رجوع.</div></div>
              ${arArr().map(r => `<div class="${card}"><div class="flex justify-between items-center"><b class="text-white text-sm">شهر ${esc(r.month)}</b><span class="text-gray-500">أُرشف ${dwDT(r.at)} • ${esc(r.by || '')}</span></div>
                <div class="grid grid-cols-3 gap-2 text-center"><div class="bg-darkbg rounded-xl p-2"><div class="text-gray-400">كسبت</div><b class="text-emerald-400">${arMoney(r.summary.income)}</b></div><div class="bg-darkbg rounded-xl p-2"><div class="text-gray-400">صرفت</div><b class="text-red-400">${arMoney(r.summary.out)}</b></div><div class="bg-darkbg rounded-xl p-2"><div class="text-gray-400">${r.summary.net < 0 ? 'خسران' : 'ربحان'}</div><b class="${r.summary.net < 0 ? 'text-red-400' : 'text-gold'}">${arMoney(Math.abs(r.summary.net))}</b></div></div>
                <div class="grid grid-cols-4 gap-2"><button onclick="arOpen('${r.id}')" class="bg-gold text-black font-black py-2 rounded-xl">${archOpen === r.id ? 'إخفاء' : 'فتح'}</button><button onclick="arPrint('${r.id}')" class="bg-darkbg border border-bordergold text-gray-200 font-bold py-2 rounded-xl">طباعة</button><button onclick="arDownload(arArr().find(x=>x.id==='${r.id}'))" class="bg-darkbg border border-bordergold text-gray-200 font-bold py-2 rounded-xl">ملف</button><button onclick="arRestore('${r.id}')" class="bg-darkbg border border-red-800 text-red-300 font-bold py-2 rounded-xl">إرجاع</button></div>${archOpen === r.id ? arDetail(r) : ''}</div>`).join('') || '<p class="text-gray-500 text-xs text-center py-6">لسه مفيش شهور مؤرشفة.</p>'}`;
        }
