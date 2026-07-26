import type { Metadata } from "next";
import { Be_Vietnam_Pro } from "next/font/google";
import { connection } from "next/server";
import "./globals.css";

const beVietnamPro = Be_Vietnam_Pro({ 
  subsets: ["latin", "vietnamese"], 
  weight: ["400", "500", "600", "700", "800"] 
});

export const metadata: Metadata = {
  title: { default: "Nhập học trực tuyến", template: "%s | Nhập học trực tuyến" },
  description: "Hệ thống tiếp nhận và quản lý hồ sơ nhập học lớp 10 trực tuyến.",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // A strict nonce-based CSP requires a fresh server-rendered document for
  // every request so Next.js can apply the request nonce to framework scripts.
  await connection();
  return (
    <html lang="vi">
      <body className={`${beVietnamPro.className} app-shell`}>
        <div className="app-shell__content">
          {children}
        </div>
        <footer className="footer"><div className="container">Hệ thống nhập học trực tuyến</div></footer>
      </body>
    </html>
  );
}
