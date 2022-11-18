use crate::errors::ErrorCode;
use crate::schema::order::*;
use crate::utils::current_timestamp;
use anchor_lang::prelude::*;
use anchor_spl::{associated_token, token};

#[event]
pub struct MakeOrderEvent {
  pub order: Pubkey,
  pub authority: Pubkey,
  pub bid_token: Pubkey,
  pub ask_token: Pubkey,
  pub bid_amount: u64,
  pub ask_amount: u64,
  pub maker_fee: u64,
  pub taker_fee: u64,
  pub start_date: i64,
  pub end_date: i64,
  pub whitelist: [u8; 32],
}

#[derive(Accounts)]
pub struct MakeOrder<'info> {
  #[account(mut)]
  pub authority: Signer<'info>,
  #[account(init, payer = authority, space = Order::LEN)]
  pub order: Account<'info, Order>,
  pub bid_token: Box<Account<'info, token::Mint>>,
  pub ask_token: Box<Account<'info, token::Mint>>,
  #[account(mut)]
  pub src_bid_account: Box<Account<'info, token::TokenAccount>>,
  #[account(
    init,
    payer = authority,
    associated_token::mint = bid_token,
    associated_token::authority = treasurer
  )]
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

pub fn exec(
  ctx: Context<MakeOrder>,
  bid_amount: u64,
  ask_amount: u64,
  maker_fee: u64,
  taker_fee: u64,
  start_date: i64,
  end_date: i64,
  whitelist: [u8; 32],
) -> Result<()> {
  let order = &mut ctx.accounts.order;
  // Validate bid amount
  if bid_amount <= 0 || ask_amount <= 0 {
    return err!(ErrorCode::InvalidAmount);
  }
  // Validate datetime
  if start_date < current_timestamp().ok_or(ErrorCode::InvalidCurrentDate)? {
    return err!(ErrorCode::InvalidStartDate);
  }
  if end_date <= start_date {
    return err!(ErrorCode::InvalidEndDate);
  }

  let transfer_ctx = CpiContext::new(
    ctx.accounts.token_program.to_account_info(),
    token::Transfer {
      from: ctx.accounts.src_bid_account.to_account_info(),
      to: ctx.accounts.treasury.to_account_info(),
      authority: ctx.accounts.authority.to_account_info(),
    },
  );
  token::transfer(transfer_ctx, bid_amount)?;

  // Create order data
  order.authority = ctx.accounts.authority.key();
  order.bid_token = ctx.accounts.bid_token.key();
  order.ask_token = ctx.accounts.ask_token.key();
  order.bid_amount = bid_amount;
  order.ask_amount = ask_amount;
  order.remaining_amount = bid_amount;
  order.filled_amount = 0;
  order.maker_fee = maker_fee;
  order.taker_fee = taker_fee;
  order.start_date = start_date;
  order.end_date = end_date;
  order.whitelist = whitelist;
  order.state = OrderState::Initialized;

  emit!(MakeOrderEvent {
    order: order.key(),
    authority: order.authority,
    bid_token: order.bid_token,
    ask_token: order.ask_token,
    bid_amount: order.bid_amount,
    ask_amount: order.ask_amount,
    maker_fee: order.maker_fee,
    taker_fee: order.taker_fee,
    start_date: order.start_date,
    end_date: order.end_date,
    whitelist: order.whitelist
  });

  Ok(())
}
