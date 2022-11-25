import { IdlAccounts, IdlTypes, Idl, BN } from '@project-serum/anchor'
import { IdlEvent } from '@project-serum/anchor/dist/cjs/idl'
import { TypeDef } from '@project-serum/anchor/dist/cjs/program/namespace/types'
import { Wallet } from '@project-serum/anchor/dist/cjs/provider'
import { SenOtcProg } from '../target/types/sen_otc_prog'

export type SenOtcIdl = SenOtcProg

export type AnchorWallet = Wallet

export type OrderData = Omit<IdlAccounts<SenOtcIdl>['order'], 'state'> & {
  state: OrderState
}

export type OrderState = IdlTypes<SenOtcIdl>['OrderState']
export const OrderStates: Record<string, OrderState> = {
  Uninitialized: { uninitialized: {} },
  Initialized: { initialized: {} },
  Paused: { paused: {} },
}

type TypeDefDictionary<T extends IdlEvent[], Defined> = {
  [K in T[number]['name']]: TypeDef<
    {
      name: K
      type: {
        kind: 'struct'
        fields: Extract<T[number], { name: K }>['fields']
      }
    },
    Defined
  >
}
type IdlEvents<T extends Idl> = TypeDefDictionary<
  NonNullable<T['events']>,
  Record<string, never>
>
export type SenOtcEvents = IdlEvents<SenOtcProg>

export type FeeOptions = {
  makerFee: number
  takerFee: number
  taxmanAddress: string
}
