# Security Policy

## Reporting a Vulnerability

Please report security concerns privately rather than opening a public GitHub issue:

- **GitHub Private Security Advisories:** [Submit a private security report](https://github.com/annoris/trading-bauhaus-journal/security/advisories/new)

You can expect an acknowledgment within a few business days. Please include clear reproduction steps, affected component paths, and impact details.

## Scope Notes

Trading Bauhaus stores broker credentials (encrypted at rest via AES-256-GCM) and trading history in its configured local SQLite data directory (`JOURNAL_DATA_DIR`). Reports covering credential handling, the encryption layer (`apps/web/src/server/crypto.ts`), authentication/invitation flows, Solana verification logic, and statement importers (untrusted file parsing) are especially valuable.

## Supported Versions

Security fixes target the latest release on `main` in [`annoris/trading-bauhaus-journal`](https://github.com/annoris/trading-bauhaus-journal).

## Official Wallet & Policy Authenticity

To prevent impersonation or payment spoofing, verify that any commercial licensing or community contribution is sent **only** to the official Solana (SOL / USDC-SPL) wallet:

- **Official Solana Wallet:** `3HvUMCUSSHEdtA35UuD4J7mbgpTxJ7LgT2X7GfdzvBdm`
- **On-Chain Verification:** [View on Solscan](https://solscan.io/account/3HvUMCUSSHEdtA35UuD4J7mbgpTxJ7LgT2X7GfdzvBdm)
- **Licensing Terms:** [`LICENSE`](LICENSE) and [`docs/commercial-license.md`](docs/commercial-license.md)
- **Community Standards:** [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md) and [`CONTRIBUTING.md`](CONTRIBUTING.md)
