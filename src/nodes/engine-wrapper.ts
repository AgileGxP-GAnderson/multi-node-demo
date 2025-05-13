import { connect, StringCodec, Subscription } from 'nats';

const sc = StringCodec();

async function startTranslator(translatorId: string) {
    const nc = await connect({ servers: 'nats://localhost:4222' });
    console.log(`Translator ${translatorId} connected`);

    let isLeader = false;
    let currentLeader: { translatorId: string; claimedAt: number } | null = null;
    const messageBuffer: { id: string; translated: any }[] = [];
    const healthStatus: { [id: string]: { timestamp: number } } = {};

    // Subscribe to leader election, raw messages, and health
    const leaderSub: Subscription = nc.subscribe('leader.election');
    const msgSub = nc.subscribe('raw.messages');
    const healthSub = nc.subscribe('health.status');

    // Health heartbeat every 2 seconds
    const reportHealth = async () => {
        const status = { translatorId, timestamp: Date.now() };
        nc.publish('health.status', sc.encode(JSON.stringify(status)));
        // console.log(`Translator ${translatorId} reported health`);
    };
    reportHealth();
    const healthInterval = setInterval(reportHealth, 2000);

    // Monitor health
    const monitorHealth = async () => {
        for await (const msg of healthSub) {
            const status = JSON.parse(sc.decode(msg.data));
            healthStatus[status.translatorId] = { timestamp: status.timestamp };
        }
    };
    monitorHealth();

    // Leader election
    const attemptLeadership = async () => {
        const now = Date.now();
        if (currentLeader && healthStatus[currentLeader.translatorId]) {
            const lastHeartbeat = healthStatus[currentLeader.translatorId].timestamp;
            if (now - lastHeartbeat < 5000) return; // Leader healthy (5s timeout)
        }

        const claim = { translatorId, claimedAt: now };
        nc.publish('leader.election', sc.encode(JSON.stringify(claim)));
        console.log(`Translator ${translatorId} claimed leadership`);

        // Publish buffered messages if becoming leader
        if (messageBuffer.length > 0) {
            for (const { translated } of messageBuffer) {
                nc.publish('translated.messages', sc.encode(JSON.stringify(translated)));
                console.log(`Translator ${translatorId} (new leader) published buffered: ${translated.payload}`);
            }
            messageBuffer.length = 0;
        }
    };

    const monitorLeadership = async () => {
        for await (const msg of leaderSub) {
            const claim = JSON.parse(sc.decode(msg.data));
            if (!currentLeader || claim.claimedAt <= currentLeader.claimedAt) {
                currentLeader = claim;
                const wasLeader = isLeader;
                isLeader = claim.translatorId === translatorId;
                if (isLeader && !wasLeader && messageBuffer.length > 0) {
                    for (const { translated } of messageBuffer) {
                        nc.publish('translated.messages', sc.encode(JSON.stringify(translated)));
                        console.log(`Translator ${translatorId} (new leader) published buffered: ${translated.payload}`);
                    }
                    messageBuffer.length = 0;
                }
                console.log(`Translator ${translatorId} ${isLeader ? 'is leader' : 'follows leader'} ${currentLeader ? currentLeader.translatorId : 'no leader'}`);
            }
        }
    };
    monitorLeadership();

    setInterval(attemptLeadership, 6000);
    attemptLeadership();

    // Process messages
    for await (const msg of msgSub) {
        try {
            const message = JSON.parse(sc.decode(msg.data));
            // console.log(`Translator ${translatorId} received: ${message.payload}`);

            const translated = { id: message.id, payload: `Translated: ${message.payload}` };
            if (isLeader) {
                nc.publish('translated.messages', sc.encode(JSON.stringify(translated)));
                console.log(`Translator ${translatorId} (leader) published: ${translated.payload}`);
            } else {
                messageBuffer.push({ id: message.id, translated });
                // Keep buffer small (e.g., last 100 messages)
                if (messageBuffer.length > 100) messageBuffer.shift();
            }
        } catch (err) {
            console.error(`Translator ${translatorId} error:`, err);
        }
    }

    clearInterval(healthInterval);
    await nc.closed();
}

startTranslator(process.env.TRANSLATOR_ID || 'unknown').catch(err => {
    console.error('Error:', err);
    process.exit(1);
});