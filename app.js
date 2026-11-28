        window.onload = function () {
            const today = getTodayISO();
            const fromEl = document.getElementById('inv-date-from'), toEl = document.getElementById('inv-date-to');
            if (fromEl) fromEl.value = today;
            if (toEl) toEl.value = today;
            setRepPeriod('month');
            renderAll();
            initCloudSync();
            try { setSyncUi(); } catch (e) { }
            checkBuild();
            try { renderFootBar(true); } catch (e) { }
        };
        // يتأكد إن كل الملفات الجديدة اتحمّلت (لو ملف ناقص أو قديم بيظهر تحذير)
        function checkBuild() {
            const need = { 'drawer.js': 'renderDrawer', 'bookings.js': 'renderBookings', 'archive.js': 'renderArchive', 'bookpage.js': 'renderBookingSettings', 'extras.js': 'renderFootBar', 'finance.js': 'finRefresh', 'core.js': 'migrateAuth', 'users-settings.js': 'askBox', 'data-tools.js': 'factoryReset' };
            const miss = Object.keys(need).filter(f => { try { return typeof eval(need[f]) !== 'function'; } catch (e) { return true; } });
            ['view-bookings', 'view-archive', 'view-drawer', 'tab-bookings', 'tab-archive'].forEach(id => { if (!document.getElementById(id)) miss.push('index.html (' + id + ')'); });
            if (!miss.length) return;
            const d = document.createElement('div'); d.className = 'fixed top-0 inset-x-0 z-[300] bg-red-700 text-white text-xs font-bold p-3 text-center';
            d.textContent = 'تنبيه: ملفات ناقصة أو قديمة على الموقع: ' + miss.join('، ') + ' — ارفع كل الملفات من الـzip الأخير ثم افتح الموقع في Incognito.';
            document.body.appendChild(d);
        }
