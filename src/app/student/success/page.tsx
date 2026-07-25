import Link from "next/link";
import AppHeader from "@/components/AppHeader";
export default function SuccessPage() { return <><AppHeader mode="student"/><main className="center-page"><div className="result-card"><div className="result-icon">✓</div><span className="eyebrow">GỬI HỒ SƠ THÀNH CÔNG</span><h1>Nhà trường đã tiếp nhận hồ sơ</h1><p>Hồ sơ đang được kiểm tra. Học sinh có thể đăng nhập lại để theo dõi trạng thái hoặc chỉnh sửa khi nhà trường yêu cầu bổ sung.</p><Link href="/student/profile" className="button button--primary">Xem trạng thái hồ sơ</Link></div></main></> }
