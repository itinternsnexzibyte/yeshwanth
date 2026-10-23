import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { createPortal } from "react-dom";
import {
  QueryClient,
  QueryClientProvider,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  Activity,
  BarChart3,
  Bell,
  BriefcaseBusiness,
  Building2,
  Camera,
  CalendarDays,
  Check,
  ChevronRight,
  ClipboardList,
  FileText,
  Filter,
  Handshake,
  Image as ImageIcon,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Mail,
  MailCheck,
  MapPin,
  Menu,
  Plus,
  PhoneCall,
  Repeat2,
  Search,
  Settings as SettingsIcon,
  ShieldCheck,
  TrendingUp,
  Users,
  X,
} from "lucide-react";
import {
  Bar,
  BarChart,
  Cell,
  CartesianGrid,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { BlurFade } from "@/components/ui/blur-fade";
import { BorderBeam } from "@/components/ui/border-beam";
import { MagicCard } from "@/components/ui/magic-card";
import { NumberTicker } from "@/components/ui/number-ticker";
import { AuroraText } from "@/components/ui/aurora-text";
import { Particles } from "@/components/ui/particles";
import { ShimmerButton } from "@/components/ui/shimmer-button";
import { ShineBorder } from "@/components/ui/shine-border";
import "./index.css";
import "./saas.css";
import "./redesign.css";
import "./company-ui.css";
import "./premium.css";
import "./reference-saas.css";

const API = "https://yeshwanth-7p6a.onrender.com/api";
async function api(path: string, options: any = {}) {
  const request = () =>
    fetch(API + path, {
      ...options,
      credentials: "include",
      headers: { "Content-Type": "application/json", ...options.headers },
    });
  let response = await request();
  if (response.status === 401 && !path.startsWith("/auth/")) {
    const refreshed = await fetch(API + "/auth/refresh", {
      method: "POST",
      credentials: "include",
    });
    if (refreshed.ok) response = await request();
  }
  const body =
    response.status === 204 ? {} : await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.message || "Request failed");
  return body;
}

function playAlertTone(kind: "notification" | "success" = "notification") {
  if (localStorage.getItem("nexzi-alert-sound") === "off") return;
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    const context = new AudioContextClass();
    const notes = kind === "success" ? [523, 659, 784] : [660, 880];
    notes.forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, context.currentTime + index * 0.13);
      gain.gain.exponentialRampToValueAtTime(0.12, context.currentTime + index * 0.13 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + index * 0.13 + 0.22);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(context.currentTime + index * 0.13);
      oscillator.stop(context.currentTime + index * 0.13 + 0.24);
    });
    window.setTimeout(() => context.close(), 1200);
  } catch { /* Sound may be blocked until the first user interaction. */ }
}

function celebrateDeal(company: string) {
  playAlertTone("success");
  navigator.vibrate?.([180, 90, 180, 90, 280]);
  const layer = document.createElement("div");
  layer.className = "deal-celebration";
  layer.setAttribute("role", "status");
  layer.innerHTML = `<div class="deal-celebration-card"><span>🎉</span><b>Deal won!</b><small>Congratulations — ${company.replace(/[<>&]/g, "")} is now a successful closure.</small></div>`;
  const colors = ["#2563eb", "#06b6d4", "#f59e0b", "#ec4899", "#22c55e"];
  for (let index = 0; index < 42; index++) {
    const piece = document.createElement("i");
    piece.style.left = `${Math.random() * 100}%`;
    piece.style.background = colors[index % colors.length];
    piece.style.animationDelay = `${Math.random() * .35}s`;
    layer.appendChild(piece);
  }
  document.body.appendChild(layer);
  window.setTimeout(() => layer.remove(), 4200);
}
function showQuotationAlert(title: string, message: string) {
  document.querySelector(".quotation-hot-alert")?.remove();
  const alert = document.createElement("div");
  alert.className = "quotation-hot-alert";
  alert.innerHTML = `<span>!</span><div><b>${title.replace(/[<>&]/g, "")}</b><small>${message.replace(/[<>&]/g, "")}</small></div><button aria-label="Close">×</button>`;
  alert.querySelector("button")!.addEventListener("click", () => alert.remove());
  document.body.appendChild(alert);
  window.setTimeout(() => alert.remove(), 12000);
}
const roleName: any = {
  ADMIN: "Admin Dashboard",
  SALES_HEAD: "Sales Head Dashboard",
  BD_MANAGER: "BD Manager Dashboard",
  SALES_BD_EXECUTIVE: "Sales Executive Dashboard",
  TECHNICAL_TEAM: "Technical Team Workspace",
  MANAGEMENT_VIEWER: "Management Dashboard",
};
const input = "input";
const getLocation = () =>
  new Promise<any>((resolve, reject) =>
    navigator.geolocation.getCurrentPosition(
      (p) =>
        resolve({
          latitude: p.coords.latitude,
          longitude: p.coords.longitude,
          accuracy: p.coords.accuracy,
        }),
      reject,
      { enableHighAccuracy: true },
    ),
  );

function Auth({ onLogin }: { onLogin: (u: any) => void }) {
  const [mode, setMode] = useState<
    "login" | "register" | "verify" | "thanks" | "forgot" | "reset"
  >("login");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [approvalStatus, setApprovalStatus] = useState(() => sessionStorage.getItem("nexzi-registration-token") ? "PENDING" : "");
  const [form, setForm] = useState<any>({
    name: "",
    phone: "",
    email: "",
    password: "",
    requestedRole: "SALES_BD_EXECUTIVE",
  });
  const change = (e: any) =>
    setForm({ ...form, [e.target.name]: e.target.value });
  const go = (next: typeof mode) => {
    setMode(next);
    setError("");
    setSuccess("");
  };
  const submit = async (e: any) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    try {
      if (mode === "register") {
        const d = await api("/auth/register", {
          method: "POST",
          body: JSON.stringify(form),
        });
        setSuccess(d.message);
        setMode("verify");
      } else if (mode === "verify") {
        const d = await api("/auth/verify-email", {
          method: "POST",
          body: JSON.stringify({ email: form.email, code: form.code }),
        });
        setSuccess(d.message);
        if (d.registrationStatusToken) {
          sessionStorage.setItem("nexzi-registration-token", d.registrationStatusToken);
          setApprovalStatus("PENDING");
        }
        setMode("thanks");
      } else if (mode === "forgot") {
        const d = await api("/auth/forgot-password", {
          method: "POST",
          body: JSON.stringify({ email: form.email }),
        });
        setSuccess(d.message);
        setMode("reset");
      } else if (mode === "reset") {
        const d = await api("/auth/reset-password", {
          method: "POST",
          body: JSON.stringify({
            email: form.email,
            code: form.code,
            password: form.newPassword,
          }),
        });
        setSuccess(d.message);
        setForm({ ...form, password: "", newPassword: "", code: "" });
        setMode("login");
      } else {
        const d = await api("/auth/login", {
          method: "POST",
          body: JSON.stringify({ email: form.email, password: form.password }),
        });
        onLogin(d.user);
      }
    } catch (e: any) {
      setError(e.message);
    }
  };
  const titles: any = {
    login: "Welcome back",
    register: "Request access",
    verify: "Verify your email",
    thanks: "Thanks for registering!",
    forgot: "Forgot password",
    reset: "Create new password",
  };
  const subs: any = {
    login: "Sign in with your NexziByte account.",
    register:
      "Verify your email, then an administrator will review your registration.",
    verify: "Enter the 6-digit code sent to your inbox.",
    thanks:
      "Your email is verified. Please wait for the response and approval from the Admin.",
    forgot: "We will email a secure 6-digit reset code.",
    reset: "Enter the code and choose a new password.",
  };
  useEffect(() => {
    if (mode !== "thanks") return;
    const token = sessionStorage.getItem("nexzi-registration-token");
    if (!token) return;
    let stopped = false;
    const refreshStatus = async () => {
      try {
        const result = await api("/auth/registration-status", { method: "POST", body: JSON.stringify({ token }) });
        if (!stopped) setApprovalStatus(result.approvalStatus);
      } catch (e: any) {
        if (!stopped) setError(e.message);
      }
    };
    void refreshStatus();
    const timer = window.setInterval(refreshStatus, 5000);
    return () => { stopped = true; window.clearInterval(timer); };
  }, [mode]);
  if (mode === "thanks")
    return (
      <div className="min-h-screen grid lg:grid-cols-[1.1fr_.9fr] bg-white">
        <section className="hidden lg:flex login-hero p-16 text-white flex-col justify-between">
          <img src="/assets/nexzibyte-logo.png" className="logo-white" />
          <div>
            <div className="eyebrow text-cyan-300">
              FIELD INTELLIGENCE PLATFORM
            </div>
            <h1 className="text-6xl font-black leading-tight max-w-2xl mt-5">
              Every visit.
              <br />
              Every opportunity.
              <br />
              Clearly managed.
            </h1>
          </div>
          <p className="text-sm text-blue-200">NexziByte Solutions Pvt Ltd</p>
        </section>
        <section className="grid place-items-center p-6">
          <div className="w-full max-w-md registration-thanks">
            <div className="thanks-icon">
              <Check size={34} />
            </div>
            <div className="eyebrow text-cyan-600">REGISTRATION RECEIVED</div>
            <h2 className="text-4xl font-black mt-3">
              Thanks for registering!
            </h2>
            <p className="text-slate-500 mt-3">
              Your email has been verified successfully. Please wait for the
              response from the Admin. You can sign in after your account is
              approved.
            </p>
            <div className="notice mt-6">
              Approval status: {approvalStatus === "APPROVED" ? "Approved — you can sign in now" : approvalStatus === "REJECTED" ? "Rejected by Admin" : "Waiting for Admin (updates automatically)"}
            </div>
            <button
              type="button"
              className="btn btn-primary w-full mt-3"
              onClick={() => go("login")}
            >
              Return to sign in
            </button>
          </div>
        </section>
      </div>
    );
  return (
    <div className="auth-shell min-h-screen grid lg:grid-cols-[1.1fr_.9fr] bg-slate-50">
      <section className="auth-brand relative hidden overflow-hidden lg:flex login-hero p-16 text-white flex-col justify-between">
        <div className="auth-static-glow" aria-hidden="true" />
        <img
          src="/assets/nexzibyte-logo.png"
          className="logo-white relative z-10"
          alt="NexziByte Solutions"
        />
        <div className="relative z-10">
          <div className="eyebrow text-cyan-300">
            FIELD INTELLIGENCE PLATFORM
          </div>
          <h1 className="text-6xl font-black leading-tight max-w-2xl mt-5">
            Every visit.
            <br />
            <AuroraText colors={["#d9f3e4", "#86c7a5", "#ffffff", "#abdcc1"]}>
              Every opportunity.
            </AuroraText>
            <br />
            Clearly managed.
          </h1>
          <p className="text-blue-100 text-lg mt-6 max-w-xl">
            Verified field activity, smart work allocation, requirement capture
            and sales visibility in one secure workspace.
          </p>
        </div>
        <p className="relative z-10 text-sm text-blue-200">
          NexziByte Solutions Pvt Ltd
        </p>
      </section>
      <section className="auth-form-wrap grid items-start justify-items-center bg-gradient-to-br from-slate-50 via-white to-blue-50 px-6 pb-8 pt-16">
        <BlurFade delay={0.15} inView className="w-full max-w-md">
        <form
          onSubmit={submit}
          className="auth-form relative w-full overflow-hidden rounded-3xl border border-slate-200/80 bg-white/95 p-8 shadow-[0_24px_80px_rgba(15,23,42,0.12)] backdrop-blur-xl"
        >
          <BorderBeam
            size={140}
            duration={10}
            colorFrom="#0d5b3b"
            colorTo="#8fc0a7"
          />
          <style>{`
            .auth-form.auth-form {
              box-sizing: border-box !important;
              padding: 38px !important;
            }

            .auth-shell { min-height: 100vh; background:#f4efe2 !important; color:#20211f !important; }
            .auth-brand.auth-brand.login-hero {
              min-height: 100vh; padding: 48px 56px !important;
              background:linear-gradient(145deg,#050605 0%,#0d0f0c 56%,#242318 100%) !important;
            }
            .auth-brand .logo-white {
              position: relative !important;
              z-index: 10 !important;
              width: 230px !important;
              max-height: 104px !important;
              object-fit: contain !important;
              filter: none !important;
              border-radius: 12px !important;
              box-shadow: 0 18px 45px rgba(0,0,0,.2) !important;
            }
            .auth-brand .eyebrow { color:#f0cf72 !important; }
            .auth-brand h1 { color:#fffdf7 !important; }
            .auth-brand p { color:#c9c5b9 !important; }
            .auth-static-glow {
              position: absolute;
              inset: 0;
              pointer-events: none;
              background:
                radial-gradient(circle at 80% 22%, rgba(242,201,76,.16), transparent 28rem),
                radial-gradient(circle at 18% 78%, rgba(190,135,25,.11), transparent 24rem),
                linear-gradient(135deg, rgba(255,255,255,.022), transparent 42%);
            }
            .auth-form-wrap {
              min-height: 100vh;
              background:radial-gradient(circle at 85% 8%,rgba(242,201,76,.18),transparent 24rem),linear-gradient(145deg,#faf7ed,#f2ecdf) !important;
            }
            .auth-form.auth-form {
              background:rgba(255,253,247,.97) !important;
              border-color:#d9d0bf !important;
              box-shadow:0 24px 70px rgba(53,43,25,.14) !important;
            }
            .auth-form .eyebrow { color:#9a721b !important; }
            .auth-form h2 { color:#171816 !important; }
            .auth-form > p { color:#756f64 !important; }
            .auth-form label { color:#34352f !important; }

            .auth-form .input {
              display: block !important;
              box-sizing: border-box !important;
              width: 100% !important;
              max-width: 100% !important;
              min-height: 56px !important;
              margin: 8px 0 18px !important;
              padding: 0 16px !important;
              color: #20211f !important;
              background: #fffdf8 !important;
              border: 1px solid #d8d0c0 !important;
              border-radius: 14px !important;
              outline: none !important;
              box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04) !important;
              transition: border-color 160ms ease, box-shadow 160ms ease,
                background-color 160ms ease !important;
            }

            .auth-form .input:hover {
              border-color: #c9b67e !important;
            }

            .auth-form .input:focus {
              background: #ffffff !important;
              border-color: #d4a72d !important;
              box-shadow: 0 0 0 4px rgba(224, 173, 47, 0.15),
                0 8px 22px rgba(53, 43, 25, 0.07) !important;
            }

            .auth-form .input:-webkit-autofill,
            .auth-form .input:-webkit-autofill:hover,
            .auth-form .input:-webkit-autofill:focus {
              -webkit-text-fill-color: #20211f !important;
              -webkit-box-shadow: 0 0 0 1000px #fffdf8 inset !important;
              caret-color: #20211f !important;
              border: 1px solid #d8d0c0 !important;
              transition: background-color 9999s ease-out 0s !important;
            }
            .auth-form .btn-primary {
              min-height:56px !important;background:#20211f !important;color:#fff !important;
              border:1px solid #20211f !important;box-shadow:0 12px 26px rgba(32,33,31,.18) !important;
              transition:transform .18s ease,background .18s ease,box-shadow .18s ease !important;
            }
            .auth-form .btn-primary:hover { background:#343630 !important;transform:translateY(-2px);box-shadow:0 16px 32px rgba(32,33,31,.22) !important; }
            .auth-form .auth-link { color:#4e4a40 !important; }
            .auth-form .auth-link:hover { color:#8a6414 !important;background:#fbf1d4 !important; }
            .auth-form .auth-link svg { color:#a77a18 !important; }
            /* Management-reference authentication palette. */
            .auth-brand.auth-brand.login-hero { background:radial-gradient(circle at 82% 18%,rgba(151,211,178,.18),transparent 25rem),linear-gradient(145deg,#063c28,#0d5b3b 68%,#124d36) !important; }
            .auth-brand .eyebrow { color:#b9ddc9 !important; }.auth-brand p{color:#d3e4da!important}
            .auth-static-glow{background:repeating-radial-gradient(ellipse at 108% 115%,transparent 0 22px,rgba(255,255,255,.025) 23px 24px)!important}
            .auth-form-wrap{background:radial-gradient(circle at 85% 7%,rgba(143,192,167,.15),transparent 24rem),linear-gradient(145deg,#f8faf7,#eef3ef)!important}
            .auth-form.auth-form{background:rgba(255,255,255,.98)!important;border-color:#dce5df!important;box-shadow:0 24px 70px rgba(27,62,42,.12)!important}
            .auth-form .eyebrow{color:#0d5b3b!important}.auth-form .input{border-color:#d8e2dc!important;background:#fbfcfb!important}.auth-form .input:hover{border-color:#a9c6b5!important}.auth-form .input:focus{border-color:#0d5b3b!important;box-shadow:0 0 0 4px rgba(13,91,59,.11),0 8px 22px rgba(27,62,42,.06)!important}
            .auth-form .input:-webkit-autofill,.auth-form .input:-webkit-autofill:hover,.auth-form .input:-webkit-autofill:focus{border-color:#d8e2dc!important;-webkit-box-shadow:0 0 0 1000px #fbfcfb inset!important}
            .auth-form .btn-primary{background:#0d5b3b!important;border-color:#0d5b3b!important;box-shadow:0 12px 26px rgba(13,91,59,.18)!important}.auth-form .btn-primary:hover{background:#073d29!important;box-shadow:0 16px 32px rgba(13,91,59,.22)!important}
            .auth-form .auth-link:hover{color:#0d5b3b!important;background:#e8f2ec!important}.auth-form .auth-link svg{color:#0d5b3b!important}
            .auth-form > img { width:min(245px,100%) !important;height:auto !important;object-fit:contain !important;margin:0 auto 30px !important; }
            .auth-brand > img,.auth-form > img { animation:auth-logo-in .55s cubic-bezier(.2,.8,.2,1) both; }
            .auth-form { animation:auth-card-in .52s cubic-bezier(.2,.8,.2,1) both; }
            @keyframes auth-logo-in { from{opacity:0;transform:translateY(-7px)} to{opacity:1;transform:none} }
            @keyframes auth-card-in { from{opacity:0;transform:translateY(13px) scale(.99)} to{opacity:1;transform:none} }

            @media (max-width: 640px) {
              .auth-form.auth-form {
                padding: 24px !important;
                border-radius: 22px !important;
              }

              .auth-form .input {
                min-height: 52px !important;
              }
              .auth-form-wrap { padding:18px 12px 28px !important;align-items:start !important; }
            }
            @media (prefers-reduced-motion:reduce) { .auth-brand > img,.auth-form > img,.auth-form { animation:none !important; } }
            @media (min-width: 1024px) {
              .auth-form-wrap { padding-top: clamp(42px, 8vh, 78px) !important; }
            }
          `}</style>
          <img
            src="/assets/nexzibyte-logo.png"
            className="w-60 mb-10 lg:hidden"
          />
          <div className="eyebrow text-cyan-600">SECURE WORKSPACE</div>
          <h2 className="text-4xl font-black mt-3">{titles[mode]}</h2>
          <p className="text-slate-500 mt-2 mb-8">{subs[mode]}</p>
          {mode === "register" && (
            <>
              <label>Name</label>
              <input
                name="name"
                className={input}
                value={form.name}
                onChange={change}
                required
              />
              <label>Phone</label>
              <input
                name="phone"
                className={input}
                value={form.phone}
                onChange={change}
              />
              <label>Requested role</label>
              <select
                name="requestedRole"
                className={input}
                value={form.requestedRole}
                onChange={change}
              >
                <option value="SALES_BD_EXECUTIVE">Sales / BD Executive</option>
                <option value="BD_MANAGER">BD Manager</option>
                <option value="TECHNICAL_TEAM">Technical Team</option>
                <option value="MANAGEMENT_VIEWER">Management Viewer</option>
                <option value="ADMIN">Admin</option>
              </select>
            </>
          )}
          <label>Email address</label>
          <input
            name="email"
            type="email"
            className={input}
            value={form.email}
            onChange={change}
            required
          />
          {["login", "register"].includes(mode) && (
            <>
              <label>Password</label>
              <input
                name="password"
                type="password"
                className={input}
                value={form.password}
                onChange={change}
                required
              />
            </>
          )}
          {["verify", "reset"].includes(mode) && (
            <>
              <label>6-digit code</label>
              <input
                name="code"
                inputMode="numeric"
                maxLength={6}
                className={input}
                value={form.code || ""}
                onChange={change}
                required
              />
            </>
          )}
          {mode === "reset" && (
            <>
              <label>New password</label>
              <input
                name="newPassword"
                type="password"
                className={input}
                value={form.newPassword || ""}
                onChange={change}
                required
              />
            </>
          )}
          {error && <Notice danger>{error}</Notice>}
          {success && <Notice>{success}</Notice>}
          <button className="btn btn-primary w-full mt-3">
            {mode === "login"
              ? "Sign in"
              : mode === "register"
                ? "Register & send code"
                : mode === "verify"
                  ? "Verify email"
                  : mode === "forgot"
                    ? "Send reset code"
                    : "Change password"}
          </button>
          {mode === "login" && (
            <>
              <button
                type="button"
                onClick={() => go("forgot")}
                className="auth-link"
              >
                <KeyRound size={16} />
                Forgot password?
              </button>
              <button
                type="button"
                onClick={() => go("register")}
                className="auth-link"
              >
                <MailCheck size={16} />
                New user? Register for approval
              </button>
              <button
                type="button"
                onClick={() => window.location.assign(import.meta.env.VITE_QUOTATION_APP_URL || "http://localhost:5174")}
                className="platform-switch sales-platform-switch"
              >
                <span className="platform-switch-icon">↗</span>
                <span><strong>Switch to NexLekha Quotation Management</strong><small>Open the quotation workspace</small></span>
                <ChevronRight size={18} />
              </button>
            </>
          )}
          {mode === "verify" && (
            <button
              type="button"
              onClick={async () => {
                try {
                  const d = await api("/auth/resend-verification", {
                    method: "POST",
                    body: JSON.stringify({ email: form.email }),
                  });
                  setSuccess(d.message);
                } catch (e: any) {
                  setError(e.message);
                }
              }}
              className="auth-link"
            >
              Resend verification code
            </button>
          )}
          {mode !== "login" && (
            <button
              type="button"
              onClick={() => go("login")}
              className="auth-link"
            >
              Back to sign in
            </button>
          )}
        </form>
        </BlurFade>
      </section>
    </div>
  );
}

