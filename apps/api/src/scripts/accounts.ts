/**
 * Utilidades de cuentas, para correrlas en TU terminal con la base de datos de tu entorno.
 * Las contraseñas se generan al azar y se imprimen SOLO en la consola; no se guardan en texto plano.
 *
 *   npm run accounts -w apps/api -- reset-superadmin
 *   npm run accounts -w apps/api -- create-test-accounts
 *
 * La conexión sale de MONGODB_URI (igual que el API). No pegues esa URL en ningún chat.
 */
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { config } from "../config.js";
import { Tenant, User } from "../models/index.js";
import { registerTenant } from "../services/tenantService.js";

const newPassword = () => randomBytes(12).toString("base64url");

async function resetSuperadmin() {
  const sa = await User.findOne({ email: config.superadminEmail, role: "superadmin" });
  if (!sa) throw new Error(`No existe superadmin con el correo ${config.superadminEmail}`);
  const password = newPassword();
  sa.passwordHash = await bcrypt.hash(password, 10);
  sa.active = true;
  await sa.save();
  console.log("\nContraseña nueva del superadmin (se muestra una sola vez):");
  console.log(`  correo:      ${config.superadminEmail}`);
  console.log(`  contraseña:  ${password}\n`);
}

async function createTestAccounts() {
  const stamp = Date.now().toString(36);
  const email = `dueno.prueba.${stamp}@motatto.test`;
  const ownerPassword = newPassword();
  const { tenant } = await registerTenant({
    tenantName: `Taller Prueba ${stamp}`,
    type: "motos",
    ownerName: "Dueño Prueba",
    email,
    password: ownerPassword,
    city: "Bogotá",
    phone: "3000000000",
  });
  const staffRoles = ["admin", "mecanico", "cajero", "contador"] as const;
  const rows: Array<{ rol: string; correo: string; contraseña: string }> = [{ rol: "dueno", correo: email, contraseña: ownerPassword }];
  for (const role of staffRoles) {
    const correo = `${role}.prueba.${stamp}@motatto.test`;
    const contraseña = newPassword();
    await User.create({
      tenantId: tenant._id,
      name: `Prueba ${role}`,
      email: correo,
      role,
      active: true,
      passwordHash: await bcrypt.hash(contraseña, 10),
    });
    rows.push({ rol: role, correo, contraseña });
  }
  console.log(`\nCuentas de prueba del taller "${tenant.name}" (slug ${tenant.slug}). Se muestran una sola vez:`);
  console.table(rows);
}

async function main() {
  const cmd = process.argv[2];
  if (cmd !== "reset-superadmin" && cmd !== "create-test-accounts") {
    console.log("Uso: reset-superadmin | create-test-accounts");
    process.exitCode = 1;
    return;
  }
  await mongoose.connect(config.mongoUri);
  try {
    if (cmd === "reset-superadmin") await resetSuperadmin();
    else await createTestAccounts();
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
