/**
 * ScamCheck AI — Frontend Client Logic
 */

document.addEventListener("DOMContentLoaded", () => {
  // DOM Elements
  const form = document.getElementById("analyze-form");
  const messageInput = document.getElementById("message-input");
  const submitBtn = document.getElementById("submit-btn");
  const btnTextContent = submitBtn.querySelector(".btn-text-content");
  const btnSpinner = submitBtn.querySelector(".btn-spinner");
  const clearBtn = document.getElementById("clear-btn");
  const charCount = document.getElementById("char-count");
  const errorMessage = document.getElementById("error-message");

  const loadingCard = document.getElementById("loading-card");
  const resultCard = document.getElementById("result-card");
  const checkAnotherBtn = document.getElementById("check-another-btn");

  // Result Elements
  const riskBadge = document.getElementById("risk-badge");
  const riskScoreValue = document.getElementById("risk-score-value");
  const riskScoreBar = document.getElementById("risk-score-bar");
  const resultExplanation = document.getElementById("result-explanation");
  const resultSignals = document.getElementById("result-signals");
  const resultDoNext = document.getElementById("result-do-next");
  const resultAvoid = document.getElementById("result-avoid");
  const resultImportantDetails = document.getElementById("result-important-details");

  // Sample Messages for 1-Click Quick Testing
  const sampleMessages = {
    job: "Congratulations! You have been selected for a job as Remote Project Associate at Apex Global. Pay ₹2,999 registration fee immediately to confirm your position and receive your work laptop.",
    bank: "URGENT: Your SBI account #4892 has been temporarily suspended due to pending KYC. Update immediately at http://sbi-secure-kyc.xyz/login or share your 6-digit OTP to prevent account termination.",
    courier: "DHL Delivery: Your parcel #DH89127 could not be delivered due to an incorrect address. Please verify your address and pay $2.50 redelivery fee here: http://bit.ly/dhl-pkg-update within 24 hours.",
    lottery: "CONGRATULATIONS! Your mobile number won ₹25,00,000 in the KBC Lucky Draw 2026! Call Manager Mr. Sharma on +919876543210 immediately with your Bank Details and processing fee to claim prize.",
    safe: "Hi Sarah, just confirming our project catch-up call tomorrow at 10:00 AM on Google Meet. Let me know if you need to reschedule."
  };

  // Sample Chips Click Handler
  document.querySelectorAll(".sample-chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      const type = chip.getAttribute("data-example");
      if (sampleMessages[type]) {
        messageInput.value = sampleMessages[type];
        updateInputState();
        hideError();
        messageInput.focus();
      }
    });
  });

  // Textarea input event handler
  messageInput.addEventListener("input", () => {
    updateInputState();
    if (errorMessage.style.display !== "none") {
      hideError();
    }
  });

  function updateInputState() {
    const len = messageInput.value.length;
    charCount.textContent = `${len} character${len === 1 ? "" : "s"}`;
    clearBtn.style.display = len > 0 ? "inline-block" : "none";
  }

  // Clear button
  clearBtn.addEventListener("click", () => {
    messageInput.value = "";
    updateInputState();
    hideError();
    resultCard.style.display = "none";
    messageInput.focus();
  });

  // Check Another button
  if (checkAnotherBtn) {
    checkAnotherBtn.addEventListener("click", () => {
      messageInput.value = "";
      updateInputState();
      hideError();
      resultCard.style.display = "none";
      window.scrollTo({ top: 0, behavior: "smooth" });
      messageInput.focus();
    });
  }

  // Show / Hide Error
  function showError(msg) {
    errorMessage.textContent = msg;
    errorMessage.style.display = "block";
  }

  function hideError() {
    errorMessage.textContent = "";
    errorMessage.style.display = "none";
  }

  // Form Submit
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const rawMessage = messageInput.value;
    if (!rawMessage || rawMessage.trim().length === 0) {
      showError("Please paste a message first.");
      messageInput.focus();
      return;
    }

    const message = rawMessage.trim();
    hideError();
    resultCard.style.display = "none";
    loadingCard.style.display = "block";

    // Set Button Loading State
    submitBtn.disabled = true;
    btnTextContent.textContent = "Analyzing...";
    btnSpinner.style.display = "inline-block";

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ message })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to analyze message. Please try again.");
      }

      renderResult(data);
    } catch (err) {
      console.error("Analysis error:", err);
      showError(err.message || "An unexpected error occurred while communicating with ScamCheck AI.");
    } finally {
      loadingCard.style.display = "none";
      submitBtn.disabled = false;
      btnTextContent.textContent = "Check Message";
      btnSpinner.style.display = "none";
    }
  });

  /**
   * Render the structured AI result into the UI
   */
  function renderResult(data) {
    const level = (data.riskLevel || "MEDIUM").toUpperCase();
    const score = typeof data.riskScore === "number" ? Math.min(Math.max(Math.round(data.riskScore), 0), 100) : 50;

    // Reset card classes
    resultCard.className = "card result-card";
    riskBadge.className = "risk-badge";
    riskScoreBar.className = "score-bar-fill";

    // Apply color themes based on riskLevel
    if (level === "HIGH") {
      resultCard.classList.add("risk-high-theme");
      riskBadge.classList.add("badge-high");
      riskBadge.textContent = "HIGH RISK";
      riskScoreBar.classList.add("bar-high");
    } else if (level === "LOW") {
      resultCard.classList.add("risk-low-theme");
      riskBadge.classList.add("badge-low");
      riskBadge.textContent = "LOW RISK";
      riskScoreBar.classList.add("bar-low");
    } else {
      resultCard.classList.add("risk-medium-theme");
      riskBadge.classList.add("badge-medium");
      riskBadge.textContent = "MEDIUM RISK";
      riskScoreBar.classList.add("bar-medium");
    }

    // Set Risk Score and Bar Width
    riskScoreValue.textContent = score;
    riskScoreBar.style.width = `${score}%`;

    // Explanation
    resultExplanation.textContent = data.explanation || "No explanation provided.";

    // Suspicious Signals
    populateList(resultSignals, data.signals, "No suspicious signals detected.");

    // What You Should Do
    populateList(resultDoNext, data.doNext, "Maintain general vigilance.");

    // What You Should NOT Do
    populateList(resultAvoid, data.avoid, "Avoid sharing private security information.");

    // Important Details Detected
    populateList(resultImportantDetails, data.importantDetails, "No specific details detected.");

    // Show Card & Scroll
    resultCard.style.display = "block";
    resultCard.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function populateList(listElement, items, fallbackText) {
    listElement.innerHTML = "";
    if (Array.isArray(items) && items.length > 0) {
      items.forEach((item) => {
        const li = document.createElement("li");
        li.textContent = item;
        listElement.appendChild(li);
      });
    } else {
      const li = document.createElement("li");
      li.textContent = fallbackText;
      listElement.appendChild(li);
    }
  }
});
