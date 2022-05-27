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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.KinesisTransport = void 0;
const client_kinesis_1 = require("@aws-sdk/client-kinesis");
const winston_transport_1 = __importDefault(require("winston-transport"));
class KinesisTransport extends winston_transport_1.default {
    constructor(opts) {
        var _a, _b;
        super(opts);
        this.batchBuffer = [];
        this.streamName = opts.streamName;
        this.kinesis = new client_kinesis_1.KinesisClient((_a = opts.kinesisClientConfig) !== null && _a !== void 0 ? _a : {});
        this.batchCount = opts.batchCount || 10;
        this.batchInterval = opts.batchInterval || 5000;
        this.defaultPartitionKey =
            (_b = opts.defaultPartitionKey) !== null && _b !== void 0 ? _b : "default-partition-key";
        this.partitionKeySelector = opts.partitionKeySelector;
        this.batchTimeoutID = null;
    }
    log(info, callback) {
        if (this.batchCount > 1) {
            this._batchRequest(info);
        }
        else {
            this._request(info);
        }
        if (callback) {
            setImmediate(callback);
        }
    }
    _request(data) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield this.kinesis.send(new client_kinesis_1.PutRecordCommand({
                    Data: this.toBuffer(data),
                    StreamName: this.streamName,
                    PartitionKey: this.getPartitionKey(data),
                }));
                this.emit("logged", data);
            }
            catch (err) {
                this.emit("warn", err);
            }
        });
    }
    getPartitionKey(data) {
        return this.partitionKeySelector
            ? this.partitionKeySelector(data)
            : this.defaultPartitionKey;
    }
    toBuffer(data) {
        return new TextEncoder().encode(JSON.stringify(data));
    }
    _batchRequest(data) {
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
    _doBatchRequest() {
        return __awaiter(this, void 0, void 0, function* () {
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
                yield this.kinesis.send(new client_kinesis_1.PutRecordsCommand({
                    Records: records,
                    StreamName: this.streamName,
                }));
                this.emit("logged", batchBufferCopy);
            }
            catch (err) {
                this.emit("warn", err);
            }
        });
    }
}
exports.KinesisTransport = KinesisTransport;
