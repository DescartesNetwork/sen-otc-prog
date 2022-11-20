import bs58 from 'bs58'
import { BorshAccountsCoder, web3 } from '@project-serum/anchor'

import { IDL } from '../target/types/sen_otc_prog'
import { FeeOptions } from './types'

export const DEFAULT_RPC_ENDPOINT = 'https://api.devnet.solana.com'
export const DEFAULT_OTC_PROGRAM_ID =
  'otcesiq3oV6cDJA2fipi8NjSDyQ9LRkw2okR7kqPamt'
export const DEFAULT_OTC_IDL = IDL

export const ORDER_DISCRIMINATOR = bs58.encode(
  BorshAccountsCoder.accountDiscriminator('order'),
)

export const NULL_WHITELIST: number[] = Array(32).fill(0)

export const FEE_OPTIONS = (
  walletAddress: string = new web3.Keypair().publicKey.toBase58(),
): FeeOptions => ({
  makerFee: 0,
  takerFee: 0,
  taxmanAddress: walletAddress,
})
