<p align="center">
  <a href="https://layerzero.network">
    <img alt="LayerZero" style="width: 400px" src="https://docs.layerzero.network/img/LayerZero_Logo_White.svg"/>
  </a>
</p>

<p align="center">
  <a href="https://layerzero.network" style="color: #a77dff">Homepage</a> | <a href="https://docs.layerzero.network/" style="color: #a77dff">Docs</a> | <a href="https://layerzero.network/developers" style="color: #a77dff">Developers</a>
</p>

<h1 align="center">Prosper Solana Omnichain Fungible Token (OFT)</h1>

## Requirements

- Rust `v1.75.0`
- Anchor `v0.29`
- Solana CLI `v1.17.31`
- Docker
- Node.js

## Setup

We recommend using `pnpm` as a package manager (but you can of course use a package manager of your choice).

[Docker](https://docs.docker.com/get-started/get-docker/) is required to build using anchor. We highly recommend that you use the most up-to-date Docker version to avoid any issues with anchor
builds.

:warning: You need anchor version `0.29` and solana version `1.17.31` specifically to compile the build artifacts. Using higher Anchor and Solana versions can introduce unexpected issues during compilation. See the following issues in Anchor's repo: [1](https://github.com/coral-xyz/anchor/issues/3089), [2](https://github.com/coral-xyz/anchor/issues/2835). After compiling the correct build artifacts, you can change the Solana version to higher versions.

### Install Rust

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
```

### Install Solana

```bash
sh -c "$(curl -sSfL https://release.solana.com/v1.17.31/install)"
```

### Install Anchor

Install and use the correct version

```bash
cargo install --git https://github.com/coral-xyz/anchor --tag v0.29.0 anchor-cli --locked
```

### Installing Dependencies

```bash
pnpm install
```

### Running tests

```bash
pnpm test
```

### Prepare `.env`

```bash
cp .env.example .env
```

In the `.env` just created, set `SOLANA_PRIVATE_KEY` to your private key value in base58 format. Since the locally stored keypair is in an integer array format, we'd need to encode it into base58 first.

You can run the `npx hardhat lz:solana:base-58` to output your private key in base58 format. Optionally, pass in a value for the `--keypair-file` flag if you want to use the keypair other than the default at `~/.config/solana.id.json`

Also set the `RPC_URL_SOLANA` value to the Solana RPC URL you want to use.

## Deploy

### Prepare the OFT Program ID

Create `programId` keypair files by running:

```bash
solana-keygen new -o target/deploy/endpoint-keypair.json --force
solana-keygen new -o target/deploy/oft-keypair.json --force

anchor keys sync
```

:warning: `--force` flag overwrites the existing keys with the ones you generate.

Run `anchor keys list` to view the generated programIds (public keys). The output should look something like this:

```
endpoint: <ENDPOINT_PROGRAM_ID>
oft: <OFT_PROGRAM_ID>
```

Copy the OFT's programId and go into [lib.rs](./programs/oft/src/lib.rs). Note the following snippet:

```
declare_id!(Pubkey::new_from_array(program_id_from_env!(
    "OFT_ID",
    "9UovNrJD8pQyBLheeHNayuG1wJSEAoxkmM14vw5gcsTT"
)));
```

Replace the current OFT programId with the programId that you have copied.

### Building and Deploying the Solana OFT Program

Ensure you have Docker running before running the build command.

#### Build the Solana OFT program

```bash
anchor build -v # verification flag enabled
```

#### Preview Rent Costs for the Solana OFT

:information_source: The majority of the SOL required to deploy your program will be for [**rent**](https://solana.com/docs/core/fees#rent) (specifically, for the minimum balance of SOL required for [rent-exemption](https://solana.com/docs/core/fees#rent-exempt)), which is calculated based on the amount of bytes the program or account uses. Programs typically require more rent than PDAs as more bytes are required to store the program's executable code.

In our case, the OFT Program's rent accounts for roughly 99% of the SOL needed during deployment, while the other accounts' rent, OFT Store, Mint, Mint Authority Multisig and Escrow make up for only a fraction of the SOL needed.

You can preview how much SOL would be needed for the program account. Note that the total SOL required would to be slightly higher than just this, to account for the other accounts that need to be created.

```bash
solana rent $(wc -c < target/verifiable/oft.so)
```

You should see an output such as

```bash
Rent-exempt minimum: 3.87415872 SOL
```

:information_source: LayerZero's default deployment path for Solana OFTs require you to deploy your own OFT program as this means you own the Upgrade Authority and don't rely on LayerZero to manage that authority for you. Read [this](https://neodyme.io/en/blog/solana_upgrade_authority/) to understand more no why this is important.

#### Deploy the Solana OFT

```bash
solana program deploy --program-id target/deploy/oft-keypair.json target/verifiable/oft.so -u mainnet-beta
```

:information_source: the `-u` flag specifies the RPC URL that should be used. The options are `mainnet-beta, devnet, testnet, localhost`, which also have their respective shorthands: `-um, -ud, -ut, -ul`

:warning: If the deployment is slow, it could be that the network is congested. If so, you can either wait it out or opt to include a `priorityFee`.

#### (optional) Deploying with a priority fee

This section only applies if you are unable to land your deployment transaction due to network congestion.

:information_source: [Priority Fees](https://solana.com/developers/guides/advanced/how-to-use-priority-fees) are Solana's mechanism to allow transactions to be prioritized during periods of network congestion. When the network is busy, transactions without priority fees might never be processed. It is then necessary to include priority fees, or wait until the network is less congested. Priority fees are calculated as follows: `priorityFee = compute budget * compute unit price`. We can make use of priority fees by attaching the `--with-compute-unit-price` flag to our `solana program deploy` command. Note that the flag takes in a value in micro lamports, where 1 micro lamport = 0.000001 lamport.

<details>
  <summary>View instructions</summary>
  Because building requires Solana CLI version `1.17.31`, but priority fees are only supported in version `1.18`, we will need to switch Solana CLI versions temporarily.

```bash
sh -c "$(curl -sSfL https://release.solana.com/v1.18.26/install)"
```

You can run refer QuickNode's [Solana Priority Fee Tracker](https://www.quicknode.com/gas-tracker/solana) to know what value you'd need to pass into the `--with-compute-unit-price` flag.

:information_source: The average is calculated from getting the prioritization fees across recent blocks, but some blocks may have `0` as the prioritization fee. `averageFeeExcludingZeros` ignores blocks with `0` prioritization fees.

Now let's rerun the deploy command, but with the compute unit price flag.

```bash
solana program deploy --program-id target/deploy/oft-keypair.json target/verifiable/oft.so -u mainnet-beta --with-compute-unit-price <COMPUTE_UNIT_PRICE_IN_MICRO_LAMPORTS>
```

:warning: Make sure to switch back to v1.17.31 after deploying. If you need to rebuild artifacts, you must use Solana CLI version `1.17.31` and Anchor version `0.29.0`

```bash
sh -c "$(curl -sSfL https://release.solana.com/v1.17.31/install)"
```

</details>


The verification process ensures that your deployed program matches exactly with your public source code. 

:warning: **Important**: Your repository must be public for the verification process to work.

#### 1. Install Solana Verify CLI

First, install the [solana-verify](https://github.com/Ellipsis-Labs/solana-verifiable-build) tool:

```bash
cargo install solana-verify
```

#### 2. Compare Program Hashes

Compare the locally built program hash with the on-chain program hash:

```bash
# Get hash of local program
solana-verify get-executable-hash target/verifiable/oft.so

# Dump and get hash of on-chain program
solana program dump <PROGRAM_ID> program.so --url devnet
solana-verify get-executable-hash program.so
```

The hashes should match if your program was built and deployed correctly.

#### 3. Submit for Verification

To get the "Verified" status on Solana explorers, you'll need to verify against your public repository:

```bash
solana-verify verify-from-repo \
    --remote \
    -u mainnet-beta \
    --program-id <PROGRAM_ID> \
    <GIT_REPO_URL> \
    --library-name oft
```

:information_source: The `--remote` flag for mainnet submits the verification to OtterSec's API, which provides the official verification status displayed on block explorers.

:warning: When uploading to your repository, make sure to upload the entire project folder, not just the OFT program folder. Uploading only the program folder will result in a different hash being generated during verification.

### Create the Solana OFT

:information_source: For **OFT**, the SPL token's Mint Authority is set to the **Mint Authority Multisig**, which always has the **OFT Store** as a signer. The multisig is fixed to needing 1 of N signatures.

:information_source: For **OFT** , you have the option to specify additional signers through the `--additional-minters` flag. If you choose not to, you must pass in `--only-oft-store true`, which means only the **OFT Store** will be a signer for the \_Mint Authority Multisig\*.

:warning: If you choose to go with `--only-oft-store`, you will not be able to add in other signers/minters or update the Mint Authority, and the Freeze Authority will be immediately renounced. The token Mint Authority will be fixed Mint Authority Multisig address while the Freeze Authority will be set to None.

#### For OFT:

```bash
pnpm hardhat lz:oft:solana:create --eid 30168 --program-id <PROGRAM_ID> --name <NAME> --symbol <SYMBOL>
```

:warning: Use `--additional-minters` flag to add a CSV of additional minter addresses to the Mint Authority Multisig. If you do not want to, you must specify `--only-oft-store true`.

### Update [layerzero.config.ts](./layerzero.config.ts)

Make sure to update [layerzero.config.ts](./layerzero.config.ts) and set `solanaContract.address` with the `oftStore` address.

```typescript
const solanaContract: OmniPointHardhat = {
  eid: EndpointId.SOLANA_V2_TESTNET,
  address: "", // <---TODO update this with the OFTStore address.
};
```

### Initialize the Solana OFT

:warning: Only do this the first time you are initializing the OFT.

```bash
npx hardhat lz:oapp:init:solana --oapp-config layerzero.config.ts --solana-secret-key <SECRET_KEY> --solana-program-id <PROGRAM_ID>
```

:information_source: `<SECRET_KEY>` should also be in base58 format.

### Configure the Solana OFT

This step configures your OFT's cross-chain communication settings by establishing:
- Peer connections with other chains
- Enforced options for message execution
- DVN (Data Verification Node) configurations
- Send and receive libraries

```bash
npx hardhat lz:oapp:wire --oapp-config layerzero.config.ts --solana-secret-key <PRIVATE_KEY> --solana-program-id <PROGRAM_ID>
```

With a squads multisig, you can simply append the `--multisigKey` flag to the end of the above command.

#### Configuration Setup

Before wiring, ensure your `layerzero.config.ts` file is properly configured with all necessary settings:

```typescript
// Example layerzero.config.ts structure
export default {
  // OFT contract configurations
  contracts: {
    // Your contract configurations
  },
  
  // Peer connections with other chains
  peers: [
    // List of peer chains your OFT can interact with
  ],

  // DVN configurations
  dvns: {
    // Your DVN settings
  },

  // Enforced options for message execution
  enforcedOptions: {
    // Your enforced options
  },

  // Send and receive library configurations
  sendLibrary: {
    // Your send library settings
  },
  receiveLibrary: {
    // Your receive library settings
  }
}
```