function ClientBooking({ token }: { token: string }) {
  const { data, error, isLoading } = useQuery({ queryKey: ["public-booking", token], queryFn: () => api(`/public/bookings/${token}`), retry: false });
  const [form, setForm] = useState({ slot: "", name: "", email: "", note: "" });
  const [message, setMessage] = useState("");
  const [submitError, setSubmitError] = useState("");
  const confirm = async () => {
    try {
      setSubmitError("");
      const result = await api(`/public/bookings/${token}/confirm`, { method: "POST", body: JSON.stringify(form) });
      setMessage(result.message);
    } catch (e: any) { setSubmitError(e.message); }
  };
  return <div className="booking-shell">
    <div className="booking-brand"><img src="/assets/nexzibyte-logo.png" alt="NexziByte Solutions"/><span>Secure client scheduling</span></div>
    <main className="booking-card">
      {isLoading && <p>Loading available meeting times…</p>}
      {error && <Notice danger>{(error as Error).message}</Notice>}
      {data && <>
        <div className="booking-eyebrow">MEETING INVITATION</div>
        <h1>Choose a convenient time</h1>
        <p className="booking-intro"><b>{data.salesperson}</b> from NexziByte Solutions would like to discuss <b>{data.purpose}</b> with {data.company}.</p>
        {data.status === "BOOKED" || message ? <div className="booking-success"><Check/><div><h2>Meeting confirmed</h2><p>{message || `Your meeting is booked for ${new Date(data.selectedSlot).toLocaleString()}.`}</p></div></div> : <>
          <div className="slot-grid">{(data.slots || []).map((slot: string) => <button key={slot} className={form.slot === slot ? "selected" : ""} onClick={() => setForm({ ...form, slot })}><CalendarDays size={18}/><span>{new Date(slot).toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" })}<small>{new Date(slot).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} · IST</small></span>{form.slot === slot && <Check size={17}/>}</button>)}</div>
          <div className="booking-form"><label>Your name<input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}/></label><label>Email address<input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}/></label><label className="wide">Note for the representative (optional)<textarea value={form.note} onChange={e => setForm({ ...form, note: e.target.value })}/></label></div>
          {submitError && <Notice danger>{submitError}</Notice>}
          <button className="btn btn-primary booking-confirm" disabled={!form.slot || !form.name || !form.email} onClick={confirm}>Confirm meeting time</button>
        </>}
      </>}
    </main>
    <p className="booking-footer">Scheduling powered by NexziByte CRM · Your link is private and time-limited.</p>
  </div>;
}

function ClientQuotationResponse({ token }: { token: string }) {
  const [data, setData] = useState<any>(null);
  const [decision, setDecision] = useState("YES");
  const [reason, setReason] = useState("");
  const [feedback, setFeedback] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  useEffect(() => { api(`/public/quotations/respond/${encodeURIComponent(token)}`).then(setData).catch((e: any) => setError(e.message)); }, [token]);
  const submit = async () => {
    try {
      setSending(true); setError("");
      const result = await api(`/public/quotations/respond/${encodeURIComponent(token)}`, { method: "POST", body: JSON.stringify({ decision, reason, feedback }) });
      setMessage(result.message);
    } catch (e: any) { setError(e.message); }
    finally { setSending(false); }
  };
  return <div className="client-quote-page">
    <main className="client-quote-card">
      <div className="booking-eyebrow">NEXZIBYTE SOLUTIONS · SECURE QUOTATION REVIEW</div>
      {error && !data ? <Notice danger>{error}</Notice> : !data ? <p>Loading quotation…</p> : <>
        <div className="client-quote-head"><div><h1>Review your quotation</h1><p>{data.company} · {data.opportunity}</p></div><div><span>Version {data.version}</span><b>₹{Number(data.totalAmount || 0).toLocaleString("en-IN")}</b></div></div>
        <div className="client-quote-meta"><span>Valid until <b>{data.validUntil ? new Date(data.validUntil).toLocaleDateString() : "As discussed"}</b></span>{data.documentUrl && <a href={data.documentUrl} target="_blank" rel="noreferrer"><FileText size={17}/>Open quotation PDF</a>}</div>
        <div className="client-quote-items">{data.items.map((item: any, index: number) => <div key={index}><span>{item.description}<small>{Number(item.quantity)} × ₹{Number(item.unitPrice).toLocaleString("en-IN")}</small></span><b>₹{Number(item.amount).toLocaleString("en-IN")}</b></div>)}</div>
        {data.submitted || message ? <div className="booking-success"><Check/><div><h2>Response submitted</h2><p>{message || `Your ${data.decision} response has already been shared with NexziByte Solutions.`}</p></div></div> : <>
          <h2 className="budget-question">Is the quotation budget acceptable?</h2>
          <div className="client-decision-grid">{[["YES", "Yes, approved", "Budget and quotation are acceptable"], ["MAYBE", "Maybe", "Need negotiation or clarification"], ["NO", "No", "Budget or terms are not acceptable"]].map(([value,title,sub]) => <button key={value} className={decision === value ? `active ${value.toLowerCase()}` : ""} onClick={() => setDecision(value)}><b>{title}</b><span>{sub}</span></button>)}</div>
          {decision !== "YES" && <label className="client-reason">Why is your response {decision.toLowerCase()}? *<textarea value={reason} onChange={e => setReason(e.target.value)} placeholder={decision === "MAYBE" ? "Example: Budget needs discussion, approval is pending, or scope needs revision" : "Please specify whether the reason is budget, scope, timeline, terms, competitor pricing, or another concern"}/><small>A specific reason is mandatory so our Sales and Technical teams can prepare for the discussion.</small></label>}
          <label className="client-reason">Additional comments (optional)<textarea value={feedback} onChange={e => setFeedback(e.target.value)} /></label>
          {error && <Notice danger>{error}</Notice>}
          <button className="btn btn-primary client-quote-submit" disabled={sending || (decision !== "YES" && reason.trim().length < 10)} onClick={submit}>{sending ? "Submitting…" : `Submit ${decision} response`}</button>
        </>}
      </>}
    </main>
    <p className="booking-footer">Secure quotation response powered by NexziByte CRM.</p>
  </div>;
}

function App() {
  const bookingToken = new URLSearchParams(window.location.search).get("booking");
  if (bookingToken) return <ClientBooking token={bookingToken}/>;
  const quotationResponseToken = new URLSearchParams(window.location.search).get("quotationResponse");
  if (quotationResponseToken) return <ClientQuotationResponse token={quotationResponseToken}/>;
  const [user, setUser] = useState<any>(null);
  const [sessionConflict, setSessionConflict] = useState<any>(null);
  const acceptUser = (nextUser: any) => {
    sessionStorage.setItem("nexzi-tab-user", JSON.stringify({ name: nextUser.name, role: nextUser.role }));
    setSessionConflict(null);
    setUser(nextUser);
    try { new BroadcastChannel("nexzi-auth").postMessage({ type: "SIGNED_IN", name: nextUser.name, role: nextUser.role }); } catch { /* unsupported browser */ }
  };
  useEffect(() => {
    api("/me")
      .then((d) => {
        const remembered = sessionStorage.getItem("nexzi-tab-user");
        const previous = remembered ? JSON.parse(remembered) : null;
        if (previous && (previous.role !== d.user.role || previous.name !== d.user.name)) setSessionConflict({ previous, current: d.user });
        else acceptUser(d.user);
      })
      .catch(() => setUser(null));
  }, []);
  useEffect(() => {
    if (!user) return;
    let stopped = false;
    const checkIdentity = async () => {
      try {
        const d = await api("/me");
        if (!stopped && (d.user.role !== user.role || d.user.name !== user.name)) setSessionConflict({ previous: user, current: d.user });
      } catch { /* normal API authentication handling will show login when necessary */ }
    };
    const timer = window.setInterval(checkIdentity, 5000);
    let channel: BroadcastChannel | null = null;
    try {
      channel = new BroadcastChannel("nexzi-auth");
      channel.onmessage = (event) => {
        const next = event.data;
        if (next?.type === "SIGNED_IN" && (next.role !== user.role || next.name !== user.name)) setSessionConflict({ previous: user, current: next });
      };
    } catch { /* unsupported browser */ }
    return () => { stopped = true; window.clearInterval(timer); channel?.close(); };
  }, [user]);
  const logout = async () => {
    try {
      await api("/auth/logout", { method: "POST" });
    } finally {
      sessionStorage.removeItem("nexzi-tab-user");
      setUser(null);
    }
  };
  if (sessionConflict) return (
    <div className="min-h-screen grid place-items-center bg-slate-50 p-6">
      <div className="w-full max-w-lg rounded-3xl bg-white p-8 shadow-xl border border-slate-200">
        <ShieldCheck size={42} className="text-amber-500" />
        <h1 className="text-3xl font-black mt-5">Account changed in another tab</h1>
        <p className="text-slate-600 mt-3">This tab was opened as <b>{sessionConflict.previous?.name}</b>, but this browser is now signed in as <b>{sessionConflict.current?.name}</b>. Browser cookies are shared between tabs.</p>
        <p className="text-slate-600 mt-3">Use a normal window for Admin and an Incognito window or another browser profile for Sales testing.</p>
        <button className="btn btn-primary w-full mt-6" onClick={() => acceptUser(sessionConflict.current)}>Continue with {sessionConflict.current?.name}</button>
      </div>
    </div>
  );
  return user ? (
    <Shell user={user} logout={logout} updateUser={setUser} />
  ) : (
    <Auth onLogin={acceptUser} />
  );
}
function Shell({ user, logout, updateUser }: any) {
  const [page, setPage] = useState("dashboard");
  const [accent, setAccent] = useState(() => localStorage.getItem("nx-accent") || "forest");
  const [open, setOpen] = useState(false);
  const [workspaceSearch, setWorkspaceSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const notificationReady = useRef(false);
  const previousUnreadIds = useRef<Set<string>>(new Set());
  const { data: liveNotifications = [], isFetched: notificationsFetched } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => api("/notifications"),
    refetchInterval: 15000,
  });
  const unreadNotifications = liveNotifications.filter((item: any) => item.status === "UNREAD");
  useEffect(() => {
    document.documentElement.dataset.accent = accent;
    localStorage.setItem("nx-accent", accent);
  }, [accent]);
  useEffect(() => {
    if (!notificationsFetched) return;
    const current = new Set<string>(unreadNotifications.map((item: any) => item.id));
    let alerted = new Set<string>();
    try { alerted = new Set(JSON.parse(localStorage.getItem("nx-alerted-notifications") || "[]")); } catch { alerted = new Set(); }
    if (!notificationReady.current) {
      previousUnreadIds.current = current;
      notificationReady.current = true;
      return;
    }
    const incoming = unreadNotifications.filter((item: any) => !previousUnreadIds.current.has(item.id) && !alerted.has(item.id));
    if (notificationReady.current && incoming.length) {
      playAlertTone();
      navigator.vibrate?.([220, 120, 220]);
      const won = incoming.find((item: any) => item.type === "QUOTATION_WON");
      const hot = incoming.find((item: any) => item.type === "HOT_QUOTATION_ALERT");
      if (won) celebrateDeal(won.title.replace(/^Deal won:\s*/i, ""));
      if (hot) showQuotationAlert(hot.title, hot.message);
      incoming.forEach((item: any) => alerted.add(item.id));
      localStorage.setItem("nx-alerted-notifications", JSON.stringify([...alerted].slice(-300)));
    }
    previousUnreadIds.current = current;
  }, [liveNotifications, notificationsFetched]);
  const elevated = ["ADMIN", "SALES_HEAD", "BD_MANAGER", "TECHNICAL_TEAM"].includes(user.role);
  const viewer = user.role === "MANAGEMENT_VIEWER";
  const items: any[] = [
    ["dashboard", "Dashboard", LayoutDashboard],
    ["myday", "My Day", CalendarDays],
    ...(user.role === "ADMIN" ? [["calendar", "Calendar", CalendarDays]] : []),
    ["assignments", "Work Assignments", BriefcaseBusiness],
    ["followups", "Follow-Ups", Repeat2],
    ["pipeline", "Pipeline", TrendingUp],
    ...(elevated || viewer ? [["requirements", "Project Requirements", ClipboardList]] : []),
    ["visits", "Visits", MapPin],
    ["companies", "Companies", Building2],
    ["communications", "Communications", Mail],
    ["notifications", "Notifications", Bell],
    ...(elevated || viewer
      ? [
          ["activity", "Team Activity", Activity],
          ["fieldmap", "Field Map", MapPin],
          ["reports", "Reports", BarChart3],
          ["logs", "Activity Logs", FileText],
          ...(viewer ? [] : [["aicalls", "AI Call Center", PhoneCall]]),
        ]
      : []),
    ...(user.role === "ADMIN"
      ? [["users", "User Approvals", ShieldCheck]]
      : []),
  ];
  const pages: any = {
    dashboard: <Dashboard user={user} onNavigate={setPage} accent={accent} />,
    myday: <MyDay user={user} />,
    calendar: <AdminCalendar />,
    assignments: <Assignments user={user} />,
    followups: <FollowUps user={user} />,
    pipeline: <Pipeline user={user} />,
    requirements: <ProjectRequirements />,
    visits: <Visits user={user} />,
    companies: <Companies user={user} />,
    communications: <Communications />,
    notifications: <Notifications />,
    settings: <Settings user={user} updateUser={updateUser} logout={logout} accent={accent} setAccent={setAccent} />,
    activity: <TeamActivity />,
    fieldmap: <FieldMap />,
    reports: <Reports />,
    logs: <ActivityLogs />,
    aicalls: <AiCalls />,
    users: <UsersAdmin />,
  };
  const searchAliases: Record<string, string> = {
    dashboard: "home overview metrics performance summary",
    myday: "today schedule daily work calendar",
    calendar: "admin calendar daily history visits assignments followups",
    assignments: "tasks work allocation assigned company",
    followups: "follow up reminder meeting schedule",
    pipeline: "opportunity leads quotation sales stages",
    requirements: "project requirement yes no collaboration",
    visits: "visit check in checkout gps proof photos",
    companies: "company client customer contacts",
    communications: "email mail delivery smtp",
    notifications: "alerts reminders updates",
    activity: "team employees live activity",
    fieldmap: "map location gps field",
    reports: "analytics charts report",
    logs: "audit history activity logs",
    aicalls: "voice calls reminder ai",
    users: "approval registration users salespeople",
  };
  const normalizedSearch = workspaceSearch.trim().toLowerCase();
  const searchResults = normalizedSearch
    ? items.filter(([id, label]: any) => `${label} ${searchAliases[id] || ""}`.toLowerCase().includes(normalizedSearch))
    : [];
  const openSearchResult = (id: string) => {
    setPage(id);
    setSearchOpen(false);
    setWorkspaceSearch("");
  };
  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        const inputs = Array.from(document.querySelectorAll<HTMLInputElement>(".workspace-search-input"));
        inputs.find((element) => element.offsetParent !== null)?.focus();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", shortcut);
    return () => window.removeEventListener("keydown", shortcut);
  }, []);
  return (
    <div className="premium-shell min-h-screen">
      <style>{`
        html { scroll-behavior:smooth; }
        body { overscroll-behavior-y:none; -webkit-overflow-scrolling:touch; }
        :root {
          --nx-ink: #071426;
          --nx-navy: #081a33;
          --nx-blue: #2563eb;
          --nx-cyan: #06b6d4;
          --nx-line: #dbe5f2;
          --nx-muted: #64748b;
          --nx-surface: rgba(255,255,255,.88);
          --nx-shadow: 0 18px 50px rgba(15, 32, 61, .09);
        }
        .premium-shell { background: #eef3f9; color: var(--nx-ink); }
        .premium-main { position: relative; isolation: isolate; }
        .premium-main:before {
          content: ""; position: fixed; inset: 0 0 0 272px; z-index: -1; pointer-events: none;
          background:
            radial-gradient(circle at 82% 2%, rgba(37,99,235,.12), transparent 26rem),
            radial-gradient(circle at 42% 28%, rgba(6,182,212,.07), transparent 24rem),
            linear-gradient(180deg,#f7faff 0,#eef3f9 42rem);
        }
        .page-container { max-width: 1540px !important; margin-inline: auto; }
        .page-title {
          position: relative; overflow: hidden; min-height: 142px; padding: 30px 34px !important;
          border: 1px solid rgba(255,255,255,.12) !important; border-radius: 24px !important;
          background: linear-gradient(125deg,#07172c 0%,#102d54 54%,#164e63 120%) !important;
          box-shadow: 0 22px 55px rgba(5,20,42,.16); color: white; align-items: center !important;
        }
        .page-title:before { content:""; position:absolute; width:320px; height:320px; border-radius:50%; right:-80px; top:-190px; background:rgba(34,211,238,.15); box-shadow:0 0 80px rgba(34,211,238,.2); }
        .page-title:after { content:"NEXZIBYTE  /  OPERATIONS"; position:absolute; right:32px; bottom:20px; font-size:10px; letter-spacing:.22em; color:rgba(255,255,255,.45); font-weight:800; }
        .page-title h1 { color:#fff !important; font-size:clamp(1.8rem,3vw,2.55rem) !important; letter-spacing:-.04em; margin:0 0 8px !important; }
        .page-title p { color:#c9d9eb !important; font-size:14px; max-width:720px; margin:0 !important; }
        .page-title > button,.page-title .btn { position:relative; z-index:2; background:#fff !important; color:#0b1f3a !important; border-color:#fff !important; box-shadow:0 12px 28px rgba(0,0,0,.18) !important; }
        .panel {
          background:var(--nx-surface) !important; border:1px solid rgba(203,213,225,.78) !important;
          border-radius:22px !important; padding:24px !important; box-shadow:var(--nx-shadow) !important;
          backdrop-filter: blur(18px); transition: border-color .2s, box-shadow .2s, transform .2s;
        }
        .panel:hover { border-color:#b8cae1 !important; box-shadow:0 22px 58px rgba(15,32,61,.12) !important; }
        .panel > h3 { font-size:16px !important; letter-spacing:-.01em; color:#0b1f3a !important; padding-bottom:16px; margin-bottom:18px !important; border-bottom:1px solid #e5ebf3; display:flex; align-items:center; gap:9px; }
        .panel > h3:before { content:""; width:7px; height:7px; border-radius:99px; background:linear-gradient(135deg,#2563eb,#22d3ee); box-shadow:0 0 0 5px rgba(37,99,235,.09); }
        .table-wrap { border:1px solid #dfe7f1 !important; border-radius:16px !important; overflow:auto !important; background:#fff; }
        table { border-collapse:separate !important; border-spacing:0 !important; }
        thead th { position:sticky; top:0; z-index:1; padding:13px 16px !important; background:#f3f7fc !important; border-bottom:1px solid #dbe5f1 !important; color:#52647b !important; font-size:10px !important; font-weight:850 !important; letter-spacing:.09em; text-transform:uppercase; white-space:nowrap; }
        tbody td { padding:15px 16px !important; border-bottom:1px solid #edf1f6 !important; color:#25364d; vertical-align:middle; }
        tbody tr:last-child td { border-bottom:0 !important; }
        tbody tr { transition:background .16s,transform .16s; }
        tbody tr:hover { background:#f7faff !important; }
        tbody td b { color:#0b1f3a; }
        tbody td small { color:#7a8ba1 !important; margin-top:4px; }
        .btn { min-height:43px; border-radius:12px !important; font-weight:750 !important; letter-spacing:-.01em; transition:transform .18s,box-shadow .18s,background .18s !important; }
        .btn:hover { transform:translateY(-1px); }
        .btn-primary { background:linear-gradient(135deg,#2563eb,#4f46e5) !important; border:0 !important; color:#fff !important; box-shadow:0 10px 25px rgba(37,99,235,.22) !important; }
        .btn-primary:hover { box-shadow:0 14px 30px rgba(37,99,235,.3) !important; }
        input:not([type="checkbox"]):not([type="radio"]),select,textarea {
          min-height:44px; border:1px solid #ced9e7 !important; border-radius:11px !important; background:#fbfdff !important; color:#12243d !important; box-shadow:inset 0 1px 2px rgba(15,23,42,.025); outline:none;
        }
        input:focus,select:focus,textarea:focus { border-color:#4f7ee8 !important; box-shadow:0 0 0 4px rgba(37,99,235,.1) !important; background:#fff !important; }
        .functional-search {
          position:relative !important; display:block !important; padding:0 !important;
          border:0 !important; background:transparent !important; box-shadow:none !important;
        }
        .functional-search > svg {
          position:absolute !important; z-index:3; left:15px !important; top:50% !important;
          transform:translateY(-50%); color:#71839b; pointer-events:none;
        }
        .top-search input,.functional-search input {
          display:block !important; box-sizing:border-box !important; width:100% !important;
          min-height:0 !important; height:44px !important; margin:0 !important;
          padding:0 16px 0 43px !important; appearance:none !important; outline:none !important;
          border:1px solid #d7e1ed !important; border-radius:13px !important;
          background:#f7f9fc !important; color:#172a44 !important;
          box-shadow:inset 0 1px 2px rgba(15,23,42,.025),0 5px 15px rgba(15,23,42,.035) !important;
          transition:border-color .18s,box-shadow .18s,background .18s !important;
        }
        .top-search input:focus,.functional-search input:focus {
          border-color:#7ba2f4 !important; background:#fff !important;
          box-shadow:0 0 0 4px rgba(37,99,235,.09),0 8px 20px rgba(15,23,42,.06) !important;
        }
        .search-results {
          position:absolute !important; z-index:100 !important; top:calc(100% + 9px) !important; left:0 !important; right:0 !important;
          padding:8px !important; background:#fff !important; border:1px solid #dbe5f1 !important; border-radius:14px !important;
          box-shadow:0 20px 50px rgba(15,32,61,.18) !important;
        }
        .search-results button { width:100%; min-height:42px; display:flex; align-items:center; gap:9px; padding:8px 10px; border-radius:9px; color:#263950; }
        .search-results button:hover { background:#eff5ff; color:#1d4ed8; }
        .search-results button small { margin-left:auto; color:#8494a9; }
        .search-results p { padding:12px; margin:0; color:#718198; font-size:13px; }
        label { color:#33455d; font-weight:700; }
        .badge { border:1px solid rgba(100,116,139,.15); border-radius:999px !important; padding:6px 10px !important; font-size:10px !important; letter-spacing:.04em; font-weight:850 !important; }
        .empty { min-height:190px; border:1px dashed #cbd8e8; border-radius:16px; background:linear-gradient(145deg,#fafcff,#f4f8fc); display:grid; place-items:center; align-content:center; gap:10px; color:#6b7e96; }
        .empty svg { color:#3b82f6; background:#e8f1ff; padding:12px; width:50px; height:50px; border-radius:15px; }
        .filter-bar,.panel-toolbar { background:#f4f7fb !important; border:1px solid #dfe7f1; border-radius:15px; padding:12px !important; gap:10px !important; }
        .notice { border-radius:12px !important; border:1px solid #b9e4d2 !important; background:#effbf6 !important; }
        .notice.danger { border-color:#fecaca !important; background:#fff4f4 !important; }
        .modal-bg {
          position:fixed !important; inset:0 !important; z-index:9999 !important;
          display:flex !important; align-items:flex-start !important; justify-content:center !important;
          padding:clamp(18px,4vh,42px) 20px !important; overflow-y:auto !important;
          overscroll-behavior:contain; backdrop-filter:blur(9px); -webkit-backdrop-filter:blur(9px);
          background:rgba(3,14,31,.62) !important;
        }
        .modal {
          position:relative !important; width:min(620px,calc(100vw - 40px)) !important;
          max-width:620px !important; max-height:calc(100dvh - clamp(36px,8vh,84px)) !important;
          margin:0 auto !important; overflow-y:auto !important; overflow-x:hidden !important;
          overscroll-behavior:contain; background:#fff !important;
          border:1px solid rgba(255,255,255,.7) !important; border-radius:24px !important;
          box-shadow:0 30px 90px rgba(0,0,0,.32) !important;
          scrollbar-width:thin; scrollbar-color:#a9b6c7 transparent;
        }
        .modal.wide { width:min(920px,calc(100vw - 40px)) !important; max-width:920px !important; }
        .modal::-webkit-scrollbar { width:7px; }
        .modal::-webkit-scrollbar-track { background:transparent; margin:18px 0; }
        .modal::-webkit-scrollbar-thumb { background:#a9b6c7; border-radius:999px; }
        .modal-head {
          position:sticky !important; top:0 !important; z-index:10 !important;
          min-height:58px; margin-top:0 !important; padding:2px 0 17px !important;
          background:rgba(255,255,255,.97) !important; backdrop-filter:blur(12px);
          border-bottom:1px solid #e6ebf2;
        }
        .modal-head h2 { margin:0 !important; padding-right:52px; color:#10223b !important; line-height:1.25 !important; }
        .modal-head button { position:absolute !important; top:0 !important; right:0 !important; width:42px !important; height:42px !important; border-radius:12px !important; }
        .modal form { padding-bottom:4px; }
        .log-summary > div { border-radius:18px !important; border:1px solid #dbe5f1 !important; box-shadow:0 12px 30px rgba(15,32,61,.07); background:linear-gradient(145deg,#fff,#f7faff) !important; }
        .activity-feed { gap:10px !important; }
        .log-item { border:1px solid #e0e7f0 !important; border-radius:15px !important; padding:16px !important; background:#fff; transition:transform .18s,border-color .18s,box-shadow .18s; }
        .log-item:hover { transform:translateX(3px); border-color:#b9ccec !important; box-shadow:0 10px 24px rgba(37,99,235,.08); }
        .activity-grid { display:grid !important; grid-template-columns:repeat(auto-fit,minmax(330px,1fr)) !important; gap:14px !important; }
        .activity-card { min-height:150px; padding:22px 24px !important; border:1px solid #dce5ef !important; border-radius:18px !important; background:rgba(255,255,255,.93) !important; box-shadow:0 12px 32px rgba(15,32,61,.07); }
        .activity-card > .flex { height:100%; align-items:flex-start; gap:18px; }
        .activity-card b { display:block; color:#0d1d33; font-size:16px; line-height:1.35; }
        .activity-card p { color:#71839c !important; line-height:1.45; margin:8px 0 14px !important; }
        .activity-card small { color:#31445d !important; }
        .activity-card .mini { flex:0 0 auto; width:auto !important; min-width:88px; min-height:36px !important; height:36px !important; padding:0 12px !important; border-radius:10px !important; white-space:nowrap; }
        @media (min-width: 901px) {
          .premium-shell { padding-left:272px !important; }
          .desktop-sidebar { width:272px !important; height:100vh !important; padding:0 18px 16px !important; display:flex !important; flex-direction:column !important; overflow:hidden !important; background:linear-gradient(180deg,#061426 0%,#0a203b 60%,#0b2946 100%) !important; border-right:1px solid rgba(255,255,255,.07) !important; box-shadow:18px 0 60px rgba(4,14,30,.13); }
          .desktop-brand { width:214px !important; height:76px !important; margin:16px auto 14px !important; padding:9px 12px !important; border:1px solid rgba(255,255,255,.13) !important; border-radius:14px !important; background:#fff !important; box-shadow:0 12px 28px rgba(0,0,0,.2); }
          .desktop-brand img { display:block !important; width:100% !important; height:100% !important; object-fit:contain !important; filter:none !important; opacity:1 !important; }
          .desktop-workspace { margin:14px 4px 12px !important; padding:14px 15px !important; background:rgba(255,255,255,.055); border:1px solid rgba(255,255,255,.08); border-radius:14px; }
          .desktop-workspace span { color:#61d7ef !important; letter-spacing:.16em !important; }
          .desktop-workspace b { color:#f6fbff !important; }
          .desktop-sidebar nav { flex:1 1 auto !important; min-height:0 !important; overflow-y:auto !important; overflow-x:hidden !important; overscroll-behavior:contain !important; scrollbar-gutter:stable; touch-action:pan-y; padding:4px 5px 10px 0 !important; margin:0 -6px 10px 0 !important; }
          .desktop-sidebar nav::-webkit-scrollbar { width:5px; }
          .desktop-sidebar nav::-webkit-scrollbar-track { background:transparent; }
          .desktop-sidebar nav::-webkit-scrollbar-thumb { background:rgba(148,180,211,.28); border-radius:999px; }
          .desktop-sidebar nav:hover::-webkit-scrollbar-thumb { background:rgba(125,211,252,.44); }
          .desktop-sidebar nav button { position:relative; min-height:45px; margin:3px 0; padding:0 13px !important; border:1px solid transparent; border-radius:11px !important; color:#aebed0 !important; gap:12px !important; font-weight:650 !important; }
          .desktop-sidebar nav button svg { color:#7f96ae; }
          .desktop-sidebar nav button:hover { color:#fff !important; background:rgba(255,255,255,.065) !important; border-color:rgba(255,255,255,.06); transform:translateX(2px); }
          .desktop-sidebar nav button.active { color:#fff !important; background:linear-gradient(100deg,rgba(37,99,235,.92),rgba(8,145,178,.72)) !important; border-color:rgba(103,232,249,.28); box-shadow:0 10px 25px rgba(0,0,0,.22),inset 0 1px rgba(255,255,255,.18); }
          .desktop-sidebar nav button.active svg { color:#fff; }
          .desktop-sidebar nav button.active i { right:10px !important; width:5px !important; height:5px !important; border-radius:50% !important; background:#a5f3fc !important; box-shadow:0 0 12px #67e8f9; }
          .desktop-profile { position:static !important; inset:auto !important; flex:0 0 auto !important; width:100% !important; margin:0 !important; padding:12px !important; border:1px solid rgba(255,255,255,.1) !important; border-radius:14px !important; background:rgba(255,255,255,.06) !important; backdrop-filter:blur(12px); }
          .desktop-profile:hover { background:rgba(255,255,255,.1) !important; }
          .desktop-profile b { color:#fff !important; }.desktop-profile small{color:#90a7bf !important;}
          .desktop-stage { margin-left:0 !important; }
          .desktop-topbar { height:76px !important; padding:0 34px !important; background:rgba(250,252,255,.82) !important; backdrop-filter:blur(20px); border-bottom:1px solid rgba(203,213,225,.72) !important; box-shadow:0 8px 28px rgba(20,44,78,.045); }
          .desktop-topbar > div:first-child span { color:#8090a4 !important; letter-spacing:.08em; text-transform:uppercase; font-size:9px !important; font-weight:850; }
          .desktop-topbar > div:first-child b { color:#11243d !important; font-size:16px !important; }
          .top-search { width:330px !important; min-width:330px; height:44px !important; }
          .top-search input { font-size:13px !important; }
          .top-icon,.top-user { border:1px solid #dae3ee !important; background:#fff !important; box-shadow:0 5px 15px rgba(15,23,42,.04); }
          .premium-main { margin-left:0 !important; padding-top:76px !important; }
          .premium-page { padding:28px 34px 50px !important; }
        }
        @media (max-width: 900px) {
          html,body,#root { overflow-x:hidden; }
          body { background:#eef3f9; }
          .premium-main:before { inset:0; }
          .premium-main:before { position:absolute !important; filter:none !important; }
          .premium-page { transform:translateZ(0); }
          .executive-hero canvas { display:none !important; }
          .panel,.activity-card,.desktop-topbar,.premium-header { backdrop-filter:none !important; -webkit-backdrop-filter:none !important; }
          .metric,.panel,.activity-card { transition:box-shadow .18s ease,border-color .18s ease !important; }
          .metric:hover,.panel:hover,.activity-card:hover { transform:none !important; }
          .page-title { min-height:118px; padding:23px 20px !important; border-radius:19px !important; }
          .page-title:after { display:none; }
          .panel { border-radius:18px !important; padding:18px !important; }
          .table-wrap { border-radius:13px !important; }
        }
        @media (max-width: 640px) {
          .modal-bg { padding:10px !important; align-items:flex-start !important; }
          .modal,.modal.wide { width:calc(100vw - 20px) !important; max-width:none !important; max-height:calc(100dvh - 20px) !important; border-radius:18px !important; }
          .modal-head { min-height:54px; padding-bottom:14px !important; }
          .modal-head h2 { font-size:1.3rem !important; }
          .premium-header-main { padding-left:18px !important; padding-right:18px !important; gap:12px !important; }
          .premium-header .premium-header-actions { margin-left:auto !important; display:flex !important; align-items:center !important; gap:10px !important; flex:0 0 auto !important; }
          .premium-header .top-search { display:none !important; }
          .premium-header .top-icon { width:42px !important; height:42px !important; min-width:42px !important; flex:0 0 42px !important; border-radius:12px !important; }
          .premium-header .top-user { width:42px !important; height:42px !important; min-width:42px !important; padding:0 !important; display:grid !important; place-items:center !important; border-radius:50% !important; }
          .premium-header .top-user > div:last-child { display:none !important; }
          .premium-header .top-avatar { width:36px !important; height:36px !important; margin:0 !important; }
          .premium-brand { min-width:0 !important; flex:1 1 auto !important; }
          .premium-brand img { width:min(190px,100%) !important; height:auto !important; object-fit:contain !important; }
        }
        @media (prefers-reduced-motion: reduce) {
          html { scroll-behavior:auto; }
          *,*::before,*::after { animation-duration:.01ms !important; animation-iteration-count:1 !important; transition-duration:.01ms !important; }
        }
      `}</style>
      <style>{`
        /* Final visual system: warm ivory, forest and charcoal. Kept last so
           legacy component styles cannot reintroduce the old blue palette. */
        :root {
          --nx-ink:#202621;
          --nx-navy:#202621;
          --nx-blue:#315c46;
          --nx-cyan:#8da57d;
          --nx-line:#dddcd2;
          --nx-muted:#6f766d;
          --nx-surface:rgba(255,255,251,.94);
          --nx-shadow:0 18px 48px rgba(39,48,40,.08);
        }
        html,body,#root { max-width:100%; min-height:100%; overflow-x:hidden !important; }
        body { background:#f3f1e9 !important; color:#202621 !important; }
        .premium-shell { background:#f3f1e9 !important; }
        .premium-main:before {
          background:radial-gradient(circle at 85% 0,rgba(107,137,100,.14),transparent 28rem),linear-gradient(180deg,#faf9f4 0,#f3f1e9 44rem) !important;
        }
        .page-title {
          min-height:0 !important; padding:22px 26px !important; overflow:hidden !important;
          border:1px solid #dbddd3 !important; border-radius:20px !important;
          background:linear-gradient(135deg,#fffefa 0%,#f2f3e9 100%) !important;
          box-shadow:0 14px 38px rgba(44,54,45,.07) !important; color:#202621 !important;
        }
        .page-title:before,.page-title:after { display:none !important; content:none !important; }
        .page-title h1 { color:#202621 !important; font-size:clamp(1.55rem,2.5vw,2.1rem) !important; margin:0 0 5px !important; }
        .page-title p { color:#72796f !important; }
        .page-title > button,.page-title .btn { background:#315c46 !important; color:#fff !important; border-color:#315c46 !important; box-shadow:0 10px 22px rgba(49,92,70,.18) !important; }
        .panel,.activity-card { border-color:#dedfd6 !important; background:rgba(255,255,251,.95) !important; box-shadow:var(--nx-shadow) !important; }
        .panel:hover,.activity-card:hover { border-color:#c4cabd !important; box-shadow:0 20px 48px rgba(39,48,40,.11) !important; }
        .panel > h3 { color:#252c26 !important; border-bottom-color:#e7e6dd !important; }
        .panel > h3:before { background:#55745d !important; box-shadow:0 0 0 5px rgba(85,116,93,.11) !important; }
        .btn-primary { background:linear-gradient(135deg,#315c46,#55745d) !important; color:#fff !important; box-shadow:0 10px 24px rgba(49,92,70,.20) !important; }
        .btn-primary:hover { box-shadow:0 14px 28px rgba(49,92,70,.27) !important; }
        input:not([type="checkbox"]):not([type="radio"]),select,textarea { border-color:#d5d7ce !important; background:#fffefa !important; color:#252c26 !important; }
        input:focus,select:focus,textarea:focus,.top-search input:focus,.functional-search input:focus { border-color:#7f9984 !important; box-shadow:0 0 0 4px rgba(85,116,93,.12) !important; }
        .top-search input,.functional-search input { border-color:#d8d9d1 !important; background:#f7f6f0 !important; color:#252c26 !important; }
        .search-results button:hover { background:#eef1e8 !important; color:#315c46 !important; }
        .table-wrap { border-color:#dedfd6 !important; background:#fffefa !important; }
        thead th { background:#efefe8 !important; border-color:#dedfd6 !important; color:#626b61 !important; }
        tbody tr:hover { background:#f5f5ee !important; }
        tbody td b { color:#252c26 !important; }
        .filter-bar,.panel-toolbar { background:#f1f1ea !important; border-color:#dedfd6 !important; }
        .empty { border-color:#cfd3c8 !important; background:linear-gradient(145deg,#fffefa,#f2f3eb) !important; }
        .empty svg { color:#315c46 !important; background:#e7eee7 !important; }
        .day-hero,.brief-banner,.executive-hero { background:linear-gradient(135deg,#263a2d,#46644e) !important; border-color:#54705b !important; }
        .company-mark,.settings-avatar,.profile .avatar,.top-avatar { background:linear-gradient(135deg,#315c46,#78906f) !important; color:#fff !important; }
        .metric-icon.blue,.metric-icon.violet,.metric-icon.cyan,.metric-icon.green { background:#e8eee7 !important; color:#315c46 !important; }
        .log-icon.info,.log-icon.collaboration,.photo-button,.followup-summary svg { background:#e8eee7 !important; color:#315c46 !important; }
        .tabs button.active,.segmented button.active { background:#315c46 !important; color:#fff !important; border-color:#315c46 !important; }
        .modal-bg { background:rgba(27,34,28,.65) !important; }
        .modal-head h2 { color:#252c26 !important; }
        .premium-header,.desktop-topbar { background:rgba(250,249,244,.93) !important; border-color:#dedfd6 !important; }
        .top-icon,.top-user { border-color:#d8d9d1 !important; background:#fffefa !important; }

        @media (min-width:901px) {
          .desktop-sidebar { background:linear-gradient(180deg,#202822 0%,#29362d 55%,#1f2922 100%) !important; border-right-color:rgba(255,255,255,.08) !important; box-shadow:18px 0 55px rgba(32,40,34,.13) !important; }
          .desktop-workspace { background:rgba(255,255,255,.055) !important; border-color:rgba(255,255,255,.09) !important; }
          .desktop-workspace span { color:#b8cba8 !important; }
          .desktop-sidebar nav button { color:#c2c9c1 !important; }
          .desktop-sidebar nav button svg { color:#98aa99 !important; }
          .desktop-sidebar nav button:hover { color:#fff !important; background:rgba(255,255,255,.07) !important; }
          .desktop-sidebar nav button.active { color:#203027 !important; background:linear-gradient(110deg,#eef2e7,#cbd9c1) !important; border-color:#dfe9d7 !important; box-shadow:0 10px 24px rgba(0,0,0,.17) !important; }
          .desktop-sidebar nav button.active svg { color:#315c46 !important; }
          .desktop-sidebar nav button.active i { background:#315c46 !important; box-shadow:0 0 9px rgba(49,92,70,.35) !important; }
          .desktop-sidebar nav::-webkit-scrollbar-thumb { background:rgba(210,222,205,.28) !important; }
          .desktop-profile { background:rgba(255,255,255,.06) !important; }
          .desktop-profile small { color:#aebbad !important; }
          .desktop-topbar > div:first-child b { color:#252c26 !important; }
        }

        @media (max-width:900px) {
          html,body,#root { height:auto !important; min-height:100% !important; overflow-y:auto !important; overscroll-behavior-y:auto !important; }
          body { position:static !important; touch-action:pan-y !important; -webkit-overflow-scrolling:touch; }
          .premium-shell { height:auto !important; min-height:100dvh !important; overflow:visible !important; }
          .premium-main,.desktop-stage { height:auto !important; min-height:0 !important; overflow:visible !important; }
          .premium-page { width:100% !important; max-width:100% !important; min-width:0 !important; overflow:visible !important; }
          .premium-header { position:sticky !important; top:0; z-index:90; }
          .premium-header-main { height:72px !important; min-height:72px !important; padding:8px 12px !important; gap:9px !important; }
          .premium-brand { width:min(215px,calc(100vw - 112px)) !important; max-width:215px !important; height:54px !important; min-height:54px !important; padding:4px 7px !important; flex:1 1 auto !important; overflow:hidden !important; border-radius:12px !important; }
          .premium-brand img { display:block !important; width:100% !important; max-width:100% !important; height:100% !important; object-fit:contain !important; object-position:left center !important; }
          .premium-nav { height:auto !important; min-height:52px !important; }
          .premium-nav-inner { max-width:100vw !important; overflow-x:auto !important; overflow-y:hidden !important; overscroll-behavior-x:contain; -webkit-overflow-scrolling:touch; scrollbar-width:none; }
          .premium-nav-inner::-webkit-scrollbar { display:none; }
          .premium-nav button.active { color:#315c46 !important; border-color:#315c46 !important; }
          .page-title,.day-hero,.panel,.dashboard-v2,.dashboard-bento,.dashboard-chart-card,.dashboard-kpi-strip,.table-wrap { min-width:0 !important; max-width:100% !important; box-sizing:border-box !important; }
          .page-title { padding:18px !important; border-radius:17px !important; }
          .page-title > * { min-width:0 !important; overflow-wrap:anywhere; }
          .table-wrap { width:100% !important; overflow-x:auto !important; overflow-y:hidden !important; -webkit-overflow-scrolling:touch; }
          .dashboard-kpi-strip > *,.dashboard-bento > * { min-width:0 !important; }
          .panel,.day-hero { overflow-wrap:anywhere; }
        }
        @media (max-width:430px) {
          .premium-page { padding-left:12px !important; padding-right:12px !important; padding-bottom:84px !important; }
          .premium-brand { width:min(205px,calc(100vw - 108px)) !important; }
          .premium-header .top-icon,.premium-header .top-user { width:38px !important; height:38px !important; min-width:38px !important; flex-basis:38px !important; }
          .premium-header .top-avatar { width:33px !important; height:33px !important; }
          .page-title { display:block !important; }
          .page-title .btn,.page-title > button { width:100% !important; margin-top:14px !important; }
        }
      `}</style>
      <style>{`
        /* v15.4 — warm payroll-inspired product theme from the supplied reference. */
        :root{
          --nx-ink:#20211f;--nx-navy:#20211f;--nx-blue:#b88918;--nx-cyan:#f2c94c;
          --nx-line:#ddd5c5;--nx-muted:#746f65;--nx-surface:#fffdf7;
          --nx-shadow:0 14px 34px rgba(59,48,28,.075)
        }
        body,.premium-shell{background:#f4efe2!important;color:#20211f!important}
        .premium-main:before{background:radial-gradient(circle at 91% 0,rgba(246,205,91,.22),transparent 28rem),linear-gradient(180deg,#fbf8ef 0,#f4efe2 44rem)!important}
        .panel,.activity-card,.company-card,.requirement-card,.pipeline-card,.followup-card,.dashboard-chart-card{
          background:#fffdf7!important;border-color:#ded6c7!important;box-shadow:0 12px 32px rgba(59,48,28,.06)!important
        }
        .panel:hover,.activity-card:hover,.company-card:hover,.requirement-card:hover{border-color:#cdbf9f!important;box-shadow:0 18px 38px rgba(59,48,28,.09)!important}
        .panel>h3:before{background:#e0ad2f!important;box-shadow:0 0 0 5px rgba(224,173,47,.13)!important}
        .btn-primary,.page-title>button,.page-title>.btn{background:#20211f!important;border-color:#20211f!important;color:#fff!important;box-shadow:0 9px 22px rgba(32,33,31,.17)!important}
        .btn-primary:hover,.page-title>button:hover,.page-title>.btn:hover{background:#343630!important}
        .page-title{background:transparent!important;border:0!important;border-bottom:1px solid #ddd5c5!important;border-radius:0!important;box-shadow:none!important;color:#20211f!important}
        .page-title h1{color:#20211f!important}.page-title p{color:#777267!important}.page-title>div:before{color:#9a7929!important}
        .day-hero,.brief-banner,.executive-hero,.visit-timer-card.is-running{
          background:linear-gradient(130deg,#242520,#36382f 72%,#5b4d2a)!important;border-color:#4b493d!important;box-shadow:0 15px 38px rgba(35,35,29,.14)!important
        }
        .day-hero .eyebrow,.brief-banner span,.visit-timer-card.is-running .timer-copy>span{color:#f0cf72!important}
        .day-hero p,.brief-banner p,.visit-timer-card.is-running .timer-copy p{color:#ded8ca!important}
        .dashboard-kpi-strip{background:#ddd5c5!important;border-color:#ddd5c5!important}
        .dashboard-kpi{background:#fffdf7!important}.dashboard-kpi.featured{background:linear-gradient(145deg,#e8b83e,#f3cf64)!important;color:#20211f!important}
        .dashboard-kpi.featured .dashboard-kpi-top,.dashboard-kpi.featured>small{color:#5e4b1e!important}.dashboard-kpi.featured .dashboard-kpi-top i{background:rgba(255,255,255,.45)!important;color:#20211f!important}
        .kpi-spark i{background:#6b5a30!important}.dashboard-focus-card{background:linear-gradient(145deg,#22231f,#383a32)!important;border-color:#45463e!important}
        .focus-ring{background:conic-gradient(#f0c64f var(--progress),rgba(255,255,255,.1) 0)!important}.focus-ring:after{background:#292a25!important}
        .dashboard-mini-grid button{background:#fffdf7!important;border-color:#ded6c7!important}.dashboard-mini-grid button>i{background:#f8edcc!important;color:#7b5c13!important}
        .dashboard-welcome-actions>button{background:#20211f!important;box-shadow:0 8px 20px rgba(32,33,31,.15)!important}.dashboard-eyebrow{color:#8b6a1e!important}.dashboard-eyebrow i{background:#e0ad2f!important;box-shadow:0 0 0 5px rgba(224,173,47,.13)!important}
        .company-mark,.settings-avatar,.profile .avatar,.top-avatar{background:linear-gradient(135deg,#272923,#5b533d)!important;color:#fff!important}
        .metric-icon.blue,.metric-icon.violet,.metric-icon.cyan,.metric-icon.green,.metric-icon.amber,.metric-icon.orange{background:#f8edcc!important;color:#7b5c13!important}
        .badge{background:#fbf1d4!important;color:#715510!important;border-color:#ead7a4!important}
        .tabs,.tab-row,.requirement-tabs,.filter-bar,.panel-toolbar{background:#eee8dc!important;border-color:#ddd5c5!important}
        .tabs button.active,.tab-row button.active,.requirement-tabs button.active,.segmented button.active{background:#fffdf7!important;color:#6f5310!important;border-color:#d9c389!important;box-shadow:0 3px 12px rgba(69,52,16,.08)!important}
        input:not([type="checkbox"]):not([type="radio"]),select,textarea,.top-search input,.functional-search input{background:#fffdf8!important;border-color:#d9d1c1!important;color:#292a27!important}
        input:focus,select:focus,textarea:focus,.top-search input:focus,.functional-search input:focus{border-color:#d0a536!important;box-shadow:0 0 0 4px rgba(224,173,47,.14)!important}
        .search-results button:hover{background:#fbf2d8!important;color:#715510!important}
        .table-wrap{background:#fffdf7!important;border-color:#ddd5c5!important}thead th{background:#eee8dc!important;color:#6d675d!important;border-color:#ddd5c5!important}tbody tr:hover{background:#fbf6e8!important}
        .empty{background:linear-gradient(145deg,#fffdf7,#f5efe2)!important;border-color:#d8ceba!important}.empty svg,.photo-button,.followup-summary svg{background:#f8edcc!important;color:#7b5c13!important}
        .notice{background:#fbf3da!important;border-color:#e8d49c!important;color:#604b17!important}
        .premium-header,.desktop-topbar{background:rgba(250,247,238,.96)!important;border-color:#ded6c7!important}
        .top-icon,.top-user{background:#fffdf7!important;border-color:#d9d1c1!important;color:#292a27!important}
        .notification-button{position:relative!important;color:#242520!important;background:#f4df9e!important;border-color:#dfc36d!important;box-shadow:0 6px 16px rgba(87,68,19,.12)!important}
        .notification-button svg{display:block!important;stroke:#242520!important;stroke-width:2.2!important}
        .notification-button em{background:#b64235!important;color:#fff!important;border:2px solid #fffdf7!important}
        .search-results{background:#fffdf7!important;border-color:#ddd5c5!important}

        @media(min-width:901px){
          html,body,#root{height:100%!important;overflow:hidden!important}
          .premium-shell{height:100vh!important;min-height:0!important;overflow:hidden!important;padding-left:272px!important}
          .premium-main{height:100vh!important;min-height:0!important;overflow-y:auto!important;overflow-x:hidden!important;padding-top:76px!important;scrollbar-gutter:stable;-webkit-overflow-scrolling:touch;overscroll-behavior-y:contain}
          .premium-main::-webkit-scrollbar{width:10px}.premium-main::-webkit-scrollbar-track{background:#eee8dc}.premium-main::-webkit-scrollbar-thumb{background:#b9ac91;border:3px solid #eee8dc;border-radius:99px}
          .desktop-sidebar{background:linear-gradient(180deg,#20221f 0%,#292b25 60%,#1d1f1c 100%)!important;border-right-color:#383a33!important;box-shadow:14px 0 40px rgba(28,29,25,.14)!important}
          .desktop-workspace{background:#2e302a!important;border-color:#41433b!important}.desktop-workspace span{color:#e7c965!important}.desktop-workspace b{color:#fffdf7!important}
          .desktop-sidebar nav button{color:#c3c0b7!important;white-space:nowrap!important;overflow:hidden!important}.desktop-sidebar nav button span{overflow:hidden;text-overflow:ellipsis}
          .desktop-sidebar nav button svg{color:#aaa796!important;flex:0 0 auto}
          .desktop-sidebar nav button:hover{background:#33352f!important;color:#fff!important}
          .desktop-sidebar nav button.active{background:#f1c84e!important;color:#20211f!important;border-color:#f1c84e!important;box-shadow:0 10px 23px rgba(0,0,0,.2)!important}
          .desktop-sidebar nav button.active svg{color:#20211f!important}.desktop-sidebar nav button.active i{background:#20211f!important;box-shadow:none!important}
          .desktop-profile{background:#2e302a!important;border-color:#41433b!important}.desktop-profile small{color:#b8b4a8!important}
          .desktop-brand{overflow:hidden!important}.desktop-brand img{max-width:100%!important;max-height:100%!important;object-fit:contain!important}
          .desktop-topbar{left:272px!important}.desktop-stage{margin-left:0!important}
        }
        @media(max-width:900px){
          html,body,#root{height:auto!important;min-height:100%!important;overflow-x:hidden!important;overflow-y:auto!important}
          .premium-shell,.premium-main,.desktop-stage{height:auto!important;min-height:0!important;overflow:visible!important}
          .premium-header{background:#242620!important;border-color:#36382f!important}
          .premium-brand{background:#fff!important;border:1px solid #ded6c7!important;box-shadow:none!important}
          .premium-header .top-icon,.premium-header .top-user,.premium-header .notification-button{background:#f1c84e!important;border-color:#f1c84e!important;color:#20211f!important;opacity:1!important}
          .premium-header .notification-button svg{stroke:#20211f!important}
          .premium-nav{background:#242620!important;border-color:#36382f!important}
          .premium-nav-inner{display:flex!important;gap:7px!important;padding:8px 12px!important}
          .premium-nav button{flex:0 0 auto!important;max-width:none!important;white-space:nowrap!important;background:#30322c!important;border:1px solid #41433b!important;color:#d2cfc5!important;padding:0 13px!important}
          .premium-nav button span{display:block!important;white-space:nowrap!important}
          .premium-nav button.active{background:#f1c84e!important;color:#20211f!important;border-color:#f1c84e!important}
          .premium-page{overflow:visible!important}.premium-main{touch-action:pan-y!important}
        }
        @media(max-width:430px){
          .premium-header-main{height:68px!important;min-height:68px!important;padding:7px 10px!important}
          .premium-brand{width:min(202px,calc(100vw - 102px))!important;height:52px!important;min-height:52px!important;padding:4px 7px!important}
          .premium-brand img{width:100%!important;height:100%!important;max-width:100%!important;object-fit:contain!important;object-position:left center!important}
          .premium-header .top-icon,.premium-header .top-user{width:37px!important;height:37px!important;min-width:37px!important;flex:0 0 37px!important}
          .premium-page{padding:15px 12px 90px!important}.dashboard-welcome h1{font-size:2rem!important;overflow-wrap:anywhere}.page-title h1{overflow-wrap:anywhere}
          .dashboard-kpi-strip{grid-template-columns:1fr!important}.dashboard-kpi{min-height:112px!important}
          .dashboard-card-head{align-items:flex-start!important}.dashboard-card-head h2{overflow-wrap:anywhere}
        }

        /* Finishing pass: true-black navigation, precise logo geometry and restrained motion. */
        .premium-page{animation:workspace-enter .48s cubic-bezier(.2,.78,.2,1) both}
        .dashboard-kpi,.panel,.dashboard-chart-card,.dashboard-focus-card,.company-card,.activity-card,.requirement-card{animation:surface-enter .48s cubic-bezier(.2,.78,.2,1) both}
        .dashboard-kpi:nth-child(2),.panel:nth-child(2){animation-delay:.045s}.dashboard-kpi:nth-child(3),.panel:nth-child(3){animation-delay:.09s}.dashboard-kpi:nth-child(4){animation-delay:.135s}
        .desktop-brand,.premium-brand{animation:logo-enter .5s cubic-bezier(.2,.8,.2,1) both}
        @keyframes workspace-enter{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
        @keyframes surface-enter{from{opacity:0;transform:translateY(10px) scale(.992)}to{opacity:1;transform:none}}
        @keyframes logo-enter{from{opacity:0;transform:translateY(-5px)}to{opacity:1;transform:none}}

        @media(min-width:901px){
          .desktop-sidebar{
            background:radial-gradient(circle at 8% 0,rgba(242,200,78,.065),transparent 16rem),linear-gradient(180deg,#070807 0%,#0b0c0b 58%,#050605 100%)!important;
            border-right-color:#1d1e1b!important;box-shadow:16px 0 44px rgba(0,0,0,.19)!important
          }
          .desktop-workspace,.desktop-profile{background:#111210!important;border-color:#292a25!important}
          .desktop-sidebar nav button:hover{background:#171815!important}
          .desktop-brand{
            width:236px!important;height:70px!important;min-height:70px!important;margin:16px auto 14px!important;
            padding:6px 9px!important;border:1px solid #ded7ca!important;border-radius:12px!important;
            background:#fff!important;box-shadow:0 12px 28px rgba(0,0,0,.3)!important;overflow:hidden!important
          }
          .desktop-brand img{display:block!important;width:100%!important;height:100%!important;max-width:none!important;max-height:none!important;object-fit:contain!important;object-position:center!important}
          .desktop-sidebar nav button{transition:transform .2s ease,background .2s ease,color .2s ease!important}
          .desktop-sidebar nav button:hover{transform:translateX(3px)}
          .desktop-sidebar nav button.active{box-shadow:0 10px 28px rgba(242,200,78,.18)!important}
        }
        @media(max-width:900px){
          .premium-brand{
            width:min(230px,calc(100vw - 104px))!important;max-width:230px!important;height:60px!important;min-height:60px!important;
            padding:5px 8px!important;border-radius:10px!important;overflow:hidden!important;flex:1 1 auto!important
          }
          .premium-brand img{display:block!important;width:100%!important;height:100%!important;max-width:none!important;max-height:none!important;object-fit:contain!important;object-position:center!important}
          .premium-header-main{height:74px!important;min-height:74px!important;padding:7px 10px!important}
        }
        @media(max-width:390px){
          .premium-brand{width:min(218px,calc(100vw - 100px))!important;height:57px!important;min-height:57px!important}
          .premium-header-main{height:71px!important;min-height:71px!important}
        }
        @media(prefers-reduced-motion:reduce){.premium-page,.dashboard-kpi,.panel,.dashboard-chart-card,.dashboard-focus-card,.company-card,.activity-card,.requirement-card,.desktop-brand,.premium-brand{animation:none!important}}

        /* v16 — Fenly-inspired productivity system from the management reference. */
        :root,[data-accent="forest"]{--app-accent:#0d5b3b;--app-accent-soft:#e8f2ec;--app-accent-mid:#8fc0a7;--app-accent-dark:#073d29;--app-rgb:13,91,59}
        [data-accent="ocean"]{--app-accent:#315f9c;--app-accent-soft:#e9f0f9;--app-accent-mid:#91add2;--app-accent-dark:#203f69;--app-rgb:49,95,156}
        [data-accent="plum"]{--app-accent:#6b3a86;--app-accent-soft:#f1eaf5;--app-accent-mid:#b99bc9;--app-accent-dark:#48255c;--app-rgb:107,58,134}
        [data-accent="ember"]{--app-accent:#9b4b31;--app-accent-soft:#f7ece7;--app-accent-mid:#d5a18f;--app-accent-dark:#683120;--app-rgb:155,75,49}
        body,.premium-shell{background:#f5f7f4!important;color:#1c2420!important}
        .premium-main:before{background:linear-gradient(180deg,#f8faf7,#f3f6f3)!important}
        .premium-page{max-width:1500px!important;animation:fenly-page .42s cubic-bezier(.2,.8,.2,1) both!important}
        @keyframes fenly-page{from{opacity:0;transform:translateX(12px)}to{opacity:1;transform:none}}
        .page-title{min-height:82px!important;padding:7px 0 17px!important;border-bottom:1px solid #e3e8e3!important}
        .page-title>div:before{content:"WORKSPACE"!important;color:var(--app-accent)!important;font-size:8px!important}
        .page-title h1{font-size:clamp(1.65rem,2.2vw,2.15rem)!important;color:#17201b!important;letter-spacing:-.045em!important}.page-title p{color:#7b847e!important}
        .page-title>button,.page-title>.btn,.btn-primary{background:var(--app-accent)!important;border-color:var(--app-accent)!important;color:#fff!important;box-shadow:0 7px 18px rgba(var(--app-rgb),.16)!important}
        .page-title>button:hover,.page-title>.btn:hover,.btn-primary:hover{background:var(--app-accent-dark)!important}
        .panel,.activity-card,.company-card,.requirement-card,.pipeline-card,.followup-card,.dashboard-chart-card,.dashboard-focus-card{
          background:#fff!important;border:1px solid #e1e7e2!important;border-radius:13px!important;box-shadow:0 4px 18px rgba(26,48,35,.045)!important
        }
        .panel:hover,.activity-card:hover,.company-card:hover,.requirement-card:hover{border-color:#c8d5cc!important;box-shadow:0 10px 26px rgba(26,48,35,.075)!important}
        .panel>h3{color:#202923!important;border-bottom-color:#edf0ed!important}.panel>h3:before{background:var(--app-accent)!important;box-shadow:0 0 0 4px rgba(var(--app-rgb),.09)!important}
        .dashboard-welcome{min-height:92px!important}.dashboard-welcome h1{font-size:clamp(1.8rem,2.7vw,2.7rem)!important}.dashboard-eyebrow{color:var(--app-accent)!important}.dashboard-eyebrow i{background:var(--app-accent)!important;box-shadow:0 0 0 4px rgba(var(--app-rgb),.1)!important}
        .dashboard-welcome-actions>button{background:var(--app-accent)!important}.dashboard-kpi-strip{border-color:#e1e7e2!important;background:#e1e7e2!important;border-radius:13px!important;box-shadow:0 4px 18px rgba(26,48,35,.045)!important}
        .dashboard-kpi{background:#fff!important;min-height:124px!important}.dashboard-kpi.featured{background:linear-gradient(140deg,var(--app-accent-dark),var(--app-accent))!important;color:#fff!important}.dashboard-kpi.featured .dashboard-kpi-top,.dashboard-kpi.featured>small{color:#c8ded2!important}.dashboard-kpi.featured .dashboard-kpi-top i{background:rgba(255,255,255,.14)!important;color:#fff!important}.kpi-spark i{background:var(--app-accent-mid)!important}
        .dashboard-focus-card{background:linear-gradient(145deg,var(--app-accent-dark),var(--app-accent))!important}.focus-ring{background:conic-gradient(var(--app-accent-mid) var(--progress),rgba(255,255,255,.12) 0)!important}.focus-ring:after{background:var(--app-accent-dark)!important}
        .dashboard-mini-grid button{background:#fff!important;border-color:#e1e7e2!important}.dashboard-mini-grid button>i,.metric-icon.blue,.metric-icon.violet,.metric-icon.cyan,.metric-icon.green,.metric-icon.amber,.metric-icon.orange{background:var(--app-accent-soft)!important;color:var(--app-accent)!important}
        .day-hero,.brief-banner,.executive-hero,.visit-timer-card.is-running{background:linear-gradient(135deg,var(--app-accent-dark),var(--app-accent))!important;border-color:var(--app-accent)!important}
        .day-hero .eyebrow,.brief-banner span,.visit-timer-card.is-running .timer-copy>span{color:#b9dac9!important}
        input:not([type="checkbox"]):not([type="radio"]),select,textarea,.top-search input,.functional-search input{background:#fbfcfb!important;border-color:#dbe3dd!important;color:#202923!important}
        input:focus,select:focus,textarea:focus,.top-search input:focus,.functional-search input:focus{border-color:var(--app-accent)!important;box-shadow:0 0 0 3px rgba(var(--app-rgb),.11)!important}
        .tabs,.tab-row,.requirement-tabs,.filter-bar,.panel-toolbar{background:#f3f6f3!important;border-color:#e0e6e1!important}.tabs button.active,.tab-row button.active,.requirement-tabs button.active,.segmented button.active{background:#fff!important;color:var(--app-accent)!important;border-color:#d6e1d9!important}
        .badge{background:var(--app-accent-soft)!important;color:var(--app-accent)!important;border-color:rgba(var(--app-rgb),.15)!important}.company-mark,.settings-avatar,.profile .avatar,.top-avatar{background:var(--app-accent-soft)!important;color:var(--app-accent)!important}
        .table-wrap{background:#fff!important;border-color:#e1e7e2!important;border-radius:12px!important}thead th{background:#f4f7f4!important;color:#6d7871!important;border-color:#e4e9e5!important}tbody tr:hover{background:var(--app-accent-soft)!important}
        .notification-button{background:#fff!important;border-color:#dfe5e0!important;color:#354139!important;box-shadow:none!important}.notification-button svg{stroke:#354139!important}.notification-button em{background:var(--app-accent)!important}
        .photo-button,.empty svg,.followup-summary svg{background:var(--app-accent-soft)!important;color:var(--app-accent)!important}

        .appearance-settings{display:flex;align-items:center;justify-content:space-between;gap:24px}.appearance-settings>div:first-child{display:flex;flex-direction:column}.appearance-settings small{margin-top:5px;color:#828c85}.appearance-swatches{display:flex;gap:9px;flex-wrap:wrap}.appearance-swatches button{height:38px;display:flex;align-items:center;gap:7px;padding:0 10px;border:1px solid #dde4df;border-radius:9px;background:#fff;color:#505b54;font-size:11px}.appearance-swatches button i{width:18px;height:18px;border-radius:6px}.appearance-swatches .forest i{background:#0d5b3b}.appearance-swatches .ocean i{background:#315f9c}.appearance-swatches .plum i{background:#6b3a86}.appearance-swatches .ember i{background:#9b4b31}.appearance-swatches button.selected{border-color:var(--app-accent);box-shadow:0 0 0 2px rgba(var(--app-rgb),.1)}

        .calendar-shell{display:grid;grid-template-columns:minmax(0,1.7fr) minmax(280px,.68fr);gap:14px}.calendar-board,.calendar-agenda{background:#fff;border:1px solid #e1e7e2;border-radius:14px;box-shadow:0 5px 20px rgba(26,48,35,.05)}
        .calendar-board>header{display:flex;align-items:center;justify-content:space-between;padding:20px 22px;border-bottom:1px solid #edf0ed}.calendar-board>header span,.calendar-agenda>span{font-size:8px;font-weight:850;letter-spacing:.16em;color:var(--app-accent)}.calendar-board h2,.calendar-agenda h2{margin:5px 0 0;font-size:1.2rem;letter-spacing:-.03em}.calendar-controls{display:flex;gap:6px}.calendar-controls button{width:34px;height:34px;border:1px solid #e0e6e1;border-radius:8px;background:#fff;color:#465149}.calendar-controls button:hover{background:var(--app-accent-soft);color:var(--app-accent)}
        .calendar-weekdays,.calendar-grid{display:grid;grid-template-columns:repeat(7,minmax(0,1fr))}.calendar-weekdays{padding:0 14px;border-bottom:1px solid #edf0ed}.calendar-weekdays b{padding:11px 5px;color:#879089;font-size:9px;text-align:center}.calendar-grid{padding:10px 14px 14px;gap:5px}.calendar-grid>button{position:relative;min-height:82px;padding:8px;border:1px solid #edf0ed;border-radius:9px;background:#fff;text-align:left;color:#354139;transition:.18s}.calendar-grid>button:hover{border-color:#bfcfc4;transform:translateY(-1px)}.calendar-grid>button.outside{opacity:.36}.calendar-grid>button.selected{border-color:var(--app-accent);background:var(--app-accent-soft);box-shadow:0 0 0 2px rgba(var(--app-rgb),.08)}.calendar-grid>button.today>span{display:grid;place-items:center;width:23px;height:23px;border-radius:50%;background:var(--app-accent);color:#fff}.calendar-grid>button>span{font-size:10px;font-weight:750}.calendar-grid>button>div{display:flex;gap:3px;margin-top:17px}.calendar-grid i,.calendar-board footer i,.calendar-agenda article>i{display:block;width:7px;height:7px;border-radius:50%}.calendar-grid i.green,.calendar-board footer i.green,.calendar-agenda article>i.green{background:#3e9469}.calendar-grid i.amber,.calendar-board footer i.amber,.calendar-agenda article>i.amber{background:#d69c3c}.calendar-grid i.blue,.calendar-board footer i.blue,.calendar-agenda article>i.blue{background:#5a86bd}.calendar-grid small{display:block;margin-top:5px;color:#8a938d;font-size:7px}.calendar-board footer{display:flex;gap:17px;padding:0 21px 17px;color:#768078;font-size:9px}.calendar-board footer span{display:flex;align-items:center;gap:5px}
        .calendar-agenda{padding:22px}.calendar-agenda h2{padding-bottom:17px;border-bottom:1px solid #edf0ed}.agenda-list{display:grid;gap:9px;margin-top:14px}.calendar-agenda article{display:flex;gap:10px;padding:11px;border:1px solid #e6ebe7;border-radius:10px;background:#fbfcfb}.calendar-agenda article>i{flex:0 0 7px;margin-top:5px}.calendar-agenda article b{font-size:11px}.calendar-agenda article p{margin:3px 0;color:#737e76;font-size:9px}.calendar-agenda article small{color:#949c96;font-size:8px}.agenda-empty{min-height:250px;display:grid;place-items:center;align-content:center;text-align:center;color:#99a19b}.agenda-empty svg{color:var(--app-accent)}.agenda-empty b{margin-top:9px;color:#59635c}.agenda-empty p{max-width:180px;font-size:10px;line-height:1.5}

        @media(min-width:901px){
          html,body,#root{height:100%!important;overflow:hidden!important}.premium-shell{height:100vh!important;padding-left:232px!important;background:#f5f7f4!important}
          .desktop-sidebar{width:232px!important;padding:18px 13px 14px!important;background:#fff!important;border-right:1px solid #e3e8e4!important;box-shadow:none!important;color:#243028!important}
          .desktop-brand{width:202px!important;height:54px!important;min-height:54px!important;margin:0 auto 16px!important;padding:5px 8px!important;border:1px solid #e5e9e6!important;border-radius:10px!important;box-shadow:none!important}
          .desktop-workspace{margin:7px 3px 8px!important;padding:10px 11px!important;background:#f5f8f5!important;border-color:#e6ebe7!important;border-radius:10px!important}.desktop-workspace span{color:var(--app-accent)!important}.desktop-workspace b{color:#26322a!important;font-size:11px!important}
          .desktop-sidebar nav{padding:2px 3px 9px 0!important}.desktop-sidebar nav button{min-height:39px!important;margin:1px 0!important;padding:0 10px!important;border:0!important;border-radius:8px!important;color:#758078!important;font-size:10px!important;overflow:visible!important}.desktop-sidebar nav button svg{color:#8b968e!important;width:15px}.desktop-sidebar nav button:hover{background:#f3f6f3!important;color:#2b372f!important;transform:none}.desktop-sidebar nav button.active{background:var(--app-accent-soft)!important;color:var(--app-accent)!important;box-shadow:none!important;font-weight:760!important}.desktop-sidebar nav button.active:before{content:"";position:absolute;left:-4px;width:3px;height:22px;border-radius:3px;background:var(--app-accent)}.desktop-sidebar nav button.active svg{color:var(--app-accent)!important}.desktop-sidebar nav button.active i{display:none!important}
          .desktop-profile{padding:9px!important;background:#f6f8f6!important;border-color:#e2e7e3!important;color:#27332b!important}.desktop-profile b{color:#27332b!important}.desktop-profile small{color:#849087!important}.desktop-profile .top-avatar{background:var(--app-accent-soft)!important;color:var(--app-accent)!important}
          .desktop-topbar{left:232px!important;height:66px!important;padding:0 25px!important;background:rgba(255,255,255,.96)!important;border-bottom-color:#e5e9e6!important;box-shadow:none!important}.premium-main{height:100vh!important;padding-top:66px!important;overflow-y:auto!important;background:#f5f7f4!important}.premium-page{padding:23px 27px 48px!important}.desktop-topbar>div:first-child span{color:#97a099!important}.desktop-topbar>div:first-child b{color:#26322a!important}.top-search input{background:#f7f9f7!important}.top-icon,.top-user{background:#fff!important}
        }
        @media(max-width:1100px){.calendar-shell{grid-template-columns:1fr}.calendar-agenda{min-height:280px}}
        @media(max-width:900px){
          .premium-header{background:#fff!important;border-bottom-color:#e2e7e3!important}.premium-brand{border-color:#e4e9e5!important}.premium-header .top-icon,.premium-header .top-user,.premium-header .notification-button{background:#f5f8f5!important;border-color:#dfe5e0!important;color:#344038!important}.premium-header .notification-button svg{stroke:#344038!important}
          .premium-nav{background:#fff!important;border-color:#e2e7e3!important}.premium-nav button{background:#f5f7f5!important;border-color:#e1e7e2!important;color:#69756d!important}.premium-nav button.active{background:var(--app-accent-soft)!important;border-color:rgba(var(--app-rgb),.18)!important;color:var(--app-accent)!important}.appearance-settings{align-items:flex-start;flex-direction:column}
        }
        @media(max-width:640px){.calendar-grid{padding:7px;gap:3px}.calendar-weekdays{padding:0 7px}.calendar-grid>button{min-height:59px;padding:5px}.calendar-grid>button>div{margin-top:8px}.calendar-grid small{display:none}.calendar-board>header{padding:16px}.calendar-agenda{padding:17px}.appearance-swatches button span{display:none}}
      `}</style>
      <aside className="desktop-sidebar">
        <button className="desktop-brand" onClick={() => setPage("dashboard")}><img src="/assets/nexzibyte-logo.png" alt="NexziByte Solutions"/></button>
        <div className="desktop-workspace"><span>WORKSPACE</span><b>Field Sales CRM</b></div>
        <nav>
          {items.map(([id,label,Icon]) => <button key={id} className={page === id ? "active" : ""} onClick={() => setPage(id)}><Icon size={17}/><span>{label}</span>{page === id && <i/>}</button>)}
        </nav>
        <button className="desktop-profile" onClick={() => setPage("settings")}><div className="top-avatar">{user.profilePhotoUrl ? <img src={user.profilePhotoUrl} alt=""/> : user.name[0]}</div><span><b>{user.name}</b><small>{user.role.replaceAll("_", " ")}</small></span></button>
      </aside>
      <div className="desktop-stage">
        <div className="desktop-topbar">
          <div><span>NexziByte / Workspace</span><b>{items.find((x) => x[0] === page)?.[1] || "Profile Settings"}</b></div>
          <div className="premium-header-actions">
            <div className="top-search functional-search">
              <Search size={16}/>
              <input
                className="workspace-search-input"
                value={workspaceSearch}
                onFocus={() => setSearchOpen(true)}
                onChange={e => { setWorkspaceSearch(e.target.value); setSearchOpen(true); }}
                onKeyDown={e => {
                  const first = searchResults[0];
                  if (e.key === "Enter" && first) { setPage(first[0]); setSearchOpen(false); setWorkspaceSearch(""); }
                  if (e.key === "Escape") { setSearchOpen(false); setWorkspaceSearch(""); }
                }}
                placeholder="Search workspace"
                aria-label="Search workspace pages"
              />
              {searchOpen && workspaceSearch.trim() && (
                <div className="search-results">
                  {searchResults.map(([id,label,Icon]:any) => (
                    <button key={id} onClick={() => { setPage(id); setSearchOpen(false); setWorkspaceSearch(""); }}><Icon size={16}/><span>{label}</span><small>Open</small></button>
                  ))}
                  {!searchResults.length && <p>No matching page or module</p>}
                </div>
              )}
            </div>
            <button className="top-icon notification-button" onClick={() => setPage("notifications")}><Bell size={18}/>{unreadNotifications.length > 0 && <em>{Math.min(unreadNotifications.length, 99)}</em>}</button>
            <button className="top-user" onClick={() => setPage("settings")}><div className="top-avatar">{user.profilePhotoUrl ? <img src={user.profilePhotoUrl} alt=""/> : user.name[0]}</div><div><b>{user.name}</b><span>{user.role.replaceAll("_", " ")}</span></div></button>
          </div>
        </div>
      </div>
      <header className="premium-header">
        <div className="premium-header-main">
          <button className="premium-brand" onClick={() => setPage("dashboard")}>
            <img src="/assets/nexzibyte-logo.png" alt="NexziByte Solutions" />
          </button>
          <div className="premium-header-actions">
            <div className="top-search functional-search">
              <Search size={16}/><input className="workspace-search-input" value={workspaceSearch} onFocus={() => setSearchOpen(true)} onChange={e => { setWorkspaceSearch(e.target.value); setSearchOpen(true); }} onKeyDown={e => { const first = searchResults[0]; if (e.key === "Enter" && first) openSearchResult(first[0]); if (e.key === "Escape") { setSearchOpen(false); setWorkspaceSearch(""); } }} placeholder="Search pages and modules" />
              <kbd>Ctrl K</kbd>
              {searchOpen && workspaceSearch.trim() && <div className="search-results">{searchResults.map(([id,label,Icon]:any) => <button key={id} onClick={() => openSearchResult(id)}><Icon size={16}/><span>{label}</span><small>Open</small></button>)}{!searchResults.length && <p>No matching page or module</p>}</div>}
            </div>
            <button className="top-icon notification-button" onClick={() => setPage("notifications")} title="Notifications"><Bell size={18}/>{unreadNotifications.length > 0 && <em>{Math.min(unreadNotifications.length, 99)}</em>}</button>
            <button className="top-user" onClick={() => setPage("settings")}>
              <div className="top-avatar">{user.profilePhotoUrl ? <img src={user.profilePhotoUrl} alt=""/> : user.name[0]}</div>
              <div><b>{user.name}</b><span>{user.role.replaceAll("_", " ")}</span></div>
            </button>
          </div>
        </div>
        <nav className={`premium-nav ${open ? "is-open" : ""}`}>
          <div className="premium-nav-inner">
            {items.map(([id, label, Icon]) => (
              <button key={id} onClick={() => { setPage(id); setOpen(false); }} className={page === id ? "active" : ""}>
                <Icon size={15}/><span>{label}</span>
              </button>
            ))}
          </div>
        </nav>
      </header>
      <main className="premium-main">
        <div className="premium-page page-container">{pages[page]}</div>
      </main>
    </div>
  );
}

