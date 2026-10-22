/**
 * DersTakip Pro - Cihazlar Arası Canlı Bulut Senkronizasyon Motoru (CloudSync)
 * Telefon, tablet ve bilgisayar arasında doğrudan, hesap/şifre gerekmeden
 * anlık ve çift yönlü senkronizasyon sağlar.
 */

(function (window) {
  'use strict';

  const CONFIG_STORAGE_KEY = 'DERS_TAKIP_CLOUD_CONFIG';
  const DATA_STORAGE_KEY = 'DERS_TAKIP_PRO_DATA';
  const DEFAULT_SYNC_ROOM = 'cem_baba_ders_takip';
  const SYNC_SERVER = 'https://ntfy.sh';

  const defaultState = {
    provider: 'direct', // 'direct'
    syncRoom: DEFAULT_SYNC_ROOM,
    autoSync: true,
    lastSyncedAt: null,
    lastDevice: '',
    status: 'idle' // 'idle', 'syncing', 'success', 'error', 'offline'
  };

  let config = loadConfig();
  let pushDebounceTimer = null;
  let onDataUpdatedCallback = null;
  let isSyncing = false;
  let syncFailCount = 0;
  let evtSource = null;
  let reconnectTimeout = null;

  function loadConfig() {
    try {
      const saved = localStorage.getItem(CONFIG_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return Object.assign({}, defaultState, parsed);
      }
    } catch (e) {
      console.warn('Bulut yapılandırması yüklenirken hata:', e);
    }
    return Object.assign({}, defaultState);
  }

  function saveConfig(newConfig) {
    config = Object.assign(config, newConfig);
    try {
      localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(config));
    } catch (e) {
      console.warn('Bulut yapılandırması kaydedilemedi:', e);
    }
    updateUIBadge();
  }

  function getSyncRoom() {
    return (config.syncRoom && config.syncRoom.trim()) || DEFAULT_SYNC_ROOM;
  }

  // Cihaz Bilgisi Tespiti
  function getDeviceName() {
    const ua = navigator.userAgent || '';
    if (/android/i.test(ua)) return 'Android Telefon';
    if (/iphone|ipad|ipod/i.test(ua)) return 'iPhone / iPad';
    if (/windows/i.test(ua)) return 'Windows Bilgisayar';
    if (/macintosh|mac os x/i.test(ua)) return 'Mac Bilgisayar';
    return 'Web Tarayıcısı';
  }

  // URL Parametrelerinden (QR Kod veya Paylaşım Linki) Yapılandırma Al
  function checkUrlParams() {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const room = urlParams.get('sync_room') || urlParams.get('oda') || urlParams.get('sync_code');

      if (room && room.trim()) {
        const cleanRoom = room.trim();
        config.syncRoom = cleanRoom;
        config.provider = 'direct';
        saveConfig(config);

        // URL'i temizle
        if (window.history && window.history.replaceState) {
          const cleanUrl = window.location.pathname + window.location.hash;
          window.history.replaceState({}, document.title, cleanUrl);
        }
        showToastMessage(`🔗 Eşitleme Odası Aktifleştirildi: ${cleanRoom}`);
        return true;
      }
    } catch (e) {
      console.warn('URL parametreleri işlenirken hata:', e);
    }
    return false;
  }

  // Telefon / Diğer Cihazlar İçin Eşleştirme Linki
  function getShareUrl() {
    const base = window.location.origin + window.location.pathname;
    const room = getSyncRoom();
    return `${base}?sync_room=${encodeURIComponent(room)}`;
  }

  // QR Kod Görsel URL'si (Telefon Kamerasıyla Okutmak İçin)
  function getQrCodeUrl() {
    const shareUrl = getShareUrl();
    return `https://api.qrserver.com/v1/create-qr-code/?size=260x260&margin=10&data=${encodeURIComponent(shareUrl)}`;
  }

  // Buluttan En Güncel Veriyi Çek (PULL)
  async function fetchFromCloud() {
    if (!navigator.onLine) {
      throw new Error('İnternet bağlantısı yok');
    }

    const room = getSyncRoom();
    const pollUrl = `${SYNC_SERVER}/${encodeURIComponent(room)}/json?poll=1&since=all`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);

    let res;
    try {
      res = await fetch(pollUrl, { cache: 'no-cache', signal: controller.signal });
    } finally {
      clearTimeout(timeoutId);
    }

    if (!res.ok) {
      throw new Error(`Bulut sunucusu yanıt vermedi: ${res.status}`);
    }

    const text = await res.text();
    if (!text || !text.trim()) {
      return null;
    }

    const lines = text.trim().split('\n').filter(Boolean);
    // En son 5 mesaja kadar geriye doğru tara (50 istek birden yapıp rate limite takılmamak için)
    let checkedCount = 0;
    for (let i = lines.length - 1; i >= 0 && checkedCount < 5; i--) {
      try {
        const msg = JSON.parse(lines[i]);
        if (msg.attachment && msg.attachment.url) {
          checkedCount++;
          let attachUrl = msg.attachment.url;
          if (attachUrl.startsWith('http://')) {
            attachUrl = 'https://' + attachUrl.slice(7);
          }
          const fileRes = await fetch(attachUrl, { cache: 'no-cache' });
          if (fileRes.ok) {
            const data = await fileRes.json();
            return data;
          }
        }
      } catch (e) {
        // Devam et
      }
    }

    return null;
  }

  // Bulut Verisini Onar ve Eksiksiz Kıl (Kullanıcının girmediği faturaları ASLA otomatik ekleme)
  function repairAndNormalize(data) {
    if (!data || !data.periods) return data;
    const initPeriods = window.INITIAL_DERS_DATA?.periods || [];
    initPeriods.forEach(initP => {
      let p = data.periods.find(x => x.id === initP.id);
      if (!p) {
        p = JSON.parse(JSON.stringify(initP));
        data.periods.push(p);
      } else {
        if ((!p.lessons || p.lessons.length === 0) && initP.lessons && initP.lessons.length > 0) {
          p.lessons = JSON.parse(JSON.stringify(initP.lessons));
        }
        if ((!p.payments || p.payments.length === 0) && initP.payments && initP.payments.length > 0) {
          p.payments = JSON.parse(JSON.stringify(initP.payments));
        }
        // Kişisel harcamalar: Kullanıcı ne girdiyse SADECE o kalmalı, otomatik sahte fatura eklenmemeli
        if (!p.myPayments || !Array.isArray(p.myPayments)) {
          p.myPayments = [];
        }
        // Sahte/test faturalarını temizle
        p.myPayments = p.myPayments.filter(pay => {
          if (!pay || !pay.id) return false;
          return !/^mypay_(aug|sep|nov)_\d+$/.test(pay.id) && !/^mypay_[1-7]$/.test(pay.id);
        });
      }
    });
    return data;
  }

  // Bulut Verisinin Güvenli ve Tam Olduğunu Doğrula
  function isCloudDataSafe(cloudData, localData) {
    if (!cloudData || typeof cloudData !== 'object') return false;
    if (!Array.isArray(cloudData.periods) || cloudData.periods.length === 0) return false;

    const cloudLessons = cloudData.periods.reduce((sum, p) => sum + (Array.isArray(p.lessons) ? p.lessons.length : 0), 0);

    // Eğer yerelde 50'den fazla ders varken buluttan 10'dan az ders geliyorsa, yerel veriyi koru!
    if (localData && Array.isArray(localData.periods)) {
      const localLessons = localData.periods.reduce((sum, p) => sum + (Array.isArray(p.lessons) ? p.lessons.length : 0), 0);
      if (localLessons >= 50 && cloudLessons < 10) {
        console.warn('Buluttan gelen veri yereldeki dersleri silecek kadar eksik. Yerel veri korundu!');
        return false;
      }
    }
    return true;
  }

  // Buluta Veri Gönderme (PUSH)
  async function pushToCloud(data) {
    if (!navigator.onLine) {
      throw new Error('İnternet bağlantısı yok');
    }
    if (!data) return false;

    // Giden veriyi her zaman tam ve sağlam kıl
    data = repairAndNormalize(data);

    // Zaman damgası ve cihaz adını ekle
    data._updatedAt = Date.now();
    data._lastDevice = getDeviceName();

    const room = getSyncRoom();
    const postUrl = `${SYNC_SERVER}/${encodeURIComponent(room)}`;

    const jsonStr = JSON.stringify(data);
    const blob = new Blob([jsonStr], { type: 'application/json' });

    // HTTP başlıklarında Türkçe/non-ASCII karakter kullanma (ByteString standardı gereği)
    const headers = {
      'Filename': 'ders_data.json'
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    let res;
    try {
      res = await fetch(postUrl, {
        method: 'POST',
        headers: headers,
        body: blob,
        signal: controller.signal
      });
    } finally {
      clearTimeout(timeoutId);
    }

    if (!res.ok) {
      throw new Error(`Bulut sunucusu yanıtı: ${res.status}`);
    }

    config.lastSyncedAt = data._updatedAt;
    config.lastDevice = data._lastDevice;
    saveConfig(config);
    return true;
  }

  // Canlı Olay Dinleyici (EventSource / SSE)
  function startLiveListener() {
    if (typeof window.EventSource === 'undefined') return;

    if (evtSource) {
      try { evtSource.close(); } catch (e) {}
      evtSource = null;
    }

    const room = getSyncRoom();
    const sseUrl = `${SYNC_SERVER}/${encodeURIComponent(room)}/sse`;

    try {
      evtSource = new EventSource(sseUrl);

      evtSource.onmessage = async (evt) => {
        if (!evt.data) return;
        try {
          const msg = JSON.parse(evt.data);
          if (msg.event === 'message' && msg.attachment && msg.attachment.url) {
            // Başka bir cihazdan gelen yeni bir dosya var!
            const fileRes = await fetch(msg.attachment.url, { cache: 'no-cache' });
            if (!fileRes.ok) return;
            let cloudData = await fileRes.json();
            if (!cloudData || !cloudData._updatedAt) return;

            // Yereldeki veriyi kontrol et
            const localDataStr = localStorage.getItem(DATA_STORAGE_KEY);
            let localTime = 0;
            let localData = null;
            if (localDataStr) {
              try {
                localData = JSON.parse(localDataStr);
                localTime = Number(localData._updatedAt) || 0;
              } catch (e) {}
            }

            // Güvenlik doğrulaması: eksik veya boş veriyle yerel verinin ezilmesini engelle
            if (!isCloudDataSafe(cloudData, localData)) {
              if (localData) {
                await pushToCloud(localData);
              }
              return;
            }

            // Gelen veriyi tam ve sağlam kıl
            cloudData = repairAndNormalize(cloudData);

            // Eğer buluttaki veri yerelden yeniyse anında güncelle!
            if (Number(cloudData._updatedAt) > localTime) {
              localStorage.setItem(DATA_STORAGE_KEY, JSON.stringify(cloudData));
              config.lastSyncedAt = Number(cloudData._updatedAt);
              config.lastDevice = cloudData._lastDevice || 'Diğer Cihaz';
              saveConfig(config);
              updateUIBadge('success');

              if (typeof onDataUpdatedCallback === 'function') {
                onDataUpdatedCallback(cloudData);
              }

              const deviceLabel = cloudData._lastDevice || 'Diğer cihaz';
              showToastMessage(`⚡ ${deviceLabel} tarafından yapılan değişiklikler anında aktarıldı!`);
            }
          }
        } catch (e) {
          console.warn('Canlı bildirim işlenirken hata:', e);
        }
      };

      evtSource.onerror = () => {
        // Otomatik yeniden bağlanma
        if (reconnectTimeout) clearTimeout(reconnectTimeout);
        reconnectTimeout = setTimeout(() => {
          if (navigator.onLine && (!evtSource || evtSource.readyState === EventSource.CLOSED)) {
            startLiveListener();
          }
        }, 5000);
      };

    } catch (e) {
      console.warn('Canlı dinleyici başlatılamadı:', e);
    }
  }

  // İki Yönlü Eşitleme
  async function sync(isManual = false) {
    if (isSyncing) return;
    if (!navigator.onLine) {
      updateUIBadge('offline');
      if (isManual) showToastMessage('İnternet bağlantısı yok (Çevrimdışı)');
      return;
    }

    isSyncing = true;
    updateUIBadge('syncing');

    try {
      const localDataStr = localStorage.getItem(DATA_STORAGE_KEY);
      let localData = null;
      if (localDataStr) {
        try { localData = JSON.parse(localDataStr); } catch (e) {}
      }

      // Yerel veri varsa mutlaka tam ve eksiksiz tut
      if (localData) {
        localData = repairAndNormalize(localData);
      }

      let cloudData = await fetchFromCloud();

      // Durum 1: Bulutta henüz veri yok, yerelde varsa buluta gönder
      if (!cloudData && localData) {
        await pushToCloud(localData);
        config.lastSyncedAt = Date.now();
        config.lastDevice = getDeviceName();
        saveConfig(config);
        updateUIBadge('success');
        if (isManual) showToastMessage('Yerel veriler buluta başarıyla yüklendi!');
        isSyncing = false;
        return;
      }

      // Durum 2: Bulutta veri var, yerelde yoksa doğrudan buluttakini al
      if (cloudData && !localData) {
        cloudData = repairAndNormalize(cloudData);
        localStorage.setItem(DATA_STORAGE_KEY, JSON.stringify(cloudData));
        config.lastSyncedAt = cloudData._updatedAt || Date.now();
        config.lastDevice = cloudData._lastDevice || 'Bulut';
        saveConfig(config);
        updateUIBadge('success');
        if (typeof onDataUpdatedCallback === 'function') {
          onDataUpdatedCallback(cloudData);
        }
        showToastMessage(`☁️ Buluttan güncel veriler yüklendi (${cloudData._lastDevice || 'Bulut'})`);
        isSyncing = false;
        return;
      }

      // Durum 3: Hem yerelde hem bulutta veri var -> EN SON DEĞİŞTİRİLENİ AL!
      if (cloudData && localData) {
        // Güvenlik doğrulaması: eksik veya bozuk bulut verisiyle yereli ezme
        if (!isCloudDataSafe(cloudData, localData)) {
          console.warn('Buluttaki veri yerelden eksik, yerel tam veri buluta aktarılıyor...');
          await pushToCloud(localData);
          config.lastSyncedAt = Date.now();
          config.lastDevice = getDeviceName();
          saveConfig(config);
          updateUIBadge('success');
          isSyncing = false;
          return;
        }

        cloudData = repairAndNormalize(cloudData);

        const cloudTime = Number(cloudData._updatedAt) || 0;
        const localTime = Number(localData._updatedAt) || 0;

        if (cloudTime > localTime) {
          // Buluttaki veri daha yeni!
          localStorage.setItem(DATA_STORAGE_KEY, JSON.stringify(cloudData));
          config.lastSyncedAt = cloudTime;
          config.lastDevice = cloudData._lastDevice || 'Diğer Cihaz';
          saveConfig(config);
          updateUIBadge('success');
          if (typeof onDataUpdatedCallback === 'function') {
            onDataUpdatedCallback(cloudData);
          }
          const timeStr = new Date(cloudTime).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
          showToastMessage(`☁️ Güncel veriler yüklendi (${cloudData._lastDevice || 'Diğer cihaz'} - ${timeStr})`);
        } else if (localTime > cloudTime) {
          // Yereldeki veri daha yeni -> Buluta gönder
          await pushToCloud(localData);
          config.lastSyncedAt = localTime;
          config.lastDevice = getDeviceName();
          saveConfig(config);
          updateUIBadge('success');
          if (isManual) showToastMessage('En son değişiklikler buluta aktarıldı');
        } else {
          // Eşit
          syncFailCount = 0;
          config.lastSyncedAt = cloudTime || Date.now();
          saveConfig(config);
          updateUIBadge('success');
          if (isManual) showToastMessage('Tüm veriler zaten bulutla tam senkronize!');
        }
      } else {
        updateUIBadge('idle');
      }
    } catch (err) {
      console.warn('Bulut senkronizasyonu uyarısı:', err);
      syncFailCount++;
      if (isManual) {
        updateUIBadge('error', err.message);
        showToastMessage(`Senkronizasyon hatası: ${err.message}`);
      } else if (syncFailCount >= 3) {
        updateUIBadge('error', err.message);
      }
    } finally {
      isSyncing = false;
    }
  }

  // Değişiklik Olduğunda Buluta Otomatik Gönderim (Debounced)
  function schedulePush(data) {
    if (!config.autoSync) return;
    updateUIBadge('syncing');

    if (pushDebounceTimer) clearTimeout(pushDebounceTimer);
    pushDebounceTimer = setTimeout(async () => {
      try {
        const success = await pushToCloud(data);
        if (success) {
          syncFailCount = 0;
          config.lastSyncedAt = Date.now();
          config.lastDevice = getDeviceName();
          saveConfig(config);
          updateUIBadge('success');
        } else {
          updateUIBadge('idle');
        }
      } catch (e) {
        console.warn('Otomatik bulut kaydı uyarısı:', e);
        syncFailCount++;
        if (syncFailCount >= 3) {
          updateUIBadge('error', e.message);
        } else {
          // Kısa süre sonra sessizce 1 kez daha dene
          setTimeout(async () => {
            try {
              await pushToCloud(data);
              syncFailCount = 0;
              updateUIBadge('success');
            } catch (retryErr) {
              console.warn('Yeniden bulut denemesi başarısız:', retryErr);
            }
          }, 2500);
        }
      }
    }, 600);
  }

  // Üst Bardaki Rozeti Güncelle
  function updateUIBadge(customStatus, errorMsg) {
    const btn = document.getElementById('btnCloudSync');
    const dot = document.getElementById('cloudStatusDot');
    const icon = document.getElementById('cloudStatusIcon');
    const text = document.getElementById('cloudStatusText');
    if (!btn || !text) return;

    const currentStatus = customStatus || (config.lastSyncedAt ? 'success' : 'idle');

    btn.classList.remove('syncing', 'unsynced', 'offline', 'success');

    if (!navigator.onLine || currentStatus === 'offline') {
      btn.classList.add('offline');
      if (dot) dot.className = 'status-dot gray';
      if (icon) icon.textContent = '📡';
      text.textContent = 'Çevrimdışı';
      btn.title = 'İnternet bağlantısı yok, yapılan değişiklikler cihazda saklanıyor.';
      return;
    }

    if (currentStatus === 'syncing') {
      btn.classList.add('syncing');
      if (dot) dot.className = 'status-dot yellow';
      if (icon) {
        icon.textContent = '🔄';
        icon.classList.add('spin');
      }
      text.textContent = 'Eşitleniyor...';
      btn.title = 'Telefon ve PC arasında canlı senkronizasyon yapılıyor...';
      return;
    }

    if (icon) icon.classList.remove('spin');

    if (currentStatus === 'error') {
      btn.classList.add('unsynced');
      if (dot) dot.className = 'status-dot red';
      if (icon) icon.textContent = '⚠️';
      text.textContent = 'Bulut Hatası';
      btn.title = errorMsg ? `Hata: ${errorMsg}` : 'Bulut bağlantısı kurulamadı.';
      return;
    }

    if (currentStatus === 'success' && config.lastSyncedAt) {
      btn.classList.add('success');
      if (dot) dot.className = 'status-dot green';
      if (icon) icon.textContent = '☁️';
      const timeStr = new Date(config.lastSyncedAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
      text.textContent = `Canlı Bulut (${timeStr})`;
      btn.title = `Telefon ve PC senkronize! Son işlem: ${timeStr} (${config.lastDevice || ''})`;
      return;
    }

    // Boş / Hazır
    if (dot) dot.className = 'status-dot green';
    if (icon) icon.textContent = '☁️';
    text.textContent = 'Canlı Bulut';
    btn.title = 'Telefon ve PC arasında anlık eşitleme aktif.';
  }

  // Toast Bildirim Göster
  function showToastMessage(msg) {
    if (typeof window.showToast === 'function') {
      window.showToast(msg);
    } else {
      const toast = document.getElementById('appToast');
      if (toast) {
        toast.textContent = msg;
        toast.className = 'toast show';
        setTimeout(() => { toast.className = 'toast'; }, 3500);
      }
    }
  }

  // Eşitleme Odasını Değiştir
  function setSyncRoom(newRoom) {
    if (!newRoom || !newRoom.trim()) return;
    config.syncRoom = newRoom.trim();
    saveConfig(config);
    startLiveListener();
    sync(true);
  }

  // Başlangıç Kurulumu
  function init(options = {}) {
    if (options.onDataUpdated) {
      onDataUpdatedCallback = options.onDataUpdated;
    }

    checkUrlParams();
    updateUIBadge();

    // Canlı dinleyiciyi başlat
    startLiveListener();

    // Başlangıçta eşitle
    setTimeout(() => {
      sync(false);
    }, 600);

    // Sekmeye dönüldüğünde veya ekran açıldığında hemen kontrol et
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        sync(false);
      }
    });

    window.addEventListener('focus', () => {
      sync(false);
    });

    // İnternet bağlantısı geldiğinde
    window.addEventListener('online', () => {
      showToastMessage('İnternet aktif, cihazlar senkronize ediliyor...');
      startLiveListener();
      sync(false);
    });

    window.addEventListener('offline', () => {
      updateUIBadge('offline');
    });

    // Periyodik sessiz kontrol (25 saniyede bir)
    setInterval(() => {
      if (document.visibilityState === 'visible' && navigator.onLine) {
        sync(false);
      }
    }, 25000);
  }

  // Global Dışa Aktarım
  window.CloudSync = {
    init,
    sync,
    syncNow: async (data, callback) => {
      await sync(true);
      if (typeof callback === 'function') {
        const localDataStr = localStorage.getItem(DATA_STORAGE_KEY);
        let resData = null;
        if (localDataStr) {
          try { resData = JSON.parse(localDataStr); } catch (e) {}
        }
        callback({ success: true, data: resData });
      }
    },
    onDataPulled: (cb) => {
      onDataUpdatedCallback = cb;
    },
    schedulePush,
    getConfig: () => Object.assign({}, config),
    saveConfig,
    setSyncRoom,
    getSyncRoom,
    getShareUrl,
    getQrCodeUrl,
    getDeviceName
  };

})(window);
