import Link from "next/link";

export function BookingForm() {
  return (
    <section className="hero-reservation" id="rezervasyon" aria-label="Rezervasyon">
      <form className="booking-form booking-form--hero">
        <label>
          <span>Giriş</span>
          <input type="date" />
        </label>
        <label>
          <span>Çıkış</span>
          <input type="date" />
        </label>
        <label>
          <span>Oda</span>
          <select defaultValue="Suit Oda">
            <option>Standart Oda</option>
            <option>Suit Oda</option>
            <option>Aile Odaları</option>
          </select>
        </label>
        <label>
          <span>Yetişkin</span>
          <select defaultValue="2">
            <option>1</option>
            <option>2</option>
            <option>3</option>
            <option>4+</option>
          </select>
        </label>
        <label>
          <span>Çocuk</span>
          <select defaultValue="0">
            <option>0</option>
            <option>1</option>
            <option>2</option>
            <option>3</option>
            <option>4+</option>
          </select>
        </label>
        <Link className="booking-link booking-link--solid booking-form__button" href="/iletisim">
          Rezervasyon Yap
        </Link>
      </form>
    </section>
  );
}
