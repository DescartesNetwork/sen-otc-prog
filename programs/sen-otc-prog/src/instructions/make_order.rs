use crate::errors::ErrorCode;
use crate::schema::order::*;
use crate::utils::current_timestamp;
use anchor_lang::prelude::*;
use anchor_spl::{associated_token, token};

#[event]
pub struct MakeOrderEvent {
  pub order: Pubkey,
  pub authority: Pubkey,
  pub a_token: Pubkey,
  pub b_token: Pubkey,
  pub a: u64,
  pub b: u64,
  pub maker_fee: u32,
  pub taker_fee: u32,
  pub taxman: Pubkey,
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
  pub a_token: Box<Account<'info, token::Mint>>,
  pub b_token: Box<Account<'info, token::Mint>>,
  #[account(mut)]
  pub src_a_account: Account<'info, token::TokenAccount>,
  #[account(
    init,
    payer = authority,
    associated_token::mint = a_token,
    associated_token::authority = treasurer
  )]
  pub treasury: Box<Account<'info, token::TokenAccount>>,
  #[account(seeds = [b"treasurer", &order.key().to_bytes()], bump)]
  /// CHECK: Just a pure account
  pub treasurer: AccountInfo<'info>,
  /// CHECK: Just a pure account
  pub taxman: AccountInfo<'info>,
  // programs
  pub system_program: Program<'info, System>,
  pub token_program: Program<'info, token::Token>,
  pub associated_token_program: Program<'info, associated_token::AssociatedToken>,
  pub rent: Sysvar<'info, Rent>,
}

pub fn exec(
  ctx: Context<MakeOrder>,
  a: u64,
  b: u64,
  maker_fee: u32,
  taker_fee: u32,
  start_date: i64,
  end_date: i64,
  whitelist: [u8; 32],
) -> Result<()> {
  let order = &mut ctx.accounts.order;
  // Validate a/b amount
  if a <= 0 || b <= 0 {
    return err!(ErrorCode::InvalidAmount);
  }
  if ctx.accounts.a_token.key() == ctx.accounts.b_token.key() {
    return err!(ErrorCode::InvalidToken);
  }
  // Validate datetime
  if end_date <= start_date
    || end_date <= current_timestamp().ok_or(ErrorCode::InvalidCurrentDate)?
  {
    return err!(ErrorCode::InvalidEndDate);
  }

  let transfer_ctx = CpiContext::new(
    ctx.accounts.token_program.to_account_info(),
    token::Transfer {
      from: ctx.accounts.src_a_account.to_account_info(),
      to: ctx.accounts.treasury.to_account_info(),
      authority: ctx.accounts.authority.to_account_info(),
    },
  );
  token::transfer(transfer_ctx, a)?;

  // Create order data
  order.authority = ctx.accounts.authority.key();
  order.a_token = ctx.accounts.a_token.key();
  order.b_token = ctx.accounts.b_token.key();
  order.a = a;
  order.b = b;
  order.remaining_amount = a;
  order.filled_amount = 0;
  order.maker_fee = maker_fee;
  order.taker_fee = taker_fee;
  order.taxman = ctx.accounts.taxman.key();
  order.start_date = start_date;
  order.end_date = end_date;
  order.whitelist = whitelist;
  order.state = OrderState::Initialized;

  emit!(MakeOrderEvent {
    order: order.key(),
    authority: order.authority,
    a_token: order.a_token,
    b_token: order.b_token,
    a: order.a,
    b: order.b,
    maker_fee: order.maker_fee,
    taker_fee: order.taker_fee,
    taxman: order.taxman,
    start_date: order.start_date,
    end_date: order.end_date,
    whitelist: order.whitelist
  });

  Ok(())
}
