import excalifontRegularUrl from "@excalidraw/excalidraw/fonts/Excalifont/Excalifont-Regular-a88b72a24fb54c9f94e3b5fdaa7481c9.woff2";

let injected = false;

// Excalifont is normally registered lazily by the canvas editor (via the
// Fonts.init() pipeline tied to a mounted Scene), so screens rendered before
// a workspace loads — like the sign-in screen — never get it. Register a
// single Latin-range weight here instead, just for UI branding text.
export const loadExcalifont = () => {
  if (injected) {
    return;
  }
  injected = true;

  const style = document.createElement("style");
  style.textContent = `
    @font-face {
      font-family: "Excalifont";
      src: url(${excalifontRegularUrl}) format("woff2");
      font-weight: 400;
      font-display: swap;
    }
  `;
  document.head.appendChild(style);
};
