import React, { Suspense, useEffect, useMemo, useRef, useState } from "https://esm.sh/react@18.3.1";
import { Canvas, useFrame, useLoader } from "https://esm.sh/@react-three/fiber@8.17.10?external=react,react-dom,three";
import * as THREE from "https://esm.sh/three@0.180.0";
import { GLTFLoader } from "https://esm.sh/three@0.180.0/examples/jsm/loaders/GLTFLoader.js";
import { OrbitControls } from "https://esm.sh/@react-three/drei@9.114.0?external=react,react-dom,three,@react-three/fiber";

const h = React.createElement;
const morphGroups = {
    smile: ["smile", "happy", "joy"],
    surprised: ["surpris", "openmouth", "mouthopen"],
    blink: ["blink", "eyelid", "eyesclosed", "closeeye"]
};

function findObject(root, names) {
    let found = null;
    root.traverse((object) => {
        if (found || !object.name) return;
        const name = object.name.toLowerCase().replace(/[._-]/g, "");
        if (names.some((item) => name.includes(item))) found = object;
    });
    return found;
}

function setMorphs(meshes, names, value) {
    meshes.forEach((mesh) => {
        const dictionary = mesh.morphTargetDictionary;
        if (!dictionary || !mesh.morphTargetInfluences) return;
        Object.keys(dictionary).forEach((key) => {
            const normalized = key.toLowerCase().replace(/[._-]/g, "");
            if (names.some((item) => normalized.includes(item))) {
                mesh.morphTargetInfluences[dictionary[key]] = value;
            }
        });
    });
}

function CharacterModel({ url, expression, materialColor, onReady }) {
    const gltf = useLoader(GLTFLoader, url);
    const root = gltf.scene;
    const mixer = useMemo(() => new THREE.AnimationMixer(root), [root]);
    const meshes = useMemo(() => {
        const result = [];
        root.traverse((object) => {
            if (object.isMesh) {
                object.castShadow = true;
                object.receiveShadow = true;
                const materials = Array.isArray(object.material) ? object.material : [object.material];
                const tintedMaterials = materials.map((source) => {
                    const material = source.clone();
                    material.map = source.map;
                    material.color.set(materialColor);
                    material.roughness = 0.42;
                    material.metalness = 0;
                    material.needsUpdate = true;
                    return material;
                });
                object.material = Array.isArray(object.material) ? tintedMaterials : tintedMaterials[0];
                result.push(object);
            }
        });
        const bounds = new THREE.Box3().setFromObject(root);
        const size = bounds.getSize(new THREE.Vector3());
        const center = bounds.getCenter(new THREE.Vector3());
        const scale = 3.3 / Math.max(size.x, size.y, size.z, 0.001);
        root.scale.setScalar(scale);
        root.position.set(-center.x * scale, -center.y * scale - 0.42, -center.z * scale);
        return result;
    }, [root, materialColor]);
    const head = useMemo(() => findObject(root, ["head", "face", "cara", "cabeza"]), [root]);
    const neck = useMemo(() => findObject(root, ["neck", "cuello"]), [root]);
    const leftEye = useMemo(() => findObject(root, ["lefteye", "eyel", "eye_l"]), [root]);
    const rightEye = useMemo(() => findObject(root, ["righteye", "eyer", "eye_r"]), [root]);
    const [pointer, setPointer] = useState({ x: 0, y: 0 });
    const baseY = useRef(root.position.y);
    const blinkTime = useRef(0);
    const nextBlink = useRef(2.5 + Math.random() * 3.5);
    const clock = useRef(0);

    useEffect(() => {
        const actions = (gltf.animations || []).map((clip) => mixer.clipAction(clip));
        actions.forEach((action) => action.play());
        onReady?.({ scene: root, animations: gltf.animations || [], meshes });
        return () => {
            actions.forEach((action) => action.stop());
            mixer.stopAllAction();
        };
    }, [gltf, mixer, root, meshes, onReady]);

    useEffect(() => {
        const move = (event) => setPointer({
            x: (event.clientX / window.innerWidth) * 2 - 1,
            y: -((event.clientY / window.innerHeight) * 2 - 1)
        });
        window.addEventListener("pointermove", move, { passive: true });
        return () => window.removeEventListener("pointermove", move);
    }, []);

    useEffect(() => {
        setMorphs(meshes, morphGroups.smile, expression === "happy" ? 0.85 : 0);
        setMorphs(meshes, morphGroups.surprised, expression === "surprised" ? 0.85 : 0);
    }, [expression, meshes]);

    useFrame((_, delta) => {
        clock.current += delta;
        mixer.update(delta);
        const target = head || neck || root;
        if (target) {
            target.rotation.y = THREE.MathUtils.lerp(target.rotation.y, pointer.x * (head || neck ? 0.18 : 0.08), 0.06);
            target.rotation.x = THREE.MathUtils.lerp(target.rotation.x, -pointer.y * (head || neck ? 0.1 : 0.05), 0.06);
        }
        [leftEye, rightEye].forEach((eye) => {
            if (!eye) return;
            eye.rotation.y = THREE.MathUtils.lerp(eye.rotation.y, pointer.x * 0.24, 0.1);
            eye.rotation.x = THREE.MathUtils.lerp(eye.rotation.x, -pointer.y * 0.16, 0.1);
        });
        if (blinkTime.current > 0) {
            blinkTime.current = Math.max(0, blinkTime.current - delta * 5);
            setMorphs(meshes, morphGroups.blink, Math.sin((1 - blinkTime.current) * Math.PI));
        } else if (clock.current > nextBlink.current) {
            clock.current = 0;
            nextBlink.current = 2.5 + Math.random() * 4.5;
            blinkTime.current = 1;
        }
        root.position.y = baseY.current + Math.sin(clock.current * 1.4) * 0.018;
    });

    return h("primitive", { object: root });
}

function CharacterScene({
    modelUrl = "./assets/3ddtr3s-model.glb",
    expression = "neutral",
    materialColor = "#ffe8dc",
    cameraPosition = [0, 0.15, 4.2],
    onReady
}) {
    const [failed, setFailed] = useState(false);
    return h("div", { className: "character-scene-canvas", role: "img", "aria-label": "Personaje 3D interactivo" },
        h(Canvas, {
            camera: { position: cameraPosition, fov: 38 },
            dpr: [1, 2],
            onCreated: ({ gl }) => gl.setClearColor(0xffffff, 0),
            onError: () => setFailed(true)
        },
            h("ambientLight", { intensity: 1.55 }),
            h("directionalLight", { position: [2, 3, 4], intensity: 1.8, color: "#fffaf2" }),
            h("directionalLight", { position: [-2, 1, 2], intensity: 0.7, color: "#dbe7ff" }),
            h(OrbitControls, {
                enablePan: false,
                enableZoom: false,
                enableDamping: true,
                dampingFactor: 0.08,
                rotateSpeed: 0.9,
                minPolarAngle: Math.PI * 0.12,
                maxPolarAngle: Math.PI * 0.88,
                minAzimuthAngle: -Math.PI,
                maxAzimuthAngle: Math.PI,
                target: [0, 0, 0]
            }),
            h(Suspense, { fallback: null }, h(CharacterModel, { url: modelUrl, expression, materialColor, onReady }))
        ),
        failed && h("div", { className: "character-scene-fallback" }, "No se pudo cargar el personaje 3D")
    );
}

export { CharacterScene };
export default CharacterScene;
