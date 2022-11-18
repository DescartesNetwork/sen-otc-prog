use anchor_lang::prelude::*;

pub mod constants;
pub mod errors;
pub mod instructions;
pub mod schema;
pub mod utils;

pub use errors::*;
pub use instructions::*;
pub use schema::*;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod sen_otc_prog {
  use super::*;

  pub fn make_order(
    ctx: Context<MakeOrder>,
    bid_amount: u64,
    ask_amount: u64,
    maker_fee: u64,
    taker_fee: u64,
    start_date: i64,
    end_date: i64,
    whitelist: [u8; 32],
  ) -> Result<()> {
    make_order::exec(
      ctx, bid_amount, ask_amount, maker_fee, taker_fee, start_date, end_date, whitelist,
    )
  }

  pub fn take_order(ctx: Context<TakeOrder>, bid_amount: u64, proof: Vec<[u8; 32]>) -> Result<()> {
    take_order::exec(ctx, bid_amount, proof)
  }

  pub fn pause(ctx: Context<Pause>) -> Result<()> {
    pause::exec(ctx)
  }

  pub fn resume(ctx: Context<Resume>) -> Result<()> {
    resume::exec(ctx)
  }

  pub fn stop(ctx: Context<Stop>) -> Result<()> {
    stop::exec(ctx)
  }
}
