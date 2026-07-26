import { betterAuth } from "better-auth/minimal";
import { createClient, type GenericCtx } from "@convex-dev/better-auth";
import { convex, crossDomain } from "@convex-dev/better-auth/plugins";

import { components } from "./_generated/api";

import { query } from "./_generated/server";
import authConfig from "./auth.config";

import type { DataModel } from "./_generated/dataModel";

const siteUrl = process.env.SITE_URL!;

export const authComponent = createClient<DataModel>(components.betterAuth);

// Only enabled once DISCORD_CLIENT_ID/SECRET are set (`npx convex env set`),
// so a fresh checkout with no Discord app configured still boots normally.
const discordClientId = process.env.DISCORD_CLIENT_ID;
const discordClientSecret = process.env.DISCORD_CLIENT_SECRET;
const isDiscordEnabled = Boolean(discordClientId && discordClientSecret);

export const createAuth = (ctx: GenericCtx<DataModel>) => {
  return betterAuth({
    baseURL: process.env.CONVEX_SITE_URL,
    trustedOrigins: [siteUrl],
    database: authComponent.adapter(ctx),
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,
    },
    socialProviders: isDiscordEnabled
      ? {
          discord: {
            clientId: discordClientId!,
            clientSecret: discordClientSecret!,
          },
        }
      : undefined,
    plugins: [crossDomain({ siteUrl }), convex({ authConfig })],
  });
};

export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    return authComponent.getAuthUser(ctx);
  },
});
