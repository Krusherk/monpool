const faucetAddress = "0xeC2DD952D2aa6b7A0329ef7fea4D40717d735309";
const faucetABI = [
  "function claim(address _to) external",
  "event Claimed(address indexed to, uint256 amount)"
];

// === Discord OAuth ===
const clientId = "1409928328114339992"; 
const redirectUri = "https://monpool.vercel.app/callback"; // must match Discord settings
const scope = "identify";

// Hook claimBtn
document.getElementById("claimBtn").addEventListener("click", () => {
  const wallet = document.getElementById("walletAddress").value.trim();
  if (!wallet) {
    alert("Please paste a wallet address");
    return;
  }
  // Store wallet so we can use it after redirect
  localStorage.setItem("pendingWallet", wallet);

  // Redirect to Discord auth
  const discordAuthUrl =
    `https://discord.com/api/oauth2/authorize?client_id=${clientId}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&response_type=code&scope=${scope}`;
  window.location.href = discordAuthUrl;
});

// === Safe fetch to handle JSON or plain text errors ===
async function safeFetchJSON(url) {
  const res = await fetch(url);
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { success: false, message: text }; // fallback if not JSON
  }
}

// === After Discord Redirect ===
window.onload = async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const code = urlParams.get("code");
  const wallet = localStorage.getItem("pendingWallet");

  // ✅ Only run auto-claim if both code + wallet exist
  if (code && wallet) {
    try {
      document.getElementById("status").innerText = "⏳ Verifying Discord...";

      // Exchange code -> token -> user via backend (safe)
      const data = await safeFetchJSON(`/api/callback?code=${code}&wallet=${wallet}`);

      if (!data.success) {
        // show detailed backend error if available
        const errMsg = data.message || JSON.stringify(data.details) || "Discord verification failed";
        document.getElementById("status").innerText = `❌ ${errMsg}`;
        return;
      }

      document.getElementById("status").innerText =
        `✅ Discord Verified: ${data.username}. Sending claim...`;

      // Wait for backend claim result
      if (data.txHash) {
        document.getElementById("status").innerText =
          `✅ Claim successful! Hash: ${data.txHash}`;
      } else {
        // show backend error if claim failed
        const errMsg = data.message || JSON.stringify(data.data) || "Claim failed";
        document.getElementById("status").innerText = `❌ ${errMsg}`;
      }

      // clear saved wallet & URL params
      localStorage.removeItem("pendingWallet");
      window.history.replaceState({}, document.title, "/"); 
    } catch (err) {
      console.error(err);
      document.getElementById("status").innerText =
        "❌ Claim failed: " + err.message;
    }
  }
};
