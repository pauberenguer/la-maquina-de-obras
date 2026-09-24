// La hora REAL, sin el desplazamiento del reloj de la demo.
//
// Es la única excepción a «todo usa ahora()», y existe por seguridad: la
// caducidad de la sesión del panel y los límites por IP no pueden moverse al
// darle a «+3 días» en la demo. Todo lo demás del producto usa ahora() de
// src/lib/reloj.ts.
export function horaReal(): number {
  return Date.now();
}
