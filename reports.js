        // 3. REPORTS
        function setRepPeriod(period) {
            document.querySelectorAll('.rep-period-btn').forEach(b => b.className = 'rep-period-btn px-3 py-1.5 rounded-xl bg-darkbg border border-bordergold text-xs font-bold text-gray-300');
            const active = document.getElementById(`rep-btn-${period}`);
            if (active) active.className = 'rep-period-btn px-3 py-1.5 rounded-xl bg-gold text-black text-xs font-black';

            const today = new Date(Date.now() - BIZ_SHIFT);
            let from = '', to = localISO(today);
            if (period === 'today') from = to = localISO(today);
            else if (period === 'yesterday') { const y = new Date(today); y.setDate(y.getDate() - 1); from = to = localISO(y); }
            else if (period === '7days') { const d7 = new Date(today); d7.setDate(d7.getDate() - 7); from = localISO(d7); }
            else if (period === 'month') from = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;
            else if (period === 'lastmonth') { from = localISO(new Date(today.getFullYear(), today.getMonth() - 1, 1)); to = localISO(new Date(today.getFullYear(), today.getMonth(), 0)); }
            else if (period === 'all') { from = ''; to = ''; }

            const fromEl = document.getElementById('rep-date-from'), toEl = document.getElementById('rep-date-to');
            if (fromEl) fromEl.value = from;
            if (toEl) toEl.value = to;
            renderReports();
        }

        function getFilteredReportInvoices() {
            const from = document.getElementById('rep-date-from')?.value || '';
            const to = document.getElementById('rep-date-to')?.value || '';
            return appState.invoices.filter(inv => !inv.deleted && (!from || inv.date >= from) && (!to || inv.date <= to));
        }

        function renderReports() {
            const invs = getFilteredReportInvoices();
            const totalSales = invs.reduce((s, i) => s + Number(i.total || 0), 0);
            const totalDisc = invs.reduce((s, i) => s + Number(i.discount || 0), 0);
            const avg = invs.length > 0 ? (totalSales / invs.length) : 0;

            document.getElementById('rep-kpi-sales').textContent = fmt(totalSales);
            document.getElementById('rep-kpi-count').textContent = fmt(invs.length);
            document.getElementById('rep-kpi-avg').textContent = fmt(avg);
            document.getElementById('rep-kpi-disc').textContent = fmt(totalDisc);

            const barberRows = appState.barbers.filter(isPerf).map(b => {
                const calc = calculateStaffPayroll(b, invs);
                return { name: b.name, count: calc.invCount, sales: calc.totalSales, comm: calc.totalComm, pct: b.commissionPct, payType: b.payType };
            }).sort((a, b) => b.sales - a.sales);
            const maxBarberSales = Math.max(1, ...barberRows.map(r => r.sales));

            document.getElementById('rep-by-barber').innerHTML = barberRows.map(r => {
                const barW = Math.round((r.sales / maxBarberSales) * 100);
                const subLabel = r.payType === 'salary' ? 'راتب ثابت' : `(${r.pct || 0}%)`;
                return `
                    <div class="py-2.5 grid grid-cols-12 items-center gap-1">
                        <span class="col-span-3 font-bold text-white truncate">${r.name}</span>
                        <span class="col-span-2 text-center text-gray-300">${r.count}</span>
                        <span class="col-span-3 text-center font-black text-gold">${fmt(r.sales)}</span>
                        <div class="col-span-4 flex items-center justify-end gap-2">
                            <div class="text-left leading-tight"><span class="font-bold text-white block">${fmt(r.comm)}</span><span class="text-[10px] text-gray-400">${subLabel}</span></div>
                            <div class="w-10 h-2 bg-darkbg rounded-full overflow-hidden shrink-0"><div class="h-full bg-gold rounded-full" style="width:${barW}%"></div></div>
                        </div>
                    </div>
                `;
            }).join('');

            const catMap = {};
            invs.forEach(inv => inv.items.forEach(it => {
                if (!catMap[it.category]) catMap[it.category] = { qty: 0, sales: 0 };
                catMap[it.category].qty += it.qty;
                catMap[it.category].sales += it.price * it.qty * invFactor(inv);
            }));
            const catRows = appState.categories.map(c => ({ name: c.name, qty: catMap[c.id]?.qty || 0, sales: catMap[c.id]?.sales || 0 })).filter(r => r.sales > 0).sort((a, b) => b.sales - a.sales);
            const maxCatSales = Math.max(1, ...catRows.map(r => r.sales));
            document.getElementById('rep-by-category').innerHTML = catRows.length === 0 ? `<p class="text-gray-500 py-6 text-center">لا توجد مبيعات</p>` : catRows.map(r => `
                <div class="py-2.5 grid grid-cols-12 items-center gap-1">
                    <span class="col-span-5 font-bold text-white truncate">${r.name}</span>
                    <span class="col-span-2 text-center text-gray-300">${r.qty}</span>
                    <div class="col-span-5 flex items-center justify-end gap-2">
                        <span class="font-black text-gold">${fmt(r.sales)}</span>
                        <div class="w-12 h-2 bg-darkbg rounded-full overflow-hidden shrink-0"><div class="h-full bg-gold rounded-full" style="width:${Math.round((r.sales / maxCatSales) * 100)}%"></div></div>
                    </div>
                </div>
            `).join('');

            const srvMap = {};
            invs.forEach(inv => inv.items.forEach(it => {
                if (!srvMap[it.name]) srvMap[it.name] = { qty: 0, sales: 0 };
                srvMap[it.name].qty += it.qty;
                srvMap[it.name].sales += it.price * it.qty * invFactor(inv);
            }));
            const srvRows = Object.entries(srvMap).map(([name, d]) => ({ name, ...d })).sort((a, b) => b.sales - a.sales).slice(0, 7);
            const maxSrvSales = Math.max(1, ...srvRows.map(r => r.sales));
            document.getElementById('rep-top-services').innerHTML = srvRows.length === 0 ? `<p class="text-gray-500 py-6 text-center">لا توجد بيانات</p>` : srvRows.map(r => `
                <div class="py-2.5 grid grid-cols-12 items-center gap-1">
                    <span class="col-span-6 font-bold text-white truncate">${r.name}</span>
                    <span class="col-span-2 text-center text-gray-300">${r.qty}</span>
                    <div class="col-span-4 flex items-center justify-end gap-2">
                        <span class="font-black text-gold">${fmt(r.sales)}</span>
                        <div class="w-10 h-2 bg-darkbg rounded-full overflow-hidden shrink-0"><div class="h-full bg-gold rounded-full" style="width:${Math.round((r.sales / maxSrvSales) * 100)}%"></div></div>
                    </div>
                </div>
            `).join('');

            const payLabels = { cash: 'كاش', visa: 'إنستا باي', wallet: 'محفظة' };
            const payRows = ['cash', 'visa', 'wallet'].map(m => {
                const sub = invs.filter(i => i.paymentMethod === m || (m === 'wallet' && i.paymentMethod === 'instapay'));
                return { name: payLabels[m], count: sub.length, sales: sub.reduce((s, i) => s + i.total, 0) };
            });
            const maxPay = Math.max(1, ...payRows.map(r => r.sales));
            document.getElementById('rep-by-payment').innerHTML = payRows.map(r => `
                <div class="py-2.5 grid grid-cols-12 items-center gap-1">
                    <span class="col-span-4 font-bold text-white">${r.name}</span>
                    <span class="col-span-3 text-center text-gray-300">${r.count}</span>
                    <div class="col-span-5 flex items-center justify-end gap-2">
                        <span class="font-black text-gold">${fmt(r.sales)}</span>
                        <div class="w-12 h-2 bg-darkbg rounded-full overflow-hidden shrink-0"><div class="h-full bg-gold rounded-full" style="width:${Math.round((r.sales / maxPay) * 100)}%"></div></div>
                    </div>
                </div>
            `).join('');

            const cashMap = {};
            invs.forEach(i => { const k = i.cashierName || 'omar'; if (!cashMap[k]) cashMap[k] = { count: 0, sales: 0 }; cashMap[k].count++; cashMap[k].sales += i.total; });
            const cashRows = Object.entries(cashMap).map(([name, d]) => ({ name, ...d })).sort((a, b) => b.sales - a.sales);
            const maxCash = Math.max(1, ...cashRows.map(r => r.sales));
            document.getElementById('rep-by-cashier').innerHTML = cashRows.map(r => `
                <div class="py-2.5 grid grid-cols-12 items-center gap-1">
                    <span class="col-span-4 font-bold text-white">${r.name}</span>
                    <span class="col-span-3 text-center text-gray-300">${r.count}</span>
                    <div class="col-span-5 flex items-center justify-end gap-2">
                        <span class="font-black text-gold">${fmt(r.sales)}</span>
                        <div class="w-12 h-2 bg-darkbg rounded-full overflow-hidden shrink-0"><div class="h-full bg-gold rounded-full" style="width:${Math.round((r.sales / maxCash) * 100)}%"></div></div>
                    </div>
                </div>
            `).join('');

            const dayMap = {};
            invs.forEach(i => { if (!dayMap[i.date]) dayMap[i.date] = { count: 0, sales: 0 }; dayMap[i.date].count++; dayMap[i.date].sales += i.total; });
            const dayRows = Object.entries(dayMap).map(([date, d]) => ({ date, ...d })).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 7);
            const maxDay = Math.max(1, ...dayRows.map(r => r.sales));
            document.getElementById('rep-daily-sales').innerHTML = dayRows.map(r => `
                <div class="py-2.5 grid grid-cols-12 items-center gap-1">
                    <span class="col-span-4 font-mono text-white text-[11px]">${r.date}</span>
                    <span class="col-span-3 text-center text-gray-300">${r.count}</span>
                    <div class="col-span-5 flex items-center justify-end gap-2">
                        <span class="font-black text-gold">${fmt(r.sales)}</span>
                        <div class="w-12 h-2 bg-darkbg rounded-full overflow-hidden shrink-0"><div class="h-full bg-gold rounded-full" style="width:${Math.round((r.sales / maxDay) * 100)}%"></div></div>
                    </div>
                </div>
            `).join('');
        }

        function exportReportsCSV() {
            const invs = getFilteredReportInvoices();
            let csv = '\uFEFFرقم الفاتورة,التاريخ,الوقت,الحلاق,العميل,الدفع,الإجمالي,الكاشير\n';
            invs.forEach(i => { csv += `${i.id},${i.date},${i.time},"${i.barberName}","${i.clientName || ''}",${i.paymentMethod},${i.total},"${i.cashierName || ''}"\n`; });
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a'); a.href = url; a.download = `TOMMY_BARBER_Reports_${getTodayISO()}.csv`; a.click(); URL.revokeObjectURL(url);
        }
