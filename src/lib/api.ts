import { createClient, type Session } from "@supabase/supabase-js";

export type Vivo = { id: string; titulo: string; empieza: string; mes: string; duracion_min: number };
export type Meditacion = {
  id: string; titulo: string; descripcion: string | null; minutos: number;
  tipo: "gratis" | "semana" | "pack" | "individual"; vivo_id: string | null; mes_pack: string | null; precio: number | null; archivo: string | null;
  formato: "audio" | "video"; publicada: boolean;
};
export type Precios = { vivo: number; pack_por_vivo: number };
export type Transferencia = { orden: string; titulo: string; monto: number; alias: string; titular: string };

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
  ["Limpieza energética", 38, "gratis", null], ["Chakra raíz", 34, "individual", null], ["Chakra sacro", 35, "individual", null], ["Tres respiraciones de gratitud", 5, "semana", "v1"],
  ["Cuerpo liviano para dormir", 10, "semana", "v2"], ["Hablarme con cariño", 10, "semana", "v3"],
].map(([titulo, minutos, tipo, vivo_id], i) => ({
  id: "m" + i, titulo: titulo as string, minutos: minutos as number, tipo: tipo as Meditacion["tipo"],
  vivo_id: tipo === "pack" ? null : (vivo_id as string | null), mes_pack: tipo === "pack" ? (vivo_id as string) : null, precio: tipo === "individual" ? 10000 : null, descripcion: null, archivo: null, formato: "audio", publicada: true,
}));
const demoAccesos = new Set<string>();

export async function cargarCatalogo() {
  if (demo) return { vivos: DEMO_VIVOS, meditaciones: DEMO_MEDS, precios: { vivo: 25000, pack_por_vivo: 20000 }, alias: "paula.tonn.mp" };
  const [v, m, p, a] = await Promise.all([
    sb!.from("vivos").select("*").gte("empieza", new Date(Date.now() - 45 * 864e5).toISOString()).order("empieza"),
    sb!.from("meditaciones").select("*").eq("publicada", true).order("creada"),
    sb!.from("precios").select("clave, monto"),
    sb!.from("ajustes").select("valor").eq("clave", "alias").maybeSingle(),
  ]);
  const precios = Object.fromEntries((p.data ?? []).map((r) => [r.clave, r.monto])) as Precios;
  return { vivos: (v.data ?? []) as Vivo[], meditaciones: (m.data ?? []) as Meditacion[], precios, alias: (a.data?.valor as string | undefined) ?? "" };
}

// Ids de vivos pagados, más "pack:YYYY-MM" por cada pack y "med:<id>" por cada meditación comprada.
// Lo que se pagó por transferencia y Paula todavía no revisó viene como "rev:<producto>".
export async function cargarAccesos(session: Session | null): Promise<Set<string>> {
  if (demo) return new Set(demoAccesos);
  if (!session) return new Set();
  const [a, p, c, o] = await Promise.all([
    sb!.from("accesos").select("vivo_id"), sb!.from("packs_comprados").select("mes"), sb!.from("meditaciones_compradas").select("meditacion_id"),
    sb!.from("ordenes").select("producto").eq("metodo", "transferencia").eq("estado", "pendiente").not("comprobante", "is", null),
  ]);
  return new Set([
    ...(a.data ?? []).map((r) => r.vivo_id), ...(p.data ?? []).map((r) => "pack:" + r.mes), ...(c.data ?? []).map((r) => "med:" + r.meditacion_id),
    ...(o.data ?? []).map((r) => "rev:" + r.producto),
  ]);
}

export const habilitada = (m: Meditacion, accesos: Set<string>) =>
  m.tipo === "gratis" || (m.tipo === "semana" ? accesos.has(m.vivo_id!)
    : m.tipo === "pack" ? accesos.has("pack:" + m.mes_pack) : accesos.has("med:" + m.id));

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
    if (tipo === "pack" || tipo === "med") demoAccesos.add(producto);
    return "/pago?demo=1";
  }
  const { data, error } = await sb!.functions.invoke("crear-pago", { body: { producto } });
  // Si la función responde con error, el mensaje viene en el cuerpo de la respuesta.
  const detalle = error ? await error.context?.json?.().catch(() => null) : data;
  if (error || !data?.url) throw new Error(detalle?.error ?? "No se pudo iniciar el pago.");
  return data.url;
}

// Crea la orden por transferencia y devuelve el alias y el monto a transferir.
export async function iniciarTransferencia(producto: string, titulo: string, monto: number): Promise<Transferencia> {
  if (demo) return { orden: "demo", titulo, monto, alias: "paula.tonn.mp", titular: "Paula Tonn" };
  const { data, error } = await sb!.functions.invoke("crear-pago", { body: { producto, metodo: "transferencia" } });
  const detalle = error ? await error.context?.json?.().catch(() => null) : data;
  if (error || !data?.orden) throw new Error(detalle?.error ?? "No se pudo preparar la transferencia.");
  return data as Transferencia;
}

// Sube el comprobante a la carpeta de la persona y deja la orden lista para que Paula la revise.
export async function enviarComprobante(orden: string, archivo: File, session: Session | null): Promise<void> {
  if (demo) return;
  const ruta = `${session!.user.id}/${orden}-${Date.now()}-${archivo.name.replace(/[^\w.-]/g, "_")}`;
  const { error } = await sb!.storage.from("comprobantes").upload(ruta, archivo);
  if (error) throw new Error("No se pudo subir el comprobante. Probá con una foto o un PDF más liviano.");
  const { data, error: e2 } = await sb!.rpc("adjuntar_comprobante", { orden, ruta });
  if (e2 || !data) throw new Error("No se pudo registrar el comprobante. Probá de nuevo.");
}

export async function urlDeComprobante(ruta: string): Promise<string | null> {
  const { data } = await sb!.storage.from("comprobantes").createSignedUrl(ruta, 60 * 30);
  return data?.signedUrl ?? null;
}

export async function urlDeArchivo(m: Meditacion): Promise<string | null> {
  if (demo || !m.archivo) return null;
  const { data } = await sb!.storage.from("meditaciones").createSignedUrl(m.archivo, 60 * 60 * 3);
  return data?.signedUrl ?? null;
}

export const ars = (n: number) => "$" + n.toLocaleString("es-AR");
export const nombreMes = (mes: string) =>
  new Date(mes + "-15T12:00:00").toLocaleDateString("es-AR", { month: "long" });
