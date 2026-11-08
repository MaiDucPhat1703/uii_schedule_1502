# UII Schedule 1502 — GitHub Pages + Supabase

Dành cho Mai Đức Phát, tài khoản GitHub `MaiDucPhat1703`, repository `uii_schedule_1502`.

Bản này thay thế bộ `UII_Booking_GitHub_D1.zip`. Không dùng Cloudflare. Bạn quản lý mã nguồn trong GitHub, database và đăng nhập trong Supabase. Website hiện tại chưa bị chuyển sang Supabase; gói mã này cần được cấu hình và triển khai vào tài khoản của bạn theo các bước dưới đây.

**Phần thiết lập ban đầu có thể làm bằng trình duyệt và Notepad.** Node.js chỉ cần khi chuyển dữ liệu cũ hoặc tự sửa/build mã trên máy. GitHub Actions sẽ tự cài công cụ để build giao diện.

| Thành phần | Nơi quản lý |
|---|---|
| Giao diện, mã nguồn, lịch sử sửa | GitHub `MaiDucPhat1703/uii_schedule_1502` |
| Website khách và admin | GitHub Pages |
| Database Postgres, tài khoản admin | Supabase |
| API gửi yêu cầu, duyệt lịch, sửa sơ đồ | Supabase Edge Function `uii-api` |

Khách không cần đăng nhập hoặc đăng ký. Admin đăng nhập bằng email và mật khẩu được tạo trong Supabase Auth. Khách chọn nhiều ghế lẻ hoặc chọn riêng Bàn 7 nguyên cụm 6 chỗ. Các yêu cầu chờ xử lý không xuất hiện trong lịch công khai. Chỉ lịch đã duyệt chiếm chỗ. Khách không tự sửa/hủy. Admin sửa được thông tin, ngày, giờ, ghế và ghi chú. Đặt và duyệt ngày quá khứ vẫn được, trong giới hạn giờ hoạt động đã cấu hình.

## 1. Chuẩn bị repository đúng tài khoản

Mở https://github.com/new và điền:

| Mục | Nội dung |
|---|---|
| Owner | `MaiDucPhat1703` |
| Repository name | `uii_schedule_1502` |
| Description | Hệ thống đặt chỗ UII — Phòng B1.1502 |
| Visibility | Public nếu dùng GitHub Free |
| Add README | Tắt — gói mã đã có README |
| Add .gitignore | Không chọn — gói mã đã có |
| License | Không chọn |

Bấm Create repository. Nếu đã có repository này, mở repository hiện có, không tạo trùng.

**Lưu ý thay đổi so với hướng dẫn cũ:** GitHub Pages trên tài khoản GitHub Free cần repository Public. Nếu đã tạo Private: mở repository → Settings → General → kéo xuống Danger Zone → Change repository visibility → Public, sau khi kiểm tra repository không chứa mật khẩu hoặc dữ liệu thật. Nếu muốn giữ Private, cần gói GitHub hỗ trợ Pages cho private repositories. Mã nguồn sẽ công khai khi chọn Public; thông tin người đặt nằm riêng trong Supabase, không đưa vào mã nguồn.

## 2. Tạo project Supabase

1. Mở https://supabase.com/dashboard.
2. Đăng nhập tài khoản của bạn; có thể dùng Sign in with GitHub.
3. Tạo Organization nếu được yêu cầu.
4. Chọn New project.
5. Project name: `uii_schedule_1502`.
6. Database password: tự đặt mật khẩu mạnh và lưu riêng. Đây là mật khẩu database, khác mật khẩu admin website.
7. Chọn khu vực gần Việt Nam, ví dụ Singapore nếu có.
8. Chọn gói phù hợp và bấm Create new project.
9. Chờ project khởi tạo xong.

Các gói miễn phí có hạn mức và điều kiện hoạt động; kiểm tra trang https://supabase.com/pricing trước khi vận hành chính thức. Hướng dẫn này không cam kết dịch vụ luôn miễn phí hoặc không gián đoạn.

