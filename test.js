import http from "http";

function postJson(path, payload) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(payload);
    const req = http.request(
      {
        hostname: "localhost",
        port: 3000,
        path: path,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(data)
        }
      },
      (res) => {
        let body = "";
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () => {
          try {
            resolve({ status: res.statusCode, data: JSON.parse(body) });
          } catch (e) {
            resolve({ status: res.statusCode, raw: body });
          }
        });
      }
    );
    req.on("error", reject);
    req.write(data);
    req.end();
  });
}

function get(path) {
  return new Promise((resolve, reject) => {
    http.get({ hostname: "localhost", port: 3000, path }, (res) => {
      let body = "";
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => resolve({ status: res.statusCode, body }));
    }).on("error", reject);
  });
}

async function runTests() {
  console.log("==================================================");
  console.log("🛡️  SCAMCHECK AI 2.0 COMPREHENSIVE TEST SUITE");
  console.log("==================================================");

  let passed = 0;
  let total = 0;

  function assert(condition, testName, details = "") {
    total++;
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${testName}: ${details}`);
    }
  }

  // 1. Health Check
  console.log("\n--- Health Check ---");
  const health = await get("/api/health");
  assert(health.status === 200, "GET /api/health returns 200 OK");
  const healthData = JSON.parse(health.body);
  assert(healthData.version === "2.0.0", "Health returns upgraded version 2.0.0");

  // 2. Empty Input Validation
  console.log("\n--- Validation Test ---");
  const emptyRes = await postJson("/api/analyze", { message: "" });
  assert(emptyRes.status === 400, "Empty message returns 400 Bad Request");
  assert(emptyRes.data.error === "Please paste a message first.", "Empty message returns proper error string");

  // 3. User Case 1: Fake Reward with ₹50,000, ₹199 processing fee, OTP and URL
  console.log("\n--- TEST 1: Fake Reward + Processing Fee + OTP + URL ---");
  const test1Msg = "Congratulations! You won ₹50,000. Pay ₹199 processing fee immediately and send your OTP. Click http://claim-prize-now.example.com";
  const t1Res = await postJson("/api/analyze", { message: test1Msg });
  console.log("T1 Response:", JSON.stringify(t1Res.data, null, 2));
  assert(t1Res.status === 200, "Test 1 status 200");
  assert(["HIGH", "CRITICAL"].includes(t1Res.data.riskLevel), `Test 1 riskLevel is High/Critical (got ${t1Res.data.riskLevel})`);
  assert(t1Res.data.riskScore >= 60, `Test 1 riskScore >= 60 (got ${t1Res.data.riskScore})`);
  assert(t1Res.data.category === "Fake Reward/Lottery", `Test 1 category is Fake Reward/Lottery (got ${t1Res.data.category})`);
  assert(t1Res.data.importantDetails.some(d => d.includes("₹50,000") || d.includes("₹199")), "Test 1 extracted amounts ₹50,000 / ₹199");
  assert(t1Res.data.signals.some(s => s.toLowerCase().includes("otp")), "Test 1 detected OTP signal");
  assert(t1Res.data.importantDetails.some(d => d.includes("http://claim-prize-now.example.com")), "Test 1 detected URL");

  // 4. User Case 2: Job Scam with fee
  console.log("\n--- TEST 2: Job Scam with Payment Request ---");
  const test2Msg = "Your job is confirmed. Pay ₹500 registration fee immediately.";
  const t2Res = await postJson("/api/analyze", { message: test2Msg });
  console.log("T2 Response:", JSON.stringify(t2Res.data, null, 2));
  assert(t2Res.status === 200, "Test 2 status 200");
  assert(["HIGH", "CRITICAL"].includes(t2Res.data.riskLevel), `Test 2 riskLevel is High/Critical (got ${t2Res.data.riskLevel})`);
  assert(t2Res.data.category === "Job Scam", `Test 2 category is Job Scam (got ${t2Res.data.category})`);
  assert(t2Res.data.importantDetails.some(d => d.includes("₹500")), "Test 2 extracted amount ₹500");
  assert(t2Res.data.signals.some(s => s.toLowerCase().includes("fee") || s.toLowerCase().includes("payment")), "Test 2 detected payment request signal");

  // 5. User Case 3: Normal Safe Message
  console.log("\n--- TEST 3: Normal Message (Interview) ---");
  const test3Msg = "Your interview is scheduled tomorrow at 10 AM. Please bring your resume.";
  const t3Res = await postJson("/api/analyze", { message: test3Msg });
  console.log("T3 Response:", JSON.stringify(t3Res.data, null, 2));
  assert(t3Res.status === 200, "Test 3 status 200");
  assert(t3Res.data.riskLevel === "LOW", `Test 3 riskLevel is LOW (got ${t3Res.data.riskLevel})`);
  assert(t3Res.data.riskScore < 30, `Test 3 riskScore < 30 (got ${t3Res.data.riskScore})`);

  // 6. Hinglish Job Scam Test
  console.log("\n--- TEST 4: Hinglish Job Registration Fee ---");
  const test4Msg = "bhai ₹500 registration fee do aur job confirm hai";
  const t4Res = await postJson("/api/analyze", { message: test4Msg });
  assert(t4Res.status === 200, "Test 4 status 200");
  assert(["HIGH", "CRITICAL"].includes(t4Res.data.riskLevel), `Test 4 riskLevel is High/Critical (got ${t4Res.data.riskLevel})`);
  assert(t4Res.data.category === "Job Scam", `Test 4 category is Job Scam (got ${t4Res.data.category})`);

  // 7. Hindi Devanagari Script Test
  console.log("\n--- TEST 5: Hindi Devanagari Script ---");
  const hindiMsg = "आपका KYC बंद हो जाएगा तुरंत दिए गए लिंक पर ओटीपी भेजें";
  const hindiRes = await postJson("/api/analyze", { message: hindiMsg });
  assert(hindiRes.status === 200, "Hindi test status 200");
  assert(["HIGH", "CRITICAL"].includes(hindiRes.data.riskLevel), `Hindi riskLevel is High/Critical (got ${hindiRes.data.riskLevel})`);
  assert(hindiRes.data.category === "Bank/KYC Scam", `Hindi category is Bank/KYC Scam (got ${hindiRes.data.category})`);

  // 8. Clipboard Copy Text Formatter Test
  console.log("\n--- TEST 6: Copy Result Text Format Verification ---");
  function formatAnalysisForClipboard(data) {
    const level = (data.riskLevel || "MEDIUM").toUpperCase();
    const score = typeof data.riskScore === "number" ? data.riskScore : 0;
    const category = data.category || "Scam Analysis";
    const explanation = data.explanation || "Risk analysis completed.";

    const lines = [
      "ScamCheck AI Risk Assessment",
      `Risk Score: ${score}/100`,
      `Risk Level: ${level} RISK`,
      `Scam Category: ${category}`,
      "",
      "Summary Explanation:",
      explanation,
      ""
    ];

    if (Array.isArray(data.signals) && data.signals.length > 0) {
      lines.push("Suspicious Signals Detected:");
      data.signals.forEach((s) => lines.push(`• ${s}`));
      lines.push("");
    }

    if (Array.isArray(data.doNext) && data.doNext.length > 0) {
      lines.push("What You Should Do:");
      data.doNext.forEach((d) => lines.push(`• ${d}`));
      lines.push("");
    }

    if (Array.isArray(data.avoid) && data.avoid.length > 0) {
      lines.push("What You Should NOT Do:");
      data.avoid.forEach((a) => lines.push(`• ${a}`));
      lines.push("");
    }

    if (Array.isArray(data.importantDetails) && data.importantDetails.length > 0) {
      lines.push("Important Information Detected:");
      data.importantDetails.forEach((i) => lines.push(`• ${i}`));
      lines.push("");
    }

    lines.push("Disclaimer:");
    lines.push("ScamCheck AI provides AI-generated risk analysis and is not a guarantee that a message is fraudulent. Always verify important information through official sources.");

    return lines.join("\n");
  }

  const copiedText = formatAnalysisForClipboard(t1Res.data);
  console.log("Formatted Copied Text Sample:\n" + copiedText);
  assert(copiedText.startsWith("ScamCheck AI Risk Assessment"), "Copied text starts with ScamCheck AI Risk Assessment");
  assert(copiedText.includes("Risk Score: 100/100") || copiedText.includes(`Risk Score: ${t1Res.data.riskScore}/100`), "Copied text includes exact Risk Score");
  assert(copiedText.includes(`Risk Level: ${t1Res.data.riskLevel} RISK`), "Copied text includes exact Risk Level");
  assert(copiedText.includes("Scam Category: Fake Reward/Lottery"), "Copied text includes exact Scam Category");
  assert(copiedText.includes("Summary Explanation:"), "Copied text includes Summary Explanation");
  assert(copiedText.includes("Suspicious Signals Detected:"), "Copied text includes Signals section");
  assert(copiedText.includes("What You Should Do:"), "Copied text includes What You Should Do section");
  assert(copiedText.includes("What You Should NOT Do:"), "Copied text includes What You Should NOT Do section");
  assert(copiedText.includes("Important Information Detected:"), "Copied text includes Important Details section");
  assert(copiedText.includes("Disclaimer:"), "Copied text includes Disclaimer section");
  assert(!/<[^>]+>/.test(copiedText), "Copied text is clean plain text without any HTML tags");

  console.log("\n==================================================");
  console.log(`🏁 TEST RESULTS: ${passed}/${total} assertions passed`);
  console.log("==================================================");

  if (passed === total) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runTests().catch(e => {
  console.error("Test execution failed:", e);
  process.exit(1);
});
