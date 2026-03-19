# Ôn thi Tin học THPT QG (React + Flask + SQLite)

Monorepo gồm:

- `backend/`: Flask API + SQLite
- `frontend/`: React (Vite)

## Yêu cầu

- Python 3.11+ (khuyến nghị)
- Node.js 18+

## Chạy backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

cp .env.example .env
python3 -m app.db_init
python3 -m app
```

Backend chạy tại `http://127.0.0.1:5000`.

Tạo admin mặc định:

```bash
python3 -m app.create_admin --email admin@example.com --password admin123
```

## Chạy frontend

```bash
cd frontend
npm i
npm run dev
```

Frontend chạy tại `http://127.0.0.1:5173`.

## Tính năng chính

- Tài khoản **user học sinh / admin**
- Admin **thêm/sửa/xoá** đề thi + câu hỏi
- Câu hỏi hỗ trợ:
  - **MCQ** (1 đáp án đúng)
  - **Đúng/Sai nhiều ý**: một phát biểu + các ý A/B/C/D/E/F (mỗi ý đúng/sai)
- Bài thi có 2 phần:
  - **Phần 1**: trắc nghiệm
  - **Phần 2** gồm:
    - **2.1 Câu hỏi chung** (không theo định hướng)
    - **2.2 Câu hỏi theo chủ đề** (học sinh chọn đúng 1 trong 2 định hướng)
      - Tin học ứng dụng
      - Khoa học máy tính
- Nội dung câu hỏi hỗ trợ render **HTML** và code (**C++**, **SQL**) (có highlight).

