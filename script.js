const faucetAddress = "0xeC2DD952D2aa6b7A0329ef7fea4D40717d735309";
const faucetABI = [
  "function claim(address _to) external",
  "event Claimed(address indexed to, uint256 amount)"
];

// Discord OAuth (placeholder: needs backend redirect)
document.getElementById("discordLogin").addEventListener("click", () => {
  // Replace with your actual Discord OAuth2 URL
  const clientId = "YOUR_DISCORD_CLIENT_ID";
  const redirectUri = encodeURIComponent(window.location.origin);
  const scope = "identify";
  window.location.href = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=token&scope=${scope}`;
});

// Check if Discord token in URL (after redirect)
window.onload = () => {
  if (window.location.hash.includes("access_token")) {
    document.getElementById("discordStatus").innerText = "✅ Discord Verified!";
    document.getElementById("claimBtn").disabled = false;
  }
};

document.getElementById("claimBtn").addEventListener("click", async () => {
  const wallet = document.getElementById("walletAddress").value.trim();
  if (!wallet) {
    alert("Please paste a wallet address");
    return;
  }

  try {
    document.getElementById("status").innerText = "⏳ Sending claim transaction...";

    // Use a public RPC (Monad testnet)
    const provider = new ethers.providers.JsonRpcProvider("https://testnet-rpc.monad.xyz");

    // You need a funded signer (server-side preferred)
    // For demo, we connect via a browser wallet like MetaMask
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
