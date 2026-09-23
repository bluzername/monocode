import React, { useLayoutEffect } from "react";
import ReactDOM from "react-dom/client";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import App from "./app/App";
import { activateWindowAppearance, initAppearance } from "./features/settings/model/appearance";
import { initSounds } from "./features/settings/model/sounds";
import {
  abortQuit,
  askQuitConfirmation,
  commitQuit,
  loadBootWorkspace,
  reportQuitPoll,
} from "./app/model/appLifecycle";
import { settleWithin } from "./shared/lib/concurrent";
import { homeDir } from "./platform/tauri/fs";
import { setHomeDir } from "./shared/lib/paths";
import { consumeInstalledUpdate } from "./app/model/updateNotice";
import "./styles/index.css";

initAppearance();
initSounds();
// Prime the real home directory once so `~/` file references resolve exactly
// rather than only being inferred from a session's cwd. Best-effort: a
// project outside a recognisable home still falls back to that inference if
// this IPC call is ever unavailable or slow.
const homeDirPrimed = homeDir()
  .then(setHomeDir)
  .catch(() => {});
// `setHomeDir` only updates module state - it does not make an already
// rendered activity row rerender. Boot must wait for this to settle (or give
// up on it) before the first render, or a `~/` row painted from that first
// render can be stuck unresolved for the rest of the session. Capped so a
// slow or hung IPC call can not stall boot itself; if it does resolve later,
// `setHomeDir` above still runs and primes anything rendered from then on.
const HOME_DIR_BOOT_TIMEOUT_MS = 1000;
const homeDirReady = settleWithin(homeDirPrimed, HOME_DIR_BOOT_TIMEOUT_MS);

function dismissBootSplash() {
  const splash = document.getElementById("boot-splash");
  if (!splash || splash.dataset.dismissed === "1") return;
  splash.dataset.dismissed = "1";
  const fade = () => {
    activateWindowAppearance();
    splash.classList.add("boot-splash-out");
    window.setTimeout(() => splash.remove(), 180);
  };
  // useLayoutEffect runs before paint. Two frames later the app is on
  // screen, so the fade reveals UI instead of the desktop blur.
  requestAnimationFrame(() => {
    requestAnimationFrame(fade);
  });
}

function BootGate({ children }: { children: React.ReactNode }) {
  useLayoutEffect(() => {
    dismissBootSplash();
  }, []);
  return children;
}

void listen<number>("quit_poll", (event) => {
  void reportQuitPoll(event.payload);
});
// Scoped to this window on purpose: a global `listen` is registered as `Any`,
// which Tauri matches for every event regardless of the emitter's target, so
// one dialog would become one per window.
void getCurrentWebviewWindow().listen<{ id: number; inFlight: number }>(
  "quit_confirm",
  (event) => {
    void askQuitConfirmation(event.payload.id, event.payload.inFlight);
  },
);
void listen<number>("quit_commit", (event) => {
  void commitQuit(event.payload);
});
void listen("quit_aborted", () => {
  abortQuit();
});

void Promise.all([homeDirReady, loadBootWorkspace()]).then(
  ([, { windowTransfer, resumed, history, historyCwd }]) => {
    const installedUpdate = windowTransfer ? null : consumeInstalledUpdate();
    ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
      <React.StrictMode>
        <BootGate>
          <App
            windowTransfer={windowTransfer}
            resumed={resumed}
            installedUpdate={installedUpdate}
            history={history}
            historyCwd={historyCwd}
          />
        </BootGate>
      </React.StrictMode>,
    );
  },
);
