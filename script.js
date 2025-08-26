const faucetAddress = "0xeC2DD952D2aa6b7A0329ef7fea4D40717d735309";
const faucetABI = [
  "function claim(address _to) external",
  "event Claimed(address indexed to, uint256 amount)"
];

// === Discord OAuth Login ===
const clientId = "YOUR_DISCORD_CLIENT_ID"; // replace in .env + Vercel
const redirectUri = "https://monpool.vercel.app/callback"; // must match Discord settings
const scope = "identify";

document.getElementById("discordLogin").addEventListener("click", () => {
  const discordAuthUrl =
    `https://discord.com/api/oauth2/authorize?client_id=${clientId}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&response_type=code&scope=${scope}`;
  window.location.href = discordAuthUrl;
});

// === Callback check (after redirect) ===
window.onload = async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const code = urlParams.get("code");

  if (code) {
    try {
      // Hit your backend API to exchange code -> token -> user
      const res = await fetch(`/api/callback?code=${code}`);
      const data = await res.json();

      if (data.username) {
        localStorage.setItem("discordUser", data.username);
        document.getElementById("discordStatus").innerText =
          `✅ Discord Verified: ${data.username}`;
        document.getElementById("claimBtn").disabled = false;
      } else {
        document.getElementById("discordStatus").innerText =
          "❌ Discord verification failed.";
      }
    } catch (err) {
      console.error(err);
      document.getElementById("discordStatus").innerText =
        "❌ Discord verification error.";
    }
  } else if (localStorage.getItem("discordUser")) {
    // Already verified
    document.getElementById("discordStatus").innerText =
      `✅ Discord Verified: ${localStorage.getItem("discordUser")}`;
    document.getElementById("claimBtn").disabled = false;
  }
};

// === Faucet Claim ===
document.getElementById("claimBtn").addEventListener("click", async () => {
  const wallet = document.getElementById("walletAddress").value.trim();
  if (!wallet) {
    alert("Please paste a wallet address");
    return;
  }

  try {
    document.getElementById("status").innerText = "⏳ Sending claim transaction...";

    // Monad testnet RPC
    const provider = new ethers.providers.JsonRpcProvider("https://testnet-rpc.monad.xyz");

    // Require MetaMask
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
  } catch (err) {
    console.error(err);
    document.getElementById("status").innerText = "❌ Claim failed: " + err.message;
  }
});
