import { createClient, type Session } from "@supabase/supabase-js";

export type Vivo = { id: string; titulo: string; empieza: string; mes: string; duracion_min: number };
export type Meditacion = {
  id: string; titulo: string; descripcion: string | null; minutos: number;
  tipo: "gratis" | "semana" | "pack"; vivo_id: string | null; mes_pack: string | null; archivo: string | null;
  formato: "audio" | "video"; publicada: boolean;
};
export type Precios = { vivo: number; pack_por_vivo: number };

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

// Sin Supabase configurado la app corre en modo demostración, con datos de ejemplo.
export const demo = !url || !key;
export const sb = demo ? null : createClient(url!, key!);

const DEMO_VIVOS: Vivo[] = [6, 13, 20, 27].map((d, i) => ({
  id: "v" + i, mes: "2026-11", duracion_min: 40,
  empieza: `2026-11-${String(d).padStart(2, "0")}T23:00:00Z`,
  titulo: ["Soltar lo que pesa", "Agradecer lo simple", "Descanso profundo", "Volver a mí"][i],
}));
const DEMO_MEDS: Meditacion[] = [
  ["Limpieza energética", 38, "gratis", null], ["Chakra raíz", 34, "pack", "2026-11"], ["Soltar la semana", 10, "semana", "v0"], ["Tres respiraciones de gratitud", 5, "semana", "v1"],
  ["Cuerpo liviano para dormir", 10, "semana", "v2"], ["Hablarme con cariño", 10, "semana", "v3"],
].map(([titulo, minutos, tipo, vivo_id], i) => ({
  id: "m" + i, titulo: titulo as string, minutos: minutos as number, tipo: tipo as Meditacion["tipo"],
  vivo_id: tipo === "pack" ? null : (vivo_id as string | null), mes_pack: tipo === "pack" ? (vivo_id as string) : null, descripcion: null, archivo: null, formato: "audio", publicada: true,
}));
const demoAccesos = new Set<string>();

export async function cargarCatalogo() {
  if (demo) return { vivos: DEMO_VIVOS, meditaciones: DEMO_MEDS, precios: { vivo: 25000, pack_por_vivo: 20000 } };
  const [v, m, p] = await Promise.all([
    sb!.from("vivos").select("*").gte("empieza", new Date(Date.now() - 45 * 864e5).toISOString()).order("empieza"),
    sb!.from("meditaciones").select("*").eq("publicada", true).order("creada"),
    sb!.from("precios").select("clave, monto"),
  ]);
  const precios = Object.fromEntries((p.data ?? []).map((r) => [r.clave, r.monto])) as Precios;
  return { vivos: (v.data ?? []) as Vivo[], meditaciones: (m.data ?? []) as Meditacion[], precios };
}

// Ids de vivos pagados, más "pack:YYYY-MM" por cada pack comprado.
export async function cargarAccesos(session: Session | null): Promise<Set<string>> {
  if (demo) return new Set(demoAccesos);
  if (!session) return new Set();
  const [a, p] = await Promise.all([sb!.from("accesos").select("vivo_id"), sb!.from("packs_comprados").select("mes")]);
  return new Set([...(a.data ?? []).map((r) => r.vivo_id), ...(p.data ?? []).map((r) => "pack:" + r.mes)]);
}

export const habilitada = (m: Meditacion, accesos: Set<string>) =>
  m.tipo === "gratis" || (m.tipo === "semana" ? accesos.has(m.vivo_id!) : accesos.has("pack:" + m.mes_pack));

export async function linkDelVivo(vivoId: string): Promise<string | null> {
  if (demo) return null;
  const { data } = await sb!.from("links_vivos").select("link").eq("vivo_id", vivoId).maybeSingle();
  return data?.link ?? null;
}

// Devuelve la URL de Mercado Pago a la que hay que ir para pagar.
export async function crearPago(producto: string, vivos: Vivo[]): Promise<string> {
  if (demo) {
    const [tipo, ref] = producto.split(":");
    vivos.filter((v) => (tipo === "vivo" ? v.id === ref : v.mes === ref)).forEach((v) => demoAccesos.add(v.id));
    if (tipo === "pack") demoAccesos.add(producto);
    return "/pago?demo=1";
  }
  const { data, error } = await sb!.functions.invoke("crear-pago", { body: { producto } });
  if (error || !data?.url) throw new Error(data?.error ?? "No se pudo iniciar el pago.");
  return data.url;
}

export async function urlDeArchivo(m: Meditacion): Promise<string | null> {
  if (demo || !m.archivo) return null;
  const { data } = await sb!.storage.from("meditaciones").createSignedUrl(m.archivo, 60 * 60 * 3);
  return data?.signedUrl ?? null;
}

export const ars = (n: number) => "$" + n.toLocaleString("es-AR");
export const nombreMes = (mes: string) =>
  new Date(mes + "-15T12:00:00").toLocaleDateString("es-AR", { month: "long" });
