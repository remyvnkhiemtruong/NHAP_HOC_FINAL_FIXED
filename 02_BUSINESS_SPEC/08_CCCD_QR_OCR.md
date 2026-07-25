# QUÉT QR, OCR VÀ MRZ TRÊN CĂN CƯỚC

## 1. Phạm vi quét

Sau khi học sinh tải hai ảnh:

- quét QR trên ảnh mặt trước;
- quét QR trên ảnh mặt sau;
- không giả định QR chỉ nằm ở một mặt;
- nếu cả hai mặt có QR, lưu cả hai kết quả và cảnh báo nếu khác nhau.

## 2. Kết quả QR

Lưu:

- `raw_payload`;
- mặt chứa QR;
- thời gian quét;
- thư viện/phiên bản decoder;
- trạng thái thành công/thất bại;
- các trường đã parse nếu nhận diện được.

Payload có thể chứa các trường như:

- số CCCD;
- số CMND cũ;
- họ tên;
- ngày sinh;
- giới tính;
- địa chỉ thường trú;
- ngày cấp.

Không được giả định mọi mẫu thẻ có cùng số trường hoặc cùng dấu phân cách. Luôn lưu raw payload.

## 3. OCR

OCR mặt trước để gợi ý:

- số định danh;
- họ tên;
- ngày sinh;
- giới tính;
- quốc tịch.

OCR mặt sau để gợi ý:

- nơi cư trú;
- nơi đăng ký khai sinh;
- ngày cấp;
- ngày hết hạn;
- cơ quan cấp;
- MRZ.

OCR chỉ là dữ liệu gợi ý, không tự ghi đè.

## 4. So sánh

So sánh bốn nguồn:

1. dữ liệu import;
2. dữ liệu học sinh đang nhập;
3. dữ liệu QR;
4. dữ liệu OCR/MRZ.

Hiển thị bảng:

| Trường | Import | Học sinh | QR | OCR | Kết luận |
| --- | --- | --- | --- | --- | --- |

Học sinh có thể bấm `Dùng kết quả QR` cho từng trường. ADMIN quyết định cuối.
