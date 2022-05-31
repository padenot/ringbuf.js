/** The base RingBuffer class
 *
 * A Single Producer - Single Consumer thread-safe wait-free ring buffer.
 *
 * The producer and the consumer can be on separate threads, but cannot change roles,
 * except with external synchronization.
 */
export class RingBuffer {
  /** Allocate the SharedArrayBuffer for a RingBuffer, based on the type and
   * capacity required
   * @param {number} capacity The number of elements the ring buffer will be
   * able to hold.
   * @param {TypedArray} type A typed array constructor, the type that this ring
   * buffer will hold.
   * @return {SharedArrayBuffer} A SharedArrayBuffer of the right size.
   * @static
   */
  static getStorageForCapacity(capacity, type) {
    if (!type.BYTES_PER_ELEMENT) {
      throw TypeError("Pass in a ArrayBuffer subclass");
    }
    const bytes = 8 + (capacity + 1) * type.BYTES_PER_ELEMENT;
    return new SharedArrayBuffer(bytes);
  }
  /**
   * @constructor
   * @param {SharedArrayBuffer} sab A SharedArrayBuffer obtained by calling
   * {@link RingBuffer.getStorageFromCapacity}.
   * @param {TypedArray} type A typed array constructor, the type that this ring
   * buffer will hold.
   */
  constructor(sab, type) {
    if (type.BYTES_PER_ELEMENT === undefined) {
      throw TypeError("Pass a concrete typed array class as second argument");
    }

    // Maximum usable size is 1<<32 - type.BYTES_PER_ELEMENT bytes in the ring
    // buffer for this version, easily changeable.
    // -4 for the write ptr (uint32_t offsets)
    // -4 for the read ptr (uint32_t offsets)
    // capacity counts the empty slot to distinguish between full and empty.
    this._type = type;
    this._capacity = (sab.byteLength - 8) / type.BYTES_PER_ELEMENT;
    this.buf = sab;
    this.write_ptr = new Uint32Array(this.buf, 0, 1);
    this.read_ptr = new Uint32Array(this.buf, 4, 1);
    this.storage = new type(this.buf, 8, this._capacity);
  }
  /**
   * @return the type of the underlying ArrayBuffer for this RingBuffer. This
   * allows implementing crude type checking.
   */
  type() {
    return this._type.name;
  }

  /**
   * Push elements to the ring buffer.
   * @param {TypedArray} elements A typed array of the same type as passed in the ctor, to be written to the queue.
   * @param {Number} length If passed, the maximum number of elements to push.
   * If not passed, all elements in the input array are pushed.
   * @param {Number} offset If passed, a starting index in elements from which
   * the elements are read. If not passed, elements are read from index 0.
   * @return the number of elements written to the queue.
   */
  push(elements, length, offset = 0) {
    const rd = Atomics.load(this.read_ptr, 0);
    const wr = Atomics.load(this.write_ptr, 0);

    if ((wr + 1) % this._storage_capacity() === rd) {
      // full
      return 0;
    }

    const len = length !== undefined ? length : elements.length;

    const to_write = Math.min(this._available_write(rd, wr), len);
    const first_part = Math.min(this._storage_capacity() - wr, to_write);
    const second_part = to_write - first_part;

    this._copy(elements, offset, this.storage, wr, first_part);
    this._copy(elements, offset + first_part, this.storage, 0, second_part);

    // publish the enqueued data to the other side
    Atomics.store(
      this.write_ptr,
      0,
      (wr + to_write) % this._storage_capacity()
    );

    return to_write;
  }

