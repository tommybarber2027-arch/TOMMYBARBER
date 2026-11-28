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
            db.ref('booking_requests').on('value', snap => bpImport(snap.val() || {}), () => { showToast('مش قادر أقرا طلبات الحجز من السحابة. راجع الربط الآمن أو القواعد', 'error'); });
        }
        function bpPull() {
            if (!db) { showToast('مفيش اتصال بالسحابة', 'error'); return; }
            db.ref('booking_requests').once('value').then(s => { const n = (appState.bookings || []).length; bpImport(s.val() || {}); showToast((appState.bookings || []).length > n ? 'وصلت طلبات جديدة' : 'مفيش طلبات جديدة'); }).catch(() => showToast('مش قادر أقرا طلبات الحجز. راجع الربط الآمن أو القواعد', 'error'));
        }
        function bpImport(all) {
            {
                let added = 0;
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
            }
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
                if (em && pw) { localStorage.setItem('tb_sync_email', em); localStorage.setItem('tb_sync_pass', pw); } else { localStorage.removeItem('tb_sync_email'); localStorage.removeItem('tb_sync_pass'); localStorage.removeItem('tb_linked_ok'); }
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
            setTimeout(bpQrShow, 0);
            const sel = (id, v) => { setTimeout(() => { const e = document.getElementById(id); if (e) e.value = v; }, 0); };
            root.innerHTML = `<div class="space-y-3 max-w-2xl">
              <div class="${card}"><div class="flex items-center justify-between"><h3 class="text-sm font-black text-gold">إعدادات الحجز أونلاين</h3><label class="flex items-center gap-2 text-white font-bold"><input type="checkbox" ${c.enabled ? 'checked' : ''} onchange="bpSet('enabled',this.checked);renderBookingSettings()" class="accent-gold w-5 h-5"> مفعّلة</label></div>
                <p class="text-gray-300 leading-relaxed">العميل بيفتح الرابط ده من موبايله، يختار الحلاق والخدمة والميعاد، والطلبات بتوصلك في تبويب <b class="text-gold">الحجوزات</b> (في الشريط الرئيسي) بحالة "انتظار" وإنت تقبل أو ترفض. كل اللي تعدله هنا بينزل على الصفحة لوحده.</p>
                <div class="flex gap-2"><input dir="ltr" readonly value="${esc(bpLink())}" onclick="this.select()" class="${inp} text-gold"><button onclick="bpCopy()" class="px-4 bg-gold text-black font-black rounded-xl">نسخ</button></div>
                <div class="flex items-center gap-4 pt-1"><div id="bp-qr" class="shrink-0 text-gray-400"></div><div class="space-y-2"><div class="text-white font-black">باركود صفحة الحجز</div><div class="text-gray-400">العميل يصوّره بكاميرا الموبايل ويفتح صفحة الحجز على طول. نزّله أو اطبعه وعلّقه في الصالون أو ابعته على واتساب.</div><div class="flex gap-2"><button onclick="bpQrSave()" class="px-3 py-1.5 bg-gold text-black font-black rounded-xl">تنزيل الباركود</button><button onclick="bpQrPrint()" class="px-3 py-1.5 bg-darkbg border border-bordergold text-gold font-black rounded-xl">طباعة ملصق</button></div></div></div>
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

// ===================== QR code (offline generator, byte mode, ECC M, versions 1-10) =====================
function qrMake(text) {
    const data = [...new TextEncoder().encode(text)];
    const EC = [10, 16, 26, 18, 24, 16, 18, 22, 22, 26], NB = [1, 1, 1, 2, 2, 4, 4, 4, 5, 5];
    const raw = v => { let r = (16 * v + 128) * v + 64; if (v >= 2) { const n = Math.floor(v / 7) + 2; r -= (25 * n - 10) * n - 55; if (v >= 7) r -= 36; } return r; };
    let ver = 1;
    for (; ver <= 10; ver++) { const cap = Math.floor(raw(ver) / 8) - EC[ver - 1] * NB[ver - 1]; if (4 + (ver < 10 ? 8 : 16) + 8 * data.length <= cap * 8) break; }
    if (ver > 10) return null;
    const cap = Math.floor(raw(ver) / 8) - EC[ver - 1] * NB[ver - 1], bits = [];
    const put = (v, n) => { for (let i = n - 1; i >= 0; i--) bits.push((v >>> i) & 1); };
    put(4, 4); put(data.length, ver < 10 ? 8 : 16); data.forEach(b => put(b, 8));
    put(0, Math.min(4, cap * 8 - bits.length)); while (bits.length % 8) bits.push(0);
    for (let p = 0xEC; bits.length < cap * 8; p ^= 0xEC ^ 0x11) put(p, 8);
    const cw = []; for (let i = 0; i < bits.length; i += 8) cw.push(parseInt(bits.slice(i, i + 8).join(''), 2));
    // Reed-Solomon
    const exp = [], log = []; { let x = 1; for (let i = 0; i < 255; i++) { exp[i] = x; log[x] = i; x <<= 1; if (x & 256) x ^= 0x11D; } }
    const mul = (a, b) => a && b ? exp[(log[a] + log[b]) % 255] : 0;
    const ecl = EC[ver - 1], nb = NB[ver - 1];
    let g = [1]; for (let i = 0; i < ecl; i++) { const n = new Array(g.length + 1).fill(0); g.forEach((c, j) => { n[j] ^= c; n[j + 1] ^= mul(c, exp[i]); }); g = n; }
    const rs = d => { const r = new Array(ecl).fill(0); d.forEach(b => { const f = b ^ r.shift(); r.push(0); for (let i = 0; i < ecl; i++) r[i] ^= mul(g[i + 1], f); }); return r; };
    const rawCw = Math.floor(raw(ver) / 8), shortN = nb - rawCw % nb, shortLen = Math.floor(rawCw / nb);
    const blocks = []; for (let i = 0, k = 0; i < nb; i++) { const len = shortLen - ecl + (i < shortN ? 0 : 1); const d = cw.slice(k, k + len); k += len; blocks.push({ d, e: rs(d) }); }
    const fin = []; for (let i = 0; i < blocks[nb - 1].d.length; i++) blocks.forEach(b => { if (i < b.d.length) fin.push(b.d[i]); });
    for (let i = 0; i < ecl; i++) blocks.forEach(b => fin.push(b.e[i]));
    const size = ver * 4 + 17, m = [], fn = [];
    for (let i = 0; i < size; i++) { m.push(new Array(size).fill(false)); fn.push(new Array(size).fill(false)); }
    const set = (x, y, v) => { m[y][x] = v; fn[y][x] = true; };
    for (let i = 0; i < size; i++) { set(6, i, i % 2 == 0); set(i, 6, i % 2 == 0); }
    const finder = (cx, cy) => { for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) { const x = cx + dx, y = cy + dy; if (x >= 0 && x < size && y >= 0 && y < size) set(x, y, Math.max(Math.abs(dx), Math.abs(dy)) != 2 && Math.max(Math.abs(dx), Math.abs(dy)) != 4); } };
    finder(3, 3); finder(size - 4, 3); finder(3, size - 4);
    if (ver > 1) {
        const na = Math.floor(ver / 7) + 2, step = Math.ceil((ver * 4 + 4) / (na * 2 - 2)) * 2, pos = [6];
        for (let p = size - 7; pos.length < na; p -= step) pos.splice(1, 0, p);
        pos.forEach((cy, i) => pos.forEach((cx, j) => { if ((i == 0 && j == 0) || (i == 0 && j == na - 1) || (i == na - 1 && j == 0)) return; for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) set(cx + dx, cy + dy, Math.max(Math.abs(dx), Math.abs(dy)) != 1); }));
    }
    const fmt = mask => {
        const d = mask; let r = d; for (let i = 0; i < 10; i++) r = (r << 1) ^ ((r >>> 9) * 0x537);
        const b = ((d << 10) | r) ^ 0x5412, bit = i => ((b >>> i) & 1) != 0;
        for (let i = 0; i <= 5; i++) set(8, i, bit(i)); set(8, 7, bit(6)); set(8, 8, bit(7)); set(7, 8, bit(8)); for (let i = 9; i < 15; i++) set(14 - i, 8, bit(i));
        for (let i = 0; i < 8; i++) set(size - 1 - i, 8, bit(i)); for (let i = 8; i < 15; i++) set(8, size - 15 + i, bit(i)); set(8, size - 8, true);
    };
    fmt(0);
    if (ver >= 7) { let r = ver; for (let i = 0; i < 12; i++) r = (r << 1) ^ ((r >>> 11) * 0x1F25); const b = (ver << 12) | r; for (let i = 0; i < 18; i++) { const a = size - 11 + i % 3, c = Math.floor(i / 3), v = ((b >>> i) & 1) != 0; set(a, c, v); set(c, a, v); } }
    let i = 0;
    for (let right = size - 1; right >= 1; right -= 2) { if (right == 6) right = 5; for (let vert = 0; vert < size; vert++) for (let j = 0; j < 2; j++) { const x = right - j, y = ((right + 1) & 2) == 0 ? size - 1 - vert : vert; if (!fn[y][x] && i < fin.length * 8) { m[y][x] = ((fin[i >>> 3] >>> (7 - (i & 7))) & 1) != 0; i++; } } }
    const mk = [(x, y) => (x + y) % 2 == 0, (x, y) => y % 2 == 0, (x, y) => x % 3 == 0, (x, y) => (x + y) % 3 == 0, (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 == 0, (x, y) => x * y % 2 + x * y % 3 == 0, (x, y) => (x * y % 2 + x * y % 3) % 2 == 0, (x, y) => ((x + y) % 2 + x * y % 3) % 2 == 0];
    const apply = k => { for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (!fn[y][x] && mk[k](x, y)) m[y][x] = !m[y][x]; };
    const pen = () => {
        let p = 0;
        for (let t = 0; t < 2; t++) for (let a = 0; a < size; a++) { let run = 1; for (let b = 1; b < size; b++) { const c = t ? m[b][a] : m[a][b], pv = t ? m[b - 1][a] : m[a][b - 1]; if (c == pv) { run++; if (run == 5) p += 3; else if (run > 5) p++; } else run = 1; } }
        for (let y = 0; y < size - 1; y++) for (let x = 0; x < size - 1; x++) if (m[y][x] == m[y][x + 1] && m[y][x] == m[y + 1][x] && m[y][x] == m[y + 1][x + 1]) p += 3;
        let dark = 0; m.forEach(r => r.forEach(v => { if (v) dark++; })); p += Math.floor(Math.abs(dark * 20 - size * size * 10) / (size * size)) * 10; return p;
    };
    let best = 0, bp = 1e9;
    for (let k = 0; k < 8; k++) { apply(k); fmt(k); const p = pen(); if (p < bp) { bp = p; best = k; } apply(k); }
    apply(best); fmt(best);
    return m;
}
function qrCanvas(text, px) {
    const m = qrMake(text); if (!m) return null; const q = 4, n = m.length + q * 2, s = Math.max(2, Math.floor((px || 320) / n));
    const c = document.createElement('canvas'); c.width = c.height = n * s; const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.fillStyle = '#000';
    m.forEach((r, y) => r.forEach((v, x) => { if (v) g.fillRect((x + q) * s, (y + q) * s, s, s); })); return c;
}
function bpQrShow() { const c = qrCanvas(bpLink(), 640), box = document.getElementById('bp-qr'); if (!box) return; if (!c) { box.textContent = 'الرابط طويل أوي على الباركود'; return; } c.style.cssText = 'width:200px;height:200px;border-radius:12px;background:#fff'; box.innerHTML = ''; box.appendChild(c); }
function bpQrSave() { const c = qrCanvas(bpLink(), 1000); if (!c) return; const a = document.createElement('a'); a.download = 'باركود-الحجز.png'; a.href = c.toDataURL('image/png'); document.body.appendChild(a); a.click(); a.remove(); }
function bpQrPrint() {
    const c = qrCanvas(bpLink(), 1000); if (!c) return; const nm = (typeof appState !== 'undefined' && appState.settings && (appState.settings.salonName || appState.settings.name)) || 'TOMMY BARBER';
    const w = window.open('', '_blank'); if (!w) { showToast('اسمح بالنوافذ المنبثقة عشان الطباعة'); return; }
    w.document.write(`<html dir="rtl"><head><meta charset="utf-8"><title>باركود الحجز</title><style>body{font-family:Tahoma,Arial;text-align:center;padding:40px}h1{font-size:34px;margin:0}h2{font-size:22px;font-weight:normal}img{width:380px;height:380px;margin:20px 0}p{direction:ltr;font-size:14px;color:#555}</style></head><body><h1>${esc(nm)}</h1><h2>احجز ميعادك أونلاين - امسح الباركود</h2><img src="${c.toDataURL('image/png')}"><p>${esc(bpLink())}</p><script>onload=()=>setTimeout(()=>print(),300)<\/script></body></html>`); w.document.close();
}
