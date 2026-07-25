import Link from "next/link";
import AppHeader from "@/components/AppHeader";

export default function HomePage() {
  return (
    <>
      <AppHeader />
      <main>
        <section className="hero">
          <div className="container hero__grid">
            <div>
              <span className="eyebrow">NĂM HỌC 2026–2027</span>
              <h1>Hệ thống nhập học trực tuyến lớp 10</h1>

              <div className="hero__actions">
                <Link className="button button--primary" href="/student/login">Bắt đầu nhập học</Link>
                <Link className="button button--secondary" href="/admin/login">Quản trị viên</Link>
              </div>

            </div>
            <div className="hero-card" aria-label="Quy trình nhập học">
              <div className="hero-card__top"><span>Tiến trình hồ sơ</span><strong>9 bước</strong></div>
              {["Xác thực học sinh", "Kiểm tra thông tin", "Thông tin cư trú", "Gia đình & liên hệ", "Tải ảnh hồ sơ", "Rà soát và gửi"].map((item, index) => (
                <div className="mini-step" key={item}><b>{index + 1}</b><span>{item}</span><em>{index < 1 ? "Hoàn thành" : ""}</em></div>
              ))}
            </div>
          </div>
        </section>
        
      </main>
      <footer className="footer"><div className="container">© 2026 Trường THPT Võ Văn Kiệt · Hệ thống nhập học trực tuyến</div></footer>
    </>
  );
}
