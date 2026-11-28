        // ===================== BOOKING PAGE (صفحة حجز العميل book.html) — control panel + publish + receive requests =====================
        // appState.bookingPage = {enabled,open,close,step,daysAhead,minNotice,phone,welcome,barbers:{id:{show,available,bio,photo,daysOff:[]}},services:{id:{show,price,dur}}}
        const BP_DAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
        let bpTimer = null, bpLast = '', bpPubAt = '', bpListening = false;
        function bpCfg() {
            const c = appState.bookingPage = appState.bookingPage || { enabled: false, open: '12:00', close: '02:00', step: 30, daysAhead: 30, minNotice: 60, phone: '', welcome: 'أهلاً بيك! احجز ميعادك في دقيقة.', barbers: {}, services: {} };
            c.barbers = c.barbers || {}; c.services = c.services || {};
            return c;
        }
        const bpBarbers = () => appState.barbers.filter(b => !b.hidden && isPerf(b));
        const bpServices = () => appState.catalog.filter(c => c.category !== 'cat_cafe');
        const bpB = id => { const c = bpCfg(); return c.barbers[id] = c.barbers[id] || { show: true, available: true, bio: '', photo: '', daysOff: [] }; };
        const bpS = s => { const c = bpCfg(); return c.services[s.id] = c.services[s.id] || { show: true, price: '', dur: 30 }; };
        const bpSvcDur = id => { const s = bpCfg().services[id]; return s && Number(s.dur) > 0 ? Number(s.dur) : 60; };
        function bpLink() { return location.origin + location.pathname.replace(/[^/]*$/, '') + 'book.html'; }
        // ---------- build + publish the PUBLIC copy (no phones, no salaries, no invoices) ----------
        function bpBuild() {
            const c = bpCfg(), si = appState.salonInfo || {};
            const barbers = bpBarbers().map(b => { const x = bpB(b.id); return x.show ? { id: b.id, name: b.name, photo: x.photo || '', bio: x.bio || '', available: !!x.available, daysOff: x.daysOff || [] } : null; }).filter(Boolean);
            const services = bpServices().map(s => { const x = bpS(s); return x.show ? { id: s.id, name: s.name, price: Number(x.price) > 0 ? Number(x.price) : Number(s.price), dur: bpSvcDur(s.id) } : null; }).filter(Boolean);
            const busy = {}, today = getTodayISO();
            (appState.bookings || []).filter(b => bkActive(b) && b.date >= today).forEach(b => { const d = Number(b.dur) > 0 ? Number(b.dur) : Math.max(30, (b.items || []).reduce((t, i) => t + bpSvcDur(i.cid) * (i.qty || 1), 0)); ((busy[b.date] = busy[b.date] || {})[b.barberId] = (busy[b.date][b.barberId] || [])).push({ t: b.time, d }); });
            return { enabled: !!c.enabled, salon: { name: si.name || 'TOMMY BARBER', sub: si.sub || '', phone: c.phone || si.phone || '', address: si.address || '', welcome: c.welcome || '' }, open: c.open, close: c.close, step: Number(c.step) || 30, daysAhead: Number(c.daysAhead) || 30, minNotice: Number(c.minNotice) || 0, barbers, services, busy };
        }
        function bpSchedule() { clearTimeout(bpTimer); bpTimer = setTimeout(bpPublish, 1500); }
        function bpPublish(force) {
            if (!db || !cloudSynced) return;
            const o = bpBuild(), j = JSON.stringify(o); if (!force && j === bpLast) return;
            o.updatedAt = Date.now();
            db.ref('booking_public').set(o).then(() => { bpLast = j; bpPubAt = new Date().toLocaleTimeString(); const el = document.getElementById('bp-status'); if (el) el.textContent = 'اتنشرت آخر تعديلات ' + bpPubAt; }).catch(() => { const el = document.getElementById('bp-status'); if (el) el.textContent = 'تعذر النشر: راجع قواعد Firebase أو الربط الآمن'; });
        }
        // ---------- receive customer requests ----------
        function bpListen() {
            if (!db || bpListening) return; bpListening = true;
            db.ref('booking_requests').on('value', snap => {
                const all = snap.val() || {}; let added = 0;
                appState.bpSeen = appState.bpSeen || [];
                Object.keys(all).forEach(k => {
                    if (appState.bpSeen.includes(k) || (appState.bookings || []).some(b => b.id === 'w' + k)) return;
                    const r = all[k] || {}, c = bpCfg();
                    if (!r.name || !r.phone || !r.date || !r.time) return;
                    const items = (Array.isArray(r.services) ? r.services : Object.values(r.services || {})).map(s => { const cat = appState.catalog.find(x => x.id === s.id); const x = cat ? c.services[cat.id] : null; return { cid: s.id, name: cat ? cat.name : String(s.name || '').slice(0, 60), price: cat ? (x && Number(x.price) > 0 ? Number(x.price) : Number(cat.price)) : Number(s.price) || 0, qty: 1, category: cat ? cat.category : ((appState.categories[0] || {}).id || 'cat_cut') }; });
                    const bar = appState.barbers.find(b => b.id === r.barberId);
                    const total = items.reduce((t, i) => t + i.price, 0);
                    (appState.bookings = appState.bookings || []).unshift({ id: 'w' + k, no: appState.bookings.reduce((m, x) => Math.max(m, x.no || 0), 0) + 1, source: 'web', status: 'انتظار', type: 'عادي', clientName: String(r.name).slice(0, 60), phone: String(r.phone).slice(0, 15), barberId: bar ? bar.id : String(r.barberId || ''), barberName: bar ? bar.name : String(r.barberName || ''), date: String(r.date).slice(0, 10), time: String(r.time).slice(0, 5), total, items, pkgName: items.map(i => i.name).join(' + '), dur: Number(r.dur) || 0, notes: String(r.note || '').slice(0, 200), pays: [], reqAt: r.createdAt || 0 });
                    appState.bpSeen.push(k); added++; logAudit('طلب حجز جديد من الصفحة: ' + String(r.name).slice(0, 40));
                });
                if (appState.bpSeen.length > 800) appState.bpSeen = appState.bpSeen.slice(-500);
                if (added) { saveState(); showToast(added === 1 ? 'وصلك طلب حجز جديد من صفحة الحجز' : `وصلك ${added} طلبات حجز جديدة`); try { renderBookings(); } catch (e) { } }
                bpBadge();
            }, () => { });
        }
        function bpBadge() {
            const n = (appState.bookings || []).filter(b => b.source === 'web' && b.status === 'انتظار').length, sp = document.querySelector('#tab-bookings span');
            if (sp) sp.textContent = 'الحجوزات' + (n ? ` (${n})` : ''); else { const t = document.getElementById('tab-bookings'); if (t && !t.querySelector('svg')) t.textContent = 'الحجوزات' + (n ? ` (${n})` : ''); }
        }
        // ---------- secure link (Firebase login) ----------
        function syncSetupDlg() {
            const inp = 'w-full bg-darkbg border border-bordergold rounded-xl px-3 py-2 text-white', e = localStorage.getItem('tb_sync_email') || '';
            askBox('الربط الآمن بالسحابة', `<p class="text-gray-300 text-xs leading-relaxed">اكتب إيميل وباسورد حساب الصالون اللي عملته في Firebase. بيتحفظوا على الجهاز ده بس. لو سبتهم فاضيين، الربط الآمن بيتقفل على الجهاز ده.</p><input id="sy-e" dir="ltr" type="email" placeholder="الإيميل" value="${esc(e)}" class="${inp}"><input id="sy-p" dir="ltr" type="password" placeholder="الباسورد" class="${inp}">`, d => {
                const em = d.querySelector('#sy-e').value.trim(), pw = d.querySelector('#sy-p').value;
                if (em && pw) { localStorage.setItem('tb_sync_email', em); localStorage.setItem('tb_sync_pass', pw); } else { localStorage.removeItem('tb_sync_email'); localStorage.removeItem('tb_sync_pass'); }
                setTimeout(() => location.reload(), 300);
            }, 'حفظ وإعادة تحميل');
        }
        // ---------- settings panel ----------
        function bpSet(k, v) { bpCfg()[k] = v; saveState(); }
        function bpSetB(id, k, v) { bpB(id)[k] = v; saveState(); if (k === 'available' || k === 'show') renderBookingSettings(); }
        function bpDayOff(id, d, on) { const x = bpB(id), a = new Set(x.daysOff || []); on ? a.add(d) : a.delete(d); x.daysOff = [...a]; saveState(); }
        function bpSetS(id, k, v) { const s = appState.catalog.find(x => x.id === id); bpS(s)[k] = v; saveState(); }
        function bpPhoto(id, file) {
            if (!file) return; const img = new Image(), fr = new FileReader();
            fr.onload = () => { img.onload = () => { const c = document.createElement('canvas'), S = 320; c.width = c.height = S; const m = Math.min(img.width, img.height), sx = (img.width - m) / 2, sy = (img.height - m) / 2; c.getContext('2d').drawImage(img, sx, sy, m, m, 0, 0, S, S); bpB(id).photo = c.toDataURL('image/jpeg', 0.72); saveState(); renderBookingSettings(); showToast('تم حفظ الصورة'); }; img.src = fr.result; };
            fr.readAsDataURL(file);
        }
        function bpCopy() { const l = bpLink(); (navigator.clipboard ? navigator.clipboard.writeText(l) : Promise.reject()).then(() => showToast('تم نسخ الرابط'), () => askBox('رابط صفحة الحجز', `<input dir="ltr" readonly value="${esc(l)}" class="w-full bg-darkbg border border-bordergold rounded-xl px-3 py-2 text-gold" onclick="this.select()">`, () => { }, 'تمام')); }
        function renderBookingSettings() {
            const root = document.getElementById('set-p-booking'); if (!root) return;
            if (!currentUser?.permissions?.settings) { root.innerHTML = ''; return; }
            const c = bpCfg(), inp = 'w-full bg-darkbg border border-bordergold rounded-xl px-3 py-2 text-white', lbl = 'block text-gray-400 mb-1', card = 'bg-panelbg border border-bordergold rounded-2xl p-4 space-y-3 text-xs';
            const times = bkSlots().map(t => `<option value="${t}">${bkTime12(t)}</option>`).join('');
            const sel = (id, v) => { setTimeout(() => { const e = document.getElementById(id); if (e) e.value = v; }, 0); };
            root.innerHTML = `<div class="space-y-3 max-w-2xl">
              <div class="${card}"><div class="flex items-center justify-between"><h3 class="text-sm font-black text-gold">صفحة حجز العملاء</h3><label class="flex items-center gap-2 text-white font-bold"><input type="checkbox" ${c.enabled ? 'checked' : ''} onchange="bpSet('enabled',this.checked);renderBookingSettings()" class="accent-gold w-5 h-5"> مفعّلة</label></div>
                <p class="text-gray-300 leading-relaxed">العميل بيفتح الرابط ده من موبايله، يختار الحلاق والخدمة والميعاد، والطلب بيوصلك في تبويب الحجوزات بحالة "انتظار" وإنت تقبل أو ترفض. كل اللي تعدله هنا بينزل على الصفحة لوحده.</p>
                <div class="flex gap-2"><input dir="ltr" readonly value="${esc(bpLink())}" onclick="this.select()" class="${inp} text-gold"><button onclick="bpCopy()" class="px-4 bg-gold text-black font-black rounded-xl">نسخ</button></div>
                <div class="flex items-center justify-between"><span id="bp-status" class="text-gray-400">${bpPubAt ? 'اتنشرت آخر تعديلات ' + bpPubAt : ''}</span><button onclick="bpPublish(true)" class="px-3 py-1.5 bg-darkbg border border-bordergold text-gold font-bold rounded-xl">انشر دلوقتي</button></div></div>
              <div class="${card}"><h3 class="text-sm font-black text-white">مواعيد الصالون</h3>
                <div class="grid grid-cols-2 gap-2"><div><label class="${lbl}">بنفتح الساعة</label><select id="bp-open" onchange="bpSet('open',this.value)" class="${inp}">${times}</select></div><div><label class="${lbl}">بنقفل الساعة</label><select id="bp-close" onchange="bpSet('close',this.value)" class="${inp}">${times}</select></div>
                <div><label class="${lbl}">الفاصل بين المواعيد</label><select id="bp-step" onchange="bpSet('step',Number(this.value))" class="${inp}"><option value="15">15 دقيقة</option><option value="30">30 دقيقة</option><option value="60">ساعة</option></select></div><div><label class="${lbl}">الحجز قبلها بـ (دقيقة)</label><input type="number" min="0" value="${c.minNotice}" onchange="bpSet('minNotice',Number(this.value)||0)" class="${inp}"></div>
                <div><label class="${lbl}">العميل يحجز لحد كام يوم قدام</label><input type="number" min="1" max="90" value="${c.daysAhead}" onchange="bpSet('daysAhead',Number(this.value)||30)" class="${inp}"></div><div><label class="${lbl}">رقم التواصل اللي يظهر للعميل</label><input dir="ltr" value="${esc(c.phone)}" onchange="bpSet('phone',this.value.trim())" class="${inp}"></div></div>
                <div><label class="${lbl}">رسالة الترحيب</label><input value="${esc(c.welcome)}" onchange="bpSet('welcome',this.value.trim())" class="${inp}"></div></div>
              <div class="${card}"><h3 class="text-sm font-black text-white">الحلاقين</h3>${bpBarbers().map(b => { const x = bpB(b.id); return `<div class="border-t border-bordergold/40 pt-3 space-y-2"><div class="flex items-center gap-3"><label class="w-16 h-16 shrink-0 rounded-2xl bg-darkbg border border-bordergold overflow-hidden flex items-center justify-center text-gray-500 cursor-pointer">${x.photo ? `<img src="${x.photo}" class="w-full h-full object-cover">` : 'صورة'}<input type="file" accept="image/*" class="hidden" onchange="bpPhoto('${b.id}',this.files[0])"></label><div class="flex-1"><b class="text-white text-sm">${esc(b.name)}</b><div class="flex gap-4 mt-1"><label class="flex items-center gap-1 text-gray-200"><input type="checkbox" ${x.show ? 'checked' : ''} onchange="bpSetB('${b.id}','show',this.checked)" class="accent-gold"> يظهر للعميل</label><label class="flex items-center gap-1 ${x.available ? 'text-emerald-300' : 'text-red-300'} font-bold"><input type="checkbox" ${x.available ? 'checked' : ''} onchange="bpSetB('${b.id}','available',this.checked)" class="accent-gold"> ${x.available ? 'متاح' : 'مش متاح حالياً'}</label></div></div></div>
                <input placeholder="نبذة قصيرة (اختياري)" value="${esc(x.bio)}" onchange="bpSetB('${b.id}','bio',this.value.trim())" class="${inp}"><div class="flex flex-wrap gap-x-3 gap-y-1 text-gray-300"><span class="text-gray-500">أيام الإجازة:</span>${BP_DAYS.map((n, i) => `<label class="flex items-center gap-1"><input type="checkbox" ${(x.daysOff || []).includes(i) ? 'checked' : ''} onchange="bpDayOff('${b.id}',${i},this.checked)" class="accent-gold"> ${n}</label>`).join('')}</div></div>`; }).join('') || '<p class="text-gray-500">ضيف حلاقين من تبويب الفريق.</p>'}</div>
              <div class="${card}"><h3 class="text-sm font-black text-white">الخدمات والأسعار والمدة</h3><p class="text-gray-500">السعر هنا للعرض على العميل. اتركه فاضي ياخد سعر الخدمة الأصلي. وفي الفاتورة بيتحاسب بسعر الخدمة الحقيقي وقت التنفيذ.</p>${bpServices().map(s => { const x = bpS(s); return `<div class="flex items-center gap-2 border-t border-bordergold/40 pt-2"><input type="checkbox" ${x.show ? 'checked' : ''} onchange="bpSetS('${s.id}','show',this.checked)" class="accent-gold"><span class="flex-1 text-gray-100">${esc(s.name)}</span><input type="number" min="0" placeholder="${s.price}" value="${x.price === '' ? '' : x.price}" onchange="bpSetS('${s.id}','price',this.value===''?'':Number(this.value))" class="bg-darkbg border border-bordergold rounded-xl px-2 py-1.5 text-white w-20 text-center"><input type="number" min="5" step="5" value="${x.dur}" onchange="bpSetS('${s.id}','dur',Number(this.value)||30)" class="bg-darkbg border border-bordergold rounded-xl px-2 py-1.5 text-white w-16 text-center"><span class="text-gray-500">د</span></div>`; }).join('')}</div>
              <div class="${card}"><h3 class="text-sm font-black text-white">الربط الآمن</h3><p class="text-gray-300 leading-relaxed">بيحمي بيانات الصالون وأرقام العملاء من أي حد معاه رابط قاعدة البيانات. لازم يتفعّل على كل جهاز بنفس الإيميل والباسورد. الحالة على الجهاز ده: <b class="${localStorage.getItem('tb_sync_email') ? 'text-emerald-300' : 'text-red-300'}">${localStorage.getItem('tb_sync_email') ? 'مفعّل (' + esc(localStorage.getItem('tb_sync_email')) + ')' : 'غير مفعّل'}</b></p><button onclick="syncSetupDlg()" class="w-full bg-darkbg border border-bordergold text-gold font-bold py-2.5 rounded-xl">إعداد الربط الآمن</button></div></div>`;
            sel('bp-open', c.open); sel('bp-close', c.close); sel('bp-step', String(c.step));
        }
