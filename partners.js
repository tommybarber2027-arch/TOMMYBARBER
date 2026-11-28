        // ===================== الشركاء: حساب تأسيس الشركة =====================
        // منفصل تماماً عن الدرج والخزنة والتقارير اليومية.
        // appState.partners = { list:[{id,name,target}], exp:[{id,date,item,amt,by,note}], tr:[{id,date,from,to,amt,note,conf}],
        //                       owed:[{id,item,amt,note,own}], ext:[{id,date,item,amt,who,note,own}], log:[{at,by,t}], seeded }
        // مساهمة الشريك = اللي دفعه للموردين + اللي سلّمه لشركاء - اللي استلمه من شركاء  (التحويلات بتتلغي مع بعض فمفيش حساب مرتين)
        // الصلاحيات: المدير العام بيعدّل كل حاجة. الشريك (roleTitle = 'شريك' ومربوط بـ partnerId) بيعدّل بنوده هو بس.
        const ptId = () => 'pt' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
        const ptR = n => Math.round((Number(n) || 0) * 100) / 100;
        const ptM = n => ptR(n).toLocaleString('en-US') + ' ج';
        let ptOpen = null, ptGroup = false;
        const ptSuper = () => !!currentUser && isMgrUser(currentUser);
        const ptMine = () => (currentUser && currentUser.partnerId) || null;
        const ptCan = owner => ptSuper() || (!!ptMine() && ptMine() === owner);
        function ptGuard(owner) { if (ptCan(owner)) return true; showToast('تقدر تعدّل بنودك إنت بس', 'error'); return false; }
        function ptData() {
            const p = appState.partners = appState.partners || {};
            if (!p.list || !p.list.length) p.list = [{ id: 'p_fady', name: 'فادي', target: 350000 }, { id: 'p_zizo', name: 'زيزو', target: 350000 }, { id: 'p_hani', name: 'هاني', target: 350000 }];
            p.exp = p.exp || []; p.tr = p.tr || []; p.owed = p.owed || []; p.ext = p.ext || []; p.log = p.log || []; p.trash = p.trash || [];
            // المحذوف يفضل محذوف حتى لو جهاز قديم رجّعه في المزامنة (إلا لو اتعمل له استرجاع)
            if (p.trash.length) { const gone = new Set(p.trash.map(x => x.kind + ':' + x.id)); ['exp', 'tr', 'owed', 'ext'].forEach(k => { if (p[k].some(x => gone.has(k + ':' + x.id))) p[k] = p[k].filter(x => !gone.has(k + ':' + x.id)); }); }
            return p;
        }
        const ptName = id => { const x = ptData().list.find(p => p.id === id); return x ? x.name : '—'; };
        function ptCalc() {
            const d = ptData(), rows = d.list.map(p => {
                const mine = d.exp.filter(e => e.by === p.id), paid = mine.reduce((s, e) => s + (Number(e.amt) || 0), 0),
                    sent = d.tr.filter(t => t.from === p.id).reduce((s, t) => s + (Number(t.amt) || 0), 0),
                    recv = d.tr.filter(t => t.to === p.id).reduce((s, t) => s + (Number(t.amt) || 0), 0), net = paid + sent - recv;
                return { p, n: mine.length, paid: ptR(paid), sent: ptR(sent), recv: ptR(recv), net: ptR(net), rem: ptR((Number(p.target) || 0) - net), unconf: d.tr.filter(t => t.to === p.id && !t.conf).length };
            });
            const total = ptR(d.exp.reduce((s, e) => s + (Number(e.amt) || 0), 0)), share = rows.length ? total / rows.length : 0;
            const debt = rows.map(r => ({ id: r.p.id, v: ptR(share - r.net) })), pay = debt.filter(x => x.v > 0.5).map(x => ({ ...x })), get = debt.filter(x => x.v < -0.5).map(x => ({ id: x.id, v: -x.v }));
            const settle = []; pay.forEach(a => { while (a.v > 0.5 && get.length) { const g = get.find(x => x.v > 0.5); if (!g) break; const m = Math.min(a.v, g.v); settle.push({ from: a.id, to: g.id, amt: ptR(m) }); a.v -= m; g.v -= m; } });
            return { rows, total, share: ptR(share), settle };
        }
        const ptNorm = s => String(s || '').replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/\s+/g, ' ').trim();
        const ptOpts = (sel, only) => ptData().list.filter(p => !only || p.id === only).map(p => `<option value="${p.id}" ${p.id === sel ? 'selected' : ''}>${esc(p.name)}</option>`).join('');
        const ptInp = 'w-full bg-darkbg border border-bordergold rounded-xl px-3 py-2 text-white', ptLbl = 'block text-gray-400 mb-1 text-xs';
        function ptLog(t) {
            try { logAudit('الشركاء: ' + t); } catch (e) { }
            const d = ptData(); d.log.unshift({ at: new Date().toISOString(), by: currentUser ? currentUser.displayName : '', t }); if (d.log.length > 400) d.log.length = 400;
        }
        const ptDT = iso => { try { return new Date(iso).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }); } catch (e) { return ''; } };
        function ptRowExp(e) {
            const can = ptCan(e.by);
            return `<div class="flex items-center justify-between gap-2 bg-darkbg rounded-xl px-3 py-2"><div class="min-w-0"><div class="text-white font-bold truncate">${esc(e.item)}${e.inKind ? ' <span class="text-[10px] text-sky-300">(عيني)</span>' : ''}</div><div class="text-gray-500">${esc(e.date || '')}${e.note ? ' • ' + esc(e.note) : ''}</div></div><div class="flex items-center gap-2 shrink-0"><b class="text-gold">${ptM(e.amt)}</b>${can ? `<button onclick="ptAddExp('${e.id}')" class="text-gray-300">✎</button><button onclick="ptDel('exp','${e.id}')" class="text-red-400 font-black">×</button>` : ''}</div></div>`;
        }
        function ptRowTr(t, me) {
            const other = t.from === me ? t.to : t.from, out = t.from === me, canC = !t.conf && (ptSuper() || ptMine() === t.to), canE = ptCan(t.from) && (!t.conf || ptSuper());
            return `<div class="flex items-center justify-between gap-2 bg-darkbg rounded-xl px-3 py-2"><div class="min-w-0"><div class="text-white font-bold">${out ? 'سلّم' : 'استلم من'} ${esc(ptName(other))} ${t.conf ? '<span class="text-[10px] text-emerald-300">✓ مؤكد</span>' : '<span class="text-[10px] text-amber-300">لم يؤكد الاستلام</span>'}</div><div class="text-gray-500">${esc(t.date || '')}${t.note ? ' • ' + esc(t.note) : ''}</div></div><div class="flex items-center gap-2 shrink-0"><b class="${out ? 'text-gold' : 'text-emerald-300'}">${ptM(t.amt)}</b>${canC ? `<button onclick="ptConfirm('${t.id}')" class="bg-gold text-black font-black px-2 py-1 rounded-lg">تأكيد استلام</button>` : ''}${canE ? `<button onclick="ptAddTr('${t.id}')" class="text-gray-300">✎</button><button onclick="ptDel('tr','${t.id}')" class="text-red-400 font-black">×</button>` : ''}</div></div>`;
        }
        function ptDetail(r, card) {
            const d = ptData(), p = r.p, mine = d.exp.filter(e => e.by === p.id).sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')) || String(b.at || '').localeCompare(String(a.at || '')));
            const out = d.tr.filter(t => t.from === p.id), inn = d.tr.filter(t => t.to === p.id), can = ptCan(p.id);
            let items;
            if (ptGroup) {
                const m = new Map(); mine.forEach(e => { const k = ptNorm(e.item), g = m.get(k) || { name: e.item, sum: 0, n: 0 }; g.sum += Number(e.amt) || 0; g.n++; m.set(k, g); });
                items = [...m.values()].sort((a, b) => b.sum - a.sum).map(g => `<div class="flex justify-between bg-darkbg rounded-xl px-3 py-2"><span class="text-white">${esc(g.name)} <span class="text-gray-500">(${g.n})</span></span><b class="text-gold">${ptM(g.sum)}</b></div>`).join('');
            } else items = mine.map(ptRowExp).join('');
            return `<div class="${card} border-gold/60"><div class="flex flex-wrap items-center gap-2"><h3 class="text-sm font-black text-gold ml-2">دفتر ${esc(p.name)}</h3>${can ? `<button onclick="ptAddExp(null,'${p.id}')" class="mr-auto bg-gold text-black font-black px-3 py-1.5 rounded-xl">+ بند</button><button onclick="ptNote('${p.id}')" class="bg-darkbg border border-bordergold text-gold font-black px-3 py-1.5 rounded-xl">📝 دفتر سريع</button><button onclick="ptAddTr(null,'${p.id}')" class="bg-darkbg border border-bordergold text-gray-200 font-bold px-3 py-1.5 rounded-xl">+ تحويل</button>` : '<span class="mr-auto text-gray-500">للقراءة فقط</span>'}</div>
                <div class="grid grid-cols-2 gap-2 text-center"><div class="bg-darkbg rounded-xl p-2"><div class="text-gray-400">دفع للموردين (${r.n} بند)</div><b class="text-white">${ptM(r.paid)}</b></div><div class="bg-darkbg rounded-xl p-2"><div class="text-gray-400">مساهمته الصافية</div><b class="text-gold">${ptM(r.net)}</b></div><div class="bg-darkbg rounded-xl p-2"><div class="text-gray-400">سلّم لشركاء</div><b class="text-white">${ptM(r.sent)}</b></div><div class="bg-darkbg rounded-xl p-2"><div class="text-gray-400">استلم من شركاء</div><b class="text-white">${ptM(r.recv)}</b></div></div>
                <div class="flex justify-between"><span class="text-gray-400">حصته المتفق عليها</span><b class="text-white">${ptM(p.target)}</b></div><div class="flex justify-between"><span class="text-gray-400">${r.rem > 0 ? 'المتبقي عليه' : 'زيادة عن حصته'}</span><b class="${r.rem > 0 ? 'text-amber-300' : 'text-emerald-300'}">${ptM(Math.abs(r.rem))}</b></div>
                <div class="flex items-center justify-between pt-1"><b class="text-white">البنود اللي دفعها</b><button onclick="ptToggleGroup()" class="set-pill ${ptGroup ? 'on' : ''}">${ptGroup ? 'عرض كل بند' : 'تجميع حسب الاسم'}</button></div><div class="space-y-1.5">${items || '<p class="text-gray-500 text-center py-2">مفيش بنود.</p>'}</div><div class="flex justify-between bg-gold/10 border border-gold/40 rounded-xl px-3 py-2"><b class="text-white">إجمالي البنود (${r.n})</b><b class="text-gold">${ptM(r.paid)}</b></div>
                <b class="text-white block pt-1">اللي سلّمه لشركاء</b><div class="space-y-1.5">${out.map(t => ptRowTr(t, p.id)).join('') || '<p class="text-gray-500">مفيش.</p>'}</div>
                <b class="text-white block pt-1">اللي استلمه من شركاء</b><div class="space-y-1.5">${inn.map(t => ptRowTr(t, p.id)).join('') || '<p class="text-gray-500">مفيش.</p>'}</div></div>`;
        }
        function renderPartners() {
            const root = document.getElementById('view-partners'); if (!root) return;
            if (!currentUser?.permissions?.partners) { root.innerHTML = ''; return; }
            const d = ptData(), c = ptCalc(), card = 'bg-panelbg border border-bordergold rounded-2xl p-4 space-y-2 text-xs';
            const sup = ptSuper(), me = ptMine();
            const cards = c.rows.map(r => `<button type="button" onclick="ptToggleOpen('${r.p.id}')" class="${card} text-right w-full ${ptOpen === r.p.id ? 'border-gold' : ''}"><div class="flex items-center justify-between"><b class="text-white text-sm">${esc(r.p.name)}${me === r.p.id ? ' <span class="text-[10px] text-gold">(إنت)</span>' : ''}</b><span class="px-2 py-0.5 rounded-lg text-[11px] font-black ${r.rem <= 0 ? 'bg-emerald-950/60 text-emerald-300' : 'bg-amber-950/60 text-amber-300'}">${r.rem <= 0 ? (r.rem < 0 ? 'خلّص وزيادة ' + ptM(-r.rem) : 'خلّص حصته ✓') : 'متبقي عليه ' + ptM(r.rem)}</span></div>
                <div class="grid grid-cols-2 gap-2 text-center"><div class="bg-darkbg rounded-xl p-2"><div class="text-gray-400">مساهمته الصافية</div><b class="text-gold">${ptM(r.net)}</b></div><div class="bg-darkbg rounded-xl p-2"><div class="text-gray-400">حصته</div><b class="text-white">${ptM(r.p.target)}</b></div></div>${r.unconf ? `<div class="text-amber-300">${r.unconf} تحويل لسه ما أكدش استلامه</div>` : ''}<div class="text-gray-500">${ptOpen === r.p.id ? 'اضغط للإغلاق ▲' : 'اضغط لتفاصيل الدفتر ▼'}</div></button>`).join('');
            const settle = c.settle.length ? c.settle.map(s => `<div class="flex justify-between bg-darkbg rounded-xl px-3 py-2"><span><b class="text-white">${esc(ptName(s.from))}</b> يدفع لـ <b class="text-white">${esc(ptName(s.to))}</b></span><b class="text-gold">${ptM(s.amt)}</b></div>`).join('') : '<p class="text-emerald-300">الحسابات متساوية، مفيش حد يدفع لحد.</p>';
            const owedTot = d.owed.reduce((s, x) => s + (Number(x.amt) || 0), 0), extTot = d.ext.reduce((s, x) => s + (Number(x.amt) || 0), 0);
            const gm = new Map(); d.exp.forEach(e => { const k = ptNorm(e.item), g = gm.get(k) || { name: e.item, sum: 0, n: 0 }; g.sum += Number(e.amt) || 0; g.n++; gm.set(k, g); });
            const all = [...gm.values()].sort((a, b) => b.sum - a.sum).map(g => `<div class="flex justify-between bg-darkbg rounded-xl px-3 py-2"><span class="text-white">${esc(g.name)} <span class="text-gray-500">(${g.n})</span></span><b class="text-gold">${ptM(g.sum)}</b></div>`).join('');
            const openRow = c.rows.find(r => r.p.id === ptOpen);
            root.innerHTML = `<div class="flex flex-wrap items-center gap-2"><h2 class="text-sm font-black text-gold ml-2">الشركاء - تأسيس الشركة</h2>
                ${sup ? '<button onclick="ptEditPartners()" class="mr-auto bg-darkbg border border-bordergold text-gray-300 font-bold px-3 py-2 rounded-xl text-xs">الشركاء والحصص</button>' : ''}</div>
              <p class="text-gray-400 text-xs leading-relaxed">حساب منفصل عن الدرج والخزنة والتقارير. مساهمة كل شريك = <b class="text-gray-200">اللي دفعه للموردين + اللي سلّمه لشركاء − اللي استلمه من شركاء</b>. ${sup ? 'إنت المدير العام: بتعدّل الكل.' : 'تقدر تعدّل بنودك إنت بس، وباقي الشركاء للقراءة.'}</p>
              <div class="grid grid-cols-3 gap-2 text-xs"><div class="bg-panelbg border border-bordergold rounded-xl p-3 text-center"><div class="text-gray-400">إجمالي المتبقي على الشركاء</div><b class="text-amber-300 text-base">${ptM(c.rows.reduce((s, r) => s + Math.max(0, r.rem), 0))}</b></div><div class="bg-panelbg border border-bordergold rounded-xl p-3 text-center"><div class="text-gray-400">إجمالي المصروف</div><b class="text-gold text-base">${ptM(c.total)}</b></div><div class="bg-panelbg border border-bordergold rounded-xl p-3 text-center"><div class="text-gray-400">نصيب كل شريك بالتساوي</div><b class="text-white text-base">${ptM(c.share)}</b></div></div>
              <div class="grid gap-2 md:grid-cols-3">${cards}</div>
              ${openRow ? ptDetail(openRow, card) : ''}
              <div class="${card}"><h3 class="text-sm font-black text-white">التسوية (لو الإجمالي اتقسم بالتساوي)</h3>${settle}<p class="text-gray-500">الفلوس دي بتتسلّم بينكم بره البرنامج، وبعدها سجّلوا "تحويل" عشان الأرقام تتساوى.</p></div>
              <div class="${card}"><div class="flex items-center justify-between"><h3 class="text-sm font-black text-white">التزامات لسه ماتدفعتش (${ptM(owedTot)})</h3><button onclick="ptAddOwed()" class="bg-darkbg border border-bordergold text-gold font-black px-3 py-1.5 rounded-xl">+ التزام</button></div>${d.owed.map(x => { const cn = ptSuper() || (!!me && x.own === me); return `<div class="flex items-center justify-between gap-2 bg-darkbg rounded-xl px-3 py-2"><div class="min-w-0"><div class="text-white font-bold truncate">${esc(x.item)}</div>${x.note ? `<div class="text-gray-500">${esc(x.note)}</div>` : ''}</div><div class="flex items-center gap-2 shrink-0"><b class="text-amber-300">${ptM(x.amt)}</b>${me || sup ? `<button onclick="ptPayOwed('${x.id}')" class="bg-gold text-black font-black px-2 py-1 rounded-lg">تم الدفع</button>` : ''}${cn ? `<button onclick="ptDel('owed','${x.id}')" class="text-red-400 font-black">×</button>` : ''}</div></div>`; }).join('') || '<p class="text-gray-500">مفيش.</p>'}<p class="text-gray-500">الالتزام مش بيتحسب مساهمة لحد لحد ما حد يدفعه.</p></div>
              <div class="${card}"><div class="flex items-center justify-between"><h3 class="text-sm font-black text-white">مدفوع من برّه الحساب (${ptM(extTot)})</h3><button onclick="ptAddExt()" class="bg-darkbg border border-bordergold text-gold font-black px-3 py-1.5 rounded-xl">+ إضافة</button></div>${d.ext.map(x => { const cn = ptSuper() || (!!me && x.own === me); return `<div class="flex items-center justify-between gap-2 bg-darkbg rounded-xl px-3 py-2"><div class="min-w-0"><div class="text-white font-bold truncate">${esc(x.item)}</div><div class="text-gray-500">دفعها ${esc(x.who || '')}${x.date ? ' • ' + esc(x.date) : ''}${x.note ? ' • ' + esc(x.note) : ''}</div></div><div class="flex items-center gap-2 shrink-0"><b class="text-gray-300">${ptM(x.amt)}</b>${cn ? `<button onclick="ptDel('ext','${x.id}')" class="text-red-400 font-black">×</button>` : ''}</div></div>`; }).join('') || '<p class="text-gray-500">مفيش.</p>'}<p class="text-gray-500">للتوثيق بس (زي اللي بيدفعه زيكو). مش بيدخل في حساب الشركاء.</p></div>
              <details class="${card}"><summary class="text-sm font-black text-white cursor-pointer">كل المصروفات مجمّعة حسب الاسم (${ptM(c.total)})</summary><div class="space-y-1.5 pt-2">${all || '<p class="text-gray-500">مفيش.</p>'}</div></details>
              ${sup ? `<details class="${card}"><summary class="text-sm font-black text-white cursor-pointer">سلة المحذوفات (${d.trash.length})</summary><div class="space-y-1.5 pt-2">${d.trash.map((x, i) => `<div class="flex items-center justify-between gap-2 bg-darkbg rounded-xl px-3 py-2"><div class="min-w-0"><div class="text-white font-bold truncate">${ptKindName[x.kind] || ''}: ${esc(x.rec.item || ('تحويل ' + ptName(x.rec.from) + ' ← ' + ptName(x.rec.to)))} ${ptM(x.rec.amt)}</div><div class="text-gray-500">حذفه ${esc(x.by)} • ${esc(ptDT(x.at))}</div></div><button onclick="ptRestore(${i})" class="bg-gold text-black font-black px-2 py-1 rounded-lg shrink-0">استرجاع</button></div>`).join('') || '<p class="text-gray-500">فاضية.</p>'}</div></details>` : ''}
              <details class="${card}"><summary class="text-sm font-black text-white cursor-pointer">سجل التعديلات (${d.log.length})</summary><div class="space-y-1 pt-2 max-h-72 overflow-y-auto">${d.log.slice(0, 120).map(l => `<div class="bg-darkbg rounded-lg px-3 py-1.5"><span class="text-gray-500">${esc(ptDT(l.at))} • ${esc(l.by)}</span><br><span class="text-gray-200">${esc(l.t)}</span></div>`).join('') || '<p class="text-gray-500">مفيش.</p>'}</div></details>
              ${sup && !d.seeded && !d.exp.length ? '<button onclick="ptSeed()" class="w-full bg-darkbg border border-bordergold text-gold font-black py-2 rounded-xl">استيراد كشف فادي (36 بند)</button>' : ''}`;
        }
        function ptToggleOpen(id) { ptOpen = ptOpen === id ? null : id; renderPartners(); }
        function ptToggleGroup() { ptGroup = !ptGroup; renderPartners(); }
        function ptSave(msg) { saveState(); renderPartners(); if (msg) showToast(msg); }
        // المالك الافتراضي للإضافة: الشريك المربوط بالمستخدم، أو اللي مفتوح دفتره، أو أول شريك (للمدير)
        const ptDefOwner = pre => ptMine() || pre || ptOpen || ptData().list[0].id;
        const ptOwnerSel = (sel, label) => ptSuper() ? `<div><label class="${ptLbl}">${label}</label><select id="pt-by" class="${ptInp}">${ptOpts(sel)}</select></div>` : `<input type="hidden" id="pt-by" value="${esc(ptMine() || '')}"><p class="text-gray-400 text-xs">${label}: <b class="text-white">${esc(ptName(ptMine()))}</b></p>`;
        function ptAddExp(id, pre) {
            const d = ptData(), e = id ? d.exp.find(x => x.id === id) : null;
            if (e && !ptGuard(e.by)) return; if (!e && !ptSuper() && !ptMine()) { showToast('حسابك مش مربوط بشريك', 'error'); return; }
            askBox(e ? 'تعديل بند' : 'بند جديد', `<div class="space-y-2"><div><label class="${ptLbl}">البند</label><input id="pt-item" class="${ptInp}" value="${esc(e ? e.item : '')}" placeholder="مثلاً: بلاط، نقاشة، كهرباء"></div><div class="grid grid-cols-2 gap-2"><div><label class="${ptLbl}">المبلغ</label><input id="pt-amt" type="number" min="0" inputmode="decimal" class="${ptInp}" value="${e ? e.amt : ''}"></div><div><label class="${ptLbl}">التاريخ</label><input id="pt-date" type="date" class="${ptInp}" value="${e ? e.date || '' : getTodayISO()}"></div></div>${ptOwnerSel(e ? e.by : ptDefOwner(pre), 'مين دفعها للمورّد')}<div><label class="${ptLbl}">ملاحظة (اختياري)</label><input id="pt-note" class="${ptInp}" value="${esc(e ? e.note || '' : '')}"></div><label class="flex items-center gap-2 text-gray-300 text-xs"><input type="checkbox" id="pt-kind" class="accent-gold" ${e && e.inKind ? 'checked' : ''}> مساهمة عينية (جهاز أو حاجة من البيت بسعر متفق عليه)</label></div>`, () => {
                const item = byId('pt-item').value.trim(), amt = Number(byId('pt-amt').value), by = byId('pt-by').value;
                if (!item) { showToast('اكتب البند', 'error'); return false; }
                if (!(amt > 0)) { showToast('اكتب مبلغ صحيح', 'error'); return false; }
                if (!ptCan(by)) { showToast('تقدر تسجّل على حسابك إنت بس', 'error'); return false; }
                const rec = e || { id: ptId(), at: new Date().toISOString() }; Object.assign(rec, { item, amt, date: byId('pt-date').value, by, note: byId('pt-note').value.trim(), inKind: byId('pt-kind').checked });
                if (!e) d.exp.unshift(rec); ptLog(`${e ? 'تعديل' : 'إضافة'} بند ${item} ${amt} (${ptName(by)})`); ptSave('تم الحفظ');
            }, 'حفظ');
        }
        // دفتر سريع: كل سطر = بند ومبلغ (مثلاً: بلاط 11000)
        const ptDig = s => String(s).replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d));
        function ptParse(text) {
            const rows = [], bad = [];
            String(text || '').split(/\r?\n/).forEach((raw, i) => {
                const line = ptDig(raw).trim(); if (!line) return;
                const m = line.match(/^(.*?)[\s:：=\-–—،,]*([0-9][0-9,٬]*(?:\.[0-9]+)?)\s*(?:ج\.?م?|جنيه|EGP)?\s*$/i);
                const amt = m ? Number(m[2].replace(/[,٬]/g, '')) : NaN, item = m ? m[1].trim() : '';
                if (!m || !item || !(amt > 0)) bad.push(i + 1); else rows.push({ item, amt });
            });
            return { rows, bad };
        }
        function ptNote(owner) {
            if (!ptGuard(owner)) return;
            askBox('دفتر ' + esc(ptName(owner)), `<div class="space-y-2"><p class="text-gray-400 text-xs leading-relaxed">اكتب كل بند في سطر، والمبلغ في آخره. مثال:<br><span dir="ltr" class="text-gray-300">بلاط 11000<br>أبو السعود 10,000<br>مسامير 130</span></p><textarea id="pt-notes" rows="9" class="${ptInp}" placeholder="بلاط 11000"></textarea><div><label class="${ptLbl}">التاريخ (اختياري)</label><input id="pt-date" type="date" class="${ptInp}" value="${getTodayISO()}"></div></div>`, () => {
                const r = ptParse(byId('pt-notes').value);
                if (r.bad.length) { showToast('راجع الأسطر: ' + r.bad.join('، ') + ' (لازم اسم ومبلغ)', 'error'); return false; }
                if (!r.rows.length) { showToast('اكتب بند واحد على الأقل', 'error'); return false; }
                const d = ptData(), date = byId('pt-date').value, now = Date.now();
                r.rows.forEach((x, i) => d.exp.unshift({ id: ptId(), at: new Date(now + i).toISOString(), item: x.item, amt: x.amt, date, by: owner, note: '' }));
                ptLog(`دفتر سريع: ${r.rows.length} بند بمجموع ${ptR(r.rows.reduce((s, x) => s + x.amt, 0))} (${ptName(owner)})`); ptSave(`تمت إضافة ${r.rows.length} بند`);
            }, 'حفظ البنود');
        }
        function ptAddTr(id, pre) {
            const d = ptData(), t = id ? d.tr.find(x => x.id === id) : null;
            if (t && !ptGuard(t.from)) return; if (t && t.conf && !ptSuper()) { showToast('التحويل المؤكد يعدّله المدير بس', 'error'); return; } if (!t && !ptSuper() && !ptMine()) { showToast('حسابك مش مربوط بشريك', 'error'); return; }
            const from = t ? t.from : ptDefOwner(pre), others = d.list.filter(p => p.id !== from);
            askBox(t ? 'تعديل تحويل' : 'تحويل لشريك', `<div class="space-y-2">${ptSuper() ? `<div><label class="${ptLbl}">من (سلّم)</label><select id="pt-from" class="${ptInp}">${ptOpts(from)}</select></div>` : `<input type="hidden" id="pt-from" value="${esc(from)}"><p class="text-gray-400 text-xs">من: <b class="text-white">${esc(ptName(from))}</b></p>`}<div><label class="${ptLbl}">إلى (استلم)</label><select id="pt-to" class="${ptInp}">${ptOpts(t ? t.to : (others[0] || {}).id)}</select></div><div class="grid grid-cols-2 gap-2"><div><label class="${ptLbl}">المبلغ</label><input id="pt-amt" type="number" min="0" inputmode="decimal" class="${ptInp}" value="${t ? t.amt : ''}"></div><div><label class="${ptLbl}">التاريخ</label><input id="pt-date" type="date" class="${ptInp}" value="${t ? t.date || '' : getTodayISO()}"></div></div><div><label class="${ptLbl}">ملاحظة (اختياري)</label><input id="pt-note" class="${ptInp}" value="${esc(t ? t.note || '' : '')}"></div></div>`, () => {
                const f = byId('pt-from').value, to = byId('pt-to').value, amt = Number(byId('pt-amt').value);
                if (!ptCan(f)) { showToast('تقدر تسجّل تحويلاتك إنت بس', 'error'); return false; }
                if (f === to) { showToast('اختار شريكين مختلفين', 'error'); return false; }
                if (!(amt > 0)) { showToast('اكتب مبلغ صحيح', 'error'); return false; }
                const rec = t || { id: ptId() }; const changed = t && (t.amt !== amt || t.to !== to);
                Object.assign(rec, { from: f, to, amt, date: byId('pt-date').value, note: byId('pt-note').value.trim() }); if (changed) delete rec.conf;
                if (!t) d.tr.unshift(rec); ptLog(`${t ? 'تعديل' : 'إضافة'} تحويل ${ptName(f)} ← ${ptName(to)} ${amt}`); ptSave('تم الحفظ');
            }, 'حفظ');
        }
        function ptConfirm(id) {
            const d = ptData(), t = d.tr.find(x => x.id === id); if (!t) return;
            if (!(ptSuper() || ptMine() === t.to)) { showToast('التأكيد من الشريك المستلم بس', 'error'); return; }
            askConfirm(`تأكد إنك استلمت ${ptM(t.amt)} من ${esc(ptName(t.from))}؟`, () => { t.conf = { by: currentUser ? currentUser.displayName : '', at: new Date().toISOString() }; ptLog(`تأكيد استلام ${t.amt} من ${ptName(t.from)} بواسطة ${ptName(t.to)}`); ptSave('تم التأكيد'); }, 'أيوه استلمت');
        }
        function ptAddOwed() {
            if (!ptSuper() && !ptMine()) { showToast('حسابك مش مربوط بشريك', 'error'); return; }
            askBox('التزام جديد', `<div class="space-y-2"><div><label class="${ptLbl}">البند</label><input id="pt-item" class="${ptInp}" placeholder="مثلاً: متبقي الكاميرات"></div><div><label class="${ptLbl}">المبلغ المتبقي</label><input id="pt-amt" type="number" min="0" inputmode="decimal" class="${ptInp}"></div><div><label class="${ptLbl}">ملاحظة (اختياري)</label><input id="pt-note" class="${ptInp}"></div></div>`, () => {
                const item = byId('pt-item').value.trim(), amt = Number(byId('pt-amt').value);
                if (!item || !(amt > 0)) { showToast('اكتب البند والمبلغ', 'error'); return false; }
                ptData().owed.push({ id: ptId(), item, amt, note: byId('pt-note').value.trim(), own: ptMine() || '' }); ptLog(`التزام ${item} ${amt}`); ptSave('تم الحفظ');
            }, 'حفظ');
        }
        function ptPayOwed(id) {
            const d = ptData(), o = d.owed.find(x => x.id === id); if (!o) return;
            if (!ptSuper() && !ptMine()) { showToast('حسابك مش مربوط بشريك', 'error'); return; }
            askBox('تم دفع الالتزام', `<div class="space-y-2"><p class="text-gray-300 text-xs">${esc(o.item)} - المتبقي ${ptM(o.amt)}</p><div><label class="${ptLbl}">اللي اتدفع دلوقتي</label><input id="pt-amt" type="number" min="0" inputmode="decimal" class="${ptInp}" value="${o.amt}"></div>${ptOwnerSel(ptDefOwner(), 'مين دفعه')}<div><label class="${ptLbl}">التاريخ</label><input id="pt-date" type="date" class="${ptInp}" value="${getTodayISO()}"></div></div>`, () => {
                const amt = Number(byId('pt-amt').value), by = byId('pt-by').value;
                if (!(amt > 0) || amt > o.amt + 0.001) { showToast('المبلغ لازم يكون أكبر من صفر ومايزيدش عن المتبقي', 'error'); return false; }
                if (!ptCan(by)) { showToast('تقدر تسجّل على حسابك إنت بس', 'error'); return false; }
                d.exp.unshift({ id: ptId(), at: new Date().toISOString(), item: o.item, amt, date: byId('pt-date').value, by, note: 'من التزام' });
                o.amt = ptR(o.amt - amt); if (o.amt <= 0.001) d.owed = d.owed.filter(x => x.id !== id);
                ptLog(`دفع التزام ${o.item} ${amt} (${ptName(by)})`); ptSave('تم تسجيل الدفع كمساهمة');
            }, 'تسجيل');
        }
        function ptAddExt() {
            if (!ptSuper() && !ptMine()) { showToast('حسابك مش مربوط بشريك', 'error'); return; }
            askBox('مدفوع من برّه الحساب', `<div class="space-y-2"><div><label class="${ptLbl}">البند</label><input id="pt-item" class="${ptInp}" placeholder="مثلاً: شحن كارت كهرباء"></div><div class="grid grid-cols-2 gap-2"><div><label class="${ptLbl}">المبلغ</label><input id="pt-amt" type="number" min="0" inputmode="decimal" class="${ptInp}"></div><div><label class="${ptLbl}">مين دفعها</label><input id="pt-who" class="${ptInp}" value="زيكو"></div></div><div><label class="${ptLbl}">ملاحظة (اختياري)</label><input id="pt-note" class="${ptInp}"></div></div>`, () => {
                const item = byId('pt-item').value.trim(), amt = Number(byId('pt-amt').value);
                if (!item || !(amt > 0)) { showToast('اكتب البند والمبلغ', 'error'); return false; }
                ptData().ext.unshift({ id: ptId(), item, amt, who: byId('pt-who').value.trim(), date: getTodayISO(), note: byId('pt-note').value.trim(), own: ptMine() || '' }); ptLog(`مدفوع من برّه الحساب ${item} ${amt}`); ptSave('تم الحفظ');
            }, 'حفظ');
        }
        function ptDel(kind, id) {
            const d = ptData(), r = d[kind].find(x => x.id === id); if (!r) return;
            const owner = kind === 'exp' ? r.by : kind === 'tr' ? r.from : r.own;
            if (!(ptSuper() || (ptMine() && ptMine() === owner))) { showToast('تقدر تحذف بنودك إنت بس', 'error'); return; }
            if (kind === 'tr' && r.conf && !ptSuper()) { showToast('التحويل المؤكد يحذفه المدير بس', 'error'); return; }
            askConfirm('تحذف السجل ده؟ (بيروح لسلة المحذوفات والمدير يقدر يرجّعه)', () => { d.trash.unshift({ kind, id, rec: JSON.parse(JSON.stringify(r)), by: currentUser ? currentUser.displayName : '', at: new Date().toISOString() }); if (d.trash.length > 300) d.trash.length = 300; d[kind] = d[kind].filter(x => x.id !== id); ptLog(`حذف ${kind === 'exp' ? 'بند ' + r.item + ' ' + r.amt : kind === 'tr' ? 'تحويل ' + r.amt : kind === 'owed' ? 'التزام ' + r.item : 'بند خارجي ' + r.item}`); ptSave(); }, 'احذف');
        }
        function ptRestore(i) {
            if (!ptSuper()) { showToast('للمدير العام بس', 'error'); return; }
            const d = ptData(), x = d.trash[i]; if (!x) return;
            d.trash.splice(i, 1); if (!d[x.kind].some(r => r.id === x.id)) d[x.kind].unshift(x.rec);
            ptLog('استرجاع ' + (x.rec.item || 'تحويل ' + x.rec.amt) + ' (حذفه ' + x.by + ')'); ptSave('تم الاسترجاع');
        }
        const ptKindName = { exp: 'بند', tr: 'تحويل', owed: 'التزام', ext: 'بند خارجي' };
        // إدارة الشركاء (المدير العام بس): تعديل الاسم والحصة، إضافة شريك، حذف شريك فاضي
        function ptEditPartners() {
            if (!ptSuper()) { showToast('للمدير العام بس', 'error'); return; }
            const d = ptData(), used = id => d.exp.some(e => e.by === id) || d.tr.some(t => t.from === id || t.to === id) || (appState.users || []).some(u => u.partnerId === id);
            askBox('الشركاء والحصص', `<div class="space-y-2">${d.list.map((p, i) => `<div class="grid grid-cols-[1fr_1fr_auto] gap-2 items-center"><input id="pn-${i}" class="${ptInp}" value="${esc(p.name)}" placeholder="الاسم (مثلاً: مستر هاني)"><input id="pg-${i}" type="number" min="0" class="${ptInp}" value="${p.target}">${used(p.id) ? '<span class="w-6"></span>' : `<button type="button" onclick="ptRemovePartner('${p.id}')" class="text-red-400 font-black">×</button>`}</div>`).join('')}<button type="button" onclick="ptAddPartner()" class="w-full bg-darkbg border border-bordergold text-gold font-black py-2 rounded-xl">+ شريك جديد</button><p class="text-gray-500 text-xs">الاسم والحصة المتفق عليها. الشريك اللي عليه حركات أو مربوط بمستخدم مايتحذفش.</p></div>`, () => {
                const vals = d.list.map((p, i) => ({ name: byId('pn-' + i).value.trim(), target: Number(byId('pg-' + i).value) }));
                if (vals.some(v => !v.name || !(v.target >= 0))) { showToast('راجع الأسماء والحصص', 'error'); return false; }
                d.list.forEach((p, i) => { p.name = vals[i].name; p.target = vals[i].target; }); ptLog('تعديل الشركاء والحصص'); ptSave('تم الحفظ');
            }, 'حفظ');
        }
        function ptAddPartner() {
            if (!ptSuper()) return; const d = ptData(); if (d.list.length >= 8) { showToast('الحد الأقصى 8 شركاء', 'error'); return; }
            const keep = d.list.map((p, i) => ({ name: byId('pn-' + i) ? byId('pn-' + i).value : p.name, target: byId('pg-' + i) ? byId('pg-' + i).value : p.target }));
            d.list.forEach((p, i) => { if (keep[i].name.trim()) p.name = keep[i].name.trim(); if (keep[i].target !== '') p.target = Number(keep[i].target) || 0; });
            d.list.push({ id: 'p' + Date.now().toString(36), name: 'شريك جديد', target: d.list[0] ? d.list[0].target : 0 }); ptLog('إضافة شريك جديد'); saveState(); byId('ask-box')?.remove(); renderPartners(); ptEditPartners();
        }
        function ptRemovePartner(id) {
            if (!ptSuper()) return; const d = ptData();
            if (d.list.length <= 1) { showToast('لازم يفضل شريك واحد على الأقل', 'error'); return; }
            if (d.exp.some(e => e.by === id) || d.tr.some(t => t.from === id || t.to === id) || (appState.users || []).some(u => u.partnerId === id)) { showToast('عليه حركات أو مربوط بمستخدم', 'error'); return; }
            const nm = ptName(id); d.list = d.list.filter(p => p.id !== id); ptLog('حذف شريك ' + nm); saveState(); byId('ask-box')?.remove(); renderPartners(); ptEditPartners();
        }
        // استيراد كشف فادي الأولي (مرة واحدة). z = دفعها زيكو (برّه الحساب)، y = دفعها زيزو
        const PT_SEED = [['بضاعة الكهرباء', 20000], ['مصنعية محمد الكهربائي', 5000], ['أدوات تنظيف', 500], ['شحن كارت الكهرباء', 200], ['دفع استلام شحن الأربع أعدان', 70], ['أبو السعود', 10000], ['خطوط فودافون', 450], ['شحن كارت الكهرباء', 500, 'z'], ['جمال النجار', 250], ['مسامير زائد زاوية', 130], ['أدوات لتنظيف القزاز الواجهة', 150], ['أكل للنظافة القزاز والأرضية', 150], ['شحن كارت الكهرباء', 500], ['شحن كارت المياه', 500, 'z'], ['قير الباركيه', 200], ['سيليكون للباركيه', 120], ['جمال النجار للباركيه', 1700], ['أنس', 5000], ['ما شابك للسيراميك', 130], ['مادة لزق السيراميك', 1260], ['بلاط', 11000, 'y'], ['تسقية البلاط بالألوان', 170], ['مصنعية تركيب البلاط بالوزر', 3500], ['حسين النقاش', 10000], ['حسين النقاش', 5000], ['تنظيف المكان ورمي الزبالة', 250], ['خرطوم 6 م للتكييف', 170], ['ترسيكل الخشب من البيت الحديث', 150], ['أبو السعود', 16000], ['شحن كارت الكهرباء', 500, 'z'], ['شحن كارت المياه', 500, 'z'], ['شحن كارت المياه', 500, 'z'], ['إصلاح كمبيوتر', 1700], ['واي فاي + مشترك + كابلين باور + وصلة + بادا', 850], ['أنس', 7000], ['كاميرات', 9500]];
        function ptSeed() {
            if (!ptSuper()) return;
            askConfirm('هيضيف 36 بند من كشف فادي: 31 بند على حسابه (البلاط 11,000 على زيزو)، و5 بنود زيكو في خانة "برّه الحساب"، والتزام متبقي الكاميرات 7,270. تقدر تعدّل أي بند بعدين.', () => {
                const d = ptData(); if (d.seeded) return; const fady = d.list[0].id, zizo = (d.list[1] || d.list[0]).id;
                PT_SEED.forEach((r, i) => {
                    if (r[2] === 'z') d.ext.push({ id: 'seed' + i, item: r[0], amt: r[1], who: 'زيكو', date: '', note: '', own: '' });
                    else d.exp.push({ id: 'seed' + i, at: new Date(Date.now() - i).toISOString(), item: r[0], amt: r[1], date: '', by: r[2] === 'y' ? zizo : fady, note: '' });
                });
                d.owed.push({ id: 'seed_owed', item: 'متبقي الكاميرات', amt: 7270, note: 'على الشريكين اللي لسه ناقصين', own: '' });
                d.seeded = true; ptLog('استيراد كشف فادي الأولي'); ptSave('تم الاستيراد');
            }, 'استورد');
        }
