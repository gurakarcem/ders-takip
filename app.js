/**
 * DersTakip Pro - Uygulama Mantığı ve Reaktif Durum Yönetimi
 * (Öğrenci Kabulü, Ücret Belirleme, Ders Kaydı, Geçmiş Dersleri Düzenleme & Google Takvim)
 */

// Ay listesi (Eğitim yılı sırasına göre: Ağustos - Haziran)
const MONTHS = [
  "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
  "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran"
];

const MONTH_MAP = {
  8: "Ağustos", 9: "Eylül", 10: "Ekim", 11: "Kasım", 12: "Aralık",
  1: "Ocak", 2: "Şubat", 3: "Mart", 4: "Nisan", 5: "Mayıs", 6: "Haziran", 7: "Temmuz"
};

// Uygulama Durumu (State)
let appState = {
  data: null,
  activePeriodId: "2026-2027",
  matrixMode: "lessons", // 'lessons' veya 'revenue'
  activeTab: "dashboard",
  paymentFilter: "all",  // 'all', 'unpaid', 'paid'
  paymentStudentFilter: "all",
  gcalEmail: "",
  charts: {
    revenue: null,
    students: null
  }
};

// Başlangıç: Veriyi yükle ve başlat
function initApp() {
  loadData();
  setupEventListeners();
  populatePeriodSelect();
  renderApp();

  // Cihazlar Arası Bulut Senkronizasyonunu Başlat
  if (window.CloudSync) {
    window.CloudSync.init({
      onDataUpdated: (newData) => {
        appState.data = newData;
        if (newData.activePeriodId) {
          appState.activePeriodId = newData.activePeriodId;
        }
        if (appState.data.periods) {
          appState.data.periods.forEach(p => ensureLessonsArray(p));
        }
        populatePeriodSelect();
        renderApp();
      }
    });
  }
}

function loadData() {
  try {
    const saved = localStorage.getItem("DERS_TAKIP_PRO_DATA");
    if (saved) {
      appState.data = JSON.parse(saved);
    } else if (window.INITIAL_DERS_DATA) {
      appState.data = JSON.parse(JSON.stringify(window.INITIAL_DERS_DATA));
      saveData();
    }
  } catch (e) {
    console.error("Veri yüklenirken hata:", e);
    if (window.INITIAL_DERS_DATA) {
      appState.data = JSON.parse(JSON.stringify(window.INITIAL_DERS_DATA));
    }
  }

  // Zaman damgası ve cihaz kontrolü
  if (appState.data) {
    if (!appState.data._updatedAt) {
      appState.data._updatedAt = Date.now();
    }
    if (!appState.data._lastDevice && window.CloudSync) {
      appState.data._lastDevice = window.CloudSync.getDeviceName();
    }
  }

  appState.gcalEmail = localStorage.getItem("DERS_TAKIP_GCAL_EMAIL") || "";

  if (appState.data && appState.data.activePeriodId) {
    appState.activePeriodId = appState.data.activePeriodId;
  }

  // Her dönem için dersler dizisinin (lessons) varlığını garanti et
  if (appState.data && appState.data.periods) {
    appState.data.periods.forEach(p => ensureLessonsArray(p));
  }
}

function saveData() {
  if (!appState.data) return;
  appState.data.activePeriodId = appState.activePeriodId;
  appState.data._updatedAt = Date.now();
  if (window.CloudSync) {
    appState.data._lastDevice = window.CloudSync.getDeviceName();
  }
  localStorage.setItem("DERS_TAKIP_PRO_DATA", JSON.stringify(appState.data));

  // Cihazlar arası buluta otomatik aktar
  if (window.CloudSync) {
    window.CloudSync.schedulePush(appState.data);
  }
}

function resetToDefaultData() {
  if (confirm("Tüm değişiklikler sıfırlanacak ve dosyanızdaki orijinal veriler geri yüklenecek. Emin misiniz?")) {
    appState.data = JSON.parse(JSON.stringify(window.INITIAL_DERS_DATA));
    appState.activePeriodId = appState.data.activePeriodId || "2026-2027";
    if (appState.data.periods) {
      appState.data.periods.forEach(p => ensureLessonsArray(p));
    }
    saveData();
    populatePeriodSelect();
    renderApp();
    showToast("Orijinal veriler başarıyla geri yüklendi!");
  }
}

// Aktif dönemi getir
function getActivePeriod() {
  if (!appState.data || !appState.data.periods) return null;
  return appState.data.periods.find(p => p.id === appState.activePeriodId) || appState.data.periods[0];
}

// Dersler dizisini oluştur (eğer yoksa geçmiş tarihlerden sentezle)
function ensureLessonsArray(period) {
  if (!period.lessons || period.lessons.length === 0) {
    period.lessons = [];
    const datesMap = period.lessonDates || {};

    let counter = 1;
    period.students.forEach(s => {
      const dates = datesMap[s.id] || [];
      dates.forEach(d => {
        const mIdx = parseInt(d.split("-")[1], 10);
        const mName = MONTH_MAP[mIdx] || "Eylül";
        const rate = s.rate || 3000;

        period.lessons.push({
          id: "les_" + counter++,
          studentId: s.id,
          date: d,
          time: "14:00",
          duration: 60,
          month: mName,
          rate: rate,
          isPaid: true,
          paidDate: d,
          note: ""
        });
      });
    });
  } else {
    // Mevcut derslerde saat ve süre yoksa varsayılan ata
    period.lessons.forEach(l => {
      if (!l.time) l.time = "14:00";
      if (!l.duration) l.duration = 60;
    });
  }
}

// Hesaplamalar (Toplamlar, Tahsilat, Bakiye)
function calculateTotals(period) {
  if (!period) return {
    totalLessons: 0, totalRevenue: 0, totalPaid: 0, totalUnpaid: 0,
    avgRate: 0, studentTotals: {}, monthTotals: {}
  };

  let totalLessons = 0;
  let totalRevenue = 0;
  let totalPaid = 0;
  let totalUnpaid = 0;

  const studentTotals = {};
  const monthTotals = {};

  // Öğrenci bazında sıfırla
  period.students.forEach(s => {
    studentTotals[s.id] = { lessons: 0, revenue: 0, paid: 0, unpaid: 0, avgRate: 0 };
  });

  // Ay bazında sıfırla
  MONTHS.forEach(m => {
    monthTotals[m] = { lessons: 0, revenue: 0, paid: 0, unpaid: 0, avgRate: 0 };
  });

  const lessons = period.lessons || [];
  lessons.forEach(l => {
    const sId = l.studentId;
    const m = l.month;
    const rate = parseFloat(l.rate) || 0;
    const isPaid = !!l.isPaid;

    totalLessons += 1;
    totalRevenue += rate;

    if (isPaid) {
      totalPaid += rate;
    } else {
      totalUnpaid += rate;
    }

    if (studentTotals[sId]) {
      studentTotals[sId].lessons += 1;
      studentTotals[sId].revenue += rate;
      if (isPaid) {
        studentTotals[sId].paid += rate;
      } else {
        studentTotals[sId].unpaid += rate;
      }
    }

    if (monthTotals[m]) {
      monthTotals[m].lessons += 1;
      monthTotals[m].revenue += rate;
      if (isPaid) {
        monthTotals[m].paid += rate;
      } else {
        monthTotals[m].unpaid += rate;
      }
    }
  });

  // Öğrenci ve ay ortalamaları
  period.students.forEach(s => {
    const st = studentTotals[s.id];
    st.avgRate = st.lessons > 0 ? Math.round(st.revenue / st.lessons) : (s.rate || 0);
  });

  MONTHS.forEach(m => {
    const mt = monthTotals[m];
    mt.avgRate = mt.lessons > 0 ? Math.round(mt.revenue / mt.lessons) : 0;
  });

  const avgRate = totalLessons > 0 ? Math.round(totalRevenue / totalLessons) : 0;

  return { totalLessons, totalRevenue, totalPaid, totalUnpaid, avgRate, studentTotals, monthTotals };
}

// UI Render Ana Fonksiyonu
function renderApp() {
  const period = getActivePeriod();
  if (!period) return;

  const totals = calculateTotals(period);

  renderKPIs(totals, period);
  renderDashboard(totals, period);
  renderMatrix(totals, period);
  renderPayments(totals, period);
  renderSchedule(period);
  renderStudents(totals, period);
  renderLessonsList(period);
  renderGoogleCalendarTab();
}

// KPI Kartları
function renderKPIs(totals, period) {
  document.getElementById("kpiTotalRevenue").textContent = formatCurrency(totals.totalRevenue);
  document.getElementById("kpiTotalPaid").textContent = formatCurrency(totals.totalPaid);
  document.getElementById("kpiTotalUnpaid").textContent = formatCurrency(totals.totalUnpaid);
  document.getElementById("kpiTotalLessons").textContent = totals.totalLessons + " Ders";
  document.getElementById("kpiActiveStudents").textContent = period.students.length + " Öğrenci";
}

// Dashboard Görünümü
function renderDashboard(totals, period) {
  renderTopStudentsTable(totals, period);
  renderCharts(totals, period);
}

