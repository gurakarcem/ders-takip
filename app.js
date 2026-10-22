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
  myPaymentsFilter: "all", // 'all', 'unpaid', 'paid'
  myPaymentsCategoryFilter: "all",
  myPaymentsMonthFilter: "all", // 'all', 'Ağustos', 'Eylül', vb.
  myPaymentsSearch: "",
  dashboardPaymentFilter: "unpaid", // 'unpaid', 'paid', 'all'
  upcomingDebtsFilter: "all", // 'all', 'overdue', 'soon', 'thisMonth'
  modalMonthlyPaidMonth: "",
  paymentFilter: "all",  // 'all', 'unpaid', 'paid'
  paymentStudentFilter: "all",
  paymentHistoryFilter: "all",
  paymentHistorySearch: "",
  gcalEmail: "",
  charts: {
    revenue: null,
    students: null,
    expenseSummary: null,
    monthlyPaidExpenses: null
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
          appState.data.periods.forEach(p => {
            ensureLessonsArray(p);
            ensurePaymentsArray(p);
            ensureMyPaymentsArray(p);
          });
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

  // GEÇMİŞ VE MEVCUT VERİ GÜVENCESİ / KURTARMA (Data Recovery & Integrity)
  // Eğer tarayıcıda eski yıllara (2025-2026, 2024-2025) ait dersler veya ödemeler boş kalmışsa
  // INITIAL_DERS_DATA'dan 562 dersin tamamını eksiksiz olarak anında geri yükle ve onar!
  if (appState.data && appState.data.periods && window.INITIAL_DERS_DATA) {
    const initPeriods = window.INITIAL_DERS_DATA.periods || [];
    initPeriods.forEach(initP => {
      let existingP = appState.data.periods.find(p => p.id === initP.id);
      if (!existingP) {
        existingP = JSON.parse(JSON.stringify(initP));
        appState.data.periods.push(existingP);
      } else {
        if ((!existingP.lessons || existingP.lessons.length < (initP.lessons || []).length) && initP.lessons && initP.lessons.length > 0) {
          existingP.lessons = JSON.parse(JSON.stringify(initP.lessons));
        }
        if ((!existingP.payments || existingP.payments.length < (initP.payments || []).length) && initP.payments && initP.payments.length > 0) {
          existingP.payments = JSON.parse(JSON.stringify(initP.payments));
        }
        if ((!existingP.students || existingP.students.length < (initP.students || []).length) && initP.students && initP.students.length > 0) {
          existingP.students = JSON.parse(JSON.stringify(initP.students));
        }
        if (!existingP.myPayments || !Array.isArray(existingP.myPayments) || (existingP.id === '2026-2027' && existingP.myPayments.length === 0)) {
          if (initP.myPayments && initP.myPayments.length > 0) {
            existingP.myPayments = JSON.parse(JSON.stringify(initP.myPayments));
          } else {
            existingP.myPayments = [];
          }
        }
        // Yalnızca sahte/yapay Ağustos, Eylül, Kasım faturalarını temizle (kullanıcının 7 faturasını koru)
        existingP.myPayments = existingP.myPayments.filter(pay => {
          if (!pay || !pay.id) return false;
          return !/^mypay_(aug|sep|nov)_\d+$/.test(pay.id);
        });
      }
    });
  }

  // Zaman damgası ve cihaz kontrolü
  if (appState.data) {
    if (!appState.data._updatedAt || appState.data._updatedAt === 0) {
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

  // Her dönem için dersler, ödemeler ve kişisel ödemeler dizilerinin varlığını garanti et
  if (appState.data && appState.data.periods) {
    appState.data.periods.forEach(p => {
      ensureLessonsArray(p);
      ensurePaymentsArray(p);
      ensureMyPaymentsArray(p);
    });
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
  if (confirm("Tüm değişiklikler sıfırlanacak ve dosyanızdaki orijinal veriler (3 yılın 562 dersi) geri yüklenecek. Emin misiniz?")) {
    appState.data = JSON.parse(JSON.stringify(window.INITIAL_DERS_DATA));
    appState.activePeriodId = appState.data.activePeriodId || "2026-2027";
    if (appState.data.periods) {
      appState.data.periods.forEach(p => {
        ensureLessonsArray(p);
        ensurePaymentsArray(p);
        ensureMyPaymentsArray(p);
      });
    }
    saveData();
    populatePeriodSelect();
    renderApp();
    showToast("Tüm yıllara ait orijinal veriler başarıyla geri yüklendi!");
  }
}

// Aktif dönemi getir
function getActivePeriod() {
  if (!appState.data || !appState.data.periods) return null;
  return appState.data.periods.find(p => p.id === appState.activePeriodId) || appState.data.periods[0];
}

// Dersler dizisini oluştur (eğer yoksa INITIAL_DERS_DATA'dan veya geçmiş tarihlerden sentezle)
function ensureLessonsArray(period) {
  if (!period) return;
  if (!period.lessons || period.lessons.length === 0) {
    const initPer = (window.INITIAL_DERS_DATA?.periods || []).find(p => p.id === period.id);
    if (initPer && initPer.lessons && initPer.lessons.length > 0) {
      period.lessons = JSON.parse(JSON.stringify(initPer.lessons));
    } else {
      period.lessons = [];
      const datesMap = period.lessonDates || {};

      let counter = 1;
      (period.students || []).forEach(s => {
        const dates = datesMap[s.id] || [];
        dates.forEach(d => {
          const mIdx = parseInt(d.split("-")[1], 10);
          const mName = MONTH_MAP[mIdx] || "Eylül";
          const rate = s.rate || 3000;

          period.lessons.push({
            id: "les_" + period.id + "_" + counter++,
            studentId: s.id,
            date: d,
            time: "14:00",
            duration: 60,
            month: mName,
            rate: rate,
            isPaid: true,
            paidDate: d,
            note: "Ders tamamlandı"
          });
        });
      });
    }
  } else {
    // Mevcut derslerde saat ve süre yoksa varsayılan ata
    period.lessons.forEach(l => {
      if (!l.time) l.time = "14:00";
      if (!l.duration) l.duration = 60;
    });
  }
}

// Ödemeler dizisini garanti et (eğer yoksa INITIAL_DERS_DATA veya ödenmiş derslerden sentezle)
function ensurePaymentsArray(period) {
  if (!period) return;
  if (!period.payments || period.payments.length === 0) {
    const initPer = (window.INITIAL_DERS_DATA?.periods || []).find(p => p.id === period.id);
    if (initPer && initPer.payments && initPer.payments.length > 0) {
      period.payments = JSON.parse(JSON.stringify(initPer.payments));
    } else {
      period.payments = [];
      if (period.lessons && period.lessons.length > 0) {
        let counter = 1;
        period.lessons.forEach(l => {
          if (l.isPaid) {
            period.payments.push({
              id: "pay_" + period.id + "_" + (l.id || counter++),
              studentId: l.studentId,
              date: l.paidDate || l.date,
              amount: parseFloat(l.rate) || 0,
              type: "Banka Havalesi / EFT",
              note: l.note ? `Ders ödemesi (${l.note})` : "Ders ödemesi",
              lessonId: l.id,
              createdAt: new Date(l.paidDate || l.date).getTime() || Date.now()
            });
          }
        });
      }
    }
  }
}

// Tarihten Ay Adını Bul (YYYY-MM-DD -> Ağustos, Eylül vb.)
function getPaymentMonthName(dateStr) {
  if (!dateStr || typeof dateStr !== "string") return "Bilinmeyen";
  const parts = dateStr.split("-");
  if (parts.length >= 2) {
    const m = parseInt(parts[1], 10);
    if (MONTH_MAP[m]) return MONTH_MAP[m];
  }
  return "Bilinmeyen";
}

// Kişisel Ödemeler dizisini garanti et (Kullanıcının faturaları)
function ensureMyPaymentsArray(period) {
  if (!period) return;
  const initPer = (window.INITIAL_DERS_DATA?.periods || []).find(p => p.id === period.id);
  if (!period.myPayments || !Array.isArray(period.myPayments) || (period.id === '2026-2027' && period.myPayments.length === 0)) {
    if (initPer && Array.isArray(initPer.myPayments) && initPer.myPayments.length > 0) {
      period.myPayments = JSON.parse(JSON.stringify(initPer.myPayments));
    } else {
      period.myPayments = [];
    }
  }
  // Yalnızca sahte Ağustos, Eylül, Kasım faturalarını temizle (kullanıcının 7 faturasını KORU)
  period.myPayments = period.myPayments.filter(pay => {
    if (!pay || !pay.id) return false;
    return !/^mypay_(aug|sep|nov)_\d+$/.test(pay.id);
  });
}

// Kişisel Ödeme Toplamlarını, Ay Ay Giderleri ve Vade Durumunu Hesapla
function calculateMyPaymentsTotals(period) {
  ensureMyPaymentsArray(period);
  const list = period.myPayments || [];

  let totalAmount = 0;
  let paidAmount = 0;
  let unpaidAmount = 0;
  let paidCount = 0;
  let unpaidCount = 0;
  let upcoming = null;

  // Ay Ay Dağılım Objesi (Eğitim yılı sırası: Ağustos - Haziran)
  const monthExpenses = {};
  MONTHS.forEach(m => {
    monthExpenses[m] = {
      month: m,
      total: 0,
      paid: 0,
      unpaid: 0,
      count: 0,
      paidCount: 0,
      unpaidCount: 0,
      items: []
    };
  });

  // Kategori Bazında Dağılım
  const categoryExpenses = {};

  list.forEach(p => {
    const amt = parseFloat(p.amount) || 0;
    const isPaid = p.status === "paid";
    const mName = getPaymentMonthName(p.date);
    const catName = p.category || "Diğer";

    // Genel Toplamlar
    totalAmount += amt;
    if (isPaid) {
      paidAmount += amt;
      paidCount++;
    } else {
      unpaidAmount += amt;
      unpaidCount++;
      if (p.date) {
        if (!upcoming || p.date < upcoming.date) {
          upcoming = p;
        }
      }
    }

    // Ay Ay Toplamlar
    if (!monthExpenses[mName]) {
      monthExpenses[mName] = {
        month: mName,
        total: 0,
        paid: 0,
        unpaid: 0,
        count: 0,
        paidCount: 0,
        unpaidCount: 0,
        items: []
      };
    }
    monthExpenses[mName].total += amt;
    if (isPaid) {
      monthExpenses[mName].paid += amt;
      monthExpenses[mName].paidCount++;
    } else {
      monthExpenses[mName].unpaid += amt;
      monthExpenses[mName].unpaidCount++;
    }
    monthExpenses[mName].count++;
    monthExpenses[mName].items.push(p);

    // Kategori Toplamları
    if (!categoryExpenses[catName]) {
      categoryExpenses[catName] = {
        category: catName,
        total: 0,
        paid: 0,
        unpaid: 0,
        count: 0
      };
    }
    categoryExpenses[catName].total += amt;
    if (isPaid) {
      categoryExpenses[catName].paid += amt;
    } else {
      categoryExpenses[catName].unpaid += amt;
    }
    categoryExpenses[catName].count++;
  });

  return {
    totalAmount,
    totalCount: list.length,
    paidAmount,
    paidCount,
    unpaidAmount,
    unpaidCount,
    upcoming,
    monthExpenses,
    categoryExpenses
  };
}

// Hesaplamalar (Toplamlar, Tahsilat, Bakiye)
function calculateTotals(period) {
  if (!period) return {
    totalLessons: 0, totalRevenue: 0, totalPaid: 0, totalUnpaid: 0,
    avgRate: 0, studentTotals: {}, monthTotals: {}
  };

  ensureLessonsArray(period);
  ensurePaymentsArray(period);

  let totalLessons = 0;
  let totalRevenue = 0;
  let totalPaid = 0;
  let totalUnpaid = 0;

  const studentTotals = {};
  const monthTotals = {};

  // Öğrenci bazında sıfırla
  period.students.forEach(s => {
    studentTotals[s.id] = { lessons: 0, revenue: 0, paid: 0, unpaid: 0, balance: 0, avgRate: 0, paymentsCount: 0 };
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

    totalLessons += 1;
    totalRevenue += rate;

    if (studentTotals[sId]) {
      studentTotals[sId].lessons += 1;
      studentTotals[sId].revenue += rate;
    }

    if (monthTotals[m]) {
      monthTotals[m].lessons += 1;
      monthTotals[m].revenue += rate;
    }
  });

  // Ödemelerden toplam tahsilatı hesapla
  const payments = period.payments || [];
  payments.forEach(p => {
    const sId = p.studentId;
    const amt = parseFloat(p.amount) || 0;
    totalPaid += amt;

    if (studentTotals[sId]) {
      studentTotals[sId].paid += amt;
      studentTotals[sId].paymentsCount = (studentTotals[sId].paymentsCount || 0) + 1;
    }
  });

  // Öğrenci bazında borç ve bakiye
  period.students.forEach(s => {
    const st = studentTotals[s.id];
    st.unpaid = Math.max(0, st.revenue - st.paid);
    st.balance = st.paid - st.revenue; // Pozitifse fazla/avans ödeme, negatifse kalan borç
    st.avgRate = st.lessons > 0 ? Math.round(st.revenue / st.lessons) : (s.rate || 0);
  });

  totalUnpaid = Math.max(0, totalRevenue - totalPaid);

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
  renderMyPayments(period);
  renderPayments(totals, period);
  renderSchedule(period);
  renderStudents(totals, period);
  renderLessonsList(period);
  renderGoogleCalendarTab();
}

// KPI Kartları
function renderKPIs(totals, period) {
  const elRev = document.getElementById("kpiTotalRevenue");
  if (elRev) elRev.textContent = formatCurrency(totals.totalRevenue);

  const elPaid = document.getElementById("kpiTotalPaid");
  if (elPaid) elPaid.textContent = formatCurrency(totals.totalPaid);

  const elUnpaid = document.getElementById("kpiTotalUnpaid");
  if (elUnpaid) elUnpaid.textContent = formatCurrency(totals.totalUnpaid);

  const elLessons = document.getElementById("kpiTotalLessons");
  if (elLessons) elLessons.textContent = totals.totalLessons + " Ders";

  const elStudents = document.getElementById("kpiActiveStudents");
  if (elStudents) elStudents.textContent = (period.students ? period.students.length : 0) + " Öğrenci";

  // Kişisel Ödemeler Kartları (Aktif Öğrenci kutusunun yanındaki kutular)
  const myTotals = calculateMyPaymentsTotals(period);

  const elMyExp = document.getElementById("kpiMyTotalExpenses");
  if (elMyExp) elMyExp.textContent = formatCurrency(myTotals.totalAmount);

  const elMyExpSub = document.getElementById("kpiMyTotalExpensesSub");
  if (elMyExpSub) {
    if (myTotals.unpaidAmount > 0) {
      elMyExpSub.textContent = `${formatCurrency(myTotals.unpaidAmount)} bekliyor (${myTotals.totalCount} kayıt) ↗️`;
    } else {
      elMyExpSub.textContent = `Tümü ödendi (${myTotals.totalCount} kayıt) ↗️`;
    }
  }

  const elMyPending = document.getElementById("kpiMyPendingExpenses");
  if (elMyPending) elMyPending.textContent = formatCurrency(myTotals.unpaidAmount);

  const elMyPendingSub = document.getElementById("kpiMyPendingExpensesSub");
  if (elMyPendingSub) elMyPendingSub.textContent = `${myTotals.unpaidCount} adet ödeme bekliyor ↗️`;

  const elMyNet = document.getElementById("kpiMyNetBalance");
  const elMyNetSub = document.getElementById("kpiMyNetBalanceSub");
  if (elMyNet) {
    const net = totals.totalRevenue - myTotals.totalAmount;
    elMyNet.textContent = formatCurrency(net);
    if (net >= 0) {
      elMyNet.style.color = "var(--success)";
      if (elMyNetSub) elMyNetSub.textContent = "Net Fazla (+) ↗️";
    } else {
      elMyNet.style.color = "var(--danger)";
      if (elMyNetSub) elMyNetSub.textContent = "Net Açık (-) ↗️";
    }
  }
}

// Dashboard Görünümü
function renderDashboard(totals, period) {
  renderDashboardUpcomingPayments(period);
  renderTopStudentsTable(totals, period);
  renderCharts(totals, period);
}

function setDashboardPaymentFilter(filter) {
  appState.dashboardPaymentFilter = filter;
  const period = getActivePeriod();
  if (period) {
    renderDashboardUpcomingPayments(period);
  }
}

function renderDashboardUpcomingPayments(period) {
  if (!period) return;
  ensureMyPaymentsArray(period);

  const list = period.myPayments || [];
  const unpaidList = list.filter(p => p.status === "unpaid");
  const paidList = list.filter(p => p.status === "paid");

  // Filtre Sayı Rozetleri
  const elCntUnpaid = document.getElementById("countDashPayUnpaid");
  if (elCntUnpaid) elCntUnpaid.textContent = unpaidList.length;

  const elCntPaid = document.getElementById("countDashPayPaid");
  if (elCntPaid) elCntPaid.textContent = paidList.length;

  const elCntAll = document.getElementById("countDashPayAll");
  if (elCntAll) elCntAll.textContent = list.length;

  const curFilter = appState.dashboardPaymentFilter || "unpaid";

  const btnUnpaid = document.getElementById("btnDashPayUnpaid");
  const btnPaid = document.getElementById("btnDashPayPaid");
  const btnAll = document.getElementById("btnDashPayAll");

  if (btnUnpaid) btnUnpaid.classList.toggle("active", curFilter === "unpaid");
  if (btnPaid) btnPaid.classList.toggle("active", curFilter === "paid");
  if (btnAll) btnAll.classList.toggle("active", curFilter === "all");

  const tbody = document.getElementById("dashboardUpcomingPaymentsBody");
  if (!tbody) return;

  let displayList = [];
  if (curFilter === "unpaid") {
    displayList = [...unpaidList];
    // Yaklaşan borçları aciliyet sırasına göre sırala: gecikmiş, bugün, yaklaşan, gelecek
    displayList.sort((a, b) => {
      const dueA = getDebtDueStatus(a.date);
      const dueB = getDebtDueStatus(b.date);
      return (dueA.urgencyOrder - dueB.urgencyOrder) || (a.date || "").localeCompare(b.date || "");
    });
  } else if (curFilter === "paid") {
    displayList = [...paidList];
    // Ödenenleri en son ödenenden eskiye doğru sırala
    displayList.sort((a, b) => (b.paidDate || b.date || "").localeCompare(a.paidDate || a.date || ""));
  } else {
    displayList = [...list];
    // Tümü: Önce bekleyenler sonra ödenenler
    displayList.sort((a, b) => {
      if (a.status !== b.status) return a.status === "unpaid" ? -1 : 1;
      return (a.date || "").localeCompare(b.date || "");
    });
  }

  if (displayList.length === 0) {
    if (curFilter === "unpaid") {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align: center; padding: 2.25rem 1rem; color: var(--slate-500); background: #f8fafc;">
            <div style="font-size: 2.2rem; margin-bottom: 0.35rem;">🎉</div>
            <div style="font-weight: 700; color: var(--slate-800); font-size: 1rem;">Harika! Vadesi yaklaşan veya bekleyen borcunuz bulunmuyor.</div>
            <div style="font-size: 0.8rem; color: var(--slate-400); margin-top: 2px;">Tüm kişisel gider ve faturalarınız ödendi olarak kaydedildi.</div>
          </td>
        </tr>
      `;
    } else if (curFilter === "paid") {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align: center; padding: 2.25rem 1rem; color: var(--slate-500); background: #f8fafc;">
            <div style="font-size: 2.2rem; margin-bottom: 0.35rem;">📋</div>
            <div style="font-weight: 700; color: var(--slate-800); font-size: 1rem;">Henüz ödenmiş olarak işaretlenmiş bir kayıt yok.</div>
            <div style="font-size: 0.8rem; color: var(--slate-400); margin-top: 2px;">Bekleyen borçlar listesinden "Ödendi" butonuna basarak ödenenlere aktarabilirsiniz.</div>
          </td>
        </tr>
      `;
    } else {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align: center; padding: 2.25rem 1rem; color: var(--slate-500); background: #f8fafc;">
            <div style="font-size: 2.2rem; margin-bottom: 0.35rem;">📝</div>
            <div style="font-weight: 700; color: var(--slate-800); font-size: 1rem;">Kayıtlı kişisel ödeme bulunmuyor.</div>
          </td>
        </tr>
      `;
    }
    return;
  }

  const CAT_ICONS = {
    "Kredi Kartı": "💳",
    "Fatura": "💡",
    "Kira & Aidat": "🏠",
    "Kredi Taksiti": "🏦",
    "Sigorta & Vergi": "🛡️",
    "Alışveriş & Market": "🛒",
    "Diğer": "📝"
  };

  tbody.innerHTML = displayList.map(item => {
    const isPaid = item.status === "paid";
    const catIcon = CAT_ICONS[item.category] || "🏷️";
    const due = getDebtDueStatus(item.date);

    let dateBadge = "";
    if (isPaid) {
      dateBadge = `<span class="badge" style="background: #ecfdf5; color: #047857; font-weight: 700; font-size: 0.75rem;">🟢 ${formatDateTurkish(item.paidDate || item.date)} Ödendi</span>`;
    } else {
      dateBadge = due.badgeHtml;
    }

    const statusBadge = isPaid
      ? `<span class="badge" style="background: #ecfdf5; color: #047857; font-weight: 700;">🟢 Ödendi</span>`
      : `<span class="badge" style="background: #fef2f2; color: #b91c1c; font-weight: 700;">🔴 Bekliyor</span>`;

    const toggleButton = isPaid
      ? `<button type="button" class="btn-pay-toggle is-paid" onclick="toggleMyPaymentStatus('${item.id}')" title="Bu ödemeyi tekrar bekleyen borçlara geri al">
           <span>↩️</span> Ödenmedi Yap
         </button>`
      : `<button type="button" class="btn-pay-toggle is-unpaid" onclick="toggleMyPaymentStatus('${item.id}')" title="Bu borcu ödendi olarak işaretle ve ödenenlere aktar">
           <span>✓</span> Ödendi
         </button>`;

    const calBtn = isPaid
      ? `<span style="color: var(--slate-300); font-size: 0.8rem;">-</span>`
      : `<button type="button" class="btn-action-icon" onclick="addToGoogleCalendar('${item.id}')" title="Google Takvime Ekle">
           <span>📅</span>
         </button>`;

    return `
      <tr style="${isPaid ? 'opacity: 0.85; background: #fafafa;' : ''}">
        <td>
          <div style="font-weight: 700; font-size: 0.85rem; color: var(--slate-900);">${formatDateTurkish(item.date)}</div>
          <div style="margin-top: 3px;">${dateBadge}</div>
        </td>
        <td>
          <div style="font-weight: 700; color: var(--slate-900); font-size: 0.95rem;">${escapeHtml(item.title)}</div>
          ${item.note ? `<div style="font-size: 0.775rem; color: var(--slate-500); margin-top: 2px;">📝 ${escapeHtml(item.note)}</div>` : ''}
        </td>
        <td>
          <span class="badge" style="background: var(--slate-100); color: var(--slate-700); font-size: 0.75rem; font-weight: 600;">
            ${catIcon} ${escapeHtml(item.category || 'Gider')}
          </span>
        </td>
        <td class="tabular-nums" style="text-align: right; font-weight: 800; font-size: 1rem; color: ${isPaid ? 'var(--success)' : 'var(--danger)'};">
          ${formatCurrency(item.amount)}
        </td>
        <td style="text-align: center;">
          ${statusBadge}
        </td>
        <td style="text-align: center;">
          ${toggleButton}
        </td>
        <td style="text-align: center;">
          ${calBtn}
        </td>
      </tr>
    `;
  }).join("");
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

  const expTotals = calculateMyPaymentsTotals(period);
  const paidExpenseData = MONTHS.map(m => expTotals.monthExpenses[m] ? expTotals.monthExpenses[m].paid : 0);

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
            label: "Aylık Ders Geliri (₺)",
            data: revData,
            backgroundColor: "#4f46e5",
            borderRadius: 6,
            yAxisID: "y"
          },
          {
            label: "Ödenen Gider & Borç (₺)",
            data: paidExpenseData,
            backgroundColor: "#10b981",
            borderRadius: 6,
            yAxisID: "y"
          },
          {
            label: "Ders Sayısı",
            data: lessonsData,
            type: "line",
            borderColor: "#f59e0b",
            backgroundColor: "#f59e0b",
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

  // 4. Ödemeler listesini senkronize et
  ensurePaymentsArray(period);
  const existingPayIdx = period.payments.findIndex(p => p.lessonId === lessonId);
  if (newPaid) {
    if (existingPayIdx !== -1) {
      period.payments[existingPayIdx].studentId = newStudentId;
      period.payments[existingPayIdx].amount = newRate;
      period.payments[existingPayIdx].date = lesson.paidDate || newDate;
    } else {
      period.payments.unshift({
        id: "pay_" + lessonId,
        studentId: newStudentId,
        date: lesson.paidDate || newDate,
        amount: newRate,
        type: "Banka Havalesi / EFT",
        note: newNote ? `Ders ödemesi (${newNote})` : "Ders ödemesi",
        lessonId: lessonId,
        createdAt: Date.now()
      });
    }
  } else if (existingPayIdx !== -1) {
    period.payments.splice(existingPayIdx, 1);
  }

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

  // 4. İlişkili ödeme varsa sil
  if (period.payments) {
    const payIdx = period.payments.findIndex(p => p.lessonId === lessonId);
    if (payIdx !== -1) period.payments.splice(payIdx, 1);
  }

  saveData();
  closeModal("modalEditLesson");
  renderApp();
  showToast("Ders kaydı başarıyla silindi!");
}

// ==========================================================================
// KİŞİSEL ÖDEMELERİM YÖNETİMİ (CEM BABA ÖZEL GİDER, KART, KİRA, FATURA TAKİBİ)
// ==========================================================================
function renderMyPayments(period) {
  if (!period) return;
  ensureMyPaymentsArray(period);

  const totals = calculateMyPaymentsTotals(period);

  // 1. KPI Kartları
  const elPendingAmt = document.getElementById("kpiMyPendingAmount");
  if (elPendingAmt) elPendingAmt.textContent = formatCurrency(totals.unpaidAmount);

  const elPendingCnt = document.getElementById("kpiMyPendingCount");
  if (elPendingCnt) elPendingCnt.textContent = `${totals.unpaidCount} adet ödeme bekliyor`;

  const elPaidAmt = document.getElementById("kpiMyPaidAmount");
  if (elPaidAmt) elPaidAmt.textContent = formatCurrency(totals.paidAmount);

  const elPaidCnt = document.getElementById("kpiMyPaidCount");
  if (elPaidCnt) elPaidCnt.textContent = `${totals.paidCount} adet ödendi`;

  const elTotalAmt = document.getElementById("kpiMyTotalAmount");
  if (elTotalAmt) elTotalAmt.textContent = formatCurrency(totals.totalAmount);

  const elTotalCnt = document.getElementById("kpiMyTotalCount");
  if (elTotalCnt) elTotalCnt.textContent = `${totals.totalCount} adet toplam kayıt`;

  const elUpcoming = document.getElementById("kpiMyUpcomingText");
  if (elUpcoming) {
    if (totals.upcoming) {
      elUpcoming.textContent = `${formatDateTurkish(totals.upcoming.date)} (${totals.upcoming.title})`;
    } else {
      elUpcoming.textContent = "Bekleyen Ödeme Yok ✓";
    }
  }

  // 2. Filtre Sayıları & Buton Durumları
  const elCountAll = document.getElementById("countMyPayAll");
  if (elCountAll) elCountAll.textContent = totals.totalCount;

  const elCountUnpaid = document.getElementById("countMyPayUnpaid");
  if (elCountUnpaid) elCountUnpaid.textContent = totals.unpaidCount;

  const elCountPaid = document.getElementById("countMyPayPaid");
  if (elCountPaid) elCountPaid.textContent = totals.paidCount;

  const curFilter = appState.myPaymentsFilter || "all";
  const btnAll = document.getElementById("btnFilterMyPayAll");
  if (btnAll) btnAll.classList.toggle("active", curFilter === "all");
  const btnUnpaid = document.getElementById("btnFilterMyPayUnpaid");
  if (btnUnpaid) btnUnpaid.classList.toggle("active", curFilter === "unpaid");
  const btnPaid = document.getElementById("btnFilterMyPayPaid");
  if (btnPaid) btnPaid.classList.toggle("active", curFilter === "paid");

  // Hızlı giriş formu varsayılan tarihi
  const quickDate = document.getElementById("quickMyPaymentDateInput");
  if (quickDate && !quickDate.value) {
    quickDate.value = new Date().toISOString().split("T")[0];
  }

  // 3. Ay Ay Yatay Çip Şeridi
  const monthStrip = document.getElementById("myPaymentMonthStrip");
  if (monthStrip) {
    const curMonth = appState.myPaymentsMonthFilter || "all";
    let stripHtml = `
      <div class="month-chip ${curMonth === 'all' ? 'active' : ''}" onclick="handleMyPaymentMonthFilter('all')" title="Tüm aylardaki giderleri listele">
        <span>📅 Tüm Aylar</span>
        <span class="chip-amt">${formatCurrency(totals.totalAmount)}</span>
      </div>
    `;

    MONTHS.forEach(m => {
      const mExp = totals.monthExpenses[m] || { total: 0, count: 0, paid: 0, unpaid: 0 };
      const isActive = curMonth === m;
      if (mExp.count > 0) {
        const statusIcon = mExp.unpaid > 0 ? "⏳" : "✓";
        const amtStyle = mExp.unpaid > 0 ? "background: #fee2e2; color: #b91c1c;" : "background: #dcfce7; color: #15803d;";
        stripHtml += `
          <div class="month-chip ${isActive ? 'active' : ''}" onclick="handleMyPaymentMonthFilter('${m}')" title="${m}: ${mExp.count} kayıt, ${formatCurrency(mExp.total)} (${mExp.unpaid > 0 ? formatCurrency(mExp.unpaid) + ' bekliyor' : 'tamamı ödendi'})">
            <span>📅 ${m}</span>
            <span class="chip-amt" style="${amtStyle}">${formatCurrency(mExp.total)}</span>
            <span style="font-size: 0.75rem; margin-left: 2px;">${statusIcon}</span>
          </div>
        `;
      } else {
        stripHtml += `
          <div class="month-chip ${isActive ? 'active' : ''}" onclick="handleMyPaymentMonthFilter('${m}')" style="opacity: 0.6;" title="${m}: Kayıt yok">
            <span>📅 ${m}</span>
            <span class="chip-amt">0 ₺</span>
          </div>
        `;
      }
    });

    monthStrip.innerHTML = stripHtml;
  }

  // 4. Ay Filtresi Dropdown Seçeneklerini Güncelle
  const monthSelect = document.getElementById("filterMyPaymentMonthSelect");
  if (monthSelect) {
    const curMonth = appState.myPaymentsMonthFilter || "all";
    let selectHtml = `<option value="all" ${curMonth === 'all' ? 'selected' : ''}>📅 Tüm Aylar (${formatCurrency(totals.totalAmount)})</option>`;
    MONTHS.forEach(m => {
      const mExp = totals.monthExpenses[m] || { total: 0, count: 0 };
      const label = mExp.count > 0 ? `📅 ${m} (${formatCurrency(mExp.total)})` : `📅 ${m} (0 ₺)`;
      selectHtml += `<option value="${m}" ${curMonth === m ? 'selected' : ''}>${label}</option>`;
    });
    monthSelect.innerHTML = selectHtml;
  }

  // 5. Tablo Filtreleme & Döküm
  const tbody = document.getElementById("myPaymentsListTableBody");
  if (!tbody) return;

  let list = [...(period.myPayments || [])];

  // Durum filtresi
  if (curFilter === "unpaid") {
    list = list.filter(p => p.status !== "paid");
  } else if (curFilter === "paid") {
    list = list.filter(p => p.status === "paid");
  }

  // Ay filtresi
  const curMonth = appState.myPaymentsMonthFilter || "all";
  if (curMonth && curMonth !== "all") {
    list = list.filter(p => getPaymentMonthName(p.date) === curMonth);
  }

  // Kategori filtresi
  const curCat = appState.myPaymentsCategoryFilter || "all";
  if (curCat && curCat !== "all") {
    list = list.filter(p => p.category === curCat);
  }

  // Metin arama filtresi
  const searchQ = (appState.myPaymentsSearch || "").toLowerCase().trim();
  if (searchQ) {
    list = list.filter(p => {
      const title = (p.title || "").toLowerCase();
      const note = (p.note || "").toLowerCase();
      const cat = (p.category || "").toLowerCase();
      const date = (p.date || "").toLowerCase();
      const amt = (p.amount || "").toString();
      const monthName = getPaymentMonthName(p.date).toLowerCase();
      return title.includes(searchQ) || note.includes(searchQ) || cat.includes(searchQ) || date.includes(searchQ) || amt.includes(searchQ) || monthName.includes(searchQ);
    });
  }

  // Akıllı Sıralama: Bekleyenler (yakın tarihten uzağa), ardından Ödenenler (yakın tarihten eskiye)
  const todayStr = new Date().toISOString().split("T")[0];
  list.sort((a, b) => {
    if (a.status !== b.status) {
      return a.status === "unpaid" ? -1 : 1;
    }
    if (a.status === "unpaid") {
      return (a.date || "").localeCompare(b.date || "");
    } else {
      return (b.date || "").localeCompare(a.date || "");
    }
  });

  if (list.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align: center; color: var(--slate-400); padding: 2.5rem 1rem;">
          <div style="font-size: 2.2rem; margin-bottom: 0.5rem;">💳</div>
          <div style="font-weight: 700; color: var(--slate-700); margin-bottom: 0.25rem;">Kayıtlı kişisel ödeme bulunamadı.</div>
          <div style="font-size: 0.85rem; color: var(--slate-500);">Filtre kriterlerinizi değiştirebilir veya yukarıdaki formdan yeni ödeme ekleyebilirsiniz.</div>
        </td>
      </tr>
    `;
    renderMonthlyPaidExpensesChart(totals);
    const modalExp = document.getElementById("modalExpenseSummary");
    if (modalExp && modalExp.classList.contains("active")) {
      renderExpenseSummaryModal(period);
    }
    const modalUp = document.getElementById("modalUpcomingDebts");
    if (modalUp && modalUp.classList.contains("active")) {
      renderUpcomingDebtsModal();
    }
    const modalMonth = document.getElementById("modalMonthlyPaid");
    if (modalMonth && modalMonth.classList.contains("active")) {
      renderMonthlyPaidModal();
    }
    return;
  }

  tbody.innerHTML = list.map((p, idx) => {
    // Kategori rozet sınıfı
    let catClass = "badge-cat-other";
    const catStr = (p.category || "").toLowerCase();
    if (catStr.includes("kart")) catClass = "badge-cat-card";
    else if (catStr.includes("fatura")) catClass = "badge-cat-bill";
    else if (catStr.includes("kira") || catStr.includes("aidat")) catClass = "badge-cat-rent";
    else if (catStr.includes("kredi")) catClass = "badge-cat-loan";
    else if (catStr.includes("sigorta") || catStr.includes("vergi") || catStr.includes("sgk") || catStr.includes("bağkur")) catClass = "badge-cat-tax";
    else if (catStr.includes("alışveriş") || catStr.includes("market")) catClass = "badge-cat-shop";

    // Vade durumu rozeti
    let dueBadge = "";
    if (p.status !== "paid" && p.date) {
      if (p.date < todayStr) {
        dueBadge = `<span class="badge" style="background:#fee2e2; color:#b91c1c; font-size:0.7rem; font-weight:700; margin-left:6px; padding:2px 6px;">Gecikmiş!</span>`;
      } else if (p.date === todayStr) {
        dueBadge = `<span class="badge" style="background:#fef3c7; color:#b45309; font-size:0.7rem; font-weight:700; margin-left:6px; padding:2px 6px;">Bugün!</span>`;
      }
    }

    const isPaid = p.status === "paid";
    const statusBtn = isPaid
      ? `<button type="button" class="btn-status-toggle status-paid" onclick="toggleMyPaymentStatus('${p.id}')" title="Bekliyor olarak değiştirmek için tıklayın">🟢 Ödendi ✓</button>`
      : `<button type="button" class="btn-status-toggle status-unpaid" onclick="toggleMyPaymentStatus('${p.id}')" title="Ödendi olarak işaretlemek için tıklayın">🔴 Bekliyor</button>`;

    return `
      <tr style="${isPaid ? 'opacity: 0.85;' : 'background: #fff;'}">
        <td style="font-weight: 700; color: var(--slate-400); width: 45px;">#${idx + 1}</td>
        <td style="white-space: nowrap; font-weight: 600; color: var(--slate-800);">
          📅 ${formatDateTurkish(p.date)}
          ${dueBadge}
        </td>
        <td>
          <div style="font-weight: 700; color: var(--slate-900); font-size: 0.95rem;">${escapeHtml(p.title)}</div>
        </td>
        <td>
          <span class="badge-category ${catClass}">${escapeHtml(p.category || 'Diğer')}</span>
        </td>
        <td style="text-align: right;">
          <span class="tabular-nums" style="font-weight: 800; font-size: 1rem; color: ${isPaid ? '#059669' : '#e11d48'};">
            ${formatCurrency(p.amount)}
          </span>
        </td>
        <td style="text-align: center;">
          ${statusBtn}
        </td>
        <td style="color: var(--slate-600); font-size: 0.85rem; max-width: 220px;">
          ${p.note ? escapeHtml(p.note) : '<span style="color:var(--slate-400);">-</span>'}
        </td>
        <td style="text-align: center; white-space: nowrap;">
          <button type="button" class="btn-action-icon" onclick="openEditMyPaymentModal('${p.id}')" title="Ödemeyi Düzenle">✏️</button>
          <button type="button" class="btn-action-icon danger" onclick="handleDeleteMyPayment('${p.id}')" title="Ödemeyi Sil">🗑️</button>
        </td>
      </tr>
    `;
  }).join("");

  // 6. Ay Ay Ödediklerimiz ve Bekleyen Borçlar Grafiği
  renderMonthlyPaidExpensesChart(totals);

  const modalExp = document.getElementById("modalExpenseSummary");
  if (modalExp && modalExp.classList.contains("active")) {
    renderExpenseSummaryModal(period);
  }

  const modalUp = document.getElementById("modalUpcomingDebts");
  if (modalUp && modalUp.classList.contains("active")) {
    renderUpcomingDebtsModal();
  }

  const modalMonth = document.getElementById("modalMonthlyPaid");
  if (modalMonth && modalMonth.classList.contains("active")) {
    renderMonthlyPaidModal();
  }
}

function handleQuickMyPaymentSubmit(event) {
  event.preventDefault();
  const period = getActivePeriod();
  if (!period) return;
  ensureMyPaymentsArray(period);

  const dateVal = document.getElementById("quickMyPaymentDateInput").value;
  const titleVal = document.getElementById("quickMyPaymentTitleInput").value.trim();
  const amountVal = parseFloat(document.getElementById("quickMyPaymentAmountInput").value) || 0;
  const catVal = document.getElementById("quickMyPaymentCategorySelect").value || "Diğer";
  const statusVal = document.getElementById("quickMyPaymentStatusSelect").value || "unpaid";
  const noteVal = document.getElementById("quickMyPaymentNoteInput").value.trim();

  if (!dateVal || !titleVal || amountVal <= 0) {
    alert("Lütfen ödeme tarihi, ödeme bilgisi ve geçerli bir tutar giriniz.");
    return;
  }

  const newPayment = {
    id: "mypay_" + Date.now(),
    date: dateVal,
    title: titleVal,
    amount: amountVal,
    category: catVal,
    status: statusVal,
    paidDate: statusVal === "paid" ? dateVal : "",
    note: noteVal,
    createdAt: Date.now()
  };

  period.myPayments.unshift(newPayment);
  saveData();
  renderApp();

  // Alanları sıfırla
  document.getElementById("quickMyPaymentTitleInput").value = "";
  document.getElementById("quickMyPaymentAmountInput").value = "";
  document.getElementById("quickMyPaymentNoteInput").value = "";
  showToast(`Ödeme kaydedildi: ${titleVal} (${formatCurrency(amountVal)})`);
}

function openAddMyPaymentModal() {
  const form = document.getElementById("formMyPayment");
  if (form) form.reset();

  document.getElementById("myPaymentEditId").value = "";
  document.getElementById("modalMyPaymentTitle").textContent = "💳 Yeni Ödeme Girişi";

  const btnDel = document.getElementById("btnDeleteMyPayment");
  if (btnDel) btnDel.style.display = "none";

  const dateInput = document.getElementById("modalMyPaymentDate");
  if (dateInput) {
    dateInput.value = new Date().toISOString().split("T")[0];
  }

  openModal("modalMyPayment");
}

function openEditMyPaymentModal(paymentId) {
  const period = getActivePeriod();
  if (!period) return;
  ensureMyPaymentsArray(period);

  const p = (period.myPayments || []).find(item => item.id === paymentId);
  if (!p) return;

  document.getElementById("myPaymentEditId").value = p.id;
  document.getElementById("modalMyPaymentTitle").textContent = "✏️ Ödeme Bilgisini Düzenle";

  const btnDel = document.getElementById("btnDeleteMyPayment");
  if (btnDel) btnDel.style.display = "inline-flex";

  document.getElementById("modalMyPaymentDate").value = p.date || "";
  document.getElementById("modalMyPaymentTitleInput").value = p.title || "";
  document.getElementById("modalMyPaymentAmount").value = p.amount || "";
  document.getElementById("modalMyPaymentCategory").value = p.category || "Diğer";
  document.getElementById("modalMyPaymentStatus").value = p.status || "unpaid";
  document.getElementById("modalMyPaymentNote").value = p.note || "";

  openModal("modalMyPayment");
}

function handleSaveMyPayment(event) {
  event.preventDefault();
  const period = getActivePeriod();
  if (!period) return;
  ensureMyPaymentsArray(period);

  const editId = document.getElementById("myPaymentEditId").value;
  const dateVal = document.getElementById("modalMyPaymentDate").value;
  const titleVal = document.getElementById("modalMyPaymentTitleInput").value.trim();
  const amountVal = parseFloat(document.getElementById("modalMyPaymentAmount").value) || 0;
  const catVal = document.getElementById("modalMyPaymentCategory").value || "Diğer";
  const statusVal = document.getElementById("modalMyPaymentStatus").value || "unpaid";
  const noteVal = document.getElementById("modalMyPaymentNote").value.trim();

  if (!dateVal || !titleVal || amountVal <= 0) {
    alert("Lütfen ödeme tarihi, ödeme bilgisi ve geçerli bir tutar giriniz.");
    return;
  }

  if (editId) {
    const existing = period.myPayments.find(p => p.id === editId);
    if (existing) {
      existing.date = dateVal;
      existing.title = titleVal;
      existing.amount = amountVal;
      existing.category = catVal;
      existing.status = statusVal;
      existing.paidDate = statusVal === "paid" ? (existing.paidDate || dateVal) : "";
      existing.note = noteVal;
    }
    showToast(`Ödeme güncellendi: ${titleVal}`);
  } else {
    period.myPayments.unshift({
      id: "mypay_" + Date.now(),
      date: dateVal,
      title: titleVal,
      amount: amountVal,
      category: catVal,
      status: statusVal,
      paidDate: statusVal === "paid" ? dateVal : "",
      note: noteVal,
      createdAt: Date.now()
    });
    showToast(`Yeni ödeme eklendi: ${titleVal}`);
  }

  saveData();
  closeModal("modalMyPayment");
  renderApp();
}

function handleDeleteMyPayment(paymentId) {
  const period = getActivePeriod();
  if (!period || !period.myPayments) return;

  const p = period.myPayments.find(item => item.id === paymentId);
  if (!p) return;

  if (!confirm(`"${p.title}" (${formatCurrency(p.amount)}) ödemesini silmek istediğinize emin misiniz?`)) {
    return;
  }

  const idx = period.myPayments.findIndex(item => item.id === paymentId);
  if (idx !== -1) {
    period.myPayments.splice(idx, 1);
  }

  saveData();
  renderApp();
  showToast(`Ödeme silindi: ${p.title}`);
}

function handleModalDeleteMyPayment() {
  const editId = document.getElementById("myPaymentEditId").value;
  if (editId) {
    closeModal("modalMyPayment");
    handleDeleteMyPayment(editId);
  }
}

function toggleMyPaymentStatus(paymentId) {
  const period = getActivePeriod();
  if (!period || !period.myPayments) return;

  const p = period.myPayments.find(item => item.id === paymentId);
  if (!p) return;

  if (p.status === "paid") {
    p.status = "unpaid";
    p.paidDate = "";
    showToast(`🔴 "${p.title}" tekrar bekleyen borçlara aktarıldı.`);
  } else {
    p.status = "paid";
    p.paidDate = new Date().toISOString().split("T")[0];
    showToast(`🟢 "${p.title}" ödendi olarak işaretlendi ve ödenenlere aktarıldı! 🎉`);
  }

  saveData();
  renderApp();

  // Açık olan modal pencereler varsa canlı güncelle
  const modalUp = document.getElementById("modalUpcomingDebts");
  if (modalUp && modalUp.classList.contains("active")) {
    renderUpcomingDebtsModal();
  }
  const modalPaid = document.getElementById("modalMonthlyPaid");
  if (modalPaid && modalPaid.classList.contains("active")) {
    renderMonthlyPaidModal();
  }
}

function setMyPaymentFilter(filter) {
  appState.myPaymentsFilter = filter;
  renderMyPayments(getActivePeriod());
}

function handleMyPaymentCategoryFilter(category) {
  appState.myPaymentsCategoryFilter = category;
  renderMyPayments(getActivePeriod());
}

function handleMyPaymentSearch(query) {
  appState.myPaymentsSearch = query;
  renderMyPayments(getActivePeriod());
}

function exportMyPaymentsToCSV() {
  const period = getActivePeriod();
  if (!period) return;
  ensureMyPaymentsArray(period);

  const list = period.myPayments || [];
  if (list.length === 0) {
    alert("Dışa aktarılacak ödeme kaydı bulunamadı.");
    return;
  }

  let csvContent = "data:text/csv;charset=utf-8,\uFEFF";
  csvContent += "Tarih,Ödeme Bilgisi,Kategori,Tutar (TL),Durum,Ödendiği Tarih,Not / Açıklama\n";

  list.forEach(p => {
    const row = [
      `"${p.date || ''}"`,
      `"${(p.title || '').replace(/"/g, '""')}"`,
      `"${(p.category || '').replace(/"/g, '""')}"`,
      `"${p.amount || 0}"`,
      `"${p.status === 'paid' ? 'Ödendi' : 'Bekliyor'}"`,
      `"${p.paidDate || ''}"`,
      `"${(p.note || '').replace(/"/g, '""')}"`
    ];
    csvContent += row.join(",") + "\n";
  });

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", `Cem_Baba_Odemelerim_${period.id}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// ==========================================================================
// GİDER TOPLAM BİLGİ PENCERESİ & AYLIK RAPOR MODALI
// ==========================================================================

function openExpenseSummaryModal() {
  const period = getActivePeriod();
  if (!period) return;
  renderExpenseSummaryModal(period);
  openModal("modalExpenseSummary");
}

function renderExpenseSummaryModal(period) {
  if (!period) period = getActivePeriod();
  if (!period) return;

  const totals = calculateMyPaymentsTotals(period);
  const tutoringTotals = calculateTotals(period);
  const totalRevenue = tutoringTotals.totalRevenue || 0;
  const netDiff = totalRevenue - totals.totalAmount;

  // 1. Üst KPI Kartları
  const elTotalAmt = document.getElementById("modalExpTotalAmount");
  if (elTotalAmt) elTotalAmt.textContent = formatCurrency(totals.totalAmount);

  const elTotalCnt = document.getElementById("modalExpTotalCount");
  if (elTotalCnt) elTotalCnt.textContent = `${totals.totalCount} adet kişisel gider kaydı`;

  const elPaidAmt = document.getElementById("modalExpPaidAmount");
  if (elPaidAmt) elPaidAmt.textContent = formatCurrency(totals.paidAmount);

  const elPaidPct = document.getElementById("modalExpPaidPercent");
  if (elPaidPct) {
    const pct = totals.totalAmount > 0 ? Math.round((totals.paidAmount / totals.totalAmount) * 100) : 0;
    elPaidPct.textContent = `%${pct} tamamlandı (${totals.paidCount} adet)`;
  }

  const elUnpaidAmt = document.getElementById("modalExpUnpaidAmount");
  if (elUnpaidAmt) elUnpaidAmt.textContent = formatCurrency(totals.unpaidAmount);

  const elUnpaidCnt = document.getElementById("modalExpUnpaidCount");
  if (elUnpaidCnt) elUnpaidCnt.textContent = `${totals.unpaidCount} adet ödeme bekliyor`;

  const elNetCard = document.getElementById("modalExpNetCard");
  const elNetAmt = document.getElementById("modalExpNetAmount");
  const elNetSub = document.getElementById("modalExpNetSubtext");

  if (elNetAmt) {
    elNetAmt.textContent = formatCurrency(netDiff);
    if (netDiff >= 0) {
      elNetAmt.style.color = "#059669";
      if (elNetCard) {
        elNetCard.style.borderLeftColor = "#059669";
        elNetCard.style.background = "#f0fdf4";
      }
      if (elNetSub) elNetSub.textContent = "Ders geliri giderlerden fazla (+) 🎉";
    } else {
      elNetAmt.style.color = "#dc2626";
      if (elNetCard) {
        elNetCard.style.borderLeftColor = "#dc2626";
        elNetCard.style.background = "#fff1f2";
      }
      if (elNetSub) elNetSub.textContent = "Giderler ders gelirinden fazla (-)";
    }
  }

  // 2. Ay Ay Detaylı Gider Tablosu
  const tbody = document.getElementById("modalMonthlyExpenseTableBody");
  const tfoot = document.getElementById("modalMonthlyExpenseTableFoot");

  if (tbody) {
    let rowsHtml = "";
    MONTHS.forEach(m => {
      const exp = totals.monthExpenses[m] || { total: 0, paid: 0, unpaid: 0, count: 0 };
      const rev = tutoringTotals.monthTotals[m] ? tutoringTotals.monthTotals[m].revenue : 0;
      const monthNet = rev - exp.total;

      let statusBadge = "";
      if (exp.count === 0) {
        statusBadge = `<span style="color: var(--slate-400); font-size: 0.8rem;">— Kayıt Yok</span>`;
      } else if (exp.unpaid === 0) {
        statusBadge = `<span class="badge" style="background:#dcfce7; color:#15803d; font-size:0.75rem; font-weight:700;">🟢 %100 Ödendi</span>`;
      } else {
        const pct = Math.round((exp.paid / (exp.total || 1)) * 100);
        statusBadge = `
          <div style="display: flex; flex-direction: column; gap: 3px; align-items: center;">
            <div class="expense-progress-track" title="%${pct} ödendi">
              <div class="expense-progress-fill" style="width: ${pct}%;"></div>
            </div>
            <span style="font-size: 0.72rem; color: var(--slate-600); font-weight: 600;">%${pct} ödendi</span>
          </div>
        `;
      }

      const netBadge = monthNet >= 0
        ? `<span class="badge-net-pos">+${formatCurrency(monthNet)}</span>`
        : `<span class="badge-net-neg">${formatCurrency(monthNet)}</span>`;

      rowsHtml += `
        <tr style="${exp.count > 0 ? '' : 'opacity: 0.6;'}">
          <td style="font-weight: 700; color: var(--slate-800); white-space: nowrap;">
            📅 ${m}
          </td>
          <td style="text-align: right; font-weight: 700; color: var(--slate-900);" class="tabular-nums">
            ${formatCurrency(exp.total)}
          </td>
          <td style="text-align: right; font-weight: 600; color: #16a34a;" class="tabular-nums">
            ${formatCurrency(exp.paid)}
          </td>
          <td style="text-align: right; font-weight: 600; color: ${exp.unpaid > 0 ? '#dc2626' : 'var(--slate-400)'};" class="tabular-nums">
            ${exp.unpaid > 0 ? formatCurrency(exp.unpaid) : '0 ₺'}
          </td>
          <td style="text-align: right; font-weight: 600; color: var(--primary);" class="tabular-nums">
            ${formatCurrency(rev)}
          </td>
          <td style="text-align: right;" class="tabular-nums">
            ${netBadge}
          </td>
          <td style="text-align: center;">
            ${statusBadge}
          </td>
          <td style="text-align: center; color: var(--slate-600); font-size: 0.85rem;">
            ${exp.count > 0 ? `${exp.count} adet` : '-'}
          </td>
          <td style="text-align: center;">
            <button type="button" class="btn btn-secondary" onclick="filterToMonth('${m}')" style="padding: 3px 8px; font-size: 0.75rem; white-space: nowrap;" title="${m} ayı giderlerini filtrele">
              🔍 Gör
            </button>
          </td>
        </tr>
      `;
    });
    tbody.innerHTML = rowsHtml;
  }

  if (tfoot) {
    const overallPct = totals.totalAmount > 0 ? Math.round((totals.paidAmount / totals.totalAmount) * 100) : 0;
    const totalNetBadge = netDiff >= 0
      ? `<span class="badge-net-pos">+${formatCurrency(netDiff)}</span>`
      : `<span class="badge-net-neg">${formatCurrency(netDiff)}</span>`;

    tfoot.innerHTML = `
      <tr>
        <td>TOPLAM</td>
        <td style="text-align: right; color: var(--slate-900); font-size: 1rem;">${formatCurrency(totals.totalAmount)}</td>
        <td style="text-align: right; color: #16a34a;">${formatCurrency(totals.paidAmount)}</td>
        <td style="text-align: right; color: #dc2626;">${formatCurrency(totals.unpaidAmount)}</td>
        <td style="text-align: right; color: var(--primary); font-size: 1rem;">${formatCurrency(totalRevenue)}</td>
        <td style="text-align: right;">${totalNetBadge}</td>
        <td style="text-align: center; font-size: 0.8rem; color: var(--slate-700);">%${overallPct} ödendi</td>
        <td style="text-align: center;">${totals.totalCount} adet</td>
        <td style="text-align: center;">
          <button type="button" class="btn btn-secondary" onclick="filterToMonth('all')" style="padding: 3px 8px; font-size: 0.75rem; white-space: nowrap;">
            Tümü
          </button>
        </td>
      </tr>
    `;
  }

  // 3. Kategori Bazında Gider Dağılım Kartları
  const catGrid = document.getElementById("modalCategoryExpenseGrid");
  if (catGrid) {
    const CAT_ICONS = {
      "Kredi Kartı": "💳",
      "Fatura": "💡",
      "Kira & Aidat": "🏠",
      "Kredi Taksiti": "🏦",
      "Sigorta & Vergi": "🛡️",
      "Alışveriş & Market": "🛒",
      "Diğer": "📝"
    };

    const categories = Object.keys(totals.categoryExpenses);
    if (categories.length === 0) {
      catGrid.innerHTML = `<div style="grid-column: 1 / -1; text-align: center; color: var(--slate-400); padding: 1rem;">Henüz kategori verisi bulunmuyor.</div>`;
    } else {
      categories.sort((a, b) => totals.categoryExpenses[b].total - totals.categoryExpenses[a].total);

      catGrid.innerHTML = categories.map(cat => {
        const cData = totals.categoryExpenses[cat];
        const pct = totals.totalAmount > 0 ? Math.round((cData.total / totals.totalAmount) * 100) : 0;
        const icon = CAT_ICONS[cat] || "🏷️";
        return `
          <div class="category-stat-card" onclick="filterToCategory('${cat}')" style="cursor: pointer;" title="${cat} kategorisindeki ödemeleri listelemek için tıklayın">
            <div>
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.4rem;">
                <div style="font-weight: 700; color: var(--slate-800); font-size: 0.9rem; display: flex; align-items: center; gap: 5px;">
                  <span>${icon}</span> ${escapeHtml(cat)}
                </div>
                <span class="badge" style="background: var(--slate-100); color: var(--slate-600); font-size: 0.7rem; font-weight: 700;">%${pct}</span>
              </div>
              <div style="font-size: 1.25rem; font-weight: 800; color: var(--slate-900); margin-bottom: 0.5rem;" class="tabular-nums">
                ${formatCurrency(cData.total)}
              </div>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.75rem; border-top: 1px dashed var(--slate-200); padding-top: 0.4rem; margin-top: 0.25rem;">
              <span style="color: #16a34a; font-weight: 600;">✓ ${formatCurrency(cData.paid)}</span>
              <span style="color: ${cData.unpaid > 0 ? '#dc2626' : 'var(--slate-400)'}; font-weight: 600;">⏳ ${formatCurrency(cData.unpaid)}</span>
              <span style="color: var(--slate-400);">${cData.count} adet</span>
            </div>
          </div>
        `;
      }).join("");
    }
  }

  // 4. Chart.js Grafik (Ay Ay Giderler & Özel Ders Geliri)
  renderExpenseSummaryChart(totals, tutoringTotals);
}

// Chart.js Aylık Gider vs Gelir Grafiği
function renderExpenseSummaryChart(totals, tutoringTotals) {
  const canvas = document.getElementById("chartMonthlyExpensesModal");
  if (!canvas || typeof Chart === "undefined") return;

  if (appState.charts.expenseSummary) {
    appState.charts.expenseSummary.destroy();
    appState.charts.expenseSummary = null;
  }

  const paidData = MONTHS.map(m => totals.monthExpenses[m] ? totals.monthExpenses[m].paid : 0);
  const unpaidData = MONTHS.map(m => totals.monthExpenses[m] ? totals.monthExpenses[m].unpaid : 0);
  const revenueData = MONTHS.map(m => tutoringTotals.monthTotals[m] ? tutoringTotals.monthTotals[m].revenue : 0);

  const ctx = canvas.getContext("2d");
  appState.charts.expenseSummary = new Chart(ctx, {
    data: {
      labels: MONTHS,
      datasets: [
        {
          type: "bar",
          label: "Ödenen Gider (₺)",
          data: paidData,
          backgroundColor: "rgba(16, 185, 129, 0.85)",
          hoverBackgroundColor: "rgba(16, 185, 129, 1)",
          stack: "expenseStack",
          borderRadius: 4
        },
        {
          type: "bar",
          label: "Bekleyen Gider (₺)",
          data: unpaidData,
          backgroundColor: "rgba(239, 68, 68, 0.85)",
          hoverBackgroundColor: "rgba(239, 68, 68, 1)",
          stack: "expenseStack",
          borderRadius: 4
        },
        {
          type: "line",
          label: "Özel Ders Geliri (₺)",
          data: revenueData,
          borderColor: "#4f46e5",
          backgroundColor: "rgba(79, 70, 229, 0.15)",
          pointBackgroundColor: "#4f46e5",
          pointBorderColor: "#ffffff",
          pointBorderWidth: 2,
          pointRadius: 4,
          pointHoverRadius: 6,
          borderWidth: 2.5,
          tension: 0.3,
          fill: false
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: "index",
        intersect: false
      },
      plugins: {
        legend: {
          position: "top",
          labels: {
            boxWidth: 12,
            font: { family: "'Inter', sans-serif", size: 12, weight: 600 }
          }
        },
        tooltip: {
          padding: 10,
          boxPadding: 4,
          usePointStyle: true,
          callbacks: {
            label: function(context) {
              return ` ${context.dataset.label}: ${formatCurrency(context.parsed.y)}`;
            }
          }
        }
      },
      scales: {
        x: {
          stacked: true,
          grid: { display: false }
        },
        y: {
          stacked: false,
          beginAtZero: true,
          ticks: {
            callback: function(val) {
              return val >= 1000 ? (val / 1000) + "k ₺" : val + " ₺";
            }
          }
        }
      }
    }
  });
}

// --------------------------------------------------------------------------
// 1. AY AY ÖDEDİKLERİMİZ VE BEKLEYEN BORÇLAR GRAFİĞİ
// --------------------------------------------------------------------------

function renderMonthlyPaidExpensesChart(totals) {
  const canvas = document.getElementById("chartMonthlyPaidExpenses");
  if (!canvas || typeof Chart === "undefined") return;

  if (appState.charts.monthlyPaidExpenses) {
    appState.charts.monthlyPaidExpenses.destroy();
    appState.charts.monthlyPaidExpenses = null;
  }

  const paidData = MONTHS.map(m => totals.monthExpenses[m] ? totals.monthExpenses[m].paid : 0);
  const unpaidData = MONTHS.map(m => totals.monthExpenses[m] ? totals.monthExpenses[m].unpaid : 0);

  const ctx = canvas.getContext("2d");
  appState.charts.monthlyPaidExpenses = new Chart(ctx, {
    type: "bar",
    data: {
      labels: MONTHS,
      datasets: [
        {
          label: "🟢 Her Ay Ödediklerimiz (₺)",
          data: paidData,
          backgroundColor: "rgba(16, 185, 129, 0.85)",
          hoverBackgroundColor: "rgba(16, 185, 129, 1)",
          borderColor: "#10b981",
          borderWidth: 1,
          borderRadius: 6,
          barPercentage: 0.7,
          categoryPercentage: 0.8
        },
        {
          label: "🔴 Kalan Bekleyen Borç (₺)",
          data: unpaidData,
          backgroundColor: "rgba(239, 68, 68, 0.75)",
          hoverBackgroundColor: "rgba(239, 68, 68, 1)",
          borderColor: "#ef4444",
          borderWidth: 1,
          borderRadius: 6,
          barPercentage: 0.7,
          categoryPercentage: 0.8
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      onClick: (evt, activeElements) => {
        if (activeElements && activeElements.length > 0) {
          const index = activeElements[0].index;
          const monthName = MONTHS[index];
          if (monthName) {
            openMonthlyPaidModal(monthName);
          }
        }
      },
      plugins: {
        legend: {
          position: "top",
          labels: {
            boxWidth: 14,
            font: { family: "'Inter', sans-serif", size: 12, weight: 600 }
          }
        },
        tooltip: {
          padding: 10,
          boxPadding: 4,
          callbacks: {
            label: function(context) {
              const val = context.parsed.y || 0;
              return ` ${context.dataset.label}: ${formatCurrency(val)}`;
            },
            afterBody: function(contexts) {
              if (contexts && contexts.length > 0) {
                const idx = contexts[0].dataIndex;
                const m = MONTHS[idx];
                const exp = totals.monthExpenses[m];
                if (exp) {
                  return `\n📅 ${m} Ayı Özeti:\n• Toplam: ${formatCurrency(exp.total)}\n• Ödenen Kayıt: ${exp.paidCount} adet\n• Bekleyen Kayıt: ${exp.unpaidCount} adet\n(Tıklayarak o ay ödenenleri açabilirsiniz)`;
                }
              }
              return "";
            }
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { font: { family: "'Inter', sans-serif", weight: 600 } }
        },
        y: {
          beginAtZero: true,
          ticks: {
            callback: val => val >= 1000 ? (val / 1000) + "k ₺" : val + " ₺",
            font: { family: "'Inter', sans-serif" }
          }
        }
      }
    }
  });
}

// --------------------------------------------------------------------------
// 2. YAKLAŞAN ÖDEMELER VE BEKLEYEN BORÇLAR (GOOGLE TAKVİM ENTEGRASYONU)
// --------------------------------------------------------------------------

function getDebtDueStatus(dateStr) {
  if (!dateStr) {
    return {
      status: "none",
      days: 9999,
      badgeHtml: `<span class="debt-badge-future">📅 Tarih Belirtilmemiş</span>`,
      cardClass: "is-future",
      urgencyOrder: 9999
    };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr + "T00:00:00");
  const diffTime = target.getTime() - today.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    const overdue = Math.abs(diffDays);
    return {
      status: "overdue",
      days: diffDays,
      badgeHtml: `<span class="debt-badge-overdue">⚠️ ${overdue} gün gecikti!</span>`,
      cardClass: "is-overdue",
      urgencyOrder: diffDays
    };
  } else if (diffDays === 0) {
    return {
      status: "today",
      days: 0,
      badgeHtml: `<span class="debt-badge-today">⚡ Bugün Son Gün!</span>`,
      cardClass: "is-today",
      urgencyOrder: 0
    };
  } else if (diffDays <= 7) {
    return {
      status: "soon",
      days: diffDays,
      badgeHtml: `<span class="debt-badge-soon">⏰ ${diffDays} gün kaldı</span>`,
      cardClass: "is-soon",
      urgencyOrder: diffDays
    };
  } else {
    return {
      status: "future",
      days: diffDays,
      badgeHtml: `<span class="debt-badge-future">📅 ${diffDays} gün var</span>`,
      cardClass: "is-future",
      urgencyOrder: diffDays
    };
  }
}

function openUpcomingDebtsModal(filter) {
  appState.upcomingDebtsFilter = filter || "all";
  renderUpcomingDebtsModal();
  openModal("modalUpcomingDebts");
}

function filterUpcomingDebts(filter) {
  appState.upcomingDebtsFilter = filter || "all";
  const btnAll = document.getElementById("btnFilterUpAll");
  const btnOverdue = document.getElementById("btnFilterUpOverdue");
  const btnSoon = document.getElementById("btnFilterUpSoon");
  const btnMonth = document.getElementById("btnFilterUpMonth");

  if (btnAll) btnAll.classList.toggle("active", filter === "all");
  if (btnOverdue) btnOverdue.classList.toggle("active", filter === "overdue");
  if (btnSoon) btnSoon.classList.toggle("active", filter === "soon");
  if (btnMonth) btnMonth.classList.toggle("active", filter === "thisMonth");

  renderUpcomingDebtsModal();
}

function renderUpcomingDebtsModal() {
  const period = getActivePeriod();
  if (!period) return;
  ensureMyPaymentsArray(period);

  const list = period.myPayments || [];
  const unpaidList = list.filter(p => p.status === "unpaid");

  // İstatistikler
  let totalUnpaidAmt = 0;
  let overdueAmt = 0;
  let overdueCnt = 0;
  let soonAmt = 0;
  let soonCnt = 0;

  const currentMonthName = MONTH_MAP[new Date().getMonth() + 1] || "";

  unpaidList.forEach(p => {
    const amt = parseFloat(p.amount) || 0;
    totalUnpaidAmt += amt;
    const due = getDebtDueStatus(p.date);
    if (due.status === "overdue") {
      overdueAmt += amt;
      overdueCnt++;
    } else if (due.status === "today" || due.status === "soon") {
      soonAmt += amt;
      soonCnt++;
    }
  });

  const elUnpaidAmt = document.getElementById("modalUpUnpaidAmount");
  if (elUnpaidAmt) elUnpaidAmt.textContent = formatCurrency(totalUnpaidAmt);
  const elUnpaidCnt = document.getElementById("modalUpUnpaidCount");
  if (elUnpaidCnt) elUnpaidCnt.textContent = `${unpaidList.length} adet ödeme bekliyor`;

  const elOverdueAmt = document.getElementById("modalUpOverdueAmount");
  if (elOverdueAmt) elOverdueAmt.textContent = formatCurrency(overdueAmt);
  const elOverdueCnt = document.getElementById("modalUpOverdueCount");
  if (elOverdueCnt) elOverdueCnt.textContent = `${overdueCnt} adet geciken ödeme`;

  const elSoonAmt = document.getElementById("modalUpSoonAmount");
  if (elSoonAmt) elSoonAmt.textContent = formatCurrency(soonAmt);
  const elSoonCnt = document.getElementById("modalUpSoonCount");
  if (elSoonCnt) elSoonCnt.textContent = `${soonCnt} adet yakın ödeme`;

  // Sıralama: En acil (gecikmiş) en üstte
  unpaidList.sort((a, b) => {
    const dueA = getDebtDueStatus(a.date);
    const dueB = getDebtDueStatus(b.date);
    return dueA.urgencyOrder - dueB.urgencyOrder;
  });

  // Filtreleme
  const filter = appState.upcomingDebtsFilter || "all";
  const filteredList = unpaidList.filter(p => {
    const due = getDebtDueStatus(p.date);
    if (filter === "overdue") return due.status === "overdue";
    if (filter === "soon") return due.status === "today" || due.status === "soon";
    if (filter === "thisMonth") {
      const mName = getPaymentMonthName(p.date);
      return mName === currentMonthName;
    }
    return true;
  });

  const container = document.getElementById("modalUpcomingDebtsList");
  if (!container) return;

  if (filteredList.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 2.5rem 1rem; color: var(--slate-500); background: #f8fafc; border-radius: 10px; border: 1px dashed var(--slate-300);">
        <div style="font-size: 2.5rem; margin-bottom: 0.5rem;">🎉</div>
        <div style="font-weight: 700; font-size: 1.1rem; color: var(--slate-800); margin-bottom: 0.25rem;">
          ${filter === "overdue" ? "Günü geçmiş herhangi bir borcunuz bulunmuyor!" : filter === "soon" ? "Önümüzdeki 7 gün içerisinde vadesi yaklaşan borç yok!" : "Bekleyen borç bulunmuyor!"}
        </div>
        <div style="font-size: 0.85rem; color: var(--slate-500);">Tüm ödemeleriniz güncel ve kontrol altında.</div>
      </div>
    `;
    return;
  }

  const CAT_ICONS = {
    "Kredi Kartı": "💳",
    "Fatura": "💡",
    "Kira & Aidat": "🏠",
    "Kredi Taksiti": "🏦",
    "Sigorta & Vergi": "🛡️",
    "Alışveriş & Market": "🛒",
    "Diğer": "📝"
  };

  container.innerHTML = filteredList.map(item => {
    const due = getDebtDueStatus(item.date);
    const catIcon = CAT_ICONS[item.category] || "🏷️";
    const dateFormatted = item.date ? formatDateTurkish(item.date) : "Tarih Belirtilmemiş";

    return `
      <div class="upcoming-debt-card ${due.cardClass}">
        <div style="display: flex; align-items: flex-start; gap: 0.85rem; flex: 1; min-width: 220px;">
          <div style="font-size: 1.8rem; line-height: 1; padding-top: 2px;">
            ${catIcon}
          </div>
          <div>
            <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 4px;">
              <span style="font-weight: 800; color: var(--slate-900); font-size: 1rem;">${escapeHtml(item.title)}</span>
              ${due.badgeHtml}
              <span class="badge" style="background: var(--slate-100); color: var(--slate-700); font-size: 0.72rem;">${escapeHtml(item.category || 'Gider')}</span>
            </div>
            <div style="font-size: 0.825rem; color: var(--slate-600); display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
              <span>📅 Son Ödeme: <strong>${dateFormatted}</strong></span>
              ${item.note ? `<span style="color: var(--slate-500);">📝 ${escapeHtml(item.note)}</span>` : ''}
            </div>
          </div>
        </div>

        <div style="display: flex; align-items: center; gap: 1rem; flex-wrap: wrap; justify-content: flex-end;">
          <div style="text-align: right;">
            <div style="font-size: 1.35rem; font-weight: 800; color: var(--danger);" class="tabular-nums">
              ${formatCurrency(item.amount)}
            </div>
            <div style="font-size: 0.72rem; color: var(--slate-400);">Ödenmedi</div>
          </div>

          <div style="display: flex; gap: 0.5rem; align-items: center;">
            <button type="button" class="btn-google-cal" onclick="addToGoogleCalendar('${item.id}')" title="Bu borcu Google Takviminize ekleyin ve telefonunuzda hatırlatıcı kurun">
              <span>📅</span> Google Takvime Ekle
            </button>
            <button type="button" class="btn btn-success btn-sm" onclick="markDebtAsPaidFromModal('${item.id}')" style="padding: 6px 12px; font-weight: 700; font-size: 0.8rem; white-space: nowrap;" title="Bu borcu ödendi olarak işaretle">
              <span>🟢</span> Ödendi Yap
            </button>
          </div>
        </div>
      </div>
    `;
  }).join("");
}

function addToGoogleCalendar(paymentId) {
  const period = getActivePeriod();
  if (!period) return;
  const item = (period.myPayments || []).find(p => p.id === paymentId);
  if (!item) return;

  const dateStr = item.date;
  if (!dateStr) {
    alert("Bu ödemenin tarihi belirtilmemiş!");
    return;
  }

  // YYYYMMDD formatı
  const cleanStart = dateStr.replace(/-/g, "");
  // Bitiş günü ertesi gün (tüm gün etkinliği için)
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const cleanEnd = `${y}${m}${day}`;

  const title = `Ödeme: ${item.title} (${formatCurrency(item.amount)})`;
  const details = `💰 Ödenecek Tutar: ${formatCurrency(item.amount)}\n🏷️ Kategori: ${item.category || 'Gider'}\n📅 Son Ödeme Tarihi: ${formatDateTurkish(item.date)}\n${item.note ? '📝 Not: ' + item.note + '\n' : ''}\n(DersTakip Pro - Borç & Gider Hatırlatması)`;

  const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${cleanStart}/${cleanEnd}&details=${encodeURIComponent(details)}&sf=true&output=xml`;
  window.open(url, "_blank");
}

function exportUpcomingDebtsToICS() {
  const period = getActivePeriod();
  if (!period) return;
  const unpaid = (period.myPayments || []).filter(p => p.status === "unpaid" && p.date);
  if (unpaid.length === 0) {
    showToast("Aktarılacak bekleyen borç bulunamadı.");
    return;
  }

  let ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//DersTakip Pro//Kisisel Odemeler//TR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:Cem Baba - Bekleyen Borçlar ve Ödemeler"
  ];

  const nowStr = new Date().toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z";

  unpaid.forEach(item => {
    const cleanDate = item.date.replace(/-/g, "");
    const d = new Date(item.date + "T00:00:00");
    d.setDate(d.getDate() + 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const nextDate = `${y}${m}${day}`;

    ics.push("BEGIN:VEVENT");
    ics.push(`UID:pay-${item.id}-${cleanDate}@derstakip.pro`);
    ics.push(`DTSTAMP:${nowStr}`);
    ics.push(`DTSTART;VALUE=DATE:${cleanDate}`);
    ics.push(`DTEND;VALUE=DATE:${nextDate}`);
    ics.push(`SUMMARY:Ödeme: ${item.title.replace(/\n/g, " ")} (${formatCurrency(item.amount)})`);
    ics.push(`DESCRIPTION:Tutar: ${formatCurrency(item.amount)}\\nKategori: ${item.category || 'Gider'}\\nNot: ${(item.note || '').replace(/\n/g, " ")}`);
    ics.push("STATUS:CONFIRMED");
    ics.push("TRANSP:TRANSPARENT");
    ics.push("END:VEVENT");
  });

  ics.push("END:VCALENDAR");

  const blob = new Blob([ics.join("\r\n")], { type: "text/calendar;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `Cem_Baba_Bekleyen_Borclar_${new Date().toISOString().slice(0, 10)}.ics`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast("📅 Google Takvim / iCal dosyası indirildi!");
}

function markDebtAsPaidFromModal(paymentId) {
  toggleMyPaymentStatus(paymentId);
}

// --------------------------------------------------------------------------
// 3. O AYKİ ÖDENENLER DETAY VE BİLGİLENDİRME MODALI
// --------------------------------------------------------------------------

function openMonthlyPaidModal(month) {
  if (month && month !== "all") {
    appState.modalMonthlyPaidMonth = month;
  } else if (!appState.modalMonthlyPaidMonth || appState.modalMonthlyPaidMonth === "all") {
    if (appState.myPaymentsMonthFilter && appState.myPaymentsMonthFilter !== "all") {
      appState.modalMonthlyPaidMonth = appState.myPaymentsMonthFilter;
    } else {
      const curCalMonth = MONTH_MAP[new Date().getMonth() + 1];
      appState.modalMonthlyPaidMonth = curCalMonth || "Ekim";
    }
  }

  renderMonthlyPaidModal();
  openModal("modalMonthlyPaid");
}

function filterModalMonthlyPaidTo(month) {
  appState.modalMonthlyPaidMonth = month;
  renderMonthlyPaidModal();
}

function renderMonthlyPaidModal(targetMonth) {
  if (targetMonth) appState.modalMonthlyPaidMonth = targetMonth;
  const period = getActivePeriod();
  if (!period) return;
  ensureMyPaymentsArray(period);

  const activeMonth = appState.modalMonthlyPaidMonth || "Ekim";
  const totals = calculateMyPaymentsTotals(period);
  const monthData = totals.monthExpenses[activeMonth] || { total: 0, paid: 0, unpaid: 0, count: 0, paidCount: 0, unpaidCount: 0, items: [] };

  // 1. Modal Başlıkları
  const titleEl = document.getElementById("modalMonthlyPaidHeaderTitle");
  if (titleEl) {
    titleEl.textContent = `🟢 ${activeMonth} Ayında Ödenen Giderler ve Borçlar`;
  }

  const tableTitleEl = document.getElementById("modalMonthTableTitle");
  if (tableTitleEl) {
    tableTitleEl.textContent = `${activeMonth} Ayı Ödenenler Dökümü`;
  }

  const itemBadgeEl = document.getElementById("modalMonthItemBadge");
  if (itemBadgeEl) {
    itemBadgeEl.textContent = `${monthData.paidCount} Ödenen Kayıt`;
  }

  // 2. Yatay Ay Çipleri
  const chipStrip = document.getElementById("modalMonthlyPaidChipStrip");
  if (chipStrip) {
    chipStrip.innerHTML = MONTHS.map(m => {
      const exp = totals.monthExpenses[m] || { paid: 0, paidCount: 0 };
      const isActive = m === activeMonth;
      return `
        <button type="button" class="month-chip-tab ${isActive ? 'active' : ''}" onclick="filterModalMonthlyPaidTo('${m}')" title="${m} ayı ödenenlerini incele">
          📅 ${m} ${exp.paidCount > 0 ? `<span style="background: rgba(0,0,0,0.12); padding: 2px 6px; border-radius: 10px; font-size: 0.72rem; margin-left: 4px;">${formatCurrency(exp.paid)}</span>` : ''}
        </button>
      `;
    }).join("");
  }

  // 3. Özet KPI Kartları
  const cardLabel = document.getElementById("modalMonthPaidCardLabel");
  if (cardLabel) cardLabel.textContent = `🟢 ${activeMonth} Ayı Ödenen Toplam`;

  const paidAmtEl = document.getElementById("modalMonthPaidAmount");
  if (paidAmtEl) paidAmtEl.textContent = formatCurrency(monthData.paid);

  const paidCntEl = document.getElementById("modalMonthPaidCount");
  if (paidCntEl) paidCntEl.textContent = `${monthData.paidCount} adet ödendi`;

  const totalExpAmtEl = document.getElementById("modalMonthTotalExpenseAmount");
  if (totalExpAmtEl) totalExpAmtEl.textContent = formatCurrency(monthData.total);

  const totalExpCntEl = document.getElementById("modalMonthTotalExpenseCount");
  if (totalExpCntEl) totalExpCntEl.textContent = `${monthData.count} adet toplam kayıt`;

  const remUnpaidEl = document.getElementById("modalMonthRemainingUnpaidAmount");
  if (remUnpaidEl) remUnpaidEl.textContent = formatCurrency(monthData.unpaid);

  const paidPctEl = document.getElementById("modalMonthPaidPercent");
  if (paidPctEl) {
    const pct = monthData.total > 0 ? Math.round((monthData.paid / monthData.total) * 100) : 0;
    paidPctEl.textContent = `%${pct} ödendi (${monthData.unpaidCount} adet bekliyor)`;
  }

  // 4. Tablo Satırları
  const tbody = document.getElementById("modalMonthlyPaidTableBody");
  if (!tbody) return;

  const paidItems = (monthData.items || []).filter(p => p.status === "paid");
  paidItems.sort((a, b) => (b.paidDate || b.date || "").localeCompare(a.paidDate || a.date || ""));

  if (paidItems.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" style="text-align: center; padding: 2.5rem 1rem; color: var(--slate-500);">
          <div style="font-size: 2.4rem; margin-bottom: 0.5rem;">ℹ️</div>
          <div style="font-weight: 700; color: var(--slate-800); margin-bottom: 0.25rem;">${activeMonth} ayı için henüz ödenmiş kayıt bulunmuyor.</div>
          <div style="font-size: 0.85rem; color: var(--slate-500);">${monthData.unpaidCount > 0 ? `Bu ayda ${formatCurrency(monthData.unpaid)} tutarında ${monthData.unpaidCount} adet bekleyen borcunuz var.` : "Bu aya ait harcama kaydı bulunmuyor."}</div>
        </td>
      </tr>
    `;
    return;
  }

  const CAT_ICONS = {
    "Kredi Kartı": "💳",
    "Fatura": "💡",
    "Kira & Aidat": "🏠",
    "Kredi Taksiti": "🏦",
    "Sigorta & Vergi": "🛡️",
    "Alışveriş & Market": "🛒",
    "Diğer": "📝"
  };

  tbody.innerHTML = paidItems.map(item => {
    const icon = CAT_ICONS[item.category] || "🏷️";
    const dateFormatted = item.paidDate ? formatDateTurkish(item.paidDate) : formatDateTurkish(item.date);

    return `
      <tr>
        <td style="font-weight: 600; color: var(--slate-800); white-space: nowrap;">
          📅 ${dateFormatted}
        </td>
        <td>
          <span class="badge" style="background: var(--slate-100); color: var(--slate-800); font-weight: 600; font-size: 0.775rem;">
            ${icon} ${escapeHtml(item.category || 'Gider')}
          </span>
        </td>
        <td>
          <div style="font-weight: 700; color: var(--slate-900);">${escapeHtml(item.title)}</div>
          ${item.note ? `<div style="font-size: 0.775rem; color: var(--slate-500); margin-top: 2px;">📝 ${escapeHtml(item.note)}</div>` : ''}
        </td>
        <td style="text-align: right; font-weight: 800; font-size: 1.05rem; color: #16a34a;" class="tabular-nums">
          ${formatCurrency(item.amount)}
        </td>
        <td style="text-align: center;">
          <button type="button" class="btn btn-secondary btn-sm" onclick="markPaymentAsUnpaidFromModal('${item.id}')" style="padding: 3px 8px; font-size: 0.75rem; white-space: nowrap; color: #dc2626;" title="Bu ödemeyi ödenmedi durumuna alıp bekleyenlere taşı">
            ↩️ Ödenmedi Yap
          </button>
        </td>
      </tr>
    `;
  }).join("");
}

function markPaymentAsUnpaidFromModal(paymentId) {
  const period = getActivePeriod();
  if (!period) return;
  ensureMyPaymentsArray(period);

  const item = period.myPayments.find(p => p.id === paymentId);
  if (!item) return;

  item.status = "unpaid";
  item.paidDate = "";
  saveData();

  renderApp();
  renderMonthlyPaidModal();
  showToast(`↩️ "${item.title}" bekleyen borçlar listesine alındı.`);
}

function exportMonthlyPaidToCSV() {
  const period = getActivePeriod();
  if (!period) return;
  const month = appState.modalMonthlyPaidMonth || "Ekim";
  const totals = calculateMyPaymentsTotals(period);
  const monthData = totals.monthExpenses[month];
  if (!monthData) return;

  const paidItems = (monthData.items || []).filter(p => p.status === "paid");
  if (paidItems.length === 0) {
    showToast(`${month} ayında ödenmiş kayıt bulunamadı.`);
    return;
  }

  let csv = "Ödeme Tarihi;Ödeme Bilgisi;Kategori;Tutar;Durum;Not\n";
  paidItems.forEach(p => {
    csv += `"${p.paidDate || p.date}";"${p.title.replace(/"/g, '""')}";"${p.category || ''}";"${p.amount}";"Ödendi";"${(p.note || '').replace(/"/g, '""')}"\n`;
  });

  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `Cem_Baba_${month}_Odenen_Giderler.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast(`📊 ${month} ayı ödenenler Excel listesi indirildi.`);
}

function handleMyPaymentMonthFilter(monthName) {
  appState.myPaymentsMonthFilter = monthName;
  renderMyPayments(getActivePeriod());
}

function filterToMonth(monthName) {
  closeModal("modalExpenseSummary");
  appState.myPaymentsMonthFilter = monthName;
  switchTab("payments");
  renderMyPayments(getActivePeriod());
  if (monthName === "all") {
    showToast("📅 Tüm aylardaki ödemeler listelendi.");
  } else {
    showToast(`📅 ${monthName} ayı giderleri filtrelendi.`);
  }
}

function filterToCategory(categoryName) {
  closeModal("modalExpenseSummary");
  appState.myPaymentsCategoryFilter = categoryName;
  appState.myPaymentsMonthFilter = "all";
  switchTab("payments");
  renderMyPayments(getActivePeriod());
  showToast(`🏷️ "${categoryName}" kategorisi filtrelendi.`);
}

function exportMonthlyExpensesToCSV() {
  const period = getActivePeriod();
  if (!period) return;
  const totals = calculateMyPaymentsTotals(period);
  const tutoringTotals = calculateTotals(period);

  let csvContent = "data:text/csv;charset=utf-8,\uFEFF";
  csvContent += "Ay,Toplam Gider (TL),Ödenen Gider (TL),Bekleyen Gider (TL),Ders Geliri (TL),Net Bakiye (TL),Kayıt Adedi,Ödeme Durumu\n";

  MONTHS.forEach(m => {
    const exp = totals.monthExpenses[m] || { total: 0, paid: 0, unpaid: 0, count: 0 };
    const rev = tutoringTotals.monthTotals[m] ? tutoringTotals.monthTotals[m].revenue : 0;
    const net = rev - exp.total;
    const statusText = exp.count === 0 ? "Kayıt Yok" : (exp.unpaid === 0 ? "%100 Ödendi" : `%${Math.round((exp.paid / (exp.total || 1)) * 100)} Ödendi`);

    const row = [
      `"${m}"`,
      `"${exp.total}"`,
      `"${exp.paid}"`,
      `"${exp.unpaid}"`,
      `"${rev}"`,
      `"${net}"`,
      `"${exp.count}"`,
      `"${statusText}"`
    ];
    csvContent += row.join(",") + "\n";
  });

  const totalRev = tutoringTotals.totalRevenue || 0;
  const totalNet = totalRev - totals.totalAmount;
  csvContent += `"GENEL TOPLAM","${totals.totalAmount}","${totals.paidAmount}","${totals.unpaidAmount}","${totalRev}","${totalNet}","${totals.totalCount}","%${totals.totalAmount > 0 ? Math.round((totals.paidAmount / totals.totalAmount) * 100) : 0} Ödendi"\n`;

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", `Cem_Baba_Aylik_Gider_ve_Gelir_Raporu_${period.id}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast("📊 Aylık Gider ve Bakiye Raporu CSV olarak indirildi.");
}

// --------------------------------------------------------------------------
// ÖĞRENCİ TAHSİLAT KONTROL PANELİ (DERS ÜCRETİ & BAKİYE)
// --------------------------------------------------------------------------
function renderPayments(totals, period) {
  ensurePaymentsArray(period);

  // 1. Hızlı Ödeme Girişi Formu Öğrenci Seçicisi & Tarihi
  const quickSelect = document.getElementById("quickPaymentStudentSelect");
  if (quickSelect) {
    const curVal = quickSelect.value;
    quickSelect.innerHTML = `<option value="">Öğrenci Seçiniz...</option>` + period.students.map(s => {
      const st = totals.studentTotals[s.id] || { unpaid: 0, revenue: 0, paid: 0 };
      const debtText = st.unpaid > 0 ? ` (Borç: ${formatCurrency(st.unpaid)})` : (st.paid > st.revenue ? ` (Avans: +${formatCurrency(st.paid - st.revenue)})` : ` (Borç Yok)`);
      return `<option value="${s.id}" ${s.id === curVal ? 'selected' : ''}>${escapeHtml(s.name)}${debtText}</option>`;
    }).join("");
  }

  const quickDate = document.getElementById("quickPaymentDateInput");
  if (quickDate && !quickDate.value) {
    quickDate.value = new Date().toISOString().split("T")[0];
  }

  // 2. Kayıtlı Ödemeler Öğrenci Filtresi Seçicisi
  const filterHistSelect = document.getElementById("filterPaymentsStudentSelect");
  if (filterHistSelect) {
    const curVal = appState.paymentHistoryFilter || "all";
    filterHistSelect.innerHTML = `<option value="all">Tüm Öğrencilerin Ödemeleri (${period.payments.length})</option>` + period.students.map(s => {
      const count = period.payments.filter(p => p.studentId === s.id).length;
      return `<option value="${s.id}" ${s.id === curVal ? 'selected' : ''}>${escapeHtml(s.name)} (${count} Ödeme)</option>`;
    }).join("");
  }

  // 3. Kayıtlı Ödemeler Listesi Tablosu
  const histTableBody = document.getElementById("paymentsListTableBody");
  if (histTableBody) {
    let payments = [...(period.payments || [])];

    // Öğrenci filtresi
    if (appState.paymentHistoryFilter && appState.paymentHistoryFilter !== "all") {
      payments = payments.filter(p => p.studentId === appState.paymentHistoryFilter);
    }

    // Metin araması (dekont, not, öğrenci adı, ödeme şekli, tutar, tarih)
    if (appState.paymentHistorySearch) {
      const q = appState.paymentHistorySearch.toLowerCase().trim();
      payments = payments.filter(p => {
        const s = period.students.find(st => st.id === p.studentId);
        const sName = (s?.name || "").toLowerCase();
        const note = (p.note || "").toLowerCase();
        const type = (p.type || "").toLowerCase();
        const date = (p.date || "").toLowerCase();
        const amt = (p.amount || "").toString();
        return sName.includes(q) || note.includes(q) || type.includes(q) || date.includes(q) || amt.includes(q);
      });
    }

    // Tarihe göre yeniden eskiye sırala
    payments.sort((a, b) => (b.date || "").localeCompare(a.date || "") || (b.createdAt || 0) - (a.createdAt || 0));

    if (payments.length === 0) {
      histTableBody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align: center; color: var(--slate-400); padding: 2.5rem 1rem;">
            <div style="font-size: 2rem; margin-bottom: 0.5rem;">💳</div>
            <div style="font-weight: 600; color: var(--slate-600); margin-bottom: 0.25rem;">Henüz kayıtlı ödeme bulunmuyor.</div>
            <div style="font-size: 0.85rem;">Yukarıdaki hızlı giriş formundan tarih ve ödeme bilgisi ekleyebilirsiniz.</div>
          </td>
        </tr>
      `;
    } else {
      histTableBody.innerHTML = payments.map((p, idx) => {
        const s = period.students.find(st => st.id === p.studentId);
        const sName = s ? s.name : p.studentId;
        const sGrade = s?.grade ? ` (${s.grade})` : "";

        // Ödeme türü rozet sınıfı
        let typeBadgeClass = "badge-type-transfer";
        const typeStr = (p.type || "").toLowerCase();
        if (typeStr.includes("fast")) typeBadgeClass = "badge-type-fast";
        else if (typeStr.includes("nakit") || typeStr.includes("elden")) typeBadgeClass = "badge-type-cash";
        else if (typeStr.includes("kart")) typeBadgeClass = "badge-type-card";
        else if (typeStr.includes("diğer")) typeBadgeClass = "badge-type-other";

        return `
          <tr>
            <td style="font-weight: 700; color: var(--slate-500); width: 45px;">#${payments.length - idx}</td>
            <td style="font-weight: 700; color: var(--slate-800); white-space: nowrap;">
              📅 ${formatDateTurkish(p.date)}
            </td>
            <td>
              <div style="font-weight: 700; color: var(--slate-900);">${escapeHtml(sName)}</div>
              <div style="font-size: 0.75rem; color: var(--slate-500);">${escapeHtml(sGrade)}</div>
            </td>
            <td class="tabular-nums payment-amount-cell">
              +${formatCurrency(p.amount)}
            </td>
            <td style="text-align: center;">
              <span class="payment-type-badge ${typeBadgeClass}">
                ${escapeHtml(p.type || 'Banka Havalesi / EFT')}
              </span>
            </td>
            <td style="color: var(--slate-700); font-size: 0.875rem;">
              ${escapeHtml(p.note || '—')}
            </td>
            <td style="text-align: center; white-space: nowrap;">
              <button class="btn-action-icon" onclick="openEditPaymentModal('${p.id}')" title="Tarih, tutar veya notu düzenle">
                ✏️ Düzenle
              </button>
              <button class="btn-action-icon danger" onclick="handleDeletePayment('${p.id}')" title="Bu ödemeyi sil">
                🗑️
              </button>
            </td>
          </tr>
        `;
      }).join("");
    }
  }

  // 4. Öğrenci Bakiye ve Tahsilat Durumu Tablosu
  const sTableBody = document.getElementById("studentPaymentsSummaryBody");
  if (sTableBody) {
    sTableBody.innerHTML = period.students.map(s => {
      const st = totals.studentTotals[s.id] || { lessons: 0, revenue: 0, paid: 0, unpaid: 0, balance: 0 };
      
      let statusBadge = "";
      if (st.unpaid > 0) {
        statusBadge = `<span class="payment-badge unpaid">🔴 ${formatCurrency(st.unpaid)} Kalan Borç</span>`;
      } else if (st.balance > 0) {
        statusBadge = `<span class="payment-badge" style="background:#eff6ff; color:#1d4ed8; border:1px solid #bfdbfe;">🔵 +${formatCurrency(st.balance)} Avans</span>`;
      } else {
        statusBadge = `<span class="payment-badge paid">🟢 Borç Yok (Ödendi)</span>`;
      }

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
          <td style="text-align: right; white-space: nowrap;">
            <button class="btn btn-success" style="padding: 3px 8px; font-size: 0.775rem;" onclick="openAddPaymentModal('${s.id}')" title="Bu öğrenciye yeni ödeme ekle">
              💳 Ödeme Gir
            </button>
            <button class="btn btn-secondary" style="padding: 3px 8px; font-size: 0.775rem; margin-left: 4px;" onclick="viewStudentDetails('${s.id}')">
              Döküm Gör
            </button>
          </td>
        </tr>
      `;
    }).join("");
  }

  // 5. Ders Bazlı Ödeme Kontrol Listesi
  const pTableBody = document.getElementById("lessonsPaymentTableBody");
  if (pTableBody) {
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
    } else {
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
  }
}

// --------------------------------------------------------------------------
// ÖDEME İŞLEMLERİ: EKLEME, DÜZENLEME, SİLME & CSV AKTARIMI
// --------------------------------------------------------------------------
function handleQuickPaymentSubmit(event) {
  event.preventDefault();
  const period = getActivePeriod();
  if (!period) return;
  ensurePaymentsArray(period);

  const studentId = document.getElementById("quickPaymentStudentSelect")?.value;
  const dateVal = document.getElementById("quickPaymentDateInput")?.value;
  const amountVal = parseFloat(document.getElementById("quickPaymentAmountInput")?.value) || 0;
  const typeVal = document.getElementById("quickPaymentTypeSelect")?.value || "Banka Havalesi / EFT";
  const noteVal = document.getElementById("quickPaymentNoteInput")?.value.trim() || "";

  if (!studentId) {
    alert("Lütfen bir öğrenci seçiniz.");
    return;
  }
  if (!dateVal) {
    alert("Lütfen ödeme tarihini giriniz.");
    return;
  }
  if (amountVal <= 0) {
    alert("Lütfen geçerli bir ödeme tutarı giriniz.");
    return;
  }

  const student = period.students.find(s => s.id === studentId);
  const sName = student ? student.name : "Öğrenci";

  const newPayment = {
    id: "pay_" + Date.now(),
    studentId: studentId,
    date: dateVal,
    amount: amountVal,
    type: typeVal,
    note: noteVal,
    createdAt: Date.now()
  };

  period.payments.unshift(newPayment);
  saveData();

  // Formu temizle (tarih kalsın)
  const amtInput = document.getElementById("quickPaymentAmountInput");
  if (amtInput) amtInput.value = "";
  const noteInput = document.getElementById("quickPaymentNoteInput");
  if (noteInput) noteInput.value = "";
  const sSelect = document.getElementById("quickPaymentStudentSelect");
  if (sSelect) sSelect.value = "";

  renderApp();
  showToast(`Ödeme başarıyla kaydedildi: ${sName} - ${formatCurrency(amountVal)}`);
}

function openAddPaymentModal(studentId = "") {
  const period = getActivePeriod();
  if (!period) return;
  ensurePaymentsArray(period);

  const form = document.getElementById("formPayment");
  if (form) form.reset();

  document.getElementById("paymentEditId").value = "";
  document.getElementById("modalPaymentTitle").textContent = "💳 Yeni Ödeme Girişi (Tarih ve Bilgi)";
  
  const btnDel = document.getElementById("btnDeletePayment");
  if (btnDel) btnDel.style.display = "none";

  const select = document.getElementById("paymentStudentSelect");
  if (select) {
    const totals = calculateTotals(period);
    select.innerHTML = `<option value="">Öğrenci Seçiniz...</option>` + period.students.map(s => {
      const st = totals.studentTotals[s.id] || { unpaid: 0 };
      const debtText = st.unpaid > 0 ? ` (Kalan Borç: ${formatCurrency(st.unpaid)})` : ` (Borç Yok)`;
      return `<option value="${s.id}" ${s.id === studentId ? 'selected' : ''}>${escapeHtml(s.name)}${debtText}</option>`;
    }).join("");
  }

  const dateInput = document.getElementById("paymentDateInput");
  if (dateInput) {
    dateInput.value = new Date().toISOString().split("T")[0];
  }

  if (studentId && select) {
    handleModalPaymentStudentChange(select);
  } else {
    const hint = document.getElementById("paymentStudentBalanceHint");
    if (hint) hint.textContent = "";
  }

  openModal("modalPayment");
}

function openEditPaymentModal(paymentId) {
  const period = getActivePeriod();
  if (!period) return;
  ensurePaymentsArray(period);

  const payment = (period.payments || []).find(p => p.id === paymentId);
  if (!payment) return;

  document.getElementById("paymentEditId").value = payment.id;
  document.getElementById("modalPaymentTitle").textContent = "✏️ Ödeme Kaydını Düzenle";

  const btnDel = document.getElementById("btnDeletePayment");
  if (btnDel) btnDel.style.display = "inline-flex";

  const select = document.getElementById("paymentStudentSelect");
  if (select) {
    select.innerHTML = period.students.map(s => `
      <option value="${s.id}" ${s.id === payment.studentId ? 'selected' : ''}>
        ${escapeHtml(s.name)}
      </option>
    `).join("");
  }

  document.getElementById("paymentDateInput").value = payment.date;
  document.getElementById("paymentAmountInput").value = payment.amount;
  document.getElementById("paymentTypeSelect").value = payment.type || "Banka Havalesi / EFT";
  document.getElementById("paymentNoteInput").value = payment.note || "";

  const hint = document.getElementById("paymentStudentBalanceHint");
  if (hint) hint.textContent = "";

  openModal("modalPayment");
}

function handleSavePayment(event) {
  event.preventDefault();
  const period = getActivePeriod();
  if (!period) return;
  ensurePaymentsArray(period);

  const editId = document.getElementById("paymentEditId").value;
  const studentId = document.getElementById("paymentStudentSelect").value;
  const dateVal = document.getElementById("paymentDateInput").value;
  const amountVal = parseFloat(document.getElementById("paymentAmountInput").value) || 0;
  const typeVal = document.getElementById("paymentTypeSelect").value || "Banka Havalesi / EFT";
  const noteVal = document.getElementById("paymentNoteInput").value.trim();

  if (!studentId || !dateVal || amountVal <= 0) {
    alert("Lütfen öğrenci, tarih ve geçerli bir tutar giriniz.");
    return;
  }

  const student = period.students.find(s => s.id === studentId);
  const sName = student ? student.name : "Öğrenci";

  if (editId) {
    const existing = period.payments.find(p => p.id === editId);
    if (existing) {
      existing.studentId = studentId;
      existing.date = dateVal;
      existing.amount = amountVal;
      existing.type = typeVal;
      existing.note = noteVal;
    }
    showToast(`Ödeme güncellendi: ${sName} - ${formatCurrency(amountVal)}`);
  } else {
    period.payments.unshift({
      id: "pay_" + Date.now(),
      studentId: studentId,
      date: dateVal,
      amount: amountVal,
      type: typeVal,
      note: noteVal,
      createdAt: Date.now()
    });
    showToast(`Yeni ödeme kaydedildi: ${sName} - ${formatCurrency(amountVal)}`);
  }

  saveData();
  closeModal("modalPayment");
  renderApp();
}

function handleDeletePayment(paymentId) {
  const period = getActivePeriod();
  if (!period || !period.payments) return;

  const payment = period.payments.find(p => p.id === paymentId);
  if (!payment) return;

  const s = period.students.find(st => st.id === payment.studentId);
  const sName = s ? s.name : "Öğrenci";

  if (!confirm(`${sName} adına yapılan ${formatDateTurkish(payment.date)} tarihli ${formatCurrency(payment.amount)} ödeme kaydını silmek istediğinize emin misiniz?`)) {
    return;
  }

  const idx = period.payments.findIndex(p => p.id === paymentId);
  if (idx !== -1) {
    period.payments.splice(idx, 1);
  }

  saveData();
  renderApp();
  showToast("Ödeme kaydı silindi.");
}

function handleDeleteCurrentPayment() {
  const editId = document.getElementById("paymentEditId").value;
  if (!editId) return;
  closeModal("modalPayment");
  handleDeletePayment(editId);
}

function handlePaymentStudentSelectChange(select) {
  const period = getActivePeriod();
  if (!period || !select.value) return;
  const totals = calculateTotals(period);
  const st = totals.studentTotals[select.value];
  const s = period.students.find(x => x.id === select.value);

  const amountInput = document.getElementById("quickPaymentAmountInput");
  if (amountInput && (!amountInput.value || amountInput.value === "0")) {
    if (st && st.unpaid > 0) {
      amountInput.value = st.unpaid;
    } else if (s && s.rate) {
      amountInput.value = s.rate;
    }
  }
}

function handleModalPaymentStudentChange(select) {
  const period = getActivePeriod();
  if (!period || !select.value) return;
  const totals = calculateTotals(period);
  const st = totals.studentTotals[select.value];
  const s = period.students.find(x => x.id === select.value);

  const hint = document.getElementById("paymentStudentBalanceHint");
  if (hint && st) {
    if (st.unpaid > 0) {
      hint.innerHTML = `⚠️ Bu öğrencinin toplam <strong>${formatCurrency(st.unpaid)}</strong> bekleyen borcu bulunuyor.`;
      hint.style.color = "var(--danger)";
    } else {
      hint.innerHTML = `✓ Bu öğrencinin bekleyen borcu yok. (Ders başı ücret: ${formatCurrency(s?.rate || 0)})`;
      hint.style.color = "var(--success)";
    }
  }

  const amountInput = document.getElementById("paymentAmountInput");
  if (amountInput && (!amountInput.value || amountInput.value === "0")) {
    if (st && st.unpaid > 0) {
      amountInput.value = st.unpaid;
    } else if (s && s.rate) {
      amountInput.value = s.rate;
    }
  }
}

function handlePaymentSearch(query) {
  appState.paymentHistorySearch = query || "";
  const period = getActivePeriod();
  const totals = calculateTotals(period);
  renderPayments(totals, period);
}

function handlePaymentHistoryStudentFilterChange(select) {
  appState.paymentHistoryFilter = select.value || "all";
  const period = getActivePeriod();
  const totals = calculateTotals(period);
  renderPayments(totals, period);
}

function exportPaymentsToCSV() {
  const period = getActivePeriod();
  if (!period || !period.payments || period.payments.length === 0) {
    alert("Dışa aktarılacak ödeme kaydı bulunamadı.");
    return;
  }

  let csv = "Tarih,Öğrenci Adı,Ödenen Tutar (₺),Ödeme Şekli,Ödeme Bilgisi / Dekont / Not\n";

  const payments = [...period.payments];
  payments.sort((a, b) => (b.date || "").localeCompare(a.date || ""));

  payments.forEach(p => {
    const s = period.students.find(st => st.id === p.studentId);
    const sName = s ? s.name : p.studentId;
    const cleanNote = (p.note || "").replace(/"/g, '""');
    csv += `"${p.date}","${sName}","${p.amount}","${p.type || ''}","${cleanNote}"\n`;
  });

  const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `DersTakip_Odemeler_${period.id}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showToast("Ödemeler listesi Excel/CSV olarak indirildi!");
}

function toggleLessonPaymentCardBody() {
  const body = document.getElementById("lessonPaymentCardBody");
  const icon = document.getElementById("lessonPaymentAccordionIcon");
  if (!body) return;

  if (body.style.display === "none") {
    body.style.display = "block";
    if (icon) icon.textContent = "▼";
  } else {
    body.style.display = "none";
    if (icon) icon.textContent = "▶";
  }
}

function toggleLessonPayment(lessonId) {
  const period = getActivePeriod();
  if (!period || !period.lessons) return;
  ensurePaymentsArray(period);

  const lesson = period.lessons.find(l => l.id === lessonId);
  if (!lesson) return;

  lesson.isPaid = !lesson.isPaid;
  if (lesson.isPaid) {
    lesson.paidDate = new Date().toISOString().split("T")[0];
    const exists = period.payments.some(p => p.lessonId === lesson.id);
    if (!exists) {
      period.payments.unshift({
        id: "pay_" + lesson.id,
        studentId: lesson.studentId,
        date: lesson.paidDate,
        amount: parseFloat(lesson.rate) || 0,
        type: "Banka Havalesi / EFT",
        note: `Ders ödemesi (${formatDateTurkish(lesson.date)})`,
        lessonId: lesson.id,
        createdAt: Date.now()
      });
    }
    showToast(`Ders ücreti ödendi olarak işaretlendi (${formatCurrency(lesson.rate)})`);
  } else {
    lesson.paidDate = "";
    const pIdx = period.payments.findIndex(p => p.lessonId === lesson.id);
    if (pIdx !== -1) {
      period.payments.splice(pIdx, 1);
    }
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
        const curPeriod = getActivePeriod();
        if (curPeriod) {
          ensureLessonsArray(curPeriod);
          ensurePaymentsArray(curPeriod);
          ensureMyPaymentsArray(curPeriod);
        }
        saveData();
        renderApp();
        showToast("Dönem değiştirildi: " + (curPeriod ? curPeriod.name : ''));
      }
    });
  }

  const lessonStudentSelect = document.getElementById("lessonStudentSelect");
  if (lessonStudentSelect) {
    lessonStudentSelect.addEventListener("change", (e) => {
      updateLessonRateFromSelectedStudent(e.target.value);
    });
  }

  // Modal arkaplanına tıklayınca ve Escape tuşuna basınca kapatma
  document.querySelectorAll(".modal-overlay").forEach(overlay => {
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) {
        overlay.classList.remove("active");
      }
    });
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      document.querySelectorAll(".modal-overlay.active").forEach(m => m.classList.remove("active"));
    }
  });
}

function updateLessonRateFromSelectedStudent(studentId) {
  const period = getActivePeriod();
  const s = period?.students.find(st => st.id === studentId);
  const rateInput = document.getElementById("lessonRateInput");
  if (s && rateInput) {
    rateInput.value = s.rate || 3500;
  }
}

function toggleToolsDropdown(event) {
  if (event) {
    event.stopPropagation();
  }
  const menu = document.getElementById("toolsDropdownMenu");
  const btn = document.getElementById("btnToolsMenu");
  if (!menu) return;
  const isOpen = menu.classList.contains("show");
  if (isOpen) {
    menu.classList.remove("show");
    if (btn) btn.setAttribute("aria-expanded", "false");
  } else {
    menu.classList.add("show");
    if (btn) btn.setAttribute("aria-expanded", "true");
  }
}

function closeToolsDropdown() {
  const menu = document.getElementById("toolsDropdownMenu");
  const btn = document.getElementById("btnToolsMenu");
  if (menu) menu.classList.remove("show");
  if (btn) btn.setAttribute("aria-expanded", "false");
}

window.addEventListener("click", function(e) {
  const wrapper = document.querySelector(".tools-dropdown-wrapper");
  if (wrapper && !wrapper.contains(e.target)) {
    closeToolsDropdown();
  }
});

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
  if (tabId === "payments") {
    const period = getActivePeriod();
    if (period) {
      renderMyPayments(period);
      if (typeof renderMonthlyPaidExpensesChart === "function") {
        renderMonthlyPaidExpensesChart(period);
      }
    }
  }
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

  // 1.1 Eğer ders ödendi olarak girildiyse ödemeler listesine de ekle
  if (isPaid) {
    ensurePaymentsArray(period);
    period.payments.unshift({
      id: "pay_" + newLesson.id,
      studentId: studentId,
      date: dateVal,
      amount: rateVal,
      type: "Banka Havalesi / EFT",
      note: noteVal ? `Ders ödemesi (${noteVal})` : "Ders ödemesi",
      lessonId: newLesson.id,
      createdAt: Date.now()
    });
  }

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

    <div style="max-height: 200px; overflow-y: auto; border: 1px solid var(--slate-200); border-radius: 8px; margin-bottom: 1.25rem;">
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

    <!-- ÖĞRENCİNİN ALINAN ÖDEMELER GEÇMİŞİ -->
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
      <h4 style="font-size: 0.95rem; font-weight: 700;">💳 Alınan Ödemeler (${((period.payments || []).filter(p => p.studentId === studentId)).length} Ödeme)</h4>
      <button class="btn btn-success" style="padding: 3px 10px; font-size: 0.8rem;" onclick="closeModal('modalStudentDetails'); openAddPaymentModal('${s.id}')">
        💳 Bu Öğrenciye Ödeme Gir
      </button>
    </div>

    <div style="max-height: 200px; overflow-y: auto; border: 1px solid var(--slate-200); border-radius: 8px;">
      <table class="data-table" style="font-size: 0.825rem;">
        <thead>
          <tr>
            <th>Ödeme Tarihi</th>
            <th style="text-align: right;">Ödenen Tutar</th>
            <th style="text-align: center;">Ödeme Şekli</th>
            <th>Ödeme Bilgisi / Not</th>
            <th style="text-align: center;">İşlem</th>
          </tr>
        </thead>
        <tbody>
          ${(() => {
            const studentPayments = (period.payments || []).filter(p => p.studentId === studentId);
            studentPayments.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
            if (studentPayments.length === 0) {
              return '<tr><td colspan="5" style="text-align:center; padding: 1rem; color: var(--slate-400);">Kayıtlı ödeme bulunamadı.</td></tr>';
            }
            return studentPayments.map(p => `
              <tr>
                <td style="font-weight: 600;">📅 ${formatDateTurkish(p.date)}</td>
                <td class="tabular-nums" style="text-align: right; font-weight: 700; color: var(--success);">+${formatCurrency(p.amount)}</td>
                <td style="text-align: center;"><span class="payment-type-badge">${escapeHtml(p.type || 'Banka Havalesi')}</span></td>
                <td style="color: var(--slate-600);">${escapeHtml(p.note || '—')}</td>
                <td style="text-align: center;">
                  <button class="btn-action-icon" onclick="closeModal('modalStudentDetails'); openEditPaymentModal('${p.id}');" title="Ödemeyi Düzenle">
                    ✏️
                  </button>
                </td>
              </tr>
            `).join("");
          })()}
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
        appState.data.periods.forEach(p => {
          ensureLessonsArray(p);
          ensurePaymentsArray(p);
        });
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
      .then(reg => {
        console.log('DersTakip Service Worker aktif:', reg.scope);
        reg.onupdatefound = () => {
          const installingWorker = reg.installing;
          if (installingWorker) {
            installingWorker.onstatechange = () => {
              if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
                console.log('Yeni sürüm hazır, taze verilerle güncelleniyor...');
                window.location.reload();
              }
            };
          }
        };
      })
      .catch(err => console.log('Service Worker kaydı atlandı:', err));
  });
}

let deferredInstallPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
});

// --------------------------------------------------------------------------
// BULUT SENKRONİZASYON ARAYÜZ YÖNETİMİ (DOĞRUDAN ODA / QR İLE EŞİTLEME)
// --------------------------------------------------------------------------
function openCloudSyncModal() {
  updateCloudModalView();
  openModal('modalCloudSync');
}

function updateCloudModalView() {
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
      statusEl.textContent = '🟢 Canlı Senkronizasyon Açık (Telefon & PC)';
      lastInfoEl.textContent = `Son eşitleme: ${timeStr} (${cfg.lastDevice || 'Bu Cihaz'})`;
    } else {
      statusEl.textContent = '🟢 Canlı Eşitleme Hazır';
      lastInfoEl.textContent = 'Telefonunuzun kamerasıyla QR kodu okutarak anında eşleşebilirsiniz.';
    }
  }

  // Eşitleme Odası Kodu
  const roomInput = document.getElementById('cloudSyncRoomInput');
  if (roomInput) {
    roomInput.value = window.CloudSync.getSyncRoom();
  }

  // QR Kod Görseli
  const qrImg = document.getElementById('cloudQrImage');
  if (qrImg) {
    qrImg.src = window.CloudSync.getQrCodeUrl();
  }
}

async function triggerManualCloudSync() {
  if (!window.CloudSync) return;
  showToast('Bulut kontrol ediliyor...');
  await window.CloudSync.sync(true);
  updateCloudModalView();
}

function saveDirectSyncRoom() {
  if (!window.CloudSync) return;
  const input = document.getElementById('cloudSyncRoomInput');
  if (!input) return;
  const newRoom = input.value.trim();

  if (!newRoom) {
    alert('Lütfen geçerli bir eşitleme kodu girin.');
    return;
  }

  window.CloudSync.setSyncRoom(newRoom);
  showToast(`✅ Eşitleme odası "${newRoom}" olarak güncellendi!`);
  updateCloudModalView();
}

function copyCloudShareLink() {
  if (!window.CloudSync) return;
  const shareUrl = window.CloudSync.getShareUrl();

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(shareUrl).then(() => {
      showToast('📱 WhatsApp eşleştirme linki kopyalandı! Telefonunuzda açabilirsiniz.');
    }).catch(() => {
      prompt('Aşağıdaki bağlantıyı kopyalayıp telefonunuza gönderin:', shareUrl);
    });
  } else {
    prompt('Aşağıdaki bağlantıyı kopyalayıp telefonunuza gönderin:', shareUrl);
  }
}

function openShareLinkInNewTab() {
  if (!window.CloudSync) return;
  const shareUrl = window.CloudSync.getShareUrl();
  window.open(shareUrl, '_blank');
}


