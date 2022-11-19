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
  asyncWait,
  getCurrentTimestamp,
  initializeAccount,
  initializeMint,
  mintTo,
} from './utils'
import {
  NULL_WHITELIST,
  decimals,
  A,
  B,
  a,
  b,
  fee,
  x,
  y,
  DECIMALS,
} from './configs'

describe('admin', () => {
  // Configure the client to use the local cluster.
  const provider = AnchorProvider.env()
  setProvider(provider)

  const program = workspace.SenOtcProg as Program<SenOtcProg>
  const spl = Spl.token()
  const aToken = new web3.Keypair()
  let aTokenAccount: web3.PublicKey
  const bToken = new web3.Keypair()
  let bTokenAccount: web3.PublicKey

  const order = new web3.Keypair()
  let treasurer: web3.PublicKey
  let treasury: web3.PublicKey

  const taxman = new web3.Keypair()
  let makerFeeAccount: web3.PublicKey
  let takerFeeAccount: web3.PublicKey

  before(async () => {
    // Init a mint
    await initializeMint(decimals, aToken, spl)
    await initializeMint(decimals, bToken, spl)
    // Derive token account
    aTokenAccount = await utils.token.associatedAddress({
      mint: aToken.publicKey,
      owner: provider.wallet.publicKey,
    })
    await initializeAccount(
      aTokenAccount,
      aToken.publicKey,
      provider.wallet.publicKey,
      provider,
    )
    await mintTo(new BN(A), aToken.publicKey, aTokenAccount, spl)
    bTokenAccount = await utils.token.associatedAddress({
      mint: bToken.publicKey,
      owner: provider.wallet.publicKey,
    })
    await initializeAccount(
      bTokenAccount,
      bToken.publicKey,
      provider.wallet.publicKey,
      provider,
    )
    await mintTo(new BN(B), bToken.publicKey, bTokenAccount, spl)
    // Derive treasury & treasurer
    const [treasurerPublicKey] = await web3.PublicKey.findProgramAddress(
      [Buffer.from('treasurer'), order.publicKey.toBuffer()],
      program.programId,
    )
    treasurer = treasurerPublicKey
    treasury = await utils.token.associatedAddress({
      mint: aToken.publicKey,
      owner: treasurer,
    })
    // Maker/Taker fee accounts
    makerFeeAccount = await utils.token.associatedAddress({
      mint: bToken.publicKey,
      owner: taxman.publicKey,
    })
    takerFeeAccount = await utils.token.associatedAddress({
      mint: aToken.publicKey,
      owner: taxman.publicKey,
    })
  })

  it('make order', async () => {
    const currentDate = await getCurrentTimestamp(provider.connection)
    console.log('currentDate', currentDate)
    const txId = await program.methods
      .makeOrder(
        a,
        b,
        0,
        fee,
        new BN(currentDate + 5),
        new BN(currentDate + 10),
        NULL_WHITELIST,
      )
      .accounts({
        authority: provider.wallet.publicKey,
        order: order.publicKey,
        aToken: aToken.publicKey,
        bToken: bToken.publicKey,
        srcAAccount: aTokenAccount,
        treasury,
        treasurer,
        taxman: taxman.publicKey,
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
    // Check internal order state
    const { startDate, endDate, state, whitelist } =
      await program.account.order.fetch(order.publicKey)
    expect(endDate.sub(startDate).eq(new BN(5))).to.be.true
    expect(state).to.deep.eq({ initialized: {} })
    expect(whitelist).to.deep.eq(NULL_WHITELIST)
    // Check A token account
    const { amount: aAmount } = await spl.account.token.fetch(aTokenAccount)
    expect(aAmount.eq(new BN(0))).to.be.true
  })

  it('paused', async () => {
    const txId = await program.methods
      .pause()
      .accounts({
        authority: provider.wallet.publicKey,
        order: order.publicKey,
      })
      .rpc()
    expect(txId).to.be.an('string')
  })

  it('validate order data: pause', async () => {
    const { state } = await program.account.order.fetch(order.publicKey)
    expect(state).to.deep.eq({ paused: {} })
  })

  it('resume', async () => {
    const txId = await program.methods
      .resume()
      .accounts({
        authority: provider.wallet.publicKey,
        order: order.publicKey,
      })
      .rpc()
    expect(txId).to.be.an('string')
  })

  it('validate order data: resume', async () => {
    const { state } = await program.account.order.fetch(order.publicKey)
    expect(state).to.deep.eq({ initialized: {} })
  })

  it('stop', async () => {
    const txId = await program.methods
      .stop()
      .accounts({
        authority: provider.wallet.publicKey,
        order: order.publicKey,
        aToken: aToken.publicKey,
        dstAAccount: aTokenAccount,
        treasury,
        treasurer,
        systemProgram: web3.SystemProgram.programId,
        tokenProgram: utils.token.TOKEN_PROGRAM_ID,
        associatedTokenProgram: utils.token.ASSOCIATED_PROGRAM_ID,
        rent: web3.SYSVAR_RENT_PUBKEY,
      })
      .rpc()
    expect(txId).to.be.an('string')
  })

  it('validate order data: stop', async () => {
    const { endDate, remainingAmount } = await program.account.order.fetch(
      order.publicKey,
    )
    const currentDate = await getCurrentTimestamp(provider.connection)
    expect(new BN(currentDate).gte(endDate)).to.be.true
    expect(remainingAmount.eq(new BN(0))).to.be.true
  })
})
