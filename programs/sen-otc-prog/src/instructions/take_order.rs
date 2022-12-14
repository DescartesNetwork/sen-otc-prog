use crate::errors::ErrorCode;
use crate::schema::order::*;
use crate::utils::current_timestamp;
use anchor_lang::prelude::*;
use anchor_spl::{associated_token, token};

#[event]
pub struct TakeOrderEvent {
  pub order: Pubkey,
  pub taker: Pubkey,
  pub x: u64,
  pub y: u64,
  pub maker_fee: u64,
  pub taker_fee: u64,
}

#[derive(Accounts)]
pub struct TakeOrder<'info> {
  #[account(mut)]
  pub taker: Signer<'info>,
  /// CHECK: Just a pure account
  pub authority: AccountInfo<'info>,
  #[account(
    mut,
    has_one = authority,
    has_one = a_token,
    has_one = b_token,
    // has_one = taxman
  )]
  pub order: Account<'info, Order>,
  pub a_token: Box<Account<'info, token::Mint>>,
  pub b_token: Box<Account<'info, token::Mint>>,
  pub src_b_account: Box<Account<'info, token::TokenAccount>>,
  #[account(
    init_if_needed,
    payer = taker,
    associated_token::mint = b_token,
    associated_token::authority = authority
  )]
  pub dst_b_account: Box<Account<'info, token::TokenAccount>>,
  #[account(
    init_if_needed,
    payer = taker,
    associated_token::mint = a_token,
    associated_token::authority = taker
  )]
  pub dst_a_account: Box<Account<'info, token::TokenAccount>>,
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
    associated_token::mint = b_token,
    associated_token::authority = taxman
  )]
  pub maker_fee_account: Box<Account<'info, token::TokenAccount>>,
  #[account(
    init_if_needed,
    payer = taker,
    associated_token::mint = a_token,
    associated_token::authority = taxman
  )]
  pub taker_fee_account: Box<Account<'info, token::TokenAccount>>,
  // programs
  pub system_program: Program<'info, System>,
  pub token_program: Program<'info, token::Token>,
  pub associated_token_program: Program<'info, associated_token::AssociatedToken>,
  pub rent: Sysvar<'info, Rent>,
}

pub fn exec(ctx: Context<TakeOrder>, y: u64, proof: Vec<[u8; 32]>) -> Result<()> {
  let order = &mut ctx.accounts.order;
  // Validate order state
  if !order.is_active() {
    return err!(ErrorCode::PausedOrder);
  }
  // Validate bid amount
  if y <= 0
    || y
      > order
        .b
        .checked_sub(order.filled_amount)
        .ok_or(ErrorCode::InvalidAmount)?
  {
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
  if !order.is_whitelist(proof, ctx.accounts.taker.key()) {
    return err!(ErrorCode::NotInWhitelist);
  }

  // Compute x
  let x = order.compute_x(y).ok_or(ErrorCode::Overflow)?;
  // Compute maker fee
  let maker_fee = order.compute_maker_fee(y).ok_or(ErrorCode::Overflow)?;
  // Compute taker fee
  let taker_fee = order.compute_taker_fee(x).ok_or(ErrorCode::Overflow)?;
  // Compute x after taker fee
  let x_after_fee = x.checked_sub(taker_fee).ok_or(ErrorCode::Overflow)?;
  // Compute y after maker fee
  let y_after_fee = y.checked_sub(maker_fee).ok_or(ErrorCode::Overflow)?;

  let seeds: &[&[&[u8]]] = &[&[
    b"treasurer".as_ref(),
    &order.key().to_bytes(),
    &[*ctx.bumps.get("treasurer").ok_or(ErrorCode::NoBump)?],
  ]];

  // Transfer y
  let transfer_y_ctx = CpiContext::new(
    ctx.accounts.token_program.to_account_info(),
    token::Transfer {
      from: ctx.accounts.src_b_account.to_account_info(),
      to: ctx.accounts.dst_b_account.to_account_info(),
      authority: ctx.accounts.taker.to_account_info(),
    },
  );
  token::transfer(transfer_y_ctx, y_after_fee)?;
  // Transfer maker fee
  if maker_fee > 0 {
    let transfer_maker_fee_ctx = CpiContext::new(
      ctx.accounts.token_program.to_account_info(),
      token::Transfer {
        from: ctx.accounts.src_b_account.to_account_info(),
        to: ctx.accounts.maker_fee_account.to_account_info(),
        authority: ctx.accounts.taker.to_account_info(),
      },
    );
    token::transfer(transfer_maker_fee_ctx, maker_fee)?;
  }
  // Transfer x
  let transfer_x_ctx = CpiContext::new_with_signer(
    ctx.accounts.token_program.to_account_info(),
    token::Transfer {
      from: ctx.accounts.treasury.to_account_info(),
      to: ctx.accounts.dst_a_account.to_account_info(),
      authority: ctx.accounts.treasurer.to_account_info(),
    },
    seeds,
  );
  token::transfer(transfer_x_ctx, x_after_fee)?;
  // Transfer taker fee
  if taker_fee > 0 {
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
  }

  // Update order data
  order.remaining_amount = order
    .remaining_amount
    .checked_sub(x)
    .ok_or(ErrorCode::Overflow)?;
  order.filled_amount = order
    .filled_amount
    .checked_add(y)
    .ok_or(ErrorCode::Overflow)?;

  emit!(TakeOrderEvent {
    order: order.key(),
    taker: ctx.accounts.taker.key(),
    x: x_after_fee,
    y: y_after_fee,
    maker_fee,
    taker_fee
  });

  Ok(())
}
