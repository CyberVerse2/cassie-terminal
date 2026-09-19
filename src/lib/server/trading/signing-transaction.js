import { getAddress, hashTypedData } from 'viem';

const FLASH_ORDER = [
  ['swapper', 'address'],
  ['vault', 'address'],
  ['recipient', 'address'],
  ['fromToken', 'address'],
  ['toToken', 'address'],
  ['fromAmount', 'uint256'],
  ['salt', 'uint256'],
  ['deadline', 'uint256'],
];

export function signingTransaction(request, chainId) {
  if (!Number.isInteger(chainId) || chainId <= 0) throw Error('Missing signing chain.');
  if (typeof request?.to !== 'string' || request.nonce == null || request.gas == null || request.maxFeePerGas == null || request.maxPriorityFeePerGas == null) {
    throw Error('Approval transaction is incomplete.');
  }
  return {
    type: 'eip1559',
    chainId,
    nonce: Number(request.nonce),
    to: request.to,
    data: request.data ?? '0x',
    value: request.value ?? 0n,
    gas: request.gas,
    maxFeePerGas: request.maxFeePerGas,
    maxPriorityFeePerGas: request.maxPriorityFeePerGas,
  };
}

export function signingTypedData(data) {
  const domain = data?.domain;
  const message = data?.message;
  const chainId = Number(domain?.chainId);
  if (data?.primaryType !== 'FlashOrder' || !domain || !message || !Number.isInteger(chainId) || chainId <= 0) {
    throw Error('Order signature is incomplete.');
  }
  const typedData = {
    types: { FlashOrder: FLASH_ORDER.map(([name, type]) => ({ name, type })) },
    primaryType: 'FlashOrder',
    domain: {
      name: String(domain.name),
      version: String(domain.version),
      chainId,
      verifyingContract: getAddress(domain.verifyingContract),
    },
    message: {
      swapper: getAddress(message.swapper),
      vault: getAddress(message.vault),
      recipient: getAddress(message.recipient),
      fromToken: getAddress(message.fromToken),
      toToken: getAddress(message.toToken),
      fromAmount: BigInt(message.fromAmount),
      salt: BigInt(message.salt),
      deadline: BigInt(message.deadline),
    },
  };
  hashTypedData(typedData);
  return typedData;
}

export function signerFailure(error, kind = 'approval') {
  const status = Number(error?.status ?? error?.http?.status_code);
  const code = typeof error?.code === 'string' ? error.code : '';
  if (status === 400 || error?.message === 'Invalid request') {
    const action = kind === 'order'
      ? 'Cassie asked it to sign the trade order.'
      : 'Cassie asked it to sign a Base token approval.';
    throw Error(code ? `Dynamic rejected the wallet signature (${code}). ${action}` : `Dynamic rejected the wallet signature. ${action}`);
  }
  throw error;
}
