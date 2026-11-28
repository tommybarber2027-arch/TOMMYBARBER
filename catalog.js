        // 4. CATALOG
        function renderCatalogManagement() {
            document.getElementById('catalog-manage-list').innerHTML = appState.categories.map(cat => {
                const items = appState.catalog.filter(i => i.category === cat.id);
                return `
                    <div class="bg-panelbg border border-bordergold rounded-2xl p-4 space-y-3">
                        <div class="flex items-center justify-between border-b border-bordergold/60 pb-2.5">
                            <div class="flex items-center gap-2">
                                <span class="w-8 h-8 rounded-full border border-gold/40 text-gold flex items-center justify-center text-xs"><i class="fa-solid ${cat.icon || 'fa-scissors'}"></i></span>
                                <h3 class="text-sm font-black text-white">${cat.name}</h3>
                            </div>
                            <div class="flex items-center gap-2">
                                <button onclick="openItemModal('${cat.id}')" class="px-3 py-1.5 rounded-xl bg-gold text-black text-xs font-black">+ خدمة</button>
                                <button onclick="openCategoryModal('${cat.id}')" class="px-3 py-1.5 rounded-xl border border-bordergold bg-darkbg text-xs text-gray-300 hover:border-gold">تعديل القسم</button>
                            </div>
                        </div>
                        <div class="divide-y divide-bordergold/40 text-xs">
                            ${items.map(it => `
                                <div class="py-2.5 flex items-center justify-between ${it.hidden ? 'opacity-50' : ''}">
                                    <span class="font-bold text-white">${it.name}${it.hidden ? ' <span class="text-[10px] text-amber-300 font-bold">(مخفية)</span>' : ''}</span>
                                    <div class="flex items-center gap-4">
                                        <span class="font-black text-gold">${it.price} ج.م</span>
                                        <button onclick="openItemModal('${cat.id}', '${it.id}')" class="px-3 py-1 rounded-lg border border-bordergold bg-darkbg hover:border-gold text-gray-300 font-bold">تعديل</button>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `;
            }).join('');
        }

        function openCategoryModal(id = null) {
            if (id) {
                const c = appState.categories.find(x => x.id === id);
                document.getElementById('cat-modal-title').textContent = 'تعديل القسم';
                document.getElementById('edit-cat-id').value = c.id;
                document.getElementById('edit-cat-name').value = c.name;
                document.getElementById('edit-cat-icon').value = c.icon || 'fa-scissors';
            } else {
                document.getElementById('cat-modal-title').textContent = 'قسم جديد';
                document.getElementById('edit-cat-id').value = '';
                document.getElementById('edit-cat-name').value = '';
                document.getElementById('edit-cat-icon').value = 'fa-scissors';
            }
            document.getElementById('category-modal').classList.remove('hidden');
        }

        function saveCategory(e) {
            e.preventDefault();
            const id = document.getElementById('edit-cat-id').value;
            const name = document.getElementById('edit-cat-name').value.trim();
            const icon = document.getElementById('edit-cat-icon').value;
            if (id) { Object.assign(appState.categories.find(x => x.id === id), { name, icon }); logAudit(`تعديل قسم: ${name}`); }
            else { appState.categories.push({ id: 'cat_' + Date.now(), name, icon }); logAudit(`إضافة قسم جديد: ${name}`); }
            saveState(); closeModal('category-modal'); renderAll(); showToast('تم حفظ القسم');
        }

        function openItemModal(catId, itemId = null) {
            document.getElementById('edit-item-cat').value = catId;
            if (itemId) {
                const it = appState.catalog.find(x => x.id === itemId);
                document.getElementById('edit-item-id').value = it.id;
                document.getElementById('edit-item-name').value = it.name;
                document.getElementById('edit-item-price').value = it.price;
            } else {
                document.getElementById('edit-item-id').value = '';
                document.getElementById('edit-item-name').value = '';
                document.getElementById('edit-item-price').value = '';
            }
            document.getElementById('edit-item-extra').classList.toggle('hidden', !itemId);
            const ex = document.getElementById('edit-item-extra'); if (itemId) { const it0 = appState.catalog.find(x => x.id === itemId); ex.textContent = it0 && it0.hidden ? 'إظهار الخدمة أو حذفها' : 'إخفاء / حذف الخدمة'; }
            document.getElementById('item-modal').classList.remove('hidden');
        }
        // إخفاء الخدمة (بتختفي من الكاشير والحجز وتفضل في الفواتير القديمة) أو حذفها نهائي (المدير الأساسي بس)
        function svcOptions() {
            const id = document.getElementById('edit-item-id').value, it = appState.catalog.find(x => x.id === id); if (!it) return;
            if (!currentUser?.permissions?.catalog) { showToast('غير مصرح لك', 'error'); return; }
            const o = document.createElement('div'); o.id = 'svc-opt'; o.className = 'fixed inset-0 z-[160] bg-black/80 flex items-center justify-center p-4';
            const hid = !!it.hidden, canDel = isMaster(currentUser);
            o.innerHTML = `<div class="bg-panelbg border border-bordergold rounded-2xl max-w-sm w-full p-5 space-y-3 text-sm"><h3 class="font-black text-gold">${esc(it.name)}</h3>
                <button type="button" id="so-hide" class="w-full text-right bg-darkbg border border-gold/60 rounded-xl p-3"><b class="text-white block">${hid ? 'إظهار الخدمة' : 'إخفاء الخدمة (موصى بيه)'}</b><span class="text-gray-400 text-xs leading-relaxed">${hid ? 'هترجع تظهر في الكاشير وصفحة الحجز.' : 'بتختفي من الكاشير وصفحة الحجز، وبتفضل محفوظة في الفواتير القديمة، وتقدر ترجّعها في أي وقت.'}</span></button>
                <button type="button" id="so-del" ${canDel ? '' : 'disabled'} class="w-full text-right bg-red-950/30 border border-red-800/60 rounded-xl p-3 ${canDel ? '' : 'opacity-40'}"><b class="text-red-300 block">حذف نهائي</b><span class="text-gray-400 text-xs leading-relaxed">${canDel ? 'بتتمسح من القايمة. الفواتير القديمة بتفضل بأسمها وسعرها زي ما هي.' : 'الحذف النهائي للمدير الأساسي بس.'}</span></button>
                <button type="button" id="so-no" class="w-full bg-darkbg border border-bordergold text-gray-300 font-bold py-2.5 rounded-xl">إلغاء</button></div>`;
            document.body.appendChild(o); const close = () => o.remove();
            o.querySelector('#so-no').onclick = close;
            o.querySelector('#so-hide').onclick = () => { it.hidden = !hid; logAudit((it.hidden ? 'إخفاء الخدمة: ' : 'إظهار الخدمة: ') + it.name); saveState(); close(); closeModal('item-modal'); renderAll(); showToast(it.hidden ? 'تم إخفاء الخدمة' : 'تم إظهار الخدمة'); };
            if (canDel) o.querySelector('#so-del').onclick = () => { close(); askConfirm(`تحذف "${esc(it.name)}" نهائي؟ الأفضل تخفيها بدل الحذف.`, () => { appState.catalog = appState.catalog.filter(x => x.id !== id); logAudit('حذف الخدمة: ' + it.name); saveState(); closeModal('item-modal'); renderAll(); showToast('تم حذف الخدمة'); }, 'احذف نهائي'); };
        }

        function saveCatalogItem(e) {
            e.preventDefault();
            const id = document.getElementById('edit-item-id').value;
            const category = document.getElementById('edit-item-cat').value;
            const name = document.getElementById('edit-item-name').value.trim();
            const price = Number(document.getElementById('edit-item-price').value);
            const catObj = appState.categories.find(c => c.id === category);
            if (id) { Object.assign(appState.catalog.find(x => x.id === id), { name, price }); logAudit(`تعديل خدمة: ${name}`); }
            else { appState.catalog.push({ id: 's-' + Date.now(), category, name, price, icon: catObj?.icon || 'fa-scissors' }); logAudit(`إضافة خدمة: ${name}`); }
            saveState(); closeModal('item-modal'); renderAll(); showToast('تم حفظ الخدمة');
        }
