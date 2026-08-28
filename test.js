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
  console.log("=== SCAMCHECK AI TEST SUITE ===");

  // 1. Health check
  console.log("\n1. Testing GET /api/health...");
  const health = await get("/api/health");
  console.log(`Status: ${health.status}, Response: ${health.body}`);

  // 2. Static HTML check
  console.log("\n2. Testing GET / (Frontend delivery)...");
  const html = await get("/");
  console.log(`Status: ${html.status}, Title in HTML: ${html.body.includes("<title>ScamCheck AI")}`);

  // 3. Empty message validation
  console.log("\n3. Testing Empty Message POST /api/analyze...");
  const emptyRes = await postJson("/api/analyze", { message: "" });
  console.log(`Status: ${emptyRes.status} (Expected: 400)`);
  console.log(`Error Response:`, emptyRes.data);

  // 4. Normal harmless message
  console.log("\n4. Testing Normal Harmless Message...");
  const safeMsg = "Hi Sarah, are we still meeting for lunch today at 1pm at the cafe near the office?";
  const safeRes = await postJson("/api/analyze", { message: safeMsg });
  console.log(`Status: ${safeRes.status}`);
  console.log(`Result: Risk Level = ${safeRes.data.riskLevel}, Score = ${safeRes.data.riskScore}`);
  console.log(`Explanation: ${safeRes.data.explanation}`);
  console.log(`Signals:`, safeRes.data.signals);

  // 5. Suspicious job registration fee message (from prompt)
  console.log("\n5. Testing Suspicious Job Offer with Upfront Fee...");
  const jobMsg = "Congratulations! You have been selected for a job. Pay ₹2,999 registration fee immediately to confirm your position.";
  const jobRes = await postJson("/api/analyze", { message: jobMsg });
  console.log(`Status: ${jobRes.status}`);
  console.log(`Result: Risk Level = ${jobRes.data.riskLevel}, Score = ${jobRes.data.riskScore}`);
  console.log(`Explanation: ${jobRes.data.explanation}`);
  console.log(`Signals:`, jobRes.data.signals);
  console.log(`What You Should Do:`, jobRes.data.doNext);
  console.log(`What You Should NOT Do:`, jobRes.data.avoid);
  console.log(`Important Details:`, jobRes.data.importantDetails);

  // 6. Suspicious bank phishing SMS
  console.log("\n6. Testing Bank Phishing SMS with Urgency, Link & OTP...");
  const bankMsg = "URGENT: Your SBI bank account will be blocked in 24 hours. Update KYC now at http://sbi-secure-kyc.xyz/login with your OTP.";
  const bankRes = await postJson("/api/analyze", { message: bankMsg });
  console.log(`Status: ${bankRes.status}`);
  console.log(`Result: Risk Level = ${bankRes.data.riskLevel}, Score = ${bankRes.data.riskScore}`);
  console.log(`Signals:`, bankRes.data.signals);
  console.log(`Important Details:`, bankRes.data.importantDetails);

  console.log("\n=== ALL TESTS COMPLETED SUCCESSFULLY ===");
}

runTests().catch(console.error);
