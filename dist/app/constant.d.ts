import { FeeOptions } from './types';
export declare const DEFAULT_RPC_ENDPOINT = "https://api.devnet.solana.com";
export declare const DEFAULT_OTC_PROGRAM_ID = "otcesiq3oV6cDJA2fipi8NjSDyQ9LRkw2okR7kqPamt";
export declare const DEFAULT_OTC_IDL: import("../target/types/sen_otc_prog").SenOtcProg;
export declare const ORDER_DISCRIMINATOR: string;
export declare const NULL_WHITELIST: number[];
export declare const FEE_OPTIONS: (walletAddress?: string) => FeeOptions;
