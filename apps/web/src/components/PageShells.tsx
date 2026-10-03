"use client";

import { FormEvent, ReactNode, useState } from "react";

export type Page = "home" | "register" | "login" | "forgot" | "reset";
type IconName =
  | "arrow"
  | "calendar"
  | "car"
  | "check"
  | "chevron"
  | "clock"
  | "eye"
  | "mail"
  | "moon"
  | "people"
  | "pin"
  | "route"
  | "shield"
  | "spark"
  | "sun"
  | "user";

const iconPaths: Record<IconName, ReactNode> = {
  arrow: <path d="M5 12h14m-5-5 5 5-5 5" />,
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M16 3v4M8 3v4M3 10h18" />
    </>
  ),
  car: (
    <>
      <path d="m5 11 1.4-4.2A2 2 0 0 1 8.3 5h7.4a2 2 0 0 1 1.9 1.4L19 11" />
      <path d="M3 12a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v5H3v-5ZM5 17v2M19 17v2" />
      <circle cx="7" cy="14" r="1" />
      <circle cx="17" cy="14" r="1" />
    </>
  ),
  check: <path d="m5 12 4 4L19 6" />,
  chevron: <path d="m9 18 6-6-6-6" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  eye: (
    <>
      <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" />
      <circle cx="12" cy="12" r="2.5" />
    </>
  ),
  mail: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m4 7 8 6 8-6" />
    </>
  ),
  moon: <path d="M20 15.5A8.5 8.5 0 0 1 8.5 4 8.5 8.5 0 1 0 20 15.5Z" />,
  people: (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M3 19a6 6 0 0 1 12 0M16 5.5a3 3 0 0 1 0 5.8M17 14a5 5 0 0 1 4 5" />
    </>
  ),
  pin: (
    <>
      <path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" />
      <circle cx="12" cy="10" r="2.5" />
    </>
  ),
  route: (
    <>
      <circle cx="6" cy="18" r="2" />
      <circle cx="18" cy="6" r="2" />
      <path d="M8 18h2a2 2 0 0 0 2-2V8a2 2 0 0 1 2-2h2" />
    </>
  ),
  shield: <path d="M12 22s8-3.5 8-10V5l-8-3-8 3v7c0 6.5 8 10 8 10Zm-3-10 2 2 4-4" />,
  spark: <path d="m12 3 1.4 4.1L17.5 8.5l-4.1 1.4L12 14l-1.4-4.1-4.1-1.4 4.1-1.4L12 3Zm6 11 .8 2.2L21 17l-2.2.8L18 20l-.8-2.2L15 17l2.2-.8L18 14Z" />,
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </>
  ),
};

function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height={size}
      viewBox="0 0 24 24"
      width={size}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
    >
      {iconPaths[name]}
    </svg>
  );
}

function Logo({ onClick }: { onClick?: () => void }) {
  return (
    <button className="logo" onClick={onClick} aria-label="Go to home">
      <span className="logo-mark">
        <Icon name="route" size={21} />
      </span>
      <span>Campus Ride <span>Pooling</span></span>
    </button>
  );
}

function ThemeToggle({
  dark,
  setDark,
}: {
  dark: boolean;
  setDark: (dark: boolean) => void;
}) {
  return (
    <button
      className="theme-toggle"
      onClick={() => setDark(!dark)}
      aria-label={`Switch to ${dark ? "light" : "dark"} mode`}
      title={`Switch to ${dark ? "light" : "dark"} mode`}
    >
      <Icon name={dark ? "sun" : "moon"} size={18} />
    </button>
  );
}

