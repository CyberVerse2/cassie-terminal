<script>
  import {
    completeDeviceRegistration,
    detectDeviceRegistrationRedirect,
    getDeviceRegistrationTokenFromUrl,
    isDeviceRegistrationRequired,
    logout,
    offEvent,
    onEvent,
    sendEmailOTP,
    verifyOTP,
  } from '@dynamic-labs-sdk/client';
  import { X } from '@lucide/svelte';
  import { onMount, tick } from 'svelte';
  import { authUi } from '$lib/auth-ui.svelte.js';
  import { dynamicClient, dynamicEnvironmentId } from '$lib/dynamic/client.js';
  import { userInitials } from '$lib/dynamic/auth.js';

  let { onSignedIn, onProfileClick, profileOpen = false } = $props();

  let user = $state(null);
  let open = $state(false);
  let step = $state('email');
  let email = $state('');
  let code = $state('');
  let error = $state('');
  let busy = $state(false);
  let otpVerification = $state(null);
  let devicePending = $state(false);
  let resendAt = $state(0);
  let now = $state(Date.now());
  let rootEl = $state(null);
  let emailEl = $state(null);
  let codeEl = $state(null);
  let dialogEl = $state(null);

  const digits = $derived(code.replace(/\D/g, '').slice(0, 6));
  const resendWait = $derived(Math.max(0, Math.ceil((resendAt - now) / 1000)));

  function syncUser() {
    user = dynamicClient?.user ?? null;
    devicePending = Boolean(user && isDeviceRegistrationRequired(user));
    authUi.user = user;
    authUi.devicePending = devicePending;
  }

  function fail(err) {
    const raw = err instanceof Error ? err.message : String(err);
    if (/invalid/i.test(raw) && /email/i.test(raw)) return 'Use an email like name@mail.com.';
    if (/otp|code|verif|token/i.test(raw)) return 'That code did not match. Try again.';
    return 'Could not finish this step. Try again.';
  }

  onMount(() => {
    if (!dynamicClient) return undefined;
    const url = window.location.href;
    if (detectDeviceRegistrationRedirect({ url })) {
      const deviceToken = getDeviceRegistrationTokenFromUrl({ url });
      completeDeviceRegistration({ deviceToken }).then(() => {
        syncUser();
        onSignedIn?.();
      }).catch((err) => {
        error = fail(err);
      });
    }
    syncUser();
    if (user) onSignedIn?.();
    const onUser = () => { syncUser(); onSignedIn?.(); };
    const onToken = () => onSignedIn?.();
    onEvent({ event: 'userChanged', listener: onUser });
    onEvent({ event: 'tokenChanged', listener: onToken });
    return () => {
      offEvent({ event: 'userChanged', listener: onUser });
      offEvent({ event: 'tokenChanged', listener: onToken });
    };
  });

  $effect(() => {
    if (!open || resendAt === 0) return;
    const timer = setInterval(() => { now = Date.now(); }, 400);
    return () => clearInterval(timer);
  });

  async function sendCode() {
    if (busy) return;
    error = '';
    if (!dynamicEnvironmentId) {
      error = 'Cannot send email right now. Try again later.';
      return;
    }
    const address = email.trim();
    if (!address.includes('@') || !address.includes('.')) {
      error = 'Use an email like name@mail.com.';
      return;
    }
    busy = true;
    try {
      otpVerification = await sendEmailOTP({ email: address });
      email = address;
      step = 'code';
      code = '';
      resendAt = Date.now() + 20_000;
      now = Date.now();
      await tick();
      codeEl?.focus();
    } catch (err) {
      error = fail(err);
    } finally {
      busy = false;
    }
  }

  async function confirmCode() {
    if (busy) return;
    error = '';
    if (!otpVerification || digits.length !== 6) {
      error = 'Enter the six-digit code from your email.';
      return;
    }
    busy = true;
    try {
      await verifyOTP({ otpVerification, verificationToken: digits });
      syncUser();
      busy = false;
      closeSheet();
      onSignedIn?.();
    } catch (err) {
      error = fail(err);
      await tick();
      codeEl?.focus();
    } finally {
      busy = false;
    }
  }

  async function signOut() {
    await logout();
    syncUser();
    onSignedIn?.();
  }

  async function openSignIn() {
    error = '';
    step = 'email';
    code = '';
    open = true;
    await tick();
    dialogEl?.showModal();
    emailEl?.focus();
  }

  async function changeEmail() {
    step = 'email';
    error = '';
    code = '';
    await tick();
    emailEl?.focus();
  }

  function closeSheet() {
    if (busy) return;
    dialogEl?.close();
    open = false;
    step = 'email';
    code = '';
    error = '';
    otpVerification = null;
  }

  function onCodeInput(event) {
    code = event.currentTarget.value.replace(/\D/g, '').slice(0, 6);
    if (code.length === 6 && !busy) confirmCode();
  }

  authUi.openSignIn = openSignIn;
  authUi.signOut = signOut;
