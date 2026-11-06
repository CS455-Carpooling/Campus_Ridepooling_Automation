# Project Costing Report — Campus Ride-Pooling and Split-Fare System

**Course:** CS455 - Software Engineering, IIT Kanpur  
**Repository:** [CS455-Carpooling/Campus_Ridepooling_Automation](https://github.com/CS455-Carpooling/Campus_Ridepooling_Automation)  
**Production URL:** [https://campus-ridepooling-automation.onrender.com/](https://campus-ridepooling-automation.onrender.com/)  
**Costing Basis:** Verified Operating-Cost Analysis & Market Rate Assessment  
**Currency:** Indian Rupees (INR) & United States Dollars (USD)  
**Exchange Rate Reference:** 1 USD = ₹94.00 INR

---

## 1. Components in Our Website and Is It Costable

| Component Name | Description & Functional Scope | Is It Costable? | Cost Classification & Category |
|---|---|---|---|
| **Next.js Application** | Server-side rendering, client page layouts, UI components, and API routes for student/admin workflows. | **No** (Directly) | Hosted within the web service container; does not incur separate compute charges. |
| **Custom Node.js & Socket.IO Server** | Real-time websockets handling live ride coordination, private trip chat, and instant push notifications. | **Yes** | Billed under Web Service Compute (requires active, non-sleeping process). |
| **PostgreSQL Database (`crp`)** | Stores persistent records: users, rides, seat requests, trip progress, fare shares, settlements, complaints, and audit logs. | **Yes** | Billed under Managed Database Compute, Storage, and Backup add-ons. |
| **Google Gemini API Integration** | Powers natural language chatbot query parsing, ride matching recommendations, and advisory complaint analysis. | **Yes** | Billed per token (input/output) beyond the free tier quota. |
| **Google Apps Script Email Relay** | Handles verification email dispatch and password resets for `@iitk.ac.in` accounts via MailApp relay. | **No** (Current) / **Yes** (Production) | Free within standard Google account sending quotas; costable if upgraded to dedicated SMTP. |
| **GitHub & GitHub Actions** | Stores repository source code, manages deployment webhooks, and runs automated CI linting and test suites. | **No** | Free for public repositories within included GitHub Actions monthly minute allowances. |
| **Docker Build Environment** | Packages Next.js, Node.js, and Socket.IO into containerized images for automated deployment. | **No** | Included within the hosting provider’s build pipeline quota. |
| **Domain & HTTPS Certificate** | Provides public domain access (`*.onrender.com`) and automated SSL/TLS encryption. | **No** (Current) / **Yes** (Production) | Render subdomain is free; custom campus domain (`.in` / `.com`) incurs annual registration fees. |

---

## 2. Current vs. Production Level Differences

| Architectural & Operational Metric | Current Setup (Course Evaluation Demo) | Production Level Setup (Full IITK Campus Deployment) |
|---|---|---|
| **Target User Base & Capacity** | 5–10 concurrent evaluator / student test accounts. | 1,000–5,000 registered student accounts; 100+ concurrent active Socket.IO connections during peak campus hours. |
| **Web Service Compute Tier** | Render Free Tier (512 MB RAM, shared CPU). | Render Starter / Standard Paid Tier (1 GB–2 GB RAM, 1 CPU core). |
| **Web Service Availability & Uptime** | Spins down (sleeps) after 15 minutes of inactivity; ~60-second cold start latency; capped at 750 free hours/month. | 100% Always-On uptime; zero cold-start delay; dedicated CPU allocation for real-time WebSocket connections. |
| **Database Instance Tier** | Render Managed PostgreSQL Free Tier. | Render Managed PostgreSQL Paid Basic/Standard Tier. |
| **Database Storage Limit & Expiry** | Fixed 1 GB storage limit; **strict 30-day lifecycle limit** (database expires and deletes automatically). | 10 GB–50 GB auto-scaling SSD storage; permanent persistent retention with zero deletion risk. |
| **Database Disaster Recovery & Backups** | **No automated backups**, no Point-In-Time-Recovery (PITR), no database snapshots. | Automated daily snapshots, 7 to 30-day backup retention, and WAL-based point-in-time recovery. |
| **Google Gemini API Allocation** | Free Tier (`gemini-3.1-flash-lite` / `gemini-2.5-flash-lite`: 15 RPM, 1,500 RPD cap). | Paid Pay-As-You-Go Tier (unlimited daily requests, higher RPM/TPM limits for peak usage). |
| **Transactional Email Delivery** | Google Apps Script + MailApp (~100 emails/day standard Gmail daily quota). | Dedicated Transactional Email Service (Resend / AWS SES; 3,000–10,000+ emails/month with delivery logs). |
| **Custom Domain & SSL** | Default subdomain (`campus-ridepooling-automation.onrender.com`) with shared Render SSL certificate. | Custom Domain (e.g., `ridepool.iitk.ac.in` or custom `.in` domain) with dedicated custom SSL. |

---

## 3. Current vs. Production Price Comparison

> **Gemini API Token Rate Reference (`gemini-3.1-flash-lite`):**
> - **Input Token Cost:** $0.25 per 1,000,000 tokens (≈ ₹0.0235 per 1,000 tokens)
> - **Output Token Cost:** $1.50 per 1,000,000 tokens (≈ ₹0.1410 per 1,000 tokens)

| Cost Component | Pricing Basis / Rates | Current Setup (Monthly Cost) | Production Pilot (~1,000 Students) | Production Scale (~5,000 Students) |
|---|---|---:|---:|---:|
| **Web Service Compute** | Render Starter ($7/mo) / Standard ($25/mo) | ₹0 ($0.00) | ₹658 ($7.00) | ₹2,350 ($25.00) |
| **Managed Database Compute** | Render Postgres Basic-1GB ($6/mo) / Standard ($20/mo) | ₹0 ($0.00) | ₹564 ($6.00) | ₹1,880 ($20.00) |
| **Database Storage & Backups** | Paid storage @ $0.30/GB/month + automated backups | ₹0 ($0.00) | ₹141 ($1.50) | ₹564 ($6.00) |
| **Google Gemini API** | Token usage based on $0.25/1M in & $1.50/1M out | ₹0 ($0.00) | ₹799 ($8.50) | ₹3,995 ($42.50) |
| **Transactional Email Delivery** | Google Apps Script (Free) / Resend / AWS SES | ₹0 ($0.00) | ₹0 ($0.00) | ₹1,410 ($15.00) |
| **Custom Domain Registration** | Amortized monthly cost of annual `.in` domain (~₹900/yr) | ₹0 ($0.00) | ₹75 ($0.80) | ₹75 ($0.80) |
| **GitHub Actions CI/CD** | 2,000 free minutes/month allowance | ₹0 ($0.00) | ₹0 ($0.00) | ₹0 ($0.00) |
| **Subtotal (Excl. Tax)** | Net monthly operating expense | **₹0 ($0.00)** | **₹2,237 ($23.80)** | **₹10,274 ($109.30)** |
| **Applicable Taxes (18% GST)** | Statutory digital service tax in India | ₹0 ($0.00) | ₹403 ($4.28) | ₹1,849 ($19.67) |
| **Final Total Monthly Cost** | Net out-of-pocket invoice cost | **₹0 ($0.00)** | **₹2,640 ($28.08)** | **₹12,123 ($128.97)** |

---

## 4. Total Cost Calculation Formula

$$\text{Total Monthly Operating Cost } (C_{\text{total}}) = \left( C_{\text{web}} + C_{\text{db}} + C_{\text{storage}} + C_{\text{gemini}} + C_{\text{email}} + C_{\text{domain}} + C_{\text{ci}} \right) \times (1 + T_{\text{GST}})$$

Where:
* **$C_{\text{web}}$:** Monthly fixed instance cost for the hosting web service (Render Compute Plan).
* **$C_{\text{db}}$:** Monthly fixed compute cost for managed database hosting.
* **$C_{\text{storage}}$:** Database disk expansion fee calculated as:
  $$C_{\text{storage}} = S_{\text{data (GB)}} \times R_{\text{storage (\$0.30/GB)}} + C_{\text{backup}}$$
* **$C_{\text{gemini}}$:** Variable AI API consumption cost calculated as:
  $$C_{\text{gemini}} = \left( \frac{N_{\text{input\_tokens}}}{1,000,000} \times R_{\text{input (\$0.25)}} \right) + \left( \frac{N_{\text{output\_tokens}}}{1,000,000} \times R_{\text{output (\$1.50)}} \right) - \text{Free Quota Allowance}$$
* **$C_{\text{email}}$:** Monthly fee for dedicated transactional mail delivery over free limits.
* **$C_{\text{domain}}$:** Monthly amortized domain name renewal fee $\left( \frac{\text{Annual Domain Price}}{12} \right)$.
* **$C_{\text{ci}}$:** CI/CD pipeline build execution charges beyond the 2,000 free monthly minutes quota.
* **$T_{\text{GST}}$:** Applicable Goods and Services Tax rate (18% or $0.18$).

---

## 5. Final Total Calculations

### 5.1 Current Course-Demo Setup
* Web Service Compute: ₹0.00  
* PostgreSQL Database: ₹0.00  
* Gemini API Usage: ₹0.00  
* Email Relay: ₹0.00  
* Custom Domain: ₹0.00  
* **Subtotal:** ₹0.00  
* **GST (18%):** ₹0.00  
* **Final Current Total:** **₹0.00 / month**

---

### 5.2 Production Pilot Setup (~1,000 Students)
* **Web Service (Starter Tier):** $7.00 \times ₹94.00 = \text{₹658.00}$  
* **PostgreSQL (Basic-1GB Tier):** $6.00 \times ₹94.00 = \text{₹564.00}$  
* **Database Storage & Backups (5 GB):** $1.50 \times ₹94.00 = \text{₹141.00}$  
* **Gemini API Usage:**  
  * *Assumptions:* 20,000 API calls/month (matching recommendations, chatbot queries, complaint triage).  
  * *Input Tokens:* $20,000 \text{ calls} \times 500 \text{ tokens} = 10,000,000 \text{ tokens}$.  
    $$\text{Cost} = \left( \frac{10,000,000}{1,000,000} \right) \times \$0.25 = \$2.50 \quad (\text{₹235.00})$$
  * *Output Tokens:* $20,000 \text{ calls} \times 200 \text{ tokens} = 4,000,000 \text{ tokens}$.  
    $$\text{Cost} = \left( \frac{4,000,000}{1,000,000} \right) \times \$1.50 = \$6.00 \quad (\text{₹564.00})$$
  * *Gemini Subtotal:* $\$8.50 \times ₹94.00 = \text{₹799.00}$  
* **Email Delivery (Resend Free Tier <3k emails/mo):** ₹0.00  
* **Custom Domain (.in registration amortized):** $\frac{\text{₹900.00}}{12} = \text{₹75.00}$  
* **Subtotal:** $\text{₹658} + \text{₹564} + \text{₹141} + \text{₹799} + \text{₹0} + \text{₹75} = \text{₹2,237.00}$ ($23.80)  
* **GST @ 18%:** $\text{₹2,237.00} \times 0.18 = \text{₹402.66} \approx \text{₹403.00}$ ($4.28)  
* **Final Production Pilot Total:** **₹2,640.00 / month** ($28.08 / month)

---

### 5.3 Production Full-Scale Setup (~5,000 Students)
* **Web Service (Standard Tier):** $25.00 \times ₹94.00 = \text{₹2,350.00}$  
* **PostgreSQL (Standard DB Tier):** $20.00 \times ₹94.00 = \text{₹1,880.00}$  
* **Database Storage & Backups (20 GB):** $6.00 \times ₹94.00 = \text{₹564.00}$  
* **Gemini API Usage:**  
  * *Assumptions:* 100,000 API calls/month.  
  * *Input Tokens:* $100,000 \text{ calls} \times 500 \text{ tokens} = 50,000,000 \text{ tokens} = \$12.50 \quad (\text{₹1,175.00})$. 
  * *Output Tokens:* $100,000 \text{ calls} \times 200 \text{ tokens} = 20,000,000 \text{ tokens} = \$30.00 \quad (\text{₹2,820.00})$. 
  * *Gemini Subtotal:* $\$42.50 \times ₹94.00 = \text{₹3,995.00}$  
* **Email Delivery Service (Paid Tier):** $15.00 \times ₹94.00 = \text{₹1,410.00}$  
* **Custom Domain:** ₹75.00  
* **Subtotal:** $\text{₹2,350} + \text{₹1,880} + \text{₹564} + \text{₹3,995} + \text{₹1,410} + \text{₹75} = \text{₹10,274.00}$ ($109.30)  
* **GST @ 18%:** $\text{₹10,274.00} \times 0.18 = \text{₹1,849.32} \approx \text{₹1,849.00}$ ($19.67)  
* **Final Production Scale Total:** **₹12,123.00 / month** ($128.97 / month)

---

## 6. Assumptions and Missing Calculations

* Exchange rate fixed at 1 USD = ₹94.00 INR.
* Statutory Goods and Services Tax (GST) rate calculated at 18% on all cloud hosting and API services.
* Gemini API token rates based on the `gemini-3.1-flash-lite` standard pay-as-you-go pricing model ( \$0.25/1M , \$1.50/1M output tokens).
* Average Gemini request payload modeled at 500 input tokens and 200 output tokens per transaction.
* Current course evaluation setup assumes total web service uptime remains within Render's 750 free monthly instance hours limit.
* Developer salaries, software engineering labor, and UI/UX design costs excluded.
* Local developer workstation depreciation, personal electricity usage, and local internet connection fees excluded.
* Egress network bandwidth fees and data migration transfer costs excluded.
* Payment processing and transaction fees excluded (system only records offline cash/UPI settlements).
* Operational monitoring, log aggregation, and error tracking tools (Sentry/Datadog) excluded.
* Third-party SMS verification service fees excluded.