function renderTopStudentsTable(totals, period) {
  const tbody = document.getElementById("topStudentsTableBody");
  if (!tbody) return;

  const sortedStudents = [...period.students].sort((a, b) => {
    return (totals.studentTotals[b.id]?.revenue || 0) - (totals.studentTotals[a.id]?.revenue || 0);
  });

  tbody.innerHTML = sortedStudents.map((s, idx) => {
    const st = totals.studentTotals[s.id] || { lessons: 0, revenue: 0, paid: 0, unpaid: 0, avgRate: 0 };
    const pct = totals.totalRevenue > 0 ? Math.round((st.revenue / totals.totalRevenue) * 100) : 0;
    
    const paymentStatusBadge = st.unpaid > 0 
      ? `<span class="payment-badge unpaid">🔴 ${formatCurrency(st.unpaid)} Borç</span>`
      : `<span class="payment-badge paid">🟢 Tamamı Ödendi</span>`;

    return `
      <tr>
        <td style="font-weight: 700; color: var(--slate-500); width: 35px;">#${idx + 1}</td>
        <td>
          <div style="font-weight: 700; color: var(--slate-900);">${escapeHtml(s.name)}</div>
          <div style="font-size: 0.75rem; color: var(--slate-500);">${escapeHtml(s.grade || '')} ${s.note ? '• ' + escapeHtml(s.note) : ''}</div>
        </td>
        <td class="tabular-nums" style="text-align: right; font-weight: 600;">${st.lessons} ders</td>
        <td class="tabular-nums" style="text-align: right; font-weight: 700; color: var(--primary);">${formatCurrency(st.revenue)}</td>
        <td class="tabular-nums" style="text-align: right; font-weight: 600; color: var(--success);">${formatCurrency(st.paid)}</td>
        <td style="text-align: center;">${paymentStatusBadge}</td>
        <td style="width: 100px;">
          <div style="background: var(--slate-100); height: 6px; border-radius: 99px; overflow: hidden;">
            <div style="background: var(--primary); height: 100%; width: ${pct}%;"></div>
          </div>
        </td>
      </tr>
    `;
  }).join("");
}

function renderCharts(totals, period) {
  const revLabels = MONTHS;
  const revData = MONTHS.map(m => totals.monthTotals[m]?.revenue || 0);
  const lessonsData = MONTHS.map(m => totals.monthTotals[m]?.lessons || 0);

  const ctxRev = document.getElementById("chartMonthlyRevenue");
  if (ctxRev && window.Chart) {
    if (appState.charts.revenue) {
      appState.charts.revenue.destroy();
    }
    appState.charts.revenue = new Chart(ctxRev, {
      type: "bar",
      data: {
        labels: revLabels,
        datasets: [
          {
            label: "Aylık Gelir (₺)",
            data: revData,
            backgroundColor: "#4f46e5",
            borderRadius: 6,
            yAxisID: "y"
          },
          {
            label: "Ders Sayısı",
            data: lessonsData,
            type: "line",
            borderColor: "#10b981",
            backgroundColor: "#10b981",
            borderWidth: 2,
            pointRadius: 4,
            yAxisID: "y1"
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: "top" },
          tooltip: {
            callbacks: {
              label: function(context) {
                if (context.dataset.yAxisID === "y") {
                  return context.dataset.label + ": " + formatCurrency(context.parsed.y);
                }
                return context.dataset.label + ": " + context.parsed.y + " ders";
              }
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              callback: val => val >= 1000 ? (val/1000) + "k ₺" : val + " ₺"
            }
          },
          y1: {
            beginAtZero: true,
            position: "right",
            grid: { drawOnChartArea: false },
            ticks: { stepSize: 5 }
          }
        }
      }
    });
  }

  const ctxStudents = document.getElementById("chartStudentDist");
  if (ctxStudents && window.Chart) {
    if (appState.charts.students) {
      appState.charts.students.destroy();
    }

    const paidVal = totals.totalPaid;
    const unpaidVal = totals.totalUnpaid;

    appState.charts.students = new Chart(ctxStudents, {
      type: "doughnut",
      data: {
        labels: ["Tahsil Edilen (Yatan)", "Bekleyen (Yatırılmayan)"],
        datasets: [{
          data: [paidVal, unpaidVal],
          backgroundColor: ["#10b981", "#ef4444"],
          borderWidth: 2,
          borderColor: "#ffffff"
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: "bottom" },
          tooltip: {
            callbacks: {
              label: function(ctx) {
                return ctx.label + ": " + formatCurrency(ctx.parsed);
              }
            }
          }
        },
        cutout: "65%"
      }
    });
  }
}

// --------------------------------------------------------------------------
// GOOGLE TAKVİM ENTEGRASYONU FONKSİYONLARI
// --------------------------------------------------------------------------
function createGoogleCalendarUrl(lesson, student) {
  const sName = student ? student.name : "Öğrenci";
  const sGrade = student?.grade ? ` (${student.grade})` : "";
  const title = encodeURIComponent(`Özel Ders: ${sName}${sGrade}`);

  const dateStr = lesson.date.replace(/-/g, "");
  const timeStr = (lesson.time || "14:00").replace(/:/g, "") + "00";
  
  const duration = parseInt(lesson.duration || 60, 10);
  const startHour = parseInt((lesson.time || "14:00").split(":")[0], 10);
  const startMin = parseInt((lesson.time || "14:00").split(":")[1], 10);

  const totalMin = startHour * 60 + startMin + duration;
  const endHour = Math.floor(totalMin / 60) % 24;
  const endMin = totalMin % 60;
  const endTimeStr = String(endHour).padStart(2, "0") + String(endMin).padStart(2, "0") + "00";

  const datesParam = `${dateStr}T${timeStr}/${dateStr}T${endTimeStr}`;

  const detailsText = 
    `🎓 ÖZEL DERS DETAYLARI\n` +
    `--------------------------\n` +
    `Öğrenci: ${sName}${sGrade}\n` +
    `Ders Ücreti: ${formatCurrency(lesson.rate)}\n` +
    `Ödeme Durumu: ${lesson.isPaid ? '🟢 Ödendi (Yatırıldı)' : '🔴 Yatırılmadı (Bekliyor)'}\n` +
    (lesson.note ? `Konu / Not: ${lesson.note}\n` : '') +
    `--------------------------\n` +
    `DersTakip Pro ile kaydedildi.`;

  const detailsParam = encodeURIComponent(detailsText);

  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${datesParam}&details=${detailsParam}&ctz=Europe%2FIstanbul`;
}

function openGoogleCalendarForLesson(lessonId) {
  const period = getActivePeriod();
  if (!period || !period.lessons) return;

  const lesson = period.lessons.find(l => l.id === lessonId);
  if (!lesson) return;

  const student = period.students.find(s => s.id === lesson.studentId);
  const url = createGoogleCalendarUrl(lesson, student);

  window.open(url, "_blank");
  showToast("Google Takvim etkinlik sayfası açıldı!");
}

function openGoogleCalendarForCurrentEditLesson() {
  const period = getActivePeriod();
  if (!period) return;
  const lessonId = document.getElementById("editLessonId")?.value;
  const sId = document.getElementById("editLessonStudentSelect")?.value;
  const dVal = document.getElementById("editLessonDateInput")?.value;
  const tVal = document.getElementById("editLessonTimeInput")?.value || "14:00";
  const rVal = parseFloat(document.getElementById("editLessonRateInput")?.value) || 0;
  const isPaid = document.getElementById("editLessonPaidSelect")?.value === "paid";
  const note = document.getElementById("editLessonNoteInput")?.value;

  const student = period.students.find(s => s.id === sId);
  const tempLesson = {
    id: lessonId,
    studentId: sId,
    date: dVal,
    time: tVal,
    duration: 60,
    rate: rVal,
    isPaid: isPaid,
    note: note
  };
  const gCalUrl = createGoogleCalendarUrl(tempLesson, student);
  window.open(gCalUrl, "_blank");
  showToast("Google Takvim etkinlik sayfası açıldı!");
}

function exportToGoogleCalendarICS() {
  const period = getActivePeriod();
  if (!period) return;

  const lessons = period.lessons || [];
  if (lessons.length === 0) {
    alert("Dışa aktarılacak kayıtlı ders bulunamadı.");
    return;
  }

  let ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//DersTakip Pro//Google Takvim Entegrasyonu//TR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:DersTakip Pro (${period.name})`,
    "X-WR-TIMEZONE:Europe/Istanbul",
    "BEGIN:VTIMEZONE",
    "TZID:Europe/Istanbul",
    "X-LIC-LOCATION:Europe/Istanbul",
    "BEGIN:STANDARD",
    "TZOFFSETFROM:+0300",
    "TZOFFSETTO:+0300",
    "TZNAME:TRT",
    "DTSTART:19700101T000000",
    "END:STANDARD",
    "END:VTIMEZONE"
  ];

  lessons.forEach(l => {
    const s = period.students.find(st => st.id === l.studentId);
    const sName = s ? s.name : "Öğrenci";
    const dateClean = l.date.replace(/-/g, "");
    const timeClean = (l.time || "14:00").replace(/:/g, "") + "00";

    const duration = parseInt(l.duration || 60, 10);
    const startHour = parseInt((l.time || "14:00").split(":")[0], 10);
    const startMin = parseInt((l.time || "14:00").split(":")[1], 10);
    const totalMin = startHour * 60 + startMin + duration;
    const endHour = Math.floor(totalMin / 60) % 24;
    const endMin = totalMin % 60;
    const endTimeClean = String(endHour).padStart(2, "0") + String(endMin).padStart(2, "0") + "00";

    ics.push("BEGIN:VEVENT");
    ics.push(`UID:lesson_${l.id}_${dateClean}@derstakip.pro`);
    ics.push(`DTSTAMP:${new Date().toISOString().replace(/[-:]/g, "").split(".")[0]}Z`);
    ics.push(`DTSTART;TZID=Europe/Istanbul:${dateClean}T${timeClean}`);
    ics.push(`DTEND;TZID=Europe/Istanbul:${dateClean}T${endTimeClean}`);
    ics.push(`SUMMARY:Özel Ders: ${sName}`);
    ics.push(`DESCRIPTION:Öğrenci: ${sName}\\nÜcret: ${l.rate} ₺\\nÖdeme: ${l.isPaid ? 'Ödendi' : 'Yatırılmadı'}\\n${l.note || ''}`);
    ics.push("STATUS:CONFIRMED");
    ics.push("END:VEVENT");
  });

  ics.push("END:VCALENDAR");

  const icsContent = ics.join("\r\n");
  const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `GoogleTakvim_${period.id}_Dersler.ics`;
  a.click();
  URL.revokeObjectURL(url);

  showToast(`${period.name} dersleri (.ics) indirildi!`);
}

