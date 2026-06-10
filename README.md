# ANNAI HEALTH MASALA

A bilingual ordering site for ANNAI HEALTH MASALA with a React frontend, Django backend, SQLite database, customer accounts, payment integration, order tracking, and an admin dashboard.

## Features

- English/Tamil product menu with all provided rates per kg.
- Customer cart, order form, flour request notes, and order-number tracking.
- **Customer login and registration** with saved profile details (name, phone, address).
- **Payment options:** Cash on Delivery (default) and online payment via Razorpay (when configured).
- **Secure order tracking** using the phone number or a tracking PIN shown after checkout.
- Admin dashboard in the React app for order status updates, customer notifications, and a **registered users list**.
- Django admin at `/admin/` for managing categories, products, orders, payments, and users.
- SQLite database by default, with seed data for the complete menu card.
- Product images and icon-based controls for a cleaner shopping experience.
- Server-side price validation and input sanitization.

## Project Structure

```text
.
├── backend/                 # Django API, admin, SQLite database
│   ├── annai_backend/       # Settings, URLs, CORS middleware
│   ├── orders/              # Models, views, auth, payments
│   ├── manage.py
│   └── requirements.txt
├── src/                     # React frontend (App.jsx, menuData.js, styles.css)
├── index.html               # Vite entrypoint
├── package.json
├── .env.example             # Environment variable template
└── README.md
```

## Quick Start

### 1. Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python manage.py migrate
python manage.py seed_menu
python manage.py createsuperuser
python manage.py runserver
```

The API runs at `http://127.0.0.1:8000/api/`.

### 2. Frontend

Open a second terminal:

```bash
npm install
npm run dev
```

The React app runs at the Vite URL shown in the terminal, usually `http://localhost:5173/`.

### 3. Environment variables

Copy `.env.example` to `.env` in the project root and adjust as needed:

```bash
# Frontend
VITE_API_BASE_URL=http://localhost:8000/api

# Django (set in your shell or a backend .env loader)
DJANGO_SECRET_KEY=change-this-to-a-long-random-string
DJANGO_DEBUG=1
DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1
ANNAI_ADMIN_PIN=change-me-in-production
ANNAI_CORS_ORIGIN=http://localhost:5173

# Razorpay (optional — leave empty for Cash on Delivery only)
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
```

**Windows (PowerShell) example:**

```powershell
$env:ANNAI_ADMIN_PIN = "your-secure-pin"
$env:ANNAI_CORS_ORIGIN = "http://localhost:5173"
$env:DJANGO_SECRET_KEY = "your-long-random-secret"
```

If you do not set `ANNAI_ADMIN_PIN`, the development PIN is `1234`.

### OneDrive / SQLite note

If SQLite shows a disk I/O error inside a synced OneDrive folder, store the database in a local path:

```bash
set ANNAI_DB_PATH=C:\tmp\annai-health-masala.sqlite3
python manage.py migrate
python manage.py seed_menu
```

## Workflow

### Customer

1. Open the site and switch English/Tamil if needed.
2. Optionally **register** or **login** to pre-fill delivery details.
3. Add products to the cart (flour varieties go into order notes when priced on request).
4. Choose **Cash on Delivery** or **Pay Online** (Razorpay, when keys are configured).
5. Submit the order and save the **order number** and **tracking PIN**.
6. Track status on the site using the order number plus phone or PIN.

### Admin

1. Open the **Admin** tab in the React app.
2. Enter the admin PIN and click **Load Orders** or **Load Users**.
3. Update order status and write a message shown in the customer timeline.
4. View registered users (username, email, phone, order count, join date).
5. Use Django admin at `http://127.0.0.1:8000/admin/` for full catalog and order management.

## API Endpoints

