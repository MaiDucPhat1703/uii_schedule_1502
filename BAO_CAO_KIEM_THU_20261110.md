# Báo cáo kiểm thử và sửa lỗi — 10/11/2026 (giờ Việt Nam)

Website kiểm tra: https://maiducphat1703.github.io/uii_schedule_1502/booking/

Mã nguồn gốc: main, commit `4fe886cb4c32d6c93c0ee5f94a9d11577b426e5e`.

## Kết quả

- Đã kiểm tra luồng thực tế trên website đang chạy bằng trình duyệt: đăng nhập admin; chọn 2 ghế; chặn biểu mẫu thiếu thông tin; gửi yêu cầu; xem đúng người, giờ và ghế trong admin; sửa ghi chú và kiểm tra dữ liệu đã lưu; duyệt; xác nhận ghế bận và không chọn đặt trùng; hủy lượt thử và xác nhận ghế trống trở lại.
- Lượt thử có nhãn `QA TEST 20261110 - có thể hủy`, Bàn 1 ghế 03 và 04, ngày 10/11/2026, 07:00–08:00. Đã hủy sau khi kiểm tra. Bản ghi hủy còn trong lịch sử để đối chiếu; không xóa dữ liệu thật.
- Đã kiểm tra chọn Bàn 7 tự chọn cả 6 chỗ và chặn đăng ký ngày đã qua trên giao diện.
- Bản sửa trong ZIP: `npm test` đạt 16/16 bài kiểm tra cấp cao; `npm run check` thành công; build thành công bằng cấu hình kiểm tra giả. Đã kiểm tra 43 tham chiếu tài nguyên JS/CSS có phiên bản, không thiếu file, cú pháp JS build hợp lệ.
- API `uii-api` đã triển khai lên project `nmdocfjwkarxudaqhqjg`, phiên bản 5, ngày 10/11/2026. Mã API trước khi triển khai khớp baseline GitHub và đã được lưu lại để khôi phục nếu cần. Tại thời điểm kiểm tra API, giao diện vẫn là bản cũ do kết nối GitHub bị từ chối quyền ghi (403); quyền ghi đã được kiểm tra lại thành công sau khi cấp quyền. Kiểm tra mã giao diện sửa dùng môi trường DOM giả lập và PostgreSQL cục bộ (PGlite), cùng bản build.

## Các lỗi/thiếu sót đã xử lý

| Vấn đề | Cách xử lý | Kiểm chứng |
|---|---|---|
| Đổi bộ lọc admin trong lúc đang tải có thể bỏ qua lựa chọn mới hoặc dùng kết quả cũ | Mỗi lượt tải có số thứ tự; chỉ kết quả mới nhất được hiển thị | Kiểm tra cho hai phản hồi trả về ngược thứ tự |
| Admin chỉ lấy tối đa 300 yêu cầu, tìm kiếm chỉ trong các dòng đã tải | Phân trang 100 dòng; tìm trên toàn bộ lịch sử theo tên, đơn vị, chỗ, tiêu đề, email, điện thoại và mã | PostgreSQL cục bộ với thêm 305 dòng giả, kiểm tra đủ trang, không lặp ID và tìm bản ghi cũ |
| Tự cập nhật liên tục dựng lại các nút dù dữ liệu không đổi | So sánh dữ liệu và sơ đồ, chỉ vẽ lại khi thay đổi | Kiểm tra luồng xem/sửa/duyệt; kiểm tra bộ lọc phản hồi chậm |
| Link Mở / đóng booking trỏ vào phần cấu hình đang thu gọn | Mở phần cấu hình khi bấm link | Kiểm tra DOM |
| Refresh token bị thu hồi khiến yêu cầu khách hoặc lần đăng nhập lại đầu tiên thất bại | Xóa phiên bị từ chối và tiếp tục ở trạng thái khách; API admin vẫn kiểm tra quyền | Giả lập phản hồi refresh 400, xác nhận gọi được API khách và đăng nhập |
| Cầu nối fetch làm mất method/body/signal khi nhận đối tượng Request | Giữ các thuộc tính Request khi chuyển đến API | Kiểm tra POST body và tín hiệu hủy |
| Khung giờ mặc định có thể lệch bước sau đổi cấu hình hoặc vượt thời lượng tối đa | Làm tròn theo bước, giới hạn theo thời lượng tối thiểu/tối đa và giờ đóng cửa | Kiểm tra nhiều tổ hợp, gồm mốc 00:00, 24:00, sát đóng cửa và giờ không tròn bước |
| Cho lưu thời lượng tối thiểu dài hơn toàn bộ giờ mở cửa | Chặn cấu hình không thể tạo lượt đặt hợp lệ | Kiểm tra API trả 400 |
| Cấu hình đóng cửa 24:00 không hiển thị được bằng input time | Trường đóng cửa nhận định dạng HH:MM, hỗ trợ riêng 24:00; API giữ kiểm tra bước giờ | Kiểm tra mã biểu mẫu và các giới hạn giờ |
| Có thể sửa biểu mẫu khi yêu cầu đang gửi, khiến nội dung nhìn thấy khác nội dung đã gửi | Khóa nhóm trường trong lúc gửi, mở lại khi hoàn tất/lỗi | Kiểm tra gửi hai lần chỉ có một POST |
| Zoom bị mất khi dựng lại sơ đồ hoặc đổi khu vực | Áp lại mức zoom hiện tại khi tạo sơ đồ | Kiểm tra mã và luồng bản đồ |
| Bàn 7 có 6 chỗ nhưng tổng quan ghi 1/1 chỗ | Đếm theo sức chứa: 6/6 | Kiểm tra UI giả lập |
| Lưu bản nháp chứa null gây lỗi 500; ID trùng có thể lưu được nhưng mở lại lỗi | Kiểm tra null, ID trống/trùng và thông số trước khi lưu | Kiểm tra API trả 400 |
| Đăng nhập nhận JSON null gây lỗi 500 | Kiểm tra cấu trúc payload trước khi đọc trường | Kiểm tra API trả 400 |
| Trình duyệt có thể giữ module JS cũ sau deploy và trộn với module mới | Build tạo mã phiên bản theo toàn bộ tài nguyên và gắn vào tham chiếu JS/CSS, kể cả import | Kiểm tra 43 tham chiếu cùng phiên bản, cú pháp và đường dẫn |
| Nội dung admin ghi chờ duyệt giữ ghế, trái với hành vi thực tế | Đổi hướng dẫn: chỉ lịch đã duyệt chiếm chỗ | Đã xác minh trực tiếp trên website |
| README ghi cho đặt ngày quá khứ trong khi API chặn | Sửa tài liệu cho đúng nghiệp vụ hiện có | Đối chiếu kiểm tra API và giao diện |