function exportAllPeriodsToGoogleCalendarICS() {
  if (!appState.data || !appState.data.periods) return;

  let ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//DersTakip Pro//Google Takvim Entegrasyonu//TR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:DersTakip Pro - Tüm Özel Dersler",
    "X-WR-TIMEZONE:Europe/Istanbul",
    "BEGIN:VTIMEZONE",
    "TZID:Europe/Istanbul",
    "X-LIC-LOCATION:Europe/Istanbul",
    "BEGIN:STANDARD",
    "TZOFFSETFROM:+0300",
    "TZOFFSETTO:+0300",
    "TZNAME:TRT",
    "DTSTART:19700101T000000",
    "END:STANDARD",
    "END:VTIMEZONE"
  ];

  let totalLessonsCount = 0;

  appState.data.periods.forEach(period => {
    ensureLessonsArray(period);
    const lessons = period.lessons || [];

    lessons.forEach(l => {
      totalLessonsCount++;
      const s = period.students.find(st => st.id === l.studentId);
      const sName = s ? s.name : "Öğrenci";
      const sGrade = s?.grade ? ` (${s.grade})` : "";
      const dateClean = l.date.replace(/-/g, "");
      const timeClean = (l.time || "14:00").replace(/:/g, "") + "00";

      const duration = parseInt(l.duration || 60, 10);
      const startHour = parseInt((l.time || "14:00").split(":")[0], 10);
      const startMin = parseInt((l.time || "14:00").split(":")[1], 10);
      const totalMin = startHour * 60 + startMin + duration;
      const endHour = Math.floor(totalMin / 60) % 24;
      const endMin = totalMin % 60;
      const endTimeClean = String(endHour).padStart(2, "0") + String(endMin).padStart(2, "0") + "00";

      ics.push("BEGIN:VEVENT");
      ics.push(`UID:lesson_${period.id}_${l.studentId}_${l.date.replace(/-/g, '')}_${l.id}@derstakip.pro`);
      ics.push(`DTSTAMP:${new Date().toISOString().replace(/[-:]/g, "").split(".")[0]}Z`);
      ics.push(`DTSTART;TZID=Europe/Istanbul:${dateClean}T${timeClean}`);
      ics.push(`DTEND;TZID=Europe/Istanbul:${dateClean}T${endTimeClean}`);
      ics.push(`SUMMARY:Özel Ders: ${sName}${sGrade}`);
      ics.push(`DESCRIPTION:Öğrenci: ${sName}${sGrade}\\nDönem: ${period.name}\\nÜcret: ${l.rate} ₺\\nÖdeme: ${l.isPaid ? 'Ödendi' : 'Yatırılmadı'}\\n${l.note || ''}`);
      ics.push("STATUS:CONFIRMED");
      ics.push("END:VEVENT");
    });
  });

  ics.push("END:VCALENDAR");

  const icsContent = ics.join("\r\n");
  const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Tum_Dersler_Google_Takvim.ics`;
  a.click();
  URL.revokeObjectURL(url);

  showToast(`Tüm yıllara ait ${totalLessonsCount} ders indirildi! Google Takvim İçe Aktar sayfasını açabilirsiniz.`);
}

function openGoogleCalendarImportPage() {
  window.open("https://calendar.google.com/calendar/u/0/r/settings/export", "_blank");
}

function renderGoogleCalendarTab() {
  const container = document.getElementById("gcalEmbedContainer");
  const emailInput = document.getElementById("gcalEmailInput");
  if (!container) return;

  if (emailInput && !emailInput.value && appState.gcalEmail) {
    emailInput.value = appState.gcalEmail;
  }

  const email = appState.gcalEmail || "";
  if (email && email.includes("@")) {
    const encoded = encodeURIComponent(email);
    container.innerHTML = `
      <iframe src="https://calendar.google.com/calendar/embed?src=${encoded}&ctz=Europe%2FIstanbul" 
              style="border: 0; width: 100%; height: 680px;" frameborder="0" scrolling="no"></iframe>
    `;
  } else {
    container.innerHTML = `
      <div style="padding: 3.5rem 1.5rem; text-align: center; color: var(--slate-600);">
        <div style="font-size: 3rem; margin-bottom: 1rem;">📅</div>
        <h3 style="font-size: 1.2rem; font-weight: 700; color: var(--slate-800); margin-bottom: 0.5rem;">
          Google Takvim Hesabınızı Bağlayın
        </h3>
        <p style="max-width: 500px; margin: 0 auto 1.5rem auto; font-size: 0.9rem; color: var(--slate-500);">
          Google Takviminizin burada canlı olarak görünmesi için Gmail adresinizi yukarıdaki kutucuğa yazıp <strong>"Kaydet"</strong>e basabilirsiniz.
        </p>
        <button class="btn btn-google" onclick="window.open('https://calendar.google.com', '_blank')">
          🌐 Google Takvim'i Yeni Sekmede Aç (calendar.google.com)
        </button>
      </div>
    `;
  }
}

function handleSaveGCalEmail() {
  const emailInput = document.getElementById("gcalEmailInput");
  if (!emailInput) return;
  const val = emailInput.value.trim();
  appState.gcalEmail = val;
  localStorage.setItem("DERS_TAKIP_GCAL_EMAIL", val);
  renderGoogleCalendarTab();
  showToast("Google Takvim adresi güncellendi!");
}

// --------------------------------------------------------------------------
// GEÇMİŞ DERSLERİ DÜZENLEME & SİLME MODALI (FİYAT VE TARİH DEĞİŞTİRME)
// --------------------------------------------------------------------------

/**
 * Geçmiş dersin id'sine göre düzenleme modalını açar
 */
function openEditLessonModal(lessonId) {
  const period = getActivePeriod();
  if (!period || !period.lessons) return;

  const lesson = period.lessons.find(l => l.id === lessonId);
  if (!lesson) return;

  // Öğrenci seçiciyi doldur
  const sSelect = document.getElementById("editLessonStudentSelect");
  if (sSelect) {
    sSelect.innerHTML = period.students.map(s => `
      <option value="${s.id}" ${s.id === lesson.studentId ? 'selected' : ''}>
        ${escapeHtml(s.name)} (${formatCurrency(s.rate)} / Ders)
      </option>
    `).join("");
  }

  document.getElementById("editLessonId").value = lesson.id;
  document.getElementById("editLessonDateInput").value = lesson.date;
  document.getElementById("editLessonTimeInput").value = lesson.time || "14:00";
  document.getElementById("editLessonRateInput").value = lesson.rate;
  document.getElementById("editLessonPaidSelect").value = lesson.isPaid ? "paid" : "unpaid";
  document.getElementById("editLessonNoteInput").value = lesson.note || "";

  openModal("modalEditLesson");
}

/**
 * Öğrenci ve tarih bilgisiyle geçmiş dersi bulup düzenleme modalını açar
 */
function openEditLessonModalByStudentDate(studentId, dateVal) {
  const period = getActivePeriod();
  if (!period) return;

  if (!period.lessons) ensureLessonsArray(period);

  let lesson = period.lessons.find(l => l.studentId === studentId && l.date === dateVal);
  if (!lesson) {
    // Eğer henüz id atanmamışsa dinamik olarak oluştur
    const s = period.students.find(st => st.id === studentId);
    const mIdx = parseInt(dateVal.split("-")[1], 10);
    const mName = MONTH_MAP[mIdx] || "Eylül";
    lesson = {
      id: "les_" + Date.now(),
      studentId: studentId,
      date: dateVal,
      time: "14:00",
      duration: 60,
      month: mName,
      rate: s?.rate || 3000,
      isPaid: true,
      paidDate: dateVal,
      note: ""
    };
    period.lessons.push(lesson);
  }

  openEditLessonModal(lesson.id);
}

/**
 * Geçmiş dersin fiyat, tarih, saat ve ödeme değişikliklerini kaydeder
 */
function handleSaveEditLesson(event) {
  event.preventDefault();
  const period = getActivePeriod();
  if (!period || !period.lessons) return;

  const lessonId = document.getElementById("editLessonId").value;
  const newStudentId = document.getElementById("editLessonStudentSelect").value;
  const newDate = document.getElementById("editLessonDateInput").value;
  const newTime = document.getElementById("editLessonTimeInput").value || "14:00";
  const newRate = parseFloat(document.getElementById("editLessonRateInput").value) || 0;
  const newPaid = document.getElementById("editLessonPaidSelect").value === "paid";
  const newNote = document.getElementById("editLessonNoteInput").value.trim();

  const lesson = period.lessons.find(l => l.id === lessonId);
  if (!lesson) return;

  const oldStudentId = lesson.studentId;
  const oldDate = lesson.date;
  const oldRate = parseFloat(lesson.rate) || 0;
  const oldMonth = lesson.month;

  const newMonthIdx = parseInt(newDate.split("-")[1], 10);
  const newMonth = MONTH_MAP[newMonthIdx] || "Eylül";

  // 1. lessonDates dizisini güncelle (eski tarihi çıkar, yeni tarihi ekle)
  if (period.lessonDates) {
    if (period.lessonDates[oldStudentId]) {
      const idx = period.lessonDates[oldStudentId].indexOf(oldDate);
      if (idx !== -1) period.lessonDates[oldStudentId].splice(idx, 1);
    }
    if (!period.lessonDates[newStudentId]) period.lessonDates[newStudentId] = [];
    period.lessonDates[newStudentId].push(newDate);
    period.lessonDates[newStudentId].sort();
  }

  // 2. monthlyLessons ve monthlyRevenue matrislerini güncelle
  if (period.monthlyLessons) {
    // Eski aydan düş
    if (period.monthlyLessons[oldMonth] && period.monthlyLessons[oldMonth][oldStudentId]) {
      period.monthlyLessons[oldMonth][oldStudentId] = Math.max(0, period.monthlyLessons[oldMonth][oldStudentId] - 1);
    }
    // Yeni aya ekle
    if (!period.monthlyLessons[newMonth]) period.monthlyLessons[newMonth] = {};
    period.monthlyLessons[newMonth][newStudentId] = (period.monthlyLessons[newMonth][newStudentId] || 0) + 1;
  }

  if (period.monthlyRevenue) {
    // Eski aydan düş
    if (period.monthlyRevenue[oldMonth] && period.monthlyRevenue[oldMonth][oldStudentId]) {
      period.monthlyRevenue[oldMonth][oldStudentId] = Math.max(0, period.monthlyRevenue[oldMonth][oldStudentId] - oldRate);
    }
    // Yeni aya ekle
    if (!period.monthlyRevenue[newMonth]) period.monthlyRevenue[newMonth] = {};
    period.monthlyRevenue[newMonth][newStudentId] = (period.monthlyRevenue[newMonth][newStudentId] || 0) + newRate;
  }

  // 3. Ders nesnesini güncelle
  lesson.studentId = newStudentId;
  lesson.date = newDate;
  lesson.time = newTime;
  lesson.month = newMonth;
  lesson.rate = newRate;
  lesson.isPaid = newPaid;
  lesson.paidDate = newPaid ? (lesson.paidDate || newDate) : "";
  lesson.note = newNote;

  saveData();
  closeModal("modalEditLesson");
  renderApp();
  showToast("Dersin fiyat ve tarih bilgileri başarıyla güncellendi!");
}

/**
 * Düzenleme modalından dersi tamamen siler
 */
function handleDeleteCurrentLesson() {
  const period = getActivePeriod();
  if (!period || !period.lessons) return;

  const lessonId = document.getElementById("editLessonId").value;
  const lesson = period.lessons.find(l => l.id === lessonId);
  if (!lesson) return;

  if (!confirm(`Bu ders kaydını silmek istediğinize emin misiniz?\n\nTarih: ${formatDateTurkish(lesson.date)}\nÜcret: ${formatCurrency(lesson.rate)}`)) {
    return;
  }

  const sId = lesson.studentId;
  const dVal = lesson.date;
  const m = lesson.month;
  const r = parseFloat(lesson.rate) || 0;

  // 1. lessons dizisinden sil
  const idx = period.lessons.findIndex(l => l.id === lessonId);
  if (idx !== -1) period.lessons.splice(idx, 1);

  // 2. lessonDates'den sil
  if (period.lessonDates && period.lessonDates[sId]) {
    const dIdx = period.lessonDates[sId].indexOf(dVal);
    if (dIdx !== -1) period.lessonDates[sId].splice(dIdx, 1);
  }

  // 3. Matrislerden düş
  if (period.monthlyLessons && period.monthlyLessons[m] && period.monthlyLessons[m][sId]) {
    period.monthlyLessons[m][sId] = Math.max(0, period.monthlyLessons[m][sId] - 1);
  }
  if (period.monthlyRevenue && period.monthlyRevenue[m] && period.monthlyRevenue[m][sId]) {
    period.monthlyRevenue[m][sId] = Math.max(0, period.monthlyRevenue[m][sId] - r);
  }

  saveData();
  closeModal("modalEditLesson");
  renderApp();
  showToast("Ders kaydı başarıyla silindi!");
}

// --------------------------------------------------------------------------
// ÖDEME VE TAHSİLAT KONTROL PANELİ
// --------------------------------------------------------------------------
function renderPayments(totals, period) {
  const sTableBody = document.getElementById("studentPaymentsSummaryBody");
  if (sTableBody) {
    sTableBody.innerHTML = period.students.map(s => {
      const st = totals.studentTotals[s.id] || { lessons: 0, revenue: 0, paid: 0, unpaid: 0 };
      const statusBadge = st.unpaid > 0
        ? `<span class="payment-badge unpaid">🔴 ${formatCurrency(st.unpaid)} Yatırılmadı</span>`
        : `<span class="payment-badge paid">🟢 Ödendi</span>`;

      return `
        <tr>
          <td>
            <div style="font-weight: 700; color: var(--slate-900);">${escapeHtml(s.name)}</div>
            <div style="font-size: 0.75rem; color: var(--slate-500);">${escapeHtml(s.grade || '')}</div>
          </td>
          <td class="tabular-nums" style="text-align: right; font-weight: 600; color: var(--slate-700);">
            ${formatCurrency(s.rate || 0)} / Ders
          </td>
          <td class="tabular-nums" style="text-align: right; font-weight: 700;">${st.lessons} ders</td>
          <td class="tabular-nums" style="text-align: right; font-weight: 700; color: var(--primary);">
            ${formatCurrency(st.revenue)}
          </td>
          <td class="tabular-nums" style="text-align: right; font-weight: 700; color: var(--success);">
            ${formatCurrency(st.paid)}
          </td>
          <td class="tabular-nums" style="text-align: right; font-weight: 800; color: ${st.unpaid > 0 ? 'var(--danger)' : 'var(--slate-400)'};">
            ${formatCurrency(st.unpaid)}
          </td>
          <td style="text-align: center;">${statusBadge}</td>
          <td style="text-align: right;">
            <button class="btn btn-secondary" style="padding: 3px 8px; font-size: 0.775rem;" onclick="viewStudentDetails('${s.id}')">
              Döküm Gör
            </button>
          </td>
        </tr>
      `;
    }).join("");
  }

  const pTableBody = document.getElementById("lessonsPaymentTableBody");
  if (!pTableBody) return;

  const pStudentSelect = document.getElementById("filterPaymentStudentSelect");
  if (pStudentSelect && pStudentSelect.options.length <= 1) {
    pStudentSelect.innerHTML = `<option value="all">Tüm Öğrenciler</option>` + period.students.map(s => `
      <option value="${s.id}">${escapeHtml(s.name)}</option>
    `).join("");
  }

  let lessons = [...(period.lessons || [])];

  if (appState.paymentFilter === "paid") {
    lessons = lessons.filter(l => l.isPaid);
  } else if (appState.paymentFilter === "unpaid") {
    lessons = lessons.filter(l => !l.isPaid);
  }

  if (appState.paymentStudentFilter !== "all") {
    lessons = lessons.filter(l => l.studentId === appState.paymentStudentFilter);
  }

  lessons.sort((a, b) => b.date.localeCompare(a.date));

  if (lessons.length === 0) {
    pTableBody.innerHTML = `
      <tr><td colspan="9" style="text-align: center; color: var(--slate-400); padding: 2rem;">
        Seçilen filtreye uygun ders kaydı bulunamadı.
      </td></tr>
    `;
    return;
  }

  pTableBody.innerHTML = lessons.map((l, idx) => {
    const s = period.students.find(st => st.id === l.studentId);
    const sName = s ? s.name : l.studentId;

    const toggleBtn = l.isPaid
      ? `<button class="btn-toggle-pay is-paid" onclick="toggleLessonPayment('${l.id}')" title="Durumu 'Yatırılmadı' yapmak için tıklayın">🟢 Ödendi</button>`
      : `<button class="btn-toggle-pay is-unpaid" onclick="toggleLessonPayment('${l.id}')" title="Durumu 'Ödendi' yapmak için tıklayın">🔴 Yatırılmadı</button>`;

    return `
      <tr>
        <td style="font-weight: 700; color: var(--slate-500); width: 40px;">#${lessons.length - idx}</td>
        <td style="font-weight: 600;">${formatDateTurkish(l.date)}</td>
        <td style="font-weight: 700; color: var(--slate-900);">${escapeHtml(sName)}</td>
        <td><span class="badge badge-blue">${l.month}</span></td>
        <td class="tabular-nums" style="text-align: right; font-weight: 700; color: var(--primary);">${formatCurrency(l.rate)}</td>
        <td style="text-align: center;">${toggleBtn}</td>
        <td style="text-align: center;">
          <button class="btn btn-secondary" style="padding: 3px 8px; font-size: 0.775rem;" onclick="openEditLessonModal('${l.id}')" title="Fiyat ve Tarih Değiştir">
            ✏️ Düzenle
          </button>
        </td>
        <td style="text-align: center;">
          <button class="btn-gcal-action" onclick="openGoogleCalendarForLesson('${l.id}')" title="Google Takvim'e Ekle">
            📅 Takvim
          </button>
        </td>
        <td style="font-size: 0.8rem; color: var(--slate-500);">${escapeHtml(l.note || '—')}</td>
      </tr>
    `;
  }).join("");
}

function toggleLessonPayment(lessonId) {
  const period = getActivePeriod();
  if (!period || !period.lessons) return;

  const lesson = period.lessons.find(l => l.id === lessonId);
  if (!lesson) return;

  lesson.isPaid = !lesson.isPaid;
  if (lesson.isPaid) {
    lesson.paidDate = new Date().toISOString().split("T")[0];
    showToast(`Ders ücreti ödendi olarak işaretlendi (${formatCurrency(lesson.rate)})`);
  } else {
    lesson.paidDate = "";
    showToast(`Ders ücreti 'Yatırılmadı / Bekliyor' olarak işaretlendi`);
  }

  saveData();
  renderApp();
}

function setPaymentFilter(filter) {
  appState.paymentFilter = filter;
  document.querySelectorAll(".payment-filter-btn").forEach(btn => {
    btn.classList.toggle("active", btn.getAttribute("data-filter") === filter);
  });
  const period = getActivePeriod();
  const totals = calculateTotals(period);
  renderPayments(totals, period);
}

function handlePaymentStudentFilterChange(select) {
  appState.paymentStudentFilter = select.value;
  const period = getActivePeriod();
  const totals = calculateTotals(period);
  renderPayments(totals, period);
}

// --------------------------------------------------------------------------
// AYLIK DERS SAYILARI MATRİSİ (Aylık kaç ders yapıldığı tablosu)
// --------------------------------------------------------------------------
function renderMatrix(totals, period) {
  const headerRow = document.getElementById("matrixHeaderRow");
  const tbody = document.getElementById("matrixBody");
  const footerRow = document.getElementById("matrixFooterRow");
  const avgRow = document.getElementById("matrixAvgRow");
  const title = document.getElementById("matrixActiveTitle");

  if (!headerRow || !tbody) return;

  const isRevenue = appState.matrixMode === "revenue";
  title.textContent = isRevenue ? "Aylık Gelirler Matrisi (₺)" : "Aylık Kaç Ders Yapıldığı Tablosu";

  headerRow.innerHTML = `
    <th>Ay</th>
    <th style="background: var(--primary-light); color: var(--primary); text-align: right;">TOPLAM</th>
    ${period.students.map(s => `
      <th style="text-align: right;" title="${escapeHtml(s.name)} - Ücret: ${formatCurrency(s.rate)}">
        <div>${escapeHtml(s.name)}</div>
        <div style="font-size: 0.65rem; font-weight: 500; color: var(--slate-500);">${formatCurrency(s.rate)}/ders</div>
      </th>
    `).join("")}
  `;

  tbody.innerHTML = MONTHS.map(m => {
    const mTotal = totals.monthTotals[m] || { lessons: 0, revenue: 0 };
    const rowTotalFormatted = isRevenue ? formatCurrency(mTotal.revenue) : (mTotal.lessons + " ders");

    return `
      <tr>
        <td style="font-weight: 700;">${m}</td>
        <td class="tabular-nums" style="font-weight: 700; background: var(--primary-light); color: var(--primary); text-align: right;">
          ${rowTotalFormatted}
        </td>
        ${period.students.map(s => {
          const lessonsInMonth = (period.lessons || []).filter(l => l.studentId === s.id && l.month === m);
          const lessonCount = lessonsInMonth.length > 0 
            ? lessonsInMonth.length 
            : (period.monthlyLessons[m]?.[s.id] || 0);

          const revenueInMonth = lessonsInMonth.length > 0
            ? lessonsInMonth.reduce((acc, l) => acc + (parseFloat(l.rate) || 0), 0)
            : (period.monthlyRevenue[m]?.[s.id] || 0);

          const val = isRevenue ? revenueInMonth : lessonCount;
          const displayVal = isRevenue ? (val > 0 ? formatNumber(val) : "0") : (val > 0 ? val : "0");
          const hasValClass = val > 0 ? "has-val" : "zero";

          return `
            <td class="matrix-cell tabular-nums ${hasValClass}" 
                onclick="editMatrixCell(this, '${m}', '${s.id}', ${val}, '${appState.matrixMode}')"
                title="${s.name} - ${m} (Tıklayarak Düzenle)">
              ${displayVal}
            </td>
          `;
        }).join("")}
      </tr>
    `;
  }).join("");

  const grandTotal = isRevenue ? formatCurrency(totals.totalRevenue) : (totals.totalLessons + " Ders");
  footerRow.innerHTML = `
    <td>GENEL TOPLAM</td>
    <td class="tabular-nums" style="text-align: right; background: #e0e7ff; color: #3730a3; font-weight: 800;">
      ${grandTotal}
    </td>
    ${period.students.map(s => {
      const st = totals.studentTotals[s.id] || { lessons: 0, revenue: 0 };
      const val = isRevenue ? formatCurrency(st.revenue) : (st.lessons + " ders");
      return `<td class="tabular-nums" style="text-align: right; font-weight: 700;">${val}</td>`;
    }).join("")}
  `;

  if (avgRow) {
    avgRow.innerHTML = `
      <td>Ders Başı Ortalama (₺)</td>
      <td class="tabular-nums" style="text-align: right; font-weight: 700; color: var(--success);">
        ${formatCurrency(totals.avgRate)}
      </td>
      ${period.students.map(s => {
        const st = totals.studentTotals[s.id] || { avgRate: 0 };
        return `<td class="tabular-nums" style="text-align: right; font-size: 0.8rem; color: var(--slate-600);">${formatCurrency(st.avgRate)}</td>`;
      }).join("")}
    `;
  }
}

function editMatrixCell(td, month, studentId, currentVal, mode) {
  if (td.querySelector("input")) return;

  const input = document.createElement("input");
  input.type = "number";
  input.value = currentVal;
  input.min = "0";

  td.textContent = "";
  td.appendChild(input);
  input.focus();
  input.select();

  function finish() {
    const newVal = parseFloat(input.value) || 0;
    const period = getActivePeriod();
    if (!period) return;

    if (mode === "revenue") {
      if (!period.monthlyRevenue[month]) period.monthlyRevenue[month] = {};
      period.monthlyRevenue[month][studentId] = newVal;
    } else {
      if (!period.monthlyLessons[month]) period.monthlyLessons[month] = {};
      period.monthlyLessons[month][studentId] = Math.round(newVal);
    }

    saveData();
    renderApp();
    showToast("Hücre değeri güncellendi: " + newVal);
  }

  input.addEventListener("blur", finish);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      input.blur();
    } else if (e.key === "Escape") {
      td.textContent = mode === "revenue" ? (currentVal > 0 ? formatNumber(currentVal) : "0") : currentVal;
    }
  });
}

// --------------------------------------------------------------------------
// DERS TARİHLERİ ÇİZELGESİ (Tarihe tıklanınca direkt Düzenleme Modalı açılır)
// --------------------------------------------------------------------------
function renderSchedule(period) {
  const container = document.getElementById("scheduleMatrixContainer");
  if (!container) return;

  const datesMap = period.lessonDates || {};
  let maxDates = 0;
  period.students.forEach(s => {
    const dList = datesMap[s.id] || [];
    if (dList.length > maxDates) maxDates = dList.length;
  });

  if (maxDates === 0) maxDates = 5;

  let html = `
    <table class="dates-table">
      <thead>
        <tr>
          <th class="idx-col">#</th>
          ${period.students.map(s => `
            <th>
              <div>${escapeHtml(s.name)}</div>
              <div style="font-size: 0.7rem; font-weight: 500; color: var(--slate-500);">${(datesMap[s.id] || []).length} Ders</div>
            </th>
          `).join("")}
        </tr>
      </thead>
      <tbody>
  `;

  for (let r = 0; r < maxDates; r++) {
    html += `<tr><td class="idx-col">${r + 1}</td>`;
    period.students.forEach(s => {
      const dList = datesMap[s.id] || [];
      const dVal = dList[r];
      if (dVal) {
        const matchingLesson = (period.lessons || []).find(l => l.studentId === s.id && l.date === dVal);
        const isPaid = matchingLesson ? matchingLesson.isPaid : true;
        const rateVal = matchingLesson ? formatCurrency(matchingLesson.rate) : "";
        const statusIcon = isPaid ? "🟢" : "🔴";

        html += `
          <td>
            <span class="date-pill" onclick="openEditLessonModalByStudentDate('${s.id}', '${dVal}')" 
                  title="Fiyat: ${rateVal} (${isPaid ? 'Ödendi' : 'Yatırılmadı'}) - Fiyat ve Tarihi Düzenlemek İçin Tıklayın">
              <span>${statusIcon}</span> ${formatDateTurkish(dVal)}
            </span>
          </td>
        `;
      } else {
        html += `<td style="color: var(--slate-200); font-size: 0.75rem;">—</td>`;
      }
    });
    html += `</tr>`;
  }

  html += `
    <tr style="background: var(--slate-50);">
      <td class="idx-col">+</td>
      ${period.students.map(s => `
        <td>
          <button class="btn btn-secondary" style="padding: 2px 8px; font-size: 0.75rem;" onclick="promptAddDate('${s.id}')">
            + Tarih
          </button>
        </td>
      `).join("")}
    </tr>
  `;

  html += `</tbody></table>`;
  container.innerHTML = html;
}

// --------------------------------------------------------------------------
// ÖĞRENCİ REHBERİ (YENİ ÖĞRENCİ KABULÜ VE ÜCRET BELİRLEME)
// --------------------------------------------------------------------------
function renderStudents(totals, period) {
  const grid = document.getElementById("studentsGrid");
  if (!grid) return;

  grid.innerHTML = period.students.map(s => {
    const st = totals.studentTotals[s.id] || { lessons: 0, revenue: 0, paid: 0, unpaid: 0, avgRate: 0 };
    const dates = period.lessonDates?.[s.id] || [];
    const lastDate = dates.length > 0 ? formatDateTurkish(dates[dates.length - 1]) : "Henüz ders yok";

    const balanceNotice = st.unpaid > 0
      ? `<span class="badge badge-rose">🔴 ${formatCurrency(st.unpaid)} Borç</span>`
      : `<span class="badge badge-green">🟢 Borç Yok</span>`;

    return `
      <div class="student-card">
        <div>
          <div class="student-header">
            <div style="display: flex; gap: 0.75rem; align-items: center;">
              <div class="student-avatar">${s.name.substring(0, 1).toUpperCase()}</div>
              <div class="student-info">
                <h3>${escapeHtml(s.name)}</h3>
                <div style="display: flex; gap: 4px; margin-top: 2px; flex-wrap: wrap;">
                  ${s.grade ? `<span class="badge badge-blue">${escapeHtml(s.grade)}</span>` : ''}
                  <span class="badge badge-amber">${formatCurrency(s.rate || 0)} / Ders</span>
                  ${s.note ? `<span class="badge badge-purple">${escapeHtml(s.note)}</span>` : ''}
                </div>
              </div>
            </div>
            <button class="btn btn-secondary btn-icon" title="Öğrenciyi Düzenle" onclick="openEditStudentModal('${s.id}')">
              ✏️
            </button>
          </div>

          <div class="student-stats">
            <div class="stat-item">
              <div class="stat-num tabular-nums">${st.lessons}</div>
              <div class="stat-desc">Yapılan Ders</div>
            </div>
            <div class="stat-item">
              <div class="stat-num tabular-nums" style="color: var(--primary);">${formatCurrency(st.revenue)}</div>
              <div class="stat-desc">Toplam Tutar</div>
            </div>
            <div class="stat-item">
              <div class="stat-num tabular-nums" style="color: var(--success);">${formatCurrency(st.paid)}</div>
              <div class="stat-desc">Yatırılan</div>
            </div>
          </div>

          <div class="student-payment-bar">
            <span>Ödeme Durumu:</span>
            ${balanceNotice}
          </div>

          <div style="font-size: 0.8rem; color: var(--slate-500); margin-bottom: 0.85rem;">
            📅 Son Ders: <strong>${lastDate}</strong>
          </div>
        </div>

        <div class="student-actions">
          <button class="btn btn-primary" style="flex: 1;" onclick="openAddLessonModal('${s.id}')">
            ➕ Ders Kaydet
          </button>
          <button class="btn btn-secondary" onclick="viewStudentDetails('${s.id}')">
            Detaylar
          </button>
        </div>
      </div>
    `;
  }).join("");
}

// Kronolojik Ders Listesi
function renderLessonsList(period) {
  const tbody = document.getElementById("lessonsListBody");
  if (!tbody) return;

  const lessons = [...(period.lessons || [])];
  lessons.sort((a, b) => b.date.localeCompare(a.date));

  if (lessons.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--slate-400); padding: 2rem;">Henüz kayıtlı ders bulunmuyor.</td></tr>`;
    return;
  }

  tbody.innerHTML = lessons.map((l, idx) => {
    const s = period.students.find(st => st.id === l.studentId);
    const sName = s ? s.name : l.studentId;

    const statusPill = l.isPaid
      ? `<span class="payment-badge paid">🟢 Ödendi</span>`
      : `<span class="payment-badge unpaid">🔴 Yatırılmadı</span>`;

    return `
      <tr>
        <td style="font-weight: 700; color: var(--slate-500); width: 40px;">#${lessons.length - idx}</td>
        <td style="font-weight: 600;">${formatDateTurkish(l.date)}</td>
        <td style="font-weight: 700; color: var(--slate-900);">${escapeHtml(sName)}</td>
        <td><span class="badge badge-blue">${l.month}</span></td>
        <td class="tabular-nums" style="text-align: right; font-weight: 700; color: var(--primary);">${formatCurrency(l.rate)}</td>
        <td style="text-align: center;">${statusPill}</td>
        <td style="text-align: center;">
          <button class="btn btn-secondary" style="padding: 3px 8px; font-size: 0.775rem;" onclick="openEditLessonModal('${l.id}')" title="Fiyat veya Tarih Değiştir">
            ✏️ Düzenle
          </button>
        </td>
        <td style="text-align: center;">
          <button class="btn-gcal-action" onclick="openGoogleCalendarForLesson('${l.id}')" title="Google Takvim'e Ekle">
            📅 Takvim
          </button>
        </td>
      </tr>
    `;
  }).join("");
}

