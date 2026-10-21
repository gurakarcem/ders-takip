/**
 * Cem Baba - Kişisel Ödemelerim ve Gider Defteri (Bağımsız Sayfa Mantığı)
 * Tüm veriler ana ders takip sistemiyle (localStorage ve bulut) tam senkronize çalışır.
 */

const MONTHS = [
  "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
  "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran"
];

const MONTH_MAP = {
  8: "Ağustos", 9: "Eylül", 10: "Ekim", 11: "Kasım", 12: "Aralık",
  1: "Ocak", 2: "Şubat", 3: "Mart", 4: "Nisan", 5: "Mayıs", 6: "Haziran", 7: "Temmuz"
};

let appState = {
  data: null,
  activePeriodId: "2026-2027",
  myPaymentsFilter: "all", // 'all', 'unpaid', 'paid'
  myPaymentsCategoryFilter: "all",
  myPaymentsMonthFilter: "all", // 'all' veya ay adı
  myPaymentsSearch: "",
  upcomingDebtsFilter: "all", // 'all', 'overdue', 'soon', 'thisMonth'
  modalMonthlyPaidMonth: "",
  charts: {
    expenseSummary: null,
    monthlyPaidExpenses: null
  }
};

// --------------------------------------------------------------------------
// BAŞLANGIÇ & VERİ YÖNETİMİ
// --------------------------------------------------------------------------

