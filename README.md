# ScamCheck AI 🛡️ — Professional Scam & Risk Analyzer (Version 2.0)

A modern, fast, and responsive web application that analyzes suspicious WhatsApp messages, SMS, emails, job offers, payment requests, and text in **English, Hindi, and Hinglish** to identify potential fraud/risk signals using Google Gemini AI.

---

## 🌟 What's New in Version 2.0

1. **4-Tier Risk Assessment & Score (0–100)**:
   - `0–29`: **Low Risk**
   - `30–59`: **Medium Risk**
   - `60–79`: **High Risk**
   - `80–100`: **Critical Risk**
2. **Scam Category Classification**:
   - `Job Scam`
   - `Bank/KYC Scam`
   - `UPI/Payment Scam`
   - `Phishing`
   - `Fake Reward/Lottery`
   - `Investment/Crypto Scam`
   - `Impersonation Scam`
   - `Other Suspicious Message`
   - `Safe / Informational Message`
3. **Multilingual Support (English, Hindi & Hinglish)**:
   - Understands native Hindi (Devanagari) and Hinglish phrases (e.g. *"bhai ₹500 registration fee do"*, *"आपका KYC बंद हो जाएगा"*, *"OTP batao"*).
4. **Enhanced URL & Entity Extraction**:
   - Detects standard and non-standard TLDs, shortened URLs (bit.ly, tinyurl, etc.), raw IP addresses, and displays them as *requiring verification*.
   - Extracts currencies and amounts (₹, $, Rs, INR, EUR, GBP, Lakhs, Crores).
5. **One-Click Clipboard Copying**:
   - Copy clean, formatted risk analysis reports to share on WhatsApp or save for records.
6. **Production & Render Cloud Ready**:
   - Preserves complete backward compatibility with `render.yaml`, environment variables (`PORT`, `GEMINI_API_KEY`), and zero extra dependencies.

---

## 📁 Project Structure

```
scamcheck-ai/
├── public/
│   ├── index.html      # Responsive UI with Category badges & Copy Result
│   ├── style.css       # 4-tier risk themes & mobile-friendly cards
│   └── app.js          # Interactive frontend logic & clipboard handler
├── .env.example        # Environment variables template
├── .env                # Local environment variables
├── package.json        # Dependencies and scripts
├── render.yaml         # Render Blueprint configuration
├── server.js           # Express server & dual AI/Heuristic analyzer
├── test.js             # Automated 25-point test suite
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
