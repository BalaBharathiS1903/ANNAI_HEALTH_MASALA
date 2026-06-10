import { useCallback, useEffect, useState } from "react";
import {
  Bell,
  CheckCircle2,
  ClipboardList,
  CreditCard,
  Languages,
  LogIn,
  LogOut,
  PackageCheck,
  Search,
  Send,
  ShoppingBag,
  Sparkles,
  UserCog,
  UserPlus,
  Users,
} from "lucide-react";
import { menuCategories } from "./menuData.js";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api";
const AUTH_KEY = "annai-auth";

const statusLabels = {
  received: "Order Received",
  confirmed: "Confirmed",
  grinding: "Fresh Grinding",
  packed: "Packed",
  ready: "Ready",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

function loadStoredAuth() {
  try {
    return JSON.parse(localStorage.getItem(AUTH_KEY) || "null");
  } catch {
    return null;
  }
}

function App() {
  const [view, setView] = useState("shop");
  const [language, setLanguage] = useState("en");
  const [categories, setCategories] = useState(menuCategories);
  const [cart, setCart] = useState([]);
  const [customer, setCustomer] = useState({ name: "", phone: "", address: "", notes: "" });
  const [paymentMethod, setPaymentMethod] = useState("cod");
  const [paymentOnline, setPaymentOnline] = useState(false);
  const [orderNumber, setOrderNumber] = useState("");
  const [trackPhone, setTrackPhone] = useState("");
  const [trackPin, setTrackPin] = useState("");
  const [trackedOrder, setTrackedOrder] = useState(null);
  const [lastTrackingPin, setLastTrackingPin] = useState("");
  const [auth, setAuth] = useState(loadStoredAuth);
  const [adminPin, setAdminPin] = useState("");
  const [adminTab, setAdminTab] = useState("orders");
  const [orders, setOrders] = useState([]);
  const [users, setUsers] = useState([]);
  const [adminMessage, setAdminMessage] = useState({});
  const [notice, setNotice] = useState("All rates are for 1 kg quantity.");
  const [apiOnline, setApiOnline] = useState(true);

  const cartTotal = cart.reduce((total, item) => total + item.price * item.quantity, 0);

  const authHeaders = useCallback(
    (extra = {}) => {
      const headers = { ...extra };
      if (auth?.token) headers.Authorization = `Bearer ${auth.token}`;
      return headers;
    },
    [auth],
  );

  useEffect(() => {
    fetch(`${API_BASE}/menu/`)
      .then((response) => response.json())
      .then((data) => {
        if (Array.isArray(data.categories) && data.categories.length) {
          setCategories(data.categories);
        }
        setApiOnline(true);
      })
      .catch(() => setApiOnline(false));

    fetch(`${API_BASE}/payment/config/`)
      .then((response) => response.json())
      .then((data) => setPaymentOnline(Boolean(data.online_enabled)))
      .catch(() => setPaymentOnline(false));
  }, []);

  useEffect(() => {
    if (auth?.user) {
      setCustomer((value) => ({
        name: auth.user.name || value.name,
        phone: auth.user.phone || value.phone,
        address: auth.user.address || value.address,
        notes: value.notes,
      }));
    }
  }, [auth]);

  const trackOrder = useCallback(
    async (number = orderNumber, showNotice = true) => {
      if (!number.trim()) return;
      const params = new URLSearchParams();
      if (trackPhone.trim()) params.set("phone", trackPhone.trim());
      if (trackPin.trim()) params.set("pin", trackPin.trim());
      const query = params.toString() ? `?${params}` : "";
      try {
        const response = await fetch(`${API_BASE}/orders/${number.trim()}/${query}`, {
          headers: authHeaders(),
        });
        if (!response.ok) {
          const err = await response.json().catch(() => ({}));
          throw new Error(err.error || "Not found");
        }
        const data = await response.json();
        setTrackedOrder(data.order);
        setOrderNumber(number.trim());
        if (showNotice) setNotice("Order status refreshed.");
      } catch (error) {
        const localOrder = JSON.parse(localStorage.getItem(`annai-order-${number.trim()}`) || "null");
        if (localOrder) {
          setTrackedOrder(localOrder);
          if (showNotice) setNotice("Loaded local demo order.");
        } else if (showNotice) {
          setNotice(error.message || "Order not found. Check order number and phone/PIN.");
        }
      }
    },
    [orderNumber, trackPhone, trackPin, authHeaders],
  );

  useEffect(() => {
    if (!orderNumber) return;
    const timer = window.setInterval(() => trackOrder(orderNumber, false), 10000);
    return () => window.clearInterval(timer);
  }, [orderNumber, trackOrder]);

  const copy = {
    brand: language === "ta" ? "அன்னை ஹெல்த் மசாலா" : "ANNAI HEALTH MASALA",
    tagline:
      language === "ta"
        ? "தரமான மற்றும் ஆரோக்கியமான வீட்டுத் தயாரிப்புகள்"
        : "Pure, Healthy & Homemade Quality",
    order: language === "ta" ? "ஆர்டர் செய்க" : "Place Order",
    admin: language === "ta" ? "நிர்வாகம்" : "Admin",
    login: language === "ta" ? "உள்நுழை" : "Login",
    register: language === "ta" ? "பதிவு" : "Register",
  };

  function persistAuth(nextAuth) {
    setAuth(nextAuth);
    if (nextAuth) localStorage.setItem(AUTH_KEY, JSON.stringify(nextAuth));
    else localStorage.removeItem(AUTH_KEY);
  }

  async function handleRegister(event, form) {
    event.preventDefault();
    try {
      const response = await fetch(`${API_BASE}/auth/register/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Registration failed");
      persistAuth({ user: data.user, token: data.token });
      setNotice("Account created. You are now logged in.");
      setView("shop");
    } catch (error) {
      setNotice(error.message);
    }
  }

  async function handleLogin(event, form) {
    event.preventDefault();
    try {
      const response = await fetch(`${API_BASE}/auth/login/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Login failed");
      persistAuth({ user: data.user, token: data.token });
      setNotice(`Welcome back, ${data.user.name || data.user.username}.`);
      setView("shop");
    } catch (error) {
      setNotice(error.message);
    }
  }

  async function handleLogout() {
    try {
      await fetch(`${API_BASE}/auth/logout/`, { method: "POST", headers: authHeaders() });
    } catch {
      /* offline logout is fine */
    }
    persistAuth(null);
    setNotice("Logged out.");
    setView("shop");
  }

  function addToCart(product) {
    if (!product.price) {
      setCustomer((value) => ({
        ...value,
        notes: `${value.notes ? `${value.notes}\n` : ""}${product.name}: please confirm price.`,
      }));
      setNotice("Flour request added to order notes.");
      return;
    }
    setCart((items) => {
      const existing = items.find((item) => item.id === product.id);
      if (existing) {
        return items.map((item) =>
          item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item,
        );
      }
      return [...items, { ...product, quantity: 1 }];
    });
    setNotice(`${product.name} added to cart.`);
  }

  function updateQuantity(productId, quantity) {
    const nextQuantity = Math.max(0.25, Number(quantity) || 0.25);
    setCart((items) =>
      items.map((item) => (item.id === productId ? { ...item, quantity: nextQuantity } : item)),
    );
  }

  function removeItem(productId) {
    setCart((items) => items.filter((item) => item.id !== productId));
  }

  function openRazorpayCheckout(order, payment) {
    return new Promise((resolve, reject) => {
      if (!window.Razorpay) {
        reject(new Error("Payment gateway failed to load."));
        return;
      }
      const options = {
        key: payment.razorpay_key_id,
        amount: payment.amount,
        currency: payment.currency,
        name: "ANNAI HEALTH MASALA",
        description: `Order ${order.order_number}`,
        order_id: payment.razorpay_order_id,
        handler: (response) => resolve(response),
        prefill: {
          name: order.customer_name,
          contact: order.customer_phone,
        },
        theme: { color: "#12633d" },
      };
      const rzp = new window.Razorpay(options);
      rzp.on("payment.failed", () => reject(new Error("Payment failed. Try again or use COD.")));
      rzp.open();
    });
  }

  async function verifyRazorpayPayment(orderNumber, paymentResponse) {
    const response = await fetch(`${API_BASE}/payments/verify/`, {
      method: "POST",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({
        order_number: orderNumber,
        razorpay_order_id: paymentResponse.razorpay_order_id,
        razorpay_payment_id: paymentResponse.razorpay_payment_id,
        razorpay_signature: paymentResponse.razorpay_signature,
      }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Payment verification failed");
    return data.order;
  }

  async function placeOrder(event) {
    event.preventDefault();
    if (!cart.length && !customer.notes.trim()) {
      setNotice("Please add at least one item or flour request.");
      return;
    }
    const payload = {
      customer,
      language,
      payment_method: paymentMethod,
      items: cart.map((item) => ({
        product_id: item.id,
        product_name: item.name,
        tamil_name: item.tamilName,
        quantity_kg: item.quantity,
        unit_price: item.price,
      })),
    };

    try {
      const response = await fetch(`${API_BASE}/orders/`, {
        method: "POST",
        headers: authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Order failed");

      let finalOrder = data.order;
      if (paymentMethod === "online" && data.payment) {
        const paymentResponse = await openRazorpayCheckout(data.order, data.payment);
        finalOrder = await verifyRazorpayPayment(data.order.order_number, paymentResponse);
        setNotice("Payment successful. Order confirmed.");
      } else {
        setNotice("Order placed. Save your tracking PIN below.");
      }

      setOrderNumber(finalOrder.order_number);
      setTrackedOrder(finalOrder);
      setLastTrackingPin(finalOrder.tracking_pin || "");
      setTrackPhone(customer.phone);
      setCart([]);
      setCustomer((value) => ({ ...value, notes: "" }));
    } catch (error) {
      if (!apiOnline) {
        const demoOrder = createDemoOrder(payload);
        setOrderNumber(demoOrder.order_number);
        setTrackedOrder(demoOrder);
        setCart([]);
        setNotice("Demo order saved locally because the Django API is offline.");
        return;
      }
      setNotice(error.message || "Could not place order.");
    }
  }

  async function loadAdminOrders() {
    try {
      const response = await fetch(`${API_BASE}/admin/orders/`, {
        headers: { "X-Admin-Pin": adminPin, ...authHeaders() },
      });
      if (!response.ok) throw new Error("Admin failed");
      const data = await response.json();
      setOrders(data.orders);
      setNotice("Admin orders loaded.");
    } catch {
      const localOrders = Object.keys(localStorage)
        .filter((key) => key.startsWith("annai-order-"))
        .map((key) => JSON.parse(localStorage.getItem(key)))
        .sort((a, b) => b.created_at.localeCompare(a.created_at));
      setOrders(localOrders);
      setNotice(apiOnline ? "Enter the correct admin PIN." : "Showing local demo orders.");
    }
  }

  async function loadAdminUsers() {
    try {
      const response = await fetch(`${API_BASE}/admin/users/`, {
        headers: { "X-Admin-Pin": adminPin, ...authHeaders() },
      });
      if (!response.ok) throw new Error("Admin failed");
      const data = await response.json();
      setUsers(data.users);
      setNotice("Registered users loaded.");
    } catch {
      setUsers([]);
      setNotice("Could not load users. Check admin PIN.");
    }
  }

  async function updateStatus(order, status) {
    const message = adminMessage[order.order_number] || `Your order is now ${statusLabels[status]}.`;
    try {
      const response = await fetch(`${API_BASE}/admin/orders/${order.order_number}/status/`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "X-Admin-Pin": adminPin,
          ...authHeaders(),
        },
        body: JSON.stringify({ status, message }),
      });
      if (!response.ok) throw new Error("Update failed");
      await loadAdminOrders();
      setNotice("Customer notification updated.");
    } catch {
      const updated = {
        ...order,
        status,
        events: [
          ...(order.events || []),
          { status, message, created_at: new Date().toISOString() },
        ],
      };
      localStorage.setItem(`annai-order-${order.order_number}`, JSON.stringify(updated));
      setOrders((list) =>
        list.map((item) => (item.order_number === order.order_number ? updated : item)),
      );
      setNotice("Demo order status updated locally.");
    }
  }

  return (
    <div className="app-shell">
      <header className="hero">
        <nav className="topbar" aria-label="Primary navigation">
          <a className="brand" href="#menu" aria-label="ANNAI HEALTH MASALA home">
            <span>AHM</span>
            <strong>{copy.brand}</strong>
          </a>
          <div className="nav-actions">
            <button className={view === "shop" ? "active" : ""} onClick={() => setView("shop")}>
              <ShoppingBag size={18} /> Shop
            </button>
            {auth ? (
              <>
                <span className="user-badge">{auth.user.name || auth.user.username}</span>
                <button onClick={handleLogout}>
                  <LogOut size={18} /> Logout
                </button>
              </>
            ) : (
              <>
                <button className={view === "login" ? "active" : ""} onClick={() => setView("login")}>
                  <LogIn size={18} /> {copy.login}
                </button>
                <button
                  className={view === "register" ? "active" : ""}
                  onClick={() => setView("register")}
                >
                  <UserPlus size={18} /> {copy.register}
                </button>
              </>
            )}
            <button className={view === "admin" ? "active" : ""} onClick={() => setView("admin")}>
              <UserCog size={18} /> {copy.admin}
            </button>
            <button onClick={() => setLanguage(language === "en" ? "ta" : "en")}>
              <Languages size={18} /> {language === "en" ? "தமிழ்" : "English"}
            </button>
          </div>
        </nav>
        <div className="hero-content">
          <div>
            <p className="eyebrow">
              <Sparkles size={18} /> Homemade masala and health mixes
            </p>
            <h1>{copy.brand}</h1>
            <p className="tagline">{copy.tagline}</p>
            <div className="hero-actions">
              <a href="#menu" className="primary-link">
                <ShoppingBag size={18} /> {copy.order}
              </a>
              <a href="#track" className="secondary-link">
                <Search size={18} /> Track Order
              </a>
            </div>
          </div>
          <aside className="hero-note">
            <PackageCheck size={26} />
            <strong>Freshly ground on request</strong>
            <span>Rates shown are per kg. Admin updates appear as customer notifications.</span>
          </aside>
        </div>
      </header>

      <main>
        <div className="notice" role="status">
          <Bell size={18} /> {notice}
        </div>
        {view === "shop" && (
          <>
            <section className="section intro-strip" aria-label="Business promise">
              <div>
                <strong>100% homemade quality</strong>
                <span>Clean ingredients, traditional taste, and direct order tracking.</span>
              </div>
              <div>
                <strong>ஆரோக்கியமே எங்களின் நோக்கம்</strong>
                <span>உங்கள் ஆரோக்கியமே எங்களின் முன்னுரிமை.</span>
              </div>
            </section>
            <section className="section" id="menu">
              <div className="section-heading">
                <p>Menu Card</p>
                <h2>Choose products and send your order</h2>
              </div>
              <div className="category-stack">
                {categories.map((category) => (
                  <article className="category-band" key={category.id}>
                    <div className="category-title">
                      <span>{category.icon}</span>
                      <div>
                        <h3>{language === "ta" ? category.tamilName : category.name}</h3>
                        <p>
                          {language === "ta"
                            ? category.tamilDescription || category.description
                            : category.description}
                        </p>
                      </div>
                    </div>
                    <div className="product-grid">
                      {category.products.map((product) => (
                        <article className="product-card" key={product.id}>
                          <img src={product.image || product.image_url} alt={product.name} />
                          <div className="product-body">
                            <h4>{language === "ta" ? product.tamilName : product.name}</h4>
                            <p>
                              {language === "ta"
                                ? product.tamilDescription || product.description
                                : product.description || "Fresh homemade powder"}
                            </p>
                            <div className="product-footer">
                              <strong>
                                {product.price ? `₹${product.price}/kg` : "On request"}
                              </strong>
                              <button onClick={() => addToCart(product)}>
                                <ShoppingBag size={17} /> Add
                              </button>
                            </div>
                          </div>
                        </article>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            </section>
            <OrderPanel
              cart={cart}
              customer={customer}
              setCustomer={setCustomer}
              cartTotal={cartTotal}
              placeOrder={placeOrder}
              removeItem={removeItem}
              updateQuantity={updateQuantity}
              paymentMethod={paymentMethod}
              setPaymentMethod={setPaymentMethod}
              paymentOnline={paymentOnline}
            />
            <TrackingPanel
              orderNumber={orderNumber}
              setOrderNumber={setOrderNumber}
              trackPhone={trackPhone}
              setTrackPhone={setTrackPhone}
              trackPin={trackPin}
              setTrackPin={setTrackPin}
              trackedOrder={trackedOrder}
              lastTrackingPin={lastTrackingPin}
              trackOrder={trackOrder}
            />
          </>
        )}
        {view === "login" && <LoginPage onSubmit={handleLogin} onSwitch={() => setView("register")} />}
        {view === "register" && (
          <RegisterPage onSubmit={handleRegister} onSwitch={() => setView("login")} />
        )}
        {view === "admin" && (
          <AdminPanel
            adminPin={adminPin}
            setAdminPin={setAdminPin}
            adminTab={adminTab}
            setAdminTab={setAdminTab}
            loadAdminOrders={loadAdminOrders}
            loadAdminUsers={loadAdminUsers}
            orders={orders}
            users={users}
            adminMessage={adminMessage}
            setAdminMessage={setAdminMessage}
            updateStatus={updateStatus}
          />
        )}
      </main>
      <footer>
        <strong>ANNAI HEALTH MASALA</strong>
        <span>Your Health is Our Priority.</span>
      </footer>
    </div>
  );
}

function LoginPage({ onSubmit, onSwitch }) {
  const [form, setForm] = useState({ username: "", password: "" });
  return (
    <section className="section auth-section">
      <div className="section-heading">
        <p>Account</p>
        <h2>Login to your account</h2>
      </div>
      <form className="auth-form" onSubmit={(event) => onSubmit(event, form)}>
        <input
          required
          placeholder="Username or email"
          value={form.username}
          onChange={(event) => setForm({ ...form, username: event.target.value })}
        />
        <input
          required
          type="password"
          placeholder="Password"
          value={form.password}
          onChange={(event) => setForm({ ...form, password: event.target.value })}
        />
        <button className="submit-button" type="submit">
          <LogIn size={18} /> Login
        </button>
      </form>
      <p className="auth-switch">
        New customer?{" "}
        <button type="button" className="link-button" onClick={onSwitch}>
          Create an account
        </button>
      </p>
    </section>
  );
}

function RegisterPage({ onSubmit, onSwitch }) {
  const [form, setForm] = useState({
    username: "",
    email: "",
    password: "",
    name: "",
    phone: "",
    address: "",
  });
  return (
    <section className="section auth-section">
      <div className="section-heading">
        <p>Account</p>
        <h2>Create your account</h2>
      </div>
      <form className="auth-form" onSubmit={(event) => onSubmit(event, form)}>
        <input
          required
          placeholder="Username"
          value={form.username}
          onChange={(event) => setForm({ ...form, username: event.target.value })}
        />
        <input
          type="email"
          placeholder="Email (optional)"
          value={form.email}
          onChange={(event) => setForm({ ...form, email: event.target.value })}
        />
        <input
          required
          type="password"
          placeholder="Password (min 8 characters)"
          minLength={8}
          value={form.password}
          onChange={(event) => setForm({ ...form, password: event.target.value })}
        />
        <input
          placeholder="Full name"
          value={form.name}
          onChange={(event) => setForm({ ...form, name: event.target.value })}
        />
        <input
          placeholder="Phone number"
          value={form.phone}
          onChange={(event) => setForm({ ...form, phone: event.target.value })}
        />
        <textarea
          placeholder="Default delivery address"
          value={form.address}
          onChange={(event) => setForm({ ...form, address: event.target.value })}
        />
        <button className="submit-button" type="submit">
          <UserPlus size={18} /> Register
        </button>
      </form>
      <p className="auth-switch">
        Already have an account?{" "}
        <button type="button" className="link-button" onClick={onSwitch}>
          Login here
        </button>
      </p>
    </section>
  );
}

function OrderPanel({
  cart,
  customer,
  setCustomer,
  cartTotal,
  placeOrder,
  removeItem,
  updateQuantity,
  paymentMethod,
  setPaymentMethod,
  paymentOnline,
}) {
  return (
    <section className="section order-layout" id="order">
      <div className="section-heading">
        <p>Order</p>
        <h2>Customer details</h2>
      </div>
      <div className="cart-panel">
        <h3>
          <ClipboardList size={20} /> Selected items
        </h3>
        {cart.length ? (
          <div className="cart-list">
            {cart.map((item) => (
              <div className="cart-row" key={item.id}>
                <div>
                  <strong>{item.name}</strong>
                  <span>₹{item.price}/kg</span>
                </div>
                <input
                  type="number"
                  min="0.25"
                  step="0.25"
                  value={item.quantity}
                  onChange={(event) => updateQuantity(item.id, event.target.value)}
                  aria-label={`${item.name} quantity in kg`}
                />
                <button className="icon-button" onClick={() => removeItem(item.id)} aria-label="Remove item">
                  ×
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="empty-state">No products selected yet.</p>
        )}
        <strong className="total">Total: ₹{cartTotal.toFixed(2)}</strong>
        <div className="payment-options">
          <p>
            <CreditCard size={18} /> Payment method
          </p>
          <label className={paymentMethod === "cod" ? "active" : ""}>
            <input
              type="radio"
              name="payment"
              value="cod"
              checked={paymentMethod === "cod"}
              onChange={() => setPaymentMethod("cod")}
            />
            Cash on Delivery
          </label>
          {paymentOnline && (
            <label className={paymentMethod === "online" ? "active" : ""}>
              <input
                type="radio"
                name="payment"
                value="online"
                checked={paymentMethod === "online"}
                onChange={() => setPaymentMethod("online")}
              />
              Pay Online (Razorpay)
            </label>
          )}
        </div>
      </div>
      <form className="order-form" onSubmit={placeOrder}>
        <input
          required
          placeholder="Customer name"
          value={customer.name}
          onChange={(event) => setCustomer({ ...customer, name: event.target.value })}
        />
        <input
          required
          placeholder="Phone number"
          value={customer.phone}
          onChange={(event) => setCustomer({ ...customer, phone: event.target.value })}
        />
        <textarea
          required
          placeholder="Delivery address"
          value={customer.address}
          onChange={(event) => setCustomer({ ...customer, address: event.target.value })}
        />
        <textarea
          placeholder="Special request, flour variety, or delivery notes"
          value={customer.notes}
          onChange={(event) => setCustomer({ ...customer, notes: event.target.value })}
        />
        <button className="submit-button" type="submit">
          <Send size={18} /> {paymentMethod === "online" ? "Pay & Place Order" : "Send Order"}
        </button>
      </form>
    </section>
  );
}

function TrackingPanel({
  orderNumber,
  setOrderNumber,
  trackPhone,
  setTrackPhone,
  trackPin,
  setTrackPin,
  trackedOrder,
  lastTrackingPin,
  trackOrder,
}) {
  return (
    <section className="section track-panel" id="track">
      <div className="section-heading">
        <p>Status</p>
        <h2>Track customer notification</h2>
      </div>
      <div className="track-search">
        <input
          placeholder="Order number"
          value={orderNumber}
          onChange={(event) => setOrderNumber(event.target.value)}
        />
        <input
          placeholder="Phone used in order"
          value={trackPhone}
          onChange={(event) => setTrackPhone(event.target.value)}
        />
        <input
          placeholder="Tracking PIN"
          value={trackPin}
          onChange={(event) => setTrackPin(event.target.value)}
        />
        <button onClick={() => trackOrder()}>
          <Search size={18} /> Track
        </button>
      </div>
      {lastTrackingPin && (
        <p className="tracking-pin-notice">
          Your tracking PIN: <strong>{lastTrackingPin}</strong> — save this to track your order.
        </p>
      )}
      {trackedOrder && (
        <article className="status-card">
          <div>
            <p>Order #{trackedOrder.order_number}</p>
            <h3>{statusLabels[trackedOrder.status] || trackedOrder.status}</h3>
            {trackedOrder.payment_status && (
              <span className="payment-badge">
                Payment: {trackedOrder.payment_status} ({trackedOrder.payment_method})
              </span>
            )}
          </div>
          <div className="timeline">
            {(trackedOrder.events || []).map((event, index) => (
              <div className="timeline-row" key={`${event.status}-${index}`}>
                <CheckCircle2 size={18} />
                <div>
                  <strong>{statusLabels[event.status] || event.status}</strong>
                  <span>{event.message}</span>
                </div>
              </div>
            ))}
          </div>
        </article>
      )}
    </section>
  );
}

function AdminPanel({
  adminPin,
  setAdminPin,
  adminTab,
  setAdminTab,
  loadAdminOrders,
  loadAdminUsers,
  orders,
  users,
  adminMessage,
  setAdminMessage,
  updateStatus,
}) {
  return (
    <section className="section admin-section">
      <div className="section-heading">
        <p>Admin Dashboard</p>
        <h2>Manage orders and registered users</h2>
      </div>
      <div className="admin-login">
        <input
          type="password"
          placeholder="Admin PIN"
          value={adminPin}
          onChange={(event) => setAdminPin(event.target.value)}
        />
        <button onClick={loadAdminOrders}>
          <ClipboardList size={18} /> Load Orders
        </button>
        <button onClick={loadAdminUsers}>
          <Users size={18} /> Load Users
        </button>
      </div>
      <div className="admin-tabs">
        <button
          className={adminTab === "orders" ? "active" : ""}
          onClick={() => setAdminTab("orders")}
        >
          <ClipboardList size={16} /> Orders ({orders.length})
        </button>
        <button
          className={adminTab === "users" ? "active" : ""}
          onClick={() => setAdminTab("users")}
        >
          <Users size={16} /> Users ({users.length})
        </button>
      </div>
      {adminTab === "orders" ? (
        <div className="orders-grid">
          {orders.map((order) => (
            <article className="admin-order" key={order.order_number}>
              <div className="order-topline">
                <div>
                  <p>#{order.order_number}</p>
                  <h3>{order.customer_name}</h3>
                  <span>{order.customer_phone}</span>
                  {order.order_total != null && <span>₹{Number(order.order_total).toFixed(2)}</span>}
                </div>
                <strong>{statusLabels[order.status] || order.status}</strong>
              </div>
              <div className="ordered-items">
                {(order.items || []).map((item, index) => (
                  <span key={`${item.product_name}-${index}`}>
                    {item.product_name} × {item.quantity_kg}kg
                  </span>
                ))}
              </div>
              <textarea
                placeholder="Message shown to customer"
                value={adminMessage[order.order_number] || ""}
                onChange={(event) =>
                  setAdminMessage({ ...adminMessage, [order.order_number]: event.target.value })
                }
              />
              <div className="status-actions">
                {Object.keys(statusLabels).map((status) => (
                  <button key={status} onClick={() => updateStatus(order, status)}>
                    {statusLabels[status]}
                  </button>
                ))}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="users-table-wrap">
          <table className="users-table">
            <thead>
              <tr>
                <th>Username</th>
                <th>Name</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Orders</th>
                <th>Joined</th>
              </tr>
            </thead>
            <tbody>
              {users.length ? (
                users.map((user) => (
                  <tr key={user.id}>
                    <td>{user.username}</td>
                    <td>{user.name}</td>
                    <td>{user.email || "—"}</td>
                    <td>{user.phone || "—"}</td>
                    <td>{user.order_count}</td>
                    <td>{new Date(user.date_joined).toLocaleDateString()}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="empty-state">
                    Click &quot;Load Users&quot; after entering the admin PIN.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function createDemoOrder(payload) {
  const order = {
    order_number: `DEMO-${Date.now().toString().slice(-6)}`,
    customer_name: payload.customer.name,
    customer_phone: payload.customer.phone,
    customer_address: payload.customer.address,
    customer_notes: payload.customer.notes,
    status: "received",
    payment_method: payload.payment_method || "cod",
    payment_status: "pending",
    order_total: payload.items.reduce(
      (sum, item) => sum + Number(item.unit_price) * Number(item.quantity_kg),
      0,
    ),
    tracking_pin: String(Math.floor(1000 + Math.random() * 9000)),
    created_at: new Date().toISOString(),
    items: payload.items,
    events: [
      {
        status: "received",
        message: "Your order has been received.",
        created_at: new Date().toISOString(),
      },
    ],
  };
  localStorage.setItem(`annai-order-${order.order_number}`, JSON.stringify(order));
  return order;
}

export default App;