function Settings({ user, updateUser, logout, accent, setAccent }: any) {
  const [profile, setProfile] = useState({ name: user.name || "", phone: user.phone || "", profilePhotoUrl: user.profilePhotoUrl || null });
  const [password, setPassword] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [profileMessage, setProfileMessage] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");
  const [error, setError] = useState("");
  const choosePhoto = (e: any) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) return setError("Select a valid image file");
    if (file.size > 2 * 1024 * 1024) return setError("Profile picture must be under 2MB");
    const reader = new FileReader();
    reader.onload = () => { setProfile({ ...profile, profilePhotoUrl: String(reader.result) }); setError(""); };
    reader.readAsDataURL(file);
  };
  const saveProfile = async () => {
    try {
      setError(""); setProfileMessage("");
      const result = await api("/me/profile", { method: "PATCH", body: JSON.stringify(profile) });
      updateUser(result.user); setProfileMessage(result.message);
    } catch (e: any) { setError(e.message); }
  };
  const changePassword = async () => {
    try {
      setError(""); setPasswordMessage("");
      if (password.newPassword !== password.confirmPassword) throw Error("New password and confirmation do not match");
      const result = await api("/me/password", { method: "PATCH", body: JSON.stringify({ currentPassword: password.currentPassword, newPassword: password.newPassword }) });
      setPasswordMessage(result.message);
      setTimeout(() => void logout(), 1200);
    } catch (e: any) { setError(e.message); }
  };
  return (
    <div className="space-y-5">
      <PageTitle title="Settings" sub="Manage your profile, password and session." />
      <Panel title="Appearance">
        <div className="appearance-settings">
          <div><b>Accent colour</b><small>One accent re-tints navigation, actions, charts and highlights.</small></div>
          <div className="appearance-swatches">
            {[["forest","Forest"],["ocean","Ocean"],["plum","Plum"],["ember","Ember"]].map(([value,label]) => (
              <button key={value} className={`${value} ${accent === value ? "selected" : ""}`} onClick={() => setAccent(value)}><i/><span>{label}</span>{accent === value && <Check size={15}/>}</button>
            ))}
          </div>
        </div>
      </Panel>
      <div className="settings-grid">
        <Panel title="Profile settings">
          <div className="settings-photo">
            <div className="settings-avatar">{profile.profilePhotoUrl ? <img src={profile.profilePhotoUrl} alt="Profile preview" /> : profile.name?.[0]}</div>
            <label className="btn photo-button"><Camera size={17} />Upload profile picture<input type="file" accept="image/jpeg,image/png,image/webp" onChange={choosePhoto} hidden /></label>
            {profile.profilePhotoUrl && <button className="mini danger" onClick={() => setProfile({ ...profile, profilePhotoUrl: null })}>Remove picture</button>}
          </div>
          <Field n="name" l="Display name" f={profile} c={(e: any) => setProfile({ ...profile, name: e.target.value })} />
          <Field n="phone" l="Phone number" f={profile} c={(e: any) => setProfile({ ...profile, phone: e.target.value })} />
          {profileMessage && <Notice>{profileMessage}</Notice>}
          <button className="btn btn-primary w-full" onClick={saveProfile}>Save profile</button>
        </Panel>
        <Panel title="Security and session">
          <label>Current password<input type="password" className={input} value={password.currentPassword} onChange={(e) => setPassword({ ...password, currentPassword: e.target.value })} /></label>
          <label>New password<input type="password" className={input} value={password.newPassword} onChange={(e) => setPassword({ ...password, newPassword: e.target.value })} /></label>
          <label>Confirm new password<input type="password" className={input} value={password.confirmPassword} onChange={(e) => setPassword({ ...password, confirmPassword: e.target.value })} /></label>
          {passwordMessage && <Notice>{passwordMessage}</Notice>}
          {error && <Notice danger>{error}</Notice>}
          <button className="btn btn-primary w-full" onClick={changePassword}>Change password</button>
          <button className="btn logout-settings w-full" onClick={logout}><LogOut size={17} />Log out of CRM</button>
        </Panel>
      </div>
    </div>
  );
}