## 3. Tạo bảng dữ liệu

Chỉ chạy bước này trong project mới, chưa có schema `uii`.

1. Trong Supabase, vào SQL Editor → New query.
2. Mở file `supabase/migrations/202611080001_initial.sql` trong bộ mã bằng Notepad.
3. Ctrl+A → Ctrl+C để copy toàn bộ file.
4. Dán vào SQL Editor rồi bấm Run.
5. Thành công là không còn lỗi. Chưa có dữ liệu là bình thường.

Tất cả bảng nằm trong schema riêng `uii`. Các tài khoản trình duyệt không được truy cập trực tiếp các bảng này. API ở Edge Function kiểm tra quyền admin và xử lý đặt chỗ. **Không thêm schema `uii` vào Exposed schemas của Data API để sửa lỗi kết nối.**

Để xem bảng đã tạo, chạy truy vấn chỉ đọc:

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'uii'
ORDER BY table_name;
```

## 4. Tạo tài khoản admin cho bạn

1. Vào Authentication → Users.
2. Chọn Add user / Create new user.
3. Nhập email bạn dùng làm admin.
4. Đặt mật khẩu từ 12 ký tự và tự lưu.
5. Nếu có Auto Confirm User / xác nhận email trực tiếp, bật để có thể đăng nhập ngay.
6. Hoàn tất tạo tài khoản.

Tiếp theo, mở SQL Editor → New query. Thay email mẫu dưới đây bằng **email thật vừa tạo**, rồi chạy:

```sql
INSERT INTO uii.admin_users (user_id)
SELECT id
FROM auth.users
WHERE lower(email) = lower('EMAIL_ADMIN_THAT_CUA_BAN')
ON CONFLICT (user_id) DO NOTHING;

SELECT u.email, a.user_id
FROM uii.admin_users a
JOIN auth.users u ON u.id = a.user_id;
```

Kết quả phải hiện email của bạn. Nếu không có dòng nào, kiểm tra email và tài khoản ở Authentication → Users trước khi tiếp tục.

Trong phần cấu hình Authentication, tắt **Allow new users to sign up**, giữ anonymous sign-ins tắt. Khách dùng cơ chế gửi yêu cầu riêng của hệ thống, không tạo tài khoản Supabase. Tài khoản Auth chưa được thêm vào `uii.admin_users` sẽ không có quyền quản trị.

Muốn cấp thêm admin: tạo người dùng trong Auth rồi chạy đoạn cấp quyền trên cho email đó. Muốn thu hồi: xóa đúng dòng `uii.admin_users` của người đó; không cấp quyền chỉ bằng cách sửa giao diện.

## 5. Lấy thông tin kết nối

Trong Supabase, tìm phần Connect / Project Settings / API Keys tương ứng để lấy:

| Thông tin | Cách dùng |
|---|---|
| Project URL | URL thật dạng `https://MA_PROJECT_THAT.supabase.co` |
| Publishable key | Giá trị bắt đầu bằng `sb_publishable_...` |

Lưu hai giá trị này để điền vào GitHub ở bước 8. **Không dùng nguyên URL minh họa, không tự đoán mã project.**

Không dùng `sb_secret_...`, `service_role` hoặc mật khẩu database cho GitHub Variables hay giao diện. Nếu project cũ chỉ có legacy keys, dùng đúng `anon` key; công cụ build chặn legacy service_role key.

## 6. Cấu hình API Supabase

API chịu trách nhiệm kiểm tra quyền, gửi yêu cầu, duyệt và chống duyệt trùng giờ. Chỉ tạo bảng chưa làm website chạy được.

Trong Supabase → Edge Functions → Secrets, thêm hai giá trị:

