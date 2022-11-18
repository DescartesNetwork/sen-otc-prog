import * as anchor from "@project-serum/anchor";
import { Program } from "@project-serum/anchor";
import { SenOtcProg } from "../target/types/sen_otc_prog";

describe("sen-otc-prog", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.SenOtcProg as Program<SenOtcProg>;

  it("Is initialized!", async () => {
    // Add your test here.
    const tx = await program.methods.initialize().rpc();
    console.log("Your transaction signature", tx);
  });
});
