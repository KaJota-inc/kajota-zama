# Payflow Mandate Beacon — Sepolia deployment

Live `MandateAnchor` on Sepolia for the BLI Legal Tech Hackathon 2 submission. Each row below is
one real on-chain anchor. Updated by `scripts/beacon/anchor-mandate.mjs`, which is driven by a
cron so this file still refreshes during judging — the single most-decisive playbook move for
this hackathon.

## Deployment

| | |
|---|---|
| Contract | [`0x7A4C3c92cbf3cd3442B55bcFacdBdECfDF6a2504`](https://sepolia.etherscan.io/address/0x7A4C3c92cbf3cd3442B55bcFacdBdECfDF6a2504) |
| Network | Sepolia (chainId 11155111) |
| Deployer | [`0xC58A7717fdf1Bc40dFb63b02ab54D6CF6c8F7093`](https://sepolia.etherscan.io/address/0xC58A7717fdf1Bc40dFb63b02ab54D6CF6c8F7093) |
| CBN SLA window | 86 400 s (CBN Consumer Protection Regulation 2019 — 24 hours) |
| Deploy tx | [`0x5827375b…9056bd7105`](https://sepolia.etherscan.io/tx/0x5827375bc9fb699bd284d965162661afef4be6f2c8a21f474cdaee9056bd7105) |
| Allowlist bank tx | [`0x54df67ae…6642a304a`](https://sepolia.etherscan.io/tx/0x54df67ae298bcdf0847bb24097dd1a0cedff42d9e8e38a42f213fe92642a304a) |
| First anchored at | 2026-10-06T21:45 UTC |
| Branch | [`hackathon/bli-mandate-beacon`](https://github.com/KaJota-inc/kajota-zama/tree/hackathon/bli-mandate-beacon) |

The deployer is temporarily allowlisted as the posting bank for the Sepolia seed runner. In
production the posting account is a switch (Remita, Interswitch, NIBSS), per
[`pilot/switch_tier_pitch.md`](https://github.com/KaJota-inc/payflow/blob/main/pilot/switch_tier_pitch.md)
in the Payflow repo.

## Anchors

Each row is one `postMandate` call. The `commitment` is the on-chain
`MandateAnchor.mandateCommitment(mandateId)` output and reproduces byte-for-byte off-chain via
`payflow.mandate.mandate_commitment()` (Payflow commit
[`52f23e0`](https://github.com/KaJota-inc/payflow/commit/52f23e0f),
3 fixtures round-trip-verified).

| # | Tick | Block | Mandate id | Commitment | Event | Tx |
|---|---|---|---|---|---|---|
| 1 | 5971077 | 11858585 | `0x45ef3ea0…cfc9da58` | `0xac0efc0c…43c6450b` | Posted |  [tx](https://sepolia.etherscan.io/tx/0xe1829bba1f3d1ca41722415325082f579dcacc462b7d4ca8f23e9562f7bf628b) |
| 2 | 5971080 | 11858660 | `0xed878ab7…070a4758` | `0x3fd6be26…82be3a2a` | Posted |  [tx](https://sepolia.etherscan.io/tx/0x83bda60c83479a2f9eb3d22285d1465777253ab85b1ec1a120d8d1c5616142e3) |
| 3 | 5973391 | 11916297 | `0xbd10975d…d064ea61` | `0xb2ddd215…1d559ce3` | Posted |  [tx](https://sepolia.etherscan.io/tx/0xd5adf60236265bb75af0392547da81ba39d0bc7265f6b997af4ca5937e32aa07) |
| 4 | 5973456 | 11917926 | `0xdd73d3fb…8f65730c` | `0xfc9f1fb1…c4cead54` | Posted |  [tx](https://sepolia.etherscan.io/tx/0xeb1f180cea92bad145dce997ceb56e1c497f1db0c28fde735062cea90c2c044c) |
| 5 | 5973542 | 11920050 | `0x49ecb7e0…03231b43` | `0xdc6f079d…486fbe96` | Posted |  [tx](https://sepolia.etherscan.io/tx/0x9f47a6f2dcf86b2ab8c17a7da52acb838fd4ee7df0c392d5e8dcb7a3d75110fa) |
| 6 | 5973608 | 11921687 | `0xaae32d18…3654d5e3` | `0xd3ba7bd3…69796269` | Posted |  [tx](https://sepolia.etherscan.io/tx/0x55269afe5c02ff9744ac16e94dab5e8bd8fa21b3920709184920d4ad89410d71) |
| 7 | 5973638 | 11922427 | `0x45ef3ea0…cfc9da58` | `0xac0efc0c…43c6450b` | SLABreached (→ #1) | [tx](https://sepolia.etherscan.io/tx/0xb4ca5e4a35f41e691f97afb8db09de4b9a9bf5a0ecd1e2c0a7398dd02bf296a4) |
| 8 | 5973638 | 11922428 | `0xaae32d18…3654d5e3` | `0xd3ba7bd3…69796269` | Settled (→ #6) | [tx](https://sepolia.etherscan.io/tx/0x28809ef3dc8e3345e62fd0ac3658537b6d2cff1fcd8c9b5003eb77d55f60668a) |
| 9 | 5973638 | 11922429 | `0x5d754a48…df354b36` | `0x955b4e63…9d69b454` | DuplicateRouted (↻ #1) | [tx](https://sepolia.etherscan.io/tx/0xd9e00b2507350d1396da55d1845bd74b65074fb4a50ed64c2de6bb147d7cf0f0) |
| 10 | 5973638 | 11922430 | `0xc4f7606f…470db63f` | `0x6b5cf1da…2dbf41bb` | Posted | [tx](https://sepolia.etherscan.io/tx/0x2d7e341137a0551e55bafad5b186f2746fadd32946b7ea56b91a5b0e20464c52) |
| 11 | 5973661 | 11922999 | `0xd38b1bc6…ca388eba` | `0x002445ab…74d80f4b` | Posted | [tx](https://sepolia.etherscan.io/tx/0x95f8b8c11825ceda06cb12643bb87dcf1bb8c990f8c1d7353897966fff6bbd42) |
| 12 | 5973744 | 11924937 | `0xb6045d91…724509bc` | `0x426bccf2…f37dfbcd` | Posted | [tx](https://sepolia.etherscan.io/tx/0x424e6bae68dda1039ee34051439d1ba60e2346e9078beddb74f200df29425a5a) |
| 13 | 5973829 | 11926950 | `0xb6045d91…724509bc` | `0x426bccf2…f37dfbcd` | Settled (→ #12) | [tx](https://sepolia.etherscan.io/tx/0x8be9930fc3f86f5eb23b85fc1de080f766fbd8eba74f0a6952fc73ffa9b3bbbc) |
| 14 | 5973892 | 11928460 | `0xfb99f411…b57d96f0` | `0xa7be00f1…90b85aea` | DuplicateRouted (↻ #1) | [tx](https://sepolia.etherscan.io/tx/0x43bf8026c493fd171b736d519f9653ecf4bb66691b6c9cd4d3ff4317859ae5bc) |
| 15 | 5973945 | 11929698 | `0xed878ab7…070a4758` | `0x3fd6be26…82be3a2a` | SLABreached (→ #2) | [tx](https://sepolia.etherscan.io/tx/0x2fa548cea8ac8a7681e1c6cf6e40a5beaaaf9bec788435f9fd89c87a56d4db11) |
| 16 | 5974030 | 11931722 | `0x2a265746…63968d50` | `0x1672ecc3…94489789` | Posted | [tx](https://sepolia.etherscan.io/tx/0x8f6c439c43953d78528801552fc8056d78ee276218f3bf86cd922bdafd0cdbfd) |
| 17 | 5974109 | 11933573 | `0x2a265746…63968d50` | `0x1672ecc3…94489789` | Settled (→ #16) | [tx](https://sepolia.etherscan.io/tx/0xe208d782b1797af0e921c83fe33e9271750fe736bf10d3aad44a7e74527ee081) |
| 18 | 5974167 | 11934951 | `0x6e3ea994…cd98f537` | `0x18725723…79685810` | Posted | [tx](https://sepolia.etherscan.io/tx/0xde441c9de6c3891c8b333e9756952e320f3d998e456a437326610c7357a4cade) |
| 19 | 5974228 | 11936374 | `0xc1ba6e2b…deafc2bc` | `0x0645f3ce…b38337c9` | Posted | [tx](https://sepolia.etherscan.io/tx/0x17406c334aebcf3b07956db3af1221af38f34e49135699c5d01b15f59f8664d6) |
| 20 | 5974319 | 11938556 | `0x8bc528b0…bf7c7b64` | `0x236c4a71…8d4d5020` | Posted | [tx](https://sepolia.etherscan.io/tx/0x59554862163e5302e2af1625c7ecde1468827c5aaf40e5c0b274f72109bdcaf1) |
| 21 | 5974400 | 11940558 | `0xa817464f…2f0ba02e` | `0x0001bb66…ffbf31c4` | Posted | [tx](https://sepolia.etherscan.io/tx/0x547e82571919d2c1d8d344582f8d7f22aac0a032d6aa769605635e3b098aeef2) |
| 22 | 5974460 | 11942028 | `0xa817464f…2f0ba02e` | `0x0001bb66…ffbf31c4` | Settled (→ #21) | [tx](https://sepolia.etherscan.io/tx/0x2234fab5402c1e4ab86c8b5636b93ec4f87ca2d3a98851a4e03f8f65c0f4f190) |
| 23 | 5974516 | 11943421 | `0xd4b89729…2f50793e` | `0xc7d73c06…e44fb633` | Posted | [tx](https://sepolia.etherscan.io/tx/0x92c459c5cf69df6359f4c0825de64e4793744a060c8bb056594a85fece278894) |
| 24 | 5974609 | 11945700 | `0x33665ceb…3ed54670` | `0x195d91e0…4bff93a1` | Posted | [tx](https://sepolia.etherscan.io/tx/0x0e6aaf83d89e586eab4f802629eab82933e3c92e81d48930eba6dc9cf76fdb0a) |
| 25 | 5974712 | 11948246 | `0xbd10975d…d064ea61` | `0xb2ddd215…1d559ce3` | SLABreached (→ #3) | [tx](https://sepolia.etherscan.io/tx/0x46fb0cd9fc91220aa4334c4297b4fbcc0584fd2b3a8dbeb30aeafa0ddb049a31) |
| 26 | 5974826 | 11951049 | `0x32430984…ae7b8b3c` | `0xd9420b62…baeb42a4` | Posted | [tx](https://sepolia.etherscan.io/tx/0x73540d61bab4ced599fbe069ef37db81928c4f2a6831b22b0c3f4ec88332cccf) |
| 27 | 5974899 | 11952869 | `0x5a5c5c1b…6af0e69e` | `0x81671fa7…b147e695` | Posted | [tx](https://sepolia.etherscan.io/tx/0xb83b7d165d1782735c0f60c0608adfe530ee00f38a7a2dc6e3cafccd71778cbe) |
| 28 | 5974982 | 11954929 | `0x5a5c5c1b…6af0e69e` | `0x81671fa7…b147e695` | Settled (→ #27) | [tx](https://sepolia.etherscan.io/tx/0xc844595f887dcef964f62ceaa1594ebdc1541cc3dbe16eddecf13807665af77e) |
| 29 | 5975047 | 11956542 | `0x32430984…ae7b8b3c` | `0xd9420b62…baeb42a4` | Settled (→ #26) | [tx](https://sepolia.etherscan.io/tx/0x5455c65c594afa401698db6236ebc41e0e3cf2c043957d833706345b21d8c105) |
| 30 | 5975105 | 11957962 | `0xac0ea661…ab359d55` | `0xb4a54569…21f426aa` | Posted | [tx](https://sepolia.etherscan.io/tx/0xeeee5a700933b11a2fa44af2324338f261dce6551fbf4a9fd89592d43e5b0ee1) |
| 31 | 5975185 | 11959944 | `0xac0ea661…ab359d55` | `0xb4a54569…21f426aa` | Settled (→ #30) | [tx](https://sepolia.etherscan.io/tx/0x5b182d12a1057e3f6cff74590ce9a79a7d7b8ff54b2964cfdcc1bcbfbd5d3370) |
| 32 | 5975274 | 11962133 | `0xa52ab7d0…95776a2d` | `0xc0c948e4…c7a5e7b3` | Posted | [tx](https://sepolia.etherscan.io/tx/0xe05557609561801b132ab6b8bccce473ac7ee14768fe588eae56cf9795cb5fd4) |
| 33 | 5975339 | 11963749 | `0xdd73d3fb…8f65730c` | `0xfc9f1fb1…c4cead54` | SLABreached (→ #4) | [tx](https://sepolia.etherscan.io/tx/0x492d6545888f44c69ae463414db4a3784c70db9cc2854b22fa9d1be8988baa44) |
| 34 | 5975393 | 11965087 | `0xddbeab70…014dcf0b` | `0x73bb3078…6ebf17c2` | Posted | [tx](https://sepolia.etherscan.io/tx/0x50ce1a506504912652d7ace6e117f928ac05058eba0f5e6555dba71e9a147864) |
| 35 | 5975473 | 11967071 | `0x5dc2fbba…0eade9ed` | `0x3fa21fc5…51591615` | Posted | [tx](https://sepolia.etherscan.io/tx/0x5511eddc9eac869848919c34e9a43a33cd525e8f850e4fc57402cd5ec59e5e0c) |
| 36 | 5975562 | 11969259 | `0x60fc831c…2b1e4124` | `0x5d5d5695…41fc25e2` | DuplicateRouted (↻ #1) | [tx](https://sepolia.etherscan.io/tx/0xc57a91a6d2d6a196a372df6342f448034c90d9d8c589a9d69b89c1dcdd02c3a4) |
| 37 | 5975627 | 11970875 | `0xd7281c70…1ef3d2ba` | `0x12712230…61fd8dc7` | DuplicateRouted (↻ #1) | [tx](https://sepolia.etherscan.io/tx/0x6f7e89a090a7b9b072d431c87db8acd4fc7188c2427e02d90ea356e2912e170e) |
