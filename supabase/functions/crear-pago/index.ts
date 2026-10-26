// Crea una orden y una preferencia de Mercado Pago (Checkout Pro).
// Recibe { producto: "vivo:<id>" | "pack:<YYYY-MM>" | "med:<id>" } y devuelve { url } para redirigir al pago.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const token = req.headers.get("Authorization")?.replace("Bearer ", "") ?? "";
  const { data: { user } } = await admin.auth.getUser(token);
  if (!user) return json({ error: "Tenés que iniciar sesión para comprar." }, 401);

  const { producto } = await req.json();
  const [tipo, ref] = String(producto ?? "").split(":");
  const { data: precios } = await admin.from("precios").select("clave, monto");
  const precio = (clave: string) => precios?.find((p) => p.clave === clave)?.monto ?? 0;

  let titulo: string, monto: number;
  if (tipo === "vivo") {
    const { data: vivo } = await admin.from("vivos").select("titulo, empieza").eq("id", ref).single();
    if (!vivo) return json({ error: "Ese vivo no existe." }, 404);
    titulo = `Vivo: ${vivo.titulo}`;
    monto = precio("vivo");
  } else if (tipo === "pack" && /^\d{4}-\d{2}$/.test(ref)) {
    const { count } = await admin.from("vivos").select("id", { count: "exact", head: true }).eq("mes", ref);
    if (!count) return json({ error: "Todavía no hay vivos cargados para ese mes." }, 404);
    titulo = `Pack del mes ${ref} (${count} vivos)`;
    monto = precio("pack_por_vivo") * count;
  } else if (tipo === "med") {
    const { data: med } = await admin.from("meditaciones").select("titulo, precio").eq("id", ref).eq("tipo", "individual").eq("publicada", true).single();
    if (!med) return json({ error: "Esa meditación no está a la venta." }, 404);
    titulo = `Meditación: ${med.titulo}`;
    monto = med.precio;
  } else {
    return json({ error: "Producto inválido." }, 400);
  }

  const { data: orden, error } = await admin
    .from("ordenes").insert({ user_id: user.id, producto, monto }).select("id").single();
  if (error) return json({ error: "No se pudo crear la orden." }, 500);

  const sitio = Deno.env.get("SITIO_URL") ?? "https://meditacion-con-proposito.netlify.app";
  const res = await fetch("https://api.mercadopago.com/checkout/preferences", {
    method: "POST",
    headers: { Authorization: `Bearer ${Deno.env.get("MP_ACCESS_TOKEN")}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      items: [{ title: titulo, quantity: 1, unit_price: monto, currency_id: "ARS" }],
      payer: { email: user.email },
      external_reference: orden.id,
      notification_url: `${Deno.env.get("SUPABASE_URL")}/functions/v1/mp-webhook`,
      back_urls: { success: `${sitio}/pago`, pending: `${sitio}/pago`, failure: `${sitio}/pago` },
      auto_return: "approved",
    }),
  });
  if (!res.ok) return json({ error: "Mercado Pago no respondió. Probá de nuevo en un rato." }, 502);
  const pref = await res.json();
  return json({ url: pref.init_point });
});
