"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const anchor_1 = require("@project-serum/anchor");
const constant_1 = require("./constant");
const utils_1 = require("./utils");
class Otc {
    constructor(wallet, rpcEndpoint = constant_1.DEFAULT_RPC_ENDPOINT, programId = constant_1.DEFAULT_OTC_PROGRAM_ID) {
        /**
         * Listen changes on an event
         * @param eventName Event name
         * @param callback Event handler
         * @returns Listener id
         */
        this.addListener = (eventName, callback) => {
            return this.program.addEventListener(eventName, (data) => callback(data));
        };
        /**
         * Remove listener by its id
         * @param listenerId Listener id
         * @returns
         */
        this.removeListener = (listenerId) => __awaiter(this, void 0, void 0, function* () {
            try {
                yield this.program.removeEventListener(listenerId);
            }
            catch (er) {
                console.warn(er);
            }
        });
        /**
         * Get current Unix Timestamp of Solana Cluster
         * @returns Number (in seconds)
         */
        this.getCurrentUnixTimestamp = () => __awaiter(this, void 0, void 0, function* () {
            const { data } = (yield this.program.provider.connection.getAccountInfo(anchor_1.web3.SYSVAR_CLOCK_PUBKEY)) || {};
            if (!data)
                throw new Error('Cannot read clock data');
            const bn = new anchor_1.BN(data.subarray(32, 40), 'le');
            return bn.toNumber();
        });
        /**
         * Parse order buffer data.
         * @param data Dao buffer data.
         * @returns Dao readable data.
         */
        this.parseOrderData = (data) => {
            return this.program.coder.accounts.decode('order', data);
        };
        /**
         * Get order data.
         * @param orderAddress Order address.
         * @returns Order readable data.
         */
        this.getOrderData = (orderAddress) => __awaiter(this, void 0, void 0, function* () {
            return this.program.account.order.fetch(orderAddress);
        });
        /**
         * Derive treasurer address of an order.
         * @param orderAddress The order address.
         * @returns Treasurer address that holds the secure token treasuries of the order.
         */
        this.deriveTreasurerAddress = (orderAddress) => __awaiter(this, void 0, void 0, function* () {
            if (!(0, utils_1.isAddress)(orderAddress))
                throw new Error('Invalid order address');
            const [treasurerPublicKey] = yield anchor_1.web3.PublicKey.findProgramAddress([Buffer.from('treasurer'), new anchor_1.web3.PublicKey(orderAddress).toBuffer()], this.program.programId);
            return treasurerPublicKey.toBase58();
        });
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
        this.makeOrder = ({ aTokenAddress, aTokenAmount, bTokenAddress, bTokenAmount, startDate, endDate, feeOpt = (0, constant_1.FEE_OPTIONS)(), whitelist = constant_1.NULL_WHITELIST, order = anchor_1.web3.Keypair.generate(), }, sendAndConfirm = true) => __awaiter(this, void 0, void 0, function* () {
            if (!(0, utils_1.isAddress)(aTokenAddress) ||
                !(0, utils_1.isAddress)(bTokenAddress) ||
                aTokenAddress === bTokenAddress)
                throw new Error('Invalid token address');
            if (!aTokenAmount.gt(new anchor_1.BN(0)) || !bTokenAmount.gt(new anchor_1.BN(0)))
                throw new Error('Token amounts must be greater than zero');
            if (whitelist.length !== 32)
                throw new Error('Invalid whitelist path');
            const aTokenPublicKey = new anchor_1.web3.PublicKey(aTokenAddress);
            const srcAAccountPublicKey = yield anchor_1.utils.token.associatedAddress({
                mint: aTokenPublicKey,
                owner: this._provider.wallet.publicKey,
            });
            const bTokenPublicKey = new anchor_1.web3.PublicKey(bTokenAddress);
            const treasurerAddress = yield this.deriveTreasurerAddress(order.publicKey.toBase58());
            const treasurerPublicKey = new anchor_1.web3.PublicKey(treasurerAddress);
            const treasuryPublicKey = yield anchor_1.utils.token.associatedAddress({
                mint: aTokenPublicKey,
                owner: treasurerPublicKey,
            });
            const builder = this.program.methods
                .makeOrder(aTokenAmount, bTokenAmount, feeOpt.makerFee, feeOpt.takerFee, startDate, endDate, whitelist)
                .accounts({
                authority: this._provider.wallet.publicKey,
                order: order.publicKey,
                aToken: aTokenPublicKey,
                bToken: bTokenPublicKey,
                srcAAccount: srcAAccountPublicKey,
                treasury: treasuryPublicKey,
                treasurer: treasurerPublicKey,
                taxman: new anchor_1.web3.PublicKey(feeOpt.taxmanAddress),
                systemProgram: anchor_1.web3.SystemProgram.programId,
                tokenProgram: anchor_1.utils.token.TOKEN_PROGRAM_ID,
                associatedTokenProgram: anchor_1.utils.token.ASSOCIATED_PROGRAM_ID,
                rent: anchor_1.web3.SYSVAR_RENT_PUBKEY,
            })
                .signers([order]);
            const tx = yield builder.transaction();
            const txId = sendAndConfirm
                ? yield builder.rpc({ commitment: 'confirmed' })
                : '';
            return { tx, txId, orderAddress: order.publicKey.toBase58() };
        });
        /**
         * Take an order
         * @param opt.orderAddress The order address.
         * @param sendAndConfirm (Optional) Send and confirm the transaction immediately.
         * @returns { txId }
         */
        this.takeOrder = ({ orderAddress, amount, proof = [], }, sendAndConfirm = true) => __awaiter(this, void 0, void 0, function* () {
            if (!(0, utils_1.isAddress)(orderAddress))
                throw new Error('Invalid order address');
            const order = new anchor_1.web3.PublicKey(orderAddress);
            const { authority, aToken, bToken, taxman } = yield this.getOrderData(orderAddress);
            const srcBAccount = yield anchor_1.utils.token.associatedAddress({
                mint: bToken,
                owner: this._provider.wallet.publicKey,
            });
            const dstBAccount = yield anchor_1.utils.token.associatedAddress({
                mint: bToken,
                owner: authority,
            });
            const dstAAccount = yield anchor_1.utils.token.associatedAddress({
                mint: aToken,
                owner: this._provider.wallet.publicKey,
            });
            const treasurerAddress = yield this.deriveTreasurerAddress(orderAddress);
            const treasurer = new anchor_1.web3.PublicKey(treasurerAddress);
            const treasury = yield anchor_1.utils.token.associatedAddress({
                mint: aToken,
                owner: treasurer,
            });
            const makerFeeAccount = yield anchor_1.utils.token.associatedAddress({
                mint: bToken,
                owner: taxman,
            });
            const takerFeeAccount = yield anchor_1.utils.token.associatedAddress({
                mint: aToken,
                owner: taxman,
            });
            const builder = yield this.program.methods
                .takeOrder(amount, proof)
                .accounts({
                taker: this._provider.wallet.publicKey,
                authority,
                order,
                aToken,
                bToken,
                srcBAccount,
                dstBAccount,
                dstAAccount,
                treasurer,
                treasury,
                taxman,
                makerFeeAccount,
                takerFeeAccount,
                systemProgram: anchor_1.web3.SystemProgram.programId,
                tokenProgram: anchor_1.utils.token.TOKEN_PROGRAM_ID,
                associatedTokenProgram: anchor_1.utils.token.ASSOCIATED_PROGRAM_ID,
                rent: anchor_1.web3.SYSVAR_RENT_PUBKEY,
            });
            const tx = yield builder.transaction();
            const txId = sendAndConfirm
                ? yield builder.rpc({ commitment: 'confirmed' })
                : '';
            return { tx, txId };
        });
        /**
         * Pause an order
         * @param opt.orderAddress The order address.
         * @param sendAndConfirm (Optional) Send and confirm the transaction immediately.
         * @returns { txId }
         */
        this.pause = ({ orderAddress }, sendAndConfirm = true) => __awaiter(this, void 0, void 0, function* () {
            if (!(0, utils_1.isAddress)(orderAddress))
                throw new Error('Invalid order address');
            const orderPublicKey = new anchor_1.web3.PublicKey(orderAddress);
            const builder = yield this.program.methods.pause().accounts({
                authority: this._provider.wallet.publicKey,
                order: orderPublicKey,
            });
            const tx = yield builder.transaction();
            const txId = sendAndConfirm
                ? yield builder.rpc({ commitment: 'confirmed' })
                : '';
            return { tx, txId };
        });
        /**
         * Resume an order
         * @param opt.orderAddress The order address.
         * @param sendAndConfirm (Optional) Send and confirm the transaction immediately.
         * @returns { txId }
         */
        this.resume = ({ orderAddress }, sendAndConfirm = true) => __awaiter(this, void 0, void 0, function* () {
            if (!(0, utils_1.isAddress)(orderAddress))
                throw new Error('Invalid order address');
            const orderPublicKey = new anchor_1.web3.PublicKey(orderAddress);
            const builder = yield this.program.methods.resume().accounts({
                authority: this._provider.wallet.publicKey,
                order: orderPublicKey,
            });
            const tx = yield builder.transaction();
            const txId = sendAndConfirm
                ? yield builder.rpc({ commitment: 'confirmed' })
                : '';
            return { tx, txId };
        });
        /**
         * Stop an order
         * @param opt.orderAddress The order address.
         * @param sendAndConfirm (Optional) Send and confirm the transaction immediately.
         * @returns { txId }
         */
        this.stop = ({ orderAddress }, sendAndConfirm = true) => __awaiter(this, void 0, void 0, function* () {
            if (!(0, utils_1.isAddress)(orderAddress))
                throw new Error('Invalid order address');
            const orderPublicKey = new anchor_1.web3.PublicKey(orderAddress);
            const { aToken } = yield this.getOrderData(orderAddress);
            const dstAAccountPublicKey = yield anchor_1.utils.token.associatedAddress({
                mint: aToken,
                owner: this._provider.wallet.publicKey,
            });
            const treasurerAddress = yield this.deriveTreasurerAddress(orderAddress);
            const treasurerPublicKey = new anchor_1.web3.PublicKey(treasurerAddress);
            const treasury = yield anchor_1.utils.token.associatedAddress({
                mint: aToken,
                owner: treasurerPublicKey,
            });
            const builder = yield this.program.methods.stop().accounts({
                authority: this._provider.wallet.publicKey,
                order: orderPublicKey,
                aToken,
                dstAAccount: dstAAccountPublicKey,
                treasurer: treasurerPublicKey,
                treasury,
                systemProgram: anchor_1.web3.SystemProgram.programId,
                tokenProgram: anchor_1.utils.token.TOKEN_PROGRAM_ID,
                associatedTokenProgram: anchor_1.utils.token.ASSOCIATED_PROGRAM_ID,
                rent: anchor_1.web3.SYSVAR_RENT_PUBKEY,
            });
            const tx = yield builder.transaction();
            const txId = sendAndConfirm
                ? yield builder.rpc({ commitment: 'confirmed' })
                : '';
            return { tx, txId };
        });
        if (!(0, utils_1.isAddress)(programId))
            throw new Error('Invalid program id');
        // Private
        this._connection = new anchor_1.web3.Connection(rpcEndpoint, 'confirmed');
        this._provider = new anchor_1.AnchorProvider(this._connection, wallet, {
            skipPreflight: true,
            commitment: 'confirmed',
        });
        // Public
        this.program = new anchor_1.Program(constant_1.DEFAULT_OTC_IDL, programId, this._provider);
    }
    /**
     * Get list of event names
     */
    get events() {
        return this.program.idl.events.map(({ name }) => name);
    }
}
exports.default = Otc;
