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
                                <div class="py-2.5 flex items-center justify-between">
                                    <span class="font-bold text-white">${it.name}</span>
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
            document.getElementById('item-modal').classList.remove('hidden');
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
