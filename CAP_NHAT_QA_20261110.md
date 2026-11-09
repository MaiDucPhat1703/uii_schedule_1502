# Cập nhật bản sửa QA — 10/11/2026

Gói đầy đủ mã nguồn, dựa trên commit `4fe886cb4c32d6c93c0ee5f94a9d11577b426e5e` của nhánh main. API `uii-api` đã được triển khai lên Supabase, phiên bản 5, ngày 10/11/2026. Quyền ghi GitHub đã được cấp và kiểm tra lại thành công sau lần từ chối 403 ban đầu. Trạng thái triển khai giao diện mới nhất được ghi trong GitHub Actions của repository.

## 1. API đã cập nhật — hướng dẫn để tham khảo hoặc triển khai lại

API trong gói này đã chạy trên project `uii_schedule_1502`. Có thể chuyển sang bước 2 để cập nhật giao diện. Các bước dưới đây dành cho lần triển khai lại khi cần.

1. Giải nén ZIP.
2. Mở Supabase Dashboard → project website đang sử dụng → Edge Functions → `uii-api` → trình chỉnh sửa mã.
3. Mở file `supabase/functions/uii-api/index.ts` trong ZIP bằng trình soạn thảo văn bản. Copy toàn bộ và thay nội dung function hiện tại, rồi Deploy.
4. Giữ nguyên cấu hình project, secrets và tài khoản đang có.

**Không chạy lại migration ban đầu, không tạo project mới, không nhập lại dữ liệu.** Bản sửa không đổi cấu trúc bảng. API mới bổ sung phân trang và tìm kiếm nên phải được cập nhật cùng giao diện.

## 2. Cập nhật GitHub

1. Mở repository `MaiDucPhat1703/uii_schedule_1502`.
2. Add file → Upload files. Upload nội dung bên trong thư mục dự án đã giải nén, giữ đúng đường dẫn và ghi đè file tương ứng.
3. `package.json`, `public`, `app`, `scripts`, `supabase`, `tests` phải nằm ngay cấp gốc repository. Không upload nguyên ZIP hoặc thư mục bọc bên ngoài.
4. Giữ workflow `.github/workflows/deploy.yml` đang có. Gói này không thay đổi workflow. Nếu thao tác bằng trình duyệt không chọn được thư mục ẩn, workflow cũ vẫn dùng được.
5. Commit vào main. Chờ GitHub Actions chạy thành công.
6. Giữ hai Repository Variables hiện có: `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`.

Không upload `node_modules`, `dist`, dữ liệu backup hoặc file cấu hình bí mật. ZIP đã loại các phần này. Bản build kiểm tra dùng thông tin giả và không được đóng gói làm website triển khai; GitHub Actions sẽ build lại bằng Variables thật đang có.

## 3. Kiểm tra sau khi cập nhật

- Mở lại trang khách và admin; Ctrl+F5 nếu đang mở tab cũ.
- Gửi một yêu cầu thử có tên rõ ràng, kiểm tra trong admin, sửa thông tin, duyệt, xác nhận ghế bận rồi hủy để trả chỗ.
- Kiểm tra Bàn 7 hiển thị 6/6 chỗ và chọn nguyên cụm.
- Admin: đổi nhanh trạng thái/ngày, tìm yêu cầu, chuyển trang; kết quả phải khớp bộ lọc cuối cùng.
- Bấm Mở / đóng booking phải mở ngay phần cấu hình. Không cần thay đổi cấu hình để thử đường dẫn này.
- Yêu cầu chờ duyệt không giữ ghế. Hai yêu cầu có thể cùng chờ, nhưng chỉ một yêu cầu trùng ghế/giờ được duyệt.

## Dành cho người chạy mã trên máy

```sh
npm ci
npm run check
npm test
```

`npm run build` cần hai biến môi trường Supabase công khai như README. File function trong ZIP đã được build lại, có thể copy trực tiếp theo bước 1.

## Phạm vi bàn giao

Chi tiết lỗi và bằng chứng kiểm tra nằm trong `BAO_CAO_KIEM_THU_20261110.md`. `DANH_SACH_FILE_SUA.txt` liệt kê những file đã sửa/thêm để đối chiếu. Gói không chứa mật khẩu đăng nhập hoặc dữ liệu người đặt thật.

Phần yêu cầu “điều chỉnh lúc nãy” không có nội dung cụ thể trong ngữ cảnh truy xuất được; cần bổ sung lại nội dung đó để triển khai chính xác.
