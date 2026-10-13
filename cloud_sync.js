/**
 * DersTakip Pro - Cihazlar Arası Bulut Senkronizasyon Motoru (CloudSync)
 * Bilgisayar, telefon ve tabletler arasında verileri ortak bulutta tutar ve
 * her cihazda en son girilen güncel durumun otomatik yüklenmesini sağlar.
 */

(function (window) {
  'use strict';

  // Varsayılan Yapılandırma
  const CONFIG_STORAGE_KEY = 'DERS_TAKIP_CLOUD_CONFIG';
  const DATA_STORAGE_KEY = 'DERS_TAKIP_PRO_DATA';

  const defaultState = {
    provider: 'puter', // 'puter', 'firebase', 'custom'
    firebaseUrl: '',
    customUrl: '',
    customKey: '',
    autoSync: true,
    lastSyncedAt: null,
    lastDevice: '',
    status: 'idle' // 'idle', 'syncing', 'success', 'error', 'offline'
  };

  let config = loadConfig();
  let pushDebounceTimer = null;
  let onDataUpdatedCallback = null;
  let isSyncing = false;

  function loadConfig() {
    try {
      const saved = localStorage.getItem(CONFIG_STORAGE_KEY);
      if (saved) {
        return Object.assign({}, defaultState, JSON.parse(saved));
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

  // Cihaz Bilgisi Tespiti
  function getDeviceName() {
    const ua = navigator.userAgent || '';
    if (/android/i.test(ua)) return 'Samsung / Android Telefon';
    if (/iphone|ipad|ipod/i.test(ua)) return 'iPhone / iPad';
    if (/windows/i.test(ua)) return 'Windows Bilgisayar';
    if (/macintosh|mac os x/i.test(ua)) return 'Mac Bilgisayar';
    return 'Web Tarayıcısı';
  }

  // URL Parametrelerinden (QR Kod veya Paylaşım Linki) Yapılandırma Al
  function checkUrlParams() {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const provider = urlParams.get('sync_provider');
      const firebaseUrl = urlParams.get('sync_fb');
      const customUrl = urlParams.get('sync_custom');
      const customKey = urlParams.get('sync_key');

      let updated = false;

      if (provider) {
        config.provider = provider;
        updated = true;
      }
      if (firebaseUrl) {
        config.firebaseUrl = decodeURIComponent(firebaseUrl);
        config.provider = 'firebase';
        updated = true;
      }
      if (customUrl) {
        config.customUrl = decodeURIComponent(customUrl);
        config.provider = 'custom';
        updated = true;
      }
      if (customKey) {
        config.customKey = decodeURIComponent(customKey);
        updated = true;
      }

      if (updated) {
        saveConfig(config);
        // URL'i temizle (sayfa yenilendiğinde tekrar parametre aramasın)
        if (window.history && window.history.replaceState) {
          const cleanUrl = window.location.pathname + window.location.hash;
          window.history.replaceState({}, document.title, cleanUrl);
        }
        return true;
      }
    } catch (e) {
      console.warn('URL parametreleri işlenirken hata:', e);
    }
    return false;
  }

  // Telefon / Diğer Cihazlar İçin Eşleştirme Linki Üret
  function getShareUrl() {
    const base = window.location.origin + window.location.pathname;
    const params = new URLSearchParams();

    params.set('sync_provider', config.provider);
    if (config.provider === 'firebase' && config.firebaseUrl) {
      params.set('sync_fb', config.firebaseUrl);
    } else if (config.provider === 'custom' && config.customUrl) {
      params.set('sync_custom', config.customUrl);
      if (config.customKey) params.set('sync_key', config.customKey);
    }

    return `${base}?${params.toString()}`;
  }

  // QR Kod Görsel URL'si
  function getQrCodeUrl() {
    const shareUrl = getShareUrl();
    return `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(shareUrl)}`;
  }

  // Sağlayıcıya Göre Veri Çekme (PULL)
  async function fetchFromCloud() {
    if (!navigator.onLine) {
      throw new Error('İnternet bağlantısı yok');
    }

    if (config.provider === 'puter') {
      if (!window.puter) {
        throw new Error('Puter bulut kütüphanesi yüklenemedi');
      }
      const isSignedIn = await window.puter.auth.isSignedIn();
      if (!isSignedIn) {
        return null; // Henüz giriş yapılmamış
      }
      const data = await window.puter.kv.get('ders_takip_pro_data');
      if (!data) return null;
      return typeof data === 'string' ? JSON.parse(data) : data;
    }

    if (config.provider === 'firebase') {
      if (!config.firebaseUrl) {
        return null; // Henüz URL tanımlanmamış
      }
      let url = config.firebaseUrl.trim();
      if (!url.endsWith('.json')) {
        url = url.replace(/\/+$/, '') + '/ders_data.json';
      }
      const res = await fetch(url, { cache: 'no-cache' });
      if (!res.ok) {
        throw new Error(`Firebase yanıt hatası: ${res.status}`);
      }
      const data = await res.json();
      return data;
    }

    if (config.provider === 'custom') {
      if (!config.customUrl) return null;
      const headers = { 'Content-Type': 'application/json' };
      if (config.customKey) headers['Authorization'] = `Bearer ${config.customKey}`;
      const res = await fetch(config.customUrl, { headers, cache: 'no-cache' });
      if (!res.ok) throw new Error(`Özel bulut yanıt hatası: ${res.status}`);
      return await res.json();
    }

    return null;
  }

  // Sağlayıcıya Göre Veri Gönderme (PUSH)
  async function pushToCloud(data) {
    if (!navigator.onLine) {
      throw new Error('İnternet bağlantısı yok');
    }
    if (!data) return false;

    // Zaman damgası ve cihaz adını ekle
    data._updatedAt = Date.now();
    data._lastDevice = getDeviceName();

    if (config.provider === 'puter') {
      if (!window.puter) throw new Error('Puter kütüphanesi hazır değil');
      const isSignedIn = await window.puter.auth.isSignedIn();
      if (!isSignedIn) return false;
      await window.puter.kv.set('ders_takip_pro_data', JSON.stringify(data));
      return true;
    }

    if (config.provider === 'firebase') {
      if (!config.firebaseUrl) return false;
      let url = config.firebaseUrl.trim();
      if (!url.endsWith('.json')) {
        url = url.replace(/\/+$/, '') + '/ders_data.json';
      }
      const res = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!res.ok) {
        throw new Error(`Firebase yazma hatası: ${res.status}`);
      }
      return true;
    }

    if (config.provider === 'custom') {
      if (!config.customUrl) return false;
      const headers = { 'Content-Type': 'application/json' };
      if (config.customKey) headers['Authorization'] = `Bearer ${config.customKey}`;
      const res = await fetch(config.customUrl, {
        method: 'PUT',
        headers,
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error(`Özel bulut yazma hatası: ${res.status}`);
      return true;
    }

    return false;
  }

  // İki Yönlü Eşitleme (Zaman Damgasına Göre En Yeni Veriyi Seçme)
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

      const cloudData = await fetchFromCloud();

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

      // Durum 3: Hem yerelde hem bulutta veri var -> EN SON GİRİLENE GÖRE DÜZENLE!
      if (cloudData && localData) {
        const cloudTime = Number(cloudData._updatedAt) || 0;
        const localTime = Number(localData._updatedAt) || 0;

        if (cloudTime > localTime) {
          // Buluttaki veri daha yeni! (Örn: Diğer cihazdan son girilen ders)
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
          // Yereldeki veri daha yeni! (Bu cihazda yeni işlem yapılmış)
          await pushToCloud(localData);
          config.lastSyncedAt = localTime;
          config.lastDevice = getDeviceName();
          saveConfig(config);
          updateUIBadge('success');
          if (isManual) showToastMessage('En son değişiklikler buluta aktarıldı');
        } else {
          // Birebir eşit
          config.lastSyncedAt = cloudTime || Date.now();
          saveConfig(config);
          updateUIBadge('success');
          if (isManual) showToastMessage('Tüm veriler zaten bulutla tam senkronize!');
        }
      } else {
        updateUIBadge('idle');
      }
    } catch (err) {
      console.warn('Bulut senkronizasyonu sırasında hata:', err);
      updateUIBadge('error', err.message);
      if (isManual) showToastMessage(`Senkronizasyon hatası: ${err.message}`);
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
          config.lastSyncedAt = Date.now();
          config.lastDevice = getDeviceName();
          saveConfig(config);
          updateUIBadge('success');
        } else {
          updateUIBadge('idle');
        }
      } catch (e) {
        console.warn('Otomatik bulut kaydı hatası:', e);
        updateUIBadge('error', e.message);
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
      btn.title = 'Bulutla çift yönlü senkronizasyon yapılıyor...';
      return;
    }

    if (icon) icon.classList.remove('spin');

    if (currentStatus === 'error') {
      btn.classList.add('unsynced');
      if (dot) dot.className = 'status-dot red';
      if (icon) icon.textContent = '⚠️';
      text.textContent = 'Bulut Hatası';
      btn.title = errorMsg ? `Hata: ${errorMsg}` : 'Bulut bağlantısı kurulamadı. Ayarları kontrol edin.';
      return;
    }

    if (currentStatus === 'success' && config.lastSyncedAt) {
      btn.classList.add('success');
      if (dot) dot.className = 'status-dot green';
      if (icon) icon.textContent = '☁️';
      const timeStr = new Date(config.lastSyncedAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
      text.textContent = `Bulut (${timeStr})`;
      btn.title = `Tüm cihazlar senkronize! Son eşitleme: ${timeStr} (${config.lastDevice || ''})`;
      return;
    }

    // Boş / Henüz ayarlanmadı
    if (dot) dot.className = 'status-dot yellow';
    if (icon) icon.textContent = '☁️';
    text.textContent = 'Bulut Eşitle';
    btn.title = 'Cihazlar arası bulut senkronizasyonunu başlatmak için tıklayın.';
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

  // Başlangıç Kurulumu
  function init(options = {}) {
    if (options.onDataUpdated) {
      onDataUpdatedCallback = options.onDataUpdated;
    }

    checkUrlParams();
    updateUIBadge();

    // Sayfa açıldığında otomatik eşitle
    setTimeout(() => {
      sync(false);
    }, 800);

    // Sekmeye dönüldüğünde veya telefon ekranı açıldığında otomatik kontrol et
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        sync(false);
      }
    });

    window.addEventListener('focus', () => {
      sync(false);
    });

    // İnternet bağlantısı durumu değiştiğinde
    window.addEventListener('online', () => {
      showToastMessage('İnternet bağlantısı aktif, bulut eşitleniyor...');
      sync(false);
    });

    window.addEventListener('offline', () => {
      updateUIBadge('offline');
    });

    // Periyodik sessiz kontrol (30 saniyede bir)
    setInterval(() => {
      if (document.visibilityState === 'visible' && navigator.onLine) {
        sync(false);
      }
    }, 30000);
  }

  // Global Dışa Aktarım
  window.CloudSync = {
    init,
    sync,
    schedulePush,
    getConfig: () => Object.assign({}, config),
    saveConfig,
    getShareUrl,
    getQrCodeUrl,
    getDeviceName
  };

})(window);
