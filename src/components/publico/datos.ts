// Lo que el servidor le pasa a la página del cliente.
//
// Regla de este fichero: aquí NO viaja nada que el cliente no deba ver. Los
// márgenes y el coste de Reformas Soler se quedan en el panel.
//
// DUEÑO: carril B2.
import type { Estado, Unidad } from "@/lib/tipos";

export type LineaPublica = {
  id: number;
  capitulo: string;
  descripcion: string;
  unidad: Unidad;
  medicion: number;
  /** Precio unitario sin IVA, en céntimos. */
  precio: number;
  total: number;
  opcional: boolean;
  elegida: boolean;
};

export type SelloDeFirma = {
  fecha: string;
  hora: string;
  ip: string | null;
  dispositivo: string | null;
  png: string;
};

export type DatosPublicos = {
  token: string;
  numero: string;
  titulo: string;
  estado: Estado;
  direccionObra: string;
  clienteNombre: string;
  empresa: {
    nombre: string;
    cif: string;
    direccion: string;
    telefono: string;
    email: string;
  };
  ivaPct: number;
  descuentoPct: number;
  condiciones: string;
  lineas: LineaPublica[];
  /** Ya formateadas con el reloj de la aplicación. */
  fechaDocumento: string;
  validoHasta: string | null;
  diasRestantes: string | null;
  caducado: boolean;
  /** Ganado, Perdido o Expirado: el cliente ya no puede tocar nada. */
  cerrado: boolean;
  /** ¿Puede aceptar y firmar todavía? */
  abierto: boolean;
  respondido: boolean;
  firma: SelloDeFirma | null;
};
