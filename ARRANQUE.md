Lee entero PROMPT.md: es la especificación del producto y las reglas de trabajo. La fase 0 ya está hecha y verificada (FASE-0.md, tag v0): no la repitas. Lee también FASE-0.md y CLAUDE.md, que llevan los contratos y el mapa de dueños.

Comprueba antes de nada que lo de la fase 0 sigue en pie: la landing pública en `/`, el formulario de `/solicitar` (que todavía no guarda), `/entrar` con la contraseña y el panel bajo `/panel` protegido por `src/proxy.ts`. Las rutas ya están decididas ahí: no las muevas.

Antes de ponerte a trabajar, razona a fondo y sintetiza toda esa información: qué hay, qué falta, cómo se reparte entre los carriles y en qué orden se cierra cada fase. Ten presente que el acceso a datos es asíncrono (libSQL) y que la fase 7 despliega en Vercel con Turso: lo que construyas en las fases 1 a 6 tiene que llegar vivo hasta ahí.

Después propón el plan de las fases 1 a 7 con los subagentes de cada carril y, cuando lo apruebe, a por todas. Un commit al cerrar cada fase, con el título que lleva en PROMPT.md.