Base URL: `http://127.0.0.1:8000/api/`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/health/` | — | Health check |
| GET | `/menu/` | — | Product categories and items |
| GET | `/payment/config/` | — | Online payment availability |
| POST | `/auth/register/` | — | Create customer account |
| POST | `/auth/login/` | — | Login (returns token) |
| POST | `/auth/logout/` | Bearer token | Logout |
| GET | `/auth/me/` | Bearer token | Current user profile |
| POST | `/orders/` | Bearer token (optional) | Place order |
| GET | `/orders/<order_number>/?phone=` or `?pin=` | Bearer token (optional) | Track order |
| POST | `/payments/verify/` | — | Verify Razorpay payment |
| GET | `/admin/orders/` | `X-Admin-Pin` or staff token | List orders |
| GET | `/admin/users/` | `X-Admin-Pin` or staff token | List registered users |
| PATCH | `/admin/orders/<order_number>/status/` | `X-Admin-Pin` or staff token | Update order status |

**Auth header:** `Authorization: Bearer <token>`

**Admin header:** `X-Admin-Pin: <your-pin>`

## Payment Integration (Razorpay)

1. Create a Razorpay account and get test/live API keys.
2. Set `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` in your environment.
3. Restart the Django server.
4. Customers will see **Pay Online (Razorpay)** at checkout.

Without Razorpay keys, only **Cash on Delivery** is available. The frontend loads the Razorpay checkout script from their CDN when online payment is enabled.

## Security

The project includes several protections suitable for development and as a base for production hardening:

- **Server-side pricing** — order totals are calculated from database prices, not client input.
- **Order tracking** — requires the customer phone or tracking PIN (or logged-in ownership).
- **CORS** — restricted to `ANNAI_CORS_ORIGIN` (not open `*`).
- **Input sanitization** — customer fields are trimmed and length-limited.
- **Quantity limits** — 0.25 kg minimum, 100 kg maximum per line item.
- **Token auth** — customer sessions use bearer tokens stored server-side.

**Before production:**

- Set a strong `DJANGO_SECRET_KEY`.
- Set `DJANGO_DEBUG=0`.
- Change `ANNAI_ADMIN_PIN` from the default.
- Configure `DJANGO_ALLOWED_HOSTS` and `ANNAI_CORS_ORIGIN` for your domain.
- Use PostgreSQL instead of SQLite if possible.
- Add HTTPS and rate limiting.

## Useful Commands

```bash
npm run build          # Production frontend build
npm run preview        # Preview production build
python backend/manage.py seed_menu
python backend/manage.py createsuperuser
python backend/manage.py migrate
```

## Troubleshooting

### SQLite / OneDrive errors

**Symptoms:** `disk I/O error`, `database is locked`, or `migrate` fails when the project lives under OneDrive (e.g. `Desktop\foodshop`).

**Cause:** OneDrive sync can lock or corrupt `backend/db.sqlite3` while Django is writing to it.

**Fix:**

1. Move the database outside OneDrive:

   ```powershell
   mkdir C:\tmp -ErrorAction SilentlyContinue
   $env:ANNAI_DB_PATH = "C:\tmp\annai-health-masala.sqlite3"
   cd backend
   python manage.py migrate
   python manage.py seed_menu
   ```

2. Set `ANNAI_DB_PATH` in every terminal where you run `runserver` or management commands.

3. For a permanent fix, add the variable to your system environment or a local startup script.

4. Optionally pause OneDrive sync for the project folder, or move the whole repo to a non-synced path such as `C:\dev\foodshop`.

---

### CORS / API blocked in the browser

**Symptoms:** Browser console shows `blocked by CORS policy`, `No 'Access-Control-Allow-Origin' header`, or the shop loads but all API calls fail.

**Cause:** The API only allows the origin set in `ANNAI_CORS_ORIGIN`. It must match the frontend URL exactly (scheme, host, and port).

| Frontend URL | Set `ANNAI_CORS_ORIGIN` to |
|--------------|----------------------------|
| `http://localhost:5173` | `http://localhost:5173` |
| `http://127.0.0.1:5173` | `http://127.0.0.1:5173` |
| Production domain | `https://your-domain.com` |

**Fix:**

```powershell
$env:ANNAI_CORS_ORIGIN = "http://localhost:5173"
cd backend
python manage.py runserver
```

Also confirm the frontend points at the correct API:

```bash
# .env in project root
VITE_API_BASE_URL=http://127.0.0.1:8000/api
```

