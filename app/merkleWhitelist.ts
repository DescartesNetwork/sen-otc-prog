import { web3 } from '@project-serum/anchor'
import { keccak_256 as hash } from 'js-sha3'

export class MerkleWhitelist {
  public recipients: web3.PublicKey[]
  public leafs: Buffer[]

  constructor(recipients: web3.PublicKey[] = []) {
    this.recipients = recipients
    this.leafs = MerkleWhitelist.sort(
      ...this.recipients.map((recipient) => this.getLeaf(recipient)),
    )
  }

  static sort = (...args: Buffer[]): Buffer[] => {
    return [...args].sort((a, b) => {
      const i = Buffer.compare(a, b)
      if (i === 0) throw new Error('The receipients has a duplication')
      return i
    })
  }

  /**
   * Convert current merkle tree to buffer.
   * @returns Buffer.
   */
  toBuffer = () => {
    return Buffer.concat(
      this.recipients.map((recipient) => recipient.toBuffer()),
    )
  }

  /**
   * Build a merkle distributor instance from merkle tree data buffer.
   * @param buf Merkle tree data buffer.
   * @returns Merkle distributor instance.
   */
  static fromBuffer = (buf: Buffer): MerkleWhitelist => {
    if (buf.length % 32 !== 0) throw new Error('Invalid buffer')
    let re: web3.PublicKey[] = []
    for (let i = 0; i < buf.length; i = i + 32)
      re.push(new web3.PublicKey(buf.subarray(i, i + 32)))
    return new MerkleWhitelist(re)
  }

  private getLeaf = (data: web3.PublicKey): Buffer => {
    return Buffer.from(hash.digest(data.toBuffer()))
  }

  private getParent = (a: Buffer, b: Buffer): Buffer => {
    if (!a || !b) throw new Error('Invalid child')
    const seed = Buffer.concat(MerkleWhitelist.sort(a, b))
    return Buffer.from(hash.digest(seed))
  }

  private getSibling = (a: Buffer, layer: Buffer[]): Buffer | undefined => {
    const index = layer.findIndex((leaf) => leaf.compare(a) === 0)
    if (index === -1) throw new Error('Invalid child')
    return index % 2 === 1 ? layer[index - 1] : layer[index + 1]
  }

  private nextLayer = (bufs: Buffer[]) => {
    const _bufs = [...bufs]
    if (_bufs.length === 0) throw new Error('Invalid tree')
    if (_bufs.length === 1) return _bufs
    const carry = _bufs.length % 2 === 1 ? _bufs.pop() : undefined
    const re: Buffer[] = []
    for (let i = 0; i < _bufs.length; i = i + 2)
      re.push(this.getParent(_bufs[i], _bufs[i + 1]))
    return carry ? [...re, carry] : re
  }

  /**
   * Get the merkle root.
   * @returns Merkle root.
   */
  deriveMerkleRoot = (): Buffer => {
    let layer = this.leafs
    while (layer.length > 1) layer = this.nextLayer(layer)
    return layer[0]
  }

  /**
   * Get merkle proof.
   * @param data Receiptent data.
   * @returns Merkle proof.
   */
  deriveProof = (data: web3.PublicKey): Buffer[] => {
    let child = this.getLeaf(data)
    const proof: Buffer[] = []
    let layer = this.leafs
    while (layer.length > 1) {
      const sibling = this.getSibling(child, layer)
      if (sibling) {
        child = this.getParent(child, sibling)
        proof.push(sibling)
      }
      layer = this.nextLayer(layer)
    }
    return proof
  }

  /**
   * Verify a merkle proof.
   * @param proof Merkle proof.
   * @param data Receiptent data.
   * @returns Valid.
   */
  verifyProof = (proof: Buffer[], data: web3.PublicKey): boolean => {
    let child = this.getLeaf(data)
    for (const sibling of proof) child = this.getParent(child, sibling)
    return this.deriveMerkleRoot().compare(child) === 0
  }
}
