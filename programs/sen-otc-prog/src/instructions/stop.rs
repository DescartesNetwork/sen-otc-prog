use crate::errors::ErrorCode;
use crate::schema::order::*;
use crate::utils::current_timestamp;
use anchor_lang::prelude::*;
use anchor_spl::{associated_token, token};

#[event]
pub struct StopEvent {
  pub order: Pubkey,
  pub authority: Pubkey,
  pub remaining_amount: u64,
  pub end_date: i64,
}

#[derive(Accounts)]
pub struct Stop<'info> {
  #[account(mut)]
  pub authority: Signer<'info>,
  #[account(mut, has_one = authority, has_one = bid_token)]
  pub order: Account<'info, Order>,
  pub bid_token: Box<Account<'info, token::Mint>>,
  #[account(
    init_if_needed,
    payer = authority,
    associated_token::mint = bid_token,
    associated_token::authority = authority
  )]
  pub dst_bid_account: Box<Account<'info, token::TokenAccount>>,
  #[account(mut)]
  pub treasury: Box<Account<'info, token::TokenAccount>>,
  #[account(seeds = [b"treasurer", &order.key().to_bytes()], bump)]
  /// CHECK: Just a pure account
  pub treasurer: AccountInfo<'info>,
  // programs
  pub system_program: Program<'info, System>,
  pub token_program: Program<'info, token::Token>,
  pub associated_token_program: Program<'info, associated_token::AssociatedToken>,
  pub rent: Sysvar<'info, Rent>,
}

pub fn exec(ctx: Context<Stop>) -> Result<()> {
  let order = &mut ctx.accounts.order;

  let seeds: &[&[&[u8]]] = &[&[
    b"treasurer".as_ref(),
    &order.key().to_bytes(),
    &[*ctx.bumps.get("treasurer").ok_or(ErrorCode::NoBump)?],
  ]];

  // Transfer the remaining amount
  let remaining_amount = order.remaining_amount;
  let transfer_remaining_ctx = CpiContext::new_with_signer(
    ctx.accounts.token_program.to_account_info(),
    token::Transfer {
      from: ctx.accounts.treasury.to_account_info(),
      to: ctx.accounts.dst_bid_account.to_account_info(),
      authority: ctx.accounts.treasurer.to_account_info(),
    },
    seeds,
  );
  token::transfer(transfer_remaining_ctx, remaining_amount)?;

  // Update order data
  order.remaining_amount = 0;
  // Update end date if the authority stop the order before the plan
  let current_date = current_timestamp().ok_or(ErrorCode::InvalidCurrentDate)?;
  if order.end_date > current_date {
    order.end_date = current_date;
  }

  emit!(StopEvent {
    order: order.key(),
    authority: ctx.accounts.authority.key(),
    remaining_amount,
    end_date: order.end_date
  });

  Ok(())
}
