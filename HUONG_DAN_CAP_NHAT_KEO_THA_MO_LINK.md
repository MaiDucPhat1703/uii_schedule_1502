# Miền Tri Thức v2.2 — Kéo thả thẻ và Ctrl/Cmd + bấm link

Gói cập nhật cho repository mien-tri-thuc của teocong99x2002-cloud.
Cài trên bản v2 đã có thẻ tài liệu hoặc v2.1 đã có công thức.
Gói giữ phần công thức v2.1 để tránh mất chức năng khi upload.
Không cần sửa SQL, tạo bảng mới hoặc nhập lại thông tin Supabase.

## 1. Upload những gì?

1. Giải nén ZIP trên máy.
2. Mở repository mien-tri-thuc → Add file → Upload files.
3. Kéo hai file package.json, package-lock.json và thư mục src BÊN TRONG ZIP vào trang upload.
4. Giữ đúng đường dẫn như bảng sau. Không kéo nguyên ZIP hoặc thư mục cha vào repository.
5. Commit changes lên main: "Thêm kéo thả thẻ và Ctrl/Cmd bấm mở link".

| File | Thao tác |
|---|---|
| package.json | Đè file cũ ở cấp gốc |
| package-lock.json | Đè file cũ ở cấp gốc; cập nhật cùng package.json |
| src/DocumentWorkspace.tsx | Đè file cũ |
| src/documentModel.ts | Đè file cũ |
| src/RichEditor.tsx | Đè file cũ |
| src/styles.css | Đè file cũ |
| src/TabTree.tsx | Thêm mới |
| src/linkBehavior.ts | Thêm mới |
| src/mathParsing.ts | Đè/thêm; giữ chức năng công thức của v2.1 |
| src/mathPaste.ts | Đè/thêm; giữ chức năng công thức của v2.1 |

File hướng dẫn Markdown có thể giữ trên máy hoặc upload, không bắt buộc để chạy.
Không xóa những file cũ khác không nằm trong ZIP: App.tsx, data.ts, main.tsx,
supabase.ts, vite.config.ts và .github/workflows/deploy.yml vẫn giữ nguyên.

## 2. Đợi triển khai

Actions → Deploy Miền Tri Thức → đợi commit mới thành công.
Nếu chưa có lần chạy: Run workflow → main.
Mở website và Ctrl+Shift+R (Mac: Cmd+Shift+R) để tải lại giao diện.
Địa chỉ không đổi: https://teocong99x2002-cloud.github.io/mien-tri-thuc/

## 3. Ctrl/Cmd + bấm liên kết

- Windows/Linux: giữ Ctrl, bấm chuột trái vào liên kết TRONG NỘI DUNG tài liệu.
- Mac: giữ Cmd, bấm vào liên kết.
- Trang đích mở trong tab mới; trang soạn thảo vẫn được giữ.
- Bấm bình thường để đặt con trỏ và sửa chữ/link.
- Khi giữ Ctrl/Cmd, con trỏ trên link đổi sang dạng mở liên kết.
- Chỉ mở URL web http:// hoặc https:// theo thao tác này.
- Đoạn chữ phải là hyperlink thực sự. Có thể tạo link bằng nút Chèn liên kết hoặc
  dán URL. Một dòng chữ chưa gắn đường dẫn không tự biết trang đích cần mở.
- Việc trình duyệt chuyển tiêu điểm ngay sang tab mới hay giữ tab hiện tại còn phụ
  thuộc thiết lập trình duyệt; bản cập nhật yêu cầu mở tab mới bằng _blank.

## 4. Kéo thả thẻ

Bên trái, mỗi thẻ có tay cầm sáu chấm ⋮⋮ trước tên thẻ.

