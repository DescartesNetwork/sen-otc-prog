import { web3, Program, utils, BN, AnchorProvider } from '@project-serum/anchor'

import {
  DEFAULT_RPC_ENDPOINT,
  DEFAULT_OTC_PROGRAM_ID,
  DEFAULT_OTC_IDL,
  FEE_OPTIONS,
  NULL_WHITELIST,
} from './constant'
import {
  SenOtcIdl,
  AnchorWallet,
  FeeOptions,
  SenOtcEvents,
  OrderData,
} from './types'
import { isAddress } from './utils'

class Otc {
  private _connection: web3.Connection
  private _provider: AnchorProvider
  readonly program: Program<SenOtcIdl>

  constructor(
    wallet: AnchorWallet,
    rpcEndpoint: string = DEFAULT_RPC_ENDPOINT,
    programId: string = DEFAULT_OTC_PROGRAM_ID,
  ) {
    if (!isAddress(programId)) throw new Error('Invalid program id')
    // Private
    this._connection = new web3.Connection(rpcEndpoint, 'confirmed')
    this._provider = new AnchorProvider(this._connection, wallet, {
      skipPreflight: true,
      commitment: 'confirmed',
    })
    // Public
    this.program = new Program<SenOtcIdl>(
      DEFAULT_OTC_IDL,
      programId,
      this._provider,
    )
  }

  /**
   * Get list of event names
   */
  get events() {
    return this.program.idl.events.map(({ name }) => name)
  }

  /**
   * Listen changes on an event
   * @param eventName Event name
   * @param callback Event handler
   * @returns Listener id
   */
  addListener = <T extends keyof SenOtcEvents>(
    eventName: T,
    callback: (data: SenOtcEvents[T]) => void,
  ) => {
    return this.program.addEventListener(
      eventName as string,
      (data: SenOtcEvents[T]) => callback(data),
    )
  }

  /**
   * Remove listener by its id
   * @param listenerId Listener id
   * @returns
   */
  removeListener = async (listenerId: number) => {
    try {
      await this.program.removeEventListener(listenerId)
    } catch (er: any) {
      console.warn(er.message)
    }
  }

  /**
   * Get current Unix Timestamp of Solana Cluster
   * @returns Number (in seconds)
   */
  getCurrentUnixTimestamp = async (): Promise<number> => {
    const { data } =
      (await this.program.provider.connection.getAccountInfo(
        web3.SYSVAR_CLOCK_PUBKEY,
      )) || {}
    if (!data) throw new Error('Cannot read clock data')
    const bn = new BN(data.subarray(32, 40), 'le')
    return bn.toNumber()
  }

  /**
   * Parse order buffer data.
   * @param data Dao buffer data.
   * @returns Dao readable data.
   */
  parseOrderData = (data: Buffer): OrderData => {
    return this.program.coder.accounts.decode('order', data)
  }

  /**
   * Get order data.
   * @param orderAddress Order address.
   * @returns Order readable data.
   */
  getOrderData = async (orderAddress: string): Promise<OrderData> => {
    return this.program.account.order.fetch(orderAddress)
  }

  /**
   * Derive treasurer address of an order.
   * @param orderAddress The order address.
   * @returns Treasurer address that holds the secure token treasuries of the order.
   */
  deriveTreasurerAddress = async (orderAddress: string) => {
    if (!isAddress(orderAddress)) throw new Error('Invalid order address')
    const [treasurerPublicKey] = await web3.PublicKey.findProgramAddress(
      [Buffer.from('treasurer'), new web3.PublicKey(orderAddress).toBuffer()],
      this.program.programId,
    )
    return treasurerPublicKey.toBase58()
  }

