        // ===================== AR/EN NAMES (staff & users) =====================
        const hasAr = s => /[\u0600-\u06FF]/.test(s || '');
        const _nz = w => String(w || '').replace(/[\u064B-\u065F\u0640]/g, '').replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه');
        const _ND = {};
        ('محمد:Mohamed,احمد:Ahmed,محمود:Mahmoud,مصطفي:Mostafa,علي:Ali,عمر:Omar,يوسف:Youssef,كريم:Karim,خالد:Khaled,حسن:Hassan,حسين:Hussein,ابراهيم:Ibrahim,اسماعيل:Ismail,عبد:Abdel,عبدالله:Abdullah,عبدالرحمن:Abdelrahman,عبدالعزيز:Abdelaziz,عبدالحميد:Abdelhamid,سعيد:Said,فتحي:Fathy,زيكو:Zico,سامي:Sami,سيف:Seif,طارق:Tarek,تامر:Tamer,هاني:Hany,ياسر:Yasser,ياسين:Yassin,ادم:Adam,ماجد:Maged,مجدي:Magdy,رضا:Reda,صلاح:Salah,شريف:Sherif,وليد:Walid,ايمن:Ayman,اسامه:Osama,بلال:Bilal,حمزه:Hamza,زياد:Ziad,امير:Amir,باسم:Basem,هيثم:Haitham,وائل:Wael,نبيل:Nabil,عادل:Adel,سمير:Samir,كمال:Kamal,جمال:Gamal,مينا:Mina,بيشوي:Bishoy,مارك:Mark,جورج:George,ميخائيل:Michael,احمد:Ahmed,ابو:Abu,ام:Om,بن:Ben,الدين:Eldin,النجار:ElNaggar,المدير:Manager,مدير:Manager,كاشير:Cashier,حلاق:Barber,عامل:Worker,صنايعي:Barber,مساعد:Assistant,رمضان:Ramadan,اشرف:Ashraf,اسلام:Islam,انس:Anas,ايهاب:Ehab,بهاء:Bahaa,حازم:Hazem,حمدي:Hamdy,خليل:Khalil,دياب:Diab,ربيع:Rabie,سلطان:Sultan,سليم:Salim,سليمان:Soliman,صبري:Sabry,صالح:Saleh,طه:Taha,عصام:Essam,عماد:Emad,عيد:Eid,غنيم:Ghoneim,فادي:Fady,سعد:Saad,فهمي:Fahmy,قاسم:Kassem,لؤي:Louay,مؤمن:Moamen,مراد:Mourad,مرتضي:Mortada,معتز:Moataz,منصور:Mansour,مهند:Mohannad,موسي:Moussa,نادر:Nader,ناصر:Nasser,نور:Nour,هشام:Hisham,وسام:Wesam,يحيي:Yahya,يونس:Younis').split(',').forEach(p => { const i = p.indexOf(':'); _ND[p.slice(0, i)] = p.slice(i + 1); });
        const _TL = { 'ب': 'b', 'ت': 't', 'ث': 'th', 'ج': 'g', 'ح': 'h', 'خ': 'kh', 'د': 'd', 'ذ': 'z', 'ر': 'r', 'ز': 'z', 'س': 's', 'ش': 'sh', 'ص': 's', 'ض': 'd', 'ط': 't', 'ظ': 'z', 'غ': 'gh', 'ف': 'f', 'ق': 'k', 'ك': 'k', 'ل': 'l', 'م': 'm', 'ن': 'n', 'ه': 'h' };
        function _trWord(w) {
            const key = _nz(w); if (_ND[key]) return _ND[key];
            if (key.startsWith('ال') && key.length > 3 && _ND[key.slice(2)]) return 'El' + _ND[key.slice(2)];
            if (/^[^\u0600-\u06FF]+$/.test(w)) return w;
            const ch = [...String(w).replace(/[\u064B-\u065F\u0640]/g, '')], last = ch.length - 1, tk = [];
            ch.forEach((c, i) => {
                if (_TL[c] !== undefined) tk.push({ t: 'c', s: _TL[c] });
                else if (c === 'ا' || c === 'أ' || c === 'آ') tk.push({ t: 'v', s: i === 0 ? 'a' : 'a' });
                else if (c === 'إ') tk.push({ t: 'v', s: 'e' });
                else if (c === 'ع') tk.push({ t: 'v', s: 'a' });
                else if (c === 'ة' || c === 'ى') tk.push({ t: 'v', s: c === 'ة' ? 'a' : 'a' });
                else if (c === 'و') tk.push(i === 0 ? { t: 'c', s: 'w' } : { t: 'v', s: 'o' });
                else if (c === 'ي') tk.push(i === 0 ? { t: 'c', s: 'y' } : (i === last ? { t: 'v', s: 'y' } : { t: 'v', s: 'i' }));
                else if (c === 'ؤ') tk.push({ t: 'v', s: 'o' });
                else if (c === 'ئ') tk.push({ t: 'v', s: 'e' });
                else if (c === 'ء') { /* skip */ }
                else tk.push({ t: 'x', s: c });
            });
            let out = '';
            tk.forEach((x, i) => { out += x.s; if (x.t === 'c' && tk[i + 1] && tk[i + 1].t === 'c') out += 'a'; });
            return out.charAt(0).toUpperCase() + out.slice(1);
        }
        function trAr2En(str) { return String(str || '').trim().split(/\s+/).map(_trWord).join(' '); }
        function nameEntries() {
            const out = [];
            const add = (p, ar, en) => {
                p = String(p || '').trim(); if (!p) return;
                const a = String(ar || '').trim() || (hasAr(p) ? p : '');
                const e = String(en || '').trim() || (hasAr(p) ? trAr2En(p) : p);
                out.push({ keys: [p, a, e].filter(Boolean), ar: a, en: e });
            };
            (appState.barbers || []).forEach(b => add(b.name, b.nameAr, b.nameEn));
            (appState.users || []).forEach(u => add(u.displayName, u.displayNameAr, u.displayNameEn));
            return out;
        }
        window.nameEntries = () => [];
        function autoEnName() {
            const en = document.getElementById('edit-barber-name-en'); if (!en || en.dataset.manual === '1') return;
            en.value = trAr2En(document.getElementById('edit-barber-name').value);
        }
        function autoEnUser() {
            const en = document.getElementById('edit-user-display-en'); if (!en || en.dataset.manual === '1') return;
            en.value = trAr2En(document.getElementById('edit-user-display').value);
        }

        function deleteBarber(id) {
            if (!currentUser?.permissions?.barbers) { showToast('غير مصرح لك', 'error'); return; }
            const b = appState.barbers.find(x => x.id === id); if (!b) return;
            askConfirm(`حذف الموظف: ${esc(b.name)}. الفواتير القديمة هتفضل محفوظة باسمه، لكن سجل حضوره وسُلفه هيتمسحوا.`, () => {
                appState.barbers = appState.barbers.filter(x => x.id !== id);
                appState.advances = (appState.advances || []).filter(a => a.staffId !== id);
                Object.values(appState.attendanceRecords || {}).forEach(day => { if (day) delete day[id]; });
                if (selectedBarberId === id) selectedBarberId = appState.barbers.find(isPerf)?.id || null;
                logAudit(`حذف الموظف: ${b.name}`);
                saveState(); closeModal('barber-modal'); renderAll(); showToast('تم حذف الموظف');
            }, 'احذف');
        }

        function deleteUser(id) {
            if (!currentUser?.permissions?.users) { showToast('غير مصرح لك', 'error'); return; }
            const u = appState.users.find(x => x.id === id); if (!u) return;
            if (currentUser && currentUser.id === id) { showToast('مينفعش تحذف المستخدم اللي داخل بيه دلوقتي', 'error'); return; }
            if (isMgrUser(u)) { showToast('المدير مينفعش يتحذف', 'error'); return; }
            if (!isMgrUser(currentUser) && u.roleTitle === 'شريك') { showToast('حذف الشركاء للمدير العام بس', 'error'); return; }
            askConfirm(`حذف المستخدم: ${esc(u.displayName)}. الفواتير اللي عملها هتفضل محفوظة.`, () => {
                appState.users = appState.users.filter(x => x.id !== id);
                logAudit(`حذف المستخدم: ${u.displayName}`);
                saveState(); renderAll(); showToast('تم حذف المستخدم');
            }, 'احذف');
        }
