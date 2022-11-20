"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MerkleWhitelist = void 0;
const anchor_1 = require("@project-serum/anchor");
const js_sha3_1 = require("js-sha3");
class MerkleWhitelist {
    constructor(recipients = []) {
        /**
         * Convert current merkle tree to buffer.
         * @returns Buffer.
         */
        this.toBuffer = () => {
            return Buffer.concat(this.recipients.map((recipient) => recipient.toBuffer()));
        };
        this.getLeaf = (data) => {
            return Buffer.from(js_sha3_1.keccak_256.digest(data.toBuffer()));
        };
        this.getParent = (a, b) => {
            if (!a || !b)
                throw new Error('Invalid child');
            const seed = Buffer.concat(MerkleWhitelist.sort(a, b));
            return Buffer.from(js_sha3_1.keccak_256.digest(seed));
        };
        this.getSibling = (a, layer) => {
            const index = layer.findIndex((leaf) => leaf.compare(a) === 0);
            if (index === -1)
                throw new Error('Invalid child');
            return index % 2 === 1 ? layer[index - 1] : layer[index + 1];
        };
        this.nextLayer = (bufs) => {
            const _bufs = [...bufs];
            if (_bufs.length === 0)
                throw new Error('Invalid tree');
            if (_bufs.length === 1)
                return _bufs;
            const carry = _bufs.length % 2 === 1 ? _bufs.pop() : undefined;
            const re = [];
            for (let i = 0; i < _bufs.length; i = i + 2)
                re.push(this.getParent(_bufs[i], _bufs[i + 1]));
            return carry ? [...re, carry] : re;
        };
        /**
         * Get the merkle root.
         * @returns Merkle root.
         */
        this.deriveMerkleRoot = () => {
            let layer = this.leafs;
            while (layer.length > 1)
                layer = this.nextLayer(layer);
            return layer[0];
        };
        /**
         * Get merkle proof.
         * @param data Receiptent data.
         * @returns Merkle proof.
         */
        this.deriveProof = (data) => {
            let child = this.getLeaf(data);
            const proof = [];
            let layer = this.leafs;
            while (layer.length > 1) {
                const sibling = this.getSibling(child, layer);
                if (sibling) {
                    child = this.getParent(child, sibling);
                    proof.push(sibling);
                }
                layer = this.nextLayer(layer);
            }
            return proof;
        };
        /**
         * Verify a merkle proof.
         * @param proof Merkle proof.
         * @param data Receiptent data.
         * @returns Valid.
         */
        this.verifyProof = (proof, data) => {
            let child = this.getLeaf(data);
            for (const sibling of proof)
                child = this.getParent(child, sibling);
            return this.deriveMerkleRoot().compare(child) === 0;
        };
        this.recipients = recipients;
        this.leafs = MerkleWhitelist.sort(...this.recipients.map((recipient) => this.getLeaf(recipient)));
    }
}
exports.MerkleWhitelist = MerkleWhitelist;
MerkleWhitelist.sort = (...args) => {
    return [...args].sort((a, b) => {
        const i = Buffer.compare(a, b);
        if (i === 0)
            throw new Error('The receipients has a duplication');
        return i;
    });
};
/**
 * Build a merkle distributor instance from merkle tree data buffer.
 * @param buf Merkle tree data buffer.
 * @returns Merkle distributor instance.
 */
MerkleWhitelist.fromBuffer = (buf) => {
    if (buf.length % 32 !== 0)
        throw new Error('Invalid buffer');
    let re = [];
    for (let i = 0; i < buf.length; i = i + 32)
        re.push(new anchor_1.web3.PublicKey(buf.subarray(i, i + 32)));
    return new MerkleWhitelist(re);
};
