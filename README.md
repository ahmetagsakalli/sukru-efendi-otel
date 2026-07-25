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
ADMIN_SMOKE_SERVER=start ADMIN_SMOKE_REPEATS=1 pnpm test:admin
```

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
