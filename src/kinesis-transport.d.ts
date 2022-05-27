import { KinesisClient, KinesisClientConfig } from "@aws-sdk/client-kinesis";
import Transport from "winston-transport";
export interface KinesisTransportOptions extends Transport.TransportStreamOptions {
    streamName: string;
    kinesisClientConfig?: KinesisClientConfig;
    batchCount?: number;
    batchInterval?: number;
    defaultPartitionKey?: string;
    partitionKeySelector?: (data: any) => string;
}
export declare class KinesisTransport extends Transport {
    streamName: string;
    defaultPartitionKey: string;
    batchCount: number;
    batchInterval: number;
    partitionKeySelector: (data: any) => string;
    batchTimeoutID: ReturnType<typeof setTimeout>;
    batchCallback: (err: object) => void;
    batchBuffer: object[];
    kinesis: KinesisClient;
    constructor(opts: KinesisTransportOptions);
    log(info: any, callback: any): void;
    private _request;
    private getPartitionKey;
    private toBuffer;
    private _batchRequest;
    private _doBatchRequest;
}
