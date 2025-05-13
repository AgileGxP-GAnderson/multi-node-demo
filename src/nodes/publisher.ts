import { connect, StringCodec } from 'nats';
import { v4 as uuidv4 } from 'uuid';

const sc = StringCodec();

async function startPublisher() {
    const nc = await connect({ servers: 'nats://localhost:4222' });
    console.log('Publisher connected');

    setInterval(() => {
        const now = new Date();
        const minutes = now.getMinutes();
        const seconds = now.getSeconds();
        const message = {
            id: uuidv4(),
            payload: `PING! - ${minutes}:${seconds.toString().padStart(2, '0')}`,
            timestamp: Date.now()
        };
        nc.publish('raw.messages', sc.encode(JSON.stringify(message)));
        console.log(`Published: ${JSON.stringify(message)}`);
    }, 1000);

    await nc.closed();
}

startPublisher().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});