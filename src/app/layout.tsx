import type { Metadata, Viewport } from "next";
import "./globals.css";
import { profile } from "@/config/linktree";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1
};

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"),
  title: profile.title,
  description: profile.introDescription,
  openGraph: {
    title: profile.title,
    description: profile.introDescription,
    images: ["/assets/dorms-community.png"]
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        {/* 맥과 윈도우에서 글꼴이 달라 히어로 화면이 다르게 보이던 문제.
            같은 글꼴(Pretendard)을 어디서든 내려받게 해서 렌더링을 맞춥니다. */}
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css"
          crossOrigin="anonymous"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
