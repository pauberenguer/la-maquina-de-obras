"use server";
// Las mutaciones del chasis del panel: la campana y el reloj de la demo.
// Como toda Server Action del panel, empiezan comprobando la sesión.
import { revalidatePath } from "next/cache";
import { marcarAvisosLeidos } from "@/lib/avisos";
import { moverReloj, UN_DIA } from "@/lib/reloj";
import { exigirSesion } from "@/lib/sesion";
import { tick } from "@/lib/tick";

export async function marcarLeidos() {
  await exigirSesion();
  await marcarAvisosLeidos();
  revalidatePath("/", "layout");
}

/** «⏩ +1 día», «⏩ +3 días» y «Reiniciar reloj». Mover el reloj dispara el tick. */
export async function adelantarReloj(dias: number) {
  await exigirSesion();
  await moverReloj(dias === 0 ? 0 : dias * UN_DIA);
  await tick();
  revalidatePath("/", "layout");
}
