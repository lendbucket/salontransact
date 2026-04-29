# Apple Pay + Google Pay Integration — Deferred

**Status:** DEFERRED until Payroc cert workflow confirmed

**Commits:** 50 (Apple Pay) + 51 (Google Pay)

---

## Architecture (already confirmed)

Wallet tokens flow through the same Hosted Fields tokenization path as typed cards:
1. Consumer initializes Hosted Fields with `scenario: "payment"`
2. Hosted Fields renders Apple Pay / Google Pay button if device supports it
3. Customer authenticates via Touch ID / Face ID / Google Pay sheet
4. Wallet token is captured by Hosted Fields and returned as a single-use token
5. Our POST /api/v1/charges flow processes it identically to a typed card

**No code changes needed in our charge flow.** The wallet integration is entirely in the Hosted Fields SDK configuration.

## Blocking items

### Apple Pay (Commit 50)
- Per Chris #3: UAT cert needs sandbox setup
- Production cert uses consumer Apple device for verification
- Need: Apple Developer account merchant ID, domain verification file at `/.well-known/apple-developer-merchantid-domain-association`
- Need: Matt to confirm Payroc's Apple Pay terminal configuration

### Google Pay (Commit 51)
- Similar flow: Google Pay API configuration in Hosted Fields
- Need: Google Pay merchant ID
- Need: Matt to confirm Payroc's Google Pay terminal configuration

## What we'll build when unblocked

### Commit 50: Apple Pay
- Add `/.well-known/apple-developer-merchantid-domain-association` to public/
- Add Apple Pay configuration to tokenization session response
- Document Apple Pay Hosted Fields initialization for Kasse SDK
- Test with real Apple device

### Commit 51: Google Pay
- Add Google Pay configuration to tokenization session response
- Document Google Pay Hosted Fields initialization for Kasse SDK
- Test with real Android device

Both commits are small (< 50 lines each) because the heavy lifting is in Payroc's Hosted Fields SDK, not our code.

---

*This doc will be replaced by actual implementation when Payroc confirms the cert workflow.*
