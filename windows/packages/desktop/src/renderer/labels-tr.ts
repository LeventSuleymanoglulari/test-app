export const shelfLabels = {
  all: "Tüm Oyunlar",
  library: "Kütüphanem",
  wishlist: "Wishlist",
  "to-play": "Oynanacak",
  favorites: "Favoriler",
} as const;

export const viewModeLabels = {
  list: "Liste",
  window: "Pencere",
} as const;

export const storeLabels: Record<string, string> = {
  steam: "Steam",
  epic: "Epic Games",
  gog: "GOG",
  pc: "PC",
  playstation: "PlayStation",
  xbox: "Xbox",
  "nintendo-switch": "Nintendo Switch",
  android: "Android",
  ios: "iOS",
};

export const emptyCopy: Record<string, { title: string; body: string }> = {
  none: { title: "", body: "" },
  "search-miss": {
    title: "Sonuç bulunamadı",
    body: "Başka bir oyun adı deneyin veya aramayı ve filtreleri temizleyin.",
  },
  "platform-miss": {
    title: "Bu platformda oyun yok",
    body: "Bu platformda oyun yok. Başka bir platform seçin.",
  },
  "favorites-empty": {
    title: "Bu sekmede oyun yok",
    body: "Favori oyunları görmek için yıldız düğmesini kullanın.",
  },
  "shelf-empty": {
    title: "Henüz oyun yok",
    body: "Başlamak için Oyun Ekle'yi seçin.",
  },
};

export const statusLabels = {
  isInLibrary: "Kütüphanemde",
  isWishlisted: "Wishlist",
  isToPlay: "Oynanacak",
  isPlayed: "Oynandı",
  isCompleted: "Tamamlandı",
  isFavorite: "Favori",
} as const;

export const ui = {
  appTitle: "Oyun Kütüphanesi",
  searchPlaceholder: "Oyun ara…",
  addGame: "Oyun Ekle",
  manualTitle: "Başlık",
  addManual: "Elle ekle",
  rawgSearch: "RAWG ara",
  searchAction: "Ara",
  nextPage: "Sonraki sayfa",
  retry: "Yeniden dene",
  confirmSeparate: "Ayrı kayıt olarak ekle",
  cancel: "Vazgeç",
  bulkStart: "Toplu aktarımı başlat",
  bulkStop: "Durdur",
  bulkRestart: "Baştan başlat",
  apiKey: "RAWG API anahtarı",
  saveKey: "Anahtarı kaydet",
  delete: "Sil",
  clearRating: "Puanı temizle",
  storePlatform: "Mağaza platformu",
  allPlatforms: "Tüm platformlar",
  rating: "Puan",
  sameTitlePrompt: "Aynı başlıkta oyun var. Ayrı kayıt eklemek ister misiniz?",
} as const;
