// /api/callback.js
import { ethers } from "ethers";

export default async function handler(req, res) {
  const { code, wallet } = req.query;

  if (!code) {
    return res.status(400).json({ success: false, error: "Missing code" });
  }
  if (!wallet) {
    return res.status(400).json({ success: false, error: "Missing wallet address" });
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
        redirect_uri: "https://monpool.vercel.app/callback", // must match Discord app settings
      }),
    });

    const tokenData = await tokenResponse.json();
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
    const userData = await userResponse.json();

    if (!userData.id) {
      return res.status(400).json({
        success: false,
        error: "Failed to fetch Discord user",
        details: userData,
      });
    }

    return res.status(200).json({
      success: true,
      id: userData.id,
      username: userData.username,
      discriminator: userData.discriminator,
      // txHash: tx.hash, // uncomment when faucet call is enabled
    });
  } catch (err) {
    console.error("Callback error:", err);
    return res.status(500).json({ success: false, error: "Internal server error", message: err.message });
  }
}
