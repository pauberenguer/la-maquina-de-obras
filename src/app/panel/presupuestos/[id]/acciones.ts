"use server";
// Las acciones de la ficha del presupuesto: enviarlo al cliente, reenviarlo y
// cerrarlo a mano (Ganado o Perdido con motivo).
//
// Ninguna de ellas cambia el estado por su cuenta: todas pasan por
// cambiarEstado(), que es quien cancela la persecución cuando el presupuesto
// se cierra. Y todas empiezan comprobando la sesión, FUERA del try: la
// redirección a /entrar es una excepción y el catch no debe tragársela.
import { revalidatePath } from "next/cache";
import { cambiarEstado } from "@/lib/eventos";
import { enviarPresupuesto, reenviar } from "@/lib/envio";
import { lineasDe, presupuestoPorId } from "@/lib/consultas";
import { exigirSesion } from "@/lib/sesion";

export type ResultadoAccion =
  | { ok: true; mensaje: string; url?: string }
  | { ok: false; mensaje: string };

function refrescarElPanel() {
  // Cambiar de estado mueve el kanban, el badge del menú, HOY y LOS NÚMEROS.
  revalidatePath("/", "layout");
}

/**
 * «Enviar al cliente». Todo el trabajo lo hace enviarPresupuesto(): recalcula,
 * pasa a Enviado, fija «válido hasta», programa los tres seguimientos con sus
 * textos, deja el evento en el timeline y avisa.
 */
export async function enviarAlCliente(presupuestoId: number): Promise<ResultadoAccion> {
  await exigirSesion();
  try {
    const p = await presupuestoPorId(presupuestoId);
    if (!p) return { ok: false, mensaje: "Este presupuesto ya no existe." };
    if (p.estado !== "borrador") {
      return { ok: false, mensaje: "Este presupuesto ya está enviado." };
    }

    const lineas = await lineasDe(presupuestoId);
    if (lineas.length === 0) {
      return { ok: false, mensaje: "El presupuesto no tiene ni una línea: no se puede enviar vacío." };
    }
    const amarillas = lineas.filter((l) => l.amarilla).length;
    if (amarillas > 0) {
      return {
        ok: false,
        mensaje:
          amarillas === 1
            ? "Queda 1 línea sin precio. Ponle precio, descártala o añádela al banco antes de enviar."
            : `Quedan ${amarillas} líneas sin precio. Resuélvelas antes de enviar.`,
      };
    }

    const { url } = await enviarPresupuesto(presupuestoId);
    refrescarElPanel();
    return { ok: true, mensaje: "Presupuesto enviado. El enlace ya está vivo.", url };
  } catch (e) {
    return { ok: false, mensaje: (e as Error).message };
  }
}

/** «Reenviar»: el mismo enlace y las mismas tareas, con constancia y aviso. */
export async function reenviarAlCliente(presupuestoId: number): Promise<ResultadoAccion> {
  await exigirSesion();
  try {
    const p = await presupuestoPorId(presupuestoId);
    if (!p) return { ok: false, mensaje: "Este presupuesto ya no existe." };
    const { url } = await reenviar(presupuestoId);
    refrescarElPanel();
    return { ok: true, mensaje: `Reenviado a ${p.clienteNombre}.`, url };
  } catch (e) {
    return { ok: false, mensaje: (e as Error).message };
  }
}

/** «Marcar Ganado» a mano, cuando el cliente dice que sí por teléfono. */
export async function marcarGanado(presupuestoId: number): Promise<ResultadoAccion> {
  await exigirSesion();
  try {
    const p = await presupuestoPorId(presupuestoId);
    if (!p) return { ok: false, mensaje: "Este presupuesto ya no existe." };
    if (p.estado === "ganado") return { ok: false, mensaje: "Ya estaba en Ganado." };
    if (p.estado === "borrador") {
      return { ok: false, mensaje: "Todavía es un borrador: envíaselo al cliente primero." };
    }

    await cambiarEstado(presupuestoId, "ganado", "Manolo lo ha cerrado a mano");
    refrescarElPanel();
    return { ok: true, mensaje: "Obra ganada. Los seguimientos pendientes se han cancelado." };
  } catch (e) {
    return { ok: false, mensaje: (e as Error).message };
  }
}

/** «Marcar Perdido»: el motivo es obligatorio, porque es lo que se mide después. */
export async function marcarPerdido(
  presupuestoId: number,
  motivo: string,
): Promise<ResultadoAccion> {
  await exigirSesion();
  try {
    const texto = motivo.trim();
    if (!texto) return { ok: false, mensaje: "Dime por qué se ha perdido: sin motivo no se guarda." };

    const p = await presupuestoPorId(presupuestoId);
    if (!p) return { ok: false, mensaje: "Este presupuesto ya no existe." };
    if (p.estado === "perdido") return { ok: false, mensaje: "Ya estaba en Perdido." };
    if (p.estado === "borrador") {
      return { ok: false, mensaje: "Todavía es un borrador: bórralo o envíaselo al cliente." };
    }

    await cambiarEstado(presupuestoId, "perdido", texto, { motivoPerdido: texto });
    refrescarElPanel();
    return { ok: true, mensaje: "Marcado como perdido. Los seguimientos pendientes se han cancelado." };
  } catch (e) {
    return { ok: false, mensaje: (e as Error).message };
  }
}
