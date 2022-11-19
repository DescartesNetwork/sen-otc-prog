"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FEE_OPTIONS = exports.NULL_WHITELIST = exports.ORDER_DISCRIMINATOR = exports.DEFAULT_OTC_IDL = exports.DEFAULT_OTC_PROGRAM_ID = exports.DEFAULT_RPC_ENDPOINT = void 0;
const bs58_1 = __importDefault(require("bs58"));
const anchor_1 = require("@project-serum/anchor");
const sen_otc_prog_1 = require("../target/types/sen_otc_prog");
exports.DEFAULT_RPC_ENDPOINT = 'https://api.devnet.solana.com';
exports.DEFAULT_OTC_PROGRAM_ID = 'otcesiq3oV6cDJA2fipi8NjSDyQ9LRkw2okR7kqPamt';
exports.DEFAULT_OTC_IDL = sen_otc_prog_1.IDL;
exports.ORDER_DISCRIMINATOR = bs58_1.default.encode(anchor_1.BorshAccountsCoder.accountDiscriminator('order'));
exports.NULL_WHITELIST = Array(32).fill(0);
const FEE_OPTIONS = (walletAddress = new anchor_1.web3.Keypair().publicKey.toBase58()) => ({
    makerFee: 0,
    takerFee: 0,
    taxmanAddress: walletAddress,
});
exports.FEE_OPTIONS = FEE_OPTIONS;
