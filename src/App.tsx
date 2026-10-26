import { createContext, useContext, useEffect, useState } from "react";
import { BrowserRouter, Link, Route, Routes } from "react-router-dom";
import type { Session } from "@supabase/supabase-js";
import { demo, sb } from "./lib/api";
import Inicio from "./pages/Inicio";
import Entrar from "./pages/Entrar";
import Pago from "./pages/Pago";
import Admin from "./pages/Admin";

const SesionCtx = createContext<Session | null>(null);
export const useSesion = () => useContext(SesionCtx);

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [esAdmin, setEsAdmin] = useState(false);

  useEffect(() => {
    if (!sb) return;
    sb.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = sb.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!sb || !session) { setEsAdmin(false); return; }
    sb.rpc("is_admin").then(({ data }) => setEsAdmin(!!data));
  }, [session]);

  return (
    <SesionCtx.Provider value={session}>
      <BrowserRouter>
        <div className="app">
          <header className="arriba">
            <Link to="/" className="marca">Meditación con propósito</Link>
            {demo ? <span className="meta">Demostración</span>
              : session ? <span className="fila">{esAdmin && <Link to="/admin" className="link">Panel</Link>}<button className="link" onClick={() => sb!.auth.signOut()}>Salir</button></span>
              : <Link to="/entrar" className="link">Entrar</Link>}
          </header>
          <Routes>
            <Route path="/" element={<Inicio />} />
            <Route path="/entrar" element={<Entrar />} />
            <Route path="/pago" element={<Pago />} />
            <Route path="/admin" element={<Admin />} />
          </Routes>
        </div>
      </BrowserRouter>
    </SesionCtx.Provider>
  );
}
