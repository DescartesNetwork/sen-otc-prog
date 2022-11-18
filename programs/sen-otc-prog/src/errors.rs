use anchor_lang::prelude::*;

#[error_code]
pub enum ErrorCode {
  #[msg("Operation overflowed")]
  Overflow,
  #[msg("Cannot derive the program address")]
  NoBump,
  #[msg("Invalid amount")]
  InvalidAmount,
  #[msg("The order isn't started yet")]
  NotStartedOrder,
  #[msg("The proposal isn't ended yet")]
  NotEndedProposal,
  #[msg("The order had been ended")]
  EndedOrder,
  #[msg("The order is paused")]
  PausedOrder,
  #[msg("Cannot get current date")]
  InvalidCurrentDate,
  #[msg("Start date need to be greater than or equal to current date")]
  InvalidStartDate,
  #[msg("End date need to be greater than start date and current date")]
  InvalidEndDate,
  #[msg("Not in whitelist")]
  NotInWhitelist,
}
