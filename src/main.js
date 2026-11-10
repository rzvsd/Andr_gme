import "@fontsource/eb-garamond/latin-400.css";
import "@fontsource/eb-garamond/latin-400-italic.css";
import "@fontsource/eb-garamond/latin-600.css";
import "@fontsource/eb-garamond/greek-400-italic.css";
import "@fontsource/cormorant-garamond/latin-600.css";
import "@fontsource/cormorant-garamond/latin-500-italic.css";
import "./styles.css";
import { start, debug } from "./ui/app.js";

// The sheet is drawn on a canvas, so the type must be there before the first plate is painted.
const faces = ['italic 20px "EB Garamond"', '20px "EB Garamond"', '600 20px "Cormorant Garamond"', 'italic 500 20px "Cormorant Garamond"'];
const fonts = Promise.all(faces.map((f) => document.fonts.load(f, "Plate αω")));
await Promise.race([fonts, new Promise((done) => setTimeout(done, 1500))]);
await start();

if (import.meta.env.PROD && "serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js").catch(() => {});
}

if (import.meta.env.DEV) {
  const { store } = await import("./game/store.js");
  const { audio, measure } = await import("./audio/synth.js");
  window.__ink = { debug, store, audio, measure };
}
