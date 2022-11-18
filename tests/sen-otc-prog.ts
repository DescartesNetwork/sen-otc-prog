import {
  workspace,
  utils,
  Program,
  AnchorProvider,
  setProvider,
  Spl,
  web3,
} from '@project-serum/anchor'
import { SenOtcProg } from '../target/types/sen_otc_prog'
import { initializeMint } from './utils'

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

  before(async () => {
    // Init a mint
    await initializeMint(9, bidToken, spl)
    await initializeMint(9, askToken, spl)
    // Derive token account
    bidTokenAccount = await utils.token.associatedAddress({
      mint: bidToken.publicKey,
      owner: provider.wallet.publicKey,
    })
    askTokenAccount = await utils.token.associatedAddress({
      mint: askToken.publicKey,
      owner: provider.wallet.publicKey,
    })
  })

  it('Is initialized!', async () => {
    // Add your test here.
    console.log('Your transaction signature')
  })
})
