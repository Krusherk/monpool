const faucetAddress = "0xeC2DD952D2aa6b7A0329ef7fea4D40717d735309";
const faucetABI = [
  "function claim(address _to) external",
  "event Claimed(address indexed to, uint256 amount)"
];

// === Discord OAuth ===
const clientId = (typeof process !== "undefined" && process.env.DISCORD_CLIENT_ID) 
  ? process.env.DISCORD_CLIENT_ID 
  : "1409928328114339992"; 
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

// === After Discord Redirect ===
window.onload = async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const code = urlParams.get("code");
  const wallet = localStorage.getItem("pendingWallet");

  // ✅ Only run auto-claim if both code + wallet exist
  if (code && wallet) {
    try {
      document.getElementById("status").innerText = "⏳ Verifying Discord...";

      // Exchange code -> token -> user via backend
      const res = await fetch(`/api/callback?code=${code}`);
      const data = await res.json();

      if (!data.username) {
        document.getElementById("status").innerText = "❌ Discord verification failed.";
        return;
      }

      document.getElementById("status").innerText =
        `✅ Discord Verified: ${data.username}. Sending claim...`;

      // === Faucet Claim ===
      const provider = new ethers.providers.JsonRpcProvider("https://testnet-rpc.monad.xyz");

      if (!window.ethereum) {
        alert("MetaMask required to sign claim!");
        return;
      }

      await window.ethereum.request({ method: "eth_requestAccounts" });
      const signer = new ethers.providers.Web3Provider(window.ethereum).getSigner();

      const faucet = new ethers.Contract(faucetAddress, faucetABI, signer);
      const tx = await faucet.claim(wallet);
      document.getElementById("status").innerText = `⏳ Tx sent: ${tx.hash}`;

      await tx.wait();
      document.getElementById("status").innerText = `✅ Claim successful! Hash: ${tx.hash}`;

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
