import { Capacitor } from "@capacitor/core";
import { App as NativeApp } from "@capacitor/app";

// Bouton retour d'Android : l'écran affiché peut l'intercepter (événement « cardlearn:back »,
// annulable) pour revenir en arrière ; sinon l'appli se ferme.
export function setupBackButton() {
  if (Capacitor.getPlatform() !== "android") return;
  NativeApp.addListener("backButton", () => {
    const event = new CustomEvent("cardlearn:back", { cancelable: true });
    window.dispatchEvent(event);
    if (!event.defaultPrevented) NativeApp.exitApp();
  }).catch(() => {});
}
