import { browser } from '$app/environment';
import { env } from '$env/dynamic/public';
import { createDynamicClient, initializeClient } from '@dynamic-labs-sdk/client';
import { addEvmExtension } from '@dynamic-labs-sdk/evm';

export const dynamicEnvironmentId = env.PUBLIC_DYNAMIC_ENVIRONMENT_ID ?? '';

export const dynamicClient = browser && dynamicEnvironmentId
  ? createDynamicClient({
      autoInitialize: false,
      environmentId: dynamicEnvironmentId,
      metadata: {
        name: 'Cassie',
        universalLink: browser ? window.location.origin : 'http://localhost:5173',
      },
    })
  : null;

if (dynamicClient) { addEvmExtension(); initializeClient(); }
