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

export function signerFailure(error) {
  const status = Number(error?.status);
  const code = typeof error?.code === 'string' ? error.code : '';
  if (status === 400 || error?.message === 'Invalid request') {
    throw Error(code
      ? `Dynamic rejected the wallet signature (${code}).`
      : 'Dynamic rejected the wallet signature. Cassie asked it to sign a Base token approval.');
  }
  throw error;
}
