import { del, get, head, list, put } from "@vercel/blob";

export type StoredImage = {
  src: string;
  name: string;
  size: number;
  updatedAt: string;
};

export function isBlobStorageEnabled() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

function getBlobTokenOptions() {
  return {
    token: process.env.BLOB_READ_WRITE_TOKEN
  };
}

export async function readBlobText(pathname: string) {
  if (!isBlobStorageEnabled()) {
    return null;
  }

  const result = await get(pathname, {
    access: "private",
    useCache: false,
    ...getBlobTokenOptions()
  });

  if (!result || result.statusCode !== 200 || !result.stream) {
    return null;
  }

  return new Response(result.stream).text();
}

export async function writeBlobText(pathname: string, value: string) {
  if (!isBlobStorageEnabled()) {
    return false;
  }

  await put(pathname, value, {
    access: "private",
    allowOverwrite: true,
    contentType: "application/json",
    cacheControlMaxAge: 60,
    ...getBlobTokenOptions()
  });

  return true;
}

export async function putPublicBlob(pathname: string, body: Buffer, contentType: string) {
  if (!isBlobStorageEnabled()) {
    return null;
  }

  return put(pathname, body, {
    access: "public",
    allowOverwrite: false,
    contentType,
    cacheControlMaxAge: 31536000,
    ...getBlobTokenOptions()
  });
}

export async function readPublicBlob(pathname: string) {
  if (!isBlobStorageEnabled()) {
    return null;
  }

  const result = await get(pathname, {
    access: "public",
    useCache: true,
    ...getBlobTokenOptions()
  });

  if (!result || result.statusCode !== 200 || !result.stream) {
    return null;
  }

  const arrayBuffer = await new Response(result.stream).arrayBuffer();

  return {
    body: Buffer.from(arrayBuffer),
    contentType: result.blob.contentType,
    size: result.blob.size,
    updatedAt: result.blob.uploadedAt.toISOString()
  };
}

export async function deleteBlobPath(pathname: string) {
  if (!isBlobStorageEnabled()) {
    return false;
  }

  await del(pathname, getBlobTokenOptions());
  return true;
}

export async function getBlobMetadata(pathname: string) {
  if (!isBlobStorageEnabled()) {
    return null;
  }

  try {
    return await head(pathname, getBlobTokenOptions());
  } catch (error) {
    if ((error as Error).name === "BlobNotFoundError") {
      return null;
    }

    throw error;
  }
}

export async function listBlobImages(prefix = "uploads/"): Promise<StoredImage[]> {
  if (!isBlobStorageEnabled()) {
    return [];
  }

  const images: StoredImage[] = [];
  let cursor: string | undefined;

  do {
    const page = await list({
      prefix,
      cursor,
      limit: 1000,
      ...getBlobTokenOptions()
    });

    page.blobs.forEach((blob) => {
      if (!blob.pathname.toLowerCase().endsWith(".webp")) {
        return;
      }

      images.push({
        src: `/${blob.pathname}`,
        name: blob.pathname.split("/").pop() ?? blob.pathname,
        size: blob.size,
        updatedAt: blob.uploadedAt.toISOString()
      });
    });

    cursor = page.cursor;
  } while (cursor);

  return images.sort((a, b) => a.src.localeCompare(b.src));
}