export function Landing({
  dark,
  setDark,
  go,
}: {
  dark: boolean;
  setDark: (value: boolean) => void;
  go: (page: Page) => void;
}) {
  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="landing">
      <header className="nav shell">
        <Logo onClick={() => go("home")} />
        <nav className="nav-links" aria-label="Main navigation">
          <button onClick={() => scrollToSection("how-it-works")}>How it works</button>
          <button onClick={() => scrollToSection("safety")}>Safety</button>
          <button onClick={() => scrollToSection("community")}>Campus points</button>
        </nav>
        <div className="nav-actions">
          <ThemeToggle dark={dark} setDark={setDark} />
          <button className="text-button" onClick={() => go("login")}>Log in</button>
          <button className="button button-sm" onClick={() => go("register")}>
            Join the ride <Icon name="arrow" size={17} />
          </button>
        </div>
      </header>

      <main>
        <section className="hero shell">
          <div className="hero-copy">
            <div className="eyebrow">
              <span><Icon name="spark" size={15} /></span>
              Built for the IITK community
            </div>
            <h1>Share the ride.<br /><em>Own the journey.</em></h1>
            <p>
              The trusted carpool network for IIT Kanpur. Find your people,
              split the fare, and make every trip beyond campus better.
            </p>
            <div className="hero-actions">
              <button className="button button-lg" onClick={() => go("register")}>
                Find your next ride <Icon name="arrow" size={19} />
              </button>
              <button className="play-link" onClick={() => scrollToSection("how-it-works")}>
                <span className="play">▶</span> See how it works
              </button>
            </div>
            <div className="course-project">
              <span><Icon name="shield" size={17} /></span>
              <div>
                <strong>CS455 · Software Engineering</strong>
                <small>A course project at IIT Kanpur</small>
              </div>
            </div>
          </div>

          <div className="hero-visual" aria-label="Featured upcoming ride">
            <div className="orbit orbit-one" />
            <div className="orbit orbit-two" />
            <div className="floating-note note-top">
              <span className="note-icon"><Icon name="shield" size={18} /></span>
              <span><b>IITK verified</b><small>Safe campus community</small></span>
            </div>
            <div className="ride-card">
              <div className="ride-card-head">
                <div>
                  <span className="card-kicker">Next ride</span>
                  <h3>Leaving campus</h3>
                </div>
                <span className="available">3 seats</span>
              </div>
              <div className="route">
                <div className="route-dots">
                  <span /><i /><i /><i /><b />
                </div>
                <div className="route-details">
                  <div>
                    <strong>IIT Kanpur</strong>
                    <span>Hall 3 parking</span>
                  </div>
                  <div>
                    <strong>Lucknow Airport</strong>
                    <span>Terminal 3</span>
                  </div>
                </div>
              </div>
              <div className="trip-meta">
                <span><Icon name="calendar" size={17} /> Sat, 24 Aug</span>
                <span><Icon name="clock" size={17} /> 6:30 AM</span>
              </div>
              <div className="driver">
                <div className="driver-avatar">AV</div>
                <div><strong>Arjun Verma</strong><span>Y22 · Computer Science</span></div>
                <div className="price"><strong>₹320</strong><span>/ seat</span></div>
              </div>
              <button className="card-button">View ride details <Icon name="chevron" size={17} /></button>
            </div>
            <div className="floating-note note-bottom">
              <span className="tiny-avatars"><i>MP</i><i>RS</i></span>
              <span><b>2 joined</b><small>Going your way</small></span>
            </div>
          </div>
        </section>

        <section className="how shell" id="how-it-works">
          <div className="section-heading">
            <span className="section-label">SIMPLE BY DESIGN</span>
            <h2>From campus to anywhere,<br />in three easy steps.</h2>
            <p>Less planning, more going. Campus Ride Pooling connects you with verified students headed in the same direction.</p>
          </div>
          <div className="feature-grid">
            <article>
              <span className="feature-number">01</span>
              <div className="feature-icon coral"><Icon name="pin" size={25} /></div>
              <h3>Tell us where</h3>
              <p>Post a trip or search rides by destination, date, and time.</p>
            </article>
            <article>
              <span className="feature-number">02</span>
              <div className="feature-icon lime"><Icon name="people" size={25} /></div>
              <h3>Match with IITK</h3>
              <p>Connect only with verified members of our campus community.</p>
            </article>
            <article id="safety">
              <span className="feature-number">03</span>
              <div className="feature-icon blue"><Icon name="car" size={25} /></div>
              <h3>Ride & save</h3>
              <p>Share the route, split costs fairly, and arrive together.</p>
            </article>
          </div>
          <div className="campus-points" id="community">
            <div className="campus-points-copy">
              <span className="campus-pin"><Icon name="pin" size={20} /></span>
              <div>
                <strong>Meet where campus knows you</strong>
                <small>Choose familiar, easy-to-find IITK pickup points.</small>
              </div>
            </div>
            <div className="point-list">
              <span>Hall 3</span>
              <span>Shopping Centre</span>
              <span>Main Gate</span>
              <span>Visitors&apos; Hostel</span>
            </div>
          </div>
        </section>

        <section className="cta shell">
          <div className="cta-copy">
            <span className="section-label">YOUR NEXT TRIP STARTS HERE</span>
            <h2>Going somewhere?<br /><em>Don't go alone.</em></h2>
            <p>Find a ride or offer your empty seats to someone from IITK heading the same way.</p>
          </div>
          <div className="cta-action">
            <div className="cta-route-art" aria-hidden="true">
              <span className="cta-point"><Icon name="pin" size={16} /></span>
              <span className="cta-track"><i /><i /><i /></span>
              <span className="cta-car"><Icon name="car" size={21} /></span>
            </div>
            <button className="button button-light button-lg" onClick={() => go("register")}>
              Join Campus Ride Pooling <Icon name="arrow" size={19} />
            </button>
          </div>
        </section>
      </main>

      <footer className="footer shell">
        <Logo onClick={() => go("home")} />
        <p>A CS455 Software Engineering course project at IIT Kanpur.</p>
        <div>
          <button onClick={() => scrollToSection("safety")}>Safety</button>
          <button onClick={() => scrollToSection("community")}>Campus points</button>
          <a href="mailto:campusridepooling@iitk.ac.in">Contact</a>
        </div>
      </footer>
    </div>
  );
}

