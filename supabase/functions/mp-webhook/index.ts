// Mercado Pago avisa acá cada vez que cambia un pago.
// Si el pago está aprobado, se habilitan los vivos (y con ellos sus meditaciones cortas).
// Hay que desplegarla con --no-verify-jwt, porque la llama Mercado Pago y no un usuario.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

async function firmaValida(req: Request, dataId: string): Promise<boolean> {
  const secreto = Deno.env.get("MP_WEBHOOK_SECRET");
  if (!secreto) return true; // sin secreto configurado, igual se verifica el pago contra la API
  const partes = Object.fromEntries(
    (req.headers.get("x-signature") ?? "").split(",").map((p) => p.trim().split("=") as [string, string]),
  );
  const manifiesto = `id:${dataId};request-id:${req.headers.get("x-request-id") ?? ""};ts:${partes.ts};`;
  const clave = await crypto.subtle.importKey("raw", new TextEncoder().encode(secreto), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const firma = await crypto.subtle.sign("HMAC", clave, new TextEncoder().encode(manifiesto));
  const hex = [...new Uint8Array(firma)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return hex === partes.v1;
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const body = await req.json().catch(() => ({}));
  const tipo = body.type ?? url.searchParams.get("type");
  const pagoId = String(body.data?.id ?? url.searchParams.get("data.id") ?? "");
  if (tipo !== "payment" || !pagoId) return new Response("ignorado");
  if (!(await firmaValida(req, pagoId))) return new Response("firma inválida", { status: 401 });

  const res = await fetch(`https://api.mercadopago.com/v1/payments/${pagoId}`, {
    headers: { Authorization: `Bearer ${Deno.env.get("MP_ACCESS_TOKEN")}` },
  });
  if (!res.ok) return new Response("pago no encontrado", { status: 404 });
  const pago = await res.json();

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: orden } = await db.from("ordenes").select("*").eq("id", pago.external_reference).single();
  if (!orden) return new Response("orden no encontrada", { status: 404 });

  if (pago.status !== "approved") {
    if (pago.status === "rejected" || pago.status === "cancelled") {
      await db.from("ordenes").update({ estado: "rechazada", mp_pago_id: pagoId }).eq("id", orden.id).eq("estado", "pendiente");
    }
    return new Response("ok");
  }
  if (Number(pago.transaction_amount) < orden.monto) return new Response("monto incorrecto", { status: 400 });

  const [prod, ref] = orden.producto.split(":");
  if (prod === "med") {
    await db.from("meditaciones_compradas").upsert({ user_id: orden.user_id, meditacion_id: ref, orden_id: orden.id }, { onConflict: "user_id,meditacion_id", ignoreDuplicates: true });
    await db.from("ordenes").update({ estado: "aprobada", mp_pago_id: pagoId }).eq("id", orden.id);
    return new Response("ok");
  }
  const { data: vivos } = prod === "vivo"
    ? await db.from("vivos").select("id").eq("id", ref)
    : await db.from("vivos").select("id").eq("mes", ref);
  const filas = (vivos ?? []).map((v) => ({ user_id: orden.user_id, vivo_id: v.id, orden_id: orden.id }));

  // Repetir el aviso no duplica nada: la clave es (persona, vivo).
  await db.from("accesos").upsert(filas, { onConflict: "user_id,vivo_id", ignoreDuplicates: true });
  if (prod === "pack") {
    await db.from("packs_comprados").upsert({ user_id: orden.user_id, mes: ref, orden_id: orden.id }, { onConflict: "user_id,mes", ignoreDuplicates: true });
  }
  await db.from("ordenes").update({ estado: "aprobada", mp_pago_id: pagoId }).eq("id", orden.id);
  return new Response("ok");
});
