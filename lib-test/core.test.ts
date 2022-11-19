import {
  AnchorProvider,
  BN,
  Program,
  SplToken,
  utils,
  Wallet,
  web3,
} from '@project-serum/anchor'
import { program as getSplProgram } from '@project-serum/anchor/dist/cjs/spl/token'
import { expect } from 'chai'

import Otc, { OrderData, OrderState, DEFAULT_OTC_PROGRAM_ID } from '../app'
import { asyncWait, initializeAccount, initializeMint } from './pretest'

const PRIV_KEY_FOR_TEST_ONLY = Buffer.from([
  2, 178, 226, 192, 204, 173, 232, 36, 247, 215, 203, 12, 177, 251, 254, 243,
  92, 38, 237, 60, 38, 248, 213, 19, 73, 180, 31, 164, 63, 210, 172, 90, 85,
  215, 166, 105, 84, 194, 133, 92, 34, 27, 39, 2, 158, 57, 64, 226, 198, 222,
  25, 127, 150, 87, 141, 234, 34, 239, 139, 107, 155, 32, 47, 199,
])
const SUPPLY = new BN(10 ** 9)

describe('@sentre/otc', function () {
  const wallet = new Wallet(web3.Keypair.fromSecretKey(PRIV_KEY_FOR_TEST_ONLY))
  let otc: Otc,
    connection: web3.Connection,
    splProgram: Program<SplToken>,
    orderAddress: string,
    aTokenAddress: string,
    aTokenAccountAddress: string,
    bTokenAddress: string,
    bTokenAccountAddress: string

  before(async () => {
    const { program } = new Otc(wallet)
    const provider = program.provider as AnchorProvider
    splProgram = getSplProgram(provider)
    // Init A token
    const aToken = web3.Keypair.generate()
    aTokenAddress = aToken.publicKey.toBase58()
    await initializeMint(9, aToken, splProgram)
    aTokenAccountAddress = (
      await utils.token.associatedAddress({
        owner: wallet.publicKey,
        mint: new web3.PublicKey(aTokenAddress),
      })
    ).toBase58()
    await splProgram.methods
      .mintTo(SUPPLY)
      .accounts({
        mint: new web3.PublicKey(aTokenAddress),
        to: new web3.PublicKey(aTokenAccountAddress),
        authority: wallet.publicKey,
      })
      .rpc()
    // Init B token
    const bToken = web3.Keypair.generate()
    bTokenAddress = bToken.publicKey.toBase58()
    await initializeMint(9, bToken, splProgram)
    bTokenAccountAddress = (
      await utils.token.associatedAddress({
        owner: wallet.publicKey,
        mint: new web3.PublicKey(bTokenAddress),
      })
    ).toBase58()
    await splProgram.methods
      .mintTo(SUPPLY)
      .accounts({
        mint: new web3.PublicKey(bTokenAddress),
        to: new web3.PublicKey(bTokenAccountAddress),
        authority: wallet.publicKey,
      })
      .rpc()
  })

  it('constructor', async () => {
    otc = new Otc(wallet)
    if (otc.program.programId.toBase58() !== DEFAULT_OTC_PROGRAM_ID)
      throw new Error('Cannot contruct an otc instance')
    // Setup test supporters
    connection = otc.program.provider.connection
    // Airdrop to wallet
    const lamports = await connection.getBalance(wallet.publicKey)
    if (lamports < 10 * web3.LAMPORTS_PER_SOL)
      await connection.requestAirdrop(wallet.publicKey, web3.LAMPORTS_PER_SOL)
    // Current Unix Timestamp
    const currentTime = await otc.getCurrentUnixTimestamp()
    console.log(currentTime)
  })
})
