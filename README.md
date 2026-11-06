# Hệ thống bốc thăm Cắm hoa nghệ thuật 20/11 – THCS Quỳnh Phú 1

Ứng dụng web dùng Vite + Supabase. Cơ sở dữ liệu Supabase là nguồn dữ liệu dùng chung; bảng `draws` được phát realtime tới tất cả trình duyệt đang mở.

## Các chức năng
- 28 lớp theo danh sách đã cung cấp.
- Mỗi lớp có mã bốc thăm riêng.
- RPC `draw_once` kiểm tra mã, kiểm tra lớp đã bốc chưa, khóa trạng thái phiên và cấp số còn trống trong cùng một transaction.
- Kết quả công khai, cập nhật realtime.
- Quản trị đăng nhập bằng Supabase Auth; chỉ hồ sơ có role `admin` được khóa/mở và đặt lại kết quả.
- Xuất CSV và in danh sách.

## A. Tạo cơ sở dữ liệu Supabase
1. Tạo dự án tại https://supabase.com/ (chọn khu vực gần Việt Nam nếu có).
2. Mở **SQL Editor** trong dự án.
3. Dán toàn bộ nội dung `supabase/schema.sql` và chạy.
4. Trong **Project Settings → API**, lấy Project URL và anon/publishable key.
5. Trong **Authentication → Users**, tạo một tài khoản quản trị bằng email và mật khẩu.
6. Sao chép UUID của tài khoản vừa tạo. Trong SQL Editor chạy:
   ```sql
   insert into public.profiles(id, role)
   values ('UUID_TAI_KHOAN_QUAN_TRI', 'admin')
   on conflict (id) do update set role = 'admin';
   ```

## B. Đổi mã riêng cho 28 lớp trước khi công bố
Trong `schema.sql`, các chuỗi `THAY_MA_RIENG_6A`...`THAY_MA_RIENG_9G` là mã tạm. Không phát hành khi chưa thay bằng mã riêng do Ban tổ chức tạo.

Cách thay mã sau khi chạy schema: tạo mã riêng cho từng lớp (khuyến nghị 8–12 ký tự, không dùng mã dễ đoán), rồi chạy lệnh sau cho từng lớp:
```sql
update public.classes
set access_code_hash = encode(digest('MA_RIENG_MOI_CUA_LOP_6A', 'sha256'), 'hex')
where class_name = '6A';
```
Lặp lại cho đủ 28 lớp, thay đúng mã và tên lớp. Gửi mã tương ứng riêng cho từng GVCN; không đăng mã lên nhóm chung.

## C. Chạy thử trên máy tính
1. Cài Node.js bản LTS: https://nodejs.org/
2. Giải nén gói này, mở terminal tại thư mục dự án.
3. Chạy `npm install`.
4. Sao chép `.env.example` thành `.env`.
5. Điền `VITE_SUPABASE_URL` và `VITE_SUPABASE_ANON_KEY`.
6. Chạy `npm run dev`; mở địa chỉ local mà terminal hiển thị.

## D. Xuất bản thành một đường link chung bằng Vercel
1. Đưa thư mục dự án lên GitHub (không đưa file `.env` lên GitHub).
2. Đăng nhập https://vercel.com/ và chọn **Add New → Project**, kết nối repository.
3. Framework preset: Vite; Build command `npm run build`; Output directory `dist`.
4. Trong **Environment Variables**, thêm:
   - `VITE_SUPABASE_URL` = Project URL của Supabase.
   - `VITE_SUPABASE_ANON_KEY` = anon/publishable key.
5. Nhấn Deploy. Vercel cấp một URL dạng `https://ten-du-an.vercel.app`. Đây là link chung gửi cho 28 lớp.
6. Mỗi khi cập nhật mã nguồn, Vercel tự build và triển khai lại.

## E. Kiểm tra trước ngày hội thi
- Mở link trên ít nhất hai thiết bị/trình duyệt khác nhau.
- Dùng mã thử của một lớp để bốc thăm; xác nhận thiết bị còn lại nhìn thấy kết quả ngay.
- Thử bốc lại cùng lớp: hệ thống phải từ chối.
- Thử dùng cùng mã/lớp ở hai thiết bị gần như đồng thời: chỉ một giao dịch thành công.
- Đăng nhập quản trị, thử khóa/mở; khi khóa, các lớp không thể bốc.
- Chỉ dùng chức năng đặt lại khi đang chạy thử hoặc khi Ban tổ chức có quyết định chính thức.

## Lưu ý bảo mật và vận hành
- Không đưa `service_role` key hoặc mật khẩu quản trị vào mã nguồn frontend, GitHub hay nhóm chat.
- Mã lớp trong bản SQL ban đầu chỉ là mã tạm; bắt buộc thay toàn bộ trước khi gửi link cho giáo viên.
- Quyền quản trị được kiểm tra ở phía cơ sở dữ liệu, không chỉ ẩn/hiện nút trên giao diện.
- Đây là bộ mã nguồn sẵn sàng triển khai; link Vercel chỉ được tạo sau khi chủ dự án đăng nhập Supabase/Vercel và thực hiện các bước cấu hình. Không có máy chủ hay tài khoản bên ngoài nào được tạo tự động từ gói mã nguồn này.
