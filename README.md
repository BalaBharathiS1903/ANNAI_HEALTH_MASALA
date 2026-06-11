# ANNAI HEALTH MASALA

A bilingual (English / Tamil) food ordering website for **Annai Health Foods, Samayapuram, Trichy**.

Built with React 18 + Vite (frontend) and Django 5 (backend). No Django REST Framework — plain JSON views.

---

## Features

- Bilingual menu (English / Tamil) with product images and prices per kg.
- Customer **login and registration required** before checkout.
- Cart → Checkout → Pay → Track full e-commerce flow.
- **Payment options:** Cash on Delivery and online payment via **Razorpay** (UPI, Cards, Net Banking, Wallets).
- Secure order tracking using phone number or tracking PIN.
- **Order receipt email** sent to customer on order placement.
- **Payment confirmation email** sent when admin marks payment as received.
- **Status update email** sent to customer on every admin action.
- Admin dashboard for order management, status updates, and customer notifications.
- Django admin at `/admin/` for full catalog and order management.
- SQLite database with seed data for the complete menu.
- Product images served from `public/` folder.
- FSSAI license number and logo displayed in footer.
- Contact details and Google Maps link in footer.
- Copyright footer.

---

## Project Structure

```
.
├── backend/
│   ├── annai_backend/        # settings.py, urls.py, CORS middleware
│   ├── orders/               # models.py, views.py, auth_helpers.py, urls.py
│   ├── manage.py
│   └── requirements.txt
├── src/
│   ├── App.jsx               # React frontend — all UI components
│   ├── menuData.js           # Static menu categories and products
│   └── styles.css            # All styles
├── public/
│   ├── logo.png
│   ├── fssaiimage.png
│   └── (product images)
├── assts/                    # Source images (copy to public/ before use)
├── index.html
├── package.json
├── vite.config.js
├── .env                      # Local environment variables (not committed)
└── .env.example              # Template for environment variables
```

---

## Quick Start

### 1. Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate        # Windows
pip install -r requirements.txt
python manage.py migrate
python manage.py seed_menu
python manage.py createsuperuser
python manage.py runserver
```

API runs at `http://127.0.0.1:8000/api/`.

### 2. Frontend

Open a second terminal from the project root:

```bash
npm install
npm run dev
```

React app runs at `http://localhost:5173/`.

### 3. Environment Variables

Copy `.env.example` to `.env` in the project root:

```env
# Frontend (Vite)
VITE_API_BASE_URL=http://127.0.0.1:8000/api
VITE_RAZORPAY_KEY_ID=rzp_test_XXXXXXXXXXXXXXXX   # public key — safe in frontend

# Django
DJANGO_SECRET_KEY=change-this-to-a-long-random-string
DJANGO_DEBUG=1
DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1
ANNAI_ADMIN_PIN=1234
ANNAI_CORS_ORIGIN=http://localhost:5173

# SQLite path (move outside OneDrive to avoid I/O errors)
ANNAI_DB_PATH=C:\tmp\annai-health-masala.sqlite3

# Razorpay — backend only, NEVER prefix secret with VITE_
RAZORPAY_KEY_ID=rzp_test_XXXXXXXXXXXXXXXX
RAZORPAY_KEY_SECRET=your_secret_key_here

# Email (for order receipts and notifications)
EMAIL_BACKEND=django.core.mail.backends.console.EmailBackend
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_HOST_USER=your@gmail.com
EMAIL_HOST_PASSWORD=your-app-password
DEFAULT_FROM_EMAIL=ANNAI HEALTH MASALA <your@gmail.com>
ADMIN_EMAIL=your@gmail.com
```

> **WARNING:** Never rename `RAZORPAY_KEY_SECRET` to `VITE_RAZORPAY_KEY_SECRET`.
> Variables prefixed with `VITE_` are bundled into the public JS build and visible to everyone.

Restart both servers after editing `.env`.

---

## Admin Account

The default admin account created after `createsuperuser` or via the shell:

| Field    | Value             |
|----------|-------------------|
| Username | `admin`           |
| Password | `admin123`        |
| Email    | `admin@gmail.com` |

Login at the Account tab — the admin dashboard opens automatically for staff users.

---

## Customer Workflow

1. Browse the menu (English or Tamil).
2. Add products to cart.
3. Click **Proceed to Payment** — redirected to login if not logged in.
4. Login or register, then return to checkout.
5. Select payment method (COD or online via Razorpay).
6. Fill delivery details (pre-filled from account).
7. Place order — receive order number and tracking PIN.
8. Receipt email sent automatically.
9. Track order status on the site using order number + phone or PIN.

---

## Admin Workflow

