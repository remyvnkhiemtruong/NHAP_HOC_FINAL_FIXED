import Image from "next/image";
import Link from "next/link";

export default function SchoolBrand({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className={`brand ${compact ? "brand--compact" : ""}`} aria-label="Trang chủ THPT Võ Văn Kiệt">
      <Image src="/logo.png" alt="Logo THPT Võ Văn Kiệt" width={compact ? 38 : 48} height={compact ? 38 : 48} priority unoptimized />
      <span>
        <small>SỞ GIÁO DỤC VÀ ĐÀO TẠO CÀ MAU</small>
        <strong>TRƯỜNG THPT VÕ VĂN KIỆT</strong>
      </span>
    </Link>
  );
}
