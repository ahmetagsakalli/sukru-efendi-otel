import { unstable_noStore as noStore } from "next/cache";
import type { Dirent } from "node:fs";
import { existsSync } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import {
  galleryItems as defaultGalleryItems,
  roomFeatures as defaultRoomFeatures,
  rooms as defaultRooms,
  services as defaultServices,
  site as defaultSite
} from "@/data/site";
import { AdminImage, SiteContent, siteContentSchema } from "@/lib/site-content-schema";
import { isBlobStorageEnabled, listBlobImages, readBlobText, writeBlobText } from "@/lib/storage";

const contentDirectory = process.env.SITE_CONTENT_DIR
  ? path.resolve(process.env.SITE_CONTENT_DIR)
  : path.join(process.cwd(), "content");

const contentFilePath = process.env.SITE_CONTENT_FILE
  ? path.resolve(process.env.SITE_CONTENT_FILE)
  : path.join(contentDirectory, "site-content.json");

const backupDirectory = path.join(contentDirectory, "backups");
const contentBlobPath = process.env.SITE_CONTENT_BLOB_PATH ?? "content/site-content.json";
const backupBlobDirectory = process.env.SITE_CONTENT_BACKUP_BLOB_DIR ?? "content/backups";

function resolvePublicDirectory() {
  if (process.env.SITE_PUBLIC_DIR) {
    return path.resolve(process.env.SITE_PUBLIC_DIR);
  }

  const cwdPublicDirectory = path.join(process.cwd(), "public");
  const standalonePublicDirectory = path.join(process.cwd(), ".next", "standalone", "public");

  if (process.env.NODE_ENV === "production" && existsSync(standalonePublicDirectory)) {
    return standalonePublicDirectory;
  }

  return cwdPublicDirectory;
}

export function getPublicDirectory() {
  return resolvePublicDirectory();
}

export const defaultSiteContent: SiteContent = siteContentSchema.parse({
  site: defaultSite,
  pages: {
    home: {
      heroTitle: "ŞEHRİN KALBİNDE",
      heroEmphasis: "LÜKS KONAKLAMA",
      heroLead: "400 yıllık tarihi bir yapıda, şehrin merkezinde sakin ve özenli bir otel deneyimi.",
      heroImage: "/hotel-images/hero-facade-night.webp",
      historyTitle: "Yeni bir bina hissi değil, korunmuş bir zaman duygusu.",
      historyText:
        "Şükrü Efendi Ottoman Hotel'in karakteri, içinde bulunduğu tarihi yapının sakin tavrından gelir. Konaklama, şehir merkezine yakın ama kendi içinde dingin bir alanda gerçekleşir.",
      historyImage: "/hotel-images/facade-night-wide.webp"
    },
    rooms: {
      title: "Şehrin merkezinde, ihtiyaca göre seçilen odalar.",
      body:
        "Her oda yalın bir konfor anlayışıyla hazırlandı. Kısa konaklama, iş seyahati veya aile ziyareti için farklı kullanım biçimleri düşünülür."
    },
    gallery: {
      title: "Otelin dokusunu taşıyan kareler.",
      body:
        "Dış cepheden resepsiyona, oda detaylarından ortak alanlara kadar otelin atmosferini gösteren seçilmiş fotoğraflar."
    },
    contact: {
      title: "Rezervasyon ve bilgi için otelle doğrudan görüşün.",
      body:
        "Tarih, kişi sayısı ve oda tercihinizi ileterek uygun seçenekleri hızlıca öğrenebilirsiniz.",
      contactTitle: "Doğrudan iletişim",
      locationTitle: "Ordu şehir merkezi"
    },
    history: {
      title: "Yeni bir bina hissi değil, korunmuş bir zaman duygusu.",
      body:
        "Otelin karakteri, içinde bulunduğu tarihi yapının ölçülü ve sakin tavrından gelir. Amaç, yapının geçmişini dekor gibi göstermek değil; konaklamanın doğal bir parçası haline getirmektir.",
      image: "/hotel-images/facade-night-wide.webp",
      timeline: [
        "Yapının belleği korunur; yeni eklenen her detay bu ölçüye göre düşünülür.",
        "Şehir içindeki konum, yürüyerek ulaşılabilen bir konaklama düzeni sağlar.",
        "Güncel konfor, tarihi yapının ritmini bozmadan odalara ve ortak alanlara taşınır."
      ]
    }
  },
  services: defaultServices,
  roomFeatures: defaultRoomFeatures,
  rooms: defaultRooms,
  galleryItems: defaultGalleryItems
});

