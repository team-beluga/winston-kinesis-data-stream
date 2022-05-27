import {
  KinesisClient,
  KinesisClientConfig,
  PutRecordCommand,
  PutRecordsCommand,
} from "@aws-sdk/client-kinesis";
import Transport from "winston-transport";

export interface KinesisTransportOptions
  extends Transport.TransportStreamOptions {
  streamName: string;
  kinesisClientConfig?: KinesisClientConfig;
  batchCount?: number;
  batchInterval?: number;
  defaultPartitionKey?: string;
  partitionKeySelector?: (data) => string;
}

export class KinesisTransport extends Transport {
  streamName: string;
  defaultPartitionKey: string;
  batchCount: number;
  batchInterval: number;
  partitionKeySelector: (data) => string;

  batchTimeoutID: ReturnType<typeof setTimeout>;
  batchCallback: (err: object) => void;

  batchBuffer: object[] = [];
  kinesis: KinesisClient;

  constructor(opts: KinesisTransportOptions) {
    super(opts);
    this.streamName = opts.streamName;
    this.kinesis = new KinesisClient(opts.kinesisClientConfig ?? {});
    this.batchCount = opts.batchCount || 10;
    this.batchInterval = opts.batchInterval || 5000;
    this.defaultPartitionKey =
      opts.defaultPartitionKey ?? "default-partition-key";
    this.partitionKeySelector = opts.partitionKeySelector;

    this.batchTimeoutID = null;
  }

  log(info, callback) {
    if (this.batchCount > 1) {
      this._batchRequest(info);
    } else {
      this._request(info);
    }

    if (callback) {
      setImmediate(callback);
    }
  }

  private async _request(data) {
    try {
      await this.kinesis.send(
        new PutRecordCommand({
          Data: this.toBuffer(data),
          StreamName: this.streamName,
          PartitionKey: this.getPartitionKey(data),
        })
      );
      this.emit("logged", data);
    } catch (err) {
      this.emit("warn", err);
    }
  }

  private getPartitionKey(data) {
    return this.partitionKeySelector
      ? this.partitionKeySelector(data)
      : this.defaultPartitionKey;
  }

  private toBuffer(data) {
    return new TextEncoder().encode(JSON.stringify(data));
  }

  private _batchRequest(data) {
    this.batchBuffer.push(data);
    if (this.batchBuffer.length === 1) {
      // First message stored, it's time to start the timeout!
      this.batchTimeoutID = setTimeout(() => {
        // timeout is reached, send all messages to endpoint
        this._doBatchRequest();
      }, this.batchInterval);
    }
    if (this.batchBuffer.length === this.batchCount) {
      // max batch count is reached, send all messages to endpoint
      this._doBatchRequest();
    }
  }

  private async _doBatchRequest() {
    if (this.batchTimeoutID !== null) {
      clearTimeout(this.batchTimeoutID);
      this.batchTimeoutID = null;
    }
    const batchBufferCopy = this.batchBuffer.slice();
    this.batchBuffer = [];

    try {
      const records = batchBufferCopy.map((e) => ({
        Data: new TextEncoder().encode(JSON.stringify(e)),
        PartitionKey: this.partitionKeySelector
          ? this.partitionKeySelector(e)
          : this.defaultPartitionKey,
      }));
      await this.kinesis.send(
        new PutRecordsCommand({
          Records: records,
          StreamName: this.streamName,
        })
      );
      this.emit("logged", batchBufferCopy);
    } catch (err) {
      this.emit("warn", err);
    }
  }
}