// --------------------------------------------------------------------------
// ETKİNLİK YÖNETİMİ & MODALLAR
// --------------------------------------------------------------------------
function setupEventListeners() {
  document.querySelectorAll(".nav-tab").forEach(tab => {
    tab.addEventListener("click", () => {
      const tabTarget = tab.getAttribute("data-tab");
      switchTab(tabTarget);
    });
  });

  const btnLessons = document.getElementById("btnMatrixLessons");
  const btnRevenue = document.getElementById("btnMatrixRevenue");

  if (btnLessons && btnRevenue) {
    btnLessons.addEventListener("click", () => {
      appState.matrixMode = "lessons";
      btnLessons.classList.add("active");
      btnRevenue.classList.remove("active");
      renderApp();
    });

    btnRevenue.addEventListener("click", () => {
      appState.matrixMode = "revenue";
      btnRevenue.classList.add("active");
      btnLessons.classList.remove("active");
      renderApp();
    });
  }

  const periodSelect = document.getElementById("periodSelect");
  if (periodSelect) {
    periodSelect.addEventListener("change", (e) => {
      if (e.target.value === "NEW_PERIOD") {
        openNewPeriodModal();
        periodSelect.value = appState.activePeriodId;
      } else {
        appState.activePeriodId = e.target.value;
        saveData();
        renderApp();
        showToast("Dönem değiştirildi: " + getActivePeriod().name);
      }
    });
  }

  const lessonStudentSelect = document.getElementById("lessonStudentSelect");
  if (lessonStudentSelect) {
    lessonStudentSelect.addEventListener("change", (e) => {
      updateLessonRateFromSelectedStudent(e.target.value);
    });
  }
}

