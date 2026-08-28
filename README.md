# ScamCheck AI 🛡️

A simple, clean, and modern web application that analyzes suspicious WhatsApp messages, SMS, emails, job offers, payment requests, and other text to identify potential scam and risk signals using Google Gemini AI.

---

## Features

- **Risk Assessment**: Classifies risk level as `LOW`, `MEDIUM`, or `HIGH`.
- **Risk Score**: Visual score gauge from 0 to 100 representing detected signal severity.
- **Suspicious Signals**: Clear bullet points highlighting detected red flags (e.g., upfront payment, urgency, credential harvesting).
- **Simple Explanation**: Easy-to-understand summary of why the message may be safe or risky.
- **Actionable Guidance**: Clear breakdown of **What You Should Do** and **What You Should NOT Do**.
- **Important Information Detected**: Automatically extracts detected monetary amounts, links/domains, phone numbers, and urgency claims.
- **1-Click Quick Examples**: Preset sample messages (Job fee scam, Bank KYC phishing, Package delivery, Lottery, Safe chat) for fast testing.
- **Resilient Architecture**: Dual-engine design with official Google Gemini API integration and an intelligent security heuristic fallback.

---

## Project Structure

```
scamcheck-ai/
├── public/
│   ├── index.html      # Responsive semantic HTML5 single page
│   ├── style.css       # Clean, modern styling & accessible color contrast
│   └── app.js          # Interactive frontend logic & API communication
├── .env.example        # Environment variables template
├── .env                # Local environment variables
├── package.json        # Dependencies and scripts
├── server.js           # Express server and Gemini AI / Heuristic backend
├── test.js             # Automated end-to-end test suite
└── README.md           # Documentation
```

---

## How to Run

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env` (already done by default) and optionally provide your Gemini API key:
```env
PORT=3000
GEMINI_API_KEY=your_gemini_api_key_here
```
> *Note: If `GEMINI_API_KEY` is not provided, the app will seamlessly run using its built-in security heuristic engine.*

### 3. Start the Server
```bash
npm start
```
Then open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Running the Automated Test Suite

To run the verification suite:
```bash
node test.js
```

---

## API Specification

### `POST /api/analyze`
**Request Body:**
```json
{
  "message": "Congratulations! You have been selected for a job. Pay ₹2,999 registration fee immediately to confirm your position."
}
```

**Response (`200 OK`):**
```json
{
  "riskLevel": "HIGH",
  "riskScore": 95,
  "signals": [
    "Upfront payment or processing fee requested",
    "Urgent or threatening language pushing for immediate action",
    "Unsolicited employment or high-earning promise with minimal criteria"
  ],
  "explanation": "This message displays multiple strong warning signs characteristic of common scams, including requests for payment, credential disclosure, or high-pressure tactics.",
  "doNext": [
    "Verify the sender through known official contact channels independently.",
    "Cross-check company or recruiter identity on their official website or LinkedIn.",
    "Report or mark the message/sender as spam or phishing."
  ],
  "avoid": [
    "Do NOT send any money, registration fees, or security deposits.",
    "Do NOT click on unverified links or scan provided QR codes.",
    "Do NOT share OTPs, passwords, bank account numbers, or KYC documents."
  ],
  "importantDetails": [
    "Mentioned Payment/Amount: ₹2,999"
  ]
}
```

**Empty Input (`400 Bad Request`):**
```json
{
  "error": "Please paste a message first."
}
```
