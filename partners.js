        // ===================== الشركاء: حساب تأسيس الشركة =====================
        // منفصل تماماً عن الدرج والخزنة والتقارير اليومية.
        // appState.partners = { list:[{id,name,target}], exp:[{id,date,item,amt,by,note}], tr:[{id,date,from,to,amt,note}],
        //                       owed:[{id,item,amt,note}], ext:[{id,date,item,amt,who,note}], seeded }
        // مساهمة الشريك = اللي دفعه للموردين + اللي سلّمه لشركاء - اللي استلمه من شركاء  (التحويلات بتتلغي مع بعض فمفيش حساب مرتين)
        const ptId = () => 'pt' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
        const ptR = n => Math.round((Number(n) || 0) * 100) / 100;
        const ptM = n => ptR(n).toLocaleString('en-US') + ' ج';
        let ptFilter = 'all', ptGroup = false;
        function ptData() {
            const p = appState.partners = appState.partners || {};
            if (!p.list || !p.list.length) p.list = [{ id: 'p_fady', name: 'فادي', target: 350000 }, { id: 'p_zizo', name: 'زيزو', target: 350000 }, { id: 'p_hani', name: 'هاني', target: 350000 }];
            p.exp = p.exp || []; p.tr = p.tr || []; p.owed = p.owed || []; p.ext = p.ext || [];
            return p;
        }
        const ptName = id => { const x = ptData().list.find(p => p.id === id); return x ? x.name : '—'; };
        function ptCalc() {
            const d = ptData(), rows = d.list.map(p => {
                const paid = d.exp.filter(e => e.by === p.id).reduce((s, e) => s + (Number(e.amt) || 0), 0),
                    sent = d.tr.filter(t => t.from === p.id).reduce((s, t) => s + (Number(t.amt) || 0), 0),
                    recv = d.tr.filter(t => t.to === p.id).reduce((s, t) => s + (Number(t.amt) || 0), 0), net = paid + sent - recv;
                return { p, paid: ptR(paid), sent: ptR(sent), recv: ptR(recv), net: ptR(net), rem: ptR((Number(p.target) || 0) - net) };
            });
            const total = ptR(d.exp.reduce((s, e) => s + (Number(e.amt) || 0), 0)), share = rows.length ? total / rows.length : 0;
            const debt = rows.map(r => ({ id: r.p.id, v: ptR(share - r.net) })), pay = debt.filter(x => x.v > 0.5).map(x => ({ ...x })), get = debt.filter(x => x.v < -0.5).map(x => ({ id: x.id, v: -x.v }));
            const settle = []; pay.forEach(a => { while (a.v > 0.5 && get.length) { const g = get.find(x => x.v > 0.5); if (!g) break; const m = Math.min(a.v, g.v); settle.push({ from: a.id, to: g.id, amt: ptR(m) }); a.v -= m; g.v -= m; } });
            return { rows, total, share: ptR(share), settle };
        }
        const ptNorm = s => String(s || '').replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/\s+/g, ' ').trim();
        const ptOpts = (sel, skip) => ptData().list.map(p => `<option value="${p.id}" ${p.id === sel ? 'selected' : ''} ${p.id === skip ? 'disabled' : ''}>${esc(p.name)}</option>`).join('');
        const ptInp = 'w-full bg-darkbg border border-bordergold rounded-xl px-3 py-2 text-white', ptLbl = 'block text-gray-400 mb-1 text-xs';
        function ptLog(t) { try { logAudit('الشركاء: ' + t); } catch (e) { } }
        function renderPartners() {
            const root = document.getElementById('view-partners'); if (!root) return;
            if (!currentUser?.permissions?.partners) { root.innerHTML = ''; return; }
            const d = ptData(), c = ptCalc(), card = 'bg-panelbg border border-bordergold rounded-2xl p-4 space-y-2 text-xs';
            const fl = id => ptFilter === id ? 'on' : '';
            const cards = c.rows.map(r => `<div class="${card}"><div class="flex items-center justify-between"><b class="text-white text-sm">${esc(r.p.name)}</b><span class="px-2 py-0.5 rounded-lg text-[11px] font-black ${r.rem <= 0 ? 'bg-emerald-950/60 text-emerald-300' : 'bg-amber-950/60 text-amber-300'}">${r.rem <= 0 ? (r.rem < 0 ? 'خلّص وزيادة ' + ptM(-r.rem) : 'خلّص حصته ✓') : 'متبقي عليه ' + ptM(r.rem)}</span></div>
                <div class="grid grid-cols-3 gap-2 text-center"><div class="bg-darkbg rounded-xl p-2"><div class="text-gray-400">دفع للموردين</div><b class="text-white">${ptM(r.paid)}</b></div><div class="bg-darkbg rounded-xl p-2"><div class="text-gray-400">سلّم لشركاء</div><b class="text-white">${ptM(r.sent)}</b></div><div class="bg-darkbg rounded-xl p-2"><div class="text-gray-400">استلم من شركاء</div><b class="text-white">${ptM(r.recv)}</b></div></div>
                <div class="flex justify-between"><span class="text-gray-400">مساهمته الصافية</span><b class="text-gold">${ptM(r.net)}</b></div><div class="flex justify-between"><span class="text-gray-400">حصته المتفق عليها</span><b class="text-white">${ptM(r.p.target)}</b></div></div>`).join('');
            const settle = c.settle.length ? c.settle.map(s => `<div class="flex justify-between bg-darkbg rounded-xl px-3 py-2"><span><b class="text-white">${esc(ptName(s.from))}</b> يدفع لـ <b class="text-white">${esc(ptName(s.to))}</b></span><b class="text-gold">${ptM(s.amt)}</b></div>`).join('') : '<p class="text-emerald-300">الحسابات متساوية، مفيش حد يدفع لحد.</p>';
            let list = d.exp.slice(); if (ptFilter !== 'all') list = list.filter(e => e.by === ptFilter);
            list.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')) || String(b.at || '').localeCompare(String(a.at || '')));
            let body;
            if (ptGroup) {
                const m = new Map(); list.forEach(e => { const k = ptNorm(e.item); const g = m.get(k) || { name: e.item, sum: 0, n: 0 }; g.sum += Number(e.amt) || 0; g.n++; m.set(k, g); });
                body = [...m.values()].sort((a, b) => b.sum - a.sum).map(g => `<div class="flex justify-between bg-darkbg rounded-xl px-3 py-2"><span class="text-white">${esc(g.name)} <span class="text-gray-500">(${g.n})</span></span><b class="text-gold">${ptM(g.sum)}</b></div>`).join('');
            } else {
                body = list.map(e => `<div class="flex items-center justify-between gap-2 bg-darkbg rounded-xl px-3 py-2"><div class="min-w-0"><div class="text-white font-bold truncate">${esc(e.item)}</div><div class="text-gray-500">${esc(e.date || '')} • دفعها ${esc(ptName(e.by))}${e.note ? ' • ' + esc(e.note) : ''}</div></div><div class="flex items-center gap-2 shrink-0"><b class="text-gold">${ptM(e.amt)}</b><button onclick="ptAddExp('${e.id}')" class="text-gray-300">✎</button><button onclick="ptDel('exp','${e.id}')" class="text-red-400 font-black">×</button></div></div>`).join('');
            }
            const owedTot = d.owed.reduce((s, x) => s + (Number(x.amt) || 0), 0), extTot = d.ext.reduce((s, x) => s + (Number(x.amt) || 0), 0);
            root.innerHTML = `<div class="flex flex-wrap items-center gap-2"><h2 class="text-sm font-black text-gold ml-2">الشركاء - تأسيس الشركة</h2>
                <button onclick="ptAddExp()" class="mr-auto bg-gold text-black font-black px-3 py-2 rounded-xl text-xs">+ مصروف</button><button onclick="ptAddTr()" class="bg-darkbg border border-bordergold text-gold font-black px-3 py-2 rounded-xl text-xs">+ تحويل بين شركاء</button><button onclick="ptEditPartners()" class="bg-darkbg border border-bordergold text-gray-300 font-bold px-3 py-2 rounded-xl text-xs">الشركاء والحصص</button></div>
              <p class="text-gray-400 text-xs leading-relaxed">الحساب ده منفصل تماماً عن الدرج والخزنة والتقارير. كل شريك: <b class="text-gray-200">اللي دفعه للموردين + اللي سلّمه لشركاء − اللي استلمه من شركاء</b>.</p>
              <div class="grid grid-cols-2 gap-2 text-xs"><div class="bg-panelbg border border-bordergold rounded-xl p-3 text-center"><div class="text-gray-400">إجمالي المصروف</div><b class="text-gold text-base">${ptM(c.total)}</b></div><div class="bg-panelbg border border-bordergold rounded-xl p-3 text-center"><div class="text-gray-400">نصيب كل شريك بالتساوي</div><b class="text-white text-base">${ptM(c.share)}</b></div></div>
              <div class="grid gap-2 md:grid-cols-3">${cards}</div>
              <div class="${card}"><h3 class="text-sm font-black text-white">التسوية (لو الإجمالي اتقسم بالتساوي)</h3>${settle}<p class="text-gray-500">الفلوس دي بتتسلّم بينكم بره البرنامج، وبعدها سجّل "تحويل بين شركاء" عشان الأرقام تتساوى.</p></div>
              <div class="${card}"><div class="flex flex-wrap items-center gap-2"><h3 class="text-sm font-black text-white ml-2">المصروفات (${list.length})</h3><button onclick="ptSetFilter('all')" class="set-pill ${fl('all')}">الكل</button>${d.list.map(p => `<button onclick="ptSetFilter('${p.id}')" class="set-pill ${fl(p.id)}">${esc(p.name)}</button>`).join('')}<button onclick="ptToggleGroup()" class="mr-auto set-pill ${ptGroup ? 'on' : ''}">${ptGroup ? 'عرض كل بند' : 'تجميع حسب الاسم'}</button></div><div class="space-y-1.5">${body || '<p class="text-gray-400 text-center py-4">مفيش مصروفات.</p>'}</div>
                ${!d.seeded && !d.exp.length ? '<button onclick="ptSeed()" class="w-full bg-darkbg border border-bordergold text-gold font-black py-2 rounded-xl">استيراد كشف فادي (36 بند)</button>' : ''}</div>
              <div class="${card}"><div class="flex items-center justify-between"><h3 class="text-sm font-black text-white">التزامات لسه ماتدفعتش (${ptM(owedTot)})</h3><button onclick="ptAddOwed()" class="bg-darkbg border border-bordergold text-gold font-black px-3 py-1.5 rounded-xl">+ التزام</button></div>${d.owed.map(x => `<div class="flex items-center justify-between gap-2 bg-darkbg rounded-xl px-3 py-2"><div class="min-w-0"><div class="text-white font-bold truncate">${esc(x.item)}</div>${x.note ? `<div class="text-gray-500">${esc(x.note)}</div>` : ''}</div><div class="flex items-center gap-2 shrink-0"><b class="text-amber-300">${ptM(x.amt)}</b><button onclick="ptPayOwed('${x.id}')" class="bg-gold text-black font-black px-2 py-1 rounded-lg">تم الدفع</button><button onclick="ptDel('owed','${x.id}')" class="text-red-400 font-black">×</button></div></div>`).join('') || '<p class="text-gray-500">مفيش.</p>'}<p class="text-gray-500">الالتزام مش بيتحسب مساهمة لحد لحد ما حد يدفعه.</p></div>
              <div class="${card}"><div class="flex items-center justify-between"><h3 class="text-sm font-black text-white">مدفوع من برّه الحساب (${ptM(extTot)})</h3><button onclick="ptAddExt()" class="bg-darkbg border border-bordergold text-gold font-black px-3 py-1.5 rounded-xl">+ إضافة</button></div>${d.ext.map(x => `<div class="flex items-center justify-between gap-2 bg-darkbg rounded-xl px-3 py-2"><div class="min-w-0"><div class="text-white font-bold truncate">${esc(x.item)}</div><div class="text-gray-500">دفعها ${esc(x.who || '')}${x.date ? ' • ' + esc(x.date) : ''}${x.note ? ' • ' + esc(x.note) : ''}</div></div><div class="flex items-center gap-2 shrink-0"><b class="text-gray-300">${ptM(x.amt)}</b><button onclick="ptDel('ext','${x.id}')" class="text-red-400 font-black">×</button></div></div>`).join('') || '<p class="text-gray-500">مفيش.</p>'}<p class="text-gray-500">للتوثيق بس (زي اللي بيدفعه زيكو). مش بيدخل في حساب الشركاء.</p></div>
              <div class="${card}"><div class="flex items-center justify-between"><h3 class="text-sm font-black text-white">التحويلات بين الشركاء (${d.tr.length})</h3></div>${d.tr.slice().sort((a, b) => String(b.date || '').localeCompare(String(a.date || ''))).map(t => `<div class="flex items-center justify-between gap-2 bg-darkbg rounded-xl px-3 py-2"><div class="min-w-0"><div class="text-white font-bold"><span>${esc(ptName(t.from))}</span> ← <span>${esc(ptName(t.to))}</span></div><div class="text-gray-500">${esc(t.date || '')}${t.note ? ' • ' + esc(t.note) : ''}</div></div><div class="flex items-center gap-2 shrink-0"><b class="text-gold">${ptM(t.amt)}</b><button onclick="ptAddTr('${t.id}')" class="text-gray-300">✎</button><button onclick="ptDel('tr','${t.id}')" class="text-red-400 font-black">×</button></div></div>`).join('') || '<p class="text-gray-500">مفيش.</p>'}</div>`;
        }
        function ptSetFilter(f) { ptFilter = f; renderPartners(); }
        function ptToggleGroup() { ptGroup = !ptGroup; renderPartners(); }
        function ptSave(msg) { saveState(); renderPartners(); if (msg) showToast(msg); }
        function ptAddExp(id) {
            const d = ptData(), e = id ? d.exp.find(x => x.id === id) : null;
            askBox(e ? 'تعديل مصروف' : 'مصروف جديد', `<div class="space-y-2"><div><label class="${ptLbl}">البند</label><input id="pt-item" class="${ptInp}" value="${esc(e ? e.item : '')}" placeholder="مثلاً: بلاط، نقاشة، كهرباء"></div><div class="grid grid-cols-2 gap-2"><div><label class="${ptLbl}">المبلغ</label><input id="pt-amt" type="number" min="0" inputmode="decimal" class="${ptInp}" value="${e ? e.amt : ''}"></div><div><label class="${ptLbl}">التاريخ</label><input id="pt-date" type="date" class="${ptInp}" value="${e ? e.date || '' : getTodayISO()}"></div></div><div><label class="${ptLbl}">مين دفعها للمورّد</label><select id="pt-by" class="${ptInp}">${ptOpts(e ? e.by : (ptFilter !== 'all' ? ptFilter : d.list[0].id))}</select></div><div><label class="${ptLbl}">ملاحظة (اختياري)</label><input id="pt-note" class="${ptInp}" value="${esc(e ? e.note || '' : '')}"></div></div>`, () => {
                const item = byId('pt-item').value.trim(), amt = Number(byId('pt-amt').value);
                if (!item) { showToast('اكتب البند', 'error'); return false; }
                if (!(amt > 0)) { showToast('اكتب مبلغ صحيح', 'error'); return false; }
                const rec = e || { id: ptId(), at: new Date().toISOString() }; Object.assign(rec, { item, amt, date: byId('pt-date').value, by: byId('pt-by').value, note: byId('pt-note').value.trim() });
                if (!e) d.exp.unshift(rec); ptLog(`${e ? 'تعديل' : 'إضافة'} مصروف ${item} ${amt} (${ptName(rec.by)})`); ptSave('تم الحفظ');
            }, 'حفظ');
        }
        function ptAddTr(id) {
            const d = ptData(), t = id ? d.tr.find(x => x.id === id) : null;
            askBox(t ? 'تعديل تحويل' : 'تحويل بين شركاء', `<div class="space-y-2"><div class="grid grid-cols-2 gap-2"><div><label class="${ptLbl}">من (سلّم)</label><select id="pt-from" class="${ptInp}">${ptOpts(t ? t.from : d.list[0].id)}</select></div><div><label class="${ptLbl}">إلى (استلم)</label><select id="pt-to" class="${ptInp}">${ptOpts(t ? t.to : (d.list[1] || d.list[0]).id)}</select></div></div><div class="grid grid-cols-2 gap-2"><div><label class="${ptLbl}">المبلغ</label><input id="pt-amt" type="number" min="0" inputmode="decimal" class="${ptInp}" value="${t ? t.amt : ''}"></div><div><label class="${ptLbl}">التاريخ</label><input id="pt-date" type="date" class="${ptInp}" value="${t ? t.date || '' : getTodayISO()}"></div></div><div><label class="${ptLbl}">ملاحظة (اختياري)</label><input id="pt-note" class="${ptInp}" value="${esc(t ? t.note || '' : '')}"></div></div>`, () => {
                const from = byId('pt-from').value, to = byId('pt-to').value, amt = Number(byId('pt-amt').value);
                if (from === to) { showToast('اختار شريكين مختلفين', 'error'); return false; }
                if (!(amt > 0)) { showToast('اكتب مبلغ صحيح', 'error'); return false; }
                const rec = t || { id: ptId() }; Object.assign(rec, { from, to, amt, date: byId('pt-date').value, note: byId('pt-note').value.trim() });
                if (!t) d.tr.unshift(rec); ptLog(`${t ? 'تعديل' : 'إضافة'} تحويل ${ptName(from)} ← ${ptName(to)} ${amt}`); ptSave('تم الحفظ');
            }, 'حفظ');
        }
        function ptAddOwed() {
            askBox('التزام جديد', `<div class="space-y-2"><div><label class="${ptLbl}">البند</label><input id="pt-item" class="${ptInp}" placeholder="مثلاً: متبقي الكاميرات"></div><div><label class="${ptLbl}">المبلغ المتبقي</label><input id="pt-amt" type="number" min="0" inputmode="decimal" class="${ptInp}"></div><div><label class="${ptLbl}">ملاحظة (اختياري)</label><input id="pt-note" class="${ptInp}"></div></div>`, () => {
                const item = byId('pt-item').value.trim(), amt = Number(byId('pt-amt').value);
                if (!item || !(amt > 0)) { showToast('اكتب البند والمبلغ', 'error'); return false; }
                ptData().owed.push({ id: ptId(), item, amt, note: byId('pt-note').value.trim() }); ptLog(`التزام ${item} ${amt}`); ptSave('تم الحفظ');
            }, 'حفظ');
        }
        function ptPayOwed(id) {
            const d = ptData(), o = d.owed.find(x => x.id === id); if (!o) return;
            askBox('تم دفع الالتزام', `<div class="space-y-2"><p class="text-gray-300 text-xs">${esc(o.item)} - المتبقي ${ptM(o.amt)}</p><div><label class="${ptLbl}">اللي اتدفع دلوقتي</label><input id="pt-amt" type="number" min="0" inputmode="decimal" class="${ptInp}" value="${o.amt}"></div><div><label class="${ptLbl}">مين دفعه</label><select id="pt-by" class="${ptInp}">${ptOpts(d.list[0].id)}</select></div><div><label class="${ptLbl}">التاريخ</label><input id="pt-date" type="date" class="${ptInp}" value="${getTodayISO()}"></div></div>`, () => {
                const amt = Number(byId('pt-amt').value);
                if (!(amt > 0) || amt > o.amt + 0.001) { showToast('المبلغ لازم يكون أكبر من صفر ومايزيدش عن المتبقي', 'error'); return false; }
                const by = byId('pt-by').value;
                d.exp.unshift({ id: ptId(), at: new Date().toISOString(), item: o.item, amt, date: byId('pt-date').value, by, note: 'من التزام' });
                o.amt = ptR(o.amt - amt); if (o.amt <= 0.001) d.owed = d.owed.filter(x => x.id !== id);
                ptLog(`دفع التزام ${o.item} ${amt} (${ptName(by)})`); ptSave('تم تسجيل الدفع كمساهمة');
            }, 'تسجيل');
        }
        function ptAddExt() {
            askBox('مدفوع من برّه الحساب', `<div class="space-y-2"><div><label class="${ptLbl}">البند</label><input id="pt-item" class="${ptInp}" placeholder="مثلاً: شحن كارت كهرباء"></div><div class="grid grid-cols-2 gap-2"><div><label class="${ptLbl}">المبلغ</label><input id="pt-amt" type="number" min="0" inputmode="decimal" class="${ptInp}"></div><div><label class="${ptLbl}">مين دفعها</label><input id="pt-who" class="${ptInp}" value="زيكو"></div></div><div><label class="${ptLbl}">ملاحظة (اختياري)</label><input id="pt-note" class="${ptInp}"></div></div>`, () => {
                const item = byId('pt-item').value.trim(), amt = Number(byId('pt-amt').value);
                if (!item || !(amt > 0)) { showToast('اكتب البند والمبلغ', 'error'); return false; }
                ptData().ext.unshift({ id: ptId(), item, amt, who: byId('pt-who').value.trim(), date: getTodayISO(), note: byId('pt-note').value.trim() }); ptLog(`مدفوع من برّه الحساب ${item} ${amt}`); ptSave('تم الحفظ');
            }, 'حفظ');
        }
        function ptDel(kind, id) {
            askConfirm('تحذف السجل ده؟', () => { const d = ptData(); d[kind] = d[kind].filter(x => x.id !== id); ptLog('حذف سجل من ' + kind); ptSave(); }, 'احذف');
        }
        function ptEditPartners() {
            const d = ptData();
            askBox('الشركاء والحصص', `<div class="space-y-2">${d.list.map((p, i) => `<div class="grid grid-cols-2 gap-2"><input id="pn-${i}" class="${ptInp}" value="${esc(p.name)}"><input id="pg-${i}" type="number" min="0" class="${ptInp}" value="${p.target}"></div>`).join('')}<p class="text-gray-500 text-xs">الاسم والحصة المتفق عليها لكل شريك.</p></div>`, () => {
                const vals = d.list.map((p, i) => ({ name: byId('pn-' + i).value.trim(), target: Number(byId('pg-' + i).value) }));
                if (vals.some(v => !v.name || !(v.target >= 0))) { showToast('راجع الأسماء والحصص', 'error'); return false; }
                d.list.forEach((p, i) => { p.name = vals[i].name; p.target = vals[i].target; }); ptLog('تعديل الشركاء والحصص'); ptSave('تم الحفظ');
            }, 'حفظ');
        }
        // استيراد كشف فادي الأولي (مرة واحدة). z = دفعها زيكو (برّه الحساب)، y = دفعها زيزو
        const PT_SEED = [['بضاعة الكهرباء', 20000], ['مصنعية محمد الكهربائي', 5000], ['أدوات تنظيف', 500], ['شحن كارت الكهرباء', 200], ['دفع استلام شحن الأربع أعدان', 70], ['أبو السعود', 10000], ['خطوط فودافون', 450], ['شحن كارت الكهرباء', 500, 'z'], ['جمال النجار', 250], ['مسامير زائد زاوية', 130], ['أدوات لتنظيف القزاز الواجهة', 150], ['أكل للنظافة القزاز والأرضية', 150], ['شحن كارت الكهرباء', 500], ['شحن كارت المياه', 500, 'z'], ['قير الباركيه', 200], ['سيليكون للباركيه', 120], ['جمال النجار للباركيه', 1700], ['أنس', 5000], ['ما شابك للسيراميك', 130], ['مادة لزق السيراميك', 1260], ['بلاط', 11000, 'y'], ['تسقية البلاط بالألوان', 170], ['مصنعية تركيب البلاط بالوزر', 3500], ['حسين النقاش', 10000], ['حسين النقاش', 5000], ['تنظيف المكان ورمي الزبالة', 250], ['خرطوم 6 م للتكييف', 170], ['ترسيكل الخشب من البيت الحديث', 150], ['أبو السعود', 16000], ['شحن كارت الكهرباء', 500, 'z'], ['شحن كارت المياه', 500, 'z'], ['شحن كارت المياه', 500, 'z'], ['إصلاح كمبيوتر', 1700], ['واي فاي + مشترك + كابلين باور + وصلة + بادا', 850], ['أنس', 7000], ['كاميرات', 9500]];
        function ptSeed() {
            askConfirm('هيضيف 36 بند من كشف فادي: 31 بند على حسابه (البلاط 11,000 على زيزو)، و5 بنود زيكو في خانة "برّه الحساب"، والتزام متبقي الكاميرات 7,270. تقدر تعدّل أي بند بعدين.', () => {
                const d = ptData(); if (d.seeded) return; const fady = d.list[0].id, zizo = (d.list[1] || d.list[0]).id;
                PT_SEED.forEach((r, i) => {
                    if (r[2] === 'z') d.ext.push({ id: 'seed' + i, item: r[0], amt: r[1], who: 'زيكو', date: '', note: '' });
                    else d.exp.push({ id: 'seed' + i, at: new Date(Date.now() - i).toISOString(), item: r[0], amt: r[1], date: '', by: r[2] === 'y' ? zizo : fady, note: '' });
                });
                d.owed.push({ id: 'seed_owed', item: 'متبقي الكاميرات', amt: 7270, note: 'على الشريكين اللي لسه ناقصين' });
                d.seeded = true; ptLog('استيراد كشف فادي الأولي'); ptSave('تم الاستيراد');
            }, 'استورد');
        }