function updateLessonRateFromSelectedStudent(studentId) {
  const period = getActivePeriod();
  const s = period?.students.find(st => st.id === studentId);
  const rateInput = document.getElementById("lessonRateInput");
  if (s && rateInput) {
    rateInput.value = s.rate || 3500;
  }
}

function switchTab(tabId) {
  appState.activeTab = tabId;
  document.querySelectorAll(".nav-tab").forEach(t => {
    t.classList.toggle("active", t.getAttribute("data-tab") === tabId);
  });
  document.querySelectorAll(".mobile-nav-btn").forEach(t => {
    t.classList.toggle("active", t.getAttribute("data-tab") === "tab-" + tabId);
  });
  document.querySelectorAll(".tab-pane").forEach(p => {
    p.classList.toggle("active", p.id === "tab-" + tabId);
  });
}

function populatePeriodSelect() {
  const select = document.getElementById("periodSelect");
  if (!select || !appState.data) return;

  select.innerHTML = `
    ${appState.data.periods.map(p => `
      <option value="${p.id}" ${p.id === appState.activePeriodId ? 'selected' : ''}>
        📅 ${p.name} ${p.isCurrent ? '(Aktif)' : ''}
      </option>
    `).join("")}
    <option value="NEW_PERIOD">➕ Yeni Dönem Başlat (Yeni Sene)...</option>
  `;
}

