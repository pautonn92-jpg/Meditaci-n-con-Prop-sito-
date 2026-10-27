import type { Vivo } from "./api";

// Recordatorios del vivo en el calendario del teléfono: Google Calendar o un archivo .ics (iPhone y otros).
const SITIO = "https://meditacion-con-proposito.netlify.app";
const utc = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const rango = (v: Vivo) => {
  const ini = new Date(v.empieza);
  return [utc(ini), utc(new Date(ini.getTime() + v.duracion_min * 60e3))];
};
const detalle = `Meditación en vivo con Reiki con Pau Tonn. El link para entrar está en la app: ${SITIO}`;

export function linkGoogle(v: Vivo) {
  const [a, b] = rango(v);
  const q = new URLSearchParams({ action: "TEMPLATE", text: v.titulo, dates: `${a}/${b}`, details: detalle, location: SITIO });
  return "https://calendar.google.com/calendar/render?" + q.toString();
}

export function bajarIcs(v: Vivo) {
  const [a, b] = rango(v);
  const ics = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Meditacion con proposito//ES", "BEGIN:VEVENT",
    `UID:${v.id}@meditacion-con-proposito`, `DTSTAMP:${utc(new Date())}`, `DTSTART:${a}`, `DTEND:${b}`,
    `SUMMARY:${v.titulo}`, `DESCRIPTION:${detalle}`, `URL:${SITIO}`,
    "BEGIN:VALARM", "TRIGGER:-PT30M", "ACTION:DISPLAY", "DESCRIPTION:En 30 minutos meditamos juntas 🦋", "END:VALARM",
    "BEGIN:VALARM", "TRIGGER:-PT3H", "ACTION:DISPLAY", "DESCRIPTION:Hoy hay meditación en vivo con Reiki 🦋", "END:VALARM",
    "END:VEVENT", "END:VCALENDAR",
  ].join("\r\n");
  const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar" }));
  const a2 = document.createElement("a");
  a2.href = url; a2.download = "vivo-meditacion.ics"; a2.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
