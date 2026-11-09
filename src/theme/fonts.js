// Bundled OFL fonts (npm @fontsource packages, served from the app bundle so they work offline
// inside the Android WebView). Importing the CSS registers the @font-face rules; Vite copies the
// woff2 files into dist. Canvas text picks a face up as soon as it is loaded, so the game waits a
// short, bounded time for the two families before the first frame to avoid a fallback-font flash.
import "@fontsource/chakra-petch/600.css";
import "@fontsource/chakra-petch/700.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";

const FACES = [
  '700 32px "Chakra Petch"',
  '600 16px "Chakra Petch"',
  "500 16px Inter",
  "600 16px Inter",
  "700 16px Inter",
];

// Resolves true when every face is ready, false on timeout or when the Font Loading API is missing.
export function loadGameFonts(timeoutMs = 800) {
  if (typeof document === "undefined" || typeof document.fonts?.load !== "function") {
    return Promise.resolve(false);
  }
  const all = Promise.all(FACES.map((face) => document.fonts.load(face))).then(
    () => true,
    () => false
  );
  const timeout = new Promise((resolve) => setTimeout(() => resolve(false), Math.max(0, timeoutMs)));
  return Promise.race([all, timeout]);
}
