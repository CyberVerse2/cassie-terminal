<script>
  import { onMount } from 'svelte';
  import { ArrowRight, ArrowLeft, Check, X, ShieldCheck, SlidersHorizontal, Bot } from '@lucide/svelte';
  import { tradingSetup, approveTradingAccess } from '$lib/trading/session.svelte.js';
  import { validateSettings, usd } from '$lib/trading/settings.js';
  import { authUi } from '$lib/auth-ui.svelte.js';
  import { executionDelegation } from '$lib/trading/approval.js';
  let { onPortfolio }=$props();
  let dialog, amount=$state(tradingSetup.settings?.amountUsd ?? 200), capital=$state(tradingSetup.settings?.maxDeployedUsd ?? 1000), positions=$state(tradingSetup.settings?.maxPositions ?? 3);
  let busy=$state(false), error=$state('');
  let walletId=$state('');
  const step=$derived(tradingSetup.step);
  const approvedWallet=$derived(tradingSetup.wallets.find(w=>w.address===tradingSetup.approvedWalletAddress));
  const executionReady=$derived(executionDelegation(approvedWallet,tradingSetup));
  const names=['Meet Cassie','Your limits','Permissions','First trade'];
  onMount(()=>dialog.showModal());
  function close(){if(!busy)tradingSetup.open=false;}
  function next(){error='';try{if(step===1)validateSettings({amountUsd:amount,maxDeployedUsd:capital,maxPositions:positions});tradingSetup.step++;}catch(e){error=e.message;}}
  async function save(){busy=true;error='';try{await approveTradingAccess({amountUsd:amount,maxDeployedUsd:capital,maxPositions:positions},walletId);tradingSetup.step=3;}catch(e){error=e.message;}finally{busy=false;}}
