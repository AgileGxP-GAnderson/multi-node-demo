import { connect, StringCodec } from 'nats';

const sc = StringCodec();

async function startSniffer() {
    const nc = await connect({ servers: 'nats://localhost:4222' });
    const subjects = ['raw.messages', 'translated.messages', 'health.status', 'leader.election'];
    console.log('NATS sniffer connected. Listening on subjects:', subjects.join(', '));
    for (const subject of subjects) {
        const sub = nc.subscribe(subject);
        (async () => {
            for await (const msg of sub) {
                try {
                    const decoded = sc.decode(msg.data);
                    let parsed;
                    try {
                        parsed = JSON.parse(decoded);
                    } catch {
                        parsed = decoded;
                    }
                    console.log(`[${subject}]`, parsed);
                } catch (err) {
                    console.error(`[${subject}] Error decoding message:`, err);
                }
            }
        })();
    }
}

startSniffer().catch(err => {
    console.error('Sniffer error:', err);
    process.exit(1);
});