function Field({
  icon,
  label,
  name,
  placeholder,
  type = "text",
  autoComplete,
  minLength,
}: {
  icon: IconName;
  label: string;
  name: string;
  placeholder: string;
  type?: string;
  autoComplete?: string;
  minLength?: number;
}) {
  const [show, setShow] = useState(false);
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <span className="input-wrap">
        <Icon name={icon} size={19} />
        <input
          name={name}
          type={show ? "text" : type}
          placeholder={placeholder}
          autoComplete={autoComplete}
          minLength={minLength}
          maxLength={type === "password" ? 128 : type === "email" ? 254 : 80}
          // "\\-" keeps the pattern valid under the browser's unicode-sets (v) mode
          pattern={type === "email" ? "[A-Za-z0-9._%+\\-]+@iitk\\.ac\\.in" : undefined}
          title={type === "email" ? "Please use your @iitk.ac.in email address" : undefined}
          required
        />
        {type === "password" && (
          <button type="button" onClick={() => setShow(!show)} aria-label="Toggle password visibility">
            <Icon name="eye" size={18} />
          </button>
        )}
      </span>
    </label>
  );
}

function noticeFor(key?: string): { ok: boolean; text: string } | null {
  switch (key) {
    case "verified":
      return { ok: true, text: "Email verified. You can log in now." };
    case "verify_failed":
      return { ok: false, text: "That verification link is invalid or expired. Register again with the same email to get a new one." };
    default:
      return null;
  }
}

