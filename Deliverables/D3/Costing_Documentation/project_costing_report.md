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
| **Google Gemini API** | Token usage at \$0.25/1M input and \$1.50/1M output | ₹0 (\$0.00) | ₹1,034 (\$11.00) | ₹5,170 (\$55.00) |
| **Transactional Email Delivery** | Google Apps Script (free) / Resend Free / Resend Pro (\$20/mo) | ₹0 (\$0.00) | ₹0 (\$0.00) | ₹1,880 (\$20.00) |
| **Custom Domain Registration** | Amortized monthly cost of annual `.in` domain (~₹900/yr) | ₹0 (\$0.00) | ₹75 (\$0.80) | ₹75 (\$0.80) |
| **GitHub Actions CI/CD** | Free: standard runners on a public repository | ₹0 (\$0.00) | ₹0 (\$0.00) | ₹0 (\$0.00) |
| **Subtotal (Excl. Tax)** | Net monthly operating expense | **₹0 (\$0.00)** | **₹2,472 (\$26.30)** | **₹11,825 (\$125.80)** |
| **Applicable Taxes (18% GST)** | Statutory digital service tax in India | ₹0 (\$0.00) | ₹445 (\$4.73) | ₹2,129 (\$22.64) |
| **Final Total Monthly Cost** | Net out-of-pocket invoice cost | **₹0 (\$0.00)** | **₹2,917 (\$31.03)** | **₹13,954 (\$148.44)** |

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
  * *Input Tokens:* 20,000 calls × 1,000 tokens = 20,000,000 tokens, so (20,000,000 / 1,000,000) × \$0.25 = \$5.00 (₹470.00).  
  * *Output Tokens:* 20,000 calls × 200 tokens = 4,000,000 tokens, so (4,000,000 / 1,000,000) × \$1.50 = \$6.00 (₹564.00).  
  * *Gemini Subtotal:* \$11.00 × ₹94.00 = ₹1,034.00  
* **Email Delivery (Resend Free, under 3,000 emails/month and 100/day):** ₹0.00  
* **Custom Domain (.in registration amortized):** ₹900.00 / 12 = ₹75.00  
* **Subtotal:** ₹658 + ₹564 + ₹141 + ₹1,034 + ₹0 + ₹75 = ₹2,472.00 (\$26.30)  
* **GST @ 18%:** ₹2,472.00 × 0.18 = ₹444.96 ≈ ₹445.00 (\$4.73)  
* **Final Production Pilot Total:** **₹2,917.00 / month** (\$31.03 / month)

---

### 5.3 Production Full-Scale Setup (~5,000 Students)
* **Web Service (Standard Tier):** \$25.00 × ₹94.00 = ₹2,350.00  
* **PostgreSQL (Basic-1gb Tier):** \$19.00 × ₹94.00 = ₹1,786.00  
* **Database Storage & Backups (20 GB):** \$6.00 × ₹94.00 = ₹564.00  
* **Gemini API Usage:**  
  * *Assumptions:* 100,000 API calls/month.  
  * *Input Tokens:* 100,000 calls × 1,000 tokens = 100,000,000 tokens = \$25.00 (₹2,350.00).  
  * *Output Tokens:* 100,000 calls × 200 tokens = 20,000,000 tokens = \$30.00 (₹2,820.00).  
  * *Gemini Subtotal:* \$55.00 × ₹94.00 = ₹5,170.00  
* **Email Delivery Service (Resend Pro):** \$20.00 × ₹94.00 = ₹1,880.00  
* **Custom Domain:** ₹75.00  
* **Subtotal:** ₹2,350 + ₹1,786 + ₹564 + ₹5,170 + ₹1,880 + ₹75 = ₹11,825.00 (\$125.80)  
* **GST @ 18%:** ₹11,825.00 × 0.18 = ₹2,128.50 ≈ ₹2,129.00 (\$22.64)  
* **Final Production Scale Total:** **₹13,954.00 / month** (\$148.44 / month)

---

## 6. Assumptions and Missing Calculations