| Name | Value |
|---|---|
| `ALLOWED_ORIGIN` | `https://maiducphat1703.github.io` |
| `VISITOR_SECRET` | Chuỗi ngẫu nhiên dài ít nhất 32 ký tự do bạn tạo |

`ALLOWED_ORIGIN` chỉ có tên miền: **không thêm** `/uii_schedule_1502/`, không thêm dấu `/` cuối. Nếu đổi sang tên miền riêng thì cập nhật origin tương ứng.

Để tạo VISITOR_SECRET: mở file `TAO_KHOA_BAO_MAT.html` bằng trình duyệt trên máy → bấm Tạo khóa → copy chuỗi vào Supabase Secrets. Trang này tạo khóa cục bộ bằng bộ sinh số ngẫu nhiên của trình duyệt, không gửi khóa đi đâu. Không tải khóa lên GitHub.

Các giá trị `SUPABASE_URL`, `SUPABASE_ANON_KEY` và `SUPABASE_DB_URL` được Supabase cấp sẵn cho Edge Functions. Không tự thêm secrets bắt đầu bằng `SUPABASE_`.

Tạo function:

1. Vào Edge Functions → Deploy a new function → Via Editor.
2. Đặt tên chính xác: `uii-api`.
3. Trong bộ mã, mở `supabase/functions/uii-api/index.ts` bằng Notepad.
4. Copy toàn bộ nội dung vào file `index.ts` trong trình soạn thảo Supabase, thay code mẫu.
5. Đây là file đã gộp sẵn, không cần tải thêm các file `app/` vào trình soạn thảo.
6. Bấm Deploy function.
7. Trong cấu hình function, **tắt Verify JWT / Enforce JWT verification** nếu mục này đang bật, rồi lưu. Với CLI, file `supabase/config.toml` đã có `verify_jwt = false`.

Việc tắt kiểm tra JWT ở cổng function cho phép khách không đăng nhập gửi yêu cầu. API vẫn tự xác minh token Supabase Auth và kiểm tra bảng admin cho mọi thao tác quản trị. Không bỏ kiểm tra này trong code.

Không nhập khóa hoặc mật khẩu trực tiếp vào file function. Nếu deploy báo lỗi, xem Logs của `uii-api` và kiểm tra đã copy đủ file, hai secrets đã đúng.

## 7. Tải mã nguồn lên GitHub bằng trình duyệt

1. Giải nén bộ mã vào máy. Không upload riêng file ZIP.
2. Mở repository https://github.com/MaiDucPhat1703/uii_schedule_1502.
3. Chọn Add file → Upload files. Với repository trống, có thể chọn uploading an existing file.
4. Kéo các thư mục và file **bên trong thư mục dự án** lên, gồm `app`, `public`, `scripts`, `supabase`, `tests`, `package.json`, `package-lock.json`, `tsconfig.json` và README.
5. `package.json` phải nằm ngay cấp gốc repository, không nằm trong một thư mục bọc khác.
6. Bấm Commit changes để lưu vào nhánh `main`.

Không upload `node_modules`, `dist`, `backups`, `.env` hoặc file chứa thông tin bí mật. Bộ ZIP bàn giao không chứa dữ liệu người đặt hay mật khẩu.

Tạo workflow nếu thư mục `.github` chưa được tải lên:

1. Trong repository, bấm Add file → Create new file.
2. Ở ô tên file nhập đúng: `.github/workflows/deploy.yml`.
3. Mở file `GITHUB_ACTIONS.yml` trong bộ mã bằng Notepad, copy toàn bộ nội dung.
4. Dán vào file đang tạo trên GitHub.
5. Bấm Commit changes vào `main`.

Nếu `.github/workflows/deploy.yml` đã có, không tạo trùng. File `GITHUB_ACTIONS.yml` chỉ là bản tiện copy, workflow thật phải nằm đúng đường dẫn `.github/workflows/deploy.yml`.

## 8. Thêm hai Variables trong GitHub

Trong repository:

