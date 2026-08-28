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
 * Intelligent heuristic fallback analyzer for offline testing / fallback
 */
function analyzeWithHeuristics(message) {
  const text = message.toLowerCase();
  const signals = [];
  const importantDetails = [];
  const doNext = [];
  const avoid = [];

  // Detail extractions
  const urls = message.match(/https?:\/\/[^\s]+|[a-zA-Z0-9-]+\.(?:com|org|net|xyz|top|info|site|online|live|biz|app|cc|tk|ml|ga|cf|gq|in|co|ru|cn)[^\s]*/gi) || [];
  if (urls.length > 0) {
    importantDetails.push(`Detected Link/Domain: ${urls.slice(0, 3).join(", ")}`);
  }

  const moneyMatches = message.match(/(?:₹|rs\.?|inr|\$|usd|eur|£|€)\s?[\d,]+(?:\.\d+)?|[\d,]+\s?(?:rupees|rs|inr|dollars|usd|euro|pounds)/gi) || [];
  if (moneyMatches.length > 0) {
    importantDetails.push(`Mentioned Payment/Amount: ${[...new Set(moneyMatches)].slice(0, 3).join(", ")}`);
  }

  const phoneMatches = message.match(/(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}|\+91[\s-]?\d{10}|\b\d{10}\b/g) || [];
  if (phoneMatches.length > 0) {
    importantDetails.push(`Phone Numbers Detected: ${[...new Set(phoneMatches)].slice(0, 2).join(", ")}`);
  }

  // Signal detection patterns
  let score = 5; // Baseline low

  // 1. Upfront Payment / Fees
  if (
    /registration\s+fee|processing\s+fee|refundable\s+fee|security\s+deposit|joining\s+fee|upfront\s+payment|advance\s+fee|pay\s+(?:₹|rs\.?|\$|\d+)/i.test(message)
  ) {
    signals.push("Upfront payment or processing fee requested");
    score += 35;
  }

  // 2. High Urgency / Threats
  if (
    /immediately|urgent|within\s+\d+\s+(?:hours|mins|minutes)|expire\s+soon|act\s+now|account\s+(?:blocked|suspended|deactivated|frozen|terminated)|last\s+warning|legal\s+action/i.test(message)
  ) {
    signals.push("Urgent or threatening language pushing for immediate action");
    score += 25;
  }

  // 3. Sensitive Credentials / OTP / KYC
  if (
    /\b(?:otp|one\s+time\s+password|cvv|atm\s+pin|mpin|netbanking|login\s+credentials|kyc\s+update|verify\s+pan|aadhaar)\b/i.test(message)
  ) {
    signals.push("Request or trigger for sensitive credentials (OTP, PIN, Password, or KYC verification)");
    score += 35;
  }

  // 4. Unrealistic Job Offers / Easy Money
  if (
    /selected\s+for\s+(?:a\s+)?job|job\s+offer|work\s+from\s+home\s+earn|earn\s+(?:₹|\$|\d+)\s*(?:daily|per\s+day|monthly)|part\s*time\s*job|guaranteed\s+income|telegram\s+task|like\s+and\s+subscribe\s+to\s+earn/i.test(message)
  ) {
    signals.push("Unsolicited employment or high-earning promise with minimal criteria");
    score += 30;
  }

  // 5. Lottery / Prize / Gift / Refund Claims
  if (
    /lottery\s+winner|won\s+(?:₹|\$|\d+|a\s+car|an\s+iphone|cash)|claim\s+(?:your\s+)?prize|lucky\s+draw|congratulations!\s*you\s*have\s*won|tax\s+refund|electricity\s+bill\s+unpaid/i.test(message)
  ) {
    signals.push("Unsolicited prize, lottery, or refund claim");
    score += 30;
  }

  // 6. Suspicious / Shortened Links
  if (
    /bit\.ly|tinyurl|is\.gd|t\.co|cutt\.ly|goo\.gl|\.xyz|\.top|\.live|\.buzz|\.club|\.online|\.site|\.tk|\.ga|\.cf|\.gq|\.cc/i.test(message) ||
    /http:\/\/(?!\localhost)/i.test(message)
  ) {
    signals.push("Contains shortened, masked, or suspicious non-standard domain link");
    score += 25;
  }

  // 7. Impersonation of Banks, Govt, or Courier
  if (
    /sbi|hdfc|icici|axis|pnb|paytm|phonepe|gpay|google\s*pay|fedex|dhl|india\s*post|customs\s*duty|parcel\s+delivery\s+failed|address\s+confirmation/i.test(message) &&
    (urls.length > 0 || /fee|charge|update|link|call|sms/i.test(message))
  ) {
    signals.push("Possible brand, postal service, or financial institution impersonation");
    score += 20;
  }

  // Bound score
  score = Math.min(Math.max(score, 5), 98);

  let riskLevel = "LOW";
  let explanation = "";

  if (score >= 70) {
    riskLevel = "HIGH";
    explanation = "This message displays multiple strong warning signs characteristic of common scams, including requests for payment, credential disclosure, or high-pressure tactics.";
    doNext.push("Verify the sender through known official contact channels independently.");
    doNext.push("Cross-check company or recruiter identity on their official website or LinkedIn.");
    doNext.push("Report or mark the message/sender as spam or phishing.");
    
    avoid.push("Do NOT send any money, registration fees, or security deposits.");
    avoid.push("Do NOT click on unverified links or scan provided QR codes.");
    avoid.push("Do NOT share OTPs, passwords, bank account numbers, or KYC documents.");
  } else if (score >= 35) {
    riskLevel = "MEDIUM";
    explanation = "This message exhibits some potential risk elements or ambiguous prompts that warrant caution before responding or interacting.";
    doNext.push("Independently confirm with the supposed organization using a verified phone number or website.");
    doNext.push("Inspect any hyperlinks carefully before tapping or clicking.");
    
    avoid.push("Avoid making hasty decisions under artificial urgency.");
    avoid.push("Do not provide personal or financial details without thorough verification.");
  } else {
    riskLevel = "LOW";
    score = Math.min(score, 20);
    explanation = "No overt scam or high-risk indicators were detected in this message. It appears to be standard conversational or informational text.";
    doNext.push("Proceed normally while maintaining standard privacy vigilance.");
    doNext.push("Always stay cautious if any subsequent message requests money or credentials.");
    
    avoid.push("Avoid sharing passwords or sensitive personal details in any chat.");
  }

  if (importantDetails.length === 0) {
    importantDetails.push("No specific URLs, phone numbers, or monetary amounts detected.");
  }

  if (signals.length === 0) {
    signals.push("No typical suspicious keywords or urgency patterns found.");
  }

  return {
    riskLevel,
    riskScore: score,
    signals,
    explanation,
    doNext,
    avoid,
    importantDetails
  };
}

