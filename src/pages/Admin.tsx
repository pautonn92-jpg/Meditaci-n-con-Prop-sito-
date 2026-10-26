import { useEffect, useState } from "react";
import { useSesion } from "../App";
import { ars, nombreMes, sb, type Meditacion, type Vivo } from "../lib/api";

// Panel de Paula: cargar vivos, subir meditaciones y cambiar precios.
export default function Admin() {
  const session = useSesion();
  const [esAdmin, setEsAdmin] = useState<boolean | null>(null);
  const [vivos, setVivos] = useState<Vivo[]>([]);
  const [meds, setMeds] = useState<Meditacion[]>([]);
  const [precios, setPrecios] = useState({ vivo: 0, pack_por_vivo: 0 });
  const [msg, setMsg] = useState("");

  const recargar = async () => {
    const [v, m, p] = await Promise.all([
      sb!.from("vivos").select("*").order("empieza", { ascending: false }),
      sb!.from("meditaciones").select("*").order("creada", { ascending: false }),
      sb!.from("precios").select("clave, monto"),
    ]);
    setVivos(v.data ?? []); setMeds(m.data ?? []);
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