export function getContentFilePath() {
  return contentFilePath;
}

async function ensureContentDirectories() {
  await fs.mkdir(contentDirectory, { recursive: true });
  await fs.mkdir(backupDirectory, { recursive: true });
}

async function readContentFile(): Promise<SiteContent | null> {
  if (isBlobStorageEnabled()) {
    const blobJson = await readBlobText(contentBlobPath);

    if (blobJson) {
      return siteContentSchema.parse(JSON.parse(blobJson));
    }
  }

  try {
    const json = await fs.readFile(contentFilePath, "utf8");
    return siteContentSchema.parse(JSON.parse(json));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }

    throw error;
  }
}

export async function getSiteContent(): Promise<SiteContent> {
  noStore();
  const content = await readContentFile();
  return content ?? defaultSiteContent;
}

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

export async function saveSiteContent(rawContent: unknown): Promise<SiteContent> {
  const parsed = siteContentSchema.parse({
    ...(rawContent as Record<string, unknown>),
    updatedAt: new Date().toISOString()
  });

  const previous = (await readContentFile()) ?? defaultSiteContent;

  if (isBlobStorageEnabled()) {
    await writeBlobText(
      `${backupBlobDirectory}/site-content-${timestamp()}.json`,
      `${JSON.stringify(previous, null, 2)}\n`
    );
    await writeBlobText(contentBlobPath, `${JSON.stringify(parsed, null, 2)}\n`);
    return parsed;
  }

  await ensureContentDirectories();

  await fs.writeFile(
    path.join(backupDirectory, `site-content-${timestamp()}.json`),
    `${JSON.stringify(previous, null, 2)}\n`,
    "utf8"
  );

  const temporaryPath = `${contentFilePath}.tmp-${process.pid}-${Date.now()}`;
  await fs.writeFile(temporaryPath, `${JSON.stringify(parsed, null, 2)}\n`, "utf8");
  await fs.rename(temporaryPath, contentFilePath);

  return parsed;
}

async function walkImages(directory: string, basePublicPath = ""): Promise<AdminImage[]> {
  let entries: Dirent<string>[];

  try {
    entries = await fs.readdir(directory, { withFileTypes: true, encoding: "utf8" });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }

    throw error;
  }

  const images = await Promise.all(
    entries.map(async (entry) => {
      const absolutePath = path.join(directory, entry.name);
      const publicPath = `${basePublicPath}/${entry.name}`;

      if (entry.isDirectory()) {
        return walkImages(absolutePath, publicPath);
      }

      if (!entry.isFile() || !entry.name.toLowerCase().endsWith(".webp")) {
        return [];
      }

      const stat = await fs.stat(absolutePath);
      return [
        {
          src: publicPath,
          name: entry.name,
          size: stat.size,
          updatedAt: stat.mtime.toISOString()
        }
      ];
    })
  );

  return images.flat().sort((a, b) => a.src.localeCompare(b.src));
}

export async function listPublicImages(): Promise<AdminImage[]> {
  noStore();
  const [localImages, blobImages] = await Promise.all([walkImages(getPublicDirectory()), listBlobImages()]);
  const bySource = new Map<string, AdminImage>();

  [...localImages, ...blobImages].forEach((image) => {
    bySource.set(image.src, image);
  });

  return [...bySource.values()].sort((a, b) => a.src.localeCompare(b.src));
}
