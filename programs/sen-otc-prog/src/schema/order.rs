use crate::constants::*;
use anchor_lang::{prelude::*, solana_program::keccak};
use num_traits::ToPrimitive;

///
/// Order State
///
#[repr(u8)]
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, PartialEq)]
pub enum OrderState {
  Unitialized,
  Initialized,
  Paused,
}
impl Default for OrderState {
  fn default() -> Self {
    OrderState::Unitialized
  }
}

#[account]
pub struct Order {
  pub authority: Pubkey,
  pub bid_token: Pubkey,
  pub ask_token: Pubkey,
  pub bid_amount: u64,
  pub ask_amount: u64,
  pub remaining_amount: u64,
  pub filled_amount: u64,
  pub maker_fee: u64, // decimal 9
  pub taker_fee: u64, // decimal 9
  pub start_date: i64,
  pub end_date: i64,
  pub whitelist: [u8; 32],
  pub state: OrderState,
}

impl Order {
  pub const LEN: usize = DISCRIMINATOR_SIZE
    + PUBKEY_SIZE
    + PUBKEY_SIZE
    + PUBKEY_SIZE
    + U32_SIZE
    + I64_SIZE
    + I64_SIZE
    + U8_SIZE;

  pub fn is_active(&self) -> bool {
    self.state == OrderState::Initialized
  }

  pub fn is_whitelist(&self, proof: Vec<[u8; 32]>, taker: Pubkey) -> bool {
    if self.whitelist.len() == 0 {
      return true;
    }
    let leaf = keccak::hashv(&[&taker.to_bytes()]).0;
    let mut child = leaf;
    for sibling in proof.into_iter() {
      child = if child <= sibling {
        keccak::hashv(&[&child, &sibling]).0
      } else {
        keccak::hashv(&[&sibling, &child]).0
      }
    }
    child == self.whitelist
  }

  pub fn compute_ask_amount(&self, bid_amount: u64) -> Option<u64> {
    bid_amount
      .to_u128()?
      .checked_mul(self.ask_amount.to_u128()?)?
      .checked_div(self.bid_amount.to_u128()?)?
      .to_u64()
  }

  pub fn compute_maker_fee(&self, ask_amount: u64) -> Option<u64> {
    ask_amount
      .to_u128()?
      .checked_mul(self.maker_fee.to_u128()?)?
      .checked_div(DECIMALS.to_u128()?)?
      .to_u64()
  }

  pub fn compute_taker_fee(&self, bid_amount: u64) -> Option<u64> {
    bid_amount
      .to_u128()?
      .checked_mul(self.taker_fee.to_u128()?)?
      .checked_div(DECIMALS.to_u128()?)?
      .to_u64()
  }
}
