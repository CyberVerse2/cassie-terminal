<script>
  import { authUi } from '$lib/auth-ui.svelte.js';
  import { tradingSetup, openSetup, createTradingWallet, revokeTradingAccess, loadTradingSettings } from '$lib/trading/session.svelte.js';
  import { usd } from '$lib/trading/settings.js';
  import { authHeaders } from '$lib/dynamic/auth.js';
  import { connectionCheckMessage, executionDelegation } from '$lib/trading/approval.js';

  let error = $state('');
  let busy = $state(false);
  let copied = $state('');
  let connectionNote = $state('');

  async function run(action) {
    busy = true;
    error = '';
    try {
      await action();
    } catch (e) {
      error = e.message;
    } finally {
      busy = false;
    }
  }

  async function copy(wallet) {
    await navigator.clipboard.writeText(wallet.address);
    copied = wallet.id;
  }

  async function checkConnection(wallet) {
    connectionNote = '';
    error = '';
    try {
      await loadTradingSettings();
      if (tradingSetup.error) {
        error = tradingSetup.error;
        return;
      }
      const query = new URLSearchParams({
        address: wallet.address,
        chain: wallet.chain === 'SOL' ? 'SOL' : 'EVM',
      });
      const response = await fetch(`/api/trading/delegation/status?${query}`, {
        headers: authHeaders(),
        signal: AbortSignal.timeout(12000),
      });
      const data = await response.json();
      if (!response.ok) {
        error = data.error || 'Could not check Dynamic.';
        return;
      }
      connectionNote = data.message;
    } catch (e) {
      error = e.message;
    }
  }

  function shortAddress(address) {
    if (!address || address.length < 12) return address;
    return `${address.slice(0, 6)}…${address.slice(-4)}`;
  }

  function walletLine(wallet) {
    if (!wallet.delegated) return 'Trading permissions are off.';
    if (executionDelegation(wallet, tradingSetup)) return 'Ready to sign trades.';
    return connectionNote || connectionCheckMessage(wallet, tradingSetup) || 'Approval is complete. Cassie cannot sign yet.';
  }
</script>

<section class="sheet" aria-label="Wallet and trading permissions">
  {#if !authUi.user}
    <p class="note">Sign in to fund a wallet and save your trading limits.</p>
    <button type="button" onclick={() => authUi.openSignIn()}>Sign in</button>
  {:else}
    {#if tradingSetup.loading}
      <p class="note" role="status">Loading your settings…</p>
    {:else if tradingSetup.error}
      <p class="error" role="alert">{tradingSetup.error}</p>
      <button type="button" onclick={loadTradingSettings}>Try again</button>
    {/if}

    <div class="block">
      <div class="head">
        <div class="eyebrow">LIMITS</div>
        <button type="button" disabled={busy || tradingSetup.loading} onclick={() => openSetup(tradingSetup.settings ? 1 : 0)}>
          {tradingSetup.settings ? 'Edit limits' : 'Set limits'}
        </button>
      </div>
      {#if tradingSetup.settings}
        <div class="figures">
          <div>
            <div class="eyebrow">PER TRADE</div>
            <div class="figure">{usd(tradingSetup.settings.amountUsd)}</div>
          </div>
          <div>
            <div class="eyebrow">MAX CAPITAL</div>
            <div class="figure">{usd(tradingSetup.settings.maxDeployedUsd)}</div>
          </div>
          <div>
            <div class="eyebrow">POSITIONS</div>
            <div class="figure">{tradingSetup.settings.maxPositions}</div>
          </div>
        </div>
      {/if}
    </div>

    <div class="block">
      <div class="eyebrow">WALLET</div>
      {#each tradingSetup.wallets as wallet}
        <div class="wallet">
          <div class="wallet-row">
            <code title={wallet.address}>{wallet.chain === 'SOL' ? 'SOL' : 'EVM'} {shortAddress(wallet.address)}</code>
            <button type="button" disabled={busy} onclick={() => run(() => copy(wallet))}>
              {copied === wallet.id ? 'Copied' : 'Copy'}
            </button>
          </div>
          <p class="note">{walletLine(wallet)}</p>
          <div class="actions">
            {#if wallet.delegated && !executionDelegation(wallet, tradingSetup)}
              <button type="button" disabled={tradingSetup.loading} onclick={() => checkConnection(wallet)}>
                {tradingSetup.loading ? 'Checking…' : 'Check connection'}
              </button>
            {/if}
            {#if wallet.delegated}
              <button type="button" class="text" disabled={busy} onclick={() => run(() => revokeTradingAccess(wallet))}>
                Revoke
              </button>
            {/if}
          </div>
        </div>
      {:else}
        <p class="note">Create a wallet to receive funds.</p>
        <div class="actions">
          <button type="button" disabled={busy} onclick={() => run(() => createTradingWallet('EVM'))}>Create EVM wallet</button>
          <button type="button" disabled={busy} onclick={() => run(() => createTradingWallet('SOL'))}>Create Solana wallet</button>
        </div>
      {/each}
    </div>
  {/if}

  {#if busy}
    <p class="note" role="status">Complete the wallet request…</p>
  {/if}
  {#if error}
    <p class="error" role="alert">{error}</p>
  {/if}
</section>

<slot />

<style>
  .sheet { margin-top: 28px; }
  .block { margin-top: 34px; }
  .eyebrow {
    font-size: 10px;
    letter-spacing: 0.13em;
    font-weight: 700;
    color: #6e6e6e;
  }
  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 12px;
  }
  .figures {
    display: flex;
    gap: 40px;
    align-items: flex-end;
    flex-wrap: wrap;
  }
  .figure {
    margin-top: 6px;
    font-family: var(--font-mono);
    font-size: 19px;
    font-weight: 600;
    line-height: 1;
  }
  .wallet { margin-top: 10px; }
  .wallet-row {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 12px;
  }
  .wallet-row code {
    min-width: 0;
    font: 14.5px var(--font-mono);
    font-weight: 600;
    color: #eee;
  }
  .note {
    margin: 8px 0 0;
    color: #8c8c8c;
    font-size: 13px;
    line-height: 1.45;
  }
  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 10px;
  }
  button {
    background: transparent;
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 7px;
    padding: 5px 12px;
    color: #8c8c8c;
    font: 600 11px var(--font-ui);
    cursor: pointer;
  }
  button.text {
    border-color: transparent;
    padding-left: 0;
    padding-right: 0;
  }
  button:disabled { opacity: 0.5; cursor: wait; }
  button:focus-visible { outline: 2px solid #B5F20B; outline-offset: 3px; }
  .error { margin: 8px 0 0; color: #FF78B8; font-size: 13px; }
</style>
