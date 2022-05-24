import {
  KinesisClient,
  KinesisClientConfig,
  PutRecordsCommand,
} from "@aws-sdk/client-kinesis";
import Transport from "winston-transport";

export interface KinesisTransportOptions
  extends Transport.TransportStreamOptions {
  streamName: string;
  kinesisClientConfig?: KinesisClientConfig;
  batchCount?: number;
  batchInterval?: number;
}

export class KinesisTransport extends Transport {
  streamName: string;
  batchCount: number;
  batchInterval: number;

  batchTimeoutID: any;
  batchCallback: (err: any) => void;

  batchBuffer: any[] = [];
  kinesis: KinesisClient;

  constructor(opts: KinesisTransportOptions) {
    super(opts);
    this.streamName = opts.streamName;
    this.kinesis = new KinesisClient(opts.kinesisClientConfig ?? {});
    this.batchCount = opts.batchCount || 10;
    this.batchInterval = opts.batchInterval || 5000;

    this.batchTimeoutID = -1;
  }

  log(info, callback) {
    this._request(info);

    if (callback) {
      setImmediate(callback);
    }
  }

  private _request(data) {
    this.batchBuffer.push(data);
    if (this.batchBuffer.length === 1) {
      // First message stored, it's time to start the timeout!
      const me = this;
      this.batchTimeoutID = setTimeout(function () {
        // timeout is reached, send all messages to endpoint
        me.batchTimeoutID = -1;
        me._doBatchRequest();
      }, this.batchInterval);
    }
    if (this.batchBuffer.length === this.batchCount) {
      // max batch count is reached, send all messages to endpoint
      this._doBatchRequest();
    }
  }

  private async _doBatchRequest() {
    if (this.batchTimeoutID > 0) {
      clearTimeout(this.batchTimeoutID);
      this.batchTimeoutID = -1;
    }
    const batchBufferCopy = this.batchBuffer.slice();
    this.batchBuffer = [];

    try {
      const records = batchBufferCopy.map((e) => ({
        Data: new TextEncoder().encode(JSON.stringify(e)),
        PartitionKey: `${e.env}_${e.log_type}`,
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
