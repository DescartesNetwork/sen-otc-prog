use crate::errors::ErrorCode;
use crate::schema::order::*;
use crate::utils::current_timestamp;
use anchor_lang::prelude::*;
use anchor_spl::{associated_token, token};

#[event]
pub struct TakeOrderEvent {
  pub order: Pubkey,
  pub taker: Pubkey,
  pub bid_amount: u64,
  pub ask_amount: u64,
}

#[derive(Accounts)]
pub struct TakeOrder<'info> {
  #[account(mut)]
  pub taker: Signer<'info>,
  #[account(mut)]
  pub order: Account<'info, Order>,
  pub bid_token: Box<Account<'info, token::Mint>>,
  pub ask_token: Box<Account<'info, token::Mint>>,
  #[account(mut)]
  pub src_bid_account: Box<Account<'info, token::TokenAccount>>,
  #[account(
    init_if_needed,
    payer = taker,
    associated_token::mint = ask_token,
    associated_token::authority = taker
  )]
  pub dst_ask_account: Box<Account<'info, token::TokenAccount>>,
  #[account(mut)]
  pub treasury: Box<Account<'info, token::TokenAccount>>,
  #[account(seeds = [b"treasurer", &order.key().to_bytes()], bump)]
  /// CHECK: Just a pure account
  pub treasurer: AccountInfo<'info>,
  /// CHECK: Just a pure account
  pub taxman: AccountInfo<'info>,
  #[account(
    init_if_needed,
    payer = taker,
    associated_token::mint = bid_token,
    associated_token::authority = taxman
  )]
  pub maker_fee_account: Box<Account<'info, token::TokenAccount>>,
  #[account(
    init_if_needed,
    payer = taker,
    associated_token::mint = ask_token,
    associated_token::authority = taxman
  )]
  pub taker_fee_account: Box<Account<'info, token::TokenAccount>>,
  // programs
  pub system_program: Program<'info, System>,
  pub token_program: Program<'info, token::Token>,
  pub associated_token_program: Program<'info, associated_token::AssociatedToken>,
  pub rent: Sysvar<'info, Rent>,
}

pub fn exec(ctx: Context<TakeOrder>, bid_amount: u64, proof: Vec<[u8; 32]>) -> Result<()> {
  let order = &mut ctx.accounts.order;
  // Validate order state
  if !order.is_active() {
    return err!(ErrorCode::PausedOrder);
  }
  // Validate bid amount
  if bid_amount <= 0 || bid_amount > order.remaining_amount {
    return err!(ErrorCode::InvalidAmount);
  }
  // Validate datetime
  if order.start_date > current_timestamp().ok_or(ErrorCode::InvalidCurrentDate)? {
    return err!(ErrorCode::NotStartedOrder);
  }
  if order.end_date <= current_timestamp().ok_or(ErrorCode::InvalidCurrentDate)? {
    return err!(ErrorCode::EndedOrder);
  }
  // Validate the whitelist
  if !order.is_white(proof) {
    return err!(ErrorCode::NotInWhitelist);
  }

  // Compute ask amount
  let ask_amount = order
    .compute_ask_amount(bid_amount)
    .ok_or(ErrorCode::Overflow)?;
  // Compute maker fee
  let maker_fee = order
    .compute_maker_fee(ask_amount)
    .ok_or(ErrorCode::Overflow)?;
  // Compute taker fee
  let taker_fee = order
    .compute_taker_fee(bid_amount)
    .ok_or(ErrorCode::Overflow)?;
  // Compute bid amount after fee
  let bid_amount_after_fee = bid_amount
    .checked_sub(taker_fee)
    .ok_or(ErrorCode::Overflow)?;
  // Compute ask amount after fee
  let ask_amount_after_fee = ask_amount
    .checked_sub(maker_fee)
    .ok_or(ErrorCode::Overflow)?;

  let seeds: &[&[&[u8]]] = &[&[
    b"treasurer".as_ref(),
    &order.key().to_bytes(),
    &[*ctx.bumps.get("treasurer").ok_or(ErrorCode::NoBump)?],
  ]];

  // Transfer bid amount
  let transfer_bid_amount_after_fee_ctx = CpiContext::new(
    ctx.accounts.token_program.to_account_info(),
    token::Transfer {
      from: ctx.accounts.src_bid_account.to_account_info(),
      to: ctx.accounts.treasury.to_account_info(),
      authority: ctx.accounts.taker.to_account_info(),
    },
  );
  token::transfer(transfer_bid_amount_after_fee_ctx, bid_amount_after_fee)?;
  // Transfer maker fee
  let transfer_maker_fee_ctx = CpiContext::new(
    ctx.accounts.token_program.to_account_info(),
    token::Transfer {
      from: ctx.accounts.src_bid_account.to_account_info(),
      to: ctx.accounts.maker_fee_account.to_account_info(),
      authority: ctx.accounts.taker.to_account_info(),
    },
  );
  token::transfer(transfer_maker_fee_ctx, maker_fee)?;
  // Transfer ask amount
  let transfer_ask_amount_after_fee_ctx = CpiContext::new_with_signer(
    ctx.accounts.token_program.to_account_info(),
    token::Transfer {
      from: ctx.accounts.treasury.to_account_info(),
      to: ctx.accounts.dst_ask_account.to_account_info(),
      authority: ctx.accounts.treasurer.to_account_info(),
    },
    seeds,
  );
  token::transfer(transfer_ask_amount_after_fee_ctx, ask_amount_after_fee)?;
  // Transfer taker fee
  let transfer_taker_fee_ctx = CpiContext::new_with_signer(
    ctx.accounts.token_program.to_account_info(),
    token::Transfer {
      from: ctx.accounts.treasury.to_account_info(),
      to: ctx.accounts.taker_fee_account.to_account_info(),
      authority: ctx.accounts.treasurer.to_account_info(),
    },
    seeds,
  );
  token::transfer(transfer_taker_fee_ctx, taker_fee)?;

  // Update order data
  order.remaining_amount = order
    .remaining_amount
    .checked_sub(bid_amount)
    .ok_or(ErrorCode::Overflow)?;
  order.filled_amount = order
    .filled_amount
    .checked_add(ask_amount)
    .ok_or(ErrorCode::Overflow)?;

  emit!(TakeOrderEvent {
    order: order.key(),
    taker: ctx.accounts.taker.key(),
    bid_amount: order.bid_amount,
    ask_amount: order.ask_amount,
  });

  Ok(())
}
