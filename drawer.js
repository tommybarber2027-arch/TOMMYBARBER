        // ===================== DRAWER (shifts) + VAULT + PROFIT REPORT =====================
        // shift = {id,no,status:'open'|'closed',openedAt,cashierName,openBal,openFrom:{no,name},transfers:[{id,at,amount,by,note}],
        //          closed: closedAt,closedBy,counted,expected,diff,handover,leave,preTr,by,outs,invCount,bkCount,total}
        // appState.vaultAdj = [{id,at,amount,note}]   (manual deposit/withdraw on the vault)
        const dwP2 = n => String(n).padStart(2, '0');
        const dwBiz = iso => localISO(new Date(new Date(iso).getTime() - BIZ_SHIFT));
        const dwISO = d => `${d.getFullYear()}-${dwP2(d.getMonth() + 1)}-${dwP2(d.getDate())}`;
        const dwMoney = n => Number(n || 0).toLocaleString('en-US') + ' ج.م';
        const dwDT = iso => iso ? new Date(iso).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : '--';
        const DW_PAY = { cash: 'كاش', visa: 'فيزا', instapay: 'إنستاباي', wallet: 'محفظة' };
        const dwPayLabel = m => DW_PAY[m] || m || 'أخرى';
        const shiftsArr = () => (appState.shifts = appState.shifts || []);
        const curShift = () => shiftsArr().find(s => s.status === 'open');
        const canVault = () => !!(currentUser && currentUser.permissions && currentUser.permissions.drawer);
        const canEndShift = () => !!(currentUser && currentUser.permissions && currentUser.permissions.endShift);
        // التسليمات للخزنة: الشيفتات القديمة (قبل التعديل) كانت بتسلّم الكل عند القفل
        const shiftTransfers = s => s.transfers || (s.status === 'closed' && s.carried != null ? [{ id: 'lg' + s.id, at: s.closedAt, amount: Number(s.carried), by: s.closedBy || '', note: 'تسليم عند إغلاق الشيفت' }] : []);
        const shiftTransferTotal = s => shiftTransfers(s).reduce((t, x) => t + Number(x.amount || 0), 0);
        const lastClosedShift = () => shiftsArr().filter(x => x.status === 'closed').sort((a, b) => (b.no || 0) - (a.no || 0))[0];
        function ensureShift() {
            let s = curShift();
            if (s && currentUser && s.cashierName !== currentUser.displayName && !appState.invoices.some(i => i.shiftId === s.id) && !drawerOuts(s.id).length && !bkShiftTouched(s.id) && !(s.transfers || []).length) { s.cashierName = currentUser.displayName; saveState(); }
            if (!s) {
                const prev = lastClosedShift();
                s = { id: 'sh' + Date.now().toString(36), no: shiftsArr().reduce((m, x) => Math.max(m, x.no || 0), 0) + 1, status: 'open', openedAt: new Date().toISOString(), cashierName: currentUser ? currentUser.displayName : '', openBal: prev ? Number(prev.leave || 0) : 0, openFrom: prev ? { no: prev.no, name: prev.closedBy || prev.cashierName || '' } : null, transfers: [] };
                shiftsArr().push(s); saveState();
            }
            return s;
        }
        (function () {
            const oc = window.closeModal;
            window.closeModal = function (id) {
                oc(id);
                if (id === 'receipt-modal' && window.__handover) { window.__handover = false; logoutUser(); showToast('الشيفت اتسلّم. الكاشير التاني يدخل بباسورده'); }
            };
        })();
        function dwClosedNote(inv) { const sh = shiftsArr().find(x => x.id === inv.shiftId); if (sh && sh.status === 'closed') showToast(`الفاتورة تابعة للشيفت رقم ${sh.no} المقفول، فأرقام الشيفت المقفول (والتسليم) ما اتغيرتش`, 'error'); }
        function drawerOuts(shiftId) {
            const e = (appState.finExpenses || []).filter(x => x.src === 'drawer' && x.shiftId === shiftId).map(x => ({ kind: 'مصروف', label: x.item, note: x.note || '', amount: Number(x.amount) }));
            const a = (appState.finAdv || []).filter(x => x.src === 'drawer' && x.shiftId === shiftId).map(x => ({ kind: x.type, label: x.staffName, note: x.note || '', amount: Number(x.amount) }));
            const r = bkPayList().filter(x => x.p.kind === 'رد' && x.p.src === 'drawer' && x.p.shiftId === shiftId).map(x => ({ kind: 'رد عربون', label: x.b.clientName, note: x.p.note || '', amount: Number(x.p.amount) }));
            return e.concat(a, r);
        }
        function shiftStats(s) {
            const openBal = Number(s.openBal || 0);
            if (s.status === 'closed' && s.by) {
                const outs = s.outs || [], outTotal = outs.reduce((t, o) => t + o.amount, 0), tr = shiftTransfers(s), trTotal = tr.reduce((t, x) => t + Number(x.amount), 0);
                return { by: s.by, outs, invCount: s.invCount || 0, bkCount: s.bkCount || 0, total: s.total || 0, outTotal, cash: s.by.cash || 0, openBal, transfers: tr, trTotal, preTr: s.preTr != null ? s.preTr : 0, expected: s.expected, counted: s.counted, diff: s.diff, handover: s.handover != null ? s.handover : (s.carried || 0), leave: s.leave || 0 };
            }
            const invs = appState.invoices.filter(i => !i.deleted && i.shiftId === s.id), by = {};
            invs.forEach(i => { const m = i.paymentMethod || 'cash'; by[m] = (by[m] || 0) + Number(i.total || 0) - Number(i.prepaid || 0); });
            const bps = bkPayList().filter(x => x.p.kind !== 'رد' && x.p.shiftId === s.id);
            bps.forEach(x => { const m = x.p.method || 'cash'; by[m] = (by[m] || 0) + Number(x.p.amount); });
            const outs = drawerOuts(s.id), outTotal = outs.reduce((t, o) => t + o.amount, 0), cash = by.cash || 0, tr = shiftTransfers(s), trTotal = tr.reduce((t, x) => t + Number(x.amount), 0);
            return { by, outs, invCount: invs.length, bkCount: bps.length, total: Object.values(by).reduce((t, v) => t + v, 0), outTotal, cash, openBal, transfers: tr, trTotal, preTr: trTotal, expected: openBal + cash - outTotal - trTotal };
        }
        const bkPayList = () => { const o = []; (appState.bookings || []).forEach(b => (b.pays || []).forEach(p => o.push({ b, p }))); return o; };
        const bkShiftTouched = id => bkPayList().some(x => x.p.shiftId === id);
        function vaultMoves() {
            const m = [];
            if (appState.vaultBase) m.push({ at: '0', label: 'رصيد مرحّل من الأرشيف', amount: Number(appState.vaultBase) });
            bkPayList().filter(x => x.p.kind === 'رد' && x.p.src !== 'drawer').forEach(x => m.push({ at: x.p.at, label: 'رد عربون: ' + x.b.clientName, amount: -Number(x.p.amount) }));
            shiftsArr().forEach(s => shiftTransfers(s).forEach(t => m.push({ at: t.at, label: `تسليم من الدرج (شيفت ${s.no})${t.by ? ' - استلمه ' + t.by : ''}`, amount: Number(t.amount) })));
            (appState.vaultAdj || []).forEach(a => m.push({ at: a.at, label: (a.amount >= 0 ? 'إيداع: ' : 'سحب: ') + (a.note || ''), amount: Number(a.amount) }));
            (appState.finExpenses || []).filter(x => x.src !== 'drawer').forEach(x => m.push({ at: x.at || x.date, label: 'مصروف: ' + x.item, amount: -Number(x.amount) }));
            (appState.finAdv || []).filter(x => x.src !== 'drawer').forEach(x => m.push({ at: x.at || x.date, label: `${x.type} - ${x.staffName}`, amount: -Number(x.amount) }));
            return m.sort((a, b) => String(b.at).localeCompare(String(a.at)));
        }
        const vaultBalance = () => vaultMoves().reduce((t, m) => t + m.amount, 0);
        // called by finance forms: confirm if the drawer has less cash than the amount
        function dwCheckDrawer(src, amount, go) {
            if (src !== 'drawer') return go();
            const s = ensureShift(), st = shiftStats(s);
            if (amount > st.expected) askConfirm(`الدرج فيه ${dwMoney(st.expected)} بس، والمبلغ ${dwMoney(amount)}. تكمل برضه؟`, go, 'كمّل'); else go();
        }
        // ---------- إنهاء الشيفت (من شاشة فاتورة جديدة أو من الخزنة) ----------
        function closeShiftDlg() {
            if (!canEndShift()) { showToast('مفيش صلاحية إنهاء الشيفت', 'error'); return; }
            const s = curShift(); if (!s) return; const st = shiftStats(s), inp = 'w-full bg-darkbg border border-bordergold rounded-xl px-3 py-2 text-white text-center font-black text-lg';
            askBox('إنهاء الشيفت', `<div class="text-xs text-gray-300 space-y-1 leading-relaxed"><div class="flex justify-between"><span>رصيد أول الشيفت${s.openFrom ? ' (من شيفت ' + s.openFrom.no + ')' : ''}</span><b>${dwMoney(st.openBal)}</b></div><div class="flex justify-between"><span>كاش المبيعات</span><b>${dwMoney(st.cash)}</b></div><div class="flex justify-between"><span>خرج من الدرج</span><b>- ${dwMoney(st.outTotal)}</b></div>${st.trTotal ? `<div class="flex justify-between"><span>اتسلّم للخزنة قبل كده</span><b>- ${dwMoney(st.trTotal)}</b></div>` : ''}<div class="flex justify-between border-t border-gold/40 pt-1 text-sm"><span class="text-white font-black">المفروض يبقى في الدرج</span><b class="text-gold">${dwMoney(st.expected)}</b></div></div>
              <label class="block text-gray-400 text-xs">عدّ الفلوس اللي في الدرج واكتب المبلغ</label><input id="cs-count" type="number" min="0" inputmode="decimal" class="${inp}">
              <p id="cs-diff" class="text-center font-black text-sm min-h-[1.25rem]"></p>
              <div class="grid grid-cols-2 gap-2"><div><label class="block text-gray-400 text-xs mb-1">هسلّم للخزنة</label><input id="cs-hand" type="number" min="0" inputmode="decimal" placeholder="0" class="${inp}"></div><div><label class="block text-gray-400 text-xs mb-1">هسيب في الدرج</label><input id="cs-leave" type="number" min="0" inputmode="decimal" placeholder="0" class="${inp}"></div></div>
              <p id="cs-sum" class="text-center text-xs text-gray-400 min-h-[1rem]"></p>
              <p class="text-[11px] text-gray-500 leading-relaxed">المجموع لازم يساوي اللي عدّيته. لو المدير مش موجود اكتب صفر في "هسلّم للخزنة" وسيب الفلوس كلها في الدرج، والمدير يسجّل التسليم بعدين من الخزنة. الشيفت الجاي هيبدأ بالمبلغ اللي هتسيبه.</p>`, d => {
                const q = x => d.querySelector(x), v = q('#cs-count').value;
                if (v === '' || Number(v) < 0) { showToast('اكتب المبلغ اللي عديته', 'error'); return false; }
                const counted = Number(v), hand = Number(q('#cs-hand').value || 0), leave = Number(q('#cs-leave').value || 0);
                if (hand < 0 || leave < 0) { showToast('الأرقام لازم تكون موجبة', 'error'); return false; }
                if (Math.abs(hand + leave - counted) > 0.001) { showToast(`التسليم + اللي هتسيبه (${hand + leave}) لازم يساوي المعدود (${counted})`, 'error'); return false; }
                doCloseShift(s.id, counted, hand);
            }, 'إنهاء الشيفت');
            setTimeout(() => {
                const d = document.getElementById('ask-box'); if (!d) return; const c = d.querySelector('#cs-count'), h = d.querySelector('#cs-hand'), l = d.querySelector('#cs-leave');
                const upd = () => { const v = c.value === '' ? null : Number(c.value), df = d.querySelector('#cs-diff'), sm = d.querySelector('#cs-sum'); if (v === null) { df.textContent = ''; sm.textContent = ''; return; } const x = v - st.expected; df.textContent = x === 0 ? 'مظبوط ✔' : (x > 0 ? 'زيادة ' + dwMoney(x) : 'عجز ' + dwMoney(-x)); df.className = 'text-center font-black text-sm min-h-[1.25rem] ' + (x === 0 ? 'text-emerald-400' : (x > 0 ? 'text-sky-300' : 'text-red-400')); const t = Number(h.value || 0) + Number(l.value || 0); sm.textContent = `المجموع ${dwMoney(t)} من ${dwMoney(v)}` + (Math.abs(t - v) < 0.001 ? ' ✔' : ''); };
                c.oninput = () => { if (h.value !== '' && l.value === '') l.value = Math.max(0, Number(c.value || 0) - Number(h.value)); else if (h.value === '' && l.value !== '') h.value = Math.max(0, Number(c.value || 0) - Number(l.value)); upd(); };
                h.oninput = () => { if (c.value !== '') l.value = Math.max(0, Number(c.value) - Number(h.value || 0)); upd(); };
                l.oninput = () => { if (c.value !== '') h.value = Math.max(0, Number(c.value) - Number(l.value || 0)); upd(); };
            }, 0);
        }
        function doCloseShift(id, counted, hand) {
            const s = shiftsArr().find(x => x.id === id); if (!s || s.status !== 'open') return; const st = shiftStats(s), me = currentUser ? currentUser.displayName : '';
            hand = Number(hand || 0); const leave = counted - hand, tr = (s.transfers || []).slice();
            if (hand > 0) tr.push({ id: 'tr' + Date.now().toString(36), at: new Date().toISOString(), amount: hand, by: me, note: 'تسليم عند إنهاء الشيفت' });
            Object.assign(s, { status: 'closed', closedAt: new Date().toISOString(), closedBy: me, counted, expected: st.expected, diff: counted - st.expected, handover: hand, leave, carried: hand, preTr: st.trTotal, transfers: tr, by: st.by, outs: st.outs, invCount: st.invCount, bkCount: st.bkCount, total: st.total });
            logAudit(`إنهاء الشيفت رقم ${s.no}: معدود ${counted}، للخزنة ${hand}، في الدرج ${leave}`);
            window.__handover = true; saveState(); renderAll(); showToast('تم إنهاء الشيفت - اطبع التقرير وبعدها هيتقفل الدخول للتسليم'); openShiftReport(s.id);
        }
        // المدير يسجّل استلام فلوس من الدرج للخزنة (بعدين لو الكاشير سابها في الدرج)
        function drawerToVaultDlg() {
            if (!canVault()) { showToast('مفيش صلاحية للخزنة', 'error'); return; }
            const s = ensureShift(), st = shiftStats(s);
            askBox('تسليم من الدرج للخزنة', `<p class="text-gray-300 text-xs leading-relaxed">اللي في الدرج دلوقتي: <b class="text-gold">${dwMoney(st.expected)}</b>. اعدّ الفلوس مع الكاشير واكتب المبلغ اللي استلمته. الدرج هينقص والخزنة هتزيد بنفس المبلغ.</p><input id="dv-amt" type="number" min="0" inputmode="decimal" placeholder="المبلغ" value="${st.expected > 0 ? st.expected : ''}" class="w-full bg-darkbg border border-bordergold rounded-xl px-3 py-2 text-white text-center font-black text-lg"><input id="dv-note" placeholder="ملاحظة (اختياري)" class="w-full bg-darkbg border border-bordergold rounded-xl px-3 py-2 text-white">`, d => {
                const a = Number(d.querySelector('#dv-amt').value); if (!(a > 0)) { showToast('اكتب المبلغ', 'error'); return false; }
                const go = () => { (s.transfers = s.transfers || []).push({ id: 'tr' + Date.now().toString(36), at: new Date().toISOString(), amount: a, by: currentUser ? currentUser.displayName : '', note: d.querySelector('#dv-note').value.trim() || 'تسليم من الدرج للخزنة' }); logAudit(`تسليم من الدرج للخزنة: ${a} (شيفت ${s.no})`); saveState(); renderAll(); showToast('تم تسجيل التسليم للخزنة'); };
                if (a > st.expected) { askConfirm(`المبلغ أكبر من اللي في الدرج (${dwMoney(st.expected)}). تكمل؟`, go, 'كمّل'); return false; }
                go();
            }, 'سجّل التسليم');
        }
        function vaultAdjDlg() {
            askBox('تعديل رصيد الخزنة', `<select id="va-type" class="w-full bg-darkbg border border-bordergold rounded-xl px-3 py-2 text-white"><option value="1">إيداع (زيادة)</option><option value="-1">سحب (نقص)</option></select><input id="va-amt" type="number" min="0" placeholder="المبلغ" class="w-full bg-darkbg border border-bordergold rounded-xl px-3 py-2 text-white"><input id="va-note" placeholder="السبب (مثلاً: رصيد أول المدة)" class="w-full bg-darkbg border border-bordergold rounded-xl px-3 py-2 text-white">`, d => {
                const amt = Number(d.querySelector('#va-amt').value), note = d.querySelector('#va-note').value.trim();
                if (!(amt > 0) || !note) { showToast('اكتب المبلغ والسبب', 'error'); return false; }
                const sign = Number(d.querySelector('#va-type').value);
                (appState.vaultAdj = appState.vaultAdj || []).push({ id: 'va' + Date.now(), at: new Date().toISOString(), amount: sign * amt, note });
                logAudit(`${sign > 0 ? 'إيداع في' : 'سحب من'} الخزنة: ${amt} (${note})`); saveState(); renderDrawer();
            }, 'حفظ');
        }
        function buildShiftHtml(s) {
            const S = getInvSettings(), si = appState.salonInfo || {}, st = shiftStats(s), name = ((S.title || '').trim() || si.name || 'TOMMY BARBER').toUpperCase();
            const fs = { sm: 10, md: 12, lg: 14 }[S.font] || 12, dash = 'border-bottom:1px dashed #000;padding-bottom:6px;margin-bottom:6px;', closed = s.status === 'closed';
            const row = (a, b, x) => `<div style="display:flex;justify-content:space-between;gap:8px;${x || ''}"><span>${a}</span><span>${b}</span></div>`, tot = 'font-weight:900;border-top:1px solid #000;margin-top:3px;padding-top:3px';
            let h = `<div style="font-size:${fs}px;line-height:1.55;color:#000"><div style="text-align:center;${dash}"><div class="rec-salon-name" style="font-weight:900;font-size:1.4em">${esc(name)}</div><div style="font-weight:900">تقرير الشيفت رقم ${s.no}${closed ? '' : ' (مؤقت)'}</div></div>`;
            h += `<div style="${dash}font-size:.92em">${row('الكاشير:', esc(s.cashierName || '-'))}${row('فتح:', dwDT(s.openedAt))}${row('قفل:', closed ? dwDT(s.closedAt) : '--')}${closed ? row('قفل الدرج:', esc(s.closedBy || '-')) : ''}</div>`;
            h += `<div style="${dash}"><b>رصيد أول الشيفت</b>${row(s.openFrom ? `مُرحَّل من شيفت ${s.openFrom.no}${s.openFrom.name ? ' (' + esc(s.openFrom.name) + ')' : ''}` : 'بداية', dwMoney(st.openBal), 'font-weight:900')}</div>`;
            h += `<div style="${dash}"><b>المبيعات (${st.invCount} فاتورة${st.bkCount ? ' + ' + st.bkCount + ' دفعة حجز' : ''})</b>` + (Object.keys(st.by).map(m => row(esc(dwPayLabel(m)), dwMoney(st.by[m]))).join('') || row('-', '-')) + row('إجمالي المبيعات', dwMoney(st.total), tot) + `</div>`;
            h += `<div style="${dash}"><b>اللي خرج من الدرج</b>` + (st.outs.length ? st.outs.map(o => row(`${esc(o.kind)}: ${esc(o.label)}${o.note ? ' - ' + esc(o.note) : ''}`, dwMoney(o.amount))).join('') : row('لا يوجد', '-')) + row('إجمالي الخارج', dwMoney(st.outTotal), tot) + `</div>`;
            const earlier = closed ? st.transfers.filter((x, i) => !(i === st.transfers.length - 1 && st.handover > 0 && x.note === 'تسليم عند إنهاء الشيفت')) : st.transfers;
            if (earlier.length) h += `<div style="${dash}"><b>تسليمات للخزنة أثناء الشيفت</b>${earlier.map(x => row(`${dwDT(x.at)}${x.by ? ' - ' + esc(x.by) : ''}`, dwMoney(x.amount))).join('')}</div>`;
            h += `<div>${row('رصيد أول الشيفت', dwMoney(st.openBal))}${row('+ كاش الفواتير', dwMoney(st.cash))}${row('- خرج من الدرج', dwMoney(st.outTotal))}${earlier.length ? row('- تسليمات سابقة', dwMoney(earlier.reduce((t, x) => t + Number(x.amount), 0))) : ''}${row('المتوقع في الدرج', dwMoney(st.expected), 'font-weight:900;border-top:1px solid #000;margin-top:3px;padding-top:3px')}`;
            if (closed) h += `${row('المبلغ المعدود', dwMoney(st.counted))}${row('الفرق على ' + esc(s.closedBy || 'الكاشير'), (st.diff === 0 ? 'مظبوط' : (st.diff > 0 ? 'زيادة ' : 'عجز ') + dwMoney(Math.abs(st.diff))), 'font-weight:900')}${row('سُلّم للخزنة', dwMoney(st.handover), 'font-size:1.1em;font-weight:900;border-top:1px solid #000;margin-top:4px;padding-top:4px')}${row('اتساب في الدرج (للشيفت الجاي)', dwMoney(st.leave), 'font-weight:900')}`;
            return h + `</div></div>`;
        }
        function openShiftReport(id, obj) {
            const s = obj || shiftsArr().find(x => x.id === id); if (!s) return;
            applyPaper(getInvSettings());
            document.getElementById('printable-receipt').innerHTML = buildShiftHtml(s);
            document.getElementById('receipt-modal').classList.remove('hidden');
        }
        // ---------- ملخص الدرج (يظهر في فاتورة جديدة) ----------
        function drawerBox(s, st, withBtns) {
            const outsHtml = st.outs.length ? st.outs.map(o => `<div class="flex justify-between border-t border-bordergold/40 pt-1.5"><span class="text-gray-300"><b class="text-white">${esc(o.kind)}</b> ${esc(o.label)}${o.note ? ' • ' + esc(o.note) : ''}</span><b class="text-red-300">- ${dwMoney(o.amount)}</b></div>`).join('') : '';
            const trHtml = st.transfers.map(x => `<div class="flex justify-between border-t border-bordergold/40 pt-1.5"><span class="text-gray-300"><b class="text-white">تسليم للخزنة</b> ${dwDT(x.at)}${x.by ? ' • ' + esc(x.by) : ''}</span><b class="text-amber-300">- ${dwMoney(x.amount)}</b></div>`).join('');
            return `<div class="flex justify-between items-center"><h3 class="text-sm font-black text-gold">الدرج - شيفت رقم ${s.no}</h3><span class="text-gray-400">فُتح ${dwDT(s.openedAt)} • ${esc(s.cashierName || '')}</span></div>
              <div class="flex justify-between"><span class="text-gray-300">رصيد أول الشيفت${s.openFrom ? ` <span class="text-gray-500">(مُرحَّل من شيفت ${s.openFrom.no}${s.openFrom.name ? ' - ' + esc(s.openFrom.name) : ''})</span>` : ''}</span><b class="text-white">${dwMoney(st.openBal)}</b></div>
              ${Object.keys(st.by).map(m => `<div class="flex justify-between"><span class="text-gray-300">مبيعات ${esc(dwPayLabel(m))}</span><b class="text-white">${dwMoney(st.by[m])}</b></div>`).join('') || '<p class="text-gray-500">مفيش مبيعات في الشيفت ده لسه.</p>'}
              <div class="flex justify-between"><span class="text-gray-300">عدد الفواتير</span><b class="text-white">${st.invCount}</b></div>${outsHtml}${trHtml}
              <div class="flex justify-between items-center border-t border-gold/50 pt-2"><span class="text-white font-black">في الدرج دلوقتي (كاش)</span><b class="text-gold text-xl">${dwMoney(st.expected)}</b></div>`;
        }
        function renderPosShift() {
            const root = document.getElementById('pos-shift-box'); if (!root) return;
            const s = curShift(); if (!s || !currentUser) { root.innerHTML = ''; return; }
            const st = shiftStats(s);
            root.innerHTML = `<div class="bg-panelbg border border-bordergold rounded-2xl p-4 space-y-2 text-xs mt-5">${drawerBox(s, st)}${canEndShift() ? `<button onclick="closeShiftDlg()" class="w-full bg-gold text-black font-black py-3 rounded-xl text-sm mt-1">إنهاء الشيفت</button>` : ''}</div>`;
        }
        function renderDrawer() {
            try { renderPosShift(); } catch (e) { console.error(e); }
            const root = document.getElementById('view-drawer'); if (!root) return;
            const s = curShift() || ensureShift(), st = shiftStats(s), card = 'bg-panelbg border border-bordergold rounded-2xl p-4 space-y-2 text-xs';
            const vault = canVault();
            const closed = shiftsArr().filter(x => x.status === 'closed').sort((a, b) => b.no - a.no).slice(0, 30);
            const mv = vault ? vaultMoves().slice(0, 12) : [];
            root.innerHTML = `
            <div class="${card}">${drawerBox(s, st)}
              <div class="grid grid-cols-2 gap-2 pt-1">${canEndShift() ? `<button onclick="closeShiftDlg()" class="bg-gold text-black font-black py-2.5 rounded-xl">إنهاء الشيفت</button>` : ''}<button onclick="openShiftReport('${s.id}')" class="bg-darkbg border border-bordergold text-gray-200 font-bold py-2.5 rounded-xl">طباعة تقرير مؤقت</button>${vault ? `<button onclick="drawerToVaultDlg()" class="col-span-2 bg-darkbg border border-amber-700 text-amber-300 font-bold py-2.5 rounded-xl">تسجيل تسليم من الدرج للخزنة</button>` : ''}</div></div>
            ${vault ? `<div class="${card}"><div class="flex justify-between items-center"><h3 class="text-sm font-black text-gold">الخزنة</h3><b class="text-xl ${vaultBalance() < 0 ? 'text-red-400' : 'text-emerald-400'}">${dwMoney(vaultBalance())}</b></div>
              <button onclick="vaultAdjDlg()" class="w-full bg-darkbg border border-bordergold text-gray-200 font-bold py-2 rounded-xl">إيداع / سحب يدوي</button>
              ${mv.map(m => `<div class="flex justify-between border-t border-bordergold/40 pt-1.5"><span class="text-gray-300">${esc(m.label)} <span class="text-gray-500">${esc(String(m.at).length > 10 ? dwDT(m.at) : m.at)}</span></span><b class="${m.amount < 0 ? 'text-red-300' : 'text-emerald-300'}">${m.amount < 0 ? '-' : '+'} ${dwMoney(Math.abs(m.amount))}</b></div>`).join('') || '<p class="text-gray-500">مفيش حركات في الخزنة لسه.</p>'}</div>
            <div class="${card}"><h3 class="text-sm font-black text-gold">الشيفتات السابقة</h3>${closed.map(x => `<div class="flex items-center justify-between gap-2 border-t border-bordergold/40 pt-1.5"><span class="text-gray-300"><b class="text-white">شيفت ${x.no}</b> ${dwDT(x.closedAt)} • ${esc(x.cashierName || '')}${x.closedBy && x.closedBy !== x.cashierName ? ' (قفل: ' + esc(x.closedBy) + ')' : ''}<br>مبيعات ${dwMoney(x.total)} • للخزنة ${dwMoney(x.handover != null ? x.handover : x.carried)} • في الدرج ${dwMoney(x.leave || 0)} • ${x.diff === 0 ? 'مظبوط' : (x.diff > 0 ? 'زيادة ' : 'عجز ') + dwMoney(Math.abs(x.diff))}</span><button onclick="openShiftReport('${x.id}')" class="px-3 py-1.5 rounded-xl border border-bordergold bg-darkbg text-gray-200 text-xs font-bold shrink-0">طباعة</button></div>`).join('') || '<p class="text-gray-500">لسه مفيش شيفت اتقفل.</p>'}</div>` : ''}`;
        }

        let plPeriod = 'month', plDate = '';
        function plRange() {
            const d = new Date((plDate || getTodayISO()) + 'T00:00:00'); let a = new Date(d), b = new Date(d);
            if (plPeriod === 'week') { a.setDate(d.getDate() - ((d.getDay() + 1) % 7)); b = new Date(a); b.setDate(a.getDate() + 6); }
            else if (plPeriod === 'month') { a = new Date(d.getFullYear(), d.getMonth(), 1); b = new Date(d.getFullYear(), d.getMonth() + 1, 0); }
            else if (plPeriod === 'year') { a = new Date(d.getFullYear(), 0, 1); b = new Date(d.getFullYear(), 11, 31); }
            return [dwISO(a), dwISO(b)];
        }
        function plSet(p) { plPeriod = p; renderPL(); }
        function renderPL() {
            const rep = document.getElementById('view-reports'); if (!rep) return;
            let box = document.getElementById('pl-box');
            if (!box) { box = document.createElement('div'); box.id = 'pl-box'; box.className = 'bg-panelbg border border-bordergold rounded-2xl p-4 space-y-3 text-xs'; rep.insertBefore(box, rep.firstChild); }
            if (!plDate) plDate = getTodayISO();
            const [from, to] = plRange(), inR = d => d && String(d).slice(0, 10) >= from && String(d).slice(0, 10) <= to;
            const bkInc = (typeof bkIncomeIn === 'function') ? bkIncomeIn(inR) : { income: 0, held: 0 };
            const income = appState.invoices.filter(i => !i.deleted && inR(i.date)).reduce((t, i) => t + Number(i.total || 0), 0) + bkInc.income;
            const exps = (appState.finExpenses || []).filter(e => inR(e.date)).reduce((t, e) => t + Number(e.amount), 0);
            const advs = (appState.finAdv || []).filter(a => inR(a.date)).reduce((t, a) => t + Number(a.amount), 0);
            const out = exps + advs, net = income - out;
            const sh = shiftsArr().filter(x => inR(x.openedAt ? dwBiz(x.openedAt) : '')).sort((a, b) => b.no - a.no);
            const pb = (k, l) => `<button onclick="plSet('${k}')" class="set-pill ${plPeriod === k ? 'on' : ''}">${l}</button>`;
            const kp = (l, v, c) => `<div class="bg-darkbg border border-bordergold rounded-xl p-3 text-center"><div class="text-gray-400">${l}</div><div class="font-black text-base ${c}">${dwMoney(v)}</div></div>`;
            box.innerHTML = `<div class="flex flex-wrap items-center gap-2"><h3 class="text-sm font-black text-gold ml-2">كسبت وصرفت</h3>${pb('day', 'يوم')}${pb('week', 'أسبوع')}${pb('month', 'شهر')}${pb('year', 'سنة')}<input type="date" value="${plDate}" onchange="plDate=this.value||plDate;renderPL()" class="bg-darkbg border border-bordergold rounded-xl px-3 py-1.5 text-white"></div>
              <p class="text-gray-500">من ${from} إلى ${to}</p>
              <div class="grid grid-cols-3 gap-2">${kp('كسبت', income, 'text-emerald-400')}${kp('صرفت', out, 'text-red-400')}${kp('الباقي', net, net < 0 ? 'text-red-400' : 'text-gold')}</div>
              <div class="rounded-xl py-2.5 text-center font-black text-base ${net < 0 ? 'bg-red-950/50 text-red-300 border border-red-800' : (net > 0 ? 'bg-emerald-950/50 text-emerald-300 border border-emerald-800' : 'bg-darkbg text-gray-300 border border-bordergold')}">${net < 0 ? 'خسران ' + dwMoney(-net) : (net > 0 ? 'ربحان ' + dwMoney(net) : 'متعادل')}</div>
              <div class="flex justify-between text-gray-300"><span>منها إيراد عربونات حجوزات ملغية</span><b>${dwMoney(bkInc.income)}</b></div><div class="flex justify-between text-gray-300"><span>عربونات حجوزات قادمة (مش محسوبة في كسبت)</span><b>${dwMoney(bkInc.held)}</b></div><div class="flex justify-between text-gray-300"><span>مصاريف الصالون</span><b>${dwMoney(exps)}</b></div><div class="flex justify-between text-gray-300"><span>سلف وخصومات العاملين</span><b>${dwMoney(advs)}</b></div>
              <p class="text-gray-500 leading-relaxed">الحساب ده كسبت (كل المبيعات) ناقص صرفت (المصاريف + السلف). مرتبات وعمولات العاملين نفسها مش داخلة فيه.</p>
              <div class="flex justify-between border-t border-bordergold/40 pt-2"><span class="text-white font-bold">في الدرج دلوقتي</span><b class="text-gold">${dwMoney(curShift() ? shiftStats(curShift()).expected : 0)}</b></div>${canVault() ? `<div class="flex justify-between"><span class="text-white font-bold">في الخزنة</span><b class="text-gold">${dwMoney(vaultBalance())}</b></div>` : ''}
              <div class="pt-1"><b class="text-white">الشيفتات في الفترة دي</b>${sh.map(x => { const t = shiftStats(x); return `<div class="flex justify-between border-t border-bordergold/40 pt-1.5 text-gray-300"><span><b class="text-white">شيفت ${x.no}</b> ${esc(x.cashierName || '')} • ${dwDT(x.openedAt)}</span><span>${dwMoney(t.total)}${x.status === 'open' ? ' (شغال)' : ''}</span></div>`; }).join('') || '<p class="text-gray-500">مفيش شيفتات في الفترة دي.</p>'}</div>`;
        }
