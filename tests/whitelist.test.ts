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
import { NULL_WHITELIST, decimals, A, B, a, b, x, y, DECIMALS } from './configs'
import { MerkleWhitelist } from '../app'

describe('whitelist', () => {
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

  const merkleWhitelist = new MerkleWhitelist([
    web3.Keypair.generate().publicKey,
    web3.Keypair.generate().publicKey,
    web3.Keypair.generate().publicKey,
    provider.wallet.publicKey,
  ])

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
    const merkleRoot = merkleWhitelist.deriveMerkleRoot()
    const txId = await program.methods
      .makeOrder(
        a,
        b,
        0,
        0,
        new BN(currentDate + 5),
        new BN(currentDate + 10),
        [...merkleRoot],
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
    expect(whitelist).to.deep.eq([...merkleWhitelist.deriveMerkleRoot()])
    // Check A token account
    const { amount: aAmount } = await spl.account.token.fetch(aTokenAccount)
    expect(aAmount.eq(new BN(0))).to.be.true
  })

  it('take order', async () => {
    const proof = merkleWhitelist.deriveProof(provider.wallet.publicKey)
    // Wait for starting
    await asyncWait(5)
    // Take the order
    const txId = await program.methods
      .takeOrder(y, proof)
      .accounts({
        taker: provider.wallet.publicKey,
        authority: provider.wallet.publicKey,
        order: order.publicKey,
        aToken: aToken.publicKey,
        bToken: bToken.publicKey,
        srcBAccount: bTokenAccount,
        dstBAccount: bTokenAccount,
        dstAAccount: aTokenAccount,
        treasury,
        treasurer,
        taxman: taxman.publicKey,
        makerFeeAccount,
        takerFeeAccount,
        systemProgram: web3.SystemProgram.programId,
        tokenProgram: utils.token.TOKEN_PROGRAM_ID,
        associatedTokenProgram: utils.token.ASSOCIATED_PROGRAM_ID,
        rent: web3.SYSVAR_RENT_PUBKEY,
      })
      .rpc()
    expect(txId).to.be.an('string')
  })

  it('validate order data', async () => {
    // Check internal order state
    const { remainingAmount, filledAmount } = await program.account.order.fetch(
      order.publicKey,
    )
    expect(a.sub(x).eq(remainingAmount)).to.be.true
    expect(y.eq(filledAmount)).to.be.true
    // Check treasury
    const { amount: treasuryAmount } = await spl.account.token.fetch(treasury)
    expect(treasuryAmount.eq(remainingAmount)).to.be.true
    // Check A token account
    const { amount: aAmount } = await spl.account.token.fetch(aTokenAccount)
    expect(x.eq(aAmount)).to.be.true
    // Check B token account
    const { amount: bAmount } = await spl.account.token.fetch(bTokenAccount)
    expect(b.eq(bAmount)).to.be.true
  })
})
