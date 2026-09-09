# Şükrü Efendi Ottoman Hotel

Şükrü Efendi Ottoman Hotel için Next.js App Router tabanlı web sitesi ve yönetim paneli.

## Komutlar

```bash
pnpm install
pnpm dev
```

Geliştirme adresi: `http://localhost:3000`

## Kalite Kontrol

```bash
pnpm typecheck
pnpm build
pnpm test:admin
pnpm test:booking
pnpm test:pickers
ADMIN_SMOKE_SERVER=start ADMIN_SMOKE_REPEATS=1 pnpm test:admin
```

`test:booking` ve `test:pickers` için geliştirme sunucusu açık olmalıdır. Rezervasyon gönderimleri testlerde yakalanır; gerçek kayıt oluşturulmaz. Admin testi ayrı içerik ve kimlik doğrulama dosyalarıyla kendi sunucusunu başlatır.

## Yönetim paneli

Panel `/admin` adresindedir. Odalar, fiyatlar, kapasite, rezervasyonlar, misafirler, ödeme durumları, fotoğraflar ve sayfa içerikleri buradan yönetilir. Rezervasyon metinleri Türkçe, İngilizce ve Almanca; diğer sayfa içerikleri İngilizce ve Almanca olarak ayrıca düzenlenebilir.

Kaydedilmemiş site değişiklikleri sekmeler arasında korunur. Ton, ikon, yapının yaşı ve oda adresi gibi tasarım bilgileri içerikte korunur; panelde düzenleme alanı olarak gösterilmez.

Site ve panel aynı Playfair Display fontunu kullanır. Tarih ve seçenek panelleri cihazın yerleşik kontrolleri yerine ortak tasarımı kullanır.

## Production

```bash
pnpm install --frozen-lockfile
pnpm build
pnpm start
```

VPS'de PM2 ile çalıştırmak için:

```bash
pm2 start pnpm --name sukru-efendi-otel -- start
pm2 save
```

## Standalone Çıktı

`next.config.js` içinde `output: "standalone"` açık. Daha küçük deploy için build sonrası şu klasörler sunucuya taşınabilir:

```bash
.next/standalone
.next/static
public
```

Sonra:

```bash
node .next/standalone/server.js
```

## Sayfalar

- `/`
- `/odalar`
- `/odalar/standart-oda`
- `/odalar/suit-oda`
- `/odalar/aile-odalari`
- `/tarihce`
- `/galeri`
- `/iletisim`
