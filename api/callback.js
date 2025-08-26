import { ethers } from "ethers";

const faucetAddress = "0xeC2DD952D2aa6b7A0329ef7fea4D40717d735309";
const faucetABI = ["function claim(address _to) external"];

// --- helper to safely parse json ---
async function safeJson(response) {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text }; // fallback if not JSON
  }
}

export default async function handler(req, res) {
  const { code, wallet } = req.query;

  if (!code) {
    return res.status(400).json({ success: false, error: "Missing code" });
  }
  if (!wallet) {
    return res.status(400).json({ success: false, error: "Missing wallet" });
  }

  try {
    // === Step 1: Exchange code -> token
    const tokenResponse = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.DISCORD_CLIENT_ID,
        client_secret: process.env.DISCORD_CLIENT_SECRET,
        grant_type: "authorization_code",
        code,
        redirect_uri: "https://monpool.vercel.app/callback",
      }),
    });

    const tokenData = await safeJson(tokenResponse);
    console.log("Token data:", tokenData); // <-- debug
    if (!tokenData.access_token) {
      return res.status(400).json({
        success: false,
        error: "Failed to get access token",
        details: tokenData,
      });
    }

    // === Step 2: Get Discord user
    const userResponse = await fetch("https://discord.com/api/users/@me", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const userData = await safeJson(userResponse);
    console.log("User data:", userData); // <-- debug
    if (!userData.id) {
      return res.status(400).json({
        success: false,
        error: "Failed to fetch Discord user",
        details: userData,
      });
    }

    // === Step 3: Faucet Claim ===
    try {
      const provider = new ethers.providers.JsonRpcProvider(process.env.RPC_URL);
      const signer = new ethers.Wallet(process.env.FAUCET_PRIVATE_KEY, provider);

      const faucet = new ethers.Contract(faucetAddress, faucetABI, signer);

      console.log("Sending claim to faucet:", wallet); // <-- debug
      const tx = await faucet.claim(wallet);
      await tx.wait();
      console.log("Claim tx hash:", tx.hash); // <-- debug

      return res.status(200).json({
        success: true,
        username: userData.username,
        discriminator: userData.discriminator,
        wallet,
        txHash: tx.hash,
      });
    } catch (txErr) {
      console.error("Faucet claim error:", txErr);
      return res.status(500).json({
        success: false,
        error: "Faucet claim failed",
        message: txErr.message,
      });
    }
  } catch (err) {
    console.error("Callback error:", err);
    return res.status(500).json({
      success: false,
      error: "Internal server error",
      message: err.message,
    });
  }
}