  /**
   * Make an order. This order will sell A to buy B.
   * @param opt.aTokenAddress The token (mint) A that is bided by the maker in the order.
   * @param opt.aTokenAmount The amount of token A that is deposited.
   * @param opt.bTokenAddress The token (mint) B that is asked by the maker in the order.
   * @param opt.bTokenAmount The amount of token B that is expected.
   * @param opt.startDate The start date.
   * @param opt.endDate The end date.
   * @param opt.feeOpt (Optional) Setup the maker & taker fee.
   * @param opt.whitelist (Optional) The whitelist. By default, set an array of [32;0] to desiable the feature.
   * @param opt.order (Optional) The order keypair. If it's not provided, a new one will be auto generated.
   * @param sendAndConfirm (Optional) Send and confirm the transaction immediately.
   * @returns { tx, txId, orderAddress }
   */
  makeOrder = async (
    {
      aTokenAddress,
      aTokenAmount,
      bTokenAddress,
      bTokenAmount,
      startDate,
      endDate,
      feeOpt = FEE_OPTIONS(),
      whitelist = NULL_WHITELIST,
      order = web3.Keypair.generate(),
    }: {
      aTokenAddress: string
      aTokenAmount: BN
      bTokenAddress: string
      bTokenAmount: BN
      startDate: BN
      endDate: BN
      feeOpt?: FeeOptions
      whitelist?: number[]
      order?: web3.Keypair
    },
    sendAndConfirm = true,
  ): Promise<{ tx: web3.Transaction; txId: string; orderAddress: string }> => {
    if (
      !isAddress(aTokenAddress) ||
      !isAddress(bTokenAddress) ||
      aTokenAddress === bTokenAddress
    )
      throw new Error('Invalid token address')
    if (!aTokenAmount.gt(new BN(0)) || !bTokenAmount.gt(new BN(0)))
      throw new Error('Token amounts must be greater than zero')
    if (whitelist.length !== 32) throw new Error('Invalid whitelist path')
    const aTokenPublicKey = new web3.PublicKey(aTokenAddress)
    const srcAAccountPublicKey = await utils.token.associatedAddress({
      mint: aTokenPublicKey,
      owner: this._provider.wallet.publicKey,
    })
    const bTokenPublicKey = new web3.PublicKey(bTokenAddress)
    const treasurerAddress = await this.deriveTreasurerAddress(
      order.publicKey.toBase58(),
    )
    const treasurerPublicKey = new web3.PublicKey(treasurerAddress)
    const treasuryPublicKey = await utils.token.associatedAddress({
      mint: aTokenPublicKey,
      owner: treasurerPublicKey,
    })
    const builder = this.program.methods
      .makeOrder(
        aTokenAmount,
        bTokenAmount,
        feeOpt.makerFee,
        feeOpt.takerFee,
        startDate,
        endDate,
        whitelist,
      )
      .accounts({
        authority: this._provider.wallet.publicKey,
        order: order.publicKey,
        aToken: aTokenPublicKey,
        bToken: bTokenPublicKey,
        srcAAccount: srcAAccountPublicKey,
        treasury: treasuryPublicKey,
        treasurer: treasurerPublicKey,
        taxman: new web3.PublicKey(feeOpt.taxmanAddress),
        systemProgram: web3.SystemProgram.programId,
        tokenProgram: utils.token.TOKEN_PROGRAM_ID,
        associatedTokenProgram: utils.token.ASSOCIATED_PROGRAM_ID,
        rent: web3.SYSVAR_RENT_PUBKEY,
      })
      .signers([order])
    const tx = await builder.transaction()
    const txId = sendAndConfirm
      ? await builder.rpc({ commitment: 'confirmed' })
      : ''

    return { tx, txId, orderAddress: order.publicKey.toBase58() }
  }

  /**
   * Take an order
   * @param opt.orderAddress The order address.
   * @param sendAndConfirm (Optional) Send and confirm the transaction immediately.
   * @returns { txId }
   */
  takeOrder = async (
    {
      orderAddress,
      amount,
      proof = [],
    }: {
      orderAddress: string
      amount: BN
      proof?: Buffer[] | Uint8Array[] | number[][]
    },
    sendAndConfirm = true,
  ) => {
    if (!isAddress(orderAddress)) throw new Error('Invalid order address')
    const order = new web3.PublicKey(orderAddress)
    const { authority, aToken, bToken, taxman } = await this.getOrderData(
      orderAddress,
    )
    const srcBAccount = await utils.token.associatedAddress({
      mint: bToken,
      owner: this._provider.wallet.publicKey,
    })
    const dstBAccount = await utils.token.associatedAddress({
      mint: bToken,
      owner: authority,
    })
    const dstAAccount = await utils.token.associatedAddress({
      mint: aToken,
      owner: this._provider.wallet.publicKey,
    })
    const treasurerAddress = await this.deriveTreasurerAddress(orderAddress)
    const treasurer = new web3.PublicKey(treasurerAddress)
    const treasury = await utils.token.associatedAddress({
      mint: aToken,
      owner: treasurer,
    })
    const makerFeeAccount = await utils.token.associatedAddress({
      mint: bToken,
      owner: taxman,
    })
    const takerFeeAccount = await utils.token.associatedAddress({
      mint: aToken,
      owner: taxman,
    })
    const builder = this.program.methods.takeOrder(amount, proof).accounts({
      taker: this._provider.wallet.publicKey,
      authority,
      order,
      aToken,
      bToken,
      srcBAccount,
      dstBAccount,
      dstAAccount,
      treasurer,
      treasury,
      taxman,
      makerFeeAccount,
      takerFeeAccount,
      systemProgram: web3.SystemProgram.programId,
      tokenProgram: utils.token.TOKEN_PROGRAM_ID,
      associatedTokenProgram: utils.token.ASSOCIATED_PROGRAM_ID,
      rent: web3.SYSVAR_RENT_PUBKEY,
    })
    const tx = await builder.transaction()
    const txId = sendAndConfirm
      ? await builder.rpc({ commitment: 'confirmed' })
      : ''
    return { tx, txId }
  }

