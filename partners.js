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
        const ptSuper = () => isMaster(currentUser);
        const ptMine = () => (currentUser && currentUser.partnerId) || null;
        const ptCan = owner => ptSuper() || (!!ptMine() && ptMine() === owner);
        function ptGuard(owner) { if (ptCan(owner)) return true; showToast('تقدر تعدّل بنودك إنت بس', 'error'); return false; }
        function ptData() {
            const p = appState.partners = appState.partners || {};
            if (!p.list) p.list = [];
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
            return `<div class="flex items-center justify-between gap-2 bg-darkbg rounded-xl px-3 py-2"><div class="min-w-0"><div class="text-white font-bold truncate">${esc(e.item)}${e.inKind ? ' <span class="text-[10px] text-sky-300">(عيني)</span>' : ''}</div><div class="text-gray-500">${esc(e.date || '')}${e.payee ? ' • ' + esc(e.payee) : ''}${e.note ? ' • ' + esc(e.note) : ''}</div></div><div class="flex items-center gap-2 shrink-0"><b class="text-gold">${ptM(e.amt)}</b>${can ? `<button onclick="ptAddExp('${e.id}')" class="text-gray-300">✎</button><button onclick="ptDel('exp','${e.id}')" class="text-red-400 font-black">×</button>` : ''}</div></div>`;
        }
        function ptRowTr(t, me) {
            const other = t.from === me ? t.to : t.from, out = t.from === me, canC = !t.conf && (ptSuper() || ptMine() === t.to), canE = ptCan(t.from) && (!t.conf || ptSuper());
            return `<div class="flex items-center justify-between gap-2 bg-darkbg rounded-xl px-3 py-2"><div class="min-w-0"><div class="text-white font-bold">${out ? 'سلّم' : 'استلم من'} ${esc(ptName(other))} ${t.conf ? '<span class="text-[10px] text-emerald-300">✓ مؤكد</span>' : '<span class="text-[10px] text-amber-300">لم يؤكد الاستلام</span>'}</div><div class="text-gray-500">${esc(t.date || '')}${t.note ? ' • ' + esc(t.note) : ''}</div></div><div class="flex items-center gap-2 shrink-0"><b class="${out ? 'text-gold' : 'text-emerald-300'}">${ptM(t.amt)}</b>${canC ? `<button onclick="ptConfirm('${t.id}')" class="bg-gold text-black font-black px-2 py-1 rounded-lg">تأكيد استلام</button>` : ''}${canE ? `<button onclick="ptAddTr('${t.id}')" class="text-gray-300">✎</button><button onclick="ptDel('tr','${t.id}')" class="text-red-400 font-black">×</button>` : ''}</div></div>`;
        }
        const ptCard = 'bg-panelbg border border-bordergold rounded-2xl p-4 space-y-2 text-xs';
        const ptBtn = 'bg-darkbg border border-bordergold text-gray-200 font-bold px-3 py-1.5 rounded-xl';
        const ptBtnG = 'bg-gold text-black font-black px-3 py-1.5 rounded-xl';
        function ptGroupBy(list, key) {
            const m = new Map(); list.forEach(e => { const k = ptNorm(e[key]) || '—', g = m.get(k) || { name: e[key] || 'غير محدد', sum: 0, n: 0 }; g.sum += Number(e.amt) || 0; g.n++; m.set(k, g); });
            return [...m.values()].sort((a, b) => b.sum - a.sum);
        }
        // شاشة كشف حساب شريك
        function ptStatement(r) {
            const d = ptData(), p = r.p, can = ptCan(p.id);
            const mine = d.exp.filter(e => e.by === p.id).sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')) || String(b.at || '').localeCompare(String(a.at || '')));
            const out = d.tr.filter(t => t.from === p.id), inn = d.tr.filter(t => t.to === p.id);
            const items = ptGroup ? ptGroupBy(mine, 'item').map(g => `<div class="flex justify-between bg-darkbg rounded-xl px-3 py-2"><span class="text-white">${esc(g.name)} <span class="text-gray-500">(${g.n})</span></span><b class="text-gold">${ptM(g.sum)}</b></div>`).join('') : mine.map(ptRowExp).join('');
            const byPayee = ptGroupBy(mine.filter(e => e.payee), 'payee');
            return `<div class="flex flex-wrap items-center gap-2"><button onclick="ptBack()" class="${ptBtn}">← رجوع</button><h2 class="text-sm font-black text-gold ml-2">كشف حساب: ${esc(p.name)}</h2><button onclick="ptPrint('${p.id}')" class="mr-auto ${ptBtn}">🖨 طباعة الكشف</button></div>
              ${can ? `<div class="flex flex-wrap gap-2"><button onclick="ptAddExp(null,'${p.id}')" class="${ptBtnG}">+ بند مصروف</button><button onclick="ptNote('${p.id}')" class="${ptBtn} text-gold">📝 دفتر سريع (عدة بنود)</button><button onclick="ptAddTr(null,'${p.id}')" class="${ptBtn}">+ تحويل لشريك</button></div>` : '<p class="text-gray-500">عرض فقط: مش من حقك تعدّل في حساب شريك تاني.</p>'}
              <div class="${ptCard}"><div class="grid grid-cols-2 gap-2 text-center"><div class="bg-darkbg rounded-xl p-2"><div class="text-gray-400">حصته المتفق عليها</div><b class="text-white">${ptM(p.target)}</b></div><div class="bg-darkbg rounded-xl p-2"><div class="text-gray-400">اللي دفعه للموردين (${r.n} بند)</div><b class="text-white">${ptM(r.paid)}</b></div><div class="bg-darkbg rounded-xl p-2"><div class="text-gray-400">سلّم لشركاء</div><b class="text-white">${ptM(r.sent)}</b></div><div class="bg-darkbg rounded-xl p-2"><div class="text-gray-400">استلم من شركاء</div><b class="text-white">${ptM(r.recv)}</b></div></div>
                <div class="flex justify-between bg-gold/10 border border-gold/40 rounded-xl px-3 py-2"><b class="text-white">إجمالي مساهمته الصافية</b><b class="text-gold">${ptM(r.net)}</b></div>
                <div class="flex justify-between rounded-xl px-3 py-2 ${r.rem > 0 ? 'bg-amber-950/40' : 'bg-emerald-950/40'}"><b class="text-white">${r.rem > 0 ? 'المتبقي عليه من حصته' : 'زيادة عن حصته'}</b><b class="${r.rem > 0 ? 'text-amber-300' : 'text-emerald-300'}">${ptM(Math.abs(r.rem))}</b></div></div>
              <div class="${ptCard}"><div class="flex items-center justify-between"><b class="text-white text-sm">البنود اللي دفعها</b><button onclick="ptToggleGroup()" class="set-pill ${ptGroup ? 'on' : ''}">${ptGroup ? 'عرض كل بند' : 'تجميع حسب الاسم'}</button></div><div class="space-y-1.5">${items || '<p class="text-gray-500 text-center py-2">مفيش بنود لسه.</p>'}</div><div class="flex justify-between bg-gold/10 border border-gold/40 rounded-xl px-3 py-2"><b class="text-white">إجمالي البنود (${r.n})</b><b class="text-gold">${ptM(r.paid)}</b></div></div>
              ${byPayee.length ? `<div class="${ptCard}"><b class="text-white text-sm">اللي اتدفع لكل جهة (مستلم)</b>${byPayee.map(g => `<div class="flex justify-between bg-darkbg rounded-xl px-3 py-2"><span class="text-white">${esc(g.name)}</span><b class="text-gold">${ptM(g.sum)}</b></div>`).join('')}</div>` : ''}
              <div class="${ptCard}"><b class="text-white text-sm">اللي سلّمه لشركاء</b>${out.map(t => ptRowTr(t, p.id)).join('') || '<p class="text-gray-500">مفيش.</p>'}<b class="text-white text-sm block pt-2">اللي استلمه من شركاء</b>${inn.map(t => ptRowTr(t, p.id)).join('') || '<p class="text-gray-500">مفيش.</p>'}</div>`;
        }
        function renderPartners() {
            const root = document.getElementById('view-partners'); if (!root) return;
            if (!currentUser?.permissions?.partners) { root.innerHTML = ''; return; }
            const d = ptData(), c = ptCalc(), sup = ptSuper(), me = ptMine();
            if (ptOpen) { const r = c.rows.find(x => x.p.id === ptOpen); if (r) { root.innerHTML = ptStatement(r); return; } ptOpen = null; }
            if (!d.list.length) { root.innerHTML = `<div class="${ptCard} text-center py-8"><h2 class="text-sm font-black text-gold">الشركاء</h2><p class="text-gray-300 leading-relaxed">لسه ماتسجّلش شركاء. سجّل الشركاء (كام شريك، واسم كل واحد، وحصته)، واختار الشريك الإداري اللي بيدير المشروع.</p>${sup ? `<button onclick="ptEditPartners()" class="${ptBtnG} py-2.5">إعداد الشركاء</button>` : '<p class="text-gray-500">المدير الأساسي هو اللي يعدّ الشركاء.</p>'}</div>`; return; }
            const cards = c.rows.map(r => { const pct = r.p.target > 0 ? Math.max(0, Math.min(100, Math.round(r.net / r.p.target * 100))) : 100, can = ptCan(r.p.id);
                return `<div class="${ptCard}"><div class="flex items-center justify-between"><b class="text-white text-sm">${esc(r.p.name)}${r.p.mgr ? ' <span class="text-[10px] bg-gold/20 text-gold rounded px-1.5 py-0.5">الشريك الإداري</span>' : ''}${me === r.p.id ? ' <span class="text-[10px] text-gold">(إنت)</span>' : ''}</b><span class="px-2 py-0.5 rounded-lg text-[11px] font-black ${r.rem <= 0 ? 'bg-emerald-950/60 text-emerald-300' : 'bg-amber-950/60 text-amber-300'}">${r.rem <= 0 ? (r.rem < 0 ? 'زيادة ' + ptM(-r.rem) : 'خلّص حصته ✓') : 'متبقي ' + ptM(r.rem)}</span></div>
                <div class="grid grid-cols-2 gap-2 text-center"><div class="bg-darkbg rounded-xl p-2"><div class="text-gray-400">مساهمته الصافية</div><b class="text-gold">${ptM(r.net)}</b></div><div class="bg-darkbg rounded-xl p-2"><div class="text-gray-400">حصته</div><b class="text-white">${ptM(r.p.target)}</b></div></div>
                <div class="h-2 rounded-full bg-darkbg overflow-hidden"><div class="h-full bg-gold" style="width:${pct}%"></div></div>${r.unconf ? `<div class="text-amber-300">${r.unconf} تحويل لسه ما أكدش استلامه</div>` : ''}
                <div class="flex flex-wrap gap-1.5 pt-1"><button onclick="ptView('${r.p.id}')" class="${ptBtnG}">كشف الحساب</button>${can ? `<button onclick="ptAddExp(null,'${r.p.id}')" class="${ptBtn}">+ بند</button><button onclick="ptNote('${r.p.id}')" class="${ptBtn}">📝 دفتر</button><button onclick="ptAddTr(null,'${r.p.id}')" class="${ptBtn}">+ تحويل</button>` : ''}<button onclick="ptPrint('${r.p.id}')" class="${ptBtn}">🖨</button></div></div>`; }).join('');
            const settle = c.settle.length ? c.settle.map(s => `<div class="flex justify-between bg-darkbg rounded-xl px-3 py-2"><span><b class="text-white">${esc(ptName(s.from))}</b> يدفع لـ <b class="text-white">${esc(ptName(s.to))}</b></span><b class="text-gold">${ptM(s.amt)}</b></div>`).join('') : '<p class="text-emerald-300">الحسابات متساوية.</p>';
            const owedG = ptGroupBy(d.owed, 'payee'), owedTot = d.owed.reduce((s, x) => s + (Number(x.amt) || 0), 0), extTot = d.ext.reduce((s, x) => s + (Number(x.amt) || 0), 0);
            const gm = ptGroupBy(d.exp, 'item').map(g => `<div class="flex justify-between bg-darkbg rounded-xl px-3 py-2"><span class="text-white">${esc(g.name)} <span class="text-gray-500">(${g.n})</span></span><b class="text-gold">${ptM(g.sum)}</b></div>`).join('');
            const missing = sup && !d.noSeed && d.seeded && d.list.length >= 2 ? ptSeedMissing() : 0;   // كشف فادي الأولي بس لو اتستورد قبل كده (مش بيظهر لأي عميل جديد)
            root.innerHTML = `<div class="flex flex-wrap items-center gap-2"><h2 class="text-sm font-black text-gold ml-2">الشركاء</h2>${sup ? `<button onclick="ptEditPartners()" class="mr-auto ${ptBtn}">الشركاء والحصص</button>` : ''}</div>
              <div class="grid grid-cols-3 gap-2 text-xs"><div class="bg-panelbg border border-bordergold rounded-xl p-3 text-center"><div class="text-gray-400">إجمالي المصروف</div><b class="text-gold text-base">${ptM(c.total)}</b></div><div class="bg-panelbg border border-bordergold rounded-xl p-3 text-center"><div class="text-gray-400">إجمالي المتبقي على الشركاء</div><b class="text-amber-300 text-base">${ptM(c.rows.reduce((s, r) => s + Math.max(0, r.rem), 0))}</b></div><div class="bg-panelbg border border-bordergold rounded-xl p-3 text-center"><div class="text-gray-400">نصيب كل شريك بالتساوي</div><b class="text-white text-base">${ptM(c.share)}</b></div></div>
              <div class="grid gap-3 md:grid-cols-3">${cards}</div>
              <div class="${ptCard}"><div class="flex items-center justify-between"><h3 class="text-sm font-black text-white">المتبقي عند الصنايعية والموردين (${ptM(owedTot)})</h3><button onclick="ptAddOwed()" class="${ptBtn} text-gold">+ إضافة</button></div>
                ${owedG.map(g => `<div class="flex justify-between bg-gold/10 rounded-xl px-3 py-1.5"><b class="text-white">${esc(g.name)}</b><b class="text-amber-300">${ptM(g.sum)}</b></div>`).join('')}
                ${d.owed.map(x => { const cn = sup || (!!me && x.own === me); return `<div class="flex items-center justify-between gap-2 bg-darkbg rounded-xl px-3 py-2"><div class="min-w-0"><div class="text-white font-bold truncate">${esc(x.item)}</div><div class="text-gray-500">${esc(x.payee || 'غير محدد')}${x.note ? ' • ' + esc(x.note) : ''}</div></div><div class="flex items-center gap-2 shrink-0"><b class="text-amber-300">${ptM(x.amt)}</b>${me || sup ? `<button onclick="ptPayOwed('${x.id}')" class="${ptBtnG} !px-2 !py-1">تم الدفع</button>` : ''}${cn ? `<button onclick="ptDel('owed','${x.id}')" class="text-red-400 font-black">×</button>` : ''}</div></div>`; }).join('') || '<p class="text-gray-500">مفيش مستحقات متبقية.</p>'}<p class="text-gray-500">لما تدفع جزء من المستحق بيتسجل كمصروف على حسابك والمتبقي بيقل.</p></div>
              <div class="${ptCard}"><h3 class="text-sm font-black text-white">التسوية (لو الإجمالي اتقسم بالتساوي)</h3>${settle}<p class="text-gray-500">الفلوس دي بتتسلّم بينكم بره البرنامج، وبعدها سجّلوا "تحويل" عشان الأرقام تتساوى.</p></div>
              <div class="${ptCard}"><div class="flex items-center justify-between"><h3 class="text-sm font-black text-white">مدفوعات من خارج حساب الشركاء (${ptM(extTot)})</h3><button onclick="ptAddExt()" class="${ptBtn} text-gold">+ إضافة</button></div>${d.ext.map(x => { const cn = sup || (!!me && x.own === me); return `<div class="flex items-center justify-between gap-2 bg-darkbg rounded-xl px-3 py-2"><div class="min-w-0"><div class="text-white font-bold truncate">${esc(x.item)}</div><div class="text-gray-500">دفعها ${esc(x.who || 'غير محدد')}${x.date ? ' • ' + esc(x.date) : ''}${x.note ? ' • ' + esc(x.note) : ''}</div></div><div class="flex items-center gap-2 shrink-0"><b class="text-gray-300">${ptM(x.amt)}</b>${cn ? `<button onclick="ptDel('ext','${x.id}')" class="text-red-400 font-black">×</button>` : ''}</div></div>`; }).join('') || '<p class="text-gray-500">مفيش.</p>'}<p class="text-gray-500">للتوثيق بس. مش بتدخل في حساب الشركاء.</p></div>
              <details class="${ptCard}"><summary class="text-sm font-black text-white cursor-pointer">كل المصروفات مجمّعة حسب الاسم (${ptM(c.total)})</summary><div class="space-y-1.5 pt-2">${gm || '<p class="text-gray-500">مفيش.</p>'}</div></details>
              ${sup ? `<details class="${ptCard}"><summary class="text-sm font-black text-white cursor-pointer">سلة المحذوفات (${d.trash.length})</summary><div class="space-y-1.5 pt-2">${d.trash.map((x, i) => `<div class="flex items-center justify-between gap-2 bg-darkbg rounded-xl px-3 py-2"><div class="min-w-0"><div class="text-white font-bold truncate">${ptKindName[x.kind] || ''}: ${esc(x.rec.item || ('تحويل ' + ptName(x.rec.from) + ' ← ' + ptName(x.rec.to)))} ${ptM(x.rec.amt)}</div><div class="text-gray-500">حذفه ${esc(x.by)} • ${esc(ptDT(x.at))}</div></div><button onclick="ptRestore(${i})" class="${ptBtnG} !px-2 !py-1 shrink-0">استرجاع</button></div>`).join('') || '<p class="text-gray-500">فاضية.</p>'}</div></details>` : ''}
              <details class="${ptCard}"><summary class="text-sm font-black text-white cursor-pointer">سجل التعديلات (${d.log.length})</summary><div class="space-y-1 pt-2 max-h-72 overflow-y-auto">${d.log.slice(0, 150).map(l => `<div class="bg-darkbg rounded-lg px-3 py-1.5"><span class="text-gray-500">${esc(ptDT(l.at))} • ${esc(l.by)}</span><br><span class="text-gray-200">${esc(l.t)}</span></div>`).join('') || '<p class="text-gray-500">مفيش.</p>'}</div></details>
              ${sup ? `<details class="${ptCard}"><summary class="text-sm font-black text-red-300 cursor-pointer">إعادة الضبط (للمدير الأساسي)</summary><div class="space-y-2 pt-2"><p class="text-gray-400 leading-relaxed">للبدء من جديد (مثلاً قبل عرض البرنامج على عميل). المسح نهائي، فاعمل نسخة احتياطية الأول لو محتاجها.</p><button onclick="ptResetData()" class="w-full bg-red-950/40 border border-red-800/60 text-red-300 font-bold py-2 rounded-xl">تصفير الحركات (بنود وتحويلات ومستحقات) مع إبقاء الشركاء</button><button onclick="ptResetAll()" class="w-full bg-red-950/40 border border-red-800/60 text-red-300 font-bold py-2 rounded-xl">مسح الشركاء والحركات والبدء من الصفر</button></div></details>` : ''}
              ${missing ? `<button onclick="ptSeed()" class="w-full ${ptBtn} text-gold py-2">استيراد/استرجاع كشف فادي الأولي (${missing} بند ناقص)</button>` : ''}`;
        }
        function ptView(id) { ptOpen = id; renderPartners(); window.scrollTo(0, 0); }
        function ptBack() { ptOpen = null; renderPartners(); }
        function ptPrint(id) {
            const c = ptCalc(), r = c.rows.find(x => x.p.id === id); if (!r) return; const d = ptData();
            const mine = d.exp.filter(e => e.by === id).sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')));
            const out = d.tr.filter(t => t.from === id), inn = d.tr.filter(t => t.to === id), R = (a, b, cl) => `<tr${cl ? ` class="${cl}"` : ''}><td>${a}</td><td>${b}</td></tr>`;
            const html = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>كشف حساب ${esc(r.p.name)}</title><style>body{font-family:Tahoma,Arial,sans-serif;padding:24px;color:#111}h1{font-size:20px;margin:0 0 4px}h2{font-size:15px;margin:18px 0 6px;border-bottom:1px solid #999;padding-bottom:3px}table{width:100%;border-collapse:collapse;font-size:13px}td{padding:5px 6px;border-bottom:1px solid #ddd}td:last-child{text-align:left;white-space:nowrap}.tot td{font-weight:bold;background:#f3f3f3}.m{color:#555;font-size:12px}</style></head><body><h1>كشف حساب الشريك: ${esc(r.p.name)}</h1><div class="m">تاريخ الطباعة: ${esc(getTodayISO())} • طبعه: ${esc(currentUser ? currentUser.displayName : '')}</div>
            <h2>الملخص</h2><table>${R('حصته المتفق عليها', ptM(r.p.target))}${R('اللي دفعه للموردين (' + r.n + ' بند)', ptM(r.paid))}${R('سلّم لشركاء', ptM(r.sent))}${R('استلم من شركاء', ptM(r.recv))}${R('إجمالي مساهمته الصافية', ptM(r.net), 'tot')}${R(r.rem > 0 ? 'المتبقي عليه' : 'زيادة عن حصته', ptM(Math.abs(r.rem)), 'tot')}</table>
            <h2>البنود</h2><table>${mine.map(e => R(esc(e.date || '') + ' - ' + esc(e.item) + (e.payee ? ' (' + esc(e.payee) + ')' : ''), ptM(e.amt))).join('') || R('لا يوجد', '-')}${R('إجمالي البنود', ptM(r.paid), 'tot')}</table>
            <h2>التحويلات</h2><table>${out.map(t => R(esc(t.date || '') + ' - سلّم ' + esc(ptName(t.to)), ptM(t.amt))).join('')}${inn.map(t => R(esc(t.date || '') + ' - استلم من ' + esc(ptName(t.from)), ptM(t.amt))).join('') || ''}${!out.length && !inn.length ? R('لا يوجد', '-') : ''}</table>
            <script>onload=()=>setTimeout(()=>print(),300)<\/script></body></html>`;
            const w = window.open('', '_blank'); if (!w) { showToast('اسمح بالنوافذ المنبثقة عشان تطبع', 'error'); return; }
            w.document.write(html); w.document.close();
        }
        function ptToggleGroup() { ptGroup = !ptGroup; renderPartners(); }
        function ptSave(msg) { saveState(); renderPartners(); if (msg) showToast(msg); }
        // المالك الافتراضي للإضافة: الشريك المربوط بالمستخدم، أو اللي مفتوح دفتره، أو أول شريك (للمدير)
        const ptDefOwner = pre => ptMine() || pre || ptOpen || (ptData().list[0] || {}).id;
        const ptOwnerSel = (sel, label) => ptSuper() ? `<div><label class="${ptLbl}">${label}</label><select id="pt-by" class="${ptInp}">${ptOpts(sel)}</select></div>` : `<input type="hidden" id="pt-by" value="${esc(ptMine() || '')}"><p class="text-gray-400 text-xs">${label}: <b class="text-white">${esc(ptName(ptMine()))}</b></p>`;
        function ptAddExp(id, pre) {
            const d = ptData(), e = id ? d.exp.find(x => x.id === id) : null;
            if (e && !ptGuard(e.by)) return; if (!e && !ptSuper() && !ptMine()) { showToast('حسابك مش مربوط بشريك', 'error'); return; }
            askBox(e ? 'تعديل بند' : 'بند مصروف جديد', `<div class="space-y-2"><div><label class="${ptLbl}">اسم البند</label><input id="pt-item" class="${ptInp}" value="${esc(e ? e.item : '')}" placeholder="اكتب اسم البند"></div><div class="grid grid-cols-2 gap-2"><div><label class="${ptLbl}">المبلغ</label><input id="pt-amt" type="number" min="0" inputmode="decimal" class="${ptInp}" value="${e ? e.amt : ''}"></div><div><label class="${ptLbl}">التاريخ</label><input id="pt-date" type="date" class="${ptInp}" value="${e ? e.date || '' : getTodayISO()}"></div></div>${ptOwnerSel(e ? e.by : ptDefOwner(pre), 'الشريك اللي دفع')}<div><label class="${ptLbl}">المستلم (اختياري): الصنايعي أو المورد أو الجهة اللي اتدفعله</label><input id="pt-payee" class="${ptInp}" value="${esc(e ? e.payee || '' : '')}" placeholder="اسم المستلم"></div><div><label class="${ptLbl}">ملاحظة (اختياري)</label><input id="pt-note" class="${ptInp}" value="${esc(e ? e.note || '' : '')}"></div><label class="flex items-center gap-2 text-gray-300 text-xs"><input type="checkbox" id="pt-kind" class="accent-gold" ${e && e.inKind ? 'checked' : ''}> مساهمة عينية (جهاز أو حاجة بسعر متفق عليه)</label></div>`, () => {
                const item = byId('pt-item').value.trim(), amt = Number(byId('pt-amt').value), by = byId('pt-by').value;
                if (!item) { showToast('اكتب اسم البند', 'error'); return false; }
                if (!(amt > 0)) { showToast('اكتب مبلغ صحيح', 'error'); return false; }
                if (!ptCan(by)) { showToast('تقدر تسجّل على حسابك إنت بس', 'error'); return false; }
                const rec = e || { id: ptId(), at: new Date().toISOString() }; Object.assign(rec, { item, amt, date: byId('pt-date').value, by, payee: byId('pt-payee').value.trim(), note: byId('pt-note').value.trim(), inKind: byId('pt-kind').checked });
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
            askBox('دفتر ' + esc(ptName(owner)), `<div class="space-y-2"><p class="text-gray-400 text-xs leading-relaxed">اكتب كل بند في سطر: اسم البند ثم المبلغ في آخره. مثال:<br><span dir="ltr" class="text-gray-300">اسم البند 1500<br>بند تاني 10,000</span></p><textarea id="pt-notes" rows="9" class="${ptInp}" placeholder="اسم البند 1500"></textarea><div><label class="${ptLbl}">التاريخ (اختياري)</label><input id="pt-date" type="date" class="${ptInp}" value="${getTodayISO()}"></div></div>`, () => {
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
            askBox('مستحق متبقي لجهة', `<div class="space-y-2"><div><label class="${ptLbl}">المستلم (الصنايعي أو المورد)</label><input id="pt-payee" class="${ptInp}" placeholder="اسم الشخص أو الجهة"></div><div><label class="${ptLbl}">البند</label><input id="pt-item" class="${ptInp}" placeholder="اسم البند"></div><div><label class="${ptLbl}">المبلغ المتبقي له</label><input id="pt-amt" type="number" min="0" inputmode="decimal" class="${ptInp}"></div><div><label class="${ptLbl}">ملاحظة (اختياري)</label><input id="pt-note" class="${ptInp}"></div></div>`, () => {
                const item = byId('pt-item').value.trim(), amt = Number(byId('pt-amt').value);
                if (!item || !(amt > 0)) { showToast('اكتب البند والمبلغ', 'error'); return false; }
                ptData().owed.push({ id: ptId(), item, payee: byId('pt-payee').value.trim(), amt, note: byId('pt-note').value.trim(), own: ptMine() || '' }); ptLog(`مستحق ${item} ${amt}`); ptSave('تم الحفظ');
            }, 'حفظ');
        }
        function ptPayOwed(id) {
            const d = ptData(), o = d.owed.find(x => x.id === id); if (!o) return;
            if (!ptSuper() && !ptMine()) { showToast('حسابك مش مربوط بشريك', 'error'); return; }
            askBox('تسجيل دفع من المستحق', `<div class="space-y-2"><p class="text-gray-300 text-xs">${esc(o.item)}${o.payee ? ' - ' + esc(o.payee) : ''} - المتبقي ${ptM(o.amt)}</p><div><label class="${ptLbl}">اللي اتدفع دلوقتي</label><input id="pt-amt" type="number" min="0" inputmode="decimal" class="${ptInp}" value="${o.amt}"></div>${ptOwnerSel(ptDefOwner(), 'الشريك اللي دفع')}<div><label class="${ptLbl}">التاريخ</label><input id="pt-date" type="date" class="${ptInp}" value="${getTodayISO()}"></div></div>`, () => {
                const amt = Number(byId('pt-amt').value), by = byId('pt-by').value;
                if (!(amt > 0) || amt > o.amt + 0.001) { showToast('المبلغ لازم يكون أكبر من صفر ومايزيدش عن المتبقي', 'error'); return false; }
                if (!ptCan(by)) { showToast('تقدر تسجّل على حسابك إنت بس', 'error'); return false; }
                d.exp.unshift({ id: ptId(), at: new Date().toISOString(), item: o.item, amt, date: byId('pt-date').value, by, payee: o.payee || '', note: 'دفعة من مستحق' });
                o.amt = ptR(o.amt - amt); if (o.amt <= 0.001) d.owed = d.owed.filter(x => x.id !== id);
                ptLog(`دفع من مستحق ${o.item} ${amt} (${ptName(by)})`); ptSave('تم تسجيل الدفع على حسابك');
            }, 'تسجيل');
        }
        function ptAddExt() {
            if (!ptSuper() && !ptMine()) { showToast('حسابك مش مربوط بشريك', 'error'); return; }
            askBox('مدفوع من خارج حساب الشركاء', `<div class="space-y-2"><div><label class="${ptLbl}">البند</label><input id="pt-item" class="${ptInp}" placeholder="اسم البند"></div><div class="grid grid-cols-2 gap-2"><div><label class="${ptLbl}">المبلغ</label><input id="pt-amt" type="number" min="0" inputmode="decimal" class="${ptInp}"></div><div><label class="${ptLbl}">مين دفعها</label><input id="pt-who" class="${ptInp}" placeholder="الاسم"></div></div><div><label class="${ptLbl}">ملاحظة (اختياري)</label><input id="pt-note" class="${ptInp}"></div></div>`, () => {
                const item = byId('pt-item').value.trim(), amt = Number(byId('pt-amt').value);
                if (!item || !(amt > 0)) { showToast('اكتب البند والمبلغ', 'error'); return false; }
                ptData().ext.unshift({ id: ptId(), item, amt, who: byId('pt-who').value.trim(), date: getTodayISO(), note: byId('pt-note').value.trim(), own: ptMine() || '' }); ptLog(`مدفوع من خارج الحساب ${item} ${amt}`); ptSave('تم الحفظ');
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
        // إدارة الشركاء (المدير الأساسي بس): الاسم والحصة والشريك الإداري، إضافة شريك، حذف شريك فاضي
        function ptReadRows() { const d = ptData(), mi = (document.querySelector('input[name="pt-mgr"]:checked') || {}).value; d.list.forEach((p, i) => { const n = byId('pn-' + i), g = byId('pg-' + i); if (n && n.value.trim()) p.name = n.value.trim(); if (g && g.value !== '') p.target = Number(g.value) || 0; p.mgr = String(i) === mi; }); }
        function ptEditPartners() {
            if (!ptSuper()) { showToast('للمدير الأساسي بس', 'error'); return; }
            const d = ptData(), used = id => d.exp.some(e => e.by === id) || d.tr.some(t => t.from === id || t.to === id) || (appState.users || []).some(u => u.partnerId === id);
            askBox('الشركاء والحصص', `<div class="space-y-2"><p class="text-gray-400 text-xs leading-relaxed">اكتب اسم كل شريك وحصته المتفق عليها، واختار <b class="text-white">الشريك الإداري</b> (اللي بيدير المشروع).</p>${d.list.length ? `<div class="grid grid-cols-[auto_1fr_1fr_auto] gap-2 text-[10px] text-gray-500 px-1"><span>إداري</span><span>الاسم</span><span>الحصة</span><span></span></div>` : '<p class="text-amber-300 text-xs">لسه مفيش شركاء. اضغط "+ شريك جديد".</p>'}${d.list.map((p, i) => `<div class="grid grid-cols-[auto_1fr_1fr_auto] gap-2 items-center"><input type="radio" name="pt-mgr" value="${i}" ${p.mgr ? 'checked' : ''} class="accent-gold"><input id="pn-${i}" class="${ptInp}" value="${esc(p.name)}" placeholder="اسم الشريك"><input id="pg-${i}" type="number" min="0" class="${ptInp}" value="${p.target}" placeholder="الحصة"><span class="w-6 text-center">${used(p.id) ? '' : `<button type="button" onclick="ptRemovePartner('${p.id}')" class="text-red-400 font-black">×</button>`}</span></div>`).join('')}<button type="button" onclick="ptAddPartner()" class="w-full bg-darkbg border border-bordergold text-gold font-black py-2 rounded-xl">+ شريك جديد</button><p class="text-gray-500 text-xs">الشريك اللي عليه حركات أو مربوط بمستخدم مايتحذفش.</p></div>`, () => {
                ptReadRows(); if (d.list.some(p => !p.name || !(p.target >= 0))) { showToast('راجع الأسماء والحصص', 'error'); return false; }
                ptLog('تعديل الشركاء والحصص'); ptSave('تم الحفظ');
            }, 'حفظ');
        }
        function ptAddPartner() {
            if (!ptSuper()) return; const d = ptData(); if (d.list.length >= 8) { showToast('الحد الأقصى 8 شركاء', 'error'); return; }
            ptReadRows(); d.list.push({ id: 'p' + Date.now().toString(36), name: 'شريك ' + (d.list.length + 1), target: d.list.length ? d.list[d.list.length - 1].target : 0, mgr: false });
            ptLog('إضافة شريك جديد'); saveState(); byId('ask-box')?.remove(); renderPartners(); ptEditPartners();
        }
        function ptRemovePartner(id) {
            if (!ptSuper()) return; const d = ptData();
            if (d.exp.some(e => e.by === id) || d.tr.some(t => t.from === id || t.to === id) || (appState.users || []).some(u => u.partnerId === id)) { showToast('عليه حركات أو مربوط بمستخدم', 'error'); return; }
            ptReadRows(); const nm = ptName(id); d.list = d.list.filter(p => p.id !== id); ptLog('حذف شريك ' + nm); saveState(); byId('ask-box')?.remove(); renderPartners(); ptEditPartners();
        }
        function ptResetData() {
            if (!ptSuper()) { showToast('للمدير الأساسي بس', 'error'); return; }
            confirmDanger('هيتمسح كل البنود والتحويلات والمستحقات والمدفوعات الخارجية وسلة المحذوفات وسجل الشركاء. الشركاء وحصصهم هيفضلوا.', () => { const d = ptData(); d.exp = []; d.tr = []; d.owed = []; d.ext = []; d.trash = []; d.log = []; d.noSeed = true; d.seeded = false; ptOpen = null; ptLog('تصفير حركات الشركاء'); ptSave('تم التصفير'); });
        }
        function ptResetAll() {
            if (!ptSuper()) { showToast('للمدير الأساسي بس', 'error'); return; }
            confirmDanger('هيتمسح كل الشركاء وحصصهم وكل حركاتهم، وتبدأ إعداد الشركاء من الصفر. المستخدمين المربوطين بشركاء هيتفك ربطهم.', () => { const d = ptData(); d.list = []; d.exp = []; d.tr = []; d.owed = []; d.ext = []; d.trash = []; d.log = []; d.noSeed = true; d.seeded = false; ptOpen = null; (appState.users || []).forEach(u => { delete u.partnerId; }); ptLog('مسح الشركاء والبدء من الصفر'); ptSave('تم المسح. ابدأ بإعداد الشركاء'); });
        }
        // استيراد كشف فادي الأولي (مرة واحدة). z = دفعها زيكو (برّه الحساب)، y = دفعها زيزو
        const PT_SEED = [['بضاعة الكهرباء', 20000], ['مصنعية محمد الكهربائي', 5000], ['أدوات تنظيف', 500], ['شحن كارت الكهرباء', 200], ['دفع استلام شحن الأربع أعدان', 70], ['أبو السعود', 10000], ['خطوط فودافون', 450], ['شحن كارت الكهرباء', 500, 'z'], ['جمال النجار', 250], ['مسامير زائد زاوية', 130], ['أدوات لتنظيف القزاز الواجهة', 150], ['أكل للنظافة القزاز والأرضية', 150], ['شحن كارت الكهرباء', 500], ['شحن كارت المياه', 500, 'z'], ['قير الباركيه', 200], ['سيليكون للباركيه', 120], ['جمال النجار للباركيه', 1700], ['أنس', 5000], ['ما شابك للسيراميك', 130], ['مادة لزق السيراميك', 1260], ['بلاط', 11000, 'y'], ['تسقية البلاط بالألوان', 170], ['مصنعية تركيب البلاط بالوزر', 3500], ['حسين النقاش', 10000], ['حسين النقاش', 5000], ['تنظيف المكان ورمي الزبالة', 250], ['خرطوم 6 م للتكييف', 170], ['ترسيكل الخشب من البيت الحديث', 150], ['أبو السعود', 16000], ['شحن كارت الكهرباء', 500, 'z'], ['شحن كارت المياه', 500, 'z'], ['شحن كارت المياه', 500, 'z'], ['إصلاح كمبيوتر', 1700], ['واي فاي + مشترك + كابلين باور + وصلة + بادا', 850], ['أنس', 7000], ['كاميرات', 9500]];
        const ptSeedGone = () => new Set(ptData().trash.map(x => x.kind + ':' + x.id));
        function ptSeedMissing() {
            const d = ptData(), gone = ptSeedGone(); let n = 0;
            PT_SEED.forEach((r, i) => { const k = r[2] === 'z' ? 'ext' : 'exp', id = 'seed' + i; if (!d[k].some(x => x.id === id)) n++; });
            if (!d.owed.some(x => x.id === 'seed_owed')) n++;
            return n;
        }
        function ptSeed() {
            if (!ptSuper() || ptData().list.length < 1) return; const n = ptSeedMissing(); if (!n) { showToast('كل البنود موجودة'); return; }
            askConfirm(`هيضيف ${n} بند ناقص من كشف فادي الأولي (البلاط 11,000 على زيزو، وبنود زيكو في "خارج حساب الشركاء"، والتزام متبقي الكاميرات 7,270). اللي موجود فعلاً مش هيتكرر.`, () => {
                const d = ptData(); d.trash = d.trash.filter(x => !/^seed/.test(x.id)); const gone = new Set(), fady = d.list[0].id, zizo = (d.list[1] || d.list[0]).id;
                PT_SEED.forEach((r, i) => {
                    const id = 'seed' + i, k = r[2] === 'z' ? 'ext' : 'exp'; if (d[k].some(x => x.id === id) || gone.has(k + ':' + id)) return;
                    if (k === 'ext') d.ext.push({ id, item: r[0], amt: r[1], who: 'زيكو', date: '', note: '', own: '' });
                    else d.exp.push({ id, at: new Date(Date.now() - i).toISOString(), item: r[0], amt: r[1], date: '', by: r[2] === 'y' ? zizo : fady, payee: '', note: '' });
                });
                if (!d.owed.some(x => x.id === 'seed_owed') && !gone.has('owed:seed_owed')) d.owed.push({ id: 'seed_owed', item: 'متبقي الكاميرات', payee: 'مورد الكاميرات', amt: 7270, note: '', own: '' });
                d.seeded = true; ptLog('استيراد بنود كشف فادي الأولي الناقصة (' + n + ')'); ptSave('تم الاستيراد');
            }, 'استورد');
        }
