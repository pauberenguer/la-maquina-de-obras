"use client";
// Una celda que se edita donde está. Se escribe encima del valor, se confirma
// con Intro o saliendo del campo, y se deshace con Escape.
import { useEffect, useRef, useState } from "react";
import { cn } from "cn";

export function CeldaEditable({
  valor,
  onGuardar,
  sufijo,
  alineacion = "derecha",
  ancho = "w-20",
  titulo,
  deshabilitada = false,
  marcador,
}: {
  /** El valor ya formateado para escribirse en el campo. */
  valor: string;
  /** Devuelve el texto tal cual lo ha escrito Manolo. */
  onGuardar: (texto: string) => void;
  sufijo?: string;
  alineacion?: "izquierda" | "derecha";
  ancho?: string;
  titulo?: string;
  deshabilitada?: boolean;
  /** Lo que se enseña cuando el campo está vacío. */
  marcador?: string;
}) {
  const [texto, setTexto] = useState(valor);
  const original = useRef(valor);
  const campo = useRef<HTMLInputElement>(null);

  // Si el valor cambia por fuera (el servidor redondea, se resuelve una
  // amarilla…), el campo se pone al día salvo que se esté escribiendo en él.
  useEffect(() => {
    if (document.activeElement === campo.current) return;
    original.current = valor;
    setTexto(valor);
  }, [valor]);

  function confirmar() {
    if (texto === original.current) return;
    onGuardar(texto);
  }

  return (
    <span className={cn("inline-flex items-baseline gap-1", alineacion === "derecha" && "justify-end")}>
      <input
        ref={campo}
        value={texto}
        title={titulo}
        disabled={deshabilitada}
        placeholder={marcador}
        inputMode={alineacion === "derecha" ? "decimal" : undefined}
        onChange={(e) => setTexto(e.target.value)}
        onFocus={(e) => e.currentTarget.select()}
        onBlur={confirmar}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            e.currentTarget.blur();
          }
          if (e.key === "Escape") {
            e.preventDefault();
            setTexto(original.current);
            e.currentTarget.blur();
          }
        }}
        className={cn(
          "cifra rounded-md border border-transparent bg-transparent px-1.5 py-0.5 tabular-nums transition-colors",
          "hover:border-input focus:border-ring focus:bg-card focus:ring-3 focus:ring-ring/50 focus:outline-none",
          "disabled:pointer-events-none disabled:opacity-60",
          alineacion === "derecha" ? "text-right" : "text-left",
          ancho,
        )}
      />
      {sufijo && <span className="shrink-0 text-xs text-muted-foreground">{sufijo}</span>}
    </span>
  );
}

/** La versión de texto libre, para la descripción de una línea. */
export function TextoEditable({
  valor,
  onGuardar,
  className,
  deshabilitada = false,
}: {
  valor: string;
  onGuardar: (texto: string) => void;
  className?: string;
  deshabilitada?: boolean;
}) {
  const [texto, setTexto] = useState(valor);
  const original = useRef(valor);
  const campo = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (document.activeElement === campo.current) return;
    original.current = valor;
    setTexto(valor);
  }, [valor]);

  return (
    <input
      ref={campo}
      value={texto}
      disabled={deshabilitada}
      onChange={(e) => setTexto(e.target.value)}
      onBlur={() => {
        if (texto.trim() === original.current) return;
        onGuardar(texto);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          e.currentTarget.blur();
        }
        if (e.key === "Escape") {
          e.preventDefault();
          setTexto(original.current);
          e.currentTarget.blur();
        }
      }}
      className={cn(
        "w-full rounded-md border border-transparent bg-transparent px-1.5 py-0.5 leading-snug transition-colors",
        "hover:border-input focus:border-ring focus:bg-card focus:ring-3 focus:ring-ring/50 focus:outline-none",
        "disabled:pointer-events-none disabled:opacity-60",
        className,
      )}
    />
  );
}