function initExpenseApp() {
  loadData();
  setupEventListeners();
  populatePeriodSelect();
  renderPage();

  // Çoklu pencere canlı senkronizasyon (Ders sayfasında bir şey değiştiğinde anında yenile)
  window.addEventListener("storage", (e) => {
    if (e.key === "DERS_TAKIP_PRO_DATA") {
      loadData();
      renderPage();
      showToast("🔄 Diğer pencereden gelen güncellemeler eşitlendi.");
    }
  });

  // Bulut senkronizasyonunu başlat ve canlı gelen güncellemeleri dinle
  if (window.CloudSync) {
    window.CloudSync.init({
      onDataUpdated: (newData) => {
        if (newData) {
          appState.data = newData;
          if (newData.activePeriodId) appState.activePeriodId = newData.activePeriodId;
          renderPage();
          showToast("☁️ Buluttan güncel veriler eşitlendi.");
        }
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

  if (appState.data && appState.data.activePeriodId) {
    appState.activePeriodId = appState.data.activePeriodId;
  }

  if (appState.data && appState.data.periods) {
    appState.data.periods.forEach(p => {
      ensureMyPaymentsArray(p);
      ensureLessonsArray(p);
      ensurePaymentsArray(p);
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

  if (window.CloudSync) {
    window.CloudSync.schedulePush(appState.data);
  }
}

function getActivePeriod() {
  if (!appState.data || !appState.data.periods) return null;
  return appState.data.periods.find(p => p.id === appState.activePeriodId) || appState.data.periods[0];
}

function ensureMyPaymentsArray(period) {
  if (!period) return;
  const initPer = (window.INITIAL_DERS_DATA?.periods || []).find(p => p.id === period.id);

  if (!period.myPayments || !Array.isArray(period.myPayments)) {
    if (initPer && Array.isArray(initPer.myPayments) && initPer.myPayments.length > 0) {
      period.myPayments = JSON.parse(JSON.stringify(initPer.myPayments));
    } else {
      period.myPayments = [
        { id: "mypay_1", date: "2026-10-24", title: "Garanti BBVA Kredi Kartı", amount: 14500, category: "Kredi Kartı", status: "unpaid", paidDate: "", note: "Son ödeme günü 24 Ekim" },
        { id: "mypay_2", date: "2026-10-15", title: "Ev Kirası", amount: 22000, category: "Kira & Aidat", status: "paid", paidDate: "2026-10-15", note: "Ekim ayı ev kirası ev sahibine ödendi" },
        { id: "mypay_3", date: "2026-10-28", title: "İgdaş Doğalgaz Faturası", amount: 1250, category: "Fatura", status: "unpaid", paidDate: "", note: "Son gün 28 Ekim" },
        { id: "mypay_4", date: "2026-10-18", title: "Turkcell Telefon & İnternet", amount: 890, category: "Fatura", status: "paid", paidDate: "2026-10-18", note: "Otomatik ödeme talimatı ödendi" },
        { id: "mypay_5", date: "2026-10-25", title: "Site Aidatı", amount: 1500, category: "Kira & Aidat", status: "unpaid", paidDate: "", note: "Ekim ayı aidatı" },
        { id: "mypay_6", date: "2026-10-31", title: "Bağkur / SGK Primi", amount: 7800, category: "Sigorta & Vergi", status: "unpaid", paidDate: "", note: "Son gün ay sonu" },
        { id: "mypay_7", date: "2026-10-12", title: "Yapı Kredi Kredi Taksiti", amount: 6400, category: "Kredi Taksiti", status: "paid", paidDate: "2026-10-12", note: "10/24 taksit ödendi" }
      ];
    }
  } else if (period.myPayments.length === 7 && period.myPayments[0].id === "mypay_1") {
    // Eski varsayılan veriyi güncel çok aylı initial_data ile zenginleştir
    if (initPer && Array.isArray(initPer.myPayments) && initPer.myPayments.length > 7) {
      period.myPayments = JSON.parse(JSON.stringify(initPer.myPayments));
    }
  }
}

function ensureLessonsArray(period) {
  if (!period) return;
  if (!period.lessons) period.lessons = [];
}

function ensurePaymentsArray(period) {
  if (!period) return;
  if (!period.payments) period.payments = [];
}

// --------------------------------------------------------------------------
// HESAPLAMALAR (AY AY GİDERLER & ÖZEL DERS GELİRİ KARŞILAŞTIRMASI)
// --------------------------------------------------------------------------

function getPaymentMonthName(dateStr) {
  if (!dateStr || typeof dateStr !== "string") return "Bilinmeyen";
  const parts = dateStr.split("-");
  if (parts.length >= 2) {
    const m = parseInt(parts[1], 10);
    if (MONTH_MAP[m]) return MONTH_MAP[m];
  }
  return "Bilinmeyen";
}

function calculateMyPaymentsTotals(period) {
  ensureMyPaymentsArray(period);
  const list = period.myPayments || [];

  let totalAmount = 0;
  let paidAmount = 0;
  let unpaidAmount = 0;
  let paidCount = 0;
  let unpaidCount = 0;
  let upcoming = null;

  // Ay Ay Dağılım
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

// Özel ders cirosunu (net bakiye karşılaştırması için) hesapla
function calculateTotals(period) {
  if (!period) return { totalRevenue: 0, monthTotals: {} };

  let totalRevenue = 0;
  const monthTotals = {};
  MONTHS.forEach(m => {
    monthTotals[m] = { revenue: 0 };
  });

  // Eğer period.lessons varsa
  if (period.lessons && Array.isArray(period.lessons)) {
    period.lessons.forEach(l => {
      const r = parseFloat(l.rate) || 0;
      totalRevenue += r;
      if (l.month && monthTotals[l.month]) {
        monthTotals[l.month].revenue += r;
      }
    });
  } else if (period.monthlyRevenue) {
    MONTHS.forEach(m => {
      if (period.monthlyRevenue[m]) {
        Object.values(period.monthlyRevenue[m]).forEach(v => {
          const r = parseFloat(v) || 0;
          monthTotals[m].revenue += r;
          totalRevenue += r;
        });
      }
    });
  }

  return { totalRevenue, monthTotals };
}

// --------------------------------------------------------------------------
// SAYFA DÖKÜMÜ & RENDER
// --------------------------------------------------------------------------

function renderPage() {
  const period = getActivePeriod();
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

  if (curFilter === "unpaid") {
    list = list.filter(p => p.status !== "paid");
  } else if (curFilter === "paid") {
    list = list.filter(p => p.status === "paid");
  }

  const curMonth = appState.myPaymentsMonthFilter || "all";
  if (curMonth && curMonth !== "all") {
    list = list.filter(p => getPaymentMonthName(p.date) === curMonth);
  }

  const curCat = appState.myPaymentsCategoryFilter || "all";
  if (curCat && curCat !== "all") {
    list = list.filter(p => p.category === curCat);
  }

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
        <td colspan="8" style="text-align: center; color: var(--slate-400); padding: 3rem 1rem;">
          <div style="font-size: 2.4rem; margin-bottom: 0.5rem;">💳</div>
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
    let catClass = "badge-cat-other";
    const catStr = (p.category || "").toLowerCase();
    if (catStr.includes("kart")) catClass = "badge-cat-card";
    else if (catStr.includes("fatura")) catClass = "badge-cat-bill";
    else if (catStr.includes("kira") || catStr.includes("aidat")) catClass = "badge-cat-rent";
    else if (catStr.includes("kredi")) catClass = "badge-cat-loan";
    else if (catStr.includes("sigorta") || catStr.includes("vergi") || catStr.includes("sgk") || catStr.includes("bağkur")) catClass = "badge-cat-tax";
    else if (catStr.includes("alışveriş") || catStr.includes("market")) catClass = "badge-cat-shop";

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

  // 5. Ay Ay Ödediklerimiz ve Bekleyen Borçlar Grafiği
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

// --------------------------------------------------------------------------
// HIZLI VE MODAL ÖDEME GİRİŞİ / DÜZENLEME / SİLME
// --------------------------------------------------------------------------

function handleQuickMyPaymentSubmit(event) {
  event.preventDefault();
  const period = getActivePeriod();
  if (!period) return;
  ensureMyPaymentsArray(period);

  const dateVal = document.getElementById("quickMyPaymentDateInput").value;
  const titleVal = document.getElementById("quickMyPaymentTitleInput").value.trim();
  const amountVal = parseFloat(document.getElementById("quickMyPaymentAmountInput").value) || 0;
  const categoryVal = document.getElementById("quickMyPaymentCategorySelect").value || "Diğer";
  const statusVal = document.getElementById("quickMyPaymentStatusSelect").value || "unpaid";
  const noteVal = document.getElementById("quickMyPaymentNoteInput").value.trim();

  if (!titleVal || amountVal <= 0 || !dateVal) {
    alert("Lütfen geçerli bir tarih, başlık ve tutar giriniz.");
    return;
  }

  const newPayment = {
    id: "mypay_" + Date.now(),
    date: dateVal,
    title: titleVal,
    amount: amountVal,
    category: categoryVal,
    status: statusVal,
    paidDate: statusVal === "paid" ? dateVal : "",
    note: noteVal,
    createdAt: Date.now()
  };

  period.myPayments.unshift(newPayment);
  saveData();

  document.getElementById("quickMyPaymentTitleInput").value = "";
  document.getElementById("quickMyPaymentAmountInput").value = "";
  document.getElementById("quickMyPaymentNoteInput").value = "";
  document.getElementById("quickMyPaymentStatusSelect").value = "unpaid";

  renderPage();
  showToast(`✅ "${newPayment.title}" (${formatCurrency(newPayment.amount)}) başarıyla eklendi!`);
}

function openAddMyPaymentModal() {
  document.getElementById("myPaymentEditId").value = "";
  document.getElementById("modalMyPaymentTitle").textContent = "💳 Yeni Kişisel Ödeme Ekle";
  document.getElementById("modalMyPaymentDate").value = new Date().toISOString().split("T")[0];
  document.getElementById("modalMyPaymentTitleInput").value = "";
  document.getElementById("modalMyPaymentAmount").value = "";
  document.getElementById("modalMyPaymentCategory").value = "Kredi Kartı";
  document.getElementById("modalMyPaymentStatus").value = "unpaid";
  document.getElementById("modalMyPaymentNote").value = "";
  document.getElementById("btnDeleteMyPayment").style.display = "none";
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
  document.getElementById("modalMyPaymentDate").value = p.date || "";
  document.getElementById("modalMyPaymentTitleInput").value = p.title || "";
  document.getElementById("modalMyPaymentAmount").value = p.amount || "";
  document.getElementById("modalMyPaymentCategory").value = p.category || "Diğer";
  document.getElementById("modalMyPaymentStatus").value = p.status || "unpaid";
  document.getElementById("modalMyPaymentNote").value = p.note || "";
  document.getElementById("btnDeleteMyPayment").style.display = "block";
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
  const categoryVal = document.getElementById("modalMyPaymentCategory").value || "Diğer";
  const statusVal = document.getElementById("modalMyPaymentStatus").value || "unpaid";
  const noteVal = document.getElementById("modalMyPaymentNote").value.trim();

  if (!titleVal || amountVal <= 0 || !dateVal) {
    alert("Lütfen geçerli bir tarih, başlık ve tutar giriniz.");
    return;
  }

  if (editId) {
    const existing = period.myPayments.find(p => p.id === editId);
    if (existing) {
      existing.date = dateVal;
      existing.title = titleVal;
      existing.amount = amountVal;
      existing.category = categoryVal;
      existing.status = statusVal;
      if (statusVal === "paid" && !existing.paidDate) existing.paidDate = dateVal;
      else if (statusVal === "unpaid") existing.paidDate = "";
      existing.note = noteVal;
      existing.updatedAt = Date.now();
      showToast(`Ödeme güncellendi: ${titleVal}`);
    }
  } else {
    period.myPayments.unshift({
      id: "mypay_" + Date.now(),
      date: dateVal,
      title: titleVal,
      amount: amountVal,
      category: categoryVal,
      status: statusVal,
      paidDate: statusVal === "paid" ? dateVal : "",
      note: noteVal,
      createdAt: Date.now()
    });
    showToast(`Yeni ödeme eklendi: ${titleVal}`);
  }

  saveData();
  closeModal("modalMyPayment");
  renderPage();
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
  renderPage();
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
  renderPage();

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
  renderPage();
}

function handleMyPaymentCategoryFilter(category) {
  appState.myPaymentsCategoryFilter = category;
  renderPage();
}

function handleMyPaymentMonthFilter(monthName) {
  appState.myPaymentsMonthFilter = monthName;
  renderPage();
}

function handleMyPaymentSearch(query) {
  appState.myPaymentsSearch = query;
  renderPage();
}

// --------------------------------------------------------------------------
// GİDER TOPLAM BİLGİ PENCERESİ & AYLIK RAPOR MODALI
// --------------------------------------------------------------------------

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

  // 4. Chart.js Grafik
  renderExpenseSummaryChart(totals, tutoringTotals);
}

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

function filterToMonth(monthName) {
  closeModal("modalExpenseSummary");
  appState.myPaymentsMonthFilter = monthName;
  renderPage();
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
  renderPage();
  showToast(`🏷️ "${categoryName}" kategorisi filtrelendi.`);
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
// YARDIMCI VE MODAL FONKSİYONLARI
// --------------------------------------------------------------------------

function populatePeriodSelect() {
  const select = document.getElementById("periodSelect");
  if (!select || !appState.data || !appState.data.periods) return;

  select.innerHTML = appState.data.periods.map(p => `
    <option value="${p.id}" ${p.id === appState.activePeriodId ? 'selected' : ''}>
      📅 ${p.name} ${p.isCurrent ? '(Aktif)' : ''}
    </option>
  `).join("");
}

function openModal(id) {
  const modal = document.getElementById(id);
  if (modal) modal.classList.add("active");
}

function closeModal(id) {
  const modal = document.getElementById(id);
  if (modal) modal.classList.remove("active");
}

function setupEventListeners() {
  const periodSelect = document.getElementById("periodSelect");
  if (periodSelect) {
    periodSelect.addEventListener("change", (e) => {
      appState.activePeriodId = e.target.value;
      saveData();
      renderPage();
      showToast("Dönem değiştirildi: " + getActivePeriod().name);
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

function manualCloudSync() {
  if (window.CloudSync) {
    window.CloudSync.syncNow(appState.data, (res) => {
      if (res && res.data) {
        appState.data = res.data;
        renderPage();
      }
    });
  } else {
    showToast("Bulut senkronizasyonu hazır.");
  }
}

function formatCurrency(amount) {
  const num = parseFloat(amount) || 0;
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(num).replace("TRY", "₺");
}

function formatDateTurkish(dateStr) {
  if (!dateStr) return "-";
  try {
    const parts = dateStr.split("-");
    if (parts.length === 3) {
      const year = parts[0];
      const month = parseInt(parts[1], 10);
      const day = parseInt(parts[2], 10);
      const months = ["", "Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];
      return `${day} ${months[month]} ${year}`;
    }
  } catch (e) {}
  return dateStr;
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function showToast(message) {
  const toast = document.getElementById("appToast");
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("show");
  setTimeout(() => {
    toast.classList.remove("show");
  }, 3200);
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
      urgencyOrder: diffDays // en çok geciken en negatif -> en başta
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

  renderPage();
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

document.addEventListener("DOMContentLoaded", initExpenseApp);
