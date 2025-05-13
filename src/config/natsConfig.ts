import { connect, StringCodec } from 'nats';

const natsConfig = {
    servers: ['nats://localhost:4222'],
    options: {
        reconnect: true,
        maxReconnectAttempts: 10,
        reconnectTimeWait: 2000,
        timeout: 10000,
        // Add any other NATS connection options here
    },
};

export default natsConfig;