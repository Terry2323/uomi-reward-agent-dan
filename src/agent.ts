// src/agent.ts
// Dani — UOMI Reward Agent (WASP-ready)
// This tries to use the WASP SDK if available; otherwise runs a safe simulation so the process works on Railway.

import http from "http";

type EventCtx = {
  event: any;
  user?: string;
  rewards?: any;
  log?: { info?: (s: string) => void; debug?: (s: string) => void; error?: (s: string) => void };
};

class RewardAgent {
  name: string;
  description: string;
  wallet: string;
  token: string;

  constructor(name: string, description: string, wallet: string, token = "UOMI") {
    this.name = name;
    this.description = description;
    this.wallet = wallet;
    this.token = token;
  }

  async onStart() {
    console.log(`🚀 Reward Agent ${this.name} is starting...`);
    console.log(`📝 ${this.description}`);
    console.log(`💳 Wallet: ${this.wallet}`);
    console.log(`🎁 Ready to reward in ${this.token}`);
  }

  checkCondition(eventType: string) {
    if (!eventType) return { shouldReward: false };
    if (eventType === "faucet_claim:first_time" || eventType === "first_faucet_claim") {
      return { shouldReward: true, reason: "First faucet claim", amount: 10 };
    }
    if (eventType === "daily_active") {
      return { shouldReward: true, reason: "Daily active", amount: 5 };
    }
    return { shouldReward: false };
  }

  async sendReward(ctx: EventCtx, toUser: string, amount: number, reason: string) {
    try {
      if (ctx.rewards && typeof ctx.rewards.send === "function") {
        // SDK path (will run only if SDK provides ctx.rewards.send)
        await ctx.rewards.send({
          to: toUser,
          amount,
          token: this.token,
          memo: reason
        });
        ctx.log?.info?.(`🎁 Sent ${amount} ${this.token} to ${toUser} — ${reason}`);
      } else {
        // Simulation / fallback path: just log
        console.log(`💸 (SIMULATION) Would send ${amount} ${this.token} to ${toUser} — ${reason}`);
      }
    } catch (err) {
      console.error("Failed to send reward:", err);
      ctx.log?.error?.(`sendReward error: ${err}`);
    }
  }

  async handleEvent(ctx: EventCtx) {
    const eventType = ctx.event?.type || ctx.event?.name || "unknown_event";
    const user = ctx.event?.user || ctx.user || ctx.event?.payload?.user || "unknown_user";
    const { shouldReward, reason, amount } = this.checkCondition(eventType);

    if (shouldReward && amount && reason) {
      console.log(`✅ Condition met: ${reason} (event: ${eventType})`);
      await this.sendReward(ctx, user, amount, reason);
    } else {
      console.log(`ℹ️ No reward for event: ${eventType}`);
    }
  }
}

async function startAgent() {
  const AGENT_NAME = "Dani";
  const AGENT_DESCRIPTION = "A Reward Agent that gives UOMI for specific milestones";
  const AGENT_WALLET = "0x5da08546bff22a41b596424d454eb4191add0035";

  const rewardAgent = new RewardAgent(AGENT_NAME, AGENT_DESCRIPTION, AGENT_WALLET);

  await rewardAgent.onStart();

  // Try to load WASP SDK dynamically (if package and env are present)
  let useSdk = false;
  let wasp: any = null;

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    wasp = require("@uomi/wasp");
    if (wasp) useSdk = true;
    console.log("WASP SDK loaded. Will attempt to initialize SDK agent.");
  } catch (e) {
    console.log("WASP SDK not installed — running in simulation mode. To enable SDK, add @uomi/wasp dependency.");
  }

  if (useSdk) {
    try {
      // Attempt to adapt to common SDK patterns. The exact API names may differ by version.
      // If the SDK docs show different names, those small parts should be updated.
      const AgentClass = wasp.Agent || wasp.default?.Agent || wasp.createAgent || null;

      if (AgentClass) {
        const sdkAgent = new AgentClass({
          name: AGENT_NAME,
          description: AGENT_DESCRIPTION,
          wallet: AGENT_WALLET
        });

        // Register handlers if SDK exposes `on`
        if (typeof sdkAgent.on === "function") {
          sdkAgent.on("faucet_claim:first_time", async (ctx: any) => rewardAgent.handleEvent(ctx));
          sdkAgent.on("daily_active", async (ctx: any) => rewardAgent.handleEvent(ctx));
          sdkAgent.on("*", async (ctx: any) => rewardAgent.handleEvent(ctx));
        }

        // Start the SDK agent (names may differ)
        if (typeof sdkAgent.start === "function") {
          await sdkAgent.start();
        } else if (typeof wasp.start === "function") {
          await wasp.start(sdkAgent);
        } else {
          console.log("SDK loaded but no start() found — falling back to simulation.");
          await runSimulation(rewardAgent);
        }
        return;
      } else {
        console.log("WASP SDK present but Agent constructor not detected. Running simulation.");
        await runSimulation(rewardAgent);
      }
    } catch (e) {
      console.error("Error initializing WASP SDK, falling back to simulation:", e);
      await runSimulation(rewardAgent);
    }
  } else {
    // No SDK: run the guaranteed simulation so process stays alive and prints reward behavior
    await runSimulation(rewardAgent);
  }
}

async function runSimulation(agent: RewardAgent) {
  const simulatedEvents = [
    { type: "faucet_claim:first_time", user: "0xUserA", payload: {} },
    { type: "random_event", user: "0xUserB", payload: {} },
    { type: "daily_active", user: "0xUserC", payload: {} }
  ];

  for (const ev of simulatedEvents) {
    await new Promise((r) => setTimeout(r, 1000));
    const ctx = { event: ev, user: ev.user, rewards: undefined, log: console } as EventCtx;
    await agent.handleEvent(ctx);
  }

  console.log("✅ Simulation complete. When you wire the WASP SDK, real rewards can be sent.");
}

// Run
if (require.main === module) {
  startAgent().catch((e) => {
    console.error("Agent failed:", e);
    process.exit(1);
  });
}

// ------- tiny keep-alive server so hosts don't kill the process -------
const PORT = process.env.PORT || 3000;
http.createServer((_req, res) => res.end("Dani is running")).listen(PORT, () => {
  console.log(`HTTP keepalive listening on port ${PORT}`);
});
