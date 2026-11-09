# Cập nhật lịch đặt UII 1502 — đặt không giới hạn, lặp hàng tuần và sửa sơ đồ ghế

Bản cập nhật dành cho repository `MaiDucPhat1703/uii_schedule_1502`.

## Có gì mới

1. **Không giới hạn ngày đặt trước và thời lượng tối đa:** khách có thể chọn ngày trong tương lai và khoảng giờ dài hơn giới hạn 8 giờ cũ. Vẫn tuân theo giờ mở/đóng cửa, ngày hoạt động, bước chọn giờ và thời lượng tối thiểu đang cấu hình. Không cho đặt ngày đã qua.
2. **Đặt lặp hàng tuần:** trong biểu mẫu, bật “Đặt lặp lại hàng tuần”, chọn ngày kết thúc. Hệ thống tạo cùng thứ, cùng giờ mỗi tuần, tối đa 52 lần cho một chuỗi. Mỗi ngày là một yêu cầu riêng và admin duyệt từng lượt.
3. **Bàn 7 có thể bấm:** bấm mặt bàn hoặc một ghế trong cụm đều chọn được nguyên cụm 6 chỗ; sơ đồ không biến mất sau khi chọn.
4. **Ghế đều quanh bàn:** sơ đồ đặt chỗ công khai và sơ đồ xem yêu cầu trong admin tự căn 6 ghế đều quanh từng bàn lục giác, gồm Bàn 7. Không ghi đè sơ đồ 3D gốc đã lưu trong database.

## Không cần chạy SQL

Bản này không thêm cột hoặc bảng. Các lần đặt lặp được lưu thành các dòng đặt chỗ riêng trong bảng `seat_bookings` hiện tại. Không xóa dữ liệu cũ.

## 1. Upload mã nguồn lên GitHub

1. Giải nén ZIP.
2. Mở repository `MaiDucPhat1703/uii_schedule_1502`, nhánh `main`.
3. Chọn **Add file → Upload files**.
4. Kéo các thư mục `app`, `public`, `scripts`, `tests`, `.github` và file `package.json` bên trong gói cập nhật vào vùng upload, giữ nguyên cấu trúc thư mục.
5. Nếu GitHub hỏi ghi đè file trùng tên, chấp nhận ghi đè.
6. Commit với nội dung `Cập nhật đặt lặp, thời lượng và sơ đồ ghế`.
7. Mở **Actions** và chờ workflow **Deploy UII Schedule 1502** có dấu xanh.

Không upload thư mục `node_modules`, `dist` hoặc file cấu hình bí mật.

## 2. Triển khai phần API mới lên Supabase

Bước này bắt buộc vì kiểm tra giới hạn thời gian và tạo chuỗi đặt lặp được xử lý ở Edge Function, không chỉ ở giao diện GitHub Pages.

### Tạo hai GitHub Actions secrets (chỉ làm một lần)

Trong repository → **Settings → Secrets and variables → Actions → New repository secret**:

- `SUPABASE_ACCESS_TOKEN`: lấy tại Supabase Dashboard → Account → Access Tokens.
- `SUPABASE_PROJECT_REF`: mã project nằm ở đầu Project URL, dạng `abcdefghijklmno`.

Không gửi hai giá trị này vào cuộc trò chuyện và không đưa vào file mã nguồn.

### Chạy deploy

1. Mở tab **Actions** trong repository.
2. Chọn workflow **Deploy Supabase Edge Function**.
3. Bấm **Run workflow → Run workflow**.
4. Chờ job `deploy` có dấu xanh.

Workflow sẽ tự chạy `npm ci`, tạo bundle API mới nhất từ thư mục `app/`, rồi deploy function `uii-api` lên đúng Supabase project. Không cần sửa database hoặc chạy migration.

## 3. Kiểm tra sau khi cập nhật

- Mở website đặt chỗ và tải lại bằng `Ctrl + Shift + R`.
- Chọn một ghế hoặc Bàn 7; thử bấm trực tiếp vào bàn/ghế, kiểm tra Bàn 7 vẫn hiện.
- Chọn một khung giờ dài hơn 8 tiếng (nếu vẫn nằm trong giờ mở/đóng cửa) để kiểm tra giới hạn cũ đã được bỏ.
- Mở biểu mẫu, bật **Đặt lặp lại hàng tuần**, chọn ngày kết thúc cách 2–3 tuần. Xem dòng xem trước số lượt, sau đó gửi thử.
- Trong admin, kiểm tra các ngày lặp xuất hiện thành các yêu cầu riêng để duyệt.

## Ghi chú vận hành

- Các lượt lặp được gửi dưới trạng thái chờ duyệt; admin duyệt từng ngày.
- Nếu bất kỳ ngày nào trong chuỗi bị trùng với lượt đã duyệt, toàn bộ chuỗi bị từ chối và không tạo một phần.
- Giờ sử dụng vẫn nằm trong giờ mở/đóng cửa đã cấu hình; bản cập nhật không tự mở cửa ngoài giờ.
- Sơ đồ ghế được căn đều khi hiển thị trên booking và bản đồ review admin; vị trí trong trình chỉnh sửa 3D/database được giữ nguyên.
