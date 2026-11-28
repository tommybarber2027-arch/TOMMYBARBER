        // ===================== EXTRAS: الشريط السفلي + تنبيهات الحجوزات =====================
        // appState.footBar = {enabled,speed:'slow'|'normal'|'fast',items:[...],contactOn,contactLabel,contactPhone}
        // appState.alerts  = {enabled,onOpen,hourBefore,lead}
        const FOOT_DEFAULT = { enabled: false, speed: 'normal', contactOn: false, contactLabel: 'للتواصل مع المهندس', contactPhone: '01000746687', items: [] };
        const fbCfg = () => { if (!appState.footV2) { appState.footV2 = true; appState.footBar = JSON.parse(JSON.stringify(FOOT_DEFAULT)); } const c = appState.footBar = appState.footBar || JSON.parse(JSON.stringify(FOOT_DEFAULT)); c.items = c.items || []; return c; };
        const alCfg = () => (appState.alerts = appState.alerts || { enabled: true, onOpen: true, hourBefore: true, lead: 60 });
        let fbIdx = 0, fbAnim = null, fbLast = '';
        const FB_SPEED = { slow: 38, normal: 70, fast: 120 };
        function renderFootBar(force) {
            const bar = document.getElementById('foot-bar'); if (!bar) return;
            const c = fbCfg(), sig = JSON.stringify([c.enabled, c.speed, c.contactOn, c.contactLabel, c.contactPhone, c.items]);
            if (!force && sig === fbLast) return; fbLast = sig;
            if (fbAnim) { try { fbAnim.cancel(); } catch (e) { } fbAnim = null; }
            document.documentElement.classList.toggle('has-foot', !!c.enabled);
            if (!c.enabled) { bar.classList.add('hidden'); return; }
            bar.classList.remove('hidden');
            const phone = String(c.contactPhone || '').trim();
            bar.innerHTML = (c.contactOn && phone ? `<div class="fb-contact"><span>${esc(c.contactLabel || 'للتواصل')}</span><a href="tel:${esc(phone)}" dir="ltr">${esc(phone)}</a></div>` : '') + `<div class="fb-track"><span id="fb-text"></span></div>`;
            fbIdx = 0; fbNext();
        }
        function fbNext() {
            const c = fbCfg(), el = document.getElementById('fb-text'), tr = el && el.parentElement; if (!el || !c.enabled) return;
            const items = (c.items || []).filter(x => String(x).trim()); if (!items.length) { el.textContent = ''; return; }
            el.textContent = items[fbIdx % items.length]; fbIdx++;
            const w = el.offsetWidth, tw = tr.clientWidth, pps = FB_SPEED[c.speed] || 70;
            if (fbAnim) { try { fbAnim.cancel(); } catch (e) { } }
            fbAnim = el.animate([{ transform: `translateX(${tw}px)` }, { transform: `translateX(${-w}px)` }], { duration: Math.max(3000, (w + tw) / pps * 1000), easing: 'linear' });
            fbAnim.onfinish = fbNext;
        }
        function fbSet(k, v) { fbCfg()[k] = v; saveState(); renderFootBar(); }
        function fbItem(i, v) { fbCfg().items[i] = v; saveState(); renderFootBar(); }
        function fbDel(i) { fbCfg().items.splice(i, 1); saveState(); renderFootBar(); renderExtrasSettings(); }
        function fbAdd() { const e = document.getElementById('fb-new'), v = e.value.trim(); if (!v) return; fbCfg().items.push(v); saveState(); renderFootBar(); renderExtrasSettings(); }
        function fbReset() { askConfirm('ترجّع الأذكار والإعدادات الافتراضية للشريط؟', () => { appState.footBar = JSON.parse(JSON.stringify(FOOT_DEFAULT)); saveState(); renderFootBar(true); renderExtrasSettings(); }, 'رجّع'); }
        function alSet(k, v) { alCfg()[k] = v; saveState(); }
        function renderExtrasSettings() {
            const root = document.getElementById('set-p-extras'); if (!root) return;
            if (!currentUser?.permissions?.settings) { root.innerHTML = ''; return; }
            const c = fbCfg(), a = alCfg(), inp = 'w-full bg-darkbg border border-bordergold rounded-xl px-3 py-2 text-white', card = 'bg-panelbg border border-bordergold rounded-2xl p-4 space-y-3 text-xs', chk = (on, fn, txt) => `<label class="flex items-center gap-2 text-gray-100"><input type="checkbox" ${on ? 'checked' : ''} onchange="${fn}" class="accent-gold w-4 h-4"> ${txt}</label>`;
            root.innerHTML = `<div class="space-y-3 max-w-2xl">
              <div class="${card}"><h3 class="text-sm font-black text-gold">الشريط السفلي</h3>${chk(c.enabled, "fbSet('enabled',this.checked)", 'تشغيل الشريط')}
                <div class="grid grid-cols-2 gap-2"><div><label class="block text-gray-400 mb-1">سرعة الحركة</label><select onchange="fbSet('speed',this.value)" class="${inp}"><option value="slow" ${c.speed === 'slow' ? 'selected' : ''}>بطيئة</option><option value="normal" ${c.speed === 'normal' ? 'selected' : ''}>متوسطة</option><option value="fast" ${c.speed === 'fast' ? 'selected' : ''}>سريعة</option></select></div></div>
                ${chk(c.contactOn, "fbSet('contactOn',this.checked)", 'إظهار رقم التواصل ثابت في الشريط')}
                <div class="grid grid-cols-2 gap-2"><input value="${esc(c.contactLabel)}" onchange="fbSet('contactLabel',this.value.trim())" placeholder="عنوان (مثلاً: للتواصل مع المهندس)" class="${inp}"><input dir="ltr" value="${esc(c.contactPhone)}" onchange="fbSet('contactPhone',this.value.trim())" placeholder="رقم التواصل" class="${inp}"></div>
                <div class="space-y-2"><b class="text-white">الجمل المتحركة (بتتبدل واحدة واحدة)</b>${c.items.map((t, i) => `<div class="flex gap-2"><input value="${esc(t)}" onchange="fbItem(${i},this.value.trim())" class="${inp}"><button onclick="fbDel(${i})" class="px-3 rounded-xl border border-red-800 text-red-300 font-black">حذف</button></div>`).join('') || '<p class="text-gray-500">مفيش جمل. الشريط هيعرض رقم التواصل بس.</p>'}
                  <div class="flex gap-2"><input id="fb-new" placeholder="اكتب جملة جديدة..." class="${inp}"><button onclick="fbAdd()" class="px-4 bg-gold text-black font-black rounded-xl">إضافة</button></div></div>
                <button onclick="fbReset()" class="w-full bg-darkbg border border-bordergold text-gray-300 font-bold py-2 rounded-xl">رجّع الافتراضي</button></div>
              <div class="${card}"><h3 class="text-sm font-black text-gold">تنبيهات الحجوزات</h3>${chk(a.enabled, "alSet('enabled',this.checked)", 'تشغيل التنبيهات')}${chk(a.onOpen, "alSet('onOpen',this.checked)", 'تنبيه حجوزات النهارده أول ما أفتح البرنامج')}${chk(a.hourBefore, "alSet('hourBefore',this.checked)", 'تنبيه قبل كل ميعاد')}
                <div><label class="block text-gray-400 mb-1">قبل الميعاد بـ (دقيقة)</label><input type="number" min="5" max="240" value="${a.lead}" onchange="alSet('lead',Number(this.value)||60)" class="${inp}" style="max-width:120px"></div>
                <p class="text-gray-500 leading-relaxed">التنبيهات بتشتغل طول ما البرنامج مفتوح على الجهاز ومسجّل دخول بمستخدم عنده صلاحية الحجوزات.</p></div></div>`;
        }
        // ---------- تنبيهات الحجوزات ----------
        function bkStartMs(b) { const [h, m] = String(b.time || '12:00').split(':').map(Number), d = new Date(b.date + 'T00:00:00'); d.setHours(h, m, 0, 0); if (h < 12) d.setDate(d.getDate() + 1); return d.getTime(); }
        const alToday = () => (appState.bookings || []).filter(b => bkActive(b) && b.date === getTodayISO()).sort((a, b) => bkStartMs(a) - bkStartMs(b));
        function alCard(html, id) {
            let st = document.getElementById('al-stack'); if (!st) { st = document.createElement('div'); st.id = 'al-stack'; document.body.appendChild(st); }
            const d = document.createElement('div'); d.className = 'al-card'; if (id) d.dataset.id = id;
            d.innerHTML = `<button class="al-x" aria-label="إغلاق">×</button>${html}`; d.querySelector('.al-x').onclick = () => d.remove(); st.appendChild(d);
        }
        function alBeep() { try { const C = window.AudioContext || window.webkitAudioContext, x = new C(), o = x.createOscillator(), g = x.createGain(); o.connect(g); g.connect(x.destination); o.frequency.value = 880; g.gain.value = .08; o.start(); setTimeout(() => { o.stop(); x.close(); }, 350); } catch (e) { } }
        function alOnLogin() {
            const a = alCfg(); if (!a.enabled || !a.onOpen || !currentUser?.permissions?.bookings) return;
            const list = alToday(); if (!list.length) return;
            alCard(`<b class="text-gold">حجوزات النهارده (${list.length})</b>` + list.map(b => `<div class="al-row"><b>${esc(b.clientName)}</b> • ${bkTime12(b.time)} • ${esc(b.barberName || '-')}${b.status === 'انتظار' ? ' <span class="text-amber-300">(انتظار)</span>' : ''}</div>`).join(''), 'today');
        }
        function alTick() {
            const a = alCfg(); if (!a.enabled || !a.hourBefore || !currentUser?.permissions?.bookings) return;
            let seen = {}; try { seen = JSON.parse(localStorage.getItem('tb_alerted') || '{}'); } catch (e) { }
            const now = Date.now(), lead = Number(a.lead) || 60; let ch = false;
            alToday().forEach(b => {
                const k = b.id + '|' + b.date + '|' + b.time, mins = (bkStartMs(b) - now) / 60000;
                if (mins <= lead && mins > -15 && !seen[k]) {
                    seen[k] = now; ch = true;
                    const txt = mins >= 2 ? `ميعاده كمان ${Math.round(mins) >= 55 && lead === 60 ? 'ساعة' : Math.round(mins) + ' دقيقة'}` : 'ميعاده دلوقتي';
                    alCard(`<b class="text-gold">تنبيه حجز</b><div class="al-row">العميل <b>${esc(b.clientName)}</b> ${txt} مع الحلاق <b>${esc(b.barberName || '-')}</b> (${bkTime12(b.time)})</div>`, k); alBeep();
                }
            });
            if (ch) { Object.keys(seen).forEach(k => { if (now - seen[k] > 2 * 864e5) delete seen[k]; }); try { localStorage.setItem('tb_alerted', JSON.stringify(seen)); } catch (e) { } }
        }
        setInterval(() => { try { alTick(); } catch (e) { } }, 30000);