  /**
   * Write bytes to the ring buffer using callbacks. This create wrapper
   * objects and can GC, so it's best to no use this variant from a real-time
   * thread such as an AudioWorklerProcessor `process` method.
   * The callback is passed two typed arrays of the same type, to be filled.
   * This allows skipping copies if the API that produces the data writes is
   * passed arrays to write to, such as `AudioData.copyTo`.
   * @param {number} amount The maximum number of elements to write to the ring
   * buffer. If amount is more than the number of slots available for writing,
   * then the number of slots available for writing will be made available: no
   * overwriting of elements can happen.
   * @param {Function} cb A callback with two parameters, that are two typed
   * array of the correct type, in which the data need to be copied. If the
   * callback doesn't return anything, it is assumed all the elements
   * have been written to. Otherwise, it is assumed that the returned number is
   * the number of elements that have been written to, and those elements have
   * been written started at the beginning of the requested buffer space.
   *
   * @return The number of elements written to the queue.
   */
  writeCallback(amount, cb) {
    const rd = Atomics.load(this.read_ptr, 0);
    const wr = Atomics.load(this.write_ptr, 0);

    if ((wr + 1) % this._storage_capacity() === rd) {
      // full
      return 0;
    }

    const to_write = Math.min(this._available_write(rd, wr), amount);
    const first_part = Math.min(this._storage_capacity() - wr, to_write);
    const second_part = to_write - first_part;

    // This part will cause GC: don't use in the real time thread.
    const first_part_buf = new this._type(
      this.storage.buffer,
      8 + wr * this.storage.BYTES_PER_ELEMENT,
      first_part
    );
    const second_part_buf = new this._type(
      this.storage.buffer,
      8 + 0,
      second_part
    );

    const written = cb(first_part_buf, second_part_buf) || to_write;

    // publish the enqueued data to the other side
    Atomics.store(this.write_ptr, 0, (wr + written) % this._storage_capacity());

    return written;
  }

  /**
   * Write bytes to the ring buffer using a callback.
   *
   * This allows skipping copies if the API that produces the data writes is
   * passed arrays to write to, such as `AudioData.copyTo`.
   *
   * @param {number} amount The maximum number of elements to write to the ring
   * buffer. If amount is more than the number of slots available for writing,
   * then the number of slots available for writing will be made available: no
   * overwriting of elements can happen.
   * @param {Function} cb A callback with five parameters:
   *
   * (1) The internal storage of the ring buffer as a typed array
   * (2) An offset to start writing from
   * (3) A number of elements to write at this offset
   * (4) Another offset to start writing from
   * (5) A number of elements to write at this second offset
   *
   * If the callback doesn't return anything, it is assumed all the elements
   * have been written to. Otherwise, it is assumed that the returned number is
   * the number of elements that have been written to, and those elements have
   * been written started at the beginning of the requested buffer space.
   * @return The number of elements written to the queue.
   */
  writeCallbackWithOffset(amount, cb) {
    const rd = Atomics.load(this.read_ptr, 0);
    const wr = Atomics.load(this.write_ptr, 0);

    if ((wr + 1) % this._storage_capacity() === rd) {
      // full
      return 0;
    }

    const to_write = Math.min(this._available_write(rd, wr), amount);
    const first_part = Math.min(this._storage_capacity() - wr, to_write);
    const second_part = to_write - first_part;

    const written =
      cb(this.storage, wr, first_part, 0, second_part) || to_write;

    // publish the enqueued data to the other side
    Atomics.store(this.write_ptr, 0, (wr + written) % this._storage_capacity());

    return written;
  }

