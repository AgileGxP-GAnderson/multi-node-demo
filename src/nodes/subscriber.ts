import { connect, StringCodec } from 'nats';

const sc = StringCodec();

async function startSubscriber() {
    const nc = await connect({ servers: 'nats://localhost:4222' });
    console.log('Subscriber connected');

    const sub = nc.subscribe('translated.messages');

    for await (const msg of sub) {
        try {
            const message = JSON.parse(sc.decode(msg.data));
            console.log(`Subscriber processed: ${message.payload}`);
            // Your logic here
        } catch (err) {
            console.error('Subscriber error:', err);
        }
    }

    await nc.closed();
}

startSubscriber().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});