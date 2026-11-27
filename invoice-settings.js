// ===================== INVOICE / RECEIPT SETTINGS =====================
        const DEFAULT_INV_SET = { showLogo: true, logo: 'md', customLogo: '', showAddress: true, showPhone: true, showDateTime: true, showBarber: true, showClient: true, showCashier: false, showPayment: true, showDiscount: true, showPayNumbers: false, showNotes: false, title: '', address: '', phone: '', footer1: 'شكراً لزيارتكم', footer2: 'مع تحيات {name}', note: '', paper: '80', font: 'md' };
        const INV_TOG = ['showLogo', 'showAddress', 'showPhone', 'showDateTime', 'showBarber', 'showClient', 'showCashier', 'showPayment', 'showDiscount', 'showPayNumbers', 'showNotes'];
        const INV_TXT = ['title', 'address', 'phone', 'footer1', 'footer2', 'note'];
        const INV_SEL = ['paper', 'font', 'logo'];
        let draftCustomLogo = null; // null = لم يتغير، '' = محذوف، 'data:image/...' = صورة جديدة

        // لوجو SVG خفيف ومطابق للوجو الصالون المرفق للطباعة الحرارية بدقة عالية
        const LIGHT_THERMAL_LOGO_SVG = `<svg viewBox="0 0 240 280" style="display:block;margin:0 auto 4px;width:100%;height:auto">
            <path fill="#000" d="M62 12 C52 34 48 58 52 84 L48 112 C40 112 36 126 42 144 C46 154 54 156 58 152 L60 174 C56 184 52 194 44 192 C48 206 60 214 72 214 C78 236 96 250 110 256 C108 263 104 268 98 272 C122 272 144 256 156 236 C164 226 168 216 170 212 C182 212 194 204 198 190 C190 192 186 182 182 172 L184 152 C188 156 196 154 200 144 C206 126 202 112 194 112 L192 78 C196 58 186 44 170 42 C166 20 144 12 118 14 C94 16 74 28 62 12 Z"/>
            <path fill="#fff" d="M64 40 C74 52 92 60 110 62 C92 64 74 58 62 46 Z M84 28 C102 36 124 40 144 38 C124 44 102 42 84 32 Z M106 20 C124 24 142 26 156 24 C142 30 124 30 106 22 Z M162 54 C172 56 180 62 184 70 C176 64 168 60 160 58 Z"/>
            <path fill="#fff" d="M66 84 L78 72 C96 76 112 78 120 84 C132 74 148 68 162 66 L176 82 L176 144 L164 176 C150 164 134 158 120 158 C106 158 90 164 76 176 L64 144 Z"/>
            <path fill="#000" d="M98 94 Q120 100 142 94 Q120 104 98 94 Z"/>
            <path fill="#000" d="M72 112 L94 106 L114 114 L112 120 L92 114 L74 118 Z M168 112 L146 106 L126 114 L128 120 L148 114 L166 118 Z"/>
            <path fill="#000" d="M78 122 Q94 118 108 124 Q94 128 78 122 Z M162 122 Q146 118 132 124 Q146 128 162 122 Z"/>
            <circle cx="93" cy="123" r="2.5" fill="#fff"/><circle cx="147" cy="123" r="2.5" fill="#fff"/>
            <path fill="#000" d="M114 118 L112 146 L104 150 L114 154 L120 151 L126 154 L136 150 L128 146 L126 118 L122 146 L118 146 Z"/>
            <path fill="#fff" d="M120 168 C102 168 82 184 64 196 C82 198 104 190 120 178 C136 190 158 198 176 196 C158 184 138 168 120 168 Z"/>
            <path fill="#fff" d="M108 194 Q120 190 132 194 Q128 202 120 202 Q112 202 108 194 Z"/>
            <path fill="#fff" d="M96 214 L104 234 L112 218 L118 242 L124 220 L132 238 L142 214 L134 226 L126 210 L118 228 L110 210 L102 226 Z"/>
        </svg>`;

        const getInvSettings = () => Object.assign({}, DEFAULT_INV_SET, appState.invoiceSettings || {});

        function syncLogoThumbUI(logoData) {
            const thumb = document.getElementById('inv-logo-thumb');
            const lbl = document.getElementById('inv-logo-default-lbl');
            const rst = document.getElementById('inv-logo-reset-btn');
            if (!thumb || !lbl || !rst) return;
            if (logoData) {
                thumb.src = logoData;
                thumb.classList.remove('hidden');
                lbl.classList.add('hidden');
                rst.classList.remove('hidden');
            } else {
                thumb.src = '';
                thumb.classList.add('hidden');
                lbl.classList.remove('hidden');
                rst.classList.add('hidden');
            }
        }

        function setInvForm(S) {
            draftCustomLogo = null;
            INV_TOG.forEach(k => { const e = document.getElementById('inv-s-' + k); if (e) e.checked = !!S[k]; });
            INV_TXT.forEach(k => { const e = document.getElementById('inv-s-' + k); if (e) e.value = S[k] || ''; });
            INV_SEL.forEach(k => { const e = document.getElementById('inv-s-' + k); if (e) e.value = S[k]; });
            syncLogoThumbUI(S.customLogo || '');
        }

        function readInvForm() {
            const cur = getInvSettings();
            const S = {};
            INV_TOG.forEach(k => { const e = document.getElementById('inv-s-' + k); S[k] = e ? e.checked : DEFAULT_INV_SET[k]; });
            INV_TXT.forEach(k => { const e = document.getElementById('inv-s-' + k); S[k] = e ? e.value.trim() : DEFAULT_INV_SET[k]; });
            INV_SEL.forEach(k => { const e = document.getElementById('inv-s-' + k); S[k] = e ? e.value : DEFAULT_INV_SET[k]; });
            S.customLogo = draftCustomLogo !== null ? draftCustomLogo : (cur.customLogo || '');
            return S;
        }

        // معالجة وضغط الصورة المرفوعة وتحويلها لتباين عالٍ للطباعة الحرارية
        function handleInvoiceLogoUpload(e) {
            const file = e.target.files && e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = function (ev) {
                const img = new Image();
                img.onload = function () {
                    const maxW = 280;
                    const scale = Math.min(1, maxW / img.width);
                    const w = Math.round(img.width * scale);
                    const h = Math.round(img.height * scale);
                    const canvas = document.createElement('canvas');
                    canvas.width = w;
                    canvas.height = h;
                    const ctx = canvas.getContext('2d');
                    ctx.fillStyle = '#ffffff';
                    ctx.fillRect(0, 0, w, h);
                    ctx.drawImage(img, 0, 0, w, h);

                    // تحويل الصورة إلى أبيض وأسود عالي التباين للطابعات الحرارية
                    const imgData = ctx.getImageData(0, 0, w, h);
                    const d = imgData.data;
                    for (let i = 0; i < d.length; i += 4) {
                        const gray = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
                        const bw = gray < 155 ? 0 : 255;
                        d[i] = d[i + 1] = d[i + 2] = bw;
                        d[i + 3] = 255;
                    }
                    ctx.putImageData(imgData, 0, 0);

                    draftCustomLogo = canvas.toDataURL('image/png', 0.85);
                    syncLogoThumbUI(draftCustomLogo);
                    updateInvPreview();
                    showToast('تم تجهيز اللوجو! اضغط "حفظ تعديلات الفاتورة" لتثبيته');
                };
                img.src = ev.target.result;
            };
            reader.readAsDataURL(file);
            e.target.value = '';
        }

        function clearCustomInvoiceLogo() {
            draftCustomLogo = '';
            syncLogoThumbUI('');
            updateInvPreview();
            showToast('تمت استعادة اللوجو الخفيف الافتراضي');
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
            if (S.showLogo) {
                if (S.customLogo) {
                    h += `<img src="${S.customLogo}" alt="Logo" style="display:block;margin:0 auto 4px;width:${lw}mm;max-height:${(lw * 1.2).toFixed(1)}mm;object-fit:contain">`;
                } else {
                    h += `<div style="margin:0 auto 4px;width:${lw}mm">${LIGHT_THERMAL_LOGO_SVG}</div>`;
                }
            }
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
            el.style.width = (S.paper === '58' ? 58 : 80) + 'mm';
            el.style.maxWidth = '100%';
            el.innerHTML = buildReceiptHtml(sample, S, { payNumbers: pn ? pn.value.trim() : null });
        }

        function saveInvoiceSettings(e) {
            if (e) e.preventDefault();
            if (!currentUser?.permissions?.settings) { showToast('غير مصرح لك', 'error'); return; }
            appState.invoiceSettings = readInvForm();
            draftCustomLogo = null;
            const pn = document.getElementById('set-payment-numbers'); if (pn) appState.salonInfo.paymentNumbers = pn.value.trim();
            applyPaper(appState.invoiceSettings);
            logAudit('تعديل إعدادات الفاتورة والإيصال');
            saveState(); renderSettings(); showToast('تم حفظ تعديلات الفاتورة وتطبيقها');
        }

        function resetInvoiceSettings() {
            askConfirm('ترجّع شكل الفاتورة للإعدادات الأصلية؟', () => {
                draftCustomLogo = null;
                appState.invoiceSettings = JSON.parse(JSON.stringify(DEFAULT_INV_SET));
                logAudit('رجوع إعدادات الفاتورة للشكل الأصلي');
                saveState(); renderSettings(); showToast('تم الرجوع للشكل الأصلي');
            }, 'رجّع');
        }