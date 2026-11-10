# Cập nhật bổ sung — thông báo và đồng bộ layout

- Trang khách báo “Đặt chỗ thành công.”; đặt lặp báo số lượt thành công. Bỏ các ghi chú về quy trình duyệt nội bộ.
- Bỏ danh sách “Các chỗ có lịch” dưới sơ đồ theo yêu cầu; giữ màu lịch cả ngày và lịch chi tiết khi bấm ghế.
- Sửa lỗi PostgreSQL `cannot extract elements from a scalar` khi áp dụng sơ đồ: tham số JSON phải được bind kiểu text trước khi chuyển sang JSONB, tránh driver mã hóa hai lần.
- Sơ đồ khách giữ tọa độ/kích thước/góc xoay đã lưu; không tự dàn lại ghế. Tổng quan vẽ cả bàn chữ nhật, ghế và đồ nội thất còn hiện hữu.
- Giữ nguyên quy trình xử lý trạng thái, kiểm tra trùng lịch, quyền admin, chống ghi đè revision và bảo vệ ghế có lượt đặt tương lai.
- Nút “Lưu & cập nhật đặt chỗ” lưu và áp dụng; “Lưu bản nháp mới” chỉ lưu nháp.
- 20 bài kiểm thử, gồm regression kiểm tra kiểu tham số JSON của PostgreSQL, tọa độ ghế sau khi refresh, nội dung thông báo và bảo vệ đặt chỗ trùng.

---

# Lịch cả ngày và rà soát bảo mật — 10/11/2026

## Cách sử dụng mới

- Chọn ngày ở đầu trang để xem lịch cả phòng. Hai khu vực ghi rõ số chỗ có lịch trong ngày.
- Khi vào một khu vực, sơ đồ mặc định ở chế độ **Lịch cả ngày**. Màu vàng nghĩa là có lịch ở một hoặc nhiều khoảng; không có nghĩa là bận cả ngày.
- Phần **Các chỗ có lịch** liệt kê toàn bộ giờ đã duyệt của từng chỗ trong ngày đang xem. Chỉ hiện chỗ và giờ, không hiện người đặt hay thông tin liên hệ.
- **Giờ muốn đặt** là khoảng dùng để kiểm tra và gửi yêu cầu. Đổi ngày giữ nguyên khoảng giờ này. Chỉ khi cấu hình giờ hoạt động thay đổi, giờ được điều chỉnh về khoảng hợp lệ.
- Nút **Kiểm tra giờ muốn đặt** đổi màu sơ đồ theo khung giờ đó. Danh sách lịch cả ngày bên dưới vẫn hiện đầy đủ.
- Bấm ghế hoặc dòng lịch để xem các khoảng trống. Ghế có lịch buổi chiều vẫn đặt được buổi sáng nếu không xung đột. Yêu cầu chờ duyệt không chiếm lịch công khai.

## Kiểm tra và sửa bảo mật

- Đã kiểm tra trực tiếp quyền database: cả `anon` và `authenticated` đều không có USAGE schema `uii`, SELECT hoặc INSERT trên các bảng vận hành.
- Admin được xác minh qua Supabase Auth và bảng `admin_users`. Không cấp quyền từ metadata do người dùng chỉnh được.
- Thu hẹp dữ liệu cá nhân trả về API khách: danh sách yêu cầu của phiên khách chỉ trả ID và trạng thái để khôi phục kết quả gửi, không trả tên, đơn vị hay ghi chú admin.
- Giới hạn byte của body khi đọc stream, kể cả thiếu Content-Length và dữ liệu Unicode. Các API thường tối đa 64 KiB; API sơ đồ giữ giới hạn riêng 2,1 MB.
- Chống gửi quá nhiều từ cùng phiên khách: tối đa 120 lượt mới/giờ, tính bền vững trong database; chuỗi đặt lặp tính theo số ngày tạo. Gửi lại yêu cầu đã lưu không bị tính thêm.
- POST phải gửi JSON. Origin ngoài website bị chặn. Quyền admin được kiểm tra phía server cho thao tác quản trị.
- Kiểm tra cả metadata sơ đồ: nhãn, nguồn vật thể, màu, cờ cho phép đặt và cờ xóa; từ chối kiểu dữ liệu sai trước khi lưu.
- Có timeout và chặn chuyển hướng khi xác minh/refresh thông tin đăng nhập. Token đầu vào quá dài được loại sớm.
- Trang được build với Content Security Policy: mã JavaScript chỉ từ chính website, không cho object nhúng; kết nối API chỉ đến website và project Supabase; không gửi referrer.
- Build từ chối secret/service_role key cho giao diện. Truy vấn vẫn dùng tham số; bài kiểm tra thử chuỗi SQL injection không lấy được dữ liệu.

## Kết quả kiểm tra

19 kiểm tra cấp cao đạt, gồm hồi quy đặt chỗ/admin, đổi ngày giữ giờ, lịch ngoài khung giờ vẫn hiển thị, đếm nguyên cụm 6 chỗ, giới hạn body, quyền quản trị, dữ liệu công khai và chính sách build.

Kiểm tra TypeScript đạt. GitHub Actions chạy lại kiểm tra, build và triển khai trên mỗi lần cập nhật main.

## Thiết lập bảo mật cần chủ tài khoản xử lý

Supabase Auth hiện có `disable_signup=false`: chủ tài khoản cần tắt **Allow new users to sign up**, vì khách đặt chỗ không cần tài khoản. Tài khoản Auth mới vẫn không có quyền admin hoặc quyền đọc bảng riêng. Kết nối hiện tại không có thao tác cập nhật cấu hình Auth.

Supabase đang báo **Leaked Password Protection Disabled**. Xem [hướng dẫn chính thức](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) để bật nếu gói dịch vụ hỗ trợ. Mật khẩu admin đã chia sẻ trong chat nên cần chủ tài khoản tự đổi qua mục Đổi mật khẩu.

Chưa cấu hình CAPTCHA hoặc giới hạn theo IP tại cổng. Giới hạn theo phiên khách có thể bị né bằng cách tạo phiên mới; không thay thế cơ chế chống bot hoàn chỉnh. Không coi các kiểm tra này là cam kết hệ thống không thể bị tấn công. Không đổi mật khẩu hoặc thêm dịch vụ tính phí tự động.

Bản cập nhật không thay cấu trúc bảng, không chạy lại migration và không xóa dữ liệu đặt chỗ.
