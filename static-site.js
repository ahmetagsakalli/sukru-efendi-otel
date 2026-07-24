(() => {
  const toggle = document.querySelector(".mobile-menu-toggle");
  const nav = document.querySelector("#mobile-navigation");

  if (toggle && nav) {
    const setOpen = (open) => {
      toggle.classList.toggle("is-open", open);
      nav.classList.toggle("is-open", open);
      nav.hidden = !open;
      document.body.classList.toggle("menu-open", open);
      toggle.setAttribute("aria-expanded", String(open));
    };

    toggle.addEventListener("click", () => setOpen(!nav.classList.contains("is-open")));
    nav.addEventListener("click", (event) => {
      if (event.target.closest("a")) {
        setOpen(false);
      }
    });
  }

  const rotator = document.querySelector(".hero-service-rotator");
  const rotatorText = document.querySelector(".hero-service-rotator__text");

  if (rotator && rotatorText) {
    const label = rotator.getAttribute("aria-label") || "";
    const items = label.includes(":")
      ? label.split(":").slice(1).join(":").split(",").map((item) => item.trim()).filter(Boolean)
      : [];

    if (items.length > 1) {
      let index = 0;
      rotatorText.textContent = items[index];
      window.setInterval(() => {
        index = (index + 1) % items.length;
        rotatorText.textContent = items[index];
      }, 2400);
    }
  }
})();