## Phạm vi kiểm tra tự động

- Quyền truy cập API admin, nguồn truy cập, tài khoản có/không có quyền và schema dữ liệu riêng.
- Gửi nhiều ghế, số chỗ, đặt nguyên Bàn 7, chống ghép Bàn 7 với ghế lẻ, chống đặt ghế không còn mở.
- Yêu cầu chờ không chiếm lịch công khai; dữ liệu liên hệ không lộ trong lịch công khai của người khác.
- Duyệt cạnh tranh cùng ghế/giờ: một thành công, một bị chặn. Kiểm tra xung đột biên giờ và giãn cách trong logic lịch.
- Sửa ngày/giờ/chỗ/thông tin; token chỉnh sửa cũ bị chặn; hủy giải phóng lịch.
- Đặt lặp tối đa 52 lần; gửi lại không tạo trùng. Khi một tuần sau xung đột, không tạo một phần chuỗi mới.
- Sơ đồ có lịch sắp tới không được gỡ chỗ tùy tiện; lưu bản nháp và áp dụng là các thao tác có kiểm tra.
- Sao lưu dữ liệu và chuyển SQL: kiểm tra Unicode, dấu nháy, cột lạ và dữ liệu không hợp lệ.
- Clock picker, kéo chọn giờ, chọn nhiều vật thể, sao chép, xoay, undo/redo và lưu bản vẽ theo các bài kiểm tra có sẵn.

## Giới hạn còn lại

Không thể khẳng định đã loại bỏ mọi lỗi có thể xảy ra. Chưa kiểm thử tải lớn, mạng thật bị mất kết nối đúng thời điểm, nhiều trình duyệt/điện thoại thật, đổi mật khẩu thật hoặc triển khai bản giao diện mới lên GitHub Pages. Không chạy kiểm thử phá dữ liệu, không thay mật khẩu, không chỉnh bố trí hoặc đóng/mở nhận đặt trên website thật.

Cần chạy lại smoke test sau khi cập nhật cả API và giao diện theo `CAP_NHAT_QA_20261110.md`. Nội dung chỉnh sửa được nhắc là “lúc nãy” chưa xác định được, nên không suy đoán để đổi nghiệp vụ.

## Xác minh sau khi triển khai API phiên bản 5

Ngày kiểm tra: 10/11/2026 (giờ Việt Nam).

| Kiểm tra trực tiếp API đang chạy | Kết quả |
|---|---|
| GET cấu hình | 200 |
| GET sơ đồ | 200 |
| GET lịch ngày 10/11/2026 | 200; lịch công khai không chứa tên/email người đặt |
| GET ngày không tồn tại 30/02/2026 | 400 |
| GET danh sách admin không có đăng nhập | 401 |
| POST đăng nhập với JSON null | 400 |

Trang admin đang đăng nhập tải được thống kê 5 lịch đã duyệt, 2 từ chối và 1 đã hủy. Truy vấn tìm kiếm mới chạy được trên PostgreSQL thật. Bản ghi QA đã hủy vẫn còn đúng trong lịch sử; bước cập nhật API không tạo/sửa/xóa các lượt đặt, không đổi sơ đồ và không chạy migration.

Supabase không báo cảnh báo hiệu năng hoặc sức khỏe tại thời điểm kiểm tra. Các bảng schema `uii` có RLS và không có policy cho trình duyệt, phù hợp cách API riêng xử lý quyền. Supabase có cảnh báo bảo vệ mật khẩu bị lộ đang tắt: [hướng dẫn cấu hình](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

**Cập nhật sau cấp quyền:** đã xác minh ghi được vào repo `MaiDucPhat1703/uii_schedule_1502`. Bản sửa được đưa lên GitHub để workflow chạy lại TypeScript, toàn bộ kiểm thử và build trước khi triển khai Pages. Xem tab Actions để kiểm tra trạng thái triển khai mới nhất.
