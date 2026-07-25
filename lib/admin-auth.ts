import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { cookies } from "next/headers";
import { isBlobStorageEnabled, readBlobText, writeBlobText } from "@/lib/storage";

const SESSION_COOKIE = "sukru_admin_session";
const SESSION_TTL_SECONDS = 8 * 60 * 60;
const BCRYPT_ROUNDS = 12;

type LocalAuthFile = {
  passwordHash: string;
  sessionSecret: string;
  createdAt: string;
  updatedAt?: string;
};

type AuthState =
  | { configured: false; setupAllowed: boolean }
  | { configured: true; passwordHash?: string; plainPassword?: string; sessionSecret: string };

const contentDirectory = process.env.SITE_CONTENT_DIR
  ? path.resolve(process.env.SITE_CONTENT_DIR)
  : path.join(process.cwd(), "content");

const authFilePath = path.join(contentDirectory, ".admin-auth.json");
const authBlobPath = process.env.ADMIN_AUTH_BLOB_PATH ?? "content/.admin-auth.json";

async function readLocalAuth(): Promise<LocalAuthFile | null> {
  if (isBlobStorageEnabled()) {
    const blobJson = await readBlobText(authBlobPath);

    if (blobJson) {
      const parsed = JSON.parse(blobJson) as Partial<LocalAuthFile>;

      if (!parsed.passwordHash || !parsed.sessionSecret || !parsed.createdAt) {
        return null;
      }

      return {
        passwordHash: parsed.passwordHash,
        sessionSecret: parsed.sessionSecret,
        createdAt: parsed.createdAt,
        updatedAt: parsed.updatedAt
      };
    }
  }

  try {
    const raw = await fs.readFile(authFilePath, "utf8");
    const parsed = JSON.parse(raw) as Partial<LocalAuthFile>;

    if (!parsed.passwordHash || !parsed.sessionSecret || !parsed.createdAt) {
      return null;
    }

    return {
      passwordHash: parsed.passwordHash,
      sessionSecret: parsed.sessionSecret,
      createdAt: parsed.createdAt,
      updatedAt: parsed.updatedAt
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }

    throw error;
  }
}

export async function getAdminAuthState(): Promise<AuthState> {
  const envHash = process.env.ADMIN_PASSWORD_HASH;
  const envPassword = process.env.ADMIN_PASSWORD;
  const envSessionSecret = process.env.ADMIN_SESSION_SECRET;
  const localAuth = await readLocalAuth();

  if (localAuth) {
    return {
      configured: true,
      passwordHash: localAuth.passwordHash,
      sessionSecret: localAuth.sessionSecret
    };
  }

  if (envHash) {
    if (!envSessionSecret && process.env.NODE_ENV === "production") {
      throw new Error("ADMIN_SESSION_SECRET must be set in production.");
    }

    return {
      configured: true,
      passwordHash: envHash,
      sessionSecret: envSessionSecret ?? crypto.createHash("sha256").update(envHash).digest("hex")
    };
  }

  if (envPassword) {
    if (!envSessionSecret && process.env.NODE_ENV === "production") {
      throw new Error("ADMIN_SESSION_SECRET must be set in production.");
    }

    return {
      configured: true,
      plainPassword: envPassword,
      sessionSecret:
        envSessionSecret ?? crypto.createHash("sha256").update(`admin:${envPassword}`).digest("hex")
    };
  }

  return {
    configured: false,
    setupAllowed: process.env.NODE_ENV !== "production" || process.env.ALLOW_ADMIN_SETUP === "true"
  };
}

export function validateAdminPassword(password: string) {
  const errors: string[] = [];

  if (password.length < 10) errors.push("En az 10 karakter olmalı.");
  if (!/[a-z]/.test(password)) errors.push("En az bir küçük harf içermeli.");
  if (!/\d/.test(password)) errors.push("En az bir rakam içermeli.");
  if (!/[^A-Za-z0-9]/.test(password)) errors.push("En az bir sembol içermeli.");
  if (/\s/.test(password)) errors.push("Boşluk içermemeli.");

  return errors;
}