function openModal(id) {
  const modal = document.getElementById(id);
  if (modal) modal.classList.add("active");
}

function closeModal(id) {
  const modal = document.getElementById(id);
  if (modal) modal.classList.remove("active");
}

// --------------------------------------------------------------------------
// DERS EKLEME
// --------------------------------------------------------------------------
function openAddLessonModal(preSelectedStudentId = "") {
  const period = getActivePeriod();
  if (!period) return;

  const select = document.getElementById("lessonStudentSelect");
  if (select) {
    select.innerHTML = period.students.map(s => `
      <option value="${s.id}" ${s.id === preSelectedStudentId ? 'selected' : ''}>
        ${escapeHtml(s.name)} (Belirlenen Ücret: ${formatCurrency(s.rate)})
      </option>
    `).join("");

    const targetStudentId = preSelectedStudentId || (period.students[0]?.id || "");
    select.value = targetStudentId;
    updateLessonRateFromSelectedStudent(targetStudentId);
  }

  const dateInput = document.getElementById("lessonDateInput");
  if (dateInput && !dateInput.value) {
    dateInput.value = new Date().toISOString().split("T")[0];
  }

  openModal("modalAddLesson");
}

function handleSaveLesson(event) {
  event.preventDefault();
  const period = getActivePeriod();
  if (!period) return;

  const studentId = document.getElementById("lessonStudentSelect").value;
  const dateVal = document.getElementById("lessonDateInput").value;
  const timeVal = document.getElementById("lessonTimeInput")?.value || "14:00";
  const durationVal = parseInt(document.getElementById("lessonDurationSelect")?.value || 60, 10);
  const rateVal = parseFloat(document.getElementById("lessonRateInput").value) || 0;
  const isPaid = document.getElementById("lessonPaidSelect").value === "paid";
  const noteVal = document.getElementById("lessonNoteInput").value.trim();
  const openInGCal = document.getElementById("lessonAddToGCalCheckbox")?.checked;

  if (!studentId || !dateVal) {
    alert("Lütfen öğrenci ve tarih seçiniz.");
    return;
  }

  const monthIdx = parseInt(dateVal.split("-")[1], 10);
  const targetMonth = MONTH_MAP[monthIdx] || "Eylül";

  // 1. lessons dizisine ekle
  if (!period.lessons) period.lessons = [];
  const newLesson = {
    id: "les_" + Date.now(),
    studentId: studentId,
    date: dateVal,
    time: timeVal,
    duration: durationVal,
    month: targetMonth,
    rate: rateVal,
    isPaid: isPaid,
    paidDate: isPaid ? dateVal : "",
    note: noteVal
  };
  period.lessons.push(newLesson);

  // 2. lessonDates listesine ekle
  if (!period.lessonDates) period.lessonDates = {};
  if (!period.lessonDates[studentId]) period.lessonDates[studentId] = [];
  period.lessonDates[studentId].push(dateVal);
  period.lessonDates[studentId].sort();

  // 3. Aylık matrisleri güncelle
  if (!period.monthlyLessons[targetMonth]) period.monthlyLessons[targetMonth] = {};
  period.monthlyLessons[targetMonth][studentId] = (period.monthlyLessons[targetMonth][studentId] || 0) + 1;

  if (!period.monthlyRevenue[targetMonth]) period.monthlyRevenue[targetMonth] = {};
  period.monthlyRevenue[targetMonth][studentId] = (period.monthlyRevenue[targetMonth][studentId] || 0) + rateVal;

  saveData();
  closeModal("modalAddLesson");
  renderApp();

  showToast(`Ders kaydedildi! (${isPaid ? '🟢 Ödendi' : '🔴 Yatırılmadı'})`);

  if (openInGCal) {
    const student = period.students.find(s => s.id === studentId);
    const gCalUrl = createGoogleCalendarUrl(newLesson, student);
    window.open(gCalUrl, "_blank");
  }
}

// --------------------------------------------------------------------------
// YENİ ÖĞRENCİ KABULÜ & DERS PARASI BELİRLEME
// --------------------------------------------------------------------------
function openAddStudentModal() {
  document.getElementById("formStudent").reset();
  document.getElementById("studentEditId").value = "";
  document.getElementById("studentRateInput").value = "3500";
  document.getElementById("modalStudentTitle").textContent = "👤 Yeni Öğrenci Kabulü ve Ücret Belirleme";
  openModal("modalStudent");
}

