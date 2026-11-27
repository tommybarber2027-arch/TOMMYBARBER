        // ===================== ATTENDANCE (simple) =====================
        // appState.attendanceLog = { 'YYYY-MM-DD': { staffId: { st: 'present'|'absent', in: 'HH:MM', out: 'HH:MM' } } }
        let attDay = '';
        const _p2 = n => String(n).padStart(2, '0');
        const nowHM = () => { const d = new Date(); return _p2(d.getHours()) + ':' + _p2(d.getMinutes()); };
        const fmtHM = t => { if (!t) return '--'; const [h, m] = t.split(':').map(Number); return new Date(2000, 0, 1, h, m).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }); };
        const attStaff = () => appState.barbers.filter(b => !b.hidden);
        function attRec(id, create) {
            appState.attendanceLog = appState.attendanceLog || {};
            const day = appState.attendanceLog[attDay] = appState.attendanceLog[attDay] || {};
            if (create && !day[id]) day[id] = { st: '', in: '', out: '' };
            return day[id];
        }
        function attMark(id, what) {
            const r = attRec(id, true), today = attDay === getTodayISO();
            if (what === 'present') { r.st = 'present'; if (!r.in) r.in = today ? nowHM() : ''; }
            else if (what === 'absent') { r.st = 'absent'; r.in = ''; r.out = ''; }
            else if (what === 'out') { if (r.st !== 'present') { showToast('سجّل الحضور الأول', 'error'); return; } r.out = today ? nowHM() : r.out; }
            saveState(); renderAttendance();
        }
        function attSet(id, k, v) { const r = attRec(id, true); r[k] = v; if (k === 'in' && v && !r.st) r.st = 'present'; saveState(); renderAttendance(); }
        function attClear(id) {
            const b = appState.barbers.find(x => x.id === id);
            askConfirm('مسح تسجيل اليوم للموظف: ' + (b ? b.name : ''), () => { const d = appState.attendanceLog && appState.attendanceLog[attDay]; if (d) delete d[id]; saveState(); renderAttendance(); }, 'امسح');
        }
        function renderAttendance() {
            const root = document.getElementById('view-attendance'); if (!root) return;
            if (!attDay) attDay = getTodayISO();
            if (!document.getElementById('att-body')) {
                root.innerHTML = '<div class="flex items-center gap-2"><h2 class="text-sm font-black text-gold flex-1">الحضور والانصراف</h2><input type="date" id="att-date" onchange="attDay=this.value||getTodayISO();renderAttendance()" class="bg-darkbg border border-bordergold rounded-xl px-3 py-2 text-white text-xs"></div><div id="att-body" class="space-y-2"></div><div id="att-sum" class="bg-panelbg border border-bordergold rounded-2xl p-4 text-xs"></div>';
            }
            const di = document.getElementById('att-date'); if (di.value !== attDay) di.value = attDay;
            const day = (appState.attendanceLog || {})[attDay] || {};
            const bdg = { present: ['حاضر', 'text-emerald-400'], absent: ['غايب', 'text-red-400'] };
            const btn = 'px-3 py-1.5 rounded-xl border border-bordergold bg-darkbg text-gray-200 hover:border-gold text-xs font-bold';
            document.getElementById('att-body').innerHTML = attStaff().map(b => {
                const r = day[b.id] || { st: '', in: '', out: '' }, s = bdg[r.st];
                const state = r.st === 'present' ? (r.out ? 'تم الانصراف ' + fmtHM(r.out) : (r.in ? 'تم الحضور ' + fmtHM(r.in) : 'حاضر')) : (s ? s[0] : 'لم يُسجل');
                return `<div class="bg-panelbg border border-bordergold rounded-2xl p-3 space-y-2">
                    <div class="flex items-center justify-between"><b class="text-white text-sm">${esc(b.name)}</b><span class="text-xs font-bold ${s ? s[1] : 'text-gray-400'}">${state}</span></div>
                    <div class="flex gap-2 text-xs text-gray-400 items-center"><span>حضور</span><input type="time" value="${r.in || ''}" onchange="attSet('${b.id}','in',this.value)" class="bg-darkbg border border-bordergold rounded-lg px-2 py-1 text-white"><span>انصراف</span><input type="time" value="${r.out || ''}" onchange="attSet('${b.id}','out',this.value)" class="bg-darkbg border border-bordergold rounded-lg px-2 py-1 text-white"></div>
                    <div class="flex flex-wrap gap-2"><button class="${btn}" onclick="attMark('${b.id}','present')">حضور</button><button class="${btn}" onclick="attMark('${b.id}','out')">انصراف</button><button class="${btn}" onclick="attMark('${b.id}','absent')">غايب</button><button class="px-3 py-1.5 rounded-xl border border-red-800/60 bg-red-950/30 text-red-300 hover:bg-red-900/50 text-xs font-bold" onclick="attClear('${b.id}')">مسح</button></div></div>`;
            }).join('') || '<p class="text-gray-400 text-xs">ضيف موظفين من قسم الحلاقين الأول.</p>';
            const mon = attDay.slice(0, 7), log = appState.attendanceLog || {};
            const rows = attStaff().map(b => { let p = 0, a = 0; Object.keys(log).forEach(d => { if (d.startsWith(mon) && log[d][b.id]) { if (log[d][b.id].st === 'present') p++; else if (log[d][b.id].st === 'absent') a++; } }); return `<div class="flex justify-between py-1.5 border-t border-bordergold/40"><span class="text-white">${esc(b.name)}</span><span class="text-gray-300">حضور ${p} يوم • غياب ${a} يوم</span></div>`; }).join('');
            document.getElementById('att-sum').innerHTML = `<h3 class="text-sm font-black text-gold mb-2">ملخص الشهر (${mon})</h3>` + rows;
        }
