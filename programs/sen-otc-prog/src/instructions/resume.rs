use crate::schema::order::*;
use anchor_lang::prelude::*;

#[event]
pub struct ResumeEvent {
  pub order: Pubkey,
  pub authority: Pubkey,
}

#[derive(Accounts)]
pub struct Resume<'info> {
  #[account(mut)]
  pub authority: Signer<'info>,
  #[account(mut, has_one = authority)]
  pub order: Account<'info, Order>,
}

pub fn exec(ctx: Context<Resume>) -> Result<()> {
  let order = &mut ctx.accounts.order;

  // Update order data
  order.state = OrderState::Initialized;

  emit!(ResumeEvent {
    order: order.key(),
    authority: ctx.accounts.authority.key(),
  });

  Ok(())
}
