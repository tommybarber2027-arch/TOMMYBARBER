        // ===================== DRAWER (shifts) + VAULT + PROFIT REPORT =====================
        // appState.shifts = [{id,no,status:'open'|'closed',openedAt,closedAt,cashierName,counted,expected,diff,carried,by,outs,invCount,total}]
        // appState.vaultAdj = [{id,at,amount,note}]   (manual deposit/withdraw on the vault)
        const dwP2 = n => String(n).padStart(2, '0');
        const dwISO = d => `${d.getFullYear()}-${dwP2(d.getMonth() + 1)}-${dwP2(d.getDate())}`;
        const dwMoney = n => Number(n || 0).toLocaleString('en-US') + ' ج.م';
        const dwDT = iso => iso ? new Date(iso).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : '--';
        const DW_PAY = { cash: 'كاش', visa: 'فيزا', instapay: 'إنستاباي', wallet: 'محفظة' };
        const dwPayLabel = m => DW_PAY[m] || m || 'أخرى';
        const shiftsArr = () => (appState.shifts = appState.shifts || []);
        const curShift = () => shiftsArr().find(s => s.status === 'open');
        function ensureShift() {
            let s = curShift();
            if (!s) {
                s = { id: 'sh' + Date.now().toString(36), no: shiftsArr().reduce((m, x) => Math.max(m, x.no || 0), 0) + 1, status: 'open', openedAt: new Date().toISOString(), cashierName: currentUser ? currentUser.displayName : '' };
                shiftsArr().push(s); saveState();
            }
            return s;
        }
        function drawerOuts(shiftId) {
            const e = (appState.finExpenses || []).filter(x => x.src === 'drawer' && x.shiftId === shiftId).map(x => ({ kind: 'مصروف', label: x.item, note: x.note || '', amount: Number(x.amount) }));
            const a = (appState.finAdv || []).filter(x => x.src === 'drawer' && x.shiftId === shiftId).map(x => ({ kind: x.type, label: x.staffName, note: x.note || '', amount: Number(x.amount) }));
            return e.concat(a);
        }
        function shiftStats(s) {
            if (s.status === 'closed' && s.by) return { by: s.by, outs: s.outs || [], invCount: s.invCount || 0, total: s.total || 0, outTotal: (s.outs || []).reduce((t, o) => t + o.amount, 0), cash: s.by.cash || 0, expected: s.expected, counted: s.counted, diff: s.diff };
            const invs = appState.invoices.filter(i => !i.deleted && i.shiftId === s.id), by = {};
            invs.forEach(i => { const m = i.paymentMethod || 'cash'; by[m] = (by[m] || 0) + Number(i.total || 0); });
            const outs = drawerOuts(s.id), outTotal = outs.reduce((t, o) => t + o.amount, 0), cash = by.cash || 0;
            return { by, outs, invCount: invs.length, total: Object.values(by).reduce((t, v) => t + v, 0), outTotal, cash, expected: cash - outTotal };
        }
        function vaultMoves() {
            const m = [];
            shiftsArr().filter(s => s.status === 'closed').forEach(s => m.push({ at: s.closedAt, label: `ترحيل الشيفت رقم ${s.no}`, amount: Number(s.carried || 0) }));
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
        function closeShiftDlg() {
            const s = curShift(); if (!s) return; const st = shiftStats(s);
            askBox('إغلاق الشيفت وترحيل للخزنة', `<p class="text-gray-300 text-xs leading-relaxed">عدّ الفلوس اللي في الدرج واكتب المبلغ. المتوقع من الفواتير: <b class="text-gold">${dwMoney(st.expected)}</b></p><input id="cs-count" type="number" min="0" inputmode="decimal" placeholder="المبلغ المعدود" class="w-full bg-darkbg border border-bordergold rounded-xl px-3 py-2 text-white text-center font-black text-lg" oninput="const v=this.value===''?null:Number(this.value-${st.expected});document.getElementById('cs-diff').textContent=v===null?'':(v===0?'مظبوط ✔':(v>0?'زيادة '+v:'عجز '+(-v)))"><p id="cs-diff" class="text-center font-black text-sm min-h-[1.25rem]"></p>`, d => {
                const v = d.querySelector('#cs-count').value; if (v === '' || Number(v) < 0) { showToast('اكتب المبلغ اللي عديته', 'error'); return false; }
                doCloseShift(s.id, Number(v));
            }, 'رحّل للخزنة');
        }
        function doCloseShift(id, counted) {
            const s = shiftsArr().find(x => x.id === id); if (!s || s.status !== 'open') return; const st = shiftStats(s);
            Object.assign(s, { status: 'closed', closedAt: new Date().toISOString(), closedBy: currentUser ? currentUser.displayName : '', counted, expected: st.expected, diff: counted - st.expected, carried: counted, by: st.by, outs: st.outs, invCount: st.invCount, total: st.total });
            logAudit(`ترحيل الشيفت رقم ${s.no} للخزنة: ${counted} ج.م`);
            ensureShift(); saveState(); renderDrawer(); showToast('تم الترحيل للخزنة'); openShiftReport(s.id);
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
            const fs = { sm: 10, md: 12, lg: 14 }[S.font] || 12, dash = 'border-bottom:1px dashed #000;padding-bottom:6px;margin-bottom:6px;';
            const row = (a, b, x) => `<div style="display:flex;justify-content:space-between;gap:8px;${x || ''}"><span>${a}</span><span>${b}</span></div>`;
            let h = `<div style="font-size:${fs}px;line-height:1.55;color:#000"><div style="text-align:center;${dash}"><div class="rec-salon-name" style="font-weight:900;font-size:1.4em">${esc(name)}</div><div style="font-weight:900">تقرير الشيفت رقم ${s.no}${s.status === 'open' ? ' (مؤقت)' : ''}</div></div>`;
            h += `<div style="${dash}font-size:.92em">${row('الكاشير:', esc(s.cashierName || '-'))}${row('فتح:', dwDT(s.openedAt))}${row('قفل:', s.status === 'closed' ? dwDT(s.closedAt) : '--')}</div>`;
            h += `<div style="${dash}"><b>المبيعات (${st.invCount} فاتورة)</b>` + (Object.keys(st.by).map(m => row(esc(dwPayLabel(m)), dwMoney(st.by[m]))).join('') || row('-', '-')) + row('إجمالي المبيعات', dwMoney(st.total), 'font-weight:900;border-top:1px solid #000;margin-top:3px;padding-top:3px') + `</div>`;
            h += `<div style="${dash}"><b>اللي خرج من الدرج</b>` + (st.outs.length ? st.outs.map(o => row(`${esc(o.kind)}: ${esc(o.label)}${o.note ? ' - ' + esc(o.note) : ''}`, dwMoney(o.amount))).join('') : row('لا يوجد', '-')) + row('إجمالي الخارج', dwMoney(st.outTotal), 'font-weight:900;border-top:1px solid #000;margin-top:3px;padding-top:3px') + `</div>`;
            h += `<div>${row('كاش الفواتير', dwMoney(st.cash))}${row('المتوقع في الدرج', dwMoney(st.expected), 'font-weight:900')}`;
            if (s.status === 'closed') h += `${row('المبلغ المعدود', dwMoney(st.counted))}${row('الفرق', (st.diff === 0 ? 'مظبوط' : (st.diff > 0 ? 'زيادة ' : 'عجز ') + dwMoney(Math.abs(st.diff))), 'font-weight:900')}${row('المرحّل للخزنة', dwMoney(s.carried), 'font-size:1.15em;font-weight:900;border-top:1px solid #000;margin-top:4px;padding-top:4px')}`;
            return h + `</div></div>`;
        }
        function openShiftReport(id) {
            const s = shiftsArr().find(x => x.id === id); if (!s) return;
            applyPaper(getInvSettings());
            document.getElementById('printable-receipt').innerHTML = buildShiftHtml(s);
            document.getElementById('receipt-modal').classList.remove('hidden');
        }
        function renderDrawer() {
            const root = document.getElementById('view-drawer'); if (!root) return;
            const s = curShift() || ensureShift(), st = shiftStats(s), card = 'bg-panelbg border border-bordergold rounded-2xl p-4 space-y-2 text-xs';
            const outsHtml = st.outs.length ? st.outs.map(o => `<div class="flex justify-between border-t border-bordergold/40 pt-1.5"><span class="text-gray-300"><b class="text-white">${esc(o.kind)}</b> ${esc(o.label)}${o.note ? ' • ' + esc(o.note) : ''}</span><b class="text-red-300">- ${dwMoney(o.amount)}</b></div>`).join('') : '<p class="text-gray-500">مفيش حاجة خرجت من الدرج.</p>';
            const closed = shiftsArr().filter(x => x.status === 'closed').sort((a, b) => b.no - a.no).slice(0, 30);
            const mv = vaultMoves().slice(0, 10);
            root.innerHTML = `
            <div class="${card}"><div class="flex justify-between items-center"><h3 class="text-sm font-black text-gold">الدرج - الشيفت رقم ${s.no}</h3><span class="text-gray-400">فُتح ${dwDT(s.openedAt)} • ${esc(s.cashierName || '')}</span></div>
              ${Object.keys(st.by).map(m => `<div class="flex justify-between"><span class="text-gray-300">مبيعات ${esc(dwPayLabel(m))}</span><b class="text-white">${dwMoney(st.by[m])}</b></div>`).join('') || '<p class="text-gray-500">مفيش مبيعات في الشيفت ده لسه.</p>'}
              <div class="flex justify-between"><span class="text-gray-300">عدد الفواتير</span><b class="text-white">${st.invCount}</b></div>
              <div class="pt-1"><b class="text-white">اللي خرج من الدرج</b>${outsHtml}</div>
              <div class="flex justify-between items-center border-t border-gold/50 pt-2"><span class="text-white font-black">المتوقع في الدرج (كاش)</span><b class="text-gold text-xl">${dwMoney(st.expected)}</b></div>
              <div class="grid grid-cols-2 gap-2 pt-1"><button onclick="closeShiftDlg()" class="bg-gold text-black font-black py-2.5 rounded-xl">إغلاق الشيفت وترحيل</button><button onclick="openShiftReport('${s.id}')" class="bg-darkbg border border-bordergold text-gray-200 font-bold py-2.5 rounded-xl">طباعة تقرير مؤقت</button></div></div>
            <div class="${card}"><div class="flex justify-between items-center"><h3 class="text-sm font-black text-gold">الخزنة</h3><b class="text-xl ${vaultBalance() < 0 ? 'text-red-400' : 'text-emerald-400'}">${dwMoney(vaultBalance())}</b></div>
              <button onclick="vaultAdjDlg()" class="w-full bg-darkbg border border-bordergold text-gray-200 font-bold py-2 rounded-xl">إيداع / سحب يدوي</button>
              ${mv.map(m => `<div class="flex justify-between border-t border-bordergold/40 pt-1.5"><span class="text-gray-300">${esc(m.label)} <span class="text-gray-500">${esc(String(m.at).length > 10 ? dwDT(m.at) : m.at)}</span></span><b class="${m.amount < 0 ? 'text-red-300' : 'text-emerald-300'}">${m.amount < 0 ? '-' : '+'} ${dwMoney(Math.abs(m.amount))}</b></div>`).join('') || '<p class="text-gray-500">مفيش حركات في الخزنة لسه.</p>'}</div>
            <div class="${card}"><h3 class="text-sm font-black text-gold">الشيفتات السابقة</h3>${closed.map(x => `<div class="flex items-center justify-between gap-2 border-t border-bordergold/40 pt-1.5"><span class="text-gray-300"><b class="text-white">شيفت ${x.no}</b> ${dwDT(x.closedAt)} • ${esc(x.cashierName || '')}<br>مبيعات ${dwMoney(x.total)} • مرحّل ${dwMoney(x.carried)} • ${x.diff === 0 ? 'مظبوط' : (x.diff > 0 ? 'زيادة ' : 'عجز ') + dwMoney(Math.abs(x.diff))}</span><button onclick="openShiftReport('${x.id}')" class="px-3 py-1.5 rounded-xl border border-bordergold bg-darkbg text-gray-200 text-xs font-bold shrink-0">طباعة</button></div>`).join('') || '<p class="text-gray-500">لسه مفيش شيفت اتقفل.</p>'}</div>`;
        }

        // ---------- Profit & loss panel inside Reports ----------
        let plPeriod = 'month', plDate = '';
        function plRange() {
            const d = new Date((plDate || dwISO(new Date())) + 'T00:00:00'); let a = new Date(d), b = new Date(d);
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
            if (!plDate) plDate = dwISO(new Date());
            const [from, to] = plRange(), inR = d => d && String(d).slice(0, 10) >= from && String(d).slice(0, 10) <= to;
            const income = appState.invoices.filter(i => !i.deleted && inR(i.date)).reduce((t, i) => t + Number(i.total || 0), 0);
            const exps = (appState.finExpenses || []).filter(e => inR(e.date)).reduce((t, e) => t + Number(e.amount), 0);
            const advs = (appState.finAdv || []).filter(a => inR(a.date)).reduce((t, a) => t + Number(a.amount), 0);
            const out = exps + advs, net = income - out;
            const sh = shiftsArr().filter(x => inR((x.openedAt || '').slice(0, 10) && dwISO(new Date(x.openedAt)))).sort((a, b) => b.no - a.no);
            const pb = (k, l) => `<button onclick="plSet('${k}')" class="set-pill ${plPeriod === k ? 'on' : ''}">${l}</button>`;
            const kp = (l, v, c) => `<div class="bg-darkbg border border-bordergold rounded-xl p-3 text-center"><div class="text-gray-400">${l}</div><div class="font-black text-base ${c}">${dwMoney(v)}</div></div>`;
            box.innerHTML = `<div class="flex flex-wrap items-center gap-2"><h3 class="text-sm font-black text-gold ml-2">كسبت وصرفت</h3>${pb('day', 'يوم')}${pb('week', 'أسبوع')}${pb('month', 'شهر')}${pb('year', 'سنة')}<input type="date" value="${plDate}" onchange="plDate=this.value||plDate;renderPL()" class="bg-darkbg border border-bordergold rounded-xl px-3 py-1.5 text-white"></div>
              <p class="text-gray-500">من ${from} إلى ${to}</p>
              <div class="grid grid-cols-3 gap-2">${kp('كسبت', income, 'text-emerald-400')}${kp('صرفت', out, 'text-red-400')}${kp('الباقي', net, net < 0 ? 'text-red-400' : 'text-gold')}</div>
              <div class="rounded-xl py-2.5 text-center font-black text-base ${net < 0 ? 'bg-red-950/50 text-red-300 border border-red-800' : (net > 0 ? 'bg-emerald-950/50 text-emerald-300 border border-emerald-800' : 'bg-darkbg text-gray-300 border border-bordergold')}">${net < 0 ? 'خسران ' + dwMoney(-net) : (net > 0 ? 'ربحان ' + dwMoney(net) : 'متعادل')}</div>
              <div class="flex justify-between text-gray-300"><span>مصاريف الصالون</span><b>${dwMoney(exps)}</b></div><div class="flex justify-between text-gray-300"><span>سلف وخصومات العاملين</span><b>${dwMoney(advs)}</b></div>
              <p class="text-gray-500 leading-relaxed">الحساب ده كسبت (كل المبيعات) ناقص صرفت (المصاريف + السلف). مرتبات وعمولات العاملين نفسها مش داخلة فيه.</p>
              <div class="flex justify-between border-t border-bordergold/40 pt-2"><span class="text-white font-bold">في الدرج دلوقتي</span><b class="text-gold">${dwMoney(curShift() ? shiftStats(curShift()).expected : 0)}</b></div><div class="flex justify-between"><span class="text-white font-bold">في الخزنة</span><b class="text-gold">${dwMoney(vaultBalance())}</b></div>
              <div class="pt-1"><b class="text-white">الشيفتات في الفترة دي</b>${sh.map(x => { const t = shiftStats(x); return `<div class="flex justify-between border-t border-bordergold/40 pt-1.5 text-gray-300"><span><b class="text-white">شيفت ${x.no}</b> ${esc(x.cashierName || '')} • ${dwDT(x.openedAt)}</span><span>${dwMoney(t.total)}${x.status === 'open' ? ' (شغال)' : ''}</span></div>`; }).join('') || '<p class="text-gray-500">مفيش شيفتات في الفترة دي.</p>'}</div>`;
        }
