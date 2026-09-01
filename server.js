import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { GoogleGenAI, Type } from "@google/genai";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.GOOGLE_GENAI_API_KEY || "";

// Middleware
app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));

/**
 * Enhanced URL Extractor
 * Extracts URLs and detects shortened or non-standard/suspicious domains
 */
function extractUrlsAndDomains(message) {
  const urlRegex = /(?:https?:\/\/|www\.)[^\s<>"'`]+|(?:[a-zA-Z0-9-]+\.)+(?:com|org|net|edu|gov|io|co|in|xyz|top|info|site|online|live|biz|app|cc|tk|ml|ga|cf|gq|club|buzz|vip|icu|work|click|link|rest|fit|shop|loan|win|bid|me|to|ly|gd)(?:\/[^\s<>"'`]*)?/gi;
  const rawMatches = message.match(urlRegex) || [];
  
  // Clean trailing punctuation
  const cleanUrls = [...new Set(rawMatches.map(u => u.replace(/[.,;:!?)]+$/, "")))];
  
  const shortenedServices = /bit\.ly|tinyurl\.com|t\.co|is\.gd|cutt\.ly|rb\.gy|shorturl\.at|ow\.ly|buff\.ly|goo\.gl|tiny\.cc/i;
  const unusualTlds = /\.(?:xyz|top|info|site|online|live|biz|app|cc|tk|ml|ga|cf|gq|club|buzz|vip|icu|work|click|link|rest|fit|shop|loan|win|bid)\b/i;
  const ipAddress = /https?:\/\/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/i;

  let hasShortened = false;
  let hasUnusualDomain = false;

  cleanUrls.forEach(url => {
    if (shortenedServices.test(url)) hasShortened = true;
    if (unusualTlds.test(url) || ipAddress.test(url) || /example\.com/i.test(url)) hasUnusualDomain = true;
  });

  return {
    urls: cleanUrls,
    hasShortened,
    hasUnusualDomain,
    isSuspiciousLink: hasShortened || hasUnusualDomain || cleanUrls.some(u => /login|verify|kyc|claim|reward|free|secure|update|bank/i.test(u))
  };
}

/**
 * Enhanced Amount Extractor (supports ₹, $, INR, Rs, Lakh, Crore, etc.)
 */
function extractAmounts(message) {
  const amountRegex = /(?:₹|rs\.?|inr|\$|usd|eur|£|€)\s?[\d,]+(?:\.\d+)?(?:\s*(?:lakh|crore|k|thousand|million))?|[\d,]+(?:\.\d+)?\s*(?:rupees|rupaye|rupe|rs\.?|inr|dollars|usd|euro|pounds|lakh|crore)\b/gi;
  const matches = message.match(amountRegex) || [];
  return [...new Set(matches.map(m => m.trim()))];
}

/**
 * Intelligent heuristic analyzer supporting English, Hindi (Devanagari), and Hinglish
 */
