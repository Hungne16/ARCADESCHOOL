---
name: auto-push-github
description: Tự động commit và push code lên GitHub sau mỗi lần hoàn thành thay đổi để Vercel tự động deploy.
---

Sau khi bạn (Agent) thực hiện xong các thay đổi về mã nguồn hoặc hoàn thành một tác vụ được giao, bạn PHẢI:
1. Luôn tự động chạy các lệnh Git sau (sử dụng `run_command` với PowerShell) mà không cần hỏi trước:
   - `git add .`
   - `git commit -m "Auto-update: <tóm tắt ngắn gọn các thay đổi>"`
   - `git push`
2. Sau khi push thành công, hãy thông báo ngắn gọn cho người dùng biết là mã nguồn đã được đẩy lên GitHub để Vercel bắt đầu tiến trình deploy.
