import bcrypt from "bcryptjs";

const password = process.argv[2] ?? process.env.ADMIN_PASSWORD;

if (!password) {
  console.error("Usage: ADMIN_PASSWORD='StrongPassword2026' pnpm hash:admin-password");
  process.exit(1);
}

if (password.length < 10 || !/[a-z]/.test(password) || !/\d/.test(password) || !/[^A-Za-z0-9]/.test(password) || /\s/.test(password)) {
  console.error("Password must be at least 10 characters and include lowercase, a number, a symbol, and no spaces.");
  process.exit(1);
}

console.log(await bcrypt.hash(password, 12));
