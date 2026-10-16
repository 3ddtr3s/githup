import React from "https://esm.sh/react@18.3.1";
import { createRoot } from "https://esm.sh/react-dom@18.3.1/client";
import CharacterScene from "./CharacterScene.js";

const h = React.createElement;
const mount = document.getElementById("characterSceneMount");

function CharacterSceneMount() {
    return h(CharacterScene, { modelUrl: "./assets/3ddtr3s-model.glb" });
}

if (mount) createRoot(mount).render(h(CharacterSceneMount));