export function AuthPage({
  page,
  dark,
  setDark,
  go,
  notice,
  token,
}: {
  page: Exclude<Page, "home">;
  dark: boolean;
  setDark: (value: boolean) => void;
  go: (page: Page) => void;
  notice?: string;
  token?: string;
}) {
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (loading) return;
    const form = new FormData(event.currentTarget);
    const payload: Record<string, unknown> = Object.fromEntries(form.entries());
    payload.remember = form.get("remember") === "on";
    payload.terms = form.get("terms") === "on";
    if (page === "reset") {
      if (payload.password !== payload.confirm) return setError("Passwords do not match.");
      payload.token = token;
      delete payload.confirm;
    }

    setError("");
    setLoading(true);
    try {
      const res = await fetch(`/api/auth/${page}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return setError(data.error ?? "Something went wrong. Please try again.");
      if (page === "login") window.location.assign("/dashboard");
      else setDone(true);
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  const content = {
    login: {
      eyebrow: "WELCOME BACK",
      title: "Ready for your next trip?",
      subtitle: "Sign in to find rides, manage bookings, and see where your friends are headed.",
    },
    register: {
      eyebrow: "JOIN THE COMMUNITY",
      title: "Your campus. Your people. Your ride.",
      subtitle: "Create your verified Campus Ride Pooling account and make every journey beyond IITK count.",
    },
    forgot: {
      eyebrow: "RESET PASSWORD",
      title: "Let's get you back on the road.",
      subtitle: "Enter your registered IITK email and we'll send you a secure reset link.",
    },
    reset: {
      eyebrow: "NEW PASSWORD",
      title: "Choose a new password.",
      subtitle: "Pick something strong that you don't use anywhere else.",
    },
  }[page];

  const success = {
    login: { title: "", text: "" },
    register: { title: "Verify your email", text: "We've sent a verification link to your IITK email. Open it to activate your account (valid for 24 hours)." },
    forgot: { title: "Check your inbox", text: "If an account exists for that email, we've sent a reset link. It expires in 30 minutes." },
    reset: { title: "Password updated", text: "Your password has been changed and all other sessions were signed out." },
  }[page];

  const banner = error ? { ok: false, text: error } : page === "login" ? noticeFor(notice) : null;

  return (
    <div className="auth-layout">
      <aside className="auth-aside">
        <Logo onClick={() => go("home")} />
        <div className="aside-content">
          <div className="aside-badge"><Icon name="spark" size={16} /> ONLY AT IIT KANPUR</div>
          <blockquote>“Some of the best campus stories begin with a shared ride.”</blockquote>
          <div className="mini-route">
            <span className="mini-pin"><Icon name="pin" size={19} /></span>
            <div><b>IIT Kanpur</b><small>Starting point</small></div>
            <span className="dash" />
            <span className="mini-car"><Icon name="car" size={21} /></span>
            <span className="dash" />
            <div><b>Anywhere</b><small>Go together</small></div>
          </div>
        </div>
        <p className="aside-footer">Verified community <span>•</span> Safer rides <span>•</span> Better journeys</p>
        <div className="road-line one" />
        <div className="road-line two" />
      </aside>

      <main className="auth-main">
        <div className="auth-top">
          <button className="back-button" onClick={() => go(page === "forgot" || page === "reset" ? "login" : "home")}>
            <span>←</span> Back
          </button>
          <ThemeToggle dark={dark} setDark={setDark} />
        </div>
        <div className="auth-form-wrap">
          <div className="auth-heading">
            <span>{content.eyebrow}</span>
            <h1>{content.title}</h1>
            <p>{content.subtitle}</p>
          </div>
          {page === "register" && !done && (
            <div className="iitk-only">
              <span><Icon name="shield" size={18} /></span>
              <div>
                <strong>IITK accounts only</strong>
                <small>Registration requires an active @iitk.ac.in email address.</small>
              </div>
            </div>
          )}

          {done ? (
            <div className="success-card">
              <span><Icon name="check" size={28} /></span>
              <h2>{success.title}</h2>
              <p>{success.text}</p>
              <button className="button form-submit" onClick={() => go("login")}>
                Return to login <Icon name="arrow" size={18} />
              </button>
            </div>
          ) : (
            <form onSubmit={submit}>
              {banner && (
                <p role="alert" className={`form-banner ${banner.ok ? "ok" : "bad"}`}>{banner.text}</p>
              )}
              {page === "register" && (
                <div className="field-row">
                  <Field icon="user" label="Full name" name="name" placeholder="Aarav Sharma" autoComplete="name" />
                  <Field icon="people" label="Roll number" name="roll" placeholder="220123" autoComplete="off" />
                </div>
              )}
              {page !== "reset" && (
                <Field icon="mail" label="IITK email address" name="email" placeholder="username@iitk.ac.in" type="email" autoComplete="email" />
              )}
              {page !== "forgot" && (
                <Field
                  icon="shield"
                  label={page === "reset" ? "New password" : "Password"}
                  name="password"
                  placeholder="At least 8 characters"
                  type="password"
                  autoComplete={page === "login" ? "current-password" : "new-password"}
                  minLength={page === "login" ? undefined : 8}
                />
              )}
              {page === "reset" && (
                <Field icon="shield" label="Confirm new password" name="confirm" placeholder="Repeat your password" type="password" autoComplete="new-password" minLength={8} />
              )}
              {page === "login" && (
                <div className="form-options">
                  <label><input type="checkbox" name="remember" /> <span>Keep me signed in</span></label>
                  <button type="button" onClick={() => go("forgot")}>Forgot password?</button>
                </div>
              )}
              {page === "register" && (
                <label className="terms">
                  <input type="checkbox" name="terms" required />
                  <span>I agree to the <button type="button">community guidelines</button> and <button type="button">privacy policy</button>.</span>
                </label>
              )}
              <button className="button form-submit" type="submit" disabled={loading}>
                {loading
                  ? "Please wait…"
                  : page === "login"
                  ? "Log in to Campus Ride Pooling"
                  : page === "register"
                  ? "Create my account"
                  : page === "forgot"
                  ? "Send reset link"
                  : "Update password"}
                {!loading && <Icon name="arrow" size={18} />}
              </button>
            </form>
          )}

          {!done && page !== "reset" && (
            <p className="auth-switch">
              {page === "login" ? "New to Campus Ride Pooling?" : page === "register" ? "Already have an account?" : "Remember your password?"}
              {" "}
              <button onClick={() => go(page === "login" ? "register" : "login")}>
                {page === "login" ? "Create an account" : "Log in"}
              </button>
            </p>
          )}
          <p className="secure-note"><Icon name="shield" size={14} /> Secured with IITK email verification</p>
        </div>
      </main>
    </div>
  );
}