function Dashboard({ user, onNavigate, accent }: any) {
  const { data = {} } = useQuery({
    queryKey: ["summary"],
    queryFn: () => api("/dashboard/summary"),
    refetchInterval: 5000,
    refetchIntervalInBackground: true,
  });
  const { data: assignments = [] } = useQuery({
    queryKey: ["assignments", "dashboard-analysis"],
    queryFn: () => api("/assignments"),
    refetchInterval: 10000,
    refetchIntervalInBackground: true,
  });
  const palettes: Record<string, { primary: string; grid: string; cursor: string; series: string[] }> = {
    forest: { primary: "#0d5b3b", grid: "#e4ebe6", cursor: "rgba(13,91,59,.07)", series: ["#0d5b3b", "#4b8f70", "#8bbca4", "#d5e7dd"] },
    ocean: { primary: "#315f9c", grid: "#e3e9f2", cursor: "rgba(49,95,156,.07)", series: ["#315f9c", "#5f84b5", "#91acce", "#d5e0ef"] },
    plum: { primary: "#77507f", grid: "#ebe5ed", cursor: "rgba(119,80,127,.07)", series: ["#77507f", "#9872a0", "#b99cbe", "#e4d8e6"] },
    ember: { primary: "#a45136", grid: "#f0e5e0", cursor: "rgba(164,81,54,.07)", series: ["#a45136", "#c17459", "#dba18c", "#f0d8cf"] },
  };
  const palette = palettes[accent] || palettes.forest;
  const assignmentLabels: Record<string, string> = { ASSIGNED: "Assigned", IN_PROGRESS: "In progress", COMPLETED: "Completed", CANCELLED: "Cancelled" };
  const assignmentAnalysis = Object.keys(assignmentLabels)
    .map((status) => ({ name: assignmentLabels[status], value: assignments.filter((item: any) => item.status === status).length }))
    .filter((item) => item.value > 0);
  const assignmentPie = assignmentAnalysis.length ? assignmentAnalysis : [{ name: "No assignments", value: 1, empty: true }];
  const title = roleName[user.role];
  const cards = [
    ["Visits today", data.visits || 0, MapPin, "blue"],
    ["Assignments", data.assignments || 0, BriefcaseBusiness, "violet"],
    ["Active visits", data.activeVisits || 0, Activity, "green"],
    ["Companies", data.companies || 0, Building2, "orange"],
    ["Requirements", data.requirements || 0, Check, "cyan"],
    ["Hot leads", data.hot || 0, BarChart3, "red"],
    ...(user.role === "ADMIN"
      ? [["Pending approvals", data.pendingRegistrations || 0, Users, "amber"]]
      : []),
  ];
  const chart = cards
    .slice(0, 6)
    .map((x) => ({ name: String(x[0]).split(" ")[0], value: Number(x[1]) }));
  const health = Math.min(100, 68 + Number(data.visits || 0) * 3);
  const today = new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" });
  return (
    <div className="dashboard-v2 space-y-5">
      <BlurFade delay={0.04} inView>
        <header className="dashboard-welcome">
          <div>
            <span className="dashboard-eyebrow"><i/> LIVE WORKSPACE</span>
            <h1>Good morning, {user.name.split(" ")[0]}.</h1>
            <p>{user.role === "SALES_BD_EXECUTIVE" ? "Here is your field plan and client progress for today." : "Here is the operating pulse across sales, visits and opportunities."}</p>
          </div>
          <div className="dashboard-welcome-actions">
            <span><CalendarDays size={15}/>{today}</span>
            <button onClick={() => onNavigate(user.role === "SALES_BD_EXECUTIVE" ? "myday" : "assignments")}>
              {user.role === "SALES_BD_EXECUTIVE" ? "Open my day" : "Manage work"}<b>↗</b>
            </button>
          </div>
        </header>
      </BlurFade>

      {user.role === "SALES_BD_EXECUTIVE" && <SalesVisitTimer onNavigate={onNavigate} />}

      <BlurFade delay={0.09} inView>
        <section className="dashboard-kpi-strip">
          {cards.slice(0, 4).map(([t, v, I]: any, index: number) => (
            <article className={`dashboard-kpi ${index === 0 ? "featured" : ""}`} key={t}>
              <div className="dashboard-kpi-top"><span>{t}</span><i><I size={17}/></i></div>
              <strong><NumberTicker value={Number(v)} /></strong>
              <small>{index === 0 ? "Recorded today" : "Live operational total"}</small>
              {index === 0 && <div className="kpi-spark" aria-hidden="true"><i/><i/><i/><i/><i/><i/><i/></div>}
            </article>
          ))}
        </section>
      </BlurFade>

      <div className="dashboard-bento">
        <BlurFade delay={0.14} inView>
          <section className="dashboard-chart-card">
            <div className="dashboard-card-head">
              <div><span>WEEKLY SIGNAL</span><h2>Business activity</h2></div>
              <button onClick={() => onNavigate("reports")}>View reports <b>↗</b></button>
            </div>
            <div className="dashboard-chart">
              <ResponsiveContainer>
                <BarChart data={chart} barGap={7}>
                  <CartesianGrid stroke={palette.grid} vertical={false} strokeDasharray="3 5" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: "#7a8177", fontSize: 11 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: "#9aa097", fontSize: 10 }} />
                  <Tooltip cursor={{ fill: palette.cursor }} contentStyle={{ borderRadius: 12, border: `1px solid ${palette.grid}`, boxShadow: "0 12px 30px rgba(23,31,25,.1)" }} />
                  <Bar dataKey="value" fill={palette.primary} radius={[9, 9, 3, 3]} animationDuration={1100} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
        </BlurFade>

        <BlurFade delay={0.18} inView>
          <aside className="dashboard-focus-card">
            <div className="dashboard-card-head light"><div><span>WORKSPACE HEALTH</span><h2>Focus today</h2></div><Activity size={19}/></div>
            <div className="focus-ring" style={{ "--progress": `${health * 3.6}deg` } as React.CSSProperties}>
              <div><strong><NumberTicker value={health} />%</strong><span>Operational readiness</span></div>
            </div>
            <div className="focus-row"><span><i className="green"/>Active visits</span><b>{data.activeVisits || 0}</b></div>
            <div className="focus-row"><span><i className="amber"/>Priority leads</span><b>{data.hot || 0}</b></div>
            <div className="focus-row"><span><i className="blue"/>Requirements</span><b>{data.requirements || 0}</b></div>
            <button onClick={() => onNavigate("requirements")}>Review requirements <b>→</b></button>
          </aside>
        </BlurFade>
      </div>

      <BlurFade delay={0.2} inView>
        <section className="dashboard-assignment-card">
          <div className="dashboard-card-head">
            <div><span>WORK DISTRIBUTION</span><h2>Assignment analysis</h2></div>
            <button onClick={() => onNavigate("assignments")}>View assignments <b>↗</b></button>
          </div>
          <div className="assignment-analysis-body">
            <div className="assignment-donut">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Tooltip contentStyle={{ borderRadius: 12, border: `1px solid ${palette.grid}`, boxShadow: "0 12px 30px rgba(23,31,25,.1)" }} />
                  <Pie data={assignmentPie} dataKey="value" nameKey="name" innerRadius={55} outerRadius={82} paddingAngle={assignmentAnalysis.length > 1 ? 3 : 0} stroke="#fff" strokeWidth={3} animationDuration={950}>
                    {assignmentPie.map((item: any, index: number) => <Cell key={item.name} fill={item.empty ? "#e6e9e5" : palette.series[index % palette.series.length]} />)}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="assignment-donut-total"><strong>{assignments.length}</strong><span>Total work</span></div>
            </div>
            <div className="assignment-legend">
              {assignmentAnalysis.length ? assignmentAnalysis.map((item, index) => (
                <div key={item.name}><i style={{ background: palette.series[index % palette.series.length] }}/><span>{item.name}</span><strong>{item.value}</strong></div>
              )) : <div className="assignment-empty"><span>No assignment data yet</span><strong>0</strong></div>}
            </div>
          </div>
        </section>
      </BlurFade>

      <BlurFade delay={0.21} inView>
        <section className="dashboard-mini-grid">
          {cards.slice(4).map(([t, v, I]: any) => <button key={t} onClick={() => onNavigate(t === "Requirements" ? "requirements" : t === "Pending approvals" ? "users" : "pipeline")}><i><I size={17}/></i><span>{t}<small>Updated automatically</small></span><strong><NumberTicker value={Number(v)} /></strong><b>↗</b></button>)}
        </section>
      </BlurFade>

      {user.role === "ADMIN" && <AdminLiveActivity />}
      <div className="grid xl:grid-cols-[1.35fr_.65fr] gap-5">
        <Panel title="Operational safeguards">
          <ul className="check-list compact-checks">
            <li><Check/>Secure authenticated access</li>
            <li><Check/>Verified GPS visit timeline</li>
            <li><Check/>Mandatory visit-proof checkout</li>
          </ul>
        </Panel>
        <Panel title="Access level"><div className="dashboard-role"><ShieldCheck size={22}/><div><b>{title}</b><span>{user.role === "ADMIN" ? "Full operational control" : "Role-scoped workspace access"}</span></div></div></Panel>
      </div>
    </div>
  );
}