function analyzeWithHeuristics(message) {
  const signals = [];
  const importantDetails = [];
  const doNext = [];
  const avoid = [];
  const detectedCategories = [];

  let score = 0;

  // 1. URL Analysis (+20 for suspicious/unverified)
  const urlInfo = extractUrlsAndDomains(message);
  if (urlInfo.urls.length > 0) {
    urlInfo.urls.forEach(u => {
      importantDetails.push(`Detected Link/Domain (requires verification): ${u}`);
    });

    if (urlInfo.isSuspiciousLink) {
      signals.push("Suspicious, shortened, or unverified link/domain detected");
      score += 20;
    } else {
      signals.push("Hyperlink present requiring domain verification before clicking");
      score += 15;
    }
  } else if (/दिए\s*गए\s*लिंक|लिंक\s*पर|link\s*open\s*karo|click\s*here/i.test(message)) {
    signals.push("Prompt pushing to click an external link");
    score += 15;
  }

  // 2. Amount & Payment Extraction
  const amounts = extractAmounts(message);
  if (amounts.length > 0) {
    importantDetails.push(`Mentioned Payment/Amount: ${amounts.join(", ")}`);
  }

  // Phone numbers
  const phoneMatches = message.match(/(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}|\+91[\s-]?\d{10}|\b\d{10}\b/g) || [];
  if (phoneMatches.length > 0) {
    importantDetails.push(`Phone Numbers Detected: ${[...new Set(phoneMatches)].slice(0, 2).join(", ")}`);
  }

  // 3. Upfront Payment / Processing Fee / Registration Fee (+25)
  const isUpfrontFee = (
    /registration\s+fee|processing\s+fee|refundable\s+fee|security\s+deposit|joining\s+fee|advance\s+fee|entry\s+fee|upfront\s+fee|pay\s+(?:₹|rs\.?|\$|\d+)/i.test(message) ||
    /(?:fee|fees|paise?|paisa|rupaye?|rupees|amount|₹|\$)\s*(?:do|bhejo|jama\s*karo|transfer\s*karo|pay\s*karo|de\s*do|dena\s*hoga)/i.test(message) ||
    /रजिस्ट्रेशन\s*फीस|प्रोसेसिंग\s*फीस|पैसे\s*(?:भेजें|दीजिए|जमा\s*करें|दो)|शुल्क\s*भुगतान/i.test(message)
  );
  if (isUpfrontFee) {
    signals.push("Upfront payment or processing fee requested");
    score += 25;
  }

  // 4. Job Registration / Security Deposit / Guaranteed Job Offer (+20)
  const isJobScam = (
    /selected\s+for\s+(?:a\s+)?job|job\s+offer|job\s+(?:is\s+)?confirm(?:ed)?|work\s+from\s+home\s+earn|earn\s+(?:₹|\$|\d+)\s*(?:daily|per\s+day|monthly)|part\s*time\s*job|guaranteed\s+income|telegram\s+task|like\s+and\s+subscribe\s+to\s+earn/i.test(message) ||
    /(?:job|naukri|interview|vacancy)\s*(?:is\s+)?(?:confirm(?:ed)?|mil\s*gayi|pakki|hai|lag\s*gayi)/i.test(message) ||
    /नौकरी\s*(?:पक्की|का\s*ऑफर|हेतु|चयन)|घर\s*बैठे\s*कमाएं/i.test(message)
  );
  if (isJobScam) {
    signals.push("Job registration, security deposit, or unsolicited job guarantee offer");
    score += 20;
    detectedCategories.push("Job Scam");
    if (isUpfrontFee || /registration|deposit|fee|charge|paise/i.test(message)) {
      score += 20;
    }
  }

  // 5. OTP / Password / Bank Details Request (+25)
  const isOtpCredential = (
    /\b(?:otp|one\s+time\s+password|cvv|atm\s+pin|mpin|netbanking|login\s+credentials|send\s+your\s+otp|share\s+(?:your\s+)?otp)\b/i.test(message) ||
    /(?:otp|pin|password|cvv)\s*(?:batao|bhejo|share\s*karo|do|send\s*karo|enter\s*karo)/i.test(message) ||
    /(?:ओटीपी|otp)\s*(?:भेजें|बताएं|शेयर\s*करें|दो)|पासवर्ड\s*(?:बताएं|दीजिए)|गोपनीय\s*पिन/i.test(message)
  );
  if (isOtpCredential) {
    signals.push("Request for sensitive authentication credentials (OTP, PIN, Password, or Bank details)");
    score += 25;
    if (!detectedCategories.includes("Bank/KYC Scam")) detectedCategories.push("Bank/KYC Scam");
  }

  // 6. Account / KYC Verification Pressure (+15)
  const isKycPressure = (
    /kyc\s+(?:expire|update|suspended|pending|blocked|verification)|account\s+(?:blocked|suspended|closure|deactivated|frozen|terminated)|verify\s+pan|aadhaar\s+link|electricity\s+power\s+cut/i.test(message) ||
    /(?:kyc|khata|account|केवाईसी|खाता)\s*(?:band|block|expire|update|khatam|rok\s*diya|बंद|ब्लॉक|समाप्त)/i.test(message) ||
    /केवाईसी\s*(?:अपडेट|समाप्त|बंद|ब्लॉक)|खाता\s*(?:बंद|अवरुद्ध)/i.test(message)
  );
  if (isKycPressure) {
    signals.push("Account suspension, KYC expiration, or urgent verification pressure");
    score += 20;
    if (!detectedCategories.includes("Bank/KYC Scam")) detectedCategories.push("Bank/KYC Scam");
  }

  // 7. Urgent / Threatening Language (+15)
  const isUrgent = (
    /immediately|urgent|today\s+only|within\s+\d+\s+(?:hours|mins|minutes)|expire\s+today|act\s+now|last\s+warning|avoid\s+(?:account\s+)?closure|legal\s+action|electricity\s+disconnected/i.test(message) ||
    /(?:turant|aaj\s*hi|jaldi|abhi\s*karo|warna\s*band|aaj\s*raat)/i.test(message) ||
    /तुरंत|आज\s*ही|अंतिम\s*चेतावनी|जल्दी\s*करें|कानूनी\s*कार्रवाई/i.test(message)
  );
  if (isUrgent) {
    signals.push("Urgent or threatening language demanding immediate action");
    score += 15;
  }

  // 8. Fake Reward / Lottery / Prize (+20)
  const isRewardLottery = (
    /congratulations!?\s*you\s*won|won\s+(?:₹|\$|\d+|a\s+car|an\s+iphone|cash|lottery)|lottery\s+winner|claim\s+(?:your\s+)?(?:reward|prize)|lucky\s+draw|kbc\s+lucky\s+draw|cashback\s+reward|tax\s+refund/i.test(message) ||
    /(?:inaam|inam|lottery|prize|reward)\s*(?:jeeta|mila|nikla|lagi|paneke\s*liye)/i.test(message) ||
    /बधाई\s*हो!?\s*आपने\s*जीता|इनाम\s*(?:जीता|पाने\s*के\s*लिए)|लॉटरी\s*विजेता/i.test(message)
  );
  if (isRewardLottery) {
    signals.push("Unsolicited prize, lottery, cashback, or reward claim");
    score += 20;
    detectedCategories.push("Fake Reward/Lottery");
  }

  // 9. Impersonation of Bank / Brand / Govt / Courier (+20)
  const isImpersonation = (
    /(?:\b(?:sbi|hdfc|icici|axis|pnb|paytm|phonepe|gpay|google\s*pay|fedex|dhl|india\s*post|customs|tax\s*department)\b|\byour\s+bank\b|\bbank\s+account\b)/i.test(message) &&
    (urlInfo.urls.length > 0 || isOtpCredential || isKycPressure || isUpfrontFee || isUrgent)
  );
  if (isImpersonation) {
    signals.push("Impersonation of recognized bank, financial service, government entity, or courier");
    score += 20;
    if (!detectedCategories.includes("Impersonation Scam") && !detectedCategories.includes("Bank/KYC Scam")) {
      detectedCategories.push("Impersonation Scam");
    }
  }

  // 10. Suspicious Crypto / Investment Promise (+20)
  const isCryptoInvestment = (
    /crypto\s*returns|bitcoin\s*investment|guaranteed\s*returns|double\s*your\s*money|forex\s*trading\s*profit|daily\s*roi|mining\s*pool/i.test(message) ||
    /(?:paisa\s*double|munafa\s*guaranteed|invest\s*karo\s*double)/i.test(message) ||
    /दोगुना\s*मुनाफा|निवेश\s*पर\s*गारंटी/i.test(message)
  );
  if (isCryptoInvestment) {
    signals.push("High-return investment or speculative cryptocurrency/trading promise");
    score += 20;
    detectedCategories.push("Investment/Crypto Scam");
  }

  // 11. UPI / Payment Scam (+25)
  const isUpiScam = (
    /upi\s*pin\s*to\s*receive|scan\s*qr\s*to\s*receive\s*money|collect\s*request|paytm\s*kyc/i.test(message) ||
    /(?:paise\s*lene\s*ke\s*liye\s*pin|qr\s*scan\s*karke\s*paise\s*lo)/i.test(message)
  );
  if (isUpiScam) {
    signals.push("UPI PIN or QR scan request for receiving money (payment fraud tactic)");
    score += 25;
    detectedCategories.push("UPI/Payment Scam");
  }

  // Determine Primary Category
  let category = "Other Suspicious Message";
  if (isRewardLottery) {
    category = "Fake Reward/Lottery";
  } else if (isJobScam) {
    category = "Job Scam";
  } else if (isCryptoInvestment) {
    category = "Investment/Crypto Scam";
  } else if (isUpiScam) {
    category = "UPI/Payment Scam";
  } else if (isKycPressure || isOtpCredential) {
    category = "Bank/KYC Scam";
  } else if (isImpersonation) {
    category = "Impersonation Scam";
  } else if (urlInfo.isSuspiciousLink) {
    category = "Phishing";
  } else if (score < 30) {
    category = "Safe / Informational Message";
  } else if (detectedCategories.length > 0) {
    category = detectedCategories[0];
  }

  // Adjust score bounds (Cap at 100, minimum 5 for safe normal text)
  if (signals.length === 0) {
    score = 5;
    signals.push("No significant suspicious keywords or high-risk patterns detected.");
  } else {
    score = Math.min(Math.max(score, 10), 100);
  }

  // Determine 4-Tier Risk Level:
  // 0–29 = Low Risk | 30–59 = Medium Risk | 60–79 = High Risk | 80–100 = Critical Risk
  let riskLevel = "LOW";
  let explanation = "";

  if (score >= 80) {
    riskLevel = "CRITICAL";
    explanation = `Critical Risk (${score}/100) — Severe red flags detected for a ${category}. The message aggressively requests upfront payment, OTP/credentials, or uses extreme urgency.`;
    doNext.push("Independently verify the sender through official channels before taking any action.");
    doNext.push("Block and report the sender on your messaging app or telecom provider.");
    doNext.push("Check official portals or apps directly rather than opening any link in the message.");
    
    avoid.push("Do NOT send money, registration fees, or processing charges under any circumstance.");
    avoid.push("Do NOT share OTPs, PINs, passwords, or banking credentials with anyone.");
    avoid.push("Do NOT click unverified links, download attachments, or scan provided QR codes.");
  } else if (score >= 60) {
    riskLevel = "HIGH";
    explanation = `High Risk (${score}/100) — Multiple significant warning signs detected matching typical ${category} patterns. Genuine organizations do not demand fees or credentials like this.`;
    doNext.push("Verify the organization's official website or direct customer service numbers.");
    doNext.push("Confirm legitimate recruiter or sender identity before engaging.");
    
    avoid.push("Do NOT make advance payments or security deposits.");
    avoid.push("Do NOT disclose personal or banking information.");
    avoid.push("Avoid clicking shortened or unverified URLs.");
  } else if (score >= 30) {
    riskLevel = "MEDIUM";
    explanation = `Medium Risk (${score}/100) — Some ambiguous or cautionary signals detected. Exercise heightened vigilance before clicking links or sharing info.`;
    doNext.push("Double-check sender address and verify links by typing official domains manually.");
    doNext.push("Ask the sender for official corporate verification if in doubt.");
    
    avoid.push("Avoid making hasty decisions under artificial urgency.");
    avoid.push("Do not provide confidential details without secondary confirmation.");
  } else {
    riskLevel = "LOW";
    score = Math.min(score, 20);
    explanation = `Low Risk (${score}/100) — No major scam indicators detected. The text appears to be standard conversational, workplace, or informational communication.`;
    doNext.push("Proceed normally while maintaining standard security habits.");
    doNext.push("Stay alert if any future follow-up suddenly requests payments or passwords.");
    
    avoid.push("Never share one-time passwords or security credentials in any chat.");
  }

  if (importantDetails.length === 0) {
    importantDetails.push("No URLs, phone numbers, or monetary amounts detected in the text.");
  }

  return {
    riskLevel,
    riskScore: score,
    category,
    signals,
    explanation,
    doNext,
    avoid,
    importantDetails
  };
}

