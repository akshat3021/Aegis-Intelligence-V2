"use client";
import { useEffect, useRef, Suspense } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { useGLTF, useAnimations, Float, OrbitControls, Environment, ContactShadows } from "@react-three/drei";
import * as THREE from "three";

function ModelSelector({ companionId, isThinking, lastPoke }: { companionId: string, isThinking: boolean, lastPoke: number }) {
  const slime = useGLTF("/slime.glb");
  const spark = useGLTF("/spark.glb");
  const eva = useGLTF("/eva.glb");

  const slimeAnims = useAnimations(slime.animations, slime.scene);
  const sparkAnims = useAnimations(spark.animations, spark.scene);
  const evaAnims = useAnimations(eva.animations, eva.scene);

  // --- 1. ORIENTATION CONFIGURATION ---
  // Spark & Squish face away in GLB, so we flip them 180 (Math.PI)
  // We also fixed Spark's Z-tilt by ensuring rotation[2] is strictly 0
  const config = {
    spark: { scale: 0.75, pos: [0, -1.2, -1], rot: [0, -1.5, 0] },
    eva: { scale: 0.9, pos: [0, -1.2, -1], rot: [0, 0, 0] }, 
    squish: { scale: 1.8, pos: [0, -0.8, 1.5], rot: [0, Math.PI, 0] }
  };

  const active = config[companionId as keyof typeof config] || config.squish;
  const scene = companionId === "spark" ? spark.scene : companionId === "eva" ? eva.scene : slime.scene;

  // --- 2. CORE ANIMATION LOGIC ---
  useEffect(() => {
    const playAnim = (actions: any, name: string) => {
      if (!actions || Object.keys(actions).length === 0) return;
      
      // Fallback: If specific name isn't found, pick the first animation clip
      const clip = actions[name] || Object.values(actions)[0] as any;
      
      Object.values(actions).forEach((a: any) => a.fadeOut(0.5));
      if (clip) clip.reset().fadeIn(0.5).play();
    };

    if (companionId === "eva" && evaAnims.actions) {
      playAnim(evaAnims.actions, isThinking ? "Arranque" : "Idle.1");
    } 
    else if (companionId === "spark" && sparkAnims.actions) {
      playAnim(sparkAnims.actions, isThinking ? "Wave" : "Jump");
    } 
    else if (companionId === "squish" && slimeAnims.actions) {
      // Mapping specific names from your Sketchfab screenshot
      playAnim(slimeAnims.actions, isThinking ? "Inkchar1_Jump" : "Inkchar1_Idle");
    }
  }, [isThinking, companionId, sparkAnims, evaAnims, slimeAnims]);

  // --- 3. POKE INTERACTION LOGIC ---
  useEffect(() => {
    if (lastPoke === 0) return;
    
    const currentActions = 
      companionId === "eva" ? evaAnims.actions : 
      companionId === "spark" ? sparkAnims.actions : 
      slimeAnims.actions;

    if (currentActions) {
      // Find the best "reaction" clip
      const pokeClip = currentActions.Jump || currentActions.Inkchar1_Jump || currentActions.Arranque || Object.values(currentActions)[0] as any;
      
      if (pokeClip) {
        pokeClip.reset().setLoop(THREE.LoopOnce, 1).play();
        
        // Return to base animation after poke finishes (approx 1s)
        const timeout = setTimeout(() => {
          const baseName = companionId === "eva" ? (isThinking ? "Arranque" : "Idle.1") : 
                           companionId === "spark" ? (isThinking ? "Wave" : "Jump") :
                           (isThinking ? "Inkchar1_Jump" : "Inkchar1_Idle");
          
          const baseClip = currentActions[baseName] || Object.values(currentActions)[0] as any;
          if (baseClip) baseClip.reset().fadeIn(0.5).play();
        }, 1000);

        return () => clearTimeout(timeout);
      }
    }
  // Bug #19 fix: isThinking was used inside this effect (in the base animation
  // fallback after poke) but missing from deps — caused stale closure where
  // wrong animation played if isThinking state changed since last render.
  }, [lastPoke, isThinking, companionId, evaAnims.actions, sparkAnims.actions, slimeAnims.actions]);

  return <primitive object={scene} scale={active.scale} position={active.pos} rotation={active.rot} />;
}

// --- 4. CAMERA RIG (Auto-centering logic) ---
function Rig() {
  const controlsRef = useRef<any>(null);
  useFrame(() => {
    if (controlsRef.current && !controlsRef.current.active) {
      const alpha = 0.08; 
      controlsRef.current.setAzimuthalAngle(THREE.MathUtils.lerp(controlsRef.current.getAzimuthalAngle(), 0, alpha));
      controlsRef.current.setPolarAngle(THREE.MathUtils.lerp(controlsRef.current.getPolarAngle(), Math.PI / 2, alpha));
      controlsRef.current.update();
    }
  });
  return <OrbitControls ref={controlsRef} enableZoom={false} enablePan={false} makeDefault />;
}

export default function Companion3D(props: any) {
  return (
    // Bug #1 fix: replaced Tailwind classes (w-full, h-full) with inline styles.
    // This project uses inline styles, not Tailwind, so class names were no-ops.
    <div style={{ width: "100%", height: "100%", cursor: "pointer", pointerEvents: "auto" }} onClick={props.onPoke}>
      <Canvas camera={{ position: [0, 0, 5], fov: 35 }}>
        <ambientLight intensity={0.8} />
        <pointLight position={[10, 10, 10]} intensity={1.5} color={props.activeColor} />
        <Environment preset="city" />
        
        <Suspense fallback={null}>
          <Float 
            speed={props.isThinking ? 4 : 1.5} 
            rotationIntensity={0.2} 
            floatIntensity={0.5}
          >
            <ModelSelector {...props} />
          </Float>
          <ContactShadows position={[0, -1.2, 0]} opacity={0.6} scale={10} blur={2.5} far={4} />
        </Suspense>
        
        <Rig />
      </Canvas>
    </div>
  );
}

// --- 5. ASSET PRELOADING ---
useGLTF.preload("/slime.glb");
useGLTF.preload("/spark.glb");
useGLTF.preload("/eva.glb");