function elapsedLabel(start: string | Date, end?: string | Date | null) {
  const seconds = Math.max(0, Math.floor((new Date(end || Date.now()).getTime() - new Date(start).getTime()) / 1000));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remaining = seconds % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(remaining).padStart(2, "0")}`;
}

function LiveDuration({ start, end, compact = false }: any) {
  const [, tick] = useState(0);
  useEffect(() => {
    if (end) return;
    const timer = window.setInterval(() => tick((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [end]);
  return <span className={compact ? "live-duration compact" : "live-duration"}>{elapsedLabel(start, end)}</span>;
}

function SalesVisitTimer({ onNavigate }: any) {
  const { data: visits = [] } = useQuery({ queryKey: ["visits"], queryFn: () => api("/visits"), refetchInterval: 30000 });
  const active = visits.find((visit: any) => visit.status === "OPEN" && visit.isMine);
  return (
    <BlurFade delay={0.07} inView>
      <section className={`visit-timer-card ${active ? "is-running" : ""}`}>
        <div className="timer-copy">
          <span><i/>{active ? "VISIT IN PROGRESS" : "FIELD TIMER"}</span>
          <h2>{active ? active.company.name : "No active visit"}</h2>
          <p>{active ? `Checked in ${new Date(active.checkInAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "The timer starts automatically when you check in."}</p>
        </div>
        <div className="timer-display"><small>ELAPSED TIME</small><strong>{active ? <LiveDuration start={active.checkInAt}/> : "00:00:00"}</strong><span>{active ? "Live and visible to Admin" : "Waiting for check-in"}</span></div>
        <button onClick={() => onNavigate("myday")}>{active ? "Open active visit" : "Open my day"}<b>→</b></button>
      </section>
    </BlurFade>
  );
}