Settings → Secrets and variables → Actions → **Variables** → New repository variable.

Thêm từng biến:

| Name | Value |
|---|---|
| `SUPABASE_URL` | Project URL thật ở bước 5 |
| `SUPABASE_PUBLISHABLE_KEY` | Publishable key thật ở bước 5 |

Tên biến phải đúng chính tả. Đây là hai giá trị công khai của giao diện. Không tạo biến tên Cloudflare, không điền mật khẩu database/admin vào đây.

## 9. Bật GitHub Pages

1. Vào Settings → Pages.
2. Build and deployment → Source → chọn **GitHub Actions**.
3. Nếu không có mục Pages do repo Private trên GitHub Free, xử lý visibility ở bước 1.
4. Mở tab Actions → chọn **Deploy UII Schedule 1502**.
5. Bấm Run workflow → chọn nhánh `main` → Run workflow.
6. Đợi kiểm tra và triển khai thành công. Nếu lần đầu báo thiếu Variables, thêm đủ biến rồi bấm Re-run jobs.
7. Mở Settings → Pages để lấy URL GitHub công bố.

URL dự kiến với đúng tài khoản và tên repository:

```text
https://maiducphat1703.github.io/uii_schedule_1502/
```

Đây là địa chỉ dự kiến, chỉ hoạt động sau khi workflow triển khai thành công. Không dùng đường dẫn github.com/... để mở website.

| Trang | Đường dẫn dự kiến |
|---|---|
| Khách đặt chỗ | `https://maiducphat1703.github.io/uii_schedule_1502/booking/` |
| Admin đăng nhập | `https://maiducphat1703.github.io/uii_schedule_1502/admin/login/` |
| Admin quản lý | `https://maiducphat1703.github.io/uii_schedule_1502/admin/` |
| Chỉnh sơ đồ 3D | `https://maiducphat1703.github.io/uii_schedule_1502/studio/index.html` |

Đăng nhập bằng **email/mật khẩu đã tạo ở bước 4**. Không dùng tài khoản admin cũ của website trước.

Auth URL Configuration: đặt Site URL là URL GitHub Pages thật. Bản này dùng đăng nhập mật khẩu trực tiếp, không cần callback OAuth. Chưa có giao diện tự khôi phục mật khẩu qua email; có thể quản lý tài khoản từ Supabase Dashboard, hoặc dùng Đổi mật khẩu trong admin khi còn đăng nhập được.

## 10. Áp dụng bố trí và mở nhận đặt

Nếu khởi tạo mới:

1. Đăng nhập admin → Chỉnh sơ đồ.
2. Kiểm tra và sửa bố trí bàn ghế.
3. Bấm **Lưu & cập nhật đặt chỗ**.
4. Quay lại trang quản lý → cấu hình giờ hoạt động và mở nhận đặt ghế.
5. Mở trang khách trong cửa sổ ẩn danh để thử.

Kiểm tra tối thiểu:

| Thao tác | Kết quả cần đạt |
|---|---|
| Khách chọn nhiều ghế lẻ và gửi | Một yêu cầu chứa toàn bộ ghế xuất hiện trong admin |
| Chọn Bàn 7 | Chọn nguyên cụm 6, không chọn ghế lẻ bên trong |
| Yêu cầu chưa duyệt | Không xuất hiện trong lịch công khai |
| Admin mở yêu cầu | Nhìn được vị trí ghế trên sơ đồ |
| Admin duyệt | Lịch công khai hiện ghế bận đúng giờ |
| Duyệt yêu cầu khác trùng ghế/giờ | Bị chặn, không duyệt chồng |
| Admin sửa giờ, nội dung, vị trí | Cập nhật đúng sau khi lưu |
| Khách tự hủy/sửa | Không thực hiện được |
| Đặt và duyệt ngày quá khứ | Được trong giờ hoạt động đã cấu hình |
| Đóng nhận đặt ghế | Khách không gửi được yêu cầu mới |

