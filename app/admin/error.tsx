"use client";

export default function AdminError({ reset }: { reset: () => void }) {
  return (
    <div className="admin-auth">
      <div className="admin-auth-card">
        <p className="admin-kicker">Yönetim Paneli</p>
        <h1>Panel açılırken sorun oluştu</h1>
        <button className="admin-primary-button" type="button" onClick={() => reset()}>
          Tekrar dene
        </button>
      </div>
    </div>
  );
}
