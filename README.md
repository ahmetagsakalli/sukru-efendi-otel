# Şükrü Efendi Ottoman Hotel

Next.js App Router projesi. Site Vercel'de yayındaki Şükrü Efendi Ottoman Hotel tasarımından kaynak proje olarak yeniden kuruldu.

## Komutlar

```bash
npm install
npm run dev
```

Geliştirme adresi: `http://localhost:3000`

## Production

```bash
npm install
npm run build
npm start
```

VPS'de PM2 ile çalıştırmak için:

```bash
pm2 start npm --name sukru-efendi-otel -- start
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
