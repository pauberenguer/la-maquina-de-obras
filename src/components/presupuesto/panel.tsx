"use client";
// El panel lateral de la ficha: General, Actividad y Seguimientos.
// Los contenidos se le pasan ya renderizados desde el servidor.
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function PanelDelPresupuesto({
  general,
  actividad,
  seguimientos,
  cuantosEventos,
}: {
  general: React.ReactNode;
  actividad: React.ReactNode;
  seguimientos: React.ReactNode;
  cuantosEventos: number;
}) {
  return (
    <Tabs defaultValue="general" className="gap-4">
      <TabsList variant="line" className="w-full justify-start border-b pb-1">
        <TabsTrigger value="general">General</TabsTrigger>
        <TabsTrigger value="actividad">
          Actividad
          {cuantosEventos > 0 && (
            <span className="cifra ml-1 rounded-sm bg-secondary px-1 text-[11px] text-muted-foreground">
              {cuantosEventos}
            </span>
          )}
        </TabsTrigger>
        <TabsTrigger value="seguimientos">Seguimientos</TabsTrigger>
      </TabsList>
      <TabsContent value="general">{general}</TabsContent>
      <TabsContent value="actividad">{actividad}</TabsContent>
      <TabsContent value="seguimientos">{seguimientos}</TabsContent>
    </Tabs>
  );
}
