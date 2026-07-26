import Link from "next/link";
import AppHeader from "@/components/AppHeader";
import { activeCampaign } from "@/lib/campaign";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const campaign = await activeCampaign();
  return (
    <>
      <AppHeader />
      <main>
        <section className="hero">
          <div className="container hero__grid">
            <div>
              <span className="eyebrow">NĂM HỌC {campaign.school_year_start}–{campaign.school_year_end}</span>
              <h1>Hệ thống nhập học trực tuyến lớp 10</h1>
              <p className="hero__lead">{campaign.school_name} · Nhập học ngày {campaign.admission_date.toLocaleDateString("vi-VN")}</p>

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
    </>
  );
}