Restart **both** the Django server and `npm run dev` after changing env vars. Use the same host style (`localhost` vs `127.0.0.1`) in the browser, API URL, and CORS origin.

---

### Frontend shows “Demo order saved locally”

**Symptoms:** Orders, login, or admin actions work only in the browser and disappear after refresh (or use `DEMO-` order numbers).

**Cause:** The React app cannot reach the Django API and falls back to `localStorage`.

**Fix:**

1. Start the backend: `python manage.py runserver` from `backend/`.
2. Open `http://127.0.0.1:8000/api/health/` in the browser — you should see `{"status":"ok",...}`.
3. Check `VITE_API_BASE_URL` in `.env` matches the running server.
4. Fix any CORS issue (see above).
5. Restart Vite after editing `.env`.

---

### Vite slow or cache errors on OneDrive

**Symptoms:** `npm run dev` is very slow, or Vite reports cache/permission errors.

**Cause:** OneDrive can interfere with Vite’s default cache inside `node_modules`.

**Fix:** This project already sets `cacheDir: "C:/tmp/annai-vite-cache"` in `vite.config.js`. If problems persist:

```powershell
Remove-Item -Recurse -Force C:\tmp\annai-vite-cache -ErrorAction SilentlyContinue
npm run dev
```

---

### Admin PIN rejected / “Enter the correct admin PIN”

**Symptoms:** **Load Orders** or **Load Users** fails even with `1234`.

**Fix:**

1. Confirm the PIN set when starting Django matches what you type in the Admin tab.
2. In PowerShell, set it before `runserver`:

   ```powershell
   $env:ANNAI_ADMIN_PIN = "your-pin"
   python manage.py runserver
   ```

3. Staff users logged in with a bearer token from `createsuperuser` can also access admin APIs without the PIN.

---

### Order not found when tracking

**Symptoms:** “Provide the phone number or tracking PIN” or “Order not found”.

**Cause:** Order tracking requires verification for security.

**Fix:**

1. Enter the **order number** (e.g. `AHM-XXXXXXXX`).
2. Also enter the **phone number** used at checkout, **or** the **tracking PIN** shown right after placing the order.
3. If logged in with the same account used to place the order, tracking works without phone/PIN.

---

### Razorpay / online payment not showing

**Symptoms:** Only “Cash on Delivery” appears at checkout.

**Fix:**

1. Set both keys and restart Django:

   ```powershell
   $env:RAZORPAY_KEY_ID = "rzp_test_..."
   $env:RAZORPAY_KEY_SECRET = "your_secret"
   ```

2. Open `http://127.0.0.1:8000/api/payment/config/` — `online_enabled` should be `true`.
3. Ensure `razorpay` is installed: `pip install -r requirements.txt`.
4. Use Razorpay **test** keys during development.

---

### Registration or login errors

| Message | Likely cause | Fix |
|---------|--------------|-----|
| Username already taken | Account exists | Login instead, or pick another username |
| Password must be at least 8 characters | Short password | Use 8+ characters |
| Invalid phone number format | Bad phone format | Use 8–15 digits (e.g. `9876543210`) |
| Authentication required | Expired or missing token | Log in again |

Clear stale auth if needed: open browser DevTools → Application → Local Storage → remove `annai-auth`.

---

### `pip` / `python` not found (Windows)

Use the Python launcher:

```powershell
py -m pip install -r backend\requirements.txt
py backend\manage.py migrate
```

Or activate the virtual environment first:

```powershell
cd backend
.venv\Scripts\activate
python manage.py runserver
```

---

### Quick health checklist

Run these before reporting a bug:

```powershell
# 1. API health
curl http://127.0.0.1:8000/api/health/

# 2. Menu loads
curl http://127.0.0.1:8000/api/menu/

# 3. Payment config
curl http://127.0.0.1:8000/api/payment/config/
```

In the browser: Shop tab loads products, Login/Register work, Admin tab loads orders with the correct PIN.

## Notes

- All listed rates are for 1 kg quantity.
- Fresh flour varieties are saved as request notes because pricing is confirmed after customer details.
- The React app falls back to local demo mode when the Django API is offline.
- Django REST Framework is not used; the API returns plain JSON via Django views.
