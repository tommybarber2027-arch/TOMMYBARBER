        // PAYROLL & ATTENDANCE HELPERS
        function calcLateMinutes(shiftStart, checkInTime) {
            if (!shiftStart || !checkInTime) return 0;
            const [sh, sm] = shiftStart.split(':').map(Number);
            const [ch, cm] = checkInTime.split(':').map(Number);
            const diff = (ch * 60 + cm) - (sh * 60 + sm);
            return diff > 0 ? diff : 0;
        }

        function getStaffMonthlyAttendance(staffId) {
            const monthPrefix = payrollMonth;
            const records = appState.attendanceRecords || {};
            let present = 0, absent = 0, lateMinutes = 0, chargeMinutes = 0, lateDays = 0, workMinutes = 0;
            const st0 = appState.barbers.find(b => b.id === staffId);
            Object.entries(records).forEach(([dateKey, dayMap]) => {
                if (dateKey.startsWith(monthPrefix) && dayMap && dayMap[staffId]) {
                    const r = dayMap[staffId];
                    if (r.status === 'present') {
                        present++; workMinutes += workedMin(r);
                        lateMinutes += Number(r.lateMinutes || 0);
                        chargeMinutes += chargeMin(Number(r.lateMinutes || 0), st0);
                        if (r.lateMinutes > 0) lateDays++;
                    } else if (r.status === 'absent') {
                        absent++;
                    }
                }
            });
            return { present, absent, lateMinutes, chargeMinutes, lateDays, workMinutes };
        }

        function calculateStaffPayroll(staff, filteredInvoices) {
            const payType = staff.payType || 'commission';
            const baseSalary = Number(staff.baseSalary || 0);
            const pct = Number(staff.commissionPct || 0);
            const skinPct = Number(staff.skinPct || 0);
            const lateHourRate = Number(staff.lateHourRate || 20);
            const att = { present: 0, absent: 0, lateMinutes: 0, chargeMinutes: 0, workMinutes: 0, lateDays: 0 };
            const absentDays = att.absent;
            const lateHours = Number((att.chargeMinutes / 60).toFixed(2));

            const staffInvs = filteredInvoices.filter(i => i.barberId === staff.id);
            let regularSales = 0, careSales = 0;

            staffInvs.forEach(inv => {
                inv.items.forEach(it => {
                    if (it.category === 'cat_cafe') return;
                    const lineTotal = it.price * it.qty * invFactor(inv);
                    if (isCareCat(it.category)) careSales += lineTotal;
                    else regularSales += lineTotal;
                });
            });

            const totalSales = regularSales + careSales;
            const regularComm = payType === 'salary' ? 0 : (regularSales * pct) / 100;
            const careComm = payType === 'salary' ? 0 : (careSales * (skinPct > 0 ? skinPct : pct)) / 100;
            const totalComm = Number((regularComm + careComm).toFixed(2));

            const dailyRate = baseSalary > 0 ? (baseSalary / 30) : 0;
            const absenceDeduction = Math.round(dailyRate * absentDays);
            const lateDeduction = (appState.salonInfo.lateDeduct === 'auto') ? Math.round(lateHours * lateHourRate) : 0;
            const totalTimeDeduction = absenceDeduction + lateDeduction;
            const netBaseSalary = Math.max(0, baseSalary - totalTimeDeduction);

            const advancesTotal = (typeof finAdvTotal === 'function') ? finAdvTotal(staff.id, payrollMonth) : 0;

            const netPayable = Math.max(0, Number((netBaseSalary + totalComm - advancesTotal).toFixed(2)));

            return {
                invCount: staffInvs.length, regularSales, careSales, totalSales,
                regularComm: Number(regularComm.toFixed(2)), careComm: Number(careComm.toFixed(2)), totalComm,
                baseSalary, presentDays: att.present, absentDays, lateMinutes: att.lateMinutes,
                chargeMinutes: att.chargeMinutes, workMinutes: att.workMinutes, lateDays: att.lateDays, lateHours,
                absenceDeduction, lateDeduction, totalTimeDeduction, netBaseSalary, advancesTotal, netPayable
            };
        }
