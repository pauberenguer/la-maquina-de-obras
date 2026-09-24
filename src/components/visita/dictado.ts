// El dictado del navegador, en crudo. La Web Speech API no está en los tipos
// del DOM, así que aquí se declara lo justo que usamos y nada más.
//
// Se reanuda solo: si el reconocimiento se corta por un silencio, vuelve a
// arrancar mientras el botón siga activo. Lo para de verdad únicamente Manolo.

type ResultadoReconocimiento = {
  isFinal: boolean;
  0: { transcript: string };
};

type EventoReconocimiento = {
  resultIndex: number;
  results: { length: number } & Record<number, ResultadoReconocimiento>;
};

type EventoErrorReconocimiento = { error: string };

type Reconocimiento = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((e: EventoReconocimiento) => void) | null;
  onerror: ((e: EventoErrorReconocimiento) => void) | null;
  onend: (() => void) | null;
};

type ConstructorReconocimiento = new () => Reconocimiento;

type VentanaConDictado = Window & {
  webkitSpeechRecognition?: ConstructorReconocimiento;
  SpeechRecognition?: ConstructorReconocimiento;
};

/** ¿Sabe este navegador escuchar? Safari y Chrome sí; Firefox todavía no. */
export function hayDictado(): boolean {
  if (typeof window === "undefined") return false;
  const w = window as VentanaConDictado;
  return Boolean(w.webkitSpeechRecognition ?? w.SpeechRecognition);
}

export type ManejadoresDeDictado = {
  /** Una frase terminada: se añade al texto. */
  alCerrarFrase: (frase: string) => void;
  /** Lo que se está oyendo ahora mismo, todavía sin cerrar. */
  alOir: (parcial: string) => void;
  /** Un error que no tiene arreglo: el dictado se para y se dice por qué. */
  alFallar: (mensaje: string) => void;
};

export type Dictado = { parar: () => void };

const MOTIVOS: Record<string, string> = {
  "not-allowed":
    "El navegador no ha dado permiso para el micrófono. Dáselo en la barra de direcciones y vuelve a intentarlo.",
  "service-not-allowed":
    "El navegador no ha dado permiso para el micrófono. Dáselo en la barra de direcciones y vuelve a intentarlo.",
  "audio-capture":
    "No se encuentra ningún micrófono. Conecta uno o usa el campo de notas para pegar la visita.",
  network: "El reconocimiento de voz se ha quedado sin red. Puedes seguir escribiendo las notas.",
};

/**
 * Arranca el dictado en castellano, en modo continuo y con resultados
 * intermedios. Devuelve la forma de pararlo.
 */
export function empezarDictado(manejadores: ManejadoresDeDictado): Dictado {
  const w = window as VentanaConDictado;
  const Motor = w.webkitSpeechRecognition ?? w.SpeechRecognition;
  if (!Motor) {
    manejadores.alFallar("Este navegador no sabe dictar. Pega las notas en el cuadro de abajo.");
    return { parar: () => {} };
  }

  const motor = new Motor();
  motor.lang = "es-ES";
  motor.continuous = true;
  motor.interimResults = true;
  motor.maxAlternatives = 1;

  // Mientras esto sea true, cada corte por silencio se reanuda solo.
  let escuchando = true;

  motor.onresult = (e) => {
    let parcial = "";
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const resultado = e.results[i];
      const trozo = resultado[0]?.transcript ?? "";
      if (resultado.isFinal) manejadores.alCerrarFrase(trozo);
      else parcial += trozo;
    }
    manejadores.alOir(parcial);
  };

  motor.onerror = (e) => {
    // «no-speech» y «aborted» son normales en una visita con pausas: se ignoran
    // y el onend se encarga de volver a arrancar.
    if (e.error === "no-speech" || e.error === "aborted") return;
    escuchando = false;
    manejadores.alFallar(MOTIVOS[e.error] ?? `El dictado se ha cortado (${e.error}).`);
  };

  motor.onend = () => {
    if (!escuchando) return;
    try {
      motor.start();
    } catch {
      // Ya estaba arrancando: no pasa nada.
    }
  };

  try {
    motor.start();
  } catch {
    manejadores.alFallar("El dictado ya estaba en marcha.");
  }

  return {
    parar: () => {
      escuchando = false;
      motor.onresult = null;
      motor.onerror = null;
      motor.onend = null;
      try {
        motor.stop();
      } catch {
        // Ya estaba parado.
      }
    },
  };
}
