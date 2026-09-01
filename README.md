# ScamCheck AI 🛡️ — "Check Before You Trust."

A professional cybersecurity-inspired public web application that analyzes suspicious messages, links, payment requests, and job offers with AI-powered risk analysis in **English, Hindi, and Hinglish**.

---

## 🌟 Product Highlights

1. **AI-Powered 0–100 Precision Risk Score**:
   - `0–29`: **Low Risk**
   - `30–59`: **Medium Risk**
   - `60–79`: **High Risk**
   - `80–100`: **Critical Risk**

2. **8 Core Threat Detection Categories**:
   - **Job Scams** (Registration fees, fake offers, task scams)
   - **Bank & KYC Scams** (Account expiry threats, OTP disclosure traps)
   - **UPI & Payment Scams** (QR scan-to-receive fraud, fake collect requests)
   - **Phishing** (Deceptive login portals, clone pages)
   - **Fake Rewards & Lottery** (Unsolicited prize winnings, advance fee demands)
   - **Investment & Crypto Scams** (Guaranteed daily returns, double-money schemes)
   - **Impersonation** (Bank officials, customs, police, courier services)
   - **Suspicious Links** (Shortened URLs, masked domains, unusual TLDs)

3. **Multilingual Support (English, Hindi & Hinglish)**:
   - Understands native Hindi (Devanagari) and Hinglish phrases (e.g. *"bhai ₹500 registration fee do"*, *"आपका KYC बंद हो जाएगा"*, *"OTP batao"*).

4. **Actionable Guidance & One-Click Copying**:
   - Clear breakdown of protective actions to take and critical pitfalls to avoid.
   - Clean, formatted plain-text export for sharing risk reports with family and friends.

---

## 📁 Project Structure

```
scamcheck-ai/
├── public/
│   ├── index.html      # Product landing page with live interactive scanner
│   ├── style.css       # Cybersecurity theme, responsive layout & risk styles
│   └── app.js          # Interactive scanner logic & clipboard handler
├── .env.example        # Environment variables template
├── .env                # Local environment variables
├── package.json        # Dependencies and scripts
├── render.yaml         # Render Blueprint configuration
├── server.js           # Express server & dual AI/Heuristic analyzer
├── test.js             # Automated 36-assertion test suite
└── README.md           # Documentation
```

---

## 🚀 How to Run Locally

```bash
# 1. Install dependencies
npm install

# 2. Start the application
npm start
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🧪 Run Automated Tests

```bash
node test.js
```
