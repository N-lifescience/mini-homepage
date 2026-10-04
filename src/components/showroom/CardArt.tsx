"use client";

import { asset } from "@/lib/asset";
import type { ShowItem } from "./utils";

export default function CardArt({ item, sizes }: { item: ShowItem; sizes: string }) {
  return <span className={`sr-art sr-art-${item.art}`}>
    <img src={asset(`/visuals/showroom/${item.art}.webp`)} sizes={sizes} width={720} height={720} alt="" loading="lazy" decoding="async" draggable={false} />
    <span className="sr-art-orbit" aria-hidden="true" />
  </span>;
}
