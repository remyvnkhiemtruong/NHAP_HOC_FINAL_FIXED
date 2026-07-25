import type { Metadata } from "next";
import { Be_Vietnam_Pro } from "next/font/google";
import "./globals.css";

const beVietnamPro = Be_Vietnam_Pro({ 
  subsets: ["latin", "vietnamese"], 
  weight: ["400", "500", "600", "700", "800"] 
});

export const metadata: Metadata = {
  title: { default: "Nhập học trực tuyến | THPT Võ Văn Kiệt", template: "%s | THPT Võ Văn Kiệt" },
  description: "Hệ thống tiếp nhận và quản lý hồ sơ nhập học lớp 10 trực tuyến.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi">
      <body className={beVietnamPro.className} style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          {children}
        </div>
        <footer className="footer"><div className="container">© 2026 Trường THPT Võ Văn Kiệt · Hệ thống nhập học trực tuyến - Copyright 2026 by Truong Minh Khiem</div></footer>
      </body>
    </html>
  );
}