  /**
   * Read up to `elements.length` elements from the ring buffer. `elements` is a typed
   * array of the same type as passed in the ctor.
   * Returns the number of elements read from the queue, they are placed at the
   * beginning of the array passed as parameter.
   * @param {TypedArray} elements An array in which the elements read from the
   * queue will be written, starting at the beginning of the array.
   * @param {Number} length If passed, the maximum number of elements to pop. If
   * not passed, up to elements.length are popped.
   * @param {Number} offset If passed, an index in elements in which the data is
   * written to. `elements.length - offset` must be greater or equal to
   * `length`.
   * @return The number of elements read from the queue.
   */
  pop(elements, length, offset = 0) {
    const rd = Atomics.load(this.read_ptr, 0);
    const wr = Atomics.load(this.write_ptr, 0);

    if (wr === rd) {
      return 0;
    }

    const len = length !== undefined ? length : elements.length;
    const to_read = Math.min(this._available_read(rd, wr), len);

    const first_part = Math.min(this._storage_capacity() - rd, to_read);
    const second_part = to_read - first_part;

    this._copy(this.storage, rd, elements, offset, first_part);
    this._copy(this.storage, 0, elements, offset + first_part, second_part);

    Atomics.store(this.read_ptr, 0, (rd + to_read) % this._storage_capacity());

    return to_read;
  }

  /**
   * @return True if the ring buffer is empty false otherwise. This can be late
   * on the reader side: it can return true even if something has just been
   * pushed.
   */
  empty() {
    const rd = Atomics.load(this.read_ptr, 0);
    const wr = Atomics.load(this.write_ptr, 0);

    return wr === rd;
  }

  /**
   * @return True if the ring buffer is full, false otherwise. This can be late
   * on the write side: it can return true when something has just been popped.
   */
  full() {
    const rd = Atomics.load(this.read_ptr, 0);
    const wr = Atomics.load(this.write_ptr, 0);

    return (wr + 1) % this._storage_capacity() === rd;
  }

  /**
   * @return The usable capacity for the ring buffer: the number of elements
   * that can be stored.
   */
  capacity() {
    return this._capacity - 1;
  }

  /**
   * @return The number of elements available for reading. This can be late, and
   * report less elements that is actually in the queue, when something has just
   * been enqueued.
   */
  availableRead() {
    const rd = Atomics.load(this.read_ptr, 0);
    const wr = Atomics.load(this.write_ptr, 0);
    return this._available_read(rd, wr);
  }
  /**
   * Compatibility alias for availableRead().
   *
   * @return The number of elements available for reading. This can be late, and
   * report less elements that is actually in the queue, when something has just
   * been enqueued.
   *
   * @deprecated
   */
  available_read() {
    return this.availableRead();
  }

  /**
   * @return The number of elements available for writing. This can be late, and
   * report less elements that is actually available for writing, when something
   * has just been dequeued.
   */
  availableWrite() {
    const rd = Atomics.load(this.read_ptr, 0);
    const wr = Atomics.load(this.write_ptr, 0);
    return this._available_write(rd, wr);
  }

  /**
   * Compatibility alias for availableWrite.
   *
   * @return The number of elements available for writing. This can be late, and
   * report less elements that is actually available for writing, when something
   * has just been dequeued.
   *
   * @deprecated
   */
  available_write() {
    return this.availableWrite();
  }

  // private methods //

  /**
   * @return Number of elements available for reading, given a read and write
   * pointer.
   * @private
   */
  _available_read(rd, wr) {
    return (wr + this._storage_capacity() - rd) % this._storage_capacity();
  }

  /**
   * @return Number of elements available from writing, given a read and write
   * pointer.
   * @private
   */
  _available_write(rd, wr) {
    return this.capacity() - this._available_read(rd, wr);
  }

  /**
   * @return The size of the storage for elements not accounting the space for
   * the index, counting the empty slot.
   * @private
   */
  _storage_capacity() {
    return this._capacity;
  }

  /**
   * Copy `size` elements from `input`, starting at offset `offset_input`, to
   * `output`, starting at offset `offset_output`.
   * @param {TypedArray} input The array to copy from
   * @param {Number} offset_input The index at which to start the copy
   * @param {TypedArray} output The array to copy to
   * @param {Number} offset_output The index at which to start copying the elements to
   * @param {Number} size The number of elements to copy
   * @private
   */
  _copy(input, offset_input, output, offset_output, size) {
    for (let i = 0; i < size; i++) {
      output[offset_output + i] = input[offset_input + i];
    }
  }
}