* Exchange rate fixed at 1 USD = ₹94.00 INR.
* Statutory Goods and Services Tax (GST) rate calculated at 18% on all cloud hosting and API services.
* Gemini API token rates based on the `gemini-3.1-flash-lite` standard pay-as-you-go pricing model (\$0.25/1M input, \$1.50/1M output tokens). Output pricing includes thinking tokens.
* Average Gemini request modeled at 1,000 input tokens and 200 output tokens per call. The input figure comes from the requests the code really builds, captured on 6 November 2026 and counted at about 4 characters per token: about 930 tokens for a chatbot query, 900 to 1,370 for ranking 5 to 10 rides, and 330 for a complaint. A ranking call grows with its candidates, to about 5,000 tokens at the search limit of 50 rides. The output figure is not measured. Doubling it would add ₹564 (pilot) and ₹2,820 (full scale) before tax.
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

Usage of the current setup, as of 6 November 2026. "Not read" means the figure sits in a provider's dashboard or the production database, which were not accessed for this report.

| Resource | Estimate or Free Limit | Actual | Source |
|---|---|---|---|
| **Monthly cost** | ₹0 | Render Free tier, Apps Script and a public GitHub repository cost ₹0. Gemini is modeled on its free tier; its billing console was not checked. | Deployment documentation; section 3 |
| **GitHub Actions** | ₹0; standard runners are free for a public repository | 468 workflow runs and about 1,040 elapsed minutes, at ₹0. | GitHub API, 6 November 2026 |
| **Web service hours** | 750 free hours per calendar month | At most 48 hours so far this month, because the service was first deployed on 5 November. One service cannot pass 744 hours in a month, so it stays within the limit if it is the only free service in the workspace. | Deployment documentation; Render documentation |
| **Cold start** | About 60 seconds | 33 seconds from sleep and 0.9 seconds awake, from one `/api/health` request each. | Measured on 6 November 2026 |
| **Database** | 1 GB; expires on 5 December 2026 | Expiry falls after the 8 to 13 November presentation window. A freshly migrated database is about 11 MB, roughly 1% of the limit. Production size not read. | Deployment documentation; local PostgreSQL 16 |
| **Gemini API** | Free tier | Not read. Token counts for each production call are stored in `ride_recommendation_audits`, `chatbot_audits` and `complaint_ai_analyses`. Request sizes were checked against the code instead (section 6). | `apps/web/db/schema.sql` |
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

---

## 9. AI-Assisted Development Time and Resource Estimate

Handout section 16 asks teams to use AI to estimate development time and resources. The team recorded no estimate before starting, so this one is retrospective: Claude (Anthropic) produced it on 6 November 2026, after the work, from the size of what was built. It shows how far a size-based estimate lands from the record, and it is not a plan the team followed.

**Method.** One member-day is one member's active day of part-time work with AI assistance. The assumed rates, fixed before the comparison, are 400 lines of application code or schema per member-day and 800 lines of tests per member-day, with documents estimated by item.

| Phase | What the estimate covers | Estimate (member-days) | Actual (member-days with a commit) |
|---|---|---:|---:|
| **D0 and D1** | Requirements for three roles (12), architecture, diagrams and design patterns (6), project setup (2) | 20 | 12 |
| **D2** | 36,189 lines of application code and schema (90), and the 79% of test lines added in this phase (34) | 124 | 34 |
| **D3** | The other 21% of test lines (9), ten reports (20), deployment (2), costing and timeline (2), Jira and the final report (4) | 37 | 15 |
| **Total** | | **181** | **61** |

Sizes are from `master` at `feec865`: 34,312 lines of tests in all, and the split of test lines comes from the lines each phase's commits added. Actual member-days count each member once per day with at least one non-merge commit, in IST.

**Reading the gap.** The estimate is about three times the record, for two reasons the record cannot separate. Commit days undercount effort, because reading, design, review and any day without a commit do not appear, and a long session counts the same as a single commit. AI assistance also probably beat the assumed rates, most of all for generated tests. No timesheets were kept, so the true figure lies somewhere between the two.

**Resources.** The resource estimate is the sizing in sections 2 to 5: one web service, one managed database, and the Gemini volume above.
