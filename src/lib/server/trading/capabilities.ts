import { env } from '$env/dynamic/private';
export function tradingCapabilities() {
  return {
    delegationAvailable: Boolean(env.DYNAMIC_API_KEY && env.DYNAMIC_WEBHOOK_SECRET && env.DYNAMIC_DELEGATION_PRIVATE_KEY),
    liveExecutionAvailable: Boolean(env.DYNAMIC_API_KEY && env.DYNAMIC_DELEGATION_PRIVATE_KEY && env.DEFINITIVE_API_KEY),
  };
}
