        // 1. POS
        function selectBarber(id) { selectedBarberId = id; renderPOS(); }
        function selectCategory(id) {
            selectedCategoryId = id; servicesBoxVisible = true;
            document.getElementById('pos-items-grid').classList.remove('hidden');
            document.getElementById('toggle-services-btn').textContent = 'إخفاء';
            renderPOSCatalog();
        }
        function toggleServicesBox() {
            servicesBoxVisible = !servicesBoxVisible;
            document.getElementById('pos-items-grid').classList.toggle('hidden', !servicesBoxVisible);
            document.getElementById('toggle-services-btn').textContent = servicesBoxVisible ? 'إخفاء' : 'إظهار';
        }
        function scrollToServices() { document.getElementById('pos-categories-grid')?.scrollIntoView({ behavior: 'smooth' }); }
        function scrollToInvoiceDrawer() { document.getElementById('pos-invoice-drawer')?.scrollIntoView({ behavior: 'smooth' }); }

        function renderPOS() {
            const activeBarbers = appState.barbers.filter(b => isPerf(b) && !b.hidden);
            if (!activeBarbers.some(b => b.id === selectedBarberId) && activeBarbers.length > 0) selectedBarberId = activeBarbers[0].id;

            document.getElementById('pos-barbers-grid').innerHTML = activeBarbers.map(b => {
                const isSel = selectedBarberId === b.id;
                const isSkin = (b.role || 'barber') !== 'barber';
                return `
                    <button type="button" onclick="selectBarber('${b.id}')" class="relative bg-panelbg border ${isSel ? 'border-gold bg-golddark/40' : 'border-bordergold hover:border-gold/40'} rounded-2xl p-3.5 text-center transition flex flex-col items-center gap-1.5">
                        ${isSel ? `<span class="absolute top-2 right-2 w-4 h-4 rounded-full bg-gold text-black text-[10px] font-black flex items-center justify-center">✓</span>` : ''}
                        <div class="w-12 h-12 rounded-full border ${isSel ? 'border-gold text-gold' : 'border-bordergold text-gray-400'} flex items-center justify-center text-lg">
                            <i class="fa-solid ${isSkin ? 'fa-spa' : 'fa-scissors'}"></i>
                        </div>
                        <span class="text-xs font-black ${isSel ? 'text-gold' : 'text-white'}">${b.name}</span>
                        <span class="text-[10px] px-2 py-0.5 rounded-full ${isSkin ? 'bg-emerald-950/70 text-emerald-300 border border-emerald-800/50' : 'bg-darkbg text-gray-400'}">${isSkin ? 'بشرة / بيديكير' : 'حلاق'}</span>
                    </button>
                `;
            }).join('');
            renderPOSCatalog();
            renderInvoicePanel();
        }

        function renderPOSCatalog() {
            const q = (document.getElementById('pos-search-input')?.value || '').trim().toLowerCase();
            document.getElementById('pos-categories-grid').innerHTML = appState.categories.map(cat => {
                const isSel = selectedCategoryId === cat.id && !q;
                const countInCat = appState.catalog.filter(i => i.category === cat.id && !i.hidden).length;
                const selectedQty = currentDraft.items.filter(x => x.category === cat.id).reduce((s, x) => s + x.qty, 0);
                return `
                    <button type="button" onclick="selectCategory('${cat.id}')" class="relative bg-panelbg border ${isSel ? 'border-gold bg-golddark/40' : 'border-bordergold hover:border-gold/40'} rounded-2xl p-3 text-center transition flex flex-col items-center justify-center gap-1.5 min-h-[115px]">
                        ${selectedQty > 0 ? `<span class="absolute top-2 right-2 w-5 h-5 rounded-full bg-gold text-black text-[11px] font-black flex items-center justify-center">${selectedQty}</span>` : ''}
                        <div class="w-11 h-11 rounded-full border ${isSel ? 'border-gold text-gold' : 'border-bordergold text-gold/80'} flex items-center justify-center text-base">
                            <i class="fa-solid ${cat.icon || 'fa-scissors'}"></i>
                        </div>
                        <span class="text-xs font-black text-white leading-tight">${cat.name}</span>
                        <span class="text-[10px] text-gray-500">${countInCat} خدمة</span>
                    </button>
                `;
            }).join('');

            const catObj = appState.categories.find(c => c.id === selectedCategoryId);
            const items = q ? appState.catalog.filter(i => !i.hidden && i.name.toLowerCase().includes(q)) : appState.catalog.filter(i => !i.hidden && i.category === selectedCategoryId);
            document.getElementById('pos-selected-cat-title').textContent = q ? `نتائج البحث: "${q}"` : (catObj ? catObj.name : 'الخدمات');

            document.getElementById('pos-items-grid').innerHTML = items.map(item => {
                const inCart = currentDraft.items.find(x => x.itemId === item.id);
                return `
                    <button type="button" onclick="addServiceToDraft('${item.id}')" class="relative bg-darkbg border ${inCart ? 'border-gold bg-golddark/40' : 'border-bordergold hover:border-gold/50'} rounded-2xl p-4 text-center transition flex flex-col items-center justify-between gap-2 min-h-[135px]">
                        ${inCart ? `<span class="absolute top-2.5 right-2.5 w-5 h-5 rounded-full bg-gold text-black text-[11px] font-black flex items-center justify-center">${inCart.qty}</span>` : ''}
                        <div class="w-11 h-11 rounded-full border border-bordergold flex items-center justify-center text-gold text-base">
                            <i class="fa-solid ${item.icon || 'fa-scissors'}"></i>
                        </div>
                        <span class="text-xs font-bold text-white leading-snug">${item.name}</span>
                        <span class="text-sm font-black text-gold">${item.price}</span>
                    </button>
                `;
            }).join('');
        }

        function addServiceToDraft(itemId) {
            const item = appState.catalog.find(i => i.id === itemId);
            if (!item) return;
            const existing = currentDraft.items.find(x => x.itemId === item.id);
            if (existing) existing.qty += 1;
            else currentDraft.items.push({ itemId: item.id, name: item.name, category: item.category, price: Number(item.price), qty: 1 });
            renderPOS();
        }

        function updateDraftQty(itemId, delta) {
            const idx = currentDraft.items.findIndex(x => x.itemId === itemId);
            if (idx === -1) return;
            currentDraft.items[idx].qty += delta;
            if (currentDraft.items[idx].qty <= 0) currentDraft.items.splice(idx, 1);
            renderPOS();
        }

        function setPaymentMethod(method) { currentDraft.paymentMethod = method; renderInvoicePanel(); }

        function applyPercentDiscount(pct) {
            const sub = currentDraft.items.reduce((s, i) => s + (i.price * i.qty), 0);
            currentDraft.discount = Math.round((sub * pct) / 100);
            document.getElementById('inv-discount-input').value = currentDraft.discount;
            renderInvoicePanel();
        }

        function setFixedDiscount(val) { currentDraft.discount = Math.max(0, Number(val) || 0); renderInvoicePanel(); }

        function resetCurrentInvoice() {
            editingInvoiceId = null;
            currentDraft = { items: [], paymentMethod: 'cash', discount: 0 };
            document.getElementById('inv-discount-input').value = 0;
            document.getElementById('inv-client-name').value = '';
            document.getElementById('inv-client-phone').value = '';
            document.getElementById('inv-notes').value = '';
            document.getElementById('inv-client-lookup-badge')?.classList.add('hidden');
            renderPOS();
        }

        function lookupClientByPhone(phoneVal) {
            const cleanPhone = (phoneVal || '').trim();
            const badge = document.getElementById('inv-client-lookup-badge');
            const nameInput = document.getElementById('inv-client-name');
            if (!badge) return;
            if (cleanPhone.length < 4) { badge.classList.add('hidden'); return; }
            const existingClient = (appState.clients || []).find(c => c.phone === cleanPhone);
            const pastInvs = appState.invoices.filter(i => !i.deleted && i.clientPhone === cleanPhone);
            if (existingClient || pastInvs.length > 0) {
                const knownName = existingClient ? existingClient.name : pastInvs[0].clientName;
                if (knownName && !nameInput.value.trim()) nameInput.value = knownName;
                const totalSpent = pastInvs.reduce((s, i) => s + Number(i.total || 0), 0);
                badge.innerHTML = `<i class="fa-solid fa-user-check ml-1"></i> عميل مسجل سابقاً: <b>${knownName || 'بدون اسم'}</b> • عدد الزيارات السابقة: <b>${pastInvs.length}</b> • إجمالي مدفوعاته: <b>${fmt(totalSpent)} ج.م</b>`;
                badge.classList.remove('hidden');
            } else {
                badge.classList.add('hidden');
            }
        }

        function renderInvoicePanel() {
            const nextId = editingInvoiceId || (appState.invoices.length > 0 ? Math.max(...appState.invoices.map(i => i.id)) + 1 : 1);
            const barberName = appState.barbers.find(b => b.id === selectedBarberId)?.name || '--';
            document.getElementById('inv-panel-title').textContent = editingInvoiceId ? `تعديل فاتورة رقم ${editingInvoiceId}` : `فاتورة جديدة رقم ${nextId}`;
            document.getElementById('inv-panel-barber-name').textContent = `الحلاق: ${barberName}`;

            const list = document.getElementById('inv-items-list');
            if (currentDraft.items.length === 0) {
                list.innerHTML = `<div class="h-40 flex items-center justify-center text-gray-500 text-xs">لم يتم إضافة خدمات بعد</div>`;
            } else {
                list.innerHTML = currentDraft.items.map(it => `
                    <div class="py-2.5 flex items-center justify-between text-xs">
                        <div class="space-y-1">
                            <span class="font-bold text-white block">${it.name}</span>
                            <div class="flex items-center gap-2 text-[11px] text-gray-400">
                                <span>${it.price} × قطعة</span>
                                <div class="flex items-center gap-1.5 bg-darkbg border border-bordergold rounded-lg px-2 py-0.5">
                                    <button type="button" onclick="updateDraftQty('${it.itemId}', 1)" class="text-white font-black">+</button>
                                    <span class="font-bold text-white px-1">${it.qty}</span>
                                    <button type="button" onclick="updateDraftQty('${it.itemId}', -1)" class="text-white font-black">-</button>
                                </div>
                            </div>
                        </div>
                        <div class="flex flex-col items-end gap-1.5">
                            <span class="font-black text-gold text-sm">${it.price * it.qty}</span>
                            <button type="button" onclick="updateDraftQty('${it.itemId}', -999)" class="text-gray-400 hover:text-red-400 text-xs"><i class="fa-solid fa-xmark"></i></button>
                        </div>
                    </div>
                `).join('');
            }

            ['cash', 'visa', 'wallet'].forEach(m => {
                const btn = document.getElementById(`pay-btn-${m}`);
                if (!btn) return;
                btn.className = currentDraft.paymentMethod === m
                    ? `pay-btn py-2.5 rounded-xl border border-gold bg-golddark text-gold text-xs font-black transition`
                    : `pay-btn py-2.5 rounded-xl border border-bordergold bg-darkbg text-gray-300 text-xs font-bold transition`;
            });

            const subtotal = currentDraft.items.reduce((s, i) => s + (i.price * i.qty), 0);
            const total = Math.max(0, subtotal - (Number(currentDraft.discount) || 0));
            const totalQty = currentDraft.items.reduce((s, i) => s + i.qty, 0);
            document.getElementById('inv-subtotal-text').textContent = `المجموع ${subtotal}`;
            document.getElementById('inv-total-text').textContent = total;
            document.getElementById('mobile-bar-summary').textContent = `${totalQty} خدمة • ${total}`;
        }

        function saveInvoice(shouldPrint) {
            if (currentDraft.items.length === 0) { showToast('اختر خدمة واحدة على الأقل', 'error'); return; }
            const subtotal = currentDraft.items.reduce((s, i) => s + (i.price * i.qty), 0);
            const discount = Math.max(0, Number(currentDraft.discount) || 0);
            const total = Math.max(0, subtotal - discount);
            const barberName = appState.barbers.find(b => b.id === selectedBarberId)?.name || '--';
            const clientName = document.getElementById('inv-client-name').value.trim();
            const clientPhone = document.getElementById('inv-client-phone').value.trim();
            const notes = document.getElementById('inv-notes').value.trim();

            if ((clientName && !clientPhone) || (!clientName && clientPhone)) {
                showToast('عند تسجيل بيانات عميل يجب إدخال الاسم ورقم التليفون معاً', 'error');
                return;
            }

            if (clientName && clientPhone) {
                if (!appState.clients) appState.clients = [];
                if (!appState.clients.find(c => c.phone === clientPhone)) {
                    appState.clients.unshift({ id: 'c-' + Date.now(), name: clientName, phone: clientPhone, createdAt: getTodayISO() });
                }
            }

            let savedInv = null;
            if (editingInvoiceId) {
                const existing = appState.invoices.find(i => i.id === editingInvoiceId);
                if (existing) {
                    Object.assign(existing, { barberId: selectedBarberId, barberName, clientName, clientPhone, notes, paymentMethod: currentDraft.paymentMethod, subtotal, discount, total, items: JSON.parse(JSON.stringify(currentDraft.items)) });
                    savedInv = existing; try { dwClosedNote(existing); } catch (e) { }
                    logAudit(`تعديل الفاتورة رقم ${existing.id}`);
                }
            } else {
                const nextId = Math.max(appState.lastInvId || 0, appState.invoices.length > 0 ? Math.max(...appState.invoices.map(i => i.id)) : 0) + 1;
                savedInv = {
                    id: nextId, date: getTodayISO(), time: getTimeStr(), barberId: selectedBarberId, barberName,
                    clientName, clientPhone, notes, paymentMethod: currentDraft.paymentMethod, subtotal, discount, total,
                    cashierName: currentUser ? currentUser.displayName : 'omar', shiftId: ensureShift().id, deleted: false, items: JSON.parse(JSON.stringify(currentDraft.items))
                };
                appState.invoices.unshift(savedInv);
                logAudit(`حفظ فاتورة رقم ${savedInv.id} بقيمة ${savedInv.total} ج.م`);
            }

            saveState();
            resetCurrentInvoice();
            renderAll();
            if (shouldPrint && savedInv) openThermalReceipt(savedInv, true);
            else showToast(`تم حفظ الفاتورة رقم ${savedInv.id}`);
        }
