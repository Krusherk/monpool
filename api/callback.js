import { ethers } from "ethers";
import admin from "firebase-admin";

// Initialize Firebase Admin SDK (only once)
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    }),
    databaseURL: process.env.FIREBASE_DATABASE_URL,
  });
}
const db = admin.database();

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
    if (!userData.id) {
      return res.status(400).json({
        success: false,
        error: "Failed to fetch Discord user",
        details: userData,
      });
    }

    const discordId = userData.id;
    const username = `${userData.username}#${userData.discriminator}`;

    // === Step 3: Check Firebase cooldown ===
    const userRef = db.ref(`claims/${discordId}`);
    const snapshot = await userRef.get();
    const now = Date.now();

    if (snapshot.exists()) {
      const lastClaim = snapshot.val().lastClaim;
      if (now - lastClaim < 24 * 60 * 60 * 1000) {
        return res.status(429).json({
          success: false,
          error: "Cooldown active",
          message: `⏳ ${username}, you must wait before claiming again.`,
        });
      }
    }

    // === Step 4: Faucet Claim ===
    try {
      const provider = new ethers.providers.JsonRpcProvider(process.env.RPC_URL);
      const signer = new ethers.Wallet(process.env.FAUCET_PRIVATE_KEY, provider);

      const faucet = new ethers.Contract(faucetAddress, faucetABI, signer);

      console.log("Sending claim to faucet:", wallet);
      const tx = await faucet.claim(wallet);
      await tx.wait();
      console.log("Claim tx hash:", tx.hash);

      // Save claim in Firebase
      await userRef.set({
        username,
        wallet,
        lastClaim: now,
      });

      return res.status(200).json({
        success: true,
        username,
        wallet,
        txHash: tx.hash,
      });
    } catch (txErr) {
      console.error("Faucet claim error:", txErr);

      let message = "Transaction failed. Please try again.";
      if (txErr.reason?.includes("Already claimed") || txErr.message?.includes("Already claimed")) {
        message = "⛔ You have already claimed. Try again later.";
      } else if (txErr.reason?.includes("Faucet empty") || txErr.message?.includes("Faucet empty")) {
        message = "💧 Faucet is empty. Please wait for refill.";
      }

      return res.status(400).json({
        success: false,
        error: "Faucet claim failed",
        message,
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
