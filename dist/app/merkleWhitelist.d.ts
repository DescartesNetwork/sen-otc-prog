/// <reference types="node" />
import { web3 } from '@project-serum/anchor';
export declare class MerkleWhitelist {
    recipients: web3.PublicKey[];
    leafs: Buffer[];
    constructor(recipients?: web3.PublicKey[]);
    static sort: (...args: Buffer[]) => Buffer[];
    /**
     * Convert current merkle tree to buffer.
     * @returns Buffer.
     */
    toBuffer: () => Buffer;
    /**
     * Build a merkle distributor instance from merkle tree data buffer.
     * @param buf Merkle tree data buffer.
     * @returns Merkle distributor instance.
     */
    static fromBuffer: (buf: Buffer) => MerkleWhitelist;
    private getLeaf;
    private getParent;
    private getSibling;
    private nextLayer;
    /**
     * Get the merkle root.
     * @returns Merkle root.
     */
    deriveMerkleRoot: () => Buffer;
    /**
     * Get merkle proof.
     * @param data Receiptent data.
     * @returns Merkle proof.
     */
    deriveProof: (data: web3.PublicKey) => Buffer[];
    /**
     * Verify a merkle proof.
     * @param proof Merkle proof.
     * @param data Receiptent data.
     * @returns Valid.
     */
    verifyProof: (proof: Buffer[], data: web3.PublicKey) => boolean;
}
