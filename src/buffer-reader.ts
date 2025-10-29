/**
 * BufferReader - Utility for reading binary transaction data
 *
 * Provides methods for reading various data types from a buffer
 * with automatic offset tracking.
 */

export class BufferReader {
  private buffer: Uint8Array;
  private offset: number;

  constructor(buffer: Uint8Array) {
    this.buffer = buffer;
    this.offset = 0;
  }

  /**
   * Get current offset position
   */
  getOffset(): number {
    return this.offset;
  }

  /**
   * Read unsigned 8-bit integer
   */
  readUInt8(): number {
    const value = new DataView(this.buffer.buffer, this.buffer.byteOffset).getUint8(
      this.offset
    );
    this.offset += 1;
    return value;
  }

  /**
   * Read signed 32-bit integer (little-endian)
   */
  readInt32(): number {
    const value = new DataView(this.buffer.buffer, this.buffer.byteOffset).getInt32(
      this.offset,
      true // little-endian
    );
    this.offset += 4;
    return value;
  }

  /**
   * Read unsigned 32-bit integer (little-endian)
   */
  readUInt32(): number {
    const value = new DataView(this.buffer.buffer, this.buffer.byteOffset).getUint32(
      this.offset,
      true // little-endian
    );
    this.offset += 4;
    return value;
  }

  /**
   * Read unsigned 64-bit integer (little-endian)
   * Returns as number (may lose precision for very large values)
   */
  readUInt64(): number {
    const low = new DataView(this.buffer.buffer, this.buffer.byteOffset).getUint32(
      this.offset,
      true
    );
    const high = new DataView(this.buffer.buffer, this.buffer.byteOffset).getUint32(
      this.offset + 4,
      true
    );
    this.offset += 8;

    // Combine high and low parts
    return high * 0x100000000 + low;
  }

  /**
   * Read fixed-size slice of bytes
   */
  readSlice(size: number): Uint8Array {
    const slice = this.buffer.slice(this.offset, this.offset + size);
    this.offset += size;
    return slice;
  }

  /**
   * Read variable-length integer (Bitcoin VarInt format)
   */
  readVarInt(): number {
    const first = this.readUInt8();

    // 8-bit
    if (first < 0xfd) {
      return first;
    }

    // 16-bit
    if (first === 0xfd) {
      const value = new DataView(this.buffer.buffer, this.buffer.byteOffset).getUint16(
        this.offset,
        true
      );
      this.offset += 2;
      return value;
    }

    // 32-bit
    if (first === 0xfe) {
      const value = new DataView(this.buffer.buffer, this.buffer.byteOffset).getUint32(
        this.offset,
        true
      );
      this.offset += 4;
      return value;
    }

    // 64-bit
    const lo = new DataView(this.buffer.buffer, this.buffer.byteOffset).getUint32(
      this.offset,
      true
    );
    this.offset += 4;
    const hi = new DataView(this.buffer.buffer, this.buffer.byteOffset).getUint32(
      this.offset,
      true
    );
    this.offset += 4;

    const number = hi * 0x100000000 + lo;

    // Check if number fits in 53-bit safe integer range
    if (number > Number.MAX_SAFE_INTEGER) {
      throw new Error('VarInt exceeds safe integer range');
    }

    return number;
  }

  /**
   * Read variable-length byte slice
   * First reads VarInt for length, then reads that many bytes
   */
  readVarSlice(): Uint8Array {
    const length = this.readVarInt();
    return this.readSlice(length);
  }

  /**
   * Get remaining bytes in buffer
   */
  remaining(): number {
    return this.buffer.length - this.offset;
  }

  /**
   * Check if there are bytes remaining
   */
  hasMore(): boolean {
    return this.offset < this.buffer.length;
  }
}
