        // ===================== INVOICE / RECEIPT SETTINGS =====================
        const DEFAULT_INV_SET = { showLogo: true, logo: 'md', showAddress: true, showPhone: true, showDateTime: true, showBarber: true, showClient: true, showCashier: false, showPayment: true, showDiscount: true, showPayNumbers: false, showNotes: false, title: '', address: '', phone: '', footer1: 'شكراً لزيارتكم', footer2: 'مع تحيات {name}', logoData: '', note: '', paper: '80', font: 'md' };
        const INV_TOG = ['showLogo', 'showAddress', 'showPhone', 'showDateTime', 'showBarber', 'showClient', 'showCashier', 'showPayment', 'showDiscount', 'showPayNumbers', 'showNotes'];
        const INV_TXT = ['title', 'address', 'phone', 'footer1', 'footer2', 'note'];
        const INV_SEL = ['paper', 'font', 'logo'];
        const getInvSettings = () => Object.assign({}, DEFAULT_INV_SET, appState.invoiceSettings || {});
        let invLogoData = '';
        function setInvForm(S) {
            invLogoData = S.logoData || '';
            INV_TOG.forEach(k => { const e = document.getElementById('inv-s-' + k); if (e) e.checked = !!S[k]; });
            INV_TXT.forEach(k => { const e = document.getElementById('inv-s-' + k); if (e) e.value = S[k] || ''; });
            INV_SEL.forEach(k => { const e = document.getElementById('inv-s-' + k); if (e) e.value = S[k]; });
        }
        function readInvForm() {
            const S = {};
            INV_TOG.forEach(k => { const e = document.getElementById('inv-s-' + k); S[k] = e ? e.checked : DEFAULT_INV_SET[k]; });
            INV_TXT.forEach(k => { const e = document.getElementById('inv-s-' + k); S[k] = e ? e.value.trim() : DEFAULT_INV_SET[k]; });
            INV_SEL.forEach(k => { const e = document.getElementById('inv-s-' + k); S[k] = e ? e.value : DEFAULT_INV_SET[k]; });
            S.logoData = invLogoData;
            return S;
        }
        function applyPaper(S) {
            const w = S.paper === '58' ? 58 : 80;
            let st = document.getElementById('page-style');
            if (!st) { st = document.createElement('style'); st.id = 'page-style'; document.head.appendChild(st); }
            st.textContent = `@page{size:${w}mm auto;margin:0}`;
            document.documentElement.style.setProperty('--rw', (w - 8) + 'mm');
        }
        function buildReceiptHtml(inv, S, ov) {
            ov = ov || {};
            const si = appState.salonInfo || {};
            const name = ((S.title || '').trim() || si.name || 'TOMMY BARBER').toUpperCase();
            const address = (S.address || '').trim() || si.address || '';
            const phone = (S.phone || '').trim() || si.phone || '';
            const payNums = ov.payNumbers != null ? ov.payNumbers : (si.paymentNumbers || '');
            const payLabels = { cash: 'كاش', visa: 'إنستا باي', wallet: 'محفظة', instapay: 'محفظة' };
            const fs = { sm: 10, md: 12, lg: 14 }[S.font] || 12;
            const lw = { sm: 14, md: 20, lg: 28 }[S.logo] || 26;
            const dash = 'border-bottom:1px dashed #000;padding-bottom:6px;margin-bottom:6px;';
            const row = (a, b, x) => `<div style="display:flex;justify-content:space-between;gap:8px;${x || ''}"><span>${a}</span><span>${b}</span></div>`;
            let h = `<div style="font-size:${fs}px;line-height:1.55;color:#000">`;
            h += `<div style="text-align:center;${dash}">`;
            if (S.showLogo && S.logoData) h += `<img src="${S.logoData}" alt="" style="display:block;margin:0 auto 4px;width:${lw}mm;height:auto">`;
            else if (S.showLogo) h += `<img src="receipt-logo.webp" alt="" style="display:block;margin:0 auto 4px;width:${lw}mm;height:auto">`;
            h += `<div class="rec-salon-name" style="font-weight:900;font-size:1.5em;line-height:1.25">${esc(name)}</div>`;
            if (S.showAddress && address) h += `<div style="font-size:.92em">${esc(address)}</div>`;
            if (S.showPhone && phone) h += `<div dir="ltr" style="font-size:.92em;font-family:monospace">${esc(phone)}</div>`;
            h += `</div><div style="${dash}font-size:.92em">`;
            h += row(`فاتورة: #<b>${esc(inv.id)}</b>`, S.showDateTime ? `${esc(inv.date)} • ${esc(formatTime12(inv.time))}` : '');
            if (S.showBarber || S.showClient) h += row(S.showBarber ? `الحلاق: <b>${esc(inv.barberName || '-')}</b>` : '', S.showClient ? `العميل: <b>${esc(inv.clientName || '-')}</b>` : '');
            if (S.showCashier && inv.cashierName) h += row(`الكاشير: <b>${esc(inv.cashierName)}</b>`, '');
            h += `</div><div style="${dash}">`;
            h += (inv.items || []).map(i => row(`${esc(i.name)} ${i.qty > 1 ? `(×${i.qty})` : ''}`, `<b>${i.price * i.qty} ج.م</b>`)).join('');
            h += `</div><div style="font-size:.92em">`;
            h += row('المجموع:', `${inv.subtotal} ج.م`);
            if (S.showDiscount) h += row('الخصم:', `${inv.discount} ج.م`);
            if (S.showPayment) h += row('طريقة الدفع:', esc(payLabels[inv.paymentMethod] || inv.paymentMethod));
            h += row('الإجمالي:', `${inv.total} ج.م`, 'font-size:1.15em;font-weight:900;border-top:1px solid #000;margin-top:4px;padding-top:4px');
            if (inv.prepaid > 0) { h += row('مدفوع مقدماً (عربون):', `${inv.prepaid} ج.م`); h += row('المدفوع الآن:', `${inv.total - inv.prepaid} ج.م`, 'font-weight:900'); }
            h += `</div>`;
            if (S.showPayNumbers && payNums && inv.paymentMethod && inv.paymentMethod !== 'cash') h += `<div style="text-align:center;font-size:.9em;margin-top:6px">${esc(payNums)}</div>`;
            if (S.showNotes && inv.notes) h += `<div style="font-size:.9em;margin-top:6px">ملاحظات: ${esc(inv.notes)}</div>`;
            const f1 = (S.footer1 || '').replace(/\{name\}/g, name), f2 = (S.footer2 || '').replace(/\{name\}/g, name), nt = (S.note || '').replace(/\{name\}/g, name);
            const foot = [f1, f2].filter(Boolean).map(esc).join('<br>');
            if (foot || nt) h += `<div style="text-align:center;font-weight:700;font-size:.92em;border-top:1px dashed #000;margin-top:8px;padding-top:6px">${foot}${foot && nt ? '<br>' : ''}${nt ? `<span style="font-weight:400">${esc(nt)}</span>` : ''}</div>`;
            return h + `</div>`;
        }
        function openThermalReceipt(inv, autoPrint = false) {
            if (typeof inv !== 'object') inv = appState.invoices.find(i => i.id === inv);
            if (!inv) return;
            const S = getInvSettings();
            applyPaper(S);
            document.getElementById('printable-receipt').innerHTML = buildReceiptHtml(inv, S);
            document.getElementById('receipt-modal').classList.remove('hidden');
            if (autoPrint) setTimeout(() => window.print(), 300);
        }
        function updateInvPreview() {
            const el = document.getElementById('inv-preview'); if (!el) return;
            const S = readInvForm(), pn = document.getElementById('set-payment-numbers');
            const sample = { id: 1, date: getTodayISO(), time: getTimeStr(), barberName: (appState.barbers.find(isPerf) || {}).name || 'أحمد', clientName: 'اسم العميل', paymentMethod: 'wallet', subtotal: 250, discount: 25, total: 225, cashierName: currentUser ? currentUser.displayName : 'المدير', notes: 'ملاحظة تجريبية', items: [{ name: 'قص شعر', price: 150, qty: 1 }, { name: 'حلاقة دقن', price: 100, qty: 1 }] };
            const pv = document.getElementById('inv-logo-prev'); if (pv) pv.src = invLogoData || 'receipt-logo.webp';
            el.style.width = (S.paper === '58' ? 58 : 80) + 'mm';
            el.style.maxWidth = '100%';
            el.innerHTML = buildReceiptHtml(sample, S, { payNumbers: pn ? pn.value.trim() : null });
        }
        function saveInvoiceSettings(e) {
            if (e) e.preventDefault();
            if (!currentUser?.permissions?.settings) { showToast('غير مصرح لك', 'error'); return; }
            appState.invoiceSettings = readInvForm();
            const pn = document.getElementById('set-payment-numbers'); if (pn) appState.salonInfo.paymentNumbers = pn.value.trim();
            applyPaper(appState.invoiceSettings);
            logAudit('تعديل إعدادات الفاتورة والإيصال');
            saveState(); renderSettings(); showToast('تم حفظ تعديلات الفاتورة وتطبيقها');
        }
        function resetInvoiceSettings() {
            askConfirm('ترجّع شكل الفاتورة للإعدادات الأصلية؟', () => {
                appState.invoiceSettings = JSON.parse(JSON.stringify(DEFAULT_INV_SET));
                logAudit('رجوع إعدادات الفاتورة للشكل الأصلي');
                saveState(); renderSettings(); showToast('تم الرجوع للشكل الأصلي');
            }, 'رجّع');
        }

        function onInvLogoFile(e) {
            const f = e.target.files[0]; if (!f) return;
            const img = new Image(), url = URL.createObjectURL(f);
            img.onload = () => {
                const W = Math.min(480, img.width), H = Math.round(img.height * W / img.width);
                const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d');
                x.fillStyle = '#fff'; x.fillRect(0, 0, W, H); x.drawImage(img, 0, 0, W, H);
                const d = x.getImageData(0, 0, W, H), p = d.data;
                for (let i = 0; i < p.length; i += 4) {
                    const lum = 0.299 * p[i] + 0.587 * p[i + 1] + 0.114 * p[i + 2];
                    p[i] = p[i + 1] = p[i + 2] = 0; p[i + 3] = Math.round(Math.max(0, Math.min(1, (215 - lum) / 95)) * 255);
                }
                x.putImageData(d, 0, 0); invLogoData = c.toDataURL('image/png'); URL.revokeObjectURL(url); updateInvPreview();
                showToast('تم تجهيز اللوجو. اضغط حفظ تعديلات الفاتورة');
            };
            img.onerror = () => showToast('الصورة مش مقروءة', 'error');
            img.src = url; e.target.value = '';
        }
        function clearInvLogo() { invLogoData = ''; updateInvPreview(); }