Chỉ đổi link cho mọi người sau khi kiểm tra thực tế đạt. Gói mã đã kiểm tra logic trên PostgreSQL chạy cục bộ bằng PGlite và kiểm tra cầu nối trình duyệt; chưa được triển khai thử vào project Supabase của bạn, chưa kiểm tra trình duyệt thật trên tài khoản của bạn.

## 11. Chuyển dữ liệu cũ nếu cần

Làm trước khi mở nhận đặt trên website mới. Database đích đã tạo bảng ở bước 3 và sáu bảng vận hành còn trống. Tài khoản admin có thể đã được tạo; nó không bị thay đổi khi nhập dữ liệu.

1. Trên website cũ, đăng nhập admin → đóng nhận đặt → Tải bản sao dữ liệu.
2. Lưu file JSON vào `backups/backup.json` trong thư mục mã nguồn trên máy.
3. Cài Node.js 24 từ https://nodejs.org nếu máy chưa có.
4. Mở Terminal trong thư mục mã nguồn, chạy:

```powershell
npm ci
npm run backup:sql -- backups/backup.json backups/import-supabase.sql
```

Công cụ kiểm tra mọi dòng bằng PostgreSQL tạm, phát hiện cột lạ/trùng ID/lỗi dữ liệu trước khi tạo SQL. Nó không đưa tài khoản/mật khẩu cũ vào database mới. File kết quả có dữ liệu người đặt: giữ riêng trên máy, không đưa lên repository.

Trong SQL Editor Supabase chạy truy vấn kiểm tra đích:

```sql
SELECT 'seat_bookings' AS bang, COUNT(*) AS so_dong FROM uii.seat_bookings
UNION ALL SELECT 'spatial_layouts', COUNT(*) FROM uii.spatial_layouts
UNION ALL SELECT 'spatial_spaces', COUNT(*) FROM uii.spatial_spaces
UNION ALL SELECT 'booking_settings', COUNT(*) FROM uii.booking_settings
UNION ALL SELECT 'meeting_rooms', COUNT(*) FROM uii.meeting_rooms
UNION ALL SELECT 'seat_claims', COUNT(*) FROM uii.seat_claims;
```

**Cả sáu số đếm phải bằng 0.** Nếu bạn đã mở website mới, bảng booking_settings có thể đã có một dòng mặc định. Không nhập chồng; dùng project mới để chuyển dữ liệu từ đầu, hoặc nhờ kiểm tra dữ liệu cụ thể trước khi xử lý. Không xóa dữ liệu đang dùng để cố làm bước này chạy.

Mở `backups/import-supabase.sql` bằng Notepad → copy toàn bộ → SQL Editor → New query → dán → Run. File có BEGIN/COMMIT để nhập trong một transaction. Không chạy nhập lại nếu đã thành công. Chạy lại truy vấn đếm và so sánh số dòng với kết quả công cụ.

Dữ liệu được chuyển gồm phương án, sơ đồ đang áp dụng, cấu hình, các yêu cầu và dữ liệu giữ chỗ cũ. Cookie/token khách cũ không chuyển tên miền, nhưng lịch đã duyệt vẫn có đầy đủ trong database mới.

## 12. Tự quản lý dữ liệu và cập nhật

Trong Supabase SQL Editor có thể xem dữ liệu:

```sql
SELECT id, day, seat_label, display_name, status, start_minute, end_minute
FROM uii.seat_bookings
ORDER BY day DESC, start_minute;
```

| Bảng | Dữ liệu |
|---|---|
| `uii.seat_bookings` | Người đặt, ngày, giờ, chỗ ngồi, trạng thái |
| `uii.spatial_spaces` | Sơ đồ đang áp dụng |
| `uii.spatial_layouts` | Các phương án/bản nháp |
| `uii.booking_settings` | Mở/đóng, giờ hoạt động và quy tắc |
| `uii.admin_users` | Danh sách ID được quyền quản trị |
| `auth.users` | Tài khoản do Supabase Auth quản lý |
| `uii.meeting_rooms`, `uii.seat_claims` | Dữ liệu tương thích các phiên bản cũ |

