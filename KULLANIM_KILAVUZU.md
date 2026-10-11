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

### 3️⃣ Ders Parasını Yatırıp Yatırmadığını Kontrol Etme (💳 Ödeme & Tahsilat Takibi)
- **`Ödeme & Tahsilat Takibi`** sekmesinde:
  - 💰 **Toplam Hak Ediş**, 🟢 **Yatan Para** ve 🔴 **Yatırılmayan (Bekleyen Borç)** kasanızda net olarak görünür.
  - Her öğrencinin toplam dersi, yatırdığı para ve kalan borcu listelenir.
  - Tek bir tıkla **`🔴 Yatırılmadı`** butonuna basarak dersi **`🟢 Ödendi`** yapabilirsiniz.

### 4️⃣ Aylık Kaç Ders Yapıldığının Tablolanması (📈 Aylık Ders Sayıları Tablosu)
- Ağustos'tan Haziran'a kadar her ay hangi öğrenciyle kaç ders yapıldığı (ve ay toplamları) matris halinde sunulur.
- İster `📚 Ders Sayıları`, ister `💰 Gelirler (₺)` modunda incelenebilir.
- **`Excel İndir`** butonu ile Excel/CSV olarak bilgisayarınıza aktarılabilir.

### 5️⃣ Geçmiş Derslerin Fiyat ve Tarih Bilgilerini Değiştirme (✏️ Ders Düzenleme & Silme)
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

### 6️⃣ Google Drive'a Yükleme ve Bulut Yedekleme (☁️)
Çalışmanızı güvenle Google Drive'a yüklemek ve telefonunuzla senkronize etmek için:
- **1 Tıkla Yedekleme & Drive Açma:**
  - Klasördeki **[`GoogleDrive_Yedekle.bat`](file:///c:/Users/gurak/Desktop/%C3%A7al%C4%B1%C5%9Fma/GoogleDrive_Yedekle.bat)** dosyasına çift tıklayın.
  - Program tüm dosyalarınızı tek bir sıkıştırılmış **[`DersTakip_GoogleDrive_Yedek.zip`](file:///c:/Users/gurak/Desktop/%C3%A7al%C4%B1%C5%9Fma/DersTakip_GoogleDrive_Yedek.zip)** paketine dönüştürür ve Google Drive'ınızı otomatik olarak tarayıcınızda açar.
  - Açılan sayfaya bu ZIP dosyasını veya çalışma klasörünüzü sürükleyip bırakmanız yeterlidir!
- **Uygulama İçinden JSON Bulut Yedeği:**
  - Programdaki **`💾 Yedekle`** butonuna bastığınızda **"Google Drive İçin Yedek İndir (.json)"** butonuna tıklayarak verilerinizi doğrudan Drive'ınıza kaydedebilir veya istediğiniz cihazda **"Yedekten Geri Yükle"** ile geri alabilirsiniz.

---

### 7️⃣ Telefon Uygulaması Olarak Kullanma (📱 iPhone & Android PWA)
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