function openEditStudentModal(studentId) {
  const period = getActivePeriod();
  const s = period?.students.find(st => st.id === studentId);
  if (!s) return;

  document.getElementById("studentEditId").value = s.id;
  document.getElementById("studentNameInput").value = s.name;
  document.getElementById("studentGradeInput").value = s.grade || "";
  document.getElementById("studentRateInput").value = s.rate || 0;
  document.getElementById("studentPhoneInput").value = s.phone || "";
  document.getElementById("studentNoteInput").value = s.note || "";
  document.getElementById("modalStudentTitle").textContent = "Öğrenciyi Düzenle: " + s.name;

  openModal("modalStudent");
}

function handleSaveStudent(event) {
  event.preventDefault();
  const period = getActivePeriod();
  if (!period) return;

  const editId = document.getElementById("studentEditId").value;
  const name = document.getElementById("studentNameInput").value.trim();
  const grade = document.getElementById("studentGradeInput").value.trim();
  const rate = parseFloat(document.getElementById("studentRateInput").value) || 0;
  const phone = document.getElementById("studentPhoneInput").value.trim();
  const note = document.getElementById("studentNoteInput").value.trim();

  if (!name) {
    alert("Öğrenci adı boş bırakılamaz.");
    return;
  }

  if (editId) {
    const s = period.students.find(st => st.id === editId);
    if (s) {
      s.name = name;
      s.grade = grade;
      s.rate = rate;
      s.phone = phone;
      s.note = note;
    }
    showToast("Öğrenci bilgileri güncellendi!");
  } else {
    const newId = name.toLowerCase().replace(/[^a-z0-9]/g, "") + "_" + Date.now().toString().slice(-4);
    period.students.push({
      id: newId,
      name: name,
      grade: grade,
      rate: rate,
      phone: phone,
      note: note
    });

    if (!period.lessonDates) period.lessonDates = {};
    period.lessonDates[newId] = [];

    showToast(`Yeni öğrenci "${name}" kaydedildi! Belirlenen ücret: ${formatCurrency(rate)}`);
  }

  saveData();
  closeModal("modalStudent");
  renderApp();
}

function viewStudentDetails(studentId) {
  const period = getActivePeriod();
  const s = period?.students.find(st => st.id === studentId);
  if (!s) return;

  const totals = calculateTotals(period);
  const st = totals.studentTotals[studentId] || { lessons: 0, revenue: 0, paid: 0, unpaid: 0, avgRate: 0 };
  const studentLessons = (period.lessons || []).filter(l => l.studentId === studentId);
  studentLessons.sort((a, b) => b.date.localeCompare(a.date));

  let html = `
    <div style="margin-bottom: 1.25rem;">
      <h2 style="font-size: 1.35rem; font-weight: 800; color: var(--slate-900);">${escapeHtml(s.name)}</h2>
      <div style="display: flex; gap: 6px; margin-top: 4px; flex-wrap: wrap;">
        ${s.grade ? `<span class="badge badge-blue">${escapeHtml(s.grade)}</span>` : ''}
        <span class="badge badge-amber">Belirlenen Ders Ücreti: ${formatCurrency(s.rate || 0)}</span>
        ${s.phone ? `<span class="badge badge-purple">📞 ${escapeHtml(s.phone)}</span>` : ''}
        ${s.note ? `<span class="badge badge-purple">${escapeHtml(s.note)}</span>` : ''}
      </div>
    </div>

    <div class="kpi-grid" style="grid-template-columns: repeat(4, 1fr); gap: 0.75rem; margin-bottom: 1.25rem;">
      <div class="kpi-card" style="padding: 0.75rem 1rem;">
        <div>
          <div class="kpi-label" style="font-size: 0.7rem;">Yapılan Ders</div>
          <div class="kpi-value" style="font-size: 1.25rem;">${st.lessons}</div>
        </div>
      </div>
      <div class="kpi-card" style="padding: 0.75rem 1rem;">
        <div>
          <div class="kpi-label" style="font-size: 0.7rem;">Toplam Hak Ediş</div>
          <div class="kpi-value" style="font-size: 1.25rem; color: var(--primary);">${formatCurrency(st.revenue)}</div>
        </div>
      </div>
      <div class="kpi-card" style="padding: 0.75rem 1rem;">
        <div>
          <div class="kpi-label" style="font-size: 0.7rem;">Yatırılan Para</div>
          <div class="kpi-value" style="font-size: 1.25rem; color: var(--success);">${formatCurrency(st.paid)}</div>
        </div>
      </div>
      <div class="kpi-card" style="padding: 0.75rem 1rem;">
        <div>
          <div class="kpi-label" style="font-size: 0.7rem;">Kalan Borç</div>
          <div class="kpi-value" style="font-size: 1.25rem; color: ${st.unpaid > 0 ? 'var(--danger)' : 'var(--slate-400)'};">${formatCurrency(st.unpaid)}</div>
        </div>
      </div>
    </div>

    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
      <h4 style="font-size: 0.95rem; font-weight: 700;">Ders ve Ödeme Kayıtları (${studentLessons.length} Ders)</h4>
      <button class="btn btn-primary" style="padding: 3px 10px; font-size: 0.8rem;" onclick="closeModal('modalStudentDetails'); openAddLessonModal('${s.id}')">
        ➕ Bu Öğrenciye Ders Ekle
      </button>
    </div>

    <div style="max-height: 250px; overflow-y: auto; border: 1px solid var(--slate-200); border-radius: 8px;">
      <table class="data-table" style="font-size: 0.825rem;">
        <thead>
          <tr>
            <th>Tarih</th>
            <th>Ay</th>
            <th style="text-align: right;">Ücret</th>
            <th style="text-align: center;">Ödeme Durumu</th>
            <th style="text-align: center;">Düzenle</th>
            <th style="text-align: center;">Takvim</th>
          </tr>
        </thead>
        <tbody>
          ${studentLessons.length === 0 ? '<tr><td colspan="6" style="text-align:center; padding: 1rem; color: var(--slate-400);">Kayıtlı ders bulunamadı.</td></tr>' : ''}
          ${studentLessons.map((l, i) => `
            <tr>
              <td style="font-weight: 600;">${formatDateTurkish(l.date)}</td>
              <td>${l.month}</td>
              <td class="tabular-nums" style="text-align: right; font-weight: 700;">${formatCurrency(l.rate)}</td>
              <td style="text-align: center;">
                <button class="btn-toggle-pay ${l.isPaid ? 'is-paid' : 'is-unpaid'}" style="padding: 2px 6px; font-size: 0.75rem;" onclick="toggleLessonPayment('${l.id}'); viewStudentDetails('${s.id}');">
                  ${l.isPaid ? '🟢 Ödendi' : '🔴 Yatırılmadı'}
                </button>
              </td>
              <td style="text-align: center;">
                <button class="btn btn-secondary" style="padding: 2px 6px; font-size: 0.75rem;" onclick="closeModal('modalStudentDetails'); openEditLessonModal('${l.id}');">
                  ✏️ Düzenle
                </button>
              </td>
              <td style="text-align: center;">
                <button class="btn-gcal-action" onclick="openGoogleCalendarForLesson('${l.id}')">
                  📅 Ekle
                </button>
              </td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;

  document.getElementById("studentDetailBody").innerHTML = html;
  openModal("modalStudentDetails");
}

function promptAddDate(studentId) {
  const d = prompt("Eklenecek ders tarihini giriniz (YYYY-AA-GG):", new Date().toISOString().split("T")[0]);
  if (!d) return;

  const period = getActivePeriod();
  if (!period) return;

  const s = period.students.find(st => st.id === studentId);
  const mIdx = parseInt(d.split("-")[1], 10);
  const mName = MONTH_MAP[mIdx] || "Eylül";
  const rate = s?.rate || 3500;

  if (!period.lessons) period.lessons = [];
  period.lessons.push({
    id: "les_" + Date.now(),
    studentId: studentId,
    date: d,
    time: "14:00",
    duration: 60,
    month: mName,
    rate: rate,
    isPaid: false,
    paidDate: "",
    note: ""
  });

  if (!period.lessonDates) period.lessonDates = {};
  if (!period.lessonDates[studentId]) period.lessonDates[studentId] = [];
  period.lessonDates[studentId].push(d);
  period.lessonDates[studentId].sort();

  if (!period.monthlyLessons[mName]) period.monthlyLessons[mName] = {};
  period.monthlyLessons[mName][studentId] = (period.monthlyLessons[mName][studentId] || 0) + 1;

  if (!period.monthlyRevenue[mName]) period.monthlyRevenue[mName] = {};
  period.monthlyRevenue[mName][studentId] = (period.monthlyRevenue[mName][studentId] || 0) + rate;

  saveData();
  renderApp();
  showToast("Ders tarihi eklendi: " + d);
}

// --------------------------------------------------------------------------
// YENİ DÖNEM BAŞLATMA
// --------------------------------------------------------------------------
function openNewPeriodModal() {
  document.getElementById("formNewPeriod").reset();
  openModal("modalNewPeriod");
}

function handleCreateNewPeriod(event) {
  event.preventDefault();
  const name = document.getElementById("newPeriodNameInput").value.trim();
  const copyStudents = document.getElementById("copyStudentsCheckbox").checked;

  if (!name) {
    alert("Lütfen yeni eğitim yılı adını giriniz.");
    return;
  }

  const currentPeriod = getActivePeriod();
  const newId = name.toLowerCase().replace(/[^a-z0-9]/g, "-") + "-" + Date.now().toString().slice(-4);

  const newPeriod = {
    id: newId,
    name: name,
    isCurrent: true,
    students: copyStudents && currentPeriod ? JSON.parse(JSON.stringify(currentPeriod.students)) : [],
    lessonDates: {},
    lessons: [],
    monthlyLessons: {},
    monthlyRevenue: {}
  };

  appState.data.periods.forEach(p => p.isCurrent = false);
  appState.data.periods.unshift(newPeriod);
  appState.activePeriodId = newId;

  saveData();
  closeModal("modalNewPeriod");
  populatePeriodSelect();
  renderApp();
  showToast(`Yeni eğitim yılı başlatıldı: ${name}`);
}

