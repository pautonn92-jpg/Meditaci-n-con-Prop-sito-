# Meditación con propósito

App web que se instala en el celular. Tiene vivos semanales con Reiki, un pack del mes y meditaciones cortas que se habilitan solas cuando alguien paga con Mercado Pago.

## Cómo funciona

- **Vivo suelto** (precio `vivo`): habilita el lugar en ese vivo y su meditación corta, para siempre.
- **Pack del mes** (precio `pack_por_vivo` × cantidad de vivos del mes): habilita todos los vivos del mes y sus meditaciones cortas.
- **Meditaciones gratis**: las ve todo el mundo.
- El link de la videollamada solo lo ve quien pagó ese vivo.
- Paula carga vivos, sube audios o videos y cambia precios desde `/admin`.

Sin configurar nada, la app corre en **modo demostración** con datos de ejemplo.

## Probar en la compu

```bash
npm install
npm run dev
```

## Poner en marcha la versión real

1. Crear un proyecto en [Supabase](https://supabase.com) (gratis para empezar).
2. Correr `supabase/migrations/001_inicio.sql` en el editor SQL.
3. Cargar el correo de Paula como administradora:
   `insert into admins (email) values ('correo-de-paula@ejemplo.com');`
4. En Mercado Pago Developers, crear una aplicación y copiar el **Access Token** de producción.
5. Desplegar las funciones y cargar sus secretos:
   ```bash
   supabase functions deploy crear-pago
   supabase functions deploy mp-webhook --no-verify-jwt
   supabase secrets set MP_ACCESS_TOKEN=... SITIO_URL=https://la-direccion-de-la-app MP_WEBHOOK_SECRET=...
   ```
6. Copiar `.env.example` como `.env` y completar con la URL y la clave pública (anon) de Supabase.
7. Publicar la carpeta `dist` (`npm run build`) en Netlify, Vercel o Cloudflare Pages, con redirección de todas las rutas a `index.html`.
