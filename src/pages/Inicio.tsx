import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSesion } from "../App";
import Reproductor from "../components/Reproductor";
import { Mariposa, Meditando } from "../components/Decoracion";
import { ars, cargarAccesos, cargarCatalogo, crearPago, demo, habilitada, linkDelVivo, nombreMes, type Meditacion, type Precios, type Vivo } from "../lib/api";

const FILTROS = [{ id: 99, label: "Todas" }, { id: 5, label: "Hasta 5 min" }, { id: 10, label: "Hasta 10 min" }, { id: 30, label: "Hasta 30 min" }, { id: 45, label: "Hasta 45 min" }];
const dia = (iso: string) => new Date(iso);
const hora = (iso: string) => dia(iso).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "America/Argentina/Buenos_Aires" });

export default function Inicio() {
  const session = useSesion();
  const navigate = useNavigate();
  const [vivos, setVivos] = useState<Vivo[]>([]);
  const [meds, setMeds] = useState<Meditacion[]>([]);
  const [precios, setPrecios] = useState<Precios>({ vivo: 0, pack_por_vivo: 0 });
  const [accesos, setAccesos] = useState<Set<string>>(new Set());
  const [links, setLinks] = useState<Record<string, string>>({});
  const [filtro, setFiltro] = useState(99);
  const [sonando, setSonando] = useState<Meditacion | null>(null);
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(true);
  const [comprando, setComprando] = useState(false);

  useEffect(() => {
    cargarCatalogo().then((c) => { setVivos(c.vivos); setMeds(c.meditaciones); setPrecios(c.precios); setCargando(false); });
  }, []);
  useEffect(() => { cargarAccesos(session).then(setAccesos); }, [session]);
  useEffect(() => {
    [...accesos].forEach((id) => linkDelVivo(id).then((l) => l && setLinks((x) => ({ ...x, [id]: l }))));
  }, [accesos]);

  // El pack es el del primer mes que todavía tiene vivos por delante.
  const proximos = vivos.filter((v) => dia(v.empieza).getTime() > Date.now() - 3 * 3600e3);
  const mes = proximos[0]?.mes ?? vivos[0]?.mes;
  const vivosMes = vivos.filter((v) => v.mes === mes);
  const tienePack = accesos.has("pack:" + mes) || (vivosMes.length > 0 && vivosMes.every((v) => accesos.has(v.id)));
  const regalos = meds.filter((m) => m.tipo === "pack" && m.mes_pack === mes);
  const vivoDe = (id: string | null) => vivos.find((v) => v.id === id);

  const lista = useMemo(() => meds
    .filter((m) => m.minutos <= filtro)
    .map((m) => ({ m, abierta: habilitada(m, accesos) }))
    .sort((a, b) => Number(b.abierta) - Number(a.abierta)), [meds, filtro, accesos]);

  const comprar = async (producto: string) => {
    setError("");
    if (!demo && !session) { navigate("/entrar"); return; }
    setComprando(true);
    try {
      const destino = await crearPago(producto, vivos);
      if (destino.startsWith("http")) window.location.href = destino; else navigate(destino);
    } catch (e) {
      setError((e as Error).message);
      setComprando(false);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  if (cargando) return <p className="lead">Cargando…</p>;

  return (
    <>
      <section className="portada">
        <img src="/logo.webp" alt="Paula Tonn" className="logo" width="320" height="317" />
        <Mariposa className="vuela uno" tam={26} />
        <Mariposa className="vuela dos" tam={18} />
        <p className="lead">Meditaciones en vivo con Reiki cada viernes, y meditaciones grabadas para acompañarte el resto de la semana.</p>
      </section>
      {error && <p className="aviso">{error}</p>}
      {comprando && <p className="aviso">Te estamos llevando a Mercado Pago…</p>}

      {vivosMes.length > 0 && (
        <section className="pack">
          <span className="eyebrow">Pack de {nombreMes(mes!)}</span>
          <h2>Todo el mes en calma</h2>
          <Meditando className="pack-figura" tam={96} />
          <ul>
            <li>Los {vivosMes.length} vivos de los viernes, con Reiki mientras meditás</li>
            <li>La meditación corta de cada semana, para siempre</li>
            {regalos.map((m) => <li key={m.id}>De regalo: {m.titulo} ({m.minutos} min)</li>)}
          </ul>
          <div className="fila">
            {tienePack ? <span className="tuyo">Ya tenés el pack de {nombreMes(mes!)}</span> : <>
              <span className="precio">{ars(precios.pack_por_vivo * vivosMes.length)}<s>{ars(precios.vivo * vivosMes.length)}</s></span>
              <button className="btn dorado" onClick={() => comprar("pack:" + mes)}>Comprar el pack</button>
            </>}
          </div>
        </section>
      )}

      <section>
        <h2 className="titulo-ala"><Mariposa tam={22} />Vivos de {nombreMes(mes ?? "2026-01")}</h2>
        {vivosMes.length === 0 && <p className="lead">Todavía no hay vivos cargados para este mes.</p>}
        <div className="semanas">
          {vivosMes.map((v) => {
            const on = accesos.has(v.id);
            const corta = meds.find((m) => m.vivo_id === v.id);
            return (
              <div className="semana" key={v.id}>
                <div className="fecha"><small>vie</small><b>{dia(v.empieza).getDate()}</b><small>{dia(v.empieza).toLocaleDateString("es-AR", { month: "short" })}</small></div>
                <div className="semana-cuerpo">
                  <div><div className="semana-titulo">{v.titulo}</div><div className="meta">{hora(v.empieza)} h · {v.duracion_min} min en vivo · Reiki</div></div>
                  <div className="accesos">
                    <span className={on ? "on" : ""}>{on ? "Lugar reservado" : "Vivo sin reservar"}</span>
                    {corta && <span className={on ? "on" : ""}>Corta: {corta.titulo} ({corta.minutos} min)</span>}
                  </div>
                  {on && links[v.id] && <a className="btn chico" href={links[v.id]} target="_blank" rel="noreferrer">Entrar al vivo</a>}
                  {!on && <div className="fila"><span className="precio chico">{ars(precios.vivo)}</span><button className="btn chico borde" onClick={() => comprar("vivo:" + v.id)}>Reservar este vivo</button></div>}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="titulo-ala"><Mariposa tam={22} />Mis meditaciones</h2>
        <div className="chips">
          {FILTROS.map((f) => <button key={f.id} className="chip" aria-pressed={filtro === f.id} onClick={() => setFiltro(f.id)}>{f.label}</button>)}
        </div>
        <div className="lista">
          {lista.map(({ m, abierta }) => {
            const v = vivoDe(m.vivo_id);
            return (
              <button key={m.id} className="item" onClick={() => abierta ? setSonando(m) : m.tipo === "individual" ? comprar("med:" + m.id) : m.tipo === "pack" ? comprar("pack:" + m.mes_pack) : v && comprar("vivo:" + v.id)}>
                <span className="insignia"><span><b>{m.minutos}</b><small>min</small></span></span>
                <span className="item-cuerpo"><span className="item-titulo">{m.titulo}</span>
                  <span className="meta">{m.tipo === "gratis" ? "Gratis" : m.tipo === "individual" ? "Grabación de un vivo con Reiki" : m.tipo === "pack" ? "Regalo del pack de " + nombreMes(m.mes_pack!) : v ? "Semana del " + dia(v.empieza).getDate() + " de " + nombreMes(v.mes) : ""}</span></span>
                <span className={"tag " + (abierta ? "" : "candado")}>{m.tipo === "gratis" ? "Gratis" : abierta ? "Tuya" : m.tipo === "individual" ? "Comprar · " + ars(m.precio!) : "Bloqueada"}</span>
              </button>
            );
          })}
          {lista.length === 0 && <p className="lead">No hay meditaciones de ese largo todavía.</p>}
        </div>
      </section>

      <section className="sobre-mi">
        <img src="/paula.jpg" alt="Paula Tonn" className="foto" width="400" height="551" loading="lazy" />
        <div className="sobre-texto">
          <span className="eyebrow">Quién te acompaña</span>
          <h2>Hola, soy Pau Tonn</h2>
          <p>Soy terapeuta holística y brindo diferentes servicios:</p>
          <p>Soy máster Reiki Usui desde hace 12 años. Doy la formación en este sistema de Reiki (nivel 1, 2, 3 y maestría), brindo sesiones de Reiki Usui y radiestesia. Soy practicante certificada de Barras de Access, Facelift Energético de Access y procesos de cuerpo. También doy la clase de Barras de Access®, ya que soy facilitadora certificada de la clase de Barras de Access®.</p>
          <p>Soy terapeuta en péndulo hebreo método Meraki, también soy lectora de registros akáshicos de Símbolos de Luz y sanadora cósmica del mismo sistema.</p>
          <p>Soy mamá, esposa, hija, hermana y amiga.</p>
          <p>Mi misión es acompañar a las personas en sus procesos mediante la facilitación de consciencia y la armonización energética. Como así también ayudándoles a conectar con sus guías y maestros espirituales, con su sabiduría akáshica y con su propia luz. Mi meta es que cada persona que llegue a mí se vaya con mayor consciencia y empoderamiento del que tenía cuando llegó.</p>
          <p className="firma">¿Qué más es posible?<br />Gracias por estar aquí y elegirme.</p>
          <div className="agenda">
            <p>Si querés tener una sesión conmigo, podés acceder a mi agenda aquí:</p>
            <a className="btn dorado" href="https://turnosconqr.com/app/paulatonnterapiasholisticas" target="_blank" rel="noreferrer">Reservar una sesión</a>
          </div>
          <Mariposa tam={24} />
        </div>
      </section>

      {sonando && <Reproductor med={sonando} subtitulo={sonando.tipo === "gratis" ? "Gratis" : sonando.tipo === "semana" ? "Meditación de la semana" : "Tu meditación"} onCerrar={() => setSonando(null)} />}
    </>
  );
}