1. Giữ chuột ở tay cầm và kéo tới vị trí mong muốn.
2. Quan sát dấu chỉ vị trí rồi thả:
   - Mép trên của thẻ đích: đưa lên trước thẻ đó, cùng thẻ cha.
   - Mép dưới của thẻ đích: đưa xuống sau thẻ đó, cùng thẻ cha.
   - Giữa thẻ đích: đưa vào làm thẻ con của thẻ đó.
3. Trong lúc kéo, cuối danh sách có vùng "Thả ở đây để đưa ra cấp cao nhất".
   Kéo thẻ vào vùng đó để tách khỏi thẻ cha và đưa ra cấp cao nhất.
4. Bấm Lưu tài liệu hoặc Ctrl+S/Cmd+S để lưu cấu trúc mới.

Kéo cả thẻ cha mang theo các thẻ con: nội dung và liên kết cha/con bên trong vẫn giữ.
Không thể thả một thẻ vào chính nó hoặc thẻ con của nó, nhằm tránh vòng lặp.
Thả ra ngoài vùng hợp lệ hoặc nhấn Escape khi kéo sẽ hủy thao tác kéo.
Các nút lên/xuống cũ được bỏ. Có thể dùng Alt+↑/↓ khi tập trung vào tay cầm để đổi
thứ tự bằng bàn phím. Ô Nằm trong vẫn được giữ để chọn thẻ cha khi cần.
Trên thiết bị cảm ứng: giữ/kéo tay cầm; vùng ngoài tay cầm vẫn cuộn bình thường.
Nếu danh sách dài, kéo gần mép trên/dưới và tiếp tục di chuyển nhẹ để cuộn danh sách.

## 5. Cách kiểm tra sau cập nhật

1. Đăng nhập và mở một tài liệu có ít nhất ba thẻ.
2. Kéo thẻ cuối lên trước thẻ đầu; kiểm tra thứ tự.
3. Kéo giữa một thẻ khác; kiểm tra ô Nằm trong và độ thụt lề.
4. Kéo thẻ cha có thẻ con; kiểm tra tất cả nội dung còn nguyên.
5. Lưu, quay lại thư viện và mở lại: thứ tự và cấu trúc phải còn đúng.
6. Ctrl/Cmd + bấm một hyperlink để kiểm tra mở đúng trang trong tab mới.
7. Kiểm tra công thức, bảng và nội dung cũ vẫn hiển thị.

## 6. Nếu gặp lỗi

| Hiện tượng | Kiểm tra |
|---|---|
| Không thấy tay cầm kéo | Actions phải thành công; tải lại bỏ cache |
| Module TabTree/linkBehavior not found | Đã upload hai file mới vào src, đúng chữ hoa/thường chưa? |
| npm ci báo lock không khớp | Upload đè cả package.json và package-lock.json cùng gói |
| Công thức không nhận | Kiểm tra mathParsing.ts, mathPaste.ts đã có trong src |
| Kéo không đúng kiểu mong muốn | Xem đường kẻ trên/dưới hoặc vùng tô nền giữa trước khi thả |
| Mở lại thấy thứ tự cũ | Nhấn Lưu tài liệu sau khi kéo và kiểm tra thông báo lưu |
| Ctrl + bấm không mở | Đoạn chữ cần có link http/https; xem chính sách mở tab của trình duyệt |

## Kiểm tra bàn giao

- TypeScript và production build đã kiểm tra.
- Kiểm thử dữ liệu: đổi thứ tự, tạo/tách thẻ con, di chuyển nhánh, chặn vòng lặp,
  200 lượt di chuyển hỗn hợp không mất nội dung, lọc URL không an toàn.
- Kiểm thử trình duyệt bằng dữ liệu giả: kéo lên đầu, kéo nhánh vào thẻ cha khác,
  chặn kéo vào thẻ con của chính nó, đưa về cấp cao nhất, lưu/mở lại, giữ công thức.
- Ctrl và Cmd + bấm đã mở đúng URL kiểm thử trong tab mới.
- Chưa truy cập database thật của bạn. Sau khi upload, hãy thử lưu trên website thật.
