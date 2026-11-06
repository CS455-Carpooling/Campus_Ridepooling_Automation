# Project Costing Report — Campus Ride-Pooling and Split-Fare System

**Course:** CS455 - Software Engineering, IIT Kanpur  
**Repository:** [CS455-Carpooling/Campus_Ridepooling_Automation](https://github.com/CS455-Carpooling/Campus_Ridepooling_Automation)  
**Production URL:** [https://campus-ridepooling-automation.onrender.com/](https://campus-ridepooling-automation.onrender.com/)  
**Costing Basis:** Estimated monthly operating cost from published prices, checked on 6 November 2026 (sources in section 8)  
**Currency:** Indian Rupees (INR) & United States Dollars (USD)  
**Exchange Rate Reference:** 1 USD = ₹94.00 INR (rounded planning rate; the reference rate was ₹94.48 on 5 November 2026)

---

## 1. Components in Our Website and Is It Costable

| Component Name | Description & Functional Scope | Is It Costable? | Cost Classification & Category |
|---|---|---|---|
| **Next.js Application** | Server-side rendering, client page layouts, UI components, and API routes for student/admin workflows. | **No** (Directly) | Hosted within the web service container; does not incur separate compute charges. |
| **Custom Node.js & Socket.IO Server** | Real-time websockets handling live ride coordination, private trip chat, and live in-app notifications. | **Yes** | Billed under Web Service Compute. On the Free tier it runs only while the service is awake. |
| **PostgreSQL Database (`crp`)** | Stores persistent records: users, rides, seat requests, trip progress, fare shares, settlements, complaints, and audit logs. | **Yes** | Billed under Managed Database Compute and Storage. Backups come with a paid compute plan. |
| **Google Gemini API Integration** | Powers natural language chatbot query parsing, ride matching recommendations, and advisory complaint analysis. | **Yes** | Billed per input and output token on the paid tier. The free tier is not billed. |
| **Google Apps Script Email Relay** | Handles verification email dispatch and password resets for `@iitk.ac.in` accounts via MailApp relay. | **No** (Current) / **Yes** (Production) | Free within standard Google account sending quotas; costable if upgraded to dedicated SMTP. |
| **GitHub & GitHub Actions** | Stores repository source code, manages deployment webhooks, and runs automated CI linting and test suites. | **No** | Standard GitHub-hosted runners are free for public repositories, and this repository is public. |
| **Docker Build Environment** | Packages Next.js, Node.js, and Socket.IO into containerized images for automated deployment. | **No** | Included within the hosting provider’s build pipeline quota. |
| **Domain & HTTPS Certificate** | Provides public domain access (`*.onrender.com`) and automated SSL/TLS encryption. | **No** (Current) / **Yes** (Production) | Render subdomain is free; custom campus domain (`.in` / `.com`) incurs annual registration fees. |

---

## 2. Current vs. Production Level Differences

| Architectural & Operational Metric | Current Setup (Course Evaluation Demo) | Production Level Setup (Full IITK Campus Deployment) |
|---|---|---|
| **Target User Base & Capacity** | 5–10 concurrent evaluator / student test accounts. | 1,000–5,000 registered student accounts; 100+ concurrent active Socket.IO connections during peak campus hours. |
| **Web Service Compute Tier** | Render Free Tier (512 MB RAM, less than 1 CPU). | Render Starter (512 MB RAM, 0.5 CPU) for the pilot; Render Standard (2 GB RAM, 1 CPU) at full scale. |
| **Web Service Availability & Uptime** | Spins down (sleeps) after 15 minutes of inactivity; ~60-second cold start latency; capped at 750 free hours/month. | Does not spin down, so there is no cold-start delay. A single instance still has no uptime guarantee; Render lists uptime SLAs under its Enterprise plan. |
| **Database Instance Tier** | Render Managed PostgreSQL Free Tier. | Render Postgres Basic-256mb (256 MB RAM, 0.1 CPU) for the pilot; Basic-1gb (1 GB RAM, 0.5 CPU) at full scale. |
| **Database Storage Limit & Expiry** | Fixed 1 GB storage limit; **expires 30 days after creation**, with a 14-day grace period before deletion. | 5 GB (pilot) to 20 GB (full scale) of expandable SSD storage; no expiry on a paid plan. |
| **Database Disaster Recovery & Backups** | **No automated backups**, no Point-In-Time-Recovery (PITR), no database snapshots. | PITR for the past 3 days on a Hobby workspace or 7 days on a Pro workspace; logical backups kept for 7 days. |
| **Google Gemini API Allocation** | Free Tier (`gemini-3.1-flash-lite`); per-project limits are shown in Google AI Studio. | Paid Pay-As-You-Go Tier. Limits rise with the usage tier but still apply. |
| **Transactional Email Delivery** | Google Apps Script + MailApp (100 recipients/day on a standard Google account). | Dedicated transactional email service: Resend Free (3,000 emails/month, 100/day) for the pilot; Resend Pro (50,000 emails/month) at full scale. |
| **Custom Domain & SSL** | Default subdomain (`campus-ridepooling-automation.onrender.com`) with shared Render SSL certificate. | Custom Domain (e.g., `ridepool.iitk.ac.in` or custom `.in` domain) with Render-managed TLS. |

---

## 3. Current vs. Production Price Comparison

> **Gemini API Token Rate Reference (`gemini-3.1-flash-lite`):**
> - **Input Token Cost:** \$0.25 per 1,000,000 tokens (≈ ₹0.0235 per 1,000 tokens)
> - **Output Token Cost:** \$1.50 per 1,000,000 tokens (≈ ₹0.1410 per 1,000 tokens)

| Cost Component | Pricing Basis / Rates | Current Setup (Monthly Cost) | Production Pilot (~1,000 Students) | Production Scale (~5,000 Students) |
|---|---|---:|---:|---:|
| **Web Service Compute** | Render Starter (\$7/mo) / Standard (\$25/mo) | ₹0 (\$0.00) | ₹658 (\$7.00) | ₹2,350 (\$25.00) |
| **Managed Database Compute** | Render Postgres Basic-256mb (\$6/mo) / Basic-1gb (\$19/mo) | ₹0 (\$0.00) | ₹564 (\$6.00) | ₹1,786 (\$19.00) |
| **Database Storage & Backups** | Paid storage at \$0.30/GB/month; backups come with the paid plan | ₹0 (\$0.00) | ₹141 (\$1.50) | ₹564 (\$6.00) |
| **Google Gemini API** | Token usage at \$0.25/1M input and \$1.50/1M output | ₹0 (\$0.00) | ₹799 (\$8.50) | ₹3,995 (\$42.50) |
| **Transactional Email Delivery** | Google Apps Script (free) / Resend Free / Resend Pro (\$20/mo) | ₹0 (\$0.00) | ₹0 (\$0.00) | ₹1,880 (\$20.00) |
| **Custom Domain Registration** | Amortized monthly cost of annual `.in` domain (~₹900/yr) | ₹0 (\$0.00) | ₹75 (\$0.80) | ₹75 (\$0.80) |
| **GitHub Actions CI/CD** | Free: standard runners on a public repository | ₹0 (\$0.00) | ₹0 (\$0.00) | ₹0 (\$0.00) |
| **Subtotal (Excl. Tax)** | Net monthly operating expense | **₹0 (\$0.00)** | **₹2,237 (\$23.80)** | **₹10,650 (\$113.30)** |
| **Applicable Taxes (18% GST)** | Statutory digital service tax in India | ₹0 (\$0.00) | ₹403 (\$4.28) | ₹1,917 (\$20.39) |
| **Final Total Monthly Cost** | Net out-of-pocket invoice cost | **₹0 (\$0.00)** | **₹2,640 (\$28.08)** | **₹12,567 (\$133.69)** |

---

## 4. Total Cost Calculation Formula

$$\text{Total Monthly Operating Cost } (C_{\text{total}}) = \left( C_{\text{web}} + C_{\text{db}} + C_{\text{storage}} + C_{\text{gemini}} + C_{\text{email}} + C_{\text{domain}} + C_{\text{ci}} \right) \times (1 + T_{\text{GST}})$$

Where:
* **$C_{\text{web}}$:** Monthly fixed instance cost for the hosting web service (Render Compute Plan).
* **$C_{\text{db}}$:** Monthly fixed compute cost for managed database hosting.
* **$C_{\text{storage}}$:** Database disk expansion fee calculated as:
  $$C_{\text{storage}} = S_{\text{data (GB)}} \times R_{\text{storage (\$0.30/GB)}}$$
* **$C_{\text{gemini}}$:** Variable AI API consumption cost on the paid tier, calculated as:
  $$C_{\text{gemini}} = \left( \frac{N_{\text{input\_tokens}}}{1,000,000} \times R_{\text{input (\$0.25)}} \right) + \left( \frac{N_{\text{output\_tokens}}}{1,000,000} \times R_{\text{output (\$1.50)}} \right)$$
* **$C_{\text{email}}$:** Monthly fee for dedicated transactional mail delivery over free limits.
* **$C_{\text{domain}}$:** Monthly amortized domain name renewal fee $\left( \frac{\text{Annual Domain Price}}{12} \right)$.
* **$C_{\text{ci}}$:** CI/CD pipeline build execution charges; zero while the repository stays public and uses standard runners.
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
* **Web Service (Starter Tier):** \$7.00 × ₹94.00 = ₹658.00  
* **PostgreSQL (Basic-256mb Tier):** \$6.00 × ₹94.00 = ₹564.00  
* **Database Storage & Backups (5 GB):** \$1.50 × ₹94.00 = ₹141.00  
* **Gemini API Usage:**  
  * *Assumptions:* 20,000 API calls/month (matching recommendations, chatbot queries, complaint triage).  
  * *Input Tokens:* 20,000 calls × 500 tokens = 10,000,000 tokens, so (10,000,000 / 1,000,000) × \$0.25 = \$2.50 (₹235.00).  
  * *Output Tokens:* 20,000 calls × 200 tokens = 4,000,000 tokens, so (4,000,000 / 1,000,000) × \$1.50 = \$6.00 (₹564.00).  
  * *Gemini Subtotal:* \$8.50 × ₹94.00 = ₹799.00  
* **Email Delivery (Resend Free, under 3,000 emails/month and 100/day):** ₹0.00  
* **Custom Domain (.in registration amortized):** ₹900.00 / 12 = ₹75.00  
* **Subtotal:** ₹658 + ₹564 + ₹141 + ₹799 + ₹0 + ₹75 = ₹2,237.00 (\$23.80)  
* **GST @ 18%:** ₹2,237.00 × 0.18 = ₹402.66 ≈ ₹403.00 (\$4.28)  
* **Final Production Pilot Total:** **₹2,640.00 / month** (\$28.08 / month)

---

### 5.3 Production Full-Scale Setup (~5,000 Students)
* **Web Service (Standard Tier):** \$25.00 × ₹94.00 = ₹2,350.00  
* **PostgreSQL (Basic-1gb Tier):** \$19.00 × ₹94.00 = ₹1,786.00  
* **Database Storage & Backups (20 GB):** \$6.00 × ₹94.00 = ₹564.00  
* **Gemini API Usage:**  
  * *Assumptions:* 100,000 API calls/month.  
  * *Input Tokens:* 100,000 calls × 500 tokens = 50,000,000 tokens = \$12.50 (₹1,175.00).  
  * *Output Tokens:* 100,000 calls × 200 tokens = 20,000,000 tokens = \$30.00 (₹2,820.00).  
  * *Gemini Subtotal:* \$42.50 × ₹94.00 = ₹3,995.00  
* **Email Delivery Service (Resend Pro):** \$20.00 × ₹94.00 = ₹1,880.00  
* **Custom Domain:** ₹75.00  
* **Subtotal:** ₹2,350 + ₹1,786 + ₹564 + ₹3,995 + ₹1,880 + ₹75 = ₹10,650.00 (\$113.30)  
* **GST @ 18%:** ₹10,650.00 × 0.18 = ₹1,917.00 (\$20.39)  
* **Final Production Scale Total:** **₹12,567.00 / month** (\$133.69 / month)

---

## 6. Assumptions and Missing Calculations

* Exchange rate fixed at 1 USD = ₹94.00 INR.
* Statutory Goods and Services Tax (GST) rate calculated at 18% on all cloud hosting and API services.
* Gemini API token rates based on the `gemini-3.1-flash-lite` standard pay-as-you-go pricing model (\$0.25/1M input, \$1.50/1M output tokens). Output pricing includes thinking tokens.
* Average Gemini request payload modeled at 500 input tokens and 200 output tokens per transaction. This is not measured, and it is likely low: the chatbot's fixed prompt text alone is about 580 tokens, before the hub list and the rider's message. Doubling both figures would double the Gemini line, from ₹799 to ₹1,598 (pilot) and from ₹3,995 to ₹7,990 (full scale), before tax.
* Current course evaluation setup assumes total web service uptime remains within Render's 750 free monthly instance hours limit.
* A Render Hobby workspace (\$0) is assumed. A Pro workspace would add \$25/month (₹2,350 before tax) and extend PITR to 7 days.
* Developer salaries, software engineering labor, and UI/UX design costs excluded.
* Local developer workstation depreciation, personal electricity usage, and local internet connection fees excluded.
* Outbound bandwidth beyond Render's Hobby allowance (5 GB/month included, then \$0.15/GB) and data migration transfer costs excluded.
* Payment processing and transaction fees excluded (system only records offline cash/UPI settlements).
* Operational monitoring, log aggregation, and error tracking tools (Sentry/Datadog) excluded.
* Third-party SMS verification service fees excluded.

---

## 7. Estimated vs. Actual Usage

Usage of the current setup, as of 6 November 2026. "Not read" means the figure exists but was not collected for this report.

| Resource | Estimate or Free Limit | Actual | Source |
|---|---|---|---|
| **Monthly cost** | ₹0 | ₹0: the setup uses the Render Free tier, the Gemini free tier, Apps Script and a public GitHub repository. | Deployment documentation; section 3 |
| **GitHub Actions** | ₹0; standard runners are free for a public repository | 465 workflow runs and about 1,030 elapsed minutes, at ₹0. | GitHub API, 6 November 2026 |
| **Web service hours** | 750 free hours per calendar month | Not read. One service cannot pass 744 hours in a month, so it stays within the limit if it is the only free service in the workspace. | Render documentation |
| **Database** | 1 GB; expires on 5 December 2026 | Expiry falls after the 8 to 13 November presentation window. Size not read. | Deployment documentation |
| **Gemini API** | Free tier | Not read. Token counts for each call are stored in `ride_recommendation_audits`, `chatbot_audits` and `complaint_ai_analyses`. | `apps/web/db/schema.sql` |
| **Email** | 100 recipients/day | Not read. | Google Apps Script quotas |

Two controls limit the risk of exhausting the free tier. The chatbot allows each rider 20 AI requests per hour, and each AI feature has a non-AI fallback if Gemini stops responding.

---

## 8. Price Sources

All checked on 6 November 2026, except the exchange rate, which is dated 5 November 2026.

* Render: [pricing](https://render.com/pricing), [free instances](https://render.com/docs/free), [Postgres backups](https://render.com/docs/postgresql-backups), [legacy Postgres types](https://render.com/docs/postgresql-legacy-instance-types)
* Gemini API: [pricing](https://ai.google.dev/gemini-api/docs/pricing), [rate limits](https://ai.google.dev/gemini-api/docs/rate-limits)
* Resend: [pricing](https://resend.com/pricing)
* Google Apps Script: [quotas](https://developers.google.com/apps-script/guides/services/quotas)
* GitHub Actions: [billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions)
* Exchange rate: [Frankfurter API](https://www.frankfurter.dev/), which publishes European Central Bank reference rates
