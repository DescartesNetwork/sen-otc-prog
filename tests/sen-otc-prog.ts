import {
  workspace,
  utils,
  Program,
  AnchorProvider,
  setProvider,
  Spl,
  BN,
  web3,
} from '@project-serum/anchor'
import { expect } from 'chai'
import { SenOtcProg } from '../target/types/sen_otc_prog'
import {
  getCurrentTimestamp,
  initializeAccount,
  initializeMint,
  mintTo,
  NULL_WHITELIST,
} from './utils'

describe('sen-otc-prog', () => {
  // Configure the client to use the local cluster.
  const provider = AnchorProvider.env()
  setProvider(provider)

  const program = workspace.SenOtcProg as Program<SenOtcProg>
  const spl = Spl.token()
  const bidToken = new web3.Keypair()
  let bidTokenAccount: web3.PublicKey
  const askToken = new web3.Keypair()
  let askTokenAccount: web3.PublicKey

  const order = new web3.Keypair()
  let treasurer: web3.PublicKey
  let treasury: web3.PublicKey

  before(async () => {
    // Init a mint
    await initializeMint(9, bidToken, spl)
    await initializeMint(9, askToken, spl)
    // Derive token account
    bidTokenAccount = await utils.token.associatedAddress({
      mint: bidToken.publicKey,
      owner: provider.wallet.publicKey,
    })
    await initializeAccount(
      bidTokenAccount,
      bidToken.publicKey,
      provider.wallet.publicKey,
      provider,
    )
    await mintTo(new BN(10 ** 10), bidToken.publicKey, bidTokenAccount, spl)
    askTokenAccount = await utils.token.associatedAddress({
      mint: askToken.publicKey,
      owner: provider.wallet.publicKey,
    })
    await initializeAccount(
      askTokenAccount,
      askToken.publicKey,
      provider.wallet.publicKey,
      provider,
    )
    await mintTo(new BN(10 ** 10), askToken.publicKey, askTokenAccount, spl)
    // Derive treasury & treasurer
    const [treasurerPublicKey] = await web3.PublicKey.findProgramAddress(
      [Buffer.from('treasurer'), order.publicKey.toBuffer()],
      program.programId,
    )
    treasurer = treasurerPublicKey
    treasury = await utils.token.associatedAddress({
      mint: bidToken.publicKey,
      owner: treasurer,
    })
  })

  it('make order', async () => {
    const currentDate = getCurrentTimestamp()
    const txId = await program.methods
      .makeOrder(
        new BN(10 ** 9),
        new BN(10 ** 9),
        0,
        20000000,
        new BN(currentDate + 5),
        new BN(currentDate + 10),
        NULL_WHITELIST,
      )
      .accounts({
        authority: provider.wallet.publicKey,
        order: order.publicKey,
        bidToken: bidToken.publicKey,
        askToken: askToken.publicKey,
        srcBidAccount: bidTokenAccount,
        treasury,
        treasurer,
        systemProgram: web3.SystemProgram.programId,
        tokenProgram: utils.token.TOKEN_PROGRAM_ID,
        associatedTokenProgram: utils.token.ASSOCIATED_PROGRAM_ID,
        rent: web3.SYSVAR_RENT_PUBKEY,
      })
      .signers([order])
      .rpc()
    expect(txId).to.be.an('string')
  })

  it('get order data', async () => {
    const { startDate, endDate, state, whitelist } =
      await program.account.order.fetch(order.publicKey)
    expect(endDate.sub(startDate).eq(new BN(5))).to.be.true
    expect(state).to.deep.eq({ initialized: {} })
    expect(whitelist).to.deep.eq(NULL_WHITELIST)
  })
})
