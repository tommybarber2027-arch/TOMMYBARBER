        window.onload = function () {
            const today = getTodayISO();
            const fromEl = document.getElementById('inv-date-from'), toEl = document.getElementById('inv-date-to');
            if (fromEl) fromEl.value = today;
            if (toEl) toEl.value = today;
            setRepPeriod('month');
            renderAll();
            initCloudSync();
        };
