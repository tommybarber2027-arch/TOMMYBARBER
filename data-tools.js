        // ===================== SETTINGS SECTIONS =====================
        let setPanel = 'general';
        function showSettingsPanel(id) {
            setPanel = id;
            document.querySelectorAll('#view-settings .set-panel').forEach(p => p.classList.toggle('hidden', p.id !== 'set-p-' + id));
            document.querySelectorAll('#set-pills .set-pill').forEach(b => b.classList.toggle('on', b.getAttribute('data-sp') === id));
            if (id === 'invoice') updateInvPreview();
            if (id === 'booking') renderBookingSettings();
            if (id === 'extras') renderExtrasSettings();
        }

        function confirmDanger(msg, fn, okText) {
            askBox('تأكيد الحذف', `<p class="text-gray-200 leading-relaxed">${msg}</p><input id="danger-in" autocomplete="off" placeholder="اكتب كلمة حذف للتأكيد" class="w-full bg-darkbg border border-red-700 rounded-xl px-3 py-2 text-white">`, d => {
                const v = d.querySelector('#danger-in').value.trim().toLowerCase();
                if (v !== 'حذف' && v !== 'delete') { showToast('اكتب كلمة حذف للتأكيد', 'error'); return false; }
                fn();
            }, okText || 'احذف');
        }
        const WIPE = {
            invoices: { t: 'مسح كل الفواتير', m: 'هيتم مسح كل الفواتير، وترقيم الفواتير الجاية هيبدأ من 1. العملاء والموظفين والخدمات هيفضلوا زي ما هم.', f: () => { appState.invoices = []; appState.lastInvId = 0; } },
            attendance: { t: 'مسح سجل الحضور والانصراف', m: 'هيتم مسح سجل الحضور والانصراف لكل الموظفين.', f: () => { appState.attendanceRecords = {}; } },
            advances: { t: 'مسح السُلف والخصومات', m: 'هيتم مسح السُلف والخصومات وحركات المصاريف المرتبطة بيها.', f: () => { appState.advances = []; appState.expenses = (appState.expenses || []).filter(e => !e.advId); } },
            expenses: { t: 'مسح المصاريف', m: 'هيتم مسح كل حركات المصاريف.', f: () => { appState.expenses = []; } },
            clients: { t: 'مسح قاعدة العملاء', m: 'هيتم مسح كل العملاء (الأسماء والأرقام). الفواتير القديمة مش هتتأثر.', f: () => { appState.clients = []; } },
            staff: { t: 'حذف كل الموظفين', m: 'هيتم حذف كل الموظفين مع سجل حضورهم وسُلفهم. الفواتير القديمة هتفضل محفوظة بأسمائهم.', f: () => { appState.barbers = []; appState.advances = []; appState.attendanceRecords = {}; selectedBarberId = null; } },
            audit: { t: 'مسح سجل المراجعة', m: 'هيتم مسح سجل المراجعة والأمان.', f: () => { appState.auditLogs = []; } }
        };
        function wipeData(kind) {
            if (!currentUser?.permissions?.settings) { showToast('غير مصرح لك بتنفيذ هذه العملية', 'error'); return; }
            const w = WIPE[kind]; if (!w) return;
            confirmDanger(w.m, () => {
                w.f(); logAudit(w.t); saveState(); resetCurrentInvoice(); renderAll(); showToast('تم تنفيذ العملية بنجاح');
            });
        }
        function factoryReset() {
            if (!currentUser?.permissions?.settings) { showToast('غير مصرح لك بتنفيذ هذه العملية', 'error'); return; }
            confirmDanger('هيتم مسح كل شيء وإرجاع البرنامج لحالته الأولى. حساب المدير وكلمة مروره وكود الاسترجاع بيفضلوا زي ما هم.', () => {
                const fresh = JSON.parse(JSON.stringify(defaultState));
                fresh.invoices = []; fresh.clients = []; fresh.advances = []; fresh.auditLogs = []; fresh.barbers = []; fresh.attendanceRecords = {};
                fresh.expenses = []; fresh.finExpenses = []; fresh.finAdv = []; fresh.attendanceLog = {}; fresh.shifts = []; fresh.vaultAdj = []; fresh.vaultBase = 0; fresh.bookings = []; fresh.archive = []; fresh.lastInvId = 0;
                fresh.users = appState.users.filter(isMgrUser); fresh.authVersion = 3; fresh._ts = Date.now();
                appState = fresh; migrateAuth();
                selectedBarberId = null; selectedCategoryId = appState.categories[0]?.id || 'cat_cut';
                currentUser = null; currentDraft = { items: [], paymentMethod: 'cash', discount: 0 };
                saveState(); logoutUser(); renderAll(); showToast('تم ضبط المصنع. سجّل الدخول من جديد');
            }, 'ضبط المصنع');
        }

        function toggleBarberHidden(id) {
            const b = appState.barbers.find(x => x.id === id); if (!b) return;
            b.hidden = !b.hidden; logAudit((b.hidden ? 'إخفاء الموظف: ' : 'إظهار الموظف: ') + b.name);
            saveState(); renderAll(); showToast(b.hidden ? 'تم إخفاء الموظف من الكاشير' : 'تم إظهار الموظف');
        }
        function archiveOldInvoices() { switchTab('archive'); }
        function ensureCafe() {
            if (appState.cafeAdded) return; appState.cafeAdded = true;
            if (appState.categories.some(c => c.id === 'cat_cafe')) return;
            appState.categories.push({ id: 'cat_cafe', name: 'الكافيه والمشروبات', icon: 'fa-mug-hot' });
            [['شاي', 15, 'fa-mug-hot'], ['قهوة', 30, 'fa-mug-hot'], ['نسكافيه', 30, 'fa-mug-hot'], ['ينسون', 15, 'fa-mug-hot'], ['مياه معدنية', 10, 'fa-bottle-water'], ['مشروب غازي', 20, 'fa-bottle-water'], ['عصير', 25, 'fa-glass-water']]
                .forEach((d, i) => appState.catalog.push({ id: 'cafe' + (i + 1), category: 'cat_cafe', name: d[0], price: d[1], icon: d[2] }));
            saveState();
        }
