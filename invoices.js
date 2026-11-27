        // 2. INVOICES
        function setInvPeriod(period) {
            const today = new Date(Date.now() - BIZ_SHIFT);
            let from = localISO(today), to = localISO(today);
            if (period === 'yesterday') { const y = new Date(today); y.setDate(y.getDate() - 1); from = to = localISO(y); }
            else if (period === '7days') { const d7 = new Date(today); d7.setDate(d7.getDate() - 7); from = localISO(d7); }
            else if (period === '30days') { const d30 = new Date(today); d30.setDate(d30.getDate() - 30); from = localISO(d30); }
            document.getElementById('inv-date-from').value = from;
            document.getElementById('inv-date-to').value = to;
            renderInvoicesTable();
        }

        function renderInvoicesTable() {
            const from = document.getElementById('inv-date-from')?.value || '';
            const to = document.getElementById('inv-date-to')?.value || '';
            const q = (document.getElementById('inv-search-query')?.value || '').trim().toLowerCase();
            const deletedOnly = document.getElementById('show-deleted-only')?.checked;
            const canEditInv = currentUser?.permissions?.editInvoices;
            const payLabels = { cash: 'كاش', visa: 'إنستا باي', wallet: 'محفظة', instapay: 'محفظة' };

            const filtered = appState.invoices.filter(inv => {
                if (deletedOnly ? !inv.deleted : inv.deleted) return false;
                if (from && inv.date < from) return false;
                if (to && inv.date > to) return false;
                if (q) {
                    const match = String(inv.id).includes(q) || (inv.clientName || '').toLowerCase().includes(q) || (inv.clientPhone || '').includes(q) || (inv.barberName || '').toLowerCase().includes(q);
                    if (!match) return false;
                }
                return true;
            });

            document.getElementById('invoices-table-body').innerHTML = filtered.map(inv => `
                <tr class="hover:bg-white/[0.02]">
                    <td class="p-3 font-black text-white">${inv.id}</td>
                    <td class="p-3 text-gray-300 text-[11px]"><span class="font-mono">${inv.date}</span><br><span class="text-gold font-bold">${formatTime12(inv.time)}</span></td>
                    <td class="p-3 font-bold text-white">${inv.barberName}</td>
                    <td class="p-3 text-gray-200">
                        <div class="space-y-0.5">${inv.items.map(i => `<div class="flex items-center justify-between gap-2"><span>• ${i.name} ${i.qty > 1 ? `(×${i.qty})` : ''}</span><span class="text-gold/80 font-mono text-[11px]">${i.price * i.qty} ج.م</span></div>`).join('')}</div>
                        <div class="flex flex-wrap gap-2 mt-1 text-[11px] text-gray-400">
                            ${inv.clientName ? `<span>العميل: <b class="text-gray-300">${inv.clientName}</b></span>` : ''}
                            ${inv.clientPhone ? `<span dir="ltr">(${inv.clientPhone})</span>` : ''}
                            ${inv.discount > 0 ? `<span class="text-red-400">خصم: ${inv.discount} ج.م</span>` : ''}
                            ${inv.notes ? `<span class="text-gold">ملاحظة: ${inv.notes}</span>` : ''}
                        </div>
                    </td>
                    <td class="p-3 text-gray-300">${payLabels[inv.paymentMethod] || inv.paymentMethod}</td>
                    <td class="p-3 font-black text-gold">${fmt(inv.total)}</td>
                    <td class="p-3 text-gray-400">${inv.cashierName || '-'}</td>
                    <td class="p-3 text-left whitespace-nowrap space-x-1 space-x-reverse">
                        <button onclick="openThermalReceipt(${inv.id})" class="px-2.5 py-1 rounded-lg border border-bordergold text-gold hover:bg-gold hover:text-black font-bold">طباعة</button>
                        ${canEditInv ? (!inv.deleted ? `
                            <button onclick="editExistingInvoice(${inv.id})" class="px-2.5 py-1 rounded-lg border border-bordergold text-gray-300 hover:border-gold font-bold">تعديل</button>
                            <button onclick="deleteInvoice(${inv.id})" class="px-2.5 py-1 rounded-lg border border-red-900/50 bg-red-950/30 text-red-400 hover:bg-red-900/50 font-bold">حذف</button>
                        ` : `<button onclick="restoreInvoice(${inv.id})" class="px-2.5 py-1 rounded-lg border border-emerald-800 text-emerald-400 font-bold">استرجاع</button>`) : ''}
                    </td>
                </tr>
            `).join('');

            const sum = filtered.reduce((s, i) => s + i.total, 0);
            document.getElementById('invoices-count-footer').textContent = `${filtered.length} فاتورة`;
            document.getElementById('invoices-sum-footer').textContent = `الإجمالي: ${fmt(sum)} ج.م`;
        }

        function editExistingInvoice(id) {
            if (!currentUser?.permissions?.editInvoices) { showToast('ليس لديك صلاحية تعديل الفواتير', 'error'); return; }
            const inv = appState.invoices.find(i => i.id === id);
            if (!inv) return;
            editingInvoiceId = inv.id;
            selectedBarberId = inv.barberId;
            currentDraft = { items: JSON.parse(JSON.stringify(inv.items)), paymentMethod: inv.paymentMethod, discount: inv.discount || 0 };
            document.getElementById('inv-client-name').value = inv.clientName || '';
            document.getElementById('inv-client-phone').value = inv.clientPhone || '';
            document.getElementById('inv-notes').value = inv.notes || '';
            switchTab('pos');
            renderPOS();
        }

        function deleteInvoice(id) {
            if (!currentUser?.permissions?.editInvoices) { showToast('ليس لديك صلاحية حذف الفواتير', 'error'); return; }
            const inv = appState.invoices.find(i => i.id === id);
            if (!inv) return;
            inv.deleted = true; logAudit(`حذف الفاتورة رقم ${id}`); saveState(); renderAll(); showToast(`تم حذف الفاتورة ${id}`);
        }

        function restoreInvoice(id) {
            const inv = appState.invoices.find(i => i.id === id);
            if (!inv) return;
            inv.deleted = false; logAudit(`استرجاع الفاتورة رقم ${id}`); saveState(); renderAll();
        }
