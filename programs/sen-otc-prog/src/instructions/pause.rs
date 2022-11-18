use crate::schema::order::*;
use anchor_lang::prelude::*;

#[event]
pub struct PauseEvent {
  pub order: Pubkey,
}

#[derive(Accounts)]
pub struct Pause<'info> {
  #[account(mut)]
  pub authority: Signer<'info>,
  #[account(mut)]
  pub order: Account<'info, Order>,
}

pub fn exec(ctx: Context<Pause>) -> Result<()> {
  let order = &mut ctx.accounts.order;

  // Update order data
  order.state = OrderState::Paused;

  Ok(())
}