function AdminLiveActivity() {
  const { data: rows = [] } = useQuery({
    queryKey: ["admin-live-activity"],
    queryFn: () => api("/team/activity"),
    refetchInterval: 60000,
  });
  return (
    <Panel title="Today's executive check-in monitor">
      <div className="table-wrap compact-monitor">
        <table>
          <thead>
            <tr>
              <th>Salesperson</th>
              <th>Employee ID</th>
              <th>Check in</th>
              <th>Status</th>
              <th>Duration</th>
              <th>Check out</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 8).map((v: any) => (
              <tr key={v.id}>
                <td>
                  <b>{v.user.name}</b>
                  <small>{v.company.name}</small>
                </td>
                <td>{v.user.id.slice(0, 8).toUpperCase()}</td>
                <td>
                  {new Date(v.checkInAt).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </td>
                <td>
                  <span className="inline-status">
                    <i className={v.status === "OPEN" ? "on" : ""} />
                    {v.status === "OPEN"
                      ? (
                          v.hourlyActivities[0]?.status || "CHECKED IN"
                        ).replaceAll("_", " ")
                      : "COMPLETED"}
                  </span>
                </td>
                <td><LiveDuration start={v.checkInAt} end={v.checkOutAt} compact /></td>
                <td>
                  {v.checkOutAt
                    ? new Date(v.checkOutAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && <Empty text="No executive check-ins today" />}
      </div>
    </Panel>
  );
}

function MyDay({ user }: any) {
  const qc = useQueryClient();
  const { data: assignments = [] } = useQuery({
    queryKey: ["assignments"],
    queryFn: () => api("/assignments"),
  });
  const { data: visits = [] } = useQuery({
    queryKey: ["visits"],
    queryFn: () => api("/visits"),
  });
  const active = visits.find((v: any) => v.status === "OPEN" && v.isMine);
  const [start, setStart] = useState(false);
  const [checkout, setCheckout] = useState(false);
  return (
    <div className="space-y-6">
      <PageTitle
        title="My Day"
        sub="Start assigned visits, post hourly progress and complete verified checkout."
      />
      <div className="day-hero">
        <div>
          <div className="eyebrow text-cyan-300">TODAY'S FIELD PLAN</div>
          <h2>
            {active
              ? `Active at ${active.company.name}`
              : "Ready for your next company visit?"}
          </h2>
          <p>
            {active
              ? "Update your activity at least once every hour."
              : "Choose an assignment and check in using your current GPS location."}
          </p>
        </div>
        {active ? (
          <div className="day-active-controls">
            <div className="day-inline-timer"><small>VISIT DURATION</small><strong><LiveDuration start={active.checkInAt}/></strong><span>Visible to Admin</span></div>
            <button className="btn bg-white text-indigo-800" onClick={() => setCheckout(true)}>Complete & check out</button>
          </div>
        ) : (
          <button
            disabled={!assignments.some((a: any) => a.status === "ASSIGNED")}
            className="btn bg-white text-indigo-800 disabled:opacity-50"
            onClick={() => setStart(true)}
          >
            <MapPin size={18} /> Start visit
          </button>
        )}
      </div>
      {active && (
        <ActivityUpdate
          visit={active}
          done={() => qc.invalidateQueries({ queryKey: ["visits"] })}
        />
      )}
      <Panel title="Assigned work">
        <AssignmentTable rows={assignments} />
      </Panel>
      {start && (
        <StartVisit assignments={assignments} close={() => setStart(false)} />
      )}{" "}
      {checkout && active && (
        <Checkout visit={active} close={() => setCheckout(false)} />
      )}
    </div>
  );
}

function AdminCalendar() {
  const { data: assignments = [] } = useQuery({ queryKey:["assignments"], queryFn:() => api("/assignments") });
  const { data: followups = [] } = useQuery({ queryKey:["followups"], queryFn:() => api("/followups") });
  const { data: visits = [] } = useQuery({ queryKey:["visits"], queryFn:() => api("/visits") });
  const [cursor,setCursor] = useState(() => new Date(new Date().getFullYear(),new Date().getMonth(),1));
  const [selected,setSelected] = useState(() => new Date());
  const keyOf = (value:any) => { const d = new Date(value); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; };
  const events = [
    ...assignments.filter((x:any) => x.scheduledAt).map((x:any) => ({ id:`a-${x.id}`,at:x.scheduledAt,type:"Assignment",title:x.company?.name || "Assigned company",meta:x.assignee?.name || x.user?.name || "Sales assignment",tone:"green" })),
    ...followups.filter((x:any) => x.scheduledAt).map((x:any) => ({ id:`f-${x.id}`,at:x.scheduledAt,type:"Follow-up",title:x.company?.name || "Client follow-up",meta:x.purpose || x.type?.replaceAll("_"," ") || "Scheduled follow-up",tone:"amber" })),
    ...visits.filter((x:any) => x.checkInAt).map((x:any) => ({ id:`v-${x.id}`,at:x.checkInAt,type:"Visit",title:x.company?.name || "Company visit",meta:`${x.user?.name || "Sales member"} · ${x.status === "OPEN" ? "In progress" : "Completed"}`,tone:"blue" })),
  ];
  const first = new Date(cursor.getFullYear(),cursor.getMonth(),1);
  const start = new Date(first); start.setDate(1-first.getDay());
  const days = Array.from({length:42},(_,i) => { const d=new Date(start); d.setDate(start.getDate()+i); return d; });
  const selectedEvents = events.filter((event:any) => keyOf(event.at) === keyOf(selected)).sort((a:any,b:any) => +new Date(a.at)-+new Date(b.at));
  const monthLabel = cursor.toLocaleDateString("en-IN",{month:"long",year:"numeric"});
  const moveMonth = (amount:number) => setCursor(new Date(cursor.getFullYear(),cursor.getMonth()+amount,1));
  return (
    <div className="space-y-5 calendar-page">
      <PageTitle title="Calendar" sub="Review assignments, visits and follow-ups for every day." action={<button className="btn" onClick={() => { const now=new Date();setCursor(new Date(now.getFullYear(),now.getMonth(),1));setSelected(now); }}>Today</button>} />
      <div className="calendar-shell">
        <section className="calendar-board">
          <header><div><span>TEAM SCHEDULE</span><h2>{monthLabel}</h2></div><div className="calendar-controls"><button onClick={() => moveMonth(-1)}>←</button><button onClick={() => moveMonth(1)}>→</button></div></header>
          <div className="calendar-weekdays">{["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(day => <b key={day}>{day}</b>)}</div>
          <div className="calendar-grid">{days.map(day => {
            const dayEvents=events.filter((event:any) => keyOf(event.at)===keyOf(day));
            const outside=day.getMonth()!==cursor.getMonth(); const active=keyOf(day)===keyOf(selected); const today=keyOf(day)===keyOf(new Date());
            return <button key={keyOf(day)} className={`${outside?"outside":""} ${active?"selected":""} ${today?"today":""}`} onClick={() => setSelected(day)}><span>{day.getDate()}</span><div>{dayEvents.slice(0,3).map((event:any) => <i key={event.id} className={event.tone} title={event.title}/>)}</div>{dayEvents.length>0&&<small>{dayEvents.length} event{dayEvents.length>1?"s":""}</small>}</button>;
          })}</div>
          <footer><span><i className="green"/>Assignments</span><span><i className="amber"/>Follow-ups</span><span><i className="blue"/>Visits</span></footer>
        </section>
        <aside className="calendar-agenda">
          <span>SELECTED DAY</span><h2>{selected.toLocaleDateString("en-IN",{weekday:"long",day:"numeric",month:"long"})}</h2>
          <div className="agenda-list">{selectedEvents.map((event:any) => <article key={event.id}><i className={event.tone}/><div><b>{event.title}</b><p>{event.meta}</p><small>{new Date(event.at).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})} · {event.type}</small></div></article>)}{!selectedEvents.length&&<div className="agenda-empty"><CalendarDays size={28}/><b>No activity</b><p>Nothing is scheduled or recorded for this day.</p></div>}</div>
        </aside>
      </div>
    </div>
  );
}

function ActivityUpdate({ visit, done }: any) {
  const [state, setState] = useState("MEETING_IN_PROGRESS"),
    [note, setNote] = useState(""),
    [msg, setMsg] = useState("");
  const save = async () => {
    try {
      const loc = await getLocation();
      await api(`/visits/${visit.id}/activity`, {
        method: "POST",
        body: JSON.stringify({ status: state, note, ...loc }),
      });
      setMsg("Hourly activity updated");
      setNote("");
      done();
    } catch (e: any) {
      setMsg(e.message);
    }
  };
  return (
    <Panel title="Hourly activity check">
      <div className="grid md:grid-cols-[1fr_2fr_auto] gap-3">
        <select
          className={input}
          value={state}
          onChange={(e) => setState(e.target.value)}
        >
          {[
            "TRAVELLING",
            "REACHED_COMPANY",
            "WAITING_FOR_CONTACT",
            "MEETING_IN_PROGRESS",
            "REQUIREMENT_DISCUSSION",
            "FOLLOW_UP_DISCUSSION",
            "BREAK",
          ].map((x) => (
            <option key={x}>{x}</option>
          ))}
        </select>
        <input
          className={input}
          placeholder="What are you doing now?"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <button className="btn btn-primary" onClick={save}>
          Update now
        </button>
      </div>
      {msg && <p className="text-sm text-indigo-700 mt-3">{msg}</p>}
    </Panel>
  );
}
function StartVisit({ assignments, close }: any) {
  const qc = useQueryClient();
  const valid = assignments.filter((a: any) =>
    ["ASSIGNED", "IN_PROGRESS"].includes(a.status),
  );
  const [a, setA] = useState(valid[0]?.id || ""),
    [purpose, setPurpose] = useState("Company meeting"),
    [error, setError] = useState("");
  const save = async () => {
    try {
      const item = valid.find((x: any) => x.id === a);
      const loc = await getLocation();
      await api("/visits", {
        method: "POST",
        body: JSON.stringify({
          assignmentId: item.id,
          companyId: item.companyId,
          contactId: item.company.contacts?.[0]?.id,
          visitPurpose: purpose,
          ...loc,
        }),
      });
      qc.invalidateQueries();
      close();
    } catch (e: any) {
      setError(e.message);
    }
  };
  return (
    <Modal title="Verified visit check-in" close={close}>
      <label>Assigned company</label>
      <select
        className={input}
        value={a}
        onChange={(e) => setA(e.target.value)}
      >
        {valid.map((x: any) => (
          <option value={x.id} key={x.id}>
            {x.company.name} — {x.title}
          </option>
        ))}
      </select>
      <label>Visit purpose</label>
      <input
        className={input}
        value={purpose}
        onChange={(e) => setPurpose(e.target.value)}
      />
      {error && <Notice danger>{error}</Notice>}
      <button className="btn btn-primary w-full" onClick={save}>
        Capture GPS & start visit
      </button>
    </Modal>
  );
}
function Checkout({ visit, close }: any) {
  const qc = useQueryClient();
  const { data: master } = useQuery({
    queryKey: ["master"],
    queryFn: () => api("/master-data"),
  });
  const [form, setForm] = useState<any>({
      projectRequired: "NO",
      contactName: "",
      contactDesignation: "",
      contactPhone: "",
      contactEmail: "",
      industryId: "",
      companyPhone: "",
      companyEmail: "",
      companyAddress: "",
      projectType: "",
      requirementDescription: "",
      timeline: "",
      decisionMakerStatus: "YES",
      budgetDiscussed: "false",
      budgetMin: "",
      budgetMax: "",
      leadQuality: "WARM",
      nextFollowUpAt: "",
      followUpType: "CALL",
      followUpPurpose: "",
      noRequirementReason: "",
      revisitAfter: "30_DAYS",
      collaborationType: "",
      collaborationDetails: "",
      remarks: "",
    }),
    [photos, setPhotos] = useState<string[]>([]),
    [error, setError] = useState("");
  const change = (e: any) =>
    setForm({ ...form, [e.target.name]: e.target.value });
  const file = async (e: any) => {
    const selected = Array.from(e.target.files || []) as File[];
    if (!selected.length) return;
    if (photos.length + selected.length > 6) return setError("You can upload a maximum of 6 proof pictures");
    if (selected.some((f) => !f.type.startsWith("image/"))) return setError("Only image files are supported");
    if (selected.some((f) => f.size > 5 * 1024 * 1024)) return setError("Each proof picture must be under 5MB");
    const read = (f: File) => new Promise<string>((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(String(r.result)); r.onerror = reject; r.readAsDataURL(f); });
    try { setPhotos([...photos, ...(await Promise.all(selected.map(read)))]); setError(""); }
    catch { setError("One or more pictures could not be read"); }
  };
  const save = async () => {
    try {
      if (!photos.length) throw Error("Upload at least one mandatory company proof picture");
      for (const photo of photos) await api(`/visits/${visit.id}/photo`, { method: "POST", body: JSON.stringify({ fileUrl: photo, photoType: "COMPANY" }) });
      const loc = await getLocation();
      await api(`/visits/${visit.id}/checkout`, {
        method: "PATCH",
        body: JSON.stringify({
          ...loc,
          projectRequired: form.projectRequired,
          remarks: form.remarks,
          ...(["YES", "MAYBE", "COLLABORATION"].includes(form.projectRequired)
            ? {
                nextFollowUpAt: new Date(form.nextFollowUpAt).toISOString(),
                followUpType: form.followUpType,
                followUpPurpose: form.followUpPurpose,
              }
            : {}),
          ...(form.projectRequired === "NO"
            ? {
                noRequirementReason: form.noRequirementReason,
                revisitAfter: form.revisitAfter,
              }
            : {}),
          ...(form.projectRequired === "YES"
            ? {
                contact: {
                  name: form.contactName,
                  designation: form.contactDesignation,
                  phone: form.contactPhone,
                  email: form.contactEmail,
                },
                industryId: form.industryId,
                companyPhone: form.companyPhone,
                companyEmail: form.companyEmail,
                companyAddress: form.companyAddress,
                projectType: form.projectType,
                requirementDescription: form.requirementDescription,
                timeline: form.timeline,
                decisionMakerStatus: form.decisionMakerStatus,
                budgetDiscussed: form.budgetDiscussed === "true",
                budgetMin: form.budgetMin ? Number(form.budgetMin) : undefined,
                budgetMax: form.budgetMax ? Number(form.budgetMax) : undefined,
                leadQuality: form.leadQuality,
              }
            : {}),
          ...(form.projectRequired === "MAYBE"
            ? {
                ...(form.contactName && form.contactDesignation
                  ? { contact: { name: form.contactName, designation: form.contactDesignation, phone: form.contactPhone, email: form.contactEmail } }
                  : {}),
                projectType: form.projectType || undefined,
                requirementDescription: form.requirementDescription || undefined,
                timeline: form.timeline || undefined,
                leadQuality: form.leadQuality || "WARM",
              }
            : {}),
          ...(form.projectRequired === "COLLABORATION"
            ? {
                contact: {
                  name: form.contactName,
                  designation: form.contactDesignation,
                  phone: form.contactPhone,
                  email: form.contactEmail,
                },
                collaborationType: form.collaborationType,
                collaborationDetails: form.collaborationDetails,
              }
            : {}),
        }),
      });
      qc.invalidateQueries();
      close();
    } catch (e: any) {
      setError(e.message);
    }
  };
  return (
    <Modal title="Complete visit & check out" close={close} wide>
      <label>Company visit proof pictures * (maximum 6)</label>
      <input
        type="file"
        accept="image/*"
        multiple
        className={input}
        onChange={file}
      />
      <div className="proof-upload-grid">
        {photos.map((photo, index) => <div className="proof-upload-item" key={`${photo.slice(-20)}-${index}`}><img src={photo} className="proof-preview" /><button type="button" onClick={() => setPhotos(photos.filter((_, i) => i !== index))}><X size={15} /></button></div>)}
      </div>
      <label>Visit outcome *</label>
      <select
        name="projectRequired"
        className={input}
        value={form.projectRequired}
        onChange={change}
      >
        <option>YES</option>
        <option>NO</option>
        <option>MAYBE</option>
        <option value="COLLABORATION">COLLABORATION</option>
      </select>
      {form.projectRequired === "YES" && (
        <div className="form-grid">
          <Field
            n="contactName"
            l="Connected person name *"
            f={form}
            c={change}
          />
          <Field n="contactDesignation" l="Designation *" f={form} c={change} />
          <Field n="contactPhone" l="Contact phone *" f={form} c={change} />
          <Field n="contactEmail" l="Contact email *" f={form} c={change} />
          <label>
            Industry *
            <select
              name="industryId"
              className={input}
              value={form.industryId}
              onChange={change}
            >
              <option value="">Select</option>
              {master?.industries.map((x: any) => (
                <option value={x.id} key={x.id}>
                  {x.name}
                </option>
              ))}
            </select>
          </label>
          <Field n="companyPhone" l="Company phone *" f={form} c={change} />
          <Field n="companyEmail" l="Company email *" f={form} c={change} />
          <Field
            n="companyAddress"
            l="Company address / location *"
            f={form}
            c={change}
          />
          <label>
            Project type *
            <select
              name="projectType"
              className={input}
              value={form.projectType}
              onChange={change}
            >
              <option value="">Select</option>
              {master?.projectTypes.map((x: any) => (
                <option key={x.id}>{x.name}</option>
              ))}
            </select>
          </label>
          <Field n="timeline" l="Expected timeline *" f={form} c={change} />
          <label>
            Decision maker status *
            <select
              name="decisionMakerStatus"
              className={input}
              value={form.decisionMakerStatus}
              onChange={change}
            >
              <option>YES</option>
              <option>PARTIAL</option>
              <option>NO</option>
            </select>
          </label>
          <label>
            Budget discussed? *
            <select
              name="budgetDiscussed"
              className={input}
              value={form.budgetDiscussed}
              onChange={change}
            >
              <option value="true">Yes</option>
              <option value="false">No</option>
            </select>
          </label>
          <Field n="budgetMin" l="Minimum budget" f={form} c={change} />
          <Field n="budgetMax" l="Maximum budget" f={form} c={change} />
          <label>
            Lead priority *
            <select
              name="leadQuality"
              className={input}
              value={form.leadQuality}
              onChange={change}
            >
              <option value="HOT">Hot</option>
              <option value="WARM">Warm</option>
              <option value="COLD">Cold</option>
              <option value="NOT_QUALIFIED">Not qualified</option>
              <option value="NEGATIVE">Negative</option>
            </select>
          </label>
          <label className="md:col-span-2">
            Requirement details *
            <textarea
              name="requirementDescription"
              className={input}
              value={form.requirementDescription}
              onChange={change}
            />
          </label>
        </div>
      )}
      {form.projectRequired === "NO" && (
        <div className="form-grid">
          <Field
            n="noRequirementReason"
            l="Reason for no requirement *"
            f={form}
            c={change}
          />
          <label>
            Revisit plan *
            <select
              name="revisitAfter"
              className={input}
              value={form.revisitAfter}
              onChange={change}
            >
              <option value="30_DAYS">30 days</option>
              <option value="90_DAYS">90 days</option>
              <option value="180_DAYS">180 days</option>
              <option value="NEVER">Never</option>
              <option value="PARTNERSHIP">Partnership</option>
              <option value="STAFFING">Staffing</option>
            </select>
          </label>
        </div>
      )}
      {form.projectRequired === "MAYBE" && (
        <div className="maybe-box">
          <div className="collaboration-heading"><Repeat2 size={20} /><div><b>Possible future requirement</b><span>Capture what is known now and schedule the mandatory next discussion within 7 days.</span></div></div>
          <div className="form-grid">
            <Field n="contactName" l="Connected person name" f={form} c={change} />
            <Field n="contactDesignation" l="Designation" f={form} c={change} />
            <Field n="contactPhone" l="Contact phone" f={form} c={change} />
            <Field n="contactEmail" l="Contact email" f={form} c={change} />
            <label>Project type<select name="projectType" className={input} value={form.projectType} onChange={change}><option value="">Not confirmed</option>{master?.projectTypes.map((x: any) => <option key={x.id}>{x.name}</option>)}</select></label>
            <Field n="timeline" l="Tentative timeline" f={form} c={change} />
            <label>Lead priority<select name="leadQuality" className={input} value={form.leadQuality} onChange={change}><option value="HOT">Hot</option><option value="WARM">Warm</option><option value="COLD">Cold</option><option value="NOT_QUALIFIED">Not qualified</option></select></label>
            <label className="md:col-span-2">Tentative requirement<textarea name="requirementDescription" className={input} value={form.requirementDescription} onChange={change} /></label>
          </div>
        </div>
      )}
      {form.projectRequired === "COLLABORATION" && (
        <div className="collaboration-box">
          <div className="collaboration-heading"><Handshake size={20} /><div><b>Collaboration opportunity</b><span>Capture partnership details separately from project requirements.</span></div></div>
          <div className="form-grid">
            <Field n="contactName" l="Connected person name *" f={form} c={change} />
            <Field n="contactDesignation" l="Designation *" f={form} c={change} />
            <Field n="contactPhone" l="Contact phone *" f={form} c={change} />
            <Field n="contactEmail" l="Contact email" f={form} c={change} />
            <Field n="collaborationType" l="Collaboration type *" f={form} c={change} />
            <label className="md:col-span-2">Collaboration details *<textarea name="collaborationDetails" className={input} value={form.collaborationDetails} onChange={change} placeholder="Partnership scope, staffing, referral, technology alliance or other details" /></label>
          </div>
        </div>
      )}
      {["YES", "MAYBE", "COLLABORATION"].includes(form.projectRequired) && (
        <div className="form-grid">
          <label>
            Next follow-up *
            <input
              type="datetime-local"
              name="nextFollowUpAt"
              className={input}
              value={form.nextFollowUpAt}
              onChange={change}
            />
          </label>
          <label>
            Follow-up type *
            <select
              name="followUpType"
              className={input}
              value={form.followUpType}
              onChange={change}
            >
              {[
                "CALL",
                "EMAIL",
                "WHATSAPP",
                "F2F",
                "TEAMS",
                "ZOOM",
                "DEMO",
                "QUOTATION_FOLLOWUP",
                "PAYMENT_FOLLOWUP",
              ].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </label>
          <label className="md:col-span-2">
            Follow-up purpose *
            <textarea
              name="followUpPurpose"
              className={input}
              value={form.followUpPurpose}
              onChange={change}
            />
          </label>
        </div>
      )}
      <label>Remarks</label>
      <textarea
        name="remarks"
        className={input}
        value={form.remarks}
        onChange={change}
      />
      {error && <Notice danger>{error}</Notice>}
      <button className="btn btn-primary w-full" onClick={save}>
        Verify GPS & check out
      </button>
    </Modal>
  );
}

function Assignments({ user }: any) {
  const qc = useQueryClient();
  const elevated = ["ADMIN", "SALES_HEAD", "BD_MANAGER"].includes(user.role);
  const { data: rows = [] } = useQuery({
    queryKey: ["assignments"],
    queryFn: () => api("/assignments"),
  });
  const { data: companies = [] } = useQuery({
    queryKey: ["companies"],
    queryFn: () => api("/companies"),
  });
  const { data: master } = useQuery({
    queryKey: ["master"],
    queryFn: () => api("/master-data"),
  });
  const [show, setShow] = useState(false),
    [f, setF] = useState<any>({
      companyId: "",
      assignedToId: "",
      title: "Company visit",
      description: "",
      scheduledAt: "",
    }),
    [err, setErr] = useState("");
  const save = async () => {
    try {
      await api("/assignments", { method: "POST", body: JSON.stringify(f) });
      qc.invalidateQueries({ queryKey: ["assignments"] });
      setShow(false);
    } catch (e: any) {
      setErr(e.message);
    }
  };
  return (
    <div className="space-y-5">
      <PageTitle
        title="Work Assignments"
        sub="Allocate company visits and track execution status."
        action={
          elevated ? (
            <button className="btn btn-primary" onClick={() => setShow(true)}>
              <Plus />
              Assign work
            </button>
          ) : null
        }
      />
      <Panel>
        <AssignmentTable rows={rows} />
      </Panel>
      {show && (
        <Modal title="Assign company work" close={() => setShow(false)}>
          <label>Company</label>
          <select
            className={input}
            value={f.companyId}
            onChange={(e) => setF({ ...f, companyId: e.target.value })}
          >
            <option value="">Select</option>
            {companies.map((x: any) => (
              <option value={x.id}>{x.name}</option>
            ))}
          </select>
          <label>Sales team member</label>
          <select
            className={input}
            value={f.assignedToId}
            onChange={(e) => setF({ ...f, assignedToId: e.target.value })}
          >
            <option value="">Select</option>
            {master?.salesUsers.map((x: any) => (
              <option value={x.id}>
                {x.name} — {x.role}
              </option>
            ))}
          </select>
          <Field
            n="title"
            l="Work title"
            f={f}
            c={(e: any) => setF({ ...f, [e.target.name]: e.target.value })}
          />
          <Field
            n="description"
            l="Instructions"
            f={f}
            c={(e: any) => setF({ ...f, [e.target.name]: e.target.value })}
          />
          <label>Scheduled date & time</label>
          <input
            type="datetime-local"
            className={input}
            value={f.scheduledAt}
            onChange={(e) => setF({ ...f, scheduledAt: e.target.value })}
          />
          {err && <Notice danger>{err}</Notice>}
          <button className="btn btn-primary w-full" onClick={save}>
            Create assignment
          </button>
        </Modal>
      )}
    </div>
  );
}
function AssignmentTable({ rows }: any) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Company</th>
            <th>Work</th>
            <th>Assigned to</th>
            <th>Schedule</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((x: any) => (
            <tr key={x.id}>
              <td>
                <b>{x.company.name}</b>
                <small>{x.company.city}</small>
              </td>
              <td>{x.title}</td>
              <td>{x.assignedTo?.name}</td>
              <td>{new Date(x.scheduledAt).toLocaleString()}</td>
              <td>
                <Badge>{x.status}</Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!rows.length && <Empty text="No work assignments found" />}
    </div>
  );
}

function FollowUps({ user }: any) {
  const qc = useQueryClient();
  const { data: rows = [] } = useQuery({
    queryKey: ["followups"],
    queryFn: () => api("/followups"),
  });
  const { data: companies = [] } = useQuery({
    queryKey: ["companies"],
    queryFn: () => api("/companies"),
  });
  const { data: master } = useQuery({
    queryKey: ["master"],
    queryFn: () => api("/master-data"),
  });
  const [showCreate, setShowCreate] = useState(false),
    [complete, setComplete] = useState<any>(null),
    [booking, setBooking] = useState<any>(null),
    [error, setError] = useState("");
  const [f, setF] = useState<any>({
    companyId: "",
    assignedToId: "",
    type: "CALL",
    scheduledAt: "",
    purpose: "",
    instructions: "",
    aiCallEnabled: false,
    aiCallConsent: false,
    aiCallOffsetMinutes: 60,
  });
  const [done, setDone] = useState({ outcome: "", handoverNotes: "", requestQuotation: false });
  const [bookingForm, setBookingForm] = useState({ slots: ["", "", ""], message: "Please choose the time that is most convenient for you." });
  const change = (e: any) => setF({ ...f, [e.target.name]: e.target.type === "checkbox" ? e.target.checked : e.target.name === "aiCallOffsetMinutes" ? Number(e.target.value) : e.target.value });
  const create = async () => {
    try {
      setError("");
      await api("/followups", { method: "POST", body: JSON.stringify(f) });
      await qc.invalidateQueries({ queryKey: ["followups"] });
      setShowCreate(false);
      setF({ ...f, purpose: "", instructions: "", scheduledAt: "" });
    } catch (e: any) {
      setError(e.message);
    }
  };
  const finish = async () => {
    try {
      setError("");
      await api(`/followups/${complete.id}/complete`, {
        method: "PATCH",
        body: JSON.stringify({ ...done, close: !done.requestQuotation }),
      });
      await qc.invalidateQueries({ queryKey: ["followups"] });
      setComplete(null);
      setDone({ outcome: "", handoverNotes: "", requestQuotation: false });
    } catch (e: any) {
      setError(e.message);
    }
  };
  const respond = async (id: string, action: "ACCEPT" | "DECLINE") => {
    try {
      const reason = action === "DECLINE" ? window.prompt("Reason for declining this follow-up:") || "" : undefined;
      if (action === "DECLINE" && (reason || "").length < 5) return;
      await api(`/followups/${id}/respond`, { method: "PATCH", body: JSON.stringify({ action, reason }) });
      await qc.invalidateQueries({ queryKey: ["followups"] });
    } catch (e: any) { setError(e.message); }
  };
  const requestBooking = async () => {
    try {
      setError("");
      const slots = bookingForm.slots.filter(Boolean).map(x => new Date(x).toISOString());
      await api(`/followups/${booking.id}/request-booking`, { method: "POST", body: JSON.stringify({ slots, message: bookingForm.message }) });
      await qc.invalidateQueries({ queryKey: ["followups"] });
      setBooking(null);
      setBookingForm({ slots: ["", "", ""], message: "Please choose the time that is most convenient for you." });
    } catch (e: any) { setError(e.message); }
  };
  return (
    <div className="space-y-5">
      <PageTitle
        title="Follow-Up System"
        sub="Delegate client actions, record the result and automatically return completed work to its owner."
        action={
          <button
            className="btn btn-primary"
            onClick={() => {
              setError("");
              setShowCreate(true);
            }}
          >
            <Plus />
            New follow-up
          </button>
        }
      />
      <div className="followup-summary">
        <div>
          <ClipboardList />
          <span>Open follow-ups</span>
          <b>{rows.filter((x: any) => x.status !== "COMPLETED").length}</b>
        </div>
        <div>
          <Repeat2 />
          <span>Completed & returned</span>
          <b>{rows.filter((x: any) => x.status === "COMPLETED").length}</b>
        </div>
      </div>
      <Panel>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Company / purpose</th>
                <th>Owner</th>
                <th>Assigned / delegated to</th>
                <th>Schedule</th>
                <th>Status</th>
                <th>Result / instructions</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((x: any) => (
                <tr key={x.id}>
                  <td>
                    <b>{x.company.name}</b>
                    <small>
                      {x.type.replaceAll("_", " ")} · {x.purpose}
                    </small>
                  </td>
                  <td>{x.originalOwner?.name}</td>
                  <td>
                    {x.delegatedTo?.name || x.user?.name}
                    <small>
                      {x.delegatedTo ? "Delegated task" : "Owner task"}
                    </small>
                  </td>
                  <td>{new Date(x.scheduledAt).toLocaleString()}</td>
                  <td>
                    <Badge>{x.status}</Badge>
                    {x.aiCallEnabled && <small className="ai-call-label"><PhoneCall size={12}/> AI reminder enabled</small>}
                    {x.returnedAt && (
                      <small>
                        Returned {new Date(x.returnedAt).toLocaleString()}
                      </small>
                    )}
                  </td>
                  <td>
                    {x.status === "COMPLETED" ? (
                      <>
                        <b>{x.outcome}</b>
                        <small>Notes: {x.handoverNotes}</small>
                      </>
                    ) : (
                      <>
                        <span>{x.handoverNotes}</span>
                        <small>Instructions from {x.originalOwner?.name}</small>
                      </>
                    )}
                  </td>
                  <td>
                    <div className="followup-actions">
                      {x.canAccept && <><button className="mini success" onClick={() => respond(x.id, "ACCEPT")}>Accept</button><button className="mini danger" onClick={() => respond(x.id, "DECLINE")}>Decline</button></>}
                      {x.canRequestBooking && <button className="mini" onClick={() => { setError(""); setBooking(x); }}>Request client time</button>}
                      {x.canComplete && <button className="mini success" onClick={() => { setError(""); setComplete(x); }}>Complete & return</button>}
                      {!x.canAccept && !x.canRequestBooking && !x.canComplete && <span className="text-slate-400">—</span>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!rows.length && <Empty text="No follow-up tasks found" />}
        </div>
      </Panel>
      {showCreate && (
        <Modal
          title="Create or delegate follow-up"
          close={() => setShowCreate(false)}
        >
          <label>Company *</label>
          <select
            name="companyId"
            className={input}
            value={f.companyId}
            onChange={change}
          >
            <option value="">Select company</option>
            {companies.map((x: any) => (
              <option value={x.id} key={x.id}>
                {x.name}
              </option>
            ))}
          </select>
          <label>Assign to *</label>
          <select
            name="assignedToId"
            className={input}
            value={f.assignedToId}
            onChange={change}
          >
            <option value="">Select salesperson</option>
            {master?.salesUsers.map((x: any) => (
              <option value={x.id} key={x.id}>
                {x.name} — {x.role.replaceAll("_", " ")}
              </option>
            ))}
          </select>
          <label>Follow-up type *</label>
          <select
            name="type"
            className={input}
            value={f.type}
            onChange={change}
          >
            {[
              "CALL",
              "EMAIL",
              "WHATSAPP",
              "F2F",
              "TEAMS",
              "ZOOM",
              "DEMO",
              "QUOTATION_FOLLOWUP",
              "PAYMENT_FOLLOWUP",
            ].map((x) => (
              <option key={x}>{x.replaceAll("_", " ")}</option>
            ))}
          </select>
          <label>Scheduled date & time *</label>
          <input
            name="scheduledAt"
            type="datetime-local"
            className={input}
            value={f.scheduledAt}
            onChange={change}
          />
          <Field n="purpose" l="Purpose *" f={f} c={change} />
          <label>
            Instructions for assigned salesperson *
            <textarea
              name="instructions"
              className={input}
              value={f.instructions}
              onChange={change}
            />
          </label>
          <div className="ai-call-options">
            <label className="check-row"><input type="checkbox" name="aiCallEnabled" checked={f.aiCallEnabled} onChange={change}/><span><b>Schedule automated client reminder call</b><small>The call uses the meeting details and follow-up purpose.</small></span></label>
            {f.aiCallEnabled && <>
              <label>Call before meeting<select name="aiCallOffsetMinutes" className={input} value={f.aiCallOffsetMinutes} onChange={change}><option value={30}>30 minutes before</option><option value={60}>1 hour before</option><option value={180}>3 hours before</option><option value={1440}>1 day before</option></select></label>
              <label className="check-row consent"><input type="checkbox" name="aiCallConsent" checked={f.aiCallConsent} onChange={change}/><span><b>Client consent confirmed</b><small>Required before an automated call can be scheduled.</small></span></label>
            </>}
          </div>
          {error && <Notice danger>{error}</Notice>}
          <button className="btn btn-primary w-full" onClick={create}>
            Assign follow-up
          </button>
        </Modal>
      )}
      {complete && (
        <Modal
          title="Complete follow-up & return to owner"
          close={() => setComplete(null)}
        >
          <div className="notice">
            This task will return to <b>{complete.originalOwner?.name}</b> after
            completion.
          </div>
          <label>Outcome *</label>
          <textarea
            className={input}
            value={done.outcome}
            onChange={(e) => setDone({ ...done, outcome: e.target.value })}
          />
          <label>Instructions / completion notes for owner *</label>
          <textarea
            className={input}
            value={done.handoverNotes}
            onChange={(e) =>
              setDone({ ...done, handoverNotes: e.target.value })
            }
          />
          <label className="check-row quotation-check"><input type="checkbox" checked={done.requestQuotation} onChange={e => setDone({ ...done, requestQuotation: e.target.checked })}/><span><b>Request quotation preparation</b><small>Move the opportunity to quotation stage and notify administrators.</small></span></label>
          {error && <Notice danger>{error}</Notice>}
          <button className="btn btn-primary w-full" onClick={finish}>
            Complete & return task
          </button>
        </Modal>
      )}
      {booking && <Modal title={`Let ${booking.contact?.name || "the client"} choose a time`} close={() => setBooking(null)}>
        <div className="notice">Offer at least two future slots. A secure booking link will be emailed to the company contact. Confirmation will automatically notify the assigned salesperson, original owner and administrators.</div>
        {bookingForm.slots.map((slot, index) => <label key={index}>Available slot {index + 1}<input type="datetime-local" className={input} value={slot} onChange={e => { const slots = [...bookingForm.slots]; slots[index] = e.target.value; setBookingForm({ ...bookingForm, slots }); }}/></label>)}
        <label>Message to client<textarea className={input} value={bookingForm.message} onChange={e => setBookingForm({ ...bookingForm, message: e.target.value })}/></label>
        {error && <Notice danger>{error}</Notice>}
        <button className="btn btn-primary w-full" onClick={requestBooking}>Email secure booking link</button>
      </Modal>}
    </div>
  );
}

function AiCalls() {
  const { data: rows = [] } = useQuery({ queryKey: ["ai-calls"], queryFn: () => api("/ai-calls"), refetchInterval: 30000 });
  return <div className="space-y-5">
    <PageTitle title="AI Reminder Call Center" sub="Consent-controlled automated reminders for scheduled client meetings and follow-ups." />
    <div className="call-summary"><div><PhoneCall/><span>Scheduled calls</span><b>{rows.filter((x:any) => x.status === "QUEUED").length}</b></div><div><Check/><span>Completed</span><b>{rows.filter((x:any) => x.status === "COMPLETED").length}</b></div><div><Activity/><span>In progress</span><b>{rows.filter((x:any) => x.status === "INITIATED").length}</b></div></div>
    <Panel title="Call delivery log"><div className="table-wrap"><table><thead><tr><th>Company / contact</th><th>Call number</th><th>Meeting details</th><th>Reminder time</th><th>Status</th><th>Delivery details</th></tr></thead><tbody>{rows.map((x:any) => <tr key={x.id}><td><b>{x.company.name}</b><small>{x.contact?.name || "Company contact"}</small></td><td>{x.toPhone}</td><td>{x.followUp.type.replaceAll("_"," ")}<small>{x.followUp.purpose}</small></td><td>{new Date(x.scheduledFor).toLocaleString()}</td><td><Badge>{x.status}</Badge></td><td>{x.providerCallId || "Waiting for provider"}<small>{x.lastError}</small></td></tr>)}</tbody></table>{!rows.length && <Empty text="No automated reminder calls scheduled"/>}</div></Panel>
    <div className="notice">Automated calls are placed only when client consent is recorded and telephony credentials are enabled by an administrator.</div>
  </div>;
}

function ProjectRequirements() {
  const { data: visits = [] } = useQuery({ queryKey: ["visits", "requirements"], queryFn: () => api("/visits") });
  const [selected, setSelected] = useState<any>(null);
  const [search, setSearch] = useState("");
  const rows = visits.filter((v:any) => v.projectRequired === "YES" && `${v.company.name} ${v.adminDetails?.requirement?.projectType || ""} ${v.user.name}`.toLowerCase().includes(search.toLowerCase()));
  return <div className="space-y-5 requirements-page">
    <PageTitle title="Project Requirements" sub="All qualified company requirements in one place—open any record for the complete commercial brief." />
    <div className="requirements-toolbar"><div className="search-box"><Search size={17}/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search company, project or salesperson"/></div><div className="requirement-total"><ClipboardList size={18}/><span>Qualified requirements</span><b>{rows.length}</b></div></div>
    <div className="requirements-grid">
      {rows.map((v:any) => <article className="requirement-card" key={v.id} onClick={() => setSelected(v)}>
        <div className="requirement-card-head"><div className="company-mark">{v.company.name[0]}</div><div><h3>{v.company.name}</h3><p>{v.company.industry?.name || v.company.city || "Industry not set"}</p></div><Badge>{v.leadQuality || "QUALIFIED"}</Badge></div>
        <div className="requirement-focus"><span>Project requirement</span><b>{v.adminDetails?.requirement?.projectType || "Project details captured"}</b><p>{v.adminDetails?.requirement?.description || "Open to view the complete requirement."}</p></div>
        <div className="requirement-meta"><span><Users size={14}/>{v.adminDetails?.contact?.name || "Contact captured"}</span><span><CalendarDays size={14}/>{v.adminDetails?.requirement?.timeline || "Timeline pending"}</span></div>
        <button>View complete brief <span>→</span></button>
      </article>)}
      {!rows.length && <Empty text="No project requirements found"/>}
    </div>
    {selected && <Modal title={`${selected.company.name} — Requirement brief`} close={() => setSelected(null)} wide>
      <div className="brief-banner"><div><span>PROJECT TYPE</span><h2>{selected.adminDetails?.requirement?.projectType || "Not specified"}</h2><p>Captured by {selected.user.name} on {new Date(selected.checkOutAt || selected.createdAt).toLocaleDateString()}</p></div><Badge>{selected.leadQuality || "QUALIFIED"}</Badge></div>
      <div className="requirement-details">
        <Detail l="Company" v={selected.company.name}/><Detail l="Industry" v={selected.company.industry?.name}/><Detail l="Company phone" v={selected.company.phone}/><Detail l="Company email" v={selected.company.email}/>
        <Detail l="Connected person" v={selected.adminDetails?.contact?.name}/><Detail l="Designation" v={selected.adminDetails?.contact?.designation}/><Detail l="Contact phone" v={selected.adminDetails?.contact?.phone}/><Detail l="Contact email" v={selected.adminDetails?.contact?.email}/>
        <Detail l="Requirement" v={selected.adminDetails?.requirement?.description} wide/><Detail l="Timeline" v={selected.adminDetails?.requirement?.timeline}/><Detail l="Decision maker" v={selected.decisionMakerStatus}/>
        <Detail l="Budget discussed" v={selected.adminDetails?.requirement?.budgetDiscussed ? "Yes" : "No"}/><Detail l="Budget range" v={selected.adminDetails?.requirement?.budgetMin || selected.adminDetails?.requirement?.budgetMax ? `${selected.adminDetails?.requirement?.budgetMin || "—"} – ${selected.adminDetails?.requirement?.budgetMax || "—"}` : "Not shared"}/>
        <Detail l="Opportunity" v={selected.adminDetails?.opportunity?.name}/><Detail l="Pipeline stage" v={selected.adminDetails?.opportunity?.stage}/><Detail l="Next follow-up" v={selected.adminDetails?.followUp ? `${selected.adminDetails.followUp.type.replaceAll("_"," ")} · ${new Date(selected.adminDetails.followUp.scheduledAt).toLocaleString()}` : "Not scheduled"} wide/>
      </div>
      {selected.proofPhotos?.length > 0 && <><h3 className="section-label">Verified visit proof</h3><div className="proof-gallery compact-proof">{selected.proofPhotos.map((p:any) => <figure key={p.id}><img src={p.fileUrl}/><figcaption>{new Date(p.createdAt).toLocaleString()}</figcaption></figure>)}</div></>}
    </Modal>}
  </div>
}

function Companies({ user }: any) {
  const qc = useQueryClient();
  const canAdd = ["ADMIN", "SALES_HEAD", "BD_MANAGER"].includes(user.role);
  const { data: rows = [] } = useQuery({
    queryKey: ["companies"],
    queryFn: () => api("/companies"),
  });
  const { data: master } = useQuery({
    queryKey: ["master"],
    queryFn: () => api("/master-data"),
  });
  const { data: spamRows = [] } = useQuery({
    queryKey: ["company-spam"],
    queryFn: () => api("/companies-spam"),
    enabled: canAdd,
  });
  const [show, setShow] = useState(false),
    [f, setF] = useState<any>({
      name: "",
      city: "",
      phone: "",
      email: "",
      industryId: "",
      addressLine: "",
    }),
    [err, setErr] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const change = (e: any) => setF({ ...f, [e.target.name]: e.target.value });
  const save = async () => {
    try {
      await api("/companies", { method: "POST", body: JSON.stringify(f) });
      qc.invalidateQueries({ queryKey: ["companies"] });
      setShow(false);
    } catch (e: any) {
      setErr(e.message);
      qc.invalidateQueries({ queryKey: ["company-spam"] });
    }
  };
  const removeCompany = async () => {
    try { await api(`/companies/${deleteTarget.id}`, { method: "DELETE" }); await qc.invalidateQueries({ queryKey: ["companies"] }); await qc.invalidateQueries({ queryKey: ["summary"] }); setDeleteTarget(null); }
    catch (e:any) { setErr(e.message); }
  };
  return (
    <div className="space-y-5">
      <PageTitle
        title="Companies"
        sub={
          canAdd
            ? "Create and manage the company master."
            : "Companies assigned to your sales work."
        }
        action={
          canAdd ? (
            <button className="btn btn-primary" onClick={() => setShow(true)}>
              <Plus />
              Add company
            </button>
          ) : null
        }
      />
      <div className="company-grid">
        {rows.map((x: any) => (
          <div className="company-card" key={x.id}>
            <div className="company-mark">{x.name[0]}</div>
            <div>
              <h3>{x.name}</h3>
              <p>{x.industry?.name || "Industry not set"}</p>
              <span>
                <MapPin size={14} />
                {x.city || "Location not set"}
              </span>
              <span>
                <Users size={14} />
                {x.contacts.length} contacts
              </span>
              <small>{x._count?.visits || 0} visits · {x._count?.requirements || 0} requirements</small>
            </div>
            {user.role === "ADMIN" && <button className="company-delete" title="Delete company" onClick={() => { setErr(""); setDeleteTarget(x); }}><X size={16}/></button>}
          </div>
        ))}
      </div>
      {canAdd && spamRows.length > 0 && (
        <Panel>
          <div className="spam-heading"><div><b>Spam & duplicate protection</b><p>Blocked company submissions using an existing mobile number.</p></div><Badge>{spamRows.length} blocked</Badge></div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Attempted company</th><th>Mobile</th><th>Matched company</th><th>Submitted by</th><th>Time</th></tr></thead>
              <tbody>{spamRows.map((row: any) => <tr key={row.id}><td><b>{row.attemptedName}</b></td><td>{row.attemptedPhone}</td><td>{row.matchedCompanyName || "Existing record"}</td><td>{row.createdByName}</td><td>{new Date(row.createdAt).toLocaleString()}</td></tr>)}</tbody>
            </table>
          </div>
        </Panel>
      )}
      {show && (
        <Modal title="Add a new company" close={() => setShow(false)}>
          <Field n="name" l="Company name *" f={f} c={change} />
          <Field n="city" l="City *" f={f} c={change} />
          <label>
            Industry
            <select
              name="industryId"
              className={input}
              value={f.industryId}
              onChange={change}
            >
              <option value="">Select</option>
              {master?.industries.map((x: any) => (
                <option value={x.id}>{x.name}</option>
              ))}
            </select>
          </label>
          <Field n="phone" l="Phone" f={f} c={change} />
          <Field n="email" l="Email" f={f} c={change} />
          <Field n="addressLine" l="Address" f={f} c={change} />
          {err && <Notice danger>{err}</Notice>}
          <button className="btn btn-primary w-full" onClick={save}>
            Save company
          </button>
        </Modal>
      )}
      {deleteTarget && <Modal title="Delete company" close={() => setDeleteTarget(null)}><div className="delete-warning"><b>Delete {deleteTarget.name}?</b><p>The company will be removed from active CRM views. Open assignments and follow-ups for it will be closed.</p></div>{err && <Notice danger>{err}</Notice>}<button className="btn danger-action w-full" onClick={removeCompany}>Delete company</button></Modal>}
    </div>
  );
}
function Visits({ user }: any) {
  const qc = useQueryClient();
  const { data: rows = [] } = useQuery({
    queryKey: ["visits"],
    queryFn: () => api("/visits"),
  });
  const [outcome, setOutcome] = useState("ALL");
  const [visitSearch, setVisitSearch] = useState("");
  const visibleRows = rows.filter((v: any) =>
    (outcome === "ALL" || v.projectRequired === outcome) &&
    (!visitSearch || `${v.company.name} ${v.user.name}`.toLowerCase().includes(visitSearch.toLowerCase()))
  );
  const outcomeCount = (value: string) => value === "ALL" ? rows.length : rows.filter((v: any) => v.projectRequired === value).length;
  const [review, setReview] = useState<any>(null);
  const [edit, setEdit] = useState<any>(null);
  const [editError, setEditError] = useState("");
  const [emailEdit, setEmailEdit] = useState<any>(null);
  const [emailEditError, setEmailEditError] = useState("");
  const openEmailEdit = (v: any) => {
    setEmailEdit({ visitId: v.id, companyName: v.company.name, companyEmail: v.editableEmails?.companyEmail || "", contactEmail: v.editableEmails?.contactEmail || "", contactName: v.editableEmails?.contactName || "", correctionRequired: v.emailCorrectionRequired, correctionReason: v.emailCorrectionReason });
    setEmailEditError("");
  };
  const saveEmailCorrection = async () => {
    try {
      setEmailEditError("");
      await api(`/visits/${emailEdit.visitId}/contact-email`, { method: "PATCH", body: JSON.stringify({ companyEmail: emailEdit.companyEmail, contactEmail: emailEdit.contactEmail }) });
      await qc.invalidateQueries({ queryKey: ["visits"] });
      await qc.invalidateQueries({ queryKey: ["emails"] });
      await qc.invalidateQueries({ queryKey: ["notifications"] });
      setEmailEdit(null);
    } catch (e: any) { setEmailEditError(e.message); }
  };
  const openEdit = (v: any) => {
    const d = v.adminDetails;
    const scheduled = d?.followUp?.scheduledAt
      ? new Date(new Date(d.followUp.scheduledAt).getTime() - new Date(d.followUp.scheduledAt).getTimezoneOffset() * 60000).toISOString().slice(0, 16)
      : "";
    setEdit({
      visitId: v.id,
      companyName: v.company.name || "", city: v.company.city || "", companyPhone: v.company.phone || "", companyEmail: v.company.email || "", addressLine: v.company.addresses?.[0]?.addressLine || "",
      contactName: d?.contact?.name || "", designation: d?.contact?.designation || "", contactPhone: d?.contact?.phone || "", contactEmail: d?.contact?.email || "",
      projectType: d?.requirement?.projectType || "", requirementDescription: d?.requirement?.description || "", timeline: d?.requirement?.timeline || "",
      decisionMakerStatus: v.decisionMakerStatus || "PARTIAL", budgetDiscussed: String(d?.requirement?.budgetDiscussed ?? v.budgetDiscussed ?? false), budgetMin: d?.requirement?.budgetMin ?? v.budgetMin ?? "", budgetMax: d?.requirement?.budgetMax ?? v.budgetMax ?? "", leadQuality: v.leadQuality || "WARM",
      opportunityName: d?.opportunity?.name || "", estimatedValue: d?.opportunity?.estimatedValue ?? "", probability: d?.opportunity?.probability ?? "", stage: d?.opportunity?.stage || "NEW",
      followUpId: d?.followUp?.id || "", followUpType: d?.followUp?.type || "F2F", scheduledAt: scheduled, followUpPurpose: d?.followUp?.purpose || "", reminderOffsetMinutes: d?.followUp?.reminderOffsetMinutes ?? 60,
    });
    setEditError("");
  };
  const editChange = (e: any) => setEdit({ ...edit, [e.target.name]: e.target.value });
  const saveEdit = async () => {
    try {
      const numberOrNull = (value: any) => value === "" ? null : Number(value);
      await api(`/admin/visits/${edit.visitId}/project`, { method: "PATCH", body: JSON.stringify({
        company: { name: edit.companyName, city: edit.city, phone: edit.companyPhone, email: edit.companyEmail, addressLine: edit.addressLine },
        contact: { name: edit.contactName, designation: edit.designation, phone: edit.contactPhone, email: edit.contactEmail },
        projectType: edit.projectType, requirementDescription: edit.requirementDescription, timeline: edit.timeline,
        decisionMakerStatus: edit.decisionMakerStatus, budgetDiscussed: edit.budgetDiscussed === "true", budgetMin: numberOrNull(edit.budgetMin), budgetMax: numberOrNull(edit.budgetMax), leadQuality: edit.leadQuality,
        opportunityName: edit.opportunityName, estimatedValue: numberOrNull(edit.estimatedValue), probability: numberOrNull(edit.probability), stage: edit.stage,
        followUp: edit.followUpId ? { id: edit.followUpId, type: edit.followUpType, scheduledAt: new Date(edit.scheduledAt).toISOString(), purpose: edit.followUpPurpose, reminderOffsetMinutes: Number(edit.reminderOffsetMinutes) } : null,
      }) });
      await qc.invalidateQueries({ queryKey: ["visits"] });
      await qc.invalidateQueries({ queryKey: ["followups"] });
      await qc.invalidateQueries({ queryKey: ["companies"] });
      setEdit(null); setReview(null);
    } catch (e: any) { setEditError(e.message); }
  };
  return (
    <div className="space-y-5">
      <PageTitle
        title="Visit Intelligence"
        sub="Review proof, outcomes and company opportunities from one organized workspace."
      />
      <div className="outcome-tabs">
        {[["ALL", "All visits"], ["YES", "Project required"], ["MAYBE", "Maybe / nurture"], ["NO", "No requirement"], ["COLLABORATION", "Collaborations"]].map(([value, label]) => (
          <button key={value} className={outcome === value ? "active" : ""} onClick={() => setOutcome(value)}>
            {value === "COLLABORATION" && <Handshake size={16} />}<span>{label}</span><b>{outcomeCount(value)}</b>
          </button>
        ))}
      </div>
      <Panel>
        <div className="panel-toolbar">
          <div className="search-box"><Search size={17} /><input value={visitSearch} onChange={e => setVisitSearch(e.target.value)} placeholder="Search company or salesperson" /></div>
          <span className="result-count">{visibleRows.length} records</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Company</th>
                <th>Salesperson</th>
                <th>Check-in / check-out</th>
                <th>Current activity</th>
                <th>Priority</th>
                <th>Proof</th>
                <th>Outcome</th>
                <th>Email</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((v: any) => (
                <tr key={v.id}>
                  <td>
                    <b>{v.company.name}</b>
                    <small>
                      {v.company.industry?.name || v.company.city || ""}
                    </small>
                  </td>
                  <td>{v.user.name}</td>
                  <td>
                    {new Date(v.checkInAt).toLocaleString()}
                    <small>
                      {v.checkOutAt
                        ? new Date(v.checkOutAt).toLocaleString()
                        : "Currently checked in"}
                    </small>
                  </td>
                  <td>
                    {v.hourlyActivities[0]?.status?.replaceAll("_", " ") || "—"}
                  </td>
                  <td>
                    {v.leadQuality ? (
                      <Badge>{v.leadQuality}</Badge>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td>
                    {user.role === "ADMIN" && (v.hasProof || v.adminDetails) ? (
                      <button
                        className="mini proof"
                        onClick={() => setReview(v)}
                      >
                        <ImageIcon size={14} />
                        {["YES", "MAYBE", "COLLABORATION"].includes(v.projectRequired)
                          ? "View full details"
                          : "View proof"}
                      </button>
                    ) : v.hasProof ? (
                      <Badge>PHOTO VERIFIED</Badge>
                    ) : (
                      "Missing"
                    )}
                  </td>
                  <td>
                    <Badge>{v.projectRequired || v.status}</Badge>
                  </td>
                  <td>
                    {v.canCorrectEmail ? <button className={`mini ${v.emailCorrectionRequired ? "danger-action" : ""}`} onClick={() => openEmailEdit(v)}>{v.emailCorrectionRequired ? "Correct now" : "Edit email"}</button> : "—"}
                    {v.emailCorrectionRequired && <small className="text-red-600">Delivery failed</small>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!visibleRows.length && <Empty text="No records match this view" />}
        </div>
      </Panel>
      {review && (
        <Modal
          title={
            review.projectRequired === "YES"
              ? "Admin company & project review"
              : review.projectRequired === "COLLABORATION"
                ? "Admin collaboration review"
              : "Admin visit proof review"
          }
          close={() => setReview(null)}
          wide
        >
          <div className="proof-meta">
            <div>
              <span>Salesperson</span>
              <b>{review.user.name}</b>
              <small>{review.user.email}</small>
            </div>
            <div>
              <span>Company</span>
              <b>{review.company.name}</b>
              <small>
                {review.company.industry?.name || "Industry not set"}
              </small>
            </div>
            <div>
              <span>Visit timing</span>
              <b>{new Date(review.checkInAt).toLocaleString()}</b>
              <small>
                {review.checkOutAt
                  ? `Out: ${new Date(review.checkOutAt).toLocaleString()}`
                  : "Currently checked in"}
              </small>
            </div>
          </div>
          {review.projectRequired === "YES" && (
            <div className="requirement-details">
              <Detail l="Company name" v={review.company.name} />
              <Detail l="Industry" v={review.company.industry?.name} />
              <Detail l="Company phone" v={review.company.phone} />
              <Detail l="Company email" v={review.company.email} />
              <Detail
                l="Company address / location"
                v={review.company.addresses?.[0]?.addressLine}
              />
              <Detail
                l="City"
                v={review.company.addresses?.[0]?.city || review.company.city}
              />
              <Detail
                l="Connected person"
                v={review.adminDetails?.contact?.name}
              />
              <Detail
                l="Designation"
                v={review.adminDetails?.contact?.designation}
              />
              <Detail
                l="Contact phone"
                v={review.adminDetails?.contact?.phone}
              />
              <Detail
                l="Contact email"
                v={review.adminDetails?.contact?.email}
              />
              <Detail
                l="Project type"
                v={review.adminDetails?.requirement?.projectType}
              />
              <Detail
                l="Timeline"
                v={review.adminDetails?.requirement?.timeline}
              />
              <Detail
                l="Requirement"
                v={review.adminDetails?.requirement?.description}
                wide
              />
              <Detail l="Decision maker" v={review.decisionMakerStatus} />
              <Detail l="Budget discussed" v={review.adminDetails?.requirement?.budgetDiscussed ? "Yes" : "No"} />
              <Detail l="Minimum budget" v={review.adminDetails?.requirement?.budgetMin} />
              <Detail l="Maximum budget" v={review.adminDetails?.requirement?.budgetMax} />
              <Detail l="Priority" v={review.leadQuality} />
              <Detail
                l="Opportunity"
                v={review.adminDetails?.opportunity?.name}
              />
              <Detail l="Estimated value" v={review.adminDetails?.opportunity?.estimatedValue} />
              <Detail l="Probability" v={review.adminDetails?.opportunity?.probability === null || review.adminDetails?.opportunity?.probability === undefined ? undefined : `${review.adminDetails.opportunity.probability}%`} />
              <Detail l="Opportunity stage" v={review.adminDetails?.opportunity?.stage} />
              <Detail l="Next follow-up" v={review.adminDetails?.followUp ? `${review.adminDetails.followUp.type} · ${new Date(review.adminDetails.followUp.scheduledAt).toLocaleString()}` : undefined} wide />
              <Detail l="Remarks" v={review.remarks} wide />
            </div>
          )}
          {review.projectRequired === "COLLABORATION" && (
            <div className="requirement-details">
              <Detail l="Company name" v={review.company.name} />
              <Detail l="Industry" v={review.company.industry?.name} />
              <Detail l="Connected person" v={review.adminDetails?.contact?.name} />
              <Detail l="Designation" v={review.adminDetails?.contact?.designation} />
              <Detail l="Contact phone" v={review.adminDetails?.contact?.phone} />
              <Detail l="Contact email" v={review.adminDetails?.contact?.email} />
              <Detail l="Collaboration type" v={review.collaborationType} />
              <Detail l="Next follow-up" v={review.adminDetails?.followUp ? `${review.adminDetails.followUp.type} · ${new Date(review.adminDetails.followUp.scheduledAt).toLocaleString()}` : undefined} />
              <Detail l="Collaboration details" v={review.collaborationDetails} wide />
              <Detail l="Remarks" v={review.remarks} wide />
            </div>
          )}
          {review.projectRequired === "YES" && (
            <button className="btn btn-primary w-full" onClick={() => openEdit(review)}>
              Edit company, budget & project details
            </button>
          )}
          <h3 className="section-label">Company visit proof</h3>
          <div className="proof-gallery">
            {review.proofPhotos?.map((p: any) => (
              <figure key={p.id}>
                <img src={p.fileUrl} alt={`${p.photoType} visit proof`} />
                <figcaption>
                  {p.photoType.replaceAll("_", " ")} proof ·{" "}
                  {new Date(p.createdAt).toLocaleString()}
                </figcaption>
              </figure>
            ))}
            {!review.proofPhotos?.length && (
              <Empty text="No proof image uploaded" />
            )}
          </div>
        </Modal>
      )}
      {edit && (
        <Modal title="Admin edit project details" close={() => setEdit(null)} wide>
          <h3 className="section-label">Company and connected person</h3>
          <div className="form-grid">
            <Field n="companyName" l="Company name *" f={edit} c={editChange} />
            <Field n="city" l="City *" f={edit} c={editChange} />
            <Field n="companyPhone" l="Company phone" f={edit} c={editChange} />
            <Field n="companyEmail" l="Company email" f={edit} c={editChange} />
            <Field n="addressLine" l="Company address *" f={edit} c={editChange} />
            <Field n="contactName" l="Connected person *" f={edit} c={editChange} />
            <Field n="designation" l="Designation *" f={edit} c={editChange} />
            <Field n="contactPhone" l="Contact phone" f={edit} c={editChange} />
            <Field n="contactEmail" l="Contact email" f={edit} c={editChange} />
          </div>
          <h3 className="section-label">Requirement and budget</h3>
          <div className="form-grid">
            <Field n="projectType" l="Project type *" f={edit} c={editChange} />
            <Field n="timeline" l="Timeline *" f={edit} c={editChange} />
            <label>Decision maker status<select name="decisionMakerStatus" className={input} value={edit.decisionMakerStatus} onChange={editChange}><option value="YES">Yes</option><option value="PARTIAL">Partial</option><option value="NO">No</option></select></label>
            <label>Lead quality<select name="leadQuality" className={input} value={edit.leadQuality} onChange={editChange}><option value="HOT">Hot</option><option value="WARM">Warm</option><option value="COLD">Cold</option><option value="NOT_QUALIFIED">Not qualified</option><option value="NEGATIVE">Negative</option></select></label>
            <label>Budget discussed<select name="budgetDiscussed" className={input} value={edit.budgetDiscussed} onChange={editChange}><option value="true">Yes</option><option value="false">No</option></select></label>
            <Field n="budgetMin" l="Minimum budget" f={edit} c={editChange} />
            <Field n="budgetMax" l="Maximum budget" f={edit} c={editChange} />
          </div>
          <label>Requirement description *<textarea name="requirementDescription" className={input} value={edit.requirementDescription} onChange={editChange} /></label>
          <h3 className="section-label">Opportunity and next follow-up</h3>
          <div className="form-grid">
            <Field n="opportunityName" l="Opportunity name *" f={edit} c={editChange} />
            <Field n="estimatedValue" l="Estimated value" f={edit} c={editChange} />
            <Field n="probability" l="Probability (0-100)" f={edit} c={editChange} />
            <label>Stage<select name="stage" className={input} value={edit.stage} onChange={editChange}>{["NEW","REQUIREMENT_COLLECTED","DISCUSSION","DEMO","PROPOSAL","QUOTATION","NEGOTIATION","DECISION_PENDING","WON","LOST"].map(x => <option key={x} value={x}>{x.replaceAll("_", " ")}</option>)}</select></label>
            {edit.followUpId && <><label>Follow-up type<select name="followUpType" className={input} value={edit.followUpType} onChange={editChange}>{["CALL","EMAIL","WHATSAPP","F2F","TEAMS","ZOOM","DEMO","QUOTATION_FOLLOWUP","PAYMENT_FOLLOWUP"].map(x => <option key={x} value={x}>{x.replaceAll("_", " ")}</option>)}</select></label><label>Scheduled date and time<input type="datetime-local" name="scheduledAt" className={input} value={edit.scheduledAt} onChange={editChange} /></label><Field n="followUpPurpose" l="Follow-up purpose *" f={edit} c={editChange} /><Field n="reminderOffsetMinutes" l="Reminder before (minutes)" f={edit} c={editChange} /></>}
          </div>
          {editError && <Notice danger>{editError}</Notice>}
          <button className="btn btn-primary w-full" onClick={saveEdit}>Save admin changes</button>
        </Modal>
      )}
      {emailEdit && (
        <Modal title="Correct company/contact email" close={() => setEmailEdit(null)}>
          <div className={emailEdit.correctionRequired ? "notice danger" : "notice"}>
            <b>{emailEdit.companyName}</b>
            <p>{emailEdit.correctionRequired ? `Delivery failed: ${emailEdit.correctionReason || "The entered email could not receive the message."}` : "Update the address if the company gave a correction. The brochure will be sent again automatically."}</p>
          </div>
          <div className="form-grid">
            <label>Contact email<input type="email" className={input} value={emailEdit.contactEmail} onChange={e => setEmailEdit({ ...emailEdit, contactEmail: e.target.value })}/></label>
            <label>Company email<input type="email" className={input} value={emailEdit.companyEmail} onChange={e => setEmailEdit({ ...emailEdit, companyEmail: e.target.value })}/></label>
          </div>
          {emailEditError && <Notice danger>{emailEditError}</Notice>}
          <button className="btn btn-primary w-full" onClick={saveEmailCorrection}>Save and resend brochure</button>
        </Modal>
      )}
    </div>
  );
}
function TeamActivity() {
  const { data: rows = [] } = useQuery({
    queryKey: ["team-activity"],
    queryFn: () => api("/team/activity"),
    refetchInterval: 60000,
  });
  return (
    <div className="space-y-5">
      <PageTitle
        title="Team Activity Monitor"
        sub="Check-in, last reported activity and checkout status. Refreshes every minute."
      />
      <div className="activity-grid">
        {rows.map((v: any) => {
          const last = v.hourlyActivities[0];
          return (
            <div className="activity-card" key={v.id}>
              <div className="flex justify-between">
                <div>
                  <b>{v.user.name}</b>
                  <p>{v.company.name}</p>
                </div>
                <span
                  className={`live-dot ${v.status === "OPEN" ? "on" : ""}`}
                />
              </div>
              <div className="timeline">
                <div>
                  <span>CHECK IN</span>
                  <b>{new Date(v.checkInAt).toLocaleTimeString()}</b>
                </div>
                <div>
                  <span>CURRENT</span>
                  <b>{last?.status?.replaceAll("_", " ") || "No update"}</b>
                  <small>
                    {last && new Date(last.capturedAt).toLocaleTimeString()}
                  </small>
                </div>
                <div>
                  <span>CHECK OUT</span>
                  <b>
                    {v.checkOutAt
                      ? new Date(v.checkOutAt).toLocaleTimeString()
                      : "Pending"}
                  </b>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {!rows.length && <Empty text="No team activity today" />}
    </div>
  );
}
function UsersAdmin() {
  const qc = useQueryClient();
  const { data: rows = [] } = useQuery({
    queryKey: ["users"],
    queryFn: () => api("/admin/users"),
    refetchInterval: 5000,
    refetchIntervalInBackground: true,
  });
  const [error, setError] = useState("");
  const approve = async (u: any, status: string) => {
    try {
      setError("");
      await api(`/admin/users/${u.id}/approval`, {
        method: "PATCH",
        body: JSON.stringify({
          approvalStatus: status,
          role: u.requestedRole || u.role,
          isSalesTeam: ["SALES_HEAD", "BD_MANAGER", "SALES_BD_EXECUTIVE"].includes(u.requestedRole || u.role),
          rejectionReason:
            status === "REJECTED" ? "Rejected by administrator" : "",
        }),
      });
      qc.invalidateQueries({ queryKey: ["users"] });
      qc.invalidateQueries({ queryKey: ["summary"] });
    } catch (e: any) {
      setError(e.message);
    }
  };
  return (
    <div className="space-y-5">
      <PageTitle
        title="User Registration & Access"
        sub="Approve verified registrations, choose roles and control sales-team membership."
      />
      {error && <Notice danger>{error}</Notice>}
      <Panel>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>User</th>
                <th>Email</th>
                <th>Requested role</th>
                <th>Status</th>
                <th>Sales team</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((u: any) => (
                <tr key={u.id}>
                  <td>
                    <b>{u.name}</b>
                    <small>{u.email}</small>
                  </td>
                  <td>
                    <Badge>
                      {u.emailVerified ? "VERIFIED" : "NOT VERIFIED"}
                    </Badge>
                  </td>
                  <td>{u.requestedRole || u.role}</td>
                  <td>
                    <Badge>{u.approvalStatus}</Badge>
                  </td>
                  <td>{u.isSalesTeam ? "Yes" : "No"}</td>
                  <td>
                    {u.approvalStatus === "PENDING" ? (
                      <div className="flex gap-2">
                        <button
                          disabled={!u.emailVerified}
                          className="mini success disabled:opacity-40"
                          onClick={() => approve(u, "APPROVED")}
                        >
                          Approve
                        </button>
                        <button
                          className="mini danger"
                          onClick={() => approve(u, "REJECTED")}
                        >
                          Reject
                        </button>
                      </div>
                    ) : (
                      <span className="text-slate-400">Reviewed</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
function Reports() {
  const { data: rows = [] } = useQuery({
    queryKey: ["reports"],
    queryFn: () => api("/reports"),
  });
  return (
    <div className="space-y-5">
      <PageTitle
        title="Management Reports"
        sub="Role-level visit volume and average field duration."
      />
      <Panel>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Team member</th>
                <th>Role</th>
                <th>Visit status</th>
                <th>Total visits</th>
                <th>Average minutes</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r: any, i: number) => (
                <tr key={i}>
                  <td>
                    <b>{r.user?.name}</b>
                  </td>
                  <td>{r.user?.role}</td>
                  <td>
                    <Badge>{r.status}</Badge>
                  </td>
                  <td>{r._count}</td>
                  <td>{Math.round(r._avg.durationMinutes || 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

function Pipeline({ user }: any) {
  const qc = useQueryClient();
  const { data: rows = [] } = useQuery({
    queryKey: ["opportunities"],
    queryFn: () => api("/opportunities"),
  });
  const { data: master } = useQuery({ queryKey: ["master"], queryFn: () => api("/master-data") });
  const canManage = ["ADMIN", "SALES_HEAD", "BD_MANAGER", "TECHNICAL_TEAM"].includes(user.role);
  const [quoteOpportunity, setQuoteOpportunity] = useState<any>(null);
  const [decisionQuote, setDecisionQuote] = useState<any>(null);
  const [error, setError] = useState("");
  const [quoteForm, setQuoteForm] = useState<any>({ items: [{ description: "", quantity: "1", unitPrice: "" }], discountPercent: "0", taxPercent: "18", paymentTerms: "40% advance, 40% after demonstration, 20% after deployment", deliveryTimeline: "30 days from approval", notes: "", validUntil: "", discussionOwnerId: "" });
  const [decisionForm, setDecisionForm] = useState<any>({ decision: "YES", reason: "", feedback: "", revisitAfter: "30_DAYS", followUpAt: "" });
  const move = async (id: string, stage: string) => {
    try { setError(""); await api(`/opportunities/${id}/stage`, { method: "PATCH", body: JSON.stringify({ stage }) }); await qc.invalidateQueries({ queryKey: ["opportunities"] }); }
    catch (e: any) { setError(e.message); }
  };
  const openQuote = (opportunity: any) => {
    setQuoteOpportunity(opportunity); setError("");
    setQuoteForm({ items: [{ description: opportunity.projectType || opportunity.name, quantity: "1", unitPrice: opportunity.estimatedValue || "" }], discountPercent: "0", taxPercent: "18", paymentTerms: "40% advance, 40% after demonstration, 20% after deployment", deliveryTimeline: "30 days from approval", notes: "", validUntil: "", discussionOwnerId: opportunity.ownerId || "" });
  };
  const createQuote = async () => {
    try {
      setError("");
      await api("/quotations", { method: "POST", body: JSON.stringify({ opportunityId: quoteOpportunity.id, validUntil: quoteForm.validUntil ? new Date(quoteForm.validUntil).toISOString() : undefined, discussionOwnerId: quoteForm.discussionOwnerId || undefined, discountPercent: Number(quoteForm.discountPercent), taxPercent: Number(quoteForm.taxPercent), paymentTerms: quoteForm.paymentTerms, deliveryTimeline: quoteForm.deliveryTimeline, notes: quoteForm.notes || undefined, items: quoteForm.items.map((item: any) => ({ description: item.description, quantity: Number(item.quantity), unitPrice: Number(item.unitPrice) })) }) });
      await qc.invalidateQueries({ queryKey: ["opportunities"] }); setQuoteOpportunity(null);
    } catch (e: any) { setError(e.message); }
  };
  const advanceQuote = async (quote: any) => {
    const next: any = { DRAFT: "PENDING_APPROVAL", PENDING_APPROVAL: "APPROVED", APPROVED: "SENT" };
    if (!next[quote.status]) return;
    try { setError(""); await api(`/quotations/${quote.id}/status`, { method: "PATCH", body: JSON.stringify({ status: next[quote.status] }) }); await qc.invalidateQueries({ queryKey: ["opportunities"] }); }
    catch (e: any) { setError(e.message); }
  };
  const regenerateQuotePdf = async (quote: any) => {
    try {
      setError("");
      await api(`/quotations/${quote.id}/regenerate-pdf`, { method: "POST" });
      await qc.invalidateQueries({ queryKey: ["opportunities"] });
    } catch (e: any) { setError(e.message); }
  };
  const recordDecision = async () => {
    try {
      setError("");
      await api(`/quotations/${decisionQuote.id}/client-decision`, { method: "POST", body: JSON.stringify({ decision: decisionForm.decision, reason: decisionForm.reason, feedback: decisionForm.feedback || undefined, revisitAfter: decisionForm.decision === "NO" ? decisionForm.revisitAfter : undefined, followUpAt: decisionForm.decision === "MAYBE" && decisionForm.followUpAt ? new Date(decisionForm.followUpAt).toISOString() : undefined }) });
      await qc.invalidateQueries({ queryKey: ["opportunities"] });
      if (decisionForm.decision === "YES") celebrateDeal(decisionQuote.opportunityName || "the client");
      setDecisionQuote(null);
    } catch (e: any) { setError(e.message); }
  };
  const counts = { open: rows.filter((x: any) => !["WON", "LOST"].includes(x.stage)).length, review: rows.filter((x: any) => ["QUOTATION", "NEGOTIATION", "DECISION_PENDING"].includes(x.stage)).length, won: rows.filter((x: any) => x.stage === "WON").length, lost: rows.filter((x: any) => x.stage === "LOST").length };
  const quoteSubtotal = quoteForm.items.reduce((sum: number, item: any) => sum + Number(item.quantity || 0) * Number(item.unitPrice || 0), 0);
  const quoteDiscount = quoteSubtotal * Number(quoteForm.discountPercent || 0) / 100;
  const quoteTax = (quoteSubtotal - quoteDiscount) * Number(quoteForm.taxPercent || 0) / 100;
  const quoteTotal = quoteSubtotal - quoteDiscount + quoteTax;
  return (
    <div className="space-y-5">
      <PageTitle
        title="Opportunity Pipeline"
        sub="Qualified requirements through proposal, quotation, negotiation and closure."
      />
      <div className="pipeline-metrics">
        <div><span>Open pipeline</span><b>{counts.open}</b><small>Active opportunities</small></div>
        <div><span>Quotation review</span><b>{counts.review}</b><small>Quotation to decision</small></div>
        <div className="won"><span>Won</span><b>{counts.won}</b><small>Client accepted</small></div>
        <div className="lost"><span>Lost</span><b>{counts.lost}</b><small>Re-engagement tracked</small></div>
      </div>
      {error && <Notice danger>{error}</Notice>}
      <Panel>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Company</th>
                <th>Opportunity</th>
                <th>Project</th>
                <th>Stage</th>
                <th>Probability</th>
                <th>Quotation</th>
                <th>Workflow action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((x: any) => {
                const quote = x.quotations?.[0];
                const nextLabel: any = { DRAFT: "Submit for approval", PENDING_APPROVAL: "Approve quotation", APPROVED: "Send to client" };
                return <tr key={x.id}>
                  <td>
                    <b>{x.company.name}</b>
                  </td>
                  <td>{x.name}</td>
                  <td>{x.projectType || "—"}</td>
                  <td>
                    <Badge>{x.stage}</Badge>
                  </td>
                  <td>{x.probability || 0}%</td>
                  <td>
                    {quote ? <div className="quote-cell"><b>Version {quote.version}</b><Badge>{quote.status}</Badge><small>₹{Number(quote.totalAmount || 0).toLocaleString("en-IN")}</small>{quote.documentUrl && <a className="quotation-pdf-link" href={quote.documentUrl} target="_blank" rel="noreferrer"><FileText size={13}/>Preview PDF</a>}{canManage && <button className="mini" onClick={() => regenerateQuotePdf(quote)}>Regenerate PDF</button>}{quote.clientDecision !== "PENDING" && <small>Client: {quote.clientDecision}</small>}</div> : <span className="text-slate-400">Not created</span>}
                  </td>
                  <td>
                    <div className="quote-actions">
                      {!['WON','LOST'].includes(x.stage) && <select className={input} value={x.stage} onChange={(e) => move(x.id, e.target.value)}>{["NEW", "REQUIREMENT_COLLECTED", "DISCUSSION", "DEMO", "PROPOSAL", "QUOTATION", "NEGOTIATION", "DECISION_PENDING"].map((s) => <option key={s}>{s}</option>)}</select>}
                      {canManage && !['WON','LOST'].includes(x.stage) && <button className="mini" onClick={() => openQuote(x)}>{quote ? "New quotation version" : "Create quotation"}</button>}
                      {canManage && quote && nextLabel[quote.status] && <button className="mini success" onClick={() => advanceQuote(quote)}>{nextLabel[quote.status]}</button>}
                      {quote && ["SENT", "CLIENT_REVIEW", "REVISION_REQUESTED"].includes(quote.status) && <button className="mini proof" onClick={() => { setDecisionQuote({ ...quote, opportunityName: x.company.name }); setDecisionForm({ decision: "YES", reason: "", feedback: "", revisitAfter: "30_DAYS", followUpAt: "" }); setError(""); }}>Record client decision</button>}
                      {x.stage === "LOST" && <small className="lost-reason">{x.lostReason || "Lost reason recorded"}{x.reengageAt ? ` · Re-engage ${new Date(x.reengageAt).toLocaleDateString()}` : " · No re-engagement"}</small>}
                    </div>
                  </td>
                </tr>})}
            </tbody>
          </table>
          {!rows.length && <Empty text="No qualified opportunities found" />}
        </div>
      </Panel>
      {quoteOpportunity && <Modal title={`${quoteOpportunity.quotations?.length ? "Create revised" : "Create"} quotation`} close={() => setQuoteOpportunity(null)} wide>
        <div className="workflow-banner"><b>{quoteOpportunity.company.name}</b><span>{quoteOpportunity.name} · Version {(quoteOpportunity.quotations?.[0]?.version || 0) + 1}</span></div>
        <div className="quotation-builder-head"><div><b>Quotation items</b><span>Add every service or deliverable included in the proposal.</span></div><button className="mini success" onClick={() => setQuoteForm({ ...quoteForm, items: [...quoteForm.items, { description: "", quantity: "1", unitPrice: "" }] })}><Plus size={14}/>Add item</button></div>
        <div className="quotation-items-editor">
          {quoteForm.items.map((item: any, index: number) => <div className="quotation-item-row" key={index}>
            <label>Service / deliverable *<input className={input} value={item.description} onChange={(e) => setQuoteForm({ ...quoteForm, items: quoteForm.items.map((row: any, i: number) => i === index ? { ...row, description: e.target.value } : row) })}/></label>
            <label>Quantity *<input type="number" min="0.01" step="0.01" className={input} value={item.quantity} onChange={(e) => setQuoteForm({ ...quoteForm, items: quoteForm.items.map((row: any, i: number) => i === index ? { ...row, quantity: e.target.value } : row) })}/></label>
            <label>Unit price (INR) *<input type="number" min="0" step="0.01" className={input} value={item.unitPrice} onChange={(e) => setQuoteForm({ ...quoteForm, items: quoteForm.items.map((row: any, i: number) => i === index ? { ...row, unitPrice: e.target.value } : row) })}/></label>
            <b>₹{(Number(item.quantity || 0) * Number(item.unitPrice || 0)).toLocaleString("en-IN")}</b>
            {quoteForm.items.length > 1 && <button className="quotation-remove" onClick={() => setQuoteForm({ ...quoteForm, items: quoteForm.items.filter((_: any, i: number) => i !== index) })}><X size={16}/></button>}
          </div>)}
        </div>
        <div className="form-grid">
          <Field n="discountPercent" l="Discount percentage" f={quoteForm} c={(e: any) => setQuoteForm({ ...quoteForm, [e.target.name]: e.target.value })} />
          <Field n="taxPercent" l="GST percentage" f={quoteForm} c={(e: any) => setQuoteForm({ ...quoteForm, [e.target.name]: e.target.value })} />
          <label>Quotation valid until<input type="date" name="validUntil" className={input} value={quoteForm.validUntil} onChange={(e) => setQuoteForm({ ...quoteForm, validUntil: e.target.value })} /></label>
          <label>Quotation discussion owner<select className={input} value={quoteForm.discussionOwnerId} onChange={(e) => setQuoteForm({ ...quoteForm, discussionOwnerId: e.target.value })}><option value="">Opportunity owner</option>{master?.salesUsers.map((x: any) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
          <label>Payment terms *<textarea className={input} value={quoteForm.paymentTerms} onChange={(e) => setQuoteForm({ ...quoteForm, paymentTerms: e.target.value })}/></label>
          <label>Delivery timeline *<textarea className={input} value={quoteForm.deliveryTimeline} onChange={(e) => setQuoteForm({ ...quoteForm, deliveryTimeline: e.target.value })}/></label>
          <label className="md:col-span-2">Additional terms / notes<textarea className={input} value={quoteForm.notes} onChange={(e) => setQuoteForm({ ...quoteForm, notes: e.target.value })}/></label>
        </div>
        <div className="quotation-calculation"><span>Subtotal <b>₹{quoteSubtotal.toLocaleString("en-IN")}</b></span><span>Discount <b>-₹{quoteDiscount.toLocaleString("en-IN")}</b></span><span>GST <b>₹{quoteTax.toLocaleString("en-IN")}</b></span></div>
        <div className="quotation-total"><span>Final quotation total</span><b>₹{quoteTotal.toLocaleString("en-IN")}</b></div>
        <Notice>The quotation PDF will be generated automatically when you save this draft.</Notice>
        {error && <Notice danger>{error}</Notice>}<button className="btn btn-primary w-full" onClick={createQuote}>Generate quotation PDF</button>
      </Modal>}
      {decisionQuote && <Modal title="Record client quotation decision" close={() => setDecisionQuote(null)} wide>
        <div className="decision-branches">{[["YES", "Won", "Client approved the quotation"], ["MAYBE", "Maybe", "More discussion or revision"], ["NO", "Lost", "Declined with re-engagement plan"]].map(([value, title, sub]) => <button key={value} className={decisionForm.decision === value ? `active ${value.toLowerCase()}` : ""} onClick={() => setDecisionForm({ ...decisionForm, decision: value })}><b>{title}</b><span>{sub}</span></button>)}</div>
        <label>Client reason / response *<textarea className={input} value={decisionForm.reason} onChange={(e) => setDecisionForm({ ...decisionForm, reason: e.target.value })} placeholder="Record the client's exact decision reason" /></label>
        <label>Additional feedback<textarea className={input} value={decisionForm.feedback} onChange={(e) => setDecisionForm({ ...decisionForm, feedback: e.target.value })} /></label>
        {decisionForm.decision === "NO" && <label>Re-engagement plan *<select className={input} value={decisionForm.revisitAfter} onChange={(e) => setDecisionForm({ ...decisionForm, revisitAfter: e.target.value })}><option value="30_DAYS">30 days</option><option value="90_DAYS">90 days</option><option value="180_DAYS">180 days</option><option value="NEVER">Do not re-engage</option></select></label>}
        {decisionForm.decision === "MAYBE" && <label>Next quotation discussion (within 7 days) *<input type="datetime-local" className={input} value={decisionForm.followUpAt} onChange={(e) => setDecisionForm({ ...decisionForm, followUpAt: e.target.value })} /></label>}
        <div className="branch-result"><b>{decisionForm.decision === "YES" ? "Result: WON" : decisionForm.decision === "NO" ? "Result: LOST" : "Result: DECISION PENDING"}</b><span>{decisionForm.decision === "YES" ? "A kickoff/payment follow-up is created automatically." : decisionForm.decision === "NO" ? "The loss reason and selected re-engagement date are stored." : "A mandatory quotation follow-up is assigned automatically."}</span></div>
        {error && <Notice danger>{error}</Notice>}<button className="btn btn-primary w-full" onClick={recordDecision}>Confirm decision and update workflow</button>
      </Modal>}
    </div>
  );
}
function Communications() {
  const { data: rows = [] } = useQuery({
    queryKey: ["emails"],
    queryFn: () => api("/emails"),
    refetchInterval: 30000,
  });
  return (
    <div className="space-y-5">
      <PageTitle
        title="Email Communications"
        sub="Queued, sent, delivered, opened, bounced and failed business emails."
      />
      <Panel>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Company</th>
                <th>Recipient</th>
                <th>Template / subject</th>
                <th>Status</th>
                <th>Attempts</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((x: any) => (
                <tr key={x.id}>
                  <td>
                    <b>{x.company.name}</b>
                  </td>
                  <td>{x.to}</td>
                  <td>
                    {x.template}
                    <small>{x.subject}</small>
                  </td>
                  <td>
                    <Badge>{x.status}</Badge>
                    {x.lastError && <small>{x.lastError}</small>}
                  </td>
                  <td>{x.attempts}</td>
                  <td>{new Date(x.createdAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!rows.length && <Empty text="No business emails logged yet" />}
        </div>
      </Panel>
    </div>
  );
}
function Notifications() {
  const qc = useQueryClient();
  const { data: rows = [] } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => api("/notifications"),
    refetchInterval: 60000,
  });
  const read = async (id: string) => {
    await api(`/notifications/${id}/read`, { method: "PATCH" });
    qc.invalidateQueries({ queryKey: ["notifications"] });
  };
  return (
    <div className="space-y-5">
      <PageTitle
        title="Notifications"
        sub="Follow-up reminders, overdue actions and workflow alerts."
      />
      <div className="activity-grid">
        {rows.map((x: any) => (
          <div className="activity-card" key={x.id}>
            <div className="flex justify-between">
              <div>
                <b>{x.title}</b>
                <p>{x.message}</p>
                <small>{new Date(x.createdAt).toLocaleString()}</small>
              </div>
              {x.status === "UNREAD" && (
                <button className="mini success" onClick={() => read(x.id)}>
                  Mark read
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
      {!rows.length && <Empty text="No notifications" />}
    </div>
  );
}
function FieldMap() {
  const { data: rows = [] } = useQuery({
    queryKey: ["map-visits"],
    queryFn: () => api("/map/visits"),
  });
  return (
    <div className="space-y-5">
      <PageTitle
        title="Field Visit Map"
        sub="Verified check-in and check-out coordinates from the last 30 days."
      />
      <Panel>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Company</th>
                <th>Salesperson</th>
                <th>Point</th>
                <th>Captured</th>
                <th>Map</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((x: any) => (
                <tr key={x.id}>
                  <td>
                    <b>{x.visit.company.name}</b>
                  </td>
                  <td>{x.visit.user.name}</td>
                  <td>
                    <Badge>{x.kind}</Badge>
                    <small>
                      {Number(x.latitude).toFixed(5)},{" "}
                      {Number(x.longitude).toFixed(5)}
                    </small>
                  </td>
                  <td>{new Date(x.capturedAt).toLocaleString()}</td>
                  <td>
                    <a
                      className="mini proof"
                      target="_blank"
                      rel="noreferrer"
                      href={`https://www.google.com/maps?q=${x.latitude},${x.longitude}`}
                    >
                      Open map
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
function ActivityLogs() {
  const [filters, setFilters] = useState({ search: "", event: "", companyId: "", entity: "", from: "", to: "" });
  const params = new URLSearchParams(Object.entries(filters).filter(([, value]) => value));
  const { data = { rows: [], filters: { events: [], companies: [], entities: [] } } } = useQuery({
    queryKey: ["activity-logs", filters],
    queryFn: () => api(`/activity-logs?${params.toString()}`),
    refetchInterval: 60000,
  });
  const rows = data.rows || [];
  const setFilter = (name: string, value: string) => setFilters(current => ({ ...current, [name]: value }));
  const clear = () => setFilters({ search: "", event: "", companyId: "", entity: "", from: "", to: "" });
  const detailText = (payload: any) => Object.entries(payload || {}).slice(0, 4).map(([key, value]) => `${key.replaceAll("_", " ")}: ${typeof value === "object" ? JSON.stringify(value) : String(value)}`).join(" · ");
  const eventTone = (event: string) => event.includes("FAILED") || event.includes("CANCEL") ? "danger" : event.includes("CREATED") || event.includes("SENT") || event.includes("COMPLETED") ? "success" : event.includes("COLLABORATION") ? "collaboration" : "info";
  return (
    <div className="space-y-5">
      <PageTitle
        title="Activity Center"
        sub="A clean, searchable audit trail across field visits, sales workflows and communications."
      />
      <div className="log-summary">
        <div><Activity size={20} /><span>Matching activities</span><b>{rows.length}</b></div>
        <div><Building2 size={20} /><span>Companies</span><b>{data.filters.companies?.length || 0}</b></div>
        <div><Filter size={20} /><span>Active filters</span><b>{Object.values(filters).filter(Boolean).length}</b></div>
      </div>
      <Panel>
        <div className="filter-bar">
          <div className="search-box"><Search size={17} /><input value={filters.search} onChange={e => setFilter("search", e.target.value)} placeholder="Search company, event or entity" /></div>
          <select value={filters.companyId} onChange={e => setFilter("companyId", e.target.value)}><option value="">All companies</option>{data.filters.companies?.map((x: any) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>
          <select value={filters.event} onChange={e => setFilter("event", e.target.value)}><option value="">All events</option>{data.filters.events?.map((x: string) => <option key={x}>{x.replaceAll("_", " ")}</option>)}</select>
          <select value={filters.entity} onChange={e => setFilter("entity", e.target.value)}><option value="">All modules</option>{data.filters.entities?.map((x: string) => <option key={x}>{x}</option>)}</select>
          <input aria-label="From date" type="date" value={filters.from} onChange={e => setFilter("from", e.target.value)} />
          <input aria-label="To date" type="date" value={filters.to} onChange={e => setFilter("to", e.target.value)} />
          <button className="clear-filter" onClick={clear}>Clear filters</button>
        </div>
        <div className="activity-feed">
          {rows.map((x: any) => (
            <article className="log-item" key={x.id}>
              <div className={`log-icon ${eventTone(x.event)}`}><Activity size={17} /></div>
              <div className="log-content">
                <div className="log-title"><b>{x.event.replaceAll("_", " ")}</b><span>{new Date(x.createdAt).toLocaleString()}</span></div>
                <p><strong>{x.company.name}</strong>{x.entity ? ` · ${x.entity}` : ""}{x.actor?.name ? ` · by ${x.actor.name}` : " · System"}</p>
                <small>{detailText(x.payload) || "No additional details"}</small>
              </div>
            </article>
          ))}
          {!rows.length && <Empty text="No activity matches the selected filters" />}
        </div>
      </Panel>
    </div>
  );
}

function PageTitle({ title, sub, action }: any) {
  return (
    <div className="page-title">
      <div>
        <h1>{title}</h1>
        <p>{sub}</p>
      </div>
      {action}
    </div>
  );
}
function Panel({ title, children }: any) {
  return (
    <section className="panel">
      {title && <h3>{title}</h3>}
      {children}
    </section>
  );
}
function Modal({ title, close, children, wide }: any) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previousOverflow; };
  }, []);
  return createPortal(
    <div className="modal-bg">
      <div className={`modal ${wide ? "wide" : ""}`}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button onClick={close}>
            <X />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}
function Notice({ children, danger }: any) {
  return <div className={`notice ${danger ? "danger" : ""}`}>{children}</div>;
}
function Badge({ children }: any) {
  const value = String(children);
  return (
    <span
      className={`badge priority-${value.toLowerCase().replaceAll("_", "-")}`}
    >
      {value.replaceAll("_", " ")}
    </span>
  );
}
function Empty({ text }: any) {
  return (
    <div className="empty">
      <BriefcaseBusiness />
      <p>{text}</p>
    </div>
  );
}
function Field({ n, l, f, c }: any) {
  return (
    <label>
      {l}
      <input name={n} className={input} value={f[n]} onChange={c} />
    </label>
  );
}
function Detail({ l, v, wide }: any) {
  return (
    <div className={`detail-item ${wide ? "wide" : ""}`}>
      <span>{l}</span>
      <b>{v || "Not provided"}</b>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={new QueryClient()}>
    <App />
  </QueryClientProvider>,
);
