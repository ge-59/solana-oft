import { mplToolbox } from '@metaplex-foundation/mpl-toolbox'
import { publicKey, signerIdentity, transactionBuilder, createSignerFromKeypair } from '@metaplex-foundation/umi'
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults'
import { fromWeb3JsKeypair, toWeb3JsPublicKey } from '@metaplex-foundation/umi-web3js-adapters'
import { Keypair, PublicKey } from '@solana/web3.js'
import assert from 'assert'
import bs58 from 'bs58'
import { task } from 'hardhat/config'
import { types as devtoolsTypes } from '@layerzerolabs/devtools-evm-hardhat'

import { types } from '@layerzerolabs/devtools-evm-hardhat'
import { EndpointId } from '@layerzerolabs/lz-definitions'
import { oft } from '@layerzerolabs/oft-v2-solana-sdk'
import { createOFTFactory } from '@layerzerolabs/ua-devtools-solana'

import { addComputeUnitInstructions, getExplorerTxLink } from './index'
import { createSolanaConnectionFactory } from '../common/utils'

type ConfigType = 'Admin' | 'Pauser' | 'Unpauser' | 'DefaultFee' | 'Paused'

interface SetOFTConfigTaskArgs {
    eid: EndpointId
    programId: string
    configType: ConfigType
    newValue: string
    computeUnitPriceScaleFactor: number
    oftStore: string
}

task('lz:oft:solana:setconfig', 'Set OFT configuration parameters')
    .addParam('eid', 'Solana mainnet or testnet eid', undefined, types.eid)
    .addParam('programId', 'The OFT Program id')
    .addParam('oftStore', 'The OFTStore account')
    .addParam('configType', 'Type of config to set (Admin, Pauser, Unpauser, DefaultFee, Paused)')
    .addParam('newValue', 'New value to set')
    .addParam('computeUnitPriceScaleFactor', 'The compute unit price scale factor', 4, devtoolsTypes.float, true)
    .setAction(async ({ 
        eid, 
        programId: programIdStr, 
        configType, 
        newValue, 
        oftStore,
        computeUnitPriceScaleFactor 
    }: SetOFTConfigTaskArgs) => {
        const privateKey = process.env.SOLANA_PRIVATE_KEY
        assert(!!privateKey, 'SOLANA_PRIVATE_KEY is not defined in the environment variables.')

        const keypair = Keypair.fromSecretKey(bs58.decode(privateKey))
        const connectionFactory = createSolanaConnectionFactory()
        const connection = await connectionFactory(eid)
        const umi = createUmi(connection.rpcEndpoint).use(mplToolbox())
        const umiKeypair = createSignerFromKeypair(umi, fromWeb3JsKeypair(keypair))
        
        umi.use(signerIdentity(umiKeypair))

        const solanaSdkFactory = createOFTFactory(
            () => toWeb3JsPublicKey(umiKeypair.publicKey),
            () => new PublicKey(programIdStr),
            connectionFactory
        )

        const sdk = await solanaSdkFactory({
            address: new PublicKey(oftStore).toBase58(),
            eid: eid,
        })

        let configParam: any
        switch (configType) {
            case 'Admin':
                configParam = { 
                    __kind: 'Admin',
                    admin: publicKey(newValue)
                }
                break
            case 'Pauser':
                configParam = { __kind: 'Pauser', fields: [newValue === 'null' ? undefined : publicKey(newValue)] }
                break
            case 'Unpauser':
                configParam = { __kind: 'Unpauser', fields: [newValue === 'null' ? undefined : publicKey(newValue)] }
                break
            case 'DefaultFee':
                const feeBps = parseInt(newValue)
                if (isNaN(feeBps) || feeBps < 0 || feeBps > 10000) {
                    throw new Error('DefaultFee must be a number between 0 and 10000')
                }
                configParam = { __kind: 'DefaultFee', fields: [feeBps] }
                break
            case 'Paused':
                if (newValue !== 'true' && newValue !== 'false') {
                    throw new Error('Paused must be either "true" or "false"')
                }
                configParam = { 
                    __kind: 'Paused',
                    paused: newValue === 'true'
                }
                break
            default:
                throw new Error(`Unknown config type: ${configType}`)
        }

        try {
            const umiKeypair = createSignerFromKeypair(umi, fromWeb3JsKeypair(keypair))
            const umiOftStore = publicKey(oftStore)
            const umiProgramId = publicKey(programIdStr)

            const ix = oft.setOFTConfig(
                {
                    admin: umiKeypair,
                    oftStore: umiOftStore
                },
                configParam,
                {
                    oft: umiProgramId
                }
            )

            let txBuilder = transactionBuilder()
                .add(ix)

            txBuilder = await addComputeUnitInstructions(
                connection,
                umi,
                eid,
                txBuilder,
                umiKeypair,
                computeUnitPriceScaleFactor
            )

            const { signature } = await txBuilder.sendAndConfirm(umi)
            const isTestnet = eid == EndpointId.SOLANA_V2_TESTNET
            console.log(`setOFTConfig tx: ${getExplorerTxLink(bs58.encode(signature), isTestnet)}`)
        } catch (error) {
            console.error(`setOFTConfig failed:`, error)
        }
    })
