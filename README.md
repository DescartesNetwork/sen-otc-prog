# OTC

## IMPORTANT!

In this program, we will use strict conventions that

- `a` is the amount of token `A` that the MAKER wants to sell.
- `b` is the amount of token `B` that the MAKER wants to buy.
- `x` is the amount of token `A` that a TAKER takes out of the treasury.
- `y` is the amount of token `B` that a TAKER puts in of the treasury.
- `maker_fee` is always about the token `B`.
- `taker_fee` is always about the token `A`.

## Installation

```bash
npm i @sentre/otc
```

or,

```bash
yarn add @sentre/otc
```

## Usage

```js
import Otc, { DEFAULT_OTC_PROGRAM_ID, DEFAULT_RPC_ENDPOINT } from '@sentre/otc'
import { Wallet, web3 } from '@project-serum/anchor'

const wallet = new Wallet(web3.Keypair.generate())
const otc = new Otc(wallet, DEFAULT_RPC_ENDPOINT, DEFAULT_OTC_PROGRAM_ID)

const order = await otc.getOrderData(
  '9EKdURf9kaR8yeu9sWSiGQaeMz59zfigQe4mcfsGnLW8',
)
```