/**
 * AI-powered analysis with Google Gemini
 */
async function analyzeWithGemini(message) {
  const ai = new GoogleGenAI({ apiKey: API_KEY });

  const prompt = `You are ScamCheck AI, a security and risk analysis assistant.
Analyze the following message for potential scam, phishing, fraud, or risk signals (such as WhatsApp/SMS fraud, job fee scams, fake bank alerts, delivery scams, lottery fraud, urgency pressure, suspicious links, etc.).

Do NOT make absolute claims that something is guaranteed fraud or 100% legitimate; instead, assess the risk signals objectively and provide constructive guidance.

Message to analyze:
"""
${message}
"""

Return your evaluation in strict structured JSON with this exact schema:
{
  "riskLevel": "LOW" | "MEDIUM" | "HIGH",
  "riskScore": integer from 0 to 100 (where 0 is completely safe and 100 is severe risk),
  "signals": ["list of specific warning signals or risk indicators detected"],
  "explanation": "2-3 sentence clear summary explanation for everyday users",
  "doNext": ["clear, actionable protective steps the user should do next"],
  "avoid": ["clear things the user should NOT do / avoid doing"],
  "importantDetails": ["key extracted data points like mentioned amounts, claimed company, links, phone numbers, or deadlines"]
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
            enum: ["LOW", "MEDIUM", "HIGH"]
          },
          riskScore: {
            type: Type.INTEGER,
            description: "Risk score from 0 to 100"
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
        required: ["riskLevel", "riskScore", "signals", "explanation", "doNext", "avoid", "importantDetails"]
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
    const sanitized = {
      riskLevel: ["LOW", "MEDIUM", "HIGH"].includes(result.riskLevel) ? result.riskLevel : "MEDIUM",
      riskScore: typeof result.riskScore === "number" ? Math.min(Math.max(Math.round(result.riskScore), 0), 100) : 50,
      signals: Array.isArray(result.signals) && result.signals.length > 0 ? result.signals : ["No specific signals detected."],
      explanation: result.explanation || "Risk analysis completed based on detected message signals.",
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
    aiConfigured: !!(API_KEY && API_KEY.trim().length > 0)
  });
});

// Fallback to index.html for root / unknown routes
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`==========================================`);
  console.log(`🛡️  ScamCheck AI Server running on http://localhost:${PORT}`);
  console.log(`🔑  Gemini API Key status: ${API_KEY ? "Configured" : "Not configured (Using Security Heuristic Engine)"}`);
  console.log(`==========================================`);
});
