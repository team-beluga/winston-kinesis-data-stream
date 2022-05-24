# winston-kinesis-data-stream

AWS Kinesis Data Stream Transport for [winston](https://github.com/winstonjs/winston)

## Installation (WIP)

Will be registered on npm soon.

## Usage

```ts
import { createLogger } from "winston"
import { KinesisTransport } from "winston-kinesis-data-stream"

const logger = createLogger({
  transports: [
    new KinesisTransport({
      streamName: "kinesis_data_stream_name",
      kinesisClientConfig: {
        region: "us-east-1",
        ... // AWS KinesisClientConfig
      },
      batchCount: 100,
      batchInterval: 5000,
    })
  ]
})

// log as it is in winston
logger.info("Hello Kinesis!")
```

## Options

- `streamName (string) - Required` The name of the Kinesis Data Stream.
- `kinesisClientConfig (object) - optional/suggested`

## References

Referenced [winston-firehose](https://github.com/pkallos/winston-firehose), batch putRecords inspired by [winston core http transport](https://github.com/winstonjs/winston/blob/master/lib/winston/transports/http.js)