Duyệt/sửa lịch bằng trang admin để hệ thống kiểm tra trùng giờ. Không sửa trực tiếp trạng thái active trong bảng, vì thao tác đó bỏ qua kiểm tra nghiệp vụ.

Sao lưu vận hành: admin → Tải bản sao dữ liệu. Bản sao này chứa sáu bảng vận hành, không gồm tài khoản Auth/quyền admin. Với bản sao toàn hệ thống, sử dụng phương thức backup phù hợp gói Supabase của bạn, kiểm tra cả phần Auth trước khi khôi phục. Không coi JSON vận hành là bản sao mọi tài nguyên của project.

Cập nhật giao diện: sửa mã trong GitHub, commit vào main; Actions tự build và cập nhật Pages. **Actions hiện chỉ triển khai giao diện.** Khi sửa mã backend trong app/, phải build lại rồi deploy lại Edge Function. Khi đổi cấu trúc database, thêm migration mới; không chạy lại migration ban đầu.

Dành cho lập trình viên khi sửa backend:

```powershell
npm ci
npm run check
npm test
$env:SUPABASE_URL="URL_PROJECT_THAT"
$env:SUPABASE_PUBLISHABLE_KEY="PUBLISHABLE_KEY_THAT"
npm run build
```

Sau build, deploy lại file `supabase/functions/uii-api/index.ts` trong Dashboard hoặc bằng Supabase CLI. Không có mật khẩu hoặc database URL nào được nhúng vào bundle giao diện.

## Xử lý lỗi thường gặp

| Lỗi | Kiểm tra |
|---|---|
| Pages không bật được | Repo Public trên GitHub Free, hoặc gói hỗ trợ private Pages |
| Actions không thấy workflow | File phải là `.github/workflows/deploy.yml`, không chỉ GITHUB_ACTIONS.yml |
| Build báo thiếu URL/key | Điền hai Repository Variables ở bước 8, chạy lại workflow |
| ERR_NAME_NOT_RESOLVED | Copy Project URL thật, không dùng chuỗi mẫu |
| 401 trước khi vào function | Kiểm tra Verify JWT của `uii-api` đã tắt; admin vẫn được kiểm tra trong code |
| 403 nguồn truy cập | ALLOWED_ORIGIN đúng `https://maiducphat1703.github.io`, không có đường dẫn/dấu gạch cuối |
| Email đúng nhưng không vào admin | Email đã xác nhận và ID có trong uii.admin_users |
| 500 từ API | Kiểm tra Logs function, migration đã chạy, secrets và kết nối DB |
| Sơ đồ trống | Lưu & cập nhật đặt chỗ trong studio, rồi mở nhận đặt |
| Thiếu CSS/JS, 404 | Đúng repository uii_schedule_1502 và package.json nằm ở cấp gốc |
| Lịch chưa hiện sau khi gửi | Admin chưa duyệt; yêu cầu chờ không chiếm chỗ công khai |
| Import báo trùng dữ liệu | Không chạy lại; kiểm tra database đích trước |

## Tài liệu chính thức

- GitHub Pages và điều kiện repository: https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages
- GitHub Pages qua Actions: https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages
- Tạo Edge Function bằng Dashboard: https://supabase.com/docs/guides/functions/quickstart-dashboard
- Secrets và các giá trị cấp sẵn: https://supabase.com/docs/guides/functions/secrets
- Database trong Edge Function: https://supabase.com/docs/guides/functions/connect-to-postgres
- Auth và JWT: https://supabase.com/docs/guides/functions/auth-headers
- API keys: https://supabase.com/docs/guides/getting-started/api-keys
