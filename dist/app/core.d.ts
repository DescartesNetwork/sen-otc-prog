/// <reference types="node" />
import { web3, Program, BN } from '@project-serum/anchor';
import { SenOtcProg } from '../target/types/sen_otc_prog';
import { AnchorWallet, FeeOptions, IdlEvents, OrderData } from './types';
declare class Otc {
    private _connection;
    private _provider;
    readonly program: Program<SenOtcProg>;
    constructor(wallet: AnchorWallet, rpcEndpoint?: string, programId?: string);
    /**
     * Get list of event names
     */
    get events(): ("MakeOrderEvent" | "PauseEvent" | "ResumeEvent" | "StopEvent" | "TakeOrderEvent")[];
    /**
     * Listen changes on an event
     * @param eventName Event name
     * @param callback Event handler
     * @returns Listener id
     */
    addListener: <T extends "MakeOrderEvent" | "PauseEvent" | "ResumeEvent" | "StopEvent" | "TakeOrderEvent">(eventName: T, callback: (data: IdlEvents<SenOtcProg>[T]) => void) => number;
    /**
     * Remove listener by its id
     * @param listenerId Listener id
     * @returns
     */
    removeListener: (listenerId: number) => Promise<void>;
    /**
     * Get current Unix Timestamp of Solana Cluster
     * @returns Number (in seconds)
     */
    getCurrentUnixTimestamp: () => Promise<number>;
    /**
     * Parse order buffer data.
     * @param data Dao buffer data.
     * @returns Dao readable data.
     */
    parseOrderData: (data: Buffer) => OrderData;
    /**
     * Get order data.
     * @param orderAddress Order address.
     * @returns Order readable data.
     */
    getOrderData: (orderAddress: string) => Promise<OrderData>;
    /**
     * Derive treasurer address of an order.
     * @param orderAddress The order address.
     * @returns Treasurer address that holds the secure token treasuries of the order.
     */
    deriveTreasurerAddress: (orderAddress: string) => Promise<string>;
    /**
     * Make an order. This order will sell A to buy B.
     * @param opt.aTokenAddress The token (mint) A that is bided by the maker in the order.
     * @param opt.aTokenAmount The amount of token A that is deposited.
     * @param opt.bTokenAddress The token (mint) B that is asked by the maker in the order.
     * @param opt.bTokenAmount The amount of token B that is expected.
     * @param opt.startDate The start date.
     * @param opt.endDate The end date.
     * @param opt.feeOpt (Optional) Setup the maker & taker fee.
     * @param opt.whitelist (Optional) The whitelist. By default, set an array of [32;0] to desiable the feature.
     * @param opt.order (Optional) The order keypair. If it's not provided, a new one will be auto generated.
     * @param sendAndConfirm (Optional) Send and confirm the transaction immediately.
     * @returns { tx, txId, orderAddress }
     */
    makeOrder: ({ aTokenAddress, aTokenAmount, bTokenAddress, bTokenAmount, startDate, endDate, feeOpt, whitelist, order, }: {
        aTokenAddress: string;
        aTokenAmount: BN;
        bTokenAddress: string;
        bTokenAmount: BN;
        startDate: BN;
        endDate: BN;
        feeOpt?: FeeOptions | undefined;
        whitelist?: number[] | undefined;
        order?: web3.Keypair | undefined;
    }, sendAndConfirm?: boolean) => Promise<{
        tx: web3.Transaction;
        txId: string;
        orderAddress: string;
    }>;
    /**
     * Take an order
     * @param opt.orderAddress The order address.
     * @param sendAndConfirm (Optional) Send and confirm the transaction immediately.
     * @returns { txId }
     */
    takeOrder: ({ orderAddress, amount, proof, }: {
        orderAddress: string;
        amount: BN;
        proof: Buffer[] | Uint8Array[] | number[][];
    }, sendAndConfirm?: boolean) => Promise<{
        tx: web3.Transaction;
        txId: string;
    }>;
    /**
     * Pause an order
     * @param opt.orderAddress The order address.
     * @param sendAndConfirm (Optional) Send and confirm the transaction immediately.
     * @returns { txId }
     */
    pause: ({ orderAddress }: {
        orderAddress: string;
    }, sendAndConfirm?: boolean) => Promise<{
        tx: web3.Transaction;
        txId: string;
    }>;
    /**
     * Resume an order
     * @param opt.orderAddress The order address.
     * @param sendAndConfirm (Optional) Send and confirm the transaction immediately.
     * @returns { txId }
     */
    resume: ({ orderAddress }: {
        orderAddress: string;
    }, sendAndConfirm?: boolean) => Promise<{
        tx: web3.Transaction;
        txId: string;
    }>;
    /**
     * Stop an order
     * @param opt.orderAddress The order address.
     * @param sendAndConfirm (Optional) Send and confirm the transaction immediately.
     * @returns { txId }
     */
    stop: ({ orderAddress }: {
        orderAddress: string;
    }, sendAndConfirm?: boolean) => Promise<{
        tx: web3.Transaction;
        txId: string;
    }>;
}
export default Otc;