  /**
   * Pause an order
   * @param opt.orderAddress The order address.
   * @param sendAndConfirm (Optional) Send and confirm the transaction immediately.
   * @returns { txId }
   */
  pause = async (
    { orderAddress }: { orderAddress: string },
    sendAndConfirm = true,
  ) => {
    if (!isAddress(orderAddress)) throw new Error('Invalid order address')
    const orderPublicKey = new web3.PublicKey(orderAddress)
    const builder = this.program.methods.pause().accounts({
      authority: this._provider.wallet.publicKey,
      order: orderPublicKey,
    })
    const tx = await builder.transaction()
    const txId = sendAndConfirm
      ? await builder.rpc({ commitment: 'confirmed' })
      : ''
    return { tx, txId }
  }

  /**
   * Resume an order
   * @param opt.orderAddress The order address.
   * @param sendAndConfirm (Optional) Send and confirm the transaction immediately.
   * @returns { txId }
   */
  resume = async (
    { orderAddress }: { orderAddress: string },
    sendAndConfirm = true,
  ) => {
    if (!isAddress(orderAddress)) throw new Error('Invalid order address')
    const orderPublicKey = new web3.PublicKey(orderAddress)
    const builder = this.program.methods.resume().accounts({
      authority: this._provider.wallet.publicKey,
      order: orderPublicKey,
    })
    const tx = await builder.transaction()
    const txId = sendAndConfirm
      ? await builder.rpc({ commitment: 'confirmed' })
      : ''
    return { tx, txId }
  }

  /**
   * Stop an order
   * @param opt.orderAddress The order address.
   * @param sendAndConfirm (Optional) Send and confirm the transaction immediately.
   * @returns { txId }
   */
  stop = async (
    { orderAddress }: { orderAddress: string },
    sendAndConfirm = true,
  ) => {
    if (!isAddress(orderAddress)) throw new Error('Invalid order address')
    const orderPublicKey = new web3.PublicKey(orderAddress)
    const { aToken } = await this.getOrderData(orderAddress)
    const dstAAccountPublicKey = await utils.token.associatedAddress({
      mint: aToken,
      owner: this._provider.wallet.publicKey,
    })
    const treasurerAddress = await this.deriveTreasurerAddress(orderAddress)
    const treasurerPublicKey = new web3.PublicKey(treasurerAddress)
    const treasury = await utils.token.associatedAddress({
      mint: aToken,
      owner: treasurerPublicKey,
    })
    const builder = this.program.methods.stop().accounts({
      authority: this._provider.wallet.publicKey,
      order: orderPublicKey,
      aToken,
      dstAAccount: dstAAccountPublicKey,
      treasurer: treasurerPublicKey,
      treasury,
      systemProgram: web3.SystemProgram.programId,
      tokenProgram: utils.token.TOKEN_PROGRAM_ID,
      associatedTokenProgram: utils.token.ASSOCIATED_PROGRAM_ID,
      rent: web3.SYSVAR_RENT_PUBKEY,
    })
    const tx = await builder.transaction()
    const txId = sendAndConfirm
      ? await builder.rpc({ commitment: 'confirmed' })
      : ''
    return { tx, txId }
  }
}

export default Otc