</script>

<div class="auth" bind:this={rootEl}>
  {#if user}
    <button
      class="avatar"
      type="button"
      aria-label="Open portfolio"
      aria-expanded={profileOpen}
      onclick={onProfileClick}
    >
      {userInitials(user)}
    </button>
  {:else}
    <button class="signin hov hov-accent" type="button" onclick={openSignIn}>Sign in</button>
  {/if}
</div>

{#if open}
  <dialog bind:this={dialogEl} class="ticket" aria-labelledby="auth-title" aria-describedby="auth-description" oncancel={(event) => { event.preventDefault(); closeSheet(); }}>
    <button class="close" type="button" aria-label="Close sign in" disabled={busy} onclick={closeSheet}><X size={16} aria-hidden="true" /></button>

    <h2 id="auth-title">{step === 'email' ? 'Sign in with email' : 'Enter the code'}</h2>

    <p class="lede" id="auth-description">
      {#if step === 'email'}
        We’ll send you a code to verify your account.
      {:else}
        6 digits sent to <strong>{email}</strong>
      {/if}
    </p>

    {#if step === 'email'}
      <form onsubmit={(event) => { event.preventDefault(); sendCode(); }}>
        <label for="cassie-email">Email</label>
        <input
          id="cassie-email"
          bind:this={emailEl}
          type="email"
          bind:value={email}
          autocomplete="email"
          autocapitalize="none"
          spellcheck="false"
          placeholder="you@example.com"
          required
          disabled={busy}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? 'auth-error' : 'auth-description'}
        />
        {#if error}<p class="err" id="auth-error" role="alert">{error}</p>{/if}
        <button class="go" type="submit" disabled={busy}>{busy ? 'Sending…' : 'Email me a code'}</button>
      </form>
      <button class="ghost" type="button" disabled={busy} onclick={closeSheet}>Continue as guest</button>
    {:else}
      <label for="cassie-code">Code</label>
      <div class="tape">
        <input
          id="cassie-code"
          bind:this={codeEl}
          class="tape-input"
          inputmode="numeric"
          autocomplete="one-time-code"
          pattern="[0-9]{6}"
          maxlength="6"
          value={digits}
          disabled={busy}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? 'auth-error' : 'auth-hint'}
          oninput={onCodeInput}
        />
        <div class="tape-slots" aria-hidden="true">
          {#each [0, 1, 2, 3, 4, 5] as i}
            <span class:filled={digits.length > i} class:caret={digits.length === i && !busy}>{digits[i] ?? ''}</span>
          {/each}
        </div>
      </div>
      {#if error}<p class="err" id="auth-error" role="alert">{error}</p>{/if}
      <button class="go" type="button" disabled={busy || digits.length !== 6} onclick={confirmCode}>
        {busy ? 'Verifying…' : 'Verify'}
      </button>
      <p class="hint" id="auth-hint">Check spam if it is not there.</p>
      <div class="row">
        <button class="ghost" type="button" disabled={busy} onclick={changeEmail}>Change email</button>
        <button class="ghost" type="button" disabled={busy || resendWait > 0} onclick={sendCode}>
          {resendWait > 0 ? `Resend in ${resendWait}s` : 'Resend code'}
        </button>
      </div>
    {/if}
  </dialog>
{/if}

<style>
  .auth { position: relative; }
  .signin {
    height: 38px;
    padding: 0 14px;
    border: 1px solid rgba(181,242,11,0.5);
    border-radius: 6px;
    background: rgba(181,242,11,0.08);
    color: #eeeeee;
    font: inherit;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
  }
  .avatar {
    display: flex;
    width: 38px;
    height: 38px;
    align-items: center;
    justify-content: center;
    border: 0;
    border-radius: 50%;
    background: #B5F20B;
    color: #080808;
    font: inherit;
    font-size: 12px;
    font-weight: 700;
    cursor: pointer;
  }

  .ticket {
    box-sizing: border-box;
    width: min(400px, calc(100% - 32px));
    max-height: calc(100dvh - 32px);
    margin: auto;
    padding: 28px 28px 22px;
    overflow-y: auto;
    border: 1px solid #242424;
    border-radius: 6px;
    background: #080808;
    color: #eeeeee;
    font-family: var(--font-ui);
    box-shadow: 0 28px 80px #000c;
  }
  .ticket::backdrop { background: #000000cc; backdrop-filter: blur(10px); }
  .close { position: absolute; top: 14px; right: 14px; display: grid; place-items: center; width: 32px; height: 32px; padding: 0; border: 0; border-radius: 4px; background: transparent; color: #6e6e6e; cursor: pointer; }
  .close:hover { background: #ffffff0a; color: #eeeeee; }
  h2 { margin: 0; padding-right: 36px; font-size: 22px; font-weight: 600; line-height: 1.15; letter-spacing: -0.04em; }
  .lede { margin: 10px 0 22px; max-width: 34ch; color: #8a8a8a; font-size: 13px; line-height: 1.5; overflow-wrap: anywhere; }
  .lede strong { color: #eeeeee; font-weight: 500; }
  label { display: block; margin-bottom: 8px; color: #6e6e6e; font: 9px var(--font-mono); letter-spacing: 0.1em; text-transform: uppercase; }
  input { box-sizing: border-box; width: 100%; height: 48px; padding: 0 14px; border: 1px solid #2e2e2e; border-radius: 4px; background: #101010; color: #eeeeee; font: inherit; font-size: 16px; }
  input::placeholder { color: #555; }
  input:focus { outline: 0; border-color: #B5F20B; }
  input[aria-invalid='true'] { border-color: #F078B2; }
  .tape { position: relative; height: 56px; }
  .tape-input {
    position: absolute;
    inset: 0;
    z-index: 2;
    width: 100%;
    height: 100%;
    padding: 0;
    border: 0;
    background: transparent;
    color: transparent;
    caret-color: transparent;
  }
  .tape-input:focus { outline: 0; }
  .tape-slots { display: grid; height: 100%; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 6px; }
  .tape-slots span {
    display: grid;
    place-items: center;
    border: 1px solid #2e2e2e;
    border-radius: 4px;
    background: #101010;
    color: #eeeeee;
    font-family: var(--font-mono);
    font-size: 22px;
    font-weight: 500;
  }
  .tape-slots span.caret { border-color: #B5F20B; }
  .tape-input[aria-invalid='true'] + .tape-slots span { border-color: #F078B2; }
  .go {
    width: 100%;
    height: 44px;
    margin-top: 16px;
    border: 0;
    border-radius: 4px;
    background: #B5F20B;
    color: #111;
    font: inherit;
    font-size: 13px;
    font-weight: 600;
    letter-spacing: -0.01em;
    cursor: pointer;
  }
  .go:hover:not(:disabled) { background: #c8ff3d; }
  button:disabled { opacity: 0.45; cursor: not-allowed; }
  .hint { margin: 14px 0 4px; color: #6e6e6e; font-size: 12px; line-height: 1.45; }
  .row { display: flex; justify-content: space-between; gap: 8px; }
  .ghost { min-height: 40px; padding: 8px 0; border: 0; background: transparent; color: #6e6e6e; font: inherit; font-size: 12px; cursor: pointer; }
  .ghost:hover:not(:disabled) { color: #eeeeee; }
  .err { margin: 10px 0 0; color: #F078B2; font-size: 12px; line-height: 1.5; }
  button:focus-visible, input:focus-visible { outline: 2px solid #B5F20B; outline-offset: 3px; }
  .tape-input:focus-visible { outline: 0; }
  @media (max-width: 480px) {
    .ticket { padding: 24px 20px 18px; }
    h2 { font-size: 20px; }
  }
</style>
