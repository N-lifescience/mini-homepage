"use client";

import { useEffect, useRef, useState } from "react";
import type { MotionValue } from "motion/react";
import { asset } from "@/lib/asset";
import { showroomTheme } from "@/config/showroom/theme";
import { dnaPoint, dnaBaseEndpoints, factorPosition, polymerasePosition, rnaPoint, transcriptionTimeline, smoothProgress as ease } from "@/lib/dna-geometry";

export default function DnaStage({ progress }: { progress: MotionValue<number> }) {
  const host = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [fallback, setFallback] = useState(false);

  useEffect(() => {
    const element = host.current;
    if (!element) return;
    let stopped = false;
    let cleanup = () => {};

    async function start() {
      const [THREE, { RoomEnvironment }] = await Promise.all([
        import("three"), import("three/addons/environments/RoomEnvironment.js")
      ]);
      if (stopped) return;
      let renderer: InstanceType<typeof THREE.WebGLRenderer>;
      try {
        renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "low-power" });
      } catch {
        if (!stopped) setFallback(true);
        return;
      }
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 70);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, window.innerWidth < 768 ? 1.5 : 2));
      renderer.setClearColor(0x000000, 0);
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.05;
      const environment = new RoomEnvironment();
      const pmrem = new THREE.PMREMGenerator(renderer);
      const environmentMap = pmrem.fromScene(environment, 0.04);
      scene.environment = environmentMap.texture;
      environment.dispose();
      pmrem.dispose();
      element!.appendChild(renderer.domElement);
      renderer.domElement.setAttribute("aria-hidden", "true");

      const c = showroomTheme.colors;
      const materials = [c.violet, c.gold, c.mint, c.rose, "#e6dcef"].map(color => new THREE.MeshStandardMaterial({
        color, roughness: 0.48, metalness: 0.08
      }));
      const dnaMaterials = ["#8766c5", "#b29bdb"].map(color => new THREE.MeshStandardMaterial({color, roughness:.46, metalness:.08}));
      const proteinMaterial = new THREE.MeshStandardMaterial({color:"#edab50", roughness:.56, metalness:.03});
      const rnaMaterial = new THREE.MeshStandardMaterial({color:"#f0787d", roughness:.4, metalness:.06});
      materials[2].color.set("#5ebbaa");
      const sphere = new THREE.SphereGeometry(1, 12, 8);
      const cylinder = new THREE.CylinderGeometry(1, 1, 1, 8);
      const assembly = new THREE.Group();
      assembly.rotation.z = -0.26;
      assembly.rotation.x = 0.12;
      scene.add(assembly);

      const COUNT = 190;
      const PAIRS = 36;
      const beadMeshes = dnaMaterials.map(mat => new THREE.InstancedMesh(sphere, mat, COUNT + 1));
      const railMeshes = dnaMaterials.map(mat => new THREE.InstancedMesh(cylinder, mat, COUNT));
      const pairMeshes = [materials[2], materials[3]].map(mat => new THREE.InstancedMesh(cylinder, mat, PAIRS));
      const RNA_COUNT = 34;
      const rnaBeads = new THREE.InstancedMesh(sphere, rnaMaterial, RNA_COUNT);
      const rnaRail = new THREE.InstancedMesh(cylinder, rnaMaterial, RNA_COUNT - 1);
      // A nucleotide unit is a sugar bead with one colored base. RNA has one backbone.
      // Free NTPs use this same unit, with phosphate groups omitted from the artwork.
      const baseGeometry = new THREE.CapsuleGeometry(.055, .14, 4, 8);
      baseGeometry.rotateZ(Math.PI / 2);
      const baseMaterial = new THREE.MeshStandardMaterial({color:"#ffffff", roughness:.46, metalness:.04});
      const rnaBases = new THREE.InstancedMesh(baseGeometry, baseMaterial, RNA_COUNT);
      const baseColors = ["#ad8fdd", "#65bea8", "#dd98b5", "#edba68"].map(color => new THREE.Color(color));
      for (let i = 0; i < RNA_COUNT; i++) rnaBases.setColorAt(i, baseColors[i % 4]);
      const meshes = [...beadMeshes, ...railMeshes, ...pairMeshes, rnaBeads, rnaRail, rnaBases];
      meshes.forEach(mesh => {
        mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        mesh.frustumCulled = false;
        assembly.add(mesh);
      });

      // An abstract, multi-lobed protein body with a cleft for the DNA template.
      // These are art objects, not atomistic molecular structures.
      const polymerase = new THREE.Group();
      const proteinLobes: [number, number, number, number, number, number][] = [
        [-0.68, 0.08, 0.02, 0.68, 0.93, 0.62],
        [0.68, 0.16, 0.02, 0.66, 0.84, 0.62],
        [0.04, -0.63, -0.2, 0.92, 0.48, 0.66],
        [-0.48, 0.73, -0.14, 0.44, 0.38, 0.5],
        [0.53, 0.70, -0.16, 0.43, 0.37, 0.45],
        [0.04, -0.1, -0.55, 0.87, 0.84, 0.36]
      ];
      proteinLobes.forEach(([x, y, z, sx, sy, sz]) => {
        const lobe = new THREE.Mesh(sphere, proteinMaterial);
        lobe.position.set(x, y, z); lobe.scale.set(sx, sy, sz);
        polymerase.add(lobe);
      });
      // Dense, irregular surface beads give the protein the molecular texture in the references.
      const ATOMS_PER_LOBE = 190;
      const proteinSurface = new THREE.InstancedMesh(sphere, proteinMaterial, proteinLobes.length * ATOMS_PER_LOBE);
      const atom = new THREE.Object3D();
      const proteinColors = ["#f4bd54", "#ef933d", "#f8ce69", "#dc763b"].map(color => new THREE.Color(color));
      proteinLobes.forEach(([x, y, z, sx, sy, sz], lobeIndex) => {
        for (let i = 0; i < ATOMS_PER_LOBE; i++) {
          const latitude = Math.max(-.99, Math.min(.99, 1 - 2 * ((i + .5) / ATOMS_PER_LOBE) + Math.sin(i * 11.79) * .045));
          const longitude = i * 2.39996 + lobeIndex + Math.sin(i * 8.31) * .13;
          const ring = Math.sqrt(1 - latitude * latitude);
          const jitter = 1 + Math.sin(i * 13.37 + lobeIndex) * .08;
          atom.position.set(x + Math.cos(longitude) * ring * sx * jitter, y + latitude * sy * jitter, z + Math.sin(longitude) * ring * sz * jitter);
          const radius = .068 + ((Math.sin(i * 7.23) + 1) / 2) * .076;
          atom.scale.set(radius, radius * 1.1, radius * .9);
          atom.updateMatrix();
          const index = lobeIndex * ATOMS_PER_LOBE + i;
          proteinSurface.setMatrixAt(index, atom.matrix);
          proteinSurface.setColorAt(index, proteinColors[Math.floor((Math.sin(i * 9.23 + lobeIndex) + 1) * 1.99)]);
        }
      });
      polymerase.add(proteinSurface);
      assembly.add(polymerase);

      const factors = new THREE.Group();
      [-1, 1].forEach((side, index) => {
        const factor = new THREE.Group();
        [[0, 0, 0, 0.36], [side * .22, .28, .02, .27], [-side * .17, -.25, .07, .25]].forEach(([x, y, z, radius]) => {
          const lobe = new THREE.Mesh(sphere, materials[2]);
          lobe.position.set(x, y, z); lobe.scale.set(radius, radius * .8, radius);
          factor.add(lobe);
          for (let i = 0; i < 22; i++) {
            const bead = new THREE.Mesh(sphere, materials[2]);
            const angle = i * 2.39996;
            const height = 1 - 2 * ((i + .5) / 22);
            const ring = Math.sqrt(1 - height * height);
            bead.position.set(x + Math.cos(angle) * ring * radius, y + height * radius * .8, z + Math.sin(angle) * ring * radius);
            bead.scale.setScalar(.067);
            factor.add(bead);
          }
        });
        factor.name = `transcription-factor-${index}`;
        factors.add(factor);
      });
      assembly.add(factors);

      // Each free nucleotide matches one building unit on the emerging RNA.
      const NTP_COUNT = 24;
      const ntpBodies = new THREE.InstancedMesh(sphere, rnaMaterial, NTP_COUNT);
      const ntpBases = new THREE.InstancedMesh(baseGeometry, baseMaterial, NTP_COUNT);
      for (let i = 0; i < NTP_COUNT; i++) ntpBases.setColorAt(i, baseColors[i % 4]);
      const nucleotides = [ntpBodies, ntpBases];
      nucleotides.forEach(mesh => {
        mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        mesh.frustumCulled = false;
        assembly.add(mesh);
      });

      const hoopGeometry = new THREE.TorusGeometry(1.85, 0.025, 8, 100);
      const hoop = new THREE.Mesh(hoopGeometry, materials[1]);
      hoop.rotation.x = Math.PI / 2;
      hoop.position.y = -4.65;
      assembly.add(hoop);
      const hoop2 = hoop.clone();
      hoop2.scale.setScalar(0.84);
      hoop2.position.y = -4.8;
      assembly.add(hoop2);
      scene.add(new THREE.HemisphereLight(0xece2ff, 0x3d2359, 2.4));
      const key = new THREE.DirectionalLight(0xffdfb3, 3.6);
      key.position.set(3, 5, 7);
      scene.add(key);
      const rim = new THREE.DirectionalLight(0xbda4ff, 4);
      rim.position.set(-4, 2, -3);
      scene.add(rim);

      const dummy = new THREE.Object3D();
      const up = new THREE.Vector3(0, 1, 0);
      const vector = new THREE.Vector3();
      const a = new THREE.Vector3();
      const b = new THREE.Vector3();
      const tangent = new THREE.Vector3();
      const baseSide = new THREE.Vector3();
      const previous = new THREE.Vector3();
      const forward = new THREE.Vector3(0, 0, 1);
      const points = [Array.from({ length: COUNT + 1 }, () => new THREE.Vector3()), Array.from({ length: COUNT + 1 }, () => new THREE.Vector3())];

      function ball(mesh: InstanceType<typeof THREE.InstancedMesh>, index: number, position: InstanceType<typeof THREE.Vector3>, radius: number) {
        dummy.position.copy(position);
        dummy.quaternion.identity();
        dummy.scale.setScalar(radius);
        dummy.updateMatrix();
        mesh.setMatrixAt(index, dummy.matrix);
      }
      function rod(mesh: InstanceType<typeof THREE.InstancedMesh>, index: number, from: InstanceType<typeof THREE.Vector3>, to: InstanceType<typeof THREE.Vector3>, radius: number) {
        vector.subVectors(to, from);
        dummy.position.copy(from).add(to).multiplyScalar(0.5);
        dummy.scale.set(radius, vector.length(), radius);
        dummy.quaternion.setFromUnitVectors(up, vector.normalize());
        dummy.updateMatrix();
        mesh.setMatrixAt(index, dummy.matrix);
      }

      let frame = 0;
      let visible = true;
      let idle = 0;
      let molecularTime = 0;
      let lastTime = 0;
      let smoothed = progress.get();
      let cameraDistance = 17;
      const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
      function draw(time = 0) {
        if (stopped) return;
        const reduced = motionPreference.matches;
        const dt = Math.max(1, Math.min(50, time - lastTime || 16));
        lastTime = time;
        smoothed += (progress.get() - smoothed) * (1 - Math.exp(-dt / 85));
        const p = reduced ? .72 : smoothed;
        const timeline = transcriptionTimeline(p);
        if (!reduced) molecularTime += dt * 0.00012;
        if (!reduced) idle += dt * 0.000095 * (1 - ease(0.12, 0.8, p) * 0.85);
        const twist = idle * .25;
        for (let strand = 0; strand < 2; strand++) {
          for (let i = 0; i <= COUNT; i++) {
            const s = i / COUNT;
            const position = points[strand][i].set(...dnaPoint(s, strand, p, twist));
            ball(beadMeshes[strand], i, position, .10 + Math.sin(i * 4.3) * .014);
            if (i) rod(railMeshes[strand], i - 1, points[strand][i - 1], position, 0.067);
          }
        }
        for (let i = 0; i < PAIRS; i++) {
          const s = (i + 0.5) / PAIRS;
          for (let strand = 0; strand < 2; strand++) {
            const [anchor, tip] = dnaBaseEndpoints(s, strand, p, twist);
            a.set(...anchor); b.set(...tip);
            rod(pairMeshes[strand], i, a, b, .072);
          }
        }

        const transcription = timeline.elongation;
        polymerase.position.set(...polymerasePosition(p, twist));
        polymerase.scale.setScalar(1.07);
        polymerase.rotation.y = -.07;
        factors.children.forEach((factor, index) => {
          factor.position.set(...factorPosition(index, p, twist));
          factor.rotation.z = (index ? 1 : -1) * .5;
        });
        for (let i = 0; i < NTP_COUNT; i++) {
          const seed = i * 2.39996;
          const cycle = (molecularTime * .43 + i / NTP_COUNT) % 1;
          const radius = 2.4 + (i % 5) * .34;
          a.set(Math.cos(seed + molecularTime * .2) * radius,
            -3.4 + (i / NTP_COUNT) * 7.2 + Math.sin(seed + molecularTime) * .16,
            Math.sin(seed) * 1.5);
          const intake = transcription * ease(.28, .9, cycle);
          a.lerp(polymerase.position, intake);
          const shrink = 1 - ease(.9, 1, cycle) * transcription;
          ball(ntpBodies, i, a, .085 * shrink);
          dummy.quaternion.setFromAxisAngle(up, seed + molecularTime);
          baseSide.set(-.17 * shrink, 0, 0).applyQuaternion(dummy.quaternion);
          dummy.position.copy(a).add(baseSide);
          dummy.scale.setScalar(shrink);
          dummy.updateMatrix(); ntpBases.setMatrixAt(i, dummy.matrix);
        }
        rnaBeads.visible = rnaRail.visible = rnaBases.visible = transcription > 0.01;
        const unitCount = Math.max(2, Math.ceil(RNA_COUNT * transcription));
        rnaBeads.count = rnaBases.count = unitCount;
        rnaRail.count = unitCount - 1;
        for (let i = 0; i < unitCount; i++) {
          const s = i / (unitCount - 1);
          a.set(...rnaPoint(s, p, twist, molecularTime));
          ball(rnaBeads, i, a, .085);
          if (i) rod(rnaRail, i - 1, previous, a, .028);
          b.set(...rnaPoint(Math.min(1, s + .01), p, twist, molecularTime));
          tangent.subVectors(b, a);
          if (i === unitCount - 1) tangent.subVectors(a, previous);
          baseSide.set(tangent.y, -tangent.x, 0).normalize();
          dummy.position.copy(a).addScaledVector(baseSide, .17);
          dummy.quaternion.setFromAxisAngle(forward, Math.atan2(baseSide.y, baseSide.x));
          dummy.scale.setScalar(1); dummy.updateMatrix();
          rnaBases.setMatrixAt(i, dummy.matrix);
          previous.copy(a);
        }
        meshes.forEach(mesh => { mesh.instanceMatrix.needsUpdate = true; });
        nucleotides.forEach(mesh => { mesh.instanceMatrix.needsUpdate = true; });
        assembly.rotation.y = -0.16 + p * 0.18;
        camera.position.z = cameraDistance * (1 - ease(.25, .85, p) * .12);
        camera.position.y = polymerase.position.y * ease(.15, .7, p) * .18;
        camera.lookAt(0, camera.position.y, 0);
        renderer.render(scene, camera);
        if (visible && !document.hidden && !reduced) frame = requestAnimationFrame(draw);
      }
      function resize() {
        const { width, height } = element!.getBoundingClientRect();
        camera.aspect = width / Math.max(1, height);
        // Frame the separated strands, full-length bases, and trailing RNA on narrow screens.
        cameraDistance = Math.max(17, 5.8 / (Math.tan(THREE.MathUtils.degToRad(17)) * camera.aspect));
        camera.position.set(0, 0, cameraDistance);
        camera.updateProjectionMatrix();
        renderer.setSize(width, height);
        if (motionPreference.matches) draw();
      }
      const observer = new ResizeObserver(resize);
      observer.observe(element!);
      const intersection = new IntersectionObserver(([entry]) => {
        visible = entry.isIntersecting;
        cancelAnimationFrame(frame);
        if (visible && !document.hidden) { lastTime = 0; draw(); }
      });
      intersection.observe(element!);
      function visibility() {
        cancelAnimationFrame(frame);
        if (visible && !document.hidden) { lastTime = 0; draw(); }
      }
      document.addEventListener("visibilitychange", visibility);
      motionPreference.addEventListener("change", visibility);
      resize();
      setReady(true);
      cleanup = () => {
        cancelAnimationFrame(frame);
        observer.disconnect();
        intersection.disconnect();
        document.removeEventListener("visibilitychange", visibility);
        motionPreference.removeEventListener("change", visibility);
        sphere.dispose(); cylinder.dispose(); hoopGeometry.dispose(); baseGeometry.dispose();
        [...meshes, ...nucleotides, proteinSurface].forEach(mesh => mesh.dispose());
        [...materials, ...dnaMaterials, proteinMaterial, rnaMaterial, baseMaterial].forEach(mat => mat.dispose());
        environmentMap.dispose();
        renderer.dispose();
        renderer.domElement.remove();
      };
    }
    start().catch(() => { if (!stopped) setFallback(true); });
    return () => { stopped = true; cleanup(); };
  }, [progress]);

  return <div className={`sr-dna-stage${ready ? " is-ready" : ""}${fallback ? " is-fallback" : ""}`} aria-hidden="true">
    <div className="sr-dna-halo" />
    <img className="sr-dna-poster" src={asset("/visuals/showroom/dna.webp")} alt="" width={960} height={1200} fetchPriority="high" />
    <div ref={host} className="sr-dna-canvas" />
  </div>;
}
