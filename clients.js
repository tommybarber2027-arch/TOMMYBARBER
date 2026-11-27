        // 2.5 CLIENTS
        function openClientModal(phoneToEdit = null) {
            if (phoneToEdit) {
                const existing = (appState.clients || []).find(c => c.phone === phoneToEdit);
                const invMatch = appState.invoices.find(i => i.clientPhone === phoneToEdit);
                document.getElementById('client-modal-title').textContent = 'تعديل بيانات العميل';
                document.getElementById('edit-client-old-phone').value = phoneToEdit;
                document.getElementById('new-client-name').value = existing ? existing.name : (invMatch?.clientName || '');
                document.getElementById('new-client-phone').value = phoneToEdit;
            } else {
                document.getElementById('client-modal-title').textContent = 'تسجيل عميل جديد';
                document.getElementById('edit-client-old-phone').value = '';
                document.getElementById('new-client-name').value = '';
                document.getElementById('new-client-phone').value = '';
            }
            document.getElementById('client-modal').classList.remove('hidden');
        }

        function saveNewClient(e) {
            e.preventDefault();
            const oldPhone = document.getElementById('edit-client-old-phone').value.trim();
            const name = document.getElementById('new-client-name').value.trim();
            const phone = document.getElementById('new-client-phone').value.trim();
            if (!name || !phone) { showToast('يجب إدخال اسم العميل ورقم التليفون معاً', 'error'); return; }
            if (!appState.clients) appState.clients = [];
            const duplicatePhone = appState.clients.find(c => c.phone === phone && c.phone !== oldPhone);
            if (duplicatePhone) { showToast(`هذا الرقم مسجل مسبقاً باسم العميل: ${duplicatePhone.name}`, 'error'); return; }

            if (oldPhone) {
                const target = appState.clients.find(c => c.phone === oldPhone);
                if (target) { target.name = name; target.phone = phone; }
                else appState.clients.unshift({ id: 'c-' + Date.now(), name, phone, createdAt: getTodayISO() });
                appState.invoices.forEach(inv => { if (inv.clientPhone === oldPhone) { inv.clientName = name; inv.clientPhone = phone; } });
                logAudit(`تعديل بيانات العميل: ${name} (${phone})`);
            } else {
                appState.clients.unshift({ id: 'c-' + Date.now(), name, phone, createdAt: getTodayISO() });
                logAudit(`تسجيل عميل جديد: ${name} (${phone})`);
            }
            saveState(); closeModal('client-modal'); renderAll(); showToast('تم حفظ بيانات العميل بنجاح');
        }

        function deleteClient(phone) {
            appState.clients = (appState.clients || []).filter(c => c.phone !== phone);
            appState.invoices.forEach(inv => { if (inv.clientPhone === phone) { inv.clientPhone = ''; inv.clientName = ''; } });
            logAudit(`حذف العميل صاحب الرقم: ${phone}`); saveState(); renderAll(); showToast('تم حذف العميل');
        }

        function startInvoiceForClient(name, phone) {
            switchTab('pos');
            const det = document.getElementById('inv-client-details');
            if (det) det.open = true;
            document.getElementById('inv-client-name').value = name;
            document.getElementById('inv-client-phone').value = phone;
            lookupClientByPhone(phone);
        }

        function renderClientsTable() {
            const tbody = document.getElementById('clients-table-body');
            if (!tbody) return;
            const q = (document.getElementById('clients-search-input')?.value || '').trim().toLowerCase();
            const activeInvs = appState.invoices.filter(i => !i.deleted);
            const clientMap = new Map();
            (appState.clients || []).forEach(c => clientMap.set(c.phone, { name: c.name, phone: c.phone, visits: 0, spent: 0, lastVisit: c.createdAt || '-' }));
            activeInvs.forEach(inv => {
                if (inv.clientPhone) {
                    const existing = clientMap.get(inv.clientPhone) || { name: inv.clientName || 'عميل', phone: inv.clientPhone, visits: 0, spent: 0, lastVisit: inv.date };
                    existing.visits += 1; existing.spent += Number(inv.total || 0);
                    if (inv.date > existing.lastVisit || existing.lastVisit === '-') existing.lastVisit = inv.date;
                    clientMap.set(inv.clientPhone, existing);
                }
            });
            const list = Array.from(clientMap.values()).filter(c => !q || c.name.toLowerCase().includes(q) || c.phone.includes(q));
            tbody.innerHTML = list.length === 0
                ? `<tr><td colspan="6" class="p-6 text-center text-gray-500">لا يوجد عملاء مسجلين مطابقين للبحث</td></tr>`
                : list.map(c => `
                    <tr class="hover:bg-white/[0.02]">
                        <td class="p-3 font-black text-white">${c.name}</td>
                        <td class="p-3 font-mono text-gold" dir="ltr">${c.phone}</td>
                        <td class="p-3 text-center font-bold text-emerald-400">${c.visits} زيارة</td>
                        <td class="p-3 text-center font-black text-white">${fmt(c.spent)} ج.م</td>
                        <td class="p-3 text-center font-mono text-gray-400">${c.lastVisit}</td>
                        <td class="p-3 text-left whitespace-nowrap space-x-1 space-x-reverse">
                            <button data-n="${esc(c.name)}" data-p="${esc(c.phone)}" onclick="startInvoiceForClient(this.dataset.n, this.dataset.p)" class="px-2.5 py-1 rounded-lg bg-gold text-black font-black hover:bg-goldhover transition">فاتورة</button>
                            <button onclick="openClientModal('${c.phone}')" class="px-2.5 py-1 rounded-lg border border-bordergold text-gray-300 hover:border-gold font-bold">تعديل</button>
                            <button onclick="deleteClient('${c.phone}')" class="px-2.5 py-1 rounded-lg border border-red-900/50 bg-red-950/30 text-red-400 hover:bg-red-900/50 font-bold">حذف</button>
                        </td>
                    </tr>
                `).join('');
        }
