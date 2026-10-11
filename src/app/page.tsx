import type { Metadata } from "next";
import LinkTree from "@/components/LinkTree";
import { asset } from "@/lib/asset";
import { profile } from "@/config/linktree";

export const metadata: Metadata = {
  openGraph: {
    title: profile.title,
    description: profile.introDescription,
    images: [{ url: asset("/assets/brand-garden.jpg"), width: 1672, height: 941, alt: profile.title }]
  }
};

export default function Page() {
  return <LinkTree />;
}
