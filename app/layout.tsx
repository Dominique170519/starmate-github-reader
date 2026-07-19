import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const headerStore = await headers();
  const host = headerStore.get("x-forwarded-host") || headerStore.get("host") || "localhost:3000";
  const protocol = headerStore.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
  const origin = `${protocol}://${host}`;
  const title = "星伴读｜让 GitHub 收藏持续生长";
  const description = "面向非技术背景用户的 GitHub AI 伴读工具：从无痛入门开始，把不断增长的收藏整理成主题、关系、路线和复习计划。";

  return {
    title,
    description,
    icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
    openGraph: { title, description, images: [{ url: `${origin}/og-v2.png`, width: 1734, height: 907, alt: "星伴读：让 GitHub 收藏持续生长，非技术背景也能无痛入门" }] },
    twitter: { card: "summary_large_image", title, description, images: [`${origin}/og-v2.png`] },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
