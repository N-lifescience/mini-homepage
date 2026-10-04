"use client";

import { useRef } from "react";
import { motion, useMotionTemplate, useMotionValue, useReducedMotion, useSpring, useTransform } from "motion/react";
import CardArt from "./CardArt";
import type { OpenCard, ShowItem } from "./utils";

const TILT_SPRING = { stiffness: 170, damping: 18, mass: 0.6 };

type Props = {
  item: ShowItem;
  layoutId: string;
  onOpen: (open: OpenCard) => void;
  sizes: string;
  decorative?: boolean;
};

export default function ShowcaseCard({ item, layoutId, onOpen, sizes, decorative = false }: Props) {
  const ref = useRef<HTMLButtonElement>(null);
  const reduce = useReducedMotion();
  const pointerX = useMotionValue(0.5);
  const pointerY = useMotionValue(0.5);
  const rotateX = useSpring(useTransform(pointerY, [0, 1], [8, -8]), TILT_SPRING);
  const rotateY = useSpring(useTransform(pointerX, [0, 1], [-10, 10]), TILT_SPRING);
  const glareX = useTransform(pointerX, (value) => `${value * 100}%`);
  const glareY = useTransform(pointerY, (value) => `${value * 100}%`);
  const glare = useMotionTemplate`radial-gradient(circle at ${glareX} ${glareY}, rgba(255,255,255,0.22), transparent 55%)`;

  const onPointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (reduce || event.pointerType !== "mouse" || !ref.current) return;
    const box = ref.current.getBoundingClientRect();
    pointerX.set((event.clientX - box.left) / box.width);
    pointerY.set((event.clientY - box.top) / box.height);
  };
  const resetTilt = () => {
    pointerX.set(0.5);
    pointerY.set(0.5);
  };

  return (
    <motion.button
      ref={ref}
      type="button"
      layoutId={layoutId}
      className="sr-card"
      style={{ rotateX, rotateY, transformPerspective: 800, borderRadius: 16 }}
      onPointerMove={onPointerMove}
      onPointerLeave={resetTilt}
      onClick={() => onOpen({ item, layoutId, trigger: ref.current })}
      aria-haspopup="dialog"
      aria-hidden={decorative || undefined}
      tabIndex={decorative ? -1 : undefined}
    >
      <span className="sr-card-art">
        <CardArt item={item} sizes={sizes} />
      </span>
      <span className="sr-card-meta">
        <span className="sr-tag">{item.tag}</span>
        <span className="sr-card-name">{item.name}</span>
      </span>
      <motion.span className="sr-card-glare" style={{ background: glare }} aria-hidden="true" />
    </motion.button>
  );
}
