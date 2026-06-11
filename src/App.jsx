import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Banknote,
  Bell,
  CheckCircle2,
  ChevronLeft,
  ClipboardList,
  CreditCard,
  IndianRupee,
  Landmark,
  Languages,
  LogIn,
  LogOut,
  MapPin,
  Package,
  PackageCheck,
  Phone,
  Search,
  Send,
  ShoppingBag,
  ShoppingCart,
  Smartphone,
  TrendingUp,
  User,
  UserCog,
  UserPlus,
  Users,
  Wallet,
} from "lucide-react";
import { menuCategories } from "./menuData.js";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api";
const AUTH_KEY = "annai-auth";

const statusLabels = {
  received: "Order Received",
  confirmed: "Confirmed",
  grinding: "Fresh Grinding",
  packed: "Packed",
  ready: "Ready for Pickup",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

const paymentStatusLabels = {
  pending: "Pending",
  paid: "Paid",
  failed: "Failed",
  refunded: "Refunded",
};

const paymentMethodLabels = {
  cod: "Cash on Delivery",
  card: "Debit / Credit Card",
  netbanking: "Net Banking",
  upi: "UPI",
  wallet: "Payment Apps",
  online: "Online Payment",
};

const PAYMENT_METHODS = [
  { id: "cod",        label: "Cash on Delivery",    description: "Pay cash when order is delivered",      icon: Banknote,  online: false },
  { id: "upi",        label: "UPI",                  description: "Google Pay, PhonePe, Paytm UPI",        icon: Smartphone, online: true },
  { id: "wallet",     label: "Payment Apps",         description: "PhonePe, Paytm, Amazon Pay wallets",   icon: Wallet,    online: true },
  { id: "card",       label: "Debit / Credit Card",  description: "Visa, Mastercard, RuPay",               icon: CreditCard, online: true },
  { id: "netbanking", label: "Net Banking",          description: "All major Indian banks",                icon: Landmark,  online: true },
];

const ONLINE_METHODS = new Set(["upi", "wallet", "card", "netbanking", "online"]);

function isOnlinePayment(method) {
  return ONLINE_METHODS.has(method);
}

function loadRazorpayScript() {
  return new Promise((resolve) => {
    if (window.Razorpay) { resolve(true); return; }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

async function handleRazorpayPayment({ annaiOrder, customerName, customerPhone, authHeaders, onSuccess, onFailure }) {
  const loaded = await loadRazorpayScript();
  if (!loaded) { onFailure("Payment gateway failed to load. Please try again."); return; }

  let rzOrderData;
  try {
    const res = await fetch(`${API_BASE}/payments/create-order/`, {
      method: "POST",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ annai_order_number: annaiOrder.order_number }),
    });
    rzOrderData = await res.json();
    if (!res.ok) throw new Error(rzOrderData.error || "Could not create payment order");
  } catch (e) {
    onFailure(e.message);
    return;
  }

  const options = {
    key: import.meta.env.VITE_RAZORPAY_KEY_ID,
    amount: rzOrderData.amount,
    currency: "INR",
    name: "Annai Health Masala",
    description: `Order ${annaiOrder.order_number}`,
    order_id: rzOrderData.razorpay_order_id,
    prefill: { name: customerName, contact: customerPhone },
    config: {
      display: {
        blocks: {
          upi:  { name: "UPI / GPay / PhonePe / Paytm", instruments: [{ method: "upi" }] },
          card: { name: "Debit / Credit Card",           instruments: [{ method: "card" }] },
          nb:   { name: "Net Banking",                   instruments: [{ method: "netbanking" }] },
        },
        sequence: ["block.upi", "block.card", "block.nb"],
        preferences: { show_default_blocks: true },
      },
    },
    theme: { color: "#12633d" },
    handler: async (response) => {
      try {
        const vres = await fetch(`${API_BASE}/payments/verify/`, {
          method: "POST",
          headers: authHeaders({ "Content-Type": "application/json" }),
          body: JSON.stringify({
            razorpay_order_id:   response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature:  response.razorpay_signature,
            annai_order_number:  annaiOrder.order_number,
          }),
        });
        const vdata = await vres.json();
        if (vres.ok && vdata.order) onSuccess(response.razorpay_payment_id);
        else onFailure(vdata.error || "Payment verification failed. Contact support.");
      } catch {
        onFailure("Payment verification error. Contact support.");
      }
    },
    modal: { ondismiss: () => onFailure("Payment cancelled.") },
  };

  const rzp = new window.Razorpay(options);
  rzp.on("payment.failed", (e) => onFailure(e.error?.description || "Payment failed."));
  rzp.open();
}

function loadStoredAuth() {
  try {
    return JSON.parse(localStorage.getItem(AUTH_KEY) || "null");
  } catch {
    return null;
  }
}

function formatMoney(value) {
  return `₹${Number(value || 0).toFixed(2)}`;
}

function formatDate(value) {
  return new Date(value).toLocaleString("en-IN", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

async function downloadAdminFile(url, filename, headers, expectedMimePart) {
  const response = await fetch(url, { headers });
  if (!response.ok) {
    let message = "Export failed";
    try { const data = await response.json(); message = data.error || message; } catch { /* non-JSON */ }
    throw new Error(message);
  }
  const blob = await response.blob();
  const contentType = blob.type || response.headers.get("Content-Type") || "";
  if (expectedMimePart && !contentType.includes(expectedMimePart)) {
    throw new Error("Server returned an unexpected file type. Please log in again and retry.");
  }
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = filename;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  setTimeout(() => { URL.revokeObjectURL(objectUrl); link.remove(); }, 2000);
}

function App() {
  const [view, setView] = useState("shop");
  const [language, setLanguage] = useState("en");
  const [categories, setCategories] = useState(menuCategories);
  const [cart, setCart] = useState([]);
  const [toast, setToast] = useState(null);
  const [customer, setCustomer] = useState({ name: "", phone: "", email: "", address: "", notes: "" });
  const [shopStep, setShopStep] = useState("browse");
  const [paymentMethod, setPaymentMethod] = useState("cod");
  const [paymentOnline, setPaymentOnline] = useState(false);
  const [orderNumber, setOrderNumber] = useState("");
  const [trackPhone, setTrackPhone] = useState("");
  const [trackPin, setTrackPin] = useState("");
  const [trackedOrder, setTrackedOrder] = useState(null);
  const [lastTrackingPin, setLastTrackingPin] = useState("");
  const [auth, setAuth] = useState(loadStoredAuth);
  const [myOrders, setMyOrders] = useState([]);
  const [adminTab, setAdminTab] = useState("overview");
  const [dashboard, setDashboard] = useState(null);
  const [orders, setOrders] = useState([]);
  const [payments, setPayments] = useState([]);
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [adminMessage, setAdminMessage] = useState({});
  const [notice, setNotice] = useState("All rates are for 1 kg quantity.");
  const [apiOnline, setApiOnline] = useState(true);

  const cartTotal = cart.reduce((total, item) => total + item.price * item.quantity, 0);
  const cartCount = cart.length;

  const authHeaders = useCallback(
    (extra = {}) => {
      const headers = { ...extra };
      if (auth?.token) headers.Authorization = `Bearer ${auth.token}`;
      return headers;
    },
    [auth],
  );

  const adminHeaders = useCallback(() => authHeaders(), [authHeaders]);

  useEffect(() => {
    const localImageMap = {};
    menuCategories.forEach(cat => cat.products.forEach(p => { if (p.image) localImageMap[p.id] = p.image; }));

    fetch(`${API_BASE}/menu/`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data.categories) && data.categories.length) {
          setCategories(data.categories.map(cat => ({
            ...cat,
            products: cat.products.map(p => ({ ...p, image: localImageMap[p.id] || p.image })),
          })));
        }
        setApiOnline(true);
      })
      .catch(() => setApiOnline(false));

    fetch(`${API_BASE}/payment/config/`)
      .then((r) => r.json())
      .then((data) => setPaymentOnline(Boolean(data.online_enabled)))
      .catch(() => setPaymentOnline(false));
  }, []);

  useEffect(() => {
    if (auth?.user) {
      setCustomer((v) => ({
        name: auth.user.name || v.name,
        phone: auth.user.phone || v.phone,
        email: auth.user.email || v.email,
        address: auth.user.address || v.address,
        notes: v.notes,
      }));
    }
  }, [auth?.user?.id]);

  const trackOrder = useCallback(
    async (number = orderNumber, showNotice = true) => {
      if (!number.trim()) return;
      const params = new URLSearchParams();
      if (trackPhone.trim()) params.set("phone", trackPhone.trim());
      if (trackPin.trim()) params.set("pin", trackPin.trim());
      const query = params.toString() ? `?${params}` : "";
      try {
        const response = await fetch(`${API_BASE}/orders/${number.trim()}/${query}`, { headers: authHeaders() });
        if (!response.ok) { const err = await response.json().catch(() => ({})); throw new Error(err.error || "Not found"); }
        const data = await response.json();
        setTrackedOrder(data.order);
        setOrderNumber(number.trim());
        if (showNotice) setNotice("Order status refreshed.");
      } catch (error) {
        let localOrder = null;
        try { localOrder = JSON.parse(localStorage.getItem(`annai-order-${number.trim()}`) || "null"); } catch { localOrder = null; }
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

  const loadMyOrders = useCallback(async () => {
    if (!auth?.token) return;
    try {
      const r = await fetch(`${API_BASE}/orders/my/`, { headers: authHeaders() });
      if (!r.ok) throw new Error("Failed");
      const data = await r.json();
      setMyOrders(data.orders || []);
    } catch { setMyOrders([]); }
  }, [auth?.token, authHeaders]);

  const loadDashboard = useCallback(async () => {
    try {
      const r = await fetch(`${API_BASE}/admin/dashboard/`, { headers: adminHeaders() });
      if (!r.ok) throw new Error("Failed");
      setDashboard(await r.json());
    } catch { setDashboard(null); }
  }, [adminHeaders]);

  const loadAdminOrders = useCallback(async () => {
    try {
      const r = await fetch(`${API_BASE}/admin/orders/`, { headers: adminHeaders() });
      if (!r.ok) throw new Error("Failed");
      const data = await r.json();
      setOrders(data.orders || []);
      setNotice("Orders loaded.");
    } catch { setOrders([]); setNotice(apiOnline ? "Admin login required." : "API offline."); }
  }, [adminHeaders, apiOnline]);

  const loadAdminUsers = useCallback(async () => {
    try {
      const r = await fetch(`${API_BASE}/admin/users/`, { headers: adminHeaders() });
      if (!r.ok) throw new Error("Failed");
      const data = await r.json();
      setUsers(data.users || []);
      setNotice("Users loaded.");
    } catch { setUsers([]); setNotice("Could not load users."); }
  }, [adminHeaders]);

  const loadAdminPayments = useCallback(async () => {
    try {
      const r = await fetch(`${API_BASE}/admin/payments/`, { headers: adminHeaders() });
      if (!r.ok) throw new Error("Failed");
      const data = await r.json();
      setPayments(data.payments || []);
      setNotice("Payments loaded.");
    } catch { setPayments([]); setNotice("Could not load payments."); }
  }, [adminHeaders]);

  const loadUserDetail = useCallback(async (userId) => {
    try {
      const r = await fetch(`${API_BASE}/admin/users/${userId}/`, { headers: adminHeaders() });
      if (!r.ok) throw new Error("Failed");
      const data = await r.json();
      setSelectedUser(data);
      setAdminTab("user-detail");
    } catch { setNotice("Could not load user details."); }
  }, [adminHeaders]);

  function persistAuth(nextAuth) {
    setAuth(nextAuth);
    if (nextAuth) localStorage.setItem(AUTH_KEY, JSON.stringify(nextAuth));
    else localStorage.removeItem(AUTH_KEY);
  }

  async function handleRegister(event, form) {
    event.preventDefault();
    try {
      const r = await fetch(`${API_BASE}/auth/register/`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Registration failed");
      persistAuth({ user: data.user, token: data.token });
      setNotice("Account created. Welcome!");
      setView("account");
    } catch (error) { setNotice(error.message); }
  }

  async function handleLogin(event, form) {
    event.preventDefault();
    try {
      const r = await fetch(`${API_BASE}/auth/login/`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Login failed");
      persistAuth({ user: data.user, token: data.token });
      setNotice(data.user.is_staff ? `Admin login successful. Welcome, ${data.user.name || data.user.username}.` : `Welcome back, ${data.user.name || data.user.username}!`);
      setView("account");
    } catch (error) { setNotice(error.message); }
  }

  async function handleLogout() {
    try { await fetch(`${API_BASE}/auth/logout/`, { method: "POST", headers: authHeaders() }); } catch { /* offline ok */ }
    persistAuth(null);
    setMyOrders([]);
    setSelectedUser(null);
    setNotice("Logged out.");
    setView("shop");
  }

  function addToCart(product) {
    if (!product.price) {
      setCustomer((v) => ({ ...v, notes: `${v.notes ? `${v.notes}\n` : ""}${product.name}: please confirm price.` }));
      setToast({ text: `${product.name} request added to notes.`, type: "info" });
      return;
    }
    setCart((items) => {
      const existing = items.find((i) => i.id === product.id);
      if (existing) {
        setToast({ text: `${product.name} quantity updated!`, type: "success" });
        return items.map((i) => i.id === product.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      setToast({ text: `${product.name} added to cart!`, type: "success" });
      return [...items, { ...product, quantity: 1 }];
    });
    setShopStep("cart");
  }

  function openCart() {
    setView("shop");
    setShopStep("cart");
    setTimeout(() => document.getElementById("cart")?.scrollIntoView({ behavior: "smooth" }), 50);
  }

  function updateQuantity(productId, quantity) {
    const next = Math.max(0.25, Number(quantity) || 0.25);
    setCart((items) => items.map((i) => i.id === productId ? { ...i, quantity: next } : i));
  }

  function removeItem(productId) {
    setCart((items) => items.filter((i) => i.id !== productId));
  }

  async function placeOrder(event) {
    event.preventDefault();
    if (!cart.length && !customer.notes.trim()) { setNotice("Please add at least one item or flour request."); return; }
    const payload = {
      customer, language, payment_method: paymentMethod,
      items: cart.map((item) => ({ product_id: item.id, product_name: item.name, tamil_name: item.tamilName, quantity_kg: item.quantity, unit_price: item.price })),
    };
    try {
      const r = await fetch(`${API_BASE}/orders/`, { method: "POST", headers: authHeaders({ "Content-Type": "application/json" }), body: JSON.stringify(payload) });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Order failed");

      let finalOrder = data.order;
      if (isOnlinePayment(paymentMethod) && paymentOnline) {
        await new Promise((resolve, reject) => {
          handleRazorpayPayment({
            annaiOrder: data.order, customerName: customer.name, customerPhone: customer.phone, authHeaders,
            onSuccess: async (paymentId) => {
              finalOrder = { ...data.order, payment_status: "paid", razorpay_payment_id: paymentId };
              setNotice("Payment successful! Your order is confirmed.");
              resolve();
            },
            onFailure: (msg) => { setNotice(msg || "Payment failed. Try Cash on Delivery."); reject(new Error(msg)); },
          });
        });
      } else {
        setNotice("Order placed! Save your tracking PIN below.");
      }

      setOrderNumber(finalOrder.order_number);
      setTrackedOrder(finalOrder);
      setLastTrackingPin(finalOrder.tracking_pin || "");
      setTrackPhone(customer.phone);
      setCart([]);
      setShopStep("browse");
      setCustomer((v) => ({ ...v, notes: "" }));
      if (auth?.token) loadMyOrders();
      document.getElementById("track")?.scrollIntoView({ behavior: "smooth" });
    } catch (error) {
      if (!apiOnline) {
        const demoOrder = createDemoOrder(payload);
        setOrderNumber(demoOrder.order_number);
        setTrackedOrder(demoOrder);
        setLastTrackingPin(demoOrder.tracking_pin);
        setCart([]);
        setNotice("Demo order saved locally (API offline).");
        return;
      }
      setNotice(error.message || "Could not place order.");
    }
  }

  async function updateStatus(order, status) {
    const message = adminMessage[order.order_number] || `Your order is now ${statusLabels[status]}.`;
    try {
      const r = await fetch(`${API_BASE}/admin/orders/${order.order_number}/status/`, {
        method: "PATCH", headers: { "Content-Type": "application/json", ...adminHeaders() },
        body: JSON.stringify({ status, message }),
      });
      if (!r.ok) throw new Error("Update failed");
      await loadAdminOrders();
      setNotice("Order status updated and customer notified.");
    } catch { setNotice("Could not update order status."); }
  }

  async function sendNotification(order, paymentStatus = null) {
    const message = adminMessage[order.order_number];
    if (!message?.trim() && !paymentStatus) { setNotice("Write a message before sending."); return; }
    try {
      const r = await fetch(`${API_BASE}/admin/orders/${order.order_number}/notify/`, {
        method: "POST", headers: { "Content-Type": "application/json", ...adminHeaders() },
        body: JSON.stringify({ message: message || "", payment_status: paymentStatus }),
      });
      if (!r.ok) throw new Error("Send failed");
      await loadAdminOrders();
      setAdminMessage((prev) => ({ ...prev, [order.order_number]: "" }));
      setNotice(paymentStatus === "paid" ? "Payment marked as collected. Receipt sent to customer." : "Notification sent to customer.");
    } catch { setNotice("Could not send notification."); }
  }

  const handleTrackOrder = (order) => {
    setView("shop");
    setOrderNumber(order.order_number);
    setTrackPhone(order.customer_phone || auth?.user?.phone || "");
    setTrackedOrder(order);
    setTimeout(() => document.getElementById("track")?.scrollIntoView({ behavior: "smooth" }), 100);
  };

  const copy = {
    brand: language === "ta" ? "அன்னை ஹெல்த் மசாலா" : "ANNAI HEALTH MASALA",
    tagline: language === "ta" ? "தரமான மற்றும் ஆரோக்கியமான வீட்டுத் தயாரிப்புகள்" : "Pure, Healthy & Homemade Quality",
    account: language === "ta" ? "கணக்கு" : "Account",
  };

  return (
    <div className="app-shell">
      {toast && (
        <div className={`cart-toast cart-toast--${toast.type}`} onAnimationEnd={() => setToast(null)}>
          {toast.text}
        </div>
      )}

      <header className="hero">
        <nav className="topbar" aria-label="Primary navigation">
          <button type="button" className="brand" onClick={() => setView("shop")}>
            <img src="/logo.png" alt="ANNAI HEALTH MASALA" className="brand-logo" width={48} height={48} />
            <strong>{copy.brand}</strong>
          </button>
          <div className="nav-actions">
            <button type="button" className={view === "shop" ? "active" : ""} onClick={() => { setView("shop"); if (cartCount) openCart(); }}>
              <ShoppingCart size={18} /> Cart
              {cartCount > 0 && <em className="cart-badge">{cartCount}</em>}
            </button>
            <button type="button" onClick={() => { setView("shop"); setShopStep("browse"); document.getElementById("menu")?.scrollIntoView({ behavior: "smooth" }); }}>
              <ShoppingBag size={18} /> Shop
            </button>
            <button type="button" className={view === "account" ? "active" : ""} onClick={() => setView("account")}>
              {auth ? <Users size={18} /> : <LogIn size={18} />}
              {auth ? copy.account : language === "ta" ? "உள்நுழை" : "Login"}
            </button>
            <button type="button" onClick={() => setLanguage(language === "en" ? "ta" : "en")}>
              <Languages size={18} /> {language === "en" ? "தமிழ்" : "English"}
            </button>
          </div>
        </nav>
        <div className="hero-content">
          <div className="hero-main">
            <h1>{copy.brand}</h1>
            <p className="tagline">{copy.tagline}</p>
            <div className="hero-actions">
              <button type="button" className="primary-link" onClick={() => { setView("shop"); document.getElementById("menu")?.scrollIntoView({ behavior: "smooth" }); }}>
                <ShoppingBag size={18} /> Order Now
              </button>
              <button type="button" className="secondary-link" onClick={() => { setView("shop"); document.getElementById("track")?.scrollIntoView({ behavior: "smooth" }); }}>
                <Search size={18} /> Track Order
              </button>
            </div>
            <aside className="hero-note">
              <PackageCheck size={26} />
              <strong>Freshly ground on request</strong>
              <span>Live order tracking, secure payments, and admin updates — just like food delivery apps.</span>
            </aside>
          </div>
        </div>
      </header>

      <main>
        <div className="notice" role="status">
          <Bell size={18} /> {notice}
        </div>

        {view === "shop" && (
          <>
            <section className="section intro-strip">
              <div><strong>Shop → Cart → Pay → Track</strong><span>Full e-commerce flow with COD or online payment.</span></div>
              <div><strong>Live status updates</strong><span>Grinding, packing, ready, delivered — see every step.</span></div>
            </section>

            {shopStep === "browse" && (
              <section className="section" id="menu">
                <div className="section-heading"><p>Menu</p><h2>Browse & add to cart</h2></div>
                <div className="category-stack">
                  {categories.map((category) => (
                    <article className="category-band" key={category.id}>
                      <div className="category-title">
                        <span>{category.icon}</span>
                        <div>
                          <h3>{language === "ta" ? category.tamilName : category.name}</h3>
                          <p>{language === "ta" ? category.tamilDescription || category.description : category.description}</p>
                        </div>
                      </div>
                      <div className="product-grid">
                        {category.products.map((product) => (
                          <article className="product-card" key={product.id}>
                            <img src={product.image || product.image_url} alt={product.name} />
                            <div className="product-body">
                              <h4>{language === "ta" ? product.tamilName : product.name}</h4>
                              <p>{language === "ta" ? product.tamilDescription || product.description : product.description || "Fresh homemade powder"}</p>
                              <div className="product-footer">
                                <strong>{product.price ? `₹${product.price}/kg` : "On request"}</strong>
                                <button type="button" onClick={() => addToCart(product)}><ShoppingBag size={17} /> Add</button>
                              </div>
                            </div>
                          </article>
                        ))}
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            )}

            {shopStep === "cart" && (
              <CartPage
                cart={cart} cartTotal={cartTotal} removeItem={removeItem} updateQuantity={updateQuantity}
                onBack={() => setShopStep("browse")}
                onCheckout={() => {
                  if (!auth) { setView("account"); setNotice("Please login or register to place your order."); return; }
                  setShopStep("checkout");
                  document.getElementById("checkout")?.scrollIntoView({ behavior: "smooth" });
                }}
              />
            )}

            {shopStep === "checkout" && (
              <CheckoutPage
                cart={cart} cartTotal={cartTotal} customer={customer} setCustomer={setCustomer}
                placeOrder={placeOrder} paymentMethod={paymentMethod} setPaymentMethod={setPaymentMethod}
                paymentOnline={paymentOnline} auth={auth}
                onBack={() => setShopStep("cart")}
                onGoLogin={() => { setView("account"); setNotice("Please login or register to place your order."); }}
              />
            )}

            {shopStep === "browse" && (
              <TrackingPanel
                orderNumber={orderNumber} setOrderNumber={setOrderNumber}
                trackPhone={trackPhone} setTrackPhone={setTrackPhone}
                trackPin={trackPin} setTrackPin={setTrackPin}
                trackedOrder={trackedOrder} lastTrackingPin={lastTrackingPin}
                trackOrder={trackOrder} auth={auth}
              />
            )}
          </>
        )}

        {view === "shop" && cartCount > 0 && shopStep === "browse" && (
          <button type="button" className="floating-cart-bar" onClick={openCart}>
            <ShoppingCart size={20} />
            <span>{cartCount} item{cartCount > 1 ? "s" : ""} · {formatMoney(cartTotal)}</span>
            <strong>View Cart <ArrowRight size={16} /></strong>
          </button>
        )}

        {view === "account" && (
          <AccountPortal
            auth={auth} myOrders={myOrders} loadMyOrders={loadMyOrders}
            handleLogin={handleLogin} handleRegister={handleRegister} handleLogout={handleLogout}
            adminTab={adminTab} setAdminTab={setAdminTab} dashboard={dashboard} loadDashboard={loadDashboard}
            loadAdminOrders={loadAdminOrders} loadAdminUsers={loadAdminUsers} loadAdminPayments={loadAdminPayments}
            loadUserDetail={loadUserDetail} orders={orders} payments={payments} users={users}
            selectedUser={selectedUser} setSelectedUser={setSelectedUser}
            adminMessage={adminMessage} setAdminMessage={setAdminMessage}
            updateStatus={updateStatus} sendNotification={sendNotification}
            onTrackOrder={handleTrackOrder}
          />
        )}
      </main>

      <footer className="site-footer">
        <div className="footer-top">
          <div className="footer-brand">
            <img src="/logo.png" alt="ANNAI HEALTH MASALA" width={52} height={52} className="brand-logo" />
            <div><strong>ANNAI HEALTH MASALA</strong><span>Your Health is Our Priority.</span></div>
          </div>
          <div className="footer-contact">
            <p className="footer-section-title">Contact Us</p>
            <p>
              <MapPin size={15} />
              <a href="https://www.google.com/maps/search/Madakkudi,+Pallividai,+Samayapuram,+Trichy" target="_blank" rel="noopener noreferrer">
                Annai Health Foods, Madakkudi, Pallividai, Samayapuram, Trichy-621 112
              </a>
            </p>
            <p><Phone size={15} /> <a href="tel:+917010482463">70104 82463</a> &nbsp;|&nbsp; <a href="tel:+918344880228">83448 80228</a></p>
          </div>
          <div className="footer-fssai">
            <p className="footer-section-title">Food Safety</p>
            <div className="fssai-block">
              <img src="/fssaiimage.png" alt="FSSAI" className="fssai-logo" />
              <span>FSSAI Lic. No.:<br /><strong>22420308000104</strong></span>
            </div>
          </div>
        </div>
        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} Annai Health Foods. All rights reserved.</span>
        </div>
      </footer>
    </div>
  );
}

function PaymentMethodPicker({ paymentMethod, setPaymentMethod, paymentOnline }) {
  return (
    <div className="payment-picker">
      <h3><CreditCard size={20} /> Select payment method</h3>
      <div className="payment-picker__grid payment-picker__grid--2col">
        {PAYMENT_METHODS.map((method) => {
          const Icon = method.icon;
          const active = paymentMethod === method.id;
          const unavailable = method.online && !paymentOnline;
          return (
            <button key={method.id} type="button"
              className={`payment-card ${active ? "payment-card--active" : ""} ${unavailable ? "payment-card--disabled" : ""}`}
              onClick={() => setPaymentMethod(method.id)} disabled={unavailable}
            >
              <span className="payment-card__icon"><Icon size={26} /></span>
              <span className="payment-card__text">
                <strong>{method.label}</strong>
                <small>{method.description}</small>
                {unavailable && <small className="payment-card__warn">Coming soon — add Razorpay keys</small>}
              </span>
              <span className={`payment-card__radio ${active ? "payment-card__radio--on" : ""}`} />
            </button>
          );
        })}
      </div>
    </div>
  );
}

function OrderSummary({ cart, cartTotal, paymentMethod }) {
  const itemTotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  return (
    <aside className="order-summary">
      <h3><ClipboardList size={20} /> Order summary</h3>
      <div className="order-summary__lines">
        {cart.map((item) => (
          <div className="order-summary__line" key={item.id}>
            <span>{item.name} × {item.quantity}kg</span>
            <strong>{formatMoney(item.price * item.quantity)}</strong>
          </div>
        ))}
      </div>
      <div className="order-summary__row"><span>Subtotal</span><strong>{formatMoney(itemTotal)}</strong></div>
      <div className="order-summary__row"><span>Delivery</span><strong>Free</strong></div>
      <div className="order-summary__total"><span>Total</span><strong>{formatMoney(cartTotal)}</strong></div>
      <div className="order-summary__payment"><CreditCard size={16} /><span>{paymentMethodLabels[paymentMethod] || paymentMethod}</span></div>
    </aside>
  );
}

function CartPage({ cart, cartTotal, removeItem, updateQuantity, onBack, onCheckout }) {
  return (
    <section className="section checkout-flow" id="cart">
      <button type="button" className="back-link" onClick={onBack}><ChevronLeft size={18} /> Continue shopping</button>
      <div className="section-heading"><p>Your cart</p><h2><ShoppingCart size={24} /> {cart.length} item{cart.length !== 1 ? "s" : ""}</h2></div>
      {cart.length ? (
        <>
          <div className="cart-panel cart-panel--full">
            <div className="cart-list">
              {cart.map((item) => (
                <div className="cart-item-card" key={item.id}>
                  <div className="cart-item-card__info"><strong>{item.name}</strong><span>{formatMoney(item.price)}/kg</span></div>
                  <div className="cart-item-card__actions">
                    <input type="number" min="0.25" step="0.25" value={item.quantity} onChange={(e) => updateQuantity(item.id, e.target.value)} aria-label="Quantity kg" />
                    <strong>{formatMoney(item.price * item.quantity)}</strong>
                    <button type="button" className="icon-button" onClick={() => removeItem(item.id)} aria-label="Remove">×</button>
                  </div>
                </div>
              ))}
            </div>
            <div className="cart-total-bar"><span>Cart total</span><strong>{formatMoney(cartTotal)}</strong></div>
          </div>
          <button type="button" className="submit-button checkout-cta" onClick={onCheckout}>Proceed to Payment <ArrowRight size={18} /></button>
        </>
      ) : (
        <p className="empty-state">Cart is empty. Add items from the menu.</p>
      )}
    </section>
  );
}

function CheckoutPage({ cart, cartTotal, customer, setCustomer, placeOrder, paymentMethod, setPaymentMethod, paymentOnline, auth, onBack, onGoLogin }) {
  const payOnline = paymentOnline && isOnlinePayment(paymentMethod);
  if (!auth) {
    return (
      <section className="section checkout-flow" id="checkout">
        <button type="button" className="back-link" onClick={onBack}><ChevronLeft size={18} /> Back to cart</button>
        <div className="login-wall">
          <LogIn size={40} />
          <h2>Login required</h2>
          <p>You must be logged in to place an order.</p>
          <button type="button" className="submit-button" onClick={onGoLogin}><LogIn size={18} /> Login / Register</button>
        </div>
      </section>
    );
  }
  return (
    <section className="section checkout-flow" id="checkout">
      <button type="button" className="back-link" onClick={onBack}><ChevronLeft size={18} /> Back to cart</button>
      <div className="section-heading"><p>Checkout</p><h2>Hi, {auth.user.name || auth.user.username}</h2></div>
      <div className="checkout-layout">
        <div className="checkout-main">
          <PaymentMethodPicker paymentMethod={paymentMethod} setPaymentMethod={setPaymentMethod} paymentOnline={paymentOnline} />
          <form className="order-form order-form--checkout" onSubmit={placeOrder}>
            <h3><MapPin size={20} /> Delivery details</h3>
            <label className="field-label"><User size={16} /> Full name</label>
            <input required placeholder="Your name" value={customer.name} onChange={(e) => setCustomer({ ...customer, name: e.target.value })} />
            <label className="field-label"><Phone size={16} /> Phone</label>
            <input required placeholder="10-digit mobile" value={customer.phone} onChange={(e) => setCustomer({ ...customer, phone: e.target.value })} />
            <label className="field-label">Email (for receipt)</label>
            <input type="email" placeholder="your@email.com" value={customer.email} onChange={(e) => setCustomer({ ...customer, email: e.target.value })} />
            <label className="field-label"><MapPin size={16} /> Address</label>
            <textarea required placeholder="House no, street, area, city" value={customer.address} onChange={(e) => setCustomer({ ...customer, address: e.target.value })} />
            <label className="field-label">Order notes (optional)</label>
            <textarea placeholder="Flour variety, grinding preference, etc." value={customer.notes} onChange={(e) => setCustomer({ ...customer, notes: e.target.value })} />
            <button className="submit-button" type="submit">
              <Send size={18} /> {payOnline ? `Pay ${formatMoney(cartTotal)} & Place Order` : `Place Order · ${formatMoney(cartTotal)} COD`}
            </button>
          </form>
        </div>
        <OrderSummary cart={cart} cartTotal={cartTotal} paymentMethod={paymentMethod} />
      </div>
    </section>
  );
}

function OrderTimeline({ order, compact = false }) {
  return (
    <div className={`timeline ${compact ? "timeline--compact" : ""}`}>
      {(order.events || []).map((event, index) => (
        <div className={`timeline-row ${index === (order.events?.length || 0) - 1 ? "timeline-row--active" : ""}`} key={`${event.status}-${index}`}>
          <CheckCircle2 size={18} />
          <div>
            <strong>{statusLabels[event.status] || event.status}</strong>
            <span>{event.message}</span>
            <time>{formatDate(event.created_at)}</time>
          </div>
        </div>
      ))}
    </div>
  );
}

function OrderCard({ order, onTrack, showAddress = false }) {
  return (
    <article className="order-card">
      <div className="order-card__header">
        <div>
          <p className="order-card__id">#{order.order_number}</p>
          <h3>{statusLabels[order.status] || order.status}</h3>
          <span className="order-card__date">{formatDate(order.created_at)}</span>
        </div>
        <div className="order-card__amount">
          <strong>{formatMoney(order.order_total)}</strong>
          <span className="payment-badge">{paymentMethodLabels[order.payment_method] || order.payment_method}</span>
          <span className={`badge badge--${order.payment_status}`}>{paymentStatusLabels[order.payment_status] || order.payment_status}</span>
        </div>
      </div>
      <div className="order-card__items">
        {(order.items || []).map((item, i) => (
          <span key={i}>{item.product_name} × {item.quantity_kg}kg — {formatMoney(item.line_total)}</span>
        ))}
      </div>
      {showAddress && order.customer_address && (
        <p className="order-card__address"><Package size={14} /> {order.customer_address}</p>
      )}
      <OrderTimeline order={order} compact />
      {onTrack && (
        <button type="button" className="order-card__track" onClick={() => onTrack(order)}>
          <Search size={16} /> Track live
        </button>
      )}
    </article>
  );
}

// ── Admin Orders Tab — dropdown to select customer/order, active cards, completed link ──
function AdminOrdersTab({ orders, auth, adminMessage, setAdminMessage, updateStatus, sendNotification, onTrackOrder, onViewCustomer }) {
  const DONE = new Set(["delivered", "cancelled"]);
  const activeOrders = orders.filter((o) => !DONE.has(o.status));
  const doneOrders   = orders.filter((o) =>  DONE.has(o.status));

  const [selectedOrderNum, setSelectedOrderNum] = useState(activeOrders[0]?.order_number || "");
  const selectedOrder = orders.find((o) => o.order_number === selectedOrderNum) || null;

  // keep selection valid when orders reload
  useEffect(() => {
    if (selectedOrderNum && !orders.find((o) => o.order_number === selectedOrderNum)) {
      setSelectedOrderNum(activeOrders[0]?.order_number || "");
    }
  }, [orders]);

  function downloadPDF(order) {
    if (!auth?.token) { alert("Please log in again."); return; }
    downloadAdminFile(
      `${API_BASE}/admin/export/receipt/${order.order_number}/`,
      `receipt-${order.order_number}.pdf`,
      { Authorization: `Bearer ${auth.token}` },
      "pdf",
    ).catch((e) => alert(e.message || "PDF export failed"));
  }

  return (
    <div className="admin-orders-tab">
      {/* ── Customer / Order selector dropdown ── */}
      <div className="order-selector">
        <label className="field-label"><Users size={15} /> Select customer order</label>
        <select
          className="status-dropdown order-selector__select"
          value={selectedOrderNum}
          onChange={(e) => setSelectedOrderNum(e.target.value)}
        >
          <option value="">— choose an order —</option>
          {activeOrders.length > 0 && (
            <optgroup label="Active Orders">
              {activeOrders.map((o) => (
                <option key={o.order_number} value={o.order_number}>
                  {o.customer_name} · #{o.order_number} · {statusLabels[o.status]}
                </option>
              ))}
            </optgroup>
          )}
          {doneOrders.length > 0 && (
            <optgroup label="Completed Orders">
              {doneOrders.map((o) => (
                <option key={o.order_number} value={o.order_number}>
                  {o.customer_name} · #{o.order_number} · {statusLabels[o.status]}
                </option>
              ))}
            </optgroup>
          )}
        </select>
      </div>

      {/* ── Selected order detail ── */}
      {selectedOrder && (
        <article className="admin-order admin-order--selected">
          <div className="admin-order__header">
            <div>
              <p className="admin-order__id">#{selectedOrder.order_number}</p>
              <p className="admin-order__name">{selectedOrder.customer_name}</p>
              <p className="admin-order__contact">{selectedOrder.customer_phone}</p>
            </div>
            <div className="admin-order__badges">
              <span className={`badge-status badge-status--${selectedOrder.status}`}>{statusLabels[selectedOrder.status]}</span>
              <span className={`badge-payment badge-payment--${selectedOrder.payment_status}`}>
                {paymentMethodLabels[selectedOrder.payment_method] || selectedOrder.payment_method} — {paymentStatusLabels[selectedOrder.payment_status]}
              </span>
              <span className="admin-order__total">₹{Number(selectedOrder.order_total).toFixed(2)}</span>
            </div>
          </div>

          <div className="admin-order__body">
            {selectedOrder.customer_address && <p className="admin-order__address">{selectedOrder.customer_address}</p>}
            <div className="admin-order__items">
              {(selectedOrder.items || []).map((item, i) => (
                <span className="admin-order__item-chip" key={i}>
                  {item.product_name} × {item.quantity_kg}kg (₹{Number(item.line_total).toFixed(2)})
                </span>
              ))}
            </div>
            {(selectedOrder.payments || []).map((p) => (
              <p key={p.id} className="admin-order__payment-line">
                <CreditCard size={13} /> Payment #{p.id}: {p.method} — {paymentStatusLabels[p.status]}
                {p.razorpay_payment_id && ` · ${p.razorpay_payment_id}`}
              </p>
            ))}

            {/* Status dropdown — only for active orders */}
            {!DONE.has(selectedOrder.status) && (
              <div className="admin-order__status-btns">
                <select
                  className="status-dropdown"
                  value={selectedOrder.status}
                  onChange={(e) => updateStatus(selectedOrder, e.target.value)}
                >
                  {Object.entries(statusLabels).map(([s, label]) => (
                    <option key={s} value={s}>{label}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Message box — only for active orders */}
            {!DONE.has(selectedOrder.status) && (
              <div className="admin-order__msg">
                <textarea
                  placeholder="Message to customer (order & payment update)"
                  value={adminMessage[selectedOrder.order_number] || ""}
                  onChange={(e) => setAdminMessage({ ...adminMessage, [selectedOrder.order_number]: e.target.value })}
                />
              </div>
            )}

            {/* Timeline */}
            <OrderTimeline order={selectedOrder} />
          </div>

          <div className="admin-order__actions">
            {!DONE.has(selectedOrder.status) && (
              <>
                <button type="button" className="action-btn" onClick={() => sendNotification(selectedOrder)}>
                  <Send size={14} /> Send update
                </button>
                <button type="button" className="action-btn action-btn--track" onClick={() => onTrackOrder(selectedOrder)}>
                  <Search size={14} /> Track Live
                </button>
                {selectedOrder.payment_status === "pending" && (
                  <button type="button" className="action-btn action-btn--cod" onClick={() => sendNotification(selectedOrder, "paid")}>
                    <IndianRupee size={14} /> Cash Received
                  </button>
                )}
              </>
            )}
            {/* Receipt PDF always visible */}
            <button type="button" className="action-btn action-btn--pdf" onClick={() => downloadPDF(selectedOrder)}>
              📄 Receipt PDF
            </button>
            {/* Completed orders → go to customer detail */}
            {DONE.has(selectedOrder.status) && (
              <button type="button" className="action-btn action-btn--track" onClick={() => onViewCustomer(selectedOrder)}>
                <Users size={14} /> Customer Detail
              </button>
            )}
          </div>
        </article>
      )}

      {/* ── Active orders count summary ── */}
      <div className="orders-summary-bar">
        <span><strong>{activeOrders.length}</strong> active</span>
        <span><strong>{doneOrders.length}</strong> completed — see Customer Detail tab</span>
      </div>
    </div>
  );
}

// ── Tracking Panel — shown in shop after order placed ──
function TrackingPanel({ orderNumber, setOrderNumber, trackPhone, setTrackPhone, trackPin, setTrackPin, trackedOrder, lastTrackingPin, trackOrder, auth }) {
  return (
    <section className="section track-panel" id="track">
      <div className="section-heading"><p>Live tracking</p><h2>Track your order</h2></div>
      <div className="track-search">
        <input placeholder="Order number" value={orderNumber} onChange={(e) => setOrderNumber(e.target.value)} />
        <input placeholder="Phone number" value={trackPhone} onChange={(e) => setTrackPhone(e.target.value)} />
        <input placeholder="Tracking PIN" value={trackPin} onChange={(e) => setTrackPin(e.target.value)} />
        <button type="button" onClick={() => trackOrder()}><Search size={18} /> Track</button>
      </div>
      {lastTrackingPin && (
        <p className="tracking-pin-notice">Your tracking PIN: <strong>{lastTrackingPin}</strong> — save this!</p>
      )}
      {trackedOrder && (
        <>
          <OrderCard order={trackedOrder} showAddress />
          {auth?.user?.is_staff && trackedOrder.order_number && (
            <button
              type="button"
              className="action-btn action-btn--pdf tracking-pdf-btn"
              onClick={async () => {
                try {
                  await downloadAdminFile(
                    `${API_BASE}/admin/export/receipt/${trackedOrder.order_number}/`,
                    `receipt-${trackedOrder.order_number}.pdf`,
                    { Authorization: `Bearer ${auth.token}` },
                    "pdf",
                  );
                } catch (error) {
                  alert(error.message || "PDF export failed");
                }
              }}
            >
              📄 Download Receipt PDF
            </button>
          )}
        </>
      )}
    </section>
  );
}

function LoginPage({ onSubmit, onSwitch }) {
  const [form, setForm] = useState({ username: "", password: "" });
  const [loading, setLoading] = useState(false);
  async function submit(event) {
    event.preventDefault(); setLoading(true);
    try { await onSubmit(event, form); } finally { setLoading(false); }
  }
  return (
    <section className="section auth-section">
      <div className="section-heading"><p>Welcome back</p><h2>Login to your account</h2></div>
      <form className="auth-form" onSubmit={submit}>
        <input required placeholder="Username or email" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} autoComplete="username" />
        <input required type="password" placeholder="Password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} autoComplete="current-password" />
        <button className="submit-button" type="submit" disabled={loading}><LogIn size={18} /> {loading ? "Logging in..." : "Login"}</button>
      </form>
      {onSwitch && <p className="auth-switch">New here? <button type="button" className="link-button" onClick={onSwitch}>Create account</button></p>}
    </section>
  );
}

function RegisterPage({ onSubmit, onSwitch }) {
  const [form, setForm] = useState({ username: "", email: "", password: "", name: "", phone: "", address: "" });
  const [loading, setLoading] = useState(false);
  async function submit(event) {
    event.preventDefault(); setLoading(true);
    try { await onSubmit(event, form); } finally { setLoading(false); }
  }
  return (
    <section className="section auth-section">
      <div className="section-heading"><p>Join us</p><h2>Create your account</h2></div>
      <form className="auth-form" onSubmit={submit}>
        <input required placeholder="Username" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} autoComplete="username" />
        <input type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} autoComplete="email" />
        <input required type="password" placeholder="Password (min 8 chars)" minLength={8} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} autoComplete="new-password" />
        <input placeholder="Full name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <input placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        <textarea placeholder="Delivery address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
        <button className="submit-button" type="submit" disabled={loading}><UserPlus size={18} /> {loading ? "Creating..." : "Register"}</button>
      </form>
      <p className="auth-switch">Have an account? <button type="button" className="link-button" onClick={onSwitch}>Login</button></p>
    </section>
  );
}

function AdminDashboard({ dashboard, orders, users, payments, onOpenOrders }) {
  const stats = dashboard?.stats || {
    total_orders: orders.length,
    active_orders: orders.filter((o) => !["delivered", "cancelled"].includes(o.status)).length,
    total_users: users.length,
    total_revenue: payments.filter((p) => p.status === "paid").reduce((s, p) => s + p.amount, 0),
    pending_payments: orders.filter((o) => o.payment_status === "pending").length,
  };
  const productSales = dashboard?.product_sales || [];
  const ordersByStatus = dashboard?.orders_by_status || {};
  const recentOrders = dashboard?.recent_orders || orders.slice(0, 10);

  return (
    <div className="admin-overview">
      <div className="dash-stats">
        <article className="stat-card"><ClipboardList size={22} /><strong>{stats.total_orders}</strong><span>Total Orders</span></article>
        <article className="stat-card"><Package size={22} /><strong>{stats.active_orders}</strong><span>Active Orders</span></article>
        <article className="stat-card"><Users size={22} /><strong>{stats.total_users}</strong><span>Customers</span></article>
        <article className="stat-card"><IndianRupee size={22} /><strong>{formatMoney(stats.total_revenue)}</strong><span>Revenue (Paid)</span></article>
        <article className="stat-card stat-card--warn"><CreditCard size={22} /><strong>{stats.pending_payments}</strong><span>Pending Payments</span></article>
      </div>
      <div className="analytics-grid">
        <section className="analytics-card">
          <h3><TrendingUp size={20} /> Product sales analytics</h3>
          <div className="users-table-wrap">
            <table className="users-table">
              <thead><tr><th>Product</th><th>Orders</th><th>Qty sold (kg)</th><th>Revenue</th></tr></thead>
              <tbody>
                {productSales.length ? productSales.map((row) => (
                  <tr key={row.product_name}>
                    <td><strong>{row.product_name}</strong></td>
                    <td>{row.order_count}</td>
                    <td>{row.total_kg.toFixed(2)}</td>
                    <td>{formatMoney(row.revenue)}</td>
                  </tr>
                )) : <tr><td colSpan={4} className="empty-state">No sales data yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
        <section className="analytics-card">
          <h3><Package size={20} /> Orders by status</h3>
          <div className="status-pills">
            {Object.entries(ordersByStatus).map(([status, count]) => (
              <div className="status-pill" key={status}><strong>{count}</strong><span>{statusLabels[status] || status}</span></div>
            ))}
          </div>
        </section>
      </div>
      <section className="analytics-card">
        <div className="analytics-card__head">
          <h3><ClipboardList size={20} /> Live order tracking</h3>
          <button type="button" className="link-button" onClick={onOpenOrders}>View all orders →</button>
        </div>
        <div className="users-table-wrap">
          <table className="users-table">
            <thead><tr><th>Order</th><th>Customer</th><th>Status</th><th>Payment</th><th>Total</th><th>Time</th></tr></thead>
            <tbody>
              {recentOrders.map((order) => (
                <tr key={order.order_number}>
                  <td>#{order.order_number}</td>
                  <td>{order.customer_name}<br /><small>{order.customer_phone}</small></td>
                  <td><span className="badge badge--pending">{statusLabels[order.status]}</span></td>
                  <td>{paymentMethodLabels[order.payment_method] || order.payment_method}</td>
                  <td>{formatMoney(order.order_total)}</td>
                  <td>{formatDate(order.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

// ── Admin Panel ──
function AdminPanel({
  auth, adminTab, setAdminTab, dashboard, loadDashboard,
  loadAdminOrders, loadAdminUsers, loadAdminPayments, loadUserDetail,
  orders, payments, users, selectedUser, setSelectedUser,
  adminMessage, setAdminMessage, updateStatus, sendNotification, onLogout, onTrackOrder,
}) {
  const adminLoaded = useRef(false);

  useEffect(() => {
    if (!auth?.user?.is_staff || adminLoaded.current) return;
    adminLoaded.current = true;
    loadDashboard(); loadAdminOrders(); loadAdminUsers(); loadAdminPayments();
  }, [auth?.user?.is_staff, loadDashboard, loadAdminOrders, loadAdminUsers, loadAdminPayments]);

  function refreshAll() { loadDashboard(); loadAdminOrders(); loadAdminUsers(); loadAdminPayments(); }

  return (
    <section className="section admin-section">
      <div className="section-heading admin-section__head">
        <div><p>Admin Dashboard</p><h2>Welcome, {auth.user.name || auth.user.username}</h2></div>
        <div className="admin-section__actions">
          <button type="button" className="submit-button" onClick={refreshAll}><ClipboardList size={18} /> Refresh</button>
          <button type="button" className="submit-button export-btn"
            onClick={async () => {
              if (!auth?.token) { alert("Please log in again to export data."); return; }
              try {
                await downloadAdminFile(`${API_BASE}/admin/export/excel/`, "annai-health-report.xlsx", { Authorization: `Bearer ${auth.token}` }, "spreadsheet");
              } catch (error) { alert(error.message || "Export failed"); }
            }}
          >⬇ Export Excel</button>
          {onLogout && <button type="button" className="submit-button logout-button" onClick={onLogout}><LogOut size={18} /> Logout</button>}
        </div>
      </div>

      <div className="admin-tabs">
        {["overview", "orders", "users", "payments", ...(selectedUser ? ["user-detail"] : [])].map((tab) => (
          <button key={tab} type="button" className={adminTab === tab ? "active" : ""} onClick={() => setAdminTab(tab)}>
            {tab === "overview" && "Overview & Analytics"}
            {tab === "orders" && `Track Orders (${orders.length})`}
            {tab === "users" && `Customers (${users.length})`}
            {tab === "payments" && `Payments (${payments.length})`}
            {tab === "user-detail" && "Customer Detail"}
          </button>
        ))}
      </div>

      {adminTab === "overview" && (
        <AdminDashboard dashboard={dashboard} orders={orders} users={users} payments={payments} onOpenOrders={() => setAdminTab("orders")} />
      )}

      {adminTab === "orders" && (
        <AdminOrdersTab
          orders={orders}
          auth={auth}
          adminMessage={adminMessage}
          setAdminMessage={setAdminMessage}
          updateStatus={updateStatus}
          sendNotification={sendNotification}
          onTrackOrder={onTrackOrder}
          onViewCustomer={(order) => {
            // find matching user and open user-detail
            const match = users.find(
              (u) => u.phone === order.customer_phone ||
                     u.name === order.customer_name ||
                     u.username === order.customer_name
            );
            if (match) loadUserDetail(match.id);
            else setAdminTab("users");
          }}
        />
      )}

      {adminTab === "users" && (
        <div className="users-table-wrap">
          <table className="users-table">
            <thead><tr><th>User</th><th>Contact</th><th>Orders</th><th>Joined</th><th></th></tr></thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td><strong>{user.name || user.username}</strong><br /><small>@{user.username}</small></td>
                  <td>{user.phone || "—"}<br /><small>{user.email || "—"}</small></td>
                  <td>{user.order_count}</td>
                  <td>{new Date(user.date_joined).toLocaleDateString()}</td>
                  <td><button type="button" className="link-button" onClick={() => loadUserDetail(user.id)}>View details</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {adminTab === "payments" && (
        <div className="users-table-wrap">
          <table className="users-table">
            <thead><tr><th>Order</th><th>Customer</th><th>Method</th><th>Status</th><th>Amount</th><th>Date</th></tr></thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id}>
                  <td>#{p.order_number}</td>
                  <td>{p.customer_name}<br /><small>{p.customer_phone}</small></td>
                  <td>{paymentMethodLabels[p.method] || p.method}</td>
                  <td><span className={`badge badge--${p.status}`}>{paymentStatusLabels[p.status]}</span></td>
                  <td>{formatMoney(p.amount)}</td>
                  <td>{formatDate(p.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {adminTab === "user-detail" && selectedUser && (
        <div className="user-detail-panel">
          <button type="button" className="link-button" onClick={() => { setSelectedUser(null); setAdminTab("users"); }}>← Back to users</button>
          <div className="profile-card">
            <h3>{selectedUser.user.name || selectedUser.user.username}</h3>
            <p>@{selectedUser.user.username} · {selectedUser.user.phone} · {selectedUser.user.email || "no email"}</p>
            <p>{selectedUser.user.address || "No saved address"}</p>
            <p><strong>{selectedUser.user.order_count}</strong> orders · joined {new Date(selectedUser.user.date_joined).toLocaleDateString()}</p>
          </div>
          <h4>Order history</h4>
          <div className="orders-list">
            {(selectedUser.orders || []).map((order) => (
              <div key={order.order_number}>
                <OrderCard order={order} showAddress />
                {["delivered", "cancelled"].includes(order.status) && auth?.token && (
                  <button
                    type="button"
                    className="action-btn action-btn--pdf tracking-pdf-btn"
                    onClick={async () => {
                      try {
                        await downloadAdminFile(
                          `${API_BASE}/admin/export/receipt/${order.order_number}/`,
                          `receipt-${order.order_number}.pdf`,
                          { Authorization: `Bearer ${auth.token}` },
                          "pdf",
                        );
                      } catch (error) { alert(error.message || "PDF export failed"); }
                    }}
                  >
                    📄 Receipt PDF
                  </button>
                )}
              </div>
            ))}
          </div>
          <h4>Payment history</h4>
          <div className="users-table-wrap">
            <table className="users-table">
              <thead><tr><th>Order</th><th>Method</th><th>Status</th><th>Amount</th></tr></thead>
              <tbody>
                {(selectedUser.payments || []).map((p) => (
                  <tr key={p.id}>
                    <td>#{p.order_number}</td><td>{p.method}</td>
                    <td><span className={`badge badge--${p.status}`}>{paymentStatusLabels[p.status]}</span></td>
                    <td>{formatMoney(p.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}

function AccountPortal({
  auth, myOrders, loadMyOrders, handleLogin, handleRegister, handleLogout, onTrackOrder,
  adminTab, setAdminTab, dashboard, loadDashboard, loadAdminOrders, loadAdminUsers,
  loadAdminPayments, loadUserDetail, orders, payments, users, selectedUser, setSelectedUser,
  adminMessage, setAdminMessage, updateStatus, sendNotification,
}) {
  const [tab, setTab] = useState(auth ? "orders" : "login");
  const ordersLoaded = useRef(false);

  useEffect(() => {
    if (auth) {
      if (!auth.user.is_staff) setTab((c) => (c === "login" || c === "register" ? "orders" : c));
    } else {
      setTab((c) => (["orders", "profile"].includes(c) ? "login" : c));
      ordersLoaded.current = false;
    }
  }, [auth?.token, auth?.user?.is_staff]);

  useEffect(() => {
    if (auth?.token && !auth.user.is_staff && tab === "orders" && !ordersLoaded.current) {
      ordersLoaded.current = true;
      loadMyOrders();
    }
  }, [auth?.token, auth?.user?.is_staff, tab, loadMyOrders]);

  if (auth?.user?.is_staff) {
    return (
      <div className="portal-wrapper portal-wrapper--admin">
        <AdminPanel
          auth={auth} adminTab={adminTab} setAdminTab={setAdminTab}
          dashboard={dashboard} loadDashboard={loadDashboard}
          loadAdminOrders={loadAdminOrders} loadAdminUsers={loadAdminUsers}
          loadAdminPayments={loadAdminPayments} loadUserDetail={loadUserDetail}
          orders={orders} payments={payments} users={users}
          selectedUser={selectedUser} setSelectedUser={setSelectedUser}
          adminMessage={adminMessage} setAdminMessage={setAdminMessage}
          updateStatus={updateStatus} sendNotification={sendNotification}
          onLogout={handleLogout} onTrackOrder={onTrackOrder}
        />
      </div>
    );
  }

  return (
    <div className="portal-wrapper">
      <div className="portal-tabs">
        {!auth ? (
          <>
            <button type="button" className={tab === "login" ? "active" : ""} onClick={() => setTab("login")}><LogIn size={16} /> Login</button>
            <button type="button" className={tab === "register" ? "active" : ""} onClick={() => setTab("register")}><UserPlus size={16} /> Register</button>
          </>
        ) : (
          <>
            <button type="button" className={tab === "orders" ? "active" : ""} onClick={() => { setTab("orders"); loadMyOrders(); }}><Package size={16} /> My Orders</button>
            <button type="button" className={tab === "profile" ? "active" : ""} onClick={() => setTab("profile")}><Users size={16} /> Profile</button>
          </>
        )}
      </div>
      <div className="portal-content">
        {tab === "login" && !auth && (
          <>
            <LoginPage onSubmit={handleLogin} onSwitch={() => setTab("register")} />
            <p className="login-hint"><UserCog size={16} /> Store admin? Login with your staff account — the dashboard opens automatically.</p>
          </>
        )}
        {tab === "register" && !auth && <RegisterPage onSubmit={handleRegister} onSwitch={() => setTab("login")} />}
        {tab === "orders" && auth && (
          <section className="section">
            <div className="section-heading"><p>Your orders</p><h2>Order history & live tracking</h2></div>
            {myOrders.length ? (
              <div className="orders-list">
                {myOrders.map((order) => <OrderCard key={order.order_number} order={order} onTrack={onTrackOrder} showAddress />)}
              </div>
            ) : <p className="empty-state">No orders yet. Browse the shop and place your first order!</p>}
          </section>
        )}
        {tab === "profile" && auth && (
          <section className="section profile-section">
            <div className="section-heading"><p>Profile</p><h2>{auth.user.name || auth.user.username}</h2></div>
            <div className="profile-card">
              <div className="profile-details">
                <p><strong>Username:</strong> {auth.user.username}</p>
                <p><strong>Email:</strong> {auth.user.email || "—"}</p>
                <p><strong>Phone:</strong> {auth.user.phone || "—"}</p>
                <p><strong>Address:</strong> {auth.user.address || "—"}</p>
                <p><strong>Member since:</strong> {new Date(auth.user.date_joined).toLocaleDateString()}</p>
              </div>
              <button type="button" className="submit-button logout-button" onClick={handleLogout}><LogOut size={18} /> Logout</button>
            </div>
          </section>
        )}
      </div>
    </div>
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
    order_total: payload.items.reduce((sum, item) => sum + Number(item.unit_price) * Number(item.quantity_kg), 0),
    tracking_pin: String(Math.floor(1000 + Math.random() * 9000)),
    created_at: new Date().toISOString(),
    items: payload.items.map((item) => ({ ...item, line_total: item.unit_price * item.quantity_kg })),
    events: [{ status: "received", message: "Your order has been received.", created_at: new Date().toISOString() }],
  };
  localStorage.setItem(`annai-order-${order.order_number}`, JSON.stringify(order));
  return order;
}

export default App;