/**
 * AI-powered analysis with Google Gemini supporting English, Hindi & Hinglish
 */
async function analyzeWithGemini(message) {
  const ai = new GoogleGenAI({ apiKey: API_KEY });

  const prompt = `You are ScamCheck AI, a specialized fraud detection and cyber-safety risk analyzer.
Analyze the following message for potential scam, phishing, fraud, or risk signals.

SUPPORTED LANGUAGES:
You must understand English, Hindi (Devanagari script), and Hinglish (Hindi written in Latin script, e.g. "bhai ₹500 fee do", "KYC band ho jayega", "OTP share karo").

SCORING GUIDELINES (Score 0 to 100):
- Upfront payment/processing/registration fee: +25
- OTP/password/bank details request: +25
- Urgent/threatening language (account blocked, electricity cut, expire today): +15
- Suspicious/shortened/masked/unusual URL: +20
- Fake reward/prize/lottery/cashback: +20
- Job registration/security deposit request: +20
- Account/KYC verification pressure: +15
- Suspicious crypto/investment high-return scheme: +20
- Impersonation of bank/company/government/courier: +20
Cap final score at 100.

RISK LEVELS:
- 0–29 = LOW
- 30–59 = MEDIUM
- 60–79 = HIGH
- 80–100 = CRITICAL

CATEGORIES:
Choose the most accurate primary category:
- "Job Scam"
- "Bank/KYC Scam"
- "UPI/Payment Scam"
- "Phishing"
- "Fake Reward/Lottery"
- "Investment/Crypto Scam"
- "Impersonation Scam"
- "Other Suspicious Message"
- "Safe / Informational Message" (if Low Risk)

SAFETY MANDATE:
Never advise the user to send money, share OTPs, enter PINs, or click suspicious links.

Message to analyze:
"""
${message}
"""

Return your evaluation in strict structured JSON with this exact schema:
{
  "riskLevel": "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
  "riskScore": integer from 0 to 100,
  "category": "Job Scam" | "Bank/KYC Scam" | "UPI/Payment Scam" | "Phishing" | "Fake Reward/Lottery" | "Investment/Crypto Scam" | "Impersonation Scam" | "Other Suspicious Message" | "Safe / Informational Message",
  "signals": ["list of specific warning signals or risk indicators detected"],
  "explanation": "2-3 sentence clear summary explaining why this score was given",
  "doNext": ["clear, actionable protective steps the user should do next"],
  "avoid": ["clear things the user should NOT do / avoid doing"],
  "importantDetails": ["key extracted data points like mentioned payment amounts (e.g. ₹99, $500), detected links/domains (marked as requiring verification), phone numbers, or deadlines"]
}`;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          riskLevel: {
            type: Type.STRING,
            enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"]
          },
          riskScore: {
            type: Type.INTEGER,
            description: "Risk score from 0 to 100"
          },
          category: {
            type: Type.STRING,
            description: "Primary scam category detected"
          },
          signals: {
            type: Type.ARRAY,
            items: { type: Type.STRING }
          },
          explanation: {
            type: Type.STRING
          },
          doNext: {
            type: Type.ARRAY,
            items: { type: Type.STRING }
          },
          avoid: {
            type: Type.ARRAY,
            items: { type: Type.STRING }
          },
          importantDetails: {
            type: Type.ARRAY,
            items: { type: Type.STRING }
          }
        },
        required: ["riskLevel", "riskScore", "category", "signals", "explanation", "doNext", "avoid", "importantDetails"]
      }
    }
  });

  const rawText = response.text?.trim();
  if (!rawText) {
    throw new Error("Empty response from AI model");
  }

  return JSON.parse(rawText);
}

