# Oyun Kütüphanesi

Oyunları, oynama durumlarını ve kişisel puanları tek yerde takip etmek için
geliştirilen yerel bir macOS masaüstü uygulaması.

İlk sürüm macOS 26 ve sonrası için SwiftUI ve SwiftData ile geliştirilecektir.
Ürün ve davranış seçimleri [ilk sürüm kararlarında](docs/ilk-surum-kararlari.md)
ayrıntılı olarak kayıtlıdır.

Oyun ekleme akışı, ücretsiz RAWG API'sinde arama yapıp seçilen oyunu
içe aktarmaktır. Katalogda bulunamayan oyunlar ve bağlantı sorunları için
**Elle ekle** her zaman kullanılabilir. Kaydedilmiş oyunlar çevrimdışı çalışır.
RAWG'nin ücretsiz kişisel kullanım planı API anahtarı, istek kotası ve kaynak
bağlantısı gerektirir. [Erişim ve yedek yol kuralları](docs/ilk-surum-kararlari.md#ücretsiz-katalog-ve-erişim)
ilk sürüm kararlarında açıklanmıştır.

## Geliştirme ortamı

Xcode 27 veya sonrası ve macOS 26 SDK'sı gerekir. Projeyi Xcode ile açmak için
`Game library/Game library.xcodeproj` dosyasını açın; **Game library** şemasını
ve **My Mac** hedefini seçip çalıştırın.

Komut satırından derleme:

```sh
xcodebuild -project "Game library/Game library.xcodeproj" -scheme "Game library" -destination 'platform=macOS' build
```

Odaklı otomatik kontrolleri çalıştırmak için:

```sh
xcodebuild -project "Game library/Game library.xcodeproj" -scheme "Game library" -destination 'platform=macOS' '-only-testing:Game libraryTests' test
```

Tüm testleri, native arayüz kontrolleriyle birlikte çalıştırmak için aynı
komuttan `-only-testing` seçeneğini kaldırın. Arayüz testleri açık bir macOS
oturumu gerektirir.

Eski SwiftData şemasından veri geçişini ve Keychain'in süreçler arası
kalıcılığını ayrı ayrı doğrulamak için:

```sh
python3 docs/checks/verify-legacy-migration.py
python3 docs/checks/verify-keychain-relaunch.py
```

Kontroller gerçek koleksiyona veya RAWG anahtarına dokunmaz: bellek/geçici
SwiftData depoları, yerel katalog yanıtları ve ayrı bir Keychain hizmetindeki
sentetik anahtar kullanılır. Keychain kontrolü sonunda test anahtarını siler.
Arayüzde yeniden açılış testi UUID ile ayrılmış geçici bir disk deposu kullanır.

## Windows

`windows/` ayrı bir Electron uygulamasıdır. Mac koleksiyon dosyasını açmaz.
Oyunlar `Documents/Oyun Kütüphanesi/library.json` dosyasına yazılır. RAWG
anahtarı bu dosyada durmaz.

Node.js 24 gerekir.

```sh
cd windows
npm install
npm test
npm start
```

`npm test` kütüphane kurallarını çalıştırır. `npm start` pencereyi açar.

## macOS önizleme paketi

```sh
python3 scripts/package-macos.py
```

Release DMG/ZIP ve bütünlük manifesti `dist/preview-<UTC zamanı>/` altında
üretilir. Paket macOS 26+ için arm64/x86_64 içerir; ad-hoc imzalıdır, notarize
edilmiş genel dağıtım değildir. [Kurulum ve paketleme](docs/kurulum-macos.md)
ile [1.0 önizleme sürüm notlarını](docs/surum-notlari-1.0-onizleme.md) okuyun.
6. aşama ve kurulu Release kabulü tamamlanmadan ilk sürüm bitmiş sayılmaz.

## İsteğe bağlı derleme anahtarı

Özel bir derlemede RAWG aramasının ilk açılışta hazır olması için
`Game library/Config/Secrets.example.xcconfig` dosyasını aynı dizine
`Secrets.xcconfig` adıyla kopyalayın ve `RAWG_API_KEY` değerini yerel dosyada
girin. Bu dosya git tarafından yok sayılır. Ardından uygulamayı yeniden derleyin.
Dosya olmadan proje derlenir ve kullanıcı anahtarını uygulamadan kaydedebilir.

Anahtar derlenen uygulamanın `Info.plist` dosyasındaki `RAWGAPIKey` alanında
okunabilir; paketi alan kişiler anahtara erişebilir. Aynı anahtarı kullananlar
aynı RAWG kotasını paylaşır. Ayrıntılar: [kurulum](docs/kurulum-macos.md).

## Oyun ekleme adımları

1. Araç çubuğundan **Oyun Ekle**'yi açın. Derleme anahtarı varsa katalog araması
   hazırdır. Yoksa kendi RAWG anahtarınızı ayarlardan bir kez kaydedin.
   Kaydettiğiniz anahtar Keychain'de durur ve derleme anahtarının önüne geçer.
2. Oyun adını yazıp **Ara**'yı seçin. Arama sonuçları henüz yerel kayıt değildir.
3. Doğru sonucu seçip **Ekle** ile onaylayın. Sonraki sayfa yalnızca kullanıcı
   istediğinde yüklenir.
4. Katalog kullanılamıyorsa **Elle ekle** bölümündeki adı doğrulayıp kaydedin.
   Bu yol anahtar ve internet gerektirmez.

Aynı RAWG kimliği mevcut kaydı açar. Aynı adlı farklı bir oyun için ayrı kayıt
onayı gerekir. Yerel kayıt başarısızsa form açık kalır ve yeniden denenebilir.

## Otomatik katalog aktarımı

**Oyun Ekle** panelinde RAWG anahtarı hazır olmalıdır. Derleme anahtarı yoksa
kendi anahtarınızı ayarlayın. Panelin altındaki
**Kataloğu Aktar** düğmesiyle sayfa sayfa aktarımı başlatın. Bu komut her oyun
için ayrı onay istemez. Aynı adlı elle kayıtlar ayrı kalır; aynı RAWG kimliği
çoğaltılmaz ve mevcut ad/durum/puan değiştirilmez. Yeni oyunlar durumsuz ve
puansız olarak **Tüm Oyunlar**'a eklenir. Topluluk puanı aktarılmaz.

Her çalıştırma en fazla 100 sayfa (sayfa başına 20 kayıt) ister ve sayfalar
arasında bir saniye bekler. Bu sınır hesabınızın kalan aylık kotasını bildiği
anlamına gelmez. Anahtar, kota, ağ veya kayıt hatasında otomatik tekrar yoktur.
**Aktarımı Durdur** veya paneli gizleme işlemi devam eden aktarımı iptal eder.
**Aktarımı Sürdür**, uygulamayı yeniden açtıktan sonra da son kaydedilen
sayfanın ardından devam eder. Yarım kalan sayfa tekrar istenir. Bitmiş bir
taramayı **Baştan Tara** ile tekrarlamak mevcut kayıtları silmez.

Elle ekleme aktarım sırasında da kullanılabilir. Kullanıcının kaydettiği anahtar
Keychain'de, isteğe bağlı derleme anahtarı uygulamanın `Info.plist` dosyasında,
sayfa ilerlemesi ise oyunlarla aynı SwiftData deposunda tutulur. RAWG'nin
zorunlu HTTPS `key` parametresi dışında kişisel koleksiyon bilgisi gönderilmez.
Katalog zamanla değiştiğinden sayfa numarası bir katalog anlık görüntüsü
garantisi değildir. [6. aşama doğrulama kaydı](docs/asama-6-dogrulama.md)
testleri, şema değişikliğini ve kabul sınırlarını açıklar.

## Proje belgeleri

- [Yol haritası](ROADMAP.md) ilk sürüme kadar izlenecek aşamaları ve
  tamamlanma ölçütlerini içerir.
- [Proje planı](docs/proje-plani.md) kapsamı, kullanım kurallarını, geliştirme
  adımlarını ve kabul ölçütlerini içerir.
- [Görsel anlatım](docs/oyun-kutuphanesi-gorsel.html) API'den içe aktarmayı,
  elle ekleme yedek yolunu, dört sekmeyi ve oyun kartlarını açıklar. HTML dosyasını indirip
  tarayıcıda açın. GitHub dosya sayfası HTML'yi uygulama gibi çalıştırmaz.

![API'den oyun içe aktarma ve elle ekleme yedek yolu](docs/assets/oyun-kutuphanesi-onizleme.png)

## Raf filtreleri

| Sekme | Gösterdiği oyunlar |
| --- | --- |
| Tüm Oyunlar | Uygulamaya eklenen bütün oyunlar |
| Kütüphanem | Kütüphane olarak işaretlenen, sahip olunan oyunlar |
| Wishlist | İstek listesine eklenen oyunlar |
| Oynanacak | Daha sonra oynanması planlanan oyunlar |
| Favoriler | Yıldızla işaretlenen oyunlar |

Bir oyun, ilgili olduğu birden fazla sekmede görünebilir. Favori işareti durumları değiştirmez.
Sol raydaki **Oyun ara…** alanı oyun adlarını mevcut filtrelerle birlikte süzer.
**Command–F** aramaya odaklanır; temizleme düğmesi aramayı sıfırlar.
**Liste** ve **Pencere** aynı süzülmüş oyunları gösterir; ayrıntı paneli açık kalır.
Sol raydaki platform menüsü rafı süzer. Ayrıntıdaki Steam, Epic Games, GOG, PC, PlayStation, Xbox, Nintendo Switch, Android veya iOS seçimi
oyunla birlikte sabit kimlikle saklanır; RAWG katalog platformlarından bağımsızdır.
Önceki derlemenin kaydettiği platform adları da okunur.
İlk açılış ve Ayarlar akışı bu değişikliğin kapsamı dışındadır.
**Oynandı**, **Bitti** ve **Puan** oyun kartındaki bilgilerdir; ayrı sekmeler değildir.

## Oyun kartları

Oyunun altında yalnızca uygulanmış durumlar ayrı kutular halinde gösterilir.
Puan verilmişse puan da görünür. Uygulanmamış durumlar için boş kutu gösterilmez.

```text
Hollow Knight
[Kütüphane] [Oynandı] [Bitti] [Puan: 9/10]

Hades II
[Wishlist] [Oynanacak]
```

Puan isteğe bağlıdır ve 1 ile 10 arasında tam sayıdır. Örnekteki puan temsilidir.

## Projenin durumu

Native macOS uygulamasında katalogdan veya elle oyun eklenebilir. **Tüm Oyunlar**,
**Kütüphanem**, **Wishlist**, **Oynanacak** ve **Favoriler** aynı oyun kayıtlarının
görünümüdür. Bir oyun açılarak beş bağımsız durum düzenlenebilir; uygulanan
durumlar ve isteğe bağlı 1–10 kişisel puan kartta görünür. **Sil**, onaydan sonra
oyunu kütüphaneden siler. Görsel anlatım bir taslaktır; çalışan uygulama değildir.

2. aşamanın doğrulama sonuçları ve sınırları
[doğrulama kaydında](docs/asama-2-dogrulama.md) bulunur.

4. aşamadaki kalıcılık, başarısız kayıt, çevrimdışı kullanım ve gizlilik
kontrollerinin kapsamı [4. aşama doğrulama kaydında](docs/asama-4-dogrulama.md)
yer alır. Başarısız düzenlemede ilgili alan eski değerine döner ve hata
gösterilir; diğer bekleyen değişiklikler silinmez. Ağ ve zaman aşımı hataları
elle eklemeyi engellemez.
