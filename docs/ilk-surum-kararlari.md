# İlk sürüm kararları

Bu belge, Oyun Kütüphanesi'nin ilk masaüstü sürümü için verilmiş ürün ve
teknik kararların kaynağıdır. Bu kararlar yalnızca ilk sürümün kapsamını
belirler; ileride başka platformların veya çevrimiçi özelliklerin eklenmesini
engellemez.

| Konu | Karar |
| --- | --- |
| Hedef işletim sistemi | macOS 26 ve sonraki sürümler. İlk sürüm yalnızca macOS için dağıtılacak. |
| Masaüstü teknolojisi | Swift 6, SwiftUI ve SwiftData; geliştirme ve paketleme için Xcode 27. |
| Oyun ekleme | Öncelikli yol, ücretsiz RAWG API'sinde oyun arayıp seçilen sonucu içe aktarmaktır. Kullanıcının başlattığı otomatik katalog aktarımı da ilk sürüme dahildir. Elle ad girişi her zaman yedek yol olarak kullanılabilir. |
| Veri saklama | SwiftData'nın uygulamaya ait yerel, kalıcı deposu kullanılır. Kayıtlar uygulama yeniden açıldığında korunur; bulut eşitlemesi yapılmaz. |
| Puan ölçeği | Puan isteğe bağlıdır; 1–10 arasında tam sayıdır. Kullanıcı puanı değiştirebilir veya kaldırabilir. |
| Durum kuralları | Kütüphane, Wishlist, Oynanacak, Oynandı ve Bitti birbirinden bağımsızdır. Bir durumun seçilmesi veya kaldırılması başka bir durumu otomatik değiştirmez. |

## İlk sürüm kapsamı

- Açılışta **Tüm Oyunlar** sekmesi seçilir.
- **Oyun ekle** akışı katalog aramasıyla açılır. **Elle ekle** seçeneği her zaman görünür ve internet gerektirmez.
- Boş ya da yalnızca boşluklardan oluşan oyun adı kaydedilmez.
- Yalnızca uygulanmış durumlar ve verilmiş puan kartta gösterilir.
- Raf görünümleri Tüm Oyunlar, Kütüphanem, Wishlist, Oynanacak ve Favoriler’dir. Favoriler bağımsız işaretle süzülür; beş oyun durumunu değiştirmez.
  Bunlar aynı oyun kayıtlarını filtreler; Oynandı, Bitti ve Puan ayrı sekme
  değildir.
- Kaydetme hatası kullanıcıya açıkça bildirilir; işlem başarılı gibi
  gösterilmez.
- Sekmeler ve düzenleme kontrolleri klavyeyle kullanılabilir ve görünür odağa
  sahiptir.

## Ücretsiz katalog ve erişim