// POST /api/analyze endpoint
app.post("/api/analyze", async (req, res) => {
  try {
    const { message } = req.body || {};

    // Validate input
    if (!message || typeof message !== "string" || message.trim().length === 0) {
      return res.status(400).json({
        error: "Please paste a message first."
      });
    }

    const trimmed = message.trim();

    // If API key is available, call Gemini AI; otherwise fall back to heuristics
    let result;
    if (API_KEY && API_KEY.trim().length > 0 && API_KEY !== "your_api_key_here") {
      try {
        result = await analyzeWithGemini(trimmed);
      } catch (geminiError) {
        console.warn("Gemini API call failed, falling back to heuristic engine:", geminiError.message);
        result = analyzeWithHeuristics(trimmed);
        result.fallbackNote = "Analyzed via security heuristics engine (AI service unreachable).";
      }
    } else {
      result = analyzeWithHeuristics(trimmed);
    }

    // Ensure sanitized defaults
    const score = typeof result.riskScore === "number" ? Math.min(Math.max(Math.round(result.riskScore), 0), 100) : 50;
    
    // Normalize riskLevel to 4-tier standard
    let computedLevel = result.riskLevel;
    if (!["LOW", "MEDIUM", "HIGH", "CRITICAL"].includes(computedLevel)) {
      if (score >= 80) computedLevel = "CRITICAL";
      else if (score >= 60) computedLevel = "HIGH";
      else if (score >= 30) computedLevel = "MEDIUM";
      else computedLevel = "LOW";
    }

    const sanitized = {
      riskLevel: computedLevel,
      riskScore: score,
      category: result.category || (score >= 60 ? "Other Suspicious Message" : "Safe / Informational Message"),
      signals: Array.isArray(result.signals) && result.signals.length > 0 ? result.signals : ["No specific signals detected."],
      explanation: result.explanation || `Risk analysis completed with a score of ${score}/100.`,
      doNext: Array.isArray(result.doNext) && result.doNext.length > 0 ? result.doNext : ["Verify with the original source before responding."],
      avoid: Array.isArray(result.avoid) && result.avoid.length > 0 ? result.avoid : ["Do not share confidential credentials."],
      importantDetails: Array.isArray(result.importantDetails) && result.importantDetails.length > 0 ? result.importantDetails : ["No specific entities extracted."]
    };

    return res.json(sanitized);
  } catch (err) {
    console.error("Error processing /api/analyze:", err);
    return res.status(500).json({
      error: "An unexpected error occurred while analyzing the message. Please try again."
    });
  }
});

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    appName: "ScamCheck AI",
    version: "2.0.0",
    aiConfigured: !!(API_KEY && API_KEY.trim().length > 0)
  });
});

// Fallback to index.html for root / unknown routes
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`==========================================`);
  console.log(`🛡️  ScamCheck AI Server running on port ${PORT}`);
  console.log(`🔑  Gemini API Key status: ${API_KEY ? "Configured" : "Not configured (Using Security Heuristic Engine)"}`);
  console.log(`==========================================`);
});
