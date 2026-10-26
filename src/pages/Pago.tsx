import { Link, useSearchParams } from "react-router-dom";

// Mercado Pago vuelve acá después de pagar. El acceso lo habilita el aviso del servidor,
// así que esta página solo informa.
export default function Pago() {
  const [q] = useSearchParams();
  const estado = q.get("demo") ? "approved" : q.get("status") ?? q.get("collection_status");

  const texto = estado === "approved"
    ? { t: "¡Pago aprobado!", d: "Ya se habilitaron tus vivos y sus meditaciones cortas. El link de cada vivo aparece en la tarjeta del viernes." }
    : estado === "pending" || estado === "in_process"
    ? { t: "Pago en proceso", d: "Mercado Pago todavía lo está confirmando. Apenas se apruebe, se habilita solo." }
    : { t: "El pago no se completó", d: "No se te cobró nada. Podés intentarlo de nuevo cuando quieras." };

  return (
    <section>
      <h2>{texto.t}</h2>
      <p className="lead">{texto.d}</p>
      <Link className="btn" to="/" style={{ alignSelf: "flex-start" }}>Volver al inicio</Link>
    </section>
  );
}