</script>
<dialog bind:this={dialog} aria-labelledby="onboarding-title" oncancel={e=>{e.preventDefault();close();}}>
  <header><span>Cassie</span><button class="icon" aria-label="Close trading setup" disabled={busy} onclick={close}><X size={18}/></button></header>
  <nav aria-label="Trading setup progress">{#each names as name,i}<span class:current={step===i} class:done={step>i} aria-current={step===i?'step':undefined} title={name}>{#if step>i}<Check size={12}/>{:else}{i+1}{/if}</span>{#if i<3}<i class:done={step>i}></i>{/if}{/each}</nav>
  {#if step===0}
    <div class="symbol"><Bot size={30} strokeWidth={1.5}/></div><h1 id="onboarding-title">Welcome to Cassie.</h1>
    <p class="intro">Cassie tracks smart money on Twitter and surfaces trade opportunities in the feed on your left.</p>
    <div class="features"><p><SlidersHorizontal size={18}/><span><strong>You set the limits.</strong> Choose how much goes into each trade and how much can be in play.</span></p><p><ShieldCheck size={18}/><span><strong>She prepares the plan. You approve the trade.</strong> Cassie then executes it and manages the position over time, from entry to exit, within your limits.</span></p></div>
    <p class="muted">Your wallet stays yours. Funding, limits, and permission controls live in Portfolio.</p>
    <button class="primary" onclick={next}>Set my limits <ArrowRight size={16}/></button>
  {:else if step===1}
    <h1 id="onboarding-title">Your money.<br/>Your boundaries.</h1><p class="intro">These settings apply each time you choose Execute trade.</p>
    <label for="setup-amount">Amount per trade</label><div class="chips">{#each [50,100,200,500] as n}<button class:selected={amount===n} aria-pressed={amount===n} onclick={()=>amount=n}>{usd(n)}</button>{/each}</div>
    <div class="money-input"><span>$</span><input id="setup-amount" type="number" min="1" max="1000000" step="0.01" bind:value={amount}/></div>
    <label for="setup-capital">Maximum capital in open trades</label><div class="chips">{#each [500,1000,2500,5000] as n}<button class:selected={capital===n} aria-pressed={capital===n} onclick={()=>capital=n}>{usd(n)}</button>{/each}</div>
    <div class="money-input"><span>$</span><input id="setup-capital" type="number" min="1" max="1000000" step="0.01" bind:value={capital}/></div>
    <label for="setup-positions">Maximum open positions</label><select id="setup-positions" bind:value={positions}>{#each [1,2,3,5,10,20] as n}<option value={n}>{n} at a time</option>{/each}</select>
    <p class="muted">Capital limits control allocation, not a guaranteed maximum loss. You can change them in Portfolio.</p>
    <button class="primary" onclick={next}>Review permissions <ArrowRight size={16}/></button>
  {:else if step===2}
    <div class="symbol"><ShieldCheck size={30} strokeWidth={1.5}/></div><h1 id="onboarding-title">Give Cassie room<br/>to manage.</h1>
    <div class="review"><div><span>Each trade</span><strong>{usd(amount)}</strong></div><div><span>Total capital</span><strong>{usd(capital)}</strong></div><div><span>Open positions</span><strong>{positions}</strong></div></div>
    <p class="intro">You choose each new trade. Cassie can manage its exits, take partial profit, and close it without asking again.</p>
    <p class="muted">It cannot add capital beyond the approved position or start unrelated trades. Revoking access stops future signing; existing orders must be handled separately.</p>
    {#if tradingSetup.wallets.filter(w=>w.chain==='EVM').length>1}<label for="trading-wallet">Trading wallet</label><select id="trading-wallet" bind:value={walletId}>{#each tradingSetup.wallets.filter(w=>w.chain==='EVM') as wallet}<option value={wallet.id}>{wallet.address}</option>{/each}</select>{/if}
    {#if !authUi.user}<button class="primary" onclick={()=>{close();authUi.openSignIn();}}>Sign in to approve</button>{:else}<button class="primary" disabled={busy} onclick={save}>{busy?'Confirming wallet permissions…':'Approve trading permissions'} <ArrowRight size={16}/></button>{/if}
  {:else}
    <div class="symbol"><Check size={30}/></div><h1 id="onboarding-title">Permissions approved.</h1><p class="intro">Dynamic has confirmed your wallet permissions. Your amount per trade is {usd(tradingSetup.settings?.amountUsd ?? amount)}.</p>
    {#if !executionReady}<p class="muted">{tradingSetup.loading?'Checking Cassie’s trading connection. You can continue exploring.':'Cassie’s trading connection is not ready yet. Your approval is complete; you don’t need to approve again.'}</p>{/if}
    <p class="muted">Fund your wallet in Portfolio. You can change your limits or revoke access there anytime.</p>
    <button class="primary" onclick={close}>Explore my first trade <ArrowRight size={16}/></button><button class="secondary" onclick={()=>{close();onPortfolio?.();}}>Open Portfolio</button>
  {/if}
  {#if error}<p class="error" role="alert">{error}</p>{/if}
  {#if step>0&&step<3}<button class="back" disabled={busy} onclick={()=>{error='';tradingSetup.step--;}}><ArrowLeft size={14}/>Back</button>{/if}
</dialog>
<style>
  dialog{box-sizing:border-box;width:min(480px,calc(100vw - 24px));max-height:calc(100dvh - 24px);padding:26px;border:1px solid #333;border-radius:12px;background:#101010;color:#eee;font-family:var(--font-ui);overflow:auto}dialog::backdrop{background:#000b;backdrop-filter:blur(5px)}header{display:flex;justify-content:space-between;align-items:center}header>span{font-weight:600;font-size:16px}button,input,select{font:inherit}button{cursor:pointer}.icon{display:grid;place-items:center;background:none;border:0;color:#aaa;padding:5px}nav{display:flex;align-items:center;margin:25px 0 30px}nav>span{display:grid;place-items:center;width:23px;height:23px;border:1px solid #333;border-radius:50%;color:#777;font:10px var(--font-mono)}nav i{height:1px;background:#333;flex:1}nav .current{border-color:#B5F20B;color:#B5F20B}nav .done{background:#B5F20B;color:#111;border-color:#B5F20B}h1{font-size:29px;line-height:1.17;letter-spacing:-1px;font-weight:500;margin:0}.symbol{color:#B5F20B;margin-bottom:20px}.intro{color:#bbb;line-height:1.65;font-size:14px;margin:18px 0}.features{margin:24px 0}.features p{display:flex;align-items:flex-start;gap:12px;font-size:13px;line-height:1.6;color:#999}.features :global(svg){flex-shrink:0;color:#B5F20B;margin-top:3px}.features strong{color:#eee;font-weight:500}.muted{font-size:11px;line-height:1.7;color:#888;margin:18px 0}label{display:block;font-size:12px;color:#bbb;margin:20px 0 9px}.chips{display:flex;gap:5px}.chips button{flex:1;padding:9px 3px;border:1px solid #333;border-radius:4px;background:#191919;color:#aaa;font-size:11px}.chips .selected{background:#25330c;color:#B5F20B;border-color:#526b1a}.money-input{display:flex;align-items:center;margin-top:8px;border:1px solid #333;border-radius:4px;padding:0 12px;gap:8px;color:#888}input{width:100%;box-sizing:border-box;min-width:0;background:none;border:0;color:#eee;padding:11px 0;outline:none;font-family:var(--font-mono)}select{width:100%;background:#191919;border:1px solid #333;color:#ddd;padding:10px;border-radius:4px}.primary,.secondary{display:flex;width:100%;align-items:center;justify-content:center;gap:10px;border:0;border-radius:5px;min-height:44px;margin-top:24px;font-size:13px;font-weight:600}.primary{background:#B5F20B;color:#111}.secondary{background:none;border:1px solid #333;color:#aaa;margin-top:10px}.primary:disabled{opacity:.5;cursor:wait}.back{display:flex;align-items:center;gap:6px;margin-top:16px;padding:0;background:none;border:0;color:#aaa;font-size:12px}.review{margin:22px 0;border-block:1px solid #303030;padding:8px 0}.review>div{display:flex;justify-content:space-between;padding:10px 0;font-size:12px;color:#999}.review strong{font:13px var(--font-mono);color:#eee}.error{color:#F098C1;font-size:12px;line-height:1.5}button:focus-visible,select:focus-visible,.money-input:focus-within{outline:2px solid #B5F20B;outline-offset:3px}@media(max-width:400px){dialog{padding:20px}h1{font-size:25px}}
</style>
