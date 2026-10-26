import { useState } from "react";
import { sb } from "../lib/api";

export default function Entrar() {
  const [email, setEmail] = useState("");
  const [enviado, setEnviado] = useState(false);
  const [error, setError] = useState("");

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const { error } = await sb!.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin } });
    if (error) setError("No pudimos enviarte el correo. Revisá la dirección y probá de nuevo.");
    else setEnviado(true);
  };

  if (!sb) return <p className="lead">En la demostración no hace falta entrar.</p>;
  if (enviado) return <section><h2>Revisá tu correo</h2><p className="lead">Te mandamos un link a {email}. Abrilo desde este mismo teléfono para entrar.</p></section>;

  return (
    <form className="form" onSubmit={enviar}>
      <h2>Entrar</h2>
      <p className="lead">Con tu correo guardamos tus meditaciones y tus vivos. No hace falta contraseña.</p>
      <label htmlFor="email">Correo</label>
      <input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@correo.com" />
      {error && <p className="aviso">{error}</p>}
      <button className="btn">Enviarme el link</button>
    </form>
  );
}
