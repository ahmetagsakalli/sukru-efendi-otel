"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { LockKeyhole, LogIn, ShieldCheck } from "lucide-react";

type AdminAuthScreenProps = {
  mode: "login" | "setup" | "locked";
};

export function AdminAuthScreen({ mode }: AdminAuthScreenProps) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isSetup = mode === "setup";

  if (mode === "locked") {
    return (
      <div className="admin-auth">
        <div className="admin-auth-card">
          <div className="admin-auth-icon">
            <LockKeyhole />
          </div>
          <p className="admin-kicker">Şükrü Efendi Admin</p>
          <h1>Admin yapılandırması gerekiyor</h1>
          <p className="admin-auth-note">Production ortamında parola kurulumu env ayarı olmadan kapalı.</p>
        </div>
      </div>
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    if (isSetup && password !== confirmPassword) {
      setMessage("Parolalar eşleşmiyor.");
      return;
    }

    setIsSubmitting(true);

    const response = await fetch(isSetup ? "/api/admin/setup" : "/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password })
    });
    const result = (await response.json().catch(() => ({}))) as { error?: string };

    setIsSubmitting(false);

    if (!response.ok) {
      setMessage(result.error ?? "İşlem tamamlanamadı.");
      return;
    }

    router.replace("/admin");
    router.refresh();
  }

  return (
    <div className="admin-auth">
      <form className="admin-auth-card" onSubmit={handleSubmit}>
        <div className="admin-auth-icon">{isSetup ? <ShieldCheck /> : <LockKeyhole />}</div>
        <p className="admin-kicker">Şükrü Efendi Admin</p>
        <h1>{isSetup ? "Admin parolası oluştur" : "Admin paneline giriş"}</h1>
        <label className="admin-field">
          <span>Parola</span>
          <input
            autoComplete={isSetup ? "new-password" : "current-password"}
            minLength={isSetup ? 10 : 1}
            onChange={(event) => setPassword(event.target.value)}
            required
            type="password"
            value={password}
          />
        </label>
        {isSetup ? (
          <label className="admin-field">
            <span>Parola tekrar</span>
            <input
              autoComplete="new-password"
              minLength={10}
              onChange={(event) => setConfirmPassword(event.target.value)}
              required
              type="password"
              value={confirmPassword}
            />
          </label>
        ) : null}
        {isSetup ? (
          <p className="admin-auth-note">En az 10 karakter, küçük harf, rakam ve sembol kullan.</p>
        ) : null}
        {message ? <p className="admin-alert admin-alert--error">{message}</p> : null}
        <button className="admin-primary-button" disabled={isSubmitting} type="submit">
          <LogIn size={18} />
          {isSubmitting ? "Kontrol ediliyor" : isSetup ? "Paneli başlat" : "Giriş yap"}
        </button>
      </form>
    </div>
  );
}