1. Login with staff account — admin dashboard opens automatically.
2. **Overview tab:** stats, revenue, product sales analytics, recent orders.
3. **Track Orders tab:** view all orders as cards.
   - Click status buttons (Confirmed / Fresh Grinding / Packed / Ready / Delivered) — customer gets email notification.
   - Type a message and click **Send update** — message saved in timeline and emailed to customer.
   - Click **Cash Received** on pending orders — payment marked as paid, full receipt emailed to customer.
4. **Customers tab:** view registered users, order counts, contact details.
5. **Payments tab:** view all payment records with method and status.
6. Use Django admin at `http://127.0.0.1:8000/admin/` for full catalog management.

---

## Payment Integration (Razorpay)

Supported methods (all via Razorpay — no extra SDKs):

| Method | Details |
|--------|---------|
| UPI | Google Pay, PhonePe, Paytm UPI, BHIM, any UPI VPA, QR code |
| Cards | Visa, Mastercard, RuPay, Amex — debit and credit with 3D Secure |
| Net Banking | SBI, HDFC, ICICI, Axis, Kotak and all supported banks |
| Wallets | Paytm wallet, Amazon Pay |

### Setup

1. Create a Razorpay account at [razorpay.com](https://razorpay.com).
2. Get test keys from **Settings → API Keys**.
3. Add to `.env`:
   ```
   VITE_RAZORPAY_KEY_ID=rzp_test_...
   RAZORPAY_KEY_ID=rzp_test_...
   RAZORPAY_KEY_SECRET=your_secret
   ```
4. Restart both servers.

### Webhook (for production)

1. Go to Razorpay Dashboard → **Settings → Webhooks → Add New Webhook**.
2. URL: `https://yourdomain.com/api/payments/webhook/`
3. Select event: `payment.captured`.
4. Set a webhook secret and add it as `RAZORPAY_KEY_SECRET` in your `.env`.
5. Use the **Test Webhook** button to verify.

### Test Credentials

| Method | Details |
|--------|---------|
| Card | `4111 1111 1111 1111`, any future expiry, any CVV |
| UPI | `success@razorpay` |

---

## Email Notifications

Three automatic emails are sent to customers:

| Trigger | Email sent |
|---------|-----------|
| Order placed | Order receipt with items, total, tracking PIN, address |
| Admin clicks Cash Received | Full payment confirmation receipt |
| Admin updates status or sends message | Status update with current status and message |

To enable real email sending, update `.env`:

```env
EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend
EMAIL_HOST_USER=your@gmail.com
EMAIL_HOST_PASSWORD=your-gmail-app-password
```

Generate a Gmail App Password at: **Google Account → Security → App Passwords**.

Until configured, emails print to the Django terminal (console backend).

---

## API Endpoints

Base URL: `http://127.0.0.1:8000/api/`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/health/` | — | Health check |
| GET | `/menu/` | — | Product categories and items |
| GET | `/payment/config/` | — | Online payment availability |
| POST | `/auth/register/` | — | Create customer account |
| POST | `/auth/login/` | — | Login, returns bearer token |
| POST | `/auth/logout/` | Bearer | Logout |
| GET | `/auth/me/` | Bearer | Current user profile |
| POST | `/orders/` | Bearer | Place order |
| GET | `/orders/my/` | Bearer | My order history |
| GET | `/orders/<order_number>/?phone=&pin=` | Bearer (optional) | Track order |
| POST | `/payments/create-order/` | Bearer | Create Razorpay order (amount from DB) |
| POST | `/payments/verify/` | Bearer | Verify Razorpay payment signature |
| POST | `/payments/webhook/` | Razorpay signature | Handle payment captured event |
| GET | `/admin/dashboard/` | Staff | Stats, analytics, recent orders |
| GET | `/admin/orders/` | Staff | All orders |
| PATCH | `/admin/orders/<order_number>/status/` | Staff | Update order status + email customer |
| POST | `/admin/orders/<order_number>/notify/` | Staff | Send message + optional payment status |
| GET | `/admin/payments/` | Staff | All payment records |
| GET | `/admin/users/` | Staff | Registered customers |
| GET | `/admin/users/<id>/` | Staff | Customer detail with orders and payments |

**Auth header:** `Authorization: Bearer <token>`

**Staff auth:** Login with a superuser account — bearer token is used for all admin endpoints.

---

## Security

| Protection | Implementation |
|------------|---------------|
| Login required | Customers must register/login before checkout |
| Server-side pricing | Order totals calculated from DB prices, never from client input |
| HMAC signature | Razorpay payments verified with `hmac.compare_digest()` |
| Order tracking | Requires phone or tracking PIN (or logged-in ownership) |
| CORS | Restricted to `ANNAI_CORS_ORIGIN` |
| Input sanitization | Customer fields trimmed and length-limited |
| Quantity limits | 0.25 kg minimum, 100 kg maximum per line item |
| Token auth | Bearer tokens stored server-side, cleared on logout |
| Secret keys | Only in `os.environ`, never hardcoded or exposed via `VITE_` prefix |

### Before going to production

- Set a strong `DJANGO_SECRET_KEY`.
- Set `DJANGO_DEBUG=0`.
- Change `ANNAI_ADMIN_PIN` from the default `1234`.
- Configure `DJANGO_ALLOWED_HOSTS` and `ANNAI_CORS_ORIGIN` for your domain.
- Switch to PostgreSQL instead of SQLite.
- Add HTTPS and rate limiting.
- Replace Razorpay test keys with live keys.

---

## Troubleshooting

### SQLite / OneDrive errors

**Symptom:** `disk I/O error`, `database is locked`, or `migrate` fails.

**Cause:** OneDrive sync locks SQLite files.

**Fix:**
```powershell
mkdir C:\tmp
$env:ANNAI_DB_PATH = "C:\tmp\annai-health-masala.sqlite3"
cd backend
python manage.py migrate
python manage.py seed_menu
```

Add `ANNAI_DB_PATH=C:\tmp\annai-health-masala.sqlite3` to your `.env`.

---

### Only COD shows in payment options

**Cause:** `VITE_RAZORPAY_KEY_ID` or `RAZORPAY_KEY_ID` is empty in `.env`.

**Fix:** Add both keys to `.env` and restart both servers.

Check: `http://127.0.0.1:8000/api/payment/config/` should return `"online_enabled": true`.

---

### Frontend shows "Demo order saved locally"

**Cause:** React cannot reach the Django API and falls back to localStorage.

**Fix:**
1. Start Django: `python manage.py runserver` from `backend/`.
2. Open `http://127.0.0.1:8000/api/health/` — should return `{"status": "ok"}`.
3. Check `VITE_API_BASE_URL` in `.env` matches the running server.
4. Restart Vite after editing `.env`.

---

### CORS errors in browser

**Symptom:** `blocked by CORS policy` in browser console.

**Fix:** Set `ANNAI_CORS_ORIGIN` to match the frontend URL exactly:

```env
ANNAI_CORS_ORIGIN=http://localhost:5173
```

Use the same host (`localhost` vs `127.0.0.1`) in the browser, API URL, and CORS origin.

---

### Admin login rejected

**Symptom:** "Please enter the correct username and password for a staff account."

**Cause:** The new database at `C:\tmp\` has no users.

**Fix:**
```powershell
$env:ANNAI_DB_PATH = "C:\tmp\annai-health-masala.sqlite3"
cd backend
python manage.py shell -c "from django.contrib.auth.models import User; User.objects.create_superuser('admin','admin@gmail.com','admin123')"
```

---

### Images showing wrong or old

**Cause:** The database stores old Unsplash URLs. The API response overrides `menuData.js`.

**Fix:** Update image URLs directly in the database:
```powershell
$env:ANNAI_DB_PATH = "C:\tmp\annai-health-masala.sqlite3"
cd backend
python manage.py shell -c "
from orders.models import Product
updates = {
    'Turmeric Powder': '/turmeric.jpg',
    'Chili Powder': '/redchill.png',
    'Coriander Powder': '/coriander.jpg',
    'Idli Podi / Lentil Podi': '/idlipodi.jpg',
    'Curry Leaf Podi': '/curryleafpodi.jpg',
    'Health Mix Powder': '/healthmix.jpg',
    'Fiber & Iron Rich Health Mix': '/fiberhealthmix.jpg',
    'Ready-to-use Bajji Mix': '/bajji.png',
}
for name, url in updates.items():
    Product.objects.filter(name=name).update(image_url=url)
    print(name, '->', url)
"
```

---

## Useful Commands

```bash
# Frontend
npm run dev                         # Start dev server
npm run build                       # Production build
npm run preview                     # Preview production build

# Backend
python manage.py runserver          # Start Django dev server
python manage.py migrate            # Apply migrations
python manage.py makemigrations     # Create new migrations
python manage.py seed_menu          # Seed product catalog
python manage.py createsuperuser    # Create admin user
python manage.py check              # Check for Django errors
```

---

## Store Information

**Annai Health Foods**
Madakkudi, Pallividai, Samayapuram, Trichy - 621 112

Customer Care: **70104 82463** | **83448 80228**

FSSAI Licence No.: **22420308000104**

---

## Notes

- All listed rates are for 1 kg quantity.
- Fresh flour varieties (Ragi, Wheat, Barley, etc.) are priced on request — added to order notes.
- The React app falls back to local demo mode when the Django API is offline.
- Django REST Framework is not used — all API views return plain JSON.
