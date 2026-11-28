        // ===================== BOOKINGS (حجوزات + عربون + دفعات + إلغاء) =====================
        // appState.bookings = [{id,no,type,clientName,phone,barberId,barberName,pkgName,items:[{name,price,qty,category}],total,date,time,notes,
        //   status:'انتظار'|'مقبول'|'منفذ'|'ملغي', pays:[{id,at,amount,method,kind:'عربون'|'دفعة'|'رد',src,shiftId,note}], invId, cancel:{at,mode,refunded}}]
        let bkFilter = 'upcoming';
        const bkArr = () => (appState.bookings = appState.bookings || []);
        const bkMoney = n => Number(n || 0).toLocaleString('en-US') + ' ج.م';
        const bkPaid = b => (b.pays || []).filter(p => p.kind !== 'رد').reduce((t, p) => t + Number(p.amount), 0);
        const bkRefunded = b => (b.pays || []).filter(p => p.kind === 'رد').reduce((t, p) => t + Number(p.amount), 0);
        const bkNet = b => bkPaid(b) - bkRefunded(b);
        const bkRemain = b => Math.max(0, Number(b.total || 0) - bkNet(b));
        const bkActive = b => b.status === 'انتظار' || b.status === 'مقبول';
        const BK_PAYM = { cash: 'كاش', visa: 'فيزا', wallet: 'محفظة / إنستاباي' };
        function bkTime12(t) { if (!t) return '--'; const [h, m] = t.split(':').map(Number), ap = h >= 12 && h < 24 ? 'م' : 'ص', hh = h % 12 || 12; return `${hh}:${String(m).padStart(2, '0')} ${ap}`; }
        function bkSlots() { const o = []; for (let h = 12; h <= 26; h++) for (const m of [0, 30]) { if (h === 26 && m === 30) continue; const hh = h % 24; o.push(`${String(hh).padStart(2, '0')}:${String(m).padStart(2, '0')}`); } return o; }
        const bkSortKey = b => (b.date || '') + ' ' + String((Number((b.time || '12:00').split(':')[0]) < 12 ? 24 + Number(b.time.split(':')[0]) : Number(b.time.split(':')[0]))).padStart(2, '0') + (b.time || '').slice(2);
        // income recognition used by the profit report
        function bkIncomeIn(inR) {
            let income = 0, held = 0;
            bkArr().forEach(b => {
                if (b.status === 'ملغي') { const d = b.cancel && b.cancel.at ? dwBiz(b.cancel.at) : b.date; if (inR(d)) income += bkNet(b); }
                else if (bkActive(b)) held += bkNet(b);
            });
            return { income, held };
        }
        function bkStatusBadge(b) {
            const paid = bkNet(b), tag = (t, c) => `<span class="px-2 py-0.5 rounded-lg text-[11px] font-black ${c}">${t}</span>`;
            if (b.status === 'ملغي') return tag(b.cancel && b.cancel.mode === 'refund' ? 'ملغي ومردود' : 'ملغي (العربون محتفظ به)', 'bg-red-950/60 text-red-300');
            if (b.status === 'منفذ') return tag('منفذ - فاتورة ' + (b.invId || ''), 'bg-emerald-950/60 text-emerald-300');
            const pay = paid <= 0 ? tag('لم يُدفع', 'bg-darkbg text-gray-300') : (bkRemain(b) <= 0 ? tag('مدفوع بالكامل', 'bg-emerald-950/60 text-emerald-300') : tag('عربون', 'bg-golddark text-gold'));
            return (b.status === 'مقبول' ? tag('✔ تم التأكيد' + (b.confAt ? ' • ' + esc(dwDT(b.confAt)) : ''), 'bg-sky-950/60 text-sky-300') : b.noAns ? tag('📵 مردش - حاول تاني', 'bg-red-950/60 text-red-300') : tag('🆕 طلب جديد - لم يتم الاتصال', 'bg-amber-950/60 text-amber-300')) + ' ' + pay;
        }
        function setBkFilter(f) { bkFilter = f; renderBookings(); }
        function renderBookings() {
            const root = document.getElementById('view-bookings'); if (!root) return; setTimeout(() => { try { bpBadge(); } catch (e) { } }, 0);
            const all = bkArr(), pill = (k, l) => `<button onclick="setBkFilter('${k}')" class="set-pill ${bkFilter === k ? 'on' : ''}">${l}</button>`;
            let list = all.filter(b => bkFilter === 'upcoming' ? bkActive(b) : bkFilter === 'done' ? b.status === 'منفذ' : bkFilter === 'cancelled' ? b.status === 'ملغي' : true);
            list = list.sort((a, b) => bkFilter === 'upcoming' ? bkSortKey(a).localeCompare(bkSortKey(b)) : bkSortKey(b).localeCompare(bkSortKey(a)));
            const due = all.filter(bkActive).reduce((t, b) => t + bkRemain(b), 0), held = all.filter(bkActive).reduce((t, b) => t + bkNet(b), 0);
            const card = b => {
                const rem = bkRemain(b), act = bkActive(b);
                const pays = (b.pays || []).map(p => `<div class="flex justify-between text-gray-400 border-t border-bordergold/30 pt-1"><span>${p.kind} • ${esc(BK_PAYM[p.method] || p.method || '')} • ${esc(dwDT(p.at))}${p.note ? ' • ' + esc(p.note) : ''}${p.kind === 'رد' ? ' • من ' + (p.src === 'drawer' ? 'الدرج' : 'الخزنة') : ''}</span><b class="${p.kind === 'رد' ? 'text-red-300' : 'text-emerald-300'}">${p.kind === 'رد' ? '-' : '+'} ${bkMoney(p.amount)}</b></div>`).join('');
                const tdy = act && b.date === getTodayISO();
                return `<div class="bg-panelbg border border-bordergold rounded-2xl p-4 space-y-2 text-xs${tdy ? ' today-ring' : ''}">
                  ${tdy ? '<div><span class="px-2 py-0.5 rounded-lg bg-gold text-black text-[11px] font-black">النهارده</span></div>' : ''}<div class="flex justify-between gap-2 items-start"><div><b class="text-white text-sm">${esc(b.clientName)}</b> ${b.source === 'web' ? '<span class="px-2 py-0.5 rounded-lg bg-sky-950/60 text-sky-300 text-[11px] font-black">من صفحة الحجز</span>' : ''} <span class="px-2 py-0.5 rounded-lg bg-darkbg border border-bordergold text-gold text-[11px]">${esc(b.type)}</span><br><a href="tel:${esc(b.phone || '')}" class="text-gray-400" dir="ltr">${esc(b.phone || '')}</a></div><div class="text-left"><b class="text-gold">${esc(b.date)}</b><br><span class="text-gray-300">${bkTime12(b.time)}</span></div></div>
                  <div class="text-gray-300">الحلاق: <b class="text-white">${esc(b.barberName || '-')}</b> • الباكدج: <b class="text-white">${esc(b.pkgName || '-')}</b>${b.notes ? '<br>ملاحظات: ' + esc(b.notes) : ''}</div>
                  <div class="grid grid-cols-3 gap-2 text-center"><div class="bg-darkbg rounded-xl p-2"><div class="text-gray-400">الإجمالي</div><b class="text-white">${bkMoney(b.total)}</b></div><div class="bg-darkbg rounded-xl p-2"><div class="text-gray-400">المدفوع</div><b class="text-emerald-400">${bkMoney(bkNet(b))}</b></div><div class="bg-darkbg rounded-xl p-2"><div class="text-gray-400">المتبقي</div><b class="${rem > 0 && act ? 'text-red-300' : 'text-gray-300'}">${bkMoney(act ? rem : 0)}</b></div></div>
                  <div>${bkStatusBadge(b)}</div>${act && b.phone ? `<div class="grid ${b.status === 'مقبول' ? 'grid-cols-2' : 'grid-cols-3'} gap-2"><a href="tel:${esc(b.phone)}" class="text-center bg-emerald-900/50 border border-emerald-700 text-emerald-200 font-black py-2 rounded-xl">📞 اتصال</a><a target="_blank" href="https://wa.me/2${esc(String(b.phone).replace(/\D/g, '').replace(/^0/, ''))}" class="text-center bg-darkbg border border-emerald-700 text-emerald-300 font-bold py-2 rounded-xl">واتساب</a>${b.status === 'مقبول' ? '' : `<button onclick="bkNoAns('${b.id}')" class="bg-darkbg border border-red-800 text-red-300 font-bold py-2 rounded-xl">${b.noAns ? 'رجّعها (لسه ما كلمتوش)' : 'مردش'}</button>`}</div>` : ''}${pays}
                  <div class="grid grid-cols-2 gap-2 pt-1">${act ? `
                    <button onclick="bkAddPay('${b.id}')" class="bg-gold text-black font-black py-2 rounded-xl">إضافة دفعة</button>
                    <button onclick="bkConvert('${b.id}')" class="bg-darkbg border border-emerald-700 text-emerald-300 font-bold py-2 rounded-xl">تنفيذ وتحويل لفاتورة</button>
                    ${b.status === 'مقبول' ? `<button onclick="bkSetStatus('${b.id}','انتظار')" class="bg-darkbg border border-bordergold text-gray-200 font-bold py-2 rounded-xl">رجّعه طلب جديد</button>` : `<button onclick="bkSetStatus('${b.id}','مقبول')" class="bg-sky-900/60 border border-sky-600 text-sky-200 font-black py-2 rounded-xl">✔ تم التأكيد (كلمته)</button>`}
                    <button onclick="bkEdit('${b.id}')" class="bg-darkbg border border-bordergold text-gray-200 font-bold py-2 rounded-xl">تعديل</button>
                    <button onclick="bkCancel('${b.id}')" class="col-span-2 bg-red-950/40 border border-red-800 text-red-300 font-bold py-2 rounded-xl">إلغاء الحجز</button>` : ''}</div></div>`;
            };
            root.innerHTML = `<div class="flex flex-wrap items-center gap-2"><h2 class="text-sm font-black text-gold ml-2">الحجوزات</h2>${pill('upcoming', 'القادمة')}${pill('done', 'المنفذة')}${pill('cancelled', 'الملغية')}${pill('all', 'الكل')}<button onclick="bkEdit()" class="mr-auto bg-gold text-black font-black px-4 py-2 rounded-xl text-xs">+ حجز جديد</button><button onclick="bpPull()" class="bg-darkbg border border-bordergold text-gold font-bold px-3 py-2 rounded-xl text-xs">فحص الطلبات الجديدة</button>${currentUser && currentUser.permissions && currentUser.permissions.settings ? '<button onclick="switchTab(\'settings\');showSettingsPanel(\'booking\')" class="bg-darkbg border border-bordergold text-gold font-bold px-3 py-2 rounded-xl text-xs">إعدادات الحجز أونلاين</button>' : ''}</div>
              <div class="grid grid-cols-2 gap-2 text-xs"><div class="bg-panelbg border border-bordergold rounded-xl p-3 text-center"><div class="text-gray-400">مستحقات قادمة (متبقي)</div><b class="text-red-300 text-base">${bkMoney(due)}</b></div><div class="bg-panelbg border border-bordergold rounded-xl p-3 text-center"><div class="text-gray-400">عربونات مستلمة</div><b class="text-emerald-400 text-base">${bkMoney(held)}</b></div></div>
              ${list.map(card).join('') || '<p class="text-gray-400 text-xs text-center py-8">مفيش حجوزات هنا.</p>'}`;
        }
        // ---- add / edit ----
        let bkItems = [];
        function bkFormHtml(b) {
            const inp = 'w-full bg-darkbg border border-bordergold rounded-xl px-3 py-2 text-white', lbl = 'block text-gray-400 mb-1';
            const barbers = appState.barbers.filter(x => !x.hidden), cat = appState.catalog.filter(c => c.category !== 'cat_cafe');
            return `<div class="space-y-2 text-xs"><div class="grid grid-cols-2 gap-2"><div><label class="${lbl}">اسم العميل</label><input id="bk-name" class="${inp}" value="${esc(b ? b.clientName : '')}"></div><div><label class="${lbl}">الموبايل</label><input id="bk-phone" inputmode="tel" dir="ltr" class="${inp}" value="${esc(b ? b.phone : '')}"></div></div>
              <div class="grid grid-cols-2 gap-2"><div><label class="${lbl}">نوع الحجز</label><select id="bk-type" class="${inp}"><option ${b && b.type === 'عادي' ? 'selected' : ''}>عادي</option><option ${b && b.type === 'عريس' ? 'selected' : ''}>عريس</option></select></div><div><label class="${lbl}">الحلاق</label><select id="bk-barber" class="${inp}">${barbers.map(x => `<option value="${x.id}" ${b && b.barberId === x.id ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select></div></div>
              <div class="grid grid-cols-2 gap-2"><div><label class="${lbl}">اليوم</label><input id="bk-date" type="date" class="${inp}" value="${b ? b.date : getTodayISO()}"></div><div><label class="${lbl}">الساعة</label><select id="bk-time" class="${inp}">${bkSlots().map(t => `<option value="${t}" ${b && b.time === t ? 'selected' : ''}>${bkTime12(t)}</option>`).join('')}</select></div></div>
              <div><label class="${lbl}">الباكدج / الخدمات</label><div class="flex gap-2"><select id="bk-svc" class="${inp}"><option value="">اختار خدمة وأضفها...</option>${cat.map(c => `<option value="${c.id}">${esc(c.name)} - ${c.price}</option>`).join('')}</select><button type="button" onclick="bkAddSvc()" class="px-3 bg-gold text-black font-black rounded-xl">+</button></div>
                <div class="flex gap-2 mt-2"><input id="bk-cname" placeholder="أو باكدج مخصوصة (الاسم)" class="${inp}"><input id="bk-cprice" type="number" min="0" placeholder="سعر" class="${inp}" style="max-width:90px"><button type="button" onclick="bkAddCustom()" class="px-3 bg-darkbg border border-bordergold text-gold font-black rounded-xl">+</button></div><div id="bk-items" class="mt-2 space-y-1"></div></div>
              <div class="grid grid-cols-2 gap-2"><div><label class="${lbl}">الإجمالي المتفق عليه</label><input id="bk-total" type="number" min="0" class="${inp}" value="${b ? b.total : ''}"></div><div><label class="${lbl}">ملاحظات</label><input id="bk-notes" class="${inp}" value="${esc(b ? b.notes || '' : '')}"></div></div>
              ${b ? '' : `<div class="border-t border-bordergold/40 pt-2"><b class="text-white">عربون / دفعة مقدمة (اختياري)</b><div class="grid grid-cols-2 gap-2 mt-1"><input id="bk-dep" type="number" min="0" placeholder="المبلغ" class="${inp}"><select id="bk-depm" class="${inp}"><option value="cash">كاش</option><option value="visa">فيزا</option><option value="wallet">محفظة / إنستاباي</option></select></div></div>`}</div>`;
        }
        function bkRenderItems() {
            const box = document.getElementById('bk-items'); if (!box) return;
            box.innerHTML = bkItems.map((it, i) => `<div class="flex justify-between items-center bg-darkbg rounded-lg px-2 py-1"><span class="text-gray-200">${esc(it.name)} × ${it.qty}</span><span class="flex items-center gap-2"><b class="text-gold">${bkMoney(it.price * it.qty)}</b><button type="button" onclick="bkItems.splice(${i},1);bkRenderItems()" class="text-red-400 font-black">×</button></span></div>`).join('');
            const sum = bkItems.reduce((t, i) => t + i.price * i.qty, 0), tt = document.getElementById('bk-total'); if (tt && bkItems.length && (!tt.dataset.manual)) tt.value = sum;
        }
        function bkAddSvc() {
            const id = document.getElementById('bk-svc').value, c = appState.catalog.find(x => x.id === id); if (!c) return;
            const ex = bkItems.find(i => i.cid === c.id); if (ex) ex.qty++; else bkItems.push({ cid: c.id, name: c.name, price: Number(c.price), qty: 1, category: c.category });
            bkRenderItems();
        }
        function bkAddCustom() {
            const n = document.getElementById('bk-cname').value.trim(), p = Number(document.getElementById('bk-cprice').value);
            if (!n || !(p >= 0)) { showToast('اكتب اسم الباكدج وسعره', 'error'); return; }
            bkItems.push({ name: n, price: p, qty: 1, category: (appState.categories[0] || {}).id || 'cat_cut' }); document.getElementById('bk-cname').value = document.getElementById('bk-cprice').value = ''; bkRenderItems();
        }
        function bkEdit(id) {
            const b = id ? bkArr().find(x => x.id === id) : null;
            if (!appState.barbers.filter(x => !x.hidden).length) { showToast('ضيف حلاق الأول من قسم الفريق', 'error'); return; }
            bkItems = b ? JSON.parse(JSON.stringify(b.items || [])) : [];
            askBox(b ? 'تعديل الحجز' : 'حجز جديد', bkFormHtml(b), d => {
                const q = s => d.querySelector(s), name = q('#bk-name').value.trim(), phone = q('#bk-phone').value.trim(), total = Number(q('#bk-total').value);
                if (!name) { showToast('اكتب اسم العميل', 'error'); return false; }
                if (!(total > 0)) { showToast('اكتب الإجمالي المتفق عليه', 'error'); return false; }
                const bar = appState.barbers.find(x => x.id === q('#bk-barber').value), date = q('#bk-date').value, time = q('#bk-time').value;
                if (!date) { showToast('اختار اليوم', 'error'); return false; }
                const clash = bkArr().find(x => x.id !== (b && b.id) && bkActive(x) && x.date === date && x.time === time && bar && x.barberId === bar.id);
                const dep = b ? 0 : Number(q('#bk-dep').value || 0);
                if (dep > total) { showToast('العربون أكبر من الإجمالي', 'error'); return false; }
                const save = () => {
                    const rec = b || { id: 'bk' + Date.now().toString(36), no: bkArr().reduce((m, x) => Math.max(m, x.no || 0), 0) + 1, status: 'مقبول', pays: [] };
                    Object.assign(rec, { clientName: name, phone, type: q('#bk-type').value, barberId: bar ? bar.id : '', barberName: bar ? bar.name : '', date, time, total, notes: q('#bk-notes').value.trim(), items: JSON.parse(JSON.stringify(bkItems)), pkgName: bkItems.map(i => i.name).join(' + '), dur: bkItems.reduce((t, i) => t + (typeof bpSvcDur === 'function' ? bpSvcDur(i.cid) : 60) * (i.qty || 1), 0) || (rec.dur || 0) });
                    if (!b) { bkArr().unshift(rec); if (dep > 0) bkPush(rec, dep, q('#bk-depm').value, 'عربون', ''); }
                    logAudit((b ? 'تعديل' : 'إضافة') + ' حجز ' + name); saveState(); renderBookings(); renderDrawer(); byId('ask-box')?.remove();
                };
                if (clash) { askConfirm(`الحلاق عنده حجز تاني (${clash.clientName}) في نفس الميعاد. تكمل برضو؟`, save, 'كمّل'); return false; }
                save(); return false;
            }, b ? 'حفظ' : 'احفظ الحجز');
            bkRenderItems(); const tt = document.getElementById('bk-total'); if (tt) tt.oninput = () => { tt.dataset.manual = '1'; };
        }
        function bkPush(b, amount, method, kind, note, extra) {
            const s = ensureShift();
            b.pays = b.pays || [];
            b.pays.push(Object.assign({ id: 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 4), at: new Date().toISOString(), amount, method, kind, note, shiftId: s.id }, extra || {}));
            logAudit(`${kind} حجز ${b.clientName}: ${amount}`);
        }
        function bkNoAns(id) { const b = bkArr().find(x => x.id === id); if (!b) return; b.noAns = !b.noAns; saveState(); renderBookings(); }
        function bkSetStatus(id, st) { const b = bkArr().find(x => x.id === id); if (!b) return; b.status = st; if (st === 'مقبول') { b.confAt = Date.now(); b.confBy = currentUser ? currentUser.name || currentUser.username : ''; b.noAns = false; } else { delete b.confAt; } logAudit(`حجز ${b.clientName}: ${st}`); saveState(); renderBookings(); }
        function bkAddPay(id) {
            const b = bkArr().find(x => x.id === id); if (!b) return; const inp = 'w-full bg-darkbg border border-bordergold rounded-xl px-3 py-2 text-white';
            askBox('إضافة دفعة - ' + b.clientName, `<p class="text-gray-300 text-xs">الإجمالي ${bkMoney(b.total)} • المدفوع ${bkMoney(bkNet(b))} • المتبقي <b class="text-gold">${bkMoney(bkRemain(b))}</b></p><input id="bp-amt" type="number" min="0" placeholder="المبلغ" value="${bkRemain(b) || ''}" class="${inp}"><select id="bp-m" class="${inp}"><option value="cash">كاش (يدخل الدرج)</option><option value="visa">فيزا</option><option value="wallet">محفظة / إنستاباي</option></select><input id="bp-note" placeholder="ملاحظة (اختياري)" class="${inp}">`, d => {
                const a = Number(d.querySelector('#bp-amt').value); if (!(a > 0)) { showToast('اكتب المبلغ', 'error'); return false; }
                if (a > bkRemain(b)) { showToast('المبلغ أكبر من المتبقي', 'error'); return false; }
                bkPush(b, a, d.querySelector('#bp-m').value, bkNet(b) > 0 ? 'دفعة' : 'عربون', d.querySelector('#bp-note').value.trim()); saveState(); renderBookings(); renderDrawer(); showToast('تم تسجيل الدفعة');
            }, 'سجّل الدفعة');
        }
        function bkCancel(id) {
            const b = bkArr().find(x => x.id === id); if (!b) return; const net = bkNet(b), inp = 'w-full bg-darkbg border border-bordergold rounded-xl px-3 py-2 text-white';
            const body = net > 0 ? `<p class="text-gray-300 text-xs leading-relaxed">العميل دفع <b class="text-gold">${bkMoney(net)}</b>. اختار:</p><label class="flex items-center gap-2 text-gray-200 text-xs"><input type="radio" name="bc-mode" value="refund" checked class="accent-gold"> رد المبلغ للعميل</label><label class="flex items-center gap-2 text-gray-200 text-xs"><input type="radio" name="bc-mode" value="keep" class="accent-gold"> خصم العربون (يفضل ليك كإيراد)</label>
              <div id="bc-ref" class="space-y-2"><input id="bc-amt" type="number" min="0" max="${net}" value="${net}" class="${inp}" placeholder="المبلغ المردود"><select id="bc-src" class="${inp}"><option value="drawer">يتخصم من الدرج</option><option value="vault">يتخصم من الخزنة</option></select></div>` : '<p class="text-gray-300 text-xs">مفيش مبالغ مدفوعة. هيتلغي الحجز.</p>';
            askBox('إلغاء الحجز - ' + b.clientName, body, d => {
                let mode = 'keep', ref = 0, src = 'drawer';
                if (net > 0) { mode = d.querySelector('input[name=bc-mode]:checked').value; if (mode === 'refund') { ref = Number(d.querySelector('#bc-amt').value); src = d.querySelector('#bc-src').value; if (!(ref > 0) || ref > net) { showToast('المبلغ المردود غير صحيح', 'error'); return false; } } }
                const fin = () => {
                    if (mode === 'refund') bkPush(b, ref, 'cash', 'رد', 'رد مبلغ بعد إلغاء الحجز', { src, shiftId: src === 'drawer' ? ensureShift().id : '' });
                    b.status = 'ملغي'; b.cancel = { at: new Date().toISOString(), mode, refunded: ref };
                    logAudit(`إلغاء حجز ${b.clientName} (${mode === 'refund' ? 'رد ' + ref : 'خصم العربون'})`); saveState(); renderBookings(); renderDrawer(); byId('ask-box')?.remove(); showToast(mode === 'refund' ? 'تم رد المبلغ وإلغاء الحجز' : 'تم إلغاء الحجز');
                };
                if (mode === 'refund') { dwCheckDrawer(src, ref, fin); return false; }
                fin(); return false;
            }, 'تأكيد الإلغاء' + (net > 0 ? ' / تم رد المبلغ' : ''));
        }
        function bkConvert(id) {
            const b = bkArr().find(x => x.id === id); if (!b) return; const rem = bkRemain(b), inp = 'w-full bg-darkbg border border-bordergold rounded-xl px-3 py-2 text-white';
            askBox('تنفيذ الحجز وتحويله لفاتورة', `<p class="text-gray-300 text-xs leading-relaxed">الإجمالي ${bkMoney(b.total)} • المدفوع مقدماً ${bkMoney(bkNet(b))} • <b class="text-gold">المتبقي دلوقتي ${bkMoney(rem)}</b></p>${rem > 0 ? `<select id="bv-m" class="${inp}"><option value="cash">المتبقي كاش (يدخل الدرج)</option><option value="visa">المتبقي فيزا</option><option value="wallet">المتبقي محفظة / إنستاباي</option></select>` : ''}<p class="text-gray-500 text-xs">المبلغ المدفوع قبل كده مش هيتحسب مرتين.</p>`, d => {
                const m = rem > 0 ? d.querySelector('#bv-m').value : 'cash', items = (b.items || []).map(i => ({ name: i.name, price: i.price, qty: i.qty, category: i.category })), sum = items.reduce((t, i) => t + i.price * i.qty, 0);
                let discount = 0;
                if (sum > b.total) discount = sum - b.total; else if (sum < b.total) items.push({ name: b.pkgName ? 'فرق الباكدج' : (b.type === 'عريس' ? 'باكدج العريس' : 'حجز'), price: b.total - sum, qty: 1, category: (appState.categories[0] || {}).id || 'cat_cut' });
                const sub = items.reduce((t, i) => t + i.price * i.qty, 0), nextId = Math.max(appState.lastInvId || 0, appState.invoices.length ? Math.max(...appState.invoices.map(i => i.id)) : 0) + 1;
                const inv = { id: nextId, date: getTodayISO(), time: getTimeStr(), barberId: b.barberId, barberName: b.barberName, clientName: b.clientName, clientPhone: b.phone, notes: 'من حجز ' + (b.notes || ''), paymentMethod: m, subtotal: sub, discount, total: b.total, prepaid: bkNet(b), cashierName: currentUser ? currentUser.displayName : '', shiftId: ensureShift().id, deleted: false, items };
                appState.invoices.unshift(inv); b.status = 'منفذ'; b.invId = nextId;
                logAudit(`تنفيذ حجز ${b.clientName} وتحويله لفاتورة رقم ${nextId}`); saveState(); renderAll(); byId('ask-box')?.remove(); showToast('تم إنشاء الفاتورة رقم ' + nextId); openThermalReceipt(inv, false);
            }, 'نفّذ وأنشئ الفاتورة');
        }