async function writeLocalAuthFile(authFile: LocalAuthFile) {
  if (isBlobStorageEnabled()) {
    await writeBlobText(authBlobPath, `${JSON.stringify(authFile, null, 2)}\n`);
    return;
  }

  await fs.mkdir(contentDirectory, { recursive: true });

  const temporaryPath = `${authFilePath}.tmp-${process.pid}-${Date.now()}`;
  await fs.writeFile(temporaryPath, `${JSON.stringify(authFile, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600
  });
  await fs.rename(temporaryPath, authFilePath);
  await fs.chmod(authFilePath, 0o600).catch(() => undefined);
}

export async function createLocalAdminAuth(password: string) {
  const errors = validateAdminPassword(password);

  if (errors.length > 0) {
    return { ok: false as const, errors };
  }

  const state = await getAdminAuthState();

  if (state.configured) {
    return { ok: false as const, errors: ["Admin parolası zaten ayarlanmış."] };
  }

  if (!state.setupAllowed) {
    return { ok: false as const, errors: ["Production ortamında admin setup kapalı."] };
  }

  const authFile: LocalAuthFile = {
    passwordHash: await bcrypt.hash(password, BCRYPT_ROUNDS),
    sessionSecret: crypto.randomBytes(48).toString("base64url"),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  if (isBlobStorageEnabled()) {
    await writeLocalAuthFile(authFile);
    return { ok: true as const, sessionSecret: authFile.sessionSecret };
  }

  await fs.mkdir(contentDirectory, { recursive: true });
  await fs.writeFile(authFilePath, `${JSON.stringify(authFile, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
    flag: "wx"
  });

  return { ok: true as const, sessionSecret: authFile.sessionSecret };
}

export async function changeAdminPassword(currentPassword: string, newPassword: string) {
  const errors = validateAdminPassword(newPassword);

  if (errors.length > 0) {
    return { ok: false as const, status: 400 as const, errors };
  }

  const isCurrentPasswordValid = await verifyAdminPassword(currentPassword);

  if (!isCurrentPasswordValid) {
    return { ok: false as const, status: 401 as const, errors: ["Mevcut parola hatalı."] };
  }

  if (newPassword === currentPassword) {
    return { ok: false as const, status: 400 as const, errors: ["Yeni parola mevcut paroladan farklı olmalı."] };
  }

  const existingLocalAuth = await readLocalAuth();
  const now = new Date().toISOString();
  const authFile: LocalAuthFile = {
    passwordHash: await bcrypt.hash(newPassword, BCRYPT_ROUNDS),
    sessionSecret: crypto.randomBytes(48).toString("base64url"),
    createdAt: existingLocalAuth?.createdAt ?? now,
    updatedAt: now
  };

  await writeLocalAuthFile(authFile);
  return { ok: true as const };
}

function sign(payload: string, secret: string) {
  return crypto.createHmac("sha256", secret).update(payload).digest("base64url");
}

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);

  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

export async function verifyAdminPassword(password: string) {
  const state = await getAdminAuthState();

  if (!state.configured) {
    return false;
  }

  if (state.passwordHash) {
    return bcrypt.compare(password, state.passwordHash);
  }

  if (state.plainPassword) {
    return safeEqual(password, state.plainPassword);
  }

  return false;
}

export async function setAdminSession() {
  const state = await getAdminAuthState();

  if (!state.configured) {
    throw new Error("Admin auth is not configured.");
  }

  const now = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(
    JSON.stringify({
      sub: "admin",
      iat: now,
      exp: now + SESSION_TTL_SECONDS,
      nonce: crypto.randomBytes(16).toString("base64url")
    })
  ).toString("base64url");

  cookies().set(SESSION_COOKIE, `${payload}.${sign(payload, state.sessionSecret)}`, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS
  });
}

export function clearAdminSession() {
  cookies().set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0
  });
}

export async function hasAdminSession() {
  const state = await getAdminAuthState();

  if (!state.configured) {
    return false;
  }

  const value = cookies().get(SESSION_COOKIE)?.value;

  if (!value) {
    return false;
  }

  const [payload, signature] = value.split(".");

  if (!payload || !signature || !safeEqual(signature, sign(payload, state.sessionSecret))) {
    return false;
  }

  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      sub?: string;
      exp?: number;
    };

    return session.sub === "admin" && typeof session.exp === "number" && session.exp > Date.now() / 1000;
  } catch {
    return false;
  }
}