İlk sürümün kişisel, ticari olmayan kullanımı için RAWG'nin ücretsiz planı
seçilmiştir. 21 Eylül 2026 tarihinde kontrol edilen [RAWG API sayfası](https://rawg.io/apidocs)
ayda en fazla 20.000 istek, her istekte API anahtarı ve verinin gösterildiği
sayfalarda RAWG'ye etkin bağlantı gerektirir. Ücretsiz erişim sınırsız kullanım
anlamına gelmez. Aynı sayfanın ticari kullanım açıklamaları birbiriyle tam
örtüşmediği için ticari dağıtım öncesinde koşullar yeniden doğrulanmalıdır.

Kullanıcı kendi RAWG API anahtarını ayarlardan kaydedebilir. Kayıtlı anahtar
macOS Keychain'de durur ve derleme anahtarının önüne geçer. İsteğe bağlı derleme
anahtarı `Game library/Config/Secrets.xcconfig` dosyasından gelir. Bu dosya git'e
girmez. Dosya varken yapılan derleme, anahtarı uygulama paketinin `Info.plist`
alanına `RAWGAPIKey` olarak yazar. Dosya yokken yapılan derleme anahtar içermez.
Anahtar SwiftData oyun kaydına veya günlük kayıtlarına yazılmaz. İstek
adreslerindeki `key` parametresi de günlüklerden çıkarılır. Anahtar yoksa
katalog kurulumu açıklanır ve **Elle ekle** kullanılabilir.
Bu seçim uygulama sunucusu gerektirmez. Uygulama hesabı açılmaz; API anahtarı
almak için RAWG kaydı gerekir.

Arama için [RAWG API başvurusundaki](https://api.rawg.io/docs/) `GET /api/games`
uç noktası kullanılır. `search`, `page`, `page_size` ve `key` parametreleri
gönderilir. Kullanıcı **Ara** komutunu verdiğinde istek yapılır; her tuşta veya
arka planda bütün katalog için istek yapılmaz. Sonuçlar sayfa başına 20 oyunla
gösterilir. Sonraki sayfa yalnızca kullanıcı istediğinde yüklenir.

Otomatik katalog ayrı bir kullanıcı komutudur. Aynı `GET /api/games` uç noktası
sayfa sayfa çağrılır ve sonuçlar tek tek onay olmadan yerel kayda geçer.
Ücretsiz plan kotası, `429`, ağ veya anahtar hatasında aktarım durur; kullanıcı
kaldığı sayfadan sürdürebilir. Arka planda kendiliğinden indirme veya metadata
yenileme yapılmaz. Aşama ve tamamlanma ölçütü
[yol haritasının 6. aşamasında](../ROADMAP.md#6-otomatik-katalog-içe-aktarma)
tanımlanmıştır.

6. aşama uygulaması her çalıştırmayı 100 sayfa ile sınırlar; sayfalar arasında
bir saniye bekler. Kalan hesap kotası bilinmez. Hata, kullanıcı durdurması veya
paneli gizleme sonrasında otomatik yeniden başlatma olmaz. Sayfa işaretçisi
oyunlarla aynı işlemde saklanır; uygulama yeniden açıldıktan sonra **Sürdür**
komutu gerekir. **Baştan Tara** kayıt silmez. Katalog sayfalarının zamanla
değişebilmesi nedeniyle bu işaretçi sabit bir katalog görüntüsü değildir.
Toplu komut, aynı adlı ayrı katalog kayıtlarının eklenmesine onaydır; elle
kayıtlar birleştirilmez ve tek oyun eklemedeki ad onayı değişmez.

## İçe aktarma ve elle ekleme sözleşmesi

1. Kullanıcı oyun adını arar. Sonuçlarda ad, varsa çıkış tarihi ve platformlar
   aynı adlı oyunları ayırt etmeye yardımcı olur. Arama sonucu henüz yerel kayıt değildir.
2. Kullanıcı bir sonucu seçip **Ekle** ile onaylar. Uygulama yalnızca bu oyunu
   SwiftData'ya kaydeder; kayıt başarılı olunca oyun **Tüm Oyunlar**'da görünür.
3. Yeni oyunun durumları seçili değildir ve kişisel puanı boştur. API'nin
   topluluk puanı, sahiplik veya oynama bilgisi kişisel alanları doldurmaz.
4. Sonuç bulunamazsa, internet yoksa, istek zaman aşımına uğrarsa veya API hata
   verirse neden açıklanır. **Tekrar dene** ve aranan adı koruyan **Elle ekle**
   sunulur. Elle ekleye geçmek otomatik kayıt oluşturmaz.
5. Elle eklemede yalnızca oyun adı zorunludur. Adın başındaki ve sonundaki
   boşluklar temizlenir; boş ad kaydedilmez. Kullanıcı **Ekle** ile onaylar.

Kaynak alanları aynı yerel oyun kaydında tutulur. Bu tablo hedef veri modelini
tanımlar; mevcut uygulamada uygulanmış olduğu anlamına gelmez.

| Alan | API'den eklenen oyun | Elle eklenen oyun |
| --- | --- | --- |
| Yerel kimlik | Uygulamanın ürettiği sabit kimlik | Aynı yerel kimlik kuralı |
| Oyun adı | API'nin boş olmayan `name` değeri | Doğrulanmış kullanıcı girişi |
| Kaynak ve dış kimlik | `rawg` ve `id` | `manual` ve boş dış kimlik |
| Kaynak bağlantısı | RAWG oyun sayfası bağlantısı | Boş |
| Çıkış tarihi ve platformlar | Varsa saklanır, eksikse ekleme engellenmez | Boş bırakılabilir |
| Durumlar ve kişisel puan | Kullanıcı tarafından yerel olarak yönetilir | Aynı davranış |

Aynı `rawg` ve `id` çifti yeniden eklenirse yeni kayıt oluşturulmaz; mevcut
oyun açılır, durumları ve puanı korunur. Aynı ad farklı oyunlara ait olabilir.
Ad benzerliği mevcut veya elle eklenmiş kayda otomatik bağlama yapmaz. Aynı ad
varsa kullanıcıya gösterilir; kullanıcı mevcut kaydı açar veya ayrı oyun
olduğunu onaylar. Elle eklenen bir oyunu sonradan RAWG kaydına dönüştürme ilk
sürümde yoktur.

İçe aktarılan ad boşsa veya dış kimlik geçersizse kayıt oluşturulmaz ve elle
ekleme sunulur. İçe aktarılan oyunun `background_image` adresi `https://media.rawg.io` ise rafta ve ayrıntıda gösterilir. Elle eklenen oyunda kapak yoktur. Katalog sayfaları için kapaklar önceden indirilmez.
API'den gelen metin düz metin olarak gösterilir; kaynak bağlantıları yalnızca
HTTPS RAWG adresleri olarak doğrulanır. Verinin kullanıldığı arama ve kayıt
görünümlerinde görünür, tıklanabilir RAWG kaynak bağlantısı bulunur.

Katalog yalnızca arama ve içe aktarma sırasında internet kullanır. Kaydedilmiş
oyunları açma, durum ve puan düzenleme, yeniden açılış ve elle ekleme çevrimdışı
çalışır. Arama metni RAWG'ye gönderilir; yerel koleksiyon, durumlar ve kişisel
puanlar gönderilmez. Otomatik eşitleme veya arka planda metadata yenileme yoktur.

`401` ve `403` yanıtları anahtar veya erişim sorunu olarak açıklanır. `429`
yanıtında otomatik istek döngüsü başlatılmaz; kullanıcıya beklemesi veya elle
eklemesi söylenir. Ağ ve sunucu hatalarında mevcut kayıtlar korunur. Yerel
kayıt hatası içe aktarma başarısı gibi gösterilmez; kullanıcı aynı seçimi
yeniden deneyebilir. API erişiminin uygulamada uçtan uca doğrulanması yol
haritasında açık iştir.

## Kapsam dışı

macOS uygulaması Windows veya Linux hedeflemez. `windows/` klasöründeki ayrı
uygulama aynı kütüphane kurallarını Windows'ta çalıştırır ve Mac SwiftData
dosyasını açmaz. Linux, Steam/Epic hesap bağlantısı, bulut eşitlemesi,
kullanıcı hesabı, arkadaş sistemi, herkese açık profil ve oyunu uygulamadan
başlatma ilk sürüm kapsamı dışındadır.