// --------------------------------------------------------------------------
// DIŞA AKTARMA VE YEDEKLEME
// --------------------------------------------------------------------------
function exportToCSV() {
  const period = getActivePeriod();
  if (!period) return;

  const totals = calculateTotals(period);
  let csv = "Ay,Toplam Ders," + period.students.map(s => s.name).join(",") + "\n";

  MONTHS.forEach(m => {
    const isRevenue = appState.matrixMode === "revenue";
    const mTotal = totals.monthTotals[m] || { lessons: 0, revenue: 0 };
    const rowTotal = isRevenue ? mTotal.revenue : mTotal.lessons;

    const rowVals = period.students.map(s => {
      return isRevenue
        ? (period.monthlyRevenue[m]?.[s.id] || 0)
        : (period.monthlyLessons[m]?.[s.id] || 0);
    });

    csv += `${m},${rowTotal},${rowVals.join(",")}\n`;
  });

  const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `DersTakip_${period.id}_${appState.matrixMode}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showToast("Excel/CSV tablosu başarıyla indirildi!");
}

function exportJSONBackup(customFilename) {
  const jsonStr = JSON.stringify(appState.data, null, 2);
  const blob = new Blob([jsonStr], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = customFilename || `DersTakip_Yedek_${new Date().toISOString().split("T")[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast("Yedek dosyası indirildi! Google Drive'a yükleyebilirsiniz.");
}

function importJSONBackup(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const parsed = JSON.parse(e.target.result);
      if (parsed && parsed.periods && Array.isArray(parsed.periods)) {
        appState.data = parsed;
        appState.activePeriodId = parsed.activePeriodId || parsed.periods[0].id;
        appState.data.periods.forEach(p => ensureLessonsArray(p));
        saveData();
        populatePeriodSelect();
        renderApp();
        showToast("Yedek başarıyla yüklendi!");
      } else {
        alert("Geçersiz yedek dosyası formatı!");
      }
    } catch (err) {
      alert("Dosya okunurken hata oluştu: " + err.message);
    }
  };
  reader.readAsText(file);
}

// Yardımcı Formatlayıcılar
function formatCurrency(val) {
  if (isNaN(val) || val === null) return "0 ₺";
  return new Intl.NumberFormat("tr-TR").format(Math.round(val)) + " ₺";
}

function formatNumber(val) {
  if (isNaN(val) || val === null) return "0";
  return new Intl.NumberFormat("tr-TR").format(val);
}

function formatDateTurkish(dateStr) {
  if (!dateStr || !dateStr.includes("-")) return dateStr;
  const parts = dateStr.split("-");
  if (parts.length !== 3) return dateStr;

  const year = parts[0];
  const month = parseInt(parts[1], 10);
  const day = parseInt(parts[2], 10);

  const monthNames = [
    "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
    "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"
  ];

  return `${day} ${monthNames[month - 1] || ''} ${year}`;
}

function escapeHtml(text) {
  if (!text) return "";
  return text.toString()
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function showToast(msg) {
  let toast = document.getElementById("appToast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "appToast";
    toast.className = "toast";
    document.body.appendChild(toast);
  }
  toast.innerHTML = `<span>✓</span> <span>${escapeHtml(msg)}</span>`;
  toast.classList.add("show");
  setTimeout(() => {
    toast.classList.remove("show");
  }, 3000);
}

document.addEventListener("DOMContentLoaded", initApp);

// --------------------------------------------------------------------------
// PWA & MOBİL UYGULAMA SERVİSİ
// --------------------------------------------------------------------------
if ('serviceWorker' in navigator && (window.location.protocol === 'https:' || window.location.protocol === 'http:')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js')
      .then(reg => console.log('DersTakip Service Worker aktif:', reg.scope))
      .catch(err => console.log('Service Worker kaydı atlandı:', err));
  });
}

let deferredInstallPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
});

// --------------------------------------------------------------------------
// BULUT SENKRONİZASYON ARAYÜZ YÖNETİMİ
// --------------------------------------------------------------------------
function openCloudSyncModal() {
  updateCloudModalView();
  openModal('modalCloudSync');
}

async function updateCloudModalView() {
  if (!window.CloudSync) return;
  const cfg = window.CloudSync.getConfig();

  // Durum metni
  const statusEl = document.getElementById('cloudModalStatusText');
  const lastInfoEl = document.getElementById('cloudModalLastInfo');

  if (statusEl && lastInfoEl) {
    if (!navigator.onLine) {
      statusEl.textContent = '📡 Çevrimdışı (İnternet bağlantısı yok)';
      lastInfoEl.textContent = 'Yapılan işlemler cihazınızda güvende saklanıyor, internet gelince otomatik eşitlenecek.';
    } else if (cfg.lastSyncedAt) {
      const timeStr = new Date(cfg.lastSyncedAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      statusEl.textContent = '🟢 Tüm cihazlar güncel ve senkronize';
      lastInfoEl.textContent = `Son eşitleme: ${timeStr} (${cfg.lastDevice || 'Bu Cihaz'})`;
    } else {
      statusEl.textContent = '🟡 Eşitleme Yapılandırılmadı (Yerel Kayıt Aktif)';
      lastInfoEl.textContent = 'Bulut bağlantısını başlatmak için aşağıdaki yöntemlerden birini seçin.';
    }
  }

  // Firebase URL kutusu
  const fbInput = document.getElementById('cloudFirebaseUrlInput');
  if (fbInput && cfg.firebaseUrl) {
    fbInput.value = cfg.firebaseUrl;
  }

  // Puter Auth Durumu
  const puterStatusEl = document.getElementById('puterAuthStatus');
  const btnPuter = document.getElementById('btnPuterAuth');
  if (window.puter && window.puter.auth) {
    try {
      const isLogged = await window.puter.auth.isSignedIn();
      if (isLogged) {
        const user = await window.puter.auth.getUser();
        if (puterStatusEl) puterStatusEl.innerHTML = `🟢 Bağlandı: <strong>${user ? user.username : 'Google Kullanıcısı'}</strong>`;
        if (btnPuter) btnPuter.innerHTML = `<span>🔓</span> Çıkış Yap`;
      } else {
        if (puterStatusEl) puterStatusEl.textContent = 'Henüz bağlanmadı';
        if (btnPuter) btnPuter.innerHTML = `<span>🔑</span> Google ile Giriş Yap & Bağlan`;
      }
    } catch (e) {
      if (puterStatusEl) puterStatusEl.textContent = '';
    }
  }

  // Aktif sağlayıcı kartını vurgula
  const cardPuter = document.getElementById('cardPuterSync');
  const cardFb = document.getElementById('cardFirebaseSync');
  if (cardPuter) cardPuter.classList.toggle('active-provider', cfg.provider === 'puter');
  if (cardFb) cardFb.classList.toggle('active-provider', cfg.provider === 'firebase');
}

async function triggerManualCloudSync() {
  if (!window.CloudSync) return;
  showToast('Bulut kontrol ediliyor...');
  await window.CloudSync.sync(true);
  updateCloudModalView();
}

async function handlePuterAuth() {
  if (!window.puter || !window.puter.auth) {
    showToast('Puter kütüphanesi yüklenemedi. Firebase seçeneğini deneyebilirsiniz.');
    return;
  }

  try {
    const isLogged = await window.puter.auth.isSignedIn();
    if (isLogged) {
      if (confirm('Google bulut oturumunu kapatmak istiyor musunuz?')) {
        await window.puter.auth.signOut();
        showToast('Bulut oturumu kapatıldı.');
      }
    } else {
      await window.puter.auth.signIn();
      window.CloudSync.saveConfig({ provider: 'puter' });
      showToast('Google ile bağlantı sağlandı! Eşitleniyor...');
      await window.CloudSync.sync(true);
    }
    updateCloudModalView();
  } catch (err) {
    console.error('Puter auth hata:', err);
    showToast(`Bağlantı hatası: ${err.message || err}`);
  }
}

function saveFirebaseCloudConfig() {
  if (!window.CloudSync) return;
  const input = document.getElementById('cloudFirebaseUrlInput');
  if (!input) return;
  const url = input.value.trim();

  if (!url) {
    alert('Lütfen geçerli bir Firebase Realtime Database URL adresi girin.');
    return;
  }

  window.CloudSync.saveConfig({
    provider: 'firebase',
    firebaseUrl: url
  });

  showToast('Firebase ayarları kaydedildi, eşitleniyor...');
  window.CloudSync.sync(true);
  updateCloudModalView();
}

function toggleCloudQrCode() {
  if (!window.CloudSync) return;
  const container = document.getElementById('cloudQrContainer');
  const img = document.getElementById('cloudQrImage');
  if (!container || !img) return;

  if (container.style.display === 'none' || !container.style.display) {
    img.src = window.CloudSync.getQrCodeUrl();
    container.style.display = 'flex';
  } else {
    container.style.display = 'none';
  }
}

function copyCloudShareLink() {
  if (!window.CloudSync) return;
  const shareUrl = window.CloudSync.getShareUrl();

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(shareUrl).then(() => {
      showToast('📱 Eşleştirme linki kopyalandı! Telefonunuzda açabilirsiniz.');
    }).catch(() => {
      prompt('Aşağıdaki bağlantıyı kopyalayıp telefonunuza gönderin:', shareUrl);
    });
  } else {
    prompt('Aşağıdaki bağlantıyı kopyalayıp telefonunuza gönderin:', shareUrl);
  }
}

