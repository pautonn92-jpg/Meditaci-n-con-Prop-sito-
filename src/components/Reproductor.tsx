import { useEffect, useRef, useState } from "react";
import { urlDeArchivo, type Meditacion } from "../lib/api";

const fmt = (s: number) => {
  s = Math.max(0, Math.round(s));
  return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
};

export default function Reproductor({ med, subtitulo, onCerrar }: { med: Meditacion; subtitulo: string; onCerrar: () => void }) {
  const ref = useRef<HTMLAudioElement & HTMLVideoElement>(null);
  const [src, setSrc] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [sonando, setSonando] = useState(false);
  const [t, setT] = useState(0);
  const [inhala, setInhala] = useState(true);
  const total = med.minutos * 60;
  const dur = ref.current?.duration || total;

  useEffect(() => {
    urlDeArchivo(med).then((u) => { setSrc(u); setCargando(false); });
  }, [med]);

  // Sin archivo (modo demostración) el tiempo corre igual para probar la pantalla.
  useEffect(() => {
    if (!sonando || src) return;
    const id = setInterval(() => setT((x) => (x + 1 >= total ? (setSonando(false), total) : x + 1)), 1000);
    return () => clearInterval(id);
  }, [sonando, src, total]);

  useEffect(() => {
    if (!sonando) return;
    let on = true, timer = 0;
    const fase = (i: boolean) => { if (!on) return; setInhala(i); timer = window.setTimeout(() => fase(!i), i ? 4000 : 6000); };
    fase(true);
    return () => { on = false; clearTimeout(timer); };
  }, [sonando]);

  const alternar = () => {
    if (src && ref.current) { if (sonando) ref.current.pause(); else ref.current.play(); }
    setSonando(!sonando);
  };
  const mover = (d: number) => {
    const n = Math.min(Math.max(0, t + d), dur - 1);
    if (src && ref.current) ref.current.currentTime = n;
    setT(n);
  };
  const props = {
    ref, src: src ?? undefined, playsInline: true,
    onTimeUpdate: () => setT(ref.current?.currentTime ?? 0),
    onEnded: () => setSonando(false),
  };

  return (
    <div className="hoja" role="dialog" aria-modal="true" aria-labelledby="rep-titulo">
      <div className="hoja-in">
        <div className="hoja-barra"><button className="icono" onClick={onCerrar} aria-label="Cerrar">✕</button></div>
        <div className="rep-cabeza">
          <span className="eyebrow">{subtitulo} · {med.minutos} min</span>
          <h2 id="rep-titulo">{med.titulo}</h2>
          <span className="meta">Guiada por Paula</span>
        </div>
        {med.formato === "video" && src
          ? <video {...props} className="video" />
          : <div className="resp-caja"><div className={"resp " + (sonando ? (inhala ? "in" : "out") : "")}><span>{cargando ? "Cargando" : sonando ? (inhala ? "Inhalá" : "Exhalá") : t >= dur - 1 ? "Gracias" : "Listo"}</span></div>{src && <audio {...props} />}</div>}
        <div>
          <div className="barra"><i style={{ width: (t / dur) * 100 + "%" }} /></div>
          <div className="tiempos"><span>{fmt(t)}</span><span>-{fmt(dur - t)}</span></div>
        </div>
        <div className="controles">
          <button className="icono" onClick={() => mover(-15)} aria-label="Retroceder 15 segundos">↺</button>
          <button className="play" onClick={alternar} disabled={cargando} aria-label={sonando ? "Pausar" : "Reproducir"}>{sonando ? "❚❚" : "▶"}</button>
          <button className="icono" onClick={() => mover(15)} aria-label="Adelantar 15 segundos">↻</button>
        </div>
        {!src && !cargando && <p className="nota">Modo demostración: todavía no hay audio cargado para esta meditación.</p>}
      </div>
    </div>
  );
}
