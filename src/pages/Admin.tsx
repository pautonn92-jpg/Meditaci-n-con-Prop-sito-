import { useEffect, useState } from "react";
import { useSesion } from "../App";
import { ars, nombreMes, sb, urlDeComprobante, type Meditacion, type Vivo } from "../lib/api";

type Revision = { id: string; email: string; producto: string; monto: number; comprobante: string; creada: string };

// Panel de Paula: cargar vivos, subir meditaciones y cambiar precios.
export default function Admin() {
  const session = useSesion();
  const [esAdmin, setEsAdmin] = useState<boolean | null>(null);
  const [vivos, setVivos] = useState<Vivo[]>([]);
  const [meds, setMeds] = useState<Meditacion[]>([]);
  const [precios, setPrecios] = useState({ vivo: 0, pack_por_vivo: 0 });
  const [msg, setMsg] = useState("");
  const [revisar, setRevisar] = useState<Revision[]>([]);
  const [ajustes, setAjustes] = useState({ alias: "", titular: "" });
  const [porMail, setPorMail] = useState<{ email: string; meditacion_id: string }[]>([]);

  const recargar = async () => {
    const [v, m, p, t, a, pm] = await Promise.all([
      sb!.from("vivos").select("*").order("empieza", { ascending: false }),
      sb!.from("meditaciones").select("*").order("creada", { ascending: false }),
      sb!.from("precios").select("clave, monto"),
      sb!.rpc("transferencias_por_revisar"),
      sb!.from("ajustes").select("clave, valor"),
      sb!.from("accesos_por_mail").select("email, meditacion_id").order("email"),
    ]);
    setVivos(v.data ?? []); setMeds(m.data ?? []); setRevisar((t.data ?? []) as Revision[]);
    setPorMail(pm.data ?? []);
    setAjustes(Object.fromEntries((a.data ?? []).map((r) => [r.clave, r.valor])) as typeof ajustes);
    setPrecios(Object.fromEntries((p.data ?? []).map((r) => [r.clave, r.monto])) as typeof precios);
  };

  useEffect(() => {
    if (!sb || !session) { setEsAdmin(false); return; }
    sb.rpc("is_admin").then(({ data }) => { setEsAdmin(!!data); if (data) recargar(); });
  }, [session]);

  if (!sb) return <p className="lead">El panel funciona cuando la app está conectada a la base de datos.</p>;
  if (esAdmin === null) return <p className="lead">Cargando…</p>;
  if (!esAdmin) return <p className="lead">Esta sección es solo para Paula. Entrá con tu correo de administradora.</p>;

  const nuevoVivo = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const empieza = new Date(`${f.get("fecha")}T${f.get("hora")}:00-03:00`).toISOString();
    const { data, error } = await sb!.from("vivos").insert({ titulo: f.get("titulo"), empieza }).select("id").single();
    if (error) return setMsg("No se pudo guardar el vivo.");
    if (f.get("link")) await sb!.from("links_vivos").insert({ vivo_id: data.id, link: f.get("link") });
    e.currentTarget.reset(); setMsg("Vivo guardado."); recargar();
  };

  const nuevaMed = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget, f = new FormData(form);
    const archivo = f.get("archivo") as File;
    setMsg("Subiendo el archivo…");
    let ruta: string | null = null;
    if (archivo && archivo.size) {
      ruta = `${crypto.randomUUID()}-${archivo.name.replace(/[^\w.-]/g, "_")}`;
      const { error } = await sb!.storage.from("meditaciones").upload(ruta, archivo);
      if (error) return setMsg("No se pudo subir el archivo. Probá con uno más liviano.");
    }
    // El selector trae "" (gratis), el id de un vivo, o "pack:YYYY-MM" (regalo del pack).
    const destino = String(f.get("vivo") ?? "");
    const tipo = !destino ? "gratis" : destino === "individual" ? "individual" : destino.startsWith("pack:") ? "pack" : "semana";
    if (tipo === "individual" && !Number(f.get("precio"))) return setMsg("Poné el precio de la meditación.");
    const { error } = await sb!.from("meditaciones").insert({
      titulo: f.get("titulo"), minutos: Number(f.get("minutos")), tipo,
      vivo_id: tipo === "semana" ? destino : null, mes_pack: tipo === "pack" ? destino.slice(5) : null,
      precio: tipo === "individual" ? Number(f.get("precio")) : null,
      archivo: ruta, formato: archivo?.type.startsWith("video") ? "video" : "audio", publicada: f.get("publicada") === "on",
    });
    if (error) return setMsg("No se pudo guardar la meditación.");
    form.reset(); setMsg("Meditación guardada."); recargar();
  };

  const publicar = async (m: Meditacion) => {
    await sb!.from("meditaciones").update({ publicada: !m.publicada }).eq("id", m.id); recargar();
  };
  // Qué se compró, en palabras: "Meditación: Chakra raíz", "Pack de noviembre"…
  const queCompro = (producto: string) => {
    const [tipo, ref] = producto.split(":");
    if (tipo === "med") return "Meditación: " + (meds.find((m) => m.id === ref)?.titulo ?? "");
    if (tipo === "pack") return "Pack de " + nombreMes(ref);
    const v = vivos.find((x) => x.id === ref);
    return "Vivo del " + (v ? new Date(v.empieza).toLocaleDateString("es-AR") : "");
  };
  const verComprobante = async (ruta: string) => {
    const url = await urlDeComprobante(ruta);
    if (url) window.open(url, "_blank"); else setMsg("No se pudo abrir el comprobante.");
  };
  const decidir = async (t: Revision, aprobar: boolean) => {
    if (!aprobar && !confirm("¿Rechazar esta transferencia? La persona no va a recibir la compra.")) return;
    const { error } = await sb!.rpc("revisar_transferencia", { orden: t.id, aprobar });
    setMsg(error ? "No se pudo guardar. Probá de nuevo." : aprobar ? `Listo, se le habilitó a ${t.email}.` : "Transferencia rechazada.");
    recargar();
  };
  const guardarAlias = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    await Promise.all(["alias", "titular"].map((c) => sb!.from("ajustes").update({ valor: String(f.get(c) ?? "").trim() }).eq("clave", c)));
    setMsg("Datos de transferencia guardados."); recargar();
  };

  const darAcceso = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget, f = new FormData(form);
    const { data, error } = await sb!.rpc("dar_acceso", { mails: String(f.get("mails") ?? ""), meditacion: f.get("med") });
    if (error) return setMsg("No se pudo dar el acceso. Revisá los mails y probá de nuevo.");
    form.reset(); setMsg(data ? `Listo, ${data} ${data === 1 ? "persona tiene" : "personas tienen"} acceso. Tienen que entrar a la app con ese mismo mail.` : "No encontré mails en la lista.");
    recargar();
  };

  const guardarPrecios = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    await Promise.all(["vivo", "pack_por_vivo"].map((c) => sb!.from("precios").update({ monto: Number(f.get(c)) }).eq("clave", c)));
    setMsg("Precios actualizados."); recargar();
  };

  return (
    <>
      <h1>Panel</h1>
      {msg && <p className="aviso ok">{msg}</p>}

      <section>
        <h2>Transferencias por revisar</h2>
        {revisar.length === 0 && <p className="lead">No hay transferencias esperando. Cuando alguien suba un comprobante, aparece acá.</p>}
        <div className="lista">
          {revisar.map((t) => (
            <div key={t.id} className="form">
              <b>{queCompro(t.producto)} · {ars(t.monto)}</b>
              <span className="meta">{t.email} · {new Date(t.creada).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short", hour12: false })}</span>
              <span className="meta">Fijate en tu Mercado Pago que haya entrado el dinero antes de aprobar.</span>
              <div className="fila">
                <button className="btn chico borde" onClick={() => verComprobante(t.comprobante)}>Ver comprobante</button>
                <span className="fila">
                  <button className="btn chico borde" onClick={() => decidir(t, false)}>Rechazar</button>
                  <button className="btn chico dorado" onClick={() => decidir(t, true)}>Aprobar</button>
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <form className="form" onSubmit={nuevaMed}>
        <h2>Subir meditación</h2>
        <label htmlFor="m-titulo">Título</label><input id="m-titulo" name="titulo" required />
        <label htmlFor="m-min">Minutos</label><input id="m-min" name="minutos" type="number" min={1} max={90} required />
        <label htmlFor="m-vivo">¿Quién la recibe?</label>
        <select id="m-vivo" name="vivo" defaultValue="individual">
          <option value="individual">Se vende sola (individual)</option>
          <option value="">Ninguno: es gratis</option>
          {[...new Set(vivos.map((v) => v.mes))].map((mes) => <option key={mes} value={"pack:" + mes}>Regalo del pack de {nombreMes(mes)}</option>)}
          {vivos.map((v) => <option key={v.id} value={v.id}>Corta del vivo del {new Date(v.empieza).toLocaleDateString("es-AR")} · {v.titulo}</option>)}
        </select>
        <label htmlFor="m-precio">Precio si se vende sola (ARS)</label><input id="m-precio" name="precio" type="number" min={1} defaultValue={10000} />
        <label htmlFor="m-arch">Audio o video</label><input id="m-arch" name="archivo" type="file" accept="audio/*,video/*" />
        <label className="check"><input name="publicada" type="checkbox" defaultChecked /> Publicarla ya</label>
        <button className="btn">Guardar meditación</button>
      </form>

      <form className="form" onSubmit={nuevoVivo}>
        <h2>Cargar vivo</h2>
        <label htmlFor="v-titulo">Título</label><input id="v-titulo" name="titulo" required />
        <div className="fila">
          <div><label htmlFor="v-fecha">Fecha</label><input id="v-fecha" name="fecha" type="date" required /></div>
          <div><label htmlFor="v-hora">Hora</label><input id="v-hora" name="hora" type="time" defaultValue="20:00" required /></div>
        </div>
        <label htmlFor="v-link">Link de la videollamada (solo lo ve quien pagó)</label><input id="v-link" name="link" type="url" placeholder="https://meet.google.com/…" />
        <button className="btn">Guardar vivo</button>
      </form>

      <form className="form" onSubmit={darAcceso}>
        <h2>Dar acceso a quien ya pagó</h2>
        <p className="meta">Para quienes te pagaron una meditación antes de la app. Entran con ese mail y la encuentran habilitada.</p>
        <label htmlFor="d-med">Meditación</label>
        <select id="d-med" name="med" required>
          {meds.filter((m) => m.tipo !== "gratis").map((m) => <option key={m.id} value={m.id}>{m.titulo}</option>)}
        </select>
        <label htmlFor="d-mails">Mails (uno por renglón o separados por comas)</label>
        <textarea id="d-mails" name="mails" rows={5} required placeholder={"ana@gmail.com\nlucia@hotmail.com"} />
        <button className="btn">Dar acceso</button>
        {porMail.length > 0 && <details>
          <summary className="meta">Ver a quién le diste acceso ({porMail.length})</summary>
          <ul className="meta">{porMail.map((x) => <li key={x.email + x.meditacion_id}>{x.email} · {meds.find((m) => m.id === x.meditacion_id)?.titulo}</li>)}</ul>
        </details>}
      </form>

      <form className="form" onSubmit={guardarAlias}>
        <h2>Pago por transferencia</h2>
        <p className="meta">Si dejás el alias vacío, la opción de transferir no aparece.</p>
        <label htmlFor="a-alias">Tu alias</label><input id="a-alias" name="alias" key={"c" + ajustes.alias} defaultValue={ajustes.alias} placeholder="tu.alias.mp" />
        <label htmlFor="a-tit">A nombre de</label><input id="a-tit" name="titular" key={"d" + ajustes.titular} defaultValue={ajustes.titular} placeholder="Paula Tonn" />
        <button className="btn">Guardar</button>
      </form>

      <form className="form" onSubmit={guardarPrecios}>
        <h2>Precios</h2>
        <label htmlFor="p-vivo">Vivo suelto (ARS)</label><input id="p-vivo" name="vivo" type="number" key={"a" + precios.vivo} defaultValue={precios.vivo} />
        <label htmlFor="p-pack">Cada vivo dentro del pack (ARS)</label><input id="p-pack" name="pack_por_vivo" type="number" key={"b" + precios.pack_por_vivo} defaultValue={precios.pack_por_vivo} />
        <button className="btn">Guardar precios</button>
      </form>

      <section>
        <h2>Meditaciones cargadas</h2>
        <div className="lista">
          {meds.map((m) => (
            <div key={m.id} className="item">
              <span className="insignia"><span><b>{m.minutos}</b><small>min</small></span></span>
              <span className="item-cuerpo"><span className="item-titulo">{m.titulo}</span><span className="meta">{m.tipo === "gratis" ? "Gratis" : m.tipo === "individual" ? "Individual · " + ars(m.precio!) : m.tipo === "pack" ? "Regalo del pack de " + nombreMes(m.mes_pack!) : "Corta de la semana"}{m.archivo ? "" : " · sin archivo"}</span></span>
              <button className="btn chico borde" onClick={() => publicar(m)}>{m.publicada ? "Ocultar" : "Publicar"}</button>
            </div>
          ))}
        </div>
        <p className="meta">Pack: {ars(precios.pack_por_vivo)} por vivo · Vivo suelto: {ars(precios.vivo)}</p>
      </section>
    </>
  );
}
