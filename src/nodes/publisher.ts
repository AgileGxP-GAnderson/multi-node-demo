import { connect, StringCodec } from 'nats';
import { v4 as uuidv4 } from 'uuid';

const sc = StringCodec();

async function sendMessage(payload: string) {
    const nc = await connect({ servers: 'nats://localhost:4222' });
    console.log('Publisher connected');

    const message = { id: uuidv4(), payload };
    nc.publish('raw.messages', sc.encode(JSON.stringify(message)));
    console.log(`Published: ${JSON.stringify(message)}`);

    await nc.drain();
}

sendMessage('Hello, NATS!').catch(err => {
    console.error('Error:', err);
    process.exit(1);
});