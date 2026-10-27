import { useState } from "react";
import { useSesion } from "../App";
import { ars, enviarComprobante, iniciarTransferencia, type Transferencia } from "../lib/api";
import { Mariposa } from "./Decoracion";

type Props = {
  producto: string; titulo: string; monto: number; hayAlias: boolean;
  onMercadoPago: () => void; onCerrar: () => void; onEnviado: () => void;
};

// Hoja para elegir cómo pagar: Mercado Pago (al instante) o transferencia al alias (Paula la aprueba).
export default function Compra({ producto, titulo, monto, hayAlias, onMercadoPago, onCerrar, onEnviado }: Props) {
  const session = useSesion();
  const [datos, setDatos] = useState<Transferencia | null>(null);
  const [archivo, setArchivo] = useState<File | null>(null);
  const [paso, setPaso] = useState<"elegir" | "transferir" | "listo">("elegir");
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState("");
  const [copiado, setCopiado] = useState(false);

  const transferir = async () => {
    setError(""); setOcupado(true);
    try { setDatos(await iniciarTransferencia(producto, titulo, monto)); setPaso("transferir"); }
    catch (e) { setError((e as Error).message); }
    setOcupado(false);
  };

  const copiar = async () => {
    try { await navigator.clipboard.writeText(datos!.alias); setCopiado(true); setTimeout(() => setCopiado(false), 2000); } catch { /* sin portapapeles */ }
  };

  const enviar = async () => {
    if (!archivo) return setError("Elegí la foto o el PDF del comprobante.");
    setError(""); setOcupado(true);
    try { await enviarComprobante(datos!.orden, archivo, session); setPaso("listo"); onEnviado(); }
    catch (e) { setError((e as Error).message); }
    setOcupado(false);
  };

  return (
    <div className="hoja" role="dialog" aria-modal="true" aria-labelledby="compra-titulo">
      <div className="hoja-in">
        <div className="hoja-barra"><button className="icono" onClick={onCerrar} aria-label="Cerrar">✕</button></div>
        <div className="compra-cabeza">
          <Mariposa tam={34} />
          <span className="eyebrow">Tu compra</span>
          <h2 id="compra-titulo">{titulo}</h2>
          <span className="precio">{ars(monto)}</span>
        </div>
        {error && <p className="aviso">{error}</p>}

        {paso === "elegir" && <div className="opciones">
          <button className="opcion" onClick={onMercadoPago} disabled={ocupado}>
            <b>Pagar con Mercado Pago</b>
            <span className="meta">Tarjeta, débito o dinero en cuenta. Se habilita al instante.</span>
          </button>
          {hayAlias && <button className="opcion" onClick={transferir} disabled={ocupado}>
            <b>Transferir a mi alias</b>
            <span className="meta">Desde tu banco o billetera. Subís el comprobante y se habilita cuando Paula lo confirma.</span>
          </button>}
        </div>}

        {paso === "transferir" && datos && <div className="opciones">
          <div className="alias">
            <span className="meta">1. Transferí {ars(datos.monto)} a este alias</span>
            <div className="fila"><b className="alias-texto">{datos.alias}</b><button className="btn chico borde" onClick={copiar}>{copiado ? "¡Copiado!" : "Copiar"}</button></div>
            {datos.titular && <span className="meta">A nombre de {datos.titular}</span>}
          </div>
          <label className="alias subir">
            <span className="meta">2. Subí la captura o el PDF del comprobante</span>
            <input type="file" accept="image/*,application/pdf" onChange={(e) => setArchivo(e.target.files?.[0] ?? null)} />
          </label>
          <button className="btn dorado" onClick={enviar} disabled={ocupado}>{ocupado ? "Enviando…" : "Enviar comprobante"}</button>
        </div>}

        {paso === "listo" && <div className="compra-cabeza">
          <p className="lead">¡Recibido! Paula revisa la transferencia y en cuanto la confirme se habilita sola en tu app.</p>
          <button className="btn" onClick={onCerrar}>Volver</button>
        </div>}
      </div>
    </div>
  );
}
