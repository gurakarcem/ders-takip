# 🎓 DersTakip Pro - Kullanım Kılavuzu

Özel ders takip, takvim çizelgesi, aylık kaç ders yapıldığı matrisi, ödeme kontrolü ve **Google Takvim entegrasyonu** başarıyla sisteme eklenmiştir!

---

## 🚀 Programı Başlatma

- **Masaüstünden Başlatma (Önerilen):**  
  Klasördeki **[`DersTakip.bat`](file:///c:/Users/gurak/Desktop/%C3%A7al%C4%B1%C5%9Fma/DersTakip.bat)** dosyasına çift tıklayın.  
  *Program bağımsız bir masaüstü penceresi modunda açılır.*
- **Tarayıcı ile Başlatma:**  
  Klasördeki **[`index.html`](file:///c:/Users/gurak/Desktop/%C3%A7al%C4%B1%C5%9Fma/index.html)** dosyasına çift tıklayarak herhangi bir tarayıcıda açabilirsiniz.

> [!NOTE]  
> Program **%100 internetsiz (çevrimdışı)** çalışır. Bilgisayarınızda hiçbir ek kurulum gerektirmez.

---

## 📅 Google Takvim Entegrasyonu Nasıl Çalışır?

Programa Google Takvim için **3 farklı ve çok pratik entegrasyon** eklenmiştir:

### 1. TÜM YAPILAN DERSLERİ (3 YIL, 562 DERS) Google Takvim'e İşleme
- **Tek Tıkla Sihirbaz (En Hızlı Yol):**
  - Klasördeki **[`GoogleTakvim_IceAktar.bat`](file:///c:/Users/gurak/Desktop/%C3%A7al%C4%B1%C5%9Fma/GoogleTakvim_IceAktar.bat)** dosyasına çift tıklayın.
  - Program tüm 3 yıllık 562 dersinizi içeren **[`Tum_Dersler_Google_Takvim.ics`](file:///c:/Users/gurak/Desktop/%C3%A7al%C4%B1%C5%9Fma/Tum_Dersler_Google_Takvim.ics)** dosyasını hazırlar ve tarayıcınızda Google Takvim'in doğrudan **İçe Aktarma Sayfası**'nı açar.
  - Açılan ekranda "Bilgisayarınızdan bir dosya seçin"e basıp `Tum_Dersler_Google_Takvim.ics` dosyasını seçip **"İçe Aktar"** butonuna basmanız yeterlidir!
  - Tüm dersler öğrenci isimleri, saatleri, ücretleri ve ödeme durumlarıyla Google Takvim'inize saniyeler içinde işlenir.
- **Uygulama İçinden İndirme:**
  - Uygulamada **"Google Takvim"** sekmesine gidin.
  - **`📥 TÜM YILLARIN DERSLERİNİ Google Takvim İçin İndir (562+ Ders .ics)`** butonuna basarak dosyayı indirebilirsiniz.

### 2. YENİ EKLENECEK DERSLERİ Otomatik Google Takvim'e İşleme
- **`➕ Ders Kaydet`** penceresinde:
  - `☑️ Kaydettikten sonra bu dersi Google Takvim'de de aç` seçeneği varsayılan olarak **işaretlidir**.
  - Dersi kaydettiğiniz anda otomatik olarak Google Takvim'in etkinlik penceresi yeni bir sekmede açılır.
  - Öğrencinin adı, sınıfı, ders ücreti, saati, ödeme durumu ve notları önceden doldurulmuş olarak gelir; sadece mavi **"Kaydet"** butonuna basarak Google Takvim'inize tek tıkla işleyebilirsiniz!
- **Geçmiş Bir Dersi Düzenlediğinizde:**
  - Herhangi bir dersin **`✏️ Düzenle`** penceresinde bulunan **`📅 Google Takvim'de Aç`** butonuna basarak o dersi anında Google Takvim'e aktarabilir veya güncelleyebilirsiniz.

### 3. Canlı Google Takvim Görünümü
- Program içindeki **`📅 Google Takvim`** sekmesine tıkladığınızda Gmail adresinizi kaydedebilirsiniz.
- Kişisel Google Takviminiz programdan hiç çıkmadan doğrudan ekranınızda canlı olarak görüntülenir.

---

## 🧭 Temel İş Akışı

### 1️⃣ Yeni Gelen Öğrenci İçin Yer Açma & Ders Parası Belirleme
- Üst bardaki **`👤 Yeni Öğrenci Kabulü`** butonuna tıklayın.
- Öğrencinin adı, sınıfı ve **Ders Başı Belirlenen Ücreti (₺)** girilir.
- Kaydedildiği anda o senenin listesinde öğrenci için otomatik yer açılır; takvim sütunu, aylık matris sütunu ve profil kartı anında hazır hale gelir.

### 2️⃣ Yapılan Her Dersi Kaydetme
- **`➕ Ders Kaydet`** butonuna tıkladığınızda:
  - Öğrenci seçildiğinde belirlenen ders parası otomatik kutucuğa dolacaktır.
  - Tarih, saat, süre ve işlenen konu girilir.
  - **"Ders Parası Yatırıldı mı?"** seçeneğinden `🟢 Ödendi` veya `🔴 Yatırılmadı (Bekliyor)` seçilir.
  - Ders anında ilgili ayın ders sayısına (+1) ve ödeme tablosuna yansır.

### 3️⃣ Kendi Ödemeleriniz & Gider Takibi (💳 Ödemeler)
- **`💳 Ödemeler`** sekmesi **tamamen sizin kendi kişisel ödemelerinize** ayrılmıştır (kredi kartları, ev kirası, elektrik/gaz/su faturaları, kredi taksitleri, bağkur primi vb.):
  - **Tarih ve Ödeme Bilgisi Girişi:**
    - Üstteki **Hızlı Ödeme Girişi** formu veya üst bardaki **`💳 Ödeme Ekle`** butonu ile:
      - **📅 Ödeme Tarihi** (Ödeme veya son ödeme vadesi)
      - **📝 Ödeme Bilgisi** (Örn: "Garanti BBVA Kredi Kartı", "Ev Kirası", "İgdaş Doğalgaz Faturası", "Turkcell Telefon", "Bağkur Primi")
      - **💰 Tutar (₺)**
      - **🏷️ Kategori** (Kredi Kartı, Fatura, Kira & Aidat, Kredi Taksiti, Sigorta & Vergi, Alışveriş, Diğer)
      - **📌 Durum** (🔴 Bekliyor veya 🟢 Ödendi)
      - **💬 Not / Açıklama** (Örn: "Son ödeme 25'i", "Otomatik talimat verildi", vb.)
    - **`💾 Ödemeyi Kaydet`** butonuna basarak anında listeye kaydedebilirsiniz.
  - 📋 **Kayıtlı Ödemelerim Listesi:** Tüm kişisel ödemeleriniz tarih, kategori rozeti, tutar ve durum bilgileriyle listelenir.
  - 🔄 **Tek Tıkla Ödendi Yap (Toggle):** Tablodaki `🔴 Bekliyor` butonuna tek tıkla bastığınızda anında `🟢 Ödendi ✓` durumuna geçer ve kasanız güncellenir.
  - 🔍 **Filtreleme & Arama:** `Tümü`, `🔴 Bekleyenler`, `🟢 Ödenenler` butonları, kategori seçici ve anlık arama kutusuyla istediğiniz ödemeyi saniyeler içinde bulun.
  - 📥 **Excel İndir:** **`Excel İndir`** butonu ile tüm kişisel ödeme geçmişinizi Excel/CSV olarak bilgisayarınıza indirebilirsiniz.

### 4️⃣ Öğrenci Ders Ücreti & Tahsilat Takibi (💰 Öğrenci Tahsilatı)
- **`💰 Öğrenci Tahsilatı`** sekmesinde öğrencilerin ders parası yatırma geçmişi ve bakiye durumu takip edilir:
  - **Öğrenci Tahsilat Girişi:** Öğrencinin yatırdığı parayı tarih, tutar, ödeme yöntemi (EFT, FAST, Nakit, Kart) ve dekont açıklamasıyla kaydedin.
  - 📊 **Öğrenci Bakiye Tablosu:** Her öğrencinin toplam dersi, hak edilen ücret, yatırılan ödeme ve kalan borç/alacak durumu net görünür.
  - 🔍 **Ders Bazlı Ödeme Kontrolü:** İşlenen derslerin tek tek ödenip ödenmediğini ders bazında kontrol edin.
  - 📥 **Tahsilatları Excel İndir:** Öğrenci ödeme dökümünü Excel/CSV formatında indirin.

### 5️⃣ Aylık Kaç Ders Yapıldığının Tablolanması (📈 Aylık Ders Sayıları Tablosu)
- Ağustos'tan Haziran'a kadar her ay hangi öğrenciyle kaç ders yapıldığı (ve ay toplamları) matris halinde sunulur.
- İster `📚 Ders Sayıları`, ister `💰 Gelirler (₺)` modunda incelenebilir.
- **`Excel İndir`** butonu ile Excel/CSV olarak bilgisayarınıza aktarılabilir.

### 6️⃣ Geçmiş Derslerin Fiyat ve Tarih Bilgilerini Değiştirme (✏️ Ders Düzenleme & Silme)
Geçmişte işlenmiş herhangi bir dersin fiyatını, tarihini, saatini veya ödeme durumunu dilediğiniz gibi güncelleyebilirsiniz:
- **Nereden Düzenlenir?**
  1. **Ödeme & Tahsilat Takibi** tablosunda ilgili ders satırındaki **`✏️ Düzenle`** butonuna tıklayarak.
  2. **Tüm Ders Kayıtları** tablosunda ilgili satırdaki **`✏️ Düzenle`** butonuna tıklayarak.
  3. **Kronolojik Çizelge (Ders Günleri)** sekmesinde herhangi bir **tarih kutucuğuna (hapına)** doğrudan tıklayarak.
  4. Öğrenci detay dökümündeki **`✏️ Düzenle`** butonuna basarak.
- **Neler Değiştirilebilir?**
  - **Tarih Değişimi:** Tarihi değiştirdiğinizde (örneğin Ekim ayından Kasım ayına aldığınızda), program dersi otomatik olarak eski aydan düşüp yeni ayın matrisine ve grafiğine işler.
  - **Fiyat Değişimi:** Ders ücretini güncellediğinizde aylık ciro, öğrencinin borç durumu ve kasanızdaki toplam tahsilat anında otomatik olarak yeniden hesaplanır.
  - **Ödeme Durumu:** `🟢 Ödendi` veya `🔴 Yatırılmadı` olarak ayarlanabilir.
  - **Dersi Silme:** Açılan pencerenin sol altındaki **`🗑️ Dersi Sil`** butonu ile yanlış girilmiş dersleri tek tıkla silebilirsiniz.

### 7️⃣ Cihazlar Arası Canlı Bulut Senkronizasyonu (Telefon & Bilgisayar Eşitleme ☁️)
Program artık **hangi cihazdan girerseniz girin en son verilerinizi otomatik eşitleyecek** canlı bulut motoruna sahiptir:
- **Nasıl Çalışır?**
  - Bilgisayardan ders veya ödeme girdiğinizde anında buluta yazılır.
  - Telefonunuzdan siteyi açtığınızda bilgisayardan girilen en güncel liste anında yüklenir.
  - Telefonunuzdan yeni ders eklediğinizde ise bilgisayarınızdaki sekme saniyeler içinde yeni verilerle güncellenir.
- **Nasıl Başlatılır?**
  1. Üst bardaki **`☁️ Bulut Eşitle`** butonuna tıklayın.
  2. **1. Seçenek (Önerilen):** "Google ile Giriş Yap & Bağlan" butonuna tıklayarak tek tıkla hesabınızı bağlayın.
  3. **Telefonu Eşleştirme:** "Telefona QR Kodu Göster" butonuna basarak ekrandaki QR kodu telefonunuzun kamerasıyla okutun veya "Telefon Linkini Kopyala" ile kendinize WhatsApp'tan gönderin.
  4. Telefonunuz anında aynı bulut veritabanına bağlanacak ve sıfır ayarla her iki cihazınız da ortak veriyi kullanacaktır!

### 8️⃣ Manuel Dosya Yedeği Alma & Google Drive (💾)
Çalışmanızı dosya olarak da güvenle saklamak için:
- **1 Tıkla Yedekleme & Drive Açma:**
  - Klasördeki **[`GoogleDrive_Yedekle.bat`](file:///c:/Users/gurak/Desktop/%C3%A7al%C4%B1%C5%9Fma/GoogleDrive_Yedekle.bat)** dosyasına çift tıklayın.
  - Program tüm dosyalarınızı tek bir sıkıştırılmış **[`DersTakip_GoogleDrive_Yedek.zip`](file:///c:/Users/gurak/Desktop/%C3%A7al%C4%B1%C5%9Fma/DersTakip_GoogleDrive_Yedek.zip)** paketine dönüştürür ve Google Drive'ınızı otomatik olarak tarayıcınızda açar.
  - Açılan sayfaya bu ZIP dosyasını veya çalışma klasörünüzü sürükleyip bırakmanız yeterlidir!
- **Uygulama İçinden JSON Bulut Yedeği:**
  - Programdaki **`💾 Yedekle`** butonuna bastığınızda **"Google Drive İçin Yedek İndir (.json)"** butonuna tıklayarak verilerinizi doğrudan Drive'ınıza kaydedebilir veya istediğiniz cihazda **"Yedekten Geri Yükle"** ile geri alabilirsiniz.

---

### 9️⃣ Telefon Uygulaması Olarak Kullanma (📱 iPhone & Android PWA)
Uygulama tam bir **Progressive Web App (PWA)** olarak yapılandırılmıştır. Herhangi bir App Store / Play Store ücreti veya kurulumu olmadan doğrudan telefonunuza tam ekran bir mobil uygulama olarak kurulabilir:

#### A) Yerel Wi-Fi İle Telefona Yükleme (Hemen Şimdi):
1. Bilgisayarınız ve telefonunuzun aynı Wi-Fi ağına bağlı olduğundan emin olun.
2. Klasördeki **[`TelefondaAc.bat`](file:///c:/Users/gurak/Desktop/%C3%A7al%C4%B1%C5%9Fma/TelefondaAc.bat)** dosyasına çift tıklayın.
3. Ekranda çıkan yerel adresi (örn: `http://192.168.1.13:8080/`) telefonunuzun tarayıcısından (Safari veya Chrome) açın.
4. **Telefona Kurulum:**
   - **iPhone (iOS):** Safari'de alttaki **Paylaş (⎋)** simgesine dokunun ➔ **"Ana Ekrana Ekle"** seçeneğini seçin.
   - **Android:** Chrome'da sağ üstteki **üç nokta (⋮)** simgesine dokunun ➔ **"Uygulamayı Yükle"** veya **"Ana Ekrana Ekle"** seçeneğini seçin.
5. Telefonunuzun ana ekranına özel logonuzla **"DersTakip Pro"** uygulaması eklenir! Artık internetiniz olmasa bile (`service-worker.js` sayesinde) telefonunuzdan açıp ders ve ödeme takibi yapabilirsiniz.

#### B) İnternet Üzerinden Kalıcı Mobil Kullanım (Önerilen):
- `DersTakip_GoogleDrive_Yedek.zip` dosyasını ücretsiz bir statik barındırıcıya (örn: [Netlify Drop](https://app.netlify.com/drop) veya GitHub Pages) sürükleyip bırakarak kendinize özel kalıcı bir web adresi alabilir ve telefonunuzdan 7/24 dilediğiniz yerden erişebilirsiniz.

---

## 📁 Dosyalar

| Dosya Adı | Açıklama |
|---|---|
| `DersTakip.bat` | 🚀 **Masaüstü Uygulama Başlatıcısı** (Bilgisayarda pencere olarak açar) |
| `TelefondaAc.bat` | 📱 **Telefon Uygulaması Yayını** (Aynı Wi-Fi'daki telefona bağlar) |
| `GoogleTakvim_IceAktar.bat` | 📅 **Google Takvim'e İşleme Sihirbazı** (Tek tıkla tüm dersleri işler) |
| `Tum_Dersler_Google_Takvim.ics` | 🗓️ 3 yıla ait tüm 562 dersin Google Takvim dosyası |
| `GoogleDrive_Yedekle.bat` | ☁️ **Google Drive Yedekleyici** (Otomatik paketleyip Drive'ı açar) |
| `DersTakip_GoogleDrive_Yedek.zip` | 📦 Google Drive'a yüklenecek hazır arşiv paketi |
| `manifest.json` | 📲 Mobil telefon uygulama bildirim ve ikon yapılandırması |
| `service-worker.js` | ⚡ Telefonda internetsiz (çevrimdışı) çalışma motoru |
| `icon-192.png` & `icon-512.png` | 🎨 Telefon ana ekranı için yüksek çözünürlüklü uygulama logoları |
| `index.html` | 🌐 Programın ana arayüz dosyası |
| `styles.css` | 🎨 Modern masaüstü ve mobil alt bar stilleri |
| `app.js` | ⚡ Reaktif hesaplama, PWA ve Google Takvim motoru |
| `initial_data.js` | 📦 3 eğitim yılına ait gömülü veritabanı |
| `veri.json` | 📄 Veritabanının JSON formatındaki kopyası |
| `orijinal_veri.csv` | 📑 İlk paylaştığınız ham dosyanın yedeği |

