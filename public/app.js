/**
 * ScamCheck AI — Frontend Client Logic (Version 2.0)
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
  const copyResultBtn = document.getElementById("copy-result-btn");
  const copyBtnText = document.getElementById("copy-btn-text");
  const copyBtnIcon = document.getElementById("copy-btn-icon");

  // Result Elements
  const riskBadge = document.getElementById("risk-badge");
  const categoryBadge = document.getElementById("category-badge");
  const riskScoreValue = document.getElementById("risk-score-value");
  const riskScoreBar = document.getElementById("risk-score-bar");
  const resultExplanation = document.getElementById("result-explanation");
  const resultSignals = document.getElementById("result-signals");
  const resultDoNext = document.getElementById("result-do-next");
  const resultAvoid = document.getElementById("result-avoid");
  const resultImportantDetails = document.getElementById("result-important-details");

  // Current analysis data cache for copying
  let currentAnalysisData = null;

  // Sample Messages for 1-Click Quick Testing (English, Hindi & Hinglish)
  const sampleMessages = {
    reward: "Congratulations! You won ₹25,000. Pay ₹99 processing fee immediately to claim your reward. Click http://claim-reward-now.example.com",
    kyc: "Your bank KYC will expire today. Send your OTP immediately to avoid account closure.",
    hinglishJob: "bhai ₹500 registration fee do aur job confirm hai",
    courier: "DHL Delivery: Your parcel #DH89127 could not be delivered due to an incorrect address. Please verify your address and pay $2.50 redelivery fee here: http://bit.ly/dhl-pkg-update within 24 hours.",
    safeInterview: "Hello, your interview is scheduled for tomorrow at 10 AM. Please bring your resume."
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
    currentAnalysisData = null;
    messageInput.focus();
  });

  // Check Another button
  if (checkAnotherBtn) {
    checkAnotherBtn.addEventListener("click", () => {
      messageInput.value = "";
      updateInputState();
      hideError();
      resultCard.style.display = "none";
      currentAnalysisData = null;
      window.scrollTo({ top: 0, behavior: "smooth" });
      messageInput.focus();
    });
  }

  // Copy Result Function with Clipboard API & Textarea Fallback
  async function copyAnalysisToClipboard(data) {
    if (!data) return false;

    const textToCopy = formatAnalysisForClipboard(data);

    // Method 1: Modern Clipboard API
    if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
      try {
        await navigator.clipboard.writeText(textToCopy);
        return true;
      } catch (err) {
        console.warn("navigator.clipboard failed, attempting fallback:", err);
      }
    }

    // Method 2: Fallback using temporary textarea
    try {
      const textarea = document.createElement("textarea");
      textarea.value = textToCopy;
      textarea.setAttribute("readonly", "");
      textarea.style.position = "fixed";
      textarea.style.left = "-9999px";
      textarea.style.top = "-9999px";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      textarea.setSelectionRange(0, 99999); // Mobile compatibility

      const successful = document.execCommand("copy");
      document.body.removeChild(textarea);
      return !!successful;
    } catch (fallbackErr) {
      console.error("Fallback clipboard copy failed:", fallbackErr);
      return false;
    }
  }

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

  let copyTimeoutId = null;

  function resetCopyButton() {
    if (copyTimeoutId) {
      clearTimeout(copyTimeoutId);
      copyTimeoutId = null;
    }
    if (copyResultBtn) {
      copyResultBtn.classList.remove("copied");
      if (copyBtnIcon) copyBtnIcon.textContent = "📋";
      if (copyBtnText) copyBtnText.textContent = "Copy Result";
    }
  }

  // Copy Result Button Click Handler
  if (copyResultBtn) {
    copyResultBtn.addEventListener("click", async () => {
      if (!currentAnalysisData) {
        alert("No analysis result to copy. Please check a message first.");
        return;
      }

      const success = await copyAnalysisToClipboard(currentAnalysisData);

      if (success) {
        copyResultBtn.classList.add("copied");
        if (copyBtnIcon) copyBtnIcon.textContent = "✅";
        if (copyBtnText) copyBtnText.textContent = "Copied!";

        if (copyTimeoutId) clearTimeout(copyTimeoutId);
        copyTimeoutId = setTimeout(() => {
          resetCopyButton();
        }, 2000);
      } else {
        alert("Copy failed. Please try again.");
      }
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

      currentAnalysisData = data;
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
    resetCopyButton();
    const level = (data.riskLevel || "MEDIUM").toUpperCase();
    const score = typeof data.riskScore === "number" ? Math.min(Math.max(Math.round(data.riskScore), 0), 100) : 50;
    const category = data.category || "Scam Analysis";

    // Reset card classes
    resultCard.className = "card result-card";
    riskBadge.className = "risk-badge";
    riskScoreBar.className = "score-bar-fill";

    // Category
    categoryBadge.textContent = category;

    // Apply 4-tier color themes based on riskLevel:
    // CRITICAL (80-100), HIGH (60-79), MEDIUM (30-59), LOW (0-29)
    if (level === "CRITICAL" || score >= 80) {
      resultCard.classList.add("risk-critical-theme");
      riskBadge.classList.add("badge-critical");
      riskBadge.textContent = "CRITICAL RISK";
      riskScoreBar.classList.add("bar-critical");
    } else if (level === "HIGH" || score >= 60) {
      resultCard.classList.add("risk-high-theme");
      riskBadge.classList.add("badge-high");
      riskBadge.textContent = "HIGH RISK";
      riskScoreBar.classList.add("bar-high");
    } else if (level === "MEDIUM" || score >= 30) {
      resultCard.classList.add("risk-medium-theme");
      riskBadge.classList.add("badge-medium");
      riskBadge.textContent = "MEDIUM RISK";
      riskScoreBar.classList.add("bar-medium");
    } else {
      resultCard.classList.add("risk-low-theme");
      riskBadge.classList.add("badge-low");
      riskBadge.textContent = "LOW RISK";
      riskScoreBar.classList.add("bar-low");
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
