const faucetAddress = "0xeC2DD952D2aa6b7A0329ef7fea4D40717d735309";
const faucetABI = [
  "function claim(address _to) external",
  "event Claimed(address indexed to, uint256 amount)"
];

// === Discord OAuth ===
const clientId = "1409928328114339992"; 
const redirectUri = "https://monpool.vercel.app/callback";
const scope = "identify";

// Hook claimBtn
document.getElementById("claimBtn").addEventListener("click", () => {
  const wallet = document.getElementById("walletAddress").value.trim();
  if (!wallet) {
    alert("Please paste a wallet address");
    return;
  }
  localStorage.setItem("pendingWallet", wallet);

  const discordAuthUrl =
    `https://discord.com/api/oauth2/authorize?client_id=${clientId}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&response_type=code&scope=${scope}`;
  window.location.href = discordAuthUrl;
});

// === helper to safely fetch JSON from backend ===
async function safeFetchJSON(url) {
  const res = await fetch(url);
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { success: false, message: text };
  }
}

// === After Discord Redirect ===
window.onload = async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const code = urlParams.get("code");
  const wallet = localStorage.getItem("pendingWallet");

  if (code && wallet) {
    try {
      document.getElementById("status").innerText = "⏳ Verifying Discord...";
      const data = await safeFetchJSON(`/api/callback?code=${code}&wallet=${wallet}`);

      if (!data.success) {
        // Show clean error message from backend
        const errMsg = data.message || data.error || "Discord verification failed";
        document.getElementById("status").innerText = `❌ ${errMsg}`;
        return;
      }

      document.getElementById("status").innerText =
        `✅ Discord Verified: ${data.username}. Sending claim...`;

      if (data.txHash) {
        document.getElementById("status").innerText =
          `✅ Claim successful! Hash: ${data.txHash}`;
      } else {
        // Backend sends readable error messages like "Already claimed" or "Faucet empty"
        const errMsg = data.message || "Claim failed";
        document.getElementById("status").innerText = `❌ ${errMsg}`;
      }

      localStorage.removeItem("pendingWallet");
      window.history.replaceState({}, document.title, "/"); 
    } catch (err) {
      console.error(err);
      document.getElementById("status").innerText =
        "❌ Claim failed: " + err.message;
    }
  }
};
